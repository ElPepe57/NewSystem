import type { Venta } from '../types/venta.types';
import { formatCurrency, formatCurrencyPEN } from '../utils/format';

// ---- Umbrales configurables ----
const UMBRAL_MONTO_MENSUAL_PEN = 800;
const UMBRAL_FRECUENCIA_SOCIO = 4;       // ventas/mes por socio
const UMBRAL_PORCENTAJE_INVENTARIO = 15;  // % unidades
const UMBRAL_STOCK_BAJO = 10;            // unidades disponibles

// ---- Motivos legibles ----
export const MOTIVOS_VENTA_SOCIO: Record<string, string> = {
  consumo_personal: 'Consumo personal',
  regalo_cliente_socio: 'Regalo a cliente del socio',
  producto_por_vencer: 'Producto por vencer',
  muestra: 'Muestra / demostración',
  otro: 'Otro',
};

// ---- Tipos ----
export interface ResumenPorSocio {
  nombre: string;
  ventas: number;
  cobradoPEN: number;
  costoRealPEN: number;
  subsidioPEN: number;
  costoOportunidadPEN: number;
  motivos: string[];
}

export interface AlertaSocio {
  tipo: 'monto_mensual' | 'frecuencia_inusual' | 'volumen_alto' | 'producto_escaso';
  severidad: 'info' | 'warning' | 'critical';
  mensaje: string;
  socio?: string;
}

export interface ResumenVentasSocios {
  totalVentas: number;
  totalCobradoPEN: number;
  totalCostoRealPEN: number;
  subsidioDirectoPEN: number;
  costoOportunidadPEN: number;
  unidadesConsumidas: number;
  porcentajeInventarioUnidades: number;
  porSocio: ResumenPorSocio[];
  alertas: AlertaSocio[];
}

/**
 * Calcula el resumen completo de ventas a socios del mes.
 * Todo se calcula sobre datos en memoria — sin queries adicionales a Firestore.
 */
function calcularResumenSocios(
  ventasSocios: Venta[],
  ventasRegulares: Venta[],
  precioPromedioRegularPorProducto?: Map<string, number>
): ResumenVentasSocios {
  let totalCobradoPEN = 0;
  let totalCostoRealPEN = 0;
  let unidadesConsumidas = 0;
  let costoOportunidadTotal = 0;
  const porSocioMap = new Map<string, ResumenPorSocio>();

  // Calcular precio promedio regular por producto si no se provee
  const preciosRegulares = precioPromedioRegularPorProducto ?? _calcularPreciosRegulares(ventasRegulares);

  for (const v of ventasSocios) {
    totalCobradoPEN += v.totalPEN || 0;
    totalCostoRealPEN += v.costoTotalPEN || 0;

    const nombreSocio = v.socioNombre || v.nombreCliente || 'Sin nombre';
    let socio = porSocioMap.get(nombreSocio);
    if (!socio) {
      socio = { nombre: nombreSocio, ventas: 0, cobradoPEN: 0, costoRealPEN: 0, subsidioPEN: 0, costoOportunidadPEN: 0, motivos: [] };
      porSocioMap.set(nombreSocio, socio);
    }
    socio.ventas += 1;
    socio.cobradoPEN += v.totalPEN || 0;
    socio.costoRealPEN += v.costoTotalPEN || 0;

    if (v.motivoVentaSocio && !socio.motivos.includes(v.motivoVentaSocio)) {
      socio.motivos.push(v.motivoVentaSocio);
    }

    // Calcular subsidio y costo de oportunidad por producto
    const productos = (v as any).productos || [];
    for (const p of productos) {
      const cantidad = p.cantidad || 0;
      unidadesConsumidas += cantidad;

      // Costo de oportunidad: precio regular promedio - precio cobrado al socio
      const precioRegular = preciosRegulares.get(p.productoId);
      if (precioRegular && p.precioUnitario < precioRegular) {
        const oportunidad = (precioRegular - p.precioUnitario) * cantidad;
        costoOportunidadTotal += oportunidad;
        socio.costoOportunidadPEN += oportunidad;
      }
    }
  }

  // Subsidio directo por socio
  for (const socio of porSocioMap.values()) {
    socio.subsidioPEN = Math.max(0, socio.costoRealPEN - socio.cobradoPEN);
  }

  const subsidioDirectoPEN = Math.max(0, totalCostoRealPEN - totalCobradoPEN);

  // % inventario (unidades socios / unidades totales vendidas)
  const unidadesRegulares = ventasRegulares.reduce((sum, v) => {
    const prods = (v as any).productos || [];
    return sum + prods.reduce((s: number, p: any) => s + (p.cantidad || 0), 0);
  }, 0);
  const totalUnidades = unidadesConsumidas + unidadesRegulares;
  const porcentajeInventarioUnidades = totalUnidades > 0 ? (unidadesConsumidas / totalUnidades) * 100 : 0;

  // Alertas
  const alertas = _evaluarAlertas(
    totalCobradoPEN,
    porSocioMap,
    porcentajeInventarioUnidades,
    ventasSocios
  );

  return {
    totalVentas: ventasSocios.length,
    totalCobradoPEN,
    totalCostoRealPEN,
    subsidioDirectoPEN,
    costoOportunidadPEN: costoOportunidadTotal,
    unidadesConsumidas,
    porcentajeInventarioUnidades,
    porSocio: Array.from(porSocioMap.values()).sort((a, b) => b.subsidioPEN - a.subsidioPEN),
    alertas,
  };
}

/**
 * Calcula precio promedio por producto basado en ventas regulares (no socios).
 */
function _calcularPreciosRegulares(ventasRegulares: Venta[]): Map<string, number> {
  const acumulado = new Map<string, { totalPrecio: number; totalCantidad: number }>();

  for (const v of ventasRegulares) {
    if (v.estado === 'cancelada') continue;
    const productos = (v as any).productos || [];
    for (const p of productos) {
      if (!p.productoId || !p.precioUnitario || p.precioUnitario <= 0) continue;
      const acc = acumulado.get(p.productoId) || { totalPrecio: 0, totalCantidad: 0 };
      acc.totalPrecio += p.precioUnitario * (p.cantidad || 1);
      acc.totalCantidad += p.cantidad || 1;
      acumulado.set(p.productoId, acc);
    }
  }

  const result = new Map<string, number>();
  for (const [id, acc] of acumulado) {
    if (acc.totalCantidad >= 1) {
      result.set(id, acc.totalPrecio / acc.totalCantidad);
    }
  }
  return result;
}

/**
 * Evalúa las alertas de anomalía.
 */
function _evaluarAlertas(
  totalCobradoPEN: number,
  porSocio: Map<string, ResumenPorSocio>,
  porcentajeInventario: number,
  ventasSocios: Venta[]
): AlertaSocio[] {
  const alertas: AlertaSocio[] = [];

  // ALERTA 1: Monto mensual > umbral
  if (totalCobradoPEN > UMBRAL_MONTO_MENSUAL_PEN) {
    alertas.push({
      tipo: 'monto_mensual',
      severidad: 'warning',
      mensaje: `Ventas a socios suman S/ ${totalCobradoPEN.toFixed(0)} este mes (umbral: S/ ${UMBRAL_MONTO_MENSUAL_PEN})`,
    });
  }

  // ALERTA 2: Frecuencia por socio
  for (const socio of porSocio.values()) {
    if (socio.ventas > UMBRAL_FRECUENCIA_SOCIO) {
      alertas.push({
        tipo: 'frecuencia_inusual',
        severidad: 'info',
        mensaje: `${socio.nombre} tiene ${socio.ventas} ventas este mes`,
        socio: socio.nombre,
      });
    }
  }

  // ALERTA 3: % inventario alto
  if (porcentajeInventario > UMBRAL_PORCENTAJE_INVENTARIO) {
    alertas.push({
      tipo: 'volumen_alto',
      severidad: 'warning',
      mensaje: `${porcentajeInventario.toFixed(1)}% del inventario vendido va a socios (umbral: ${UMBRAL_PORCENTAJE_INVENTARIO}%)`,
    });
  }

  return alertas;
}

export const ventaSociosService = {
  calcularResumenSocios,
  UMBRAL_MONTO_MENSUAL_PEN,
  MOTIVOS_VENTA_SOCIO,
};
