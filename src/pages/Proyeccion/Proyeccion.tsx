import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, BarChart3, DollarSign,
  Package, RefreshCw, ChevronDown, ChevronUp, ShoppingCart, Check,
  Target, Zap, ArrowRight, ArrowUp, Minus, Eye, Wallet,
  ArrowDown, Clock, AlertCircle, Layers
} from 'lucide-react';
import {
  ComposedChart, BarChart, Bar, LineChart, Line, Area, AreaChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, Cell, PieChart, Pie
} from 'recharts';
import { Card } from '../../components/common';
import { useCTRUStore } from '../../store/ctruStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import { formatCurrency } from '../../utils/format';
import { calcularProyeccion360 } from '../../services/proyeccion360.service';
import type { CTRUProductoDetalle } from '../../store/ctruStore';
import type { Proyeccion360, Horizonte360 } from '../../types/proyeccion360.types';

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export const Proyeccion: React.FC = () => {
  const { productosDetalle, historialMensual, historialGastos, resumen, loading: ctruLoading, fetchAll } = useCTRUStore();
  const { getTCDelDia } = useTipoCambioStore();
  const productos = productosDetalle || [];
  const productosLN = useLineaFilter(productos, (p: CTRUProductoDetalle) => p.lineaNegocioId);

  const [horizonte, setHorizonte] = useState<Horizonte360>(30);
  const [tabActiva, setTabActiva] = useState<string>('ejecutiva');
  const [tcActual, setTcActual] = useState(3.50);

  useEffect(() => {
    if (!productos.length && !ctruLoading) fetchAll();
  }, [productos.length, ctruLoading, fetchAll]);

  useEffect(() => {
    getTCDelDia().then(tc => { if (tc?.venta) setTcActual(tc.venta); });
  }, [getTCDelDia]);

  // Cálculo 360 en memoria
  const proy = useMemo((): Proyeccion360 | null => {
    if (!productosLN.length) return null;
    return calcularProyeccion360(productosLN, historialMensual || [], historialGastos || [], horizonte, tcActual);
  }, [productosLN, historialMensual, historialGastos, horizonte, tcActual]);

  if (ctruLoading) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Hero horizonte={horizonte} setHorizonte={setHorizonte} />
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
          <span className="ml-3 text-gray-500">Cargando datos del sistema...</span>
        </div>
      </div>
    );
  }

  if (!proy) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Hero horizonte={horizonte} setHorizonte={setHorizonte} />
        <Card className="p-8 text-center text-gray-500">
          No hay datos suficientes. Necesitas al menos 1 producto con historial.
        </Card>
      </div>
    );
  }

  const tabs = [
    { id: 'ejecutiva', label: 'Vista Ejecutiva', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'ventas', label: 'Ventas', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'inventario', label: 'Inventario', icon: <Package className="w-4 h-4" /> },
    { id: 'costos', label: 'Costos', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'margen', label: 'Margen', icon: <Target className="w-4 h-4" /> },
    { id: 'caja', label: 'Flujo de Caja', icon: <Wallet className="w-4 h-4" /> },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <Hero horizonte={horizonte} setHorizonte={setHorizonte} />

      {/* KPIs EJECUTIVOS — siempre visibles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI icon={<ShoppingCart className="w-4 h-4" />} label="Ingresos"
          valor={fc(proy.ingresosProyectados)} trend={proy.ventas.crecimientoPct} />
        <KPI icon={<DollarSign className="w-4 h-4" />} label="Costos"
          valor={fc(proy.costosProyectados)} invertColor />
        <KPI icon={<TrendingUp className="w-4 h-4" />} label="Utilidad"
          valor={fc(proy.utilidadProyectada)}
          color={proy.utilidadProyectada >= 0 ? 'green' : 'red'} />
        <KPI icon={<Target className="w-4 h-4" />} label="Margen Neto"
          valor={`${proy.margenNetoProyectado.toFixed(1)}%`}
          color={proy.margenNetoProyectado >= 20 ? 'green' : proy.margenNetoProyectado >= 10 ? 'amber' : 'red'} />
        <KPI icon={<AlertTriangle className="w-4 h-4" />} label="Alertas"
          valor={`${proy.alertas.length}`}
          sub={`${proy.alertas.filter(a => a.severidad === 'danger').length} críticas`}
          color={proy.alertas.some(a => a.severidad === 'danger') ? 'red' : 'green'} />
      </div>

      {/* TABS */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTabActiva(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
              tabActiva === t.id
                ? 'bg-white text-primary-700 border border-b-white -mb-px'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* CONTENIDO DEL TAB */}
      <div className="min-h-[400px]">
        {tabActiva === 'ejecutiva' && <TabEjecutiva proy={proy} />}
        {tabActiva === 'ventas' && <TabVentas proy={proy} />}
        {tabActiva === 'inventario' && <TabInventario proy={proy} />}
        {tabActiva === 'costos' && <TabCostos proy={proy} />}
        {tabActiva === 'margen' && <TabMargen proy={proy} />}
        {tabActiva === 'caja' && <TabFlujoCaja proy={proy} />}
      </div>

      {/* CONFIANZA */}
      <div className="text-center text-xs text-gray-400 pb-2">
        Basado en {proy.mesesHistorial} meses de historial |
        Confianza: <span className={`font-medium ${
          proy.confianza === 'alta' ? 'text-green-600' : proy.confianza === 'media' ? 'text-amber-600' : 'text-gray-500'
        }`}>{proy.confianza}</span> |
        Horizonte: {proy.horizonte} días |
        {proy.fechaGeneracion.toLocaleTimeString('es-PE')}
      </div>
    </div>
  );
};

// ============================================
// TAB: VISTA EJECUTIVA
// ============================================

const TabEjecutiva: React.FC<{ proy: Proyeccion360 }> = ({ proy }) => (
  <div className="space-y-4">
    {/* TIMELINE: Ingresos vs Costos vs Utilidad */}
    <Card className="p-4">
      <h3 className="font-semibold text-sm text-gray-900 mb-3 flex items-center gap-2">
        <Layers className="w-4 h-4 text-primary-600" /> Evolución y Proyección del Negocio
      </h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={proy.timeline} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradUtilidad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={v => `S/${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v: number) => fc(v)} />
            <Area dataKey="bandaSup" stroke="none" fill="#e0e7ff" fillOpacity={0.4} connectNulls={false} />
            <Area dataKey="bandaInf" stroke="none" fill="white" connectNulls={false} />
            <Bar dataKey="ingresos" name="Ingresos" fill="#3b82f6" fillOpacity={0.7} radius={[4, 4, 0, 0]} barSize={20} />
            <Bar dataKey="costos" name="Costos" fill="#f97316" fillOpacity={0.6} radius={[4, 4, 0, 0]} barSize={20} />
            <Line dataKey="utilidad" name="Utilidad" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} />
            <Legend />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>

    {/* P&L SIMPLIFICADO */}
    <Card className="p-4">
      <h3 className="font-semibold text-sm text-gray-900 mb-3">P&L Proyectado ({proy.horizonte} días)</h3>
      <div className="space-y-1">
        <PYLRow label="Ingresos por ventas" valor={proy.margen.ingresosBrutos} bold />
        <PYLRow label="(-) Costo de ventas (CTRU)" valor={-proy.margen.costoVentas} negative />
        <PYLRow label="= Utilidad bruta" valor={proy.margen.utilidadBruta} bold
          pct={proy.margen.margenBruto} color={proy.margen.margenBruto >= 30 ? 'green' : 'amber'} />
        <PYLRow label="(-) Gastos operativos (GA/GO/GV/GD)" valor={-proy.margen.gastosOperativos} negative />
        <div className="border-t-2 border-gray-300 pt-1 mt-1">
          <PYLRow label="= Utilidad neta" valor={proy.margen.utilidadNeta} bold
            pct={proy.margen.margenNeto}
            color={proy.margen.margenNeto >= 20 ? 'green' : proy.margen.margenNeto >= 10 ? 'amber' : 'red'} />
        </div>
      </div>
    </Card>

    {/* ALERTAS */}
    {proy.alertas.length > 0 && (
      <Card className="p-4">
        <h3 className="font-semibold text-sm text-gray-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" /> Alertas ({proy.alertas.length})
        </h3>
        <div className="space-y-2">
          {proy.alertas.slice(0, 6).map((a, i) => (
            <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg text-sm ${
              a.severidad === 'danger' ? 'bg-red-50 border border-red-200' :
              a.severidad === 'warning' ? 'bg-amber-50 border border-amber-200' :
              'bg-blue-50 border border-blue-200'
            }`}>
              <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                a.severidad === 'danger' ? 'text-red-500' : a.severidad === 'warning' ? 'text-amber-500' : 'text-blue-500'
              }`} />
              <div>
                <div className="font-medium">{a.mensaje}</div>
                {a.accion && <div className="text-xs text-gray-500 mt-0.5">{a.accion}</div>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    )}

    {/* ESCENARIOS */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {proy.escenarios.map(e => (
        <Card key={e.nombre} className={`p-4 border-l-4 ${
          e.nombre === 'optimista' ? 'border-green-500' : e.nombre === 'pesimista' ? 'border-red-500' : 'border-blue-500'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm capitalize">{e.nombre}</span>
            <span className="text-xs text-gray-400">{(e.probabilidad * 100).toFixed(0)}%</span>
          </div>
          <div className="text-lg font-bold mb-1">{fc(e.utilidad)}</div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-2">
            <div className={`h-full rounded-full ${
              e.margen >= 20 ? 'bg-green-500' : e.margen >= 10 ? 'bg-amber-400' : 'bg-red-500'
            }`} style={{ width: `${Math.max(0, Math.min(e.margen * 2.5, 100))}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Margen: {e.margen.toFixed(1)}%</span>
            <span>Ingresos: {fc(e.ingresos)}</span>
          </div>
        </Card>
      ))}
    </div>
  </div>
);

// ============================================
// TAB: VENTAS
// ============================================

const TabVentas: React.FC<{ proy: Proyeccion360 }> = ({ proy }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MiniKPI label="Unidades proyectadas" valor={`${proy.ventas.totalUnidades}`} />
      <MiniKPI label="Monto proyectado" valor={fc(proy.ventas.totalMontoPEN)} />
      <MiniKPI label="Ticket promedio" valor={fc(proy.ventas.ticketPromedio)} />
      <MiniKPI label="Crecimiento" valor={`${proy.ventas.crecimientoPct.toFixed(1)}%`}
        color={proy.ventas.crecimientoPct >= 0 ? 'green' : 'red'} />
    </div>

    {/* Tabla por producto */}
    <Card className="p-4">
      <h3 className="font-semibold text-sm mb-3">Ventas Proyectadas por Producto</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="text-left py-2 px-2">Producto</th>
              <th className="text-right py-2 px-2">Vel. venta/mes</th>
              <th className="text-right py-2 px-2">Stock</th>
              <th className="text-right py-2 px-2">Días stock</th>
              <th className="text-right py-2 px-2">Uds. vendibles</th>
              <th className="text-right py-2 px-2">Ingreso proy.</th>
              <th className="text-center py-2 px-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {proy.ventas.productos.sort((a, b) => b.ingresosProyectados - a.ingresosProyectados).map(p => (
              <tr key={p.productoId} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 px-2 font-medium">{p.nombre}</td>
                <td className="py-2 px-2 text-right">{p.ventasMensuales.toFixed(1)}</td>
                <td className="py-2 px-2 text-right">{Math.round(p.unidadesProyectadas + (p.limitadoPorStock ? 0 : 0))}</td>
                <td className="py-2 px-2 text-right font-mono">
                  <span className={p.diasHastaStockout < 30 ? 'text-red-600 font-bold' : ''}>{p.diasHastaStockout === Infinity ? '∞' : `${p.diasHastaStockout}d`}</span>
                </td>
                <td className="py-2 px-2 text-right">{p.unidadesProyectadas}</td>
                <td className="py-2 px-2 text-right font-medium">{fc(p.ingresosProyectados)}</td>
                <td className="py-2 px-2 text-center">
                  {p.limitadoPorStock ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Stock limita</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  </div>
);

// ============================================
// TAB: INVENTARIO
// ============================================

const TabInventario: React.FC<{ proy: Proyeccion360 }> = ({ proy }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MiniKPI label="Disponibles" valor={`${proy.inventario.totalDisponibles} uds`} />
      <MiniKPI label="Valor inventario" valor={fc(proy.inventario.valorInventarioPEN)} />
      <MiniKPI label="Productos en riesgo" valor={`${proy.inventario.productosEnRiesgo}`}
        color={proy.inventario.productosEnRiesgo > 0 ? 'red' : 'green'} />
      <MiniKPI label="Costo recompra total" valor={fc(proy.inventario.costoTotalRecompraPEN)} />
    </div>

    <Card className="p-4">
      <h3 className="font-semibold text-sm mb-3">Estado del Inventario Proyectado</h3>
      {/* Barra visual de días por producto */}
      <div className="space-y-3">
        {proy.inventario.productos.sort((a, b) => a.diasStock - b.diasStock).map(p => (
          <div key={p.productoId}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium">{p.nombre}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{p.disponibles} uds</span>
                <span className={`text-xs font-bold ${
                  p.estado === 'critico' ? 'text-red-600' : p.estado === 'atencion' ? 'text-amber-600' : 'text-green-600'
                }`}>{p.diasStock === Infinity ? '∞' : `${p.diasStock}d`}</span>
              </div>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${
                p.estado === 'critico' ? 'bg-red-500' : p.estado === 'atencion' ? 'bg-amber-400' : 'bg-green-500'
              }`} style={{ width: `${Math.min((p.diasStock / 90) * 100, 100)}%` }} />
            </div>
            {p.necesitaRecompra && (
              <div className="text-[10px] text-gray-400 mt-0.5">
                Comprar {p.cantidadSugerida} uds antes del {p.fechaLimiteCompra.toLocaleDateString('es-PE')} — {fc(p.costoRecompraPEN)}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  </div>
);

// ============================================
// TAB: COSTOS
// ============================================

const TabCostos: React.FC<{ proy: Proyeccion360 }> = ({ proy }) => {
  const data = [
    { nombre: 'Costo ventas (CTRU)', valor: proy.costos.costoVentasTotal, color: '#3b82f6' },
    { nombre: 'GA (Admin)', valor: proy.costos.gaProyectado, color: '#8b5cf6' },
    { nombre: 'GO (Operativo)', valor: proy.costos.goProyectado, color: '#f59e0b' },
    { nombre: 'GV/GD (Venta)', valor: proy.costos.gvgdProyectado, color: '#06b6d4' },
  ].filter(d => d.valor > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniKPI label="Costo total" valor={fc(proy.costos.costoTotal)} />
        <MiniKPI label="CTRU promedio" valor={fc(proy.costos.ctruPromedioProyectado)} />
        <MiniKPI label="GA/GO mensual" valor={fc((proy.costos.gaProyectado + proy.costos.goProyectado) / (proy.horizonte / 30))} />
        <MiniKPI label="Impacto TC +5%" valor={fc(proy.costos.impactoTC5Pct)} color="red" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie chart de distribución */}
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Distribución de Costos</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="valor" nameKey="nombre" cx="50%" cy="50%"
                  outerRadius={70} innerRadius={35} paddingAngle={2} label={({ nombre, percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false} fontSize={10}>
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fc(v)} />
                <Legend fontSize={11} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Tabla desglose */}
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Desglose</h3>
          <div className="space-y-2">
            {data.map(d => (
              <div key={d.nombre} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-sm">{d.nombre}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-medium text-sm">{fc(d.valor)}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    {proy.costos.costoTotal > 0 ? `${((d.valor / proy.costos.costoTotal) * 100).toFixed(0)}%` : ''}
                  </span>
                </div>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-bold text-sm">
              <span>Total</span>
              <span>{fc(proy.costos.costoTotal)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// ============================================
// TAB: MARGEN
// ============================================

const TabMargen: React.FC<{ proy: Proyeccion360 }> = ({ proy }) => {
  // Datos para waterfall
  const waterfall = [
    { nombre: 'Ingresos', valor: proy.margen.ingresosBrutos, color: '#22c55e', acumulado: proy.margen.ingresosBrutos },
    { nombre: 'CTRU', valor: -proy.margen.costoVentas, color: '#ef4444', acumulado: proy.margen.utilidadBruta },
    { nombre: 'GA/GO/GV/GD', valor: -proy.margen.gastosOperativos, color: '#f97316', acumulado: proy.margen.utilidadNeta },
    { nombre: 'Utilidad', valor: proy.margen.utilidadNeta, color: proy.margen.utilidadNeta >= 0 ? '#3b82f6' : '#ef4444', acumulado: proy.margen.utilidadNeta },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniKPI label="Margen bruto" valor={`${proy.margen.margenBruto.toFixed(1)}%`}
          color={proy.margen.margenBruto >= 30 ? 'green' : 'amber'} />
        <MiniKPI label="Margen neto" valor={`${proy.margen.margenNeto.toFixed(1)}%`}
          color={proy.margen.margenNeto >= 20 ? 'green' : proy.margen.margenNeto >= 10 ? 'amber' : 'red'} />
        <MiniKPI label="Break-even" valor={`${proy.margen.unidadesBreakEven} uds`} />
        <MiniKPI label="Productos riesgo" valor={`${proy.margen.productosMargenNegativo + proy.margen.productosMargenBajo}`}
          color={proy.margen.productosMargenNegativo > 0 ? 'red' : 'green'} />
      </div>

      {/* Waterfall */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3">Cascada: De Ingresos a Utilidad</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waterfall} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="nombre" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={v => `S/${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => fc(Math.abs(v))} />
              <Bar dataKey="acumulado" radius={[4, 4, 0, 0]} barSize={40}>
                {waterfall.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.8} />)}
              </Bar>
              <ReferenceLine y={0} stroke="#9ca3af" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};

// ============================================
// TAB: FLUJO DE CAJA
// ============================================

const TabFlujoCaja: React.FC<{ proy: Proyeccion360 }> = ({ proy }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MiniKPI label="Total cobros" valor={fc(proy.flujoCaja.totalCobros)} color="green" />
      <MiniKPI label="Total egresos" valor={fc(proy.flujoCaja.totalEgresos)} color="red" />
      <MiniKPI label="Saldo final" valor={fc(proy.flujoCaja.saldoFinal)}
        color={proy.flujoCaja.saldoFinal >= 0 ? 'green' : 'red'} />
      {proy.flujoCaja.necesitaFinanciamiento && (
        <MiniKPI label="Financiamiento" valor={fc(proy.flujoCaja.montoFinanciamiento)} color="red" />
      )}
    </div>

    {/* Gráfica de flujo semanal */}
    <Card className="p-4">
      <h3 className="font-semibold text-sm mb-3">Flujo de Caja Semanal</h3>
      {proy.flujoCaja.necesitaFinanciamiento && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Déficit de caja proyectado. Se necesita inyección de {fc(proy.flujoCaja.montoFinanciamiento)}.
        </div>
      )}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={proy.flujoCaja.semanas} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={v => `S/${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v: number) => fc(v)} />
            <Bar dataKey="totalCobros" name="Cobros" fill="#22c55e" fillOpacity={0.6} radius={[4, 4, 0, 0]} barSize={16} />
            <Bar dataKey="totalEgresos" name="Egresos" fill="#ef4444" fillOpacity={0.6} radius={[4, 4, 0, 0]} barSize={16} />
            <Line dataKey="saldoAcumulado" name="Saldo" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
            <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
            <Legend />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>

    {/* Tabla semanal */}
    <Card className="p-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="text-left py-2 px-2">Semana</th>
              <th className="text-right py-2 px-2">Cobros</th>
              <th className="text-right py-2 px-2">Gastos</th>
              <th className="text-right py-2 px-2">Recompras</th>
              <th className="text-right py-2 px-2">Flujo neto</th>
              <th className="text-right py-2 px-2">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {proy.flujoCaja.semanas.map(s => (
              <tr key={s.semana} className={`border-b border-gray-50 ${s.critico ? 'bg-red-50' : ''}`}>
                <td className="py-2 px-2 font-medium">{s.label}</td>
                <td className="py-2 px-2 text-right text-green-600">{fc(s.totalCobros)}</td>
                <td className="py-2 px-2 text-right text-red-600">{fc(s.egresosGastos)}</td>
                <td className="py-2 px-2 text-right">{s.egresosRecompras > 0 ? fc(s.egresosRecompras) : '-'}</td>
                <td className="py-2 px-2 text-right font-medium">{fc(s.flujoNeto)}</td>
                <td className={`py-2 px-2 text-right font-bold ${s.saldoAcumulado < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {fc(s.saldoAcumulado)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  </div>
);

// ============================================
// SUB-COMPONENTES COMPARTIDOS
// ============================================

function fc(n: number): string { return formatCurrency(n); }

const Hero: React.FC<{ horizonte: Horizonte360; setHorizonte: (h: Horizonte360) => void }> = ({ horizonte, setHorizonte }) => (
  <div className="bg-gradient-to-r from-violet-600 to-indigo-700 rounded-xl p-6 text-white mb-2">
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <TrendingUp className="w-8 h-8 opacity-80" />
          <h1 className="text-xl md:text-2xl font-bold">Proyeccion 360</h1>
        </div>
        <p className="text-violet-200 text-sm">Ventas · Costos · Margen · Inventario · Flujo de Caja</p>
      </div>
      <div className="flex items-center gap-1 bg-white/15 rounded-lg p-1">
        {([30, 90] as const).map(h => (
          <button key={h} onClick={() => setHorizonte(h)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              horizonte === h ? 'bg-white text-violet-700 shadow' : 'text-white/70 hover:text-white'
            }`}>{h} días</button>
        ))}
      </div>
    </div>
  </div>
);

const KPI: React.FC<{
  icon: React.ReactNode; label: string; valor: string; sub?: string;
  trend?: number; color?: 'green' | 'red' | 'amber'; invertColor?: boolean;
}> = ({ icon, label, valor, sub, trend, color }) => (
  <Card className="p-3">
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-gray-400">{icon}</span>
      <span className="text-[11px] text-gray-500">{label}</span>
    </div>
    <div className={`text-lg font-bold ${
      color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-600' :
      color === 'amber' ? 'text-amber-600' : 'text-gray-900'
    }`}>{valor}</div>
    {(sub || trend !== undefined) && (
      <div className="flex items-center gap-2 mt-0.5">
        {sub && <span className="text-[10px] text-gray-400">{sub}</span>}
        {trend !== undefined && (
          <span className={`text-[10px] font-bold ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        )}
      </div>
    )}
  </Card>
);

const MiniKPI: React.FC<{ label: string; valor: string; color?: 'green' | 'red' | 'amber' }> = ({ label, valor, color }) => (
  <div className="bg-gray-50 rounded-lg p-3">
    <div className="text-[10px] text-gray-400 mb-0.5">{label}</div>
    <div className={`text-sm font-bold ${
      color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-600' :
      color === 'amber' ? 'text-amber-600' : 'text-gray-900'
    }`}>{valor}</div>
  </div>
);

const PYLRow: React.FC<{
  label: string; valor: number; bold?: boolean; negative?: boolean;
  pct?: number; color?: 'green' | 'amber' | 'red';
}> = ({ label, valor, bold, negative, pct, color }) => (
  <div className={`flex items-center justify-between py-1 ${bold ? 'font-semibold' : ''}`}>
    <span className={`text-sm ${negative ? 'text-gray-500' : ''}`}>{label}</span>
    <div className="flex items-center gap-2">
      <span className={`text-sm font-mono ${negative ? 'text-red-500' : ''}`}>
        {fc(Math.abs(valor))}
      </span>
      {pct !== undefined && (
        <span className={`text-xs font-bold ${
          color === 'green' ? 'text-green-600' : color === 'amber' ? 'text-amber-600' : 'text-red-600'
        }`}>{pct.toFixed(1)}%</span>
      )}
    </div>
  </div>
);
