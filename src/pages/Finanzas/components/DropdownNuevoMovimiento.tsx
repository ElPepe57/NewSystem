/**
 * DropdownNuevoMovimiento — chk5.D-S2 · SF3
 *
 * Dropdown unificado "+ Nuevo movimiento" del módulo Finanzas.
 * Reemplaza los 6 wizards/CTAs desperdigados con 1 hub unificado · 8 opciones
 * agrupadas por flujo · cada una dispara wizard/modal correspondiente.
 *
 * Diseño canon v8.0 + v9.0 M1 copy-paste literal del mockup MOCK 1
 * (docs/mockups/finanzas-shell-overview-v5.1.html · §3 dropdown).
 *
 * 4 grupos:
 *   1. Ingresos (emerald) — Registrar ingreso simple · Cobrar distribuido
 *   2. Egresos (rose) — Registrar egreso simple · Pagos masivos · Pagar TC
 *   3. Internos (teal) — Transferencia · Conversión USD↔PEN
 *   4. Caja recaudadora (purple) — Liquidar saldo recaudador
 *
 * Wireup: el dropdown sólo dispara callbacks · NO contiene lógica de wizards.
 * El consumidor (FinanzasLayout · Toolbar) decide qué wizard/modal abre.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  ArrowDownCircle,
  GitMerge,
  ArrowUpCircle,
  Layers,
  CreditCard,
  ArrowLeftRight,
  Repeat,
  Truck,
} from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

/**
 * 8 acciones canon del dropdown · IDs estables para wireup desde FinanzasLayout.
 */
export type AccionNuevoMovimiento =
  | 'ingreso_simple'
  | 'cobrar_distribuido'
  | 'egreso_simple'
  | 'pagos_masivos'
  | 'pagar_tc'
  | 'transferencia_interna'
  | 'conversion_usd_pen'
  | 'liquidar_recaudadora';

export interface DropdownNuevoMovimientoProps {
  /** Callback al seleccionar acción · cierra dropdown internamente */
  onSeleccionar: (accion: AccionNuevoMovimiento) => void;
  /** Override label del botón · default "Nuevo movimiento" */
  label?: string;
  /** Compact mode · sólo icono (mobile/header densos) */
  compact?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════
// CATÁLOGO DE OPCIONES · canon v9.0 M1 copy-paste literal del mockup
// ═════════════════════════════════════════════════════════════════════════

interface OpcionConfig {
  id: AccionNuevoMovimiento;
  titulo: string;
  subtitulo: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Color del icon wrapper · canon N4 cross-módulo */
  iconColor: 'emerald' | 'purple' | 'rose' | 'indigo' | 'amber' | 'teal';
  /** Color del hover bg del row · matchea con grupo */
  hoverColor: 'emerald' | 'rose' | 'teal' | 'purple';
}

interface GrupoConfig {
  label: string;
  /** Color del label del grupo */
  color: 'emerald' | 'rose' | 'teal' | 'purple';
  opciones: OpcionConfig[];
}

const GRUPOS: GrupoConfig[] = [
  {
    label: 'Ingresos',
    color: 'emerald',
    opciones: [
      {
        id: 'ingreso_simple',
        titulo: 'Registrar ingreso simple',
        subtitulo: 'Modal 1 step · venta cash · aporte · otros',
        icon: ArrowDownCircle,
        iconColor: 'emerald',
        hoverColor: 'emerald',
      },
      {
        id: 'cobrar_distribuido',
        titulo: 'Cobrar distribuido a múltiples docs',
        subtitulo: 'Wizard 4 pasos · FIFO auto / manual · F-Borradores',
        icon: GitMerge,
        iconColor: 'purple',
        hoverColor: 'emerald',
      },
    ],
  },
  {
    label: 'Egresos',
    color: 'rose',
    opciones: [
      {
        id: 'egreso_simple',
        titulo: 'Registrar egreso simple',
        subtitulo: 'Modal · cross-link a Gastos para categorización',
        icon: ArrowUpCircle,
        iconColor: 'rose',
        hoverColor: 'rose',
      },
      {
        id: 'pagos_masivos',
        titulo: 'Pagos masivos (batch)',
        subtitulo: 'Wizard 4 pasos · 1 cuenta · 1 moneda · F-Borradores',
        icon: Layers,
        iconColor: 'indigo',
        hoverColor: 'rose',
      },
      {
        id: 'pagar_tc',
        titulo: 'Pagar estado de cuenta TC',
        subtitulo: 'Wizard 3 pasos stepper · bimoneda · banco/reembolso',
        icon: CreditCard,
        iconColor: 'amber',
        hoverColor: 'rose',
      },
    ],
  },
  {
    label: 'Internos',
    color: 'teal',
    opciones: [
      {
        id: 'transferencia_interna',
        titulo: 'Transferencia entre cuentas',
        subtitulo: 'Modal · sin cambio moneda · sin diferencial',
        icon: ArrowLeftRight,
        iconColor: 'teal',
        hoverColor: 'teal',
      },
      {
        id: 'conversion_usd_pen',
        titulo: 'Conversión USD ↔ PEN',
        subtitulo: 'Modal · TCPA vs SBS · ingresa o sale del Pool USD',
        icon: Repeat,
        iconColor: 'teal',
        hoverColor: 'teal',
      },
    ],
  },
  {
    label: 'Caja recaudadora',
    color: 'purple',
    opciones: [
      {
        id: 'liquidar_recaudadora',
        titulo: 'Liquidar saldo recaudador',
        subtitulo: 'Wizard 3 pasos · GK Xpress → BCP · concilia servicios',
        icon: Truck,
        iconColor: 'purple',
        hoverColor: 'purple',
      },
    ],
  },
];

// ═════════════════════════════════════════════════════════════════════════
// MAPS de color · Tailwind requiere classes estáticas (no string interpolation)
// ═════════════════════════════════════════════════════════════════════════

const GRUPO_LABEL_COLOR: Record<GrupoConfig['color'], string> = {
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
  teal: 'text-teal-700',
  purple: 'text-purple-700',
};

const HOVER_BG: Record<OpcionConfig['hoverColor'], string> = {
  emerald: 'hover:bg-emerald-50',
  rose: 'hover:bg-rose-50',
  teal: 'hover:bg-teal-50',
  purple: 'hover:bg-purple-50',
};

const ICON_WRAPPER: Record<OpcionConfig['iconColor'], string> = {
  emerald: 'bg-emerald-100 text-emerald-700',
  purple: 'bg-purple-100 text-purple-700',
  rose: 'bg-rose-100 text-rose-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  amber: 'bg-amber-100 text-amber-700',
  teal: 'bg-teal-100 text-teal-700',
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const DropdownNuevoMovimiento: React.FC<DropdownNuevoMovimientoProps> = ({
  onSeleccionar,
  label = 'Nuevo movimiento',
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  const handleSelect = (accion: AccionNuevoMovimiento) => {
    setOpen(false);
    onSeleccionar(accion);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Trigger button · canon N10 primary teal-600
            chk5.D-S8.SF3.D10 · label se oculta en mobile · solo icono Plus visible. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={
          compact
            ? 'w-7 h-7 rounded-lg bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center transition-colors'
            : 'inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-bold px-3 py-1.5 rounded-lg transition-colors'
        }
      >
        <Plus className={compact ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
        {!compact && <span className="hidden sm:inline">{label}</span>}
      </button>

      {/* Dropdown panel · canon v9.0 M1 copy-paste literal del mockup §3 */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg w-[360px] max-w-[90vw] overflow-hidden z-50"
        >
          {/* Header teal */}
          <div className="bg-teal-600 text-white px-4 py-2 text-[11px] font-bold flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" />
            + Nuevo movimiento
          </div>

          {/* Grupos */}
          <div className="p-3 space-y-1 max-h-[70vh] overflow-y-auto">
            {GRUPOS.map((grupo, gIdx) => (
              <React.Fragment key={grupo.label}>
                <div
                  className={`text-[9px] uppercase tracking-wider font-bold px-2 ${
                    gIdx === 0 ? 'pt-1' : 'pt-2'
                  } ${GRUPO_LABEL_COLOR[grupo.color]}`}
                >
                  {grupo.label}
                </div>
                {grupo.opciones.map((opcion) => {
                  const IconCmp = opcion.icon;
                  return (
                    <button
                      key={opcion.id}
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelect(opcion.id)}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-3 transition-colors ${
                        HOVER_BG[opcion.hoverColor]
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          ICON_WRAPPER[opcion.iconColor]
                        }`}
                      >
                        <IconCmp className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-bold text-slate-900">
                          {opcion.titulo}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {opcion.subtitulo}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
