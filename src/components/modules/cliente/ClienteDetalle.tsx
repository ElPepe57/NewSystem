import React, { useEffect, useState, useLayoutEffect } from 'react';
import { formatFecha } from '../../../utils/dateFormatters';
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
  Percent,
  Wallet,
} from 'lucide-react';
import { Button, Card, Badge } from '../../common';
import { registerModalOpen, unregisterModalOpen, getModalCount } from '../../common/Modal';
import { VentaService } from '../../../services/venta.service';
import type { Cliente } from '../../../types/entidadesMaestras.types';
import type { Venta } from '../../../types/venta.types';
import { useCanalVentaStore } from '../../../store/canalVentaStore';
// S55 Fase 7 — Tab "Cuenta Corriente" en ficha de cliente.
import { CuentaCorrienteTab } from '../cuentaCorriente';

interface ClienteDetalleProps {
  cliente: Cliente;
  onClose: () => void;
  onEdit: () => void;
}

type TabActiva = 'info' | 'ventas' | 'financiero' | 'cuenta_corriente';

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
  const { canales } = useCanalVentaStore();

  const resolverNombreCanal = (canalOrigen: string) => {
    const canal = canales.find(c => c.id === canalOrigen || c.codigo === canalOrigen || c.nombre.toLowerCase() === canalOrigen.toLowerCase());
    return canal?.nombre || canalOrigen.replace('_', ' ');
  };

  // Registrar modal abierto
  useLayoutEffect(() => {
    registerModalOpen();
    document.body.setAttribute('data-modal-open', 'true');
    return () => {
      unregisterModalOpen();
      if (getModalCount() === 0) {
        document.body.removeAttribute('data-modal-open');
      }
    };
  }, []);

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
    const ultima = cliente.metricas.ultimaCompra.toDate?.() || new Date(cliente.metricas.ultimaCompra as unknown as string);
    return Math.floor((Date.now() - ultima.getTime()) / (1000 * 60 * 60 * 24));
  };

  const dias = diasDesdeUltimaCompra();

  const getEstadoVentaBadge = (estado: string) => {
    const estados: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; label: string }> = {
      'cotizacion': { variant: 'default', label: 'Cotización' },
      'confirmada': { variant: 'info', label: 'Confirmada' },
      'asignada': { variant: 'info', label: 'Asignada' },
      'en_entrega': { variant: 'warning', label: 'Programada' },
      'despachada': { variant: 'info', label: 'En Camino' },
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
      case 'A': return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      case 'B': return 'bg-sky-100 text-sky-700 border-sky-300';
      case 'C': return 'bg-amber-100 text-amber-700 border-amber-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-sky-50">
          <div className="flex items-center space-x-4">
            <div className="h-14 w-14 bg-sky-100 rounded-full flex items-center justify-center">
              <User className="h-7 w-7 text-sky-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{cliente.nombre}</h2>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm text-slate-500">{cliente.codigo}</span>
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
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setTabActiva('info')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabActiva === 'info'
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <User className="h-4 w-4 inline mr-2" />
              Informacion
            </button>
            <button
              onClick={() => setTabActiva('ventas')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabActiva === 'ventas'
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <ShoppingCart className="h-4 w-4 inline mr-2" />
              Ventas
              {historial && (
                <span className="ml-2 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                  {historial.resumen.totalVentas}
                </span>
              )}
            </button>
            <button
              onClick={() => setTabActiva('financiero')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabActiva === 'financiero'
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
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
            {/* S55 Fase 7 — Cuenta Corriente */}
            <button
              onClick={() => setTabActiva('cuenta_corriente')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabActiva === 'cuenta_corriente'
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Wallet className="h-4 w-4 inline mr-2" />
              Cuenta Corriente
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
            </div>
          ) : (
            <>
              {/* Tab: Informacion */}
              {tabActiva === 'info' && (
                <div className="space-y-6">
                  {/* KPIs rapidos */}
                  <div className="grid grid-cols-4 gap-4">
                    <Card padding="md" className="bg-sky-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-sky-600 font-medium">Total Compras</div>
                          <div className="text-2xl font-bold text-sky-700">
                            {cliente.metricas?.totalCompras || 0}
                          </div>
                        </div>
                        <ShoppingCart className="h-8 w-8 text-sky-400" />
                      </div>
                    </Card>

                    <Card padding="md" className="bg-emerald-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-emerald-600 font-medium">Monto Total</div>
                          <div className="text-2xl font-bold text-emerald-700">
                            S/ {(cliente.metricas?.montoTotalPEN || 0).toLocaleString()}
                          </div>
                        </div>
                        <DollarSign className="h-8 w-8 text-emerald-400" />
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

                    <Card padding="md" className={dias !== null && dias > 60 ? 'bg-amber-50' : 'bg-slate-50'}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`text-xs font-medium ${dias !== null && dias > 60 ? 'text-amber-600' : 'text-slate-600'}`}>
                            Ultima Compra
                          </div>
                          <div className={`text-2xl font-bold ${dias !== null && dias > 60 ? 'text-amber-700' : 'text-slate-700'}`}>
                            {dias !== null ? `${dias} dias` : 'Sin compras'}
                          </div>
                        </div>
                        <Clock className="h-8 w-8 text-slate-400" />
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
                      <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                        <Phone className="h-5 w-5 mr-2 text-slate-400" />
                        Contacto
                      </h3>
                      <div className="space-y-3 text-sm">
                        {cliente.telefono && (
                          <div className="flex items-center">
                            <span className="text-slate-500 w-24">Telefono:</span>
                            <span className="text-slate-900 font-medium">{cliente.telefono}</span>
                          </div>
                        )}
                        {cliente.telefonoAlt && (
                          <div className="flex items-center">
                            <span className="text-slate-500 w-24">Alternativo:</span>
                            <span className="text-slate-900">{cliente.telefonoAlt}</span>
                          </div>
                        )}
                        {cliente.email && (
                          <div className="flex items-center">
                            <span className="text-slate-500 w-24">Email:</span>
                            <span className="text-slate-900">{cliente.email}</span>
                          </div>
                        )}
                        {cliente.dniRuc && (
                          <div className="flex items-center">
                            <span className="text-slate-500 w-24">{cliente.dniRuc.length === 11 ? 'RUC:' : 'DNI:'}</span>
                            <span className="text-slate-900">{cliente.dniRuc}</span>
                          </div>
                        )}
                        <div className="flex items-center pt-2 border-t">
                          <Building2 className="h-4 w-4 text-slate-400 mr-2" />
                          <span className="text-slate-600 capitalize">
                            {cliente.tipoCliente === 'persona' ? 'Persona Natural' : 'Empresa'}
                          </span>
                        </div>
                      </div>
                    </Card>

                    <Card padding="md">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                        <Tag className="h-5 w-5 mr-2 text-slate-400" />
                        Segmentacion
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center text-sm">
                          <span className="text-slate-500 w-24">Canal:</span>
                          <span className="text-slate-900 capitalize">{resolverNombreCanal(cliente.canalOrigen)}</span>
                        </div>
                        {cliente.segmento && (
                          <div className="flex items-center text-sm">
                            <span className="text-slate-500 w-24">Segmento:</span>
                            <Badge variant="info" size="sm">{cliente.segmento}</Badge>
                          </div>
                        )}
                        {cliente.etiquetas && cliente.etiquetas.length > 0 && (
                          <div className="pt-3 border-t">
                            <p className="text-xs text-slate-500 mb-2">Etiquetas:</p>
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
                      <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                        <MapPin className="h-5 w-5 mr-2 text-slate-400" />
                        Direcciones de Entrega
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {cliente.direcciones.map((dir) => (
                          <div
                            key={dir.id}
                            className={`p-3 rounded-lg border ${dir.esPrincipal ? 'border-sky-300 bg-sky-50' : 'border-slate-200'}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{dir.etiqueta}</span>
                              {dir.esPrincipal && <Badge variant="info" size="sm">Principal</Badge>}
                            </div>
                            <p className="text-sm text-slate-600">{dir.direccion}</p>
                            {dir.distrito && (
                              <p className="text-xs text-slate-500">{dir.distrito}, {dir.ciudad}</p>
                            )}
                            {dir.referencia && (
                              <p className="text-xs text-slate-400 mt-1">Ref: {dir.referencia}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Notas */}
                  {cliente.notas && (
                    <Card padding="md">
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">Notas</h3>
                      <p className="text-slate-600 text-sm whitespace-pre-wrap">{cliente.notas}</p>
                    </Card>
                  )}
                </div>
              )}

              {/* Tab: Ventas */}
              {tabActiva === 'ventas' && historial && (
                <div className="space-y-6">
                  {/* Resumen de ventas */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card padding="md" className="bg-emerald-50">
                      <div className="text-center">
                        <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-emerald-700">
                          {historial.resumen.ventasCompletadas}
                        </div>
                        <div className="text-xs text-emerald-600">Completadas</div>
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
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Historial de Compras</h3>
                    {historial.ventas.length === 0 ? (
                      <Card padding="lg" className="text-center">
                        <ShoppingCart className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">Este cliente no tiene compras registradas</p>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {historial.ventas.map((v) => {
                          const estadoBadge = getEstadoVentaBadge(v.estado);
                          const estadoPago = getEstadoPagoBadge(v.estadoPago);
                          return (
                            <Card key={v.id} padding="sm" className="hover:bg-slate-50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                  <div className="h-10 w-10 bg-sky-100 rounded-lg flex items-center justify-center">
                                    <FileText className="h-5 w-5 text-sky-600" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-slate-900">{v.numeroVenta}</div>
                                    <div className="text-sm text-slate-500">
                                      {v.fechaCreacion.toDate().toLocaleDateString('es-PE')}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-6">
                                  <div className="text-center">
                                    <div className="text-sm font-medium text-slate-900">
                                      {v.productos.reduce((sum, p) => sum + p.cantidad, 0)}
                                    </div>
                                    <div className="text-xs text-slate-500">Productos</div>
                                  </div>

                                  <div className="text-center">
                                    <div className="text-sm font-medium text-emerald-600">
                                      S/ {v.totalPEN.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-slate-500">Total</div>
                                  </div>

                                  <Badge variant={estadoBadge.variant}>{estadoBadge.label}</Badge>
                                  <Badge variant={estadoPago.variant}>{estadoPago.label}</Badge>

                                  <ArrowRight className="h-5 w-5 text-slate-300" />
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
                    <Card padding="md" className="bg-emerald-50">
                      <div className="text-center">
                        <CheckCircle className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
                        <div className="text-xl font-bold text-emerald-700">
                          S/ {historial.resumen.totalCobradoPEN.toLocaleString()}
                        </div>
                        <div className="text-xs text-emerald-600">Total Cobrado</div>
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

                    <Card padding="md" className="bg-sky-50">
                      <div className="text-center">
                        <TrendingUp className="h-6 w-6 text-sky-500 mx-auto mb-2" />
                        <div className="text-xl font-bold text-sky-700">
                          S/ {historial.resumen.ticketPromedio.toFixed(0)}
                        </div>
                        <div className="text-xs text-sky-600">Ticket Promedio</div>
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
                      <h4 className="font-semibold text-slate-900 mb-3">Tasa de Cobranza</h4>
                      <div className="relative">
                        <div className="h-6 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{
                              width: `${Math.min(
                                (historial.resumen.totalCobradoPEN / historial.resumen.totalVendidoPEN) * 100,
                                100
                              )}%`
                            }}
                          />
                        </div>
                        <div className="flex justify-between mt-2 text-sm text-slate-600">
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
                      <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
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
                                  <div className="font-medium text-slate-900">{v.numeroVenta}</div>
                                  <div className="text-sm text-slate-500">
                                    {v.fechaCreacion.toDate().toLocaleDateString('es-PE')}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                  <div className="text-right">
                                    <div className="text-lg font-bold text-amber-700">
                                      S/ {montoPendiente.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-slate-500">
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
                      <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                        <CheckCircle className="h-5 w-5 mr-2 text-emerald-500" />
                        Ventas Cobradas ({historial.cobradas.length})
                      </h3>
                      <div className="space-y-3">
                        {historial.cobradas.slice(0, 5).map((v) => (
                          <Card key={v.id} padding="sm" className="border-l-4 border-l-emerald-400 bg-emerald-50">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-slate-900">{v.numeroVenta}</div>
                                <div className="text-sm text-slate-500">
                                  {/* S55 Fase 3 — fechaPagoCompleto eliminada. Si está pagada,
                                       se muestra fecha de creación como aproximación (la fecha
                                       real del pago vive en MovimientoCC del cliente). */}
                                  {v.fechaCreacion.toDate().toLocaleDateString('es-PE')}
                                </div>
                              </div>
                              <div className="flex items-center space-x-4">
                                <div className="text-right">
                                  <div className="text-lg font-bold text-emerald-700">
                                    S/ {v.totalPEN.toLocaleString()}
                                  </div>
                                </div>
                                <Badge variant="success">Pagado</Badge>
                              </div>
                            </div>
                          </Card>
                        ))}
                        {historial.cobradas.length > 5 && (
                          <p className="text-sm text-slate-500 text-center">
                            ... y {historial.cobradas.length - 5} ventas mas
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sin movimientos */}
                  {historial.porCobrar.length === 0 && historial.cobradas.length === 0 && (
                    <Card padding="lg" className="text-center">
                      <DollarSign className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">No hay movimientos financieros registrados</p>
                    </Card>
                  )}

                  {/* Fechas */}
                  {(historial.resumen.primeraCompra || historial.resumen.ultimaCompra) && (
                    <Card padding="md" className="bg-slate-50">
                      <div className="flex items-center justify-between text-sm">
                        {historial.resumen.primeraCompra && (
                          <div>
                            <span className="text-slate-500">Primera compra:</span>
                            <span className="ml-2 font-medium text-slate-900">
                              {historial.resumen.primeraCompra.toLocaleDateString('es-PE')}
                            </span>
                          </div>
                        )}
                        {historial.resumen.ultimaCompra && (
                          <div>
                            <span className="text-slate-500">Ultima compra:</span>
                            <span className="ml-2 font-medium text-slate-900">
                              {historial.resumen.ultimaCompra.toLocaleDateString('es-PE')}
                            </span>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Tab: Cuenta Corriente — S55 Fase 7 */}
              {tabActiva === 'cuenta_corriente' && (
                <CuentaCorrienteTab
                  entidadId={cliente.id}
                  tipo="cliente"
                  entidadNombre={cliente.nombre}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
