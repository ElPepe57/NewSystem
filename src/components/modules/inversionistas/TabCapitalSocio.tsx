/**
 * TabCapitalSocio · F14.1 (2026-06-06)
 *
 * Tab contextual "Capital" inyectado al UserPanel (F6-E) desde Inversionistas.
 * Es el HOGAR ÚNICO del capital del socio: consolida las piezas hoy dispersas
 * en 4 forms/3 módulos (cash + deuda TC + valor + fundacional).
 *
 * Alineación canon:
 *   - NO es un drill-down nuevo · es un TabContextual del UserPanel (reusa
 *     header/avatar/tabs core/ESC/overlay/sheet del panel).
 *   - Color violet (chrome Inversionistas) + semántico en datos
 *     (emerald=cash · rose=deuda TC · sky=valor · amber=fundacional/salud).
 *   - TC PROTAGONISTA (primera sección · ~80% del negocio).
 *
 * F1 (esta entrega): read-only sobre `ResumenInversionista` (ya cargado por el
 * módulo). Las acciones (aporte/TC/valor) se cablean en F2-F4 vía los callbacks
 * opcionales · si no se pasan, el botón no se renderiza (cero botón muerto).
 *
 * Pixel-perfect: docs/mockups/inversionistas-ficha-capital-socio-v2.html (Acto 2).
 */
import React from 'react';
import {
  CreditCard,
  Banknote,
  Brain,
  Gauge,
  Target,
  Plus,
  Pencil,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { formatCurrencyPEN } from '../../../utils/format';
import { formatFechaCorta } from './shared';
import type { ResumenInversionista } from '../../../types/inversionista.types';

interface Props {
  socioId: string;
  data: ResumenInversionista;
  /** F2 · abre el modal de aporte (socio pre-cargado). Si ausente, no se muestra el botón. */
  onRegistrarAporte?: () => void;
  /** F3 · abre el CuentaWizard pre-contextualizado (TC personal del socio). */
  onRegistrarTC?: () => void;
  /** F4 · abre el editor del aporte de valor (datosSocio). */
  onEditarValor?: () => void;
}

export default function TabCapitalSocio({
  socioId,
  data,
  onRegistrarAporte,
  onRegistrarTC,
  onEditarValor,
}: Props) {
  // ── Datos del socio (filtrados del resumen ya cargado) ──────────────────
  const aporteSocio = data.aportesPorSocio.find((a) => a.socioId === socioId);
  const tcSocio = data.tcPersonalesPorSocio.find((s) => s.socioId === socioId);
  const capSocio = data.capitalComprometido.porSocio?.find((s) => s.socioId === socioId);

  const cash = capSocio?.cash ?? aporteSocio?.totalAportadoPEN ?? 0;
  const deudaTC = capSocio?.deudaTC ?? tcSocio?.totalComprometidoPEN ?? 0;
  const valorEst = capSocio?.valorEstimado ?? 0;
  const comprometido = cash + deudaTC;
  const pctTC = comprometido > 0 ? (deudaTC / comprometido) * 100 : 0;
  const tarjetas = tcSocio?.tarjetas ?? [];
  const tieneTC = tarjetas.length > 0 && deudaTC > 0;

  const labelApalancamiento =
    pctTC < 20 ? 'bajo' : pctTC < 40 ? 'moderado' : pctTC < 60 ? 'alto' : 'muy alto';

  return (
    <div className="space-y-4">
      {/* ── Banner salud del capital del socio ──────────────────────────── */}
      {tieneTC ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-2.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Gauge className="w-4 h-4" />
          </div>
          <div className="flex-1 text-[12px]">
            <span className="font-semibold text-amber-900">
              Apalancamiento {labelApalancamiento} · {pctTC.toFixed(0)}% es deuda TC
            </span>
            {data.soberania.mesesParaSoberania > 0 && (
              <>
                {' '}·{' '}
                <span className="text-amber-700">
                  soberanía del negocio: <strong>{data.soberania.mesesParaSoberania} meses</strong>
                </span>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-2.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="flex-1 text-[12px]">
            <span className="font-semibold text-emerald-900">Sin apalancamiento</span>{' '}
            <span className="text-emerald-700">· capital libre de deuda TC.</span>
          </div>
        </div>
      )}

      {/* ── KPIs (4) ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-gradient-to-br from-violet-50 to-violet-100/40 ring-1 ring-violet-200/50 rounded-xl p-3">
          <div className="text-[9px] uppercase tracking-wider text-violet-700 font-bold mb-0.5">Comprometido</div>
          <div className="text-[18px] font-bold tabular-nums text-violet-900">{formatCurrencyPEN(comprometido)}</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-xl p-3">
          <div className="text-[9px] uppercase tracking-wider text-emerald-700 font-bold mb-0.5">Cash</div>
          <div className="text-[18px] font-bold tabular-nums text-emerald-900">{formatCurrencyPEN(cash)}</div>
        </div>
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50 rounded-xl p-3">
          <div className="text-[9px] uppercase tracking-wider text-rose-700 font-bold mb-0.5">Deuda TC</div>
          <div className="text-[18px] font-bold tabular-nums text-rose-900">{formatCurrencyPEN(deudaTC)}</div>
        </div>
        <div className="bg-gradient-to-br from-sky-50 to-sky-100/40 ring-1 ring-sky-200/50 rounded-xl p-3">
          <div className="text-[9px] uppercase tracking-wider text-sky-700 font-bold mb-0.5">Valor est.</div>
          <div className="text-[18px] font-bold tabular-nums text-sky-900">
            {valorEst > 0 ? formatCurrencyPEN(valorEst) : '—'}
          </div>
        </div>
      </div>

      {/* ── Sección TC · PROTAGONISTA (primera por peso ~80%) ───────────── */}
      <div className="border-2 border-rose-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-rose-50/50 border-b border-rose-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[12px] font-bold text-rose-800">
            <CreditCard className="w-4 h-4" /> Deuda TC personal
          </div>
          {onRegistrarTC && (
            <button
              type="button"
              onClick={onRegistrarTC}
              className="text-[11px] font-semibold text-white bg-violet-600 hover:bg-violet-700 px-2.5 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Registrar TC
            </button>
          )}
        </div>
        {tieneTC ? (
          <div className="px-4 py-3 space-y-2.5">
            {tarjetas.map((t) => (
              <div key={t.cuentaCajaId}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-medium text-slate-900">
                    {t.nombre} · <span className="text-slate-400">{t.moneda}</span>
                  </span>
                  <span className="text-[12px] font-bold tabular-nums text-rose-700">
                    {formatCurrencyPEN(t.utilizado)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-slate-500 mb-0.5">
                  <span>de {formatCurrencyPEN(t.limite)}</span>
                  <span className={`font-bold ${t.porcentajeUso >= 70 ? 'text-rose-600' : 'text-amber-600'}`}>
                    {t.porcentajeUso.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${t.porcentajeUso >= 70 ? 'bg-rose-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(t.porcentajeUso, 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {/* des-apalancamiento (soberanía · negocio) */}
            {data.soberania.mesesParaSoberania > 0 && (
              <div className="rounded-lg bg-violet-50 border border-violet-200 p-2.5 mt-1">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-bold text-violet-800 flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" /> Soberanía (negocio)
                  </span>
                  <span className="font-bold text-violet-700">{data.soberania.mesesParaSoberania} meses</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-[11px] text-slate-500">
            Este socio no tiene tarjetas de crédito asumidas por el negocio.
          </div>
        )}
      </div>

      {/* ── Sección Cash ────────────────────────────────────────────────── */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[12px] font-bold text-emerald-800">
            <Banknote className="w-4 h-4" /> Cash aportado
          </div>
          {onRegistrarAporte && (
            <button
              type="button"
              onClick={onRegistrarAporte}
              className="text-[11px] font-semibold text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Aporte
            </button>
          )}
        </div>
        {aporteSocio && aporteSocio.cantidadAportes > 0 ? (
          <div className="px-4 py-3 flex items-center justify-between text-[12px]">
            <div className="text-slate-600">
              {aporteSocio.cantidadAportes} aporte{aporteSocio.cantidadAportes === 1 ? '' : 's'} ·{' '}
              <span className="text-slate-400">último {formatFechaCorta(aporteSocio.fechaUltimoAporte)}</span>
            </div>
            <span className="tabular-nums font-bold text-emerald-700">{formatCurrencyPEN(cash)}</span>
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-[11px] text-slate-500">
            Sin aportes de cash registrados para este socio.
          </div>
        )}
      </div>

      {/* ── Sección Valor (no-monetario) ────────────────────────────────── */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-sky-50/50 border-b border-sky-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[12px] font-bold text-sky-800">
            <Brain className="w-4 h-4" /> Aporte de valor
          </div>
          {onEditarValor && (
            <button
              type="button"
              onClick={onEditarValor}
              className="text-[11px] font-semibold text-sky-700 bg-white border border-sky-200 hover:bg-sky-50 px-2.5 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
          )}
        </div>
        <div className="px-4 py-3">
          {valorEst > 0 ? (
            <div className="flex items-center gap-2 text-[12px]">
              <Sparkles className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="text-slate-600">Valuación estimada del aporte no-monetario</span>
              <span className="tabular-nums font-bold text-sky-700 ml-auto">{formatCurrencyPEN(valorEst)}</span>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500">
              Sin valuación declarada ·{' '}
              <span className="text-slate-400">know-how · gestión · marca se editan en el sub-perfil del socio.</span>
            </div>
          )}
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[9px] text-slate-400">
            <ShieldCheck className="w-3 h-3" /> dato privado · persiste en datosSocio
          </div>
        </div>
      </div>
    </div>
  );
}
