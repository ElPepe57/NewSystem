/**
 * ===============================================
 * SEED: Países de Origen (paisesOrigen)
 * ===============================================
 *
 * Crea los países de origen iniciales en Firestore.
 * Es idempotente: verifica por codigo antes de crear.
 *
 * Uso:
 *   DRY RUN (solo ver qué haría):
 *     node scripts/seed-paises-origen.mjs --dry-run
 *
 *   EJECUTAR:
 *     node scripts/seed-paises-origen.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

const PAISES_SEED = [
  { nombre: 'Estados Unidos', codigo: 'USA', codigoISO: 'US', activo: true, tiempoTransitoEstimadoDias: 5, modeloLogistico: 'viajero', monedaCompra: 'USD' },
  { nombre: 'China', codigo: 'CHN', codigoISO: 'CN', activo: true, tiempoTransitoEstimadoDias: 45, modeloLogistico: 'courier', monedaCompra: 'USD' },
  { nombre: 'Corea del Sur', codigo: 'KOR', codigoISO: 'KR', activo: true, tiempoTransitoEstimadoDias: 20, modeloLogistico: 'courier', monedaCompra: 'USD' },
  { nombre: 'Peru', codigo: 'PER', codigoISO: 'PE', activo: true, tiempoTransitoEstimadoDias: 0, modeloLogistico: 'local', monedaCompra: 'PEN' },
];

async function main() {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  SEED: Paises de Origen (paisesOrigen)`);
  console.log(`  Modo: ${DRY_RUN ? `${C.yellow}DRY RUN${C.reset}` : `${C.red}EJECUCION REAL${C.reset}`}`);
  console.log(`${'='.repeat(50)}\n`);

  const collRef = db.collection('paisesOrigen');
  let created = 0;
  let skipped = 0;

  for (const pais of PAISES_SEED) {
    // Verificar si ya existe por codigo
    const existing = await collRef.where('codigo', '==', pais.codigo).get();

    if (!existing.empty) {
      console.log(`  ${C.yellow}SKIP${C.reset} ${pais.nombre} (${pais.codigo}) — ya existe (ID: ${existing.docs[0].id})`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  ${C.yellow}[DRY-RUN]${C.reset} Se crearia: ${pais.nombre} (${pais.codigo})`);
      created++;
      continue;
    }

    const docRef = await collRef.add({
      ...pais,
      creadoPor: 'seed-script',
      fechaCreacion: FieldValue.serverTimestamp(),
    });

    console.log(`  ${C.green}CREATED${C.reset} ${pais.nombre} (${pais.codigo}) — ID: ${docRef.id}`);
    created++;
  }

  console.log(`\n${C.cyan}--- RESUMEN ---${C.reset}`);
  console.log(`  Creados: ${created}`);
  console.log(`  Omitidos (ya existian): ${skipped}`);

  if (DRY_RUN) {
    console.log(`\n  ${C.yellow}Esto fue un DRY RUN. Para ejecutar:${C.reset}`);
    console.log(`  node scripts/seed-paises-origen.mjs --execute\n`);
  } else {
    console.log(`\n  ${C.green}Seed completado.${C.reset}\n`);
  }
}

main().catch(err => {
  console.error(`${C.red}ERROR:${C.reset}`, err);
  process.exit(1);
});
