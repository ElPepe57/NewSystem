/**
 * ArchivarBulkModal · Mini-modal "Archivar masivo" (Fase G · #44 Estado E)
 *
 * Acción 4 de 4 del BulkActionsToolbar · DESTRUCTIVA con confirmación por escritura.
 *
 * Estructura:
 *   - Header con count + "acción reversible · van a la papelera"
 *   - Banner advertencia si hay productos en cotizaciones activas (placeholder · TBD)
 *   - Lista preview (max 3 visibles + "X más")
 *   - Confirmación: escribir "archivar" para habilitar el botón
 *   - Footer: Cancelar / Archivar (botón rose · disabled hasta escribir)
 */

import React, { useEffect, useState } from 'react';
import { X, Archive, AlertTriangle } from 'lucide-react';
import type { Producto } from '../../../../../types/producto.types';

interface ArchivarBulkModalProps {
  open: boolean;
  productos: Producto[];
  onClose: () => void;
  onConfirmar: () => Promise<void> | void;
}

export const ArchivarBulkModal: React.FC<ArchivarBulkModalProps> = ({
  open,
  productos,
  onClose,
  onConfirmar,
}) => {
  const [confirmacion, setConfirmacion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setConfirmacion('');
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  const habilitado = confirmacion.trim().toLowerCase() === 'archivar';

  const handleConfirmar = async () => {
    if (!habilitado || submitting) return;
    setSubmitting(true);
    try {
      await onConfirmar();
    } catch {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  // Preview · primeros 3
  const preview = productos.slice(0, 3);
  const restantes = productos.length - preview.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <button onClick={onClose} className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" aria-label="Cerrar" />
      <div className="relative w-full max-w-md mx-4 bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
              <Archive className="w-4 h-4 text-rose-700" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900">Archivar {productos.length} producto{productos.length === 1 ? '' : 's'}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Acción reversible · van a la papelera (auto-eliminación a los 90 días)</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-500"><X className="w-4 h-4" /></button>
          </div>

          {/* Banner advertencia genérica */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="text-[10px] text-amber-900 flex-1">
              <strong>Atención:</strong> los productos archivados <strong>no aparecerán</strong> en futuras búsquedas,
              cotizaciones nuevas ni reportes. Las cotizaciones existentes que ya los referencian se mantienen intactas.
              Pueden restaurarse desde la papelera dentro de los 90 días.
            </div>
          </div>

          {/* Lista preview */}
          <div className="rounded-lg border border-slate-200 max-h-40 overflow-y-auto">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500 font-bold bg-slate-50 border-b border-slate-200 sticky top-0">
              {productos.length} producto{productos.length === 1 ? '' : 's'} a archivar
            </div>
            <div className="divide-y divide-slate-100">
              {preview.map(p => (
                <div key={p.id} className="px-3 py-1.5 text-[11px] flex items-center gap-2">
                  <span className="font-mono text-slate-500 text-[10px]">{p.sku}</span>
                  <span className="text-slate-700 truncate flex-1">{p.nombreComercial}</span>
                </div>
              ))}
              {restantes > 0 && (
                <div className="px-3 py-1.5 text-[10px] text-slate-400 italic text-center">
                  + {restantes} producto{restantes === 1 ? '' : 's'} más
                </div>
              )}
            </div>
          </div>

          {/* Confirmación por escritura */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
              Para confirmar, escribí <span className="font-mono text-rose-700">archivar</span>
            </label>
            <input
              type="text"
              value={confirmacion}
              onChange={e => setConfirmacion(e.target.value)}
              placeholder="archivar"
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-rose-400"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button onClick={onClose} disabled={submitting}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleConfirmar} disabled={!habilitado || submitting}
              className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5">
              <Archive className="w-3.5 h-3.5" />
              {submitting ? 'Archivando...' : `Archivar ${productos.length} producto${productos.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
