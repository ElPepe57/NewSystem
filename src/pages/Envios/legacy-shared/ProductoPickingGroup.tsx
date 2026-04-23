/**
 * ProductoPickingGroup — Agrupador colapsable de un producto en el Paso 2
 * (Picking) del Wizard T2.
 *
 * Implementa la decisión D-2 (híbrido):
 *  - Header con stepper agregado (+/- cantidad rápida, aplica FIFO priorizado)
 *  - Expandible para ver/editar unidades individuales (UnidadPickerItem)
 *
 * Header muestra:
 *  - Chevron animado (rotado 90° si expandido)
 *  - Emoji + nombre del producto + SKU/procedencia
 *  - Badge "🎯 N prioritarias" si hay pre-vendidas
 *  - Disponibles count + stepper
 *
 * Uso:
 *  <ProductoPickingGroup
 *    productoId="p1"
 *    productoNombre="NOW Ashwagandha KSM-66"
 *    productoSKU="NOW-ASH-90"
 *    productoEmoji="💊"
 *    procedenciaLabel="OC-2026-001 (Amazon)"
 *    unidades={[...]}
 *    unidadesIdsSeleccionadas={state.unidadesIdsSeleccionadas}
 *    cantidadSeleccionada={2}
 *    prioritariasCount={2}
 *    onToggleUnidad={id => dispatch({ type: 'TOGGLE_UNIDAD', unidadId: id })}
 *    onChangeCantidad={c => dispatch({ type: 'SET_CANTIDAD_PRODUCTO', productoId, cantidad: c })}
 *    defaultExpanded={true}
 *  />
 */
import React, { useState } from 'react';
import { cn } from '../../../design-system';
import { UnidadPickerItem } from './UnidadPickerItem';

export interface ProductoPickingGroupUnidad {
  unidadId: string;
  codigoUnidad: string;
  reservadaParaLabel?: string | null;
  fechaRecepcionLabel?: string;
  extraRightLabel?: string;
  disabled?: boolean;
}

export interface ProductoPickingGroupProps {
  /** ID del producto (para acciones y key) */
  productoId: string;
  /** Nombre comercial del producto */
  productoNombre: string;
  /** SKU del producto (para header) */
  productoSKU?: string;
  /** Emoji del producto (fallback a etiqueta genérica) */
  productoEmoji?: string;
  /** Texto de procedencia (ej: "OC-2026-001 (Amazon)") */
  procedenciaLabel?: string;
  /** Unidades del producto disponibles en la casilla origen */
  unidades: ProductoPickingGroupUnidad[];
  /** IDs globales de unidades seleccionadas (las de otros productos también) */
  unidadesIdsSeleccionadas: string[];
  /** Cantidad seleccionada de ESTE producto (para el stepper, 0..unidades.length) */
  cantidadSeleccionada: number;
  /** Cantidad de pre-vendidas disponibles en este producto */
  prioritariasCount?: number;
  /** Callback al togglear una unidad individual */
  onToggleUnidad: (unidadId: string) => void;
  /** Callback al cambiar la cantidad (dispara FIFO priorizado en el reducer) */
  onChangeCantidad: (cantidad: number) => void;

  // ─── Estado expandido (opcional controlado) ───
  /** Si se controla desde el padre */
  expanded?: boolean;
  /** Default cuando es no-controlado */
  defaultExpanded?: boolean;
  /** Callback al alternar expandido */
  onToggleExpanded?: (expanded: boolean) => void;

  /** Clase adicional */
  className?: string;
}

export const ProductoPickingGroup: React.FC<ProductoPickingGroupProps> = ({
  productoId,
  productoNombre,
  productoSKU,
  productoEmoji = '📦',
  procedenciaLabel,
  unidades,
  unidadesIdsSeleccionadas,
  cantidadSeleccionada,
  prioritariasCount = 0,
  onToggleUnidad,
  onChangeCantidad,
  expanded: expandedControlled,
  defaultExpanded = false,
  onToggleExpanded,
  className,
}) => {
  // Si `expanded` viene como prop, es controlado. Si no, estado local.
  const [expandedInternal, setExpandedInternal] = useState(defaultExpanded);
  const esControlado = expandedControlled !== undefined;
  const isExpanded = esControlado ? expandedControlled : expandedInternal;

  const disponibles = unidades.length;
  const puedeIncrementar = cantidadSeleccionada < disponibles;
  const puedeDecrementar = cantidadSeleccionada > 0;

  const handleToggleExpanded = () => {
    const nuevo = !isExpanded;
    if (esControlado) {
      onToggleExpanded?.(nuevo);
    } else {
      setExpandedInternal(nuevo);
      onToggleExpanded?.(nuevo);
    }
  };

  // Evita que los clicks en los botones del stepper disparen el toggle expandible
  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      data-producto-id={productoId}
      className={cn(
        'bg-white border border-slate-200 rounded-xl overflow-hidden',
        className
      )}
    >
      {/* Header — clickeable para expandir/colapsar */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggleExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggleExpanded();
          }
        }}
        className={cn(
          'px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors',
          isExpanded ? 'bg-slate-50 border-b border-slate-200' : 'hover:bg-slate-50'
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Chevron */}
          <svg
            className={cn(
              'w-4 h-4 text-slate-500 transition-transform flex-shrink-0',
              isExpanded && 'rotate-90'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 5l7 7-7 7"
            />
          </svg>

          {/* Emoji */}
          <span className="text-2xl flex-shrink-0" aria-hidden>{productoEmoji}</span>

          {/* Nombre + SKU + procedencia */}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {productoNombre}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {productoSKU && <span>SKU: {productoSKU}</span>}
              {productoSKU && procedenciaLabel && <span> · </span>}
              {procedenciaLabel && <span>{procedenciaLabel}</span>}
              {prioritariasCount > 0 && (
                <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0 bg-emerald-100 text-emerald-700 text-[10px] font-medium rounded">
                  🎯 {prioritariasCount} prioritaria{prioritariasCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Disponibles + Stepper */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-slate-500">
            Disponibles: <strong className="text-slate-900">{disponibles}</strong>
          </span>
          <div
            className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg overflow-hidden"
            onClick={stopPropagation}
          >
            <button
              type="button"
              disabled={!puedeDecrementar}
              onClick={() => onChangeCantidad(Math.max(0, cantidadSeleccionada - 1))}
              className="w-7 h-7 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Disminuir cantidad"
            >
              −
            </button>
            <span
              className={cn(
                'w-8 text-center text-sm font-bold tabular-nums',
                cantidadSeleccionada === 0 && 'text-slate-400'
              )}
            >
              {cantidadSeleccionada}
            </span>
            <button
              type="button"
              disabled={!puedeIncrementar}
              onClick={() => onChangeCantidad(Math.min(disponibles, cantidadSeleccionada + 1))}
              className="w-7 h-7 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Aumentar cantidad"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Cuerpo — lista de unidades individuales (solo si expandido) */}
      {isExpanded && (
        <div className="divide-y divide-slate-100">
          {unidades.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400 italic">
              Este producto no tiene unidades disponibles en la casilla origen.
            </div>
          ) : (
            unidades.map((u) => (
              <UnidadPickerItem
                key={u.unidadId}
                unidadId={u.unidadId}
                codigoUnidad={u.codigoUnidad}
                seleccionada={unidadesIdsSeleccionadas.includes(u.unidadId)}
                reservadaParaLabel={u.reservadaParaLabel}
                fechaRecepcionLabel={u.fechaRecepcionLabel}
                extraRightLabel={u.extraRightLabel}
                disabled={u.disabled}
                onToggle={() => onToggleUnidad(u.unidadId)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};
