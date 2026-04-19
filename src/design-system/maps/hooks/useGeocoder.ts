/**
 * useGeocoder — hook programático para convertir direcciones en coordenadas.
 *
 * Uso típico (form):
 *   const { geocode, isGeocoding, error } = useGeocoder();
 *   const coords = await geocode('Jiron Ica 3625, Lima, Peru');
 *   // coords: { lat: -12.04, lng: -77.04 } | null
 */
import { useCallback, useRef, useState } from 'react';
import { useGoogleMaps } from '../../../hooks/useGoogleMaps';
import type { LatLng } from '../types';

interface GeocoderState {
  isGeocoding: boolean;
  error: string | null;
}

export interface GeocodeResult {
  coordenadas: LatLng;
  direccionFormateada: string;
  placeId?: string;
  /** Campos estructurados extraidos (pais, ciudad, codigoPostal) */
  pais?: string;
  ciudad?: string;
  codigoPostal?: string;
}

export function useGeocoder() {
  const { isLoaded } = useGoogleMaps();
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [state, setState] = useState<GeocoderState>({ isGeocoding: false, error: null });

  const geocode = useCallback(
    async (address: string): Promise<GeocodeResult | null> => {
      if (!isLoaded) {
        setState({ isGeocoding: false, error: 'Google Maps no cargado aún' });
        return null;
      }
      if (!address.trim()) {
        return null;
      }

      if (!geocoderRef.current) {
        geocoderRef.current = new google.maps.Geocoder();
      }

      setState({ isGeocoding: true, error: null });

      try {
        const response = await geocoderRef.current.geocode({ address });
        const result = response.results?.[0];
        if (!result || !result.geometry?.location) {
          setState({ isGeocoding: false, error: 'No se encontró la dirección' });
          return null;
        }

        const lat = result.geometry.location.lat();
        const lng = result.geometry.location.lng();

        // Extraer campos del address_components
        const components = result.address_components ?? [];
        const pais = components.find((c) => c.types.includes('country'))?.long_name;
        const ciudad =
          components.find((c) => c.types.includes('locality'))?.long_name ??
          components.find((c) => c.types.includes('administrative_area_level_2'))?.long_name;
        const codigoPostal = components.find((c) => c.types.includes('postal_code'))?.long_name;

        setState({ isGeocoding: false, error: null });
        return {
          coordenadas: { lat, lng },
          direccionFormateada: result.formatted_address,
          placeId: result.place_id,
          pais,
          ciudad,
          codigoPostal,
        };
      } catch (err: any) {
        const msg = err?.message ?? 'Error geocodificando';
        setState({ isGeocoding: false, error: msg });
        return null;
      }
    },
    [isLoaded]
  );

  return { geocode, isGeocoding: state.isGeocoding, error: state.error };
}
