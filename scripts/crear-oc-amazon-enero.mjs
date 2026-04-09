/**
 * Crea OC Amazon (Berberina, Magnesio, Omega 3, etc) + Transferencia Viajero + Unidades.
 *
 * Flujo:
 * 1. OC Amazon → almacén destino: Angie Price (VIA-002 USA)
 *    - 7 SKUs, 16 unidades, subtotal $315.55
 *    - Descuento $30.31, Impuesto 3% ($8.56), Total $293.80
 *    - TC venta 13-ene-2026: 3.368
 * 2. Transferencia VIA-002 → ALM-PE-01 (Almacén Lima Principal)
 *    - Flete Angie: $80 total ($5 × 16 unidades)
 *    - Fecha salida: 15-ene-2026
 *    - Fecha llegada: 16-ene-2026
 * 3. Unidades: 16 en estado disponible_peru con historial completo de movimientos
 *    - CTRU = (costoBase + impuesto_prorrateado − descuento_prorrateado + flete_viajero) × TC
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = process.argv.includes('--dry-run');

// ========== DATOS DE LA OC ==========
const PROVEEDOR_ID = 'a6GCKMQt6vCbvcOsrTQM'; // Amazon
const PROVEEDOR_NOMBRE = 'Amazon';
const PROVEEDOR_PAIS = 'USA';

const ALMACEN_ANGIE_ID = 'KJ517wENHMAiNdOJXnU0'; // VIA-002 Angie Price
const ALMACEN_ANGIE_NOMBRE = 'Angie Price';
const ALMACEN_LIMA_ID = 'alm-peru-principal';    // ALM-PE-01 Almacén Lima Principal
const ALMACEN_LIMA_NOMBRE = 'Almacén Lima Principal';

const FECHA_COMPRA = new Date('2026-01-13T12:00:00-05:00'); // 13-ene-2026
const FECHA_RECEPCION_ANGIE = new Date('2026-01-14T12:00:00-05:00'); // 14-ene
const FECHA_SALIDA_TRF = new Date('2026-01-15T12:00:00-05:00'); // 15-ene
const FECHA_LLEGADA_LIMA = new Date('2026-01-16T12:00:00-05:00'); // 16-ene

const TC_VENTA = 3.368;
const DESCUENTO_USD = 30.31;
const IMPUESTO_USD = 8.56; // 3% sobre subtotal con descuento
const FLETE_POR_UNIDAD_USD = 5.00;

// Productos: SUP-0117, SUP-0122, SUP-0062, SUP-0051, SUP-0025, SUP-0059, SUP-0116
const PRODUCTOS_OC = [
  { sku: 'SUP-0117', productoId: 'x2PZdgiMDsum9EL3zdVw', marca: 'Carlyle', nombre: 'Berberina', pres: 'Cápsulas', dosaje: '500000 mcg', contenido: '60', costoUnitario: 9.89, cantidad: 2 },
  { sku: 'SUP-0122', productoId: 'zvgeNdMI7J0Qd6na0FzG', marca: 'Double Wood', nombre: 'Magnesio Glicinato', pres: 'Cápsulas', dosaje: '400 mg', contenido: '180', costoUnitario: 16.95, cantidad: 3 },
  { sku: 'SUP-0062', productoId: 'YkrUxQlBTzmsB1MQP2nf', marca: 'Sports Research', nombre: 'Alaska Omega 3', pres: 'Cápsulas Blandas', dosaje: '1040 mg', contenido: '90', costoUnitario: 27.95, cantidad: 3 },
  { sku: 'SUP-0051', productoId: 'T1jSnECR6ZJEWRZnvJSu', marca: 'Horbaach', nombre: 'Melena de León', pres: 'Cápsulas', dosaje: '4200 mg', contenido: '120', costoUnitario: 17.99, cantidad: 2 },
  { sku: 'SUP-0025', productoId: 'Hc6nsorCzjmBoa2Rctgw', marca: 'Solaray', nombre: 'Magnesio Glicinato', pres: 'Cápsulas Vegetales', dosaje: '350 mg', contenido: '275', costoUnitario: 23.62, cantidad: 1 },
  { sku: 'SUP-0059', productoId: 'XZPxa1RqYMJA6zvo7Jb5', marca: 'Wellness Labs RX', nombre: 'NAD + Resveratrol', pres: 'Cápsulas', dosaje: '300 mg + 1200 mg', contenido: '90', costoUnitario: 17.445, cantidad: 4 }, // pack de 2, 2 packs
  { sku: 'SUP-0116', productoId: 'wvujLliOFs2nVCXuXrs9', marca: 'Life Extension', nombre: 'CoQ10', pres: 'Cápsulas Blandas', dosaje: '100 mg', contenido: '60', costoUnitario: 31.69, cantidad: 1 },
];

const subtotalUSD = PRODUCTOS_OC.reduce((s, p) => s + p.costoUnitario * p.cantidad, 0);
const totalUnidades = PRODUCTOS_OC.reduce((s, p) => s + p.cantidad, 0);
const subtotalConDescuento = subtotalUSD - DESCUENTO_USD;
const totalUSD = subtotalConDescuento + IMPUESTO_USD;
const fleteViajeroTotal = FLETE_POR_UNIDAD_USD * totalUnidades;

console.log('=== RESUMEN OC AMAZON ===');
console.log('Subtotal bruto: $' + subtotalUSD.toFixed(2));
console.log('Descuento: -$' + DESCUENTO_USD.toFixed(2));
console.log('Subtotal con descuento: $' + subtotalConDescuento.toFixed(2));
console.log('Impuesto (3%): +$' + IMPUESTO_USD.toFixed(2));
console.log('Total OC USD: $' + totalUSD.toFixed(2));
console.log('TC venta: ' + TC_VENTA);
console.log('Total OC PEN: S/' + (totalUSD * TC_VENTA).toFixed(2));
console.log('Unidades: ' + totalUnidades);
console.log('');
console.log('=== TRANSFERENCIA ===');
console.log('Flete viajero: $' + fleteViajeroTotal.toFixed(2) + ' ($' + FLETE_POR_UNIDAD_USD + ' x ' + totalUnidades + ' unidades)');
console.log('Flete PEN: S/' + (fleteViajeroTotal * TC_VENTA).toFixed(2));
console.log('');
console.log('Modo:', DRY_RUN ? 'DRY RUN' : 'PRODUCCION');
console.log('');

async function getNextCounter(prefix) {
  const counterRef = db.collection('contadores').doc(prefix);
  const doc = await counterRef.get();
  const current = doc.exists ? (doc.data().current || 0) : 0;
  const next = current + 1;
  if (!DRY_RUN) {
    await counterRef.set({ current: next, updatedAt: new Date() });
  }
  return next;
}

async function main() {
  // ========== PASO 1: Crear la OC ==========
  console.log('== PASO 1: Crear OC Amazon ==');

  const ocNumero = await getNextCounter('OC-2026');
  const numeroOrden = `OC-2026-${ocNumero.toString().padStart(3, '0')}`;

  const productosOC = PRODUCTOS_OC.map(p => ({
    productoId: p.productoId,
    sku: p.sku,
    marca: p.marca,
    nombreComercial: p.nombre,
    presentacion: p.pres,
    dosaje: p.dosaje,
    contenido: p.contenido,
    cantidad: p.cantidad,
    costoUnitario: p.costoUnitario,
    subtotal: p.cantidad * p.costoUnitario,
    cantidadRecibida: p.cantidad,
  }));

  // Linea de negocio SUP
  const lineaSUP = await db.collection('lineasNegocio').where('codigo', '==', 'SUP').get();
  const lineaNegocioId = !lineaSUP.empty ? lineaSUP.docs[0].id : null;
  const lineaNegocioNombre = !lineaSUP.empty ? lineaSUP.docs[0].data().nombre : 'Suplementos y Vitaminas';

  const oc = {
    numeroOrden,
    proveedorId: PROVEEDOR_ID,
    proveedorNombre: PROVEEDOR_NOMBRE,
    paisOrigen: PROVEEDOR_PAIS,
    productos: productosOC,
    subtotalUSD,
    impuestoCompraUSD: IMPUESTO_USD,
    descuentoUSD: DESCUENTO_USD,
    costoEnvioProveedorUSD: 0,
    totalUSD,
    tcCompra: TC_VENTA,
    modoEntrega: 'viajero',
    fleteIncluidoEnPrecio: false,
    almacenDestino: ALMACEN_ANGIE_ID,
    estado: 'recibida',
    estadoPago: 'pendiente',
    lineaNegocioId,
    lineaNegocioNombre,
    fechaCreacion: Timestamp.fromDate(FECHA_COMPRA),
    fechaCompra: Timestamp.fromDate(FECHA_COMPRA),
    fechaRecepcion: Timestamp.fromDate(FECHA_RECEPCION_ANGIE),
    observaciones: 'Compra en Amazon (Berberina Carlyle, Double Wood, Sports Research, Horbaach, Solaray, Wellness NAD pack 2x2, Life Extension CoQ10). Descuento $30.31 aplicado por Amazon antes de impuesto. Recibido por viajera Angie Price el 14-ene-2026.',
    creadoPor: 'system',
  };

  let ocId;
  if (DRY_RUN) {
    ocId = '[DRY_RUN_OC_ID]';
    console.log('  [DRY RUN] Crearia OC:', numeroOrden);
  } else {
    const ocRef = await db.collection('ordenesCompra').add(oc);
    ocId = ocRef.id;
    console.log('  Creada:', numeroOrden, '| ID:', ocId);
  }

  // ========== PASO 2: Calcular CTRU y crear unidades ==========
  console.log('\n== PASO 2: Crear 16 unidades ==');

  const costoBaseTotal = subtotalUSD;
  const impuestoPorUnidad = IMPUESTO_USD / totalUnidades;
  const unidadIds = [];
  const unidadesMap = []; // para armar productosSummary y transferencia
  let contador = 0;

  for (const p of PRODUCTOS_OC) {
    // Prorrateo del descuento por valor (proporcional al costo unitario)
    const descuentoProporcional = costoBaseTotal > 0 ? DESCUENTO_USD * (p.costoUnitario / costoBaseTotal) : 0;
    // Costo unitario neto de la OC (base + impuesto − descuento)
    const costoUnitarioOC = p.costoUnitario + impuestoPorUnidad - descuentoProporcional;
    // Más flete del viajero (tarifa fija $5 por unidad)
    const costoUnitarioReal = costoUnitarioOC + FLETE_POR_UNIDAD_USD;
    const costoUnitarioPEN = costoUnitarioReal * TC_VENTA;

    console.log(`  ${p.sku} | $${p.costoUnitario} + imp ${impuestoPorUnidad.toFixed(3)} − desc ${descuentoProporcional.toFixed(3)} + flete ${FLETE_POR_UNIDAD_USD} = $${costoUnitarioReal.toFixed(4)} → S/${costoUnitarioPEN.toFixed(2)}`);

    for (let i = 0; i < p.cantidad; i++) {
      contador++;
      const unidad = {
        productoId: p.productoId,
        sku: p.sku,
        productoSKU: p.sku,
        marca: p.marca,
        nombreComercial: p.nombre,
        productoNombre: p.nombre,
        presentacion: p.pres,
        lote: `OC-${numeroOrden}`,
        estado: 'disponible_peru',
        almacenId: ALMACEN_LIMA_ID,
        almacenNombre: ALMACEN_LIMA_NOMBRE,
        pais: 'Peru',
        paisOrigen: 'USA',
        costoUnitarioUSD: costoUnitarioReal,
        costoUnitarioPEN,
        ctruInicial: costoUnitarioPEN,
        ctruContable: costoUnitarioPEN,
        costoBaseUSD: p.costoUnitario,
        costoImpuestoUSD: impuestoPorUnidad,
        descuentoUSD: descuentoProporcional,
        costoFleteUSD: FLETE_POR_UNIDAD_USD,
        costoRecojoPEN: 0,
        ordenCompraId: ocId,
        ordenCompraNumero: numeroOrden,
        proveedorId: PROVEEDOR_ID,
        proveedorNombre: PROVEEDOR_NOMBRE,
        tcCompra: TC_VENTA,
        fechaIngreso: Timestamp.fromDate(FECHA_COMPRA),
        fechaRecepcion: Timestamp.fromDate(FECHA_LLEGADA_LIMA),
        fechaVencimiento: Timestamp.fromDate(new Date(FECHA_LLEGADA_LIMA.getTime() + 730 * 24 * 60 * 60 * 1000)),
        movimientos: [
          {
            tipo: 'recepcion_oc',
            fecha: Timestamp.fromDate(FECHA_RECEPCION_ANGIE),
            almacenDestino: ALMACEN_ANGIE_ID,
            estadoAnterior: null,
            estadoNuevo: 'recibida_origen',
            notas: `Recibida por viajera ${ALMACEN_ANGIE_NOMBRE} vía OC ${numeroOrden}`,
          },
          {
            tipo: 'envio_transferencia',
            fecha: Timestamp.fromDate(FECHA_SALIDA_TRF),
            almacenOrigen: ALMACEN_ANGIE_ID,
            almacenDestino: ALMACEN_LIMA_ID,
            estadoAnterior: 'recibida_origen',
            estadoNuevo: 'en_transito_peru',
            notas: `Enviada a Perú por viajera ${ALMACEN_ANGIE_NOMBRE}`,
          },
          {
            tipo: 'recepcion_peru',
            fecha: Timestamp.fromDate(FECHA_LLEGADA_LIMA),
            almacenDestino: ALMACEN_LIMA_ID,
            estadoAnterior: 'en_transito_peru',
            estadoNuevo: 'disponible_peru',
            notas: `Recibida en ${ALMACEN_LIMA_NOMBRE}`,
          },
        ],
        creadoPor: 'system',
        fechaCreacion: Timestamp.fromDate(FECHA_COMPRA),
      };

      let unidadId;
      if (DRY_RUN) {
        unidadId = `[DRY_${contador}]`;
      } else {
        const uref = await db.collection('unidades').add(unidad);
        unidadId = uref.id;
      }
      unidadIds.push(unidadId);
      unidadesMap.push({
        unidadId,
        productoId: p.productoId,
        sku: p.sku,
        marca: p.marca,
        nombreComercial: p.nombre,
        estado: 'recibida',
        costoFleteUSD: FLETE_POR_UNIDAD_USD,
        lote: `OC-${numeroOrden}`,
      });
    }
  }
  console.log(`  Total unidades ${DRY_RUN ? 'a crear' : 'creadas'}: ${contador}`);

  // ========== PASO 3: Crear Transferencia Angie → Lima ==========
  console.log('\n== PASO 3: Crear Transferencia VIA-002 → ALM-PE-01 ==');

  const trfNumero = await getNextCounter('TRF-2026');
  const numeroTransferencia = `TRF-2026-${trfNumero.toString().padStart(3, '0')}`;

  // Construir productosSummary (agrupado por producto)
  const resumenMap = new Map();
  for (const u of unidadesMap) {
    const existing = resumenMap.get(u.productoId);
    if (existing) {
      existing.cantidad++;
    } else {
      const prod = PRODUCTOS_OC.find(p => p.productoId === u.productoId);
      resumenMap.set(u.productoId, {
        productoId: u.productoId,
        sku: u.sku,
        marca: u.marca,
        nombre: u.nombreComercial,
        cantidad: 1,
        costoTotalUSD: (prod?.costoUnitario || 0) * 1, // se ajusta abajo
      });
    }
  }
  // Corregir costoTotalUSD con la cantidad final
  for (const resumen of resumenMap.values()) {
    const prod = PRODUCTOS_OC.find(p => p.productoId === resumen.productoId);
    resumen.costoTotalUSD = (prod?.costoUnitario || 0) * resumen.cantidad;
  }
  const productosSummary = Array.from(resumenMap.values());

  const diasEnTransito = Math.round((FECHA_LLEGADA_LIMA - FECHA_SALIDA_TRF) / (1000 * 60 * 60 * 24));

  const transferencia = {
    numeroTransferencia,
    tipo: 'internacional_peru',
    estado: 'recibida_completa',
    almacenOrigenId: ALMACEN_ANGIE_ID,
    almacenOrigenNombre: ALMACEN_ANGIE_NOMBRE,
    almacenDestinoId: ALMACEN_LIMA_ID,
    almacenDestinoNombre: ALMACEN_LIMA_NOMBRE,
    unidades: unidadesMap,
    productosSummary,
    totalUnidades: contador,
    totalUnidadesRecibidas: contador,
    totalUnidadesFaltantes: 0,
    viajeroId: ALMACEN_ANGIE_ID,
    viajeroNombre: ALMACEN_ANGIE_NOMBRE,
    costoFleteTotal: fleteViajeroTotal,
    costoFletePorUnidad: FLETE_POR_UNIDAD_USD,
    monedaFlete: 'USD',
    tcFlete: TC_VENTA,
    costoFleteTotalPEN: fleteViajeroTotal * TC_VENTA,
    fechaSalida: Timestamp.fromDate(FECHA_SALIDA_TRF),
    fechaLlegadaEstimada: Timestamp.fromDate(FECHA_LLEGADA_LIMA),
    fechaLlegadaReal: Timestamp.fromDate(FECHA_LLEGADA_LIMA),
    diasEnTransito,
    ordenCompraId: ocId,
    ordenCompraNumero: numeroOrden,
    lineaNegocioId,
    lineaNegocioNombre,
    observaciones: `Transferencia vinculada a OC ${numeroOrden}. Viajera: Angie Price. Flete $5 × ${contador} unidades = $${fleteViajeroTotal.toFixed(2)}.`,
    creadoPor: 'system',
    fechaCreacion: Timestamp.fromDate(FECHA_SALIDA_TRF),
  };

  if (DRY_RUN) {
    console.log('  [DRY RUN] Crearia transferencia:', numeroTransferencia);
  } else {
    const trfRef = await db.collection('transferencias').add(transferencia);
    console.log('  Creada:', numeroTransferencia, '| ID:', trfRef.id);
  }
  console.log('  Dias en transito:', diasEnTransito);

  // ========== RESUMEN FINAL ==========
  console.log('\n========================================');
  console.log('  COMPLETADO');
  console.log(`  OC: ${numeroOrden} - $${totalUSD.toFixed(2)} USD (S/${(totalUSD * TC_VENTA).toFixed(2)})`);
  console.log(`  Transferencia: ${numeroTransferencia} - Flete $${fleteViajeroTotal.toFixed(2)}`);
  console.log(`  Unidades: ${contador} en ${ALMACEN_LIMA_NOMBRE}`);
  console.log(`  CTRU total invertido: $${(totalUSD + fleteViajeroTotal).toFixed(2)} (S/${((totalUSD + fleteViajeroTotal) * TC_VENTA).toFixed(2)})`);
  console.log('========================================\n');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
