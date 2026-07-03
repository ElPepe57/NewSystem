/**
 * OrdenCompraCard — detalle de una OC (hoy en Modal size=full · 9 tabs).
 *
 * GOBERNANZA (F0 rework Compras · 2026-06-17): este componente FUE "referencia canónica
 * S54.x" (v6.1), pero el canon visual vigente es el DESIGN SYSTEM + Hub Kit (CLAUDE.md v7.0+).
 * El marcador "NO MODIFICAR" quedó DEROGADO. En rework hacia drill full-page + tab Resumen
 * §A-F + FormModalV2 + lucide (sin emojis) + color Comercial (blue). Validar contra mockup antes de tocar.
 */
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { formatFecha as formatDate } from '../../../utils/dateFormatters';
import { Package, Truck, CreditCard, ChevronLeft, ChevronRight, Layers, Send, Plane, PersonStanding, PackageOpen, TriangleAlert, Brain, History, PenLine, ShieldAlert, LayoutDashboard, GitBranch, ExternalLink, PackageCheck, Wallet, MapPin, AlertOctagon, ShieldCheck, CheckCircle2, Boxes, Split, Flag, Clock, Info, TrendingUp, X } from 'lucide-react';
import { requiereAutorizacionSocio } from '../../../services/autorizacionEgreso.helper';
import { Button } from '../../common';
import { StatusBadge, cn } from '../../../design-system';
// S52 — Capa 3: plantillas canónicas del ERP (ver docs/DESIGN_PATTERNS.md)
import {
  EntityHeader,
  NextActionBanner,
  KpiRow,
  RouteCardV2,
  getFlagFromPais,
  type RouteCardV2Node,
  type RouteCardV2Pill,
  type RouteCardV2Pipeline,
  type RouteCardV2PipelineStep,
} from '../../../design-system';
import type { TimelineStep, NextAction } from '../../common';
import type { OrdenCompra, EstadoOrden, EstadoPagoOC, SubOrdenCompra } from '../../../types/ordenCompra.types';
import { getDescripcionProducto } from '../../../utils/producto.helpers';
import { calcularEstadoDerivadoOC, getCargosEfectivosOC, prorratearCargosOC } from '../../../utils/ordenCompra.helpers';
import { OCLandedCard } from './OCLandedCard';
// S55 Fase 2 — pagos viven en CC; hook reactivo lee desde movimientosCC
import { usePagosOC } from '../../../hooks/usePagosOC';
import { Trash2, Edit3, Ban } from 'lucide-react';
import { SubOrdenCard } from './SubOrdenCard';
import { EnviosDeOC } from './EnviosDeOC';
// F1 · Tab Resumen — envíos reales de la OC (CTA "Recibir envío EN-XXXX" + pill §A + contadores §B)
import { envioCrudService } from '../../../services/envio.crud.service';
import type { Envio } from '../../../types/envio.types';
// F1 · §C Plan vs Real — landed real desde las unidades de la OC (misma fuente que OCLandedCard)
import { unidadService } from '../../../services/unidad.service';
import { resumirLandedOC, type ResumenLandedOC } from '../../../utils/ctru.utils';
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
  /** F4 · firma de socio para autorizar una OC > umbral antes de pagarse. */
  onAutorizar?: () => void;
  /** F4 · ¿el usuario actual es socio? (puede autorizar egresos > umbral). */
  esSocio?: boolean;
  onRefresh?: () => void;
  /** S53.9 — Editar OC borrador. Solo se muestra cuando orden.estado === 'borrador'. */
  onEditarOC?: () => void;
  /** S53.9 — Eliminar OC. Solo visible en borrador (para no romper trazabilidad). */
  onEliminarOC?: () => void;
  /** CANCELACION_OC · F5 — Abre el CancelarOCModal. El padre lo gatea por permiso (canCreateOC)
   *  y solo lo pasa cuando la OC está en un estado cancelable (NO cancelada ni completada). */
  onCancelarOC?: () => void;
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

/** F1 rework detalle OC — tabs según master compras-master-v1.html · Acto 8 (7 tabs).
 *  'resumen' es el default (dashboard ejecutivo §A→§F) · 'productos' fusiona el legacy
 *  Productos + Cargos & Totales ("Productos & Costos") · Documentos y Timeline salieron
 *  de la barra (Timeline vive como drawer flotante · botón Historial en el header). */
type TabOC =
  | 'resumen'
  | 'productos'
  | 'pagos'
  | 'subordenes'
  | 'envios'
  | 'incidencias'
  | 'inteligencia';

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
  onAutorizar,
  esSocio = false,
  onRefresh,
  onEditarOC,
  onEliminarOC,
  onCancelarOC,
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
  // F1 — Tab activo del detalle. Default 'resumen' (master Acto 8 · dashboard ejecutivo §A→§F).
  const [tab, setTab] = useState<TabOC>('resumen');
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
    // Money-path guard: la recepción REAL (congela CTRU + mueve inventario) SOLO
    // ocurre vía el envío vinculado (envioRecepcionService.registrarRecepcion).
    // Marcar 'recibida' aquí sería un bypass que deja la unidad sin costo ni
    // disponibilidad. La sub-orden se sincroniza automáticamente al recibir el envío,
    // así que la recepción manual queda deshabilitada sin excepción.
    if (action === 'recibida') {
      console.warn('[SubOrden] recepción manual deshabilitada: se registra desde el envío vinculado (congela CTRU + inventario)');
      return;
    }
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
        // 'recibida' queda deshabilitado por el guard de arriba (recepción vía envío).
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
  // F4 · ¿esta OC requiere autorización de socio antes de pagarse? (> umbral USD landed y aún sin aprobar)
  const necesitaAutorizacion = requiereAutorizacionSocio(orden.totalUSD || 0) && orden.autorizacion?.estado !== 'aprobado';

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
  const tieneSubs = subOrdenesCount > 0;
  const totalPendienteUSD = Math.max(0, orden.totalUSD - totalPagadoUSD);

  // ═══════════════════════════════════════════════════════════════════════
  // F1 · Tab Resumen — datos reales (master Acto 8)
  // ═══════════════════════════════════════════════════════════════════════

  // Envíos reales de la OC · fetch dirigido (mismo servicio que EnviosDeOC · no clobbea stores).
  const [enviosOC, setEnviosOC] = useState<Envio[]>([]);
  useEffect(() => {
    if (orden.estado === 'borrador' || orden.estado === 'cancelada') {
      setEnviosOC([]);
      return;
    }
    let cancelled = false;
    envioCrudService
      .getByFiltros({ ordenCompraId: orden.id })
      .then((list) => {
        if (!cancelled) setEnviosOC(list);
      })
      .catch(() => {
        if (!cancelled) setEnviosOC([]);
      });
    return () => {
      cancelled = true;
    };
  }, [orden.id, orden.estado]);

  const enviosActivos = useMemo(() => enviosOC.filter((e) => e.estado !== 'cancelada'), [enviosOC]);
  // Envío "no recibido" → destino del CTA "Recibir envío EN-XXXX" del header y de la pill §A.
  const envioPendiente = useMemo(
    () =>
      enviosActivos.find(
        (e) => e.estado !== 'recibida_completa' && e.estado !== 'entregada' && e.estado !== 'perdida_total'
      ) ?? null,
    [enviosActivos]
  );

  // §B · contadores de recepción — recibidas = Σ cantidadRecibida de la OC (fuente autoritativa) ·
  // en tránsito = unidades asignadas a envíos activos aún no recepcionadas · faltante = resto.
  const recepcion = useMemo(() => {
    const recibidas = totalRecibido;
    const enTransito = enviosActivos.reduce(
      (s, e) => s + Math.max(0, (e.totalUnidades || 0) - (e.totalUnidadesRecibidas || 0)),
      0
    );
    const faltante = Math.max(0, totalOrdenado - recibidas - enTransito);
    const pct = totalOrdenado > 0 ? Math.round((recibidas / totalOrdenado) * 100) : 0;
    return { recibidas, enTransito, faltante, pct, total: totalOrdenado };
  }, [enviosActivos, totalOrdenado, totalRecibido]);

  // §A · banner de estado del ciclo — tono + textos por estado (master muestra la variante
  // "en tránsito" en sky · el resto de estados usa el mismo patrón con su tono semántico).
  const ciclo = useMemo(() => {
    const TONOS = {
      amber: { grad: 'from-amber-50 to-amber-100/30', ring: 'ring-amber-200/60', iconBg: 'bg-amber-100', icon: 'text-amber-700', titulo: 'text-amber-900', texto: 'text-amber-700' },
      sky: { grad: 'from-sky-50 to-sky-100/30', ring: 'ring-sky-200/60', iconBg: 'bg-sky-100', icon: 'text-sky-700', titulo: 'text-sky-900', texto: 'text-sky-700' },
      emerald: { grad: 'from-emerald-50 to-emerald-100/30', ring: 'ring-emerald-200/60', iconBg: 'bg-emerald-100', icon: 'text-emerald-700', titulo: 'text-emerald-900', texto: 'text-emerald-700' },
      rose: { grad: 'from-rose-50 to-rose-100/30', ring: 'ring-rose-200/60', iconBg: 'bg-rose-100', icon: 'text-rose-700', titulo: 'text-rose-900', texto: 'text-rose-700' },
    } as const;
    const e = orden.estado;
    if (e === 'cancelada') {
      return { ...TONOS.rose, Icon: Ban, tituloTexto: 'OC cancelada', descTexto: 'El ciclo se cerró sin completar la recepción. El detalle queda como registro histórico.' };
    }
    if (e === 'completada' || e === 'recibida') {
      return { ...TONOS.emerald, Icon: CheckCircle2, tituloTexto: 'Ciclo completo · mercadería recibida', descTexto: `${recepcion.recibidas} de ${recepcion.total} unidades recepcionadas · el costo por unidad quedó congelado (CTRU).` };
    }
    if (e === 'borrador') {
      return { ...TONOS.amber, Icon: Edit3, tituloTexto: 'Borrador sin confirmar', descTexto: 'Confirma la OC para crear las unidades pedidas y el envío de recepción.' };
    }
    if (e === 'confirmada' || e === 'enviada') {
      return { ...TONOS.sky, Icon: Send, tituloTexto: 'OC confirmada · unidades pedidas al proveedor', descTexto: `${recepcion.recibidas} de ${recepcion.total} unidades recepcionadas.${envioPendiente ? ' La recepción se registra sobre el envío vinculado. Próximo paso operativo:' : ''}` };
    }
    // en_proceso / despachada / en_transito / recibida_parcial
    const etaTxt = envioPendiente?.fechaLlegadaEstimada ? ` El envío ${envioPendiente.numeroEnvio} llega estimado ${formatDate(envioPendiente.fechaLlegadaEstimada)}.` : '';
    return {
      ...TONOS.sky,
      Icon: Truck,
      tituloTexto: recepcion.recibidas > 0 ? 'Mercadería en tránsito · recepción parcial pendiente' : 'Mercadería en tránsito · recepción pendiente',
      descTexto: `${recepcion.recibidas} de ${recepcion.total} unidades recepcionadas.${etaTxt}${envioPendiente ? ' Próximo paso operativo:' : ''}`,
    };
  }, [orden.estado, recepcion, envioPendiente]);

  // §A · origen — requerimiento(s) real(es) de la OC (singular legacy o multi-req consolidada).
  const reqNumero = orden.requerimientoNumero || orden.requerimientoNumeros?.[0];
  const reqExtra = Math.max(0, (orden.requerimientoNumeros?.length ?? (orden.requerimientoNumero ? 1 : 0)) - 1);

  // §D · ¿el pago puede registrarse directo? (mismo gating que el CTA del tab Pagos ·
  // si requiere firma de socio, el card enruta al tab Pagos donde vive la autorización).
  const puedeRegistrarPagoDirecto =
    !!onRegistrarPago &&
    orden.estadoPago !== 'pagado' &&
    orden.estado !== 'borrador' &&
    orden.estado !== 'cancelada' &&
    !necesitaAutorizacion;

  // §E · autorización de socio — SOLO si la OC tiene el dato real (orden.autorizacion).
  const autorizacionBanda = useMemo(() => {
    const a = orden.autorizacion;
    if (!a) return null;
    if (a.estado === 'aprobado') {
      const firmasTxt = (a.firmas || [])
        .map((f) => `${f.nombre || 'Socio'} (${formatDate(f.fecha)})`)
        .join(' · ');
      return {
        grad: 'from-emerald-50 to-emerald-100/30', ring: 'ring-emerald-200/60', iconBg: 'bg-emerald-100', icon: 'text-emerald-700', titulo: 'text-emerald-900', texto: 'text-emerald-700',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        Icon: ShieldCheck, BadgeIcon: CheckCircle2,
        tituloTexto: 'Doble firma completa', badgeTexto: 'Autorizada',
        descTexto: `Firmada por ${firmasTxt || 'los socios'} · monto sobre el umbral requería doble firma.`,
      };
    }
    if (a.estado === 'rechazado') {
      return {
        grad: 'from-rose-50 to-rose-100/30', ring: 'ring-rose-200/60', iconBg: 'bg-rose-100', icon: 'text-rose-700', titulo: 'text-rose-900', texto: 'text-rose-700',
        badge: 'bg-rose-50 text-rose-700 border-rose-200',
        Icon: ShieldAlert, BadgeIcon: X,
        tituloTexto: 'Autorización rechazada', badgeTexto: 'Rechazada',
        descTexto: a.motivoRechazo ? `Motivo: ${a.motivoRechazo}` : 'El egreso fue rechazado por un socio · el pago queda bloqueado.',
      };
    }
    return {
      grad: 'from-violet-50 to-violet-100/30', ring: 'ring-violet-200/60', iconBg: 'bg-violet-100', icon: 'text-violet-700', titulo: 'text-violet-900', texto: 'text-violet-700',
      badge: 'bg-violet-50 text-violet-700 border-violet-200',
      Icon: ShieldAlert, BadgeIcon: PenLine,
      tituloTexto: 'Autorización de socios pendiente', badgeTexto: 'Pendiente',
      descTexto: `${(a.firmas || []).length} de 2 firmas registradas · el pago queda bloqueado hasta completar la doble firma.`,
    };
  }, [orden.autorizacion]);

  // §F · mini-stats — próximo hito + ETA (del envío pendiente real · '—' honesto si no hay ETA).
  const { proximoHito, etaTexto } = useMemo(() => {
    const raw: any = envioPendiente?.fechaLlegadaEstimada;
    const etaDate: Date | null = raw ? (typeof raw.toDate === 'function' ? raw.toDate() : new Date(raw)) : null;
    const etaDias = etaDate ? Math.ceil((etaDate.getTime() - Date.now()) / 86400000) : null;
    const eta = etaDias === null ? '—' : etaDias >= 0 ? `${etaDias} día${etaDias === 1 ? '' : 's'}` : `vencida hace ${-etaDias}d`;
    const hito = envioPendiente
      ? `recepción ${envioPendiente.numeroEnvio}${etaDate ? ` · ${formatDate(etaDate)}` : ''}`
      : orden.estado === 'borrador'
        ? 'confirmar OC'
        : orden.estadoPago !== 'pagado' && orden.estado !== 'cancelada'
          ? 'pago del saldo'
          : 'ciclo cerrado';
    return { proximoHito: hito, etaTexto: eta };
  }, [envioPendiente, orden.estado, orden.estadoPago]);

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
      flag: 'PE',
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
        {/* S53.9 — Botones Editar / Eliminar OC (solo en estado borrador) · F1 — se suman
             el botón Historial (Timeline como drawer flotante · ya no es tab) y el CTA
             primary "Recibir envío EN-XXXX" (master Acto 8 · la recepción se registra
             sobre el ENVÍO · el CTA solo enruta al tab Envíos). */}
        <div className="flex items-center justify-end gap-2 mt-3 flex-wrap">
          {orden.estado === 'borrador' && onEditarOC && (
            <button
              type="button"
              onClick={onEditarOC}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Editar OC
            </button>
          )}
          {orden.estado === 'borrador' && onEliminarOC && (
            <button
              type="button"
              onClick={onEliminarOC}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 text-[12px] font-semibold px-3.5 py-2 rounded-lg"
          >
            <History className="w-4 h-4" /> Historial
          </button>
          {envioPendiente && (
            <button
              type="button"
              onClick={() => setTab('envios')}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold px-3.5 py-2 rounded-lg shadow-sm"
            >
              <PackageCheck className="w-4 h-4" /> Recibir envío {envioPendiente.numeroEnvio}
            </button>
          )}
        </div>
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
          F1 — BARRA DE TABS reestructurada al master Acto 8 (L1739-1750).
          7 tabs · Resumen default · "Productos & Costos" fusiona el legacy
          Productos + Cargos · Documentos fuera (era placeholder) · Timeline →
          drawer flotante (botón Historial en el header). Sub-órdenes solo si
          existen (dato condicional). Sticky + flechas de scroll preservados
          (funcionales dentro del Modal · paridad con EnvioDetailModal).
          ════════════════════════════════════════════════════════════════════ */}
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
            'flex gap-1 overflow-x-auto scrollbar-hide',
            tabsFade
          )}
        >
          <TabButtonOC
            active={tab === 'resumen'}
            onClick={() => setTab('resumen')}
            icon={<LayoutDashboard className="w-3.5 h-3.5" />}
            label="Resumen"
          />
          <TabButtonOC
            active={tab === 'productos'}
            onClick={() => setTab('productos')}
            icon={<Package className="w-3.5 h-3.5" />}
            label="Productos & Costos"
          />
          <TabButtonOC
            active={tab === 'pagos'}
            onClick={() => setTab('pagos')}
            icon={<CreditCard className="w-3.5 h-3.5" />}
            label="Pagos"
          />
          {tieneSubs && (
            <TabButtonOC
              active={tab === 'subordenes'}
              onClick={() => setTab('subordenes')}
              icon={<Layers className="w-3.5 h-3.5" />}
              label="Sub-órdenes"
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
            active={tab === 'inteligencia'}
            onClick={() => setTab('inteligencia')}
            icon={<Brain className="w-3.5 h-3.5" />}
            label="Inteligencia"
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          TAB · RESUMEN (F1 · default) — dashboard ejecutivo §A→§F del detalle.
          Pixel del master docs/mockups/compras-master-v1.html · Acto 8 (L1752-1908).
          Datos 100% reales: envíos (envioCrudService) · contadores de recepción de
          la propia OC · Plan vs Real = forecastSnapshot (Lente 2 · expectativa
          congelada al comprar · decisión del titular: NO presupuesto de REQ) vs
          landed real (resumirLandedOC sobre las unidades de la OC).
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'resumen' && (
        <div className="space-y-4">
          {/* §A · Origen + banner estado con next-action */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">§A · Origen &amp; estado del ciclo</span>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-2">
              {/* origen */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <GitBranch className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-[11px] font-bold text-slate-700">Originada por</span>
                </div>
                {reqNumero ? (
                  <>
                    <Link
                      to="/requerimientos"
                      className="flex items-center gap-1.5 text-[13px] font-bold text-purple-700 hover:underline"
                    >
                      {reqNumero}
                      {reqExtra > 0 && <span className="text-[11px] font-semibold text-purple-400">+{reqExtra}</span>}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                    <div className="text-[12px] text-slate-500 mt-0.5">
                      {reqExtra > 0 ? `OC consolidada · ${reqExtra + 1} requerimientos de origen` : 'Requerimiento de origen'}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[13px] font-bold text-slate-700">Compra directa</div>
                    <div className="text-[12px] text-slate-500 mt-0.5">Sin requerimiento de origen</div>
                  </>
                )}
                <div className="text-[11px] text-slate-400 mt-1.5">Creada {formatDate(orden.fechaCreacion)}</div>
              </div>
              {/* banner estado ciclo next-action */}
              <div className={`lg:col-span-2 flex items-start gap-3 bg-gradient-to-r ${ciclo.grad} ring-1 ${ciclo.ring} rounded-2xl p-4`}>
                <div className={`w-10 h-10 rounded-xl ${ciclo.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <ciclo.Icon className={`w-5 h-5 ${ciclo.icon}`} />
                </div>
                <div className="flex-1">
                  <div className={`text-[13px] font-bold ${ciclo.titulo}`}>{ciclo.tituloTexto}</div>
                  <div className={`text-[12px] ${ciclo.texto} mt-0.5`}>{ciclo.descTexto}</div>
                </div>
                {envioPendiente && (
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 self-center">
                    <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap">
                      <Truck className="w-3.5 h-3.5" /> Recepción vía envío {envioPendiente.numeroEnvio}
                    </span>
                    <span className={`text-[11px] tabular-nums font-semibold ${ciclo.texto}`}>
                      {recepcion.recibidas}/{recepcion.total} uds · {Math.max(0, recepcion.total - recepcion.recibidas)} faltan
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* §B · progreso de recepción */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">§B · Progreso de recepción</span>
            <div className="bg-white border border-slate-200 rounded-xl p-4 mt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-slate-700">Unidades recepcionadas</span>
                <span className="text-[12px] tabular-nums text-slate-900">
                  <b className="text-sky-700">{recepcion.recibidas}</b> / {recepcion.total} uds <span className="text-slate-400">· {recepcion.pct}%</span>
                </span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-3 bg-sky-500 rounded-full" style={{ width: `${Math.min(100, recepcion.pct)}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3 text-center">
                <div className="rounded-lg bg-emerald-50 ring-1 ring-emerald-200/50 py-2">
                  <div className="text-[15px] font-bold tabular-nums text-emerald-900">{recepcion.recibidas}</div>
                  <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">Recibidas</div>
                </div>
                <div className="rounded-lg bg-sky-50 ring-1 ring-sky-200/50 py-2">
                  <div className="text-[15px] font-bold tabular-nums text-sky-900">{recepcion.enTransito}</div>
                  <div className="text-[10px] uppercase tracking-wider text-sky-700 font-bold">En tránsito</div>
                </div>
                <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200/60 py-2">
                  <div className="text-[15px] font-bold tabular-nums text-slate-700">{recepcion.faltante}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Faltante</div>
                </div>
              </div>
            </div>
          </div>

          {/* §C · Plan vs Real — expectativa congelada al comprar (forecastSnapshot · Lente 2)
              vs landed real. Decisión del titular: el "plan" NO es presupuesto de REQ. */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">§C · Plan vs Real · expectativa congelada vs landed real</span>
            <PlanVsRealOC orden={orden} />
          </div>

          {/* §D · grid de acciones rápidas */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">§D · Acciones rápidas</span>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-left">
                <Truck className="w-4 h-4 text-blue-700 mb-1.5" />
                <div className="text-[11px] font-bold text-blue-700">
                  {envioPendiente ? `Recepción vía envío ${envioPendiente.numeroEnvio}` : 'Sin recepciones pendientes'}
                </div>
                <div className="text-[10px] text-blue-600 tabular-nums">
                  {envioPendiente
                    ? `${Math.max(0, recepcion.total - recepcion.recibidas)} uds por recibir`
                    : orden.estado === 'borrador'
                      ? 'el envío nace al confirmar la OC'
                      : 'sin envíos activos'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (puedeRegistrarPagoDirecto && onRegistrarPago) onRegistrarPago();
                  else setTab('pagos');
                }}
                disabled={orden.estadoPago === 'pagado'}
                className="bg-white border border-slate-200 rounded-lg p-3 hover:border-emerald-300 hover:bg-emerald-50/30 text-left transition-colors disabled:opacity-60 disabled:hover:border-slate-200 disabled:hover:bg-white"
              >
                <Wallet className="w-4 h-4 text-emerald-600 mb-1.5" />
                <div className="text-[11px] font-bold text-slate-900">Registrar pago</div>
                <div className="text-[10px] text-slate-500 tabular-nums">
                  {orden.estadoPago === 'pagado' ? 'sin saldo pendiente' : `saldo US$ ${totalPendienteUSD.toFixed(0)}`}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setTab('envios')}
                className="bg-white border border-slate-200 rounded-lg p-3 hover:border-purple-300 hover:bg-purple-50/30 text-left transition-colors"
              >
                <MapPin className="w-4 h-4 text-purple-600 mb-1.5" />
                <div className="text-[11px] font-bold text-slate-900">Ver envíos</div>
                <div className="text-[10px] text-slate-500">
                  {envioPendiente ? `envío ${envioPendiente.numeroEnvio}` : 'tracking y recepciones'}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setTab('incidencias')}
                className="bg-white border border-slate-200 rounded-lg p-3 hover:border-rose-300 hover:bg-rose-50/30 text-left transition-colors"
              >
                <AlertOctagon className="w-4 h-4 text-rose-600 mb-1.5" />
                <div className="text-[11px] font-bold text-slate-900">Reportar incidencia</div>
                <div className="text-[10px] text-slate-500">faltante / daño</div>
              </button>
            </div>
          </div>

          {/* §E · banner autorización de socio — SOLO si la OC tiene el dato real */}
          {autorizacionBanda && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">§E · Autorización de socio</span>
              <div className={`flex items-start gap-3 bg-gradient-to-r ${autorizacionBanda.grad} ring-1 ${autorizacionBanda.ring} rounded-2xl p-4 mt-2`}>
                <div className={`w-10 h-10 rounded-xl ${autorizacionBanda.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <autorizacionBanda.Icon className={`w-5 h-5 ${autorizacionBanda.icon}`} />
                </div>
                <div className="flex-1">
                  <div className={`text-[13px] font-bold ${autorizacionBanda.titulo} flex items-center gap-2`}>
                    {autorizacionBanda.tituloTexto}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${autorizacionBanda.badge}`}>
                      <autorizacionBanda.BadgeIcon className="w-2.5 h-2.5" /> {autorizacionBanda.badgeTexto}
                    </span>
                  </div>
                  <div className={`text-[12px] ${autorizacionBanda.texto} mt-0.5`}>{autorizacionBanda.descTexto}</div>
                </div>
              </div>
            </div>
          )}

          {/* §F · mini-stats footer */}
          <div className="bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-4 text-[11px] flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Mini-stats:</span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <Boxes className="w-3.5 h-3.5 text-slate-400" /> <b className="tabular-nums text-slate-800">{totalSKUs}</b> SKUs
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <Split className="w-3.5 h-3.5 text-slate-400" /> <b className="tabular-nums text-slate-800">{subOrdenesCount}</b> sub-órdenes
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <Flag className="w-3.5 h-3.5 text-slate-400" /> Próximo hito: <b className="text-slate-800">{proximoHito}</b>
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> ETA restante: <b className="tabular-nums text-slate-800">{etaTexto}</b>
            </span>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB · SUB-ÓRDENES (condicional)
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'subordenes' && orden.estado !== 'borrador' && orden.subOrdenes && orden.subOrdenes.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
            {/* F3 · chrome del módulo Comercial = blue (master Acto 9 header sub-órdenes · blue-600) */}
            <Layers className="h-4 w-4 text-blue-600" />
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
            Ver CTRU por unidad de esta OC en el módulo CTRU
            <span className="text-slate-500 ml-1">→</span>
          </span>
        </Link>
      )}

      {/* ──────────────────────────────────────────────────────────────────
          F1 · Sub-sección "Costos" del tab fusionado "Productos & Costos"
          (master Acto 8 consolida Productos + Cargos & Totales en una sola
          tab · las secciones se apilan: tabla de productos ↑ · cargos ↓).
          ────────────────────────────────────────────────────────────────── */}

      {/* S42az — Cargos comerciales usando getCargosEfectivosOC.
          Fuente de verdad automática:
          - Si OC tiene sub-órdenes → se agregan desde cada sub-orden (realidad)
          - Si no → se leen de la OC padre (borrador = realidad)
          Un badge indica de dónde vienen los números.

          F3 — Desglose ITEMIZADO por concepto (master Acto 9 · L1992-2058):
          fila por concepto con chip de clase (Cargo=sky · Desc.=emerald · Imp.=purple),
          nota de prorrateo y "Total ajustes". El itemizado sale SIEMPRE de los arrays
          PROPIOS del padre (orden.cargosOC[] / descuentosOC[] / impuestosOC[] · las
          sub-órdenes solo guardan escalares shipping/descuento/impuesto · no conceptos ·
          no se inventa). Si la OC no tiene conceptos (OC simple) la sección itemizada
          NO se renderiza y quedan solo las filas de totales. Cuando el itemizado existe,
          las filas agregadas (+Cargos/−Desc/+Imp) del card de totales se omiten
          (canon no-redundancia · el itemizado las reemplaza con más detalle). */}
      {(() => {
        const efectivos = getCargosEfectivosOC(orden);
        const tcRef = orden.tcReferencial || orden.tcCompra || 0;
        // Itemizado por concepto · arrays v2 del padre (snapshot inmutable de la intención).
        const cargosItems = orden.cargosOC ?? [];
        const descuentosItems = orden.descuentosOC ?? [];
        const impuestosItems = orden.impuestosOC ?? [];
        const hayItemizado = cargosItems.length + descuentosItems.length + impuestosItems.length > 0;
        const sumCargosIt = cargosItems.reduce((s, c) => s + (c.montoUSD || 0), 0);
        const sumDescIt = descuentosItems.reduce((s, d) => s + (d.montoUSD || 0), 0);
        const sumImpIt = impuestosItems.reduce((s, i) => s + (i.montoUSD || 0), 0);
        // Base gravable de los impuestos % (regla del modelo): subtotal + cargos − descuentos.
        const baseGravable = (orden.subtotalUSD ?? 0) + sumCargosIt - sumDescIt;
        const totalAjustes = sumCargosIt - sumDescIt + sumImpIt;
        const fmtUSD = (n: number) =>
          n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const PRORRATEO_LABEL: Record<string, string> = {
          por_valor: 'prorrateo por valor',
          por_cantidad: 'prorrateo por cantidad',
          por_peso: 'prorrateo por peso',
          proporcional: 'prorrateo proporcional',
        };
        return (
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2 flex-wrap">
              <span>
                Ajustes comerciales{' '}
                <span className="normal-case font-normal text-slate-400">
                  (landed cost · cargos − descuentos + impuestos)
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
            {hayItemizado && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 mb-3">
                {efectivos.fuente === 'subOrdenes' && (
                  <div className="text-[10px] text-slate-400 mb-2">
                    desglose por concepto del borrador padre · los totales de abajo se agregan desde las sub-órdenes
                  </div>
                )}
                <div className="space-y-2.5 text-[12px]">
                  {cargosItems.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border bg-sky-50 text-sky-700 border-sky-200">
                          Cargo
                        </span>
                        <div className="min-w-0">
                          <div className="text-slate-600">{c.concepto}</div>
                          <div className="text-[10px] text-slate-400">
                            {PRORRATEO_LABEL[c.metodoProrrateo] ?? c.metodoProrrateo}
                          </div>
                        </div>
                      </div>
                      <span className="tabular-nums font-semibold text-slate-900">
                        USD {fmtUSD(c.montoUSD || 0)}
                      </span>
                    </div>
                  ))}
                  {descuentosItems.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border bg-emerald-50 text-emerald-700 border-emerald-200">
                          Desc.
                        </span>
                        <div className="min-w-0">
                          <div className="text-slate-600">{d.concepto}</div>
                          <div className="text-[10px] text-slate-400">
                            {PRORRATEO_LABEL[d.metodoProrrateo] ?? d.metodoProrrateo}
                          </div>
                        </div>
                      </div>
                      <span className="tabular-nums font-semibold text-emerald-700">
                        −USD {fmtUSD(d.montoUSD || 0)}
                      </span>
                    </div>
                  ))}
                  {impuestosItems.map((imp) => (
                    <div key={imp.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border bg-purple-50 text-purple-700 border-purple-200">
                          Imp.
                        </span>
                        <div className="min-w-0">
                          <div className="text-slate-600">
                            {imp.concepto}
                            {imp.modo === 'porcentaje' && imp.porcentaje != null && (
                              <span className="text-slate-400"> · {imp.porcentaje}% s/ base</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {imp.modo === 'porcentaje'
                              ? `base gravable USD ${fmtUSD(baseGravable)} · subtotal + cargos − descuentos`
                              : 'monto fijo'}
                          </div>
                        </div>
                      </div>
                      <span className="tabular-nums font-semibold text-slate-900">
                        USD {fmtUSD(imp.montoUSD || 0)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                    <span className="text-slate-500">Total ajustes</span>
                    <span className="tabular-nums font-semibold text-slate-700">
                      {totalAjustes >= 0 ? '+' : '−'}USD {fmtUSD(Math.abs(totalAjustes))}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-700">Subtotal productos</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  ${efectivos.subtotalProductos.toFixed(2)}
                </span>
              </div>
              {!hayItemizado && efectivos.cargos > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">+ Cargos (shipping/otros)</span>
                  <span className="tabular-nums text-slate-900">
                    ${efectivos.cargos.toFixed(2)}
                  </span>
                </div>
              )}
              {!hayItemizado && efectivos.descuentos > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">− Descuento</span>
                  <span className="tabular-nums text-emerald-700">
                    -${efectivos.descuentos.toFixed(2)}
                  </span>
                </div>
              )}
              {!hayItemizado && efectivos.impuestos > 0 && (
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

      {/* F3 · Landed total re-home · "¿cuánto gasté en total por esta OC?" (sobre dato saneado A+B).
          Trae de vuelta al detalle el costo aterrizado que vivía expulsado en el módulo CTRU. */}
      {(() => {
        const ef = getCargosEfectivosOC(orden);
        const tcRefL = orden.tcReferencial || orden.tcCompra || 0;
        return <OCLandedCard orden={orden} comercialTotalUSD={ef.total} tcRef={tcRefL} />;
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
      {/* Fin tab 'productos' (Productos & Costos fusionado) */}

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
                orden.estadoPago === 'pagado' ? 'text-slate-400' : 'text-rose-600'
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
            {(necesitaAutorizacion && orden.estado !== 'borrador' && orden.estadoPago !== 'pagado') ? (
              <div className="p-2 border-t border-slate-200">
                {esSocio && onAutorizar ? (
                  <button
                    type="button"
                    onClick={onAutorizar}
                    className="w-full inline-flex items-center justify-center gap-2 text-[13px] font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg py-2 transition-colors"
                  >
                    <PenLine className="h-4 w-4" /> Autorizar pago (firma de socio)
                  </button>
                ) : (
                  <div className="w-full inline-flex items-center justify-center gap-2 text-[12px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg py-2">
                    <ShieldAlert className="h-4 w-4" /> Pendiente de autorización de 2 socios
                  </div>
                )}
              </div>
            ) : (onRegistrarPago && orden.estadoPago !== 'pagado' && orden.estado !== 'borrador' && (
              <div className="p-2 border-t border-slate-200">
                <Button variant="primary" onClick={onRegistrarPago} className="w-full">
                  <CreditCard className="h-4 w-4 mr-2" />
                  {orden.estadoPago === 'parcial' ? 'Registrar pago adicional' : 'Registrar pago'}
                </Button>
              </div>
            ))}
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

      {/* F1 — Tab Documentos ELIMINADA (era placeholder "Próximamente" · el master
          Acto 8 racionaliza la barra a 7 tabs y no la incluye). */}

      {/* ════════════════════════════════════════════════════════════════════
          TAB · INTELIGENCIA (S54 · Tanda 3)
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'inteligencia' && <InteligenciaOCPanel orden={orden} />}

      {/* F1 — Tab Timeline ELIMINADA · el TimelineOCPanel ahora vive en el drawer
          flotante (botón "Historial" del header · ver al final del componente). */}

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

        {/* CANCELACION_OC · F5 — Cancelar OC (danger). Solo en estados cancelables:
            el padre gatea por permiso + estado y solo pasa onCancelarOC entonces.
            Guard defensivo: nunca para 'cancelada' ni 'completada'/'recibida'. */}
        {onCancelarOC && orden.estado !== 'cancelada' && orden.estado !== 'completada' && orden.estado !== 'recibida' && (
          <button
            type="button"
            onClick={onCancelarOC}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
          >
            <Ban className="w-3.5 h-3.5" />
            Cancelar OC
          </button>
        )}

        {/* S54 · T1 — Botón "Registrar Pago" del footer ELIMINADO.
             Redundante: el CTA ahora vive dentro del tab "Pagos" junto
             al historial (contexto natural). */}

        {/* S40 Bloque E: botones "Recibir Productos" y "Revertir Recepciones" eliminados.
            La recepción canónica se hace desde el Envío asociado (ver EnviosDeOC arriba).
            La reversión, si se requiere, se hace vía scripts administrativos. */}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          F1 — TIMELINE COMO DRAWER FLOTANTE (panel lateral derecho + overlay).
          Renderiza el TimelineOCPanel EXISTENTE sin tocarlo por dentro. Se abre
          con el botón "Historial" del header. z-[60] > z-50 del Modal padre.
          ════════════════════════════════════════════════════════════════════ */}
      {showHistory && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={`Timeline de ${orden.numeroOrden}`}>
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setShowHistory(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <History className="w-4 h-4 text-blue-700" />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-slate-900">Timeline</div>
                  <div className="text-[11px] text-slate-500">{orden.numeroOrden}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                aria-label="Cerrar timeline"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <TimelineOCPanel orden={orden} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// F1 — TabButton del detalle de OC · clases literales del master Acto 8 (L1742-1748):
// activo = text-[13px] font-semibold text-blue-700 border-b-2 border-blue-600 + icono ·
// inactivo = text-[13px] text-slate-500 hover:text-slate-700 (sin icono ni badge · el
// master muestra el icono solo en la tab activa y no lleva badges en esta barra).
// ════════════════════════════════════════════════════════════════════════════
const TabButtonOC: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={
      active
        ? 'whitespace-nowrap text-[13px] font-semibold text-blue-700 border-b-2 border-blue-600 px-3 py-2.5 flex items-center gap-1.5'
        : 'whitespace-nowrap text-[13px] text-slate-500 hover:text-slate-700 px-3 py-2.5'
    }
  >
    {active && icon}
    {label}
  </button>
);

// ════════════════════════════════════════════════════════════════════════════
// F1 · §C — PLAN vs REAL del Tab Resumen (master Acto 8 · L1816-1857).
//
// DECISIÓN DEL TITULAR: el "plan" NO es el presupuesto del REQ — es la
// EXPECTATIVA CONGELADA AL COMPRAR (ProductoOrden.forecastSnapshot · Lente 2 ·
// ctruEstimado = landed/unidad estimado en PEN al TC congelado). El "real" es
// el landed aterrizado (resumirLandedOC sobre las unidades de la OC · misma
// fuente que OCLandedCard = cero "dos números"). Todo en PEN (la moneda real
// de ambas fuentes · el master ilustraba en USD).
//
// Desglose del desvío (solo cuando TODA la OC aterrizó y TODOS los SKUs tienen
// snapshot · si no, comparar sería apples-to-oranges):
//   · Tipo de cambio  = Σ(costoUSD×cant) × (tcReal − tcCongelado)
//   · Precio producto = capa producto real − Σ(costoUSD×cant) × tcReal
//   · Flete/aduana    = capas no-producto reales − (esperado − producto al TC congelado)
//     → si el snapshot no reservó nada para flete, se rotula
//       "no estimado en la expectativa" (honestidad del desvío).
//   Invariante: las 3 filas suman exactamente (landed real − esperado).
//
// Estados honestos: sin snapshots → "Sin expectativa congelada (OC previa al
// Lente 2)" · recepción parcial → badge "en curso" (sin % de desvío).
// ════════════════════════════════════════════════════════════════════════════
const fmtPENPlan = (n: number) => `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;

const PlanVsRealOC: React.FC<{ orden: OrdenCompra }> = ({ orden }) => {
  const plan = useMemo(() => {
    const conSnapshot = orden.productos.filter(
      (p) => p.forecastSnapshot?.ctruEstimado != null && p.forecastSnapshot.ctruEstimado > 0
    );
    const esperadoPEN = conSnapshot.reduce(
      (s, p) => s + (p.forecastSnapshot!.ctruEstimado! * (p.cantidad || 0)),
      0
    );
    const productoUSD = conSnapshot.reduce((s, p) => s + (p.costoUnitario || 0) * (p.cantidad || 0), 0);
    const tcCongelado =
      conSnapshot.find((p) => (p.forecastSnapshot!.tcCongelado || 0) > 0)?.forecastSnapshot!.tcCongelado || 0;
    return {
      skus: conSnapshot.length,
      totalSkus: orden.productos.length,
      coberturaTotal: conSnapshot.length === orden.productos.length && conSnapshot.length > 0,
      esperadoPEN,
      productoUSD,
      tcCongelado,
    };
  }, [orden.productos]);

  const puedeCargarLanded = plan.skus > 0 && orden.estado !== 'borrador' && orden.estado !== 'cancelada';
  const [estado, setEstado] = useState<'loading' | 'ok' | 'error'>('loading');
  const [resumen, setResumen] = useState<ResumenLandedOC | null>(null);

  useEffect(() => {
    if (!puedeCargarLanded) return;
    let cancelado = false;
    setEstado('loading');
    unidadService
      .buscar({ ordenCompraId: orden.id })
      .then((unidades) => {
        if (cancelado) return;
        setResumen(resumirLandedOC(unidades));
        setEstado('ok');
      })
      .catch(() => {
        if (!cancelado) setEstado('error');
      });
    return () => {
      cancelado = true;
    };
  }, [orden.id, puedeCargarLanded]);

  // Estado honesto: sin expectativa congelada (OC previa al Lente 2 · no se inventa línea base).
  if (plan.skus === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 mt-2">
        <div className="flex items-start gap-2 text-[12px] text-slate-500">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px text-slate-400" />
          <span>
            <b className="text-slate-600">Sin expectativa congelada</b> · esta OC es previa al Lente 2 (no guardó
            forecast al comprar) · no hay línea base para comparar el landed real.
          </span>
        </div>
      </div>
    );
  }

  // Borrador/cancelada: hay expectativa pero aún no hay unidades → solo el plan.
  if (!puedeCargarLanded) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 mt-2">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Expectativa al comprar</div>
            <div className="text-[17px] font-bold tabular-nums text-slate-700">{fmtPENPlan(plan.esperadoPEN)}</div>
            {!plan.coberturaTotal && (
              <div className="text-[10px] text-slate-400 mt-0.5">cubre {plan.skus} de {plan.totalSkus} SKUs</div>
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Landed real</div>
            <div className="text-[17px] font-bold tabular-nums text-slate-400">—</div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {orden.estado === 'cancelada' ? 'OC cancelada · sin recepción' : 'disponible al confirmar y recibir'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (estado === 'loading') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 mt-2 space-y-2">
        <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
        <div className="h-7 w-44 bg-slate-100 rounded animate-pulse" />
        <div className="h-2.5 w-full bg-slate-100 rounded-full animate-pulse" />
      </div>
    );
  }

  if (estado === 'error' || !resumen) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 mt-2">
        <div className="flex items-start gap-2 text-[12px] text-rose-700">
          <TriangleAlert className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
          <span>No se pudo calcular el landed real de esta OC.</span>
        </div>
      </div>
    );
  }

  const landedPEN = resumen.landedTotalPEN;
  const fullyLanded = resumen.unidadesTotal > 0 && resumen.unidadesConCosto === resumen.unidadesTotal;
  const comparable = fullyLanded && plan.coberturaTotal && plan.esperadoPEN > 0;
  const desvio = comparable ? landedPEN - plan.esperadoPEN : null;
  const desvioPct = desvio !== null ? (desvio / plan.esperadoPEN) * 100 : null;

  // Desglose derivable del snapshot (TC · precio producto · flete/aduana) — solo si comparable.
  const tcReal = orden.tcPago || orden.tcCompra || 0;
  const filasDesvio: Array<{ dot: string; label: string; monto: number }> = [];
  if (desvio !== null) {
    const realNonProd = resumen.capas.impuesto + resumen.capas.flete + resumen.capas.otros;
    if (plan.tcCongelado > 0 && tcReal > 0) {
      const dTC = plan.productoUSD * (tcReal - plan.tcCongelado);
      const dPrecio = resumen.capas.producto - plan.productoUSD * tcReal;
      const planNonProd = plan.esperadoPEN - plan.productoUSD * plan.tcCongelado;
      const dFlete = realNonProd - planNonProd;
      filasDesvio.push({ dot: 'bg-blue-500', label: 'Precio producto', monto: dPrecio });
      filasDesvio.push({
        dot: 'bg-indigo-500',
        label: `Tipo de cambio (${plan.tcCongelado.toFixed(2)} → ${tcReal.toFixed(2)})`,
        monto: dTC,
      });
      filasDesvio.push({
        dot: 'bg-amber-500',
        label: planNonProd < 1 ? 'Flete/aduana · no estimado en la expectativa' : 'Flete & aduana',
        monto: dFlete,
      });
    } else {
      // Sin TC real conocido → no se puede aislar el efecto cambiario (honesto: 2 filas).
      const dProducto = resumen.capas.producto - plan.productoUSD * plan.tcCongelado;
      const planNonProd = plan.esperadoPEN - plan.productoUSD * plan.tcCongelado;
      filasDesvio.push({ dot: 'bg-blue-500', label: 'Precio producto (incluye efecto TC)', monto: dProducto });
      filasDesvio.push({
        dot: 'bg-amber-500',
        label: planNonProd < 1 ? 'Flete/aduana · no estimado en la expectativa' : 'Flete & aduana',
        monto: realNonProd - planNonProd,
      });
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-bold text-slate-900">Desvío del landed</span>
          {desvioPct !== null && desvio !== null ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
                desvio >= 0
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              <TrendingUp className="w-2.5 h-2.5" /> {desvio >= 0 ? '+' : ''}{desvioPct.toFixed(1)}%
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border bg-sky-50 text-sky-700 border-sky-200">
              en curso
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-400">vs expectativa congelada (Lente 2)</span>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Expectativa al comprar</div>
          <div className="text-[17px] font-bold tabular-nums text-slate-700">{fmtPENPlan(plan.esperadoPEN)}</div>
          {!plan.coberturaTotal && (
            <div className="text-[10px] text-slate-400 mt-0.5">cubre {plan.skus} de {plan.totalSkus} SKUs · desvío no comparable</div>
          )}
        </div>
        <div>
          <div className={`text-[10px] uppercase tracking-wider font-bold mb-0.5 ${desvio !== null && desvio >= 0 ? 'text-rose-700' : desvio !== null ? 'text-emerald-700' : 'text-slate-500'}`}>
            Landed real
          </div>
          <div className={`text-[17px] font-bold tabular-nums ${desvio !== null && desvio >= 0 ? 'text-rose-900' : desvio !== null ? 'text-emerald-900' : 'text-slate-700'}`}>
            {resumen.unidadesConCosto > 0 ? fmtPENPlan(landedPEN) : '—'}{' '}
            {desvio !== null && (
              <span className="text-[12px] font-semibold">({desvio >= 0 ? '+' : '−'}{fmtPENPlan(Math.abs(desvio)).replace('S/ ', '')})</span>
            )}
          </div>
          {!fullyLanded && (
            <div className="text-[10px] text-slate-400 mt-0.5">
              {resumen.unidadesConCosto} de {resumen.unidadesTotal} uds aterrizadas · el desvío se consolida al completar la recepción
            </div>
          )}
        </div>
      </div>
      {filasDesvio.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Desglose del desvío</div>
          <div className="space-y-1.5">
            {filasDesvio.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-[12px]">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${f.dot}`} /> {f.label}
                </span>
                <span className={`tabular-nums font-semibold ${f.monto >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {f.monto >= 0 ? '+' : '−'}{fmtPENPlan(Math.abs(f.monto))}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-400">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
        <span>
          <b className="text-slate-500">Plan = expectativa congelada al comprar</b> (forecast Lente 2 · NO el
          presupuesto del REQ). El landed real suma los componentes de costo congelados en la recepción.
        </span>
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