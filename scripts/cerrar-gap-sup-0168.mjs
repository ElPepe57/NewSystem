/**
 * S3.4 (2026-05-04) · Cerrar gap SUP-0168 + ajustar contador.
 *
 * Contexto · arqueología confirmó que SUP-0168 nunca existió en BD:
 *   - 0 huellas en audit_logs (148), actividad (281), mlWebhookLog (2202),
 *     mlOrderSync (64), mlProductMap (108), mlShipmentLog (19)
 *   - 0 productos con archivado/eliminado
 *   - Hipótesis: import CSV legacy con salto de fila O generación atómica con
 *     falla parcial (contador se incrementó, doc nunca se persistió)
 *
 * Acción · cerrar el gap reasignando el producto más reciente:
 *   - Triple Strength Omega 3 Fish Oil (id=QA0w...) hoy SUP-0171 → SUP-0168
 *   - Es seguro al 100% porque no tiene actividad operacional aún
 *     (sin unidades, sin ventas, sin OC, sin ML mapping)
 *
 * Resultado:
 *   - 170 productos SUP con SKUs consecutivos SUP-0001 → SUP-0170
 *   - contadores/SUP.current = 170 (próximo será SUP-0171)
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const PRODUCTO_ID = 'QA0wDWgPSSyfL8ROlj5g'; // Triple Strength Omega 3 Fish Oil
const SKU_ANTERIOR = 'SUP-0171';
const SKU_NUEVO = 'SUP-0168';

console.log('═══ Cerrar gap SUP-0168 · 2026-05-04 ═══\n');

// ─── 1. Verificación previa ──────────────────────────────────────────────────
const allSnap = await db.collection('productos').get();
const all = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));

const productoTarget = all.find(p => p.id === PRODUCTO_ID);
if (!productoTarget) {
  console.error(`❌ Producto ${PRODUCTO_ID} no existe.`);
  process.exit(1);
}

const ya0168 = all.filter(p => p.sku === SKU_NUEVO);
if (ya0168.length > 0) {
  console.error(`❌ Ya existe(n) ${ya0168.length} producto(s) con ${SKU_NUEVO}: ${ya0168.map(p => p.id).join(', ')}`);
  process.exit(1);
}

const ya0171 = all.filter(p => p.sku === SKU_ANTERIOR);
console.log(`Producto target: ${productoTarget.marca} · ${productoTarget.nombreComercial}`);
console.log(`SKU actual: ${productoTarget.sku} · esperado ${SKU_ANTERIOR}`);
console.log(`Cantidad ${SKU_NUEVO} en BD: ${ya0168.length} (debe ser 0)`);
console.log(`Cantidad ${SKU_ANTERIOR} en BD: ${ya0171.length} (debe ser 1)\n`);

if (productoTarget.sku !== SKU_ANTERIOR) {
  console.error(`❌ Producto ${PRODUCTO_ID} no tiene el SKU esperado ${SKU_ANTERIOR}. Estado actual: ${productoTarget.sku}. Abortar para no romper otra cosa.`);
  process.exit(1);
}

// ─── 2. Reasignar SKU ────────────────────────────────────────────────────────
console.log('═══ Reasignar SKU ═══');
await db.doc(`productos/${PRODUCTO_ID}`).update({
  sku: SKU_NUEVO,
  ultimaEdicion: FieldValue.serverTimestamp(),
});
console.log(`✅ ${PRODUCTO_ID} · ${SKU_ANTERIOR} → ${SKU_NUEVO}`);

// ─── 3. Ajustar contador SUP a 170 ───────────────────────────────────────────
console.log('\n═══ Ajustar contadores/SUP ═══');
const ahora = FieldValue.serverTimestamp();
await db.doc('contadores/SUP').set({
  current: 170,
  initializedAt: ahora,
  updatedAt: ahora,
});
console.log('✅ contadores/SUP = 170 (próximo será SUP-0171)');

// ─── 4. Verificación final ──────────────────────────────────────────────────
console.log('\n═══ Verificación final ═══');
const finalSnap = await db.collection('productos').get();
const finalSUP = [];
for (const d of finalSnap.docs) {
  const sku = d.data().sku || '';
  const m = sku.match(/^SUP-(\d+)$/);
  if (m) finalSUP.push(parseInt(m[1]));
}
finalSUP.sort((a, b) => a - b);

const min = finalSUP[0];
const max = finalSUP[finalSUP.length - 1];
const gaps = [];
for (let i = min; i <= max; i++) {
  if (!finalSUP.includes(i)) gaps.push(i);
}

console.log(`Productos SUP: ${finalSUP.length} · rango ${min} → ${max}`);
console.log(`Gaps encontrados: ${gaps.length}`);
if (gaps.length === 0) {
  console.log(`✅ SKUs consecutivos · sin huecos`);
} else {
  console.log(`⚠️  SKUs faltantes: ${gaps.map(n => `SUP-${String(n).padStart(4, '0')}`).join(', ')}`);
}

const cFinal = await db.doc('contadores/SUP').get();
console.log(`Contador SUP: ${cFinal.data().current}`);

console.log('\n✅ FIX COMPLETO');
process.exit(0);
