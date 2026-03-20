/**
 * FORENSIC LAYER 3: What MercadoLibre ACTUALLY deposited/charged vs what the system recorded
 * Source of truth: mlOrderSync collection
 * Compares ML's real financial impact on MercadoPago vs system-recorded movements
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const mpId = 'geEs98tz955mVjYNct8M';

// ═══════════════════════════════════════════════════════════════════════════
// 1. LOAD ALL DATA
// ═══════════════════════════════════════════════════════════════════════════

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║  FORENSIC LAYER 3 — ML Actual vs System Recorded (MercadoPago) ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');
console.log('Loading data...\n');

const [
  syncsSnap,
  movsDestSnap,
  movsOrigSnap,
  ventasSnap,
  gastosSnap,
] = await Promise.all([
  db.collection('mlOrderSync').get(),
  db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get(),
  db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get(),
  db.collection('ventas').get(),
  db.collection('gastos').get(),
]);

// ── Build movements map (dedup dest+orig) ──
const allMovsMap = new Map();
for (const m of movsDestSnap.docs) {
  allMovsMap.set(m.id, { id: m.id, ...m.data(), _isDest: true, _isOrig: false });
}
for (const m of movsOrigSnap.docs) {
  if (allMovsMap.has(m.id)) {
    allMovsMap.get(m.id)._isOrig = true;
  } else {
    allMovsMap.set(m.id, { id: m.id, ...m.data(), _isDest: false, _isOrig: true });
  }
}

// Filter active movements, group by ventaId and cotizacionId
const ingresosByVenta = new Map();   // ventaId → [movs where MP is destination]
const egresosByVenta = new Map();    // ventaId → [movs where MP is origin]
const ingresosByCot = new Map();     // cotizacionId → [movs]
const egresosByCot = new Map();
const orphanIngresos = [];           // MP ingresos with no ventaId and no cotizacionId

for (const mov of allMovsMap.values()) {
  if (mov.estado === 'anulado') continue;
  const monto = mov.monto || 0;

  if (mov._isDest) {
    // Money INTO MP
    if (mov.ventaId) {
      if (!ingresosByVenta.has(mov.ventaId)) ingresosByVenta.set(mov.ventaId, []);
      ingresosByVenta.get(mov.ventaId).push({ ...mov, monto });
    } else if (mov.cotizacionId) {
      if (!ingresosByCot.has(mov.cotizacionId)) ingresosByCot.set(mov.cotizacionId, []);
      ingresosByCot.get(mov.cotizacionId).push({ ...mov, monto });
    } else {
      orphanIngresos.push({ ...mov, monto });
    }
  }

  if (mov._isOrig) {
    // Money OUT of MP
    if (mov.ventaId) {
      if (!egresosByVenta.has(mov.ventaId)) egresosByVenta.set(mov.ventaId, []);
      egresosByVenta.get(mov.ventaId).push({ ...mov, monto });
    } else if (mov.cotizacionId) {
      if (!egresosByCot.has(mov.cotizacionId)) egresosByCot.set(mov.cotizacionId, []);
      egresosByCot.get(mov.cotizacionId).push({ ...mov, monto });
    }
  }
}

// ── Build gastos map by ventaId (for MP egresos via gastos) ──
const gastosByVenta = new Map();
for (const g of gastosSnap.docs) {
  const gd = { id: g.id, ...g.data() };
  if (gd.ventaId && gd.estado !== 'anulado') {
    if (!gastosByVenta.has(gd.ventaId)) gastosByVenta.set(gd.ventaId, []);
    gastosByVenta.get(gd.ventaId).push(gd);
  }
}

// ── Build ventas map ──
const ventasById = new Map();
const ventasByCot = new Map();
for (const v of ventasSnap.docs) {
  const vd = { id: v.id, ...v.data() };
  ventasById.set(v.id, vd);
  if (vd.cotizacionId) {
    ventasByCot.set(vd.cotizacionId, vd);
  }
}

// ── Build syncs: filter out ignorada/duplicada, group by ventaId ──
const allSyncs = [];
for (const s of syncsSnap.docs) {
  const sd = s.data();
  if (sd.estado === 'ignorada' || sd.estado === 'duplicada') continue;
  allSyncs.push({ id: s.id, ...sd });
}

// ── Pack deduplication: group by ventaId, prefer pack sync ──
const syncsByVenta = new Map();
for (const s of allSyncs) {
  if (!s.ventaId) continue;
  if (!syncsByVenta.has(s.ventaId)) syncsByVenta.set(s.ventaId, []);
  syncsByVenta.get(s.ventaId).push(s);
}

function getCanonicalSync(ventaSyncs) {
  if (!ventaSyncs || ventaSyncs.length === 0) return null;
  const packSync = ventaSyncs.find(s => s.packId || s.id.startsWith('ml-pack-'));
  if (packSync) return packSync;
  return ventaSyncs[0];
}

console.log(`Active syncs: ${allSyncs.length}`);
console.log(`Syncs with ventaId: ${syncsByVenta.size}`);
console.log(`MP ingreso movements (by ventaId): ${ingresosByVenta.size}`);
console.log(`MP egreso movements (by ventaId): ${egresosByVenta.size}`);
console.log(`MP ingreso movements (by cotizacionId): ${ingresosByCot.size}`);
console.log(`MP egreso movements (by cotizacionId): ${egresosByCot.size}`);
console.log(`Orphan MP ingresos (no venta/cot): ${orphanIngresos.length}`);

// ═══════════════════════════════════════════════════════════════════════════
// 2. ANALYZE EACH VENTA WITH SYNCS
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(80));
console.log('  VENTA-BY-VENTA ANALYSIS: ML Actual vs System Recorded');
console.log('═'.repeat(80) + '\n');

const discrepancies = [];
const okVentas = [];
const ventasAnalyzed = [];

for (const [ventaId, ventaSyncs] of syncsByVenta.entries()) {
  const venta = ventasById.get(ventaId);
  if (!venta) continue;
  const num = venta.numeroVenta || ventaId;

  const canonical = getCanonicalSync(ventaSyncs);
  if (!canonical) continue;

  // ── a. Determine metodoEnvio ──
  const metodo = canonical.metodoEnvio || 'unknown';

  // ── b. Calculate ML's REAL impact on MP ──
  const totalML = canonical.totalML || 0;
  const comisionML = canonical.comisionML || 0;
  const costoEnvioCliente = canonical.costoEnvioCliente || 0;
  const cargoEnvioML = canonical.cargoEnvioML || 0;

  // What ML deposits into MercadoPago:
  //   - For urbano: totalML (product payment, envio charged separately by ML)
  //   - For flex: totalML + costoEnvioCliente (client pays envio, seller receives it)
  let mlDeposits;
  if (metodo === 'flex') {
    mlDeposits = totalML + costoEnvioCliente;
  } else {
    mlDeposits = totalML;
  }

  // What ML charges (deductions):
  const mlCharges = comisionML + cargoEnvioML;

  // Net ML impact on MercadoPago
  const mlNet = mlDeposits - mlCharges;

  // ── c. Get SYSTEM's recorded movements for this venta ──
  const sysIngresos = ingresosByVenta.get(ventaId) || [];
  const sysEgresos = egresosByVenta.get(ventaId) || [];

  // Also check cotizacionId-linked movements
  const cotId = venta.cotizacionId;
  const cotIngresos = cotId ? (ingresosByCot.get(cotId) || []) : [];
  const cotEgresos = cotId ? (egresosByCot.get(cotId) || []) : [];

  const totalSysIngresos = sysIngresos.reduce((s, m) => s + m.monto, 0)
    + cotIngresos.reduce((s, m) => s + m.monto, 0);
  const totalSysEgresos = sysEgresos.reduce((s, m) => s + m.monto, 0)
    + cotEgresos.reduce((s, m) => s + m.monto, 0);

  const sysNet = totalSysIngresos - totalSysEgresos;

  // ── d. Discrepancy ──
  const discrepancy = sysNet - mlNet;

  const entry = {
    ventaId,
    num,
    metodo,
    mlDeposits,
    mlCharges,
    mlNet,
    totalSysIngresos,
    totalSysEgresos,
    sysNet,
    discrepancy,
    syncId: canonical.id,
    isPack: !!(canonical.packId || canonical.id.startsWith('ml-pack-')),
    cotIngresoCount: cotIngresos.length,
    cotEgresoCount: cotEgresos.length,
    totalML,
    comisionML,
    costoEnvioCliente,
    cargoEnvioML,
  };

  ventasAnalyzed.push(entry);

  if (Math.abs(discrepancy) > 0.50) {
    discrepancies.push(entry);
  } else {
    okVentas.push(entry);
  }
}

// Sort discrepancies by absolute value descending
discrepancies.sort((a, b) => Math.abs(b.discrepancy) - Math.abs(a.discrepancy));

// ═══════════════════════════════════════════════════════════════════════════
// 3. VENTAS WITH MP MOVEMENTS BUT NO SYNC (manual ventas)
// ═══════════════════════════════════════════════════════════════════════════

const ventasNoSync = [];
for (const [ventaId, movs] of ingresosByVenta.entries()) {
  if (syncsByVenta.has(ventaId)) continue; // Already analyzed
  const venta = ventasById.get(ventaId);
  if (!venta) continue;

  const totalIngreso = movs.reduce((s, m) => s + m.monto, 0);
  const egresos = egresosByVenta.get(ventaId) || [];
  const totalEgreso = egresos.reduce((s, m) => s + m.monto, 0);

  // Check venta.pagos for MP portion
  const pagos = venta.pagos || [];
  const pagoMP = pagos.filter(p =>
    p.metodoPago === 'mercado_pago' || p.cuentaDestinoId === mpId
  );
  const totalPagoMP = pagoMP.reduce((s, p) => s + (p.monto || 0), 0);

  ventasNoSync.push({
    ventaId,
    num: venta.numeroVenta || ventaId,
    totalIngreso,
    totalEgreso,
    netSystem: totalIngreso - totalEgreso,
    totalPagoMP,
    movCount: movs.length,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. COTIZACION-LINKED MOVEMENTS NOT TIED TO ANY ANALYZED VENTA
// ═══════════════════════════════════════════════════════════════════════════

const invisibleCotMovs = [];
for (const [cotId, movs] of ingresosByCot.entries()) {
  // Check if any venta we analyzed has this cotId
  const linkedVenta = ventasByCot.get(cotId);
  const alreadyAnalyzed = linkedVenta && ventasAnalyzed.some(v => v.ventaId === linkedVenta.id);
  if (!alreadyAnalyzed) {
    const totalIn = movs.reduce((s, m) => s + m.monto, 0);
    const egs = egresosByCot.get(cotId) || [];
    const totalOut = egs.reduce((s, m) => s + m.monto, 0);
    invisibleCotMovs.push({
      cotId,
      linkedVentaNum: linkedVenta?.numeroVenta || 'NONE',
      linkedVentaId: linkedVenta?.id || null,
      totalIn,
      totalOut,
      net: totalIn - totalOut,
      movIds: movs.map(m => m.id),
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. PRINT RESULTS
// ═══════════════════════════════════════════════════════════════════════════

// ── 5a. Discrepancies ──
console.log('┌──────────────────────────────────────────────────────────────────────────────┐');
console.log('│  VENTAS WITH DISCREPANCY > S/ 0.50                                          │');
console.log('├──────────────────────────────────────────────────────────────────────────────┤');

if (discrepancies.length === 0) {
  console.log('│  NONE — All ventas match within S/ 0.50                                    │');
} else {
  console.log('│  Venta          │ Método  │ ML Net      │ Sys Net     │ Discrepancy        │');
  console.log('├─────────────────┼─────────┼─────────────┼─────────────┼────────────────────┤');

  for (const d of discrepancies) {
    const sign = d.discrepancy > 0 ? '+' : '';
    console.log(
      `│  ${d.num.padEnd(14)} │ ${(d.metodo || '?').padEnd(7)} │ S/ ${d.mlNet.toFixed(2).padStart(8)} │ S/ ${d.sysNet.toFixed(2).padStart(8)} │ ${sign}S/ ${d.discrepancy.toFixed(2).padStart(8)} │`
    );

    // Detail breakdown
    console.log(
      `│    ML: dep=${d.mlDeposits.toFixed(2)} chg=${d.mlCharges.toFixed(2)} (com=${d.comisionML.toFixed(2)} envio=${d.cargoEnvioML.toFixed(2)})` +
      `${d.isPack ? ' [PACK]' : ''}${d.cotIngresoCount > 0 ? ` [+${d.cotIngresoCount} cot movs]` : ''}`
    );
    console.log(
      `│    SYS: in=${d.totalSysIngresos.toFixed(2)} out=${d.totalSysEgresos.toFixed(2)} | totalML=${d.totalML.toFixed(2)} costoEnvCli=${d.costoEnvioCliente.toFixed(2)}`
    );
  }
}
console.log('└──────────────────────────────────────────────────────────────────────────────┘');

// ── 5b. OK ventas summary ──
console.log(`\n✓ Ventas within tolerance (|disc| ≤ 0.50): ${okVentas.length}`);
if (okVentas.length > 0) {
  const maxShow = 10;
  const shown = okVentas.slice(0, maxShow);
  for (const o of shown) {
    console.log(`  ${o.num}: ML=${o.mlNet.toFixed(2)} Sys=${o.sysNet.toFixed(2)} Δ=${o.discrepancy.toFixed(2)}`);
  }
  if (okVentas.length > maxShow) {
    console.log(`  ... and ${okVentas.length - maxShow} more`);
  }
}

// ── 5c. Summaries ──
const positiveDisc = discrepancies.filter(d => d.discrepancy > 0);
const negativeDisc = discrepancies.filter(d => d.discrepancy < 0);
const totalExcess = positiveDisc.reduce((s, d) => s + d.discrepancy, 0);
const totalDeficit = negativeDisc.reduce((s, d) => s + d.discrepancy, 0);
const netDisc = totalExcess + totalDeficit;

console.log('\n' + '═'.repeat(80));
console.log('  SUMMARY');
console.log('═'.repeat(80));
console.log(`  Total ventas analyzed (with sync): ${ventasAnalyzed.length}`);
console.log(`  Ventas OK (|Δ| ≤ 0.50):           ${okVentas.length}`);
console.log(`  Ventas with discrepancy:           ${discrepancies.length}`);
console.log(`  ─────────────────────────────────────────────`);
console.log(`  EXCESS (system > ML):   S/ ${totalExcess.toFixed(2).padStart(10)} (${positiveDisc.length} ventas)`);
console.log(`  DEFICIT (system < ML):  S/ ${totalDeficit.toFixed(2).padStart(10)} (${negativeDisc.length} ventas)`);
console.log(`  NET DISCREPANCY:        S/ ${netDisc.toFixed(2).padStart(10)}`);

// ── 5d. Ventas with MP movements but no sync ──
console.log('\n' + '═'.repeat(80));
console.log('  VENTAS WITH MP MOVEMENTS BUT NO mlOrderSync (manual/non-ML)');
console.log('═'.repeat(80));
console.log(`  Count: ${ventasNoSync.length}\n`);

for (const v of ventasNoSync) {
  console.log(`  ${v.num}: ingreso=S/${v.totalIngreso.toFixed(2)} egreso=S/${v.totalEgreso.toFixed(2)} net=S/${v.netSystem.toFixed(2)} | pagos MP=S/${v.totalPagoMP.toFixed(2)} (${v.movCount} movs)`);
}

// ── 5e. CotizacionId-linked "invisible" movements ──
if (invisibleCotMovs.length > 0) {
  console.log('\n' + '═'.repeat(80));
  console.log('  COTIZACION-LINKED MOVEMENTS NOT IN ANALYZED VENTAS');
  console.log('  (These affect MP saldo but may be "invisible" in venta view)');
  console.log('═'.repeat(80));
  console.log(`  Count: ${invisibleCotMovs.length}\n`);

  for (const c of invisibleCotMovs) {
    console.log(`  CotId: ${c.cotId} → Venta: ${c.linkedVentaNum}`);
    console.log(`    In: S/${c.totalIn.toFixed(2)} Out: S/${c.totalOut.toFixed(2)} Net: S/${c.net.toFixed(2)}`);
    console.log(`    MovIds: ${c.movIds.join(', ')}`);
  }
}

// ── 5f. Orphan MP ingresos ──
if (orphanIngresos.length > 0) {
  console.log('\n' + '═'.repeat(80));
  console.log('  ORPHAN MP INGRESOS (no ventaId, no cotizacionId)');
  console.log('═'.repeat(80));
  console.log(`  Count: ${orphanIngresos.length}\n`);

  for (const o of orphanIngresos) {
    console.log(`  ${o.id}: S/${o.monto.toFixed(2)} | tipo=${o.tipo || '?'} concepto=${o.concepto || '?'}`);
  }
  const totalOrphan = orphanIngresos.reduce((s, o) => s + o.monto, 0);
  console.log(`  Total orphan ingresos: S/ ${totalOrphan.toFixed(2)}`);
}

console.log('\n' + '═'.repeat(80));
console.log('  FORENSIC LAYER 3 COMPLETE');
console.log('═'.repeat(80));

process.exit(0);
