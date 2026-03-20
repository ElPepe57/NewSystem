/**
 * Creates 5 varied test mlOrderSync documents in Firestore.
 *
 * Cases:
 *  1. Envío gratis, 1 producto - caso estándar
 *  2. Envío pagado por cliente (costoEnvioCliente > 0) - buyer pays shipping
 *  3. Multi-producto (2 productos diferentes)
 *  4. Orden alto valor + comisión alta
 *  5. Anulación de cargos: ML reembolsa S/15 pero costoEnvioCliente=S/12 (difieren)
 *
 * Usage:
 *   node scripts/create-test-ml-orders-batch.mjs
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

function genMlOrderId() {
  return 2000000000000 + Math.floor(Math.random() * 999999999);
}
function genBuyerId() {
  return 100000000 + Math.floor(Math.random() * 899999999);
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

// ============================================================
// BUYERS (varied)
// ============================================================
const BUYERS = [
  {
    name: 'Ana Lucía Fernández',
    email: 'analucia.fernandez@hotmail.com',
    phone: '51912345678',
    dni: '41234567',
    direccion: 'Jr. de la Unión 432, Cercado de Lima',
    distrito: 'Cercado de Lima',
    provincia: 'Lima',
    coords: { lat: -12.0464, lng: -77.0428 },
  },
  {
    name: 'Roberto Sánchez Medina',
    email: 'roberto.sanchez@gmail.com',
    phone: '51998877665',
    dni: '72345678',
    direccion: 'Calle Los Álamos 789, Surco',
    distrito: 'Santiago de Surco',
    provincia: 'Lima',
    coords: { lat: -12.1328, lng: -76.9917 },
  },
  {
    name: 'Carmen Rosa Díaz',
    email: 'carmen.diaz@yahoo.com',
    phone: '51976543210',
    dni: '45678901',
    direccion: 'Av. La Marina 2456, San Miguel',
    distrito: 'San Miguel',
    provincia: 'Lima',
    coords: { lat: -12.0776, lng: -77.0936 },
  },
  {
    name: 'Diego Alejandro Torres',
    email: 'diego.torres.pe@gmail.com',
    phone: '51945678123',
    dni: '56789012',
    direccion: 'Av. Benavides 3456, Miraflores',
    distrito: 'Miraflores',
    provincia: 'Lima',
    coords: { lat: -12.1191, lng: -77.0298 },
  },
  {
    name: 'Patricia Huamán Quispe',
    email: 'patty.huaman@outlook.com',
    phone: '51934567890',
    dni: '67890123',
    direccion: 'Calle Las Begonias 567, Jesús María',
    distrito: 'Jesús María',
    provincia: 'Lima',
    coords: { lat: -12.0712, lng: -77.0454 },
  },
];

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Creating 5 varied test ML orders in Firestore      ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // Find products with available stock
  const unidadesSnap = await db.collection('unidades')
    .where('estado', '==', 'disponible_peru')
    .limit(30)
    .get();

  const stockMap = {};
  for (const u of unidadesSnap.docs) {
    const pid = u.data().productoId;
    if (pid) stockMap[pid] = (stockMap[pid] || 0) + 1;
  }

  // Get product details for all products with stock
  const productIds = Object.keys(stockMap);
  const products = [];
  for (const pid of productIds) {
    const doc = await db.collection('productos').doc(pid).get();
    if (doc.exists) {
      const d = doc.data();
      products.push({
        id: pid,
        sku: d.sku || 'SKU-???',
        nombre: d.nombreComercial || d.nombre || 'Producto',
        precio: d.precioVenta || 59.90,
        stock: stockMap[pid],
      });
    }
  }

  // If not enough products, also grab some without stock
  if (products.length < 2) {
    const extraSnap = await db.collection('productos')
      .where('estado', '==', 'activo')
      .limit(5)
      .get();
    for (const doc of extraSnap.docs) {
      if (!products.find(p => p.id === doc.id)) {
        const d = doc.data();
        products.push({
          id: doc.id,
          sku: d.sku || 'SKU-???',
          nombre: d.nombreComercial || d.nombre || 'Producto',
          precio: d.precioVenta || 49.90,
          stock: 0,
        });
      }
    }
  }

  console.log(`Found ${products.length} products (${products.filter(p => p.stock > 0).length} with stock):`);
  for (const p of products.slice(0, 5)) {
    console.log(`  - ${p.sku}: ${p.nombre} @ S/${p.precio} (stock: ${p.stock})`);
  }

  // Get comision % from config
  const configDoc = await db.collection('mlConfig').doc('settings').get();
  const comisionPct = configDoc.exists ? (configDoc.data().defaultComisionPorcentaje || 15) : 15;

  const now = Timestamp.now();
  const p1 = products[0] || { id: null, sku: 'TEST-001', nombre: 'Producto Test', precio: 59.90, stock: 0 };
  const p2 = products[1] || products[0] || p1;

  // ============================================================
  // CASE DEFINITIONS
  // ============================================================
  const cases = [
    // CASO 1: Envío gratis, 1 producto estándar
    {
      label: 'Envío gratis - 1 producto',
      buyer: BUYERS[0],
      costoEnvioML: 0,
      costoEnvioCliente: 0,
      productos: [
        { ...p1, cantidad: 1 },
      ],
    },
    // CASO 2: Envío pagado por cliente
    {
      label: 'Envío pagado por cliente (S/12.50)',
      buyer: BUYERS[1],
      costoEnvioML: 12.50,
      costoEnvioCliente: 12.50,
      productos: [
        { ...p1, cantidad: 1 },
      ],
    },
    // CASO 3: Multi-producto (2 productos diferentes)
    {
      label: 'Multi-producto (2 items)',
      buyer: BUYERS[2],
      costoEnvioML: 0,
      costoEnvioCliente: 0,
      productos: [
        { ...p1, cantidad: 1 },
        { ...p2, cantidad: 2 },
      ],
    },
    // CASO 4: Orden de alto valor
    {
      label: 'Alto valor + envío premium',
      buyer: BUYERS[3],
      costoEnvioML: 18.00,
      costoEnvioCliente: 25.00, // Cliente paga más por envío express
      productos: [
        { ...p1, cantidad: 3 },
      ],
    },
    // CASO 5: Anulación de cargos - ML reembolsa diferente a lo que cobra al cliente
    {
      label: 'Anulación de cargos (ML reembolsa S/15, cliente pagó S/12)',
      buyer: BUYERS[4],
      costoEnvioML: 15.00,       // Lo que ML "reembolsa" al vendedor (anulación de cargo)
      costoEnvioCliente: 12.00,  // Lo que el cliente realmente pagó (payment.shipping_cost)
      productos: [
        { ...p1, cantidad: 2 },
      ],
    },
  ];

  // ============================================================
  // CREATE ORDERS
  // ============================================================
  const created = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const buyer = c.buyer;
    const mlOrderId = genMlOrderId();
    const mlBuyerId = genBuyerId();

    // Calculate financials
    let subtotal = 0;
    const productosData = c.productos.map(p => {
      const sub = round2(p.precio * p.cantidad);
      subtotal += sub;
      const fee = round2(sub * comisionPct / 100);
      return {
        mlItemId: `MPE-TEST-${p.sku}`,
        mlTitle: p.nombre,
        mlVariationId: null,
        cantidad: p.cantidad,
        precioUnitario: p.precio,
        saleFee: fee,
        productoId: p.id,
        productoSku: p.sku,
        productoNombre: p.nombre,
        vinculado: !!p.id,
      };
    });

    subtotal = round2(subtotal);
    const totalML = round2(subtotal + c.costoEnvioCliente);
    const comisionML = round2(subtotal * comisionPct / 100);

    const orderData = {
      mlOrderId,
      mlStatus: 'paid',
      mlBuyerId,
      mlBuyerName: buyer.name,
      ventaId: null,
      numeroVenta: null,
      clienteId: null,
      estado: 'pendiente',
      errorDetalle: null,
      totalML,
      comisionML,
      costoEnvioML: c.costoEnvioML,
      costoEnvioCliente: c.costoEnvioCliente,
      fechaOrdenML: now,
      fechaProcesada: null,
      fechaSync: now,
      buyerEmail: buyer.email,
      buyerPhone: buyer.phone,
      buyerDni: buyer.dni,
      direccionEntrega: buyer.direccion,
      distrito: buyer.distrito,
      provincia: buyer.provincia,
      coordenadas: buyer.coords,
      trackingNumber: i >= 3 ? `ME-${Date.now()}-${i}` : null,
      shipmentStatus: 'ready_to_ship',
      todosVinculados: true,
      productos: productosData,
    };

    const ref = await db.collection('mlOrderSync').add(orderData);

    const envioLabel = c.costoEnvioCliente > 0
      ? `envío S/${c.costoEnvioCliente}${c.costoEnvioML !== c.costoEnvioCliente ? ` (ML reembolsa S/${c.costoEnvioML})` : ''}`
      : 'envío gratis';

    console.log(`\n  ✅ Caso ${i + 1}: ${c.label}`);
    console.log(`     ID: ${ref.id}`);
    console.log(`     ML#: ${mlOrderId} | ${buyer.name} (${buyer.distrito})`);
    console.log(`     ${c.productos.map(p => `${p.nombre} x${p.cantidad}`).join(' + ')}`);
    console.log(`     Subtotal: S/${subtotal} | ${envioLabel} | Total: S/${totalML} | Com: S/${comisionML}`);

    created.push({ id: ref.id, mlOrderId, label: c.label });
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('  RESUMEN: 5 órdenes creadas');
  console.log('='.repeat(60));
  for (const c of created) {
    console.log(`  ${c.label}`);
    console.log(`    → ${c.id} (ML#${c.mlOrderId})`);
  }
  console.log('\n  Ahora ve a Mercado Libre → Órdenes → "Procesar Todos" o procesalas individualmente.\n');

  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
