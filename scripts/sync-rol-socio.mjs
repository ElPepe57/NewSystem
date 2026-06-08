/**
 * scripts/sync-rol-socio.mjs
 * chk5.PERSONAS-F1 · 2026-06-08
 *
 * Alinea el rol 'socio' de los UserProfile con sus RelacionLaboral tipo='socio'
 * VIGENTES. Los socios creados con el flujo nuevo (RelacionLaboral) nacen con rol
 * 'invitado' y NO aparecen en Inversionistas (que filtra por hasRole('socio')).
 * Este script 1× los corrige.
 *
 * COMPORTAMIENTO (seguro):
 *   - user con relación 'socio' VIGENTE que NO tiene el rol → AGREGA 'socio' a roles[]
 *     + suma los permisos de socio (sin quitar nada existente).
 *   - SOLO AGREGA · NUNCA quita roles (no rompe a los socios del modelo viejo que
 *     tienen el rol pero aún no tienen RelacionLaboral).
 *   - Idempotente · seguro de re-ejecutar.
 *
 * USO:
 *   node scripts/sync-rol-socio.mjs --dry-run   # diagnóstico (no escribe)
 *   node scripts/sync-rol-socio.mjs             # aplicar
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DRY_RUN = process.argv.includes('--dry-run');
const SERVICE_ACCOUNT_PATH = resolve(__dirname, '../firebase-admin-key.json');

const COL_USERS = 'users';
const COL_RELACIONES = 'relacionesLaborales';
// Permisos que aporta el rol 'socio' · debe coincidir con DEFAULT_PERMISOS.socio (auth.types.ts)
const PERMISOS_SOCIO = ['ver_dashboard', 'ver_inversionistas', 'ver_reportes'];
const ESTADOS_VIGENTES = ['vigente', 'pausada', 'prueba'];

console.log(`\n${'═'.repeat(70)}`);
console.log(`  SYNC · rol 'socio' ← RelacionLaboral vigente`);
console.log(`  Modo: ${DRY_RUN ? '🔍 DRY-RUN (sin escribir)' : '✏️  EJECUCIÓN REAL'}`);
console.log(`  Fecha: ${new Date().toISOString()}`);
console.log(`${'═'.repeat(70)}\n`);

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
} catch (err) {
  console.error(`❌ No se encontró firebase-admin-key.json en la raíz del proyecto.`);
  console.error(`   Ruta esperada: ${SERVICE_ACCOUNT_PATH}`);
  console.error(`   Descargala desde Firebase Console → Project Settings → Service accounts.`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

function getRoles(data) {
  if (Array.isArray(data.roles) && data.roles.length > 0) return data.roles;
  if (data.role) return [data.role];
  return [];
}

const unique = (arr) => Array.from(new Set(arr));

async function main() {
  // 1. Relaciones socio (filtro de estado en memoria · evita índice compuesto)
  const snap = await db.collection(COL_RELACIONES).where('tipo', '==', 'socio').get();
  const userIds = unique(
    snap.docs
      .filter((d) => ESTADOS_VIGENTES.includes(d.data().estado))
      .map((d) => d.data().userId)
      .filter(Boolean),
  );
  console.log(`Relaciones socio totales: ${snap.size} · usuarios con socio vigente: ${userIds.length}\n`);

  let corregidos = 0;
  let yaOk = 0;
  let huerfanos = 0;

  for (const uid of userIds) {
    const userRef = db.collection(COL_USERS).doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      console.log(`  ⚠️  user ${uid} no existe (relación huérfana) · skip`);
      huerfanos++;
      continue;
    }
    const data = userSnap.data();
    const roles = getRoles(data);
    if (roles.includes('socio')) {
      yaOk++;
      continue;
    }
    const nuevosRoles = [...roles, 'socio'];
    const nuevosPermisos = unique([...(data.permisos || []), ...PERMISOS_SOCIO]);
    console.log(`  ✏️  ${data.displayName || uid} · roles [${roles.join(', ') || '—'}] → [${nuevosRoles.join(', ')}]`);
    if (!DRY_RUN) {
      await userRef.update({ roles: nuevosRoles, permisos: nuevosPermisos });
    }
    corregidos++;
  }

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  Corregidos: ${corregidos} · ya OK: ${yaOk} · huérfanos: ${huerfanos}`);
  console.log(`  ${DRY_RUN ? '🔍 DRY-RUN · nada se escribió. Re-ejecutá sin --dry-run para aplicar.' : '✅ Aplicado.'}`);
  console.log(`${'─'.repeat(70)}\n`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
