/**
 * RECONCILIACIÓN API FINAL
 * Uses ML API to get REAL net_received_amount per order,
 * then reconciles against the system.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';
const REAL_SALDO = 1816.15;

const httpsModule = await import('https');

function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = httpsModule.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        else resolve(JSON.parse(data));
      });
    });
    req.on('error', reject);
  });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══ 1. Read ML access token ═══
console.log('Reading ML access token...');
const tokenDoc = await db.collection('mlConfig').doc('tokens').get();
if (!tokenDoc.exists) { console.error('No mlConfig/tokens doc found!'); process.exit(1); }
const accessToken = tokenDoc.data().accessToken;
console.log(`Token: ${accessToken.substring(0, 20)}...`);

// ═══ 2. Get ALL mlOrderSync (including ignorada/duplicada) ═══
console.log('\nLoading ALL mlOrderSync docs...');
const syncsSnap = await db.collection('mlOrderSync').get();
const allSyncs = [];
for (const s of syncsSnap.docs) {
  allSyncs.push({ id: s.id, ...s.data() });
}
console.log(`Total mlOrderSync docs: ${allSyncs.length}`);

// ═══ 3. Collect ALL unique mlOrderIds ═══
const allMLOrderIds = new Set();
for (const s of allSyncs) {
  if (s.mlOrderId) allMLOrderIds.add(Number(s.mlOrderId));
  if (s.subOrderIds && Array.isArray(s.subOrderIds)) {
    for (const sub of s.subOrderIds) allMLOrderIds.add(Number(sub));
  }
}

// Ensure VT-062 orders are included
allMLOrderIds.add(2000015447990598);
allMLOrderIds.add(2000015447992492);

console.log(`Unique mlOrderIds to fetch: ${allMLOrderIds.size}`);

// ═══ 4. Fetch each order from ML API, extract payments ═══
const processedPaymentIds = new Set();
const paymentsByOrderId = new Map(); // mlOrderId -> [{paymentId, net_received_amount, status}]
let totalNetReceived = 0;
let apiErrors = [];
let fetched = 0;

const headers = { Authorization: `Bearer ${accessToken}` };

for (const orderId of allMLOrderIds) {
  fetched++;
  if (fetched % 10 === 0) console.log(`  Fetching order ${fetched}/${allMLOrderIds.size}...`);

  try {
    const order = await fetchJSON(`https://api.mercadolibre.com/orders/${orderId}`, headers);
    const orderPayments = [];

    if (order.payments && Array.isArray(order.payments)) {
      for (const p of order.payments) {
        if (p.status === 'approved') {
          const pid = Number(p.id);
          const netAmount = p.net_received_amount || p.total_paid_amount || 0;
          orderPayments.push({ paymentId: pid, net_received_amount: netAmount, status: p.status });

          if (!processedPaymentIds.has(pid)) {
            processedPaymentIds.add(pid);
            totalNetReceived += netAmount;
          }
        }
      }
    }

    paymentsByOrderId.set(orderId, orderPayments);
  } catch (err) {
    apiErrors.push({ orderId, error: err.message });
    paymentsByOrderId.set(orderId, []);
  }

  await delay(500);
}

console.log(`\nAPI fetch complete. Errors: ${apiErrors.length}`);
if (apiErrors.length > 0) {
  for (const e of apiErrors) console.log(`  ERROR order ${e.orderId}: ${e.error}`);
}

// ═══ 5. Build mapping: ventaId -> unique payments (net_received) ═══
// First build sync lookup: mlOrderId -> sync doc
const syncByMLId = new Map();
const syncsByVentaId = new Map();
for (const s of allSyncs) {
  if (s.mlOrderId) syncByMLId.set(Number(s.mlOrderId), s);
  if (s.ventaId) {
    if (!syncsByVentaId.has(s.ventaId)) syncsByVentaId.set(s.ventaId, []);
    syncsByVentaId.get(s.ventaId).push(s);
  }
}

// For each ventaId, collect all mlOrderIds (main + sub-orders)
const mlOrderIdsByVenta = new Map();
for (const [ventaId, syncs] of syncsByVentaId) {
  const orderIds = new Set();
  for (const s of syncs) {
    if (s.mlOrderId) orderIds.add(Number(s.mlOrderId));
    if (s.subOrderIds && Array.isArray(s.subOrderIds)) {
      for (const sub of s.subOrderIds) orderIds.add(Number(sub));
    }
  }
  mlOrderIdsByVenta.set(ventaId, orderIds);
}

// Compute net_received per venta (unique payments only)
const netReceivedByVenta = new Map();
for (const [ventaId, orderIds] of mlOrderIdsByVenta) {
  const seenPayments = new Set();
  let ventaNet = 0;
  for (const oid of orderIds) {
    const payments = paymentsByOrderId.get(oid) || [];
    for (const p of payments) {
      if (!seenPayments.has(p.paymentId)) {
        seenPayments.add(p.paymentId);
        ventaNet += p.net_received_amount;
      }
    }
  }
  netReceivedByVenta.set(ventaId, { net: ventaNet, paymentCount: seenPayments.size });
}

// ═══ 6. Get ALL movimientosTesoreria touching MP ═══
console.log('\nLoading movimientos tesoreria...');
const movsDestSnap = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();
const movsOrigSnap = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();

const allIngresos = [];
const allEgresos = [];
const ingresosByVenta = new Map();
const egresosByCategory = { comision: 0, cargo_delivery: 0, transfers: 0, other: 0 };
let totalIngresos = 0;
let totalEgresos = 0;

// Also load ventas for cotizacionId resolution
const ventasSnap = await db.collection('ventas').get();
const ventasById = new Map();
const ventaByCotizacion = new Map();
for (const v of ventasSnap.docs) {
  const vd = v.data();
  ventasById.set(v.id, { id: v.id, ...vd });
  if (vd.cotizacionId) ventaByCotizacion.set(vd.cotizacionId, v.id);
}

for (const m of movsDestSnap.docs) {
  const d = m.data();
  if (d.estado === 'anulado') continue;
  const monto = d.monto || 0;
  totalIngresos += monto;
  allIngresos.push({ id: m.id, ...d });

  let ventaId = d.ventaId;
  if (!ventaId && d.cotizacionId) ventaId = ventaByCotizacion.get(d.cotizacionId);
  if (ventaId) {
    if (!ingresosByVenta.has(ventaId)) ingresosByVenta.set(ventaId, []);
    ingresosByVenta.get(ventaId).push({ id: m.id, ...d });
  }
}

// Load gastos for categorization
const gastosSnap = await db.collection('gastos').get();
const gastosById = new Map();
for (const g of gastosSnap.docs) {
  gastosById.set(g.id, { id: g.id, ...g.data() });
}

let transferTotal = 0;
let deliveryEgresoTotal = 0;
let otherEgresoTotal = 0;
let comisionEgresoTotal = 0;
let cargoEgresoTotal = 0;

for (const m of movsOrigSnap.docs) {
  const d = m.data();
  if (d.estado === 'anulado') continue;
  const monto = d.monto || 0;
  totalEgresos += monto;
  allEgresos.push({ id: m.id, ...d });

  // Categorize
  const concepto = (d.concepto || '').toLowerCase();
  const gasto = d.gastoId ? gastosById.get(d.gastoId) : null;
  const gastoTipo = gasto ? (gasto.tipo || '') : '';

  if (d.tipo === 'transferencia' || concepto.includes('transfer') || concepto.includes('retiro')) {
    transferTotal += monto;
    egresosByCategory.transfers += monto;
  } else if (gastoTipo === 'comision_ml' || concepto.includes('comisi')) {
    comisionEgresoTotal += monto;
    egresosByCategory.comision += monto;
  } else if (gastoTipo === 'cargo_envio_ml' || gastoTipo === 'delivery' || concepto.includes('envío') || concepto.includes('envio') || concepto.includes('delivery') || concepto.includes('urbano')) {
    deliveryEgresoTotal += monto;
    egresosByCategory.cargo_delivery += monto;
  } else {
    otherEgresoTotal += monto;
    egresosByCategory.other += monto;
  }
}

// ═══ 7. Group ingresos/egresos by ventaId for per-venta comparison ═══
// Build egresos by ventaId through gastos
const egresosByVenta = new Map();
for (const eg of allEgresos) {
  const gasto = eg.gastoId ? gastosById.get(eg.gastoId) : null;
  if (gasto && gasto.ventaId) {
    if (!egresosByVenta.has(gasto.ventaId)) egresosByVenta.set(gasto.ventaId, []);
    egresosByVenta.get(gasto.ventaId).push({ ...eg, gastoTipo: gasto.tipo || '' });
  }
}

// ═══ 8. Non-ML ingresos (movements to MP without a matching ML venta) ═══
let nonMLIngresos = 0;
for (const ing of allIngresos) {
  let ventaId = ing.ventaId;
  if (!ventaId && ing.cotizacionId) ventaId = ventaByCotizacion.get(ing.cotizacionId);
  if (!ventaId || !netReceivedByVenta.has(ventaId)) {
    nonMLIngresos += (ing.monto || 0);
  }
}

// ═══ 9. OUTPUT ═══
console.log('\n');
console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('               RECONCILIACIÓN API FINAL - ML vs SISTEMA');
console.log('═══════════════════════════════════════════════════════════════════════════════');

console.log('\n=== ML API DATA (source of truth) ===');
console.log(`Total net_received (unique payments): S/ ${totalNetReceived.toFixed(2)}`);
console.log(`Number of unique payments: ${processedPaymentIds.size}`);
console.log(`Orders fetched: ${allMLOrderIds.size}, API errors: ${apiErrors.length}`);

console.log('\n=== SYSTEM DATA ===');
console.log(`Total ingresos to MP: S/ ${totalIngresos.toFixed(2)} (${allIngresos.length} movements)`);
console.log(`Total egresos from MP: S/ ${totalEgresos.toFixed(2)}`);
console.log(`  Comisiones: S/ ${comisionEgresoTotal.toFixed(2)}`);
console.log(`  Cargo/Delivery: S/ ${deliveryEgresoTotal.toFixed(2)}`);
console.log(`  Transfers: S/ ${transferTotal.toFixed(2)}`);
console.log(`  Other: S/ ${otherEgresoTotal.toFixed(2)}`);
console.log(`SALDO SISTEMA: S/ ${(totalIngresos - totalEgresos).toFixed(2)}`);

console.log('\n=== RECONCILIATION ===');
console.log(`ML total net_received:                S/ ${totalNetReceived.toFixed(2)} (this is what ML put into your MP)`);
console.log(`(-) Transfers to bank:                S/ ${transferTotal.toFixed(2)}`);
console.log(`(-) Delivery paid from MP:            S/ ${deliveryEgresoTotal.toFixed(2)} (courier payments for Urbano)`);
console.log(`(-) Other egresos:                    S/ ${otherEgresoTotal.toFixed(2)}`);
console.log(`(+) Non-ML ingresos:                  S/ ${nonMLIngresos.toFixed(2)} (orphan movements)`);
const expectedSaldo = totalNetReceived - transferTotal - deliveryEgresoTotal - otherEgresoTotal + nonMLIngresos;
console.log('═══════════════════════════════════════');
console.log(`EXPECTED SALDO:                       S/ ${expectedSaldo.toFixed(2)}`);
console.log(`REAL SALDO:                           S/ ${REAL_SALDO.toFixed(2)}`);
console.log(`RESIDUAL:                             S/ ${(REAL_SALDO - expectedSaldo).toFixed(2)}`);

// ═══ 10. Per-venta discrepancies ═══
console.log('\n\n═══════════════════════════════════════════════════════════════════════════════');
console.log('               PER-VENTA DISCREPANCIES (|disc| > 0.50)');
console.log('═══════════════════════════════════════════════════════════════════════════════');

const discrepancies = [];

for (const [ventaId, mlData] of netReceivedByVenta) {
  const venta = ventasById.get(ventaId);
  const num = venta ? (venta.numeroVenta || ventaId) : ventaId;

  const mlRealDeposit = mlData.net;

  // System ingresos for this venta
  const sysIngresos = (ingresosByVenta.get(ventaId) || []).reduce((s, m) => s + (m.monto || 0), 0);

  // System egresos for this venta (comisiones + cargo + delivery)
  const sysEgresosArr = egresosByVenta.get(ventaId) || [];
  let sysComision = 0, sysCargo = 0;
  for (const eg of sysEgresosArr) {
    if (eg.gastoTipo === 'comision_ml') sysComision += (eg.monto || 0);
    else if (eg.gastoTipo === 'cargo_envio_ml' || eg.gastoTipo === 'delivery') sysCargo += (eg.monto || 0);
  }

  const systemNet = sysIngresos - sysComision - sysCargo;
  const disc = Math.round((systemNet - mlRealDeposit) * 100) / 100;

  if (Math.abs(disc) > 0.50) {
    discrepancies.push({ num, ventaId, mlRealDeposit, sysIngresos, sysComision, sysCargo, systemNet, disc });
  }
}

// Sort by absolute discrepancy descending
discrepancies.sort((a, b) => Math.abs(b.disc) - Math.abs(a.disc));

if (discrepancies.length === 0) {
  console.log('No discrepancies found!');
} else {
  console.log(`Found ${discrepancies.length} ventas with discrepancies:\n`);
  console.log('Venta          | ML Real Dep | Sys Ingreso | Sys Com   | Sys Cargo | Sys Net   | DISC');
  console.log('─'.repeat(95));

  let totalDisc = 0;
  for (const d of discrepancies) {
    totalDisc += d.disc;
    const line = [
      d.num.padEnd(14),
      `S/ ${d.mlRealDeposit.toFixed(2).padStart(8)}`,
      `S/ ${d.sysIngresos.toFixed(2).padStart(8)}`,
      `S/ ${d.sysComision.toFixed(2).padStart(7)}`,
      `S/ ${d.sysCargo.toFixed(2).padStart(7)}`,
      `S/ ${d.systemNet.toFixed(2).padStart(8)}`,
      `S/ ${d.disc > 0 ? '+' : ''}${d.disc.toFixed(2).padStart(8)}`,
    ].join(' | ');
    console.log(line);
  }
  console.log('─'.repeat(95));
  console.log(`TOTAL DISCREPANCY: S/ ${totalDisc.toFixed(2)}`);
}

// ═══ 11. VT-062 detail ═══
console.log('\n\n── VT-062 DETAIL (pack order) ──');
const vt062Syncs = allSyncs.filter(s => (s.numeroVenta || '').includes('062'));
for (const s of vt062Syncs) {
  console.log(`  Sync: ${s.id} | estado: ${s.estado} | mlOrderId: ${s.mlOrderId} | packId: ${s.packId || 'N/A'} | subOrderIds: ${JSON.stringify(s.subOrderIds || [])}`);
}
const order1 = paymentsByOrderId.get(2000015447990598);
const order2 = paymentsByOrderId.get(2000015447992492);
console.log(`  Order 2000015447990598 payments: ${JSON.stringify(order1)}`);
console.log(`  Order 2000015447992492 payments: ${JSON.stringify(order2)}`);

console.log('\n\nDone.');
process.exit(0);
