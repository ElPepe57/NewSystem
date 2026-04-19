/**
 * Delete colaborador por código con validación de dependencias.
 * Uso: node scripts/delete-colaborador.mjs COL-008
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const codigoInput = process.argv[2];
if (!codigoInput) {
  console.error('Uso: node scripts/delete-colaborador.mjs <COL-XXX>');
  process.exit(1);
}

const C = { reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m' };

async function main() {
  console.log(`${C.cyan}Buscando colaborador con código=${codigoInput}…${C.reset}`);
  const snap = await db.collection('colaboradores').where('codigo', '==', codigoInput).get();
  if (snap.empty) {
    console.error(`${C.red}No se encontró colaborador con código ${codigoInput}${C.reset}`);
    process.exit(1);
  }
  if (snap.size > 1) {
    console.error(`${C.red}Hay ${snap.size} colaboradores con ese código. Aborto.${C.reset}`);
    process.exit(1);
  }

  const docRef = snap.docs[0].ref;
  const data = snap.docs[0].data();
  console.log(`Encontrado: ${C.yellow}${data.nombre}${C.reset} (id=${docRef.id}, tipo=${data.tipo}, estado=${data.estado})`);

  // Validar deps
  const principalSnap = await db.collection('casillas').where('colaboradorId', '==', docRef.id).get();
  if (!principalSnap.empty) {
    const nombres = principalSnap.docs.map(d => d.data().nombre).join(', ');
    console.error(`${C.red}Bloqueado: es dueño principal de ${principalSnap.size} casillas: ${nombres}${C.reset}`);
    process.exit(1);
  }

  const secSnap = await db.collection('casillas')
    .where('colaboradoresSecundariosIds', 'array-contains', docRef.id).get();
  if (!secSnap.empty) {
    const nombres = secSnap.docs.map(d => d.data().nombre).join(', ');
    console.error(`${C.red}Bloqueado: es secundario en ${secSnap.size} casillas: ${nombres}${C.reset}`);
    process.exit(1);
  }

  console.log(`${C.green}Sin dependencias. Eliminando…${C.reset}`);
  await docRef.delete();
  console.log(`${C.green}✓ ${codigoInput} (${data.nombre}) eliminado${C.reset}`);

  // Contar colaboradores activos restantes
  const remaining = await db.collection('colaboradores').where('estado', '==', 'activo').get();
  const casillasActivas = await db.collection('casillas').where('estado', '==', 'activa').get();
  console.log(`${C.cyan}Estado actual: ${remaining.size} colaboradores activos, ${casillasActivas.size} casillas activas${C.reset}`);
}

main().catch(err => { console.error(err); process.exit(1); });
