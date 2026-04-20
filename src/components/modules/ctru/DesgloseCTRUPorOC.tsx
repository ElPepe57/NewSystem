import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getById as getOrdenById } from '../../../services/ordenCompra.crud.service';
import type { OrdenCompra } from '../../../types/ordenCompra.types';
import { DesgloseCTRU } from './DesgloseCTRU';

/**
 * S42bb — Wrapper lazy que carga una OC por ID y delega al componente
 * `DesgloseCTRU`. Diseñado para usarse dentro de una fila expandida de
 * `LoteOCTable` (u otra vista que tenga solo el ID de la OC, no la OC
 * completa).
 *
 * Cache por ID: si la misma OC se re-expande, no se vuelve a fetchar.
 */
const cache = new Map<string, OrdenCompra>();

export const DesgloseCTRUPorOC: React.FC<{ ordenCompraId: string }> = ({
  ordenCompraId,
}) => {
  const [orden, setOrden] = useState<OrdenCompra | null>(
    cache.get(ordenCompraId) ?? null
  );
  const [loading, setLoading] = useState(!orden);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orden) return;
    let cancelado = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const doc = await getOrdenById(ordenCompraId);
        if (cancelado) return;
        if (!doc) {
          setError('La OC no se encontró en el sistema.');
        } else {
          cache.set(ordenCompraId, doc);
          setOrden(doc);
        }
      } catch (err) {
        if (!cancelado) setError((err as Error).message || 'Error cargando OC');
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [ordenCompraId, orden]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Cargando desglose de la OC...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-600 py-4">
        No se pudo cargar el desglose: {error}
      </div>
    );
  }

  if (!orden) return null;

  return <DesgloseCTRU orden={orden} />;
};
