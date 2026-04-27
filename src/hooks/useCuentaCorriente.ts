/**
 * useCuentaCorriente — S55 · Hook reactivo para 1 CC específica
 *
 * Suscripción en tiempo real al doc de la CC. Útil en fichas de entidades
 * (ProveedorDetailView, ClienteDetailView, etc.) para mostrar saldo
 * actualizado sin recargas manuales.
 *
 * Uso:
 *   const { cc, loading, error, refresh } = useCuentaCorriente(proveedorId, 'proveedor');
 */

import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import {
  buildCuentaCorrienteId,
  type CuentaCorriente,
  type TipoEntidadCC,
} from '../types/cuentaCorriente.types';
import { cuentaCorrienteService } from '../services/cuentaCorriente.service';

interface UseCuentaCorrienteResult {
  /** La CC actual. null si no existe (entidad sin movimientos). */
  cc: CuentaCorriente | null;
  loading: boolean;
  error: string | null;
  /** Forzar recarga manual (no debería ser necesario con la suscripción). */
  refresh: () => Promise<void>;
}

export function useCuentaCorriente(
  entidadId: string | undefined | null,
  tipo: TipoEntidadCC,
): UseCuentaCorrienteResult {
  const [cc, setCC] = useState<CuentaCorriente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!entidadId) {
      setCC(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await cuentaCorrienteService.getByEntidad(entidadId, tipo);
      setCC(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando CC');
    } finally {
      setLoading(false);
    }
  }, [entidadId, tipo]);

  useEffect(() => {
    if (!entidadId) {
      setCC(null);
      setLoading(false);
      return;
    }

    const ccId = buildCuentaCorrienteId(entidadId, tipo);
    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.CUENTAS_CORRIENTES, ccId),
      (snap) => {
        if (snap.exists()) {
          setCC({ id: snap.id, ...snap.data() } as CuentaCorriente);
        } else {
          setCC(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [entidadId, tipo]);

  return { cc, loading, error, refresh };
}
