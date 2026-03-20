import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

// VT-2026-062 first venta movements
const q = await db.collection('movimientosTesoreria').where('ventaId','==','oT62lh9MR8RWM7dg9DCc').get();
for (const d of q.docs) {
  const md = d.data();
  console.log('MOV 062a:', d.id, '|', md.numeroMovimiento, '|', md.tipo, '| S/', md.monto, '|', (md.concepto||'').substring(0,60));
}

// Check venta 062a
const v = await db.collection('ventas').doc('oT62lh9MR8RWM7dg9DCc').get();
const vd = v.data();
console.log('Venta 062a:', vd.numeroVenta, '| totalPEN:', vd.totalPEN, '| montoPagado:', vd.montoPagado, '| estadoPago:', vd.estadoPago, '| costoEnvio:', vd.costoEnvio, '| metodoEnvio:', vd.metodoEnvio);

// Check VT-2026-056 venta
const v56 = await db.collection('ventas').where('numeroVenta','==','VT-2026-056').get();
for (const d of v56.docs) {
  const vdd = d.data();
  console.log('Venta 056:', d.id, '| totalPEN:', vdd.totalPEN, '| pagos:', vdd.pagos?.length, '| montoPagado:', vdd.montoPagado, '| estadoPago:', vdd.estadoPago);
}

// Full MP saldo audit
const movsO = await db.collection('movimientosTesoreria').where('cuentaOrigen','==',mpId).get();
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino','==',mpId).get();
const all = new Map();
for (const m of movsO.docs) all.set(m.id, {doc:m, esO:true, esD:false});
for (const m of movsD.docs) {
  if(all.has(m.id)) all.get(m.id).esD=true;
  else all.set(m.id, {doc:m, esO:false, esD:true});
}

let totI=0, totE=0;
for (const [id,{doc,esO,esD}] of all) {
  const d = doc.data();
  const monto = d.monto||0;
  const tipo = d.tipo;
  if (['ingreso_venta','ingreso','ingreso_anticipo'].includes(tipo)) totI += monto;
  else if (['gasto_operativo','egreso','gasto'].includes(tipo)) totE += monto;
  else if (tipo==='transferencia_interna') {
    if(esO && !esD) totE+=monto;
    else if(esD && !esO) totI+=monto;
  }
  else if (tipo==='conversion_compra') totE+=monto;
  else if (tipo==='conversion_venta') totI+=monto;
}

const mpData = (await db.collection('cuentasCaja').doc(mpId).get()).data();
const saldoCalc = (mpData.saldoInicial||0) + totI - totE;
console.log('\nSaldo inicial:', mpData.saldoInicial||0);
console.log('Total ingresos:', totI.toFixed(2));
console.log('Total egresos:', totE.toFixed(2));
console.log('Saldo calculado:', saldoCalc.toFixed(2));
console.log('Saldo registrado:', mpData.saldoActual.toFixed(2));
console.log('Diferencia calc vs reg:', (mpData.saldoActual - saldoCalc).toFixed(2));
