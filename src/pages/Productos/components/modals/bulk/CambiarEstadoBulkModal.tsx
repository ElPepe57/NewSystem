/**
 * CambiarEstadoBulkModal · Mini-modal "Cambiar estado masivo" (Fase G · #44 Estado B)
 *
 * Acción 1 de 4 del BulkActionsToolbar.
 *
 * Estructura:
 *   - Header con icono + count + breakdown (X actualmente activos · Y inactivos)
 *   - Lista de 3 opciones (Activo · Inactivo · Descontinuado) · pill grande
 *   - Footer: Cancelar / Aplicar a {N}
 */

import React, { useEffect, useState } from 'react';
import { X, ToggleLeft, Check } from 'lucide-react';
import type { Producto, EstadoProducto } from '../../../../../types/producto.types';

interface CambiarEstadoBulkModalProps {
  open: boolean;
  productos: Producto[];
  onClose: () => void;
  onAplicar: (nuevoEstado: EstadoProducto) => Promise<void> | void;
}

const ESTADOS: Array<{
  value: EstadoProducto;
  label: string;
  desc: string;
  color: 'emerald' | 'slate' | 'rose';
}> = [
  { value: 'activo', label: 'Activo', desc: 'visible y vendible', color: 'emerald' },
  { value: 'inactivo', label: 'Inactivo', desc: 'oculto temporalmente', color: 'slate' },
  { value: 'descontinuado', label: 'Descontinuado', desc: 'no se reabastece', color: 'rose' },
];

export const CambiarEstadoBulkModal: React.FC<CambiarEstadoBulkModalProps> = ({
  open,
  productos,
  onClose,
  onAplicar,
}) => {
  const [seleccionado, setSeleccionado] = useState<EstadoProducto>('activo');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSeleccionado('activo');
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  // Breakdown por estado actual
  const breakdown = productos.reduce<Record<string, number>>((acc, p) => {
    const e = p.estado ?? 'activo';
    acc[e] = (acc[e] ?? 0) + 1;
    return acc;
  }, {});
  const breakdownText = Object.entries(breakdown)
    .map(([e, n]) => `${n} ${e}`)
    .join(' · ');

  const handleAplicar = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onAplicar(seleccionado);
    } catch {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <button onClick={onClose} className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" aria-label="Cerrar" />
      <div className="relative w-full max-w-md mx-4 bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <ToggleLeft className="w-4 h-4 text-blue-700" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900">Cambiar estado de {productos.length} producto{productos.length === 1 ? '' : 's'}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">{breakdownText || 'Sin breakdown'}</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-500"><X className="w-4 h-4" /></button>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
              Nuevo estado para los {productos.length}
            </label>
            <div className="space-y-1.5">
              {ESTADOS.map(e => {
                const active = seleccionado === e.value;
                const colorBase = e.color === 'emerald' ? 'emerald' : e.color === 'rose' ? 'rose' : 'slate';
                return (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => setSeleccionado(e.value)}
                    className={`w-full px-3 py-2 text-left rounded-lg flex items-center gap-2 ${
                      active
                        ? `border-2 border-${colorBase}-300 bg-${colorBase}-50 hover:bg-${colorBase}-100`
                        : 'border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full bg-${colorBase}-500`} />
                    <span className={`text-xs font-bold ${active ? `text-${colorBase}-900` : 'text-slate-700'}`}>{e.label}</span>
                    <span className={`text-[10px] ml-auto ${active ? `text-${colorBase}-700` : 'text-slate-500'}`}>{e.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button onClick={onClose} disabled={submitting}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleAplicar} disabled={submitting}
              className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
              <Check className="w-3.5 h-3.5" />
              {submitting ? 'Aplicando...' : `Aplicar a ${productos.length}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
