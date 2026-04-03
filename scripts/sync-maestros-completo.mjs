/**
 * Sincronización completa: productos ↔ Gestión de Maestros
 *
 * Corrige TODOS los datos desnormalizados en productos para que coincidan
 * con la fuente de verdad (colecciones maestras).
 *
 * Fixes:
 * 1. Marca: sincronizar nombre embebido con maestro (37 desincronizados)
 * 2. Marca: vincular productos sin marcaId al maestro por nombre (19 sin vincular)
 * 3. TipoProducto: corregir [object Object] al nombre real del maestro (137)
 * 4. Proveedores investigación: vincular sin proveedorId al maestro por nombre (23)
 *
 * Uso: node scripts/sync-maestros-completo.mjs [--dry-run]
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

function normalizar(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

async function main() {
  console.log('=== SINCRONIZACIÓN COMPLETA: PRODUCTOS ↔ MAESTROS ===\n');
  if (DRY_RUN) console.log('🔍 MODO DRY-RUN\n');

  // Cargar todos los maestros
  const [prodSnap, marcasSnap, tiposSnap, provSnap] = await Promise.all([
    db.collection('productos').get(),
    db.collection('marcas').get(),
    db.collection('tiposProducto').get(),
    db.collection('proveedores').get(),
  ]);

  // Mapas por ID
  const marcaById = new Map(marcasSnap.docs.map(d => [d.id, d.data()]));
  const tipoById = new Map(tiposSnap.docs.map(d => [d.id, d.data()]));
  const provById = new Map(provSnap.docs.map(d => [d.id, d.data()]));

  // Mapas por nombre normalizado → { id, nombre }
  const marcaByNombre = new Map();
  marcasSnap.docs.forEach(d => {
    const data = d.data();
    marcaByNombre.set(normalizar(data.nombre), { id: d.id, nombre: data.nombre });
  });

  const provByNombre = new Map();
  provSnap.docs.forEach(d => {
    const data = d.data();
    const nombre = data.nombre || data.nombreEmpresa || data.razonSocial;
    if (nombre) provByNombre.set(normalizar(nombre), { id: d.id, nombre });
  });

  // Contadores
  const stats = {
    marcaNombreSynced: 0,
    marcaIdVinculado: 0,
    marcaIdCorregido: 0,
    tipoProductoFixed: 0,
    provInvVinculado: 0,
    provInvNombreSynced: 0,
    totalProductosUpdated: 0,
  };

  const BATCH_LIMIT = 450;
  let batch = db.batch();
  let batchCount = 0;
  const updatedProducts = new Set();

  async function flushBatch() {
    if (batchCount > 0) {
      if (!DRY_RUN) await batch.commit();
      console.log(`   Batch commiteado: ${batchCount} ops`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  async function addUpdate(docRef, updates, docId) {
    updatedProducts.add(docId);
    if (!DRY_RUN) {
      batch.update(docRef, updates);
      batchCount++;
      if (batchCount >= BATCH_LIMIT) await flushBatch();
    }
  }

  console.log('--- FIX 1: MARCAS (nombre + vinculación) ---');
  for (const docSnap of prodSnap.docs) {
    const p = docSnap.data();
    const sku = p.sku || docSnap.id;
    const ref = db.collection('productos').doc(docSnap.id);
    const updates = {};

    // FIX 1A: Tiene marcaId → sincronizar nombre embebido con maestro
    if (p.marcaId) {
      const maestro = marcaById.get(p.marcaId);
      if (maestro && maestro.nombre !== p.marca) {
        updates.marca = maestro.nombre;
        stats.marcaNombreSynced++;
        console.log(`  ✏️  ${sku}: "${p.marca}" → "${maestro.nombre}"`);
      }
    }

    // FIX 1B: No tiene marcaId pero sí nombre → vincular al maestro
    if (!p.marcaId && p.marca) {
      const match = marcaByNombre.get(normalizar(p.marca));
      if (match) {
        updates.marcaId = match.id;
        if (match.nombre !== p.marca) updates.marca = match.nombre;
        stats.marcaIdVinculado++;
        console.log(`  🔗 ${sku}: "${p.marca}" → vinculado a ${match.id} (${match.nombre})`);
      } else {
        console.log(`  ⚠️  ${sku}: "${p.marca}" NO existe en maestro (crear manualmente)`);
      }
    }

    if (Object.keys(updates).length > 0) await addUpdate(ref, updates, docSnap.id);
  }

  console.log(`\n  Nombres sincronizados: ${stats.marcaNombreSynced}`);
  console.log(`  Nuevos vínculos marcaId: ${stats.marcaIdVinculado}`);

  console.log('\n--- FIX 2: TIPO PRODUCTO ([object Object] → nombre real) ---');
  for (const docSnap of prodSnap.docs) {
    const p = docSnap.data();
    const sku = p.sku || docSnap.id;

    if (p.tipoProductoId) {
      const maestro = tipoById.get(p.tipoProductoId);
      if (maestro) {
        const nombreActual = typeof p.tipoProducto === 'string' ? p.tipoProducto : String(p.tipoProducto);
        if (nombreActual !== maestro.nombre) {
          const ref = db.collection('productos').doc(docSnap.id);
          await addUpdate(ref, { tipoProducto: maestro.nombre }, docSnap.id);
          stats.tipoProductoFixed++;
          if (stats.tipoProductoFixed <= 5) {
            console.log(`  ✏️  ${sku}: "${nombreActual.substring(0, 30)}" → "${maestro.nombre}"`);
          }
        }
      }
    }
  }
  if (stats.tipoProductoFixed > 5) console.log(`  ... y ${stats.tipoProductoFixed - 5} más`);
  console.log(`\n  Tipos corregidos: ${stats.tipoProductoFixed}`);

  console.log('\n--- FIX 3: PROVEEDORES EN INVESTIGACIÓN (vincular + sincronizar nombre) ---');
  for (const docSnap of prodSnap.docs) {
    const p = docSnap.data();
    const sku = p.sku || docSnap.id;
    const inv = p.investigacion;
    if (!inv || !inv.proveedoresUSA || inv.proveedoresUSA.length === 0) continue;

    let changed = false;
    const updatedProvs = inv.proveedoresUSA.map(prov => {
      // FIX 3A: Tiene proveedorId → sincronizar nombre
      if (prov.proveedorId && prov.nombre) {
        const maestro = provById.get(prov.proveedorId);
        const nombreMaestro = maestro ? (maestro.nombre || maestro.nombreEmpresa || maestro.razonSocial) : null;
        if (nombreMaestro && nombreMaestro !== prov.nombre) {
          changed = true;
          stats.provInvNombreSynced++;
          console.log(`  ✏️  ${sku}: proveedor "${prov.nombre}" → "${nombreMaestro}"`);
          return { ...prov, nombre: nombreMaestro };
        }
      }

      // FIX 3B: No tiene proveedorId → vincular por nombre
      if (!prov.proveedorId && prov.nombre) {
        const match = provByNombre.get(normalizar(prov.nombre));
        if (match) {
          changed = true;
          stats.provInvVinculado++;
          console.log(`  🔗 ${sku}: proveedor "${prov.nombre}" → vinculado a ${match.id}`);
          return { ...prov, proveedorId: match.id, nombre: match.nombre };
        }
      }

      return prov;
    });

    if (changed) {
      const ref = db.collection('productos').doc(docSnap.id);
      await addUpdate(ref, { 'investigacion.proveedoresUSA': updatedProvs }, docSnap.id);
    }
  }

  console.log(`\n  Nombres proveedor sincronizados: ${stats.provInvNombreSynced}`);
  console.log(`  Nuevos vínculos proveedorId: ${stats.provInvVinculado}`);

  // Flush remaining
  await flushBatch();

  stats.totalProductosUpdated = updatedProducts.size;

  console.log('\n=== RESUMEN ===');
  console.log(`  Productos actualizados: ${stats.totalProductosUpdated}`);
  console.log(`  Marcas - nombres sincronizados: ${stats.marcaNombreSynced}`);
  console.log(`  Marcas - nuevos vínculos: ${stats.marcaIdVinculado}`);
  console.log(`  TipoProducto - corregidos: ${stats.tipoProductoFixed}`);
  console.log(`  Proveedores inv. - nombres sincronizados: ${stats.provInvNombreSynced}`);
  console.log(`  Proveedores inv. - nuevos vínculos: ${stats.provInvVinculado}`);

  if (DRY_RUN) console.log('\n🔍 DRY-RUN completado. Ejecuta sin --dry-run para aplicar.');
  else console.log('\n✅ Sincronización completada.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
