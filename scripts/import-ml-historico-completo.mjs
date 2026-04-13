/**
 * Importación standalone del histórico ML desde un rango de fechas.
 *
 * Reusa el mismo schema que la Cloud Function importHistoricalOrders
 * (functions/src/mercadolibre/ml.sync.ts), pero sin el cap hardcoded de 200.
 *
 * Uso:  node scripts/import-ml-historico-completo.mjs [YYYY-MM-DD]
 *       Por defecto desde 2026-01-01.
 *
 * Comportamiento:
 *   - Pagina TODAS las órdenes en el rango usando /orders/search
 *   - Para cada orden, verifica si ya existe en mlOrderSync (por mlOrderId)
 *   - Si NO existe → enriquece (shipment + billing_info + user) y la inserta
 *   - Si YA existe → la omite (no toca, no duplica)
 *   - Marca origen='importacion_historica'
 *   - Las canceladas se marcan estado='ignorada'
 *   - Rate limit: 300ms entre órdenes (igual que la CF)
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const ML_API_BASE = 'https://api.mercadolibre.com';
const dateFrom = process.argv[2] || '2026-01-01';
const dateTo = new Date().toISOString().split('T')[0];
const fromISO = dateFrom + 'T00:00:00.000-00:00';
const toISO = dateTo + 'T23:59:59.999-00:00';

console.log('=========================================');
console.log('IMPORT ML HISTÓRICO — Standalone');
console.log('=========================================');
console.log('Rango: ' + dateFrom + '  →  ' + dateTo + '\n');

// 1. Token + seller
const tokDoc = await db.collection('mlConfig').doc('tokens').get();
if (!tokDoc.exists) {
  console.error('❌ No hay tokens en mlConfig/tokens. Conecta la app primero.');
  process.exit(1);
}
const tokData = tokDoc.data();
const accessToken = Buffer.from(tokData.accessToken, 'base64').toString('utf-8');
const sellerId = tokData.userId;
const expiresAt = tokData.expiresAt?.toDate?.();
console.log('Seller ID: ' + sellerId);
console.log('Token expira: ' + expiresAt?.toISOString());
if (expiresAt && expiresAt < new Date()) {
  console.error('❌ Token expirado. Refrescá usando la app y reintentá.');
  process.exit(1);
}
console.log();

// 2. Helpers HTTP
async function mlGet(path) {
  const resp = await fetch(ML_API_BASE + path, {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (!resp.ok) {
    if (resp.status === 401) throw new Error('TOKEN_EXPIRED');
    if (resp.status === 429) {
      // Rate limit: backoff
      await new Promise(r => setTimeout(r, 2000));
      return mlGet(path);
    }
    const txt = await resp.text();
    throw new Error('ML API ' + resp.status + ': ' + txt.substring(0, 200));
  }
  return resp.json();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 3. Helpers de dominio (replicando la CF)

function calcularComisionTotal(order) {
  return (order.order_items || []).reduce(
    (t, item) => t + (item.sale_fee || 0) * (item.quantity || 1),
    0
  );
}

async function resolverProductosOrden(order) {
  const productos = [];
  for (const orderItem of (order.order_items || [])) {
    const itemId = orderItem.item.id;
    const mapQuery = await db
      .collection('mlProductMap')
      .where('mlItemId', '==', itemId)
      .limit(1)
      .get();

    let productoId = null, productoSku = null, productoNombre = null, vinculado = false;
    if (!mapQuery.empty) {
      const m = mapQuery.docs[0].data();
      productoId = m.productoId || null;
      productoSku = m.productoSku || null;
      productoNombre = m.productoNombre || null;
      vinculado = !!m.vinculado;
    }

    productos.push({
      mlItemId: itemId,
      mlTitle: orderItem.item.title,
      mlVariationId: orderItem.item.variation_id || null,
      cantidad: orderItem.quantity,
      precioUnitario: orderItem.unit_price,
      saleFee: orderItem.sale_fee || 0,
      productoId,
      productoSku,
      productoNombre,
      vinculado,
    });
  }
  return productos;
}

// 4. Búsqueda paginada de TODAS las órdenes en el rango
async function searchAllOrders() {
  const all = [];
  let offset = 0;
  const limit = 50;
  let total = null;
  while (true) {
    const params = new URLSearchParams({
      seller: String(sellerId),
      sort: 'date_asc',
      limit: String(limit),
      offset: String(offset),
      'order.date_created.from': fromISO,
      'order.date_created.to': toISO,
    });
    const data = await mlGet('/orders/search?' + params.toString());
    if (total === null) {
      total = data.paging?.total ?? 0;
      console.log('ML reporta ' + total + ' órdenes en el rango. Paginando...\n');
    }
    const r = data.results || [];
    all.push(...r);
    if (r.length < limit || all.length >= total) break;
    offset += limit;
    if (offset > 10000) break;
  }
  return all;
}

const orders = await searchAllOrders();
console.log('Órdenes obtenidas de ML API: ' + orders.length + '\n');

// 5. Procesar e insertar
let importadas = 0, omitidas = 0, errores = 0;
const erroresDetalle = [];

for (let i = 0; i < orders.length; i++) {
  const order = orders[i];
  const progreso = '[' + (i + 1) + '/' + orders.length + ']';

  try {
    // Verificar si ya existe
    const existing = await db
      .collection('mlOrderSync')
      .where('mlOrderId', '==', order.id)
      .limit(1)
      .get();
    if (!existing.empty) {
      omitidas++;
      console.log(progreso + ' OMIT  ML#' + order.id + ' (ya existe)');
      continue;
    }

    // ---- Enriquecer con datos del buyer ----
    let buyerName = 'Cliente ML';
    let buyerNickname = order.buyer?.nickname || null;
    let buyerEmail = null;
    let buyerPhone = null;
    let buyerDni = null;
    let buyerDocType = null;
    let razonSocial = null;

    if (order.buyer?.first_name) {
      buyerName = (order.buyer.first_name + ' ' + (order.buyer.last_name || '')).trim();
    }
    if (order.buyer?.billing_info?.doc_number) {
      buyerDni = order.buyer.billing_info.doc_number;
      buyerDocType = order.buyer.billing_info.doc_type || null;
    }
    if (order.buyer?.phone?.number) {
      buyerPhone = ((order.buyer.phone.area_code || '') + order.buyer.phone.number).trim();
    }
    if (order.buyer?.email) {
      buyerEmail = order.buyer.email;
    }

    // Si no hay first_name del search, traer la orden completa
    if (buyerName === 'Cliente ML') {
      try {
        const fullOrder = await mlGet('/orders/' + order.id);
        if (fullOrder.buyer?.first_name) {
          buyerName = (fullOrder.buyer.first_name + ' ' + (fullOrder.buyer.last_name || '')).trim();
        }
        if (!buyerPhone && fullOrder.buyer?.phone?.number) {
          buyerPhone = ((fullOrder.buyer.phone.area_code || '') + fullOrder.buyer.phone.number).trim();
        }
        if (!buyerEmail && fullOrder.buyer?.email) buyerEmail = fullOrder.buyer.email;
        if (!buyerNickname && fullOrder.buyer?.nickname) buyerNickname = fullOrder.buyer.nickname;
      } catch { /* non-critical */ }
    }

    // /users/{id}
    try {
      const buyer = await mlGet('/users/' + order.buyer.id);
      if (!buyerEmail && buyer.email) buyerEmail = buyer.email;
      if (!buyerPhone && buyer.phone?.number) {
        buyerPhone = ((buyer.phone.area_code || '') + buyer.phone.number).trim();
      }
      if (!buyerDni && buyer.identification?.number) {
        buyerDni = buyer.identification.number;
        if (!buyerDocType && buyer.identification.type) buyerDocType = buyer.identification.type;
      }
      if (!buyerNickname && buyer.nickname) buyerNickname = buyer.nickname;
    } catch { /* non-critical */ }

    // /orders/{id}/billing_info
    try {
      const billingInfo = await mlGet('/orders/' + order.id + '/billing_info');
      const bi = billingInfo?.billing_info || billingInfo;
      if (bi) {
        if (bi.doc_number) buyerDni = bi.doc_number;
        if (bi.doc_type) buyerDocType = bi.doc_type;
        if (Array.isArray(bi.additional_info)) {
          const fn = bi.additional_info.find(x => x.type === 'FIRST_NAME')?.value?.trim();
          const ln = bi.additional_info.find(x => x.type === 'LAST_NAME')?.value?.trim();
          if (fn || ln) buyerName = ((fn || '') + ' ' + (ln || '')).trim();
          const bn = bi.additional_info.find(x => x.type === 'TAXPAYER_NAME' || x.type === 'BUSINESS_NAME');
          if (bn?.value) razonSocial = bn.value;
        }
      }
    } catch { /* non-critical */ }

    // ---- Datos de envío ----
    let direccionEntrega = '', distrito = '', provincia = '';
    let codigoPostal = null, referenciaEntrega = null;
    let costoEnvioML = 0, costoEnvioCliente = 0;
    let trackingNumber = null, trackingMethod = null;
    let coordenadas = null, shipmentId = null, shipmentStatus = 'unknown';

    if (order.shipping?.id) {
      shipmentId = order.shipping.id;
      try {
        const shipment = await mlGet('/shipments/' + order.shipping.id);
        const addr = shipment.receiver_address || {};
        direccionEntrega = addr.address_line || ((addr.street_name || '') + ' ' + (addr.street_number || '')).trim();
        distrito = addr.city?.name || '';
        provincia = addr.state?.name || '';
        codigoPostal = addr.zip_code || null;
        referenciaEntrega = addr.comment || null;
        costoEnvioML = shipment.lead_time?.cost || 0;
        trackingNumber = shipment.tracking_number || null;
        trackingMethod = shipment.tracking_method || null;
        shipmentStatus = shipment.status || 'unknown';

        const shOpt = shipment.shipping_option;
        if (shOpt?.cost > 0) costoEnvioCliente = shOpt.cost;
        else if (shOpt?.list_cost > 0) costoEnvioCliente = shOpt.list_cost;

        if (addr.latitude && addr.longitude) {
          coordenadas = { lat: addr.latitude, lng: addr.longitude };
        }
      } catch { /* non-critical: shipment puede no estar accesible para órdenes viejas */ }
    }

    // Fallback: costo de envío del payment
    if (costoEnvioCliente === 0 && order.payments?.length > 0) {
      costoEnvioCliente = order.payments[0].shipping_cost || 0;
      if (costoEnvioCliente === 0) {
        const totalPaid = order.payments[0].total_paid_amount || 0;
        const txAmount = order.payments[0].transaction_amount || 0;
        if (totalPaid > txAmount) costoEnvioCliente = totalPaid - txAmount;
      }
    }
    if (costoEnvioCliente === 0 && costoEnvioML > 0) costoEnvioCliente = costoEnvioML;

    // ---- Método de envío + clasificación ----
    let metodoEnvio = null;
    const m = (trackingMethod || '').toLowerCase();
    if (m.includes('flex') || m === 'self_service') metodoEnvio = 'flex';
    else if (trackingMethod) metodoEnvio = 'urbano';

    let cargoEnvioML = 0;
    if (metodoEnvio === 'urbano' && costoEnvioCliente > 0) {
      cargoEnvioML = costoEnvioCliente;
      costoEnvioCliente = 0;
    }

    // ---- Comisiones + productos ----
    const comisionML = calcularComisionTotal(order);
    const productosResueltos = await resolverProductosOrden(order);
    const todosVinculados = productosResueltos.every(p => p.productoId !== null);

    // ---- Estado ----
    let estado = 'pendiente';
    let errorDetalle = null;
    if (order.status === 'cancelled') {
      estado = 'ignorada';
      errorDetalle = 'Orden cancelada en ML (' + (order.cancel_detail?.reason || 'sin razón') + ')';
    } else if (order.status !== 'paid') {
      errorDetalle = 'Estado en ML: ' + order.status;
    } else if (!todosVinculados) {
      errorDetalle = 'Productos sin vincular: ' + productosResueltos.filter(p => !p.productoId).map(p => p.mlTitle).join(', ');
    }

    // ---- Insertar ----
    await db.collection('mlOrderSync').add({
      mlOrderId: order.id,
      mlStatus: order.status,
      mlBuyerId: order.buyer.id,
      mlBuyerName: buyerName,
      mlBuyerNickname: buyerNickname,
      buyerEmail,
      buyerPhone,
      buyerDni,
      buyerDocType,
      razonSocial,
      ventaId: null,
      numeroVenta: null,
      clienteId: null,
      estado,
      errorDetalle,
      totalML: order.total_amount || 0,
      comisionML,
      costoEnvioML,
      costoEnvioCliente,
      metodoEnvio,
      cargoEnvioML,
      direccionEntrega,
      distrito,
      provincia,
      codigoPostal,
      referenciaEntrega,
      coordenadas,
      trackingNumber,
      trackingMethod,
      shipmentId,
      shipmentStatus,
      productos: productosResueltos,
      todosVinculados,
      origen: 'importacion_historica',
      fechaOrdenML: Timestamp.fromDate(new Date(order.date_created)),
      fechaProcesada: null,
      fechaSync: Timestamp.now(),
      fechaImportacion: Timestamp.now(),
      rawOrder: {
        id: order.id,
        status: order.status,
        total_amount: order.total_amount,
        currency_id: order.currency_id,
        date_created: order.date_created,
        date_closed: order.date_closed,
        items_count: (order.order_items || []).length,
      },
    });

    importadas++;
    const fechaCorta = order.date_created?.split('T')[0] || '?';
    console.log(progreso + ' NEW   ML#' + order.id + ' | ' + fechaCorta + ' | S/' + (order.total_amount || 0).toFixed(2).padStart(7) + ' | ' + buyerName.substring(0, 30));
  } catch (err) {
    if (err.message === 'TOKEN_EXPIRED') {
      console.error('\n❌ TOKEN EXPIRADO durante la importación. Refrescá y reintentá.');
      console.error('   Importadas hasta ahora: ' + importadas);
      process.exit(1);
    }
    errores++;
    erroresDetalle.push({ id: order.id, msg: err.message });
    console.log(progreso + ' ERR   ML#' + order.id + ' | ' + err.message.substring(0, 80));
  }

  // Rate limit: 300ms entre órdenes (mismo que la CF)
  await sleep(300);
}

// 6. Reporte final
console.log('\n=========================================');
console.log('RESUMEN');
console.log('=========================================');
console.log('Importadas:        ' + importadas);
console.log('Omitidas (existían): ' + omitidas);
console.log('Errores:           ' + errores);
console.log('Total procesadas:  ' + (importadas + omitidas + errores));

if (errores > 0) {
  console.log('\nDetalle de errores:');
  for (const e of erroresDetalle) console.log('   ML#' + e.id + ': ' + e.msg);
}

// Actualizar metadata
await db.collection('mlConfig').doc('settings').set(
  { lastHistoricalImport: Timestamp.now() },
  { merge: true }
);

console.log('\nFin.');
process.exit(0);
