import React, { useEffect, useState } from 'react';
import {
  X,
  Warehouse,
  Plane,
  Package,
  MapPin,
  Phone,
  Calendar,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Activity,
  Percent
} from 'lucide-react';
import { Button, Badge } from '../../common';
import { Card } from '../../common/Card';
import { Tabs, TabsProvider, TabPanel, useTabs } from '../../common/Tabs';
import { KPICard, KPIGrid, AlertCard, StatDistribution } from '../../common/KPICard';
import { SimpleAreaChart, MultiLineChart, SimpleBarChart, CHART_COLORS } from '../../common/Charts';
import type { Almacen } from '../../../types/almacen.types';

interface AlmacenDetalleProps {
  almacen: Almacen;
  onClose: () => void;
  onEdit: () => void;
}

type TabActiva = 'resumen' | 'inventario' | 'movimientos' | 'analytics';

// Interfaces para datos calculados
interface MetricasInventario {
  unidadesActuales: number;
  valorInventarioUSD: number;
  productosPorSKU: Array<{
    sku: string;
    nombre: string;
    cantidad: number;
    valorUSD: number;
  }>;
  unidadesProximasVencer: Array<{
    id: string;
    sku: string;
    lote: string;
    diasParaVencer: number;
  }>;
  loading: boolean;
}

interface MetricasMovimientos {
  totalRecibidas: number;
  totalEnviadas: number;
  balanceNeto: number;
  movimientosPorMes: Array<{
    mes: string;
    recibidas: number;
    enviadas: number;
  }>;
  ultimasTransferencias: Array<{
    id: string;
    numero: string;
    tipo: 'entrada' | 'salida';
    unidades: number;
    fecha: Date;
  }>;
  loading: boolean;
}

interface MetricasAnalytics {
  ocupacionHistorica: Array<{
    mes: string;
    ocupacion: number;
    capacidad: number;
  }>;
  rotacionInventario: number;
  eficienciaAlmacen: number;
  cumplimientoViajes?: number;
  loading: boolean;
}

export const AlmacenDetalle: React.FC<AlmacenDetalleProps> = ({
  almacen,
  onClose,
  onEdit
}) => {
  const { activeTab, setActiveTab } = useTabs<TabActiva>('resumen');

  // Estados para métricas calculadas
  const [metricasInventario, setMetricasInventario] = useState<MetricasInventario>({
    unidadesActuales: 0,
    valorInventarioUSD: 0,
    productosPorSKU: [],
    unidadesProximasVencer: [],
    loading: true
  });

  const [metricasMovimientos, setMetricasMovimientos] = useState<MetricasMovimientos>({
    totalRecibidas: 0,
    totalEnviadas: 0,
    balanceNeto: 0,
    movimientosPorMes: [],
    ultimasTransferencias: [],
    loading: true
  });

  const [metricasAnalytics, setMetricasAnalytics] = useState<MetricasAnalytics>({
    ocupacionHistorica: [],
    rotacionInventario: 0,
    eficienciaAlmacen: 0,
    cumplimientoViajes: undefined,
    loading: true
  });

  // Calcular capacidad usada
  const capacidadUsada = almacen.capacidadUnidades && almacen.capacidadUnidades > 0
    ? (almacen.unidadesActuales || 0) / almacen.capacidadUnidades * 100
    : 0;

  // Cargar métricas de inventario
  useEffect(() => {
    const cargarMetricasInventario = async () => {
      setMetricasInventario(prev => ({ ...prev, loading: true }));

      try {
        const { collection, getDocs, query, where } = await import('firebase/firestore');
        const { db } = await import('../../../lib/firebase');

        // Obtener unidades del almacén
        const unidadesQuery = query(
          collection(db, 'unidades'),
          where('almacenId', '==', almacen.id)
        );
        const unidadesSnapshot = await getDocs(unidadesQuery);

        // Filtrar unidades disponibles
        const estadosDisponibles = ['recibida_usa', 'disponible_peru', 'reservada'];
        const productoMap = new Map<string, { nombre: string; cantidad: number; valorUSD: number }>();
        const proximasVencer: Array<{ id: string; sku: string; lote: string; diasParaVencer: number }> = [];
        let unidadesActuales = 0;
        let valorTotal = 0;
        const ahora = new Date();

        unidadesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (estadosDisponibles.includes(data.estado)) {
            unidadesActuales++;
            const valorUnidad = data.costoUnitarioUSD || 0;
            valorTotal += valorUnidad;

            // Agrupar por SKU
            const key = data.productoSKU;
            if (productoMap.has(key)) {
              const existing = productoMap.get(key)!;
              existing.cantidad++;
              existing.valorUSD += valorUnidad;
            } else {
              productoMap.set(key, {
                nombre: data.productoNombre || data.productoSKU,
                cantidad: 1,
                valorUSD: valorUnidad
              });
            }

            // Verificar próximas a vencer (30 días)
            if (data.fechaVencimiento?.toDate) {
              const vencimiento = data.fechaVencimiento.toDate();
              const diasParaVencer = Math.ceil((vencimiento.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
              if (diasParaVencer > 0 && diasParaVencer <= 30) {
                proximasVencer.push({
                  id: doc.id,
                  sku: data.productoSKU,
                  lote: data.lote,
                  diasParaVencer
                });
              }
            }
          }
        });

        // Convertir mapa a array y ordenar
        const productosPorSKU = Array.from(productoMap.entries())
          .map(([sku, data]) => ({ sku, ...data }))
          .sort((a, b) => b.cantidad - a.cantidad);

        // Ordenar próximas a vencer
        proximasVencer.sort((a, b) => a.diasParaVencer - b.diasParaVencer);

        setMetricasInventario({
          unidadesActuales,
          valorInventarioUSD: valorTotal,
          productosPorSKU,
          unidadesProximasVencer: proximasVencer,
          loading: false
        });
      } catch (error) {
        console.error('Error cargando métricas de inventario:', error);
        setMetricasInventario(prev => ({ ...prev, loading: false }));
      }
    };

    cargarMetricasInventario();
  }, [almacen.id]);

  // Cargar métricas de movimientos
  useEffect(() => {
    const cargarMetricasMovimientos = async () => {
      setMetricasMovimientos(prev => ({ ...prev, loading: true }));

      try {
        const { collection, getDocs, query, where, orderBy, limit } = await import('firebase/firestore');
        const { db } = await import('../../../lib/firebase');

        // Transferencias recibidas (destino)
        const recibidasQuery = query(
          collection(db, 'transferencias'),
          where('almacenDestinoId', '==', almacen.id)
        );
        const recibidasSnapshot = await getDocs(recibidasQuery);

        // Transferencias enviadas (origen)
        const enviadasQuery = query(
          collection(db, 'transferencias'),
          where('almacenOrigenId', '==', almacen.id)
        );
        const enviadasSnapshot = await getDocs(enviadasQuery);

        let totalRecibidas = 0;
        let totalEnviadas = 0;
        const movimientosPorMesMap = new Map<string, { recibidas: number; enviadas: number }>();
        const ultimasTransferencias: Array<{ id: string; numero: string; tipo: 'entrada' | 'salida'; unidades: number; fecha: Date }> = [];

        // Procesar recibidas
        recibidasSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const cantidad = data.totalUnidades || data.cantidadUnidades || data.unidadesIds?.length || 0;
          totalRecibidas += cantidad;

          const fecha = data.fechaCreacion?.toDate() || new Date();
          const mes = fecha.toLocaleDateString('es-PE', { year: 'numeric', month: 'short' });

          if (movimientosPorMesMap.has(mes)) {
            movimientosPorMesMap.get(mes)!.recibidas += cantidad;
          } else {
            movimientosPorMesMap.set(mes, { recibidas: cantidad, enviadas: 0 });
          }

          if (['completada', 'en_transito', 'recibida', 'recibida_completa'].includes(data.estado)) {
            ultimasTransferencias.push({
              id: doc.id,
              numero: data.numeroTransferencia,
              tipo: 'entrada',
              unidades: cantidad,
              fecha
            });
          }
        });

        // Procesar enviadas
        enviadasSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const cantidad = data.totalUnidades || data.cantidadUnidades || data.unidadesIds?.length || 0;
          totalEnviadas += cantidad;

          const fecha = data.fechaCreacion?.toDate() || new Date();
          const mes = fecha.toLocaleDateString('es-PE', { year: 'numeric', month: 'short' });

          if (movimientosPorMesMap.has(mes)) {
            movimientosPorMesMap.get(mes)!.enviadas += cantidad;
          } else {
            movimientosPorMesMap.set(mes, { recibidas: 0, enviadas: cantidad });
          }

          if (['completada', 'en_transito', 'recibida', 'recibida_completa'].includes(data.estado)) {
            ultimasTransferencias.push({
              id: doc.id,
              numero: data.numeroTransferencia,
              tipo: 'salida',
              unidades: cantidad,
              fecha
            });
          }
        });

        // Convertir a array y ordenar
        const movimientosPorMes = Array.from(movimientosPorMesMap.entries())
          .map(([mes, data]) => ({ mes, ...data }))
          .sort((a, b) => {
            const dateA = new Date(a.mes);
            const dateB = new Date(b.mes);
            return dateA.getTime() - dateB.getTime();
          })
          .slice(-6); // Últimos 6 meses

        // Ordenar transferencias por fecha
        ultimasTransferencias.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

        setMetricasMovimientos({
          totalRecibidas,
          totalEnviadas,
          balanceNeto: totalRecibidas - totalEnviadas,
          movimientosPorMes,
          ultimasTransferencias: ultimasTransferencias.slice(0, 10),
          loading: false
        });
      } catch (error) {
        console.error('Error cargando métricas de movimientos:', error);
        setMetricasMovimientos(prev => ({ ...prev, loading: false }));
      }
    };

    cargarMetricasMovimientos();
  }, [almacen.id]);

  // Cargar métricas de analytics
  useEffect(() => {
    const cargarMetricasAnalytics = async () => {
      setMetricasAnalytics(prev => ({ ...prev, loading: true }));

      try {
        // Simular datos de ocupación histórica (en producción vendría de Firebase)
        const ocupacionHistorica = Array.from({ length: 6 }, (_, i) => {
          const fecha = new Date();
          fecha.setMonth(fecha.getMonth() - (5 - i));
          const ocupacionBase = (almacen.unidadesActuales || 0) * (0.7 + Math.random() * 0.3);
          return {
            mes: fecha.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' }),
            ocupacion: Math.round(ocupacionBase),
            capacidad: almacen.capacidadUnidades || 0
          };
        });

        // Calcular rotación (unidades enviadas / promedio inventario)
        const promedioInventario = (almacen.unidadesActuales || 0);
        const rotacionInventario = promedioInventario > 0
          ? ((almacen.totalUnidadesEnviadas || 0) / promedioInventario)
          : 0;

        // Calcular eficiencia (% utilización promedio + rotación)
        const eficienciaAlmacen = Math.min(100, (capacidadUsada * 0.6) + (rotacionInventario * 10));

        // Cumplimiento de viajes (solo para viajeros)
        let cumplimientoViajes: number | undefined;
        if (almacen.esViajero && almacen.metricasOperativas?.viajesRealizados) {
          cumplimientoViajes = almacen.metricasOperativas.tasaPuntualidadViajes || 0;
        }

        setMetricasAnalytics({
          ocupacionHistorica,
          rotacionInventario: Math.round(rotacionInventario * 10) / 10,
          eficienciaAlmacen: Math.round(eficienciaAlmacen),
          cumplimientoViajes,
          loading: false
        });
      } catch (error) {
        console.error('Error cargando métricas de analytics:', error);
        setMetricasAnalytics(prev => ({ ...prev, loading: false }));
      }
    };

    cargarMetricasAnalytics();
  }, [almacen.id, almacen.unidadesActuales, almacen.capacidadUnidades, almacen.totalUnidadesEnviadas, almacen.esViajero, almacen.metricasOperativas, capacidadUsada]);

  // Determinar color del header según tipo
  const headerGradient = almacen.esViajero
    ? 'from-green-50 via-teal-50 to-white'
    : 'from-blue-50 via-indigo-50 to-white';

  const iconColor = almacen.esViajero ? 'text-teal-600' : 'text-indigo-600';
  const iconBg = almacen.esViajero ? 'bg-teal-100' : 'bg-indigo-100';

  // Determinar variante de capacidad
  const getCapacidadVariant = (): 'success' | 'warning' | 'danger' => {
    if (capacidadUsada >= 90) return 'danger';
    if (capacidadUsada >= 75) return 'warning';
    return 'success';
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: <Package className="h-4 w-4" /> },
    { id: 'inventario', label: 'Inventario', icon: <Warehouse className="h-4 w-4" />, badge: metricasInventario.unidadesActuales },
    { id: 'movimientos', label: 'Movimientos', icon: <ArrowUpDown className="h-4 w-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r ${headerGradient}`}>
          <div className="flex items-center space-x-4">
            <div className={`h-14 w-14 ${iconBg} rounded-full flex items-center justify-center`}>
              {almacen.esViajero ? (
                <Plane className={`h-7 w-7 ${iconColor}`} />
              ) : (
                <Warehouse className={`h-7 w-7 ${iconColor}`} />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{almacen.nombre}</h2>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm text-gray-500">{almacen.codigo}</span>
                <Badge variant={almacen.estadoAlmacen === 'activo' ? 'success' : 'default'}>
                  {almacen.estadoAlmacen}
                </Badge>
                <Badge variant="info">
                  {almacen.esViajero ? 'Viajero' : almacen.tipo === 'almacen_peru' ? 'Perú' : 'USA'}
                </Badge>
                <span className="text-lg">{almacen.pais === 'USA' ? '🇺🇸' : '🇵🇪'}</span>
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

        {/* Tabs Navigation */}
        <div className="border-b border-gray-200 px-6 bg-white">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as TabActiva)}
            variant="underline"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <TabsProvider activeTab={activeTab}>
            {/* Tab: Resumen */}
            <TabPanel tabId="resumen">
              <div className="space-y-6">
                {/* KPIs Principales */}
                <KPIGrid columns={4}>
                  <KPICard
                    title="Unidades Actuales"
                    value={metricasInventario.loading ? '...' : metricasInventario.unidadesActuales}
                    subtitle={almacen.capacidadUnidades ? `de ${almacen.capacidadUnidades}` : undefined}
                    icon={Package}
                    variant="info"
                  />
                  <KPICard
                    title="Capacidad Usada"
                    value={`${capacidadUsada.toFixed(1)}%`}
                    icon={Percent}
                    variant={getCapacidadVariant()}
                  />
                  <KPICard
                    title="Total Recibidas"
                    value={almacen.totalUnidadesRecibidas || 0}
                    icon={TrendingDown}
                    iconColor="text-blue-600"
                  />
                  <KPICard
                    title="Total Enviadas"
                    value={almacen.totalUnidadesEnviadas || 0}
                    icon={TrendingUp}
                    iconColor="text-green-600"
                  />
                </KPIGrid>

                {/* Información Básica */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Ubicación */}
                  <Card title="Ubicación" padding="md">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{almacen.direccion}</div>
                          <div className="text-sm text-gray-600">
                            {almacen.ciudad}{almacen.estado ? `, ${almacen.estado}` : ''}
                          </div>
                          {almacen.codigoPostal && (
                            <div className="text-sm text-gray-500">CP: {almacen.codigoPostal}</div>
                          )}
                          <div className="text-sm text-gray-500 mt-1">{almacen.pais}</div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Contacto */}
                  <Card title="Contacto" padding="md">
                    <div className="space-y-2">
                      {almacen.telefono && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">Teléfono:</span>
                          <span className="text-sm font-medium text-gray-900">{almacen.telefono}</span>
                        </div>
                      )}
                      {almacen.whatsapp && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-gray-600">WhatsApp:</span>
                          <span className="text-sm font-medium text-green-600">{almacen.whatsapp}</span>
                        </div>
                      )}
                      {almacen.email && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">Email:</span>
                          <span className="text-sm font-medium text-gray-900">{almacen.email}</span>
                        </div>
                      )}
                      {almacen.contacto && (
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <span className="text-sm text-gray-600">Responsable:</span>
                          <span className="text-sm font-medium text-gray-900">{almacen.contacto}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Información de Viajero */}
                {almacen.esViajero && (
                  <Card padding="md" className="bg-teal-50 border-teal-200">
                    <div className="flex items-center gap-3 mb-4">
                      <Plane className="h-5 w-5 text-teal-600" />
                      <h3 className="font-semibold text-gray-900">Información de Viajero</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {almacen.frecuenciaViaje && (
                        <div>
                          <div className="text-xs text-gray-600">Frecuencia</div>
                          <div className="text-sm font-medium text-gray-900 capitalize">{almacen.frecuenciaViaje}</div>
                        </div>
                      )}
                      {almacen.proximoViaje && (
                        <div>
                          <div className="text-xs text-gray-600">Próximo Viaje</div>
                          <div className="text-sm font-medium text-gray-900">{formatDate(almacen.proximoViaje)}</div>
                        </div>
                      )}
                      {almacen.costoPromedioFlete !== undefined && (
                        <div>
                          <div className="text-xs text-gray-600">Costo Flete Promedio</div>
                          <div className="text-sm font-medium text-green-600">${almacen.costoPromedioFlete.toFixed(2)}</div>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* Notas */}
                {almacen.notas && (
                  <Card title="Notas" padding="md">
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{almacen.notas}</p>
                  </Card>
                )}
              </div>
            </TabPanel>

            {/* Tab: Inventario */}
            <TabPanel tabId="inventario">
              <div className="space-y-6">
                {/* KPIs de Inventario */}
                <KPIGrid columns={3}>
                  <KPICard
                    title="Unidades Disponibles"
                    value={metricasInventario.loading ? '...' : metricasInventario.unidadesActuales}
                    subtitle="En stock actual"
                    icon={Package}
                    variant="success"
                  />
                  <KPICard
                    title="Valor Total"
                    value={metricasInventario.loading ? '...' : `$${metricasInventario.valorInventarioUSD.toFixed(0)}`}
                    subtitle="USD"
                    icon={Activity}
                    variant="info"
                  />
                  <KPICard
                    title="Productos Únicos"
                    value={metricasInventario.loading ? '...' : metricasInventario.productosPorSKU.length}
                    subtitle="SKUs diferentes"
                    icon={BarChart3}
                  />
                </KPIGrid>

                {/* Alertas de Stock */}
                {metricasInventario.unidadesProximasVencer.length > 0 && (
                  <AlertCard
                    title="Unidades Próximas a Vencer"
                    variant="warning"
                    icon={AlertTriangle}
                    items={metricasInventario.unidadesProximasVencer.map(u => ({
                      id: u.id,
                      label: `${u.sku} - Lote ${u.lote}`,
                      value: `${u.diasParaVencer}d`,
                      sublabel: `Vence en ${u.diasParaVencer} días`
                    }))}
                    maxItems={5}
                  />
                )}

                {/* Alerta de Capacidad */}
                {capacidadUsada >= 75 && (
                  <AlertCard
                    title={capacidadUsada >= 90 ? "Capacidad Crítica" : "Capacidad Alta"}
                    variant={capacidadUsada >= 90 ? "danger" : "warning"}
                    icon={AlertTriangle}
                    items={[{
                      id: 'capacidad',
                      label: `Almacén al ${capacidadUsada.toFixed(1)}% de capacidad`,
                      sublabel: `${metricasInventario.unidadesActuales} de ${almacen.capacidadUnidades} unidades`
                    }]}
                  />
                )}

                {/* Distribución por Producto */}
                {metricasInventario.productosPorSKU.length > 0 && (
                  <Card title="Stock por Producto" padding="md">
                    <div className="space-y-3">
                      {metricasInventario.productosPorSKU.slice(0, 10).map((producto, index) => (
                        <div key={producto.sku} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{producto.sku}</div>
                            <div className="text-sm text-gray-500">{producto.nombre}</div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-lg font-bold text-gray-900">{producto.cantidad}</div>
                              <div className="text-xs text-gray-500">unidades</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-green-600">${producto.valorUSD.toFixed(2)}</div>
                              <div className="text-xs text-gray-500">valor</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {metricasInventario.productosPorSKU.length === 0 && !metricasInventario.loading && (
                  <Card padding="lg" className="text-center">
                    <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No hay unidades en stock actualmente</p>
                  </Card>
                )}
              </div>
            </TabPanel>

            {/* Tab: Movimientos */}
            <TabPanel tabId="movimientos">
              <div className="space-y-6">
                {/* KPIs de Movimientos */}
                <KPIGrid columns={3}>
                  <KPICard
                    title="Total Recibidas"
                    value={metricasMovimientos.loading ? '...' : metricasMovimientos.totalRecibidas}
                    icon={TrendingDown}
                    iconColor="text-blue-600"
                    trend={{
                      value: 0,
                      isPositiveGood: true
                    }}
                  />
                  <KPICard
                    title="Total Enviadas"
                    value={metricasMovimientos.loading ? '...' : metricasMovimientos.totalEnviadas}
                    icon={TrendingUp}
                    iconColor="text-green-600"
                  />
                  <KPICard
                    title="Balance Neto"
                    value={metricasMovimientos.loading ? '...' : metricasMovimientos.balanceNeto}
                    subtitle={metricasMovimientos.balanceNeto > 0 ? 'Entrada neta' : 'Salida neta'}
                    icon={ArrowUpDown}
                    variant={metricasMovimientos.balanceNeto >= 0 ? 'success' : 'warning'}
                  />
                </KPIGrid>

                {/* Gráfico de Movimientos por Mes */}
                {metricasMovimientos.movimientosPorMes.length > 0 && (
                  <Card title="Movimientos por Mes" padding="md">
                    <MultiLineChart
                      data={metricasMovimientos.movimientosPorMes}
                      lines={[
                        { dataKey: 'recibidas', color: CHART_COLORS.primary, name: 'Recibidas' },
                        { dataKey: 'enviadas', color: CHART_COLORS.success, name: 'Enviadas' }
                      ]}
                      xAxisKey="mes"
                      height={300}
                    />
                  </Card>
                )}

                {/* Últimas Transferencias */}
                {metricasMovimientos.ultimasTransferencias.length > 0 && (
                  <Card title="Últimas Transferencias" padding="md">
                    <div className="space-y-2">
                      {metricasMovimientos.ultimasTransferencias.map((transferencia) => (
                        <div
                          key={transferencia.id}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            transferencia.tipo === 'entrada' ? 'bg-blue-50' : 'bg-green-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {transferencia.tipo === 'entrada' ? (
                              <TrendingDown className="h-5 w-5 text-blue-600" />
                            ) : (
                              <TrendingUp className="h-5 w-5 text-green-600" />
                            )}
                            <div>
                              <div className="font-medium text-gray-900">{transferencia.numero}</div>
                              <div className="text-xs text-gray-500">
                                {transferencia.fecha.toLocaleDateString('es-PE')}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={transferencia.tipo === 'entrada' ? 'info' : 'success'}>
                              {transferencia.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                            </Badge>
                            <span className="text-sm font-medium text-gray-900">
                              {transferencia.unidades} unidades
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {metricasMovimientos.ultimasTransferencias.length === 0 && !metricasMovimientos.loading && (
                  <Card padding="lg" className="text-center">
                    <ArrowUpDown className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No hay transferencias registradas</p>
                  </Card>
                )}
              </div>
            </TabPanel>

            {/* Tab: Analytics */}
            <TabPanel tabId="analytics">
              <div className="space-y-6">
                {/* KPIs de Analytics */}
                <KPIGrid columns={almacen.esViajero ? 4 : 3}>
                  <KPICard
                    title="Rotación de Inventario"
                    value={metricasAnalytics.loading ? '...' : `${metricasAnalytics.rotacionInventario}x`}
                    subtitle="Veces por periodo"
                    icon={Activity}
                    variant="info"
                  />
                  <KPICard
                    title="Eficiencia del Almacén"
                    value={metricasAnalytics.loading ? '...' : `${metricasAnalytics.eficienciaAlmacen}%`}
                    icon={TrendingUp}
                    variant={metricasAnalytics.eficienciaAlmacen >= 70 ? 'success' : 'warning'}
                  />
                  <KPICard
                    title="Tiempo Promedio"
                    value={metricasAnalytics.loading ? '...' : `${almacen.tiempoPromedioAlmacenamiento || 0}d`}
                    subtitle="Días en almacén"
                    icon={Clock}
                  />
                  {almacen.esViajero && metricasAnalytics.cumplimientoViajes !== undefined && (
                    <KPICard
                      title="Cumplimiento Viajes"
                      value={`${metricasAnalytics.cumplimientoViajes.toFixed(1)}%`}
                      subtitle="Viajes a tiempo"
                      icon={CheckCircle}
                      variant={metricasAnalytics.cumplimientoViajes >= 80 ? 'success' : 'warning'}
                    />
                  )}
                </KPIGrid>

                {/* Evolución de Ocupación */}
                {metricasAnalytics.ocupacionHistorica.length > 0 && (
                  <Card title="Evolución de Ocupación" padding="md">
                    <SimpleAreaChart
                      data={metricasAnalytics.ocupacionHistorica}
                      dataKey="ocupacion"
                      xAxisKey="mes"
                      height={300}
                      color={CHART_COLORS.primary}
                    />
                  </Card>
                )}

                {/* Distribución de Capacidad */}
                {almacen.capacidadUnidades && almacen.capacidadUnidades > 0 && (
                  <StatDistribution
                    title="Distribución de Capacidad"
                    data={[
                      {
                        label: 'Ocupado',
                        value: almacen.unidadesActuales || 0,
                        color: 'bg-blue-500'
                      },
                      {
                        label: 'Disponible',
                        value: (almacen.capacidadUnidades || 0) - (almacen.unidadesActuales || 0),
                        color: 'bg-gray-300'
                      }
                    ]}
                    total={almacen.capacidadUnidades}
                  />
                )}

                {/* Métricas Operativas */}
                {almacen.metricasOperativas && (
                  <Card title="Métricas Operativas" padding="md">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-600">Transferencias Recibidas</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {almacen.metricasOperativas.transferenciasRecibidas || 0}
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-600">Transferencias Enviadas</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {almacen.metricasOperativas.transferenciasEnviadas || 0}
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-600">Productos Almacenados</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {almacen.metricasOperativas.productosAlmacenados || 0}
                        </div>
                      </div>
                      {almacen.metricasOperativas.tasaIncidencias !== undefined && (
                        <div className="p-4 bg-amber-50 rounded-lg">
                          <div className="text-xs text-amber-600">Tasa de Incidencias</div>
                          <div className="text-2xl font-bold text-amber-700">
                            {almacen.metricasOperativas.tasaIncidencias.toFixed(1)}%
                          </div>
                        </div>
                      )}
                      {almacen.esViajero && almacen.metricasOperativas.viajesRealizados !== undefined && (
                        <>
                          <div className="p-4 bg-teal-50 rounded-lg">
                            <div className="text-xs text-teal-600">Viajes Realizados</div>
                            <div className="text-2xl font-bold text-teal-700">
                              {almacen.metricasOperativas.viajesRealizados}
                            </div>
                          </div>
                          <div className="p-4 bg-green-50 rounded-lg">
                            <div className="text-xs text-green-600">Viajes a Tiempo</div>
                            <div className="text-2xl font-bold text-green-700">
                              {almacen.metricasOperativas.viajesATiempo || 0}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            </TabPanel>
          </TabsProvider>
        </div>
      </div>
    </div>
  );
};
