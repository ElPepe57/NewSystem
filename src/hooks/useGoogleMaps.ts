import { useState, useEffect } from 'react';

/**
 * Hook para cargar el script de Google Maps de forma dinámica.
 * Solo carga una vez y reutiliza entre componentes.
 */

let googleMapsPromise: Promise<void> | null = null;
let isLoaded = false;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (isLoaded && window.google?.maps) {
    return Promise.resolve();
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise<void>((resolve, reject) => {
    // Check if already loaded by another means
    if (window.google?.maps) {
      isLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,visualization&language=es`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      isLoaded = true;
      resolve();
    };

    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error('Error al cargar Google Maps'));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

export interface UseGoogleMapsResult {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useGoogleMaps(): UseGoogleMapsResult {
  const [state, setState] = useState<UseGoogleMapsResult>({
    isLoaded: isLoaded && !!window.google?.maps,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (isLoaded && window.google?.maps) {
      setState({ isLoaded: true, isLoading: false, error: null });
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setState({
        isLoaded: false,
        isLoading: false,
        error: 'Falta VITE_GOOGLE_MAPS_API_KEY en el archivo .env',
      });
      return;
    }

    setState({ isLoaded: false, isLoading: true, error: null });

    loadGoogleMapsScript(apiKey)
      .then(() => {
        setState({ isLoaded: true, isLoading: false, error: null });
      })
      .catch((err) => {
        setState({ isLoaded: false, isLoading: false, error: err.message });
      });
  }, []);

  return state;
}

/**
 * Datos geográficos extraídos de Google Places (PE + US + internacional)
 */
export interface ExtractedAddressFields {
  distrito: string;
  provincia: string;
  codigoPostal: string;
  pais: string;
  paisCodigo: string;
  estado?: string;
  ciudad?: string;
}

/**
 * Extrae distrito, provincia, código postal y país de los address_components.
 * Soporta estructura de Perú (distrito/provincia) y USA (city/state/zip).
 */
export function extractAddressFields(
  components: google.maps.GeocoderAddressComponent[]
): ExtractedAddressFields {
  const country = components.find((c) => c.types.includes('country'));
  const paisCodigo = country?.short_name || '';
  const pais = country?.long_name || '';

  // Sublocality: distritos en PE (Miraflores, San Isidro), neighborhoods en US
  const sublocality = components.find((c) =>
    c.types.includes('sublocality_level_1')
  );
  // Locality: ciudad (Lima, New York, Salt Lake City)
  const locality = components.find((c) => c.types.includes('locality'));
  // Admin level 2: provincia en PE, county en US
  const admin2 = components.find((c) =>
    c.types.includes('administrative_area_level_2')
  );
  // Admin level 1: departamento en PE, state en US
  const admin1 = components.find((c) =>
    c.types.includes('administrative_area_level_1')
  );
  // Código postal
  const postalCode = components.find((c) => c.types.includes('postal_code'));

  let distrito = '';
  let provincia = '';
  let estado = '';
  let ciudad = '';

  if (paisCodigo === 'PE') {
    // Perú: distrito = sublocality, provincia = admin2
    distrito = sublocality?.long_name || locality?.long_name || '';
    provincia = admin2?.long_name || locality?.long_name || '';
  } else if (paisCodigo === 'US') {
    // USA: distrito = city (locality), provincia = state (admin1)
    distrito = locality?.long_name || sublocality?.long_name || '';
    provincia = admin1?.short_name || admin1?.long_name || '';
    estado = admin1?.long_name || '';
    ciudad = locality?.long_name || '';
  } else {
    // Internacional genérico
    distrito = locality?.long_name || sublocality?.long_name || '';
    provincia = admin1?.long_name || admin2?.long_name || '';
  }

  const codigoPostal = postalCode?.long_name || '';

  return { distrito, provincia, codigoPostal, pais, paisCodigo, estado, ciudad };
}

// Type augmentation for window
declare global {
  interface Window {
    google: typeof google;
  }
}
