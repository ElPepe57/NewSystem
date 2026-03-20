/**
 * Precision matching: manual ventas ↔ ML orders
 * Using: client name, DNI, amount, and approximate date
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';
const SALDO_REAL = 2677.51;

// ═══ Load clients ═══
const clientesSnap = await db.collection('clientes').get();
const clientesById = {};
for (const c of clientesSnap.docs) {
  clientesById[c.id] = c.data();
}

// ═══ Load mlOrderSync pendientes ═══
const mlSyncs = await db.collection('mlOrderSync').get();
const syncVentaIds = new Set();
for (const s of mlSyncs.docs) {
  const sd = s.data();
  if (sd.ventaId) syncVentaIds.add(sd.ventaId);
}

const pendientes = mlSyncs.docs
  .filter(d => d.data().estado === 'pendiente')
  .map(d => ({ id: d.id, ...d.data() }));

// ═══ Load manual ventas with client info ═══
const ventasSnap = await db.collection('ventas').get();
const manuales = [];
for (const v of ventasSnap.docs) {
  if (syncVentaIds.has(v.id)) continue;
  const vd = v.data();
  const pagos = vd.pagos || [];
  if (!pagos.some(p => p.metodoPago === 'mercado_pago')) continue;

  const clienteId = vd.clienteId || vd.cliente?.id || '';
  const cliente = clientesById[clienteId] || {};

  manuales.push({
    id: v.id,
    num: vd.numeroVenta,
    totalPEN: vd.totalPEN || 0,
    costoEnvio: vd.costoEnvio || 0,
    productoTotal: (vd.totalPEN || 0) - (vd.costoEnvio || 0),
    fecha: vd.fechaCreacion?.toDate?.() || null,
    clienteId,
    clienteNombre: (vd.clienteNombre || cliente.nombre || '').toLowerCase().trim(),
    clienteDni: (cliente.dniRuc || cliente.dni || vd.clienteDni || '').trim(),
    clienteTelefono: (cliente.telefono || '').replace(/\D/g, ''),
  });
}

// ═══ Normalize name for comparison ═══
function normName(n) {
  return (n || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '').trim();
}

function nameSimilarity(a, b) {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;

  // Check if all words from one appear in the other
  const wa = na.split(/\s+/).filter(w => w.length > 2);
  const wb = nb.split(/\s+/).filter(w => w.length > 2);
  if (wa.length === 0 || wb.length === 0) return 0;

  let matchCount = 0;
  for (const w of wa) {
    if (wb.some(w2 => w2.includes(w) || w.includes(w2))) matchCount++;
  }
  const score = matchCount / Math.max(wa.length, wb.length);
  return score;
}

// ═══ Match with scoring ═══
console.log('═══════════════════════════════════════════════════════════');
console.log('    MATCHING DE PRECISIÓN: Nombre + DNI + Monto + Fecha');
console.log('═══════════════════════════════════════════════════════════\n');

const usedSync = new Set();
const matches = [];

for (const v of manuales.sort((a, b) => (a.fecha || new Date(0)) - (b.fecha || new Date(0)))) {
  let bestMatch = null;
  let bestScore = 0;
  let bestDetail = '';

  for (const p of pendientes) {
    if (usedSync.has(p.id)) continue;

    let score = 0;
    const reasons = [];
    const totalML = p.totalML || 0;
    const buyerName = p.mlBuyerName || '';
    const buyerDni = (p.buyerDni || '').trim();
    const buyerPhone = (p.buyerPhone || '').replace(/\D/g, '');
    const fechaML = p.fechaOrdenML?.toDate?.() || null;

    // 1. DNI match (strongest signal)
    if (v.clienteDni && buyerDni && v.clienteDni === buyerDni) {
      score += 50;
      reasons.push(`DNI=${v.clienteDni}`);
    }

    // 2. Name match
    const nameSim = nameSimilarity(v.clienteNombre, buyerName);
    if (nameSim >= 0.8) {
      score += 30;
      reasons.push(`nombre=${(nameSim * 100).toFixed(0)}%`);
    } else if (nameSim >= 0.5) {
      score += 15;
      reasons.push(`nombre~${(nameSim * 100).toFixed(0)}%`);
    }

    // 3. Phone match
    if (v.clienteTelefono && buyerPhone && v.clienteTelefono.length >= 7 && buyerPhone.length >= 7) {
      if (v.clienteTelefono === buyerPhone || v.clienteTelefono.endsWith(buyerPhone.slice(-9)) || buyerPhone.endsWith(v.clienteTelefono.slice(-9))) {
        score += 20;
        reasons.push('tel=match');
      }
    }

    // 4. Amount match
    if (Math.abs(v.productoTotal - totalML) < 0.01) {
      score += 25;
      reasons.push(`monto=exact(prod ${v.productoTotal}=ML ${totalML})`);
    } else if (Math.abs(v.totalPEN - totalML) < 0.01) {
      score += 20;
      reasons.push(`monto=total(${v.totalPEN}=ML ${totalML})`);
    } else if (Math.abs(v.totalPEN - (totalML + (p.costoEnvioCliente || 0))) < 0.01) {
      score += 20;
      reasons.push(`monto=total+env(${v.totalPEN}=ML ${totalML}+${p.costoEnvioCliente})`);
    } else {
      // No amount match — heavily penalize
      score -= 30;
    }

    // 5. Date proximity
    if (v.fecha && fechaML) {
      const diffDays = Math.abs((v.fecha - fechaML) / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) { score += 10; reasons.push(`fecha=${diffDays.toFixed(1)}d`); }
      else if (diffDays <= 3) { score += 5; reasons.push(`fecha~${diffDays.toFixed(0)}d`); }
      else if (diffDays <= 7) { score += 2; reasons.push(`fecha≈${diffDays.toFixed(0)}d`); }
      else { reasons.push(`fecha=${diffDays.toFixed(0)}d⚠`); }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = p;
      bestDetail = reasons.join(' | ');
    }
  }

  if (bestMatch && bestScore >= 20) {
    usedSync.add(bestMatch.id);
    matches.push({ venta: v, sync: bestMatch, score: bestScore, detail: bestDetail });
  } else {
    console.log(`❓ ${v.num} | S/${v.totalPEN} | ${v.clienteNombre} | Score=${bestScore} | SIN MATCH CONFIABLE`);
    if (bestMatch) {
      console.log(`   Mejor candidato: ML#${bestMatch.mlOrderId} ${bestMatch.mlBuyerName} S/${bestMatch.totalML} (score=${bestScore}: ${bestDetail})`);
    }
  }
}

// ═══ Show matches sorted by score ═══
console.log(`\nMatches encontrados: ${matches.length}/${manuales.length}\n`);
matches.sort((a, b) => a.venta.fecha - b.venta.fecha);

let totalDepositoEsperado = 0;
let totalCargoUrbano = 0;
let totalFlexFaltante = 0;
let totalFlexDiff = 0;
let countUrbano = 0;
let countFlex = 0;

for (const m of matches) {
  const v = m.venta;
  const s = m.sync;
  const met = s.metodoEnvio || '?';
  const comML = s.comisionML || 0;
  const costoEnvCli = s.costoEnvioCliente || 0;
  const cargoEnvML = s.cargoEnvioML || 0;
  const conf = m.score >= 50 ? '✅' : m.score >= 30 ? '🟡' : '🔴';

  // What ML deposited
  let depositoML;
  if (met === 'urbano') {
    depositoML = s.totalML - comML - cargoEnvML;
    totalCargoUrbano += cargoEnvML;
    countUrbano++;
  } else {
    depositoML = s.totalML + costoEnvCli - comML;
    countFlex++;
    if (v.costoEnvio === 0 && costoEnvCli > 0) {
      totalFlexFaltante += costoEnvCli;
    }
    if (v.costoEnvio > 0 && Math.abs(v.costoEnvio - costoEnvCli) > 0.01) {
      totalFlexDiff += (costoEnvCli - v.costoEnvio);
    }
  }
  totalDepositoEsperado += depositoML;

  console.log(
    `${conf} ${v.num} ↔ ML#${s.mlOrderId} | score=${m.score} | ${(s.mlBuyerName || '?').substring(0, 22).padEnd(22)} | ${met.padEnd(7)} | ML:${s.totalML} com:${comML} env:${met === 'urbano' ? -cargoEnvML : '+' + costoEnvCli}`
  );
  console.log(`   ${m.detail}`);
}

// ═══ Financial simulation ═══
console.log('\n═══════════════════════════════════════════════════════════');
console.log('    SIMULACIÓN FINANCIERA CON MATCHING DE PRECISIÓN');
console.log('═══════════════════════════════════════════════════════════\n');

// Current saldo from active movements
const movsO = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();
const allMovs = new Map();
for (const m of movsO.docs) allMovs.set(m.id, { doc: m, esO: true, esD: false });
for (const m of movsD.docs) {
  if (allMovs.has(m.id)) allMovs.get(m.id).esD = true;
  else allMovs.set(m.id, { doc: m, esO: false, esD: true });
}
let saldoActivos = 0;
for (const [id, { doc, esO, esD }] of allMovs) {
  const d = doc.data();
  if (d.estado === 'anulado') continue;
  const monto = d.monto || 0;
  const tipo = d.tipo;
  if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(tipo)) saldoActivos += monto;
  else if (['gasto_operativo', 'egreso', 'gasto'].includes(tipo)) saldoActivos -= monto;
  else if (tipo === 'transferencia_interna') {
    if (esO && !esD) saldoActivos -= monto;
    else if (esD && !esO) saldoActivos += monto;
  }
  else if (tipo === 'conversion_compra') saldoActivos -= monto;
  else if (tipo === 'conversion_venta') saldoActivos += monto;
}

const mpData = (await db.collection('cuentasCaja').doc(mpId).get()).data();

// Corrections
const fixWebhook1 = -4.17;  // VT-2026-061
const fixWebhook2 = -20.10; // VT-2026-062a
const fixUrbano = -totalCargoUrbano;
const fixFlexFaltante = totalFlexFaltante;
const fixFlexAjuste = -65.10; // ya existe
const fixFlexDiff = totalFlexDiff;
const totalCorrecciones = fixWebhook1 + fixWebhook2 + fixUrbano + fixFlexFaltante + fixFlexAjuste + fixFlexDiff;
const saldoCorregido = saldoActivos + totalCorrecciones;
const residual = saldoCorregido - SALDO_REAL;

console.log(`Saldo desde movimientos activos:   S/ ${saldoActivos.toFixed(2)}`);
console.log(`saldoActual (sistema):             S/ ${mpData.saldoActual.toFixed(2)}`);
console.log(`Saldo real:                        S/ ${SALDO_REAL.toFixed(2)}\n`);

console.log('Correcciones:');
console.log(`  Webhook VT-2026-061 ingreso:     ${fixWebhook1.toFixed(2)}`);
console.log(`  Webhook VT-2026-062a comisión:   ${fixWebhook2.toFixed(2)}`);
console.log(`  Urbano cargo envío (${countUrbano} ord):    ${fixUrbano.toFixed(2)}`);
console.log(`  Flex envío faltante:             +${fixFlexFaltante.toFixed(2)}`);
console.log(`  Flex ajuste existente:           ${fixFlexAjuste.toFixed(2)}`);
console.log(`  Flex dif envío:                  ${fixFlexDiff >= 0 ? '+' : ''}${fixFlexDiff.toFixed(2)}`);
console.log(`  ─────────────────────────────────`);
console.log(`  Total correcciones:              ${totalCorrecciones.toFixed(2)}\n`);

console.log(`  SALDO CORREGIDO:                 S/ ${saldoCorregido.toFixed(2)}`);
console.log(`  SALDO REAL:                      S/ ${SALDO_REAL.toFixed(2)}`);
console.log(`  RESIDUAL:                        S/ ${residual.toFixed(2)} (${(Math.abs(residual) / SALDO_REAL * 100).toFixed(2)}%)`);
console.log(`\n  (Antes el error era S/ ${(mpData.saldoActual - SALDO_REAL).toFixed(2)} → ahora sería S/ ${residual.toFixed(2)})`);

// Quality assessment
const highConf = matches.filter(m => m.score >= 50).length;
const medConf = matches.filter(m => m.score >= 30 && m.score < 50).length;
const lowConf = matches.filter(m => m.score < 30).length;
console.log(`\nCalidad del matching:`);
console.log(`  ✅ Alta confianza (≥50):  ${highConf} ventas`);
console.log(`  🟡 Media (30-49):         ${medConf} ventas`);
console.log(`  🔴 Baja (<30):            ${lowConf} ventas`);
