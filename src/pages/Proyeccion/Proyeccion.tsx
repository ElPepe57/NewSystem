import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, BarChart3, DollarSign,
  Package, RefreshCw, ChevronDown, ChevronUp, ShoppingCart,
  Target, Zap, ArrowRight, Minus
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Card } from '../../components/common';
import { useCTRUStore } from '../../store/ctruStore';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import { formatCurrency } from '../../utils/format';
import type { CTRUProductoDetalle, LoteProducto } from '../../store/ctruStore';

// ============================================
// Tipos locales — proyecciones calculadas en memoria
// ============================================

interface ProyeccionLocal {
  productoId: string;
  nombre: string;
  sku: string;
  ctruActual: number;
  ctruProyectado: number;
  variacionPct: number;
  margenActual: number;
  margenProyectado: number;
  precioVenta: number;
  precioMin20: number;
  tendenciaCompra: number;   // % cambio en precio compra
  tendenciaTC: number;       // % cambio en TC
  confianza: 'alta' | 'media' | 'baja';
  unidades: number;
}

interface EscenarioLocal {
  nombre: string;
  tcVar: number;
  precioVar: number;
  gagoVar: number;
  ctru: number;
  margen: number;
  prob: number;
}

interface DashLocal {
  ctruPromActual: number;
  ctruPromProyectado: number;
  variacion: number;
  tcActual: number;
  tcProyectado: number;
  gagoActual: number;
  gagoProyectado: number;
  alertasCriticas: number;
  alertasTotal: number;
}

// ============================================
// Helpers de cálculo puro (sin I/O)
// ============================================

function tendenciaDesdeCompras(lotes: LoteProducto[]): number {
  if (lotes.length < 2) return 0;
  const sorted = [...lotes].filter(l => l.costoUnitarioUSD > 0).sort((a, b) => {
    const fa = a.fecha?.getTime?.() ?? 0;
    const fb = b.fecha?.getTime?.() ?? 0;
    return fa - fb; // más antiguo primero
  });
  if (sorted.length < 2) return 0;
  const primero = sorted[0].costoUnitarioUSD;
  const ultimo = sorted[sorted.length - 1].costoUnitarioUSD;
  if (primero === 0) return 0;
  return ((ultimo - primero) / primero) / sorted.length; // % por compra
}

function tendenciaDesdeTC(lotes: LoteProducto[]): number {
  if (lotes.length < 2) return 0;
  const sorted = [...lotes].filter(l => l.tc > 0).sort((a, b) => {
    const fa = a.fecha?.getTime?.() ?? 0;
    const fb = b.fecha?.getTime?.() ?? 0;
    return fa - fb;
  });
  if (sorted.length < 2) return 0;
  const primero = sorted[0].tc;
  const ultimo = sorted[sorted.length - 1].tc;
  if (primero === 0) return 0;
  return ((ultimo - primero) / primero) / sorted.length;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ============================================
// Componente principal
// ============================================

export const Proyeccion: React.FC = () => {
  const { productosDetalle, historialMensual, historialGastos, loading: ctruLoading, fetchAll } = useCTRUStore();
  const productos = productosDetalle || [];

  const productosLN = useLineaFilter(productos, (p: CTRUProductoDetalle) => p.lineaNegocioId);

  const [horizonte, setHorizonte] = useState<30 | 90>(30);
  const [tcSlider, setTcSlider] = useState(0);
  const [seccionExpandida, setSeccionExpandida] = useState<string | null>('comparacion');

  useEffect(() => {
    if (!productos.length && !ctruLoading) fetchAll();
  }, [productos.length, ctruLoading, fetchAll]);

  // Calcular todo en memoria — sin queries a Firestore
  const { proyecciones, dashboard, escenariosPorProducto, alertas } = useMemo(() => {
    if (!productosLN.length) {
      return { proyecciones: [], dashboard: null, escenariosPorProducto: [], alertas: [] };
    }

    const periodos = horizonte === 30 ? 1 : 3;

    // TC actual: promedio de los últimos lotes
    const todosLotes = productosLN.flatMap(p => p.lotes || []).filter(l => l.tc > 0);
    const tcActual = todosLotes.length > 0
      ? todosLotes.reduce((s, l) => s + l.tc, 0) / todosLotes.length
      : 3.75;

    // GA/GO actual mensual: del historial de gastos
    const gastosRecientes = (historialGastos || []).slice(-3);
    const gagoActual = gastosRecientes.length > 0
      ? gastosRecientes.reduce((s, g) => s + (g.GA || 0) + (g.GO || 0), 0) / gastosRecientes.length
      : 0;

    // Proyecciones por producto
    const proys: ProyeccionLocal[] = productosLN.map(p => {
      const lotes = p.lotes || [];
      const tendCompra = tendenciaDesdeCompras(lotes);
      const tendTC = tendenciaDesdeTC(lotes);

      // Limitar tendencias a ±15% por periodo
      const factorCompra = 1 + clamp(tendCompra * periodos, -0.15, 0.15);
      const factorTC = 1 + clamp(tendTC * periodos, -0.15, 0.15);

      // CTRU proyectado: escalar las capas que dependen de compra y TC
      const costoCompraProy = p.costoCompraUSDProm * factorCompra * tcActual * factorTC;
      const costoCompraActual = p.costoCompraUSDProm * tcActual;
      const otrasCapas = p.ctruPromedio - (p.costoCompraUSDProm * (lotes.length > 0 ? lotes[0].tc : tcActual));
      const ctruProy = Math.max(costoCompraProy + Math.max(otrasCapas, 0), p.ctruPromedio * 0.7);

      const precioVenta = p.precioVentaProm || p.pricing?.precioActual || 0;
      const margenProy = precioVenta > 0 ? ((precioVenta - ctruProy) / precioVenta) * 100 : 0;
      const margenActual = p.margenNetoProm;

      return {
        productoId: p.productoId,
        nombre: p.productoNombre,
        sku: p.productoSKU,
        ctruActual: p.ctruPromedio,
        ctruProyectado: ctruProy,
        variacionPct: p.ctruPromedio > 0 ? ((ctruProy - p.ctruPromedio) / p.ctruPromedio) * 100 : 0,
        margenActual,
        margenProyectado: margenProy,
        precioVenta,
        precioMin20: ctruProy / 0.8,
        tendenciaCompra: tendCompra * 100,
        tendenciaTC: tendTC * 100,
        confianza: lotes.length >= 3 ? 'alta' : lotes.length >= 2 ? 'media' : 'baja',
        unidades: p.totalUnidades,
      };
    });

    // Dashboard resumen
    const totalUnidades = proys.reduce((s, p) => s + p.unidades, 0);
    const ctruPromActual = totalUnidades > 0
      ? proys.reduce((s, p) => s + p.ctruActual * p.unidades, 0) / totalUnidades : 0;
    const ctruPromProy = totalUnidades > 0
      ? proys.reduce((s, p) => s + p.ctruProyectado * p.unidades, 0) / totalUnidades : 0;

    const alertasList = proys.filter(p =>
      p.margenProyectado < 15 || p.variacionPct > 5 || p.margenProyectado < 0
    );

    const dash: DashLocal = {
      ctruPromActual,
      ctruPromProyectado: ctruPromProy,
      variacion: ctruPromActual > 0 ? ((ctruPromProy - ctruPromActual) / ctruPromActual) * 100 : 0,
      tcActual,
      tcProyectado: tcActual * (1 + clamp(tendenciaDesdeTC(todosLotes) * periodos, -0.1, 0.1)),
      gagoActual,
      gagoProyectado: gagoActual * (1 + 0.02 * periodos),
      alertasCriticas: proys.filter(p => p.margenProyectado < 0).length,
      alertasTotal: alertasList.length,
    };

    // Escenarios para top 5
    const top5 = [...proys].sort((a, b) => b.unidades - a.unidades).slice(0, 5);
    const escPorProd = top5.map(p => {
      const base = p.ctruProyectado;
      const pv = p.precioVenta;
      const scenarios: EscenarioLocal[] = [
        { nombre: 'Optimista', tcVar: -5, precioVar: -3, gagoVar: 0, prob: 0.2,
          ctru: base * 0.95 * 0.97, margen: pv > 0 ? ((pv - base * 0.95 * 0.97) / pv) * 100 : 0 },
        { nombre: 'Base', tcVar: 0, precioVar: 0, gagoVar: 0, prob: 0.6,
          ctru: base, margen: pv > 0 ? ((pv - base) / pv) * 100 : 0 },
        { nombre: 'Pesimista', tcVar: 10, precioVar: 5, gagoVar: 10, prob: 0.2,
          ctru: base * 1.10 * 1.05 * 1.02, margen: pv > 0 ? ((pv - base * 1.10 * 1.05 * 1.02) / pv) * 100 : 0 },
      ];
      return { productoId: p.productoId, nombre: p.nombre, ctruActual: p.ctruActual, escenarios: scenarios };
    });

    return { proyecciones: proys, dashboard: dash, escenariosPorProducto: escPorProd, alertas: alertasList };
  }, [productosLN, horizonte, historialGastos]);

  const toggleSeccion = (id: string) => {
    setSeccionExpandida(prev => prev === id ? null : id);
  };

  if (ctruLoading) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Header horizonte={horizonte} setHorizonte={setHorizonte} />
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
          <span className="ml-3 text-gray-500">Cargando datos del sistema...</span>
        </div>
      </div>
    );
  }

  if (!dashboard || !productosLN.length) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Header horizonte={horizonte} setHorizonte={setHorizonte} />
        <Card className="p-8 text-center text-gray-500">
          No hay datos suficientes para generar proyecciones. Necesitas al menos 1 producto con historial de compras.
        </Card>
      </div>
    );
  }

  // Datos para gráfica comparación
  const comparacionData = proyecciones
    .filter(p => p.ctruActual > 0)
    .map(p => ({
      nombre: p.nombre.length > 18 ? p.nombre.slice(0, 18) + '...' : p.nombre,
      actual: Math.round(p.ctruActual * 100) / 100,
      proyectado: Math.round(p.ctruProyectado * 100) / 100,
    }))
    .sort((a, b) => b.proyectado - a.proyectado);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <Header horizonte={horizonte} setHorizonte={setHorizonte} />

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={<DollarSign className="w-5 h-5" />} label="CTRU Promedio"
          valor={formatCurrency(dashboard.ctruPromActual)}
          subvalor={`→ ${formatCurrency(dashboard.ctruPromProyectado)} (${horizonte}d)`}
          tendencia={dashboard.variacion} />
        <KPICard icon={<TrendingUp className="w-5 h-5" />} label="TC Promedio"
          valor={dashboard.tcActual.toFixed(2)}
          subvalor={`→ ${dashboard.tcProyectado.toFixed(2)} (${horizonte}d)`}
          tendencia={((dashboard.tcProyectado - dashboard.tcActual) / dashboard.tcActual) * 100} />
        <KPICard icon={<BarChart3 className="w-5 h-5" />} label="GA/GO Mensual"
          valor={formatCurrency(dashboard.gagoActual)}
          subvalor={`→ ${formatCurrency(dashboard.gagoProyectado)}`}
          tendencia={dashboard.gagoActual > 0 ? ((dashboard.gagoProyectado - dashboard.gagoActual) / dashboard.gagoActual) * 100 : 0} />
        <KPICard icon={<AlertTriangle className="w-5 h-5" />} label="Alertas"
          valor={`${dashboard.alertasTotal}`}
          subvalor={`${dashboard.alertasCriticas} criticas`}
          color={dashboard.alertasCriticas > 0 ? 'red' : dashboard.alertasTotal > 0 ? 'amber' : 'green'} />
      </div>

      {/* SLIDER TC */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" /> Sensibilidad al Tipo de Cambio
          </h3>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 w-12">-10%</span>
          <input type="range" min={-10} max={10} step={1} value={tcSlider}
            onChange={(e) => setTcSlider(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600" />
          <span className="text-xs text-gray-500 w-12 text-right">+10%</span>
        </div>
        <div className="text-center mt-2">
          <span className={`text-lg font-bold ${tcSlider > 0 ? 'text-red-600' : tcSlider < 0 ? 'text-green-600' : 'text-gray-700'}`}>
            TC {tcSlider >= 0 ? '+' : ''}{tcSlider}% = {(dashboard.tcActual * (1 + tcSlider / 100)).toFixed(2)}
          </span>
          <span className="text-gray-500 text-sm ml-2">(actual: {dashboard.tcActual.toFixed(2)})</span>
        </div>
        {tcSlider !== 0 && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {proyecciones.slice(0, 4).map(p => {
              const impacto = p.ctruActual * (tcSlider / 100) * 0.6; // ~60% del CTRU depende del TC
              return (
                <div key={p.productoId} className="bg-gray-50 rounded p-2">
                  <div className="font-medium truncate">{p.nombre}</div>
                  <div className={impacto > 0 ? 'text-red-600' : 'text-green-600'}>
                    {impacto > 0 ? '+' : ''}{formatCurrency(impacto)}/ud
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* GRÁFICA CTRU ACTUAL vs PROYECTADO */}
      {comparacionData.length > 0 && (
        <Seccion id="comparacion" titulo={`CTRU Actual vs Proyectado (${horizonte}d)`}
          icono={<BarChart3 className="w-4 h-4" />} expandida={seccionExpandida === 'comparacion'}
          onToggle={toggleSeccion} badge={`${comparacionData.length} productos`}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparacionData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={(v) => `S/${v}`} fontSize={11} />
                <YAxis type="category" dataKey="nombre" width={130} fontSize={11} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="actual" name="CTRU Actual" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={14} />
                <Bar dataKey="proyectado" name={`Proyectado ${horizonte}d`} fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Seccion>
      )}

      {/* ESCENARIOS */}
      {escenariosPorProducto.length > 0 && (
        <Seccion id="escenarios" titulo="Escenarios por Producto" icono={<Target className="w-4 h-4" />}
          expandida={seccionExpandida === 'escenarios'} onToggle={toggleSeccion}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {escenariosPorProducto.map(ep => (
              <Card key={ep.productoId} className="p-3 bg-gray-50">
                <h4 className="font-medium text-sm text-gray-900 mb-2 truncate">{ep.nombre}</h4>
                <div className="space-y-1.5">
                  {ep.escenarios.map(e => (
                    <div key={e.nombre} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${
                      e.nombre === 'Optimista' ? 'bg-green-50' : e.nombre === 'Pesimista' ? 'bg-red-50' : 'bg-blue-50'
                    }`}>
                      <div className="flex items-center gap-2">
                        {e.nombre === 'Optimista' ? <TrendingDown className="w-3 h-3 text-green-600" /> :
                         e.nombre === 'Pesimista' ? <TrendingUp className="w-3 h-3 text-red-600" /> :
                         <Minus className="w-3 h-3 text-blue-600" />}
                        <span className="font-medium">{e.nombre}</span>
                        <span className="text-gray-400">({(e.prob * 100).toFixed(0)}%)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono">{formatCurrency(e.ctru)}</span>
                        <span className={`font-bold ${e.margen >= 20 ? 'text-green-600' : e.margen >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                          {e.margen.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-gray-400">CTRU actual: {formatCurrency(ep.ctruActual)}</div>
              </Card>
            ))}
          </div>
        </Seccion>
      )}

      {/* ALERTAS */}
      {alertas.length > 0 && (
        <Seccion id="alertas" titulo={`Alertas de Margen (${alertas.length})`}
          icono={<AlertTriangle className="w-4 h-4" />} expandida={seccionExpandida === 'alertas'}
          onToggle={toggleSeccion} badgeColor="red" badge={`${dashboard.alertasCriticas} criticas`}>
          <div className="space-y-2">
            {alertas.map(a => (
              <div key={a.productoId} className={`flex items-center justify-between p-3 rounded-lg border ${
                a.margenProyectado < 0 ? 'bg-red-50 border-red-200' :
                a.margenProyectado < 15 ? 'bg-amber-50 border-amber-200' :
                'bg-yellow-50 border-yellow-200'
              }`}>
                <div>
                  <div className="font-medium text-sm">{a.nombre}</div>
                  <div className="text-xs text-gray-500">SKU: {a.sku} | CTRU {a.variacionPct > 0 ? '+' : ''}{a.variacionPct.toFixed(1)}%</div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span>Hoy: <strong>{a.margenActual.toFixed(1)}%</strong></span>
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                  <span className={a.margenProyectado < 10 ? 'text-red-600 font-bold' : 'text-amber-600 font-bold'}>
                    {horizonte}d: {a.margenProyectado.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Seccion>
      )}

      {/* TABLA DETALLADA */}
      <Seccion id="detalle" titulo="Detalle por Producto" icono={<Package className="w-4 h-4" />}
        expandida={seccionExpandida === 'detalle'} onToggle={toggleSeccion}
        badge={`${proyecciones.length} productos`}>
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
                  <td className="py-2 px-2 font-medium">{p.nombre}</td>
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
                    <span className={`font-bold ${p.margenProyectado >= 20 ? 'text-green-600' : p.margenProyectado >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                      {p.margenProyectado.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right">{formatCurrency(p.precioMin20)}</td>
                  <td className="py-2 px-2 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      p.confianza === 'alta' ? 'bg-green-100 text-green-700' :
                      p.confianza === 'media' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{p.confianza}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
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
        <button onClick={() => setHorizonte(30)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${horizonte === 30 ? 'bg-white text-violet-700 shadow' : 'text-white/80 hover:text-white'}`}>
          30 dias
        </button>
        <button onClick={() => setHorizonte(90)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${horizonte === 90 ? 'bg-white text-violet-700 shadow' : 'text-white/80 hover:text-white'}`}>
          90 dias
        </button>
      </div>
    </div>
  </div>
);

const KPICard: React.FC<{
  icon: React.ReactNode; label: string; valor: string; subvalor: string;
  tendencia?: number; color?: 'red' | 'green' | 'amber';
}> = ({ icon, label, valor, subvalor, tendencia, color }) => (
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
          color === 'red' ? 'text-red-600' : color === 'green' ? 'text-green-600' : color === 'amber' ? 'text-amber-600' :
          tendencia > 0 ? 'text-red-500' : tendencia < 0 ? 'text-green-500' : 'text-gray-400'
        }`}>{tendencia > 0 ? '+' : ''}{tendencia.toFixed(1)}%</span>
      )}
    </div>
  </Card>
);

const Seccion: React.FC<{
  id: string; titulo: string; icono: React.ReactNode; expandida: boolean;
  onToggle: (id: string) => void; badge?: string; badgeColor?: 'red' | 'amber' | 'blue';
  children: React.ReactNode;
}> = ({ id, titulo, icono, expandida, onToggle, badge, badgeColor = 'blue', children }) => (
  <Card className="overflow-hidden">
    <button onClick={() => onToggle(id)}
      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-primary-600">{icono}</span>
        <h3 className="font-semibold text-gray-900 text-sm">{titulo}</h3>
        {badge && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            badgeColor === 'red' ? 'bg-red-100 text-red-700' : badgeColor === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-primary-100 text-primary-700'
          }`}>{badge}</span>
        )}
      </div>
      {expandida ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
    </button>
    {expandida && <div className="px-4 pb-4">{children}</div>}
  </Card>
);
