/**
 * Reset de Red Logística (etapa de testeo):
 * 1. Borra casillas legacy con estado=undefined (pre-S37)
 * 2. Renumera casillas activas a CAS-001..CAS-00N (orden por fechaCreacion)
 * 3. Renumera colaboradores a COL-001..COL-00N (orden por fechaCreacion)
 * 4. Reset contadores COL y CAS al total resultante
 *
 * Uso: node scripts/reset-red-logistica.mjs --dry (solo simula)
 *      node scripts/reset-red-logistica.mjs --apply (ejecuta)
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');
const C = { reset: '\x1b[0m', g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', c: '\x1b[36m', d: '\x1b[2m' };

function pad3(n) { return String(n).padStart(3, '0'); }

async function main() {
  console.log(`${C.c}=== RESET RED LOGÍSTICA ===${C.reset}`);
  console.log(`${APPLY ? C.r + 'MODO APPLY — SE ESCRIBIRÁ EN FIRESTORE' : C.y + 'MODO DRY-RUN — no se escribirá nada'}${C.reset}\n`);

  // ── 1. Casillas: separar legacy (undefined) vs activas ──
  const casillasSnap = await db.collection('casillas').get();
  const legacy = [];
  const activas = [];
  casillasSnap.docs.forEach(d => {
    const data = d.data();
    if (data.estado === undefined) legacy.push({ ref: d.ref, data });
    else activas.push({ ref: d.ref, data });
  });

  console.log(`Casillas legacy (estado=undefined): ${C.y}${legacy.length}${C.reset}`);
  legacy.forEach(({ data }) => console.log(`  ${C.d}- ${data.codigo} · ${data.nombre}${C.reset}`));
  console.log(`Casillas con estado: ${C.g}${activas.length}${C.reset}`);

  // ── 2. Ordenar casillas activas por fechaCreacion asc ──
  activas.sort((a, b) => {
    const fa = a.data.fechaCreacion?.toMillis?.() ?? 0;
    const fb = b.data.fechaCreacion?.toMillis?.() ?? 0;
    return fa - fb;
  });

  console.log(`\n${C.c}── Renumeración de casillas ──${C.reset}`);
  const casillasUpdates = activas.map((c, i) => ({
    ref: c.ref,
    id: c.ref.id,
    oldCodigo: c.data.codigo,
    newCodigo: `CAS-${pad3(i + 1)}`,
    nombre: c.data.nombre,
  }));
  casillasUpdates.forEach(u => {
    const change = u.oldCodigo !== u.newCodigo ? `${C.y}${u.oldCodigo} → ${u.newCodigo}${C.reset}` : `${C.d}${u.oldCodigo} (sin cambio)${C.reset}`;
    console.log(`  ${change} · ${u.nombre}`);
  });

  // ── 3. Colaboradores: ordenar por fechaCreacion asc ──
  const colabsSnap = await db.collection('colaboradores').get();
  const colabs = colabsSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));
  colabs.sort((a, b) => {
    const fa = a.data.fechaCreacion?.toMillis?.() ?? 0;
    const fb = b.data.fechaCreacion?.toMillis?.() ?? 0;
    return fa - fb;
  });

  console.log(`\n${C.c}── Renumeración de colaboradores (${colabs.length}) ──${C.reset}`);
  const colabsUpdates = colabs.map((c, i) => ({
    ref: c.ref,
    id: c.ref.id,
    oldCodigo: c.data.codigo,
    newCodigo: `COL-${pad3(i + 1)}`,
    nombre: c.data.nombre,
  }));
  colabsUpdates.forEach(u => {
    const change = u.oldCodigo !== u.newCodigo ? `${C.y}${u.oldCodigo} → ${u.newCodigo}${C.reset}` : `${C.d}${u.oldCodigo} (sin cambio)${C.reset}`;
    console.log(`  ${change} · ${u.nombre}`);
  });

  // ── 4. Contadores finales ──
  const newCasCounter = activas.length;
  const newColCounter = colabs.length;
  console.log(`\n${C.c}── Contadores ──${C.reset}`);
  console.log(`  CAS.current = ${C.g}${newCasCounter}${C.reset} (próximo será CAS-${pad3(newCasCounter + 1)})`);
  console.log(`  COL.current = ${C.g}${newColCounter}${C.reset} (próximo será COL-${pad3(newColCounter + 1)})`);

  if (!APPLY) {
    console.log(`\n${C.y}Dry-run completo. Para ejecutar: node scripts/reset-red-logistica.mjs --apply${C.reset}`);
    return;
  }

  // ═══ APPLY ═══
  console.log(`\n${C.r}Aplicando cambios…${C.reset}`);

  // 1. Borrar legacy (chunks de 500 max por batch)
  let batch = db.batch();
  let ops = 0;
  const commit = async () => {
    if (ops > 0) { await batch.commit(); batch = db.batch(); ops = 0; }
  };

  for (const { ref } of legacy) {
    batch.delete(ref);
    if (++ops >= 450) await commit();
  }
  await commit();
  console.log(`${C.g}✓ ${legacy.length} casillas legacy eliminadas${C.reset}`);

  // 2. Actualizar códigos de casillas
  for (const u of casillasUpdates) {
    if (u.oldCodigo !== u.newCodigo) {
      batch.update(u.ref, { codigo: u.newCodigo });
      if (++ops >= 450) await commit();
    }
  }
  await commit();
  console.log(`${C.g}✓ Códigos de casillas actualizados${C.reset}`);

  // 3. Actualizar códigos de colaboradores
  for (const u of colabsUpdates) {
    if (u.oldCodigo !== u.newCodigo) {
      batch.update(u.ref, { codigo: u.newCodigo });
      if (++ops >= 450) await commit();
    }
  }
  await commit();
  console.log(`${C.g}✓ Códigos de colaboradores actualizados${C.reset}`);

  // 4. Reset contadores
  await db.collection('contadores').doc('CAS').set({
    current: newCasCounter,
    updatedAt: Timestamp.now(),
  }, { merge: true });
  await db.collection('contadores').doc('COL').set({
    current: newColCounter,
    updatedAt: Timestamp.now(),
  }, { merge: true });
  console.log(`${C.g}✓ Contadores reseteados: CAS=${newCasCounter}, COL=${newColCounter}${C.reset}`);

  console.log(`\n${C.g}Reset completo.${C.reset}`);
}

main().catch(err => { console.error(err); process.exit(1); });
