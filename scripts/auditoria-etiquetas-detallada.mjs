/**
 * Auditoría detallada de etiquetas · 2026-05-04 · READ-ONLY
 *
 * Genera reporte con cada etiqueta clasificada por tipo conceptual sugerido:
 *   - DESCRIPTIVA: temática del producto (Salud Ósea, Anti-edad)
 *   - CERTIFICACIÓN: sellos auditables (Non-GMO, GMP, Third-Party Tested)
 *   - RESTRICCIÓN: compatibilidad dietaria (Sin Gluten, Vegano, Halal, Kosher)
 *   - ORIGEN: lugar de procedencia (Importado USA)
 *   - COMERCIAL: positioning interno (Premium, Best Seller, Nuevo)
 *   - ATRIBUTO-MAL-PUESTO: pertenece a otro campo (Sin Sabor → sabor SUP, Cápsulas → unidad)
 *   - HUERFANA: 0 productos · candidato a archivar
 *   - AMBIGUA: requiere decisión humana
 *
 * Output: backups/etiquetas-clasificacion-{ts}.json + reporte stdout
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync, mkdirSync } from 'node:fs';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

// ─── Reglas heurísticas para clasificación ──────────────────────────────────
function clasificar(nombre) {
  const n = (nombre || '').toLowerCase().trim();

  // ATRIBUTO-MAL-PUESTO · cosas que viven en otro campo
  if (/^sin sabor|con sabor|sabor\b|^limón|^chocolate|^vainilla/.test(n)) return 'ATRIBUTO-SABOR';
  if (/^cápsulas|^tabletas|^gomitas|^líquid[oa]?|polvo$|sticks?|sobres?|presentación líquida|presentación/.test(n)) return 'ATRIBUTO-PRESENTACION';
  if (/^pack rutina|kit/.test(n)) return 'ATRIBUTO-PRESENTACION';

  // CERTIFICACIÓN · sellos auditables
  if (/non-?gmo|gmp|third-?party|usda organic|nsf|certif|fda|kosher.{0,8}cert|halal.{0,8}cert/.test(n)) return 'CERTIFICACION';

  // RESTRICCIÓN DIETARIA
  if (/sin gluten|sin lactosa|sin azúcar|sin soya|vegan|vegetarian|halal|kosher|paleo|keto|sin alcohol/.test(n)) return 'RESTRICCION';

  // ORIGEN
  if (/importad[oa]|made in|hecho en|usa\b|corea|perú|china|francia/.test(n)) return 'ORIGEN';

  // COMERCIAL
  if (/premium|valor|best.?seller|nuevo|oferta|descuento|recomendado|destacado|edición limitada|popular|exclusivo|margen alto|margen.?bajo/.test(n)) return 'COMERCIAL';

  // DESCRIPTIVA · temática del producto · si tiene "salud", "para X", "anti-X", etc.
  if (/salud|para |anti-?|función|sistema|hidrat|energía|sueño|relajación|cardio|cerebr|inmune|óse[oa]|articul|digesti|piel/.test(n)) return 'DESCRIPTIVA';

  // INGREDIENTE · si menciona compuestos
  if (/omega|magnesio|melatonina|colágeno|vitamina|zinc|hierro|calcio|probiotic|berberina|ashwagand|ácido|extracto/.test(n)) return 'INGREDIENTE';

  return 'AMBIGUA';
}

// ─── Cargar data ─────────────────────────────────────────────────────────────
const productosSnap = await db.collection('productos').get();
const productos = productosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

const etiquetasSnap = await db.collection('etiquetas').get();
const etiquetas = etiquetasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

// ─── Construir uso por etiqueta ──────────────────────────────────────────────
const usoPorEtiqueta = {};
for (const p of productos) {
  for (const id of (p.etiquetaIds || [])) {
    usoPorEtiqueta[id] = usoPorEtiqueta[id] || { count: 0, samples: [] };
    usoPorEtiqueta[id].count++;
    if (usoPorEtiqueta[id].samples.length < 3) {
      usoPorEtiqueta[id].samples.push(`${p.sku}:${p.nombreComercial}`);
    }
  }
}

// ─── Clasificar y generar reporte ───────────────────────────────────────────
const reporte = etiquetas.map(e => {
  const uso = usoPorEtiqueta[e.id] || { count: 0, samples: [] };
  const tipoSugerido = uso.count === 0 ? 'HUERFANA' : clasificar(e.nombre);
  return {
    id: e.id,
    nombre: e.nombre,
    estado: e.estado || (e.activo === false ? 'inactiva' : 'activa'),
    productos: uso.count,
    samples: uso.samples,
    tipoSugerido,
  };
}).sort((a, b) => {
  // Ordenar por tipo, luego por uso desc
  if (a.tipoSugerido !== b.tipoSugerido) return a.tipoSugerido.localeCompare(b.tipoSugerido);
  return b.productos - a.productos;
});

// ─── Stats por tipo ─────────────────────────────────────────────────────────
const stats = {};
for (const r of reporte) {
  stats[r.tipoSugerido] = (stats[r.tipoSugerido] || 0) + 1;
}
console.log(`═══ Clasificación sugerida · 82 etiquetas ═══\n`);
const ordenTipos = ['DESCRIPTIVA', 'CERTIFICACION', 'RESTRICCION', 'INGREDIENTE', 'ORIGEN', 'COMERCIAL', 'ATRIBUTO-SABOR', 'ATRIBUTO-PRESENTACION', 'AMBIGUA', 'HUERFANA'];
for (const t of ordenTipos) {
  if (stats[t]) {
    console.log(`  ${t.padEnd(25)} ${stats[t]}`);
  }
}

// ─── Listado por tipo ──────────────────────────────────────────────────────
console.log(`\n═══ DETALLE POR TIPO ═══`);
for (const tipo of ordenTipos) {
  const grupo = reporte.filter(r => r.tipoSugerido === tipo);
  if (grupo.length === 0) continue;
  console.log(`\n──── ${tipo} (${grupo.length}) ────`);
  for (const r of grupo) {
    console.log(`  [${String(r.productos).padStart(3)}] ${r.nombre.padEnd(40)} ${r.estado === 'activa' ? '' : '· ' + r.estado}`);
  }
}

// ─── Export ─────────────────────────────────────────────────────────────────
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const filename = `backups/etiquetas-clasificacion-${ts}.json`;
mkdirSync('backups', { recursive: true });
writeFileSync(filename, JSON.stringify({
  meta: { fecha: new Date().toISOString(), totalEtiquetas: reporte.length, stats },
  etiquetas: reporte,
}, null, 2));
console.log(`\n✅ Reporte guardado en: ${filename}`);

process.exit(0);
