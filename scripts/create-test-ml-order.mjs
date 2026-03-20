/**
 * Creates a test mlOrderSync document using real Firestore data.
 *
 * Queries the production database to find:
 *  - A product with stockDisponible > 0
 *  - An mlProductMap that is vinculado=true
 *  - The cuentasCaja for mercado_pago
 *  - The mlConfig/settings
 *
 * Then creates a realistic mlOrderSync doc in estado=pendiente
 * with todosVinculados=true so it can be processed from the UI.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/sa.json node scripts/create-test-ml-order.mjs
 *   (or rely on gcloud auth application-default login)
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// --- Initialize Firebase Admin ---
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

// --- Helpers ---

function separator(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function generateMlOrderId() {
  // Realistic ML order IDs are large numbers (13 digits)
  return 2000000000000 + Math.floor(Math.random() * 999999999);
}

function generateMlBuyerId() {
  return 100000000 + Math.floor(Math.random() * 899999999);
}

// --- Main ---

async function main() {
  console.log('Creating test mlOrderSync document from real Firestore data...');

  // ============================================================
  // 1. Find a product with stock (direct from productos collection)
  // ============================================================
  separator('1. Searching for a product with stock');

  // First try to find an mlProductMap that is vinculado
  const mlMapsSnap = await db.collection('mlProductMap')
    .where('vinculado', '==', true)
    .limit(5)
    .get();

  let productoId = null;
  let productoSku = null;
  let productoNombre = null;
  let precioUnitario = 59.90;
  let mlItemId = 'MPE-TEST-001';

  if (!mlMapsSnap.empty) {
    const mlMapData = mlMapsSnap.docs[0].data();
    productoId = mlMapData.productoId;
    productoSku = mlMapData.productoSku;
    productoNombre = mlMapData.productoNombre;
    precioUnitario = mlMapData.mlPrice || 59.90;
    mlItemId = mlMapData.mlItemId || mlItemId;
    console.log(`  Found vinculado mlProductMap: ${mlMapData.mlTitle}`);
  } else {
    console.log('  No vinculado mlProductMap found. Searching productos directly...');
  }

  // Find a product with available stock (unidades en estado disponible_peru)
  const unidadesSnap = await db.collection('unidades')
    .where('estado', '==', 'disponible_peru')
    .limit(10)
    .get();

  if (!unidadesSnap.empty) {
    // Group by productoId to find one with stock
    const stockMap = {};
    for (const u of unidadesSnap.docs) {
      const pid = u.data().productoId;
      if (pid) stockMap[pid] = (stockMap[pid] || 0) + 1;
    }

    const bestProdId = Object.entries(stockMap).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (bestProdId) {
      const prodDoc = await db.collection('productos').doc(bestProdId).get();
      if (prodDoc.exists) {
        const prodData = prodDoc.data();
        productoId = bestProdId;
        productoSku = prodData.sku || productoSku;
        productoNombre = prodData.nombreComercial || prodData.nombre || productoNombre;
        precioUnitario = prodData.precioVenta || precioUnitario;
        console.log(`  Found product with ${stockMap[bestProdId]} available units:`);
        console.log(`    ID:    ${productoId}`);
        console.log(`    SKU:   ${productoSku}`);
        console.log(`    Name:  ${productoNombre}`);
        console.log(`    Price: S/ ${precioUnitario}`);
      }
    }
  } else {
    console.warn('  WARNING: No unidades en estado disponible_peru found.');
    console.warn('  FEFO assignment will be partial/empty. Venta will still be created.');

    // Fallback: just grab any active product
    const anyProd = await db.collection('productos')
      .where('estado', '==', 'activo')
      .limit(1)
      .get();
    if (!anyProd.empty) {
      const pd = anyProd.docs[0].data();
      productoId = anyProd.docs[0].id;
      productoSku = pd.sku;
      productoNombre = pd.nombreComercial || pd.nombre;
      precioUnitario = pd.precioVenta || 59.90;
      console.log(`  Using product (no stock): ${productoNombre} (${productoSku})`);
    }
  }

  if (!productoId) {
    console.error('  ERROR: No products found at all. Cannot create test order.');
    process.exit(1);
  }

  // ============================================================
  // 3. Check cuentasCaja for mercado_pago
  // ============================================================
  separator('3. Checking cuentasCaja for mercado_pago');

  const mpCuentaSnap = await db.collection('cuentasCaja')
    .where('metodoPagoAsociado', '==', 'mercado_pago')
    .limit(1)
    .get();

  if (mpCuentaSnap.empty) {
    console.warn('  No cuentasCaja with metodoPagoAsociado=mercado_pago found.');
    console.warn('  The order processor will fall back to any active account, or payment may not register.');

    // Show what accounts exist
    const allCuentas = await db.collection('cuentasCaja').limit(5).get();
    console.log(`  Available cuentasCaja (first 5):`);
    for (const c of allCuentas.docs) {
      const cd = c.data();
      console.log(`    - ${c.id}: ${cd.nombre} | metodo=${cd.metodoPagoAsociado || 'N/A'} | activa=${cd.activa}`);
    }
  } else {
    const cuenta = mpCuentaSnap.docs[0];
    const cuentaData = cuenta.data();
    console.log(`  Found MercadoPago account: ${cuenta.id}`);
    console.log(`    nombre:   ${cuentaData.nombre}`);
    console.log(`    saldo:    S/ ${cuentaData.saldoActual}`);
    console.log(`    activa:   ${cuentaData.activa}`);
    console.log(`    defecto:  ${cuentaData.esCuentaPorDefecto}`);
  }

  // ============================================================
  // 4. Check mlConfig/settings
  // ============================================================
  separator('4. Checking mlConfig/settings');

  const configDoc = await db.collection('mlConfig').doc('settings').get();
  if (configDoc.exists) {
    const config = configDoc.data();
    console.log(`  connected:                  ${config.connected}`);
    console.log(`  autoCreateVentas:           ${config.autoCreateVentas}`);
    console.log(`  autoCreateClientes:         ${config.autoCreateClientes}`);
    console.log(`  defaultComisionPorcentaje:  ${config.defaultComisionPorcentaje}%`);
    console.log(`  userId:                     ${config.userId}`);
    console.log(`  nickname:                   ${config.nickname}`);
  } else {
    console.warn('  mlConfig/settings does not exist. Proceeding with defaults.');
  }

  // ============================================================
  // 5. Build and create the mlOrderSync document
  // ============================================================
  separator('5. Creating mlOrderSync document');

  const mlOrderId = generateMlOrderId();
  const mlBuyerId = generateMlBuyerId();
  const now = Timestamp.now();

  // Calculate realistic comision (ML charges ~13-16% typically)
  const comisionPorcentaje = configDoc.exists
    ? (configDoc.data().defaultComisionPorcentaje || 13)
    : 13;
  const cantidad = 1;
  const subtotal = precioUnitario * cantidad;
  const comisionML = Math.round(subtotal * comisionPorcentaje / 100 * 100) / 100;
  const costoEnvio = 0; // Free shipping is common in ML
  const costoEnvioCliente = 0;
  const totalML = subtotal;

  const orderSyncData = {
    // Core ML order data
    mlOrderId,
    mlStatus: 'paid',
    mlBuyerId,
    mlBuyerName: 'Juan Carlos Test Comprador',

    // ERP linking state
    ventaId: null,
    numeroVenta: null,
    clienteId: null,
    estado: 'pendiente',
    errorDetalle: null,

    // Financial
    totalML,
    comisionML,
    costoEnvioML: costoEnvio,
    costoEnvioCliente,

    // Dates
    fechaOrdenML: now,
    fechaProcesada: null,
    fechaSync: now,

    // Buyer extended data
    buyerEmail: 'juancarlos.test@gmail.com',
    buyerPhone: '51987654321',
    buyerDni: '76543210',
    direccionEntrega: 'Av. Javier Prado Este 1234, Dpto 501',
    distrito: 'San Isidro',
    provincia: 'Lima',
    coordenadas: { lat: -12.0907, lng: -76.9784 },

    // Shipping
    trackingNumber: null,
    shipmentStatus: 'ready_to_ship',

    // Product linking
    todosVinculados: true,
    productos: [
      {
        mlItemId: mlItemId,
        mlTitle: productoNombre || 'Producto Test ML',
        mlVariationId: null,
        cantidad,
        precioUnitario,
        saleFee: comisionML,
        productoId: productoId || null,
        productoSku: productoSku || null,
        productoNombre: productoNombre || null,
        vinculado: !!productoId,
      },
    ],
  };

  console.log('\n  Document to create:');
  console.log(`    mlOrderId:        ${orderSyncData.mlOrderId}`);
  console.log(`    mlBuyerName:      ${orderSyncData.mlBuyerName}`);
  console.log(`    estado:           ${orderSyncData.estado}`);
  console.log(`    todosVinculados:  ${orderSyncData.todosVinculados}`);
  console.log(`    totalML:          S/ ${orderSyncData.totalML}`);
  console.log(`    comisionML:       S/ ${orderSyncData.comisionML}`);
  console.log(`    productos:        ${orderSyncData.productos.length} item(s)`);
  console.log(`      [0] ${orderSyncData.productos[0].productoNombre} x${orderSyncData.productos[0].cantidad} @ S/ ${orderSyncData.productos[0].precioUnitario}`);
  console.log(`           mlItemId: ${orderSyncData.productos[0].mlItemId}`);
  console.log(`           vinculado: ${orderSyncData.productos[0].vinculado}`);

  // Write to Firestore
  const docRef = await db.collection('mlOrderSync').add(orderSyncData);

  separator('DONE');
  console.log(`  mlOrderSync document created successfully!`);
  console.log(`  Document ID: ${docRef.id}`);
  console.log(`  ML Order ID: ${mlOrderId}`);
  console.log(`\n  You can now process this order from the MercadoLibre UI`);
  console.log(`  or call: mercadoLibreService.procesarOrden("${docRef.id}")`);
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  console.error('\nFATAL ERROR:', err.message || err);
  console.error(err.stack || '');
  process.exit(1);
});
