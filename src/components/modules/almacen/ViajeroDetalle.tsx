import React, { useEffect, useState } from 'react';
import {
  X,
  Users,
  Package,
  DollarSign,
  Plane,
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar,
  MapPin,
  Phone,
  TrendingUp,
  ArrowRight,
  FileText
} from 'lucide-react';
import { Button, Card, Badge } from '../../common';
import { transferenciaService } from '../../../services/transferencia.service';
import type { Almacen } from '../../../types/almacen.types';
import type { Transferencia } from '../../../types/transferencia.types';

interface ViajeroDetalleProps {
  viajero: Almacen;
  onClose: () => void;
  onEdit: () => void;
}

type TabActiva = 'info' | 'transferencias' | 'financiero';

interface HistorialViajero {
  transferencias: Transferencia[];
  resumen: {
    totalTransferencias: number;
    transferenciasCompletadas: number;
    transferenciasEnTransito: number;
    totalUnidadesTransportadas: number;
    totalFletePagado: number;
    totalFletePendiente: number;
    monedaFlete: 'USD' | 'PEN';
    promedioFletePorUnidad: number;
    ultimaTransferencia?: Date;
    primeraTransferencia?: Date;
  };
  pendientes: Transferencia[];
  pagados: Transferencia[];
}

// Interfaz para métricas calculadas en tiempo real
interface MetricasViajeroCalculadas {
  unidadesActuales: number;
  valorInventarioUSD: number;
  totalUnidadesEnviadas: number;
  tiempoPromedioAlmacenamiento: number;
  loading: boolean;
}

export const ViajeroDetalle: React.FC<ViajeroDetalleProps> = ({
  viajero,
  onClose,
  onEdit
}) => {
  const [tabActiva, setTabActiva] = useState<TabActiva>('info');
  const [historial, setHistorial] = useState<HistorialViajero | null>(null);
  const [loading, setLoading] = useState(false);

  // Estado para métricas calculadas en tiempo real
  const [metricas, setMetricas] = useState<MetricasViajeroCalculadas>({
    unidadesActuales: 0,
    valorInventarioUSD: 0,
    totalUnidadesEnviadas: 0,
    tiempoPromedioAlmacenamiento: 0,
    loading: true
  });

  // Calcular métricas reales desde Firebase
  useEffect(() => {
    const calcularMetricasReales = async () => {
      setMetricas(prev => ({ ...prev, loading: true }));

      try {
        const { collection, getDocs, query, where } = await import('firebase/firestore');
        const { db } = await import('../../../lib/firebase');

        // Obtener todas las unidades de este viajero/almacén
        const unidadesQuery = query(
          collection(db, 'unidades'),
          where('almacenId', '==', viajero.id)
        );
        const unidadesSnapshot = await getDocs(unidadesQuery);

        // Filtrar unidades disponibles (excluir estados terminales)
        const estadosExcluidos = ['vendida', 'vencida', 'danada', 'en_transito_peru'];
        let unidadesDisponibles = 0;
        let valorTotal = 0;
        let sumaDiasAlmacenamiento = 0;
        let unidadesConFecha = 0;
        const ahora = Date.now();

        unidadesSnapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (!estadosExcluidos.includes(data.estado)) {
            unidadesDisponibles++;
            valorTotal += data.costoUnitarioUSD || 0;

            // Calcular días de almacenamiento basado en fecha de recepción
            // Prioridad: fechaRecepcion > fechaCreacion
            const fechaCampo = data.fechaRecepcion || data.fechaCreacion;
            if (fechaCampo) {
              const fechaIngreso = fechaCampo.toDate?.()
                ? fechaCampo.toDate().getTime()
                : new Date(fechaCampo).getTime();
              const diasEnAlmacen = Math.floor((ahora - fechaIngreso) / (1000 * 60 * 60 * 24));
              if (diasEnAlmacen >= 0) {
                sumaDiasAlmacenamiento += diasEnAlmacen;
                unidadesConFecha++;
              }
            }
          }
        });

        const tiempoPromedio = unidadesConFecha > 0
          ? Math.round(sumaDiasAlmacenamiento / unidadesConFecha)
          : 0;

        // Obtener transferencias enviadas por este viajero
        // Un viajero puede enviar de dos formas:
        // 1. Como almacenOrigenId (envía desde su almacén)
        // 2. Como viajeroId (transporta productos usa_peru)

        let totalEnviadas = 0;
        const transferenciasContadas = new Set<string>();

        // Opción 1: Transferencias donde es el almacén origen
        const transferenciasOrigenQuery = query(
          collection(db, 'transferencias'),
          where('almacenOrigenId', '==', viajero.id)
        );
        const transferenciasOrigen = await getDocs(transferenciasOrigenQuery);

        transferenciasOrigen.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.estado === 'completada' || data.estado === 'en_transito' || data.estado === 'recibida' || data.estado === 'recibida_completa') {
            totalEnviadas += data.totalUnidades || data.cantidadUnidades || data.unidadesIds?.length || 0;
            transferenciasContadas.add(docSnap.id);
          }
        });

        // Opción 2: Transferencias donde es el viajero que transporta (usa_peru)
        const transferenciasViajeroQuery = query(
          collection(db, 'transferencias'),
          where('viajeroId', '==', viajero.id)
        );
        const transferenciasViajero = await getDocs(transferenciasViajeroQuery);

        transferenciasViajero.docs.forEach(docSnap => {
          const data = docSnap.data();
          // Solo contar si no fue contada ya
          if (!transferenciasContadas.has(docSnap.id)) {
            if (data.estado === 'completada' || data.estado === 'en_transito' || data.estado === 'recibida' || data.estado === 'recibida_completa') {
              totalEnviadas += data.totalUnidades || data.cantidadUnidades || data.unidadesIds?.length || 0;
            }
          }
        });

        console.log(`[ViajeroDetalle] Métricas calculadas para ${viajero.nombre}:`, {
          unidadesDisponibles,
          valorTotal,
          totalEnviadas,
          tiempoPromedio,
          transferenciasOrigen: transferenciasOrigen.docs.length,
          transferenciasViajero: transferenciasViajero.docs.length
        });

        setMetricas({
          unidadesActuales: unidadesDisponibles,
          valorInventarioUSD: valorTotal,
          totalUnidadesEnviadas: totalEnviadas,
          tiempoPromedioAlmacenamiento: tiempoPromedio,
          loading: false
        });
      } catch (error) {
        console.error('Error calculando métricas del viajero:', error);
        // Fallback a datos del documento
        setMetricas({
          unidadesActuales: viajero.unidadesActuales || 0,
          valorInventarioUSD: viajero.valorInventarioUSD || 0,
          totalUnidadesEnviadas: viajero.totalUnidadesEnviadas || 0,
          tiempoPromedioAlmacenamiento: viajero.tiempoPromedioAlmacenamiento || 0,
          loading: false
        });
      }
    };

    calcularMetricasReales();
  }, [viajero.id, viajero.unidadesActuales, viajero.valorInventarioUSD, viajero.totalUnidadesEnviadas, viajero.tiempoPromedioAlmacenamiento]);

  useEffect(() => {
    const cargarHistorial = async () => {
      setLoading(true);
      try {
        const data = await transferenciaService.getHistorialFinancieroViajero(viajero.id);
        setHistorial(data);
      } catch (error) {
        console.error('Error cargando historial:', error);
      } finally {
        setLoading(false);
      }
    };

    cargarHistorial();
  }, [viajero.id]);

  const proximoViaje = viajero.proximoViaje?.toDate();
  const diasParaViaje = proximoViaje
    ? Math.ceil((proximoViaje.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const getEstadoBadge = (estado: string) => {
    const estados: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; label: string }> = {
      'preparando': { variant: 'default', label: 'Preparando' },
      'en_transito': { variant: 'warning', label: 'En Transito' },
      'recibida_completa': { variant: 'success', label: 'Recibida' },
      'recibida_parcial': { variant: 'info', label: 'Parcial' },
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
    return { variant: 'default' as const, label: estado };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white">
          <div className="flex items-center space-x-4">
            <div className="h-14 w-14 bg-purple-100 rounded-full flex items-center justify-center">
              <Users className="h-7 w-7 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{viajero.nombre}</h2>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm text-gray-500">{viajero.codigo}</span>
                <Badge variant={viajero.estadoAlmacen === 'activo' ? 'success' : 'default'}>
                  {viajero.estadoAlmacen}
                </Badge>
                <Badge variant="info">Viajero</Badge>
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
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Informacion
            </button>
            <button
              onClick={() => setTabActiva('transferencias')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabActiva === 'transferencias'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Plane className="h-4 w-4 inline mr-2" />
              Transferencias
              {historial && (
                <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  {historial.resumen.totalTransferencias}
                </span>
              )}
            </button>
            <button
              onClick={() => setTabActiva('financiero')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabActiva === 'financiero'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DollarSign className="h-4 w-4 inline mr-2" />
              Financiero
              {historial && historial.pendientes.length > 0 && (
                <span className="ml-2 bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-xs">
                  {historial.pendientes.length} pend.
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <>
              {/* Tab: Informacion */}
              {tabActiva === 'info' && (
                <div className="space-y-6">
                  {/* KPIs rapidos - Calculados en tiempo real */}
                  <div className="grid grid-cols-4 gap-4">
                    <Card padding="md" className="bg-purple-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-purple-600 font-medium">Unidades Actuales</div>
                          <div className="text-2xl font-bold text-purple-700">
                            {metricas.loading ? '...' : metricas.unidadesActuales}
                          </div>
                        </div>
                        <Package className="h-8 w-8 text-purple-400" />
                      </div>
                    </Card>

                    <Card padding="md" className="bg-green-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-green-600 font-medium">Valor Inventario</div>
                          <div className="text-2xl font-bold text-green-700">
                            {metricas.loading ? '...' : `$${metricas.valorInventarioUSD.toFixed(0)}`}
                          </div>
                        </div>
                        <DollarSign className="h-8 w-8 text-green-400" />
                      </div>
                    </Card>

                    <Card padding="md" className="bg-blue-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-blue-600 font-medium">Total Enviadas</div>
                          <div className="text-2xl font-bold text-blue-700">
                            {metricas.loading ? '...' : metricas.totalUnidadesEnviadas}
                          </div>
                        </div>
                        <TrendingUp className="h-8 w-8 text-blue-400" />
                      </div>
                    </Card>

                    <Card padding="md" className="bg-amber-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-amber-600 font-medium">Dias Promedio</div>
                          <div className="text-2xl font-bold text-amber-700">
                            {metricas.loading ? '...' : metricas.tiempoPromedioAlmacenamiento}
                          </div>
                        </div>
                        <Clock className="h-8 w-8 text-amber-400" />
                      </div>
                    </Card>
                  </div>

                  {/* Proximo viaje */}
                  {proximoViaje && (
                    <Card padding="md" className={diasParaViaje && diasParaViaje <= 7 ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Plane className={`h-6 w-6 ${diasParaViaje && diasParaViaje <= 7 ? 'text-amber-600' : 'text-blue-600'}`} />
                          <div>
                            <div className="font-semibold text-gray-900">Proximo Viaje</div>
                            <div className="text-sm text-gray-600">
                              {proximoViaje.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                          </div>
                        </div>
                        {diasParaViaje !== null && (
                          <div className={`text-right px-4 py-2 rounded-lg ${diasParaViaje <= 7 ? 'bg-amber-100' : 'bg-blue-100'}`}>
                            <div className={`text-2xl font-bold ${diasParaViaje <= 7 ? 'text-amber-700' : 'text-blue-700'}`}>
                              {diasParaViaje === 0 ? 'Hoy' : diasParaViaje === 1 ? 'Manana' : `${diasParaViaje} dias`}
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}

                  {/* Datos de contacto */}
                  <div className="grid grid-cols-2 gap-6">
                    <Card padding="md">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <MapPin className="h-5 w-5 mr-2 text-gray-400" />
                        Ubicacion
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="text-gray-900">{viajero.direccion}</div>
                        <div className="text-gray-600">{viajero.ciudad}, {viajero.estado}</div>
                        {viajero.codigoPostal && (
                          <div className="text-gray-500">CP: {viajero.codigoPostal}</div>
                        )}
                        <div className="text-gray-500">{viajero.pais}</div>
                      </div>
                    </Card>

                    <Card padding="md">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Phone className="h-5 w-5 mr-2 text-gray-400" />
                        Contacto
                      </h3>
                      <div className="space-y-2 text-sm">
                        {viajero.telefono && (
                          <div className="flex items-center">
                            <span className="text-gray-500 w-20">Telefono:</span>
                            <span className="text-gray-900">{viajero.telefono}</span>
                          </div>
                        )}
                        {viajero.whatsapp && (
                          <div className="flex items-center">
                            <span className="text-gray-500 w-20">WhatsApp:</span>
                            <span className="text-green-600">{viajero.whatsapp}</span>
                          </div>
                        )}
                        {viajero.email && (
                          <div className="flex items-center">
                            <span className="text-gray-500 w-20">Email:</span>
                            <span className="text-gray-900">{viajero.email}</span>
                          </div>
                        )}
                        {viajero.frecuenciaViaje && (
                          <div className="flex items-center mt-4 pt-4 border-t">
                            <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-gray-600">Frecuencia: </span>
                            <span className="ml-1 font-medium text-gray-900">{viajero.frecuenciaViaje}</span>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>

                  {/* Notas */}
                  {viajero.notas && (
                    <Card padding="md">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Notas</h3>
                      <p className="text-gray-600 text-sm whitespace-pre-wrap">{viajero.notas}</p>
                    </Card>
                  )}
                </div>
              )}

              {/* Tab: Transferencias */}
              {tabActiva === 'transferencias' && historial && (
                <div className="space-y-6">
                  {/* Resumen de transferencias */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card padding="md" className="bg-green-50">
                      <div className="text-center">
                        <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-green-700">
                          {historial.resumen.transferenciasCompletadas}
                        </div>
                        <div className="text-xs text-green-600">Completadas</div>
                      </div>
                    </Card>

                    <Card padding="md" className="bg-amber-50">
                      <div className="text-center">
                        <Plane className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-amber-700">
                          {historial.resumen.transferenciasEnTransito}
                        </div>
                        <div className="text-xs text-amber-600">En Transito</div>
                      </div>
                    </Card>

                    <Card padding="md" className="bg-blue-50">
                      <div className="text-center">
                        <Package className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-blue-700">
                          {historial.resumen.totalUnidadesTransportadas}
                        </div>
                        <div className="text-xs text-blue-600">Unidades Transportadas</div>
                      </div>
                    </Card>
                  </div>

                  {/* Lista de transferencias */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Historial de Transferencias</h3>
                    {historial.transferencias.length === 0 ? (
                      <Card padding="lg" className="text-center">
                        <Plane className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">Este viajero no tiene transferencias registradas</p>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {historial.transferencias.map((t) => {
                          const estadoBadge = getEstadoBadge(t.estado);
                          return (
                            <Card key={t.id} padding="sm" className="hover:bg-gray-50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                  <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <FileText className="h-5 w-5 text-purple-600" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900">{t.numeroTransferencia}</div>
                                    <div className="text-sm text-gray-500">
                                      {t.fechaCreacion.toDate().toLocaleDateString('es-PE')}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-6">
                                  <div className="text-center">
                                    <div className="text-sm font-medium text-gray-900">{t.unidades.length}</div>
                                    <div className="text-xs text-gray-500">Unidades</div>
                                  </div>

                                  <div className="text-center">
                                    <div className="text-sm font-medium text-green-600">
                                      ${(t.costoFleteTotal || 0).toFixed(2)}
                                    </div>
                                    <div className="text-xs text-gray-500">Flete</div>
                                  </div>

                                  <Badge variant={estadoBadge.variant}>{estadoBadge.label}</Badge>

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
                          ${historial.resumen.totalFletePagado.toFixed(2)}
                        </div>
                        <div className="text-xs text-green-600">Total Pagado</div>
                      </div>
                    </Card>

                    <Card padding="md" className="bg-amber-50">
                      <div className="text-center">
                        <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                        <div className="text-xl font-bold text-amber-700">
                          ${historial.resumen.totalFletePendiente.toFixed(2)}
                        </div>
                        <div className="text-xs text-amber-600">Pendiente por Pagar</div>
                      </div>
                    </Card>

                    <Card padding="md" className="bg-blue-50">
                      <div className="text-center">
                        <TrendingUp className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                        <div className="text-xl font-bold text-blue-700">
                          ${historial.resumen.promedioFletePorUnidad.toFixed(2)}
                        </div>
                        <div className="text-xs text-blue-600">Promedio por Unidad</div>
                      </div>
                    </Card>

                    <Card padding="md" className="bg-purple-50">
                      <div className="text-center">
                        <DollarSign className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                        <div className="text-xl font-bold text-purple-700">
                          ${(historial.resumen.totalFletePagado + historial.resumen.totalFletePendiente).toFixed(2)}
                        </div>
                        <div className="text-xs text-purple-600">Total Historico</div>
                      </div>
                    </Card>
                  </div>

                  {/* Pagos pendientes */}
                  {historial.pendientes.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
                        Pagos Pendientes ({historial.pendientes.length})
                      </h3>
                      <div className="space-y-3">
                        {historial.pendientes.map((t) => {
                          const estadoPago = getEstadoPagoBadge(t.estadoPagoViajero);
                          return (
                            <Card key={t.id} padding="sm" className="border-l-4 border-l-amber-400 bg-amber-50">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium text-gray-900">{t.numeroTransferencia}</div>
                                  <div className="text-sm text-gray-500">
                                    {t.fechaLlegadaReal
                                      ? `Llegada: ${t.fechaLlegadaReal.toDate().toLocaleDateString('es-PE')}`
                                      : `Creada: ${t.fechaCreacion.toDate().toLocaleDateString('es-PE')}`
                                    }
                                  </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                  <div className="text-right">
                                    <div className="text-lg font-bold text-amber-700">
                                      ${(t.costoFleteTotal || 0).toFixed(2)}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {t.unidades.length} unidades
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

                  {/* Pagos realizados */}
                  {historial.pagados.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                        Pagos Realizados ({historial.pagados.length})
                      </h3>
                      <div className="space-y-3">
                        {historial.pagados.map((t) => (
                          <Card key={t.id} padding="sm" className="border-l-4 border-l-green-400 bg-green-50">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-gray-900">{t.numeroTransferencia}</div>
                                <div className="text-sm text-gray-500">
                                  {t.pagoViajero?.fecha
                                    ? `Pagado: ${t.pagoViajero.fecha.toDate().toLocaleDateString('es-PE')}`
                                    : t.fechaCreacion.toDate().toLocaleDateString('es-PE')
                                  }
                                </div>
                              </div>
                              <div className="flex items-center space-x-4">
                                <div className="text-right">
                                  <div className="text-lg font-bold text-green-700">
                                    ${(t.costoFleteTotal || 0).toFixed(2)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {t.unidades.length} unidades
                                  </div>
                                </div>
                                <Badge variant="success">Pagado</Badge>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sin movimientos */}
                  {historial.pendientes.length === 0 && historial.pagados.length === 0 && (
                    <Card padding="lg" className="text-center">
                      <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No hay movimientos financieros registrados</p>
                    </Card>
                  )}

                  {/* Fechas */}
                  {(historial.resumen.primeraTransferencia || historial.resumen.ultimaTransferencia) && (
                    <Card padding="md" className="bg-gray-50">
                      <div className="flex items-center justify-between text-sm">
                        {historial.resumen.primeraTransferencia && (
                          <div>
                            <span className="text-gray-500">Primera transferencia:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {historial.resumen.primeraTransferencia.toLocaleDateString('es-PE')}
                            </span>
                          </div>
                        )}
                        {historial.resumen.ultimaTransferencia && (
                          <div>
                            <span className="text-gray-500">Ultima transferencia:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {historial.resumen.ultimaTransferencia.toLocaleDateString('es-PE')}
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
