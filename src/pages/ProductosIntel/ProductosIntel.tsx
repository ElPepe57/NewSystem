import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  Filter,
  LayoutGrid,
  List,
  Search,
  Download,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Package,
  ChevronDown
} from 'lucide-react';
import { Button, Card, Modal, GradientHeader } from '../../components/common';
import {
  ResumenCajaCard,
  ProductoIntelCard,
  ProductoIntelTable,
  SugerenciasReposicionCard,
  FlujoCajaCard,
  LeadTimeCard,
  HistorialVentasChart
} from '../../components/modules/productoIntel';
import { useProductoIntelStore } from '../../store/productoIntelStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import type { ProductoIntel, ClasificacionLiquidez } from '../../types/productoIntel.types';

type VistaProductos = 'cards' | 'tabla';
type TabActiva = 'dashboard' | 'productos' | 'reposicion';

export const ProductosIntel: React.FC = () => {
  // Stores
  const {
    productosIntel,
    resumenCaja,
    flujoCaja,
    sugerenciasReposicion,
    leadTimeGlobal,
    loading,
    error,
    ultimaActualizacion,
    filtroLiquidez,
    filtroRotacion,
    ordenarPor,
    ordenAscendente,
    cargarDatos,
    setFiltroLiquidez,
    setFiltroRotacion,
    setOrdenarPor,
    toggleOrden,
    getProductosFiltrados,
    getAlertasCriticas
  } = useProductoIntelStore();

  const { getTCDelDia } = useTipoCambioStore();

  // Estado local
  const [vistaProductos, setVistaProductos] = useState<VistaProductos>('tabla');
  const [tabActiva, setTabActiva] = useState<TabActiva>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoIntel | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Cargar datos al montar
  useEffect(() => {
    const loadData = async () => {
      const tc = await getTCDelDia();
      await cargarDatos(tc?.venta || 3.7);
    };
    loadData();
  }, []);

  // Productos filtrados + busqueda
  const productosFiltrados = getProductosFiltrados().filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.nombreComercial.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term) ||
      p.marca.toLowerCase().includes(term)
    );
  });

  const alertasCriticas = getAlertasCriticas();

  // Handlers
  const handleRefresh = async () => {
    const tc = await getTCDelDia();
    await cargarDatos(tc?.venta || 3.7);
  };

  const handleProductoClick = (productoId: string) => {
    const producto = productosIntel.find(p => p.productoId === productoId);
    if (producto) {
      setProductoSeleccionado(producto);
    }
  };

  const handleFiltroLiquidezClick = (liquidez: ClasificacionLiquidez | 'todos') => {
    setFiltroLiquidez(liquidez as any);
    setTabActiva('productos');
  };

  // Tabs
  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { key: 'productos', label: 'Productos', icon: Package, count: productosFiltrados.length },
    { key: 'reposicion', label: 'Reposicion', icon: Wallet, count: sugerenciasReposicion.length }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <GradientHeader
        title="Inteligencia de Productos"
        subtitle="Analisis de rotacion, liquidez y rentabilidad"
        variant="blue"
      />

      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = tabActiva === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setTabActiva(tab.key as TabActiva)}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                      ${isActive
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'}
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    {tab.count !== undefined && (
                      <span className={`
                        px-1.5 py-0.5 rounded text-xs
                        ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}
                      `}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Alertas criticas */}
              {alertasCriticas.length > 0 && (
                <button
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                  onClick={() => {
                    setFiltroLiquidez('critica');
                    setTabActiva('productos');
                  }}
                >
                  <AlertTriangle className="h-4 w-4" />
                  {alertasCriticas.length} alertas
                </button>
              )}

              {/* Ultima actualizacion */}
              {ultimaActualizacion && (
                <span className="text-xs text-gray-500 hidden sm:inline">
                  Actualizado: {ultimaActualizacion.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}

              {/* Refresh */}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
                loading={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* TAB: Dashboard */}
        {tabActiva === 'dashboard' && (
          <div className="space-y-6">
            {/* KPIs principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Productos Activos</p>
                    <p className="text-2xl font-bold text-gray-900">{productosIntel.length}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Package className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Alta Liquidez</p>
                    <p className="text-2xl font-bold text-green-600">
                      {productosIntel.filter(p => p.liquidez.clasificacion === 'alta').length}
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Caja Congelada</p>
                    <p className="text-2xl font-bold text-red-600">
                      {productosIntel.filter(p => p.liquidez.clasificacion === 'critica' || p.liquidez.clasificacion === 'baja').length}
                    </p>
                  </div>
                  <div className="p-3 bg-red-100 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Reposicion Urgente</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {sugerenciasReposicion.filter(s => s.urgencia === 'critica' || s.urgencia === 'alta').length}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Wallet className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Resumen de caja + Flujo + Lead Time */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {resumenCaja && (
                <ResumenCajaCard
                  resumen={resumenCaja}
                  onClickCategoria={(cat) => {
                    // cat puede ser: 'activa', 'comprometida', 'transito', 'congelada'
                    // Mapear a los filtros del store
                    setFiltroLiquidez(cat as any);
                    setTabActiva('productos');
                  }}
                />
              )}

              {flujoCaja && <FlujoCajaCard flujo={flujoCaja} />}
            </div>

            {/* Sugerencias + Lead Time */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SugerenciasReposicionCard
                sugerencias={sugerenciasReposicion}
                maxItems={5}
                onVerTodas={() => setTabActiva('reposicion')}
                onProductoClick={handleProductoClick}
              />

              {leadTimeGlobal && <LeadTimeCard leadTime={leadTimeGlobal} />}
            </div>

            {/* Top productos liquidez */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Top Productos por Liquidez</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTabActiva('productos')}
                >
                  Ver todos
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {productosIntel
                  .sort((a, b) => b.liquidez.score - a.liquidez.score)
                  .slice(0, 6)
                  .map(producto => (
                    <ProductoIntelCard
                      key={producto.productoId}
                      producto={producto}
                      compact
                      onClick={() => handleProductoClick(producto.productoId)}
                    />
                  ))}
              </div>
            </Card>
          </div>
        )}

        {/* TAB: Productos */}
        {tabActiva === 'productos' && (
          <div className="space-y-4">
            {/* Filtros y busqueda */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Busqueda */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Filtro por categoría de caja */}
              <select
                value={filtroLiquidez}
                onChange={(e) => setFiltroLiquidez(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todas las categorías</option>
                <optgroup label="Por Tipo de Caja">
                  <option value="activa">💚 Caja Activa (disponible)</option>
                  <option value="comprometida">🔒 Comprometida (reservado)</option>
                  <option value="transito">🚚 En Tránsito</option>
                  <option value="congelada">❄️ Congelada (sin mov.)</option>
                </optgroup>
                <optgroup label="Por Liquidez">
                  <option value="alta">Alta liquidez</option>
                  <option value="media">Liquidez media</option>
                  <option value="baja">Baja liquidez</option>
                  <option value="critica">Crítica</option>
                </optgroup>
              </select>

              {/* Filtro rotacion */}
              <select
                value={filtroRotacion}
                onChange={(e) => setFiltroRotacion(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todas las rotaciones</option>
                <option value="muy_alta">Muy alta (&lt;7d)</option>
                <option value="alta">Alta (7-15d)</option>
                <option value="media">Media (15-30d)</option>
                <option value="baja">Baja (30-60d)</option>
                <option value="muy_baja">Muy baja (60-90d)</option>
                <option value="sin_movimiento">Sin movimiento</option>
              </select>

              {/* Ordenar */}
              <select
                value={ordenarPor}
                onChange={(e) => setOrdenarPor(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="score">Ordenar por Score</option>
                <option value="rotacion">Ordenar por Rotacion</option>
                <option value="margen">Ordenar por Margen</option>
                <option value="stock">Ordenar por Stock</option>
                <option value="nombre">Ordenar por Nombre</option>
              </select>

              {/* Vista */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setVistaProductos('tabla')}
                  className={`p-2 rounded ${vistaProductos === 'tabla' ? 'bg-white shadow-sm' : ''}`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setVistaProductos('cards')}
                  className={`p-2 rounded ${vistaProductos === 'cards' ? 'bg-white shadow-sm' : ''}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Contador */}
            <p className="text-sm text-gray-500">
              Mostrando {productosFiltrados.length} de {productosIntel.length} productos
            </p>

            {/* Lista de productos */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
              </div>
            ) : vistaProductos === 'tabla' ? (
              <ProductoIntelTable
                productos={productosFiltrados}
                onSort={(campo) => {
                  if (ordenarPor === campo) {
                    toggleOrden();
                  } else {
                    setOrdenarPor(campo as any);
                  }
                }}
                sortConfig={{ campo: ordenarPor, ascendente: ordenAscendente }}
                onProductoClick={handleProductoClick}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {productosFiltrados.map(producto => (
                  <ProductoIntelCard
                    key={producto.productoId}
                    producto={producto}
                    onClick={() => handleProductoClick(producto.productoId)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: Reposicion */}
        {tabActiva === 'reposicion' && (
          <div className="space-y-4">
            <SugerenciasReposicionCard
              sugerencias={sugerenciasReposicion}
              maxItems={50}
              onProductoClick={handleProductoClick}
            />
          </div>
        )}
      </div>

      {/* Modal detalle producto */}
      <Modal
        isOpen={!!productoSeleccionado}
        onClose={() => setProductoSeleccionado(null)}
        title={productoSeleccionado?.nombreComercial || ''}
        size="xl"
      >
        {productoSeleccionado && (
          <div className="space-y-4">
            {/* Grid de metricas + grafico */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Metricas del producto */}
              <ProductoIntelCard producto={productoSeleccionado} />

              {/* Grafico de historial */}
              <HistorialVentasChart
                productoId={productoSeleccionado.productoId}
                nombreProducto={productoSeleccionado.nombreComercial}
                periodoMeses={6}
              />
            </div>

            {/* Alertas */}
            {productoSeleccionado.alertas.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">Alertas</h4>
                {productoSeleccionado.alertas.map((alerta, idx) => (
                  <div
                    key={idx}
                    className={`
                      flex items-start gap-2 p-3 rounded-lg
                      ${alerta.severidad === 'danger' ? 'bg-red-50 text-red-700' : ''}
                      ${alerta.severidad === 'warning' ? 'bg-yellow-50 text-yellow-700' : ''}
                      ${alerta.severidad === 'info' ? 'bg-blue-50 text-blue-700' : ''}
                    `}
                  >
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{alerta.mensaje}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recomendacion */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-700 mb-1">Recomendacion</h4>
              <p className="text-sm text-blue-600">{productoSeleccionado.liquidez.recomendacion}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
