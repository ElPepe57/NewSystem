import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

console.log('=========================================');
console.log('DIAGNÓSTICO: ¿Dónde está el histórico ML?');
console.log('=========================================\n');

// ============================================================
// 1. mlOrderSync — conteo SIN orderBy (por si hay docs sin fechaOrdenML)
// ============================================================
const rawSnap = await db.collection('mlOrderSync').get();
console.log('1. COLECCIÓN mlOrderSync');
console.log('   Total docs (sin filtros): ' + rawSnap.size);

// Distribución por origen
const porOrigen = {};
const porAnio = {};
let conFechaOrden = 0, sinFechaOrden = 0;
let fechaMin = null, fechaMax = null;
for (const d of rawSnap.docs) {
  const data = d.data();
  const origen = data.origen || '(sin-origen)';
  porOrigen[origen] = (porOrigen[origen] || 0) + 1;
  if (data.fechaOrdenML?.toDate) {
    conFechaOrden++;
    const f = data.fechaOrdenML.toDate();
    const y = f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0');
    porAnio[y] = (porAnio[y] || 0) + 1;
    if (!fechaMin || f < fechaMin) fechaMin = f;
    if (!fechaMax || f > fechaMax) fechaMax = f;
  } else {
    sinFechaOrden++;
  }
}
console.log('   Con fechaOrdenML: ' + conFechaOrden);
console.log('   Sin fechaOrdenML: ' + sinFechaOrden);
console.log('   Fecha más antigua: ' + (fechaMin ? fechaMin.toISOString().split('T')[0] : '—'));
console.log('   Fecha más reciente: ' + (fechaMax ? fechaMax.toISOString().split('T')[0] : '—'));
console.log('   Por origen:');
for (const [k, v] of Object.entries(porOrigen)) console.log('      ' + k + ': ' + v);
console.log('   Por mes:');
const mesesOrdenados = Object.entries(porAnio).sort((a, b) => a[0].localeCompare(b[0]));
for (const [k, v] of mesesOrdenados) console.log('      ' + k + ': ' + v);

// ============================================================
// 2. ventas — buscar por origen ML o mlOrderId
// ============================================================
console.log('\n2. COLECCIÓN ventas (búsqueda por campos ML)');

// 2a. ventas con origen: 'mercadolibre'
try {
  const v1 = await db.collection('ventas').where('origen', '==', 'mercadolibre').get();
  console.log('   ventas con origen == "mercadolibre": ' + v1.size);
} catch (e) { console.log('   origen=mercadolibre: error ' + e.message); }

try {
  const v2 = await db.collection('ventas').where('origen', '==', 'ml').get();
  console.log('   ventas con origen == "ml": ' + v2.size);
} catch (e) { console.log('   origen=ml: error ' + e.message); }

try {
  const v3 = await db.collection('ventas').where('canal', '==', 'mercadolibre').get();
  console.log('   ventas con canal == "mercadolibre": ' + v3.size);
} catch (e) { console.log('   canal=mercadolibre: error ' + e.message); }

// 2b. ventas con mlOrderId != null
try {
  const v4 = await db.collection('ventas').where('mlOrderId', '!=', null).get();
  console.log('   ventas con mlOrderId != null: ' + v4.size);
  if (v4.size > 0 && v4.size <= 5) {
    for (const d of v4.docs) {
      const vd = d.data();
      console.log('      → ' + (vd.numeroVenta || d.id) + ' | mlOrderId=' + vd.mlOrderId + ' | fecha=' + (vd.fechaVenta?.toDate?.().toISOString().split('T')[0] || '?'));
    }
  }
} catch (e) { console.log('   mlOrderId != null: error ' + e.message); }

// ============================================================
// 3. ¿Hay otras colecciones relacionadas con ML?
// ============================================================
console.log('\n3. OTRAS COLECCIONES POSIBLES');
const candidatos = ['mlOrders', 'ml_orders', 'mercadoLibreOrders', 'mlVentas', 'ventasML', 'mlHistorico', 'mlImportHistorico'];
for (const c of candidatos) {
  try {
    const s = await db.collection(c).limit(1).get();
    if (s.size > 0) {
      const full = await db.collection(c).count().get();
      console.log('   ⚠ ' + c + ': ' + full.data().count + ' docs');
    }
  } catch (e) { /* colección no existe, OK */ }
}

// ============================================================
// 4. Total de ventas en la BD (para tener referencia)
// ============================================================
console.log('\n4. REFERENCIA: total colección ventas');
const vAll = await db.collection('ventas').count().get();
console.log('   Total ventas (todas): ' + vAll.data().count);

// 5. Muestra de clientes cuyo nombre parezca de ML (nickname todo mayúsculas)
console.log('\n5. VENTAS cuyo cliente pueda ser de ML (heurística: nickname en mayúsculas)');
const muestraV = await db.collection('ventas').orderBy('fechaVenta', 'desc').limit(20).get();
let sospechosas = 0;
for (const d of muestraV.docs) {
  const vd = d.data();
  const nombre = (vd.clienteNombre || '').trim();
  if (nombre && nombre === nombre.toUpperCase() && !nombre.includes(' ')) {
    sospechosas++;
    if (sospechosas <= 5) {
      console.log('      → ' + (vd.numeroVenta || d.id) + ' | ' + nombre + ' | origen=' + (vd.origen || '?'));
    }
  }
}
console.log('   Ventas "sospechosas" en las últimas 20: ' + sospechosas);

process.exit(0);
