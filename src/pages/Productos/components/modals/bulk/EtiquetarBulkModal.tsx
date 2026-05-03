/**
 * EtiquetarBulkModal · Mini-modal "Etiquetar masivo" (Fase G · #44 Estado C)
 *
 * Acción 2 de 4 del BulkActionsToolbar.
 *
 * Estructura:
 *   - Header con icono + count
 *   - Chips creables (etiquetas a aplicar) + sugerencias rápidas
 *   - Modo de aplicación: Sumar (default) / Reemplazar
 *   - Footer: Cancelar / Etiquetar a {N}
 */

import React, { useEffect, useState } from 'react';
import { X, Tags, Check } from 'lucide-react';
import type { Producto } from '../../../../../types/producto.types';
import { useEtiquetaStore } from '../../../../../store/etiquetaStore';
import { useAuthStore } from '../../../../../store/authStore';

export type EtiquetadoModo = 'sumar' | 'reemplazar';

interface EtiquetarBulkModalProps {
  open: boolean;
  productos: Producto[];
  onClose: () => void;
  onAplicar: (etiquetaIds: string[], modo: EtiquetadoModo) => Promise<void> | void;
}

export const EtiquetarBulkModal: React.FC<EtiquetarBulkModalProps> = ({
  open,
  productos,
  onClose,
  onAplicar,
}) => {
  const user = useAuthStore(s => s.user);
  const { etiquetasActivas, fetchEtiquetasActivas, create: createEtiqueta } = useEtiquetaStore();
  const [seleccionadas, setSeleccionadas] = useState<Array<{ id: string; nombre: string }>>([]);
  const [query, setQuery] = useState('');
  const [modo, setModo] = useState<EtiquetadoModo>('sumar');
  const [submitting, setSubmitting] = useState(false);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchEtiquetasActivas();
    setSeleccionadas([]);
    setQuery('');
    setModo('sumar');
    setSubmitting(false);
  }, [open, fetchEtiquetasActivas]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  const seleccionadasIds = new Set(seleccionadas.map(s => s.id));
  const sugerencias = etiquetasActivas
    .filter(e => !seleccionadasIds.has(e.id))
    .filter(e => !query.trim() || e.nombre.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  const agregar = (item: { id: string; nombre: string }) => {
    if (seleccionadasIds.has(item.id)) return;
    setSeleccionadas([...seleccionadas, item]);
    setQuery('');
  };

  const remover = (id: string) => {
    setSeleccionadas(seleccionadas.filter(s => s.id !== id));
  };

  const handleCrear = async () => {
    const nombre = query.trim();
    if (!nombre || creando || !user) return;
    setCreando(true);
    try {
      const nueva = await createEtiqueta({ nombre } as any, user.uid);
      agregar({ id: nueva.id, nombre: nueva.nombre });
    } catch (err) {
      console.error('[EtiquetarBulkModal] error crear etiqueta', err);
    } finally {
      setCreando(false);
    }
  };

  const handleAplicar = async () => {
    if (submitting || seleccionadas.length === 0) return;
    setSubmitting(true);
    try {
      await onAplicar(seleccionadas.map(s => s.id), modo);
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
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Tags className="w-4 h-4 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900">Etiquetar {productos.length} producto{productos.length === 1 ? '' : 's'}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Las etiquetas se {modo === 'sumar' ? 'SUMAN' : 'REEMPLAZAN'} a las existentes
              </p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-500"><X className="w-4 h-4" /></button>
          </div>

          {/* Chips seleccionadas */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
              Etiquetas a {modo === 'sumar' ? 'agregar' : 'aplicar'}
            </label>
            <div className="border border-amber-300 rounded-lg p-2 bg-amber-50/30">
              <div className="flex flex-wrap gap-1.5 items-center">
                {seleccionadas.map(s => (
                  <span key={s.id} className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1">
                    ✓ {s.nombre}
                    <button onClick={() => remover(s.id)} className="hover:opacity-70">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={seleccionadas.length === 0 ? 'Buscar etiqueta...' : '+ otra...'}
                  className="text-[10px] flex-1 min-w-[80px] px-1 py-0.5 focus:outline-none bg-transparent placeholder:text-slate-400"
                />
              </div>
            </div>
            {/* Sugerencias del Gestor Maestro */}
            {sugerencias.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1 items-center">
                <span className="text-[9px] text-slate-500 italic">Más usadas:</span>
                {sugerencias.map(e => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => agregar({ id: e.id, nombre: e.nombre })}
                    className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[10px] hover:bg-slate-50"
                  >
                    + {e.nombre}
                  </button>
                ))}
              </div>
            )}
            {query.trim() && sugerencias.every(s => s.nombre.toLowerCase() !== query.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={handleCrear}
                disabled={creando}
                className="mt-1 px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded disabled:opacity-50"
              >
                {creando ? 'Creando...' : `+ Crear "${query.trim()}"`}
              </button>
            )}
          </div>

          {/* Modo de aplicación */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Modo de aplicación</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModo('sumar')}
                className={`px-2.5 py-2 rounded-lg text-left ${modo === 'sumar' ? 'border-2 border-amber-300 bg-amber-50' : 'border border-slate-200 hover:bg-slate-50'}`}
              >
                <div className={`text-[11px] font-bold ${modo === 'sumar' ? 'text-amber-900' : 'text-slate-700'}`}>Sumar (default)</div>
                <div className={`text-[9px] ${modo === 'sumar' ? 'text-amber-700' : 'text-slate-500'}`}>Mantiene las existentes</div>
              </button>
              <button
                type="button"
                onClick={() => setModo('reemplazar')}
                className={`px-2.5 py-2 rounded-lg text-left ${modo === 'reemplazar' ? 'border-2 border-amber-300 bg-amber-50' : 'border border-slate-200 hover:bg-slate-50'}`}
              >
                <div className={`text-[11px] font-bold ${modo === 'reemplazar' ? 'text-amber-900' : 'text-slate-700'}`}>Reemplazar</div>
                <div className={`text-[9px] ${modo === 'reemplazar' ? 'text-amber-700' : 'text-slate-500'}`}>Borra existentes y pone solo estas</div>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button onClick={onClose} disabled={submitting}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleAplicar} disabled={submitting || seleccionadas.length === 0}
              className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5">
              <Tags className="w-3.5 h-3.5" />
              {submitting ? 'Etiquetando...' : `Etiquetar ${productos.length}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
