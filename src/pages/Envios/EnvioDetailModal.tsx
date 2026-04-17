import React, { useState } from "react";
import {
  ChevronRight,
  CheckCircle,
  XCircle,
  Truck,
  Package,
  AlertTriangle,
  DollarSign,
  Clock,
  RefreshCw,
  Banknote,
  MapPin,
  Calendar,
  Hash,
  Copy,
  FileText,
  Building2,
  Plane,
  PackageCheck,
} from "lucide-react";
import { Modal, Button, Badge } from "../../components/common";
import type { Envio, EstadoEnvio, TipoEnvio } from "../../types/envio.types";
import type { Producto } from "../../types/producto.types";
import { getDescripcionProducto } from "../../utils/producto.helpers";
import { UserName } from "./UserName";
import { GestionIncidenciasModal } from "./GestionIncidenciasModal";
import { LiberarAduanaModal } from "./LiberarAduanaModal";
import { useToastStore } from "../../store/toastStore";

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

const getEstadoBadge = (estado: EstadoEnvio) => {
  const config: Record<EstadoEnvio, { variant: "default" | "warning" | "success" | "danger" | "info"; label: string }> = {
    borrador: { variant: "default", label: "Borrador" },
    confirmado: { variant: "warning", label: "Confirmado" },
    en_transito: { variant: "info", label: "En Tránsito" },
    retenida_aduana: { variant: "danger", label: "Aduana" },
    recibida_parcial: { variant: "warning", label: "Parcial" },
    recibida_completa: { variant: "success", label: "Completada" },
    perdida_total: { variant: "danger", label: "Perdida" },
    cancelada: { variant: "danger", label: "Cancelada" },
  };
  const { variant, label } = config[estado] ?? { variant: "default" as const, label: estado };
  return <Badge variant={variant}>{label}</Badge>;
};

const getTipoBadge = (tipo?: TipoEnvio) => {
  if (!tipo) return null;
  return tipo === 'interna_origen'
    ? <Badge variant="default">Interna Origen</Badge>
    : <Badge variant="info">Internacional → Peru</Badge>;
};

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
  const [showGestionIncidencias, setShowGestionIncidencias] = useState(false);
  const [showLiberarAduana, setShowLiberarAduana] = useState(false);
  const [liberandoAduana, setLiberandoAduana] = useState(false);
  const toast = useToastStore();
  const esInternacional = envio.tipo === 'internacional_peru';

  // S40: ¿Hay incidencias de aduana sin resolver? (simplificado post-cleanup)
  const tieneAduanaPendiente = (envio.incidencias || []).some(inc => !inc.resuelta && inc.tipo === 'aduana');

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
        data.descripcion,
      );
      toast.success(`${data.unidadIds.length} unidad(es) liberadas de aduana`);
      setShowLiberarAduana(false);
      onClose(); // Refresca cerrando el detalle; caller recarga envíos
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      toast.error('Error al liberar aduana: ' + msg);
    } finally {
      setLiberandoAduana(false);
    }
  };

  // S38-014: representación clara DE / VÍA / A
  const origenNombre = envio.origenTipo === 'proveedor'
    ? (envio.origenProveedorNombre || 'Proveedor sin nombre')
    : (envio.origenCasillaNombre || 'Casilla Origen');
  const origenSubtitulo = envio.origenTipo === 'proveedor'
    ? (envio.origenProveedorPais ? `Proveedor · ${envio.origenProveedorPais}` : 'Proveedor')
    : (envio.origenCasillaCodigo || 'Casilla');
  const courierNombre = envio.courier || envio.colaboradorNombre || null;
  const destinoSubtitulo = envio.destinoCasillaPais
    ? `Casilla · ${envio.destinoCasillaPais}`
    : (envio.destinoCasillaCodigo || 'Casilla');

  // S38-011: enriquecimiento visual
  const esDDP = (envio as any).esDDP === true;
  const diasEnTransito = envio.fechaSalida
    ? Math.floor((Date.now() - envio.fechaSalida.toDate().getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const stages = [
    { key: 'borrador', label: 'Borrador', icon: FileText },
    { key: 'confirmado', label: 'Confirmado', icon: CheckCircle },
    { key: 'en_transito', label: esDDP ? 'En camino (DDP)' : 'En tránsito', icon: Plane },
    { key: 'recibida_completa', label: 'Recibido', icon: PackageCheck },
  ];
  const currentIdx = stages.findIndex(s => s.key === envio.estado);
  const stageIdx = envio.estado === 'recibida_parcial' ? 2 : currentIdx >= 0 ? currentIdx : 0;

  const copyTracking = async () => {
    if (envio.numeroTracking) {
      try { await navigator.clipboard.writeText(envio.numeroTracking); } catch {}
    }
  };

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title={`Envío ${envio.numeroEnvio}`}
        size="lg"
      >
        <div className="space-y-5">
          {/* HERO — info clave del envío */}
          <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* Top: badges + total unidades */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {getEstadoBadge(envio.estado)}
                {getTipoBadge(envio.tipo)}
                {esDDP && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                    <Truck className="w-3 h-3" /> DDP directo
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <Package className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-900">{envio.totalUnidades}</span> unidades
                <span className="text-slate-300">·</span>
                <span>{envio.productosSummary?.length || 0} productos</span>
              </div>
            </div>

            {/* Timeline visual del estado */}
            <div className="px-5 py-4 bg-white">
              <div className="flex items-center justify-between gap-2">
                {stages.map((stage, idx) => {
                  const StageIcon = stage.icon;
                  const isPast = idx < stageIdx;
                  const isCurrent = idx === stageIdx;
                  const isFuture = idx > stageIdx;
                  return (
                    <React.Fragment key={stage.key}>
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                          isCurrent ? 'bg-teal-100 ring-2 ring-teal-500 ring-offset-2' :
                          isPast ? 'bg-emerald-500 text-white' :
                          'bg-slate-100 text-slate-400'
                        }`}>
                          <StageIcon className={`w-4 h-4 ${isCurrent ? 'text-teal-700' : ''}`} />
                        </div>
                        <span className={`mt-1.5 text-[10px] font-medium text-center max-w-[80px] ${
                          isCurrent ? 'text-teal-700' : isPast ? 'text-emerald-700' : 'text-slate-400'
                        }`}>{stage.label}</span>
                      </div>
                      {idx < stages.length - 1 && (
                        <div className={`flex-1 h-0.5 mb-5 transition-all ${isPast ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* S38-014: Ruta DE → VÍA → A (3 entidades distintas con roles claros) */}
            <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-3 items-start">
                {/* DE — Proveedor o casilla origen */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    <Building2 className="w-3 h-3" />
                    De (Origen)
                  </div>
                  <div className="font-semibold text-slate-900 text-sm leading-tight">{origenNombre}</div>
                  <div className="text-xs text-slate-500 mt-1">{origenSubtitulo}</div>
                </div>

                {/* VÍA — Courier (transporte) */}
                <div className="min-w-0 text-center border-x border-slate-200 px-3">
                  <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    <Truck className="w-3 h-3" />
                    Vía (Transporte)
                  </div>
                  {courierNombre ? (
                    <>
                      <div className="font-semibold text-slate-900 text-sm leading-tight">{courierNombre}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {envio.colaboradorId ? 'Courier registrado' : 'Sin colaborador'}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-400 italic mt-2">Sin asignar</div>
                  )}
                </div>

                {/* A — Casilla destino */}
                <div className="min-w-0 text-right">
                  <div className="flex items-center justify-end gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    <MapPin className="w-3 h-3" />
                    A (Destino)
                  </div>
                  <div className="font-semibold text-slate-900 text-sm leading-tight">{envio.destinoCasillaNombre || 'Sin destino'}</div>
                  <div className="text-xs text-slate-500 mt-1">{destinoSubtitulo}</div>
                </div>
              </div>
            </div>

            {/* Info quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 py-3 bg-white border-t border-slate-100">
              {/* Tracking */}
              <div>
                <div className="text-[10px] uppercase text-slate-400 mb-0.5 flex items-center gap-1">
                  <Hash className="w-3 h-3" /> Tracking
                </div>
                {envio.numeroTracking ? (
                  <button
                    onClick={copyTracking}
                    className="text-xs font-mono font-semibold text-slate-900 hover:text-teal-600 flex items-center gap-1 group"
                    title="Copiar tracking"
                  >
                    <span className="truncate max-w-[120px]">{envio.numeroTracking}</span>
                    <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                  </button>
                ) : (
                  <div className="text-xs text-slate-400 italic">Sin tracking</div>
                )}
              </div>

              {/* Días en tránsito */}
              <div>
                <div className="text-[10px] uppercase text-slate-400 mb-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> En tránsito
                </div>
                {diasEnTransito !== null && diasEnTransito >= 0 ? (
                  <div className="text-xs font-semibold text-slate-900">
                    {diasEnTransito} día{diasEnTransito !== 1 ? 's' : ''}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">—</div>
                )}
              </div>

              {/* Salida */}
              <div>
                <div className="text-[10px] uppercase text-slate-400 mb-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Salida
                </div>
                <div className="text-xs font-semibold text-slate-900">
                  {envio.fechaSalida
                    ? envio.fechaSalida.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
                    : <span className="text-slate-400 italic font-normal">—</span>}
                </div>
              </div>

              {/* Llegada estimada */}
              <div>
                <div className="text-[10px] uppercase text-slate-400 mb-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Llegada
                </div>
                <div className="text-xs font-semibold text-slate-900">
                  {envio.fechaLlegadaReal
                    ? envio.fechaLlegadaReal.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
                    : envio.fechaLlegadaEstimada
                      ? <span className="text-slate-500">{envio.fechaLlegadaEstimada.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })} <span className="text-slate-400 font-normal">est.</span></span>
                      : <span className="text-slate-400 italic font-normal">—</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Incidencias — S38-012 sección consolidada */}
          {(() => {
            const danadas = envio.totalUnidadesDanadas || 0;
            const faltantes = envio.totalUnidadesFaltantes || 0;
            const esRetenida = envio.estado === 'retenida_aduana';
            const esPerdida = envio.estado === 'perdida_total';
            const incidenciasArr = (envio.incidencias || []);
            const incidenciasAbiertas = incidenciasArr.filter(i => !i.resuelta);
            const incidenciasResueltas = incidenciasArr.filter(i => i.resuelta);
            const tieneAlgo = danadas > 0 || faltantes > 0 || esRetenida || esPerdida || incidenciasArr.length > 0;

            if (!tieneAlgo) return null;

            const severidad: 'danger' | 'warning' | 'neutral' =
              (esRetenida || esPerdida || incidenciasAbiertas.length > 0) ? 'danger' :
              (danadas > 0 || faltantes > 0) ? 'warning' :
              'neutral';

            const bg = severidad === 'danger' ? 'bg-red-50 border-red-200'
              : severidad === 'warning' ? 'bg-amber-50 border-amber-200'
              : 'bg-slate-50 border-slate-200';
            const iconColor = severidad === 'danger' ? 'text-red-600'
              : severidad === 'warning' ? 'text-amber-600'
              : 'text-slate-500';

            return (
              <div className={`rounded-xl border ${bg} p-4 space-y-3`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-5 h-5 ${iconColor}`} />
                    <h4 className="text-sm font-semibold text-slate-900">Incidencias del envío</h4>
                  </div>
                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    {esRetenida && <Badge variant="danger">Retenida en aduana</Badge>}
                    {esPerdida && <Badge variant="danger">Envío perdido</Badge>}
                    {danadas > 0 && <span className="text-amber-700 font-medium">{danadas} dañada{danadas !== 1 ? 's' : ''}</span>}
                    {faltantes > 0 && <span className="text-red-700 font-medium">{faltantes} faltante{faltantes !== 1 ? 's' : ''}</span>}
                    {incidenciasAbiertas.length > 0 && (
                      <span className="text-red-700 font-medium">{incidenciasAbiertas.length} sin resolver</span>
                    )}
                    {incidenciasResueltas.length > 0 && (
                      <span className="text-emerald-700">{incidenciasResueltas.length} resuelta{incidenciasResueltas.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>

                {/* Listado de incidencias registradas */}
                {incidenciasArr.length > 0 && (
                  <div className="space-y-1.5">
                    {incidenciasArr.slice(0, 5).map(inc => (
                      <div key={inc.id} className="flex items-start gap-2 p-2 bg-white/60 rounded-lg border border-white">
                        <div className="flex-shrink-0 mt-0.5">
                          {inc.resuelta
                            ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                            : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-slate-700 capitalize">{inc.tipo}</span>
                            {inc.sku && <span className="text-[10px] text-slate-500">{inc.sku}</span>}
                            {inc.productoNombre && <span className="text-[11px] text-slate-600 truncate">· {inc.productoNombre}</span>}
                            {inc.estadoReclamo && (
                              <Badge variant={inc.estadoReclamo === 'cobrado' ? 'success' : inc.estadoReclamo === 'rechazado' ? 'danger' : 'warning'} size="sm">
                                Reclamo: {inc.estadoReclamo}
                              </Badge>
                            )}
                          </div>
                          {inc.descripcion && <div className="text-xs text-slate-600 mt-0.5 truncate">{inc.descripcion}</div>}
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {inc.fechaRegistro.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {inc.resuelta && inc.fechaResolucion && (
                              <> · resuelta {inc.fechaResolucion.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {incidenciasArr.length > 5 && (
                      <div className="text-[11px] text-slate-500 text-center py-1">
                        +{incidenciasArr.length - 5} incidencia{incidenciasArr.length - 5 !== 1 ? 's' : ''} más
                      </div>
                    )}
                  </div>
                )}

                {/* Acciones: gestionar incidencias unificado / liberar aduana */}
                {(incidenciasAbiertas.length > 0 || tieneAduanaPendiente) && (
                  <div className="pt-2 border-t border-white/60 flex flex-wrap justify-end gap-2">
                    {incidenciasAbiertas.length > 0 && (
                      <Button variant="secondary" size="sm" onClick={() => setShowGestionIncidencias(true)}>
                        <AlertTriangle className="w-4 h-4 mr-1.5" />
                        Gestionar incidencias ({incidenciasAbiertas.length})
                      </Button>
                    )}
                    {tieneAduanaPendiente && (
                      <Button variant="primary" size="sm" onClick={() => setShowLiberarAduana(true)}>
                        <PackageCheck className="w-4 h-4 mr-1.5" />
                        Liberar aduana
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Productos */}
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-3">
              Productos ({envio.productosSummary.length}) · {envio.totalUnidades} unidades
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {envio.productosSummary.map(producto => {
                const unidadesProducto = envio.unidades.filter(u => u.productoId === producto.productoId);
                const fleteUnitario = unidadesProducto[0]?.costoFleteUSD ?? 0;
                const fleteTotalProducto = unidadesProducto.reduce((sum, u) => sum + (u.costoFleteUSD || 0), 0);
                const lotes = [...new Set(unidadesProducto.map(u => u.lote).filter(Boolean))];
                const vencimientos = unidadesProducto
                  .map(u => u.fechaVencimiento?.toDate?.())
                  .filter(Boolean)
                  .sort((a, b) => a!.getTime() - b!.getTime());
                const proximoVencer = vencimientos[0];
                const recibidas = unidadesProducto.filter(u => u.estadoEnvio === 'recibida').length;
                const faltantes = unidadesProducto.filter(u => u.estadoEnvio === 'faltante').length;
                const danadas = unidadesProducto.filter(u => u.estadoEnvio === 'danada').length;
                const pFull = productosMap.get(producto.productoId);

                return (
                  <div key={producto.productoId} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">{pFull?.nombreComercial || producto.nombre}</div>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {pFull?.marca && <span className="text-[10px] font-medium text-sky-700 bg-sky-50 px-1 py-0 rounded">{pFull.marca}</span>}
                          {pFull && getDescripcionProducto(pFull) && <span className="text-[10px] text-slate-600 bg-slate-100 px-1 py-0 rounded">{getDescripcionProducto(pFull)}</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-slate-500">
                          <span>{producto.sku}</span>
                          {lotes.length > 0 && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span>Lote{lotes.length > 1 ? 's' : ''}: {lotes.join(', ')}</span>
                            </>
                          )}
                          {proximoVencer && (() => {
                            const dias = Math.ceil((proximoVencer.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            return (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className={dias < 90 ? 'text-red-600 font-medium' : dias < 180 ? 'text-amber-600' : ''}>
                                  Vence: {proximoVencer.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}{dias < 180 && ` (${dias}d)`}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                        {fleteUnitario > 0 && (
                          <div className="text-xs text-emerald-600 mt-1">
                            Flete: ${fleteUnitario.toFixed(2)}/u · Total flete: ${fleteTotalProducto.toFixed(2)}
                          </div>
                        )}
                        {(envio.estado === 'recibida_completa' || envio.estado === 'recibida_parcial') && (
                          <div className="flex items-center gap-2 mt-1">
                            {recibidas > 0 && <span className="text-xs text-emerald-600 flex items-center gap-0.5"><CheckCircle className="h-3 w-3" /> {recibidas} recibida{recibidas > 1 ? 's' : ''}</span>}
                            {faltantes > 0 && <span className="text-xs text-red-600 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> {faltantes} faltante{faltantes > 1 ? 's' : ''}</span>}
                            {danadas > 0 && <span className="text-xs text-amber-600 flex items-center gap-0.5"><XCircle className="h-3 w-3" /> {danadas} danada{danadas > 1 ? 's' : ''}</span>}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-bold text-slate-900">{producto.cantidad}</div>
                        <div className="text-xs text-slate-500">unid.</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fecha de creación (solo, las otras están en el hero) */}
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <FileText className="w-3 h-3" />
            Creado el {envio.fechaCreacion.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>

          {/* Flete (solo internacional) */}
          {esInternacional && (
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">Costo de Flete</div>
                  {envio.costoFleteTotal && envio.costoFleteTotal > 0 ? (
                    <div className="font-semibold text-sky-700">${envio.costoFleteTotal.toFixed(2)} USD</div>
                  ) : (
                    <div className="text-sm text-amber-600">Sin flete asignado</div>
                  )}
                </div>
                {envio.estado !== 'cancelada' && (
                  <Button variant="secondary" onClick={() => onAbrirEditFlete(envio)}>
                    <DollarSign className="h-4 w-4 mr-1" />
                    {envio.costoFleteTotal && envio.costoFleteTotal > 0 ? 'Editar Flete' : 'Agregar Flete'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Peso */}
          {esInternacional && envio.pesoTotalLibras && envio.pesoTotalLibras > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500 uppercase mb-2 font-semibold">Analisis por Peso</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-slate-500">Peso total</div>
                  <div className="font-semibold text-slate-900">{envio.pesoTotalLibras.toFixed(2)} lb</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Unidades</div>
                  <div className="font-semibold text-slate-900">{envio.totalUnidades}</div>
                </div>
                {envio.costoFletePorLibra && envio.costoFletePorLibra > 0 && (
                  <div>
                    <div className="text-xs text-slate-500">Costo/lb</div>
                    <div className="font-semibold text-sky-700">${envio.costoFletePorLibra.toFixed(2)} USD/lb</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Historial de Pagos al Colaborador */}
          {esInternacional && (() => {
            const pagos = envio.pagosColaborador || [];
            if (pagos.length === 0) return null;
            const totalPagadoUSD = envio.montoPagadoUSD || pagos.reduce((s, p) => s + p.montoUSD, 0);
            const fleteTotal = envio.costoFleteTotal || 0;
            return (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="text-xs text-emerald-600 uppercase mb-2 font-semibold">
                  Historial de Pagos ({pagos.length})
                </div>
                {pagos.map((pago, idx) => (
                  <div key={pago.id} className="flex justify-between items-center text-sm py-1.5 border-b border-emerald-100 last:border-0">
                    <div>
                      <span className="font-medium text-slate-900">Pago {idx + 1}</span>
                      <span className="text-slate-500 ml-2">{pago.fecha?.toDate?.() ? pago.fecha.toDate().toLocaleDateString('es-PE') : ''}</span>
                      <span className="text-slate-400 ml-2 text-xs capitalize">{pago.metodoPago?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="font-semibold text-emerald-700">${pago.montoUSD.toFixed(2)}</span>
                      {pago.errorTesoreria && <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Sin sync</span>}
                    </div>
                  </div>
                ))}
                {fleteTotal > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Pagado: ${totalPagadoUSD.toFixed(2)}</span>
                      <span>Total: ${fleteTotal.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (totalPagadoUSD / fleteTotal) * 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Historial de Recepciones */}
          {(envio.estado === 'recibida_completa' || envio.estado === 'recibida_parcial') && (() => {
            const recepciones = envio.recepciones || [];
            if (recepciones.length === 0) return null;
            const totalRecibidas = envio.totalUnidadesRecibidas ?? recepciones.reduce((s, r) => s + r.unidadesRecibidas, 0);
            const totalDanadas = envio.totalUnidadesDanadas ?? recepciones.reduce((s, r) => s + r.unidadesDanadas, 0);
            return (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="text-xs text-purple-600 uppercase mb-2 font-semibold">
                  Historial de Recepciones ({recepciones.length})
                </div>
                {recepciones.map((rec, idx) => (
                  <div key={rec.id || idx} className="text-sm py-2 border-b border-purple-100 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">Recepcion #{rec.numero || idx + 1}</span>
                      <span className="text-slate-500 text-xs">{rec.fechaRecepcion?.toDate?.() ? rec.fechaRecepcion.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</span>
                    </div>
                    {rec.recibidoPor && (
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">Por: <UserName userId={rec.recibidoPor} /></p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {rec.unidadesRecibidas > 0 && <span className="text-xs text-emerald-600 flex items-center gap-0.5"><CheckCircle className="h-3 w-3" /> {rec.unidadesRecibidas} recibida{rec.unidadesRecibidas > 1 ? 's' : ''}</span>}
                      {rec.unidadesDanadas > 0 && <span className="text-xs text-amber-600 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> {rec.unidadesDanadas} danada{rec.unidadesDanadas > 1 ? 's' : ''}</span>}
                      {rec.unidadesFaltantes > 0 && <span className="text-xs text-red-600 flex items-center gap-0.5"><XCircle className="h-3 w-3" /> {rec.unidadesFaltantes} faltante{rec.unidadesFaltantes > 1 ? 's' : ''}</span>}
                    </div>
                    {rec.observaciones && <div className="text-xs text-slate-500 mt-0.5 italic">"{rec.observaciones}"</div>}
                  </div>
                ))}
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Recibidas: {totalRecibidas}{totalDanadas > 0 ? ` (${totalDanadas} danadas)` : ''}</span>
                    <span>Total: {envio.totalUnidades}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${envio.totalUnidades > 0 ? Math.min(100, ((totalRecibidas + totalDanadas) / envio.totalUnidades) * 100) : 0}%` }} />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Notas */}
          {envio.notas && (
            <div>
              <div className="text-xs text-slate-500 uppercase mb-1">Notas</div>
              <div className="text-slate-900">{envio.notas}</div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex justify-end space-x-3 pt-4 border-t flex-wrap gap-2">
            <Button variant="secondary" onClick={onClose}>Cerrar</Button>
            {envio.estado === 'borrador' && (
              <Button variant="primary" onClick={() => { onConfirmar(envio.id); onClose(); }}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar
              </Button>
            )}
            {envio.estado === 'confirmado' && (
              <Button variant="primary" onClick={() => { onEnviar(envio.id); onClose(); }}>
                <Truck className="h-4 w-4 mr-2" />
                Marcar como Enviado
              </Button>
            )}
            {(envio.estado === 'en_transito' || envio.estado === 'recibida_parcial') && (
              <Button variant="primary" onClick={() => onIniciarRecepcion(envio)}>
                <Package className="h-4 w-4 mr-2" />
                {envio.estado === 'recibida_parcial' ? 'Registrar Recepcion Adicional' : 'Registrar Recepcion'}
              </Button>
            )}
            {esInternacional &&
             (envio.estado === 'recibida_completa' || envio.estado === 'recibida_parcial') &&
             envio.estadoPagoColaborador !== 'pagado' && (
              <Button variant="success" onClick={() => onAbrirPagoColaborador(envio)}>
                <Banknote className="h-4 w-4 mr-2" />
                {envio.estadoPagoColaborador === 'parcial' ? 'Registrar Pago Adicional' : 'Registrar Pago Viajero'}
              </Button>
            )}
            {envio.estadoPagoColaborador === 'parcial' && (
              <Badge variant="warning">
                <Clock className="h-3 w-3 mr-1" />
                Pago Parcial ({((envio.montoPagadoUSD || 0) / (envio.costoFleteTotal || 1) * 100).toFixed(0)}%)
              </Badge>
            )}
            {envio.estadoPagoColaborador === 'pagado' && (
              <>
                <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />Pago Registrado</Badge>
                <Button variant="ghost" size="sm" onClick={() => onReconciliarPago(envio)} title="Verificar y sincronizar el movimiento en Tesoreria">
                  <RefreshCw className="h-4 w-4 mr-1" />Sincronizar
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* S40 Bloque C: Modal gestión de incidencias unificado (dañadas/perdidas/aduana) */}
      {showGestionIncidencias && (
        <GestionIncidenciasModal
          transferencia={envio as any}
          productosMap={productosMap}
          onClose={() => setShowGestionIncidencias(false)}
          onSuccess={() => { setShowGestionIncidencias(false); onClose(); }}
        />
      )}

      {/* S40 Bloque A: Modal liberar aduana (alternativa directa cuando solo hay aduana) */}
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
