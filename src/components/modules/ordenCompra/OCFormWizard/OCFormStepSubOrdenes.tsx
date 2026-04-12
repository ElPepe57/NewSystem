import React, { useMemo } from 'react';
import { Plus, Trash2, Package, SplitSquareVertical } from 'lucide-react';
import { Button, Card, Input, Badge } from '../../../common';
import type { OCFormState, OCFormAction, SubOrdenFormItem } from './ocFormTypes';
import { getProductosValidos } from './ocFormTypes';

interface Props {
  state: OCFormState;
  dispatch: React.Dispatch<OCFormAction>;
}

/**
 * Paso opcional de Sub-Ordenes en el wizard de OC.
 * Permite dividir los productos de la OC en sub-ordenes,
 * cada una con su propia referencia de proveedor.
 *
 * Caso de uso: Amazon con multiples pedidos en el mismo "batch de compra".
 */
export const OCFormStepSubOrdenes: React.FC<Props> = ({ state, dispatch }) => {
  const productosValidos = getProductosValidos(state);
  const tieneSubOrdenes = state.subOrdenes.length > 0;

  // Productos no asignados a ninguna sub-orden
  const productosNoAsignados = useMemo(() => {
    if (!tieneSubOrdenes) return [];
    const asignados = new Set<number>();
    for (const sub of state.subOrdenes) {
      for (const idx of sub.productoIndices) asignados.add(idx);
    }
    return productosValidos
      .map((p, i) => ({ ...p, originalIndex: i }))
      .filter((_, i) => !asignados.has(i));
  }, [productosValidos, state.subOrdenes, tieneSubOrdenes]);

  const handleToggleSubOrdenes = () => {
    if (tieneSubOrdenes) {
      // Desactivar: eliminar todas las sub-ordenes
      while (state.subOrdenes.length > 0) {
        dispatch({ type: 'REMOVE_SUBORDEN', payload: state.subOrdenes[0].id });
      }
    } else {
      // Activar: crear primera sub-orden con todos los productos
      dispatch({ type: 'ADD_SUBORDEN' });
      // Asignar todos los productos a la primera sub-orden
      setTimeout(() => {
        const indices = productosValidos.map((_, i) => i);
        const subId = state.subOrdenes[0]?.id;
        if (subId) {
          dispatch({ type: 'UPDATE_SUBORDEN', payload: { id: subId, field: 'productoIndices', value: indices } });
        }
      }, 0);
    }
  };

  const handleAddSubOrden = () => {
    dispatch({ type: 'ADD_SUBORDEN' });
  };

  const handleRemoveSubOrden = (id: string) => {
    dispatch({ type: 'REMOVE_SUBORDEN', payload: id });
  };

  const handleMoveProducto = (productoIndex: number, targetSubOrdenId: string) => {
    // Quitar de sub-orden actual
    for (const sub of state.subOrdenes) {
      if (sub.productoIndices.includes(productoIndex)) {
        dispatch({
          type: 'UPDATE_SUBORDEN',
          payload: {
            id: sub.id,
            field: 'productoIndices',
            value: sub.productoIndices.filter(i => i !== productoIndex),
          },
        });
      }
    }
    // Agregar a nueva sub-orden
    const targetSub = state.subOrdenes.find(s => s.id === targetSubOrdenId);
    if (targetSub) {
      dispatch({
        type: 'UPDATE_SUBORDEN',
        payload: {
          id: targetSubOrdenId,
          field: 'productoIndices',
          value: [...targetSub.productoIndices, productoIndex],
        },
      });
    }
  };

  if (productosValidos.length <= 1) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Package className="h-10 w-10 mx-auto mb-2 text-slate-300" />
        <p className="text-sm">Las sub-\u00f3rdenes requieren al menos 2 productos.</p>
        <p className="text-xs text-slate-400 mt-1">Agrega m\u00e1s productos en el paso anterior.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-between bg-sky-50 border border-sky-200 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <SplitSquareVertical className="h-5 w-5 text-sky-600" />
          <div>
            <div className="text-sm font-medium text-sky-900">Dividir en Sub-\u00d3rdenes</div>
            <div className="text-xs text-sky-700">
              {tieneSubOrdenes
                ? `${state.subOrdenes.length} sub-\u00f3rdenes configuradas`
                : 'Cada sub-orden genera su propio env\u00edo'}
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant={tieneSubOrdenes ? 'danger' : 'primary'}
          onClick={handleToggleSubOrdenes}
        >
          {tieneSubOrdenes ? 'Desactivar' : 'Dividir'}
        </Button>
      </div>

      {!tieneSubOrdenes && (
        <div className="text-center py-4 text-slate-500 text-sm">
          Toda la OC se procesar\u00e1 como una sola orden con un solo env\u00edo.
        </div>
      )}

      {/* Sub-ordenes */}
      {tieneSubOrdenes && (
        <div className="space-y-3">
          {state.subOrdenes.map((sub, subIdx) => {
            const productosEnSub = sub.productoIndices.map(i => productosValidos[i]).filter(Boolean);
            const totalSub = productosEnSub.reduce((s, p) => s + p.cantidad * p.costoUnitario, 0);

            return (
              <Card key={sub.id} className="p-3 border-l-4 border-l-sky-500">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="info" className="text-xs">Sub-{subIdx + 1}</Badge>
                    <span className="text-xs text-slate-500">{productosEnSub.length} productos &middot; ${totalSub.toFixed(2)}</span>
                  </div>
                  {state.subOrdenes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSubOrden(sub.id)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <Input
                  label="Referencia del proveedor"
                  placeholder="N\u00famero de orden/factura del proveedor"
                  value={sub.referenciaProveedor}
                  onChange={e => dispatch({
                    type: 'UPDATE_SUBORDEN',
                    payload: { id: sub.id, field: 'referenciaProveedor', value: e.target.value },
                  })}
                  className="text-sm mb-2"
                />

                {/* Productos asignados */}
                <div className="space-y-1">
                  {productosEnSub.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-2 border border-dashed rounded">
                      Arrastra productos aqu\u00ed
                    </p>
                  ) : (
                    productosEnSub.map(p => (
                      <div key={p.productoId} className="flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1.5">
                        <span className="text-slate-700">{p.sku} {p.nombreComercial}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">{p.cantidad}x ${p.costoUnitario.toFixed(2)}</span>
                          {/* Mover a otra sub-orden */}
                          {state.subOrdenes.length > 1 && (
                            <select
                              className="text-[10px] border rounded px-1 py-0.5"
                              value=""
                              onChange={e => {
                                if (e.target.value) {
                                  const origIdx = productosValidos.findIndex(pv => pv.productoId === p.productoId);
                                  handleMoveProducto(origIdx, e.target.value);
                                }
                              }}
                            >
                              <option value="">Mover a...</option>
                              {state.subOrdenes.filter(s => s.id !== sub.id).map((s, i) => (
                                <option key={s.id} value={s.id}>Sub-{state.subOrdenes.indexOf(s) + 1}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            );
          })}

          {/* Productos sin asignar */}
          {productosNoAsignados.length > 0 && (
            <Card className="p-3 border-l-4 border-l-amber-400">
              <div className="text-xs font-medium text-amber-700 mb-1">
                Sin asignar ({productosNoAsignados.length})
              </div>
              {productosNoAsignados.map(p => (
                <div key={p.productoId} className="flex items-center justify-between text-xs bg-amber-50 rounded px-2 py-1.5 mb-1">
                  <span>{p.sku} {p.nombreComercial}</span>
                  <select
                    className="text-[10px] border rounded px-1 py-0.5"
                    value=""
                    onChange={e => {
                      if (e.target.value) handleMoveProducto(p.originalIndex, e.target.value);
                    }}
                  >
                    <option value="">Asignar a...</option>
                    {state.subOrdenes.map((s, i) => (
                      <option key={s.id} value={s.id}>Sub-{i + 1}</option>
                    ))}
                  </select>
                </div>
              ))}
            </Card>
          )}

          <Button size="sm" variant="secondary" onClick={handleAddSubOrden} className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1" /> Agregar Sub-Orden
          </Button>
        </div>
      )}
    </div>
  );
};
