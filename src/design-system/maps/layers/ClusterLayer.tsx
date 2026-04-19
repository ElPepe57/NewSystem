/**
 * ClusterLayer — agrupa markers en alta densidad usando @googlemaps/markerclusterer.
 * Recomendado para >50 puntos o cuando hay concentraciones geográficas.
 */
import { useEffect, useRef } from 'react';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { useMapInstance, useMapBoundsRegistry } from '../MapContainer';
import type { MapPoint } from '../types';

interface ClusterLayerProps<T = unknown> {
  points: MapPoint<T>[];
  onClick?: (p: MapPoint<T>) => void;
  layerId?: string;
}

export function ClusterLayer<T = unknown>({
  points,
  onClick,
  layerId = 'clusters',
}: ClusterLayerProps<T>) {
  const map = useMapInstance();
  const { registerBounds, unregisterBounds } = useMapBoundsRegistry();
  const clustererRef = useRef<MarkerClusterer | null>(null);

  useEffect(() => {
    if (!map) return;

    clustererRef.current?.clearMarkers();

    const markers = points.map((p) => {
      const marker = new google.maps.Marker({
        position: p.coordenadas,
        title: p.nombre,
      });
      if (onClick) marker.addListener('click', () => onClick(p));
      return marker;
    });

    clustererRef.current = new MarkerClusterer({ map, markers });

    registerBounds(
      layerId,
      points.map((p) => p.coordenadas)
    );

    return () => {
      clustererRef.current?.clearMarkers();
      clustererRef.current = null;
      unregisterBounds(layerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points]);

  return null;
}
