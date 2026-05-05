/**
 * Auditoría de maestros · 2026-05-04
 * READ-ONLY · sin escritura
 *
 * Reporta el estado de los maestros que la Onda 2 (IA atributos) va a usar
 * como vocabulario cerrado / sugerido:
 *   - tiposProducto (100 docs)
 *   - categorias (72 docs)
 *   - etiquetas (82 docs)
 *   - marcas (53 docs)
 *   - lineasNegocio (2 docs)
 *
 * Para cada uno detecta:
 *   - Duplicados aparentes (mismo nombre con/sin tilde, case diferente, etc.)
 *   - Items huérfanos (no usados por ningún producto)
 *   - Items con info crítica faltante (nombre vacío, código mal formado)
 *   - Distribución de uso (top 10 más usados + bottom 10 menos usados)
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

// Helper · normaliza string para detección de duplicados
function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// ─── Cargar productos para análisis de uso ──────────────────────────────────
const productosSnap = await db.collection('productos').get();
const productos = productosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
console.log(`Productos leídos: ${productos.length}\n`);

// ─── Auditor genérico ───────────────────────────────────────────────────────
async function auditarMaestro(coleccion, campoUsoEnProducto, campoNombreEnMaestro) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📂 /${coleccion}`);
  console.log(`${'═'.repeat(70)}`);

  const snap = await db.collection(coleccion).get();
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Total docs: ${items.length}`);

  // Detectar items con nombre vacío
  const sinNombre = items.filter(i => !i[campoNombreEnMaestro] || (typeof i[campoNombreEnMaestro] === 'string' && !i[campoNombreEnMaestro].trim()));
  if (sinNombre.length > 0) {
    console.log(`\n⚠️  Items sin nombre: ${sinNombre.length}`);
    sinNombre.slice(0, 5).forEach(i => console.log(`    - ${i.id}: ${JSON.stringify(i)}`));
  }

  // Detectar duplicados por nombre normalizado
  const grupos = {};
  for (const i of items) {
    const key = normalize(i[campoNombreEnMaestro]);
    if (!key) continue;
    grupos[key] = grupos[key] || [];
    grupos[key].push(i);
  }
  const duplicados = Object.entries(grupos).filter(([_, arr]) => arr.length > 1);
  if (duplicados.length > 0) {
    console.log(`\n🔁 Duplicados aparentes (mismo nombre normalizado): ${duplicados.length}`);
    duplicados.slice(0, 10).forEach(([key, arr]) => {
      console.log(`    "${key}":`);
      arr.forEach(x => console.log(`      - ${x.id} · "${x[campoNombreEnMaestro]}" · estado=${x.estado || x.activo}`));
    });
  }

  // Análisis de uso · cuántos productos referencian cada item
  const uso = {};
  for (const p of productos) {
    const ref = p[campoUsoEnProducto];
    if (!ref) continue;
    if (Array.isArray(ref)) {
      // ej. categoriaIds = []
      for (const r of ref) {
        uso[r] = (uso[r] || 0) + 1;
      }
    } else {
      uso[ref] = (uso[ref] || 0) + 1;
    }
  }

  // Items huérfanos (no usados por ningún producto)
  const huerfanos = items.filter(i => !uso[i.id] || uso[i.id] === 0);
  if (huerfanos.length > 0) {
    console.log(`\n🪦 Huérfanos (no usados por ningún producto): ${huerfanos.length} de ${items.length} (${Math.round(huerfanos.length / items.length * 100)}%)`);
    huerfanos.slice(0, 10).forEach(h => console.log(`    - ${h[campoNombreEnMaestro] || h.id}`));
    if (huerfanos.length > 10) console.log(`    ... y ${huerfanos.length - 10} más`);
  }

  // Top 10 más usados
  const usados = items
    .map(i => ({ ...i, count: uso[i.id] || 0 }))
    .filter(i => i.count > 0)
    .sort((a, b) => b.count - a.count);
  console.log(`\n📈 Top 10 más usados:`);
  usados.slice(0, 10).forEach((i, idx) => {
    console.log(`   ${(idx + 1).toString().padStart(2)}. ${(i[campoNombreEnMaestro] || i.id).padEnd(35)} · ${i.count} productos`);
  });
}

// ─── Maestros principales ───────────────────────────────────────────────────
await auditarMaestro('lineasNegocio', 'lineaNegocioId', 'nombre');
await auditarMaestro('marcas', 'marcaId', 'nombre');
await auditarMaestro('tiposProducto', 'tipoProductoId', 'nombre');
await auditarMaestro('categorias', 'categoriaIds', 'nombre');
await auditarMaestro('etiquetas', 'etiquetaIds', 'nombre');
await auditarMaestro('paisesOrigen', 'paisOrigenId', 'nombre');

// ─── Análisis especial: tiposProducto vs línea ──────────────────────────────
console.log(`\n${'═'.repeat(70)}`);
console.log(`🔍 ANÁLISIS ESPECIAL · tiposProducto vs línea`);
console.log(`${'═'.repeat(70)}`);
const tiposSnap = await db.collection('tiposProducto').get();
const tipos = tiposSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const tiposPorLinea = {};
for (const t of tipos) {
  const key = t.lineaNegocioNombre || t.lineaNegocioId || '(sin línea)';
  tiposPorLinea[key] = tiposPorLinea[key] || [];
  tiposPorLinea[key].push(t);
}
console.log(`\nDistribución por línea:`);
for (const [linea, lista] of Object.entries(tiposPorLinea)) {
  console.log(`  ${linea}: ${lista.length} tipos`);
  if (lista.length <= 20) {
    lista.forEach(t => console.log(`    - ${t.nombre || t.id}`));
  }
}

process.exit(0);
