/**
 * Registry de configuraciones por tipo de envío (S53 F1)
 *
 * Cada tipo (C, J, E, I) tiene un config con la metadata que el shell
 * y los pasos consumen vía `getTipoConfig(tipo)`. Así se evita if/switch
 * disperso en el código.
 */
import type { TipoInferido } from '../envioWizardTypes';
import { tipoCConfig } from './tipoC.config';
import { tipoJConfig } from './tipoJ.config';
import { tipoEConfig } from './tipoE.config';
import { tipoIConfig } from './tipoI.config';

/**
 * Metadata de cada tipo de envío.
 * - `tipo`: sigla técnica (interno, nunca se muestra al usuario)
 * - `nombre`: lenguaje humano (para el chip del sidebar y headers)
 * - `subtitulo`: descripción corta del flujo (sidebar)
 * - `moneda`: USD/PEN/MIXTA según el caso
 * - `requiereDestinoDetalles`: Paso 2 condicional (solo E e I)
 * - `transportadoresPermitidos`: filtra el picker del Paso 3
 * - `chipColor`: clase Tailwind del chip de tipo inferido (paleta v7)
 * - `botonCrearLabel`: texto del botón final en Paso 4
 * - `bloqueaStock`: tipo I bloquea stock hasta retorno/liquidación
 */
export interface EnvioTipoConfig {
  tipo: TipoInferido;
  nombre: string;
  subtitulo: string;
  moneda: 'USD' | 'PEN' | 'MIXTA';
  requiereDestinoDetalles: boolean;
  transportadoresPermitidos: Array<
    'viajero' | 'courier_internacional' | 'transportista_local'
  >;
  /** Clases Tailwind: bg + border + text (paleta del chip de tipo en sidebar v7) */
  chipColor: {
    bg: string;
    border: string;
    textUpper: string;
    textMain: string;
    textSub: string;
  };
  botonCrearLabel: string;
  bloqueaStock: boolean;
  /** Transito default al entrar al Paso 3 (usuario puede cambiar) */
  modoTransporteDefault: 'aereo' | 'maritimo' | 'terrestre';
}

const CONFIGS: Record<TipoInferido, EnvioTipoConfig> = {
  C: tipoCConfig,
  J: tipoJConfig,
  E: tipoEConfig,
  I: tipoIConfig,
};

/**
 * Obtiene la config del tipo. Retorna `null` si el tipo es null
 * (usuario aún no completó Paso 1 · sub-sección [2]).
 */
export function getTipoConfig(tipo: TipoInferido | null): EnvioTipoConfig | null {
  if (!tipo) return null;
  return CONFIGS[tipo];
}

export { tipoCConfig, tipoJConfig, tipoEConfig, tipoIConfig };
