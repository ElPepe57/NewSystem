import React from 'react';
import {
  Users,
  Tag,
  Truck,
  RefreshCw,
  Package,
  DollarSign,
  Warehouse,
  Plane,
  Store,
  Crown,
  Shield,
  BarChart3,
  AlertTriangle,
  Zap,
  Boxes,
  Calculator
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  KPICard,
  KPIGrid,
  AlertCard,
  StatDistribution
} from '../../components/common';
import type { Cliente, Competidor } from '../../types/entidadesMaestras.types';
import type { Marca } from '../../types/entidadesMaestras.types';
import type { Proveedor } from '../../types/ordenCompra.types';
import type { Almacen } from '../../types/almacen.types';

interface TabResumenProps {
  clientes: Cliente[];
  marcas: Marca[];
  proveedores: Proveedor[];
  almacenes: Almacen[];
  competidores: Competidor[];
  transportistas: any[];
  canales: any[];
  clienteStats: any;
  marcaStats: any;
  proveedorStats: any;
  almacenStats: any;
  competidorStats: any;
  isRefreshing: boolean;
  isRecalculando: boolean;
  onSetTab: (tab: string) => void;
  onLoadAllData: () => void;
  onOpenClienteModal: () => void;
  onOpenMarcaModal: () => void;
  onOpenProveedorModal: () => void;
  onOpenAlmacenModal: () => void;
  onOpenCompetidorModal: () => void;
  onRecalcularMetricas: () => void;
}

export const TabResumen: React.FC<TabResumenProps> = ({
  clientes,
  marcas,
  proveedores,
  almacenes,
  competidores,
  transportistas,
  canales,
  clienteStats,
  marcaStats,
  proveedorStats,
  almacenStats,
  competidorStats,
  isRefreshing,
  isRecalculando,
  onSetTab,
  onLoadAllData,
  onOpenClienteModal,
  onOpenMarcaModal,
  onOpenProveedorModal,
  onOpenAlmacenModal,
  onOpenCompetidorModal,
  onRecalcularMetricas
}) => {
  return (
    <div className="space-y-6">
      {/* KPIs Globales del Negocio */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          Metricas Globales del Negocio
        </h3>
        <KPIGrid columns={5}>
          <KPICard
            title="Total Entidades"
            value={clientes.length + marcas.length + proveedores.length + almacenes.length + competidores.length + transportistas.length + canales.length}
            subtitle="en el sistema"
            icon={Boxes}
            variant="info"
            size="sm"
          />
          <KPICard
            title="Clientes Activos"
            value={clienteStats?.clientesActivos || 0}
            subtitle={`de ${clientes.length} totales`}
            icon={Users}
            variant="success"
            size="sm"
          />
          <KPICard
            title="Proveedores Activos"
            value={proveedores.filter(p => p.activo).length}
            subtitle={`de ${proveedores.length} totales`}
            icon={Truck}
            variant="success"
            size="sm"
          />
          <KPICard
            title="Inventario USA"
            value={almacenStats?.unidadesTotalesUSA?.toLocaleString() || '0'}
            subtitle={`$${(almacenStats?.valorInventarioUSA || 0).toLocaleString()} USD`}
            icon={Package}
            variant="info"
            size="sm"
          />
          <KPICard
            title="Ticket Promedio"
            value={`S/ ${clienteStats?.ticketPromedioGeneral?.toFixed(0) || 0}`}
            subtitle="por cliente"
            icon={DollarSign}
            variant="success"
            size="sm"
          />
          <KPICard
            title="Transportistas"
            value={transportistas.filter((t: any) => t.estado === 'activo').length}
            subtitle={`de ${transportistas.length} totales`}
            icon={Truck}
            variant="info"
            size="sm"
          />
          <KPICard
            title="Canales Venta"
            value={canales.filter((c: any) => c.estado === 'activo').length}
            subtitle={`de ${canales.length} totales`}
            icon={Store}
            variant="success"
            size="sm"
          />
        </KPIGrid>
      </div>

      {/* Distribucion de Entidades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatDistribution
          title="Distribucion de Almacenes"
          data={[
            { label: 'Viajeros USA', value: almacenes.filter(a => a.esViajero && a.pais === 'USA').length, color: 'bg-blue-500' },
            { label: 'Fijos USA', value: almacenes.filter(a => !a.esViajero && a.pais === 'USA').length, color: 'bg-green-500' },
            { label: 'Peru', value: almacenes.filter(a => a.pais === 'Peru').length, color: 'bg-amber-500' }
          ]}
        />
        <StatDistribution
          title="Competidores por Nivel de Amenaza"
          data={[
            { label: 'Bajo', value: competidores.filter(c => c.nivelAmenaza === 'bajo').length, color: 'bg-green-500' },
            { label: 'Medio', value: competidores.filter(c => c.nivelAmenaza === 'medio').length, color: 'bg-yellow-500' },
            { label: 'Alto', value: competidores.filter(c => c.nivelAmenaza === 'alto').length, color: 'bg-red-500' }
          ]}
        />
        <StatDistribution
          title="Transportistas por Tipo"
          data={[
            { label: 'Internos', value: transportistas.filter((t: any) => t.tipo === 'interno').length, color: 'bg-blue-500' },
            { label: 'Externos', value: transportistas.filter((t: any) => t.tipo === 'externo').length, color: 'bg-purple-500' }
          ]}
        />
        <StatDistribution
          title="Canales de Venta"
          data={[
            { label: 'Activos', value: canales.filter((c: any) => c.estado === 'activo').length, color: 'bg-green-500' },
            { label: 'Inactivos', value: canales.filter((c: any) => c.estado === 'inactivo').length, color: 'bg-gray-400' }
          ]}
        />
      </div>

      {/* Alertas Criticas Consolidadas */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Alertas y Puntos de Atencion
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AlertCard
            title="Almacenes Capacidad Critica"
            icon={Warehouse}
            variant="danger"
            emptyMessage="Sin almacenes en capacidad critica"
            items={(almacenStats?.almacenesCapacidadCritica || []).map((a: any) => ({
              id: a.id,
              label: a.nombre,
              value: `${a.capacidadUsada.toFixed(0)}%`,
              sublabel: `${a.unidadesActuales} de ${a.capacidadTotal} unidades`
            }))}
            maxItems={3}
            onItemClick={() => onSetTab('almacenes')}
          />
          <AlertCard
            title="Proximos Viajes"
            icon={Plane}
            variant="info"
            emptyMessage="Sin viajes programados"
            items={(almacenStats?.proximosViajes || []).slice(0, 3).map((v: any) => ({
              id: v.id,
              label: v.nombre,
              value: `${v.diasRestantes}d`,
              sublabel: `${v.unidadesActuales} unidades`
            }))}
            maxItems={3}
            onItemClick={() => onSetTab('almacenes')}
          />
          <AlertCard
            title="Competidores Alto Riesgo"
            icon={Shield}
            variant="warning"
            emptyMessage="Sin competidores de alto riesgo"
            items={(competidorStats?.competidoresAmenazaAlta || []).slice(0, 3).map((c: any) => ({
              id: c.id,
              label: c.nombre,
              value: `${c.productosAnalizados} prods`,
              sublabel: c.plataformaPrincipal.replace('_', ' ')
            }))}
            maxItems={3}
            onItemClick={() => onSetTab('competidores')}
          />
        </div>
      </div>

      {/* Top Performers */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-600" />
          Top Performers
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AlertCard
            title="Top Clientes por Ventas"
            icon={Users}
            variant="success"
            emptyMessage="Sin datos de ventas"
            items={(clienteStats?.topClientesPorMonto || []).slice(0, 4).map((c: any) => ({
              id: c.clienteId,
              label: c.nombre,
              value: `S/ ${c.montoTotalPEN.toLocaleString()}`,
              sublabel: `${c.montoTotalPEN > 0 ? 'Cliente activo' : ''}`
            }))}
            maxItems={4}
            onItemClick={() => onSetTab('clientes')}
          />
          <AlertCard
            title="Top Marcas por Productos"
            icon={Tag}
            variant="success"
            emptyMessage="Sin productos asociados"
            items={(marcaStats?.topMarcasPorVentas || []).slice(0, 4).map((m: { marcaId: string; nombre: string; ventasTotalPEN: number }) => ({
              id: m.marcaId,
              label: m.nombre,
              value: `S/ ${m.ventasTotalPEN.toLocaleString()}`,
              sublabel: 'Por ventas'
            }))}
            maxItems={4}
            onItemClick={() => onSetTab('marcas')}
          />
          <AlertCard
            title="Top Proveedores por Productos"
            icon={Truck}
            variant="success"
            emptyMessage="Sin productos asociados"
            items={(proveedorStats?.topProveedoresPorCompras || []).slice(0, 4).map((p: { proveedorId: string; nombre: string; ordenesCompra: number }) => ({
              id: p.proveedorId,
              label: p.nombre,
              value: `${p.ordenesCompra} ordenes`,
              sublabel: 'Por compras'
            }))}
            maxItems={4}
            onItemClick={() => onSetTab('proveedores')}
          />
        </div>
      </div>

      {/* Acciones Rapidas */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Zap className="h-5 w-5 text-purple-600" />
          Acciones Rapidas
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => {
              onSetTab('clientes');
              onOpenClienteModal();
            }}
          >
            <Users className="h-6 w-6 text-primary-600" />
            <span className="text-xs">Nuevo Cliente</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => {
              onSetTab('marcas');
              onOpenMarcaModal();
            }}
          >
            <Tag className="h-6 w-6 text-green-600" />
            <span className="text-xs">Nueva Marca</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => {
              onSetTab('proveedores');
              onOpenProveedorModal();
            }}
          >
            <Truck className="h-6 w-6 text-purple-600" />
            <span className="text-xs">Nuevo Proveedor</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => {
              onSetTab('almacenes');
              onOpenAlmacenModal();
            }}
          >
            <Warehouse className="h-6 w-6 text-amber-600" />
            <span className="text-xs">Nuevo Almacen</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => {
              onSetTab('competidores');
              onOpenCompetidorModal();
            }}
          >
            <Shield className="h-6 w-6 text-red-600" />
            <span className="text-xs">Nuevo Competidor</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={onLoadAllData}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-6 w-6 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-xs">Actualizar Todo</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={onRecalcularMetricas}
            disabled={isRecalculando}
          >
            <Calculator className={`h-6 w-6 text-blue-600 ${isRecalculando ? 'animate-pulse' : ''}`} />
            <span className="text-xs">Recalcular Metricas</span>
          </Button>
        </div>
      </div>

      {/* Resumen de Inventario por Almacen */}
      {almacenStats?.inventarioPorAlmacen && almacenStats.inventarioPorAlmacen.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-amber-600" />
            Estado de Inventario por Almacen
          </h3>
          <Card padding="md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Almacen</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unidades</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor USD</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Capacidad</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {almacenStats.inventarioPorAlmacen.slice(0, 8).map((a: any) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{a.nombre}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        <Badge variant={a.esViajero ? 'info' : 'default'} size="sm">
                          {a.esViajero ? 'Viajero' : 'Fijo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{a.unidadesActuales.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">${a.valorInventarioUSD.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                a.capacidadUsada >= 90 ? 'bg-red-500' :
                                a.capacidadUsada >= 70 ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(a.capacidadUsada, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${
                            a.capacidadUsada >= 90 ? 'text-red-600' :
                            a.capacidadUsada >= 70 ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {a.capacidadUsada.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {almacenStats.inventarioPorAlmacen.length > 8 && (
              <div className="mt-2 text-center">
                <Button variant="ghost" size="sm" onClick={() => onSetTab('almacenes')}>
                  Ver todos los almacenes ({almacenStats.inventarioPorAlmacen.length})
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
