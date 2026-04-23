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
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    textUpper: 'text-amber-700',
    textMain: 'text-amber-900',
    textSub: 'text-amber-700',
  },
  botonCrearLabel: 'Crear traslado interno',
  bloqueaStock: false,
  modoTransporteDefault: 'terrestre',
};
