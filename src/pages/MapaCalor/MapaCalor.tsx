import { useEffect } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { Button } from '../../components/common';
import { PageShell, PageHeader } from '../../design-system';
// Toolbar available for future use
import { useMapaCalorStore } from '../../store/mapaCalorStore';
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';
import { MapaCalorMapa } from './MapaCalorMapa';
import { MapaCalorFiltros } from './MapaCalorFiltros';
import { MapaCalorKPIs } from './MapaCalorKPIs';
import { MapaCalorPanelZona } from './MapaCalorPanelZona';

export function MapaCalor() {
  const { ventasGeo, kpis, loading, error, zonaSeleccionada, ventaSeleccionada, fetchVentasGeo, filtros } = useMapaCalorStore();
  const lineaFiltroGlobal = useLineaNegocioStore(s => s.lineaFiltroGlobal);

  // Cargar datos al montar y cuando cambia la línea global
  useEffect(() => {
    // Sincronizar filtro de línea global con el store del mapa
    useMapaCalorStore.setState(state => ({
      filtros: { ...state.filtros, lineaNegocioId: lineaFiltroGlobal }
    }));
    fetchVentasGeo();
  }, [lineaFiltroGlobal]);

  const hayPanel = zonaSeleccionada || ventaSeleccionada;

  return (
    <PageShell>
      {/* Header */}
      <PageHeader
        title="Mapa de Calor de Ventas"
        subtitle="Analisis geografico de ventas, ticket promedio por zona y productos por sector"
        icon={MapPin}
       
        actions={
          <Button
            variant="ghost"
            onClick={fetchVentasGeo}
            disabled={loading}
            className="text-white/70 hover:text-white hover:bg-white/10 !px-2 !py-1.5"
          >
            <RefreshCw className={`h-4 w-4 sm:mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline text-sm">Actualizar</span>
          </Button>
        }
      />

      {/* Filtros */}
      <MapaCalorFiltros />

      {/* KPIs */}
      {kpis && <MapaCalorKPIs kpis={kpis} />}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          Error al cargar datos: {error}
        </div>
      )}

      {/* Mapa + Panel lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Mapa */}
        <div className={`${hayPanel ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-lg border border-slate-200 overflow-hidden`}
          style={{ height: 'calc(100vh - 380px)', minHeight: '400px' }}
        >
          {loading && ventasGeo.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 text-teal-500 animate-spin mx-auto mb-2" />
                <p className="text-slate-500">Cargando datos geográficos...</p>
              </div>
            </div>
          ) : ventasGeo.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center px-6">
                <MapPin className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin datos geográficos</h3>
                <p className="text-sm text-slate-500 max-w-md">
                  No hay ventas con coordenadas en el periodo seleccionado.
                  Las ventas con dirección de entrega aparecerán automáticamente aquí.
                </p>
              </div>
            </div>
          ) : (
            <MapaCalorMapa />
          )}
        </div>

        {/* Panel lateral (solo si hay zona/venta seleccionada) */}
        {hayPanel && (
          <div className="lg:col-span-1">
            <MapaCalorPanelZona />
          </div>
        )}
      </div>

      {/* Tabla de zonas (siempre visible si hay datos) */}
      {ventasGeo.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-800 text-sm">Ranking de Zonas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Distrito</th>
                  <th className="px-4 py-2 text-left">Provincia</th>
                  <th className="px-4 py-2 text-right">Ventas</th>
                  <th className="px-4 py-2 text-right">Volumen</th>
                  <th className="px-4 py-2 text-right">Ticket Prom.</th>
                  <th className="px-4 py-2 text-right">Clientes</th>
                  <th className="px-4 py-2 text-left">Top Producto</th>
                </tr>
              </thead>
              <tbody>
                {useMapaCalorStore.getState().zonas.slice(0, 20).map((zona, i) => (
                  <tr
                    key={zona.key}
                    className="border-t border-slate-100 hover:bg-blue-50/50 cursor-pointer transition-colors"
                    onClick={() => useMapaCalorStore.getState().setZonaSeleccionada(zona)}
                  >
                    <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{zona.distrito}</td>
                    <td className="px-4 py-2 text-slate-600">{zona.provincia}</td>
                    <td className="px-4 py-2 text-right">{zona.totalVentas}</td>
                    <td className="px-4 py-2 text-right font-medium text-green-600">
                      S/ {zona.volumenPEN.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2 text-right">S/ {zona.ticketPromedio.toFixed(0)}</td>
                    <td className="px-4 py-2 text-right">{zona.clientesUnicos}</td>
                    <td className="px-4 py-2 text-slate-600 truncate max-w-[150px]">
                      {zona.productosTop[0]?.nombre || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageShell>
  );
}
