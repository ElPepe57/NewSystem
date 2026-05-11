/**
 * AlertasFiltros · barra filtros canon F3 · Workspace Alertas
 *
 * chk5.B10b (S3.6 M1.bis · Cost Intelligence) · pixel-perfect contra mockup
 * `cost-intelligence-alertas.html · Sec 1`.
 *
 * Filtros:
 *   - Severidad (Crítica · Alta · Media) · multi-toggle con counts
 *   - Estado visto/sin-ver · multi-toggle
 *   - Search · busqueda por SKU/descripción
 *   - Sort · severidad/fecha
 */

import React from 'react';
import { Zap, AlertTriangle, Info, Eye, Check, Search as SearchIcon, ChevronDown } from 'lucide-react';
import type { AlertaSeverity, AlertasConsolidadas } from '../../../utils/costIntelligence';

interface AlertasFiltrosProps {
  consolidadas: AlertasConsolidadas;
  severidadesSeleccionadas: AlertaSeverity[];
  onToggleSeveridad: (sev: AlertaSeverity) => void;
  estadoFiltro: 'todas' | 'sin_ver' | 'vistas';
  onCambiarEstado: (estado: 'todas' | 'sin_ver' | 'vistas') => void;
  countSinVer: number;
  countVistas: number;
  search: string;
  onCambiarSearch: (s: string) => void;
  sortValue: 'severidad_desc' | 'fecha_desc';
  onCambiarSort: (s: 'severidad_desc' | 'fecha_desc') => void;
}

const SEVERIDADES_LIST: { value: AlertaSeverity; label: string; icon: React.ComponentType<{ className?: string }>; bgActive: string; bg: string; border: string; text: string }[] = [
  { value: 'critica', label: 'Crítica', icon: Zap,            bgActive: 'bg-rose-100 text-rose-700 ring-2 ring-rose-300',   bg: 'bg-rose-50 text-rose-700',   border: 'border-rose-200',   text: 'text-rose-700' },
  { value: 'alta',    label: 'Alta',    icon: AlertTriangle,  bgActive: 'bg-amber-100 text-amber-700 ring-2 ring-amber-300', bg: 'bg-amber-50 text-amber-700', border: 'border-amber-200', text: 'text-amber-700' },
  { value: 'media',   label: 'Media',   icon: Info,           bgActive: 'bg-slate-200 text-slate-700 ring-2 ring-slate-400', bg: 'bg-slate-50 text-slate-600', border: 'border-slate-200', text: 'text-slate-600' },
];

export const AlertasFiltros: React.FC<AlertasFiltrosProps> = ({
  consolidadas,
  severidadesSeleccionadas,
  onToggleSeveridad,
  estadoFiltro,
  onCambiarEstado,
  countSinVer,
  countVistas,
  search,
  onCambiarSearch,
  sortValue,
  onCambiarSort,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4">
      <div className="space-y-2.5">
        {/* Severidad + Estado · misma fila */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Severidad:</span>
          {SEVERIDADES_LIST.map((s) => {
            const isActive = severidadesSeleccionadas.includes(s.value);
            const Icon = s.icon;
            const count = consolidadas.countBySeverity[s.value] ?? 0;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => onToggleSeveridad(s.value)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                  isActive ? s.bgActive : `${s.bg} border ${s.border} hover:opacity-90`
                }`}
              >
                <Icon className="w-2.5 h-2.5" />
                {s.label} <span className="opacity-60 tabular-nums">{count}</span>
              </button>
            );
          })}

          <div className="h-5 w-px bg-slate-200" />

          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Estado:</span>
          <button
            type="button"
            onClick={() => onCambiarEstado(estadoFiltro === 'sin_ver' ? 'todas' : 'sin_ver')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${
              estadoFiltro === 'sin_ver'
                ? 'bg-teal-50 text-teal-700 border-teal-300 ring-2 ring-teal-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Eye className="w-2.5 h-2.5" />
            Sin ver <span className="opacity-60 tabular-nums">{countSinVer}</span>
          </button>
          <button
            type="button"
            onClick={() => onCambiarEstado(estadoFiltro === 'vistas' ? 'todas' : 'vistas')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${
              estadoFiltro === 'vistas'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Check className="w-2.5 h-2.5" />
            Vista <span className="opacity-60 tabular-nums">{countVistas}</span>
          </button>
        </div>

        <div className="border-t border-slate-100" />

        {/* Search + Sort · misma fila */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-[260px]">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => onCambiarSearch(e.target.value)}
              placeholder="Buscar por SKU, descripción..."
              className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-slate-400"
            />
          </div>
          <div className="relative">
            <select
              value={sortValue}
              onChange={(e) => onCambiarSort(e.target.value as 'severidad_desc' | 'fecha_desc')}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 font-medium text-xs pl-3 pr-8 py-2 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <option value="severidad_desc">Severidad ↓</option>
              <option value="fecha_desc">Fecha ↓</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
};
