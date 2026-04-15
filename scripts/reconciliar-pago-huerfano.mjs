/**
 * Detecta pagos de OC en historialPagos que NO tienen su movimiento correspondiente
 * en tesoreria (huérfanos por el bug de registrar-pago).
 *
 * Para cada pago huérfano:
 *   1. Lista el pago con sus datos
 *   2. Pregunta qué hacer: (a) crear movimiento, (b) borrar pago, (c) dejar como está
 *
 * Uso:
 *   node scripts/reconciliar-pago-huerfano.mjs             # Solo lista
 *   node scripts/reconciliar-pago-huerfano.mjs --delete    # Borra los pagos huérfanos
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const deleteMode = process.argv.includes('--delete');

const ocSnap = await db.collection('ordenesCompra').get();
console.log(`Revisando ${ocSnap.size} OCs...\n`);

const huerfanos = [];
for (const d of ocSnap.docs) {
  const oc = d.data();
  const historial = oc.historialPagos || [];
  for (const pago of historial) {
    // Buscar movimiento de tesorería vinculado
    const movsSnap = await db.collection('movimientosTesoreria')
      .where('ordenCompraId', '==', d.id)
      .where('tipo', '==', 'pago_orden_compra')
      .get();
    const tieneMovimiento = movsSnap.docs.some(m => {
      const data = m.data();
      return Math.abs((data.monto || 0) - (pago.montoOriginal || 0)) < 0.01
        && data.moneda === pago.monedaPago;
    });
    if (!tieneMovimiento) {
      huerfanos.push({ ocId: d.id, ocNumero: oc.numeroOrden, pago, ocData: oc });
    }
  }
}

if (huerfanos.length === 0) {
  console.log('✅ No hay pagos huérfanos. Todo concuerda.');
  process.exit(0);
}

console.log(`⚠ Pagos huérfanos encontrados: ${huerfanos.length}\n`);
for (const h of huerfanos) {
  console.log(`  ${h.ocNumero}`);
  console.log(`    pagoId: ${h.pago.id}`);
  console.log(`    fecha: ${h.pago.fecha?.toDate?.().toISOString?.() || '-'}`);
  console.log(`    monto: ${h.pago.monedaPago} ${h.pago.montoOriginal} (= USD ${h.pago.montoUSD}, PEN ${h.pago.montoPEN})`);
  console.log(`    método: ${h.pago.metodoPago}`);
  console.log(`    cuenta: ${h.pago.cuentaOrigenNombre || h.pago.cuentaOrigenId || '-'}`);
  console.log(`    subOrdenId: ${h.pago.subOrdenId || '(OC completa)'}`);
  console.log('');
}

if (!deleteMode) {
  console.log('\nPara eliminar los pagos huérfanos de historialPagos:');
  console.log('   node scripts/reconciliar-pago-huerfano.mjs --delete');
  console.log('\nEsto NO crea movimientos — sólo limpia. Después puedes volver a registrar');
  console.log('el pago desde la UI (que ahora sí llegará correctamente a Tesorería).');
  process.exit(0);
}

// Modo delete
console.log('✍️  Eliminando pagos huérfanos de historialPagos...\n');
const batch = db.batch();
const actualizadas = new Map();
for (const h of huerfanos) {
  if (!actualizadas.has(h.ocId)) actualizadas.set(h.ocId, { ...h.ocData });
  const oc = actualizadas.get(h.ocId);
  oc.historialPagos = (oc.historialPagos || []).filter(p => p.id !== h.pago.id);
}
for (const [ocId, ocData] of actualizadas) {
  const nuevosHistorial = ocData.historialPagos;
  const totalPagado = nuevosHistorial.reduce((s, p) => s + p.montoUSD, 0);
  const pendiente = ocData.totalUSD - totalPagado;
  const tieneSub = (ocData.subOrdenes || []).length > 0;

  // Recalcular estadoPago de cada sub-orden vs historialPagos real
  let nuevasSubs = ocData.subOrdenes;
  if (tieneSub) {
    nuevasSubs = ocData.subOrdenes.map(sub => {
      const pagosSub = nuevosHistorial.filter(p => p.subOrdenId === sub.id);
      const pagadoSub = pagosSub.reduce((s, p) => s + (p.montoUSD || 0), 0);
      let estadoPagoSub;
      if (pagadoSub >= sub.totalUSD - 0.01) estadoPagoSub = 'pagado';
      else if (pagadoSub > 0.01) estadoPagoSub = 'parcial';
      else estadoPagoSub = 'pendiente';
      const copy = { ...sub, estadoPago: estadoPagoSub };
      if (estadoPagoSub !== 'pagado') delete copy.fechaPago;
      return copy;
    });
  }

  // Derivar estadoPago de la OC desde sub-órdenes (con sub-órdenes) o total (sin)
  let nuevoEstado;
  if (tieneSub) {
    const todasPagadas = nuevasSubs.every(s => s.estadoPago === 'pagado');
    const algunaConPago = nuevasSubs.some(s => s.estadoPago === 'pagado' || s.estadoPago === 'parcial');
    nuevoEstado = todasPagadas ? 'pagado' : (algunaConPago ? 'parcial' : 'pendiente');
  } else {
    nuevoEstado = pendiente <= 0.01 ? 'pagado' : (totalPagado > 0.01 ? 'parcial' : 'pendiente');
  }

  const updates = {
    historialPagos: nuevosHistorial,
    estadoPago: nuevoEstado,
    montoPendiente: Math.max(0, pendiente * (ocData.tcPago || 1)),
  };
  if (tieneSub) updates.subOrdenes = nuevasSubs;

  batch.update(db.collection('ordenesCompra').doc(ocId), updates);
  console.log(`  ✓ ${ocData.numeroOrden}: removidos ${huerfanos.filter(h => h.ocId === ocId).length} pagos huérfanos, estadoPago=${nuevoEstado}${tieneSub ? ` (+ ${nuevasSubs.length} sub-órdenes recalculadas)` : ''}`);
}
await batch.commit();
console.log(`\n✅ ${huerfanos.length} pagos huérfanos eliminados.`);
process.exit(0);
