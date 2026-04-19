/**
 * PlacesAutocompleteInput — input con dropdown de sugerencias de Google Places.
 *
 * Componente ligero (solo input + dropdown, sin mapa embebido). Al seleccionar
 * una predicción, devuelve dirección formateada + coordenadas + campos
 * estructurados (país, ciudad, codigoPostal, distrito).
 *
 * Úsalo cuando quieras UX estándar de autocomplete de direcciones. Si solo
 * necesitas geocoding programático desde un string, usa `useGeocoder`.
 *
 * Uso:
 *   <PlacesAutocompleteInput
 *     value={form.direccion}
 *     onChange={(text) => setForm({ ...form, direccion: text })}
 *     onPlaceSelected={(place) => {
 *       setForm({ ...form, direccion: place.direccion, ciudad: place.ciudad });
 *       setCoordenadas(place.coordenadas);
 *     }}
 *     placeholder="Buscar dirección..."
 *     locationBias="PE"  // sesga resultados a Perú
 *   />
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, Search } from 'lucide-react';
import { useGoogleMaps, extractAddressFields } from '../../hooks/useGoogleMaps';

export interface PlaceSelectedResult {
  direccion: string;          // formatted_address
  coordenadas: { lat: number; lng: number };
  placeId: string;
  pais: string;               // long_name (ej: "Perú", "United States")
  paisCodigo: string;         // short_name (ej: "PE", "US")
  ciudad: string;             // locality
  provincia: string;          // admin1 o admin2 según país
  distrito: string;           // sublocality_level_1
  codigoPostal: string;
}

interface PlacesAutocompleteInputProps {
  /** Texto visible del input (controlado) */
  value: string;
  /** Cambios de texto (mientras el usuario escribe) */
  onChange: (text: string) => void;
  /** Callback cuando el usuario selecciona una predicción */
  onPlaceSelected: (place: PlaceSelectedResult) => void;
  /** Placeholder del input */
  placeholder?: string;
  /** Clases CSS del input */
  className?: string;
  /** País(es) para sesgar resultados (ISO 3166-1 alpha-2, ej: "PE" o ["PE","US"]) */
  locationBias?: string | string[];
  /** Deshabilitado */
  disabled?: boolean;
  /** Min caracteres para disparar búsqueda (default 3) */
  minChars?: number;
  /** ms de debounce (default 300) */
  debounceMs?: number;
  /** Mostrar icono de búsqueda vs pin al inicio del input */
  iconType?: 'search' | 'pin';
}

interface Prediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
}

export const PlacesAutocompleteInput: React.FC<PlacesAutocompleteInputProps> = ({
  value,
  onChange,
  onPlaceSelected,
  placeholder = 'Buscar dirección...',
  className = '',
  locationBias,
  disabled = false,
  minChars = 3,
  debounceMs = 300,
  iconType = 'pin',
}) => {
  const { isLoaded } = useGoogleMaps();

  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFetching, setIsFetching] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Inicializar servicios cuando Google Maps esté cargado
  useEffect(() => {
    if (!isLoaded || autocompleteServiceRef.current) return;
    autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
    // PlacesService requiere un HTMLDivElement o un Map; usamos un div invisible
    const attr = document.createElement('div');
    placesServiceRef.current = new google.maps.places.PlacesService(attr);
    sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
  }, [isLoaded]);

  // Cerrar dropdown al hacer click fuera
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

  // Fetch predictions
  const fetchPredictions = useCallback(
    (input: string) => {
      if (!autocompleteServiceRef.current || input.trim().length < minChars) {
        setPredictions([]);
        setShowDropdown(false);
        return;
      }
      setIsFetching(true);

      const request: google.maps.places.AutocompletionRequest = {
        input: input.trim(),
        sessionToken: sessionTokenRef.current || undefined,
      };
      if (locationBias) {
        request.componentRestrictions = {
          country: typeof locationBias === 'string' ? locationBias : locationBias,
        };
      }

      autocompleteServiceRef.current.getPlacePredictions(request, (results, status) => {
        setIsFetching(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
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
      });
    },
    [minChars, locationBias]
  );

  // Debounced input handler
  const handleInputChange = (text: string) => {
    onChange(text);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (text.trim().length < minChars) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }
    debounceTimerRef.current = setTimeout(() => fetchPredictions(text), debounceMs);
  };

  // Select prediction → get details
  const selectPrediction = useCallback(
    (prediction: Prediction) => {
      setShowDropdown(false);
      setPredictions([]);
      setIsLoadingDetails(true);

      if (!placesServiceRef.current) {
        setIsLoadingDetails(false);
        return;
      }

      placesServiceRef.current.getDetails(
        {
          placeId: prediction.placeId,
          fields: ['formatted_address', 'geometry', 'address_components', 'place_id', 'name'],
          sessionToken: sessionTokenRef.current || undefined,
        },
        (place, status) => {
          setIsLoadingDetails(false);
          // Nuevo session token tras getDetails (billing)
          if (window.google?.maps?.places) {
            sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
          }

          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            place?.geometry?.location &&
            place.address_components
          ) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const direccion = place.formatted_address || place.name || prediction.description;
            const fields = extractAddressFields(place.address_components);

            onPlaceSelected({
              direccion,
              coordenadas: { lat, lng },
              placeId: place.place_id || prediction.placeId,
              pais: fields.pais,
              paisCodigo: fields.paisCodigo,
              ciudad: fields.ciudad || fields.distrito,
              provincia: fields.provincia,
              distrito: fields.distrito,
              codigoPostal: fields.codigoPostal,
            });
          }
        }
      );
    },
    [onPlaceSelected]
  );

  // Navegación teclado
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || predictions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectPrediction(predictions[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const Icon = iconType === 'pin' ? MapPin : Search;
  const isLoading = isFetching || isLoadingDetails;

  return (
    <div className="relative">
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (predictions.length > 0) setShowDropdown(true);
          }}
          placeholder={placeholder}
          disabled={disabled || !isLoaded}
          className={`w-full pl-9 pr-9 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-500 animate-spin" />
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-72 overflow-auto"
        >
          {predictions.map((p, i) => (
            <button
              key={p.placeId}
              type="button"
              onClick={() => selectPrediction(p)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full text-left px-3 py-2 text-sm border-b border-slate-100 last:border-b-0 transition-colors ${
                activeIndex === i ? 'bg-teal-50' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 truncate">{p.mainText}</div>
                  <div className="text-xs text-slate-500 truncate">{p.secondaryText}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
