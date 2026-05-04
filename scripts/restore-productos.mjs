/**
 * Restore productos · 2026-05-04 · USAR CON CUIDADO
 * Restaura un backup creado por backup-productos.mjs.
 *
 * Modos:
 *   --merge      → upsert (default · NO borra docs no presentes en el backup)
 *   --overwrite  → reemplazo total (borra docs no presentes · destructivo)
 *   --dry-run    → solo simula, no escribe
 *
 * Uso:
 *   node scripts/restore-productos.mjs backups/productos-2026-05-04_19-22-43.json --dry-run
 *   node scripts/restore-productos.mjs backups/productos-2026-05-04_19-22-43.json --merge
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const file = args.find(a => a.endsWith('.json'));
const dryRun = args.includes('--dry-run');
const overwrite = args.includes('--overwrite');

if (!file) {
  console.error('❌ Falta argumento · path al backup .json');
  console.error('Uso: node scripts/restore-productos.mjs backups/productos-XXX.json [--dry-run|--merge|--overwrite]');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const raw = JSON.parse(readFileSync(file, 'utf-8'));
const productos = raw.productos;
console.log(`═══ Restore desde ${file} ═══`);
console.log(`Backup: ${productos.length} productos · creado ${raw.meta.exportadoEn}`);
console.log(`Modo: ${dryRun ? 'DRY-RUN (simulación)' : overwrite ? 'OVERWRITE (destructivo)' : 'MERGE (upsert · safe)'}`);

if (!dryRun && !overwrite) {
  console.log('⚠️  Vas a hacer upsert · NO se borran docs que ya existen pero no están en el backup.');
  console.log('   Para confirmar, ejecutá de nuevo en 5 segundos... (Ctrl+C para abortar)');
  await new Promise(r => setTimeout(r, 5000));
}

if (overwrite && !dryRun) {
  console.log('🚨 OVERWRITE: voy a borrar docs que no están en el backup. 10 seg para abortar (Ctrl+C)...');
  await new Promise(r => setTimeout(r, 10000));
}

// Convertir __ts a Timestamp real
function reviveTimestamps(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(reviveTimestamps);
  if (typeof obj === 'object') {
    if (obj.__ts === true) {
      return new Timestamp(obj._seconds || 0, obj._nanoseconds || 0);
    }
    const r = {};
    for (const k of Object.keys(obj)) r[k] = reviveTimestamps(obj[k]);
    return r;
  }
  return obj;
}

let written = 0;
let deleted = 0;

if (overwrite && !dryRun) {
  // Borrar docs actuales que no están en el backup
  const idsBackup = new Set(productos.map(p => p.id));
  const actual = await db.collection('productos').get();
  const toDelete = actual.docs.filter(d => !idsBackup.has(d.id));
  console.log(`Docs a borrar: ${toDelete.length}`);
  for (const d of toDelete) {
    await d.ref.delete();
    deleted++;
  }
}

for (const p of productos) {
  if (dryRun) {
    console.log(`[DRY] ${p.id} · ${p.data.sku} · ${p.data.marca}`);
    continue;
  }
  const data = reviveTimestamps(p.data);
  await db.doc(`productos/${p.id}`).set(data, { merge: !overwrite });
  written++;
}

console.log(`\n═══ Resumen ═══`);
console.log(`Escritos: ${written}`);
if (overwrite) console.log(`Borrados: ${deleted}`);
console.log(`✅ Restore completado`);
process.exit(0);
