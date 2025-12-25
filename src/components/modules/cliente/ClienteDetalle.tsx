import React, { useEffect, useState } from 'react';
import {
  X,
  User,
  Package,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar,
  MapPin,
  Phone,
  TrendingUp,
  ArrowRight,
  FileText,
  ShoppingCart,
  Mail,
  Tag,
  Hash,
  Building2,
  CreditCard,
  Percent
} from 'lucide-react';
import { Button, Card, Badge } from '../../common';
import { VentaService } from '../../../services/venta.service';
import type { Cliente } from '../../../types/entidadesMaestras.types';
import type { Venta } from '../../../types/venta.types';

interface ClienteDetalleProps {
  cliente: Cliente;
  onClose: () => void;
  onEdit: () => void;
}

type TabActiva = 'info' | 'ventas' | 'financiero';

interface HistorialCliente {
  ventas: Venta[];
  resumen: {
    totalVentas: number;
    ventasCompletadas: number;
    ventasPendientes: number;
    ventasCanceladas: number;
    totalVendidoPEN: number;
    totalCobradoPEN: number;
    totalPendientePEN: number;
    ticketPromedio: number;
    ultimaCompra?: Date;
    primeraCompra?: Date;
  };
  porCobrar: Venta[];
  cobradas: Venta[];
}

export const ClienteDetalle: React.FC<ClienteDetalleProps> = ({
  cliente,
  onClose,
  onEdit
}) => {
  const [tabActiva, setTabActiva] = useState<TabActiva>('info');
  const [historial, setHistorial] = useState<HistorialCliente | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cargarHistorial = async () => {
      setLoading(true);
      try {
        const data = await VentaService.getHistorialFinancieroCliente(cliente.id);
        setHistorial(data);
      } catch (error) {
        console.error('Error cargando historial:', error);
      } finally {
        setLoading(false);
      }
    };

    cargarHistorial();
  }, [cliente.id]);

  const diasDesdeUltimaCompra = () => {
    if (!cliente.metricas?.ultimaCompra) return null;
    const ultima = cliente.metricas.ultimaCompra.toDate?.() || new Date(cliente.metricas.ultimaCompra);
    return Math.floor((Date.now() - ultima.getTime()) / (1000 * 60 * 60 * 24));
  };

  const dias = diasDesdeUltimaCompra();

  const getEstadoVentaBadge = (estado: string) => {
    const estados: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; label: string }> = {
      'cotizacion': { variant: 'default', label: 'Cotización' },
      'confirmada': { variant: 'info', label: 'Confirmada' },
      'asignada': { variant: 'info', label: 'Asignada' },
      'en_entrega': { variant: 'warning', label: 'En Entrega' },
      'entregada': { variant: 'success', label: 'Entregada' },
      'cancelada': { variant: 'danger', label: 'Cancelada' }
    };
    return estados[estado] || { variant: 'default', label: estado };
  };

  const getEstadoPagoBadge = (estado?: string) => {
    if (!estado || estado === 'pendiente') {
      return { variant: 'warning' as const, label: 'Pendiente' };
    }
    if (estado === 'pagado') {
      return { variant: 'success' as const, label: 'Pagado' };
    }
    if (estado === 'parcial') {
      return { variant: 'info' as const, label: 'Parcial' };
    }
    return { variant: 'default' as const, label: estado };
  };

  const getClasificacionColor = (clasificacion?: string) => {
    switch (clasificacion) {
      case 'A': return 'bg-green-100 text-green-700 border-green-300';
      case 'B': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'C': return 'bg-amber-100 text-amber-700 border-amber-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const formatFecha = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center space-x-4">
            <div className="h-14 w-14 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="h-7 w-7 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{cliente.nombre}</h2>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm text-gray-500">{cliente.codigo}</span>
                <Badge variant={cliente.estado === 'activo' ? 'success' : cliente.estado === 'potencial' ? 'info' : 'default'}>
                  {cliente.estado}
                </Badge>
                {cliente.clasificacionABC && (
                  <span className={`px-2 py-0.5 text-xs font-bold rounded border ${getClasificacionColor(cliente.clasificacionABC)}`}>
                    Cliente {cliente.clasificacionABC}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="secondary" size="sm" onClick={onEdit}>
              Editar
            </Button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setTabActiva('info')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabActiva === 'info'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <User className="h-4 w-4 inline mr-2" />
              Informacion
            </button>
            <button
              onClick={() => setTabActiva('ventas')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabActiva === 'ventas'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ShoppingCart className="h-4 w-4 inline mr-2" />
              Ventas
              {historial && (
                <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  {historial.resumen.totalVentas}
                </span>
              )}
            </button>
            <button
              onClick={() => setTabActiva('financiero')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabActiva === 'financiero'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DollarSign className="h-4 w-4 inline mr-2" />
              Financiero
              {historial && historial.porCobrar.length > 0 && (
                <span className="ml-2 bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-xs">
                  {historial.porCobrar.length} pend.
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Tab: Informacion */}
              {tabActiva === 'info' && (
                <div className="space-y-6">
                  {/* KPIs rapidos */}
                  <div className="grid grid-cols-4 gap-4">
                    <Card padding="md" className="bg-blue-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-blue-600 font-medium">Total Compras</div>
                          <div className="text-2xl font-bold text-blue-700">
                            {cliente.metricas?.totalCompras || 0}
                          </div>
                        </div>
                        <ShoppingCart className="h-8 w-8 text-blue-400" />
                      </div>
                    </Card>

                    <Card padding="md" className="bg-green-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-green-600 font-medium">Monto Total</div>
                          <div className="text-2xl font-bold text-green-700">
                            S/ {(cliente.metricas?.montoTotalPEN || 0).toLocaleString()}
                          </div>
                        </div>
                        <DollarSign className="h-8 w-8 text-green-400" />
                      </div>
                    </Card>

                    <Card padding="md" className="bg-purple-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-purple-600 font-medium">Ticket Promedio</div>
                          <div className="text-2xl font-bold text-purple-700">
                            S/ {(cliente.metricas?.ticketPromedio || 0).toFixed(0)}
                          </div>
                        </div>
                        <TrendingUp className="h-8 w-8 text-purple-400" />
                      </div>
                    </Card>

                    <Card padding="md" className={dias !== null && dias > 60 ? 'bg-amber-50' : 'bg-gray-50'}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`text-xs font-medium ${dias !== null && dias > 60 ? 'text-amber-600' : 'text-gray-600'}`}>
                            Ultima Compra
                          </div>
                          <div className={`text-2xl font-bold ${dias !== null && dias > 60 ? 'text-amber-700' : 'text-gray-700'}`}>
                            {dias !== null ? `${dias} dias` : 'Sin compras'}
                          </div>
                        </div>
                        <Clock className="h-8 w-8 text-gray-400" />
                      </div>
                    </Card>
                  </div>

                  {/* Alerta de cliente inactivo */}
                  {dias !== null && dias > 90 && (
                    <Card padding="md" className="bg-amber-50 border-amber-200">
                      <div className="flex items-center space-x-3">
                        <AlertTriangle className="h-6 w-6 text-amber-600" />
                        <div>
                          <div className="font-semibold text-amber-800">Cliente en Riesgo</div>
                          <div className="text-sm text-amber-600">
                            No ha realizado compras en los ultimos {dias} dias. Considera contactarlo para reactivacion.
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Datos de contacto */}
                  <div className="grid grid-cols-2 gap-6">
                    <Card padding="md">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Phone className="h-5 w-5 mr-2 text-gray-400" />
                        Contacto
                      </h3>
                      <div className="space-y-3 text-sm">
                        {cliente.telefono && (
                          <div className="flex items-center">
                            <span className="text-gray-500 w-24">Telefono:</span>
                            <span className="text-gray-900 font-medium">{cliente.telefono}</span>
                          </div>
                        )}
                        {cliente.telefonoAlt && (
                          <div className="flex items-center">
                            <span className="text-gray-500 w-24">Alternativo:</span>
                            <span className="text-gray-900">{cliente.telefonoAlt}</span>
                          </div>
                        )}
                        {cliente.email && (
                          <div className="flex items-center">
                            <span className="text-gray-500 w-24">Email:</span>
                            <span className="text-gray-900">{cliente.email}</span>
                          </div>
                        )}
                        {cliente.dniRuc && (
                          <div className="flex items-center">
                            <span className="text-gray-500 w-24">{cliente.dniRuc.length === 11 ? 'RUC:' : 'DNI:'}</span>
                            <span className="text-gray-900">{cliente.dniRuc}</span>
                          </div>
                        )}
                        <div className="flex items-center pt-2 border-t">
                          <Building2 className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-gray-600 capitalize">
                            {cliente.tipoCliente === 'persona' ? 'Persona Natural' : 'Empresa'}
                          </span>
                        </div>
                      </div>
                    </Card>

                    <Card padding="md">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Tag className="h-5 w-5 mr-2 text-gray-400" />
                        Segmentacion
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center text-sm">
                          <span className="text-gray-500 w-24">Canal:</span>
                          <span className="text-gray-900 capitalize">{cliente.canalOrigen.replace('_', ' ')}</span>
                        </div>
                        {cliente.segmento && (
                          <div className="flex items-center text-sm">
                            <span className="text-gray-500 w-24">Segmento:</span>
                            <Badge variant="info" size="sm">{cliente.segmento}</Badge>
                          </div>
                        )}
                        {cliente.etiquetas && cliente.etiquetas.length > 0 && (
                          <div className="pt-3 border-t">
                            <p className="text-xs text-gray-500 mb-2">Etiquetas:</p>
                            <div className="flex flex-wrap gap-1">
                              {cliente.etiquetas.map((etiqueta, idx) => (
                                <Badge key={idx} variant="default" size="sm">{etiqueta}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>

                  {/* Direcciones */}
                  {cliente.direcciones && cliente.direcciones.length > 0 && (
                    <Card padding="md">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <MapPin className="h-5 w-5 mr-2 text-gray-400" />
                        Direcciones de Entrega
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {cliente.direcciones.map((dir) => (
                          <div
                            key={dir.id}
                            className={`p-3 rounded-lg border ${dir.esPrincipal ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{dir.etiqueta}</span>
                              {dir.esPrincipal && <Badge variant="info" size="sm">Principal</Badge>}
                            </div>
                            <p className="text-sm text-gray-600">{dir.direccion}</p>
                            {dir.distrito && (
                              <p className="text-xs text-gray-500">{dir.distrito}, {dir.ciudad}</p>
                            )}
                            {dir.referencia && (
                              <p className="text-xs text-gray-400 mt-1">Ref: {dir.referencia}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Notas */}
                  {cliente.notas && (
                    <Card padding="md">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Notas</h3>
                      <p className="text-gray-600 text-sm whitespace-pre-wrap">{cliente.notas}</p>
                    </Card>
                  )}
                </div>
              )}

              {/* Tab: Ventas */}
              {tabActiva === 'ventas' && historial && (
                <div className="space-y-6">
                  {/* Resumen de ventas */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card padding="md" className="bg-green-50">
                      <div className="text-center">
                        <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-green-700">
                          {historial.resumen.ventasCompletadas}
                        </div>
                        <div className="text-xs text-green-600">Completadas</div>
                      </div>
                    </Card>

                    <Card padding="md" className="bg-amber-50">
                      <div className="text-center">
                        <Clock className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-amber-700">
                          {historial.resumen.ventasPendientes}
                        </div>
                        <div className="text-xs text-amber-600">En Proceso</div>
                      </div>
                    </Card>

                    <Card padding="md" className="bg-red-50">
                      <div className="text-center">
                        <X className="h-8 w-8 text-red-500 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-red-700">
                          {historial.resumen.ventasCanceladas}
                        </div>
                        <div className="text-xs text-red-600">Canceladas</div>
                      </div>
                    </Card>
                  </div>

                  {/* Lista de ventas */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Historial de Compras</h3>
                    {historial.ventas.length === 0 ? (
                      <Card padding="lg" className="text-center">
                        <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">Este cliente no tiene compras registradas</p>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {historial.ventas.map((v) => {
                          const estadoBadge = getEstadoVentaBadge(v.estado);
                          const estadoPago = getEstadoPagoBadge(v.estadoPago);
                          return (
                            <Card key={v.id} padding="sm" className="hover:bg-gray-50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                  <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <FileText className="h-5 w-5 text-blue-600" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900">{v.numeroVenta}</div>
                                    <div className="text-sm text-gray-500">
                                      {v.fechaCreacion.toDate().toLocaleDateString('es-PE')}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-6">
                                  <div className="text-center">
                                    <div className="text-sm font-medium text-gray-900">
                                      {v.productos.reduce((sum, p) => sum + p.cantidad, 0)}
                                    </div>
                                    <div className="text-xs text-gray-500">Productos</div>
                                  </div>

                                  <div className="text-center">
                                    <div className="text-sm font-medium text-green-600">
                                      S/ {v.totalPEN.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-gray-500">Total</div>
                                  </div>

                                  <Badge variant={estadoBadge.variant}>{estadoBadge.label}</Badge>
                                  <Badge variant={estadoPago.variant}>{estadoPago.label}</Badge>

                                  <ArrowRight className="h-5 w-5 text-gray-300" />
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Financiero */}
              {tabActiva === 'financiero' && historial && (
                <div className="space-y-6">
                  {/* KPIs financieros */}
                  <div className="grid grid-cols-4 gap-4">
                    <Card padding="md" className="bg-green-50">
                      <div className="text-center">
                        <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                        <div className="text-xl font-bold text-green-700">
                          S/ {historial.resumen.totalCobradoPEN.toLocaleString()}
                        </div>
                        <div className="text-xs text-green-600">Total Cobrado</div>
                      </div>
                    </Card>

                    <Card padding="md" className="bg-amber-50">
                      <div className="text-center">
                        <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                        <div className="text-xl font-bold text-amber-700">
                          S/ {historial.resumen.totalPendientePEN.toLocaleString()}
                        </div>
                        <div className="text-xs text-amber-600">Pendiente Cobro</div>
                      </div>
                    </Card>

                    <Card padding="md" className="bg-blue-50">
                      <div className="text-center">
                        <TrendingUp className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                        <div className="text-xl font-bold text-blue-700">
                          S/ {historial.resumen.ticketPromedio.toFixed(0)}
                        </div>
                        <div className="text-xs text-blue-600">Ticket Promedio</div>
                      </div>
                    </Card>

                    <Card padding="md" className="bg-purple-50">
                      <div className="text-center">
                        <DollarSign className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                        <div className="text-xl font-bold text-purple-700">
                          S/ {historial.resumen.totalVendidoPEN.toLocaleString()}
                        </div>
                        <div className="text-xs text-purple-600">Total Historico</div>
                      </div>
                    </Card>
                  </div>

                  {/* Porcentaje cobrado */}
                  {historial.resumen.totalVendidoPEN > 0 && (
                    <Card padding="md">
                      <h4 className="font-semibold text-gray-900 mb-3">Tasa de Cobranza</h4>
                      <div className="relative">
                        <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-green-500 transition-all"
                            style={{
                              width: `${Math.min(
                                (historial.resumen.totalCobradoPEN / historial.resumen.totalVendidoPEN) * 100,
                                100
                              )}%`
                            }}
                          />
                        </div>
                        <div className="flex justify-between mt-2 text-sm text-gray-600">
                          <span>
                            {((historial.resumen.totalCobradoPEN / historial.resumen.totalVendidoPEN) * 100).toFixed(1)}% cobrado
                          </span>
                          <span>
                            S/ {historial.resumen.totalPendientePEN.toLocaleString()} pendiente
                          </span>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Cuentas por cobrar */}
                  {historial.porCobrar.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
                        Cuentas por Cobrar ({historial.porCobrar.length})
                      </h3>
                      <div className="space-y-3">
                        {historial.porCobrar.map((v) => {
                          const estadoPago = getEstadoPagoBadge(v.estadoPago);
                          const montoPendiente = v.totalPEN - (v.montoPagado || 0);
                          return (
                            <Card key={v.id} padding="sm" className="border-l-4 border-l-amber-400 bg-amber-50">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium text-gray-900">{v.numeroVenta}</div>
                                  <div className="text-sm text-gray-500">
                                    {v.fechaCreacion.toDate().toLocaleDateString('es-PE')}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                  <div className="text-right">
                                    <div className="text-lg font-bold text-amber-700">
                                      S/ {montoPendiente.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      de S/ {v.totalPEN.toLocaleString()}
                                    </div>
                                  </div>
                                  <Badge variant={estadoPago.variant}>{estadoPago.label}</Badge>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ventas cobradas */}
                  {historial.cobradas.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                        Ventas Cobradas ({historial.cobradas.length})
                      </h3>
                      <div className="space-y-3">
                        {historial.cobradas.slice(0, 5).map((v) => (
                          <Card key={v.id} padding="sm" className="border-l-4 border-l-green-400 bg-green-50">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-gray-900">{v.numeroVenta}</div>
                                <div className="text-sm text-gray-500">
                                  {v.fechaPagoCompleto
                                    ? `Pagado: ${v.fechaPagoCompleto.toDate().toLocaleDateString('es-PE')}`
                                    : v.fechaCreacion.toDate().toLocaleDateString('es-PE')
                                  }
                                </div>
                              </div>
                              <div className="flex items-center space-x-4">
                                <div className="text-right">
                                  <div className="text-lg font-bold text-green-700">
                                    S/ {v.totalPEN.toLocaleString()}
                                  </div>
                                </div>
                                <Badge variant="success">Pagado</Badge>
                              </div>
                            </div>
                          </Card>
                        ))}
                        {historial.cobradas.length > 5 && (
                          <p className="text-sm text-gray-500 text-center">
                            ... y {historial.cobradas.length - 5} ventas mas
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sin movimientos */}
                  {historial.porCobrar.length === 0 && historial.cobradas.length === 0 && (
                    <Card padding="lg" className="text-center">
                      <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No hay movimientos financieros registrados</p>
                    </Card>
                  )}

                  {/* Fechas */}
                  {(historial.resumen.primeraCompra || historial.resumen.ultimaCompra) && (
                    <Card padding="md" className="bg-gray-50">
                      <div className="flex items-center justify-between text-sm">
                        {historial.resumen.primeraCompra && (
                          <div>
                            <span className="text-gray-500">Primera compra:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {historial.resumen.primeraCompra.toLocaleDateString('es-PE')}
                            </span>
                          </div>
                        )}
                        {historial.resumen.ultimaCompra && (
                          <div>
                            <span className="text-gray-500">Ultima compra:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {historial.resumen.ultimaCompra.toLocaleDateString('es-PE')}
                            </span>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
