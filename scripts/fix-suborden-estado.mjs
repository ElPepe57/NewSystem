import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const ocSnap = await db.collection('ordenesCompra').get();
console.log(`Revisando ${ocSnap.size} OCs...\n`);

for (const d of ocSnap.docs) {
  const oc = d.data();
  const historial = oc.historialPagos || [];
  const subOrdenes = oc.subOrdenes || [];

  console.log(`${oc.numeroOrden}`);
  console.log(`  estado=${oc.estado}  estadoPago=${oc.estadoPago}`);
  console.log(`  historialPagos.length=${historial.length}`);
  subOrdenes.forEach((s, i) => {
    console.log(`  sub[${i}] id=${s.id}  estado=${s.estado}  estadoPago=${s.estadoPago}  totalUSD=${s.totalUSD}`);
  });

  // Recalcular cada sub-orden vs historial real
  const subOrdenesCorregidas = subOrdenes.map(sub => {
    const pagosSub = historial.filter(p => p.subOrdenId === sub.id);
    const totalPagado = pagosSub.reduce((s, p) => s + (p.montoUSD || 0), 0);
    let nuevoEstadoPago;
    if (totalPagado >= sub.totalUSD - 0.01) nuevoEstadoPago = 'pagado';
    else if (totalPagado > 0.01) nuevoEstadoPago = 'parcial';
    else nuevoEstadoPago = 'pendiente';

    if (sub.estadoPago !== nuevoEstadoPago) {
      console.log(`  ⚠ sub[${sub.id}]: ${sub.estadoPago} → ${nuevoEstadoPago}`);
    }
    return {
      ...sub,
      estadoPago: nuevoEstadoPago,
      fechaPago: nuevoEstadoPago === 'pagado' ? sub.fechaPago : null,
    };
  });

  // Si hay cambios, update
  const cambios = subOrdenesCorregidas.some((s, i) => s.estadoPago !== subOrdenes[i].estadoPago);
  if (cambios) {
    const cleanSubs = subOrdenesCorregidas.map(s => {
      const copy = { ...s };
      if (copy.fechaPago === null) delete copy.fechaPago;
      return copy;
    });
    await db.collection('ordenesCompra').doc(d.id).update({ subOrdenes: cleanSubs });
    console.log(`  ✅ sub-órdenes corregidas`);
  }
  console.log('');
}

process.exit(0);
