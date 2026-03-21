import React from 'react';
import {
  Check,
  XCircle,
  Link2,
  Clock,
  TrendingUp,
  ShoppingCart,
  AlertCircle,
  Truck,
  UserCheck,
  ExternalLink,
  Users,
  Building2,
  Target,
  Lightbulb
} from 'lucide-react';
import { Button, Modal, Badge } from '../../components/common';
import { formatFecha as formatDate } from '../../utils/dateFormatters';
import { formatCurrency } from '../../utils/format';
import { getLabelEstadoAsignacion } from '../../utils/multiOrigen.helpers';
import type { Requerimiento, EstadoRequerimiento, TipoSolicitante } from '../../types/expectativa.types';
import type { AsignacionResponsable } from '../../types/requerimiento.types';

interface RequerimientoDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  requerimiento: Requerimiento | null;
  onAprobar: (req: Requerimiento) => void;
  onGenerarOC: (req: Requerimiento) => void;
  onGenerarOCsPorViajero: (req: Requerimiento) => void;
  onAbrirAsignacion: () => void;
}

const getEstadoBadge = (estado: EstadoRequerimiento) => {
  const config: Record<EstadoRequerimiento, { color: string; icon: React.ReactNode }> = {
    borrador: { color: 'bg-gray-100 text-gray-800', icon: <Clock className="h-3 w-3" /> },
    pendiente: { color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-3 w-3" /> },
    aprobado: { color: 'bg-blue-100 text-blue-800', icon: <Check className="h-3 w-3" /> },
    parcial: { color: 'bg-indigo-100 text-indigo-800', icon: <Link2 className="h-3 w-3" /> },
    en_proceso: { color: 'bg-purple-100 text-purple-800', icon: <Link2 className="h-3 w-3" /> },
    completado: { color: 'bg-green-100 text-green-800', icon: <Check className="h-3 w-3" /> },
    cancelado: { color: 'bg-red-100 text-red-800', icon: <XCircle className="h-3 w-3" /> }
  };

  const { color, icon } = config[estado];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {icon}
      <span className="ml-1">{estado.replace('_', ' ')}</span>
    </span>
  );
};

const getPrioridadBadge = (prioridad: string) => {
  const config: Record<string, string> = {
    urgente: 'bg-red-200 text-red-900 border-red-300',
    alta: 'bg-red-100 text-red-800 border-red-200',
    media: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    normal: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    baja: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config[prioridad] || config.baja}`}>
      {prioridad}
    </span>
  );
};

const getSolicitanteIcon = (tipo: TipoSolicitante) => {
  switch (tipo) {
    case 'cliente': return <Users className="h-4 w-4 text-blue-500" />;
    case 'administracion': return <Building2 className="h-4 w-4 text-gray-500" />;
    case 'ventas': return <Target className="h-4 w-4 text-green-500" />;
    case 'investigacion': return <Lightbulb className="h-4 w-4 text-yellow-500" />;
    default: return null;
  }
};

const getAsignacionEstadoBadge = (estado: string, paisOrigen?: string) => {
  const variantMap: Record<string, 'warning' | 'info' | 'success' | 'default' | 'danger'> = {
    pendiente: 'warning',
    comprando: 'info',
    comprado: 'info',
    en_almacen_usa: 'info',
    en_almacen_origen: 'info',
    en_transito: 'info',
    recibido: 'success',
    cancelado: 'danger'
  };
  const variant = variantMap[estado] || 'default';
  const label = getLabelEstadoAsignacion(estado as any, paisOrigen);
  return <Badge variant={variant}>{label}</Badge>;
};

export const RequerimientoDetailModal: React.FC<RequerimientoDetailModalProps> = ({
  isOpen,
  onClose,
  requerimiento,
  onAprobar,
  onGenerarOC,
  onGenerarOCsPorViajero,
  onAbrirAsignacion
}) => {
  if (!requerimiento) return null;

  const req = requerimiento;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Requerimiento ${req.numeroRequerimiento || ''}`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Info general */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-500">Estado</label>
            <div className="mt-1">{getEstadoBadge(req.estado)}</div>
          </div>
          <div>
            <label className="text-sm text-gray-500">Prioridad</label>
            <div className="mt-1">{getPrioridadBadge(req.prioridad)}</div>
          </div>
          <div>
            <label className="text-sm text-gray-500">Origen</label>
            <div className="mt-1 font-medium">{req.origen.replace('_', ' ')}</div>
          </div>
          <div>
            <label className="text-sm text-gray-500">Fecha</label>
            <div className="mt-1 font-medium">{formatDate(req.fechaCreacion)}</div>
          </div>
        </div>

        {/* Solicitante */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <label className="text-sm text-gray-500">Solicitado por</label>
          <div className="mt-1 font-medium text-gray-900 flex items-center">
            {getSolicitanteIcon(req.tipoSolicitante)}
            <span className="ml-2">
              {req.tipoSolicitante === 'cliente' && req.nombreClienteSolicitante
                ? `Cliente: ${req.nombreClienteSolicitante}`
                : req.tipoSolicitante === 'administracion' ? 'Administracion (Stock)'
                : req.tipoSolicitante === 'ventas' ? 'Equipo de Ventas'
                : req.tipoSolicitante === 'investigacion' ? 'Investigacion de Mercado'
                : '-'}
            </span>
          </div>
        </div>

        {/* Expectativa financiera */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-3 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Expectativa Financiera
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm">
            <div>
              <label className="text-blue-600">TC Investigacion</label>
              <div className="font-bold text-blue-900">
                S/ {req.expectativa?.tcInvestigacion?.toFixed(3) || '-'}
              </div>
            </div>
            <div>
              <label className="text-blue-600">Costo Est. USD</label>
              <div className="font-bold text-blue-900">
                {formatCurrency(req.expectativa?.costoTotalEstimadoUSD || 0)}
              </div>
            </div>
            <div>
              <label className="text-blue-600">Costo Est. PEN</label>
              <div className="font-bold text-blue-900">
                {formatCurrency(req.expectativa?.costoTotalEstimadoPEN || 0, 'PEN')}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-4 mt-3 text-sm">
            <div>
              <label className="text-blue-600">Impuesto Est.</label>
              <div className="font-medium text-blue-900">
                {formatCurrency(req.expectativa?.impuestoEstimadoUSD || 0)}
              </div>
            </div>
            <div>
              <label className="text-blue-600">Flete Est.</label>
              <div className="font-medium text-blue-900">
                {formatCurrency(req.expectativa?.fleteEstimadoUSD || 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Productos */}
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Productos ({req.productos.length})</h4>
          <div className="border rounded-lg divide-y">
            {req.productos.map((prod, index) => {
              const detailParts = [prod.presentacion, prod.contenido, prod.dosaje, prod.sabor].filter(Boolean);
              const detailStr = detailParts.join(' · ');
              return (
                <div key={index} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="font-medium text-gray-900">
                        {prod.sku} - {prod.marca} {prod.nombreComercial}
                      </div>
                      {detailStr && (
                        <div className="text-xs text-gray-400 mt-0.5">{detailStr}</div>
                      )}
                      <div className="text-sm text-gray-500 mt-0.5">Cantidad: {prod.cantidadSolicitada}</div>
                    </div>
                    {prod.precioEstimadoUSD && (
                      <div className="text-right flex-shrink-0">
                        <div className="font-medium text-gray-900">{formatCurrency(prod.precioEstimadoUSD)}</div>
                        <div className="text-xs text-gray-500">
                          Total: {formatCurrency(prod.precioEstimadoUSD * prod.cantidadSolicitada)}
                        </div>
                      </div>
                    )}
                  </div>
                  {(prod.proveedorSugerido || prod.urlReferencia) && (
                    <div className="mt-2 text-sm text-gray-500">
                      {prod.proveedorSugerido && <span className="mr-4">Proveedor: {prod.proveedorSugerido}</span>}
                      {prod.urlReferencia && (
                        <a
                          href={prod.urlReferencia}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:underline inline-flex items-center"
                        >
                          Ver referencia
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Asignaciones de Responsables/Viajeros */}
        {(req as any).asignaciones && (req as any).asignaciones.length > 0 && (
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h4 className="font-medium text-green-900 mb-3 flex items-center">
              <Truck className="h-5 w-5 mr-2" />
              Responsables Asignados ({(req as any).asignaciones.length})
            </h4>
            <div className="space-y-3">
              {(req as any).asignaciones.map((asig: AsignacionResponsable, idx: number) => (
                <div key={asig.id || idx} className="bg-white rounded-lg p-3 border border-green-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-green-600" />
                        <span className="font-semibold text-gray-900">
                          {asig.responsableNombre}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({asig.responsableCodigo})
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {asig.productos?.length || 0} producto(s) •
                        {asig.productos?.reduce((sum, p) => sum + p.cantidadAsignada, 0) || 0} unidades
                      </div>
                      {asig.fechaEstimadaLlegada && (
                        <div className="text-xs text-gray-500 mt-1">
                          Llegada estimada: {formatDate(asig.fechaEstimadaLlegada)}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {getAsignacionEstadoBadge(asig.estado)}
                      {asig.costoEstimadoUSD && (
                        <div className="text-sm font-medium text-gray-700 mt-1">
                          {formatCurrency(asig.costoEstimadoUSD)}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Detalle de productos asignados */}
                  {asig.productos && asig.productos.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-green-100">
                      <div className="text-xs text-gray-500 mb-1">Productos asignados:</div>
                      <div className="flex flex-wrap gap-2">
                        {asig.productos.map((prod, pIdx) => (
                          <span
                            key={pIdx}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800"
                          >
                            {prod.sku}: {prod.cantidadAsignada} ud
                            {prod.cantidadRecibida > 0 && (
                              <span className="ml-1 text-green-600">
                                ({prod.cantidadRecibida} recibidas)
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resumen de cantidades pendientes */}
        {req.productos.some(p => (p as any).cantidadPendiente > 0) && (
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <h4 className="font-medium text-yellow-900 mb-2 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              Cantidades Pendientes de Asignar
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {req.productos.filter(p => (p as any).cantidadPendiente > 0).map((prod, idx) => (
                <div key={idx} className="text-sm">
                  <span className="font-medium">{prod.sku}:</span>
                  <span className="text-yellow-800 ml-1">
                    {(prod as any).cantidadPendiente || prod.cantidadSolicitada} pendientes
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OC(s) vinculada(s) */}
        {(req.ordenCompraIds?.length || req.ordenCompraId) && (
          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="font-medium text-purple-900 flex items-center">
              <Link2 className="h-5 w-5 mr-2" />
              {(req.ordenCompraIds?.length || 0) > 1
                ? `Ordenes de Compra (${req.ordenCompraIds!.length})`
                : 'Orden de Compra Vinculada'
              }
            </h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {(req.ordenCompraNumeros || [req.ordenCompraNumero]).filter(Boolean).map((num, i) => (
                <span key={i} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-purple-100 text-purple-900">
                  {num}
                </span>
              ))}
            </div>
            {/* OC Coverage progress */}
            {req.ocCoverage && req.ocCoverage.porcentaje < 100 && (
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-purple-700">
                  <div className="flex-1 bg-purple-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 rounded-full h-2 transition-all"
                      style={{ width: `${req.ocCoverage.porcentaje}%` }}
                    />
                  </div>
                  <span className="font-medium">{req.ocCoverage.porcentaje}% cubierto</span>
                </div>
                <p className="text-xs text-purple-600">
                  {req.ocCoverage.productosPendientes} producto(s) pendientes de compra
                </p>
              </div>
            )}
            {/* Per-product OC breakdown */}
            {req.productos.some(p => p.ordenCompraRefs && p.ordenCompraRefs.length > 0) && (
              <div className="mt-3 space-y-1.5">
                {req.productos.map((p, idx) => {
                  const enOC = p.cantidadEnOC || 0;
                  const pendiente = p.cantidadSolicitada - enOC;
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className="text-purple-800 font-medium truncate flex-1">{p.sku}</span>
                      <span className="text-purple-600">{enOC}/{p.cantidadSolicitada}</span>
                      {pendiente > 0 && (
                        <span className="text-amber-600 font-medium">{pendiente} pend.</span>
                      )}
                      {pendiente <= 0 && (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Justificacion */}
        {req.justificacion && (
          <div>
            <label className="text-sm text-gray-500">Justificacion</label>
            <div className="mt-1 text-gray-900">{req.justificacion}</div>
          </div>
        )}

        {/* Acciones segun estado */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>

          {(req.estado === 'aprobado' || req.estado === 'parcial' || req.estado === 'en_proceso') && (
            <Button
              variant="outline"
              onClick={onAbrirAsignacion}
            >
              <Truck className="h-4 w-4 mr-2" />
              Asignar Viajero
            </Button>
          )}

          {(req.estado === 'aprobado' || req.estado === 'parcial' || req.estado === 'en_proceso') &&
           (req as any).asignaciones?.some((a: AsignacionResponsable) =>
             a.estado === 'pendiente' && !a.ordenCompraId
           ) && (
            <Button
              variant="primary"
              onClick={() => onGenerarOCsPorViajero(req)}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Generar OCs por Viajero
            </Button>
          )}

          {req.estado === 'pendiente' && (
            <Button variant="primary" onClick={() => {
              onAprobar(req);
              onClose();
            }}>
              <Check className="h-4 w-4 mr-2" />
              Aprobar
            </Button>
          )}
          {(req.estado === 'aprobado' || req.estado === 'parcial') && (
            <Button variant="primary" onClick={() => onGenerarOC(req)}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              {req.estado === 'parcial' ? 'Continuar OC' : 'Generar OC'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
