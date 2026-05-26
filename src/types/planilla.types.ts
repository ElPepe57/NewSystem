/**
 * planilla.types.ts
 *
 * Tipos para el módulo de Planilla (TAREA-103 + chk5.PERSONAS-v5.4 · 2026-05-26).
 * Control interno de nómina: sueldos, comisiones automáticas, adelantos, boletas PDF.
 * Microempresa informal — sin EsSalud, CTS, AFP.
 *
 * EXTENSIÓN v5.4 (F3 ROADMAP personas):
 *  - HistorialSalarial · trazabilidad de variaciones salariales
 *  - EsquemaIncentivo + 4 tipos config (comision · bono_meta · bono_kpi · bono_fijo)
 *  - CalculoIncentivoMes · resultado mensual por empleado
 *  - LiquidacionEmpleado · baja con liquidación
 *  - Gratificacion · jul/dic Perú (NO CTS · Vita Skin no paga CTS)
 *  - BonificacionIncentivo · línea de detalle en boleta
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

  // ========== F-DatosBanc · Datos bancarios pasivos (S58c) ==========
  // Cuentas/billeteras del empleado. Útiles para pagar nómina, adelantos,
  // comisiones. Solo referencia (sin saldo trackeado). Los campos legacy
  // banco/numeroCuenta/cci se mantienen — datosBancarios es un superset
  // estructurado (puede contener múltiples cuentas).
  datosBancarios?: import('./tesoreria.types').DatoBancarioPasivo[];
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

// ════════════════════════════════════════════════════════════════════════
// chk5.PERSONAS-v5.4 · F3 · MODELOS NUEVOS (2026-05-26)
// Diseño en docs/PLANILLA-v5.4-INCENTIVOS-360.md
// ════════════════════════════════════════════════════════════════════════

// ============================================
// HISTORIAL SALARIAL · trazabilidad de variaciones
// ============================================

export type RazonVariacionSalarial =
  | 'ajuste_anual'
  | 'promocion'
  | 'reasignacion_cargo'
  | 'merito'
  | 'correccion'
  | 'otro';

export interface HistorialSalarial {
  id: string;                          // HSAL-2026-001
  userId: string;
  empleadoNombre: string;

  // Variación
  salarioAnterior: number;
  salarioNuevo: number;
  moneda: 'PEN' | 'USD';
  delta: number;                       // salarioNuevo - salarioAnterior
  porcentajeVariacion: number;         // delta / salarioAnterior * 100

  // Vigencia
  efectivoDesde: Timestamp;            // fecha desde la cual aplica el nuevo sueldo

  // Razón
  razon: RazonVariacionSalarial;
  notas?: string;

  // Auditoría
  registradoPor: string;               // uid del admin/gerente
  fechaRegistro: Timestamp;
}

export const RAZON_VARIACION_LABELS: Record<RazonVariacionSalarial, string> = {
  ajuste_anual: 'Ajuste anual',
  promocion: 'Promoción',
  reasignacion_cargo: 'Reasignación de cargo',
  merito: 'Mérito / Desempeño',
  correccion: 'Corrección',
  otro: 'Otro',
};

// ============================================
// ESQUEMAS DE INCENTIVO · 4 tipos canon
// ============================================

export type TipoIncentivo = 'comision' | 'bono_meta' | 'bono_kpi' | 'bono_fijo';

export type AplicabilidadIncentivo =
  | { modo: 'rol'; rol: string }                 // todos los users con este rol
  | { modo: 'usuarios'; userIds: string[] }      // lista específica
  | { modo: 'todos' };                           // todos los empleados activos

// --- Config Comisión (Ventas) ---
export type AplicarSobre = 'totalVenta' | 'margenContribucion' | 'monto';

export type ModeloComision = 'porcentaje_simple' | 'escalado' | 'monto_fijo_por_venta';

export interface EscalaComision {
  desdeS: number;                      // S/ mínimo del rango
  hastaS?: number;                     // S/ máximo del rango (null = sin tope)
  porcentaje: number;
}

export interface ConfigComision {
  aplicarSobre: AplicarSobre;
  modelo: ModeloComision;
  porcentaje?: number;                 // para modelo porcentaje_simple
  montoFijo?: number;                  // para modelo monto_fijo_por_venta
  escalas?: EscalaComision[];          // para modelo escalado
  soloLineas?: string[];               // opcional · filtrar por línea de negocio
  soloCanales?: string[];              // opcional · filtrar por canal de venta
}

// --- Config Bono Meta (Logística/Compras) ---
export type MetricaMeta =
  | 'cantidad_envios_entregados'
  | 'tasa_entrega_a_tiempo'
  | 'cantidad_ordenes_compra'
  | 'tasa_ordenes_completas'
  | 'cantidad_reclamos_resueltos'
  | 'custom';

export interface ConfigBonoMeta {
  metricaTracked: MetricaMeta;
  metricaCustomNombre?: string;        // si metricaTracked === 'custom'
  objetivoMensual: number;             // ej. 50 envíos
  bonoSiCumple: number;                // ej. S/ 300
  bonoExtraporExceso?: {
    porUnidad: number;                 // S/ por cada unidad sobre el objetivo
    topeMaximo?: number;                // S/ tope máximo de bono adicional
  };
}

// --- Config Bono KPI (Finanzas) ---
export type MetricaKPI =
  | 'cierre_mensual_antes_dia_5'
  | 'conciliacion_bancaria_completa'
  | 'reportes_a_tiempo'
  | 'dso_bajo_X_dias'
  | 'cartera_vencida_menor_X_pct'
  | 'custom';

export interface ConfigBonoKPI {
  metricaTracked: MetricaKPI;
  metricaCustomNombre?: string;
  formulaDescripcion: string;          // ej. "Si DSO < 30 días + cartera vencida < 10%"
  bonoSiCumple: number;
  evaluacionManual: boolean;           // true si requiere validación humana
}

// --- Config Bono Fijo (Gerencia) ---
export type FrecuenciaBonoFijo = 'mensual' | 'trimestral' | 'semestral' | 'anual';

export interface ConfigBonoFijo {
  monto: number;
  moneda: 'PEN' | 'USD';
  frecuencia: FrecuenciaBonoFijo;
  condicionado: boolean;               // true = sujeto a aprobación gerencial mensual
  condicion?: string;                  // descripción de la condición si aplica
}

// --- Esquema unificado (discriminado por tipo) ---
export interface EsquemaIncentivoBase {
  id: string;                          // ESQ-2026-001
  nombre: string;                      // ej. "Comisión vendedores Lima"
  descripcion?: string;
  tipo: TipoIncentivo;
  aplicableA: AplicabilidadIncentivo;
  activo: boolean;

  // Vigencia
  vigenteDesde: Timestamp;
  vigenteHasta?: Timestamp;            // null = indefinido

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  modificadoPor?: string;
  fechaModificacion?: Timestamp;
}

export type EsquemaIncentivo =
  | (EsquemaIncentivoBase & { tipo: 'comision'; configuracion: ConfigComision })
  | (EsquemaIncentivoBase & { tipo: 'bono_meta'; configuracion: ConfigBonoMeta })
  | (EsquemaIncentivoBase & { tipo: 'bono_kpi'; configuracion: ConfigBonoKPI })
  | (EsquemaIncentivoBase & { tipo: 'bono_fijo'; configuracion: ConfigBonoFijo });

export const TIPO_INCENTIVO_LABELS: Record<TipoIncentivo, string> = {
  comision: 'Comisión',
  bono_meta: 'Bono por meta',
  bono_kpi: 'Bono por KPI',
  bono_fijo: 'Bono fijo',
};

export const TIPO_INCENTIVO_DESCRIPCION: Record<TipoIncentivo, string> = {
  comision: 'Variable sobre ventas · típico para vendedores',
  bono_meta: 'Variable cuantitativa por cumplimiento de objetivos · típico logística/compras',
  bono_kpi: 'Variable cualitativa por indicadores de desempeño · típico finanzas',
  bono_fijo: 'Monto fijo recurrente (mensual/trimestral/semestral/anual) · típico gerencia',
};

// ============================================
// CÁLCULO DE INCENTIVOS · resultado mensual
// ============================================

export type EstadoCalculoIncentivo =
  | 'calculado'                        // recién calculado · pendiente revisión
  | 'aprobado'                         // gerente aprobó · listo para incluir en boleta
  | 'rechazado'                        // gerente rechazó (con razón)
  | 'incluido_en_boleta';              // ya pagado en boleta de ese mes

export interface CalculoIncentivoMes {
  id: string;                          // CALC-2026-04-001
  esquemaId: string;                   // FK → EsquemaIncentivo
  esquemaNombre: string;               // snapshot para auditoría
  esquemaTipo: TipoIncentivo;          // snapshot

  userId: string;
  empleadoNombre: string;

  // Período
  mes: number;                         // 1-12
  anio: number;

  // Métrica calculada (varía según tipo)
  metricaCalculada: {
    valorMedido: number;               // ventas · envíos · DSO · etc
    unidad: string;                    // "S/" · "envíos" · "días" · "%"
    objetivoAplicable?: number;        // meta a comparar (si aplica)
    cumplePct?: number;                // % cumplimiento
    detalle?: Record<string, any>;     // breakdown extra (escalas · drill)
  };

  bonoCalculado: number;               // S/ resultante
  moneda: 'PEN' | 'USD';

  estado: EstadoCalculoIncentivo;

  // Vinculación con boleta
  boletaId?: string;                   // si ya fue incluido

  // Revisión gerencial
  aprobadoPor?: string;
  fechaAprobacion?: Timestamp;
  razonRechazo?: string;

  // Auditoría
  calculadoPor: string;                // 'system' si fue cron · uid si fue manual
  fechaCalculo: Timestamp;
}

export const ESTADO_CALCULO_LABELS: Record<EstadoCalculoIncentivo, string> = {
  calculado: 'Calculado',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  incluido_en_boleta: 'En boleta',
};

// ============================================
// BONIFICACIÓN INCENTIVO en BOLETA (línea de detalle)
// ============================================

/**
 * Detalle de bonificación por incentivo dentro de una boleta. Análogo a
 * DetalleComision pero más expresivo (soporta los 4 tipos).
 * Si la boleta tiene `bonificacionesIncentivo` lleno, el campo legacy
 * `bonificaciones` debería ser la SUMA de estos. Backward-compat.
 */
export interface BonificacionIncentivo {
  calculoId: string;                   // FK → CalculoIncentivoMes
  esquemaNombre: string;               // snapshot
  esquemaTipo: TipoIncentivo;
  metricaDescripcion: string;          // ej. "S/ 15,000 vendidos · 3% = S/ 450"
  montoBruto: number;
}

// ============================================
// LIQUIDACIÓN DE EMPLEADO · baja con cálculo
// ============================================

export type TipoBaja =
  | 'renuncia'
  | 'despido'
  | 'mutuo_acuerdo'
  | 'fin_contrato'
  | 'jubilacion'
  | 'fallecimiento';

export type EstadoLiquidacion =
  | 'borrador'                         // wizard guardado · sin ejecutar
  | 'aprobada'                         // gerente aprobó · pendiente pago
  | 'pagada'                           // movimiento tesorería creado
  | 'anulada';

export interface ConceptoLiquidacion {
  concepto: string;                    // "Sueldo proporcional" · "Gratificación trunca" · etc
  descripcion?: string;                // detalle del cálculo
  monto: number;                       // positivo = pagar al empleado · negativo = descontar
}

export interface LiquidacionEmpleado {
  id: string;                          // LIQ-2026-001
  userId: string;
  empleadoNombre: string;
  empleadoCargo?: string;

  // Tipo de baja
  tipoBaja: TipoBaja;
  fechaEfectiva: Timestamp;            // último día efectivo de trabajo
  fechaIngreso?: Timestamp;            // snapshot · para cálculo de antigüedad
  razon?: string;                      // libre · detalle

  // Conceptos (positivos a pagar · negativos a descontar)
  conceptos: ConceptoLiquidacion[];
  totalBruto: number;                  // suma de conceptos positivos
  totalDescuentos: number;             // suma de conceptos negativos (en absoluto)
  netoALiquidar: number;               // totalBruto - totalDescuentos
  moneda: 'PEN' | 'USD';

  estado: EstadoLiquidacion;

  // Vinculaciones
  movimientoTesoreriaId?: string;      // pago de la liquidación
  gastoLiquidacionId?: string;         // gasto contabilizado
  adelantosPendientes?: string[];      // IDs de adelantos descontados

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  aprobadoPor?: string;
  fechaAprobacion?: Timestamp;
}

export const TIPO_BAJA_LABELS: Record<TipoBaja, string> = {
  renuncia: 'Renuncia',
  despido: 'Despido',
  mutuo_acuerdo: 'Mutuo acuerdo',
  fin_contrato: 'Fin de contrato',
  jubilacion: 'Jubilación',
  fallecimiento: 'Fallecimiento',
};

export const ESTADO_LIQUIDACION_LABELS: Record<EstadoLiquidacion, string> = {
  borrador: 'Borrador',
  aprobada: 'Aprobada',
  pagada: 'Pagada',
  anulada: 'Anulada',
};

// ============================================
// GRATIFICACIÓN · jul / dic Perú (Vita Skin paga · NO paga CTS)
// ============================================

export type MesGratificacion = 7 | 12;     // solo Julio y Diciembre
export type EstadoGratificacion = 'pendiente' | 'aprobada' | 'pagada' | 'anulada';

export interface Gratificacion {
  id: string;                          // GRAT-2026-07-001
  userId: string;
  empleadoNombre: string;
  empleadoCargo?: string;

  // Período
  mes: MesGratificacion;
  anio: number;
  diasEfectivosEnSemestre: number;     // 1-180 (para cálculo proporcional)

  // Cálculo
  salarioBaseReferencia: number;       // sueldo vigente al cierre del semestre
  montoCalculado: number;              // gratificación proporcional
  moneda: 'PEN' | 'USD';

  estado: EstadoGratificacion;

  // Vinculación con boleta del mes
  boletaId?: string;
  gastoId?: string;
  movimientoTesoreriaId?: string;

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  aprobadoPor?: string;
  fechaAprobacion?: Timestamp;
}

export const ESTADO_GRATIFICACION_LABELS: Record<EstadoGratificacion, string> = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  pagada: 'Pagada',
  anulada: 'Anulada',
};

// ============================================
// EXTENSIÓN BOLETA · campos v5.4 opcionales (backward-compat)
// ============================================

/**
 * Extensión opcional de Boleta para v5.4. NO modifica el tipo `Boleta`
 * existente (backward-compat) sino que se accede como `BoletaV54Extra`
 * y se usa en GenerarBoletas + BoletaDetalle nuevos.
 *
 * En el documento Firestore conviven como campos opcionales:
 *   - bonificacionesIncentivo?: BonificacionIncentivo[]
 *   - gratificacionId?: string
 *   - liquidacionId?: string
 */
export interface BoletaV54Extra {
  bonificacionesIncentivo?: BonificacionIncentivo[];
  gratificacionId?: string;            // si esta boleta incluye gratificación
  liquidacionId?: string;              // si esta boleta corresponde a baja
}

// ============================================
// FORM DATA NUEVOS (F5 modales)
// ============================================

export interface AjusteSalarialFormData {
  userId: string;
  empleadoNombre: string;
  salarioNuevo: number;
  moneda: 'PEN' | 'USD';
  efectivoDesde: Date;                 // se convierte a Timestamp en service
  razon: RazonVariacionSalarial;
  notas?: string;
}

export interface EsquemaIncentivoFormData {
  nombre: string;
  descripcion?: string;
  tipo: TipoIncentivo;
  aplicableA: AplicabilidadIncentivo;
  vigenteDesde: Date;
  vigenteHasta?: Date;
  configuracion: ConfigComision | ConfigBonoMeta | ConfigBonoKPI | ConfigBonoFijo;
}

export interface BajaEmpleadoFormData {
  userId: string;
  empleadoNombre: string;
  tipoBaja: TipoBaja;
  fechaEfectiva: Date;
  razon?: string;
  conceptos: ConceptoLiquidacion[];
  moneda: 'PEN' | 'USD';
}

export interface GratificacionFormData {
  userId: string;
  empleadoNombre: string;
  mes: MesGratificacion;
  anio: number;
  diasEfectivosEnSemestre: number;
  salarioBaseReferencia: number;
  montoCalculado: number;
  moneda: 'PEN' | 'USD';
}
