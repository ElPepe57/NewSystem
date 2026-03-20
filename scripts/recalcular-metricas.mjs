/**
 * Recalcula métricas de clientes y marcas desde ventas reales.
 * - Usa clienteId cuando existe, fallback a nombreCliente
 * - Busca marcaId desde la colección productos (no desde venta.productos)
 *
 * Uso: node scripts/recalcular-metricas.mjs
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

async function recalcular() {
  console.log('🔄 Iniciando recálculo de métricas...\n');

  // 1. Leer clientes y construir índice por nombre
  const clientesSnap = await db.collection('clientes').get();
  const clientesPorNombre = {};
  for (const doc of clientesSnap.docs) {
    const nombre = doc.data().nombre?.trim().toLowerCase();
    if (nombre) clientesPorNombre[nombre] = doc.id;
  }
  console.log(`👤 Clientes cargados: ${clientesSnap.size}`);

  // 2. Leer productos y construir índice productoId → marcaId
  const productosSnap = await db.collection('productos').get();
  const productoMarca = {};
  const productosActivosPorMarca = {};
  for (const doc of productosSnap.docs) {
    const p = doc.data();
    if (p.marcaId) {
      productoMarca[doc.id] = p.marcaId;
    }
    if (p.marcaId && p.estado === 'activo') {
      productosActivosPorMarca[p.marcaId] = (productosActivosPorMarca[p.marcaId] || 0) + 1;
    }
  }
  console.log(`📦 Productos cargados: ${productosSnap.size} (${Object.keys(productoMarca).length} con marcaId)`);

  // 3. Leer ventas válidas
  const ventasSnap = await db.collection('ventas').get();
  const ventas = ventasSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(v => v.estado !== 'anulada' && v.estado !== 'cancelada');
  console.log(`🛒 Ventas válidas: ${ventas.length} (de ${ventasSnap.size} total)`);

  // 4. Agregar métricas por clienteId (con fallback por nombre)
  const clienteMetricas = {};
  let matchedByName = 0;
  let noMatch = 0;

  for (const venta of ventas) {
    let cid = venta.clienteId;

    // Fallback: buscar por nombre si no tiene clienteId
    if (!cid && venta.nombreCliente) {
      const nombreKey = venta.nombreCliente.trim().toLowerCase();
      cid = clientesPorNombre[nombreKey];
      if (cid) matchedByName++;
      else noMatch++;
    }

    if (!cid) continue;

    if (!clienteMetricas[cid]) {
      clienteMetricas[cid] = { totalCompras: 0, montoTotalPEN: 0, ultimaCompra: null };
    }
    clienteMetricas[cid].totalCompras += 1;
    clienteMetricas[cid].montoTotalPEN += (venta.totalPEN || 0);

    const fechaVenta = venta.fechaVenta || venta.fechaCreacion;
    if (fechaVenta) {
      const ts = fechaVenta.toMillis ? fechaVenta.toMillis() : 0;
      const prevTs = clienteMetricas[cid].ultimaCompra?.toMillis?.() || 0;
      if (ts > prevTs) {
        clienteMetricas[cid].ultimaCompra = fechaVenta;
      }
    }
  }
  console.log(`👤 Clientes con ventas: ${Object.keys(clienteMetricas).length} (${matchedByName} matched by name, ${noMatch} sin match)`);

  // 5. Agregar métricas por marca (busca marcaId desde productos collection)
  const marcaVentas = {};
  let marcaMatchCount = 0;

  for (const venta of ventas) {
    if (!venta.productos) continue;
    for (const prod of venta.productos) {
      // Buscar marcaId desde la colección productos
      const mid = prod.marcaId || productoMarca[prod.productoId];
      if (!mid) continue;

      marcaMatchCount++;
      if (!marcaVentas[mid]) {
        marcaVentas[mid] = { unidadesVendidas: 0, ventasTotalPEN: 0, ultimaVenta: null };
      }
      marcaVentas[mid].unidadesVendidas += (prod.cantidad || 1);
      marcaVentas[mid].ventasTotalPEN += (prod.subtotal || 0);

      const fechaVenta = venta.fechaVenta || venta.fechaCreacion;
      if (fechaVenta) {
        const ts = fechaVenta.toMillis ? fechaVenta.toMillis() : 0;
        const prevTs = marcaVentas[mid].ultimaVenta?.toMillis?.() || 0;
        if (ts > prevTs) {
          marcaVentas[mid].ultimaVenta = fechaVenta;
        }
      }
    }
  }
  console.log(`🏷️  Marcas con ventas: ${Object.keys(marcaVentas).length} (${marcaMatchCount} productos matched)`);

  // 6. Actualizar clientes
  let clientesActualizados = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of clientesSnap.docs) {
    const metricas = clienteMetricas[doc.id] || {
      totalCompras: 0, montoTotalPEN: 0, ultimaCompra: null
    };
    const ticketPromedio = metricas.totalCompras > 0
      ? metricas.montoTotalPEN / metricas.totalCompras : 0;

    const updateData = {
      'metricas.totalCompras': metricas.totalCompras,
      'metricas.montoTotalPEN': Math.round(metricas.montoTotalPEN * 100) / 100,
      'metricas.ticketPromedio': Math.round(ticketPromedio * 100) / 100,
    };
    if (metricas.ultimaCompra) {
      updateData['metricas.ultimaCompra'] = metricas.ultimaCompra;
    }

    batch.update(doc.ref, updateData);
    batchCount++;
    clientesActualizados++;

    if (batchCount >= 450) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) await batch.commit();

  // 7. Actualizar marcas
  const marcasSnap = await db.collection('marcas').get();
  let marcasActualizadas = 0;
  batch = db.batch();
  batchCount = 0;

  for (const doc of marcasSnap.docs) {
    const mv = marcaVentas[doc.id] || {
      unidadesVendidas: 0, ventasTotalPEN: 0, ultimaVenta: null
    };
    const productosActivos = productosActivosPorMarca[doc.id] || 0;

    const updateData = {
      'metricas.productosActivos': productosActivos,
      'metricas.unidadesVendidas': mv.unidadesVendidas,
      'metricas.ventasTotalPEN': Math.round(mv.ventasTotalPEN * 100) / 100,
      'metricas.margenPromedio': 0,
    };
    if (mv.ultimaVenta) {
      updateData['metricas.ultimaVenta'] = mv.ultimaVenta;
    }

    batch.update(doc.ref, updateData);
    batchCount++;
    marcasActualizadas++;

    if (batchCount >= 450) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) await batch.commit();

  // 8. También vincular clienteId a ventas que no lo tienen (fix data)
  let ventasVinculadas = 0;
  batch = db.batch();
  batchCount = 0;

  for (const venta of ventas) {
    if (venta.clienteId) continue;
    if (!venta.nombreCliente) continue;
    const nombreKey = venta.nombreCliente.trim().toLowerCase();
    const cid = clientesPorNombre[nombreKey];
    if (!cid) continue;

    batch.update(db.collection('ventas').doc(venta.id), { clienteId: cid });
    batchCount++;
    ventasVinculadas++;

    if (batchCount >= 450) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) await batch.commit();

  console.log(`\n✅ Recálculo completado:`);
  console.log(`   - Ventas procesadas: ${ventas.length}`);
  console.log(`   - Clientes actualizados: ${clientesActualizados}`);
  console.log(`   - Marcas actualizadas: ${marcasActualizadas}`);
  console.log(`   - Ventas vinculadas a clienteId: ${ventasVinculadas}`);

  // Top clientes
  const topClientes = Object.entries(clienteMetricas)
    .sort((a, b) => b[1].montoTotalPEN - a[1].montoTotalPEN)
    .slice(0, 5);
  if (topClientes.length > 0) {
    console.log(`\n📈 Top 5 clientes:`);
    for (const [cid, m] of topClientes) {
      const cdoc = await db.collection('clientes').doc(cid).get();
      const nombre = cdoc.data()?.nombre || cid;
      console.log(`   ${nombre}: S/ ${m.montoTotalPEN.toFixed(2)} (${m.totalCompras} compras)`);
    }
  }

  // Top marcas
  const topMarcas = Object.entries(marcaVentas)
    .sort((a, b) => b[1].ventasTotalPEN - a[1].ventasTotalPEN)
    .slice(0, 5);
  if (topMarcas.length > 0) {
    console.log(`\n📈 Top 5 marcas:`);
    for (const [mid, m] of topMarcas) {
      const mdoc = await db.collection('marcas').doc(mid).get();
      const nombre = mdoc.data()?.nombre || mid;
      console.log(`   ${nombre}: S/ ${m.ventasTotalPEN.toFixed(2)} (${m.unidadesVendidas} unidades)`);
    }
  }
}

recalcular().then(() => process.exit(0)).catch(e => { console.error('❌', e); process.exit(1); });
