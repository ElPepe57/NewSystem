/**
 * ReponerCortarTab — Tab "¿Qué repongo / corto?" del hub CTRU (F5c).
 *
 * Catálogo de DECISIÓN keep-kill: utilidad real + cuánto recuperaste = la señal para
 * reponer o cortar un SKU. Reusa los agregados ya computados en el Resumen (recuperación
 * vía calcularCurvaRecuperacion + utilidad). Click en una fila → mini-dossier.
 */
import React, { useMemo, useState } from 'react';
import { Repeat, Search } from 'lucide-react';
import type { CTRUProductoDetalle } from '../../../store/ctruStore';

export interface FilaReponer {
  p: CTRUProductoDetalle;
  utilidadPct: number;
  recuperadoPct: number;
}

interface Props {
  filas: FilaReponer[];
  onSelectProducto: (p: CTRUProductoDetalle) => void;
}

type Filtro = 'todos' | 'pierden' | 'rezagados';

interface Senal { texto: string; sugerencia: string; tono: 'emerald' | 'amber' | 'rose' | 'slate'; }

function señal(f: FilaReponer): Senal {
  if (f.utilidadPct < 0) return { texto: 'pierde + no recupera', sugerencia: 'Cortar / re-precio', tono: 'rose' };
  if (f.recuperadoPct >= 100) return { texto: 'rinde + ya recuperó', sugerencia: 'Reponer ↑', tono: 'emerald' };
  if (f.recuperadoPct < 50) return { texto: 'rinde pero rota lento', sugerencia: 'Esperar', tono: 'amber' };
  return { texto: 'sano', sugerencia: 'Mantener', tono: 'slate' };
}

const TONO: Record<Senal['tono'], { texto: string; sug: string }> = {
  emerald: { texto: 'text-emerald-600', sug: 'text-emerald-700' },
  amber: { texto: 'text-amber-600', sug: 'text-amber-700' },
  rose: { texto: 'text-rose-600', sug: 'text-rose-700' },
  slate: { texto: 'text-slate-500', sug: 'text-slate-600' },
};

export const ReponerCortarTab: React.FC<Props> = ({ filas, onSelectProducto }) => {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      const s = señal(f);
      if (filtro === 'pierden' && f.utilidadPct >= 0) return false;
      if (filtro === 'rezagados' && !(f.utilidadPct >= 0 && f.recuperadoPct < 50)) return false;
      if (q && !(f.p.productoNombre.toLowerCase().includes(q) || (f.p.productoSKU || '').toLowerCase().includes(q))) return false;
      return s !== undefined;
    });
  }, [filas, filtro, busqueda]);

  if (filas.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center text-center">
        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-3"><Repeat className="w-6 h-6 text-indigo-400" /></div>
        <h3 className="text-[15px] font-semibold text-slate-900">Sin productos para evaluar</h3>
        <p className="text-[12px] text-slate-500 mt-1 max-w-md">Acá vas a ver qué reponer y qué cortar según cuánto rinde y cuánto recuperaste de cada producto.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto o SKU…" className="w-full pl-9 pr-3 py-2 text-[13px] bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {([['todos', 'Todos'], ['pierden', '⚠ Pierden'], ['rezagados', 'Rezagados']] as [Filtro, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setFiltro(id)} className={`whitespace-nowrap px-2.5 py-1.5 text-[11px] rounded-lg font-semibold ${filtro === id ? 'bg-indigo-600 text-white' : id === 'pierden' ? 'bg-white border border-rose-200 text-rose-600' : id === 'rezagados' ? 'bg-white border border-amber-200 text-amber-600' : 'bg-white border border-slate-200 text-slate-600'}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Catálogo keep-kill */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="text-[14px] font-semibold text-slate-900 mb-1 flex items-center gap-2"><Repeat className="w-4 h-4 text-indigo-600" /> ¿Qué conviene reponer y qué cortar?</h3>
        <p className="text-[11px] text-slate-500 mb-3">Utilidad real + cuánto recuperaste = la señal para reponer o matar un SKU. Click en uno para el dossier completo.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
              <th className="text-left font-bold py-2">Producto</th><th className="text-right font-bold py-2">Utilidad real</th><th className="text-right font-bold py-2">Recuperado</th><th className="text-left font-bold py-2 pl-3">Señal</th><th className="text-right font-bold py-2">Sugerencia</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.map((f) => {
                const s = señal(f);
                const t = TONO[s.tono];
                return (
                  <tr key={f.p.productoId} onClick={() => onSelectProducto(f.p)} className={`cursor-pointer ${f.utilidadPct < 0 ? 'bg-rose-50/40 hover:bg-rose-50' : 'hover:bg-slate-50'}`}>
                    <td className={`py-2 font-medium ${f.utilidadPct < 0 ? 'text-rose-800' : 'text-slate-800'}`}>{f.p.productoNombre}</td>
                    <td className={`text-right tabular-nums font-bold ${f.utilidadPct < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{Math.round(f.utilidadPct)}%</td>
                    <td className={`text-right tabular-nums ${f.recuperadoPct < 50 ? 'text-amber-600' : ''}`}>{Math.round(f.recuperadoPct)}%</td>
                    <td className={`pl-3 ${t.texto}`}>{s.texto}</td>
                    <td className={`text-right text-[11px] font-semibold ${t.sug}`}>{s.sugerencia}</td>
                  </tr>
                );
              })}
              {visibles.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-[12px] text-slate-400">Ningún producto coincide con el filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
