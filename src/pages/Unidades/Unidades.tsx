import React, { useEffect, useState, useMemo } from 'react';
import { Package, AlertTriangle, CheckCircle, Clock, DollarSign, RefreshCw, Bookmark } from 'lucide-react';
import { Card, Badge, Select, Button } from '../../components/common';
import { useUnidadStore } from '../../store/unidadStore';
import { useProductoStore } from '../../store/productoStore';
import { useAlmacenStore } from '../../store/almacenStore';
import { useToastStore } from '../../store/toastStore';
import { unidadService } from '../../services/unidad.service';
import type { Unidad, EstadoUnidad } from '../../types/unidad.types';

export const Unidades: React.FC = () => {
  const { unidades, stats, loading, fetchUnidades, fetchStats } = useUnidadStore();
  const { productos, fetchProductos } = useProductoStore();
  const { almacenes, fetchAlmacenes } = useAlmacenStore();
  const { addToast } = useToastStore();

  const [filtros, setFiltros] = useState({
    productoId: '',
    almacenId: '',
    estado: '' as EstadoUnidad | '',
    pais: '' as 'USA' | 'Peru' | ''
  });
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => {
    fetchUnidades();
    fetchStats();
    fetchProductos();
    fetchAlmacenes();
  }, [fetchUnidades, fetchStats, fetchProductos, fetchAlmacenes]);

  // Aplicar filtros
  const unidadesFiltradas = useMemo(() => {
    return unidades.filter(unidad => {
      if (filtros.productoId && unidad.productoId !== filtros.productoId) return false;
      if (filtros.almacenId && unidad.almacenId !== filtros.almacenId) return false;
      if (filtros.estado && unidad.estado !== filtros.estado) return false;
      if (filtros.pais && unidad.pais !== filtros.pais) return false;
      return true;
    });
  }, [unidades, filtros]);

  const limpiarFiltros = () => {
    setFiltros({
      productoId: '',
      almacenId: '',
      estado: '',
      pais: ''
    });
  };

  // Sincronizar unidades huérfanas (sin venta válida)
  const handleSincronizar = async () => {
    setSincronizando(true);
    try {
      const resultado = await unidadService.sincronizarUnidadesHuerfanas();

      if (resultado.unidadesSincronizadas > 0) {
        addToast('success', `Se sincronizaron ${resultado.unidadesSincronizadas} unidades huérfanas`, 5000);
        // Recargar datos
        fetchUnidades();
        fetchStats();
      } else {
        addToast('success', 'No hay unidades huérfanas para sincronizar');
      }

      // Log detalle para debugging
      if (resultado.detalle.length > 0) {
        console.log('[Sincronización] Detalle:', resultado.detalle);
      }
    } catch (error: any) {
      console.error('Error sincronizando:', error);
      addToast('error', `Error al sincronizar: ${error.message}`);
    } finally {
      setSincronizando(false);
    }
  };

  // Función para obtener el badge de estado
  const getEstadoBadge = (estado: EstadoUnidad | string) => {
    const badges: Record<string, { variant: 'success' | 'info' | 'warning' | 'default' | 'danger'; label: string }> = {
      // Estados en USA
      'recibida_usa': { variant: 'success', label: 'Recibida USA' },
      'en_transito_usa': { variant: 'info', label: 'En Tránsito USA' },
      // Estados en tránsito a Perú
      'en_transito_peru': { variant: 'info', label: 'En Tránsito → Perú' },
      // Estados en Perú
      'disponible_peru': { variant: 'success', label: 'Disponible Perú' },
      'reservada': { variant: 'warning', label: 'Reservada' },
      'vendida': { variant: 'default', label: 'Vendida' },
      // Estados especiales
      'vencida': { variant: 'danger', label: 'Vencida' },
      'danada': { variant: 'danger', label: 'Dañada' },
      // Estados legacy (para mostrar mientras no se sincronicen)
      'entregada': { variant: 'warning', label: 'Entregada (sync)' },
      'asignada_pedido': { variant: 'warning', label: 'Asignada (sync)' }
    };
    return badges[estado] || { variant: 'default' as const, label: estado || 'Desconocido' };
  };

  // Función para calcular días para vencer
  const calcularDiasParaVencer = (unidad: Unidad): number => {
    if (!unidad?.fechaVencimiento) {
      return 0;
    }
    return unidadService.calcularDiasParaVencer(unidad.fechaVencimiento);
  };

  // Función para obtener color según días para vencer
  const getColorVencimiento = (dias: number): string => {
    if (dias < 0) return 'text-danger-600';
    if (dias <= 30) return 'text-warning-600';
    if (dias <= 90) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const formatFecha = (timestamp: any): string => {
    if (!timestamp || !timestamp.toDate) {
      return '-';
    }
    return timestamp.toDate().toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Unidades</h1>
          <p className="text-gray-600 mt-1">
            Trazabilidad completa de productos individuales (FEFO - First Expired, First Out)
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleSincronizar}
          disabled={sincronizando}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${sincronizando ? 'animate-spin' : ''}`} />
          {sincronizando ? 'Sincronizando...' : 'Sincronizar'}
        </Button>
      </div>

      {/* Métricas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Total Unidades</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.totalUnidades.toLocaleString()}
                </div>
              </div>
              <Package className="h-8 w-8 text-gray-400" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Disponibles</div>
                <div className="text-2xl font-bold text-success-600 mt-1">
                  {stats.disponibles.toLocaleString()}
                </div>
              </div>
              <CheckCircle className="h-8 w-8 text-success-400" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Reservadas</div>
                <div className="text-2xl font-bold text-warning-600 mt-1">
                  {stats.reservadas.toLocaleString()}
                </div>
              </div>
              <Bookmark className="h-8 w-8 text-warning-400" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Por Vencer</div>
                <div className="text-2xl font-bold text-orange-600 mt-1">
                  {stats.porVencer}
                </div>
                <div className="text-xs text-gray-500">Próx. 30 días</div>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-400" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">En Tránsito</div>
                <div className="text-2xl font-bold text-blue-600 mt-1">
                  {stats.enTransito}
                </div>
              </div>
              <Clock className="h-8 w-8 text-blue-400" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Valor Total</div>
                <div className="text-2xl font-bold text-primary-600 mt-1">
                  {formatCurrency(stats.valorTotalUSD)}
                </div>
                <div className="text-xs text-gray-500">
                  {(stats.disponibles + stats.reservadas + stats.enTransito).toLocaleString()} activas
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-primary-400" />
            </div>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card padding="md">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              label="Producto"
              value={filtros.productoId}
              onChange={(e) => setFiltros({ ...filtros, productoId: e.target.value })}
              options={[
                { value: '', label: 'Todos los productos' },
                ...productos.map(p => ({
                  value: p.id,
                  label: `${p.sku} - ${p.nombreComercial}`
                }))
              ]}
            />

            <Select
              label="Almacén"
              value={filtros.almacenId}
              onChange={(e) => setFiltros({ ...filtros, almacenId: e.target.value })}
              options={[
                { value: '', label: 'Todos los almacenes' },
                ...almacenes.map(a => ({
                  value: a.id,
                  label: a.nombre
                }))
              ]}
            />

            <Select
              label="Estado"
              value={filtros.estado}
              onChange={(e) => setFiltros({ ...filtros, estado: e.target.value as EstadoUnidad | '' })}
              options={[
                { value: '', label: 'Todos los estados' },
                { value: 'recibida_usa', label: 'Recibida USA' },
                { value: 'en_transito_usa', label: 'En Tránsito USA' },
                { value: 'en_transito_peru', label: 'En Tránsito → Perú' },
                { value: 'disponible_peru', label: 'Disponible Perú' },
                { value: 'reservada', label: 'Reservada' },
                { value: 'vendida', label: 'Vendida' },
                { value: 'vencida', label: 'Vencida' },
                { value: 'danada', label: 'Dañada' }
              ]}
            />

            <Select
              label="País"
              value={filtros.pais}
              onChange={(e) => setFiltros({ ...filtros, pais: e.target.value as 'USA' | 'Peru' | '' })}
              options={[
                { value: '', label: 'Todos los países' },
                { value: 'USA', label: '🇺🇸 USA' },
                { value: 'Peru', label: '🇵🇪 Perú' }
              ]}
            />
          </div>
          {(filtros.productoId || filtros.almacenId || filtros.estado || filtros.pais) && (
            <button
              onClick={limpiarFiltros}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </Card>

      {/* Tabla de Unidades */}
      <Card padding="md">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : unidadesFiltradas.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay unidades</h3>
            <p className="mt-1 text-sm text-gray-500">
              Las unidades se crean automáticamente al recibir órdenes de compra
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Lote
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Vencimiento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Almacén
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Costo USD
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {unidadesFiltradas.map((unidad) => {
                  if (!unidad || !unidad.estado) return null;

                  const diasVencer = calcularDiasParaVencer(unidad);
                  const estadoBadge = getEstadoBadge(unidad.estado);

                  return (
                    <tr key={unidad.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {unidad.productoSKU || '-'}
                          </div>
                          <div className="text-sm text-gray-500">{unidad.productoNombre || '-'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{unidad.lote || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatFecha(unidad.fechaVencimiento)}
                        </div>
                        <div className={`text-xs font-medium ${getColorVencimiento(diasVencer)}`}>
                          {diasVencer < 0
                            ? `Vencido hace ${Math.abs(diasVencer)} días`
                            : `${diasVencer} días`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {unidad.pais === 'USA' ? '🇺🇸' : '🇵🇪'} {unidad.almacenNombre || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={estadoBadge.variant}>{estadoBadge.label}</Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(unidad.costoUnitarioUSD || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && unidadesFiltradas.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Mostrando <span className="font-medium">{unidadesFiltradas.length}</span> unidades
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
