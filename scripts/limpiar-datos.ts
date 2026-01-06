/**
 * Script para limpiar datos de migración anterior
 *
 * Uso:
 *   node scripts/dist/limpiar-datos.js           # Ver qué se eliminará
 *   node scripts/dist/limpiar-datos.js --execute # Ejecutar limpieza
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');

const require = createRequire(import.meta.url);
const serviceAccount = require(serviceAccountPath);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const IS_DRY_RUN = !process.argv.includes('--execute');

async function eliminarColeccion(nombreColeccion: string): Promise<number> {
  const snapshot = await db.collection(nombreColeccion).get();

  if (snapshot.empty) {
    console.log(`  ${nombreColeccion}: 0 documentos (vacía)`);
    return 0;
  }

  console.log(`  ${nombreColeccion}: ${snapshot.size} documentos`);

  if (IS_DRY_RUN) {
    return snapshot.size;
  }

  // Eliminar en lotes de 500
  const batchSize = 500;
  let deleted = 0;

  while (true) {
    const batch = db.batch();
    const docs = await db.collection(nombreColeccion).limit(batchSize).get();

    if (docs.empty) break;

    docs.docs.forEach(doc => {
      batch.delete(doc.ref);
      deleted++;
    });

    await batch.commit();
    console.log(`    Eliminados ${deleted} documentos...`);
  }

  return deleted;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║          LIMPIEZA DE DATOS - BusinessMN                            ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  if (IS_DRY_RUN) {
    console.log('║   🔍 MODO VERIFICACIÓN - Solo muestra qué se eliminaría            ║');
  } else {
    console.log('║   ⚠️  MODO EJECUCIÓN - SE ELIMINARÁN TODOS LOS DATOS               ║');
  }
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  const colecciones = ['productos', 'categorias', 'tiposProducto', 'etiquetas'];

  console.log('Colecciones a limpiar:');

  let total = 0;
  for (const col of colecciones) {
    const count = await eliminarColeccion(col);
    total += count;
  }

  console.log(`\nTotal: ${total} documentos ${IS_DRY_RUN ? 'a eliminar' : 'eliminados'}`);

  if (IS_DRY_RUN) {
    console.log('\n💡 Para ejecutar la limpieza real, usa:');
    console.log('   node scripts/dist/limpiar-datos.js --execute');
  }
}

main()
  .then(() => {
    console.log('\n✅ Proceso finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
