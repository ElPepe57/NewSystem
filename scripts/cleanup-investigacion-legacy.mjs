/**
 * Limpieza · Campos LEGACY de investigación que ya no se usan
 *
 * Solicitado por usuario · 2026-05-03
 *   El frontend V2 ya no lee estos campos · todo se calcula en vivo desde
 *   proveedores + flete + TC vía calcularInvestigacion(). Los valores viejos
 *   solo confunden si por error algún componente los lee como fallback.
 *
 * Campos a eliminar de cada producto.investigacion:
 *   - precioSugeridoCalculado  ← causaba el bug S/77.82 en Zinc
 *   - precioEntrada            ← derivado del anterior
 *   - ctruEstimado             ← reemplazado por costoPEN en vivo
 *   - margenEstimado           ← reemplazado por margenPct en vivo
 *   - puntuacionViabilidad     ← scoring viejo · ya no se muestra
 *   - multiplicador            ← derivado · ya no se muestra
 *
 * NO se tocan (datos legítimos):
 *   - proveedoresUSA, competidoresPeru
 *   - fechaInvestigacion, vigenciaHasta, ultimaActualizacion
 *   - presenciaML, numeroCompetidores, nivelCompetencia
 *   - demandaEstimada, tendencia
 *   - recomendacion, razonamiento, notas
 *   - precioUSAMin/Max/Promedio, precioPERUMin/Max/Promedio (stats útiles)
 *
 * IMPORTANTE: el service.guardarInvestigacion vuelve a setear estos campos
 * cuando se guarda una nueva investigación. Esta limpieza es one-shot. Para
 * cierre permanente requerimos refactor del service (deuda menor declarada).
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const CAMPOS_LEGACY = [
  'precioSugeridoCalculado',
  'precioEntrada',
  'ctruEstimado',
  'margenEstimado',
  'puntuacionViabilidad',
  'multiplicador',
];

console.log('═══════════════════════════════════════════════════════════');
console.log('Limpieza · campos LEGACY de investigacion');
console.log('Campos a eliminar:', CAMPOS_LEGACY.join(', '));
console.log('═══════════════════════════════════════════════════════════\n');

const productosSnap = await db.collection('productos').get();
console.log(`Total productos: ${productosSnap.size}\n`);

const aLimpiar = [];
let sinInvestigacion = 0;
let sinCamposLegacy = 0;

for (const doc of productosSnap.docs) {
  const data = doc.data();
  const inv = data.investigacion;

  if (!inv) {
    sinInvestigacion++;
    continue;
  }

  // Detectar qué campos legacy tiene poblados
  const camposPresentes = CAMPOS_LEGACY.filter(c => inv[c] !== undefined);
  if (camposPresentes.length === 0) {
    sinCamposLegacy++;
    continue;
  }

  aLimpiar.push({
    id: doc.id,
    sku: data.sku,
    nombre: data.nombreComercial,
    camposPresentes,
    snapshot: Object.fromEntries(camposPresentes.map(c => [c, inv[c]])),
  });
}

console.log('Estado actual:');
console.log(`  Sin investigación:        ${sinInvestigacion}`);
console.log(`  Investig. ya limpia:      ${sinCamposLegacy}`);
console.log(`  Investig. con legacy:     ${aLimpiar.length}\n`);

if (aLimpiar.length === 0) {
  console.log('Nada que limpiar. Saliendo.');
  process.exit(0);
}

console.log('Sample (primeros 3):');
for (const p of aLimpiar.slice(0, 3)) {
  console.log(`  ${p.sku} · ${p.nombre.slice(0, 35)}`);
  for (const [k, v] of Object.entries(p.snapshot)) {
    console.log(`    inv.${k} = ${typeof v === 'number' ? v.toFixed(2) : v}`);
  }
}

console.log('\nEjecutando limpieza en lotes de 100 (transacciones batch)...\n');

const BATCH_SIZE = 100;
let actualizados = 0;
let errores = 0;

for (let i = 0; i < aLimpiar.length; i += BATCH_SIZE) {
  const lote = aLimpiar.slice(i, i + BATCH_SIZE);
  const batch = db.batch();
  for (const p of lote) {
    const ref = db.collection('productos').doc(p.id);
    // Eliminar cada campo nested usando FieldValue.delete con dot path
    const updates = {};
    for (const campo of p.camposPresentes) {
      updates[`investigacion.${campo}`] = FieldValue.delete();
    }
    batch.update(ref, updates);
  }
  try {
    await batch.commit();
    actualizados += lote.length;
    console.log(`  ✓ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${lote.length} limpiados (acumulado ${actualizados}/${aLimpiar.length})`);
  } catch (err) {
    errores += lote.length;
    console.error(`  ✗ Lote ${Math.floor(i / BATCH_SIZE) + 1} falló:`, err.message);
  }
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('Resumen final:');
console.log(`  ✓ Limpiados: ${actualizados}`);
if (errores > 0) console.log(`  ✗ Errores:   ${errores}`);
console.log('═══════════════════════════════════════════════════════════');
process.exit(errores > 0 ? 1 : 0);
