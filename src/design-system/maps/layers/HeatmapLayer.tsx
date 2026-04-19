/**
 * HeatmapLayer — mapa de calor ponderado.
 * Requiere libraries=visualization (ya incluido en useGoogleMaps).
 */
import { useEffect, useRef } from 'react';
import { useMapInstance, useMapBoundsRegistry } from '../MapContainer';
import type { MapPoint } from '../types';

interface HeatmapLayerProps<T = unknown> {
  points: MapPoint<T>[];
  /** Radio del calor en px. Default 30 */
  radius?: number;
  /** Opacidad 0-1. Default 0.7 */
  opacity?: number;
  /** Gradient custom. Default: azul→verde→amarillo→rojo */
  gradient?: string[];
  layerId?: string;
}

const DEFAULT_GRADIENT = [
  'rgba(0, 0, 0, 0)',
  'rgba(0, 0, 255, 0.3)',
  'rgba(0, 255, 255, 0.5)',
  'rgba(0, 255, 0, 0.7)',
  'rgba(255, 255, 0, 0.8)',
  'rgba(255, 165, 0, 0.9)',
  'rgba(255, 0, 0, 1)',
];

export function HeatmapLayer<T = unknown>({
  points,
  radius = 30,
  opacity = 0.7,
  gradient = DEFAULT_GRADIENT,
  layerId = 'heatmap',
}: HeatmapLayerProps<T>) {
  const map = useMapInstance();
  const { registerBounds, unregisterBounds } = useMapBoundsRegistry();
  const layerRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);

  useEffect(() => {
    if (!map) return;

    layerRef.current?.setMap(null);

    // Normalizar peso (si no existe, todos iguales)
    const pesos = points.map((p) => p.peso ?? 1);
    const promedio = pesos.reduce((s, w) => s + w, 0) / pesos.length || 1;

    const data = points.map((p) => ({
      location: new google.maps.LatLng(p.coordenadas.lat, p.coordenadas.lng),
      weight: Math.max((p.peso ?? 1) / promedio, 0.1),
    }));

    layerRef.current = new google.maps.visualization.HeatmapLayer({
      data,
      map,
      radius,
      opacity,
      gradient,
    });

    registerBounds(
      layerId,
      points.map((p) => p.coordenadas)
    );

    return () => {
      layerRef.current?.setMap(null);
      layerRef.current = null;
      unregisterBounds(layerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points, radius, opacity]);

  return null;
}
