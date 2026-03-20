import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const MP_ACCOUNT_ID = 'geEs98tz955mVjYNct8M';

function printDoc(label, doc) {
  console.log(`\n=== ${label} (ID: ${doc.id}) ===`);
  const data = doc.data();
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && v.toDate) {
      console.log(`  ${k}: ${v.toDate().toISOString()}`);
    } else if (Array.isArray(v)) {
      console.log(`  ${k}: ${JSON.stringify(v, null, 2)}`);
    } else if (v && typeof v === 'object') {
      console.log(`  ${k}: ${JSON.stringify(v, null, 2)}`);
    } else {
      console.log(`  ${k}: ${v}`);
    }
  }
}

function printMov(label, doc) {
  console.log(`\n--- ${label} (ID: ${doc.id}) ---`);
  const d = doc.data();
  const fields = ['numeroMovimiento','tipo','monto','concepto','cuentaOrigen','cuentaOrigenNombre',
    'cuentaDestino','cuentaDestinoNombre','ventaId','cotizacionId','gastoId','estado','fecha',
    'fechaCreacion','moneda','metodoPago','referencia','notas','creadoPor'];
  for (const f of fields) {
    if (d[f] !== undefined) {
      const v = d[f];
      if (v && typeof v === 'object' && v.toDate) {
        console.log(`  ${f}: ${v.toDate().toISOString()}`);
      } else {
        console.log(`  ${f}: ${JSON.stringify(v)}`);
      }
    }
  }
  // Print any remaining fields not in the list
  for (const [k, v] of Object.entries(d)) {
    if (!fields.includes(k)) {
      if (v && typeof v === 'object' && v.toDate) {
        console.log(`  ${k}: ${v.toDate().toISOString()}`);
      } else if (typeof v === 'object') {
        console.log(`  ${k}: ${JSON.stringify(v)}`);
      } else {
        console.log(`  ${k}: ${v}`);
      }
    }
  }
}

try {
  // 1. Find VT-2026-037
  console.log('\n' + '='.repeat(80));
  console.log('1. VENTA VT-2026-037');
  console.log('='.repeat(80));
  const ventaSnap = await db.collection('ventas').where('numeroVenta', '==', 'VT-2026-037').get();
  if (ventaSnap.empty) { console.log('NOT FOUND'); process.exit(1); }
  const ventaDoc = ventaSnap.docs[0];
  const ventaId = ventaDoc.id;
  printDoc('Venta VT-2026-037', ventaDoc);

  // 2. Find COT-2026-014
  console.log('\n' + '='.repeat(80));
  console.log('2. COTIZACION COT-2026-014');
  console.log('='.repeat(80));
  const cotSnap = await db.collection('cotizaciones').where('numeroCotizacion', '==', 'COT-2026-014').get();
  if (cotSnap.empty) { console.log('NOT FOUND'); }
  const cotDoc = cotSnap.empty ? null : cotSnap.docs[0];
  const cotId = cotDoc ? cotDoc.id : null;
  if (cotDoc) printDoc('Cotizacion COT-2026-014', cotDoc);

  // 3a. movimientosTesoreria where ventaId = venta doc ID
  console.log('\n' + '='.repeat(80));
  console.log('3a. MOVIMIENTOS by ventaId = ' + ventaId);
  console.log('='.repeat(80));
  const movByVenta = await db.collection('movimientosTesoreria').where('ventaId', '==', ventaId).get();
  console.log(`Found: ${movByVenta.size} movements`);
  movByVenta.docs.forEach(d => printMov('Mov by ventaId', d));

  // 3b. movimientosTesoreria where cotizacionId = cotizacion doc ID
  if (cotId) {
    console.log('\n' + '='.repeat(80));
    console.log('3b. MOVIMIENTOS by cotizacionId = ' + cotId);
    console.log('='.repeat(80));
    const movByCot = await db.collection('movimientosTesoreria').where('cotizacionId', '==', cotId).get();
    console.log(`Found: ${movByCot.size} movements`);
    movByCot.docs.forEach(d => printMov('Mov by cotizacionId', d));
  }

  // 3c. movimientosTesoreria where concepto contains keywords
  // Firestore doesn't support contains on strings, so we scan all and filter
  console.log('\n' + '='.repeat(80));
  console.log('3c. MOVIMIENTOS by concepto containing COT-2026-014, VT-2026-037, or 037');
  console.log('='.repeat(80));
  const allMovs = await db.collection('movimientosTesoreria').get();
  const matchingConcepto = allMovs.docs.filter(d => {
    const c = (d.data().concepto || '').toLowerCase();
    return c.includes('cot-2026-014') || c.includes('vt-2026-037') || c.includes('037');
  });
  console.log(`Found: ${matchingConcepto.length} movements (scanned ${allMovs.size} total)`);
  matchingConcepto.forEach(d => printMov('Mov by concepto match', d));

  // 3d. MOV-2026-0102
  console.log('\n' + '='.repeat(80));
  console.log('3d. MOV-2026-0102');
  console.log('='.repeat(80));
  const mov0102 = await db.collection('movimientosTesoreria').where('numeroMovimiento', '==', 'MOV-2026-0102').get();
  console.log(`Found: ${mov0102.size}`);
  mov0102.docs.forEach(d => printMov('MOV-2026-0102', d));

  // 3e. MOV-2026-0128
  console.log('\n' + '='.repeat(80));
  console.log('3e. MOV-2026-0128');
  console.log('='.repeat(80));
  const mov0128 = await db.collection('movimientosTesoreria').where('numeroMovimiento', '==', 'MOV-2026-0128').get();
  console.log(`Found: ${mov0128.size}`);
  mov0128.docs.forEach(d => printMov('MOV-2026-0128', d));

  // 4. Gastos where ventaId = venta doc ID
  console.log('\n' + '='.repeat(80));
  console.log('4. GASTOS by ventaId = ' + ventaId);
  console.log('='.repeat(80));
  const gastos = await db.collection('gastos').where('ventaId', '==', ventaId).get();
  console.log(`Found: ${gastos.size} gastos`);
  gastos.docs.forEach(d => printDoc('Gasto', d));

  // 5. Entregas where ventaId = venta doc ID
  console.log('\n' + '='.repeat(80));
  console.log('5. ENTREGAS by ventaId = ' + ventaId);
  console.log('='.repeat(80));
  const entregas = await db.collection('entregas').where('ventaId', '==', ventaId).get();
  console.log(`Found: ${entregas.size} entregas`);
  entregas.docs.forEach(d => printDoc('Entrega', d));

  // 6. mlOrderSync for this venta
  console.log('\n' + '='.repeat(80));
  console.log('6. ML ORDER SYNC');
  console.log('='.repeat(80));
  const mlByVenta = await db.collection('mlOrderSync').where('ventaId', '==', ventaId).get();
  console.log(`By ventaId: ${mlByVenta.size}`);
  mlByVenta.docs.forEach(d => printDoc('mlOrderSync by ventaId', d));

  const ventaData = ventaDoc.data();
  if (ventaData.mercadoLibreId) {
    const mlById = await db.collection('mlOrderSync').where('mercadoLibreId', '==', ventaData.mercadoLibreId).get();
    console.log(`By mercadoLibreId (${ventaData.mercadoLibreId}): ${mlById.size}`);
    mlById.docs.forEach(d => printDoc('mlOrderSync by mercadoLibreId', d));
  }
  if (ventaData.mlOrderId) {
    const mlByOrderId = await db.collection('mlOrderSync').where('orderId', '==', ventaData.mlOrderId).get();
    console.log(`By mlOrderId (${ventaData.mlOrderId}): ${mlByOrderId.size}`);
    mlByOrderId.docs.forEach(d => printDoc('mlOrderSync by orderId', d));
  }

  // 7. Movements where monto = 165.25 AND touches MP account
  console.log('\n' + '='.repeat(80));
  console.log('7. MOVIMIENTOS monto=165.25 touching MP account ' + MP_ACCOUNT_ID);
  console.log('='.repeat(80));
  const mp165orig = await db.collection('movimientosTesoreria').where('monto', '==', 165.25).where('cuentaOrigen', '==', MP_ACCOUNT_ID).get();
  const mp165dest = await db.collection('movimientosTesoreria').where('monto', '==', 165.25).where('cuentaDestino', '==', MP_ACCOUNT_ID).get();
  const seen = new Set();
  const mp165all = [...mp165orig.docs, ...mp165dest.docs].filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; });
  console.log(`Found: ${mp165all.length}`);
  mp165all.forEach(d => printMov('Mov 165.25 MP', d));

  // 8. Movements where monto = 158 AND touches MP account
  console.log('\n' + '='.repeat(80));
  console.log('8. MOVIMIENTOS monto=158 touching MP account ' + MP_ACCOUNT_ID);
  console.log('='.repeat(80));
  const mp158orig = await db.collection('movimientosTesoreria').where('monto', '==', 158).where('cuentaOrigen', '==', MP_ACCOUNT_ID).get();
  const mp158dest = await db.collection('movimientosTesoreria').where('monto', '==', 158).where('cuentaDestino', '==', MP_ACCOUNT_ID).get();
  const seen2 = new Set();
  const mp158all = [...mp158orig.docs, ...mp158dest.docs].filter(d => { if (seen2.has(d.id)) return false; seen2.add(d.id); return true; });
  console.log(`Found: ${mp158all.length}`);
  mp158all.forEach(d => printMov('Mov 158 MP', d));

  // 9. Movements where monto = 7.25 AND ventaId = venta doc ID
  console.log('\n' + '='.repeat(80));
  console.log('9. MOVIMIENTOS monto=7.25 ventaId=' + ventaId);
  console.log('='.repeat(80));
  const mov725 = await db.collection('movimientosTesoreria').where('monto', '==', 7.25).where('ventaId', '==', ventaId).get();
  console.log(`Found: ${mov725.size}`);
  mov725.docs.forEach(d => printMov('Mov 7.25', d));

  console.log('\n' + '='.repeat(80));
  console.log('INVESTIGATION COMPLETE');
  console.log('='.repeat(80));

} catch (err) {
  console.error('Error:', err);
}

process.exit(0);
