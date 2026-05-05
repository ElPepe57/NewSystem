/**
 * Onda 1.5 · Cleanup determinista de maestros · 2026-05-04
 * READ-ONLY default · escribe solo con --apply
 *
 * 2 acciones · 100% derivables · cero invención:
 *
 * ACCIÓN 1 · Asignar línea de negocio a tipos sin línea (5 tipos)
 *   - Para patrol → SUP (derivado del producto SUP-0148)
 *   - Zinc Bisglycinate → SUP (derivado del producto SUP-0149)
 *   - Ampoule Foam, cotton soft, Cica Cooling → SKC (input usuario · sin productos asociados)
 *
 * ACCIÓN 2 · Eliminar duplicado D3+K2 + cerrar ambos gaps de códigos TP + crear contador
 *   PASO 1 · Reasignar SUP-0163 (apunta a TP-086 duplicado) → TP-024 (TP bueno)
 *            + actualizar su snapshot completo
 *   PASO 2 · Backup local de TP-086 + DELETE físico
 *   PASO 3 · Renumerar TP-098 (Double Cleansing Duo) → TP-086 + update snapshot en 1 producto
 *   PASO 4 · Renumerar TP-097 (Toning Toner) → TP-070 + update snapshots en 3 productos
 *   PASO 5 · Crear contadores/TP con current = 96 (próximo tipo: TP-097)
 *   PASO 6 · Reparar 9 snapshots vacíos del TP-024 (bug histórico aprovechado)
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { writeFileSync, mkdirSync } from 'node:fs';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');
console.log(`═══ Onda 1.5 · Cleanup maestros · ${APPLY ? 'APPLY' : 'DRY-RUN'} ═══\n`);

// ─── Constantes ──────────────────────────────────────────────────────────────
const TP_024_BUENO_ID = 'VDKh8jcU0G2OHgFaJcMx';        // queda intacto · "D3 + K2"
const TP_086_DUPLICADO_ID = 'n4lAfKgT4EnsljVnyZpp';    // borrar
const SUP_0163_ID = 'ylUOxWZ50RcAd1WtYBUm';            // reasignar a TP-024

// Asignaciones manuales para tipos sin productos asociados (input usuario)
const ASIGNACION_MANUAL_LINEA = {
  'Ampoule Foam': 'SKC',
  'cotton soft': 'SKC',
  'Cica Cooling': 'SKC',
};

// ─── Cargar líneas + productos + tipos ──────────────────────────────────────
const lineasSnap = await db.collection('lineasNegocio').get();
const lineasById = {};
const lineasPorCodigo = {};
lineasSnap.docs.forEach(d => {
  lineasById[d.id] = d.data();
  // mapear SKC/SUP a sus IDs Firestore
  const codigo = d.data().codigo;
  if (codigo) lineasPorCodigo[codigo] = d.id;
});

const productosSnap = await db.collection('productos').get();
const productos = productosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

const tiposSnap = await db.collection('tiposProducto').get();
const tiposById = {};
const tiposByCodigo = {};
tiposSnap.docs.forEach(d => {
  const data = { id: d.id, ...d.data() };
  tiposById[d.id] = data;
  if (data.codigo) tiposByCodigo[data.codigo] = data;
});

// ─── ACCIÓN 1 · Asignar línea a 5 tipos sin línea ───────────────────────────
console.log(`═══ ACCIÓN 1 · Asignar línea a tipos sin línea ═══\n`);
const accion1 = [];
for (const t of Object.values(tiposById)) {
  if ((t.lineaNegocioIds || []).length > 0) continue; // ya tiene línea

  // Buscar productos que lo usan
  const usantes = productos.filter(p => p.tipoProductoId === t.id);
  let lineaId, lineaNombre, fuente;

  if (usantes.length > 0) {
    // Derivar de producto
    const lineas = new Set(usantes.map(p => p.lineaNegocioId).filter(Boolean));
    if (lineas.size === 1) {
      lineaId = [...lineas][0];
      lineaNombre = lineasById[lineaId]?.nombre || '?';
      fuente = `derivado de ${usantes.length} producto(s)`;
    } else {
      console.log(`  ⚠ Tipo "${t.nombre}" tiene productos en múltiples líneas · skip`);
      continue;
    }
  } else if (ASIGNACION_MANUAL_LINEA[t.nombre]) {
    // Asignación manual del usuario
    const codigoLinea = ASIGNACION_MANUAL_LINEA[t.nombre];
    lineaId = lineasPorCodigo[codigoLinea];
    if (!lineaId) {
      console.log(`  ⚠ No encontré línea con código "${codigoLinea}" · skip ${t.nombre}`);
      continue;
    }
    lineaNombre = lineasById[lineaId]?.nombre || codigoLinea;
    fuente = 'input usuario · sin productos asociados';
  } else {
    console.log(`  ⏭ Tipo "${t.nombre}" sin productos y sin asignación manual · skip`);
    continue;
  }

  accion1.push({ id: t.id, nombre: t.nombre, lineaId, lineaNombre, fuente });
}

console.log(`Tipos a asignar: ${accion1.length}`);
accion1.forEach(a => console.log(`  - "${a.nombre}" → ${a.lineaNombre} (${a.fuente})`));

// ─── ACCIÓN 2 · Eliminar duplicado + renumerar gaps + contador ──────────────
console.log(`\n\n═══ ACCIÓN 2 · Eliminar duplicado + cerrar gaps + crear contador ═══\n`);

const tp024 = tiposById[TP_024_BUENO_ID];
const tp086Dup = tiposById[TP_086_DUPLICADO_ID];
const tp097 = tiposByCodigo['TP-097'];
const tp098 = tiposByCodigo['TP-098'];

if (!tp024 || !tp086Dup || !tp097 || !tp098) {
  console.error('❌ Falta algún tipo crítico · abortar');
  process.exit(1);
}

// Snapshots a usar (datos denormalizados que se copian al producto)
const snapshotTP024 = {
  id: tp024.id,
  codigo: tp024.codigo,
  nombre: tp024.nombre,
  nombreNormalizado: tp024.nombreNormalizado,
};
const snapshotTP098Renumerado = {
  id: tp098.id,
  codigo: 'TP-086',  // ← nuevo código tras renumerar
  nombre: tp098.nombre,
  nombreNormalizado: tp098.nombreNormalizado,
};
const snapshotTP097Renumerado = {
  id: tp097.id,
  codigo: 'TP-070',  // ← nuevo código tras renumerar
  nombre: tp097.nombre,
  nombreNormalizado: tp097.nombreNormalizado,
};

// Productos afectados por los renumerados
const productosTP098 = productos.filter(p => p.tipoProductoId === tp098.id);
const productosTP097 = productos.filter(p => p.tipoProductoId === tp097.id);
// Productos del TP-024 con snapshot vacío (paso 6)
const productosTP024Rotos = productos.filter(p =>
  p.tipoProductoId === tp024.id &&
  (p.tipoProducto?.codigo === undefined || p.tipoProducto?.codigo === 'undefined' || !p.tipoProducto?.codigo)
);

console.log(`PASO 1 · Reasignar SUP-0163 → TP-024 (1 update producto)`);
console.log(`PASO 2 · Backup + DELETE TP-086 duplicado`);
console.log(`PASO 3 · Renumerar TP-098 → TP-086 · 1 tipo + ${productosTP098.length} producto(s)`);
console.log(`PASO 4 · Renumerar TP-097 → TP-070 · 1 tipo + ${productosTP097.length} producto(s)`);
console.log(`PASO 5 · Crear contadores/TP.current = 96`);
console.log(`PASO 6 · Reparar ${productosTP024Rotos.length} snapshot(s) vacío(s) del TP-024`);

const totalEscrituras =
  accion1.length              // acción 1: tipos
  + 1                         // SUP-0163
  + 1                         // delete TP-086
  + 1 + productosTP098.length // TP-098 + productos
  + 1 + productosTP097.length // TP-097 + productos
  + 1                         // contador
  + productosTP024Rotos.length;
console.log(`\nTotal escrituras: ${totalEscrituras}`);

// ─── DRY-RUN: terminar acá ───────────────────────────────────────────────────
if (!APPLY) {
  console.log(`\n💡 DRY-RUN · NO se escribió nada en BD.`);
  console.log(`   Para ejecutar: node scripts/onda1.5-cleanup-maestros.mjs --apply\n`);
  process.exit(0);
}

// ─── APPLY ──────────────────────────────────────────────────────────────────
console.log(`\n🚨 APPLY · 5 segundos para abortar (Ctrl+C)...\n`);
await new Promise(r => setTimeout(r, 5000));

const ahora = FieldValue.serverTimestamp();
let written = 0;
let errors = 0;

// ─── ACCIÓN 1 ────────────────────────────────────────────────────────────────
for (const a of accion1) {
  try {
    await db.doc(`tiposProducto/${a.id}`).update({
      lineaNegocioIds: [a.lineaId],
      ultimaEdicion: ahora,
    });
    console.log(`✅ Acción 1: "${a.nombre}" → ${a.lineaNombre}`);
    written++;
  } catch (e) {
    console.error(`❌ Acción 1 "${a.nombre}": ${e.message}`);
    errors++;
  }
}

// ─── ACCIÓN 2 · PASO 1 · Reasignar SUP-0163 ─────────────────────────────────
try {
  await db.doc(`productos/${SUP_0163_ID}`).update({
    tipoProductoId: TP_024_BUENO_ID,
    tipoProducto: snapshotTP024,
    ultimaEdicion: ahora,
  });
  console.log(`✅ PASO 1: SUP-0163 reasignado a TP-024`);
  written++;
} catch (e) {
  console.error(`❌ PASO 1: ${e.message}`);
  errors++;
}

// ─── ACCIÓN 2 · PASO 2 · Backup + DELETE TP-086 ─────────────────────────────
try {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = `backups/tipoProducto-TP-086-deleted-${ts}.json`;
  mkdirSync('backups', { recursive: true });
  writeFileSync(backupPath, JSON.stringify({
    meta: {
      eliminadoEn: new Date().toISOString(),
      motivo: 'Onda 1.5 · duplicado de TP-024 · cerrar gap por Opción 2',
    },
    documento: { id: tp086Dup.id, ...tp086Dup },
  }, null, 2));
  await db.doc(`tiposProducto/${TP_086_DUPLICADO_ID}`).delete();
  console.log(`✅ PASO 2: TP-086 eliminado · backup en ${backupPath}`);
  written++;
} catch (e) {
  console.error(`❌ PASO 2: ${e.message}`);
  errors++;
}

// ─── ACCIÓN 2 · PASO 3 · Renumerar TP-098 → TP-086 ──────────────────────────
try {
  await db.doc(`tiposProducto/${tp098.id}`).update({
    codigo: 'TP-086',
    ultimaEdicion: ahora,
  });
  console.log(`✅ PASO 3: tipo "${tp098.nombre}" renumerado TP-098 → TP-086`);
  written++;
  for (const p of productosTP098) {
    await db.doc(`productos/${p.id}`).update({
      tipoProducto: snapshotTP098Renumerado,
      ultimaEdicion: ahora,
    });
    console.log(`   ✅ snapshot actualizado en ${p.sku}`);
    written++;
  }
} catch (e) {
  console.error(`❌ PASO 3: ${e.message}`);
  errors++;
}

// ─── ACCIÓN 2 · PASO 4 · Renumerar TP-097 → TP-070 ──────────────────────────
try {
  await db.doc(`tiposProducto/${tp097.id}`).update({
    codigo: 'TP-070',
    ultimaEdicion: ahora,
  });
  console.log(`✅ PASO 4: tipo "${tp097.nombre}" renumerado TP-097 → TP-070`);
  written++;
  for (const p of productosTP097) {
    await db.doc(`productos/${p.id}`).update({
      tipoProducto: snapshotTP097Renumerado,
      ultimaEdicion: ahora,
    });
    console.log(`   ✅ snapshot actualizado en ${p.sku}`);
    written++;
  }
} catch (e) {
  console.error(`❌ PASO 4: ${e.message}`);
  errors++;
}

// ─── ACCIÓN 2 · PASO 5 · Crear contadores/TP ────────────────────────────────
try {
  await db.doc('contadores/TP').set({
    current: 96,
    initializedAt: ahora,
    updatedAt: ahora,
    notas: 'Onda 1.5 · S3.4 · creado tras renumerar TP-098→TP-086 y TP-097→TP-070 · próximo TP-097',
  });
  console.log(`✅ PASO 5: contadores/TP creado · current=96 · próximo será TP-097`);
  written++;
} catch (e) {
  console.error(`❌ PASO 5: ${e.message}`);
  errors++;
}

// ─── ACCIÓN 2 · PASO 6 · Reparar snapshots vacíos del TP-024 ────────────────
console.log(`\n· PASO 6: reparando ${productosTP024Rotos.length} snapshots vacíos del TP-024`);
for (const p of productosTP024Rotos) {
  try {
    await db.doc(`productos/${p.id}`).update({
      tipoProducto: snapshotTP024,
      ultimaEdicion: ahora,
    });
    console.log(`   ✅ ${p.sku} · snapshot reparado`);
    written++;
  } catch (e) {
    console.error(`❌ ${p.sku}: ${e.message}`);
    errors++;
  }
}

console.log(`\n═══ Resultado ═══`);
console.log(`  Escritos: ${written}`);
console.log(`  Errores:  ${errors}`);
console.log(`✅ Onda 1.5 completada`);
process.exit(0);
