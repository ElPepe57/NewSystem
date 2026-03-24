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
  ScanLine,
} from "lucide-react";
import { Modal, Button, Badge } from "../../components/common";
import type { Transferencia, EstadoTransferencia, TipoTransferencia } from "../../types/transferencia.types";
import type { Producto } from "../../types/producto.types";
import {
  esTipoTransferenciaInterna,
  esTipoTransferenciaInternacional,
  getLabelTipoTransferencia,
} from "../../utils/multiOrigen.helpers";
import { UserName } from "./UserName";
import { GestionDanadasModal } from "./GestionDanadasModal";

interface TransferenciaDetailModalProps {
  transferencia: Transferencia;
  productosMap: Map<string, Producto>;
  userId: string | undefined;
  onClose: () => void;
  onConfirmar: (id: string) => void;
  onEnviar: (id: string) => void;
  onIniciarRecepcion: (transferencia: Transferencia) => void;
  onAbrirPagoViajero: (transferencia: Transferencia) => void;
  onAbrirEditFlete: (transferencia: Transferencia) => void;
  onReconciliarPago: (transferencia: Transferencia) => void;
}

const getEstadoBadge = (estado: EstadoTransferencia) => {
  const config: Record<EstadoTransferencia, { variant: "default" | "warning" | "success" | "danger" | "info"; label: string }> = {
    borrador: { variant: "default", label: "Borrador" },
    preparando: { variant: "warning", label: "Preparando" },
    en_transito: { variant: "info", label: "En Transito" },
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

export const TransferenciaDetailModal: React.FC<TransferenciaDetailModalProps> = ({
  transferencia,
  productosMap,
  onClose,
  onConfirmar,
  onEnviar,
  onIniciarRecepcion,
  onAbrirPagoViajero,
  onAbrirEditFlete,
  onReconciliarPago,
}) => {
  const [showGestionDanadas, setShowGestionDanadas] = useState(false);

  // Count unresolved damaged incidencias
  const incidenciasDanadasPendientes = (transferencia.incidencias || []).filter(
    inc => inc.tipo === 'danada' && !inc.resuelta
  ).length;

  return (
    <>
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Transferencia ${transferencia.numeroTransferencia}`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Alerta de unidades dañadas pendientes */}
        {incidenciasDanadasPendientes > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  {incidenciasDanadasPendientes} unidad{incidenciasDanadasPendientes !== 1 ? 'es' : ''} con incidencia sin resolver
                </p>
                <p className="text-xs text-amber-600">Deben ser procesadas para cerrar esta transferencia.</p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowGestionDanadas(true)}
              className="flex-shrink-0"
            >
              Gestionar
            </Button>
          </div>
        )}

        {/* Estado y tipo */}
        <div className="flex items-center space-x-3">
          {getTipoBadge(transferencia.tipo, (transferencia as any).paisOrigen)}
          {getEstadoBadge(transferencia.estado)}
        </div>

        {/* Ruta */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="text-xs text-gray-500 uppercase mb-1">Origen</div>
              <div className="font-semibold text-gray-900">{transferencia.almacenOrigenNombre}</div>
              <div className="text-sm text-gray-500">{transferencia.almacenOrigenCodigo}</div>
            </div>
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                <ChevronRight className="h-5 w-5 text-primary-600" />
              </div>
            </div>
            <div className="flex-1 text-right">
              <div className="text-xs text-gray-500 uppercase mb-1">Destino</div>
              <div className="font-semibold text-gray-900">{transferencia.almacenDestinoNombre}</div>
              <div className="text-sm text-gray-500">{transferencia.almacenDestinoCodigo}</div>
            </div>
          </div>
        </div>

        {/* Resumen de productos */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Productos ({transferencia.productosSummary.length}) · {transferencia.totalUnidades} unidades
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {transferencia.productosSummary.map(producto => {
              const unidadesProducto = transferencia.unidades.filter(u => u.productoId === producto.productoId);
              const fleteUnitario = unidadesProducto.length > 0 ? unidadesProducto[0].costoFleteUSD : 0;
              const fleteTotalProducto = unidadesProducto.reduce((sum, u) => sum + (u.costoFleteUSD || 0), 0);
              const lotes = [...new Set(unidadesProducto.map(u => u.lote).filter(Boolean))];
              const vencimientos = unidadesProducto
                .map(u => u.fechaVencimiento?.toDate?.())
                .filter(Boolean)
                .sort((a, b) => a!.getTime() - b!.getTime());
              const proximoVencer = vencimientos[0];
              const recibidas = unidadesProducto.filter(u => u.estadoTransferencia === 'recibida').length;
              const faltantes = unidadesProducto.filter(u => u.estadoTransferencia === 'faltante').length;
              const danadas = unidadesProducto.filter(u => u.estadoTransferencia === 'danada').length;

              const pFull = productosMap.get(producto.productoId);
              return (
                <div key={producto.productoId} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{pFull?.nombreComercial || producto.nombre}</div>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        {pFull?.marca && <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1 py-0 rounded">{pFull.marca}</span>}
                        {pFull?.presentacion && <span className="text-[10px] text-gray-600 bg-gray-100 px-1 py-0 rounded capitalize">{pFull.presentacion.replace('_', ' ')}</span>}
                        {pFull?.dosaje && <span className="text-[10px] text-gray-600 bg-gray-100 px-1 py-0 rounded">{pFull.dosaje}</span>}
                        {pFull?.contenido && <span className="text-[10px] text-gray-600 bg-gray-100 px-1 py-0 rounded">{pFull.contenido}</span>}
                        {pFull?.sabor && <span className="text-[10px] text-purple-700 bg-purple-50 px-1 py-0 rounded">{pFull.sabor}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-gray-500">
                        <span>{producto.sku}</span>
                        {lotes.length > 0 && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>Lote{lotes.length > 1 ? 's' : ''}: {lotes.join(', ')}</span>
                          </>
                        )}
                        {proximoVencer && (() => {
                          const dias = Math.ceil((proximoVencer.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                          return (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className={dias < 90 ? 'text-red-600 font-medium' : dias < 180 ? 'text-amber-600' : ''}>
                                Vence: {proximoVencer.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                                {dias < 180 && ` (${dias}d)`}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                      {fleteUnitario > 0 && (
                        <div className="text-xs text-green-600 mt-1">
                          Flete: ${fleteUnitario.toFixed(2)}/u · Total flete: ${fleteTotalProducto.toFixed(2)}
                        </div>
                      )}
                      {(transferencia.estado === 'recibida_completa' || transferencia.estado === 'recibida_parcial') && (
                        <div className="flex items-center gap-2 mt-1">
                          {recibidas > 0 && (
                            <span className="text-xs text-green-600 flex items-center gap-0.5">
                              <CheckCircle className="h-3 w-3" /> {recibidas} recibida{recibidas > 1 ? 's' : ''}
                            </span>
                          )}
                          {faltantes > 0 && (
                            <span className="text-xs text-red-600 flex items-center gap-0.5">
                              <AlertTriangle className="h-3 w-3" /> {faltantes} faltante{faltantes > 1 ? 's' : ''}
                            </span>
                          )}
                          {danadas > 0 && (
                            <span className="text-xs text-amber-600 flex items-center gap-0.5">
                              <XCircle className="h-3 w-3" /> {danadas} danada{danadas > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-gray-900">{producto.cantidad}</div>
                      <div className="text-xs text-gray-500">unid.</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Fecha Creacion</div>
            <div className="text-gray-900">
              {transferencia.fechaCreacion.toDate().toLocaleDateString('es-PE', {
                day: '2-digit', month: 'long', year: 'numeric'
              })}
            </div>
          </div>
          {transferencia.fechaSalida && (
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Fecha Salida</div>
              <div className="text-gray-900">
                {transferencia.fechaSalida.toDate().toLocaleDateString('es-PE', {
                  day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </div>
            </div>
          )}
          {transferencia.fechaLlegadaReal && (
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Fecha Llegada</div>
              <div className="text-gray-900">
                {transferencia.fechaLlegadaReal.toDate().toLocaleDateString('es-PE', {
                  day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </div>
            </div>
          )}
        </div>

        {/* Tracking */}
        {transferencia.numeroTracking && (
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Numero de Tracking</div>
            <div className="font-medium text-gray-900">{transferencia.numeroTracking}</div>
          </div>
        )}

        {/* Costo de Flete (solo internacional) */}
        {esTipoTransferenciaInternacional(transferencia.tipo) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">Costo de Flete</div>
                {transferencia.costoFleteTotal && transferencia.costoFleteTotal > 0 ? (
                  <div className="font-semibold text-blue-700">${transferencia.costoFleteTotal.toFixed(2)} USD</div>
                ) : (
                  <div className="text-sm text-amber-600">Sin flete asignado</div>
                )}
              </div>
              {transferencia.estado !== 'cancelada' && (
                <Button
                  variant="secondary"
                  onClick={() => onAbrirEditFlete(transferencia)}
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  {transferencia.costoFleteTotal && transferencia.costoFleteTotal > 0 ? 'Editar Flete' : 'Agregar Flete'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Historial de Pagos al Viajero */}
        {esTipoTransferenciaInternacional(transferencia.tipo) && (() => {
          const pagos = transferencia.pagosViajero && transferencia.pagosViajero.length > 0
            ? transferencia.pagosViajero
            : (transferencia.pagoViajero ? [transferencia.pagoViajero] : []);
          if (pagos.length === 0) return null;
          const totalPagadoUSD = transferencia.montoPagadoUSD || pagos.reduce((s, p) => s + p.montoUSD, 0);
          const fleteTotal = transferencia.costoFleteTotal || 0;
          return (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-xs text-green-600 uppercase mb-2 font-semibold">
                Historial de Pagos ({pagos.length})
              </div>
              {pagos.map((pago, idx) => (
                <div key={pago.id} className="flex justify-between items-center text-sm py-1.5 border-b border-green-100 last:border-0">
                  <div>
                    <span className="font-medium text-gray-900">Pago {idx + 1}</span>
                    <span className="text-gray-500 ml-2">
                      {pago.fecha?.toDate?.() ? pago.fecha.toDate().toLocaleDateString('es-PE') : ''}
                    </span>
                    <span className="text-gray-400 ml-2 text-xs capitalize">
                      {pago.metodoPago?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="font-semibold text-green-700">${pago.montoUSD.toFixed(2)}</span>
                    {pago.errorTesoreria && (
                      <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Sin sync</span>
                    )}
                  </div>
                </div>
              ))}
              {fleteTotal > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Pagado: ${totalPagadoUSD.toFixed(2)}</span>
                    <span>Total: ${fleteTotal.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (totalPagadoUSD / fleteTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Historial de Recepciones */}
        {(transferencia.estado === 'recibida_completa' || transferencia.estado === 'recibida_parcial') && (() => {
          const recepciones = transferencia.recepcionesTransferencia && transferencia.recepcionesTransferencia.length > 0
            ? transferencia.recepcionesTransferencia
            : (transferencia.recepcion ? [{ ...transferencia.recepcion, id: 'legacy', numero: 1 }] : []);
          if (recepciones.length === 0) return null;
          const totalRecibidas = transferencia.totalUnidadesRecibidas ?? recepciones.reduce((s, r) => s + r.unidadesRecibidas, 0);
          const totalDanadas = transferencia.totalUnidadesDanadas ?? recepciones.reduce((s, r) => s + r.unidadesDanadas, 0);
          const totalUnidades = transferencia.totalUnidades;
          return (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="text-xs text-purple-600 uppercase mb-2 font-semibold">
                Historial de Recepciones ({recepciones.length})
              </div>
              {recepciones.map((rec, idx) => (
                <div key={rec.id || idx} className="text-sm py-2 border-b border-purple-100 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-medium text-gray-900">Recepcion #{rec.numero || idx + 1}</span>
                      <span className="text-gray-500 text-xs">
                        {rec.fechaRecepcion?.toDate?.() ? rec.fechaRecepcion.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                      </span>
                    </div>
                  </div>
                  {rec.recibidoPor && (
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate" title={rec.recibidoPor}>
                      Por: <UserName userId={rec.recibidoPor} />
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {rec.unidadesRecibidas > 0 && (
                      <span className="text-xs text-green-600 flex items-center gap-0.5">
                        <CheckCircle className="h-3 w-3" /> {rec.unidadesRecibidas} recibida{rec.unidadesRecibidas > 1 ? 's' : ''}
                      </span>
                    )}
                    {rec.unidadesDanadas > 0 && (
                      <span className="text-xs text-amber-600 flex items-center gap-0.5">
                        <AlertTriangle className="h-3 w-3" /> {rec.unidadesDanadas} danada{rec.unidadesDanadas > 1 ? 's' : ''}
                      </span>
                    )}
                    {rec.unidadesFaltantes > 0 && (
                      <span className="text-xs text-red-600 flex items-center gap-0.5">
                        <XCircle className="h-3 w-3" /> {rec.unidadesFaltantes} faltante{rec.unidadesFaltantes > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {rec.observaciones && (
                    <div className="text-xs text-gray-500 mt-0.5 italic">"{rec.observaciones}"</div>
                  )}
                </div>
              ))}
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Recibidas: {totalRecibidas}{totalDanadas > 0 ? ` (${totalDanadas} danadas)` : ''}</span>
                  <span>Total: {totalUnidades}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((totalRecibidas + totalDanadas) / totalUnidades) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })()}

        {/* Notas */}
        {transferencia.notas && (
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Notas</div>
            <div className="text-gray-900">{transferencia.notas}</div>
          </div>
        )}

        {/* Acciones */}
        <div className="flex justify-end space-x-3 pt-4 border-t flex-wrap gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          {transferencia.estado === 'borrador' && (
            <Button variant="primary" onClick={() => { onConfirmar(transferencia.id); onClose(); }}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar
            </Button>
          )}
          {transferencia.estado === 'preparando' && (
            <Button variant="primary" onClick={() => { onEnviar(transferencia.id); onClose(); }}>
              <Truck className="h-4 w-4 mr-2" />
              Marcar como Enviada
            </Button>
          )}
          {(transferencia.estado === 'en_transito' || transferencia.estado === 'recibida_parcial') && (
            <Button variant="primary" onClick={() => onIniciarRecepcion(transferencia)}>
              <Package className="h-4 w-4 mr-2" />
              {transferencia.estado === 'recibida_parcial' ? 'Registrar Recepcion Adicional' : 'Registrar Recepcion'}
            </Button>
          )}
          {esTipoTransferenciaInternacional(transferencia.tipo) &&
           (transferencia.estado === 'recibida_completa' || transferencia.estado === 'recibida_parcial') &&
           transferencia.estadoPagoViajero !== 'pagado' && (
            <Button variant="success" onClick={() => onAbrirPagoViajero(transferencia)}>
              <Banknote className="h-4 w-4 mr-2" />
              {transferencia.estadoPagoViajero === 'parcial'
                ? 'Registrar Pago Adicional'
                : 'Registrar Pago Viajero'}
            </Button>
          )}
          {transferencia.estadoPagoViajero === 'parcial' && (
            <Badge variant="warning">
              <Clock className="h-3 w-3 mr-1" />
              Pago Parcial ({((transferencia.montoPagadoUSD || 0) / (transferencia.costoFleteTotal || 1) * 100).toFixed(0)}%)
            </Badge>
          )}
          {transferencia.estadoPagoViajero === 'pagado' && (
            <>
              <Badge variant="success">
                <CheckCircle className="h-3 w-3 mr-1" />
                Pago Registrado
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onReconciliarPago(transferencia)}
                title="Verificar y sincronizar el movimiento en Tesoreria"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Sincronizar
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>

      {/* Modal de gestión de dañadas */}
      {showGestionDanadas && (
        <GestionDanadasModal
          transferencia={transferencia}
          productosMap={productosMap}
          onClose={() => setShowGestionDanadas(false)}
          onSuccess={() => {
            setShowGestionDanadas(false);
            onClose(); // Cerrar detalle para refrescar
          }}
        />
      )}
    </>
  );
};
