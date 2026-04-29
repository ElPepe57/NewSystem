/**
 * REFERENCIA DE DISEÑO CANÓNICA — PipelineCompras
 *
 * Este archivo es la FUENTE DE VERDAD del patrón "pipeline de listado" del sistema.
 * Cualquier barra de pipeline clickable encima de un listado en otro módulo DEBE replicar
 * este patrón visual.
 *
 * NO MODIFICAR este archivo sin autorización explícita del usuario. Cualquier
 * cambio aquí propaga implícitamente al resto del sistema y puede introducir
 * regresiones en módulos ya alineados.
 *
 * Ver:
 *   - CLAUDE.md → "ACTUALIZACIÓN v6.1 — REFERENCIAS DE DISEÑO CANÓNICAS"
 *   - docs/DESIGN_PATTERNS.md → "Referencias de Diseño Canónicas (S54.x)"
 *   - docs/REGISTRO_IMPLEMENTACION.md → "SESIÓN S54.x — DECISIÓN ESTRATÉGICA"
 *
 * Decisión registrada en sesión S54.x (2026-04-25).
 */
import React from 'react';
import { FileText, Check, Truck, CheckCircle, ChevronRight } from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════════
// Types — Estados derivados Opción B (Borrador → Confirmada → En Despacho → Completada)
// ════════════════════════════════════════════════════════════════════════════

export type EstadoPipelineCompras =
  | 'borrador'
  | 'confirmada'
  | 'en_despacho'
  | 'completada';

export interface PipelineComprasStage {
  id: EstadoPipelineCompras;
  label: string;
  count: number;
}

interface PipelineComprasProps {
  stages: PipelineComprasStage[];
  activeStage: EstadoPipelineCompras | null;
  onStageClick: (estado: EstadoPipelineCompras | null) => void;
  totalOCs?: number;
}

// ════════════════════════════════════════════════════════════════════════════
// PipelineCompras — Pipeline visual de 4 estados (rework S41 Opción B)
// ════════════════════════════════════════════════════════════════════════════

/**
 * PipelineCompras — pipeline horizontal 4-etapas clickable.
 *
 * Reemplaza al PipelineHeader genérico con estados alineados al mockup:
 *   Borrador → Confirmada → En Despacho → Completada
 *
 * Cada etapa es clickable para filtrar la lista de OCs. Click 2× deselecciona.
 */
export const PipelineCompras: React.FC<PipelineComprasProps> = ({
  stages,
  activeStage,
  onStageClick,
  totalOCs,
}) => {
  const handleClick = (id: EstadoPipelineCompras) => {
    if (activeStage === id) onStageClick(null);
    else onStageClick(id);
  };

  const byId = (id: EstadoPipelineCompras) =>
    stages.find((s) => s.id === id) ?? { id, label: id, count: 0 };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-800">Pipeline de compras</h3>
        <span className="text-xs text-slate-500">
          {totalOCs ?? stages.reduce((s, x) => s + x.count, 0)} OCs · ciclo comercial/financiero
        </span>
      </div>

      {/* S54.x — Layout responsive:
           · Mobile / narrow (< lg = 1024px viewport): grid 2x2 sin chevrones.
           · lg+: flex horizontal con chevrones entre etapas.
           Esto evita que los cards se corten al achicar la ventana. */}
      <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center">
        <StageCard
          stage={byId('borrador')}
          active={activeStage === 'borrador'}
          onClick={() => handleClick('borrador')}
          icon={<FileText className="w-4 h-4" />}
          subtitle="Pendientes de confirmar"
          variant="neutral"
        />
        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 hidden lg:block" />
        <StageCard
          stage={byId('confirmada')}
          active={activeStage === 'confirmada'}
          onClick={() => handleClick('confirmada')}
          icon={<Check className="w-4 h-4" />}
          subtitle="Envíos generados, pago pendiente"
          variant="info"
        />
        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 hidden lg:block" />
        <StageCard
          stage={byId('en_despacho')}
          active={activeStage === 'en_despacho'}
          onClick={() => handleClick('en_despacho')}
          icon={<Truck className="w-4 h-4" />}
          subtitle="Envíos en tránsito / parcial"
          variant="warning"
        />
        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 hidden lg:block" />
        <StageCard
          stage={byId('completada')}
          active={activeStage === 'completada'}
          onClick={() => handleClick('completada')}
          icon={<CheckCircle className="w-4 h-4" />}
          subtitle="Todos los envíos recibidos"
          variant="success"
        />
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Internal: StageCard
// ════════════════════════════════════════════════════════════════════════════

const variantClasses = {
  neutral: {
    bg: 'bg-slate-100',
    bgHover: 'hover:bg-slate-200',
    border: 'border-slate-200',
    text: 'text-slate-700',
    textIcon: 'text-slate-600',
    subtitle: 'text-slate-500',
    active: 'ring-2 ring-slate-400',
  },
  info: {
    bg: 'bg-sky-50',
    bgHover: 'hover:bg-sky-100',
    border: 'border-sky-200',
    text: 'text-sky-700',
    textIcon: 'text-sky-600',
    subtitle: 'text-sky-700',
    active: 'ring-2 ring-sky-400',
  },
  warning: {
    bg: 'bg-amber-50',
    bgHover: 'hover:bg-amber-100',
    border: 'border-amber-200',
    text: 'text-amber-700',
    textIcon: 'text-amber-600',
    subtitle: 'text-amber-700',
    active: 'ring-2 ring-amber-400',
  },
  success: {
    bg: 'bg-emerald-50',
    bgHover: 'hover:bg-emerald-100',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    textIcon: 'text-emerald-600',
    subtitle: 'text-emerald-700',
    active: 'ring-2 ring-emerald-400',
  },
} as const;

const StageCard: React.FC<{
  stage: PipelineComprasStage;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  subtitle: string;
  variant: 'neutral' | 'info' | 'warning' | 'success';
}> = ({ stage, active, onClick, icon, subtitle, variant }) => {
  const c = variantClasses[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 lg:flex-1 ${c.bg} ${c.bgHover} rounded-xl p-3 cursor-pointer transition-all border ${c.border} text-left ${active ? c.active : ''}`}
    >
      <div className="flex items-center justify-between mb-1 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`flex-shrink-0 ${c.textIcon}`}>{icon}</span>
          <span className={`text-xs font-semibold truncate ${c.text}`}>{stage.label}</span>
        </div>
        <span className="text-lg font-bold text-slate-900 tabular-nums flex-shrink-0">
          {stage.count}
        </span>
      </div>
      <div className={`text-[10px] ${c.subtitle}`}>{subtitle}</div>
    </button>
  );
};
