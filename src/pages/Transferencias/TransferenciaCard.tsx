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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, Badge, Button } from "../../components/common";
import type { Transferencia, EstadoTransferencia, TipoTransferencia } from "../../types/transferencia.types";
import type { Producto } from "../../types/producto.types";
import {
  esTipoTransferenciaInterna,
  esTipoTransferenciaInternacional,
  getLabelTipoTransferencia,
} from "../../utils/multiOrigen.helpers";

interface TransferenciaCardProps {
  transferencia: Transferencia;
  productosMap: Map<string, Producto>;
  onSelect: (transferencia: Transferencia) => void;
  onConfirmar: (id: string) => void;
  onEnviar: (id: string) => void;
  onCancelar: (id: string) => void;
  onIniciarRecepcion: (transferencia: Transferencia) => void;
}

const getEstadoBadge = (estado: EstadoTransferencia) => {
  const config: Record<EstadoTransferencia, { variant: "default" | "warning" | "success" | "danger" | "info"; label: string }> = {
    borrador: { variant: "default", label: "Borrador" },
    preparando: { variant: "warning", label: "Preparando" },
    en_transito: { variant: "info", label: "En Tránsito" },
    recibida_parcial: { variant: "warning", label: "Parcial" },
    recibida_completa: { variant: "success", label: "Completada" },
    cancelada: { variant: "danger", label: "Cancelada" }
  };
  const { variant, label } = config[estado];
  return <Badge variant={variant}>{label}</Badge>;
};

const getTipoBadge = (tipo: TipoTransferencia, paisOrigen?: string) => {
  return esTipoTransferenciaInterna(tipo)
    ? <Badge variant="default">{getLabelTipoTransferencia(tipo, paisOrigen)}</Badge>
    : <Badge variant="info">{getLabelTipoTransferencia(tipo, paisOrigen)}</Badge>;
};

export const TransferenciaCard: React.FC<TransferenciaCardProps> = ({
  transferencia,
  productosMap,
  onSelect,
  onConfirmar,
  onEnviar,
  onCancelar,
  onIniciarRecepcion,
}) => {
  const navigate = useNavigate();
  const fechaCreacion = transferencia.fechaCreacion.toDate();
  const fechaSalida = transferencia.fechaSalida?.toDate();

  return (
    <Card
      padding="md"
      className="hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => onSelect(transferencia)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
            esTipoTransferenciaInternacional(transferencia.tipo) ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            {esTipoTransferenciaInternacional(transferencia.tipo)
              ? <Plane className="h-6 w-6 text-blue-600" />
              : <ArrowRightLeft className="h-6 w-6 text-gray-600" />
            }
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{transferencia.numeroTransferencia}</h3>
            <div className="flex items-center space-x-2 mt-1">
              {getTipoBadge(transferencia.tipo, (transferencia as any).paisOrigen)}
              {getEstadoBadge(transferencia.estado)}
            </div>
          </div>
        </div>
        <div className="text-right text-sm text-gray-500">
          {fechaCreacion.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {/* Ruta */}
      <div className="flex items-center space-x-2 mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <div className="text-xs text-gray-500">Origen</div>
          <div className="font-medium text-gray-900">{transferencia.almacenOrigenNombre}</div>
          <div className="text-xs text-gray-500">{transferencia.almacenOrigenCodigo}</div>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
        <div className="flex-1 text-right">
          <div className="text-xs text-gray-500">Destino</div>
          <div className="font-medium text-gray-900">{transferencia.almacenDestinoNombre}</div>
          <div className="text-xs text-gray-500">{transferencia.almacenDestinoCodigo}</div>
        </div>
      </div>

      {/* Productos */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase">
            {transferencia.productosSummary.length} producto{transferencia.productosSummary.length !== 1 ? 's' : ''} · {transferencia.totalUnidades} unidades
          </span>
          {transferencia.costoFleteTotal != null && transferencia.costoFleteTotal > 0 ? (
            <span className="text-xs font-medium text-green-600">Flete: ${transferencia.costoFleteTotal.toFixed(2)}</span>
          ) : esTipoTransferenciaInternacional(transferencia.tipo) ? (
            <span className="text-xs text-amber-500">Sin flete</span>
          ) : null}
        </div>
        <div className="space-y-1">
          {transferencia.productosSummary.slice(0, 4).map(producto => {
            const unidadesProducto = transferencia.unidades.filter(u => u.productoId === producto.productoId);
            const fleteUnitario = unidadesProducto.length > 0 ? unidadesProducto[0].costoFleteUSD : 0;
            const lotes = [...new Set(unidadesProducto.map(u => u.lote).filter(Boolean))];

            const pFull = productosMap.get(producto.productoId);
            return (
              <div key={producto.productoId} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-900 truncate">{pFull?.nombreComercial || producto.nombre}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">x{producto.cantidad}</span>
                  </div>
                  {pFull && (
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {pFull.marca && <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1 py-0 rounded">{pFull.marca}</span>}
                      {pFull.presentacion && <span className="text-[10px] text-gray-600 bg-gray-100 px-1 py-0 rounded capitalize">{pFull.presentacion.replace('_', ' ')}</span>}
                      {pFull.dosaje && <span className="text-[10px] text-gray-600 bg-gray-100 px-1 py-0 rounded">{pFull.dosaje}</span>}
                      {pFull.contenido && <span className="text-[10px] text-gray-600 bg-gray-100 px-1 py-0 rounded">{pFull.contenido}</span>}
                      {pFull.sabor && <span className="text-[10px] text-purple-700 bg-purple-50 px-1 py-0 rounded">{pFull.sabor}</span>}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span>{producto.sku}</span>
                    {lotes.length > 0 && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span>Lote{lotes.length > 1 ? 's' : ''}: {lotes.slice(0, 2).join(', ')}{lotes.length > 2 ? ` +${lotes.length - 2}` : ''}</span>
                      </>
                    )}
                    {fleteUnitario > 0 && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-green-600">Flete: ${fleteUnitario.toFixed(2)}/u</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {transferencia.productosSummary.length > 4 && (
            <div className="text-xs text-gray-400 text-center py-1">
              +{transferencia.productosSummary.length - 4} productos mas
            </div>
          )}
        </div>
      </div>

      {/* Estado especifico */}
      {transferencia.estado === 'en_transito' && fechaSalida && (
        <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg text-sm">
          <div className="flex items-center text-blue-700">
            <Truck className="h-4 w-4 mr-2" />
            En camino desde {fechaSalida.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
          </div>
          {transferencia.diasEnTransito && (
            <span className="text-blue-600 font-medium">{transferencia.diasEnTransito} dias</span>
          )}
        </div>
      )}

      {/* Progreso de recepcion parcial */}
      {transferencia.estado === 'recibida_parcial' && (() => {
        const recibidas = transferencia.totalUnidadesRecibidas ?? transferencia.unidades.filter(u => u.estadoTransferencia === 'recibida').length;
        const danadas = transferencia.totalUnidadesDanadas ?? transferencia.unidades.filter(u => u.estadoTransferencia === 'danada').length;
        const procesadas = recibidas + danadas;
        const totalU = transferencia.totalUnidades;
        const numRecepciones = (transferencia.recepcionesTransferencia || []).length || (transferencia.recepcion ? 1 : 0);
        return (
          <div className="p-2 bg-purple-50 rounded-lg text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-purple-700 font-medium flex items-center gap-1">
                <Package className="h-4 w-4" />
                {procesadas}/{totalU} recibidas
              </span>
              <span className="text-xs text-purple-500">{numRecepciones} recep.</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div className="bg-purple-500 h-1.5 rounded-full transition-all" style={{ width: `${(procesadas / totalU) * 100}%` }} />
            </div>
          </div>
        );
      })()}

      {/* Tracking */}
      {transferencia.numeroTracking && (
        <div className="mt-3 flex items-center text-sm text-gray-600">
          <Package className="h-4 w-4 mr-2 text-gray-400" />
          Tracking: {transferencia.numeroTracking}
        </div>
      )}

      {/* Acciones rapidas */}
      {(transferencia.estado === 'borrador' || transferencia.estado === 'preparando') && (
        <div className="mt-4 pt-4 border-t flex justify-end space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onCancelar(transferencia.id); }}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          {transferencia.estado === 'borrador' && (
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onConfirmar(transferencia.id); }}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Confirmar
            </Button>
          )}
          {transferencia.estado === 'preparando' && (
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onEnviar(transferencia.id); }}
            >
              <Truck className="h-4 w-4 mr-1" />
              Enviar
            </Button>
          )}
        </div>
      )}

      {/* Acciones para en_transito: Recibir manual o con escáner */}
      {transferencia.estado === 'en_transito' && (
        <div className="mt-4 pt-4 border-t flex justify-end space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onIniciarRecepcion(transferencia); }}
          >
            <Package className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Recibir</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/escaner?modo=recepcion&transferenciaId=${transferencia.id}`);
            }}
          >
            <ScanLine className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Recibir con Escáner</span>
            <span className="sm:hidden">Escáner</span>
          </Button>
        </div>
      )}

      {/* Accion rapida para recepcion parcial */}
      {transferencia.estado === 'recibida_parcial' && (
        <div className="mt-4 pt-4 border-t flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onIniciarRecepcion(transferencia); }}
          >
            <Package className="h-4 w-4 mr-1" />
            Recepcion Adicional
          </Button>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>
    </Card>
  );
};
