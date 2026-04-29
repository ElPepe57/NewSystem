/**
 * envio.estado.helpers — S54.x · BUG-INC-006/007/008 fix
 *
 * Helper único para calcular el estado de un envío y sus contadores
 * tomando en cuenta NO solo `unidad.estadoEnvio` sino también el estado
 * de las `incidencias` asociadas.
 *
 * Regla de negocio:
 *   Un envío está COMPLETO cuando:
 *     - NO hay unidades en estado 'enviada' / 'pendiente' (esperando llegada física)
 *     - TODAS las unidades en 'faltante' / 'retenida' tienen su incidencia
 *       asociada con `resuelta=true` (la decisión fue tomada — sea reclamo,
 *       baja, reemplazo, lo que sea).
 *
 *   Las unidades en 'danada' NO bloquean el cierre del envío porque
 *   YA LLEGARON FÍSICAMENTE — solo llegaron mal. Su incidencia sigue su
 *   propio ciclo (puede haber reclamo abierto), pero el envío ya está
 *   "recibido completo" desde la perspectiva logística.
 *
 * Reemplaza la lógica simplista que estaba en envio.recepcion.service:215-227
 * que dejaba el envío en 'recibida_parcial' eternamente cuando había una
 * faltante con incidencia abierta sin gestionar.
 */
import type {
  EnvioUnidad,
  IncidenciaEnvio,
  EstadoEnvio,
} from '../types/envio.types';

export interface EnvioEstadoCalculado {
  /** Nuevo estado calculado del envío. */
  estado: EstadoEnvio;
  /** Unidades con estadoEnvio === 'recibida'. */
  totalRecibidas: number;
  /** Unidades con estadoEnvio === 'danada'. Cuentan como recibidas físicamente. */
  totalDanadas: number;
  /** Unidades con estadoEnvio === 'faltante' o 'perdida'. */
  totalFaltantes: number;
  /** Unidades con estadoEnvio === 'retenida'. */
  totalRetenidas: number;
  /** Unidades en 'enviada' o 'pendiente' (aún no procesadas en recepción). */
  totalPendientes: number;

  /**
   * Si TODAS las incidencias del envío están resueltas (resuelta=true).
   * Si no hay incidencias, true por default.
   */
  todasIncidenciasResueltas: boolean;

  /**
   * Si hay unidades realmente esperando llegada física (pendientes o
   * enviadas, NO faltantes con incidencia resuelta).
   * Útil para condicionar el banner "Recepcionar adicional".
   */
  hayUnidadesEsperandoLlegada: boolean;

  /**
   * Si hay incidencias activas (no resueltas) — para CTA "Gestionar incidencias".
   */
  hayIncidenciasActivas: boolean;
}

/**
 * Calcula el estado consolidado del envío según unidades + incidencias.
 *
 * @param unidades  Array `envio.unidades[]`
 * @param incidencias Array `envio.incidencias[]`
 * @returns Estado nuevo + contadores + flags de UI
 */
export function recalcularEstadoEnvio(
  unidades: EnvioUnidad[] | undefined | null,
  incidencias: IncidenciaEnvio[] | undefined | null,
): EnvioEstadoCalculado {
  const us = unidades || [];
  const incs = incidencias || [];

  const totalRecibidas = us.filter((u) => u.estadoEnvio === 'recibida').length;
  const totalDanadas = us.filter((u) => u.estadoEnvio === 'danada').length;
  const totalFaltantes = us.filter(
    (u) => u.estadoEnvio === 'faltante' || u.estadoEnvio === 'perdida'
  ).length;
  const totalRetenidas = us.filter((u) => u.estadoEnvio === 'retenida').length;
  const totalPendientes = us.filter(
    (u) => u.estadoEnvio === 'enviada' || u.estadoEnvio === 'pendiente'
  ).length;

  // Incidencias activas = no resueltas
  const incidenciasActivas = incs.filter((i) => !i.resuelta);
  const hayIncidenciasActivas = incidenciasActivas.length > 0;
  const todasIncidenciasResueltas = !hayIncidenciasActivas;

  // Unidades faltantes/retenidas SIN incidencia resuelta = bloquean cierre
  const unidadesIdsConIncidenciaActiva = new Set(
    incidenciasActivas.map((i) => i.unidadId).filter(Boolean) as string[]
  );
  const faltantesActivas = us.filter(
    (u) =>
      (u.estadoEnvio === 'faltante' || u.estadoEnvio === 'perdida') &&
      unidadesIdsConIncidenciaActiva.has(u.unidadId)
  ).length;
  const retenidasActivas = us.filter(
    (u) =>
      u.estadoEnvio === 'retenida' &&
      unidadesIdsConIncidenciaActiva.has(u.unidadId)
  ).length;

  // Hay unidades realmente esperando llegada física (no perdidas con incidencia resuelta)
  const hayUnidadesEsperandoLlegada = totalPendientes > 0;

  // ESTADO FINAL DEL ENVÍO:
  //   completo = no hay pendientes Y no hay faltantes/retenidas activas (sin gestionar)
  //   parcial  = caso contrario
  const esCompleto =
    totalPendientes === 0 && faltantesActivas === 0 && retenidasActivas === 0;
  const estado: EstadoEnvio = esCompleto ? 'recibida_completa' : 'recibida_parcial';

  return {
    estado,
    totalRecibidas,
    totalDanadas,
    totalFaltantes,
    totalRetenidas,
    totalPendientes,
    todasIncidenciasResueltas,
    hayUnidadesEsperandoLlegada,
    hayIncidenciasActivas,
  };
}

/**
 * Versión "campos para Firestore update" del cálculo. Devuelve solo los
 * campos que cambian del envío para usar directamente en `updateDoc(envioRef, ...)`.
 */
export function buildEnvioEstadoUpdates(
  unidades: EnvioUnidad[] | undefined | null,
  incidencias: IncidenciaEnvio[] | undefined | null,
): {
  estado: EstadoEnvio;
  totalUnidadesRecibidas: number;
  totalUnidadesFaltantes: number;
  totalUnidadesDanadas: number;
} {
  const calc = recalcularEstadoEnvio(unidades, incidencias);
  return {
    estado: calc.estado,
    totalUnidadesRecibidas: calc.totalRecibidas,
    totalUnidadesFaltantes: calc.totalFaltantes,
    totalUnidadesDanadas: calc.totalDanadas,
  };
}
