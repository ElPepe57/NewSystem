import React, { useEffect, useState, useMemo } from 'react';
import { Package, AlertTriangle, TrendingUp, DollarSign, Search, Download, RefreshCw, CheckCircle, Warehouse, Clock } from 'lucide-react';
import { Card, Badge, Select, Button, Modal } from '../../components/common';
import { useInventarioStore } from '../../store/inventarioStore';
import { useProductoStore } from '../../store/productoStore';
import { useAlmacenStore } from '../../store/almacenStore';
import { exportService } from '../../services/export.service';
import { inventarioService } from '../../services/inventario.service';

export const Inventario: React.FC = () => {
  const { inventario, stats, loading, fetchInventario, fetchStats } = useInventarioStore();
  const { productos, fetchProductos } = useProductoStore();
  const { almacenes, fetchAlmacenes } = useAlmacenStore();

  const [busqueda, setBusqueda] = useState('');
  const [filtros, setFiltros] = useState({
    pais: '' as 'USA' | 'Peru' | '',
    almacenId: '',
    grupo: '',
    soloStockCritico: false,
    soloConStock: false  // Mostrar todo el inventario por defecto, incluyendo reservadas
  });

  // Estados para sincronización de estados
  const [sincronizando, setSincronizando] = useState(false);
  const [resultadoSync, setResultadoSync] = useState<{
    estadosUnidades: {
      unidadesRevisadas: number;
      correccionesRealizadas: number;
      reservasLiberadas: number;
    };
    stockProductos: {
      productosRevisados: number;
      productosActualizados: number;
    };
    errores: number;
  } | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);

  useEffect(() => {
    fetchInventario();  // Sin filtro para ver todo el inventario
    fetchStats();
    fetchProductos();
    fetchAlmacenes();
  }, [fetchInventario, fetchStats, fetchProductos, fetchAlmacenes]);

  // Filtrar inventario
  const inventarioFiltrado = useMemo(() => {
    let resultado = inventario;

    // Aplicar búsqueda
    if (busqueda) {
      const terminoLower = busqueda.toLowerCase();
      resultado = resultado.filter(i =>
        i.productoSKU.toLowerCase().includes(terminoLower) ||
        i.productoNombre.toLowerCase().includes(terminoLower) ||
        i.productoMarca.toLowerCase().includes(terminoLower)
      );
    }

    // Aplicar filtros
    if (filtros.pais) {
      resultado = resultado.filter(i => i.pais === filtros.pais);
    }
    if (filtros.almacenId) {
      resultado = resultado.filter(i => i.almacenId === filtros.almacenId);
    }
    if (filtros.grupo) {
      resultado = resultado.filter(i => i.productoGrupo === filtros.grupo);
    }
    if (filtros.soloStockCritico) {
      resultado = resultado.filter(i => i.stockCritico);
    }

    return resultado;
  }, [inventario, busqueda, filtros]);

  // Obtener grupos únicos
  const gruposUnicos = useMemo(() => {
    const grupos = new Set(productos.map(p => p.grupo));
    return Array.from(grupos).sort();
  }, [productos]);

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltros({
      pais: '',
      almacenId: '',
      grupo: '',
      soloStockCritico: false,
      soloConStock: false
    });
    fetchInventario();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Sincronización completa: estados de unidades + stock de productos
  const handleSincronizarCompleto = async () => {
    setSincronizando(true);
    try {
      const resultado = await inventarioService.sincronizacionCompleta();
      setResultadoSync(resultado);
      setShowSyncModal(true);

      // Refrescar datos
      fetchInventario({ soloConStock: filtros.soloConStock });
      fetchStats();
    } catch (error: any) {
      console.error('Error sincronizando:', error);
      alert('Error al sincronizar: ' + error.message);
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventario General</h1>
          <p className="text-gray-600 mt-1">
            Vista consolidada de stock por producto y almacén
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleSincronizarCompleto}
            disabled={sincronizando}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${sincronizando ? 'animate-spin' : ''}`} />
            {sincronizando ? 'Sincronizando...' : 'Sincronizar Estados'}
          </Button>
          <Button
            variant="outline"
            onClick={() => exportService.exportInventario(inventarioFiltrado)}
            disabled={inventarioFiltrado.length === 0}
          >
            <Download className="h-5 w-5 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Métricas Globales */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Total Productos */}
          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Total Productos</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.totalProductos}
                </div>
              </div>
              <Package className="h-8 w-8 text-gray-400" />
            </div>
          </Card>

          {/* Stock Disponible */}
          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Disponibles</div>
                <div className="text-2xl font-bold text-success-600 mt-1">
                  {stats.totalDisponibles.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  USA: {stats.disponiblesUSA} · PE: {stats.disponiblesPeru}
                </div>
              </div>
              <TrendingUp className="h-8 w-8 text-success-400" />
            </div>
          </Card>

          {/* Stock Reservado */}
          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Reservadas</div>
                <div className="text-2xl font-bold text-primary-600 mt-1">
                  {stats.totalReservadas.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  USA: {stats.reservadasUSA} · PE: {stats.reservadasPeru}
                </div>
              </div>
              <Warehouse className="h-8 w-8 text-primary-400" />
            </div>
          </Card>

          {/* En Tránsito */}
          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">En Tránsito</div>
                <div className="text-2xl font-bold text-blue-600 mt-1">
                  {stats.totalEnTransito.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  a USA: {stats.enTransitoUSA} · a PE: {stats.enTransitoPeru}
                </div>
              </div>
              <Clock className="h-8 w-8 text-blue-400" />
            </div>
          </Card>

          {/* Stock Crítico */}
          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Stock Crítico</div>
                <div className="text-2xl font-bold text-warning-600 mt-1">
                  {stats.productosStockCritico}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Agotados: {stats.productosAgotados}
                </div>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning-400" />
            </div>
          </Card>

          {/* Valor Total */}
          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Valor Total</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(stats.valorTotalUSD)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {stats.totalUnidades.toLocaleString()} unidades activas
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-gray-400" />
            </div>
          </Card>
        </div>
      )}

      {/* Búsqueda y Filtros */}
      <Card padding="md">
        <div className="space-y-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por SKU, nombre o marca..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              label="Grupo"
              value={filtros.grupo}
              onChange={(e) => setFiltros({ ...filtros, grupo: e.target.value })}
              options={[
                { value: '', label: 'Todos los grupos' },
                ...gruposUnicos.map(g => ({
                  value: g,
                  label: g
                }))
              ]}
            />

            <div className="flex items-end">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filtros.soloStockCritico}
                  onChange={(e) => setFiltros({ ...filtros, soloStockCritico: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Solo stock crítico</span>
              </label>
            </div>
          </div>

          {(busqueda || filtros.pais || filtros.almacenId || filtros.grupo || filtros.soloStockCritico) && (
            <button
              onClick={limpiarFiltros}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </Card>

      {/* Tabla de Inventario */}
      <Card padding="md">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : inventarioFiltrado.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay inventario</h3>
            <p className="mt-1 text-sm text-gray-500">
              No se encontraron productos que coincidan con los filtros
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
                    Almacén
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Disponibles
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    En Tránsito
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Reservadas
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Por Vencer (30d)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Valor USD
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inventarioFiltrado.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {item.productoSKU}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.productoMarca} · {item.productoNombre}
                        </div>
                        <div className="text-xs text-gray-400">
                          {item.productoGrupo}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {item.pais === 'USA' ? '🇺🇸' : '🇵🇪'} {item.almacenNombre}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900">{item.disponibles}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">{item.enTransito}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">{item.reservadas}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className={`text-sm font-medium ${
                        item.proximasAVencer30Dias > 0 ? 'text-warning-600' : 'text-gray-900'
                      }`}>
                        {item.proximasAVencer30Dias}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">
                        {formatCurrency(item.valorTotalUSD)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {item.stockCritico && (
                        <Badge variant="danger">Stock Crítico</Badge>
                      )}
                      {!item.stockCritico && item.disponibles === 0 && (
                        <Badge variant="default">Agotado</Badge>
                      )}
                      {!item.stockCritico && item.disponibles > 0 && (
                        <Badge variant="success">OK</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && inventarioFiltrado.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Mostrando <span className="font-medium">{inventarioFiltrado.length}</span> productos
            </div>
          </div>
        )}
      </Card>

      {/* Modal de Resultados de Sincronización */}
      <Modal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        title="Sincronización Completa"
        size="lg"
      >
        <div className="space-y-4">
          {resultadoSync && (
            <>
              {/* Sección: Unidades */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Estados de Unidades</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-gray-900">
                      {resultadoSync.estadosUnidades.unidadesRevisadas}
                    </div>
                    <div className="text-xs text-gray-500">Revisadas</div>
                  </div>
                  <div className="bg-primary-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-primary-600">
                      {resultadoSync.estadosUnidades.correccionesRealizadas}
                    </div>
                    <div className="text-xs text-primary-700">Corregidas</div>
                  </div>
                  <div className="bg-success-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-success-600">
                      {resultadoSync.estadosUnidades.reservasLiberadas}
                    </div>
                    <div className="text-xs text-success-700">Reservas Lib.</div>
                  </div>
                </div>
              </div>

              {/* Sección: Productos */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Stock de Productos</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-gray-900">
                      {resultadoSync.stockProductos.productosRevisados}
                    </div>
                    <div className="text-xs text-gray-500">Revisados</div>
                  </div>
                  <div className="bg-primary-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-primary-600">
                      {resultadoSync.stockProductos.productosActualizados}
                    </div>
                    <div className="text-xs text-primary-700">Stock Actualiz.</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-blue-600">
                      {resultadoSync.ctruActualizados || 0}
                    </div>
                    <div className="text-xs text-blue-700">CTRU Actualiz.</div>
                  </div>
                  <div className="bg-danger-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-danger-600">
                      {resultadoSync.errores}
                    </div>
                    <div className="text-xs text-danger-700">Errores</div>
                  </div>
                </div>
              </div>

              {/* Mensaje de resultado */}
              {resultadoSync.estadosUnidades.correccionesRealizadas === 0 &&
               resultadoSync.stockProductos.productosActualizados === 0 && (
                <div className="flex items-center gap-2 text-success-600 bg-success-50 p-3 rounded-lg">
                  <CheckCircle className="h-5 w-5" />
                  <span>Todo sincronizado correctamente. No se encontraron inconsistencias.</span>
                </div>
              )}

              {(resultadoSync.estadosUnidades.correccionesRealizadas > 0 ||
                resultadoSync.stockProductos.productosActualizados > 0) && (
                <div className="flex items-center gap-2 text-primary-600 bg-primary-50 p-3 rounded-lg">
                  <CheckCircle className="h-5 w-5" />
                  <span>
                    Sincronización completada. Se corrigieron {resultadoSync.estadosUnidades.correccionesRealizadas} unidades
                    y {resultadoSync.stockProductos.productosActualizados} productos.
                  </span>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end">
            <Button onClick={() => setShowSyncModal(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
