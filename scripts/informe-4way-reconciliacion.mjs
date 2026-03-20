/**
 * INFORME 4-WAY CROSS-REFERENCE: ML API × MercadoLibre ERP × Ventas ERP × Gastos/Tesorería ERP
 * ================================================================================================
 * Objetivo: Identificar TODAS las inconsistencias con el cuadre de MercadoPago
 *   y generar una lista específica de correcciones.
 *
 * Fuentes:
 *   1. ML API (/payments/{id}) → net_received_amount (lo que ML realmente deposita)
 *   2. MercadoLibre ERP (mlOrderSync) → totalML, comisionML, cargoEnvioML, costoEnvioCliente
 *   3. Ventas ERP → totalPEN, pagos[], estadoPago
 *   4. Gastos + Tesorería ERP → movimientosTesoreria (lo que impacta saldo cuenta)
 *
 * Saldo real MP: S/ 1,816.15 (686.68 disponible + 1,129.47 por liberar)
 *
 * Usage: node scripts/informe-4way-reconciliacion.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
const https = await import('https');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const MP_ACCOUNT_ID = 'geEs98tz955mVjYNct8M';
const SALDO_REAL = 1816.15;
const DELAY_MS = 400;

const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => `S/ ${r2(n).toFixed(2)}`;
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          else resolve(JSON.parse(data));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

async function mlGet(url, token) {
  try {
    return await fetchJSON(url, { Authorization: `Bearer ${token}` });
  } catch (err) {
    if (err.message?.includes('401')) throw new Error('Token expirado — refrescar desde frontend.');
    if (err.message?.includes('404')) return null;
    return null;
  }
}

// ============================================================================
// LOAD ALL DATA
// ============================================================================
console.log('Cargando datos de Firestore...');

const [mlSyncsSnap, ventasSnap, gastosSnap, movsToMPSnap, movsFromMPSnap, entregasSnap, cotizacionesSnap] = await Promise.all([
  db.collection('mlOrderSync').get(),
  db.collection('ventas').get(),
  db.collection('gastos').get(),
  db.collection('movimientosTesoreria').where('cuentaDestino', '==', MP_ACCOUNT_ID).get(),
  db.collection('movimientosTesoreria').where('cuentaOrigen', '==', MP_ACCOUNT_ID).get(),
  db.collection('entregas').get(),
  db.collection('cotizaciones').get(),
]);

// Token ML
const tokenDoc = await db.collection('mlConfig').doc('tokens').get();
const accessToken = tokenDoc.exists ? tokenDoc.data().accessToken : null;
if (!accessToken) {
  console.error('ERROR: No se encontró accessToken en mlConfig/tokens');
  process.exit(1);
}
console.log('✓ Access token cargado');

// Build maps
const ventaMap = new Map();
for (const d of ventasSnap.docs) ventaMap.set(d.id, { id: d.id, ...d.data() });

const gastoMap = new Map();
for (const d of gastosSnap.docs) gastoMap.set(d.id, { id: d.id, ...d.data() });

const entregasByVentaId = new Map();
for (const d of entregasSnap.docs) {
  const data = d.data();
  if (data.ventaId) {
    if (!entregasByVentaId.has(data.ventaId)) entregasByVentaId.set(data.ventaId, []);
    entregasByVentaId.get(data.ventaId).push({ id: d.id, ...data });
  }
}

const cotToVentaId = new Map();
for (const d of cotizacionesSnap.docs) {
  const data = d.data();
  if (data.ventaId) cotToVentaId.set(d.id, data.ventaId);
}

// Dedup movements
const allMovs = new Map();
for (const m of movsToMPSnap.docs) allMovs.set(m.id, { id: m.id, d: m.data(), esDestino: true, esOrigen: false });
for (const m of movsFromMPSnap.docs) {
  if (allMovs.has(m.id)) allMovs.get(m.id).esOrigen = true;
  else allMovs.set(m.id, { id: m.id, d: m.data(), esOrigen: true, esDestino: false });
}
const activeMovs = [...allMovs.values()].filter(m => m.d.estado !== 'anulado');

// Build movement indices
const movsByVentaId = new Map();
const movsByCotizacionId = new Map();
const movsByGastoId = new Map();
for (const mov of activeMovs) {
  const d = mov.d;
  if (d.ventaId) {
    if (!movsByVentaId.has(d.ventaId)) movsByVentaId.set(d.ventaId, []);
    movsByVentaId.get(d.ventaId).push(mov);
  }
  if (d.cotizacionId) {
    if (!movsByCotizacionId.has(d.cotizacionId)) movsByCotizacionId.set(d.cotizacionId, []);
    movsByCotizacionId.get(d.cotizacionId).push(mov);
  }
  if (d.gastoId) {
    if (!movsByGastoId.has(d.gastoId)) movsByGastoId.set(d.gastoId, []);
    movsByGastoId.get(d.gastoId).push(mov);
  }
}

// Build gastos by ventaId
const gastosByVentaId = new Map();
for (const [gid, g] of gastoMap) {
  if (g.ventaId) {
    if (!gastosByVentaId.has(g.ventaId)) gastosByVentaId.set(g.ventaId, []);
    gastosByVentaId.get(g.ventaId).push(g);
  }
}

// Build mlOrderSync indices
const allSyncs = mlSyncsSnap.docs.map(s => ({ id: s.id, ...s.data() }));
const syncsByVentaId = new Map();
for (const s of allSyncs) {
  if (!s.ventaId) continue;
  if (!syncsByVentaId.has(s.ventaId)) syncsByVentaId.set(s.ventaId, []);
  syncsByVentaId.get(s.ventaId).push(s);
}

console.log(`Datos cargados: ${ventaMap.size} ventas, ${allSyncs.length} syncs ML, ${activeMovs.length} movimientos activos MP\n`);

// ============================================================================
// STEP 1: Compute system saldo from movements
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
const GAP = r2(SALDO_SISTEMA - SALDO_REAL);

// ============================================================================
// STEP 2: For each ML venta, call ML API and cross-reference all 4 sources
// ============================================================================

// Collect all ventaIds that touch MP
const allVentaIds = new Set();
for (const mov of activeMovs) {
  if (mov.d.ventaId) allVentaIds.add(mov.d.ventaId);
  if (mov.d.cotizacionId && !mov.d.ventaId) {
    const resolved = cotToVentaId.get(mov.d.cotizacionId);
    if (resolved) allVentaIds.add(resolved);
  }
}
for (const [vid] of syncsByVentaId) allVentaIds.add(vid);

// Process each venta
const results = [];
const processedPaymentIds = new Set();
let apiCallCount = 0;

console.log(`Procesando ${allVentaIds.size} ventas con ML API...\n`);

for (const ventaId of allVentaIds) {
  const venta = ventaMap.get(ventaId);
  const numVenta = venta?.numeroVenta || ventaId.substring(0, 12);
  const syncs = syncsByVentaId.get(ventaId) || [];

  // ─── SOURCE 1: ML API (net_received_amount) ───
  let mlApiNetReceived = 0;
  let mlApiFees = [];
  let mlApiPayments = [];
  let mlApiError = null;

  // Collect all mlOrderIds from syncs (including ignorada for pack sub-orders)
  const orderIds = [...new Set(syncs.map(s => s.mlOrderId).filter(Boolean))];

  for (const orderId of orderIds) {
    await sleep(DELAY_MS);
    apiCallCount++;
    const orderData = await mlGet(`https://api.mercadolibre.com/orders/${orderId}`, accessToken);
    if (!orderData) { mlApiError = `Order ${orderId} not found`; continue; }

    const payments = (orderData.payments || []).filter(p => p.status === 'approved');
    for (const payment of payments) {
      if (processedPaymentIds.has(payment.id)) continue;
      processedPaymentIds.add(payment.id);

      await sleep(DELAY_MS);
      apiCallCount++;
      const payData = await mlGet(`https://api.mercadolibre.com/collections/${payment.id}`, accessToken);
      if (payData) {
        const net = payData.net_received_amount || payData.transaction_details?.net_received_amount || 0;
        mlApiNetReceived += net;
        mlApiPayments.push({ paymentId: payment.id, net, transactionAmount: payData.transaction_amount || payment.total_paid_amount });
        for (const fee of (payData.fee_details || [])) {
          mlApiFees.push({ type: fee.type, amount: fee.amount });
        }
      } else {
        // Fallback
        const payDataV1 = await mlGet(`https://api.mercadolibre.com/v1/payments/${payment.id}`, accessToken);
        if (payDataV1) {
          const net = payDataV1.net_received_amount || payDataV1.transaction_details?.net_received_amount || 0;
          mlApiNetReceived += net;
          mlApiPayments.push({ paymentId: payment.id, net, transactionAmount: payDataV1.transaction_amount });
          for (const fee of (payDataV1.fee_details || [])) {
            mlApiFees.push({ type: fee.type, amount: fee.amount });
          }
        } else {
          mlApiError = `Payment ${payment.id} not found`;
        }
      }
    }
  }

  // ─── SOURCE 2: MercadoLibre ERP (mlOrderSync) ───
  let mainSync = null;
  // Find main sync: prefer procesada with highest totalML, skip ignorada/duplicada for main
  const activeSyncs = syncs.filter(s => s.estado !== 'ignorada' && s.estado !== 'duplicada');
  if (activeSyncs.length > 0) {
    // Prefer pack sync
    mainSync = activeSyncs.find(s => s.id.startsWith('ml-pack-'));
    if (!mainSync) mainSync = activeSyncs.reduce((a, b) => (b.totalML || 0) > (a.totalML || 0) ? b : a);
  }

  const mlErpTotalML = mainSync?.totalML || 0;
  const mlErpComision = (() => {
    // Sum commissions from all unique mlOrderIds (non-duplicada)
    const seen = new Set();
    let total = 0;
    for (const s of syncs) {
      if (s.estado === 'duplicada') continue;
      const oid = s.mlOrderId;
      if (oid && seen.has(oid)) continue;
      if (oid) seen.add(oid);
      total += s.comisionML || 0;
    }
    return total;
  })();
  const mlErpCargoEnvio = mainSync?.cargoEnvioML || 0;
  const mlErpCostoEnvioCliente = mainSync?.costoEnvioCliente || 0;
  const mlErpMetodoEnvio = mainSync?.metodoEnvio || '?';

  // Expected deposit per sync data
  let mlErpDeposit = mlErpTotalML;
  if (mlErpMetodoEnvio === 'flex') mlErpDeposit += mlErpCostoEnvioCliente;
  const mlErpNet = r2(mlErpDeposit - mlErpComision - mlErpCargoEnvio);

  // ─── SOURCE 3: Ventas ERP ───
  const ventaTotalPEN = venta?.totalPEN || 0;
  const ventaEstadoPago = venta?.estadoPago || '?';
  const ventaPagos = venta?.pagos || [];
  const ventaPagosMP = ventaPagos.filter(p => p.cuentaId === MP_ACCOUNT_ID || p.cuenta === MP_ACCOUNT_ID || (p.metodo || '').toLowerCase().includes('mercado'));

  // ─── SOURCE 4: Gastos + Tesorería ERP ───
  // Ingresos to MP for this venta
  let sysIngresos = 0;
  const sysIngresosDetail = [];
  const usedMovIds = new Set();

  // By ventaId
  for (const mov of (movsByVentaId.get(ventaId) || [])) {
    if (mov.esDestino && !mov.esOrigen) {
      sysIngresos += mov.d.monto || 0;
      sysIngresosDetail.push({ id: mov.id, num: mov.d.numeroMovimiento, monto: mov.d.monto, concepto: mov.d.concepto, via: 'ventaId' });
      usedMovIds.add(mov.id);
    }
  }

  // By cotizacionId
  if (venta?.cotizacionId) {
    for (const mov of (movsByCotizacionId.get(venta.cotizacionId) || [])) {
      if (mov.esDestino && !mov.esOrigen && !usedMovIds.has(mov.id)) {
        sysIngresos += mov.d.monto || 0;
        sysIngresosDetail.push({ id: mov.id, num: mov.d.numeroMovimiento, monto: mov.d.monto, concepto: mov.d.concepto, via: 'cotizacionId' });
        usedMovIds.add(mov.id);
      }
    }
  }

  // Reverse cotizacion lookup
  for (const [cotDocId, linkedVentaId] of cotToVentaId) {
    if (linkedVentaId === ventaId) {
      for (const mov of (movsByCotizacionId.get(cotDocId) || [])) {
        if (mov.esDestino && !mov.esOrigen && !usedMovIds.has(mov.id)) {
          sysIngresos += mov.d.monto || 0;
          sysIngresosDetail.push({ id: mov.id, num: mov.d.numeroMovimiento, monto: mov.d.monto, concepto: mov.d.concepto, via: `cot:${cotDocId.substring(0, 12)}` });
          usedMovIds.add(mov.id);
        }
      }
    }
  }

  // Egresos from MP for this venta
  let sysEgresos = 0;
  const sysEgresosDetail = [];

  // Direct egresos by ventaId
  for (const mov of (movsByVentaId.get(ventaId) || [])) {
    if (mov.esOrigen && !mov.esDestino && !usedMovIds.has(mov.id)) {
      sysEgresos += mov.d.monto || 0;
      sysEgresosDetail.push({ id: mov.id, num: mov.d.numeroMovimiento, monto: mov.d.monto, concepto: mov.d.concepto, via: 'ventaId' });
      usedMovIds.add(mov.id);
    }
  }

  // Via gastos linked to venta
  for (const gasto of (gastosByVentaId.get(ventaId) || [])) {
    for (const mov of (movsByGastoId.get(gasto.id) || [])) {
      if (mov.esOrigen && !mov.esDestino && !usedMovIds.has(mov.id)) {
        sysEgresos += mov.d.monto || 0;
        sysEgresosDetail.push({
          id: mov.id, num: mov.d.numeroMovimiento, monto: mov.d.monto,
          concepto: mov.d.concepto, via: `gasto:${gasto.tipo || '?'}`,
          gastoId: gasto.id, gastoMonto: gasto.monto, gastoTipo: gasto.tipo
        });
        usedMovIds.add(mov.id);
      }
    }
  }

  // Via entregas -> gastoDistribucionId
  for (const entrega of (entregasByVentaId.get(ventaId) || [])) {
    if (entrega.gastoDistribucionId) {
      for (const mov of (movsByGastoId.get(entrega.gastoDistribucionId) || [])) {
        if (mov.esOrigen && !mov.esDestino && !usedMovIds.has(mov.id)) {
          sysEgresos += mov.d.monto || 0;
          sysEgresosDetail.push({
            id: mov.id, num: mov.d.numeroMovimiento, monto: mov.d.monto,
            concepto: mov.d.concepto, via: `delivery:${entrega.codigo || '?'}`
          });
          usedMovIds.add(mov.id);
        }
      }
    }
  }

  const sysNet = r2(sysIngresos - sysEgresos);

  // ─── CROSS-REFERENCE: Identify inconsistencies ───
  const inconsistencias = [];

  // A. System ingreso vs ML API REAL deposit
  // ML API net_received = product payment net (after commission).
  // For FLEX: ML also deposits bonificación (costoEnvioCliente) separately → real deposit = net_received + costoEnvioCliente
  // For URBANO: ML deposits net_received only. Cargo envío is deducted separately.
  if (mlApiNetReceived > 0 && sysIngresos > 0) {
    const bonificacion = (mlErpMetodoEnvio === 'flex') ? mlErpCostoEnvioCliente : 0;
    const mlRealDeposit = r2(mlApiNetReceived + bonificacion);
    const discVsApi = r2(sysNet - mlRealDeposit);
    if (Math.abs(discVsApi) > 0.50) {
      inconsistencias.push({
        tipo: 'DISC_VS_ML_API',
        descripcion: `Sistema NET (${fmt(sysNet)}) ≠ ML depósito real (${fmt(mlRealDeposit)}${bonificacion > 0 ? ` = net ${fmt(mlApiNetReceived)} + bonif ${fmt(bonificacion)}` : ''}) → diff ${discVsApi > 0 ? '+' : ''}${fmt(discVsApi)}`,
        impacto: discVsApi,
      });
    }
  }

  // B. System ingreso vs mlOrderSync expected deposit
  if (mainSync && sysIngresos > 0) {
    const discIngreso = r2(sysIngresos - mlErpDeposit);
    if (Math.abs(discIngreso) > 0.50) {
      let causa = '';
      if (mlErpMetodoEnvio === 'urbano' && discIngreso > 0) {
        causa = 'Urbano: ingreso incluye costoEnvío que ML NO deposita';
      } else if (mlErpMetodoEnvio === 'flex' && discIngreso < 0) {
        causa = 'Flex: ingreso NO incluye bonificación que ML SÍ deposita';
      } else {
        causa = `Ingreso ${discIngreso > 0 ? 'inflado' : 'faltante'}`;
      }
      inconsistencias.push({
        tipo: 'DISC_INGRESO',
        descripcion: `Ingreso sistema (${fmt(sysIngresos)}) ≠ depósito esperado ML (${fmt(mlErpDeposit)}) → diff ${discIngreso > 0 ? '+' : ''}${fmt(discIngreso)}. ${causa}`,
        impacto: discIngreso,
      });
    }
  }

  // C. System egresos comisión vs mlOrderSync comisionML
  if (mainSync && mlErpComision > 0) {
    const comisionEgresos = sysEgresosDetail.filter(e => (e.via || '').includes('comision') || (e.concepto || '').toLowerCase().includes('omisi'));
    const sysComisionTotal = comisionEgresos.reduce((s, e) => s + (e.monto || 0), 0);
    const discComision = r2(sysComisionTotal - mlErpComision);
    if (Math.abs(discComision) > 0.50 || (sysComisionTotal === 0 && mlErpComision > 0)) {
      inconsistencias.push({
        tipo: 'DISC_COMISION',
        descripcion: `Comisión sistema (${fmt(sysComisionTotal)}) ≠ comisionML sync (${fmt(mlErpComision)}) → diff ${discComision > 0 ? '+' : ''}${fmt(discComision)}`,
        impacto: -discComision, // missing egreso inflates saldo
      });
    }
  }

  // D. Missing cargo envío egreso for Urbano
  if (mainSync && mlErpCargoEnvio > 0) {
    const cargoEgresos = sysEgresosDetail.filter(e => (e.concepto || '').toLowerCase().includes('cargo') || (e.via || '').includes('cargo'));
    const sysCargoTotal = cargoEgresos.reduce((s, e) => s + (e.monto || 0), 0);
    if (sysCargoTotal === 0) {
      // For Urbano orders, delivery gastos often ARE the cargo envío (e.g. GAS type "delivery" with concepto "Entrega ENT-xxx - Urbano")
      const deliveryEgresos = sysEgresosDetail.filter(e => (e.gastoTipo || '').includes('delivery') || (e.concepto || '').toLowerCase().includes('entrega'));
      const sysDeliveryTotal = deliveryEgresos.reduce((s, e) => s + (e.monto || 0), 0);
      // If delivery egresos cover the cargo amount (within S/ 1 tolerance), cargo IS accounted for
      if (sysDeliveryTotal < mlErpCargoEnvio - 1) {
        inconsistencias.push({
          tipo: 'MISSING_CARGO',
          descripcion: `Cargo envío ML (${fmt(mlErpCargoEnvio)}) no tiene egreso correspondiente en tesorería`,
          impacto: mlErpCargoEnvio, // missing egreso inflates saldo
        });
      }
    }
  }

  // E. Gasto doc monto=0 vs movement monto>0 (data integrity)
  for (const e of sysEgresosDetail) {
    if (e.gastoId && e.gastoMonto === 0 && e.monto > 0) {
      inconsistencias.push({
        tipo: 'GASTO_MONTO_ZERO',
        descripcion: `Gasto ${e.gastoTipo} (${e.gastoId.substring(0,8)}) tiene monto=S/0 en doc pero movimiento ${e.num} tiene S/${e.monto.toFixed(2)}`,
        impacto: 0, // no impact on saldo (movement is correct)
      });
    }
  }

  // F. Duplicate ingreso movements
  if (sysIngresosDetail.length > 1) {
    inconsistencias.push({
      tipo: 'MULTIPLE_INGRESOS',
      descripcion: `${sysIngresosDetail.length} movimientos ingreso: ${sysIngresosDetail.map(i => `${i.num}=${fmt(i.monto)}`).join(', ')}`,
      impacto: 0, // need manual review
    });
  }

  // G. Venta totalPEN vs ML data
  if (mainSync && Math.abs(ventaTotalPEN - mlErpTotalML) > 1 && ventaTotalPEN > 0 && mlErpTotalML > 0) {
    // This is informational - totalPEN may include/exclude shipping
    const diff = r2(ventaTotalPEN - mlErpTotalML);
    if (Math.abs(diff) > 1 && !(mlErpMetodoEnvio === 'urbano' && Math.abs(diff - mlErpCargoEnvio) < 1)
        && !(mlErpMetodoEnvio === 'flex' && Math.abs(diff - mlErpCostoEnvioCliente) < 1)) {
      inconsistencias.push({
        tipo: 'VENTA_VS_ML_TOTAL',
        descripcion: `Venta totalPEN (${fmt(ventaTotalPEN)}) ≠ mlOrderSync totalML (${fmt(mlErpTotalML)}) → diff ${fmt(diff)}`,
        impacto: 0,
      });
    }
  }

  results.push({
    ventaId, numVenta, ventaTotalPEN, ventaEstadoPago,
    // Source 1: ML API
    mlApiNetReceived: r2(mlApiNetReceived), mlApiFees, mlApiPayments, mlApiError,
    // Source 2: ML ERP
    mlErpTotalML, mlErpComision: r2(mlErpComision), mlErpCargoEnvio, mlErpCostoEnvioCliente,
    mlErpMetodoEnvio, mlErpDeposit: r2(mlErpDeposit), mlErpNet: r2(mlErpNet),
    syncCount: syncs.length, mainSyncId: mainSync?.id,
    // Source 3: Venta (pagos array)
    ventaPagosMP,
    // ML real deposit (net_received + bonificación for flex)
    mlRealDeposit: r2(mlApiNetReceived + ((mlErpMetodoEnvio === 'flex') ? mlErpCostoEnvioCliente : 0)),
    // Source 4: Tesorería
    sysIngresos: r2(sysIngresos), sysEgresos: r2(sysEgresos), sysNet: r2(sysNet),
    sysIngresosDetail, sysEgresosDetail,
    // Cross-reference
    inconsistencias,
    usedMovIds: [...usedMovIds],
  });

  if (apiCallCount % 20 === 0) {
    process.stdout.write(`  ${apiCallCount} API calls realizados...\r`);
  }
}

console.log(`\n✓ ${apiCallCount} API calls completados\n`);

// ============================================================================
// Find orphan movements (not attributed to any venta)
// ============================================================================
const attributedMovIds = new Set();
for (const r of results) {
  for (const mid of r.usedMovIds) attributedMovIds.add(mid);
}

const orphanMovs = [];
let orphanIngresosTotal = 0, orphanEgresosTotal = 0;
for (const mov of activeMovs) {
  if (attributedMovIds.has(mov.id)) continue;
  if (mov.d.tipo === 'transferencia_interna') continue;
  const monto = mov.d.monto || 0;
  const efecto = (mov.esDestino && !mov.esOrigen) ? +monto : (mov.esOrigen && !mov.esDestino ? -monto : 0);
  if (efecto > 0) orphanIngresosTotal += monto;
  if (efecto < 0) orphanEgresosTotal += monto;
  orphanMovs.push({
    id: mov.id, num: mov.d.numeroMovimiento, monto,
    efecto, concepto: mov.d.concepto,
    ventaId: mov.d.ventaId, cotizacionId: mov.d.cotizacionId, gastoId: mov.d.gastoId,
  });
}

// ============================================================================
// PRINT REPORT
// ============================================================================

console.log('╔═════════════════════════════════════════════════════════════════════════════════════╗');
console.log('║  INFORME 4-WAY CROSS-REFERENCE: RECONCILIACIÓN MERCADOPAGO                        ║');
console.log('║  Fecha: 2026-03-14                                                                 ║');
console.log('║  ML API × MercadoLibre ERP × Ventas ERP × Gastos/Tesorería ERP                    ║');
console.log('╚═════════════════════════════════════════════════════════════════════════════════════╝');

// ── SECTION 1: PANORAMA ──
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  SECCIÓN 1: PANORAMA GENERAL');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`  Ingresos totales a MP:       ${padL(fmt(totalIngresosMP), 14)}  (${countIngresos} movimientos)`);
console.log(`  Egresos totales de MP:       ${padL(fmt(totalEgresosMP), 14)}  (${countEgresos} movimientos)`);
console.log(`    ├─ Comisiones:             ${padL(fmt(egresoComisiones), 14)}`);
console.log(`    ├─ Cargo envío:            ${padL(fmt(egresoCargoEnvio), 14)}`);
console.log(`    ├─ Delivery:               ${padL(fmt(egresoDelivery), 14)}`);
console.log(`    ├─ Transferencias a banco: ${padL(fmt(egresoTransferencias), 14)}`);
console.log(`    └─ Otros:                  ${padL(fmt(egresoOtros), 14)}`);
console.log('  ─────────────────────────────────────────────');
console.log(`  SALDO SISTEMA (calculado):   ${padL(fmt(SALDO_SISTEMA), 14)}`);
console.log(`  SALDO REAL MP:               ${padL(fmt(SALDO_REAL), 14)}`);
console.log(`  ▶ GAP (sistema - real):      ${padL(fmt(GAP), 14)}`);

// ── SECTION 2: PER-VENTA 4-WAY TABLE ──
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  SECCIÓN 2: CRUCE 4 FUENTES POR VENTA — SOLO INCONSISTENCIAS');
console.log('═══════════════════════════════════════════════════════════════\n');

const withIssues = results.filter(r => r.inconsistencias.length > 0);
const withoutIssues = results.filter(r => r.inconsistencias.length === 0 && (r.sysIngresos > 0 || r.mlApiNetReceived > 0));

let totalImpactoPositivo = 0; // infla saldo
let totalImpactoNegativo = 0; // deflaciona saldo

for (const r of withIssues) {
  console.log(`  ┌─── ${r.numVenta} ───────────────────────────────────────────────────────`);
  console.log(`  │ Método envío: ${r.mlErpMetodoEnvio}  |  Syncs: ${r.syncCount}  |  EstadoPago: ${r.ventaEstadoPago}`);
  console.log(`  │`);
  console.log(`  │ FUENTE 1 — ML API (real):            net_received = ${fmt(r.mlApiNetReceived)}`);
  if (r.mlApiPayments.length > 0) {
    for (const p of r.mlApiPayments) {
      console.log(`  │   payment ${p.paymentId}: transaction=${fmt(p.transactionAmount)} → net=${fmt(p.net)}`);
    }
  }
  if (r.mlApiFees.length > 0) {
    console.log(`  │   fees: ${r.mlApiFees.map(f => `${f.type}=${fmt(f.amount)}`).join(', ')}`);
  }
  if (r.mlApiError) console.log(`  │   ⚠ ${r.mlApiError}`);

  console.log(`  │`);
  console.log(`  │ FUENTE 2 — ML ERP (mlOrderSync):     totalML=${fmt(r.mlErpTotalML)} comisión=${fmt(r.mlErpComision)} cargo=${fmt(r.mlErpCargoEnvio)} costoEnvCliente=${fmt(r.mlErpCostoEnvioCliente)}`);
  console.log(`  │   depósito esperado=${fmt(r.mlErpDeposit)} → NET esperado=${fmt(r.mlErpNet)}`);

  console.log(`  │`);
  console.log(`  │ FUENTE 3 — Venta ERP:                totalPEN=${fmt(r.ventaTotalPEN)}`);
  if (r.ventaPagosMP.length > 0) {
    console.log(`  │   pagos[] MP: ${r.ventaPagosMP.map(p => fmt(p.monto || p.montoPEN || 0)).join(', ')} (visual, NO impacta saldo)`);
  }

  console.log(`  │`);
  console.log(`  │ FUENTE 4 — Tesorería ERP (impacta saldo):`);
  console.log(`  │   Ingresos a MP: ${fmt(r.sysIngresos)}`);
  for (const i of r.sysIngresosDetail) {
    console.log(`  │     ${i.num} = ${fmt(i.monto)} [${i.via}] ${(i.concepto || '').substring(0, 50)}`);
  }
  console.log(`  │   Egresos de MP: ${fmt(r.sysEgresos)}`);
  for (const e of r.sysEgresosDetail) {
    console.log(`  │     ${e.num} = ${fmt(e.monto)} [${e.via}] ${(e.concepto || '').substring(0, 50)}`);
  }
  console.log(`  │   NET sistema: ${fmt(r.sysNet)}`);

  console.log(`  │`);
  console.log(`  │ ▶ INCONSISTENCIAS:`);
  for (const inc of r.inconsistencias) {
    const sign = inc.impacto > 0 ? '+' : '';
    const impactoStr = inc.impacto !== 0 ? ` [impacto saldo: ${sign}${fmt(inc.impacto)}]` : ' [sin impacto saldo]';
    console.log(`  │   • ${inc.tipo}: ${inc.descripcion}${impactoStr}`);
    if (inc.impacto > 0) totalImpactoPositivo += inc.impacto;
    if (inc.impacto < 0) totalImpactoNegativo += inc.impacto;
  }
  console.log(`  └───────────────────────────────────────────────────────────────`);
  console.log('');
}

console.log(`  Ventas OK (sin inconsistencias): ${withoutIssues.length}`);
if (withoutIssues.length > 0) {
  console.log(`  ${withoutIssues.map(r => r.numVenta).join(', ')}`);
}

// ── SECTION 3: ORPHAN MOVEMENTS ──
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  SECCIÓN 3: MOVIMIENTOS HUÉRFANOS');
console.log('═══════════════════════════════════════════════════════════════\n');

if (orphanMovs.length > 0) {
  for (const m of orphanMovs) {
    const sign = m.efecto >= 0 ? '+' : '';
    console.log(`  ${pad(m.num || 'N/A', 15)} ${sign}${fmt(m.efecto)}  [${m.concepto || '?'}]`);
    if (m.ventaId) console.log(`    ventaId: ${m.ventaId}`);
    if (m.cotizacionId) console.log(`    cotizacionId: ${m.cotizacionId}`);
    if (m.gastoId) console.log(`    gastoId: ${m.gastoId}`);
  }
  console.log(`\n  Total huérfanos ingreso: +${fmt(orphanIngresosTotal)}`);
  console.log(`  Total huérfanos egreso: -${fmt(orphanEgresosTotal)}`);
} else {
  console.log('  (ninguno)');
}

// ── SECTION 4: SUMMARY OF ALL DISCREPANCIES ──
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  SECCIÓN 4: RESUMEN DE DISCREPANCIAS');
console.log('═══════════════════════════════════════════════════════════════\n');

// Group by tipo
const byTipo = new Map();
for (const r of results) {
  for (const inc of r.inconsistencias) {
    if (!byTipo.has(inc.tipo)) byTipo.set(inc.tipo, { count: 0, totalImpacto: 0, ventas: [] });
    const entry = byTipo.get(inc.tipo);
    entry.count++;
    entry.totalImpacto += inc.impacto;
    entry.ventas.push(r.numVenta);
  }
}

console.log(`  ${'TIPO'.padEnd(25)} | ${'#'.padStart(3)} | ${'IMPACTO'.padStart(12)} | VENTAS`);
console.log(`  ${'─'.repeat(25)}─┼─${'─'.repeat(3)}─┼─${'─'.repeat(12)}─┼─${'─'.repeat(50)}`);
for (const [tipo, data] of byTipo) {
  const sign = data.totalImpacto >= 0 ? '+' : '';
  console.log(`  ${pad(tipo, 25)} | ${padL(data.count, 3)} | ${padL(`${sign}${r2(data.totalImpacto).toFixed(2)}`, 12)} | ${data.ventas.join(', ')}`);
}

const totalDiscExplained = r2(totalImpactoPositivo + totalImpactoNegativo + orphanIngresosTotal - orphanEgresosTotal);
console.log(`\n  Total impacto discrepancias: ${totalDiscExplained >= 0 ? '+' : ''}${fmt(totalDiscExplained)}`);
console.log(`  GAP real:                    ${fmt(GAP)}`);
console.log(`  Residual (no explicado):     ${fmt(r2(GAP - totalDiscExplained))}`);

// ── SECTION 5: CORRECCIONES ESPECÍFICAS ──
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  SECCIÓN 5: LISTA DE CORRECCIONES ESPECÍFICAS');
console.log('═══════════════════════════════════════════════════════════════\n');

const corrections = [];
let correctionNum = 0;

for (const r of results) {
  for (const inc of r.inconsistencias) {
    if (inc.impacto === 0 && inc.tipo !== 'GASTO_MONTO_ZERO') continue;

    correctionNum++;
    let correccion = '';
    let accion = '';

    switch (inc.tipo) {
      case 'DISC_INGRESO':
        if (r.mlErpMetodoEnvio === 'urbano' && inc.impacto > 0) {
          // Urbano: ingreso is inflated (includes envío that ML doesn't deposit)
          const correctIngreso = r.mlErpDeposit;
          correccion = `Reducir ingreso de ${fmt(r.sysIngresos)} a ${fmt(correctIngreso)}`;
          accion = `Editar movimiento ${r.sysIngresosDetail[0]?.num || '?'} (${r.sysIngresosDetail[0]?.id || '?'}): monto ${fmt(r.sysIngresos)} → ${fmt(correctIngreso)}`;
        } else if (r.mlErpMetodoEnvio === 'flex' && inc.impacto < 0) {
          // Flex: ingreso is missing bonificación
          const correctIngreso = r.mlErpDeposit;
          correccion = `Aumentar ingreso de ${fmt(r.sysIngresos)} a ${fmt(correctIngreso)} (agregar bonificación envío)`;
          accion = `Editar movimiento ${r.sysIngresosDetail[0]?.num || '?'} (${r.sysIngresosDetail[0]?.id || '?'}): monto ${fmt(r.sysIngresos)} → ${fmt(correctIngreso)}`;
        } else {
          correccion = `Ajustar ingreso de ${fmt(r.sysIngresos)} a ${fmt(r.mlErpDeposit)}`;
          accion = `Editar movimiento ${r.sysIngresosDetail[0]?.num || '?'}`;
        }
        break;

      case 'DISC_COMISION':
        if (r.sysEgresosDetail.some(e => (e.via || '').includes('comision'))) {
          correccion = `Ajustar monto egreso comisión`;
          accion = `Editar movimiento comisión existente`;
        } else {
          correccion = `Crear gasto comisión ML + movimiento egreso por ${fmt(r.mlErpComision)}`;
          accion = `Crear gasto tipo=comision_ml, monto=${fmt(r.mlErpComision)}, ventaId=${r.ventaId}. Crear movimiento egreso desde MP por ${fmt(r.mlErpComision)}`;
        }
        break;

      case 'MISSING_CARGO':
        correccion = `Crear gasto cargo envío ML + movimiento egreso por ${fmt(r.mlErpCargoEnvio)}`;
        accion = `Crear gasto tipo=cargo_envio_ml, monto=${fmt(r.mlErpCargoEnvio)}, ventaId=${r.ventaId}. Crear movimiento egreso desde MP por ${fmt(r.mlErpCargoEnvio)}`;
        break;

      case 'DISC_VS_ML_API':
        // This is the aggregate comparison, may overlap with DISC_INGRESO
        continue; // Skip to avoid double-counting

      case 'GASTO_MONTO_ZERO':
        correccion = `Actualizar gasto doc: monto de S/0 al valor real del movimiento`;
        accion = `Editar gasto doc: monto → valor del movimiento correspondiente (integridad datos)`;
        break;

      case 'MULTIPLE_INGRESOS':
        correccion = `Revisar ${r.sysIngresosDetail.length} ingresos — posible duplicado`;
        accion = `Revisar movimientos: ${r.sysIngresosDetail.map(i => `${i.num}=${fmt(i.monto)}`).join(', ')}`;
        break;

      default:
        correccion = inc.descripcion;
        accion = 'Revisión manual';
    }

    corrections.push({ num: correctionNum, venta: r.numVenta, tipo: inc.tipo, correccion, accion, impacto: inc.impacto });
  }
}

// Add orphan corrections
for (const m of orphanMovs) {
  correctionNum++;
  const sign = m.efecto >= 0 ? '+' : '';
  corrections.push({
    num: correctionNum,
    venta: 'HUÉRFANO',
    tipo: 'ORPHAN',
    correccion: `Movimiento ${m.num} (${sign}${fmt(m.efecto)}) — vincular a venta o anular`,
    accion: m.cotizacionId
      ? `Vincular movimiento ${m.id} al ventaId correcto (cotización: ${m.cotizacionId}), o anular si es duplicado`
      : `Anular movimiento ${m.id} si no corresponde a operación real`,
    impacto: Math.abs(m.efecto),
  });
}

for (const c of corrections) {
  const sign = c.impacto > 0 ? '+' : (c.impacto < 0 ? '' : '');
  console.log(`  ${String(c.num).padStart(2)}. [${c.venta}] ${c.tipo}`);
  console.log(`      Corrección: ${c.correccion}`);
  console.log(`      Acción: ${c.accion}`);
  if (c.impacto !== 0) console.log(`      Impacto saldo: ${sign}${fmt(c.impacto)}`);
  console.log('');
}

// ── SECTION 6: IMPACTO TOTAL ESPERADO ──
console.log('═══════════════════════════════════════════════════════════════');
console.log('  SECCIÓN 6: PROYECCIÓN POST-CORRECCIONES');
console.log('═══════════════════════════════════════════════════════════════\n');

let totalCorrectionImpact = 0;
for (const c of corrections) {
  totalCorrectionImpact += c.impacto;
}

const projectedSaldo = r2(SALDO_SISTEMA - totalCorrectionImpact);

console.log(`  Saldo sistema actual:              ${fmt(SALDO_SISTEMA)}`);
console.log(`  Total correcciones (impacto):       ${totalCorrectionImpact >= 0 ? '+' : ''}${fmt(totalCorrectionImpact)}`);
console.log(`  Saldo proyectado post-corrección:  ${fmt(projectedSaldo)}`);
console.log(`  Saldo real MP:                     ${fmt(SALDO_REAL)}`);
console.log(`  Gap residual proyectado:           ${fmt(r2(projectedSaldo - SALDO_REAL))}`);
console.log('');
console.log(`  NOTA: Después de aplicar correcciones, ejecutar recalcularSaldoCuenta('${MP_ACCOUNT_ID}')`);
console.log(`  para recalcular el campo saldoActual desde los movimientos.`);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  FIN DEL INFORME');
console.log('═══════════════════════════════════════════════════════════════\n');

// ============================================================================
// EXPORT JSON FOR PDF GENERATION
// ============================================================================
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const withIssuesForJSON = results.filter(r => r.inconsistencias.length > 0);
const withoutIssuesForJSON = results.filter(r => r.inconsistencias.length === 0 && (r.sysIngresos > 0 || r.mlApiNetReceived > 0));

// Build summary by type
const byTipoJSON = new Map();
for (const r of results) {
  for (const inc of r.inconsistencias) {
    if (!byTipoJSON.has(inc.tipo)) byTipoJSON.set(inc.tipo, { tipo: inc.tipo, count: 0, totalImpacto: 0, ventas: [] });
    const entry = byTipoJSON.get(inc.tipo);
    entry.count++;
    entry.totalImpacto += inc.impacto;
    entry.ventas.push(r.numVenta);
  }
}

const jsonData = {
  fecha: '2026-03-14',
  mpAccountId: MP_ACCOUNT_ID,
  overview: {
    totalIngresos: r2(totalIngresosMP),
    countIngresos,
    totalEgresos: r2(totalEgresosMP),
    countEgresos,
    egresoComisiones: r2(egresoComisiones),
    egresoCargoEnvio: r2(egresoCargoEnvio),
    egresoDelivery: r2(egresoDelivery),
    egresoTransferencias: r2(egresoTransferencias),
    egresoOtros: r2(egresoOtros),
    saldoSistema: SALDO_SISTEMA,
    saldoReal: SALDO_REAL,
    gap: GAP,
  },
  ventasConInconsistencias: withIssuesForJSON.length,
  ventasOK: withoutIssuesForJSON.length,
  ventasOKList: withoutIssuesForJSON.map(r => r.numVenta),
  orphanCount: orphanMovs.length,
  orphanMovs: orphanMovs.map(m => ({ num: m.num, efecto: m.efecto, concepto: m.concepto, id: m.id })),
  orphanIngresosTotal: r2(orphanIngresosTotal),
  ventasDetalle: withIssuesForJSON.map(r => ({
    ventaId: r.ventaId,
    numVenta: r.numVenta,
    ventaTotalPEN: r.ventaTotalPEN,
    ventaEstadoPago: r.ventaEstadoPago,
    mlApiNetReceived: r.mlApiNetReceived,
    mlApiPayments: r.mlApiPayments,
    mlApiError: r.mlApiError,
    mlErpTotalML: r.mlErpTotalML,
    mlErpComision: r.mlErpComision,
    mlErpCargoEnvio: r.mlErpCargoEnvio,
    mlErpCostoEnvioCliente: r.mlErpCostoEnvioCliente,
    mlErpMetodoEnvio: r.mlErpMetodoEnvio,
    mlErpDeposit: r.mlErpDeposit,
    mlErpNet: r.mlErpNet,
    mlRealDeposit: r.mlRealDeposit,
    syncCount: r.syncCount,
    sysIngresos: r.sysIngresos,
    sysEgresos: r.sysEgresos,
    sysNet: r.sysNet,
    sysIngresosDetail: r.sysIngresosDetail,
    sysEgresosDetail: r.sysEgresosDetail.map(e => ({
      id: e.id, num: e.num, monto: e.monto, concepto: e.concepto, via: e.via,
    })),
    inconsistencias: r.inconsistencias,
  })),
  summary: [...byTipoJSON.values()],
  totalImpacto: r2(totalImpactoPositivo + totalImpactoNegativo + orphanIngresosTotal - orphanEgresosTotal),
  corrections: corrections.map(c => ({
    venta: c.venta, tipo: c.tipo, correccion: c.correccion, accion: c.accion, impacto: c.impacto,
  })),
  projection: {
    saldoActual: SALDO_SISTEMA,
    totalCorrecciones: r2(totalCorrectionImpact),
    saldoProyectado: projectedSaldo,
    saldoReal: SALDO_REAL,
    gapResidual: r2(projectedSaldo - SALDO_REAL),
  },
};

const jsonPath = join(__dirname, 'informe-4way-data.json');
writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');
console.log(`\n✓ JSON exportado: ${jsonPath}`);

process.exit(0);
