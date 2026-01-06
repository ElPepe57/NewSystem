import { useState, useEffect } from 'react';
import { marcaAnalyticsService, type ComparacionMarcas } from '../../services/marca.analytics.service';

type ModoComparacion = 'categoria' | 'tipo';

interface MarcasComparadorProps {
  onClose: () => void;
}

export function MarcasComparador({ onClose }: MarcasComparadorProps) {
  const [modoComparacion, setModoComparacion] = useState<ModoComparacion>('categoria');
  const [categorias, setCategorias] = useState<string[]>([]);
  const [tiposProducto, setTiposProducto] = useState<string[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('');
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string>('');
  const [comparaciones, setComparaciones] = useState<ComparacionMarcas[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOpciones, setLoadingOpciones] = useState(true);

  useEffect(() => {
    loadOpciones();
  }, []);

  useEffect(() => {
    if (modoComparacion === 'categoria' && categoriaSeleccionada) {
      loadComparacion();
    } else if (modoComparacion === 'tipo' && tipoSeleccionado) {
      loadComparacion();
    }
  }, [categoriaSeleccionada, tipoSeleccionado, modoComparacion]);

  const loadOpciones = async () => {
    setLoadingOpciones(true);
    try {
      const [cats, tipos] = await Promise.all([
        marcaAnalyticsService.getCategorias(),
        marcaAnalyticsService.getTiposProducto()
      ]);
      setCategorias(cats);
      setTiposProducto(tipos);
      if (cats.length > 0) {
        setCategoriaSeleccionada(cats[0]);
      }
      if (tipos.length > 0) {
        setTipoSeleccionado(tipos[0]);
      }
    } catch (error) {
      console.error('Error cargando opciones:', error);
    }
    setLoadingOpciones(false);
  };

  const loadComparacion = async () => {
    setLoading(true);
    try {
      let data: ComparacionMarcas[];
      if (modoComparacion === 'categoria') {
        data = await marcaAnalyticsService.compararMarcasPorCategoria(categoriaSeleccionada);
      } else {
        data = await marcaAnalyticsService.compararMarcasPorTipoProducto(tipoSeleccionado);
      }
      setComparaciones(data);
    } catch (error) {
      console.error('Error comparando marcas:', error);
    }
    setLoading(false);
  };

  const handleModoChange = (modo: ModoComparacion) => {
    setModoComparacion(modo);
    setComparaciones([]);
  };

  const seleccionActual = modoComparacion === 'categoria' ? categoriaSeleccionada : tipoSeleccionado;
  const etiquetaSeleccion = modoComparacion === 'categoria' ? 'Categoría' : 'Tipo de Producto';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const getRankingColor = (ranking: number) => {
    if (ranking === 1) return 'bg-yellow-500';
    if (ranking === 2) return 'bg-gray-400';
    if (ranking === 3) return 'bg-amber-600';
    return 'bg-blue-500';
  };

  const getParticipacionColor = (participacion: number) => {
    if (participacion >= 40) return 'bg-green-500';
    if (participacion >= 20) return 'bg-blue-500';
    if (participacion >= 10) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  // Calcular totales
  const totalVentas = comparaciones.reduce((sum, c) => sum + c.ventas, 0);
  const totalProductos = comparaciones.reduce((sum, c) => sum + c.productos, 0);
  const margenPromedio = comparaciones.length > 0
    ? comparaciones.reduce((sum, c) => sum + c.margen * c.ventas, 0) / totalVentas
    : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Comparador de Marcas</h1>
            <p className="text-sm text-gray-500">Compara el rendimiento de marcas por categoría o tipo de producto</p>
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

        {/* Selector de modo y filtro */}
        <div className="bg-gray-50 px-6 py-4 border-b">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Tabs de modo */}
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button
                onClick={() => handleModoChange('categoria')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  modoComparacion === 'categoria'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Por Categoría
              </button>
              <button
                onClick={() => handleModoChange('tipo')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  modoComparacion === 'tipo'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Por Tipo de Producto
              </button>
            </div>

            {/* Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">{etiquetaSeleccion}:</label>
              {loadingOpciones ? (
                <div className="animate-pulse h-10 w-48 bg-gray-200 rounded-lg"></div>
              ) : modoComparacion === 'categoria' ? (
                <select
                  value={categoriaSeleccionada}
                  onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 min-w-48"
                >
                  {categorias.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={tipoSeleccionado}
                  onChange={(e) => setTipoSeleccionado(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 min-w-48"
                >
                  {tiposProducto.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Indicador de cantidad */}
            <div className="text-sm text-gray-500">
              {modoComparacion === 'categoria'
                ? `${categorias.length} categorías disponibles`
                : `${tiposProducto.length} tipos de producto disponibles`
              }
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : comparaciones.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No hay marcas en esta categoría
            </div>
          ) : (
            <div className="space-y-6">
              {/* Resumen de categoría */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-4">
                  <div className="text-sm opacity-80">Total Marcas</div>
                  <div className="text-3xl font-bold">{comparaciones.length}</div>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-4">
                  <div className="text-sm opacity-80">Ventas Totales</div>
                  <div className="text-2xl font-bold">{formatCurrency(totalVentas)}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-4">
                  <div className="text-sm opacity-80">Productos</div>
                  <div className="text-3xl font-bold">{totalProductos}</div>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg p-4">
                  <div className="text-sm opacity-80">Margen Promedio</div>
                  <div className="text-3xl font-bold">{formatPercent(margenPromedio || 0)}</div>
                </div>
              </div>

              {/* Gráfico de barras de participación */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Participación de Mercado</h3>
                <div className="space-y-3">
                  {comparaciones.slice(0, 10).map(comp => (
                    <div key={comp.marcaId} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${getRankingColor(comp.ranking)}`}>
                        {comp.ranking}
                      </div>
                      <div className="w-32 truncate font-medium text-gray-900">{comp.nombreMarca}</div>
                      <div className="flex-1">
                        <div className="bg-gray-200 rounded-full h-6 overflow-hidden">
                          <div
                            className={`${getParticipacionColor(comp.participacion)} h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500`}
                            style={{ width: `${Math.max(comp.participacion, 5)}%` }}
                          >
                            {comp.participacion >= 10 && (
                              <span className="text-xs text-white font-medium">
                                {formatPercent(comp.participacion)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="w-28 text-right font-semibold text-green-600">
                        {formatCurrency(comp.ventas)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabla detallada */}
              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="p-4 border-b bg-gray-50">
                  <h3 className="font-semibold text-gray-900">Detalle por Marca</h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-xs text-gray-500 uppercase">
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">Marca</th>
                      <th className="px-4 py-3 text-right">Productos</th>
                      <th className="px-4 py-3 text-right">Ventas</th>
                      <th className="px-4 py-3 text-right">Participación</th>
                      <th className="px-4 py-3 text-right">Margen</th>
                      <th className="px-4 py-3 text-center">Performance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {comparaciones.map(comp => {
                      // Calcular performance relativo
                      const performance = totalVentas > 0
                        ? (comp.ventas / (totalVentas / comparaciones.length)) * 100
                        : 0;

                      let performanceLabel = 'Promedio';
                      let performanceColor = 'bg-gray-100 text-gray-800';

                      if (performance >= 150) {
                        performanceLabel = 'Excelente';
                        performanceColor = 'bg-green-100 text-green-800';
                      } else if (performance >= 100) {
                        performanceLabel = 'Bueno';
                        performanceColor = 'bg-blue-100 text-blue-800';
                      } else if (performance < 50) {
                        performanceLabel = 'Bajo';
                        performanceColor = 'bg-red-100 text-red-800';
                      }

                      return (
                        <tr key={comp.marcaId} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${getRankingColor(comp.ranking)}`}>
                              {comp.ranking}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{comp.nombreMarca}</div>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-900">{comp.productos}</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-600">
                            {formatCurrency(comp.ventas)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`${getParticipacionColor(comp.participacion)} h-2 rounded-full`}
                                  style={{ width: `${comp.participacion}%` }}
                                />
                              </div>
                              <span className="text-gray-900">{formatPercent(comp.participacion)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={comp.margen >= 25 ? 'text-green-600' : comp.margen >= 15 ? 'text-yellow-600' : 'text-red-600'}>
                              {formatPercent(comp.margen)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 text-xs rounded-full ${performanceColor}`}>
                              {performanceLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Insights */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Insights {modoComparacion === 'categoria' ? 'de la Categoría' : 'del Tipo de Producto'}: {seleccionActual}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Líder del mercado */}
                  {comparaciones[0] && (
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-yellow-500 text-lg">🏆</span>
                        <span className="font-medium text-gray-900">Líder del Mercado</span>
                      </div>
                      <p className="text-gray-600">
                        <strong>{comparaciones[0].nombreMarca}</strong> domina con{' '}
                        <strong>{formatPercent(comparaciones[0].participacion)}</strong> de participación
                        y {formatCurrency(comparaciones[0].ventas)} en ventas.
                      </p>
                    </div>
                  )}

                  {/* Mayor margen */}
                  {comparaciones.length > 0 && (
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-green-500 text-lg">💰</span>
                        <span className="font-medium text-gray-900">Mayor Rentabilidad</span>
                      </div>
                      {(() => {
                        const mejorMargen = [...comparaciones]
                          .filter(c => c.ventas > 0)
                          .sort((a, b) => b.margen - a.margen)[0];
                        return mejorMargen ? (
                          <p className="text-gray-600">
                            <strong>{mejorMargen.nombreMarca}</strong> tiene el mejor margen
                            con <strong>{formatPercent(mejorMargen.margen)}</strong>.
                          </p>
                        ) : null;
                      })()}
                    </div>
                  )}

                  {/* Concentración */}
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-blue-500 text-lg">📊</span>
                      <span className="font-medium text-gray-900">Concentración</span>
                    </div>
                    {(() => {
                      const top3Participacion = comparaciones
                        .slice(0, 3)
                        .reduce((sum, c) => sum + c.participacion, 0);
                      return (
                        <p className="text-gray-600">
                          Las top 3 marcas concentran el <strong>{formatPercent(top3Participacion)}</strong>
                          {' '}del mercado en esta categoría.
                          {top3Participacion >= 80 ? ' Alta concentración.' :
                           top3Participacion >= 50 ? ' Concentración moderada.' :
                           ' Mercado fragmentado.'}
                        </p>
                      );
                    })()}
                  </div>

                  {/* Oportunidad */}
                  {comparaciones.length > 3 && (
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-purple-500 text-lg">💡</span>
                        <span className="font-medium text-gray-900">Oportunidad</span>
                      </div>
                      {(() => {
                        const oportunidad = comparaciones
                          .filter(c => c.margen >= 25 && c.participacion < 10)
                          .sort((a, b) => b.margen - a.margen)[0];
                        return oportunidad ? (
                          <p className="text-gray-600">
                            <strong>{oportunidad.nombreMarca}</strong> tiene alto margen ({formatPercent(oportunidad.margen)})
                            pero baja participación. Considera aumentar su visibilidad.
                          </p>
                        ) : (
                          <p className="text-gray-600">
                            No hay marcas con alto margen y baja participación para potenciar.
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
