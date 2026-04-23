/**
 * useTipoInferido — Hook puro que infiere el tipo técnico del envío (C/J/E/I)
 * a partir del par (origenCategoria, destinoCategoria) del Paso 1.
 *
 * D-2 · Sistema inteligente con inferencia: el usuario nunca ve siglas
 * técnicas. El tipo se usa internamente para configurar el wizard.
 */
import type {
  OrigenCategoria,
  DestinoCategoria,
  TipoInferido,
} from './envioWizardTypes';

/**
 * Matriz de inferencia:
 *
 *                      DESTINO
 *                 casilla_intl  almacen_peru  almacen_tercero
 * ORIGEN
 *   casilla_intl         J            C            ❌ no válido
 *   almacen_peru        ❌           E             I
 *
 * Las combinaciones no válidas retornan `null` — la UI muestra banner
 * "Combinación no estándar · contactá al admin" y deshabilita Siguiente (D-B).
 */
export function inferirTipo(
  origen: OrigenCategoria | null,
  destino: DestinoCategoria | null
): TipoInferido | null {
  if (!origen || !destino) return null;

  if (origen === 'casilla_intl' && destino === 'casilla_intl') return 'J';
  if (origen === 'casilla_intl' && destino === 'almacen_peru') return 'C';
  if (origen === 'almacen_peru' && destino === 'almacen_peru') return 'E';
  if (origen === 'almacen_peru' && destino === 'almacen_tercero') return 'I';

  return null;
}

/**
 * Hook wrapper para uso directo en React components.
 * Versión pura (sin useMemo) porque la lógica es trivial.
 */
export function useTipoInferido(
  origen: OrigenCategoria | null,
  destino: DestinoCategoria | null
): TipoInferido | null {
  return inferirTipo(origen, destino);
}

/**
 * Combinaciones válidas listadas para el banner informativo (D-B).
 */
export const COMBINACIONES_VALIDAS = [
  'Casilla internacional → Almacén Perú',
  'Casilla internacional → Casilla internacional',
  'Almacén Perú → Almacén Perú',
  'Almacén Perú → Almacén tercero',
];
