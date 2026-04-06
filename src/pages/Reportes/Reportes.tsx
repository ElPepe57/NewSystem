import React, { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import {
  DollarSign,
  TrendingUp,
  Package,
  ShoppingCart,
  AlertTriangle,
  BarChart3,
  PieChart,
  Activity,
  Truck,
  Download,
  FileSpreadsheet,
  Calculator,
  RefreshCw,
  Users,
  ClipboardCheck
} from 'lucide-react';

// Tabs lazy-loaded
const TabLogistica = lazy(() => import('./TabLogistica').then(m => ({ default: m.TabLogistica })));
const TabClientes = lazy(() => import('./TabClientes').then(m => ({ default: m.TabClientes })));
const TabAuditorias = lazy(() => import('./TabAuditorias').then(m => ({ default: m.TabAuditorias })));
const TabCompras = lazy(() => import('./TabCompras').then(m => ({ default: m.TabCompras })));

type ReporteTab = 'rentabilidad' | 'logistica' | 'clientes' | 'auditorias' | 'compras';

const TABS: { id: ReporteTab; label: string; icon: React.ReactNode }[] = [
  { id: 'rentabilidad', label: 'Rentabilidad', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'logistica', label: 'Logistica', icon: <Truck className="h-4 w-4" /> },
  { id: 'clientes', label: 'Clientes', icon: <Users className="h-4 w-4" /> },
  { id: 'auditorias', label: 'Auditorias', icon: <ClipboardCheck className="h-4 w-4" /> },
  { id: 'compras', label: 'Compras', icon: <ShoppingCart className="h-4 w-4" /> },
];
import { Card, Button, Badge } from '../../components/common';
import { LineaFilterInline } from '../../components/common/LineaFilterInline';
import { TendenciaChart } from '../../components/modules/reporte/TendenciaChart';
import { ProductosRentabilidadTable } from '../../components/modules/reporte/ProductosRentabilidadTable';
import { InventarioValorizadoTable } from '../../components/modules/reporte/InventarioValorizadoTable';
import { AlertasInventario } from '../../components/modules/reporte/AlertasInventario';
import { RentabilidadBarChart } from '../../components/modules/reporte/RentabilidadBarChart';
import { FiltroFechas, type PeriodoPreset } from '../../components/modules/reporte/FiltroFechas';
import { useReporteStore } from '../../store/reporteStore';
import { ExcelService } from '../../services/excel.service';
import { VentaService } from '../../services/venta.service';
import { useRentabilidadVentas } from '../../hooks/useRentabilidadVentas';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import type { Venta } from '../../types/venta.types';
import type { ProductoRentabilidad } from '../../types/reporte.types';

interface RentabilidadNetaPeriodo {
  ventasBrutas: number;
  costoBase: number;       // Compra + Flete (puesto en Perú)
  costoGVGD: number;       // Gastos Venta + Distribución
  costoGAGO: number;       // Gastos Admin + Operativos
  costoTotal: number;      // costoBase + costoGVGD + costoGAGO
  utilidadBruta: number;   // ventas - costoBase
  margenBruto: number;
  utilidadNeta: number;    // ventas - costoTotal
  margenNeto: number;
  unidadesVendidas: number;
  cargaPorUnidad: number;  // (costoGVGD + costoGAGO) / unidades
}

export const Reportes: React.FC = () => {
  const {
    resumenEjecutivo,
    productosRentabilidad,
    inventarioValorizado,
    ventasPorCanal,
    tendenciaVentas,
    alertasInventario,
    loading,
    fetchAll
  } = useReporteStore();

  const [rentabilidadNeta, setRentabilidadNeta] = useState<RentabilidadNetaPeriodo | null>(null);
  const [tipoGrafico, setTipoGrafico] = useState<'utilidad' | 'margen' | 'ventas'>('utilidad');
  const [periodoActivo, setPeriodoActivo] = useState<PeriodoPreset>('mes');
  const [activeTab, setActiveTab] = useState<ReporteTab>('rentabilidad');
  const [fechasFiltro, setFechasFiltro] = useState<{ inicio: Date; fin: Date }>({
    inicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    fin: new Date()
  });

  // Ventas entregadas del periodo para modelo completo de costos
  const [ventasEntregadas, setVentasEntregadas] = useState<Venta[]>([]);

  // Filtrar ventas por línea de negocio global
  const ventasEntregadasFiltradas = useLineaFilter(ventasEntregadas, v => v.lineaNegocioId);

  // Hook de rentabilidad con modelo completo (7 capas: Compra + Flete + GV + GD + GA + GO)
  const { datos: datosRentabilidad } = useRentabilidadVentas(ventasEntregadasFiltradas);

  // Manejar cambio de filtro de fechas
  const handleFiltroFechas = (inicio: Date, fin: Date, periodo: PeriodoPreset) => {
    setFechasFiltro({ inicio, fin });
    setPeriodoActivo(periodo);
    // Recargar todos los datos con el nuevo rango
    fetchAll({ inicio, fin });
  };

  // Cargar ventas entregadas del periodo para modelo completo
  useEffect(() => {
    let cancelled = false;
    const cargarEntregadas = async () => {
      try {
        const ventas = await VentaService.getAll();
        const entregadas = ventas.filter(v => {
          if (v.estado !== 'entregada') return false;
          // Use fechaEntrega, fallback to fechaDespacho or fechaCreacion for legacy data
          const fecha = v.fechaEntrega?.toDate?.()
            || (v as any).fechaDespacho?.toDate?.()
            || v.fechaCreacion?.toDate?.();
          if (!fecha) return false;
          return fecha >= fechasFiltro.inicio && fecha <= fechasFiltro.fin;
        });
        if (!cancelled) setVentasEntregadas(entregadas);
      } catch (e) {
        console.error('Error cargando ventas entregadas:', e);
      }
    };
    cargarEntregadas();
    return () => { cancelled = true; };
  }, [fechasFiltro]); // eslint-disable-line react-hooks/exhaustive-deps

  // Productos con modelo completo de costos (7 capas) agregados por productoId
  const productosRentabilidadCompleto = useMemo<ProductoRentabilidad[]>(() => {
    if (!datosRentabilidad?.rentabilidadPorVenta) {
      // Fallback al modelo simplificado si el hook aún no calculó
      return productosRentabilidad;
    }

    const agregado = new Map<string, {
      productoId: string;
      sku: string;
      marca: string;
      nombreComercial: string;
      unidadesVendidas: number;
      ventasTotalPEN: number;
      costoBasePEN: number;
      costoGVGDPEN: number;
      costoGAGOPEN: number;
    }>();

    // Agregar desgloseProductos de cada venta por productoId
    for (const [, rv] of datosRentabilidad.rentabilidadPorVenta) {
      if (!rv.desgloseProductos) continue;
      for (const dp of rv.desgloseProductos) {
        const existing = agregado.get(dp.productoId);
        if (existing) {
          existing.unidadesVendidas += dp.cantidad;
          existing.ventasTotalPEN += dp.precioVenta;
          existing.costoBasePEN += dp.costoBase;
          existing.costoGVGDPEN += dp.costoGVGD;
          existing.costoGAGOPEN += dp.costoGAGO;
        } else {
          const [marca, ...rest] = dp.nombre.split(' ');
          agregado.set(dp.productoId, {
            productoId: dp.productoId,
            sku: dp.sku,
            marca: marca || '',
            nombreComercial: rest.join(' ') || dp.nombre,
            unidadesVendidas: dp.cantidad,
            ventasTotalPEN: dp.precioVenta,
            costoBasePEN: dp.costoBase,
            costoGVGDPEN: dp.costoGVGD,
            costoGAGOPEN: dp.costoGAGO,
          });
        }
      }
    }

    if (agregado.size === 0) return productosRentabilidad;

    // Calcular métricas finales
    const productos: ProductoRentabilidad[] = Array.from(agregado.values()).map(p => {
      const costoTotalPEN = p.costoBasePEN + p.costoGVGDPEN + p.costoGAGOPEN;
      const utilidadPEN = p.ventasTotalPEN - costoTotalPEN;
      const margenPromedio = p.ventasTotalPEN > 0
        ? (utilidadPEN / p.ventasTotalPEN) * 100
        : 0;

      return {
        productoId: p.productoId,
        sku: p.sku,
        marca: p.marca,
        nombreComercial: p.nombreComercial,
        unidadesVendidas: p.unidadesVendidas,
        ventasTotalPEN: p.ventasTotalPEN,
        costoTotalPEN,
        utilidadPEN,
        margenPromedio,
        precioPromedioVenta: p.unidadesVendidas > 0 ? p.ventasTotalPEN / p.unidadesVendidas : 0,
        costoPromedioUnidad: p.unidadesVendidas > 0 ? costoTotalPEN / p.unidadesVendidas : 0,
        // Desglose
        costoBasePEN: p.costoBasePEN,
        costoGVGDPEN: p.costoGVGDPEN,
        costoGAGOPEN: p.costoGAGOPEN,
      };
    });

    return productos.sort((a, b) => b.ventasTotalPEN - a.ventasTotalPEN);
  }, [datosRentabilidad, productosRentabilidad]);

  // Cargar todos los reportes al montar (con rango inicial del mes)
  useEffect(() => {
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const ahora = new Date();
    fetchAll({ inicio: inicioMes, fin: ahora });
  }, []);

  // Calcular rentabilidad neta del periodo usando modelo completo de 7 capas
  useEffect(() => {
    if (!datosRentabilidad) {
      setRentabilidadNeta(null);
      return;
    }

    const ventasBrutas = datosRentabilidad.totalVentas;
    const costoBase = datosRentabilidad.totalCostoBase;
    const costoGVGD = (datosRentabilidad.totalGastosGV || 0) + (datosRentabilidad.totalGastosGD || 0);
    const costoGAGO = datosRentabilidad.totalCostoGAGO || 0;
    const costoTotal = costoBase + costoGVGD + costoGAGO;

    const utilidadBruta = ventasBrutas - costoBase;
    const margenBruto = ventasBrutas > 0 ? (utilidadBruta / ventasBrutas) * 100 : 0;
    const utilidadNeta = ventasBrutas - costoTotal;
    const margenNeto = ventasBrutas > 0 ? (utilidadNeta / ventasBrutas) * 100 : 0;

    // Contar unidades vendidas
    let unidadesVendidas = 0;
    for (const [, rv] of datosRentabilidad.rentabilidadPorVenta) {
      if (rv.desgloseProductos) {
        unidadesVendidas += rv.desgloseProductos.reduce((s, dp) => s + dp.cantidad, 0);
      }
    }

    const gastosIndirectos = costoGVGD + costoGAGO;
    const cargaPorUnidad = unidadesVendidas > 0 ? gastosIndirectos / unidadesVendidas : 0;

    setRentabilidadNeta({
      ventasBrutas,
      costoBase,
      costoGVGD,
      costoGAGO,
      costoTotal,
      utilidadBruta,
      margenBruto,
      utilidadNeta,
      margenNeto,
      unidadesVendidas,
      cargaPorUnidad,
    });
  }, [datosRentabilidad]);

  // Funciones de exportación a Excel
  const exportarResumenEjecutivo = () => {
    if (!resumenEjecutivo) return;

    const data = [{
      'Ventas Totales (PEN)': resumenEjecutivo.ventasTotalesPEN,
      'Ventas Mes (PEN)': resumenEjecutivo.ventasMes,
      'Ventas Semana (PEN)': resumenEjecutivo.ventasSemana,
      'Ventas Hoy (PEN)': resumenEjecutivo.ventasHoy,
      'Utilidad Total (PEN)': resumenEjecutivo.utilidadTotalPEN,
      'Margen Promedio (%)': resumenEjecutivo.margenPromedio,
      'Valor Inventario (PEN)': resumenEjecutivo.valorInventarioPEN,
      'Unidades Totales': resumenEjecutivo.unidadesTotales,
      'Unidades Disponibles': resumenEjecutivo.unidadesDisponibles,
      'Ordenes Activas': resumenEjecutivo.ordenesActivas,
      'Ordenes Recibidas': resumenEjecutivo.ordenesRecibidas,
      'Inversion Total (USD)': resumenEjecutivo.inversionTotalUSD,
      'Productos Activos': resumenEjecutivo.productosActivos,
      'TC Actual': resumenEjecutivo.tcActual,
      'TC Promedio': resumenEjecutivo.tcPromedio
    }];

    ExcelService.exportToExcel(data, 'Resumen_Ejecutivo', 'Resumen');
  };

  const exportarRentabilidad = () => {
    if (productosRentabilidadCompleto.length === 0) return;

    const data = productosRentabilidadCompleto.map(p => ({
      'SKU': p.sku,
      'Marca': p.marca,
      'Nombre Comercial': p.nombreComercial,
      'Unidades Vendidas': p.unidadesVendidas,
      'Ventas Total (PEN)': p.ventasTotalPEN,
      'Costo Base (PEN)': p.costoBasePEN ?? p.costoTotalPEN,
      'GV/GD (PEN)': p.costoGVGDPEN ?? 0,
      'GA/GO (PEN)': p.costoGAGOPEN ?? 0,
      'Costo Total (PEN)': p.costoTotalPEN,
      'Utilidad (PEN)': p.utilidadPEN,
      'Margen Neto (%)': p.margenPromedio,
      'Precio Promedio Venta': p.precioPromedioVenta,
      'Costo Promedio Unidad': p.costoPromedioUnidad
    }));

    ExcelService.exportToExcel(data, 'Rentabilidad_Productos', 'Rentabilidad');
  };

  const exportarInventario = () => {
    if (inventarioValorizado.length === 0) return;

    const data = inventarioValorizado.map(i => ({
      'SKU': i.sku,
      'Marca': i.marca,
      'Nombre Comercial': i.nombreComercial,
      'Unidades Disponibles': i.unidadesDisponibles,
      'Unidades Asignadas': i.unidadesAsignadas,
      'Total Unidades': i.unidadesTotal,
      'Valor Total (PEN)': i.valorTotalPEN,
      'Costo Promedio Unidad': i.costoPromedioUnidad,
      'Unidades Origen': i.unidadesMiami ?? (i.unidadesPorPais ? Object.entries(i.unidadesPorPais).filter(([p]) => p !== 'Peru').reduce((s, [, v]) => s + v, 0) : 0),
      'Unidades Destino': i.unidadesPeru ?? (i.unidadesPorPais?.['Peru'] || 0),
      ...(i.unidadesPorPais ? Object.fromEntries(Object.entries(i.unidadesPorPais).map(([p, v]) => [`Unidades ${p}`, v])) : {})
    }));

    ExcelService.exportToExcel(data, 'Inventario_Valorizado', 'Inventario');
  };

  const exportarTendencia = () => {
    if (tendenciaVentas.length === 0) return;

    const data = tendenciaVentas.map(t => ({
      'Fecha': t.fecha,
      'Ventas (PEN)': t.ventas,
      'Utilidad (PEN)': t.utilidad,
      'Margen (%)': t.margen
    }));

    ExcelService.exportToExcel(data, 'Tendencia_Ventas', 'Tendencia');
  };

  const exportarTodo = () => {
    exportarResumenEjecutivo();
    exportarRentabilidad();
    exportarInventario();
    exportarTendencia();
  };

  // Helpers para KPIs de inventario computados en frontend
  const invValorPEN = useMemo(() => inventarioValorizado.reduce((s, i) => s + i.valorTotalPEN, 0), [inventarioValorizado]);
  const invDisponibles = useMemo(() => inventarioValorizado.reduce((s, i) => s + i.unidadesDisponibles, 0), [inventarioValorizado]);

  if (loading && !resumenEjecutivo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Generando reportes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Reportes</h1>
        {activeTab === 'rentabilidad' && (
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={() => fetchAll()}
              disabled={loading}
              className="p-2 sm:px-3 sm:py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={exportarTodo}
              disabled={loading}
              className="p-2 sm:px-3 sm:py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline text-sm">Exportar</span>
            </button>
          </div>
        )}
      </div>

      {/* Filtro de línea de negocio */}
      <LineaFilterInline />

      {/* Tabs de navegación */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex gap-0 -mb-px min-w-max">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido del tab activo */}
      {activeTab !== 'rentabilidad' ? (
        <Suspense fallback={
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        }>
          {activeTab === 'logistica' && <TabLogistica />}
          {activeTab === 'clientes' && <TabClientes />}
          {activeTab === 'auditorias' && <TabAuditorias />}
          {activeTab === 'compras' && <TabCompras />}
        </Suspense>
      ) : (
      <>
      {/* Filtro de Fechas — solo para tab Rentabilidad */}
      <FiltroFechas
        onFiltroChange={handleFiltroFechas}
        periodoInicial="mes"
      />

      {/* Resumen Ejecutivo */}
      {resumenEjecutivo && (
        <>
          {/* KPIs Principales — 2 cards grandes arriba */}
          <div>
            <h2 className="text-base sm:text-xl font-semibold text-gray-900 mb-3">Resumen Ejecutivo</h2>

            {/* Ventas + Utilidad — siempre 2 columnas, compactos en móvil */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
              {/* Ventas del Periodo */}
              <div className="bg-white border border-primary-200 rounded-xl p-3 sm:p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" />
                  <span className="text-[11px] sm:text-sm text-gray-500">Ventas del Periodo</span>
                </div>
                <div className="text-lg sm:text-2xl font-bold text-primary-600 leading-tight">
                  S/ {resumenEjecutivo.ventasRangoPEN.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
                  {resumenEjecutivo.ventasRangoCantidad} ventas
                </div>
              </div>

              {/* Utilidad del Periodo */}
              <div className="bg-white border border-success-200 rounded-xl p-3 sm:p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-success-500" />
                  <span className="text-[11px] sm:text-sm text-gray-500">Utilidad del Periodo</span>
                </div>
                <div className="text-lg sm:text-2xl font-bold text-success-600 leading-tight">
                  S/ {resumenEjecutivo.utilidadRangoPEN.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
                  Margen: {resumenEjecutivo.ventasRangoPEN > 0
                    ? ((resumenEjecutivo.utilidadRangoPEN / resumenEjecutivo.ventasRangoPEN) * 100).toFixed(1)
                    : '0.0'}%
                </div>
              </div>
            </div>

            {/* Métricas secundarias — fila compacta de 3 (o 4 si hay envíos) */}
            <div className={`grid gap-2.5 sm:gap-4 mt-2.5 sm:mt-4 ${resumenEjecutivo.costoEnvioAsumidoPEN > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
              {resumenEjecutivo.costoEnvioAsumidoPEN > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-2.5 sm:p-4">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Truck className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500" />
                    <span className="text-[10px] sm:text-xs text-gray-500">Envíos</span>
                  </div>
                  <div className="text-sm sm:text-lg font-bold text-orange-600 leading-tight">
                    S/ {resumenEjecutivo.costoEnvioAsumidoPEN.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>
              )}

              <div className="bg-white border border-gray-200 rounded-xl p-2.5 sm:p-4">
                <div className="flex items-center gap-1 mb-0.5">
                  <Package className="h-3 w-3 sm:h-4 sm:w-4 text-warning-500" />
                  <span className="text-[10px] sm:text-xs text-gray-500">Inventario</span>
                </div>
                <div className="text-sm sm:text-lg font-bold text-warning-600 leading-tight">
                  {inventarioValorizado.length > 0
                    ? `S/ ${invValorPEN.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    : loading ? '...' : 'S/ 0'}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-400">{invDisponibles} disp.</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-2.5 sm:p-4">
                <div className="flex items-center gap-1 mb-0.5">
                  <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                  <span className="text-[10px] sm:text-xs text-gray-500">Inversión</span>
                </div>
                <div className="text-sm sm:text-lg font-bold text-gray-900 leading-tight">
                  ${resumenEjecutivo.inversionTotalUSD.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-400">TC: {resumenEjecutivo.tcActual.toFixed(2)}</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-2.5 sm:p-4">
                <div className="flex items-center gap-1 mb-0.5">
                  <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-primary-500" />
                  <span className="text-[10px] sm:text-xs text-gray-500">Productos</span>
                </div>
                <div className="text-sm sm:text-lg font-bold text-gray-900 leading-tight">
                  {resumenEjecutivo.productosActivos}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-400">{resumenEjecutivo.ordenesActivas} OC activas</div>
              </div>
            </div>
          </div>

          {/* KPIs detalle — 3 columnas compactas en móvil */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-2.5 sm:p-4">
              <div className="text-[10px] sm:text-sm font-medium text-gray-500 mb-1.5 sm:mb-2">Ventas</div>
              <div className="space-y-1 sm:space-y-2">
                <div className="flex justify-between items-baseline gap-1">
                  <span className="text-[10px] sm:text-xs text-gray-400">Hoy</span>
                  <span className="text-[11px] sm:text-sm font-semibold text-gray-900 truncate">S/ {resumenEjecutivo.ventasHoy.toFixed(0)}</span>
                </div>
                <div className="flex justify-between items-baseline gap-1">
                  <span className="text-[10px] sm:text-xs text-gray-400">7d</span>
                  <span className="text-[11px] sm:text-sm font-semibold text-gray-900 truncate">S/ {resumenEjecutivo.ventasSemana.toFixed(0)}</span>
                </div>
                <div className="flex justify-between items-baseline gap-1">
                  <span className="text-[10px] sm:text-xs text-gray-400">Mes</span>
                  <span className="text-[11px] sm:text-sm font-semibold text-primary-600 truncate">S/ {resumenEjecutivo.ventasMes.toFixed(0)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-2.5 sm:p-4">
              <div className="text-[10px] sm:text-sm font-medium text-gray-500 mb-1.5 sm:mb-2">Inventario</div>
              <div className="space-y-1 sm:space-y-2">
                <div className="flex justify-between items-baseline gap-1">
                  <span className="text-[10px] sm:text-xs text-gray-400">Total</span>
                  <span className="text-[11px] sm:text-sm font-semibold text-gray-900">{resumenEjecutivo.unidadesTotales}</span>
                </div>
                <div className="flex justify-between items-baseline gap-1">
                  <span className="text-[10px] sm:text-xs text-gray-400">Disp.</span>
                  <span className="text-[11px] sm:text-sm font-semibold text-success-600">{resumenEjecutivo.unidadesDisponibles}</span>
                </div>
                <div className="flex justify-between items-baseline gap-1">
                  <span className="text-[10px] sm:text-xs text-gray-400">Prod.</span>
                  <span className="text-[11px] sm:text-sm font-semibold text-gray-900">{resumenEjecutivo.productosActivos}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-2.5 sm:p-4">
              <div className="text-[10px] sm:text-sm font-medium text-gray-500 mb-1.5 sm:mb-2">Compras</div>
              <div className="space-y-1 sm:space-y-2">
                <div className="flex justify-between items-baseline gap-1">
                  <span className="text-[10px] sm:text-xs text-gray-400">Activas</span>
                  <span className="text-[11px] sm:text-sm font-semibold text-warning-600">{resumenEjecutivo.ordenesActivas}</span>
                </div>
                <div className="flex justify-between items-baseline gap-1">
                  <span className="text-[10px] sm:text-xs text-gray-400">Recib.</span>
                  <span className="text-[11px] sm:text-sm font-semibold text-success-600">{resumenEjecutivo.ordenesRecibidas}</span>
                </div>
                <div className="flex justify-between items-baseline gap-1">
                  <span className="text-[10px] sm:text-xs text-gray-400">TC</span>
                  <span className="text-[11px] sm:text-sm font-semibold text-gray-900">{resumenEjecutivo.tcPromedio.toFixed(3)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Rentabilidad Neta del Periodo */}
      {rentabilidadNeta && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-3 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
              <h2 className="text-sm sm:text-lg font-semibold text-gray-900">
                Rentabilidad Neta {periodoActivo === 'mes' ? 'del Mes' : periodoActivo === 'semana' ? 'de la Semana' : periodoActivo === 'hoy' ? 'del Dia' : periodoActivo === 'trimestre' ? 'del Trimestre' : periodoActivo === 'anio' ? 'del Ano' : periodoActivo === 'custom' ? 'del Periodo' : 'del Periodo'}
              </h2>
            </div>
            <span className="text-[10px] sm:text-xs text-gray-400 hidden sm:block">Modelo completo (7 capas)</span>
          </div>

          {/* 4 métricas compactas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3">
            <div className="bg-white rounded-lg p-2.5 sm:p-3 border border-gray-200">
              <div className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Ventas Brutas</div>
              <div className="text-sm sm:text-xl font-bold text-gray-900 leading-tight">
                S/ {rentabilidadNeta.ventasBrutas.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-gray-400">{rentabilidadNeta.unidadesVendidas} uds</div>
            </div>

            <div className="bg-white rounded-lg p-2.5 sm:p-3 border border-gray-200">
              <div className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Utilidad Bruta</div>
              <div className={`text-sm sm:text-xl font-bold leading-tight ${rentabilidadNeta.utilidadBruta >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                S/ {rentabilidadNeta.utilidadBruta.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-gray-400">{rentabilidadNeta.margenBruto.toFixed(1)}%</div>
            </div>

            <div className="bg-white rounded-lg p-2.5 sm:p-3 border border-orange-200">
              <div className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Gastos (GV/GD + GA/GO)</div>
              <div className="text-sm sm:text-xl font-bold text-orange-600 leading-tight">
                S/ {(rentabilidadNeta.costoGVGD + rentabilidadNeta.costoGAGO).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-gray-400">S/ {rentabilidadNeta.cargaPorUnidad.toFixed(2)}/ud</div>
            </div>

            <div className={`rounded-lg p-2.5 sm:p-3 border-2 ${rentabilidadNeta.utilidadNeta >= 0 ? 'bg-success-50 border-success-300' : 'bg-danger-50 border-danger-300'}`}>
              <div className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Utilidad Neta</div>
              <div className={`text-sm sm:text-xl font-bold leading-tight ${rentabilidadNeta.utilidadNeta >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                S/ {rentabilidadNeta.utilidadNeta.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`text-[10px] font-semibold ${rentabilidadNeta.margenNeto >= 0 ? 'text-success-700' : 'text-danger-700'}`}>
                Neto: {rentabilidadNeta.margenNeto.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Desglose compacto con 7 capas */}
          <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 text-xs sm:text-sm">
            <h4 className="text-xs font-medium text-gray-600 mb-2">Desglose (Modelo Completo)</h4>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-600">Ventas Brutas</span>
                <span className="font-medium">S/ {rentabilidadNeta.ventasBrutas.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span className="pl-3">− Costo Base (Compra + Flete)</span>
                <span>S/ {rentabilidadNeta.costoBase.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-1.5">
                <span className="text-gray-700 font-medium">= Util. Bruta</span>
                <span className={`font-semibold ${rentabilidadNeta.utilidadBruta >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  S/ {rentabilidadNeta.utilidadBruta.toFixed(2)} <span className="text-gray-400 font-normal">({rentabilidadNeta.margenBruto.toFixed(1)}%)</span>
                </span>
              </div>
              <div className="flex justify-between text-blue-600">
                <span className="pl-3">− GV/GD</span>
                <span>S/ {rentabilidadNeta.costoGVGD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-orange-600">
                <span className="pl-3">− GA/GO</span>
                <span>S/ {rentabilidadNeta.costoGAGO.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t-2 border-gray-300 pt-1.5">
                <span className="text-gray-900 font-bold">= UTIL. NETA</span>
                <span className={`font-bold ${rentabilidadNeta.utilidadNeta >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  S/ {rentabilidadNeta.utilidadNeta.toFixed(2)} <span className="text-gray-400 font-normal">({rentabilidadNeta.margenNeto.toFixed(1)}%)</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alertas de Inventario */}
      {alertasInventario.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5">
          <div className="flex items-center gap-1.5 mb-3 sm:mb-4">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-warning-600" />
            <h2 className="text-sm sm:text-lg font-semibold text-gray-900">
              Alertas de Inventario
            </h2>
            <span className="text-[10px] sm:text-xs bg-warning-100 text-warning-700 px-1.5 py-0.5 rounded-full font-medium">
              {alertasInventario.length}
            </span>
          </div>
          <AlertasInventario alertas={alertasInventario} />
        </div>
      )}

      {/* Tendencia de Ventas */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5">
        <div className="flex items-center justify-between mb-2 sm:mb-4">
          <div className="flex items-center gap-1.5">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
            <h2 className="text-sm sm:text-lg font-semibold text-gray-900">
              Tendencia de Ventas <span className="text-gray-400 font-normal">({periodoActivo === 'custom' ? 'Personalizado' : periodoActivo === 'hoy' ? 'Hoy' : periodoActivo === 'semana' ? '7d' : periodoActivo === 'mes' ? '30d' : periodoActivo === 'trimestre' ? '90d' : '1a'})</span>
            </h2>
          </div>
          {tendenciaVentas.length > 0 && (
            <button
              onClick={exportarTendencia}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          )}
        </div>
        <TendenciaChart data={tendenciaVentas} />
      </div>

      {/* Ventas por Canal */}
      {ventasPorCanal && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-2.5 sm:p-4">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <div className="text-[10px] sm:text-sm text-gray-600">M. Libre</div>
              <PieChart className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-blue-500" />
            </div>
            <div className="text-base sm:text-2xl font-bold text-gray-900">
              {ventasPorCanal.mercadoLibre.cantidad}
            </div>
            <div className="text-[11px] sm:text-sm text-gray-600 mt-0.5">
              S/ {ventasPorCanal.mercadoLibre.totalPEN.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
              {ventasPorCanal.mercadoLibre.porcentaje.toFixed(1)}%
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-2.5 sm:p-4">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <div className="text-[10px] sm:text-sm text-gray-600">Directa</div>
              <PieChart className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-green-500" />
            </div>
            <div className="text-base sm:text-2xl font-bold text-gray-900">
              {ventasPorCanal.directo.cantidad}
            </div>
            <div className="text-[11px] sm:text-sm text-gray-600 mt-0.5">
              S/ {ventasPorCanal.directo.totalPEN.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
              {ventasPorCanal.directo.porcentaje.toFixed(1)}%
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-2.5 sm:p-4">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <div className="text-[10px] sm:text-sm text-gray-600">Otros</div>
              <PieChart className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-purple-500" />
            </div>
            <div className="text-base sm:text-2xl font-bold text-gray-900">
              {ventasPorCanal.otro.cantidad}
            </div>
            <div className="text-[11px] sm:text-sm text-gray-600 mt-0.5">
              S/ {ventasPorCanal.otro.totalPEN.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
              {ventasPorCanal.otro.porcentaje.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Top Productos por Rentabilidad */}
      {resumenEjecutivo && resumenEjecutivo.productosMasVendidos.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5">
          <div className="flex items-center gap-1.5 mb-3 sm:mb-4">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-success-600" />
            <h2 className="text-sm sm:text-lg font-semibold text-gray-900">
              Top 5 Productos Más Vendidos
            </h2>
          </div>
          <ProductosRentabilidadTable productos={resumenEjecutivo.productosMasVendidos} />
        </div>
      )}

      {/* Gráfico de Barras - Rentabilidad Visual */}
      {productosRentabilidadCompleto.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5">
          {/* Header + botones */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
              <h2 className="text-sm sm:text-lg font-semibold text-gray-900">
                Top 10 Rentabilidad
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-xs text-gray-400">Ver:</span>
              <div className="flex gap-1">
                {[
                  { key: 'utilidad' as const, label: 'Utilidad', color: 'green' },
                  { key: 'margen' as const, label: 'Margen', color: 'blue' },
                  { key: 'ventas' as const, label: 'Ventas', color: 'purple' }
                ].map(({ key, label, color }) => (
                  <button
                    key={key}
                    onClick={() => setTipoGrafico(key)}
                    className={`px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-sm rounded-lg transition-colors ${
                      tipoGrafico === key
                        ? `bg-${color}-600 text-white`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Leyenda de colores */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-3 sm:mb-4 text-[10px] sm:text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-green-500"></div>
              <span className="text-gray-600">{'>'}40%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-blue-500"></div>
              <span className="text-gray-600">25-40%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-yellow-500"></div>
              <span className="text-gray-600">15-25%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-red-500"></div>
              <span className="text-gray-600">{'<'}15%</span>
            </div>
          </div>

          <RentabilidadBarChart
            productos={productosRentabilidadCompleto}
            maxItems={10}
            tipo={tipoGrafico}
          />
        </div>
      )}

      {/* Análisis de Rentabilidad Completo */}
      {productosRentabilidadCompleto.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
              <h2 className="text-sm sm:text-lg font-semibold text-gray-900">
                Rentabilidad por Producto
              </h2>
              <span className="text-[10px] sm:text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full font-medium">
                {productosRentabilidadCompleto.length}
              </span>
            </div>
            <button
              onClick={exportarRentabilidad}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          </div>
          <ProductosRentabilidadTable productos={productosRentabilidadCompleto} />
        </div>
      )}

      {/* Inventario Valorizado */}
      {inventarioValorizado.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-1.5">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-warning-600" />
              <h2 className="text-sm sm:text-lg font-semibold text-gray-900">
                Inventario Valorizado
              </h2>
            </div>
            <button
              onClick={exportarInventario}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          </div>
          <InventarioValorizadoTable inventario={inventarioValorizado} />
        </div>
      )}
      </>
      )}
    </div>
  );
};