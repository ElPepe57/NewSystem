/**
 * Audit: lista TODAS las OC en Firestore y detecta cuáles podrían estar ocultas en la UI.
 *
 * Revisa:
 * - OCs sin lineaNegocioId (useLineaFilter estricto las oculta si hay línea activa)
 * - OCs con estado legacy que no está en el mapa del pipeline
 * - Últimas 20 OCs por fechaCreacion (para identificar la más reciente)
 *
 * Solo lectura — no modifica nada.
 *
 * Uso:
 *   node scripts/audit-oc-visibilidad.mjs
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const snap = await db
  .collection('ordenesCompra')
  .orderBy('fechaCreacion', 'desc')
  .get();

console.log(`\n=== TOTAL OCs en Firestore: ${snap.size} ===\n`);

// Cargar líneas de negocio para mapear id → nombre
const lineasSnap = await db.collection('lineasNegocio').get();
const lineas = {};
lineasSnap.forEach(d => { lineas[d.id] = d.data().nombre; });

console.log('Líneas de negocio configuradas:');
Object.entries(lineas).forEach(([id, nombre]) => console.log(`  ${id} → ${nombre}`));
console.log('');

// Últimas 20 OCs
console.log('=== ÚLTIMAS 20 OC (por fechaCreacion desc) ===');
console.log('Numero'.padEnd(18), 'Estado'.padEnd(18), 'Línea'.padEnd(25), 'Total'.padEnd(12), 'Fecha');
console.log('-'.repeat(100));

const ocsSinLinea = [];
const ocs = [];
let i = 0;
snap.forEach(d => {
  const oc = { id: d.id, ...d.data() };
  ocs.push(oc);
  if (!oc.lineaNegocioId) ocsSinLinea.push(oc);
  if (i++ < 20) {
    const fecha = oc.fechaCreacion?.toDate ? oc.fechaCreacion.toDate().toISOString().slice(0, 16).replace('T', ' ') : '-';
    const lineaNombre = oc.lineaNegocioId ? (lineas[oc.lineaNegocioId] || `(${oc.lineaNegocioId})`) : '⚠ SIN LÍNEA';
    const total = `$${(oc.totalUSD || 0).toFixed(2)}`;
    console.log(
      (oc.numeroOrden || oc.id).padEnd(18),
      (oc.estado || '-').padEnd(18),
      lineaNombre.padEnd(25),
      total.padEnd(12),
      fecha
    );
  }
});

console.log('\n=== OCs SIN lineaNegocioId (invisibles cuando hay filtro de línea activo) ===');
if (ocsSinLinea.length === 0) {
  console.log('  Ninguna — todas las OCs tienen línea asignada.');
} else {
  console.log(`  Total: ${ocsSinLinea.length}\n`);
  ocsSinLinea.slice(0, 20).forEach(oc => {
    const fecha = oc.fechaCreacion?.toDate ? oc.fechaCreacion.toDate().toISOString().slice(0, 16).replace('T', ' ') : '-';
    console.log(`  ${(oc.numeroOrden || oc.id).padEnd(18)} | ${(oc.estado || '-').padEnd(18)} | $${(oc.totalUSD || 0).toFixed(2)} | ${fecha} | id=${oc.id}`);
  });
  if (ocsSinLinea.length > 20) console.log(`  ... y ${ocsSinLinea.length - 20} más`);
}

// Detectar estados "raros"
const estadosConocidos = new Set([
  'borrador', 'confirmada', 'pagada', 'parcial', 'en_transito', 'recibida',
  'recibida_parcial', 'completada', 'cancelada',
  'pagada_pendiente_pagar', 'pendiente_envio', 'en_camino', 'recibido_parcial',
]);
const estadosExtranos = new Set();
ocs.forEach(oc => {
  if (oc.estado && !estadosConocidos.has(oc.estado)) estadosExtranos.add(oc.estado);
});
if (estadosExtranos.size > 0) {
  console.log('\n=== Estados NO reconocidos (podrían no mapear al pipeline) ===');
  estadosExtranos.forEach(e => console.log(`  "${e}"`));
}

console.log('\nDone.\n');
process.exit(0);
