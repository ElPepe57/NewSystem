/**
 * REFERENCIA DE DISEÑO CANÓNICA — OrdenCompraCard
 *
 * Este archivo es la FUENTE DE VERDAD del patrón "detalle de entidad" del sistema.
 * Cualquier modal de detalle equivalente en otro módulo (ventas, cotizaciones,
 * maestros, etc.) DEBE replicar este patrón visual.
 *
 * NO MODIFICAR este archivo sin autorización explícita del usuario. Cualquier
 * cambio aquí propaga implícitamente al resto del sistema y puede introducir
 * regresiones en módulos ya alineados.
 *
 * Ver:
 *   - CLAUDE.md → "ACTUALIZACIÓN v6.1 — REFERENCIAS DE DISEÑO CANÓNICAS"
 *   - docs/DESIGN_PATTERNS.md → "Referencias de Diseño Canónicas (S54.x)"
 *   - docs/REGISTRO_IMPLEMENTACION.md → "SESIÓN S54.x — DECISIÓN ESTRATÉGICA"
 *
 * Decisión registrada en sesión S54.x (2026-04-25).
 */
import React, { useMemo, useState, useCallback } from 'react';
import { formatFecha as formatDate } from '../../../utils/dateFormatters';
import { Package, User, Calendar, DollarSign, MapPin, Truck, Box, TrendingUp, CreditCard, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Clock, RotateCcw, Layers, CheckCircle2, Send, Plane, PersonStanding, PackageOpen, Receipt, TriangleAlert, Brain, History, FolderOpen } from 'lucide-react';
import { Badge, Button, StatusTimeline } from '../../common';
import { StatusBadge, cn } from '../../../design-system';
// S52 — Capa 3: plantillas canónicas del ERP (ver docs/DESIGN_PATTERNS.md)
import {
  EntityHeader,
  NextActionBanner,
  KpiRow,
  type KpiRowItem,
  RouteCardV2,
  getFlagFromPais,
  type RouteCardV2Node,
  type RouteCardV2Pill,
  type RouteCardV2Pipeline,
  type RouteCardV2PipelineStep,
} from '../../../design-system';
import type { TimelineStep, NextAction } from '../../common';
import type { OrdenCompra, EstadoOrden, EstadoPagoOC, SubOrdenCompra, ProductoOrden } from '../../../types/ordenCompra.types';
import { getDescripcionProducto } from '../../../utils/producto.helpers';
import { calcularEstadoDerivadoOC, getCargosEfectivosOC, prorratearCargosOC } from '../../../utils/ordenCompra.helpers';
// S55 Fase 2 — pagos viven en CC; hook reactivo lee desde movimientosCC
import { usePagosOC } from '../../../hooks/usePagosOC';
import { Plus, Trash2, AlertTriangle, Edit3 } from 'lucide-react';
import { SubOrdenCard } from './SubOrdenCard';
import { EnviosDeOC } from './EnviosDeOC';
import { ConfirmarOCModal } from './ConfirmarOCModal';
import { IncidenciasOCPanel } from './IncidenciasOCPanel';
import { InteligenciaOCPanel } from './InteligenciaOCPanel';
import { TimelineOCPanel } from './TimelineOCPanel';
import { useHorizontalScrollFade } from '../../../hooks/useHorizontalScrollFade';
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
  /** S53.9 — Editar OC borrador. Solo se muestra cuando orden.estado === 'borrador'. */
  onEditarOC?: () => void;
  /** S53.9 — Eliminar OC. Solo visible en borrador (para no romper trazabilidad). */
  onEliminarOC?: () => void;
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

/** S54 — Tabs del detalle de OC (Tanda 1: migración a tabs). */
type TabOC =
  | 'productos'
  | 'cargos'
  | 'pagos'
  | 'subordenes'
  | 'envios'
  | 'incidencias'
  | 'documentos'
  | 'inteligencia'
  | 'timeline';

/** S54 — Meta del divider "PROGRESO" en RouteCardV2: "Creada 23 abr · Completada 23 abr". */
function buildPipelineMeta(
  fechaCreacion: Parameters<typeof formatDate>[0] | undefined,
  fechaRecibida: Parameters<typeof formatDate>[0] | undefined
): string | undefined {
  const partes: string[] = [];
  if (fechaCreacion) partes.push(`Creada ${formatDate(fechaCreacion)}`);
  if (fechaRecibida) partes.push(`Completada ${formatDate(fechaRecibida)}`);
  return partes.length ? partes.join(' · ') : undefined;
}

export const OrdenCompraCard: React.FC<OrdenCompraCardProps> = ({
  orden,
  onCambiarEstado,
  onConfirmarConSubOrdenes,
  onSolicitarConfirmacion,
  onRegistrarPago,
  onPagarSubOrden,
  onRefresh,
  onEditarOC,
  onEliminarOC,
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
  // S54 — Tab activo dentro del detalle (Tanda 1). Default 'productos'.
  const [tab, setTab] = useState<TabOC>('productos');
  // S54 — Fade dinámico para scroll horizontal de la barra de tabs (V1).
  // Expone scrollPrev/scrollNext + flags para flechas que solo aparecen cuando
  // hay overflow en esa dirección.
  const {
    ref: tabsRef,
    fadeClass: tabsFade,
    canScrollLeft: tabsCanLeft,
    canScrollRight: tabsCanRight,
    scrollPrev: tabsScrollPrev,
    scrollNext: tabsScrollNext,
  } = useHorizontalScrollFade<HTMLDivElement>();

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
  // S55 Fase 2 — Pagos individuales vienen del hook reactivo (CC).
  // El array `pagos` reemplaza el legacy `orden.historialPagos`.
  const { pagos: pagosCC, totalPagadoUSD } = usePagosOC(orden.id);
  const subOrdenesCount = orden.subOrdenes?.length ?? 0;

  // S54 — Tarjeta de ruta V2: proveedor → almacén PE (2 nodos) con pill de
  // modalidad arriba (courier/viajero/DDP/recojo). Datos derivados de la OC.
  const rutaV2 = useMemo(() => {
    const esRecojoEnOrigen = orden.recojoEnOrigen === true;
    const fechaEnviada = orden.fechaEnviada ? formatDate(orden.fechaEnviada) : null;
    const fechaRecibida = orden.fechaRecibida ? formatDate(orden.fechaRecibida) : null;

    // ─── Pill (modalidad + transportador + tracking) ─────────────────────
    let pill: RouteCardV2Pill | undefined;
    const tracking = orden.numeroTracking || undefined;

    if (esRecojoEnOrigen) {
      const colab = orden.colaboradorTransporteNombre;
      pill = {
        icon: <PackageOpen className="w-3 h-3" />,
        text: colab ? `Recojo en origen · ${colab}` : 'Recojo en origen',
        variant: 'amber',
      };
    } else {
      switch (orden.modoEntregaDetallado) {
        case 'ddp_directo':
          pill = {
            icon: <Plane className="w-3 h-3" />,
            text: orden.courier ? `DDP directo · ${orden.courier}` : 'DDP directo',
            variant: 'amber',
            tracking,
          };
          break;
        case 'via_courier':
          pill = {
            icon: <Truck className="w-3 h-3" />,
            text: orden.courier ? `Vía courier · ${orden.courier}` : 'Vía courier',
            variant: 'sky',
            tracking,
          };
          break;
        case 'via_viajero': {
          const colab = orden.colaboradorTransporteNombre;
          pill = {
            icon: <PersonStanding className="w-3 h-3" />,
            text: colab ? `Vía viajero · ${colab}` : 'Vía viajero',
            variant: 'amber',
            tracking,
          };
          break;
        }
        case 'recojo_propio':
          pill = {
            icon: <PackageOpen className="w-3 h-3" />,
            text: 'Recojo propio',
            variant: 'amber',
          };
          break;
        default:
          // Si hay courier + tracking sin modoEntregaDetallado, mostrar igual
          if (orden.courier || orden.numeroTracking) {
            pill = {
              icon: <Truck className="w-3 h-3" />,
              text: orden.courier ? `Transportador · ${orden.courier}` : 'En tránsito',
              variant: 'sky',
              tracking,
            };
          }
      }
    }

    // ─── Nodo origen (proveedor) ─────────────────────────────────────────
    const origenBadge: RouteCardV2Node['badge'] =
      orden.estado === 'borrador'
        ? { label: 'Pendiente', variant: 'slate' }
        : {
            label: fechaEnviada ? `Despachado ${fechaEnviada}` : 'Despachado',
            variant: 'emerald',
          };
    const origen: RouteCardV2Node = {
      flag: getFlagFromPais(orden.paisOrigen),
      nombre: orden.nombreProveedor,
      subtitulo: orden.paisOrigen ? `Proveedor · ${orden.paisOrigen}` : 'Proveedor',
      badge: origenBadge,
    };

    // ─── Nodo destino (almacén PE) ───────────────────────────────────────
    const destinoEnTransito =
      orden.estado === 'en_proceso' ||
      orden.estado === 'despachada' ||
      orden.estado === 'en_transito' ||
      orden.estado === 'recibida_parcial';
    const destinoRecibido =
      orden.estado === 'completada' || orden.estado === 'recibida';
    const destinoBadge: RouteCardV2Node['badge'] = destinoRecibido
      ? {
          label: fechaRecibida ? `Recibido ${fechaRecibida}` : 'Recibido',
          variant: 'emerald',
        }
      : destinoEnTransito
        ? { label: 'En tránsito', variant: 'sky' }
        : { label: 'Pendiente', variant: 'slate' };
    const destino: RouteCardV2Node = {
      flag: '🇵🇪',
      nombre: orden.nombreAlmacenDestino || orden.almacenDestino || 'Almacén Perú',
      subtitulo: 'Almacén final · Perú',
      badge: destinoBadge,
    };

    // ─── Pipeline footer (V-C · S54) ─────────────────────────────────────
    // Solo se muestra cuando NO hay sub-órdenes (cada sub-orden tiene su
    // propio pipeline). Dos ramas: recojo en origen (3 pasos) o flujo
    // normal via casilla/DDP (4 pasos).
    let pipeline: RouteCardV2Pipeline | undefined;
    if (!orden.subOrdenes?.length) {
      const formatOrDash = (ts: typeof orden.fechaCreacion | undefined): string =>
        ts ? formatDate(ts) : '—';

      if (esRecojoEnOrigen) {
        const idx =
          orden.estado === 'borrador'
            ? 0
            : orden.estado === 'recibida' || orden.estado === 'completada'
              ? 2
              : 1;
        const steps: RouteCardV2PipelineStep[] = [
          {
            label: 'Borrador',
            fecha: formatOrDash(orden.fechaCreacion),
            status: idx > 0 ? 'completed' : 'current',
          },
          {
            label: 'Compra física',
            fecha: formatOrDash(orden.fechaEnviada),
            status: idx > 1 ? 'completed' : idx === 1 ? 'current' : 'pending',
          },
          {
            label: 'Completada',
            fecha: formatOrDash(orden.fechaRecibida),
            status: idx === 2 ? 'completed' : 'pending',
          },
        ];
        pipeline = { steps, meta: buildPipelineMeta(orden.fechaCreacion, orden.fechaRecibida) };
      } else {
        const idx =
          orden.estado === 'borrador'
            ? 0
            : orden.estado === 'enviada' || orden.estado === 'en_proceso'
              ? 1
              : orden.estado === 'despachada' ||
                  orden.estado === 'en_transito' ||
                  orden.estado === 'recibida_parcial'
                ? 2
                : orden.estado === 'recibida' || orden.estado === 'completada'
                  ? 3
                  : 0;
        const steps: RouteCardV2PipelineStep[] = [
          {
            label: 'Borrador',
            fecha: formatOrDash(orden.fechaCreacion),
            status: idx > 0 ? 'completed' : 'current',
          },
          {
            label: 'Confirmada',
            fecha: formatOrDash(orden.fechaEnviada),
            status: idx > 1 ? 'completed' : idx === 1 ? 'current' : 'pending',
          },
          {
            label: 'En Despacho',
            fecha: '—',
            status: idx > 2 ? 'completed' : idx === 2 ? 'current' : 'pending',
          },
          {
            label: 'Completada',
            fecha: formatOrDash(orden.fechaRecibida),
            status: idx === 3 ? 'completed' : 'pending',
          },
        ];
        pipeline = { steps, meta: buildPipelineMeta(orden.fechaCreacion, orden.fechaRecibida) };
      }
    }

    return {
      pill,
      origen,
      destino,
      pipeline,
      toneBg: esRecojoEnOrigen ? ('amber' as const) : ('default' as const),
    };
  }, [
    orden.recojoEnOrigen,
    orden.modoEntregaDetallado,
    orden.courier,
    orden.numeroTracking,
    orden.colaboradorTransporteNombre,
    orden.paisOrigen,
    orden.nombreProveedor,
    orden.nombreAlmacenDestino,
    orden.almacenDestino,
    orden.estado,
    orden.fechaCreacion,
    orden.fechaEnviada,
    orden.fechaRecibida,
    orden.subOrdenes,
  ]);

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
        {/* S54 — Tarjeta de ruta V2 (pill modalidad arriba + 2 nodos grandes).
             V-C: incluye el pipeline del ciclo de vida como footer unificado
             dentro de la misma tarjeta (reemplaza el <EntityPipeline> separado). */}
        <div className="mt-4">
          <RouteCardV2
            pill={rutaV2.pill}
            origen={rutaV2.origen}
            destino={rutaV2.destino}
            pipeline={rutaV2.pipeline}
            toneBg={rutaV2.toneBg}
          />
        </div>
        {/* S53.9 — Botones Editar / Eliminar OC (solo en estado borrador).
             Reemplaza los iconos inline de la tabla legacy (OrdenCompraTable). */}
        {orden.estado === 'borrador' && (onEditarOC || onEliminarOC) && (
          <div className="flex items-center justify-end gap-2 mt-3">
            {onEditarOC && (
              <button
                type="button"
                onClick={onEditarOC}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar OC
              </button>
            )}
            {onEliminarOC && (
              <button
                type="button"
                onClick={onEliminarOC}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>

      {/* S54 · V-C — <EntityPipeline> separado ELIMINADO.
           Ahora el pipeline vive como footer unificado dentro de la
           <RouteCardV2> del header (ver `rutaV2.pipeline` arriba). */}

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
           Preserva el ícono Send + colores blue + botón variant. Mismo
           comportamiento: dispara vistaInterna='confirmar' en borrador, etc. */}
      {nextAction && nextAction.buttonText && nextAction.onClick && (
        <NextActionBanner
          icon={Send}
          label={nextAction.label}
          description={nextAction.description}
          buttonText={nextAction.buttonText}
          onClick={nextAction.onClick}
          buttonVariant={nextAction.variant === 'primary' ? 'primary' : 'secondary'}
          variant="blue"
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
            tone: subOrdenesCount > 0 ? 'blue' : 'muted',
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

      {/* ════════════════════════════════════════════════════════════════════
          S54 · Tanda 1 — BARRA DE TABS
          Reorganiza el detalle de OC en pestañas consistentes con Envío.
          Tabs condicionales: Sub-órdenes solo si existen.
          ════════════════════════════════════════════════════════════════════ */}
      {(() => {
        const tieneSubs = !!(orden.subOrdenes && orden.subOrdenes.length > 0);
        const totalPendienteUSD = Math.max(0, orden.totalUSD - totalPagadoUSD);
        const badgePagos =
          estadoPagoInfo.variant === 'success'
            ? undefined
            : `$${totalPendienteUSD.toFixed(0)}`;
        return (
          // S54.x — sticky top-0 para que los tabs sigan visibles mientras el
          // usuario scrollea el contenido del Modal (paridad con EnvioDetailModal).
          <div className="relative border-b border-slate-200 sticky top-0 z-10 bg-white -mx-6 px-6">
            {/* Flecha izquierda (aparece solo si hay scroll ocultable a la izquierda) */}
            {tabsCanLeft && (
              <button
                type="button"
                onClick={tabsScrollPrev}
                aria-label="Desplazar tabs a la izquierda"
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 hover:border-slate-300 text-slate-600 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Flecha derecha (aparece solo si hay scroll oculto a la derecha) */}
            {tabsCanRight && (
              <button
                type="button"
                onClick={tabsScrollNext}
                aria-label="Desplazar tabs a la derecha"
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 hover:border-slate-300 text-slate-600 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            <div
              ref={tabsRef}
              className={cn(
                'flex gap-0 overflow-x-auto scrollbar-hide',
                tabsFade
              )}
            >
            <TabButtonOC
              active={tab === 'productos'}
              onClick={() => setTab('productos')}
              icon={<Package className="w-3.5 h-3.5" />}
              label="Productos"
              badge={orden.productos.length}
              badgeColor="slate"
            />
            <TabButtonOC
              active={tab === 'cargos'}
              onClick={() => setTab('cargos')}
              icon={<Receipt className="w-3.5 h-3.5" />}
              label="Cargos & Totales"
            />
            <TabButtonOC
              active={tab === 'pagos'}
              onClick={() => setTab('pagos')}
              icon={<CreditCard className="w-3.5 h-3.5" />}
              label="Pagos"
              badge={badgePagos}
              badgeColor={estadoPagoInfo.variant === 'warning' ? 'amber' : 'red'}
            />
            {tieneSubs && (
              <TabButtonOC
                active={tab === 'subordenes'}
                onClick={() => setTab('subordenes')}
                icon={<Layers className="w-3.5 h-3.5" />}
                label="Sub-órdenes"
                badge={orden.subOrdenes!.length}
                badgeColor="blue"
              />
            )}
            <TabButtonOC
              active={tab === 'envios'}
              onClick={() => setTab('envios')}
              icon={<Send className="w-3.5 h-3.5" />}
              label="Envíos"
            />
            <TabButtonOC
              active={tab === 'incidencias'}
              onClick={() => setTab('incidencias')}
              icon={<TriangleAlert className="w-3.5 h-3.5" />}
              label="Incidencias"
            />
            <TabButtonOC
              active={tab === 'documentos'}
              onClick={() => setTab('documentos')}
              icon={<FolderOpen className="w-3.5 h-3.5" />}
              label="Documentos"
            />
            <TabButtonOC
              active={tab === 'inteligencia'}
              onClick={() => setTab('inteligencia')}
              icon={<Brain className="w-3.5 h-3.5" />}
              label="Inteligencia"
            />
            <TabButtonOC
              active={tab === 'timeline'}
              onClick={() => setTab('timeline')}
              icon={<History className="w-3.5 h-3.5" />}
              label="Timeline"
            />
            </div>
          </div>
        );
      })()}

      {/* ════════════════════════════════════════════════════════════════════
          TAB · SUB-ÓRDENES (condicional)
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'subordenes' && orden.estado !== 'borrador' && orden.subOrdenes && orden.subOrdenes.length > 0 && (
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

      {/* ════════════════════════════════════════════════════════════════════
          TAB · PRODUCTOS (default)
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'productos' && (<>

      {/* S42bd — Tabla Productos con CTRU comercial integrado.
          En vez de una sección separada y pesada, el CTRU unitario se muestra
          como una columna más, con fondo blue sutil para darle importancia
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
                    <th className="px-4 py-2 text-[11px] font-medium text-blue-700 uppercase tracking-wide text-right bg-blue-50">CTRU/u</th>
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
                          <span className="text-sm font-mono text-blue-700">{p.sku || '—'}</span>
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
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-blue-900 bg-blue-50/40">
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

      {/* S42bd — Link discreto al módulo CTRU (solo cuando hay datos allá).
          El CTRU comercial por producto se muestra como columna en la tabla
          de Productos, no como sección aparte (evita saturar el detalle). */}
      {orden.estado !== 'borrador' && orden.estado !== 'cancelada' && (
        <Link
          to={`/ctru?tab=lote&ocId=${orden.id}`}
          className="inline-flex items-center gap-2 text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 transition-colors w-fit"
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>
            Ver CTRU landed histórico de esta OC en el módulo CTRU
            <span className="text-slate-500 ml-1">→</span>
          </span>
        </Link>
      )}

      </>)}
      {/* Fin tab 'productos' */}

      {/* ════════════════════════════════════════════════════════════════════
          TAB · CARGOS & TOTALES
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'cargos' && (<>

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
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200 normal-case"
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
                <span className="text-lg font-bold text-blue-700 tabular-nums">
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

      {/* S54 · T1 — El link al módulo CTRU se movió al tab 'productos' (contexto natural). */}

      {/* S42ao — Tracking / Envío vinculado (estilo mockup S41 L1075-1138):
          card blue-50 con 4 columnas (Ruta / Courier / Tracking / Despachado). */}
      {orden.numeroTracking && (
        <div>
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Información de envío
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
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
      {/* Fin tab 'cargos' */}

      {/* ════════════════════════════════════════════════════════════════════
          TAB · PAGOS
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'pagos' && (
        <div className="space-y-4">
          {/* Resumen */}
          <div className="grid grid-cols-4 gap-2 bg-slate-50 rounded-xl p-3">
            <div className="text-center">
              <div className="text-[10px] font-semibold uppercase text-slate-500">Total OC</div>
              <div className="text-lg font-bold tabular-nums">${orden.totalUSD.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-semibold uppercase text-slate-500">Pagado</div>
              <div className="text-lg font-bold text-emerald-600 tabular-nums">${totalPagadoUSD.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-semibold uppercase text-slate-500">Pendiente</div>
              <div className={cn(
                'text-lg font-bold tabular-nums',
                orden.estadoPago === 'pagado' ? 'text-slate-400' : 'text-red-600'
              )}>
                ${Math.max(0, orden.totalUSD - totalPagadoUSD).toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-semibold uppercase text-slate-500">Estado</div>
              <div className="pt-1.5">
                <StatusBadge variant={estadoPagoInfo.variant as any} size="sm">
                  {estadoPagoInfo.label}
                </StatusBadge>
              </div>
            </div>
          </div>

          {/* Destinatario del pago (si el deudor es un colaborador, lo explicamos) */}
          {orden.deudorTipo === 'colaborador' && orden.deudorNombre && (
            <div className="p-3 border border-amber-200 bg-amber-50 rounded-lg text-xs">
              <div className="text-[10px] font-semibold uppercase text-amber-700 mb-1">
                Destinatario del pago
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 font-bold text-xs">
                  {orden.deudorNombre.split(' ').map(p => p[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <div className="font-semibold">
                    {orden.deudorNombre}{' '}
                    <span className="text-[10px] font-normal text-amber-700">(colaborador)</span>
                  </div>
                  <div className="text-[10px] text-amber-700">
                    Adelantó el pago a {orden.nombreProveedor} · CxP dirigida al colaborador
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Historial de pagos · S55 Fase 2: lee desde CC */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 tracking-wider flex items-center justify-between">
              <span>Historial de pagos</span>
              <span className="text-slate-400 normal-case font-normal">
                {pagosCC.length} registrado{pagosCC.length !== 1 ? 's' : ''}
              </span>
            </div>
            {pagosCC.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 italic">
                Aún no hay pagos registrados.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase">
                  <tr className="text-left">
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Método</th>
                    <th className="px-3 py-2">Referencia</th>
                    <th className="px-3 py-2 text-right">Monto USD</th>
                    <th className="px-3 py-2 text-right">TC</th>
                    <th className="px-3 py-2 text-right">Equiv. PEN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagosCC.map((pago) => {
                    const tc = pago.tipoCambio || orden.tcPago || orden.tcCompra || 0;
                    const pen = pago.montoPEN || pago.montoUSD * tc;
                    return (
                      <tr key={pago.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 tabular-nums text-xs">
                          {pago.fecha ? formatDate(pago.fecha) : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs">{pago.metodoPago || '—'}</td>
                        <td className="px-3 py-2 text-xs font-mono text-slate-600">
                          {pago.referencia || '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">
                          ${pago.montoUSD.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-slate-500">
                          {tc > 0 ? tc.toFixed(3) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-slate-500">
                          {tc > 0 ? `S/ ${pen.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {onRegistrarPago && orden.estadoPago !== 'pagado' && orden.estado !== 'borrador' && (
              <div className="p-2 border-t border-slate-200">
                <Button variant="primary" onClick={onRegistrarPago} className="w-full">
                  <CreditCard className="h-4 w-4 mr-2" />
                  {orden.estadoPago === 'parcial' ? 'Registrar pago adicional' : 'Registrar pago'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB · ENVÍOS
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'envios' && (
        <div>
          {orden.estado === 'borrador' || orden.estado === 'cancelada' ? (
            <div className="p-8 text-center text-xs text-slate-500 italic border-2 border-dashed border-slate-200 rounded-xl">
              Los envíos aparecerán cuando la OC sea confirmada.
            </div>
          ) : (
            <EnviosDeOC ordenCompraId={orden.id} />
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB · INCIDENCIAS (S54 · Tanda 2)
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'incidencias' && <IncidenciasOCPanel orden={orden} />}

      {/* ════════════════════════════════════════════════════════════════════
          TAB · DOCUMENTOS (placeholder)
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'documentos' && (
        <TabPlaceholderOC
          icon={FolderOpen}
          titulo="Documentos"
          descripcion="Repositorio de facturas, packing lists, certificados de origen y cualquier documento vinculado a esta OC."
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB · INTELIGENCIA (S54 · Tanda 3)
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'inteligencia' && <InteligenciaOCPanel orden={orden} />}

      {/* ════════════════════════════════════════════════════════════════════
          TAB · TIMELINE (S54 · Tanda 3)
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'timeline' && <TimelineOCPanel orden={orden} />}

      </>)}
      {/* S42aw — Fin del cuerpo dinámico (detalle vs confirmar) */}

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

        {/* S54 · T1 — Botón "Registrar Pago" del footer ELIMINADO.
             Redundante: el CTA ahora vive dentro del tab "Pagos" junto
             al historial (contexto natural). */}

        {/* S40 Bloque E: botones "Recibir Productos" y "Revertir Recepciones" eliminados.
            La recepción canónica se hace desde el Envío asociado (ver EnviosDeOC arriba).
            La reversión, si se requiere, se hace vía scripts administrativos. */}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// S54 · Tanda 1 — Placeholder para tabs con contenido pendiente (T2/T3).
// ════════════════════════════════════════════════════════════════════════════
const TabPlaceholderOC: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  descripcion: string;
}> = ({ icon: Icon, titulo, descripcion }) => (
  <div className="flex flex-col items-center justify-center py-12 px-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-center">
    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
      <Icon className="w-6 h-6 text-slate-400" />
    </div>
    <h3 className="text-sm font-semibold text-slate-700 mb-1">{titulo}</h3>
    <p className="text-xs text-slate-500 max-w-md">{descripcion}</p>
    <div className="mt-3 text-[10px] text-slate-400 italic">Próximamente</div>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
// S54 · Tanda 1 — TabButton privado para el detalle de OC.
// Mismo patrón visual que EnvioDetailModal (consistencia cross-entidades).
// ════════════════════════════════════════════════════════════════════════════
const TabButtonOC: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number | string;
  badgeColor?: 'red' | 'amber' | 'slate' | 'blue';
}> = ({ active, onClick, icon, label, badge, badgeColor = 'slate' }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'px-3 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap border-b-2',
      active
        ? 'text-blue-700 border-blue-600'
        : 'text-slate-500 hover:text-slate-700 border-transparent'
    )}
  >
    {icon}
    {label}
    {badge !== undefined && badge !== 0 && badge !== '' && (
      <span
        className={cn(
          'ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
          badgeColor === 'red'
            ? 'bg-red-100 text-red-700'
            : badgeColor === 'amber'
              ? 'bg-amber-100 text-amber-700'
              : badgeColor === 'blue'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-600'
        )}
      >
        {badge}
      </span>
    )}
  </button>
);

// ════════════════════════════════════════════════════════════════════════════
// S52 — Componentes privados eliminados post-refactor a Capa 3:
//   - PipelineGrandeOC -> reemplazado por <EntityPipeline> del design-system
//   - KpiCell -> reemplazado por <KpiRow> del design-system
// Ver docs/DESIGN_PATTERNS.md para uso de las plantillas Capa 3.
// ════════════════════════════════════════════════════════════════════════════