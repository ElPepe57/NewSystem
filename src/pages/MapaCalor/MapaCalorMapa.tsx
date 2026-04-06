import { useEffect, useRef, useCallback } from 'react';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { useMapaCalorStore } from '../../store/mapaCalorStore';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import type { VentaGeo, CapaMapa } from '../../types/mapaCalor.types';

// Perú completo como vista default
const DEFAULT_CENTER = { lat: -9.19, lng: -75.0152 };
const DEFAULT_ZOOM = 6;

const LINEA_COLORS: Record<string, string> = {
  'Z50CnuaBdD5x0w7XGRv8': '#10B981', // Suplementos — verde
  'mrwyh6hvHEAPMzLOzgFS': '#8B5CF6', // Skincare — morado
};
const DEFAULT_COLOR = '#F59E0B'; // Dorado para mixto/otro

export function MapaCalorMapa() {
  const { isLoaded } = useGoogleMaps();
  const { ventasGeo, capaActiva, zonas, setZonaSeleccionada, setVentaSeleccionada } = useMapaCalorStore();

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  // Inicializar mapa
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return;

    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      mapId: 'mapa-calor-ventas',
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: 'greedy',
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] }
      ]
    });
  }, [isLoaded]);

  // Limpiar capas
  const clearLayers = useCallback(() => {
    heatmapRef.current?.setMap(null);
    heatmapRef.current = null;

    clustererRef.current?.clearMarkers();
    clustererRef.current = null;

    markersRef.current.forEach(m => (m as any).map = null);
    markersRef.current = [];
  }, []);

  // Renderizar capa activa
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isLoaded) return;

    clearLayers();

    if (ventasGeo.length === 0) return;

    // Auto-fit bounds
    const bounds = new google.maps.LatLngBounds();
    ventasGeo.forEach(v => bounds.extend(v.coordenadas));
    map.fitBounds(bounds, 50);

    switch (capaActiva) {
      case 'heatmap':
        renderHeatmap(map, ventasGeo);
        break;
      case 'clusters':
        renderClusters(map, ventasGeo);
        break;
      case 'marcadores':
        renderMarcadores(map, ventasGeo);
        break;
    }
  }, [ventasGeo, capaActiva, isLoaded, clearLayers]);

  // === HEATMAP ===
  const renderHeatmap = (map: google.maps.Map, ventas: VentaGeo[]) => {
    const ticketPromedio = ventas.reduce((s, v) => s + v.totalPEN, 0) / ventas.length || 1;

    const data = ventas.map(v => ({
      location: new google.maps.LatLng(v.coordenadas.lat, v.coordenadas.lng),
      weight: Math.max(v.totalPEN / ticketPromedio, 0.1)
    }));

    heatmapRef.current = new google.maps.visualization.HeatmapLayer({
      data,
      map,
      radius: 30,
      opacity: 0.7,
      gradient: [
        'rgba(0, 0, 0, 0)',
        'rgba(0, 0, 255, 0.3)',
        'rgba(0, 255, 255, 0.5)',
        'rgba(0, 255, 0, 0.7)',
        'rgba(255, 255, 0, 0.8)',
        'rgba(255, 165, 0, 0.9)',
        'rgba(255, 0, 0, 1)'
      ]
    });
  };

  // === CLUSTERS ===
  const renderClusters = (map: google.maps.Map, ventas: VentaGeo[]) => {
    const markers = ventas.map(v => {
      const marker = new google.maps.Marker({
        position: v.coordenadas,
        title: `${v.codigo} — S/ ${v.totalPEN.toFixed(2)}`
      });
      marker.addListener('click', () => setVentaSeleccionada(v));
      return marker;
    });

    clustererRef.current = new MarkerClusterer({
      map,
      markers,
    });
  };

  // === MARCADORES INDIVIDUALES ===
  const renderMarcadores = (map: google.maps.Map, ventas: VentaGeo[]) => {
    ventas.forEach(v => {
      const color = LINEA_COLORS[v.lineaNegocioId] || DEFAULT_COLOR;

      const marker = new google.maps.Marker({
        position: v.coordenadas,
        map,
        title: `${v.codigo} — S/ ${v.totalPEN.toFixed(2)}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 0.85,
          strokeColor: '#fff',
          strokeWeight: 2,
          scale: 8,
        }
      });

      marker.addListener('click', () => setVentaSeleccionada(v));
      markersRef.current.push(marker as any);
    });
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <div className="text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2" />
          <p className="text-sm">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-lg"
      style={{ minHeight: '400px' }}
    />
  );
}
