/**
 * Inversionistas · vista ejecutiva canon v5.2 (chk5.E-INV).
 *
 * Pixel-perfect contra `docs/mockups/inversionistas-v5.2.html`.
 *
 * Modelo MIXTO: capital comprometido = cash propio + TC personal asumida.
 *
 * 7 secciones:
 *  1. Resumen ejecutivo (banner salud + 3 cards)
 *  2. Mi capital · histórico + composición
 *  3. Trayectoria del negocio 24m
 *  4. ROI dual
 *  5. Distribución (reinvertido/repartido)
 *  6. Salud financiera inversionista
 *  7. Reportes ejecutivos (exportables)
 *
 * Color signature: violet (distinto a purple Contabilidad, teal Finanzas).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Landmark,
  ChevronRight,
  Shield,
  Calendar,
  RefreshCw,
  UserCog,
  FileText,
  Wallet,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Zap,
  CheckCircle2,
  CreditCard,
  Flag,
  Clock,
  Info,
  Lightbulb,
  PieChart,
  LineChart,
  AlertCircle,
  Layers,
  BarChart3,
  Plus,
  FileSpreadsheet,
  Presentation,
  History,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

import { inversionistaService } from '../../services/inversionista.service';
import type {
  ResumenInversionista,
  TrayectoriaMensual,
} from '../../types/inversionista.types';
import { formatCurrencyPEN, formatPercent } from '../../utils/format';
import { Timestamp } from 'firebase/firestore';

const MESES_NOMBRES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const MESES_NOMBRE_LARGO = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS · KPI CARDS canon N1+N2
// ═════════════════════════════════════════════════════════════════════════

interface KpiInversionistaCardProps {
  label: string;
  valor: string;
  delta?: string;
  deltaIcon?: 'up' | 'down';
  tooltip?: string;
  /**
   * Tinte canon · uno de violet/indigo/emerald/amber/purple.
   * Cada uno tiene su propio gradient + ring.
   */
  tinte: 'violet' | 'indigo' | 'emerald' | 'amber' | 'purple';
  icon: React.ReactNode;
}

function KpiInversionistaCard({
  label,
  valor,
  delta,
  deltaIcon,
  tooltip,
  tinte,
  icon,
}: KpiInversionistaCardProps) {
  const tinteMap = {
    violet: {
      grad: 'from-violet-50 to-violet-100/40',
      ring: 'ring-violet-200/50',
      label: 'text-violet-700',
      icon: 'text-violet-700',
      valor: 'text-violet-900',
      delta: 'text-violet-700',
    },
    indigo: {
      grad: 'from-indigo-50 to-indigo-100/40',
      ring: 'ring-indigo-200/50',
      label: 'text-indigo-700',
      icon: 'text-indigo-700',
      valor: 'text-indigo-900',
      delta: 'text-indigo-700',
    },
    emerald: {
      grad: 'from-emerald-50 to-emerald-100/40',
      ring: 'ring-emerald-200/50',
      label: 'text-emerald-700',
      icon: 'text-emerald-700',
      valor: 'text-emerald-900',
      delta: 'text-emerald-700',
    },
    amber: {
      grad: 'from-amber-50 to-amber-100/40',
      ring: 'ring-amber-200/50',
      label: 'text-amber-700',
      icon: 'text-amber-700',
      valor: 'text-amber-900',
      delta: 'text-amber-700',
    },
    purple: {
      grad: 'from-violet-50 to-purple-100/40',
      ring: 'ring-purple-200/50',
      label: 'text-purple-700',
      icon: 'text-purple-700',
      valor: 'text-purple-900',
      delta: 'text-purple-700',
    },
  }[tinte];

  return (
    <div className={`bg-gradient-to-br ${tinteMap.grad} ring-1 ${tinteMap.ring} rounded-2xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] uppercase tracking-wider ${tinteMap.label} font-bold flex items-center gap-1`}>
          {label}
          {tooltip && (
            <Info className="w-3 h-3 text-slate-400" aria-label={tooltip}>
              <title>{tooltip}</title>
            </Info>
          )}
        </span>
        <span className={`w-3.5 h-3.5 ${tinteMap.icon}`}>{icon}</span>
      </div>
      <div className={`text-2xl font-bold tabular-nums ${tinteMap.valor}`}>{valor}</div>
      {delta && (
        <div className={`text-[11px] ${tinteMap.delta} flex items-center gap-1 mt-1`}>
          {deltaIcon === 'up' && <TrendingUp className="w-3 h-3" />}
          {deltaIcon === 'down' && <TrendingDown className="w-3 h-3" />}
          <span>{delta}</span>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SECCIÓN 1 · RESUMEN EJECUTIVO (Banner salud + 3 cards)
// ═════════════════════════════════════════════════════════════════════════

function SeccionResumenEjecutivo({ data }: { data: ResumenInversionista }) {
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
  const totalComprometido = data.capitalComprometido.totalPEN;
  const pctCash = totalComprometido > 0 ? (cashPropio / totalComprometido) * 100 : 0;
  const pctTC = totalComprometido > 0 ? (tcPersonal / totalComprometido) * 100 : 0;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-[11px]">1</div>
        <h2 className="text-[14px] font-bold text-slate-900">Resumen ejecutivo</h2>
        <span className="text-[10px] text-slate-500">Estado del negocio desde lente inversionista</span>
      </div>

      {/* Banner Estado del Negocio */}
      <div className={`bg-gradient-to-r ${saludMap.grad} ring-2 ${saludMap.ring} rounded-2xl p-5 mb-4`}>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-[260px]">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${saludMap.iconBg} flex items-center justify-center text-white flex-shrink-0 shadow-lg ${saludMap.iconShadow}`}>
              {saludMap.icon}
            </div>
            <div>
              <div className={`text-[11px] uppercase tracking-wider ${saludMap.label} font-bold`}>Estado del negocio</div>
              <div className={`text-[22px] font-bold ${saludMap.valor} leading-tight`}>{saludMap.titulo}</div>
              <div className={`text-[11px] ${saludMap.label}`}>{data.salud.resumen}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3 cards · cash propio + TC personal + soberanía */}
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
            {data.aportesPorSocio.reduce((a, b) => a + b.cantidadAportes, 0)} aportes registrados
          </div>
        </div>

        {/* TC personal asumida */}
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
            {data.tcPersonalesPorSocio.reduce((a, b) => a + b.cantidadTCs, 0)} TCs personales activas
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
                ? `~${Math.ceil(data.soberania.mesesParaSoberania)} meses`
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
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SECCIÓN 2 · MI CAPITAL · HISTÓRICO + COMPOSICIÓN
// ═════════════════════════════════════════════════════════════════════════

function SeccionMiCapital({ data }: { data: ResumenInversionista }) {
  const totalAportes = data.aportesPorSocio.reduce((a, b) => a + b.totalAportadoPEN, 0);
  const cash = data.capitalComprometido.cashAportadoPEN;
  const tc = data.capitalComprometido.deudaTCPersonalPEN;
  const total = cash + tc;
  const pctCash = total > 0 ? (cash / total) * 100 : 0;
  const pctTC = total > 0 ? (tc / total) * 100 : 0;

  // Donut SVG · cash + tc
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const cashLen = (pctCash / 100) * circumference;
  const tcLen = (pctTC / 100) * circumference;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-[11px]">2</div>
        <h2 className="text-[14px] font-bold text-slate-900">Mi capital · histórico y composición</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sub-A · Aportes propios cash · timeline tabla */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-50 to-emerald-100/40 px-4 py-2.5 border-b border-emerald-200/50 flex items-center justify-between">
            <h3 className="text-[12px] font-bold text-emerald-900 flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5" />
              Aportes propios · cash
            </h3>
            <button
              type="button"
              className="text-[10px] text-emerald-700 hover:bg-emerald-100 border border-emerald-300 px-2 py-1 rounded inline-flex items-center gap-1"
              title="Próximamente · usar Finanzas › Movimientos › Aporte"
            >
              <Plus className="w-3 h-3" /> Nuevo aporte
            </button>
          </div>
          {data.aportesPorSocio.length === 0 ? (
            <div className="px-4 py-8 text-center text-[11px] text-slate-500">
              Sin aportes registrados. Usá Finanzas → Movimientos → Aporte de capital.
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-700">Socio</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-700">Aportes</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-700">Último aporte</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-slate-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.aportesPorSocio.map((a) => (
                  <tr key={a.socioId}>
                    <td className="px-3 py-2 font-semibold text-slate-900">{a.socioNombre}</td>
                    <td className="px-3 py-2 text-slate-500">{a.cantidadAportes} aporte{a.cantidadAportes === 1 ? '' : 's'}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {a.fechaUltimoAporte ? formatFechaCorta(a.fechaUltimoAporte) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">
                      {formatCurrencyPEN(a.totalAportadoPEN)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                <tr>
                  <td colSpan={3} className="px-3 py-2 font-bold text-emerald-900">Total aportes propios</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-900">
                    {formatCurrencyPEN(totalAportes)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Sub-B · Donut composición */}
        <div className="bg-white border border-violet-200 rounded-2xl p-4">
          <h3 className="text-[12px] font-bold text-violet-900 mb-3 flex items-center gap-2">
            <PieChart className="w-3.5 h-3.5" />
            Composición del capital comprometido
          </h3>
          {total === 0 ? (
            <div className="text-center py-6 text-[11px] text-slate-500">
              Sin capital registrado aún.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <svg viewBox="0 0 100 100" className="w-28 h-28 flex-shrink-0 -rotate-90">
                  <circle cx="50" cy="50" r={radius} fill="none" stroke="rgb(241 245 249)" strokeWidth="16" />
                  <circle
                    cx="50" cy="50" r={radius} fill="none"
                    stroke="rgb(5 150 105)" strokeWidth="16"
                    strokeDasharray={`${cashLen} ${circumference}`}
                  />
                  <circle
                    cx="50" cy="50" r={radius} fill="none"
                    stroke="rgb(225 29 72)" strokeWidth="16"
                    strokeDasharray={`${tcLen} ${circumference}`}
                    strokeDashoffset={-cashLen}
                  />
                </svg>
                <div className="flex-1 text-[11px] space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-slate-700">Cash propio</span>
                    <span className="ml-auto tabular-nums font-bold text-emerald-900">{pctCash.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-rose-600"></div>
                    <span className="text-slate-700">TC personal</span>
                    <span className="ml-auto tabular-nums font-bold text-rose-900">{pctTC.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-violet-100 text-[10px] text-violet-700 flex items-start gap-1">
                <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>
                  Tu apalancamiento es{' '}
                  <strong>
                    {pctTC < 20 ? 'bajo' : pctTC < 40 ? 'moderado' : pctTC < 60 ? 'alto' : 'muy alto'}
                  </strong>{' '}
                  ({pctTC.toFixed(0)}%).
                  {pctTC > 0 && ' Mientras siga bajando, vas en buen camino.'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sub-C · Saldos TC actuales · apalancamiento */}
      {data.tcPersonalesPorSocio.length > 0 && (
        <div className="mt-4 bg-white border border-rose-200 rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-rose-50 to-rose-100/40 px-4 py-2.5 border-b border-rose-200/50">
            <h3 className="text-[12px] font-bold text-rose-900 flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5" />
              Apalancamiento · TC personal asumida por el negocio
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {data.tcPersonalesPorSocio.flatMap((s) =>
              s.tarjetas.map((tarjeta) => (
                <div key={tarjeta.cuentaCajaId} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold text-slate-900">{tarjeta.nombre} · {s.socioNombre}</div>
                    <div className="text-[10px] text-slate-500">
                      Garantía personal · negocio paga · {tarjeta.banco || 'banco'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-bold tabular-nums text-rose-900">
                      {formatCurrencyPEN(tarjeta.utilizado)}
                    </div>
                    <div className="text-[9px] text-slate-500">
                      {tarjeta.porcentajeUso.toFixed(0)}% del límite
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="bg-rose-50 px-4 py-2 flex justify-between border-t border-rose-200">
            <span className="text-[11px] uppercase font-bold text-rose-900">TOTAL TC PERSONAL</span>
            <span className="text-[14px] font-bold tabular-nums text-rose-900">
              {formatCurrencyPEN(tc)}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SECCIÓN 3 · TRAYECTORIA 24M
// ═════════════════════════════════════════════════════════════════════════

function SeccionTrayectoria({ data }: { data: ResumenInversionista }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-[11px]">3</div>
        <h2 className="text-[14px] font-bold text-slate-900">Trayectoria del negocio · últimos 24 meses</h2>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-[12px] font-bold text-slate-900 flex items-center gap-2">
            <LineChart className="w-4 h-4 text-violet-600" />
            Activos · Patrimonio · Equity Ratio
          </h3>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-teal-500 rounded-full"></div> Activos
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div> Patrimonio
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div> Equity Ratio
            </span>
          </div>
        </div>

        <TrayectoriaChart trayectoria={data.trayectoria} />

        {/* Insight automático */}
        <div className="mt-4 pt-3 border-t border-slate-100 bg-emerald-50/30 -mx-5 px-5 py-2.5 text-[11px] text-emerald-900 flex items-start gap-2">
          <Lightbulb className="w-3.5 h-3.5 text-emerald-700 mt-0.5" />
          <div>
            <strong>Lectura ejecutiva:</strong>{' '}
            {generarInsightTrayectoria(data.trayectoria, data.equityRatio.porcentaje)}
          </div>
        </div>
      </div>
    </section>
  );
}

function TrayectoriaChart({ trayectoria }: { trayectoria: TrayectoriaMensual[] }) {
  if (trayectoria.length === 0) {
    return (
      <div className="bg-slate-50 rounded-xl p-4 h-64 flex items-center justify-center text-[11px] text-slate-500">
        Sin data histórica suficiente para mostrar trayectoria.
      </div>
    );
  }

  const maxActivos = Math.max(...trayectoria.map((t) => t.activos), 1);
  const maxPatrimonio = Math.max(...trayectoria.map((t) => t.patrimonio), 1);
  const maxValue = Math.max(maxActivos, maxPatrimonio);

  // SVG dimensions
  const w = 400;
  const h = 200;
  const padTop = 20;
  const padBottom = 20;
  const chartH = h - padTop - padBottom;

  const xStep = trayectoria.length > 1 ? w / (trayectoria.length - 1) : 0;
  const yScale = (v: number) => h - padBottom - (v / maxValue) * chartH;
  const yScalePct = (v: number) => h - padBottom - (v) * chartH; // 0-1 input

  const activosPoints = trayectoria.map((t, i) => `${i * xStep},${yScale(t.activos)}`).join(' ');
  const patrimonioPoints = trayectoria.map((t, i) => `${i * xStep},${yScale(t.patrimonio)}`).join(' ');
  const equityPoints = trayectoria.map((t, i) => `${i * xStep},${yScalePct(t.equityRatio)}`).join(' ');

  const lastIdx = trayectoria.length - 1;
  const lastX = lastIdx * xStep;

  // Etiquetas eje X · primer, medio, último mes
  const labels: Array<{ idx: number; label: string }> = [];
  if (trayectoria.length >= 1) {
    labels.push({ idx: 0, label: `${MESES_NOMBRES[trayectoria[0].mes - 1]}/${String(trayectoria[0].anio).slice(2)}` });
  }
  if (trayectoria.length >= 4) {
    const m = Math.floor(trayectoria.length / 2);
    labels.push({ idx: m, label: `${MESES_NOMBRES[trayectoria[m].mes - 1]}/${String(trayectoria[m].anio).slice(2)}` });
  }
  if (trayectoria.length >= 2) {
    labels.push({ idx: lastIdx, label: 'Hoy' });
  }

  return (
    <div className="bg-slate-50 rounded-xl p-4 h-64 relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
        {/* Grid */}
        <line x1="0" y1={padTop} x2={w} y2={padTop} stroke="rgb(226 232 240)" strokeWidth="0.5" />
        <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="rgb(226 232 240)" strokeWidth="0.5" />
        <line x1="0" y1={h - padBottom} x2={w} y2={h - padBottom} stroke="rgb(226 232 240)" strokeWidth="0.5" />

        {/* Activos · teal */}
        <polyline points={activosPoints} fill="none" stroke="rgb(20 184 166)" strokeWidth="2.5" />
        {/* Patrimonio · indigo */}
        <polyline points={patrimonioPoints} fill="none" stroke="rgb(79 70 229)" strokeWidth="2.5" />
        {/* Equity Ratio · emerald · dashed */}
        <polyline points={equityPoints} fill="none" stroke="rgb(5 150 105)" strokeWidth="2.5" strokeDasharray="3 2" />

        {/* Punto final destacado */}
        <circle cx={lastX} cy={yScale(trayectoria[lastIdx].activos)} r="3" fill="rgb(20 184 166)" />
        <circle cx={lastX} cy={yScale(trayectoria[lastIdx].patrimonio)} r="3" fill="rgb(79 70 229)" />
        <circle cx={lastX} cy={yScalePct(trayectoria[lastIdx].equityRatio)} r="3" fill="rgb(5 150 105)" />
      </svg>

      <div className="flex justify-between text-[9px] text-slate-500 mt-1 absolute bottom-1 left-4 right-4">
        {labels.map((l) => (
          <span key={l.idx}>{l.label}</span>
        ))}
      </div>
    </div>
  );
}

function generarInsightTrayectoria(trayectoria: TrayectoriaMensual[], equityActual: number): string {
  if (trayectoria.length < 2) return 'Aún hay poca data histórica para análisis de tendencia.';
  const inicial = trayectoria.find((t) => t.equityRatio > 0);
  const equityInicial = inicial ? inicial.equityRatio * 100 : 0;
  const patrimonioInicial = inicial?.patrimonio || 0;
  const patrimonioFinal = trayectoria[trayectoria.length - 1].patrimonio;
  const multiplicador = patrimonioInicial > 0 ? patrimonioFinal / patrimonioInicial : 0;

  if (equityActual > equityInicial && multiplicador > 1) {
    return `Equity ratio creció de ${equityInicial.toFixed(0)}% a ${equityActual.toFixed(0)}% · estás cada vez menos apalancado · patrimonio se multiplicó ${multiplicador.toFixed(1)}x en el período.`;
  }
  if (multiplicador > 1) {
    return `Patrimonio creció ${multiplicador.toFixed(1)}x en el período · trayectoria positiva pero el apalancamiento subió. Monitorear.`;
  }
  return 'Trayectoria estable. Revisar drivers de crecimiento.';
}

// ═════════════════════════════════════════════════════════════════════════
// SECCIÓN 4 · ROI DUAL
// ═════════════════════════════════════════════════════════════════════════

function SeccionRoiDual({ data }: { data: ResumenInversionista }) {
  const roiPropio = data.roiDual.sobreCashAportado * 100;
  const roiComprometido = data.roiDual.sobreCapitalComprometido * 100;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-[11px]">4</div>
        <h2 className="text-[14px] font-bold text-slate-900">Retorno de inversión · ROI dual</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ROI sobre capital propio */}
        <div className="bg-white border border-emerald-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-700" />
            <h3 className="text-[12px] font-bold text-emerald-900">ROI sobre capital PROPIO</h3>
          </div>
          <div className="text-[28px] font-bold tabular-nums text-emerald-700">
            {formatPercent(roiPropio, { decimals: 1 })}
          </div>
          <div className="text-[11px] text-emerald-700">
            sobre {formatCurrencyPEN(data.capitalComprometido.cashAportadoPEN)} propios
          </div>
          <div className="mt-3 pt-3 border-t border-emerald-100 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-600">Utilidad neta acum.</span>
              <span className="tabular-nums font-semibold">
                {formatCurrencyPEN(data.roiDual.utilidadNetaAcumuladaPEN)}
              </span>
            </div>
            <div className="flex justify-between font-bold border-t border-emerald-100 pt-1">
              <span className="text-emerald-900">Capital propio</span>
              <span className="tabular-nums text-emerald-900">
                {formatCurrencyPEN(data.capitalComprometido.cashAportadoPEN)}
              </span>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-emerald-700 bg-emerald-50 rounded p-1.5">
            {roiPropio >= 15 ? '✓ ROI saludable · meta ≥15%' : '⚠ Por debajo de meta 15%'}
          </div>
        </div>

        {/* ROI sobre capital comprometido */}
        <div className="bg-white border border-violet-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-violet-700" />
            <h3 className="text-[12px] font-bold text-violet-900">ROI sobre capital COMPROMETIDO</h3>
          </div>
          <div className="text-[28px] font-bold tabular-nums text-violet-700">
            {formatPercent(roiComprometido, { decimals: 1 })}
          </div>
          <div className="text-[11px] text-violet-700">
            sobre {formatCurrencyPEN(data.capitalComprometido.totalPEN)} (incluye TC)
          </div>
          <div className="mt-3 pt-3 border-t border-violet-100 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-600">Utilidad neta acum.</span>
              <span className="tabular-nums font-semibold">
                {formatCurrencyPEN(data.roiDual.utilidadNetaAcumuladaPEN)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Capital propio</span>
              <span className="tabular-nums text-slate-700">
                {formatCurrencyPEN(data.capitalComprometido.cashAportadoPEN)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">+ TC personal</span>
              <span className="tabular-nums text-slate-700">
                {formatCurrencyPEN(data.capitalComprometido.deudaTCPersonalPEN)}
              </span>
            </div>
            <div className="flex justify-between font-bold border-t border-violet-100 pt-1">
              <span className="text-violet-900">Capital comprometido</span>
              <span className="tabular-nums text-violet-900">
                {formatCurrencyPEN(data.capitalComprometido.totalPEN)}
              </span>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-violet-700 bg-violet-50 rounded p-1.5">
            {roiComprometido >= 20
              ? '✓ Apalancamiento te conviene · ROI > costo TC'
              : '⚠ ROI cerca o por debajo del costo TC · revisar'}
          </div>
        </div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SECCIÓN 5 · DISTRIBUCIÓN
// ═════════════════════════════════════════════════════════════════════════

function SeccionDistribucion({ data }: { data: ResumenInversionista }) {
  const totalRetirado = data.retirosPorSocio.reduce((a, b) => a + b.totalRetiradoPEN, 0);
  const retiradoCapital = data.retirosPorSocio.reduce((a, b) => a + b.porTipo.capital, 0);
  const retiradoUtilidades = data.retirosPorSocio.reduce((a, b) => a + b.porTipo.utilidades, 0);
  const utilidadAcum = data.roiDual.utilidadNetaAcumuladaPEN;
  const reinvertido = Math.max(0, utilidadAcum - retiradoUtilidades);

  const pctReinvertido = utilidadAcum > 0 ? (reinvertido / utilidadAcum) * 100 : 0;
  const pctDistribuido = utilidadAcum > 0 ? (retiradoUtilidades / utilidadAcum) * 100 : 0;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-[11px]">5</div>
        <h2 className="text-[14px] font-bold text-slate-900">Distribución · qué se hizo con la utilidad</h2>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          <div className="bg-emerald-50/40 border border-emerald-200 rounded-lg p-3">
            <div className="text-[10px] uppercase font-bold text-emerald-700 mb-0.5">REINVERTIDO EN NEGOCIO</div>
            <div className="text-[18px] font-bold tabular-nums text-emerald-900">
              {formatCurrencyPEN(reinvertido)}
            </div>
            <div className="text-[10px] text-emerald-700">{pctReinvertido.toFixed(0)}% de la utilidad acumulada</div>
          </div>
          <div className="bg-rose-50/40 border border-rose-200 rounded-lg p-3">
            <div className="text-[10px] uppercase font-bold text-rose-700 mb-0.5">RETIRADO CAPITAL</div>
            <div className="text-[18px] font-bold tabular-nums text-rose-900">
              {formatCurrencyPEN(retiradoCapital)}
            </div>
            <div className="text-[10px] text-rose-700">Devolución de aportes</div>
          </div>
          <div className="bg-amber-50/40 border border-amber-200 rounded-lg p-3">
            <div className="text-[10px] uppercase font-bold text-amber-700 mb-0.5">DISTRIBUIDO UTILIDADES</div>
            <div className="text-[18px] font-bold tabular-nums text-amber-900">
              {formatCurrencyPEN(retiradoUtilidades)}
            </div>
            <div className="text-[10px] text-amber-700">{pctDistribuido.toFixed(0)}% retiros · resto pendiente</div>
          </div>
        </div>

        {/* Retiros de socios */}
        {totalRetirado > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2">RETIROS DE SOCIOS · histórico</div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[10px] text-slate-500">
                  <th className="text-left py-1 font-semibold">Socio</th>
                  <th className="text-left py-1 font-semibold">Retiros</th>
                  <th className="text-left py-1 font-semibold">Último</th>
                  <th className="text-right py-1 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.retirosPorSocio.map((r) => (
                  <tr key={r.socioId}>
                    <td className="py-1.5 font-semibold">{r.socioNombre}</td>
                    <td className="py-1.5 text-slate-500">{r.cantidadRetiros} retiro{r.cantidadRetiros === 1 ? '' : 's'}</td>
                    <td className="py-1.5 text-slate-600">
                      {r.fechaUltimoRetiro ? formatFechaCorta(r.fechaUltimoRetiro) : '—'}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-rose-700">
                      −{formatCurrencyPEN(r.totalRetiradoPEN)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Banner pedagógico */}
        <div className="mt-4 pt-3 border-t border-slate-100 bg-violet-50/30 -mx-5 px-5 py-2.5 text-[11px] text-violet-900 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-violet-700 mt-0.5" />
          <div>
            <strong>Política de distribución:</strong> de cada S/100 ganados,{' '}
            <strong>S/{pctReinvertido.toFixed(0)} se reinvierten</strong> y{' '}
            <strong>S/{pctDistribuido.toFixed(0)} se distribuyen</strong>.{' '}
            {pctReinvertido > 60
              ? 'Estás priorizando crecimiento sobre dividendos · típico en PyME en expansión.'
              : 'Estás equilibrando crecimiento y distribución.'}
          </div>
        </div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SECCIÓN 6 · SALUD FINANCIERA
// ═════════════════════════════════════════════════════════════════════════

function SeccionSaludFinanciera({ data }: { data: ResumenInversionista }) {
  const meses = data.soberania.mesesParaSoberania;
  const totalComprometido = data.capitalComprometido.totalPEN;
  const liberado = data.capitalComprometido.cashAportadoPEN;
  const restante = data.capitalComprometido.deudaTCPersonalPEN;
  const pctCamino = totalComprometido > 0 ? (liberado / totalComprometido) * 100 : 100;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-[11px]">6</div>
        <h2 className="text-[14px] font-bold text-slate-900">Salud financiera · perspectiva inversionista</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card · Soberanía financiera */}
        <div className="bg-white border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flag className="w-4 h-4 text-amber-700" />
            <h3 className="text-[12px] font-bold text-amber-900">¿Cuándo el negocio camina solo?</h3>
          </div>
          {restante > 0 && data.soberania.pagoMensualEstimadoPEN > 0 ? (
            <>
              <p className="text-[11px] text-slate-600 mb-3">
                Pagando ~{formatCurrencyPEN(data.soberania.pagoMensualEstimadoPEN)}/mes de TC con la utilidad,
                llegás a S/0 de deuda personal en:
              </p>
              <div className="text-[24px] font-bold tabular-nums text-amber-900">
                ~{Math.ceil(meses)} meses
              </div>
              <div className="text-[11px] text-amber-700 mb-3">
                Soberanía financiera 100%
              </div>
            </>
          ) : restante === 0 ? (
            <>
              <p className="text-[11px] text-slate-600 mb-3">No hay deuda personal vigente.</p>
              <div className="text-[24px] font-bold tabular-nums text-emerald-900">✓ Liberado</div>
              <div className="text-[11px] text-emerald-700 mb-3">Soberanía financiera 100% alcanzada</div>
            </>
          ) : (
            <>
              <p className="text-[11px] text-slate-600 mb-3">
                Aún no hay utilidad recurrente para proyectar pago de TC.
              </p>
              <div className="text-[24px] font-bold tabular-nums text-slate-700">—</div>
            </>
          )}

          {/* Barra de progreso */}
          <div className="h-6 bg-slate-100 rounded-lg overflow-hidden relative">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-600"
              style={{ width: `${Math.min(100, Math.max(0, pctCamino))}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
              {pctCamino.toFixed(0)}% del camino · {formatCurrencyPEN(restante)} restantes
            </div>
          </div>
        </div>

        {/* Card · Equity ratio detalle */}
        <div className="bg-white border border-emerald-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <h3 className="text-[12px] font-bold text-emerald-900">Equity ratio · cuán libre de deuda</h3>
          </div>
          <p className="text-[11px] text-slate-600 mb-3">
            % del activo que es realmente tuyo (sin financiar con deuda):
          </p>
          <div className="text-[24px] font-bold tabular-nums text-emerald-900">
            {data.equityRatio.porcentaje.toFixed(0)}%
          </div>
          <div className="text-[11px] text-emerald-700 mb-3 capitalize">{data.equityRatio.salud}</div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-600">Patrimonio</span>
              <span className="tabular-nums font-semibold">
                {formatCurrencyPEN(data.equityRatio.patrimonioPEN)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Activos totales</span>
              <span className="tabular-nums font-semibold">
                {formatCurrencyPEN(data.equityRatio.activosPEN)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Múltiplos financieros */}
      <div className="mt-3 bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="text-[12px] font-bold text-slate-900 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-600" />
          Múltiplos financieros · valuación aproximada
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          <div className="bg-slate-50 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-slate-500 mb-0.5">Patrimonio / Ventas mes</div>
            <div className="text-[14px] font-bold tabular-nums text-slate-900">
              {data.ventasMesActualPEN > 0
                ? `${(data.patrimonioPEN / data.ventasMesActualPEN).toFixed(2)}x`
                : '—'}
            </div>
            <div className="text-[9px] text-slate-500">eficiencia capital</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-slate-500 mb-0.5">Margen neto mes</div>
            <div className="text-[14px] font-bold tabular-nums text-slate-900">
              {data.margenNetoMesActual.toFixed(1)}%
            </div>
            <div className="text-[9px] text-slate-500">de ventas</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-slate-500 mb-0.5">Valuación aprox.</div>
            <div className="text-[14px] font-bold tabular-nums text-slate-900">
              {data.roiDual.utilidadNetaAcumuladaPEN > 0
                ? `${formatCurrencyPEN(data.roiDual.utilidadNetaAcumuladaPEN * 2)}—${formatCurrencyPEN(data.roiDual.utilidadNetaAcumuladaPEN * 3)}`
                : '—'}
            </div>
            <div className="text-[9px] text-slate-500">2-3x UN anual</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-emerald-700 mb-0.5">Multiplicador</div>
            <div className="text-[14px] font-bold tabular-nums text-emerald-900">
              {data.multiplicador.multiplicador > 0 ? `${data.multiplicador.multiplicador.toFixed(2)}x` : '—'}
            </div>
            <div className="text-[9px] text-emerald-700">por S/1 puesto</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SECCIÓN 7 · REPORTES EJECUTIVOS
// ═════════════════════════════════════════════════════════════════════════

function SeccionReportes({ data, mes, anio }: { data: ResumenInversionista; mes: number; anio: number }) {
  const handleExportCSV = () => {
    const filename = `inversionistas-${anio}-${String(mes).padStart(2, '0')}.csv`;
    const rows: Array<[string, string | number]> = [
      ['Métrica', 'Valor'],
      ['Período', `${MESES_NOMBRE_LARGO[mes]} ${anio}`],
      ['Tipo de cambio usado', data.tipoCambio.toFixed(4)],
      ['', ''],
      ['CAPITAL', ''],
      ['Cash propio aportado', data.capitalComprometido.cashAportadoPEN.toFixed(2)],
      ['Deuda TC personal vigente', data.capitalComprometido.deudaTCPersonalPEN.toFixed(2)],
      ['Capital comprometido total', data.capitalComprometido.totalPEN.toFixed(2)],
      ['', ''],
      ['PATRIMONIO Y SALUD', ''],
      ['Patrimonio actual', data.patrimonioPEN.toFixed(2)],
      ['Activos totales', data.activosPEN.toFixed(2)],
      ['Pasivos totales', data.pasivosPEN.toFixed(2)],
      ['Equity Ratio (%)', data.equityRatio.porcentaje.toFixed(2)],
      ['Salud equity', data.equityRatio.salud],
      ['', ''],
      ['RETORNO', ''],
      ['Utilidad neta acumulada 12m', data.roiDual.utilidadNetaAcumuladaPEN.toFixed(2)],
      ['ROI sobre cash propio (%)', (data.roiDual.sobreCashAportado * 100).toFixed(2)],
      ['ROI sobre capital comprometido (%)', (data.roiDual.sobreCapitalComprometido * 100).toFixed(2)],
      ['Multiplicador patrimonio', data.multiplicador.multiplicador.toFixed(2)],
      ['', ''],
      ['SOBERANÍA FINANCIERA', ''],
      ['Meses para liberar TC', data.soberania.mesesParaSoberania.toFixed(1)],
      ['Pago mensual estimado a TC', data.soberania.pagoMensualEstimadoPEN.toFixed(2)],
      ['Estado de soberanía', data.soberania.estado],
    ];

    const csv =
      '﻿' +
      rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-[11px]">7</div>
        <h2 className="text-[14px] font-bold text-slate-900">Reportes ejecutivos · exportables</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => alert('Próximamente · generación de PDF de directorio')}
          className="bg-white border-2 border-violet-200 hover:border-violet-400 rounded-2xl p-4 text-left transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mb-2">
            <FileText className="w-5 h-5 text-violet-700" />
          </div>
          <div className="text-[12px] font-bold text-violet-900 mb-0.5">Reporte directorio · PDF</div>
          <div className="text-[10px] text-slate-500">Próximamente · 1 página · todas las secciones</div>
        </button>

        <button
          type="button"
          onClick={handleExportCSV}
          className="bg-white border-2 border-emerald-200 hover:border-emerald-400 rounded-2xl p-4 text-left transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
          </div>
          <div className="text-[12px] font-bold text-emerald-900 mb-0.5">Exportar para socios · CSV</div>
          <div className="text-[10px] text-slate-500">métricas clave + aportes + retiros</div>
        </button>

        <button
          type="button"
          onClick={() => alert('Próximamente · slides ejecutivas en PPTX')}
          className="bg-white border-2 border-amber-200 hover:border-amber-400 rounded-2xl p-4 text-left transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-2">
            <Presentation className="w-5 h-5 text-amber-700" />
          </div>
          <div className="text-[12px] font-bold text-amber-900 mb-0.5">Presentación junta · PPTX</div>
          <div className="text-[10px] text-slate-500">próximamente · slides ejecutivas</div>
        </button>
      </div>

      <div className="mt-3 bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100">
          <h3 className="text-[12px] font-bold text-slate-900 flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-slate-600" />
            Histórico de reportes generados
          </h3>
        </div>
        <div className="px-4 py-6 text-center text-[11px] text-slate-500">
          Sin reportes generados aún · usá los botones arriba para empezar.
        </div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════

export default function Inversionistas() {
  const ahora = new Date();
  const [mes, setMes] = useState<number>(ahora.getMonth() + 1);
  const [anio, setAnio] = useState<number>(ahora.getFullYear());
  const [data, setData] = useState<ResumenInversionista | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aniosDisponibles = useMemo(() => {
    const out: number[] = [];
    for (let y = ahora.getFullYear(); y >= ahora.getFullYear() - 3; y--) out.push(y);
    return out;
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    try {
      const resumen = await inversionistaService.calcularResumenInversionista(mes, anio);
      setData(resumen);
    } catch (err) {
      console.error('Error cargando datos inversionistas:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [mes, anio]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* §A · BREADCRUMB canon S9.D1 */}
        <div className="border-b border-slate-200 px-6 py-2.5 flex items-center gap-3 bg-slate-50">
          <div className="flex items-center text-[12px] flex-1">
            <a className="text-slate-500 hover:text-violet-700 cursor-pointer">Inicio</a>
            <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5" />
            <span className="text-slate-900 font-semibold">Inversionistas</span>
          </div>
          <span className="text-[10px] bg-violet-50 text-violet-700 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Acceso restringido · solo socios
          </span>
        </div>

        {/* §B · HEADER banking-grade · icon violet */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 flex-1 min-w-[260px]">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white flex-shrink-0">
                <Landmark className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inversionistas</h1>
                <p className="text-[13px] text-slate-500 leading-snug">
                  Vista estratégica · capital comprometido · retorno sobre inversión · trayectoria del negocio · sin operativos día a día
                </p>
              </div>
            </div>
            {/* Acciones header · 3-tier canon */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={mes}
                  onChange={(e) => setMes(Number(e.target.value))}
                  className="text-[11px] font-semibold bg-transparent focus:outline-none cursor-pointer"
                >
                  {MESES_NOMBRE_LARGO.slice(1).map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select
                  value={anio}
                  onChange={(e) => setAnio(Number(e.target.value))}
                  className="text-[11px] font-semibold bg-transparent focus:outline-none cursor-pointer"
                >
                  {aniosDisponibles.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={cargarDatos}
                disabled={loading}
                className="text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Recargar</span>
              </button>
              <button
                type="button"
                onClick={() => alert('Próximamente · gestión de socios y participaciones')}
                className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <UserCog className="w-3 h-3" />
                <span className="hidden sm:inline">Configurar socios</span>
              </button>
              <button
                type="button"
                onClick={() => alert('Próximamente · PDF reporte directorio')}
                className="text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <FileText className="w-3 h-3" />
                <span className="hidden sm:inline">Reporte directorio</span>
              </button>
            </div>
          </div>
        </div>

        {/* §C · KPI STRIP canon N1+N2 · 5 cards */}
        {data && (
          <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiInversionistaCard
              tinte="violet"
              icon={<Wallet />}
              label="CAPITAL COMPROMETIDO"
              valor={formatCurrencyPEN(data.capitalComprometido.totalPEN)}
              delta={`${formatCurrencyPEN(data.capitalComprometido.cashAportadoPEN)} propio · ${formatCurrencyPEN(data.capitalComprometido.deudaTCPersonalPEN)} TC`}
              tooltip="Cash propio aportado + TC personal asumida"
            />
            <KpiInversionistaCard
              tinte="indigo"
              icon={<PiggyBank />}
              label="PATRIMONIO ACTUAL"
              valor={formatCurrencyPEN(data.patrimonioPEN)}
              delta={data.activosPEN > 0 ? `${(data.patrimonioPEN / data.activosPEN * 100).toFixed(0)}% de los activos` : '—'}
              deltaIcon="up"
            />
            <KpiInversionistaCard
              tinte="emerald"
              icon={<ShieldCheck />}
              label="EQUITY RATIO"
              valor={`${data.equityRatio.porcentaje.toFixed(0)}%`}
              delta={`${formatCurrencyPEN(data.patrimonioPEN)} libre · ${formatCurrencyPEN(data.pasivosPEN)} deuda`}
              tooltip="% del activo que es REALMENTE tuyo · libre de deuda"
            />
            <KpiInversionistaCard
              tinte="amber"
              icon={<TrendingUp />}
              label="ROI ANUALIZADO"
              valor={`${(data.roiDual.sobreCapitalComprometido * 100).toFixed(0)}%`}
              delta={data.roiDual.sobreCapitalComprometido > 0.05 ? `vs ~5% plazo fijo · ${(data.roiDual.sobreCapitalComprometido / 0.05).toFixed(1)}x mejor` : '—'}
              tooltip="Sobre capital comprometido total"
            />
            <KpiInversionistaCard
              tinte="purple"
              icon={<Zap />}
              label="MULTIPLICADOR"
              valor={data.multiplicador.multiplicador > 0 ? `${data.multiplicador.multiplicador.toFixed(2)}x` : '—'}
              delta={data.multiplicador.multiplicador > 0 ? `Por cada S/1 puesto · valen S/${data.multiplicador.multiplicador.toFixed(2)}` : 'Sin data'}
              tooltip="Patrimonio actual / Capital aportado original"
            />
          </div>
        )}

        {/* §D · BODY · 7 secciones */}
        <div className="p-6 space-y-6">
          {loading && !data && (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-violet-500 animate-spin mx-auto mb-3" />
              <p className="text-[13px] text-slate-600">Cargando vista ejecutiva...</p>
              <p className="text-[11px] text-slate-400 mt-1">Agregando aportes · TC personales · trayectoria 24m</p>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-[13px] font-semibold text-rose-900">Error al cargar la vista</div>
                <div className="text-[11px] text-rose-700 mt-0.5">{error}</div>
              </div>
            </div>
          )}

          {data && !loading && (
            <>
              <SeccionResumenEjecutivo data={data} />
              <SeccionMiCapital data={data} />
              <SeccionTrayectoria data={data} />
              <SeccionRoiDual data={data} />
              <SeccionDistribucion data={data} />
              <SeccionSaludFinanciera data={data} />
              <SeccionReportes data={data} mes={mes} anio={anio} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function formatFechaCorta(ts: Timestamp): string {
  const d = ts.toDate();
  return `${String(d.getDate()).padStart(2, '0')}/${MESES_NOMBRES[d.getMonth()]}/${d.getFullYear()}`;
}
