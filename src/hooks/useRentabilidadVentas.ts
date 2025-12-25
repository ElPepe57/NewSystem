import { useState, useEffect, useCallback } from 'react';
import { gastoService } from '../services/gasto.service';
import { unidadService } from '../services/unidad.service';
import type { Venta } from '../types/venta.types';

/**
 * Desglose de GA/GO por producto individual
 */
export interface GAGOProducto {
  productoId: string;
  sku: string;
  nombre: string;
  cantidad: number;
  costoBase: number;           // Costo base del producto (costoTotalUnidades)
  proporcion: number;          // % del costo base respecto al total de la venta
  costoGAGO: number;           // GA/GO asignado a este producto
  costoTotal: number;          // costoBase + costoGAGO
  precioVenta: number;         // Subtotal de venta del producto
  utilidadBruta: number;       // precioVenta - costoTotal
  margenBruto: number;         // %
}

/**
 * Datos de rentabilidad calculados para una venta individual
 */
export interface RentabilidadVenta {
  ventaId: string;
  // Costos
  costoBase: number;           // Compra + Flete (guardado en venta)
  costoGAGO: number;           // GA/GO prorrateado
  costoTotal: number;          // costoBase + costoGAGO (CTRU real)
  // Utilidades
  utilidadBruta: number;       // totalVenta - costoTotal
  gastosGVGD: number;          // Gastos de venta/distribución asociados
  utilidadNeta: number;        // utilidadBruta - gastosGVGD
  // Márgenes
  margenBruto: number;         // %
  margenNeto: number;          // %
  // Desglose por producto (solo si hay más de 1 producto o si se solicita)
  desgloseProductos?: GAGOProducto[];
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
  totalGastosGVGD: number;
  totalUtilidadNeta: number;
  margenBrutoPromedio: number;
  margenNetoPromedio: number;
  // Por venta
  rentabilidadPorVenta: Map<string, RentabilidadVenta>;
}

/**
 * Hook centralizado para calcular rentabilidad de ventas
 * Usa la misma lógica que CTRU Dashboard para consistencia
 */
export function useRentabilidadVentas(ventas: Venta[]) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<DatosRentabilidadGlobal | null>(null);

  const calcularRentabilidad = useCallback(async () => {
    if (ventas.length === 0) {
      setDatos(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Obtener gastos GA/GO prorrateables
      const todosLosGastos = await gastoService.getAll();
      const gastosGAGO = todosLosGastos.filter(
        g => g.esProrrateable && (g.categoria === 'GA' || g.categoria === 'GO')
      );
      const totalGastosGAGO = gastosGAGO.reduce((sum, g) => sum + g.montoPEN, 0);

      // 2. Primera pasada: Calcular costo base total para prorrateo proporcional
      // Los gastos GA/GO se distribuyen proporcionalmente al costo base de cada venta
      // Esto es más justo: productos más costosos absorben más gastos operativos
      let totalCostoBaseParaProrrateo = 0;
      let totalUnidadesVendidas = 0;

      for (const venta of ventas) {
        // Solo contar ventas con estado válido (no cotizaciones ni canceladas)
        if (venta.estado !== 'cotizacion' && venta.estado !== 'cancelada') {
          const costoBase = venta.costoTotalPEN || 0;
          if (costoBase > 0) {
            totalCostoBaseParaProrrateo += costoBase;
          }
          const cantidadUnidades = venta.productos.reduce((sum, p) => sum + p.cantidad, 0);
          totalUnidadesVendidas += cantidadUnidades;
        }
      }

      // Base = costo base total vendido (mínimo 1 para evitar división por cero)
      const baseUnidades = totalUnidadesVendidas > 0 ? totalUnidadesVendidas : 1;
      const baseCostoTotal = totalCostoBaseParaProrrateo > 0 ? totalCostoBaseParaProrrateo : 1;

      // 3. Calcular impacto por unidad (para referencia/display)
      // Nota: El prorrateo real es proporcional al costo base, no por unidad
      const impactoPorUnidad = totalGastosGAGO / baseUnidades;

      // 4. Obtener gastos GV/GD por venta
      const gastosGVGDPorVenta = new Map<string, number>();
      const gastosGVGD = todosLosGastos.filter(
        g => (g.categoria === 'GV' || g.categoria === 'GD') && g.ventaId
      );
      for (const gasto of gastosGVGD) {
        if (gasto.ventaId) {
          const actual = gastosGVGDPorVenta.get(gasto.ventaId) || 0;
          gastosGVGDPorVenta.set(gasto.ventaId, actual + gasto.montoPEN);
        }
      }

      // 5. Calcular rentabilidad por venta
      const rentabilidadPorVenta = new Map<string, RentabilidadVenta>();
      let totalVentas = 0;
      let totalCostoBase = 0;
      let totalCostoGAGO = 0;
      let totalUtilidadBruta = 0;
      let totalGastosGVGDSum = 0;
      let totalUtilidadNeta = 0;
      let ventasConCosto = 0;

      for (const venta of ventas) {
        // Solo calcular para ventas con estado válido y con costos
        if (venta.estado === 'cotizacion' || venta.estado === 'cancelada') {
          continue;
        }

        const costoBase = venta.costoTotalPEN || 0;
        if (costoBase === 0) continue;

        // Prorrateo proporcional: productos más costosos absorben más GA/GO
        // Formula: costoGAGO = totalGastosGAGO × (costoBase_venta / costoBase_total)
        const proporcionCosto = costoBase / baseCostoTotal;
        const costoGAGO = totalGastosGAGO * proporcionCosto;
        const costoTotal = costoBase + costoGAGO;

        const utilidadBruta = venta.totalPEN - costoTotal;
        const gastosGVGD = gastosGVGDPorVenta.get(venta.id) || 0;
        const utilidadNeta = utilidadBruta - gastosGVGD;

        const margenBruto = venta.totalPEN > 0 ? (utilidadBruta / venta.totalPEN) * 100 : 0;
        const margenNeto = venta.totalPEN > 0 ? (utilidadNeta / venta.totalPEN) * 100 : 0;

        // Calcular desglose por producto (siempre incluirlo para transparencia)
        const desgloseProductos: GAGOProducto[] = [];

        for (const producto of venta.productos) {
          // Costo base del producto (suma de CTRU de sus unidades)
          const costoBaseProducto = producto.costoTotalUnidades || 0;

          if (costoBaseProducto > 0 && costoBase > 0) {
            // Proporción de este producto respecto al total de la venta
            const proporcionProducto = costoBaseProducto / costoBase;
            // GA/GO asignado proporcionalmente
            const costoGAGOProducto = costoGAGO * proporcionProducto;
            const costoTotalProducto = costoBaseProducto + costoGAGOProducto;
            const utilidadBrutaProducto = producto.subtotal - costoTotalProducto;
            const margenBrutoProducto = producto.subtotal > 0
              ? (utilidadBrutaProducto / producto.subtotal) * 100
              : 0;

            desgloseProductos.push({
              productoId: producto.productoId,
              sku: producto.sku,
              nombre: `${producto.marca} ${producto.nombreComercial} ${producto.presentacion}`,
              cantidad: producto.cantidad,
              costoBase: costoBaseProducto,
              proporcion: proporcionProducto * 100, // Como porcentaje
              costoGAGO: costoGAGOProducto,
              costoTotal: costoTotalProducto,
              precioVenta: producto.subtotal,
              utilidadBruta: utilidadBrutaProducto,
              margenBruto: margenBrutoProducto
            });
          }
        }

        rentabilidadPorVenta.set(venta.id, {
          ventaId: venta.id,
          costoBase,
          costoGAGO,
          costoTotal,
          utilidadBruta,
          gastosGVGD,
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
        totalGastosGVGDSum += gastosGVGD;
        totalUtilidadNeta += utilidadNeta;
        ventasConCosto++;
      }

      // 6. Calcular promedios
      const margenBrutoPromedio = totalVentas > 0
        ? (totalUtilidadBruta / totalVentas) * 100
        : 0;
      const margenNetoPromedio = totalVentas > 0
        ? (totalUtilidadNeta / totalVentas) * 100
        : 0;

      setDatos({
        totalGastosGAGO,
        baseUnidades,
        baseCostoTotal,
        impactoPorUnidad,
        totalVentas,
        totalCostoBase,
        totalCostoGAGO,
        totalUtilidadBruta,
        totalGastosGVGD: totalGastosGVGDSum,
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
  }, [ventas]);

  useEffect(() => {
    calcularRentabilidad();
  }, [calcularRentabilidad]);

  // Helper para obtener rentabilidad de una venta específica
  const getRentabilidadVenta = useCallback((ventaId: string): RentabilidadVenta | null => {
    return datos?.rentabilidadPorVenta.get(ventaId) || null;
  }, [datos]);

  return {
    loading,
    error,
    datos,
    getRentabilidadVenta,
    refetch: calcularRentabilidad
  };
}
