/**
 * TCChip — Chip read-only del Tipo de Cambio con override manual (D-10)
 *
 * S52 v7 · D-10: el TC viene auto-poblado desde la sección TC del sistema
 * (`tipoCambio.service.ts`). NO es un input editable por defecto. Para
 * override, el usuario clickea "Editar manualmente" → modal de confirmación
 * con warning + auditoría.
 */
import React, { useState, useEffect } from 'react';
import { useTipoCambio } from '../../../../hooks/useTipoCambio';

interface Props {
  /** TC actual en el state del wizard */
  tc: number;
  /** `true` si el usuario overrideo manualmente (se muestra en amber) */
  overrideActivo: boolean;
  /** Callback al cambiar el TC (override explícito) */
  onChange: (tc: number, override: boolean) => void;
}

export const TCChip: React.FC<Props> = ({ tc, overrideActivo, onChange }) => {
  const { tc: tcSistema, loading, freshness, esFallback } = useTipoCambio();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(tc);

  // Al montar, si el TC del state está en 0 y hay uno del sistema, auto-poblar
  useEffect(() => {
    if (tc === 0 && tcSistema && !overrideActivo) {
      onChange(tcSistema.venta || tcSistema.compra, false);
    }
  }, [tc, tcSistema, overrideActivo, onChange]);

  const fuente = overrideActivo
    ? 'Manual · editado'
    : esFallback
    ? 'Fallback'
    : 'SBS';

  const fechaLabel = (() => {
    if (loading) return 'Cargando...';
    if (!tcSistema) return 'Sin TC del día';
    if (freshness === 'fresh') return 'Tasa del día';
    if (freshness === 'stale') return 'Tasa reciente';
    if (freshness === 'expired') return 'Tasa desactualizada';
    return 'Tasa del sistema';
  })();

  const handleAbrirEdicion = () => {
    setBorrador(tc || tcSistema?.venta || 3.78);
    setEditando(true);
  };

  const handleGuardar = () => {
    if (borrador > 0) {
      onChange(borrador, true);
      setEditando(false);
    }
  };

  const handleReset = () => {
    if (tcSistema) {
      onChange(tcSistema.venta || tcSistema.compra, false);
    }
    setEditando(false);
  };

  if (editando) {
    return (
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">⚠️</span>
          <div className="flex-1 text-xs">
            <div className="font-bold text-amber-900 mb-0.5">
              Reemplazar TC oficial del día
            </div>
            <p className="text-amber-800">
              Estás ingresando un TC manual. Se registrará en auditoría quién y
              cuándo lo hizo. Esto NO actualiza el TC global del sistema.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-700">Nuevo TC:</label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={borrador}
            onChange={e => setBorrador(parseFloat(e.target.value) || 0)}
            className="flex-1 max-w-32 px-3 py-1.5 text-sm border border-slate-300 rounded-lg tabular-nums"
            autoFocus
          />
          <span className="text-xs text-slate-500">PEN/USD</span>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Volver al TC del sistema
          </button>
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="text-xs font-medium px-3 py-1 text-slate-700 hover:bg-slate-100 rounded"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={borrador <= 0}
            className="text-xs font-medium px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
          >
            Confirmar override
          </button>
        </div>
      </div>
    );
  }

  const bgClass = overrideActivo
    ? 'bg-amber-50 border-amber-200'
    : 'bg-slate-50 border-slate-200';

  return (
    <div className={`border rounded-xl p-3 flex items-center justify-between ${bgClass}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">💱</span>
        <div>
          <div className="text-sm font-semibold text-slate-900 tabular-nums">
            {tc > 0 ? tc.toFixed(3) : '—'}{' '}
            <span className="text-xs font-normal text-slate-500">PEN/USD</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {fechaLabel} · {fuente}
            {overrideActivo && (
              <span className="text-amber-700 font-semibold"> · override activo</span>
            )}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleAbrirEdicion}
        className="text-xs font-medium text-slate-600 hover:text-slate-900"
      >
        {overrideActivo ? 'Cambiar ↗' : 'Editar manualmente ↗'}
      </button>
    </div>
  );
};
