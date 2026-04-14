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
} from "lucide-react";
import { Modal, Button, Badge } from "../../components/common";
import type { Envio, EstadoEnvio, TipoEnvio } from "../../types/envio.types";
import type { Producto } from "../../types/producto.types";
import { getDescripcionProducto } from "../../utils/producto.helpers";
import { UserName } from "./UserName";
import { GestionDanadasModal } from "./GestionDanadasModal";

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
  onClose,
  onConfirmar,
  onEnviar,
  onIniciarRecepcion,
  onAbrirPagoColaborador,
  onAbrirEditFlete,
  onReconciliarPago,
}) => {
  const [showGestionDanadas, setShowGestionDanadas] = useState(false);
  const esInternacional = envio.tipo === 'internacional_peru';

  const origenNombre = envio.origenTipo === 'proveedor'
    ? (envio.origenProveedorNombre || 'Proveedor')
    : (envio.origenCasillaNombre || 'Casilla Origen');
  const origenCodigo = envio.origenTipo === 'casilla' ? envio.origenCasillaCodigo : undefined;

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title={`Envio ${envio.numeroEnvio}`}
        size="lg"
      >
        <div className="space-y-6">
          {/* Estado y tipo */}
          <div className="flex items-center space-x-3">
            {getTipoBadge(envio.tipo)}
            {getEstadoBadge(envio.estado)}
          </div>

          {/* Ruta */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="text-xs text-slate-500 uppercase mb-1">Origen</div>
                <div className="font-semibold text-slate-900">{origenNombre}</div>
                {origenCodigo && <div className="text-sm text-slate-500">{origenCodigo}</div>}
              </div>
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                  <ChevronRight className="h-5 w-5 text-teal-600" />
                </div>
              </div>
              <div className="flex-1 text-right">
                <div className="text-xs text-slate-500 uppercase mb-1">Destino</div>
                <div className="font-semibold text-slate-900">{envio.destinoCasillaNombre}</div>
                <div className="text-sm text-slate-500">{envio.destinoCasillaCodigo}</div>
              </div>
            </div>
          </div>

          {/* Colaborador */}
          {envio.colaboradorNombre && (
            <div className="text-sm">
              <span className="text-slate-500">{esInternacional ? 'Viajero: ' : 'Colaborador: '}</span>
              <span className="font-medium text-slate-900">{envio.colaboradorNombre}</span>
            </div>
          )}

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

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500 uppercase mb-1">Fecha Creacion</div>
              <div className="text-slate-900">{envio.fechaCreacion.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            </div>
            {envio.fechaSalida && (
              <div>
                <div className="text-xs text-slate-500 uppercase mb-1">Fecha Salida</div>
                <div className="text-slate-900">{envio.fechaSalida.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
              </div>
            )}
            {envio.fechaLlegadaReal && (
              <div>
                <div className="text-xs text-slate-500 uppercase mb-1">Fecha Llegada</div>
                <div className="text-slate-900">{envio.fechaLlegadaReal.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
              </div>
            )}
          </div>

          {/* Tracking */}
          {envio.numeroTracking && (
            <div>
              <div className="text-xs text-slate-500 uppercase mb-1">Numero de Tracking</div>
              <div className="font-medium text-slate-900">{envio.numeroTracking}</div>
            </div>
          )}

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

      {/* Modal gestion danadas */}
      {showGestionDanadas && (
        <GestionDanadasModal
          transferencia={envio as any}
          productosMap={productosMap}
          onClose={() => setShowGestionDanadas(false)}
          onSuccess={() => { setShowGestionDanadas(false); onClose(); }}
        />
      )}
    </>
  );
};
