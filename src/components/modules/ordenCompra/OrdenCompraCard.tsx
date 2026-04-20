import React, { useMemo, useState, useCallback } from 'react';
import { formatFecha as formatDate } from '../../../utils/dateFormatters';
import { Package, User, Calendar, DollarSign, MapPin, Truck, Box, TrendingUp, CreditCard, ChevronDown, ChevronUp, Clock, RotateCcw, Layers, CheckCircle2, Send } from 'lucide-react';
import { Badge, Button, StatusTimeline } from '../../common';
import { StatusBadge, cn } from '../../../design-system';
import type { TimelineStep, NextAction } from '../../common';
import type { OrdenCompra, EstadoOrden, EstadoPagoOC, SubOrdenCompra, ProductoOrden } from '../../../types/ordenCompra.types';
import { getDescripcionProducto } from '../../../utils/producto.helpers';
import { calcularEstadoDerivadoOC } from '../../../utils/ordenCompra.helpers';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { SubOrdenCard } from './SubOrdenCard';
import { EnviosDeOC } from './EnviosDeOC';

interface OrdenCompraCardProps {
  orden: OrdenCompra;
  onCambiarEstado?: (nuevoEstado: EstadoOrden) => void;
  onConfirmarConSubOrdenes?: (subOrdenes?: SubOrdenCompra[]) => void;
  onRegistrarPago?: () => void;
  onPagarSubOrden?: (subOrdenId: string) => void;
  onRefresh?: () => void;
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
  parcial: { label: 'Pago Parcial', variant: 'warning' },
  pagado: { label: 'Pagada', variant: 'success' }
};

export const OrdenCompraCard: React.FC<OrdenCompraCardProps> = ({
  orden,
  onCambiarEstado,
  onConfirmarConSubOrdenes,
  onRegistrarPago,
  onPagarSubOrden,
  onRefresh
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [modoConfirmacion, setModoConfirmacion] = useState<'idle' | 'pregunta' | 'subordenes'>('idle');
  const [subOrdenes, setSubOrdenes] = useState<SubOrdenCompra[]>([]);
  // asignacion[productoIdx][subOrdenId] = cantidad asignada
  const [asignacion, setAsignacion] = useState<Record<number, Record<string, number>>>({});
  // Sub-orden lifecycle state: trackingDraft[subId] = { tracking, courier }
  const [trackingDraft, setTrackingDraft] = useState<Record<string, { tracking: string; courier: string }>>({});
  const [subOrdenLoading, setSubOrdenLoading] = useState<Record<string, boolean>>({});

  const handleSubOrdenAction = useCallback(async (
    subOrdenId: string,
    action: 'en_transito' | 'recibida'
  ) => {
    setSubOrdenLoading(prev => ({ ...prev, [subOrdenId]: true }));
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase');

      const draft = trackingDraft[subOrdenId] || { tracking: '', courier: '' };

      const updatedSubs = (orden.subOrdenes || []).map(s => {
        if (s.id !== subOrdenId) return s;
        if (action === 'en_transito') {
          return {
            ...s,
            estado: 'en_transito' as const,
            numeroTracking: draft.tracking || s.numeroTracking,
            courier: draft.courier || s.courier,
            fechaEnvio: new Date()
          };
        }
        if (action === 'recibida') {
          return { ...s, estado: 'recibida' as const, fechaRecepcion: new Date() };
        }
        return s;
      });

      const ocEstado = calcularEstadoDerivadoOC(updatedSubs, orden.estado);

      // Firestore no acepta undefined — limpiar recursivamente
      const clean = (obj: any): any => {
        if (Array.isArray(obj)) return obj.map(clean);
        if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
          const result: any = {};
          for (const [k, v] of Object.entries(obj)) {
            if (v !== undefined) result[k] = clean(v);
          }
          return result;
        }
        return obj;
      };

      await updateDoc(doc(db, 'ordenesCompra', orden.id), {
        subOrdenes: clean(updatedSubs),
        estado: ocEstado
      });

      // Refresh para reflejar cambios en la UI
      onRefresh?.();
    } catch (err) {
      console.error('Error actualizando sub-orden:', err);
    } finally {
      setSubOrdenLoading(prev => ({ ...prev, [subOrdenId]: false }));
    }
  }, [orden.id, orden.subOrdenes, orden.estado, trackingDraft]);


  const estadoInfo = estadoLabels[orden.estado] ?? { label: orden.estado || 'Desconocido', variant: 'secondary' as const, icon: null };
  const estadoPagoInfo = estadoPagoLabels[orden.estadoPago as EstadoPagoOC] ?? estadoPagoLabels.pendiente;

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
        description: 'La recepción se gestiona desde el Envío asociado',
        // S40: Botón "Recibir" eliminado — ver EnviosDeOC arriba
        buttonText: undefined,
        onClick: undefined,
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
        description: 'La recepción se gestiona desde el Envío asociado',
        buttonText: undefined,
        onClick: undefined,
        variant: 'success'
      },
      recibida_parcial: {
        label: 'Recibir M\u00e1s Productos',
        description: 'La recepción se gestiona desde el Envío asociado',
        buttonText: undefined,
        onClick: undefined,
        variant: 'warning'
      }
    };

    return actions[orden.estado];
  }, [orden.estado, onCambiarEstado, onConfirmarConSubOrdenes]);

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

  // S42an — Derivados para KPIs (fila debajo del pipeline, estilo mockup S41)
  const totalSKUs = orden.productos.length;
  const totalUnidades = orden.productos.reduce((s, p) => s + (p.cantidad || 0), 0);
  const totalPagadoUSD = (orden.historialPagos || []).reduce(
    (s, p) => s + (p.montoUSD || 0),
    0
  );
  const subOrdenesCount = orden.subOrdenes?.length ?? 0;

  return (
    <div className="space-y-5">
      {/* S42an — Header estilo mockup S41 SubOrdenDetailModal:
           breadcrumb pequeño + título + nombre proveedor + pills a la derecha. */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-mono">
            <Package className="w-3.5 h-3.5" />
            <span>{orden.numeroOrden}</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">
            Orden de compra {orden.numeroOrden}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {orden.nombreProveedor}
            {orden.paisOrigen && (
              <span className="ml-2 text-slate-400">· {orden.paisOrigen}</span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <StatusBadge variant={estadoInfo.variant as any} dot size="sm">
            {estadoInfo.label}
          </StatusBadge>
          <StatusBadge variant={estadoPagoInfo.variant as any} size="sm">
            {estadoPagoInfo.label}
          </StatusBadge>
        </div>
      </div>

      {/* S42an — Pipeline horizontal grande con fechas (estilo mockup S41 L149-167).
           Reemplaza el StatusTimeline viejo. 5 nodos para OC: Borrador →
           Confirmada → En Proceso → Despachada → Completada. Cada nodo muestra
           su fecha si está completado, "—" si pendiente. */}
      {!(orden.subOrdenes?.length) && (
        <PipelineGrandeOC
          estadoActual={orden.estado}
          fechaBorrador={orden.fechaCreacion}
          fechaConfirmada={orden.fechaEnviada}
          fechaDespachada={undefined}
          fechaCompletada={orden.fechaRecibida}
        />
      )}

      {/* S42ap — Banner CTA de próxima acción (restaurado después de S42an/ao
          que lo había eliminado al quitar StatusTimeline). Usa el nextAction
          ya calculado que resuelve label/description/buttonText/onClick según
          el estado. En borrador muestra "Confirmar OC" y dispara el flujo
          inline de pregunta / división en sub-órdenes. */}
      {nextAction && nextAction.buttonText && nextAction.onClick && modoConfirmacion === 'idle' && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-white border border-teal-200 flex items-center justify-center flex-shrink-0">
              <Send className="w-5 h-5 text-teal-600" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-teal-900">
                {nextAction.label}
              </div>
              {nextAction.description && (
                <div className="text-xs text-teal-700 mt-0.5">
                  {nextAction.description}
                </div>
              )}
            </div>
          </div>
          <Button
            variant={nextAction.variant === 'primary' ? 'primary' : 'secondary'}
            onClick={nextAction.onClick}
            className="flex-shrink-0"
          >
            {nextAction.buttonText}
          </Button>
        </div>
      )}

      {/* S42ao — Fila de 4 KPIs alineada al mockup S41 L171-199:
           container bg-slate-50, sin borders visibles entre celdas, valores
           centrados. Replica fielmente el patrón del SubOrdenDetailModal. */}
      <div className="grid grid-cols-2 md:grid-cols-4 bg-slate-50 rounded-xl py-4 px-2">
        <KpiCell
          label="Total OC"
          value={`$${orden.totalUSD.toFixed(2)}`}
          subtitle={orden.tcCompra ? `≈ S/ ${(orden.totalUSD * orden.tcCompra).toFixed(2)}` : 'USD'}
          tone="default"
        />
        <KpiCell
          label="Productos"
          value={`${totalSKUs} SKU${totalSKUs !== 1 ? 's' : ''} · ${totalUnidades} und`}
          subtitle=""
          tone="default"
        />
        <KpiCell
          label="Sub-órdenes"
          value={subOrdenesCount > 0 ? String(subOrdenesCount) : '—'}
          subtitle={subOrdenesCount > 0 ? 'divisiones' : 'sin dividir'}
          tone={subOrdenesCount > 0 ? 'teal' : 'muted'}
        />
        <KpiCell
          label="Pagos"
          value={`$${totalPagadoUSD.toFixed(0)} / $${orden.totalUSD.toFixed(0)}`}
          subtitle={
            estadoPagoInfo.variant === 'success'
              ? 'pagado'
              : estadoPagoInfo.variant === 'warning'
                ? 'parcial'
                : 'pendiente'
          }
          tone={
            estadoPagoInfo.variant === 'success'
              ? 'emerald'
              : estadoPagoInfo.variant === 'warning'
                ? 'amber'
                : 'red'
          }
          last
        />
      </div>

      {/* Sub-órdenes como interfaz operativa principal */}
      {orden.estado !== 'borrador' && orden.subOrdenes && orden.subOrdenes.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4 text-purple-600" />
            Sub-ordenes ({orden.subOrdenes.length})
          </h4>
          {orden.subOrdenes.map((sub, idx) => (
            <SubOrdenCard
              key={sub.id}
              subOrden={sub}
              index={idx}
              mode="full"
              loading={subOrdenLoading[sub.id] || false}
              onMarcarEnTransito={(id) => handleSubOrdenAction(id, 'en_transito')}
              onRecibirProductos={(id) => handleSubOrdenAction(id, 'recibida')}
              onRegistrarPago={onPagarSubOrden || (onRegistrarPago ? () => onRegistrarPago() : undefined)}
              trackingDraft={trackingDraft[sub.id] || { tracking: sub.numeroTracking || '', courier: sub.courier || '' }}
              onTrackingChange={(draft) => setTrackingDraft(prev => ({ ...prev, [sub.id]: draft }))}
            />
          ))}
        </div>
      )}

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
                  let subtotalProds = 0;
                  orden.productos.forEach((p, idx) => {
                    const qty = newA[idx]?.[sub.id] || 0;
                    if (qty > 0) {
                      prods.push({ ...p, cantidad: qty, subtotal: qty * p.costoUnitario });
                      subtotalProds += qty * p.costoUnitario;
                    }
                  });
                  const totalUSD = subtotalProds - (sub.descuentoUSD || 0) + (sub.shippingUSD || 0) + (sub.impuestoUSD || 0);
                  return { ...sub, productos: prods, subtotalProductosUSD: subtotalProds, totalUSD };
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
                            <span className="text-sm font-bold tabular-nums">${sub.totalUSD.toFixed(2)}</span>
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

                          {/* Costos individuales */}
                          {(() => {
                            const subProd = sub.subtotalProductosUSD || sub.productos.reduce((sum, p) => sum + p.costoUnitario * p.cantidad, 0);
                            const updateSubCost = (field: 'descuentoUSD' | 'shippingUSD' | 'impuestoUSD', val: number) => {
                              setSubOrdenes(prev => prev.map(s => {
                                if (s.id !== sub.id) return s;
                                const sp = s.subtotalProductosUSD || s.productos.reduce((sum, p) => sum + p.costoUnitario * p.cantidad, 0);
                                const updated = { ...s, [field]: val };
                                updated.totalUSD = sp - (updated.descuentoUSD || 0) + (updated.shippingUSD || 0) + (updated.impuestoUSD || 0);
                                return updated;
                              }));
                            };
                            return (
                              <div className="space-y-2">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Costos de esta sub-orden</p>
                                {/* Descuento */}
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-emerald-600 w-16 flex-shrink-0">Descuento</span>
                                  <div className="relative flex-1">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">$</span>
                                    <input type="number" step="0.01" min="0" value={sub.descuentoUSD || ''} onChange={e => updateSubCost('descuentoUSD', parseFloat(e.target.value) || 0)} placeholder="0.00" className="w-full pl-5 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg text-right focus:ring-1 focus:ring-teal-500 tabular-nums" />
                                  </div>
                                </div>
                                {/* Shipping */}
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-sky-600 w-16 flex-shrink-0">Shipping</span>
                                  <div className="relative flex-1">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">$</span>
                                    <input type="number" step="0.01" min="0" value={sub.shippingUSD || ''} onChange={e => updateSubCost('shippingUSD', parseFloat(e.target.value) || 0)} placeholder="0.00" className="w-full pl-5 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg text-right focus:ring-1 focus:ring-teal-500 tabular-nums" />
                                  </div>
                                </div>
                                {/* Tax — toggle %/$ */}
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-amber-600 w-16 flex-shrink-0">Tax</span>
                                  <div className="flex rounded border border-slate-200 overflow-hidden flex-shrink-0">
                                    <button type="button" onClick={() => { const pct = subProd > 0 && (sub.impuestoUSD || 0) > 0 ? ((sub.impuestoUSD || 0) / subProd * 100) : 0; setSubOrdenes(prev => prev.map(s => s.id === sub.id ? { ...s, _taxMode: '%', _taxPct: Math.round(pct * 10) / 10 } as any : s)); }} className={cn('px-1.5 py-1 text-[10px] font-medium', (sub as any)._taxMode === '%' ? 'bg-amber-100 text-amber-700' : 'text-slate-400')}>%</button>
                                    <button type="button" onClick={() => setSubOrdenes(prev => prev.map(s => s.id === sub.id ? { ...s, _taxMode: '$' } as any : s))} className={cn('px-1.5 py-1 text-[10px] font-medium', (sub as any)._taxMode !== '%' ? 'bg-amber-100 text-amber-700' : 'text-slate-400')}>$</button>
                                  </div>
                                  {(sub as any)._taxMode === '%' ? (
                                    <div className="flex items-center gap-1 flex-1">
                                      <div className="relative flex-1">
                                        <input type="number" step="0.1" min="0" max="100" value={(sub as any)._taxPct || ''} onChange={e => { const pct = parseFloat(e.target.value) || 0; const baseImponible = subProd - (sub.descuentoUSD || 0); const monto = Math.round(baseImponible * pct / 100 * 100) / 100; setSubOrdenes(prev => prev.map(s => s.id === sub.id ? (() => { const u = { ...s, impuestoUSD: monto, _taxPct: pct, _taxMode: '%' } as any; u.totalUSD = (u.subtotalProductosUSD || subProd) - (u.descuentoUSD || 0) + (u.shippingUSD || 0) + monto; return u; })() : s)); }} placeholder="0.0" className="w-full pr-6 pl-2 py-1.5 text-xs border border-slate-200 rounded-lg text-right focus:ring-1 focus:ring-teal-500 tabular-nums" />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>
                                      </div>
                                      <span className="text-[10px] text-slate-500 tabular-nums w-16 text-right">= ${(sub.impuestoUSD || 0).toFixed(2)}</span>
                                    </div>
                                  ) : (
                                    <div className="relative flex-1">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">$</span>
                                      <input type="number" step="0.01" min="0" value={sub.impuestoUSD || ''} onChange={e => updateSubCost('impuestoUSD', parseFloat(e.target.value) || 0)} placeholder="0.00" className="w-full pl-5 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg text-right focus:ring-1 focus:ring-teal-500 tabular-nums" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Summary */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            <p className="text-[10px] text-slate-400">{sub.productos.length} productos · {subUnits} uds</p>
                            <div className="text-right text-[10px] text-slate-500 tabular-nums">
                              {sub.subtotalProductosUSD ? `Prod: $${sub.subtotalProductosUSD.toFixed(2)}` : ''}
                              {(sub.descuentoUSD || 0) > 0 && <span className="text-emerald-600 ml-2">-${sub.descuentoUSD?.toFixed(2)}</span>}
                              {(sub.shippingUSD || 0) > 0 && <span className="text-sky-600 ml-2">+${sub.shippingUSD?.toFixed(2)}</span>}
                              {(sub.impuestoUSD || 0) > 0 && <span className="text-amber-600 ml-2">+${sub.impuestoUSD?.toFixed(2)}</span>}
                            </div>
                          </div>
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

                  {/* Validator: sums must match OC totals */}
                  {(() => {
                    const ocDesc = orden.descuentoUSD || 0;
                    const ocTax = orden.impuestoCompraUSD ?? 0;
                    const sumDesc = subOrdenes.reduce((s, so) => s + (so.descuentoUSD || 0), 0);
                    const sumShip = subOrdenes.reduce((s, so) => s + (so.shippingUSD || 0), 0);
                    const sumTax = subOrdenes.reduce((s, so) => s + (so.impuestoUSD || 0), 0);
                    const descMatch = Math.abs(sumDesc - ocDesc) < 0.02;
                    const taxMatch = Math.abs(sumTax - ocTax) < 0.02;
                    const sumTotal = subOrdenes.reduce((s, so) => s + so.totalUSD, 0);
                    const ocTotal = orden.totalUSD;
                    const totalMatch = Math.abs(sumTotal - ocTotal) < 0.05;

                    return (
                      <div className="bg-slate-50 rounded-lg px-3 py-2 space-y-1">
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Validación vs OC original</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] tabular-nums">
                          <span className="text-slate-500">Descuento OC: ${ocDesc.toFixed(2)}</span>
                          <span className={descMatch ? 'text-emerald-600' : 'text-red-600'}>Suma sub: ${sumDesc.toFixed(2)} {descMatch ? '✓' : '✗'}</span>
                          <span className="text-slate-500">Tax OC: ${ocTax.toFixed(2)}</span>
                          <span className={taxMatch ? 'text-emerald-600' : 'text-red-600'}>Suma sub: ${sumTax.toFixed(2)} {taxMatch ? '✓' : '✗'}</span>
                          <span className="text-slate-500">Shipping sub-órdenes:</span>
                          <span className="text-sky-600">${sumShip.toFixed(2)}</span>
                          <span className="text-slate-700 font-semibold">Total OC: ${ocTotal.toFixed(2)}</span>
                          <span className={cn('font-semibold', totalMatch ? 'text-emerald-600' : 'text-red-600')}>Suma sub: ${sumTotal.toFixed(2)} {totalMatch ? '✓' : '✗'}</span>
                        </div>
                      </div>
                    );
                  })()}

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

      {/* S42ao — Cards Fechas+Totales eliminadas: las fechas ya están debajo
          de cada nodo del pipeline arriba, y los totales están en los KPIs +
          la sección "Cargos comerciales" que viene abajo. Mantener aquí sería
          redundante. */}
      {/* Fin del bloque legacy oculto con {false} */}

      {/* S42ao — Tabla Productos limpia alineada al mockup S41 L518-569:
          5 columnas (SKU | Producto | Cant | Precio | Subtotal). Los
          desgloses prorrateados viejos (Desc/Tax/Envío/Otros/Costo Unit)
          quedan absorbidos en la sección "Cargos comerciales" de abajo. */}
      <div>
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Productos ({orden.productos.length})
        </div>
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <th className="px-4 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wide">SKU</th>
                <th className="px-4 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wide">Producto</th>
                <th className="px-4 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wide text-right">Cant.</th>
                <th className="px-4 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wide text-right">Precio</th>
                <th className="px-4 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wide text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orden.productos.map((p, idx) => {
                const subtotal = (p.costoUnitario || 0) * (p.cantidad || 0);
                const descripcion = getDescripcionProducto(p);
                return (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 align-top">
                      <span className="text-sm font-mono text-teal-700">{p.sku || '—'}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-slate-900">{p.nombreComercial || '—'}</div>
                      {descripcion && (
                        <div className="text-[11px] text-slate-500 mt-0.5">{descripcion}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{p.cantidad}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">${(p.costoUnitario || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">${subtotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* S42ao — Cargos comerciales (estilo mockup S41 L858-1010):
          desglose en lista vertical del subtotal + cargos/descuentos/impuestos
          + total + ajuste proveedor + cobrado final. */}
      <div>
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Cargos comerciales{' '}
          <span className="normal-case font-normal text-slate-400">
            (asignados por el proveedor a esta OC)
          </span>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-700">Subtotal productos</span>
            <span className="font-semibold text-slate-900 tabular-nums">
              ${orden.subtotalUSD.toFixed(2)}
            </span>
          </div>
          {(orden.costoEnvioProveedorUSD ?? 0) > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-700">+ Shipping internacional</span>
              <span className="tabular-nums text-slate-900">
                ${(orden.costoEnvioProveedorUSD ?? 0).toFixed(2)}
              </span>
            </div>
          )}
          {(orden.otrosGastosCompraUSD ?? 0) > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-700">+ Otros cargos</span>
              <span className="tabular-nums text-slate-900">
                ${(orden.otrosGastosCompraUSD ?? 0).toFixed(2)}
              </span>
            </div>
          )}
          {(orden.descuentoUSD ?? 0) > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-700">− Descuento</span>
              <span className="tabular-nums text-emerald-700">
                -${(orden.descuentoUSD ?? 0).toFixed(2)}
              </span>
            </div>
          )}
          {(orden.impuestoCompraUSD ?? 0) > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-700">+ Impuestos</span>
              <span className="tabular-nums text-slate-900">
                ${(orden.impuestoCompraUSD ?? 0).toFixed(2)}
              </span>
            </div>
          )}
          <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
            <span className="font-semibold text-slate-900">Total OC</span>
            <span className="text-lg font-bold text-teal-700 tabular-nums">
              ${orden.totalUSD.toFixed(2)}
            </span>
          </div>
          {(orden.tcReferencial || orden.tcCompra) && (
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Equivalente PEN (TC {(orden.tcReferencial || orden.tcCompra || 0).toFixed(3)})</span>
              <span className="tabular-nums">
                S/ {(orden.totalUSD * (orden.tcReferencial || orden.tcCompra || 0)).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* S42ao — Tracking / Envío vinculado (estilo mockup S41 L1075-1138):
          card teal-50 con 4 columnas (Ruta / Courier / Tracking / Despachado). */}
      {orden.numeroTracking && (
        <div>
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Información de envío
          </div>
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              {orden.modoEntregaDetallado && (
                <div>
                  <div className="text-[11px] text-slate-500 mb-1">Modo</div>
                  <div className="font-medium text-slate-800 text-xs">
                    {orden.modoEntregaDetallado}
                  </div>
                </div>
              )}
              {orden.courier && (
                <div>
                  <div className="text-[11px] text-slate-500 mb-1">Courier</div>
                  <div className="font-medium text-slate-800">{orden.courier}</div>
                </div>
              )}
              <div>
                <div className="text-[11px] text-slate-500 mb-1">Tracking</div>
                <div className="font-mono text-slate-800 text-xs break-all">
                  {orden.numeroTracking}
                </div>
              </div>
              {orden.fechaEnviada && (
                <div>
                  <div className="text-[11px] text-slate-500 mb-1">Despachado</div>
                  <div className="font-medium text-slate-800">
                    {formatDate(orden.fechaEnviada)}
                  </div>
                </div>
              )}
            </div>
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

      {/* S40 Bloque E: Envíos de esta OC — fuente canónica de recepción */}
      {!(orden.estado === 'borrador' || orden.estado === 'cancelada') && (
        <EnviosDeOC ordenCompraId={orden.id} />
      )}

      {/* S40 Bloque E: UI "Progreso de Recepción" + "Historial de recepciones" eliminados.
          El progreso de recepción se muestra ahora por envío en EnviosDeOC (arriba).
          Si una OC legacy tiene recepcionesParciales[], su data sigue en el doc pero no
          se visualiza desde la UI nueva. Reportes y contabilidad siguen leyéndola. */}

      </> /* fin del contenido oculto durante confirmación */}

      {/* Acciones */}
      {modoConfirmacion === 'idle' && (
      <div className="flex items-center flex-wrap gap-3 pt-4 border-t">
        {/* Acciones de estado logístico — ocultar si hay sub-ordenes (estado se deriva) */}
        {!(orden.subOrdenes?.length) && getAccionesDisponibles().map(accion => (
          <Button
            key={accion.estado}
            variant="primary"
            onClick={() => onCambiarEstado?.(accion.estado)}
          >
            {accion.label}
          </Button>
        ))}

        {/* Botón de pago a nivel OC completa */}
        {orden.estado !== 'borrador' && orden.estado !== 'cancelada' && orden.estadoPago !== 'pagado' && onRegistrarPago && (
          <Button
            variant="secondary"
            onClick={onRegistrarPago}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {orden.subOrdenes?.length
              ? 'Pagar OC Completa'
              : orden.estadoPago === 'parcial' ? 'Registrar Pago Adicional' : 'Registrar Pago'}
          </Button>
        )}

        {/* S40 Bloque E: botones "Recibir Productos" y "Revertir Recepciones" eliminados.
            La recepción canónica se hace desde el Envío asociado (ver EnviosDeOC arriba).
            La reversión, si se requiere, se hace vía scripts administrativos. */}
      </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// S42an — Componentes internos alineados al estilo mockup S41 SubOrdenDetailModal
// ════════════════════════════════════════════════════════════════════════════

/**
 * PipelineGrandeOC — pipeline horizontal con 4 nodos minimalistas + fechas debajo.
 * Estilo fiel al mockup S41 SubOrdenDetailModal L149-167: círculos 32px con
 * ícono (check / dot / dash), etiqueta pequeña y fecha tabular. Líneas finas
 * entre nodos.
 */
const PipelineGrandeOC: React.FC<{
  estadoActual: EstadoOrden;
  fechaBorrador?: any;
  fechaConfirmada?: any;
  fechaDespachada?: any;
  fechaCompletada?: any;
}> = ({
  estadoActual,
  fechaBorrador,
  fechaConfirmada,
  fechaDespachada,
  fechaCompletada,
}) => {
  // Mapeo de estados a 4 etapas del pipeline:
  //  0 = Borrador | 1 = Confirmada | 2 = En Despacho | 3 = Completada
  const indexActual = (() => {
    if (estadoActual === 'borrador') return 0;
    if (estadoActual === 'enviada' || estadoActual === 'en_proceso') return 1;
    if (
      estadoActual === 'despachada' ||
      estadoActual === 'en_transito' ||
      estadoActual === 'recibida_parcial'
    )
      return 2;
    if (estadoActual === 'recibida' || estadoActual === 'completada') return 3;
    return 0;
  })();

  const steps = [
    { label: 'Borrador', fecha: fechaBorrador },
    { label: 'Confirmada', fecha: fechaConfirmada },
    { label: 'En Despacho', fecha: fechaDespachada },
    { label: 'Completada', fecha: fechaCompletada },
  ];

  const fmt = (d: any): string => {
    if (!d) return '—';
    try {
      const date = typeof d?.toDate === 'function' ? d.toDate() : new Date(d);
      return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
    } catch {
      return '—';
    }
  };

  return (
    <div className="flex items-start justify-between gap-2 py-2">
      {steps.map((step, i) => {
        const completado = i < indexActual;
        const activo = i === indexActual;
        const pendiente = i > indexActual;
        const isLast = i === steps.length - 1;

        return (
          <React.Fragment key={step.label}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                  completado && 'bg-emerald-500 text-white',
                  activo && 'bg-emerald-500 text-white',
                  pendiente && 'bg-slate-200 text-slate-400'
                )}
              >
                {completado && <CheckCircle2 className="w-4 h-4" strokeWidth={3} />}
                {activo && (
                  <span className="w-2 h-2 rounded-full bg-white" />
                )}
                {pendiente && <span className="text-xs">—</span>}
              </div>
              <div
                className={cn(
                  'text-xs font-medium mt-2 text-center whitespace-nowrap',
                  completado && 'text-slate-700',
                  activo && 'text-slate-900',
                  pendiente && 'text-slate-400'
                )}
              >
                {step.label}
              </div>
              <div
                className={cn(
                  'text-[11px] mt-0.5 tabular-nums',
                  completado && 'text-slate-500',
                  activo && 'text-slate-500',
                  pendiente && 'text-slate-300'
                )}
              >
                {activo && !step.fecha ? `${fmt(fechaConfirmada)} → ?` : fmt(step.fecha)}
              </div>
            </div>
            {!isLast && (
              <div
                className={cn(
                  'flex-1 h-0.5 mt-4 rounded-full transition-colors',
                  i < indexActual ? 'bg-emerald-400' : 'bg-slate-200'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/**
 * KpiCell — celda de un KPI dentro de la fila de 4 KPIs superiores.
 * Con border-right entre celdas (excepto la última) para replicar el
 * divisor visual del mockup S41 L171-199.
 */
const KpiCell: React.FC<{
  label: string;
  value: string;
  subtitle?: string;
  tone?: 'default' | 'teal' | 'amber' | 'emerald' | 'red' | 'muted';
  last?: boolean;
}> = ({ label, value, subtitle, tone = 'default' }) => {
  const valueColor = {
    default: 'text-slate-900',
    teal: 'text-teal-700',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
    red: 'text-red-700',
    muted: 'text-slate-400',
  }[tone];

  return (
    <div className="px-2 py-1 text-center">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={cn('text-xl font-bold tabular-nums', valueColor)}>
        {value}
      </div>
      {subtitle && (
        <div className="text-[11px] text-slate-400 mt-0.5">{subtitle}</div>
      )}
    </div>
  );
};