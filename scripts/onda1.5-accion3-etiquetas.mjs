/**
 * Onda 1.5 · ACCIÓN 3 · Saneamiento de etiquetas · 2026-05-04
 * READ-ONLY default · escribe solo con --apply
 *
 * 7 pasos · 100% derivable · cero invención:
 *
 * PASO 1 · Renombrar "Importado USA" → "Made in USA"
 *          + actualizar 155 snapshots producto.etiquetasData[].nombre
 *
 * PASO 2 · Eliminar duplicada "Made in USA" huérfana (TR-XXX original sin uso)
 *
 * PASO 3 · Eliminar etiquetas redundantes con campos producto
 *   3a. "Sin Sabor" (104 productos) · info ya está en atributosSuplementos.sabor
 *   3b. "Con Sabor" (51 productos)  · idem
 *   3c. "Formato Líquido" (19) · ya en contenidoNeto.unidad='ml'
 *   3d. "Formato Gomitas" (15) · ya en contenidoNeto.unidad='gomitas'
 *   3e. "Formato Polvo" (3)    · ya en contenidoNeto.unidad='g'
 *   Para cada una: backup + quitar de etiquetaIds + etiquetasData de cada producto + delete etiqueta
 *
 * PASO 4 · Asignar `tipo` correcto a etiquetas activas (clasificación validada con usuario)
 *
 * PASO 5 · Archivar 10 huérfanas confusas (sin valor claro)
 *
 * PASO 6 · Mantener activas las 38 huérfanas latentes (útiles potenciales + comerciales)
 *          + asignar `tipo` correcto a cada una
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { writeFileSync, mkdirSync } from 'node:fs';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');
console.log(`═══ Onda 1.5 · Acción 3 · Etiquetas · ${APPLY ? 'APPLY' : 'DRY-RUN'} ═══\n`);

// ─── IDs y nombres clave ─────────────────────────────────────────────────────
const IDS = {
  IMPORTADO_USA: 'SYZRSysHRyzneQZx58XA',
  MADE_IN_USA_HUERF: 'b8tSRz3Jmn6mqu5r5SW0',
  SIN_SABOR: 'egtKl42MOloR2qhmoOcE',
  CON_SABOR: 'Jbaza3fq94Cq2hRkd06H',
  FORMATO_LIQUIDO: '2VRV4F67s1kdRljRq6k5',
  FORMATO_GOMITAS: 'yV4qSITcj3TF4qH0WvpF',
  FORMATO_POLVO: 'IISaC8tTFb8M7QFUKccU',
};

// Clasificación final por tipo · acordada con usuario
const CLASIFICACION = {
  // ── DESCRIPTIVAS (público + temáticas) ─────────────────────────────────────
  descriptiva: [
    'Para Niños', 'Para Adultos', 'Para Mujeres', 'Para Hombres', 'Para Bebés', 'Para Adolescentes',
    'Fórmula Combinada', 'Original Formula',
    'Para Embarazo', 'Para Mayores +50', 'Familiar',
    'Piel Sensible', 'Piel Grasa', 'Piel Seca',
    'Uso Deportivo',
  ],
  // ── CERTIFICACIONES ────────────────────────────────────────────────────────
  certificacion: [
    'Third-Party Tested', 'Non-GMO', 'GMP Certified', 'Non-GMO Project Verified',
    'NSF Certified', 'USDA Organic', 'B Corp Certified',
    'Friend of the Sea', 'Clean Label Project',
    'Cruelty-Free',
  ],
  // ── RESTRICCIONES DIETARIAS ────────────────────────────────────────────────
  restriccion: [
    'Sin Gluten', 'Vegetariano', 'Vegano', 'Sin Soya', 'Sin Azúcar',
    'Drug-Free', 'Sin Lácteos',
    'Sin Alcohol', 'Apto Keto', 'Kosher', 'Sin Fragancia', 'Sin Parabenos',
  ],
  // ── ORIGEN ─────────────────────────────────────────────────────────────────
  origen: [
    'Made in USA', // antes "Importado USA"
    'Importado Corea', 'Importado Japón', 'Importado China',
  ],
  // ── COMERCIAL ──────────────────────────────────────────────────────────────
  comercial: [
    'Marca Valor', 'Marca Premium',
    'Best-Seller', 'Trending', 'Edición Limitada', 'Producto Estrella',
    'Ingrediente Estrella', 'Nuevo Lanzamiento', 'Margen Alto', 'Competencia Baja',
  ],
  // ── INGREDIENTE ────────────────────────────────────────────────────────────
  ingrediente: [
    'Probiótico', 'Multivitamínico', 'Colágeno', 'Vitamina D', 'Magnesio',
    'Omega / DHA', 'Melatonina / Sueño',
  ],
  // ── PERFORMANCE / CARACTERÍSTICAS ─────────────────────────────────────────
  performance: [
    'Alta Absorción', 'Alta Potencia', 'Disolución Rápida', 'Fácil de Tragar',
    'Con SPF', 'Sabor Agradable', 'Requiere Frío',
  ],
  // ── PACK ───────────────────────────────────────────────────────────────────
  pack: [
    'Pack Rutina', // mantenida porque hay 2 productos rutinas
  ],
};

const ETIQUETAS_ARCHIVAR = [
  'Rutina 10 Pasos',
  'K-Beauty Classic',
  'Alto Contenido',
  'Science-Based',
  'pH Bajo',
  'Fecha Corta',
  'Rendimiento +90 días',
  'Uso Tópico',
  'Dermatológicamente Testeado',
  'Presentación Líquida',
];

// ─── Cargar data ─────────────────────────────────────────────────────────────
const etiquetasSnap = await db.collection('etiquetas').get();
const etiquetasByName = {};
const etiquetasById = {};
for (const d of etiquetasSnap.docs) {
  const data = { id: d.id, ...d.data() };
  etiquetasByName[data.nombre] = data;
  etiquetasById[data.id] = data;
}

const productosSnap = await db.collection('productos').get();
const productos = productosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

// Construir nombre→tipo lookup invertido
const nombreATipo = {};
for (const [tipo, nombres] of Object.entries(CLASIFICACION)) {
  for (const n of nombres) nombreATipo[n] = tipo;
}

// ─── Helper · productos que tienen una etiqueta ─────────────────────────────
function productosConEtiqueta(etiquetaId) {
  return productos.filter(p => (p.etiquetaIds || []).includes(etiquetaId));
}

// ─── PASO 1 · Renombrar "Importado USA" → "Made in USA" ─────────────────────
console.log(`\n══ PASO 1 · Renombrar "Importado USA" → "Made in USA" ══`);
const prodsImportadoUSA = productosConEtiqueta(IDS.IMPORTADO_USA);
console.log(`  Etiqueta ID: ${IDS.IMPORTADO_USA}`);
console.log(`  Productos a actualizar snapshot: ${prodsImportadoUSA.length}`);

// ─── PASO 2 · Eliminar duplicada "Made in USA" huérfana ────────────────────
console.log(`\n══ PASO 2 · Eliminar etiqueta huérfana "Made in USA" duplicada ══`);
console.log(`  ID: ${IDS.MADE_IN_USA_HUERF}`);
console.log(`  Productos asociados: ${productosConEtiqueta(IDS.MADE_IN_USA_HUERF).length} (esperado 0)`);

// ─── PASO 3 · Eliminar etiquetas redundantes ────────────────────────────────
console.log(`\n══ PASO 3 · Eliminar etiquetas redundantes con campos producto ══`);
const etiquetasARemover = [
  { id: IDS.SIN_SABOR, nombre: 'Sin Sabor' },
  { id: IDS.CON_SABOR, nombre: 'Con Sabor' },
  { id: IDS.FORMATO_LIQUIDO, nombre: 'Formato Líquido' },
  { id: IDS.FORMATO_GOMITAS, nombre: 'Formato Gomitas' },
  { id: IDS.FORMATO_POLVO, nombre: 'Formato Polvo' },
];
const productosAfectadosPaso3 = new Set();
for (const e of etiquetasARemover) {
  const prods = productosConEtiqueta(e.id);
  prods.forEach(p => productosAfectadosPaso3.add(p.id));
  console.log(`  ${e.nombre.padEnd(20)} · ${prods.length} productos`);
}
console.log(`  Total productos únicos afectados: ${productosAfectadosPaso3.size}`);

// ─── PASO 4 · Asignar tipo a etiquetas activas (las que existen) ────────────
console.log(`\n══ PASO 4 · Asignar tipo correcto a etiquetas existentes ══`);
const updatesTipo = [];
for (const e of Object.values(etiquetasById)) {
  // Si está en lista de eliminar, skip (se borrará)
  if (etiquetasARemover.some(x => x.id === e.id)) continue;
  // Si está en lista de archivar, skip (se archiva en paso 5)
  if (ETIQUETAS_ARCHIVAR.includes(e.nombre)) continue;
  // Si la huérfana Made in USA, skip (se elimina paso 2)
  if (e.id === IDS.MADE_IN_USA_HUERF) continue;

  let nuevoTipo = nombreATipo[e.nombre];
  let nuevoNombre = e.nombre;

  // Caso especial: Importado USA → renombrar a Made in USA · tipo = origen
  if (e.id === IDS.IMPORTADO_USA) {
    nuevoNombre = 'Made in USA';
    nuevoTipo = 'origen';
  }

  if (!nuevoTipo) {
    console.log(`  ⚠ Sin clasificación: "${e.nombre}" · skip (queda con tipo actual "${e.tipo}")`);
    continue;
  }

  if (e.tipo !== nuevoTipo || e.nombre !== nuevoNombre) {
    updatesTipo.push({ id: e.id, antes: { nombre: e.nombre, tipo: e.tipo }, despues: { nombre: nuevoNombre, tipo: nuevoTipo } });
  }
}
console.log(`  Etiquetas a reclasificar: ${updatesTipo.length}`);
updatesTipo.slice(0, 8).forEach(u => {
  const cambio = u.antes.nombre !== u.despues.nombre ? `"${u.antes.nombre}" → "${u.despues.nombre}" · ` : '';
  console.log(`    - ${cambio}tipo: ${u.antes.tipo || '(sin)'} → ${u.despues.tipo}`);
});
if (updatesTipo.length > 8) console.log(`    ... y ${updatesTipo.length - 8} más`);

// ─── PASO 5 · Archivar 10 huérfanas confusas ────────────────────────────────
console.log(`\n══ PASO 5 · Archivar 10 huérfanas sin valor claro ══`);
const archivar = [];
for (const nombre of ETIQUETAS_ARCHIVAR) {
  const e = etiquetasByName[nombre];
  if (!e) {
    console.log(`  ⚠ "${nombre}" no encontrada · skip`);
    continue;
  }
  const prods = productosConEtiqueta(e.id);
  if (prods.length > 0) {
    console.log(`  ⚠ "${nombre}" tiene ${prods.length} productos · NO es huérfana · skip`);
    continue;
  }
  archivar.push(e);
}
console.log(`  Etiquetas a archivar: ${archivar.length}`);
archivar.forEach(e => console.log(`    - "${e.nombre}"`));

// ─── Resumen ────────────────────────────────────────────────────────────────
console.log(`\n══ RESUMEN ══`);
const totalEscrituras =
  1 + prodsImportadoUSA.length  // PASO 1
  + 1                            // PASO 2
  + etiquetasARemover.length + productosAfectadosPaso3.size  // PASO 3
  + updatesTipo.length           // PASO 4
  + archivar.length;             // PASO 5
console.log(`  Total escrituras estimadas: ${totalEscrituras}`);

// ─── DRY-RUN: terminar acá ───────────────────────────────────────────────────
if (!APPLY) {
  console.log(`\n💡 DRY-RUN · NO se escribió nada en BD.`);
  console.log(`   Para ejecutar: node scripts/onda1.5-accion3-etiquetas.mjs --apply\n`);
  process.exit(0);
}

// ─── APPLY ──────────────────────────────────────────────────────────────────
console.log(`\n🚨 APPLY · 5 segundos para abortar (Ctrl+C)...\n`);
await new Promise(r => setTimeout(r, 5000));

const ahora = FieldValue.serverTimestamp();
let written = 0, errors = 0;

// Backup defensivo de las etiquetas a eliminar
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupPath = `backups/etiquetas-eliminadas-${ts}.json`;
const eliminadas = [
  { id: IDS.MADE_IN_USA_HUERF, doc: etiquetasById[IDS.MADE_IN_USA_HUERF] },
  ...etiquetasARemover.map(e => ({ id: e.id, doc: etiquetasById[e.id] })),
];
mkdirSync('backups', { recursive: true });
writeFileSync(backupPath, JSON.stringify({
  meta: { fecha: new Date().toISOString(), motivo: 'Onda 1.5 Acción 3 · saneamiento etiquetas' },
  eliminadas,
}, null, 2));
console.log(`✓ Backup defensivo: ${backupPath}\n`);

// PASO 1 · Renombrar Importado USA + actualizar snapshots
try {
  await db.doc(`etiquetas/${IDS.IMPORTADO_USA}`).update({
    nombre: 'Made in USA',
    nombreNormalizado: 'made in usa',
    slug: 'made-in-usa',
    tipo: 'origen',
    ultimaEdicion: ahora,
  });
  console.log(`✅ PASO 1: etiqueta renombrada "Importado USA" → "Made in USA"`);
  written++;

  // Actualizar snapshots en productos
  for (const p of prodsImportadoUSA) {
    const newData = (p.etiquetasData || []).map(e =>
      e.etiquetaId === IDS.IMPORTADO_USA ? { ...e, nombre: 'Made in USA', tipo: 'origen' } : e
    );
    await db.doc(`productos/${p.id}`).update({
      etiquetasData: newData,
      ultimaEdicion: ahora,
    });
    written++;
  }
  console.log(`   ✅ ${prodsImportadoUSA.length} snapshots de productos actualizados`);
} catch (e) { console.error(`❌ PASO 1: ${e.message}`); errors++; }

// PASO 2 · Eliminar Made in USA huérfana duplicada
try {
  await db.doc(`etiquetas/${IDS.MADE_IN_USA_HUERF}`).delete();
  console.log(`✅ PASO 2: huérfana "Made in USA" eliminada`);
  written++;
} catch (e) { console.error(`❌ PASO 2: ${e.message}`); errors++; }

// PASO 3 · Eliminar redundantes + quitar de productos
console.log(`\n· PASO 3 · Eliminando etiquetas redundantes`);
for (const e of etiquetasARemover) {
  try {
    const prods = productosConEtiqueta(e.id);
    for (const p of prods) {
      const newIds = (p.etiquetaIds || []).filter(x => x !== e.id);
      const newData = (p.etiquetasData || []).filter(x => x.etiquetaId !== e.id);
      await db.doc(`productos/${p.id}`).update({
        etiquetaIds: newIds,
        etiquetasData: newData,
        ultimaEdicion: ahora,
      });
      written++;
    }
    await db.doc(`etiquetas/${e.id}`).delete();
    console.log(`   ✅ "${e.nombre}" eliminada · ${prods.length} productos limpiados`);
    written++;
  } catch (err) { console.error(`❌ PASO 3 "${e.nombre}": ${err.message}`); errors++; }
}

// PASO 4 · Reclasificar etiquetas (asignar tipo)
console.log(`\n· PASO 4 · Reclasificando etiquetas`);
for (const u of updatesTipo) {
  try {
    const update = { tipo: u.despues.tipo, ultimaEdicion: ahora };
    if (u.antes.nombre !== u.despues.nombre) {
      update.nombre = u.despues.nombre;
    }
    await db.doc(`etiquetas/${u.id}`).update(update);
    written++;
  } catch (e) { console.error(`❌ PASO 4 "${u.antes.nombre}": ${e.message}`); errors++; }
}
console.log(`   ✅ ${updatesTipo.length} etiquetas reclasificadas`);

// PASO 5 · Archivar 10 huérfanas
console.log(`\n· PASO 5 · Archivando 10 huérfanas confusas`);
for (const e of archivar) {
  try {
    await db.doc(`etiquetas/${e.id}`).update({
      estado: 'archivada',
      archivadaEn: ahora,
      archivadaMotivo: 'Onda 1.5 Acción 3 · sin valor claro · 0 productos asociados',
      ultimaEdicion: ahora,
    });
    console.log(`   ✅ "${e.nombre}" archivada`);
    written++;
  } catch (err) { console.error(`❌ PASO 5 "${e.nombre}": ${err.message}`); errors++; }
}

console.log(`\n═══ Resultado ═══`);
console.log(`  Escritos: ${written}`);
console.log(`  Errores:  ${errors}`);
console.log(`✅ Onda 1.5 Acción 3 completada`);
process.exit(0);
