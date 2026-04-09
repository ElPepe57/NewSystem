/**
 * Crea OC DDP de Asian Beauty Wholesale (China) + Transferencia internacional + Unidades en Perú.
 *
 * Flujo:
 * 1. Crear almacén virtual "Asian Beauty Wholesale (China)" tipo almacen_origen
 * 2. Crear OC con modoEntrega: envio_directo, almacenDestino: almacén virtual China
 * 3. Crear 29 unidades en estado recibida_origen (en China)
 * 4. Crear Transferencia internacional: China → ALM-PE-001 con DHL
 * 5. Marcar transferencia como recibida y pasar unidades a disponible_peru
 *
 * Fechas: compra 28-dic-2025, llegada 14-mar-2026
 * Total: $260.78 productos + $83 flete = $343.78 USD · TC 3.370
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = process.argv.includes('--dry-run');

// ========== DATOS DE LA OC ==========
const PROVEEDOR_ID = '9XFUx4SRiZXPFcakn1zB'; // Asian Beauty Wholesale
const PROVEEDOR_NOMBRE = 'Asian Beauty Wholesale';
const PROVEEDOR_PAIS = 'China';
const PROVEEDOR_CODIGO = 'PRV-026';

const ALMACEN_PERU_ID = 'E0YWnoD1a5vdoAbMrg7Y'; // ALM-PE-001 Jose Luis Pinto Toscano
const ALMACEN_PERU_NOMBRE = 'Jose Luis Pinto Toscano';

const FECHA_COMPRA = new Date('2025-12-28T12:00:00-05:00'); // 28-dic-2025
const FECHA_SALIDA = new Date('2025-12-30T12:00:00+08:00'); // 30-dic-2025 salida estimada
const FECHA_LLEGADA = new Date('2026-03-14T12:00:00-05:00'); // 14-mar-2026

const TC_COMPRA = 3.370;
const COSTO_ENVIO_USD = 83.00;

// Productos: [SKU, productoId, marca, nombre, atributos, presentacion, costoUnitario, cantidad, pesoLibras_gramos]
const PRODUCTOS_OC = [
  { sku: 'SKC-0009', productoId: '6qebnkHKPNW8U69YojTo', marca: 'Anua', nombre: 'Azelaic Acid 10 Hyaluron Redness Soothing Serum', pres: 'Serum', costoUnitario: 10.08, cantidad: 1 },
  { sku: 'SKC-0010', productoId: 'p75kJIU2rvSXWZIx3Dra', marca: 'Anua', nombre: 'Niacinamide 10 TXA 4 Serum', pres: 'Serum', costoUnitario: 10.08, cantidad: 1 },
  { sku: 'SKC-0011', productoId: '38lkGgOY1iyrSeIPjfKC', marca: 'Medicube', nombre: 'Deep Vita C Capsule Cream', pres: 'Crema', costoUnitario: 12.25, cantidad: 2 },
  { sku: 'SKC-0012', productoId: 'O5HxABm88IHIVE8rh6Z1', marca: 'Medicube', nombre: 'PDRN Pink Collagen Capsule Cream', pres: 'Crema', costoUnitario: 12.16, cantidad: 3 },
  { sku: 'SKC-0013', productoId: 'Z52x919TBu6UXIzhLc0u', marca: 'Medicube', nombre: 'TXA Niacinamide Capsule Cream', pres: 'Crema', costoUnitario: 11.09, cantidad: 1 },
  { sku: 'SKC-0015', productoId: 'tRp1MyTrOMSpCBVhLFn8', marca: 'Purito', nombre: 'Mighty Bamboo Panthenol Cream', pres: 'Crema', costoUnitario: 10.50, cantidad: 2 },
  { sku: 'SKC-0007', productoId: '9ZFTKzdoyFDuM5RDoSvf', marca: 'Round Lab', nombre: 'Birch Juice Moisturizing Sunscreen', pres: 'Protector Solar', costoUnitario: 7.47, cantidad: 2 },
  { sku: 'SKC-0005', productoId: 'Uew5uNWNzEH5hgkwB3HU', marca: 'SKIN1004', nombre: 'Air Fit Sunscream Plus', pres: 'Protector Solar', costoUnitario: 7.79, cantidad: 2 },
  { sku: 'SKC-0003', productoId: '7lih9afWlX8LtpDjGI3c', marca: 'SKIN1004', nombre: 'Espuma Limpiadora', pres: 'Limpiador', costoUnitario: 6.45, cantidad: 3 },
  { sku: 'SKC-0006', productoId: 'hbPvJvdOb14ScCzUxdSW', marca: 'SKIN1004', nombre: 'Hyalu-Cica Water-Fit Sun Serum', pres: 'Protector Solar', costoUnitario: 9.39, cantidad: 3 },
  { sku: 'SKC-0014', productoId: 'tFiVqDoiMbfJxfavv1lP', marca: 'SKIN1004', nombre: 'Madagascar Centella Poremizing Quick Clay Stick Mask', pres: 'Mascarilla', costoUnitario: 8.02, cantidad: 2 },
  { sku: 'SKC-0008', productoId: 'Bozq9iEEJ9yCMjMTQH61', marca: 'SKIN1004', nombre: 'Tea-trica Spot Cream', pres: 'Crema', costoUnitario: 7.12, cantidad: 1 },
  { sku: 'SKC-0001', productoId: '3iCBVSqHikeI99AqaRD4', marca: 'Tocobo', nombre: 'Cica Cooling Sun Stick', pres: 'Protector Solar', costoUnitario: 7.92, cantidad: 3 },
  { sku: 'SKC-0002', productoId: 'BoxuGpP3HKm7btV9xzoa', marca: 'Tocobo', nombre: 'Cotton Soft Sun Stick', pres: 'Protector Solar', costoUnitario: 7.53, cantidad: 3 },
];

const subtotalUSD = PRODUCTOS_OC.reduce((s, p) => s + p.costoUnitario * p.cantidad, 0);
const totalUSD = subtotalUSD + COSTO_ENVIO_USD;
const totalUnidades = PRODUCTOS_OC.reduce((s, p) => s + p.cantidad, 0);

console.log('=== RESUMEN ===');
console.log('Subtotal productos: $' + subtotalUSD.toFixed(2));
console.log('Shipping: $' + COSTO_ENVIO_USD.toFixed(2));
console.log('Total USD: $' + totalUSD.toFixed(2));
console.log('Total PEN (TC ' + TC_COMPRA + '): S/' + (totalUSD * TC_COMPRA).toFixed(2));
console.log('Unidades totales:', totalUnidades);
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
  // ========== PASO 1: Crear almacén virtual China ==========
  console.log('== PASO 1: Crear almacén virtual Asian Beauty China ==');

  let almacenChinaId;
  const existing = await db.collection('almacenes').where('nombre', '==', 'Asian Beauty Wholesale (China)').get();

  if (!existing.empty) {
    almacenChinaId = existing.docs[0].id;
    console.log('  Ya existe:', almacenChinaId);
  } else {
    const almacenChina = {
      codigo: 'ALM-CN-001',
      nombre: 'Asian Beauty Wholesale (China)',
      tipo: 'almacen_origen',
      pais: 'China',
      direccion: 'China',
      ciudad: 'Shenzhen',
      activo: true,
      esVirtual: true,
      notas: 'Almacén virtual representa al proveedor Asian Beauty Wholesale. Punto de salida para envíos DDP desde China.',
      creadoPor: 'system',
      fechaCreacion: Timestamp.now(),
    };
    if (DRY_RUN) {
      almacenChinaId = '[DRY_RUN_ALM_CN_001]';
      console.log('  [DRY RUN] Crearia almacén:', almacenChina.nombre);
    } else {
      const ref = await db.collection('almacenes').add(almacenChina);
      almacenChinaId = ref.id;
      console.log('  Creado:', almacenChinaId, '| ALM-CN-001');
    }
  }

  // ========== PASO 2: Crear la OC ==========
  console.log('\n== PASO 2: Crear OC ==');

  const ocNumero = await getNextCounter('OC-2025');
  const numeroOrden = `OC-2025-${ocNumero.toString().padStart(3, '0')}`;

  const productosOC = PRODUCTOS_OC.map(p => ({
    productoId: p.productoId,
    sku: p.sku,
    marca: p.marca,
    nombreComercial: p.nombre,
    presentacion: p.pres,
    cantidad: p.cantidad,
    costoUnitario: p.costoUnitario,
    subtotal: p.cantidad * p.costoUnitario,
    cantidadRecibida: p.cantidad, // Ya recibida completamente
  }));

  const oc = {
    numeroOrden,
    proveedorId: PROVEEDOR_ID,
    proveedorNombre: PROVEEDOR_NOMBRE,
    paisOrigen: PROVEEDOR_PAIS,
    productos: productosOC,
    subtotalUSD,
    costoEnvioProveedorUSD: COSTO_ENVIO_USD,
    totalUSD,
    tcCompra: TC_COMPRA,
    modoEntrega: 'envio_directo',
    fleteIncluidoEnPrecio: false,
    courier: 'DHL',
    almacenDestino: almacenChinaId, // Recibe primero en China virtual
    estado: 'recibida',
    estadoPago: 'pendiente', // El usuario se encarga del pago
    lineaNegocioId: 'Z50CnuaBdD5x0w7XGRv8', // SKC (verificar si aplica)
    lineaNegocioNombre: 'Suplementos y Vitaminas', // se ajustara
    fechaCreacion: Timestamp.fromDate(FECHA_COMPRA),
    fechaCompra: Timestamp.fromDate(FECHA_COMPRA),
    fechaRecepcion: Timestamp.fromDate(FECHA_LLEGADA),
    observaciones: 'Compra DDP (Delivered Duty Paid) — envío directo desde China a Perú vía DHL. El proveedor se encarga del flete internacional y aduanas.',
    creadoPor: 'system',
  };

  // Corregir línea de negocio
  const lineaSKC = await db.collection('lineasNegocio').where('codigo', '==', 'SKC').get();
  if (!lineaSKC.empty) {
    oc.lineaNegocioId = lineaSKC.docs[0].id;
    oc.lineaNegocioNombre = lineaSKC.docs[0].data().nombre;
  }

  let ocId;
  if (DRY_RUN) {
    ocId = '[DRY_RUN_OC_ID]';
    console.log('  [DRY RUN] Crearia OC:', numeroOrden);
  } else {
    const ocRef = await db.collection('ordenesCompra').add(oc);
    ocId = ocRef.id;
    console.log('  Creada:', numeroOrden, '| ID:', ocId);
  }

  // ========== PASO 3: Crear unidades en estado recibida_origen ==========
  console.log('\n== PASO 3: Crear 29 unidades en almacén China ==');

  const costoBaseTotal = subtotalUSD;
  const costosProrrateo = COSTO_ENVIO_USD;
  const unidadIds = [];
  let contadorUnidades = 0;

  for (const p of PRODUCTOS_OC) {
    const proporcional = costoBaseTotal > 0 ? costosProrrateo * (p.costoUnitario / costoBaseTotal) : 0;
    const costoUnitarioReal = p.costoUnitario + proporcional;
    const costoUnitarioPEN = costoUnitarioReal * TC_COMPRA;

    for (let i = 0; i < p.cantidad; i++) {
      contadorUnidades++;
      const unidadId = `U-${numeroOrden}-${contadorUnidades.toString().padStart(3, '0')}`;
      const unidad = {
        productoId: p.productoId,
        sku: p.sku,
        marca: p.marca,
        nombreComercial: p.nombre,
        presentacion: p.pres,
        lote: `OC-${numeroOrden}`,
        estado: 'disponible_peru', // Directo a disponible porque ya llegó
        almacenId: ALMACEN_PERU_ID,
        almacenNombre: ALMACEN_PERU_NOMBRE,
        pais: 'Peru',
        paisOrigen: 'China',
        costoUnitarioUSD: costoUnitarioReal,
        costoUnitarioPEN,
        ctruInicial: costoUnitarioPEN,
        ctruContable: costoUnitarioPEN,
        costoBaseUSD: p.costoUnitario,
        costoFleteInternacionalUSD: proporcional,
        costoRecojoPEN: 0, // DDP, sin recojo
        ordenCompraId: ocId,
        ordenCompraNumero: numeroOrden,
        proveedorId: PROVEEDOR_ID,
        proveedorNombre: PROVEEDOR_NOMBRE,
        tcCompra: TC_COMPRA,
        fechaIngreso: Timestamp.fromDate(FECHA_COMPRA),
        fechaRecepcion: Timestamp.fromDate(FECHA_LLEGADA),
        fechaVencimiento: Timestamp.fromDate(new Date(FECHA_LLEGADA.getTime() + 730 * 24 * 60 * 60 * 1000)), // 2 años
        movimientos: [
          {
            tipo: 'recepcion_oc',
            fecha: Timestamp.fromDate(FECHA_COMPRA),
            almacenDestino: almacenChinaId,
            estadoAnterior: null,
            estadoNuevo: 'recibida_origen',
            notas: `Recibida en China vía OC ${numeroOrden}`,
          },
          {
            tipo: 'envio_transferencia',
            fecha: Timestamp.fromDate(FECHA_SALIDA),
            almacenOrigen: almacenChinaId,
            almacenDestino: ALMACEN_PERU_ID,
            estadoAnterior: 'recibida_origen',
            estadoNuevo: 'en_transito_peru',
            notas: 'Enviada desde China vía DHL',
          },
          {
            tipo: 'recepcion_peru',
            fecha: Timestamp.fromDate(FECHA_LLEGADA),
            almacenDestino: ALMACEN_PERU_ID,
            estadoAnterior: 'en_transito_peru',
            estadoNuevo: 'disponible_peru',
            notas: 'Recibida en Perú — entrega DDP directa',
          },
        ],
        creadoPor: 'system',
        fechaCreacion: Timestamp.fromDate(FECHA_COMPRA),
      };

      if (DRY_RUN) {
        if (contadorUnidades <= 3) console.log('  [DRY RUN]', unidadId, '|', p.sku, '| costoUSD:', costoUnitarioReal.toFixed(2), '| costoPEN:', costoUnitarioPEN.toFixed(2));
      } else {
        const uref = await db.collection('unidades').add(unidad);
        unidadIds.push(uref.id);
      }
    }
  }
  console.log(`  Total unidades ${DRY_RUN ? 'a crear' : 'creadas'}: ${contadorUnidades}`);

  // ========== PASO 4: Crear Transferencia internacional China → Perú ==========
  console.log('\n== PASO 4: Crear Transferencia internacional China → Perú ==');

  const trfNumero = await getNextCounter('TRF-2025');
  const numeroTransferencia = `TRF-2025-${trfNumero.toString().padStart(3, '0')}`;

  // Construir el array de unidades para la transferencia
  const unidadesTrf = [];
  let idx = 0;
  for (const p of PRODUCTOS_OC) {
    for (let i = 0; i < p.cantidad; i++) {
      unidadesTrf.push({
        unidadId: unidadIds[idx] || `[DRY_${idx}]`,
        productoId: p.productoId,
        sku: p.sku,
        marca: p.marca,
        nombreComercial: p.nombre,
        estado: 'recibida', // Ya recibida
      });
      idx++;
    }
  }

  const diasEnTransito = Math.round((FECHA_LLEGADA - FECHA_SALIDA) / (1000 * 60 * 60 * 24));

  const transferencia = {
    numeroTransferencia,
    tipo: 'internacional_peru',
    estado: 'recibida_completa',
    almacenOrigenId: almacenChinaId,
    almacenOrigenNombre: 'Asian Beauty Wholesale (China)',
    almacenDestinoId: ALMACEN_PERU_ID,
    almacenDestinoNombre: ALMACEN_PERU_NOMBRE,
    unidades: unidadesTrf,
    totalUnidades: contadorUnidades,
    totalUnidadesRecibidas: contadorUnidades,
    totalUnidadesFaltantes: 0,
    courier: 'DHL',
    fechaSalida: Timestamp.fromDate(FECHA_SALIDA),
    fechaLlegadaEstimada: Timestamp.fromDate(FECHA_LLEGADA),
    fechaLlegadaReal: Timestamp.fromDate(FECHA_LLEGADA),
    diasEnTransito,
    ordenCompraId: ocId,
    ordenCompraNumero: numeroOrden,
    observaciones: `Transferencia DDP vinculada a OC ${numeroOrden}. Envío directo desde China vía DHL. Flete de USD ${COSTO_ENVIO_USD} cubierto por proveedor (incluido en OC).`,
    creadoPor: 'system',
    fechaCreacion: Timestamp.fromDate(FECHA_SALIDA),
  };

  if (DRY_RUN) {
    console.log('  [DRY RUN] Crearia transferencia:', numeroTransferencia);
    console.log('  Dias en transito:', diasEnTransito);
  } else {
    const trfRef = await db.collection('transferencias').add(transferencia);
    console.log('  Creada:', numeroTransferencia, '| ID:', trfRef.id);
    console.log('  Dias en transito:', diasEnTransito);
  }

  console.log('\n========================================');
  console.log('  COMPLETADO');
  console.log(`  OC: ${numeroOrden} - $${totalUSD.toFixed(2)} USD`);
  console.log(`  Transferencia: ${numeroTransferencia} - ${diasEnTransito} días en tránsito`);
  console.log(`  Unidades: ${contadorUnidades} en ${ALMACEN_PERU_NOMBRE}`);
  console.log('========================================\n');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
