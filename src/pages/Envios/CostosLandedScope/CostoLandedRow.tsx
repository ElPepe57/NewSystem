/**
 * CostoLandedRow — Átomo que representa un costo landed individual en el panel
 * de costos del envío.
 *
 * Muestra:
 *  - Concepto + descripción
 *  - Badge scope (envío/tanda N) si aplica
 *  - Monto USD/PEN con tabular-nums
 *  - Badge estado (estimado amber / confirmado emerald)
 *  - Botón "✓ Confirmar" si estimado (dispara modal de confirmación)
 *  - Fecha registro + usuario (auditoría)
 *
 * Estados visuales:
 *  - estimado:    valor en itálica (aún no firme) + boton "Confirmar" destacado
 *  - confirmado:  valor normal + badge emerald + readonly
 */
import React from 'react';
import { Check, Edit, Trash2 } from 'lucide-react';
import { cn } from '../../../design-system';
import type { CostoLanded } from '../../../types/envio.types';

export interface CostoLandedRowProps {
  costo: CostoLanded;
  /** Etiqueta opcional de la tanda (ej: "Tanda 1") si scope='tanda' */
  tandaLabel?: string;
  /** Callback para abrir modal de confirmación del costo (solo si estado='estimado') */
  onConfirmar?: (costo: CostoLanded) => void;
  /** Callback para editar el costo (solo estimado, solo si envío no finalizado) */
  onEditar?: (costo: CostoLanded) => void;
  /** Callback para eliminar el costo (solo estimado, solo si envío no finalizado) */
  onEliminar?: (costo: CostoLanded) => void;
  /** Si el envío tiene costosFinalizados=true, todas las acciones se deshabilitan */
  envioFinalizado?: boolean;
  /** Clase adicional */
  className?: string;
}

const formatUSD = (n: number): string =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const formatPEN = (n: number): string =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatFecha = (ts: any): string => {
  if (!ts) return '';
  try {
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][
      date.getMonth()
    ];
    return `${dd}-${mm}`;
  } catch {
    return '';
  }
};

export const CostoLandedRow: React.FC<CostoLandedRowProps> = ({
  costo,
  tandaLabel,
  onConfirmar,
  onEditar,
  onEliminar,
  envioFinalizado = false,
  className,
}) => {
  const estado = costo.estado ?? 'estimado';
  const esEstimado = estado === 'estimado';
  const scope = costo.scope ?? 'envio';
  const editable = !envioFinalizado && esEstimado;

  return (
    <div
      data-costo-id={costo.id}
      className={cn(
        'px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors',
        esEstimado && 'bg-amber-50/30',
        className
      )}
    >
      {/* Info principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900 truncate">
            {costo.categoriaCostoNombre}
          </span>
          {/* Scope badge */}
          {scope === 'tanda' && tandaLabel && (
            <span className="text-[10px] px-1.5 py-0.5 bg-violet-100 text-violet-800 rounded font-medium">
              {tandaLabel}
            </span>
          )}
          {scope === 'envio' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
              Global
            </span>
          )}
        </div>
        {costo.descripcion && (
          <div className="text-xs text-slate-500 mt-0.5 truncate">
            {costo.descripcion}
          </div>
        )}
        {/* Fecha + método prorrateo */}
        <div className="text-[10px] text-slate-400 mt-0.5">
          Registrado {formatFecha(costo.fechaCreacion)}
          {' · '}
          <code className="bg-slate-100 px-1 rounded">{costo.metodoProrrateo}</code>
          {costo.facturaReferencia && (
            <> · Factura {costo.facturaReferencia}</>
          )}
          {esEstimado && costo.motivoEstimado && (
            <> · <span className="italic text-amber-700">{costo.motivoEstimado}</span></>
          )}
        </div>
      </div>

      {/* Monto */}
      <div className="text-right flex-shrink-0">
        <div
          className={cn(
            'font-semibold tabular-nums',
            esEstimado ? 'text-slate-500 italic' : 'text-slate-900'
          )}
        >
          {costo.moneda === 'USD' ? formatUSD(costo.monto) : formatPEN(costo.monto)}
        </div>
        {costo.moneda === 'USD' && costo.montoPEN > 0 && (
          <div
            className={cn(
              'text-[10px] tabular-nums',
              esEstimado ? 'text-slate-400 italic' : 'text-slate-500'
            )}
          >
            {formatPEN(costo.montoPEN)}
          </div>
        )}
      </div>

      {/* Estado badge */}
      <div className="flex-shrink-0">
        {estado === 'confirmado' ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full">
            <Check className="w-3 h-3" aria-hidden />
            Confirmado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />
            Estimado
          </span>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {esEstimado && onConfirmar && !envioFinalizado && (
          <button
            type="button"
            onClick={() => onConfirmar(costo)}
            className="px-2 py-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors inline-flex items-center gap-1"
            title="Confirmar con factura real"
          >
            <Check className="w-3 h-3" aria-hidden />
            Confirmar
          </button>
        )}
        {editable && onEditar && (
          <button
            type="button"
            onClick={() => onEditar(costo)}
            className="w-7 h-7 text-slate-400 hover:text-teal-700 hover:bg-slate-100 rounded transition-colors inline-flex items-center justify-center"
            title="Editar costo"
            aria-label="Editar"
          >
            <Edit className="w-3.5 h-3.5" aria-hidden />
          </button>
        )}
        {editable && onEliminar && (
          <button
            type="button"
            onClick={() => onEliminar(costo)}
            className="w-7 h-7 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded transition-colors inline-flex items-center justify-center"
            title="Eliminar costo"
            aria-label="Eliminar"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
};
