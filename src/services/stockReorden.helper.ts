/**
 * stockReorden.helper.ts · F4 · Motor de PUNTO DE REORDEN (ROP) — núcleo PURO y testeable.
 *
 * Reemplaza el umbral fijo legacy `producto.stockMinimo || 5` por un punto de reorden calculado
 * con datos reales del propio producto:
 *
 *   puntoReorden    = velocidadDiaria × leadTime + stockSeguridad
 *   stockSeguridad  = Z × velocidadDiaria × desviacionLeadTime   (Z DIFERENCIADO por rotación)
 *   stockNeto       = stockDisponible − demandaComprometida
 *   necesitaReposicion = tieneSeñalReal && stockNeto ≤ puntoReorden
 *
 * GATE DE SEÑAL REAL: un producto SIN historial de ventas (ni stock+rotación efectiva) NO genera
 * alerta. No se inventan supuestos sobre productos que "todavía no tienen punto de partida de pedidos".
 *
 * Política de stock de seguridad DIFERENCIADA POR ROTACIÓN (decisión usuario 2026-06-20):
 * best-sellers (muy_alta/alta) ~95% nivel de servicio · nicho (baja/muy_baja) ~85% · sin_movimiento no alerta.
 */
import type { ClasificacionRotacion } from '../types/productoIntel.types';

export interface PoliticaReorden {
  /** Z (nivel de servicio) por clasificación de rotación · stock de seguridad diferenciado. */
  zPorRotacion: Record<ClasificacionRotacion, number>;
  /** Horizonte de cobertura objetivo (días) al sugerir cantidad de compra. */
  diasCoberturaObjetivo: number;
  /** Lead time por defecto (días) cuando el producto no tiene historial de OC. */
  leadTimeDefaultDias: number;
  /** Cantidad mínima a sugerir cuando sí necesita reposición. */
  cantidadMinima: number;
  /** Muestras mínimas de OC para confiar en la desviación real del lead time. */
  muestrasMinimasDesviacion: number;
}

export const POLITICA_REORDEN_DEFAULT: PoliticaReorden = {
  zPorRotacion: {
    muy_alta: 1.65,    // ~95% — best-sellers, casi nunca quiebre
    alta: 1.65,        // ~95%
    media: 1.28,       // ~90%
    baja: 1.04,        // ~85% — nicho, menos capital inmovilizado
    muy_baja: 1.04,    // ~85%
    sin_movimiento: 0, // no aplica (el gate lo excluye)
  },
  diasCoberturaObjetivo: 45,
  leadTimeDefaultDias: 30,
  cantidadMinima: 5,
  muestrasMinimasDesviacion: 2,
};

export interface ReordenInput {
  productoId: string;
  sku?: string;
  nombreComercial?: string;
  marca?: string;
  /** Stock disponible · YA EXCLUYE lo reservado. */
  stockDisponible: number;
  stockTotal: number;
  /** Velocidad de venta diaria (unidades/día · robusta · max 30d/90d). */
  velocidadDiaria: number;
  /** Unidades vendidas en 90 días · alimenta el gate de señal real. */
  unidadesVendidas90d: number;
  clasificacionRotacion: ClasificacionRotacion;
  /** Lead time promedio (días) · 0 si no hay historial de OC. */
  leadTimeDias: number;
  /** Desviación estándar del lead time (días). */
  leadTimeDesviacionDias: number;
  /** Cantidad de OC recibidas que alimentan el lead time (confiabilidad). */
  leadTimeMuestras: number;
  /** Σ pendienteCompra de requerimientos 'demanda_comprometida' activos para este producto. */
  demandaComprometida: number;
  /** Override manual opcional del piso (>0 lo activa). */
  stockMinimoManual?: number;
}

export type UrgenciaReorden = 'critica' | 'alta' | 'media' | 'baja';

export interface AlertaReposicion {
  productoId: string;
  sku?: string;
  nombreComercial?: string;
  marca?: string;
  stockDisponible: number;
  stockNeto: number;
  stockTotal: number;
  demandaComprometida: number;
  velocidadDiaria: number;
  leadTimeDias: number;
  stockSeguridad: number;
  puntoReorden: number;
  diasCobertura: number;
  tieneSenalReal: boolean;
  necesitaReposicion: boolean;
  cantidadSugerida: number;
  urgencia: UrgenciaReorden;
  razon: string;
  scorePrioridad: number;
}

/**
 * Evalúa el punto de reorden de UN producto. Función PURA (sin I/O) → 100% testeable.
 */
export function evaluarReorden(
  input: ReordenInput,
  politica: PoliticaReorden = POLITICA_REORDEN_DEFAULT
): AlertaReposicion {
  const velocidad = Math.max(0, input.velocidadDiaria);

  // GATE de señal real: historial de ventas, o stock con rotación efectiva.
  const tieneSenalReal = input.unidadesVendidas90d > 0 || (input.stockTotal > 0 && velocidad > 0);

  const leadTime = input.leadTimeDias > 0 ? input.leadTimeDias : politica.leadTimeDefaultDias;

  // Desviación del lead time: real si hay muestras suficientes; si no, fallback al 50% del lead time
  // (alta incertidumbre cuando no conocemos la variabilidad del proveedor).
  const desviacion = input.leadTimeMuestras >= politica.muestrasMinimasDesviacion
    ? Math.max(0, input.leadTimeDesviacionDias)
    : leadTime * 0.5;

  const z = politica.zPorRotacion[input.clasificacionRotacion] ?? politica.zPorRotacion.media;
  const stockSeguridad = Math.ceil(z * velocidad * desviacion);

  const puntoReordenCalc = Math.ceil(velocidad * leadTime + stockSeguridad);
  // Override manual: si el usuario fijó un mínimo explícito, el reorder es el MAYOR de ambos.
  const puntoReorden = input.stockMinimoManual && input.stockMinimoManual > 0
    ? Math.max(puntoReordenCalc, input.stockMinimoManual)
    : puntoReordenCalc;

  const stockNeto = input.stockDisponible - Math.max(0, input.demandaComprometida);
  const diasCobertura = velocidad > 0
    ? Math.round(stockNeto / velocidad)
    : (stockNeto > 0 ? 999 : 0);

  const necesitaReposicion = tieneSenalReal && stockNeto <= puntoReorden;

  // Cantidad a pedir: llevar el stock neto al objetivo (lead time + horizonte de cobertura + seguridad).
  const stockObjetivo = velocidad * (leadTime + politica.diasCoberturaObjetivo) + stockSeguridad;
  const cantidadSugerida = necesitaReposicion
    ? Math.max(Math.ceil(stockObjetivo - stockNeto), politica.cantidadMinima)
    : 0;

  // Urgencia (significativa solo cuando necesitaReposicion).
  let urgencia: UrgenciaReorden = 'baja';
  if (stockNeto <= 0) urgencia = 'critica';
  else if (diasCobertura <= leadTime) urgencia = 'critica';        // no alcanza a reponer a tiempo
  else if (diasCobertura <= leadTime * 1.5) urgencia = 'alta';
  else if (necesitaReposicion) urgencia = 'media';

  let razon: string;
  if (stockNeto <= 0 && input.demandaComprometida > 0) razon = 'Stock comprometido excede el disponible';
  else if (stockNeto <= 0) razon = 'Sin stock disponible';
  else if (diasCobertura <= leadTime) razon = `Cobertura ${diasCobertura}d < lead time ${leadTime}d`;
  else razon = `Por debajo del punto de reorden (${puntoReorden} u)`;

  // Score de prioridad (para ordenar las alertas que sí necesitan acción).
  let scorePrioridad = 0;
  if (urgencia === 'critica') scorePrioridad += 50;
  else if (urgencia === 'alta') scorePrioridad += 35;
  else if (urgencia === 'media') scorePrioridad += 20;
  scorePrioridad += Math.min(velocidad * 5, 30);                   // más velocidad = más impacto del quiebre
  scorePrioridad += Math.min(Math.max(puntoReorden - stockNeto, 0), 20); // déficit

  return {
    productoId: input.productoId,
    sku: input.sku,
    nombreComercial: input.nombreComercial,
    marca: input.marca,
    stockDisponible: input.stockDisponible,
    stockNeto,
    stockTotal: input.stockTotal,
    demandaComprometida: Math.max(0, input.demandaComprometida),
    velocidadDiaria: Math.round(velocidad * 100) / 100,
    leadTimeDias: leadTime,
    stockSeguridad,
    puntoReorden,
    diasCobertura,
    tieneSenalReal,
    necesitaReposicion,
    cantidadSugerida,
    urgencia,
    razon,
    scorePrioridad: Math.round(scorePrioridad),
  };
}

/**
 * Velocidad de venta robusta: toma la mayor entre la ventana corta (30d) y la larga (90d) para no
 * dejar que un 30d momentáneamente en 0 esconda a un producto que sí rota.
 */
export function velocidadRobusta(unidadesVendidas30d: number, unidadesVendidas90d: number): number {
  return Math.max(unidadesVendidas30d / 30, unidadesVendidas90d / 90);
}

/**
 * Desviación estándar poblacional (días) de una muestra de lead times.
 */
export function desviacionEstandar(valores: number[]): number {
  if (valores.length === 0) return 0;
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  const varianza = valores.reduce((s, v) => s + (v - media) ** 2, 0) / valores.length;
  return Math.sqrt(varianza);
}

/**
 * Genera SOLO las alertas que necesitan reposición, ordenadas por prioridad descendente.
 */
export function generarAlertasReposicion(
  inputs: ReordenInput[],
  politica: PoliticaReorden = POLITICA_REORDEN_DEFAULT
): AlertaReposicion[] {
  return inputs
    .map(i => evaluarReorden(i, politica))
    .filter(a => a.necesitaReposicion)
    .sort((a, b) => b.scorePrioridad - a.scorePrioridad);
}
