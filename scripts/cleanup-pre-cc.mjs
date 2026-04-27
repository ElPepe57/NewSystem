#!/usr/bin/env node
/**
 * cleanup-pre-cc.mjs — Limpieza pre-Cuenta Corriente (S55)
 *
 * Borra TODAS las colecciones transaccionales (data de testeo) preservando
 * maestros (clientes, proveedores, productos, almacenes, etc.) y
 * configuración del sistema.
 *
 * También resetea contadores de numeración para que las nuevas OCs/Ventas/
 * Envíos/Reclamos arranquen en 001.
 *
 * NO borra los maestros, NO borra usuarios de auth, NO borra cuentas de
 * tesorería (la estructura), NO borra TC históricos (data de mercado).
 *
 * USO:
 *   node scripts/cleanup-pre-cc.mjs --dry-run     # solo cuenta, no borra
 *   node scripts/cleanup-pre-cc.mjs               # borra (pide confirmación)
 *   node scripts/cleanup-pre-cc.mjs --yes         # borra sin pedir confirmación (CI)
 *
 * REQUIERE:
 *   - GOOGLE_APPLICATION_CREDENTIALS apuntando a service-account.json
 *     (mismo patrón que otros scripts de este repo)
 *
 * IDEMPOTENTE: correr 2 veces no causa daño (la 2da es no-op).
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import readline from 'node:readline';

// ─── Config ──────────────────────────────────────────────────────────────

const PROJECT_ID = 'businessmn-269c9';
const MAX_BATCH = 450; // Firestore límite es 500, dejamos margen

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_CONFIRMATION = args.includes('--yes');

/**
 * Colecciones TRANSACCIONALES — se limpian completamente.
 * Toda esta data es de testeo y se puede regenerar.
 */
const COLECCIONES_A_LIMPIAR = [
  // ── Flujo principal ──────────────────────────────
  'ordenesCompra',           // OCs y sub-órdenes (subcollections incluidas)
  'ventas',                  // Ventas
  'cotizaciones',            // Cotizaciones + adelantos
  'envios',                  // Envíos T1/T2/J/E/I + sub-tandas
  'unidades',                // Inventario generado por OCs
  'reclamos',                // Reclamos a proveedores/couriers
  'devoluciones',            // Devoluciones de cliente
  'entregas',                // Entregas parciales
  'entregas_parciales',      // Entregas históricas
  'transferencias',          // Transferencias entre almacenes
  'requerimientos',          // Requerimientos de compra

  // ── Tesorería ────────────────────────────────────
  'movimientosTesoreria',    // Movimientos de caja
  'conversionesCambiarias',  // Conversiones USD↔PEN
  'registrosTCTransaccion',  // TC usado por transacción
  'aportesCapital',          // Aportes (testeo)
  'retirosCapital',          // Retiros (testeo)

  // ── Gastos y planilla ────────────────────────────
  'gastos',                  // Gastos transaccionales
  'boletas',                 // Boletas de planilla
  'adelantosNomina',         // Adelantos a empleados
  'lotePagos',               // Pagos masivos
  'cierresContables',        // Cierres mensuales

  // ── Logs / históricos derivados ──────────────────
  'historialRecalculoCTRU',  // Histórico de recálculos
  'movimientos_transportista', // Logística
  'scanHistory',             // Escáner
  'conteosInventario',       // Conteos
  'estadisticas',            // Cache de KPIs (regenerable)

  // ── Pool USD legacy ──────────────────────────────
  'poolUSDMovimientos',
  'poolUSDSnapshots',

  // ── Mercado Libre transaccional ──────────────────
  'mlOrderSync',             // Órdenes ML procesadas
  'mlQuestions',             // Preguntas
  'mlWebhookLog',            // Logs de webhooks
  'mlShipmentLog',           // Logs de envíos ML

  // ── Notificaciones / logs ────────────────────────
  'notificaciones',
  'audit_logs',
  '_errorLog',

  // ── Colaboración (puede regenerarse) ─────────────
  'llamadas',
  'llamadasIntel',
  'chat_mensajes',
  'chat_meta',
  'presencia',
  'actividad',
];

/**
 * Colecciones MAESTRAS — NO se tocan.
 * (Documentado para auditoría, el script no las menciona después.)
 */
const COLECCIONES_PRESERVADAS = [
  'users',                   // Auth users
  'proveedores',
  'clientes',
  'colaboradores',           // RedLogistica
  'productos',
  'almacenes',
  'casillas',
  'lineasNegocio',
  'paisesOrigen',
  'marcas',
  'categorias',
  'tiposProducto',
  'canalesVenta',
  'etiquetas',
  'competidores',
  'transportistas',
  'categoriasCostos',
  'insumos',
  'kitsEmpaque',
  'tarjetasCredito',
  'cuentasCaja',             // Estructura de cuentas (no movimientos)
  'tiposCambio',             // TC histórico de mercado
  'configuracion',           // Settings
  'mlProductMap',            // Vinculaciones ML
  'mlConfig',
  'whatsapp_sessions',
  'whatsapp_config',
];

/**
 * Prefijos de CONTADORES a resetear (transaccionales).
 * Después del reset, la próxima entidad arranca en 001.
 *
 * NO se resetean contadores de maestros (CAS, CLI, COL, PRV, etc.) porque
 * los maestros no se borran y queremos preservar continuidad numérica.
 */
const YEAR = new Date().getFullYear();
const CONTADORES_A_RESETEAR = [
  `OC-${YEAR}`,              // Órdenes de compra
  `VT-${YEAR}`,              // Ventas
  `COT-${YEAR}`,             // Cotizaciones
  `ENV-${YEAR}`,             // Envíos
  `REC-${YEAR}`,             // Reclamos
  `ENT-${YEAR}`,             // Entregas
  `DEV-${YEAR}`,             // Devoluciones
  `REQ-${YEAR}`,             // Requerimientos
  `MOV-${YEAR}`,             // Movimientos tesorería
  `CONV-${YEAR}`,            // Conversiones cambiarias
  `LOTE-${YEAR}`,            // Pagos masivos
  `ADL-${YEAR}`,             // Adelantos nómina
  'GAS',                     // Gastos (sin año)
  // Año anterior por si quedaron docs
  `OC-${YEAR - 1}`,
  `VT-${YEAR - 1}`,
  `COT-${YEAR - 1}`,
  `ENV-${YEAR - 1}`,
  `REC-${YEAR - 1}`,
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
  } catch (err) {
    return -1; // error de lectura (puede no existir)
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

    // Log de progreso para colecciones grandes
    if (total > 1000 && borrados % 2000 === 0) {
      console.log(`     · ${borrados}/${total} borrados...`);
    }
  }

  return borrados;
}

async function resetearContadores() {
  let borrados = 0;
  for (const prefix of CONTADORES_A_RESETEAR) {
    try {
      const ref = db.collection('contadores').doc(prefix);
      const snap = await ref.get();
      if (snap.exists) {
        if (!DRY_RUN) await ref.delete();
        borrados++;
      }
    } catch {
      // ignore — contador puede no existir
    }
  }
  return borrados;
}

function pedirConfirmacion() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(
      '\n⚠️  Para confirmar la limpieza, escribí exactamente: CONFIRMAR LIMPIEZA\n> ',
      (input) => {
        rl.close();
        resolve(input.trim() === 'CONFIRMAR LIMPIEZA');
      },
    );
  });
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const ts = new Date().toISOString();
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  🧹 LIMPIEZA PRE-CUENTA CORRIENTE (S55)');
  console.log(`  Project: ${PROJECT_ID}`);
  console.log(`  Modo:    ${DRY_RUN ? 'DRY-RUN (solo conteo)' : 'BORRAR REAL'}`);
  console.log(`  Fecha:   ${ts}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── 1. Contar docs por colección ──────────────────────────────────
  console.log('📊 Contando documentos en colecciones transaccionales...\n');

  const conteos = {};
  let totalDocs = 0;

  for (const col of COLECCIONES_A_LIMPIAR) {
    const count = await contarDocs(col);
    conteos[col] = count;
    if (count > 0) {
      console.log(`  ${fmt(count)}  ${col}`);
      totalDocs += count;
    }
  }

  // Contar contadores que se van a resetear
  let contadoresExistentes = 0;
  for (const prefix of CONTADORES_A_RESETEAR) {
    try {
      const snap = await db.collection('contadores').doc(prefix).get();
      if (snap.exists) contadoresExistentes++;
    } catch {
      // ignore
    }
  }

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log(`  Total docs transaccionales: ${totalDocs}`);
  console.log(`  Contadores a resetear:      ${contadoresExistentes}`);
  console.log('───────────────────────────────────────────────────────────────');

  console.log(`\n✅ Maestros preservados: ${COLECCIONES_PRESERVADAS.length} colecciones intactas`);
  console.log('   (clientes · proveedores · colaboradores · productos · almacenes ·');
  console.log('    casillas · líneas de negocio · cuentas tesorería · TCs · etc.)\n');

  if (DRY_RUN) {
    console.log('💡 DRY-RUN: nada se borró. Ejecutá sin --dry-run para borrar de verdad.\n');
    process.exit(0);
  }

  // ── 2. Confirmación ───────────────────────────────────────────────
  if (!SKIP_CONFIRMATION) {
    const ok = await pedirConfirmacion();
    if (!ok) {
      console.log('\n❌ Limpieza CANCELADA. Nada se borró.\n');
      process.exit(0);
    }
    console.log('\n✓ Confirmado. Iniciando limpieza...\n');
  } else {
    console.log('\n⚠️  --yes recibido, saltando confirmación interactiva.\n');
  }

  // ── 3. Borrar colecciones ─────────────────────────────────────────
  let totalBorrados = 0;
  const fallidas = [];

  for (const col of COLECCIONES_A_LIMPIAR) {
    const count = conteos[col];
    if (count <= 0) continue;

    process.stdout.write(`  Borrando ${col} (${count} docs)... `);
    try {
      const borrados = await eliminarColeccion(col, count);
      totalBorrados += borrados;
      console.log(`✓ ${borrados} borrados`);
    } catch (err) {
      console.log(`✗ ERROR: ${err.message}`);
      fallidas.push({ col, error: err.message });
    }
  }

  // ── 4. Resetear contadores ────────────────────────────────────────
  console.log('\n🔄 Reseteando contadores de numeración...');
  const contadoresBorrados = await resetearContadores();
  console.log(`✓ ${contadoresBorrados} contadores reseteados`);

  // ── 5. Resumen final ──────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ✅ LIMPIEZA COMPLETADA');
  console.log(`  Docs borrados:         ${totalBorrados}`);
  console.log(`  Contadores reseteados: ${contadoresBorrados}`);
  console.log(`  Colecciones fallidas:  ${fallidas.length}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (fallidas.length > 0) {
    console.log('⚠️  Colecciones con error (revisar manualmente):');
    fallidas.forEach((f) => console.log(`   - ${f.col}: ${f.error}`));
    console.log('');
  }

  console.log('🚀 Sistema listo para Fase 1 · Cuenta Corriente.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error fatal:', err);
  process.exit(1);
});
