/**
 * planilla.types.ts
 *
 * Tipos para el módulo de Planilla (TAREA-103).
 * Control interno de nómina: sueldos, comisiones automáticas, adelantos, boletas PDF.
 * Microempresa informal — sin EsSalud, CTS, AFP.
 */
import { Timestamp } from 'firebase/firestore';
import type { MetodoPagoUnificado } from './pago.types';

// ============================================
// PERFIL LABORAL (subcoleccion users/{uid}/private/laboral)
// ============================================

export type TipoEmpleado = 'empleado' | 'comisionista' | 'externo';

export type TipoComision = 'porcentaje_venta' | 'monto_fijo';

export interface EsquemaComision {
  tipo: TipoComision;
  porcentaje?: number;             // ej: 3% sobre totalPEN de la venta
  montoFijo?: number;              // ej: S/ 5 por venta
  aplicaALineas?: string[];        // null/undefined = todas las lineas
}

export interface PerfilLaboral {
  tipo: TipoEmpleado;
  salarioBase?: number;            // mensual PEN (null para comisionistas puros)
  monedaSalario: 'PEN' | 'USD';
  esquemaComision?: EsquemaComision;
  lineaNegocioId?: string;         // si cobra de una linea especifica
  banco?: string;
  numeroCuenta?: string;
  cci?: string;
  activo: boolean;
}

// ============================================
// EMPLEADO (UserProfile + PerfilLaboral combinados para UI)
// ============================================

export interface EmpleadoConPerfil {
  uid: string;
  displayName: string;
  email: string;
  cargo?: string;
  role: string;
  activo: boolean;
  perfilLaboral?: PerfilLaboral;
}

// ============================================
// BOLETA DE PAGO
// ============================================

export type EstadoBoleta = 'borrador' | 'aprobada' | 'pagada' | 'anulada';

export interface DetalleComision {
  ventaId: string;
  ventaNumero: string;
  montoVenta: number;
  porcentaje: number;
  montoComision: number;
}

export interface DetalleAdelanto {
  adelantoId: string;
  monto: number;
}

export interface Boleta {
  id: string;                        // BOL-2026-04-001
  userId: string;                    // FK -> users/{uid}
  empleadoNombre: string;
  empleadoCargo?: string;

  // Periodo
  mes: number;                       // 1-12
  anio: number;

  // Ingresos
  salarioBase: number;
  comisionesVentas: number;
  bonificaciones: number;
  otrosIngresos: number;
  totalBruto: number;

  // Detalle comisiones (trazabilidad)
  detalleComisiones: DetalleComision[];

  // Descuentos
  adelantos: number;
  otrosDescuentos: number;
  totalDescuentos: number;

  // Detalle adelantos descontados
  detalleAdelantos: DetalleAdelanto[];

  // Neto
  totalNeto: number;

  // Estado y pago
  estado: EstadoBoleta;

  // Gastos generados automáticamente
  gastoNominaId?: string;
  gastoComisionId?: string;
  movimientoTesoreriaId?: string;

  // Linea de negocio
  lineaNegocioId?: string;

  // Auditoria
  creadoPor: string;
  fechaCreacion: Timestamp;
  aprobadoPor?: string;
  fechaAprobacion?: Timestamp;
}

// ============================================
// ADELANTO DE NÓMINA
// ============================================

export type TipoAdelanto = 'adelanto_sueldo' | 'reembolso_gasto' | 'prestamo';
export type EstadoAdelanto = 'pendiente' | 'pagado' | 'descontado' | 'anulado';

export interface AdelantoNomina {
  id: string;                        // ADL-2026-001
  userId: string;
  empleadoNombre: string;

  tipo: TipoAdelanto;
  descripcion: string;

  monto: number;
  moneda: 'PEN' | 'USD';
  tipoCambio?: number;
  montoPEN: number;

  // Estado
  estado: EstadoAdelanto;

  // Pago del adelanto
  movimientoTesoreriaId?: string;

  // Descuento en boleta
  boletaDescontadaId?: string;

  // Linea de negocio
  lineaNegocioId?: string;

  // Auditoria
  fecha: Timestamp;
  creadoPor: string;
  fechaCreacion: Timestamp;
}

// ============================================
// FORM DATA
// ============================================

export interface PerfilLaboralFormData {
  tipo: TipoEmpleado;
  salarioBase?: number;
  monedaSalario: 'PEN' | 'USD';
  esquemaComision?: EsquemaComision;
  lineaNegocioId?: string;
  banco?: string;
  numeroCuenta?: string;
  cci?: string;
}

export interface AdelantoFormData {
  userId: string;
  empleadoNombre: string;
  tipo: TipoAdelanto;
  descripcion: string;
  monto: number;
  moneda: 'PEN' | 'USD';
  tipoCambio?: number;
  lineaNegocioId?: string;
}

export interface BoletaAjustes {
  bonificaciones: number;
  otrosIngresos: number;
  otrosDescuentos: number;
}

// ============================================
// LABELS
// ============================================

export const TIPO_EMPLEADO_LABELS: Record<TipoEmpleado, string> = {
  empleado: 'Empleado',
  comisionista: 'Comisionista',
  externo: 'Externo',
};

export const TIPO_ADELANTO_LABELS: Record<TipoAdelanto, string> = {
  adelanto_sueldo: 'Adelanto de sueldo',
  reembolso_gasto: 'Reembolso de gasto',
  prestamo: 'Préstamo',
};

export const ESTADO_ADELANTO_LABELS: Record<EstadoAdelanto, string> = {
  pendiente: 'Pendiente',
  pagado: 'Pagado',
  descontado: 'Descontado',
  anulado: 'Anulado',
};

export const ESTADO_BOLETA_LABELS: Record<EstadoBoleta, string> = {
  borrador: 'Borrador',
  aprobada: 'Aprobada',
  pagada: 'Pagada',
  anulada: 'Anulada',
};
