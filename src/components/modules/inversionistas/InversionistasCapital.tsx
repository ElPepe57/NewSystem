/**
 * Tab 2 · Mi Capital · histórico y composición
 *
 * Canon F4 v7.0: tabla en desktop, cards apiladas en mobile (<md).
 * Donut composición: stack vertical en mobile, lado-a-lado en desktop.
 */
import React, { useState, useMemo } from 'react';
import {
  Wallet,
  Plus,
  PieChart,
  Lightbulb,
  CreditCard,
  Sparkles,
  Banknote,
  ExternalLink,
  Coins,
  UsersRound,
  UserPlus,
  Pencil,
} from 'lucide-react';
import { formatCurrencyPEN } from '../../../utils/format';
import { formatFechaCorta } from './shared';
import { DataCard } from '../../../design-system/components/DataCard';
import type { StatusVariant } from '../../../design-system/tokens';
import type { ResumenInversionista } from '../../../types/inversionista.types';
import type { TipoParticipacionSocio } from '../../../types/datosSocio.types';
// chk5.PERSONAS-v5.7 · E6.2 (2026-05-28) · Click en socio → UserPanel canon F6-E
import { UserPanel } from '../../usuarios/UserPanel';
import type { TabContextual } from '../../usuarios/UserPanel';
import TabCapitalSocio from './TabCapitalSocio';
import EditarValorSocioModal from './EditarValorSocioModal';
import { useSocioStore } from '../../../store/socioStore';

// C · tipo de participación → label corto + variant semántico (cash=emerald · mixta=amber · valor=sky)
const TIPO_PART_SHORT: Record<TipoParticipacionSocio, string> = {
  cash_puro: 'Cash puro',
  mixta: 'Mixta',
  valor_puro: 'Valor puro',
};
const TIPO_PART_VARIANT: Record<TipoParticipacionSocio, StatusVariant> = {
  cash_puro: 'success',
  mixta: 'warning',
  valor_puro: 'info',
};

interface Props {
  data: ResumenInversionista;
  /** F14.2 · refresca el resumen tras registrar capital (provisto por el shell). */
  onRefetch?: () => void;
  /** F14.G · abre el modal Registrar capital del shell (socioId opcional · pre-cargado). */
  onAbrirMovimiento?: (socioId?: string) => void;
  /** F14.G · abre el CuentaWizard de TC directo del shell (socio pre-cargado). */
  onAbrirTC?: (socioId: string) => void;
  /** C · abre el modal de alta de socio (del shell). */
  onNuevoSocio?: () => void;
}

export default function InversionistasCapital({ data, onRefetch, onAbrirMovimiento, onAbrirTC, onNuevoSocio }: Props) {
  // chk5.PERSONAS-v5.7 · E6.2 · UserPanel state + lookup de userId por socioId
  const [panelUid, setPanelUid] = useState<string | null>(null);
  // F14.1 · socio del panel (para inyectar el tab "Capital" contextual)
  const [panelSocioId, setPanelSocioId] = useState<string | null>(null);
  // F14.4 · modal editar participación + aporte de valor (D3)
  const [valorModalOpen, setValorModalOpen] = useState(false);
  const socios = useSocioStore((s) => s.socios);

  // Map { socioId → userId } para lookup rápido en el render
  const userIdBySocioId = useMemo(() => {
    const m: Record<string, string> = {};
    socios.forEach((s) => {
      if (s.userId) m[s.id] = s.userId;
    });
    return m;
  }, [socios]);

  // Nombre del socio del panel · para el modal de aporte
  const panelSocioNombre = useMemo(
    () => socios.find((s) => s.id === panelSocioId)?.nombre ?? '',
    [socios, panelSocioId],
  );

  // F14.1 · tab contextual "Capital" inyectado al UserPanel (hogar del capital
  // del socio · canon: NO drill-down nuevo, sí TabContextual del panel existente).
  const tabsCapital = useMemo<TabContextual[]>(() => {
    if (!panelSocioId) return [];
    const sid = panelSocioId;
    return [{
      id: 'capital',
      label: 'Capital',
      icon: Coins,
      render: () => (
        <TabCapitalSocio
          socioId={sid}
          data={data}
          onRegistrarAporte={() => onAbrirMovimiento?.(sid)}
          onRegistrarTC={() => onAbrirTC?.(sid)}
          onEditarValor={() => setValorModalOpen(true)}
        />
      ),
    }];
  }, [panelSocioId, data]);

  const totalAportes = data.aportesPorSocio.reduce((a, b) => a + b.totalAportadoPEN, 0);
  const cash = data.capitalComprometido.cashAportadoPEN;
  const tc = data.capitalComprometido.deudaTCPersonalPEN;
  const valor = data.capitalComprometido.valorEstimadoTotalPEN;
  const total = cash + tc;
  const pctCash = total > 0 ? (cash / total) * 100 : 0;
  const pctTC = total > 0 ? (tc / total) * 100 : 0;

  // chk5.F3-ADAPT · D7 · cap table del negocio · cash + TC + valor estimado
  const capTableTotal = cash + tc + valor;
  const pctCapCash = capTableTotal > 0 ? (cash / capTableTotal) * 100 : 0;
  const pctCapTC = capTableTotal > 0 ? (tc / capTableTotal) * 100 : 0;
  const pctCapValor = capTableTotal > 0 ? (valor / capTableTotal) * 100 : 0;

  // Donut SVG
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const cashLen = (pctCash / 100) * circumference;
  const tcLen = (pctTC / 100) * circumference;

  const labelApalancamiento =
    pctTC < 20 ? 'bajo' : pctTC < 40 ? 'moderado' : pctTC < 60 ? 'alto' : 'muy alto';

  return (
    <div className="space-y-4">
      {/* chk5.F3-ADAPT · D7 · KPI strip cap table del negocio (3 cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">CASH NETO INVERTIDO</span>
            <Banknote className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-[22px] font-bold tabular-nums text-emerald-900">{formatCurrencyPEN(cash)}</div>
          <div className="text-[10px] text-emerald-700">
            {capTableTotal > 0 ? `${pctCapCash.toFixed(0)}% del valor monetario` : 'Sin aportes registrados'}
          </div>
        </div>
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">TC PERSONAL ASUMIDA</span>
            <CreditCard className="w-3.5 h-3.5 text-rose-700" />
          </div>
          <div className="text-[22px] font-bold tabular-nums text-rose-900">{formatCurrencyPEN(tc)}</div>
          <div className="text-[10px] text-rose-700">
            {capTableTotal > 0 ? `${pctCapTC.toFixed(0)}% · deuda asumida` : 'Sin TCs vinculadas'}
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">VALOR APORTADO (est.)</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-[22px] font-bold tabular-nums text-amber-900">
            {valor > 0 ? formatCurrencyPEN(valor) : '—'}
          </div>
          <div className="text-[10px] text-amber-700">
            {valor > 0
              ? `${pctCapValor.toFixed(0)}% · know-how + IP + gestión`
              : 'Sin valuación declarada · ver datosSocio'}
          </div>
        </div>
      </div>

      {/* ── C · SOCIOS DEL NEGOCIO · lista por SOCIO (no por aporte) · su hogar real ──
          DataCard del kit · todos los socios aparecen aunque no hayan puesto cash. */}
      <div className="border-2 border-violet-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 bg-violet-50/60 border-b border-violet-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[12px] font-bold text-violet-900">
            <UsersRound className="w-4 h-4" /> Socios del negocio · {socios.length}
          </div>
          {onNuevoSocio && (
            <button
              type="button"
              onClick={onNuevoSocio}
              className="text-[10px] font-semibold text-violet-700 bg-white border border-violet-200 hover:bg-violet-50 px-2.5 py-1 rounded-lg inline-flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" /> Nuevo socio
            </button>
          )}
        </div>
        {socios.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center mx-auto mb-2">
              <UsersRound className="w-5 h-5 text-violet-600" />
            </div>
            <div className="text-[13px] font-bold text-slate-900 mb-0.5">Aún no tenés socios registrados</div>
            <div className="text-[11px] text-slate-500 mb-3">Agregá el primero para ver participación, capital y ROI.</div>
            {onNuevoSocio && (
              <button
                type="button"
                onClick={onNuevoSocio}
                className="text-[12px] font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3.5 py-2 rounded-lg inline-flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" /> Agregar primer socio
              </button>
            )}
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {socios.map((s) => {
              const cap = data.capitalComprometido.porSocio?.find((p) => p.socioId === s.id);
              const tipo = cap?.tipoParticipacion;
              const comprometido = (cap?.cash ?? 0) + (cap?.deudaTC ?? 0);
              const valorEst = cap?.valorEstimado ?? 0;
              const uid = s.userId;
              const abrir = uid ? () => { setPanelUid(uid); setPanelSocioId(s.id); } : undefined;
              // El aporte se muestra según su naturaleza: monetario (cash+TC) y/o valor
              // no-monetario (know-how · IP · gestión). Un socio valor_puro NO pone cash
              // pero SÍ aporta valor → el card lo refleja (no "S/ 0").
              const stats: Array<{ label: string; value: string }> = [
                { label: 'Participación', value: `${s.porcentajeParticipacion}%` },
              ];
              if (comprometido > 0) stats.push({ label: 'Comprometido', value: formatCurrencyPEN(comprometido) });
              if (valorEst > 0) stats.push({ label: 'Valor aportado', value: formatCurrencyPEN(valorEst) });
              if (stats.length === 1) stats.push({ label: 'Aporte', value: '—' });
              return (
                <DataCard
                  key={s.id}
                  title={s.nombre}
                  subtitle={s.rol || 'Socio'}
                  status={tipo ? { label: TIPO_PART_SHORT[tipo], variant: TIPO_PART_VARIANT[tipo] } : undefined}
                  accentVariant={tipo ? TIPO_PART_VARIANT[tipo] : 'neutral'}
                  stats={stats}
                  onClick={abrir}
                  actions={
                    abrir ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); abrir(); }}
                        className="text-[11px] font-semibold text-violet-700 bg-white border border-violet-200 hover:bg-violet-50 px-2.5 py-1 rounded-lg inline-flex items-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Ver participación
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-300" title="Socio sin cuenta de usuario">—</span>
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Layout grid · stack en mobile (<lg), 2:1 desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Aportes propios · ocupa 2 cols desktop */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-50 to-emerald-100/40 px-4 py-2.5 border-b border-emerald-200/50 flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-bold text-emerald-900 flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5" />
              Aportes propios · cash
            </h3>
            <button
              type="button"
              onClick={() => onAbrirMovimiento?.()}
              className="text-[10px] text-emerald-700 hover:bg-emerald-100 border border-emerald-300 px-2 py-1 rounded inline-flex items-center gap-1 whitespace-nowrap"
              title="Registrar capital"
            >
              <Plus className="w-3 h-3" /> <span className="hidden sm:inline">Nuevo aporte</span>
            </button>
          </div>

          {data.aportesPorSocio.length === 0 ? (
            <div className="px-4 py-8 text-center text-[11px] text-slate-500">
              Sin aportes registrados. Usá Finanzas → Movimientos → Aporte de capital.
            </div>
          ) : (
            <>
              {/* Tabla · solo desktop md+ */}
              <table className="w-full text-[12px] hidden md:table">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-700">Socio</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-700">Aportes</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-700">Último</th>
                    <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-slate-700">Total</th>
                    <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-slate-700"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.aportesPorSocio.map((a) => {
                    const uid = userIdBySocioId[a.socioId];
                    return (
                      <tr key={a.socioId}>
                        <td className="px-3 py-2 font-semibold text-slate-900">{a.socioNombre}</td>
                        <td className="px-3 py-2 text-slate-500">{a.cantidadAportes} aporte{a.cantidadAportes === 1 ? '' : 's'}</td>
                        <td className="px-3 py-2 text-slate-600">{formatFechaCorta(a.fechaUltimoAporte)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">
                          {formatCurrencyPEN(a.totalAportadoPEN)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {uid ? (
                            <button
                              type="button"
                              onClick={() => { setPanelUid(uid); setPanelSocioId(a.socioId); }}
                              className="text-[10px] text-purple-700 hover:text-purple-900 hover:bg-purple-50 px-2 py-1 rounded inline-flex items-center gap-1"
                              title="Ver perfil del socio"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Perfil
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-300" title="Socio sin cuenta de usuario en el sistema">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 font-bold text-emerald-900">Total aportes propios</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-900">
                      {formatCurrencyPEN(totalAportes)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>

              {/* Cards stack · solo mobile <md · canon F4 */}
              <div className="md:hidden divide-y divide-slate-100">
                {data.aportesPorSocio.map((a) => {
                  const uid = userIdBySocioId[a.socioId];
                  return (
                  <div key={a.socioId} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-slate-900 text-[13px] flex items-center gap-2">
                        <span>{a.socioNombre}</span>
                        {uid && (
                          <button
                            type="button"
                            onClick={() => { setPanelUid(uid); setPanelSocioId(a.socioId); }}
                            className="text-[10px] text-purple-700 hover:bg-purple-50 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"
                            title="Ver perfil"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                      <div className="tabular-nums font-bold text-emerald-700 text-[14px]">
                        {formatCurrencyPEN(a.totalAportadoPEN)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                      <span>{a.cantidadAportes} aporte{a.cantidadAportes === 1 ? '' : 's'}</span>
                      <span>Último: {formatFechaCorta(a.fechaUltimoAporte)}</span>
                    </div>
                  </div>
                  );
                })}
                <div className="px-4 py-3 bg-emerald-50 flex justify-between border-t border-emerald-200">
                  <span className="text-[11px] uppercase font-bold text-emerald-900">Total aportes</span>
                  <span className="text-[14px] font-bold tabular-nums text-emerald-900">
                    {formatCurrencyPEN(totalAportes)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Donut composición · stack vertical mobile, lado-a-lado desktop */}
        <div className="bg-white border border-violet-200 rounded-2xl p-4">
          <h3 className="text-[12px] font-bold text-violet-900 mb-3 flex items-center gap-2">
            <PieChart className="w-3.5 h-3.5" />
            Composición del capital
          </h3>
          {total === 0 ? (
            <div className="text-center py-6 text-[11px] text-slate-500">
              Sin capital registrado aún.
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-3">
                <svg viewBox="0 0 100 100" className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 -rotate-90">
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
                <div className="flex-1 text-[11px] space-y-1.5 w-full">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></div>
                    <span className="text-slate-700">Cash propio</span>
                    <span className="ml-auto tabular-nums font-bold text-emerald-900">{pctCash.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-rose-600 flex-shrink-0"></div>
                    <span className="text-slate-700">TC personal</span>
                    <span className="ml-auto tabular-nums font-bold text-rose-900">{pctTC.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-violet-100 text-[10px] text-violet-700 flex items-start gap-1">
                <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>
                  Tu apalancamiento es <strong>{labelApalancamiento}</strong> ({pctTC.toFixed(0)}%).
                  {pctTC > 0 && ' Mientras siga bajando, vas en buen camino.'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Apalancamiento · TC personal asumida */}
      {data.tcPersonalesPorSocio.length > 0 && (
        <div className="bg-white border border-rose-200 rounded-2xl overflow-hidden">
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
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-slate-900 truncate">{tarjeta.nombre} · {s.socioNombre}</div>
                    <div className="text-[10px] text-slate-500 truncate">
                      Garantía personal · negocio paga · {tarjeta.banco || 'banco'}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
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

      {/* chk5.PERSONAS-v5.7 · E6.2 · UserPanel canon F6-E
          Aparece cuando se hace click en "Perfil" en alguna fila/card de socio
          que tiene userId asociado (Socio.userId). Reusa el mismo UserPanel
          que /usuarios y /planilla · 5+1 tabs canon. */}
      <UserPanel
        userId={panelUid}
        onClose={() => { setPanelUid(null); setPanelSocioId(null); }}
        tabInicial="capital"
        tabsContextuales={tabsCapital}
      />

      {/* F14.4 · editar participación + aporte de valor del socio (D3) */}
      {panelUid && (
        <EditarValorSocioModal
          isOpen={valorModalOpen}
          userId={panelUid}
          socioNombre={panelSocioNombre}
          onClose={() => setValorModalOpen(false)}
          onSuccess={() => { setValorModalOpen(false); onRefetch?.(); }}
        />
      )}
    </div>
  );
}
