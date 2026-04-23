/**
 * SeccionUnidades — Sección [3] del Paso 1 del Wizard Unificado.
 *
 * S53.1 FIX — Asignación manual de unidades físicas (no FIFO).
 *
 * En casillas internacionales, el viajero/courier toma manualmente las
 * unidades que físicamente lleva. El sistema debe reflejar eso:
 *
 *   Flujo estándar (rápido):
 *     - Usuario clickea `+` → se asigna el siguiente unidadId disponible
 *     - Usuario clickea `-` → se quita el último unidadId asignado
 *
 *   Flujo detallado (expansión manual):
 *     - Usuario clickea el chevron para expandir la fila
 *     - Ve cada unidad individual con su lote/vencimiento/OC
 *     - Marca/desmarca checkboxes para elegir específicamente cuáles lleva
 *     - Util cuando quiere priorizar por vencimiento próximo o lote específico
 *
 * Cada unidadId es único y tiene su propia metadata en BD (lote, costo, peso,
 * etc.). El servicio legacy (crearEnvioT2/J/E/I) recibe el array de IDs reales
 * tal cual y cada uno se referencia a su registro físico.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useUnidadStore } from '../../../../../store/unidadStore';
import { useProductoStore } from '../../../../../store/productoStore';
import type { Unidad } from '../../../../../types/unidad.types';
import type { UseEnvioWizardStateReturn } from '../../useEnvioWizardState';

interface Props {
  wizard: UseEnvioWizardStateReturn;
  disabled: boolean;
}

// Agrupación de unidades por productoId (mostrar UNA fila por SKU en la UI)
interface GrupoProducto {
  productoId: string;
  productoSKU: string;
  productoNombre: string;
  pesoLibras?: number;
  cantidadPrevendida: number;
  unidadesDisponibles: Unidad[]; // las unidades FÍSICAS que pertenecen a este grupo
}

// Formato de fecha para UI (sin time)
function fechaVencLabel(unidad: Unidad): string {
  const ts = unidad.fechaVencimiento;
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts as any);
    return d.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export const SeccionUnidades: React.FC<Props> = ({ wizard, disabled }) => {
  const { state, dispatch } = wizard;
  const { unidades, fetchUnidades } = useUnidadStore();
  const { productos, fetchProductos } = useProductoStore();
  const [busqueda, setBusqueda] = useState('');
  // Estados locales: qué grupos están expandidos (para ver IDs individuales)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!disabled) {
      if (unidades.length === 0) fetchUnidades();
      if (productos.length === 0) fetchProductos();
    }
  }, [disabled, unidades.length, productos.length, fetchUnidades, fetchProductos]);

  // Agrupar unidades disponibles de la ubicación origen por productoId
  const grupos = useMemo<GrupoProducto[]>(() => {
    if (!state.ubicacionOrigenId) return [];
    const unidadesEnOrigen = unidades.filter(
      u =>
        (u.casillaActualId === state.ubicacionOrigenId ||
          u.almacenId === state.ubicacionOrigenId) &&
        u.estado === 'disponible'
    );
    const grupoMap = new Map<string, GrupoProducto>();
    for (const u of unidadesEnOrigen) {
      const existente = grupoMap.get(u.productoId);
      if (existente) {
        existente.unidadesDisponibles.push(u);
        if (u.reservadaPara) existente.cantidadPrevendida += 1;
      } else {
        const producto = productos.find(p => p.id === u.productoId);
        grupoMap.set(u.productoId, {
          productoId: u.productoId,
          productoSKU: u.productoSKU,
          productoNombre: u.productoNombre,
          pesoLibras: producto?.pesoLibras,
          cantidadPrevendida: u.reservadaPara ? 1 : 0,
          unidadesDisponibles: [u],
        });
      }
    }
    // Filtro por búsqueda
    let lista = Array.from(grupoMap.values());
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(
        g =>
          g.productoNombre.toLowerCase().includes(q) ||
          g.productoSKU.toLowerCase().includes(q)
      );
    }
    return lista.sort((a, b) => a.productoNombre.localeCompare(b.productoNombre));
  }, [unidades, productos, state.ubicacionOrigenId, busqueda]);

  // Helpers de selección
  const getSeleccionGrupo = (productoId: string) => {
    return state.unidadesSeleccionadas.find(s => s.productoId === productoId);
  };

  const getCantidadSeleccionada = (productoId: string): number => {
    return getSeleccionGrupo(productoId)?.cantidadSeleccionada || 0;
  };

  const isUnidadAsignada = (productoId: string, unidadId: string): boolean => {
    const grupo = getSeleccionGrupo(productoId);
    return grupo?.unidadIdsAsignados.includes(unidadId) ?? false;
  };

  // Al sumar: agregar el siguiente unidadId del pool que NO esté ya asignado.
  const handleSumar = (g: GrupoProducto) => {
    const asignados = getSeleccionGrupo(g.productoId)?.unidadIdsAsignados || [];
    const siguiente = g.unidadesDisponibles.find(u => !asignados.includes(u.id));
    if (!siguiente) return; // no hay más
    dispatch({
      type: 'AGREGAR_UNIDAD_ID',
      productoId: g.productoId,
      unidadId: siguiente.id,
      datosGrupoSiEsNuevo:
        asignados.length === 0
          ? {
              sku: g.productoSKU,
              productoNombre: g.productoNombre,
              pesoLibras: g.pesoLibras,
              cantidadDisponible: g.unidadesDisponibles.length,
              cantidadPrevendida: g.cantidadPrevendida,
              unidadIdsDisponibles: g.unidadesDisponibles.map(u => u.id),
            }
          : undefined,
    });
  };

  // Al restar: quitar el ÚLTIMO unidadId asignado.
  const handleRestar = (g: GrupoProducto) => {
    const asignados = getSeleccionGrupo(g.productoId)?.unidadIdsAsignados || [];
    if (asignados.length === 0) return;
    const ultimo = asignados[asignados.length - 1];
    dispatch({ type: 'QUITAR_UNIDAD_ID', productoId: g.productoId, unidadId: ultimo });
  };

  // Toggle de un ID específico (expansión manual con checkboxes)
  const handleToggleUnidad = (productoId: string, unidadId: string, grupo: GrupoProducto) => {
    const yaAsignada = isUnidadAsignada(productoId, unidadId);
    if (yaAsignada) {
      dispatch({ type: 'QUITAR_UNIDAD_ID', productoId, unidadId });
    } else {
      dispatch({
        type: 'AGREGAR_UNIDAD_ID',
        productoId,
        unidadId,
        datosGrupoSiEsNuevo:
          getCantidadSeleccionada(productoId) === 0
            ? {
                sku: grupo.productoSKU,
                productoNombre: grupo.productoNombre,
                pesoLibras: grupo.pesoLibras,
                cantidadDisponible: grupo.unidadesDisponibles.length,
                cantidadPrevendida: grupo.cantidadPrevendida,
                unidadIdsDisponibles: grupo.unidadesDisponibles.map(u => u.id),
              }
            : undefined,
      });
    }
  };

  const toggleExpansion = (productoId: string) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(productoId)) next.delete(productoId);
      else next.add(productoId);
      return next;
    });
  };

  const totalDisponibles = grupos.reduce(
    (sum, g) => sum + g.unidadesDisponibles.length,
    0
  );
  const totalSeleccionadas = state.unidadesSeleccionadas.reduce(
    (sum, u) => sum + u.cantidadSeleccionada,
    0
  );
  const totalPrevendidasDisponibles = grupos.reduce(
    (sum, g) => sum + g.cantidadPrevendida,
    0
  );

  if (disabled) {
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden opacity-60">
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
            3
          </span>
          <h4 className="text-sm font-semibold text-slate-900">
            ¿Qué unidades envías?
          </h4>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-400 italic text-center py-2">
            Completá Origen y Destino para elegir las unidades.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
            3
          </span>
          <h4 className="text-sm font-semibold text-slate-900">
            ¿Qué unidades envías?
          </h4>
        </div>
        <div className="text-[11px] font-medium text-slate-500">
          {totalSeleccionadas} / {totalDisponibles} seleccionadas
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-600">
          Elegí cuántas unidades llevar con los botones{' '}
          <code className="text-[10px] bg-slate-100 px-1 rounded">+/-</code>, o
          expandí una fila para elegir unidades específicas por lote o
          vencimiento.
        </p>

        {/* Buscador */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto por nombre, SKU, marca..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none"
          />
        </div>

        {/* Banner pre-vendidas */}
        {totalPrevendidasDisponibles > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-3">
            <span className="text-xl flex-shrink-0">🎯</span>
            <div className="flex-1 text-xs">
              <div className="font-semibold text-emerald-900 mb-0.5">
                {totalPrevendidasDisponibles} unidades pre-vendidas disponibles
              </div>
              <p className="text-emerald-800">
                Hay clientes esperando estas unidades. Priorizalas al elegir.
              </p>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-emerald-800 whitespace-nowrap">
              <input
                type="checkbox"
                checked={state.incluirPrevendidas}
                onChange={e =>
                  dispatch({
                    type: 'SET_INCLUIR_PREVENDIDAS',
                    incluir: e.target.checked,
                  })
                }
                className="rounded"
              />{' '}
              Priorizar
            </label>
          </div>
        )}

        {/* Lista de productos con stepper + expansión manual */}
        {grupos.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-6 text-center">
            <div className="text-2xl mb-1">📦</div>
            <p className="text-xs text-slate-600">
              {busqueda
                ? 'Sin resultados para esa búsqueda.'
                : 'No hay unidades disponibles en esta ubicación.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {grupos.map(g => {
              const cantSelected = getCantidadSeleccionada(g.productoId);
              const expanded = expandidos.has(g.productoId);
              const disponibles = g.unidadesDisponibles.length;
              return (
                <div
                  key={g.productoId}
                  className="border border-slate-200 rounded-lg bg-white overflow-hidden"
                >
                  {/* Fila principal */}
                  <div className="p-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleExpansion(g.productoId)}
                      className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-900"
                      title={expanded ? 'Ocultar detalles' : 'Ver y elegir unidades específicas'}
                    >
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${
                          expanded ? 'rotate-90' : ''
                        }`}
                      />
                    </button>
                    <span className="text-2xl flex-shrink-0">📦</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">
                          {g.productoNombre}
                        </span>
                        {g.cantidadPrevendida > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
                            🎯 {g.cantidadPrevendida} pre-vendida
                            {g.cantidadPrevendida > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        SKU: {g.productoSKU}
                        {g.pesoLibras !== undefined && ` · ${g.pesoLibras} lb/ud`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestar(g)}
                        disabled={cantSelected <= 0}
                        className="w-7 h-7 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums">
                        {cantSelected}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSumar(g)}
                        disabled={cantSelected >= disponibles}
                        className="w-7 h-7 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                      <span className="text-[11px] text-slate-400">
                        / {disponibles}
                      </span>
                    </div>
                  </div>

                  {/* Expansión: lista de unidades individuales con checkboxes */}
                  {expanded && (
                    <div className="border-t border-slate-200 bg-slate-50/50 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                        Unidades específicas · elegí cuáles llevás físicamente
                      </div>
                      <div className="space-y-1">
                        {g.unidadesDisponibles.map(u => {
                          const asignada = isUnidadAsignada(g.productoId, u.id);
                          return (
                            <label
                              key={u.id}
                              className={`flex items-center gap-2 p-2 rounded border transition cursor-pointer ${
                                asignada
                                  ? 'border-teal-500 bg-teal-50'
                                  : 'border-slate-200 bg-white hover:border-teal-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={asignada}
                                onChange={() => handleToggleUnidad(g.productoId, u.id, g)}
                                className="rounded"
                              />
                              <div className="flex-1 min-w-0 grid grid-cols-4 gap-2 text-[11px]">
                                <div>
                                  <span className="text-slate-500">Código:</span>{' '}
                                  <span className="font-mono text-slate-900">
                                    {u.id.slice(0, 10)}...
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Lote:</span>{' '}
                                  <span className="text-slate-900">{u.lote}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Vence:</span>{' '}
                                  <span className="text-slate-900">
                                    {fechaVencLabel(u)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">OC:</span>{' '}
                                  <span className="text-slate-900">
                                    {u.ordenCompraNumero || '—'}
                                  </span>
                                </div>
                              </div>
                              {u.reservadaPara && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded whitespace-nowrap"
                                  title="Pre-vendida"
                                >
                                  🎯 pre-v
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
