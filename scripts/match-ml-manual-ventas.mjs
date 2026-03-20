/**
 * Match manual ventas with ML pending orders by amount + name
 * Then calculate what ML really deposited vs what was registered
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

// 1. Load all pending mlOrderSync
const mlSyncs = await db.collection('mlOrderSync').get();
const pendientes = [];
const procesadas = [];
for (const s of mlSyncs.docs) {
  const sd = s.data();
  if (sd.estado === 'pendiente') {
    pendientes.push({ id: s.id, ...sd });
  } else if (sd.estado === 'procesada') {
    procesadas.push({ id: s.id, ...sd });
  }
}

// 2. Load manual ventas (MP payment, not in mlOrderSync)
const syncVentaIds = new Set();
for (const s of mlSyncs.docs) {
  const sd = s.data();
  if (sd.ventaId) syncVentaIds.add(sd.ventaId);
}

const ventas = await db.collection('ventas').get();
const manuales = [];
for (const v of ventas.docs) {
  if (syncVentaIds.has(v.id)) continue;
  const vd = v.data();
  const pagos = vd.pagos || [];
  const tieneMP = pagos.some(p => p.metodoPago === 'mercado_pago');
  if (tieneMP) {
    manuales.push({
      id: v.id,
      num: vd.numeroVenta,
      cliente: vd.clienteNombre || '',
      totalPEN: vd.totalPEN || 0,
      costoEnvio: vd.costoEnvio || 0,
      productoTotal: (vd.totalPEN || 0) - (vd.costoEnvio || 0),
      fecha: vd.fechaCreacion?.toDate?.(),
      montoPagado: vd.montoPagado || 0,
    });
  }
}

// 3. Match by totalML (producto) and name similarity
console.log('═══════════════════════════════════════════════');
console.log('MATCHING: Ventas manuales ↔ Órdenes ML');
console.log('═══════════════════════════════════════════════\n');

const matched = [];
const usedSync = new Set();

for (const v of manuales.sort((a, b) => (a.fecha || new Date(0)) - (b.fecha || new Date(0)))) {
  // Try to match by product total (totalPEN - costoEnvio == totalML)
  let bestMatch = null;
  let bestScore = 0;

  for (const p of pendientes) {
    if (usedSync.has(p.id)) continue;

    const totalML = p.totalML || 0;

    // Match 1: exact totalML == productoTotal
    if (Math.abs(v.productoTotal - totalML) < 0.01) {
      const score = 100;
      if (score > bestScore) { bestScore = score; bestMatch = p; }
    }
    // Match 2: totalML == totalPEN (no envío registered)
    else if (Math.abs(v.totalPEN - totalML) < 0.01) {
      const score = 90;
      if (score > bestScore) { bestScore = score; bestMatch = p; }
    }
    // Match 3: totalML + envío flex == totalPEN
    else if (Math.abs(v.totalPEN - (totalML + (p.costoEnvioCliente || 0))) < 0.01) {
      const score = 85;
      if (score > bestScore) { bestScore = score; bestMatch = p; }
    }
  }

  if (bestMatch) {
    usedSync.add(bestMatch.id);
    matched.push({ venta: v, sync: bestMatch, score: bestScore });
  } else {
    console.log(`❓ ${v.num} | S/ ${v.totalPEN} (prod: ${v.productoTotal}) | SIN MATCH ML`);
  }
}

// 4. Show matches and calculate discrepancies
console.log('\n═══════════════════════════════════════════════');
console.log('MATCHES ENCONTRADOS');
console.log('═══════════════════════════════════════════════\n');

let totalDepositoEsperado = 0;
let totalIngresoRegistrado = 0;
let totalComisionML = 0;
let totalComisionRegistrada = 0;
let totalEnvioFlex = 0;
let totalEnvioRegistrado = 0;
let totalCargoUrbano = 0;

for (const m of matched) {
  const v = m.venta;
  const s = m.sync;
  const met = s.metodoEnvio || '?';
  const comML = s.comisionML || 0;
  const costoEnvCli = s.costoEnvioCliente || 0;
  const cargoEnvML = s.cargoEnvioML || 0;

  // What ML deposited
  let depositoML;
  if (met === 'urbano') {
    depositoML = s.totalML - comML - cargoEnvML;
  } else {
    // Flex or unknown: ML deposits totalML + envío - comisión
    depositoML = s.totalML + costoEnvCli - comML;
  }

  // What was registered in tesorería
  // Ingreso = totalPEN registered as payment (full amount)
  // Comisión gasto = check if exists
  const movI = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', v.id)
    .where('tipo', '==', 'ingreso_venta')
    .get();
  let ingresoReg = 0;
  for (const mi of movI.docs) {
    const md = mi.data();
    if (md.estado === 'anulado') continue;
    if (md.cuentaOrigen === mpId || md.cuentaDestino === mpId) {
      ingresoReg += md.monto || 0;
    }
  }

  const movG = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', v.id)
    .where('tipo', '==', 'gasto_operativo')
    .get();
  let gastoComReg = 0;
  let gastoEnvReg = 0;
  for (const mg of movG.docs) {
    const md = mg.data();
    if (md.estado === 'anulado') continue;
    if (md.cuentaOrigen === mpId) {
      const c = md.concepto || '';
      if (c.includes('Entrega') || c.includes('envío') || c.includes('Cargo envío')) {
        gastoEnvReg += md.monto || 0;
      } else {
        gastoComReg += md.monto || 0;
      }
    }
  }

  const netoReg = ingresoReg - gastoComReg - gastoEnvReg;
  const diff = netoReg - depositoML;

  totalDepositoEsperado += depositoML;
  totalIngresoRegistrado += ingresoReg;
  totalComisionML += comML;
  totalComisionRegistrada += gastoComReg;
  totalEnvioFlex += costoEnvCli;
  totalEnvioRegistrado += v.costoEnvio;
  totalCargoUrbano += cargoEnvML;

  const flag = Math.abs(diff) > 0.01 ? '❌' : '✅';
  const envInfo = met === 'urbano'
    ? `cargo:-${cargoEnvML}`
    : met === 'flex'
      ? `flex:+${costoEnvCli}`
      : `env:${costoEnvCli}`;

  console.log(
    `${flag} ${v.num} ↔ ML#${s.mlOrderId} | ${(s.mlBuyerName||'?').substring(0,25).padEnd(25)} | met:${(met||'?').padEnd(7)} | ML:${s.totalML} | ${envInfo} | com:${comML}`
  );
  console.log(
    `   depósito esperado: S/ ${depositoML.toFixed(2)} | ingreso reg: S/ ${ingresoReg.toFixed(2)} | gas com: S/ ${gastoComReg.toFixed(2)} | gas env: S/ ${gastoEnvReg.toFixed(2)} | neto: S/ ${netoReg.toFixed(2)} | diff: ${diff >= 0 ? '+' : ''}S/ ${diff.toFixed(2)}`
  );
  if (Math.abs(diff) > 0.01) {
    // Breakdown
    const issues = [];
    if (Math.abs(ingresoReg - v.totalPEN) > 0.01) issues.push(`ingreso(${ingresoReg}) != totalPEN(${v.totalPEN})`);
    if (comML > 0 && gastoComReg === 0) issues.push(`comisión S/${comML} NO registrada`);
    if (Math.abs(gastoComReg - comML) > 0.01 && gastoComReg > 0) issues.push(`comisión reg(${gastoComReg}) != ML(${comML})`);
    if (met === 'urbano' && cargoEnvML > 0 && gastoEnvReg === 0) issues.push(`cargo envío Urbano S/${cargoEnvML} NO registrado`);
    if (v.costoEnvio > 0 && met === 'urbano') issues.push(`venta tiene costoEnvio=${v.costoEnvio} pero es Urbano`);
    if (costoEnvCli > 0 && v.costoEnvio === 0 && met !== 'urbano') issues.push(`Flex envío S/${costoEnvCli} NO en totalPEN`);
    console.log(`   → Problemas: ${issues.join('; ')}`);
  }
  console.log('');
}

// 5. Summary
console.log('═══════════════════════════════════════════════');
console.log('RESUMEN VENTAS MANUALES ML');
console.log('═══════════════════════════════════════════════\n');

console.log(`Ventas manuales con match ML: ${matched.length}/${manuales.length}`);
console.log(`Total depósito esperado ML: S/ ${totalDepositoEsperado.toFixed(2)}`);
console.log(`Total ingreso registrado:   S/ ${totalIngresoRegistrado.toFixed(2)}`);
console.log(`Total comisión ML:          S/ ${totalComisionML.toFixed(2)}`);
console.log(`Total comisión registrada:  S/ ${totalComisionRegistrada.toFixed(2)}`);
console.log(`Total envío Flex:           S/ ${totalEnvioFlex.toFixed(2)}`);
console.log(`Total envío en ventas:      S/ ${totalEnvioRegistrado.toFixed(2)}`);
console.log(`Total cargo Urbano:         S/ ${totalCargoUrbano.toFixed(2)}`);
console.log(`\nNeto registrado:            S/ ${(totalIngresoRegistrado - totalComisionRegistrada).toFixed(2)}`);
console.log(`Neto esperado (depósito):   S/ ${totalDepositoEsperado.toFixed(2)}`);
console.log(`DIFERENCIA:                 S/ ${(totalIngresoRegistrado - totalComisionRegistrada - totalDepositoEsperado).toFixed(2)}`);

console.log(`\nComisiones faltantes:       S/ ${(totalComisionML - totalComisionRegistrada).toFixed(2)}`);
console.log(`Envío Flex no registrado:   S/ ${(totalEnvioFlex - totalEnvioRegistrado).toFixed(2)}`);
console.log(`Ajuste Flex manual:         S/ 65.10 (MOV-2026-0088)`);
console.log(`Dif envío: faltante(${(totalEnvioFlex - totalEnvioRegistrado).toFixed(2)}) vs ajuste(65.10) = ${((totalEnvioFlex - totalEnvioRegistrado) - 65.10).toFixed(2)}`);
