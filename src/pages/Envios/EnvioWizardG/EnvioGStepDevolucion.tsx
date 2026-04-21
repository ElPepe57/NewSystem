/**
 * EnvioGStepDevolucion — Paso 1 del Wizard G (Seleccionar devolución + unidades).
 *
 * Muestra devoluciones en estados aprobada/ejecutada (las que ya tienen
 * unidades identificadas). Al elegir una, se pre-seleccionan todas sus
 * unidades — el usuario puede ajustar si recibe parcial.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { User, Package, Calendar } from 'lucide-react';
import { useDevolucionStore } from '../../../store/devolucionStore';
import type { Devolucion, EstadoDevolucion } from '../../../types/devolucion.types';
import { cn } from '../../../design-system';
import type { EnvioWizardGState, EnvioWizardGAction } from './envioWizardGTypes';

export interface EnvioGStepDevolucionProps {
  state: EnvioWizardGState;
  dispatch: (action: EnvioWizardGAction) => void;
}

// Devoluciones con retorno físico relevante: aprobadas (pendiente recepción)
// o ejecutadas (ya recibidas, pueden requerir registrar el movimiento a posteriori).
const ESTADOS_RELEVANTES: EstadoDevolucion[] = ['aprobada', 'ejecutada'];

const formatFecha = (ts: { toDate?: () => Date } | undefined | null): string => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : (ts as unknown as Date);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch {
    return '—';
  }
};

export const EnvioGStepDevolucion: React.FC<EnvioGStepDevolucionProps> = ({
  state,
  dispatch,
}) => {
  const devoluciones = useDevolucionStore((s) => s.devoluciones);
  const fetchDevoluciones = useDevolucionStore((s) => s.fetchDevoluciones);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (devoluciones.length === 0) fetchDevoluciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const relevantes = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return devoluciones
      .filter((d) => ESTADOS_RELEVANTES.includes(d.estado))
      .filter((d) => {
        if (!q) return true;
        return (
          d.numeroDevolucion.toLowerCase().includes(q) ||
          d.ventaNumero.toLowerCase().includes(q) ||
          d.clienteNombre.toLowerCase().includes(q)
        );
      });
  }, [devoluciones, busqueda]);

  const seleccionada: Devolucion | undefined = useMemo(
    () => devoluciones.find((d) => d.id === state.devolucionId),
    [devoluciones, state.devolucionId]
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Selecciona la devolución a registrar
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Caso G registra el <strong>retorno físico</strong> de una devolución existente.
          El motivo y las unidades se leen del documento Devolución — aquí capturas solo
          el aspecto logístico (almacén destino, transporte, costos del retorno).
        </p>
      </div>

      {/* Selección activa */}
      {seleccionada ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-900 font-mono">
                {seleccionada.numeroDevolucion}
              </span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                {seleccionada.estado}
              </span>
              <span className="text-xs text-slate-500">
                · S/ {seleccionada.montoDevolucion.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-700 mt-1">
              <User className="w-3 h-3" />
              <span className="font-medium">{seleccionada.clienteNombre}</span>
              <span className="text-slate-300">·</span>
              <span className="font-mono text-slate-500">{seleccionada.ventaNumero}</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Motivo: <b>{seleccionada.motivo}</b>
              {seleccionada.detalleMotivo && ` · ${seleccionada.detalleMotivo}`}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {seleccionada.productos.length} producto
              {seleccionada.productos.length !== 1 ? 's' : ''} ·{' '}
              {seleccionada.productos.reduce((s, p) => s + p.cantidad, 0)} unidades
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setBusqueda('');
              dispatch({
                type: 'SET_DEVOLUCION',
                devolucion: { ...seleccionada, id: '' } as Devolucion,
              });
            }}
            className="text-[11px] text-amber-700 hover:text-amber-800 font-medium"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por N° devolución, N° venta o cliente..."
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          {relevantes.length === 0 ? (
            <div className="p-5 bg-amber-50 border border-amber-200 rounded-lg text-center text-xs text-amber-900">
              No hay devoluciones en estados{' '}
              <span className="font-mono">{ESTADOS_RELEVANTES.join(' / ')}</span>.
              Crea/aprueba una devolución en el módulo Ventas antes de registrar el
              retorno físico.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-96 overflow-y-auto bg-white">
              {relevantes.slice(0, 50).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_DEVOLUCION', devolucion: d })}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-slate-500 group-hover:text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 font-mono">
                          {d.numeroDevolucion}
                        </span>
                        <span className={cn(
                          'text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded',
                          d.estado === 'aprobada' && 'bg-sky-100 text-sky-800',
                          d.estado === 'ejecutada' && 'bg-emerald-100 text-emerald-800'
                        )}>
                          {d.estado}
                        </span>
                        <span className="text-xs text-slate-500 tabular-nums">
                          S/ {d.montoDevolucion.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 truncate">
                        {d.clienteNombre} <span className="text-slate-400">·</span>{' '}
                        <span className="font-mono">{d.ventaNumero}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>Motivo: <b>{d.motivo}</b></span>
                        <span className="flex items-center gap-0.5">
                          <Calendar className="w-2.5 h-2.5" />
                          {formatFecha(d.fechaCreacion)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {relevantes.length > 50 && (
                <div className="p-2 text-[11px] text-slate-400 text-center italic">
                  Mostrando primeras 50 de {relevantes.length}. Refina la búsqueda.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Listado de unidades de la devolución seleccionada */}
      {seleccionada && (
        <div className="pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Unidades que el cliente devuelve ({state.unidadesIdsSeleccionadas.length}/
              {seleccionada.productos.reduce((s, p) => s + p.cantidad, 0)})
            </span>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SELECCIONAR_TODAS' })}
              className="text-[11px] text-teal-700 hover:text-teal-800 font-medium"
            >
              Re-seleccionar todas
            </button>
          </div>

          {/* Banner D-7 */}
          <div className="mb-3 p-3 bg-sky-50 border border-sky-200 rounded-lg flex items-start gap-3">
            <span className="text-xl">🔍</span>
            <div className="flex-1 text-xs">
              <div className="font-semibold text-sky-900">D-7 · Unidades en revisión</div>
              <div className="text-sky-800 mt-0.5">
                Al recibir, las unidades NO vuelven directamente a stock vendible.
                Quedan marcadas para revisión del operador, quien decide si son
                reintegrables (disponible), merma (danada) o materia de reclamo.
              </div>
            </div>
          </div>

          {/* Lista por producto */}
          <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
            {seleccionada.productos.map((p) => {
              const seleccionadasEnProducto = p.unidadesIds.filter((uid) =>
                state.unidadesIdsSeleccionadas.includes(uid)
              ).length;
              return (
                <div key={p.productoId} className="px-3 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {p.nombreProducto}
                      </div>
                      <div className="text-xs text-slate-500">
                        {p.sku} · {p.cantidad} unidad{p.cantidad !== 1 ? 'es' : ''} en la devolución
                      </div>
                    </div>
                    <span className={cn(
                      "text-xs tabular-nums font-semibold",
                      seleccionadasEnProducto === p.cantidad
                        ? 'text-emerald-700'
                        : seleccionadasEnProducto > 0
                          ? 'text-amber-700'
                          : 'text-slate-400'
                    )}>
                      {seleccionadasEnProducto}/{p.cantidad}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.unidadesIds.map((uid) => {
                      const sel = state.unidadesIdsSeleccionadas.includes(uid);
                      return (
                        <button
                          key={uid}
                          type="button"
                          onClick={() => dispatch({ type: 'TOGGLE_UNIDAD', unidadId: uid })}
                          className={cn(
                            'text-[10px] font-mono px-2 py-1 rounded border transition-colors',
                            sel
                              ? 'bg-teal-600 text-white border-teal-600'
                              : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'
                          )}
                        >
                          {uid.slice(-6).toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
