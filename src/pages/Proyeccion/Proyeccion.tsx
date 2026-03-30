import React, { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, BarChart3, DollarSign,
  Package, RefreshCw, ChevronDown, ChevronUp, ShoppingCart,
  Clock, Target, Zap, ArrowRight, Minus
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine, Area, AreaChart
} from 'recharts';
import { Card, Button, Badge } from '../../components/common';
import { useCTRUStore } from '../../store/ctruStore';
import { costoProyeccionService } from '../../services/costoProyeccion.service';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import { formatCurrency } from '../../utils/format';
import type {
  DashboardProyeccion, ProyeccionCTRU, EscenariosProducto,
  AlertaErosionMargen, ProyeccionReabastecimiento
} from '../../services/costoProyeccion.service';
import type { CTRUProductoDetalle } from '../../store/ctruStore';

// ============================================
// Componente principal
// ============================================

export const Proyeccion: React.FC = () => {
  const { productosDetalle: productos, loading: ctruLoading, fetchAll } = useCTRUStore();
  const [dashboard, setDashboard] = useState<DashboardProyeccion | null>(null);
  const [proyecciones, setProyecciones] = useState<ProyeccionCTRU[]>([]);
  const [escenarios, setEscenarios] = useState<EscenariosProducto[]>([]);
  const [alertas, setAlertas] = useState<AlertaErosionMargen[]>([]);
  const [reabastecimiento, setReabastecimiento] = useState<ProyeccionReabastecimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [horizonte, setHorizonte] = useState<30 | 90>(30);
  const [tcSlider, setTcSlider] = useState(0); // -10 a +10 %
  const [seccionExpandida, setSeccionExpandida] = useState<string | null>('resumen');

  const productosLNRaw = useLineaFilter(productos || [], (p: CTRUProductoDetalle) => p.lineaNegocioId);
  const productosLN = productosLNRaw || [];

  // Cargar datos CTRU si no están
  useEffect(() => {
    if (!(productos || []).length && !ctruLoading) fetchAll();
  }, [productos, ctruLoading, fetchAll]);

  // Generar proyecciones cuando hay productos
  useEffect(() => {
    if (!productosLN.length) return;
    let cancelled = false;

    const generar = async () => {
      setLoading(true);
      try {
        // Cargar cada servicio individualmente para no bloquear todo si uno falla
        let dash: DashboardProyeccion | null = null;
        let proysArr: ProyeccionCTRU[] = [];
        let alertasArr: AlertaErosionMargen[] = [];

        try {
          const proysResult = await costoProyeccionService.proyectarTodos(productosLN, horizonte);
          proysArr = proysResult instanceof Map ? Array.from(proysResult.values()) : Array.isArray(proysResult) ? proysResult : [];
        } catch (e) { logger_warn('Error en proyectarTodos:', e); }

        try {
          dash = await costoProyeccionService.dashboardProyeccion(productosLN);
        } catch (e) { logger_warn('Error en dashboardProyeccion:', e); }

        try {
          alertasArr = await costoProyeccionService.alertasErosionMargen(productosLN);
          if (!Array.isArray(alertasArr)) alertasArr = [];
        } catch (e) { logger_warn('Error en alertasErosionMargen:', e); }

        // Escenarios solo para top 5 productos con más unidades
        let escArr: EscenariosProducto[] = [];
        try {
          const top5 = [...productosLN]
            .sort((a, b) => b.totalUnidades - a.totalUnidades)
            .slice(0, 5);
          escArr = await Promise.all(
            top5.map(p => costoProyeccionService.proyectarEscenarios(p))
          );
        } catch (e) { logger_warn('Error en escenarios:', e); }

        // Reabastecimiento
        let reabArr: ProyeccionReabastecimiento[] = [];
        try {
          const results = await Promise.all(
            productosLN.map(p => costoProyeccionService.proyectarReabastecimiento(p).catch(() => null))
          );
          reabArr = results.filter((r): r is ProyeccionReabastecimiento => r !== null && r.urgencia !== 'sin_urgencia');
        } catch (e) { logger_warn('Error en reabastecimiento:', e); }

        if (!cancelled) {
          setDashboard(dash);
          setProyecciones(proysArr);
          setEscenarios(escArr);
          setAlertas(alertasArr);
          setReabastecimiento(reabArr);
        }
      } catch (err) {
        logger_warn('Error general en proyecciones:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    generar();
    return () => { cancelled = true; };
  }, [productosLN, horizonte]);

  // Helper para evitar importar logger
  function logger_warn(...args: unknown[]) { console.warn('[Proyeccion]', ...args); }

  const toggleSeccion = (id: string) => {
    setSeccionExpandida(prev => prev === id ? null : id);
  };

  if (ctruLoading || loading) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Header horizonte={horizonte} setHorizonte={setHorizonte} />
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
          <span className="ml-3 text-gray-500">Generando proyecciones...</span>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Header horizonte={horizonte} setHorizonte={setHorizonte} />
        <Card className="p-8 text-center text-gray-500">
          No hay datos suficientes para generar proyecciones. Necesitas al menos 1 producto con historial de compras.
        </Card>
      </div>
    );
  }

  // Datos para gráfica de sensibilidad TC
  const sensibilidadData = proyecciones.length > 0
    ? proyecciones[0].sensibilidadTC.map(s => ({
        tc: s.tcEscenario.toFixed(2),
        ctru: s.ctruResultante,
        margen: s.margenResultante,
      }))
    : [];

  // Datos para gráfica de comparación CTRU actual vs proyectado
  const comparacionData = proyecciones
    .filter(p => p.ctruActual > 0)
    .map(p => ({
      nombre: p.productoNombre.length > 20 ? p.productoNombre.slice(0, 20) + '...' : p.productoNombre,
      actual: Math.round(p.ctruActual * 100) / 100,
      proyectado: Math.round(p.ctruProyectado * 100) / 100,
      variacion: p.variacionPct,
    }))
    .sort((a, b) => b.variacion - a.variacion);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <Header horizonte={horizonte} setHorizonte={setHorizonte} />

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          icon={<DollarSign className="w-5 h-5" />}
          label="CTRU Promedio"
          valor={formatCurrency(dashboard.ctruPromedioActual)}
          subvalor={`→ ${formatCurrency(horizonte === 30 ? dashboard.ctruPromedio30d : dashboard.ctruPromedio90d)} (${horizonte}d)`}
          tendencia={horizonte === 30 ? dashboard.variacion30d : dashboard.variacion90d}
        />
        <KPICard
          icon={<TrendingUp className="w-5 h-5" />}
          label="TC Proyectado"
          valor={dashboard.tcActual.toFixed(2)}
          subvalor={`→ ${dashboard.tcProyectado30d.toFixed(2)} (30d)`}
          tendencia={((dashboard.tcProyectado30d - dashboard.tcActual) / dashboard.tcActual) * 100}
        />
        <KPICard
          icon={<BarChart3 className="w-5 h-5" />}
          label="GA/GO Mensual"
          valor={formatCurrency(dashboard.gagoActualMensual)}
          subvalor={`→ ${formatCurrency(dashboard.gagoProyectadoMensual)}`}
          tendencia={dashboard.gagoTendencia}
        />
        <KPICard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Alertas"
          valor={`${alertas.length}`}
          subvalor={`${alertas.filter(a => a.prioridad === 'critica').length} críticas`}
          color={alertas.some(a => a.prioridad === 'critica') ? 'red' : alertas.length > 0 ? 'amber' : 'green'}
        />
      </div>

      {/* IMPACTO TC */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" /> Impacto del Tipo de Cambio
          </h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600 font-medium">TC -{Math.abs(tcSlider || 5)}%: {formatCurrency(Math.abs(dashboard.impactoTCMenos5))}</span>
            <span className="text-gray-400">|</span>
            <span className="text-red-600 font-medium">TC +{Math.abs(tcSlider || 5)}%: +{formatCurrency(dashboard.impactoTCMas5)}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 w-12">-10%</span>
          <input
            type="range"
            min={-10}
            max={10}
            step={1}
            value={tcSlider}
            onChange={(e) => setTcSlider(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
          <span className="text-xs text-gray-500 w-12 text-right">+10%</span>
        </div>
        <div className="text-center mt-2">
          <span className={`text-lg font-bold ${tcSlider > 0 ? 'text-red-600' : tcSlider < 0 ? 'text-green-600' : 'text-gray-700'}`}>
            TC {tcSlider >= 0 ? '+' : ''}{tcSlider}% = {(dashboard.tcActual * (1 + tcSlider / 100)).toFixed(2)}
          </span>
          <span className="text-gray-500 text-sm ml-2">
            (actual: {dashboard.tcActual.toFixed(2)})
          </span>
        </div>
      </Card>

      {/* GRÁFICA: CTRU ACTUAL vs PROYECTADO */}
      {comparacionData.length > 0 && (
        <SeccionExpandible
          id="comparacion"
          titulo="CTRU Actual vs Proyectado"
          icono={<BarChart3 className="w-4 h-4" />}
          expandida={seccionExpandida === 'comparacion'}
          onToggle={toggleSeccion}
          badge={`${horizonte}d`}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparacionData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={(v) => `S/${v}`} fontSize={11} />
                <YAxis type="category" dataKey="nombre" width={130} fontSize={11} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Legend />
                <Bar dataKey="actual" name="CTRU Actual" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={14} />
                <Bar dataKey="proyectado" name={`CTRU ${horizonte}d`} fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SeccionExpandible>
      )}

      {/* GRÁFICA: ESCENARIOS */}
      {escenarios.length > 0 && (
        <SeccionExpandible
          id="escenarios"
          titulo="Escenarios por Producto"
          icono={<Target className="w-4 h-4" />}
          expandida={seccionExpandida === 'escenarios'}
          onToggle={toggleSeccion}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {escenarios.map(ep => (
              <Card key={ep.productoId} className="p-3 bg-gray-50">
                <h4 className="font-medium text-sm text-gray-900 mb-2 truncate">{ep.productoNombre}</h4>
                <div className="space-y-1.5">
                  {ep.escenarios.map(e => (
                    <div key={e.nombre} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${
                      e.nombre === 'optimista' ? 'bg-green-50' : e.nombre === 'pesimista' ? 'bg-red-50' : 'bg-blue-50'
                    }`}>
                      <div className="flex items-center gap-2">
                        {e.nombre === 'optimista' ? <TrendingDown className="w-3 h-3 text-green-600" /> :
                         e.nombre === 'pesimista' ? <TrendingUp className="w-3 h-3 text-red-600" /> :
                         <Minus className="w-3 h-3 text-blue-600" />}
                        <span className="font-medium capitalize">{e.nombre}</span>
                        <span className="text-gray-400">({(e.probabilidad * 100).toFixed(0)}%)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono">{formatCurrency(e.ctruProyectado)}</span>
                        <span className={`font-bold ${
                          e.margenProyectado >= 20 ? 'text-green-600' : e.margenProyectado >= 10 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {e.margenProyectado.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-gray-400">
                  CTRU actual: {formatCurrency(ep.ctruActual)} | Ventas/mes: {ep.ventasMensualesPromedio.toFixed(1)}
                </div>
              </Card>
            ))}
          </div>
        </SeccionExpandible>
      )}

      {/* ALERTAS DE EROSIÓN */}
      {alertas.length > 0 && (
        <SeccionExpandible
          id="alertas"
          titulo={`Alertas de Erosión de Margen (${alertas.length})`}
          icono={<AlertTriangle className="w-4 h-4" />}
          expandida={seccionExpandida === 'alertas'}
          onToggle={toggleSeccion}
          badge={`${alertas.filter(a => a.prioridad === 'critica').length} críticas`}
          badgeColor="red"
        >
          <div className="space-y-2">
            {alertas.map(a => (
              <div key={a.productoId} className={`flex items-center justify-between p-3 rounded-lg border ${
                a.prioridad === 'critica' ? 'bg-red-50 border-red-200' :
                a.prioridad === 'alta' ? 'bg-amber-50 border-amber-200' :
                'bg-yellow-50 border-yellow-200'
              }`}>
                <div>
                  <div className="font-medium text-sm">{a.productoNombre}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    SKU: {a.productoSKU} | CTRU crece {a.tasaCrecimientoCTRU.toFixed(1)}%/mes
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-3 text-xs">
                    <span>Hoy: <strong>{a.margenActual.toFixed(1)}%</strong></span>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <span>30d: <strong className={a.margen30d < 15 ? 'text-red-600' : 'text-green-600'}>{a.margen30d.toFixed(1)}%</strong></span>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <span>90d: <strong className={a.margen90d < 10 ? 'text-red-600' : 'text-amber-600'}>{a.margen90d.toFixed(1)}%</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SeccionExpandible>
      )}

      {/* REABASTECIMIENTO */}
      {reabastecimiento.length > 0 && (
        <SeccionExpandible
          id="reabastecimiento"
          titulo={`Reabastecimiento (${reabastecimiento.length} productos)`}
          icono={<ShoppingCart className="w-4 h-4" />}
          expandida={seccionExpandida === 'reabastecimiento'}
          onToggle={toggleSeccion}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="text-left py-2 px-2">Producto</th>
                  <th className="text-right py-2 px-2">Stock</th>
                  <th className="text-right py-2 px-2">Ventas/día</th>
                  <th className="text-right py-2 px-2">Días hasta stockout</th>
                  <th className="text-right py-2 px-2">Comprar antes de</th>
                  <th className="text-right py-2 px-2">Cantidad sugerida</th>
                  <th className="text-right py-2 px-2">Costo recompra</th>
                  <th className="text-center py-2 px-2">Urgencia</th>
                </tr>
              </thead>
              <tbody>
                {reabastecimiento.sort((a, b) => a.diasHastaStockout - b.diasHastaStockout).map(r => (
                  <tr key={r.productoId} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium">{r.productoNombre}</td>
                    <td className="py-2 px-2 text-right">{r.unidadesDisponibles}</td>
                    <td className="py-2 px-2 text-right">{r.ventasDiariasPromedio.toFixed(1)}</td>
                    <td className="py-2 px-2 text-right font-mono">
                      <span className={r.diasHastaStockout < 15 ? 'text-red-600 font-bold' : r.diasHastaStockout < 30 ? 'text-amber-600' : ''}>
                        {r.diasHastaStockout === Infinity ? '∞' : `${Math.round(r.diasHastaStockout)}d`}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-xs text-gray-500">
                      {r.fechaLimiteCompra.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="py-2 px-2 text-right">{r.cantidadSugerida}</td>
                    <td className="py-2 px-2 text-right font-medium">{formatCurrency(r.costoRecompraPEN)}</td>
                    <td className="py-2 px-2 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.urgencia === 'inmediata' ? 'bg-red-100 text-red-700' :
                        r.urgencia === 'proxima' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {r.urgencia}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SeccionExpandible>
      )}

      {/* TABLA DETALLADA */}
      <SeccionExpandible
        id="detalle"
        titulo="Detalle por Producto"
        icono={<Package className="w-4 h-4" />}
        expandida={seccionExpandida === 'detalle'}
        onToggle={toggleSeccion}
        badge={`${proyecciones.length} productos`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500">
                <th className="text-left py-2 px-2">Producto</th>
                <th className="text-right py-2 px-2">CTRU Actual</th>
                <th className="text-right py-2 px-2">CTRU {horizonte}d</th>
                <th className="text-right py-2 px-2">Var %</th>
                <th className="text-right py-2 px-2">Margen Proy.</th>
                <th className="text-right py-2 px-2">Precio Min (20%)</th>
                <th className="text-center py-2 px-2">Confianza</th>
              </tr>
            </thead>
            <tbody>
              {proyecciones.sort((a, b) => b.variacionPct - a.variacionPct).map(p => (
                <tr key={p.productoId} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-2 font-medium">{p.productoNombre}</td>
                  <td className="py-2 px-2 text-right font-mono">{formatCurrency(p.ctruActual)}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold">{formatCurrency(p.ctruProyectado)}</td>
                  <td className="py-2 px-2 text-right">
                    <span className={`inline-flex items-center gap-0.5 font-bold ${
                      p.variacionPct > 3 ? 'text-red-600' : p.variacionPct > 0 ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      {p.variacionPct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {p.variacionPct > 0 ? '+' : ''}{p.variacionPct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <span className={`font-bold ${
                      p.margenProyectado >= 20 ? 'text-green-600' : p.margenProyectado >= 10 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {p.margenProyectado.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right">{formatCurrency(p.precioMinMargen20)}</td>
                  <td className="py-2 px-2 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      p.confianza === 'alta' ? 'bg-green-100 text-green-700' :
                      p.confianza === 'media' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {p.confianza}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SeccionExpandible>

      {/* CONFIANZA */}
      <div className="text-center text-xs text-gray-400 pb-4">
        Proyecciones basadas en {dashboard.mesesDeHistorial} meses de historial |
        Confianza general: <span className={`font-medium ${
          dashboard.confianzaGeneral === 'alta' ? 'text-green-600' :
          dashboard.confianzaGeneral === 'media' ? 'text-amber-600' : 'text-gray-500'
        }`}>{dashboard.confianzaGeneral}</span> |
        Generado: {dashboard.fechaGeneracion.toLocaleTimeString('es-PE')}
      </div>
    </div>
  );
};

// ============================================
// Sub-componentes
// ============================================

const Header: React.FC<{ horizonte: 30 | 90; setHorizonte: (h: 30 | 90) => void }> = ({ horizonte, setHorizonte }) => (
  <div className="bg-gradient-to-r from-violet-600 to-indigo-700 rounded-xl p-6 text-white mb-2">
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <TrendingUp className="w-8 h-8 opacity-80" />
          <h1 className="text-xl md:text-2xl font-bold">Proyeccion de Costos</h1>
        </div>
        <p className="text-violet-200 text-sm">Estimaciones basadas en tendencias historicas del sistema</p>
      </div>
      <div className="flex items-center gap-2 bg-white/15 rounded-lg p-1">
        <button
          onClick={() => setHorizonte(30)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            horizonte === 30 ? 'bg-white text-violet-700 shadow' : 'text-white/80 hover:text-white'
          }`}
        >
          30 dias
        </button>
        <button
          onClick={() => setHorizonte(90)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            horizonte === 90 ? 'bg-white text-violet-700 shadow' : 'text-white/80 hover:text-white'
          }`}
        >
          90 dias
        </button>
      </div>
    </div>
  </div>
);

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  valor: string;
  subvalor: string;
  tendencia?: number;
  color?: 'red' | 'green' | 'amber';
}

const KPICard: React.FC<KPICardProps> = ({ icon, label, valor, subvalor, tendencia, color }) => (
  <Card className="p-3">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-gray-400">{icon}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
    <div className="text-lg font-bold text-gray-900">{valor}</div>
    <div className="flex items-center justify-between mt-0.5">
      <span className="text-xs text-gray-500">{subvalor}</span>
      {tendencia !== undefined && (
        <span className={`text-xs font-bold ${
          color === 'red' ? 'text-red-600' :
          color === 'green' ? 'text-green-600' :
          color === 'amber' ? 'text-amber-600' :
          tendencia > 0 ? 'text-red-500' : tendencia < 0 ? 'text-green-500' : 'text-gray-400'
        }`}>
          {tendencia > 0 ? '+' : ''}{tendencia.toFixed(1)}%
        </span>
      )}
    </div>
  </Card>
);

interface SeccionExpandibleProps {
  id: string;
  titulo: string;
  icono: React.ReactNode;
  expandida: boolean;
  onToggle: (id: string) => void;
  badge?: string;
  badgeColor?: 'red' | 'amber' | 'blue';
  children: React.ReactNode;
}

const SeccionExpandible: React.FC<SeccionExpandibleProps> = ({
  id, titulo, icono, expandida, onToggle, badge, badgeColor = 'blue', children
}) => (
  <Card className="overflow-hidden">
    <button
      onClick={() => onToggle(id)}
      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-primary-600">{icono}</span>
        <h3 className="font-semibold text-gray-900 text-sm">{titulo}</h3>
        {badge && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            badgeColor === 'red' ? 'bg-red-100 text-red-700' :
            badgeColor === 'amber' ? 'bg-amber-100 text-amber-700' :
            'bg-primary-100 text-primary-700'
          }`}>
            {badge}
          </span>
        )}
      </div>
      {expandida ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
    </button>
    {expandida && <div className="px-4 pb-4">{children}</div>}
  </Card>
);
