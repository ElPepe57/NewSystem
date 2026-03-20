import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

// ============================================================
// 1. VT-2026-062 Missing Commission
// ============================================================
console.log('='.repeat(70));
console.log('1. VT-2026-062 MISSING COMMISSION INVESTIGATION');
console.log('='.repeat(70));

// Find the venta
const ventaSnap = await db.collection('ventas')
  .where('numeroVenta', '==', 'VT-2026-062')
  .limit(1)
  .get();

if (ventaSnap.empty) {
  console.log('ERROR: VT-2026-062 not found');
} else {
  const venta = ventaSnap.docs[0];
  const ventaData = venta.data();
  const ventaId = venta.id;
  console.log(`\nVenta ID: ${ventaId}`);
  console.log(`Numero: ${ventaData.numeroVenta}`);
  console.log(`Total: S/ ${ventaData.total}`);
  console.log(`MercadoLibre ID: ${ventaData.mercadoLibreId || 'N/A'}`);
  console.log(`Pack ID: ${ventaData.packId || 'N/A'}`);
  console.log(`Estado: ${ventaData.estado}`);
  console.log(`Productos: ${(ventaData.productos || []).map(p => `${p.nombre} x${p.cantidad}`).join(', ')}`);

  // Get mlOrderSync docs for this venta
  console.log('\n--- ML Order Sync Docs ---');
  const syncByVenta = await db.collection('mlOrderSync')
    .where('ventaId', '==', ventaId)
    .get();

  let totalComisionExpected = 0;
  if (syncByVenta.empty) {
    console.log('No mlOrderSync docs found by ventaId');
    // Try by mercadoLibreId
    if (ventaData.mercadoLibreId) {
      const syncByMlId = await db.collection('mlOrderSync')
        .where('orderId', '==', Number(ventaData.mercadoLibreId))
        .get();
      if (!syncByMlId.empty) {
        console.log(`Found ${syncByMlId.size} sync doc(s) by mercadoLibreId`);
        syncByMlId.forEach(doc => {
          const d = doc.data();
          console.log(`  Sync ID: ${doc.id}`);
          console.log(`  Comision ML: S/ ${d.comisionML || 0}`);
          console.log(`  Envio: S/ ${d.costoEnvio || 0}`);
          console.log(`  Total Order: S/ ${d.totalOrder || 0}`);
          totalComisionExpected += (d.comisionML || 0);
        });
      }
    }
    // Also try by packId
    if (ventaData.packId) {
      const syncByPack = await db.collection('mlOrderSync')
        .where('packId', '==', ventaData.packId)
        .get();
      if (!syncByPack.empty) {
        console.log(`Found ${syncByPack.size} sync doc(s) by packId`);
        syncByPack.forEach(doc => {
          const d = doc.data();
          console.log(`  Sync ID: ${doc.id}`);
          console.log(`  Comision ML: S/ ${d.comisionML || 0}`);
          totalComisionExpected += (d.comisionML || 0);
        });
      }
    }
  } else {
    syncByVenta.forEach(doc => {
      const d = doc.data();
      console.log(`  Sync ID: ${doc.id}`);
      console.log(`  Order ID: ${d.orderId}`);
      console.log(`  Pack ID: ${d.packId || 'N/A'}`);
      console.log(`  Comision ML: S/ ${d.comisionML || 0}`);
      console.log(`  Envio: S/ ${d.costoEnvio || 0}`);
      console.log(`  Total Order: S/ ${d.totalOrder || 0}`);
      console.log(`  Status: ${d.status}`);
      totalComisionExpected += (d.comisionML || 0);
    });
  }

  // Get ALL gastos for this venta where tipo includes 'comision'
  console.log('\n--- Gastos (comision) for VT-062 ---');
  const gastosSnap = await db.collection('gastos')
    .where('ventaId', '==', ventaId)
    .get();

  const comisionGastos = [];
  gastosSnap.forEach(doc => {
    const d = doc.data();
    const tipo = (d.tipo || '').toLowerCase();
    const descripcion = (d.descripcion || '').toLowerCase();
    if (tipo.includes('comision') || descripcion.includes('comision') || descripcion.includes('comisión')) {
      comisionGastos.push({ id: doc.id, ...d });
    }
  });

  console.log(`Total gastos for venta: ${gastosSnap.size}`);
  console.log(`Comision gastos: ${comisionGastos.length}`);

  let totalComisionGastos = 0;
  comisionGastos.forEach(g => {
    console.log(`  Gasto ID: ${g.id}`);
    console.log(`  Tipo: ${g.tipo}`);
    console.log(`  Descripcion: ${g.descripcion}`);
    console.log(`  Monto: S/ ${g.monto}`);
    console.log(`  Estado: ${g.estado}`);
    totalComisionGastos += (g.monto || 0);
  });

  // Also show ALL gastos for context
  console.log('\n--- ALL Gastos for VT-062 ---');
  gastosSnap.forEach(doc => {
    const d = doc.data();
    console.log(`  ${doc.id}: tipo=${d.tipo}, desc="${d.descripcion}", monto=S/${d.monto}, estado=${d.estado}`);
  });

  // Get movements for comision gastos
  console.log('\n--- Movimientos for comision gastos ---');
  const cuentaMP = 'geEs98tz955mVjYNct8M';
  let totalComisionPaid = 0;

  for (const gasto of comisionGastos) {
    const movSnap = await db.collection('movimientosTesoreria')
      .where('gastoId', '==', gasto.id)
      .get();

    movSnap.forEach(doc => {
      const d = doc.data();
      console.log(`  Mov ${d.numeroMovimiento}: monto=S/${d.monto}, cuentaOrigen=${d.cuentaOrigen}, cuentaDestino=${d.cuentaDestino}`);
      if (d.cuentaOrigen === cuentaMP) {
        totalComisionPaid += (d.monto || 0);
      }
    });
  }

  // Also check movements directly linked to venta
  const movByVenta = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', ventaId)
    .get();

  console.log(`\n--- ALL Movements linked to VT-062 (ventaId) ---`);
  movByVenta.forEach(doc => {
    const d = doc.data();
    console.log(`  ${d.numeroMovimiento}: tipo=${d.tipo}, monto=S/${d.monto}, desc="${d.descripcion}", cuentaOrigen=${d.cuentaOrigen}, cuentaDestino=${d.cuentaDestino}`);
  });

  console.log(`\n--- COMMISSION SUMMARY ---`);
  console.log(`Expected commission (from sync): S/ ${totalComisionExpected.toFixed(2)}`);
  console.log(`Commission in gastos: S/ ${totalComisionGastos.toFixed(2)}`);
  console.log(`Commission paid (movements from MP): S/ ${totalComisionPaid.toFixed(2)}`);
  console.log(`Missing: S/ ${(totalComisionExpected - totalComisionPaid).toFixed(2)}`);
  console.log(`User reported missing: S/ 31.95`);
}

// ============================================================
// 2. MOV-2026-0102 Orphan Investigation
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('2. MOV-2026-0102 ORPHAN INVESTIGATION');
console.log('='.repeat(70));

const movSnap = await db.collection('movimientosTesoreria')
  .where('numeroMovimiento', '==', 'MOV-2026-0102')
  .limit(1)
  .get();

if (movSnap.empty) {
  console.log('ERROR: MOV-2026-0102 not found');
} else {
  const mov = movSnap.docs[0];
  const movData = mov.data();
  console.log(`\nMovement ID: ${mov.id}`);
  console.log(`Numero: ${movData.numeroMovimiento}`);
  console.log(`Tipo: ${movData.tipo}`);
  console.log(`Monto: S/ ${movData.monto}`);
  console.log(`Descripcion: ${movData.descripcion}`);
  console.log(`Cuenta Origen: ${movData.cuentaOrigen}`);
  console.log(`Cuenta Destino: ${movData.cuentaDestino}`);
  console.log(`Venta ID: ${movData.ventaId || 'N/A'}`);
  console.log(`Cotizacion ID: ${movData.cotizacionId || 'N/A'}`);
  console.log(`Gasto ID: ${movData.gastoId || 'N/A'}`);
  console.log(`Fecha: ${movData.fecha?.toDate?.() || movData.fecha}`);

  // Print ALL fields
  console.log('\nAll fields:');
  for (const [k, v] of Object.entries(movData)) {
    if (v && typeof v === 'object' && v.toDate) {
      console.log(`  ${k}: ${v.toDate()}`);
    } else {
      console.log(`  ${k}: ${JSON.stringify(v)}`);
    }
  }

  // Check COT-2026-014
  console.log('\n--- COT-2026-014 Check ---');
  const cotSnap = await db.collection('cotizaciones')
    .where('numeroCotizacion', '==', 'COT-2026-014')
    .limit(1)
    .get();

  if (cotSnap.empty) {
    console.log('COT-2026-014 NOT FOUND in cotizaciones collection');
  } else {
    const cot = cotSnap.docs[0];
    const cotData = cot.data();
    console.log(`COT-2026-014 found! ID: ${cot.id}`);
    console.log(`  Cliente: ${cotData.cliente?.nombre || cotData.clienteNombre || 'N/A'}`);
    console.log(`  Total: S/ ${cotData.total}`);
    console.log(`  Estado: ${cotData.estado}`);
  }

  // Check if COT-2026-014 became a venta
  console.log('\n--- Ventas linked to COT-2026-014 ---');

  // Search by cotizacionId field
  const cotId = cotSnap.empty ? null : cotSnap.docs[0].id;
  if (cotId) {
    const ventasByCot = await db.collection('ventas')
      .where('cotizacionId', '==', cotId)
      .get();

    if (!ventasByCot.empty) {
      ventasByCot.forEach(doc => {
        const d = doc.data();
        console.log(`  Venta ${d.numeroVenta} (ID: ${doc.id})`);
        console.log(`    Total: S/ ${d.total}`);
        console.log(`    Estado: ${d.estado}`);
        console.log(`    Fecha: ${d.fecha?.toDate?.() || d.fecha}`);
      });
    } else {
      console.log('  No ventas found by cotizacionId');
    }
  }

  // Also search by numeroCotizacion reference
  const ventasByCotNum = await db.collection('ventas')
    .where('numeroCotizacion', '==', 'COT-2026-014')
    .get();

  if (!ventasByCotNum.empty) {
    console.log('  Found ventas by numeroCotizacion:');
    ventasByCotNum.forEach(doc => {
      const d = doc.data();
      console.log(`  Venta ${d.numeroVenta} (ID: ${doc.id}), total=S/${d.total}, estado=${d.estado}`);
    });
  }

  // Check if the cotizacion's venta already has its own ingreso movements
  const allLinkedVentaIds = new Set();
  if (cotId) {
    const v1 = await db.collection('ventas').where('cotizacionId', '==', cotId).get();
    v1.forEach(d => allLinkedVentaIds.add(d.id));
  }
  if (!ventasByCotNum.empty) {
    ventasByCotNum.forEach(d => allLinkedVentaIds.add(d.id));
  }

  if (allLinkedVentaIds.size > 0) {
    console.log('\n--- Ingreso movements for linked ventas ---');
    for (const vid of allLinkedVentaIds) {
      const ingresoMov = await db.collection('movimientosTesoreria')
        .where('ventaId', '==', vid)
        .get();

      console.log(`  Venta ${vid} has ${ingresoMov.size} movements:`);
      ingresoMov.forEach(doc => {
        const d = doc.data();
        console.log(`    ${d.numeroMovimiento}: tipo=${d.tipo}, monto=S/${d.monto}, desc="${d.descripcion}"`);
      });
    }
  }

  // Check if S/165.25 was deposited - search all movements with this amount to MP
  console.log('\n--- Other movements with S/165.25 ---');
  const cuentaMP = 'geEs98tz955mVjYNct8M';
  const similarMov = await db.collection('movimientosTesoreria')
    .where('monto', '==', 165.25)
    .get();

  similarMov.forEach(doc => {
    const d = doc.data();
    console.log(`  ${d.numeroMovimiento}: tipo=${d.tipo}, desc="${d.descripcion}", cuentaOrigen=${d.cuentaOrigen}, cuentaDestino=${d.cuentaDestino}`);
  });
}

// ============================================================
// 3. GAP MATH
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('3. GAP MATH ANALYSIS');
console.log('='.repeat(70));

console.log(`\nCurrent gap: S/ 234.49`);
console.log(`\nScenario analysis:`);
console.log(`  If MOV-0102 (S/165.25) is phantom/duplicate:`);
console.log(`    234.49 - 165.25 = S/ 69.24`);
console.log(`  If VT-062 commission S/31.95 is truly missing:`);
console.log(`    69.24 - 31.95 = S/ 37.29`);
console.log(`\n  Remaining gap: ~S/ 37.29`);
console.log(`  Possible explanations for ~S/37:`);
console.log(`    - Another missing commission from a different venta`);
console.log(`    - Rounding across multiple transactions`);
console.log(`    - A small orphan movement or double-counted entry`);
console.log(`    - MP fee adjustment not reflected in system`);

// Let's search for small orphan movements or suspicious entries
console.log('\n--- Searching for other suspicious movements around S/37 ---');
const allMov = await db.collection('movimientosTesoreria')
  .where('monto', '>=', 30)
  .where('monto', '<=', 45)
  .get();

const cuentaMP2 = 'geEs98tz955mVjYNct8M';
allMov.forEach(doc => {
  const d = doc.data();
  if (d.cuentaDestino === cuentaMP2 || d.cuentaOrigen === cuentaMP2) {
    const desc = d.descripcion || '';
    if (desc.toLowerCase().includes('adelanto') || desc.toLowerCase().includes('cotizacion') || desc.toLowerCase().includes('cotización')) {
      console.log(`  ${d.numeroMovimiento}: S/${d.monto} "${desc}" tipo=${d.tipo} origen=${d.cuentaOrigen} destino=${d.cuentaDestino}`);
    }
  }
});

console.log('\n--- Done ---');
process.exit(0);
