import React from 'react';
import { AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { useTipoCambio } from '../../hooks/useTipoCambio';

/**
 * Banner global de estado del TC — se monta en MainLayout.
 * - fresh: invisible
 * - stale: banner amarillo con advertencia
 * - expired: banner rojo con bloqueo
 */
export const TCFreshnessBanner: React.FC = () => {
  const { tc, freshness, esFallback, refetch, loading } = useTipoCambio();

  if (freshness === 'fresh' || freshness === 'unknown') return null;

  const isStale = freshness === 'stale';
  const edadTexto = tc ? (tc.edadHoras < 48
    ? `${Math.round(tc.edadHoras)}h`
    : `${Math.round(tc.edadHoras / 24)} días`) : '';

  const fechaTCTexto = tc?.fechaTC && tc.fechaTC.getTime() > 0
    ? tc.fechaTC.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'desconocida';

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm ${
        isStale
          ? 'bg-yellow-50 border-b border-yellow-200 text-yellow-800'
          : 'bg-red-50 border-b border-red-200 text-red-800'
      }`}
    >
      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
        {isStale ? (
          <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
        )}
        <span className="min-w-0">
          {isStale ? (
            <>
              TC no actualizado. Usando TC del <strong>{fechaTCTexto}</strong> ({edadTexto} de antigüedad).
              <span className="hidden sm:inline"> Las operaciones pueden continuar pero el TC puede no ser exacto.</span>
            </>
          ) : (
            <>
              TC expirado ({edadTexto} de antigüedad).
              <span className="hidden sm:inline"> Operaciones de venta y pago están bloqueadas. Actualice el TC manualmente o verifique la conexión con SUNAT.</span>
            </>
          )}
          {esFallback && (
            <span className="ml-1 font-medium">(emergencia)</span>
          )}
        </span>
      </div>
      <button
        onClick={refetch}
        disabled={loading}
        className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded text-xs font-medium shrink-0 ${
          isStale
            ? 'bg-yellow-200 hover:bg-yellow-300 text-yellow-900'
            : 'bg-red-200 hover:bg-red-300 text-red-900'
        } disabled:opacity-50`}
      >
        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        <span>Actualizar TC</span>
      </button>
    </div>
  );
};
