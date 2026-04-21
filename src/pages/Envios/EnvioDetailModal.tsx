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
// S46 — Costos landed con scope + cierre financiero (D-17, D-18)
import {
  CostosLandedPanel,
  type AgregarCostoLandedModalResult,
} from './CostosLandedScope';
import { useTipoCambio } from '../../hooks/useTipoCambio';

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
type TabActivo = 'productos' | 'recepciones' | 'costos' | 'incidencias' | 'tandas' | 'timeline';

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

  // ─── Origen / destino (S38-014) ─────────────────────────────────────────
  const origenNombre =
    envio.origenTipo === 'proveedor'
      ? envio.origenProveedorNombre || 'Proveedor sin nombre'
      : envio.origenCasillaNombre || 'Casilla Origen';
  const origenSubtitulo =
    envio.origenTipo === 'proveedor'
      ? envio.origenProveedorPais
        ? `Proveedor · ${envio.origenProveedorPais}`
        : 'Proveedor'
      : envio.origenCasillaCodigo || 'Casilla';
  // S42bg — BUG FIX: antes era `envio.courier || envio.colaboradorNombre`.
  // Mezclaba dos conceptos distintos:
  //   - envio.courier: transportador explícito (FedEx, DHL, viajero real) —
  //     se setea al DESPACHAR el envío.
  //   - envio.colaboradorNombre: colaborador registrado al crear la OC —
  //     normalmente es el DUEÑO de la casilla destino (no transportador).
  // Si el envío no se ha despachado aún, courier=undefined y el fallback
  // mostraba al dueño de la casilla como si fuera un paso intermedio de
  // la ruta (semánticamente incorrecto).
  // Ahora: solo se muestra en el segmento de la ruta cuando hay un
  // transportador real. El colaborador (si existe) sigue visible en la
  // sidebar "COLABORADOR".
  const courierNombre = envio.courier || null;

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
        <div className="flex flex-col h-full">
          {/* ═══ Header enriquecido ═══ */}
          <div className="px-6 py-5 bg-gradient-to-br from-slate-50 to-slate-100 border-b border-slate-200">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                    <Plane className="w-5 h-5 text-sky-700" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      <span className="font-mono">{envio.numeroEnvio}</span>
                      {getEstadoBadgeNuevo(envio.estado)}
                      {/* S47 — Badge tipo ruta A-J (reemplaza chip DDP aislado) */}
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
                    </h2>
                    <div className="text-xs text-slate-500 mt-0.5">
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
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg hover:bg-white text-slate-700 flex items-center gap-1.5"
                >
                  <Printer className="w-3 h-3" /> Imprimir
                </button>
                {(envio.estado === 'en_transito' || envio.estado === 'recibida_parcial') && (
                  <button
                    type="button"
                    onClick={() => onIniciarRecepcion(envio)}
                    className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-1.5 font-semibold"
                  >
                    <PackageCheck className="w-3 h-3" />
                    {envio.estado === 'recibida_parcial'
                      ? 'Registrar recepción adicional'
                      : 'Registrar recepción'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-slate-600"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Ruta horizontal grande 3 nodos */}
            <RutaGrande
              origenNombre={origenNombre}
              origenSubtitulo={origenSubtitulo}
              origenPais={envio.origenProveedorPais || envio.origenCasillaPais}
              origenEstado={
                envio.estado === 'borrador' || envio.estado === 'confirmado'
                  ? 'pending'
                  : 'done'
              }
              courierNombre={courierNombre}
              courierSubtitulo={
                courierNombre ? 'Transportador' : 'Sin despachar'
              }
              enTransito={envio.estado === 'en_transito'}
              destinoNombre={envio.destinoCasillaNombre || 'Destino'}
              destinoSubtitulo={
                // S42bk — Incluir código + país en el subtítulo (similar a
                // como el origen muestra "Proveedor · USA"). Así el nodo
                // destino tiene la misma densidad informativa.
                [
                  envio.destinoCasillaCodigo,
                  envio.destinoCasillaPais
                    ? `Casilla · ${envio.destinoCasillaPais}`
                    : 'Casilla',
                ].filter(Boolean).join(' · ')
              }
              destinoPais={envio.destinoCasillaPais}
              destinoEstado={
                envio.estado === 'recibida_completa'
                  ? 'done'
                  : envio.estado === 'en_transito'
                    ? 'active'
                    : envio.estado === 'recibida_parcial'
                      ? 'active'
                      : 'pending'
              }
            />

            {/* 5 KPIs rápidos — S47 incluye OCs consolidadas (Modelo Envíos Transversal) */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
              <KpiRapido
                label="Unidades"
                value={String(totalUnidades)}
                subtitle="esperadas"
              />
              <KpiRapido
                label="OCs consolidadas"
                value={ocsConsolidadas > 0 ? String(ocsConsolidadas) : '—'}
                subtitle={
                  ocsConsolidadas === 1 && envio.ordenCompraNumero
                    ? envio.ordenCompraNumero
                    : ocsConsolidadas > 1
                      ? 'de distintos proveedores'
                      : 'sin OC vinculada'
                }
                valueColor="text-teal-700"
              />
              <KpiRapido
                label="Recibidas"
                value={String(totalRecibidas)}
                subtitle={`${progreso}% del total`}
                valueColor="text-emerald-700"
              />
              <KpiRapido
                label="Pendientes"
                value={String(totalPendientes)}
                subtitle={
                  incidenciasAbiertas.length > 0
                    ? `· ${incidenciasAbiertas.length} incidencia${incidenciasAbiertas.length !== 1 ? 's' : ''}`
                    : 'por llegar'
                }
                valueColor={totalPendientes > 0 ? 'text-amber-700' : 'text-slate-700'}
                redBg={incidenciasAbiertas.length > 0}
              />
              {/* S47 — Valor landed reemplaza la barra de progreso (redundante con "Recibidas") */}
              <KpiRapido
                label="Valor landed"
                value={
                  valorLandedUSD > 0
                    ? `$${valorLandedUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                    : '—'
                }
                subtitle={
                  valorLandedUSD > 0 ? 'USD · costo importación' : 'sin valuar'
                }
                valueColor="text-emerald-700"
              />
            </div>
          </div>

          {/* ═══ Tabs internos ═══ */}
          <div className="px-6 border-b border-slate-200 flex gap-1 overflow-x-auto bg-white flex-shrink-0">
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
              active={tab === 'timeline'}
              onClick={() => setTab('timeline')}
              icon={<Clock className="w-3 h-3" />}
              label="Timeline"
              badge={0}
            />
          </div>

          {/* ═══ Grid 2-col: contenido tab + sidebar ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] flex-1 overflow-hidden">
            {/* ─── Contenido del tab ─── */}
            <div className="p-6 overflow-y-auto space-y-4">
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
              {tab === 'timeline' && <TabTimeline envio={envio} />}
            </div>

            {/* ─── Sidebar contextual ─── */}
            <aside className="bg-slate-50 border-l border-slate-200 p-5 space-y-4 overflow-y-auto">
              {/* Courier */}
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  Courier
                </div>
                <div className="text-sm font-medium text-slate-800">
                  {envio.courier || '—'}
                </div>
                {envio.numeroTracking && (
                  <button
                    type="button"
                    onClick={copyTracking}
                    className="text-[11px] text-teal-600 font-mono flex items-center gap-1 hover:text-teal-800 mt-0.5"
                    title="Copiar tracking"
                  >
                    <Hash className="w-3 h-3" />
                    <span className="truncate">{envio.numeroTracking}</span>
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Colaborador */}
              {envio.colaboradorId && envio.colaboradorNombre && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                    Colaborador
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                      {getIniciales(envio.colaboradorNombre)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {envio.colaboradorNombre}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* OC vinculada */}
              {envio.ordenCompraId && envio.ordenCompraNumero && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                    OC vinculada
                  </div>
                  <div className="p-2 bg-white border border-slate-200 rounded-lg">
                    <div className="text-sm font-mono font-semibold text-teal-700 flex items-center gap-1">
                      {envio.ordenCompraNumero}
                      <ExternalLink className="w-3 h-3" />
                    </div>
                    {envio.origenProveedorNombre && (
                      <div className="text-[11px] text-slate-500 truncate">
                        {envio.origenProveedorNombre}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                    Creación
                  </div>
                  <div className="text-sm text-slate-700">
                    {envio.fechaCreacion.toDate().toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
                {envio.fechaSalida && (
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                      Salida
                    </div>
                    <div className="text-sm text-slate-700">
                      {envio.fechaSalida.toDate().toLocaleDateString('es-PE', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </div>
                  </div>
                )}
                {diasEnTransito !== null && diasEnTransito >= 0 && (
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                      Tránsito
                    </div>
                    <div className="text-sm text-slate-700">
                      {diasEnTransito}d
                    </div>
                  </div>
                )}
                {envio.fechaLlegadaReal && (
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                      Llegada
                    </div>
                    <div className="text-sm text-slate-700">
                      {envio.fechaLlegadaReal.toDate().toLocaleDateString('es-PE', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Acciones rápidas */}
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase mb-2">
                  Acciones rápidas
                </div>
                <div className="space-y-1.5">
                  {envio.estado === 'borrador' && (
                    <SidebarAction
                      icon={<CheckCircle className="w-3.5 h-3.5" />}
                      label="Confirmar envío"
                      onClick={() => {
                        onConfirmar(envio.id);
                        onClose();
                      }}
                      variant="teal"
                    />
                  )}
                  {envio.estado === 'confirmado' && (
                    <SidebarAction
                      icon={<Truck className="w-3.5 h-3.5" />}
                      label="Despachar envío"
                      onClick={() => {
                        onEnviar(envio.id);
                        onClose();
                      }}
                      variant="teal"
                    />
                  )}
                  {(envio.estado === 'en_transito' || envio.estado === 'recibida_parcial') && (
                    <SidebarAction
                      icon={<PackageCheck className="w-3.5 h-3.5" />}
                      label={
                        envio.estado === 'recibida_parcial'
                          ? 'Recepción adicional'
                          : 'Registrar recepción'
                      }
                      onClick={() => onIniciarRecepcion(envio)}
                      variant="teal"
                    />
                  )}
                  {esInternacional && (
                    <SidebarAction
                      icon={<DollarSign className="w-3.5 h-3.5" />}
                      label={
                        envio.costoFleteTotal && envio.costoFleteTotal > 0
                          ? 'Editar flete'
                          : 'Agregar flete'
                      }
                      onClick={() => onAbrirEditFlete(envio)}
                      variant="teal"
                    />
                  )}
                  {incidenciasAbiertas.length > 0 && (
                    <SidebarAction
                      icon={<AlertTriangle className="w-3.5 h-3.5" />}
                      label={`Gestionar incidencias (${incidenciasAbiertas.length})`}
                      onClick={() => setShowGestionIncidencias(true)}
                      variant="red"
                    />
                  )}
                  {tieneAduanaPendiente && (
                    <SidebarAction
                      icon={<PackageCheck className="w-3.5 h-3.5" />}
                      label="Liberar aduana"
                      onClick={() => setShowLiberarAduana(true)}
                      variant="amber"
                    />
                  )}
                  {esInternacional &&
                    (envio.estado === 'recibida_completa' ||
                      envio.estado === 'recibida_parcial') &&
                    envio.estadoPagoColaborador !== 'pagado' && (
                      <SidebarAction
                        icon={<Banknote className="w-3.5 h-3.5" />}
                        label={
                          envio.estadoPagoColaborador === 'parcial'
                            ? 'Pago adicional'
                            : 'Pago viajero'
                        }
                        onClick={() => onAbrirPagoColaborador(envio)}
                        variant="emerald"
                      />
                    )}
                  {envio.estadoPagoColaborador === 'pagado' && (
                    <SidebarAction
                      icon={<RefreshCw className="w-3.5 h-3.5" />}
                      label="Sincronizar pago"
                      onClick={() => onReconciliarPago(envio)}
                      variant="slate"
                    />
                  )}
                </div>
              </div>
            </aside>
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

type NodoEstado = 'done' | 'active' | 'pending';

const RutaGrande: React.FC<{
  origenNombre: string;
  origenSubtitulo: string;
  origenPais?: string;
  origenEstado: NodoEstado;
  courierNombre: string | null;
  courierSubtitulo: string;
  enTransito: boolean;
  destinoNombre: string;
  destinoSubtitulo: string;
  destinoPais?: string;
  destinoEstado: NodoEstado;
}> = ({
  origenNombre,
  origenSubtitulo,
  origenPais,
  origenEstado,
  courierNombre,
  enTransito,
  destinoNombre,
  destinoSubtitulo,
  destinoPais,
  destinoEstado,
}) => (
  <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-200">
    <NodoRuta
      flag={getFlag(origenPais)}
      nombre={origenNombre}
      subtitulo={origenSubtitulo}
      estadoBadge={origenEstado === 'done' ? 'Despachado' : origenEstado === 'active' ? 'En origen' : 'Pendiente'}
      estadoVariant={origenEstado === 'done' ? 'success' : origenEstado === 'active' ? 'info' : 'default'}
    />
    <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
    {courierNombre ? (
      <div className="flex-shrink-0 text-center px-2">
        <div
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
            enTransito
              ? 'bg-sky-100 text-sky-700'
              : 'bg-slate-100 text-slate-600'
          )}
        >
          <Truck className="w-3 h-3" />
          {courierNombre}
        </div>
      </div>
    ) : (
      <div className="flex-shrink-0 text-center px-2">
        <span className="text-[11px] text-slate-400 italic">Sin asignar</span>
      </div>
    )}
    <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
    <NodoRuta
      flag={getFlag(destinoPais)}
      nombre={destinoNombre}
      subtitulo={destinoSubtitulo}
      estadoBadge={
        destinoEstado === 'done'
          ? 'Recibido'
          : destinoEstado === 'active'
            ? 'En tránsito'
            : 'Pendiente'
      }
      estadoVariant={destinoEstado === 'done' ? 'success' : destinoEstado === 'active' ? 'info' : 'default'}
    />
  </div>
);

const NodoRuta: React.FC<{
  flag: string;
  nombre: string;
  subtitulo: string;
  estadoBadge: string;
  estadoVariant: 'success' | 'info' | 'default';
}> = ({ flag, nombre, subtitulo, estadoBadge, estadoVariant }) => (
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
      <span className="text-lg">{flag}</span>
      <span className="font-semibold text-sm text-slate-900 truncate">
        {nombre}
      </span>
      <Badge variant={estadoVariant} size="sm">
        {estadoBadge}
      </Badge>
    </div>
    <div className="text-[11px] text-slate-500 truncate">{subtitulo}</div>
  </div>
);

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

      {/* Historial de Pagos al Colaborador */}
      {esInternacional && (envio.pagosColaborador?.length ?? 0) > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="text-xs text-emerald-600 uppercase mb-2 font-semibold">
            Historial de Pagos ({envio.pagosColaborador?.length})
          </div>
          {envio.pagosColaborador?.map((pago: any, idx: number) => (
            <div
              key={pago.id}
              className="flex justify-between items-center text-sm py-1.5 border-b border-emerald-100 last:border-0"
            >
              <div>
                <span className="font-medium text-slate-900">Pago {idx + 1}</span>
                <span className="text-slate-500 ml-2">
                  {pago.fecha?.toDate?.()?.toLocaleDateString('es-PE')}
                </span>
                <span className="text-slate-400 ml-2 text-xs capitalize">
                  {pago.metodoPago?.replace(/_/g, ' ')}
                </span>
              </div>
              <span className="font-semibold text-emerald-700 tabular-nums">
                ${pago.montoUSD.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
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
  const abiertas = incidencias.filter((i) => !i.resuelta);
  const resueltas = incidencias.filter((i) => i.resuelta);

  if (incidencias.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
        <div className="text-sm font-medium text-slate-700">Sin incidencias</div>
        <div className="text-xs text-slate-500 mt-0.5">
          Este envío no tiene problemas registrados
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-xs">
          {abiertas.length > 0 && (
            <span className="text-red-700 font-medium">
              {abiertas.length} sin resolver
            </span>
          )}
          {resueltas.length > 0 && (
            <span className="text-emerald-700">
              {resueltas.length} resuelta{resueltas.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {abiertas.length > 0 && (
            <Button variant="secondary" size="sm" onClick={onGestionar}>
              <AlertTriangle className="w-4 h-4 mr-1.5" />
              Gestionar ({abiertas.length})
            </Button>
          )}
          {tieneAduanaPendiente && (
            <Button variant="primary" size="sm" onClick={onLiberarAduana}>
              <PackageCheck className="w-4 h-4 mr-1.5" />
              Liberar aduana
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {incidencias.map((inc) => (
          <div
            key={inc.id}
            className={cn(
              'p-3 rounded-lg border',
              inc.resuelta ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-200'
            )}
          >
            <div className="flex items-start gap-2">
              {inc.resuelta ? (
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-700 capitalize">
                    {inc.tipo}
                  </span>
                  {inc.sku && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      {inc.sku}
                    </span>
                  )}
                  {inc.productoNombre && (
                    <span className="text-[11px] text-slate-600">
                      · {inc.productoNombre}
                    </span>
                  )}
                </div>
                {inc.descripcion && (
                  <div className="text-xs text-slate-600 mt-0.5">{inc.descripcion}</div>
                )}
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {inc.fechaRegistro.toDate().toLocaleDateString('es-PE', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {inc.resuelta && inc.fechaResolucion && (
                    <>
                      {' '}
                      · resuelta{' '}
                      {inc.fechaResolucion.toDate().toLocaleDateString('es-PE', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TabTimeline: React.FC<{ envio: Envio }> = ({ envio }) => {
  const eventos: { fecha: any; titulo: string; descripcion?: string; icon: any; color: string }[] = [];

  eventos.push({
    fecha: envio.fechaCreacion,
    titulo: 'Envío creado',
    descripcion: `Por ${envio.creadoPor ?? 'sistema'}`,
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

function getFlag(pais?: string): string {
  if (!pais) return '🌐';
  const flags: Record<string, string> = {
    USA: '🇺🇸',
    'Estados Unidos': '🇺🇸',
    CHINA: '🇨🇳',
    China: '🇨🇳',
    COREA: '🇰🇷',
    Corea: '🇰🇷',
    'Corea del Sur': '🇰🇷',
    JAPÓN: '🇯🇵',
    Japón: '🇯🇵',
    MÉXICO: '🇲🇽',
    México: '🇲🇽',
    PERÚ: '🇵🇪',
    Perú: '🇵🇪',
    Peru: '🇵🇪',
  };
  return flags[pais] ?? '🌐';
}

function getIniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
