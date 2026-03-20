/**
 * Investigar VT-2026-037 (ingreso S/7.25 pero montoPagado S/165.25)
 * y VT-2026-052 (ingreso S/114.45 pero montoPagado S/109)
 * También buscar el origen exacto del drift S/ 191.94
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

// ═══════════════════════════════════════════════
// VT-2026-037 DETALLE COMPLETO
// ═══════════════════════════════════════════════
console.log('══════════════════════════════════════════');
console.log('VT-2026-037 - ANÁLISIS COMPLETO');
console.log('══════════════════════════════════════════\n');

const v37q = await db.collection('ventas').where('numeroVenta', '==', 'VT-2026-037').get();
for (const v of v37q.docs) {
  const vd = v.data();
  console.log(`ID: ${v.id}`);
  console.log(`totalPEN: ${vd.totalPEN} | subtotalPEN: ${vd.subtotalPEN} | costoEnvio: ${vd.costoEnvio}`);
  console.log(`montoPagado: ${vd.montoPagado} | montoPendiente: ${vd.montoPendiente} | estadoPago: ${vd.estadoPago}`);
  console.log(`canal: ${vd.canal} | canalNombre: ${vd.canalNombre}`);
  console.log(`mercadoLibreId: ${vd.mercadoLibreId || 'N/A'}`);
  console.log(`comisionML: ${vd.comisionML || 0} | cargoEnvioML: ${vd.cargoEnvioML || 0}`);
  console.log(`metodoEnvio: ${vd.metodoEnvio || 'N/A'}`);
  console.log('');

  console.log('Pagos:');
  const pagos = vd.pagos || [];
  if (Array.isArray(pagos)) {
    for (const p of pagos) {
      console.log(`  ${p.id} | S/${p.monto} | metodo=${p.metodoPago} | ref=${p.referencia || 'N/A'} | fecha=${p.fecha?.toDate?.()?.toISOString?.()?.substring(0, 16) || '?'}`);
    }
  }

  console.log('\nMovimientos tesorería:');
  const movQ = await db.collection('movimientosTesoreria').where('ventaId', '==', v.id).get();
  for (const m of movQ.docs) {
    const md = m.data();
    console.log(`  ${md.numeroMovimiento} | ${md.tipo} | S/${md.monto} | estado=${md.estado} | cuenta=${md.cuentaDestino || md.cuentaOrigen}`);
    console.log(`    concepto: ${md.concepto}`);
  }

  // Check mlOrderSync
  const syncQ = await db.collection('mlOrderSync').where('ventaId', '==', v.id).get();
  console.log('\nmlOrderSync:');
  for (const s of syncQ.docs) {
    const sd = s.data();
    console.log(`  ${s.id} | ML#${sd.mlOrderId} | totalML=${sd.totalML} | com=${sd.comisionML} | envCli=${sd.costoEnvioCliente || 0} | cargoEnv=${sd.cargoEnvioML || 0} | met=${sd.metodoEnvio}`);
  }
}

// ═══════════════════════════════════════════════
// VT-2026-052 DETALLE COMPLETO
// ═══════════════════════════════════════════════
console.log('\n══════════════════════════════════════════');
console.log('VT-2026-052 - ANÁLISIS COMPLETO');
console.log('══════════════════════════════════════════\n');

const v52q = await db.collection('ventas').where('numeroVenta', '==', 'VT-2026-052').get();
for (const v of v52q.docs) {
  const vd = v.data();
  console.log(`ID: ${v.id}`);
  console.log(`totalPEN: ${vd.totalPEN} | subtotalPEN: ${vd.subtotalPEN} | costoEnvio: ${vd.costoEnvio}`);
  console.log(`montoPagado: ${vd.montoPagado} | montoPendiente: ${vd.montoPendiente} | estadoPago: ${vd.estadoPago}`);
  console.log(`comisionML: ${vd.comisionML || 0} | cargoEnvioML: ${vd.cargoEnvioML || 0} | metodoEnvio: ${vd.metodoEnvio || 'N/A'}`);

  const pagos = vd.pagos || [];
  console.log('Pagos:');
  if (Array.isArray(pagos)) {
    for (const p of pagos) {
      console.log(`  ${p.id} | S/${p.monto} | metodo=${p.metodoPago}`);
    }
  }

  const movQ = await db.collection('movimientosTesoreria').where('ventaId', '==', v.id).get();
  console.log('Movimientos:');
  for (const m of movQ.docs) {
    const md = m.data();
    console.log(`  ${md.numeroMovimiento} | ${md.tipo} | S/${md.monto} | estado=${md.estado} | cuenta=${md.cuentaDestino || md.cuentaOrigen}`);
  }

  const syncQ = await db.collection('mlOrderSync').where('ventaId', '==', v.id).get();
  console.log('mlOrderSync:');
  for (const s of syncQ.docs) {
    const sd = s.data();
    console.log(`  totalML=${sd.totalML} | com=${sd.comisionML} | envCli=${sd.costoEnvioCliente || 0} | met=${sd.metodoEnvio}`);
  }
}

// ═══════════════════════════════════════════════
// TODAS LAS VENTAS: buscar más casos de montoPagado != ingreso MP
// ═══════════════════════════════════════════════
console.log('\n══════════════════════════════════════════');
console.log('TODAS VENTAS PAGADAS: montoPagado vs ingresos MP');
console.log('══════════════════════════════════════════\n');

const ventasPagadas = await db.collection('ventas').where('estadoPago', '==', 'pagado').get();
let totalDriftPagos = 0;
const driftList = [];

for (const v of ventasPagadas.docs) {
  const vd = v.data();
  const pagos = vd.pagos || [];
  if (!Array.isArray(pagos)) continue;

  // Calcular cuánto se pagó VÍA MP (basado en los pagos de la venta)
  let pagoMP = 0;
  for (const p of pagos) {
    if (p.metodoPago === 'mercado_pago' || p.metodoPago === 'mercadopago') {
      pagoMP += p.monto || 0;
    }
  }
  if (pagoMP === 0) continue; // No pagó por MP

  // Cuánto se registró como ingreso en movimientos de MP
  const movQ = await db.collection('movimientosTesoreria').where('ventaId', '==', v.id).get();
  let ingresoMP = 0;
  for (const m of movQ.docs) {
    const md = m.data();
    if (md.estado === 'anulado') continue;
    if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(md.tipo) && md.cuentaDestino === mpId) {
      ingresoMP += md.monto || 0;
    }
  }

  // El drift es: pagoMP (lo que incrementó saldoActual) - ingresoMP (lo que está en movimientos)
  const drift = pagoMP - ingresoMP;
  if (Math.abs(drift) > 0.01) {
    totalDriftPagos += drift;
    driftList.push({
      num: vd.numeroVenta,
      pagoMP,
      ingresoMP,
      drift,
      totalPEN: vd.totalPEN,
    });
  }
}

driftList.sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));
for (const d of driftList) {
  console.log(`${d.num} | pagoMP=S/${d.pagoMP.toFixed(2)} | ingresoMov=S/${d.ingresoMP.toFixed(2)} | DRIFT=${d.drift >= 0 ? '+' : ''}S/${d.drift.toFixed(2)} | totalPEN=${d.totalPEN}`);
}

console.log(`\nTotal drift por pagos (saldo incrementado sin movimiento): S/ ${totalDriftPagos.toFixed(2)}`);
console.log(`Drift total del sistema: S/ 191.94`);
console.log(`Diferencia: S/ ${(191.94 - totalDriftPagos).toFixed(2)}`);
