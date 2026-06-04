/**
 * Tipo C · Envío internacional (Casilla intl → Almacén Perú)
 *
 * El caso más común en Vitaskin: consolidar unidades de la casilla USA/CN/KR
 * y enviarlas a Perú con viajero o courier. Todo en USD con TC.
 */
import type { EnvioTipoConfig } from './index';

export const tipoCConfig: EnvioTipoConfig = {
  tipo: 'C',
  nombre: 'Envío internacional',
  subtitulo: 'Casilla → Perú',
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
  botonCrearLabel: 'Crear y despachar envío',
  bloqueaStock: false,
  modoTransporteDefault: 'aereo',
};
