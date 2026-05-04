/**
 * S3.4 · Fix one-shot · 2026-05-04
 * El producto Triple Strength Omega 3 (SUP-0168 · QA0wDWgPSSyfL8ROlj5g) se creó
 * vía wizard nuevo cuando el ProductoService.create() tenía el bug de no
 * persistir `contenidoNeto`. Su contenido legacy quedó como "150 capsulas".
 * Este script repara ese producto agregando el contenidoNeto estructurado.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const ID = 'QA0wDWgPSSyfL8ROlj5g';

const ref = db.doc(`productos/${ID}`);
const snap = await ref.get();
if (!snap.exists) { console.error('No existe'); process.exit(1); }
const p = snap.data();
console.log(`Producto: ${p.marca} · ${p.nombreComercial}`);
console.log(`contenido legacy: ${p.contenido}`);
console.log(`contenidoNeto actual: ${JSON.stringify(p.contenidoNeto)}`);

if (p.contenidoNeto) {
  console.log('Ya tiene contenidoNeto · skip');
  process.exit(0);
}

const m = (p.contenido || '').match(/^([\d.]+)\s*(\w+)/);
if (!m) { console.error(`No se pudo parsear "${p.contenido}"`); process.exit(1); }
const valor = parseFloat(m[1]);
const unidadRaw = m[2].toLowerCase();
const map = { 'cápsulas': 'capsulas', 'capsulas': 'capsulas' };
const unidad = map[unidadRaw] || unidadRaw;

const contenidoNeto = { valor, unidad };
console.log(`Nuevo contenidoNeto: ${JSON.stringify(contenidoNeto)}`);

await ref.update({
  contenidoNeto,
  ultimaEdicion: FieldValue.serverTimestamp(),
});
console.log('✅ contenidoNeto agregado');
process.exit(0);
