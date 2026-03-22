/**
 * Página de Contabilidad
 * Vista completa con pestañas: Resumen, Balance General, Estado de Resultados, Indicadores, Tendencias
 */

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  BarChart3,
  Calendar,
  RefreshCw,
  Wallet,
  PiggyBank,
  AlertTriangle,
  Target,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  LineChart,
  LayoutDashboard,
  Calculator,
  CircleDollarSign,
  Scale,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Loader2,
} from 'lucide-react';
import {
  GradientHeader,
  TabNavigation,
  KPICard,
  KPIGrid,
  StatDistribution,
  Button,
} from '../../components/common';
import { EstadoResultados, BalanceGeneral } from '../../components/modules/contabilidad';
import { contabilidadService } from '../../services/contabilidad.service';
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';
import type {
  EstadoResultados as EstadoResultadosType,
  ResumenContable,
  TendenciaMensual,
  BalanceGeneral as BalanceGeneralType,
  IndicadoresFinancieros,
  AnalisisFinanciero,
} from '../../types/contabilidad.types';
import { formatCurrencyPEN, formatPercent } from '../../utils/format';

type TabActiva = 'resumen' | 'balance' | 'estado-resultados' | 'indicadores' | 'tendencias';

// Alias local para mantener llamadas existentes sin alterar (PEN, 0 decimales no soportado
// en format.ts — se usa formatCurrencyPEN que produce 2 decimales; la diferencia visual
// es mínima y unifica el comportamiento).
const formatCurrency = formatCurrencyPEN;

// Color según estado del análisis
const getEstadoColor = (estado: AnalisisFinanciero['estado']) => {
  switch (estado) {
    case 'excelente': return 'bg-green-100 text-green-800 border-green-300';
    case 'bueno': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'regular': return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'malo': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'critico': return 'bg-red-100 text-red-800 border-red-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const getEstadoIcon = (estado: AnalisisFinanciero['estado']) => {
  switch (estado) {
    case 'excelente':
    case 'bueno':
      return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    case 'regular':
      return <AlertCircle className="w-5 h-5 text-amber-600" />;
    case 'malo':
    case 'critico':
      return <XCircle className="w-5 h-5 text-red-600" />;
    default:
      return <Info className="w-5 h-5 text-gray-600" />;
  }
};

export function Contabilidad() {
  const lineaFiltroGlobal = useLineaNegocioStore(state => state.lineaFiltroGlobal);
  const [tabActiva, setTabActiva] = useState<TabActiva>('resumen');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState<ResumenContable | null>(null);
  const [estado, setEstado] = useState<EstadoResultadosType | null>(null);
  const [tendencia, setTendencia] = useState<TendenciaMensual[]>([]);
  const [mesAnterior, setMesAnterior] = useState<ResumenContable | null>(null);
  const [balance, setBalance] = useState<BalanceGeneralType | null>(null);
  const [indicadores, setIndicadores] = useState<IndicadoresFinancieros | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisFinanciero[]>([]);

  const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Cargar datos
  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [estadoData, tendenciaData, balanceData, indicadoresData] = await Promise.all([
        contabilidadService.generarEstadoResultados(mes, anio, lineaFiltroGlobal),
        contabilidadService.getTendenciaMensual(anio, lineaFiltroGlobal),
        contabilidadService.generarBalanceGeneral(mes, anio),
        contabilidadService.calcularIndicadoresFinancieros(mes, anio, lineaFiltroGlobal),
      ]);

      setEstado(estadoData);
      setTendencia(tendenciaData);
      setBalance(balanceData);
      setIndicadores(indicadoresData);
      setAnalisis(contabilidadService.generarAnalisisFinanciero(indicadoresData));

      // Crear resumen desde estado
      setResumen({
        periodo: estadoData.periodo,
        ventasNetas: estadoData.ventasNetas,
        compras: estadoData.compras.total,
        utilidadBruta: estadoData.utilidadBruta,
        gastosOperativos: estadoData.totalGastosOperativos,
        utilidadNeta: estadoData.utilidadNeta,
        margenNeto: estadoData.utilidadNetaPorcentaje,
        tendencia: estadoData.utilidadNeta >= 0 ? 'subiendo' : 'bajando',
      });

      // Cargar mes anterior para comparación
      const mesAnt = mes === 1 ? 12 : mes - 1;
      const anioAnt = mes === 1 ? anio - 1 : anio;
      try {
        const resumenAnt = await contabilidadService.getResumenContable(mesAnt, anioAnt, lineaFiltroGlobal);
        setMesAnterior(resumenAnt);
      } catch {
        setMesAnterior(null);
      }
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [mes, anio, lineaFiltroGlobal]);

  // Calcular variaciones vs mes anterior
  const calcularVariacion = (actual: number, anterior: number | undefined): number | null => {
    if (!anterior || anterior === 0) return null;
    return ((actual - anterior) / Math.abs(anterior)) * 100;
  };

  const varVentas = calcularVariacion(resumen?.ventasNetas || 0, mesAnterior?.ventasNetas);
  const varUtilidadNeta = calcularVariacion(resumen?.utilidadNeta || 0, mesAnterior?.utilidadNeta);
  const varCompras = calcularVariacion(resumen?.compras || 0, mesAnterior?.compras);

  // Tabs
  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { id: 'balance', label: 'Balance General', mobileLabel: 'Balance', icon: Scale },
    { id: 'estado-resultados', label: 'Estado de Resultados', mobileLabel: 'Resultados', icon: FileText },
    { id: 'indicadores', label: 'Indicadores', mobileLabel: 'KPIs', icon: Activity },
    { id: 'tendencias', label: 'Tendencias', icon: LineChart },
  ];

  // Años disponibles
  const aniosDisponibles = [];
  const anioActual = new Date().getFullYear();
  for (let a = 2024; a <= anioActual; a++) {
    aniosDisponibles.push(a);
  }

  // Encontrar mejor y peor mes
  const mejorMes = tendencia.reduce((best, curr) =>
    curr.utilidadNeta > (best?.utilidadNeta || -Infinity) ? curr : best, tendencia[0]);
  const peorMes = tendencia.reduce((worst, curr) =>
    curr.utilidadNeta < (worst?.utilidadNeta || Infinity) ? curr : worst, tendencia[0]);

  // Acumulado del año
  const acumuladoVentas = tendencia.reduce((sum, m) => sum + m.ventasNetas, 0);
  const acumuladoCompras = tendencia.reduce((sum, m) => sum + m.compras, 0);
  const acumuladoUtilidadNeta = tendencia.reduce((sum, m) => sum + m.utilidadNeta, 0);
  const promedioMensual = tendencia.length > 0 ? acumuladoUtilidadNeta / tendencia.length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <GradientHeader
        title="Contabilidad de Negocio"
        subtitle={`${MESES[mes - 1]} ${anio} - Estados Financieros`}
        icon={Calculator}
        variant="dark"
        actions={
          <div className="flex items-center gap-2 sm:space-x-3">
            {/* Selector de período */}
            <div className="flex items-center gap-1 sm:gap-2 bg-white/10 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
              <Calendar className="w-4 h-4 text-white/70 hidden sm:block" />
              <select
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                className="border-none bg-transparent text-white focus:ring-0 text-xs sm:text-sm"
              >
                {MESES.map((m, i) => (
                  <option key={i} value={i + 1} className="text-gray-900">
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                className="border-none bg-transparent text-white focus:ring-0 text-xs sm:text-sm"
              >
                {aniosDisponibles.map((a) => (
                  <option key={a} value={a} className="text-gray-900">
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="ghost"
              onClick={cargarDatos}
              disabled={loading}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
        stats={estado && balance ? [
          { label: 'Ventas', value: formatCurrency(estado.ventasNetas) },
          { label: 'Activos', value: formatCurrency(balance.activos.totalActivos) },
          { label: 'EBIT', value: formatCurrency(estado.utilidadOperativa) },
          { label: 'Patrimonio', value: formatCurrency(balance.patrimonio.totalPatrimonio) },
        ] : []}
      />

      {/* Tabs */}
      <TabNavigation
        tabs={tabs}
        activeTab={tabActiva}
        onTabChange={(tabId) => setTabActiva(tabId as TabActiva)}
        variant="pills"
      />

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      )}

      {/* RESUMEN */}
      {!loading && tabActiva === 'resumen' && estado && balance && (
        <div className="space-y-6">
          {/* KPIs Principales */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              Resumen Financiero
            </h3>
            <KPIGrid columns={5}>
              <KPICard
                title="Ventas Netas"
                value={formatCurrency(estado.ventasNetas)}
                subtitle={`${estado.metricas.transacciones} transacciones`}
                icon={DollarSign}
                variant="info"
                size="sm"
                trend={varVentas !== null ? {
                  value: varVentas,
                  label: 'vs mes anterior'
                } : undefined}
              />
              <KPICard
                title="Total Activos"
                value={formatCurrency(balance.activos.totalActivos)}
                subtitle={`Inventario: ${formatCurrency(balance.activos.corriente.inventarios.totalValorPEN)}`}
                icon={TrendingUp}
                variant="success"
                size="sm"
              />
              <KPICard
                title="Total Pasivos"
                value={formatCurrency(balance.pasivos.totalPasivos)}
                subtitle={`CxP: ${formatCurrency(balance.pasivos.corriente.cuentasPorPagarProveedores.ordenesCompraPendientes)}`}
                icon={Wallet}
                variant="warning"
                size="sm"
              />
              <KPICard
                title="Patrimonio"
                value={formatCurrency(balance.patrimonio.totalPatrimonio)}
                subtitle={`Utilidad YTD: ${formatCurrency(balance.patrimonio.utilidadEjercicio)}`}
                icon={PiggyBank}
                variant="info"
                size="sm"
              />
              <KPICard
                title="Utilidad Neta"
                value={formatCurrency(estado.utilidadNeta)}
                subtitle={formatPercent(estado.utilidadNetaPorcentaje)}
                icon={estado.utilidadNeta >= 0 ? TrendingUp : TrendingDown}
                variant={estado.utilidadNeta >= 0 ? 'success' : 'danger'}
                size="sm"
                trend={varUtilidadNeta !== null ? {
                  value: varUtilidadNeta,
                  label: 'vs mes anterior'
                } : undefined}
              />
            </KPIGrid>

            {/* Alerta de Anticipos Pendientes */}
            {balance.pasivos.corriente.anticiposClientes &&
             balance.pasivos.corriente.anticiposClientes.totalAnticiposPEN > 0 && (
              <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg shrink-0">
                    <CircleDollarSign className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-purple-800 text-sm sm:text-base">
                      Anticipos Pendientes (Pasivo)
                    </div>
                    <div className="text-xs sm:text-sm text-purple-600">
                      {balance.pasivos.corriente.anticiposClientes.cantidadVentas} ventas con anticipo sin entregar — Ingreso diferido
                    </div>
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-purple-700 sm:text-right pl-12 sm:pl-0">
                  {formatCurrency(balance.pasivos.corriente.anticiposClientes.totalAnticiposPEN)}
                </div>
              </div>
            )}
          </div>

          {/* Distribución */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatDistribution
              title="Composición de Activos"
              valueFormat="currency"
              data={[
                { label: 'Efectivo', value: balance.activos.corriente.efectivo.total, color: 'bg-green-500' },
                { label: 'CxC', value: balance.activos.corriente.cuentasPorCobrar.neto, color: 'bg-blue-500' },
                { label: 'Inventario', value: balance.activos.corriente.inventarios.totalValorPEN, color: 'bg-purple-500' },
              ]}
            />
            <StatDistribution
              title="Estructura Financiera"
              valueFormat="currency"
              data={[
                { label: 'Pasivos', value: balance.pasivos.totalPasivos, color: 'bg-red-500' },
                { label: 'Patrimonio', value: balance.patrimonio.totalPatrimonio, color: 'bg-blue-500' },
              ]}
            />
            <StatDistribution
              title="Estructura de Costos"
              valueFormat="currency"
              data={[
                { label: 'Compras', value: estado.compras.total, color: 'bg-orange-500' },
                { label: 'GV + GD', value: estado.costosVariables.total, color: 'bg-purple-500' },
                { label: 'GA + GO', value: estado.costosFijos.total, color: 'bg-amber-500' },
              ]}
            />
            <StatDistribution
              title="Inventario por País"
              valueFormat="currency"
              data={[
                { label: 'USA', value: balance.activos.corriente.inventarios.inventarioUSA.valorPEN, color: 'bg-blue-500' },
                { label: 'Perú', value: balance.activos.corriente.inventarios.inventarioPeru.valorPEN, color: 'bg-green-500' },
              ]}
            />
          </div>

          {/* Indicadores clave y Análisis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Indicadores clave */}
            {indicadores && (
              <div className="bg-white rounded-lg border p-6">
                <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-600" />
                  Indicadores Clave
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-500">Razón Corriente</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {indicadores.liquidez.razonCorriente.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400">Act. Corr. / Pas. Corr.</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-500">ROE</div>
                    <div className={`text-2xl font-bold ${indicadores.rentabilidad.roe >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(indicadores.rentabilidad.roe)}
                    </div>
                    <div className="text-xs text-gray-400">Util. Neta / Patrimonio</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-500">Endeudamiento</div>
                    <div className={`text-2xl font-bold ${indicadores.solvencia.endeudamientoTotal <= 50 ? 'text-green-600' : 'text-amber-600'}`}>
                      {formatPercent(indicadores.solvencia.endeudamientoTotal)}
                    </div>
                    <div className="text-xs text-gray-400">Pasivos / Activos</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-500">Ciclo de Efectivo</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {indicadores.actividad.cicloConversionEfectivo.toFixed(0)} días
                    </div>
                    <div className="text-xs text-gray-400">Inv + Cobro - Pago</div>
                  </div>
                </div>
              </div>
            )}

            {/* Análisis con semáforo */}
            <div className="bg-white rounded-lg border p-6">
              <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-600" />
                Diagnóstico Financiero
              </h4>
              <div className="space-y-3">
                {analisis.slice(0, 4).map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-lg border ${getEstadoColor(item.estado)}`}
                  >
                    <div className="flex items-center gap-3">
                      {getEstadoIcon(item.estado)}
                      <div>
                        <div className="font-medium">{item.indicador}</div>
                        <div className="text-xs opacity-80">{item.descripcion}</div>
                      </div>
                    </div>
                    <div className="font-mono font-bold">{item.valorFormateado}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Acumulado del Año */}
          {tendencia.length > 0 && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-200 p-6">
              <h4 className="font-semibold text-indigo-800 mb-4 flex items-center gap-2">
                <CircleDollarSign className="w-5 h-5" />
                Acumulado {anio}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <div className="text-xs sm:text-sm text-indigo-600">Ventas Acumuladas</div>
                  <div className="text-lg sm:text-2xl font-bold text-indigo-900">{formatCurrency(acumuladoVentas)}</div>
                </div>
                <div>
                  <div className="text-xs sm:text-sm text-indigo-600">Compras Acumuladas</div>
                  <div className="text-lg sm:text-2xl font-bold text-indigo-900">{formatCurrency(acumuladoCompras)}</div>
                </div>
                <div>
                  <div className="text-xs sm:text-sm text-indigo-600">Utilidad Acumulada</div>
                  <div className={`text-lg sm:text-2xl font-bold ${acumuladoUtilidadNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(acumuladoUtilidadNeta)}
                  </div>
                </div>
                <div>
                  <div className="text-xs sm:text-sm text-indigo-600">Promedio Mensual</div>
                  <div className={`text-lg sm:text-2xl font-bold ${promedioMensual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(promedioMensual)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BALANCE GENERAL */}
      {!loading && tabActiva === 'balance' && (
        <BalanceGeneral mes={mes} anio={anio} />
      )}

      {/* ESTADO DE RESULTADOS */}
      {!loading && tabActiva === 'estado-resultados' && (
        <EstadoResultados />
      )}

      {/* INDICADORES FINANCIEROS */}
      {!loading && tabActiva === 'indicadores' && indicadores && (
        <div className="space-y-6">
          {/* Ratios por categoría */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Liquidez */}
            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-blue-800 mb-3 sm:mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Ratios de Liquidez
              </h3>
              <p className="text-sm text-gray-500 mb-4">Miden la capacidad de pago a corto plazo</p>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Razón Corriente</div>
                    <div className="text-xs text-gray-500">Activo Corriente / Pasivo Corriente</div>
                  </div>
                  <div className={`text-xl sm:text-2xl font-bold ${indicadores.liquidez.razonCorriente >= 1.5 ? 'text-green-600' : 'text-amber-600'}`}>
                    {indicadores.liquidez.razonCorriente.toFixed(2)}
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Prueba Ácida</div>
                    <div className="text-xs text-gray-500">(Act. Corr. - Inventarios) / Pas. Corr.</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.liquidez.pruebaAcida >= 1 ? 'text-green-600' : 'text-amber-600'}`}>
                    {indicadores.liquidez.pruebaAcida.toFixed(2)}
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Capital de Trabajo</div>
                    <div className="text-xs text-gray-500">Activo Corriente - Pasivo Corriente</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.liquidez.capitalTrabajo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(indicadores.liquidez.capitalTrabajo)}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Razón de Efectivo</div>
                    <div className="text-xs text-gray-500">Efectivo / Pasivo Corriente</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.liquidez.razonEfectivo >= 0.3 ? 'text-green-600' : 'text-amber-600'}`}>
                    {indicadores.liquidez.razonEfectivo.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Solvencia */}
            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-purple-800 mb-3 sm:mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5" />
                Ratios de Solvencia
              </h3>
              <p className="text-sm text-gray-500 mb-4">Miden la estructura de financiamiento</p>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Endeudamiento Total</div>
                    <div className="text-xs text-gray-500">Pasivos / Activos</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.solvencia.endeudamientoTotal <= 50 ? 'text-green-600' : 'text-amber-600'}`}>
                    {formatPercent(indicadores.solvencia.endeudamientoTotal)}
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Endeudamiento Patrimonio</div>
                    <div className="text-xs text-gray-500">Pasivos / Patrimonio</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.solvencia.endeudamientoPatrimonio <= 100 ? 'text-green-600' : 'text-amber-600'}`}>
                    {formatPercent(indicadores.solvencia.endeudamientoPatrimonio)}
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Autonomía</div>
                    <div className="text-xs text-gray-500">Patrimonio / Activos</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.solvencia.autonomia >= 50 ? 'text-green-600' : 'text-amber-600'}`}>
                    {formatPercent(indicadores.solvencia.autonomia)}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Apalancamiento</div>
                    <div className="text-xs text-gray-500">Activos / Patrimonio</div>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {indicadores.solvencia.apalancamiento.toFixed(2)}x
                  </div>
                </div>
              </div>
            </div>

            {/* Rentabilidad */}
            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-green-800 mb-3 sm:mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Ratios de Rentabilidad
              </h3>
              <p className="text-sm text-gray-500 mb-4">Miden la capacidad de generar utilidades</p>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">ROA (Return on Assets)</div>
                    <div className="text-xs text-gray-500">Utilidad Neta / Activos</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.rentabilidad.roa >= 5 ? 'text-green-600' : 'text-amber-600'}`}>
                    {formatPercent(indicadores.rentabilidad.roa)}
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">ROE (Return on Equity)</div>
                    <div className="text-xs text-gray-500">Utilidad Neta / Patrimonio</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.rentabilidad.roe >= 10 ? 'text-green-600' : 'text-amber-600'}`}>
                    {formatPercent(indicadores.rentabilidad.roe)}
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Margen Bruto</div>
                    <div className="text-xs text-gray-500">Utilidad Bruta / Ventas</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.rentabilidad.margenBruto >= 30 ? 'text-green-600' : 'text-amber-600'}`}>
                    {formatPercent(indicadores.rentabilidad.margenBruto)}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Margen Neto</div>
                    <div className="text-xs text-gray-500">Utilidad Neta / Ventas</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.rentabilidad.margenNeto >= 10 ? 'text-green-600' : 'text-amber-600'}`}>
                    {formatPercent(indicadores.rentabilidad.margenNeto)}
                  </div>
                </div>
              </div>
            </div>

            {/* Actividad */}
            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-amber-800 mb-3 sm:mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Ratios de Actividad
              </h3>
              <p className="text-sm text-gray-500 mb-4">Miden la eficiencia operativa</p>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Rotación de Inventarios</div>
                    <div className="text-xs text-gray-500">Compras / Inventario</div>
                  </div>
                  <div className="text-2xl font-bold text-amber-600">
                    {indicadores.actividad.rotacionInventarios.toFixed(1)}x
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Días de Inventario</div>
                    <div className="text-xs text-gray-500">365 / Rotación</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.actividad.diasInventario <= 60 ? 'text-green-600' : 'text-amber-600'}`}>
                    {indicadores.actividad.diasInventario.toFixed(0)} días
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Días de Cobro</div>
                    <div className="text-xs text-gray-500">CxC / (Ventas/365)</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.actividad.diasCobro <= 30 ? 'text-green-600' : 'text-amber-600'}`}>
                    {indicadores.actividad.diasCobro.toFixed(0)} días
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Días de Pago</div>
                    <div className="text-xs text-gray-500">CxP / (Compras/365)</div>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {indicadores.actividad.diasPago.toFixed(0)} días
                  </div>
                </div>
                <div className="flex justify-between items-center bg-purple-50 rounded-lg p-3 -mx-3">
                  <div>
                    <div className="font-medium text-purple-800">Ciclo de Conversión</div>
                    <div className="text-xs text-purple-600">Días Inv + Cobro - Pago</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.actividad.cicloConversionEfectivo <= 45 ? 'text-green-600' : 'text-amber-600'}`}>
                    {indicadores.actividad.cicloConversionEfectivo.toFixed(0)} días
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Análisis completo con semáforo */}
          <div className="bg-white rounded-lg border p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-600" />
              Diagnóstico Financiero Completo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analisis.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${getEstadoColor(item.estado)}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getEstadoIcon(item.estado)}
                      <span className="font-semibold">{item.indicador}</span>
                    </div>
                    <span className="font-mono font-bold text-lg">{item.valorFormateado}</span>
                  </div>
                  <p className="text-sm opacity-80">{item.descripcion}</p>
                  {item.recomendacion && (
                    <p className="text-xs mt-2 opacity-70 italic">{item.recomendacion}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TENDENCIAS */}
      {!loading && tabActiva === 'tendencias' && (
        <div className="space-y-6">
          {/* Resumen de tendencia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-2 sm:mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-sm text-gray-500">Mejor Mes</div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900">{mejorMes?.nombreMes || '-'}</div>
              <div className="text-green-600 font-medium text-sm sm:text-base">
                {mejorMes ? formatCurrency(mejorMes.utilidadNeta) : '-'}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-2 sm:mb-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-sm text-gray-500">Peor Mes</div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900">{peorMes?.nombreMes || '-'}</div>
              <div className={`font-medium text-sm sm:text-base ${(peorMes?.utilidadNeta || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {peorMes ? formatCurrency(peorMes.utilidadNeta) : '-'}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-2 sm:mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-sm text-gray-500">Promedio Mensual</div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900">
                {formatCurrency(promedioMensual)}
              </div>
              <div className="text-blue-600 font-medium text-sm sm:text-base">
                {tendencia.length} meses
              </div>
            </div>
          </div>

          {/* Evolución Mensual — Cards en mobile, tabla en desktop */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-800">Evolución Mensual {anio}</h3>
            </div>

            {/* Mobile: Cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {tendencia.map((m, idx) => {
                const margenBruto = m.ventasNetas > 0 ? (m.utilidadBruta / m.ventasNetas) * 100 : 0;
                const margenNeto = m.ventasNetas > 0 ? (m.utilidadNeta / m.ventasNetas) * 100 : 0;
                const maxVentas = Math.max(...tendencia.map(t => t.ventasNetas), 1);
                const barWidth = (m.ventasNetas / maxVentas) * 100;

                return (
                  <div key={idx} className="px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-gray-900">{m.nombreMes}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        m.utilidadNeta >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {m.utilidadNeta >= 0 ? '+' : ''}{margenNeto.toFixed(1)}% neto
                      </span>
                    </div>

                    {/* Barra de ventas */}
                    <div className="h-2 bg-gray-100 rounded-full mb-3 overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${barWidth}%` }} />
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Ventas</span>
                        <span className="font-medium text-gray-900">{formatCurrency(m.ventasNetas)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Compras</span>
                        <span className="font-medium text-orange-600">{formatCurrency(m.compras)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">U. Bruta</span>
                        <span className={`font-medium ${m.utilidadBruta >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {formatCurrency(m.utilidadBruta)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Gastos Op.</span>
                        <span className="font-medium text-gray-600">{formatCurrency(m.gastosOperativos)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">EBIT</span>
                        <span className="font-medium text-purple-600">{formatCurrency(m.utilidadOperativa)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">U. Neta</span>
                        <span className={`font-bold ${m.utilidadNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(m.utilidadNeta)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Totales mobile */}
              <div className="px-4 py-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-gray-900">ACUMULADO {anio}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    acumuladoUtilidadNeta >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {acumuladoUtilidadNeta >= 0 ? '+' : ''}{acumuladoVentas > 0 ? ((acumuladoUtilidadNeta / acumuladoVentas) * 100).toFixed(1) : '0.0'}% neto
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ventas</span>
                    <span className="font-bold text-gray-900">{formatCurrency(acumuladoVentas)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Compras</span>
                    <span className="font-bold text-orange-700">{formatCurrency(acumuladoCompras)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">U. Bruta</span>
                    <span className="font-bold text-blue-700">{formatCurrency(tendencia.reduce((s, m) => s + m.utilidadBruta, 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">U. Neta</span>
                    <span className={`font-bold ${acumuladoUtilidadNeta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatCurrency(acumuladoUtilidadNeta)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop: Tabla */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mes</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ventas</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Compras</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">U. Bruta</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gastos Op.</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">EBIT</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">U. Neta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tendencia.map((m, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{m.nombreMes}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(m.ventasNetas)}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(m.compras)}</td>
                      <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(m.utilidadBruta)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(m.gastosOperativos)}</td>
                      <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(m.utilidadOperativa)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${m.utilidadNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(m.utilidadNeta)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-semibold">
                    <td className="px-4 py-3 text-gray-900">TOTAL</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(acumuladoVentas)}</td>
                    <td className="px-4 py-3 text-right text-orange-700">{formatCurrency(acumuladoCompras)}</td>
                    <td className="px-4 py-3 text-right text-blue-700">
                      {formatCurrency(tendencia.reduce((s, m) => s + m.utilidadBruta, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatCurrency(tendencia.reduce((s, m) => s + m.gastosOperativos, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-purple-700">
                      {formatCurrency(tendencia.reduce((s, m) => s + m.utilidadOperativa, 0))}
                    </td>
                    <td className={`px-4 py-3 text-right ${acumuladoUtilidadNeta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatCurrency(acumuladoUtilidadNeta)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráfico visual — Utilidad Neta por Mes */}
          <div className="bg-white rounded-lg border p-4 sm:p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Utilidad Neta por Mes</h3>
            <div className="space-y-3">
              {tendencia.map((m, idx) => {
                const maxVal = Math.max(...tendencia.map(t => Math.abs(t.utilidadNeta)), 1);
                const width = Math.abs(m.utilidadNeta) / maxVal * 100;
                const isPositive = m.utilidadNeta >= 0;

                return (
                  <div key={idx} className="flex items-center gap-2 sm:gap-3">
                    <div className="w-12 sm:w-20 text-xs sm:text-sm text-gray-600 shrink-0">{m.nombreMes.slice(0, 3)}</div>
                    <div className="flex-1 h-5 sm:h-6 bg-gray-100 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className={`w-20 sm:w-28 text-right text-xs sm:text-sm font-medium shrink-0 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(m.utilidadNeta)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Contabilidad;
