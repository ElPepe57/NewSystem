import { useState, useEffect, useCallback, useRef } from 'react';
import { gastoService } from '../services/gasto.service';
import { unidadService } from '../services/unidad.service';
import { getCostoBasePEN } from '../utils/ctru.utils';
import type { Venta } from '../types/venta.types';
import type { Gasto } from '../types/gasto.types';
import type { Unidad } from '../types/unidad.types';

// Cache global de gastos para evitar múltiples consultas
let gastosCache: { data: Gasto[] | null; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_TTL = 30000; // 30 segundos

// Cache global de unidades vendidas para consistencia con CTRU
let unidadesVendidasCache: { data: Unidad[] | null; timestamp: number } = { data: null, timestamp: 0 };

/**
 * Desglose de costos y gastos por producto individual
 *
 * Modelo de costos:
 * - Costo Base: Compra + Flete (costoTotalUnidades)
 * - GV/GD: Gastos de Venta/Distribución → se prorratean entre productos de ESTA venta (por % subtotal)
 * - GA/GO: Gastos Administrativos/Operativos → se prorratean entre TODAS las ventas (por % costo base)
 */
export interface DesgloseProducto {
  productoId: string;
  sku: string;
  nombre: string;
  cantidad: number;

  // Precio de venta
  precioVenta: number;           // Subtotal de venta del producto
  proporcionVenta: number;       // % del subtotal respecto al total de la venta (para GV/GD)

  // Costos directos
  costoBase: number;             // Costo base del producto (costoTotalUnidades = compra + flete)
  proporcionCosto: number;       // % del costo base respecto al total de la venta (para GA/GO)

  // Gastos prorrateados
  costoGVGD: number;             // GV/GD asignado a este producto (proporcional al subtotal)
  costoGAGO: number;             // GA/GO asignado a este producto (proporcional al costo base)

  // Totales
  costoTotal: number;            // costoBase + costoGVGD + costoGAGO

  // Utilidades
  utilidadBruta: number;         // precioVenta - costoBase - costoGVGD
  utilidadNeta: number;          // precioVenta - costoTotal (incluye GA/GO)
  margenBruto: number;           // % sobre precio venta
  margenNeto: number;            // % sobre precio venta
}

// Alias para compatibilidad
export type GAGOProducto = DesgloseProducto;

/**
 * Datos de rentabilidad calculados para una venta individual
 *
 * Flujo de cálculo:
 * 1. Precio Venta (totalPEN)
 * 2. (-) Costo Base (compra + flete)
 * 3. (-) GV (gastos de venta: comisiones, pasarelas)
 * 4. (-) GD (gastos de distribución: delivery - desde Transportistas)
 * 5. (=) Utilidad Bruta
 * 6. (-) GA/GO (gastos admin/operativos prorrateados)
 * 7. (=) Utilidad Neta
 */
export interface RentabilidadVenta {
  ventaId: string;

  // Costos y Gastos
  costoBase: number;           // Compra + Flete (costoTotalPEN de la venta)
  gastosGV: number;            // Gastos de Venta (comisiones, pasarelas, marketing)
  gastosGD: number;            // Gastos de Distribución (delivery desde Transportistas)
  gastosGVGD: number;          // Total GV + GD (para compatibilidad)
  costoGAGO: number;           // GA/GO prorrateado (proporcional al costo base)
  costoTotal: number;          // costoBase + gastosGVGD + costoGAGO

  // Utilidades
  utilidadBruta: number;       // totalVenta - costoBase - gastosGVGD
  utilidadNeta: number;        // utilidadBruta - costoGAGO

  // Márgenes
  margenBruto: number;         // % (utilidadBruta / totalVenta)
  margenNeto: number;          // % (utilidadNeta / totalVenta)

  // Desglose por producto
  desgloseProductos?: DesgloseProducto[];
}

/**
 * Datos globales de rentabilidad
 */
export interface DatosRentabilidadGlobal {
  // Carga operativa
  totalGastosGAGO: number;
  baseUnidades: number;
  baseCostoTotal: number;           // Costo base total para prorrateo proporcional
  impactoPorUnidad: number;         // Referencia: GA/GO ÷ unidades (no usado en cálculo real)
  // Totales calculados
  totalVentas: number;
  totalCostoBase: number;
  totalCostoGAGO: number;
  totalUtilidadBruta: number;
  totalGastosGV: number;            // Total gastos de venta (comisiones, pasarelas)
  totalGastosGD: number;            // Total gastos de distribución (delivery)
  totalGastosGVGD: number;          // Total GV + GD (para compatibilidad)
  totalUtilidadNeta: number;
  margenBrutoPromedio: number;
  margenNetoPromedio: number;
  // Por venta
  rentabilidadPorVenta: Map<string, RentabilidadVenta>;
}

/**
 * Obtener gastos con cache
 */
async function getGastosConCache(): Promise<Gasto[]> {
  const now = Date.now();
  if (gastosCache.data && (now - gastosCache.timestamp) < CACHE_TTL) {
    return gastosCache.data;
  }

  const gastos = await gastoService.getAll();
  gastosCache = { data: gastos, timestamp: now };
  return gastos;
}

/**
 * Obtener unidades vinculadas a ventas con cache.
 * Incluye vendidas + reservadas/asignadas que ya tienen ventaId.
 * Las vendidas se usan para prorrateo GA/GO (consistente con CTRU),
 * las reservadas/asignadas se usan para calcular costoBase de ventas en proceso.
 */
async function getUnidadesVendidasConCache(): Promise<Unidad[]> {
  const now = Date.now();
  if (unidadesVendidasCache.data && (now - unidadesVendidasCache.timestamp) < CACHE_TTL) {
    return unidadesVendidasCache.data;
  }

  const todasUnidades = await unidadService.getAll();
  // Incluir vendidas + cualquier unidad que tenga ventaId (asignada a una venta)
  const conVenta = todasUnidades.filter(u =>
    u.estado === 'vendida' || (u as any).ventaId
  );
  unidadesVendidasCache = { data: conVenta, timestamp: now };
  return conVenta;
}

/**
 * Invalidar cache de gastos (llamar después de crear/editar gastos)
 */
export function invalidarCacheGastos() {
  gastosCache = { data: null, timestamp: 0 };
  unidadesVendidasCache = { data: null, timestamp: 0 };
}

/**
 * Hook centralizado para calcular rentabilidad de ventas
 * Usa la misma lógica que CTRU Dashboard para consistencia
 *
 * OPTIMIZADO:
 * - Cache de gastos con TTL de 30s
 * - Debounce de 300ms para evitar cálculos excesivos
 * - Cálculo diferido (no bloquea el renderizado inicial)
 */
export function useRentabilidadVentas(ventas: Venta[]) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<DatosRentabilidadGlobal | null>(null);

  // Ref para debounce
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  // Ref para evitar cálculos duplicados
  const lastVentasHashRef = useRef<string>('');

  const calcularRentabilidad = useCallback(async (forceRefresh = false) => {
    // Crear hash simple de ventas para detectar cambios reales
    const ventasHash = ventas.map(v => `${v.id}-${v.estado}-${v.totalPEN}`).join('|');

    // Si no hay cambios y no es refresh forzado, no recalcular
    if (!forceRefresh && ventasHash === lastVentasHashRef.current && datos) {
      return;
    }

    if (ventas.length === 0) {
      setDatos(null);
      lastVentasHashRef.current = '';
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Obtener gastos y unidades con venta vinculada (vendidas + asignadas)
      const [todosLosGastos, unidadesConVenta] = await Promise.all([
        getGastosConCache(),
        getUnidadesVendidasConCache()
      ]);

      const gastosGAGO = todosLosGastos.filter(
        g => g.categoria === 'GA' || g.categoria === 'GO'
      );
      const totalGastosGAGO = gastosGAGO.reduce((sum, g) => sum + g.montoPEN, 0);

      // 2. Calcular costo base total desde UNIDADES VENDIDAS (consistente con CTRU)
      // GA/GO se prorratean SOLO entre vendidas (no asignadas/reservadas)
      const soloVendidas = unidadesConVenta.filter(u => u.estado === 'vendida');
      const costoBaseTotalUnidades = soloVendidas.reduce((sum, u) => sum + getCostoBasePEN(u), 0);

      let totalUnidadesVendidasCount = 0;
      for (const venta of ventas) {
        if (venta.estado !== 'cotizacion' && venta.estado !== 'cancelada') {
          const cantidadUnidades = venta.productos.reduce((sum, p) => sum + p.cantidad, 0);
          totalUnidadesVendidasCount += cantidadUnidades;
        }
      }

      const baseUnidades = totalUnidadesVendidasCount > 0 ? totalUnidadesVendidasCount : 1;
      const baseCostoTotal = costoBaseTotalUnidades > 0 ? costoBaseTotalUnidades : 1;
      const impactoPorUnidad = totalGastosGAGO / baseUnidades;

      // 3. Agrupar gastos GV y GD por ventaId (una sola pasada)
      const gastosGVPorVenta = new Map<string, number>();
      const gastosGDPorVenta = new Map<string, number>();
      let gastosGVSinVenta = 0;
      let gastosGDSinVenta = 0;

      for (const gasto of todosLosGastos) {
        if (gasto.categoria === 'GV') {
          if (gasto.ventaId) {
            const actual = gastosGVPorVenta.get(gasto.ventaId) || 0;
            gastosGVPorVenta.set(gasto.ventaId, actual + gasto.montoPEN);
          } else {
            gastosGVSinVenta += gasto.montoPEN;
          }
        } else if (gasto.categoria === 'GD') {
          if (gasto.ventaId) {
            const actual = gastosGDPorVenta.get(gasto.ventaId) || 0;
            gastosGDPorVenta.set(gasto.ventaId, actual + gasto.montoPEN);
          } else {
            gastosGDSinVenta += gasto.montoPEN;
          }
        }
      }

      // 3b. Mapear unidades por ventaId para calcular costoBase
      // Incluye vendidas + asignadas/reservadas (que tienen ventaId)
      const unidadesPorVenta = new Map<string, Unidad[]>();
      for (const u of unidadesConVenta) {
        const vId = u.ventaId || (u as any).reservadaPara;
        if (vId) {
          if (!unidadesPorVenta.has(vId)) unidadesPorVenta.set(vId, []);
          unidadesPorVenta.get(vId)!.push(u);
        }
      }

      // 4. Calcular rentabilidad por venta
      const rentabilidadPorVenta = new Map<string, RentabilidadVenta>();
      let totalVentas = 0;
      let totalCostoBase = 0;
      let totalCostoGAGO = 0;
      let totalUtilidadBruta = 0;
      let totalGastosGVSum = 0;
      let totalGastosGDSum = 0;
      let totalUtilidadNeta = 0;

      for (const venta of ventas) {
        if (venta.estado === 'cotizacion' || venta.estado === 'cancelada') {
          continue;
        }

        // Calcular costoBase desde unidades (consistente con CTRU)
        const unidadesDeEstaVenta = unidadesPorVenta.get(venta.id) || [];
        const costoBaseDesdeUnidades = unidadesDeEstaVenta.reduce((sum, u) => sum + getCostoBasePEN(u), 0);
        const costoBase = costoBaseDesdeUnidades > 0 ? costoBaseDesdeUnidades : (venta.costoTotalPEN || 0);


        if (costoBase === 0) continue;

        // GV: Gastos de Venta
        const gastosVentaCampos = (venta.gastosVentaPEN || 0) ||
          ((venta.comisionML || 0) +
           (venta.costoEnvioNegocio || 0) +
           (venta.costoEnvioML || 0) +
           (venta.otrosGastosVenta || 0));
        const gastosGVTablaVenta = gastosGVPorVenta.get(venta.id) || 0;
        const gastosGV = gastosVentaCampos + gastosGVTablaVenta;

        // GD: Gastos de Distribución
        const gastosGD = gastosGDPorVenta.get(venta.id) || 0;

        // Total GV + GD
        const gastosGVGD = gastosGV + gastosGD;

        // GA/GO prorrateado
        const proporcionCostoVenta = costoBase / baseCostoTotal;
        const costoGAGO = totalGastosGAGO * proporcionCostoVenta;

        // Costo total
        const costoTotal = costoBase + gastosGVGD + costoGAGO;

        // Utilidades
        const utilidadBruta = venta.totalPEN - costoBase - gastosGVGD;
        const utilidadNeta = utilidadBruta - costoGAGO;

        const margenBruto = venta.totalPEN > 0 ? (utilidadBruta / venta.totalPEN) * 100 : 0;
        const margenNeto = venta.totalPEN > 0 ? (utilidadNeta / venta.totalPEN) * 100 : 0;

        // Desglose por producto
        // Agrupar unidades de esta venta por productoId para calcular costoBase real (con flete)
        const unidadesPorProducto = new Map<string, Unidad[]>();
        for (const u of unidadesDeEstaVenta) {
          const pid = u.productoId;
          if (pid) {
            if (!unidadesPorProducto.has(pid)) unidadesPorProducto.set(pid, []);
            unidadesPorProducto.get(pid)!.push(u);
          }
        }

        const desgloseProductos: DesgloseProducto[] = [];

        // Envío cobrado al cliente: se distribuye proporcionalmente como ingreso por producto
        const envioCobrado = !venta.incluyeEnvio ? (venta.costoEnvio || 0) : 0;
        const sumSubtotales = venta.productos.reduce((s, p) => s + (p.subtotal || 0), 0);

        for (const producto of venta.productos) {
          // Calcular costoBase desde unidades reales (incluye flete), fallback a campo guardado
          const unidadesDelProducto = unidadesPorProducto.get(producto.productoId) || [];
          const costoBaseDesdeUnidadesProducto = unidadesDelProducto.reduce((sum, u) => sum + getCostoBasePEN(u), 0);
          const costoBaseProducto = costoBaseDesdeUnidadesProducto > 0
            ? costoBaseDesdeUnidadesProducto
            : (producto.costoTotalUnidades || 0);
          const subtotalProducto = producto.subtotal || 0;

          if (subtotalProducto > 0) {
            // Distribuir envío cobrado proporcionalmente al precio de cada producto
            const proporcionEnvio = sumSubtotales > 0 ? subtotalProducto / sumSubtotales : 0;
            const envioProducto = envioCobrado * proporcionEnvio;
            const ventaAjustada = subtotalProducto + envioProducto;

            const proporcionVenta = ventaAjustada / venta.totalPEN;
            const proporcionCosto = costoBase > 0 ? costoBaseProducto / costoBase : 0;

            const costoGVGDProducto = gastosGVGD * proporcionVenta;
            const costoGAGOProducto = costoGAGO * proporcionCosto;
            const costoTotalProducto = costoBaseProducto + costoGVGDProducto + costoGAGOProducto;

            const utilidadBrutaProducto = ventaAjustada - costoBaseProducto - costoGVGDProducto;
            const utilidadNetaProducto = ventaAjustada - costoTotalProducto;

            const margenBrutoProducto = ventaAjustada > 0
              ? (utilidadBrutaProducto / ventaAjustada) * 100
              : 0;
            const margenNetoProducto = ventaAjustada > 0
              ? (utilidadNetaProducto / ventaAjustada) * 100
              : 0;

            desgloseProductos.push({
              productoId: producto.productoId,
              sku: producto.sku,
              nombre: `${producto.marca} ${producto.nombreComercial} ${producto.presentacion}`,
              cantidad: producto.cantidad,
              precioVenta: ventaAjustada,
              proporcionVenta: proporcionVenta * 100,
              costoBase: costoBaseProducto,
              proporcionCosto: proporcionCosto * 100,
              costoGVGD: costoGVGDProducto,
              costoGAGO: costoGAGOProducto,
              costoTotal: costoTotalProducto,
              utilidadBruta: utilidadBrutaProducto,
              utilidadNeta: utilidadNetaProducto,
              margenBruto: margenBrutoProducto,
              margenNeto: margenNetoProducto
            });
          }
        }

        rentabilidadPorVenta.set(venta.id, {
          ventaId: venta.id,
          costoBase,
          gastosGV,
          gastosGD,
          gastosGVGD,
          costoGAGO,
          costoTotal,
          utilidadBruta,
          utilidadNeta,
          margenBruto,
          margenNeto,
          desgloseProductos: desgloseProductos.length > 0 ? desgloseProductos : undefined
        });

        // Acumular totales
        totalVentas += venta.totalPEN;
        totalCostoBase += costoBase;
        totalCostoGAGO += costoGAGO;
        totalUtilidadBruta += utilidadBruta;
        totalGastosGVSum += gastosGV;
        totalGastosGDSum += gastosGD;
        totalUtilidadNeta += utilidadNeta;
      }

      // Sumar GV/GD no vinculados a ventas específicas (para que el total sea real)
      totalGastosGVSum += gastosGVSinVenta;
      totalGastosGDSum += gastosGDSinVenta;
      totalUtilidadNeta -= (gastosGVSinVenta + gastosGDSinVenta);

      // 5. Calcular promedios
      const margenBrutoPromedio = totalVentas > 0
        ? (totalUtilidadBruta / totalVentas) * 100
        : 0;
      const margenNetoPromedio = totalVentas > 0
        ? (totalUtilidadNeta / totalVentas) * 100
        : 0;

      lastVentasHashRef.current = ventasHash;

      setDatos({
        totalGastosGAGO,
        baseUnidades,
        baseCostoTotal,
        impactoPorUnidad,
        totalVentas,
        totalCostoBase,
        totalCostoGAGO,
        totalUtilidadBruta,
        totalGastosGV: totalGastosGVSum,
        totalGastosGD: totalGastosGDSum,
        totalGastosGVGD: totalGastosGVSum + totalGastosGDSum,
        totalUtilidadNeta,
        margenBrutoPromedio,
        margenNetoPromedio,
        rentabilidadPorVenta
      });
    } catch (err) {
      console.error('Error calculando rentabilidad:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [ventas, datos]);

  // Efecto con debounce para evitar cálculos excesivos
  useEffect(() => {
    // Cancelar debounce anterior
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Si no hay ventas, limpiar inmediatamente
    if (ventas.length === 0) {
      setDatos(null);
      return;
    }

    // Debounce de 300ms
    debounceRef.current = setTimeout(() => {
      calcularRentabilidad();
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [ventas]); // Solo depender de ventas, no de calcularRentabilidad

  // Helper para obtener rentabilidad de una venta específica
  const getRentabilidadVenta = useCallback((ventaId: string): RentabilidadVenta | null => {
    return datos?.rentabilidadPorVenta.get(ventaId) || null;
  }, [datos]);

  return {
    loading,
    error,
    datos,
    getRentabilidadVenta,
    refetch: () => {
      invalidarCacheGastos();
      calcularRentabilidad(true);
    }
  };
}
