#!/usr/bin/env node
/**
 * reset-pf-001.mjs — Reset transaccional ADR-PF-001 (F0)
 *
 * Borra TODO lo del refactor ProductoFinanciero para arrancar limpio:
 *   - Las 7 colecciones del módulo PF (cuentasCaja, tarjetasCredito,
 *     cargosTarjeta, pagosEstadoCuentaTC, movimientosTesoreria,
 *     conversionesCambiarias, lotesPago)
 *   - CC espejo de tarjetas (cuentasCorrientes con tipo='tarjeta_credito'
 *     y sus movimientosCC asociados — cascada manual)
 *   - Contadores asociados (MOV-, CONV-, CARGO-, LOTE-, etc.)
 *
 * NO toca:
 *   - Maestros (clientes, proveedores, colaboradores, productos, almacenes,
 *     casillas, tiposCambio, configuracion)
 *   - Otras transaccionales (ordenesCompra, ventas, gastos, envios, etc.)
 *
 * OPCIONAL con --clean-refs: además limpia los campos cuentaOrigenId,
 * cuentaDestinoId, cuentaCobroId, tarjetaId en docs vivos de gastos,
 * ventas, OCs, envíos, cotizaciones, reclamos, devoluciones, entregas.
 * Útil si NO se ha corrido cleanup-pre-cc previamente y hay docs reales
 * con referencias huérfanas.
 *
 * USO:
 *   node scripts/reset-pf-001.mjs --dry-run            # solo cuenta
 *   node scripts/reset-pf-001.mjs                      # borra (pide confirmación)
 *   node scripts/reset-pf-001.mjs --yes                # borra sin confirmar (CI)
 *   node scripts/reset-pf-001.mjs --clean-refs         # incluye limpieza de referencias
 *   node scripts/reset-pf-001.mjs --dry-run --clean-refs   # combinable
 *
 * REQUIERE:
 *   - GOOGLE_APPLICATION_CREDENTIALS apuntando a service-account.json
 *
 * IDEMPOTENTE: correr 2 veces no causa daño (la 2da es no-op).
 *
 * Referencia: docs/ADR-PF-001-producto-financiero.md sección 9
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import readline from 'node:readline';

// ─── Config ──────────────────────────────────────────────────────────────

const PROJECT_ID = 'businessmn-269c9';
const MAX_BATCH = 450;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_CONFIRMATION = args.includes('--yes');
const CLEAN_REFS = args.includes('--clean-refs');

const YEAR = new Date().getFullYear();

/**
 * Las 7 colecciones que el refactor PF reemplaza.
 * Todas se borran completamente.
 */
const COLECCIONES_PF = [
  'cuentasCaja',
  'tarjetasCredito',
  'cargosTarjeta',
  'pagosEstadoCuentaTC',
  'movimientosTesoreria',
  'conversionesCambiarias',
  'lotesPago',
];

/**
 * Contadores que se resetean (vinculados a colecciones PF).
 */
const CONTADORES_PF = [
  `MOV-${YEAR}`, `MOV-${YEAR - 1}`,           // movimientosTesoreria
  `CONV-${YEAR}`, `CONV-${YEAR - 1}`,         // conversionesCambiarias
  `CARGO-${YEAR}`, `CARGO-${YEAR - 1}`,       // cargosTarjeta
  `LOTE-${YEAR}`, `LOTE-${YEAR - 1}`,         // lotesPago
  `PAGOTC-${YEAR}`, `PAGOTC-${YEAR - 1}`,     // pagosEstadoCuentaTC
  `TC-${YEAR}`, `TC-${YEAR - 1}`,             // tarjetasCredito (codigo TC-001)
];

/**
 * Referencias en docs vivos que se limpian con --clean-refs.
 * Para cada colección, los campos top-level + arrays anidados a limpiar.
 *
 * Notas:
 *  - Campos top-level → FieldValue.delete()
 *  - Arrays anidados → leer doc, mutar array, escribir
 */
const REFS_TOP_LEVEL = [
  // {coleccion, campos}
  { col: 'reclamos', fields: ['cuentaCobroId', 'cuentaCobroNombre'] },
  { col: 'devoluciones', fields: ['cuentaOrigenId', 'cuentaOrigenNombre'] },
];

const REFS_EN_ARRAYS = [
  // {coleccion, arrayPath, fieldsToClear}
  { col: 'gastos', path: 'pagos', fields: ['cuentaOrigenId', 'cuentaOrigenNombre', 'tarjetaCreditoId'] },
  { col: 'ventas', path: 'cobros', fields: ['cuentaDestinoId', 'cuentaDestinoNombre'] },
  { col: 'ordenesCompra', path: 'historialPagos', fields: ['cuentaOrigenId', 'cuentaOrigenNombre', 'tarjetaCreditoId'] },
  { col: 'envios', path: 'pagosColaborador', fields: ['cuentaOrigenId', 'cuentaOrigenNombre'] },
  { col: 'cotizaciones', path: 'adelantos', fields: ['cuentaDestinoId', 'cuentaDestinoNombre'] },
  { col: 'entregas', path: 'cobros', fields: ['cuentaDestinoId', 'cuentaDestinoNombre'] },
];

// ─── Init ────────────────────────────────────────────────────────────────

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();

// ─── Helpers ─────────────────────────────────────────────────────────────

function fmt(n) {
  return n.toString().padStart(6, ' ');
}

async function contarDocs(nombre) {
  try {
    const snap = await db.collection(nombre).count().get();
    return snap.data().count;
  } catch {
    return -1;
  }
}

async function eliminarColeccion(nombre, total) {
  if (total === 0) return 0;
  let borrados = 0;
  let restantes = total;

  while (restantes > 0) {
    const snap = await db.collection(nombre).limit(MAX_BATCH).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    borrados += snap.size;
    restantes -= snap.size;
  }
  return borrados;
}

async function eliminarCCEspejoTarjetas() {
  // 1. Buscar CCs de tipo='tarjeta_credito'
  const ccSnap = await db
    .collection('cuentasCorrientes')
    .where('tipo', '==', 'tarjeta_credito')
    .get();

  if (ccSnap.empty) return { ccBorradas: 0, movsBorrados: 0 };

  const ccIds = ccSnap.docs.map((d) => d.id);
  let movsBorrados = 0;

  // 2. Por cada CC, borrar sus movimientosCC (cascada)
  for (const ccId of ccIds) {
    const movsSnap = await db
      .collection('movimientosCC')
      .where('cuentaCorrienteId', '==', ccId)
      .get();

    if (!movsSnap.empty && !DRY_RUN) {
      // Borrar en batches
      let i = 0;
      while (i < movsSnap.docs.length) {
        const batch = db.batch();
        const slice = movsSnap.docs.slice(i, i + MAX_BATCH);
        slice.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        i += MAX_BATCH;
      }
    }
    movsBorrados += movsSnap.size;
  }

  // 3. Borrar las CCs
  if (!DRY_RUN) {
    let i = 0;
    while (i < ccSnap.docs.length) {
      const batch = db.batch();
      const slice = ccSnap.docs.slice(i, i + MAX_BATCH);
      slice.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      i += MAX_BATCH;
    }
  }

  return { ccBorradas: ccSnap.size, movsBorrados };
}

async function resetearContadores() {
  let borrados = 0;
  for (const id of CONTADORES_PF) {
    try {
      const ref = db.collection('contadores').doc(id);
      const snap = await ref.get();
      if (snap.exists) {
        if (!DRY_RUN) await ref.delete();
        borrados++;
      }
    } catch {
      // ignore
    }
  }
  return borrados;
}

async function limpiarRefsTopLevel() {
  let docsActualizados = 0;
  for (const { col, fields } of REFS_TOP_LEVEL) {
    // Para cada campo, buscar docs que lo tengan
    for (const field of fields) {
      try {
        const snap = await db
          .collection(col)
          .where(field, '!=', null)
          .get();

        if (snap.empty) continue;

        if (!DRY_RUN) {
          let i = 0;
          while (i < snap.docs.length) {
            const batch = db.batch();
            const slice = snap.docs.slice(i, i + MAX_BATCH);
            slice.forEach((d) => batch.update(d.ref, { [field]: FieldValue.delete() }));
            await batch.commit();
            i += MAX_BATCH;
          }
        }
        docsActualizados += snap.size;
      } catch (err) {
        console.log(`     · WARNING: ${col}.${field}: ${err.message}`);
      }
    }
  }
  return docsActualizados;
}

async function limpiarRefsEnArrays() {
  let docsActualizados = 0;

  for (const { col, path, fields } of REFS_EN_ARRAYS) {
    let docsModificados = 0;
    const allSnap = await db.collection(col).get();

    for (const doc of allSnap.docs) {
      const data = doc.data();
      const arr = data[path];
      if (!Array.isArray(arr) || arr.length === 0) continue;

      let modificado = false;
      const arrLimpio = arr.map((item) => {
        if (!item || typeof item !== 'object') return item;
        const itemLimpio = { ...item };
        for (const f of fields) {
          if (f in itemLimpio) {
            delete itemLimpio[f];
            modificado = true;
          }
        }
        return itemLimpio;
      });

      if (modificado) {
        if (!DRY_RUN) {
          await doc.ref.update({ [path]: arrLimpio });
        }
        docsModificados++;
      }
    }

    if (docsModificados > 0) {
      console.log(`     · ${col}.${path}: ${docsModificados} docs limpiados`);
    }
    docsActualizados += docsModificados;
  }

  return docsActualizados;
}

function pedirConfirmacion() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(
      '\n⚠️  Para confirmar, escribí exactamente: RESET PF-001\n> ',
      (input) => {
        rl.close();
        resolve(input.trim() === 'RESET PF-001');
      },
    );
  });
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const ts = new Date().toISOString();
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  🔄  RESET TRANSACCIONAL · ADR-PF-001 · F0');
  console.log(`  Project:    ${PROJECT_ID}`);
  console.log(`  Modo:       ${DRY_RUN ? 'DRY-RUN (solo conteo)' : 'BORRAR REAL'}`);
  console.log(`  Refs:       ${CLEAN_REFS ? 'INCLUYE limpieza de referencias' : 'solo colecciones PF'}`);
  console.log(`  Fecha:      ${ts}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── 1. Conteo previo ──────────────────────────────────────────────
  console.log('📊 Colecciones PF a borrar:\n');
  const conteos = {};
  let totalDocs = 0;
  for (const col of COLECCIONES_PF) {
    const c = await contarDocs(col);
    conteos[col] = c;
    if (c >= 0) {
      console.log(`  ${fmt(c)}  ${col}`);
      if (c > 0) totalDocs += c;
    }
  }

  console.log('\n📊 CC espejo de tarjetas (cuentasCorrientes tipo=tarjeta_credito):\n');
  const ccTCSnap = await db
    .collection('cuentasCorrientes')
    .where('tipo', '==', 'tarjeta_credito')
    .get();
  let ccTCMovs = 0;
  for (const cc of ccTCSnap.docs) {
    const movs = await db
      .collection('movimientosCC')
      .where('cuentaCorrienteId', '==', cc.id)
      .count()
      .get();
    ccTCMovs += movs.data().count;
  }
  console.log(`  ${fmt(ccTCSnap.size)}  cuentasCorrientes (tipo=tarjeta_credito)`);
  console.log(`  ${fmt(ccTCMovs)}  movimientosCC (cascada)`);

  console.log('\n📊 Contadores a resetear:\n');
  let contadoresExistentes = 0;
  for (const id of CONTADORES_PF) {
    const snap = await db.collection('contadores').doc(id).get();
    if (snap.exists) contadoresExistentes++;
  }
  console.log(`  ${fmt(contadoresExistentes)}  contadores`);

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log(`  Total docs PF:           ${totalDocs}`);
  console.log(`  CC espejo TC + movs:     ${ccTCSnap.size} + ${ccTCMovs}`);
  console.log(`  Contadores a resetear:   ${contadoresExistentes}`);
  console.log('───────────────────────────────────────────────────────────────\n');

  if (DRY_RUN) {
    console.log('💡 DRY-RUN: nada se borró. Ejecutá sin --dry-run para borrar.\n');
    process.exit(0);
  }

  // ── 2. Confirmación ───────────────────────────────────────────────
  if (!SKIP_CONFIRMATION) {
    const ok = await pedirConfirmacion();
    if (!ok) {
      console.log('\n❌ Reset CANCELADO. Nada se borró.\n');
      process.exit(0);
    }
    console.log('\n✓ Confirmado. Iniciando reset...\n');
  }

  // ── 3. Borrar colecciones PF ──────────────────────────────────────
  console.log('🗑️  Borrando colecciones PF...');
  let totalBorrados = 0;
  for (const col of COLECCIONES_PF) {
    const c = conteos[col];
    if (c <= 0) continue;
    process.stdout.write(`  ${col} (${c})... `);
    try {
      const b = await eliminarColeccion(col, c);
      totalBorrados += b;
      console.log(`✓ ${b}`);
    } catch (err) {
      console.log(`✗ ${err.message}`);
    }
  }

  // ── 4. CC espejo de tarjetas ──────────────────────────────────────
  console.log('\n🗑️  Borrando CC espejo de tarjetas + cascada...');
  const { ccBorradas, movsBorrados } = await eliminarCCEspejoTarjetas();
  console.log(`  ✓ ${ccBorradas} CC + ${movsBorrados} movs CC`);

  // ── 5. Reset contadores ───────────────────────────────────────────
  console.log('\n🔄 Reseteando contadores PF...');
  const cb = await resetearContadores();
  console.log(`  ✓ ${cb} contadores`);

  // ── 6. (Opcional) Limpiar referencias en docs vivos ───────────────
  let refsTL = 0, refsArr = 0;
  if (CLEAN_REFS) {
    console.log('\n🧹 Limpiando referencias top-level en docs vivos...');
    refsTL = await limpiarRefsTopLevel();
    console.log(`  ✓ ${refsTL} docs actualizados`);

    console.log('\n🧹 Limpiando referencias en arrays anidados...');
    refsArr = await limpiarRefsEnArrays();
    console.log(`  ✓ ${refsArr} docs actualizados`);
  }

  // ── 7. Resumen ────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ✅ RESET PF-001 COMPLETADO');
  console.log(`  Docs PF borrados:        ${totalBorrados}`);
  console.log(`  CC espejo TC borradas:   ${ccBorradas} (+ ${movsBorrados} movs)`);
  console.log(`  Contadores reseteados:   ${cb}`);
  if (CLEAN_REFS) {
    console.log(`  Refs top-level limpias:  ${refsTL}`);
    console.log(`  Refs en arrays limpias:  ${refsArr}`);
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('🚀 Sistema listo para F1 · Tipos base ProductoFinanciero.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error fatal:', err);
  process.exit(1);
});
