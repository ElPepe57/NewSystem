/**
 * Elimina SUP-0021 (Carlyle Berberina duplicada, era Solaray) y renumera
 * todos los SKUs SUP para cerrar TODOS los huecos en la secuencia.
 *
 * Pre-requisito: Sistema en 0 (sin transacciones).
 * Uso: node scripts/eliminar-y-renumerar-sup-0021.mjs [--dry-run]
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = process.argv.includes('--dry-run');
const SKU_TO_DELETE = 'SUP-0021';

async function verificarSistemaEnCero() {
  console.log('== PASO 0: Verificando que el sistema esta en 0 ==\n');

  const colecciones = ['unidades', 'ventas', 'ordenesCompra', 'cotizaciones', 'requerimientos', 'transferencias'];
  for (const col of colecciones) {
    const snap = await db.collection(col).limit(1).get();
    if (!snap.empty) {
      console.error(`ABORT: Coleccion "${col}" tiene ${snap.size}+ documentos. El sistema NO esta en 0.`);
      process.exit(1);
    }
  }
  console.log('Sistema en 0 confirmado (sin transacciones).\n');
}

async function main() {
  console.log('========================================');
  console.log(DRY_RUN ? '  MODO DRY RUN (sin cambios reales)' : '  MODO PRODUCCION');
  console.log('========================================\n');

  await verificarSistemaEnCero();

  // == PASO 1: Leer TODOS los productos SUP antes de eliminar nada ==
  console.log('== PASO 1: Leyendo todos los productos SUP ==\n');

  const snap = await db.collection('productos')
    .where('sku', '>=', 'SUP-0001')
    .where('sku', '<=', 'SUP-9999')
    .get();

  const todosLosProductos = snap.docs.map(d => ({
    ref: d.ref,
    id: d.id,
    sku: d.data().sku,
    nombre: `${d.data().marca} ${d.data().nombreComercial}`,
    numero: parseInt(d.data().sku.replace('SUP-', ''), 10),
    data: d.data(),
  })).sort((a, b) => a.numero - b.numero);

  console.log(`Total productos SUP: ${todosLosProductos.length}`);

  // Identificar el producto a eliminar
  const productoEliminar = todosLosProductos.find(p => p.sku === SKU_TO_DELETE);
  if (!productoEliminar) {
    console.error(`ABORT: No se encontro ${SKU_TO_DELETE}`);
    process.exit(1);
  }

  console.log(`Producto a eliminar: ${productoEliminar.sku} - ${productoEliminar.nombre} (${productoEliminar.id})`);

  // Productos que se quedan (sin el eliminado)
  const productosQueQuedan = todosLosProductos.filter(p => p.sku !== SKU_TO_DELETE);

  // Detectar huecos ANTES de eliminar
  const numerosExistentes = todosLosProductos.map(p => p.numero);
  const maxNumero = Math.max(...numerosExistentes);
  const huecosPreExistentes = [];
  for (let i = 1; i <= maxNumero; i++) {
    if (!numerosExistentes.includes(i)) {
      huecosPreExistentes.push(i);
    }
  }
  console.log(`Huecos pre-existentes: ${huecosPreExistentes.length > 0 ? huecosPreExistentes.map(h => 'SUP-' + h.toString().padStart(4, '0')).join(', ') : 'ninguno'}`);
  console.log(`Total huecos a cerrar: ${huecosPreExistentes.length + 1} (${huecosPreExistentes.length} pre-existentes + SUP-0021)\n`);

  // == PASO 2: Eliminar SUP-0021 ==
  console.log(`== PASO 2: Eliminando ${SKU_TO_DELETE} (${productoEliminar.id}) ==\n`);

  if (DRY_RUN) {
    console.log(`[DRY RUN] Eliminaria documento productos/${productoEliminar.id}`);
  } else {
    await db.collection('productos').doc(productoEliminar.id).delete();
    console.log(`Documento productos/${productoEliminar.id} ELIMINADO.`);
  }

  // Limpiar scanHistory del producto eliminado
  const scanSnap = await db.collection('scanHistory').where('productoId', '==', productoEliminar.id).get();
  if (!scanSnap.empty) {
    if (!DRY_RUN) {
      const batch = db.batch();
      scanSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    console.log(`${scanSnap.size} registros de scanHistory eliminados.`);
  } else {
    console.log('Sin registros en scanHistory.');
  }

  // Limpiar mlProductMap
  const mlSnap = await db.collection('mlProductMap').where('productoId', '==', productoEliminar.id).get();
  if (!mlSnap.empty) {
    if (!DRY_RUN) {
      const batch = db.batch();
      mlSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    console.log(`${mlSnap.size} registros de mlProductMap eliminados.`);
  } else {
    console.log('Sin registros en mlProductMap.');
  }

  // Actualizar metricas
  const pd = productoEliminar.data;
  if (pd.marcaId) {
    const marcaRef = db.collection('marcas').doc(pd.marcaId);
    const marcaDoc = await marcaRef.get();
    if (marcaDoc.exists) {
      const actual = (marcaDoc.data().metricas || {}).productosActivos || 0;
      if (actual > 0) {
        if (!DRY_RUN) await marcaRef.update({ 'metricas.productosActivos': FieldValue.increment(-1) });
        console.log(`Marca ${marcaDoc.data().nombre}: productosActivos ${actual} -> ${actual - 1}`);
      }
    }
  }
  if (pd.tipoProductoId) {
    const tpRef = db.collection('tiposProducto').doc(pd.tipoProductoId);
    const tpDoc = await tpRef.get();
    if (tpDoc.exists) {
      const actual = (tpDoc.data().metricas || {}).productosActivos || 0;
      if (actual > 0) {
        if (!DRY_RUN) await tpRef.update({ 'metricas.productosActivos': FieldValue.increment(-1) });
        console.log(`TipoProducto ${tpDoc.data().nombre}: productosActivos ${actual} -> ${actual - 1}`);
      }
    }
  }
  if (pd.categoriaId) {
    const catRef = db.collection('categorias').doc(pd.categoriaId);
    const catDoc = await catRef.get();
    if (catDoc.exists) {
      const actual = (catDoc.data().metricas || {}).productosActivos || 0;
      if (actual > 0) {
        if (!DRY_RUN) await catRef.update({ 'metricas.productosActivos': FieldValue.increment(-1) });
        console.log(`Categoria ${catDoc.data().nombre}: productosActivos ${actual} -> ${actual - 1}`);
      }
    }
  }
  console.log('');

  // == PASO 3: Renumerar SKUs cerrando TODOS los huecos ==
  console.log('== PASO 3: Renumerando SKUs (cerrando TODOS los huecos) ==\n');

  let renumerados = 0;
  let batch = db.batch();
  let batchCount = 0;
  const cambios = [];

  for (let i = 0; i < productosQueQuedan.length; i++) {
    const prod = productosQueQuedan[i];
    const nuevoNumero = i + 1;
    const nuevoSku = `SUP-${nuevoNumero.toString().padStart(4, '0')}`;

    if (nuevoSku !== prod.sku) {
      console.log(`  ${prod.sku} -> ${nuevoSku}  (${prod.nombre})`);
      cambios.push({ skuViejo: prod.sku, skuNuevo: nuevoSku, prodId: prod.id });

      if (!DRY_RUN) {
        batch.update(prod.ref, { sku: nuevoSku });
        batchCount++;

        if (batchCount >= 450) {
          await batch.commit();
          console.log(`  [Batch commit: ${batchCount} actualizaciones]`);
          batch = db.batch();
          batchCount = 0;
        }
      }
      renumerados++;
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
    console.log(`  [Batch commit final: ${batchCount} actualizaciones]`);
  }

  const totalFinal = productosQueQuedan.length;
  console.log(`\nTotal renumerados: ${renumerados}`);
  console.log(`Secuencia final: SUP-0001 a SUP-${totalFinal.toString().padStart(4, '0')} (sin huecos)\n`);

  // Actualizar scanHistory con nuevos SKUs
  console.log('Actualizando scanHistory con nuevos SKUs...');
  let scanUpdated = 0;
  for (const cambio of cambios) {
    const sSn = await db.collection('scanHistory')
      .where('productoSKU', '==', cambio.skuViejo)
      .get();
    if (!sSn.empty) {
      if (!DRY_RUN) {
        const sBatch = db.batch();
        sSn.docs.forEach(d => sBatch.update(d.ref, { productoSKU: cambio.skuNuevo }));
        await sBatch.commit();
      }
      console.log(`  scanHistory: ${cambio.skuViejo} -> ${cambio.skuNuevo} (${sSn.size} registros)`);
      scanUpdated += sSn.size;
    }
  }
  if (scanUpdated === 0) console.log('  Sin registros en scanHistory para actualizar.');

  // == PASO 4: Ajustar contador ==
  console.log('\n== PASO 4: Ajustando contador SUP ==\n');

  const counterRef = db.collection('contadores').doc('SUP');
  const counterDoc = await counterRef.get();
  if (counterDoc.exists) {
    const current = counterDoc.data().current || 0;
    console.log(`Contador actual: ${current} -> Nuevo: ${totalFinal}`);
    if (!DRY_RUN) {
      await counterRef.update({ current: totalFinal, updatedAt: new Date() });
      console.log('Contador actualizado.');
    }
  } else {
    console.log('WARN: Contador SUP no existe.');
  }

  // == RESUMEN ==
  console.log('\n========================================');
  console.log('  COMPLETADO');
  console.log(`  - ${SKU_TO_DELETE} eliminado (${productoEliminar.nombre})`);
  console.log(`  - ${huecosPreExistentes.length + 1} hueco(s) cerrado(s)`);
  console.log(`  - ${renumerados} SKUs renumerados`);
  console.log(`  - Secuencia final: SUP-0001 a SUP-${totalFinal.toString().padStart(4, '0')}`);
  console.log(`  - Contador SUP = ${totalFinal}`);
  console.log('========================================\n');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
