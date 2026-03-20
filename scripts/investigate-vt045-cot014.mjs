import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const mpId = 'geEs98tz955mVjYNct8M';

// 1. Find VT-2026-045
const vtSnap = await db.collection('ventas').where('numeroVenta', '==', 'VT-2026-045').get();
console.log('=== 1. VT-2026-045 ===');
if (vtSnap.empty) { console.log('NOT FOUND'); process.exit(1); }
const vtDoc = vtSnap.docs[0];
const vt = vtDoc.data();
console.log('Doc ID:', vtDoc.id);
console.log('numeroVenta:', vt.numeroVenta);
console.log('cliente:', vt.cliente || vt.clienteNombre);
console.log('montoTotal:', vt.montoTotal);
console.log('estadoPago:', vt.estadoPago);
console.log('mercadoLibreId:', vt.mercadoLibreId || 'NONE');
console.log('packId:', vt.packId || 'NONE');
console.log('cotizacionId:', vt.cotizacionId || 'NONE');
console.log('pagos:', JSON.stringify(vt.pagos, null, 2));
console.log('');

// 2. Find COT-2026-014
const cotSnap = await db.collection('cotizaciones').where('numeroCotizacion', '==', 'COT-2026-014').get();
console.log('=== 2. COT-2026-014 ===');
if (cotSnap.empty) { console.log('NOT FOUND'); }
else {
  const cotDoc = cotSnap.docs[0];
  const cot = cotDoc.data();
  console.log('Doc ID:', cotDoc.id);
  console.log('numeroCotizacion:', cot.numeroCotizacion);
  console.log('cliente:', cot.cliente || cot.clienteNombre);
  console.log('montoTotal:', cot.montoTotal);
  console.log('estado:', cot.estado);
  console.log('ventaId:', cot.ventaId || 'NONE');
  console.log('');
}

// 3. ALL movimientosTesoreria where ventaId = VT-045 doc ID
const movByVenta = await db.collection('movimientosTesoreria').where('ventaId', '==', vtDoc.id).get();
console.log('=== 3. Movimientos by ventaId ===');
movByVenta.docs.forEach(d => {
  const m = d.data();
  console.log(`  ${m.numeroMovimiento} | tipo:${m.tipo} | monto:${m.monto} | concepto:${m.concepto}`);
  console.log(`    cuentaOrigen:${m.cuentaOrigen} → cuentaDestino:${m.cuentaDestino}`);
  console.log(`    ventaId:${m.ventaId} | cotizacionId:${m.cotizacionId || 'NONE'}`);
  console.log(`    fecha:${m.fecha?.toDate?.() || m.fecha}`);
  console.log('');
});

// 4. Movimientos where concepto contains COT-2026-014 OR numeroMovimiento = MOV-2026-0102
const movByConcept = await db.collection('movimientosTesoreria').where('numeroMovimiento', '==', 'MOV-2026-0102').get();
console.log('=== 4. MOV-2026-0102 ===');
movByConcept.docs.forEach(d => {
  const m = d.data();
  console.log(`  ${m.numeroMovimiento} | tipo:${m.tipo} | monto:${m.monto} | concepto:${m.concepto}`);
  console.log(`    cuentaOrigen:${m.cuentaOrigen} → cuentaDestino:${m.cuentaDestino}`);
  console.log(`    ventaId:${m.ventaId || 'NONE'} | cotizacionId:${m.cotizacionId || 'NONE'}`);
  console.log(`    fecha:${m.fecha?.toDate?.() || m.fecha}`);
  console.log('');
});

// Also search by concepto containing COT-2026-014 (scan all, firestore can't do contains)
const allMov = await db.collection('movimientosTesoreria').get();
const movWithCot014 = allMov.docs.filter(d => {
  const m = d.data();
  return (m.concepto || '').includes('COT-2026-014');
});
console.log('=== 4b. Movimientos with concepto containing COT-2026-014 ===');
movWithCot014.forEach(d => {
  const m = d.data();
  console.log(`  ${m.numeroMovimiento} | tipo:${m.tipo} | monto:${m.monto} | concepto:${m.concepto}`);
  console.log(`    cuentaOrigen:${m.cuentaOrigen} → cuentaDestino:${m.cuentaDestino}`);
  console.log(`    ventaId:${m.ventaId || 'NONE'} | cotizacionId:${m.cotizacionId || 'NONE'}`);
  console.log('');
});

// 5. Movimientos where cuentaDestino = mpId AND monto = 165.25
const movMP165 = allMov.docs.filter(d => {
  const m = d.data();
  return m.cuentaDestino === mpId && m.monto === 165.25;
});
console.log('=== 5. Movimientos → MP with monto = 165.25 ===');
movMP165.forEach(d => {
  const m = d.data();
  console.log(`  ${m.numeroMovimiento} | tipo:${m.tipo} | monto:${m.monto} | concepto:${m.concepto}`);
  console.log(`    ventaId:${m.ventaId || 'NONE'}`);
  console.log('');
});

// 6. Movimientos where cuentaDestino = mpId AND monto = 7.25
const movMP7 = allMov.docs.filter(d => {
  const m = d.data();
  return m.cuentaDestino === mpId && m.monto === 7.25;
});
console.log('=== 6. Movimientos → MP with monto = 7.25 ===');
movMP7.forEach(d => {
  const m = d.data();
  console.log(`  ${m.numeroMovimiento} | tipo:${m.tipo} | monto:${m.monto} | concepto:${m.concepto}`);
  console.log(`    ventaId:${m.ventaId || 'NONE'}`);
  console.log('');
});

// 7. Overlap analysis
console.log('=== 7. OVERLAP ANALYSIS ===');
const movByVentaIds = new Set(movByVenta.docs.map(d => d.id));
const mov0102Ids = new Set(movByConcept.docs.map(d => d.id));
const overlap = [...movByVentaIds].filter(id => mov0102Ids.has(id));
console.log('movByVenta doc IDs:', [...movByVentaIds]);
console.log('MOV-0102 doc IDs:', [...mov0102Ids]);
console.log('Overlap (same doc):', overlap.length > 0 ? overlap : 'NONE - they are separate movements');
console.log('');

// 8. ALL movements touching MP for this venta/cotizacion
const allMPMov = allMov.docs.filter(d => {
  const m = d.data();
  const touchesMP = m.cuentaOrigen === mpId || m.cuentaDestino === mpId;
  const relatedToVT = m.ventaId === vtDoc.id;
  const relatedToCOT = (m.concepto || '').includes('COT-2026-014') || (m.concepto || '').includes('VT-2026-045');
  return touchesMP && (relatedToVT || relatedToCOT);
});
console.log('=== 8. ALL movements touching MP related to VT-045 / COT-014 ===');
let totalIntoMP = 0;
let totalOutOfMP = 0;
allMPMov.forEach(d => {
  const m = d.data();
  if (m.cuentaDestino === mpId) totalIntoMP += m.monto;
  if (m.cuentaOrigen === mpId) totalOutOfMP += m.monto;
  console.log(`  ${m.numeroMovimiento} | tipo:${m.tipo} | monto:${m.monto}`);
  console.log(`    concepto: ${m.concepto}`);
  console.log(`    ${m.cuentaOrigen} → ${m.cuentaDestino}`);
  console.log(`    direction: ${m.cuentaDestino === mpId ? 'INTO MP' : 'OUT OF MP'}`);
  console.log('');
});
console.log(`Total registered INTO MP: S/${totalIntoMP.toFixed(2)}`);
console.log(`Total registered OUT OF MP: S/${totalOutOfMP.toFixed(2)}`);
console.log('');

// 9. Check mlOrderSync
console.log('=== 9. ML Order Sync ===');
if (vt.mercadoLibreId) {
  const mlSnap = await db.collection('mlOrderSync').doc(vt.mercadoLibreId).get();
  if (mlSnap.exists) {
    const ml = mlSnap.data();
    console.log('mlOrderSync found:', JSON.stringify(ml, null, 2));
  } else {
    console.log('mlOrderSync doc not found for ID:', vt.mercadoLibreId);
  }
  // Also try ml- prefix
  const mlSnap2 = await db.collection('mlOrderSync').doc('ml-' + vt.mercadoLibreId).get();
  if (mlSnap2.exists) {
    console.log('mlOrderSync (ml- prefix) found:', JSON.stringify(mlSnap2.data(), null, 2));
  }
} else {
  console.log('VT-2026-045 has NO mercadoLibreId');
}

// SUMMARY
console.log('\n========== SUMMARY ==========');
console.log(`VT-2026-045 montoTotal: S/${vt.montoTotal}`);
console.log(`Registered INTO MercadoPago: S/${totalIntoMP.toFixed(2)}`);
console.log(`Expected actual MP payment: S/7.25 (based on venta payment history)`);
console.log(`EXCESS inflating MP saldo: S/${(totalIntoMP - 7.25).toFixed(2)}`);
console.log('=============================');

process.exit(0);
