/**
 * Página de Contabilidad
 * Vista completa con pestañas: Resumen, Balance General, Estado de Resultados, Indicadores, Tendencias, Cierre
 */

import React, { useState, useEffect, useRef, useCallback, type ComponentType } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  BarChart3,
  Calendar,
  RefreshCw,
  Wallet,
  PiggyBank,
  AlertTriangle,
  Target,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  LineChart,
  LayoutDashboard,
  Calculator,
  CircleDollarSign,
  Scale,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Loader2,
  Lock,
  // chk5.E-S1 · canon banking-grade
  ChevronRight,
  ChevronLeft,
  Download,
  Settings2,
  CreditCard,
  // chk5.E-S6 · panel "Alimentado por"
  Receipt,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  StatDistribution,
} from '../../components/common';
import { DataTable } from '../../design-system';
import { FormModalV2 } from '../../design-system/components/FormModalV2';
import type { DataTableColumn } from '../../design-system';
import { EstadoResultados, BalanceGeneral, CierreMensual } from '../../components/modules/contabilidad';
import { ReporteDirectoIndirecto } from '../../components/modules/contabilidad/ReporteDirectoIndirecto';
import { contabilidadService } from '../../services/contabilidad.service';
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';
import type {
  EstadoResultados as EstadoResultadosType,
  ResumenContable,
  TendenciaMensual,
  BalanceGeneral as BalanceGeneralType,
  IndicadoresFinancieros,
  AnalisisFinanciero,
} from '../../types/contabilidad.types';
import { formatCurrencyPEN, formatPercent } from '../../utils/format';

type TabActiva = 'resumen' | 'balance' | 'estado-resultados' | 'indicadores' | 'tendencias' | 'cierre';

// Alias local para mantener llamadas existentes sin alterar (PEN, 0 decimales no soportado
// en format.ts — se usa formatCurrencyPEN que produce 2 decimales; la diferencia visual
// es mínima y unifica el comportamiento).
const formatCurrency = formatCurrencyPEN;

// Color según estado del análisis
const getEstadoColor = (estado: AnalisisFinanciero['estado']) => {
  switch (estado) {
    case 'excelente': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'bueno': return 'bg-sky-100 text-sky-800 border-sky-300';
    case 'regular': return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'malo': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'critico': return 'bg-red-100 text-red-800 border-red-300';
    default: return 'bg-slate-100 text-slate-800 border-slate-300';
  }
};

const getEstadoIcon = (estado: AnalisisFinanciero['estado']) => {
  switch (estado) {
    case 'excelente':
    case 'bueno':
      return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    case 'regular':
      return <AlertCircle className="w-5 h-5 text-amber-600" />;
    case 'malo':
    case 'critico':
      return <XCircle className="w-5 h-5 text-red-600" />;
    default:
      return <Info className="w-5 h-5 text-slate-600" />;
  }
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES CANON · chk5.E-S1 · pixel-perfect Finanzas
// ═════════════════════════════════════════════════════════════════════════

type KpiColor = 'emerald' | 'teal' | 'rose' | 'indigo' | 'amber' | 'sky' | 'purple';

interface KpiContaCardProps {
  label: string;
  value: string;
  color: KpiColor;
  icon: LucideIcon;
  delta?: string;
  deltaPositive?: boolean;
}

const KPI_CARD_BG: Record<KpiColor, string> = {
  emerald: 'bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50',
  teal: 'bg-gradient-to-br from-teal-50 to-teal-100/40 ring-1 ring-teal-200/50',
  rose: 'bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50',
  indigo: 'bg-gradient-to-br from-indigo-50 to-indigo-100/40 ring-1 ring-indigo-200/50',
  amber: 'bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50',
  sky: 'bg-gradient-to-br from-sky-50 to-sky-100/40 ring-1 ring-sky-200/50',
  purple: 'bg-gradient-to-br from-purple-50 to-purple-100/40 ring-1 ring-purple-200/50',
};

const KPI_LABEL_COLOR: Record<KpiColor, string> = {
  emerald: 'text-emerald-700',
  teal: 'text-teal-700',
  rose: 'text-rose-700',
  indigo: 'text-indigo-700',
  amber: 'text-amber-700',
  sky: 'text-sky-700',
  purple: 'text-purple-700',
};

const KPI_VALUE_COLOR: Record<KpiColor, string> = {
  emerald: 'text-emerald-900',
  teal: 'text-teal-900',
  rose: 'text-rose-900',
  indigo: 'text-indigo-900',
  amber: 'text-amber-900',
  sky: 'text-sky-900',
  purple: 'text-purple-900',
};

const KpiContaCard: React.FC<KpiContaCardProps> = ({
  label, value, color, icon: Icon, delta, deltaPositive,
}) => (
  <div className={`rounded-2xl p-4 ${KPI_CARD_BG[color]}`}>
    <div className="flex items-center justify-between mb-2">
      <span className={`text-[10px] uppercase tracking-wider font-bold ${KPI_LABEL_COLOR[color]}`}>
        {label}
      </span>
      <Icon className={`w-3.5 h-3.5 ${KPI_LABEL_COLOR[color]}`} />
    </div>
    <div className={`text-2xl font-bold tabular-nums ${KPI_VALUE_COLOR[color]}`}>
      {value}
    </div>
    {delta && (
      <div className={`text-[11px] mt-1 flex items-center gap-1 ${
        deltaPositive === undefined ? KPI_LABEL_COLOR[color]
        : deltaPositive ? 'text-emerald-700'
        : 'text-rose-700'
      }`}>
        {delta}
      </div>
    )}
  </div>
);

interface ContaTabConfig {
  id: string;
  label: string;
  mobileLabel?: string;
  icon: LucideIcon;
}

interface SubVistaTabsContabilidadProps {
  tabs: ContaTabConfig[];
  activeId: string;
  onTabChange: (id: string) => void;
}

const SubVistaTabsContabilidad: React.FC<SubVistaTabsContabilidadProps> = ({
  tabs, activeId, onTabChange,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const slack = 2;
    setCanScrollLeft(el.scrollLeft > slack);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - slack);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('button[aria-current="page"]');
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    const t = window.setTimeout(updateScrollState, 350);
    return () => window.clearTimeout(t);
  }, [activeId, updateScrollState]);

  const scrollBy = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.6, behavior: 'smooth' });
  }, []);

  return (
    <div className="relative border-b border-slate-200">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Desplazar tabs a la izquierda"
          className="absolute left-0 top-0 bottom-0 z-20 px-1.5 bg-white/95 hover:bg-slate-50 border-r border-slate-200 flex items-center text-slate-600 hover:text-slate-900 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      <div ref={scrollRef} className="px-6 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1 -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={
                  'px-4 py-3 text-[12px] border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ' +
                  (isActive
                    ? 'border-purple-600 text-purple-700 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 font-medium')
                }
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Desplazar tabs a la derecha"
          className="absolute right-0 top-0 bottom-0 z-20 px-1.5 bg-white/95 hover:bg-slate-50 border-l border-slate-200 flex items-center text-slate-600 hover:text-slate-900 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)]"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
      {canScrollRight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-8 h-full w-6 bg-gradient-to-l from-white to-transparent"
        />
      )}
    </div>
  );
};

// ─── DistributionCard (chk5.E-S2 · canon N2 reusable) ───────────────────
// Card de distribución con gradient sutil + ring + items con dot + barra
// de proporción. Reemplaza al <StatDistribution> legacy del design-system.

interface DistributionCardItem {
  label: string;
  value: number;
  /** Clase Tailwind del color del dot · ej "bg-emerald-500" */
  dotColor: string;
}

interface DistributionCardProps {
  color: KpiColor;
  icon: LucideIcon;
  title: string;
  items: DistributionCardItem[];
}

const DistributionCard: React.FC<DistributionCardProps> = ({
  color, icon: Icon, title, items,
}) => {
  // Color signature card (mismo mapeo que KpiContaCard)
  const bg = KPI_CARD_BG[color];
  const labelColor = KPI_LABEL_COLOR[color];
  const valueColor = KPI_VALUE_COLOR[color];
  // Calcular total para % de cada barra
  const total = items.reduce((s, i) => s + Math.abs(i.value), 0);
  return (
    <div className={`rounded-2xl p-4 ${bg}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-3.5 h-3.5 ${labelColor}`} />
        <span className={`text-[10px] uppercase tracking-wider font-bold ${labelColor}`}>
          {title}
        </span>
      </div>
      <div className="space-y-2 text-[11px]">
        {items.map((item, idx) => {
          const pct = total > 0 ? (Math.abs(item.value) / total) * 100 : 0;
          return (
            <React.Fragment key={`${item.label}-${idx}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${item.dotColor}`}></div>
                  <span className={valueColor}>{item.label}</span>
                </div>
                <span className={`tabular-nums font-bold ${valueColor}`}>
                  {item.value.toLocaleString('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className={`h-1 rounded-full overflow-hidden ${bg.split(' ')[1]?.replace('to-', 'bg-').replace('100/40', '100') ?? 'bg-slate-100'}`}>
                <div className={`h-full ${item.dotColor}`} style={{ width: `${pct}%` }}></div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ─── IndicadoresCard (chk5.E-S2 · 1 card por dimensión Liquidez/Solvencia/Rentab/Activ)
// Header gradient FROM-500 TO-700 + body con divide-y de items.

const KPI_GRADIENT_HEAD: Record<KpiColor, string> = {
  emerald: 'bg-gradient-to-r from-emerald-500 to-emerald-700',
  teal: 'bg-gradient-to-r from-teal-500 to-teal-700',
  rose: 'bg-gradient-to-r from-rose-500 to-rose-700',
  indigo: 'bg-gradient-to-r from-indigo-500 to-indigo-700',
  amber: 'bg-gradient-to-r from-amber-500 to-amber-700',
  sky: 'bg-gradient-to-r from-sky-500 to-sky-700',
  purple: 'bg-gradient-to-r from-purple-500 to-purple-700',
};

const KPI_BORDER_LIGHT: Record<KpiColor, string> = {
  emerald: 'border-emerald-200',
  teal: 'border-teal-200',
  rose: 'border-rose-200',
  indigo: 'border-indigo-200',
  amber: 'border-amber-200',
  sky: 'border-sky-200',
  purple: 'border-purple-200',
};

interface IndicadoresCardProps {
  color: KpiColor;
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}

const IndicadoresCard: React.FC<IndicadoresCardProps> = ({ color, icon: Icon, title, children }) => (
  <section className={`bg-white border rounded-2xl overflow-hidden ${KPI_BORDER_LIGHT[color]}`}>
    <div className={`text-white px-4 py-2.5 ${KPI_GRADIENT_HEAD[color]}`}>
      <h3 className="text-[13px] font-bold flex items-center gap-2">
        <Icon className="w-4 h-4" />
        {title}
      </h3>
    </div>
    <div className="divide-y divide-slate-100 text-[12px]">
      {children}
    </div>
  </section>
);

// ─── IndicadorRow (chk5.E-S2 · 1 ratio dentro de IndicadoresCard)

type Semaforo = 'excelente' | 'bueno' | 'regular' | 'atencion' | 'critico';

const SEMAFORO_COLOR: Record<Semaforo, { text: string; label: string; icon: string }> = {
  excelente: { text: 'text-emerald-700', label: 'Excelente', icon: 'text-emerald-600' },
  bueno: { text: 'text-emerald-700', label: 'Bueno', icon: 'text-emerald-600' },
  regular: { text: 'text-amber-700', label: 'Regular', icon: 'text-amber-600' },
  atencion: { text: 'text-orange-700', label: 'Atención', icon: 'text-orange-600' },
  critico: { text: 'text-rose-700', label: 'Crítico', icon: 'text-rose-600' },
};

interface IndicadorRowProps {
  nombre: string;
  formula: string;
  valor: string;
  semaforo: Semaforo;
  /** Override del label del semáforo · ej "Sobreliquidez" */
  semaforoLabel?: string;
  /** Si true · bg purple-50/40 (ratio destacado tipo Ciclo Conversión) */
  destacado?: boolean;
}

const IndicadorRow: React.FC<IndicadorRowProps> = ({
  nombre, formula, valor, semaforo, semaforoLabel, destacado,
}) => {
  const sem = SEMAFORO_COLOR[semaforo];
  const isAlert = semaforo === 'regular' || semaforo === 'atencion' || semaforo === 'critico';
  return (
    <div className={`px-4 py-2.5 flex items-center justify-between ${destacado ? 'bg-purple-50/40' : ''}`}>
      <div className="flex-1 min-w-0 pr-2">
        <div className="font-semibold text-slate-900">{nombre}</div>
        <div className="text-[10px] text-slate-500">{formula}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-[16px] font-bold tabular-nums ${sem.text}`}>{valor}</div>
        <div className={`text-[10px] ${sem.text} flex items-center gap-1 justify-end`}>
          {isAlert
            ? <AlertCircle className={`w-3 h-3 ${sem.icon}`} />
            : <CheckCircle2 className={`w-3 h-3 ${sem.icon}`} />
          }
          {semaforoLabel ?? sem.label}
        </div>
      </div>
    </div>
  );
};

// ─── ConfigurarContableModal (chk5.E-S2) ─────────────────────────────────
// Modal canon FormModalV2 con 4 campos:
//   · Capital Social
//   · Reserva Legal
//   · Provisión Incobrables (%)
//   · TC default fallback

interface ConfigContableForm {
  capitalSocial: number;
  reservaLegal: number;
  tcPorDefecto: number;
  provisionIncobrablesPct: number;
}

interface ConfigurarContableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const ConfigurarContableModal: React.FC<ConfigurarContableModalProps> = ({
  isOpen, onClose, onSaved,
}) => {
  const [capitalStr, setCapitalStr] = useState('0');
  const [reservaStr, setReservaStr] = useState('0');
  const [provisionStr, setProvisionStr] = useState('5');
  const [tcStr, setTcStr] = useState('0');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cargar config al abrir
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setErrorMsg(null);
    contabilidadService.getConfiguracionContable()
      .then((cfg) => {
        setCapitalStr(String(cfg.capitalSocial ?? 0));
        setReservaStr(String(cfg.reservaLegal ?? 0));
        setProvisionStr(String(cfg.provisionIncobrablesPct ?? 5));
        setTcStr(String(cfg.tcPorDefecto ?? 0));
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : 'Error desconocido');
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Parse + validación
  const cap = parseFloat(capitalStr.replace(',', '.'));
  const res = parseFloat(reservaStr.replace(',', '.'));
  const prov = parseFloat(provisionStr.replace(',', '.'));
  const tcN = parseFloat(tcStr.replace(',', '.'));
  const valido = Number.isFinite(cap) && Number.isFinite(res)
    && Number.isFinite(prov) && prov >= 0 && prov <= 100
    && Number.isFinite(tcN) && tcN >= 0;

  // Submit
  const handleSubmit = async () => {
    if (!valido) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await contabilidadService.actualizarConfiguracionContable({
        capitalSocial: cap,
        reservaLegal: res,
        provisionIncobrablesPct: prov,
        tcPorDefecto: tcN,
      });
      onSaved();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Configuración contable"
      subtitle="Parámetros que afectan el cálculo de Balance General y Estado de Resultados"
      icon={Settings2}
      iconTone="purple"
      submitLabel={submitting ? 'Guardando…' : 'Guardar configuración'}
      submitVariant="primary"
      submitIcon={CheckCircle2}
      cancelLabel="Cancelar"
      loading={submitting}
      disabled={!valido || submitting || loading}
      size="md"
    >
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600 mx-auto mb-2" />
            <div className="text-[11px] text-slate-500">Cargando configuración actual…</div>
          </div>
        ) : (
          <>
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-[11px] text-rose-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-700 mt-0.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">
                Capital Social
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">S/</span>
                <input
                  type="number"
                  step="0.01"
                  value={capitalStr}
                  onChange={(e) => setCapitalStr(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm tabular-nums focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Aporte inicial de los socios · figura en Patrimonio del Balance General
              </p>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">
                Reserva Legal
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">S/</span>
                <input
                  type="number"
                  step="0.01"
                  value={reservaStr}
                  onChange={(e) => setReservaStr(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm tabular-nums focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Reserva obligatoria · típicamente 10% del capital social hasta alcanzarlo
              </p>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">
                Provisión Incobrables
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={provisionStr}
                  onChange={(e) => setProvisionStr(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm tabular-nums focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">%</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                % de CxC que se considera incobrable · se resta del activo CxC en el Balance
              </p>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">
                Tipo de Cambio · default fallback
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">USD/PEN</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={tcStr}
                  onChange={(e) => setTcStr(e.target.value)}
                  className="w-full pl-20 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm tabular-nums focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Si no hay TC del día disponible en el servicio · se usa este valor de fallback. 0 = usar siempre el TC dinámico.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-[11px] text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Cambiar estos valores afecta los Estados Financieros retroactivamente.</strong>
                {' '}Si modificás Provisión Incobrables, los Balances anteriores se recalculan al volver a abrirlos.
              </div>
            </div>
          </>
        )}
      </div>
    </FormModalV2>
  );
};
// Use type import locally · no se exporta del service
type _ConfigContableFormShape = ConfigContableForm;

// ═════════════════════════════════════════════════════════════════════════
// ALIMENTADO POR PANEL · canon v5.1 chk5.E-S6
// Transparencia cross-módulo + S6.1 cross-links a módulos fuente
// ═════════════════════════════════════════════════════════════════════════

function AlimentadoPorPanel() {
  const navigate = useNavigate();

  const fuentes: Array<{
    label: string;
    descripcion: string;
    color: 'emerald' | 'rose' | 'amber' | 'teal' | 'purple';
    icon: LucideIcon;
    ruta: string;
  }> = [
    {
      label: 'Ventas',
      descripcion: 'ventas confirmadas + devoluciones · alimenta P&L · CxC',
      color: 'emerald',
      icon: DollarSign,
      ruta: '/ventas',
    },
    {
      label: 'Compras',
      descripcion: 'OCs recibidas · alimenta COGS · inventario · CxP',
      color: 'rose',
      icon: ShoppingCart,
      ruta: '/compras',
    },
    {
      label: 'Gastos',
      descripcion: 'gastos del período · alimenta opex · margen neto',
      color: 'amber',
      icon: Receipt,
      ruta: '/gastos',
    },
    {
      label: 'Finanzas',
      descripcion: 'movimientos · saldos · TC · alimenta caja · diferencial',
      color: 'teal',
      icon: Wallet,
      ruta: '/finanzas',
    },
    {
      label: 'Stock',
      descripcion: 'unidades · valorización · alimenta inventario en Balance',
      color: 'purple',
      icon: Package,
      ruta: '/stock',
    },
  ];

  const colorMap = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', textHover: 'hover:text-emerald-900', border: 'hover:border-emerald-300', iconBg: 'bg-emerald-100', iconText: 'text-emerald-700' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', textHover: 'hover:text-rose-900', border: 'hover:border-rose-300', iconBg: 'bg-rose-100', iconText: 'text-rose-700' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', textHover: 'hover:text-amber-900', border: 'hover:border-amber-300', iconBg: 'bg-amber-100', iconText: 'text-amber-700' },
    teal: { bg: 'bg-teal-50', text: 'text-teal-700', textHover: 'hover:text-teal-900', border: 'hover:border-teal-300', iconBg: 'bg-teal-100', iconText: 'text-teal-700' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', textHover: 'hover:text-purple-900', border: 'hover:border-purple-300', iconBg: 'bg-purple-100', iconText: 'text-purple-700' },
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
          <Info className="w-4 h-4 text-slate-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-[13px] font-bold text-slate-900">
            Alimentado por · 5 módulos del sistema
          </h3>
          <p className="text-[11px] text-slate-500 leading-snug">
            Contabilidad agrega y reconcilia data de estos módulos. Click en cada chip para ir a la
            fuente y verificar/ajustar movimientos · cero captura manual en este módulo.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {fuentes.map((f) => {
          const c = colorMap[f.color];
          const Icon = f.icon;
          return (
            <button
              key={f.label}
              onClick={() => navigate(f.ruta)}
              className={`text-left p-3 bg-white border border-slate-200 rounded-lg ${c.border} hover:bg-slate-50 transition-colors group`}
              title={`Ir a ${f.label}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-6 h-6 rounded ${c.iconBg} flex items-center justify-center`}>
                  <Icon className={`w-3.5 h-3.5 ${c.iconText}`} />
                </div>
                <span className={`text-[12px] font-bold text-slate-900 ${c.textHover}`}>
                  {f.label}
                </span>
                <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-slate-500 ml-auto" />
              </div>
              <div className="text-[10px] text-slate-500 leading-snug">{f.descripcion}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// TENDENCIAS VIEW · canon v5.1 chk5.E-S5
// ═════════════════════════════════════════════════════════════════════════

type MetricaTendencia = 'utilidadNeta' | 'ventasNetas' | 'utilidadBruta' | 'utilidadOperativa';

interface TendenciasViewProps {
  tendencia: TendenciaMensual[];
  mes: number;
  anio: number;
  mejorMes: TendenciaMensual | null;
  peorMes: TendenciaMensual | null;
  acumuladoVentas: number;
  acumuladoCompras: number;
  acumuladoUtilidadNeta: number;
}

function TendenciasView({
  tendencia,
  mes,
  anio,
  mejorMes,
  peorMes,
  acumuladoVentas,
  acumuladoCompras,
  acumuladoUtilidadNeta,
}: TendenciasViewProps) {
  const [metrica, setMetrica] = useState<MetricaTendencia>('utilidadNeta');

  const metricaLabel: Record<MetricaTendencia, string> = {
    utilidadNeta: 'Utilidad Neta',
    ventasNetas: 'Ventas Netas',
    utilidadBruta: 'Margen Bruto',
    utilidadOperativa: 'EBITDA',
  };

  // Acumulados derivados
  const acumUtilidadBruta = tendencia.reduce((s, m) => s + m.utilidadBruta, 0);
  const acumGastosOperativos = tendencia.reduce((s, m) => s + m.gastosOperativos, 0);
  const acumUtilidadOperativa = tendencia.reduce((s, m) => s + m.utilidadOperativa, 0);
  const ytdMargen = acumuladoVentas > 0 ? (acumuladoUtilidadNeta / acumuladoVentas) * 100 : 0;

  // Para la gráfica · valor seleccionado y rango
  const valoresMetrica = tendencia.map((m) => m[metrica]);
  const maxAbs = Math.max(...valoresMetrica.map((v) => Math.abs(v)), 1);

  // Detectar mes actual
  const mesActualIdx = tendencia.findIndex((m) => m.mes === mes);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Mes', 'Ventas', 'Compras', 'EBITDA', 'Utilidad Neta', 'Margen %'];
    const rows = tendencia.map((m) => [
      m.nombreMes,
      m.ventasNetas.toFixed(2),
      m.compras.toFixed(2),
      m.utilidadOperativa.toFixed(2),
      m.utilidadNeta.toFixed(2),
      m.ventasNetas > 0 ? ((m.utilidadNeta / m.ventasNetas) * 100).toFixed(2) : '0.00',
    ]);
    rows.push([
      'YTD',
      acumuladoVentas.toFixed(2),
      acumuladoCompras.toFixed(2),
      acumUtilidadOperativa.toFixed(2),
      acumuladoUtilidadNeta.toFixed(2),
      ytdMargen.toFixed(2),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tendencias-${anio}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* §1 · Header con selector métrica */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <LineChart className="w-5 h-5 text-indigo-700" />
            <div>
              <div className="text-[13px] font-bold text-slate-900">Tendencias · Año {anio}</div>
              <div className="text-[11px] text-slate-500">
                Comparativo mensual · acumulado YTD · {tendencia.length} meses con data
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-slate-500">Métrica:</span>
            <select
              value={metrica}
              onChange={(e) => setMetrica(e.target.value as MetricaTendencia)}
              className="border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold focus:ring-1 focus:ring-indigo-500"
            >
              <option value="utilidadNeta">Utilidad Neta</option>
              <option value="ventasNetas">Ventas Netas</option>
              <option value="utilidadBruta">Margen Bruto</option>
              <option value="utilidadOperativa">EBITDA</option>
            </select>
          </div>
        </div>
      </section>

      {/* §2 · Gráfica barras horizontales · 12 meses */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            {metricaLabel[metrica]} · {tendencia.length} meses
          </h3>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div> Positivo
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-rose-500 rounded-full"></div> Negativo
            </span>
          </div>
        </div>

        {tendencia.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-slate-500 italic">
            Sin meses con data para mostrar tendencia
          </div>
        ) : (
          <div className="space-y-1.5">
            {tendencia.map((m, idx) => {
              const valor = m[metrica];
              const isPositive = valor >= 0;
              const width = (Math.abs(valor) / maxAbs) * 100;
              const isCurrent = idx === mesActualIdx;

              const rowBg = isCurrent ? 'bg-purple-50/30 -mx-2 px-2 py-1 rounded' : '';
              const labelColor = isCurrent ? 'font-bold text-purple-900' : 'text-slate-600';
              const valueColor = isCurrent
                ? isPositive
                  ? 'font-bold text-emerald-700'
                  : 'font-bold text-rose-700'
                : isPositive
                ? 'font-medium text-emerald-600'
                : 'font-medium text-rose-600';
              const barColor = isPositive ? 'bg-emerald-500' : 'bg-rose-500';

              return (
                <div key={idx} className={`flex items-center gap-3 ${rowBg}`}>
                  <div className={`w-12 text-[11px] shrink-0 ${labelColor}`}>
                    {m.nombreMes.slice(0, 3)}
                  </div>
                  <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${width}%` }}
                    ></div>
                  </div>
                  <div className={`w-28 text-right text-[11px] tabular-nums shrink-0 ${valueColor}`}>
                    {valor < 0 ? '− ' : ''}
                    {formatCurrencyPEN(Math.abs(valor))}
                    {isCurrent && ' ←'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* §3 · 3 cards resumen · YTD + mejor + peor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-50 ring-1 ring-emerald-200/50 rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mb-1">
            Acumulado {anio} YTD
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">
            {formatCurrencyPEN(acumuladoUtilidadNeta)}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Margen YTD: {ytdMargen.toFixed(1)}%
          </div>
        </div>

        <div className="bg-sky-50 ring-1 ring-sky-200/50 rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-wider text-sky-700 font-bold mb-1">
            Mejor mes {anio}
          </div>
          <div className="text-2xl font-bold tabular-nums text-sky-900">
            {mejorMes ? `${mejorMes.nombreMes.slice(0, 3)} · ${formatCurrencyPEN(mejorMes.utilidadNeta)}` : '—'}
          </div>
          <div className="text-[11px] text-sky-700 mt-1">
            {mejorMes && mejorMes.utilidadNeta === Math.max(...tendencia.map((t) => t.utilidadNeta))
              ? '↑ Récord año'
              : 'Periodo destacado'}
          </div>
        </div>

        <div className="bg-rose-50 ring-1 ring-rose-200/50 rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-wider text-rose-700 font-bold mb-1">
            Peor mes {anio}
          </div>
          <div className="text-2xl font-bold tabular-nums text-rose-900">
            {peorMes ? `${peorMes.nombreMes.slice(0, 3)} · ${formatCurrencyPEN(peorMes.utilidadNeta)}` : '—'}
          </div>
          <div className="text-[11px] text-rose-700 mt-1">
            {peorMes && peorMes.utilidadNeta < 0 ? 'Mes con pérdida' : 'Mes más bajo'}
          </div>
        </div>
      </div>

      {/* §4 · Tabla detallada con tfoot YTD */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-[12px] font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-slate-600" />
            Tabla completa · todos los meses
          </h3>
          <button
            onClick={handleExportCSV}
            className="text-[10px] text-indigo-700 hover:underline flex items-center gap-1"
            title="Exportar tabla de tendencias a CSV"
          >
            <Download className="w-3 h-3" /> Exportar CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-700">
                  Mes
                </th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-slate-700">
                  Ventas
                </th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-slate-700">
                  Compras
                </th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-slate-700">
                  EBITDA
                </th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-slate-700">
                  Util. Neta
                </th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-slate-700">
                  Margen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tendencia.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[11px] text-slate-500 italic">
                    Sin meses con data registrada en {anio}
                  </td>
                </tr>
              )}
              {tendencia.map((m, idx) => {
                const isCurrent = m.mes === mes;
                const isPeor = peorMes && m.mes === peorMes.mes;
                const margen = m.ventasNetas > 0 ? (m.utilidadNeta / m.ventasNetas) * 100 : 0;
                const utilColor = m.utilidadNeta >= 0 ? 'text-emerald-700' : 'text-rose-700';
                const rowBg = isCurrent
                  ? 'bg-purple-50/30 border-l-4 border-purple-500'
                  : isPeor
                  ? 'bg-rose-50/30'
                  : 'hover:bg-slate-50';
                const labelCls = isCurrent
                  ? 'font-bold text-purple-900'
                  : isPeor
                  ? 'font-semibold text-rose-700'
                  : 'font-semibold text-slate-700';
                const numCls = isCurrent ? 'font-bold text-purple-900' : '';

                return (
                  <tr key={idx} className={rowBg}>
                    <td className={`px-3 py-2 ${labelCls}`}>
                      {m.nombreMes.slice(0, 3)} {isCurrent && '←'}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${numCls}`}>
                      {formatCurrencyPEN(m.ventasNetas)}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${numCls}`}>
                      {formatCurrencyPEN(m.compras)}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${numCls || (m.utilidadOperativa < 0 ? 'text-rose-600' : '')}`}>
                      {formatCurrencyPEN(m.utilidadOperativa)}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${isCurrent ? 'font-bold' : ''} ${utilColor}`}>
                      {formatCurrencyPEN(m.utilidadNeta)}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${isCurrent ? 'font-bold' : ''} ${utilColor}`}>
                      {margen.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {tendencia.length > 0 && (
              <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                <tr>
                  <td className="px-3 py-2 font-bold text-slate-900">YTD</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900">
                    {formatCurrencyPEN(acumuladoVentas)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900">
                    {formatCurrencyPEN(acumuladoCompras)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900">
                    {formatCurrencyPEN(acumUtilidadOperativa)}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums font-bold ${
                    acumuladoUtilidadNeta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {formatCurrencyPEN(acumuladoUtilidadNeta)}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums font-bold ${
                    ytdMargen >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {ytdMargen.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════

export function Contabilidad() {
  const lineaFiltroGlobal = useLineaNegocioStore(state => state.lineaFiltroGlobal);
  const [tabActiva, setTabActiva] = useState<TabActiva>('resumen');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState<ResumenContable | null>(null);
  const [estado, setEstado] = useState<EstadoResultadosType | null>(null);
  const [tendencia, setTendencia] = useState<TendenciaMensual[]>([]);
  const [mesAnterior, setMesAnterior] = useState<ResumenContable | null>(null);
  const [balance, setBalance] = useState<BalanceGeneralType | null>(null);
  const [indicadores, setIndicadores] = useState<IndicadoresFinancieros | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisFinanciero[]>([]);

  const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // chk5.E-S2 · estado de error para mostrar error-state canon
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // chk5.E-S2 · modal Configurar contable
  const [configModalOpen, setConfigModalOpen] = useState(false);

  // Cargar datos
  const cargarDatos = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [estadoData, tendenciaData, balanceData, indicadoresData] = await Promise.all([
        contabilidadService.generarEstadoResultados(mes, anio, lineaFiltroGlobal),
        contabilidadService.getTendenciaMensual(anio, lineaFiltroGlobal),
        contabilidadService.generarBalanceGeneral(mes, anio),
        contabilidadService.calcularIndicadoresFinancieros(mes, anio, lineaFiltroGlobal),
      ]);

      setEstado(estadoData);
      setTendencia(tendenciaData);
      setBalance(balanceData);
      setIndicadores(indicadoresData);
      setAnalisis(contabilidadService.generarAnalisisFinanciero(indicadoresData));

      // Crear resumen desde estado
      setResumen({
        periodo: estadoData.periodo,
        ventasNetas: estadoData.ventasNetas,
        compras: estadoData.compras.total,
        utilidadBruta: estadoData.utilidadBruta,
        gastosOperativos: estadoData.totalGastosOperativos,
        utilidadNeta: estadoData.utilidadNeta,
        margenNeto: estadoData.utilidadNetaPorcentaje,
        tendencia: estadoData.utilidadNeta >= 0 ? 'subiendo' : 'bajando',
      });

      // Cargar mes anterior para comparación
      const mesAnt = mes === 1 ? 12 : mes - 1;
      const anioAnt = mes === 1 ? anio - 1 : anio;
      try {
        const resumenAnt = await contabilidadService.getResumenContable(mesAnt, anioAnt, lineaFiltroGlobal);
        setMesAnterior(resumenAnt);
      } catch {
        setMesAnterior(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('Error cargando datos contables:', err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [mes, anio, lineaFiltroGlobal]);

  // Calcular variaciones vs mes anterior
  const calcularVariacion = (actual: number, anterior: number | undefined): number | null => {
    if (!anterior || anterior === 0) return null;
    return ((actual - anterior) / Math.abs(anterior)) * 100;
  };

  const varVentas = calcularVariacion(resumen?.ventasNetas || 0, mesAnterior?.ventasNetas);
  const varUtilidadNeta = calcularVariacion(resumen?.utilidadNeta || 0, mesAnterior?.utilidadNeta);
  const varCompras = calcularVariacion(resumen?.compras || 0, mesAnterior?.compras);

  // Tabs
  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { id: 'balance', label: 'Balance General', mobileLabel: 'Balance', icon: Scale },
    { id: 'estado-resultados', label: 'Estado de Resultados', mobileLabel: 'Resultados', icon: FileText },
    { id: 'indicadores', label: 'Indicadores', mobileLabel: 'KPIs', icon: Activity },
    { id: 'tendencias', label: 'Tendencias', icon: LineChart },
    { id: 'cierre', label: 'Cierre Mensual', mobileLabel: 'Cierre', icon: Lock },
  ];

  // Años disponibles
  const aniosDisponibles = [];
  const anioActual = new Date().getFullYear();
  for (let a = 2024; a <= anioActual; a++) {
    aniosDisponibles.push(a);
  }

  // Encontrar mejor y peor mes
  const mejorMes = tendencia.reduce((best, curr) =>
    curr.utilidadNeta > (best?.utilidadNeta || -Infinity) ? curr : best, tendencia[0]);
  const peorMes = tendencia.reduce((worst, curr) =>
    curr.utilidadNeta < (worst?.utilidadNeta || Infinity) ? curr : worst, tendencia[0]);

  // Acumulado del año
  const acumuladoVentas = tendencia.reduce((sum, m) => sum + m.ventasNetas, 0);
  const acumuladoCompras = tendencia.reduce((sum, m) => sum + m.compras, 0);
  const acumuladoUtilidadNeta = tendencia.reduce((sum, m) => sum + m.utilidadNeta, 0);
  const promedioMensual = tendencia.length > 0 ? acumuladoUtilidadNeta / tendencia.length : 0;

  // ===== chk5.E-S6 · Export CSV contextual al tab activo =====
  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvLines = [headers, ...rows].map((r) =>
      r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','),
    );
    const csv = csvLines.join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${anio}-${String(mes).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportContextual = () => {
    const mesNombre = estado?.periodo.nombreMes || `Mes ${mes}`;

    if (tabActiva === 'balance' && balance) {
      const headers = ['Sección', 'Concepto', 'Monto PEN'];
      const rows: (string | number)[][] = [
        ['ACTIVO', 'Efectivo y equivalentes', balance.activos.corriente.efectivo.total.toFixed(2)],
        ['ACTIVO', 'CxC · clientes', balance.activos.corriente.cuentasPorCobrar.ventasPendientes.toFixed(2)],
        ['ACTIVO', '(−) Provisión incobrables', (-balance.activos.corriente.cuentasPorCobrar.provisionIncobrables).toFixed(2)],
        ['ACTIVO', 'Inventarios', balance.activos.corriente.inventarios.totalValorPEN.toFixed(2)],
        ['ACTIVO', 'TOTAL ACTIVO CORRIENTE', balance.activos.corriente.total.toFixed(2)],
        ['ACTIVO', 'TOTAL ACTIVO NO CORRIENTE', balance.activos.noCorriente.total.toFixed(2)],
        ['ACTIVO', 'TOTAL ACTIVO', balance.activos.totalActivos.toFixed(2)],
        ['PASIVO', 'CxP proveedores', balance.pasivos.corriente.cuentasPorPagarProveedores.ordenesCompraPendientes.toFixed(2)],
        ['PASIVO', 'Otras CxP', balance.pasivos.corriente.otrasCuentasPorPagar.total.toFixed(2)],
        ['PASIVO', 'Anticipos clientes', (balance.pasivos.corriente.anticiposClientes?.totalAnticiposPEN || 0).toFixed(2)],
        ['PASIVO', 'Deudas TC bancos', (balance.pasivos.corriente.deudasFinancieras?.total || 0).toFixed(2)],
        ['PASIVO', 'TOTAL PASIVO CORRIENTE', balance.pasivos.corriente.total.toFixed(2)],
        ['PASIVO', 'TOTAL PASIVO NO CORRIENTE', balance.pasivos.noCorriente.total.toFixed(2)],
        ['PASIVO', 'TOTAL PASIVO', balance.pasivos.totalPasivos.toFixed(2)],
        ['PATRIMONIO', 'Capital social', balance.patrimonio.capitalSocial.toFixed(2)],
        ['PATRIMONIO', 'Reserva legal', (balance.patrimonio.reservas || 0).toFixed(2)],
        ['PATRIMONIO', 'Utilidades acumuladas', balance.patrimonio.utilidadesAcumuladas.toFixed(2)],
        ['PATRIMONIO', `Utilidad del período (${mesNombre} ${anio})`, balance.patrimonio.utilidadEjercicio.toFixed(2)],
        ['PATRIMONIO', 'TOTAL PATRIMONIO', balance.patrimonio.totalPatrimonio.toFixed(2)],
        ['CUADRE', 'Total Pasivo + Patrimonio', balance.totalPasivosPatrimonio.toFixed(2)],
        ['CUADRE', 'Diferencia', balance.diferencia.toFixed(2)],
        ['CUADRE', 'Balance cuadra', balance.balanceCuadra ? 'SÍ' : 'NO'],
      ];
      downloadCSV('balance-general', headers, rows);
      return;
    }

    if (tabActiva === 'estado-resultados' && estado) {
      const headers = ['Bloque', 'Concepto', 'Monto PEN', '% Ventas'];
      const v = estado.ventasNetas;
      const pctOf = (x: number) => (v > 0 ? ((x / v) * 100).toFixed(1) : '0.0');
      const rows: (string | number)[][] = [
        ['VENTAS NETAS', 'Ventas confirmadas', estado.ventasBrutas.toFixed(2), pctOf(estado.ventasBrutas)],
        ['VENTAS NETAS', '(−) Descuentos y devoluciones', (-(estado.descuentos + estado.devoluciones)).toFixed(2), `-${pctOf(estado.descuentos + estado.devoluciones)}`],
        ['VENTAS NETAS', 'TOTAL VENTAS NETAS', estado.ventasNetas.toFixed(2), '100.0'],
        ['COGS', 'Costo de productos', estado.compras.costoProductos.toFixed(2), pctOf(estado.compras.costoProductos)],
        ['COGS', 'Flete intl + impuestos importación', (estado.compras.fleteInternacional + estado.compras.impuestos + estado.compras.otrosGastosImportacion).toFixed(2), pctOf(estado.compras.fleteInternacional + estado.compras.impuestos + estado.compras.otrosGastosImportacion)],
        ['COGS', 'TOTAL COGS', (-estado.compras.total).toFixed(2), pctOf(estado.compras.total)],
        ['MARGEN BRUTO', 'MARGEN BRUTO', estado.utilidadBruta.toFixed(2), estado.utilidadBrutaPorcentaje.toFixed(1)],
        ['GASTOS OPERATIVOS', 'Gastos de venta', estado.costosVariables.gv.total.toFixed(2), pctOf(estado.costosVariables.gv.total)],
        ['GASTOS OPERATIVOS', 'Gastos administrativos', estado.costosFijos.ga.total.toFixed(2), pctOf(estado.costosFijos.ga.total)],
        ['GASTOS OPERATIVOS', 'Gastos de distribución', estado.costosVariables.gd.total.toFixed(2), pctOf(estado.costosVariables.gd.total)],
        ['GASTOS OPERATIVOS', 'Gastos fijos', estado.costosFijos.go.total.toFixed(2), pctOf(estado.costosFijos.go.total)],
        ['GASTOS OPERATIVOS', 'TOTAL GASTOS OPERATIVOS', (-estado.totalGastosOperativos).toFixed(2), pctOf(estado.totalGastosOperativos)],
        ['EBITDA', 'EBITDA', estado.utilidadOperativa.toFixed(2), estado.utilidadOperativaPorcentaje.toFixed(1)],
        ['OTROS', 'Diferencial cambiario neto', estado.otrosIngresosGastos.diferenciaCambiariaNeta.toFixed(2), pctOf(Math.abs(estado.otrosIngresosGastos.diferenciaCambiariaNeta))],
        ['OTROS', 'Otros ingresos', estado.otrosIngresosGastos.otrosIngresos.toFixed(2), pctOf(estado.otrosIngresosGastos.otrosIngresos)],
        ['UTILIDAD NETA', 'UTILIDAD NETA DEL PERÍODO', estado.utilidadNeta.toFixed(2), estado.utilidadNetaPorcentaje.toFixed(1)],
      ];
      downloadCSV('estado-resultados', headers, rows);
      return;
    }

    if (tabActiva === 'resumen' && estado && balance) {
      const headers = ['Métrica', 'Valor PEN'];
      const rows: (string | number)[][] = [
        ['Período', `${mesNombre} ${anio}`],
        ['VENTAS NETAS', estado.ventasNetas.toFixed(2)],
        ['Compras del período', estado.compras.total.toFixed(2)],
        ['Margen bruto', estado.utilidadBruta.toFixed(2)],
        ['% Margen bruto', estado.utilidadBrutaPorcentaje.toFixed(2)],
        ['Gastos operativos', estado.totalGastosOperativos.toFixed(2)],
        ['EBITDA', estado.utilidadOperativa.toFixed(2)],
        ['UTILIDAD NETA', estado.utilidadNeta.toFixed(2)],
        ['% Margen neto', estado.utilidadNetaPorcentaje.toFixed(2)],
        ['Total Activos', balance.activos.totalActivos.toFixed(2)],
        ['Total Pasivos', balance.pasivos.totalPasivos.toFixed(2)],
        ['Total Patrimonio', balance.patrimonio.totalPatrimonio.toFixed(2)],
        ['Tipo de cambio', balance.tipoCambio.toFixed(4)],
      ];
      downloadCSV('resumen-contable', headers, rows);
      return;
    }

    // Fallback genérico
    alert(
      'Para exportar usá el botón "Exportar CSV" del tab activo · disponible en: Resumen · Balance · Estado de Resultados · Tendencias',
    );
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Shell frame banking-grade · canon F1+S9.D1 · pixel-perfect Finanzas */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

        {/* §A · TOP BAR breadcrumb canon S9.D1 (3 niveles · sin grupo sidebar) */}
        <div className="border-b border-slate-200 px-6 py-2.5 flex items-center gap-3 bg-slate-50">
          <div className="flex items-center text-[12px] flex-1">
            <a className="text-slate-500 hover:text-teal-700 cursor-pointer">Inicio</a>
            <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5" />
            <span className="text-slate-900 font-semibold">Contabilidad</span>
          </div>
        </div>

        {/* §B · HEADER BANKING-GRADE · icon purple gradient + h1 + subtitle + 3-tier actions canon N10 */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 flex-1 min-w-[260px]">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white flex-shrink-0">
                <Calculator className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Contabilidad
                </h1>
                <p className="text-[13px] text-slate-500 leading-snug">
                  Estados financieros formales · Balance General · P&L · ratios e indicadores · cierre mensual
                </p>
              </div>
            </div>
            {/* canon S8.D8+D10 · flex-wrap + max-w-full + icon-only mobile */}
            <div className="flex items-center gap-2 flex-wrap justify-end max-w-full">
              {/* Selector período · compacto */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                <select
                  value={mes}
                  onChange={(e) => setMes(Number(e.target.value))}
                  className="border-none bg-transparent text-[12px] font-medium text-slate-700 focus:ring-0 focus:outline-none cursor-pointer"
                >
                  {MESES.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select
                  value={anio}
                  onChange={(e) => setAnio(Number(e.target.value))}
                  className="border-none bg-transparent text-[12px] font-medium text-slate-700 focus:ring-0 focus:outline-none cursor-pointer"
                >
                  {aniosDisponibles.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              {/* Tier neutral · Recargar */}
              <button
                type="button"
                onClick={cargarDatos}
                disabled={loading}
                aria-label="Recargar datos contables"
                title="Recargar datos contables"
                className="text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Recargar</span>
              </button>
              {/* Tier destacada · Configurar (S2 nuevo) */}
              <button
                type="button"
                onClick={() => setConfigModalOpen(true)}
                aria-label="Configurar parámetros contables"
                title="Configurar capital · reserva legal · provisión incobrables · TC default"
                className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <Settings2 className="w-3 h-3" />
                <span className="hidden sm:inline">Configurar</span>
              </button>
              {/* chk5.E-S6 · Tier neutral · Exportar (contextual al tab activo) */}
              <button
                type="button"
                onClick={handleExportContextual}
                aria-label="Exportar reporte contable del tab activo"
                title="Exporta a CSV el reporte del tab activo (Resumen · Balance · P&L · Tendencias)"
                className="text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">Exportar</span>
              </button>
            </div>
          </div>
        </div>

        {/* §C · KPI STRIP canon N1+N2 · 5 KPIs color semántico + gradient + ring */}
        {estado && balance && (
          <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiContaCard
              label="VENTAS NETAS"
              value={formatCurrency(estado.ventasNetas)}
              color="emerald"
              icon={DollarSign}
              delta={varVentas !== null ? `${varVentas >= 0 ? '+' : ''}${varVentas.toFixed(1)}% vs mes ant.` : undefined}
              deltaPositive={varVentas !== null ? varVentas >= 0 : undefined}
            />
            <KpiContaCard
              label="TOTAL ACTIVOS"
              value={formatCurrency(balance.activos.totalActivos)}
              color="teal"
              icon={Wallet}
            />
            <KpiContaCard
              label="TOTAL PASIVOS"
              value={formatCurrency(balance.pasivos.totalPasivos)}
              color="rose"
              icon={CreditCard}
            />
            <KpiContaCard
              label="PATRIMONIO"
              value={formatCurrency(balance.patrimonio.totalPatrimonio)}
              color="indigo"
              icon={PiggyBank}
            />
            <KpiContaCard
              label="UTILIDAD NETA"
              value={formatCurrency(estado.utilidadNeta)}
              color="amber"
              icon={estado.utilidadNeta >= 0 ? TrendingUp : TrendingDown}
              delta={varUtilidadNeta !== null ? `${varUtilidadNeta >= 0 ? '+' : ''}${varUtilidadNeta.toFixed(1)}% vs mes ant.` : undefined}
              deltaPositive={varUtilidadNeta !== null ? varUtilidadNeta >= 0 : undefined}
            />
          </div>
        )}

        {/* §D · Sub-vista TABS canon S9.D11 con chevron buttons (adaptado a tabs internos) */}
        <SubVistaTabsContabilidad
          tabs={tabs}
          activeId={tabActiva}
          onTabChange={(id) => setTabActiva(id as TabActiva)}
        />

        {/* §E · BODY · contenido según tab activo */}
        <div className="p-6 bg-slate-50/30">

        {/* chk5.E-S2 · ERROR STATE canon · botones Reintentar + Solicitar permiso */}
        {!loading && errorMsg && (
          <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-rose-600" />
            </div>
            <div>
              <div className="text-[14px] font-bold text-rose-900 mb-1">
                No se pudieron cargar los Estados Financieros
              </div>
              <div className="text-[11px] text-slate-600 max-w-md mx-auto">
                Error: <code className="bg-slate-100 px-1 rounded text-[10px]">{errorMsg}</code>.
                Verificá que tu usuario tenga permiso sobre el módulo Contabilidad o contactá al admin.
              </div>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={cargarDatos}
                className="text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reintentar
              </button>
              <button
                type="button"
                className="text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
              >
                <Info className="w-3.5 h-3.5" /> Solicitar permiso
              </button>
            </div>
          </div>
        )}

        {/* chk5.E-S2 · LOADING STATE canon · spinner purple + skeleton bars */}
        {loading && !errorMsg && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-50">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-slate-700">Calculando estados financieros…</div>
              <div className="text-[11px] text-slate-500 mt-1">Procesando ventas · compras · gastos · saldos · TC</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 max-w-3xl mx-auto pt-2">
              <div className="h-20 rounded-2xl bg-slate-100 animate-pulse"></div>
              <div className="h-20 rounded-2xl bg-slate-100 animate-pulse"></div>
              <div className="h-20 rounded-2xl bg-slate-100 animate-pulse"></div>
              <div className="h-20 rounded-2xl bg-slate-100 animate-pulse"></div>
              <div className="h-20 rounded-2xl bg-slate-100 animate-pulse"></div>
            </div>
          </div>
        )}

        {/* chk5.E-S2 · EMPTY STATE canon N9 · 4 quick-start cards */}
        {!loading && !errorMsg && (!estado || estado.ventasNetas === 0) && tabActiva === 'resumen' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-purple-100 flex items-center justify-center">
              <Calculator className="w-10 h-10 text-purple-600" />
            </div>
            <div>
              <div className="text-[16px] font-bold text-slate-900 mb-1">
                Sin movimientos contables para este período
              </div>
              <div className="text-[12px] text-slate-500 max-w-md mx-auto">
                La Contabilidad se alimenta automáticamente de Ventas, Compras, Gastos y Movimientos
                del módulo Finanzas. Registrá tu primera operación para ver los Estados Financieros.
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-w-2xl mx-auto pt-4">
              <a
                href="/ventas"
                className="text-left p-3 bg-white border border-slate-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50/30 cursor-pointer no-underline"
              >
                <DollarSign className="w-4 h-4 text-emerald-600 mb-1.5" />
                <div className="text-[11px] font-bold text-slate-900">Registrar venta</div>
                <div className="text-[10px] text-slate-500">Ingreso</div>
              </a>
              <a
                href="/compras"
                className="text-left p-3 bg-white border border-slate-200 rounded-lg hover:border-rose-300 hover:bg-rose-50/30 cursor-pointer no-underline"
              >
                <ShoppingCart className="w-4 h-4 text-rose-600 mb-1.5" />
                <div className="text-[11px] font-bold text-slate-900">Crear OC</div>
                <div className="text-[10px] text-slate-500">Compra</div>
              </a>
              <a
                href="/gastos"
                className="text-left p-3 bg-white border border-slate-200 rounded-lg hover:border-amber-300 hover:bg-amber-50/30 cursor-pointer no-underline"
              >
                <FileText className="w-4 h-4 text-amber-600 mb-1.5" />
                <div className="text-[11px] font-bold text-slate-900">Cargar gasto</div>
                <div className="text-[10px] text-slate-500">Opex</div>
              </a>
              <a
                href="/finanzas"
                className="text-left p-3 bg-white border border-slate-200 rounded-lg hover:border-teal-300 hover:bg-teal-50/30 cursor-pointer no-underline"
              >
                <BarChart3 className="w-4 h-4 text-teal-600 mb-1.5" />
                <div className="text-[11px] font-bold text-slate-900">Nuevo movimiento</div>
                <div className="text-[10px] text-slate-500">Tesorería</div>
              </a>
            </div>
          </div>
        )}

      {/* RESUMEN · KPIs ya viven en el §C shell · acá solo banners + distribuciones + indicadores */}
      {!loading && tabActiva === 'resumen' && estado && balance && (
        <div className="space-y-6">
          {/* §1 · Banner Anticipos · canon N4 cross-cutting purple (chk5.E-S2 copy-paste literal mockup) */}
          {balance.pasivos.corriente.anticiposClientes &&
           balance.pasivos.corriente.anticiposClientes.totalAnticiposPEN > 0 && (
            <div className="bg-gradient-to-r from-purple-50 to-purple-100/30 ring-1 ring-purple-200/50 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3 flex-1 min-w-[260px]">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white ring-2 ring-purple-200 flex-shrink-0">
                  <CircleDollarSign className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-purple-900">Anticipos Pendientes · Pasivo</div>
                  <div className="text-[11px] text-purple-700 mt-0.5">
                    {balance.pasivos.corriente.anticiposClientes.cantidadVentas} ventas con anticipo sin entregar · son ingreso DIFERIDO hasta entrega real.
                    Total: <span className="font-bold tabular-nums">{formatCurrency(balance.pasivos.corriente.anticiposClientes.totalAnticiposPEN)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* §2 · Distribución · 4 cards canon N2 (gradient + ring colored) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

            {/* Composición de Activos · teal */}
            <DistributionCard
              color="teal"
              icon={Wallet}
              title="Composición Activos"
              items={[
                { label: 'Efectivo', value: balance.activos.corriente.efectivo.total, dotColor: 'bg-emerald-500' },
                { label: 'CxC', value: balance.activos.corriente.cuentasPorCobrar.neto, dotColor: 'bg-sky-500' },
                { label: 'Inventario', value: balance.activos.corriente.inventarios.totalValorPEN, dotColor: 'bg-purple-500' },
              ]}
            />

            {/* Estructura Financiera · indigo */}
            <DistributionCard
              color="indigo"
              icon={Scale}
              title="Estructura Financiera"
              items={[
                { label: 'Pasivos', value: balance.pasivos.totalPasivos, dotColor: 'bg-rose-500' },
                { label: 'Patrimonio', value: balance.patrimonio.totalPatrimonio, dotColor: 'bg-sky-500' },
              ]}
            />

            {/* Estructura de Costos · amber */}
            <DistributionCard
              color="amber"
              icon={BarChart3}
              title="Estructura Costos"
              items={[
                { label: 'Compras', value: estado.compras.total, dotColor: 'bg-orange-500' },
                { label: 'Costos venta', value: estado.costosVariables.total, dotColor: 'bg-purple-500' },
                { label: 'Gastos fijos', value: estado.costosFijos.total, dotColor: 'bg-amber-500' },
              ]}
            />

            {/* Inventario por País · sky */}
            <DistributionCard
              color="sky"
              icon={Package}
              title="Inventario · País"
              items={[
                { label: 'USA', value: balance.activos.corriente.inventarios.inventarioUSA.valorPEN, dotColor: 'bg-sky-500' },
                { label: 'Perú', value: balance.activos.corriente.inventarios.inventarioPeru.valorPEN, dotColor: 'bg-emerald-500' },
              ]}
            />
          </div>

          {/* Indicadores clave y Análisis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Indicadores clave */}
            {indicadores && (
              <div className="bg-white rounded-lg border p-6">
                <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-600" />
                  Indicadores Clave
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-sm text-slate-500">Razón Corriente</div>
                    <div className="text-2xl font-bold text-sky-600">
                      {indicadores.liquidez.razonCorriente.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-400">Act. Corr. / Pas. Corr.</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-sm text-slate-500">ROE</div>
                    <div className={`text-2xl font-bold ${indicadores.rentabilidad.roe >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatPercent(indicadores.rentabilidad.roe)}
                    </div>
                    <div className="text-xs text-slate-400">Util. Neta / Patrimonio</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-sm text-slate-500">Endeudamiento</div>
                    <div className={`text-2xl font-bold ${indicadores.solvencia.endeudamientoTotal <= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {formatPercent(indicadores.solvencia.endeudamientoTotal)}
                    </div>
                    <div className="text-xs text-slate-400">Pasivos / Activos</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-sm text-slate-500">Ciclo de Efectivo</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {indicadores.actividad.cicloConversionEfectivo.toFixed(0)} días
                    </div>
                    <div className="text-xs text-slate-400">Inv + Cobro - Pago</div>
                  </div>
                </div>
              </div>
            )}

            {/* Análisis con semáforo */}
            <div className="bg-white rounded-lg border p-6">
              <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-600" />
                Diagnóstico Financiero
              </h4>
              <div className="space-y-3">
                {analisis.slice(0, 4).map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-lg border ${getEstadoColor(item.estado)}`}
                  >
                    <div className="flex items-center gap-3">
                      {getEstadoIcon(item.estado)}
                      <div>
                        <div className="font-medium">{item.indicador}</div>
                        <div className="text-xs opacity-80">{item.descripcion}</div>
                      </div>
                    </div>
                    <div className="font-mono font-bold">{item.valorFormateado}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Acumulado del Año */}
          {tendencia.length > 0 && (
            <div className="bg-teal-50 rounded-lg border border-teal-200 p-6">
              <h4 className="font-semibold text-teal-800 mb-4 flex items-center gap-2">
                <CircleDollarSign className="w-5 h-5" />
                Acumulado {anio}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <div className="text-xs sm:text-sm text-teal-600">Ventas Acumuladas</div>
                  <div className="text-lg sm:text-2xl font-bold text-teal-900">{formatCurrency(acumuladoVentas)}</div>
                </div>
                <div>
                  <div className="text-xs sm:text-sm text-teal-600">Compras Acumuladas</div>
                  <div className="text-lg sm:text-2xl font-bold text-teal-900">{formatCurrency(acumuladoCompras)}</div>
                </div>
                <div>
                  <div className="text-xs sm:text-sm text-teal-600">Utilidad Acumulada</div>
                  <div className={`text-lg sm:text-2xl font-bold ${acumuladoUtilidadNeta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(acumuladoUtilidadNeta)}
                  </div>
                </div>
                <div>
                  <div className="text-xs sm:text-sm text-teal-600">Promedio Mensual</div>
                  <div className={`text-lg sm:text-2xl font-bold ${promedioMensual >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(promedioMensual)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* chk5.E-S6 · Panel "Alimentado por" · transparencia cross-módulo */}
          <AlimentadoPorPanel />
        </div>
      )}

      {/* BALANCE GENERAL */}
      {!loading && tabActiva === 'balance' && (
        <BalanceGeneral mes={mes} anio={anio} />
      )}

      {/* ESTADO DE RESULTADOS */}
      {!loading && tabActiva === 'estado-resultados' && (
        <>
          <EstadoResultados mes={mes} anio={anio} />
          <ReporteDirectoIndirecto mes={mes} anio={anio} />
        </>
      )}

      {/* INDICADORES FINANCIEROS */}
      {/* INDICADORES · canon chk5.E-S2 copy-paste literal mockup contabilidad-tab-indicadores-v5.1.html */}
      {!loading && tabActiva === 'indicadores' && indicadores && (
        <div className="space-y-4">

          {/* Header informativo */}
          <div className="bg-gradient-to-r from-purple-50 to-purple-100/30 ring-1 ring-purple-200/50 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-purple-700" />
              <div>
                <div className="text-[13px] font-bold text-purple-900">Indicadores Financieros · {MESES[mes - 1]} {anio}</div>
                <div className="text-[11px] text-purple-700">16 ratios agrupados en 4 dimensiones · cada ratio contra benchmark sectorial · semáforo verde/ámbar/rojo</div>
              </div>
            </div>
          </div>

          {/* 4 cards por dimensión (grid 2x2) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* LIQUIDEZ · sky */}
            <IndicadoresCard color="sky" icon={Wallet} title="LIQUIDEZ">
              <IndicadorRow
                nombre="Razón Corriente"
                formula="Act.Corr / Pas.Corr · Benchmark ≥ 2.0"
                valor={indicadores.liquidez.razonCorriente.toFixed(2)}
                semaforo={
                  indicadores.liquidez.razonCorriente >= 2.0 ? 'excelente'
                  : indicadores.liquidez.razonCorriente >= 1.5 ? 'bueno'
                  : indicadores.liquidez.razonCorriente >= 1.0 ? 'regular' : 'atencion'
                }
              />
              <IndicadorRow
                nombre="Prueba Ácida"
                formula="(Act.Corr − Inventario) / Pas.Corr · ≥ 1.0"
                valor={indicadores.liquidez.pruebaAcida.toFixed(2)}
                semaforo={
                  indicadores.liquidez.pruebaAcida >= 1.0 ? 'excelente'
                  : indicadores.liquidez.pruebaAcida >= 0.7 ? 'bueno' : 'atencion'
                }
              />
              <IndicadorRow
                nombre="Capital de Trabajo"
                formula="Act.Corr − Pas.Corr · > 0"
                valor={formatCurrency(indicadores.liquidez.capitalTrabajo)}
                semaforo={indicadores.liquidez.capitalTrabajo >= 0 ? 'excelente' : 'critico'}
              />
              <IndicadorRow
                nombre="Razón de Efectivo"
                formula="Efectivo / Pas.Corr · ≥ 0.3"
                valor={indicadores.liquidez.razonEfectivo.toFixed(2)}
                semaforo={
                  indicadores.liquidez.razonEfectivo >= 0.3 && indicadores.liquidez.razonEfectivo <= 1.0 ? 'excelente'
                  : indicadores.liquidez.razonEfectivo > 1.0 ? 'atencion'
                  : 'bueno'
                }
                semaforoLabel={indicadores.liquidez.razonEfectivo > 1.0 ? 'Sobreliquidez' : undefined}
              />
            </IndicadoresCard>

            {/* SOLVENCIA · indigo */}
            <IndicadoresCard color="indigo" icon={Scale} title="SOLVENCIA">
              <IndicadorRow
                nombre="Endeudamiento Total"
                formula="Pasivos / Activos · ≤ 50%"
                valor={formatPercent(indicadores.solvencia.endeudamientoTotal)}
                semaforo={
                  indicadores.solvencia.endeudamientoTotal <= 40 ? 'excelente'
                  : indicadores.solvencia.endeudamientoTotal <= 60 ? 'bueno' : 'atencion'
                }
              />
              <IndicadorRow
                nombre="Endeudamiento Patrimonio"
                formula="Pasivos / Patrimonio · ≤ 100%"
                valor={formatPercent(indicadores.solvencia.endeudamientoPatrimonio)}
                semaforo={
                  indicadores.solvencia.endeudamientoPatrimonio <= 80 ? 'excelente'
                  : indicadores.solvencia.endeudamientoPatrimonio <= 120 ? 'bueno' : 'atencion'
                }
              />
              <IndicadorRow
                nombre="Autonomía Financiera"
                formula="Patrimonio / Activos · ≥ 50%"
                valor={formatPercent(indicadores.solvencia.autonomia)}
                semaforo={
                  indicadores.solvencia.autonomia >= 60 ? 'excelente'
                  : indicadores.solvencia.autonomia >= 40 ? 'bueno' : 'atencion'
                }
              />
              <IndicadorRow
                nombre="Apalancamiento"
                formula="Activos / Patrimonio · ≤ 2.0x"
                valor={`${indicadores.solvencia.apalancamiento.toFixed(2)}x`}
                semaforo={
                  indicadores.solvencia.apalancamiento <= 1.7 ? 'excelente'
                  : indicadores.solvencia.apalancamiento <= 2.5 ? 'bueno' : 'atencion'
                }
              />
            </IndicadoresCard>

            {/* RENTABILIDAD · emerald */}
            <IndicadoresCard color="emerald" icon={TrendingUp} title="RENTABILIDAD">
              <IndicadorRow
                nombre="ROA · Return on Assets"
                formula="Util.Neta / Activos · ≥ 10%"
                valor={formatPercent(indicadores.rentabilidad.roa)}
                semaforo={
                  indicadores.rentabilidad.roa >= 10 ? 'excelente'
                  : indicadores.rentabilidad.roa >= 5 ? 'regular' : 'atencion'
                }
              />
              <IndicadorRow
                nombre="ROE · Return on Equity"
                formula="Util.Neta / Patrimonio · ≥ 18%"
                valor={formatPercent(indicadores.rentabilidad.roe)}
                semaforo={
                  indicadores.rentabilidad.roe >= 18 ? 'excelente'
                  : indicadores.rentabilidad.roe >= 12 ? 'regular' : 'atencion'
                }
              />
              <IndicadorRow
                nombre="Margen Bruto"
                formula="Util.Bruta / Ventas · ≥ 55%"
                valor={formatPercent(indicadores.rentabilidad.margenBruto)}
                semaforo={
                  indicadores.rentabilidad.margenBruto >= 55 ? 'excelente'
                  : indicadores.rentabilidad.margenBruto >= 35 ? 'bueno' : 'atencion'
                }
              />
              <IndicadorRow
                nombre="Margen Neto"
                formula="Util.Neta / Ventas · ≥ 15%"
                valor={formatPercent(indicadores.rentabilidad.margenNeto)}
                semaforo={
                  indicadores.rentabilidad.margenNeto >= 15 ? 'excelente'
                  : indicadores.rentabilidad.margenNeto >= 8 ? 'regular' : 'atencion'
                }
              />
            </IndicadoresCard>

            {/* ACTIVIDAD · purple */}
            <IndicadoresCard color="purple" icon={Activity} title="ACTIVIDAD">
              <IndicadorRow
                nombre="Rotación Inventarios"
                formula="COGS / Inventario · ≥ 6x/año"
                valor={`${indicadores.actividad.rotacionInventarios.toFixed(1)}x`}
                semaforo={
                  indicadores.actividad.rotacionInventarios >= 6 ? 'excelente'
                  : indicadores.actividad.rotacionInventarios >= 4 ? 'bueno' : 'atencion'
                }
              />
              <IndicadorRow
                nombre="DIO · Días Inventario"
                formula="Inv × 365 / COGS · Meta ≤ 60d"
                valor={`${indicadores.actividad.diasInventario.toFixed(0)} días`}
                semaforo={
                  indicadores.actividad.diasInventario <= 60 ? 'excelente'
                  : indicadores.actividad.diasInventario <= 90 ? 'regular' : 'atencion'
                }
              />
              <IndicadorRow
                nombre="DSO · Días Cobranza"
                formula="CxC × 365 / Ventas · Meta ≤ 30d"
                valor={`${indicadores.actividad.diasCobro.toFixed(0)} días`}
                semaforo={
                  indicadores.actividad.diasCobro <= 30 ? 'excelente'
                  : indicadores.actividad.diasCobro <= 50 ? 'regular' : 'atencion'
                }
              />
              <IndicadorRow
                nombre="DPO · Días Pago"
                formula="CxP × 365 / Compras · Mejor ≥ 45d"
                valor={`${indicadores.actividad.diasPago.toFixed(0)} días`}
                semaforo={
                  indicadores.actividad.diasPago >= 45 ? 'excelente'
                  : indicadores.actividad.diasPago >= 30 ? 'bueno' : 'regular'
                }
              />
              <IndicadorRow
                nombre="Ciclo Conversión Efectivo"
                formula="DSO + DIO − DPO · Meta ≤ 45d"
                valor={`${indicadores.actividad.cicloConversionEfectivo.toFixed(0)} días`}
                semaforo={
                  indicadores.actividad.cicloConversionEfectivo <= 45 ? 'excelente'
                  : indicadores.actividad.cicloConversionEfectivo <= 75 ? 'regular' : 'atencion'
                }
                destacado
              />
            </IndicadoresCard>

          </div>

          {/* Diagnóstico semáforo (mantiene el analisis array generado por el service) */}
          {analisis.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-[13px] font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-600" />
                Diagnóstico Financiero · análisis dimensional
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {analisis.map((item, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border ${getEstadoColor(item.estado)} flex items-start gap-2`}>
                    <div className="flex-shrink-0 mt-0.5">{getEstadoIcon(item.estado)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-bold">{item.indicador}</span>
                        <span className="text-[11px] font-mono font-bold tabular-nums">{item.valorFormateado}</span>
                      </div>
                      <p className="text-[10px] opacity-80 mt-0.5">{item.descripcion}</p>
                      {item.recomendacion && (
                        <p className="text-[10px] mt-1 opacity-70 italic">💡 {item.recomendacion}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TENDENCIAS */}
      {/* TENDENCIAS · canon chk5.E-S5 copy-paste literal mockup contabilidad-tab-tendencias-v5.1.html */}
      {!loading && tabActiva === 'tendencias' && (
        <TendenciasView
          tendencia={tendencia}
          mes={mes}
          anio={anio}
          mejorMes={mejorMes}
          peorMes={peorMes}
          acumuladoVentas={acumuladoVentas}
          acumuladoCompras={acumuladoCompras}
          acumuladoUtilidadNeta={acumuladoUtilidadNeta}
        />
      )}

      {/* CIERRE MENSUAL */}
      {!loading && tabActiva === 'cierre' && (
        <CierreMensual mes={mes} anio={anio} />
      )}
        </div>
        {/* fin §E body */}
      </div>
      {/* fin shell frame */}

      {/* chk5.E-S2 · Modal Configurar contable */}
      <ConfigurarContableModal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        onSaved={() => {
          setConfigModalOpen(false);
          cargarDatos(); // refresh para que se reflejen los cambios en KPIs
        }}
      />
    </div>
  );
}

// (sub-componentes canon viven ARRIBA · ver línea ~98 antes de la función Contabilidad)
