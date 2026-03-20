/**
 * ML Payment Audit Script
 *
 * Compares what ML actually deposited (net_received_amount) vs what the
 * system recorded as ingreso to MercadoPago for each order.
 *
 * Usage: node scripts/ml-payment-audit.mjs
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env var set
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const https = await import('https');
const http = await import('http');

function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          } else {
            resolve(JSON.parse(data));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const MP_ACCOUNT_ID = 'geEs98tz955mVjYNct8M';
const DELAY_MS = 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Get ML Access Token ───────────────────────────────────────────
async function getAccessToken() {
  const tokenDoc = await db.collection('mlConfig').doc('tokens').get();
  if (!tokenDoc.exists) {
    throw new Error('No token doc found at mlConfig/tokens');
  }
  const data = tokenDoc.data();
  const accessToken = data.accessToken;
  if (!accessToken) {
    throw new Error('accessToken field is empty in mlConfig/tokens');
  }

  // Check expiry
  const expiresAt = data.expiresAt?.toDate?.() || data.expiresAt;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    console.warn('⚠ Token appears expired (expiresAt:', expiresAt, ')');
    console.warn('  Please refresh the token from the frontend before running this script.');
    console.warn('  Continuing anyway — API calls may fail with 401.\n');
  }

  return accessToken;
}

// ─── ML API call with error handling ───────────────────────────────
async function mlGet(url, token) {
  try {
    const resp = await fetchJSON(url, { Authorization: `Bearer ${token}` });
    return resp;
  } catch (err) {
    if (err.message?.includes('401')) {
      throw new Error('401 Unauthorized — token expired. Refresh from frontend first.');
    }
    if (err.message?.includes('404')) {
      return null; // order/payment not found
    }
    console.error(`  API error for ${url}: ${err.response?.status || err.message}`);
    return null;
  }
}

// ─── Main ──────────────────────────────────────────────────────────
const token = await getAccessToken();
console.log('✓ Access token loaded\n');

// 1. Get all mlOrderSync docs (skip ignorada/duplicada)
const syncSnap = await db.collection('mlOrderSync').get();
const allSyncs = [];
for (const d of syncSnap.docs) {
  const data = d.data();
  if (data.estado === 'ignorada' || data.estado === 'duplicada') continue;
  allSyncs.push({ id: d.id, ...data });
}
console.log(`Found ${allSyncs.size || allSyncs.length} mlOrderSync docs (after filtering ignorada/duplicada)\n`);

// 2. Get all movimientosTesoreria to MP account (ingreso type)
const movSnap = await db.collection('movimientosTesoreria')
  .where('cuentaDestino', '==', MP_ACCOUNT_ID)
  .get();
const ingresoMovsByVenta = {};
const ingresoMovsByCotizacion = {};
let totalSystemIngresos = 0;
for (const m of movSnap.docs) {
  const d = m.data();
  const monto = d.montoPEN || d.monto || 0;
  if (d.ventaId) {
    if (!ingresoMovsByVenta[d.ventaId]) ingresoMovsByVenta[d.ventaId] = [];
    ingresoMovsByVenta[d.ventaId].push({ id: m.id, monto, concepto: d.concepto, tipo: d.tipo });
  }
  if (d.cotizacionId) {
    if (!ingresoMovsByCotizacion[d.cotizacionId]) ingresoMovsByCotizacion[d.cotizacionId] = [];
    ingresoMovsByCotizacion[d.cotizacionId].push({ id: m.id, monto, concepto: d.concepto, tipo: d.tipo });
  }
  totalSystemIngresos += monto;
}
console.log(`Total ingreso movements to MP: ${movSnap.size} (S/ ${totalSystemIngresos.toFixed(2)})\n`);

// Also get egreso movements FROM MP
const egresoSnap = await db.collection('movimientosTesoreria')
  .where('cuentaOrigenId', '==', MP_ACCOUNT_ID)
  .get();
let totalSystemEgresos = 0;
const egresosByConcepto = {};
for (const m of egresoSnap.docs) {
  const d = m.data();
  const monto = d.montoPEN || d.monto || 0;
  totalSystemEgresos += monto;
  const key = (d.concepto || 'sin concepto').substring(0, 40);
  if (!egresosByConcepto[key]) egresosByConcepto[key] = { count: 0, total: 0 };
  egresosByConcepto[key].count++;
  egresosByConcepto[key].total += monto;
}

// Get transfers involving MP
const transfersToSnap = await db.collection('movimientosTesoreria')
  .where('cuentaOrigenId', '==', MP_ACCOUNT_ID)
  .where('tipo', '==', 'transferencia')
  .get();
let totalTransfersOut = 0;
for (const m of transfersToSnap.docs) {
  totalTransfersOut += m.data().montoPEN || m.data().monto || 0;
}

// ─── Process each order ────────────────────────────────────────────
console.log('=' .repeat(120));
console.log('VENTA       | ML Order ID   | ML net_received | System ingreso | DISC       | Fees');
console.log('-'.repeat(120));

let totalMLNet = 0;
let totalSystemPerOrder = 0;
let totalDisc = 0;
let ordersProcessed = 0;
let ordersWithDisc = 0;
let errors = [];
const processedPaymentIds = new Set(); // avoid double-counting pack payments

for (const sync of allSyncs) {
  const mlOrderId = sync.mlOrderId;
  const ventaId = sync.ventaId;
  const ventaNum = sync.numeroVenta || '(no venta)';

  if (!mlOrderId) {
    console.log(`${ventaNum.padEnd(12)}| (no mlOrderId) | skipped`);
    continue;
  }

  // Call ML order API
  await sleep(DELAY_MS);
  const orderData = await mlGet(`https://api.mercadolibre.com/orders/${mlOrderId}`, token);
  if (!orderData) {
    errors.push({ ventaNum, mlOrderId, error: 'Order API returned null' });
    console.log(`${ventaNum.padEnd(12)}| ${String(mlOrderId).padEnd(14)}| ERROR: order not found`);
    continue;
  }

  // Get payments from order
  const payments = orderData.payments || [];
  const approvedPayments = payments.filter(p => p.status === 'approved');

  let orderNetReceived = 0;
  let feesSummary = [];

  for (const payment of approvedPayments) {
    const paymentId = payment.id;

    // Skip if already processed (pack orders share payments across sub-orders)
    if (processedPaymentIds.has(paymentId)) {
      continue;
    }
    processedPaymentIds.add(paymentId);

    // Call payment detail API
    await sleep(DELAY_MS);
    const paymentData = await mlGet(`https://api.mercadolibre.com/collections/${paymentId}`, token);

    if (paymentData) {
      const netReceived = paymentData.net_received_amount || paymentData.transaction_details?.net_received_amount || 0;
      orderNetReceived += netReceived;

      // Extract fees
      const fees = paymentData.fee_details || [];
      for (const fee of fees) {
        feesSummary.push(`${fee.type}:${fee.amount}`);
      }
    } else {
      // Fallback: try /v1/payments endpoint
      const paymentDataV1 = await mlGet(`https://api.mercadolibre.com/v1/payments/${paymentId}`, token);
      if (paymentDataV1) {
        const netReceived = paymentDataV1.net_received_amount || paymentDataV1.transaction_details?.net_received_amount || 0;
        orderNetReceived += netReceived;
        const fees = paymentDataV1.fee_details || [];
        for (const fee of fees) {
          feesSummary.push(`${fee.type}:${fee.amount}`);
        }
      } else {
        errors.push({ ventaNum, mlOrderId, paymentId, error: 'Payment API returned null' });
        feesSummary.push('(payment fetch failed)');
      }
    }
  }

  // System ingreso for this venta
  let systemIngreso = 0;
  const ventaMovs = ventaId ? (ingresoMovsByVenta[ventaId] || []) : [];
  for (const mov of ventaMovs) {
    systemIngreso += mov.monto;
  }

  // Also check by cotizacionId if venta has one
  if (ventaId && systemIngreso === 0) {
    // Try to get the venta doc to find cotizacionId
    const ventaDoc = await db.collection('ventas').doc(ventaId).get();
    if (ventaDoc.exists) {
      const cotId = ventaDoc.data().cotizacionId;
      if (cotId) {
        const cotMovs = ingresoMovsByCotizacion[cotId] || [];
        for (const mov of cotMovs) {
          systemIngreso += mov.monto;
        }
      }
    }
  }

  const disc = systemIngreso - orderNetReceived;

  totalMLNet += orderNetReceived;
  totalSystemPerOrder += systemIngreso;
  totalDisc += disc;
  ordersProcessed++;
  if (Math.abs(disc) > 0.01) ordersWithDisc++;

  const discStr = Math.abs(disc) > 0.01 ? `${disc >= 0 ? '+' : ''}${disc.toFixed(2)}` : 'OK';
  const feesStr = feesSummary.length > 0 ? feesSummary.join(', ') : '-';

  console.log(
    `${ventaNum.padEnd(12)}| ${String(mlOrderId).padEnd(14)}| S/ ${orderNetReceived.toFixed(2).padStart(10)} | S/ ${systemIngreso.toFixed(2).padStart(10)} | ${discStr.padStart(10)} | ${feesStr}`
  );
}

// ─── Summary ───────────────────────────────────────────────────────
console.log('='.repeat(120));
console.log('\n═══ SUMMARY ═══');
console.log(`Orders processed:          ${ordersProcessed}`);
console.log(`Orders with discrepancy:   ${ordersWithDisc}`);
console.log(`\nTotal ML net_received:      S/ ${totalMLNet.toFixed(2)}`);
console.log(`Total system ingresos (per order): S/ ${totalSystemPerOrder.toFixed(2)}`);
console.log(`Total system ingresos (to MP):     S/ ${totalSystemIngresos.toFixed(2)}`);
console.log(`Total system egresos (from MP):    S/ ${totalSystemEgresos.toFixed(2)}`);
console.log(`Total transfers out of MP:         S/ ${totalTransfersOut.toFixed(2)}`);

console.log('\n--- Egresos breakdown ---');
for (const [concepto, data] of Object.entries(egresosByConcepto)) {
  console.log(`  ${concepto.padEnd(42)} x${String(data.count).padStart(3)} = S/ ${data.total.toFixed(2)}`);
}

const expectedSaldo = totalMLNet - totalTransfersOut;
const actualSaldo = 1816.15;
const gap = actualSaldo - expectedSaldo;

console.log('\n--- Saldo Analysis ---');
console.log(`Expected saldo (ML net - transfers):  S/ ${expectedSaldo.toFixed(2)}`);
console.log(`Actual saldo:                         S/ ${actualSaldo.toFixed(2)}`);
console.log(`Gap:                                  S/ ${gap.toFixed(2)}`);

if (errors.length > 0) {
  console.log(`\n--- Errors (${errors.length}) ---`);
  for (const e of errors) {
    console.log(`  ${e.ventaNum} | mlOrder=${e.mlOrderId} | payment=${e.paymentId || '-'} | ${e.error}`);
  }
}

console.log('\nDone.');
process.exit(0);
