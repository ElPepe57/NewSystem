/**
 * ===============================================
 * DIAGNÓSTICO: categoriasCosto · estado de la BD
 * ===============================================
 *
 * Verifica el estado real de la colección `categoriasCosto` en Firestore.
 * Reporta:
 *   - Total de categorías
 *   - Breakdown por bloque (producto · venta · periodo)
 *   - Padres (nivel=0) vs hijas (nivel=1) por bloque
 *   - Padres sin nivel definido (potencial bug de seed)
 *   - Lista los primeros 5 nombres por bloque para verificar visualmente
 *
 * Uso:
 *   node scripts/diagnose-categorias-costos.mjs
 *
 * Pre-requisitos:
 *   - GOOGLE_APPLICATION_CREDENTIALS configurado o gcloud auth default-login
 *   - Permisos de lectura en colección categoriasCosto del proyecto activo
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// chk5.C-FIX · usa el proyecto del environment o el default declarado
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'businessmn-269c9';
initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', gray: '\x1b[90m',
};

async function main() {
  console.log(`\n${C.bold}═══ DIAGNÓSTICO categoriasCosto ═══${C.reset}`);
  console.log(`${C.gray}Proyecto Firebase activo: ${PROJECT_ID}${C.reset}\n`);

  // chk5.C-FIX · verificar AMBAS colecciones · hay bug histórico de naming
  // entre `categoriasCosto` (seed legacy) y `categoriasCostos` (app + rules canon)
  const [snapSinS, snapConS] = await Promise.all([
    db.collection('categoriasCosto').get(),
    db.collection('categoriasCostos').get(),
  ]);
  console.log(`${C.bold}Colección "categoriasCosto" (SIN S): ${C.reset}${snapSinS.size} documentos`);
  console.log(`${C.bold}Colección "categoriasCostos" (CON S · canon app): ${C.reset}${snapConS.size} documentos\n`);

  // La app lee de `categoriasCostos` (con S · ver src/config/collections.ts)
  const snap = snapConS.size > 0 ? snapConS : snapSinS;
  const fuenteUsada = snapConS.size > 0 ? 'categoriasCostos (canon)' : 'categoriasCosto (legacy)';
  console.log(`${C.gray}Analizando: ${fuenteUsada}${C.reset}\n`);

  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`${C.bold}Total documentos analizados: ${docs.length}${C.reset}\n`);

  if (docs.length === 0) {
    console.log(`${C.red}${C.bold}⚠ La colección está VACÍA.${C.reset}`);
    console.log(`${C.yellow}Ejecutá el seed canon:${C.reset}`);
    console.log(`${C.cyan}  node scripts/seed-categorias-costos-completo.mjs --execute${C.reset}\n`);
    process.exit(0);
  }

  // Breakdown por bloque
  const bloques = ['producto', 'venta', 'periodo'];
  const otros = docs.filter(d => !bloques.includes(d.bloque));

  for (const bloque of bloques) {
    const delBloque = docs.filter(d => d.bloque === bloque);
    const padres = delBloque.filter(d => d.nivel === 0);
    const hijos = delBloque.filter(d => d.nivel === 1);
    const sinNivel = delBloque.filter(d => d.nivel === undefined || d.nivel === null);

    const statusColor = padres.length > 0 ? C.green : C.red;
    console.log(`${C.bold}Bloque "${bloque}":${C.reset} ${statusColor}${delBloque.length} documentos${C.reset}`);
    console.log(`  ${C.gray}· Padres (nivel=0):  ${padres.length}${C.reset}`);
    console.log(`  ${C.gray}· Hijos (nivel=1):   ${hijos.length}${C.reset}`);
    if (sinNivel.length > 0) {
      console.log(`  ${C.red}· Sin nivel definido: ${sinNivel.length} ⚠ BUG${C.reset}`);
    }
    if (padres.length > 0) {
      const ejemplos = padres.slice(0, 5).map(p => p.nombre).join(' · ');
      console.log(`  ${C.cyan}Primeros padres: ${ejemplos}${C.reset}`);
    } else {
      console.log(`  ${C.red}${C.bold}⚠ Sin padres · este bloque NO funcionará en GastoForm${C.reset}`);
    }
    console.log();
  }

  if (otros.length > 0) {
    console.log(`${C.red}${C.bold}⚠ ${otros.length} documentos con bloque inválido:${C.reset}`);
    otros.slice(0, 5).forEach(d => {
      console.log(`  ${C.red}· ${d.id} → bloque="${d.bloque}" nombre="${d.nombre}"${C.reset}`);
    });
    console.log();
  }

  // Resumen final
  const totalPadres = docs.filter(d => d.nivel === 0).length;
  const totalHijos = docs.filter(d => d.nivel === 1).length;
  console.log(`${C.bold}Resumen:${C.reset} ${totalPadres} padres + ${totalHijos} hijos = ${docs.length} total`);

  if (totalPadres === 16 && totalHijos === 48) {
    console.log(`${C.green}${C.bold}✓ Estado canon completo (16 padres + 48 subs)${C.reset}\n`);
  } else if (totalPadres < 16) {
    console.log(`${C.yellow}⚠ Faltan padres canon (esperados 16). Considerá re-ejecutar el seed.${C.reset}`);
    console.log(`${C.cyan}  node scripts/seed-categorias-costos-completo.mjs --execute${C.reset}\n`);
  } else {
    console.log(`${C.yellow}⚠ Hay más documentos de los esperados · revisar duplicados${C.reset}\n`);
  }
}

main().catch(err => {
  console.error(`${C.red}${C.bold}Error de diagnóstico:${C.reset}`, err);
  process.exit(1);
});
