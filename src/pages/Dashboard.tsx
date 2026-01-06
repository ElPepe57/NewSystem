import React, { useEffect, useState, useMemo } from 'react';
import {
  Package,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Warehouse,
  Box,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  CheckCircle,
  Search,
  Calendar,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Clock,
  Users,
  Truck
} from 'lucide-react';
import { Card, Badge, DashboardSkeleton } from '../components/common';
import {
  UsuariosActivosWidget,
  VencimientosWidget,
  TopProductosWidget,
  VentasPorCanalWidget,
  ActividadRecienteWidget
} from '../components/modules/dashboard';
import type { ActividadItem, TipoActividad } from '../components/modules/dashboard';
import { useProductoStore } from '../store/productoStore';
import { useInventarioStore } from '../store/inventarioStore';
import { useVentaStore } from '../store/ventaStore';
import { useOrdenCompraStore } from '../store/ordenCompraStore';
import { useGastoStore } from '../store/gastoStore';
import { useTipoCambioStore } from '../store/tipoCambioStore';
import { useAuthStore } from '../store/authStore';
import { cuentasPendientesService } from '../services/cuentasPendientes.service';
import type { DashboardCuentasPendientes } from '../types/tesoreria.types';
import { Link } from 'react-router-dom';
import type { Producto } from '../types/producto.types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar
} from 'recharts';

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);

  const { productos, fetchProductos } = useProductoStore();
  const { resumen: resumenInventario, inventario, fetchResumen, fetchInventario } = useInventarioStore();
  const { ventas, stats: ventasStats, fetchVentas, fetchStats: fetchVentasStats } = useVentaStore();
  const { ordenes, stats: ordenesStats, fetchOrdenes, fetchStats: fetchOrdenesStats } = useOrdenCompraStore();
  const { stats: gastosStats, fetchStats: fetchGastosStats } = useGastoStore();
  const { getTCDelDia } = useTipoCambioStore();
  const { userProfile } = useAuthStore();

  const isAdmin = userProfile?.role === 'admin';

  const [tipoCambioDelDia, setTipoCambioDelDia] = useState<any>(null);
  const [dashboardCxPCxC, setDashboardCxPCxC] = useState<DashboardCuentasPendientes | null>(null);

  // Cargar todos los datos al montar
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);

        // Cargar tipo de cambio por separado
        const tc = await getTCDelDia();
        setTipoCambioDelDia(tc);

        // Cargar resto de datos en paralelo
        await Promise.all([
          fetchProductos(),
          fetchResumen(),
          fetchInventario({ soloConStock: true }),
          fetchVentas(),
          fetchVentasStats(),
          fetchOrdenes(),
          fetchOrdenesStats()
        ]);

        // Intentar cargar gastos stats (puede fallar si no hay índice Firestore)
        try {
          await fetchGastosStats();
        } catch (error) {
          console.warn('No se pudieron cargar estadísticas de gastos. Puede requerir un índice Firestore:', error);
        }

        // Cargar dashboard de CxP/CxC
        try {
          const cxpCxc = await cuentasPendientesService.getDashboard();
          setDashboardCxPCxC(cxpCxc);
        } catch (error) {
          console.warn('No se pudieron cargar cuentas pendientes:', error);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error cargando datos del dashboard:', error);
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Calcular métricas derivadas
  const productosActivos = productos?.filter(p => p.estado === 'activo').length || 0;

  // Stock crítico usando inventario agregado (array)
  const stockCritico = inventario?.filter(inv => {
    const producto = productos?.find(p => p.id === inv.productoId);
    return inv.stockCritico || (inv.disponibles > 0 && producto?.stockMinimo && inv.disponibles <= producto.stockMinimo);
  }).length || 0;

  // Valor total usando resumen (object)
  const valorInventarioPEN = resumenInventario?.total?.valorUSD
    ? resumenInventario.total.valorUSD * (tipoCambioDelDia?.compra || 3.8)
    : 0;

  // Ventas del mes
  const ahora = new Date();
  const ventasMesActual = ventas?.filter(v => {
    if (!v.fechaCreacion || !v.fechaCreacion.toDate) return false;
    const fecha = v.fechaCreacion.toDate();
    return fecha.getMonth() === ahora.getMonth() &&
           fecha.getFullYear() === ahora.getFullYear() &&
           v.estado !== 'cancelada';
  }) || [];

  const totalVentasMes = ventasMesActual.reduce((sum, v) => sum + v.totalPEN, 0);
  const utilidadMes = ventasMesActual.reduce((sum, v) => sum + (v.utilidadBrutaPEN || 0), 0);
  const margenPromedioMes = ventasMesActual.length > 0
    ? ventasMesActual.reduce((sum, v) => sum + (v.margenPromedio || 0), 0) / ventasMesActual.length
    : 0;

  // Órdenes en proceso
  const ordenesEnProceso = ordenes?.filter(o =>
    ['enviada', 'pagada', 'en_transito'].includes(o.estado)
  ) || [];

  // === MÉTRICAS DE ROI ===
  const metricsROI = useMemo(() => {
    // Productos con investigación válida
    const productosConInvestigacion = (productos || []).filter(p =>
      p.investigacion &&
      p.investigacion.ctruEstimado > 0 &&
      p.investigacion.precioPERUPromedio > 0
    );

    // Calcular ROI para cada producto
    const productosConROI = productosConInvestigacion.map(p => {
      const inv = p.investigacion!;
      const ganancia = inv.precioPERUPromedio - inv.ctruEstimado;
      const roi = (ganancia / inv.ctruEstimado) * 100;
      const multiplicador = inv.precioPERUPromedio / inv.ctruEstimado;
      return {
        ...p,
        roiCalculado: roi,
        gananciaCalculada: ganancia,
        multiplicadorCalculado: multiplicador
      };
    });

    // ROI Promedio
    const roiPromedio = productosConROI.length > 0
      ? productosConROI.reduce((sum, p) => sum + p.roiCalculado, 0) / productosConROI.length
      : 0;

    // Multiplicador promedio
    const multiplicadorPromedio = productosConROI.length > 0
      ? productosConROI.reduce((sum, p) => sum + p.multiplicadorCalculado, 0) / productosConROI.length
      : 0;

    // Top 5 mejor ROI
    const topMejorROI = [...productosConROI]
      .sort((a, b) => b.roiCalculado - a.roiCalculado)
      .slice(0, 5);

    // Productos recomendados para importar (con investigación vigente y recomendación "importar")
    const oportunidadesInversion = (productos || []).filter(p => {
      if (!p.investigacion) return false;
      const inv = p.investigacion;
      const vigenciaHasta = inv.vigenciaHasta?.toDate?.();
      const estaVigente = vigenciaHasta ? vigenciaHasta > new Date() : false;
      return estaVigente && inv.recomendacion === 'importar';
    }).map(p => {
      const inv = p.investigacion!;
      const ganancia = inv.precioPERUPromedio - inv.ctruEstimado;
      const roi = inv.ctruEstimado > 0 ? (ganancia / inv.ctruEstimado) * 100 : 0;
      return { ...p, roiCalculado: roi, gananciaCalculada: ganancia };
    }).sort((a, b) => b.roiCalculado - a.roiCalculado);

    // Productos sin investigar (activos)
    const productosSinInvestigar = (productos || []).filter(p =>
      p.estado === 'activo' && !p.investigacion
    ).length;

    return {
      productosConInvestigacion: productosConInvestigacion.length,
      roiPromedio,
      multiplicadorPromedio,
      topMejorROI,
      oportunidadesInversion,
      productosSinInvestigar
    };
  }, [productos]);

  // === DATOS PARA GRÁFICOS ===

  // Ventas últimos 30 días (agrupadas por día)
  const ventasUltimos30Dias = useMemo(() => {
    const hoy = new Date();
    const hace30Dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Crear array de los últimos 30 días
    const dias: { fecha: string; fechaCompleta: Date; ventas: number; cantidad: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const fecha = new Date(hoy.getTime() - i * 24 * 60 * 60 * 1000);
      dias.push({
        fecha: fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
        fechaCompleta: fecha,
        ventas: 0,
        cantidad: 0
      });
    }

    // Agrupar ventas por día
    (ventas || []).forEach(v => {
      if (!v.fechaCreacion?.toDate || v.estado === 'cancelada') return;
      const fechaVenta = v.fechaCreacion.toDate();
      if (fechaVenta < hace30Dias) return;

      const diaIndex = dias.findIndex(d =>
        d.fechaCompleta.toDateString() === fechaVenta.toDateString()
      );
      if (diaIndex >= 0) {
        dias[diaIndex].ventas += v.totalPEN || 0;
        dias[diaIndex].cantidad += 1;
      }
    });

    return dias;
  }, [ventas]);

  // Distribución de inventario por país
  const distribucionInventario = useMemo(() => {
    const peru = resumenInventario?.peru?.totalUnidades || 0;
    const usa = resumenInventario?.usa?.totalUnidades || 0;
    const transito = (resumenInventario?.peru?.enTransito || 0) + (resumenInventario?.usa?.enTransito || 0);

    return [
      { name: 'Perú', value: peru, color: '#10B981' },
      { name: 'USA', value: usa, color: '#3B82F6' },
      { name: 'En Tránsito', value: transito, color: '#F59E0B' }
    ].filter(item => item.value > 0);
  }, [resumenInventario]);

  // Ventas por canal (para gráfico de barras)
  const ventasPorCanalData = useMemo(() => {
    return [
      { canal: 'M. Libre', ventas: ventasStats?.ventasML || 0, color: '#FBBF24' },
      { canal: 'Directo', ventas: ventasStats?.ventasDirecto || 0, color: '#3B82F6' },
      { canal: 'Otros', ventas: ventasStats?.ventasOtro || 0, color: '#8B5CF6' }
    ];
  }, [ventasStats]);

  // Top productos vendidos (basado en ventas reales)
  const topProductosVendidos = useMemo(() => {
    const ventasEntregadas = (ventas || []).filter(v => v.estado === 'entregada');
    const productosMap = new Map<string, {
      productoId: string;
      sku: string;
      marca: string;
      nombreComercial: string;
      unidadesVendidas: number;
      ventasTotalPEN: number;
      utilidadPEN: number;
      margenPromedio: number;
    }>();

    for (const venta of ventasEntregadas) {
      for (const producto of venta.productos) {
        if (!productosMap.has(producto.productoId)) {
          productosMap.set(producto.productoId, {
            productoId: producto.productoId,
            sku: producto.sku,
            marca: producto.marca,
            nombreComercial: producto.nombreComercial,
            unidadesVendidas: 0,
            ventasTotalPEN: 0,
            utilidadPEN: 0,
            margenPromedio: 0
          });
        }
        const item = productosMap.get(producto.productoId)!;
        item.unidadesVendidas += producto.cantidad;
        item.ventasTotalPEN += producto.subtotal;
        item.utilidadPEN += producto.subtotal - (producto.costoTotalUnidades || 0);
      }
    }

    // Calcular margen promedio
    return Array.from(productosMap.values())
      .map(p => ({
        ...p,
        margenPromedio: p.ventasTotalPEN > 0 ? (p.utilidadPEN / p.ventasTotalPEN) * 100 : 0
      }))
      .sort((a, b) => b.ventasTotalPEN - a.ventasTotalPEN)
      .slice(0, 10);
  }, [ventas]);

  // Datos para VentasPorCanalWidget (gráfico circular)
  const ventasPorCanalPie = useMemo(() => {
    const ventasEntregadas = (ventas || []).filter(v => v.estado === 'entregada');
    const stats = {
      mercadoLibre: { cantidad: 0, totalPEN: 0, porcentaje: 0 },
      directo: { cantidad: 0, totalPEN: 0, porcentaje: 0 },
      otro: { cantidad: 0, totalPEN: 0, porcentaje: 0 }
    };
    let total = 0;

    ventasEntregadas.forEach(v => {
      total += v.totalPEN;
      if (v.canal === 'mercado_libre') {
        stats.mercadoLibre.cantidad++;
        stats.mercadoLibre.totalPEN += v.totalPEN;
      } else if (v.canal === 'directo') {
        stats.directo.cantidad++;
        stats.directo.totalPEN += v.totalPEN;
      } else {
        stats.otro.cantidad++;
        stats.otro.totalPEN += v.totalPEN;
      }
    });

    if (total > 0) {
      stats.mercadoLibre.porcentaje = (stats.mercadoLibre.totalPEN / total) * 100;
      stats.directo.porcentaje = (stats.directo.totalPEN / total) * 100;
      stats.otro.porcentaje = (stats.otro.totalPEN / total) * 100;
    }

    return stats;
  }, [ventas]);

  // Actividad reciente (últimas operaciones)
  const actividadReciente = useMemo((): ActividadItem[] => {
    const actividades: ActividadItem[] = [];

    // Agregar ventas recientes
    (ventas || []).slice(0, 10).forEach(v => {
      const fecha = v.fechaCreacion?.toDate?.() || new Date();
      const tipo: TipoActividad = v.estado === 'entregada' ? 'venta_entregada' : 'venta_nueva';
      actividades.push({
        id: `venta-${v.id}`,
        tipo,
        titulo: `Venta ${v.numeroVenta}`,
        descripcion: `${v.nombreCliente} - S/ ${v.totalPEN.toFixed(2)}`,
        fecha,
        entidadId: v.id
      });
    });

    // Agregar órdenes recientes
    (ordenes || []).slice(0, 5).forEach(o => {
      const fecha = o.fechaCreacion?.toDate?.() || new Date();
      const tipo: TipoActividad = o.estado === 'recibida' ? 'orden_recibida' : 'orden_creada';
      actividades.push({
        id: `orden-${o.id}`,
        tipo,
        titulo: `Orden ${o.numeroOrden}`,
        descripcion: `${o.nombreProveedor} - ${o.productos?.length || 0} productos`,
        fecha,
        entidadId: o.id
      });
    });

    // Ordenar por fecha descendente
    return actividades.sort((a, b) => b.fecha.getTime() - a.fecha.getTime()).slice(0, 15);
  }, [ventas, ordenes]);

  // Colores para el PieChart
  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'];

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatCurrencyShort = (amount: number): string => {
    if (amount >= 1000) {
      return `S/ ${(amount / 1000).toFixed(1)}k`;
    }
    return `S/ ${amount.toFixed(0)}`;
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Resumen ejecutivo del sistema - {new Date().toLocaleDateString('es-PE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Productos */}
        <Link to="/productos">
          <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Productos Activos</div>
                <div className="text-3xl font-bold text-gray-900 mt-1">
                  {productosActivos}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {productos.length} total
                </div>
              </div>
              <Package className="h-10 w-10 text-primary-400" />
            </div>
          </Card>
        </Link>

        {/* Valor Inventario */}
        <Link to="/inventario">
          <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Valor Inventario</div>
                <div className="text-3xl font-bold text-gray-900 mt-1">
                  {formatCurrency(valorInventarioPEN)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  En stock disponible
                </div>
              </div>
              <Warehouse className="h-10 w-10 text-blue-400" />
            </div>
          </Card>
        </Link>

        {/* Ventas del Mes */}
        <Link to="/ventas">
          <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Ventas del Mes</div>
                <div className="text-3xl font-bold text-gray-900 mt-1">
                  {formatCurrency(totalVentasMes)}
                </div>
                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  {margenPromedioMes >= 25 ? (
                    <ArrowUpRight className="h-3 w-3 text-success-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-danger-500" />
                  )}
                  Margen: {margenPromedioMes.toFixed(1)}%
                </div>
              </div>
              <ShoppingCart className="h-10 w-10 text-success-400" />
            </div>
          </Card>
        </Link>

        {/* Utilidad del Mes */}
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Utilidad del Mes</div>
              <div className="text-3xl font-bold text-success-600 mt-1">
                {formatCurrency(utilidadMes)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {ventasMesActual.length} ventas
              </div>
            </div>
            <TrendingUp className="h-10 w-10 text-success-400" />
          </div>
        </Card>
      </div>

      {/* Segunda fila de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stock Crítico */}
        <Link to="/inventario">
          <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Stock Crítico</div>
                <div className="text-3xl font-bold text-warning-600 mt-1">
                  {stockCritico}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Productos bajo mínimo
                </div>
              </div>
              <AlertTriangle className="h-10 w-10 text-warning-400" />
            </div>
          </Card>
        </Link>

        {/* Órdenes en Proceso */}
        <Link to="/compras">
          <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Órdenes en Proceso</div>
                <div className="text-3xl font-bold text-gray-900 mt-1">
                  {ordenesEnProceso.length}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {ordenesStats?.enTransito || 0} en tránsito
                </div>
              </div>
              <Box className="h-10 w-10 text-primary-400" />
            </div>
          </Card>
        </Link>

        {/* Gastos del Mes */}
        <Link to="/gastos">
          <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Gastos del Mes</div>
                <div className="text-3xl font-bold text-gray-900 mt-1">
                  {formatCurrency(gastosStats?.totalMesActual || 0)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {gastosStats?.cantidadGastosMesActual || 0} gastos
                </div>
              </div>
              <Receipt className="h-10 w-10 text-gray-400" />
            </div>
          </Card>
        </Link>

        {/* Tipo de Cambio */}
        <Link to="/tipo-cambio">
          <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Tipo de Cambio</div>
                <div className="text-3xl font-bold text-gray-900 mt-1">
                  {tipoCambioDelDia?.compra.toFixed(3) || '-'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Venta: {tipoCambioDelDia?.venta.toFixed(3) || '-'}
                </div>
              </div>
              <DollarSign className="h-10 w-10 text-success-400" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Tercera fila: Métricas de Inversión (ROI) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ROI Promedio */}
        <Link to="/productos">
          <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-emerald-50 to-teal-50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">ROI Promedio</div>
                <div className={`text-3xl font-bold mt-1 ${metricsROI.roiPromedio > 50 ? 'text-emerald-600' : metricsROI.roiPromedio > 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {metricsROI.roiPromedio.toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {metricsROI.productosConInvestigacion} productos analizados
                </div>
              </div>
              <Target className="h-10 w-10 text-emerald-400" />
            </div>
          </Card>
        </Link>

        {/* Multiplicador Promedio */}
        <Card padding="md" className="bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Multiplicador Promedio</div>
              <div className={`text-3xl font-bold mt-1 ${metricsROI.multiplicadorPromedio >= 2 ? 'text-emerald-600' : metricsROI.multiplicadorPromedio >= 1.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                {metricsROI.multiplicadorPromedio.toFixed(2)}x
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Por cada S/ 1 invertido
              </div>
            </div>
            <TrendingUp className="h-10 w-10 text-blue-400" />
          </div>
        </Card>

        {/* Oportunidades de Inversión */}
        <Link to="/productos">
          <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-green-50 to-emerald-50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Oportunidades</div>
                <div className="text-3xl font-bold text-green-600 mt-1">
                  {metricsROI.oportunidadesInversion.length}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Productos recomendados importar
                </div>
              </div>
              <CheckCircle className="h-10 w-10 text-green-400" />
            </div>
          </Card>
        </Link>

        {/* Sin Investigar */}
        <Link to="/productos">
          <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-orange-50 to-amber-50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Sin Investigar</div>
                <div className="text-3xl font-bold text-orange-600 mt-1">
                  {metricsROI.productosSinInvestigar}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Productos activos pendientes
                </div>
              </div>
              <Search className="h-10 w-10 text-orange-400" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Cuarta fila: Cuentas por Cobrar / Pagar (CxC/CxP) */}
      {dashboardCxPCxC && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Por Cobrar */}
          <Link to="/tesoreria">
            <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 flex items-center gap-1">
                    <ArrowDownRight className="h-4 w-4 text-green-600" />
                    Por Cobrar (CxC)
                  </div>
                  <div className="text-2xl font-bold text-green-600 mt-1">
                    {formatCurrency(dashboardCxPCxC.cuentasPorCobrar.totalEquivalentePEN)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {dashboardCxPCxC.cuentasPorCobrar.cantidadDocumentos} ventas pendientes
                  </div>
                </div>
                <Banknote className="h-10 w-10 text-green-400" />
              </div>
            </Card>
          </Link>

          {/* Por Pagar */}
          <Link to="/tesoreria">
            <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-red-50 to-rose-50 border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 flex items-center gap-1">
                    <ArrowUpRight className="h-4 w-4 text-red-600" />
                    Por Pagar (CxP)
                  </div>
                  <div className="text-2xl font-bold text-red-600 mt-1">
                    {formatCurrency(dashboardCxPCxC.cuentasPorPagar.totalEquivalentePEN)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {dashboardCxPCxC.cuentasPorPagar.cantidadDocumentos} documentos
                  </div>
                </div>
                <CreditCard className="h-10 w-10 text-red-400" />
              </div>
            </Card>
          </Link>

          {/* Flujo Neto */}
          <Card padding="md" className={`bg-gradient-to-br ${dashboardCxPCxC.balanceNeto.flujoNetoPEN >= 0 ? 'from-blue-50 to-indigo-50 border-l-4 border-blue-500' : 'from-orange-50 to-amber-50 border-l-4 border-orange-500'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 flex items-center gap-1">
                  <ArrowRightLeft className="h-4 w-4" />
                  Flujo Neto
                </div>
                <div className={`text-2xl font-bold mt-1 ${dashboardCxPCxC.balanceNeto.flujoNetoPEN >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {dashboardCxPCxC.balanceNeto.flujoNetoPEN >= 0 ? '+' : ''}{formatCurrency(dashboardCxPCxC.balanceNeto.flujoNetoPEN)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {dashboardCxPCxC.balanceNeto.flujoNetoPEN >= 0 ? 'Saldo a favor' : 'Saldo en contra'}
                </div>
              </div>
              {dashboardCxPCxC.balanceNeto.flujoNetoPEN >= 0 ? (
                <TrendingUp className="h-10 w-10 text-blue-400" />
              ) : (
                <AlertTriangle className="h-10 w-10 text-orange-400" />
              )}
            </div>
          </Card>

          {/* Cartera Vencida */}
          <Link to="/tesoreria">
            <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-amber-50 to-yellow-50 border-l-4 border-amber-500">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 flex items-center gap-1">
                    <Clock className="h-4 w-4 text-amber-600" />
                    Cartera Vencida
                  </div>
                  <div className="text-2xl font-bold text-amber-600 mt-1">
                    {dashboardCxPCxC.cuentasPorCobrar.cantidadVencidos + dashboardCxPCxC.cuentasPorPagar.cantidadVencidos}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatCurrency(dashboardCxPCxC.cuentasPorCobrar.pendienteMas30dias + dashboardCxPCxC.cuentasPorPagar.pendienteMas30dias)} +30 días
                  </div>
                </div>
                <AlertTriangle className="h-10 w-10 text-amber-400" />
              </div>
            </Card>
          </Link>
        </div>
      )}

      {/* Sección de ROI: Top Productos y Oportunidades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Mejor ROI */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-emerald-500" />
              Top 5 Mejor ROI
            </h3>
            <Link to="/productos" className="text-sm text-primary-600 hover:text-primary-700">
              Ver todo →
            </Link>
          </div>

          {metricsROI.topMejorROI.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Target className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No hay productos con investigación de mercado</p>
              <Link to="/productos" className="text-xs text-primary-600 hover:underline mt-2 block">
                Realizar investigación →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {metricsROI.topMejorROI.map((producto, index) => (
                <div key={producto.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-400 text-yellow-900' :
                      index === 1 ? 'bg-gray-300 text-gray-700' :
                      index === 2 ? 'bg-amber-600 text-white' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">
                        {producto.marca} {producto.nombreComercial}
                      </div>
                      <div className="text-xs text-gray-600">
                        {producto.sku} • Ganancia: {formatCurrency(producto.gananciaCalculada)}/ud
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${producto.roiCalculado > 100 ? 'text-emerald-600' : producto.roiCalculado > 50 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {producto.roiCalculado.toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {producto.multiplicadorCalculado.toFixed(2)}x
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Oportunidades de Inversión */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
              Oportunidades de Inversión
            </h3>
            <Link to="/productos" className="text-sm text-primary-600 hover:text-primary-700">
              Ver todo →
            </Link>
          </div>

          {metricsROI.oportunidadesInversion.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No hay productos recomendados para importar</p>
              <p className="text-xs text-gray-400 mt-1">Investiga productos y marca "Importar"</p>
            </div>
          ) : (
            <div className="space-y-3">
              {metricsROI.oportunidadesInversion.slice(0, 5).map(producto => (
                <div key={producto.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-l-4 border-green-500">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">
                      {producto.marca} {producto.nombreComercial}
                    </div>
                    <div className="text-xs text-gray-600">
                      {producto.sku} • CTRU: {formatCurrency(producto.investigacion?.ctruEstimado || 0)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Demanda: <span className={`font-medium ${
                        producto.investigacion?.demandaEstimada === 'alta' ? 'text-green-600' :
                        producto.investigacion?.demandaEstimada === 'media' ? 'text-yellow-600' : 'text-red-600'
                      }`}>{producto.investigacion?.demandaEstimada}</span>
                      {producto.investigacion?.presenciaML && ` • ${producto.investigacion.numeroCompetidores || '?'} competidores ML`}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="success">
                      ROI {producto.roiCalculado.toFixed(0)}%
                    </Badge>
                    <div className="text-xs text-gray-500 mt-1">
                      +{formatCurrency(producto.gananciaCalculada)}/ud
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Sección de Antigüedad de Cartera y Alertas Financieras */}
      {dashboardCxPCxC && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Antigüedad de Cartera - Por Cobrar */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Banknote className="h-5 w-5 mr-2 text-green-500" />
                Antigüedad CxC
              </h3>
              <Link to="/tesoreria" className="text-sm text-primary-600 hover:text-primary-700">
                Ver detalle →
              </Link>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm text-gray-700">0-7 días</span>
                </div>
                <span className="font-semibold text-green-700">
                  {formatCurrency(dashboardCxPCxC.cuentasPorCobrar.pendiente0a7dias)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-gray-700">8-15 días</span>
                </div>
                <span className="font-semibold text-blue-700">
                  {formatCurrency(dashboardCxPCxC.cuentasPorCobrar.pendiente8a15dias)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-sm text-gray-700">16-30 días</span>
                </div>
                <span className="font-semibold text-yellow-700">
                  {formatCurrency(dashboardCxPCxC.cuentasPorCobrar.pendiente16a30dias)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm text-gray-700">+30 días (vencido)</span>
                </div>
                <span className="font-semibold text-red-700">
                  {formatCurrency(dashboardCxPCxC.cuentasPorCobrar.pendienteMas30dias)}
                </span>
              </div>
            </div>
          </Card>

          {/* Distribución CxP por Tipo */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <CreditCard className="h-5 w-5 mr-2 text-red-500" />
                Distribución CxP
              </h3>
              <Link to="/tesoreria" className="text-sm text-primary-600 hover:text-primary-700">
                Ver detalle →
              </Link>
            </div>
            <div className="space-y-3">
              {dashboardCxPCxC.cuentasPorPagar.porTipo.map((tipo) => (
                <div key={tipo.tipo} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {tipo.tipo === 'orden_compra_por_pagar' && <Truck className="h-4 w-4 text-blue-500" />}
                    {tipo.tipo === 'gasto_por_pagar' && <Receipt className="h-4 w-4 text-purple-500" />}
                    {tipo.tipo === 'viajero_por_pagar' && <Users className="h-4 w-4 text-orange-500" />}
                    <span className="text-sm text-gray-700">{tipo.etiqueta}</span>
                    <Badge variant="default" size="sm">{tipo.cantidad}</Badge>
                  </div>
                  <div className="text-right">
                    {tipo.montoPEN > 0 && (
                      <span className="font-semibold text-gray-700 block">
                        S/ {tipo.montoPEN.toLocaleString()}
                      </span>
                    )}
                    {tipo.montoUSD > 0 && (
                      <span className="text-xs text-gray-500">
                        $ {tipo.montoUSD.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {dashboardCxPCxC.cuentasPorPagar.porTipo.length === 0 && (
                <div className="text-center py-6 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-300" />
                  <p className="text-sm">No hay cuentas por pagar</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Alertas Financieras */}
      {dashboardCxPCxC && dashboardCxPCxC.alertas.length > 0 && (
        <Card padding="md" className="bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
              Alertas Financieras ({dashboardCxPCxC.alertas.length})
            </h3>
            <Link to="/tesoreria" className="text-sm text-primary-600 hover:text-primary-700">
              Ver todas →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {dashboardCxPCxC.alertas.slice(0, 6).map((alerta, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  alerta.prioridad === 'alta' ? 'bg-red-50 border-red-200' :
                  alerta.prioridad === 'media' ? 'bg-amber-50 border-amber-200' :
                  'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${
                    alerta.prioridad === 'alta' ? 'bg-red-500' :
                    alerta.prioridad === 'media' ? 'bg-amber-500' :
                    'bg-gray-400'
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{alerta.mensaje}</p>
                    <Badge
                      variant={
                        alerta.tipo === 'vencido' ? 'danger' :
                        alerta.tipo === 'monto_alto' ? 'warning' :
                        'info'
                      }
                      size="sm"
                    >
                      {alerta.tipo === 'vencido' ? 'Vencido' : 'Monto Alto'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Sección de Alertas y Resúmenes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas de Inventario */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Alertas de Inventario</h3>
            <Link to="/inventario" className="text-sm text-primary-600 hover:text-primary-700">
              Ver todo →
            </Link>
          </div>

          {stockCritico === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No hay productos con stock crítico</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(inventario || [])
                .filter(inv => {
                  const producto = productos?.find(p => p.id === inv.productoId);
                  return inv.stockCritico || (inv.disponibles > 0 && producto?.stockMinimo && inv.disponibles <= producto.stockMinimo);
                })
                .slice(0, 5)
                .map(item => {
                  const producto = productos?.find(p => p.id === item.productoId);
                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">
                          {producto?.marca} {producto?.nombreComercial}
                        </div>
                        <div className="text-xs text-gray-600">
                          SKU: {producto?.sku} • {item.almacenNombre}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="warning">
                          {item.disponibles} uds
                        </Badge>
                        <div className="text-xs text-gray-500 mt-1">
                          Min: {producto?.stockMinimo}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>

        {/* Últimas Ventas */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Últimas Ventas</h3>
            <Link to="/ventas" className="text-sm text-primary-600 hover:text-primary-700">
              Ver todo →
            </Link>
          </div>

          {!ventas || ventas.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No hay ventas registradas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(ventas || [])
                .filter(v => v.estado !== 'cancelada')
                .slice(0, 5)
                .map(venta => (
                  <div key={venta.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">
                        {venta.numeroVenta}
                      </div>
                      <div className="text-xs text-gray-600">
                        {venta.nombreCliente} • {venta.canal}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {formatCurrency(venta.totalPEN)}
                      </div>
                      <Badge
                        variant={
                          venta.estado === 'entregada' ? 'success' :
                          venta.estado === 'en_entrega' ? 'info' :
                          venta.estado === 'confirmada' ? 'warning' :
                          'default'
                        }
                      >
                        {venta.estado}
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

      {/* Top Productos y Ventas por Canal (widgets nuevos) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Productos Vendidos */}
        <TopProductosWidget
          productos={topProductosVendidos}
          maxItems={5}
          titulo="Top Productos Vendidos"
        />

        {/* Ventas por Canal - Gráfico Circular */}
        <VentasPorCanalWidget data={ventasPorCanalPie} />
      </div>

      {/* Gráficos de Tendencia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Ventas - Últimos 30 días */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-primary-500" />
              Ventas Últimos 30 Días
            </h3>
            <div className="text-sm text-gray-500 flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              Tendencia
            </div>
          </div>

          {ventasUltimos30Dias.some(d => d.ventas > 0) ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ventasUltimos30Dias}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="fecha"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={formatCurrencyShort}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Ventas']}
                    labelStyle={{ fontWeight: 'bold' }}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ventas"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, fill: '#3B82F6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No hay ventas en los últimos 30 días</p>
              </div>
            </div>
          )}

          {/* Resumen debajo del gráfico */}
          <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500">Total 30 días</div>
              <div className="font-semibold text-gray-900">
                {formatCurrency(ventasUltimos30Dias.reduce((sum, d) => sum + d.ventas, 0))}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Promedio/día</div>
              <div className="font-semibold text-gray-900">
                {formatCurrency(ventasUltimos30Dias.reduce((sum, d) => sum + d.ventas, 0) / 30)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Total Operaciones</div>
              <div className="font-semibold text-gray-900">
                {ventasUltimos30Dias.reduce((sum, d) => sum + d.cantidad, 0)}
              </div>
            </div>
          </div>
        </Card>

        {/* Distribución de Inventario */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Warehouse className="h-5 w-5 mr-2 text-blue-500" />
              Distribución de Inventario
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Pie Chart */}
            <div className="h-48">
              {distribucionInventario.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribucionInventario}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {distribucionInventario.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value} unidades`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Box className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-xs">Sin inventario</p>
                  </div>
                </div>
              )}
            </div>

            {/* Leyenda */}
            <div className="flex flex-col justify-center space-y-3">
              {distribucionInventario.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-600">{item.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{item.value}</span>
                </div>
              ))}
              {distribucionInventario.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Total</span>
                    <span className="font-bold text-gray-900">
                      {distribucionInventario.reduce((sum, item) => sum + item.value, 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Valor del inventario */}
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-xs text-gray-500">Valor Perú</div>
                <div className="font-semibold text-green-600">
                  {formatCurrency((resumenInventario?.peru?.valorTotalUSD || 0) * (tipoCambioDelDia?.compra || 3.8))}
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-xs text-gray-500">Valor USA</div>
                <div className="font-semibold text-blue-600">
                  $ {(resumenInventario?.usa?.valorTotalUSD || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Widget de Vencimientos y Actividad Reciente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Widget de Control de Vencimientos */}
        <VencimientosWidget maxItems={6} />

        {/* Widget de Actividad Reciente */}
        <ActividadRecienteWidget actividades={actividadReciente} maxItems={10} />
      </div>

      {/* Widget de Usuarios - Solo visible para admin */}
      {isAdmin && (
        <div className="grid grid-cols-1 gap-6">
          <UsuariosActivosWidget showDetailed={true} />
        </div>
      )}

      {/* Quick Actions */}
      <Card padding="md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            to="/productos"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-center"
          >
            <Package className="h-6 w-6 mx-auto mb-2 text-gray-600" />
            <div className="text-sm font-medium text-gray-900">Nuevo Producto</div>
          </Link>

          <Link
            to="/compras"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-center"
          >
            <Box className="h-6 w-6 mx-auto mb-2 text-gray-600" />
            <div className="text-sm font-medium text-gray-900">Nueva Orden</div>
          </Link>

          <Link
            to="/ventas"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-center"
          >
            <ShoppingCart className="h-6 w-6 mx-auto mb-2 text-gray-600" />
            <div className="text-sm font-medium text-gray-900">Nueva Venta</div>
          </Link>

          <Link
            to="/gastos"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-center"
          >
            <Receipt className="h-6 w-6 mx-auto mb-2 text-gray-600" />
            <div className="text-sm font-medium text-gray-900">Nuevo Gasto</div>
          </Link>
        </div>
      </Card>
    </div>
  );
};
