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
import { gastoService } from '../services/gasto.service';
import { getAll as getAllOC } from '../services/ordenCompra.crud.service';
import { getAllRetirosCapital } from '../services/tesoreria.capital.service';
import { envioCrudService } from '../services/envio.crud.service';
import { devolucionService } from '../services/devolucion.service';
import {
  type EgresoPendiente,
  gastoAEgreso,
  ocAEgreso,
  retiroAEgreso,
  envioAEgreso,
  devolucionAEgreso,
  esPendienteDeFirma,
  puedoFirmar,
  firmadoPorMi,
} from '../services/egresosPendientesSocio.helper';
import { requiereAutorizacionSocio, type SocioEquity } from '../services/autorizacionEgreso.helper';
import { socioService } from '../services/socio.service';
import { delegacionAutorizacionService } from '../services/delegacionAutorizacion.service';

export interface EgresoPendienteConAccion extends EgresoPendiente {
  /** ¿el usuario actual puede firmar este egreso ahora? (socio · no creador · no firmó). */
  puedeFirmar: boolean;
}

export interface UseEgresosPendientesSocioResult {
  egresos: EgresoPendienteConAccion[];
  /** F4 · "Mis aprobaciones dadas": egresos donde YA firmé (completos o esperando 2º socio). */
  dadas: EgresoPendiente[];
  /** Cuántos puedo firmar yo (para badge / CTA). */
  count: number;
  /** Suma USD de todos los pendientes (para el KPI). */
  totalUSD: number;
  /** Socios con su % de participación (para el progreso por equity de cada egreso · `chipFirma`). */
  socios: SocioEquity[];
  loading: boolean;
  reload: () => Promise<void>;
}

export function useEgresosPendientesSocio(): UseEgresosPendientesSocioResult {
  const user = useAuthStore((s) => s.user);
  const { isSocio, roles } = usePermissions();
  const [egresos, setEgresos] = useState<EgresoPendienteConAccion[]>([]);
  const [dadas, setDadas] = useState<EgresoPendiente[]>([]);
  const [socios, setSocios] = useState<SocioEquity[]>([]);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    const uid = user?.uid;
    setLoading(true);
    try {
      // F2 · la bandeja de SOCIO solo agrega gasto + OC (quórum de equity). El requerimiento es
      // autoridad de CARGO (se aprueba en su módulo · decisión 2026-06-22) · NO en la bandeja de socio.
      const [gastos, ocs, retiros, envios, devoluciones, sociosRaw] = await Promise.all([
        gastoService.getAll().catch(() => []),
        getAllOC().catch(() => []),
        getAllRetirosCapital().catch(() => []),
        envioCrudService.getAll().catch(() => []),
        devolucionService.getAll().catch(() => []),
        socioService.getAll().catch(() => []),
      ]);
      const sociosEquity: SocioEquity[] = sociosRaw.map((s) => ({ uid: s.id, participacion: s.porcentajeParticipacion }));

      // F4 · autoridad efectiva = socio O delegado vigente (el delegado entra al pool de firmantes).
      const esSocioODelegado = isSocio || (!!uid && (await delegacionAutorizacionService.tieneAutoridadDelegada(uid, roles).catch(() => false)));

      // Todos los egresos que requieren socio (pendientes o ya firmados).
      const todos: EgresoPendiente[] = [
        ...gastos.map(gastoAEgreso),
        ...ocs.map(ocAEgreso),
        ...retiros.map(retiroAEgreso),
        ...envios.map(envioAEgreso),
        ...devoluciones.map(devolucionAEgreso),
      ].filter((e) => requiereAutorizacionSocio(e.montoUSD));

      const conAccion: EgresoPendienteConAccion[] = todos
        .filter(esPendienteDeFirma)
        .map((e) => ({ ...e, puedeFirmar: !!uid && puedoFirmar(e, uid, esSocioODelegado) }))
        // los que puedo firmar primero · luego por monto desc
        .sort((a, b) => Number(b.puedeFirmar) - Number(a.puedeFirmar) || b.montoUSD - a.montoUSD);

      // Mis aprobaciones dadas: donde YA firmé · más recientes (mayor monto) primero.
      const misDadas = uid
        ? todos.filter((e) => firmadoPorMi(e, uid)).sort((a, b) => b.montoUSD - a.montoUSD)
        : [];

      setEgresos(conAccion);
      setDadas(misDadas);
      setSocios(sociosEquity);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, isSocio, roles]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const count = egresos.reduce((n, e) => n + (e.puedeFirmar ? 1 : 0), 0);
  const totalUSD = egresos.reduce((s, e) => s + e.montoUSD, 0);

  return { egresos, dadas, count, totalUSD, socios, loading, reload: cargar };
}
