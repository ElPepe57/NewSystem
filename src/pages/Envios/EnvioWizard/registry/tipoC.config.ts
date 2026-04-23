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
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    textUpper: 'text-teal-700',
    textMain: 'text-teal-900',
    textSub: 'text-teal-700',
  },
  botonCrearLabel: 'Crear y despachar envío',
  bloqueaStock: false,
  modoTransporteDefault: 'aereo',
};
