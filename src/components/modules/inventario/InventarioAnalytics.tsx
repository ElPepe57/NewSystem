import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  RotateCw,
  Clock,
  Package,
  DollarSign,
  AlertTriangle,
  BarChart3,
  PieChart,
  Target,
  Layers,
  Calendar,
  Filter,
  Download,
  Lightbulb
} from 'lucide-react';
import { Card, Badge, StatCard, StatDistribution, Select, Button } from '../../common';
import type { Unidad } from '../../../types/unidad.types';
import type { Producto } from '../../../types/producto.types';
import type { Almacen } from '../../../types/almacen.types';
import { exportService } from '../../../services/export.service';

interface InventarioAnalyticsProps {
  unidades: Unidad[];
  productos: Producto[];
  almacenes?: Almacen[];
}

interface ProductoAnalyticData {
  productoId: string;
  sku: string;
  nombre: string;
  marca: string;
  cantidadTotal: number;
  valorTotal: number;
  diasEnInventario: number;
  rotacion: number;
  clasificacionABC: 'A' | 'B' | 'C';
  porcentajeValor: number;
  diasParaVencer: number | null;
  stockCritico: boolean;
  // Proyección de agotamiento
  diasHastaAgotar: number | null;
  fechaEstimadaAgotamiento: Date | null;
  ventasDiarias: number;
  requiereReorden: boolean;
}

// Helper para calcular días desde una fecha
const calcularDiasDesde = (fecha: any): number => {
  if (!fecha || !fecha.toDate) return 0;
  const hoy = new Date();
  const fechaDate = fecha.toDate();
  const diffTime = Math.abs(hoy.getTime() - fechaDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Helper para calcular días hasta vencimiento
const calcularDiasParaVencer = (fecha: any): number | null => {
  if (!fecha || !fecha.toDate) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vencimiento = fecha.toDate();
  vencimiento.setHours(0, 0, 0, 0);
  const diffTime = vencimiento.getTime() - hoy.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const InventarioAnalytics: React.FC<InventarioAnalyticsProps> = ({
  unidades,
  productos,
  almacenes = []
}) => {
  // Estados para filtros
  const [filtroPais, setFiltroPais] = useState<'USA' | 'Peru' | ''>('');
  const [filtroAlmacen, setFiltroAlmacen] = useState<string>('');

  // Filtrar unidades activas y aplicar filtros
  const unidadesActivas = useMemo(() => {
    let resultado = unidades.filter(u => u.estado !== 'vendida');

    if (filtroPais) {
      resultado = resultado.filter(u => u.pais === filtroPais);
    }

    if (filtroAlmacen) {
      resultado = resultado.filter(u => u.almacenId === filtroAlmacen);
    }

    return resultado;
  }, [unidades, filtroPais, filtroAlmacen]);

  // Almacenes filtrados por país seleccionado
  const almacenesFiltrados = useMemo(() => {
    if (!filtroPais) return almacenes;
    return almacenes.filter(a => a.pais === filtroPais);
  }, [almacenes, filtroPais]);

  // Análisis ABC y métricas por producto
  const productosAnalytics = useMemo((): ProductoAnalyticData[] => {
    const grupos: Record<string, {
      productoId: string;
      sku: string;
      nombre: string;
      marca: string;
      unidades: Unidad[];
      cantidadTotal: number;
      valorTotal: number;
      fechasMasAntiguas: Date[];
      fechasVencimiento: number[];
    }> = {};

    // Agrupar unidades por producto
    unidadesActivas.forEach(u => {
      if (!grupos[u.productoId]) {
        const producto = productos.find(p => p.id === u.productoId);
        grupos[u.productoId] = {
          productoId: u.productoId,
          sku: u.productoSKU,
          nombre: u.productoNombre,
          marca: producto?.marca || '',
          unidades: [],
          cantidadTotal: 0,
          valorTotal: 0,
          fechasMasAntiguas: [],
          fechasVencimiento: []
        };
      }

      grupos[u.productoId].unidades.push(u);
      grupos[u.productoId].cantidadTotal++;
      grupos[u.productoId].valorTotal += u.costoUnitarioUSD;

      if (u.fechaCreacion?.toDate) {
        grupos[u.productoId].fechasMasAntiguas.push(u.fechaCreacion.toDate());
      }

      const diasVenc = calcularDiasParaVencer(u.fechaVencimiento);
      if (diasVenc !== null) {
        grupos[u.productoId].fechasVencimiento.push(diasVenc);
      }
    });

    // Calcular valor total del inventario
    const valorTotalInventario = Object.values(grupos).reduce((sum, g) => sum + g.valorTotal, 0);

    // Construir datos analíticos
    let result: ProductoAnalyticData[] = Object.values(grupos).map(g => {
      const diasPromedio = g.fechasMasAntiguas.length > 0
        ? g.fechasMasAntiguas.reduce((sum, fecha) => {
            const diffTime = Math.abs(new Date().getTime() - fecha.getTime());
            return sum + Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }, 0) / g.fechasMasAntiguas.length
        : 0;

      const diasParaVencerMin = g.fechasVencimiento.length > 0
        ? Math.min(...g.fechasVencimiento)
        : null;

      const producto = productos.find(p => p.id === g.productoId);
      const stockMinimo = producto?.stockMinimo ?? 0;

      return {
        productoId: g.productoId,
        sku: g.sku,
        nombre: g.nombre,
        marca: g.marca,
        cantidadTotal: g.cantidadTotal,
        valorTotal: g.valorTotal,
        diasEnInventario: Math.round(diasPromedio),
        rotacion: diasPromedio > 0 ? 365 / diasPromedio : 0,
        clasificacionABC: 'C' as 'A' | 'B' | 'C',
        porcentajeValor: valorTotalInventario > 0 ? (g.valorTotal / valorTotalInventario) * 100 : 0,
        diasParaVencer: diasParaVencerMin,
        stockCritico: g.cantidadTotal <= stockMinimo,
        // Proyección de agotamiento (basada en rotación)
        diasHastaAgotar: null,
        fechaEstimadaAgotamiento: null,
        ventasDiarias: 0,
        requiereReorden: false
      };
    });

    // Ordenar por valor para clasificación ABC
    result.sort((a, b) => b.valorTotal - a.valorTotal);

    // Aplicar clasificación ABC (80/15/5) y calcular proyección de agotamiento
    let acumulado = 0;
    const LEAD_TIME_DIAS = 30; // Tiempo de importación USA → Perú

    result = result.map(p => {
      acumulado += p.porcentajeValor;

      // Calcular ventas diarias basadas en rotación
      // Si rotación = 4 (veces/año), entonces ventas anuales = stock * 4
      // Ventas diarias = (stock * rotación) / 365
      const ventasDiarias = p.rotacion > 0 ? (p.cantidadTotal * p.rotacion) / 365 : 0;

      // Días hasta agotar = stock actual / ventas diarias
      const diasHastaAgotar = ventasDiarias > 0 ? Math.round(p.cantidadTotal / ventasDiarias) : null;

      // Fecha estimada de agotamiento
      let fechaEstimadaAgotamiento: Date | null = null;
      if (diasHastaAgotar !== null) {
        fechaEstimadaAgotamiento = new Date();
        fechaEstimadaAgotamiento.setDate(fechaEstimadaAgotamiento.getDate() + diasHastaAgotar);
      }

      // Requiere reorden si días hasta agotar <= lead time
      const requiereReorden = diasHastaAgotar !== null && diasHastaAgotar <= LEAD_TIME_DIAS;

      return {
        ...p,
        clasificacionABC: acumulado <= 80 ? 'A' : acumulado <= 95 ? 'B' : 'C',
        diasHastaAgotar,
        fechaEstimadaAgotamiento,
        ventasDiarias,
        requiereReorden
      };
    });

    return result;
  }, [unidadesActivas, productos]);

  // KPIs principales
  const kpis = useMemo(() => {
    const valorTotalUSD = unidadesActivas.reduce((sum, u) => sum + u.costoUnitarioUSD, 0);
    const totalUnidades = unidadesActivas.length;
    const totalProductos = productosAnalytics.length;

    // Días promedio en inventario
    const diasPromedioInventario = productosAnalytics.length > 0
      ? productosAnalytics.reduce((sum, p) => sum + p.diasEnInventario, 0) / productosAnalytics.length
      : 0;

    // Rotación promedio
    const rotacionPromedio = productosAnalytics.length > 0
      ? productosAnalytics.reduce((sum, p) => sum + p.rotacion, 0) / productosAnalytics.length
      : 0;

    // Por vencer en 30 días
    const porVencer30 = unidadesActivas.filter(u => {
      const dias = calcularDiasParaVencer(u.fechaVencimiento);
      return dias !== null && dias >= 0 && dias <= 30;
    }).length;

    // Por vencer en 60 días
    const porVencer60 = unidadesActivas.filter(u => {
      const dias = calcularDiasParaVencer(u.fechaVencimiento);
      return dias !== null && dias >= 0 && dias <= 60;
    }).length;

    // Stock crítico
    const productosStockCritico = productosAnalytics.filter(p => p.stockCritico).length;

    // Clasificación ABC counts
    const countA = productosAnalytics.filter(p => p.clasificacionABC === 'A').length;
    const countB = productosAnalytics.filter(p => p.clasificacionABC === 'B').length;
    const countC = productosAnalytics.filter(p => p.clasificacionABC === 'C').length;

    // Valor por clasificación
    const valorA = productosAnalytics.filter(p => p.clasificacionABC === 'A').reduce((s, p) => s + p.valorTotal, 0);
    const valorB = productosAnalytics.filter(p => p.clasificacionABC === 'B').reduce((s, p) => s + p.valorTotal, 0);
    const valorC = productosAnalytics.filter(p => p.clasificacionABC === 'C').reduce((s, p) => s + p.valorTotal, 0);

    // Productos sin movimiento (más de 90 días)
    const sinMovimiento = productosAnalytics.filter(p => p.diasEnInventario > 90).length;

    // Valor promedio por unidad
    const valorPromedioUnidad = totalUnidades > 0 ? valorTotalUSD / totalUnidades : 0;

    return {
      valorTotalUSD,
      totalUnidades,
      totalProductos,
      diasPromedioInventario: Math.round(diasPromedioInventario),
      rotacionPromedio: rotacionPromedio.toFixed(1),
      porVencer30,
      porVencer60,
      productosStockCritico,
      countA,
      countB,
      countC,
      valorA,
      valorB,
      valorC,
      sinMovimiento,
      valorPromedioUnidad
    };
  }, [unidadesActivas, productosAnalytics]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Top 5 productos por valor (Clase A)
  const topProductosValor = useMemo(() =>
    productosAnalytics.filter(p => p.clasificacionABC === 'A').slice(0, 5),
    [productosAnalytics]
  );

  // Productos sin movimiento (más de 90 días)
  const productosSinMovimiento = useMemo(() =>
    productosAnalytics.filter(p => p.diasEnInventario > 90).slice(0, 5),
    [productosAnalytics]
  );

  // Productos próximos a vencer
  const productosProximosVencer = useMemo(() =>
    productosAnalytics
      .filter(p => p.diasParaVencer !== null && p.diasParaVencer <= 60 && p.diasParaVencer >= 0)
      .sort((a, b) => (a.diasParaVencer || 0) - (b.diasParaVencer || 0))
      .slice(0, 5),
    [productosAnalytics]
  );

  // Productos que requieren reorden (agotamiento inminente)
  const productosReorden = useMemo(() =>
    productosAnalytics
      .filter(p => p.requiereReorden && p.diasHastaAgotar !== null)
      .sort((a, b) => (a.diasHastaAgotar || 0) - (b.diasHastaAgotar || 0))
      .slice(0, 8),
    [productosAnalytics]
  );

  // Estadísticas de proyección
  const proyeccionStats = useMemo(() => {
    const productosConProyeccion = productosAnalytics.filter(p => p.diasHastaAgotar !== null);
    const productosUrgentes = productosConProyeccion.filter(p => p.diasHastaAgotar !== null && p.diasHastaAgotar <= 15);
    const productosCriticos = productosConProyeccion.filter(p => p.diasHastaAgotar !== null && p.diasHastaAgotar <= 30);
    const productosAlerta = productosConProyeccion.filter(p => p.diasHastaAgotar !== null && p.diasHastaAgotar <= 45);

    return {
      totalConProyeccion: productosConProyeccion.length,
      urgentes: productosUrgentes.length,
      criticos: productosCriticos.length,
      alerta: productosAlerta.length,
      valorUrgente: productosUrgentes.reduce((s, p) => s + p.valorTotal, 0)
    };
  }, [productosAnalytics]);

  // Cálculo de costo de oportunidad para productos sin movimiento
  const costoOportunidad = useMemo(() => {
    const productosSinMov = productosAnalytics.filter(p => p.diasEnInventario > 90);
    const capitalInmovilizado = productosSinMov.reduce((sum, p) => sum + p.valorTotal, 0);
    const recuperacionCon30Descuento = capitalInmovilizado * 0.70;
    const roiPromedioEstimado = 1.25; // 25% de ROI promedio estimado
    const potencialReinversion = recuperacionCon30Descuento * roiPromedioEstimado;

    return {
      totalProductos: productosSinMov.length,
      capitalInmovilizado,
      recuperacionCon30Descuento,
      potencialReinversion,
      gananciaOportunidad: potencialReinversion - recuperacionCon30Descuento
    };
  }, [productosAnalytics]);

  // Función para exportar analytics
  const handleExportarAnalytics = () => {
    // Hoja 1: Resumen KPIs
    const resumenKPIs = [{
      'Métrica': 'Valor Total USD',
      'Valor': kpis.valorTotalUSD,
      'Observación': ''
    }, {
      'Métrica': 'Total Unidades',
      'Valor': kpis.totalUnidades,
      'Observación': ''
    }, {
      'Métrica': 'Total Productos',
      'Valor': kpis.totalProductos,
      'Observación': ''
    }, {
      'Métrica': 'Días Promedio en Inventario',
      'Valor': kpis.diasPromedioInventario,
      'Observación': kpis.diasPromedioInventario > 60 ? 'Considerar optimizar' : 'Saludable'
    }, {
      'Métrica': 'Rotación Anual',
      'Valor': kpis.rotacionPromedio,
      'Observación': parseFloat(kpis.rotacionPromedio) >= 4 ? 'Saludable' : 'Mejorar'
    }, {
      'Métrica': 'Productos Sin Movimiento (>90 días)',
      'Valor': kpis.sinMovimiento,
      'Observación': kpis.sinMovimiento > 0 ? 'Requiere atención' : 'OK'
    }, {
      'Métrica': 'Por Vencer (30 días)',
      'Valor': kpis.porVencer30,
      'Observación': kpis.porVencer30 > 0 ? 'Acción urgente' : 'OK'
    }, {
      'Métrica': 'Stock Crítico',
      'Valor': kpis.productosStockCritico,
      'Observación': kpis.productosStockCritico > 0 ? 'Reordenar' : 'OK'
    }];

    // Hoja 2: Clasificación ABC
    const clasificacionABC = productosAnalytics.map(p => ({
      'SKU': p.sku,
      'Nombre': p.nombre,
      'Marca': p.marca,
      'Clase': p.clasificacionABC,
      'Cantidad': p.cantidadTotal,
      'Valor USD': p.valorTotal,
      '% del Valor': p.porcentajeValor.toFixed(2),
      'Días en Inventario': p.diasEnInventario,
      'Rotación': p.rotacion.toFixed(2),
      'Días para Vencer': p.diasParaVencer || 'N/A',
      'Stock Crítico': p.stockCritico ? 'Sí' : 'No'
    }));

    // Exportar
    exportService.downloadExcel(clasificacionABC, `Analytics_Inventario_${filtroPais || 'Todos'}`);
  };

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltroPais('');
    setFiltroAlmacen('');
  };

  const hayFiltrosActivos = filtroPais !== '' || filtroAlmacen !== '';

  return (
    <div className="space-y-6">
      {/* Barra de Filtros y Exportación */}
      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filtros:</span>
            </div>

            <Select
              value={filtroPais}
              onChange={(e) => {
                setFiltroPais(e.target.value as 'USA' | 'Peru' | '');
                setFiltroAlmacen(''); // Reset almacén al cambiar país
              }}
              options={[
                { value: '', label: 'Todos los países' },
                { value: 'USA', label: '🇺🇸 USA' },
                { value: 'Peru', label: '🇵🇪 Perú' }
              ]}
              className="w-40"
            />

            <Select
              value={filtroAlmacen}
              onChange={(e) => setFiltroAlmacen(e.target.value)}
              options={[
                { value: '', label: 'Todos los almacenes' },
                ...almacenesFiltrados.map(a => ({
                  value: a.id,
                  label: `${a.pais === 'USA' ? '🇺🇸' : '🇵🇪'} ${a.nombre}`
                }))
              ]}
              className="w-52"
              disabled={almacenesFiltrados.length === 0}
            />

            {hayFiltrosActivos && (
              <button
                onClick={limpiarFiltros}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportarAnalytics}
            disabled={productosAnalytics.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar Análisis
          </Button>
        </div>

        {hayFiltrosActivos && (
          <div className="mt-3 text-sm text-gray-600">
            Mostrando análisis de <strong>{unidadesActivas.length}</strong> unidades
            {filtroPais && ` en ${filtroPais === 'USA' ? '🇺🇸 USA' : '🇵🇪 Perú'}`}
            {filtroAlmacen && ` (${almacenes.find(a => a.id === filtroAlmacen)?.nombre || ''})`}
          </div>
        )}
      </Card>

      {/* KPIs Principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          label="Valor Total"
          value={formatCurrency(kpis.valorTotalUSD)}
          icon={DollarSign}
          variant="green"
        />
        <StatCard
          label="Días Promedio"
          value={kpis.diasPromedioInventario}
          subtitle="en inventario"
          icon={Clock}
          variant={kpis.diasPromedioInventario > 60 ? 'amber' : 'blue'}
        />
        <StatCard
          label="Rotación"
          value={kpis.rotacionPromedio}
          subtitle="veces/año"
          icon={RotateCw}
          variant={parseFloat(kpis.rotacionPromedio) > 4 ? 'green' : 'amber'}
        />
        <StatCard
          label="Sin Movimiento"
          value={kpis.sinMovimiento}
          subtitle=">90 días"
          icon={Package}
          variant={kpis.sinMovimiento > 0 ? 'red' : 'default'}
        />
        <StatCard
          label="Por Vencer"
          value={kpis.porVencer30}
          subtitle="30 días"
          icon={AlertTriangle}
          variant={kpis.porVencer30 > 0 ? 'amber' : 'default'}
        />
        <StatCard
          label="Stock Crítico"
          value={kpis.productosStockCritico}
          subtitle="productos"
          icon={TrendingDown}
          variant={kpis.productosStockCritico > 0 ? 'red' : 'default'}
        />
      </div>

      {/* Análisis ABC y Vencimientos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Análisis ABC */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary-600" />
              <h3 className="font-semibold text-gray-900">Análisis ABC (Pareto)</h3>
            </div>
            <Badge variant="info" size="sm">Por Valor</Badge>
          </div>

          <div className="space-y-4">
            {/* Barra visual ABC */}
            <div className="h-4 rounded-full overflow-hidden flex bg-gray-100">
              {kpis.valorTotalUSD > 0 && (
                <>
                  <div
                    className="bg-green-500 transition-all duration-500"
                    style={{ width: `${(kpis.valorA / kpis.valorTotalUSD) * 100}%` }}
                    title={`Clase A: ${formatCurrency(kpis.valorA)}`}
                  />
                  <div
                    className="bg-yellow-500 transition-all duration-500"
                    style={{ width: `${(kpis.valorB / kpis.valorTotalUSD) * 100}%` }}
                    title={`Clase B: ${formatCurrency(kpis.valorB)}`}
                  />
                  <div
                    className="bg-gray-400 transition-all duration-500"
                    style={{ width: `${(kpis.valorC / kpis.valorTotalUSD) * 100}%` }}
                    title={`Clase C: ${formatCurrency(kpis.valorC)}`}
                  />
                </>
              )}
            </div>

            {/* Detalle por clase */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Target className="h-4 w-4 text-green-600" />
                  <span className="font-bold text-green-700">Clase A</span>
                </div>
                <div className="text-xl font-bold text-green-800">{kpis.countA}</div>
                <div className="text-xs text-green-600">productos</div>
                <div className="text-sm font-medium text-green-700 mt-1">
                  {formatCurrency(kpis.valorA)}
                </div>
                <div className="text-xs text-green-600">
                  ({kpis.valorTotalUSD > 0 ? ((kpis.valorA / kpis.valorTotalUSD) * 100).toFixed(0) : 0}% del valor)
                </div>
              </div>

              <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-200">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Layers className="h-4 w-4 text-yellow-600" />
                  <span className="font-bold text-yellow-700">Clase B</span>
                </div>
                <div className="text-xl font-bold text-yellow-800">{kpis.countB}</div>
                <div className="text-xs text-yellow-600">productos</div>
                <div className="text-sm font-medium text-yellow-700 mt-1">
                  {formatCurrency(kpis.valorB)}
                </div>
                <div className="text-xs text-yellow-600">
                  ({kpis.valorTotalUSD > 0 ? ((kpis.valorB / kpis.valorTotalUSD) * 100).toFixed(0) : 0}% del valor)
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Package className="h-4 w-4 text-gray-600" />
                  <span className="font-bold text-gray-700">Clase C</span>
                </div>
                <div className="text-xl font-bold text-gray-800">{kpis.countC}</div>
                <div className="text-xs text-gray-600">productos</div>
                <div className="text-sm font-medium text-gray-700 mt-1">
                  {formatCurrency(kpis.valorC)}
                </div>
                <div className="text-xs text-gray-600">
                  ({kpis.valorTotalUSD > 0 ? ((kpis.valorC / kpis.valorTotalUSD) * 100).toFixed(0) : 0}% del valor)
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 text-center mt-2">
              Clase A = 80% del valor | Clase B = 15% | Clase C = 5%
            </p>
          </div>
        </Card>

        {/* Calendario de Vencimientos */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-gray-900">Calendario de Vencimientos</h3>
            </div>
          </div>

          <StatDistribution
            title=""
            data={[
              {
                label: 'Vencen en 7 días',
                value: unidadesActivas.filter(u => {
                  const dias = calcularDiasParaVencer(u.fechaVencimiento);
                  return dias !== null && dias >= 0 && dias <= 7;
                }).length,
                color: 'bg-red-500'
              },
              {
                label: 'Vencen en 8-30 días',
                value: unidadesActivas.filter(u => {
                  const dias = calcularDiasParaVencer(u.fechaVencimiento);
                  return dias !== null && dias > 7 && dias <= 30;
                }).length,
                color: 'bg-amber-500'
              },
              {
                label: 'Vencen en 31-60 días',
                value: unidadesActivas.filter(u => {
                  const dias = calcularDiasParaVencer(u.fechaVencimiento);
                  return dias !== null && dias > 30 && dias <= 60;
                }).length,
                color: 'bg-yellow-500'
              },
              {
                label: '>60 días o sin fecha',
                value: unidadesActivas.filter(u => {
                  const dias = calcularDiasParaVencer(u.fechaVencimiento);
                  return dias === null || dias > 60;
                }).length,
                color: 'bg-green-500'
              }
            ]}
          />

          {/* Lista de próximos a vencer */}
          {productosProximosVencer.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Próximos a Vencer</h4>
              <div className="space-y-2">
                {productosProximosVencer.map(p => (
                  <div
                    key={p.productoId}
                    className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-100"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs font-semibold text-gray-900">{p.sku}</div>
                      <div className="text-xs text-gray-600 truncate">{p.marca} · {p.nombre}</div>
                    </div>
                    <Badge
                      variant={p.diasParaVencer !== null && p.diasParaVencer <= 7 ? 'danger' : 'warning'}
                      size="sm"
                    >
                      {p.diasParaVencer} días
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Top Productos y Sin Movimiento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 por Valor (Clase A) */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">Top 5 por Valor</h3>
            </div>
            <Badge variant="success" size="sm">Clase A</Badge>
          </div>

          <div className="space-y-3">
            {topProductosValor.map((p, index) => (
              <div
                key={p.productoId}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-sm font-bold text-green-700">#{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-gray-900">{p.sku}</span>
                    <span className="text-xs text-gray-500">{p.cantidadTotal} uds</span>
                  </div>
                  <div className="text-sm text-gray-600 truncate">{p.marca}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{formatCurrency(p.valorTotal)}</div>
                  <div className="text-xs text-gray-500">{p.porcentajeValor.toFixed(1)}%</div>
                </div>
              </div>
            ))}

            {topProductosValor.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                No hay productos con inventario
              </div>
            )}
          </div>
        </Card>

        {/* Productos Sin Movimiento */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Sin Movimiento</h3>
            </div>
            <Badge variant="default" size="sm">&gt;90 días</Badge>
          </div>

          <div className="space-y-3">
            {productosSinMovimiento.map(p => (
              <div
                key={p.productoId}
                className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100"
              >
                <div className="flex-shrink-0">
                  <Clock className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-gray-900">{p.sku}</span>
                    <Badge variant="danger" size="sm">{p.diasEnInventario} días</Badge>
                  </div>
                  <div className="text-sm text-gray-600 truncate">{p.marca} · {p.nombre}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{p.cantidadTotal}</div>
                  <div className="text-xs text-gray-500">unidades</div>
                </div>
              </div>
            ))}

            {productosSinMovimiento.length === 0 && (
              <div className="text-center py-8 text-green-600">
                <Package className="h-8 w-8 mx-auto mb-2 text-green-400" />
                <div className="font-medium">Excelente rotación</div>
                <div className="text-sm text-gray-500">
                  No hay productos estancados
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Costo de Oportunidad - Solo mostrar si hay productos sin movimiento */}
      {costoOportunidad.totalProductos > 0 && (
        <Card padding="md" className="border-2 border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-gray-900">Costo de Oportunidad</h3>
            <Badge variant="warning" size="sm">{costoOportunidad.totalProductos} productos estancados</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white rounded-lg p-4 text-center border border-amber-200">
              <div className="text-2xl font-bold text-red-600">{formatCurrency(costoOportunidad.capitalInmovilizado)}</div>
              <div className="text-sm text-gray-600">Capital Inmovilizado</div>
              <div className="text-xs text-gray-500">&gt;90 días sin movimiento</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center border border-amber-200">
              <div className="text-2xl font-bold text-amber-600">{formatCurrency(costoOportunidad.recuperacionCon30Descuento)}</div>
              <div className="text-sm text-gray-600">Recuperas con 30% off</div>
              <div className="text-xs text-gray-500">Venta con descuento</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center border border-amber-200">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(costoOportunidad.potencialReinversion)}</div>
              <div className="text-sm text-gray-600">Potencial Reinversión</div>
              <div className="text-xs text-gray-500">Con ROI del 25%</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center border border-green-200 bg-green-50">
              <div className="text-2xl font-bold text-green-700">{formatCurrency(costoOportunidad.gananciaOportunidad)}</div>
              <div className="text-sm text-green-600">Ganancia Potencial</div>
              <div className="text-xs text-green-500">Si reinviertes</div>
            </div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-amber-200">
            <p className="text-sm text-gray-700">
              <strong className="text-amber-700">Recomendación:</strong> Tienes <strong>{formatCurrency(costoOportunidad.capitalInmovilizado)}</strong> en
              productos estancados. Si los vendes con <strong>30% de descuento</strong>, recuperas <strong>{formatCurrency(costoOportunidad.recuperacionCon30Descuento)}</strong>.
              Reinvirtiendo ese capital con el ROI promedio del negocio (25%), podrías generar <strong className="text-green-600">{formatCurrency(costoOportunidad.gananciaOportunidad)}</strong> adicionales.
            </p>
          </div>
        </Card>
      )}

      {/* Métricas de Eficiencia */}
      <Card padding="md">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900">Métricas de Eficiencia</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
            <div className="text-2xl font-bold text-blue-700">{kpis.totalProductos}</div>
            <div className="text-sm text-blue-600">SKUs en inventario</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center border border-green-100">
            <div className="text-2xl font-bold text-green-700">{formatCurrency(kpis.valorPromedioUnidad)}</div>
            <div className="text-sm text-green-600">Valor promedio/unidad</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-100">
            <div className="text-2xl font-bold text-purple-700">{kpis.rotacionPromedio}x</div>
            <div className="text-sm text-purple-600">Rotación anual</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 text-center border border-amber-100">
            <div className="text-2xl font-bold text-amber-700">{kpis.diasPromedioInventario}</div>
            <div className="text-sm text-amber-600">Días promedio en stock</div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Interpretación:</strong> Una rotación de {kpis.rotacionPromedio}x significa que el inventario
            se renueva aproximadamente {kpis.rotacionPromedio} veces al año.
            {parseFloat(kpis.rotacionPromedio) >= 4
              ? ' Este es un indicador saludable de gestión de inventario.'
              : ' Considera optimizar la rotación para mejorar el flujo de capital.'}
          </p>
        </div>
      </Card>

      {/* Proyección de Agotamiento y Punto de Reorden */}
      {productosReorden.length > 0 && (
        <Card padding="md" className="border-2 border-red-200 bg-red-50/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h3 className="font-semibold text-gray-900">Proyección de Agotamiento</h3>
              <Badge variant="danger" size="sm">{productosReorden.length} requieren reorden</Badge>
            </div>
            <div className="text-sm text-gray-600">
              Lead time: <strong>30 días</strong> (USA → Perú)
            </div>
          </div>

          {/* Resumen de proyección */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-lg p-3 text-center border border-red-200">
              <div className="text-2xl font-bold text-red-600">{proyeccionStats.urgentes}</div>
              <div className="text-xs text-red-700">Urgente (&lt;15 días)</div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center border border-amber-200">
              <div className="text-2xl font-bold text-amber-600">{proyeccionStats.criticos}</div>
              <div className="text-xs text-amber-700">Crítico (&lt;30 días)</div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600">{proyeccionStats.alerta}</div>
              <div className="text-xs text-yellow-700">Alerta (&lt;45 días)</div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center border border-gray-200">
              <div className="text-2xl font-bold text-gray-700">{formatCurrency(proyeccionStats.valorUrgente)}</div>
              <div className="text-xs text-gray-600">Valor urgente</div>
            </div>
          </div>

          {/* Lista de productos a reordenar */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Productos que requieren reorden inmediato
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {productosReorden.map(p => {
                const urgencia = p.diasHastaAgotar !== null && p.diasHastaAgotar <= 15 ? 'urgente' :
                                 p.diasHastaAgotar !== null && p.diasHastaAgotar <= 30 ? 'critico' : 'alerta';
                const bgColor = urgencia === 'urgente' ? 'bg-red-100 border-red-300' :
                               urgencia === 'critico' ? 'bg-amber-100 border-amber-300' : 'bg-yellow-100 border-yellow-300';
                const textColor = urgencia === 'urgente' ? 'text-red-700' :
                                 urgencia === 'critico' ? 'text-amber-700' : 'text-yellow-700';

                return (
                  <div
                    key={p.productoId}
                    className={`p-3 rounded-lg border ${bgColor}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-gray-900">{p.sku}</span>
                          <Badge
                            variant={urgencia === 'urgente' ? 'danger' : urgencia === 'critico' ? 'warning' : 'default'}
                            size="sm"
                          >
                            {p.diasHastaAgotar} días
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 truncate">{p.marca}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900">{p.cantidadTotal} uds</div>
                        <div className="text-xs text-gray-500">disponibles</div>
                      </div>
                    </div>
                    <div className={`mt-2 text-xs ${textColor} flex items-center gap-1`}>
                      <Calendar className="h-3 w-3" />
                      {p.fechaEstimadaAgotamiento
                        ? `Se agota: ${p.fechaEstimadaAgotamiento.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}`
                        : 'Sin proyección'}
                      {' · '}
                      {p.ventasDiarias.toFixed(2)} uds/día
                    </div>
                    {urgencia === 'urgente' && (
                      <div className="mt-2 text-xs font-medium text-red-800 bg-red-200 rounded px-2 py-1">
                        ⚠️ REORDENAR AHORA - No llegará a tiempo si esperas
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 p-3 bg-white rounded-lg border border-red-200">
            <p className="text-sm text-gray-700">
              <strong className="text-red-700">Punto de Reorden:</strong> Los productos listados se agotarán antes de que llegue un nuevo pedido
              (considerando 30 días de importación). <strong>Debes iniciar el reorden inmediatamente</strong> para evitar roturas de stock.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default InventarioAnalytics;
