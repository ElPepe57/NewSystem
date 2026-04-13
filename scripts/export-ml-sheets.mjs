/**
 * Exporta el reporte de ventas ML a TSV (tab-separated) listo para pegar
 * en Google Sheets, y también guarda los archivos en disco.
 *
 * Genera 3 archivos en scripts/exports/:
 *   - ml-productos.tsv  (54 productos agregados)
 *   - ml-ordenes.tsv    (176 órdenes)
 *   - ml-lineas.tsv     (línea por línea: una fila por par orden+producto)
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const OUT_DIR = 'scripts/exports';
mkdirSync(OUT_DIR, { recursive: true });

// Limpia un valor para TSV: remueve tabs/newlines, recorta espacios
function clean(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[\t\r\n]+/g, ' ').trim();
}

// Convierte filas (array de objetos) a TSV string
function toTSV(rows, columns) {
  const header = columns.map(c => c.label).join('\t');
  const body = rows
    .map(r => columns.map(c => clean(c.value(r))).join('\t'))
    .join('\n');
  return header + '\n' + body + '\n';
}

// Cargar todas las órdenes
const snap = await db.collection('mlOrderSync').orderBy('fechaOrdenML', 'desc').get();
const ordenes = [];
const productosAcum = new Map();
const lineas = [];

for (const doc of snap.docs) {
  const d = doc.data();
  const fecha = d.fechaOrdenML?.toDate?.();
  const fechaStr = fecha ? fecha.toISOString().split('T')[0] : '';

  ordenes.push({
    fecha: fechaStr,
    mlOrderId: d.mlOrderId,
    estado: d.estado || '',
    mlStatus: d.mlStatus || '',
    metodoEnvio: d.metodoEnvio || '',
    totalML: d.totalML || 0,
    comisionML: d.comisionML || 0,
    cargoEnvioML: d.cargoEnvioML || 0,
    costoEnvioCliente: d.costoEnvioCliente || 0,
    buyerNombre: d.mlBuyerName || '',
    buyerNickname: d.mlBuyerNickname || '',
    buyerDni: d.buyerDni || '',
    buyerEmail: d.buyerEmail || '',
    buyerPhone: d.buyerPhone || '',
    distrito: d.distrito || '',
    provincia: d.provincia || '',
    direccion: d.direccionEntrega || '',
    cantItems: (d.productos || []).length,
  });

  if (Array.isArray(d.productos)) {
    for (const p of d.productos) {
      // Acumular productos
      const key = p.mlItemId || p.mlTitle;
      if (!productosAcum.has(key)) {
        productosAcum.set(key, {
          mlItemId: p.mlItemId || '',
          nombre: p.mlTitle || p.productoNombre || '',
          sku: p.productoSku || '',
          vinculado: p.vinculado ? 'SI' : 'NO',
          cantidadTotal: 0,
          ordenesTotal: 0,
          ingresoTotal: 0,
          precioPromedio: 0,
        });
      }
      const acc = productosAcum.get(key);
      acc.cantidadTotal += p.cantidad || 0;
      acc.ordenesTotal += 1;
      acc.ingresoTotal += (p.cantidad || 0) * (p.precioUnitario || 0);

      // Línea por línea
      lineas.push({
        fecha: fechaStr,
        mlOrderId: d.mlOrderId,
        estado: d.estado || '',
        mlItemId: p.mlItemId || '',
        nombre: p.mlTitle || '',
        cantidad: p.cantidad || 0,
        precioUnitario: p.precioUnitario || 0,
        subtotal: (p.cantidad || 0) * (p.precioUnitario || 0),
        saleFee: p.saleFee || 0,
        sku: p.productoSku || '',
        vinculado: p.vinculado ? 'SI' : 'NO',
        cliente: d.mlBuyerName || '',
      });
    }
  }
}

// Calcular precio promedio de cada producto
const productosArr = Array.from(productosAcum.values())
  .map(p => ({ ...p, precioPromedio: p.cantidadTotal > 0 ? p.ingresoTotal / p.cantidadTotal : 0 }))
  .sort((a, b) => b.cantidadTotal - a.cantidadTotal);

// ============================================================
// EXPORT 1 — Productos agregados
// ============================================================
const productosCols = [
  { label: 'Rank', value: (r, i) => i + 1 },
  { label: 'Unidades', value: r => r.cantidadTotal },
  { label: 'Ordenes', value: r => r.ordenesTotal },
  { label: 'Ingreso S/', value: r => r.ingresoTotal.toFixed(2) },
  { label: 'Precio Prom S/', value: r => r.precioPromedio.toFixed(2) },
  { label: 'SKU ERP', value: r => r.sku || '(sin vincular)' },
  { label: 'Vinculado', value: r => r.vinculado },
  { label: 'ML Item ID', value: r => r.mlItemId },
  { label: 'Nombre', value: r => r.nombre },
];

// Versión con índice
function toTSVWithIndex(rows, columns) {
  const header = columns.map(c => c.label).join('\t');
  const body = rows
    .map((r, i) => columns.map(c => clean(c.value(r, i))).join('\t'))
    .join('\n');
  return header + '\n' + body + '\n';
}

const productosTSV = toTSVWithIndex(productosArr, productosCols);
writeFileSync(OUT_DIR + '/ml-productos.tsv', productosTSV, 'utf-8');

// ============================================================
// EXPORT 2 — Órdenes
// ============================================================
const ordenesCols = [
  { label: 'Fecha', value: r => r.fecha },
  { label: 'ML Order ID', value: r => r.mlOrderId },
  { label: 'Estado ERP', value: r => r.estado },
  { label: 'Estado ML', value: r => r.mlStatus },
  { label: 'Metodo Envio', value: r => r.metodoEnvio },
  { label: 'Total S/', value: r => (r.totalML || 0).toFixed(2) },
  { label: 'Comision S/', value: r => (r.comisionML || 0).toFixed(2) },
  { label: 'Envio Urbano S/', value: r => (r.cargoEnvioML || 0).toFixed(2) },
  { label: 'Envio Cliente S/', value: r => (r.costoEnvioCliente || 0).toFixed(2) },
  { label: 'Items', value: r => r.cantItems },
  { label: 'Cliente', value: r => r.buyerNombre },
  { label: 'Nickname', value: r => r.buyerNickname },
  { label: 'DNI', value: r => r.buyerDni },
  { label: 'Email', value: r => r.buyerEmail },
  { label: 'Telefono', value: r => r.buyerPhone },
  { label: 'Distrito', value: r => r.distrito },
  { label: 'Provincia', value: r => r.provincia },
  { label: 'Direccion', value: r => r.direccion },
];
const ordenesTSV = toTSV(ordenes, ordenesCols);
writeFileSync(OUT_DIR + '/ml-ordenes.tsv', ordenesTSV, 'utf-8');

// ============================================================
// EXPORT 3 — Líneas de producto por orden
// ============================================================
const lineasCols = [
  { label: 'Fecha', value: r => r.fecha },
  { label: 'ML Order ID', value: r => r.mlOrderId },
  { label: 'Estado', value: r => r.estado },
  { label: 'Cant', value: r => r.cantidad },
  { label: 'Precio Unit S/', value: r => (r.precioUnitario || 0).toFixed(2) },
  { label: 'Subtotal S/', value: r => (r.subtotal || 0).toFixed(2) },
  { label: 'Sale Fee S/', value: r => (r.saleFee || 0).toFixed(2) },
  { label: 'SKU', value: r => r.sku || '(sin vincular)' },
  { label: 'Vinculado', value: r => r.vinculado },
  { label: 'ML Item ID', value: r => r.mlItemId },
  { label: 'Producto', value: r => r.nombre },
  { label: 'Cliente', value: r => r.cliente },
];
const lineasTSV = toTSV(lineas, lineasCols);
writeFileSync(OUT_DIR + '/ml-lineas.tsv', lineasTSV, 'utf-8');

// ============================================================
// Resumen + impresión del TSV de productos al stdout
// ============================================================
console.log('=================================================');
console.log('EXPORT COMPLETO');
console.log('=================================================');
console.log('Archivos generados:');
console.log('  ' + OUT_DIR + '/ml-productos.tsv  (' + productosArr.length + ' productos)');
console.log('  ' + OUT_DIR + '/ml-ordenes.tsv    (' + ordenes.length + ' órdenes)');
console.log('  ' + OUT_DIR + '/ml-lineas.tsv     (' + lineas.length + ' líneas)');

console.log('\n=================================================');
console.log('PEGABLE EN GOOGLE SHEETS — PRODUCTOS (TSV)');
console.log('Selecciona desde la línea siguiente al separador');
console.log('hasta el otro separador, Ctrl+C, ve a Sheets, A1, Ctrl+V');
console.log('=================================================');
console.log('---BEGIN-PRODUCTOS-TSV---');
process.stdout.write(productosTSV);
console.log('---END-PRODUCTOS-TSV---');

process.exit(0);
