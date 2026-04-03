/**
 * Auditoría de integridad de datos — todas las colecciones
 * Verifica que las FK entre colecciones apunten a documentos existentes
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

async function main() {
  const [ventasSnap, clientesSnap, ocSnap, provSnap, unidadesSnap, prodSnap,
         marcasSnap, catsSnap, tiposSnap, lineasSnap, etiqSnap, almSnap,
         movSnap, cuentasSnap, entregasSnap, reqSnap, cotSnap, poolSnap] = await Promise.all([
    db.collection('ventas').get(),
    db.collection('clientes').get(),
    db.collection('ordenesCompra').get(),
    db.collection('proveedores').get(),
    db.collection('unidades').get(),
    db.collection('productos').get(),
    db.collection('marcas').get(),
    db.collection('categorias').get(),
    db.collection('tiposProducto').get(),
    db.collection('lineasNegocio').get(),
    db.collection('etiquetas').get(),
    db.collection('almacenes').get(),
    db.collection('movimientosTesoreria').get(),
    db.collection('cuentasCaja').get(),
    db.collection('entregas').get(),
    db.collection('requerimientos').get(),
    db.collection('cotizaciones').get(),
    db.collection('poolUSD').get(),
  ]);

  const idSet = (snap) => new Set(snap.docs.map(d => d.id));
  const clienteIds = idSet(clientesSnap);
  const provIds = idSet(provSnap);
  const prodIds = idSet(prodSnap);
  const marcaIds = idSet(marcasSnap);
  const catIds = idSet(catsSnap);
  const tipoIds = idSet(tiposSnap);
  const lineaIds = idSet(lineasSnap);
  const etiqIds = idSet(etiqSnap);
  const almIds = idSet(almSnap);
  const cuentaIdSet = idSet(cuentasSnap);
  const ventaIds = idSet(ventasSnap);
  const reqIds = idSet(reqSnap);
  const unidadIds = idSet(unidadesSnap);
  const ocIds = idSet(ocSnap);

  const results = [];

  function audit(name, snap, getRefsFn) {
    let rotos = 0, total = 0;
    const ejemplos = [];
    snap.docs.forEach(d => {
      const refs = getRefsFn(d.data(), d.id);
      refs.forEach(({ ref, targetSet, label }) => {
        if (ref) {
          total++;
          if (!targetSet.has(ref)) {
            rotos++;
            if (ejemplos.length < 3) ejemplos.push(label ? `${label}:${ref}` : ref);
          }
        }
      });
    });
    results.push({ check: name, total, rotos, ejemplos });
  }

  // 1. Ventas → Clientes
  audit('1. Ventas→Clientes', ventasSnap, (d) => [
    { ref: d.clienteId, targetSet: clienteIds }
  ]);

  // 2. OC → Proveedores
  audit('2. OC→Proveedores', ocSnap, (d) => [
    { ref: d.proveedorId, targetSet: provIds }
  ]);

  // 3. Unidades → Productos
  audit('3. Unidades→Productos', unidadesSnap, (d) => [
    { ref: d.productoId, targetSet: prodIds }
  ]);

  // 4. Productos → Marcas
  audit('4. Productos→Marcas', prodSnap, (d) => [
    { ref: d.marcaId, targetSet: marcaIds }
  ]);

  // 5. Productos → Categorías
  audit('5. Productos→Categorías', prodSnap, (d) => [
    { ref: d.categoriaPrincipalId, targetSet: catIds, label: 'principal' },
    ...(d.categoriaIds || []).map(cid => ({ ref: cid, targetSet: catIds, label: 'array' }))
  ]);

  // 6. Productos → TiposProducto
  audit('6. Productos→TiposProducto', prodSnap, (d) => [
    { ref: d.tipoProductoId, targetSet: tipoIds }
  ]);

  // 7. Productos → LíneasNegocio
  audit('7. Productos→LíneasNegocio', prodSnap, (d) => [
    { ref: d.lineaNegocioId, targetSet: lineaIds }
  ]);

  // 8. Productos → Etiquetas
  audit('8. Productos→Etiquetas', prodSnap, (d) =>
    (d.etiquetaIds || []).map(eid => ({ ref: eid, targetSet: etiqIds }))
  );

  // 9. Unidades → Almacenes
  audit('9. Unidades→Almacenes', unidadesSnap, (d) => [
    { ref: d.almacenActual, targetSet: almIds }
  ]);

  // 10. Movimientos → CuentasCaja
  audit('10. Movimientos→CuentasCaja', movSnap, (d) => [
    { ref: d.cuentaId, targetSet: cuentaIdSet }
  ]);

  // 11. Entregas → Ventas
  audit('11. Entregas→Ventas', entregasSnap, (d) => [
    { ref: d.ventaId, targetSet: ventaIds }
  ]);

  // 12. OC → Requerimientos
  audit('12. OC→Requerimientos', ocSnap, (d) => [
    { ref: d.requerimientoId, targetSet: reqIds }
  ]);

  // 13. Cotizaciones → Requerimientos
  audit('13. Cotizaciones→Requerimientos', cotSnap, (d) => [
    { ref: d.requerimientoId, targetSet: reqIds }
  ]);

  // 14. Ventas.items → Unidades
  audit('14. Ventas.items→Unidades', ventasSnap, (d) =>
    (d.items || []).map(item => ({ ref: item.unidadId, targetSet: unidadIds }))
  );

  // 15. PoolUSD → OC
  audit('15. PoolUSD→OC', poolSnap, (d) => [
    { ref: d.ordenCompraId, targetSet: ocIds, label: 'oc' }
  ]);

  // 16. Transferencias → Almacenes
  const transfSnap = await db.collection('transferencias').get();
  audit('16. Transferencias→Almacenes', transfSnap, (d) => [
    { ref: d.almacenOrigen || d.almacenOrigenId, targetSet: almIds, label: 'origen' },
    { ref: d.almacenDestino || d.almacenDestinoId, targetSet: almIds, label: 'destino' }
  ]);

  // 17. Ventas → Productos (items)
  audit('17. Ventas.items→Productos', ventasSnap, (d) =>
    (d.items || []).map(item => ({ ref: item.productoId, targetSet: prodIds }))
  );

  // Print
  console.log('=== AUDITORIA DE INTEGRIDAD DE DATOS ===\n');
  results.forEach(r => {
    const status = r.rotos === 0 ? 'OK' : 'ROTO';
    const line = `${r.check}: ${r.total} refs, ${r.rotos} rotas [${status}]`;
    console.log(line + (r.ejemplos.length > 0 ? ` ej: ${r.ejemplos.join(', ')}` : ''));
  });

  const totalRotos = results.reduce((a, r) => a + r.rotos, 0);
  console.log(`\nTOTAL REFS ROTAS: ${totalRotos}`);
  if (totalRotos === 0) console.log('\n✅ Todas las conexiones están íntegras');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
