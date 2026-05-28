/**
 * scripts/audit-users-identity.mjs
 * chk5.AUTH-GUARD · 2026-05-28
 *
 * Audita la integridad de identidad de los usuarios:
 *   1. Cross-reference Firebase Auth ↔ Firestore users/{uid}
 *   2. Detecta cruces (email distinto entre Auth y Firestore)
 *   3. Detecta huérfanos (Auth sin Firestore · Firestore sin Auth)
 *   4. Detecta emails duplicados en Firestore
 *   5. Reporta TODOS los hallazgos en consola con detalle accionable
 *
 * NO modifica nada · solo lee + reporta. Sirve para diagnóstico.
 * Después de revisar el reporte, reparar manualmente desde Firebase Console
 * o crear un script de reparación específico según los hallazgos.
 *
 * USO:
 *   node scripts/audit-users-identity.mjs
 *
 * SAFETY:
 *   - Solo lectura · no escribe nada
 *   - Requiere firebase-admin-key.json en raíz del proyecto
 *   - Output a stdout · redirigir a archivo si querés guardar:
 *     node scripts/audit-users-identity.mjs > audit-report.txt
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVICE_ACCOUNT_PATH = resolve(__dirname, '../firebase-admin-key.json');

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(72)}`);
console.log(`  AUDITORÍA DE IDENTIDAD · Firebase Auth ↔ Firestore users/`);
console.log(`  Fecha: ${new Date().toISOString()}`);
console.log(`${'═'.repeat(72)}\n`);

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
} catch {
  console.error(`❌ No se encontró firebase-admin-key.json`);
  console.error(`   Ruta esperada: ${SERVICE_ACCOUNT_PATH}`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

function norm(email) {
  return (email || '').toLowerCase().trim();
}

function fmtUid(uid) {
  return uid.length > 16 ? `${uid.slice(0, 8)}...${uid.slice(-6)}` : uid;
}

// ─────────────────────────────────────────────────────────────────────────
// AUDITORÍA
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Cargar TODOS los Firebase Auth users (paginado)
  console.log(`📥 Cargando Firebase Auth users...`);
  const authUsers = [];
  let pageToken;
  do {
    const res = await auth.listUsers(1000, pageToken);
    res.users.forEach((u) => {
      authUsers.push({
        uid: u.uid,
        email: norm(u.email),
        displayName: u.displayName || '(sin nombre)',
        providers: u.providerData.map((p) => p.providerId),
        emailVerified: u.emailVerified,
        disabled: u.disabled,
      });
    });
    pageToken = res.pageToken;
  } while (pageToken);
  console.log(`   ✓ ${authUsers.length} users en Auth`);

  // 2. Cargar TODOS los Firestore users/*
  console.log(`📥 Cargando Firestore users/*...`);
  const usersSnap = await db.collection('users').get();
  const firestoreUsers = usersSnap.docs.map((d) => ({
    uid: d.id,
    email: norm(d.data().email),
    displayName: d.data().displayName || '(sin nombre)',
    activo: d.data().activo,
    role: d.data().role,
    roles: d.data().roles,
  }));
  console.log(`   ✓ ${firestoreUsers.length} docs en Firestore\n`);

  // Indexar por uid para lookups O(1)
  const authByUid = new Map(authUsers.map((u) => [u.uid, u]));
  const firestoreByUid = new Map(firestoreUsers.map((u) => [u.uid, u]));

  // ───────────────────────────────────────────────────────────────────────
  // FINDING 1 · Cruces de identidad (email no coincide)
  // ───────────────────────────────────────────────────────────────────────
  console.log(`${'─'.repeat(72)}`);
  console.log(`  FINDING 1 · CRUCES DE IDENTIDAD (email no coincide)`);
  console.log(`${'─'.repeat(72)}`);
  const cruces = [];
  for (const fsUser of firestoreUsers) {
    const authUser = authByUid.get(fsUser.uid);
    if (!authUser) continue; // huérfano · se reporta en finding 2
    if (authUser.email && fsUser.email && authUser.email !== fsUser.email) {
      cruces.push({ uid: fsUser.uid, authEmail: authUser.email, fsEmail: fsUser.email, fsDisplayName: fsUser.displayName });
    }
  }
  if (cruces.length === 0) {
    console.log(`✅ Sin cruces detectados. Auth.email === Firestore.email en todos los users.\n`);
  } else {
    console.log(`❌ ${cruces.length} cruce(s) detectado(s):\n`);
    cruces.forEach((c, i) => {
      console.log(`  ${i + 1}. UID: ${fmtUid(c.uid)}`);
      console.log(`     Auth.email      = "${c.authEmail}"`);
      console.log(`     Firestore.email = "${c.fsEmail}"  ← CORRUPTO`);
      console.log(`     Firestore.displayName = "${c.fsDisplayName}"`);
      console.log(`     UID completo: ${c.uid}`);
      console.log(`     ACCIÓN SUGERIDA: editar users/${c.uid} · cambiar email a "${c.authEmail}"`);
      console.log();
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // FINDING 2 · Huérfanos en Auth (Auth sin doc Firestore)
  // ───────────────────────────────────────────────────────────────────────
  console.log(`${'─'.repeat(72)}`);
  console.log(`  FINDING 2 · HUÉRFANOS EN AUTH (sin doc en Firestore)`);
  console.log(`${'─'.repeat(72)}`);
  const orphansAuth = authUsers.filter((u) => !firestoreByUid.has(u.uid));
  if (orphansAuth.length === 0) {
    console.log(`✅ Todos los Auth users tienen su doc en Firestore.\n`);
  } else {
    console.log(`⚠️  ${orphansAuth.length} user(s) en Auth sin doc Firestore:\n`);
    orphansAuth.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.email || '(sin email)'} · UID: ${fmtUid(u.uid)}`);
      console.log(`     Providers: ${u.providers.join(', ')}`);
      console.log(`     ACCIÓN: re-loguear con ese user → fetchUserProfile creará el doc automáticamente`);
      console.log(`             o borrarlo de Auth si no se va a usar más`);
      console.log();
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // FINDING 3 · Huérfanos en Firestore (doc sin Auth user)
  // ───────────────────────────────────────────────────────────────────────
  console.log(`${'─'.repeat(72)}`);
  console.log(`  FINDING 3 · HUÉRFANOS EN FIRESTORE (sin user en Auth)`);
  console.log(`${'─'.repeat(72)}`);
  const orphansFirestore = firestoreUsers.filter((u) => !authByUid.has(u.uid));
  if (orphansFirestore.length === 0) {
    console.log(`✅ Todos los docs Firestore tienen su Auth user.\n`);
  } else {
    console.log(`⚠️  ${orphansFirestore.length} doc(s) Firestore sin user en Auth:\n`);
    orphansFirestore.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.email || '(sin email)'} · "${u.displayName}"`);
      console.log(`     UID: ${fmtUid(u.uid)} (UID completo: ${u.uid})`);
      console.log(`     activo: ${u.activo} · role: ${u.role || (u.roles ? u.roles.join(',') : '?')}`);
      console.log(`     ACCIÓN: borrar users/${u.uid} si no se va a recrear el Auth user`);
      console.log();
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // FINDING 4 · Emails duplicados en Firestore
  // ───────────────────────────────────────────────────────────────────────
  console.log(`${'─'.repeat(72)}`);
  console.log(`  FINDING 4 · EMAILS DUPLICADOS EN FIRESTORE`);
  console.log(`${'─'.repeat(72)}`);
  const emailGroups = new Map();
  for (const u of firestoreUsers) {
    if (!u.email) continue;
    if (!emailGroups.has(u.email)) emailGroups.set(u.email, []);
    emailGroups.get(u.email).push(u);
  }
  const duplicados = Array.from(emailGroups.entries()).filter(([_, list]) => list.length > 1);
  if (duplicados.length === 0) {
    console.log(`✅ Sin emails duplicados. Cada email en Firestore es único.\n`);
  } else {
    console.log(`❌ ${duplicados.length} email(s) duplicado(s):\n`);
    duplicados.forEach(([email, list], i) => {
      console.log(`  ${i + 1}. Email "${email}" aparece en ${list.length} docs:`);
      list.forEach((u, j) => {
        console.log(`     ${j + 1}) UID: ${fmtUid(u.uid)} · "${u.displayName}" · activo: ${u.activo}`);
      });
      console.log(`     ACCIÓN: decidir cuál es el doc correcto · borrar los demás`);
      console.log();
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // RESUMEN
  // ───────────────────────────────────────────────────────────────────────
  console.log(`${'═'.repeat(72)}`);
  console.log(`  RESUMEN`);
  console.log(`${'═'.repeat(72)}`);
  console.log(`  Auth users:                  ${authUsers.length}`);
  console.log(`  Firestore users docs:        ${firestoreUsers.length}`);
  console.log(`  Cruces de identidad:         ${cruces.length}  ${cruces.length > 0 ? '❌' : '✅'}`);
  console.log(`  Huérfanos en Auth:           ${orphansAuth.length}  ${orphansAuth.length > 0 ? '⚠️ ' : '✅'}`);
  console.log(`  Huérfanos en Firestore:      ${orphansFirestore.length}  ${orphansFirestore.length > 0 ? '⚠️ ' : '✅'}`);
  console.log(`  Emails duplicados Firestore: ${duplicados.length}  ${duplicados.length > 0 ? '❌' : '✅'}`);
  console.log(`${'═'.repeat(72)}\n`);

  if (cruces.length === 0 && orphansFirestore.length === 0 && duplicados.length === 0) {
    console.log(`🎉 Sistema de identidad SANO. No requiere reparación.`);
  } else {
    console.log(`📋 Hay hallazgos a reparar. Revisar acciones sugeridas arriba.`);
    console.log(`   Reparar manualmente desde Firebase Console o crear script específico.`);
  }
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n❌ FALLA CRÍTICA: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  });
