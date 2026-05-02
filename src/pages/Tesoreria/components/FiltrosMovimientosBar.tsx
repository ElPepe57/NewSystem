/**
 * FiltrosMovimientosBar · Migración pixel-perfect M-MIGRACION-VISUAL
 *
 * Barra de filtros del libro mayor de movimientos siguiendo el patrón canónico
 * de la 6a referencia (FiltrosFinanzasBar · S58e) y el mockup
 * `tesoreria-movimientos-s58e.html`.
 *
 * Layout:
 *   FILA ÚNICA (wrap a múltiples si no entra):
 *     date range · | · chips Categoría · | · chips Canal · | · buscador
 *     · chips Documento · | · botón Limpiar
 *
 * Filtros expuestos:
 *   - rangoFechas: '7d' | '30d' | '90d' | '6m' | 'año' | 'todo'
 *   - categorías: ingreso / egreso / interno / fx / tc_cargo / ajuste (multi)
 *   - canales: transferencia / yape / plin / efectivo / tc_cargo / sip (multi)
 *   - documentos: oc / venta / gasto / envio / lote (multi)
 *   - búsqueda: por concepto o número de documento
 */

import React from 'react';
import {
  Search,
  X,
  Calendar,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  CreditCard,
  TrendingUp,
} from 'lucide-react';

export type RangoFechasMov = '7d' | '30d' | '90d' | '6m' | 'año' | 'todo';
export type CategoriaMov = 'ingreso' | 'egreso' | 'interno' | 'fx' | 'tc_cargo' | 'ajuste';
export type CanalMov = 'transferencia' | 'yape' | 'plin' | 'efectivo' | 'tc_cargo' | 'sip' | 'otro';
export type DocumentoMov = 'oc' | 'venta' | 'gasto' | 'envio' | 'lote';

interface FiltrosMovimientosBarProps {
  rangoFechas: RangoFechasMov;
  categoriasActivas: Set<CategoriaMov>;
  canalesActivos: Set<CanalMov>;
  documentosActivos: Set<DocumentoMov>;
  searchTerm: string;
  hayFiltrosActivos: boolean;
  onCambiarRango: (r: RangoFechasMov) => void;
  onToggleCategoria: (c: CategoriaMov) => void;
  onToggleCanal: (c: CanalMov) => void;
  onToggleDocumento: (d: DocumentoMov) => void;
  onCambiarSearchTerm: (t: string) => void;
  onLimpiarTodo: () => void;
}

const RANGOS: Array<{ id: RangoFechasMov; label: string }> = [
  { id: 'todo', label: 'Todo' },
  { id: '7d', label: 'Últ. 7d' },
  { id: '30d', label: 'Últ. 30d' },
  { id: '90d', label: 'Últ. 90d' },
  { id: '6m', label: 'Últ. 6m' },
  { id: 'año', label: 'Este año' },
];

const CATEGORIAS: Array<{
  id: CategoriaMov;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  classes: { activo: string; inactivo: string };
}> = [
  {
    id: 'ingreso',
    label: 'Ingresos',
    Icon: ArrowDownRight,
    classes: {
      activo: 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300',
      inactivo: 'bg-white text-slate-600 border border-slate-200 hover:bg-emerald-50',
    },
  },
  {
    id: 'egreso',
    label: 'Egresos',
    Icon: ArrowUpRight,
    classes: {
      activo: 'bg-rose-100 text-rose-700 ring-2 ring-rose-300',
      inactivo: 'bg-white text-slate-600 border border-slate-200 hover:bg-rose-50',
    },
  },
  {
    id: 'interno',
    label: 'Internos',
    Icon: ArrowLeftRight,
    classes: {
      activo: 'bg-amber-100 text-amber-700 ring-2 ring-amber-300',
      inactivo: 'bg-white text-slate-600 border border-slate-200 hover:bg-amber-50',
    },
  },
  {
    id: 'fx',
    label: 'FX',
    Icon: ArrowLeftRight,
    classes: {
      activo: 'bg-teal-100 text-teal-700 ring-2 ring-teal-300',
      inactivo: 'bg-white text-slate-600 border border-slate-200 hover:bg-teal-50',
    },
  },
  {
    id: 'tc_cargo',
    label: 'TC',
    Icon: CreditCard,
    classes: {
      activo: 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300',
      inactivo: 'bg-white text-slate-600 border border-slate-200 hover:bg-indigo-50',
    },
  },
  {
    id: 'ajuste',
    label: 'Ajustes',
    Icon: TrendingUp,
    classes: {
      activo: 'bg-slate-200 text-slate-700 ring-2 ring-slate-400',
      inactivo: 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50',
    },
  },
];

const CANALES: Array<{ id: CanalMov; label: string }> = [
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'yape', label: 'Yape' },
  { id: 'plin', label: 'Plin' },
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'tc_cargo', label: 'TC Cargo' },
  { id: 'sip', label: 'SIP' },
];

const DOCUMENTOS: Array<{ id: DocumentoMov; label: string }> = [
  { id: 'oc', label: 'OC' },
  { id: 'venta', label: 'Venta' },
  { id: 'gasto', label: 'Gasto' },
  { id: 'envio', label: 'Envío' },
  { id: 'lote', label: 'Lote masivo' },
];

const Divider: React.FC = () => (
  <div className="h-5 w-px bg-slate-200 flex-shrink-0" />
);

export const FiltrosMovimientosBar: React.FC<FiltrosMovimientosBarProps> = ({
  rangoFechas,
  categoriasActivas,
  canalesActivos,
  documentosActivos,
  searchTerm,
  hayFiltrosActivos,
  onCambiarRango,
  onToggleCategoria,
  onToggleCanal,
  onToggleDocumento,
  onCambiarSearchTerm,
  onLimpiarTodo,
}) => {
  const [rangoOpen, setRangoOpen] = React.useState(false);
  const rangoRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rangoRef.current && !rangoRef.current.contains(e.target as Node)) {
        setRangoOpen(false);
      }
    };
    if (rangoOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [rangoOpen]);

  const rangoLabel = RANGOS.find((r) => r.id === rangoFechas)?.label ?? 'Todo';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Date range */}
        <div ref={rangoRef} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setRangoOpen(!rangoOpen)}
            className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-slate-100 transition-all"
          >
            <Calendar className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-xs font-medium text-slate-700">{rangoLabel}</span>
            <span className="text-[9px] text-slate-400">▾</span>
          </button>
          {rangoOpen && (
            <div className="absolute z-30 mt-1 left-0 bg-white rounded-lg border border-slate-200 shadow-lg py-1 min-w-[140px]">
              {RANGOS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onCambiarRango(r.id);
                    setRangoOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-teal-50 transition-colors ${
                    r.id === rangoFechas ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-slate-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Divider />

        {/* Categoría chips */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">Categoría:</span>
          {CATEGORIAS.map(({ id, label, Icon, classes }) => {
            const activo = categoriasActivas.has(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onToggleCategoria(id)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition-all ${
                  activo ? classes.activo : classes.inactivo
                }`}
              >
                <Icon className="w-2.5 h-2.5" />
                {label}
              </button>
            );
          })}
        </div>

        <Divider />

        {/* Canal chips */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">Canal:</span>
          {CANALES.map(({ id, label }) => {
            const activo = canalesActivos.has(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onToggleCanal(id)}
                className={`px-2 py-1 rounded-full text-[10px] font-bold transition-all ${
                  activo
                    ? 'bg-sky-100 text-sky-700 ring-2 ring-sky-300'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-sky-50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <Divider />

        {/* Documento chips */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">Doc:</span>
          {DOCUMENTOS.map(({ id, label }) => {
            const activo = documentosActivos.has(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onToggleDocumento(id)}
                className={`px-2 py-1 rounded-full text-[10px] font-bold transition-all ${
                  activo
                    ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-300'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-purple-50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1 min-w-[120px]" />

        {/* Búsqueda */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:border-teal-300 transition-all flex-shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onCambiarSearchTerm(e.target.value)}
            placeholder="Buscar concepto o doc…"
            className="text-xs text-slate-700 outline-none border-0 bg-transparent w-40 placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onCambiarSearchTerm('')}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Limpiar */}
        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={onLimpiarTodo}
            className="text-[10px] font-medium text-teal-600 hover:text-teal-700 transition-colors flex items-center gap-1 flex-shrink-0"
          >
            <X className="w-3 h-3" />
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
};
