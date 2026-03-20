import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

const vq = await db.collection('ventas').where('numeroVenta', '==', 'VT-2026-013').get();
for (const v of vq.docs) {
  const vd = v.data();
  console.log('=== VT-2026-013 ===');
  console.log('ID:', v.id);
  console.log('totalPEN:', vd.totalPEN, '| subtotalPEN:', vd.subtotalPEN, '| costoEnvio:', vd.costoEnvio);
  console.log('canal:', vd.canal, '| canalNombre:', vd.canalNombre);
  console.log('montoPagado:', vd.montoPagado, '| estadoPago:', vd.estadoPago);
  console.log('mercadoLibreId:', vd.mercadoLibreId || 'N/A');
  console.log('comisionML:', vd.comisionML || 0, '| cargoEnvioML:', vd.cargoEnvioML || 0);
  console.log('metodoEnvio:', vd.metodoEnvio || 'N/A');

  console.log('\nPagos:');
  const pagos = vd.pagos || [];
  if (Array.isArray(pagos)) {
    for (const p of pagos) {
      console.log('  ', p.id, '| S/', p.monto, '| metodo:', p.metodoPago, '| cuenta:', p.cuentaDestinoId || 'N/A', '| ref:', p.referencia || 'N/A');
    }
  }

  console.log('\nMovimientos tesoreria:');
  const movQ = await db.collection('movimientosTesoreria').where('ventaId', '==', v.id).get();
  for (const m of movQ.docs) {
    const md = m.data();
    console.log('  ', md.numeroMovimiento, '| tipo:', md.tipo, '| S/', md.monto, '| estado:', md.estado);
    console.log('    cuentaDestino:', md.cuentaDestino, '| cuentaOrigen:', md.cuentaOrigen || 'N/A');
    console.log('    concepto:', md.concepto);
  }

  console.log('\nmlOrderSync:');
  const syncQ = await db.collection('mlOrderSync').where('ventaId', '==', v.id).get();
  if (syncQ.empty) console.log('  NINGUNO');
  for (const s of syncQ.docs) {
    const sd = s.data();
    console.log('  ', s.id, '| ML#', sd.mlOrderId, '| totalML:', sd.totalML);
  }

  // Check gastos
  console.log('\nGastos asociados:');
  const gastosQ = await db.collection('gastos').where('ventaId', '==', v.id).get();
  if (gastosQ.empty) console.log('  NINGUNO');
  for (const g of gastosQ.docs) {
    const gd = g.data();
    console.log('  ', gd.numeroGasto, '| tipo:', gd.tipo, '| S/', gd.montoPEN, '| estado:', gd.estado);
  }
}
