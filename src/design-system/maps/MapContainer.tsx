/**
 * MapContainer — base del mapa. Crea google.maps.Map, expone via contexto a Layers.
 *
 * Uso:
 *   <MapProvider>
 *     <MapContainer defaultCenter={...} defaultZoom={...}>
 *       <MarkersLayer points={...} />
 *     </MapContainer>
 *   </MapProvider>
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useMapProvider } from './MapProvider';
import type { LatLng, MapInitialConfig } from './types';
import { MAP_CENTERS } from './types';

interface MapContextValue {
  map: google.maps.Map | null;
  /** Publica points agregados por layers hijos (para autoFit global) */
  registerBounds: (id: string, points: LatLng[]) => void;
  unregisterBounds: (id: string) => void;
}

const MapContext = createContext<MapContextValue>({
  map: null,
  registerBounds: () => {},
  unregisterBounds: () => {},
});

export function useMapInstance(): google.maps.Map | null {
  return useContext(MapContext).map;
}

export function useMapBoundsRegistry() {
  const { registerBounds, unregisterBounds } = useContext(MapContext);
  return { registerBounds, unregisterBounds };
}

interface MapContainerProps extends MapInitialConfig {
  children?: React.ReactNode;
  className?: string;
  /** mapId para Advanced Markers. Default: 'mapkit-default' */
  mapId?: string;
}

export const MapContainer: React.FC<MapContainerProps> = ({
  children,
  className,
  center = MAP_CENTERS.PERU,
  zoom = 6,
  autoFit = true,
  autoFitPadding = 50,
  minHeight = '400px',
  cleanStyles = true,
  mapId = 'mapkit-default',
}) => {
  const { isLoaded } = useMapProvider();
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const boundsRegistryRef = useRef<Map<string, LatLng[]>>(new Map());

  // Inicialización — una sola vez por lifecycle
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstance) return;
    const newMap = new google.maps.Map(mapRef.current, {
      center,
      zoom,
      mapId,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: 'greedy',
      styles: cleanStyles
        ? [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          ]
        : undefined,
    });
    setMapInstance(newMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // Helpers de registro (bounds agregados)
  const registerBounds = (id: string, points: LatLng[]) => {
    boundsRegistryRef.current.set(id, points);
    if (autoFit && mapInstance) applyAutoFit();
  };

  const unregisterBounds = (id: string) => {
    boundsRegistryRef.current.delete(id);
    if (autoFit && mapInstance) applyAutoFit();
  };

  const applyAutoFit = () => {
    if (!mapInstance) return;
    const all: LatLng[] = [];
    boundsRegistryRef.current.forEach((pts) => all.push(...pts));
    if (all.length === 0) return;
    if (all.length === 1) {
      mapInstance.setCenter(all[0]);
      mapInstance.setZoom(12);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    all.forEach((p) => bounds.extend(p));
    mapInstance.fitBounds(bounds, autoFitPadding);
  };

  if (!isLoaded) return null;

  return (
    <MapContext.Provider value={{ map: mapInstance, registerBounds, unregisterBounds }}>
      <div
        ref={mapRef}
        className={className ?? 'w-full h-full rounded-lg'}
        style={{ minHeight }}
      />
      {mapInstance && children}
    </MapContext.Provider>
  );
};
