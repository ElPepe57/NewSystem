import { create } from 'zustand';
import { ctruService } from '../services/ctru.service';
import { unidadService } from '../services/unidad.service';
import { gastoService } from '../services/gasto.service';
import type { Unidad } from '../types/unidad.types';
import type { CategoriaGasto } from '../types/gasto.types';

interface CTRUProducto {
  productoId: string;
  productoNombre: string;
  productoSKU: string;
  ctruPromedio: number;
  ctruMinimo: number;
  ctruMaximo: number;
  unidadesDisponibles: number;
}

interface CTRUResumen {
  ctruPromedioGlobal: number;
  totalUnidadesDisponibles: number;
  totalGastosProrrateablesMes: number;
  impactoPorUnidad: number;
  ultimoRecalculo: Date | null;
}

/**
 * Desglose de gastos por categoría
 * GA/GO impactan CTRU (se prorratean entre unidades)
 * GV/GD NO impactan CTRU (se descuentan de la utilidad de cada venta)
 */
interface DesgloseGastosCategorias {
  // Gastos que SÍ impactan CTRU
  gastosAdministrativos: number;  // GA
  gastosOperativos: number;       // GO
  totalImpactaCTRU: number;       // GA + GO

  // Gastos que NO impactan CTRU (asociados a ventas)
  gastosVenta: number;            // GV
  gastosDistribucion: number;     // GD
  totalNoImpactaCTRU: number;     // GV + GD

  // Contadores
  cantidadGA: number;
  cantidadGO: number;
  cantidadGV: number;
  cantidadGD: number;
}

interface DesgloseCostos {
  costoCompraUSD: number;
  costoCompraPEN: number;
  costoFletePEN: number;
  gastosProrrateadosPEN: number;
  ctruFinal: number;

  // Nuevo desglose por categoría
  gastosPorCategoria: DesgloseGastosCategorias;
}

interface CTRUState {
  resumen: CTRUResumen | null;
  productosTop: CTRUProducto[];
  desgloseCostos: DesgloseCostos | null;
  unidadesDisponibles: Unidad[];
  loading: boolean;
  recalculando: boolean;
  error: string | null;

  // Actions
  fetchResumen: () => Promise<void>;
  fetchProductosTop: (limit?: number) => Promise<void>;
  fetchDesgloseCostos: () => Promise<void>;
  recalcularCTRU: () => Promise<{
    unidadesActualizadas: number;
    gastosAplicados: number;
    impactoPorUnidad: number;
  }>;
  fetchAll: () => Promise<void>;
}

export const useCTRUStore = create<CTRUState>((set, get) => ({
  resumen: null,
  productosTop: [],
  desgloseCostos: null,
  unidadesDisponibles: [],
  loading: false,
  recalculando: false,
  error: null,

  fetchResumen: async () => {
    set({ loading: true, error: null });
    try {
      // Obtener unidades disponibles en Perú
      const unidades = await unidadService.buscar({
        estado: 'disponible_peru',
        pais: 'Peru'
      });

      // Obtener TODOS los gastos prorrateables (no solo pendientes)
      const todosLosGastos = await gastoService.getAll();
      const gastosProrrateables = todosLosGastos.filter(g => g.esProrrateable);
      const totalGastos = gastosProrrateables.reduce((sum, g) => sum + g.montoPEN, 0);

      // Obtener gastos pendientes de recálculo (para el KPI)
      const gastosPendientes = await gastoService.getGastosPendientesRecalculoCTRU();
      const gastosPendientesProrrateables = gastosPendientes.filter(g => g.esProrrateable);
      const totalGastosPendientes = gastosPendientesProrrateables.reduce((sum, g) => sum + g.montoPEN, 0);

      // Calcular CTRU promedio global usando costo REAL de cada unidad
      // CTRU = (CostoUSD × TC) + (FleteUSD × TC) + (GastosProrrateables / NumUnidades)
      let sumaCostoBase = 0;
      for (const u of unidades) {
        const tc = u.tcPago || u.tcCompra || 3.70;
        // Flete está en USD, convertir a PEN
        const fletePEN = (u.costoFleteUSD || 0) * tc;
        const costoBase = (u.costoUnitarioUSD * tc) + fletePEN;
        sumaCostoBase += costoBase;
      }

      // Impacto de gastos por unidad
      const impactoPorUnidad = unidades.length > 0 ? totalGastos / unidades.length : 0;

      // CTRU promedio = Costo base promedio + Impacto gastos
      const costoBasePromedio = unidades.length > 0 ? sumaCostoBase / unidades.length : 0;
      const ctruPromedio = costoBasePromedio + impactoPorUnidad;

      const resumen: CTRUResumen = {
        ctruPromedioGlobal: ctruPromedio,
        totalUnidadesDisponibles: unidades.length,
        totalGastosProrrateablesMes: totalGastosPendientes, // Gastos pendientes de aplicar
        impactoPorUnidad,
        ultimoRecalculo: new Date()
      };

      set({ resumen, unidadesDisponibles: unidades, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
    }
  },

  fetchProductosTop: async (limit: number = 10) => {
    set({ loading: true, error: null });
    try {
      const unidades = await unidadService.buscar({
        estado: 'disponible_peru',
        pais: 'Peru'
      });

      // Obtener gastos prorrateables totales para calcular impacto
      const todosLosGastos = await gastoService.getAll();
      const gastosProrrateables = todosLosGastos.filter(g => g.esProrrateable);
      const totalGastos = gastosProrrateables.reduce((sum, g) => sum + g.montoPEN, 0);
      const impactoPorUnidad = unidades.length > 0 ? totalGastos / unidades.length : 0;

      // Agrupar por producto
      const productoMap = new Map<string, {
        productoId: string;
        productoNombre: string;
        productoSKU: string;
        ctrus: number[];
      }>();

      for (const u of unidades) {
        // Calcular CTRU real: CostoBase + Impacto de gastos
        const tc = u.tcPago || u.tcCompra || 3.70;
        // Flete está en USD, convertir a PEN
        const fletePEN = (u.costoFleteUSD || 0) * tc;
        const costoBase = (u.costoUnitarioUSD * tc) + fletePEN;
        const ctru = costoBase + impactoPorUnidad;

        if (!productoMap.has(u.productoId)) {
          productoMap.set(u.productoId, {
            productoId: u.productoId,
            productoNombre: u.productoNombre,
            productoSKU: u.productoSKU,
            ctrus: []
          });
        }
        productoMap.get(u.productoId)!.ctrus.push(ctru);
      }

      // Calcular estadísticas por producto
      const productos: CTRUProducto[] = [];
      for (const [, data] of productoMap) {
        const ctruPromedio = data.ctrus.reduce((a, b) => a + b, 0) / data.ctrus.length;
        productos.push({
          productoId: data.productoId,
          productoNombre: data.productoNombre,
          productoSKU: data.productoSKU,
          ctruPromedio,
          ctruMinimo: Math.min(...data.ctrus),
          ctruMaximo: Math.max(...data.ctrus),
          unidadesDisponibles: data.ctrus.length
        });
      }

      // Ordenar por CTRU más alto y limitar
      productos.sort((a, b) => b.ctruPromedio - a.ctruPromedio);
      const productosTop = productos.slice(0, limit);

      set({ productosTop, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
    }
  },

  fetchDesgloseCostos: async () => {
    set({ loading: true, error: null });
    try {
      const unidades = await unidadService.buscar({
        estado: 'disponible_peru',
        pais: 'Peru'
      });

      // Obtener TODOS los gastos para análisis por categoría
      const todosLosGastos = await gastoService.getAll();

      // Desglose por categoría
      const gastosGA = todosLosGastos.filter(g => g.categoria === 'GA');
      const gastosGO = todosLosGastos.filter(g => g.categoria === 'GO');
      const gastosGV = todosLosGastos.filter(g => g.categoria === 'GV');
      const gastosGD = todosLosGastos.filter(g => g.categoria === 'GD');

      const totalGA = gastosGA.reduce((sum, g) => sum + g.montoPEN, 0);
      const totalGO = gastosGO.reduce((sum, g) => sum + g.montoPEN, 0);
      const totalGV = gastosGV.reduce((sum, g) => sum + g.montoPEN, 0);
      const totalGD = gastosGD.reduce((sum, g) => sum + g.montoPEN, 0);

      // GA y GO impactan CTRU (se prorratean entre unidades)
      const totalImpactaCTRU = totalGA + totalGO;
      // GV y GD NO impactan CTRU (se descuentan de utilidad de venta)
      const totalNoImpactaCTRU = totalGV + totalGD;

      const gastosPorCategoria: DesgloseGastosCategorias = {
        gastosAdministrativos: totalGA,
        gastosOperativos: totalGO,
        totalImpactaCTRU,
        gastosVenta: totalGV,
        gastosDistribucion: totalGD,
        totalNoImpactaCTRU,
        cantidadGA: gastosGA.length,
        cantidadGO: gastosGO.length,
        cantidadGV: gastosGV.length,
        cantidadGD: gastosGD.length
      };

      // Solo los gastos GA/GO se prorratean en el CTRU
      const totalGastosProrrateados = totalImpactaCTRU;

      if (unidades.length === 0) {
        set({
          desgloseCostos: {
            costoCompraUSD: 0,
            costoCompraPEN: 0,
            costoFletePEN: 0,
            gastosProrrateadosPEN: totalGastosProrrateados,
            ctruFinal: totalGastosProrrateados,
            gastosPorCategoria
          },
          loading: false
        });
        return;
      }

      // Calcular totales de compra y flete desde las unidades
      let totalCompraUSD = 0;
      let totalCompraPEN = 0;
      let totalFleteUSD = 0;
      let totalFletePEN = 0;

      for (const u of unidades) {
        const tc = u.tcPago || u.tcCompra || 3.70;
        totalCompraUSD += u.costoUnitarioUSD;
        totalCompraPEN += u.costoUnitarioUSD * tc;
        // El flete está en USD, convertir a PEN usando el mismo TC de la unidad
        const fleteUSD = u.costoFleteUSD || 0;
        totalFleteUSD += fleteUSD;
        totalFletePEN += fleteUSD * tc;
      }

      // CTRU Total = Compra PEN + Flete PEN + Gastos Prorrateados (solo GA/GO)
      const ctruFinal = totalCompraPEN + totalFletePEN + totalGastosProrrateados;

      set({
        desgloseCostos: {
          costoCompraUSD: totalCompraUSD,
          costoCompraPEN: totalCompraPEN,
          costoFletePEN: totalFletePEN,
          gastosProrrateadosPEN: totalGastosProrrateados,
          ctruFinal,
          gastosPorCategoria
        },
        loading: false
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
    }
  },

  recalcularCTRU: async () => {
    set({ recalculando: true, error: null });
    try {
      const resultado = await ctruService.recalcularCTRUDinamico();

      // Refrescar datos después del recálculo
      await get().fetchAll();

      set({ recalculando: false });
      return resultado;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, recalculando: false });
      throw error;
    }
  },

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      await Promise.all([
        get().fetchResumen(),
        get().fetchProductosTop(),
        get().fetchDesgloseCostos()
      ]);
      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
    }
  }
}));
