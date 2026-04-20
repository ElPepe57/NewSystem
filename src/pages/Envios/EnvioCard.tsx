import React from "react";
import {
  ArrowRightLeft,
  Plane,
  ChevronRight,
  CheckCircle,
  XCircle,
  Truck,
  Package,
  ScanLine,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, Badge, Button } from "../../components/common";
import type { Envio, EstadoEnvio, TipoEnvio } from "../../types/envio.types";
import { StatusBadge, RouteVisual } from '../../design-system';
import type { RouteNode, RouteSegment } from '../../design-system';
import type { Producto } from "../../types/producto.types";
import { getDescripcionProducto } from "../../utils/producto.helpers";

interface EnvioCardProps {
  envio: Envio;
  productosMap: Map<string, Producto>;
  onSelect: (envio: Envio) => void;
  onConfirmar: (id: string) => void;
  onEnviar: (id: string) => void;
  onCancelar: (id: string) => void;
  onIniciarRecepcion: (envio: Envio) => void;
}

const getEstadoBadge = (estado: EstadoEnvio) => {
  const config: Record<EstadoEnvio, { variant: "neutral" | "warning" | "success" | "danger" | "info"; label: string }> = {
    borrador: { variant: "neutral", label: "Borrador" },
    confirmado: { variant: "warning", label: "Confirmado" },
    en_transito: { variant: "info", label: "En Tránsito" },
    retenida_aduana: { variant: "danger", label: "Aduana" },
    recibida_parcial: { variant: "warning", label: "Parcial" },
    recibida_completa: { variant: "success", label: "Completada" },
    perdida_total: { variant: "danger", label: "Perdida" },
    cancelada: { variant: "danger", label: "Cancelada" },
  };
  const { variant, label } = config[estado] ?? { variant: "neutral" as const, label: estado };
  return <StatusBadge variant={variant} dot>{label}</StatusBadge>;
};

/**
 * Resumen consolidado de incidencias activas en un envio.
 * Incluye: unidades danadas, unidades faltantes, estados excepcion, incidencias[] sin resolver.
 */
const getResumenIncidencias = (envio: Envio) => {
  const danadas = envio.totalUnidadesDanadas || 0;
  const faltantes = envio.totalUnidadesFaltantes || 0;
  const incidenciasAbiertas = (envio.incidencias || []).filter(i => !i.resuelta).length;
  const esRetenida = envio.estado === 'retenida_aduana';
  const esPerdida = envio.estado === 'perdida_total';

  const total = danadas + faltantes + incidenciasAbiertas + (esRetenida ? 1 : 0) + (esPerdida ? 1 : 0);
  if (total === 0) return null;

  const partes: string[] = [];
  if (esRetenida) partes.push('Retenida en aduana');
  if (esPerdida) partes.push('Envio perdido');
  if (danadas > 0) partes.push(`${danadas} u. danada${danadas !== 1 ? 's' : ''}`);
  if (faltantes > 0) partes.push(`${faltantes} u. faltante${faltantes !== 1 ? 's' : ''}`);
  if (incidenciasAbiertas > 0) partes.push(`${incidenciasAbiertas} incidencia${incidenciasAbiertas !== 1 ? 's' : ''} sin resolver`);

  const severidad: 'danger' | 'warning' = (esRetenida || esPerdida) ? 'danger' : 'warning';
  return { total, tooltip: partes.join(' · '), severidad };
};

const getIncidenciasBadge = (envio: Envio) => {
  const resumen = getResumenIncidencias(envio);
  if (!resumen) return null;
  return (
    <StatusBadge variant={resumen.severidad}>
      <AlertTriangle className="h-3 w-3 mr-1 inline" />
      {resumen.total} {resumen.total === 1 ? 'incidencia' : 'incidencias'}
    </StatusBadge>
  );
};

const getTipoBadge = (tipo?: TipoEnvio) => {
  if (!tipo) return null;
  return tipo === 'interna_origen'
    ? <StatusBadge variant="neutral">Interna Origen</StatusBadge>
    : <StatusBadge variant="info">Internacional → Perú</StatusBadge>;
};

// S38-014: incluir país/contexto del origen
const getOrigenLabel = (envio: Envio): { nombre: string; codigo?: string } => {
  if (envio.origenTipo === 'proveedor') {
    return {
      nombre: envio.origenProveedorNombre || 'Proveedor sin nombre',
      codigo: envio.origenProveedorPais ? `Proveedor · ${envio.origenProveedorPais}` : 'Proveedor',
    };
  }
  return {
    nombre: envio.origenCasillaNombre || 'Casilla Origen',
    codigo: envio.origenCasillaCodigo,
  };
};

export const EnvioCard: React.FC<EnvioCardProps> = ({
  envio,
  productosMap,
  onSelect,
  onConfirmar,
  onEnviar,
  onCancelar,
  onIniciarRecepcion,
}) => {
  const navigate = useNavigate();
  const fechaCreacion = envio.fechaCreacion.toDate();
  const fechaSalida = envio.fechaSalida?.toDate();
  const origen = getOrigenLabel(envio);
  const esInternacional = envio.tipo === 'internacional_peru';

  return (
    <Card
      padding="md"
      className="hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => onSelect(envio)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
            esInternacional ? 'bg-sky-100' : 'bg-slate-100'
          }`}>
            {esInternacional
              ? <Plane className="h-6 w-6 text-sky-600" />
              : <ArrowRightLeft className="h-6 w-6 text-slate-600" />
            }
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{envio.numeroEnvio}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {getTipoBadge(envio.tipo)}
              {getEstadoBadge(envio.estado)}
              {(() => {
                const resumen = getResumenIncidencias(envio);
                if (!resumen) return null;
                return <span title={resumen.tooltip}>{getIncidenciasBadge(envio)}</span>;
              })()}
            </div>
          </div>
        </div>
        <div className="text-right text-sm text-slate-500">
          {fechaCreacion.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {/* S42bf — Banner de estado destacado (mockup S40 L2133-2140).
          Prioridad: incidencia abierta > en_transito > recibida_parcial >
          recibida_completa > borrador/confirmado "Pendiente despachar". */}
      {(() => {
        const incidenciasAbiertas = (envio.incidencias || []).filter(i => !i.resuelta);
        const tieneIncidencia =
          incidenciasAbiertas.length > 0 ||
          (envio.totalUnidadesFaltantes || 0) > 0 ||
          (envio.totalUnidadesDanadas || 0) > 0 ||
          envio.estado === 'retenida_aduana' ||
          envio.estado === 'perdida_total';

        if (tieneIncidencia) {
          const count = incidenciasAbiertas.length || 1;
          const resumenInc = getResumenIncidencias(envio);
          return (
            <div className="mb-3 flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-xs text-red-800">
                <div className="font-semibold">
                  {count === 1 ? '1 incidencia abierta' : `${count} incidencias abiertas`}
                </div>
                {resumenInc && <div className="mt-0.5 opacity-90">{resumenInc.tooltip}</div>}
              </div>
            </div>
          );
        }

        if (envio.estado === 'en_transito' && fechaSalida) {
          return (
            <div className="mb-3 flex items-center justify-between px-3 py-2 bg-sky-50 border border-sky-200 rounded-lg text-xs">
              <div className="flex items-center gap-2 text-sky-800">
                <Truck className="w-4 h-4 text-sky-600" />
                <span className="font-semibold">
                  En camino desde {fechaSalida.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                </span>
              </div>
              {envio.diasEnTransito && (
                <span className="text-sky-700 font-medium">{envio.diasEnTransito} días</span>
              )}
            </div>
          );
        }

        if (envio.estado === 'recibida_parcial') {
          const recibidas = envio.totalUnidadesRecibidas ?? (envio.unidades ?? []).filter(u => u.estadoEnvio === 'recibida').length;
          const danadas = envio.totalUnidadesDanadas ?? (envio.unidades ?? []).filter(u => u.estadoEnvio === 'danada').length;
          const procesadas = recibidas + danadas;
          const totalU = envio.totalUnidades;
          const pct = totalU > 0 ? Math.round((procesadas / totalU) * 100) : 0;
          return (
            <div className="mb-3 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-800 font-semibold">
                  <Package className="w-4 h-4 text-purple-600" />
                  Recepción parcial · {procesadas}/{totalU} unidades
                </div>
                <span className="text-purple-700 font-medium tabular-nums">{pct}%</span>
              </div>
              <div className="mt-1.5 h-1.5 bg-purple-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        }

        if (envio.estado === 'recibida_completa') {
          return (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-semibold">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Envío recibido completo
            </div>
          );
        }

        if (envio.estado === 'borrador' || envio.estado === 'confirmado') {
          return (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-semibold">
              <Clock className="w-4 h-4 text-amber-600" />
              Pendiente despachar
            </div>
          );
        }

        return null;
      })()}

      {/* S41 — Ruta visual con RouteVisual del DS */}
      <div className="mb-4 p-3 bg-slate-50 rounded-lg">
        {(() => {
          const paisOrigen = envio.origenProveedorPais ?? envio.origenCasillaPais;
          const paisDestino = envio.destinoCasillaPais;
          const nodes: RouteNode[] = [
            {
              tipo: envio.origenTipo === 'proveedor' ? 'proveedor' : 'casilla',
              flag: getFlagByPais(paisOrigen),
              nombre: origen.nombre.split(' ')[0],
              codigo: origen.codigo,
              subtexto: paisOrigen,
              state: 'done',
            },
            {
              tipo: 'destino',
              flag: getFlagByPais(paisDestino),
              nombre: envio.destinoCasillaNombre?.split(' ')[0],
              subtexto: envio.destinoCasillaPais
                ? `Casilla · ${envio.destinoCasillaPais}`
                : envio.destinoCasillaCodigo,
              state: envio.estado === 'recibida_completa' ? 'done'
                : envio.estado === 'en_transito' ? 'active'
                : 'pending',
            },
          ];
          // S42bg — BUG FIX: antes `envio.courier || envio.colaboradorNombre`.
          // El colaboradorNombre NO es transportador — normalmente es el dueño
          // de la casilla destino (para envíos proveedor→casilla). Solo el
          // courier explícito (seteado al despachar) debe aparecer en el
          // segmento de la ruta.
          const segments: RouteSegment[] = [
            {
              label: envio.courier || 'Sin despachar',
              subtexto: envio.numeroTracking ? `Tracking: ${envio.numeroTracking.slice(-8)}` : undefined,
              state: envio.courier ? 'done' : 'pending',
            },
          ];
          return <RouteVisual size="sm" nodes={nodes} segments={segments} />;
        })()}
      </div>

      {/* Productos */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-500 uppercase">
            {(envio.productosSummary?.length ?? 0)} producto{(envio.productosSummary?.length ?? 0) !== 1 ? 's' : ''} · {envio.totalUnidades} unidades
          </span>
          {envio.costoFleteTotal != null && envio.costoFleteTotal > 0 ? (
            <span className="text-xs font-medium text-emerald-600">Flete: ${envio.costoFleteTotal.toFixed(2)}</span>
          ) : esInternacional ? (
            <span className="text-xs text-amber-500">Sin flete</span>
          ) : null}
        </div>
        <div className="space-y-1">
          {(envio.productosSummary ?? []).slice(0, 4).map(producto => {
            const unidadesProducto = (envio.unidades ?? []).filter(u => u.productoId === producto.productoId);
            const fleteUnitario = unidadesProducto.length > 0 ? (unidadesProducto[0].costoFleteUSD ?? 0) : 0;
            const lotes = [...new Set(unidadesProducto.map(u => u.lote).filter(Boolean))];
            const pFull = productosMap.get(producto.productoId);
            return (
              <div key={producto.productoId} className="flex items-center justify-between py-1.5 px-2 bg-slate-50 rounded text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-900 truncate">{pFull?.nombreComercial || producto.nombre}</span>
                    <span className="text-xs text-slate-400 flex-shrink-0">x{producto.cantidad}</span>
                  </div>
                  {pFull && (
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {pFull.marca && <span className="text-[10px] font-medium text-sky-700 bg-sky-50 px-1 py-0 rounded">{pFull.marca}</span>}
                      {getDescripcionProducto(pFull) && <span className="text-[10px] text-slate-600 bg-slate-100 px-1 py-0 rounded">{getDescripcionProducto(pFull)}</span>}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span>{producto.sku}</span>
                    {lotes.length > 0 && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span>Lote{lotes.length > 1 ? 's' : ''}: {lotes.slice(0, 2).join(', ')}{lotes.length > 2 ? ` +${lotes.length - 2}` : ''}</span>
                      </>
                    )}
                    {fleteUnitario > 0 && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-emerald-600">Flete: ${fleteUnitario.toFixed(2)}/u</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {(envio.productosSummary?.length ?? 0) > 4 && (
            <div className="text-xs text-slate-400 text-center py-1">
              +{(envio.productosSummary?.length ?? 0) - 4} productos mas
            </div>
          )}
        </div>
      </div>

      {/* S42bf — Boxes duplicados de en_transito y recibida_parcial ELIMINADOS.
          Ahora el estado se muestra en el banner superior unificado. */}
      {false && envio.estado === 'recibida_parcial' && (() => {
        const recibidas = envio.totalUnidadesRecibidas ?? (envio.unidades ?? []).filter(u => u.estadoEnvio === 'recibida').length;
        const danadas = envio.totalUnidadesDanadas ?? (envio.unidades ?? []).filter(u => u.estadoEnvio === 'danada').length;
        const procesadas = recibidas + danadas;
        const totalU = envio.totalUnidades;
        const numRecepciones = (envio.recepciones || []).length;
        return (
          <div className="p-2 bg-purple-50 rounded-lg text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-purple-700 font-medium flex items-center gap-1">
                <Package className="h-4 w-4" />
                {procesadas}/{totalU} recibidas
              </span>
              <span className="text-xs text-purple-500">{numRecepciones} recep.</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <div className="bg-purple-500 h-1.5 rounded-full transition-all" style={{ width: `${totalU > 0 ? (procesadas / totalU) * 100 : 0}%` }} />
            </div>
          </div>
        );
      })()}

      {/* Tracking */}
      {envio.numeroTracking && (
        <div className="mt-3 flex items-center text-sm text-slate-600">
          <Package className="h-4 w-4 mr-2 text-slate-400" />
          Tracking: {envio.numeroTracking}
        </div>
      )}

      {/* Acciones rapidas: borrador/confirmado */}
      {(envio.estado === 'borrador' || envio.estado === 'confirmado') && (
        <div className="mt-4 pt-4 border-t flex justify-end space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onCancelar(envio.id); }}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          {envio.estado === 'borrador' && (
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onConfirmar(envio.id); }}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Confirmar
            </Button>
          )}
          {envio.estado === 'confirmado' && (
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onEnviar(envio.id); }}
            >
              <Truck className="h-4 w-4 mr-1" />
              Enviar
            </Button>
          )}
        </div>
      )}

      {/* Acciones en_transito */}
      {envio.estado === 'en_transito' && (
        <div className="mt-4 pt-4 border-t flex justify-end space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onIniciarRecepcion(envio); }}
          >
            <Package className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Recibir</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/escaner?modo=recepcion&envioId=${envio.id}`);
            }}
          >
            <ScanLine className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Recibir con Escáner</span>
            <span className="sm:hidden">Escáner</span>
          </Button>
        </div>
      )}

      {/* Accion recepcion parcial */}
      {envio.estado === 'recibida_parcial' && (
        <div className="mt-4 pt-4 border-t flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onIniciarRecepcion(envio); }}
          >
            <Package className="h-4 w-4 mr-1" />
            Recepcion Adicional
          </Button>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </div>
    </Card>
  );
};

// Helper: bandera emoji por país (S41)
function getFlagByPais(pais?: string): string {
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
