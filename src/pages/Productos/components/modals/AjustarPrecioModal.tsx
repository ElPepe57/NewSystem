/**
 * AjustarPrecioModal · Sub-modal "Ajustar precio venta" (Fase F · mockup #42 Estado B)
 *
 * Invocado desde TabInvestigacion footer · "Ajustar precio venta".
 *
 * Estructura:
 *   - Header con producto info (SKU + nombre)
 *   - Contexto · 3 cards (Costo unitario · Sugerido · Rango competencia)
 *   - Input principal precio venta + botón "↻ Aplicar sugerido"
 *   - Cálculos inline en vivo (Utilidad/u · Margen % · vs MIN comp)
 *   - Motivo opcional (input)
 *   - Histórico colapsable (placeholder · datos reales en BI futuro)
 *   - Footer: Cancelar / Actualizar precio
 *
 * Output: onSave({ precioVenta, motivo? }) · padre actualiza el producto.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, DollarSign, History, Check, RotateCw, ChevronDown, ChevronUp } from 'lucide-react';
import type { Producto } from '../../../../types/producto.types';

interface AjustarPrecioModalProps {
  open: boolean;
  producto: Producto;
  /** Costo unitario calculado · viene del Tab Investigación */
  costoUnitarioPEN: number;
  /** Precio sugerido (MIN(comp) × 0.95) · viene del Tab Investigación */
  precioSugeridoPEN: number;
  /** Rango de competencia [min, max] · viene del Tab Investigación */
  rangoCompetencia: { min: number; max: number; total: number };
  onClose: () => void;
  onSave: (precio: number, motivo?: string) => Promise<void> | void;
}

export const AjustarPrecioModal: React.FC<AjustarPrecioModalProps> = ({
  open,
  producto,
  costoUnitarioPEN,
  precioSugeridoPEN,
  rangoCompetencia,
  onClose,
  onSave,
}) => {
  const precioActual = (producto as any).precioVenta ?? producto.investigacion?.precioSugeridoCalculado ?? 0;
  const [precio, setPrecio] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setPrecio(precioActual > 0 ? String(precioActual) : '');
      setMotivo('');
      setSubmitting(false);
      setHistoricoOpen(false);
    }
  }, [open, precioActual]);

  // ESC cierra
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  // Cálculos en vivo
  const precioNum = parseFloat(precio) || 0;
  const utilidad = precioNum > 0 ? precioNum - costoUnitarioPEN : 0;
  const margenPct = precioNum > 0 ? (utilidad / precioNum) * 100 : 0;
  const vsMinComp = rangoCompetencia.min > 0 && precioNum > 0
    ? ((precioNum - rangoCompetencia.min) / rangoCompetencia.min) * 100
    : 0;

  const margenColor = margenPct >= 40 ? 'emerald' : margenPct >= 25 ? 'amber' : 'rose';
  const cambia = Math.abs(precioNum - precioActual) > 0.01;

  const handleSave = async () => {
    if (precioNum <= 0 || submitting) return;
    setSubmitting(true);
    try {
      await onSave(precioNum, motivo.trim() || undefined);
    } catch (err) {
      console.error('[AjustarPrecioModal] error save', err);
      setSubmitting(false);
    }
  };

  const aplicarSugerido = () => {
    if (precioSugeridoPEN > 0) setPrecio(String(precioSugeridoPEN.toFixed(2)));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        aria-label="Cerrar"
      />

      <div className="relative w-full lg:max-w-xl lg:mx-auto bg-white lg:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Drag handle mobile */}
        <div className="lg:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-amber-50 to-white border-b border-slate-200 px-5 py-3.5 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-5 h-5 text-amber-700" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">Ajustar precio venta</h2>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                  {producto.nombreComercial} · <span className="font-mono">{producto.sku}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Contexto · 3 cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Costo unitario</div>
              <div className="text-base font-bold text-slate-900 tabular-nums">
                S/ {costoUnitarioPEN.toFixed(2)}
              </div>
              <div className="text-[9px] text-slate-500">incl. tax + flete</div>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
              <div className="text-[9px] uppercase tracking-wider text-amber-700 font-bold">Sugerido</div>
              <div className="text-base font-bold text-amber-700 tabular-nums">
                S/ {precioSugeridoPEN > 0 ? precioSugeridoPEN.toFixed(2) : '—'}
              </div>
              <div className="text-[9px] text-amber-600">5% bajo MIN comp.</div>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5">
              <div className="text-[9px] uppercase tracking-wider text-blue-700 font-bold">Competencia</div>
              <div className="text-base font-bold text-blue-700 tabular-nums">
                {rangoCompetencia.total > 0
                  ? `S/ ${Math.round(rangoCompetencia.min)} - ${Math.round(rangoCompetencia.max)}`
                  : '—'}
              </div>
              <div className="text-[9px] text-blue-600">{rangoCompetencia.total} competidor{rangoCompetencia.total === 1 ? '' : 'es'}</div>
            </div>
          </div>

          {/* Input principal · precio venta */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 flex items-center justify-between">
              <span>
                Precio venta <span className="text-rose-500">*</span>
              </span>
              {precioSugeridoPEN > 0 && (
                <button
                  type="button"
                  onClick={aplicarSugerido}
                  className="text-[10px] text-amber-700 hover:underline font-bold flex items-center gap-1"
                >
                  <RotateCw className="w-2.5 h-2.5" />
                  Aplicar sugerido S/ {precioSugeridoPEN.toFixed(2)}
                </button>
              )}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-mono font-bold">S/</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={precio}
                onChange={e => setPrecio(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-3 py-2.5 border-2 border-amber-300 rounded-lg text-base font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50"
                autoFocus
              />
            </div>
            <div className="text-[9px] text-slate-500 mt-1">
              Anterior: S/ {precioActual.toFixed(2)}
              {!cambia && precioActual > 0 && ' · sin cambio (solo se confirma)'}
              {precioSugeridoPEN > 0 && ` · Sugerido: S/ ${precioSugeridoPEN.toFixed(2)}`}
            </div>
          </div>

          {/* Cálculos inline · automáticos */}
          {precioNum > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className={`rounded-lg p-2.5 border ${
                margenColor === 'emerald' ? 'bg-emerald-50 border-emerald-200'
                : margenColor === 'amber' ? 'bg-amber-50 border-amber-200'
                : 'bg-rose-50 border-rose-200'
              }`}>
                <div className={`text-[9px] uppercase tracking-wider font-bold ${
                  margenColor === 'emerald' ? 'text-emerald-700'
                  : margenColor === 'amber' ? 'text-amber-700'
                  : 'text-rose-700'
                }`}>Utilidad / unidad</div>
                <div className={`text-base font-bold tabular-nums ${
                  margenColor === 'emerald' ? 'text-emerald-700'
                  : margenColor === 'amber' ? 'text-amber-700'
                  : 'text-rose-700'
                }`}>
                  S/ {utilidad.toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-500 font-mono">{precioNum.toFixed(0)} - {costoUnitarioPEN.toFixed(2)}</div>
              </div>
              <div className={`rounded-lg p-2.5 border ${
                margenColor === 'emerald' ? 'bg-emerald-50 border-emerald-200'
                : margenColor === 'amber' ? 'bg-amber-50 border-amber-200'
                : 'bg-rose-50 border-rose-200'
              }`}>
                <div className={`text-[9px] uppercase tracking-wider font-bold ${
                  margenColor === 'emerald' ? 'text-emerald-700'
                  : margenColor === 'amber' ? 'text-amber-700'
                  : 'text-rose-700'
                }`}>Margen %</div>
                <div className={`text-base font-bold tabular-nums ${
                  margenColor === 'emerald' ? 'text-emerald-700'
                  : margenColor === 'amber' ? 'text-amber-700'
                  : 'text-rose-700'
                }`}>
                  {margenPct.toFixed(1)}%
                </div>
                <div className="text-[9px] text-slate-500">sin gastos admin</div>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5">
                <div className="text-[9px] uppercase tracking-wider text-blue-700 font-bold">vs MIN comp.</div>
                <div className="text-base font-bold text-blue-700 tabular-nums">
                  {rangoCompetencia.min > 0 ? `${vsMinComp >= 0 ? '+' : ''}${vsMinComp.toFixed(1)}%` : '—'}
                </div>
                <div className="text-[9px] text-slate-500">
                  {rangoCompetencia.min > 0
                    ? `${vsMinComp >= 0 ? 'arriba' : 'abajo'} de S/ ${Math.round(rangoCompetencia.min)}`
                    : 'sin datos'}
                </div>
              </div>
            </div>
          )}

          {/* Motivo opcional */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
              Motivo del cambio <span className="text-slate-400 lowercase normal-case">(opcional)</span>
            </label>
            <input
              type="text"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="ej: estrategia premium · ajuste por inflación..."
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Histórico colapsable · placeholder hasta tener auditoría real */}
          <div className="rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setHistoricoOpen(!historicoOpen)}
              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-50"
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex-1 text-left">
                Histórico de precios · auditoría en BI
              </span>
              {historicoOpen
                ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            </button>
            {historicoOpen && (
              <div className="px-3 py-2 border-t border-slate-100 text-[10px] text-slate-500 italic">
                El histórico detallado de cambios de precio se consulta en el módulo BI.
                Aquí solo se confirma el ajuste actual.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={precioNum <= 0 || submitting}
            className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5 shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            {submitting ? 'Actualizando...' : 'Actualizar precio'}
          </button>
        </div>
      </div>
    </div>
  );
};
