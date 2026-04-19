/**
 * MapKit — Helper reutilizable para mapas geográficos sobre Google Maps.
 *
 * Patrón de uso:
 *
 *   import {
 *     MapProvider, MapContainer, MarkersLayer, MapTooltip, MapLegend,
 *     type MapPoint, MAP_CENTERS, COUNTRY_COLORS,
 *   } from 'src/design-system/maps';
 *
 *   // 1. Adapter: dominio -> MapPoint<Dominio>
 *   const casillaToPoint = (c: Casilla): MapPoint<Casilla> => ({
 *     id: c.id,
 *     coordenadas: c.coordenadas!,
 *     nombre: c.nombre,
 *     categoria: c.pais,
 *     metadata: c,
 *   });
 *
 *   // 2. Render
 *   <div className="relative h-[500px]">
 *     <MapProvider>
 *       <MapContainer center={MAP_CENTERS.AMERICAS} zoom={3}>
 *         <MarkersLayer
 *           points={casillas.filter(c => c.coordenadas).map(casillaToPoint)}
 *           colorBy={(p) => COUNTRY_COLORS[p.metadata!.pais] ?? '#64748B'}
 *           renderTooltip={(p) => (
 *             <MapTooltip title={p.nombre} kpis={[
 *               { label: 'Unidades', value: p.metadata!.unidadesActuales ?? 0 },
 *             ]} />
 *           )}
 *         />
 *         <MapLegend items={[
 *           { label: 'USA', color: COUNTRY_COLORS.USA },
 *           { label: 'Perú', color: COUNTRY_COLORS.Peru },
 *         ]} />
 *       </MapContainer>
 *     </MapProvider>
 *   </div>
 */

// Core
export { MapProvider, useMapProvider } from './MapProvider';
export { MapContainer, useMapInstance, useMapBoundsRegistry } from './MapContainer';

// Layers
export { MarkersLayer } from './layers/MarkersLayer';
export { ClusterLayer } from './layers/ClusterLayer';
export { HeatmapLayer } from './layers/HeatmapLayer';

// Pieces
export { MapTooltip } from './pieces/MapTooltip';
export { MapLegend } from './pieces/MapLegend';

// Hooks
export { useGeocoder } from './hooks/useGeocoder';
export type { GeocodeResult } from './hooks/useGeocoder';

// Types + presets
export type { LatLng, MapPoint, MapRoute, LegendItem, MapInitialConfig } from './types';
export { MAP_CENTERS, COUNTRY_COLORS } from './types';
