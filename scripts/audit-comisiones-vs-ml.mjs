/**
 * Audit: Compare registered comisión gastos vs actual ML comisiones
 * For each matched manual venta, check what was registered in tesorería
 * vs what ML actually charged as comisión
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

// ═══ Load mlOrderSync ═══
const mlSyncs = await db.collection('mlOrderSync').get();
const syncVentaIds = new Set();
for (const s of mlSyncs.docs) {
  const sd = s.data();
  if (sd.ventaId) syncVentaIds.add(sd.ventaId);
}

const pendientes = mlSyncs.docs
  .filter(d => d.data().estado === 'pendiente')
  .map(d => ({ id: d.id, ...d.data() }));

// ═══ Load manual ventas ═══
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

// ═══ Name matching helpers ═══
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
  const wa = na.split(/\s+/).filter(w => w.length > 2);
  const wb = nb.split(/\s+/).filter(w => w.length > 2);
  if (wa.length === 0 || wb.length === 0) return 0;
  let matchCount = 0;
  for (const w of wa) {
    if (wb.some(w2 => w2.includes(w) || w.includes(w2))) matchCount++;
  }
  return matchCount / Math.max(wa.length, wb.length);
}

// ═══ Precision matching ═══
const usedSync = new Set();
const matches = [];

for (const v of manuales.sort((a, b) => (a.fecha || new Date(0)) - (b.fecha || new Date(0)))) {
  let bestMatch = null;
  let bestScore = 0;

  for (const p of pendientes) {
    if (usedSync.has(p.id)) continue;
    let score = 0;
    const totalML = p.totalML || 0;
    const buyerName = p.mlBuyerName || '';
    const buyerDni = (p.buyerDni || '').trim();
    const buyerPhone = (p.buyerPhone || '').replace(/\D/g, '');
    const fechaML = p.fechaOrdenML?.toDate?.() || null;

    if (v.clienteDni && buyerDni && v.clienteDni === buyerDni) { score += 50; }
    const nameSim = nameSimilarity(v.clienteNombre, buyerName);
    if (nameSim >= 0.8) { score += 30; }
    else if (nameSim >= 0.5) { score += 15; }
    if (v.clienteTelefono && buyerPhone && v.clienteTelefono.length >= 7 && buyerPhone.length >= 7) {
      if (v.clienteTelefono === buyerPhone || v.clienteTelefono.endsWith(buyerPhone.slice(-9)) || buyerPhone.endsWith(v.clienteTelefono.slice(-9))) {
        score += 20;
      }
    }
    if (Math.abs(v.productoTotal - totalML) < 0.01) { score += 25; }
    else if (Math.abs(v.totalPEN - totalML) < 0.01) { score += 20; }
    else if (Math.abs(v.totalPEN - (totalML + (p.costoEnvioCliente || 0))) < 0.01) { score += 20; }
    else { score -= 30; }
    if (v.fecha && fechaML) {
      const diffDays = Math.abs((v.fecha - fechaML) / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) { score += 10; }
      else if (diffDays <= 3) { score += 5; }
      else if (diffDays <= 7) { score += 2; }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = p;
    }
  }

  if (bestMatch && bestScore >= 20) {
    usedSync.add(bestMatch.id);
    matches.push({ venta: v, sync: bestMatch, score: bestScore });
  }
}

// ═══ Now audit each match: registered movements vs ML reality ═══
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('    AUDITORÍA DETALLADA: Comisiones Registradas vs ML Real');
console.log('═══════════════════════════════════════════════════════════════════════\n');

let totalDiffComision = 0;
let totalDiffEnvio = 0;
let totalDiffIngreso = 0;
let totalDepositoEsperado = 0;
let totalNetoRegistrado = 0;

// Also load ALL movements for MP account
const movsO = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();

// Group movements by ventaId
const movsByVenta = {};
for (const m of [...movsO.docs, ...movsD.docs]) {
  const md = m.data();
  const vid = md.ventaId || '';
  if (!vid) continue;
  if (!movsByVenta[vid]) movsByVenta[vid] = [];
  // Avoid duplicates
  if (!movsByVenta[vid].some(x => x.id === m.id)) {
    movsByVenta[vid].push({ id: m.id, ...md });
  }
}

// Load ALL gastos for comisión analysis
const gastosSnap = await db.collection('gastos').get();
const gastosByVentaId = {};
const gastosByConcepto = {};
for (const g of gastosSnap.docs) {
  const gd = g.data();
  if (gd.cuentaCajaId !== mpId) continue;

  const vid = gd.ventaId || '';
  if (vid) {
    if (!gastosByVentaId[vid]) gastosByVentaId[vid] = [];
    gastosByVentaId[vid].push({ id: g.id, ...gd });
  }

  // Also index by concepto for gastos not linked by ventaId
  const concepto = gd.concepto || gd.descripcion || '';
  if (!gastosByConcepto[concepto]) gastosByConcepto[concepto] = [];
  gastosByConcepto[concepto].push({ id: g.id, ...gd });
}

// For each match, compare registered vs expected
for (const m of matches.sort((a, b) => (a.venta.fecha || new Date(0)) - (b.venta.fecha || new Date(0)))) {
  const v = m.venta;
  const s = m.sync;
  const met = s.metodoEnvio || '?';
  const comML = s.comisionML || 0;
  const costoEnvCli = s.costoEnvioCliente || 0;
  const cargoEnvML = s.cargoEnvioML || 0;

  // What ML actually deposited
  let depositoML;
  if (met === 'urbano') {
    depositoML = s.totalML - comML - cargoEnvML;
  } else {
    depositoML = s.totalML + costoEnvCli - comML;
  }
  totalDepositoEsperado += depositoML;

  // What's registered in movements for this venta
  const movs = movsByVenta[v.id] || [];
  let ingresoReg = 0;
  let gastoComReg = 0;
  let gastoEnvReg = 0;

  for (const mov of movs) {
    if (mov.estado === 'anulado') continue;

    if (mov.tipo === 'ingreso_venta' && (mov.cuentaDestino === mpId || mov.cuentaOrigen === mpId)) {
      ingresoReg += mov.monto || 0;
    }
    if (mov.tipo === 'gasto_operativo' && mov.cuentaOrigen === mpId) {
      const concepto = mov.concepto || '';
      if (concepto.includes('Entrega') || concepto.includes('envío') || concepto.includes('Cargo envío')) {
        gastoEnvReg += mov.monto || 0;
      } else {
        gastoComReg += mov.monto || 0;
      }
    }
  }

  // Also check gastos collection directly
  const gastosV = gastosByVentaId[v.id] || [];
  let gastoComFromGastos = 0;
  let gastoEnvFromGastos = 0;
  for (const g of gastosV) {
    if (g.estado === 'anulado') continue;
    const concepto = g.concepto || g.descripcion || '';
    if (concepto.includes('Entrega') || concepto.includes('envío') || concepto.includes('Cargo envío')) {
      gastoEnvFromGastos += g.monto || 0;
    } else if (concepto.includes('Comisión') || concepto.includes('comision') || concepto.includes('comisión')) {
      gastoComFromGastos += g.monto || 0;
    }
  }

  const netoReg = ingresoReg - gastoComReg - gastoEnvReg;
  totalNetoRegistrado += netoReg;
  const diff = netoReg - depositoML;

  const diffComision = gastoComReg - comML;
  const diffIngreso = ingresoReg - v.totalPEN;

  if (Math.abs(diff) > 0.5) {
    totalDiffComision += diffComision;

    console.log(`${v.num} ↔ ML#${s.mlOrderId} | ${met.padEnd(7)} | score=${m.score}`);
    console.log(`  ML: total=${s.totalML} com=${comML} ${met === 'urbano' ? 'cargoEnv=' + cargoEnvML : 'costoEnvCli=' + costoEnvCli}`);
    console.log(`  ML depósito esperado:    S/ ${depositoML.toFixed(2)}`);
    console.log(`  Reg: ingreso=${ingresoReg.toFixed(2)} gastosCom=${gastoComReg.toFixed(2)} gastosEnv=${gastoEnvReg.toFixed(2)} neto=${netoReg.toFixed(2)}`);
    console.log(`  DIFERENCIA:              S/ ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`);

    // Explain the difference
    const issues = [];
    if (Math.abs(ingresoReg - v.totalPEN) > 0.01 && ingresoReg > 0) {
      issues.push(`ingreso(${ingresoReg.toFixed(2)}) != totalPEN(${v.totalPEN})`);
    }
    if (comML > 0 && gastoComReg === 0) {
      issues.push(`comisión ML S/${comML} NO registrada como gasto`);
    }
    if (Math.abs(gastoComReg - comML) > 0.01 && gastoComReg > 0) {
      issues.push(`comisión reg(${gastoComReg.toFixed(2)}) != ML(${comML})`);
    }
    if (met === 'urbano' && cargoEnvML > 0 && gastoEnvReg === 0) {
      issues.push(`cargo envío Urbano S/${cargoEnvML} NO registrado`);
    }
    if (costoEnvCli > 0 && v.costoEnvio === 0 && met !== 'urbano') {
      issues.push(`Flex envío S/${costoEnvCli} no en totalPEN (no registrado)`);
    }
    if (ingresoReg === 0) {
      issues.push(`SIN ingreso registrado en MP`);
    }
    if (issues.length > 0) {
      console.log(`  → ${issues.join('; ')}`);
    }

    // Show gastos from gastos collection
    if (gastosV.length > 0) {
      console.log(`  Gastos collection (${gastosV.length}):`);
      for (const g of gastosV) {
        console.log(`    ${g.id}: ${g.concepto || g.descripcion || '?'} S/${(g.monto || 0).toFixed(2)} ${g.estado === 'anulado' ? '[ANULADO]' : ''}`);
      }
    }
    console.log('');
  }
}

// ═══ Also look for "Comisión ML" gastos NOT linked by ventaId ═══
console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('    GASTOS "COMISIÓN" EN MP SIN ventaId (posibles comisiones sueltas)');
console.log('═══════════════════════════════════════════════════════════════════════\n');

let totalComSueltas = 0;
for (const g of gastosSnap.docs) {
  const gd = g.data();
  if (gd.cuentaCajaId !== mpId) continue;
  if (gd.ventaId) continue; // already linked
  if (gd.estado === 'anulado') continue;

  const concepto = (gd.concepto || gd.descripcion || '').toLowerCase();
  if (concepto.includes('comisi') || concepto.includes('mercado')) {
    totalComSueltas += gd.monto || 0;
    console.log(`  ${g.id} | ${gd.concepto || gd.descripcion || '?'} | S/ ${(gd.monto || 0).toFixed(2)} | fecha: ${gd.fecha?.toDate?.()?.toISOString?.()?.substring(0, 10) || '?'}`);
  }
}
console.log(`\nTotal comisiones sueltas: S/ ${totalComSueltas.toFixed(2)}`);

// ═══ Also check movements that are gastos from MP without ventaId ═══
console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('    MOVIMIENTOS gasto_operativo DE MP SIN ventaId');
console.log('═══════════════════════════════════════════════════════════════════════\n');

let totalGastosSinVenta = 0;
let totalGastosComSinVenta = 0;
let totalGastosEnvSinVenta = 0;
for (const m of movsO.docs) {
  const md = m.data();
  if (md.estado === 'anulado') continue;
  if (md.ventaId) continue;
  if (md.tipo !== 'gasto_operativo') continue;

  const concepto = (md.concepto || '');
  const monto = md.monto || 0;
  totalGastosSinVenta += monto;

  if (concepto.toLowerCase().includes('comisi') || concepto.toLowerCase().includes('mercado')) {
    totalGastosComSinVenta += monto;
  } else if (concepto.toLowerCase().includes('enví') || concepto.toLowerCase().includes('envio') || concepto.toLowerCase().includes('entrega') || concepto.toLowerCase().includes('cargo')) {
    totalGastosEnvSinVenta += monto;
  }

  console.log(`  ${md.numeroMovimiento || m.id} | ${concepto} | S/ ${monto.toFixed(2)} | fecha: ${md.fecha?.toDate?.()?.toISOString?.()?.substring(0, 10) || '?'}`);
}
console.log(`\nTotal gastos sin ventaId: S/ ${totalGastosSinVenta.toFixed(2)}`);
console.log(`  De los cuales comisiones: S/ ${totalGastosComSinVenta.toFixed(2)}`);
console.log(`  De los cuales envío: S/ ${totalGastosEnvSinVenta.toFixed(2)}`);

// ═══ Now calculate complete picture ═══
console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('    RESUMEN COMPLETO: Neto Registrado vs Depósito Esperado');
console.log('═══════════════════════════════════════════════════════════════════════\n');

// Calculate saldo from active movements
let saldoActivos = 0;
const allMovs = new Map();
for (const m of movsO.docs) allMovs.set(m.id, { doc: m, esO: true, esD: false });
for (const m of movsD.docs) {
  if (allMovs.has(m.id)) allMovs.get(m.id).esD = true;
  else allMovs.set(m.id, { doc: m, esO: false, esD: true });
}

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

console.log(`Saldo calculado (movimientos activos): S/ ${saldoActivos.toFixed(2)}`);
console.log(`saldoActual (sistema):                 S/ ${mpData.saldoActual.toFixed(2)}`);
console.log(`Saldo real MercadoPago:                S/ ${SALDO_REAL.toFixed(2)}`);
console.log(`\nDrift sistema vs movimientos:           S/ ${(mpData.saldoActual - saldoActivos).toFixed(2)}`);
console.log(`Error movimientos vs real:              S/ ${(saldoActivos - SALDO_REAL).toFixed(2)}`);

// ═══ ML-processed ventas (webhook) - check these too ═══
console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('    VENTAS PROCESADAS POR WEBHOOK: Verificación de comisiones');
console.log('═══════════════════════════════════════════════════════════════════════\n');

const procesadas = mlSyncs.docs
  .filter(d => d.data().estado === 'procesada')
  .map(d => ({ id: d.id, ...d.data() }));

let webhookDiffTotal = 0;
for (const s of procesadas) {
  const vid = s.ventaId;
  if (!vid) continue;

  const movs = movsByVenta[vid] || [];
  let ingresoReg = 0;
  let gastoComReg = 0;
  let gastoEnvReg = 0;

  for (const mov of movs) {
    if (mov.estado === 'anulado') continue;
    if (mov.tipo === 'ingreso_venta' && (mov.cuentaDestino === mpId || mov.cuentaOrigen === mpId)) {
      ingresoReg += mov.monto || 0;
    }
    if (mov.tipo === 'gasto_operativo' && mov.cuentaOrigen === mpId) {
      const concepto = mov.concepto || '';
      if (concepto.includes('Entrega') || concepto.includes('envío') || concepto.includes('Cargo envío')) {
        gastoEnvReg += mov.monto || 0;
      } else {
        gastoComReg += mov.monto || 0;
      }
    }
  }

  const met = s.metodoEnvio || '?';
  const comML = s.comisionML || 0;
  const costoEnvCli = s.costoEnvioCliente || 0;
  const cargoEnvML = s.cargoEnvioML || 0;

  let depositoML;
  if (met === 'urbano') {
    depositoML = s.totalML - comML - cargoEnvML;
  } else {
    depositoML = s.totalML + costoEnvCli - comML;
  }

  const netoReg = ingresoReg - gastoComReg - gastoEnvReg;
  const diff = netoReg - depositoML;

  if (Math.abs(diff) > 0.5) {
    webhookDiffTotal += diff;
    console.log(`${s.numeroVenta || '?'} ↔ ML#${s.mlOrderId} | ${met.padEnd(7)} | webhook`);
    console.log(`  ML depósito: S/ ${depositoML.toFixed(2)} | Reg neto: S/ ${netoReg.toFixed(2)} | DIFF: S/ ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`);
    console.log(`  ingreso=${ingresoReg.toFixed(2)} gastosCom=${gastoComReg.toFixed(2)} gastosEnv=${gastoEnvReg.toFixed(2)}`);
  }
}
console.log(`\nTotal diferencias webhook: S/ ${webhookDiffTotal.toFixed(2)}`);

// ═══ Final: what SHOULD the MP balance be? ═══
console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('    BALANCE TEÓRICO ML (todas las órdenes)');
console.log('═══════════════════════════════════════════════════════════════════════\n');

let totalMLDeposits = 0;
for (const s of [...procesadas, ...pendientes.filter(p => matches.some(m => m.sync.id === p.id))]) {
  const met = s.metodoEnvio || '?';
  const comML = s.comisionML || 0;
  const costoEnvCli = s.costoEnvioCliente || 0;
  const cargoEnvML = s.cargoEnvioML || 0;

  let depositoML;
  if (met === 'urbano') {
    depositoML = s.totalML - comML - cargoEnvML;
  } else {
    depositoML = s.totalML + costoEnvCli - comML;
  }
  totalMLDeposits += depositoML;
}

// Also count non-ML movements (transfers, other income/expenses)
let totalNonMLIncome = 0;
let totalNonMLExpense = 0;
const ventaIdsFromML = new Set([
  ...procesadas.map(s => s.ventaId).filter(Boolean),
  ...matches.map(m => m.venta.id)
]);

for (const [id, { doc, esO, esD }] of allMovs) {
  const d = doc.data();
  if (d.estado === 'anulado') continue;
  const vid = d.ventaId || '';
  if (ventaIdsFromML.has(vid)) continue; // Skip ML-related

  const monto = d.monto || 0;
  const tipo = d.tipo;

  if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(tipo)) {
    totalNonMLIncome += monto;
  } else if (['gasto_operativo', 'egreso', 'gasto'].includes(tipo)) {
    totalNonMLExpense += monto;
  } else if (tipo === 'transferencia_interna') {
    if (esO && !esD) totalNonMLExpense += monto;
    else if (esD && !esO) totalNonMLIncome += monto;
  } else if (tipo === 'conversion_compra') totalNonMLExpense += monto;
  else if (tipo === 'conversion_venta') totalNonMLIncome += monto;
}

console.log(`Total depósitos ML (todas las órdenes):  S/ ${totalMLDeposits.toFixed(2)}`);
console.log(`Total ingresos no-ML:                    S/ ${totalNonMLIncome.toFixed(2)}`);
console.log(`Total egresos no-ML:                     S/ ${totalNonMLExpense.toFixed(2)}`);
console.log(`Balance teórico:                         S/ ${(totalMLDeposits + totalNonMLIncome - totalNonMLExpense).toFixed(2)}`);
console.log(`Saldo real:                              S/ ${SALDO_REAL.toFixed(2)}`);
console.log(`Diferencia:                              S/ ${(totalMLDeposits + totalNonMLIncome - totalNonMLExpense - SALDO_REAL).toFixed(2)}`);

// ═══ Special cases ═══
console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('    VENTAS MANUALES SIN MATCH (pagos a otra cuenta?)');
console.log('═══════════════════════════════════════════════════════════════════════\n');

const matchedVentaIds = new Set(matches.map(m => m.venta.id));
for (const v of manuales) {
  if (matchedVentaIds.has(v.id)) continue;

  const movs = movsByVenta[v.id] || [];
  let ingresoReg = 0;
  for (const mov of movs) {
    if (mov.estado === 'anulado') continue;
    if (mov.tipo === 'ingreso_venta') ingresoReg += mov.monto || 0;
  }

  console.log(`  ${v.num} | S/ ${v.totalPEN} | ${v.clienteNombre} | ingreso MP: S/ ${ingresoReg.toFixed(2)}`);
}
