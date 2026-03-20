import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Clock,
  Truck,
  Target,
  Calculator,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  ArrowRight,
  Minus,
  BarChart3
} from 'lucide-react';
import { Card } from '../../common';
import type { VentaStats } from '../../../types/venta.types';
import type { DatosRentabilidadGlobal } from '../../../hooks/useRentabilidadVentas';

interface ResumenPagos {
  totalPorCobrar: number;
  ventasPendientes: number;
  ventasParciales: number;
  ventasPagadas: number;
  cobranzaMesActual: number;
}

interface LeadTimeSegment {
  avg: number;
  min: number;
  max: number;
}

interface LeadTimeMetrics {
  count: number;
  total: LeadTimeSegment;
  cotConf: LeadTimeSegment;
  confAsig: LeadTimeSegment;
  asigProg: LeadTimeSegment;
  progDesp: LeadTimeSegment;
  despEntr: LeadTimeSegment;
}

interface VentasDashboardProps {
  stats: VentaStats;
  rentabilidad: DatosRentabilidadGlobal | null;
  resumenPagos: ResumenPagos | null;
  leadTimeMetrics: LeadTimeMetrics | null;
  totalVentas: number; // count of ventas (not cotizaciones)
  totalEntregadas: number;
}

// Format currency
const fmtCurrency = (n: number, decimals = 0): string =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

const fmtPct = (n: number): string => `${n.toFixed(1)}%`;

export const VentasDashboard: React.FC<VentasDashboardProps> = ({
  stats,
  rentabilidad,
  resumenPagos,
  leadTimeMetrics,
  totalVentas,
  totalEntregadas
}) => {
  const [showLeadTimeDetail, setShowLeadTimeDetail] = useState(false);

  // Derived metrics
  const ticketPromedio = totalVentas > 0 ? stats.ventasTotalPEN / totalVentas : 0;
  const multiplicador = rentabilidad && rentabilidad.totalCostoBase > 0
    ? rentabilidad.totalVentas / rentabilidad.totalCostoBase
    : 0;
  const margenNeto = rentabilidad?.margenNetoPromedio ?? 0;
  const utilidadNeta = rentabilidad?.totalUtilidadNeta ?? stats.utilidadTotalPEN;
  const margenBruto = rentabilidad
    ? rentabilidad.totalVentas - rentabilidad.totalCostoBase
    : stats.utilidadTotalPEN;

  // ROI as percentage
  const inversionTotal = rentabilidad
    ? rentabilidad.totalCostoBase + rentabilidad.totalGastosGAGO + rentabilidad.totalGastosGVGD
    : 0;
  const roiPct = inversionTotal > 0 ? (utilidadNeta / inversionTotal) * 100 : 0;

  // CTRU promedio
  const ctruPromedio = rentabilidad && rentabilidad.baseUnidades > 0
    ? (rentabilidad.totalCostoBase + rentabilidad.totalCostoGAGO) / rentabilidad.baseUnidades
    : 0;

  // Collection percentage
  const pctCobrado = stats.ventasTotalPEN > 0 && resumenPagos
    ? ((stats.ventasTotalPEN - resumenPagos.totalPorCobrar) / stats.ventasTotalPEN) * 100
    : 0;

  // Delivery rate
  const tasaEntrega = totalVentas > 0 ? (totalEntregadas / totalVentas) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 1: RESUMEN EJECUTIVO — 3 Hero Cards              */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* CARD 1: INGRESOS */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-blue-700">Ingresos</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {fmtCurrency(stats.ventasTotalPEN)}
              </p>
            </div>
            <div className="h-11 w-11 bg-blue-100 rounded-xl flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-700 font-medium">{totalVentas} ventas</span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">
              Ticket prom: <span className="font-semibold text-gray-800">{fmtCurrency(ticketPromedio)}</span>
            </span>
          </div>

          {/* Canal breakdown */}
          <div className="mt-3 pt-3 border-t border-blue-200/50">
            <div className="flex items-center gap-4 text-xs text-gray-600">
              {stats.ventasML > 0 && (
                <span>ML: <span className="font-semibold text-gray-800">{stats.ventasML}</span></span>
              )}
              {stats.ventasDirecto > 0 && (
                <span>Directo: <span className="font-semibold text-gray-800">{stats.ventasDirecto}</span></span>
              )}
              {stats.ventasOtro > 0 && (
                <span>Otro: <span className="font-semibold text-gray-800">{stats.ventasOtro}</span></span>
              )}
            </div>
          </div>
        </div>

        {/* CARD 2: RENTABILIDAD */}
        <div className={`bg-gradient-to-br ${utilidadNeta >= 0 ? 'from-emerald-50 to-green-50 border-emerald-200' : 'from-red-50 to-rose-50 border-red-200'} border rounded-xl p-5`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className={`text-sm font-medium ${utilidadNeta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                Utilidad Neta
              </p>
              <p className={`text-3xl font-bold mt-1 ${utilidadNeta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {fmtCurrency(utilidadNeta, 2)}
              </p>
            </div>
            <div className={`h-11 w-11 ${utilidadNeta >= 0 ? 'bg-emerald-100' : 'bg-red-100'} rounded-xl flex items-center justify-center`}>
              {utilidadNeta >= 0
                ? <TrendingUp className="h-6 w-6 text-emerald-600" />
                : <TrendingDown className="h-6 w-6 text-red-600" />
              }
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className={`font-semibold ${margenNeto >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              Margen {fmtPct(margenNeto)}
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">
              Multiplicador{' '}
              <span className={`font-semibold ${
                multiplicador >= 2 ? 'text-emerald-700' : multiplicador >= 1.5 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {multiplicador.toFixed(2)}x
              </span>
            </span>
          </div>

          {/* Mini breakdown */}
          {rentabilidad && (
            <div className="mt-3 pt-3 border-t border-emerald-200/50">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span>Margen Bruto: <span className="font-semibold text-gray-800">{fmtCurrency(margenBruto, 2)}</span></span>
                <ArrowRight className="h-3 w-3 text-gray-400" />
                <span>Gastos: <span className="font-semibold text-orange-600">-{fmtCurrency(rentabilidad.totalGastosGAGO + rentabilidad.totalGastosGVGD, 2)}</span></span>
              </div>
            </div>
          )}
        </div>

        {/* CARD 3: COBRANZA */}
        {resumenPagos && (
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-violet-700">Cobranza</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {fmtPct(pctCobrado)}
                </p>
              </div>
              <div className="h-11 w-11 bg-violet-100 rounded-xl flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-violet-600" />
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2.5 bg-violet-200/50 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-violet-500 rounded-full transition-all"
                style={{ width: `${Math.min(pctCobrado, 100)}%` }}
              />
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-600">
                Pendiente: <span className="font-semibold text-red-600">{fmtCurrency(resumenPagos.totalPorCobrar, 2)}</span>
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-600">
                Mes: <span className="font-semibold text-violet-700">{fmtCurrency(resumenPagos.cobranzaMesActual, 2)}</span>
              </span>
            </div>

            {/* Payment state breakdown */}
            <div className="mt-3 pt-3 border-t border-violet-200/50">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-red-600">
                  Pendientes: <span className="font-semibold">{resumenPagos.ventasPendientes}</span>
                </span>
                <span className="text-amber-600">
                  Parciales: <span className="font-semibold">{resumenPagos.ventasParciales}</span>
                </span>
                <span className="text-emerald-600">
                  Pagadas: <span className="font-semibold">{resumenPagos.ventasPagadas}</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 2: ESTADO DE RESULTADOS COMPACTO (Waterfall)     */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {rentabilidad && rentabilidad.totalVentas > 0 && (
        <Card padding="md">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">Estado de Resultados</h3>
          </div>

          {/* Waterfall steps */}
          <div className="flex flex-col sm:flex-row items-stretch gap-0">
            <WaterfallStep
              label="Ventas"
              amount={rentabilidad.totalVentas}
              pct={100}
              color="blue"
              isFirst
            />
            <WaterfallArrow sign="-" />
            <WaterfallStep
              label="Costo Base"
              amount={rentabilidad.totalCostoBase}
              pct={(rentabilidad.totalCostoBase / rentabilidad.totalVentas) * 100}
              color="gray"
            />
            <WaterfallArrow sign="=" />
            <WaterfallStep
              label="Margen Bruto"
              amount={margenBruto}
              pct={(margenBruto / rentabilidad.totalVentas) * 100}
              color="emerald"
            />
            <WaterfallArrow sign="-" />
            <WaterfallStep
              label="GV/GD"
              amount={rentabilidad.totalGastosGVGD}
              pct={(rentabilidad.totalGastosGVGD / rentabilidad.totalVentas) * 100}
              color="orange"
            />
            <WaterfallArrow sign="-" />
            <WaterfallStep
              label="GA/GO"
              amount={rentabilidad.totalGastosGAGO}
              pct={(rentabilidad.totalGastosGAGO / rentabilidad.totalVentas) * 100}
              color="purple"
            />
            <WaterfallArrow sign="=" />
            <WaterfallStep
              label="Ut. Neta"
              amount={utilidadNeta}
              pct={(utilidadNeta / rentabilidad.totalVentas) * 100}
              color={utilidadNeta >= 0 ? 'green' : 'red'}
              isResult
            />
          </div>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 3: MÉTRICAS OPERATIVAS (4 compact cards)         */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* ROI Neto */}
        {rentabilidad && rentabilidad.totalVentas > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">ROI Neto</p>
                <p className={`text-2xl font-bold mt-1 ${roiPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmtPct(roiPct)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  S/ {(roiPct / 100).toFixed(2)} por S/ 1 invertido
                </p>
              </div>
              <div className="h-9 w-9 bg-emerald-50 rounded-lg flex items-center justify-center">
                <Target className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </div>
        )}

        {/* CTRU Promedio */}
        {rentabilidad && rentabilidad.baseUnidades > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">CTRU Promedio</p>
                <p className="text-2xl font-bold mt-1 text-amber-600">
                  {fmtCurrency(ctruPromedio, 2)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  costo real por unidad
                </p>
              </div>
              <div className="h-9 w-9 bg-amber-50 rounded-lg flex items-center justify-center">
                <Calculator className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </div>
        )}

        {/* Lead Time */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">Lead Time Prom.</p>
              <p className="text-2xl font-bold mt-1 text-cyan-600">
                {leadTimeMetrics ? `${leadTimeMetrics.total.avg.toFixed(1)}d` : '—'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {leadTimeMetrics
                  ? `${leadTimeMetrics.total.min.toFixed(1)}d – ${leadTimeMetrics.total.max.toFixed(1)}d`
                  : 'sin datos'
                }
              </p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="h-9 w-9 bg-cyan-50 rounded-lg flex items-center justify-center">
                <Clock className="h-5 w-5 text-cyan-500" />
              </div>
              {leadTimeMetrics && (
                <button
                  onClick={() => setShowLeadTimeDetail(!showLeadTimeDetail)}
                  className="text-xs text-cyan-600 hover:text-cyan-800 flex items-center gap-0.5"
                >
                  {showLeadTimeDetail ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span>Detalle</span>
                </button>
              )}
            </div>
          </div>

          {/* Expandable lead time detail */}
          {showLeadTimeDetail && leadTimeMetrics && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
              <LeadTimeRow label="Cot → Conf" value={leadTimeMetrics.cotConf.avg} />
              <LeadTimeRow label="Conf → Asig" value={leadTimeMetrics.confAsig.avg} />
              <LeadTimeRow label="Asig → Prog" value={leadTimeMetrics.asigProg.avg} />
              <LeadTimeRow label="Prog → Desp" value={leadTimeMetrics.progDesp.avg} />
              <LeadTimeRow label="Desp → Entr" value={leadTimeMetrics.despEntr.avg} />
            </div>
          )}
        </div>

        {/* Tasa de Entrega */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">Tasa Entrega</p>
              <p className={`text-2xl font-bold mt-1 ${tasaEntrega >= 80 ? 'text-emerald-600' : tasaEntrega >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {fmtPct(tasaEntrega)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {totalEntregadas}/{totalVentas} entregadas
              </p>
            </div>
            <div className="h-9 w-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <Truck className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════ */
/* SUB-COMPONENTS                                                 */
/* ═══════════════════════════════════════════════════════════════ */

const colorMap: Record<string, { text: string; bg: string; bar: string }> = {
  blue:    { text: 'text-blue-700',    bg: 'bg-blue-50',    bar: 'bg-blue-400' },
  gray:    { text: 'text-gray-700',    bg: 'bg-gray-50',    bar: 'bg-gray-400' },
  emerald: { text: 'text-emerald-700', bg: 'bg-emerald-50', bar: 'bg-emerald-400' },
  orange:  { text: 'text-orange-700',  bg: 'bg-orange-50',  bar: 'bg-orange-400' },
  purple:  { text: 'text-purple-700',  bg: 'bg-purple-50',  bar: 'bg-purple-400' },
  green:   { text: 'text-green-700',   bg: 'bg-green-50',   bar: 'bg-green-500' },
  red:     { text: 'text-red-700',     bg: 'bg-red-50',     bar: 'bg-red-500' },
};

interface WaterfallStepProps {
  label: string;
  amount: number;
  pct: number;
  color: string;
  isFirst?: boolean;
  isResult?: boolean;
}

const WaterfallStep: React.FC<WaterfallStepProps> = ({ label, amount, pct, color, isFirst, isResult }) => {
  const c = colorMap[color] || colorMap.gray;
  return (
    <div className={`flex-1 text-center px-2 py-2 rounded-lg ${isResult ? c.bg : ''} ${isFirst ? c.bg : ''}`}>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-sm sm:text-base font-bold ${isResult || isFirst ? c.text : 'text-gray-800'}`}>
        {fmtCurrency(amount, 0)}
      </p>
      <p className={`text-xs ${isResult ? c.text : 'text-gray-500'} mt-0.5`}>
        {fmtPct(Math.abs(pct))}
      </p>
    </div>
  );
};

const WaterfallArrow: React.FC<{ sign: string }> = ({ sign }) => (
  <div className="hidden sm:flex items-center justify-center px-1 text-gray-400 font-bold text-sm self-center">
    {sign}
  </div>
);

const LeadTimeRow: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-gray-500">{label}</span>
    <span className="font-medium text-gray-700">{value.toFixed(1)}d</span>
  </div>
);
