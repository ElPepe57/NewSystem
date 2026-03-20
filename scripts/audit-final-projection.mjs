/**
 * Proyección final: calcula saldo exacto post-fix vs real MP
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';
const SALDO_REAL = 1816.15;

// 1. Calculate current saldo from movements
const movsO = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();
const allMovs = new Map();
for (const m of movsO.docs) allMovs.set(m.id, { doc: m, esOrigen: true, esDestino: false });
for (const m of movsD.docs) {
  if (allMovs.has(m.id)) allMovs.get(m.id).esDestino = true;
  else allMovs.set(m.id, { doc: m, esOrigen: false, esDestino: true });
}

let saldoCalc = 0;
let totalIngresos = 0;
let totalEgresos = 0;
let totalTransfIn = 0;
let totalTransfOut = 0;

for (const [id, { doc, esOrigen, esDestino }] of allMovs) {
  const d = doc.data();
  if (d.estado === 'anulado') continue;
  const monto = d.monto || 0;
  const tipo = d.tipo;
  if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(tipo)) {
    saldoCalc += monto;
    totalIngresos += monto;
  } else if (['gasto_operativo', 'egreso', 'gasto'].includes(tipo)) {
    saldoCalc -= monto;
    totalEgresos += monto;
  } else if (tipo === 'transferencia_interna') {
    if (esOrigen && !esDestino) { saldoCalc -= monto; totalTransfOut += monto; }
    else if (esDestino && !esOrigen) { saldoCalc += monto; totalTransfIn += monto; }
  }
}

console.log('═══ ESTADO ACTUAL ═══');
console.log(`Ingresos:      +S/ ${totalIngresos.toFixed(2)}`);
console.log(`Egresos:       -S/ ${totalEgresos.toFixed(2)}`);
console.log(`Transf IN:     +S/ ${totalTransfIn.toFixed(2)}`);
console.log(`Transf OUT:    -S/ ${totalTransfOut.toFixed(2)}`);
console.log(`Saldo actual:   S/ ${saldoCalc.toFixed(2)}`);

// 2. Simulate fixes
console.log('\n═══ SIMULACIÓN DE FIXES ═══');

// Fix 1: Anular MOV-2026-0088 (S/ 65.10)
let fix1 = 0;
const ajQ = await db.collection('movimientosTesoreria')
  .where('concepto', '>=', 'Ajuste por ingreso')
  .where('concepto', '<=', 'Ajuste por ingreso\uf8ff')
  .get();
for (const m of ajQ.docs) {
  const d = m.data();
  if (d.cuentaDestino === mpId && d.estado !== 'anulado') {
    fix1 += d.monto;
  }
}
console.log(`Fix 1 (anular ajuste Flex):     -S/ ${fix1.toFixed(2)}`);

// Fix 2: Reduce inflated Urbano ingresos
let fix2 = 0;
const mlSyncs = await db.collection('mlOrderSync').where('estado', '==', 'procesada').get();
const syncByVenta = new Map();
for (const s of mlSyncs.docs) {
  const sd = s.data();
  if (!sd.ventaId || sd.metodoEnvio !== 'urbano') continue;
  if (!syncByVenta.has(sd.ventaId) || sd.totalML > syncByVenta.get(sd.ventaId).totalML) {
    syncByVenta.set(sd.ventaId, sd);
  }
}

for (const [ventaId, sync] of syncByVenta) {
  const totalML = sync.totalML || 0;
  const cargoEnvML = sync.cargoEnvioML || 0;
  if (cargoEnvML <= 0) continue;

  const mI = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', ventaId)
    .where('tipo', '==', 'ingreso_venta')
    .get();

  for (const m of mI.docs) {
    const md = m.data();
    if (md.estado === 'anulado' || md.cuentaDestino !== mpId) continue;
    const ingresoActual = md.monto || 0;
    if (ingresoActual > totalML + 0.01) {
      const exceso = ingresoActual - totalML;
      fix2 += exceso;
      console.log(`  Fix2: ${sync.numeroVenta} ingreso ${ingresoActual} → ${totalML} (-${exceso.toFixed(2)})`);
    }
  }
}
console.log(`Fix 2 (reducir ingresos inflados): -S/ ${fix2.toFixed(2)}`);

// Fix 3: Create cargo_envio_ml egresos
let fix3 = 0;
for (const [ventaId, sync] of syncByVenta) {
  const cargoEnvML = sync.cargoEnvioML || 0;
  if (cargoEnvML <= 0) continue;

  const existQ = await db.collection('gastos')
    .where('ventaId', '==', ventaId)
    .where('tipo', '==', 'cargo_envio_ml')
    .limit(1)
    .get();
  if (!existQ.empty) continue;

  const existMov = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', ventaId)
    .where('tipo', '==', 'gasto_operativo')
    .get();
  let yaExisteEnvio = false;
  for (const m of existMov.docs) {
    if (m.data().estado !== 'anulado' && (m.data().concepto || '').includes('Cargo envío')) {
      yaExisteEnvio = true;
      break;
    }
  }
  if (yaExisteEnvio) continue;

  fix3 += cargoEnvML;
  console.log(`  Fix3: ${sync.numeroVenta} crear cargo_envio_ml -S/${cargoEnvML}`);
}
console.log(`Fix 3 (crear egresos cargo_envio):  -S/ ${fix3.toFixed(2)}`);

// Fix 4: VT-2026-062 missing commission
let fix4 = 0;
const existComQ = await db.collection('movimientosTesoreria')
  .where('concepto', '>=', 'Comisión ML - VT-2026-062')
  .where('concepto', '<=', 'Comisión ML - VT-2026-062\uf8ff')
  .get();
let comRegistrada = 0;
for (const m of existComQ.docs) {
  if (m.data().estado !== 'anulado') comRegistrada += m.data().monto || 0;
}
if (comRegistrada < 52 && comRegistrada > 0) {
  fix4 = 52.05 - comRegistrada;
}
console.log(`Fix 4 (comisión VT-2026-062):      -S/ ${fix4.toFixed(2)}`);

const totalFixes = fix1 + fix2 + fix3 + fix4;
const saldoPostFix = saldoCalc - totalFixes;

console.log(`\nTotal fixes:                       -S/ ${totalFixes.toFixed(2)}`);
console.log(`\n═══ PROYECCIÓN ═══`);
console.log(`Saldo post-fix:    S/ ${saldoPostFix.toFixed(2)}`);
console.log(`Saldo real MP:     S/ ${SALDO_REAL.toFixed(2)}`);
console.log(`Residual:          S/ ${(saldoPostFix - SALDO_REAL).toFixed(2)}`);

// 3. Investigate the residual - check ALL ML orders for missing comisions
console.log('\n═══ COMISIONES: REGISTRADAS vs ESPERADAS ═══');
let totalComRegistradas = 0;
let totalComEsperadas = 0;
const comIssues = [];

for (const s of mlSyncs.docs) {
  const sd = s.data();
  if (!sd.ventaId) continue;
  const comEsperada = sd.comisionML || 0;
  totalComEsperadas += comEsperada;

  // Find commission movements for this venta
  const movCom = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', sd.ventaId)
    .where('tipo', '==', 'gasto_operativo')
    .get();

  let comMov = 0;
  for (const m of movCom.docs) {
    const md = m.data();
    if (md.estado !== 'anulado' && md.cuentaOrigen === mpId && (md.concepto || '').includes('omisi')) {
      comMov += md.monto || 0;
    }
  }
  totalComRegistradas += comMov;

  const diff = comEsperada - comMov;
  if (Math.abs(diff) > 0.01) {
    comIssues.push({ num: sd.numeroVenta, esperada: comEsperada, registrada: comMov, diff });
  }
}

console.log(`Total comisiones esperadas (sync): S/ ${totalComEsperadas.toFixed(2)}`);
console.log(`Total comisiones en movimientos:   S/ ${totalComRegistradas.toFixed(2)}`);
console.log(`Diferencia comisiones:             S/ ${(totalComEsperadas - totalComRegistradas).toFixed(2)}`);

if (comIssues.length > 0) {
  console.log('\nVentas con diferencia de comisión:');
  comIssues.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  for (const c of comIssues) {
    console.log(`  ${c.num}: esperada S/${c.esperada.toFixed(2)} | registrada S/${c.comMov?.toFixed(2) || c.registrada.toFixed(2)} | diff S/${c.diff.toFixed(2)}`);
  }
}

// 4. Check for other potential issues
console.log('\n═══ VERIFICACIÓN ADICIONAL ═══');

// Check non-ML ingresos to MP
console.log('\nIngresos NO vinculados a ML sync:');
const mlVentaIds = new Set();
for (const s of mlSyncs.docs) {
  if (s.data().ventaId) mlVentaIds.add(s.data().ventaId);
}

let totalNoML = 0;
for (const [id, { doc, esOrigen, esDestino }] of allMovs) {
  const d = doc.data();
  if (d.estado === 'anulado') continue;
  if (!['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(d.tipo)) continue;
  if (!esDestino) continue;

  if (!mlVentaIds.has(d.ventaId || '')) {
    totalNoML += d.monto || 0;
    console.log(`  ${d.numeroMovimiento} | ${d.tipo} | S/${d.monto} | ${(d.concepto || '').substring(0, 70)}`);
  }
}
console.log(`Total ingresos no-ML: S/ ${totalNoML.toFixed(2)}`);
