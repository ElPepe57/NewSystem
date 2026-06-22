/**
 * useEgresosPendientesSocio · F4 · alimenta la bandeja unificada de autorizaciones de socio.
 *
 * Agrega los egresos pendientes de firma de socio de los 3 módulos (requerimientos, gastos, OC)
 * reusando los servicios EXISTENTES + el helper normalizador. Devuelve la lista anotada con si el
 * usuario actual puede firmar cada uno. NOTA perf (deuda v1): hace getAll de los 3 + filtra en
 * cliente · aceptable para acceso de socio (poco frecuente) · optimizar con query targeteada luego.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { usePermissions } from './usePermissions';
import { requerimientoService } from '../services/requerimiento.service';
import { gastoService } from '../services/gasto.service';
import { getAll as getAllOC } from '../services/ordenCompra.crud.service';
import {
  type EgresoPendiente,
  requerimientoAEgreso,
  gastoAEgreso,
  ocAEgreso,
  esPendienteDeFirma,
  puedoFirmar,
} from '../services/egresosPendientesSocio.helper';

export interface EgresoPendienteConAccion extends EgresoPendiente {
  /** ¿el usuario actual puede firmar este egreso ahora? (socio · no creador · no firmó). */
  puedeFirmar: boolean;
}

export interface UseEgresosPendientesSocioResult {
  egresos: EgresoPendienteConAccion[];
  /** Cuántos puedo firmar yo (para badge / CTA). */
  count: number;
  /** Suma USD de todos los pendientes (para el KPI). */
  totalUSD: number;
  loading: boolean;
  reload: () => Promise<void>;
}

export function useEgresosPendientesSocio(): UseEgresosPendientesSocioResult {
  const user = useAuthStore((s) => s.user);
  const { isSocio } = usePermissions();
  const [egresos, setEgresos] = useState<EgresoPendienteConAccion[]>([]);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    const uid = user?.uid;
    setLoading(true);
    try {
      const [reqs, gastos, ocs] = await Promise.all([
        requerimientoService.getAll().catch(() => []),
        gastoService.getAll().catch(() => []),
        getAllOC().catch(() => []),
      ]);

      const pendientes: EgresoPendiente[] = [
        ...reqs.map(requerimientoAEgreso),
        ...gastos.map(gastoAEgreso),
        ...ocs.map(ocAEgreso),
      ].filter(esPendienteDeFirma);

      const conAccion: EgresoPendienteConAccion[] = pendientes
        .map((e) => ({ ...e, puedeFirmar: !!uid && puedoFirmar(e, uid, isSocio) }))
        // los que puedo firmar primero · luego por monto desc
        .sort((a, b) => Number(b.puedeFirmar) - Number(a.puedeFirmar) || b.montoUSD - a.montoUSD);

      setEgresos(conAccion);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, isSocio]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const count = egresos.reduce((n, e) => n + (e.puedeFirmar ? 1 : 0), 0);
  const totalUSD = egresos.reduce((s, e) => s + e.montoUSD, 0);

  return { egresos, count, totalUSD, loading, reload: cargar };
}
