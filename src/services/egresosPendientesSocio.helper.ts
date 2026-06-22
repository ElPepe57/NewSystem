/**
 * egresosPendientesSocio.helper · F4 · NORMALIZADOR de egresos pendientes de firma de socio.
 *
 * La bandeja unificada de autorizaciones NO reinventa lógica: AGREGA los egresos de los 3
 * módulos (requerimientos, gastos, OC) a un shape único `EgresoPendiente` y delega la regla de
 * firma al helper ya existente (autorizacionEgreso.helper · evaluarFirmaSocio). Acá solo se
 * absorbe la DIVERGENCIA de campos:
 *   - Requerimientos: firmas en `aprobaciones.firmas` · estado 'pendiente'/'pendiente_aprobacion'.
 *   - Gastos / OC:     firmas en `autorizacion.firmas` · `autorizacion.estado` 'pendiente'/'aprobado'.
 *
 * Sin I/O · puro · testeable.
 */

import {
  type FirmaSocio,
  requiereAutorizacionSocio,
  firmasSocioRequeridas,
  evaluarFirmaSocio,
} from './autorizacionEgreso.helper';
import { montoUSDDeGasto } from './gasto.service';
import type { Requerimiento } from '../types/requerimiento.types';
import type { Gasto } from '../types/gasto.types';
import type { OrdenCompra } from '../types/ordenCompra.types';

export type OrigenEgreso = 'requerimiento' | 'gasto' | 'oc';

export interface EgresoPendiente {
  origen: OrigenEgreso;
  id: string;
  numero: string;
  /** Descriptor corto para la card (descripción del gasto, proveedor de la OC, etc.). */
  descripcion?: string;
  /** Monto USD landed (base del tramo de autorización). */
  montoUSD: number;
  /** Firmas de socio ya registradas. */
  firmas: FirmaSocio[];
  /** Quién creó/solicitó el egreso (para segregación). */
  creadoPor?: string;
  /** Firmas de socio que faltan para autorizar. */
  faltanFirmas: number;
  /** El egreso fue rechazado o cancelado · NO es pendiente (sale de la bandeja). */
  descartado: boolean;
  /** Timestamp de creación (opaco · para fechaRelativa en la UI). */
  fecha?: unknown;
}

function faltan(montoUSD: number, firmas: FirmaSocio[]): number {
  return Math.max(0, firmasSocioRequeridas(montoUSD) - firmas.length);
}

export function requerimientoAEgreso(r: Requerimiento): EgresoPendiente {
  const montoUSD = r.montoEstimadoUSD || 0;
  const firmas = r.aprobaciones?.firmas || [];
  return {
    origen: 'requerimiento',
    id: r.id,
    numero: r.numeroRequerimiento,
    montoUSD,
    firmas,
    creadoPor: r.creadoPor || (r as { solicitadoPor?: string }).solicitadoPor,
    faltanFirmas: faltan(montoUSD, firmas),
    descartado: r.estado === 'cancelado',
    fecha: (r as { fechaCreacion?: unknown }).fechaCreacion,
  };
}

export function gastoAEgreso(g: Gasto): EgresoPendiente {
  const montoUSD = montoUSDDeGasto(g);
  const firmas = g.autorizacion?.firmas || [];
  return {
    origen: 'gasto',
    id: g.id,
    numero: g.numeroGasto,
    descripcion: g.descripcion,
    montoUSD,
    firmas,
    creadoPor: g.creadoPor,
    faltanFirmas: faltan(montoUSD, firmas),
    descartado: g.autorizacion?.estado === 'rechazado' || g.estado === 'cancelado',
    fecha: g.fechaCreacion,
  };
}

export function ocAEgreso(o: OrdenCompra): EgresoPendiente {
  const montoUSD = o.totalUSD || 0;
  const firmas = o.autorizacion?.firmas || [];
  return {
    origen: 'oc',
    id: o.id,
    numero: o.numeroOrden,
    descripcion: o.nombreProveedor,
    montoUSD,
    firmas,
    creadoPor: o.creadoPor,
    faltanFirmas: faltan(montoUSD, firmas),
    descartado: o.autorizacion?.estado === 'rechazado' || o.estado === 'cancelada',
    fecha: o.fechaCreacion,
  };
}

/** ¿este egreso requiere firma de socio y aún le falta alguna? (filtro de la bandeja). */
export function esPendienteDeFirma(e: EgresoPendiente): boolean {
  return requiereAutorizacionSocio(e.montoUSD) && e.faltanFirmas > 0 && !e.descartado;
}

/** ¿este usuario puede firmar este egreso AHORA? (socio · no creador · no firmó ya). */
export function puedoFirmar(e: EgresoPendiente, userId: string, esSocio: boolean): boolean {
  return evaluarFirmaSocio({ montoUSD: e.montoUSD, firmas: e.firmas, userId, esSocio, creadorId: e.creadoPor }).ok;
}

/** ¿el usuario ya firmó este egreso? (para "Mis aprobaciones dadas" · query reversa). */
export function firmadoPorMi(e: EgresoPendiente, userId: string): boolean {
  return e.firmas.some((f) => f.usuarioId === userId);
}

/** ¿el egreso quedó totalmente autorizado? (todas las firmas de socio requeridas presentes). */
export function autorizacionCompleta(e: EgresoPendiente): boolean {
  return e.faltanFirmas === 0;
}

/** Fecha (Timestamp opaco) de la firma de ESTE usuario, si existe. */
export function fechaMiFirma(e: EgresoPendiente, userId: string): unknown {
  return e.firmas.find((f) => f.usuarioId === userId)?.fecha;
}

/** Texto del chip de progreso. Ej: "Falta tu firma (0/2)" · "Falta 1 socio (1/2)". */
export function chipFirma(e: EgresoPendiente): string {
  const req = firmasSocioRequeridas(e.montoUSD);
  const hechas = e.firmas.length;
  const detalle = e.faltanFirmas >= req
    ? 'Falta tu firma'
    : `Falta ${e.faltanFirmas} socio${e.faltanFirmas === 1 ? '' : 's'}`;
  return `${detalle} (${hechas}/${req})`;
}

/** Etiqueta legible del origen para la card. */
export const LABEL_ORIGEN: Record<OrigenEgreso, string> = {
  requerimiento: 'Requerimiento',
  gasto: 'Gasto',
  oc: 'Orden de compra',
};
