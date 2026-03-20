/**
 * Cleanup all test ML order data from Firestore.
 * Deletes: mlOrderSync, ventas, clientes, gastos, movimientosTesoreria
 * Restores: unidades to disponible_peru, MercadoPago balance, product stock
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const TEST_BUYERS = [
  'Juan Carlos Test Comprador',
  'Ana Lucía Fernández',
  'Roberto Sánchez Medina',
  'Carmen Rosa Díaz',
  'Diego Alejandro Torres',
  'Patricia Huamán Quispe',
];

async function main() {
  console.log('Buscando datos de test para eliminar...\n');

  // 1. Find test mlOrderSync docs
  const ordersSnap = await db.collection('mlOrderSync').get();
  const testOrders = ordersSnap.docs.filter(d => TEST_BUYERS.includes(d.data().mlBuyerName));
  console.log('mlOrderSync test docs:', testOrders.length);

  // Collect linked IDs
  const ventaIds = testOrders.map(d => d.data().ventaId).filter(Boolean);
  const clienteIds = [...new Set(testOrders.map(d => d.data().clienteId).filter(Boolean))];
  console.log('ventaIds:', ventaIds.length);
  console.log('clienteIds:', clienteIds.length);

  // 2. Find gastos and movimientos
  const gastoIds = [];
  const movIds = [];
  for (const vid of ventaIds) {
    const gastos = await db.collection('gastos').where('ventaId', '==', vid).get();
    gastoIds.push(...gastos.docs.map(d => d.id));
    const movs = await db.collection('movimientosTesoreria').where('ventaId', '==', vid).get();
    movIds.push(...movs.docs.map(d => d.id));
  }
  console.log('gastos:', gastoIds.length);
  console.log('movimientos:', movIds.length);

  // 3. Find reserved units
  const unitIds = [];
  for (const vid of ventaIds) {
    const units = await db.collection('unidades').where('reservadaPara', '==', vid).get();
    unitIds.push(...units.docs.map(d => d.id));
  }
  console.log('unidades reservadas:', unitIds.length);

  // 4. Calculate balance adjustment
  let balanceAdjust = 0;
  for (const doc of testOrders) {
    const d = doc.data();
    if (d.ventaId) {
      const subtotal = (d.productos || []).reduce((sum, p) => sum + p.precioUnitario * p.cantidad, 0);
      const totalPEN = subtotal + (d.costoEnvioCliente || 0);
      balanceAdjust -= totalPEN;          // reverse ingreso
      balanceAdjust += d.comisionML || 0; // reverse egreso
    }
  }

  const total = testOrders.length + ventaIds.length + clienteIds.length + gastoIds.length + movIds.length;
  console.log(`\nTotal: ${total} docs to delete, ${unitIds.length} units to restore, balance adjust: S/ ${balanceAdjust.toFixed(2)}`);

  // 5. Delete everything
  // mlOrderSync
  for (const doc of testOrders) {
    await doc.ref.delete();
  }
  console.log('\n✅ Deleted', testOrders.length, 'mlOrderSync');

  // ventas
  for (const vid of ventaIds) {
    await db.collection('ventas').doc(vid).delete();
  }
  console.log('✅ Deleted', ventaIds.length, 'ventas');

  // clientes
  for (const cid of clienteIds) {
    await db.collection('clientes').doc(cid).delete();
  }
  console.log('✅ Deleted', clienteIds.length, 'clientes');

  // gastos
  for (const gid of gastoIds) {
    await db.collection('gastos').doc(gid).delete();
  }
  console.log('✅ Deleted', gastoIds.length, 'gastos');

  // movimientos
  for (const mid of movIds) {
    await db.collection('movimientosTesoreria').doc(mid).delete();
  }
  console.log('✅ Deleted', movIds.length, 'movimientos tesorería');

  // 6. Restore units
  for (const uid of unitIds) {
    await db.collection('unidades').doc(uid).update({
      estado: 'disponible_peru',
      reservadaPara: null,
      fechaReserva: null,
    });
  }
  console.log('✅ Restored', unitIds.length, 'unidades → disponible_peru');

  // 7. Adjust MercadoPago balance
  if (balanceAdjust !== 0) {
    await db.collection('cuentasCaja').doc('geEs98tz955mVjYNct8M').update({
      saldoActual: FieldValue.increment(balanceAdjust),
    });
    console.log('✅ Adjusted MercadoPago balance by S/', balanceAdjust.toFixed(2));
  }

  const cuentaFinal = await db.collection('cuentasCaja').doc('geEs98tz955mVjYNct8M').get();
  console.log('   Saldo final: S/', cuentaFinal.data().saldoActual.toFixed(2));

  // 8. Sync product stock
  const prodIds = [...new Set(testOrders.flatMap(d => (d.data().productos || []).map(p => p.productoId).filter(Boolean)))];
  for (const pid of prodIds) {
    const dispSnap = await db.collection('unidades').where('productoId', '==', pid).where('estado', '==', 'disponible_peru').get();
    await db.collection('productos').doc(pid).update({ stockDisponible: dispSnap.size });
    console.log('✅ Stock sync:', pid, '→', dispSnap.size, 'disponible');
  }

  console.log('\n🧹 Limpieza completa!');
  process.exit(0);
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
