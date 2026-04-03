/**
 * Script de migración: Subir competidores del backup a Firestore
 * Lee backup/firestore-2026-03-18/productos.json y extrae competidores únicos
 * Los crea en la colección 'competidores' con la estructura del servicio
 *
 * Uso: node scripts/migrar-competidores-backup.mjs [--dry-run]
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

// --- Init Firebase Admin (usa GOOGLE_APPLICATION_CREDENTIALS o gcloud auth) ---
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

// --- Normalizar texto (replica de textUtils.ts) ---
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// --- Leer backup y extraer competidores únicos ---
function extraerCompetidoresDelBackup() {
  const backupPath = resolve(__dirname, '../backup/firestore-2026-03-18/productos.json');
  const raw = readFileSync(backupPath, 'utf-8');
  const productos = JSON.parse(raw);

  const competidores = new Map();

  productos.forEach(p => {
    const inv = p.investigacion;
    if (inv && inv.competidoresPeru && Array.isArray(inv.competidoresPeru)) {
      inv.competidoresPeru.forEach(c => {
        if (c.nombre && !competidores.has(c.nombre.trim())) {
          competidores.set(c.nombre.trim(), {
            nombre: c.nombre.trim(),
            plataforma: c.plataforma || 'otra',
            competidorIdLegacy: c.competidorId || null,
          });
        }
      });
    }
  });

  // Unificar duplicados con nombres casi iguales
  // "On Shop" y "OnShop" son el mismo competidor
  if (competidores.has('On Shop') && competidores.has('OnShop')) {
    competidores.delete('On Shop');
    console.log('   🔗 Unificado: "On Shop" → "OnShop"');
  }

  return [...competidores.values()];
}

// --- Obtener competidores existentes en Firestore ---
async function getCompetidoresExistentes() {
  const snapshot = await db.collection('competidores').get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
}

// --- Obtener siguiente número de secuencia ---
async function getNextCMPCode(startFrom) {
  // Leer el contador actual de la colección counters
  const counterRef = db.collection('counters').doc('CMP');
  const counterDoc = await counterRef.get();

  let currentNumber = startFrom || 1;
  if (counterDoc.exists) {
    currentNumber = (counterDoc.data().current || 0) + 1;
  }

  return currentNumber;
}

// --- Main ---
async function main() {
  console.log('=== Migración de Competidores desde Backup ===\n');
  if (DRY_RUN) console.log('🔍 MODO DRY-RUN: no se escribirá nada en Firestore\n');

  // 1. Extraer del backup
  const competidoresBackup = extraerCompetidoresDelBackup();
  console.log(`📦 Competidores en backup: ${competidoresBackup.length}`);

  // 2. Obtener existentes en Firestore
  const existentes = await getCompetidoresExistentes();
  console.log(`🔥 Competidores ya en Firestore: ${existentes.length}`);

  // 3. Crear mapa de nombres normalizados existentes
  const nombresExistentes = new Set(
    existentes.map(c => normalizarTexto(c.nombre))
  );

  // 4. Filtrar los que faltan
  const nuevos = competidoresBackup.filter(
    c => !nombresExistentes.has(normalizarTexto(c.nombre))
  );

  const duplicados = competidoresBackup.filter(
    c => nombresExistentes.has(normalizarTexto(c.nombre))
  );

  console.log(`✅ Nuevos a crear: ${nuevos.length}`);
  console.log(`⏭️  Ya existentes (se omiten): ${duplicados.length}`);

  if (duplicados.length > 0) {
    console.log('\n   Duplicados omitidos:');
    duplicados.forEach(c => console.log(`   - ${c.nombre}`));
  }

  if (nuevos.length === 0) {
    console.log('\n✨ No hay competidores nuevos que migrar. Todo al día.');
    process.exit(0);
  }

  // 5. Obtener el siguiente número de secuencia
  let nextNumber = await getNextCMPCode();
  console.log(`\n🔢 Secuencia CMP inicia en: ${nextNumber}`);

  // 6. Crear en batch
  console.log(`\n📝 Creando ${nuevos.length} competidores...\n`);

  const BATCH_LIMIT = 450;
  let created = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const comp of nuevos) {
    const codigo = `CMP-${String(nextNumber).padStart(3, '0')}`;

    const docData = {
      codigo,
      nombre: comp.nombre,
      nombreNormalizado: normalizarTexto(comp.nombre),
      plataformaPrincipal: comp.plataforma,
      plataformas: [comp.plataforma],
      plataformasData: [{
        nombre: comp.plataforma,
        url: '',
        esPrincipal: true,
      }],
      reputacion: 'desconocida',
      nivelAmenaza: 'medio',
      estado: 'activo',
      creadoPor: 'migracion-backup-2026-03-18',
      fechaCreacion: FieldValue.serverTimestamp(),
      metricas: {
        productosAnalizados: 0,
        precioPromedio: 0,
      },
    };

    if (!DRY_RUN) {
      const docRef = db.collection('competidores').doc();
      batch.set(docRef, docData);
      batchCount++;

      if (batchCount >= BATCH_LIMIT) {
        await batch.commit();
        console.log(`   Batch commiteado: ${batchCount} docs`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    console.log(`   ${codigo} → ${comp.nombre} (${comp.plataforma})`);
    nextNumber++;
    created++;
  }

  // Commit remaining
  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
    console.log(`   Batch final commiteado: ${batchCount} docs`);
  }

  // 7. Actualizar contador de secuencia
  if (!DRY_RUN) {
    await db.collection('counters').doc('CMP').set({
      current: nextNumber - 1,
      prefix: 'CMP',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`\n🔢 Contador CMP actualizado a: ${nextNumber - 1}`);
  }

  console.log(`\n✅ Migración completada: ${created} competidores creados`);
}

main().catch(err => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
});
