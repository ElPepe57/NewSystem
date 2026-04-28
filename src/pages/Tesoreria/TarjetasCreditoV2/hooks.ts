/**
 * hooks.ts — TarjetasCredito V2 · S58d
 *
 * Hooks reutilizables para tarjetas:
 *  - useSaldoCCTarjeta: lee el saldo desde la CC espejo (fuente de verdad)
 *  - useCargosPendientes: lista de cargos sin pagar de una tarjeta
 */

import { useEffect, useState } from 'react';
import { getSaldoCCTarjeta } from '../../../services/cuentaCorriente.adaptadores';
import { pagoEstadoCuentaTarjetaService } from '../../../services/pagoEstadoCuentaTarjeta.service';
import type {
  CargoTarjeta,
  PagoEstadoCuentaTarjeta,
} from '../../../types/tarjetaCredito.types';

// ═════════════════════════════════════════════════════════════════════════
// useSaldoCCTarjeta
// ═════════════════════════════════════════════════════════════════════════

export interface SaldoCCTarjeta {
  saldoUSD: number;
  saldoPEN: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Lee el saldo de la CC espejo de una tarjeta.
 *
 * Convención: saldo POSITIVO = el negocio le debe al titular/banco.
 * Saldo cero = no hay cargos pendientes.
 *
 * Devuelve los 2 saldos por si la TC es bi-moneda.
 */
export function useSaldoCCTarjeta(
  tarjetaCreditoId: string | undefined,
): SaldoCCTarjeta {
  const [saldoUSD, setSaldoUSD] = useState(0);
  const [saldoPEN, setSaldoPEN] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    if (!tarjetaCreditoId) {
      setSaldoUSD(0);
      setSaldoPEN(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getSaldoCCTarjeta(tarjetaCreditoId);
      setSaldoUSD(result.saldoUSD);
      setSaldoPEN(result.saldoPEN);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarjetaCreditoId]);

  return { saldoUSD, saldoPEN, loading, error, refetch };
}

// ═════════════════════════════════════════════════════════════════════════
// useCargosPendientes
// ═════════════════════════════════════════════════════════════════════════

export interface CargosPendientesState {
  cargos: CargoTarjeta[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Lista los cargos pendientes (estado != 'pagado') de una tarjeta.
 */
export function useCargosPendientes(
  tarjetaCreditoId: string | undefined,
): CargosPendientesState {
  const [cargos, setCargos] = useState<CargoTarjeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    if (!tarjetaCreditoId) {
      setCargos([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list =
        await pagoEstadoCuentaTarjetaService.getCargosPendientes(
          tarjetaCreditoId,
        );
      setCargos(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarjetaCreditoId]);

  return { cargos, loading, error, refetch };
}

// ═════════════════════════════════════════════════════════════════════════
// useCargosTarjeta · todos los cargos (incl. pagados)
// ═════════════════════════════════════════════════════════════════════════

export interface CargosTarjetaState {
  cargos: CargoTarjeta[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCargosTarjeta(
  tarjetaCreditoId: string | undefined,
): CargosTarjetaState {
  const [cargos, setCargos] = useState<CargoTarjeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    if (!tarjetaCreditoId) {
      setCargos([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await pagoEstadoCuentaTarjetaService.getCargosByTarjeta(
        tarjetaCreditoId,
      );
      // Ordenar por fecha desc
      list.sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
      setCargos(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarjetaCreditoId]);

  return { cargos, loading, error, refetch };
}

// ═════════════════════════════════════════════════════════════════════════
// usePagosTarjeta · pagos de estado de cuenta
// ═════════════════════════════════════════════════════════════════════════

export interface PagosTarjetaState {
  pagos: PagoEstadoCuentaTarjeta[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePagosTarjeta(
  tarjetaCreditoId: string | undefined,
): PagosTarjetaState {
  const [pagos, setPagos] = useState<PagoEstadoCuentaTarjeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    if (!tarjetaCreditoId) {
      setPagos([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await pagoEstadoCuentaTarjetaService.getPagosByTarjeta(
        tarjetaCreditoId,
      );
      setPagos(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarjetaCreditoId]);

  return { pagos, loading, error, refetch };
}
