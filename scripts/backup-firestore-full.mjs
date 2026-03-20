/**
 * ===============================================
 * BACKUP COMPLETO: Exportar todas las colecciones de Firestore a JSON
 * ===============================================
 *
 * Exporta cada colección como un archivo JSON individual en la carpeta backup/
 * Incluye timestamps convertidos a ISO strings para legibilidad.
 *
 * Uso: node scripts/backup-firestore-full.mjs
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const BACKUP_DIR = path.join(process.cwd(), 'backup', `firestore-${new Date().toISOString().slice(0, 10)}`);

// All known collections
const COLLECTIONS = [
  'productos',
  'unidades',
  'ventas',
  'ordenesCompra',
  'transferencias',
  'cotizaciones',
  'requerimientos',
  'gastos',
  'movimientosTesoreria',
  'entregas',
  'almacenes',
  'clientes',
  'proveedores',
  'marcas',
  'categorias',
  'etiquetas',
  'tiposProducto',
  'lineasNegocio',
  'paisesOrigen',
  'canalesVenta',
  'mlOrderSync',
  'mlConfig',
  'mlProductMap',
  'cuentasCaja',
  'conteosInventario',
  'configuracion',
  'actividades',
];

function serializeValue(val) {
  if (val === null || val === undefined) return val;
  if (val._seconds !== undefined && val._nanoseconds !== undefined) {
    // Firestore Timestamp
    return { _type: 'timestamp', iso: new Date(val._seconds * 1000).toISOString(), _seconds: val._seconds };
  }
  if (Array.isArray(val)) return val.map(serializeValue);
  if (typeof val === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(val)) {
      result[k] = serializeValue(v);
    }
    return result;
  }
  return val;
}

async function main() {
  console.log(`\n📦 BACKUP COMPLETO DE FIRESTORE`);
  console.log(`   Destino: ${BACKUP_DIR}\n`);

  // Create backup directory
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const summary = {};

  for (const collName of COLLECTIONS) {
    try {
      const snap = await db.collection(collName).get();

      if (snap.empty) {
        console.log(`  ⏭️  ${collName.padEnd(25)} 0 docs (vacía)`);
        summary[collName] = 0;
        continue;
      }

      const docs = snap.docs.map(d => ({
        _id: d.id,
        ...serializeValue(d.data())
      }));

      const filePath = path.join(BACKUP_DIR, `${collName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');

      const sizeMB = (Buffer.byteLength(JSON.stringify(docs)) / 1024 / 1024).toFixed(2);
      console.log(`  ✅ ${collName.padEnd(25)} ${String(docs.length).padStart(4)} docs  (${sizeMB} MB)`);
      summary[collName] = docs.length;
    } catch (err) {
      console.log(`  ❌ ${collName.padEnd(25)} Error: ${err.message}`);
      summary[collName] = 'error';
    }
  }

  // Write summary
  const summaryPath = path.join(BACKUP_DIR, '_SUMMARY.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    fecha: new Date().toISOString(),
    proyecto: 'businessmn-269c9',
    colecciones: summary,
    totalDocumentos: Object.values(summary).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0)
  }, null, 2), 'utf-8');

  console.log(`\n📊 Resumen guardado en ${summaryPath}`);
  console.log(`✅ Backup completo en: ${BACKUP_DIR}\n`);
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
