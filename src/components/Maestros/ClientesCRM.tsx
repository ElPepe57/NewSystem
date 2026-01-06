import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Crown,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  ShoppingCart,
  DollarSign,
  Clock,
  Phone,
  Star,
  Award,
  UserCheck,
  UserX,
  UserMinus,
  Percent,
  BarChart3,
  PieChart,
  Zap,
  RefreshCw,
  ChevronRight,
  Building2,
  User,
  Mail,
  Edit2,
  Trash2,
  Eye,
  Plus,
  Filter,
  Search,
  MessageSquare,
  Package,
  RotateCcw,
  ExternalLink
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  KPICard,
  KPIGrid,
  AlertCard,
  StatDistribution,
  TabNavigation,
  Pagination,
  usePagination
} from '../common';
import { useClienteStore } from '../../store/clienteStore';
import { useAuthStore } from '../../store/authStore';
import { recompraService, type AlertaRecompra, type ResumenAlertasRecompra } from '../../services/recompra.service';
import { ClienteDetailView } from './ClienteDetailView';
import type { Cliente, ClasificacionABC, SegmentoCliente } from '../../types/entidadesMaestras.types';

// Sub-tabs dentro del módulo de clientes
type SubTabClientes = 'lista' | 'dashboard' | 'alertas';

interface ClientesCRMProps {
  onOpenClienteModal: (cliente?: Cliente) => void;
  onViewCliente: (cliente: Cliente) => void;
  onDeleteCliente: (id: string) => void;
  onEditCliente: (cliente: Cliente) => void;
}

export const ClientesCRM: React.FC<ClientesCRMProps> = ({
  onOpenClienteModal,
  onViewCliente,
  onDeleteCliente,
  onEditCliente
}) => {
  const user = useAuthStore(state => state.user);
  const [subTab, setSubTab] = useState<SubTabClientes>('lista');
  const [busqueda, setBusqueda] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [alertasRecompra, setAlertasRecompra] = useState<ResumenAlertasRecompra | null>(null);
  const [loadingRecompra, setLoadingRecompra] = useState(false);
  const [clienteDetalle, setClienteDetalle] = useState<Cliente | null>(null);

  const {
    clientes,
    stats: clienteStats,
    statsCRM,
    alertasCRM,
    loading,
    filtroClasificacion,
    filtroSegmento,
    filtroEstado,
    fetchClientes,
    fetchStats,
    fetchStatsCRM,
    fetchAlertasCRM,
    calcularClasificacionABC,
    recalcularSegmentos,
    setFiltroClasificacion,
    setFiltroSegmento,
    setFiltroEstado,
    getClientesFiltrados
  } = useClienteStore();

  // Auto-recalcular ABC si hay clientes con ventas pero sin clasificar
  useEffect(() => {
    const verificarYRecalcular = async () => {
      // Cargar stats CRM
      await fetchStatsCRM();
      await fetchAlertasCRM();

      // Verificar si hay clientes con ventas pero sin clasificar
      const clientesConVentasSinClasificar = clientes.filter(c =>
        c.metricas?.montoTotalPEN > 0 &&
        (!c.clasificacionABC || c.clasificacionABC === 'nuevo')
      );

      if (clientesConVentasSinClasificar.length > 0) {
        console.log(`[CRM] Detectados ${clientesConVentasSinClasificar.length} clientes con ventas sin clasificar. Ejecutando clasificación ABC automática...`);
        try {
          await calcularClasificacionABC();
          await recalcularSegmentos();
          await fetchAlertasCRM();
        } catch (error) {
          console.error('[CRM] Error en clasificación automática:', error);
        }
      }
    };

    if (clientes.length > 0) {
      verificarYRecalcular();
    }
  }, [clientes.length]);

  // Cargar alertas de recompra cuando se entra a la pestaña de alertas
  useEffect(() => {
    if (subTab === 'alertas' && !alertasRecompra && !loadingRecompra) {
      fetchAlertasRecompra();
    }
  }, [subTab]);

  const fetchAlertasRecompra = async () => {
    setLoadingRecompra(true);
    try {
      const alertas = await recompraService.getAlertasRecompra();
      setAlertasRecompra(alertas);
    } catch (error) {
      console.error('[CRM] Error cargando alertas de recompra:', error);
    } finally {
      setLoadingRecompra(false);
    }
  };

  // Filtrar clientes por búsqueda y filtros activos
  const clientesFiltrados = getClientesFiltrados().filter(c => {
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    return (
      c.nombre.toLowerCase().includes(term) ||
      c.telefono?.includes(term) ||
      c.dniRuc?.includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.codigo?.toLowerCase().includes(term)
    );
  });

  // Paginación
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    setPage,
    setItemsPerPage,
    paginatedItems: clientesPaginados
  } = usePagination({
    items: clientesFiltrados,
    initialItemsPerPage: 25
  });

  // Helpers de UI
  const getClasificacionColor = (clasificacion?: ClasificacionABC) => {
    switch (clasificacion) {
      case 'A': return 'bg-green-100 text-green-700 border-green-300';
      case 'B': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'C': return 'bg-amber-100 text-amber-700 border-amber-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getSegmentoConfig = (segmento?: SegmentoCliente) => {
    const configs: Record<SegmentoCliente, { color: string; icon: React.ReactNode; label: string }> = {
      vip: { color: 'bg-purple-100 text-purple-700', icon: <Crown className="h-3 w-3" />, label: 'VIP' },
      premium: { color: 'bg-indigo-100 text-indigo-700', icon: <Star className="h-3 w-3" />, label: 'Premium' },
      frecuente: { color: 'bg-blue-100 text-blue-700', icon: <TrendingUp className="h-3 w-3" />, label: 'Frecuente' },
      regular: { color: 'bg-cyan-100 text-cyan-700', icon: <UserCheck className="h-3 w-3" />, label: 'Regular' },
      ocasional: { color: 'bg-gray-100 text-gray-700', icon: <Clock className="h-3 w-3" />, label: 'Ocasional' },
      nuevo: { color: 'bg-emerald-100 text-emerald-700', icon: <Plus className="h-3 w-3" />, label: 'Nuevo' },
      inactivo: { color: 'bg-amber-100 text-amber-700', icon: <UserMinus className="h-3 w-3" />, label: 'Inactivo' },
      en_riesgo: { color: 'bg-orange-100 text-orange-700', icon: <AlertTriangle className="h-3 w-3" />, label: 'En Riesgo' },
      perdido: { color: 'bg-red-100 text-red-700', icon: <UserX className="h-3 w-3" />, label: 'Perdido' }
    };
    return configs[segmento || 'nuevo'];
  };

  const getEstadoColor = (estado: string): 'success' | 'default' | 'warning' => {
    switch (estado) {
      case 'activo': return 'success';
      case 'potencial': return 'warning';
      default: return 'default';
    }
  };

  const handleRecalcularCRM = async () => {
    if (!confirm('¿Recalcular clasificación ABC y segmentos de todos los clientes?')) return;
    setIsCalculating(true);
    try {
      await calcularClasificacionABC();
      await recalcularSegmentos();
      await fetchAlertasCRM();
      alert('Clasificación ABC y segmentos actualizados correctamente');
    } catch (error) {
      console.error('Error recalculando:', error);
      alert('Error al recalcular. Ver consola.');
    } finally {
      setIsCalculating(false);
    }
  };

  const diasDesdeUltimaCompra = (cliente: Cliente) => {
    if (!cliente.metricas?.ultimaCompra) return null;
    const ultima = cliente.metricas.ultimaCompra.toDate?.() || new Date(cliente.metricas.ultimaCompra as unknown as string);
    return Math.floor((Date.now() - ultima.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Total de alertas incluyendo recompra
  const totalAlertas = (alertasCRM?.total || 0) + (alertasRecompra?.totalAlertas || 0);

  // Sub-tabs
  const subTabs = [
    { id: 'lista', label: 'Lista', icon: Users, count: clientes.length },
    { id: 'dashboard', label: 'Dashboard CRM', icon: BarChart3 },
    { id: 'alertas', label: 'Alertas', icon: AlertTriangle, count: totalAlertas }
  ];

  return (
    <div className="space-y-4">
      {/* Sub-navegación */}
      <div className="flex items-center justify-between">
        <TabNavigation
          tabs={subTabs}
          activeTab={subTab}
          onTabChange={(id) => setSubTab(id as SubTabClientes)}
          variant="pills"
        />
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRecalcularCRM}
            disabled={isCalculating}
          >
            <Zap className={`h-4 w-4 mr-1 ${isCalculating ? 'animate-pulse' : ''}`} />
            {isCalculating ? 'Calculando...' : 'Recalcular CRM'}
          </Button>
          <Button variant="primary" size="sm" onClick={() => onOpenClienteModal()}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* ============ SUB-TAB: DASHBOARD CRM ============ */}
      {subTab === 'dashboard' && statsCRM && (
        <div className="space-y-6">
          {/* KPIs principales */}
          <KPIGrid columns={5}>
            <KPICard
              title="Total Clientes"
              value={clientes.length}
              icon={Users}
              variant="info"
              size="sm"
            />
            <KPICard
              title="Tasa Retención"
              value={`${statsCRM.tasaRetencion.toFixed(0)}%`}
              subtitle="últimos 90 días"
              icon={Target}
              variant={statsCRM.tasaRetencion >= 70 ? 'success' : statsCRM.tasaRetencion >= 50 ? 'warning' : 'danger'}
              size="sm"
            />
            <KPICard
              title="Nuevos (7 días)"
              value={statsCRM.clientesNuevosUltimos7Dias}
              icon={TrendingUp}
              variant="success"
              size="sm"
            />
            <KPICard
              title="Nuevos (30 días)"
              value={statsCRM.clientesNuevosUltimos30Dias}
              icon={TrendingUp}
              variant="info"
              size="sm"
            />
            <KPICard
              title="En Riesgo"
              value={statsCRM.clientesEnRiesgo.length + statsCRM.clientesPerdidos.length}
              icon={AlertTriangle}
              variant={statsCRM.clientesEnRiesgo.length > 0 ? 'warning' : 'default'}
              size="sm"
            />
          </KPIGrid>

          {/* Pirámide ABC y Segmentos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Clasificación ABC */}
            <Card padding="lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <PieChart className="h-5 w-5 text-indigo-600" />
                Clasificación ABC (Pareto)
              </h3>
              <div className="space-y-4">
                {statsCRM.distribucionABC.filter(d => d.clase !== 'nuevo').map(item => {
                  const valorTotal = statsCRM.distribucionABC.reduce((s, i) => s + i.valorTotal, 0);
                  const porcentajeValor = valorTotal > 0 ? (item.valorTotal / valorTotal) * 100 : 0;
                  return (
                    <div key={item.clase} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 text-sm font-bold rounded ${getClasificacionColor(item.clase)}`}>
                            Clase {item.clase}
                          </span>
                          <span className="text-sm text-gray-600">
                            {item.cantidad} clientes ({item.porcentaje.toFixed(0)}%)
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          S/ {item.valorTotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            item.clase === 'A' ? 'bg-green-500' :
                            item.clase === 'B' ? 'bg-blue-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${porcentajeValor}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 text-right">
                        {porcentajeValor.toFixed(1)}% del valor total
                      </p>
                    </div>
                  );
                })}
                {/* Clientes nuevos */}
                {statsCRM.distribucionABC.find(d => d.clase === 'nuevo')?.cantidad ? (
                  <div className="pt-3 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Sin clasificar (nuevos)</span>
                      <span className="font-medium">
                        {statsCRM.distribucionABC.find(d => d.clase === 'nuevo')?.cantidad || 0}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>

            {/* Distribución por Segmentos */}
            <Card padding="lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                Segmentación de Clientes
              </h3>
              <div className="space-y-3">
                {statsCRM.distribucionSegmentos.map(item => {
                  const config = getSegmentoConfig(item.segmento);
                  return (
                    <div key={item.segmento} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${config.color}`}>
                          {config.icon}
                          {config.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${item.porcentaje}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-700 w-16 text-right">
                          {item.cantidad} ({item.porcentaje.toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Top Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <AlertCard
              title="Top Clase A"
              icon={Crown}
              variant="success"
              emptyMessage="Sin clientes Clase A aún"
              items={statsCRM.topVIP.map(c => ({
                id: c.id,
                label: c.nombre,
                value: `S/ ${c.metricas.montoTotalPEN.toLocaleString()}`,
                sublabel: `${c.metricas.totalCompras} compras`
              }))}
              maxItems={5}
              onItemClick={(id) => {
                const cliente = clientes.find(c => c.id === id);
                if (cliente) onViewCliente(cliente);
              }}
            />
            <AlertCard
              title="Top Clase B"
              icon={Star}
              variant="info"
              emptyMessage="Sin clientes Clase B aún"
              items={statsCRM.topPremium.map(c => ({
                id: c.id,
                label: c.nombre,
                value: `S/ ${c.metricas.montoTotalPEN.toLocaleString()}`,
                sublabel: `${c.metricas.totalCompras} compras`
              }))}
              maxItems={5}
              onItemClick={(id) => {
                const cliente = clientes.find(c => c.id === id);
                if (cliente) onViewCliente(cliente);
              }}
            />
            <AlertCard
              title="Mayor Crecimiento"
              icon={TrendingUp}
              variant="success"
              emptyMessage="Sin datos de crecimiento"
              items={statsCRM.clientesMayorCrecimiento.map(c => ({
                id: c.id,
                label: c.nombre,
                value: `${c.metricas.comprasUltimos30Dias || 0} compras`,
                sublabel: 'últimos 30 días'
              }))}
              maxItems={5}
              onItemClick={(id) => {
                const cliente = clientes.find(c => c.id === id);
                if (cliente) onViewCliente(cliente);
              }}
            />
          </div>
        </div>
      )}

      {/* ============ SUB-TAB: ALERTAS ============ */}
      {subTab === 'alertas' && statsCRM && (
        <div className="space-y-6">
          {/* Resumen de alertas */}
          <KPIGrid columns={5}>
            <KPICard
              title="Recompras"
              value={alertasRecompra?.totalAlertas || 0}
              subtitle="productos por reponer"
              icon={RotateCcw}
              variant={(alertasRecompra?.alertasUrgentes?.length || 0) > 0 ? 'danger' : (alertasRecompra?.totalAlertas || 0) > 0 ? 'warning' : 'default'}
              size="sm"
            />
            <KPICard
              title="En Riesgo"
              value={statsCRM.clientesEnRiesgo.length}
              subtitle="requieren atención"
              icon={AlertTriangle}
              variant={statsCRM.clientesEnRiesgo.length > 0 ? 'warning' : 'default'}
              size="sm"
            />
            <KPICard
              title="Perdidos"
              value={statsCRM.clientesPerdidos.length}
              subtitle=">180 días sin comprar"
              icon={UserX}
              variant={statsCRM.clientesPerdidos.length > 0 ? 'danger' : 'default'}
              size="sm"
            />
            <KPICard
              title="VIPs Inactivos"
              value={statsCRM.clientesVIPInactivos.length}
              subtitle=">15 días sin comprar"
              icon={Crown}
              variant={statsCRM.clientesVIPInactivos.length > 0 ? 'warning' : 'default'}
              size="sm"
            />
            <KPICard
              title="Sin Contacto"
              value={statsCRM.clientesSinContacto30Dias.length}
              subtitle=">30 días"
              icon={Phone}
              variant="info"
              size="sm"
            />
          </KPIGrid>

          {/* ====== ALERTAS DE RECOMPRA ====== */}
          <Card padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-purple-500" />
                Alertas de Recompra
                {(alertasRecompra?.totalAlertas || 0) > 0 && (
                  <Badge variant="warning">{alertasRecompra?.totalAlertas}</Badge>
                )}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchAlertasRecompra}
                disabled={loadingRecompra}
              >
                <RefreshCw className={`h-4 w-4 ${loadingRecompra ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {loadingRecompra ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                <span className="ml-2 text-gray-500">Analizando historial de compras...</span>
              </div>
            ) : !alertasRecompra || alertasRecompra.totalAlertas === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No hay alertas de recompra</p>
                <p className="text-sm text-gray-400 mt-1">
                  Configura el "Ciclo de Recompra" en tus productos para activar estas alertas
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Alertas urgentes (ya pasó el ciclo) */}
                {alertasRecompra.alertasUrgentes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      Urgentes - Ya pasó el ciclo ({alertasRecompra.alertasUrgentes.length})
                    </h4>
                    <div className="space-y-2">
                      {alertasRecompra.alertasUrgentes.slice(0, 5).map(alerta => (
                        <div
                          key={alerta.id}
                          className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                              <Package className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{alerta.clienteNombre}</p>
                              <p className="text-sm text-gray-600">{alerta.productoNombre}</p>
                              <p className="text-xs text-red-600">
                                Compró hace {alerta.diasDesdeCompra} días (ciclo: {alerta.cicloRecompraDias}d)
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {alerta.clienteTelefono && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const url = recompraService.getWhatsAppUrl(alerta);
                                  if (url) window.open(url, '_blank');
                                }}
                                title="Enviar WhatsApp"
                              >
                                <MessageSquare className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const cliente = clientes.find(c => c.id === alerta.clienteId);
                                if (cliente) onViewCliente(cliente);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alertas próximas (7 días) */}
                {alertasRecompra.alertasProximas.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Próximos 7 días ({alertasRecompra.alertasProximas.length})
                    </h4>
                    <div className="space-y-2">
                      {alertasRecompra.alertasProximas.slice(0, 5).map(alerta => (
                        <div
                          key={alerta.id}
                          className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
                              <Package className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{alerta.clienteNombre}</p>
                              <p className="text-sm text-gray-600">{alerta.productoNombre}</p>
                              <p className="text-xs text-amber-600">
                                Recompra estimada en {alerta.diasRestantes} días
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {alerta.clienteTelefono && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const url = recompraService.getWhatsAppUrl(alerta);
                                  if (url) window.open(url, '_blank');
                                }}
                                title="Enviar WhatsApp"
                              >
                                <MessageSquare className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const cliente = clientes.find(c => c.id === alerta.clienteId);
                                if (cliente) onViewCliente(cliente);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alertas futuras (8-30 días) */}
                {alertasRecompra.alertasFuturas.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-blue-700 mb-2 flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      Próximas semanas ({alertasRecompra.alertasFuturas.length})
                    </h4>
                    <div className="space-y-2">
                      {alertasRecompra.alertasFuturas.slice(0, 3).map(alerta => (
                        <div
                          key={alerta.id}
                          className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <Package className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{alerta.clienteNombre}</p>
                              <p className="text-sm text-gray-600">{alerta.productoNombre}</p>
                              <p className="text-xs text-blue-600">
                                Recompra estimada en {alerta.diasRestantes} días
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const cliente = clientes.find(c => c.id === alerta.clienteId);
                              if (cliente) onViewCliente(cliente);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resumen */}
                <div className="pt-3 border-t text-sm text-gray-500 flex items-center justify-between">
                  <span>
                    {alertasRecompra.clientesAfectados} clientes · {alertasRecompra.productosAfectados} productos
                  </span>
                  <span className="text-xs">
                    Configura ciclos de recompra en cada producto
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* Listas de alertas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Clientes en riesgo */}
            <Card padding="lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Clientes en Riesgo
                {statsCRM.clientesEnRiesgo.length > 0 && (
                  <Badge variant="warning">{statsCRM.clientesEnRiesgo.length}</Badge>
                )}
              </h3>
              {statsCRM.clientesEnRiesgo.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Sin clientes en riesgo</p>
              ) : (
                <div className="space-y-3">
                  {statsCRM.clientesEnRiesgo.map(cliente => {
                    const dias = diasDesdeUltimaCompra(cliente);
                    return (
                      <div
                        key={cliente.id}
                        className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100 hover:bg-orange-100 cursor-pointer transition-colors"
                        onClick={() => onViewCliente(cliente)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{cliente.nombre}</p>
                            <p className="text-sm text-gray-500">
                              {dias !== null ? `${dias} días sin comprar` : 'Sin compras'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-orange-700">
                            S/ {cliente.metricas.montoTotalPEN.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {cliente.metricas.totalCompras} compras
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Clientes perdidos */}
            <Card padding="lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UserX className="h-5 w-5 text-red-500" />
                Clientes Perdidos (a recuperar)
                {statsCRM.clientesPerdidos.length > 0 && (
                  <Badge variant="danger">{statsCRM.clientesPerdidos.length}</Badge>
                )}
              </h3>
              {statsCRM.clientesPerdidos.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Sin clientes perdidos</p>
              ) : (
                <div className="space-y-3">
                  {statsCRM.clientesPerdidos.map(cliente => {
                    const dias = diasDesdeUltimaCompra(cliente);
                    return (
                      <div
                        key={cliente.id}
                        className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 cursor-pointer transition-colors"
                        onClick={() => onViewCliente(cliente)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{cliente.nombre}</p>
                            <p className="text-sm text-gray-500">
                              {dias !== null ? `${dias} días sin comprar` : 'Sin compras'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-red-700">
                            S/ {cliente.metricas.montoTotalPEN.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {cliente.metricas.totalCompras} compras
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* VIPs inactivos */}
            <Card padding="lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                VIPs Inactivos
                {statsCRM.clientesVIPInactivos.length > 0 && (
                  <Badge variant="warning">{statsCRM.clientesVIPInactivos.length}</Badge>
                )}
              </h3>
              {statsCRM.clientesVIPInactivos.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Todos los VIPs están activos</p>
              ) : (
                <div className="space-y-3">
                  {statsCRM.clientesVIPInactivos.map(cliente => {
                    const dias = diasDesdeUltimaCompra(cliente);
                    return (
                      <div
                        key={cliente.id}
                        className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100 hover:bg-amber-100 cursor-pointer transition-colors"
                        onClick={() => onViewCliente(cliente)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
                            <Crown className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{cliente.nombre}</p>
                            <p className="text-sm text-gray-500">
                              Clase A - {dias} días sin comprar
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-amber-700">
                            S/ {cliente.metricas.montoTotalPEN.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Sin contacto */}
            <Card padding="lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Phone className="h-5 w-5 text-blue-500" />
                Sin Contacto (30+ días)
                {statsCRM.clientesSinContacto30Dias.length > 0 && (
                  <Badge variant="info">{statsCRM.clientesSinContacto30Dias.length}</Badge>
                )}
              </h3>
              {statsCRM.clientesSinContacto30Dias.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Todos contactados recientemente</p>
              ) : (
                <div className="space-y-3">
                  {statsCRM.clientesSinContacto30Dias.map(cliente => {
                    const dias = diasDesdeUltimaCompra(cliente);
                    return (
                      <div
                        key={cliente.id}
                        className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 cursor-pointer transition-colors"
                        onClick={() => onViewCliente(cliente)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{cliente.nombre}</p>
                            <p className="text-sm text-gray-500">
                              {dias} días - {cliente.telefono || 'Sin teléfono'}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (cliente.telefono) {
                              window.open(`https://wa.me/51${cliente.telefono.replace(/\D/g, '')}`, '_blank');
                            }
                          }}
                        >
                          <MessageSquare className="h-4 w-4 text-green-600" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ============ SUB-TAB: LISTA ============ */}
      {subTab === 'lista' && (
        <div className="space-y-4">
          {/* KPIs rápidos */}
          {clienteStats && (
            <KPIGrid columns={4}>
              <KPICard
                title="Ticket Promedio"
                value={`S/ ${clienteStats.ticketPromedioGeneral?.toFixed(0) || 0}`}
                icon={DollarSign}
                variant="success"
                size="sm"
              />
              <KPICard
                title="Clientes Activos"
                value={clienteStats.clientesActivos || 0}
                icon={Users}
                variant="info"
                size="sm"
              />
              <KPICard
                title="Nuevos Este Mes"
                value={clienteStats.clientesNuevosMes || 0}
                icon={TrendingUp}
                variant="success"
                size="sm"
              />
              <KPICard
                title="Con Compras"
                value={clienteStats.clientesConCompras || 0}
                subtitle={`${((clienteStats.clientesConCompras || 0) / (clienteStats.totalClientes || 1) * 100).toFixed(0)}%`}
                icon={ShoppingCart}
                variant="default"
                size="sm"
              />
            </KPIGrid>
          )}

          {/* Filtros */}
          <Card padding="md">
            <div className="flex flex-wrap items-center gap-4">
              {/* Búsqueda */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, teléfono, DNI..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Filtro por clasificación */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={filtroClasificacion}
                  onChange={(e) => setFiltroClasificacion(e.target.value as ClasificacionABC | 'todos')}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todos">Todas las clases</option>
                  <option value="A">Clase A (VIP)</option>
                  <option value="B">Clase B</option>
                  <option value="C">Clase C</option>
                  <option value="nuevo">Sin clasificar</option>
                </select>
              </div>

              {/* Filtro por segmento */}
              <select
                value={filtroSegmento}
                onChange={(e) => setFiltroSegmento(e.target.value as SegmentoCliente | 'todos')}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos los segmentos</option>
                <option value="vip">VIP</option>
                <option value="premium">Premium</option>
                <option value="frecuente">Frecuente</option>
                <option value="regular">Regular</option>
                <option value="ocasional">Ocasional</option>
                <option value="nuevo">Nuevo</option>
                <option value="inactivo">Inactivo</option>
                <option value="en_riesgo">En Riesgo</option>
                <option value="perdido">Perdido</option>
              </select>

              {/* Filtro por estado */}
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as 'activo' | 'inactivo' | 'potencial' | 'todos')}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="potencial">Potencial</option>
                <option value="inactivo">Inactivo</option>
              </select>

              {/* Contador de resultados */}
              <span className="text-sm text-gray-500">
                {clientesFiltrados.length} de {clientes.length}
              </span>
            </div>
          </Card>

          {/* Lista de clientes */}
          <Card padding="none">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Clientes ({clientesFiltrados.length})
              </h3>
            </div>

            {clientesFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No hay clientes que coincidan con los filtros</p>
                <Button
                  variant="primary"
                  onClick={() => onOpenClienteModal()}
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Cliente
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {clientesPaginados.map((cliente) => {
                  const segmentoConfig = getSegmentoConfig(cliente.segmento);
                  const dias = diasDesdeUltimaCompra(cliente);

                  return (
                    <div
                      key={cliente.id}
                      className="px-6 py-4 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center relative">
                          {cliente.tipoCliente === 'empresa' ? (
                            <Building2 className="h-6 w-6 text-blue-600" />
                          ) : (
                            <User className="h-6 w-6 text-blue-600" />
                          )}
                          {/* Badge de clasificación */}
                          {cliente.clasificacionABC && cliente.clasificacionABC !== 'nuevo' && (
                            <span className={`absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs font-bold rounded-full ${getClasificacionColor(cliente.clasificacionABC)}`}>
                              {cliente.clasificacionABC}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                              {cliente.codigo}
                            </span>
                            <span className="font-medium text-gray-900">{cliente.nombre}</span>
                            <Badge variant={getEstadoColor(cliente.estado)}>
                              {cliente.estado}
                            </Badge>
                            {/* Badge de segmento */}
                            <span className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${segmentoConfig.color}`}>
                              {segmentoConfig.icon}
                              {segmentoConfig.label}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                            {cliente.telefono && (
                              <span className="flex items-center">
                                <Phone className="h-3 w-3 mr-1" />
                                {cliente.telefono}
                              </span>
                            )}
                            {cliente.email && (
                              <span className="flex items-center">
                                <Mail className="h-3 w-3 mr-1" />
                                {cliente.email}
                              </span>
                            )}
                            {dias !== null && (
                              <span className={`flex items-center ${dias > 60 ? 'text-amber-600' : ''}`}>
                                <Clock className="h-3 w-3 mr-1" />
                                {dias === 0 ? 'Hoy' : `Hace ${dias}d`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {cliente.metricas.totalCompras} compras
                          </div>
                          <div className="text-sm text-green-600 font-medium">
                            S/ {cliente.metricas.montoTotalPEN.toLocaleString()}
                          </div>
                        </div>

                        <div className="flex space-x-1">
                          <button
                            onClick={() => setClienteDetalle(cliente)}
                            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                            title="Ver analytics detallado"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onViewCliente(cliente)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onEditCliente(cliente)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onDeleteCliente(cliente.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Paginación */}
            {clientesFiltrados.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={clientesFiltrados.length}
                pageSize={itemsPerPage}
                onPageChange={setPage}
                onPageSizeChange={setItemsPerPage}
              />
            )}
          </Card>
        </div>
      )}

      {/* Modal de detalle de cliente con analytics */}
      {clienteDetalle && (
        <ClienteDetailView
          cliente={clienteDetalle}
          onClose={() => setClienteDetalle(null)}
          onEdit={() => {
            setClienteDetalle(null);
            onEditCliente(clienteDetalle);
          }}
        />
      )}
    </div>
  );
};
