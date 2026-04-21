import React, { useMemo, useState, useCallback } from 'react';
import { formatFecha as formatDate } from '../../../utils/dateFormatters';
import { Package, User, Calendar, DollarSign, MapPin, Truck, Box, TrendingUp, CreditCard, ChevronDown, ChevronUp, Clock, RotateCcw, Layers, CheckCircle2, Send } from 'lucide-react';
import { Badge, Button, StatusTimeline } from '../../common';
import { StatusBadge, cn } from '../../../design-system';
// S52 — Capa 3: plantillas canónicas del ERP (ver docs/DESIGN_PATTERNS.md)
import {
  EntityHeader,
  EntityPipeline,
  type EntityPipelineStep,
  NextActionBanner,
  KpiRow,
  type KpiRowItem,
} from '../../../design-system';
import type { TimelineStep, NextAction } from '../../common';
import type { OrdenCompra, EstadoOrden, EstadoPagoOC, SubOrdenCompra, ProductoOrden } from '../../../types/ordenCompra.types';
import { getDescripcionProducto } from '../../../utils/producto.helpers';
import { calcularEstadoDerivadoOC, getCargosEfectivosOC, prorratearCargosOC } from '../../../utils/ordenCompra.helpers';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { SubOrdenCard } from './SubOrdenCard';
import { EnviosDeOC } from './EnviosDeOC';
import { ConfirmarOCModal } from './ConfirmarOCModal';
import { Link } from 'react-router-dom';
import { Calculator } from 'lucide-react';

interface OrdenCompraCardProps {
  orden: OrdenCompra;
  onCambiarEstado?: (nuevoEstado: EstadoOrden) => void;
  /** Confirma la OC — lo llama ConfirmarOCModal al dar OK, con o sin sub-órdenes. */
  onConfirmarConSubOrdenes?: (subOrdenes?: SubOrdenCompra[]) => void;
  /** S42aq — Abre el ConfirmarOCModal (único flujo de confirmación).
   *  El padre (OrdenesCompra.tsx) lo conecta a setIsConfirmarModalOpen(true). */
  onSolicitarConfirmacion?: () => void;
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
  onSolicitarConfirmacion,
  onRegistrarPago,
  onPagarSubOrden,
  onRefresh
}) => {
  const [showHistory, setShowHistory] = useState(false);
  // Sub-orden lifecycle state: trackingDraft[subId] = { tracking, courier }
  const [trackingDraft, setTrackingDraft] = useState<Record<string, { tracking: string; courier: string }>>({});
  const [subOrdenLoading, setSubOrdenLoading] = useState<Record<string, boolean>>({});
  // S42av — Vista interna del detalle: 'detalle' muestra todo el detalle
  // (pipeline + KPIs + productos + etc.); 'confirmar' reemplaza el cuerpo
  // con el ConfirmarOCModal embedded para un flujo integrado (sin modal
  // sobre modal).
  const [vistaInterna, setVistaInterna] = useState<'detalle' | 'confirmar'>('detalle');
  // Submit flag para pasarlo al embedded ConfirmarOCModal
  const [confirmandoSubs, setConfirmandoSubs] = useState(false);

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
        // S42av — Flujo integrado: al hacer click, cambia la vistaInterna a
        // 'confirmar' y el ConfirmarOCModal se renderiza embedded en el mismo
        // modal de Detalles de Orden. onSolicitarConfirmacion se conserva
        // como fallback para compatibilidad (abre modal separado).
        onClick: (onConfirmarConSubOrdenes || onSolicitarConfirmacion || onCambiarEstado)
          ? () => {
              if (onConfirmarConSubOrdenes) {
                // Flujo integrado por default
                setVistaInterna('confirmar');
              } else if (onSolicitarConfirmacion) {
                onSolicitarConfirmacion();
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

  // S42aw — Ya NO hacemos early return cuando vistaInterna='confirmar'.
  // Mantenemos header + pipeline + KPIs siempre visibles (identidad de la
  // OC persiste). Solo reemplazamos desde el banner CTA hacia abajo.

  return (
    <div className="space-y-5">
      {/* S52 — Header migrado a <EntityHeader> (plantilla Capa 3).
           Preserva breadcrumb Package+numero + título + subtítulo
           proveedor·pais + 2 badges verticales a la derecha.
           Border inferior preservado con wrapper className. */}
      <div className="pb-4 border-b border-slate-100">
        <EntityHeader
          breadcrumb={
            <>
              <Package className="w-3.5 h-3.5" />
              <span>{orden.numeroOrden}</span>
            </>
          }
          titulo={`Orden de compra ${orden.numeroOrden}`}
          subtitulo={
            <>
              {orden.nombreProveedor}
              {orden.paisOrigen && (
                <span className="ml-2 text-slate-400">· {orden.paisOrigen}</span>
              )}
            </>
          }
          badges={
            <div className="flex flex-col items-end gap-1.5">
              <StatusBadge variant={estadoInfo.variant as any} dot size="sm">
                {estadoInfo.label}
              </StatusBadge>
              <StatusBadge variant={estadoPagoInfo.variant as any} size="sm">
                {estadoPagoInfo.label}
              </StatusBadge>
            </div>
          }
        />
      </div>

      {/* S52 — Pipeline migrado a <EntityPipeline> (plantilla Capa 3).
           4 nodos para OC: Borrador → Confirmada → En Despacho → Completada.
           Preserva el mapeo de estado OC → índice + la lógica "→ ?" cuando
           current sin fecha (ver EntityPipeline.tsx). */}
      {!(orden.subOrdenes?.length) && (() => {
        // Mapeo de estado OC a índice del pipeline (4 etapas)
        // 0=Borrador, 1=Confirmada, 2=En Despacho, 3=Completada
        const indexActual =
          orden.estado === 'borrador' ? 0
          : (orden.estado === 'enviada' || orden.estado === 'en_proceso') ? 1
          : (orden.estado === 'despachada' || orden.estado === 'en_transito' || orden.estado === 'recibida_parcial') ? 2
          : (orden.estado === 'recibida' || orden.estado === 'completada') ? 3
          : 0;

        const steps: EntityPipelineStep[] = [
          {
            id: 'borrador',
            label: 'Borrador',
            fecha: orden.fechaCreacion,
            status: indexActual > 0 ? 'completed' : 'current',
          },
          {
            id: 'confirmada',
            label: 'Confirmada',
            fecha: orden.fechaEnviada,
            status: indexActual > 1 ? 'completed' : indexActual === 1 ? 'current' : 'pending',
          },
          {
            id: 'despacho',
            label: 'En Despacho',
            fecha: undefined,
            status: indexActual > 2 ? 'completed' : indexActual === 2 ? 'current' : 'pending',
          },
          {
            id: 'completada',
            label: 'Completada',
            fecha: orden.fechaRecibida,
            status: indexActual === 3 ? 'completed' : 'pending',
          },
        ];

        return <EntityPipeline steps={steps} size="md" />;
      })()}

      {/* S42aw — Cuerpo dinámico: muestra banner+productos+cargos+envío
          cuando vista='detalle', o el ConfirmarOCModal embedded cuando
          vista='confirmar'. Header+pipeline+KPIs (arriba) se mantienen
          fijos en ambos modos para preservar la identidad de la OC. */}
      {vistaInterna === 'confirmar' && onConfirmarConSubOrdenes ? (
        <ConfirmarOCModal
          isOpen={true}
          embedded
          orden={orden}
          onClose={() => setVistaInterna('detalle')}
          onConfirmar={async (subOrdenes) => {
            setConfirmandoSubs(true);
            try {
              await onConfirmarConSubOrdenes(subOrdenes);
              setVistaInterna('detalle');
            } finally {
              setConfirmandoSubs(false);
            }
          }}
          isSubmitting={confirmandoSubs}
        />
      ) : (<>

      {/* S52 — Banner CTA migrado a <NextActionBanner> (plantilla Capa 3).
           Preserva el ícono Send + colores teal + botón variant. Mismo
           comportamiento: dispara vistaInterna='confirmar' en borrador, etc. */}
      {nextAction && nextAction.buttonText && nextAction.onClick && (
        <NextActionBanner
          icon={Send}
          label={nextAction.label}
          description={nextAction.description}
          buttonText={nextAction.buttonText}
          onClick={nextAction.onClick}
          buttonVariant={nextAction.variant === 'primary' ? 'primary' : 'secondary'}
          variant="teal"
        />
      )}

      {/* S52 — 4 KPIs migrados a <KpiRow> (plantilla Capa 3).
           Preserva exactamente el mockup S41 L171-199: bg-slate-50, valores
           centrados, tonos semanticos por celda. La plantilla es la misma
           usada ahora en toda entidad (Envio, Venta, etc.). */}
      <KpiRow
        items={[
          {
            label: 'Total OC',
            value: `$${orden.totalUSD.toFixed(2)}`,
            subtitle: orden.tcCompra
              ? `≈ S/ ${(orden.totalUSD * orden.tcCompra).toFixed(2)}`
              : 'USD',
            tone: 'default',
          },
          {
            label: 'Productos',
            value: `${totalSKUs} SKU${totalSKUs !== 1 ? 's' : ''} · ${totalUnidades} und`,
            tone: 'default',
          },
          {
            label: 'Sub-órdenes',
            value: subOrdenesCount > 0 ? String(subOrdenesCount) : '—',
            subtitle: subOrdenesCount > 0 ? 'divisiones' : 'sin dividir',
            tone: subOrdenesCount > 0 ? 'teal' : 'muted',
          },
          {
            label: 'Pagos',
            value: `$${totalPagadoUSD.toFixed(0)} / $${orden.totalUSD.toFixed(0)}`,
            subtitle:
              estadoPagoInfo.variant === 'success'
                ? 'pagado'
                : estadoPagoInfo.variant === 'warning'
                  ? 'parcial'
                  : 'pendiente',
            tone:
              estadoPagoInfo.variant === 'success'
                ? 'emerald'
                : estadoPagoInfo.variant === 'warning'
                  ? 'amber'
                  : 'red',
          },
        ]}
        columns={4}
      />
      {/* La definición privada de KpiCell (abajo en este archivo) queda
          obsoleta post-refactor S52. Se elimina en cleanup siguiente. */}

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


      {/* S42aq — Wrapper {modoConfirmacion === 'idle'} eliminado: el flujo
          inline se migró al ConfirmarOCModal (un solo modal para confirmar). */}

      {/* S42ao — Cards Fechas+Totales eliminadas: las fechas ya están debajo
          de cada nodo del pipeline arriba, y los totales están en los KPIs +
          la sección "Cargos comerciales" que viene abajo. Mantener aquí sería
          redundante. */}
      {/* Fin del bloque legacy oculto con {false} */}

      {/* S42bd — Tabla Productos con CTRU comercial integrado.
          En vez de una sección separada y pesada, el CTRU unitario se muestra
          como una columna más, con fondo teal sutil para darle importancia
          visual. Si la OC tiene sub-órdenes con cargos desiguales, el valor
          es el promedio ponderado por cantidad entre sub-órdenes (y se marca
          con un badge "~" para indicar que hay variación interna).
          La OC muestra total CTRU landed en el módulo CTRU (link arriba). */}
      {(() => {
        // Pre-computar el prorrateo una sola vez
        const desglose = prorratearCargosOC(orden);

        // Mapa productoId → lista de CTRU comerciales (uno por bloque donde aparezca)
        const ctrusPorProducto = new Map<string, Array<{ ctru: number; cantidad: number }>>();
        for (const bloque of desglose.bloques) {
          for (const prod of bloque.productos) {
            if (!ctrusPorProducto.has(prod.productoId)) {
              ctrusPorProducto.set(prod.productoId, []);
            }
            ctrusPorProducto.get(prod.productoId)!.push({
              ctru: prod.ctruComercialUnitario,
              cantidad: prod.cantidad,
            });
          }
        }

        // Dado un productoId, calcular CTRU ponderado por cantidad
        const getCTRUConsolidado = (productoId: string) => {
          const entradas = ctrusPorProducto.get(productoId) ?? [];
          if (entradas.length === 0) return { valor: 0, variaEntreBloques: false };
          const totalCant = entradas.reduce((s, e) => s + e.cantidad, 0);
          if (totalCant === 0) return { valor: entradas[0].ctru, variaEntreBloques: false };
          const valor = entradas.reduce((s, e) => s + e.ctru * e.cantidad, 0) / totalCant;
          // ¿Los CTRU son distintos entre bloques?
          const variaEntreBloques =
            entradas.length > 1 &&
            entradas.some((e) => Math.abs(e.ctru - entradas[0].ctru) > 0.01);
          return { valor: Number(valor.toFixed(2)), variaEntreBloques };
        };

        return (
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2 flex-wrap">
              <span>Productos ({orden.productos.length})</span>
              <span className="normal-case font-normal text-slate-400">
                · CTRU comercial = precio + cargos prorrateados por valor
              </span>
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
                    <th className="px-4 py-2 text-[11px] font-medium text-teal-700 uppercase tracking-wide text-right bg-teal-50">CTRU/u</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orden.productos.map((p, idx) => {
                    const subtotal = (p.costoUnitario || 0) * (p.cantidad || 0);
                    const descripcion = getDescripcionProducto(p);
                    const ctru = getCTRUConsolidado(p.productoId);
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
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-teal-900 bg-teal-50/40">
                          {ctru.valor > 0 ? (
                            <span className="inline-flex items-baseline gap-1 justify-end">
                              {ctru.variaEntreBloques && (
                                <span
                                  className="text-[10px] text-amber-600 font-semibold"
                                  title="Este producto aparece en varias sub-órdenes con cargos diferentes. Se muestra el promedio ponderado por cantidad. Ver desglose detallado por sub-orden en /ctru."
                                >
                                  ~
                                </span>
                              )}
                              ${ctru.valor.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* S42az — Cargos comerciales usando getCargosEfectivosOC.
          Fuente de verdad automática:
          - Si OC tiene sub-órdenes → se agregan desde cada sub-orden (realidad)
          - Si no → se leen de la OC padre (borrador = realidad)
          Un badge indica de dónde vienen los números. */}
      {(() => {
        const efectivos = getCargosEfectivosOC(orden);
        const tcRef = orden.tcReferencial || orden.tcCompra || 0;
        return (
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2 flex-wrap">
              <span>
                Cargos comerciales{' '}
                <span className="normal-case font-normal text-slate-400">
                  (asignados por el proveedor a esta OC)
                </span>
              </span>
              {efectivos.fuente === 'subOrdenes' && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-semibold border border-teal-200 normal-case"
                  title="Valores agregados desde las sub-órdenes (reflejan cómo el proveedor realmente subdividió la orden)"
                >
                  Agregado de sub-órdenes
                </span>
              )}
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-700">Subtotal productos</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  ${efectivos.subtotalProductos.toFixed(2)}
                </span>
              </div>
              {efectivos.cargos > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">+ Cargos (shipping/otros)</span>
                  <span className="tabular-nums text-slate-900">
                    ${efectivos.cargos.toFixed(2)}
                  </span>
                </div>
              )}
              {efectivos.descuentos > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">− Descuento</span>
                  <span className="tabular-nums text-emerald-700">
                    -${efectivos.descuentos.toFixed(2)}
                  </span>
                </div>
              )}
              {efectivos.impuestos > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">+ Impuestos</span>
                  <span className="tabular-nums text-slate-900">
                    ${efectivos.impuestos.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
                <span className="font-semibold text-slate-900">Total OC</span>
                <span className="text-lg font-bold text-teal-700 tabular-nums">
                  ${efectivos.total.toFixed(2)}
                </span>
              </div>
              {tcRef > 0 && (
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Equivalente PEN (TC {tcRef.toFixed(3)})</span>
                  <span className="tabular-nums">
                    S/ {(efectivos.total * tcRef).toFixed(2)}
                  </span>
                </div>
              )}
              {/* S42az — Reconciliación: si hay sub-órdenes, mostrar el delta vs OC padre */}
              {efectivos.fuente === 'subOrdenes' && Math.abs(efectivos.total - orden.totalUSD) > 0.01 && (
                <div className="border-t border-amber-200 pt-2 mt-2 flex items-center justify-between text-[11px] text-amber-700">
                  <span>OC padre (borrador original)</span>
                  <span className="tabular-nums">
                    ${orden.totalUSD.toFixed(2)} · Δ ${(efectivos.total - orden.totalUSD).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* S42bd — Link discreto al módulo CTRU (solo cuando hay datos allá).
          El CTRU comercial por producto se muestra como columna en la tabla
          de Productos, no como sección aparte (evita saturar el detalle). */}
      {orden.estado !== 'borrador' && orden.estado !== 'cancelada' && (
        <Link
          to={`/ctru?tab=lote&ocId=${orden.id}`}
          className="inline-flex items-center gap-2 text-xs text-teal-700 hover:text-teal-900 hover:bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 transition-colors w-fit"
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>
            Ver CTRU landed histórico de esta OC en el módulo CTRU
            <span className="text-slate-500 ml-1">→</span>
          </span>
        </Link>
      )}

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

      </>)}
      {/* S42aw — Fin del cuerpo dinámico (detalle vs confirmar) */}


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

      {/* S42aq — Fin del contenido. Wrappers modoConfirmacion eliminados. */}

      {/* Acciones */}
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
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// S52 — Componentes privados eliminados post-refactor a Capa 3:
//   - PipelineGrandeOC -> reemplazado por <EntityPipeline> del design-system
//   - KpiCell -> reemplazado por <KpiRow> del design-system
// Ver docs/DESIGN_PATTERNS.md para uso de las plantillas Capa 3.
// ════════════════════════════════════════════════════════════════════════════