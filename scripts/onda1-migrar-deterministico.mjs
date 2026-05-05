/**
 * Onda 1 · Migración determinista de campos legacy → estructurados (S3.4)
 * 2026-05-04
 *
 * Cero invención · cero IA · cero pérdida de info · campos legacy se preservan.
 *
 * 3 migraciones:
 *
 *   1. contenidoNeto · cross-línea
 *      Pasada A: parsea p.contenido directo si tiene "30 ml" / "60 cápsulas" (junto)
 *      Pasada B: combina p.contenido (solo número) + p.presentacion legacy
 *                ej. "300" + "Tabletas" → {valor:300, unidad:'tabletas'}
 *
 *   2. atributosSuplementos.dosaje · SOLO SUP
 *      Copy de p.dosaje legacy → p.atributosSuplementos.dosaje
 *
 *   3. atributosSuplementos.sabor · SOLO SUP
 *      Copy de p.sabor legacy → p.atributosSuplementos.sabor
 *
 * Reglas defensivas:
 *   - Si destino YA tiene valor → NO se sobrescribe (skip silencioso)
 *   - Si origen está vacío/no parseable → skip + log
 *   - Campos legacy NO se borran (compat con consumidores antiguos)
 *
 * Modo:
 *   --apply   → escribe en BD
 *   (default) → DRY-RUN · solo lista lo que haría
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');
const MODO = APPLY ? 'APPLY (escribe)' : 'DRY-RUN (no escribe)';

console.log(`═══ Onda 1 · Migración determinista · ${MODO} ═══\n`);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isEmptyStr(s) { return !s || (typeof s === 'string' && s.trim().length === 0); }
function getLinea(p) {
  const linea = (p.lineaNegocioNombre ?? '').toLowerCase();
  if (linea.includes('skin')) return 'SKC';
  if (linea.includes('suplem') || linea.includes('vitam')) return 'SUP';
  return 'OTRA';
}

// Mapa unidad legacy → unidad enum nueva (UnidadContenido)
const UNIDAD_MAP = {
  // SKC continuas
  'ml': 'ml', 'g': 'g', 'gr': 'g', 'gramos': 'g', 'gramo': 'g',
  'oz': 'oz', 'fl_oz': 'fl_oz', 'fl oz': 'fl_oz',
  'kg': 'kg', 'lb': 'lb', 'libras': 'lb',
  // SUP discretas
  'cápsulas': 'capsulas', 'capsulas': 'capsulas', 'caps': 'capsulas', 'cápsula': 'capsulas',
  'cápsulas blandas': 'capsulas', 'capsulas blandas': 'capsulas',
  'cápsulas vegetales': 'capsulas', 'capsulas vegetales': 'capsulas',
  'mini cápsulas blandas': 'capsulas', 'mini capsulas blandas': 'capsulas',
  'tabletas': 'tabletas', 'tabs': 'tabletas', 'tableta': 'tabletas',
  'gomitas': 'gomitas', 'gomita': 'gomitas',
  'sobres': 'sobres', 'sobre': 'sobres',
  'sticks': 'sticks', 'stick': 'sticks',
  'scoops': 'scoops', 'scoop': 'scoops',
  // Otros
  'unidades': 'unidades', 'unidad': 'unidades',
  'pares': 'pares', 'par': 'pares',
};

function normalizeUnidad(raw) {
  if (typeof raw !== 'string') return null;
  return UNIDAD_MAP[raw.trim().toLowerCase()] || null;
}

// Pasada A: p.contenido tiene "30 ml" / "60 cápsulas" (número + unidad junto)
function parseContenidoJunto(contenidoStr) {
  if (typeof contenidoStr !== 'string') return null;
  const m = contenidoStr.match(/^([\d.,]+)\s*([a-zA-Záéíóúñ]+(?:\s+[a-zA-Záéíóúñ]+)?)/);
  if (!m) return null;
  const valor = parseFloat(m[1].replace(',', '.'));
  if (!isFinite(valor) || valor <= 0) return null;
  const unidad = normalizeUnidad(m[2]);
  if (!unidad) return null;
  return { valor, unidad };
}

// Pasada B: p.contenido solo tiene número, p.presentacion tiene la unidad
function parseContenidoSeparado(contenidoStr, presentacionStr) {
  if (typeof contenidoStr !== 'string') return null;
  const m = contenidoStr.trim().match(/^([\d.,]+)$/);
  if (!m) return null;
  const valor = parseFloat(m[1].replace(',', '.'));
  if (!isFinite(valor) || valor <= 0) return null;
  const unidad = normalizeUnidad(presentacionStr);
  if (!unidad) return null;
  return { valor, unidad };
}

// ─── Main ────────────────────────────────────────────────────────────────────
const snap = await db.collection('productos').get();
console.log(`Productos totales: ${snap.size}\n`);

const acciones = [];
const skips = {
  contenidoNetoYaPresente: 0,
  dosajeYaPresente: 0,
  saborYaPresente: 0,
  contenidoNoMigrable: [],
};

for (const d of snap.docs) {
  const p = d.data();
  const linea = getLinea(p);
  const cambios = {};
  const motivos = [];

  // ─── 1. contenidoNeto · 2 pasadas ──────────────────────────────────────────
  if (!p.contenidoNeto || typeof p.contenidoNeto.valor !== 'number') {
    let parsed = parseContenidoJunto(p.contenido);
    let pasada = 'A';
    if (!parsed) {
      parsed = parseContenidoSeparado(p.contenido, p.presentacion);
      pasada = 'B';
    }
    if (parsed) {
      cambios.contenidoNeto = parsed;
      const fuente = pasada === 'A'
        ? `"${p.contenido}"`
        : `"${p.contenido}" + presentacion="${p.presentacion}"`;
      motivos.push(`contenidoNeto [pasada ${pasada}]: ${fuente} → {valor:${parsed.valor}, unidad:'${parsed.unidad}'}`);
    } else if (!isEmptyStr(p.contenido) || !isEmptyStr(p.presentacion)) {
      skips.contenidoNoMigrable.push({
        sku: p.sku,
        marca: p.marca,
        nombre: p.nombreComercial,
        contenido: p.contenido ?? null,
        presentacion: p.presentacion ?? null,
      });
    }
  } else {
    skips.contenidoNetoYaPresente++;
  }

  // ─── 2 y 3. Dosaje + Sabor → SOLO SUP ──────────────────────────────────────
  if (linea === 'SUP') {
    const supActual = p.atributosSuplementos || {};

    if (isEmptyStr(supActual.dosaje) && !isEmptyStr(p.dosaje)) {
      cambios['atributosSuplementos.dosaje'] = p.dosaje.trim();
      motivos.push(`dosaje: "${p.dosaje.trim()}" → atributosSuplementos.dosaje`);
    } else if (!isEmptyStr(supActual.dosaje)) {
      skips.dosajeYaPresente++;
    }

    if (isEmptyStr(supActual.sabor) && !isEmptyStr(p.sabor)) {
      cambios['atributosSuplementos.sabor'] = p.sabor.trim();
      motivos.push(`sabor: "${p.sabor.trim()}" → atributosSuplementos.sabor`);
    } else if (!isEmptyStr(supActual.sabor)) {
      skips.saborYaPresente++;
    }
  }

  if (Object.keys(cambios).length > 0) {
    acciones.push({ id: d.id, sku: p.sku, marca: p.marca, nombre: p.nombreComercial, linea, cambios, motivos });
  }
}

console.log(`═══ Acciones a aplicar: ${acciones.length} productos ═══\n`);

const statCambios = {};
for (const a of acciones) {
  for (const k of Object.keys(a.cambios)) {
    statCambios[k] = (statCambios[k] || 0) + 1;
  }
}
for (const [k, v] of Object.entries(statCambios)) {
  console.log(`  ${k.padEnd(40)} → ${v} productos`);
}

console.log(`\n═══ Skips ═══`);
console.log(`  contenidoNeto ya presente:      ${skips.contenidoNetoYaPresente}`);
console.log(`  dosaje ya presente (SUP):       ${skips.dosajeYaPresente}`);
console.log(`  sabor ya presente (SUP):        ${skips.saborYaPresente}`);
console.log(`  contenido NO MIGRABLE:          ${skips.contenidoNoMigrable.length}`);
if (skips.contenidoNoMigrable.length > 0) {
  console.log(`\n  Productos NO migrables (contenido + presentacion no parseables):`);
  for (const s of skips.contenidoNoMigrable) {
    console.log(`    - ${s.sku} · ${s.marca} · ${s.nombre} · contenido="${s.contenido}" presentacion="${s.presentacion}"`);
  }
}

// ─── Muestras ────────────────────────────────────────────────────────────────
console.log(`\n═══ MUESTRA · 8 ejemplos ═══`);
// 4 SUP + 4 SKC
const muestraSUP = acciones.filter(a => a.linea === 'SUP').slice(0, 4);
const muestraSKC = acciones.filter(a => a.linea === 'SKC').slice(0, 4);
[...muestraSUP, ...muestraSKC].forEach(a => {
  console.log(`\n  ${a.sku} · ${a.marca} · ${a.nombre}`);
  console.log(`  Línea: ${a.linea}`);
  for (const m of a.motivos) console.log(`    ✓ ${m}`);
});

if (!APPLY) {
  console.log(`\n💡 DRY-RUN · NO se escribió nada en BD.`);
  console.log(`   Para ejecutar de verdad: node scripts/onda1-migrar-deterministico.mjs --apply\n`);
  process.exit(0);
}

// ─── Apply ──────────────────────────────────────────────────────────────────
console.log(`\n🚨 APPLY · escribiendo en BD en 5 segundos · Ctrl+C para abortar...\n`);
await new Promise(r => setTimeout(r, 5000));

let written = 0;
let errors = 0;
for (const a of acciones) {
  try {
    const update = {};
    if (a.cambios.contenidoNeto) update.contenidoNeto = a.cambios.contenidoNeto;

    if (a.cambios['atributosSuplementos.dosaje'] || a.cambios['atributosSuplementos.sabor']) {
      const ref = db.doc(`productos/${a.id}`);
      const snap = await ref.get();
      const currentSup = snap.data()?.atributosSuplementos || {};
      const newSup = { ...currentSup };
      if (a.cambios['atributosSuplementos.dosaje']) newSup.dosaje = a.cambios['atributosSuplementos.dosaje'];
      if (a.cambios['atributosSuplementos.sabor']) newSup.sabor = a.cambios['atributosSuplementos.sabor'];
      update.atributosSuplementos = newSup;
    }

    update.ultimaEdicion = FieldValue.serverTimestamp();
    await db.doc(`productos/${a.id}`).update(update);
    written++;
  } catch (err) {
    console.error(`❌ Error en ${a.sku}: ${err.message}`);
    errors++;
  }
}

console.log(`\n═══ Resultado ═══`);
console.log(`  Escritos: ${written}`);
console.log(`  Errores:  ${errors}`);
console.log(`✅ Onda 1 completada`);
process.exit(0);
