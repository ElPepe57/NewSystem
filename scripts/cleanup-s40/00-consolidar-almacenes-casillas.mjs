/**
 * ========================================================================
 * CLEANUP S40 — FASE 0B: CONSOLIDACIÓN almacenes → casillas
 * ========================================================================
 *
 * La migración S38 Fase A/B copió los docs de `almacenes` a `casillas` y
 * actualizó la taxonomía (viajero → casilla_viajero, almacen_peru → almacen_propio),
 * PERO `casilla.service.ts` seguía apuntando a `COLLECTIONS.ALMACENES`. Como
 * resultado, toda edición posterior a la migración quedó en `almacenes`, NO en
 * `casillas`. Los 12 docs de `casillas` están desactualizados.
 *
 * Este script:
 *   1. Copia los 12 docs vivos de `almacenes` → `casillas` preservando IDs
 *   2. Aplica taxonomía S37 al copiar: tipo 'viajero' → 'casilla_viajero',
 *      'almacen_peru' → 'almacen_propio', 'almacen_origen' → 'almacen_propio'
 *   3. Al terminar, `casillas` refleja la data viva. `almacenes` queda
 *      para borrado en la Fase 2.
 *
 * Uso:
 *   DRY RUN:  node scripts/cleanup-s40/00-consolidar-almacenes-casillas.mjs
 *   EJECUTAR: node scripts/cleanup-s40/00-consolidar-almacenes-casillas.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', bold: '\x1b[1m', dim: '\x1b[2m',
};

/**
 * Aplica la taxonomía S37 al tipo.
 * Legacy (colección almacenes) → S37 (colección casillas).
 */
function migrarTipo(tipoLegacy) {
  const mapeo = {
    'viajero': 'casilla_viajero',
    'courier': 'casilla_courier',
    'almacen_peru': 'almacen_propio',
    'almacen_origen': 'almacen_propio',
  };
  return mapeo[tipoLegacy] || tipoLegacy;
}

async function main() {
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}${C.cyan}  CLEANUP S40 — FASE 0B: CONSOLIDACIÓN almacenes → casillas${C.reset}`);
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(DRY_RUN
    ? `${C.yellow}${C.bold}MODO DRY-RUN. Usa --execute para ejecutar.${C.reset}\n`
    : `${C.red}${C.bold}⚠️  MODO EJECUCIÓN REAL${C.reset}\n`);

  const almSnap = await db.collection('almacenes').get();
  const casSnap = await db.collection('casillas').get();

  console.log(`${C.bold}Docs detectados:${C.reset}`);
  console.log(`  almacenes (fuente viva) : ${almSnap.size}`);
  console.log(`  casillas (desactualizada): ${casSnap.size}`);

  if (almSnap.empty) {
    console.log(`\n${C.yellow}${C.bold}⚠️  almacenes está vacía — nada que consolidar.${C.reset}`);
    process.exit(0);
  }

  // Preview de migración
  console.log(`\n${C.bold}Plan de consolidación (${almSnap.size} docs):${C.reset}`);
  const cambios = [];
  for (const doc of almSnap.docs) {
    const data = doc.data();
    const tipoLegacy = data.tipo || '—';
    const tipoNuevo = migrarTipo(tipoLegacy);
    cambios.push({ id: doc.id, codigo: data.codigo, nombre: data.nombre, tipoLegacy, tipoNuevo });
    console.log(`  [${doc.id.slice(0, 8)}] ${(data.codigo || '—').padEnd(8)} ${(data.nombre || '—').padEnd(32)} ${tipoLegacy}${tipoLegacy !== tipoNuevo ? ` → ${C.cyan}${tipoNuevo}${C.reset}` : ''}`);
  }

  if (DRY_RUN) {
    console.log(`\n${C.yellow}${C.bold}DRY-RUN completo. Para ejecutar:${C.reset}`);
    console.log(`  node scripts/cleanup-s40/00-consolidar-almacenes-casillas.mjs --execute\n`);
    process.exit(0);
  }

  // Última confirmación
  console.log(`\n${C.red}${C.bold}Ejecutando en 3 segundos... Ctrl+C para cancelar.${C.reset}`);
  await new Promise(r => setTimeout(r, 3000));

  // 1. Borrar casillas desactualizadas (preserva los IDs que ya coinciden, se sobreescribirán)
  if (!casSnap.empty) {
    console.log(`\n${C.cyan}1. Borrando ${casSnap.size} docs desactualizados de casillas...${C.reset}`);
    const batch1 = db.batch();
    casSnap.docs.forEach(d => batch1.delete(d.ref));
    await batch1.commit();
    console.log(`   ${C.green}✓ ${casSnap.size} docs eliminados${C.reset}`);
  }

  // 2. Copiar almacenes → casillas con taxonomía actualizada (mismos IDs)
  console.log(`\n${C.cyan}2. Copiando ${almSnap.size} docs vivos a casillas con taxonomía S37...${C.reset}`);
  const now = Timestamp.now();
  const batch2 = db.batch();
  for (const doc of almSnap.docs) {
    const data = doc.data();
    const dataNueva = {
      ...data,
      tipo: migrarTipo(data.tipo),
      // Metadata de migración
      migradoDesdeAlmacenes: true,
      fechaMigracion: now,
      tipoLegacy: data.tipo,
    };
    const nuevoRef = db.collection('casillas').doc(doc.id);
    batch2.set(nuevoRef, dataNueva);
  }
  await batch2.commit();
  console.log(`   ${C.green}✓ ${almSnap.size} docs copiados a casillas${C.reset}`);

  // 3. Validación post-consolidación
  console.log(`\n${C.cyan}3. Validando consolidación...${C.reset}`);
  const casValidation = await db.collection('casillas').get();
  console.log(`   casillas ahora tiene: ${C.green}${casValidation.size} docs${C.reset}`);
  const sinTipoS37 = casValidation.docs.filter(d => {
    const t = d.data().tipo;
    return t && !['casilla_viajero', 'casilla_courier', 'almacen_propio'].includes(t);
  });
  if (sinTipoS37.length > 0) {
    console.log(`   ${C.yellow}⚠ ${sinTipoS37.length} docs con tipo fuera de taxonomía S37:${C.reset}`);
    sinTipoS37.forEach(d => console.log(`      ${d.id.slice(0, 8)} → ${d.data().tipo}`));
  } else {
    console.log(`   ${C.green}✓ Todos los docs usan taxonomía S37${C.reset}`);
  }

  console.log(`\n${C.green}${C.bold}✓ Consolidación completa.${C.reset}`);
  console.log(`\n${C.dim}La colección 'almacenes' aún tiene los ${almSnap.size} docs originales.`);
  console.log(`Se borrará en la Fase 2 (02-borrar-transaccionales.mjs).${C.reset}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error(`${C.red}❌ Error fatal:${C.reset}`, err);
  process.exit(1);
});
