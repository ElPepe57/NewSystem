import { useState, useEffect, useMemo } from 'react';
import type { Marca } from '../../types/entidadesMaestras.types';
import { marcaAnalyticsService, type MarcaAnalytics, type ProductoMarcaMetrics } from '../../services/marca.analytics.service';

type DetailTab = 'resumen' | 'productos' | 'analytics' | 'inventario' | 'comparar';

interface MarcaDetailViewProps {
  marca: Marca;
  onClose: () => void;
  onEdit?: () => void;
}

export function MarcaDetailView({ marca, onClose, onEdit }: MarcaDetailViewProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('resumen');
  const [analytics, setAnalytics] = useState<MarcaAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [ordenProductos, setOrdenProductos] = useState<'ventas' | 'stock' | 'margen' | 'nombre'>('ventas');
  const [filtroProducto, setFiltroProducto] = useState('');

  useEffect(() => {
    loadAnalytics();
  }, [marca.id]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await marcaAnalyticsService.getMarcaAnalytics(marca.id);
      setAnalytics(data);
    } catch (error) {
      console.error('Error cargando analytics:', error);
    }
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const productosFiltrados = useMemo(() => {
    if (!analytics?.productos) return [];

    let resultado = [...analytics.productos];

    // Filtro por búsqueda
    if (filtroProducto) {
      const termino = filtroProducto.toLowerCase();
      resultado = resultado.filter(p =>
        p.nombre.toLowerCase().includes(termino) ||
        p.sku.toLowerCase().includes(termino) ||
        p.grupo.toLowerCase().includes(termino)
      );
    }

    // Ordenamiento
    resultado.sort((a, b) => {
      switch (ordenProductos) {
        case 'ventas': return b.ventasTotalPEN - a.ventasTotalPEN;
        case 'stock': return b.stockTotal - a.stockTotal;
        case 'margen': return b.margenPromedio - a.margenPromedio;
        case 'nombre': return a.nombre.localeCompare(b.nombre);
        default: return 0;
      }
    });

    return resultado;
  }, [analytics?.productos, filtroProducto, ordenProductos]);

  const getTendenciaIcon = (tendencia: string) => {
    switch (tendencia) {
      case 'subiendo':
        return <span className="text-green-500">↑</span>;
      case 'bajando':
        return <span className="text-red-500">↓</span>;
      default:
        return <span className="text-gray-400">→</span>;
    }
  };

  // Renderizar pestaña Resumen
  const renderResumen = () => (
    <div className="space-y-6">
      {/* Info de la marca */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start gap-4">
          {marca.logoUrl ? (
            <img src={marca.logoUrl} alt={marca.nombre} className="w-16 h-16 rounded-lg object-cover" />
          ) : (
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: marca.colorPrimario || '#3B82F6' }}
            >
              {marca.nombre.charAt(0)}
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{marca.nombre}</h2>
            <p className="text-gray-500">{marca.codigo}</p>
            {marca.descripcion && <p className="text-gray-600 mt-2">{marca.descripcion}</p>}
            <div className="flex gap-2 mt-3">
              <span className={`px-2 py-1 text-xs rounded-full ${
                marca.estado === 'activa' ? 'bg-green-100 text-green-800' :
                marca.estado === 'inactiva' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {marca.estado}
              </span>
              <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                {marca.tipoMarca}
              </span>
              {marca.paisOrigen && (
                <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                  {marca.paisOrigen}
                </span>
              )}
            </div>
          </div>
          {onEdit && (
            <button
              onClick={onEdit}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Editar
            </button>
          )}
        </div>
      </div>

      {/* KPIs principales */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Productos</div>
            <div className="text-2xl font-bold text-gray-900">{analytics.totalProductos}</div>
            <div className="text-xs text-gray-500">
              {analytics.productosActivos} activos
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Ventas (365d)</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(analytics.ventasUltimos365Dias)}</div>
            <div className="flex items-center gap-1 text-xs">
              {getTendenciaIcon(analytics.tendenciaVentas)}
              <span className={analytics.tasaCrecimiento >= 0 ? 'text-green-600' : 'text-red-600'}>
                {analytics.tasaCrecimiento >= 0 ? '+' : ''}{analytics.tasaCrecimiento.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Margen Promedio</div>
            <div className={`text-2xl font-bold ${
              analytics.margenPonderado >= 25 ? 'text-green-600' :
              analytics.margenPonderado >= 15 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {formatPercent(analytics.margenPonderado)}
            </div>
            <div className="text-xs text-gray-500">
              Ponderado por ventas
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Stock Total</div>
            <div className="text-2xl font-bold text-blue-600">{analytics.stockTotalUnidades}</div>
            <div className="text-xs text-gray-500">
              {formatCurrency(analytics.valorInventarioTotalPEN)}
            </div>
          </div>
        </div>
      )}

      {/* Producto Estrella y Alertas */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Producto Estrella */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-yellow-500">★</span> Producto Estrella
            </h3>
            {analytics.productoEstrella ? (
              <div className="space-y-2">
                <div className="font-medium text-gray-900">{analytics.productoEstrella.nombre}</div>
                <div className="text-sm text-gray-500">SKU: {analytics.productoEstrella.sku}</div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div>
                    <div className="text-xs text-gray-500">Ventas</div>
                    <div className="font-semibold text-green-600">
                      {formatCurrency(analytics.productoEstrella.ventasTotalPEN)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Margen</div>
                    <div className="font-semibold">
                      {formatPercent(analytics.productoEstrella.margenPromedio)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">Sin ventas registradas</div>
            )}
          </div>

          {/* Alertas */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Alertas</h3>
            <div className="space-y-2">
              {analytics.productosEnStockCritico > 0 && (
                <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-red-700 text-sm">
                    {analytics.productosEnStockCritico} productos en stock crítico
                  </span>
                </div>
              )}
              {analytics.productosSobreStock > 0 && (
                <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-yellow-700 text-sm">
                    {analytics.productosSobreStock} productos en sobre-stock
                  </span>
                </div>
              )}
              {analytics.productosBajoRendimiento.length > 0 && (
                <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-orange-700 text-sm">
                    {analytics.productosBajoRendimiento.length} productos sin ventas
                  </span>
                </div>
              )}
              {analytics.productosEnStockCritico === 0 &&
               analytics.productosSobreStock === 0 &&
               analytics.productosBajoRendimiento.length === 0 && (
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-green-700 text-sm">Todo en orden</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Métricas por Categoría */}
      {analytics && analytics.categorias.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Rendimiento por Categoría</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2 text-left">Categoría</th>
                  <th className="px-3 py-2 text-right">Productos</th>
                  <th className="px-3 py-2 text-right">Ventas</th>
                  <th className="px-3 py-2 text-right">Margen</th>
                  <th className="px-3 py-2 text-left">Producto Estrella</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analytics.categorias.map(cat => (
                  <tr key={cat.categoria} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">{cat.categoria}</div>
                      {cat.subcategorias.length > 0 && (
                        <div className="text-xs text-gray-500">
                          {cat.subcategorias.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-900">{cat.totalProductos}</td>
                    <td className="px-3 py-2 text-right font-medium text-green-600">
                      {formatCurrency(cat.ventasTotalPEN)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={cat.margenPromedio >= 25 ? 'text-green-600' : cat.margenPromedio >= 15 ? 'text-yellow-600' : 'text-red-600'}>
                        {formatPercent(cat.margenPromedio)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {cat.productoEstrella?.nombre || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // Renderizar pestaña Productos
  const renderProductos = () => (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-64">
            <input
              type="text"
              placeholder="Buscar productos..."
              value={filtroProducto}
              onChange={(e) => setFiltroProducto(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={ordenProductos}
            onChange={(e) => setOrdenProductos(e.target.value as any)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="ventas">Ordenar: Ventas</option>
            <option value="stock">Ordenar: Stock</option>
            <option value="margen">Ordenar: Margen</option>
            <option value="nombre">Ordenar: Nombre</option>
          </select>
        </div>
      </div>

      {/* Lista de productos */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr className="text-xs text-gray-500 uppercase">
              <th className="px-4 py-3 text-left">Producto</th>
              <th className="px-4 py-3 text-left">Categoría</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-right">Unidades Vendidas</th>
              <th className="px-4 py-3 text-right">Ventas</th>
              <th className="px-4 py-3 text-right">Margen</th>
              <th className="px-4 py-3 text-center">Tendencia</th>
              <th className="px-4 py-3 text-center">ML</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {productosFiltrados.map((producto, idx) => (
              <tr key={producto.id} className={`hover:bg-gray-50 ${idx < 3 ? 'bg-yellow-50' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {idx < 3 && <span className="text-yellow-500 text-sm">#{idx + 1}</span>}
                    <div>
                      <div className="font-medium text-gray-900">{producto.nombre}</div>
                      <div className="text-xs text-gray-500">{producto.sku}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900">{producto.grupo}</div>
                  {producto.subgrupo && (
                    <div className="text-xs text-gray-500">{producto.subgrupo}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className={`font-medium ${producto.stockTotal <= 5 ? 'text-red-600' : 'text-gray-900'}`}>
                    {producto.stockTotal}
                  </div>
                  <div className="text-xs text-gray-500">
                    USA: {producto.stockUSA} | PE: {producto.stockPeru}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-900">
                  {producto.unidadesVendidas}
                </td>
                <td className="px-4 py-3 text-right font-medium text-green-600">
                  {formatCurrency(producto.ventasTotalPEN)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={producto.margenPromedio >= 25 ? 'text-green-600' : producto.margenPromedio >= 15 ? 'text-yellow-600' : 'text-red-600'}>
                    {formatPercent(producto.margenPromedio)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-lg">
                  {getTendenciaIcon(producto.tendencia)}
                </td>
                <td className="px-4 py-3 text-center">
                  {producto.habilitadoML ? (
                    <span className="inline-flex items-center px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                      ML
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {productosFiltrados.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No se encontraron productos
          </div>
        )}
      </div>
    </div>
  );

  // Renderizar pestaña Analytics
  const renderAnalytics = () => (
    <div className="space-y-6">
      {analytics && (
        <>
          {/* Métricas de Ventas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h4 className="text-sm text-gray-500 mb-2">Últimos 30 días</h4>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(analytics.ventasUltimos30Dias)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h4 className="text-sm text-gray-500 mb-2">Últimos 90 días</h4>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(analytics.ventasUltimos90Dias)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h4 className="text-sm text-gray-500 mb-2">Últimos 365 días</h4>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(analytics.ventasUltimos365Dias)}
              </div>
            </div>
          </div>

          {/* Gráfico de Historial (representación simple) */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Historial de Ventas</h3>
            {analytics.historialVentas.length > 0 ? (
              <div className="space-y-2">
                {analytics.historialVentas.slice(-12).map(periodo => {
                  const maxVentas = Math.max(...analytics.historialVentas.map(p => p.ventasPEN));
                  const porcentaje = maxVentas > 0 ? (periodo.ventasPEN / maxVentas) * 100 : 0;

                  return (
                    <div key={periodo.periodo} className="flex items-center gap-3">
                      <div className="w-20 text-sm text-gray-500">{periodo.periodo}</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full flex items-center justify-end pr-2"
                          style={{ width: `${Math.max(porcentaje, 5)}%` }}
                        >
                          <span className="text-xs text-white font-medium">
                            {formatCurrency(periodo.ventasPEN)}
                          </span>
                        </div>
                      </div>
                      <div className="w-16 text-sm text-gray-500 text-right">
                        {periodo.unidades} u.
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No hay historial de ventas disponible
              </div>
            )}
          </div>

          {/* Métricas de Clientes */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Métricas de Clientes</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{analytics.clientesUnicos}</div>
                <div className="text-sm text-gray-500">Clientes Únicos</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{analytics.clientesRecurrentes}</div>
                <div className="text-sm text-gray-500">Recurrentes</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-purple-600">{formatPercent(analytics.tasaRecompra)}</div>
                <div className="text-sm text-gray-500">Tasa Recompra</div>
              </div>
            </div>
          </div>

          {/* Top 5 Productos */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Top 5 Productos</h3>
            <div className="space-y-3">
              {analytics.productosTop5.map((producto, idx) => (
                <div key={producto.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                    idx === 0 ? 'bg-yellow-500' :
                    idx === 1 ? 'bg-gray-400' :
                    idx === 2 ? 'bg-amber-600' : 'bg-blue-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{producto.nombre}</div>
                    <div className="text-sm text-gray-500">{producto.sku}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">{formatCurrency(producto.ventasTotalPEN)}</div>
                    <div className="text-xs text-gray-500">{producto.unidadesVendidas} unidades</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // Renderizar pestaña Inventario
  const renderInventario = () => (
    <div className="space-y-6">
      {analytics && (
        <>
          {/* Resumen de inventario */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Unidades Totales</div>
              <div className="text-2xl font-bold text-gray-900">{analytics.stockTotalUnidades}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Valor Inventario (PEN)</div>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(analytics.valorInventarioTotalPEN)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Rotación Promedio</div>
              <div className="text-2xl font-bold text-purple-600">
                {analytics.rotacionPromedioGlobal.toFixed(0)} días
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">En Stock Crítico</div>
              <div className={`text-2xl font-bold ${analytics.productosEnStockCritico > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {analytics.productosEnStockCritico}
              </div>
            </div>
          </div>

          {/* Lista de stock por producto */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Detalle de Inventario</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-right">Stock USA</th>
                  <th className="px-4 py-3 text-right">Stock Perú</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Valor (PEN)</th>
                  <th className="px-4 py-3 text-right">Rotación</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analytics.productos
                  .filter(p => p.stockTotal > 0)
                  .sort((a, b) => b.stockTotal - a.stockTotal)
                  .map(producto => {
                    let estadoStock: 'critico' | 'bajo' | 'normal' | 'alto' = 'normal';
                    if (producto.stockTotal <= 2) estadoStock = 'critico';
                    else if (producto.stockTotal <= 5) estadoStock = 'bajo';
                    else if (producto.stockTotal >= 50) estadoStock = 'alto';

                    return (
                      <tr key={producto.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{producto.nombre}</div>
                          <div className="text-xs text-gray-500">{producto.sku}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">{producto.stockUSA}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{producto.stockPeru}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{producto.stockTotal}</td>
                        <td className="px-4 py-3 text-right text-blue-600">
                          {formatCurrency(producto.valorInventarioPEN)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {producto.rotacionDias > 0 ? `${producto.rotacionDias} días` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            estadoStock === 'critico' ? 'bg-red-100 text-red-800' :
                            estadoStock === 'bajo' ? 'bg-yellow-100 text-yellow-800' :
                            estadoStock === 'alto' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {estadoStock === 'critico' ? 'Crítico' :
                             estadoStock === 'bajo' ? 'Bajo' :
                             estadoStock === 'alto' ? 'Alto' : 'Normal'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );

  // Renderizar pestaña Comparar
  const renderComparar = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Comparación por Categoría</h3>
        <p className="text-gray-500 mb-4">
          Selecciona una categoría para ver cómo se compara esta marca con otras en el mismo segmento.
        </p>

        {analytics && analytics.categorias.length > 0 ? (
          <div className="space-y-6">
            {analytics.categorias.map(cat => (
              <div key={cat.categoria} className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">{cat.categoria}</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{cat.totalProductos}</div>
                    <div className="text-sm text-gray-500">Productos</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(cat.ventasTotalPEN)}</div>
                    <div className="text-sm text-gray-500">Ventas</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${cat.margenPromedio >= 25 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {formatPercent(cat.margenPromedio)}
                    </div>
                    <div className="text-sm text-gray-500">Margen</div>
                  </div>
                </div>
                {cat.productoEstrella && (
                  <div className="mt-3 pt-3 border-t text-sm text-gray-600">
                    <span className="text-yellow-500">★</span> Producto líder: {cat.productoEstrella.nombre}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No hay categorías para comparar
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-100 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {marca.logoUrl ? (
              <img src={marca.logoUrl} alt={marca.nombre} className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: marca.colorPrimario || '#3B82F6' }}
              >
                {marca.nombre.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">{marca.nombre}</h1>
              <p className="text-sm text-gray-500">{marca.codigo} - Analytics Detallado</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b px-6">
          <nav className="flex gap-4">
            {[
              { id: 'resumen', label: 'Resumen' },
              { id: 'productos', label: 'Productos' },
              { id: 'analytics', label: 'Analytics' },
              { id: 'inventario', label: 'Inventario' },
              { id: 'comparar', label: 'Comparar' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as DetailTab)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'resumen' && renderResumen()}
          {activeTab === 'productos' && renderProductos()}
          {activeTab === 'analytics' && renderAnalytics()}
          {activeTab === 'inventario' && renderInventario()}
          {activeTab === 'comparar' && renderComparar()}
        </div>
      </div>
    </div>
  );
}
