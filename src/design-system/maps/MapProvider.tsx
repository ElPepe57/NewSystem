/**
 * MapProvider — wraps useGoogleMaps con contexto, loading y error.
 *
 * Uso:
 *   <MapProvider>
 *     <MapContainer>...</MapContainer>
 *   </MapProvider>
 */
import React, { createContext, useContext } from 'react';
import { AlertCircle, MapPin } from 'lucide-react';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';

interface MapProviderContextValue {
  isLoaded: boolean;
}

const MapProviderContext = createContext<MapProviderContextValue>({ isLoaded: false });

export function useMapProvider(): MapProviderContextValue {
  return useContext(MapProviderContext);
}

interface MapProviderProps {
  children: React.ReactNode;
  /** Contenido alternativo durante carga (default: spinner) */
  loadingFallback?: React.ReactNode;
  /** Contenido alternativo en error (default: mensaje + icono) */
  errorFallback?: (error: string) => React.ReactNode;
}

export const MapProvider: React.FC<MapProviderProps> = ({
  children,
  loadingFallback,
  errorFallback,
}) => {
  const { isLoaded, isLoading, error } = useGoogleMaps();

  if (error) {
    if (errorFallback) return <>{errorFallback(error)}</>;
    return (
      <div className="flex items-center justify-center h-full min-h-[300px] bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-red-900">Error cargando mapa</p>
          <p className="text-xs text-red-700 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading || !isLoaded) {
    if (loadingFallback) return <>{loadingFallback}</>;
    return (
      <div className="flex items-center justify-center h-full min-h-[300px] bg-slate-50 border border-slate-200 rounded-lg">
        <div className="text-center text-slate-500">
          <div className="relative inline-block">
            <MapPin className="h-8 w-8 text-teal-500 animate-pulse" />
          </div>
          <p className="text-sm mt-2">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <MapProviderContext.Provider value={{ isLoaded }}>
      {children}
    </MapProviderContext.Provider>
  );
};
