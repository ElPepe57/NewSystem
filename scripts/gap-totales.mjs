import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const MP_ID = 'geEs98tz955mVjYNct8M';

// ─── Part 1: ML Reality from mlOrderSync ───
const mlSyncSnap = await db.collection('mlOrderSync').get();
const allSyncDocs = mlSyncSnap.docs.map(d => ({ id: d.id, ...d.data() }));

// Deduplicate by mlOrderId
const byMlOrderId = new Map();
const estadoPriority = { procesada: 0, pendiente: 1 };
for (const doc of allSyncDocs) {
  const key = doc.mlOrderId || doc.id;
  const existing = byMlOrderId.get(key);
  if (!existing) {
    byMlOrderId.set(key, doc);
  } else {
    const existingP = estadoPriority[existing.estado] ?? 99;
    const newP = estadoPriority[doc.estado] ?? 99;
    if (newP < existingP) byMlOrderId.set(key, doc);
  }
}

const uniqueOrders = [...byMlOrderId.values()];
let TOTAL_ML_DEPOSITS = 0;
let TOTAL_ML_COMMISSIONS = 0;
let TOTAL_ML_CARGO = 0;

const orderDetails = [];
for (const o of uniqueOrders) {
  const total = o.totalML || 0;
  const comision = o.comisionML || 0;
  const cargo = o.cargoEnvioML || 0;
  const costoEnvioCliente = o.costoEnvioCliente || 0;
  const metodo = o.metodoEnvio || '';
  const isFlex = metodo.toLowerCase().includes('flex') || metodo.toLowerCase().includes('mercado envíos flex');
  const deposit = isFlex ? total + costoEnvioCliente : total;

  TOTAL_ML_DEPOSITS += deposit;
  TOTAL_ML_COMMISSIONS += comision;
  TOTAL_ML_CARGO += cargo;

  orderDetails.push({
    id: o.id,
    mlOrderId: o.mlOrderId,
    ventaId: o.ventaId,
    estado: o.estado,
    totalML: total,
    comisionML: comision,
    cargoEnvioML: cargo,
    costoEnvioCliente,
    metodoEnvio: metodo,
    deposit
  });
}

const ML_NET = TOTAL_ML_DEPOSITS - TOTAL_ML_COMMISSIONS - TOTAL_ML_CARGO;

// ─── Part 2: System recorded (movimientosTesoreria) ───
const movSnap = await db.collection('movimientosTesoreria').get();
const allMovs = movSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.estado !== 'anulado');

let TOTAL_INGRESOS = 0;
let TOTAL_EGRESOS = 0;
const ingresoMovs = [];
const egresoMovs = [];

for (const m of allMovs) {
  if (m.cuentaDestino === MP_ID) {
    TOTAL_INGRESOS += (m.monto || 0);
    ingresoMovs.push(m);
  }
  if (m.cuentaOrigen === MP_ID) {
    TOTAL_EGRESOS += (m.monto || 0);
    egresoMovs.push(m);
  }
}

// Break down egresos by type - need to check linked gastos
const gastoIds = [...new Set(egresoMovs.map(m => m.gastoId).filter(Boolean))];
const gastoMap = new Map();
const BATCH = 30;
for (let i = 0; i < gastoIds.length; i += BATCH) {
  const batch = gastoIds.slice(i, i + BATCH);
  const snap = await db.collection('gastos').where('__name__', 'in', batch).get();
  snap.docs.forEach(d => gastoMap.set(d.id, d.data()));
}

let egresoComisiones = 0, egresoComisionesN = 0;
let egresoCargo = 0, egresoCargoN = 0;
let egresoDelivery = 0, egresoDeliveryN = 0;
let egresoTransfers = 0, egresoTransfersN = 0;
let egresoOther = 0, egresoOtherN = 0;

for (const m of egresoMovs) {
  const monto = m.monto || 0;
  if (m.tipo === 'transferencia_interna') {
    egresoTransfers += monto; egresoTransfersN++;
  } else if (m.gastoId) {
    const gasto = gastoMap.get(m.gastoId);
    const tipo = gasto?.tipo || '';
    if (tipo === 'comision_ml') { egresoComisiones += monto; egresoComisionesN++; }
    else if (tipo === 'cargo_envio_ml') { egresoCargo += monto; egresoCargoN++; }
    else if (tipo === 'delivery') { egresoDelivery += monto; egresoDeliveryN++; }
    else { egresoOther += monto; egresoOtherN++; }
  } else {
    egresoOther += monto; egresoOtherN++;
  }
}

const SYSTEM_NET = TOTAL_INGRESOS - TOTAL_EGRESOS;

// ─── Part 4: Find orphan ingresos ───
// Build lookup: ventaId → mlOrderSync
const syncByVentaId = new Map();
for (const o of uniqueOrders) {
  if (o.ventaId) syncByVentaId.set(o.ventaId, o);
}

// For ingresos, try to match to ML order
const orphans = [];
const ventaIdsToLookup = [...new Set(ingresoMovs.map(m => m.ventaId).filter(Boolean))];
const cotizacionIdsToLookup = [...new Set(ingresoMovs.map(m => m.cotizacionId).filter(Boolean))];

// Fetch ventas to get mlOrderSync link
const ventaMap = new Map();
for (let i = 0; i < ventaIdsToLookup.length; i += BATCH) {
  const batch = ventaIdsToLookup.slice(i, i + BATCH);
  const snap = await db.collection('ventas').where('__name__', 'in', batch).get();
  snap.docs.forEach(d => ventaMap.set(d.id, d.data()));
}

// Fetch cotizaciones to get ventaId
const cotizacionMap = new Map();
for (let i = 0; i < cotizacionIdsToLookup.length; i += BATCH) {
  const batch = cotizacionIdsToLookup.slice(i, i + BATCH);
  const snap = await db.collection('cotizaciones').where('__name__', 'in', batch).get();
  snap.docs.forEach(d => cotizacionMap.set(d.id, d.data()));
}

for (const m of ingresoMovs) {
  let matched = false;

  // Path 1: ventaId → mlOrderSync by ventaId
  if (m.ventaId && syncByVentaId.has(m.ventaId)) {
    matched = true;
  }

  // Path 2: cotizacionId → cotizacion → ventaId → mlOrderSync
  if (!matched && m.cotizacionId) {
    const cot = cotizacionMap.get(m.cotizacionId);
    if (cot?.ventaId && syncByVentaId.has(cot.ventaId)) {
      matched = true;
    }
  }

  // Path 3: ventaId on the movement → check if venta has mercadoLibreId
  if (!matched && m.ventaId) {
    const venta = ventaMap.get(m.ventaId);
    if (venta?.mercadoLibreId || venta?.mlOrderSyncId) {
      matched = true;
    }
  }

  if (!matched) {
    orphans.push({
      id: m.id,
      monto: m.monto || 0,
      concepto: m.concepto || m.descripcion || '(sin concepto)',
      ventaId: m.ventaId || null,
      cotizacionId: m.cotizacionId || null,
      tipo: m.tipo || null,
      fecha: m.fecha?.toDate?.()?.toISOString?.()?.slice(0, 10) || ''
    });
  }
}

const orphanTotal = orphans.reduce((s, o) => s + o.monto, 0);

// ─── Part 3: RECONCILIATION OUTPUT ───
const fmt = (n) => `S/ ${n.toFixed(2)}`;

console.log(`
${'═'.repeat(70)}
  GAP TOTALES: ML Reality vs System
${'═'.repeat(70)}

=== ML REALITY (from ${allSyncDocs.length} mlOrderSync docs, ${uniqueOrders.length} unique orders) ===
Total ML deposits to MP:        ${fmt(TOTAL_ML_DEPOSITS).padStart(14)} (${uniqueOrders.length} unique orders)
Total ML commissions:           ${fmt(TOTAL_ML_COMMISSIONS).padStart(14)}
Total ML cargo envio:           ${fmt(TOTAL_ML_CARGO).padStart(14)}
ML NET (what should flow to MP):${fmt(ML_NET).padStart(14)}

=== SYSTEM RECORDED (movimientosTesoreria) ===
Total ingresos to MP:           ${fmt(TOTAL_INGRESOS).padStart(14)} (${ingresoMovs.length} movements)
Total egresos from MP:          ${fmt(TOTAL_EGRESOS).padStart(14)} (${egresoMovs.length} movements)
  - Commissions:                ${fmt(egresoComisiones).padStart(14)} (${egresoComisionesN})
  - Cargo envio:                ${fmt(egresoCargo).padStart(14)} (${egresoCargoN})
  - Delivery:                   ${fmt(egresoDelivery).padStart(14)} (${egresoDeliveryN})
  - Transfers to bank:          ${fmt(egresoTransfers).padStart(14)} (${egresoTransfersN})
  - Other:                      ${fmt(egresoOther).padStart(14)} (${egresoOtherN})
SYSTEM NET:                     ${fmt(SYSTEM_NET).padStart(14)}

=== COMPARISON (excluding transfers, which are real money out) ===
System ingresos:                ${fmt(TOTAL_INGRESOS).padStart(14)}
ML deposits:                    ${fmt(TOTAL_ML_DEPOSITS).padStart(14)}
EXCESS INGRESOS:                ${fmt(TOTAL_INGRESOS - TOTAL_ML_DEPOSITS).padStart(14)} (system recorded more deposits than ML made)

System commission egresos:      ${fmt(egresoComisiones).padStart(14)}
ML commissions:                 ${fmt(TOTAL_ML_COMMISSIONS).padStart(14)}
MISSING COMMISSION EGRESOS:     ${fmt(TOTAL_ML_COMMISSIONS - egresoComisiones).padStart(14)} (ML charged more than system recorded)

System cargo+delivery egresos:  ${fmt(egresoCargo + egresoDelivery).padStart(14)}
ML cargo envio:                 ${fmt(TOTAL_ML_CARGO).padStart(14)}
MISSING CARGO EGRESOS:          ${fmt(TOTAL_ML_CARGO - (egresoCargo + egresoDelivery)).padStart(14)}

Non-ML ingresos (orphans):      ${fmt(orphanTotal).padStart(14)} (${orphans.length} movements)
${'─'.repeat(70)}
TOTAL OVERSTATEMENT:            ${fmt((TOTAL_INGRESOS - TOTAL_ML_DEPOSITS) + (TOTAL_ML_COMMISSIONS - egresoComisiones) + (TOTAL_ML_CARGO - (egresoCargo + egresoDelivery))).padStart(14)}
REAL GAP:                       ${fmt(SYSTEM_NET - ML_NET).padStart(14)}
MATCH:                          ${((1 - Math.abs(SYSTEM_NET - ML_NET) / Math.abs(ML_NET)) * 100).toFixed(2)}%
`);

// ─── Part 4: List orphan ingresos ───
if (orphans.length > 0) {
  console.log(`\n=== ORPHAN INGRESOS (${orphans.length} movements not matched to any ML order) ===`);
  orphans.sort((a, b) => b.monto - a.monto);
  for (const o of orphans) {
    console.log(`  ${fmt(o.monto).padStart(12)}  ${o.concepto.substring(0, 50).padEnd(50)}  ventaId=${o.ventaId || '-'}  fecha=${o.fecha}`);
  }
  console.log(`  ${'─'.repeat(60)}`);
  console.log(`  TOTAL ORPHANS: ${fmt(orphanTotal)}`);
}

process.exit(0);
