/**
 * radarApuestas.helper · F4+ · Radar de Apuestas — núcleo PURO (sin I/O ni JSX).
 *
 * Cierra el BUCLE de la apuesta: la creación guiada las CREA (con tesis + ROI pre-compra)
 * y este radar las TRACKEA — ¿la tesis se cumplió? Todo DERIVADO (cero schema nuevo en el
 * producto): cruza requerimientos `subtipo='apuesta'` con la recuperación de CTRU
 * (`calcularCurvaRecuperacion`) + la rotación de `productoIntel`.
 *
 * Veredicto por ciclo de vida de 365 días (mockup requerimientos-creacion-guiada · acto 6):
 *   - acierto       → recuperó el CTRU (recuperación ≥ 100%) · gradúa a catálogo.
 *   - fallida       → pasó el año (día > 365) sin recuperar · sugiere descontinuar.
 *   - en evaluación → aún dentro del ciclo, todavía recuperando.
 *
 * 100% testeable.
 */

export type VeredictoApuesta = 'acierto' | 'en_evaluacion' | 'fallida';

/** El ciclo de vida de una apuesta: un año para probar la tesis. */
export const CICLO_APUESTA_DIAS = 365;

/** Umbral de recuperación que marca el acierto (recuperó todo el CTRU invertido). */
export const UMBRAL_ACIERTO_PCT = 100;

/** Una fila del radar · ensamblada por el hook desde apuesta × recuperación × rotación. */
export interface FilaApuesta {
  requerimientoId: string;
  productoId: string;
  nombre: string;
  tesis: string;
  /** CTRU invertido en la apuesta (costo de la jugada) en USD. */
  ctruInvertidoUSD: number;
  /** % del CTRU recuperado vía ventas (0..N · ≥100 = recuperado). */
  recuperacionPct: number;
  /** Etiqueta legible de rotación (de productoIntel · 'muy alta' … 'sin movimiento'). */
  rotacionLabel: string;
  /** Tono semántico de la rotación para el chip. */
  rotacionTono: 'emerald' | 'slate' | 'rose';
  /** Días transcurridos desde que se creó la apuesta. */
  diasDesdeCreacion: number;
  veredicto: VeredictoApuesta;
}

export interface ResumenRadar {
  enEvaluacion: number;
  aciertos: number;
  fallidas: number;
  /** aciertos / (aciertos + fallidas) · null si no hay apuestas resueltas todavía. */
  tasaAciertoPct: number | null;
}

/**
 * Veredicto de una apuesta según su recuperación de CTRU y su antigüedad.
 * El acierto manda sobre el calendario: si recuperó el CTRU antes del año, ya es acierto.
 */
export function evaluarVeredicto(recuperacionPct: number, diasDesdeCreacion: number): VeredictoApuesta {
  if (recuperacionPct >= UMBRAL_ACIERTO_PCT) return 'acierto';
  if (diasDesdeCreacion > CICLO_APUESTA_DIAS) return 'fallida';
  return 'en_evaluacion';
}

/** Tono de la barra de recuperación: recuperado=emerald · avanzando=sky · estancado=rose. */
export function tonoRecuperacion(recuperacionPct: number): 'emerald' | 'sky' | 'rose' {
  if (recuperacionPct >= UMBRAL_ACIERTO_PCT) return 'emerald';
  if (recuperacionPct >= 40) return 'sky';
  return 'rose';
}

/** Cuenta los veredictos + la tasa de acierto sobre las apuestas YA resueltas. */
export function resumirRadar(filas: FilaApuesta[]): ResumenRadar {
  const aciertos = filas.filter((f) => f.veredicto === 'acierto').length;
  const fallidas = filas.filter((f) => f.veredicto === 'fallida').length;
  const enEvaluacion = filas.filter((f) => f.veredicto === 'en_evaluacion').length;
  const resueltas = aciertos + fallidas;
  return {
    enEvaluacion,
    aciertos,
    fallidas,
    tasaAciertoPct: resueltas > 0 ? Math.round((aciertos / resueltas) * 100) : null,
  };
}

/** Orden del radar: primero las que piden acción (fallida → en evaluación → acierto), y dentro, por día descendente. */
export function ordenarRadar(filas: FilaApuesta[]): FilaApuesta[] {
  const peso: Record<VeredictoApuesta, number> = { fallida: 0, en_evaluacion: 1, acierto: 2 };
  return [...filas].sort((a, b) => {
    if (peso[a.veredicto] !== peso[b.veredicto]) return peso[a.veredicto] - peso[b.veredicto];
    return b.diasDesdeCreacion - a.diasDesdeCreacion;
  });
}
