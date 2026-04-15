/**
 * Resincroniza contadores TRANSACCIONALES con los datos reales en Firestore.
 *
 * Cada contador queda apuntando al MAX(número) de los docs existentes.
 * Si no hay docs, el contador queda en 0.
 *
 * NO toca contadores de maestros (SUP, SKC, MRC, CAT, TIP, TPR, COL, CAS, ALM,
 * PRV, CC, CMP, ETQ, LIN, TP, TC, CV, CLI, KIT, INS, BMN).
 *
 * Uso:
 *   node scripts/resync-counters.mjs            # Aplica cambios
 *   node scripts/resync-counters.mjs --dry-run  # Solo muestra el plan
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const dryRun = process.argv.includes('--dry-run');

// Mapeo contador → colección + campo con el número en string
// field: campo en el doc que contiene el string tipo "OC-2026-018"
const TRANSACTIONAL_COUNTERS = [
  { counter: /^OC-\d{4}$/,    collection: 'ordenesCompra',       field: 'numeroOrden' },
  { counter: /^VT-\d{4}$/,    collection: 'ventas',              field: 'numeroVenta' },
  { counter: /^ENV-\d{4}$/,   collection: 'envios',              field: 'numeroEnvio' },
  { counter: /^COT-\d{4}$/,   collection: 'cotizaciones',        field: 'numeroCotizacion' },
  { counter: /^REQ-\d{4}$/,   collection: 'requerimientos',      field: 'numeroRequerimiento' },
  { counter: /^ENT-\d{4}$/,   collection: 'entregas',            field: 'numeroEntrega' },
  { counter: /^DEV-\d{4}$/,   collection: 'devoluciones',        field: 'numeroDevolucion' },
  { counter: /^ADL-\d{4}$/,   collection: 'adelantosNomina',     field: 'numero' },
  { counter: /^LOTE-\d{4}$/,  collection: 'lotePagos',           field: 'numero' },
  { counter: /^MOV-\d{4}$/,   collection: 'movimientosTesoreria',field: 'numero' },
  { counter: /^CONV-\d{4}$/,  collection: 'conversionesCambiarias', field: 'numero' },
  { counter: /^GAS$/,         collection: 'gastos',              field: 'codigo' },
  { counter: /^BOL-\d{4}-\d{2}$/, collection: 'boletas',         field: 'numero' },
  { counter: /^TRN-\d{4}$/,   collection: 'transferencias',      field: 'numero' },
];

const MASTER_COUNTERS = new Set([
  'SUP', 'SKC', 'CAT', 'TIP', 'TPR', 'MRC', 'COL', 'CAS', 'ALM',
  'PRV', 'CC', 'CMP', 'ETQ', 'LIN', 'TP', 'TC', 'CV', 'CLI',
  'KIT', 'INS', 'BMN',
]);

function extractNumericSuffix(str) {
  if (!str) return 0;
  const parts = String(str).split('-');
  const last = parts[parts.length - 1];
  const n = parseInt(last, 10);
  return isNaN(n) ? 0 : n;
}

console.log(`\n=== RESYNC DE CONTADORES TRANSACCIONALES ===`);
console.log(`Modo: ${dryRun ? '🔍 DRY RUN' : '✍️  APLICAR CAMBIOS'}\n`);

const snap = await db.collection('contadores').get();
const changes = [];
const skipped = [];

for (const doc of snap.docs) {
  const counterId = doc.id;
  const current = doc.data().current || 0;

  if (MASTER_COUNTERS.has(counterId)) {
    skipped.push({ id: counterId, current, reason: 'maestro' });
    continue;
  }

  // Matchear contra los contadores transaccionales conocidos
  const mapping = TRANSACTIONAL_COUNTERS.find(m => m.counter.test(counterId));
  if (!mapping) {
    skipped.push({ id: counterId, current, reason: 'no mapeado (revisar)' });
    continue;
  }

  // Leer la colección y calcular el max
  const colSnap = await db.collection(mapping.collection).get();
  let maxNum = 0;
  let matched = 0;
  colSnap.forEach(d => {
    const val = d.data()[mapping.field];
    if (!val) return;
    // Para contadores con prefijo año (OC-2026), filtrar por prefijo
    if (counterId.includes('-') && !String(val).startsWith(counterId + '-')) return;
    const n = extractNumericSuffix(val);
    if (n > maxNum) maxNum = n;
    matched++;
  });

  if (maxNum !== current) {
    changes.push({ id: counterId, from: current, to: maxNum, collection: mapping.collection, matched });
  } else {
    skipped.push({ id: counterId, current, reason: `ok (max=${maxNum} en ${matched} docs)` });
  }
}

console.log('📋 Contadores a ajustar:');
if (changes.length === 0) {
  console.log('   (ninguno — ya están sincronizados)\n');
} else {
  changes.forEach(c => {
    console.log(`   ${c.id.padEnd(20)} ${String(c.from).padStart(4)} → ${String(c.to).padStart(4)}   (col: ${c.collection}, ${c.matched} docs)`);
  });
  console.log('');
}

console.log('📋 Contadores intactos:');
skipped.forEach(s => {
  console.log(`   ${s.id.padEnd(20)} current=${String(s.current).padStart(4)}   [${s.reason}]`);
});

if (!dryRun && changes.length > 0) {
  console.log('\n✍️  Aplicando cambios...');
  const batch = db.batch();
  for (const c of changes) {
    const ref = db.collection('contadores').doc(c.id);
    batch.set(ref, { current: c.to, updatedAt: new Date() }, { merge: true });
  }
  await batch.commit();
  console.log(`✅ ${changes.length} contadores resincronizados.`);
} else if (dryRun && changes.length > 0) {
  console.log('\n🔍 DRY RUN — no se aplicó nada. Ejecuta sin --dry-run para aplicar.');
}

console.log('');
process.exit(0);
