import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Wand2, Plus, Trash2, ChevronDown, ChevronUp,
  Package, CheckCircle2, AlertCircle, Layers, RotateCcw, Info,
  Plane, Search,
} from 'lucide-react';
import { Button } from '../../../common/Button';
import { validateStep1, formatProductSubtitle } from './ocBuilderUtils';
import { almacenService } from '../../../../services/almacen.service';
import type { Almacen } from '../../../../types/almacen.types';
import type { OCBuilderState, OCBuilderAction, PoolProducto, OCDraftGroup, GroupColor } from './ocBuilderTypes';

interface Props {
  state: OCBuilderState;
  dispatch: React.Dispatch<OCBuilderAction>;
}

// Color map for group badges
const colorMap: Record<GroupColor, { bg: string; border: string; text: string; light: string }> = {
  blue: { bg: 'bg-blue-500', border: 'border-blue-400', text: 'text-blue-700', light: 'bg-blue-50' },
  emerald: { bg: 'bg-emerald-500', border: 'border-emerald-400', text: 'text-emerald-700', light: 'bg-emerald-50' },
  amber: { bg: 'bg-amber-500', border: 'border-amber-400', text: 'text-amber-700', light: 'bg-amber-50' },
  purple: { bg: 'bg-purple-500', border: 'border-purple-400', text: 'text-purple-700', light: 'bg-purple-50' },
  rose: { bg: 'bg-rose-500', border: 'border-rose-400', text: 'text-rose-700', light: 'bg-rose-50' },
  cyan: { bg: 'bg-cyan-500', border: 'border-cyan-400', text: 'text-cyan-700', light: 'bg-cyan-50' },
  orange: { bg: 'bg-orange-500', border: 'border-orange-400', text: 'text-orange-700', light: 'bg-orange-50' },
  indigo: { bg: 'bg-indigo-500', border: 'border-indigo-400', text: 'text-indigo-700', light: 'bg-indigo-50' },
};

// Split dialog
const SplitDialog: React.FC<{
  producto: PoolProducto;
  groups: OCDraftGroup[];
  onSplit: (splits: Array<{ groupId: string; cantidad: number }>) => void;
  onClose: () => void;
}> = ({ producto, groups, onSplit, onClose }) => {
  const [splits, setSplits] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    groups.forEach(g => {
      const existing = g.productos.find(p => p.productoId === producto.productoId);
      init[g.id] = existing?.cantidad || 0;
    });
    return init;
  });

  const totalAssigned = Object.values(splits).reduce((s, v) => s + v, 0);
  const remaining = producto.cantidadOriginal - totalAssigned;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black/40" style={{ zIndex: 9999 }} onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-gray-900 mb-1">Asignar producto a OC</h3>
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700">
            {producto.marca} - {producto.nombreComercial}
          </p>
          {formatProductSubtitle(producto) && (
            <p className="text-xs text-gray-500 mt-0.5">{formatProductSubtitle(producto)}</p>
          )}
          <p className="text-xs text-gray-500 mt-0.5">{producto.cantidadOriginal} uds disponibles</p>
        </div>

        <div className="space-y-3 mb-4">
          {groups.map(g => {
            const colors = colorMap[g.color];
            return (
              <div key={g.id} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${colors.bg} flex-shrink-0`} />
                <span className="text-sm font-medium text-gray-700 flex-1 min-w-0 truncate">{g.nombre}</span>
                <input
                  type="number"
                  min={0}
                  max={producto.cantidadOriginal}
                  value={splits[g.id] || 0}
                  onChange={e => setSplits(prev => ({ ...prev, [g.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-20 px-3 py-1.5 border rounded-lg text-sm text-center focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            );
          })}
        </div>

        <div className={`text-sm mb-4 px-3 py-2 rounded-lg ${remaining === 0 ? 'bg-green-50 text-green-700' : remaining > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
          {remaining === 0 ? 'Todas las unidades asignadas' :
           remaining > 0 ? `${remaining} unidades quedarán pendientes de compra` :
           `${Math.abs(remaining)} unidades de más`}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            size="sm"
            disabled={remaining < 0 || totalAssigned === 0}
            onClick={() => {
              const result = Object.entries(splits)
                .filter(([, qty]) => qty > 0)
                .map(([groupId, cantidad]) => ({ groupId, cantidad }));
              onSplit(result);
            }}
          >
            Aplicar
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const OCBuilderStep1: React.FC<Props> = ({ state, dispatch }) => {
  const [splitProduct, setSplitProduct] = useState<PoolProducto | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showViajerosPicker, setShowViajerosPicker] = useState(false);
  const [viajeros, setViajeros] = useState<Almacen[]>([]);
  const [viajeroSearch, setViajeroSearch] = useState('');
  const [loadingViajeros, setLoadingViajeros] = useState(false);
  const validation = useMemo(() => validateStep1(state), [state]);

  // Load viajeros on first open of picker
  useEffect(() => {
    if (!showViajerosPicker || viajeros.length > 0) return;
    const load = async () => {
      setLoadingViajeros(true);
      try {
        const data = await almacenService.getViajeros();
        setViajeros(data);
      } catch (e) {
        console.error('Error loading viajeros:', e);
      }
      setLoadingViajeros(false);
    };
    load();
  }, [showViajerosPicker, viajeros.length]);

  const filteredViajeros = useMemo(() => {
    if (!viajeroSearch.trim()) return viajeros;
    const term = viajeroSearch.toLowerCase();
    return viajeros.filter(v =>
      v.nombre.toLowerCase().includes(term) ||
      v.codigo?.toLowerCase().includes(term) ||
      v.ciudad?.toLowerCase().includes(term)
    );
  }, [viajeros, viajeroSearch]);

  // Check which viajeros already have a group
  const usedViajeroIds = useMemo(() =>
    new Set(state.groups.map(g => g.almacenDestino?.almacenId).filter(Boolean)),
    [state.groups]
  );

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  };

  const handleAddViajeroGroup = (viajero: Almacen) => {
    dispatch({
      type: 'ADD_GROUP',
      payload: {
        nombre: viajero.nombre,
        almacenDestino: {
          almacenId: viajero.id!,
          nombre: viajero.nombre,
          ciudad: viajero.ciudad || '',
          estado: viajero.estado,
          pais: viajero.pais || 'USA',
        },
      },
    });
    setShowViajerosPicker(false);
    setViajeroSearch('');
  };

  const handleAutoGroup = () => {
    dispatch({ type: 'AUTO_GROUP_BY_PROVEEDOR' });
    setExpandedGroups(new Set());
  };

  const handleSplit = (splits: Array<{ groupId: string; cantidad: number }>) => {
    if (!splitProduct) return;
    // First remove from all groups
    for (const g of state.groups) {
      if (g.productos.find(p => p.productoId === splitProduct.productoId)) {
        dispatch({ type: 'UNASSIGN_PRODUCT', payload: { productoId: splitProduct.productoId, groupId: g.id } });
      }
    }
    // Then assign to each group
    for (const { groupId, cantidad } of splits) {
      if (cantidad > 0) {
        dispatch({ type: 'ASSIGN_PRODUCT', payload: { productoId: splitProduct.productoId, groupId, cantidad } });
      }
    }
    setSplitProduct(null);
  };

  // Count unassigned
  const totalUnassigned = state.pool.reduce((sum, p) => sum + Math.max(0, p.cantidadOriginal - p.cantidadAsignada), 0);
  const allAssigned = totalUnassigned === 0;

  // Count products already in OC (excluded from pool)
  const alreadyInOCCount = useMemo(() => {
    let count = 0;
    for (const req of state.requerimientos) {
      if (!req.productos) continue;
      for (const p of req.productos) {
        const cantidadEnOC = p.cantidadEnOC || 0;
        if (cantidadEnOC >= p.cantidadSolicitada) count++;
      }
    }
    return count;
  }, [state.requerimientos]);

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 p-4 sm:p-6">
      {/* LEFT PANEL: Product Pool */}
      <div className="lg:w-[58%] flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Productos del Requerimiento</h3>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{state.pool.length}</span>
          </div>
          {alreadyInOCCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5" /> {alreadyInOCCount} ya en OC
            </span>
          )}
          {allAssigned && state.pool.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5" /> Todo asignado
            </span>
          )}
        </div>

        <div className="flex-1 overflow-auto space-y-1.5 pr-1">
          {state.pool.map(p => {
            const remaining = p.cantidadOriginal - p.cantidadAsignada;
            const fullyAssigned = remaining <= 0;
            const partiallyAssigned = p.cantidadAsignada > 0 && remaining > 0;

            return (
              <div
                key={p.productoId}
                className={`rounded-lg border p-3 transition-all ${
                  fullyAssigned
                    ? 'bg-gray-50 border-gray-200 opacity-60'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Status indicator */}
                  <div className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    fullyAssigned ? 'bg-green-100 text-green-600' :
                    partiallyAssigned ? 'bg-amber-100 text-amber-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {fullyAssigned ? <CheckCircle2 className="h-3.5 w-3.5" /> : p.cantidadOriginal}
                  </div>

                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono">{p.sku}</span>
                      {p.proveedorSugerido && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                          {p.proveedorSugerido}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {p.marca} - {p.nombreComercial}
                    </p>
                    {formatProductSubtitle(p) && (
                      <p className="text-xs text-gray-400 truncate">{formatProductSubtitle(p)}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{p.cantidadOriginal} uds</span>
                      <span>${p.costoUnitarioUSD.toFixed(2)}/ud</span>
                      <span className="font-medium">${(p.cantidadOriginal * p.costoUnitarioUSD).toFixed(2)}</span>
                    </div>

                    {/* Assignment progress */}
                    {partiallyAssigned && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 text-xs text-amber-600">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-amber-500 rounded-full h-1.5 transition-all"
                              style={{ width: `${(p.cantidadAsignada / p.cantidadOriginal) * 100}%` }}
                            />
                          </div>
                          <span>{p.cantidadAsignada}/{p.cantidadOriginal}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!fullyAssigned && state.groups.length > 0 && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {state.groups.length === 1 ? (
                        <button
                          onClick={() => setSplitProduct(p)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title={`Asignar a ${state.groups[0].nombre}`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setSplitProduct(p)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Asignar a grupos"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL: Groups */}
      <div className="lg:w-[42%] flex flex-col min-h-0">
        {/* Action bar */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <h3 className="font-semibold text-gray-900 mr-auto flex items-center gap-2">
            <Layers className="h-5 w-5 text-gray-500" />
            Grupos de OC
            {state.groups.length > 0 && (
              <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">{state.groups.length}</span>
            )}
          </h3>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowViajerosPicker(true)}
            className="text-xs"
          >
            <Plane className="h-3.5 w-3.5 mr-1" />
            Agregar viajero
          </Button>
          {state.groups.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatch({ type: 'RESET_GROUPS' })}
              className="text-xs text-gray-500"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
          )}
        </div>

        {/* Groups list */}
        <div className="flex-1 overflow-auto space-y-3 pr-1">
          {state.groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Layers className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">Sin grupos</p>
              <p className="text-xs mt-1">Usa "Auto-agrupar" o crea un grupo manualmente</p>
            </div>
          ) : (
            state.groups.map(group => {
              const colors = colorMap[group.color];
              const isExpanded = !expandedGroups.has(group.id); // default expanded
              const subtotal = group.productos.reduce((s, p) => s + p.cantidad * p.costoUnitarioUSD, 0);
              const totalUnits = group.productos.reduce((s, p) => s + p.cantidad, 0);

              return (
                <div
                  key={group.id}
                  className={`rounded-lg border-l-4 ${colors.border} bg-white border border-gray-200 shadow-sm`}
                >
                  {/* Group header */}
                  <div
                    className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer ${colors.light} rounded-t-lg`}
                    onClick={() => toggleGroupExpand(group.id)}
                  >
                    {group.almacenDestino ? (
                      <Plane className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                    ) : (
                      <div className={`w-3 h-3 rounded-full ${colors.bg} flex-shrink-0`} />
                    )}
                    <input
                      type="text"
                      value={group.nombre}
                      onChange={e => dispatch({ type: 'RENAME_GROUP', payload: { groupId: group.id, nombre: e.target.value } })}
                      onClick={e => e.stopPropagation()}
                      className={`text-sm font-semibold bg-transparent border-none focus:outline-none focus:ring-0 ${colors.text} flex-1 min-w-0`}
                    />
                    <span className="text-xs text-gray-500">{group.productos.length} prod</span>
                    <span className="text-xs font-medium text-gray-700">${subtotal.toFixed(2)}</span>
                    <button
                      onClick={e => { e.stopPropagation(); dispatch({ type: 'REMOVE_GROUP', payload: { groupId: group.id } }); }}
                      className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>

                  {/* Group products */}
                  {isExpanded && (
                    <div className="px-3 py-2 space-y-1">
                      {group.productos.length === 0 ? (
                        <p className="text-xs text-gray-400 py-3 text-center">Agrega productos desde el panel izquierdo</p>
                      ) : (
                        <>
                          {group.productos.map(p => {
                            const subtitle = formatProductSubtitle(p);
                            return (
                              <div key={p.productoId} className="flex items-center gap-2 py-1.5 text-sm border-b border-gray-50 last:border-0">
                                <div className="flex-1 min-w-0">
                                  <p className="text-gray-800 truncate text-xs">{p.marca} - {p.nombreComercial}</p>
                                  {subtitle && <p className="text-[10px] text-gray-400 truncate">{subtitle}</p>}
                                </div>
                                <span className="text-xs text-gray-500 flex-shrink-0">{p.cantidad} ud</span>
                                <span className="text-xs font-medium text-gray-700 flex-shrink-0 w-16 text-right">
                                  ${(p.cantidad * p.costoUnitarioUSD).toFixed(2)}
                                </span>
                                <button
                                  onClick={() => dispatch({ type: 'UNASSIGN_PRODUCT', payload: { productoId: p.productoId, groupId: group.id } })}
                                  className="p-0.5 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                          <div className="flex justify-between items-center pt-1 text-xs text-gray-500">
                            <span>{totalUnits} unidades</span>
                            <button
                              onClick={() => dispatch({ type: 'ASSIGN_ALL_TO_GROUP', payload: { groupId: group.id } })}
                              className="text-primary-600 hover:text-primary-700 font-medium"
                              disabled={allAssigned}
                            >
                              + Agregar restantes
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Validation errors */}
        {!validation.valid && state.groups.length > 0 && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-red-700 space-y-0.5">
                {validation.errors.map((err, i) => <p key={i}>{err}</p>)}
              </div>
            </div>
          </div>
        )}
        {/* Partial assignment info (warnings) */}
        {validation.warnings.length > 0 && state.groups.length > 0 && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700 space-y-0.5">
                {validation.warnings.map((w, i) => <p key={i}>{w}</p>)}
                <p className="text-blue-500 mt-1">Los productos no incluidos quedarán como pendientes de compra.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Split dialog */}
      {splitProduct && state.groups.length >= 1 && (
        <SplitDialog
          producto={splitProduct}
          groups={state.groups}
          onSplit={handleSplit}
          onClose={() => setSplitProduct(null)}
        />
      )}

      {/* Viajero Picker */}
      {showViajerosPicker && createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40" style={{ zIndex: 9999 }} onClick={() => { setShowViajerosPicker(false); setViajeroSearch(''); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Plane className="h-5 w-5 text-purple-500" />
                Seleccionar Viajero
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={viajeroSearch}
                  onChange={e => setViajeroSearch(e.target.value)}
                  placeholder="Buscar viajero..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto p-2">
              {loadingViajeros ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full mr-2" />
                  Cargando viajeros...
                </div>
              ) : filteredViajeros.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {viajeroSearch ? 'Sin resultados' : 'No hay viajeros activos'}
                </div>
              ) : (
                filteredViajeros.map(v => {
                  const alreadyUsed = usedViajeroIds.has(v.id!);
                  return (
                    <button
                      key={v.id}
                      onClick={() => !alreadyUsed && handleAddViajeroGroup(v)}
                      disabled={alreadyUsed}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        alreadyUsed
                          ? 'opacity-50 cursor-not-allowed bg-gray-50'
                          : 'hover:bg-purple-50 cursor-pointer'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Plane className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{v.nombre}</p>
                        <p className="text-xs text-gray-500">{v.ciudad}{v.estado ? `, ${v.estado}` : ''} · {v.pais}</p>
                      </div>
                      {alreadyUsed ? (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Ya agregado</span>
                      ) : (
                        <Plus className="h-4 w-4 text-purple-400" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowViajerosPicker(false); setViajeroSearch(''); }}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
