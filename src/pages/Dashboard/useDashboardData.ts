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
import { gastoService } from '../../services/gasto.service';
import { tesoreriaService } from '../../services/tesoreria.service';
import { filtrarVentasMes, calcularKPIVentas } from '../../utils/kpi.calculators';
import { timed } from '../../lib/perf';
import { formatCurrencyCompact } from '../../utils/format';
import type { DashboardCuentasPendientes } from '../../types/tesoreria.types';
import type { HealthIndicator } from '../../components/common/dashboard/HealthSemaphore';
import type { Insight } from '../../components/common/dashboard/InsightCard';

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
  crecimientoVentas: number;
  crecimientoUtilidad: number;
  cambioMargen: number;

  // Gastos del mes
  gastosMes: number;
  gastosMesAnterior: number;
  crecimientoGastos: number;
  ratioGastosVentas: number;

  // Meta mensual y progreso
  metaMensual: number;
  progresoMeta: number;
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

  // --- NUEVOS: Sparklines (últimos 7 días) ---
  sparklineVentas: { value: number }[];
  sparklineUtilidad: { value: number }[];
  sparklineGastos: { value: number }[];
  sparklineMargen: { value: number }[];

  // --- NUEVOS: Cash & Liquidez ---
  saldoCajaTotal: number;
  gastoMensualPromedio: number;
  cashRunwayMeses: number;
  valorInventarioPEN: number;
  workingCapital: number;

  // --- NUEVOS: Tendencia dual por línea ---
  ventasDualLinea: { fecha: string; ventasSUP: number; ventasSKC: number }[];

  // --- NUEVOS: Rentabilidad por línea ---
  rentabilidadSUP: { ventas: number; utilidad: number; margen: number; cantidad: number };
  rentabilidadSKC: { ventas: number; utilidad: number; margen: number; cantidad: number };

  // --- NUEVOS: Proyección fin de mes ---
  proyeccionVentasFinMes: number;
  proyeccionVsMeta: number;

  // --- NUEVOS: Semáforo y insights ---
  healthIndicators: HealthIndicator[];
  insights: Insight[];
}

// ─── Generador de health indicators ────────────────────────────────────────────
function generarHealthIndicators(params: {
  margenPromedioMes: number;
  progresoMeta: number;
  crecimientoGastos: number;
  stockCritico: number;
  cashRunwayMeses: number;
  cxcVencidos: number;
}): HealthIndicator[] {
  const { margenPromedioMes, progresoMeta, crecimientoGastos, stockCritico, cashRunwayMeses, cxcVencidos } = params;

  return [
    {
      label: 'Ventas',
      status: progresoMeta >= 70 ? 'ok' : progresoMeta >= 40 ? 'warn' : 'critical',
      detail: `Progreso de meta: ${progresoMeta.toFixed(0)}%`,
    },
    {
      label: 'Margen',
      status: margenPromedioMes >= 25 ? 'ok' : margenPromedioMes >= 15 ? 'warn' : 'critical',
      detail: `Margen actual: ${margenPromedioMes.toFixed(1)}%`,
    },
    {
      label: 'Gastos',
      status: crecimientoGastos <= 10 ? 'ok' : crecimientoGastos <= 20 ? 'warn' : 'critical',
      detail: `Crecimiento gastos: ${crecimientoGastos.toFixed(0)}% vs mes anterior`,
    },
    {
      label: 'Stock',
      status: stockCritico === 0 ? 'ok' : stockCritico <= 3 ? 'warn' : 'critical',
      detail: `${stockCritico} producto(s) bajo stock mínimo`,
    },
    {
      label: 'Caja',
      status: cashRunwayMeses >= 3 ? 'ok' : cashRunwayMeses >= 1 ? 'warn' : 'critical',
      detail: `Cash runway: ${cashRunwayMeses.toFixed(1)} meses`,
    },
    {
      label: 'CxC',
      status: cxcVencidos === 0 ? 'ok' : cxcVencidos <= 2 ? 'warn' : 'critical',
      detail: `${cxcVencidos} cobro(s) vencido(s) +30 días`,
    },
  ];
}

// ─── Generador de insights proactivos ──────────────────────────────────────────
function generarInsights(params: {
  proyeccionVentasFinMes: number;
  metaMensual: number;
  diasRestantesMes: number;
  cashRunwayMeses: number;
  crecimientoGastos: number;
  gastosMes: number;
  gastosMesAnterior: number;
  cambioMargen: number;
  margenPromedioMes: number;
  margenMesAnterior: number;
  stockCritico: number;
  cxcVencidoMonto: number;
  cxcVencidosCount: number;
  ventasSKCMesActual: number;
  ventasSKCMesAnterior: number;
  tipoCambioDelDia: any;
}): Insight[] {
  const {
    proyeccionVentasFinMes, metaMensual, diasRestantesMes,
    cashRunwayMeses, crecimientoGastos, gastosMes, gastosMesAnterior,
    cambioMargen, margenPromedioMes, margenMesAnterior,
    stockCritico, cxcVencidoMonto, cxcVencidosCount,
    ventasSKCMesActual, ventasSKCMesAnterior, tipoCambioDelDia,
  } = params;

  const fmt = (v: number) => formatCurrencyCompact(v, 'PEN');
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2, success: 3 };
  const insights: Insight[] = [];

  // 1. Proyección vs meta
  if (metaMensual > 0 && diasRestantesMes > 5 && proyeccionVentasFinMes < metaMensual * 0.9) {
    insights.push({
      id: 'meta-riesgo',
      severity: 'warning',
      icon: 'trending-down',
      titulo: 'Meta en riesgo',
      descripcion: `A ritmo actual cerraras con ${fmt(proyeccionVentasFinMes)} (${(proyeccionVentasFinMes / metaMensual * 100).toFixed(0)}% de meta).`,
      impacto: `Faltan ${fmt(metaMensual - proyeccionVentasFinMes)}`,
      accion: { label: 'Ver ventas', link: '/ventas' },
    });
  }

  // 2. Cash runway critico
  if (cashRunwayMeses < 2 && cashRunwayMeses > 0) {
    insights.push({
      id: 'cash-runway',
      severity: 'critical',
      icon: 'alert-triangle',
      titulo: 'Cash runway bajo',
      descripcion: `Tienes ${cashRunwayMeses.toFixed(1)} meses de caja al ritmo de gastos actual.`,
      accion: { label: 'Ver tesoreria', link: '/tesoreria' },
    });
  }

  // 3. Gastos crecieron significativamente
  if (crecimientoGastos > 15 && gastosMesAnterior > 0) {
    insights.push({
      id: 'gastos-alto',
      severity: 'warning',
      icon: 'trending-up',
      titulo: `Gastos subieron ${crecimientoGastos.toFixed(0)}%`,
      descripcion: `${fmt(gastosMes)} vs ${fmt(gastosMesAnterior)} del mes anterior.`,
      impacto: `+${fmt(gastosMes - gastosMesAnterior)}`,
      accion: { label: 'Ver gastos', link: '/gastos' },
    });
  }

  // 4. Margen bajo
  if (cambioMargen < -2) {
    insights.push({
      id: 'margen-bajo',
      severity: 'warning',
      icon: 'trending-down',
      titulo: `Margen bajo ${Math.abs(cambioMargen).toFixed(1)}pp`,
      descripcion: `De ${margenMesAnterior.toFixed(1)}% bajo a ${margenPromedioMes.toFixed(1)}% este mes.`,
    });
  }

  // 5. Stock critico
  if (stockCritico > 0) {
    insights.push({
      id: 'stock-critico',
      severity: stockCritico > 5 ? 'critical' : 'warning',
      icon: 'alert-triangle',
      titulo: `${stockCritico} ${stockCritico === 1 ? 'producto' : 'productos'} en stock critico`,
      descripcion: 'Riesgo de quiebre de stock en los proximos dias.',
      accion: { label: 'Ver inventario', link: '/inventario' },
    });
  }

  // 6. CxC vencida grande
  if (cxcVencidoMonto > 5000) {
    insights.push({
      id: 'cxc-vencida',
      severity: 'warning',
      icon: 'zap',
      titulo: `${fmt(cxcVencidoMonto)} en cobros vencidos`,
      descripcion: `${cxcVencidosCount} ${cxcVencidosCount === 1 ? 'documento' : 'documentos'} con mas de 30 dias sin cobrar.`,
      accion: { label: 'Gestionar cobranza', link: '/tesoreria' },
    });
  }

  // 7. Linea SKC creciendo o cayendo fuerte
  if (ventasSKCMesAnterior > 0) {
    const crecimientoSKC = ((ventasSKCMesActual - ventasSKCMesAnterior) / ventasSKCMesAnterior) * 100;
    if (Math.abs(crecimientoSKC) > 25) {
      insights.push({
        id: 'skc-tendencia',
        severity: crecimientoSKC > 0 ? 'success' : 'warning',
        icon: crecimientoSKC > 0 ? 'trending-up' : 'trending-down',
        titulo: `Linea SKC ${crecimientoSKC > 0 ? 'crecio' : 'bajo'} ${Math.abs(crecimientoSKC).toFixed(0)}%`,
        descripcion: `${fmt(ventasSKCMesActual)} vs ${fmt(ventasSKCMesAnterior)} del mes anterior.`,
      });
    }
  } else if (ventasSKCMesActual > 0 && ventasSKCMesAnterior === 0) {
    insights.push({
      id: 'skc-inicio',
      severity: 'success',
      icon: 'zap',
      titulo: 'Primeras ventas SKC del mes',
      descripcion: `Linea Skincare acumula ${fmt(ventasSKCMesActual)} en el periodo actual.`,
    });
  }

  // 8. Meta alcanzada
  if (proyeccionVentasFinMes >= metaMensual && metaMensual > 0) {
    insights.push({
      id: 'meta-ok',
      severity: 'success',
      icon: 'check',
      titulo: 'Proyeccion supera la meta',
      descripcion: `Al ritmo actual cerraras con ${fmt(proyeccionVentasFinMes)} — ${((proyeccionVentasFinMes / metaMensual) * 100).toFixed(0)}% de meta.`,
    });
  }

  return insights
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 5);
}

export function useDashboardData(): DashboardData {
  const [loading, setLoading] = useState(true);
  const [tipoCambioDelDia, setTipoCambioDelDia] = useState<any>(null);
  const [dashboardCxPCxC, setDashboardCxPCxC] = useState<DashboardCuentasPendientes | null>(null);
  const [gastosMes, setGastosMes] = useState(0);
  const [gastosMesAnterior, setGastosMesAnterior] = useState(0);
  const [gastosMes2Atras, setGastosMes2Atras] = useState(0);
  const [saldoCajaTotal, setSaldoCajaTotal] = useState(0);

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

            // Cargar resumen de gastos del mes actual y 2 meses anteriores
            try {
              const ahoraG = new Date();
              const mesActual = ahoraG.getMonth() + 1;
              const anioActual = ahoraG.getFullYear();
              const mesAnt = mesActual === 1 ? 12 : mesActual - 1;
              const anioAnt = mesActual === 1 ? anioActual - 1 : anioActual;
              const mes2Atras = mesAnt === 1 ? 12 : mesAnt - 1;
              const anio2Atras = mesAnt === 1 ? anioAnt - 1 : anioAnt;

              const [resumenActual, resumenAnterior, resumen2Atras] = await Promise.all([
                gastoService.getResumenMes(mesActual, anioActual).catch(() => null),
                gastoService.getResumenMes(mesAnt, anioAnt).catch(() => null),
                gastoService.getResumenMes(mes2Atras, anio2Atras).catch(() => null),
              ]);
              setGastosMes(resumenActual?.totalPEN ?? 0);
              setGastosMesAnterior(resumenAnterior?.totalPEN ?? 0);
              setGastosMes2Atras(resumen2Atras?.totalPEN ?? 0);
            } catch (error) {
              console.warn('No se pudieron cargar gastos del mes:', error);
            }

            // Saldo de caja desde tesorería
            try {
              const estadisticas = await tesoreriaService.getEstadisticasAgregadas();
              setSaldoCajaTotal(estadisticas?.saldoTotalEquivalentePEN ?? 0);
            } catch (error) {
              console.warn('No se pudo obtener saldo de caja:', error);
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

  // Gastos
  const crecimientoGastos = gastosMesAnterior > 0
    ? ((gastosMes - gastosMesAnterior) / gastosMesAnterior) * 100
    : 0;
  const ratioGastosVentas = totalVentasMes > 0
    ? (gastosMes / totalVentasMes) * 100
    : 0;

  // Meta mensual y progreso
  const metaMensual = 67000;
  const progresoMeta = metaMensual > 0 ? Math.min((totalVentasMes / metaMensual) * 100, 100) : 0;
  const diasEnMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
  const diasRestantesMes = diasEnMes - ahora.getDate();
  const faltaMeta = Math.max(metaMensual - totalVentasMes, 0);
  const promedioDiarioNecesario = diasRestantesMes > 0 ? faltaMeta / diasRestantesMes : 0;

  // Proyección fin de mes (lineal)
  const diaActual = ahora.getDate();
  const proyeccionVentasFinMes = diaActual > 0 ? (totalVentasMes / diaActual) * diasEnMes : 0;
  const proyeccionVsMeta = metaMensual > 0 ? (proyeccionVentasFinMes / metaMensual) * 100 : 0;

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
    resumenTexto += ` Tu margen es ${margenPromedioMes.toFixed(1)}%`;
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
  if (gastosMes > 0) {
    if (crecimientoGastos > 10) {
      resumenTexto += ` Los gastos subieron ${crecimientoGastos.toFixed(0)}% vs ${mesPasadoNombre} (${fmtCompact(gastosMes)}).`;
    } else if (crecimientoGastos < -10) {
      resumenTexto += ` Los gastos bajaron ${Math.abs(crecimientoGastos).toFixed(0)}% vs ${mesPasadoNombre} (${fmtCompact(gastosMes)}).`;
    } else if (ratioGastosVentas > 0) {
      resumenTexto += ` Gastos del mes: ${fmtCompact(gastosMes)} (${ratioGastosVentas.toFixed(0)}% de ventas).`;
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

  // --- SPARKLINES: últimos 7 días ---
  const sparklineVentas = useMemo(() => {
    return ventasUltimos30Dias.slice(-7).map(d => ({ value: d.ventas }));
  }, [ventasUltimos30Dias]);

  const sparklineUtilidad = useMemo(() => {
    // Calcular utilidad por día usando ventas del día filtradas
    const hoy = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const fecha = new Date(hoy.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
      const ventasDia = ventasLN.filter(v => {
        if (!v.fechaCreacion?.toDate || v.estado === 'cancelada') return false;
        const f = v.fechaCreacion.toDate();
        return f.toDateString() === fecha.toDateString();
      });
      const utilidad = ventasDia.reduce((s, v) => s + (v.utilidadBrutaPEN || 0), 0);
      return { value: utilidad };
    });
  }, [ventasLN]);

  const sparklineGastos = useMemo(() => {
    // Sin datos diarios de gastos — usar los 3 meses disponibles interpolados
    if (gastosMes2Atras === 0 && gastosMesAnterior === 0 && gastosMes === 0) return [];
    return [
      { value: gastosMes2Atras },
      { value: gastosMes2Atras },
      { value: gastosMesAnterior },
      { value: gastosMesAnterior },
      { value: gastosMes },
      { value: gastosMes },
      { value: gastosMes },
    ];
  }, [gastosMes, gastosMesAnterior, gastosMes2Atras]);

  const sparklineMargen = useMemo(() => {
    return ventasUltimos30Dias.slice(-7).map(d => {
      // Calcular margen del día
      const ventasDia = ventasLN.filter(v => {
        if (!v.fechaCreacion?.toDate || v.estado === 'cancelada') return false;
        const f = v.fechaCreacion.toDate();
        return f.toDateString() === d.fechaCompleta.toDateString();
      });
      const totalPEN = ventasDia.reduce((s, v) => s + (v.totalPEN || 0), 0);
      const utilidadPEN = ventasDia.reduce((s, v) => s + (v.utilidadBrutaPEN || 0), 0);
      return { value: totalPEN > 0 ? (utilidadPEN / totalPEN) * 100 : 0 };
    });
  }, [ventasUltimos30Dias, ventasLN]);

  // --- CASH & LIQUIDEZ ---
  const valorInventarioPEN = resumenInventario?.valorTotalPEN ?? 0;
  const gastoMensualPromedio = useMemo(() => {
    const meses = [gastosMes2Atras, gastosMesAnterior, gastosMes].filter(g => g > 0);
    if (meses.length === 0) return 0;
    return meses.reduce((s, g) => s + g, 0) / meses.length;
  }, [gastosMes, gastosMesAnterior, gastosMes2Atras]);

  const cashRunwayMeses = gastoMensualPromedio > 0 ? saldoCajaTotal / gastoMensualPromedio : 99;

  const workingCapital = useMemo(() => {
    const cxcTotal = dashboardCxPCxC?.cuentasPorCobrar.totalEquivalentePEN ?? 0;
    const cxpTotal = dashboardCxPCxC?.cuentasPorPagar.totalEquivalentePEN ?? 0;
    return valorInventarioPEN + cxcTotal - cxpTotal;
  }, [valorInventarioPEN, dashboardCxPCxC]);

  // --- TENDENCIA DUAL POR LÍNEA (solo si no hay filtro de línea activo) ---
  const ventasDualLinea = useMemo(() => {
    if (lineaFiltroGlobal !== null) return [];
    const hoy = new Date();

    // Construir mapa fechaString → índice para lookup O(1)
    const dateKeyMap = new Map<string, number>();
    const dias: { fecha: string; ventasSUP: number; ventasSKC: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const fecha = new Date(hoy.getTime() - i * 24 * 60 * 60 * 1000);
      dateKeyMap.set(fecha.toDateString(), dias.length);
      dias.push({
        fecha: fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
        ventasSUP: 0,
        ventasSKC: 0,
      });
    }

    const hace30Dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
    ventas.forEach(v => {
      if (!v.fechaCreacion?.toDate || v.estado === 'cancelada') return;
      const fechaVenta = v.fechaCreacion.toDate();
      if (fechaVenta < hace30Dias) return;

      const diaIndex = dateKeyMap.get(fechaVenta.toDateString());
      if (diaIndex === undefined) return;

      const linea = (v.lineaNegocioId ?? '').toUpperCase();
      if (linea.includes('SKC') || linea.includes('SKIN')) {
        dias[diaIndex].ventasSKC += v.totalPEN || 0;
      } else {
        dias[diaIndex].ventasSUP += v.totalPEN || 0;
      }
    });

    return dias;
  }, [ventas, lineaFiltroGlobal]);

  // --- RENTABILIDAD POR LÍNEA ---
  const rentabilidadSUP = useMemo(() => {
    const ventasSUP = ventasMesActual.filter(v => {
      const linea = (v.lineaNegocioId ?? '').toUpperCase();
      return !linea.includes('SKC') && !linea.includes('SKIN');
    });
    const kpi = calcularKPIVentas(ventasSUP);
    return { ventas: kpi.totalPEN, utilidad: kpi.utilidadPEN, margen: kpi.margenPonderado, cantidad: kpi.cantidad };
  }, [ventasMesActual]);

  const rentabilidadSKC = useMemo(() => {
    const ventasSKC = ventasMesActual.filter(v => {
      const linea = (v.lineaNegocioId ?? '').toUpperCase();
      return linea.includes('SKC') || linea.includes('SKIN');
    });
    const kpi = calcularKPIVentas(ventasSKC);
    return { ventas: kpi.totalPEN, utilidad: kpi.utilidadPEN, margen: kpi.margenPonderado, cantidad: kpi.cantidad };
  }, [ventasMesActual]);

  // --- VENTASS SKC MES ANTERIOR (para insights) ---
  const ventasSKCMesAnterior = useMemo(() => {
    return ventasMesAnterior
      .filter(v => {
        const linea = (v.lineaNegocioId ?? '').toUpperCase();
        return linea.includes('SKC') || linea.includes('SKIN');
      })
      .reduce((s, v) => s + (v.totalPEN || 0), 0);
  }, [ventasMesAnterior]);

  // --- HEALTH INDICATORS ---
  const cxcVencidos = dashboardCxPCxC?.cuentasPorCobrar.cantidadVencidos ?? 0;
  const healthIndicators = useMemo(() => generarHealthIndicators({
    margenPromedioMes,
    progresoMeta,
    crecimientoGastos,
    stockCritico,
    cashRunwayMeses,
    cxcVencidos,
  }), [margenPromedioMes, progresoMeta, crecimientoGastos, stockCritico, cashRunwayMeses, cxcVencidos]);

  // --- INSIGHTS ---
  const insights = useMemo(() => generarInsights({
    proyeccionVentasFinMes,
    metaMensual,
    diasRestantesMes,
    cashRunwayMeses,
    crecimientoGastos,
    gastosMes,
    gastosMesAnterior,
    cambioMargen,
    margenPromedioMes,
    margenMesAnterior,
    stockCritico,
    cxcVencidoMonto: dashboardCxPCxC?.cuentasPorCobrar.pendienteMas30dias ?? 0,
    cxcVencidosCount: cxcVencidos,
    ventasSKCMesActual: rentabilidadSKC.ventas,
    ventasSKCMesAnterior,
    tipoCambioDelDia,
  }), [
    proyeccionVentasFinMes, metaMensual, diasRestantesMes, cashRunwayMeses,
    crecimientoGastos, gastosMes, gastosMesAnterior, cambioMargen,
    margenPromedioMes, margenMesAnterior, stockCritico, dashboardCxPCxC,
    cxcVencidos, rentabilidadSKC.ventas, ventasSKCMesAnterior, tipoCambioDelDia
  ]);

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
    gastosMes,
    gastosMesAnterior,
    crecimientoGastos,
    ratioGastosVentas,
    metaMensual,
    progresoMeta,
    promedioDiarioNecesario,
    diasRestantesMes,
    resumenTexto,
    ventasUltimos30Dias,
    topProductosVendidos,
    // Nuevos
    sparklineVentas,
    sparklineUtilidad,
    sparklineGastos,
    sparklineMargen,
    saldoCajaTotal,
    gastoMensualPromedio,
    cashRunwayMeses,
    valorInventarioPEN,
    workingCapital,
    ventasDualLinea,
    rentabilidadSUP,
    rentabilidadSKC,
    proyeccionVentasFinMes,
    proyeccionVsMeta,
    healthIndicators,
    insights,
  };
}
