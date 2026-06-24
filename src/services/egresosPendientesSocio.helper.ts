/**
 * egresosPendientesSocio.helper · F2 · NORMALIZADOR de egresos pendientes de firma de socio.
 *
 * La bandeja unificada de autorizaciones de SOCIO agrega los egresos de gastos + OC (quórum de equity)
 * a un shape único `EgresoPendiente` y delega la regla al helper puro (autorizacionEgreso.helper ·
 * evaluarAprobacionEgreso). El requerimiento NO está acá: es autoridad de CARGO (se aprueba en su
 * módulo · decisión 2026-06-22).
 *
 * El estado (pendiente/aprobado/rechazado) se lee del campo PERSISTIDO que la CF setea (autoritativo),
 * NO se recomputa por conteo de firmas (bajo el modelo de equity el conteo no determina la mayoría).
 *
 * Sin I/O · puro · testeable.
 */

import {
  type FirmaSocio,
  type SocioEquity,
  type FirmaEgreso,
  requiereAutorizacionSocio,
  evaluarAprobacionEgreso,
} from './autorizacionEgreso.helper';
import { montoUSDDeGasto } from './gasto.service';
import type { Requerimiento } from '../types/requerimiento.types';
import type { Gasto } from '../types/gasto.types';
import type { OrdenCompra } from '../types/ordenCompra.types';
import type { Envio } from '../types/envio.types';
import type { Devolucion } from '../types/devolucion.types';
import type { AjusteConciliacionDoc } from './tesoreria.ajustes.service';

export type OrigenEgreso = 'requerimiento' | 'gasto' | 'oc' | 'retiro' | 'envio' | 'devolucion' | 'ajuste';

/** Shape mínimo del doc retirosCapital que la bandeja necesita (F3c · sin-ref · autorización standalone). */
export interface RetiroCapitalDoc {
  id: string;
  numeroMovimiento?: string;
  monto: number;
  moneda: string;
  tipoCambio: number;
  tipoRetiro?: string;
  socioNombre?: string;
  creadoPor?: string;
  estado?: string;
  autorizacion?: { estado?: string; firmas?: FirmaSocio[] };
  fechaCreacion?: unknown;
}

export interface EgresoPendiente {
  origen: OrigenEgreso;
  id: string;
  numero: string;
  /** Descriptor corto para la card (descripción del gasto, proveedor de la OC, etc.). */
  descripcion?: string;
  /** Monto USD landed (base del tramo de autorización). */
  montoUSD: number;
  /** Firmas de socio ya registradas (con `representaSocios` · escritas por la CF). */
  firmas: FirmaSocio[];
  /** Quién creó/solicitó el egreso (para segregación). */
  creadoPor?: string;
  /** El egreso ya quedó autorizado (estado PERSISTIDO · la CF lo setea al alcanzar la mayoría de equity). */
  aprobado: boolean;
  /** El egreso fue rechazado o cancelado · NO es pendiente (sale de la bandeja). */
  descartado: boolean;
  /** Timestamp de creación (opaco · para fechaRelativa en la UI). */
  fecha?: unknown;
}

export function requerimientoAEgreso(r: Requerimiento): EgresoPendiente {
  const montoUSD = r.montoEstimadoUSD || 0;
  return {
    origen: 'requerimiento',
    id: r.id,
    numero: r.numeroRequerimiento,
    montoUSD,
    firmas: r.aprobaciones?.firmas || [],
    creadoPor: r.creadoPor || (r as { solicitadoPor?: string }).solicitadoPor,
    aprobado: r.estado === 'aprobado',
    descartado: r.estado === 'cancelado',
    fecha: (r as { fechaCreacion?: unknown }).fechaCreacion,
  };
}

export function gastoAEgreso(g: Gasto): EgresoPendiente {
  const montoUSD = montoUSDDeGasto(g);
  return {
    origen: 'gasto',
    id: g.id,
    numero: g.numeroGasto,
    descripcion: g.descripcion,
    montoUSD,
    firmas: g.autorizacion?.firmas || [],
    creadoPor: g.creadoPor,
    aprobado: g.autorizacion?.estado === 'aprobado',
    // review chaining-edges#3 · un gasto ya pagado sale de la bandeja (no reaparece pidiendo firma).
    descartado: g.autorizacion?.estado === 'rechazado' || g.estado === 'cancelado' || g.estado === 'pagado',
    fecha: g.fechaCreacion,
  };
}

export function ocAEgreso(o: OrdenCompra): EgresoPendiente {
  const montoUSD = o.totalUSD || 0;
  return {
    origen: 'oc',
    id: o.id,
    numero: o.numeroOrden,
    descripcion: o.nombreProveedor,
    montoUSD,
    firmas: o.autorizacion?.firmas || [],
    creadoPor: o.creadoPor,
    aprobado: o.autorizacion?.estado === 'aprobado',
    // review chaining-edges#3 · una OC ya pagada sale de la bandeja (no reaparece pidiendo firma).
    descartado: o.autorizacion?.estado === 'rechazado' || o.estado === 'cancelada' || o.estadoPago === 'pagado',
    fecha: o.fechaCreacion,
  };
}

/**
 * F3c · retiro de socio (sin-ref · autorización standalone). El USD landed se recomputa de monto/moneda/TC
 * (igual que la CF autorizarEgreso). Un retiro 'ejecutado' ya movió cash → descartado (sale de la bandeja).
 * El número definitivo (MOV-) recién existe al ejecutar · mientras pende usa un RET- derivado del id.
 */
export function retiroAEgreso(r: RetiroCapitalDoc): EgresoPendiente {
  const montoUSD = r.moneda === 'USD' ? r.monto : r.tipoCambio > 0 ? r.monto / r.tipoCambio : 0;
  return {
    origen: 'retiro',
    id: r.id,
    numero: r.numeroMovimiento ?? `RET-${r.id.slice(0, 6)}`,
    descripcion: `${r.tipoRetiro ?? 'retiro'} · ${r.socioNombre ?? ''}`.trim(),
    montoUSD,
    firmas: r.autorizacion?.firmas || [],
    creadoPor: r.creadoPor,
    aprobado: r.autorizacion?.estado === 'aprobado',
    descartado: r.autorizacion?.estado === 'rechazado' || r.estado === 'cancelado' || r.estado === 'ejecutado',
    fecha: r.fechaCreacion,
  };
}

/**
 * F3c · pago de flete de un envío (egreso referenciado · USD = costoFleteTotal por convención). Sale de la
 * bandeja cuando se aprueba, se paga (estadoPagoColaborador='pagado'), se cancela, o si aún es borrador
 * (no comprometido). La autorización la inicializa la CF en la primera firma (como gasto/OC).
 */
/**
 * A.2 · reembolso a cliente (egreso referenciado a la devolución). El USD landed = montoEstimadoUSD (montoDevolucion/TC,
 * guardado al crear). Sale de la bandeja cuando se aprueba, se completa (cash pagado), se cancela o se rechaza.
 * La autorización la inicializa la CF en la 1ª firma (como envío).
 */
export function devolucionAEgreso(d: Devolucion): EgresoPendiente {
  return {
    origen: 'devolucion',
    id: d.id,
    numero: d.numeroDevolucion,
    descripcion: `Reembolso · ${d.clienteNombre ?? 'cliente'}`,
    montoUSD: d.montoEstimadoUSD || 0,
    firmas: d.autorizacion?.firmas || [],
    creadoPor: d.creadoPor,
    aprobado: d.autorizacion?.estado === 'aprobado',
    descartado: d.autorizacion?.estado === 'rechazado' || d.estado === 'completada' || d.estado === 'cancelada' || d.estado === 'rechazada',
    fecha: d.fechaCreacion,
  };
}

/**
 * A.2 · ajuste de conciliación negativo >$1k (standalone · como retiro). USD = montoEstimadoUSD. Sale de la
 * bandeja al aprobarse+ejecutarse o cancelarse. La autorización la inicializa la CF en la 1ª firma.
 */
export function ajusteAEgreso(a: AjusteConciliacionDoc): EgresoPendiente {
  return {
    origen: 'ajuste',
    id: a.id,
    numero: `AJU-${a.id.slice(0, 6)}`,
    descripcion: `Ajuste · ${a.razon ?? 'conciliación'}`,
    montoUSD: a.montoEstimadoUSD || 0,
    firmas: a.autorizacion?.firmas || [],
    creadoPor: a.creadoPor,
    aprobado: a.autorizacion?.estado === 'aprobado',
    descartado: a.autorizacion?.estado === 'rechazado' || a.estado === 'ejecutado' || a.estado === 'cancelado',
    fecha: a.fechaCreacion,
  };
}

export function envioAEgreso(e: Envio): EgresoPendiente {
  return {
    origen: 'envio',
    id: e.id,
    numero: e.numeroEnvio,
    descripcion: `Flete · ${e.colaboradorNombre ?? 'colaborador'}`,
    montoUSD: e.costoFleteTotal || 0,
    firmas: e.autorizacion?.firmas || [],
    creadoPor: e.creadoPor,
    aprobado: e.autorizacion?.estado === 'aprobado',
    descartado: e.autorizacion?.estado === 'rechazado' || e.estadoPagoColaborador === 'pagado' || e.estado === 'borrador' || e.estado === 'cancelada',
    fecha: e.fechaCreacion,
  };
}

/** ¿este egreso requiere firma de socio y aún está pendiente? (filtro de la bandeja). */
export function esPendienteDeFirma(e: EgresoPendiente): boolean {
  return requiereAutorizacionSocio(e.montoUSD) && !e.aprobado && !e.descartado;
}

/** ¿este usuario puede firmar este egreso AHORA? (socio · no creador · no firmó · no completo/descartado). */
export function puedoFirmar(e: EgresoPendiente, userId: string, esSocio: boolean): boolean {
  return esSocio && !e.aprobado && !e.descartado && e.creadoPor !== userId && !firmadoPorMi(e, userId);
}

/** ¿el usuario ya firmó este egreso? (para "Mis aprobaciones dadas" · query reversa). */
export function firmadoPorMi(e: EgresoPendiente, userId: string): boolean {
  return e.firmas.some((f) => f.usuarioId === userId);
}

/** ¿el egreso quedó totalmente autorizado? (estado persistido · la CF lo setea al alcanzar la mayoría). */
export function autorizacionCompleta(e: EgresoPendiente): boolean {
  return e.aprobado;
}

/** Fecha (Timestamp opaco) de la firma de ESTE usuario, si existe. */
export function fechaMiFirma(e: EgresoPendiente, userId: string): unknown {
  return e.firmas.find((f) => f.usuarioId === userId)?.fecha;
}

export interface ProgresoEquity {
  equityFirmado: number;
  equityElegible: number;
  equityFaltante: number;
  /** % del equity elegible ya firmado (0-100). */
  pctFirmado: number;
  completa: boolean;
}

/** Progreso de autorización por EQUITY (mayoría >50% del equity elegible · creador excluido). */
export function progresoEquity(e: EgresoPendiente, socios: SocioEquity[]): ProgresoEquity {
  const firmas: FirmaEgreso[] = e.firmas.map((f) => ({
    usuarioId: f.usuarioId,
    representaSocios: f.representaSocios ?? [f.usuarioId],
  }));
  const r = evaluarAprobacionEgreso({ montoUSD: e.montoUSD, socios, creadorId: e.creadoPor, firmas });
  const pctFirmado = r.equityElegible > 0 ? (r.equityFirmado / r.equityElegible) * 100 : 0;
  return {
    equityFirmado: r.equityFirmado,
    equityElegible: r.equityElegible,
    equityFaltante: r.equityFaltante,
    pctFirmado,
    completa: r.completa,
  };
}

/** Texto del chip de progreso por equity (para la card de la bandeja). */
export function chipFirma(e: EgresoPendiente, socios: SocioEquity[]): string {
  if (e.aprobado) return 'Autorizado';
  const p = progresoEquity(e, socios);
  if (p.equityElegible <= 0) return 'Requiere aprobación de admin';
  if (p.equityFirmado <= 0) return 'Falta firma de socios · mayoría >50%';
  return `${p.pctFirmado.toFixed(0)}% del equity firmado · falta la mayoría (>50%)`;
}

/** Etiqueta legible del origen para la card. */
export const LABEL_ORIGEN: Record<OrigenEgreso, string> = {
  requerimiento: 'Requerimiento',
  gasto: 'Gasto',
  oc: 'Orden de compra',
  retiro: 'Retiro de socio',
  envio: 'Flete de envío',
  devolucion: 'Reembolso a cliente',
  ajuste: 'Ajuste de conciliación',
};
