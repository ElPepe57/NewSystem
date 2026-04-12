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
  AlertCard,
  StatDistribution
} from '../../components/common';
import { KPIBar as DSKPIBar, StatCard as DSStatCard, DataTable } from '../../design-system';
import type { DataTableColumn } from '../../design-system';
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
        <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-teal-600" />
          Metricas Globales del Negocio
        </h3>
        <DSKPIBar columns={4}>
          <DSStatCard label="Total Entidades" value={clientes.length + marcas.length + proveedores.length + almacenes.length + competidores.length + transportistas.length + canales.length} icon={Boxes} variant="info" size="sm" />
          <DSStatCard label="Clientes Activos" value={clienteStats?.clientesActivos || 0} icon={Users} variant="success" size="sm" />
          <DSStatCard label="Proveedores" value={proveedores.filter(p => p.activo).length} icon={Truck} variant="success" size="sm" />
          <DSStatCard label="Inventario USA" value={almacenStats?.unidadesTotalesUSA?.toLocaleString() || '0'} icon={Package} variant="info" size="sm" />
        </DSKPIBar>
      </div>

      {/* Distribucion de Entidades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatDistribution
          title="Distribucion de Almacenes"
          data={[
            { label: 'Viajeros USA', value: almacenes.filter(a => a.esViajero && a.pais === 'USA').length, color: 'bg-sky-500' },
            { label: 'Fijos USA', value: almacenes.filter(a => !a.esViajero && a.pais === 'USA').length, color: 'bg-emerald-500' },
            { label: 'Peru', value: almacenes.filter(a => a.pais === 'Peru').length, color: 'bg-amber-500' }
          ]}
        />
        <StatDistribution
          title="Competidores por Nivel de Amenaza"
          data={[
            { label: 'Bajo', value: competidores.filter(c => c.nivelAmenaza === 'bajo').length, color: 'bg-emerald-500' },
            { label: 'Medio', value: competidores.filter(c => c.nivelAmenaza === 'medio').length, color: 'bg-yellow-500' },
            { label: 'Alto', value: competidores.filter(c => c.nivelAmenaza === 'alto').length, color: 'bg-red-500' }
          ]}
        />
        <StatDistribution
          title="Transportistas por Tipo"
          data={[
            { label: 'Internos', value: transportistas.filter((t: any) => t.tipo === 'interno').length, color: 'bg-sky-500' },
            { label: 'Externos', value: transportistas.filter((t: any) => t.tipo === 'externo').length, color: 'bg-purple-500' }
          ]}
        />
        <StatDistribution
          title="Canales de Venta"
          data={[
            { label: 'Activos', value: canales.filter((c: any) => c.estado === 'activo').length, color: 'bg-emerald-500' },
            { label: 'Inactivos', value: canales.filter((c: any) => c.estado === 'inactivo').length, color: 'bg-slate-400' }
          ]}
        />
      </div>

      {/* Alertas Criticas Consolidadas */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
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
              value: `${(a.capacidadUsada ?? 0).toFixed(0)}%`,
              sublabel: `${a.unidadesActuales ?? 0} de ${a.capacidadTotal ?? 0} unidades`
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
        <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
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
              value: `S/ ${(c.montoTotalPEN ?? 0).toLocaleString()}`,
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
              value: `S/ ${(m.ventasTotalPEN ?? 0).toLocaleString()}`,
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
        <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
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
            <Users className="h-6 w-6 text-teal-600" />
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
            <Tag className="h-6 w-6 text-emerald-600" />
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
            <RefreshCw className={`h-6 w-6 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-xs">Actualizar Todo</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={onRecalcularMetricas}
            disabled={isRecalculando}
          >
            <Calculator className={`h-6 w-6 text-sky-600 ${isRecalculando ? 'animate-pulse' : ''}`} />
            <span className="text-xs">Recalcular Metricas</span>
          </Button>
        </div>
      </div>

      {/* Resumen de Inventario por Almacen */}
      {almacenStats?.inventarioPorAlmacen && almacenStats.inventarioPorAlmacen.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-amber-600" />
            Estado de Inventario por Almacen
          </h3>
          <Card padding="md">
            {(() => {
              type AlmacenResumen = { id: string; nombre: string; esViajero: boolean; unidadesActuales: number; valorInventarioUSD: number; capacidadUsada: number };
              const inventarioColumns: DataTableColumn<AlmacenResumen>[] = [
                {
                  key: 'nombre',
                  header: 'Almacen',
                  render: a => <span className="font-medium text-slate-900">{a.nombre}</span>,
                },
                {
                  key: 'tipo',
                  header: 'Tipo',
                  render: a => (
                    <Badge variant={a.esViajero ? 'info' : 'default'} size="sm">
                      {a.esViajero ? 'Viajero' : 'Fijo'}
                    </Badge>
                  ),
                  hideOnMobile: true,
                },
                {
                  key: 'unidades',
                  header: 'Unidades',
                  align: 'right',
                  render: a => <span>{(a.unidadesActuales ?? 0).toLocaleString()}</span>,
                },
                {
                  key: 'valor',
                  header: 'Valor USD',
                  align: 'right',
                  render: a => <span>${(a.valorInventarioUSD ?? 0).toLocaleString()}</span>,
                  hideOnMobile: true,
                },
                {
                  key: 'capacidad',
                  header: 'Capacidad',
                  align: 'right',
                  render: a => {
                    const cap = a.capacidadUsada ?? 0;
                    return (
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            cap >= 90 ? 'bg-red-500' :
                            cap >= 70 ? 'bg-amber-500' :
                            'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(cap, 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${
                        cap >= 90 ? 'text-red-600' :
                        cap >= 70 ? 'text-amber-600' :
                        'text-emerald-600'
                      }`}>
                        {cap.toFixed(0)}%
                      </span>
                    </div>
                    );
                  },
                  hideOnMobile: true,
                },
              ];
              return (
                <DataTable
                  columns={inventarioColumns}
                  data={almacenStats.inventarioPorAlmacen.slice(0, 8) as AlmacenResumen[]}
                  keyExtractor={a => a.id}
                  compact
                />
              );
            })()}
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
