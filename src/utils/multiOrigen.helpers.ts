/**
 * ===============================================
 * HELPERS DE BACKWARD COMPATIBILITY — Multi-Origen
 * ===============================================
 *
 * Funciones utilitarias para manejar la transición de
 * estados/tipos hardcoded a USA hacia estados genéricos multi-origen.
 *
 * Principio: El código nuevo usa valores genéricos, pero acepta
 * los valores legacy sin romper nada.
 */

import type { EstadoUnidad } from '../types/unidad.types';
import type { TipoTransferencia } from '../types/transferencia.types';
import type { TipoGasto } from '../types/gasto.types';
import type { EstadoAsignacion } from '../types/requerimiento.types';
import { PAISES_CONFIG } from '../types/almacen.types';

// ============================================================
// ESTADOS DE UNIDAD — Normalización
// ============================================================

/**
 * Normaliza un estado de unidad legacy a su equivalente genérico.
 * recibida_usa → recibida_origen
 * en_transito_usa → en_transito_origen
 * Otros estados se devuelven tal cual.
 */
export const normalizarEstadoUnidad = (estado: EstadoUnidad): EstadoUnidad => {
  switch (estado) {
    case 'recibida_usa': return 'recibida_origen';
    case 'en_transito_usa': return 'en_transito_origen';
    default: return estado;
  }
};

/**
 * Verifica si un estado es "en origen" (genérico + legacy)
 */
export const esEstadoEnOrigen = (estado: EstadoUnidad): boolean => {
  return estado === 'recibida_origen' || estado === 'recibida_usa';
};

/**
 * Verifica si un estado es "en tránsito interno de origen" (genérico + legacy)
 */
export const esEstadoEnTransitoOrigen = (estado: EstadoUnidad): boolean => {
  return estado === 'en_transito_origen' || estado === 'en_transito_usa';
};

/**
 * Verifica si una unidad está en algún estado de origen (no en Perú)
 */
export const esEstadoFueraDePerú = (estado: EstadoUnidad): boolean => {
  return esEstadoEnOrigen(estado) || esEstadoEnTransitoOrigen(estado) || estado === 'en_transito_peru';
};

/**
 * Verifica si una unidad es "activa" (no vendida, no vencida, no dañada)
 */
export const esEstadoActivo = (estado: EstadoUnidad): boolean => {
  return esEstadoEnOrigen(estado)
    || esEstadoEnTransitoOrigen(estado)
    || estado === 'en_transito_peru'
    || estado === 'disponible_peru'
    || estado === 'reservada'
    || estado === 'asignada_pedido';
};

// ============================================================
// TIPOS DE TRANSFERENCIA — Normalización
// ============================================================

/**
 * Normaliza un tipo de transferencia legacy a su equivalente genérico.
 * interna_usa → interna_origen
 * usa_peru → internacional_peru
 */
export const normalizarTipoTransferencia = (tipo: TipoTransferencia): TipoTransferencia => {
  switch (tipo) {
    case 'interna_usa': return 'interna_origen';
    case 'usa_peru': return 'internacional_peru';
    default: return tipo;
  }
};

/**
 * Verifica si un tipo es transferencia interna (genérico + legacy)
 */
export const esTipoTransferenciaInterna = (tipo: TipoTransferencia): boolean => {
  return tipo === 'interna_origen' || tipo === 'interna_usa';
};

/**
 * Verifica si un tipo es transferencia internacional (genérico + legacy)
 */
export const esTipoTransferenciaInternacional = (tipo: TipoTransferencia): boolean => {
  return tipo === 'internacional_peru' || tipo === 'usa_peru';
};

// ============================================================
// TIPOS DE GASTO — Normalización
// ============================================================

/**
 * Normaliza un tipo de gasto legacy.
 * flete_usa_peru → flete_internacional
 */
export const normalizarTipoGasto = (tipo: TipoGasto): TipoGasto => {
  if (tipo === 'flete_usa_peru') return 'flete_internacional';
  return tipo;
};

/**
 * Verifica si un tipo de gasto es flete internacional (genérico + legacy)
 */
export const esFleteInternacional = (tipo: TipoGasto): boolean => {
  return tipo === 'flete_internacional' || tipo === 'flete_usa_peru';
};

// ============================================================
// ESTADOS DE ASIGNACIÓN (Requerimientos) — Normalización
// ============================================================

/**
 * Normaliza un estado de asignación legacy.
 * en_almacen_usa → en_almacen_origen
 */
export const normalizarEstadoAsignacion = (estado: EstadoAsignacion): EstadoAsignacion => {
  if (estado === 'en_almacen_usa') return 'en_almacen_origen';
  return estado;
};

/**
 * Verifica si una asignación está en almacén de origen (genérico + legacy)
 */
export const esEstadoEnAlmacenOrigen = (estado: EstadoAsignacion): boolean => {
  return estado === 'en_almacen_origen' || estado === 'en_almacen_usa';
};

// ============================================================
// PRODUCTO — Costo de flete con backward compat
// ============================================================

/**
 * Obtiene el costo de flete internacional de un producto,
 * leyendo el campo nuevo o el legacy.
 */
export const getCostoFleteInternacional = (_producto: {
  costoFleteInternacional?: number;
}): number => {
  // Freight cost now comes from route/paisOrigen config, not from the product
  return _producto.costoFleteInternacional ?? 0;
};

// ============================================================
// PAÍS — Display helpers
// ============================================================

/**
 * Obtiene el emoji de bandera para un país
 */
export const getPaisEmoji = (pais: string): string => {
  return PAISES_CONFIG[pais]?.emoji || '🌍';
};

/**
 * Obtiene el nombre display de un país
 */
export const getPaisNombre = (pais: string): string => {
  return PAISES_CONFIG[pais]?.nombre || pais;
};

/**
 * Verifica si un país es de origen (no destino)
 */
export const esPaisOrigen = (pais: string): boolean => {
  return PAISES_CONFIG[pais]?.esOrigen ?? true;
};

// ============================================================
// LABELS DINÁMICOS — Para UI
// ============================================================

/**
 * Genera el label de estado de unidad con el país dinámico
 */
export const getLabelEstadoUnidad = (estado: EstadoUnidad, pais?: string): string => {
  const paisLabel = pais ? getPaisEmoji(pais) : '';
  const estadoNorm = normalizarEstadoUnidad(estado);

  const labels: Record<string, string> = {
    'recibida_origen': `${paisLabel} Recibida${pais ? ` ${pais}` : ' Origen'}`,
    'en_transito_origen': `${paisLabel} En Tránsito${pais ? ` ${pais}` : ' Origen'}`,
    'en_transito_peru': '✈️ En Tránsito → Perú',
    'disponible_peru': '🇵🇪 Disponible Perú',
    'reservada': '📦 Reservada',
    'asignada_pedido': '📋 Asignada a Pedido',
    'vendida': '✅ Vendida',
    'vencida': '⚠️ Vencida',
    'danada': '❌ Dañada',
  };

  return labels[estadoNorm] || estado;
};

/**
 * Genera el label de estado de asignación con país dinámico
 */
export const getLabelEstadoAsignacion = (estado: EstadoAsignacion, pais?: string): string => {
  const paisLabel = pais ? `${getPaisEmoji(pais)} ` : '';
  const estadoNorm = normalizarEstadoAsignacion(estado);

  const labels: Record<string, string> = {
    'pendiente': 'Pendiente',
    'comprando': `${paisLabel}Comprando`,
    'comprado': 'Comprado',
    'en_almacen_origen': `${paisLabel}En Almacén`,
    'en_transito': 'En Tránsito → Perú',
    'recibido': 'Recibido en Perú',
    'cancelado': 'Cancelado',
  };

  return labels[estadoNorm] || estado;
};

/**
 * Genera el label de tipo de transferencia
 */
export const getLabelTipoTransferencia = (tipo: TipoTransferencia, paisOrigen?: string): string => {
  const tipoNorm = normalizarTipoTransferencia(tipo);
  if (tipoNorm === 'interna_origen') {
    return paisOrigen ? `Interna ${paisOrigen}` : 'Interna Origen';
  }
  if (tipoNorm === 'internacional_peru') {
    return paisOrigen ? `${paisOrigen} → Perú` : 'Internacional → Perú';
  }
  return tipo;
};
