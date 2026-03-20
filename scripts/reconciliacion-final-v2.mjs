/**
 * RECONCILIACIÓN FINAL v2 - Clean, definitive MercadoPago reconciliation
 * Source of truth: mlOrderSync
 * Real balance: S/ 1,816.15 | System saldo: S/ 2,137.65 | Gap: S/ 321.50
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const mpId = 'geEs98tz955mVjYNct8M';
const SALDO_REAL = 1816.15;
const SALDO_SISTEMA = 2137.65;

// ═══════════════════════════════════════════════════════════════════════════
// 1. LOAD ALL DATA
// ═══════════════════════════════════════════════════════════════════════════

console.log('Cargando datos...\n');

// 1a. ALL movements where MP is origin or destination
const [movsDestSnap, movsOrigSnap] = await Promise.all([
  db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get(),
  db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get(),
]);

// Deduplicate (a movement could theoretically have MP as both origin and destination)
const allMovsMap = new Map();
for (const m of movsDestSnap.docs) {
  allMovsMap.set(m.id, { id: m.id, ...m.data(), _isDestino: true, _isOrigen: false });
}
for (const m of movsOrigSnap.docs) {
  if (allMovsMap.has(m.id)) {
    allMovsMap.get(m.id)._isOrigen = true;
  } else {
    allMovsMap.set(m.id, { id: m.id, ...m.data(), _isDestino: false, _isOrigen: true });
  }
}

// Filter out anulados and calculate net saldo
let saldoMovimientos = 0;
const activeMovs = [];
for (const mov of allMovsMap.values()) {
  if (mov.estado === 'anulado') continue;
  activeMovs.push(mov);
  const monto = mov.monto || 0;
  if (mov._isDestino && !mov._isOrigen) saldoMovimientos += monto;
  else if (mov._isOrigen && !mov._isDestino) saldoMovimientos -= monto;
  // If both (self-transfer), net zero
}

// Group ingresos by ventaId, egresos by gastoId
const ingresosByVenta = new Map();
const egresosByGasto = new Map();
const allMPMovs = []; // For tracking orphans

for (const mov of activeMovs) {
  if (mov._isDestino) {
    if (mov.ventaId) {
      if (!ingresosByVenta.has(mov.ventaId)) ingresosByVenta.set(mov.ventaId, []);
      ingresosByVenta.get(mov.ventaId).push(mov);
    }
  }
  if (mov._isOrigen) {
    if (mov.gastoId) {
      if (!egresosByGasto.has(mov.gastoId)) egresosByGasto.set(mov.gastoId, []);
      egresosByGasto.get(mov.gastoId).push(mov);
    }
  }
  allMPMovs.push(mov);
}

// 1b. ALL mlOrderSync (skip ignorada/duplicada)
const syncsSnap = await db.collection('mlOrderSync').get();
const syncs = [];
for (const s of syncsSnap.docs) {
  const sd = s.data();
  if (sd.estado === 'ignorada' || sd.estado === 'duplicada') continue;
  syncs.push({ id: s.id, ...sd });
}

// Group syncs by ventaId (with pack deduplication logic)
const syncsByVenta = new Map();
for (const s of syncs) {
  if (!s.ventaId) continue;
  if (!syncsByVenta.has(s.ventaId)) syncsByVenta.set(s.ventaId, []);
  syncsByVenta.get(s.ventaId).push(s);
}

// 1c. ALL ventas
const ventasSnap = await db.collection('ventas').get();
const ventasById = new Map();
for (const v of ventasSnap.docs) ventasById.set(v.id, { id: v.id, ...v.data() });

// 1d. ALL gastos (non-anulado, with ventaId)
const gastosSnap = await db.collection('gastos').get();
const gastosByVenta = new Map();
const gastosById = new Map();
for (const g of gastosSnap.docs) {
  const gd = { id: g.id, ...g.data() };
  gastosById.set(g.id, gd);
  if (gd.ventaId && gd.estado !== 'anulado') {
    if (!gastosByVenta.has(gd.ventaId)) gastosByVenta.set(gd.ventaId, []);
    gastosByVenta.get(gd.ventaId).push(gd);
  }
}

// 1e. ALL entregas
const entregasSnap = await db.collection('entregas').get();
const entregasByVenta = new Map();
for (const e of entregasSnap.docs) {
  const ed = { id: e.id, ...e.data() };
  if (ed.ventaId) {
    if (!entregasByVenta.has(ed.ventaId)) entregasByVenta.set(ed.ventaId, []);
    entregasByVenta.get(ed.ventaId).push(ed);
  }
}

console.log(`Movimientos activos MP: ${activeMovs.length}`);
console.log(`Saldo calculado desde movimientos: S/ ${saldoMovimientos.toFixed(2)}`);
console.log(`Syncs activos: ${syncs.length}`);
console.log(`Ventas con syncs: ${syncsByVenta.size}`);
console.log(`Ventas con ingresos MP: ${ingresosByVenta.size}`);

// ═══════════════════════════════════════════════════════════════════════════
// 2. HELPER: Get the correct sync for a venta (pack dedup)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * For pack orders, there may be DUPLICATE syncs (regular ml-order-* + pack ml-pack-*).
 * Use ONLY the pack sync to avoid double-counting commissions.
 * For non-pack orders, use the single sync.
 */
function getCanonicalSync(ventaSyncs) {
  if (!ventaSyncs || ventaSyncs.length === 0) return null;

  // Check if any sync has a packId
  const packSync = ventaSyncs.find(s => s.packId || s.id.startsWith('ml-pack-'));
  if (packSync) return packSync;

  // Check if any sync is a sub-order of a pack (has packId but is not the pack sync)
  // In this case, the pack sync might be linked to a different ventaId
  // Use the first non-pack sync
  return ventaSyncs[0];
}

/**
 * Get total comision from syncs, handling pack dedup.
 * If there's a pack sync, use ONLY its comision (it already consolidates sub-orders).
 * Otherwise sum all syncs (should be just one).
 */
function getComisionFromSyncs(ventaSyncs) {
  const packSync = ventaSyncs.find(s => s.packId || s.id.startsWith('ml-pack-'));
  if (packSync) {
    // Pack sync already has consolidated comision
    return packSync.comisionML || 0;
  }
  // Non-pack: sum (usually just one)
  return ventaSyncs.reduce((sum, s) => sum + (s.comisionML || 0), 0);
}

function getCargoEnvioFromSyncs(ventaSyncs) {
  const packSync = ventaSyncs.find(s => s.packId || s.id.startsWith('ml-pack-'));
  if (packSync) {
    return packSync.cargoEnvioML || 0;
  }
  return ventaSyncs.reduce((sum, s) => sum + (s.cargoEnvioML || 0), 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. ANALYZE EACH VENTA WITH MP MOVEMENTS
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(80));
console.log('ANALISIS VENTA POR VENTA');
console.log('='.repeat(80) + '\n');

const EXCLUDE_VENTA_NUM = 'VT-2026-037'; // Confirmed 2-part payment: S/158 bank + S/7.25 MP

const discrepancies = [];
const okVentas = [];

// Get all ventaIds that have MP involvement (ingresos or syncs)
const ventaIdsToCheck = new Set([...ingresosByVenta.keys(), ...syncsByVenta.keys()]);

for (const ventaId of ventaIdsToCheck) {
  const venta = ventasById.get(ventaId);
  if (!venta) continue;
  const num = venta.numeroVenta || ventaId;

  // Skip VT-2026-037
  if (num === EXCLUDE_VENTA_NUM) {
    console.log(`SKIP ${num} (confirmed 2-part payment: bank + MP)`);
    continue;
  }

  const ventaSyncs = syncsByVenta.get(ventaId) || [];
  if (ventaSyncs.length === 0) continue; // No sync = not an ML order, skip

  const canonicalSync = getCanonicalSync(ventaSyncs);
  if (!canonicalSync) continue;

  const metodo = canonicalSync.metodoEnvio || venta.metodoEnvio || '?';
  const totalML = canonicalSync.totalML || 0;
  const costoEnvioCliente = canonicalSync.costoEnvioCliente || 0;
  const comisionMLExpected = getComisionFromSyncs(ventaSyncs);
  const cargoEnvioMLExpected = getCargoEnvioFromSyncs(ventaSyncs);

  // Has pack sync?
  const hasPack = ventaSyncs.some(s => s.packId || s.id.startsWith('ml-pack-'));
  const hasMultipleSyncs = ventaSyncs.length > 1;

  // 3a. Calculate CORRECT ingreso
  let ingresoExpected;
  if (metodo === 'flex') {
    // Flex: ML deposits totalML + costoEnvioCliente (product price + bonificacion)
    ingresoExpected = totalML + costoEnvioCliente;
  } else {
    // Urbano: ML deposits totalML (handles shipping separately)
    ingresoExpected = totalML;
  }

  // 3b. ACTUAL ingreso from movements
  const ingresos = ingresosByVenta.get(ventaId) || [];
  const ingresoActual = ingresos.reduce((s, m) => s + (m.monto || 0), 0);

  // 3c. ACTUAL egresos (comision + cargo_envio) from gastos linked to this venta
  const gastos = gastosByVenta.get(ventaId) || [];
  let comisionActual = 0;
  let cargoEnvioActual = 0;
  let deliveryActual = 0;

  for (const g of gastos) {
    // Only count movements that actually come FROM MP
    const gMovs = egresosByGasto.get(g.id) || [];
    const mpEgreso = gMovs.reduce((s, m) => s + (m.monto || 0), 0);

    if (g.tipo === 'comision_ml') comisionActual += mpEgreso;
    else if (g.tipo === 'cargo_envio_ml') cargoEnvioActual += mpEgreso;
    else if (g.tipo === 'delivery') deliveryActual += mpEgreso;
  }

  // For Urbano: delivery payments may cover cargo_envio
  const cargoEfectivo = cargoEnvioActual + deliveryActual;

  // 3d. Calculate discrepancies
  const diffIngreso = Math.round((ingresoActual - ingresoExpected) * 100) / 100;
  const diffComision = Math.round((comisionActual - comisionMLExpected) * 100) / 100;

  let cargoFaltante = 0;
  if (metodo === 'urbano' && cargoEnvioMLExpected > 0) {
    cargoFaltante = Math.round((cargoEnvioMLExpected - cargoEfectivo) * 100) / 100;
    if (cargoFaltante < 0.50) cargoFaltante = 0;
  }

  const hasIssue = Math.abs(diffIngreso) > 0.50 || Math.abs(diffComision) > 0.50 || cargoFaltante > 0.50;

  if (hasIssue) {
    const disc = {
      num, ventaId, metodo, hasPack, hasMultipleSyncs,
      syncsCount: ventaSyncs.length,
      syncIds: ventaSyncs.map(s => s.id),
      ingresoActual, ingresoExpected, diffIngreso,
      comisionActual, comisionExpected: comisionMLExpected, diffComision,
      cargoEfectivo, cargoExpected: cargoEnvioMLExpected, cargoFaltante,
      totalML, costoEnvioCliente,
      fixes: [],
    };

    if (Math.abs(diffIngreso) > 0.50) {
      const direction = diffIngreso > 0 ? 'REDUCIR' : 'AUMENTAR';
      disc.fixes.push({
        tipo: diffIngreso > 0 ? 'ingreso_inflado' : 'ingreso_faltante',
        label: `Ingreso: S/${ingresoActual.toFixed(2)} -> S/${ingresoExpected.toFixed(2)} (${direction} S/${Math.abs(diffIngreso).toFixed(2)})`,
        impacto: -diffIngreso, // positive = reduces saldo, negative = increases
      });
    }

    if (Math.abs(diffComision) > 0.50) {
      const faltante = comisionMLExpected - comisionActual;
      disc.fixes.push({
        tipo: 'comision_faltante',
        label: `Comision: actual S/${comisionActual.toFixed(2)} vs expected S/${comisionMLExpected.toFixed(2)} (falta S/${faltante.toFixed(2)})`,
        impacto: -faltante, // missing comision = saldo should be lower
      });
    }

    if (cargoFaltante > 0.50) {
      disc.fixes.push({
        tipo: 'cargo_envio_faltante',
        label: `Cargo envio: actual S/${cargoEfectivo.toFixed(2)} vs expected S/${cargoEnvioMLExpected.toFixed(2)} (falta S/${cargoFaltante.toFixed(2)})`,
        impacto: -cargoFaltante,
      });
    }

    discrepancies.push(disc);

    const packNote = hasPack ? ' [PACK]' : '';
    const multiNote = hasMultipleSyncs ? ` [${ventaSyncs.length} syncs]` : '';
    console.log(`!! ${num} (${metodo})${packNote}${multiNote}`);
    for (const f of disc.fixes) {
      console.log(`   ${f.label}`);
    }
  } else {
    okVentas.push({ num, metodo, ingresoActual, comisionActual, cargoEfectivo });
  }
}

console.log(`\nVentas OK: ${okVentas.length}`);
console.log(`Ventas con discrepancias: ${discrepancies.length}`);

// ═══════════════════════════════════════════════════════════════════════════
// 4. CHECK FIX A: MOV-2026-0088 (artificial Flex adjustment)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(80));
console.log('FIX A: AJUSTE FLEX ARTIFICIAL (MOV-2026-0088)');
console.log('='.repeat(80) + '\n');

let fixA_monto = 0;
const ajusteFlexQ = await db.collection('movimientosTesoreria')
  .where('numeroMovimiento', '==', 'MOV-2026-0088').get();
for (const m of ajusteFlexQ.docs) {
  const d = m.data();
  if (d.estado !== 'anulado' && d.cuentaDestino === mpId) {
    fixA_monto = d.monto || 0;
    console.log(`  MOV-2026-0088: +S/${fixA_monto} | ${d.concepto || 'N/A'}`);
    console.log(`  ACCION: Anular este movimiento -> reduce saldo en S/${fixA_monto}`);
  }
}
if (fixA_monto === 0) {
  console.log('  MOV-2026-0088 ya esta anulado o no encontrado');
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. CATEGORIZE DISCREPANCIES INTO FIX GROUPS
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(80));
console.log('DISCREPANCIAS POR CATEGORIA');
console.log('='.repeat(80));

// FIX B: Urbano ventas with inflated ingresos (ingreso > totalML)
const fixB = discrepancies.filter(d => d.fixes.some(f => f.tipo === 'ingreso_inflado'));
let fixB_total = 0;
if (fixB.length > 0) {
  console.log(`\n-- FIX B: Ingresos inflados (${fixB.length} ventas) --`);
  for (const d of fixB) {
    const fix = d.fixes.find(f => f.tipo === 'ingreso_inflado');
    console.log(`  ${d.num} (${d.metodo}): ingreso S/${d.ingresoActual.toFixed(2)} -> S/${d.ingresoExpected.toFixed(2)} | reducir S/${Math.abs(d.diffIngreso).toFixed(2)}`);
    fixB_total += d.diffIngreso; // positive = excess ingreso
  }
  console.log(`  Subtotal Fix B: -S/ ${fixB_total.toFixed(2)} (reduce saldo)`);
}

// FIX C: Flex ventas missing bonificacion (ingreso < totalML + costoEnvioCliente)
const fixC = discrepancies.filter(d => d.fixes.some(f => f.tipo === 'ingreso_faltante'));
let fixC_total = 0;
if (fixC.length > 0) {
  console.log(`\n-- FIX C: Ingresos faltantes / bonificacion (${fixC.length} ventas) --`);
  for (const d of fixC) {
    const fix = d.fixes.find(f => f.tipo === 'ingreso_faltante');
    console.log(`  ${d.num} (${d.metodo}): ingreso S/${d.ingresoActual.toFixed(2)} -> S/${d.ingresoExpected.toFixed(2)} | aumentar S/${Math.abs(d.diffIngreso).toFixed(2)}`);
    fixC_total += d.diffIngreso; // negative = missing ingreso
  }
  console.log(`  Subtotal Fix C: +S/ ${Math.abs(fixC_total).toFixed(2)} (aumenta saldo)`);
}

// FIX D: Missing comisiones
const fixD = discrepancies.filter(d => d.fixes.some(f => f.tipo === 'comision_faltante'));
let fixD_total = 0;
if (fixD.length > 0) {
  console.log(`\n-- FIX D: Comisiones faltantes (${fixD.length} ventas) --`);
  for (const d of fixD) {
    const fix = d.fixes.find(f => f.tipo === 'comision_faltante');
    const faltante = d.comisionExpected - d.comisionActual;
    const packWarning = d.hasPack ? ' [PACK - using consolidated comision]' : '';
    const multiWarning = d.hasMultipleSyncs && !d.hasPack ? ` [WARNING: ${d.syncsCount} syncs, NO pack - possible false positive]` : '';
    console.log(`  ${d.num} (${d.metodo}): comision actual S/${d.comisionActual.toFixed(2)} vs expected S/${d.comisionExpected.toFixed(2)} | falta S/${faltante.toFixed(2)}${packWarning}${multiWarning}`);
    if (d.hasMultipleSyncs && !d.hasPack) {
      console.log(`    SYNC IDs: ${d.syncIds.join(', ')}`);
      console.log(`    -> POSSIBLE FALSE POSITIVE from duplicate syncs, EXCLUDE from fix`);
    } else {
      fixD_total += faltante;
    }
  }
  console.log(`  Subtotal Fix D (confirmed only): -S/ ${fixD_total.toFixed(2)} (reduce saldo)`);
}

// FIX E: Missing cargo_envio for Urbano
const fixE = discrepancies.filter(d => d.fixes.some(f => f.tipo === 'cargo_envio_faltante'));
let fixE_total = 0;
if (fixE.length > 0) {
  console.log(`\n-- FIX E: Cargo envio faltante - Urbano (${fixE.length} ventas) --`);
  for (const d of fixE) {
    const fix = d.fixes.find(f => f.tipo === 'cargo_envio_faltante');
    console.log(`  ${d.num} (${d.metodo}): cargo actual S/${d.cargoEfectivo.toFixed(2)} vs expected S/${d.cargoExpected.toFixed(2)} | falta S/${d.cargoFaltante.toFixed(2)}`);
    fixE_total += d.cargoFaltante;
  }
  console.log(`  Subtotal Fix E: -S/ ${fixE_total.toFixed(2)} (reduce saldo)`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. PROJECTION
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(80));
console.log('RESUMEN DE CORRECCIONES Y PROYECCION');
console.log('='.repeat(80) + '\n');

console.log('Saldo sistema (movimientos):'.padEnd(45) + `S/ ${SALDO_SISTEMA.toFixed(2)}`);
console.log('Saldo calculado (verificacion):'.padEnd(45) + `S/ ${saldoMovimientos.toFixed(2)}`);
if (Math.abs(saldoMovimientos - SALDO_SISTEMA) > 0.50) {
  console.log('  !! Saldo calculado difiere del sistema !!');
}

console.log('');
console.log('Correcciones:');

const corrections = [];

if (fixA_monto > 0) {
  corrections.push({ label: 'Fix A: Anular MOV-2026-0088 (ajuste Flex)', amount: -fixA_monto });
  console.log(`  Fix A: Anular MOV-2026-0088 (ajuste Flex)`.padEnd(55) + `-S/ ${fixA_monto.toFixed(2)}`);
}

if (fixB_total > 0) {
  corrections.push({ label: 'Fix B: Reducir ingresos inflados (Urbano)', amount: -fixB_total });
  console.log(`  Fix B: Reducir ingresos inflados (Urbano)`.padEnd(55) + `-S/ ${fixB_total.toFixed(2)}`);
}

if (fixC_total < 0) {
  corrections.push({ label: 'Fix C: Aumentar ingresos faltantes (Flex bonif)', amount: -fixC_total }); // -negative = positive
  console.log(`  Fix C: Aumentar ingresos (Flex bonificacion)`.padEnd(55) + `+S/ ${Math.abs(fixC_total).toFixed(2)}`);
}

if (fixD_total > 0) {
  corrections.push({ label: 'Fix D: Agregar comisiones faltantes', amount: -fixD_total });
  console.log(`  Fix D: Agregar comisiones faltantes`.padEnd(55) + `-S/ ${fixD_total.toFixed(2)}`);
}

if (fixE_total > 0) {
  corrections.push({ label: 'Fix E: Agregar cargo envio faltante (Urbano)', amount: -fixE_total });
  console.log(`  Fix E: Agregar cargo envio faltante (Urbano)`.padEnd(55) + `-S/ ${fixE_total.toFixed(2)}`);
}

const totalCorrection = corrections.reduce((s, c) => s + c.amount, 0);
const saldoProjected = SALDO_SISTEMA + totalCorrection;
const gap = saldoProjected - SALDO_REAL;

console.log(`${'─'.repeat(65)}`);
console.log(`  Total correccion neta:`.padEnd(55) + `${totalCorrection >= 0 ? '+' : '-'}S/ ${Math.abs(totalCorrection).toFixed(2)}`);
console.log('');
console.log(`Saldo proyectado post-fix:`.padEnd(45) + `S/ ${saldoProjected.toFixed(2)}`);
console.log(`Saldo real MercadoPago:`.padEnd(45) + `S/ ${SALDO_REAL.toFixed(2)}`);
console.log(`Gap residual:`.padEnd(45) + `S/ ${gap.toFixed(2)}`);

if (Math.abs(gap) < 5) {
  console.log(`\nCUADRE LOGRADO - Diferencia < S/ 5 (redondeos aceptables)`);
} else if (Math.abs(gap) < 20) {
  console.log(`\nCASI CUADRADO - Gap pequeno de S/ ${gap.toFixed(2)}`);
  console.log('Posibles causas:');
  console.log('  - Redondeos acumulados en multiples transacciones');
  console.log('  - Diferencias de timing en depositos ML');
} else {
  console.log(`\nGAP SIGNIFICATIVO de S/ ${gap.toFixed(2)} por investigar`);
  console.log('Posibles causas:');
  console.log('  - Ventas Flex tempranas sin costoEnvioCliente en sync');
  console.log('  - VT-2026-037 pago mixto (S/158 banco + S/7.25 MP)');
  console.log('  - Diferencias entre delivery registrado y cargoEnvioML real');
  console.log('  - Comisiones de pack orders contadas doble por syncs duplicados');
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. DETAILED BREAKDOWN TABLE
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(80));
console.log('TABLA DETALLADA DE DISCREPANCIAS');
console.log('='.repeat(80) + '\n');

console.log(
  'Venta'.padEnd(14) +
  'Metodo'.padEnd(8) +
  'IngActual'.padEnd(11) +
  'IngExpect'.padEnd(11) +
  'DiffIng'.padEnd(10) +
  'ComAct'.padEnd(9) +
  'ComExp'.padEnd(9) +
  'CargoF'.padEnd(9) +
  'Pack'.padEnd(5)
);
console.log('-'.repeat(86));

for (const d of discrepancies) {
  console.log(
    d.num.padEnd(14) +
    d.metodo.padEnd(8) +
    `${d.ingresoActual.toFixed(2)}`.padEnd(11) +
    `${d.ingresoExpected.toFixed(2)}`.padEnd(11) +
    `${d.diffIngreso.toFixed(2)}`.padEnd(10) +
    `${d.comisionActual.toFixed(2)}`.padEnd(9) +
    `${d.comisionExpected.toFixed(2)}`.padEnd(9) +
    `${d.cargoFaltante.toFixed(2)}`.padEnd(9) +
    (d.hasPack ? 'Si' : '-').padEnd(5)
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. PACK ORDER ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(80));
console.log('ANALISIS PACK ORDERS (deduplicacion)');
console.log('='.repeat(80) + '\n');

const packVentas = ['VT-2026-057', 'VT-2026-059', 'VT-2026-060', 'VT-2026-061', 'VT-2026-062'];

for (const pvNum of packVentas) {
  // Find ventaId by numero
  let pvId = null;
  for (const [vid, vdata] of ventasById) {
    if (vdata.numeroVenta === pvNum) { pvId = vid; break; }
  }
  if (!pvId) { console.log(`  ${pvNum}: venta no encontrada`); continue; }

  const ventaSyncs = syncsByVenta.get(pvId) || [];
  console.log(`  ${pvNum} (${ventaSyncs.length} syncs):`);
  for (const s of ventaSyncs) {
    const isPack = s.packId || s.id.startsWith('ml-pack-');
    console.log(`    ${s.id} | comision: S/${(s.comisionML || 0).toFixed(2)} | cargo: S/${(s.cargoEnvioML || 0).toFixed(2)} | ${isPack ? 'PACK (usar)' : 'regular (ignorar si hay pack)'}`);
  }

  const comUsed = getComisionFromSyncs(ventaSyncs);
  const cargoUsed = getCargoEnvioFromSyncs(ventaSyncs);
  console.log(`    -> Usando: comision S/${comUsed.toFixed(2)}, cargo S/${cargoUsed.toFixed(2)}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. FLEX VENTAS WITH costoEnvioCliente = 0 (possible missing bonificacion)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(80));
console.log('VENTAS FLEX CON costoEnvioCliente=0 EN SYNC');
console.log('='.repeat(80) + '\n');

let countMissingBonif = 0;
for (const [ventaId, ventaSyncs] of syncsByVenta) {
  const venta = ventasById.get(ventaId);
  if (!venta) continue;
  const sync = getCanonicalSync(ventaSyncs);
  if (!sync) continue;
  const metodo = sync.metodoEnvio || venta.metodoEnvio || '?';
  if (metodo !== 'flex') continue;
  if ((sync.costoEnvioCliente || 0) === 0) {
    const ingresos = ingresosByVenta.get(ventaId) || [];
    const ingreso = ingresos.reduce((s, m) => s + (m.monto || 0), 0);
    console.log(`  ${venta.numeroVenta}: ingreso=S/${ingreso.toFixed(2)} totalML=S/${(sync.totalML || 0).toFixed(2)} costoEnvio=0`);
    countMissingBonif++;
  }
}
console.log(`  Total: ${countMissingBonif} ventas Flex sin bonificacion en sync`);

// ═══════════════════════════════════════════════════════════════════════════
// 10. ORPHAN MOVEMENTS (no ventaId, no gastoId - unlinked)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(80));
console.log('MOVIMIENTOS HUERFANOS (sin ventaId ni gastoId)');
console.log('='.repeat(80) + '\n');

let orphanIngresos = 0;
let orphanEgresos = 0;
for (const mov of activeMovs) {
  const hasLink = mov.ventaId || mov.gastoId || mov.tipo === 'transferencia_interna';
  if (hasLink) continue;
  const monto = mov.monto || 0;
  const dir = mov._isDestino ? '+' : '-';
  if (mov._isDestino) orphanIngresos += monto;
  if (mov._isOrigen) orphanEgresos += monto;
  console.log(`  ${mov.numeroMovimiento || mov.id} | ${dir}S/${monto.toFixed(2)} | ${(mov.concepto || 'N/A').substring(0, 60)} | tipo: ${mov.tipo || 'N/A'}`);
}
console.log(`  Total ingresos huerfanos: +S/ ${orphanIngresos.toFixed(2)}`);
console.log(`  Total egresos huerfanos:  -S/ ${orphanEgresos.toFixed(2)}`);

console.log('\n' + '='.repeat(80));
console.log('FIN RECONCILIACION FINAL v2');
console.log('='.repeat(80));
