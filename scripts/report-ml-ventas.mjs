import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const snap = await db.collection('mlOrderSync').orderBy('fechaOrdenML', 'desc').get();

console.log('========================================');
console.log('REPORTE DE VENTAS — MERCADOLIBRE');
console.log('========================================');
console.log('Total de órdenes sincronizadas: ' + snap.size + '\n');

// Contadores por estado
const porEstado = { pendiente: 0, procesada: 0, error: 0, ignorada: 0 };
const porMetodo = { flex: 0, urbano: 0, desconocido: 0 };

// Agregador de productos
const productosAcum = new Map(); // key: productoSku || mlItemId

let totalBrutoML = 0;
let totalComisionML = 0;

const ordenes = [];

for (const doc of snap.docs) {
  const d = doc.data();
  porEstado[d.estado] = (porEstado[d.estado] || 0) + 1;

  const met = d.metodoEnvio || 'desconocido';
  porMetodo[met] = (porMetodo[met] || 0) + 1;

  // Agregar TODAS las órdenes sincronizadas (incluidas pendientes)
  totalBrutoML += d.totalML || 0;
  totalComisionML += d.comisionML || 0;

  const fecha = d.fechaOrdenML?.toDate ? d.fechaOrdenML.toDate() : null;
  const fechaStr = fecha ? fecha.toISOString().split('T')[0] : 'sin-fecha';

  ordenes.push({
    mlOrderId: d.mlOrderId,
    numeroVenta: d.numeroVenta || '-',
    estado: d.estado,
    fecha: fechaStr,
    comprador: d.mlBuyerNickname || d.mlBuyerName || '(anónimo)',
    totalML: d.totalML || 0,
    comisionML: d.comisionML || 0,
    metodoEnvio: met,
    productos: d.productos || [],
  });

  // Acumular productos de TODAS las órdenes sincronizadas
  if (Array.isArray(d.productos)) {
    for (const p of d.productos) {
      const key = p.productoSku || p.mlItemId || p.mlTitle;
      if (!productosAcum.has(key)) {
        productosAcum.set(key, {
          sku: p.productoSku || '(sin-vincular)',
          nombre: p.productoNombre || p.mlTitle || '(sin-nombre)',
          mlItemId: p.mlItemId,
          cantidadTotal: 0,
          vecesVendido: 0,
          ingresoTotal: 0,
          vinculado: p.vinculado,
        });
      }
      const acc = productosAcum.get(key);
      acc.cantidadTotal += p.cantidad || 0;
      acc.vecesVendido += 1;
      acc.ingresoTotal += (p.cantidad || 0) * (p.precioUnitario || 0);
    }
  }
}

// ============================================================
// 1. RESUMEN POR ESTADO
// ============================================================
console.log('=== RESUMEN POR ESTADO ===');
for (const [k, v] of Object.entries(porEstado)) {
  console.log('  ' + k.padEnd(12) + ': ' + v);
}

console.log('\n=== MÉTODO DE ENVÍO (solo órdenes con método) ===');
for (const [k, v] of Object.entries(porMetodo)) {
  if (v > 0) console.log('  ' + k.padEnd(12) + ': ' + v);
}

console.log('\n=== TOTALES (solo procesadas) ===');
console.log('  Venta bruta ML:   S/ ' + totalBrutoML.toFixed(2));
console.log('  Comisión ML:      S/ ' + totalComisionML.toFixed(2));
console.log('  Neto sin envío:   S/ ' + (totalBrutoML - totalComisionML).toFixed(2));

// ============================================================
// 2. LISTADO DE ÓRDENES
// ============================================================
console.log('\n========================================');
console.log('LISTADO COMPLETO DE ÓRDENES');
console.log('========================================');
for (const o of ordenes) {
  console.log(
    o.fecha + ' | ' +
    String(o.numeroVenta).padEnd(13) + ' | ' +
    o.estado.padEnd(10) + ' | ' +
    o.metodoEnvio.padEnd(11) + ' | ' +
    'S/' + o.totalML.toFixed(2).padStart(8) + ' | ' +
    String(o.comprador).substring(0, 25).padEnd(25) + ' | ML#' + o.mlOrderId
  );
  for (const p of o.productos) {
    const sku = p.productoSku || '(no-vinc)';
    const nom = (p.productoNombre || p.mlTitle || '').substring(0, 60);
    console.log('    └─ ' + String(p.cantidad) + 'x ' + sku.padEnd(10) + ' ' + nom + ' @ S/' + (p.precioUnitario || 0).toFixed(2));
  }
}

// ============================================================
// 3. PRODUCTOS VENDIDOS — AGREGADO
// ============================================================
console.log('\n========================================');
console.log('PRODUCTOS VENDIDOS (solo órdenes procesadas)');
console.log('========================================');
const productosArr = Array.from(productosAcum.values())
  .sort((a, b) => b.cantidadTotal - a.cantidadTotal);

console.log('Productos únicos vendidos: ' + productosArr.length + '\n');
console.log('SKU         | Cant | Órdenes | Ingreso     | Nombre');
console.log('------------|------|---------|-------------|------------------------------------------');

let totalUnidadesVendidas = 0;
let totalIngresoProd = 0;

for (const p of productosArr) {
  console.log(
    p.sku.padEnd(11) + ' | ' +
    String(p.cantidadTotal).padStart(4) + ' | ' +
    String(p.vecesVendido).padStart(7) + ' | S/' +
    p.ingresoTotal.toFixed(2).padStart(9) + ' | ' +
    p.nombre.substring(0, 50)
  );
  totalUnidadesVendidas += p.cantidadTotal;
  totalIngresoProd += p.ingresoTotal;
}

console.log('\n=== TOTALES DE PRODUCTOS ===');
console.log('  Unidades totales vendidas: ' + totalUnidadesVendidas);
console.log('  Ingreso total por productos: S/ ' + totalIngresoProd.toFixed(2));

const sinVincular = productosArr.filter(p => p.sku === '(sin-vincular)').length;
if (sinVincular > 0) {
  console.log('  ⚠ Productos SIN vincular al catálogo ERP: ' + sinVincular);
}

console.log('\nFin del reporte.');
process.exit(0);
