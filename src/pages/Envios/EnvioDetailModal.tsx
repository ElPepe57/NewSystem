/**
 * REFERENCIA DE DISEÑO CANÓNICA — EnvioDetailModal
 *
 * Este archivo es la FUENTE DE VERDAD del patrón "detalle con scroll y muchos tabs" del
 * sistema. Cualquier modal con 5+ tabs o contenido extenso en otro módulo DEBE replicar
 * este patrón visual.
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
import React, { useState, useMemo } from 'react';
import {
  X,
  CheckCircle,
  AlertTriangle,
  Truck,
  Package,
  ChevronRight,
  ExternalLink,
  FileText,
  Clock,
  DollarSign,
  Edit3,
  PackageCheck,
  RefreshCw,
  Banknote,
  Printer,
  Building2,
  Plane,
  Hash,
  Copy,
  Users,
} from 'lucide-react';
import { Modal, Badge, Button } from '../../components/common';
import type { Envio, EstadoEnvio, TipoEnvio, EstadoSubEnvio, SubEnvioT1 } from '../../types/envio.types';
import type { Producto } from '../../types/producto.types';
import { getDescripcionProducto } from '../../utils/producto.helpers';
import { cn } from '../../design-system';
// S52 — Capa 3: plantillas canónicas del ERP (ver docs/DESIGN_PATTERNS.md)
import {
  EntityHeader,
  EntityPipeline,
  type EntityPipelineStep,
  NextActionBanner,
  KpiRow,
  RouteCardV2,
  getFlagFromPais,
  type RouteCardV2Node,
  type RouteCardV2Pill,
  type RouteCardV2Pipeline,
  type RouteCardV2PipelineStep,
} from '../../design-system';
import { PersonStanding, PackageOpen, User as UserIcon, Warehouse, ChevronLeft, TrendingUp } from 'lucide-react';
import { useHorizontalScrollFade } from '../../hooks/useHorizontalScrollFade';
import { UserName } from './UserName';
import { GestionIncidenciasModal } from './GestionIncidenciasModal';
import { LiberarAduanaModal } from './LiberarAduanaModal';
import { useToastStore } from '../../store/toastStore';
import { getEmojiPorProducto } from '../../components/modules/ordenCompra/OCWizardV3/productoEmoji';
// S45 — Sub-envíos T1 (tandas del proveedor · D-3)
import { SubEnviosTimeline, type SubEnviosTimelineProductoMeta } from './SubEnviosT1';
import type { AgregarTandaModalResult } from './SubEnviosT1';
import { envioCrudService } from '../../services/envio.crud.service';
import { isSubenviosT1Enabled, isCostosScopeV2Enabled } from '../../config/features';
// S47 — Clasificación tipo de ruta A-J (Modelo Envíos Transversal)
import {
  deriveTipoRutaLogistica,
  INFO_TIPO_RUTA,
  badgeClassForTipoRuta,
} from '../../utils/envio.tipoRuta.helpers';
// BUG-INC-006/007/008 fix (S54.x) — Helper para distinguir entre
// "esperando llegada" vs "esperando gestión de incidencia" en el envío.
import { recalcularEstadoEnvio } from '../../utils/envio.estado.helpers';
// S46 — Costos landed con scope + cierre financiero (D-17, D-18)
import {
  CostosLandedPanel,
  type AgregarCostoLandedModalResult,
} from './CostosLandedScope';
import { useTipoCambio } from '../../hooks/useTipoCambio';
// S55 Fase 4 — pagos a colaborador viven en CC; hook reactivo
import { usePagosEnvio } from '../../hooks/usePagosEnvio';

// ════════════════════════════════════════════════════════════════════════════
// EnvioDetailModal — S41 Tanda 8 (reescritura completa alineada al mockup S40)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Estructura fiel al mockup `rework-maestro-s40.html` pane-detalle:
 *
 *   Header enriquecido (gradient slate):
 *     - Ícono + número + estado pill + subtítulo con link a OC
 *     - Botones Imprimir / Registrar recepción / cerrar
 *     - Ruta horizontal grande 3-nodos con badge por nodo
 *     - 5 KPIs rápidos (Unidades / Recibidas / Pendientes / Incidencias / Progreso)
 *
 *   Tabs internos:
 *     - Productos (default) — tabla con emoji + SKU + chip marca + progress
 *     - Recepciones — timeline con icono por estado
 *     - Costos landed — desglose + total prorrateado
 *     - Incidencias — lista consolidada (rojo si hay)
 *     - Timeline — historial del envío
 *
 *   Grid 2-col: contenido del tab + sidebar sticky
 *
 *   Sidebar:
 *     - Courier
 *     - Colaborador con avatar iniciales
 *     - OC vinculada (card clickable)
 *     - Fecha creación
 *     - Acciones rápidas
 */

interface EnvioDetailModalProps {
  envio: Envio;
  productosMap: Map<string, Producto>;
  userId: string | undefined;
  onClose: () => void;
  onConfirmar: (id: string) => void;
  onEnviar: (id: string) => void;
  onIniciarRecepcion: (envio: Envio) => void;
  onAbrirPagoColaborador: (envio: Envio) => void;
  onAbrirEditFlete: (envio: Envio) => void;
  onReconciliarPago: (envio: Envio) => void;
}

// S45 — Tab 'tandas' solo visible para envíos T1 (casos A/B/D) cuando flag activa
type TabActivo = 'productos' | 'recepciones' | 'costos' | 'pagos' | 'incidencias' | 'tandas' | 'documentos' | 'inteligencia' | 'timeline';

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

export const EnvioDetailModal: React.FC<EnvioDetailModalProps> = ({
  envio,
  productosMap,
  userId,
  onClose,
  onConfirmar,
  onEnviar,
  onIniciarRecepcion,
  onAbrirPagoColaborador,
  onAbrirEditFlete,
  onReconciliarPago,
}) => {
  const [tab, setTab] = useState<TabActivo>('productos');
  // S55 Fase 4 — Pagos al colaborador del envío (CC). Reemplaza envio.pagosColaborador[].
  const { pagos: pagosColaboradorCC } = usePagosEnvio(envio.id);
  // S54 — Fade + flechas para scroll horizontal de la barra de tabs (V1).
  const {
    ref: tabsRef,
    fadeClass: tabsFade,
    canScrollLeft: tabsCanLeft,
    canScrollRight: tabsCanRight,
    scrollPrev: tabsScrollPrev,
    scrollNext: tabsScrollNext,
  } = useHorizontalScrollFade<HTMLDivElement>();
  const [showGestionIncidencias, setShowGestionIncidencias] = useState(false);
  const [showLiberarAduana, setShowLiberarAduana] = useState(false);
  const [liberandoAduana, setLiberandoAduana] = useState(false);
  const toast = useToastStore();

  // ─── Derivados ──────────────────────────────────────────────────────────
  const esInternacional = envio.tipo === 'internacional_peru';
  // S47 — Tipo ruta A-J derivado (reemplaza el chip "Entrega directa" aislado)
  const tipoRuta = deriveTipoRutaLogistica(envio);
  const infoRuta = tipoRuta ? INFO_TIPO_RUTA[tipoRuta] : null;
  const incidenciasArr = envio.incidencias || [];
  const incidenciasAbiertas = incidenciasArr.filter((i) => !i.resuelta);
  const tieneAduanaPendiente = incidenciasArr.some(
    (inc) => !inc.resuelta && inc.tipo === 'aduana'
  );
  const recepciones = envio.recepciones || [];
  const totalRecibidas =
    envio.totalUnidadesRecibidas ?? envio.unidades?.filter((u) => u.estadoEnvio === 'recibida').length ?? 0;
  const totalDanadas =
    envio.totalUnidadesDanadas ?? envio.unidades?.filter((u) => u.estadoEnvio === 'danada').length ?? 0;
  const totalFaltantes = envio.totalUnidadesFaltantes || 0;
  const totalUnidades = envio.totalUnidades || 0;
  const totalPendientes = Math.max(0, totalUnidades - totalRecibidas - totalDanadas - totalFaltantes);
  const progreso =
    totalUnidades > 0 ? Math.round(((totalRecibidas + totalDanadas) / totalUnidades) * 100) : 0;

  // S47 — OCs consolidadas: para T1 es el OC único del envío; para T2/J todavía
  // no hay campo explícito (diferido a S48). Por ahora usamos ordenCompraId
  // cuando existe; si el picking fue multi-OC quedará '—' hasta que el modelo
  // almacene el listado (ver MODELO_ENVIOS_TRANSVERSAL.md §4).
  const ocsConsolidadas = envio.ordenCompraId ? 1 : 0;

  // S47 — Valor landed USD (para el badge del header)
  const valorLandedUSD = (envio.productosSummary ?? []).reduce(
    (sum, p) => sum + ((p as { costoTotalUSD?: number }).costoTotalUSD || 0),
    0
  );

  const diasEnTransito = envio.fechaSalida
    ? Math.floor((Date.now() - envio.fechaSalida.toDate().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // S54 — Mapeo Envío → RouteCardV2 (pill modalidad + 2 nodos grandes).
  // S42bg — El pill arriba solo usa `envio.courier` (transportador comercial real
  // como DHL/FedEx/Shalom, seteado al DESPACHAR). `colaboradorNombre` cae al
  // pill con variant amber solo cuando es el transportador físico del envío
  // (viajero/traslado interno). El colaborador "dueño de casilla" sigue
  // visible en la sidebar derecha "COLABORADOR".
  // La casilla intermedia real existiría como 3er nodo en envíos tipo C con
  // consolidación multi-origen → por ahora siempre 2 nodos (estructura
  // actual del tipo Envio no tiene "casilla de paso" explícita distinta del
  // origen y destino). Si aparece en futuro, pasar `intermedio={...}`.
  const rutaV2 = useMemo(() => {
    const fechaSalida = envio.fechaSalida
      ? new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' }).format(
          envio.fechaSalida.toDate()
        )
      : null;
    const fechaLlegada = envio.fechaLlegadaReal
      ? new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' }).format(
          envio.fechaLlegadaReal.toDate()
        )
      : null;

    // ─── Pill: transportador + tracking ────────────────────────────────
    let pill: RouteCardV2Pill | undefined;
    // Tracking se pasa como prop dedicada (clickable copiable en la pill).
    const tracking = envio.numeroTracking || undefined;

    if (envio.courier) {
      // Transportador comercial real (DHL, FedEx, Shalom, etc.) → sky
      pill = {
        icon: <Truck className="w-3 h-3" />,
        text: `Transportador · ${envio.courier}`,
        variant: 'sky',
        tracking,
      };
    } else if (envio.colaboradorNombre && envio.colaboradorTipo === 'viajero') {
      // Viajero colaborador → amber
      pill = {
        icon: <PersonStanding className="w-3 h-3" />,
        text: `Viajero · ${envio.colaboradorNombre}`,
        variant: 'amber',
        tracking,
      };
    } else if (envio.colaboradorNombre) {
      // Otro colaborador transportista → amber
      pill = {
        icon: <PackageOpen className="w-3 h-3" />,
        text: `Traslado · ${envio.colaboradorNombre}`,
        variant: 'amber',
        tracking,
      };
    }
    // else: pill queda undefined → RouteCardV2 muestra "Sin transportador asignado"

    // ─── Nodo origen ──────────────────────────────────────────────────
    const origenEstadoDone =
      envio.estado !== 'borrador' && envio.estado !== 'confirmado';
    let origen: RouteCardV2Node;
    if (envio.origenTipo === 'proveedor') {
      origen = {
        flag: getFlagFromPais(envio.origenProveedorPais),
        nombre: envio.origenProveedorNombre || 'Proveedor',
        subtitulo: envio.origenProveedorPais
          ? `Proveedor · ${envio.origenProveedorPais}`
          : 'Proveedor',
        badge: origenEstadoDone
          ? {
              label: fechaSalida ? `Despachado ${fechaSalida}` : 'Despachado',
              variant: 'emerald',
            }
          : { label: 'Pendiente', variant: 'slate' },
      };
    } else if (envio.origenTipo === 'cliente') {
      origen = {
        icon: <UserIcon className="w-4 h-4 text-teal-600" />,
        nombre: envio.origenClienteNombre || 'Cliente',
        subtitulo: 'Cliente origen',
        badge: origenEstadoDone
          ? {
              label: fechaSalida ? `Despachado ${fechaSalida}` : 'Despachado',
              variant: 'emerald',
            }
          : { label: 'Pendiente', variant: 'slate' },
      };
    } else {
      // origenTipo === 'casilla' (default)
      origen = {
        flag: envio.origenCasillaPais
          ? getFlagFromPais(envio.origenCasillaPais)
          : '🌐',
        nombre: envio.origenCasillaNombre || 'Casilla Origen',
        subtitulo: [
          envio.origenCasillaCodigo,
          envio.origenCasillaPais ? `Casilla · ${envio.origenCasillaPais}` : 'Casilla',
        ]
          .filter(Boolean)
          .join(' · '),
        badge: origenEstadoDone
          ? {
              label: fechaSalida ? `Despachado ${fechaSalida}` : 'Despachado',
              variant: 'emerald',
            }
          : { label: 'Pendiente', variant: 'slate' },
      };
    }

    // ─── Nodo destino ─────────────────────────────────────────────────
    const destinoRecibido = envio.estado === 'recibida_completa';
    const destinoEnTransito =
      envio.estado === 'en_transito' || envio.estado === 'recibida_parcial';
    const destinoBadge: RouteCardV2Node['badge'] = destinoRecibido
      ? {
          label: fechaLlegada ? `Recibido ${fechaLlegada}` : 'Recibido',
          variant: 'emerald',
        }
      : destinoEnTransito
        ? {
            label: envio.estado === 'recibida_parcial' ? 'Recepción parcial' : 'En tránsito',
            variant: 'sky',
          }
        : { label: 'Pendiente', variant: 'slate' };

    let destino: RouteCardV2Node;
    if (envio.destinoTipo === 'cliente') {
      destino = {
        icon: <UserIcon className="w-4 h-4 text-teal-600" />,
        nombre: envio.destinoClienteNombre || 'Cliente',
        subtitulo: envio.destinoClienteDistrito
          ? `Cliente · ${envio.destinoClienteDistrito}`
          : 'Cliente destino',
        badge: destinoBadge,
      };
    } else if (envio.destinoTipo === 'almacen_tercero') {
      destino = {
        icon: <Warehouse className="w-4 h-4 text-amber-600" />,
        nombre: envio.destinoCasillaNombre || 'Almacén tercero',
        subtitulo: envio.destinoCasillaPais
          ? `Almacén tercero · ${envio.destinoCasillaPais}`
          : 'Almacén tercero',
        badge: destinoBadge,
      };
    } else {
      // destinoTipo === 'casilla' (default) — incluye almacén propio identificado como casilla
      destino = {
        flag: envio.destinoCasillaPais
          ? getFlagFromPais(envio.destinoCasillaPais)
          : '🌐',
        nombre: envio.destinoCasillaNombre || 'Destino',
        subtitulo: [
          envio.destinoCasillaCodigo,
          envio.destinoCasillaPais
            ? `Casilla · ${envio.destinoCasillaPais}`
            : 'Casilla',
        ]
          .filter(Boolean)
          .join(' · '),
        badge: destinoBadge,
      };
    }

    // ─── Pipeline footer (V-C · S54 E1) ────────────────────────────────
    // 4 pasos canónicos: Borrador → Confirmado → En tránsito → Recibida.
    // Estados especiales (cancelada, retenida_aduana, perdida_total) se
    // reflejan con badges adicionales en el nodo relevante (fuera del
    // pipeline), no como pasos separados.
    const formatDateOrDash = (ts?: { toDate: () => Date }): string =>
      ts
        ? new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' }).format(ts.toDate())
        : '—';

    const indexEstado =
      envio.estado === 'borrador' ? 0
      : envio.estado === 'confirmado' ? 1
      : envio.estado === 'en_transito' || envio.estado === 'retenida_aduana' ? 2
      : envio.estado === 'recibida_parcial' ? 2
      : envio.estado === 'recibida_completa' ? 3
      : envio.estado === 'cancelada' ? -1
      : envio.estado === 'perdida_total' ? -1
      : 0;

    const pasos: RouteCardV2PipelineStep[] = [
      {
        label: 'Borrador',
        fecha: formatDateOrDash(envio.fechaCreacion),
        status: indexEstado > 0 ? 'completed' : indexEstado === 0 ? 'current' : 'skipped',
      },
      {
        label: 'Confirmado',
        fecha: formatDateOrDash(envio.fechaConfirmacion),
        status: indexEstado > 1 ? 'completed' : indexEstado === 1 ? 'current' : indexEstado < 0 ? 'skipped' : 'pending',
      },
      {
        label: envio.estado === 'retenida_aduana' ? 'Aduana' : 'En tránsito',
        fecha: formatDateOrDash(envio.fechaSalida),
        status: indexEstado > 2 ? 'completed' : indexEstado === 2 ? 'current' : indexEstado < 0 ? 'skipped' : 'pending',
      },
      {
        label: envio.estado === 'recibida_parcial' ? 'Recepción parcial' : 'Recibida',
        fecha: formatDateOrDash(envio.fechaLlegadaReal),
        status: indexEstado === 3 ? 'completed' : indexEstado === 2 && envio.estado === 'recibida_parcial' ? 'current' : indexEstado < 0 ? 'skipped' : 'pending',
      },
    ];

    const metaPartes: string[] = [];
    if (envio.fechaCreacion) metaPartes.push(`Creado ${formatDateOrDash(envio.fechaCreacion)}`);
    if (envio.fechaLlegadaReal) metaPartes.push(`Recibido ${formatDateOrDash(envio.fechaLlegadaReal)}`);
    const pipeline: RouteCardV2Pipeline = {
      steps: pasos,
      meta: metaPartes.length ? metaPartes.join(' · ') : undefined,
    };

    return { pill, origen, destino, pipeline };
  }, [
    envio.estado,
    envio.fechaCreacion,
    envio.fechaConfirmacion,
    envio.fechaSalida,
    envio.fechaLlegadaReal,
    envio.courier,
    envio.numeroTracking,
    envio.colaboradorNombre,
    envio.colaboradorTipo,
    envio.origenTipo,
    envio.origenProveedorNombre,
    envio.origenProveedorPais,
    envio.origenCasillaNombre,
    envio.origenCasillaCodigo,
    envio.origenCasillaPais,
    envio.origenClienteNombre,
    envio.destinoTipo,
    envio.destinoCasillaNombre,
    envio.destinoCasillaCodigo,
    envio.destinoCasillaPais,
    envio.destinoClienteNombre,
    envio.destinoClienteDistrito,
    envio.fechaSalida,
    envio.fechaLlegadaReal,
  ]);

  // ─── Handlers ───────────────────────────────────────────────────────────
  const handleLiberarAduana = async (data: {
    unidadIds: string[];
    gastosLiberacionPEN: number;
    documentoLiberacion?: string;
    descripcion?: string;
  }) => {
    if (!userId) {
      toast.error('Usuario no identificado');
      return;
    }
    setLiberandoAduana(true);
    try {
      const { envioRecepcionService } = await import('../../services/envio.recepcion.service');
      await envioRecepcionService.liberarUnidadesAduana(
        envio.id,
        data.unidadIds,
        data.gastosLiberacionPEN,
        userId,
        data.documentoLiberacion,
        data.descripcion
      );
      toast.success(`${data.unidadIds.length} unidad(es) liberadas de aduana`);
      setShowLiberarAduana(false);
      onClose();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      toast.error('Error al liberar aduana: ' + msg);
    } finally {
      setLiberandoAduana(false);
    }
  };

  const copyTracking = async () => {
    if (envio.numeroTracking) {
      try {
        await navigator.clipboard.writeText(envio.numeroTracking);
        toast.success('Tracking copiado');
      } catch {}
    }
  };

  // ─── Badges de tabs ─────────────────────────────────────────────────────
  const badgesTab = useMemo(
    () => ({
      productos: envio.productosSummary?.length ?? 0,
      recepciones: recepciones.length,
      costos: 0, // TODO: costos landed count
      incidencias: incidenciasAbiertas.length,
      tandas: envio.subEnvios?.length ?? 0,
      timeline: 0,
    }),
    [envio.productosSummary, recepciones, incidenciasAbiertas, envio.subEnvios]
  );

  // ─── S45: Tab "Tandas" visible solo para envíos T1 (A/B/D) con flag activa ─
  const subenviosT1Flag = useMemo(() => isSubenviosT1Enabled(), []);
  const esEnvioT1 = envio.origenTipo === 'proveedor';
  const mostrarTabTandas = subenviosT1Flag && esEnvioT1 && envio.estado !== 'cancelada';

  // Metadata de productos para el SubEnviosTimeline (desnormalizada del envío)
  const productosMetaTandas: Record<string, SubEnviosTimelineProductoMeta> = useMemo(() => {
    const map: Record<string, SubEnviosTimelineProductoMeta> = {};
    for (const p of envio.productosSummary ?? []) {
      const { emoji } = getEmojiPorProducto({
        nombreComercial: p.nombre,
        marca: p.marca ?? '',
        atributosSkincare: p.atributosSkincare,
      });
      map[p.productoId] = {
        productoId: p.productoId,
        nombre: p.nombre,
        emoji,
      };
    }
    return map;
  }, [envio.productosSummary]);

  // ─── Handlers de sub-tandas (S45) ───────────────────────────────────────
  const handleAgregarTanda = async (result: AgregarTandaModalResult) => {
    if (!userId) {
      toast.error('Usuario no autenticado');
      return;
    }
    try {
      await envioCrudService.crearSubTandaT1(
        envio.id,
        {
          unidadesIds: result.unidadesIds,
          tipo: 'normal',
          estado: result.estadoInicial,
          numeroTrackingProveedor: result.numeroTrackingProveedor,
          fechaEstimadaEntrega: result.fechaEstimadaEntrega,
        },
        userId
      );
      toast.success('Tanda creada correctamente');
      // El padre que abrió este modal re-fetchea el envío; el componente se re-renderiza
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear tanda';
      toast.error(msg);
      throw err; // deja que el modal maneje su loading
    }
  };

  const handleTransicionarTanda = async (subEnvioId: string, nuevoEstado: EstadoSubEnvio) => {
    if (!userId) {
      toast.error('Usuario no autenticado');
      return;
    }
    try {
      await envioCrudService.transicionarSubEnvio(envio.id, subEnvioId, nuevoEstado, userId, {
        ...(nuevoEstado === 'en_transito' ? { fechaDespachoProveedor: new Date() } : {}),
        ...(nuevoEstado === 'entregado' ? { fechaEntrega: new Date() } : {}),
      });
      toast.success(`Tanda marcada como ${nuevoEstado.replace('_', ' ')}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al transicionar tanda';
      toast.error(msg);
    }
  };

  // S46 — Flag + TC para el panel de costos
  const costosScopeFlag = useMemo(() => isCostosScopeV2Enabled(), []);
  const { tc } = useTipoCambio();

  // S52 — Próxima acción contextual según estado del envío (estándar OC).
  // Reemplaza el botón "Registrar recepción" que antes vivía en el header.
  // Ver docs/DESIGN_PATTERNS.md → Patrón 4 (NextActionBanner).
  const nextActionEnvio = useMemo((): {
    icon: typeof CheckCircle;
    label: string;
    description: string;
    buttonText: string;
    onClick: () => void;
    variant: 'teal' | 'sky' | 'amber' | 'emerald';
  } | null => {
    switch (envio.estado) {
      case 'borrador':
        return {
          icon: CheckCircle,
          label: 'Confirmar envío',
          description: 'Valida los detalles del envío antes del despacho',
          buttonText: 'Confirmar',
          onClick: () => onConfirmar(envio.id),
          variant: 'teal',
        };
      case 'confirmado':
        return {
          icon: Truck,
          label: 'Despachar envío',
          description: 'Registra tracking y marca en camino al transportador',
          buttonText: 'Despachar',
          onClick: () => onEnviar(envio.id),
          variant: 'sky',
        };
      case 'en_transito':
        return {
          icon: PackageCheck,
          label: 'Registrar recepción',
          description: 'Procesa las unidades recibidas y actualiza el stock',
          buttonText: 'Recepcionar',
          onClick: () => onIniciarRecepcion(envio),
          variant: 'emerald',
        };
      case 'recibida_parcial': {
        // BUG-INC-006/007/008 fix (S54.x) — Antes este case mostraba
        // siempre "Registrar recepción adicional" aunque no hubiera unidades
        // por llegar (solo quedaban incidencias por gestionar). Ahora
        // distinguimos los 2 casos:
        //  · Hay unidades en tránsito esperando llegada → CTA "Recepcionar"
        //  · No hay pendientes pero sí incidencias activas → CTA "Gestionar incidencias"
        //  · Ninguna de las anteriores → no mostrar banner (algo raro pasó)
        const calc = recalcularEstadoEnvio(envio.unidades, envio.incidencias);
        if (calc.hayUnidadesEsperandoLlegada) {
          return {
            icon: PackageCheck,
            label: 'Registrar recepción adicional',
            description: `Aún quedan ${calc.totalPendientes} unidad${calc.totalPendientes !== 1 ? 'es' : ''} pendiente${calc.totalPendientes !== 1 ? 's' : ''} — procesá la siguiente tanda`,
            buttonText: 'Recepcionar',
            onClick: () => onIniciarRecepcion(envio),
            variant: 'amber',
          };
        }
        if (calc.hayIncidenciasActivas) {
          const incidenciasActivas = (envio.incidencias || []).filter((i) => !i.resuelta).length;
          return {
            icon: AlertTriangle,
            label: 'Gestionar incidencias pendientes',
            description: `${incidenciasActivas} incidencia${incidenciasActivas !== 1 ? 's' : ''} sin resolver. Decidí qué hacer con cada unidad afectada.`,
            buttonText: 'Gestionar',
            onClick: () => setShowGestionIncidencias(true),
            variant: 'amber',
          };
        }
        // Estado raro: parcial pero sin pendientes ni incidencias activas.
        // El estado debería recalcularse a 'recibida_completa' en la próxima
        // operación que toque el envío.
        return null;
      }
      case 'retenida_aduana':
        return {
          icon: AlertTriangle,
          label: 'Liberar unidades de aduana',
          description: 'Registra los gastos de liberación y libera las unidades',
          buttonText: 'Liberar',
          onClick: () => setShowLiberarAduana(true),
          variant: 'amber',
        };
      default:
        // recibida_completa / cancelada / perdida_total — sin acción
        return null;
    }
  }, [envio, onConfirmar, onEnviar, onIniciarRecepcion]);

  // Handlers de costos landed (S46)
  const handleAgregarCosto = async (result: AgregarCostoLandedModalResult) => {
    if (!userId) {
      toast.error('Usuario no autenticado');
      return;
    }
    try {
      await envioCrudService.agregarCostoLanded(
        envio.id,
        {
          categoriaCostoId: `cat-${Date.now()}`,
          categoriaCostoNombre: result.categoriaCostoNombre,
          descripcion: result.descripcion,
          monto: result.monto,
          moneda: result.moneda,
          montoPEN:
            result.moneda === 'USD'
              ? result.monto * (result.tipoCambio ?? 1)
              : result.monto,
          tipoCambio: result.tipoCambio,
          metodoProrrateo: result.metodoProrrateo,
          scope: result.scope,
          tandaId: result.tandaId,
          estado: result.estado,
          facturaReferencia: result.facturaReferencia,
          motivoEstimado: result.motivoEstimado,
          pagado: false,
        },
        userId
      );
      toast.success('Costo agregado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al agregar costo');
      throw err;
    }
  };

  const handleConfirmarCosto = async (costoId: string) => {
    if (!userId) {
      toast.error('Usuario no autenticado');
      return;
    }
    try {
      await envioCrudService.confirmarCostoLanded(envio.id, costoId, {}, userId);
      toast.success('Costo confirmado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al confirmar');
    }
  };

  const handleFinalizarCostos = async () => {
    if (!userId) {
      toast.error('Usuario no autenticado');
      return;
    }
    try {
      await envioCrudService.finalizarCostosLanded(envio.id, userId);
      toast.success('Costos finalizados · CTRU definitivo aplicado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al finalizar');
    }
  };

  const handleReabrirCostos = async () => {
    if (!userId) {
      toast.error('Usuario no autenticado');
      return;
    }
    const motivo = window.prompt(
      'Motivo de la reapertura (obligatorio para auditoría):',
      ''
    );
    if (!motivo || !motivo.trim()) return;
    try {
      await envioCrudService.reabrirCostosLanded(envio.id, motivo.trim(), userId);
      toast.success('Costos reabiertos · justifica la edición con auditoría');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al reabrir');
    }
  };

  const handleEliminarTanda = async (subEnvioId: string) => {
    if (!userId) {
      toast.error('Usuario no autenticado');
      return;
    }
    try {
      await envioCrudService.eliminarSubTanda(envio.id, subEnvioId, userId);
      toast.success('Tanda eliminada');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar tanda';
      toast.error(msg);
    }
  };

  // ═══ Render ════════════════════════════════════════════════════════════
  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title={`Envío ${envio.numeroEnvio}`}
        size="full"
        contentPadding="none"
      >
        <div className="flex flex-col">
          {/* ═══ Header migrado a <EntityHeader> (Capa 3 estándar OC) ═══
              Preserva el gradient sky + icon circular + badges a la derecha
              + acciones contextuales (Imprimir / Registrar recepción / Cerrar). */}
          <div className="px-6 py-5 bg-gradient-to-br from-slate-50 to-slate-100 border-b border-slate-200">
            <div className="mb-4">
              <EntityHeader
                breadcrumb={
                  <>
                    <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
                      <Plane className="w-4 h-4 text-sky-700" />
                    </div>
                    <span className="font-mono text-xs text-slate-500">
                      {envio.numeroEnvio}
                    </span>
                  </>
                }
                titulo={`Envío ${envio.numeroEnvio}`}
                subtitulo={
                  <>
                    {esInternacional ? 'Internacional → Perú' : 'Interna origen'} · creado hace{' '}
                    {envio.fechaCreacion.toDate().toLocaleDateString('es-PE', {
                      day: 'numeric',
                      month: 'long',
                    })}
                    {envio.ordenCompraNumero && (
                      <>
                        {' '}
                        · vinculado a{' '}
                        <span className="text-teal-600 font-medium font-mono">
                          {envio.ordenCompraNumero}
                        </span>
                      </>
                    )}
                  </>
                }
                badges={
                  <div className="flex items-center gap-2 flex-wrap">
                    {getEstadoBadgeNuevo(envio.estado)}
                    {infoRuta && (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${badgeClassForTipoRuta(tipoRuta!)}`}
                        title={infoRuta.nombreLargo}
                      >
                        <span className="font-mono text-[9px] opacity-70">{infoRuta.codigo}</span>
                        <span>{infoRuta.icono}</span>
                        <span>{infoRuta.nombreCorto}</span>
                      </span>
                    )}
                  </div>
                }
                accionesHeader={
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg hover:bg-white text-slate-700 flex items-center gap-1.5"
                    >
                      <Printer className="w-3 h-3" /> Imprimir
                    </button>
                    {/* S52 — botón "Registrar recepción" removido del header.
                        Ahora la acción principal vive en <NextActionBanner>
                        abajo del RutaGrande (alineado al estándar OC). */}
                    <button
                      type="button"
                      onClick={onClose}
                      className="p-1.5 text-slate-400 hover:text-slate-600"
                      aria-label="Cerrar"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                }
              />
            </div>

            {/* S54 — Ruta V2: pill modalidad arriba + 2 nodos grandes. Reemplaza
                RutaGrande (3 nodos con chip courier central). Ver docs/mockups/
                oc-detail-ruta-s54.html · sección "V2 aplicada al Envío". */}
            <RouteCardV2
              pill={rutaV2.pill}
              origen={rutaV2.origen}
              destino={rutaV2.destino}
              pipeline={rutaV2.pipeline}
            />

            {/* S52 — NextActionBanner contextual según estado (Capa 3).
                Reemplaza el botón "Registrar recepción" que estaba en el header.
                Alineado al estándar OC: la acción principal vive acá, no en el header. */}
            {nextActionEnvio && (
              <div className="mt-4">
                <NextActionBanner
                  icon={nextActionEnvio.icon}
                  label={nextActionEnvio.label}
                  description={nextActionEnvio.description}
                  buttonText={nextActionEnvio.buttonText}
                  onClick={nextActionEnvio.onClick}
                  variant={nextActionEnvio.variant}
                />
              </div>
            )}

            {/* S52 — 5 KPIs migrados a <KpiRow> (Capa 3).
                Preserva Unidades · OCs · Recibidas · Pendientes · Valor landed.
                La grid anterior con KpiRapido privado queda obsoleta. */}
            <div className="mt-4">
              <KpiRow
                columns={5}
                items={[
                  {
                    label: 'Unidades',
                    value: String(totalUnidades),
                    subtitle: 'esperadas',
                  },
                  {
                    label: 'OCs consolidadas',
                    value: ocsConsolidadas > 0 ? String(ocsConsolidadas) : '—',
                    subtitle:
                      ocsConsolidadas === 1 && envio.ordenCompraNumero
                        ? `${envio.ordenCompraNumero} ↗`
                        : ocsConsolidadas > 1
                          ? 'de distintos proveedores'
                          : 'sin OC vinculada',
                    tone: 'teal',
                    onClick: envio.ordenCompraId
                      ? () => {
                          // S54 — Navegar a /compras con la OC preseleccionada.
                          window.location.href = `/compras?oc=${envio.ordenCompraId}`;
                        }
                      : undefined,
                  },
                  {
                    label: 'Recibidas',
                    value: String(totalRecibidas),
                    subtitle: `${progreso}% del total`,
                    tone: 'emerald',
                  },
                  {
                    label: 'Pendientes',
                    value: String(totalPendientes),
                    subtitle:
                      incidenciasAbiertas.length > 0
                        ? `· ${incidenciasAbiertas.length} incidencia${incidenciasAbiertas.length !== 1 ? 's' : ''}`
                        : 'por llegar',
                    tone: incidenciasAbiertas.length > 0
                      ? 'red'
                      : totalPendientes > 0
                        ? 'amber'
                        : 'default',
                  },
                  {
                    label: 'Valor landed',
                    value:
                      valorLandedUSD > 0
                        ? `$${valorLandedUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                        : '—',
                    subtitle:
                      valorLandedUSD > 0 ? 'USD · costo importación' : 'sin valuar',
                    tone: 'emerald',
                  },
                ]}
              />
            </div>
          </div>

          {/* ═══ Tabs internos ═══ S54: scrollbar oculto + fade + flechas
              S54.x: sticky top-0 para que sigan visibles mientras se scrollea
              el contenido del Modal. */}
          <div className="relative px-6 border-b border-slate-200 bg-white flex-shrink-0 sticky top-0 z-10">
            {tabsCanLeft && (
              <button
                type="button"
                onClick={tabsScrollPrev}
                aria-label="Desplazar tabs a la izquierda"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 hover:border-slate-300 text-slate-600 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
            {tabsCanRight && (
              <button
                type="button"
                onClick={tabsScrollNext}
                aria-label="Desplazar tabs a la derecha"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 hover:border-slate-300 text-slate-600 transition-colors"
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
            <TabButton
              active={tab === 'productos'}
              onClick={() => setTab('productos')}
              icon={<Package className="w-3 h-3" />}
              label="Productos"
              badge={badgesTab.productos}
            />
            <TabButton
              active={tab === 'recepciones'}
              onClick={() => setTab('recepciones')}
              icon={<PackageCheck className="w-3 h-3" />}
              label="Recepciones"
              badge={badgesTab.recepciones}
            />
            <TabButton
              active={tab === 'costos'}
              onClick={() => setTab('costos')}
              icon={<DollarSign className="w-3 h-3" />}
              label="Costos landed"
              badge={badgesTab.costos}
            />
            {/* S54 E1 — Tab Pagos dedicado (solo envíos internacionales con flete/colaborador) */}
            {envio.tipo === 'internacional_peru' && (
              <TabButton
                active={tab === 'pagos'}
                onClick={() => setTab('pagos')}
                icon={<Banknote className="w-3 h-3" />}
                label="Pagos"
                badge={pagosColaboradorCC.length}
                badgeColor={envio.estadoPagoColaborador === 'pagado' ? 'slate' : 'red'}
              />
            )}
            <TabButton
              active={tab === 'incidencias'}
              onClick={() => setTab('incidencias')}
              icon={<AlertTriangle className="w-3 h-3" />}
              label="Incidencias"
              badge={badgesTab.incidencias}
              badgeColor={badgesTab.incidencias > 0 ? 'red' : 'slate'}
            />
            {/* S45 — Tab "Tandas" solo visible para envíos T1 con feature flag activa */}
            {mostrarTabTandas && (
              <TabButton
                active={tab === 'tandas'}
                onClick={() => setTab('tandas')}
                icon={<Package className="w-3 h-3" />}
                label="Tandas"
                badge={badgesTab.tandas}
              />
            )}
            <TabButton
              active={tab === 'documentos'}
              onClick={() => setTab('documentos')}
              icon={<FileText className="w-3 h-3" />}
              label="Documentos"
              badge={0}
            />
            <TabButton
              active={tab === 'inteligencia'}
              onClick={() => setTab('inteligencia')}
              icon={<TrendingUp className="w-3 h-3" />}
              label="Inteligencia"
              badge={0}
            />
            <TabButton
              active={tab === 'timeline'}
              onClick={() => setTab('timeline')}
              icon={<Clock className="w-3 h-3" />}
              label="Timeline"
              badge={0}
            />
            </div>
          </div>

          {/* ═══ Contenido del tab — S54 sidebar eliminado (datos absorbidos en pill/KPIs/pipeline/tabs) ═══
              S54.x: removido el wrapper `flex-1 overflow-hidden` + `overflow-y-auto h-full`
              que creaba un 2º contenedor scrolleable conflictuando con el del Modal.
              Ahora el contenido fluye natural y la barra de scroll del Modal maneja todo. */}
          <div>
            <div className="p-6 space-y-4">
              {tab === 'productos' && (
                <TabProductos envio={envio} productosMap={productosMap} />
              )}
              {tab === 'recepciones' && (
                <TabRecepciones envio={envio} recepciones={recepciones} />
              )}
              {tab === 'costos' && (
                costosScopeFlag ? (
                  <CostosLandedPanel
                    envio={envio}
                    tipoCambioActual={tc?.venta}
                    onAgregarCosto={handleAgregarCosto}
                    onConfirmarCosto={handleConfirmarCosto}
                    onFinalizarCostos={handleFinalizarCostos}
                    onReabrirCostos={handleReabrirCostos}
                  />
                ) : (
                  <TabCostos envio={envio} onEditFlete={onAbrirEditFlete} />
                )
              )}
              {tab === 'pagos' && (
                <TabPagosColaborador
                  envio={envio}
                  onAbrirPago={() => onAbrirPagoColaborador(envio)}
                  onReconciliar={() => onReconciliarPago(envio)}
                />
              )}
              {tab === 'incidencias' && (
                <TabIncidencias
                  envio={envio}
                  onGestionar={() => setShowGestionIncidencias(true)}
                  onLiberarAduana={() => setShowLiberarAduana(true)}
                  tieneAduanaPendiente={tieneAduanaPendiente}
                />
              )}
              {tab === 'tandas' && mostrarTabTandas && (
                <SubEnviosTimeline
                  envio={envio}
                  productosMeta={productosMetaTandas}
                  onAgregarTanda={handleAgregarTanda}
                  onTransicionarTanda={handleTransicionarTanda}
                  onEliminarTanda={handleEliminarTanda}
                  onReportarIncidencia={() => setShowGestionIncidencias(true)}
                />
              )}
              {tab === 'documentos' && <TabDocumentosEnvio envio={envio} />}
              {tab === 'inteligencia' && <TabInteligenciaEnvio envio={envio} />}
              {tab === 'timeline' && <TabTimeline envio={envio} />}
            </div>

            {/* S54 — Sidebar ELIMINADO.
                 Datos absorbidos en:
                 · Tracking → pill del RouteCardV2 (clickable copiable)
                 · OC vinculada → KPI "OCs consolidadas" (clickable)
                 · Creación → meta del pipeline
                 · Salida/Llegada → fechas bajo cada paso del pipeline
                 · Acciones de transición → NextActionBanner arriba
                 · Editar flete / gestionar incidencias / pago viajero → dentro de sus tabs respectivos
                 Bloque de aside COMPLETO removido (layout 2col → 1col).
            */}
            {/* S54 — Sidebar ELIMINADO · layout 1 col.
                 Datos absorbidos en: pill (tracking copiable) · KPI (OC vinculada clickable) ·
                 pipeline (fechas) · NextActionBanner (transiciones) · tabs (acciones específicas). */}
          </div>
        </div>
      </Modal>

      {/* Modales secundarios */}
      {showGestionIncidencias && (
        <GestionIncidenciasModal
          transferencia={envio as any}
          productosMap={productosMap}
          onClose={() => setShowGestionIncidencias(false)}
          onSuccess={() => {
            setShowGestionIncidencias(false);
            onClose();
          }}
        />
      )}

      {showLiberarAduana && !liberandoAduana && (
        <LiberarAduanaModal
          envio={envio}
          productosMap={productosMap}
          onClose={() => setShowLiberarAduana(false)}
          onConfirm={handleLiberarAduana}
        />
      )}
    </>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Subcomponentes — Header
// ════════════════════════════════════════════════════════════════════════════

// S54 — `RutaGrande` + `NodoRuta` + `getFlag` eliminados. La ruta ahora se
// renderiza con el componente compartido `RouteCardV2` del design-system
// (patrón V2: pill modalidad arriba + 2 nodos grandes). El helper para
// banderas vive ahora como `getFlagFromPais` en el mismo módulo.

const KpiRapido: React.FC<{
  label: string;
  value: string;
  subtitle: string;
  valueColor?: string;
  redBg?: boolean;
}> = ({ label, value, subtitle, valueColor = 'text-slate-900', redBg }) => (
  <div
    className={cn(
      'rounded-lg p-3 border',
      redBg ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'
    )}
  >
    <div
      className={cn(
        'text-[10px] font-semibold uppercase mb-1',
        redBg ? 'text-red-700' : 'text-slate-500'
      )}
    >
      {label}
    </div>
    <div className={cn('text-lg font-bold tabular-nums', valueColor)}>
      {value}
    </div>
    <div
      className={cn(
        'text-[10px]',
        redBg ? 'text-red-600' : 'text-slate-500'
      )}
    >
      {subtitle}
    </div>
  </div>
);

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge: number;
  badgeColor?: 'red' | 'slate';
}> = ({ active, onClick, icon, label, badge, badgeColor = 'slate' }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'px-4 py-3 text-sm font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap',
      active
        ? 'text-teal-700 border-b-2 border-teal-600'
        : 'text-slate-500 hover:text-slate-700 border-b-2 border-transparent'
    )}
  >
    {icon}
    {label}
    {badge > 0 && (
      <span
        className={cn(
          'ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
          badgeColor === 'red'
            ? 'bg-red-100 text-red-700'
            : 'bg-slate-100 text-slate-600'
        )}
      >
        {badge}
      </span>
    )}
  </button>
);

const SidebarAction: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant: 'teal' | 'red' | 'amber' | 'emerald' | 'slate';
}> = ({ icon, label, onClick, variant }) => {
  const classes = {
    teal: 'hover:border-teal-400 hover:text-teal-700',
    red: 'hover:border-red-400 hover:text-red-700',
    amber: 'hover:border-amber-400 hover:text-amber-700',
    emerald: 'hover:border-emerald-400 hover:text-emerald-700',
    slate: 'hover:border-slate-400 hover:text-slate-700',
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg flex items-center gap-2 transition-colors',
        classes
      )}
    >
      {icon}
      {label}
    </button>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Subcomponentes — Tabs
// ════════════════════════════════════════════════════════════════════════════

const TabProductos: React.FC<{
  envio: Envio;
  productosMap: Map<string, Producto>;
}> = ({ envio, productosMap }) => {
  const productos = envio.productosSummary || [];
  if (productos.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-slate-400 italic">
        Sin productos registrados
      </div>
    );
  }

  const mostrarRecepcion =
    envio.estado === 'recibida_completa' || envio.estado === 'recibida_parcial';

  // S47 — OC origen: en envíos T1 (single-OC) todos los productos provienen
  // del mismo envio.ordenCompraId. Para T2/J (multi-OC picking) el campo se
  // queda como '—' hasta que el modelo guarde ordenCompraId por EnvioUnidad
  // (pendiente S48+, ver MODELO_ENVIOS_TRANSVERSAL.md §4).
  const ocOrigenTexto = envio.ordenCompraNumero ?? null;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Producto</th>
            <th className="px-4 py-2 text-left font-medium">OC origen</th>
            <th className="px-4 py-2 text-center font-medium">Enviadas</th>
            {mostrarRecepcion && (
              <>
                <th className="px-4 py-2 text-center font-medium">Recibidas</th>
                <th className="px-4 py-2 text-center font-medium">Incidencias</th>
                <th className="px-4 py-2 text-center font-medium">Progreso</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {productos.map((p) => {
            const unidadesProducto = (envio.unidades ?? []).filter(
              (u) => u.productoId === p.productoId
            );
            const recibidas = unidadesProducto.filter(
              (u) => u.estadoEnvio === 'recibida'
            ).length;
            const danadas = unidadesProducto.filter(
              (u) => u.estadoEnvio === 'danada'
            ).length;
            const faltantes = unidadesProducto.filter(
              (u) => u.estadoEnvio === 'faltante'
            ).length;
            const prodFull = productosMap.get(p.productoId);
            const descripcion = prodFull ? getDescripcionProducto(prodFull) : '';
            const pct =
              p.cantidad > 0 ? Math.round(((recibidas + danadas) / p.cantidad) * 100) : 0;
            const emoji = prodFull
              ? getEmojiPorProducto(prodFull as any)
              : { emoji: '📦', bgClass: 'bg-slate-50' };

            return (
              <tr
                key={p.productoId}
                className="hover:bg-slate-50 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className="text-lg mt-0.5">{emoji.emoji}</span>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800">
                        {prodFull?.nombreComercial || p.nombre}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 flex-wrap mt-0.5">
                        <span className="font-mono">{p.sku}</span>
                        {prodFull?.marca && (
                          <>
                            <span>·</span>
                            <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded text-[10px] font-medium">
                              {prodFull.marca}
                            </span>
                          </>
                        )}
                      </div>
                      {descripcion && (
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          <strong>{descripcion}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                {/* S47 — OC origen */}
                <td className="px-4 py-3">
                  {ocOrigenTexto ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded">
                      {ocOrigenTexto}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center font-semibold tabular-nums">
                  {p.cantidad}
                </td>
                {mostrarRecepcion && (
                  <>
                    <td className="px-4 py-3 text-center text-emerald-700 font-semibold tabular-nums">
                      {recibidas}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {danadas + faltantes > 0 ? (
                        <span className="text-red-700 font-medium text-xs">
                          {danadas > 0 && `${danadas} dañada${danadas !== 1 ? 's' : ''}`}
                          {danadas > 0 && faltantes > 0 && ' · '}
                          {faltantes > 0 && `${faltantes} faltante${faltantes !== 1 ? 's' : ''}`}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                          <div
                            className={cn(
                              'h-1.5 rounded-full',
                              pct === 100
                                ? 'bg-emerald-500'
                                : pct > 0
                                  ? 'bg-amber-400'
                                  : 'bg-slate-300'
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-10 text-right tabular-nums">
                          {pct}%
                        </span>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const TabRecepciones: React.FC<{
  envio: Envio;
  recepciones: any[];
}> = ({ envio, recepciones }) => {
  if (recepciones.length === 0) {
    return (
      <div className="text-center py-12">
        <PackageCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <div className="text-sm font-medium text-slate-700 mb-1">
          Sin recepciones registradas
        </div>
        <div className="text-xs text-slate-500">
          Las recepciones aparecen cuando el envío empieza a llegar
        </div>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl p-4">
      <div className="space-y-4">
        {recepciones.map((rec: any, idx: number) => {
          const tieneProblemas = (rec.unidadesDanadas || 0) + (rec.unidadesFaltantes || 0) > 0;
          return (
            <div key={rec.id || idx} className="flex items-start gap-3">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  tieneProblemas ? 'bg-amber-100' : 'bg-emerald-100'
                )}
              >
                {tieneProblemas ? (
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-700" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-sm font-semibold text-slate-800">
                    Recepción #{rec.numero || idx + 1} ·{' '}
                    {rec.unidadesRecibidas + rec.unidadesDanadas + rec.unidadesFaltantes}{' '}
                    unidades
                  </div>
                  <div className="text-xs text-slate-500">
                    {rec.fechaRecepcion?.toDate?.()
                      ? rec.fechaRecepcion
                          .toDate()
                          .toLocaleDateString('es-PE', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                      : '—'}
                  </div>
                </div>
                <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-2 flex-wrap">
                  {rec.unidadesRecibidas > 0 && (
                    <span className="text-emerald-700">
                      {rec.unidadesRecibidas} recibidas
                    </span>
                  )}
                  {rec.unidadesDanadas > 0 && (
                    <span className="text-amber-700 font-medium">
                      · {rec.unidadesDanadas} dañadas
                    </span>
                  )}
                  {rec.unidadesFaltantes > 0 && (
                    <span className="text-red-700 font-medium">
                      · {rec.unidadesFaltantes} faltantes
                    </span>
                  )}
                </div>
                {rec.observaciones && (
                  <div className="text-xs text-slate-500 mt-1 italic">
                    "{rec.observaciones}"
                  </div>
                )}
                {rec.recibidoPor && (
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Por: <UserName userId={rec.recibidoPor} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TabCostos: React.FC<{
  envio: Envio;
  onEditFlete: (e: Envio) => void;
}> = ({ envio, onEditFlete }) => {
  const costoFlete = envio.costoFleteTotal || 0;
  const pesoTotal = envio.pesoTotalLibras || 0;
  const costoPorLb = envio.costoFletePorLibra || 0;
  const esInternacional = envio.tipo === 'internacional_peru';

  return (
    <div className="space-y-3">
      <div className="border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-teal-600" />
            Costos landed
          </h4>
          {esInternacional && (
            <button
              type="button"
              onClick={() => onEditFlete(envio)}
              className="px-3 py-1.5 text-xs font-medium text-teal-700 border border-teal-300 rounded-lg hover:bg-teal-50 flex items-center gap-1.5"
            >
              <Edit3 className="w-3 h-3" />
              {costoFlete > 0 ? 'Editar flete' : 'Agregar flete'}
            </button>
          )}
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-700">Flete internacional</span>
            <span className="font-semibold tabular-nums">
              {costoFlete > 0 ? `$${costoFlete.toFixed(2)} USD` : '—'}
            </span>
          </div>
          {pesoTotal > 0 && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-700">Peso total</span>
                <span className="font-semibold tabular-nums">
                  {pesoTotal.toFixed(2)} lb
                </span>
              </div>
              {costoPorLb > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-700">Costo por libra</span>
                  <span className="font-semibold tabular-nums text-sky-700">
                    ${costoPorLb.toFixed(2)} USD/lb
                  </span>
                </div>
              )}
            </>
          )}
          {costoFlete > 0 && (
            <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
              <span>Total prorrateado</span>
              <span className="text-teal-700 tabular-nums">
                ${costoFlete.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* S54 E1 — Historial de pagos al colaborador MOVIDO al tab Pagos dedicado. */}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// S54 E1 — TabPagosColaborador: resumen + destinatario + historial + CTA.
// Centraliza lo que antes estaba disperso entre TabCostos y sidebar.
// ════════════════════════════════════════════════════════════════════════════
const TabPagosColaborador: React.FC<{
  envio: Envio;
  onAbrirPago: () => void;
  onReconciliar: () => void;
}> = ({ envio, onAbrirPago, onReconciliar }) => {
  const totalFlete = envio.costoFleteTotal || 0;
  const moneda = envio.monedaFlete || 'USD';
  // S55 Fase 4 — Pagos vienen del hook reactivo (CC). Reemplaza envio.pagosColaborador[].
  const { pagos } = usePagosEnvio(envio.id);
  const montoPagado = pagos.reduce((s, p) => s + (p.montoUSD || 0), 0);
  const pendiente = Math.max(0, totalFlete - montoPagado);
  const estado = envio.estadoPagoColaborador || (totalFlete > 0 ? 'pendiente' : 'pagado');
  const puedeRegistrar =
    (envio.estado === 'recibida_completa' || envio.estado === 'recibida_parcial') &&
    estado !== 'pagado' &&
    totalFlete > 0;

  return (
    <div className="space-y-3">
      {/* Resumen */}
      <div className="grid grid-cols-4 gap-2 bg-slate-50 rounded-xl p-3">
        <div className="text-center">
          <div className="text-[10px] font-semibold uppercase text-slate-500">Flete total</div>
          <div className="text-lg font-bold tabular-nums">
            {totalFlete > 0 ? `$${totalFlete.toFixed(2)}` : '—'}
          </div>
          <div className="text-[10px] text-slate-500">{moneda}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] font-semibold uppercase text-slate-500">Pagado</div>
          <div className="text-lg font-bold text-emerald-600 tabular-nums">
            ${montoPagado.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500">{pagos.length} pago{pagos.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] font-semibold uppercase text-slate-500">Pendiente</div>
          <div
            className={cn(
              'text-lg font-bold tabular-nums',
              estado === 'pagado' ? 'text-slate-400' : 'text-red-600'
            )}
          >
            ${pendiente.toFixed(2)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] font-semibold uppercase text-slate-500">Estado</div>
          <div className="pt-1.5">
            <Badge
              variant={
                estado === 'pagado' ? 'success' : estado === 'parcial' ? 'warning' : 'danger'
              }
              size="sm"
            >
              {estado === 'pagado' ? 'Pagado' : estado === 'parcial' ? 'Parcial' : 'Pendiente'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Destinatario */}
      {envio.colaboradorNombre && (
        <div className="p-3 border border-amber-200 bg-amber-50 rounded-lg text-xs">
          <div className="text-[10px] font-semibold uppercase text-amber-700 mb-1">
            Destinatario del pago
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 font-bold text-xs">
              {envio.colaboradorNombre
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div>
              <div className="font-semibold">
                {envio.colaboradorNombre}{' '}
                {envio.colaboradorTipo && (
                  <span className="text-[10px] font-normal text-amber-700">
                    ({envio.colaboradorTipo})
                  </span>
                )}
              </div>
              <div className="text-[10px] text-amber-700">
                Transportador del envío · flete {moneda} ${totalFlete.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historial */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 tracking-wider flex items-center justify-between">
          <span>Historial de pagos</span>
          <span className="text-slate-400 normal-case font-normal">
            {pagos.length} registrado{pagos.length !== 1 ? 's' : ''}
          </span>
        </div>
        {pagos.length === 0 ? (
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagos.map((pago: any, idx: number) => (
                <tr key={pago.id || idx} className="hover:bg-slate-50/50">
                  <td className="px-3 py-2 tabular-nums text-xs">
                    {pago.fecha?.toDate?.()?.toLocaleDateString('es-PE') || '—'}
                  </td>
                  <td className="px-3 py-2 text-xs capitalize">
                    {pago.metodoPago?.replace(/_/g, ' ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-slate-600">
                    {pago.referencia || '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    ${(pago.montoUSD || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="p-2 border-t border-slate-200 flex gap-2">
          {puedeRegistrar && (
            <Button variant="primary" onClick={onAbrirPago} className="flex-1">
              <Banknote className="h-4 w-4 mr-2" />
              {estado === 'parcial' ? 'Registrar pago adicional' : 'Registrar pago al colaborador'}
            </Button>
          )}
          {estado === 'pagado' && (
            <Button variant="secondary" onClick={onReconciliar} className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizar pago
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const TabIncidencias: React.FC<{
  envio: Envio;
  onGestionar: () => void;
  onLiberarAduana: () => void;
  tieneAduanaPendiente: boolean;
}> = ({ envio, onGestionar, onLiberarAduana, tieneAduanaPendiente }) => {
  const incidencias = envio.incidencias || [];
  const [filtroTipo, setFiltroTipo] = useState<'todas' | 'faltante' | 'danada' | 'diferente' | 'aduana' | 'otro'>('todas');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'abiertas' | 'resueltas'>('todos');

  // S54 E2 — Meta por tipo (estilo IncidenciasOCPanel)
  const TIPO_META: Record<string, { label: string; emoji: string; colorClass: string }> = {
    faltante: { label: 'Faltante', emoji: '📦', colorClass: 'bg-amber-100 text-amber-800' },
    danada: { label: 'Dañada', emoji: '💥', colorClass: 'bg-red-100 text-red-800' },
    diferente: { label: 'Diferente', emoji: '❓', colorClass: 'bg-purple-100 text-purple-800' },
    aduana: { label: 'Aduana', emoji: '🛃', colorClass: 'bg-sky-100 text-sky-800' },
    otro: { label: 'Otro', emoji: '📌', colorClass: 'bg-slate-100 text-slate-800' },
  };

  // Contadores por tipo y por estado
  const contadores = {
    porTipo: { todas: incidencias.length } as Record<string, number>,
    porEstado: {
      todos: incidencias.length,
      abiertas: incidencias.filter((i) => !i.resuelta).length,
      resueltas: incidencias.filter((i) => i.resuelta).length,
    },
  };
  for (const i of incidencias) {
    contadores.porTipo[i.tipo] = (contadores.porTipo[i.tipo] || 0) + 1;
  }

  // Filtrar
  const filtradas = incidencias.filter((i) => {
    if (filtroTipo !== 'todas' && i.tipo !== filtroTipo) return false;
    if (filtroEstado === 'abiertas' && i.resuelta) return false;
    if (filtroEstado === 'resueltas' && !i.resuelta) return false;
    return true;
  });

  if (incidencias.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <CheckCircle className="w-6 h-6 text-emerald-500" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Sin incidencias</h3>
        <p className="text-xs text-slate-500">Este envío no tiene problemas registrados.</p>
      </div>
    );
  }

  const tiposPresentes = (Object.keys(TIPO_META) as Array<keyof typeof TIPO_META>).filter(
    (t) => (contadores.porTipo[t] || 0) > 0
  );

  return (
    <div className="space-y-3">
      {/* Sub-tabs por tipo */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit max-w-full overflow-x-auto scrollbar-hide">
        <button
          type="button"
          onClick={() => setFiltroTipo('todas')}
          className={cn(
            'text-xs px-3 py-1.5 rounded font-medium whitespace-nowrap',
            filtroTipo === 'todas' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600'
          )}
        >
          Todas <span className="text-[10px] text-slate-400">({contadores.porTipo.todas})</span>
        </button>
        {tiposPresentes.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFiltroTipo(t as 'faltante' | 'danada' | 'diferente' | 'aduana' | 'otro')}
            className={cn(
              'text-xs px-3 py-1.5 rounded font-medium whitespace-nowrap',
              filtroTipo === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600'
            )}
          >
            {TIPO_META[t].emoji} {TIPO_META[t].label}{' '}
            <span className="text-[10px] text-slate-400">({contadores.porTipo[t] || 0})</span>
          </button>
        ))}
      </div>

      {/* Filtros estado + CTAs */}
      <div className="flex gap-2 items-center text-xs flex-wrap">
        <span className="text-slate-500">Estado:</span>
        {(['todos', 'abiertas', 'resueltas'] as const).map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setFiltroEstado(e)}
            className={cn(
              'px-2 py-0.5 rounded-full font-medium text-xs capitalize',
              filtroEstado === e
                ? e === 'abiertas'
                  ? 'bg-red-200 text-red-800'
                  : e === 'resueltas'
                    ? 'bg-emerald-200 text-emerald-800'
                    : 'bg-slate-300 text-slate-800'
                : e === 'abiertas'
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : e === 'resueltas'
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {e} ({contadores.porEstado[e]})
          </button>
        ))}
        <div className="ml-auto flex gap-2 flex-wrap">
          {contadores.porEstado.abiertas > 0 && (
            <button
              onClick={onGestionar}
              className="text-[11px] px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 inline-flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3" /> Gestionar
            </button>
          )}
          {tieneAduanaPendiente && (
            <button
              onClick={onLiberarAduana}
              className="text-[11px] px-2 py-1 bg-sky-600 text-white rounded hover:bg-sky-700 inline-flex items-center gap-1"
            >
              <PackageCheck className="w-3 h-3" /> Liberar aduana
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500 italic border-2 border-dashed border-slate-200 rounded-xl">
          Ninguna incidencia coincide con los filtros.
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map((inc) => {
            const meta = TIPO_META[inc.tipo] || TIPO_META.otro;
            const borderColor = inc.resuelta
              ? 'border-emerald-200 bg-emerald-50/40'
              : 'border-red-200 bg-red-50/40';
            return (
              <div key={inc.id} className={cn('p-3 rounded-lg border', borderColor)}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-bold uppercase',
                          inc.resuelta
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        )}
                      >
                        {inc.resuelta ? 'Resuelta' : 'Abierta'}
                      </span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', meta.colorClass)}>
                        {meta.emoji} {meta.label}
                      </span>
                      {inc.sku && (
                        <span className="text-[10px] text-slate-500 font-mono">{inc.sku}</span>
                      )}
                      {inc.productoNombre && (
                        <span className="text-[11px] text-slate-600">· {inc.productoNombre}</span>
                      )}
                    </div>
                    {inc.descripcion && (
                      <div className="text-xs text-slate-700 mt-0.5">{inc.descripcion}</div>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500 flex-wrap">
                      <span>
                        Registrada{' '}
                        {inc.fechaRegistro.toDate().toLocaleDateString('es-PE', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                      {inc.registradoPor && (
                        <span>
                          por <UserName userId={inc.registradoPor} />
                        </span>
                      )}
                      {inc.resuelta && inc.fechaResolucion && (
                        <span className="text-emerald-700">
                          · resuelta{' '}
                          {inc.fechaResolucion.toDate().toLocaleDateString('es-PE', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      )}
                      {inc.montoReclamoPEN !== undefined && inc.montoReclamoPEN > 0 && (
                        <span className="text-red-700 font-semibold">
                          Reclamo: S/ {inc.montoReclamoPEN.toFixed(2)}
                          {inc.estadoReclamo && ` · ${inc.estadoReclamo}`}
                        </span>
                      )}
                    </div>
                    {inc.resuelta && inc.resolucion && (
                      <div className="mt-2 text-[11px] text-emerald-900 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                        <b>Resolución:</b> {inc.resolucion}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TabTimeline: React.FC<{ envio: Envio }> = ({ envio }) => {
  const eventos: { fecha: any; titulo: string; descripcion?: React.ReactNode; icon: any; color: string }[] = [];

  eventos.push({
    fecha: envio.fechaCreacion,
    titulo: 'Envío creado',
    descripcion: envio.creadoPor ? (
      <>Por <UserName userId={envio.creadoPor} /></>
    ) : 'Por sistema',
    icon: FileText,
    color: 'slate',
  });

  if (envio.fechaConfirmacion) {
    eventos.push({
      fecha: envio.fechaConfirmacion,
      titulo: 'Envío confirmado',
      icon: CheckCircle,
      color: 'sky',
    });
  }

  if (envio.fechaSalida) {
    eventos.push({
      fecha: envio.fechaSalida,
      titulo: 'Despachado',
      descripcion: envio.courier ? `Via ${envio.courier}` : undefined,
      icon: Truck,
      color: 'amber',
    });
  }

  (envio.recepciones || []).forEach((rec: any, idx: number) => {
    eventos.push({
      fecha: rec.fechaRecepcion,
      titulo: `Recepción #${rec.numero || idx + 1}`,
      descripcion: `${rec.unidadesRecibidas} recibidas${rec.unidadesDanadas > 0 ? ` · ${rec.unidadesDanadas} dañadas` : ''}`,
      icon: PackageCheck,
      color: 'emerald',
    });
  });

  if (envio.fechaLlegadaReal && envio.estado === 'recibida_completa') {
    eventos.push({
      fecha: envio.fechaLlegadaReal,
      titulo: 'Envío completado',
      icon: CheckCircle,
      color: 'emerald',
    });
  }

  // Ordenar por fecha desc
  eventos.sort((a, b) => {
    const ta = a.fecha?.toDate?.()?.getTime() ?? 0;
    const tb = b.fecha?.toDate?.()?.getTime() ?? 0;
    return tb - ta;
  });

  if (eventos.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-slate-400 italic">
        Sin eventos de timeline
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl p-4">
      <div className="space-y-4">
        {eventos.map((ev, idx) => {
          const Icon = ev.icon;
          const colorBg = {
            slate: 'bg-slate-100 text-slate-600',
            sky: 'bg-sky-100 text-sky-600',
            amber: 'bg-amber-100 text-amber-600',
            emerald: 'bg-emerald-100 text-emerald-600',
          }[ev.color];
          return (
            <div key={idx} className="flex items-start gap-3">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  colorBg
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-sm font-semibold text-slate-800">
                    {ev.titulo}
                  </div>
                  <div className="text-xs text-slate-500">
                    {ev.fecha?.toDate?.()?.toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    }) ?? '—'}
                  </div>
                </div>
                {ev.descripcion && (
                  <div className="text-xs text-slate-600 mt-0.5">{ev.descripcion}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════

const getEstadoBadgeNuevo = (estado: EstadoEnvio) => {
  const config: Record<EstadoEnvio, { variant: 'default' | 'warning' | 'success' | 'danger' | 'info'; label: string }> = {
    borrador: { variant: 'default', label: 'Borrador' },
    confirmado: { variant: 'warning', label: 'Confirmado' },
    en_transito: { variant: 'info', label: 'En Tránsito' },
    retenida_aduana: { variant: 'danger', label: 'Aduana' },
    recibida_parcial: { variant: 'warning', label: 'Parcial' },
    recibida_completa: { variant: 'success', label: 'Completada' },
    perdida_total: { variant: 'danger', label: 'Perdida' },
    cancelada: { variant: 'danger', label: 'Cancelada' },
  };
  const { variant, label } = config[estado] ?? { variant: 'default' as const, label: estado };
  return <Badge variant={variant}>{label}</Badge>;
};

// ════════════════════════════════════════════════════════════════════════════
// S54 · E3 — TabDocumentosEnvio: repositorio de documentos del envío.
// Placeholder por ahora (la persistencia requiere storage). Preview conceptual.
// ════════════════════════════════════════════════════════════════════════════
const TabDocumentosEnvio: React.FC<{ envio: Envio }> = ({ envio }) => {
  const esInternacional = envio.tipo === 'internacional_peru';
  const documentosTipicos = esInternacional
    ? [
        { tipo: 'AWB / BL', descripcion: 'Air Waybill o Bill of Lading', icono: Plane, color: 'sky' },
        { tipo: 'Packing list', descripcion: 'Lista de empaque detallada', icono: FileText, color: 'emerald' },
        { tipo: 'Factura comercial', descripcion: 'Invoice del proveedor/courier', icono: FileText, color: 'amber' },
        { tipo: 'Certificado de origen', descripcion: 'Para tratamientos arancelarios', icono: FileText, color: 'purple' },
        { tipo: 'DAM (DUA)', descripcion: 'Declaración aduanera de mercancías', icono: FileText, color: 'teal' },
        { tipo: 'Liberación aduanera', descripcion: 'Comprobante de nacionalización', icono: PackageCheck, color: 'slate' },
      ]
    : [
        { tipo: 'Guía de remisión', descripcion: 'Traslado interno / local', icono: FileText, color: 'sky' },
        { tipo: 'Acta de recepción', descripcion: 'Firmada por el destinatario', icono: PackageCheck, color: 'emerald' },
      ];

  return (
    <div className="space-y-3">
      <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-900 flex items-start gap-2">
        <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          Repositorio de documentos del envío. <b>Próximamente:</b> upload con preview inline y
          versionado. Lista sugerida según tipo de envío ({esInternacional ? 'internacional' : 'local'}):
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {documentosTipicos.map((d) => {
          const Icon = d.icono;
          const colorClasses: Record<string, string> = {
            sky: 'bg-sky-100 text-sky-700',
            emerald: 'bg-emerald-100 text-emerald-700',
            amber: 'bg-amber-100 text-amber-700',
            purple: 'bg-purple-100 text-purple-700',
            teal: 'bg-teal-100 text-teal-700',
            slate: 'bg-slate-100 text-slate-700',
          };
          return (
            <div
              key={d.tipo}
              className="p-3 border border-slate-200 rounded-lg flex items-center gap-3 hover:bg-slate-50 transition-colors"
            >
              <div className={cn('w-10 h-10 rounded flex items-center justify-center', colorClasses[d.color])}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900">{d.tipo}</div>
                <div className="text-[10px] text-slate-500">{d.descripcion}</div>
              </div>
              <span className="text-[10px] text-slate-400 italic">Pendiente</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// S54 · E3 — TabInteligenciaEnvio: widgets analíticos específicos de logística.
// Métricas cruzadas con el histórico de envíos del mismo courier/colaborador.
// ════════════════════════════════════════════════════════════════════════════
const TabInteligenciaEnvio: React.FC<{ envio: Envio }> = ({ envio }) => {
  const esInternacional = envio.tipo === 'internacional_peru';
  const costoFletePorLb = envio.costoFletePorLibra || 0;
  const pesoTotal = envio.pesoTotalLibras || 0;
  const courier = envio.courier || envio.colaboradorNombre;

  // Placeholders de cálculo — en sesión dedicada se cruzan con colección envios
  // para obtener promedios históricos del courier/colaborador.
  const sinDatos = !courier;

  return (
    <div className="space-y-3">
      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 flex items-start gap-2">
        <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          Análisis cruzado con histórico del transportador. Los widgets se
          activan cuando hay datos suficientes de envíos anteriores.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* SLA del transportador */}
        <div className="p-3 border border-slate-200 rounded-lg bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-slate-500" />
              <span className="text-[10px] uppercase font-semibold text-slate-500">SLA del transportador</span>
            </div>
          </div>
          {sinDatos ? (
            <div className="text-xs text-slate-500 italic py-2">Sin transportador asignado.</div>
          ) : (
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600">Transportador</span>
                <span className="font-semibold">{courier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Lead time (este envío)</span>
                <span className="font-semibold tabular-nums">
                  {envio.diasEnTransito !== undefined
                    ? `${envio.diasEnTransito} días`
                    : '—'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 italic mt-1">
                Próximamente: lead time promedio y ratio de incidencias históricos.
              </div>
            </div>
          )}
        </div>

        {/* Costo por libra vs histórico */}
        <div className="p-3 border border-slate-200 rounded-lg bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-slate-500" />
              <span className="text-[10px] uppercase font-semibold text-slate-500">Costo por libra</span>
            </div>
          </div>
          {costoFletePorLb > 0 ? (
            <div className="text-xs space-y-1">
              <div className="text-lg font-bold text-slate-900 tabular-nums">
                ${costoFletePorLb.toFixed(2)} <span className="text-xs font-normal text-slate-500">USD/lb</span>
              </div>
              <div className="text-[10px] text-slate-500">
                Peso total: {pesoTotal.toFixed(2)} lb · Flete: ${(envio.costoFleteTotal || 0).toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 italic mt-1">
                Próximamente: comparativo vs promedio histórico del colaborador.
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic py-2">
              {esInternacional ? 'Flete aún no registrado.' : 'No aplica para envíos locales.'}
            </div>
          )}
        </div>

        {/* Tiempo en aduana (solo internacional) */}
        {esInternacional && (
          <div className="p-3 border border-slate-200 rounded-lg bg-gradient-to-br from-white to-slate-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <PackageCheck className="w-4 h-4 text-slate-500" />
                <span className="text-[10px] uppercase font-semibold text-slate-500">Tiempo en aduana</span>
              </div>
            </div>
            {envio.estado === 'retenida_aduana' ? (
              <div className="text-xs">
                <div className="text-red-700 font-bold">En aduana actualmente</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Considerar liberación inmediata para evitar recargos por almacenaje.
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic py-2">
                Sin retención registrada en este envío.
              </div>
            )}
          </div>
        )}

        {/* Ratio de incidencias */}
        <div className="p-3 border border-slate-200 rounded-lg bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-slate-500" />
              <span className="text-[10px] uppercase font-semibold text-slate-500">Salud del envío</span>
            </div>
          </div>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600">Incidencias registradas</span>
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  (envio.incidencias?.length ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600'
                )}
              >
                {envio.incidencias?.length ?? 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Unidades dañadas</span>
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  (envio.totalUnidadesDanadas ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600'
                )}
              >
                {envio.totalUnidadesDanadas ?? 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Unidades faltantes</span>
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  (envio.totalUnidadesFaltantes ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600'
                )}
              >
                {envio.totalUnidadesFaltantes ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function getIniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
