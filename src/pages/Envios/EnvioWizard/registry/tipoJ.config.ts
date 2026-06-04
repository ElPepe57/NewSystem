/**
 * Tipo J · Movimiento internacional entre casillas (Casilla intl → Casilla intl)
 *
 * Caso J: mover unidades entre 2 casillas internacionales (del mismo viajero
 * o de colaboradores distintos · variantes J1/J2 determinadas en runtime).
 * D-9: intra-país preferente — si origen y destino están en países distintos,
 * se muestra banner de advertencia (no bloqueante) y queda auditado.
 */
import type { EnvioTipoConfig } from './index';

export const tipoJConfig: EnvioTipoConfig = {
  tipo: 'J',
  nombre: 'Movimiento internacional',
  subtitulo: 'Casilla → Casilla',
  moneda: 'USD',
  requiereDestinoDetalles: false,
  transportadoresPermitidos: ['viajero', 'courier_internacional'],
  chipColor: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    textUpper: 'text-orange-700',
    textMain: 'text-orange-900',
    textSub: 'text-orange-700',
  },
  botonCrearLabel: 'Crear envío entre casillas',
  bloqueaStock: false,
  modoTransporteDefault: 'aereo',
};
