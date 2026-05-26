// scripts/migrate-users-v2.mjs
// chk5.F4-USERS (2026-05-25) · Migración de UserProfile legacy → modelo v2
//
// Cambios aplicados:
//   - Agrega `roles: [role]` si no existe (multi-rol)
//   - Agrega `estado` derivado de `activo` + `role`
//   - Agrega `origen` (asume 'creacion_directa' para legacy)
//
// Idempotente: si user ya tiene `estado` definido, lo skipea.
// SEGURO: NO modifica `role`, `permisos`, `activo` originales (backward compat).
//
// Uso:
//   1. (Recomendado) Backup primero:
//      gcloud firestore export gs://businessmn-269c9.appspot.com/backups/pre-f4-users
//   2. Dry-run (sin escribir):
//      node scripts/migrate-users-v2.mjs --dry-run
//   3. Producción:
//      node scripts/migrate-users-v2.mjs
//
// Output: tabla con uid · estado calculado · roles · acción tomada.

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

// ─────────────────────────────────────────────────────────────────────────
// MAPPING · activo + role → estado
// ─────────────────────────────────────────────────────────────────────────
function deriveEstado(activo, role) {
  if (activo === true) return 'activo';
  // activo: false
  if (!role || role === 'invitado') return 'pendiente_aprobacion';
  return 'suspendido';
}

// Inversa: si origen no existe, asumimos 'creacion_directa' para legacy
// (porque self-signup + invitación son features nuevas)
function deriveOrigen(estado, role) {
  // Si está pendiente con rol invitado · puede ser self-signup
  if (estado === 'pendiente_aprobacion' && (!role || role === 'invitado')) {
    return 'self_signup';
  }
  return 'creacion_directa';
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────
async function migrate() {
  console.log(`\n${DRY_RUN ? '🔍 DRY-RUN MODE' : '⚡ LIVE MIGRATION'} · BusinessMN v2 · users → v2 schema\n`);

  const snapshot = await db.collection('users').get();
  console.log(`📊 Total usuarios encontrados: ${snapshot.size}\n`);

  const stats = {
    total: snapshot.size,
    yaMigrados: 0,
    migrados: 0,
    rolesAgregado: 0,
    estadoAgregado: 0,
    origenAgregado: 0,
    errores: 0,
  };

  const acciones = [];

  for (const docSnap of snapshot.docs) {
    const uid = docSnap.id;
    const data = docSnap.data();
    const update = {};
    const actions = [];

    try {
      // 1. Agregar roles[] si no existe
      if (!Array.isArray(data.roles) || data.roles.length === 0) {
        const role = data.role || 'invitado';
        update.roles = [role];
        actions.push(`+ roles: [${role}]`);
        stats.rolesAgregado++;
      }

      // 2. Agregar estado si no existe
      if (!data.estado) {
        const estado = deriveEstado(data.activo, data.role);
        update.estado = estado;
        actions.push(`+ estado: ${estado}`);
        stats.estadoAgregado++;
      }

      // 3. Agregar origen si no existe
      if (!data.origen) {
        const estado = data.estado || deriveEstado(data.activo, data.role);
        const origen = deriveOrigen(estado, data.role);
        update.origen = origen;
        actions.push(`+ origen: ${origen}`);
        stats.origenAgregado++;
      }

      if (Object.keys(update).length === 0) {
        stats.yaMigrados++;
        acciones.push({ uid: uid.slice(0, 8), email: data.email, accion: '✓ ya migrado' });
        continue;
      }

      if (!DRY_RUN) {
        await db.collection('users').doc(uid).update(update);
      }

      stats.migrados++;
      acciones.push({
        uid: uid.slice(0, 8),
        email: data.email,
        accion: actions.join(' · '),
      });
    } catch (error) {
      stats.errores++;
      acciones.push({
        uid: uid.slice(0, 8),
        email: data.email || '?',
        accion: `❌ ERROR: ${error.message}`,
      });
      console.error(`Error en ${uid}:`, error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // REPORTE
  // ───────────────────────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('DETALLE POR USUARIO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.table(acciones);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RESUMEN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Total usuarios:        ${stats.total}`);
  console.log(`  Ya migrados:           ${stats.yaMigrados} (sin cambios)`);
  console.log(`  Migrados ahora:        ${stats.migrados}`);
  console.log(`    + roles agregado:    ${stats.rolesAgregado}`);
  console.log(`    + estado agregado:   ${stats.estadoAgregado}`);
  console.log(`    + origen agregado:   ${stats.origenAgregado}`);
  console.log(`  Errores:               ${stats.errores}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (DRY_RUN) {
    console.log('🔍 DRY-RUN · ningún documento fue modificado.');
    console.log('   Para ejecutar la migración real: node scripts/migrate-users-v2.mjs\n');
  } else if (stats.errores === 0) {
    console.log('✅ Migración completada sin errores.\n');
  } else {
    console.log(`⚠️  Migración completada con ${stats.errores} errores · revisar arriba.\n`);
  }
}

migrate().catch((err) => {
  console.error('❌ Error fatal en migración:', err);
  process.exit(1);
});
