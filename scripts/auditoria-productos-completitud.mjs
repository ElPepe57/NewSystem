/**
 * Auditoría de completitud de productos · 2026-05-04
 * READ-ONLY · NO escribe nada en BD
 *
 * Por cada producto, evalúa qué campos están faltantes o incompletos.
 * Categoriza los huecos en:
 *   - DERIVABLE: se puede llenar desde datos existentes (cero invención)
 *   - APORTABLE: necesita que el usuario lea el producto físico (servings/día,
 *     peso unitario, dosaje, sabor, etc.)
 *   - IA: generable con Marketing IA + review humano
 *   - INVESTIGACIÓN: requiere búsqueda externa (proveedores, competidores)
 *
 * Outputs:
 *   1. Stats por campo · cuántos productos tienen cada hueco
 *   2. Stats por línea (SUP vs SKC)
 *   3. Top 20 productos críticos (más huecos)
 *   4. Lista completa exportada a backups/auditoria-productos-{ts}.json
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync, mkdirSync } from 'node:fs';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

// ─── Helpers ─────────────────────────────────────────────────────────────────
const isEmptyStr = (s) => !s || (typeof s === 'string' && s.trim().length === 0);
const isEmptyArr = (a) => !Array.isArray(a) || a.length === 0;
const hasNumber = (n) => typeof n === 'number' && isFinite(n) && n > 0;

// Detecta línea SKC/SUP/otra
function getLinea(p) {
  const linea = (p.lineaNegocioNombre ?? '').toLowerCase();
  if (linea.includes('skin')) return 'SKC';
  if (linea.includes('suplem') || linea.includes('vitam')) return 'SUP';
  return 'OTRA';
}

// ─── Auditoría por producto ──────────────────────────────────────────────────
function auditarProducto(p) {
  const linea = getLinea(p);
  const huecos = {
    derivable: [],
    aportable: [],
    ia: [],
    investigacion: [],
  };

  // === Identidad ===
  if (isEmptyStr(p.marca)) huecos.aportable.push('marca');
  if (isEmptyStr(p.nombreComercial)) huecos.aportable.push('nombreComercial');
  if (isEmptyStr(p.lineaNegocioNombre) && isEmptyStr(p.lineaNegocioId)) huecos.aportable.push('lineaNegocio');
  if (isEmptyStr(p.paisOrigen)) huecos.aportable.push('paisOrigen');

  // === Identificadores ===
  if (isEmptyStr(p.codigoUPC)) huecos.aportable.push('codigoUPC');

  // ContenidoNeto: si NO tiene estructurado pero SÍ tiene `contenido` legacy parseable → DERIVABLE
  if (!p.contenidoNeto || !hasNumber(p.contenidoNeto.valor)) {
    if (typeof p.contenido === 'string' && /^([\d.]+)\s*\w+/.test(p.contenido)) {
      huecos.derivable.push('contenidoNeto (parseable de contenido legacy)');
    } else {
      huecos.aportable.push('contenidoNeto');
    }
  }

  // === Servings (solo SUP) ===
  if (linea === 'SUP') {
    if (!hasNumber(p.servingsPerDay)) huecos.aportable.push('servingsPerDay');
  }

  // === Atributos por línea ===
  if (linea === 'SKC') {
    const skc = p.atributosSkincare || {};
    if (isEmptyStr(skc.tipoProductoSKC)) huecos.aportable.push('atributosSkincare.tipoProductoSKC');
    if (isEmptyStr(skc.ingredienteClave)) huecos.aportable.push('atributosSkincare.ingredienteClave');
    if (isEmptyArr(skc.tipoPiel)) huecos.aportable.push('atributosSkincare.tipoPiel');
    if (isEmptyArr(skc.preocupaciones)) huecos.aportable.push('atributosSkincare.preocupaciones');
    if (isEmptyStr(skc.pasoRutina)) huecos.aportable.push('atributosSkincare.pasoRutina');
    if (isEmptyStr(skc.textura)) huecos.aportable.push('atributosSkincare.textura');
    if (isEmptyArr(skc.zonaAplicacion)) huecos.aportable.push('atributosSkincare.zonaAplicacion');
  }
  if (linea === 'SUP') {
    const sup = p.atributosSuplementos || {};
    if (isEmptyStr(sup.dosaje)) huecos.aportable.push('atributosSuplementos.dosaje');
    if (isEmptyArr(sup.momentoDia)) huecos.aportable.push('atributosSuplementos.momentoDia');
    if (isEmptyStr(sup.tomaConComida)) huecos.aportable.push('atributosSuplementos.tomaConComida');
    if (isEmptyStr(sup.edadRecomendada)) huecos.aportable.push('atributosSuplementos.edadRecomendada');
    if (isEmptyArr(sup.restricciones)) huecos.aportable.push('atributosSuplementos.restricciones');
    if (isEmptyStr(sup.sabor)) huecos.aportable.push('atributosSuplementos.sabor');
  }

  // === Clasificación ===
  if (isEmptyStr(p.tipoProductoId)) huecos.aportable.push('tipoProducto');
  if (isEmptyArr(p.categoriaIds)) huecos.aportable.push('categorias');
  if (isEmptyArr(p.etiquetaIds)) huecos.aportable.push('etiquetas');

  // === Logística ===
  if (!hasNumber(p.pesoLibras)) huecos.aportable.push('pesoLibras');

  // === Marketing IA (4 niveles · S3.4) ===
  const m = p.descripcionMarketing;
  if (!m || !m.tagline?.texto || !m.descripcion?.texto || isEmptyArr(m.beneficios?.texto)) {
    // Si tiene los datos mínimos para que la IA genere bien (marca + nombre + línea + atributos)
    const datosMinimos = !isEmptyStr(p.marca) && !isEmptyStr(p.nombreComercial) && !isEmptyStr(p.lineaNegocioNombre);
    if (datosMinimos) {
      huecos.ia.push('descripcionMarketing (4 niveles · IA + review)');
    } else {
      huecos.aportable.push('descripcionMarketing (faltan datos básicos antes)');
    }
  } else if (!m.keywordsSEO?.texto || isEmptyArr(m.keywordsSEO.texto)) {
    // Tiene tagline + beneficios + descripción pero falta keywordsSEO (campo nuevo S3.4)
    huecos.ia.push('keywordsSEO (regenerar marketing con prompt SEO)');
  }

  // === Investigación ===
  const inv = p.investigacion ?? {};
  if (isEmptyArr(inv.proveedoresUSA)) huecos.investigacion.push('proveedoresUSA');
  if (isEmptyArr(inv.competidoresPeru)) huecos.investigacion.push('competidoresPeru');
  if (!hasNumber(inv.fleteUSD)) huecos.investigacion.push('fleteUSD');

  // === Precio venta ===
  if (!hasNumber(p.precioVenta)) huecos.aportable.push('precioVenta');

  return { id: p.id, sku: p.sku, marca: p.marca, nombre: p.nombreComercial, linea, huecos };
}

// ─── Main ────────────────────────────────────────────────────────────────────
console.log(`═══ Auditoría completitud de productos · ${new Date().toISOString()} ═══`);
console.log(`Modo: READ-ONLY · sin escritura\n`);

const snap = await db.collection('productos').get();
console.log(`Productos totales: ${snap.size}\n`);

const resultados = [];
for (const d of snap.docs) {
  resultados.push(auditarProducto({ id: d.id, ...d.data() }));
}

// ─── 1. Stats por campo (en cuántos productos aparece cada hueco) ────────────
const conteoCampo = {};
function bumpCampo(label, categoria) {
  const key = `${categoria}::${label}`;
  conteoCampo[key] = (conteoCampo[key] || 0) + 1;
}
for (const r of resultados) {
  for (const h of r.huecos.derivable) bumpCampo(h, 'DERIVABLE');
  for (const h of r.huecos.aportable) bumpCampo(h, 'APORTABLE');
  for (const h of r.huecos.ia) bumpCampo(h, 'IA');
  for (const h of r.huecos.investigacion) bumpCampo(h, 'INVESTIG');
}
const camposOrdenados = Object.entries(conteoCampo).sort((a, b) => b[1] - a[1]);

console.log(`═══ HUECOS POR CAMPO (de mayor a menor) ═══`);
for (const [key, count] of camposOrdenados) {
  const [cat, label] = key.split('::');
  const pct = Math.round((count / resultados.length) * 100);
  console.log(`  [${cat.padEnd(8)}] ${label.padEnd(48)} ${String(count).padStart(4)} productos (${pct}%)`);
}

// ─── 2. Stats por línea ──────────────────────────────────────────────────────
console.log(`\n═══ STATS POR LÍNEA ═══`);
const porLinea = { SKC: { total: 0, completos: 0, conHuecos: 0 }, SUP: { total: 0, completos: 0, conHuecos: 0 }, OTRA: { total: 0, completos: 0, conHuecos: 0 } };
for (const r of resultados) {
  const totalHuecos = r.huecos.derivable.length + r.huecos.aportable.length + r.huecos.ia.length + r.huecos.investigacion.length;
  porLinea[r.linea].total++;
  if (totalHuecos === 0) porLinea[r.linea].completos++;
  else porLinea[r.linea].conHuecos++;
}
for (const [linea, s] of Object.entries(porLinea)) {
  if (s.total === 0) continue;
  const pctCompletos = s.total > 0 ? Math.round((s.completos / s.total) * 100) : 0;
  console.log(`  ${linea}: ${s.total} productos · ${s.completos} completos (${pctCompletos}%) · ${s.conHuecos} con huecos`);
}

// ─── 3. Top 20 productos más críticos ────────────────────────────────────────
console.log(`\n═══ TOP 20 PRODUCTOS CON MÁS HUECOS ═══`);
const ranked = resultados
  .map(r => ({ ...r, totalHuecos: r.huecos.derivable.length + r.huecos.aportable.length + r.huecos.ia.length + r.huecos.investigacion.length }))
  .filter(r => r.totalHuecos > 0)
  .sort((a, b) => b.totalHuecos - a.totalHuecos)
  .slice(0, 20);
for (const r of ranked) {
  console.log(`  [${r.totalHuecos.toString().padStart(2)}] ${r.sku.padEnd(10)} ${(r.marca || '?').substring(0, 22).padEnd(22)} ${(r.nombre || '?').substring(0, 50)}`);
}

// ─── 4. Productos completos ─────────────────────────────────────────────────
const completos = resultados.filter(r => {
  const total = r.huecos.derivable.length + r.huecos.aportable.length + r.huecos.ia.length + r.huecos.investigacion.length;
  return total === 0;
});
console.log(`\n═══ PRODUCTOS 100% COMPLETOS ═══`);
console.log(`  ${completos.length} de ${resultados.length}`);
if (completos.length > 0 && completos.length <= 10) {
  completos.forEach(r => console.log(`  - ${r.sku} · ${r.marca} · ${r.nombre}`));
}

// ─── 5. Export completo a JSON ───────────────────────────────────────────────
const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const filename = `backups/auditoria-productos-${ts}.json`;
mkdirSync('backups', { recursive: true });
writeFileSync(filename, JSON.stringify({
  meta: {
    fecha: new Date().toISOString(),
    totalProductos: resultados.length,
    porLinea,
    conteoCampo: Object.fromEntries(camposOrdenados),
    completos: completos.length,
  },
  productos: resultados,
}, null, 2));

console.log(`\n✅ Reporte completo guardado en: ${filename}`);
process.exit(0);
