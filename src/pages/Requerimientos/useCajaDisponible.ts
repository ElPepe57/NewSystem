/**
 * useCajaDisponible · F4 · mini-hook reutilizable.
 *
 * Lee el saldo de caja consolidado (PEN) de tesorería (async · misma fuente que usePanelDecision).
 * Devuelve `null` mientras carga o si no se pudo leer — los consumidores tratan null como
 * "caja desconocida" (los widgets de presión/ratio se apagan, no inventan un número).
 */
import { useEffect, useState } from 'react';
import { tesoreriaService } from '../../services/tesoreria.service';

export function useCajaDisponible(): number | null {
  const [cajaDisponiblePEN, setCajaDisponiblePEN] = useState<number | null>(null);

  useEffect(() => {
    let activo = true;
    tesoreriaService
      .getEstadisticasAgregadas()
      .then((stats) => {
        if (!activo) return;
        setCajaDisponiblePEN(stats?.saldoTotalEquivalentePEN ?? null);
      })
      .catch(() => {
        if (activo) setCajaDisponiblePEN(null);
      });
    return () => {
      activo = false;
    };
  }, []);

  return cajaDisponiblePEN;
}
