/**
 * ========================================================================
 * CLEANUP S40 — FASE 4: LIMPIAR MÉTRICAS EN MAESTROS
 * ========================================================================
 *
 * Resetea campos de métricas incrementales (ventas, compras, ingresos, unidades
 * movidas) en los maestros CONSERVADOS, preservando identidad y relaciones.
 *
 * NO borra docs. Solo resetea campos específicos a 0 / null.
 *
 * Campos que se resetean en cada colección:
 *
 * productos:
 *   stockUSA, stockPeru, stockTransito, stockReservado, stockDisponible,
 *   stockDisponiblePeru, stockPendienteML, stockEfectivoML, ctruPromedio,
 *   cantidadVentas, ingresoTotalUSD, ultimaVenta
 *
 * marcas, tiposProducto, categorias, competidores:
 *   cantidadVentas, ingresoTotalUSD, ultimaVenta, unidadesMovidas
 *   (cantidadProductos y lineaNegocioIds se preservan)
 *
 * proveedores:
 *   cantidadOrdenes, montoTotalComprado, ultimaCompra
 *
 * clientes:
 *   cantidadVentas, montoTotalComprado, ultimaCompra, saldoPendiente
 *
 * colaboradores:
 *   entregasCompletadas, unidadesEntregadas, ultimaEntrega,
 *   (para viajeros) montoPendienteUSD, montoPagadoUSD
 *
 * cuentasCaja:
 *   saldoActual → 0, saldoAnterior → 0, ultimoMovimiento → null
 *   (conserva config de cuenta: nombre, moneda, banco, número, etc.)
 *
 * Uso:
 *   DRY RUN:  node scripts/cleanup-s40/04-limpiar-metricas.mjs
 *   EJECUTAR: node scripts/cleanup-s40/04-limpiar-metricas.mjs --execute
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

// ─── Definición de resets por colección ────────────────────────────────

/**
 * Cada entrada = colección + objeto de campos a setear/borrar.
 * Valores especiales:
 *   - Un número o string literal → se setea a ese valor
 *   - { __delete: true } → se elimina el campo
 *   - null → se setea a null
 */
const RESETS = {
  productos: {
    stockUSA: 0,
    stockPeru: 0,
    stockTransito: 0,
    stockReservado: 0,
    stockDisponible: 0,
    stockDisponiblePeru: 0,
    stockPendienteML: 0,
    stockEfectivoML: 0,
    ctruPromedio: 0,
    cantidadVentas: 0,
    ingresoTotalUSD: 0,
    ultimaVenta: { __delete: true },
    unidadesVendidas: 0,
    unidadesEnTransito: 0,
  },
  marcas: {
    cantidadVentas: 0,
    ingresoTotalUSD: 0,
    ingresoTotalPEN: 0,
    unidadesMovidas: 0,
    ultimaVenta: { __delete: true },
  },
  tiposProducto: {
    cantidadVentas: 0,
    ingresoTotalUSD: 0,
    ingresoTotalPEN: 0,
    unidadesMovidas: 0,
    ultimaVenta: { __delete: true },
  },
  categorias: {
    cantidadVentas: 0,
    ingresoTotalUSD: 0,
    unidadesMovidas: 0,
    ultimaVenta: { __delete: true },
  },
  competidores: {
    cantidadVentas: 0,
    ingresoTotalUSD: 0,
    unidadesMovidas: 0,
    ultimaVenta: { __delete: true },
  },
  proveedores: {
    cantidadOrdenes: 0,
    montoTotalCompradoUSD: 0,
    montoTotalCompradoPEN: 0,
    ultimaCompra: { __delete: true },
    saldoPendiente: 0,
  },
  clientes: {
    cantidadVentas: 0,
    montoTotalCompradoUSD: 0,
    montoTotalCompradoPEN: 0,
    ultimaCompra: { __delete: true },
    saldoPendiente: 0,
  },
  colaboradores: {
    entregasCompletadas: 0,
    unidadesEntregadas: 0,
    ultimaEntrega: { __delete: true },
    montoPendienteUSD: 0,
    montoPagadoUSD: 0,
    viajesCompletados: 0,
  },
  cuentasCaja: {
    saldoActual: 0,
    saldoAnterior: 0,
    saldoInicialSnapshot: 0,
    ultimoMovimiento: { __delete: true },
  },
};

// ─── Ejecutor ──────────────────────────────────────────────────────────

async function resetCollection(colName, resetMap, isDryRun) {
  const colRef = db.collection(colName);
  const countSnap = await colRef.count().get();
  const total = countSnap.data().count;

  if (total === 0) {
    console.log(`  ${C.dim}○ vacía, nada que resetear${C.reset}`);
    return { touched: 0, skipped: 0, errors: 0 };
  }

  // Construir el update object
  const updateObj = {};
  for (const [key, val] of Object.entries(resetMap)) {
    if (val && typeof val === 'object' && val.__delete === true) {
      updateObj[key] = FieldValue.delete();
    } else {
      updateObj[key] = val;
    }
  }

  if (isDryRun) {
    console.log(`  ${C.yellow}→ resetearía ${total} docs con campos: ${Object.keys(resetMap).join(', ')}${C.reset}`);
    return { touched: total, skipped: 0, errors: 0, dryRun: true };
  }

  let touched = 0;
  let skipped = 0;
  let errors = 0;
  let lastDoc = null;

  while (true) {
    let q = colRef.limit(BATCH_LIMIT);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.update(doc.ref, updateObj);
    }

    try {
      await batch.commit();
      touched += snap.size;
      process.stdout.write(`\r  ${C.green}✓ ${touched}/${total} docs reseteados${C.reset}     `);
    } catch (err) {
      errors++;
      console.log(`\n  ${C.red}✗ Error batch: ${err.message}${C.reset}`);
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < BATCH_LIMIT) break;
  }
  process.stdout.write('\n');
  return { touched, skipped, errors, total };
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}${C.cyan}  CLEANUP S40 — FASE 4: RESET MÉTRICAS EN MAESTROS${C.reset}`);
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(DRY_RUN
    ? `${C.yellow}${C.bold}MODO DRY-RUN. Usa --execute para ejecutar.${C.reset}\n`
    : `${C.red}${C.bold}⚠️  MODO EJECUCIÓN REAL${C.reset}\n`);

  const start = Date.now();

  if (!DRY_RUN) {
    console.log(`${C.red}${C.bold}Última oportunidad para cancelar — 5 segundos...${C.reset}`);
    await new Promise(r => setTimeout(r, 5000));
    console.log('');
  }

  const resultados = [];
  for (const [colName, resetMap] of Object.entries(RESETS)) {
    console.log(`${C.bold}${colName}${C.reset}`);
    const r = await resetCollection(colName, resetMap, DRY_RUN);
    resultados.push({ id: colName, ...r });
  }

  const totalTouched = resultados.reduce((s, r) => s + (r.touched || 0), 0);
  const totalErrores = resultados.reduce((s, r) => s + (r.errors || 0), 0);

  console.log(`\n${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}RESUMEN${C.reset}`);
  console.log(`  Colecciones procesadas : ${resultados.length}`);
  console.log(`  Docs ${DRY_RUN ? 'que se resetearían' : 'reseteados'}    : ${C.green}${totalTouched}${C.reset}`);
  console.log(`  Errores                : ${totalErrores > 0 ? C.red : C.dim}${totalErrores}${C.reset}`);
  console.log(`  Duración               : ${((Date.now() - start) / 1000).toFixed(1)}s`);

  if (DRY_RUN) {
    console.log(`\n${C.yellow}${C.bold}DRY-RUN completo. Para ejecutar:${C.reset}`);
    console.log(`  node scripts/cleanup-s40/04-limpiar-metricas.mjs --execute\n`);
  } else {
    console.log(`\n${C.green}${C.bold}✓ Reset de métricas completado.${C.reset}`);
    console.log(`\n${C.green}Continuar con:${C.reset}`);
    console.log(`  node scripts/cleanup-s40/05-validar-integridad.mjs\n`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(`${C.red}❌ Error fatal:${C.reset}`, err);
  process.exit(1);
});
