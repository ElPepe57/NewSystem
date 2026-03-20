/**
 * Verificacion final: cual es el saldo correcto de MP
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const mpId = 'geEs98tz955mVjYNct8M';

// Verificar VT-2026-056 pagos detallados
console.log('=== VT-2026-056 PAGOS ===');
const pagos056 = await db.collection('pagosVenta').where('ventaNumero', '==', 'VT-2026-056').get();
console.log(`pagosVenta collection: ${pagos056.size} docs`);
for (const p of pagos056.docs) {
  const d = p.data();
  console.log(`  ${p.id} | S/ ${d.montoPEN || d.monto} | ${d.metodoPago} | cuenta=${d.cuentaDestinoId || d.cuentaOrigenId}`);
}

// Verificar que el mov manual haya sido creado por el frontend (incremento saldo)
const movManual = await db.collection('movimientosTesoreria').doc('xNPbEFCS3DGb5gnmvSO9').get();
if (movManual.exists) {
  const d = movManual.data();
  console.log(`\nMov manual: ${d.numeroMovimiento}`);
  console.log(`  tipo: ${d.tipo}`);
  console.log(`  monto: S/ ${d.monto}`);
  console.log(`  creadoPor: ${d.creadoPor}`);
  console.log(`  concepto: ${d.concepto}`);
  console.log(`  fecha: ${d.fecha?.toDate?.()?.toISOString()}`);
  console.log(`  ventaId: ${d.ventaId}`);
  console.log(`  ventaNumero: ${d.ventaNumero}`);
  console.log(`  pagoId: ${d.pagoId}`);
}

// Verificar VT-2026-054 que fue "reparado"
console.log('\n\n=== VT-2026-054 (reparado) ===');
const movs054 = await db.collection('movimientosTesoreria').where('ventaNumero', '==', 'VT-2026-054').get();
for (const m of movs054.docs) {
  const d = m.data();
  console.log(`  ${m.id} | ${d.numeroMovimiento} | ${d.tipo} | S/ ${d.monto} | ${d.concepto?.substring(0, 60)}`);
}

// Verificar VT-2026-057 que fue "reparado"
console.log('\n\n=== VT-2026-057 (reparado) ===');
const movs057 = await db.collection('movimientosTesoreria').where('ventaNumero', '==', 'VT-2026-057').get();
for (const m of movs057.docs) {
  const d = m.data();
  console.log(`  ${m.id} | ${d.numeroMovimiento} | ${d.tipo} | S/ ${d.monto} | ${d.concepto?.substring(0, 60)}`);
}

// Check all ventas pagadas con MP to sum what should have entered
console.log('\n\n=== SALDO ESPERADO (desde pagos de ventas) ===');
const allPagos = await db.collection('pagosVenta').where('cuentaDestinoId', '==', mpId).get();
let totalPagosVenta = 0;
for (const p of allPagos.docs) {
  const d = p.data();
  totalPagosVenta += d.montoPEN || d.monto || 0;
}
console.log(`Total pagos a MP (pagosVenta): S/ ${totalPagosVenta.toFixed(2)} (${allPagos.size} pagos)`);

// Also check pagos where metodoPago is mercado_pago but cuentaDestinoId might be different
const allPagosMP = await db.collection('pagosVenta').where('metodoPago', '==', 'mercado_pago').get();
let totalPagosMP = 0;
for (const p of allPagosMP.docs) {
  const d = p.data();
  totalPagosMP += d.montoPEN || d.monto || 0;
}
console.log(`Total pagos MP (metodoPago): S/ ${totalPagosMP.toFixed(2)} (${allPagosMP.size} pagos)`);
