/**
 * Script para analizar productos duplicados
 *
 * INSTRUCCIONES:
 * 1. Abre la aplicación en el navegador (localhost:5173/productos)
 * 2. Abre la consola del navegador (F12 -> Console)
 * 3. Copia y pega este código en la consola
 * 4. Presiona Enter para ejecutar
 */

(function analizarDuplicados() {
  // Intentar obtener productos del estado de React
  // Esto funciona si Zustand expone el estado de alguna manera

  // Alternativa: Buscar en el DOM los productos mostrados
  const filas = document.querySelectorAll('table tbody tr');
  const productos = [];

  filas.forEach(fila => {
    const celdas = fila.querySelectorAll('td');
    if (celdas.length >= 2) {
      const sku = celdas[0]?.textContent?.trim() || '';
      const productoDiv = celdas[1];
      const marca = productoDiv?.querySelector('.font-medium, strong')?.textContent?.trim() || '';
      const nombre = productoDiv?.querySelector('.text-gray-600, .text-sm')?.textContent?.trim() || '';

      if (sku || marca) {
        productos.push({ sku, marca, nombre });
      }
    }
  });

  console.log('Total de productos encontrados en la tabla:', productos.length);

  if (productos.length === 0) {
    console.log('\nNo se encontraron productos en la tabla.');
    console.log('Asegúrate de estar en la página de Productos con la tabla visible.');
    console.log('\nAlternativa: Usa este código para analizar desde el store:');
    console.log(`
// Si el store de Zustand está expuesto:
const store = useProductoStore.getState();
console.log(store.productos);
    `);
    return;
  }

  // Buscar duplicados por SKU
  const porSKU = {};
  productos.forEach((p, idx) => {
    const key = p.sku.toLowerCase();
    if (!porSKU[key]) porSKU[key] = [];
    porSKU[key].push({ ...p, index: idx });
  });

  console.log('\n=== DUPLICADOS POR SKU ===');
  let hayDupSKU = false;
  Object.entries(porSKU).forEach(([sku, prods]) => {
    if (prods.length > 1) {
      hayDupSKU = true;
      console.log(`SKU "${sku}" aparece ${prods.length} veces:`);
      prods.forEach(p => console.log(`  - ${p.marca} ${p.nombre}`));
    }
  });
  if (!hayDupSKU) console.log('No hay duplicados por SKU');

  // Buscar duplicados por Marca + Nombre
  const porMarcaNombre = {};
  productos.forEach((p, idx) => {
    const key = `${p.marca.toLowerCase()}|${p.nombre.toLowerCase()}`;
    if (!porMarcaNombre[key]) porMarcaNombre[key] = [];
    porMarcaNombre[key].push({ ...p, index: idx });
  });

  console.log('\n=== DUPLICADOS POR MARCA + NOMBRE ===');
  let hayDupNombre = false;
  Object.entries(porMarcaNombre).forEach(([key, prods]) => {
    if (prods.length > 1) {
      hayDupNombre = true;
      console.log(`"${key.replace('|', ' - ')}" aparece ${prods.length} veces:`);
      prods.forEach(p => console.log(`  - SKU: ${p.sku}`));
    }
  });
  if (!hayDupNombre) console.log('No hay duplicados por Marca + Nombre');

  // Resumen
  const dupsSKU = Object.values(porSKU).filter(v => v.length > 1).length;
  const dupsNombre = Object.values(porMarcaNombre).filter(v => v.length > 1).length;

  console.log('\n=== RESUMEN ===');
  console.log(`Total productos analizados: ${productos.length}`);
  console.log(`SKUs duplicados: ${dupsSKU}`);
  console.log(`Marca+Nombre duplicados: ${dupsNombre}`);

  return { productos, porSKU, porMarcaNombre };
})();
