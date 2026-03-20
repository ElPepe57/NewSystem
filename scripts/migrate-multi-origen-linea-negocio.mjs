/**
 * ===============================================
 * MIGRACIÓN: Multi-Origen + Línea de Negocio
 * ===============================================
 *
 * Este script migra la data existente para soportar:
 * 1. Múltiples países de origen (no solo USA)
 * 2. Líneas de negocio (Suplementos, Skincare, etc.)
 *
 * PRINCIPIO: AGREGAR SIN BORRAR — Nunca se elimina data existente.
 * Se agregan campos nuevos y se preservan valores legacy.
 *
 * ORDEN DE EJECUCIÓN:
 *   1. lineasNegocio (crear collection)
 *   2. almacenes (agregar campos display)
 *   3. productos (+ lineaNegocioId + paisOrigen)
 *   4. ordenesCompra (+ paisOrigen + lineaNegocioId)
 *   5. requerimientos (+ lineaNegocioId + migrar estado asignaciones)
 *   6. unidades (DUAL-STATE + lineaNegocioId)
 *   7. transferencias (+ tipoGenerico + paisOrigen)
 *   8. ventas (+ lineaNegocioId)
 *   9. cotizaciones (+ lineaNegocioId)
 *   10. gastos (+ lineaNegocioId: null)
 *   11. movimientosTesoreria (+ lineaNegocioId: null)
 *
 * Uso:
 *   DRY RUN (solo ver qué haría):
 *     node scripts/migrate-multi-origen-linea-negocio.mjs --dry-run
 *
 *   EJECUTAR MIGRACIÓN:
 *     node scripts/migrate-multi-origen-linea-negocio.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');
const BATCH_SIZE = 400; // Margen bajo el límite de 500

// Colores para console
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(emoji, msg) { console.log(`${emoji} ${msg}`); }
function logStep(step, msg) { console.log(`\n${C.cyan}━━━ PASO ${step} ━━━${C.reset} ${msg}`); }
function logDry(msg) { if (DRY_RUN) console.log(`  ${C.yellow}[DRY-RUN]${C.reset} ${msg}`); }
function logOk(msg) { console.log(`  ${C.green}✓${C.reset} ${msg}`); }
function logWarn(msg) { console.log(`  ${C.yellow}⚠${C.reset} ${msg}`); }

// ============================================================
// UTILIDAD: Batch commit seguro
// ============================================================
async function batchCommit(updates, collectionName) {
  if (DRY_RUN) {
    logDry(`Se actualizarían ${updates.length} docs en '${collectionName}'`);
    return;
  }

  let committed = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const { ref, data } of chunk) {
      batch.update(ref, data);
    }
    await batch.commit();
    committed += chunk.length;
    log('📦', `  Committed ${committed}/${updates.length} docs`);
  }
  logOk(`${committed} documentos actualizados en '${collectionName}'`);
}

// ============================================================
// CONTADORES para resumen final
// ============================================================
const stats = {
  lineaNegocioCreada: false,
  lineaNegocioId: null,
  almacenes: 0,
  productos: 0,
  ordenesCompra: 0,
  requerimientos: 0,
  unidades: 0,
  unidadesEstadoMigrado: 0,
  transferencias: 0,
  transferenciasEstadoMigrado: 0,
  ventas: 0,
  cotizaciones: 0,
  gastos: 0,
  movimientosTesoreria: 0,
};

// ============================================================
// PASO 1: Crear Línea de Negocio "Suplementos y Vitaminas"
// ============================================================
async function paso1_crearLineaNegocio() {
  logStep(1, 'Crear línea de negocio "Suplementos y Vitaminas"');

  // Verificar si ya existe
  const existing = await db.collection('lineasNegocio')
    .where('codigo', '==', 'SUP')
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    stats.lineaNegocioId = doc.id;
    logOk(`Ya existe: ${doc.id} (${doc.data().nombre})`);
    return doc.id;
  }

  if (DRY_RUN) {
    stats.lineaNegocioId = 'DRY_RUN_ID';
    logDry('Se crearía la línea "Suplementos y Vitaminas" (código: SUP)');
    return 'DRY_RUN_ID';
  }

  const docRef = await db.collection('lineasNegocio').add({
    nombre: 'Suplementos y Vitaminas',
    codigo: 'SUP',
    descripcion: 'Línea principal de suplementos alimenticios, vitaminas y minerales',
    color: '#3B82F6',
    icono: '💊',
    activa: true,
    totalProductos: 0,
    totalUnidadesActivas: 0,
    ventasMesActualPEN: 0,
    creadoPor: 'migration-script',
    fechaCreacion: FieldValue.serverTimestamp(),
  });

  stats.lineaNegocioCreada = true;
  stats.lineaNegocioId = docRef.id;
  logOk(`Creada: ${docRef.id}`);
  return docRef.id;
}

// ============================================================
// PASO 2: Almacenes — Agregar campos display
// ============================================================
async function paso2_almacenes() {
  logStep(2, 'Almacenes — agregar campos display');

  const PAISES_CONFIG = {
    USA: { nombre: 'Estados Unidos', emoji: '🇺🇸' },
    Peru: { nombre: 'Perú', emoji: '🇵🇪' },
  };

  const snap = await db.collection('almacenes').get();
  const updates = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    // Solo si no tiene los campos nuevos
    if (!data.paisNombreDisplay) {
      const config = PAISES_CONFIG[data.pais] || { nombre: data.pais, emoji: '🌍' };
      updates.push({
        ref: doc.ref,
        data: {
          paisNombreDisplay: config.nombre,
          paisEmoji: config.emoji,
        }
      });
    }
  }

  stats.almacenes = updates.length;
  await batchCommit(updates, 'almacenes');
}

// ============================================================
// PASO 3: Productos — lineaNegocioId + paisOrigen
// ============================================================
async function paso3_productos(lineaNegocioId) {
  logStep(3, 'Productos — + lineaNegocioId + paisOrigen');

  const snap = await db.collection('productos').get();
  const updates = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const updateData = {};

    if (!data.lineaNegocioId) {
      updateData.lineaNegocioId = lineaNegocioId;
      updateData.lineaNegocioNombre = 'Suplementos y Vitaminas';
    }
    if (!data.paisOrigen) {
      updateData.paisOrigen = 'USA';
    }
    // Copiar flete legacy a campo genérico
    if (data.costoFleteUSAPeru != null && !data.costoFleteInternacional) {
      updateData.costoFleteInternacional = data.costoFleteUSAPeru;
    }

    if (Object.keys(updateData).length > 0) {
      updates.push({ ref: doc.ref, data: updateData });
    }
  }

  stats.productos = updates.length;
  await batchCommit(updates, 'productos');
}

// ============================================================
// PASO 4: Órdenes de Compra — paisOrigen + lineaNegocioId
// ============================================================
async function paso4_ordenesCompra(lineaNegocioId) {
  logStep(4, 'Órdenes de Compra — + paisOrigen + lineaNegocioId');

  const snap = await db.collection('ordenesCompra').get();
  const updates = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const updateData = {};

    if (!data.paisOrigen) {
      updateData.paisOrigen = 'USA';
    }
    if (!data.lineaNegocioId) {
      updateData.lineaNegocioId = lineaNegocioId;
      updateData.lineaNegocioNombre = 'Suplementos y Vitaminas';
    }

    if (Object.keys(updateData).length > 0) {
      updates.push({ ref: doc.ref, data: updateData });
    }
  }

  stats.ordenesCompra = updates.length;
  await batchCommit(updates, 'ordenesCompra');
}

// ============================================================
// PASO 5: Requerimientos — lineaNegocioId + migrar asignaciones
// ============================================================
async function paso5_requerimientos(lineaNegocioId) {
  logStep(5, 'Requerimientos — + lineaNegocioId + migrar estado asignaciones');

  const snap = await db.collection('requerimientos').get();
  const updates = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const updateData = {};

    if (!data.lineaNegocioId) {
      updateData.lineaNegocioId = lineaNegocioId;
      updateData.lineaNegocioNombre = 'Suplementos y Vitaminas';
    }
    if (!data.paisOrigenPrincipal) {
      updateData.paisOrigenPrincipal = 'USA';
    }

    // Migrar estados de asignaciones
    if (data.asignaciones && Array.isArray(data.asignaciones)) {
      let asignacionesMigradas = false;
      const nuevasAsignaciones = data.asignaciones.map(a => {
        if (a.estado === 'en_almacen_usa') {
          asignacionesMigradas = true;
          return {
            ...a,
            estado: 'en_almacen_origen',
            estadoLegacy: 'en_almacen_usa',
            paisOrigen: 'USA',
          };
        }
        if (!a.paisOrigen) {
          return { ...a, paisOrigen: 'USA' };
        }
        return a;
      });

      if (asignacionesMigradas || nuevasAsignaciones.some(a => !a.paisOrigen)) {
        updateData.asignaciones = nuevasAsignaciones;
      }
    }

    if (Object.keys(updateData).length > 0) {
      updates.push({ ref: doc.ref, data: updateData });
    }
  }

  stats.requerimientos = updates.length;
  await batchCommit(updates, 'requerimientos');
}

// ============================================================
// PASO 6: Unidades — DUAL-STATE + lineaNegocioId (LA MÁS CRÍTICA)
// ============================================================
async function paso6_unidades(lineaNegocioId) {
  logStep(6, 'Unidades — DUAL-STATE + lineaNegocioId + paisOrigen (CRÍTICA)');

  const snap = await db.collection('unidades').get();
  const updates = [];
  let estadosMigrados = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const updateData = {};

    // Agregar lineaNegocioId si no existe
    if (!data.lineaNegocioId) {
      updateData.lineaNegocioId = lineaNegocioId;
      updateData.lineaNegocioNombre = 'Suplementos y Vitaminas';
    }

    // Agregar paisOrigen si no existe
    if (!data.paisOrigen) {
      updateData.paisOrigen = 'USA';
    }

    // === MIGRACIÓN DE ESTADOS ===
    if (data.estado === 'recibida_usa') {
      updateData.estadoLegacy = 'recibida_usa';
      updateData.estado = 'recibida_origen';
      estadosMigrados++;
    } else if (data.estado === 'en_transito_usa') {
      updateData.estadoLegacy = 'en_transito_usa';
      updateData.estado = 'en_transito_origen';
      estadosMigrados++;
    }

    if (Object.keys(updateData).length > 0) {
      updates.push({ ref: doc.ref, data: updateData });
    }
  }

  stats.unidades = updates.length;
  stats.unidadesEstadoMigrado = estadosMigrados;
  log('📊', `  Estados a migrar: ${estadosMigrados} (recibida_usa → recibida_origen, en_transito_usa → en_transito_origen)`);
  await batchCommit(updates, 'unidades');
}

// ============================================================
// PASO 7: Transferencias — tipoGenerico + paisOrigen
// ============================================================
async function paso7_transferencias() {
  logStep(7, 'Transferencias — + tipoGenerico + paisOrigen');

  const snap = await db.collection('transferencias').get();
  const updates = [];
  let tiposMigrados = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const updateData = {};

    if (!data.paisOrigen) {
      updateData.paisOrigen = 'USA';
    }

    // Migrar tipo
    if (data.tipo === 'usa_peru' && !data.tipoLegacy) {
      updateData.tipoLegacy = 'usa_peru';
      updateData.tipo = 'internacional_peru';
      tiposMigrados++;
    } else if (data.tipo === 'interna_usa' && !data.tipoLegacy) {
      updateData.tipoLegacy = 'interna_usa';
      updateData.tipo = 'interna_origen';
      tiposMigrados++;
    }

    if (Object.keys(updateData).length > 0) {
      updates.push({ ref: doc.ref, data: updateData });
    }
  }

  stats.transferencias = updates.length;
  stats.transferenciasEstadoMigrado = tiposMigrados;
  log('📊', `  Tipos a migrar: ${tiposMigrados} (usa_peru → internacional_peru, interna_usa → interna_origen)`);
  await batchCommit(updates, 'transferencias');
}

// ============================================================
// PASO 8: Ventas — lineaNegocioId
// ============================================================
async function paso8_ventas(lineaNegocioId) {
  logStep(8, 'Ventas — + lineaNegocioId');

  const snap = await db.collection('ventas').get();
  const updates = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    if (!data.lineaNegocioId) {
      updates.push({
        ref: doc.ref,
        data: {
          lineaNegocioId: lineaNegocioId,
          lineaNegocioNombre: 'Suplementos y Vitaminas',
        }
      });
    }
  }

  stats.ventas = updates.length;
  await batchCommit(updates, 'ventas');
}

// ============================================================
// PASO 9: Cotizaciones — lineaNegocioId
// ============================================================
async function paso9_cotizaciones(lineaNegocioId) {
  logStep(9, 'Cotizaciones — + lineaNegocioId');

  const snap = await db.collection('cotizaciones').get();
  const updates = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    if (!data.lineaNegocioId) {
      updates.push({
        ref: doc.ref,
        data: {
          lineaNegocioId: lineaNegocioId,
          lineaNegocioNombre: 'Suplementos y Vitaminas',
        }
      });
    }
  }

  stats.cotizaciones = updates.length;
  await batchCommit(updates, 'cotizaciones');
}

// ============================================================
// PASO 10: Gastos — lineaNegocioId (null = compartido)
// ============================================================
async function paso10_gastos() {
  logStep(10, 'Gastos — + lineaNegocioId (null = compartido)');

  const snap = await db.collection('gastos').get();
  const updates = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    // Solo agregar si el campo no existe en absoluto
    if (data.lineaNegocioId === undefined) {
      updates.push({
        ref: doc.ref,
        data: {
          lineaNegocioId: null,
          lineaNegocioNombre: null,
        }
      });
    }
  }

  stats.gastos = updates.length;
  await batchCommit(updates, 'gastos');
}

// ============================================================
// PASO 11: Movimientos Tesorería — lineaNegocioId (null = inferido)
// ============================================================
async function paso11_movimientosTesoreria() {
  logStep(11, 'Movimientos Tesorería — + lineaNegocioId (null = inferido)');

  const snap = await db.collection('movimientosTesoreria').get();
  const updates = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.lineaNegocioId === undefined) {
      updates.push({
        ref: doc.ref,
        data: {
          lineaNegocioId: null,
          lineaNegocioNombre: null,
        }
      });
    }
  }

  stats.movimientosTesoreria = updates.length;
  await batchCommit(updates, 'movimientosTesoreria');
}

// ============================================================
// VERIFICACIÓN POST-MIGRACIÓN
// ============================================================
async function verificar() {
  console.log(`\n${C.cyan}━━━ VERIFICACIÓN POST-MIGRACIÓN ━━━${C.reset}`);

  // Check 1: Unidades sin estados legacy
  const unidadesLegacy = await db.collection('unidades')
    .where('estado', '==', 'recibida_usa').get();
  const unidadesLegacy2 = await db.collection('unidades')
    .where('estado', '==', 'en_transito_usa').get();

  if (unidadesLegacy.size === 0 && unidadesLegacy2.size === 0) {
    logOk('CHECK 1: No hay unidades con estados legacy (recibida_usa, en_transito_usa)');
  } else {
    logWarn(`CHECK 1: Aún hay ${unidadesLegacy.size + unidadesLegacy2.size} unidades con estados legacy`);
  }

  // Check 2: Unidades con lineaNegocioId
  const unidadesSinLinea = await db.collection('unidades')
    .where('lineaNegocioId', '==', null).get();
  // Note: Firestore where == null no captura campos inexistentes,
  // así que contamos los docs sin el campo
  const allUnidades = await db.collection('unidades').get();
  const sinLinea = allUnidades.docs.filter(d => !d.data().lineaNegocioId);
  if (sinLinea.length === 0) {
    logOk(`CHECK 2: Todas las unidades (${allUnidades.size}) tienen lineaNegocioId`);
  } else {
    logWarn(`CHECK 2: ${sinLinea.length}/${allUnidades.size} unidades sin lineaNegocioId`);
  }

  // Check 3: Transferencias migradas
  const trfLegacy1 = await db.collection('transferencias')
    .where('tipo', '==', 'usa_peru').get();
  const trfLegacy2 = await db.collection('transferencias')
    .where('tipo', '==', 'interna_usa').get();
  if (trfLegacy1.size === 0 && trfLegacy2.size === 0) {
    logOk('CHECK 3: No hay transferencias con tipos legacy (usa_peru, interna_usa)');
  } else {
    logWarn(`CHECK 3: Aún hay ${trfLegacy1.size + trfLegacy2.size} transferencias con tipos legacy`);
  }

  // Check 4: Productos con lineaNegocioId
  const allProductos = await db.collection('productos').get();
  const prodSinLinea = allProductos.docs.filter(d => !d.data().lineaNegocioId);
  if (prodSinLinea.length === 0) {
    logOk(`CHECK 4: Todos los productos (${allProductos.size}) tienen lineaNegocioId`);
  } else {
    logWarn(`CHECK 4: ${prodSinLinea.length}/${allProductos.size} productos sin lineaNegocioId`);
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  MIGRACIÓN: Multi-Origen + Línea de Negocio`);
  console.log(`  Modo: ${DRY_RUN ? `${C.yellow}DRY RUN (sin cambios)${C.reset}` : `${C.red}EJECUCIÓN REAL${C.reset}`}`);
  console.log(`${'='.repeat(60)}\n`);

  if (!DRY_RUN) {
    log('⚠️', `${C.red}ATENCIÓN: Este script MODIFICARÁ datos en Firestore.${C.reset}`);
    log('⚠️', 'Asegúrate de tener un backup antes de continuar.');
    log('⚠️', 'Presiona Ctrl+C en los próximos 5 segundos para cancelar...\n');
    await new Promise(r => setTimeout(r, 5000));
  }

  try {
    // Paso 1: Crear línea de negocio
    const lineaNegocioId = await paso1_crearLineaNegocio();

    // Pasos 2-11: Migrar colecciones
    await paso2_almacenes();
    await paso3_productos(lineaNegocioId);
    await paso4_ordenesCompra(lineaNegocioId);
    await paso5_requerimientos(lineaNegocioId);
    await paso6_unidades(lineaNegocioId);
    await paso7_transferencias();
    await paso8_ventas(lineaNegocioId);
    await paso9_cotizaciones(lineaNegocioId);
    await paso10_gastos();
    await paso11_movimientosTesoreria();

    // Verificación
    if (!DRY_RUN) {
      await verificar();
    }

    // Resumen final
    console.log(`\n${C.cyan}━━━ RESUMEN FINAL ━━━${C.reset}`);
    console.log(`  Línea de Negocio: ${stats.lineaNegocioCreada ? 'CREADA' : 'ya existía'} (ID: ${stats.lineaNegocioId})`);
    console.log(`  Almacenes:         ${stats.almacenes} actualizados`);
    console.log(`  Productos:         ${stats.productos} actualizados`);
    console.log(`  Órdenes de Compra: ${stats.ordenesCompra} actualizados`);
    console.log(`  Requerimientos:    ${stats.requerimientos} actualizados`);
    console.log(`  Unidades:          ${stats.unidades} actualizados (${stats.unidadesEstadoMigrado} estados migrados)`);
    console.log(`  Transferencias:    ${stats.transferencias} actualizados (${stats.transferenciasEstadoMigrado} tipos migrados)`);
    console.log(`  Ventas:            ${stats.ventas} actualizados`);
    console.log(`  Cotizaciones:      ${stats.cotizaciones} actualizados`);
    console.log(`  Gastos:            ${stats.gastos} actualizados`);
    console.log(`  Mov. Tesorería:    ${stats.movimientosTesoreria} actualizados`);
    console.log();

    if (DRY_RUN) {
      log('💡', `${C.yellow}Esto fue un DRY RUN. Para ejecutar realmente:${C.reset}`);
      log('💡', `   node scripts/migrate-multi-origen-linea-negocio.mjs --execute`);
    } else {
      log('✅', `${C.green}Migración completada exitosamente.${C.reset}`);
    }

  } catch (error) {
    console.error(`\n${C.red}❌ ERROR EN MIGRACIÓN:${C.reset}`, error);
    console.error('Los cambios realizados antes del error se mantienen.');
    console.error('Puede volver a ejecutar el script — es idempotente (no duplica cambios).');
    process.exit(1);
  }
}

main();
