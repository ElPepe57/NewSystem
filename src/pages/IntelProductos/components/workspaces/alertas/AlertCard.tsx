/**
 * AlertCard · card individual de alerta · Workspace Alertas
 *
 * chk5.B10b (S3.6 M1.bis · Cost Intelligence) · pixel-perfect contra mockup
 * `cost-intelligence-alertas.html · Sec 1 · feed`.
 *
 * Variantes visuales:
 *   - Crítica (rose) + ring rose-100
 *   - Alta (amber)
 *   - Media (slate)
 *   - Vista (cualquier severidad pero con opacity-60 + chip VISTA + sin detalle)
 *
 * CTAs siempre visibles: "Ver en [contexto]" + "Marcar visto" (+ accionPrimaria si severity=crítica)
 */

import React from 'react';
import {
  Zap,
  AlertTriangle,
  Info,
  TrendingUp,
  Clock,
  DollarSign,
  Package,
  ExternalLink,
  Check,
  Phone,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ProductoAvatar,
  inferLineaFromProducto,
} from '../../../../Productos/components/shared/ProductoAvatar';
import type { Alerta, AlertaCategoria, AlertaSeverity } from '../../../utils/costIntelligence';
import { ALERTA_CATEGORIA_LABELS } from '../../../utils/costIntelligence';

interface AlertCardProps {
  alerta: Alerta;
  vista: boolean;
  onMarcarVista: () => void;
  onAccionPrimaria?: () => void;
}

const SEVERITY_ICONS: Record<AlertaSeverity, React.ComponentType<{ className?: string }>> = {
  critica: Zap,
  alta: AlertTriangle,
  media: Info,
};

const SEVERITY_LABELS: Record<AlertaSeverity, string> = {
  critica: 'CRÍTICA',
  alta: 'ALTA',
  media: 'MEDIA',
};

const SEVERITY_CLASSES: Record<AlertaSeverity, {
  cardBorder: string;
  cardRing: string;
  badgeBg: string;
  badgeText: string;
  iconBg: string;
  iconColor: string;
  primaryBtnBg: string;
}> = {
  critica: {
    cardBorder: 'border-rose-200',
    cardRing: 'ring-1 ring-rose-100',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-700',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-700',
    primaryBtnBg: 'bg-rose-600 hover:bg-rose-700',
  },
  alta: {
    cardBorder: 'border-amber-200',
    cardRing: '',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
    primaryBtnBg: 'bg-amber-600 hover:bg-amber-700',
  },
  media: {
    cardBorder: 'border-slate-200',
    cardRing: '',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-600',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-500',
    primaryBtnBg: 'bg-slate-700 hover:bg-slate-800',
  },
};

const CATEGORY_ICONS: Record<AlertaCategoria, React.ComponentType<{ className?: string }>> = {
  variance: TrendingUp,
  pipeline: Clock,
  fx: DollarSign,
  stock: Package,
};

const CATEGORY_BADGE_CLASSES: Record<AlertaCategoria, string> = {
  variance: 'bg-rose-50 text-rose-700',
  pipeline: 'bg-amber-50 text-amber-700',
  fx: 'bg-sky-50 text-sky-700',
  stock: 'bg-slate-50 text-slate-700',
};

const ACCION_ICONS: Record<NonNullable<Alerta['accionPrimaria']>['iconName'], React.ComponentType<{ className?: string }>> = {
  phone: Phone,
  'dollar-sign': DollarSign,
  plus: Plus,
  'refresh-cw': RefreshCw,
};

const fmtRelative = (d: Date): string => {
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr} ${diffHr === 1 ? 'hora' : 'horas'}`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `hace ${diffDay} ${diffDay === 1 ? 'día' : 'días'}`;
  if (diffDay < 30) return `hace ${Math.floor(diffDay / 7)} ${Math.floor(diffDay / 7) === 1 ? 'semana' : 'semanas'}`;
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
};

const buildLinkPath = (alerta: Alerta): string => {
  if (!alerta.linkInternal) return '/intel-productos';
  const { workspace, etapa } = alerta.linkInternal;
  // skuId no se usa en URL · queda para futuro deep-link
  void etapa;
  if (workspace === 'catalogo') return '/intel-productos';
  if (workspace === 'pipeline') return '/intel-productos/pipeline';
  if (workspace === 'costos') return '/intel-productos/costos';
  return '/intel-productos';
};

const buildLinkLabel = (alerta: Alerta): string => {
  if (!alerta.linkInternal) return 'Ver';
  const { workspace } = alerta.linkInternal;
  if (workspace === 'catalogo') return 'Ver en Catálogo';
  if (workspace === 'pipeline') return 'Ver en Pipeline';
  if (workspace === 'costos') return 'Ver en Costos';
  return 'Ver';
};

export const AlertCard: React.FC<AlertCardProps> = ({ alerta, vista, onMarcarVista, onAccionPrimaria }) => {
  const SeverityIcon = SEVERITY_ICONS[alerta.severity];
  const CategoryIcon = CATEGORY_ICONS[alerta.category];
  const cls = SEVERITY_CLASSES[alerta.severity];
  const AccionIcon = alerta.accionPrimaria
    ? ACCION_ICONS[alerta.accionPrimaria.iconName]
    : null;

  const linea = alerta.contexto.lineaNegocioNombre
    ? inferLineaFromProducto({
        linea: alerta.contexto.lineaNegocioNombre,
        tipo: undefined,
        esPack: false,
      })
    : null;

  if (vista) {
    // Render compacto · solo header + título + chip VISTA
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 opacity-60">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <CategoryIcon className="w-4 h-4 text-slate-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold flex items-center gap-0.5">
                <SeverityIcon className="w-2.5 h-2.5" />
                {SEVERITY_LABELS[alerta.severity]}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold flex items-center gap-0.5">
                <Check className="w-2.5 h-2.5" />
                VISTA
              </span>
              <span className="text-[10px] text-slate-400 tabular-nums">{fmtRelative(alerta.fechaDeteccion)}</span>
            </div>
            <div className="text-sm font-semibold text-slate-700 mb-1 truncate">
              {alerta.titulo}
            </div>
            {alerta.contexto.sku && (
              <div className="text-[11px] text-slate-500">
                <span className="font-mono">{alerta.contexto.sku}</span>
                {alerta.contexto.marca && (
                  <>
                    <span className="mx-1">·</span>
                    <span>{alerta.contexto.marca}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onMarcarVista}
            className="text-[10px] text-slate-500 hover:text-slate-700 underline whitespace-nowrap flex-shrink-0"
          >
            Re-abrir
          </button>
        </div>
      </div>
    );
  }

  // Render completo · sin vista
  return (
    <div className={`bg-white border ${cls.cardBorder} rounded-xl p-4 ${cls.cardRing} transition-all hover:-translate-y-[1px] hover:shadow-sm`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${cls.iconBg} flex items-center justify-center flex-shrink-0`}>
          <CategoryIcon className={`w-4 h-4 ${cls.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded ${cls.badgeBg} ${cls.badgeText} text-[9px] font-bold flex items-center gap-0.5`}>
              <SeverityIcon className="w-2.5 h-2.5" />
              {SEVERITY_LABELS[alerta.severity]}
            </span>
            <span className={`px-1.5 py-0.5 rounded ${CATEGORY_BADGE_CLASSES[alerta.category]} text-[9px] font-bold`}>
              {ALERTA_CATEGORIA_LABELS[alerta.category].toUpperCase()}
            </span>
            <span className="text-[10px] text-slate-400 tabular-nums">{fmtRelative(alerta.fechaDeteccion)}</span>
          </div>

          <div className="text-sm font-bold text-slate-900 mb-1">
            {alerta.titulo}
          </div>

          {/* Contexto · sku + nombre + métricas */}
          {(alerta.contexto.sku || alerta.contexto.detalleAdicional) && (
            <div className="flex items-center gap-2 text-[11px] text-slate-600 mb-2 flex-wrap">
              {linea && (
                <ProductoAvatar linea={linea} size="sm" />
              )}
              {alerta.contexto.sku && (
                <span className="font-mono text-slate-500">{alerta.contexto.sku}</span>
              )}
              {alerta.contexto.marca && (
                <>
                  <span>·</span>
                  <span>{alerta.contexto.marca}</span>
                </>
              )}
              {alerta.contexto.detalleAdicional && (
                <>
                  <span>·</span>
                  <span className="font-semibold">{alerta.contexto.detalleAdicional}</span>
                </>
              )}
            </div>
          )}

          {/* Descripción */}
          <div className="text-[11px] text-slate-600 mb-3">
            {alerta.descripcion}
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-2 flex-wrap">
            {alerta.linkInternal && (
              <Link
                to={buildLinkPath(alerta)}
                className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md px-2.5 py-1 flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                {buildLinkLabel(alerta)}
              </Link>
            )}
            <button
              type="button"
              onClick={onMarcarVista}
              className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md px-2.5 py-1 flex items-center gap-1"
            >
              <Check className="w-3 h-3" />
              Marcar visto
            </button>
            {alerta.accionPrimaria && AccionIcon && (
              <button
                type="button"
                onClick={onAccionPrimaria}
                className={`text-[11px] font-bold text-white ${cls.primaryBtnBg} rounded-md px-2.5 py-1 flex items-center gap-1`}
              >
                <AccionIcon className="w-3 h-3" />
                {alerta.accionPrimaria.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
