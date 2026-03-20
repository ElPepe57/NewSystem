/**
 * FORENSIC LAYER 2: Every single SOL that exits MercadoPago
 * Traces all egresos from MP account, categorizes, and cross-references with gastos + mlOrderSync
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const mpId = 'geEs98tz955mVjYNct8M';

// ──────────────────────────────────────────────────────────────
// 1. Get ALL egreso movements from MP (cuentaOrigen = mpId)
// ──────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════');
console.log('  FORENSIC LAYER 2: EVERY SOL THAT EXITS MERCADOPAGO');
console.log('═══════════════════════════════════════════════════════════════\n');

const movsSnap = await db.collection('movimientosTesoreria')
  .where('cuentaOrigen', '==', mpId)
  .get();

// Filter out anulados
const allMovs = movsSnap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(m => m.estado !== 'anulado');

// Sort by fecha ascending
allMovs.sort((a, b) => {
  const fa = a.fecha?.toDate?.() || new Date(0);
  const fb = b.fecha?.toDate?.() || new Date(0);
  return fa - fb;
});

console.log(`Total egreso movements (excl. anulados): ${allMovs.length}\n`);

// ──────────────────────────────────────────────────────────────
// 2. Batch-load all referenced gastos
// ──────────────────────────────────────────────────────────────
const gastoIds = [...new Set(allMovs.filter(m => m.gastoId).map(m => m.gastoId))];
const gastoMap = new Map();
for (let i = 0; i < gastoIds.length; i += 10) {
  const batch = gastoIds.slice(i, i + 10);
  const snaps = await Promise.all(batch.map(id => db.collection('gastos').doc(id).get()));
  for (const snap of snaps) {
    if (snap.exists) gastoMap.set(snap.id, { id: snap.id, ...snap.data() });
  }
}
console.log(`Gastos loaded: ${gastoMap.size} / ${gastoIds.length} referenced\n`);

// ──────────────────────────────────────────────────────────────
// 3. Load ALL mlOrderSync docs (for cross-reference)
// ──────────────────────────────────────────────────────────────
const mlSyncSnap = await db.collection('mlOrderSync').get();
const mlSyncMap = new Map(); // by ventaId
const mlSyncById = new Map(); // by doc id
for (const d of mlSyncSnap.docs) {
  const data = { id: d.id, ...d.data() };
  mlSyncById.set(d.id, data);
  if (data.ventaId) {
    mlSyncMap.set(data.ventaId, data);
  }
}
console.log(`mlOrderSync docs loaded: ${mlSyncSnap.size}\n`);

// ──────────────────────────────────────────────────────────────
// 4. Categorize each egreso
// ──────────────────────────────────────────────────────────────
const categories = {
  comision_ml: [],
  cargo_envio_ml: [],
  delivery: [],
  transferencia_interna: [],
  other_gasto: [],
  unlinked: [],
};

const comisionDiscrepancies = [];
const comisionMatches = [];

console.log('────────────────────────────────────────────────────────────');
console.log('  DETAILED EGRESO LOG');
console.log('────────────────────────────────────────────────────────────');

for (const mov of allMovs) {
  const fecha = mov.fecha?.toDate?.()?.toISOString?.()?.slice(0, 10) || '???';
  const monto = mov.monto || 0;
  const line = `${mov.numeroMovimiento || mov.id}  ${fecha}  S/ ${monto.toFixed(2).padStart(9)}  tipo=${mov.tipo || '?'}  concepto="${mov.concepto || ''}"  ventaId=${mov.ventaId || '-'}  gastoId=${mov.gastoId || '-'}  gastoNum=${mov.gastoNumero || '-'}`;
  console.log(line);

  if (mov.tipo === 'transferencia_interna') {
    categories.transferencia_interna.push(mov);
    continue;
  }

  if (mov.gastoId) {
    const gasto = gastoMap.get(mov.gastoId);
    if (!gasto) {
      console.log(`  ⚠ GASTO NOT FOUND in DB: ${mov.gastoId}`);
      categories.unlinked.push(mov);
      continue;
    }

    const gastoTipo = gasto.tipo || '?';
    const gastoMonto = gasto.monto || 0;
    const gastoVentaId = gasto.ventaId || '-';
    const gastoEstado = gasto.estado || '?';
    console.log(`  → gasto: tipo=${gastoTipo} monto=S/${gastoMonto.toFixed(2)} ventaId=${gastoVentaId} estado=${gastoEstado}`);

    if (gastoTipo === 'comision_ml') {
      categories.comision_ml.push({ mov, gasto });

      // Cross-reference with mlOrderSync
      const ventaId = gasto.ventaId || mov.ventaId;
      if (ventaId) {
        const mlSync = mlSyncMap.get(ventaId);
        if (mlSync) {
          const diff = Math.abs(gastoMonto - mlSync.comisionML);
          if (diff < 0.02) {
            comisionMatches.push({ mov, gasto, mlSync, diff });
            console.log(`  ✓ MATCH mlOrderSync comisionML: S/${mlSync.comisionML.toFixed(2)} (diff=${diff.toFixed(2)})`);
          } else {
            comisionDiscrepancies.push({ mov, gasto, mlSync, diff, gastoMonto, mlComision: mlSync.comisionML });
            console.log(`  ✗ DISCREPANCY! gasto=${gastoMonto.toFixed(2)} vs mlSync.comisionML=${mlSync.comisionML.toFixed(2)} diff=${diff.toFixed(2)}`);
          }
        } else {
          console.log(`  ? No mlOrderSync found for ventaId=${ventaId}`);
        }
      }
    } else if (gastoTipo === 'cargo_envio_ml' || (gastoTipo === 'delivery' && gasto.concepto?.toLowerCase?.().includes?.('cargo'))) {
      // cargo_envio_ml type or delivery that is actually cargo envio
      categories.cargo_envio_ml.push({ mov, gasto });

      // Verify against mlOrderSync
      const ventaId = gasto.ventaId || mov.ventaId;
      if (ventaId) {
        const mlSync = mlSyncMap.get(ventaId);
        if (mlSync && mlSync.cargoEnvioML != null) {
          console.log(`  → cargoEnvioML in mlSync: S/${mlSync.cargoEnvioML.toFixed(2)} vs gasto: S/${gastoMonto.toFixed(2)}`);
        }
      }
    } else if (gastoTipo === 'delivery') {
      categories.delivery.push({ mov, gasto });

      // Check if Flex or Urbano
      const ventaId = gasto.ventaId || mov.ventaId;
      if (ventaId) {
        const mlSync = mlSyncMap.get(ventaId);
        if (mlSync) {
          const metodo = mlSync.metodoEnvio || mlSync.trackingMethod || '?';
          console.log(`  → delivery for ${metodo} order. cargoEnvioML=${mlSync.cargoEnvioML ?? 'N/A'}`);
          if (metodo === 'urbano' && mlSync.cargoEnvioML != null) {
            const diff = Math.abs(gastoMonto - mlSync.cargoEnvioML);
            if (diff < 1) {
              console.log(`  → Urbano delivery ≈ cargoEnvioML (diff=${diff.toFixed(2)}) — delivery IS the cargo envio`);
            }
          }
        }
      }
    } else {
      categories.other_gasto.push({ mov, gasto });
    }
  } else {
    // No gastoId and not transfer
    categories.unlinked.push(mov);
    console.log(`  ⚠ UNLINKED EGRESO — no gastoId, not transfer`);
  }
}

// ──────────────────────────────────────────────────────────────
// 5. Find MISSING comisiones: ventas with mlOrderSync but no comision movement
// ──────────────────────────────────────────────────────────────
console.log('\n────────────────────────────────────────────────────────────');
console.log('  MISSING COMISIONES ANALYSIS');
console.log('────────────────────────────────────────────────────────────');

// Build set of ventaIds that already have comision egresos
const ventasWithComision = new Set();
for (const { gasto } of categories.comision_ml) {
  if (gasto.ventaId) ventasWithComision.add(gasto.ventaId);
}

const missingComisiones = [];
for (const [ventaId, mlSync] of mlSyncMap.entries()) {
  if (mlSync.estado === 'ignorada') continue;
  if (mlSync.comisionML <= 0) continue;
  if (ventasWithComision.has(ventaId)) continue;
  missingComisiones.push({ ventaId, mlSync });
}

console.log(`\nVentas with mlOrderSync + comisionML > 0: ${[...mlSyncMap.values()].filter(s => s.comisionML > 0 && s.estado !== 'ignorada').length}`);
console.log(`Ventas WITH comision egreso from MP: ${ventasWithComision.size}`);
console.log(`Ventas MISSING comision egreso: ${missingComisiones.length}`);

if (missingComisiones.length > 0) {
  let totalMissingComision = 0;
  console.log('\nMissing comision egresos:');
  for (const { ventaId, mlSync } of missingComisiones) {
    totalMissingComision += mlSync.comisionML;
    console.log(`  ventaId=${ventaId}  mlOrderId=${mlSync.mlOrderId || mlSync.id}  comisionML=S/${mlSync.comisionML.toFixed(2)}  estado=${mlSync.estado}  venta=${mlSync.numeroVenta || '-'}`);
  }
  console.log(`\nTotal missing comision: S/ ${totalMissingComision.toFixed(2)}`);
}

// ──────────────────────────────────────────────────────────────
// 5b. Find MISSING cargo_envio: ventas with cargoEnvioML but no cargo egreso
// ──────────────────────────────────────────────────────────────
const ventasWithCargoEnvio = new Set();
for (const { gasto } of categories.cargo_envio_ml) {
  if (gasto.ventaId) ventasWithCargoEnvio.add(gasto.ventaId);
}

const missingCargo = [];
for (const [ventaId, mlSync] of mlSyncMap.entries()) {
  if (mlSync.estado === 'ignorada') continue;
  if (!mlSync.cargoEnvioML || mlSync.cargoEnvioML <= 0) continue;
  if (ventasWithCargoEnvio.has(ventaId)) continue;
  missingCargo.push({ ventaId, mlSync });
}

if (missingCargo.length > 0) {
  let totalMissingCargo = 0;
  console.log(`\nMissing cargo_envio egresos: ${missingCargo.length}`);
  for (const { ventaId, mlSync } of missingCargo) {
    totalMissingCargo += mlSync.cargoEnvioML;
    console.log(`  ventaId=${ventaId}  mlOrderId=${mlSync.mlOrderId || mlSync.id}  cargoEnvioML=S/${mlSync.cargoEnvioML.toFixed(2)}  metodo=${mlSync.metodoEnvio || '?'}`);
  }
  console.log(`Total missing cargo_envio: S/ ${totalMissingCargo.toFixed(2)}`);
}

// ──────────────────────────────────────────────────────────────
// 6. SUMMARY
// ──────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  SUMMARY');
console.log('═══════════════════════════════════════════════════════════════');

const totalEgresos = allMovs.reduce((s, m) => s + (m.monto || 0), 0);
const totalComisiones = categories.comision_ml.reduce((s, { mov }) => s + (mov.monto || 0), 0);
const totalCargoEnvio = categories.cargo_envio_ml.reduce((s, { mov }) => s + (mov.monto || 0), 0);
const totalDelivery = categories.delivery.reduce((s, { mov }) => s + (mov.monto || 0), 0);
const totalTransfers = categories.transferencia_interna.reduce((s, m) => s + (m.monto || 0), 0);
const totalOtherGasto = categories.other_gasto.reduce((s, { mov }) => s + (mov.monto || 0), 0);
const totalUnlinked = categories.unlinked.reduce((s, m) => s + (m.monto || 0), 0);

console.log(`\nTotal egresos from MP: S/ ${totalEgresos.toFixed(2)}  (${allMovs.length} movements)`);
console.log('\nBy category:');
console.log(`  Comisiones ML:         S/ ${totalComisiones.toFixed(2).padStart(10)}  (${categories.comision_ml.length} movs)`);
console.log(`  Cargo envío ML:        S/ ${totalCargoEnvio.toFixed(2).padStart(10)}  (${categories.cargo_envio_ml.length} movs)`);
console.log(`  Delivery:              S/ ${totalDelivery.toFixed(2).padStart(10)}  (${categories.delivery.length} movs)`);
console.log(`  Transfers (withdraw):  S/ ${totalTransfers.toFixed(2).padStart(10)}  (${categories.transferencia_interna.length} movs)`);
console.log(`  Other gastos:          S/ ${totalOtherGasto.toFixed(2).padStart(10)}  (${categories.other_gasto.length} movs)`);
console.log(`  UNLINKED:              S/ ${totalUnlinked.toFixed(2).padStart(10)}  (${categories.unlinked.length} movs)`);

const sumCheck = totalComisiones + totalCargoEnvio + totalDelivery + totalTransfers + totalOtherGasto + totalUnlinked;
console.log(`\n  Sum check: S/ ${sumCheck.toFixed(2)} (should equal total: S/ ${totalEgresos.toFixed(2)}) ${Math.abs(sumCheck - totalEgresos) < 0.01 ? '✓' : '✗ MISMATCH'}`);

console.log(`\nComisiones that MATCH mlOrderSync: ${comisionMatches.length} — total S/ ${comisionMatches.reduce((s, c) => s + (c.gasto.monto || 0), 0).toFixed(2)}`);
console.log(`Comisiones with DISCREPANCY: ${comisionDiscrepancies.length}`);
if (comisionDiscrepancies.length > 0) {
  for (const d of comisionDiscrepancies) {
    console.log(`  ${d.mov.numeroMovimiento || d.mov.id}  gasto=S/${d.gastoMonto.toFixed(2)} vs mlSync=S/${d.mlComision.toFixed(2)} diff=S/${d.diff.toFixed(2)}  ventaId=${d.gasto.ventaId || '-'}`);
  }
}

// Total missing
const totalMissingComision = missingComisiones.reduce((s, { mlSync }) => s + mlSync.comisionML, 0);
const totalMissingCargo = missingCargo.reduce((s, { mlSync }) => s + mlSync.cargoEnvioML, 0);
const totalMissing = totalMissingComision + totalMissingCargo;

console.log(`\n────────────────────────────────────────────────────────────`);
console.log(`TOTAL MISSING EGRESOS (should have been deducted but weren't):`);
console.log(`  Missing comisiones:  S/ ${totalMissingComision.toFixed(2)}  (${missingComisiones.length} ventas)`);
console.log(`  Missing cargo envío: S/ ${totalMissingCargo.toFixed(2)}  (${missingCargo.length} ventas)`);
console.log(`  GRAND TOTAL MISSING: S/ ${totalMissing.toFixed(2)}`);
console.log('═══════════════════════════════════════════════════════════════');

process.exit(0);
