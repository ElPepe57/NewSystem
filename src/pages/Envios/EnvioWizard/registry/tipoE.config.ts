/**
 * Tipo E · Traslado interno Perú (Almacén Perú → Almacén Perú)
 *
 * Reubica inventario entre 2 almacenes propios en Perú. Todo en PEN,
 * sin aduana ni TC. Requiere motivo obligatorio en Paso 2 (D-7).
 */
import type { EnvioTipoConfig } from './index';

export const tipoEConfig: EnvioTipoConfig = {
  tipo: 'E',
  nombre: 'Traslado interno',
  subtitulo: 'Perú → Perú',
  moneda: 'PEN',
  requiereDestinoDetalles: true, // motivo obligatorio
  transportadoresPermitidos: ['transportista_local'],
  chipColor: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    textUpper: 'text-orange-700',
    textMain: 'text-orange-900',
    textSub: 'text-orange-700',
  },
  botonCrearLabel: 'Crear traslado interno',
  bloqueaStock: false,
  modoTransporteDefault: 'terrestre',
};
