/**
 * Tipo I · Envío a tercero (Almacén Perú → Almacén tercero · FBA/consignación)
 *
 * El stock queda BLOQUEADO hasta retorno o liquidación (D-10 legacy).
 * Requiere referencia + tipo de relación obligatorios en Paso 2 (D-7).
 * Moneda mixta: puede haber costos en USD (courier internacional) y PEN
 * (fees locales) por línea.
 */
import type { EnvioTipoConfig } from './index';

export const tipoIConfig: EnvioTipoConfig = {
  tipo: 'I',
  nombre: 'Envío a tercero',
  subtitulo: 'Almacén → Fulfillment',
  moneda: 'MIXTA',
  requiereDestinoDetalles: true, // referencia + tipo relación obligatorios
  transportadoresPermitidos: ['courier_internacional', 'transportista_local'],
  chipColor: {
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    textUpper: 'text-violet-700',
    textMain: 'text-violet-900',
    textSub: 'text-violet-700',
  },
  botonCrearLabel: 'Crear envío a tercero',
  bloqueaStock: true,
  modoTransporteDefault: 'aereo',
};
