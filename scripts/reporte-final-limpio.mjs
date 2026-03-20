/**
 * REPORTE FORENSE DEFINITIVO - MercadoPago Reconciliación
 * ========================================================
 * Objetivo: Explicar cada sol del gap de S/ 321.50
 *   Sistema: S/ 2,137.65 | Real: S/ 1,816.15
 *
 * Enfoque: NO computar totales ML (pack dedup unreliable).
 *   1. Calcular saldo sistema desde movimientos
 *   2. Para cada venta con movimientos MP, calcular discrepancia individual
 *   3. Sumar discrepancias + huérfanos = gap
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';
const SALDO_REAL = 1816.15;

const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => `S/ ${r2(n).toFixed(2)}`;
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

// ============================================================================
// LOAD ALL DATA
// ============================================================================
console.log('Cargando datos...\n');

const [mlSyncsSnap, ventasSnap, gastosSnap, movsOSnap, movsDSnap, entregasSnap, cotizacionesSnap] = await Promise.all([
  db.collection('mlOrderSync').get(),
  db.collection('ventas').get(),
  db.collection('gastos').get(),
  db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get(),
  db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get(),
  db.collection('entregas').get(),
  db.collection('cotizaciones').get(),
]);

// Maps
const ventaMap = new Map();
for (const d of ventasSnap.docs) ventaMap.set(d.id, { id: d.id, ...d.data() });

const gastoMap = new Map();
for (const d of gastosSnap.docs) gastoMap.set(d.id, { id: d.id, ...d.data() });

const entregaMap = new Map();
for (const d of entregasSnap.docs) entregaMap.set(d.id, { id: d.id, ...d.data() });

// cotizacion -> ventaId (for resolving MOV-0102 style cases)
const cotToVentaId = new Map();
for (const d of cotizacionesSnap.docs) {
  const data = d.data();
  if (data.ventaId) cotToVentaId.set(d.id, data.ventaId);
}

// Dedup movements (a mov can appear in both queries if MP is both origen and destino)
const allMovs = new Map();
for (const m of movsOSnap.docs) allMovs.set(m.id, { id: m.id, d: m.data(), esOrigen: true, esDestino: false });
for (const m of movsDSnap.docs) {
  if (allMovs.has(m.id)) allMovs.get(m.id).esDestino = true;
  else allMovs.set(m.id, { id: m.id, d: m.data(), esOrigen: false, esDestino: true });
}
const activeMovs = [...allMovs.values()].filter(m => m.d.estado !== 'anulado');

// ============================================================================
// SECTION A: SYSTEM OVERVIEW - compute saldo from movements
// ============================================================================

let totalIngresosMP = 0, countIngresos = 0;
let totalEgresosMP = 0, countEgresos = 0;
let egresoComisiones = 0, egresoCargoEnvio = 0, egresoDelivery = 0, egresoTransferencias = 0, egresoOtros = 0;

for (const mov of activeMovs) {
  const d = mov.d;
  const monto = d.monto || 0;

  if (d.tipo === 'transferencia_interna') {
    if (mov.esOrigen && !mov.esDestino) { totalEgresosMP += monto; countEgresos++; egresoTransferencias += monto; }
    else if (mov.esDestino && !mov.esOrigen) { totalIngresosMP += monto; countIngresos++; }
  } else if (mov.esDestino && !mov.esOrigen) {
    totalIngresosMP += monto; countIngresos++;
  } else if (mov.esOrigen && !mov.esDestino) {
    totalEgresosMP += monto; countEgresos++;
    const concepto = (d.concepto || '').toLowerCase();
    if (concepto.includes('omisi')) egresoComisiones += monto;
    else if (concepto.includes('argo env') || concepto.includes('cargo envío')) egresoCargoEnvio += monto;
    else if (concepto.includes('elivery') || concepto.includes('entrega') || concepto.includes('envío') || concepto.includes('envio')) egresoDelivery += monto;
    else egresoOtros += monto;
  }
}

const SALDO_SISTEMA = r2(totalIngresosMP - totalEgresosMP);

console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
console.log('║               REPORTE FORENSE DEFINITIVO - MERCADOPAGO                       ║');
console.log('║               Fecha: 2026-03-14                                               ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');

console.log('\n══════════════════════════════════════════════════════════════');
console.log('SECCIÓN A: PANORAMA DEL SISTEMA');
console.log('══════════════════════════════════════════════════════════════\n');

console.log(`  Ingresos totales a MP:       ${padL(fmt(totalIngresosMP), 14)}  (${countIngresos} movimientos)`);
console.log(`  Egresos totales de MP:       ${padL(fmt(totalEgresosMP), 14)}  (${countEgresos} movimientos)`);
console.log(`    Comisiones:                ${padL(fmt(egresoComisiones), 14)}`);
console.log(`    Cargo envío:               ${padL(fmt(egresoCargoEnvio), 14)}`);
console.log(`    Delivery:                  ${padL(fmt(egresoDelivery), 14)}`);
console.log(`    Transferencias a banco:    ${padL(fmt(egresoTransferencias), 14)}`);
console.log(`    Otros:                     ${padL(fmt(egresoOtros), 14)}`);
console.log('  ─────────────────────────────────────────────');
console.log(`  SALDO SISTEMA:               ${padL(fmt(SALDO_SISTEMA), 14)}`);
console.log(`  SALDO REAL MP:               ${padL(fmt(SALDO_REAL), 14)}`);
console.log(`  GAP (sistema - real):        ${padL(fmt(SALDO_SISTEMA - SALDO_REAL), 14)}`);

// ============================================================================
// BUILD INDICES for movement attribution
// ============================================================================

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

// Gastos and entregas by ventaId
const gastosByVentaId = new Map();
for (const [gid, g] of gastoMap) {
  if (g.ventaId) {
    if (!gastosByVentaId.has(g.ventaId)) gastosByVentaId.set(g.ventaId, []);
    gastosByVentaId.get(g.ventaId).push(g);
  }
}

const entregasByVentaId = new Map();
for (const [eid, e] of entregaMap) {
  if (e.ventaId) {
    if (!entregasByVentaId.has(e.ventaId)) entregasByVentaId.set(e.ventaId, []);
    entregasByVentaId.get(e.ventaId).push(e);
  }
}

// ============================================================================
// BUILD ML SYNC DATA per ventaId
// ============================================================================

const allSyncs = mlSyncsSnap.docs.map(s => ({ id: s.id, ...s.data() }));

// Group ALL syncs by ventaId (we need all of them for commission computation)
const allSyncsByVentaId = new Map();
for (const sd of allSyncs) {
  if (!sd.ventaId) continue;
  if (!allSyncsByVentaId.has(sd.ventaId)) allSyncsByVentaId.set(sd.ventaId, []);
  allSyncsByVentaId.get(sd.ventaId).push(sd);
}

/**
 * For each ventaId, determine the ML NET that MP actually deposited/charged.
 * Returns { mlDeposit, mlCommissions, mlCargo, mlNet, metodoEnvio, mainSync }
 */
function computeMLNet(ventaId) {
  const syncs = allSyncsByVentaId.get(ventaId);
  if (!syncs || syncs.length === 0) return null;

  // Find the MAIN sync: prefer ml-pack-*, then procesada with highest totalML, then pendiente
  let mainSync = null;
  for (const s of syncs) {
    if (s.id.startsWith('ml-pack-') && s.estado !== 'duplicada') { mainSync = s; break; }
  }
  if (!mainSync) {
    const procesadas = syncs.filter(s => s.estado === 'procesada');
    const pendientes = syncs.filter(s => s.estado === 'pendiente');
    if (procesadas.length > 0) {
      mainSync = procesadas.reduce((a, b) => (b.totalML || 0) > (a.totalML || 0) ? b : a);
    } else if (pendientes.length > 0) {
      mainSync = pendientes.reduce((a, b) => (b.totalML || 0) > (a.totalML || 0) ? b : a);
    } else {
      // ignorada or error only - pick first non-duplicada
      mainSync = syncs.find(s => s.estado !== 'duplicada') || syncs[0];
    }
  }

  const totalML = mainSync.totalML || 0;
  const costoEnvioCliente = mainSync.costoEnvioCliente || 0;
  const metodoEnvio = mainSync.metodoEnvio || null;
  const cargoEnvioML = mainSync.cargoEnvioML || 0;

  // ML deposit: totalML always. Flex adds costoEnvioCliente.
  let mlDeposit = totalML;
  if (metodoEnvio === 'flex') mlDeposit += costoEnvioCliente;

  // Commissions: sum from all non-duplicada syncs with unique mlOrderIds
  const seenOrderIds = new Set();
  let mlCommissions = 0;
  // Process procesada first, then others
  const sortedSyncs = [...syncs].sort((a, b) => {
    if (a.estado === 'procesada' && b.estado !== 'procesada') return -1;
    if (b.estado === 'procesada' && a.estado !== 'procesada') return 1;
    return 0;
  });
  for (const s of sortedSyncs) {
    if (s.estado === 'duplicada') continue;
    const orderId = s.mlOrderId;
    if (orderId && seenOrderIds.has(orderId)) continue;
    if (orderId) seenOrderIds.add(orderId);
    mlCommissions += s.comisionML || 0;
  }

  // Cargo envío: from main sync only (shared shipment for packs)
  const mlCargo = cargoEnvioML;

  const mlNet = r2(mlDeposit - mlCommissions - mlCargo);

  return {
    mlDeposit: r2(mlDeposit),
    mlCommissions: r2(mlCommissions),
    mlCargo: r2(mlCargo),
    mlNet,
    metodoEnvio,
    mainSync,
    totalML, costoEnvioCliente,
    syncCount: syncs.length,
    syncs,
  };
}

// ============================================================================
// PER-VENTA ANALYSIS: find all ventaIds that touch MP
// ============================================================================

const attributedMovIds = new Set();
const ventaAnalysis = [];

// Collect all ventaIds from: movements, ML syncs, cotizacion resolution
const allVentaIds = new Set();

// From movements with ventaId
for (const mov of activeMovs) {
  if (mov.d.ventaId) allVentaIds.add(mov.d.ventaId);
}

// From movements with cotizacionId -> resolve to ventaId
for (const mov of activeMovs) {
  if (mov.d.cotizacionId && !mov.d.ventaId) {
    const resolved = cotToVentaId.get(mov.d.cotizacionId);
    if (resolved) allVentaIds.add(resolved);
  }
}

// From ML syncs
for (const [vid] of allSyncsByVentaId) allVentaIds.add(vid);

for (const ventaId of allVentaIds) {
  const venta = ventaMap.get(ventaId);
  const numVenta = venta?.numeroVenta || ventaId;
  const metodo = venta?.metodoEntrega || '';

  // === Compute system ingresos to MP for this venta ===
  let sysIngresos = 0;
  const sysIngresosDetail = [];
  const usedMovIds = new Set();

  // 1. By ventaId direct
  const ventaMovs = movsByVentaId.get(ventaId) || [];
  for (const mov of ventaMovs) {
    if (mov.esDestino && !mov.esOrigen) {
      sysIngresos += mov.d.monto || 0;
      sysIngresosDetail.push({ id: mov.id, num: mov.d.numeroMovimiento, monto: mov.d.monto, concepto: mov.d.concepto, via: 'ventaId' });
      usedMovIds.add(mov.id);
    }
  }

  // 2. By cotizacionId on venta doc
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

  // 3. By cotizacion doc that has ventaId pointing to this venta (reverse)
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

  // === Compute system egresos from MP for this venta ===
  let sysEgresos = 0;
  const sysEgresosDetail = [];

  // 1. Direct egresos by ventaId
  for (const mov of ventaMovs) {
    if (mov.esOrigen && !mov.esDestino && !usedMovIds.has(mov.id)) {
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
        sysEgresosDetail.push({ id: mov.id, num: mov.d.numeroMovimiento, monto: mov.d.monto, concepto: mov.d.concepto, via: `gasto:${gasto.numeroGasto || gasto.id.substring(0,8)}` });
        usedMovIds.add(mov.id);
      }
    }
  }

  // 3. Via entregas -> gastoDistribucionId (delivery costs)
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

  // === ML NET ===
  const ml = computeMLNet(ventaId);

  const sysNet = r2(sysIngresos - sysEgresos);
  const mlNet = ml ? ml.mlNet : 0;
  const disc = ml ? r2(sysNet - mlNet) : 0;
  const hasML = !!ml;

  // Determine cause of discrepancy
  let causa = '';
  if (Math.abs(disc) <= 0.50) {
    causa = 'OK';
  } else if (!ml) {
    causa = sysIngresos > 0 ? 'sin sync ML (ingreso fantasma)' : 'sin sync ML';
  } else {
    const ingresoGap = r2(sysIngresos - (ml.mlDeposit));
    const egresoGap = r2(sysEgresos - (ml.mlCommissions + ml.mlCargo));
    const parts = [];

    if (ingresoGap > 0.50) {
      if (ml.metodoEnvio === 'urbano' && Math.abs(ingresoGap - ml.mlCargo) < 2) {
        parts.push('ingreso inflado (Urbano, incluye cargo envío)');
      } else {
        parts.push(`ingreso inflado (+${fmt(ingresoGap)})`);
      }
    } else if (ingresoGap < -0.50) {
      if (ml.metodoEnvio === 'flex' && Math.abs(Math.abs(ingresoGap) - ml.costoEnvioCliente) < 2) {
        parts.push('bonificación faltante (Flex)');
      } else {
        parts.push(`ingreso faltante (${fmt(ingresoGap)})`);
      }
    }

    if (egresoGap < -0.50) {
      // System recorded LESS egresos than ML charged -> missing deduction -> saldo inflated
      const missing = r2(Math.abs(egresoGap));
      if (ml.mlCommissions > 0 && sysEgresos < ml.mlCommissions) {
        parts.push(`comisión faltante (-${fmt(missing)})`);
      } else if (ml.mlCargo > 0) {
        parts.push(`cargo faltante (-${fmt(missing)})`);
      } else {
        parts.push(`egreso faltante (-${fmt(missing)})`);
      }
    } else if (egresoGap > 0.50) {
      parts.push(`egreso excedente (+${fmt(egresoGap)})`);
    }

    causa = parts.join(' + ') || 'redondeo';
  }

  ventaAnalysis.push({
    ventaId, numVenta, metodoEnvio: ml?.metodoEnvio || metodo || '?',
    sysIngresos: r2(sysIngresos), sysEgresos: r2(sysEgresos), sysNet,
    mlDeposit: ml?.mlDeposit || 0, mlCharges: r2((ml?.mlCommissions || 0) + (ml?.mlCargo || 0)), mlNet,
    disc, causa, hasML,
    sysIngresosDetail, sysEgresosDetail,
    ml,
  });
}

// Sort by absolute discrepancy
ventaAnalysis.sort((a, b) => Math.abs(b.disc) - Math.abs(a.disc));

// ============================================================================
// SECTION B: DISCREPANCIAS POR VENTA
// ============================================================================

console.log('\n══════════════════════════════════════════════════════════════');
console.log('SECCIÓN B: DISCREPANCIAS POR VENTA');
console.log('══════════════════════════════════════════════════════════════\n');

const significant = ventaAnalysis.filter(v => Math.abs(v.disc) > 0.50 && v.hasML);
const okVentas = ventaAnalysis.filter(v => Math.abs(v.disc) <= 0.50 && v.hasML);
const noML = ventaAnalysis.filter(v => !v.hasML && (v.sysIngresos > 0 || v.sysEgresos > 0));

if (significant.length > 0) {
  console.log('Venta          | Envío   | sysIN       | sysOUT      | sysNET      | mlDEP       | mlCHG       | mlNET       | DISC        | CAUSA');
  console.log('───────────────┼─────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼──────────────────────────');

  for (const v of significant) {
    const d = v.disc > 0 ? `+${fmt(v.disc)}` : fmt(v.disc);
    console.log(
      `${pad(v.numVenta, 15)}| ${pad(v.metodoEnvio, 8)}| ${pad(fmt(v.sysIngresos), 12)}| ${pad(fmt(v.sysEgresos), 12)}| ${pad(fmt(v.sysNet), 12)}| ${pad(fmt(v.mlDeposit), 12)}| ${pad(fmt(v.mlCharges), 12)}| ${pad(fmt(v.mlNet), 12)}| ${pad(d, 12)}| ${v.causa}`
    );
  }

  // Detail for each significant discrepancy
  console.log('\n── Detalle de discrepancias significativas ──\n');
  for (const v of significant) {
    const sign = v.disc > 0 ? '+' : '';
    console.log(`  ${v.numVenta} (${v.metodoEnvio}) — DISC: ${sign}${fmt(v.disc)} — ${v.causa}`);
    for (const i of v.sysIngresosDetail) console.log(`    IN:  ${i.num} ${fmt(i.monto)} [${i.via}] ${(i.concepto || '').substring(0, 55)}`);
    for (const e of v.sysEgresosDetail) console.log(`    OUT: ${e.num} ${fmt(e.monto)} [${e.via}] ${(e.concepto || '').substring(0, 55)}`);
    if (v.ml) {
      console.log(`    ML:  totalML=${fmt(v.ml.totalML)} comisión=${fmt(v.ml.mlCommissions)} cargo=${fmt(v.ml.mlCargo)} costoEnvCliente=${fmt(v.ml.costoEnvioCliente)} (${v.ml.syncCount} syncs)`);
    }
    console.log('');
  }
}

if (okVentas.length > 0) {
  console.log(`\n── Ventas OK (|DISC| <= S/ 0.50): ${okVentas.length} ventas ──`);
  const okLine = okVentas.map(v => v.numVenta).join(', ');
  console.log(`  ${okLine}`);
}

// ============================================================================
// SECTION C: MOVIMIENTOS HUÉRFANOS (no ventaId even after resolution)
// ============================================================================

console.log('\n══════════════════════════════════════════════════════════════');
console.log('SECCIÓN C: MOVIMIENTOS HUÉRFANOS');
console.log('══════════════════════════════════════════════════════════════\n');

const orphanMovs = [];
let orphanIngresos = 0, orphanEgresos = 0;
let transferOut = 0, transferIn = 0;
const transferMovs = [];

for (const mov of activeMovs) {
  if (attributedMovIds.has(mov.id)) continue;
  const d = mov.d;
  const monto = d.monto || 0;

  if (d.tipo === 'transferencia_interna') {
    if (mov.esOrigen && !mov.esDestino) { transferOut += monto; transferMovs.push({ ...mov, efecto: -monto }); }
    else if (mov.esDestino && !mov.esOrigen) { transferIn += monto; transferMovs.push({ ...mov, efecto: +monto }); }
    continue;
  }

  let efecto = 0;
  if (mov.esDestino && !mov.esOrigen) { efecto = +monto; orphanIngresos += monto; }
  else if (mov.esOrigen && !mov.esDestino) { efecto = -monto; orphanEgresos += monto; }

  orphanMovs.push({
    num: d.numeroMovimiento,
    tipo: d.tipo,
    monto,
    efecto,
    concepto: (d.concepto || '').substring(0, 70),
    ventaId: d.ventaId || null,
    cotizacionId: d.cotizacionId || null,
    gastoId: d.gastoId || null,
  });
}

if (orphanMovs.length > 0) {
  for (const m of orphanMovs) {
    const sign = m.efecto >= 0 ? '+' : '';
    console.log(`  ${pad(m.num || 'N/A', 18)} ${sign}${pad(fmt(m.efecto), 14)} [${m.tipo}]`);
    console.log(`    ${m.concepto}`);
    if (m.ventaId) console.log(`    ventaId: ${m.ventaId}`);
    if (m.cotizacionId) console.log(`    cotizacionId: ${m.cotizacionId}`);
    if (m.gastoId) console.log(`    gastoId: ${m.gastoId}`);
    console.log('');
  }
} else {
  console.log('  (ninguno)');
}

console.log(`  Huérfanos ingresos: +${fmt(orphanIngresos)}`);
console.log(`  Huérfanos egresos:  -${fmt(orphanEgresos)}`);
console.log(`  Transferencias OUT: -${fmt(transferOut)}`);
console.log(`  Transferencias IN:  +${fmt(transferIn)}`);

// ============================================================================
// SECTION D: RESUMEN DE CAUSAS
// ============================================================================

console.log('\n══════════════════════════════════════════════════════════════');
console.log('SECCIÓN D: RESUMEN DE CAUSAS');
console.log('══════════════════════════════════════════════════════════════\n');

// Categorize discrepancies
const causas = new Map();

function addCausa(label, monto, ventaNum) {
  if (!causas.has(label)) causas.set(label, { monto: 0, ventas: [] });
  causas.get(label).monto += monto;
  causas.get(label).ventas.push(ventaNum);
}

for (const v of ventaAnalysis) {
  if (Math.abs(v.disc) <= 0.50) continue;
  if (!v.hasML && v.sysIngresos > 0) {
    addCausa('Movimiento fantasma (sin sync ML)', v.disc, v.numVenta);
    continue;
  }
  if (!v.hasML) continue;

  const ml = v.ml;
  const ingresoGap = r2(v.sysIngresos - ml.mlDeposit);
  const egresoGap = r2(v.sysEgresos - (ml.mlCommissions + ml.mlCargo));

  if (ingresoGap > 0.50) {
    if (ml.metodoEnvio === 'urbano') {
      addCausa('Ingreso inflado (Urbano)', ingresoGap, v.numVenta);
    } else {
      addCausa('Ingreso inflado (otro)', ingresoGap, v.numVenta);
    }
  }
  if (ingresoGap < -0.50) {
    if (ml.metodoEnvio === 'flex') {
      addCausa('Bonificación faltante (Flex)', ingresoGap, v.numVenta);
    } else {
      addCausa('Ingreso faltante (otro)', ingresoGap, v.numVenta);
    }
  }
  if (egresoGap < -0.50) {
    addCausa('Comisión/cargo faltante', egresoGap, v.numVenta);
  }
  if (egresoGap > 0.50) {
    addCausa('Egreso excedente', -egresoGap, v.numVenta);
  }
}

// Add orphan contributions
for (const m of orphanMovs) {
  if (m.efecto > 0) addCausa('Movimiento huérfano (ingreso)', m.efecto, m.num);
  else if (m.efecto < 0) addCausa('Movimiento huérfano (egreso)', m.efecto, m.num);
}

let totalExplained = 0;

console.log(`${'CAUSA'.padEnd(42)}| ${'MONTO'.padStart(10)} | VENTAS`);
console.log(`${'─'.repeat(42)}┼${'─'.repeat(12)}┼${'─'.repeat(40)}`);

for (const [label, data] of causas) {
  const m = r2(data.monto);
  totalExplained += m;
  const sign = m >= 0 ? '+' : '';
  console.log(`${pad(label, 42)}| ${padL(`${sign}${r2(m).toFixed(2)}`, 10)} | ${data.ventas.join(', ')}`);
}

console.log(`${'─'.repeat(42)}┼${'─'.repeat(12)}┼${'─'.repeat(40)}`);
const gap = r2(SALDO_SISTEMA - SALDO_REAL);
const residual = r2(gap - totalExplained);
console.log(`${'TOTAL EXPLICADO'.padEnd(42)}| ${padL(`${totalExplained >= 0 ? '+' : ''}${r2(totalExplained).toFixed(2)}`, 10)} |`);
console.log(`${'GAP REAL'.padEnd(42)}| ${padL(r2(gap).toFixed(2), 10)} |`);
console.log(`${'RESIDUAL (redondeos/otros)'.padEnd(42)}| ${padL(r2(residual).toFixed(2), 10)} |`);

// ============================================================================
// SECTION E: VERIFICACIÓN
// ============================================================================

console.log('\n══════════════════════════════════════════════════════════════');
console.log('SECCIÓN E: VERIFICACIÓN');
console.log('══════════════════════════════════════════════════════════════\n');

let sumPositiveDisc = 0, sumNegativeDisc = 0;
for (const v of ventaAnalysis) {
  if (!v.hasML) continue;
  if (v.disc > 0) sumPositiveDisc += v.disc;
  else sumNegativeDisc += v.disc;
}

const netPerVentaDisc = r2(sumPositiveDisc + sumNegativeDisc);

console.log(`  Sum discrepancias positivas:     +${fmt(sumPositiveDisc)}  (inflan saldo)`);
console.log(`  Sum discrepancias negativas:      ${fmt(sumNegativeDisc)}  (deflacionan saldo)`);
console.log(`  Net per-venta DISC:               ${fmt(netPerVentaDisc)}`);
console.log('');
console.log(`  Huérfanos ingresos:              +${fmt(orphanIngresos)}`);
console.log(`  Huérfanos egresos:               -${fmt(orphanEgresos)}`);
console.log(`  Transferencias NET:               ${fmt(r2(transferIn - transferOut))}`);
console.log('');

const totalFromPerVenta = r2(netPerVentaDisc + orphanIngresos - orphanEgresos);
console.log(`  TOTAL EXPLICADO (disc + huérfanos): ${fmt(totalFromPerVenta)}`);
console.log(`  GAP:                                ${fmt(gap)}`);

const coverage = gap !== 0 ? r2((totalFromPerVenta / gap) * 100) : 100;
console.log(`  COVERAGE:                           ${coverage.toFixed(2)}%`);

// ============================================================================
// APPENDIX: Ventas sin movimiento MP (ML syncs sin impacto en tesorería)
// ============================================================================

const noMovVentas = ventaAnalysis.filter(v => v.hasML && v.sysIngresos === 0 && v.sysEgresos === 0);
if (noMovVentas.length > 0) {
  console.log('\n── Ventas ML sin movimientos en MP (no impactan saldo) ──');
  for (const v of noMovVentas) {
    console.log(`  ${v.numVenta} (${v.metodoEnvio}) mlNET=${fmt(v.mlNet)} — sin movimientos tesorería`);
  }
}

// Non-ML ventas with movements
if (noML.length > 0) {
  console.log('\n── Ventas sin sync ML pero con movimientos MP ──');
  for (const v of noML) {
    console.log(`  ${v.numVenta} sysIN=${fmt(v.sysIngresos)} sysOUT=${fmt(v.sysEgresos)} NET=${fmt(v.sysNet)}`);
  }
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log('FIN DEL REPORTE');
console.log('══════════════════════════════════════════════════════════════');
