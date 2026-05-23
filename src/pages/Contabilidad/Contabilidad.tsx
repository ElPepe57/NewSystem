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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
              {/* Tier neutral · Exportar */}
              <button
                type="button"
                onClick={() => console.info('Exportar Contabilidad · pendiente chk5.E-S6')}
                aria-label="Exportar reporte contable"
                title="Exportar reporte contable a PDF/Excel"
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
        </div>
      )}

      {/* BALANCE GENERAL */}
      {!loading && tabActiva === 'balance' && (
        <BalanceGeneral mes={mes} anio={anio} />
      )}

      {/* ESTADO DE RESULTADOS */}
      {!loading && tabActiva === 'estado-resultados' && (
        <>
          <EstadoResultados />
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
      {!loading && tabActiva === 'tendencias' && (
        <div className="space-y-6">
          {/* Resumen de tendencia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-2 sm:mb-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-sm text-slate-500">Mejor Mes</div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900">{mejorMes?.nombreMes || '-'}</div>
              <div className="text-emerald-600 font-medium text-sm sm:text-base">
                {mejorMes ? formatCurrency(mejorMes.utilidadNeta) : '-'}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-2 sm:mb-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-sm text-slate-500">Peor Mes</div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900">{peorMes?.nombreMes || '-'}</div>
              <div className={`font-medium text-sm sm:text-base ${(peorMes?.utilidadNeta || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {peorMes ? formatCurrency(peorMes.utilidadNeta) : '-'}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-2 sm:mb-3">
                <div className="p-2 bg-sky-100 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-sky-600" />
                </div>
                <div className="text-sm text-slate-500">Promedio Mensual</div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900">
                {formatCurrency(promedioMensual)}
              </div>
              <div className="text-sky-600 font-medium text-sm sm:text-base">
                {tendencia.length} meses
              </div>
            </div>
          </div>

          {/* Evolución Mensual — Cards en mobile, tabla en desktop */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b bg-slate-50">
              <h3 className="font-semibold text-slate-800">Evolución Mensual {anio}</h3>
            </div>

            {/* Mobile: Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {tendencia.map((m, idx) => {
                const margenBruto = m.ventasNetas > 0 ? (m.utilidadBruta / m.ventasNetas) * 100 : 0;
                const margenNeto = m.ventasNetas > 0 ? (m.utilidadNeta / m.ventasNetas) * 100 : 0;
                const maxVentas = Math.max(...tendencia.map(t => t.ventasNetas), 1);
                const barWidth = (m.ventasNetas / maxVentas) * 100;

                return (
                  <div key={idx} className="px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-slate-900">{m.nombreMes}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        m.utilidadNeta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {m.utilidadNeta >= 0 ? '+' : ''}{margenNeto.toFixed(1)}% neto
                      </span>
                    </div>

                    {/* Barra de ventas */}
                    <div className="h-2 bg-slate-100 rounded-full mb-3 overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${barWidth}%` }} />
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Ventas</span>
                        <span className="font-medium text-slate-900">{formatCurrency(m.ventasNetas)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Compras</span>
                        <span className="font-medium text-orange-600">{formatCurrency(m.compras)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">U. Bruta</span>
                        <span className={`font-medium ${m.utilidadBruta >= 0 ? 'text-sky-600' : 'text-red-600'}`}>
                          {formatCurrency(m.utilidadBruta)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Gastos Op.</span>
                        <span className="font-medium text-slate-600">{formatCurrency(m.gastosOperativos)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">EBIT</span>
                        <span className="font-medium text-purple-600">{formatCurrency(m.utilidadOperativa)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">U. Neta</span>
                        <span className={`font-bold ${m.utilidadNeta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(m.utilidadNeta)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Totales mobile */}
              <div className="px-4 py-4 bg-slate-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-slate-900">ACUMULADO {anio}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    acumuladoUtilidadNeta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {acumuladoUtilidadNeta >= 0 ? '+' : ''}{acumuladoVentas > 0 ? ((acumuladoUtilidadNeta / acumuladoVentas) * 100).toFixed(1) : '0.0'}% neto
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ventas</span>
                    <span className="font-bold text-slate-900">{formatCurrency(acumuladoVentas)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Compras</span>
                    <span className="font-bold text-orange-700">{formatCurrency(acumuladoCompras)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">U. Bruta</span>
                    <span className="font-bold text-sky-700">{formatCurrency(tendencia.reduce((s, m) => s + m.utilidadBruta, 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">U. Neta</span>
                    <span className={`font-bold ${acumuladoUtilidadNeta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatCurrency(acumuladoUtilidadNeta)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop: Tabla */}
            {(() => {
              type FilaTendencia = TendenciaMensual & { _esTotal?: boolean };
              const acumUtilidadBruta = tendencia.reduce((s, m) => s + m.utilidadBruta, 0);
              const acumGastosOperativos = tendencia.reduce((s, m) => s + m.gastosOperativos, 0);
              const acumUtilidadOperativa = tendencia.reduce((s, m) => s + m.utilidadOperativa, 0);
              const filaTotal: FilaTendencia = {
                mes: 0,
                anio,
                nombreMes: 'TOTAL',
                ventasNetas: acumuladoVentas,
                compras: acumuladoCompras,
                utilidadBruta: acumUtilidadBruta,
                gastosOperativos: acumGastosOperativos,
                utilidadOperativa: acumUtilidadOperativa,
                utilidadNeta: acumuladoUtilidadNeta,
                _esTotal: true,
              };
              const filas: FilaTendencia[] = [...tendencia, filaTotal];
              const columnasTendencia: DataTableColumn<FilaTendencia>[] = [
                {
                  key: 'nombreMes',
                  header: 'Mes',
                  render: (m) => (
                    <span className={m._esTotal ? 'font-semibold text-slate-900' : 'font-medium text-slate-900'}>
                      {m.nombreMes}
                    </span>
                  ),
                },
                {
                  key: 'ventasNetas',
                  header: 'Ventas',
                  align: 'right',
                  render: (m) => (
                    <span className={m._esTotal ? 'font-semibold text-slate-900' : 'text-slate-700'}>
                      {formatCurrency(m.ventasNetas)}
                    </span>
                  ),
                },
                {
                  key: 'compras',
                  header: 'Compras',
                  align: 'right',
                  render: (m) => (
                    <span className={m._esTotal ? 'font-semibold text-orange-700' : 'text-orange-600'}>
                      {formatCurrency(m.compras)}
                    </span>
                  ),
                },
                {
                  key: 'utilidadBruta',
                  header: 'U. Bruta',
                  align: 'right',
                  render: (m) => (
                    <span className={m._esTotal ? 'font-semibold text-sky-700' : 'text-sky-600'}>
                      {formatCurrency(m.utilidadBruta)}
                    </span>
                  ),
                },
                {
                  key: 'gastosOperativos',
                  header: 'Gastos Op.',
                  align: 'right',
                  render: (m) => (
                    <span className={m._esTotal ? 'font-semibold text-slate-700' : 'text-slate-600'}>
                      {formatCurrency(m.gastosOperativos)}
                    </span>
                  ),
                },
                {
                  key: 'utilidadOperativa',
                  header: 'EBIT',
                  align: 'right',
                  render: (m) => (
                    <span className={m._esTotal ? 'font-semibold text-purple-700' : 'text-purple-600'}>
                      {formatCurrency(m.utilidadOperativa)}
                    </span>
                  ),
                },
                {
                  key: 'utilidadNeta',
                  header: 'U. Neta',
                  align: 'right',
                  render: (m) => (
                    <span className={`font-semibold ${m.utilidadNeta >= 0 ? (m._esTotal ? 'text-emerald-700' : 'text-emerald-600') : (m._esTotal ? 'text-red-700' : 'text-red-600')}`}>
                      {formatCurrency(m.utilidadNeta)}
                    </span>
                  ),
                },
              ];
              return (
                <div className="hidden md:block">
                  <DataTable
                    data={filas}
                    columns={columnasTendencia}
                    keyExtractor={(m) => m._esTotal ? '__total__' : m.nombreMes}
                    compact
                  />
                </div>
              );
            })()}
          </div>

          {/* Gráfico visual — Utilidad Neta por Mes */}
          <div className="bg-white rounded-lg border p-4 sm:p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Utilidad Neta por Mes</h3>
            <div className="space-y-3">
              {tendencia.map((m, idx) => {
                const maxVal = Math.max(...tendencia.map(t => Math.abs(t.utilidadNeta)), 1);
                const width = Math.abs(m.utilidadNeta) / maxVal * 100;
                const isPositive = m.utilidadNeta >= 0;

                return (
                  <div key={idx} className="flex items-center gap-2 sm:gap-3">
                    <div className="w-12 sm:w-20 text-xs sm:text-sm text-slate-600 shrink-0">{m.nombreMes.slice(0, 3)}</div>
                    <div className="flex-1 h-5 sm:h-6 bg-slate-100 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className={`w-20 sm:w-28 text-right text-xs sm:text-sm font-medium shrink-0 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(m.utilidadNeta)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
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
