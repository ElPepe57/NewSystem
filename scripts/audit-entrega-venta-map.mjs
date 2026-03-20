/**
 * Mapear cada entrega → venta para ver si los delivery egresos desde MP
 * ya cubren el cargo_envio_ml de las órdenes Urbano
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

// Get ALL delivery movements from MP
const movsO = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();
const deliveryMovs = [];
for (const m of movsO.docs) {
  const d = m.data();
  if (d.estado === 'anulado') continue;
  const concepto = (d.concepto || '').toLowerCase();
  if (concepto.includes('entrega') || concepto.includes('delivery') || concepto.includes('nv')) {
    // Get the gastoId or gastoNumero to find the entrega
    deliveryMovs.push({
      movId: m.id,
      movNum: d.numeroMovimiento,
      monto: d.monto,
      concepto: d.concepto,
      gastoId: d.gastoId,
      gastoNumero: d.gastoNumero,
      ventaId: d.ventaId || null,
    });
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('MAPEO: DELIVERY EGRESOS MP → VENTA');
console.log('═══════════════════════════════════════════════════════════════\n');

// For each delivery movement, find which venta it belongs to
const ventaDeliveryMap = {};

for (const mov of deliveryMovs) {
  let ventaNum = 'N/A';
  let ventaId = mov.ventaId;

  // Try to find via gastoId → entrega
  if (mov.gastoId) {
    const entregaQ = await db.collection('entregas').where('gastoEnvioId', '==', mov.gastoId).limit(1).get();
    if (!entregaQ.empty) {
      const ed = entregaQ.docs[0].data();
      ventaId = ed.ventaId;
    }
  }

  // Try to find via gastoNumero
  if (!ventaId && mov.gastoNumero) {
    const gastoQ = await db.collection('gastos').where('numeroGasto', '==', mov.gastoNumero).limit(1).get();
    if (!gastoQ.empty) {
      const gd = gastoQ.data ? gastoQ.data() : gastoQ.docs[0].data();
      ventaId = gd.ventaId || gastoQ.docs[0].data().ventaId;
    }
  }

  // Get venta number
  if (ventaId) {
    const vDoc = await db.collection('ventas').doc(ventaId).get();
    if (vDoc.exists) {
      ventaNum = vDoc.data().numeroVenta;
    }
  }

  if (!ventaDeliveryMap[ventaNum]) ventaDeliveryMap[ventaNum] = [];
  ventaDeliveryMap[ventaNum].push(mov);

  console.log(`${mov.movNum} | S/${mov.monto} | ${ventaNum} | ${(mov.concepto || '').substring(0, 70)}`);
}

// Now check overlap with Fix 3 ventas
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('COMPARACIÓN: Fix 3 vs Delivery existentes');
console.log('═══════════════════════════════════════════════════════════════\n');

const fix3Ventas = ['VT-2026-054','VT-2026-057','VT-2026-061','VT-2026-066','VT-2026-067','VT-2026-068','VT-2026-073','VT-2026-075','VT-2026-077','VT-2026-056'];
const cargoAmounts = {
  'VT-2026-054': 6.95, 'VT-2026-057': 4.17, 'VT-2026-061': 4.17,
  'VT-2026-066': 8.34, 'VT-2026-067': 6.95, 'VT-2026-068': 7.45,
  'VT-2026-073': 6.95, 'VT-2026-075': 13.90, 'VT-2026-077': 7.45,
  'VT-2026-056': 4.17,
};

let overlapTotal = 0;
let noOverlapTotal = 0;

for (const vn of fix3Ventas) {
  const cargo = cargoAmounts[vn] || 0;
  const deliveries = ventaDeliveryMap[vn] || [];
  const deliveryTotal = deliveries.reduce((s, d) => s + d.monto, 0);

  if (deliveryTotal > 0) {
    console.log(`⚠ ${vn}: cargoEnvioML=S/${cargo} | delivery MP existente=S/${deliveryTotal} | DOBLE CONTEO`);
    overlapTotal += cargo;
  } else {
    console.log(`✓ ${vn}: cargoEnvioML=S/${cargo} | sin delivery MP | Fix 3 OK`);
    noOverlapTotal += cargo;
  }
}

// Also check pendiente Urbano
const pendienteUrbano = {
  'VT-2026-016': 6.95, 'VT-2026-017': 7.45, 'VT-2026-021': 4.17, 'VT-2026-025': 4.17,
};
console.log('\n── Pendiente Urbano (no en Fix 3 actual) ──');
let pendienteOverlap = 0;
let pendienteNoOverlap = 0;
for (const [vn, cargo] of Object.entries(pendienteUrbano)) {
  const deliveries = ventaDeliveryMap[vn] || [];
  const deliveryTotal = deliveries.reduce((s, d) => s + d.monto, 0);
  if (deliveryTotal > 0) {
    console.log(`⚠ ${vn}: cargoEnvioML=S/${cargo} | delivery MP=S/${deliveryTotal} | YA CUBIERTO`);
    pendienteOverlap += cargo;
  } else {
    console.log(`✓ ${vn}: cargoEnvioML=S/${cargo} | sin delivery | FALTANTE`);
    pendienteNoOverlap += cargo;
  }
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('IMPACTO EN RECONCILIACIÓN');
console.log('═══════════════════════════════════════════════════════════════\n');
console.log(`Fix 3 con doble conteo:     S/ ${overlapTotal.toFixed(2)} (no aplicar)`);
console.log(`Fix 3 sin doble conteo:     S/ ${noOverlapTotal.toFixed(2)} (sí aplicar)`);
console.log(`Pendiente con doble:        S/ ${pendienteOverlap.toFixed(2)} (ya cubierto)`);
console.log(`Pendiente sin doble:        S/ ${pendienteNoOverlap.toFixed(2)} (faltante)`);

const saldo = 2137.65;
const fix1 = 65.10;
const fix2 = 55.21;
const fix3Corr = noOverlapTotal;
const fix4 = 31.95;
const fix6 = pendienteNoOverlap;

const total = fix1 + fix2 + fix3Corr + fix4 + fix6;
const postFix = saldo - total;
console.log(`\nFix 1: -S/${fix1} | Fix 2: -S/${fix2} | Fix 3 corr: -S/${fix3Corr.toFixed(2)} | Fix 4: -S/${fix4} | Pendiente: -S/${fix6.toFixed(2)}`);
console.log(`Total corrección: -S/ ${total.toFixed(2)}`);
console.log(`Post-fix: S/ ${postFix.toFixed(2)}`);
console.log(`Real: S/ 1816.15`);
console.log(`Residual: S/ ${(postFix - 1816.15).toFixed(2)}`);
