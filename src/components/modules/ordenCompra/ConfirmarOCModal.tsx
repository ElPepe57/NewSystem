import React, { useState } from 'react';
import { Package, Layers, Plus, Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';
import { cn } from '../../../design-system';
import type { OrdenCompra, SubOrdenCompra, ProductoOrden } from '../../../types/ordenCompra.types';

// ---- Props ----

export interface ConfirmarOCModalProps {
  isOpen: boolean;
  onClose: () => void;
  orden: OrdenCompra;
  onConfirmar: (subOrdenes?: SubOrdenCompra[]) => Promise<void>;
  isSubmitting: boolean;
}

// ---- Sub-orden helpers ----

function crearSubOrden(productos: ProductoOrden[] = []): SubOrdenCompra {
  const totalUSD = productos.reduce(
    (s, p) => s + (p.costoUnitario || 0) * (p.cantidad || 0),
    0,
  );
  return {
    id: `SUB-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    referenciaProveedor: '',
    productos,
    totalUSD,
  };
}

function recalcTotal(sub: SubOrdenCompra): SubOrdenCompra {
  return {
    ...sub,
    totalUSD: sub.productos.reduce(
      (s, p) => s + (p.costoUnitario || 0) * (p.cantidad || 0),
      0,
    ),
  };
}

// ---- Component ----

export const ConfirmarOCModal: React.FC<ConfirmarOCModalProps> = ({
  isOpen,
  onClose,
  orden,
  onConfirmar,
  isSubmitting,
}) => {
  // Step: 'question' | 'subordenes'
  const [step, setStep] = useState<'question' | 'subordenes'>('question');
  // assignment: productIndex → subOrdenId ('' = unassigned)
  const [assignment, setAssignment] = useState<Record<number, string>>({});
  const [subOrdenes, setSubOrdenes] = useState<SubOrdenCompra[]>([]);

  // Reset local state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setStep('question');
      setAssignment({});
      setSubOrdenes([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ---- Handlers ----

  const handleElegirNo = async () => {
    await onConfirmar();
  };

  const handleElegirSi = () => {
    // Initialize 2 sub-ordenes, all products unassigned
    const sub1 = crearSubOrden();
    const sub2 = crearSubOrden();
    setSubOrdenes([sub1, sub2]);
    setAssignment({});
    setStep('subordenes');
  };

  const handleAssignmentChange = (productIndex: number, subId: string) => {
    const newAssignment = { ...assignment, [productIndex]: subId };
    setAssignment(newAssignment);

    // Rebuild sub-ordenes productos
    setSubOrdenes((prev) =>
      prev.map((sub) => {
        const assigned = orden.productos.filter((_, i) => newAssignment[i] === sub.id);
        return recalcTotal({ ...sub, productos: assigned });
      }),
    );
  };

  const handleRefChange = (subId: string, ref: string) => {
    setSubOrdenes((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, referenciaProveedor: ref } : s)),
    );
  };

  const handleAddSubOrden = () => {
    setSubOrdenes((prev) => [...prev, crearSubOrden()]);
  };

  const handleRemoveSubOrden = (subId: string) => {
    if (subOrdenes.length <= 2) return; // min 2
    // Unassign products that were in this sub-orden
    const newAssignment = { ...assignment };
    Object.keys(newAssignment).forEach((k) => {
      if (newAssignment[Number(k)] === subId) newAssignment[Number(k)] = '';
    });
    setAssignment(newAssignment);

    const remaining = subOrdenes.filter((s) => s.id !== subId);
    setSubOrdenes(
      remaining.map((sub) => {
        const assigned = orden.productos.filter((_, i) => newAssignment[i] === sub.id);
        return recalcTotal({ ...sub, productos: assigned });
      }),
    );
  };

  const handleConfirmarConSubOrdenes = async () => {
    await onConfirmar(subOrdenes);
  };

  // Derived
  const unassignedIndices = orden.productos
    .map((_, i) => i)
    .filter((i) => !assignment[i]);

  const hasUnassigned = unassignedIndices.length > 0;
  const grandTotal = orden.totalUSD;

  // ---- Render ----

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Confirmar {orden.numeroOrden}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {orden.nombreProveedor} &middot; ${grandTotal.toFixed(2)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'question' && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-700 text-center">
                ¿Esta orden fue subdividida por el proveedor?
              </p>
              <p className="text-xs text-slate-500 text-center">
                Algunos proveedores (ej. Amazon) dividen un pedido en múltiples envíos con referencias distintas.
              </p>

              <div className="grid grid-cols-2 gap-3 mt-4">
                {/* Opción: No */}
                <button
                  type="button"
                  onClick={handleElegirNo}
                  disabled={isSubmitting}
                  className={cn(
                    'flex flex-col items-center gap-3 p-5 rounded-xl border-2 text-left transition-all',
                    'border-slate-200 hover:border-teal-400 hover:bg-teal-50',
                    isSubmitting && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-7 w-7 text-teal-500 animate-spin" />
                  ) : (
                    <Package className="h-7 w-7 text-slate-400" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900 text-center">
                      No, es una sola orden
                    </p>
                    <p className="text-xs text-slate-500 text-center mt-0.5">
                      Se crea un único envío
                    </p>
                  </div>
                </button>

                {/* Opción: Sí */}
                <button
                  type="button"
                  onClick={handleElegirSi}
                  disabled={isSubmitting}
                  className={cn(
                    'flex flex-col items-center gap-3 p-5 rounded-xl border-2 text-left transition-all',
                    'border-slate-200 hover:border-teal-400 hover:bg-teal-50',
                    isSubmitting && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <Layers className="h-7 w-7 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 text-center">
                      Sí, tiene múltiples referencias
                    </p>
                    <p className="text-xs text-slate-500 text-center mt-0.5">
                      Configura los sub-envíos
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 'subordenes' && (
            <div className="space-y-5">
              {/* Asignación de productos */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Asignar productos a sub-órdenes
                </p>

                {orden.productos.map((prod, idx) => (
                  <div
                    key={`assign-${prod.productoId}-${idx}`}
                    className="px-3 py-2.5 bg-slate-50 rounded-lg space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center text-[10px] font-semibold text-teal-700 flex-shrink-0">
                          {idx + 1}
                        </div>
                        <span className="text-sm text-slate-700 truncate">
                          {prod.nombreComercial}
                        </span>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {prod.sku}
                        </span>
                      </div>

                      <select
                        value={assignment[idx] || ''}
                        onChange={(e) => handleAssignmentChange(idx, e.target.value)}
                        className={cn(
                          'text-xs border rounded-lg px-2 py-1 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white flex-shrink-0',
                          !assignment[idx]
                            ? 'border-amber-300 text-amber-700'
                            : 'border-slate-300 text-slate-900',
                        )}
                      >
                        <option value="">Sin asignar</option>
                        {subOrdenes.map((sub, sIdx) => (
                          <option key={sub.id} value={sub.id}>
                            Sub-orden {sIdx + 1}
                            {sub.referenciaProveedor ? ` — ${sub.referenciaProveedor}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Product summary */}
                    <div className="pl-7 flex items-center gap-3 text-xs text-slate-500">
                      <span>x{prod.cantidad}</span>
                      <span>${prod.costoUnitario.toFixed(2)} c/u</span>
                      <span className="font-medium text-slate-700 ml-auto">
                        ${((prod.cantidad || 0) * (prod.costoUnitario || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Unassigned warning */}
                {hasUnassigned && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    {unassignedIndices.length === 1
                      ? '1 producto sin asignar'
                      : `${unassignedIndices.length} productos sin asignar`}
                  </div>
                )}
              </div>

              {/* Sub-orden cards */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Sub-órdenes ({subOrdenes.length})
                </p>

                {subOrdenes.map((sub, sIdx) => (
                  <div
                    key={sub.id}
                    className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                        Sub-orden {sIdx + 1}
                      </span>
                      {subOrdenes.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSubOrden(sub.id)}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Eliminar sub-orden"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Referencia proveedor */}
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">
                        Referencia del proveedor (ej. "Amazon Order #111-222")
                      </label>
                      <input
                        type="text"
                        value={sub.referenciaProveedor}
                        onChange={(e) => handleRefChange(sub.id, e.target.value)}
                        placeholder="Número de orden / factura del proveedor"
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-900 bg-white"
                      />
                    </div>

                    {/* Productos asignados */}
                    {sub.productos.length > 0 ? (
                      <div className="space-y-1">
                        {sub.productos.map((p, pIdx) => (
                          <div
                            key={`${sub.id}-p-${pIdx}`}
                            className="flex items-center justify-between text-xs text-slate-600 bg-white border border-slate-100 rounded-lg px-2 py-1"
                          >
                            <span className="truncate">{p.nombreComercial}</span>
                            <span className="text-slate-400 flex-shrink-0 ml-2">
                              x{p.cantidad} · ${((p.cantidad || 0) * (p.costoUnitario || 0)).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Sin productos asignados</p>
                    )}

                    {/* Subtotal */}
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                      <span className="text-xs text-slate-500">Subtotal sub-orden</span>
                      <span className="text-sm font-semibold text-slate-900">
                        ${sub.totalUSD.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Agregar sub-orden */}
                <button
                  type="button"
                  onClick={handleAddSubOrden}
                  className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-teal-300 rounded-xl text-sm text-teal-600 hover:bg-teal-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Agregar sub-orden
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100">
          {step === 'question' ? (
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep('question')}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Volver
            </button>
          )}

          {step === 'subordenes' && (
            <button
              type="button"
              onClick={handleConfirmarConSubOrdenes}
              disabled={isSubmitting || hasUnassigned}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors',
                isSubmitting || hasUnassigned
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-teal-600 text-white hover:bg-teal-700',
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <Layers className="h-4 w-4" />
                  Confirmar con sub-órdenes
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
