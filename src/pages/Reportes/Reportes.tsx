import React, { useEffect, useState, useMemo } from 'react';
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
  RefreshCw
} from 'lucide-react';
import { Card, Button, Badge } from '../../components/common';
import { TendenciaChart } from '../../components/modules/reporte/TendenciaChart';
import { ProductosRentabilidadTable } from '../../components/modules/reporte/ProductosRentabilidadTable';
import { InventarioValorizadoTable } from '../../components/modules/reporte/InventarioValorizadoTable';
import { AlertasInventario } from '../../components/modules/reporte/AlertasInventario';
import { RentabilidadBarChart } from '../../components/modules/reporte/RentabilidadBarChart';
import { FiltroFechas, type PeriodoPreset } from '../../components/modules/reporte/FiltroFechas';
import { useReporteStore } from '../../store/reporteStore';
import { ExcelService } from '../../services/excel.service';
import { gastoService } from '../../services/gasto.service';
import { VentaService } from '../../services/venta.service';

interface RentabilidadNetaMes {
  ventasBrutasMes: number;
  costoProductosMes: number;
  utilidadBrutaMes: number;
  margenBrutoMes: number;
  gastosOperativosMes: number;
  utilidadNetaMes: number;
  margenNetoMes: number;
  unidadesVendidasMes: number;
  cargaPorUnidad: number;
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

  const [rentabilidadNeta, setRentabilidadNeta] = useState<RentabilidadNetaMes | null>(null);
  const [tipoGrafico, setTipoGrafico] = useState<'utilidad' | 'margen' | 'ventas'>('utilidad');
  const [periodoActivo, setPeriodoActivo] = useState<PeriodoPreset>('mes');
  const [fechasFiltro, setFechasFiltro] = useState<{ inicio: Date; fin: Date }>({
    inicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    fin: new Date()
  });

  // Manejar cambio de filtro de fechas
  const handleFiltroFechas = (inicio: Date, fin: Date, periodo: PeriodoPreset) => {
    setFechasFiltro({ inicio, fin });
    setPeriodoActivo(periodo);
  };

  // Productos filtrados por fecha
  const productosRentabilidadFiltrados = useMemo(() => {
    return productosRentabilidad;
  }, [productosRentabilidad, fechasFiltro]);

  // Cargar todos los reportes al montar
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Calcular rentabilidad neta del mes
  useEffect(() => {
    const calcularRentabilidadNeta = async () => {
      try {
        // Obtener gastos prorrateables
        const todosLosGastos = await gastoService.getAll();
        const gastosProrrateables = todosLosGastos.filter(g => g.esProrrateable);
        const gastosOperativosMes = gastosProrrateables.reduce((sum, g) => sum + g.montoPEN, 0);

        // Obtener ventas del mes
        const ventas = await VentaService.getAll();
        const ahora = new Date();
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

        const ventasMes = ventas.filter(v => {
          if (v.estado === 'cancelada' || v.estado === 'cotizacion') return false;
          const fechaVenta = v.fechaCreacion?.toDate?.() || new Date();
          return fechaVenta >= inicioMes;
        });

        // Calcular totales
        let ventasBrutasMes = 0;
        let costoProductosMes = 0;
        let unidadesVendidasMes = 0;

        ventasMes.forEach(v => {
          ventasBrutasMes += v.totalPEN || 0;
          costoProductosMes += v.costoTotalPEN || 0;
          unidadesVendidasMes += v.productos.reduce((s, p) => s + p.cantidad, 0);
        });

        const utilidadBrutaMes = ventasBrutasMes - costoProductosMes;
        const margenBrutoMes = ventasBrutasMes > 0 ? (utilidadBrutaMes / ventasBrutasMes) * 100 : 0;
        const utilidadNetaMes = utilidadBrutaMes - gastosOperativosMes;
        const margenNetoMes = ventasBrutasMes > 0 ? (utilidadNetaMes / ventasBrutasMes) * 100 : 0;
        const cargaPorUnidad = unidadesVendidasMes > 0 ? gastosOperativosMes / unidadesVendidasMes : 0;

        setRentabilidadNeta({
          ventasBrutasMes,
          costoProductosMes,
          utilidadBrutaMes,
          margenBrutoMes,
          gastosOperativosMes,
          utilidadNetaMes,
          margenNetoMes,
          unidadesVendidasMes,
          cargaPorUnidad
        });
      } catch (error) {
        console.error('Error calculando rentabilidad neta:', error);
      }
    };

    calcularRentabilidadNeta();
  }, []);

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
    if (productosRentabilidad.length === 0) return;

    const data = productosRentabilidad.map(p => ({
      'SKU': p.sku,
      'Marca': p.marca,
      'Nombre Comercial': p.nombreComercial,
      'Unidades Vendidas': p.unidadesVendidas,
      'Ventas Total (PEN)': p.ventasTotalPEN,
      'Costo Total (PEN)': p.costoTotalPEN,
      'Utilidad (PEN)': p.utilidadPEN,
      'Margen Promedio (%)': p.margenPromedio,
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
      'Unidades Miami': i.unidadesMiami,
      'Unidades Utah': i.unidadesUtah,
      'Unidades Peru': i.unidadesPeru
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-600 mt-1">Analisis ejecutivo y metricas del negocio</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => fetchAll()}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            variant="outline"
            onClick={exportarTodo}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Todo
          </Button>
        </div>
      </div>

      {/* Filtro de Fechas */}
      <FiltroFechas
        onFiltroChange={handleFiltroFechas}
        periodoInicial="mes"
      />

      {/* Resumen Ejecutivo */}
      {resumenEjecutivo && (
        <>
          {/* KPIs Principales */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Resumen Ejecutivo</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card padding="md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Ventas Totales</div>
                    <div className="text-2xl font-bold text-primary-600 mt-1">
                      S/ {resumenEjecutivo.ventasTotalesPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Mes: S/ {resumenEjecutivo.ventasMes.toFixed(0)}
                    </div>
                  </div>
                  <ShoppingCart className="h-10 w-10 text-primary-400" />
                </div>
              </Card>

              <Card padding="md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Utilidad Total</div>
                    <div className="text-2xl font-bold text-success-600 mt-1">
                      S/ {resumenEjecutivo.utilidadTotalPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Margen: {resumenEjecutivo.margenPromedio.toFixed(1)}%
                    </div>
                  </div>
                  <TrendingUp className="h-10 w-10 text-success-400" />
                </div>
              </Card>

              {resumenEjecutivo.costoEnvioAsumidoPEN > 0 && (
                <Card padding="md" className="bg-orange-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Envíos Asumidos</div>
                      <div className="text-2xl font-bold text-orange-600 mt-1">
                        S/ {resumenEjecutivo.costoEnvioAsumidoPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Costo asumido por la empresa
                      </div>
                    </div>
                    <Truck className="h-10 w-10 text-orange-400" />
                  </div>
                </Card>
              )}

              <Card padding="md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Valor Inventario</div>
                    <div className="text-2xl font-bold text-warning-600 mt-1">
                      S/ {resumenEjecutivo.valorInventarioPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {resumenEjecutivo.unidadesDisponibles} disponibles
                    </div>
                  </div>
                  <Package className="h-10 w-10 text-warning-400" />
                </div>
              </Card>

              <Card padding="md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Inversión Total</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">
                      ${resumenEjecutivo.inversionTotalUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      TC: {resumenEjecutivo.tcActual.toFixed(3)}
                    </div>
                  </div>
                  <DollarSign className="h-10 w-10 text-gray-400" />
                </div>
              </Card>
            </div>
          </div>

          {/* KPIs Secundarios */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card padding="md">
              <div className="text-sm text-gray-600 mb-2">Ventas por Período</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Hoy:</span>
                  <span className="font-semibold text-gray-900">
                    S/ {resumenEjecutivo.ventasHoy.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Semana:</span>
                  <span className="font-semibold text-gray-900">
                    S/ {resumenEjecutivo.ventasSemana.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Mes:</span>
                  <span className="font-semibold text-primary-600">
                    S/ {resumenEjecutivo.ventasMes.toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>

            <Card padding="md">
              <div className="text-sm text-gray-600 mb-2">Inventario</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Total Unidades:</span>
                  <span className="font-semibold text-gray-900">
                    {resumenEjecutivo.unidadesTotales}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Disponibles:</span>
                  <span className="font-semibold text-success-600">
                    {resumenEjecutivo.unidadesDisponibles}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Productos:</span>
                  <span className="font-semibold text-gray-900">
                    {resumenEjecutivo.productosActivos}
                  </span>
                </div>
              </div>
            </Card>

            <Card padding="md">
              <div className="text-sm text-gray-600 mb-2">Órdenes de Compra</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Activas:</span>
                  <span className="font-semibold text-warning-600">
                    {resumenEjecutivo.ordenesActivas}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Recibidas:</span>
                  <span className="font-semibold text-success-600">
                    {resumenEjecutivo.ordenesRecibidas}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">TC Promedio:</span>
                  <span className="font-semibold text-gray-900">
                    {resumenEjecutivo.tcPromedio.toFixed(3)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Rentabilidad Neta del Mes */}
      {rentabilidadNeta && (
        <Card padding="md" className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Calculator className="h-6 w-6 text-orange-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">
                Rentabilidad Neta del Mes
              </h2>
            </div>
            <span className="text-sm text-gray-500">
              Incluye gastos operativos prorrateados
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Ventas Brutas */}
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">Ventas Brutas</div>
              <div className="text-2xl font-bold text-gray-900">
                S/ {rentabilidadNeta.ventasBrutasMes.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {rentabilidadNeta.unidadesVendidasMes} unidades vendidas
              </div>
            </div>

            {/* Utilidad Bruta */}
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">Utilidad Bruta</div>
              <div className={`text-2xl font-bold ${rentabilidadNeta.utilidadBrutaMes >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                S/ {rentabilidadNeta.utilidadBrutaMes.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Margen: {rentabilidadNeta.margenBrutoMes.toFixed(1)}%
              </div>
            </div>

            {/* Gastos Operativos */}
            <div className="bg-white p-4 rounded-lg border border-orange-200">
              <div className="text-sm text-gray-600 mb-1">Gastos Operativos</div>
              <div className="text-2xl font-bold text-orange-600">
                S/ {rentabilidadNeta.gastosOperativosMes.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                S/ {rentabilidadNeta.cargaPorUnidad.toFixed(2)} por unidad
              </div>
            </div>

            {/* Utilidad Neta */}
            <div className={`p-4 rounded-lg border-2 ${rentabilidadNeta.utilidadNetaMes >= 0 ? 'bg-success-50 border-success-300' : 'bg-danger-50 border-danger-300'}`}>
              <div className="text-sm text-gray-600 mb-1">Utilidad Neta</div>
              <div className={`text-2xl font-bold ${rentabilidadNeta.utilidadNetaMes >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                S/ {rentabilidadNeta.utilidadNetaMes.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
              <div className={`text-sm font-semibold mt-1 ${rentabilidadNeta.margenNetoMes >= 0 ? 'text-success-700' : 'text-danger-700'}`}>
                Margen Neto: {rentabilidadNeta.margenNetoMes.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Desglose visual */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Desglose del Mes</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Ventas Brutas:</span>
                <span className="font-medium">S/ {rentabilidadNeta.ventasBrutasMes.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 ml-4">- Costo de Productos:</span>
                <span className="text-gray-600">S/ {rentabilidadNeta.costoProductosMes.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-100 pt-2">
                <span className="text-gray-700 font-medium">= Utilidad Bruta:</span>
                <span className={`font-semibold ${rentabilidadNeta.utilidadBrutaMes >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  S/ {rentabilidadNeta.utilidadBrutaMes.toFixed(2)} ({rentabilidadNeta.margenBrutoMes.toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-orange-600 ml-4">- Gastos Operativos:</span>
                <span className="text-orange-600">S/ {rentabilidadNeta.gastosOperativosMes.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-t-2 border-gray-300 pt-2">
                <span className="text-gray-900 font-bold">= UTILIDAD NETA:</span>
                <span className={`text-lg font-bold ${rentabilidadNeta.utilidadNetaMes >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  S/ {rentabilidadNeta.utilidadNetaMes.toFixed(2)} ({rentabilidadNeta.margenNetoMes.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Alertas de Inventario */}
      {alertasInventario.length > 0 && (
        <Card padding="md">
          <div className="flex items-center mb-4">
            <AlertTriangle className="h-6 w-6 text-warning-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">
              Alertas de Inventario ({alertasInventario.length})
            </h2>
          </div>
          <AlertasInventario alertas={alertasInventario} />
        </Card>
      )}

      {/* Tendencia de Ventas */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Activity className="h-6 w-6 text-primary-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">
              Tendencia de Ventas (30 días)
            </h2>
          </div>
          {tendenciaVentas.length > 0 && (
            <button
              onClick={exportarTendencia}
              className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
            >
              <Download className="h-4 w-4" />
              Excel
            </button>
          )}
        </div>
        <TendenciaChart data={tendenciaVentas} />
      </Card>

      {/* Ventas por Canal */}
      {ventasPorCanal && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card padding="md">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">Mercado Libre</div>
              <PieChart className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {ventasPorCanal.mercadoLibre.cantidad}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              S/ {ventasPorCanal.mercadoLibre.totalPEN.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {ventasPorCanal.mercadoLibre.porcentaje.toFixed(1)}% del total
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">Venta Directa</div>
              <PieChart className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {ventasPorCanal.directo.cantidad}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              S/ {ventasPorCanal.directo.totalPEN.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {ventasPorCanal.directo.porcentaje.toFixed(1)}% del total
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">Otros Canales</div>
              <PieChart className="h-5 w-5 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {ventasPorCanal.otro.cantidad}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              S/ {ventasPorCanal.otro.totalPEN.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {ventasPorCanal.otro.porcentaje.toFixed(1)}% del total
            </div>
          </Card>
        </div>
      )}

      {/* Top Productos por Rentabilidad */}
      {resumenEjecutivo && resumenEjecutivo.productosMasVendidos.length > 0 && (
        <Card padding="md">
          <div className="flex items-center mb-4">
            <BarChart3 className="h-6 w-6 text-success-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">
              Top 5 Productos Más Vendidos
            </h2>
          </div>
          <ProductosRentabilidadTable productos={resumenEjecutivo.productosMasVendidos} />
        </Card>
      )}

      {/* Gráfico de Barras - Rentabilidad Visual */}
      {productosRentabilidad.length > 0 && (
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <BarChart3 className="h-6 w-6 text-primary-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">
                Top 10 Productos por Rentabilidad
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Ver por:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setTipoGrafico('utilidad')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    tipoGrafico === 'utilidad'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Utilidad
                </button>
                <button
                  onClick={() => setTipoGrafico('margen')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    tipoGrafico === 'margen'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Margen %
                </button>
                <button
                  onClick={() => setTipoGrafico('ventas')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    tipoGrafico === 'ventas'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Ventas
                </button>
              </div>
            </div>
          </div>

          {/* Leyenda de colores */}
          <div className="flex items-center gap-4 mb-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span className="text-gray-600">Margen ≥40%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span className="text-gray-600">25-40%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-500"></div>
              <span className="text-gray-600">15-25%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span className="text-gray-600">&lt;15%</span>
            </div>
          </div>

          <RentabilidadBarChart
            productos={productosRentabilidadFiltrados}
            maxItems={10}
            tipo={tipoGrafico}
          />
        </Card>
      )}

      {/* Análisis de Rentabilidad Completo */}
      {productosRentabilidad.length > 0 && (
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <TrendingUp className="h-6 w-6 text-primary-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">
                Analisis de Rentabilidad por Producto
              </h2>
              <Badge variant="info" size="sm" className="ml-2">
                {productosRentabilidad.length} productos
              </Badge>
            </div>
            <button
              onClick={exportarRentabilidad}
              className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
            >
              <Download className="h-4 w-4" />
              Excel
            </button>
          </div>
          <ProductosRentabilidadTable productos={productosRentabilidad} />
        </Card>
      )}

      {/* Inventario Valorizado */}
      {inventarioValorizado.length > 0 && (
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Package className="h-6 w-6 text-warning-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">
                Inventario Valorizado
              </h2>
            </div>
            <button
              onClick={exportarInventario}
              className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
            >
              <Download className="h-4 w-4" />
              Excel
            </button>
          </div>
          <InventarioValorizadoTable inventario={inventarioValorizado} />
        </Card>
      )}
    </div>
  );
};