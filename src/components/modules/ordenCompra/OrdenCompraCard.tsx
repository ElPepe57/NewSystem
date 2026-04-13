import React, { useMemo, useState } from 'react';
import { formatFecha as formatDate } from '../../../utils/dateFormatters';
import { Package, User, Calendar, DollarSign, MapPin, Truck, Box, TrendingUp, CreditCard, ChevronDown, ChevronUp, Clock, RotateCcw, Layers } from 'lucide-react';
import { Badge, Button, StatusTimeline } from '../../common';
import { StatusBadge, cn } from '../../../design-system';
import type { TimelineStep, NextAction } from '../../common';
import type { OrdenCompra, EstadoOrden, EstadoPagoOC, SubOrdenCompra, ProductoOrden } from '../../../types/ordenCompra.types';
import { getDescripcionProducto } from '../../../utils/producto.helpers';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';

interface OrdenCompraCardProps {
  orden: OrdenCompra;
  onCambiarEstado?: (nuevoEstado: EstadoOrden) => void;
  onConfirmarConSubOrdenes?: (subOrdenes?: SubOrdenCompra[]) => void;
  onRegistrarPago?: () => void;
  onRecibirOrden?: () => void;
  onRevertirRecepciones?: () => void;
}

const estadoLabels: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  borrador: { label: 'Borrador', variant: 'default' },
  confirmada: { label: 'Confirmada', variant: 'info' },
  en_proceso: { label: 'En Proceso', variant: 'warning' },
  despachada: { label: 'Despachada', variant: 'warning' },
  completada: { label: 'Completada', variant: 'success' },
  // Legacy
  enviada: { label: 'Enviada', variant: 'info' },
  en_transito: { label: 'En Tr\u00e1nsito', variant: 'warning' },
  recibida_parcial: { label: 'Recibida Parcial', variant: 'warning' },
  recibida: { label: 'Recibida', variant: 'success' },
  cancelada: { label: 'Cancelada', variant: 'danger' }
};

const estadoPagoLabels: Record<EstadoPagoOC, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  pendiente: { label: 'Pendiente de Pago', variant: 'danger' },
  pago_parcial: { label: 'Pago Parcial', variant: 'warning' },
  pagada: { label: 'Pagada', variant: 'success' }
};

export const OrdenCompraCard: React.FC<OrdenCompraCardProps> = ({
  orden,
  onCambiarEstado,
  onConfirmarConSubOrdenes,
  onRegistrarPago,
  onRecibirOrden,
  onRevertirRecepciones
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [modoConfirmacion, setModoConfirmacion] = useState<'idle' | 'pregunta' | 'subordenes'>('idle');
  const [subOrdenes, setSubOrdenes] = useState<SubOrdenCompra[]>([]);
  // asignacion[productoIdx][subOrdenId] = cantidad asignada
  const [asignacion, setAsignacion] = useState<Record<number, Record<string, number>>>({});


  const estadoInfo = estadoLabels[orden.estado];
  const estadoPagoInfo = estadoPagoLabels[orden.estadoPago || 'pendiente'];

  // Generar pasos del timeline (soporta estados nuevos + legacy)
  const timelineSteps: TimelineStep[] = useMemo(() => {
    const estadoIndex: Record<string, number> = {
      'borrador': 0,
      'confirmada': 1, 'enviada': 1,
      'en_proceso': 2, 'en_transito': 2,
      'despachada': 3, 'recibida_parcial': 3,
      'completada': 4, 'recibida': 4,
      'cancelada': -1
    };

    const currentIndex = estadoIndex[orden.estado] ?? 0;
    const isCancelled = orden.estado === 'cancelada';

    return [
      {
        id: 'borrador',
        label: 'Borrador',
        date: orden.fechaCreacion,
        status: isCancelled ? 'skipped' : currentIndex >= 0 ? 'completed' : 'pending'
      },
      {
        id: 'confirmada',
        label: 'Confirmada',
        date: orden.fechaEnviada,
        status: isCancelled ? 'skipped' : currentIndex > 1 ? 'completed' : currentIndex === 1 ? 'current' : 'pending'
      },
      {
        id: 'en_proceso',
        label: 'En Proceso',
        date: orden.fechaEnTransito,
        status: isCancelled ? 'skipped' : currentIndex > 2 ? 'completed' : currentIndex === 2 ? 'current' : 'pending'
      },
      {
        id: 'despachada',
        label: 'Despachada',
        date: orden.fechaPrimeraRecepcion,
        status: isCancelled ? 'skipped' : currentIndex > 3 ? 'completed' : currentIndex === 3 ? 'current' : 'pending'
      },
      {
        id: 'completada',
        label: 'Completada',
        date: orden.fechaRecibida,
        status: isCancelled ? 'skipped' : currentIndex === 4 ? 'completed' : 'pending'
      }
    ];
  }, [orden]);

  // Determinar la siguiente acción basada en el estado
  const nextAction: NextAction | undefined = useMemo(() => {
    if (orden.estado === 'cancelada' || orden.estado === 'recibida' || orden.estado === 'completada') return undefined;

    const actions: Record<string, NextAction> = {
      borrador: {
        label: 'Confirmar OC',
        description: 'Confirma la orden, crea unidades pedidas y envío automático',
        buttonText: (onConfirmarConSubOrdenes || onCambiarEstado) ? 'Confirmar' : undefined,
        onClick: (onConfirmarConSubOrdenes || onCambiarEstado)
          ? () => {
              if (onConfirmarConSubOrdenes && orden.productos.length >= 2) {
                setModoConfirmacion('pregunta');
              } else if (onConfirmarConSubOrdenes) {
                onConfirmarConSubOrdenes(); // single product, no sub-orders needed
              } else if (onCambiarEstado) {
                onCambiarEstado('confirmada');
              }
            }
          : undefined,
        variant: 'primary'
      },
      confirmada: {
        label: 'En Proceso',
        description: 'Indica que los productos est\u00e1n en camino',
        buttonText: onCambiarEstado ? 'En Proceso' : undefined,
        onClick: onCambiarEstado ? () => onCambiarEstado('en_proceso') : undefined,
        variant: 'warning'
      },
      en_proceso: {
        label: 'Recibir Productos',
        description: 'Registra los productos recibidos via env\u00edo',
        buttonText: onRecibirOrden ? 'Recibir' : undefined,
        onClick: onRecibirOrden,
        variant: 'success'
      },
      // Legacy states
      enviada: {
        label: 'Poner en Tr\u00e1nsito',
        description: 'Registra el tracking y marca la orden en camino',
        buttonText: onCambiarEstado ? 'En Tr\u00e1nsito' : undefined,
        onClick: onCambiarEstado ? () => onCambiarEstado('en_transito') : undefined,
        variant: 'warning'
      },
      en_transito: {
        label: 'Recibir Productos',
        description: 'Registra los productos recibidos y genera inventario',
        buttonText: onRecibirOrden ? 'Recibir' : undefined,
        onClick: onRecibirOrden,
        variant: 'success'
      },
      recibida_parcial: {
        label: 'Recibir M\u00e1s Productos',
        description: 'Registrar siguiente entrega de productos',
        buttonText: onRecibirOrden ? 'Recibir Más' : undefined,
        onClick: onRecibirOrden,
        variant: 'warning'
      }
    };

    return actions[orden.estado];
  }, [orden.estado, onCambiarEstado, onConfirmarConSubOrdenes, onRecibirOrden]);

  // Determinar siguientes acciones posibles (solo estado logístico)
  // Nota: "Confirmar OC" se maneja por la timeline (nextAction), no aquí
  const getAccionesDisponibles = () => {
    const acciones: Array<{ estado: EstadoOrden; label: string }> = [];

    // Borrador: sin acciones extra (Confirmar está en la timeline)
    // Confirmada: puede pasar a en_proceso
    if (orden.estado === 'confirmada' || orden.estado === 'enviada') {
      acciones.push({ estado: 'en_proceso', label: 'Marcar En Proceso' });
    }
    // En proceso: puede pasar a despachada
    if (orden.estado === 'en_proceso' || orden.estado === 'en_transito') {
      acciones.push({ estado: 'despachada', label: 'Marcar Despachada' });
    }

    return acciones;
  };

  // Progreso por producto (para recibida_parcial)
  const tieneRecepcionesParciales = orden.recepcionesParciales && orden.recepcionesParciales.length > 0;
  const totalOrdenado = orden.productos.reduce((sum, p) => sum + p.cantidad, 0);
  const totalRecibido = orden.productos.reduce((sum, p) => sum + (p.cantidadRecibida || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <Package className="h-8 w-8 text-teal-600" />
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{orden.numeroOrden}</h2>
              <p className="text-sm text-slate-600">{orden.nombreProveedor}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge variant={estadoInfo.variant as any} dot size="md">
            {estadoInfo.label}
          </StatusBadge>
          <StatusBadge variant={estadoPagoInfo.variant as any} icon={CreditCard}>
            {estadoPagoInfo.label}
          </StatusBadge>
        </div>
      </div>

      {/* Timeline de Estado */}
      <div className="bg-slate-50 p-4 rounded-lg">
        <StatusTimeline
          steps={timelineSteps}
          nextAction={nextAction}
          orientation="horizontal"
          showDates={true}
          compact={false}
        />
      </div>

      {/* Confirmación con sub-órdenes — aparece justo debajo de la timeline */}
      {modoConfirmacion !== 'idle' && (
        <div className="border border-teal-200 bg-teal-50/50 rounded-xl p-5 space-y-4">
          {modoConfirmacion === 'pregunta' && (
            <>
              <h4 className="font-semibold text-slate-900">¿Esta orden fue subdividida por el proveedor?</h4>
              <p className="text-xs text-slate-500">Si el proveedor envió con múltiples referencias (ej: varias órdenes de Amazon), divídela en sub-órdenes.</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setModoConfirmacion('idle'); onConfirmarConSubOrdenes?.(); }}
                  className="px-4 py-4 bg-white border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-900 hover:border-teal-500 hover:bg-teal-50 transition-all text-center"
                >
                  <Package className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  No, es una sola orden
                  <p className="text-[10px] text-slate-400 mt-1 font-normal">Confirma y crea 1 envío</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id1 = `SUB-${Date.now()}-a`;
                    const id2 = `SUB-${Date.now()}-b`;
                    // Init: all quantities to sub-orden 1
                    const init: Record<number, Record<string, number>> = {};
                    orden.productos.forEach((p, i) => { init[i] = { [id1]: p.cantidad, [id2]: 0 }; });
                    setAsignacion(init);
                    setSubOrdenes([
                      { id: id1, referenciaProveedor: '', productos: [...orden.productos], totalUSD: orden.totalUSD },
                      { id: id2, referenciaProveedor: '', productos: [], totalUSD: 0 },
                    ]);
                    setModoConfirmacion('subordenes');
                  }}
                  className="px-4 py-4 bg-white border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-900 hover:border-teal-500 hover:bg-teal-50 transition-all text-center"
                >
                  <Layers className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  Sí, dividir
                  <p className="text-[10px] text-slate-400 mt-1 font-normal">Asigna productos a sub-envíos</p>
                </button>
              </div>
              <button onClick={() => setModoConfirmacion('idle')} className="text-xs text-slate-400 hover:text-slate-600">Cancelar</button>
            </>
          )}

          {modoConfirmacion === 'subordenes' && (
            (() => {
              const rebuildSubs = (newA: Record<number, Record<string, number>>) => {
                setSubOrdenes(prev => prev.map(sub => {
                  const prods: ProductoOrden[] = [];
                  let totalUSD = 0;
                  orden.productos.forEach((p, idx) => {
                    const qty = newA[idx]?.[sub.id] || 0;
                    if (qty > 0) {
                      prods.push({ ...p, cantidad: qty, subtotal: qty * p.costoUnitario });
                      totalUSD += qty * p.costoUnitario;
                    }
                  });
                  return { ...sub, productos: prods, totalUSD };
                }));
              };

              const updateQty = (prodIdx: number, subId: string, qty: number) => {
                const newA = { ...asignacion };
                if (!newA[prodIdx]) newA[prodIdx] = {};
                newA[prodIdx] = { ...newA[prodIdx], [subId]: Math.max(0, qty) };
                setAsignacion(newA);
                rebuildSubs(newA);
              };

              const qtyValid = orden.productos.every((p, idx) => {
                const totalAssigned = Object.values(asignacion[idx] || {}).reduce((s, v) => s + v, 0);
                return totalAssigned === p.cantidad;
              });
              const refsValid = subOrdenes.every(s => s.referenciaProveedor.trim().length > 0);
              const hasProducts = subOrdenes.every(s => s.productos.length > 0);
              const isValid = qtyValid && refsValid && hasProducts;

              // Cost distribution
              const totalOC = orden.totalUSD || 0;
              const subtotalProds = orden.subtotalUSD || orden.productos.reduce((s, p) => s + p.costoUnitario * p.cantidad, 0);
              const costosExtra = totalOC - subtotalProds; // tax + shipping + otros - descuento

              return (
                <>
                  <h4 className="font-semibold text-slate-900">Dividir en sub-órdenes</h4>
                  <p className="text-xs text-slate-500">Asigna cantidades de cada producto y la referencia de cada sub-orden</p>

                  {/* Sub-orden cards — each contains reference + product assignments */}
                  <div className="space-y-4">
                    {subOrdenes.map((sub, sIdx) => {
                      const subUnits = sub.productos.reduce((s, p) => s + p.cantidad, 0);
                      const totalUnitsOC = orden.productos.reduce((s, p) => s + p.cantidad, 0);
                      const proportion = totalUnitsOC > 0 ? subUnits / totalUnitsOC : 0;
                      const costosProporcion = costosExtra * proportion;
                      const missingRef = sub.referenciaProveedor.trim().length === 0;

                      return (
                        <div key={sub.id} className={cn('bg-white border rounded-xl p-4 space-y-3', missingRef ? 'border-amber-300' : 'border-slate-200')}>
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-teal-700">Sub-orden {sIdx + 1}</span>
                            <div className="text-right">
                              <span className="text-sm font-bold tabular-nums">${sub.totalUSD.toFixed(2)}</span>
                              {costosProporcion > 0 && (
                                <span className="text-[10px] text-amber-600 block">+${costosProporcion.toFixed(2)} cargos</span>
                              )}
                            </div>
                          </div>

                          {/* Reference — obligatory */}
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">
                              Referencia proveedor <span className="text-red-500">*</span>
                            </label>
                            <input
                              key={`ref-${sub.id}`}
                              type="text"
                              value={sub.referenciaProveedor}
                              onChange={e => setSubOrdenes(prev => prev.map(s => s.id === sub.id ? { ...s, referenciaProveedor: e.target.value } : s))}
                              placeholder="Número de orden / factura (obligatorio)"
                              className={cn('w-full text-xs border rounded-lg px-3 py-2 focus:ring-1 focus:ring-teal-500', missingRef ? 'border-amber-300 bg-amber-50' : 'border-slate-200')}
                            />
                            {missingRef && <p className="text-[10px] text-amber-600 mt-0.5">Referencia obligatoria</p>}
                          </div>

                          {/* Product quantities — vertical layout */}
                          <div className="space-y-1.5">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Productos</p>
                            {orden.productos.map((prod, idx) => {
                              const qty = asignacion[idx]?.[sub.id] || 0;
                              return (
                                <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-1.5">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="text-xs text-slate-700 truncate">{prod.nombreComercial}</span>
                                    <span className="text-[10px] text-slate-400">${prod.costoUnitario.toFixed(2)}/ud</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <input
                                      type="number"
                                      min="0"
                                      max={prod.cantidad}
                                      value={qty}
                                      onChange={e => updateQty(idx, sub.id, parseInt(e.target.value) || 0)}
                                      className="w-12 px-1 py-1 text-xs text-center border border-slate-200 rounded focus:ring-1 focus:ring-teal-500"
                                    />
                                    <span className="text-[10px] text-slate-400">/{prod.cantidad}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Summary */}
                          <p className="text-[10px] text-slate-400">{sub.productos.length} productos · {subUnits} uds</p>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        const newId = `SUB-${Date.now()}`;
                        setSubOrdenes(prev => [...prev, { id: newId, referenciaProveedor: '', productos: [], totalUSD: 0 }]);
                        setAsignacion(prev => {
                          const newA = { ...prev };
                          orden.productos.forEach((_, i) => { newA[i] = { ...newA[i], [newId]: 0 }; });
                          return newA;
                        });
                      }}
                      className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Agregar sub-orden
                    </button>
                  </div>

                  {/* Validation warnings */}
                  {!qtyValid && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Todas las unidades deben estar asignadas
                    </div>
                  )}
                  {qtyValid && !refsValid && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Todas las sub-órdenes requieren referencia del proveedor
                    </div>
                  )}
                  {qtyValid && refsValid && !hasProducts && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Cada sub-orden debe tener al menos 1 producto
                    </div>
                  )}

                  {/* Cost distribution note */}
                  {costosExtra > 0 && (
                    <div className="text-[10px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                      Los cargos adicionales (${costosExtra.toFixed(2)}) se distribuyen proporcionalmente por unidades asignadas a cada sub-orden.
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={() => { setModoConfirmacion('idle'); setSubOrdenes([]); setAsignacion({}); }}>Cancelar</Button>
                    <Button variant="primary" onClick={() => { setModoConfirmacion('idle'); onConfirmarConSubOrdenes?.(subOrdenes); }} disabled={!isValid}>
                      Confirmar con {subOrdenes.length} sub-órdenes
                </Button>
              </div>
            </>
              );
            })()
          )}
        </div>
      )}

      {/* Resto del contenido — oculto durante confirmación */}
      {modoConfirmacion === 'idle' && <>

      {/* Información General */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-50 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <Calendar className="h-5 w-5 text-slate-600 mr-2" />
            <h4 className="font-semibold text-slate-900">Fechas</h4>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Creación:</span>
              <span className="text-slate-900">{formatDate(orden.fechaCreacion)}</span>
            </div>
            {orden.fechaEnviada && (
              <div className="flex justify-between">
                <span className="text-slate-600">Enviada:</span>
                <span className="text-slate-900">{formatDate(orden.fechaEnviada)}</span>
              </div>
            )}
            {orden.fechaPago && (
              <div className="flex justify-between">
                <span className="text-slate-600">Pagada:</span>
                <span className="text-slate-900">{formatDate(orden.fechaPago)}</span>
              </div>
            )}
            {orden.fechaPrimeraRecepcion && (
              <div className="flex justify-between">
                <span className="text-slate-600">Primera recepción:</span>
                <span className="text-slate-900">{formatDate(orden.fechaPrimeraRecepcion)}</span>
              </div>
            )}
            {orden.fechaRecibida && (
              <div className="flex justify-between">
                <span className="text-slate-600">Recibida completa:</span>
                <span className="text-slate-900">{formatDate(orden.fechaRecibida)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-teal-50 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <DollarSign className="h-5 w-5 text-teal-600 mr-2" />
            <h4 className="font-semibold text-slate-900">Totales</h4>
          </div>
          <div className="space-y-2">
            {/* Desglose financiero en orden lógico */}
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal Productos:</span>
              <span className="font-semibold">${orden.subtotalUSD.toFixed(2)}</span>
            </div>
            {orden.descuentoUSD && orden.descuentoUSD > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Descuento:</span>
                <span className="font-medium">-${orden.descuentoUSD.toFixed(2)}</span>
              </div>
            )}
            {orden.descuentoUSD && orden.descuentoUSD > 0 && (orden.impuestoCompraUSD ?? orden.impuestoUSD) && (orden.impuestoCompraUSD ?? orden.impuestoUSD)! > 0 && (
              <div className="flex justify-between text-sm text-slate-500">
                <span>Base imponible:</span>
                <span>${(orden.subtotalUSD - (orden.descuentoUSD || 0)).toFixed(2)}</span>
              </div>
            )}
            {(orden.impuestoCompraUSD ?? orden.impuestoUSD) && (orden.impuestoCompraUSD ?? orden.impuestoUSD)! > 0 && (
              <div className="flex justify-between text-sm text-amber-700">
                <span>Tax / Impuesto ({(((orden.impuestoCompraUSD ?? orden.impuestoUSD)! / Math.max(orden.subtotalUSD - (orden.descuentoUSD || 0), 1)) * 100).toFixed(2)}%):</span>
                <span className="font-medium">${(orden.impuestoCompraUSD ?? orden.impuestoUSD)!.toFixed(2)}</span>
              </div>
            )}
            {(orden.costoEnvioProveedorUSD ?? orden.gastosEnvioUSD) && (orden.costoEnvioProveedorUSD ?? orden.gastosEnvioUSD)! > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Gastos de Envío:</span>
                <span>${(orden.costoEnvioProveedorUSD ?? orden.gastosEnvioUSD)!.toFixed(2)}</span>
              </div>
            )}
            {(orden.otrosGastosCompraUSD ?? orden.otrosGastosUSD) && (orden.otrosGastosCompraUSD ?? orden.otrosGastosUSD)! > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Otros Gastos:</span>
                <span>${(orden.otrosGastosCompraUSD ?? orden.otrosGastosUSD)!.toFixed(2)}</span>
              </div>
            )}
            {/* TC referencial */}
            {(orden.tcReferencial || orden.tcCompra) && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">TC Referencial:</span>
                <span className="font-medium text-slate-900">S/ {(orden.tcReferencial || orden.tcCompra || 0).toFixed(3)}</span>
              </div>
            )}
            {/* Modo de entrega */}
            {orden.modoEntregaDetallado && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Modo entrega:</span>
                <span className="font-medium text-slate-900">
                  {{ ddp_directo: 'DDP Directo', via_viajero: 'Vía viajero', via_courier: 'Vía courier', recojo_propio: 'Recojo propio' }[orden.modoEntregaDetallado] || orden.modoEntregaDetallado}
                </span>
              </div>
            )}
            {orden.colaboradorTransporteNombre && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Transportista:</span>
                <span className="font-medium text-slate-900">{orden.colaboradorTransporteNombre}</span>
              </div>
            )}
            <div className="border-t border-teal-200 pt-2">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-900">Total USD:</span>
                <span className="text-xl font-bold text-teal-600">${orden.totalUSD.toFixed(2)}</span>
              </div>
            </div>
            {/* Total PEN estimado */}
            {(orden.tcReferencial || orden.tcCompra) && !orden.totalPEN && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Estimado PEN:</span>
                <span className="font-medium text-slate-700">S/ {(orden.totalUSD * (orden.tcReferencial || orden.tcCompra || 0)).toFixed(2)}</span>
              </div>
            )}
            {orden.totalPEN && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Total PEN (TC {orden.tcPago?.toFixed(3)}):</span>
                <span className="text-lg font-semibold text-slate-900">S/ {orden.totalPEN.toFixed(2)}</span>
              </div>
            )}
            {/* Indicador FX: tcReferencial vs tcPago */}
            {orden.tcReferencial && orden.tcPago && orden.tcReferencial !== orden.tcPago && (
              <div className="flex justify-between items-center text-xs bg-slate-50 rounded px-2 py-1">
                <span className="text-slate-500">TC Ref: {orden.tcReferencial.toFixed(3)} → Pago: {orden.tcPago.toFixed(3)}</span>
                <span className={`font-medium ${orden.tcPago > orden.tcReferencial ? 'text-red-600' : 'text-emerald-600'}`}>
                  {orden.tcPago > orden.tcReferencial ? '+' : ''}{((orden.tcPago - orden.tcReferencial) / orden.tcReferencial * 100).toFixed(2)}% FX
                </span>
              </div>
            )}
            {orden.diferenciaCambiaria && Math.abs(orden.diferenciaCambiaria) > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Diferencia Cambiaria:</span>
                <span className={`font-semibold flex items-center ${
                  orden.diferenciaCambiaria > 0 ? 'text-red-600' : 'text-emerald-600'
                }`}>
                  <TrendingUp className="h-4 w-4 mr-1" />
                  S/ {Math.abs(orden.diferenciaCambiaria).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-órdenes (si existen) */}
      {orden.subOrdenes && orden.subOrdenes.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-600" />
            Sub-órdenes ({orden.subOrdenes.length})
          </h4>
          <div className="space-y-2">
            {orden.subOrdenes.map((sub, idx) => (
              <div key={sub.id} className="bg-white rounded-lg p-3 border border-purple-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900">Sub-orden {idx + 1}</span>
                  <span className="text-sm font-bold tabular-nums">${sub.totalUSD.toFixed(2)}</span>
                </div>
                {sub.referenciaProveedor && (
                  <p className="text-xs text-slate-500 mt-0.5">Ref: {sub.referenciaProveedor}</p>
                )}
                <p className="text-xs text-slate-400 mt-0.5">{sub.productos.length} productos</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Productos con Costo Real */}
      <div>
        <h4 className="font-semibold text-slate-900 mb-3">Productos ({orden.productos.length})</h4>

        {/* Calcular desglose de costos por producto */}
        {(() => {
          const tc = orden.tcCompra || orden.tcPago || 0;
          const totalUnidades = orden.productos.reduce((sum, p) => sum + p.cantidad, 0);
          const costoBaseTotal = orden.productos.reduce((sum, p) => sum + (p.costoUnitario * p.cantidad), 0);

          // Componentes de costo
          const impuestoTotal = orden.impuestoCompraUSD ?? orden.impuestoUSD ?? 0;
          const envioTotal = orden.costoEnvioProveedorUSD ?? orden.gastosEnvioUSD ?? 0;
          const otrosTotal = orden.otrosGastosCompraUSD ?? orden.otrosGastosUSD ?? 0;
          const descuentoTotal = orden.descuentoUSD || 0;

          // Impuesto: uniforme por unidad
          const impuestoPorUnidad = totalUnidades > 0 ? impuestoTotal / totalUnidades : 0;
          // Envío, otros, descuento: proporcional al costo base
          const costosProrrateo = envioTotal + otrosTotal - descuentoTotal;

          const hasImpuesto = impuestoTotal > 0;
          const hasEnvio = envioTotal > 0;
          const hasOtros = otrosTotal > 0;
          const hasDescuento = descuentoTotal > 0;

          return (
            <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
              <table className="min-w-[600px] w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 min-w-[200px]">Producto</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-slate-500">Cant.</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-slate-500">Precio</th>
                    {hasDescuento && <th className="px-2 py-2 text-right text-xs font-medium text-emerald-600">Desc.</th>}
                    {hasImpuesto && <th className="px-2 py-2 text-right text-xs font-medium text-amber-600">Tax</th>}
                    {hasEnvio && <th className="px-2 py-2 text-right text-xs font-medium text-sky-600">Envío</th>}
                    {hasOtros && <th className="px-2 py-2 text-right text-xs font-medium text-slate-500">Otros</th>}
                    <th className="px-3 py-2 text-right text-xs font-medium text-teal-700 bg-teal-50">Costo Unit.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {orden.productos.map((producto, index) => {
                    // Proporcional al costo base de este producto
                    const proporcion = costoBaseTotal > 0 ? producto.costoUnitario / costoBaseTotal : 0;
                    const envioPorUd = envioTotal * proporcion;
                    const otrosPorUd = otrosTotal * proporcion;
                    const descuentoPorUd = descuentoTotal * proporcion;
                    const totalAdicional = impuestoPorUnidad + envioPorUd + otrosPorUd - descuentoPorUd;
                    const costoRealUnitario = producto.costoUnitario + totalAdicional;
                    const costoRealUnitarioPEN = costoRealUnitario * tc;

                    return (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-3 py-3">
                          <div className="text-sm font-medium text-slate-900">{producto.nombreComercial}</div>
                          <div className="flex items-center flex-wrap gap-x-1.5 text-[10px] text-slate-400 mt-0.5">
                            <span className="font-mono">{producto.sku}</span>
                            {producto.marca && <><span className="text-slate-300">·</span><span>{producto.marca}</span></>}
                            {producto.presentacion && <><span className="text-slate-300">·</span><span>{producto.presentacion}</span></>}
                            {producto.contenido && <><span className="text-slate-300">·</span><span>{producto.contenido}</span></>}
                            {producto.dosaje && <><span className="text-slate-300">·</span><span>{producto.dosaje}</span></>}
                            {producto.sabor && <><span className="text-slate-300">·</span><span>{producto.sabor}</span></>}
                            {producto.pesoLibras && <><span className="text-slate-300">·</span><span>{producto.pesoLibras} lb</span></>}
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                            {producto.cantidad}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-right text-sm text-slate-700 tabular-nums">
                          ${producto.costoUnitario.toFixed(2)}
                        </td>
                        {hasDescuento && (
                          <td className="px-2 py-3 text-right text-[11px] text-emerald-600 tabular-nums">
                            -${descuentoPorUd.toFixed(2)}
                          </td>
                        )}
                        {hasImpuesto && (
                          <td className="px-2 py-3 text-right text-[11px] text-amber-600 tabular-nums">
                            +${impuestoPorUnidad.toFixed(2)}
                          </td>
                        )}
                        {hasEnvio && (
                          <td className="px-2 py-3 text-right text-[11px] text-sky-600 tabular-nums">
                            +${envioPorUd.toFixed(2)}
                          </td>
                        )}
                        {hasOtros && (
                          <td className="px-2 py-3 text-right text-[11px] text-slate-500 tabular-nums">
                            +${otrosPorUd.toFixed(2)}
                          </td>
                        )}
                        <td className="px-3 py-3 text-right bg-teal-50">
                          <div className="text-sm font-bold text-teal-800 tabular-nums">${costoRealUnitario.toFixed(2)}</div>
                          <div className="text-[10px] text-teal-600 tabular-nums">S/ {costoRealUnitarioPEN.toFixed(2)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                  <tr>
                    <td className="px-3 py-2 text-sm font-semibold text-slate-700">Total</td>
                    <td className="px-2 py-2 text-center text-sm font-semibold text-slate-700">{totalUnidades}</td>
                    <td className="px-2 py-2 text-right text-sm font-semibold text-slate-700 tabular-nums">${orden.subtotalUSD.toFixed(2)}</td>
                    {hasDescuento && <td className="px-2 py-2 text-right text-[11px] font-semibold text-emerald-700 tabular-nums">-${descuentoTotal.toFixed(2)}</td>}
                    {hasImpuesto && <td className="px-2 py-2 text-right text-[11px] font-semibold text-amber-700 tabular-nums">+${impuestoTotal.toFixed(2)}</td>}
                    {hasEnvio && <td className="px-2 py-2 text-right text-[11px] font-semibold text-sky-700 tabular-nums">+${envioTotal.toFixed(2)}</td>}
                    {hasOtros && <td className="px-2 py-2 text-right text-[11px] font-semibold text-slate-600 tabular-nums">+${otrosTotal.toFixed(2)}</td>}
                    <td className="px-3 py-2 text-right bg-teal-100">
                      <div className="text-base font-bold text-teal-900 tabular-nums">${orden.totalUSD.toFixed(2)}</div>
                      <div className="text-[10px] font-semibold text-teal-700 tabular-nums">S/ {(orden.totalUSD * tc).toFixed(2)}</div>
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Leyenda explicativa */}
              <div className="px-3 py-2 bg-sky-50 border-t border-sky-200">
                <div className="text-[10px] text-sky-600">
                  * Tax uniforme por unidad · Envío, otros y descuento prorrateados por costo base
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Tracking */}
      {orden.numeroTracking && (
        <div className="bg-slate-50 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <Truck className="h-5 w-5 text-slate-600 mr-2" />
            <h4 className="font-semibold text-slate-900">Información de Envío</h4>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-600">Tracking:</span>
              <span className="ml-2 font-mono text-slate-900">{orden.numeroTracking}</span>
            </div>
            {orden.courier && (
              <div>
                <span className="text-slate-600">Courier:</span>
                <span className="ml-2 text-slate-900">{orden.courier}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Almacén y observaciones */}
      {(orden.almacenDestino || orden.observaciones) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orden.almacenDestino && (
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <MapPin className="h-5 w-5 text-slate-600 mr-2" />
                <h4 className="font-semibold text-slate-900">Almacén Destino</h4>
              </div>
              <p className="text-slate-900">
                {orden.nombreAlmacenDestino || orden.almacenDestino}
              </p>
            </div>
          )}
          
          {orden.observaciones && (
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-semibold text-slate-900 mb-2">Observaciones</h4>
              <p className="text-sm text-slate-700">{orden.observaciones}</p>
            </div>
          )}
        </div>
      )}

      {/* Progreso de recepción por producto */}
      {(orden.estado === 'recibida_parcial' || tieneRecepcionesParciales) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-900">Progreso de Recepción</h4>
            <span className="text-sm font-medium text-slate-600">
              {totalRecibido}/{totalOrdenado} unidades ({totalOrdenado > 0 ? ((totalRecibido / totalOrdenado) * 100).toFixed(0) : 0}%)
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${totalRecibido >= totalOrdenado ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${totalOrdenado > 0 ? (totalRecibido / totalOrdenado) * 100 : 0}%` }}
            />
          </div>
          <div className="space-y-2">
            {orden.productos.map(p => {
              const recibido = p.cantidadRecibida || 0;
              const pct = p.cantidad > 0 ? (recibido / p.cantidad) * 100 : 0;
              return (
                <div key={p.productoId} className="flex items-center gap-3 text-sm">
                  <div className="w-40 truncate text-slate-700" title={p.nombreComercial}>{p.nombreComercial}</div>
                  <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="w-24 text-right text-slate-600">
                    <span className={recibido >= p.cantidad ? 'text-emerald-600 font-medium' : ''}>
                      {recibido}/{p.cantidad}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Historial de recepciones */}
          {orden.recepcionesParciales && orden.recepcionesParciales.length > 0 && (
            <div className="border rounded-lg">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <span>Historial de recepciones ({orden.recepcionesParciales.length})</span>
                </div>
                {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showHistory && (
                <div className="border-t divide-y">
                  {orden.recepcionesParciales.map(rec => (
                    <div key={rec.id} className="px-4 py-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-slate-900">Recepción #{rec.numero}</span>
                        <span className="text-xs text-slate-500">{formatDate(rec.fecha)}</span>
                      </div>
                      <div className="text-slate-600">
                        {rec.totalUnidadesRecepcion} unidades: {rec.productosRecibidos.map(pr => {
                          const prod = orden.productos.find(p => p.productoId === pr.productoId);
                          return `${prod?.nombreComercial || pr.productoId} (${pr.cantidadRecibida})`;
                        }).join(', ')}
                      </div>
                      {rec.observaciones && (
                        <div className="text-xs text-slate-500 mt-1">{rec.observaciones}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      </> /* fin del contenido oculto durante confirmación */}

      {/* Acciones */}
      {modoConfirmacion === 'idle' && (
      <div className="flex items-center flex-wrap gap-3 pt-4 border-t">
        {/* Acciones de estado logístico */}
        {getAccionesDisponibles().map(accion => (
          <Button
            key={accion.estado}
            variant="primary"
            onClick={() => onCambiarEstado?.(accion.estado)}
          >
            {accion.label}
          </Button>
        ))}

        {/* Botón de pago — solo después de confirmada */}
        {orden.estado !== 'borrador' && orden.estado !== 'cancelada' && orden.estadoPago !== 'pagado' && onRegistrarPago && (
          <Button
            variant="secondary"
            onClick={onRegistrarPago}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {orden.estadoPago === 'parcial' ? 'Registrar Pago Adicional' : 'Registrar Pago'}
          </Button>
        )}

        {/* Botón de recibir orden */}
        {(['en_transito', 'enviada', 'recibida_parcial'].includes(orden.estado)) && onRecibirOrden && (
          <Button
            variant={orden.estado === 'recibida_parcial' ? 'warning' : 'primary'}
            onClick={onRecibirOrden}
          >
            <Box className="h-4 w-4 mr-2" />
            {orden.estado === 'recibida_parcial' ? 'Recibir Más Productos' : 'Recibir Productos'}
          </Button>
        )}

        {/* Botón revertir recepciones (solo cuando hay recepciones) */}
        {(['recibida_parcial', 'recibida'].includes(orden.estado)) && onRevertirRecepciones && (orden.recepcionesParciales?.length ?? 0) > 0 && (
          <Button
            variant="danger"
            onClick={onRevertirRecepciones}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Revertir Recepciones
          </Button>
        )}
      </div>
      )}
    </div>
  );
};