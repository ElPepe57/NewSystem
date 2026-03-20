import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

// Check VT-2026-078 pattern (has cargo_envio_ml already)
const v78 = await db.collection('ventas').where('numeroVenta', '==', 'VT-2026-078').get();
for (const v of v78.docs) {
  const vd = v.data();
  console.log('=== VT-2026-078 ===');
  console.log('totalPEN:', vd.totalPEN, '| subtotalPEN:', vd.subtotalPEN, '| costoEnvio:', vd.costoEnvio);
  console.log('comisionML:', vd.comisionML, '| cargoEnvioML:', vd.cargoEnvioML);

  const movI = await db.collection('movimientosTesoreria').where('ventaId', '==', v.id).where('tipo', '==', 'ingreso_venta').get();
  for (const m of movI.docs) {
    const md = m.data();
    if (md.estado !== 'anulado' && md.cuentaDestino === mpId)
      console.log('Ingreso MP:', md.monto, '|', (md.concepto || '').substring(0, 80));
  }

  const cargoQ = await db.collection('gastos').where('ventaId', '==', v.id).where('tipo', '==', 'cargo_envio_ml').get();
  for (const g of cargoQ.docs) {
    console.log('Gasto cargo_envio_ml:', g.data().montoPEN);
  }

  const movE = await db.collection('movimientosTesoreria').where('ventaId', '==', v.id).where('cuentaOrigen', '==', mpId).get();
  for (const m of movE.docs) {
    const md = m.data();
    if (md.estado !== 'anulado')
      console.log('Egreso MP:', md.monto, '| tipo:', md.tipo, '|', (md.concepto || '').substring(0, 80));
  }

  const syncQ = await db.collection('mlOrderSync').where('ventaId', '==', v.id).get();
  for (const s of syncQ.docs) {
    const sd = s.data();
    console.log('Sync: totalML:', sd.totalML, '| comision:', sd.comisionML, '| cargoEnvio:', sd.cargoEnvioML, '| costoEnvioCliente:', sd.costoEnvioCliente);
  }
}

// Check VT-2026-054 (non-overlapping: needs cargo but no inflated ingreso)
console.log('\n=== VT-2026-054 ===');
const v54 = await db.collection('ventas').where('numeroVenta', '==', 'VT-2026-054').get();
for (const v of v54.docs) {
  const vd = v.data();
  console.log('totalPEN:', vd.totalPEN, '| subtotalPEN:', vd.subtotalPEN, '| costoEnvio:', vd.costoEnvio);
  console.log('comisionML:', vd.comisionML, '| cargoEnvioML:', vd.cargoEnvioML);

  const movI = await db.collection('movimientosTesoreria').where('ventaId', '==', v.id).where('tipo', '==', 'ingreso_venta').get();
  for (const m of movI.docs) {
    const md = m.data();
    if (md.estado !== 'anulado' && md.cuentaDestino === mpId)
      console.log('Ingreso MP:', md.monto);
  }

  const syncQ = await db.collection('mlOrderSync').where('ventaId', '==', v.id).get();
  for (const s of syncQ.docs) {
    const sd = s.data();
    console.log('Sync: totalML:', sd.totalML, '| cargoEnvio:', sd.cargoEnvioML, '| costoEnvioCliente:', sd.costoEnvioCliente);
  }
}

// Also check VT-2026-061 (overlapping: both inflated AND missing cargo)
console.log('\n=== VT-2026-061 ===');
const v61 = await db.collection('ventas').where('numeroVenta', '==', 'VT-2026-061').get();
for (const v of v61.docs) {
  const vd = v.data();
  console.log('totalPEN:', vd.totalPEN, '| subtotalPEN:', vd.subtotalPEN, '| costoEnvio:', vd.costoEnvio);
  console.log('comisionML:', vd.comisionML, '| cargoEnvioML:', vd.cargoEnvioML);

  const movI = await db.collection('movimientosTesoreria').where('ventaId', '==', v.id).where('tipo', '==', 'ingreso_venta').get();
  for (const m of movI.docs) {
    const md = m.data();
    if (md.estado !== 'anulado' && md.cuentaDestino === mpId)
      console.log('Ingreso MP:', md.monto);
  }

  const syncQ = await db.collection('mlOrderSync').where('ventaId', '==', v.id).get();
  for (const s of syncQ.docs) {
    const sd = s.data();
    console.log('Sync: totalML:', sd.totalML, '| cargoEnvio:', sd.cargoEnvioML, '| costoEnvioCliente:', sd.costoEnvioCliente);
  }
}
