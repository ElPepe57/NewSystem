/**
 * Backup productos · 2026-05-04
 * Exporta toda la colección /productos a backups/productos-{timestamp}.json
 * Para uso defensivo antes de cambios estructurales.
 *
 * Restore (si es necesario):
 *   node scripts/restore-productos.mjs backups/productos-{timestamp}.json
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const filename = `backups/productos-${ts}.json`;
const filepath = resolve(filename);

console.log(`═══ Backup colección /productos · ${ts} ═══`);

const snap = await db.collection('productos').get();
console.log(`Documentos a respaldar: ${snap.size}`);

// Convertir Timestamps a un formato serializable preservando _seconds + _nanoseconds
function reviveDates(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(reviveDates);
  if (typeof obj === 'object') {
    // Firebase Timestamp tiene .toDate() y _seconds/_nanoseconds
    if (typeof obj.toDate === 'function' && '_seconds' in obj) {
      return { __ts: true, _seconds: obj._seconds, _nanoseconds: obj._nanoseconds || 0 };
    }
    const r = {};
    for (const k of Object.keys(obj)) r[k] = reviveDates(obj[k]);
    return r;
  }
  return obj;
}

const productos = snap.docs.map(d => ({
  id: d.id,
  data: reviveDates(d.data()),
}));

mkdirSync('backups', { recursive: true });

writeFileSync(filepath, JSON.stringify({
  meta: {
    exportadoEn: new Date().toISOString(),
    coleccion: 'productos',
    cantidad: productos.length,
    proyecto: 'businessmn-269c9',
    nota: 'Snapshot pre-limpieza V1 (S3.4) · usable como referencia o restore',
  },
  productos,
}, null, 2));

const sizeKB = Math.round(JSON.stringify(productos).length / 1024);
console.log(`✅ Backup guardado en: ${filename}`);
console.log(`   ${productos.length} documentos · ~${sizeKB} KB`);

// Stats por prefijo SKU
const stats = {};
for (const p of productos) {
  const m = (p.data.sku || '').match(/^([A-Z]+)-/);
  const prefix = m ? m[1] : '(otro)';
  stats[prefix] = (stats[prefix] || 0) + 1;
}
console.log(`Distribución:`, stats);

process.exit(0);
