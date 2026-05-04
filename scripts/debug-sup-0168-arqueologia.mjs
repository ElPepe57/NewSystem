/**
 * Arqueología SKU SUP-0168 · 2026-05-04
 * Busca cualquier rastro del producto que tenía SUP-0168 en otras colecciones
 * para entender qué pasó (eliminación, soft-delete, renombre, etc.)
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const TARGET = 'SUP-0168';

// ─── 1. Estructura de búsqueda · campos típicos donde aparece un SKU ─────────
const colecciones = [
  { name: 'productos', campos: ['sku', 'archivado'] },                     // archivados se ven con doc.archivado=true en algunas variantes
  { name: 'unidades', campos: ['productoSku', 'sku', 'productId'] },        // unidades físicas vinculadas
  { name: 'ventas', campos: ['items'] },                                     // ventas pueden listar items con sku
  { name: 'ordenesCompra', campos: ['items'] },                              // OC items con sku
  { name: 'envios', campos: ['items', 'unidadesIds'] },                      // envíos
  { name: 'mlOrderSync', campos: ['items'] },                                // sincronización ML
  { name: 'devoluciones', campos: ['items'] },                               // devoluciones
  { name: 'transferencias', campos: ['items'] },                             // transferencias
  { name: 'stockMovimientos', campos: ['productoSku', 'sku'] },              // movimientos
  { name: 'cotizaciones', campos: ['items'] },                               // cotizaciones
  { name: 'investigacionMercado', campos: ['productoSku', 'sku'] },          // investigación
];

console.log(`═══ Búsqueda arqueológica SKU=${TARGET} ═══\n`);

let huellasTotal = 0;

for (const { name, campos } of colecciones) {
  try {
    const snap = await db.collection(name).get();
    if (snap.empty) {
      console.log(`📂 /${name}: vacío · skip`);
      continue;
    }
    let huellas = 0;
    const ejemplos = [];
    for (const d of snap.docs) {
      const data = d.data();
      // Buscar el target en cualquier campo string del documento (top-level + arrays)
      const found = encontrarEnObjeto(data, TARGET);
      if (found.length > 0) {
        huellas++;
        if (ejemplos.length < 3) {
          ejemplos.push({ id: d.id, paths: found.slice(0, 3), creadoEn: data.creadoEn?.toDate?.() || data.fechaCreacion?.toDate?.() });
        }
      }
    }
    if (huellas > 0) {
      huellasTotal += huellas;
      console.log(`📂 /${name}: ${huellas} documentos con ${TARGET}`);
      ejemplos.forEach(e => {
        console.log(`   - ${e.id} · campos: ${e.paths.join(', ')} · creado: ${e.creadoEn || 'N/A'}`);
      });
    } else {
      console.log(`📂 /${name}: sin huellas (${snap.size} docs revisados)`);
    }
  } catch (e) {
    console.log(`📂 /${name}: ERROR ${e.message?.substring(0, 80)}`);
  }
}

// ─── 2. Buscar productos archivados que pudieran tener SUP-0168 ──────────────
console.log(`\n═══ Verificación adicional: ¿hay productos con archivado/inactivo? ═══`);
const todos = await db.collection('productos').get();
const archivadosOInactivos = [];
todos.docs.forEach(d => {
  const data = d.data();
  if (data.archivado === true || data.estado === 'archivado' || data.activo === false || data.eliminado === true) {
    archivadosOInactivos.push({
      id: d.id,
      sku: data.sku,
      marca: data.marca,
      nombre: data.nombreComercial,
      archivado: data.archivado,
      estado: data.estado,
      activo: data.activo,
      eliminado: data.eliminado,
    });
  }
});
console.log(`Productos archivados/inactivos: ${archivadosOInactivos.length}`);
archivadosOInactivos.slice(0, 10).forEach(p => {
  console.log(`  - ${p.sku} · ${p.marca} · ${p.nombre} · archivado=${p.archivado} · estado=${p.estado} · activo=${p.activo}`);
});

console.log(`\n═══ TOTAL huellas de ${TARGET} en otras colecciones: ${huellasTotal} ═══`);

process.exit(0);

// ─── Helper · busca recursivamente un valor exacto en cualquier campo ────────
function encontrarEnObjeto(obj, target, path = '', resultado = []) {
  if (obj == null) return resultado;
  if (typeof obj === 'string') {
    if (obj === target || obj.includes(target)) {
      resultado.push(path || '(root)');
    }
    return resultado;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      encontrarEnObjeto(obj[i], target, `${path}[${i}]`, resultado);
      if (resultado.length >= 5) break;
    }
    return resultado;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      encontrarEnObjeto(obj[k], target, path ? `${path}.${k}` : k, resultado);
      if (resultado.length >= 5) break;
    }
  }
  return resultado;
}
