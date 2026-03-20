/**
 * WhatsApp Chatbot - ERP Query Functions
 *
 * Consultas directas a Firestore usando Admin SDK.
 * Cada función retorna texto formateado para WhatsApp.
 */

import * as admin from "firebase-admin";
import { ERPQueryResult } from "./whatsapp.types";

const db = admin.firestore();

// ============================================================
// HELPER: Resolución de rango de fechas (dias relativo O fechas absolutas)
// ============================================================

interface DateRange {
  inicio: admin.firestore.Timestamp;
  fin?: admin.firestore.Timestamp;
  label: string;
  skipFilter?: boolean; // true when dias=0 and no fechaDesde → all history
}

function buildDateRange(params: {
  dias?: number;
  fechaDesde?: string;
  fechaHasta?: string;
}): DateRange {
  // Fechas absolutas tienen prioridad
  if (params.fechaDesde) {
    const desde = new Date(params.fechaDesde + "T00:00:00");
    const hastaStr = params.fechaHasta || new Date().toISOString().split("T")[0];
    const hasta = new Date(hastaStr + "T23:59:59.999");

    const fmtDesde = desde.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
    const fmtHasta = hasta.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
    const label = params.fechaHasta ? `${fmtDesde} al ${fmtHasta}` : `desde ${fmtDesde}`;

    return {
      inicio: admin.firestore.Timestamp.fromDate(desde),
      fin: admin.firestore.Timestamp.fromDate(hasta),
      label,
    };
  }

  // Fallback: dias relativo
  const dias = params.dias ?? 7;
  if (dias === 0) {
    // dias=0 significa "todo el historial" — no filtrar
    return {
      inicio: admin.firestore.Timestamp.fromDate(new Date(0)),
      label: "TODO EL HISTORIAL",
      skipFilter: true,
    };
  }

  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  desde.setHours(0, 0, 0, 0);

  return {
    inicio: admin.firestore.Timestamp.fromDate(desde),
    label: dias <= 1 ? "HOY" : `ÚLTIMOS ${dias} DÍAS`,
  };
}

function buildDateQuery(
  collection: FirebaseFirestore.CollectionReference,
  dateField: string,
  range: DateRange
): FirebaseFirestore.Query {
  if (range.skipFilter) return collection;
  let q: FirebaseFirestore.Query = collection.where(dateField, ">=", range.inicio);
  if (range.fin) q = q.where(dateField, "<=", range.fin);
  return q;
}

// Colecciones
const COL = {
  PRODUCTOS: "productos",
  UNIDADES: "unidades",
  VENTAS: "ventas",
  ORDENES_COMPRA: "ordenesCompra",
  COTIZACIONES: "cotizaciones",
  CLIENTES: "clientes",
  GASTOS: "gastos",
  CUENTAS_CAJA: "cuentasCaja",
  TIPOS_CAMBIO: "tiposCambio",
  ENTREGAS: "entregas",
  MOVIMIENTOS_TESORERIA: "movimientosTesoreria",
} as const;

// ============================================================
// BÚSQUEDA FLEXIBLE (maneja "/", variantes, palabras parciales)
// ============================================================

/**
 * Crea un matcher flexible para búsquedas de productos.
 * "Ultimate Omega Kids/Junior" matchea "Ultimate Omega Kids" y "Junior".
 * "Nordic Naturals Omega" matchea cualquier texto con ambas palabras.
 */
function createFlexMatcher(busqueda: string): (text: string) => boolean {
  const term = busqueda.toLowerCase();
  const subTerms: string[] = [];

  // Dividir por "/" para buscar cada variante
  if (term.includes("/")) {
    for (const part of term.split("/")) {
      const trimmed = part.trim();
      if (trimmed.length >= 3) subTerms.push(trimmed);
    }
  }

  // Palabras significativas (>= 4 chars)
  const words = term.replace(/[/,\-()]/g, " ").split(/\s+/).filter(w => w.length >= 4);

  return (text: string): boolean => {
    if (!text) return false;
    const t = text.toLowerCase();
    // Match exacto/parcial con term completo
    if (t.includes(term)) return true;
    // Match con sub-términos (por "/")
    for (const st of subTerms) {
      if (t.includes(st)) return true;
    }
    // Match si TODAS las palabras significativas están presentes (mínimo 2)
    if (words.length >= 2 && words.every(w => t.includes(w))) return true;
    return false;
  };
}

// ============================================================
// INVENTARIO
// ============================================================

/**
 * Consulta stock de un producto por nombre (búsqueda parcial)
 */
export async function consultarStock(
  busqueda: string
): Promise<ERPQueryResult> {
  try {
    // Buscar producto por nombre (flexible: maneja "/", variantes, palabras parciales)
    const productosSnap = await db.collection(COL.PRODUCTOS).get();
    const flexMatch = createFlexMatcher(busqueda);

    const matches = productosSnap.docs.filter((doc) => {
      const data = doc.data();
      const nombre = (data.nombreComercial || data.nombre || "").toLowerCase();
      const sku = (data.sku || "").toLowerCase();
      const marca = (data.marcaNombre || data.marca || "").toLowerCase();
      const presentacion = (data.presentacion || "").toLowerCase();
      const fullText = `${marca} ${nombre} ${presentacion} ${sku}`;
      return flexMatch(fullText);
    });

    if (matches.length === 0) {
      return { success: true, data: `No encontré productos con "${busqueda}".` };
    }

    // Limitar a 5 resultados
    const top = matches.slice(0, 5);
    const lines: string[] = ["*Stock actual:*\n"];

    for (const doc of top) {
      const p = doc.data();
      const nombreCompleto = formatProductName(p as Record<string, unknown>);
      const stockUSA = p.stockUSA || 0;
      const stockPeru = p.stockPeru || 0;
      const stockTransito = p.stockTransito || 0;
      const reservado = p.stockReservado || 0;
      const disponible = (p.stockDisponible != null) ? p.stockDisponible : (stockPeru - reservado);
      const total = stockUSA + stockPeru + stockTransito;
      const marca = p.marcaNombre || p.marca || "";

      lines.push(
        `*${nombreCompleto}*`,
        `  SKU: ${p.sku || "—"} | Marca: ${marca || "—"}`,
        `  🇺🇸 USA: ${stockUSA} | 🇵🇪 Peru: ${stockPeru} | ✈️ Tránsito: ${stockTransito}`,
        `  Reservado: ${reservado} | Disponible: ${disponible} | Total: ${total}`,
        ""
      );
    }

    if (matches.length > 5) {
      lines.push(`_(+${matches.length - 5} productos más)_`);
    }

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error consultarStock:", error);
    return { success: false, error: "Error consultando inventario" };
  }
}

/**
 * Productos con stock bajo (< umbral o 0)
 */
export async function consultarStockBajo(): Promise<ERPQueryResult> {
  try {
    const snap = await db.collection(COL.PRODUCTOS)
      .where("activo", "==", true)
      .get();

    const bajos: Array<{ nombre: string; sku: string; total: number; stockPeru: number; stockUSA: number }>  = [];

    for (const doc of snap.docs) {
      const p = doc.data();
      const stockPeru = p.stockPeru || 0;
      const stockUSA = p.stockUSA || 0;
      const total = stockPeru + stockUSA;
      const umbral = p.stockMinimo || 3;
      if (total <= umbral) {
        bajos.push({
          nombre: formatProductName(p as Record<string, unknown>),
          sku: p.sku || "",
          total,
          stockPeru,
          stockUSA,
        });
      }
    }

    if (bajos.length === 0) {
      return { success: true, data: "No hay productos con stock bajo." };
    }

    bajos.sort((a, b) => a.total - b.total);

    const lines = ["*Productos con stock bajo:*\n"];
    for (const p of bajos.slice(0, 15)) {
      const emoji = p.total === 0 ? "🔴" : "🟡";
      lines.push(`${emoji} *${p.nombre}* (${p.sku}): ${p.total} uds (Peru: ${p.stockPeru} | USA: ${p.stockUSA})`);
    }

    if (bajos.length > 15) {
      lines.push(`\n_(+${bajos.length - 15} más)_`);
    }

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error consultarStockBajo:", error);
    return { success: false, error: "Error consultando stock bajo" };
  }
}

// ============================================================
// VENTAS
// ============================================================

/**
 * Resumen de ventas de hoy
 */
export async function ventasHoy(): Promise<ERPQueryResult> {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const inicio = admin.firestore.Timestamp.fromDate(hoy);

    const snap = await db.collection(COL.VENTAS)
      .where("fechaCreacion", ">=", inicio)
      .get();

    if (snap.empty) {
      return { success: true, data: "No hay ventas registradas hoy." };
    }

    let totalPEN = 0;
    let totalUSD = 0;
    let cantVentas = 0;

    for (const doc of snap.docs) {
      const v = doc.data();
      cantVentas++;
      const monto = v.montoTotal || v.total || 0;
      if (v.moneda === "USD") {
        totalUSD += monto;
      } else {
        totalPEN += monto;
      }
    }

    const lines = [
      "*Ventas de hoy:*\n",
      `Cantidad: ${cantVentas} ventas`,
    ];

    if (totalPEN > 0) lines.push(`Total PEN: S/ ${totalPEN.toFixed(2)}`);
    if (totalUSD > 0) lines.push(`Total USD: $ ${totalUSD.toFixed(2)}`);

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error ventasHoy:", error);
    return { success: false, error: "Error consultando ventas de hoy" };
  }
}

/**
 * Resumen de ventas de los últimos N días
 */
export async function resumenVentas(dias = 7): Promise<ERPQueryResult> {
  try {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    desde.setHours(0, 0, 0, 0);
    const inicio = admin.firestore.Timestamp.fromDate(desde);

    const snap = await db.collection(COL.VENTAS)
      .where("fechaCreacion", ">=", inicio)
      .get();

    let totalPEN = 0;
    let totalUSD = 0;
    let cantVentas = 0;
    const porEstado: Record<string, number> = {};

    for (const doc of snap.docs) {
      const v = doc.data();
      cantVentas++;
      const monto = v.montoTotal || v.total || 0;
      if (v.moneda === "USD") {
        totalUSD += monto;
      } else {
        totalPEN += monto;
      }
      const estado = v.estado || "sin_estado";
      porEstado[estado] = (porEstado[estado] || 0) + 1;
    }

    const lines = [
      `*Resumen de ventas (últimos ${dias} días):*\n`,
      `Total: ${cantVentas} ventas`,
    ];

    if (totalPEN > 0) lines.push(`Ingresos PEN: S/ ${totalPEN.toFixed(2)}`);
    if (totalUSD > 0) lines.push(`Ingresos USD: $ ${totalUSD.toFixed(2)}`);

    if (Object.keys(porEstado).length > 0) {
      lines.push("\n*Por estado:*");
      for (const [estado, count] of Object.entries(porEstado)) {
        lines.push(`  ${estado}: ${count}`);
      }
    }

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error resumenVentas:", error);
    return { success: false, error: "Error consultando resumen de ventas" };
  }
}

/**
 * Estado de una venta específica por número (VT-XXX)
 */
export async function estadoVenta(
  numeroVenta: string
): Promise<ERPQueryResult> {
  try {
    const num = numeroVenta.toUpperCase().replace(/\s/g, "");
    const snap = await db.collection(COL.VENTAS)
      .where("numero", "==", num)
      .limit(1)
      .get();

    if (snap.empty) {
      return { success: true, data: `No encontré la venta ${num}.` };
    }

    const v = snap.docs[0].data();
    const monto = v.montoTotal || v.total || 0;
    const moneda = v.moneda === "USD" ? "$" : "S/";

    const lines = [
      `*Venta ${v.numero}*\n`,
      `Estado: ${v.estado || "—"}`,
      `Cliente: ${v.clienteNombre || "—"}`,
      `Monto: ${moneda} ${monto.toFixed(2)}`,
      `Fecha: ${formatTimestamp(v.fechaCreacion)}`,
    ];

    if (v.productos && Array.isArray(v.productos)) {
      lines.push(`Productos: ${v.productos.length} items`);
    }

    if (v.canal) {
      lines.push(`Canal: ${v.canal}`);
    }

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error estadoVenta:", error);
    return { success: false, error: "Error consultando venta" };
  }
}

// ============================================================
// ÓRDENES DE COMPRA
// ============================================================

/**
 * OCs pendientes o en tránsito
 */
export async function ocsPendientes(): Promise<ERPQueryResult> {
  try {
    const snap = await db.collection(COL.ORDENES_COMPRA).get();

    const pendientes = snap.docs.filter((doc) => {
      const estado = doc.data().estado;
      return ["pendiente", "aprobada", "enviada", "en_transito"].includes(estado);
    });

    if (pendientes.length === 0) {
      return { success: true, data: "No hay órdenes de compra pendientes." };
    }

    const lines = ["*OCs pendientes/en tránsito:*\n"];

    for (const doc of pendientes.slice(0, 10)) {
      const oc = doc.data();
      const monto = oc.montoTotal || oc.total || 0;
      const moneda = oc.moneda === "USD" ? "$" : "S/";
      lines.push(
        `*${oc.numero || doc.id}* — ${oc.estado}`,
        `  Proveedor: ${oc.proveedorNombre || "—"}`,
        `  Monto: ${moneda} ${monto.toFixed(2)}`,
        ""
      );
    }

    if (pendientes.length > 10) {
      lines.push(`_(+${pendientes.length - 10} más)_`);
    }

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error ocsPendientes:", error);
    return { success: false, error: "Error consultando OCs" };
  }
}

/**
 * OCs recientes de los últimos N días (TODAS, cualquier estado)
 * Para cuando preguntan "última compra del mes", "qué hemos comprado", etc.
 */
export async function ocsRecientes(dias = 30, fechaDesde?: string, fechaHasta?: string): Promise<ERPQueryResult> {
  try {
    const range = buildDateRange({ dias, fechaDesde, fechaHasta });
    const snap = await buildDateQuery(db.collection(COL.ORDENES_COMPRA), "fechaCreacion", range).get();

    if (snap.empty) {
      return { success: true, data: `No hay órdenes de compra registradas en ${range.label}.` };
    }

    // Ordenar por fecha descendente
    const docs = snap.docs.sort((a, b) => {
      const fa = a.data().fechaCreacion?.toDate?.() || new Date(0);
      const fb = b.data().fechaCreacion?.toDate?.() || new Date(0);
      return fb.getTime() - fa.getTime();
    });

    let totalUSD = 0;
    let totalPEN = 0;
    const porEstado: Record<string, number> = {};
    const ocsDetalle: string[] = [];

    for (const doc of docs) {
      const oc = doc.data();
      const montoUSD = oc.totalUSD || oc.montoTotal || 0;
      const montoPEN = oc.totalPEN || 0;
      totalUSD += montoUSD;
      totalPEN += montoPEN;

      const estado = oc.estado || "sin_estado";
      porEstado[estado] = (porEstado[estado] || 0) + 1;

      if (ocsDetalle.length < 60) { // permitir más líneas para detalle rico
        const fecha = formatTimestamp(oc.fechaCreacion);
        const numero = oc.numeroOrden || oc.numero || doc.id.substring(0, 10);
        const proveedor = oc.nombreProveedor || oc.proveedorNombre || "—";

        ocsDetalle.push(
          `• *${numero}* | ${fecha} | ${proveedor} | ${estado} | *$ ${montoUSD.toFixed(2)} USD*`
        );

        // Detalle de cada producto con cantidad, precio unitario y variantes
        if (oc.productos && Array.isArray(oc.productos)) {
          for (const p of oc.productos.slice(0, 5) as Array<Record<string, unknown>>) {
            const nombreCompleto = formatProductName(p);
            const cant = (p.cantidad || 0) as number;
            const costoUnit = (p.costoUnitario || 0) as number;
            const subtotal = (p.subtotal || cant * costoUnit) as number;

            ocsDetalle.push(`  - ${nombreCompleto}: ${cant} uds × $${costoUnit.toFixed(2)} = *$${subtotal.toFixed(2)}*`);
          }
          if (oc.productos.length > 5) {
            ocsDetalle.push(`  (+${oc.productos.length - 5} productos más)`);
          }
        }
        ocsDetalle.push("");
      }
    }

    const periodo = dias <= 31 ? "ESTE MES" : `ÚLTIMOS ${dias} DÍAS`;
    const lines = [`ÓRDENES DE COMPRA ${periodo}:\n`];

    lines.push(`Total OCs: ${docs.length}`);
    lines.push(`*Monto total: $ ${totalUSD.toFixed(2)} USD*`);
    if (totalPEN > 0) lines.push(`Equivalente: S/ ${totalPEN.toFixed(2)}`);

    // Por estado
    lines.push("\nPOR ESTADO:");
    for (const [estado, count] of Object.entries(porEstado)) {
      lines.push(`  ${estado}: ${count}`);
    }

    // Detalle
    if (ocsDetalle.length > 0) {
      lines.push("\nDETALLE:");
      lines.push(...ocsDetalle.filter(l => l !== ""));
      if (docs.length > 15) {
        lines.push(`  ... y ${docs.length - 15} OCs más`);
      }
    }

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error ocsRecientes:", error);
    return { success: false, error: "Error consultando OCs recientes" };
  }
}

/**
 * Estado de una OC específica
 */
export async function estadoOC(numeroOC: string): Promise<ERPQueryResult> {
  try {
    const num = numeroOC.toUpperCase().replace(/\s/g, "");
    const snap = await db.collection(COL.ORDENES_COMPRA)
      .where("numero", "==", num)
      .limit(1)
      .get();

    if (snap.empty) {
      return { success: true, data: `No encontré la OC ${num}.` };
    }

    const oc = snap.docs[0].data();
    const monto = oc.montoTotal || oc.total || 0;
    const moneda = oc.moneda === "USD" ? "$" : "S/";

    const lines = [
      `*OC ${oc.numero}*\n`,
      `Estado: ${oc.estado || "—"}`,
      `Proveedor: ${oc.proveedorNombre || "—"}`,
      `Monto: ${moneda} ${monto.toFixed(2)}`,
      `Fecha: ${formatTimestamp(oc.fechaCreacion)}`,
    ];

    if (oc.productos && Array.isArray(oc.productos)) {
      lines.push(`Productos: ${oc.productos.length} items`);
    }

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error estadoOC:", error);
    return { success: false, error: "Error consultando OC" };
  }
}

// ============================================================
// RESUMEN GENERAL
// ============================================================

/**
 * Resumen rápido del día: ventas, stock bajo, OCs pendientes
 */
export async function resumenDia(): Promise<ERPQueryResult> {
  try {
    const [ventasRes, stockBajoRes, ocsRes] = await Promise.all([
      ventasHoy(),
      consultarStockBajo(),
      ocsPendientes(),
    ]);

    const lines = ["*📊 Resumen del día*\n"];

    lines.push("— VENTAS HOY —");
    lines.push(ventasRes.data || "Sin datos");
    lines.push("");

    // Contar stock bajo (contar líneas con emoji)
    const stockData = stockBajoRes.data || "";
    const stockCount = (stockData.match(/🔴|🟡/g) || []).length;
    lines.push(`— STOCK BAJO: ${stockCount} productos —`);
    if (stockCount > 0 && stockCount <= 5) {
      lines.push(stockData);
    } else if (stockCount > 5) {
      lines.push(`${stockCount} productos con stock bajo. Escribe "stock bajo" para ver detalle.`);
    } else {
      lines.push("Todo en orden.");
    }
    lines.push("");

    // OCs
    lines.push(`— OCs PENDIENTES —`);
    lines.push(ocsRes.data || "Ninguna pendiente");

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error resumenDia:", error);
    return { success: false, error: "Error generando resumen" };
  }
}

// ============================================================
// BÚSQUEDA DE PRODUCTO (para modo ventas)
// ============================================================

/**
 * Busca producto con precio y disponibilidad (para consultas de clientes)
 */
export async function buscarProductoVenta(
  busqueda: string
): Promise<ERPQueryResult> {
  try {
    const snap = await db.collection(COL.PRODUCTOS).get();
    const flexMatch = createFlexMatcher(busqueda);

    const matches = snap.docs.filter((doc) => {
      const data = doc.data();
      const nombre = (data.nombreComercial || data.nombre || "");
      const sku = (data.sku || "");
      const marca = (data.marcaNombre || data.marca || "");
      return flexMatch(`${marca} ${nombre} ${sku}`);
    });

    if (matches.length === 0) {
      return { success: true, data: `No encontré productos con "${busqueda}".` };
    }

    const lines = ["*Productos encontrados:*\n"];

    for (const doc of matches.slice(0, 5)) {
      const p = doc.data();
      const nombreCompleto = formatProductName(p as Record<string, unknown>);
      const disponible = (p.stockDisponible != null) ? p.stockDisponible : ((p.stockPeru || 0) - (p.stockReservado || 0));
      const precio = p.precioSugerido || p.precioVenta || p.precio || 0;
      const marca = p.marcaNombre || p.marca || "—";

      lines.push(
        `*${nombreCompleto}*`,
        `  SKU: ${p.sku || "—"} | Marca: ${marca}`,
        `  Precio sugerido: S/ ${precio.toFixed(2)}`,
        `  Disponible: ${disponible > 0 ? disponible + " uds" : "⚠️ Sin stock"}`,
        `  Stock Peru: ${p.stockPeru || 0} | USA: ${p.stockUSA || 0} | Tránsito: ${p.stockTransito || 0}`,
        ""
      );
    }

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error buscarProductoVenta:", error);
    return { success: false, error: "Error buscando producto" };
  }
}

// ============================================================
// VENTAS DETALLADAS (para contexto AI)
// ============================================================

/**
 * Ventas detalladas de los últimos N días.
 * Retorna info rica: cada venta con cliente, canal, productos, montos.
 * Esto le da al AI suficiente contexto para responder cualquier pregunta.
 */
export async function ventasDetalladas(dias = 7, fechaDesde?: string, fechaHasta?: string): Promise<ERPQueryResult> {
  try {
    const range = buildDateRange({ dias, fechaDesde, fechaHasta });
    const snap = await buildDateQuery(db.collection(COL.VENTAS), "fechaCreacion", range).get();

    if (snap.empty) {
      return { success: true, data: `No hay ventas registradas en ${range.label}.` };
    }

    let totalPEN = 0;
    let totalUSD = 0;
    let cantVentas = 0;
    const porEstado: Record<string, number> = {};
    const porCanal: Record<string, { count: number; totalPEN: number }> = {};
    const ventasDetalle: string[] = [];
    const productosCantidad: Record<string, { nombre: string; cantidad: number; totalPEN: number }> = {};

    for (const doc of snap.docs) {
      const v = doc.data();
      cantVentas++;

      const monto = v.totalPEN || v.montoTotal || v.total || 0;
      const moneda = v.moneda === "USD" ? "USD" : "PEN";
      if (moneda === "USD") {
        totalUSD += monto;
      } else {
        totalPEN += monto;
      }

      // Por estado
      const estado = v.estado || "sin_estado";
      porEstado[estado] = (porEstado[estado] || 0) + 1;

      // Por canal
      const canal = v.canalNombre || v.canal || "directo";
      if (!porCanal[canal]) porCanal[canal] = { count: 0, totalPEN: 0 };
      porCanal[canal].count++;
      if (moneda === "PEN") porCanal[canal].totalPEN += monto;

      // Detalle de cada venta (máx 15 para no sobrecargar, pero con productos)
      if (ventasDetalle.length < 60) {
        const simbolo = moneda === "USD" ? "$" : "S/";
        const fecha = formatTimestamp(v.fechaCreacion);
        const cliente = v.nombreCliente || "Sin nombre";
        const numero = v.numeroVenta || v.numero || doc.id.substring(0, 8);
        ventasDetalle.push(
          `• ${numero} | ${fecha} | ${cliente} | ${simbolo} ${monto.toFixed(2)} | ${canal} | ${estado}`
        );
        // Agregar productos de esta venta
        const prodsVenta = v.productos || [];
        for (const p of prodsVenta.slice(0, 4)) {
          const nombreProd = formatProductName(p as Record<string, unknown>);
          const cant = p.cantidad || 1;
          const precioUnit = p.precioUnitario || 0;
          ventasDetalle.push(`  - ${nombreProd}: ${cant} uds × S/ ${precioUnit.toFixed(2)}`);
        }
        if (prodsVenta.length > 4) {
          ventasDetalle.push(`  (+${prodsVenta.length - 4} productos más)`);
        }
      }

      // Acumular productos vendidos
      const productos = v.productos || [];
      for (const p of productos) {
        const key = p.productoId || p.sku || p.nombreComercial || "desconocido";
        const nombre = formatProductName(p as Record<string, unknown>);
        if (!productosCantidad[key]) {
          productosCantidad[key] = { nombre, cantidad: 0, totalPEN: 0 };
        }
        productosCantidad[key].cantidad += p.cantidad || 1;
        productosCantidad[key].totalPEN += p.subtotal || (p.precioUnitario || 0) * (p.cantidad || 1);
      }
    }

    // Construir respuesta rica
    const periodo = dias === 0 ? "HOY" : `ÚLTIMOS ${dias} DÍAS`;
    const lines = [`VENTAS ${periodo}:\n`];

    // Totales
    lines.push(`Total de ventas: ${cantVentas}`);
    if (totalPEN > 0) lines.push(`Ingresos PEN: S/ ${totalPEN.toFixed(2)}`);
    if (totalUSD > 0) lines.push(`Ingresos USD: $ ${totalUSD.toFixed(2)}`);

    // Por estado
    lines.push("\nPOR ESTADO:");
    for (const [estado, count] of Object.entries(porEstado)) {
      lines.push(`  ${estado}: ${count}`);
    }

    // Por canal
    lines.push("\nPOR CANAL:");
    for (const [canal, info] of Object.entries(porCanal)) {
      lines.push(`  ${canal}: ${info.count} ventas (S/ ${info.totalPEN.toFixed(2)})`);
    }

    // Top productos
    const topProductos = Object.values(productosCantidad)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);

    if (topProductos.length > 0) {
      lines.push("\nPRODUCTOS MÁS VENDIDOS:");
      for (const p of topProductos) {
        lines.push(`  ${p.nombre}: ${p.cantidad} uds (S/ ${p.totalPEN.toFixed(2)})`);
      }
    }

    // Detalle individual
    if (ventasDetalle.length > 0) {
      lines.push("\nDETALLE DE VENTAS:");
      lines.push(...ventasDetalle);
      if (cantVentas > 20) {
        lines.push(`  ... y ${cantVentas - 20} ventas más`);
      }
    }

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error ventasDetalladas:", error);
    return { success: false, error: "Error consultando ventas detalladas" };
  }
}

// ============================================================
// CAJA Y TESORERÍA
// ============================================================

/**
 * Saldos de todas las cuentas de caja
 */
export async function saldosCaja(): Promise<ERPQueryResult> {
  try {
    const snap = await db.collection(COL.CUENTAS_CAJA)
      .where("activo", "==", true)
      .get();

    if (snap.empty) {
      return { success: true, data: "No hay cuentas de caja configuradas." };
    }

    const lines = ["SALDOS DE CAJA:\n"];
    let totalPEN = 0;
    let totalUSD = 0;

    for (const doc of snap.docs) {
      const c = doc.data();
      const saldo = c.saldoActual || 0;
      const moneda = c.moneda === "USD" ? "$" : "S/";
      const simbolo = c.moneda === "USD" ? "USD" : "PEN";

      if (simbolo === "USD") totalUSD += saldo;
      else totalPEN += saldo;

      const tipo = c.tipo === "banco" ? `🏦 ${c.banco || "Banco"}` : "💵 Caja";
      lines.push(`${tipo} - *${c.nombre}* (${simbolo}): ${moneda} ${saldo.toFixed(2)}`);
    }

    lines.push("");
    if (totalPEN > 0) lines.push(`*Total PEN: S/ ${totalPEN.toFixed(2)}*`);
    if (totalUSD > 0) lines.push(`*Total USD: $ ${totalUSD.toFixed(2)}*`);

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error saldosCaja:", error);
    return { success: false, error: "Error consultando caja" };
  }
}

// ============================================================
// GASTOS
// ============================================================

/**
 * Resumen de gastos de los últimos N días
 */
export async function gastosResumen(dias = 30, fechaDesde?: string, fechaHasta?: string): Promise<ERPQueryResult> {
  try {
    const range = buildDateRange({ dias, fechaDesde, fechaHasta });
    const snap = await buildDateQuery(db.collection(COL.GASTOS), "fecha", range).get();

    if (snap.empty) {
      return { success: true, data: `No hay gastos registrados en ${range.label}.` };
    }

    let totalPEN = 0;
    const porCategoria: Record<string, number> = {};
    const porTipo: Record<string, number> = {};
    const gastosDetalle: string[] = [];

    for (const doc of snap.docs) {
      const g = doc.data();
      const monto = g.montoPEN || g.montoOriginal || 0;
      totalPEN += monto;

      const cat = g.categoria || "sin_categoria";
      porCategoria[cat] = (porCategoria[cat] || 0) + monto;

      const tipo = g.tipo || "otros";
      porTipo[tipo] = (porTipo[tipo] || 0) + monto;

      if (gastosDetalle.length < 15) {
        const fecha = formatTimestamp(g.fecha);
        const desc = g.descripcion || g.tipo || "—";
        gastosDetalle.push(`- ${fecha} | ${desc} | S/ ${monto.toFixed(2)} | ${cat}`);
      }
    }

    const lines = [`GASTOS ÚLTIMOS ${dias} DÍAS:\n`];
    lines.push(`Total gastos: ${snap.size}`);
    lines.push(`*Monto total: S/ ${totalPEN.toFixed(2)}*`);

    lines.push("\nPOR CATEGORÍA:");
    for (const [cat, monto] of Object.entries(porCategoria).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${cat}: S/ ${monto.toFixed(2)}`);
    }

    lines.push("\nPOR TIPO:");
    for (const [tipo, monto] of Object.entries(porTipo).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      lines.push(`  ${tipo}: S/ ${monto.toFixed(2)}`);
    }

    if (gastosDetalle.length > 0) {
      lines.push("\nÚLTIMOS GASTOS:");
      lines.push(...gastosDetalle);
    }

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error gastosResumen:", error);
    return { success: false, error: "Error consultando gastos" };
  }
}

// ============================================================
// CLIENTES
// ============================================================

/**
 * Buscar cliente por nombre y ver historial de compras
 */
export async function buscarCliente(busqueda: string): Promise<ERPQueryResult> {
  try {
    const snap = await db.collection(COL.CLIENTES).get();
    const term = busqueda.toLowerCase();

    const matches = snap.docs.filter((doc) => {
      const data = doc.data();
      const nombre = (data.nombre || "").toLowerCase();
      const email = (data.email || "").toLowerCase();
      const telefono = (data.telefono || "").replace(/\D/g, "");
      const cleanTerm = term.replace(/\D/g, "");
      return nombre.includes(term) || email.includes(term) ||
        (cleanTerm.length >= 5 && telefono.includes(cleanTerm));
    });

    if (matches.length === 0) {
      return { success: true, data: `No encontré clientes con "${busqueda}".` };
    }

    const lines = ["CLIENTES ENCONTRADOS:\n"];

    for (const doc of matches.slice(0, 5)) {
      const c = doc.data();
      lines.push(
        `*${c.nombre}*`,
        `  Tel: ${c.telefono || "—"} | Email: ${c.email || "—"}`,
        `  Ciudad: ${c.ciudad || "—"} | Tipo: ${c.tipoCliente || "—"}`,
      );

      if (c.saldoActual) {
        lines.push(`  Saldo pendiente: S/ ${(c.saldoActual || 0).toFixed(2)}`);
      }
      if (c.creditoLimite) {
        lines.push(`  Crédito: S/ ${(c.creditoDisponible || 0).toFixed(2)} de S/ ${(c.creditoLimite || 0).toFixed(2)}`);
      }

      // Buscar últimas ventas del cliente
      const clienteId = doc.id;
      const ventasSnap = await db.collection(COL.VENTAS)
        .where("clienteId", "==", clienteId)
        .orderBy("fechaCreacion", "desc")
        .limit(5)
        .get();

      if (!ventasSnap.empty) {
        lines.push(`  *Últimas ${ventasSnap.size} compras:*`);
        for (const vDoc of ventasSnap.docs) {
          const v = vDoc.data();
          const monto = v.totalPEN || v.montoTotal || 0;
          const fecha = formatTimestamp(v.fechaCreacion);
          lines.push(`    ${v.numeroVenta || "—"} | ${fecha} | S/ ${monto.toFixed(2)} | ${v.estado}`);
        }
      } else {
        lines.push("  Sin compras registradas");
      }
      lines.push("");
    }

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error buscarCliente:", error);
    return { success: false, error: "Error buscando cliente" };
  }
}

// ============================================================
// ENTREGAS
// ============================================================

/**
 * Entregas pendientes / programadas
 */
export async function entregasPendientes(): Promise<ERPQueryResult> {
  try {
    const snap = await db.collection(COL.ENTREGAS).get();

    const pendientes = snap.docs.filter((doc) => {
      const estado = doc.data().estado;
      return ["programada", "en_camino"].includes(estado);
    });

    if (pendientes.length === 0) {
      // Buscar ventas en estado en_entrega o despachada como alternativa
      const ventasSnap = await db.collection(COL.VENTAS)
        .where("estado", "in", ["en_entrega", "despachada", "asignada"])
        .get();

      if (ventasSnap.empty) {
        return { success: true, data: "No hay entregas pendientes." };
      }

      const lines = ["VENTAS PENDIENTES DE ENTREGA:\n"];
      for (const doc of ventasSnap.docs.slice(0, 15)) {
        const v = doc.data();
        const fecha = formatTimestamp(v.fechaCreacion);
        const cliente = v.nombreCliente || "—";
        const distrito = v.distrito || "—";
        lines.push(`- ${v.numeroVenta || "—"} | ${cliente} | ${distrito} | ${v.estado} | ${fecha}`);
      }
      if (ventasSnap.size > 15) {
        lines.push(`  ... y ${ventasSnap.size - 15} más`);
      }
      return { success: true, data: lines.join("\n") };
    }

    const lines = ["ENTREGAS PENDIENTES:\n"];

    for (const doc of pendientes.slice(0, 15)) {
      const e = doc.data();
      const fecha = formatTimestamp(e.fechaProgramada || e.fechaCreacion);
      lines.push(
        `- ${e.codigo || doc.id} | ${e.estado}`,
        `  Cliente: ${e.clienteNombre || "—"} | Dirección: ${e.direccionEntrega || "—"}`,
        `  Fecha: ${fecha}`,
        ""
      );
    }

    if (pendientes.length > 15) {
      lines.push(`_(+${pendientes.length - 15} más)_`);
    }

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error entregasPendientes:", error);
    return { success: false, error: "Error consultando entregas" };
  }
}

// ============================================================
// TIPO DE CAMBIO
// ============================================================

/**
 * Tipo de cambio del día (o el más reciente)
 */
export async function tipoCambioHoy(): Promise<ERPQueryResult> {
  try {
    const snap = await db.collection(COL.TIPOS_CAMBIO)
      .orderBy("fecha", "desc")
      .limit(3)
      .get();

    if (snap.empty) {
      return { success: true, data: "No hay datos de tipo de cambio registrados." };
    }

    const lines = ["TIPO DE CAMBIO:\n"];

    for (const doc of snap.docs) {
      const tc = doc.data();
      const fecha = formatTimestamp(tc.fecha);
      const compra = tc.compra ? `Compra: ${tc.compra.toFixed(4)}` : "";
      const venta = tc.venta ? `Venta: ${tc.venta.toFixed(4)}` : "";
      const promedio = tc.promedio ? `Promedio: ${tc.promedio.toFixed(4)}` : "";
      lines.push(`${fecha}: ${compra} | ${venta} | ${promedio}`);
    }

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error tipoCambioHoy:", error);
    return { success: false, error: "Error consultando tipo de cambio" };
  }
}

// ============================================================
// RENTABILIDAD
// ============================================================

/**
 * Rentabilidad de ventas recientes (margen, utilidad)
 */
export async function rentabilidadReciente(dias = 30, fechaDesde?: string, fechaHasta?: string): Promise<ERPQueryResult> {
  try {
    const range = buildDateRange({ dias, fechaDesde, fechaHasta });
    const snap = await buildDateQuery(db.collection(COL.VENTAS), "fechaCreacion", range).get();

    if (snap.empty) {
      return { success: true, data: `No hay ventas en ${range.label} para analizar rentabilidad.` };
    }

    let totalVentas = 0;
    let totalCosto = 0;
    let totalUtilidadBruta = 0;
    let totalUtilidadNeta = 0;
    let ventasConMargen = 0;
    let sumaMargenBruto = 0;
    let sumaMargenNeto = 0;
    const porProducto: Record<string, { nombre: string; ingreso: number; costo: number; margen: number; cantidad: number }> = {};

    for (const doc of snap.docs) {
      const v = doc.data();
      const ingreso = v.totalPEN || v.montoTotal || 0;
      totalVentas += ingreso;

      if (v.costoTotalPEN) {
        totalCosto += v.costoTotalPEN;
      }
      if (v.utilidadBrutaPEN != null) {
        totalUtilidadBruta += v.utilidadBrutaPEN;
      }
      if (v.utilidadNetaPEN != null) {
        totalUtilidadNeta += v.utilidadNetaPEN;
      }
      if (v.margenBruto != null) {
        ventasConMargen++;
        sumaMargenBruto += v.margenBruto;
      }
      if (v.margenNeto != null) {
        sumaMargenNeto += v.margenNeto;
      }

      // Rentabilidad por producto — agrupar por nombre normalizado para evitar duplicados por productoId inconsistente
      const productos = v.productos || [];
      for (const p of productos) {
        const nombre = formatProductName(p as Record<string, unknown>);
        const key = (p.nombreComercial || p.nombre || p.sku || p.productoId || "desconocido").toLowerCase().trim();
        if (!porProducto[key]) {
          porProducto[key] = { nombre, ingreso: 0, costo: 0, margen: 0, cantidad: 0 };
        }
        porProducto[key].ingreso += p.subtotal || 0;
        porProducto[key].costo += p.costoTotalUnidades || 0;
        porProducto[key].cantidad += p.cantidad || 1;
        if (p.margenReal != null) {
          porProducto[key].margen = p.margenReal; // último margen conocido
        }
      }
    }

    const lines = [`RENTABILIDAD ${range.label}:\n`];
    lines.push(`Total ventas: ${snap.size}`);
    lines.push(`Ingresos: S/ ${totalVentas.toFixed(2)}`);

    if (totalCosto > 0) {
      lines.push(`Costo total: S/ ${totalCosto.toFixed(2)}`);
      lines.push(`*Utilidad bruta: S/ ${totalUtilidadBruta.toFixed(2)}*`);
      if (totalUtilidadNeta) {
        lines.push(`*Utilidad neta: S/ ${totalUtilidadNeta.toFixed(2)}*`);
      }
    }

    if (ventasConMargen > 0) {
      const margenPromBruto = sumaMargenBruto / ventasConMargen;
      lines.push(`Margen bruto promedio: ${margenPromBruto.toFixed(1)}%`);
      if (sumaMargenNeto) {
        const margenPromNeto = sumaMargenNeto / ventasConMargen;
        lines.push(`Margen neto promedio: ${margenPromNeto.toFixed(1)}%`);
      }
    }

    // Top productos por ingreso
    const topProds = Object.values(porProducto)
      .sort((a, b) => b.ingreso - a.ingreso)
      .slice(0, 8);

    if (topProds.length > 0 && topProds.some(p => p.ingreso > 0)) {
      lines.push("\nRENTABILIDAD POR PRODUCTO (top):");
      for (const p of topProds) {
        if (p.ingreso <= 0) continue;
        const utilidad = p.ingreso - p.costo;
        const margenCalc = p.costo > 0 ? ((utilidad / p.ingreso) * 100).toFixed(1) + "%" : "—";
        lines.push(`  ${p.nombre}: S/ ${p.ingreso.toFixed(2)} ingreso | Margen: ${margenCalc} | ${p.cantidad} uds`);
      }
    }

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error rentabilidadReciente:", error);
    return { success: false, error: "Error consultando rentabilidad" };
  }
}

// ============================================================
// VENTAS POR PRODUCTO (búsqueda histórica)
// ============================================================

/**
 * Busca TODAS las ventas que incluyan un producto específico (por nombre, marca o SKU).
 * Ideal para: "cuántas Berberinas hemos vendido", "ventas de Omega 3", etc.
 */
export async function ventasPorProducto(busqueda: string, dias = 0, fechaDesde?: string, fechaHasta?: string): Promise<ERPQueryResult> {
  try {
    const range = buildDateRange({ dias, fechaDesde, fechaHasta });
    const snap = await buildDateQuery(db.collection(COL.VENTAS), "fechaCreacion", range).get();

    if (snap.empty) {
      return { success: true, data: "No hay ventas registradas." };
    }

    const flexMatch = createFlexMatcher(busqueda);

    // Pre-buscar productoIds que matchean en el catálogo para buscar también por ID
    const catalogSnap = await db.collection(COL.PRODUCTOS).get();
    const matchingProductoIds = new Set<string>();
    for (const pdoc of catalogSnap.docs) {
      const p = pdoc.data();
      const nombre = (p.nombreComercial || p.nombre || "");
      const marca = (p.marcaNombre || p.marca || "");
      const sku = (p.sku || "");
      if (flexMatch(`${marca} ${nombre} ${sku}`)) {
        matchingProductoIds.add(pdoc.id);
      }
    }

    let totalUnidades = 0;
    let totalIngreso = 0;
    let totalCosto = 0;
    const ventasConProducto: Array<{
      numero: string;
      cliente: string;
      fecha: unknown;
      canal: string;
      estado: string;
      productos: Array<{ nombre: string; cantidad: number; precioUnit: number; subtotal: number; margen?: number }>;
    }> = [];

    for (const doc of snap.docs) {
      const v = doc.data();
      const productos = v.productos || [];

      // Buscar si esta venta contiene el producto buscado (matching flexible)
      const matchingProds = productos.filter((p: Record<string, unknown>) => {
        const nombre = ((p.nombreComercial || p.nombre || "") as string);
        const sku = ((p.sku || "") as string);
        const marca = ((p.marca || p.marcaNombre || "") as string);
        const productoId = (p.productoId || "") as string;
        return flexMatch(`${marca} ${nombre} ${sku}`) || matchingProductoIds.has(productoId);
      });

      if (matchingProds.length > 0) {
        const prodsFormatted = matchingProds.map((p: Record<string, unknown>) => {
          const cant = (p.cantidad || 1) as number;
          const precioUnit = (p.precioUnitario || 0) as number;
          const subtotal = (p.subtotal || cant * precioUnit) as number;
          totalUnidades += cant;
          totalIngreso += subtotal;
          if (p.costoTotalUnidades) totalCosto += p.costoTotalUnidades as number;
          return {
            nombre: formatProductName(p),
            cantidad: cant,
            precioUnit,
            subtotal,
            margen: p.margenReal as number | undefined,
          };
        });

        ventasConProducto.push({
          numero: v.numeroVenta || v.numero || doc.id.substring(0, 8),
          cliente: v.nombreCliente || "Sin nombre",
          fecha: v.fechaCreacion,
          canal: v.canalNombre || v.canal || "directo",
          estado: v.estado || "—",
          productos: prodsFormatted,
        });
      }
    }

    if (ventasConProducto.length === 0) {
      // Usar los resultados del catálogo que ya buscamos con flexMatch
      const similares = catalogSnap.docs
        .filter(d => matchingProductoIds.has(d.id))
        .slice(0, 5)
        .map(d => {
          const p = d.data();
          return `${formatProductName(p as Record<string, unknown>)} (${p.marca || "—"})`;
        });

      let msg = `No encontré ventas de "${busqueda}" en ${range.label}.`;
      if (similares.length > 0) {
        msg += `\n\nProductos similares en catálogo (sin ventas en este período):\n${similares.map(s => `• ${s}`).join("\n")}`;
        msg += `\n\nEstos productos existen en inventario pero no tienen ventas registradas en el período consultado.`;
      }
      return { success: true, data: msg };
    }

    // Ordenar por fecha descendente
    ventasConProducto.sort((a, b) => {
      const fa = (a.fecha as admin.firestore.Timestamp)?.toDate?.() || new Date(0);
      const fb = (b.fecha as admin.firestore.Timestamp)?.toDate?.() || new Date(0);
      return fb.getTime() - fa.getTime();
    });

    const lines = [`VENTAS DE "${busqueda.toUpperCase()}" — ${range.label}:\n`];

    // Resumen
    lines.push(`Total ventas con este producto: ${ventasConProducto.length}`);
    lines.push(`*Total unidades vendidas: ${totalUnidades}*`);
    lines.push(`*Ingreso total: S/ ${totalIngreso.toFixed(2)}*`);
    if (totalCosto > 0) {
      const utilidad = totalIngreso - totalCosto;
      const margenProm = (utilidad / totalIngreso * 100).toFixed(1);
      lines.push(`Costo total: S/ ${totalCosto.toFixed(2)}`);
      lines.push(`Utilidad: S/ ${utilidad.toFixed(2)} (margen ${margenProm}%)`);
    }

    // Detalle de cada venta (máx 15)
    lines.push("\nDETALLE DE VENTAS:");
    for (const v of ventasConProducto.slice(0, 15)) {
      const fecha = formatTimestamp(v.fecha);
      lines.push(`• *${v.numero}* | ${fecha} | ${v.cliente} | ${v.canal} | ${v.estado}`);
      for (const p of v.productos) {
        lines.push(`  - ${p.nombre}: ${p.cantidad} uds × S/ ${p.precioUnit.toFixed(2)} = *S/ ${p.subtotal.toFixed(2)}*`);
      }
    }
    if (ventasConProducto.length > 15) {
      lines.push(`  ... y ${ventasConProducto.length - 15} ventas más`);
    }

    // Identificar variantes del catálogo que matchearon pero NO tuvieron ventas
    const productoIdsConVentas = new Set<string>();
    // Recorrer ventas originales para recolectar productoIds vendidos
    for (const doc of snap.docs) {
      const v = doc.data();
      for (const p of (v.productos || [])) {
        const productoId = p.productoId || "";
        const nombre = (p.nombreComercial || p.nombre || "");
        const marca = (p.marca || p.marcaNombre || "");
        const sku = (p.sku || "");
        if (flexMatch(`${marca} ${nombre} ${sku}`) || matchingProductoIds.has(productoId)) {
          productoIdsConVentas.add(productoId);
        }
      }
    }
    // Variantes en catálogo sin ventas
    const sinVentas = catalogSnap.docs
      .filter(d => matchingProductoIds.has(d.id) && !productoIdsConVentas.has(d.id))
      .map(d => {
        const p = d.data();
        return `${formatProductName(p as Record<string, unknown>)} (${p.marca || "—"})`;
      });
    if (sinVentas.length > 0) {
      lines.push("\nPRODUCTOS RELACIONADOS SIN VENTAS EN ESTE PERÍODO:");
      for (const s of sinVentas.slice(0, 5)) {
        lines.push(`  ⚪ ${s}`);
      }
    }

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error ventasPorProducto:", error);
    return { success: false, error: "Error consultando ventas por producto" };
  }
}

// ============================================================
// VENTAS TOP / RANKINGS
// ============================================================

/**
 * Top ventas más grandes (por monto), históricas o por período
 * Parámetro dias: 0 = todas las ventas históricas, >0 = últimos N días
 */
export async function ventasMayores(dias = 0, limite = 10, fechaDesde?: string, fechaHasta?: string): Promise<ERPQueryResult> {
  try {
    const range = buildDateRange({ dias, fechaDesde, fechaHasta });
    const snap = await buildDateQuery(db.collection(COL.VENTAS), "fechaCreacion", range).get();

    if (snap.empty) {
      return { success: true, data: "No hay ventas registradas." };
    }

    // Ordenar por monto descendente
    const ventas = snap.docs.map(doc => {
      const v = doc.data();
      return {
        numero: v.numeroVenta || v.numero || doc.id.substring(0, 8),
        cliente: v.nombreCliente || "Sin nombre",
        monto: v.totalPEN || v.montoTotal || v.total || 0,
        moneda: v.moneda || "PEN",
        fecha: v.fechaCreacion,
        estado: v.estado || "—",
        canal: v.canalNombre || v.canal || "directo",
        productos: v.productos || [],
      };
    }).sort((a, b) => b.monto - a.monto);

    const top = ventas.slice(0, limite);
    const lines = [`TOP ${limite} VENTAS MÁS GRANDES — ${range.label}:\n`];

    for (let i = 0; i < top.length; i++) {
      const v = top[i];
      const simbolo = v.moneda === "USD" ? "$" : "S/";
      const fecha = formatTimestamp(v.fecha);
      lines.push(`${i + 1}. *${v.numero}* | ${fecha} | ${v.cliente}`);
      lines.push(`   *${simbolo} ${v.monto.toFixed(2)}* | ${v.canal} | ${v.estado}`);

      // Productos de esta venta
      for (const p of v.productos.slice(0, 3)) {
        const nombreProd = formatProductName(p as Record<string, unknown>);
        const cant = p.cantidad || 1;
        const precioUnit = p.precioUnitario || 0;
        lines.push(`   - ${nombreProd}: ${cant} uds × S/ ${precioUnit.toFixed(2)}`);
      }
      if (v.productos.length > 3) {
        lines.push(`   (+${v.productos.length - 3} productos más)`);
      }
      lines.push("");
    }

    // Estadísticas generales
    const totalVentas = ventas.length;
    const sumaTotal = ventas.reduce((sum, v) => sum + v.monto, 0);
    const promedio = sumaTotal / totalVentas;
    lines.push(`Total ventas analizadas: ${totalVentas}`);
    lines.push(`Suma total: S/ ${sumaTotal.toFixed(2)}`);
    lines.push(`Promedio por venta: S/ ${promedio.toFixed(2)}`);

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error ventasMayores:", error);
    return { success: false, error: "Error consultando top ventas" };
  }
}

// ============================================================
// COBROS PENDIENTES
// ============================================================

/**
 * Ventas con pago pendiente (cobranzas)
 */
export async function cobrosPendientes(): Promise<ERPQueryResult> {
  try {
    const snap = await db.collection(COL.VENTAS)
      .where("estadoPago", "in", ["pendiente", "parcial"])
      .get();

    if (snap.empty) {
      return { success: true, data: "No hay cobros pendientes." };
    }

    let totalPendiente = 0;
    const lines = ["COBROS PENDIENTES:\n"];

    const ventas = snap.docs.map(doc => doc.data()).sort((a, b) => {
      return (b.montoPendiente || 0) - (a.montoPendiente || 0);
    });

    for (const v of ventas.slice(0, 15)) {
      const pendiente = v.montoPendiente || (v.totalPEN || 0) - (v.montoPagado || 0);
      totalPendiente += pendiente;
      const cliente = v.nombreCliente || "—";
      const fecha = formatTimestamp(v.fechaCreacion);
      lines.push(`- ${v.numeroVenta || "—"} | ${cliente} | Pendiente: S/ ${pendiente.toFixed(2)} | ${fecha}`);
    }

    if (ventas.length > 15) {
      lines.push(`  ... y ${ventas.length - 15} más`);
    }

    lines.push(`\n*TOTAL PENDIENTE DE COBRO: S/ ${totalPendiente.toFixed(2)}*`);

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    console.error("[WA-ERP] Error cobrosPendientes:", error);
    return { success: false, error: "Error consultando cobros" };
  }
}

// ============================================================
// UTILIDADES
// ============================================================

/**
 * Formatea nombre de producto con variantes (presentación, contenido, dosaje, sabor)
 * Ej: "Microingredients Complejo B (cápsulas · 60 cápsulas · 150mg · Limón)"
 */
function formatProductName(p: Record<string, unknown>): string {
  const nombre = (p.nombreComercial || p.nombre || p.sku || "—") as string;
  const variantes: string[] = [];
  if (p.presentacion) variantes.push(p.presentacion as string);
  if (p.contenido) variantes.push(p.contenido as string);
  if (p.dosaje) variantes.push(p.dosaje as string);
  if (p.sabor && (p.sabor as string).toLowerCase() !== "sin sabor" && (p.sabor as string).toLowerCase() !== "natural") {
    variantes.push(p.sabor as string);
  }
  if (variantes.length > 0) {
    return `${nombre} (${variantes.join(" · ")})`;
  }
  return nombre;
}

function formatTimestamp(ts: unknown): string {
  if (!ts) return "—";
  try {
    const date = (ts as admin.firestore.Timestamp).toDate();
    return date.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
