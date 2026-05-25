/**
 * Tab 1 · Resumen ejecutivo · Banner Salud + 3 cards rápidas
 *
 * Mobile-first: las 3 cards apilan en mobile (grid-cols-1), 3 en desktop.
 * Banner Estado del Negocio es la primera lectura emocional · score 0-100.
 */
import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wallet,
  TrendingUp,
  CreditCard,
  Flag,
  Clock,
} from 'lucide-react';
import { formatCurrencyPEN } from '../../../utils/format';
import type { ResumenInversionista } from '../../../types/inversionista.types';

interface Props {
  data: ResumenInversionista;
}

export default function InversionistasResumen({ data }: Props) {
  const saludMap = {
    saludable: {
      grad: 'from-emerald-50 via-emerald-100/40 to-emerald-50',
      ring: 'ring-emerald-200',
      icon: <CheckCircle2 className="w-7 h-7" />,
      iconBg: 'from-emerald-500 to-emerald-700',
      iconShadow: 'shadow-emerald-200',
      label: 'text-emerald-700',
      valor: 'text-emerald-900',
      titulo: 'Saludable · creciendo',
    },
    atencion: {
      grad: 'from-amber-50 via-amber-100/40 to-amber-50',
      ring: 'ring-amber-200',
      icon: <AlertTriangle className="w-7 h-7" />,
      iconBg: 'from-amber-500 to-amber-700',
      iconShadow: 'shadow-amber-200',
      label: 'text-amber-700',
      valor: 'text-amber-900',
      titulo: 'Atención · monitorear',
    },
    critico: {
      grad: 'from-rose-50 via-rose-100/40 to-rose-50',
      ring: 'ring-rose-200',
      icon: <XCircle className="w-7 h-7" />,
      iconBg: 'from-rose-500 to-rose-700',
      iconShadow: 'shadow-rose-200',
      label: 'text-rose-700',
      valor: 'text-rose-900',
      titulo: 'Crítico · revisión estratégica',
    },
  }[data.salud.estado];

  const cashPropio = data.capitalComprometido.cashAportadoPEN;
  const tcPersonal = data.capitalComprometido.deudaTCPersonalPEN;
  const total = data.capitalComprometido.totalPEN;
  const pctCash = total > 0 ? (cashPropio / total) * 100 : 0;
  const pctTC = total > 0 ? (tcPersonal / total) * 100 : 0;

  const totalAportes = data.aportesPorSocio.reduce((a, b) => a + b.cantidadAportes, 0);
  const totalTCs = data.tcPersonalesPorSocio.reduce((a, b) => a + b.cantidadTCs, 0);

  return (
    <div className="space-y-4">
      {/* Banner Estado del Negocio · responsive · stack en mobile */}
      <div className={`bg-gradient-to-r ${saludMap.grad} ring-2 ${saludMap.ring} rounded-2xl p-4 sm:p-5`}>
        <div className="flex items-start gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-[220px]">
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${saludMap.iconBg} flex items-center justify-center text-white flex-shrink-0 shadow-lg ${saludMap.iconShadow}`}>
              {saludMap.icon}
            </div>
            <div className="min-w-0">
              <div className={`text-[10px] sm:text-[11px] uppercase tracking-wider ${saludMap.label} font-bold`}>Estado del negocio</div>
              <div className={`text-[18px] sm:text-[22px] font-bold ${saludMap.valor} leading-tight`}>{saludMap.titulo}</div>
              <div className={`text-[11px] ${saludMap.label} mt-0.5`}>{data.salud.resumen}</div>
            </div>
          </div>
          {/* Score chip · solo desktop */}
          <div className={`hidden sm:flex flex-col items-end ${saludMap.label}`}>
            <div className="text-[9px] uppercase tracking-wider font-bold">Score</div>
            <div className={`text-[24px] font-bold tabular-nums ${saludMap.valor}`}>{data.salud.score}</div>
            <div className="text-[9px]">/ 100</div>
          </div>
        </div>
      </div>

      {/* 3 cards · cash propio + TC personal + soberanía · stack mobile, 3 cols desktop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Cash propio */}
        <div className="bg-white border border-emerald-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-emerald-700" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">CASH PROPIO APORTADO</span>
          </div>
          <div className="text-[22px] font-bold tabular-nums text-emerald-900">{formatCurrencyPEN(cashPropio)}</div>
          <div className="text-[10px] text-slate-500">{pctCash.toFixed(0)}% del capital comprometido</div>
          <div className="mt-2 pt-2 border-t border-emerald-100 text-[11px] text-emerald-700 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {totalAportes} aporte{totalAportes === 1 ? '' : 's'} registrado{totalAportes === 1 ? '' : 's'}
          </div>
        </div>

        {/* TC personal */}
        <div className="bg-white border border-rose-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-rose-700" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-rose-700">TC PERSONAL ASUMIDA</span>
          </div>
          <div className="text-[22px] font-bold tabular-nums text-rose-900">{formatCurrencyPEN(tcPersonal)}</div>
          <div className="text-[10px] text-slate-500">{pctTC.toFixed(0)}% del capital comprometido</div>
          <div className="mt-2 pt-2 border-t border-rose-100 text-[11px] text-rose-700 flex items-center gap-1">
            <CreditCard className="w-3 h-3" />
            {totalTCs} TC{totalTCs === 1 ? '' : 's'} personal{totalTCs === 1 ? '' : 'es'} activa{totalTCs === 1 ? '' : 's'}
          </div>
        </div>

        {/* Soberanía financiera */}
        <div className="bg-white border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Flag className="w-4 h-4 text-amber-700" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-amber-700">SOBERANÍA FINANCIERA</span>
          </div>
          <div className="text-[22px] font-bold tabular-nums text-amber-900">
            {data.soberania.deudaTCPersonalVigentePEN === 0
              ? '✓ Liberado'
              : Number.isFinite(data.soberania.mesesParaSoberania) && data.soberania.mesesParaSoberania > 0
                ? `~${Math.ceil(data.soberania.mesesParaSoberania)}m`
                : '—'}
          </div>
          <div className="text-[10px] text-slate-500">Faltan para "liberar" la TC</div>
          <div className="mt-2 pt-2 border-t border-amber-100 text-[11px] text-amber-700 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {data.soberania.estado === 'cerca' && 'Cerca de soberanía'}
            {data.soberania.estado === 'camino_claro' && 'Camino claro'}
            {data.soberania.estado === 'largo_plazo' && 'Largo plazo'}
            {data.soberania.estado === 'revision' && 'Revisión estratégica'}
          </div>
        </div>
      </div>
    </div>
  );
}
