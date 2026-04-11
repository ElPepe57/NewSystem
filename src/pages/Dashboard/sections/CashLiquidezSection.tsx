import React from 'react';
import { Wallet, TrendingUp, Package } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { formatCurrencyPEN, formatCurrencyCompact } from '../../../utils/format';
import { GaugeChart } from '../../../components/common/dashboard/GaugeChart';

interface CashLiquidezSectionProps {
  saldoCajaTotal: number;
  gastoMensualPromedio: number;
  cashRunwayMeses: number;
  valorInventarioPEN: number;
  workingCapital: number;
  dashboardCxPCxC: {
    cuentasPorCobrar: { totalEquivalentePEN: number };
    cuentasPorPagar: { totalEquivalentePEN: number };
  } | null;
  ventasDualLinea: { fecha: string; ventasSUP: number; ventasSKC: number }[];
  lineaFiltroGlobal: string | null;
  tipoCambioDelDia?: { compra?: number; venta?: number } | null;
}

const fmtC = (v: number) => formatCurrencyCompact(v, 'PEN');
const fmt = (v: number) => formatCurrencyPEN(v);

const DualTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-4 py-3">
      <p className="text-xs font-semibold text-slate-600 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-sm font-bold" style={{ color: p.color }}>
          {p.name}: {fmtC(p.value ?? 0)}
        </p>
      ))}
    </div>
  );
};

export const CashLiquidezSection: React.FC<CashLiquidezSectionProps> = ({
  saldoCajaTotal,
  gastoMensualPromedio,
  cashRunwayMeses,
  valorInventarioPEN,
  workingCapital,
  dashboardCxPCxC,
  ventasDualLinea,
  lineaFiltroGlobal,
  tipoCambioDelDia,
}) => {
  const cxcTotal = dashboardCxPCxC?.cuentasPorCobrar.totalEquivalentePEN ?? 0;
  const cxpTotal = dashboardCxPCxC?.cuentasPorPagar.totalEquivalentePEN ?? 0;

  const tcCompra = tipoCambioDelDia?.compra?.toFixed(3);
  const tcVenta = tipoCambioDelDia?.venta?.toFixed(3);

  const hayDualLinea = lineaFiltroGlobal === null && ventasDualLinea.some(d => d.ventasSUP > 0 || d.ventasSKC > 0);

  const runwayMax = 12;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">

      {/* Card 1: Cash Runway — dark */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Cash Runway</span>
        </div>

        <div className="flex flex-col items-center">
          <GaugeChart
            value={Math.min(cashRunwayMeses, runwayMax)}
            max={runwayMax}
            label="meses de caja"
            unit="m"
            dangerBelow={2}
            warningBelow={4}
          />
        </div>

        <div className="mt-3 space-y-2 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>Saldo total</span>
            <span className="text-slate-200 font-medium">{fmtC(saldoCajaTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Gasto mensual prom.</span>
            <span className="text-slate-200 font-medium">{fmtC(gastoMensualPromedio)}</span>
          </div>
          {tcCompra && (
            <div className="flex justify-between border-t border-slate-700/50 pt-2">
              <span>TC hoy</span>
              <span className="text-slate-200 font-medium">S/ {tcCompra}{tcVenta ? ` / ${tcVenta}` : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Card 2: Working Capital — dark */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Working Capital</span>
        </div>

        {/* Numero hero */}
        <div className="text-center mb-4">
          <div className={`text-3xl font-bold ${workingCapital >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fmtC(workingCapital)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Capital de trabajo neto</div>
        </div>

        {/* Breakdown */}
        <div className="space-y-2.5">
          <div className="flex justify-between items-center text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
              <span className="text-slate-300">Inventario</span>
            </span>
            <span className="text-slate-200 font-medium">{fmtC(valorInventarioPEN)}</span>
          </div>

          {cxcTotal > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                <span className="text-slate-300">CxC por cobrar</span>
              </span>
              <span className="text-emerald-400 font-medium">+{fmtC(cxcTotal)}</span>
            </div>
          )}

          {cxpTotal > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                <span className="text-slate-300">CxP por pagar</span>
              </span>
              <span className="text-rose-400 font-medium">-{fmtC(cxpTotal)}</span>
            </div>
          )}

          <div className="border-t border-slate-700/50 pt-2 flex justify-between items-center text-sm">
            <span className="text-slate-400">Neto</span>
            <span className={`font-bold ${workingCapital >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmt(workingCapital)}
            </span>
          </div>
        </div>
      </div>

      {/* Card 3: Tendencia 30d dual SUP/SKC — light */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            {hayDualLinea ? 'Tendencia SUP vs SKC' : 'Ventas 30 dias'}
          </span>
        </div>

        {hayDualLinea ? (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ventasDualLinea} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSUP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSKC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis
                  dataKey="fecha"
                  tick={{ fontSize: 9, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={fmtC}
                  tick={{ fontSize: 9, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <Tooltip content={<DualTooltip />} />
                <Legend
                  iconSize={8}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }}
                />
                <Area
                  type="monotone"
                  dataKey="ventasSUP"
                  name="SUP"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#colorSUP)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#8b5cf6' }}
                />
                <Area
                  type="monotone"
                  dataKey="ventasSKC"
                  name="SKC"
                  stroke="#ec4899"
                  strokeWidth={2}
                  fill="url(#colorSKC)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#ec4899' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-44 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-slate-200" />
              <p className="text-xs">
                {lineaFiltroGlobal
                  ? 'Selecciona "Todas las lineas" para ver comparativa SUP vs SKC'
                  : 'Sin datos de ventas en los ultimos 30 dias'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
