/**
 * PaginacionFooter · Footer de paginación canónico (Fase G · mockup #43)
 *
 * Estructura:
 *   - Izq: "Mostrando X-Y de Z"
 *   - Centro: Anterior + [1, 2, 3 … N] + Siguiente
 *   - Der: "Ir a página: [input]"
 */

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginacionFooterProps {
  paginaActual: number;
  totalItems: number;
  itemsPorPagina: number;
  onCambiarPagina: (pagina: number) => void;
  /** Máximo de botones de página visibles · default 5 */
  maxBotones?: number;
}

export const PaginacionFooter: React.FC<PaginacionFooterProps> = ({
  paginaActual,
  totalItems,
  itemsPorPagina,
  onCambiarPagina,
  maxBotones = 5,
}) => {
  const totalPaginas = Math.max(1, Math.ceil(totalItems / itemsPorPagina));
  const pagina = Math.min(Math.max(1, paginaActual), totalPaginas);

  const inicio = (pagina - 1) * itemsPorPagina + 1;
  const fin = Math.min(pagina * itemsPorPagina, totalItems);

  // Lógica de botones de página: muestra 1, 2, 3, …, N o variantes según posición actual
  const botones = useMemo<Array<number | 'gap'>>(() => {
    if (totalPaginas <= maxBotones) {
      return Array.from({ length: totalPaginas }, (_, i) => i + 1);
    }
    const resultado: Array<number | 'gap'> = [];
    // Siempre incluir 1
    resultado.push(1);
    if (pagina > 3) resultado.push('gap');
    // Páginas adyacentes
    const start = Math.max(2, pagina - 1);
    const end = Math.min(totalPaginas - 1, pagina + 1);
    for (let i = start; i <= end; i++) resultado.push(i);
    if (pagina < totalPaginas - 2) resultado.push('gap');
    // Siempre incluir última
    resultado.push(totalPaginas);
    return resultado;
  }, [pagina, totalPaginas, maxBotones]);

  if (totalItems === 0) return null;

  return (
    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
      <div className="text-[10px] text-slate-500">
        Mostrando <strong className="tabular-nums">{inicio}-{fin}</strong> de <strong className="tabular-nums">{totalItems}</strong>
      </div>

      {/* Botones de página */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onCambiarPagina(pagina - 1)}
          disabled={pagina === 1}
          className="px-2 py-1 text-[11px] flex items-center gap-1 rounded hover:bg-slate-200 text-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <ChevronLeft className="w-3 h-3" />
          Anterior
        </button>

        {botones.map((b, idx) =>
          b === 'gap' ? (
            <span key={`gap-${idx}`} className="text-[11px] text-slate-400 px-1">…</span>
          ) : (
            <button
              key={b}
              type="button"
              onClick={() => onCambiarPagina(b)}
              className={`px-2.5 py-1 text-[11px] rounded font-${pagina === b ? 'bold' : 'medium'} ${
                pagina === b
                  ? 'bg-amber-600 text-white'
                  : 'hover:bg-slate-200 text-slate-700'
              }`}
            >
              {b}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onCambiarPagina(pagina + 1)}
          disabled={pagina === totalPaginas}
          className="px-2 py-1 text-[11px] font-bold flex items-center gap-1 rounded text-amber-700 hover:bg-amber-50 disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          Siguiente
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Salto rápido a página */}
      {totalPaginas > 1 && (
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          Ir a página
          <input
            type="number"
            min={1}
            max={totalPaginas}
            value={pagina}
            onChange={e => {
              const n = parseInt(e.target.value);
              if (!isNaN(n) && n >= 1 && n <= totalPaginas) onCambiarPagina(n);
            }}
            className="w-12 px-1.5 py-0.5 border border-slate-300 rounded text-[10px] tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <span className="text-slate-400">/ {totalPaginas}</span>
        </div>
      )}
    </div>
  );
};
