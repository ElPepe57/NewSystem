/**
 * Consulta directa a la API de MercadoLibre para verificar el histórico real
 * de órdenes desde una fecha dada, y comparar con lo que hay en mlOrderSync.
 *
 * Uso: node scripts/check-ml-api-historico.mjs [YYYY-MM-DD]
 *      Por defecto desde 2026-01-01.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const ML_API_BASE = 'https://api.mercadolibre.com';
const dateFrom = process.argv[2] || '2026-01-01';
const dateTo = new Date().toISOString().split('T')[0];

console.log('=========================================');
console.log('CHECK ML API — Histórico real de órdenes');
console.log('=========================================');
console.log('Rango: ' + dateFrom + '  →  ' + dateTo + '\n');

// 1. Leer token y sellerId de Firestore
const tokDoc = await db.collection('mlConfig').doc('tokens').get();
if (!tokDoc.exists) {
  console.error('❌ No hay tokens guardados en mlConfig/tokens. Conecta la app primero.');
  process.exit(1);
}
const tokData = tokDoc.data();
const accessToken = Buffer.from(tokData.accessToken, 'base64').toString('utf-8');
const sellerId = tokData.userId;
const expiresAt = tokData.expiresAt?.toDate?.();

console.log('Seller ID: ' + sellerId);
console.log('Token expira: ' + (expiresAt ? expiresAt.toISOString() : 'desconocido'));
if (expiresAt && expiresAt < new Date()) {
  console.warn('⚠ Token expirado — abrí la app web (cualquier vista de ML) para refrescarlo y reintentá.');
}

// 2. Función paginada para traer todas las órdenes del rango
async function fetchAllOrders(from, to) {
  const all = [];
  let offset = 0;
  const limit = 50;
  let total = null;

  // ML usa fecha en formato ISO completo. Construir from/to absolutos.
  const fromISO = from + 'T00:00:00.000-00:00';
  const toISO = to + 'T23:59:59.999-00:00';

  while (true) {
    const params = new URLSearchParams({
      seller: String(sellerId),
      sort: 'date_asc',
      limit: String(limit),
      offset: String(offset),
      'order.date_created.from': fromISO,
      'order.date_created.to': toISO,
    });

    const url = ML_API_BASE + '/orders/search?' + params.toString();
    const resp = await fetch(url, {
      headers: { Authorization: 'Bearer ' + accessToken },
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('❌ ML API error ' + resp.status + ': ' + text.substring(0, 300));
      if (resp.status === 401) console.error('   → Token inválido/expirado. Refrescá usándolo en la app.');
      process.exit(1);
    }

    const data = await resp.json();
    if (total === null) {
      total = data.paging?.total ?? 0;
      console.log('Total reportado por ML API: ' + total + ' órdenes');
      console.log('Paginando de a ' + limit + '...\n');
    }

    const results = data.results || [];
    all.push(...results);
    process.stdout.write('  página offset=' + offset + ' → ' + results.length + ' órdenes (acum ' + all.length + '/' + total + ')\n');

    if (results.length < limit || all.length >= total) break;
    offset += limit;
    // Salvavidas: no más de 200 páginas
    if (offset > 10000) { console.warn('⚠ Salvavidas: 10000 ofs alcanzado, deteniendo'); break; }
  }
  return { orders: all, total };
}

const { orders, total } = await fetchAllOrders(dateFrom, dateTo);

// 3. Análisis del resultado
console.log('\n=========================================');
console.log('RESULTADO DESDE ML API');
console.log('=========================================');
console.log('Órdenes obtenidas: ' + orders.length);
console.log('Total reportado:   ' + total);

let totalBruto = 0;
const porMes = {};
const porStatus = {};
for (const o of orders) {
  totalBruto += o.total_amount || 0;
  const f = o.date_created ? new Date(o.date_created) : null;
  if (f) {
    const k = f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0');
    porMes[k] = (porMes[k] || 0) + 1;
  }
  const s = o.status || '?';
  porStatus[s] = (porStatus[s] || 0) + 1;
}
console.log('Venta bruta acum:  S/ ' + totalBruto.toFixed(2));

console.log('\nDistribución por mes:');
for (const [k, v] of Object.entries(porMes).sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log('   ' + k + ' : ' + v);
}
console.log('\nDistribución por status:');
for (const [k, v] of Object.entries(porStatus).sort((a, b) => b[1] - a[1])) {
  console.log('   ' + k.padEnd(15) + ' : ' + v);
}

// 4. Comparación con lo que tenemos local
console.log('\n=========================================');
console.log('COMPARACIÓN ML API vs mlOrderSync local');
console.log('=========================================');
const localSnap = await db.collection('mlOrderSync').get();
const localIds = new Set(localSnap.docs.map(d => Number(d.data().mlOrderId)));
const apiIds = new Set(orders.map(o => Number(o.id)));

console.log('En ML API:           ' + apiIds.size + ' órdenes únicas');
console.log('En mlOrderSync (BD): ' + localIds.size + ' órdenes únicas');

const faltantes = [...apiIds].filter(id => !localIds.has(id));
const extras = [...localIds].filter(id => !apiIds.has(id));

console.log('\nFALTAN en BD (en ML pero no sincronizadas): ' + faltantes.length);
console.log('EXTRA en BD (en BD pero no en este rango ML): ' + extras.length);

// Mostrar una muestra de las primeras 10 faltantes con su fecha
if (faltantes.length > 0) {
  console.log('\nMuestra de las 10 primeras órdenes FALTANTES:');
  const faltMap = orders.filter(o => faltantes.includes(Number(o.id))).slice(0, 10);
  for (const o of faltMap) {
    const f = o.date_created?.split('T')[0] || '?';
    const total = (o.total_amount || 0).toFixed(2);
    const items = (o.order_items || []).map(i => i.item?.title?.substring(0, 40)).join(' | ');
    console.log('   ' + f + ' | ML#' + o.id + ' | S/' + total.padStart(8) + ' | ' + items);
  }
}

// Total bruto solo de las faltantes
const totalFaltantes = orders
  .filter(o => faltantes.includes(Number(o.id)))
  .reduce((acc, o) => acc + (o.total_amount || 0), 0);
console.log('\nVenta bruta de las faltantes: S/ ' + totalFaltantes.toFixed(2));

process.exit(0);
