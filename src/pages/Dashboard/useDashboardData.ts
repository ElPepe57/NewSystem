import { useEffect, useState, useMemo } from 'react';
import { useProductoStore } from '../../store/productoStore';
import { useInventarioStore } from '../../store/inventarioStore';
import { useVentaStore } from '../../store/ventaStore';
import { useOrdenCompraStore } from '../../store/ordenCompraStore';
import { useGastoStore } from '../../store/gastoStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { useAuthStore } from '../../store/authStore';
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import { cuentasPendientesService } from '../../services/cuentasPendientes.service';
import { filtrarVentasMes, calcularKPIVentas } from '../../utils/kpi.calculators';
import { timed } from '../../lib/perf';
import type { DashboardCuentasPendientes } from '../../types/tesoreria.types';
import type { ActividadItem, TipoActividad } from '../../components/modules/dashboard';

// Staleness threshold: skip re-fetch if data was loaded less than 5 minutes ago
const STALE_TIME_MS = 5 * 60 * 1000;
let dashboardLastFetchedAt = 0;

export interface DashboardData {
  // Estado base
  loading: boolean;
  tipoCambioDelDia: any;
  dashboardCxPCxC: DashboardCuentasPendientes | null;

  // Auth
  isAdmin: boolean;

  // Línea de negocio
  lineaFiltroGlobal: string | null;
  setLineaFiltroGlobal: (linea: string | null) => void;

  // Datos filtrados por línea
  productosLN: any[];
  ventasLN: any[];
  ordenesLN: any[];

  // Datos crudos (para fallback en alertas de inventario)
  productos: any[];
  ventas: any[];
  inventario: any[];
  resumenInventario: any;
  gastosStats: any;
  ordenesStats: any;

  // Métricas derivadas
  productosActivos: number;
  stockCritico: number;
  valorInventarioPEN: number;
  totalVentasMes: number;
  utilidadMes: number;
  margenPromedioMes: number;
  ventasMesActual: any[];
  anticiposPendientes: { cantidad: number; monto: number };
  ordenesEnProceso: any[];

  // ROI
  metricsROI: {
    productosConInvestigacion: number;
    roiPromedio: number;
    multiplicadorPromedio: number;
    topMejorROI: any[];
    oportunidadesInversion: any[];
    productosSinInvestigar: number;
  };

  // Datos para gráficos
  ventasUltimos30Dias: { fecha: string; fechaCompleta: Date; ventas: number; cantidad: number }[];
  distribucionInventario: { name: string; value: number; color: string }[];
  ventasPorCanalData: { canal: string; ventas: number; color: string }[];
  ventasPorCanalPie: {
    mercadoLibre: { cantidad: number; totalPEN: number; porcentaje: number };
    directo: { cantidad: number; totalPEN: number; porcentaje: number };
    otro: { cantidad: number; totalPEN: number; porcentaje: number };
  };
  topProductosVendidos: {
    productoId: string;
    sku: string;
    marca: string;
    nombreComercial: string;
    unidadesVendidas: number;
    ventasTotalPEN: number;
    utilidadPEN: number;
    margenPromedio: number;
  }[];
  actividadReciente: ActividadItem[];
}

export function useDashboardData(): DashboardData {
  const [loading, setLoading] = useState(true);
  const [tipoCambioDelDia, setTipoCambioDelDia] = useState<any>(null);
  const [dashboardCxPCxC, setDashboardCxPCxC] = useState<DashboardCuentasPendientes | null>(null);

  // Store subscriptions
  const productos = useProductoStore(state => state.productos);
  const fetchProductos = useProductoStore(state => state.fetchProductos);
  const resumenInventario = useInventarioStore(state => state.resumen);
  const inventario = useInventarioStore(state => state.inventario);
  const fetchResumen = useInventarioStore(state => state.fetchResumen);
  const fetchInventario = useInventarioStore(state => state.fetchInventario);
  const ventas = useVentaStore(state => state.ventas);
  const ventasStats = useVentaStore(state => state.stats);
  const fetchVentas = useVentaStore(state => state.fetchVentas);
  const fetchVentasStats = useVentaStore(state => state.fetchStats);
  const ordenes = useOrdenCompraStore(state => state.ordenes);
  const ordenesStats = useOrdenCompraStore(state => state.stats);
  const fetchOrdenes = useOrdenCompraStore(state => state.fetchOrdenes);
  const fetchOrdenesStats = useOrdenCompraStore(state => state.fetchStats);
  const gastosStats = useGastoStore(state => state.stats);
  const fetchGastosStats = useGastoStore(state => state.fetchStats);
  const getTCDelDia = useTipoCambioStore(state => state.getTCDelDia);
  const userProfile = useAuthStore(state => state.userProfile);
  const lineaFiltroGlobal = useLineaNegocioStore(state => state.lineaFiltroGlobal);
  const setLineaFiltroGlobal = useLineaNegocioStore(state => state.setLineaFiltroGlobal);

  const isAdmin = userProfile?.role === 'admin';

  // Cargar datos al montar (con staleness check)
  useEffect(() => {
    const now = Date.now();
    const isStale = now - dashboardLastFetchedAt > STALE_TIME_MS;
    const hasData = productos.length > 0 || ventas.length > 0;

    if (!isStale && hasData) {
      setLoading(false);
      return;
    }

    const loadDashboardData = async () => {
      try {
        await timed('Dashboard.loadDashboardData', async () => {
          setLoading(true);

          const tc = await getTCDelDia();
          setTipoCambioDelDia(tc);

          // Fase 1: agregados ligeros
          await Promise.all([
            fetchResumen(),
            fetchVentasStats(),
            fetchOrdenesStats()
          ]);

          setLoading(false);
        });

        // Fase 2 diferida: colecciones completas
        setTimeout(async () => {
          try {
            await Promise.all([
              fetchProductos(),
              fetchInventario({ soloConStock: true }),
              fetchVentas(),
              fetchOrdenes()
            ]);

            try {
              await fetchGastosStats();
            } catch (error) {
              console.warn('No se pudieron cargar estadísticas de gastos:', error);
            }

            try {
              const cxpCxc = await cuentasPendientesService.getDashboard();
              setDashboardCxPCxC(cxpCxc);
            } catch (error) {
              console.warn('No se pudieron cargar cuentas pendientes:', error);
            }

            dashboardLastFetchedAt = Date.now();
          } catch (error) {
            console.error('Error cargando datos secundarios del dashboard:', error);
          }
        }, 100);
      } catch (error) {
        console.error('Error cargando datos del dashboard:', error);
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Filtrar por línea de negocio
  const productosLN = useLineaFilter(productos || [], p => p.lineaNegocioId);
  const ventasLN = useLineaFilter(ventas || [], v => v.lineaNegocioId);
  const ordenesLN = useLineaFilter(ordenes || [], o => o.lineaNegocioId);

  const inventarioLN = useMemo(() => {
    const productoIdsLN = new Set(productosLN.map(p => p.id));
    return (inventario || []).filter(inv => productoIdsLN.has(inv.productoId));
  }, [inventario, productosLN]);

  // Métricas derivadas
  const productosActivos = productosLN.filter(p => p.estado === 'activo').length || 0;

  const stockCritico = inventarioLN.filter(inv => {
    const producto = productosLN.find(p => p.id === inv.productoId);
    return inv.stockCritico || (inv.disponibles > 0 && producto?.stockMinimo && inv.disponibles <= producto.stockMinimo);
  }).length || 0;

  const tcParaInventario = tipoCambioDelDia?.venta || tipoCambioDelDia?.compra || 0;
  const valorInventarioPEN = resumenInventario?.total?.valorUSD && tcParaInventario > 0
    ? resumenInventario.total.valorUSD * tcParaInventario
    : 0;

  const ahora = new Date();
  const ventasMesActual = filtrarVentasMes(ventasLN, ahora);
  const kpiMes = calcularKPIVentas(ventasMesActual);
  const totalVentasMes = kpiMes.totalPEN;
  const utilidadMes = kpiMes.utilidadPEN;
  const margenPromedioMes = kpiMes.margenPonderado;

  const anticiposPendientes = useMemo(() => {
    const ventasConAnticipo = ventasLN.filter(v =>
      v.estado === 'reservada' && v.montoPagado > 0
    );
    const totalAnticipado = ventasConAnticipo.reduce((sum, v) => sum + v.montoPagado, 0);
    return { cantidad: ventasConAnticipo.length, monto: totalAnticipado };
  }, [ventasLN]);

  const ordenesEnProceso = ordenesLN.filter(o =>
    ['enviada', 'pagada', 'en_transito'].includes(o.estado)
  );

  // Métricas ROI
  const metricsROI = useMemo(() => {
    const productosConInvestigacion = productosLN.filter(p =>
      p.investigacion &&
      p.investigacion.ctruEstimado > 0 &&
      p.investigacion.precioPERUPromedio > 0
    );

    const productosConROI = productosConInvestigacion.map(p => {
      const inv = p.investigacion!;
      const ganancia = inv.precioPERUPromedio - inv.ctruEstimado;
      const roi = (ganancia / inv.ctruEstimado) * 100;
      const multiplicador = inv.precioPERUPromedio / inv.ctruEstimado;
      return { ...p, roiCalculado: roi, gananciaCalculada: ganancia, multiplicadorCalculado: multiplicador };
    });

    const roiPromedio = productosConROI.length > 0
      ? productosConROI.reduce((sum, p) => sum + p.roiCalculado, 0) / productosConROI.length
      : 0;

    const multiplicadorPromedio = productosConROI.length > 0
      ? productosConROI.reduce((sum, p) => sum + p.multiplicadorCalculado, 0) / productosConROI.length
      : 0;

    const topMejorROI = [...productosConROI]
      .sort((a, b) => b.roiCalculado - a.roiCalculado)
      .slice(0, 5);

    const oportunidadesInversion = productosLN.filter(p => {
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

    const productosSinInvestigar = productosLN.filter(p =>
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
  }, [productosLN]);

  // Ventas últimos 30 días
  const ventasUltimos30Dias = useMemo(() => {
    const hoy = new Date();
    const hace30Dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);

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

    ventasLN.forEach(v => {
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
  }, [ventasLN]);

  // Distribución inventario por país
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

  // Ventas por canal (barras)
  const ventasPorCanalData = useMemo(() => {
    return [
      { canal: 'M. Libre', ventas: ventasStats?.ventasML || 0, color: '#FBBF24' },
      { canal: 'Directo', ventas: ventasStats?.ventasDirecto || 0, color: '#3B82F6' },
      { canal: 'Otros', ventas: ventasStats?.ventasOtro || 0, color: '#8B5CF6' }
    ];
  }, [ventasStats]);

  // Top productos vendidos
  const topProductosVendidos = useMemo(() => {
    const ventasEntregadas = ventasLN.filter(v => v.estado === 'entregada');
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

    return Array.from(productosMap.values())
      .map(p => ({
        ...p,
        margenPromedio: p.ventasTotalPEN > 0 ? (p.utilidadPEN / p.ventasTotalPEN) * 100 : 0
      }))
      .sort((a, b) => b.ventasTotalPEN - a.ventasTotalPEN)
      .slice(0, 10);
  }, [ventasLN]);

  // Ventas por canal (circular)
  const ventasPorCanalPie = useMemo(() => {
    const ventasEntregadas = ventasLN.filter(v => v.estado === 'entregada');
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
  }, [ventasLN]);

  // Actividad reciente
  const actividadReciente = useMemo((): ActividadItem[] => {
    const actividades: ActividadItem[] = [];

    ventasLN.slice(0, 10).forEach(v => {
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

    ordenesLN.slice(0, 5).forEach(o => {
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

    return actividades.sort((a, b) => b.fecha.getTime() - a.fecha.getTime()).slice(0, 15);
  }, [ventasLN, ordenesLN]);

  return {
    loading,
    tipoCambioDelDia,
    dashboardCxPCxC,
    isAdmin,
    lineaFiltroGlobal,
    setLineaFiltroGlobal,
    productosLN,
    ventasLN,
    ordenesLN,
    productos,
    ventas,
    inventario,
    resumenInventario,
    gastosStats,
    ordenesStats,
    productosActivos,
    stockCritico,
    valorInventarioPEN,
    totalVentasMes,
    utilidadMes,
    margenPromedioMes,
    ventasMesActual,
    anticiposPendientes,
    ordenesEnProceso,
    metricsROI,
    ventasUltimos30Dias,
    distribucionInventario,
    ventasPorCanalData,
    ventasPorCanalPie,
    topProductosVendidos,
    actividadReciente
  };
}
