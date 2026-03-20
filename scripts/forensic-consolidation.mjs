/**
 * FORENSIC CONSOLIDATION v2 - Definitive gap analysis
 * Goal: Explain EXACTLY where the S/ 321.50 gap comes from
 * (System S/ 2,137.65 - Real S/ 1,816.15)
 *
 * The gap means the system has S/ 321.50 MORE than reality.
 * Causes: inflated ingresos OR missing egresos.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';
const SALDO_REAL = 1816.15;

const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => `S/ ${r2(n).toFixed(2)}`;

console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
console.log('║          FORENSIC CONSOLIDATION v2 - MP GAP ANALYSIS                     ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');

// ============================================================================
// LOAD ALL DATA
// ============================================================================
console.log('Loading data...');

const [mlSyncsSnap, ventasSnap, gastosSnap, movsOSnap, movsDSnap, entregasSnap, cotizacionesSnap] = await Promise.all([
  db.collection('mlOrderSync').get(),
  db.collection('ventas').get(),
  db.collection('gastos').get(),
  db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get(),
  db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get(),
  db.collection('entregas').get(),
  db.collection('cotizaciones').get(),
]);

const ventaMap = new Map();
for (const d of ventasSnap.docs) ventaMap.set(d.id, { id: d.id, ...d.data() });

const gastoMap = new Map();
for (const d of gastosSnap.docs) gastoMap.set(d.id, { id: d.id, ...d.data() });

const entregaMap = new Map();
for (const d of entregasSnap.docs) entregaMap.set(d.id, { id: d.id, ...d.data() });

// Build cotizacion -> ventaId map (for MOV-0102 type cases)
const cotToVentaId = new Map(); // cotizacionDocId -> ventaId
for (const d of cotizacionesSnap.docs) {
  const data = d.data();
  if (data.ventaId) cotToVentaId.set(d.id, data.ventaId);
}

// All MP movements (deduped, non-anulados)
const allMovs = new Map();
for (const m of movsOSnap.docs) allMovs.set(m.id, { id: m.id, d: m.data(), esOrigen: true, esDestino: false });
for (const m of movsDSnap.docs) {
  if (allMovs.has(m.id)) allMovs.get(m.id).esDestino = true;
  else allMovs.set(m.id, { id: m.id, d: m.data(), esOrigen: false, esDestino: true });
}
const activeMovs = [...allMovs.values()].filter(m => m.d.estado !== 'anulado');

// Compute system saldo from movements
let saldoFromMovs = 0;
for (const mov of activeMovs) {
  if (mov.d.tipo === 'transferencia_interna') {
    if (mov.esOrigen && !mov.esDestino) saldoFromMovs -= mov.d.monto || 0;
    else if (mov.esDestino && !mov.esOrigen) saldoFromMovs += mov.d.monto || 0;
  } else if (mov.esDestino && !mov.esOrigen) saldoFromMovs += mov.d.monto || 0;
  else if (mov.esOrigen && !mov.esDestino) saldoFromMovs -= mov.d.monto || 0;
}
const SALDO_SISTEMA = r2(saldoFromMovs);

console.log(`  System saldo (from movements): ${fmt(SALDO_SISTEMA)}`);
console.log(`  Real MP saldo:                 ${fmt(SALDO_REAL)}`);
console.log(`  GAP:                           ${fmt(SALDO_SISTEMA - SALDO_REAL)}\n`);

// ============================================================================
// DEDUPLICATE ML SYNCS
// ============================================================================

const allSyncs = mlSyncsSnap.docs.map(s => ({ id: s.id, ...s.data() }));

// Build ventaId -> best sync (prefer procesada, skip ignorada/duplicada, dedup packs)
const syncByVentaId = new Map();
for (const sd of allSyncs) {
  if (sd.estado === 'ignorada' || sd.estado === 'duplicada') continue;
  if (!sd.ventaId) continue;

  const existing = syncByVentaId.get(sd.ventaId);
  if (!existing) {
    syncByVentaId.set(sd.ventaId, sd);
  } else {
    // Prefer ml-pack-* for pack orders; otherwise prefer procesada
    if (sd.id.startsWith('ml-pack-') && !existing.id.startsWith('ml-pack-')) {
      syncByVentaId.set(sd.ventaId, sd);
    }
  }
}

// ============================================================================
// BUILD MOVEMENT INDICES
// ============================================================================

// Index by ventaId, gastoId, cotizacionId
const movsByVentaId = new Map();
const movsByGastoId = new Map();
const movsByCotizacionId = new Map();

for (const mov of activeMovs) {
  const d = mov.d;
  if (d.ventaId) {
    if (!movsByVentaId.has(d.ventaId)) movsByVentaId.set(d.ventaId, []);
    movsByVentaId.get(d.ventaId).push(mov);
  }
  if (d.gastoId) {
    if (!movsByGastoId.has(d.gastoId)) movsByGastoId.set(d.gastoId, []);
    movsByGastoId.get(d.gastoId).push(mov);
  }
  if (d.cotizacionId) {
    if (!movsByCotizacionId.has(d.cotizacionId)) movsByCotizacionId.set(d.cotizacionId, []);
    movsByCotizacionId.get(d.cotizacionId).push(mov);
  }
}

// Gastos by ventaId
const gastosByVentaId = new Map();
for (const [gid, g] of gastoMap) {
  if (g.ventaId) {
    if (!gastosByVentaId.has(g.ventaId)) gastosByVentaId.set(g.ventaId, []);
    gastosByVentaId.get(g.ventaId).push(g);
  }
}

// Entregas by ventaId
const entregasByVentaId = new Map();
for (const [eid, e] of entregaMap) {
  if (e.ventaId) {
    if (!entregasByVentaId.has(e.ventaId)) entregasByVentaId.set(e.ventaId, []);
    entregasByVentaId.get(e.ventaId).push(e);
  }
}

// ============================================================================
// STEP 1 & 2: Per-venta analysis - ML REAL vs SYSTEM
// ============================================================================
console.log('═══════════════════════════════════════════════════════════════');
console.log('STEP 1-3: Per-venta ML REAL vs SYSTEM analysis');
console.log('═══════════════════════════════════════════════════════════════\n');

/**
 * ML deposit logic:
 * - For ALL methods: ML deposits totalML into MP as the product revenue
 * - For flex: ML ALSO deposits costoEnvioCliente (customer paid shipping, goes to seller)
 * - For urbano: costoEnvioCliente goes to ML, NOT to seller. cargoEnvioML is CHARGED to seller.
 *
 * ML charge logic:
 * - comisionML: always charged
 * - cargoEnvioML: charged for urbano shipping
 *
 * So ML NET = totalML [+ costoEnvioCliente if flex] - comisionML - cargoEnvioML
 */

const attributedMovIds = new Set();
const ventaAnalysis = [];

for (const [ventaId, sync] of syncByVentaId) {
  const venta = ventaMap.get(ventaId);
  const numVenta = venta?.numeroVenta || ventaId;

  const totalML = sync.totalML || 0;
  const comisionML = sync.comisionML || 0;
  const cargoEnvioML = sync.cargoEnvioML || 0;
  const costoEnvioCliente = sync.costoEnvioCliente || 0;
  const metodoEnvio = sync.metodoEnvio || null;

  // What ML actually deposited
  let mlDeposit = totalML;
  if (metodoEnvio === 'flex') mlDeposit += costoEnvioCliente;

  // What ML actually charged
  const mlCharges = comisionML + cargoEnvioML;
  const mlNet = r2(mlDeposit - mlCharges);

  // === System ingresos to MP ===
  let sysIngresos = 0;
  const sysIngresosDetail = [];
  const usedMovIds = new Set();

  // 1. By ventaId
  const ventaMovs = movsByVentaId.get(ventaId) || [];
  for (const mov of ventaMovs) {
    if (mov.esDestino && !mov.esOrigen) {
      sysIngresos += mov.d.monto || 0;
      sysIngresosDetail.push({ id: mov.id, num: mov.d.numeroMovimiento, monto: mov.d.monto, concepto: mov.d.concepto, via: 'ventaId' });
      usedMovIds.add(mov.id);
    }
  }

  // 2. By cotizacionId (on the venta doc)
  if (venta?.cotizacionId) {
    const cotMovs = movsByCotizacionId.get(venta.cotizacionId) || [];
    for (const mov of cotMovs) {
      if (mov.esDestino && !mov.esOrigen && !usedMovIds.has(mov.id)) {
        sysIngresos += mov.d.monto || 0;
        sysIngresosDetail.push({ id: mov.id, num: mov.d.numeroMovimiento, monto: mov.d.monto, concepto: mov.d.concepto, via: 'cotizacionId(venta)' });
        usedMovIds.add(mov.id);
      }
    }
  }

  // 3. By cotizacion doc that points to this ventaId (reverse lookup)
  for (const [cotDocId, linkedVentaId] of cotToVentaId) {
    if (linkedVentaId === ventaId) {
      const cotMovs = movsByCotizacionId.get(cotDocId) || [];
      for (const mov of cotMovs) {
        if (mov.esDestino && !mov.esOrigen && !usedMovIds.has(mov.id)) {
          sysIngresos += mov.d.monto || 0;
          sysIngresosDetail.push({ id: mov.id, num: mov.d.numeroMovimiento, monto: mov.d.monto, concepto: mov.d.concepto, via: 'cotizacion->ventaId' });
          usedMovIds.add(mov.id);
        }
      }
    }
  }

  // === System egresos from MP ===
  let sysEgresos = 0;
  const sysEgresosDetail = [];

  // 1. Direct by ventaId (egresos from MP)
  for (const mov of ventaMovs) {
    if (mov.esOrigen && !mov.esDestino && !usedMovIds.has(mov.id)) {
      sysEgresos += mov.d.monto || 0;
      sysEgresosDetail.push({ id: mov.id, num: mov.d.numeroMovimiento, monto: mov.d.monto, concepto: mov.d.concepto, via: 'ventaId' });
      usedMovIds.add(mov.id);
    } else if (mov.esOrigen && !mov.esDestino) {
      sysEgresos += mov.d.monto || 0;
      sysEgresosDetail.push({ id: mov.id, num: mov.d.numeroMovimiento, monto: mov.d.monto, concepto: mov.d.concepto, via: 'ventaId' });
      usedMovIds.add(mov.id);
    }
  }

  // 2. Via gastos linked to this venta
  const ventaGastos = gastosByVentaId.get(ventaId) || [];
  for (const gasto of ventaGastos) {
    const gastoMovs = movsByGastoId.get(gasto.id) || [];
    for (const mov of gastoMovs) {
      if (mov.esOrigen && !mov.esDestino && !usedMovIds.has(mov.id)) {
        sysEgresos += mov.d.monto || 0;
        sysEgresosDetail.push({ id: mov.id, num: mov.d.numeroMovimiento, monto: mov.d.monto, concepto: mov.d.concepto, via: `gasto:${gasto.id.substring(0,8)}` });
        usedMovIds.add(mov.id);
      }
    }
  }

  // 3. Via entregas -> gastoDistribucionId
  const ventaEntregas = entregasByVentaId.get(ventaId) || [];
  for (const entrega of ventaEntregas) {
    if (entrega.gastoDistribucionId) {
      const deliveryMovs = movsByGastoId.get(entrega.gastoDistribucionId) || [];
      for (const mov of deliveryMovs) {
        if (mov.esOrigen && !mov.esDestino && !usedMovIds.has(mov.id)) {
          sysEgresos += mov.d.monto || 0;
          sysEgresosDetail.push({ id: mov.id, num: mov.d.numeroMovimiento, monto: mov.d.monto, concepto: mov.d.concepto, via: `delivery:${entrega.codigo || '?'}` });
          usedMovIds.add(mov.id);
        }
      }
    }
  }

  for (const mid of usedMovIds) attributedMovIds.add(mid);

  const sysNet = r2(sysIngresos - sysEgresos);
  const disc = r2(sysNet - mlNet);

  ventaAnalysis.push({
    ventaId,
    numVenta,
    metodoEnvio,
    mlDeposit: r2(mlDeposit),
    mlCharges: r2(mlCharges),
    mlNet,
    totalML, comisionML, cargoEnvioML, costoEnvioCliente,
    sysIngresos: r2(sysIngresos),
    sysEgresos: r2(sysEgresos),
    sysNet,
    disc,
    sysIngresosDetail,
    sysEgresosDetail,
    syncId: sync.id,
  });
}

ventaAnalysis.sort((a, b) => Math.abs(b.disc) - Math.abs(a.disc));

let totalMLNet = 0, totalSysNet = 0, totalDisc = 0;
for (const v of ventaAnalysis) {
  totalMLNet += v.mlNet;
  totalSysNet += v.sysNet;
  totalDisc += v.disc;
}

console.log(`  ML ventas analyzed: ${ventaAnalysis.length}`);
console.log(`  Total ML NET:      ${fmt(totalMLNet)}`);
console.log(`  Total Sys NET:     ${fmt(totalSysNet)}`);
console.log(`  Total DISC:        ${fmt(totalDisc)}\n`);

// ============================================================================
// STEP 4: Non-ML movements
// ============================================================================
console.log('═══════════════════════════════════════════════════════════════');
console.log('STEP 4: Non-ML movements on MP');
console.log('═══════════════════════════════════════════════════════════════\n');

let nonMLIngresos = 0, nonMLEgresos = 0, nonMLTransferOut = 0, nonMLTransferIn = 0;
const nonMLMovs = [];

for (const mov of activeMovs) {
  if (attributedMovIds.has(mov.id)) continue;
  const d = mov.d;
  let efecto = 0, category = 'other';

  if (d.tipo === 'transferencia_interna') {
    if (mov.esOrigen && !mov.esDestino) { efecto = -(d.monto || 0); category = 'transfer_out'; nonMLTransferOut += d.monto || 0; }
    else if (mov.esDestino && !mov.esOrigen) { efecto = +(d.monto || 0); category = 'transfer_in'; nonMLTransferIn += d.monto || 0; }
  } else if (mov.esDestino && !mov.esOrigen) {
    efecto = +(d.monto || 0); category = 'ingreso'; nonMLIngresos += d.monto || 0;
  } else if (mov.esOrigen && !mov.esDestino) {
    efecto = -(d.monto || 0); category = 'egreso'; nonMLEgresos += d.monto || 0;
  }

  nonMLMovs.push({ id: mov.id, num: d.numeroMovimiento, tipo: d.tipo, category, monto: d.monto || 0, efecto, concepto: (d.concepto || '').substring(0, 80), ventaId: d.ventaId, cotizacionId: d.cotizacionId, gastoId: d.gastoId });
}

for (const m of nonMLMovs) {
  const sign = m.efecto >= 0 ? '+' : '';
  console.log(`  ${(m.num || 'N/A').padEnd(16)} ${sign}${fmt(m.efecto).padEnd(14)} [${m.category.padEnd(12)}] ${m.concepto}`);
  if (m.ventaId) console.log(`${''.padEnd(32)}ventaId: ${m.ventaId}`);
  if (m.cotizacionId) console.log(`${''.padEnd(32)}cotizacionId: ${m.cotizacionId}`);
}

const nonMLNet = r2(nonMLIngresos - nonMLEgresos - nonMLTransferOut + nonMLTransferIn);
console.log(`\n  Non-ML Ingresos:     +${fmt(nonMLIngresos)}`);
console.log(`  Non-ML Egresos:      -${fmt(nonMLEgresos)}`);
console.log(`  Transfers Out:       -${fmt(nonMLTransferOut)}`);
console.log(`  Transfers In:        +${fmt(nonMLTransferIn)}`);
console.log(`  Non-ML NET:          ${fmt(nonMLNet)}\n`);

// ============================================================================
// STEP 5: RECONCILIATION TABLE
// ============================================================================
console.log('═══════════════════════════════════════════════════════════════');
console.log('STEP 5: RECONCILIATION');
console.log('═══════════════════════════════════════════════════════════════\n');

const expectedSaldo = r2(totalMLNet + nonMLNet);  // What MP should have if system matched reality
const systemSaldo = r2(totalSysNet + nonMLNet);    // What system thinks MP has

console.log(`  A) ML real NET deposits:              ${fmt(totalMLNet)}`);
console.log(`  B) Non-ML NET:                        ${fmt(nonMLNet)}`);
console.log(`  C) Expected MP saldo (A+B):           ${fmt(expectedSaldo)}`);
console.log('');
console.log(`  D) System ML NET:                     ${fmt(totalSysNet)}`);
console.log(`  E) System saldo (D+B):                ${fmt(systemSaldo)}`);
console.log(`  F) System saldo (from movs):          ${fmt(SALDO_SISTEMA)}`);
console.log('');
console.log(`  G) Real MP saldo:                     ${fmt(SALDO_REAL)}`);
console.log('');
console.log(`  GAP (F - G):                          ${fmt(SALDO_SISTEMA - SALDO_REAL)}`);
console.log(`  ML disc (D - A):                      ${fmt(r2(totalSysNet - totalMLNet))}`);
console.log(`  Expected vs Real (C - G):             ${fmt(r2(expectedSaldo - SALDO_REAL))}`);
console.log(`  System vs Expected (E/F - C):         ${fmt(r2(systemSaldo - expectedSaldo))}`);

// ============================================================================
// STEP 6: ALL DISCREPANCIES > S/ 0.50
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('STEP 6: PER-VENTA DISCREPANCIES > S/ 0.50');
console.log('═══════════════════════════════════════════════════════════════\n');

const significantDiscs = ventaAnalysis.filter(d => Math.abs(d.disc) > 0.50);

// Category accumulators
let totalInflatedIngreso = 0;   // sys recorded more ingresos than ML deposited
let totalMissingIngreso = 0;    // sys recorded fewer ingresos than ML deposited
let totalMissingEgreso = 0;     // sys recorded fewer egresos than ML charged
let totalExtraEgreso = 0;       // sys recorded more egresos than ML charged

const inflatedDetails = [];
const missingIngresoDetails = [];
const missingEgresoDetails = [];

for (const v of significantDiscs) {
  const sign = v.disc > 0 ? '+' : '';
  console.log(`─── ${v.numVenta} (${v.metodoEnvio || '?'}) ─── DISC: ${sign}${fmt(v.disc)} ───`);
  console.log(`  ML:  deposit=${fmt(v.mlDeposit)} charges=${fmt(v.mlCharges)} NET=${fmt(v.mlNet)}`);
  console.log(`       totalML=${fmt(v.totalML)} comision=${fmt(v.comisionML)} cargoEnvio=${fmt(v.cargoEnvioML)} costoEnvioCliente=${fmt(v.costoEnvioCliente)}`);
  console.log(`  SYS: ingresos=${fmt(v.sysIngresos)} egresos=${fmt(v.sysEgresos)} NET=${fmt(v.sysNet)}`);

  for (const i of v.sysIngresosDetail) console.log(`       IN:  ${i.num} ${fmt(i.monto)} [${i.via}] ${(i.concepto||'').substring(0,55)}`);
  for (const e of v.sysEgresosDetail) console.log(`       OUT: ${e.num} ${fmt(e.monto)} [${e.via}] ${(e.concepto||'').substring(0,55)}`);

  // Analyze WHY
  const ingresoGap = r2(v.sysIngresos - v.mlDeposit);
  const egresoGap = r2(v.sysEgresos - v.mlCharges);
  const reasons = [];

  if (ingresoGap > 0.50) {
    totalInflatedIngreso += ingresoGap;
    inflatedDetails.push({ venta: v.numVenta, amount: ingresoGap, metodo: v.metodoEnvio });

    if (v.metodoEnvio === 'urbano' && Math.abs(ingresoGap - v.cargoEnvioML) < 1) {
      reasons.push(`INFLATED INGRESO: +${fmt(ingresoGap)} (cargoEnvioML included in ingreso but ML doesn't deposit it)`);
    } else {
      reasons.push(`INFLATED INGRESO: +${fmt(ingresoGap)}`);
    }
  } else if (ingresoGap < -0.50) {
    totalMissingIngreso += Math.abs(ingresoGap);
    missingIngresoDetails.push({ venta: v.numVenta, amount: Math.abs(ingresoGap), metodo: v.metodoEnvio });

    if (v.metodoEnvio === 'flex' && Math.abs(Math.abs(ingresoGap) - v.costoEnvioCliente) < 1) {
      reasons.push(`MISSING INGRESO: ${fmt(ingresoGap)} (costoEnvioCliente not recorded in sys ingreso)`);
    } else {
      reasons.push(`MISSING INGRESO: ${fmt(ingresoGap)}`);
    }
  }

  if (egresoGap < -0.50) {
    // System recorded LESS egresos than ML charged = missing egresos
    totalMissingEgreso += Math.abs(egresoGap);
    missingEgresoDetails.push({ venta: v.numVenta, amount: Math.abs(egresoGap), metodo: v.metodoEnvio });
    reasons.push(`MISSING EGRESO: ${fmt(egresoGap)} (ML charged more than sys recorded)`);
  } else if (egresoGap > 0.50) {
    totalExtraEgreso += egresoGap;
    reasons.push(`EXTRA EGRESO: +${fmt(egresoGap)} (sys recorded more egresos than ML charged)`);
  }

  if (reasons.length === 0) reasons.push('Small rounding diff');
  for (const r of reasons) console.log(`  WHY: ${r}`);
  console.log('');
}

// ============================================================================
// STEP 7: CATEGORY SUMMARY
// ============================================================================
console.log('═══════════════════════════════════════════════════════════════');
console.log('STEP 7: DISCREPANCY CATEGORIES');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`  A) Inflated ingresos (sys > ML deposit):     +${fmt(totalInflatedIngreso)} → system OVER-counts`);
for (const d of inflatedDetails) console.log(`     ${d.venta} (${d.metodo}): +${fmt(d.amount)}`);

console.log(`\n  B) Missing ingresos (sys < ML deposit):      -${fmt(totalMissingIngreso)} → system UNDER-counts`);
for (const d of missingIngresoDetails) console.log(`     ${d.venta} (${d.metodo}): -${fmt(d.amount)}`);

console.log(`\n  C) Missing egresos (sys < ML charges):       +${fmt(totalMissingEgreso)} → system OVER-counts (missing deduction)`);
for (const d of missingEgresoDetails) console.log(`     ${d.venta} (${d.metodo}): +${fmt(d.amount)}`);

console.log(`\n  D) Extra egresos (sys > ML charges):         -${fmt(totalExtraEgreso)} → system UNDER-counts`);

console.log(`\n  Net effect on system saldo:`);
console.log(`    +inflated ingresos:     +${fmt(totalInflatedIngreso)}`);
console.log(`    -missing ingresos:      -${fmt(totalMissingIngreso)}`);
console.log(`    +missing egresos:       +${fmt(totalMissingEgreso)}`);
console.log(`    -extra egresos:         -${fmt(totalExtraEgreso)}`);
const netMLEffect = r2(totalInflatedIngreso - totalMissingIngreso + totalMissingEgreso - totalExtraEgreso);
console.log(`    = NET ML effect:        ${fmt(netMLEffect)} (should approximate ML disc of ${fmt(r2(totalSysNet - totalMLNet))})`);

// ============================================================================
// STEP 8: NON-ML PHANTOM ANALYSIS
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('STEP 8: NON-ML MOVEMENT ANALYSIS');
console.log('═══════════════════════════════════════════════════════════════\n');

// The non-ML movements should also be checked against reality
// MOV-0088 (S/65.10 ajuste Flex) - confirmed phantom
// MOV-0102 (S/165.25 adelanto COT-2026-014) - IS the real ML payment for VT-037

// Check: MOV-0102 should be attributed to VT-037
// VT-037 ML deposit was S/ 165.25 (totalML=158 + costoEnvioCliente=7.25)
// System has MOV-0128 (S/7.25 by ventaId) + MOV-0102 (S/165.25 by cotizacionId via cotizacion doc)
// In our analysis, was MOV-0102 attributed to VT-037?

const vt037 = ventaAnalysis.find(v => v.numVenta === 'VT-2026-037');
if (vt037) {
  console.log('  VT-037 CHECK:');
  console.log(`    Sys Ingresos: ${fmt(vt037.sysIngresos)}`);
  for (const i of vt037.sysIngresosDetail) {
    console.log(`      ${i.num}: ${fmt(i.monto)} [${i.via}]`);
  }
  const attributed102 = vt037.sysIngresosDetail.some(i => i.num === 'MOV-2026-0102');
  console.log(`    MOV-0102 attributed to VT-037: ${attributed102 ? 'YES' : 'NO'}`);
  console.log('');
}

// List remaining non-ML movements
console.log('  Remaining non-ML movements:');
for (const m of nonMLMovs) {
  const sign = m.efecto >= 0 ? '+' : '';
  const phantom = m.num === 'MOV-2026-0088' ? ' *** CONFIRMED PHANTOM ***' : '';
  console.log(`    ${(m.num||'N/A').padEnd(16)} ${sign}${fmt(m.efecto).padEnd(14)} ${m.concepto.substring(0,50)}${phantom}`);
}

// ============================================================================
// FINAL ANSWER
// ============================================================================
console.log('\n╔═══════════════════════════════════════════════════════════════════════════╗');
console.log('║                    FINAL GAP EXPLANATION                                 ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');

console.log(`  TOTAL GAP TO EXPLAIN:                  ${fmt(SALDO_SISTEMA - SALDO_REAL)}\n`);

console.log('  SOURCE 1: ML per-venta discrepancies');
console.log(`    Net effect (sys has MORE by):         ${fmt(r2(totalSysNet - totalMLNet))}`);
console.log('    Breakdown:');
console.log(`      Inflated ingresos:                 +${fmt(totalInflatedIngreso)}`);
console.log(`      Missing egresos (saldo too high):  +${fmt(totalMissingEgreso)}`);
console.log(`      Missing ingresos (saldo too low):  -${fmt(totalMissingIngreso)}`);
console.log(`      Extra egresos (saldo too low):     -${fmt(totalExtraEgreso)}`);

console.log('\n  SOURCE 2: Non-ML phantom/orphan movements');
const phantom088 = nonMLMovs.find(m => m.num === 'MOV-2026-0088');
const orphan102 = nonMLMovs.find(m => m.num === 'MOV-2026-0102');
if (phantom088) console.log(`    MOV-0088 (phantom Flex ajuste):      +${fmt(phantom088.monto)}`);
if (orphan102) console.log(`    MOV-0102 (orphan cotizacion adelanto): +${fmt(orphan102.monto)} ${vt037 && vt037.sysIngresosDetail.some(i => i.num === 'MOV-2026-0102') ? '(ALREADY attributed to VT-037)' : '(NOT attributed - DOUBLE COUNT)'}`);

// Calculate non-ML impact (excluding transfers which should net zero)
const nonMLImpact = nonMLIngresos; // No non-ML egresos found
const transferImpact = r2(nonMLTransferIn - nonMLTransferOut);
console.log(`    Other non-ML ingresos:               +${fmt(nonMLIngresos)}`);
console.log(`    Transfer net:                        ${fmt(transferImpact)}`);

console.log('\n  ─────────────────────────────────────────────────');
const totalExplained = r2((totalSysNet - totalMLNet) + (orphan102 && !vt037?.sysIngresosDetail.some(i => i.num === 'MOV-2026-0102') ? orphan102.monto : 0) + (phantom088 ? phantom088.monto : 0));

// The gap comes from:
// 1. System ML NET is different from real ML NET
// 2. Non-ML movements that shouldn't exist (phantom) or are double-counted (orphan)
// The GAP = (System saldo) - (Real saldo)
// System saldo = Sum of all movements
// Real saldo = ML real NET + transfers + real non-ML

// Let's compute what REAL saldo should be:
// Real MP saldo = ML real NET + non-ML movements that are REAL
// MOV-0088 is phantom (shouldn't exist): -65.10 from real
// MOV-0102: if it's VT-037's payment and already counted in ML NET, it's double-counted in system
// Transfers are real: -8424.00

const realNonML_adjusted = r2(nonMLNet - (phantom088 ? phantom088.monto : 0));
if (orphan102 && !vt037?.sysIngresosDetail.some(i => i.num === 'MOV-2026-0102')) {
  // MOV-0102 is NOT attributed to VT-037, so it's a separate addition to the system
  // But the ML real NET already includes VT-037's deposit
  // So MOV-0102 is double-counting VT-037's deposit
  console.log(`  MOV-0102 is double-counting VT-037's ML deposit: +${fmt(orphan102.monto)}`);
}

console.log('');
console.log('  RECONCILIATION:');
console.log(`    Real MP saldo:                       ${fmt(SALDO_REAL)}`);
console.log(`    ML real NET:                         ${fmt(totalMLNet)}`);
console.log(`    Transfers:                           ${fmt(transferImpact)}`);
console.log(`    Expected (ML NET + transfers):       ${fmt(r2(totalMLNet + transferImpact))}`);
console.log(`    Diff (expected - real):              ${fmt(r2(totalMLNet + transferImpact - SALDO_REAL))}`);
console.log(`    (This diff = real non-ML movs that are NOT ML-related)`);
console.log('');

// The system gap is:
// System saldo - Real saldo = 321.50
// System saldo = ML sys NET + non-ML NET
// Real saldo = ML real NET + real non-ML NET
//
// So: gap = (ML sys NET - ML real NET) + (system non-ML NET - real non-ML NET)
// ML sys NET - ML real NET = totalDisc
// system non-ML = nonMLNet (as recorded)
// real non-ML = nonMLNet minus phantom MOV-0088 and possibly minus double-counted MOV-0102

console.log('  GAP DECOMPOSITION:');
console.log(`    Gap = System saldo - Real saldo = ${fmt(SALDO_SISTEMA - SALDO_REAL)}`);
console.log(`    = (ML sys NET - ML real NET) + phantom movements`);
console.log(`    ML sys NET - ML real NET:             ${fmt(r2(totalSysNet - totalMLNet))}`);
console.log(`    Phantom MOV-0088:                    +${fmt(phantom088?.monto || 0)}`);
const knownGap = r2((totalSysNet - totalMLNet) + (phantom088?.monto || 0));
console.log(`    Known gap:                           ${fmt(knownGap)}`);
const unexplained = r2(SALDO_SISTEMA - SALDO_REAL - knownGap);
console.log(`    Unexplained:                         ${fmt(unexplained)}`);

// Check if MOV-0102 was NOT attributed and is double counting
if (orphan102 && !vt037?.sysIngresosDetail.some(i => i.num === 'MOV-2026-0102')) {
  console.log(`\n    *** MOV-0102 (${fmt(orphan102.monto)}) is NOT linked to any ML venta ***`);
  console.log(`    It adds to system saldo but its ML deposit is already in ML real NET`);
  console.log(`    Adding this: ${fmt(r2(knownGap + orphan102.monto))}`);
  console.log(`    Remaining: ${fmt(r2(unexplained - orphan102.monto))}`);
}

// ============================================================================
// COMPLETE TABLE OF ALL VENTAS
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('COMPLETE VENTA TABLE');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('Venta          | Envio   | ML Dep      | ML Chrg     | ML NET      | Sys In      | Sys Out     | Sys NET     | DISC');
console.log('───────────────┼─────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼────────────');
for (const v of ventaAnalysis) {
  const d = v.disc === 0 ? '  OK' : `${v.disc > 0 ? '+' : ''}${fmt(v.disc)}`;
  console.log(`${v.numVenta.padEnd(15)}| ${(v.metodoEnvio||'?').padEnd(7)} | ${fmt(v.mlDeposit).padEnd(11)} | ${fmt(v.mlCharges).padEnd(11)} | ${fmt(v.mlNet).padEnd(11)} | ${fmt(v.sysIngresos).padEnd(11)} | ${fmt(v.sysEgresos).padEnd(11)} | ${fmt(v.sysNet).padEnd(11)} | ${d}`);
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('DONE');
console.log('═══════════════════════════════════════════════════════════════');
