import { useEffect } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { Button } from '../../components/common';
import { PageShell, PageHeader, DataTable } from '../../design-system';
import type { DataTableColumn } from '../../design-system';
// Toolbar available for future use
import { useMapaCalorStore } from '../../store/mapaCalorStore';
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';
import type { ZonaResumen } from '../../types/mapaCalor.types';
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
            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 !px-2 !py-1.5"
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
      {ventasGeo.length > 0 && (() => {
        const zonasTop = useMapaCalorStore.getState().zonas.slice(0, 20);
        const zonaColumns: DataTableColumn<ZonaResumen & { rank: number }>[] = [
          {
            key: 'rank',
            header: '#',
            render: z => <span className="text-slate-400">{z.rank}</span>,
          },
          {
            key: 'distrito',
            header: 'Distrito',
            render: z => <span className="font-medium text-slate-900">{z.distrito}</span>,
          },
          {
            key: 'provincia',
            header: 'Provincia',
            render: z => <span className="text-slate-600">{z.provincia}</span>,
            hideOnMobile: true,
          },
          {
            key: 'totalVentas',
            header: 'Ventas',
            align: 'right',
            render: z => <span>{z.totalVentas}</span>,
          },
          {
            key: 'volumenPEN',
            header: 'Volumen',
            align: 'right',
            render: z => (
              <span className="font-medium text-emerald-600">
                S/ {z.volumenPEN.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
              </span>
            ),
          },
          {
            key: 'ticketPromedio',
            header: 'Ticket Prom.',
            align: 'right',
            render: z => <span>S/ {z.ticketPromedio.toFixed(0)}</span>,
            hideOnMobile: true,
          },
          {
            key: 'clientesUnicos',
            header: 'Clientes',
            align: 'right',
            render: z => <span>{z.clientesUnicos}</span>,
            hideOnMobile: true,
          },
          {
            key: 'topProducto',
            header: 'Top Producto',
            render: z => (
              <span className="text-slate-600 truncate block max-w-[150px]">
                {z.productosTop[0]?.nombre || '—'}
              </span>
            ),
            hideOnMobile: true,
          },
        ];
        const zonasConRank = zonasTop.map((z, i) => ({ ...z, rank: i + 1 }));
        return (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-800 text-sm">Ranking de Zonas</h3>
            </div>
            <DataTable
              columns={zonaColumns}
              data={zonasConRank}
              keyExtractor={z => z.key}
              onRowClick={z => useMapaCalorStore.getState().setZonaSeleccionada(z)}
              compact
            />
          </div>
        );
      })()}
    </PageShell>
  );
}
