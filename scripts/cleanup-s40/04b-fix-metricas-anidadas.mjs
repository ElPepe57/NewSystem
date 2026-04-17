/**
 * ========================================================================
 * CLEANUP S40 — FASE 4B: FIX MÉTRICAS ANIDADAS
 * ========================================================================
 *
 * Corrección de la Fase 4: algunas métricas transaccionales viven DENTRO
 * de un objeto `metricas: {}` anidado, no en top-level. Post-cleanup
 * de transaccionales, estos contadores anidados quedaron con valores de
 * cuando había OCs/envíos/ventas.
 *
 * Corrige:
 *   proveedores:
 *     metricas.ordenesCompra → 0
 *     metricas.montoTotalUSD → 0
 *     metricas.ultimaCompra → delete
 *
 *   colaboradores:
 *     metricas.enviosRealizados → 0
 *     metricas.enviosCompletados → 0
 *     metricas.enviosConIncidencia → 0
 *     metricas.tasaIncidencias → 0
 *     metricas.unidadesTransportadas → 0
 *     metricas.tiempoPromedioEntregaDias → 0
 *
 *   tiposProducto:
 *     metricas.unidadesVendidas → 0
 *     metricas.ventasTotalPEN → 0
 *     metricas.margenPromedio → 0
 *     (PRESERVA: metricas.productosActivos — es conteo de productos, no venta)
 *
 * NO TOCA:
 *   marcas.productosTotal / productosActivos (conteo real de productos)
 *   categorias.productosTotal / productosActivos
 *   competidores.metricas.* (investigación de mercado, no ventas)
 *
 * Uso:
 *   DRY RUN:  node scripts/cleanup-s40/04b-fix-metricas-anidadas.mjs
 *   EJECUTAR: node scripts/cleanup-s40/04b-fix-metricas-anidadas.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');
const BATCH_LIMIT = 450;

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', bold: '\x1b[1m', dim: '\x1b[2m',
};

/**
 * Definición de resets anidados.
 * Claves con notación punto: 'metricas.X'.
 * Valor `null` → usar FieldValue.delete().
 */
const RESETS_ANIDADOS = {
  proveedores: {
    'metricas.ordenesCompra': 0,
    'metricas.montoTotalUSD': 0,
    'metricas.ultimaCompra': null,  // delete
  },
  colaboradores: {
    'metricas.enviosRealizados': 0,
    'metricas.enviosCompletados': 0,
    'metricas.enviosConIncidencia': 0,
    'metricas.tasaIncidencias': 0,
    'metricas.unidadesTransportadas': 0,
    'metricas.tiempoPromedioEntregaDias': 0,
  },
  tiposProducto: {
    'metricas.unidadesVendidas': 0,
    'metricas.ventasTotalPEN': 0,
    'metricas.margenPromedio': 0,
    // NO se resetea metricas.productosActivos (es conteo real de productos)
  },
  // Nota: marcas, categorias y competidores se evaluaron y NO requieren reset anidado
  // (sus métricas transaccionales ya están top-level y fueron reseteadas en Fase 4).
};

/**
 * Detecta proveedores/colaboradores/tiposProducto con residuos para mostrar qué se va a tocar.
 */
async function detectarResiduos(colName, resetMap) {
  const snap = await db.collection(colName).get();
  const afectados = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const metricas = data.metricas || {};
    const fieldsToCheck = Object.keys(resetMap).map(k => k.replace('metricas.', ''));
    const tieneResiduo = fieldsToCheck.some(f => {
      const val = metricas[f];
      if (val === undefined) return false;
      if (typeof val === 'number') return val !== 0;
      return true; // Timestamp o no-null
    });
    if (tieneResiduo) {
      afectados.push({ id: doc.id, nombre: data.nombre || data.codigo || doc.id.slice(0, 8), metricas });
    }
  }
  return { total: snap.size, afectados };
}

async function resetCollection(colName, resetMap, isDryRun) {
  const { total, afectados } = await detectarResiduos(colName, resetMap);

  console.log(`${C.bold}${colName}${C.reset} (${total} docs totales, ${afectados.length} con residuo)`);
  if (afectados.length === 0) {
    console.log(`  ${C.green}✓ Sin residuos${C.reset}`);
    return { total, afectados: 0 };
  }

  // Mostrar los afectados
  for (const a of afectados.slice(0, 10)) {
    const residuos = Object.entries(resetMap)
      .map(([k]) => {
        const field = k.replace('metricas.', '');
        const v = a.metricas[field];
        if (v === undefined || v === 0) return null;
        return `${field}=${typeof v === 'number' ? v : 'Timestamp'}`;
      })
      .filter(Boolean)
      .join(', ');
    console.log(`  ${C.yellow}→ ${a.nombre.padEnd(35)} ${residuos}${C.reset}`);
  }
  if (afectados.length > 10) console.log(`  ${C.dim}  +${afectados.length - 10} más…${C.reset}`);

  if (isDryRun) return { total, afectados: afectados.length, dryRun: true };

  // Construir updates
  const updates = {};
  for (const [k, v] of Object.entries(resetMap)) {
    updates[k] = v === null ? FieldValue.delete() : v;
  }

  let processed = 0;
  for (let i = 0; i < afectados.length; i += BATCH_LIMIT) {
    const chunk = afectados.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const a of chunk) {
      batch.update(db.collection(colName).doc(a.id), updates);
    }
    await batch.commit();
    processed += chunk.length;
    process.stdout.write(`\r  ${C.green}✓ ${processed}/${afectados.length} docs actualizados${C.reset}     `);
  }
  process.stdout.write('\n');
  return { total, afectados: afectados.length };
}

async function main() {
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}${C.cyan}  CLEANUP S40 — FASE 4B: FIX MÉTRICAS ANIDADAS${C.reset}`);
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(DRY_RUN
    ? `${C.yellow}${C.bold}MODO DRY-RUN. Usa --execute para ejecutar.${C.reset}\n`
    : `${C.red}${C.bold}⚠️  MODO EJECUCIÓN REAL${C.reset}\n`);

  const start = Date.now();

  if (!DRY_RUN) {
    console.log(`${C.red}Ejecutando en 3 segundos...${C.reset}`);
    await new Promise(r => setTimeout(r, 3000));
    console.log('');
  }

  let totalTouched = 0;
  for (const [colName, resetMap] of Object.entries(RESETS_ANIDADOS)) {
    const r = await resetCollection(colName, resetMap, DRY_RUN);
    totalTouched += r.afectados;
  }

  console.log(`\n${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}RESUMEN${C.reset}`);
  console.log(`  Docs ${DRY_RUN ? 'que se actualizarían' : 'actualizados'}: ${C.green}${totalTouched}${C.reset}`);
  console.log(`  Duración: ${((Date.now() - start) / 1000).toFixed(1)}s`);

  if (DRY_RUN) {
    console.log(`\n${C.yellow}${C.bold}Para ejecutar:${C.reset}`);
    console.log(`  node scripts/cleanup-s40/04b-fix-metricas-anidadas.mjs --execute\n`);
  } else {
    console.log(`\n${C.green}${C.bold}✓ Corrección completa.${C.reset}\n`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(`${C.red}❌ Error:${C.reset}`, err);
  process.exit(1);
});
