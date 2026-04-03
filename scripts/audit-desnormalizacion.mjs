/**
 * Auditoría de sincronización de datos desnormalizados
 * Verifica que nombres embebidos en productos coincidan con el maestro
 * Incluye: marcas, categorías, tipos, líneas, etiquetas, proveedores
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

async function main() {
  const [prodSnap, marcasSnap, catsSnap, tiposSnap, lineasSnap, etiqSnap, provSnap, ocSnap, cotSnap] = await Promise.all([
    db.collection('productos').get(),
    db.collection('marcas').get(),
    db.collection('categorias').get(),
    db.collection('tiposProducto').get(),
    db.collection('lineasNegocio').get(),
    db.collection('etiquetas').get(),
    db.collection('proveedores').get(),
    db.collection('ordenesCompra').get(),
    db.collection('cotizaciones').get(),
  ]);

  const marcaMap = new Map(marcasSnap.docs.map(d => [d.id, d.data().nombre]));
  const catMap = new Map(catsSnap.docs.map(d => [d.id, d.data().nombre]));
  const tipoMap = new Map(tiposSnap.docs.map(d => [d.id, d.data().nombre]));
  const lineaMap = new Map(lineasSnap.docs.map(d => [d.id, d.data().nombre]));
  const etiqMap = new Map(etiqSnap.docs.map(d => [d.id, d.data().nombre]));
  const provMap = new Map(provSnap.docs.map(d => [d.id, d.data().nombre || d.data().nombreEmpresa || d.data().razonSocial]));
  const provIds = new Set(provSnap.docs.map(d => d.id));

  console.log('=== AUDITORIA DE SINCRONIZACION DE DATOS DESNORMALIZADOS ===\n');
  console.log(`Maestros: ${marcaMap.size} marcas, ${catMap.size} categorias, ${tipoMap.size} tipos, ${lineaMap.size} lineas, ${etiqMap.size} etiquetas, ${provMap.size} proveedores\n`);

  const marcaDesync = [], marcaSinId = [], marcaIdSinNombre = [];
  const catDesync = [];
  const tipoDesync = [];
  const lineaDesync = [];
  const etiqDesync = [];

  prodSnap.docs.forEach(doc => {
    const p = doc.data();
    const sku = p.sku || doc.id;

    // MARCA
    if (p.marcaId && p.marca) {
      const mn = marcaMap.get(p.marcaId);
      if (mn && mn !== p.marca) marcaDesync.push({ sku, embebido: p.marca, maestro: mn });
    }
    if (p.marca && !p.marcaId) marcaSinId.push({ sku, marca: p.marca });
    if (p.marcaId && !p.marca) marcaIdSinNombre.push({ sku, marcaId: p.marcaId });

    // CATEGORIAS
    if (p.categorias && Array.isArray(p.categorias)) {
      p.categorias.forEach(cat => {
        if (cat.id && cat.nombre) {
          const mn = catMap.get(cat.id);
          if (mn && mn !== cat.nombre) catDesync.push({ sku, embebido: cat.nombre, maestro: mn });
        }
      });
    }

    // TIPO PRODUCTO
    if (p.tipoProductoId && p.tipoProducto) {
      const mn = tipoMap.get(p.tipoProductoId);
      if (mn && mn !== p.tipoProducto) tipoDesync.push({ sku, embebido: p.tipoProducto, maestro: mn });
    }

    // LINEA NEGOCIO
    if (p.lineaNegocioId && p.lineaNegocioNombre) {
      const mn = lineaMap.get(p.lineaNegocioId);
      if (mn && mn !== p.lineaNegocioNombre) lineaDesync.push({ sku, embebido: p.lineaNegocioNombre, maestro: mn });
    }

    // ETIQUETAS
    if (p.etiquetas && Array.isArray(p.etiquetas)) {
      p.etiquetas.forEach(etiq => {
        if (etiq.id && etiq.nombre) {
          const mn = etiqMap.get(etiq.id);
          if (mn && mn !== etiq.nombre) etiqDesync.push({ sku, embebido: etiq.nombre, maestro: mn });
        }
      });
    }
  });

  // PROVEEDORES
  // 1. Proveedores en investigacion de productos
  const provInvDesync = [];
  const provInvSinId = [];
  const provInvIdRoto = [];
  prodSnap.docs.forEach(doc => {
    const p = doc.data();
    const sku = p.sku || doc.id;
    const inv = p.investigacion;
    if (!inv || !inv.proveedoresUSA) return;
    inv.proveedoresUSA.forEach(prov => {
      if (prov.proveedorId && prov.nombre) {
        if (!provIds.has(prov.proveedorId)) {
          provInvIdRoto.push({ sku, nombre: prov.nombre, proveedorId: prov.proveedorId });
        } else {
          const mn = provMap.get(prov.proveedorId);
          if (mn && mn !== prov.nombre) provInvDesync.push({ sku, embebido: prov.nombre, maestro: mn });
        }
      }
      if (prov.nombre && !prov.proveedorId) provInvSinId.push({ sku, nombre: prov.nombre });
    });
  });

  // 2. Proveedores en OC
  const provOCDesync = [];
  ocSnap.docs.forEach(doc => {
    const oc = doc.data();
    const num = oc.numero || doc.id;
    if (oc.proveedorId && oc.proveedorNombre) {
      const mn = provMap.get(oc.proveedorId);
      if (mn && mn !== oc.proveedorNombre) provOCDesync.push({ num, embebido: oc.proveedorNombre, maestro: mn });
    }
  });

  // 3. Proveedores en cotizaciones
  const provCotDesync = [];
  cotSnap.docs.forEach(doc => {
    const cot = doc.data();
    const num = cot.numero || doc.id;
    if (cot.proveedorId && cot.proveedorNombre) {
      const mn = provMap.get(cot.proveedorId);
      if (mn && mn !== cot.proveedorNombre) provCotDesync.push({ num, embebido: cot.proveedorNombre, maestro: mn });
    }
  });

  // REPORT
  console.log('--- 1. MARCAS ---');
  console.log(`  Nombre desincronizado: ${marcaDesync.length}`);
  marcaDesync.forEach(m => console.log(`    ${m.sku}: "${m.embebido}" vs maestro "${m.maestro}"`));
  console.log(`  Marca sin marcaId: ${marcaSinId.length}`);
  marcaSinId.forEach(m => console.log(`    ${m.sku}: "${m.marca}"`));
  console.log(`  marcaId sin nombre embebido: ${marcaIdSinNombre.length}`);

  console.log('\n--- 2. CATEGORIAS ---');
  console.log(`  Nombre desincronizado: ${catDesync.length}`);
  catDesync.slice(0, 10).forEach(c => console.log(`    ${c.sku}: "${c.embebido}" vs maestro "${c.maestro}"`));
  if (catDesync.length > 10) console.log(`    ... y ${catDesync.length - 10} mas`);

  console.log('\n--- 3. TIPO PRODUCTO ---');
  console.log(`  Nombre desincronizado: ${tipoDesync.length}`);
  tipoDesync.slice(0, 10).forEach(t => console.log(`    ${t.sku}: "${t.embebido}" vs maestro "${t.maestro}"`));
  if (tipoDesync.length > 10) console.log(`    ... y ${tipoDesync.length - 10} mas`);

  console.log('\n--- 4. LINEA NEGOCIO ---');
  console.log(`  Nombre desincronizado: ${lineaDesync.length}`);
  lineaDesync.forEach(l => console.log(`    ${l.sku}: "${l.embebido}" vs maestro "${l.maestro}"`));

  console.log('\n--- 5. ETIQUETAS ---');
  console.log(`  Nombre desincronizado: ${etiqDesync.length}`);
  etiqDesync.slice(0, 10).forEach(e => console.log(`    ${e.sku}: "${e.embebido}" vs maestro "${e.maestro}"`));
  if (etiqDesync.length > 10) console.log(`    ... y ${etiqDesync.length - 10} mas`);

  console.log('\n--- 6. PROVEEDORES EN INVESTIGACION ---');
  console.log(`  proveedorId roto (no existe en maestro): ${provInvIdRoto.length}`);
  provInvIdRoto.forEach(p => console.log(`    ${p.sku}: "${p.nombre}" -> ${p.proveedorId}`));
  console.log(`  Nombre desincronizado: ${provInvDesync.length}`);
  provInvDesync.forEach(p => console.log(`    ${p.sku}: "${p.embebido}" vs maestro "${p.maestro}"`));
  console.log(`  Sin proveedorId (sin vinculo al maestro): ${provInvSinId.length}`);
  provInvSinId.slice(0, 10).forEach(p => console.log(`    ${p.sku}: "${p.nombre}"`));
  if (provInvSinId.length > 10) console.log(`    ... y ${provInvSinId.length - 10} mas`);

  console.log('\n--- 7. PROVEEDORES EN OC ---');
  console.log(`  Nombre desincronizado: ${provOCDesync.length}`);
  provOCDesync.forEach(p => console.log(`    ${p.num}: "${p.embebido}" vs maestro "${p.maestro}"`));

  console.log('\n--- 8. PROVEEDORES EN COTIZACIONES ---');
  console.log(`  Nombre desincronizado: ${provCotDesync.length}`);
  provCotDesync.forEach(p => console.log(`    ${p.num}: "${p.embebido}" vs maestro "${p.maestro}"`));

  // Productos sin clasificacion
  let sinMarca = 0, sinTipo = 0, sinLinea = 0, sinCat = 0;
  prodSnap.docs.forEach(doc => {
    const p = doc.data();
    if (!p.marcaId && !p.marca) sinMarca++;
    if (!p.tipoProductoId) sinTipo++;
    if (!p.lineaNegocioId) sinLinea++;
    if (!p.categoriaIds || p.categoriaIds.length === 0) sinCat++;
  });
  console.log('\n--- 9. PRODUCTOS SIN CLASIFICACION ---');
  console.log(`  Sin marca: ${sinMarca} / ${prodSnap.size}`);
  console.log(`  Sin tipo producto: ${sinTipo} / ${prodSnap.size}`);
  console.log(`  Sin linea negocio: ${sinLinea} / ${prodSnap.size}`);
  console.log(`  Sin categorias: ${sinCat} / ${prodSnap.size}`);

  // Maestros huerfanos
  const usedMarcas = new Set(prodSnap.docs.map(d => d.data().marcaId).filter(Boolean));
  const usedCats = new Set(prodSnap.docs.flatMap(d => d.data().categoriaIds || []));
  const usedTipos = new Set(prodSnap.docs.map(d => d.data().tipoProductoId).filter(Boolean));
  const usedLineas = new Set(prodSnap.docs.map(d => d.data().lineaNegocioId).filter(Boolean));
  const usedEtiqs = new Set(prodSnap.docs.flatMap(d => d.data().etiquetaIds || []));
  const usedProvs = new Set([
    ...ocSnap.docs.map(d => d.data().proveedorId).filter(Boolean),
    ...cotSnap.docs.map(d => d.data().proveedorId).filter(Boolean),
    ...prodSnap.docs.flatMap(d => (d.data().investigacion?.proveedoresUSA || []).map(p => p.proveedorId).filter(Boolean)),
  ]);

  const unused = (snap, usedSet) => snap.docs.filter(d => !usedSet.has(d.id));
  const unusedMarcas = unused(marcasSnap, usedMarcas);
  const unusedCats = unused(catsSnap, usedCats);
  const unusedTipos = unused(tiposSnap, usedTipos);
  const unusedLineas = unused(lineasSnap, usedLineas);
  const unusedEtiqs = unused(etiqSnap, usedEtiqs);
  const unusedProvs = unused(provSnap, usedProvs);

  console.log('\n--- 10. MAESTROS SIN USO (huerfanos) ---');
  console.log(`  Marcas: ${unusedMarcas.length} / ${marcasSnap.size}`);
  unusedMarcas.forEach(d => console.log(`    - ${d.data().nombre}`));
  console.log(`  Categorias: ${unusedCats.length} / ${catsSnap.size}`);
  unusedCats.forEach(d => console.log(`    - ${d.data().nombre}`));
  console.log(`  Tipos: ${unusedTipos.length} / ${tiposSnap.size}`);
  unusedTipos.slice(0, 15).forEach(d => console.log(`    - ${d.data().nombre}`));
  if (unusedTipos.length > 15) console.log(`    ... y ${unusedTipos.length - 15} mas`);
  console.log(`  Lineas: ${unusedLineas.length} / ${lineasSnap.size}`);
  unusedLineas.forEach(d => console.log(`    - ${d.data().nombre}`));
  console.log(`  Etiquetas: ${unusedEtiqs.length} / ${etiqSnap.size}`);
  unusedEtiqs.slice(0, 15).forEach(d => console.log(`    - ${d.data().nombre}`));
  if (unusedEtiqs.length > 15) console.log(`    ... y ${unusedEtiqs.length - 15} mas`);
  console.log(`  Proveedores: ${unusedProvs.length} / ${provSnap.size}`);
  unusedProvs.forEach(d => console.log(`    - ${d.data().nombre || d.data().nombreEmpresa || d.id}`));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
