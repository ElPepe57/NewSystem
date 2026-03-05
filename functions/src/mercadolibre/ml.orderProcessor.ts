/**
 * ML Order Processor - Procesamiento automático de órdenes ML → ERP
 *
 * Pipeline: buscarOCrearCliente → crearVenta → registrarPago → asignarFEFO → registrarGastos → actualizar mlOrderSync
 *
 * Ejecuta con Firebase Admin SDK (backend). Reutilizado por:
 * - Webhook automático (ml.sync.ts → processOrderNotification)
 * - Callable manual retry (ml.functions.ts → mlprocesarorden)
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { MLOrderSync, MLOrderProduct } from "./ml.types";

const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

// ============================================================
// TIPOS INTERNOS
// ============================================================

interface ProcessResult {
  ventaId: string;
  numeroVenta: string;
  clienteId: string | null;
  estado: "procesada" | "error";
  advertencias: string[];
}

interface OrderSyncData extends MLOrderSync {
  id?: string;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  buyerDni?: string | null;
  direccionEntrega?: string;
  distrito?: string;
  provincia?: string;
  coordenadas?: { lat: number; lng: number } | null;
  trackingNumber?: string | null;
  productos?: MLOrderProduct[];
  todosVinculados?: boolean;
}

// ============================================================
// PIPELINE PRINCIPAL
// ============================================================

export async function procesarOrdenCompleta(
  orderSync: OrderSyncData,
  orderSyncRef: FirebaseFirestore.DocumentReference
): Promise<ProcessResult> {
  const advertencias: string[] = [];
  const mlOrderId = orderSync.mlOrderId;

  functions.logger.info(`ML Order ${mlOrderId}: Iniciando procesamiento automático`);

  try {
    // 0. Obtener config ML
    const configDoc = await db.collection("mlConfig").doc("settings").get();
    const config = configDoc.data() || {};

    // 1. Buscar o crear cliente
    let clienteId: string | null = null;
    try {
      clienteId = await buscarOCrearCliente(orderSync, config);
    } catch (err: any) {
      advertencias.push(`Cliente: ${err.message}`);
      functions.logger.warn(`ML Order ${mlOrderId}: error buscando/creando cliente`, err);
    }

    // 2. Obtener canal ML
    const canalMLId = await obtenerCanalML();

    // 3. Crear venta
    const { ventaId, numeroVenta, ventaData } = await crearVenta(orderSync, clienteId, canalMLId);
    functions.logger.info(`ML Order ${mlOrderId}: Venta creada ${numeroVenta} (${ventaId})`);

    // 4. Registrar pago completo + tesorería
    let cuentaMPId: string | null = null;
    try {
      cuentaMPId = await registrarPagoCompleto(ventaId, ventaData, orderSync);
    } catch (err: any) {
      advertencias.push(`Pago: ${err.message}`);
      functions.logger.error(`ML Order ${mlOrderId}: error registrando pago`, err);
    }

    // 5. Asignar inventario FEFO
    try {
      await asignarInventarioFEFO(ventaId, ventaData, orderSync);
    } catch (err: any) {
      advertencias.push(`Inventario FEFO: ${err.message}`);
      functions.logger.error(`ML Order ${mlOrderId}: error en FEFO`, err);
    }

    // 6. Registrar gastos ML (comisión)
    try {
      if (orderSync.comisionML > 0 && cuentaMPId) {
        await registrarGastosML(ventaId, numeroVenta, orderSync, cuentaMPId);
      }
    } catch (err: any) {
      advertencias.push(`Gastos: ${err.message}`);
      functions.logger.error(`ML Order ${mlOrderId}: error registrando gastos`, err);
    }

    // 7. Actualizar mlOrderSync como procesada
    await orderSyncRef.update({
      ventaId,
      numeroVenta,
      clienteId,
      estado: "procesada",
      errorDetalle: advertencias.length > 0 ? advertencias.join(" | ") : null,
      fechaProcesada: Timestamp.now(),
    });

    functions.logger.info(
      `ML Order ${mlOrderId}: Procesada exitosamente → ${numeroVenta}` +
      (advertencias.length > 0 ? ` (${advertencias.length} advertencias)` : "")
    );

    return { ventaId, numeroVenta, clienteId, estado: "procesada", advertencias };
  } catch (err: any) {
    functions.logger.error(`ML Order ${mlOrderId}: Error crítico en procesamiento`, err);

    await orderSyncRef.update({
      estado: "error",
      errorDetalle: err.message,
      fechaSync: Timestamp.now(),
    });

    throw err;
  }
}

// ============================================================
// PASO 1: BUSCAR O CREAR CLIENTE
// ============================================================

async function buscarOCrearCliente(
  orderSync: OrderSyncData,
  config: any
): Promise<string | null> {
  // 1a. Buscar por DNI/RUC
  if (orderSync.buyerDni) {
    const dniQuery = await db.collection("clientes")
      .where("dniRuc", "==", orderSync.buyerDni)
      .limit(1)
      .get();

    if (!dniQuery.empty) {
      functions.logger.info(`ML: Cliente encontrado por DNI ${orderSync.buyerDni}`);
      return dniQuery.docs[0].id;
    }
  }

  // 1b. Buscar por teléfono (normalizado)
  if (orderSync.buyerPhone) {
    const phoneNormalized = orderSync.buyerPhone.replace(/\D/g, "");
    if (phoneNormalized.length >= 7) {
      const phoneQuery = await db.collection("clientes")
        .where("telefono", "==", phoneNormalized)
        .limit(1)
        .get();

      if (!phoneQuery.empty) {
        functions.logger.info(`ML: Cliente encontrado por teléfono ${phoneNormalized}`);
        return phoneQuery.docs[0].id;
      }
    }
  }

  // 1c. Buscar por nombre exacto (case-insensitive via lowercase)
  if (orderSync.mlBuyerName) {
    const nombreLower = orderSync.mlBuyerName.toLowerCase().trim();
    const nameQuery = await db.collection("clientes")
      .where("nombreLowercase", "==", nombreLower)
      .limit(1)
      .get();

    if (!nameQuery.empty) {
      functions.logger.info(`ML: Cliente encontrado por nombre '${orderSync.mlBuyerName}'`);
      return nameQuery.docs[0].id;
    }
  }

  // 1d. No encontrado — crear si autoCreateClientes está activo
  if (!config.autoCreateClientes) {
    functions.logger.info("ML: Cliente no encontrado y autoCreateClientes desactivado");
    return null;
  }

  // Generar código CLI-NNN
  const codigo = await generarCodigoCliente();

  // Buscar canal ML
  const canalMLId = await obtenerCanalML();

  const nuevoCliente: Record<string, any> = {
    codigo,
    nombre: orderSync.mlBuyerName || "Cliente ML",
    nombreLowercase: (orderSync.mlBuyerName || "cliente ml").toLowerCase().trim(),
    tipoCliente: "persona",
    dniRuc: orderSync.buyerDni || null,
    telefono: orderSync.buyerPhone ? orderSync.buyerPhone.replace(/\D/g, "") : null,
    email: orderSync.buyerEmail || null,
    canalOrigen: canalMLId,
    direcciones: [],
    estado: "activo",
    metricas: { totalCompras: 0, montoTotalPEN: 0, ticketPromedio: 0 },
    notas: "Creado automáticamente desde Mercado Libre",
    creadoPor: "ml-auto-processor",
    fechaCreacion: Timestamp.now(),
  };

  // Agregar dirección si existe
  if (orderSync.direccionEntrega) {
    nuevoCliente.direcciones = [{
      id: `dir-${Date.now()}`,
      etiqueta: "Mercado Libre",
      direccion: orderSync.direccionEntrega,
      distrito: orderSync.distrito || "",
      ciudad: orderSync.provincia || "",
      referencia: "",
      esPrincipal: true,
    }];
  }

  const clienteRef = await db.collection("clientes").add(nuevoCliente);
  functions.logger.info(`ML: Cliente creado ${codigo} (${clienteRef.id})`);
  return clienteRef.id;
}

// ============================================================
// PASO 2: CREAR VENTA
// ============================================================

async function crearVenta(
  orderSync: OrderSyncData,
  clienteId: string | null,
  canalMLId: string | null
): Promise<{ ventaId: string; numeroVenta: string; ventaData: Record<string, any> }> {
  // Generar número de venta VT-YYYY-NNN
  const numeroVenta = await generarNumeroVenta();

  // Resolver productos con datos completos del ERP
  const productosVenta: Record<string, any>[] = [];
  let subtotalPEN = 0;

  for (const prod of (orderSync.productos || [])) {
    let sku = prod.productoSku || "";
    let nombreComercial = prod.productoNombre || prod.mlTitle;
    let marca = "";
    let presentacion = "";

    // Obtener datos completos del producto ERP
    if (prod.productoId) {
      try {
        const prodDoc = await db.collection("productos").doc(prod.productoId).get();
        if (prodDoc.exists) {
          const prodData = prodDoc.data()!;
          sku = prodData.sku || sku;
          nombreComercial = prodData.nombreComercial || nombreComercial;
          marca = prodData.marca || "";
          presentacion = prodData.presentacion || "";
        }
      } catch {
        // Usar datos del mapeo ML
      }
    }

    const subtotal = prod.cantidad * prod.precioUnitario;
    subtotalPEN += subtotal;

    productosVenta.push({
      productoId: prod.productoId || null,
      sku,
      nombreComercial,
      marca,
      presentacion,
      cantidad: prod.cantidad,
      cantidadAsignada: 0,
      precioUnitario: prod.precioUnitario,
      subtotal,
      unidadesAsignadas: [],
      costoTotalUnidades: 0,
      estadoAsignacion: "pendiente",
      mlItemId: prod.mlItemId,
      mlVariationId: prod.mlVariationId || null,
    });
  }

  // Calcular costos de envío
  const costoEnvio = orderSync.costoEnvioCliente || orderSync.costoEnvioML || 0;
  const totalPEN = subtotalPEN + costoEnvio;

  // Comisión ML como gasto de venta directo (para rentabilidad)
  const comisionML = orderSync.comisionML || 0;
  const comisionMLPorcentaje = totalPEN > 0 ? (comisionML / totalPEN) * 100 : 0;
  const gastosVentaPEN = comisionML;

  const ventaData: Record<string, any> = {
    numeroVenta,
    nombreCliente: orderSync.mlBuyerName || "Cliente ML",
    clienteId: clienteId || null,
    emailCliente: orderSync.buyerEmail || null,
    telefonoCliente: orderSync.buyerPhone || null,
    direccionEntrega: orderSync.direccionEntrega || "",
    distrito: orderSync.distrito || "",
    provincia: orderSync.provincia || "",
    coordenadas: orderSync.coordenadas || null,
    dniRuc: orderSync.buyerDni || null,
    canal: canalMLId || "mercado_libre",
    canalNombre: "Mercado Libre",
    productos: productosVenta,
    subtotalPEN,
    costoEnvio,
    incluyeEnvio: false,
    totalPEN,
    moneda: "PEN",
    // Campos de gastos directos en la venta (para rentabilidad)
    comisionML,
    comisionMLPorcentaje,
    gastosVentaPEN,
    // Estado de pago
    estadoPago: "pendiente",
    pagos: [],
    montoPagado: 0,
    montoPendiente: totalPEN,
    // Estado general
    estado: "confirmada",
    mercadoLibreId: String(orderSync.mlOrderId),
    observaciones: `Orden ML #${orderSync.mlOrderId} - Procesada automáticamente`,
    creadoPor: "ml-auto-processor",
    fechaCreacion: Timestamp.now(),
    fechaConfirmacion: Timestamp.now(),
    // Rentabilidad (se actualiza en FEFO)
    costoTotalPEN: 0,
    utilidadBrutaPEN: 0,
    utilidadNetaPEN: 0,
    margenBruto: 0,
    margenNeto: 0,
  };

  const ventaRef = await db.collection("ventas").add(ventaData);
  return { ventaId: ventaRef.id, numeroVenta, ventaData };
}

// ============================================================
// PASO 3: REGISTRAR PAGO COMPLETO + TESORERÍA
// ============================================================

async function registrarPagoCompleto(
  ventaId: string,
  ventaData: Record<string, any>,
  orderSync: OrderSyncData
): Promise<string | null> {
  const totalPEN = ventaData.totalPEN;
  const numeroVenta = ventaData.numeroVenta;

  // Crear PagoVenta
  const pagoId = `PAG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const nuevoPago = {
    id: pagoId,
    monto: totalPEN,
    metodoPago: "mercado_pago",
    tipoPago: "pago",
    referencia: `ML-${orderSync.mlOrderId}`,
    fecha: Timestamp.now(),
    registradoPor: "ml-auto-processor",
    notas: "Pago recibido via Mercado Libre",
  };

  // Actualizar venta con pago
  await db.collection("ventas").doc(ventaId).update({
    pagos: admin.firestore.FieldValue.arrayUnion(nuevoPago),
    montoPagado: totalPEN,
    montoPendiente: 0,
    estadoPago: "pagado",
    fechaPagoCompleto: Timestamp.now(),
  });

  // Buscar cuenta MercadoPago en tesorería
  const cuentaMPId = await buscarCuentaMercadoPago();
  if (!cuentaMPId) {
    functions.logger.warn("ML: No se encontró cuenta MercadoPago en tesorería");
    return null;
  }

  // Obtener tipo de cambio actual
  const tc = await obtenerTipoCambio();

  // Crear movimiento de tesorería (ingreso_venta)
  const movimientoIngreso: Record<string, any> = {
    numeroMovimiento: `MOV-ml-${Date.now()}`,
    tipo: "ingreso_venta",
    estado: "ejecutado",
    moneda: "PEN",
    monto: totalPEN,
    tipoCambio: tc,
    metodo: "mercado_pago",
    concepto: `Pago venta ${numeroVenta} - ML #${orderSync.mlOrderId}`,
    ventaId,
    ventaNumero: numeroVenta,
    cuentaDestino: cuentaMPId,
    fecha: Timestamp.now(),
    creadoPor: "ml-auto-processor",
    fechaCreacion: Timestamp.now(),
  };

  await db.collection("movimientosTesoreria").add(movimientoIngreso);

  // Actualizar saldo de la cuenta MP
  await db.collection("cuentasCaja").doc(cuentaMPId).update({
    saldoActual: admin.firestore.FieldValue.increment(totalPEN),
  });

  functions.logger.info(`ML: Pago S/ ${totalPEN} registrado → cuenta MP ${cuentaMPId}`);
  return cuentaMPId;
}

// ============================================================
// PASO 4: ASIGNAR INVENTARIO FEFO
// ============================================================

async function asignarInventarioFEFO(
  ventaId: string,
  ventaData: Record<string, any>,
  orderSync: OrderSyncData
): Promise<void> {
  const productos = ventaData.productos || [];
  let costoTotalPEN = 0;
  let todasAsignadas = true;
  const productosActualizados = [...productos];

  for (let i = 0; i < productosActualizados.length; i++) {
    const prod = productosActualizados[i];
    if (!prod.productoId) {
      todasAsignadas = false;
      continue;
    }

    // Query unidades disponibles, ordenadas por fecha de vencimiento (FEFO)
    const unidadesQuery = await db.collection("unidades")
      .where("productoId", "==", prod.productoId)
      .where("estado", "==", "disponible_peru")
      .orderBy("fechaVencimiento", "asc")
      .limit(prod.cantidad * 2) // Margen para filtrar reservadas
      .get();

    // Filtrar las que ya están reservadas para otra venta
    const disponibles = unidadesQuery.docs.filter((doc) => {
      const data = doc.data();
      return !data.reservadaPara || data.reservadaPara === ventaId;
    });

    const unidadesAReservar = disponibles.slice(0, prod.cantidad);
    const cantidadAsignada = unidadesAReservar.length;
    const unidadesIds: string[] = [];
    let costoProducto = 0;

    // Reservar unidades y calcular CTRU
    const batch = db.batch();
    for (const uDoc of unidadesAReservar) {
      const uData = uDoc.data();

      // Calcular CTRU de la unidad
      let ctru = 0;
      if (uData.ctruDinamico) {
        ctru = uData.ctruDinamico;
      } else {
        const costoBase = (uData.costoUnitarioUSD || 0) + (uData.costoFleteUSD || 0);
        const tcUnidad = uData.tcPago || uData.tcCompra || 3.70;
        ctru = costoBase * tcUnidad;
      }

      costoProducto += ctru;
      unidadesIds.push(uDoc.id);

      batch.update(uDoc.ref, {
        estado: "reservada",
        reservadaPara: ventaId,
        fechaReserva: Timestamp.now(),
      });
    }

    await batch.commit();

    // Actualizar producto en venta
    productosActualizados[i] = {
      ...prod,
      cantidadAsignada,
      unidadesAsignadas: unidadesIds,
      costoTotalUnidades: costoProducto,
      estadoAsignacion: cantidadAsignada >= prod.cantidad ? "completa" : "parcial",
    };

    costoTotalPEN += costoProducto;

    if (cantidadAsignada < prod.cantidad) {
      todasAsignadas = false;
      functions.logger.warn(
        `ML FEFO: Producto ${prod.sku} - asignadas ${cantidadAsignada}/${prod.cantidad}`
      );
    }

    // Sincronizar stock del producto
    try {
      await sincronizarStockProducto(prod.productoId);
    } catch {
      // No crítico
    }
  }

  // Calcular rentabilidad
  const totalPEN = ventaData.totalPEN;
  const gastosVentaPEN = ventaData.gastosVentaPEN || 0;
  const utilidadBrutaPEN = totalPEN - costoTotalPEN;
  const utilidadNetaPEN = utilidadBrutaPEN - gastosVentaPEN;
  const margenBruto = totalPEN > 0 ? (utilidadBrutaPEN / totalPEN) * 100 : 0;
  const margenNeto = totalPEN > 0 ? (utilidadNetaPEN / totalPEN) * 100 : 0;

  // Actualizar venta con productos asignados y rentabilidad
  await db.collection("ventas").doc(ventaId).update({
    productos: productosActualizados,
    estado: todasAsignadas ? "asignada" : "confirmada",
    costoTotalPEN,
    utilidadBrutaPEN,
    utilidadNetaPEN,
    margenBruto,
    margenNeto,
    ...(todasAsignadas ? { fechaAsignacion: Timestamp.now() } : {}),
  });

  functions.logger.info(
    `ML FEFO: Asignación ${todasAsignadas ? "completa" : "parcial"} - ` +
    `Costo: S/ ${costoTotalPEN.toFixed(2)}, Margen: ${margenNeto.toFixed(1)}%`
  );
}

// ============================================================
// PASO 5: REGISTRAR GASTOS ML
// ============================================================

async function registrarGastosML(
  ventaId: string,
  numeroVenta: string,
  orderSync: OrderSyncData,
  cuentaMPId: string
): Promise<void> {
  const comisionML = orderSync.comisionML;
  if (comisionML <= 0) return;

  const tc = await obtenerTipoCambio();
  const now = Timestamp.now();
  const fecha = now.toDate();
  const mes = fecha.getMonth() + 1;
  const anio = fecha.getFullYear();

  // Generar número de gasto
  const numeroGasto = await generarNumeroGasto();

  // Crear PagoGasto
  const pagoGastoId = `PAG-GAS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const pagoGasto = {
    id: pagoGastoId,
    fecha: now,
    monedaPago: "PEN",
    montoOriginal: comisionML,
    montoPEN: comisionML,
    tipoCambio: tc,
    metodoPago: "mercado_pago",
    cuentaOrigenId: cuentaMPId,
    registradoPor: "ml-auto-processor",
  };

  // Crear doc de gasto (comisión ML)
  const gastoData: Record<string, any> = {
    numeroGasto,
    tipo: "comision_ml",
    categoria: "GV",
    claseGasto: "GVD",
    descripcion: `Comisión ML - Orden #${orderSync.mlOrderId} - ${numeroVenta}`,
    moneda: "PEN",
    montoOriginal: comisionML,
    montoPEN: comisionML,
    tipoCambio: tc,
    esProrrateable: false,
    ventaId,
    ventaNumero: numeroVenta,
    mes,
    anio,
    fecha: now,
    esRecurrente: false,
    frecuencia: "unico",
    estado: "pagado",
    impactaCTRU: false,
    ctruRecalculado: true,
    pagos: [pagoGasto],
    montoPagado: comisionML,
    montoPendiente: 0,
    creadoPor: "ml-auto-processor",
    fechaCreacion: now,
  };

  const gastoRef = await db.collection("gastos").add(gastoData);

  // Crear movimiento de tesorería (egreso comisión)
  const movimientoEgreso: Record<string, any> = {
    numeroMovimiento: `MOV-mlgas-${Date.now()}`,
    tipo: "gasto_operativo",
    estado: "ejecutado",
    moneda: "PEN",
    monto: comisionML,
    tipoCambio: tc,
    metodo: "mercado_pago",
    concepto: `Comisión ML - ${numeroVenta} - Orden #${orderSync.mlOrderId}`,
    gastoId: gastoRef.id,
    gastoNumero: numeroGasto,
    ventaId,
    ventaNumero: numeroVenta,
    cuentaOrigen: cuentaMPId,
    fecha: now,
    creadoPor: "ml-auto-processor",
    fechaCreacion: now,
  };

  await db.collection("movimientosTesoreria").add(movimientoEgreso);

  // Actualizar saldo de la cuenta MP (egreso)
  await db.collection("cuentasCaja").doc(cuentaMPId).update({
    saldoActual: admin.firestore.FieldValue.increment(-comisionML),
  });

  functions.logger.info(
    `ML Gasto: Comisión S/ ${comisionML.toFixed(2)} → ${numeroGasto} | Egreso de cuenta MP`
  );
}

// ============================================================
// HELPERS
// ============================================================

async function generarNumeroVenta(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VT-${year}-`;

  const lastVenta = await db.collection("ventas")
    .where("numeroVenta", ">=", prefix)
    .where("numeroVenta", "<=", prefix + "\uf8ff")
    .orderBy("numeroVenta", "desc")
    .limit(1)
    .get();

  let nextNum = 1;
  if (!lastVenta.empty) {
    const lastNumero = lastVenta.docs[0].data().numeroVenta as string;
    const numPart = parseInt(lastNumero.replace(prefix, ""), 10);
    if (!isNaN(numPart)) nextNum = numPart + 1;
  }

  return `${prefix}${String(nextNum).padStart(3, "0")}`;
}

async function generarCodigoCliente(): Promise<string> {
  const prefix = "CLI-";

  const lastCliente = await db.collection("clientes")
    .where("codigo", ">=", prefix)
    .where("codigo", "<=", prefix + "\uf8ff")
    .orderBy("codigo", "desc")
    .limit(1)
    .get();

  let nextNum = 1;
  if (!lastCliente.empty) {
    const lastCodigo = lastCliente.docs[0].data().codigo as string;
    const numPart = parseInt(lastCodigo.replace(prefix, ""), 10);
    if (!isNaN(numPart)) nextNum = numPart + 1;
  }

  return `${prefix}${String(nextNum).padStart(3, "0")}`;
}

async function generarNumeroGasto(): Promise<string> {
  const prefix = "GAS-";

  const lastGasto = await db.collection("gastos")
    .where("numeroGasto", ">=", prefix)
    .where("numeroGasto", "<=", prefix + "\uf8ff")
    .orderBy("numeroGasto", "desc")
    .limit(1)
    .get();

  let nextNum = 1;
  if (!lastGasto.empty) {
    const lastNumero = lastGasto.docs[0].data().numeroGasto as string;
    const numPart = parseInt(lastNumero.replace(prefix, ""), 10);
    if (!isNaN(numPart)) nextNum = numPart + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

async function obtenerCanalML(): Promise<string | null> {
  const canalQuery = await db.collection("canalesVenta")
    .where("nombre", "==", "Mercado Libre")
    .limit(1)
    .get();

  if (!canalQuery.empty) return canalQuery.docs[0].id;

  // Fallback: buscar por código
  const canalCodeQuery = await db.collection("canalesVenta")
    .where("codigo", "==", "CV-002")
    .limit(1)
    .get();

  return canalCodeQuery.empty ? null : canalCodeQuery.docs[0].id;
}

async function buscarCuentaMercadoPago(): Promise<string | null> {
  // 1. Buscar cuenta por defecto con método mercado_pago
  const defaultQuery = await db.collection("cuentasCaja")
    .where("metodoPagoAsociado", "==", "mercado_pago")
    .where("esCuentaPorDefecto", "==", true)
    .where("activa", "==", true)
    .limit(1)
    .get();

  if (!defaultQuery.empty) return defaultQuery.docs[0].id;

  // 2. Cualquier cuenta mercado_pago activa
  const mpQuery = await db.collection("cuentasCaja")
    .where("metodoPagoAsociado", "==", "mercado_pago")
    .where("activa", "==", true)
    .limit(1)
    .get();

  if (!mpQuery.empty) return mpQuery.docs[0].id;

  // 3. Fallback: cualquier cuenta activa que acepte PEN
  const fallbackQuery = await db.collection("cuentasCaja")
    .where("activa", "==", true)
    .limit(1)
    .get();

  return fallbackQuery.empty ? null : fallbackQuery.docs[0].id;
}

async function obtenerTipoCambio(): Promise<number> {
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const tcQuery = await db.collection("tiposCambio")
      .where("fecha", "==", today)
      .limit(1)
      .get();

    if (!tcQuery.empty) {
      return tcQuery.docs[0].data().venta || 3.70;
    }

    // Si no hay TC de hoy, buscar el más reciente
    const recentTC = await db.collection("tiposCambio")
      .orderBy("fecha", "desc")
      .limit(1)
      .get();

    if (!recentTC.empty) {
      return recentTC.docs[0].data().venta || 3.70;
    }
  } catch {
    // Error consultando TC
  }

  return 3.70; // Fallback
}

async function sincronizarStockProducto(productoId: string): Promise<void> {
  // Contar unidades disponibles
  const disponiblesQuery = await db.collection("unidades")
    .where("productoId", "==", productoId)
    .where("estado", "==", "disponible_peru")
    .get();

  const stockDisponible = disponiblesQuery.size;

  await db.collection("productos").doc(productoId).update({
    stockDisponible,
    ultimaActualizacionStock: Timestamp.now(),
  });
}
