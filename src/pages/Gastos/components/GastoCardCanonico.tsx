/**
 * GastoCardCanonico · TAREA-GASTOS-PAGE-V2 F3.a
 *
 * Card anchored para listado de gastos · responsive (mobile + desktop unificados).
 * Reemplaza el split DataTable + cards mobile por un patron unico canonico.
 *
 * Style canonico aplicado:
 * - R2 Cards anchored como elemento de informacion primario
 * - R4 Avatar/icono con color por bloque (importacion blue · venta purple · periodo amber)
 * - R6 Tabular-nums obsesivo en montos
 * - Estados con paleta semantica (estado-pagado/pendiente/vencido/parcial)
 * - Acciones rapidas inline (Pagar / Detalle)
 *
 * Mockup referencia: docs/mockups/gastos-page-completa-s58f.html · Vista 2.
 */

import React from 'react';
import type { Gasto, EstadoGasto } from '../../../types/gasto.types';
import type { BloqueCosto, CategoriaCosto } from '../../../types/categoriaCosto.types';

interface GastoCardCanonicoProps {
  gasto: Gasto;
  // Resolucion del breadcrumb (provista por el padre que tiene el arbol)
  breadcrumb: { bloque: BloqueCosto; padre: string; sub?: string } | null;
  // Acciones
  onEditar: (g: Gasto) => void;
  onPagar?: (g: Gasto) => void;
  // Multi-select (opcional para F4 bulk)
  seleccionado?: boolean;
  onToggleSeleccion?: (g: Gasto) => void;
  mostrarCheckbox?: boolean;
}

const formatPEN = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n);

const formatFecha = (timestamp: any): string => {
  const fecha = timestamp?.toDate?.() ?? new Date(timestamp);
  if (isNaN(fecha.getTime())) return '-';
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${fecha.getDate()} ${meses[fecha.getMonth()]}`;
};

// Calcula dias hasta el vencimiento (negativo = vencido)
const diasHastaVencimiento = (timestamp: any): number => {
  const fecha = timestamp?.toDate?.() ?? new Date(timestamp);
  if (isNaN(fecha.getTime())) return 0;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fecha.setHours(0, 0, 0, 0);
  return Math.round((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
};

const getEstadoConfig = (estado: EstadoGasto) => {
  switch (estado) {
    case 'pagado':
      return { emoji: '✓', label: 'PAGADO', classes: 'bg-emerald-100 text-emerald-700 border border-emerald-300' };
    case 'pendiente':
      return { emoji: '⏰', label: 'PENDIENTE', classes: 'bg-amber-100 text-amber-700 border border-amber-300' };
    case 'parcial':
      return { emoji: '◐', label: 'PARCIAL', classes: 'bg-sky-100 text-sky-700 border border-sky-300' };
    case 'cancelado':
      return { emoji: '✕', label: 'CANCELADO', classes: 'bg-rose-100 text-rose-700 border border-rose-300' };
    default:
      return { emoji: '?', label: String(estado).toUpperCase(), classes: 'bg-slate-100 text-slate-700 border border-slate-300' };
  }
};

const getBloqueConfig = (bloque?: BloqueCosto) => {
  switch (bloque) {
    case 'importacion':
      return { emoji: '📦', label: 'Importación', avatarBg: 'bg-blue-100 text-blue-700', pillClasses: 'bg-blue-100 text-blue-700' };
    case 'venta':
      return { emoji: '🛒', label: 'Venta', avatarBg: 'bg-purple-100 text-purple-700', pillClasses: 'bg-purple-100 text-purple-700' };
    case 'periodo':
      return { emoji: '📅', label: 'Período', avatarBg: 'bg-amber-100 text-amber-700', pillClasses: 'bg-amber-100 text-amber-700' };
    default:
      return { emoji: '💰', label: 'Otro', avatarBg: 'bg-slate-100 text-slate-700', pillClasses: 'bg-slate-100 text-slate-700' };
  }
};

export const GastoCardCanonico: React.FC<GastoCardCanonicoProps> = ({
  gasto,
  breadcrumb,
  onEditar,
  onPagar,
  seleccionado = false,
  onToggleSeleccion,
  mostrarCheckbox = false,
}) => {
  const estadoConf = getEstadoConfig(gasto.estado);
  const bloqueConf = getBloqueConfig(breadcrumb?.bloque);
  const dias = gasto.estado !== 'pagado' && gasto.estado !== 'cancelado'
    ? diasHastaVencimiento(gasto.fecha)
    : null;
  const esVencido = dias !== null && dias < 0;
  const esVencePronto = dias !== null && dias >= 0 && dias <= 7;
  const saldoPendiente = (gasto.montoPEN || 0) - (gasto.montoPagado || 0);

  // Color de fondo · destaca vencidos sutilmente
  const bgClass = esVencido
    ? 'bg-rose-50/30 hover:bg-rose-50'
    : 'bg-white hover:bg-slate-50';

  // Avatar del proveedor (iniciales o emoji bloque)
  const proveedorIniciales = (gasto.proveedor || gasto.proveedorNombre || '')
    .split(' ')
    .filter(w => w.length > 0)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || bloqueConf.emoji;

  return (
    <div
      className={`${bgClass} transition-colors cursor-pointer`}
      onClick={(e) => {
        // No editar si el click vino del checkbox o de un boton interno
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.closest('button')) return;
        onEditar(gasto);
      }}
    >
      <div className="px-3 sm:px-4 py-3 flex items-center gap-3">

        {/* Checkbox para multi-select (F4) */}
        {mostrarCheckbox && (
          <input
            type="checkbox"
            checked={seleccionado}
            onChange={() => onToggleSeleccion?.(gasto)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 flex-shrink-0"
          />
        )}

        {/* Avatar del proveedor con color por bloque */}
        <div className={`w-10 h-10 rounded-lg ${bloqueConf.avatarBg} flex items-center justify-center font-bold text-xs flex-shrink-0`}>
          {proveedorIniciales}
        </div>

        {/* Grid responsive 12 cols · descripcion + breadcrumb + fecha + estado + monto */}
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-12 gap-1.5 sm:gap-3 items-center">

          {/* Descripcion + proveedor (3 cols desktop · stacked mobile) */}
          <div className="sm:col-span-3 min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate" title={gasto.descripcion}>
              {gasto.descripcion || gasto.tipo || gasto.numeroGasto}
            </div>
            {(gasto.proveedor || gasto.proveedorNombre) && (
              <div className="text-[11px] text-slate-500 truncate">
                {gasto.proveedor || gasto.proveedorNombre}
              </div>
            )}
            {esVencido && (
              <div className="text-[10px] text-rose-600 font-bold sm:hidden">⚠ vencido hace {Math.abs(dias!)}d</div>
            )}
          </div>

          {/* Breadcrumb 3 niveles (3 cols desktop · oculto mobile) */}
          <div className="hidden sm:flex sm:col-span-3 items-center gap-1.5 min-w-0">
            {breadcrumb ? (
              <>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${bloqueConf.pillClasses}`}>
                  <span>{bloqueConf.emoji}</span>
                  <span className="hidden lg:inline">{bloqueConf.label}</span>
                </span>
                <span className="text-slate-300 text-xs">›</span>
                <span className="text-[10px] text-slate-700 font-medium truncate">{breadcrumb.padre}</span>
                {breadcrumb.sub && (
                  <>
                    <span className="text-slate-300 text-xs">›</span>
                    <span className="text-[10px] text-slate-500 truncate">{breadcrumb.sub}</span>
                  </>
                )}
              </>
            ) : (
              <span className="text-[10px] text-slate-400 italic">Sin categorizar</span>
            )}
          </div>

          {/* Fecha / vencimiento (2 cols desktop · oculto mobile) */}
          <div className="hidden sm:block sm:col-span-2 text-[11px]">
            {gasto.estado === 'pagado' && gasto.fechaPago ? (
              <>
                <div className="text-slate-500">Pagado</div>
                <div className="font-semibold text-emerald-700">{formatFecha(gasto.fechaPago)}</div>
              </>
            ) : esVencido ? (
              <>
                <div className="text-rose-600 font-semibold">⚠ Venció</div>
                <div className="font-bold tabular-nums text-rose-700">hace {Math.abs(dias!)}d</div>
              </>
            ) : esVencePronto ? (
              <>
                <div className="text-amber-600 font-semibold">Vence</div>
                <div className="font-bold tabular-nums text-amber-700">en {dias}d · {formatFecha(gasto.fecha)}</div>
              </>
            ) : (
              <>
                <div className="text-slate-500">Fecha</div>
                <div className="font-semibold text-slate-700 tabular-nums">{formatFecha(gasto.fecha)}</div>
              </>
            )}
          </div>

          {/* Estado pill (2 cols desktop) */}
          <div className="sm:col-span-2 flex items-center gap-1.5">
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${estadoConf.classes}`}>
              {estadoConf.emoji} {estadoConf.label}
            </span>
            {gasto.estado === 'parcial' && gasto.montoPEN > 0 && (
              <span className="text-[10px] text-sky-700 tabular-nums font-bold">
                {Math.round(((gasto.montoPagado || 0) / gasto.montoPEN) * 100)}%
              </span>
            )}
          </div>

          {/* Monto + accion rapida (2 cols desktop) */}
          <div className="sm:col-span-2 flex sm:flex-col items-end justify-between sm:justify-start gap-1">
            <div className="text-right">
              <div className={`text-base font-bold tabular-nums ${esVencido ? 'text-rose-900' : 'text-slate-900'}`}>
                {formatPEN(gasto.montoPEN || 0)}
              </div>
              {gasto.estado === 'parcial' && saldoPendiente > 0 && (
                <div className="text-[10px] text-sky-700 tabular-nums">
                  {formatPEN(saldoPendiente)} pdte
                </div>
              )}
            </div>
            {(gasto.estado === 'pendiente' || gasto.estado === 'parcial') && onPagar ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPagar(gasto);
                }}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm transition-colors ${
                  esVencido
                    ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                    : 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                }`}
              >
                {esVencido ? 'Pagar HOY' : 'Pagar →'}
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditar(gasto);
                }}
                className="text-[10px] text-slate-500 hover:text-slate-900 font-medium"
              >
                Detalle →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
