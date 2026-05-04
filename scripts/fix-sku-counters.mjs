/**
 * S3.4 (2026-05-04) · DEUDA-SKU-001 · Fix duplicado SUP-0001 + inicialización contadores.
 *
 * Problema: el sistema usa `contadores/{prefix}` para generar SKU atómicos, pero
 * esos contadores NUNCA se inicializaron con el max real de los productos legacy.
 * Cuando se creó el primer producto vía wizard nuevo, el contador arrancó en 0
 * y el producto recibió SUP-0001 — chocando con un SUP-0001 legacy ya existente.
 *
 * Estado encontrado:
 *   - 170 productos SUP existentes (SUP-0001 a SUP-0170)
 *   - 42 productos SKC existentes (SKC-0001 a SKC-0042)
 *   - 2 productos con SKU "SUP-0001":
 *     · "Glucosamina Condroitina · MicroIngredients" (legacy · diciembre 2025)
 *     · "Triple Strength Omega 3 Fish Oil · Sports Research" (recién creado · QA0w...)
 *
 * Acciones:
 *   1. Reasignar el SKU del producto recién creado a SUP-0171
 *   2. Inicializar contadores/SUP con current=171 (próximo será SUP-0172)
 *   3. Inicializar contadores/SKC con current=42 (próximo será SKC-0043)
 *
 * Bypass-rules: este script usa Admin SDK que tiene super-usuario sobre Firestore,
 * lo que le permite hacer el setDoc inicial saltándose la rule SEC-006 que prohíbe
 * cambios de contador que no sean +1 (esa rule sigue protegiendo a los clientes).
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const PRODUCTO_DUPLICADO_ID = 'QA0wDWgPSSyfL8ROlj5g'; // Triple Strength Omega 3 Fish Oil
const NUEVO_SKU = 'SUP-0171';

// ─── 1. Verificación previa ──────────────────────────────────────────────────
console.log('═══ VERIFICACIÓN PREVIA ═══');
const productosSnap = await db.collection('productos').get();
const productos = productosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

// Stats por prefijo
const grupos = {};
for (const p of productos) {
  const m = (p.sku || '').match(/^([A-Z]+)-(\d+)$/);
  if (m) {
    const [, prefix, num] = m;
    grupos[prefix] = grupos[prefix] || { count: 0, max: 0 };
    grupos[prefix].count++;
    grupos[prefix].max = Math.max(grupos[prefix].max, parseInt(num));
  }
}
console.log('Productos por prefijo:', grupos);

// Verificar duplicado
const duplicados = productos.filter(p => p.sku === 'SUP-0001');
console.log(`\nProductos con SUP-0001: ${duplicados.length}`);
duplicados.forEach(d => {
  console.log(`  - ${d.id} · ${d.marca} · ${d.nombreComercial}`);
});

// Verificar estado del producto (puede que ya esté reasignado de un intento previo)
const yaExiste171 = productos.find(p => p.sku === NUEVO_SKU);
const productoTarget = productos.find(p => p.id === PRODUCTO_DUPLICADO_ID);
const yaReasignado = yaExiste171 && yaExiste171.id === PRODUCTO_DUPLICADO_ID;
if (yaExiste171 && !yaReasignado) {
  console.error(`❌ ERROR: ${NUEVO_SKU} ya existe en otro producto (id=${yaExiste171.id}). Abortar.`);
  process.exit(1);
}
if (yaReasignado) {
  console.log(`ℹ️  Producto ${PRODUCTO_DUPLICADO_ID} ya tiene SKU ${NUEVO_SKU} de un intento previo · skip reasignación`);
}

// Verificar contadores actuales
const cSUP = await db.doc('contadores/SUP').get();
const cSKC = await db.doc('contadores/SKC').get();
console.log(`\nContador SUP actual: ${cSUP.exists ? cSUP.data().current : '(no existe)'}`);
console.log(`Contador SKC actual: ${cSKC.exists ? cSKC.data().current : '(no existe)'}`);

// ─── 2. Reasignar SKU del producto duplicado (idempotente) ───────────────────
console.log('\n═══ FIX 1 · Reasignar SKU del producto recién creado ═══');
const productoRef = db.doc(`productos/${PRODUCTO_DUPLICADO_ID}`);
const productoSnap = await productoRef.get();
if (!productoSnap.exists) {
  console.error(`❌ ERROR: producto ${PRODUCTO_DUPLICADO_ID} no existe.`);
  process.exit(1);
}
const productoActual = productoSnap.data();
console.log(`Producto: ${productoActual.marca} · ${productoActual.nombreComercial}`);
if (productoActual.sku === NUEVO_SKU) {
  console.log(`ℹ️  Ya tiene SKU=${NUEVO_SKU} · skip`);
} else {
  console.log(`SKU actual: ${productoActual.sku} → nuevo: ${NUEVO_SKU}`);
  await productoRef.update({
    sku: NUEVO_SKU,
    ultimaEdicion: FieldValue.serverTimestamp(),
  });
  console.log(`✅ SKU reasignado a ${NUEVO_SKU}`);
}

// ─── 3. Inicializar contadores con max real ──────────────────────────────────
console.log('\n═══ FIX 2 · Inicializar contadores con max real ═══');

const ahora = FieldValue.serverTimestamp();

// SUP: max=170, pero ya usamos 171 en este fix → contador queda en 171
await db.doc('contadores/SUP').set({
  current: 171,
  initializedAt: ahora,
  updatedAt: ahora,
});
console.log('✅ contadores/SUP = 171 (próximo será SUP-0172)');

// SKC: max=42, próximo será 43
await db.doc('contadores/SKC').set({
  current: 42,
  initializedAt: ahora,
  updatedAt: ahora,
});
console.log('✅ contadores/SKC = 42 (próximo será SKC-0043)');

// ─── 4. Verificación final ───────────────────────────────────────────────────
console.log('\n═══ VERIFICACIÓN FINAL ═══');
const finalSnap = await db.collection('productos').get();
const finalProductos = finalSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const finalDup = finalProductos.filter(p => p.sku === 'SUP-0001').length;
const final171 = finalProductos.filter(p => p.sku === 'SUP-0171').length;
console.log(`Productos con SUP-0001: ${finalDup} (esperado: 1)`);
console.log(`Productos con SUP-0171: ${final171} (esperado: 1)`);

const cSUPfinal = await db.doc('contadores/SUP').get();
const cSKCfinal = await db.doc('contadores/SKC').get();
console.log(`Contador SUP final: ${cSUPfinal.data().current}`);
console.log(`Contador SKC final: ${cSKCfinal.data().current}`);

console.log('\n✅ FIX COMPLETO');
process.exit(0);
