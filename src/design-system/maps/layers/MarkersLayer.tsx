/**
 * MarkersLayer — renderiza puntos con color configurable + popup al click.
 *
 * Uso:
 *   <MarkersLayer
 *     points={casillasGeo}
 *     colorBy={(p) => COUNTRY_COLORS[p.categoria ?? '']}
 *     onClick={(p) => setSelected(p)}
 *     renderTooltip={(p) => <MapTooltip title={p.nombre} kpis={[...]} />}
 *   />
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useMapInstance, useMapBoundsRegistry } from '../MapContainer';
import type { MapPoint } from '../types';

interface MarkersLayerProps<T = unknown> {
  points: MapPoint<T>[];
  /** Derivar color hex por punto. Default: #14B8A6 (teal-500) */
  colorBy?: (p: MapPoint<T>) => string;
  /** Escala del punto (8 por defecto). Puede derivarse de `peso`. */
  scaleBy?: (p: MapPoint<T>) => number;
  /** Handler al hacer click en un punto */
  onClick?: (p: MapPoint<T>) => void;
  /** Tooltip InfoWindow al click. Si no se pasa, el click solo dispara onClick. */
  renderTooltip?: (p: MapPoint<T>) => React.ReactNode;
  /** Identificador estable (útil para unregister en unmount). Default: 'markers' */
  layerId?: string;
}

export function MarkersLayer<T = unknown>({
  points,
  colorBy,
  scaleBy,
  onClick,
  renderTooltip,
  layerId = 'markers',
}: MarkersLayerProps<T>) {
  const map = useMapInstance();
  const { registerBounds, unregisterBounds } = useMapBoundsRegistry();
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const tooltipRootRef = useRef<Root | null>(null);

  // Memoizar derivaciones para referencias estables
  const derived = useMemo(() => {
    return points.map((p) => ({
      point: p,
      color: colorBy?.(p) ?? '#14B8A6',
      scale: scaleBy?.(p) ?? 8,
    }));
  }, [points, colorBy, scaleBy]);

  // Render markers cuando cambian puntos o mapa
  useEffect(() => {
    if (!map) return;

    // Limpiar markers anteriores
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Crear info window lazy (una por layer)
    if (!infoWindowRef.current && renderTooltip) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }

    derived.forEach(({ point, color, scale }) => {
      const marker = new google.maps.Marker({
        position: point.coordenadas,
        map,
        title: point.nombre,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale,
        },
      });

      marker.addListener('click', () => {
        onClick?.(point);
        if (renderTooltip && infoWindowRef.current) {
          // Render tooltip React → HTML
          const container = document.createElement('div');
          if (tooltipRootRef.current) tooltipRootRef.current.unmount();
          tooltipRootRef.current = createRoot(container);
          tooltipRootRef.current.render(<>{renderTooltip(point)}</>);
          infoWindowRef.current.setContent(container);
          infoWindowRef.current.open({ map, anchor: marker });
        }
      });

      markersRef.current.push(marker);
    });

    // Registrar bounds para autoFit global
    registerBounds(
      layerId,
      derived.map((d) => d.point.coordenadas)
    );

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      unregisterBounds(layerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, derived]);

  // Cleanup del tooltip al unmount
  useEffect(() => {
    return () => {
      if (tooltipRootRef.current) {
        // Defer unmount para evitar warnings de react durante cleanup
        setTimeout(() => tooltipRootRef.current?.unmount(), 0);
      }
      infoWindowRef.current?.close();
      infoWindowRef.current = null;
    };
  }, []);

  return null;
}
