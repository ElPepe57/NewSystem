import type { Timestamp } from 'firebase/firestore';

/**
 * S54 · Tanda 2 — Modelo de Incidencias de OC.
 *
 * Una incidencia captura un problema identificado en el ciclo de vida de una OC
 * (recepción, facturación, cumplimiento del proveedor, etc.) y permite darle
 * seguimiento con acciones (reclamo, NC, retención, merma, reemplazo).
 *
 * Collection root: `incidenciasOC`
 * Índice mínimo: (ocId, estado, fechaCreacion desc)
 */

// ─────────────────────────────────────────────────────────────────────────────

export type TipoIncidenciaOC =
  | 'recepcion'     // Dañado, faltante, sobrante, mal lote, vencimiento corto
  | 'facturacion'   // Monto incorrecto, descuento no aplicado, IVA mal, duplicada
  | 'proveedor'     // Retraso vs SLA, calidad, cambio precio post-confirmación
  | 'logistica'     // Retraso courier, daño en tránsito, retención aduana
  | 'impuestos'     // Retenciones, devolución IGV, ajustes fiscales
  | 'compliance';   // Falta certificado origen, packing list incompleto

export type EstadoIncidenciaOC =
  | 'abierta'       // Recién creada, sin acción todavía
  | 'en_gestion'    // Hay acciones en curso (se escaló al proveedor, etc.)
  | 'resuelta'      // Cerrada con acción exitosa
  | 'escalada';     // Subida a gerencia / legal / otra instancia

export type TipoAccionIncidenciaOC =
  | 'reclamo_proveedor'  // Se contactó al proveedor pidiendo NC / reemplazo
  | 'nota_credito'       // El proveedor emitió una NC
  | 'retencion_pago'     // Se retuvo pago hasta resolución
  | 'merma'              // Se registró como pérdida asumida
  | 'reemplazo'          // Reemplazo físico acordado / recibido
  | 'nota';              // Comentario interno sin acción transaccional

export interface AccionIncidenciaOC {
  id: string;                           // ACT-{timestamp}
  tipo: TipoAccionIncidenciaOC;
  descripcion: string;
  montoUSD?: number;                    // Impacto económico de esta acción específica
  fecha: Timestamp;
  usuario: string;                      // ID del usuario que registró
  usuarioNombre?: string;               // Desnormalizado
  /** Referencias externas (ej: nro NC del proveedor, nro OC de reemplazo). */
  referencia?: string;
}

export interface IncidenciaOC {
  id: string;                           // ID autogenerado Firestore
  numero: string;                       // INC-OC-{YYYYMMDD}-{NNN}
  ocId: string;                         // ID de la OC
  ocNumero: string;                     // Desnormalizado (ej: OC-2026-001)
  proveedorId?: string;                 // Desnormalizado para queries cross-OC
  proveedorNombre?: string;

  // Clasificación
  tipo: TipoIncidenciaOC;
  estado: EstadoIncidenciaOC;
  severidad?: 'baja' | 'media' | 'alta' | 'critica';

  // Descripción
  titulo: string;                       // Línea principal (<= 120 chars)
  descripcion?: string;                 // Detalle libre

  // Impacto económico (si aplica)
  impactoEstimadoUSD?: number;          // Pérdida estimada inicial
  impactoRealUSD?: number;              // Pérdida real al cerrar (puede ser < estimado si hubo NC)

  // Contexto adicional
  envioId?: string;                     // Si aplica (incidencias de recepción vienen de un envío)
  envioNumero?: string;
  productoId?: string;                  // Si aplica a un SKU específico
  productoSku?: string;
  productoNombre?: string;
  lote?: string;
  cantidad?: number;                    // Unidades afectadas

  // Workflow
  creadoPor: string;
  creadoPorNombre?: string;
  fechaCreacion: Timestamp;
  asignadoA?: string;                   // Usuario responsable
  asignadoANombre?: string;
  fechaActualizacion?: Timestamp;

  // Resolución
  fechaResolucion?: Timestamp;
  resolucion?: string;                  // Resumen de cómo se resolvió
  resolvidoPor?: string;
  resolvidoPorNombre?: string;

  // Acciones (cronológicas)
  acciones?: AccionIncidenciaOC[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata visual (labels, colores, íconos).
// ─────────────────────────────────────────────────────────────────────────────

export const TIPO_INCIDENCIA_OC_META: Record<
  TipoIncidenciaOC,
  { label: string; emoji: string; colorClass: string }
> = {
  recepcion: { label: 'Recepción', emoji: '📦', colorClass: 'bg-red-100 text-red-800' },
  facturacion: { label: 'Facturación', emoji: '💵', colorClass: 'bg-amber-100 text-amber-800' },
  proveedor: { label: 'Proveedor', emoji: '🤝', colorClass: 'bg-purple-100 text-purple-800' },
  logistica: { label: 'Logística', emoji: '🚚', colorClass: 'bg-sky-100 text-sky-800' },
  impuestos: { label: 'Impuestos', emoji: '🧾', colorClass: 'bg-slate-100 text-slate-800' },
  compliance: { label: 'Compliance', emoji: '⚖️', colorClass: 'bg-teal-100 text-teal-800' },
};

export const ESTADO_INCIDENCIA_OC_META: Record<
  EstadoIncidenciaOC,
  { label: string; colorClass: string; dotClass: string }
> = {
  abierta: { label: 'Abierta', colorClass: 'bg-red-100 text-red-700', dotClass: 'bg-red-500' },
  en_gestion: { label: 'En gestión', colorClass: 'bg-amber-100 text-amber-700', dotClass: 'bg-amber-500' },
  resuelta: { label: 'Resuelta', colorClass: 'bg-emerald-100 text-emerald-700', dotClass: 'bg-emerald-500' },
  escalada: { label: 'Escalada', colorClass: 'bg-purple-100 text-purple-700', dotClass: 'bg-purple-500' },
};

export const TIPO_ACCION_META: Record<
  TipoAccionIncidenciaOC,
  { label: string; emoji: string }
> = {
  reclamo_proveedor: { label: 'Reclamo al proveedor', emoji: '📢' },
  nota_credito: { label: 'Nota de crédito', emoji: '📄' },
  retencion_pago: { label: 'Retención de pago', emoji: '🔒' },
  merma: { label: 'Registrar como merma', emoji: '📉' },
  reemplazo: { label: 'Reemplazo físico', emoji: '🔄' },
  nota: { label: 'Nota interna', emoji: '💬' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de creación (cliente-side para construir data antes de enviar a service).
// ─────────────────────────────────────────────────────────────────────────────

export interface NuevaIncidenciaOCInput {
  ocId: string;
  ocNumero: string;
  proveedorId?: string;
  proveedorNombre?: string;
  tipo: TipoIncidenciaOC;
  titulo: string;
  descripcion?: string;
  severidad?: IncidenciaOC['severidad'];
  impactoEstimadoUSD?: number;
  envioId?: string;
  envioNumero?: string;
  productoId?: string;
  productoSku?: string;
  productoNombre?: string;
  lote?: string;
  cantidad?: number;
}

export interface NuevaAccionIncidenciaInput {
  tipo: TipoAccionIncidenciaOC;
  descripcion: string;
  montoUSD?: number;
  referencia?: string;
}
