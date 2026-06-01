/**
 * AtencionTab · canon pixel-perfect mockup X (chk4.18)
 *
 * Estructura del mockup stock-canon-s3.6-X.html (líneas 931-1026):
 *   2 sub-secciones APILADAS verticalmente (NO sub-tabs):
 *     1. Alertas automáticas · header bg-slate-50 con icono Zap amber + count
 *     2. Incidencias manuales · header bg-slate-50 con icono UserX rose + count
 *
 *   Cada sub-sección es card blanco con border slate-200.
 *   Items: row compacto con avatar 9×9 + título + descripción + prioridad + CTA.
 *
 * Reemplaza al SegmentedControl chk4.4 que separaba Alertas/Incidencias en
 * sub-tabs. La consolidación en una sola vista evita navegación extra y
 * muestra TODAS las cosas pendientes en un vistazo.
 */

import React, { useMemo } from 'react';
import {
  Zap, UserX, Clock, TrendingDown, Search, Trash2, PackageX,
  type LucideIcon,
} from 'lucide-react';
import { calcularDiasParaVencer } from '../../../../utils/dateFormatters';
import { formatCurrency } from '../../../../utils/format';
import type { Unidad } from '../../../../types/unidad.types';
import type { Producto } from '../../../../types/producto.types';
import type { AlertaProducto } from './AlertasPrioritarias';

interface AtencionTabProps {
  /** Alertas automáticas calculadas en InventarioPageV2 */
  alertas: AlertaProducto[];
  unidades: Unidad[];
  productos: Producto[];
  onVerProducto: (productoId: string) => void;
  onPromocionar: (productoId: string) => void;
  onOpenVencidasModal: () => void;
  onRefresh: () => void;
}

// ─── AtencionTab principal ────────────────────────────────────────────────────

export const AtencionTab: React.FC<AtencionTabProps> = ({
  alertas,
  unidades,
  productos,
  onVerProducto,
  onPromocionar,
  onOpenVencidasModal,
  onRefresh: _onRefresh,
}) => {
  // Calcular incidencias manuales desde unidades
  const incidencias = useMemo(() => {
    const vencidas = unidades.filter(u => u.estado === 'vencida').length;
    const danadas = unidades.filter(u => u.estado === 'danada').length;
    return { vencidas, danadas };
  }, [unidades]);

  const totalIncidencias = incidencias.vencidas + incidencias.danadas;

  return (
    <div className="space-y-4">
      {/* Sub-sección 1 · Alertas automáticas */}
      <SubSeccion
        icon={Zap}
        iconColor="text-amber-600"
        title="Alertas automáticas"
        helper="generadas por reglas del sistema"
        count={alertas.length}
        countColor="amber"
      >
        {alertas.length === 0 ? (
          <EmptyState message="Sin alertas activas · todo bajo control" />
        ) : (
          alertas.slice(0, 10).map((alerta, idx) => (
            <AlertaItem
              key={`alerta-${idx}`}
              alerta={alerta}
              onVerProducto={onVerProducto}
              onPromocionar={onPromocionar}
            />
          ))
        )}
      </SubSeccion>

      {/* Sub-sección 2 · Incidencias manuales */}
      <SubSeccion
        icon={UserX}
        iconColor="text-rose-600"
        title="Incidencias · decisiones del operador"
        helper="requieren acción manual"
        count={totalIncidencias}
        countColor="rose"
      >
        {totalIncidencias === 0 ? (
          <EmptyState message="Sin incidencias pendientes" />
        ) : (
          <>
            {incidencias.vencidas > 0 && (
              <IncidenciaItem
                icon={Trash2}
                iconBg="bg-rose-100"
                iconColor="text-rose-700"
                title={`${incidencias.vencidas} unidades vencidas · pendientes de disposición`}
                description="Decidir: baja definitiva (gasto cuenta 6951) o donación (sin gasto contable)"
                cta="Gestionar"
                ctaColor="rose"
                onClick={onOpenVencidasModal}
              />
            )}
            {incidencias.danadas > 0 && (
              <IncidenciaItem
                icon={PackageX}
                iconBg="bg-amber-100"
                iconColor="text-amber-700"
                title={`${incidencias.danadas} unidades dañadas · reportadas en recepción`}
                description="Pendiente reclamo al proveedor o decisión de baja"
                cta="Decidir"
                ctaColor="amber"
                onClick={onOpenVencidasModal} // TODO: modal específico de dañadas
              />
            )}
          </>
        )}
      </SubSeccion>
    </div>
  );
};

// ─── SubSeccion wrapper ───────────────────────────────────────────────────────

interface SubSeccionProps {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  helper: string;
  count: number;
  countColor: 'amber' | 'rose';
  children: React.ReactNode;
}

const COUNT_COLOR_CLASSES: Record<'amber' | 'rose', string> = {
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-700',
};

const SubSeccion: React.FC<SubSeccionProps> = ({
  icon: Icon, iconColor, title, helper, count, countColor, children,
}) => (
  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={`w-4 h-4 ${iconColor} flex-shrink-0`} />
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        <span className="text-[10px] text-slate-500 truncate">· {helper}</span>
      </div>
      <span className={`${COUNT_COLOR_CLASSES[countColor]} text-[10px] font-bold px-2 py-0.5 rounded tabular-nums`}>
        {count} {countColor === 'amber' ? 'activas' : 'pendientes'}
      </span>
    </div>
    <div className="divide-y divide-slate-100">
      {children}
    </div>
  </div>
);

// ─── AlertaItem ───────────────────────────────────────────────────────────────

interface AlertaItemProps {
  alerta: AlertaProducto;
  onVerProducto: (productoId: string) => void;
  onPromocionar: (productoId: string) => void;
}

const PRIORIDAD_CLASSES: Record<AlertaProducto['prioridad'], string> = {
  alta: 'bg-rose-100 text-rose-700',
  media: 'bg-amber-100 text-amber-700',
  baja: 'bg-slate-100 text-slate-700',
};

const TIPO_ICON_CONFIG: Record<AlertaProducto['tipo'], { icon: LucideIcon; bg: string; color: string }> = {
  vencimiento:    { icon: Clock,         bg: 'bg-rose-100',  color: 'text-rose-700'  },
  stock_critico:  { icon: TrendingDown,  bg: 'bg-rose-100',  color: 'text-rose-700'  },
  sin_movimiento: { icon: Search,         bg: 'bg-amber-100', color: 'text-amber-700' },
};

const AlertaItem: React.FC<AlertaItemProps> = ({ alerta, onVerProducto, onPromocionar }) => {
  const cfg = TIPO_ICON_CONFIG[alerta.tipo];
  const Icon = cfg.icon;
  const valor = alerta.tipo === 'vencimiento'
    ? alerta.unidadesAfectadas * alerta.producto.costoPromedioUSD
    : 0;

  // CTA y handler según tipo
  let ctaLabel = 'Ver';
  let ctaHandler = () => onVerProducto(alerta.producto.productoId);
  let ctaClass = 'text-slate-600 hover:bg-slate-100';

  if (alerta.tipo === 'vencimiento') {
    ctaLabel = 'Promocionar';
    ctaHandler = () => onPromocionar(alerta.producto.productoId);
    ctaClass = 'text-amber-700 hover:bg-amber-100';
  } else if (alerta.tipo === 'stock_critico') {
    ctaLabel = 'Crear OC';
    // TODO: conectar a flujo de OC cuando esté disponible · por ahora ver producto
    ctaHandler = () => onVerProducto(alerta.producto.productoId);
    ctaClass = 'text-rose-700 hover:bg-rose-50';
  }

  return (
    <div
      className="px-4 py-3 flex items-center gap-3 hover:bg-amber-50/30 cursor-pointer flex-wrap sm:flex-nowrap"
      onClick={() => onVerProducto(alerta.producto.productoId)}
    >
      <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-900 truncate">
          {alerta.producto.nombre} · {alerta.mensaje}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
          {alerta.producto.sku && <span className="font-mono">{alerta.producto.sku}</span>}
          {alerta.unidadesAfectadas > 0 && (
            <span> · <span className="tabular-nums">{alerta.unidadesAfectadas}</span> unidades</span>
          )}
          {valor > 0 && (
            <span> · valor <span className="tabular-nums">{formatCurrency(valor, 'USD')}</span></span>
          )}
        </div>
      </div>
      <span className={`${PRIORIDAD_CLASSES[alerta.prioridad]} text-[10px] font-bold px-2 py-0.5 rounded uppercase tabular-nums flex-shrink-0`}>
        {alerta.prioridad}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); ctaHandler(); }}
        className={`text-xs font-bold px-2 py-1 rounded transition-colors flex-shrink-0 ${ctaClass}`}
      >
        {ctaLabel}
      </button>
    </div>
  );
};

// ─── IncidenciaItem ───────────────────────────────────────────────────────────

interface IncidenciaItemProps {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  cta: string;
  ctaColor: 'rose' | 'amber';
  onClick: () => void;
}

const CTA_COLOR_CLASSES: Record<'rose' | 'amber', string> = {
  rose: 'text-rose-700 bg-rose-100 hover:bg-rose-200',
  amber: 'text-amber-700 bg-amber-100 hover:bg-amber-200',
};

const IncidenciaItem: React.FC<IncidenciaItemProps> = ({
  icon: Icon, iconBg, iconColor, title, description, cta, ctaColor, onClick,
}) => (
  <div className="px-4 py-3 flex items-center gap-3 hover:bg-rose-50/30 flex-wrap sm:flex-nowrap">
    <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
      <Icon className={`w-4 h-4 ${iconColor}`} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{description}</div>
    </div>
    <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase flex-shrink-0">
      Manual
    </span>
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-bold px-3 py-1.5 rounded transition-colors flex-shrink-0 ${CTA_COLOR_CLASSES[ctaColor]}`}
    >
      {cta}
    </button>
  </div>
);

// ─── EmptyState ───────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="px-4 py-8 text-center text-xs text-slate-500">
    {message}
  </div>
);
