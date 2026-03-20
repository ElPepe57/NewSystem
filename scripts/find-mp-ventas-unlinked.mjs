import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

// Get all mlOrderSync ventaIds
const mlSyncs = await db.collection('mlOrderSync').get();
const syncVentaIds = new Set();
for (const s of mlSyncs.docs) syncVentaIds.add(s.data().ventaId);

// Find ventas with MP payment that are NOT linked to mlOrderSync
const ventas = await db.collection('ventas').get();
const candidates = [];

for (const v of ventas.docs) {
  if (syncVentaIds.has(v.id)) continue;
  const vd = v.data();
  const pagos = vd.pagos || [];
  const tieneMP = pagos.some(p => p.metodoPago === 'mercado_pago');
  if (tieneMP) {
    candidates.push({
      id: v.id,
      num: vd.numeroVenta,
      cliente: vd.clienteNombre || vd.cliente?.nombre || '?',
      totalPEN: vd.totalPEN,
      montoPagado: vd.montoPagado,
      estado: vd.estado,
      estadoPago: vd.estadoPago,
      fecha: vd.fechaCreacion?.toDate?.()?.toISOString?.()?.substring(0, 10),
      canal: vd.canal || '?',
      mercadoLibreId: vd.mercadoLibreId || 'NO',
      costoEnvio: vd.costoEnvio || 0,
    });
  }
}

console.log(`Ventas con pago MP sin vincular a mlOrderSync: ${candidates.length}\n`);
candidates.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
for (const c of candidates) {
  console.log(
    `${c.num} | ${c.fecha || '?'} | ${(c.cliente || '?').substring(0, 30).padEnd(30)} | S/ ${c.totalPEN?.toFixed(2)?.padStart(7)} | envio:${c.costoEnvio} | ${c.canal} | mlId:${c.mercadoLibreId}`
  );
}

// Also check: how many mlOrderSync are pendiente (not yet processed)?
const pendientes = mlSyncs.docs.filter(d => d.data().estado === 'pendiente');
console.log(`\nmlOrderSync pendientes (no procesadas): ${pendientes.length}`);
for (const p of pendientes) {
  const pd = p.data();
  console.log(
    `  ML #${pd.mlOrderId} | ${pd.mlBuyerName || pd.mlBuyerNickname || '?'} | S/ ${pd.totalML} | ${pd.estado} | origen:${pd.origen || '?'} | ${pd.errorDetalle || 'sin error'}`
  );
}

// Also show all mlOrderSync docs ordered by date
console.log(`\nTodos los mlOrderSync (${mlSyncs.size}):`);
const allSyncs = mlSyncs.docs.map(d => ({ id: d.id, ...d.data() }));
allSyncs.sort((a, b) => (a.fechaOrdenML?.seconds || 0) - (b.fechaOrdenML?.seconds || 0));
for (const s of allSyncs) {
  console.log(
    `  ${s.estado?.padEnd(10)} | ML #${s.mlOrderId} | ${(s.mlBuyerName || s.mlBuyerNickname || '?').substring(0, 25).padEnd(25)} | S/ ${s.totalML?.toFixed(2)?.padStart(7)} | ${s.numeroVenta || 'sin venta'} | origen:${s.origen || '?'}`
  );
}
