/**
 * StageFlow · 4 stage cards horizontales con flow arrows · Workspace Pipeline
 *
 * chk5.B10a (S3.6 M1.bis · Cost Intelligence) · pixel-perfect contra mockup
 * `cost-intelligence-pipeline.html · Sec 1`.
 *
 * Visualiza el flujo de capital atrapado por etapa pipeline:
 *   Pedido → Tránsito → Aduana → Almacén
 *
 * Desktop: 4 cards en fila horizontal · flechas entre ellas
 * Mobile (<lg): cards apiladas verticalmente (F4 canon)
 *
 * Cada card muestra: capital S/ · uds · SKUs distintos · % atrapado · antigüedad
 * Click una card → activa drill-down de esa etapa en workspace padre
 * Card seleccionada: ring-2 teal-500
 * Card con superaThreshold: chip de alerta en antigüedad
 */

import React from 'react';
import {
  ShoppingCart,
  Truck,
  Shield,
  Warehouse,
  ChevronRight,
  Percent,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import type { EtapaPipeline, EtapaPipelineValorizada } from '../../../utils/costIntelligence';

interface StageFlowProps {
  etapas: EtapaPipelineValorizada[];
  etapaActiva: EtapaPipeline | null;
  onSeleccionarEtapa: (etapa: EtapaPipeline) => void;
}

interface StageVariant {
  icon: React.ComponentType<{ className?: string }>;
  bgCard: string;
  borderCard: string;
  bgIcon: string;
  borderIcon: string;
  iconColor: string;
  textColor: string;
  isPreAlmacen: boolean;
}

const VARIANTS: Record<EtapaPipeline, StageVariant> = {
  pedido: {
    icon: ShoppingCart,
    bgCard: 'bg-slate-50',
    borderCard: 'border-slate-200',
    bgIcon: 'bg-white border-slate-300',
    borderIcon: 'border-slate-300',
    iconColor: 'text-slate-600',
    textColor: 'text-slate-700',
    isPreAlmacen: true,
  },
  transito: {
    icon: Truck,
    bgCard: 'bg-sky-50/50',
    borderCard: 'border-sky-200',
    bgIcon: 'bg-white border-sky-300',
    borderIcon: 'border-sky-300',
    iconColor: 'text-sky-700',
    textColor: 'text-sky-700',
    isPreAlmacen: true,
  },
  aduana: {
    icon: Shield,
    bgCard: 'bg-amber-50',
    borderCard: 'border-amber-200',
    bgIcon: 'bg-white border-amber-300',
    borderIcon: 'border-amber-300',
    iconColor: 'text-amber-700',
    textColor: 'text-amber-700',
    isPreAlmacen: true,
  },
  almacen: {
    icon: Warehouse,
    bgCard: 'bg-emerald-50/50',
    borderCard: 'border-emerald-200',
    bgIcon: 'bg-white border-emerald-300',
    borderIcon: 'border-emerald-300',
    iconColor: 'text-emerald-700',
    textColor: 'text-emerald-700',
    isPreAlmacen: false,
  },
};

const fmtPENShort = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('es-PE', { maximumFractionDigits: 1 })}k`;
  return Math.round(n).toLocaleString('es-PE');
};
const fmtInt = (n: number) => n.toLocaleString('es-PE');

export const StageFlow: React.FC<StageFlowProps> = ({ etapas, etapaActiva, onSeleccionarEtapa }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
        <div>
          <div className="text-sm font-bold text-slate-900">
            Flujo de capital · 4 etapas valorizadas
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Click una etapa para drill-down · SKUs en esa etapa
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1 text-[10px] text-slate-400">
          Uds · capital · % atrapado · antigüedad
        </div>
      </div>

      {/* Desktop · 4 cards inline con flechas */}
      <div className="hidden lg:flex items-stretch gap-1.5">
        {etapas.map((etapa, idx) => (
          <React.Fragment key={etapa.etapa}>
            <StageCard
              etapa={etapa}
              activa={etapaActiva === etapa.etapa}
              onClick={() => onSeleccionarEtapa(etapa.etapa)}
            />
            {idx < etapas.length - 1 && (
              <div className="flex items-center justify-center w-6">
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Mobile · cards apiladas (F4 canon) */}
      <div className="lg:hidden space-y-2">
        {etapas.map((etapa) => (
          <StageCardMobile
            key={etapa.etapa}
            etapa={etapa}
            activa={etapaActiva === etapa.etapa}
            onClick={() => onSeleccionarEtapa(etapa.etapa)}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Stage Card · Desktop ────────────────────────────────────────────────────
interface StageCardProps {
  etapa: EtapaPipelineValorizada;
  activa: boolean;
  onClick: () => void;
}

const StageCard: React.FC<StageCardProps> = ({ etapa, activa, onClick }) => {
  const v = VARIANTS[etapa.etapa];
  const Icon = v.icon;

  const ringClass = activa ? 'ring-2 ring-teal-500' : '';
  const borderActive = activa ? 'border-amber-300' : v.borderCard;

  const isEmpty = etapa.uds === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 ${v.bgCard} border ${borderActive} rounded-lg p-3 transition-all hover:-translate-y-[1px] hover:shadow-md ${ringClass} text-left ${isEmpty ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <div className={`w-6 h-6 rounded-md ${v.bgIcon} border flex items-center justify-center`}>
          <Icon className={`w-3 h-3 ${v.iconColor}`} />
        </div>
        <span className={`text-[10px] font-bold ${v.textColor} uppercase tracking-wider`}>
          {etapa.label}
        </span>
        {activa && (
          <span className="ml-auto px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 text-[8px] font-bold">
            ACTIVO
          </span>
        )}
      </div>

      <div className="text-lg font-bold text-slate-900 tabular-nums">
        S/ {fmtPENShort(etapa.capitalPEN)}
      </div>
      <div className="text-[10px] text-slate-600 tabular-nums mt-0.5">
        {fmtInt(etapa.uds)} {etapa.uds === 1 ? 'ud' : 'uds'} · {fmtInt(etapa.skus)} {etapa.skus === 1 ? 'SKU' : 'SKUs'}
      </div>

      {/* % atrapado (sólo pre-almacén) o "Disponible" (almacén) */}
      {v.isPreAlmacen ? (
        <div className={`text-[10px] tabular-nums mt-2 flex items-center gap-1 ${v.textColor}`}>
          <Percent className="w-2.5 h-2.5" />
          {etapa.pctAtrapado.toFixed(0)}% atrapado
        </div>
      ) : (
        <div className={`text-[10px] tabular-nums mt-2 flex items-center gap-1 ${v.textColor}`}>
          <CheckCircle className="w-2.5 h-2.5" />
          Disponible para venta
        </div>
      )}

      {/* Antigüedad · si supera threshold se vuelve bold + ⚠ */}
      {etapa.uds > 0 ? (
        <div className={`text-[10px] tabular-nums flex items-center gap-1 ${etapa.superaThreshold ? `${v.textColor} font-bold` : 'text-slate-500'}`}>
          {etapa.superaThreshold ? <AlertCircle className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
          {etapa.antiguedadPromedioDias}d {v.isPreAlmacen ? 'promedio' : 'rotación media'}
          {etapa.superaThreshold && ` · >${etapa.thresholdDias}d esperado`}
        </div>
      ) : (
        <div className="text-[10px] text-slate-400 italic mt-1">— sin unidades</div>
      )}
    </button>
  );
};

// ─── Stage Card · Mobile compact ─────────────────────────────────────────────
const StageCardMobile: React.FC<StageCardProps> = ({ etapa, activa, onClick }) => {
  const v = VARIANTS[etapa.etapa];
  const Icon = v.icon;
  const ringClass = activa ? 'ring-2 ring-teal-500' : '';
  const borderActive = activa ? 'border-amber-300' : v.borderCard;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full ${v.bgCard} border ${borderActive} rounded-lg p-3 ${ringClass} text-left`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${v.iconColor}`} />
        <span className={`text-[11px] font-bold ${v.textColor} uppercase`}>{etapa.label}</span>
        <span className="ml-auto text-base font-bold text-slate-900 tabular-nums">
          S/ {fmtPENShort(etapa.capitalPEN)}
        </span>
      </div>
      <div className={`text-[10px] tabular-nums ${v.isPreAlmacen ? v.textColor : 'text-slate-500'}`}>
        {fmtInt(etapa.uds)} uds · {fmtInt(etapa.skus)} SKUs
        {v.isPreAlmacen && etapa.pctAtrapado > 0 && ` · ${etapa.pctAtrapado.toFixed(0)}%`}
        {etapa.uds > 0 && ` · ${etapa.antiguedadPromedioDias}d`}
        {etapa.superaThreshold && ' ⚠'}
      </div>
    </button>
  );
};
