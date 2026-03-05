import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MapPin, Search, Navigation, Loader2, AlertCircle, Globe } from 'lucide-react';
import { useGoogleMaps, extractAddressFields } from '../../hooks/useGoogleMaps';

export interface AddressData {
  direccion: string;
  distrito: string;
  provincia: string;
  codigoPostal: string;
  referencia: string;
  coordenadas: {
    lat: number;
    lng: number;
  } | null;
  placeId?: string;
  pais?: string;
  paisCodigo?: string;
}

interface GoogleMapsAddressInputProps {
  value: AddressData;
  onChange: (data: AddressData) => void;
  /** Dirección inicial para pre-poblar (ej: de la venta) */
  initialAddress?: string;
  /** Clase CSS adicional */
  className?: string;
}

interface Prediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
}

// Lima, Perú como centro por defecto
const DEFAULT_CENTER = { lat: -12.0464, lng: -77.0428 };
const DEFAULT_ZOOM = 4;
const SELECTED_ZOOM = 16;
const DEBOUNCE_MS = 300;

// Banderitas para indicar país
const COUNTRY_FLAGS: Record<string, string> = {
  PE: '\u{1F1F5}\u{1F1EA}',
  US: '\u{1F1FA}\u{1F1F8}',
};

export const GoogleMapsAddressInput: React.FC<GoogleMapsAddressInputProps> = ({
  value,
  onChange,
  initialAddress,
  className = '',
}) => {
  const { isLoaded, isLoading, error: mapsError } = useGoogleMaps();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // Ref para tener siempre el value actual en los callbacks
  const valueRef = useRef(value);
  valueRef.current = value;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [searchText, setSearchText] = useState(value.direccion || initialAddress || '');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState<string>(value.paisCodigo || '');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFetching, setIsFetching] = useState(false);

  // Crear nuevo session token (agrupa requests para billing)
  const newSessionToken = useCallback(() => {
    if (window.google?.maps?.places) {
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }
  }, []);

  const addMarker = useCallback((position: { lat: number; lng: number }) => {
    if (!mapRef.current) return;

    if (markerRef.current) {
      if ('setMap' in markerRef.current) {
        (markerRef.current as google.maps.Marker).setMap(null);
      }
    }

    const marker = new google.maps.Marker({
      position,
      map: mapRef.current,
      draggable: true,
      animation: google.maps.Animation.DROP,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#ef4444',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 3,
      },
    });

    marker.addListener('dragend', () => {
      const pos = marker.getPosition();
      if (pos) {
        const coords = { lat: pos.lat(), lng: pos.lng() };
        reverseGeocode(coords);
      }
    });

    markerRef.current = marker;
  }, []);

  const applyPlaceResult = useCallback(
    (
      direccion: string,
      coords: { lat: number; lng: number },
      components: google.maps.GeocoderAddressComponent[],
      placeId?: string
    ) => {
      const fields = extractAddressFields(components);
      setSearchText(direccion);
      setDetectedCountry(fields.paisCodigo);

      if (mapRef.current) {
        mapRef.current.setCenter(coords);
        mapRef.current.setZoom(SELECTED_ZOOM);
      }
      addMarker(coords);

      onChangeRef.current({
        ...valueRef.current,
        direccion,
        distrito: fields.distrito,
        provincia: fields.provincia,
        codigoPostal: fields.codigoPostal,
        coordenadas: coords,
        placeId,
        pais: fields.pais,
        paisCodigo: fields.paisCodigo,
      });
    },
    [addMarker]
  );

  const reverseGeocode = useCallback(
    (coords: { lat: number; lng: number }) => {
      if (!geocoderRef.current) return;

      setIsGeocoding(true);

      geocoderRef.current.geocode({ location: coords }, (results, status) => {
        setIsGeocoding(false);

        if (status === 'OK' && results && results[0]) {
          const result = results[0];
          applyPlaceResult(
            result.formatted_address,
            coords,
            result.address_components,
            result.place_id
          );
        } else {
          onChangeRef.current({
            ...valueRef.current,
            coordenadas: coords,
          });
        }
      });
    },
    [applyPlaceResult]
  );

  const geocodeAddress = useCallback(
    (address: string) => {
      if (!geocoderRef.current) return;

      setIsGeocoding(true);

      geocoderRef.current.geocode({ address }, (results, status) => {
        setIsGeocoding(false);

        if (status === 'OK' && results && results[0]) {
          const result = results[0];
          const lat = result.geometry.location.lat();
          const lng = result.geometry.location.lng();
          applyPlaceResult(
            result.formatted_address,
            { lat, lng },
            result.address_components,
            result.place_id
          );
        }
      });
    },
    [applyPlaceResult]
  );

  // Fetch predictions usando AutocompleteService
  const fetchPredictions = useCallback(
    (input: string) => {
      if (!autocompleteServiceRef.current || input.trim().length < 3) {
        setPredictions([]);
        setShowDropdown(false);
        return;
      }

      setIsFetching(true);

      const request: google.maps.places.AutocompletionRequest = {
        input: input.trim(),
        sessionToken: sessionTokenRef.current || undefined,
      };

      // Si el mapa tiene bounds, usarlos como bias
      if (mapRef.current) {
        const bounds = mapRef.current.getBounds();
        if (bounds) {
          request.locationBias = bounds;
        }
      }

      autocompleteServiceRef.current.getPlacePredictions(
        request,
        (results, status) => {
          setIsFetching(false);

          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            results &&
            results.length > 0
          ) {
            setPredictions(
              results.slice(0, 5).map((r) => ({
                placeId: r.place_id,
                mainText: r.structured_formatting.main_text,
                secondaryText: r.structured_formatting.secondary_text || '',
                description: r.description,
              }))
            );
            setShowDropdown(true);
            setActiveIndex(-1);
          } else {
            setPredictions([]);
            setShowDropdown(false);
          }
        }
      );
    },
    []
  );

  // Select a prediction → get place details
  const selectPrediction = useCallback(
    (prediction: Prediction) => {
      setShowDropdown(false);
      setPredictions([]);
      setSearchText(prediction.description);
      setIsGeocoding(true);

      if (placesServiceRef.current) {
        placesServiceRef.current.getDetails(
          {
            placeId: prediction.placeId,
            fields: ['formatted_address', 'geometry', 'address_components', 'place_id', 'name'],
            sessionToken: sessionTokenRef.current || undefined,
          },
          (place, status) => {
            setIsGeocoding(false);
            // Iniciar nuevo session token tras getDetails
            newSessionToken();

            if (
              status === google.maps.places.PlacesServiceStatus.OK &&
              place?.geometry?.location
            ) {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              const direccion = place.formatted_address || place.name || prediction.description;

              applyPlaceResult(
                direccion,
                { lat, lng },
                place.address_components || [],
                place.place_id
              );
            } else {
              // Fallback: geocode the description
              geocodeAddress(prediction.description);
            }
          }
        );
      } else {
        // Fallback sin PlacesService
        geocodeAddress(prediction.description);
      }
    },
    [applyPlaceResult, geocodeAddress, newSessionToken]
  );

  // Debounced input handler
  const handleInputChange = useCallback(
    (text: string) => {
      setSearchText(text);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (text.trim().length < 3) {
        setPredictions([]);
        setShowDropdown(false);
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        fetchPredictions(text);
      }, DEBOUNCE_MS);
    },
    [fetchPredictions]
  );

  // Inicializar mapa y servicios
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapRef.current) return;

    const map = new google.maps.Map(mapContainerRef.current, {
      center: value.coordenadas || DEFAULT_CENTER,
      zoom: value.coordenadas ? SELECTED_ZOOM : DEFAULT_ZOOM,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });
    mapRef.current = map;

    geocoderRef.current = new google.maps.Geocoder();
    autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
    placesServiceRef.current = new google.maps.places.PlacesService(map);
    newSessionToken();

    if (value.coordenadas) {
      addMarker(value.coordenadas);
    }

    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const coords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      addMarker(coords);
      reverseGeocode(coords);
    });

    if (initialAddress && !value.coordenadas) {
      geocodeAddress(initialAddress);
    }

    return () => {
      if (markerRef.current) {
        if ('setMap' in markerRef.current) {
          (markerRef.current as google.maps.Marker).setMap(null);
        }
      }
    };
  }, [isLoaded]);

  // Cerrar dropdown cuando se hace click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (showDropdown && predictions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev < predictions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : predictions.length - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < predictions.length) {
          selectPrediction(predictions[activeIndex]);
        } else {
          // Enter sin seleccionar → geocode directo
          setShowDropdown(false);
          geocodeAddress(searchText.trim());
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
        return;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchText.trim().length > 2) {
        geocodeAddress(searchText.trim());
      }
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        if (mapRef.current) {
          mapRef.current.setCenter(coords);
          mapRef.current.setZoom(SELECTED_ZOOM);
        }
        addMarker(coords);
        reverseGeocode(coords);
      },
      (err) => {
        console.warn('Error obteniendo ubicación:', err.message);
      }
    );
  };

  // Labels dinámicos según país detectado
  const isUSA = detectedCountry === 'US';
  const labels = {
    distrito: isUSA ? 'Ciudad (City)' : 'Distrito',
    provincia: isUSA ? 'Estado (State)' : 'Provincia',
    codigoPostal: isUSA ? 'ZIP Code' : 'Código Postal',
    distritoPlaceholder: isUSA ? 'Salt Lake City' : 'Miraflores',
    provinciaPlaceholder: isUSA ? 'UT' : 'Lima',
    codigoPostalPlaceholder: isUSA ? '84081' : '15001',
  };

  const countryFlag = COUNTRY_FLAGS[detectedCountry] || '';

  if (mapsError) {
    return (
      <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-amber-600 mb-2">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm font-medium">Google Maps no disponible</span>
        </div>
        <p className="text-xs text-gray-500">{mapsError}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Buscador con dropdown custom */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <MapPin className="h-4 w-4 inline mr-1" />
          Buscar Dirección
          {countryFlag && (
            <span className="ml-2 text-base" title={value.pais}>{countryFlag}</span>
          )}
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
            {isGeocoding || isFetching ? (
              <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
            ) : (
              <Search className="h-5 w-5 text-gray-400" />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={searchText}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => {
              if (predictions.length > 0) setShowDropdown(true);
            }}
            placeholder="Busca dirección, ciudad o lugar (PE, US, etc.)..."
            className="block w-full rounded-lg border border-gray-300 pl-10 pr-10 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            disabled={isLoading}
            autoComplete="off"
          />

          <button
            type="button"
            onClick={handleUseCurrentLocation}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-primary-600 transition-colors z-10"
            title="Usar mi ubicación actual"
          >
            <Navigation className="h-4 w-4" />
          </button>

          {/* Dropdown de predicciones */}
          {showDropdown && predictions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-50 overflow-hidden"
            >
              {predictions.map((prediction, index) => (
                <button
                  key={prediction.placeId}
                  type="button"
                  className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors border-b border-gray-50 last:border-b-0 ${
                    index === activeIndex
                      ? 'bg-primary-50 text-primary-900'
                      : 'hover:bg-gray-50 text-gray-900'
                  }`}
                  onClick={() => selectPrediction(prediction)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {prediction.mainText}
                    </div>
                    {prediction.secondaryText && (
                      <div className="text-xs text-gray-500 truncate">
                        {prediction.secondaryText}
                      </div>
                    )}
                  </div>
                </button>
              ))}
              <div className="px-3 py-1.5 text-[10px] text-gray-300 text-right">
                powered by Google
              </div>
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
          <Globe className="h-3 w-3" />
          Escribe, pega o haz clic en el mapa para seleccionar
        </p>
      </div>

      {/* Mapa */}
      <div className="relative rounded-lg overflow-hidden border border-gray-200">
        {isLoading && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Cargando mapa...</span>
            </div>
          </div>
        )}
        <div
          ref={mapContainerRef}
          className="w-full h-[220px]"
          style={{ minHeight: '220px' }}
        />
      </div>

      {/* Coordenadas + país detectado */}
      {value.coordenadas && (
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3" />
            <span>
              {value.coordenadas.lat.toFixed(6)}, {value.coordenadas.lng.toFixed(6)}
            </span>
          </div>
          {value.pais && (
            <span className="text-gray-500 font-medium">
              {countryFlag} {value.pais}
            </span>
          )}
        </div>
      )}

      {/* Campos de dirección auto-llenados (editables) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dirección de Entrega *
          </label>
          <input
            type="text"
            value={value.direccion}
            onChange={(e) => onChange({ ...value, direccion: e.target.value })}
            placeholder="Av. Principal 123, Dpto 401"
            required
            className="block w-full rounded-lg border border-gray-300 pl-3 pr-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {labels.distrito}
          </label>
          <input
            type="text"
            value={value.distrito}
            onChange={(e) => onChange({ ...value, distrito: e.target.value })}
            placeholder={labels.distritoPlaceholder}
            className="block w-full rounded-lg border border-gray-300 pl-3 pr-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {labels.provincia}
          </label>
          <input
            type="text"
            value={value.provincia}
            onChange={(e) => onChange({ ...value, provincia: e.target.value })}
            placeholder={labels.provinciaPlaceholder}
            className="block w-full rounded-lg border border-gray-300 pl-3 pr-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {labels.codigoPostal}
          </label>
          <input
            type="text"
            value={value.codigoPostal}
            onChange={(e) => onChange({ ...value, codigoPostal: e.target.value })}
            placeholder={labels.codigoPostalPlaceholder}
            className="block w-full rounded-lg border border-gray-300 pl-3 pr-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Referencia
          </label>
          <input
            type="text"
            value={value.referencia}
            onChange={(e) => onChange({ ...value, referencia: e.target.value })}
            placeholder="Frente al parque, edificio azul"
            className="block w-full rounded-lg border border-gray-300 pl-3 pr-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>
      </div>
    </div>
  );
};

export default GoogleMapsAddressInput;
