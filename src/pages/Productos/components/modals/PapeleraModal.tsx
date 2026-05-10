/**
 * PapeleraModal · Modal centrado · F6(A)
 *
 * Mockup canónico: docs/mockups/productos/23-modal-archivo-papelera.html
 *
 * Listado de productos archivados con acciones Restaurar / Eliminar definitivo.
 * Política: 90 días de retención antes de eliminación automática.
 *
 * Trigger: click "Archivo" en header del listado V2
 * Cierre: X · ESC · click backdrop · botón "Cerrar" · "Vaciar papelera"
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Search as SearchIcon,
  Archive,
  RotateCcw,
  Trash2,
  Droplets,
  Pill,
  Gift,
  AlertTriangle,
} from 'lucide-react';
import type { Producto } from '../../../../types/producto.types';
import { inferLineaFromProducto } from '../shared/ProductoAvatar';
import { toMillisSafe } from '../../../../utils/dateFormatters';

interface PapeleraModalProps {
  open: boolean;
  archivados: Producto[];
  onClose: () => void;
  onRestaurar?: (producto: Producto) => void;
  onEliminarDefinitivo?: (producto: Producto) => void;
  onVaciarPapelera?: () => void;
}

type OrdenPapelera = 'recientes' | 'antiguos' | 'marca';

// ───────────────────────────────────────────────────────────
// Util: días restantes hasta eliminación automática (90 días)
// ───────────────────────────────────────────────────────────
function diasRestantes(fechaEliminacion: any): number | null {
  if (!fechaEliminacion) return null;
  const fecha =
    typeof fechaEliminacion?.toDate === 'function'
      ? fechaEliminacion.toDate()
      : new Date(fechaEliminacion);
  const limite = new Date(fecha);
  limite.setDate(limite.getDate() + 90);
  const ahora = new Date();
  const ms = limite.getTime() - ahora.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function formatFecha(fechaEliminacion: any): string {
  if (!fechaEliminacion) return '—';
  const fecha =
    typeof fechaEliminacion?.toDate === 'function'
      ? fechaEliminacion.toDate()
      : new Date(fechaEliminacion);
  return fecha.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Avatar simple para fila de papelera (grayscale)
function AvatarPapelera({ producto }: { producto: Producto }) {
  const linea = inferLineaFromProducto(producto);
  const Icon = linea === 'pack' ? Gift : linea === 'suplemento' ? Pill : Droplets;
  const componentesCount = (producto as any).componentesPack?.length ?? 0;
  return (
    <div className="w-9 h-9 rounded-lg bg-slate-100 grayscale flex items-center justify-center flex-shrink-0 relative">
      <Icon className="w-4 h-4 text-slate-500" />
      {linea === 'pack' && componentesCount > 0 && (
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-slate-400 text-white text-[7px] font-bold rounded-full flex items-center justify-center ring-1 ring-white">
          {componentesCount}
        </span>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Componente principal
// ───────────────────────────────────────────────────────────
export function PapeleraModal({
  open,
  archivados,
  onClose,
  onRestaurar,
  onEliminarDefinitivo,
  onVaciarPapelera,
}: PapeleraModalProps) {
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<OrdenPapelera>('recientes');
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [confirmandoVaciar, setConfirmandoVaciar] = useState(false);

  // ESC para cerrar
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Reset seleccionados al cerrar
  useEffect(() => {
    if (!open) {
      setSeleccionados(new Set());
      setConfirmandoVaciar(false);
      setBusqueda('');
    }
  }, [open]);

  // Filtrado + orden
  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let filtrados = archivados;
    if (q) {
      filtrados = archivados.filter(
        (p) =>
          p.nombreComercial.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.marca?.toLowerCase().includes(q),
      );
    }
    return [...filtrados].sort((a, b) => {
      if (orden === 'marca') return (a.marca ?? '').localeCompare(b.marca ?? '');
      const fa = toMillisSafe(a.fechaEliminacion);
      const fb = toMillisSafe(b.fechaEliminacion);
      return orden === 'recientes' ? fb - fa : fa - fb;
    });
  }, [archivados, busqueda, orden]);

  if (!open) return null;

  const toggleSel = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleVaciar = () => {
    if (!confirmandoVaciar) {
      setConfirmandoVaciar(true);
      return;
    }
    onVaciarPapelera?.();
    setConfirmandoVaciar(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 relative">
                <Archive className="w-5 h-5 text-slate-600" />
                {archivados.length > 0 && (
                  <span className="absolute -top-1 -right-1 px-1 py-0.5 bg-amber-500 text-white text-[8px] font-bold rounded-full leading-none min-w-[14px] text-center">
                    {archivados.length}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Papelera de productos</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {archivados.length} producto{archivados.length === 1 ? '' : 's'} archivado
                  {archivados.length === 1 ? '' : 's'} · se eliminarán automáticamente después de 90
                  días
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BÚSQUEDA + ORDEN */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en papelera..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as OrdenPapelera)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="recientes">Más recientes</option>
            <option value="antiguos">Más antiguos</option>
            <option value="marca">Por marca</option>
          </select>
        </div>

        {/* LISTA */}
        <div className="flex-1 overflow-y-auto">
          {lista.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Archive className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                {busqueda ? 'No hay resultados para esa búsqueda.' : 'La papelera está vacía.'}
              </p>
            </div>
          ) : (
            <>
              {/* Header tabla (oculto en mobile) */}
              <div className="hidden lg:grid grid-cols-12 gap-3 px-4 py-2 bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 w-3.5 h-3.5"
                    checked={seleccionados.size === lista.length && lista.length > 0}
                    onChange={() => {
                      if (seleccionados.size === lista.length) {
                        setSeleccionados(new Set());
                      } else {
                        setSeleccionados(new Set(lista.map((p) => p.id)));
                      }
                    }}
                  />
                </div>
                <div className="col-span-5">Producto</div>
                <div className="col-span-2">Variantes · Stock</div>
                <div className="col-span-2">Archivado</div>
                <div className="col-span-2 text-right">Acciones</div>
              </div>

              <div className="divide-y divide-slate-100">
                {lista.map((producto) => {
                  const dias = diasRestantes(producto.fechaEliminacion);
                  const urgente = dias !== null && dias <= 7;
                  const variantesCount = (producto as any).variantesCount ?? 0;
                  const stockTotal =
                    (producto.stockDisponible ?? 0) + (producto.stockReservado ?? 0);

                  return (
                    <div
                      key={producto.id}
                      className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-3 lg:items-center px-4 py-3 opacity-70 hover:opacity-100 hover:bg-slate-50 transition-opacity"
                    >
                      {/* Checkbox + identidad */}
                      <div className="lg:col-span-1 hidden lg:block">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-teal-600 w-3.5 h-3.5"
                          checked={seleccionados.has(producto.id)}
                          onChange={() => toggleSel(producto.id)}
                        />
                      </div>
                      <div className="lg:col-span-5 flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="lg:hidden rounded border-slate-300 text-teal-600 w-3.5 h-3.5"
                          checked={seleccionados.has(producto.id)}
                          onChange={() => toggleSel(producto.id)}
                        />
                        <AvatarPapelera producto={producto} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-700 line-through truncate">
                            {producto.nombreComercial}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                            <span className="font-mono">{producto.sku}</span>
                            {producto.marca && <> · {producto.marca}</>}
                          </div>
                        </div>
                      </div>

                      {/* Variantes · Stock */}
                      <div className="lg:col-span-2 text-[11px] lg:text-[10px] text-slate-400 tabular-nums">
                        <span className="lg:hidden text-slate-500 font-semibold">Stock: </span>
                        {variantesCount > 0 ? `${variantesCount} var · ` : ''}
                        {stockTotal} uds
                      </div>

                      {/* Fecha + autor */}
                      <div className="lg:col-span-2">
                        <div
                          className={`text-[11px] lg:text-[10px] tabular-nums ${
                            urgente ? 'text-rose-500 font-bold' : 'text-slate-500'
                          }`}
                        >
                          {formatFecha(producto.fechaEliminacion)}
                        </div>
                        {dias !== null && dias <= 7 ? (
                          <div className="text-[10px] text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            se elimina en {dias} día{dias === 1 ? '' : 's'}
                          </div>
                        ) : producto.eliminadoPor ? (
                          <div className="text-[10px] text-slate-400 italic truncate">
                            por: {producto.eliminadoPor}
                          </div>
                        ) : null}
                      </div>

                      {/* Acciones */}
                      <div className="lg:col-span-2 flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onRestaurar?.(producto)}
                          className="px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded flex items-center gap-1 transition-colors"
                          title="Restaurar producto"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Restaurar
                        </button>
                        <button
                          onClick={() => onEliminarDefinitivo?.(producto)}
                          className={`p-1 rounded transition-colors ${
                            urgente
                              ? 'text-rose-500 hover:bg-rose-50'
                              : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          }`}
                          title="Eliminar definitivo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 lg:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="text-[10px] text-slate-500 sm:max-w-md">
            Los productos archivados se conservan 90 días antes de eliminación automática.
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cerrar
            </button>
            {archivados.length > 0 && (
              <button
                onClick={handleVaciar}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors border ${
                  confirmandoVaciar
                    ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700'
                    : 'text-rose-600 hover:bg-rose-50 border-rose-200'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {confirmandoVaciar ? 'Confirmar · vaciar' : 'Vaciar papelera'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
