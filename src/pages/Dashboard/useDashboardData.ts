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
import { formatCurrencyCompact } from '../../utils/format';
import type { DashboardCuentasPendientes } from '../../types/tesoreria.types';

const NOMBRES_MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre'
];

// Staleness threshold: skip re-fetch if data was loaded less than 5 minutes ago
const STALE_TIME_MS = 5 * 60 * 1000;
let dashboardLastFetchedAt = 0;

export interface StockCriticoItem {
  productoId: string;
  sku: string;
  nombre: string;
  disponibles: number;
  stockMinimo: number;
  almacenNombre?: string;
}

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
  inventarioLN: any[];

  // Datos crudos
  productos: any[];
  ventas: any[];
  inventario: any[];
  resumenInventario: any;

  // Métricas derivadas
  productosActivos: number;
  stockCritico: number;
  stockCriticoItems: StockCriticoItem[];

  // KPIs del mes actual
  totalVentasMes: number;
  utilidadMes: number;
  margenPromedioMes: number;
  cantidadVentasMes: number;

  // KPIs del mes anterior (comparativo)
  totalVentasMesAnterior: number;
  utilidadMesAnterior: number;
  margenMesAnterior: number;
  crecimientoVentas: number;       // % vs mes anterior (puede ser null si no hay datos)
  crecimientoUtilidad: number;     // % vs mes anterior
  cambioMargen: number;            // puntos porcentuales vs mes anterior

  // Meta mensual y progreso
  metaMensual: number;
  progresoMeta: number;            // 0-100
  promedioDiarioNecesario: number;
  diasRestantesMes: number;

  // Texto natural del resumen gerencial
  resumenTexto: string;

  // Datos para gráficos
  ventasUltimos30Dias: { fecha: string; fechaCompleta: Date; ventas: number; cantidad: number }[];
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
  const fetchVentas = useVentaStore(state => state.fetchVentas);
  const fetchVentasStats = useVentaStore(state => state.fetchStats);
  const fetchOrdenes = useOrdenCompraStore(state => state.fetchOrdenes);
  const fetchOrdenesStats = useOrdenCompraStore(state => state.fetchStats);
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

  // Lista detallada de stock crítico para AlertsSection
  const stockCriticoItems = useMemo((): StockCriticoItem[] => {
    return inventarioLN
      .filter(inv => {
        const producto = productosLN.find(p => p.id === inv.productoId);
        return inv.stockCritico || (inv.disponibles > 0 && producto?.stockMinimo && inv.disponibles <= producto.stockMinimo);
      })
      .map(inv => {
        const producto = productosLN.find(p => p.id === inv.productoId);
        return {
          productoId: inv.productoId,
          sku: producto?.sku ?? inv.productoId,
          nombre: [producto?.marca, producto?.nombreComercial].filter(Boolean).join(' ') || inv.productoId,
          disponibles: inv.disponibles ?? 0,
          stockMinimo: producto?.stockMinimo ?? 0,
          almacenNombre: inv.almacenNombre
        };
      })
      .sort((a, b) => a.disponibles - b.disponibles);
  }, [inventarioLN, productosLN]);

  // KPIs del mes actual
  const ahora = new Date();
  const ventasMesActual = filtrarVentasMes(ventasLN, ahora);
  const kpiMes = calcularKPIVentas(ventasMesActual);
  const totalVentasMes = kpiMes.totalPEN;
  const utilidadMes = kpiMes.utilidadPEN;
  const margenPromedioMes = kpiMes.margenPonderado;
  const cantidadVentasMes = ventasMesActual.length;

  // KPIs del mes anterior
  const fechaMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
  const ventasMesAnterior = filtrarVentasMes(ventasLN, fechaMesAnterior);
  const kpiMesAnterior = calcularKPIVentas(ventasMesAnterior);
  const totalVentasMesAnterior = kpiMesAnterior.totalPEN;
  const utilidadMesAnterior = kpiMesAnterior.utilidadPEN;
  const margenMesAnterior = kpiMesAnterior.margenPonderado;

  const crecimientoVentas = totalVentasMesAnterior > 0
    ? ((totalVentasMes - totalVentasMesAnterior) / totalVentasMesAnterior) * 100
    : 0;
  const crecimientoUtilidad = utilidadMesAnterior > 0
    ? ((utilidadMes - utilidadMesAnterior) / utilidadMesAnterior) * 100
    : 0;
  const cambioMargen = margenPromedioMes - margenMesAnterior;

  // Meta mensual y progreso
  const metaMensual = 67000;
  const progresoMeta = metaMensual > 0 ? Math.min((totalVentasMes / metaMensual) * 100, 100) : 0;
  const diasEnMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
  const diasRestantesMes = diasEnMes - ahora.getDate();
  const faltaMeta = Math.max(metaMensual - totalVentasMes, 0);
  const promedioDiarioNecesario = diasRestantesMes > 0 ? faltaMeta / diasRestantesMes : 0;

  // Texto natural del resumen gerencial
  const mesActualNombre = NOMBRES_MESES[ahora.getMonth()];
  const mesPasadoNombre = NOMBRES_MESES[fechaMesAnterior.getMonth()];
  const fmtCompact = (v: number) => formatCurrencyCompact(v, 'PEN');
  const cxc = dashboardCxPCxC?.cuentasPorCobrar.totalEquivalentePEN ?? 0;
  const cxp = dashboardCxPCxC?.cuentasPorPagar.totalEquivalentePEN ?? 0;
  const flujoNeto = cxc - cxp;

  let resumenTexto = `En ${mesActualNombre} llevas ${fmtCompact(totalVentasMes)} en ventas`;
  if (totalVentasMesAnterior > 0) {
    if (crecimientoVentas > 0.5) {
      resumenTexto += ` — ${crecimientoVentas.toFixed(1)}% mas que ${mesPasadoNombre}.`;
    } else if (crecimientoVentas < -0.5) {
      resumenTexto += ` — ${Math.abs(crecimientoVentas).toFixed(1)}% menos que ${mesPasadoNombre}.`;
    } else {
      resumenTexto += `, similar a ${mesPasadoNombre}.`;
    }
  } else {
    resumenTexto += `.`;
  }
  if (margenPromedioMes > 0) {
    resumenTexto += ` Tu margen promedio es ${margenPromedioMes.toFixed(1)}%`;
    if (dashboardCxPCxC) {
      if (flujoNeto >= 0) {
        resumenTexto += ` y el flujo neto esta a favor por ${fmtCompact(flujoNeto)}.`;
      } else {
        resumenTexto += ` pero el flujo neto esta en contra por ${fmtCompact(Math.abs(flujoNeto))}.`;
      }
    } else {
      resumenTexto += `.`;
    }
  }

  // Ventas últimos 30 días para gráfico
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

  return {
    loading,
    tipoCambioDelDia,
    dashboardCxPCxC,
    isAdmin,
    lineaFiltroGlobal,
    setLineaFiltroGlobal,
    productosLN,
    ventasLN,
    inventarioLN,
    productos,
    ventas,
    inventario,
    resumenInventario,
    productosActivos,
    stockCritico,
    stockCriticoItems,
    totalVentasMes,
    utilidadMes,
    margenPromedioMes,
    cantidadVentasMes,
    totalVentasMesAnterior,
    utilidadMesAnterior,
    margenMesAnterior,
    crecimientoVentas,
    crecimientoUtilidad,
    cambioMargen,
    metaMensual,
    progresoMeta,
    promedioDiarioNecesario,
    diasRestantesMes,
    resumenTexto,
    ventasUltimos30Dias,
    topProductosVendidos
  };
}
