import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, BarChart3, DollarSign,
  Package, RefreshCw, ChevronDown, ChevronUp, ShoppingCart, Check,
  Target, Zap, ArrowRight, ArrowUp, Minus, Eye
} from 'lucide-react';
import {
  ComposedChart, BarChart, Bar, LineChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import { Card } from '../../components/common';
import { useCTRUStore } from '../../store/ctruStore';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import { formatCurrency } from '../../utils/format';
import type {
  CTRUProductoDetalle, LoteProducto, HistorialCostosMes,
  HistorialGastosEntry, VentaProductoDetalle
} from '../../store/ctruStore';

// ============================================
// Helpers puros
// ============================================

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function tendencia(valores: number[]): number {
  const valid = valores.filter(v => v > 0);
  if (valid.length < 2) return 0;
  return ((valid[valid.length - 1] - valid[0]) / valid[0]) / (valid.length - 1);
}

function promedioMovil(valores: number[], n = 3): number {
  const valid = valores.filter(v => v > 0);
  if (!valid.length) return 0;
  const slice = valid.slice(-n);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

function mesLabel(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' });
}

// ============================================
// Tipos de proyección calculada
// ============================================

interface ProyProducto {
  id: string; nombre: string; sku: string;
  ctruActual: number; ctruProy: number; varPct: number;
  margenActual: number; margenProy: number;
  precioVenta: number; precioMin20: number;
  tendCompra: number; unidades: number;
  confianza: 'alta' | 'media' | 'baja';
  accion: 'comprar' | 'subir_precio' | 'revisar' | 'mantener';
  sparkline: number[];
}

// ============================================
// Componente principal
// ============================================

export const Proyeccion: React.FC = () => {
  const { productosDetalle, historialMensual, historialGastos, resumen, loading: ctruLoading, fetchAll } = useCTRUStore();
  const productos = productosDetalle || [];
  const productosLN = useLineaFilter(productos, (p: CTRUProductoDetalle) => p.lineaNegocioId);

  const [horizonte, setHorizonte] = useState<30 | 90>(30);
  const [tcSlider, setTcSlider] = useState(0);
  const [expandido, setExpandido] = useState<string | null>('timeline');

  useEffect(() => {
    if (!productos.length && !ctruLoading) fetchAll();
  }, [productos.length, ctruLoading, fetchAll]);

  const periodos = horizonte === 30 ? 1 : 3;

  // ============================================
  // CÁLCULOS EN MEMORIA
  // ============================================

  // 1. Timeline data (histórico + proyectado)
  const timelineData = useMemo(() => {
    const hist = (historialMensual || []).slice(-6);
    if (!hist.length) return [];

    const ctruValues = hist.map(h => h.ctruPromedio);
    const precioValues = hist.map(h => h.precioVentaProm);
    const margenValues = hist.map(h => h.margenProm);
    const ventasValues = hist.map(h => h.ventasCount);

    const trendCTRU = tendencia(ctruValues);
    const trendPrecio = tendencia(precioValues.filter(v => v > 0));

    const lastCTRU = promedioMovil(ctruValues);
    const lastPrecio = promedioMovil(precioValues);
    const lastMargen = promedioMovil(margenValues);
    const lastVentas = promedioMovil(ventasValues);

    // Meses reales
    const data = hist.map(h => ({
      label: h.label,
      ctru: Math.round(h.ctruPromedio * 100) / 100,
      precio: h.precioVentaProm > 0 ? Math.round(h.precioVentaProm * 100) / 100 : null,
      margen: h.margenProm > 0 ? Math.round(h.margenProm * 10) / 10 : null,
      ventas: h.ventasCount,
      montoPEN: h.ventasCount * (h.precioVentaProm || 0),
      tipo: 'real' as const,
      bandaSup: null as number | null,
      bandaInf: null as number | null,
      ctruProy: null as number | null,
      precioProy: null as number | null,
      ventasProy: null as number | null,
      montoProy: null as number | null,
    }));

    // Meses proyectados
    for (let i = 1; i <= periodos; i++) {
      const factor = 1 + clamp(trendCTRU * i, -0.15, 0.15);
      const factorPrecio = 1 + clamp(trendPrecio * i, -0.10, 0.10);
      const incertidumbre = 0.03 * i; // ±3% por periodo

      const ctruProy = lastCTRU * factor;
      const precioProy = lastPrecio * factorPrecio;
      const ventasProy = Math.round(lastVentas * (1 + 0.02 * i));

      data.push({
        label: mesLabel(i),
        ctru: null as any,
        precio: null,
        margen: null,
        ventas: null as any,
        montoPEN: null as any,
        tipo: 'proyectado',
        bandaSup: Math.round(ctruProy * (1 + incertidumbre) * 100) / 100,
        bandaInf: Math.round(ctruProy * (1 - incertidumbre) * 100) / 100,
        ctruProy: Math.round(ctruProy * 100) / 100,
        precioProy: Math.round(precioProy * 100) / 100,
        ventasProy,
        montoProy: Math.round(ventasProy * precioProy * 100) / 100,
      });
    }

    // Punto de conexión (último real = inicio proyección)
    if (data.length > hist.length) {
      const lastReal = data[hist.length - 1];
      data[hist.length].ctruProy = lastReal.ctru;
      data[hist.length].precioProy = lastReal.precio;
      // Insertar referencia
      data[hist.length - 1] = {
        ...lastReal,
        ctruProy: lastReal.ctru,
        precioProy: lastReal.precio,
        bandaSup: lastReal.ctru,
        bandaInf: lastReal.ctru,
      };
    }

    return data;
  }, [historialMensual, periodos]);

  // 2. Proyección por producto
  const proyProductos = useMemo((): ProyProducto[] => {
    if (!productosLN.length) return [];

    return productosLN.map(p => {
      const lotes = (p.lotes || []).filter(l => l.costoUnitarioUSD > 0);
      const precios = lotes.map(l => l.costoUnitarioPEN);
      const trendCompra = tendencia(precios);
      const factor = 1 + clamp(trendCompra * periodos, -0.15, 0.15);

      const ctruProy = p.ctruPromedio * factor;
      const pv = p.precioVentaProm || p.pricing?.precioActual || 0;
      const margenProy = pv > 0 ? ((pv - ctruProy - (p.gastoGVGDProm || 0)) / pv) * 100 : 0;

      let accion: ProyProducto['accion'] = 'mantener';
      if (margenProy < 10 && pv > 0) accion = 'subir_precio';
      else if (p.totalUnidades < 5 && p.ventasCount > 0) accion = 'comprar';
      else if (margenProy < 20 || trendCompra > 0.05) accion = 'revisar';

      return {
        id: p.productoId,
        nombre: p.productoNombre,
        sku: p.productoSKU,
        ctruActual: p.ctruPromedio,
        ctruProy,
        varPct: p.ctruPromedio > 0 ? ((ctruProy - p.ctruPromedio) / p.ctruPromedio) * 100 : 0,
        margenActual: p.margenNetoProm,
        margenProy,
        precioVenta: pv,
        precioMin20: (ctruProy + (p.gastoGVGDProm || 0)) / 0.8,
        tendCompra: trendCompra * 100,
        unidades: p.totalUnidades,
        confianza: lotes.length >= 3 ? 'alta' : lotes.length >= 2 ? 'media' : 'baja',
        accion,
        sparkline: precios.slice(-6),
      };
    });
  }, [productosLN, periodos]);

  // 3. Ventas proyectadas por mes
  const ventasData = useMemo(() => {
    const allVentas = productosLN.flatMap(p => (p.ventasDetalle || []).filter(v => v.fecha));
    if (!allVentas.length) return [];

    // Agrupar por mes
    const porMes = new Map<string, { unidades: number; monto: number }>();
    allVentas.forEach(v => {
      const f = v.fecha instanceof Date ? v.fecha : (v.fecha as any)?.toDate?.();
      if (!f) return;
      const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
      const label = f.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' });
      const existing = porMes.get(key) || { unidades: 0, monto: 0 };
      existing.unidades += v.cantidad || 1;
      existing.monto += (v.cantidad || 1) * (v.precioUnitario || 0);
      porMes.set(key, existing);
    });

    const entries = [...porMes.entries()].sort().slice(-4);
    const data = entries.map(([key, val]) => {
      const [y, m] = key.split('-');
      const d = new Date(+y, +m - 1);
      return {
        label: d.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' }),
        unidades: val.unidades,
        monto: Math.round(val.monto),
        tipo: 'real' as const,
      };
    });

    // Proyectar
    const avgUnidades = promedioMovil(data.map(d => d.unidades), 3);
    const avgMonto = promedioMovil(data.map(d => d.monto), 3);
    const trendVentas = tendencia(data.map(d => d.monto));

    for (let i = 1; i <= periodos; i++) {
      const factor = 1 + clamp(trendVentas * i, -0.2, 0.2);
      data.push({
        label: mesLabel(i),
        unidades: Math.round(avgUnidades * factor),
        monto: Math.round(avgMonto * factor),
        tipo: 'proyectado',
      });
    }

    return data;
  }, [productosLN, periodos]);

  // 4. Dashboard KPIs
  const dash = useMemo(() => {
    if (!proyProductos.length) return null;
    const totalUd = proyProductos.reduce((s, p) => s + p.unidades, 0);
    const ctruAct = totalUd > 0 ? proyProductos.reduce((s, p) => s + p.ctruActual * p.unidades, 0) / totalUd : 0;
    const ctruProy = totalUd > 0 ? proyProductos.reduce((s, p) => s + p.ctruProy * p.unidades, 0) / totalUd : 0;
    const margenAct = totalUd > 0 ? proyProductos.reduce((s, p) => s + p.margenActual * p.unidades, 0) / totalUd : 0;
    const margenProy = totalUd > 0 ? proyProductos.reduce((s, p) => s + p.margenProy * p.unidades, 0) / totalUd : 0;

    const ventasMes = ventasData.filter(v => v.tipo === 'real');
    const ventasProy = ventasData.filter(v => v.tipo === 'proyectado');
    const montoActual = ventasMes.length > 0 ? ventasMes[ventasMes.length - 1].monto : 0;
    const montoProy = ventasProy.length > 0 ? ventasProy[ventasProy.length - 1].monto : 0;

    const alertas = proyProductos.filter(p => p.margenProy < 15 || p.varPct > 5);

    return {
      ctruAct, ctruProy,
      ctruVar: ctruAct > 0 ? ((ctruProy - ctruAct) / ctruAct) * 100 : 0,
      margenAct, margenProy,
      ventasActual: montoActual, ventasProy: montoProy,
      ventasVar: montoActual > 0 ? ((montoProy - montoActual) / montoActual) * 100 : 0,
      alertas: alertas.length,
      criticas: proyProductos.filter(p => p.margenProy < 0).length,
    };
  }, [proyProductos, ventasData]);

  // 5. Escenarios agregados
  const escenarios = useMemo(() => {
    if (!dash) return [];
    const configs = [
      { nombre: 'Optimista', tcVar: -5, precioVar: -3, gagoVar: 0, prob: 20, color: 'green' },
      { nombre: 'Base', tcVar: 0, precioVar: 0, gagoVar: 0, prob: 60, color: 'blue' },
      { nombre: 'Pesimista', tcVar: 10, precioVar: 5, gagoVar: 10, prob: 20, color: 'red' },
    ];
    return configs.map(c => {
      const factorCosto = (1 + c.tcVar / 100) * (1 + c.precioVar / 100);
      const ctru = dash.ctruProy * factorCosto;
      const ventasProm = dash.ventasProy || dash.ventasActual;
      // Asumimos ~25% del precio es margen base
      const precioBase = dash.ctruAct * 1.35;
      const margen = precioBase > 0 ? ((precioBase - ctru) / precioBase) * 100 : 0;
      const impacto = (ctru - dash.ctruProy) * (ventasProm / (precioBase || 1));
      return { ...c, ctru, margen, impactoMensual: impacto };
    });
  }, [dash]);

  const toggle = (id: string) => setExpandido(prev => prev === id ? null : id);

  // ============================================
  // RENDER
  // ============================================

  if (ctruLoading) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <HeroHeader horizonte={horizonte} setHorizonte={setHorizonte} />
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
          <span className="ml-3 text-gray-500">Cargando datos...</span>
        </div>
      </div>
    );
  }

  if (!dash || !productosLN.length) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <HeroHeader horizonte={horizonte} setHorizonte={setHorizonte} />
        <Card className="p-8 text-center text-gray-500">
          No hay datos suficientes para generar proyecciones.
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <HeroHeader horizonte={horizonte} setHorizonte={setHorizonte} />

      {/* ─── KPI CARDS ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={<DollarSign className="w-4 h-4" />} label="CTRU Promedio"
          valor={formatCurrency(dash.ctruAct)} sub={`→ ${formatCurrency(dash.ctruProy)}`}
          trend={dash.ctruVar} invertColor sparkData={resumen?.tendenciaCTRU} />
        <KPICard icon={<TrendingUp className="w-4 h-4" />} label={`Margen ${horizonte}d`}
          valor={`${dash.margenAct.toFixed(1)}%`} sub={`→ ${dash.margenProy.toFixed(1)}%`}
          trend={dash.margenProy - dash.margenAct} sparkData={resumen?.tendenciaMargen} />
        <KPICard icon={<ShoppingCart className="w-4 h-4" />} label="Ventas Proy."
          valor={formatCurrency(dash.ventasProy || dash.ventasActual)}
          sub={dash.ventasActual > 0 ? `actual: ${formatCurrency(dash.ventasActual)}` : 'sin historial'}
          trend={dash.ventasVar} />
        <KPICard icon={<AlertTriangle className="w-4 h-4" />} label="Alertas"
          valor={`${dash.alertas}`} sub={`${dash.criticas} críticas`}
          color={dash.criticas > 0 ? 'red' : dash.alertas > 0 ? 'amber' : 'green'} />
      </div>

      {/* ─── GRÁFICA TIMELINE: CTRU + PRECIO + BANDA ─── */}
      {timelineData.length > 0 && (
        <Seccion id="timeline" titulo={`Evolución y Proyección CTRU (${horizonte}d)`}
          icono={<BarChart3 className="w-4 h-4" />} abierta={expandido === 'timeline'} onToggle={toggle}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="bandaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={v => `S/${v}`} />
                <Tooltip formatter={(v: number) => v ? formatCurrency(v) : '-'} />
                {/* Banda de incertidumbre */}
                <Area dataKey="bandaSup" stroke="none" fill="url(#bandaGrad)" connectNulls={false} />
                <Area dataKey="bandaInf" stroke="none" fill="white" connectNulls={false} />
                {/* CTRU real */}
                <Line dataKey="ctru" name="CTRU Real" stroke="#6366f1" strokeWidth={2.5}
                  dot={{ r: 3, fill: '#6366f1' }} connectNulls={false} />
                {/* CTRU proyectado */}
                <Line dataKey="ctruProy" name={`CTRU Proy. ${horizonte}d`} stroke="#6366f1"
                  strokeWidth={2} strokeDasharray="6 3" dot={{ r: 4, fill: '#6366f1', stroke: 'white', strokeWidth: 2 }}
                  connectNulls={false} />
                {/* Precio venta real */}
                <Line dataKey="precio" name="Precio Venta" stroke="#10b981" strokeWidth={2}
                  dot={false} connectNulls={false} />
                {/* Precio venta proyectado */}
                <Line dataKey="precioProy" name="Precio Proy." stroke="#10b981" strokeWidth={1.5}
                  strokeDasharray="4 3" dot={false} connectNulls={false} />
                <Legend />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400 justify-center">
            <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-indigo-500 inline-block" /> CTRU real</span>
            <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-indigo-500 inline-block border-dashed border-b" /> CTRU proyectado</span>
            <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-emerald-500 inline-block" /> Precio venta</span>
            <span className="flex items-center gap-1"><span className="w-4 h-2 bg-indigo-100 inline-block rounded" /> Incertidumbre</span>
          </div>
        </Seccion>
      )}

      {/* ─── GRÁFICA VENTAS PROYECTADAS ─── */}
      {ventasData.length > 0 && (
        <Seccion id="ventas" titulo={`Proyección de Ventas (${horizonte}d)`}
          icono={<ShoppingCart className="w-4 h-4" />} abierta={expandido === 'ventas'} onToggle={toggle}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ventasData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis yAxisId="left" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" fontSize={11} tickFormatter={v => `S/${v}`} />
                <Tooltip formatter={(v: number, name: string) => [name === 'monto' || name === 'montoProy' ? formatCurrency(v) : v, name]} />
                <Bar yAxisId="left" dataKey="unidades" name="Unidades" radius={[4, 4, 0, 0]} barSize={24}>
                  {ventasData.map((d, i) => (
                    <Cell key={i} fill={d.tipo === 'real' ? '#3b82f6' : '#93c5fd'} fillOpacity={d.tipo === 'real' ? 0.85 : 0.5}
                      stroke={d.tipo === 'proyectado' ? '#3b82f6' : 'none'} strokeWidth={d.tipo === 'proyectado' ? 1.5 : 0}
                      strokeDasharray={d.tipo === 'proyectado' ? '4 2' : ''} />
                  ))}
                </Bar>
                <Line yAxisId="right" dataKey="monto" name="Monto (S/)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Seccion>
      )}

      {/* ─── ESCENARIOS ─── */}
      <Seccion id="escenarios" titulo="Escenarios de Costos" icono={<Target className="w-4 h-4" />}
        abierta={expandido === 'escenarios'} onToggle={toggle}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {escenarios.map(e => (
            <div key={e.nombre} className={`rounded-xl p-4 border-l-4 ${
              e.color === 'green' ? 'border-green-500 bg-green-50/50' :
              e.color === 'red' ? 'border-red-500 bg-red-50/50' :
              'border-blue-500 bg-blue-50/50'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {e.color === 'green' ? <TrendingDown className="w-4 h-4 text-green-600" /> :
                   e.color === 'red' ? <TrendingUp className="w-4 h-4 text-red-600" /> :
                   <Minus className="w-4 h-4 text-blue-600" />}
                  <span className="font-bold text-sm">{e.nombre}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  e.color === 'green' ? 'bg-green-100 text-green-700' :
                  e.color === 'red' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>{e.prob}%</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">CTRU</span>
                  <span className="font-mono font-bold">{formatCurrency(e.ctru)}</span>
                </div>
                {/* Medidor visual de margen */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Margen</span>
                    <span className={`font-bold ${e.margen >= 20 ? 'text-green-600' : e.margen >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                      {e.margen.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                      e.margen >= 25 ? 'bg-green-500' : e.margen >= 15 ? 'bg-emerald-400' :
                      e.margen >= 5 ? 'bg-amber-400' : 'bg-red-500'
                    }`} style={{ width: `${clamp(e.margen * 2.5, 0, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-300 mt-0.5">
                    <span>0%</span><span>20%</span><span>40%</span>
                  </div>
                </div>
                <div className="text-xs text-gray-400 pt-1 border-t">
                  TC: {e.tcVar >= 0 ? '+' : ''}{e.tcVar}% | Proveedor: {e.precioVar >= 0 ? '+' : ''}{e.precioVar}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </Seccion>

      {/* ─── SLIDER SENSIBILIDAD TC ─── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-amber-500" /> Sensibilidad al Tipo de Cambio
          </h3>
          <span className={`text-lg font-bold ${tcSlider > 0 ? 'text-red-600' : tcSlider < 0 ? 'text-green-600' : 'text-gray-600'}`}>
            TC {tcSlider >= 0 ? '+' : ''}{tcSlider}%
          </span>
        </div>
        <input type="range" min={-10} max={10} step={1} value={tcSlider}
          onChange={e => setTcSlider(+e.target.value)}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600" />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>-10%</span><span>0%</span><span>+10%</span></div>
        {tcSlider !== 0 && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {proyProductos.slice(0, 8).map(p => {
              const impacto = p.ctruActual * (tcSlider / 100) * 0.6;
              const margenNuevo = p.precioVenta > 0 ? ((p.precioVenta - p.ctruActual - impacto) / p.precioVenta) * 100 : 0;
              return (
                <div key={p.id} className="bg-gray-50 rounded-lg p-2">
                  <div className="font-medium truncate text-gray-700">{p.nombre}</div>
                  <div className="flex justify-between mt-1">
                    <span className={impacto > 0 ? 'text-red-600' : 'text-green-600'}>
                      {impacto > 0 ? '+' : ''}{formatCurrency(impacto)}/ud
                    </span>
                    <span className={`font-bold ${margenNuevo >= 20 ? 'text-green-600' : margenNuevo >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                      {margenNuevo.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ─── ALERTAS ─── */}
      {dash.alertas > 0 && (
        <Seccion id="alertas" titulo={`Alertas de Margen (${dash.alertas})`}
          icono={<AlertTriangle className="w-4 h-4" />} abierta={expandido === 'alertas'} onToggle={toggle}
          badge={dash.criticas > 0 ? `${dash.criticas} criticas` : undefined} badgeColor="red">
          <div className="space-y-2">
            {proyProductos.filter(p => p.margenProy < 15 || p.varPct > 5).sort((a, b) => a.margenProy - b.margenProy).map(p => (
              <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                p.margenProy < 0 ? 'bg-red-50 border-red-200' : p.margenProy < 15 ? 'bg-amber-50 border-amber-200' : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div>
                  <span className="font-medium text-sm">{p.nombre}</span>
                  <span className="text-xs text-gray-400 ml-2">{p.sku}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span>Hoy: <strong>{p.margenActual.toFixed(1)}%</strong></span>
                  <ArrowRight className="w-3 h-3 text-gray-300" />
                  <span className={`font-bold ${p.margenProy < 10 ? 'text-red-600' : 'text-amber-600'}`}>
                    {horizonte}d: {p.margenProy.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Seccion>
      )}

      {/* ─── TABLA DETALLADA ─── */}
      <Seccion id="detalle" titulo="Detalle por Producto" icono={<Package className="w-4 h-4" />}
        abierta={expandido === 'detalle'} onToggle={toggle} badge={`${proyProductos.length} productos`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-500">
                <th className="text-left py-2 px-2">Producto</th>
                <th className="text-center py-2 px-2 w-20">Tendencia</th>
                <th className="text-right py-2 px-2">CTRU Actual</th>
                <th className="text-right py-2 px-2">CTRU {horizonte}d</th>
                <th className="text-right py-2 px-2">Var</th>
                <th className="text-right py-2 px-2">Margen Proy.</th>
                <th className="text-right py-2 px-2">Precio Min</th>
                <th className="text-center py-2 px-2">Confianza</th>
                <th className="text-center py-2 px-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {proyProductos.sort((a, b) => a.margenProy - b.margenProy).map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-2">
                    <div className="font-medium text-gray-900">{p.nombre}</div>
                    <div className="text-[10px] text-gray-400">{p.sku} · {p.unidades} uds</div>
                  </td>
                  <td className="py-2 px-2">
                    {p.sparkline.length >= 2 ? (
                      <ResponsiveContainer width={70} height={24}>
                        <LineChart data={p.sparkline.map((v, i) => ({ v, i }))}>
                          <Line dataKey="v" stroke={p.varPct > 3 ? '#ef4444' : p.varPct > 0 ? '#f59e0b' : '#22c55e'}
                            strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="py-2 px-2 text-right font-mono">{formatCurrency(p.ctruActual)}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold">{formatCurrency(p.ctruProy)}</td>
                  <td className="py-2 px-2 text-right">
                    <span className={`inline-flex items-center gap-0.5 font-bold text-xs ${
                      p.varPct > 3 ? 'text-red-600' : p.varPct > 0 ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      {p.varPct > 0.5 ? <TrendingUp className="w-3 h-3" /> : p.varPct < -0.5 ? <TrendingDown className="w-3 h-3" /> : null}
                      {p.varPct > 0 ? '+' : ''}{p.varPct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <span className={`font-bold ${p.margenProy >= 20 ? 'text-green-600' : p.margenProy >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                      {p.margenProy.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right text-xs">{formatCurrency(p.precioMin20)}</td>
                  <td className="py-2 px-2 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      p.confianza === 'alta' ? 'bg-green-100 text-green-700' :
                      p.confianza === 'media' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                    }`}>{p.confianza}</span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      p.accion === 'subir_precio' ? 'bg-red-100 text-red-700' :
                      p.accion === 'comprar' ? 'bg-blue-100 text-blue-700' :
                      p.accion === 'revisar' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {p.accion === 'subir_precio' ? <><ArrowUp className="w-3 h-3" />Subir precio</> :
                       p.accion === 'comprar' ? <><ShoppingCart className="w-3 h-3" />Comprar</> :
                       p.accion === 'revisar' ? <><Eye className="w-3 h-3" />Revisar</> :
                       <><Check className="w-3 h-3" />OK</>}
                    </span>
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

const HeroHeader: React.FC<{ horizonte: 30 | 90; setHorizonte: (h: 30 | 90) => void }> = ({ horizonte, setHorizonte }) => (
  <div className="bg-gradient-to-r from-violet-600 to-indigo-700 rounded-xl p-6 text-white mb-2">
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <TrendingUp className="w-8 h-8 opacity-80" />
          <h1 className="text-xl md:text-2xl font-bold">Proyeccion de Costos y Ventas</h1>
        </div>
        <p className="text-violet-200 text-sm">Estimaciones a {horizonte} dias basadas en tendencias del sistema</p>
      </div>
      <div className="flex items-center gap-1 bg-white/15 rounded-lg p-1">
        {([30, 90] as const).map(h => (
          <button key={h} onClick={() => setHorizonte(h)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              horizonte === h ? 'bg-white text-violet-700 shadow' : 'text-white/70 hover:text-white'
            }`}>
            {h} dias
          </button>
        ))}
      </div>
    </div>
  </div>
);

const KPICard: React.FC<{
  icon: React.ReactNode; label: string; valor: string; sub: string;
  trend?: number; color?: 'red' | 'green' | 'amber'; invertColor?: boolean;
  sparkData?: number[];
}> = ({ icon, label, valor, sub, trend, color, invertColor, sparkData }) => {
  const trendColor = color ? `text-${color}-600` :
    trend === undefined || Math.abs(trend) < 0.5 ? 'text-gray-400' :
    (invertColor ? trend < 0 : trend > 0) ? 'text-green-500' : 'text-red-500';

  return (
    <Card className="p-3 flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-gray-400">{icon}</span>
          <span className="text-[11px] text-gray-500 font-medium">{label}</span>
        </div>
        <div className="text-lg font-bold text-gray-900">{valor}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-gray-400 truncate">{sub}</span>
          {trend !== undefined && (
            <span className={`text-[11px] font-bold whitespace-nowrap ${trendColor}`}>
              {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      {sparkData && sparkData.length >= 2 && (
        <div className="w-16 h-8 ml-2 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData.map((v, i) => ({ v, i }))}>
              <Line dataKey="v" stroke="#6366f1" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};

const Seccion: React.FC<{
  id: string; titulo: string; icono: React.ReactNode; abierta: boolean;
  onToggle: (id: string) => void; badge?: string; badgeColor?: 'red' | 'amber';
  children: React.ReactNode;
}> = ({ id, titulo, icono, abierta, onToggle, badge, badgeColor, children }) => (
  <Card className="overflow-hidden">
    <button onClick={() => onToggle(id)}
      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-primary-600">{icono}</span>
        <h3 className="font-semibold text-gray-900 text-sm">{titulo}</h3>
        {badge && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            badgeColor === 'red' ? 'bg-red-100 text-red-700' :
            badgeColor === 'amber' ? 'bg-amber-100 text-amber-700' :
            'bg-primary-100 text-primary-700'
          }`}>{badge}</span>
        )}
      </div>
      {abierta ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
    </button>
    {abierta && <div className="px-4 pb-4">{children}</div>}
  </Card>
);
