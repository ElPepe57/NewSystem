/**
 * Seed: Flujo completo OC → Recepción USA → Transferencia → Recepción Perú
 *
 * Crea datos realistas para 6 productos de suplementos:
 * - 2 proveedores USA
 * - 1 almacén USA (viajero) + 1 almacén Perú
 * - 3 OC (recibidas en USA)
 * - Unidades en USA (recibida_origen) listas para transferir
 * - 1 transferencia en tránsito + 1 completada
 * - Complementa las 22 unidades existentes de Glucosamina con su OC
 *
 * Uso: node scripts/seed-full-flow.mjs
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(readFileSync(resolve(__dirname, '../serviceAccountKey.json'), 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;
const now = Timestamp.now();
const userId = 'seed-script';

// Admin SDK wrappers matching client SDK signatures: doc(db, collection, id)
function docRef(dbOrCollection, collectionOrId, maybeId) {
  // Support both doc(db, 'col', 'id') and doc('col', 'id')
  const col = maybeId ? collectionOrId : dbOrCollection;
  const id = maybeId || collectionOrId;
  return db.collection(col).doc(id);
}
async function setDocAdmin(ref, data, options) {
  if (options?.merge) return ref.set(data, { merge: true });
  return ref.set(data);
}
async function updateDocAdmin(ref, data) {
  return ref.update(data);
}
async function getDocAdmin(ref) {
  const snap = await ref.get();
  return { exists: () => snap.exists, data: () => snap.data() };
}

function daysFromNow(days) {
  return Timestamp.fromDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}
function daysAgo(days) {
  return Timestamp.fromDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
}

// ============================================
// PROVEEDORES
// ============================================
const proveedores = [
  {
    id: 'prv-iherb',
    codigo: 'PRV-001',
    nombre: 'iHerb Wholesale',
    tipo: 'distribuidor',
    url: 'https://www.iherb.com',
    contacto: 'Wholesale Team',
    email: 'wholesale@iherb.com',
    pais: 'USA',
    activo: true,
    creadoPor: userId,
    fechaCreacion: daysAgo(90),
  },
  {
    id: 'prv-vitacost',
    codigo: 'PRV-002',
    nombre: 'Vitacost / Kroger',
    tipo: 'mayorista',
    url: 'https://www.vitacost.com',
    contacto: 'B2B Sales',
    email: 'b2b@vitacost.com',
    pais: 'USA',
    activo: true,
    creadoPor: userId,
    fechaCreacion: daysAgo(60),
  },
];

// ============================================
// ALMACENES
// ============================================
const almacenes = [
  {
    id: 'alm-usa-viajero1',
    codigo: 'VIA-001',
    nombre: 'Jose Pinto - Viajero',
    pais: 'USA',
    tipo: 'viajero',
    estadoAlmacen: 'activo',
    direccion: '123 Main St, Salt Lake City, UT',
    ciudad: 'Salt Lake City',
    estado: 'UT',
    esViajero: true,
    frecuenciaViaje: 'mensual',
    costoPromedioFlete: 3.50,
    totalUnidadesRecibidas: 0,
    totalUnidadesEnviadas: 0,
    valorInventarioUSD: 0,
    tiempoPromedioAlmacenamiento: 0,
    creadoPor: userId,
    fechaCreacion: daysAgo(90),
  },
  {
    id: 'alm-peru-principal',
    codigo: 'ALM-PE-01',
    nombre: 'Almacén Lima Principal',
    pais: 'Peru',
    tipo: 'almacen_peru',
    estadoAlmacen: 'activo',
    direccion: 'Jr. Ica 3625, San Martín de Porres',
    ciudad: 'Lima',
    esViajero: false,
    totalUnidadesRecibidas: 0,
    totalUnidadesEnviadas: 0,
    valorInventarioUSD: 0,
    tiempoPromedioAlmacenamiento: 0,
    creadoPor: userId,
    fechaCreacion: daysAgo(90),
  },
];

// ============================================
// PRODUCTOS (5 nuevos + referencia al existente SUP-0001)
// ============================================
const productos = [
  {
    id: 'prod-omega3',
    sku: 'SUP-0002',
    marca: 'Nordic Naturals',
    nombreComercial: 'Ultimate Omega-3',
    presentacion: 'capsulas_blandas',
    dosaje: '1280 mg',
    contenido: '120 softgels',
    codigoUPC: '768990012341',
    estado: 'activo',
    paisOrigen: 'USA',
    ctruPromedio: 0,
    stockUSA: 0, stockPeru: 0, stockTransito: 0, stockReservado: 0, stockDisponible: 0,
    stockMinimo: 5, stockMaximo: 50,
    creadoPor: userId, fechaCreacion: daysAgo(30),
  },
  {
    id: 'prod-vitamind3',
    sku: 'SUP-0003',
    marca: 'NOW Foods',
    nombreComercial: 'Vitamina D3 5000 UI',
    presentacion: 'capsulas_blandas',
    dosaje: '5000 UI',
    contenido: '240 softgels',
    codigoUPC: '733739003706',
    estado: 'activo',
    paisOrigen: 'USA',
    ctruPromedio: 0,
    stockUSA: 0, stockPeru: 0, stockTransito: 0, stockReservado: 0, stockDisponible: 0,
    stockMinimo: 5, stockMaximo: 50,
    creadoPor: userId, fechaCreacion: daysAgo(30),
  },
  {
    id: 'prod-magnesio',
    sku: 'SUP-0004',
    marca: "Doctor's Best",
    nombreComercial: 'Magnesio Glicinato',
    presentacion: 'tabletas',
    dosaje: '200 mg',
    contenido: '240 tabletas',
    codigoUPC: '753950001893',
    estado: 'activo',
    paisOrigen: 'USA',
    ctruPromedio: 0,
    stockUSA: 0, stockPeru: 0, stockTransito: 0, stockReservado: 0, stockDisponible: 0,
    stockMinimo: 3, stockMaximo: 30,
    creadoPor: userId, fechaCreacion: daysAgo(25),
  },
  {
    id: 'prod-probiotico',
    sku: 'SUP-0005',
    marca: 'Garden of Life',
    nombreComercial: 'Dr. Formulated Probiotics 50B',
    presentacion: 'capsulas',
    dosaje: '50 Billion CFU',
    contenido: '30 cápsulas',
    codigoUPC: '658010118408',
    estado: 'activo',
    paisOrigen: 'USA',
    ctruPromedio: 0,
    stockUSA: 0, stockPeru: 0, stockTransito: 0, stockReservado: 0, stockDisponible: 0,
    stockMinimo: 3, stockMaximo: 20,
    creadoPor: userId, fechaCreacion: daysAgo(20),
  },
  {
    id: 'prod-colageno',
    sku: 'SUP-0006',
    marca: 'Vital Proteins',
    nombreComercial: 'Colágeno Peptides',
    presentacion: 'polvo',
    dosaje: '20g por porción',
    contenido: '680g',
    codigoUPC: '850005480006',
    estado: 'activo',
    paisOrigen: 'USA',
    ctruPromedio: 0,
    stockUSA: 0, stockPeru: 0, stockTransito: 0, stockReservado: 0, stockDisponible: 0,
    stockMinimo: 2, stockMaximo: 15,
    creadoPor: userId, fechaCreacion: daysAgo(15),
  },
];

// ============================================
// ORDENES DE COMPRA
// ============================================
const ordenesCompra = [
  // OC-001: iHerb — Omega3 + VitD3 (recibida en USA)
  {
    id: 'oc-seed-001',
    numeroOrden: 'OC-2026-010',
    proveedorId: 'prv-iherb',
    nombreProveedor: 'iHerb Wholesale',
    productos: [
      { productoId: 'prod-omega3', sku: 'SUP-0002', nombreComercial: 'Ultimate Omega-3', marca: 'Nordic Naturals', cantidad: 8, precioUnitarioUSD: 28.50, subtotalUSD: 228.00 },
      { productoId: 'prod-vitamind3', sku: 'SUP-0003', nombreComercial: 'Vitamina D3 5000 UI', marca: 'NOW Foods', cantidad: 10, precioUnitarioUSD: 12.00, subtotalUSD: 120.00 },
    ],
    subtotalUSD: 348.00,
    costoEnvioProveedorUSD: 15.00,
    totalUSD: 363.00,
    estado: 'recibida',
    estadoPago: 'pagada',
    tcCompra: 3.72,
    tcPago: 3.72,
    totalPEN: 1350.36,
    inventarioGenerado: true,
    unidadesGeneradas: [],
    almacenDestino: 'alm-usa-viajero1',
    nombreAlmacenDestino: 'Jose Pinto - Viajero',
    fechaCreacion: daysAgo(20),
    fechaEnviada: daysAgo(18),
    fechaRecibida: daysAgo(12),
    fechaPago: daysAgo(20),
    creadoPor: userId,
  },
  // OC-002: Vitacost — Magnesio + Probiótico (recibida en USA)
  {
    id: 'oc-seed-002',
    numeroOrden: 'OC-2026-011',
    proveedorId: 'prv-vitacost',
    nombreProveedor: 'Vitacost / Kroger',
    productos: [
      { productoId: 'prod-magnesio', sku: 'SUP-0004', nombreComercial: 'Magnesio Glicinato', marca: "Doctor's Best", cantidad: 6, precioUnitarioUSD: 18.00, subtotalUSD: 108.00 },
      { productoId: 'prod-probiotico', sku: 'SUP-0005', nombreComercial: 'Dr. Formulated Probiotics 50B', marca: 'Garden of Life', cantidad: 5, precioUnitarioUSD: 32.00, subtotalUSD: 160.00 },
    ],
    subtotalUSD: 268.00,
    costoEnvioProveedorUSD: 0,
    totalUSD: 268.00,
    estado: 'recibida',
    estadoPago: 'pagada',
    tcCompra: 3.73,
    tcPago: 3.73,
    totalPEN: 999.64,
    inventarioGenerado: true,
    unidadesGeneradas: [],
    almacenDestino: 'alm-usa-viajero1',
    nombreAlmacenDestino: 'Jose Pinto - Viajero',
    fechaCreacion: daysAgo(15),
    fechaEnviada: daysAgo(14),
    fechaRecibida: daysAgo(8),
    fechaPago: daysAgo(15),
    creadoPor: userId,
  },
  // OC-003: iHerb — Colágeno (recibida en USA)
  {
    id: 'oc-seed-003',
    numeroOrden: 'OC-2026-012',
    proveedorId: 'prv-iherb',
    nombreProveedor: 'iHerb Wholesale',
    productos: [
      { productoId: 'prod-colageno', sku: 'SUP-0006', nombreComercial: 'Colágeno Peptides', marca: 'Vital Proteins', cantidad: 4, precioUnitarioUSD: 38.00, subtotalUSD: 152.00 },
    ],
    subtotalUSD: 152.00,
    costoEnvioProveedorUSD: 8.00,
    totalUSD: 160.00,
    estado: 'recibida',
    estadoPago: 'pagada',
    tcCompra: 3.74,
    tcPago: 3.74,
    totalPEN: 598.40,
    inventarioGenerado: true,
    unidadesGeneradas: [],
    almacenDestino: 'alm-usa-viajero1',
    nombreAlmacenDestino: 'Jose Pinto - Viajero',
    fechaCreacion: daysAgo(10),
    fechaEnviada: daysAgo(9),
    fechaRecibida: daysAgo(5),
    fechaPago: daysAgo(10),
    creadoPor: userId,
  },
];

// ============================================
// UNIDADES — Todas en USA (recibida_origen), listas para transferir
// ============================================
function crearUnidades() {
  const unidades = [];
  let idx = 100;

  // OC-001: 8 Omega3 + 10 VitD3
  for (let i = 0; i < 8; i++) {
    unidades.push({
      id: `unit-seed-${++idx}`,
      productoId: 'prod-omega3', productoSKU: 'SUP-0002', productoNombre: 'Ultimate Omega-3',
      lote: 'LOT-NOR-2026A', fechaVencimiento: daysFromNow(540),
      almacenId: 'alm-usa-viajero1', almacenNombre: 'Jose Pinto - Viajero', pais: 'USA',
      estado: 'recibida_origen', costoUnitarioUSD: 28.50, tcCompra: 3.72, tcPago: 3.72,
      ordenCompraId: 'oc-seed-001', ordenCompraNumero: 'OC-2026-010',
      fechaRecepcion: daysAgo(12),
      movimientos: [{ tipo: 'recepcion', fecha: daysAgo(12), descripcion: 'Recibido en USA via iHerb' }],
      creadoPor: userId, fechaCreacion: daysAgo(12),
    });
  }
  for (let i = 0; i < 10; i++) {
    unidades.push({
      id: `unit-seed-${++idx}`,
      productoId: 'prod-vitamind3', productoSKU: 'SUP-0003', productoNombre: 'Vitamina D3 5000 UI',
      lote: 'LOT-NOW-2026B', fechaVencimiento: daysFromNow(720),
      almacenId: 'alm-usa-viajero1', almacenNombre: 'Jose Pinto - Viajero', pais: 'USA',
      estado: 'recibida_origen', costoUnitarioUSD: 12.00, tcCompra: 3.72, tcPago: 3.72,
      ordenCompraId: 'oc-seed-001', ordenCompraNumero: 'OC-2026-010',
      fechaRecepcion: daysAgo(12),
      movimientos: [{ tipo: 'recepcion', fecha: daysAgo(12), descripcion: 'Recibido en USA via iHerb' }],
      creadoPor: userId, fechaCreacion: daysAgo(12),
    });
  }

  // OC-002: 6 Magnesio + 5 Probiótico
  for (let i = 0; i < 6; i++) {
    unidades.push({
      id: `unit-seed-${++idx}`,
      productoId: 'prod-magnesio', productoSKU: 'SUP-0004', productoNombre: 'Magnesio Glicinato',
      lote: 'LOT-DB-2026C', fechaVencimiento: daysFromNow(600),
      almacenId: 'alm-usa-viajero1', almacenNombre: 'Jose Pinto - Viajero', pais: 'USA',
      estado: 'recibida_origen', costoUnitarioUSD: 18.00, tcCompra: 3.73, tcPago: 3.73,
      ordenCompraId: 'oc-seed-002', ordenCompraNumero: 'OC-2026-011',
      fechaRecepcion: daysAgo(8),
      movimientos: [{ tipo: 'recepcion', fecha: daysAgo(8), descripcion: 'Recibido en USA via Vitacost' }],
      creadoPor: userId, fechaCreacion: daysAgo(8),
    });
  }
  for (let i = 0; i < 5; i++) {
    unidades.push({
      id: `unit-seed-${++idx}`,
      productoId: 'prod-probiotico', productoSKU: 'SUP-0005', productoNombre: 'Dr. Formulated Probiotics 50B',
      lote: 'LOT-GOL-2026D', fechaVencimiento: daysFromNow(270),
      almacenId: 'alm-usa-viajero1', almacenNombre: 'Jose Pinto - Viajero', pais: 'USA',
      estado: 'recibida_origen', costoUnitarioUSD: 32.00, tcCompra: 3.73, tcPago: 3.73,
      ordenCompraId: 'oc-seed-002', ordenCompraNumero: 'OC-2026-011',
      fechaRecepcion: daysAgo(8),
      movimientos: [{ tipo: 'recepcion', fecha: daysAgo(8), descripcion: 'Recibido en USA via Vitacost' }],
      creadoPor: userId, fechaCreacion: daysAgo(8),
    });
  }

  // OC-003: 4 Colágeno
  for (let i = 0; i < 4; i++) {
    unidades.push({
      id: `unit-seed-${++idx}`,
      productoId: 'prod-colageno', productoSKU: 'SUP-0006', productoNombre: 'Colágeno Peptides',
      lote: 'LOT-VP-2026E', fechaVencimiento: daysFromNow(450),
      almacenId: 'alm-usa-viajero1', almacenNombre: 'Jose Pinto - Viajero', pais: 'USA',
      estado: 'recibida_origen', costoUnitarioUSD: 38.00, tcCompra: 3.74, tcPago: 3.74,
      ordenCompraId: 'oc-seed-003', ordenCompraNumero: 'OC-2026-012',
      fechaRecepcion: daysAgo(5),
      movimientos: [{ tipo: 'recepcion', fecha: daysAgo(5), descripcion: 'Recibido en USA via iHerb' }],
      creadoPor: userId, fechaCreacion: daysAgo(5),
    });
  }

  return unidades;
}

// ============================================
// TRANSFERENCIAS
// ============================================

// TRF-001: 5 VitD3 + 3 Omega3 — EN TRÁNSITO (salió hace 3 días)
const transferencia1UnidadesIds = [];
function getTransferencia1() {
  const unidades = [];
  // 5 VitD3 (unit-seed-109 a 113) y 3 Omega3 (unit-seed-101 a 103)
  for (let i = 109; i <= 113; i++) {
    const uid = `unit-seed-${i}`;
    transferencia1UnidadesIds.push(uid);
    unidades.push({
      unidadId: uid,
      productoId: 'prod-vitamind3', sku: 'SUP-0003', codigoUnidad: uid,
      lote: 'LOT-NOW-2026B', costoFleteUSD: 3.50, estadoTransferencia: 'en_transito',
    });
  }
  for (let i = 101; i <= 103; i++) {
    const uid = `unit-seed-${i}`;
    transferencia1UnidadesIds.push(uid);
    unidades.push({
      unidadId: uid,
      productoId: 'prod-omega3', sku: 'SUP-0002', codigoUnidad: uid,
      lote: 'LOT-NOR-2026A', costoFleteUSD: 3.50, estadoTransferencia: 'en_transito',
    });
  }

  return {
    id: 'trf-seed-001',
    numeroTransferencia: 'ENV-2026-005',
    tipo: 'internacional_peru',
    estado: 'en_transito',
    almacenOrigenId: 'alm-usa-viajero1',
    almacenOrigenNombre: 'Jose Pinto - Viajero',
    almacenOrigenCodigo: 'VIA-001',
    almacenDestinoId: 'alm-peru-principal',
    almacenDestinoNombre: 'Almacén Lima Principal',
    almacenDestinoCodigo: 'ALM-PE-01',
    unidades,
    totalUnidades: 8,
    productosSummary: [
      { productoId: 'prod-vitamind3', sku: 'SUP-0003', nombre: 'Vitamina D3 5000 UI', cantidad: 5 },
      { productoId: 'prod-omega3', sku: 'SUP-0002', nombre: 'Ultimate Omega-3', cantidad: 3 },
    ],
    costoFleteTotal: 28.00,
    monedaFlete: 'USD',
    viajeroNombre: 'Jose Pinto',
    courier: 'Equipaje personal',
    fechaCreacion: daysAgo(5),
    fechaPreparacion: daysAgo(4),
    fechaSalida: daysAgo(3),
    fechaLlegadaEstimada: daysFromNow(2),
    creadoPor: userId,
  };
}

// ============================================
// MAIN
// ============================================
async function seed() {
  console.log('Sembrando datos de flujo completo...\n');

  // 1. Proveedores
  for (const p of proveedores) {
    const { id, ...data } = p;
    await setDocAdmin(docRef('proveedores', id), data);
    console.log(`  Proveedor: ${p.nombre}`);
  }

  // 2. Almacenes (verificar si ya existen)
  for (const a of almacenes) {
    const { id, ...data } = a;
    const existing = await getDocAdmin(docRef('almacenes', id));
    if (!existing.exists()) {
      await setDocAdmin(docRef('almacenes', id), data);
      console.log(`  Almacen creado: ${a.nombre}`);
    } else {
      console.log(`  Almacen ya existe: ${a.nombre}`);
    }
  }

  // 3. Productos
  for (const p of productos) {
    const { id, ...data } = p;
    const existing = await getDocAdmin(docRef('productos', id));
    if (!existing.exists()) {
      await setDocAdmin(docRef('productos', id), data);
      console.log(`  Producto: ${p.sku} ${p.nombreComercial}`);
    } else {
      console.log(`  Producto ya existe: ${p.sku}`);
    }
  }

  // 4. OC
  for (const oc of ordenesCompra) {
    const { id, ...data } = oc;
    await setDocAdmin(docRef('ordenesCompra', id), data);
    console.log(`  OC: ${oc.numeroOrden} — ${oc.nombreProveedor}`);
  }

  // 5. Unidades
  const unidades = crearUnidades();
  const unitIds = { 'oc-seed-001': [], 'oc-seed-002': [], 'oc-seed-003': [] };

  for (const u of unidades) {
    const { id, ...data } = u;
    await setDocAdmin(docRef('unidades', id), data);
    unitIds[u.ordenCompraId]?.push(id);
  }
  console.log(`  ${unidades.length} unidades creadas`);

  // Actualizar OC con IDs de unidades generadas
  for (const [ocId, ids] of Object.entries(unitIds)) {
    if (ids.length > 0) {
      await updateDocAdmin(docRef('ordenesCompra', ocId), { unidadesGeneradas: ids });
    }
  }

  // 6. Transferencia en tránsito
  const trf1 = getTransferencia1();
  const { id: trfId, ...trfData } = trf1;
  await setDocAdmin(docRef('transferencias', trfId), trfData);
  console.log(`  Transferencia: ${trf1.numeroTransferencia} (en_transito, ${trf1.totalUnidades} uds)`);

  // Actualizar estado de unidades en transferencia a en_transito_peru
  for (const uid of transferencia1UnidadesIds) {
    await updateDocAdmin(docRef('unidades', uid), {
      estado: 'en_transito_peru',
      movimientos: [
        { tipo: 'recepcion', fecha: daysAgo(12), descripcion: 'Recibido en USA' },
        { tipo: 'transferencia', fecha: daysAgo(3), descripcion: 'En tránsito a Perú via Jose Pinto' },
      ],
    });
  }
  console.log(`  ${transferencia1UnidadesIds.length} unidades actualizadas a en_transito_peru`);

  // 7. Actualizar stocks de productos
  const stockUpdates = {
    'prod-omega3': { stockUSA: 5, stockTransito: 3, stockDisponible: 5 },
    'prod-vitamind3': { stockUSA: 5, stockTransito: 5, stockDisponible: 5 },
    'prod-magnesio': { stockUSA: 6, stockDisponible: 6 },
    'prod-probiotico': { stockUSA: 5, stockDisponible: 5 },
    'prod-colageno': { stockUSA: 4, stockDisponible: 4 },
  };

  for (const [prodId, stocks] of Object.entries(stockUpdates)) {
    await updateDocAdmin(docRef('productos', prodId), stocks);
  }
  console.log(`  Stocks actualizados`);

  // 8. Actualizar contadores de secuencia
  await setDocAdmin(docRef('contadores', 'OC-2026'), { current: 12 }, { merge: true });
  await setDocAdmin(docRef('contadores', 'ENV-2026'), { current: 5 }, { merge: true });

  console.log('\n=== RESUMEN ===');
  console.log(`Proveedores: ${proveedores.length}`);
  console.log(`Almacenes: ${almacenes.length}`);
  console.log(`Productos nuevos: ${productos.length}`);
  console.log(`OC: ${ordenesCompra.length}`);
  console.log(`Unidades: ${unidades.length} (${unidades.length - transferencia1UnidadesIds.length} en USA + ${transferencia1UnidadesIds.length} en transito)`);
  console.log(`Transferencias: 1 (en_transito)`);
  console.log('\nProductos en USA listos para transferir:');
  console.log('  - 5x Omega-3 (SUP-0002) @ $28.50');
  console.log('  - 5x Vitamina D3 (SUP-0003) @ $12.00');
  console.log('  - 6x Magnesio (SUP-0004) @ $18.00');
  console.log('  - 5x Probiotico (SUP-0005) @ $32.00');
  console.log('  - 4x Colageno (SUP-0006) @ $38.00');
  console.log('\nEn transito a Peru:');
  console.log('  - 3x Omega-3 + 5x Vitamina D3 (ENV-2026-005)');
  console.log('\nDone!');
  process.exit(0);
}

seed().catch(err => { console.error('Error:', err); process.exit(1); });
