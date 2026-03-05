/**
 * Test script para ML Order Processor contra Firebase Emulators
 *
 * Uso:
 *   1. cd functions && npm run build
 *   2. firebase emulators:start (en otra terminal)
 *   3. node lib/test-ml-processor.js
 *
 * Crea seed data → ejecuta procesarOrdenCompleta → verifica docs
 */

import * as admin from "firebase-admin";

// Conectar al emulador de Firestore
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

// Inicializar Firebase Admin con project ID del emulador
admin.initializeApp({ projectId: "demo-test-ml" });
const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

// Importar el procesador (después de configurar emuladores)
import { procesarOrdenCompleta } from "./mercadolibre/ml.orderProcessor";

// ============================================================
// SEED DATA
// ============================================================

async function seedData() {
  console.log("\n📦 Creando seed data...\n");

  // 1. ML Config
  await db.collection("mlConfig").doc("settings").set({
    connected: true,
    userId: 123456789,
    nickname: "TESTUSER",
    autoCreateVentas: true,
    autoCreateClientes: true,
    defaultComisionPorcentaje: 15,
    lastSync: Timestamp.now(),
    tokenExpiresAt: Timestamp.now(),
  });
  console.log("  ✅ mlConfig/settings");

  // 2. Canal de Venta ML
  const canalRef = await db.collection("canalesVenta").add({
    nombre: "Mercado Libre",
    codigo: "CV-002",
    activo: true,
  });
  console.log(`  ✅ canalesVenta (${canalRef.id})`);

  // 3. Cuenta MercadoPago en tesorería
  const cuentaRef = await db.collection("cuentasCaja").add({
    nombre: "MercadoPago",
    metodoPagoAsociado: "mercado_pago",
    esCuentaPorDefecto: true,
    activa: true,
    moneda: "PEN",
    saldoActual: 0,
    tipo: "digital",
  });
  console.log(`  ✅ cuentasCaja MercadoPago (${cuentaRef.id})`);

  // 4. Tipo de cambio de hoy
  const today = new Date().toISOString().split("T")[0];
  await db.collection("tiposCambio").add({
    fecha: today,
    compra: 3.68,
    venta: 3.72,
  });
  console.log(`  ✅ tiposCambio (${today})`);

  // 5. Producto ERP
  const productoRef = await db.collection("productos").add({
    sku: "CRM-001",
    nombreComercial: "Crema Hidratante Vita Skin 50ml",
    marca: "Vita Skin",
    presentacion: "50ml",
    stockDisponible: 10,
    estado: "activo",
    precioVenta: 89.90,
  });
  console.log(`  ✅ producto ERP (${productoRef.id})`);

  // 6. Unidades disponibles (para FEFO)
  const unidadIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const fechaVencimiento = new Date();
    fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 6 + i); // Vencen progresivamente

    const uRef = await db.collection("unidades").add({
      productoId: productoRef.id,
      sku: "CRM-001",
      estado: "disponible_peru",
      costoUnitarioUSD: 8.50,
      costoFleteUSD: 1.20,
      tcCompra: 3.70,
      ctruDinamico: 38.50 + i, // S/ 38.50 - S/ 42.50
      fechaVencimiento: Timestamp.fromDate(fechaVencimiento),
      lote: `LOTE-2026-${String(i + 1).padStart(2, "0")}`,
      ordenCompraId: "OC-TEST-001",
      fechaCreacion: Timestamp.now(),
    });
    unidadIds.push(uRef.id);
  }
  console.log(`  ✅ ${unidadIds.length} unidades disponibles (FEFO test)`);

  // 7. Venta existente (para que el generador de numeración funcione)
  await db.collection("ventas").add({
    numeroVenta: "VT-2026-047",
    estado: "entregada",
    totalPEN: 126.95,
    fechaCreacion: Timestamp.now(),
  });
  console.log("  ✅ venta existente VT-2026-047 (para secuencia)");

  // 8. Gasto existente (para secuencia)
  await db.collection("gastos").add({
    numeroGasto: "GAS-0093",
    estado: "pagado",
    montoPEN: 17.70,
    fechaCreacion: Timestamp.now(),
  });
  console.log("  ✅ gasto existente GAS-0093 (para secuencia)");

  // 9. Cliente existente (no debería matchear — testing autoCreate)
  await db.collection("clientes").add({
    codigo: "CLI-010",
    nombre: "Otro Cliente",
    nombreLowercase: "otro cliente",
    dniRuc: "99999999",
    telefono: "999000000",
    estado: "activo",
    fechaCreacion: Timestamp.now(),
  });
  console.log("  ✅ cliente existente CLI-010 (para secuencia)");

  return { productoRef, cuentaRef, canalRef, unidadIds };
}

// ============================================================
// CREAR ORDEN DE PRUEBA
// ============================================================

async function crearOrdenPrueba(productoId: string) {
  console.log("\n📋 Creando orden ML de prueba...\n");

  const orderData = {
    mlOrderId: 2000000999888,
    mlStatus: "paid",
    mlBuyerId: 777888999,
    mlBuyerName: "María García López",
    ventaId: null,
    numeroVenta: null,
    clienteId: null,
    estado: "pendiente" as const,
    errorDetalle: null,
    totalML: 179.80, // 2 x 89.90
    comisionML: 26.97, // ~15%
    costoEnvioML: 12.50, // Costo envío ML (shipment.lead_time.cost)
    costoEnvioCliente: 15.00, // Lo que el cliente pagó (payment.shipping_cost)
    fechaOrdenML: Timestamp.now(),
    fechaProcesada: null,
    fechaSync: Timestamp.now(),
    // Datos extendidos buyer
    buyerEmail: "maria.garcia@gmail.com",
    buyerPhone: "51987654321",
    buyerDni: "45678912",
    // Dirección envío
    direccionEntrega: "Av. Javier Prado Este 1234, Dpto 501",
    distrito: "San Isidro",
    provincia: "Lima",
    coordenadas: { lat: -12.0890, lng: -77.0256 },
    trackingNumber: "ME-999888777",
    shipmentStatus: "ready_to_ship",
    todosVinculados: true,
    // Productos
    productos: [
      {
        mlItemId: "MPE987654321",
        mlTitle: "Crema Hidratante Vita Skin 50ml - Cuidado Facial",
        mlVariationId: null,
        cantidad: 2,
        precioUnitario: 89.90,
        saleFee: 13.49,
        productoId: productoId,
        productoSku: "CRM-001",
        productoNombre: "Crema Hidratante Vita Skin 50ml",
        vinculado: true,
      },
    ],
  };

  const orderRef = await db.collection("mlOrderSync").add(orderData);
  console.log(`  ✅ mlOrderSync creada (${orderRef.id})`);
  console.log(`     Orden ML: #${orderData.mlOrderId}`);
  console.log(`     Buyer: ${orderData.mlBuyerName} (DNI: ${orderData.buyerDni})`);
  console.log(`     Productos: ${orderData.totalML} PEN (2x Crema Hidratante)`);
  console.log(`     Envío cliente: S/ ${orderData.costoEnvioCliente}`);
  console.log(`     Comisión ML: S/ ${orderData.comisionML}`);

  return { orderRef, orderData: { id: orderRef.id, ...orderData } };
}

// ============================================================
// VERIFICAR RESULTADOS
// ============================================================

async function verificarResultados(orderId: string) {
  console.log("\n🔍 Verificando resultados...\n");
  let passed = 0;
  let failed = 0;

  const check = (label: string, condition: boolean, detail?: string) => {
    if (condition) {
      console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
      passed++;
    } else {
      console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
      failed++;
    }
  };

  // 1. Verificar mlOrderSync actualizada
  console.log("  --- mlOrderSync ---");
  const orderDoc = await db.collection("mlOrderSync").doc(orderId).get();
  const order = orderDoc.data()!;
  check("Estado = procesada", order.estado === "procesada", `estado: ${order.estado}`);
  check("ventaId poblado", !!order.ventaId, `ventaId: ${order.ventaId}`);
  check("numeroVenta poblado", !!order.numeroVenta, `numeroVenta: ${order.numeroVenta}`);
  check("clienteId poblado", !!order.clienteId, `clienteId: ${order.clienteId}`);

  if (!order.ventaId) {
    console.log("\n❌ No se creó la venta. No se puede verificar el resto.");
    return { passed, failed: failed + 10 };
  }

  // 2. Verificar venta creada
  console.log("\n  --- Venta ---");
  const ventaDoc = await db.collection("ventas").doc(order.ventaId).get();
  const venta = ventaDoc.data()!;
  check("Venta existe", ventaDoc.exists);
  check("Numero VT-2026-048", venta.numeroVenta === "VT-2026-048", `got: ${venta.numeroVenta}`);
  check("subtotalPEN = 179.80", venta.subtotalPEN === 179.80, `got: ${venta.subtotalPEN}`);
  check("costoEnvio = 15.00", venta.costoEnvio === 15.00, `got: ${venta.costoEnvio}`);
  check("totalPEN = 194.80", venta.totalPEN === 194.80, `got: ${venta.totalPEN}`);
  check("incluyeEnvio = false", venta.incluyeEnvio === false, `got: ${venta.incluyeEnvio}`);
  check("comisionML = 26.97", venta.comisionML === 26.97, `got: ${venta.comisionML}`);
  check("gastosVentaPEN = 26.97", venta.gastosVentaPEN === 26.97, `got: ${venta.gastosVentaPEN}`);
  check("estadoPago = pagado", venta.estadoPago === "pagado", `got: ${venta.estadoPago}`);
  check("montoPagado = 194.80", venta.montoPagado === 194.80, `got: ${venta.montoPagado}`);
  check("montoPendiente = 0", venta.montoPendiente === 0, `got: ${venta.montoPendiente}`);
  check("canal = Mercado Libre", venta.canalNombre === "Mercado Libre", `got: ${venta.canalNombre}`);
  check("mercadoLibreId correcto", venta.mercadoLibreId === "2000000999888", `got: ${venta.mercadoLibreId}`);
  check("coordenadas pobladas", !!venta.coordenadas && venta.coordenadas.lat === -12.0890, `got: ${JSON.stringify(venta.coordenadas)}`);
  check("estado = asignada", venta.estado === "asignada", `got: ${venta.estado}`);
  check("creadoPor = ml-auto-processor", venta.creadoPor === "ml-auto-processor");

  // Verificar rentabilidad
  console.log("\n  --- Rentabilidad ---");
  check("costoTotalPEN > 0", venta.costoTotalPEN > 0, `S/ ${venta.costoTotalPEN?.toFixed(2)}`);
  check("utilidadBrutaPEN > 0", venta.utilidadBrutaPEN > 0, `S/ ${venta.utilidadBrutaPEN?.toFixed(2)}`);
  check("utilidadNetaPEN > 0", venta.utilidadNetaPEN > 0, `S/ ${venta.utilidadNetaPEN?.toFixed(2)}`);
  check("margenBruto > 0", venta.margenBruto > 0, `${venta.margenBruto?.toFixed(1)}%`);
  check("margenNeto > 0", venta.margenNeto > 0, `${venta.margenNeto?.toFixed(1)}%`);
  check("utilidadNetaPEN < utilidadBrutaPEN", (venta.utilidadNetaPEN || 0) < (venta.utilidadBrutaPEN || 0), "comisionML descontada");

  // Verificar productos en venta
  console.log("\n  --- Productos en Venta ---");
  const prodVenta = venta.productos?.[0];
  check("1 producto en venta", venta.productos?.length === 1, `got: ${venta.productos?.length}`);
  if (prodVenta) {
    check("SKU = CRM-001", prodVenta.sku === "CRM-001", `got: ${prodVenta.sku}`);
    check("cantidadAsignada = 2", prodVenta.cantidadAsignada === 2, `got: ${prodVenta.cantidadAsignada}`);
    check("estadoAsignacion = completa", prodVenta.estadoAsignacion === "completa", `got: ${prodVenta.estadoAsignacion}`);
    check("2 unidades asignadas", prodVenta.unidadesAsignadas?.length === 2, `got: ${prodVenta.unidadesAsignadas?.length}`);
    check("costoTotalUnidades > 0", prodVenta.costoTotalUnidades > 0, `S/ ${prodVenta.costoTotalUnidades?.toFixed(2)}`);
  }

  // 3. Verificar cliente creado
  console.log("\n  --- Cliente ---");
  if (order.clienteId) {
    const clienteDoc = await db.collection("clientes").doc(order.clienteId).get();
    const cliente = clienteDoc.data()!;
    check("Cliente existe", clienteDoc.exists);
    check("Nombre = María García López", cliente.nombre === "María García López", `got: ${cliente.nombre}`);
    check("DNI = 45678912", cliente.dniRuc === "45678912", `got: ${cliente.dniRuc}`);
    check("Email = maria.garcia@gmail.com", cliente.email === "maria.garcia@gmail.com", `got: ${cliente.email}`);
    check("Código CLI-011", cliente.codigo === "CLI-011", `got: ${cliente.codigo}`);
    check("creadoPor = ml-auto-processor", cliente.creadoPor === "ml-auto-processor");
    check("Dirección agregada", cliente.direcciones?.length > 0, `direcciones: ${cliente.direcciones?.length}`);
  }

  // 4. Verificar pagos
  console.log("\n  --- Pagos ---");
  check("1 pago en venta", venta.pagos?.length === 1, `got: ${venta.pagos?.length}`);
  if (venta.pagos?.[0]) {
    const pago = venta.pagos[0];
    check("Pago monto = 194.80", pago.monto === 194.80, `got: ${pago.monto}`);
    check("metodoPago = mercado_pago", pago.metodoPago === "mercado_pago", `got: ${pago.metodoPago}`);
    check("Referencia ML", pago.referencia?.includes("ML-"), `got: ${pago.referencia}`);
  }

  // 5. Verificar movimientos de tesorería
  console.log("\n  --- Tesorería ---");
  const movimientos = await db.collection("movimientosTesoreria").get();
  const movs = movimientos.docs.map((d) => d.data());
  const ingreso = movs.find((m) => m.tipo === "ingreso_venta");
  const egreso = movs.find((m) => m.tipo === "gasto_operativo");

  check("Movimiento ingreso_venta existe", !!ingreso);
  if (ingreso) {
    check("Ingreso monto = 194.80", ingreso.monto === 194.80, `got: ${ingreso.monto}`);
    check("Ingreso método = mercado_pago", ingreso.metodo === "mercado_pago");
    check("Ingreso vinculado a venta", !!ingreso.ventaId);
  }

  check("Movimiento gasto_operativo existe", !!egreso);
  if (egreso) {
    check("Egreso monto = 26.97 (comisión)", egreso.monto === 26.97, `got: ${egreso.monto}`);
    check("Egreso vinculado a venta", !!egreso.ventaId);
    check("Egreso vinculado a gasto", !!egreso.gastoId);
  }

  // 6. Verificar cuenta MercadoPago saldo neto
  console.log("\n  --- Saldo Cuenta MP ---");
  const cuentas = await db.collection("cuentasCaja")
    .where("metodoPagoAsociado", "==", "mercado_pago")
    .get();
  if (!cuentas.empty) {
    const cuenta = cuentas.docs[0].data();
    const saldoEsperado = 194.80 - 26.97; // 167.83
    check(
      `Saldo neto = S/ ${saldoEsperado.toFixed(2)}`,
      Math.abs(cuenta.saldoActual - saldoEsperado) < 0.01,
      `got: S/ ${cuenta.saldoActual?.toFixed(2)}`
    );
  }

  // 7. Verificar gasto doc
  console.log("\n  --- Gasto Comisión ML ---");
  const gastosSnapshot = await db.collection("gastos")
    .where("tipo", "==", "comision_ml")
    .get();
  check("Gasto comision_ml creado", !gastosSnapshot.empty, `count: ${gastosSnapshot.size}`);
  if (!gastosSnapshot.empty) {
    const gasto = gastosSnapshot.docs[0].data();
    check("Gasto categoria = GV", gasto.categoria === "GV", `got: ${gasto.categoria}`);
    check("Gasto montoPEN = 26.97", gasto.montoPEN === 26.97, `got: ${gasto.montoPEN}`);
    check("Gasto estado = pagado", gasto.estado === "pagado", `got: ${gasto.estado}`);
    check("Gasto ventaId vinculado", !!gasto.ventaId);
    check("Gasto tiene pago", gasto.pagos?.length === 1);
    check("Gasto número GAS-0094", gasto.numeroGasto === "GAS-0094", `got: ${gasto.numeroGasto}`);
  }

  // 8. Verificar unidades reservadas (FEFO)
  console.log("\n  --- Unidades FEFO ---");
  const reservadas = await db.collection("unidades")
    .where("estado", "==", "reservada")
    .get();
  check("2 unidades reservadas", reservadas.size === 2, `got: ${reservadas.size}`);

  if (reservadas.size >= 2) {
    const unis = reservadas.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Verificar que se reservaron las de vencimiento más cercano (FEFO)
    // Ordenar por fecha antes de comparar (Firestore query result order no garantizado aquí)
    const fechas = unis
      .map((u: any) => u.fechaVencimiento?.toDate().getTime())
      .sort((a: number, b: number) => a - b);
    check("FEFO: primera vence antes que segunda", fechas[0] <= fechas[1], "orden correcto");

    for (const u of unis) {
      const uData = u as any;
      check(`Unidad ${u.id} reservadaPara = ventaId`, uData.reservadaPara === order.ventaId);
    }
  }

  // Resumen
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  RESULTADO: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(50)}\n`);

  return { passed, failed };
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   TEST: ML Order Processor (Firebase Emulators) ║");
  console.log("╚══════════════════════════════════════════════════╝");

  try {
    // 1. Seed data
    const { productoRef } = await seedData();

    // 2. Crear orden de prueba
    const { orderRef, orderData } = await crearOrdenPrueba(productoRef.id);

    // 3. Ejecutar procesamiento
    console.log("\n⚙️  Ejecutando procesarOrdenCompleta()...\n");
    const result = await procesarOrdenCompleta(orderData as any, orderRef);
    console.log(`  → Resultado: ${result.estado}`);
    console.log(`  → Venta: ${result.numeroVenta} (${result.ventaId})`);
    console.log(`  → Cliente: ${result.clienteId}`);
    if (result.advertencias.length > 0) {
      console.log(`  → Advertencias: ${result.advertencias.join(", ")}`);
    }

    // 4. Verificar
    const results = await verificarResultados(orderRef.id);

    // Exit
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (err: any) {
    console.error("\n💥 ERROR FATAL:", err.message);
    console.error(err.stack);
    process.exit(2);
  }
}

main();
