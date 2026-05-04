/**
 * S3.4 (2026-05-04) · Cálculo de duración del envase para productos suplemento.
 *
 * Permite mostrar al usuario "cuánto le dura este frasco" en tiempo real,
 * tanto en el wizard de creación como en el editor y en el modal detalle
 * cara cliente. El cálculo varía según si la unidad es discreta (cápsulas,
 * tabletas, etc.) o continua (g, ml, lb).
 */

import {
  type ContenidoNeto,
  type UnidadContenido,
  UNIDADES_DISCRETAS_SUP,
  UNIDAD_CONTENIDO_LABELS,
} from '../../../types/producto.types';

export type DuracionEstado =
  | { tipo: 'ok'; dias: number; razonCalculo: string }
  | { tipo: 'pendiente'; faltan: Array<'servings' | 'contenido' | 'dosaje'>; razonCalculo: string }
  | { tipo: 'no_aplica'; razonCalculo: string };

export interface CalcularDuracionInput {
  /** Contenido neto del envase · si falta, no hay base para calcular */
  contenidoNeto?: ContenidoNeto;
  /** Servings por día · top-level del producto */
  servingsPerDay?: number;
  /**
   * Dosaje en formato libre · ej. "5 g por scoop", "2 cápsulas", "5000 IU".
   * Solo se usa para extraer el peso por servida cuando la unidad es continua (ml/g/lb).
   */
  dosaje?: string;
}

/**
 * Extrae el peso/volumen por servida desde un texto de dosaje libre.
 * Heurística simple: busca el primer número seguido por una unidad continua.
 * Ejemplos que parsea:
 *   - "5 g por scoop"        → { valor: 5, unidad: 'g' }
 *   - "10ml de extracto"     → { valor: 10, unidad: 'ml' }
 *   - "2.5g de proteína"     → { valor: 2.5, unidad: 'g' }
 *   - "5000 IU D3"           → null (IU no es masa)
 *   - "2 cápsulas"           → null (cápsula es discreta)
 */
export function extraerCantidadPorServida(dosaje: string | undefined): { valor: number; unidad: 'g' | 'ml' | 'lb' | 'oz' } | null {
  if (!dosaje) return null;
  const match = dosaje.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|gramos?|ml|mL|lb|libras?|oz|onzas?)\b/i);
  if (!match) return null;
  const valor = parseFloat(match[1].replace(',', '.'));
  if (!isFinite(valor) || valor <= 0) return null;
  const unidadRaw = match[2].toLowerCase();
  let unidad: 'g' | 'ml' | 'lb' | 'oz';
  if (unidadRaw.startsWith('g')) unidad = 'g';
  else if (unidadRaw === 'ml') unidad = 'ml';
  else if (unidadRaw.startsWith('lb') || unidadRaw.startsWith('libra')) unidad = 'lb';
  else if (unidadRaw.startsWith('oz') || unidadRaw.startsWith('onza')) unidad = 'oz';
  else return null;
  return { valor, unidad };
}

/** Convierte cantidades a una unidad común para comparar. */
function aGramos(valor: number, unidad: UnidadContenido | 'g' | 'ml' | 'lb' | 'oz'): number | null {
  switch (unidad) {
    case 'g': return valor;
    case 'kg': return valor * 1000;
    case 'lb': return valor * 453.592;
    case 'oz': return valor * 28.3495;
    case 'ml': return valor; // 1 ml ≈ 1 g aproximación común para suplementos líquidos
    default: return null;
  }
}

/**
 * Calcula la duración del envase en días.
 *
 * Reglas:
 *   - Si la unidad es DISCRETA (cápsulas, tabletas, gomitas, sobres, sticks, scoops):
 *     duración = contenidoNeto.valor / servingsPerDay (asume 1 unidad por servida).
 *   - Si la unidad es CONTINUA (g, ml, lb, oz):
 *     duración = (contenidoNeto.valor convertido a g) / (cantidadPorServida_g × servingsPerDay).
 *     Requiere `dosaje` parseable.
 *   - Si falta info crítica → estado 'pendiente' con detalle de qué falta.
 *   - Si la unidad no aplica para SUP (ej. 'unidades', 'pares', 'fl_oz') → 'no_aplica'.
 */
export function calcularDuracionEnvase(input: CalcularDuracionInput): DuracionEstado {
  const { contenidoNeto, servingsPerDay, dosaje } = input;

  // Sin contenido no hay base
  if (!contenidoNeto || !contenidoNeto.valor || contenidoNeto.valor <= 0) {
    return {
      tipo: 'pendiente',
      faltan: ['contenido'],
      razonCalculo: 'Falta contenido neto del envase',
    };
  }

  const { valor, unidad } = contenidoNeto;
  const esDiscreta = (UNIDADES_DISCRETAS_SUP as ReadonlyArray<UnidadContenido>).includes(unidad);
  const esContinua = (['g', 'ml', 'lb', 'oz', 'kg'] as UnidadContenido[]).includes(unidad);

  if (!esDiscreta && !esContinua) {
    return {
      tipo: 'no_aplica',
      razonCalculo: `Unidad "${unidad}" no aplica para cálculo de duración SUP`,
    };
  }

  if (!servingsPerDay || servingsPerDay <= 0) {
    return {
      tipo: 'pendiente',
      faltan: ['servings'],
      razonCalculo: 'Falta servings/día (Sec.2 Atributos)',
    };
  }

  // CASO DISCRETO · directo
  if (esDiscreta) {
    const dias = Math.round(valor / servingsPerDay);
    return {
      tipo: 'ok',
      dias,
      razonCalculo: `${valor} ${UNIDAD_CONTENIDO_LABELS[unidad]} ÷ ${servingsPerDay} servings/día`,
    };
  }

  // CASO CONTINUO · necesita dosaje parseable
  const porServida = extraerCantidadPorServida(dosaje);
  if (!porServida) {
    return {
      tipo: 'pendiente',
      faltan: ['dosaje'],
      razonCalculo: 'Falta dosaje con peso/volumen por servida (ej. "5 g por scoop")',
    };
  }

  const contenidoEnG = aGramos(valor, unidad);
  const porServidaEnG = aGramos(porServida.valor, porServida.unidad);
  if (contenidoEnG == null || porServidaEnG == null || porServidaEnG <= 0) {
    return {
      tipo: 'pendiente',
      faltan: ['dosaje'],
      razonCalculo: 'No se pudo convertir las unidades a una base común',
    };
  }

  const dias = Math.round(contenidoEnG / (porServidaEnG * servingsPerDay));
  return {
    tipo: 'ok',
    dias,
    razonCalculo: `${valor} ${UNIDAD_CONTENIDO_LABELS[unidad]} ÷ (${porServida.valor} ${porServida.unidad} × ${servingsPerDay}/día)`,
  };
}

/**
 * Decide si un cálculo de duración merece banner de validación blanda.
 * Atrapa errores típicos: dedo gordo en servings/día o unidad mal elegida.
 *
 * - <14 días → "frasco rinde menos de 2 semanas"
 * - >180 días → "frasco rinde más de 6 meses"
 */
export function evaluarDuracionAtipica(dias: number):
  | { atipica: false }
  | { atipica: true; mensaje: string; severidad: 'baja' | 'media' } {
  if (dias < 14) {
    return {
      atipica: true,
      severidad: 'media',
      mensaje: `Frasco rinde menos de 2 semanas (${dias} días). Verificá Servings/día y Contenido — si es un blister chico para muestra, ignorá esta alerta.`,
    };
  }
  if (dias > 180) {
    return {
      atipica: true,
      severidad: 'baja',
      mensaje: `Frasco rinde más de 6 meses (${dias} días). Verificá que el dato sea correcto — algunos productos sí duran tanto, pero suele ser un error de servings/día.`,
    };
  }
  return { atipica: false };
}
