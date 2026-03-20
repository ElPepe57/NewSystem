/**
 * Verificar exactamente si el movimiento manual VT-2026-056
 * incremento el saldo o no
 * 
 * Y verificar si VT-2026-056 tiene 1 o 2 pagos en el array pagos[]
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

// 1. VT-2026-056 detalle completo
const ventaQ = await db.collection('ventas').where('numeroVenta', '==', 'VT-2026-056').limit(1).get();
if (!ventaQ.empty) {
  const v = ventaQ.docs[0].data();
  console.log('=== VT-2026-056 ===');
  console.log(`totalPEN: ${v.totalPEN}`);
  console.log(`montoPagado: ${v.montoPagado}`);
  console.log(`montoPendiente: ${v.montoPendiente}`);
  console.log(`estadoPago: ${v.estadoPago}`);
  console.log(`pagos (${(v.pagos || []).length}):`);
  for (const p of (v.pagos || [])) {
    console.log(`  id=${p.id} | S/${p.monto} | ${p.metodoPago} | ref=${p.referencia || '?'} | por=${p.registradoPor || '?'}`);
  }
}

// 2. Verificar las ventas ML: que costoEnvioCliente tienen
console.log('\n=== VENTAS ML: costoEnvio vs cargoEnvioML ===');
const mlSyncs = await db.collection('mlOrderSync').where('estado', '==', 'procesada').get();
for (const s of mlSyncs.docs) {
  const sd = s.data();
  const ventaDoc = await db.collection('ventas').doc(sd.ventaId).get();
  if (!ventaDoc.exists) continue;
  const vd = ventaDoc.data();
  console.log(`${sd.numeroVenta} | metodo=${sd.metodoEnvio || '?'} | totalML=${sd.totalML} | costoEnvioCliente=${sd.costoEnvioCliente || 0} | cargoEnvioML=${sd.cargoEnvioML || 0} | venta.totalPEN=${vd.totalPEN} | venta.costoEnvio=${vd.costoEnvio} | venta.subtotalPEN=${vd.subtotalPEN}`);
}

// 3. Verificar: saldo vs movimientos para ANTES de los fix-scripts
// Podemos calcular que efecto tuvieron los fix scripts al saldo
console.log('\n=== MOVIMIENTOS DE FIX SCRIPTS ===');
const fixMovs = await db.collection('movimientosTesoreria').where('creadoPor', '==', 'fix-script').get();
let totalFixEfecto = 0;
for (const m of fixMovs.docs) {
  const d = m.data();
  const efecto = d.tipo === 'gasto_operativo' ? -(d.monto || 0) : (d.monto || 0);
  totalFixEfecto += efecto;
  console.log(`  ${d.numeroMovimiento} | ${d.tipo} | S/ ${d.monto} | efecto=${efecto} | ${d.concepto?.substring(0, 50)}`);
}
console.log(`Total efecto movimientos fix: S/ ${totalFixEfecto.toFixed(2)}`);
