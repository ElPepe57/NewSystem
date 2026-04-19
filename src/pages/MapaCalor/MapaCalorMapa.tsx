/**
 * MapaCalorMapa — vista de mapa para /mapa-ventas.
 * S42d: migrado al MapKit (src/design-system/maps). Reduce 172 → ~80 líneas.
 */
import { useMemo } from 'react';
import {
  MapProvider,
  MapContainer,
  MarkersLayer,
  ClusterLayer,
  HeatmapLayer,
  MapTooltip,
  MAP_CENTERS,
  type MapPoint,
} from '../../design-system/maps';
import { useMapaCalorStore } from '../../store/mapaCalorStore';
import type { VentaGeo } from '../../types/mapaCalor.types';

const LINEA_COLORS: Record<string, string> = {
  'Z50CnuaBdD5x0w7XGRv8': '#10B981', // Suplementos — verde
  'mrwyh6hvHEAPMzLOzgFS': '#8B5CF6', // Skincare — morado
};
const DEFAULT_COLOR = '#F59E0B'; // Dorado para mixto/otro

export function MapaCalorMapa() {
  const { ventasGeo, capaActiva, setVentaSeleccionada } = useMapaCalorStore();

  // Adapter: VentaGeo -> MapPoint
  const puntos = useMemo<MapPoint<VentaGeo>[]>(
    () =>
      ventasGeo.map((v) => ({
        id: v.id,
        coordenadas: v.coordenadas,
        nombre: `${v.codigo} — S/ ${v.totalPEN.toFixed(2)}`,
        categoria: v.lineaNegocioId,
        peso: v.totalPEN, // para heatmap weight
        metadata: v,
      })),
    [ventasGeo]
  );

  return (
    <MapProvider>
      <MapContainer
        center={MAP_CENTERS.PERU}
        zoom={6}
        mapId="mapa-calor-ventas"
        autoFit
        minHeight="400px"
      >
        {capaActiva === 'heatmap' && <HeatmapLayer points={puntos} />}
        {capaActiva === 'clusters' && (
          <ClusterLayer points={puntos} onClick={(p) => setVentaSeleccionada(p.metadata!)} />
        )}
        {capaActiva === 'marcadores' && (
          <MarkersLayer<VentaGeo>
            points={puntos}
            colorBy={(p) => LINEA_COLORS[p.categoria ?? ''] ?? DEFAULT_COLOR}
            onClick={(p) => setVentaSeleccionada(p.metadata!)}
            renderTooltip={(p) => {
              const v = p.metadata!;
              return (
                <MapTooltip
                  title={v.codigo}
                  subtitle={v.distrito ? `${v.distrito}${v.provincia ? `, ${v.provincia}` : ''}` : undefined}
                  kpis={[
                    { label: 'Total', value: `S/ ${v.totalPEN.toFixed(2)}` },
                    { label: 'Cliente', value: v.clienteNombre ?? '—' },
                    { label: 'Productos', value: v.productos.length },
                  ]}
                />
              );
            }}
          />
        )}
      </MapContainer>
    </MapProvider>
  );
}
