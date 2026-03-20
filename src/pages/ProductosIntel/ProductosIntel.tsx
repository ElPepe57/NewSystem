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
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';
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
  const lineaFiltroGlobal = useLineaNegocioStore(state => state.lineaFiltroGlobal);

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

  // Productos filtrados + línea de negocio + búsqueda
  const productosFiltrados = getProductosFiltrados().filter(p => {
    // Filtro por línea de negocio global
    if (lineaFiltroGlobal && p.lineaNegocioId && p.lineaNegocioId !== lineaFiltroGlobal) return false;
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
    { key: 'dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: TrendingUp },
    { key: 'productos', label: 'Productos', shortLabel: 'Productos', icon: Package, count: productosFiltrados.length },
    { key: 'reposicion', label: 'Reposición', shortLabel: 'Repos.', icon: Wallet, count: sugerenciasReposicion.length }
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            {/* Tabs */}
            <div className="flex justify-between bg-gray-100 rounded-lg p-1 gap-1 w-full sm:w-auto">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = tabActiva === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setTabActiva(tab.key as TabActiva)}
                    className={`
                      flex-1 sm:flex-initial relative flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-2 sm:px-3 py-2 sm:py-1.5 rounded-md font-medium transition-colors
                      ${isActive
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'}
                    `}
                  >
                    <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-blue-600' : ''}`} />
                    <span className="text-[10px] leading-tight sm:hidden">{tab.shortLabel}</span>
                    <span className="hidden sm:inline text-sm">{tab.label}</span>
                    {tab.count !== undefined && (
                      <>
                        {/* Mobile: badge superpuesto */}
                        <span className={`
                          sm:hidden absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] font-bold
                          ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-400 text-white'}
                        `}>
                          {tab.count}
                        </span>
                        {/* Desktop: badge inline */}
                        <span className={`
                          hidden sm:inline px-1.5 py-0.5 rounded text-xs
                          ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}
                        `}>
                          {tab.count}
                        </span>
                      </>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              {[
                { label: 'Productos Activos', value: productosIntel.length, color: 'blue', icon: Package, valueColor: 'text-gray-900' },
                { label: 'Alta Liquidez', value: productosIntel.filter(p => p.liquidez.clasificacion === 'alta').length, color: 'green', icon: TrendingUp, valueColor: 'text-green-600' },
                { label: 'Caja Congelada', value: productosIntel.filter(p => p.liquidez.clasificacion === 'critica' || p.liquidez.clasificacion === 'baja').length, color: 'red', icon: AlertTriangle, valueColor: 'text-red-600' },
                { label: 'Repos. Urgente', value: sugerenciasReposicion.filter(s => s.urgencia === 'critica' || s.urgencia === 'alta').length, color: 'purple', icon: Wallet, valueColor: 'text-purple-600' },
              ].map(kpi => {
                const Icon = kpi.icon;
                const bgMap: Record<string, string> = { blue: 'bg-blue-100', green: 'bg-green-100', red: 'bg-red-100', purple: 'bg-purple-100' };
                const iconColorMap: Record<string, string> = { blue: 'text-blue-600', green: 'text-green-600', red: 'text-red-600', purple: 'text-purple-600' };
                return (
                  <Card key={kpi.label} className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <p className="text-[11px] sm:text-sm text-gray-500 leading-tight">{kpi.label}</p>
                        <p className={`text-2xl sm:text-2xl font-bold ${kpi.valueColor} mt-1`}>{kpi.value}</p>
                      </div>
                      <div className={`p-1.5 sm:p-2.5 ${bgMap[kpi.color]} rounded-lg flex-shrink-0`}>
                        <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${iconColorMap[kpi.color]}`} />
                      </div>
                    </div>
                  </Card>
                );
              })}
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
