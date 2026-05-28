/**
 * scripts/migrate-datos-laborales-to-relaciones.mjs
 * chk5.PERSONAS-v5.6/v5.8 · 2026-05-28
 *
 * Migra el modelo legacy de sub-perfiles a la nueva colección unificada
 * `relacionesLaborales/{id}` (v5.6 multi-relación).
 *
 * ORIGEN (legacy):
 *   - users/{uid}/private/datosLaborales (de Fase 2 / chk5.F2-SUB-PERFILES)
 *   - users/{uid}/private/datosSocio    (de Fase 2 / chk5.F2-SUB-PERFILES)
 *
 * DESTINO (nuevo):
 *   - relacionesLaborales/{auto-id} con tipo='empleado' o 'socio'
 *
 * COMPORTAMIENTO:
 *   - Idempotente: chequea si ya existe RelacionLaboral con userId+tipo antes
 *     de crear (NO duplica)
 *   - Soporta --dry-run: imprime qué haría sin escribir
 *   - Preserva los docs legacy: NO los borra (backward compat hasta migrar
 *     todos los lectores en E5+)
 *
 * USO:
 *   node scripts/migrate-datos-laborales-to-relaciones.mjs --dry-run    # diagnóstico
 *   node scripts/migrate-datos-laborales-to-relaciones.mjs              # ejecutar
 *
 * SAFETY:
 *   - Ejecutar en horario de baja actividad (los reads/writes pueden ser muchos)
 *   - Backup recomendado antes: scripts/backup-firestore-full.mjs
 *   - Log completo se imprime a stdout · redirigir a archivo: ... > migration.log 2>&1
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
const SERVICE_ACCOUNT_PATH = resolve(__dirname, '../firebase-admin-key.json');

const COL_USERS = 'users';
const COL_RELACIONES = 'relacionesLaborales';
const SUB_PRIVATE = 'private';
const DOC_DATOS_LABORALES = 'datosLaborales';
const DOC_DATOS_SOCIO = 'datosSocio';

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(70)}`);
console.log(`  MIGRACIÓN · datos legacy → relacionesLaborales`);
console.log(`  Modo: ${DRY_RUN ? '🔍 DRY-RUN (sin escribir)' : '✏️  EJECUCIÓN REAL'}`);
console.log(`  Fecha: ${new Date().toISOString()}`);
console.log(`${'═'.repeat(70)}\n`);

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
} catch (err) {
  console.error(`❌ No se encontró firebase-admin-key.json en raíz del proyecto.`);
  console.error(`   Ruta esperada: ${SERVICE_ACCOUNT_PATH}`);
  console.error(`   Descargá la service account key desde Firebase Console → Project Settings → Service accounts.`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

function removeUndefined(obj) {
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) clean[k] = v;
  }
  return clean;
}

/**
 * Chequea si ya existe una RelacionLaboral con (userId, tipo) en estado vigente.
 * Idempotencia · evita duplicar al re-ejecutar el script.
 */
async function existeRelacionVigente(userId, tipo) {
  const q = await db
    .collection(COL_RELACIONES)
    .where('userId', '==', userId)
    .where('tipo', '==', tipo)
    .where('estado', 'in', ['vigente', 'pausada', 'prueba'])
    .limit(1)
    .get();
  return !q.empty;
}

/**
 * Construye RelacionLaboral 'empleado' desde datosLaborales legacy.
 * Map de campos legacy → nuevo modelo.
 */
function buildRelacionEmpleado(userId, datosLaborales, creadoPor) {
  const now = Timestamp.now();
  const fechaInicio = datosLaborales.fechaIngreso instanceof Timestamp
    ? datosLaborales.fechaIngreso
    : (datosLaborales.fechaIngreso?.toDate
        ? Timestamp.fromDate(datosLaborales.fechaIngreso.toDate())
        : now);

  return removeUndefined({
    userId,
    tipo: 'empleado',
    subTipo: datosLaborales.tipoContrato === 'medio_tiempo' ? 'medio_tiempo' :
             datosLaborales.tipoContrato === 'practicas' ? 'practicante' :
             'full_time',
    estado: 'vigente',
    fechaInicio,
    cargoDisplay: datosLaborales.cargo,
    montoMensualReferencia: datosLaborales.salarioBruto,
    monedaReferencia: datosLaborales.monedaSalario || 'PEN',
    creadoPor,
    fechaCreacion: now,
    notas: '[Migrado desde datosLaborales legacy]',
  });
}

/**
 * Construye RelacionLaboral 'socio' desde datosSocio legacy.
 */
function buildRelacionSocio(userId, datosSocio, creadoPor) {
  const now = Timestamp.now();
  const fechaInicio = datosSocio.fechaIngresoSocio instanceof Timestamp
    ? datosSocio.fechaIngresoSocio
    : (datosSocio.fechaIngresoSocio?.toDate
        ? Timestamp.fromDate(datosSocio.fechaIngresoSocio.toDate())
        : now);

  return removeUndefined({
    userId,
    tipo: 'socio',
    subTipo: datosSocio.tipoSocio === 'fundador' ? 'fundador' :
             datosSocio.tipoSocio === 'inversor' ? 'inversor' :
             undefined,
    estado: 'vigente',
    fechaInicio,
    cargoDisplay: datosSocio.cargoSocio || 'Socio',
    creadoPor,
    fechaCreacion: now,
    notas: '[Migrado desde datosSocio legacy]',
  });
}

// ─────────────────────────────────────────────────────────────────────────
// MIGRACIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const usersSnap = await db.collection(COL_USERS).get();
  console.log(`📊 Total users encontrados: ${usersSnap.size}\n`);

  // El "admin" que figura como creadoPor en la migración · usar un uid sentinela
  const MIGRATION_ACTOR = 'system-migration-v5.6';

  let creadasEmpleado = 0;
  let creadasSocio = 0;
  let saltadasDuplicado = 0;
  let saltadasSinDatos = 0;
  let errores = 0;

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const userData = userDoc.data();
    const userLabel = `${userData.displayName || userData.email || userId.slice(0, 8)}`;

    try {
      // ── datosLaborales → empleado ────────────────────────────────────
      const dlRef = db.doc(`${COL_USERS}/${userId}/${SUB_PRIVATE}/${DOC_DATOS_LABORALES}`);
      const dlSnap = await dlRef.get();
      if (dlSnap.exists) {
        const datosLaborales = dlSnap.data();
        const yaExiste = await existeRelacionVigente(userId, 'empleado');
        if (yaExiste) {
          console.log(`  ⏭️  [${userLabel}] empleado · ya existe relación vigente · skip`);
          saltadasDuplicado++;
        } else {
          const docData = buildRelacionEmpleado(userId, datosLaborales, MIGRATION_ACTOR);
          if (DRY_RUN) {
            console.log(`  📝 [DRY] [${userLabel}] crearía empleado · cargo=${docData.cargoDisplay} · salario=${docData.montoMensualReferencia}`);
          } else {
            const newRef = await db.collection(COL_RELACIONES).add(docData);
            console.log(`  ✓ [${userLabel}] empleado creado · id=${newRef.id}`);
          }
          creadasEmpleado++;
        }
      }

      // ── datosSocio → socio ───────────────────────────────────────────
      const dsRef = db.doc(`${COL_USERS}/${userId}/${SUB_PRIVATE}/${DOC_DATOS_SOCIO}`);
      const dsSnap = await dsRef.get();
      if (dsSnap.exists) {
        const datosSocio = dsSnap.data();
        const yaExiste = await existeRelacionVigente(userId, 'socio');
        if (yaExiste) {
          console.log(`  ⏭️  [${userLabel}] socio · ya existe relación vigente · skip`);
          saltadasDuplicado++;
        } else {
          const docData = buildRelacionSocio(userId, datosSocio, MIGRATION_ACTOR);
          if (DRY_RUN) {
            console.log(`  📝 [DRY] [${userLabel}] crearía socio · cargo=${docData.cargoDisplay}`);
          } else {
            const newRef = await db.collection(COL_RELACIONES).add(docData);
            console.log(`  ✓ [${userLabel}] socio creado · id=${newRef.id}`);
          }
          creadasSocio++;
        }
      }

      // Si user no tiene ni datosLaborales ni datosSocio, se cuenta como sin datos
      if (!dlSnap.exists && !dsSnap.exists) {
        saltadasSinDatos++;
      }
    } catch (err) {
      console.error(`  ❌ [${userLabel}] ERROR: ${err.message}`);
      errores++;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // RESUMEN
  // ─────────────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  RESUMEN`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`  Modo:                       ${DRY_RUN ? '🔍 DRY-RUN' : '✏️ EJECUTADO'}`);
  console.log(`  Total users analizados:     ${usersSnap.size}`);
  console.log(`  Relaciones empleado creadas: ${creadasEmpleado}`);
  console.log(`  Relaciones socio creadas:    ${creadasSocio}`);
  console.log(`  Saltadas (duplicado):        ${saltadasDuplicado}`);
  console.log(`  Sin datos legacy:            ${saltadasSinDatos}`);
  console.log(`  Errores:                     ${errores}`);
  console.log(`${'═'.repeat(70)}\n`);

  if (DRY_RUN) {
    console.log(`  ⚠️  Re-ejecutar SIN --dry-run para aplicar los cambios reales.`);
  } else {
    console.log(`  ✅ Migración completada. Los docs legacy (datosLaborales/datosSocio)`);
    console.log(`     NO se borraron · backward compat preservada.`);
    console.log(`     Cuando todos los lectores estén migrados (E5+ del plan v5.x),`);
    console.log(`     correr scripts/cleanup-datos-laborales-legacy.mjs (a crear).`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n❌ FALLA CRÍTICA: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  });
