/**
 * ===============================================
 * MÓDULO DE INVERSIONISTAS (chk5.E-INV)
 * ===============================================
 *
 * Vista ejecutiva para socios/inversionistas de un emprendimiento PyME.
 *
 * **Modelo conceptual: INVERSIÓN MIXTA (emprendedor apalancado)**
 *
 * El capital del negocio NO viene solo de "inyección de cash". En la realidad
 * de un emprendedor PyME, el capital comprometido incluye:
 *
 *  1. **Cash propio aportado** (`aportesCapital` con metodo!='tarjeta_credito')
 *     → entra como aporte tradicional en patrimonio.
 *
 *  2. **TC personal asumida** (`CuentaCaja` tipo='credito' +
 *     `titularidad='personal'` + `garantizadaPorSocioId` apuntando al socio)
 *     → deuda personal del socio que el negocio usa para comprar inventario.
 *     El socio queda comprometido aunque no haya "puesto cash".
 *
 *  3. **Utilidades retenidas** (resultados acumulados no retirados)
 *     → equivalente a re-inyección de capital.
 *
 * Por eso este módulo introduce 3 métricas nuevas que NO existen en
 * Contabilidad/Finanzas:
 *
 *  - **Capital Comprometido Total** = cash propio + TC personal vigente
 *  - **Equity Ratio** = Patrimonio / Activos · cuán libre de deuda
 *  - **Soberanía Financiera** = meses estimados para liberar deuda personal TC
 *
 * Y reusa de Contabilidad: Utilidad Neta, Patrimonio, Activos.
 * Y reusa de Finanzas: Saldos de caja, deuda TC vigente.
 *
 * NO duplica funcionalidad de otros módulos · solo agrega la capa de "lectura
 * para inversionista" que cruza patrimonio + deuda personal + retorno + plan
 * de des-apalancamiento.
 */

import { Timestamp } from 'firebase/firestore';
import { MonedaTesoreria } from './tesoreria.types';

// ===============================================
// SOCIO · ENTIDAD MAESTRO
// ===============================================

/**
 * Socio/inversionista del negocio.
 *
 * Stored in Firestore collection `socios` (id determinístico recomendado:
 * snake_case del nombre). Se relaciona con:
 *
 *  - `aportesCapital.socioId` → aportes de cash
 *  - `retirosCapital.socioId` → retiros (utilidades/capital/préstamos)
 *  - `cuentasCaja.garantizadaPorSocioId` → TC personal asumida por el negocio
 */
export interface Socio {
  id: string;
  nombre: string;
  /** Email opcional · para futuros reportes ejecutivos auto-enviados */
  email?: string;
  /** Porcentaje de participación (suma de todos los socios = 100) */
  porcentajeParticipacion: number;
  /** Rol/cargo descriptivo · ej. "Co-fundador · CEO" */
  rol?: string;
  /** Fecha de incorporación al negocio · para calcular antigüedad */
  fechaIngreso: Timestamp;
  /** Si el socio sigue activo en el negocio · false = retirado/cerrado */
  activo: boolean;
  /** Notas internas opcionales */
  notas?: string;

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

// ===============================================
// AGREGADOS DERIVADOS · RESUMENES POR SOCIO
// ===============================================

/**
 * Resumen de aportes de cash de un socio (lifetime).
 * Derivado de `aportesCapital` filtrado por `socioId`.
 */
export interface AporteSocioResumen {
  socioId: string;
  socioNombre: string;
  /** Total aportado convertido a PEN para comparación */
  totalAportadoPEN: number;
  /** Total aportado en USD (si hubo aportes en USD) */
  totalAportadoUSD: number;
  /** Cantidad de operaciones de aporte */
  cantidadAportes: number;
  /** Fecha del primer aporte · para calcular antigüedad de capital */
  fechaPrimerAporte?: Timestamp;
  /** Fecha del último aporte */
  fechaUltimoAporte?: Timestamp;
}

/**
 * Resumen de retiros de un socio (lifetime), separado por tipo.
 * Derivado de `retirosCapital` filtrado por `socioId`.
 */
export interface RetiroSocioResumen {
  socioId: string;
  socioNombre: string;
  /** Total retirado convertido a PEN */
  totalRetiradoPEN: number;
  /** Por tipo de retiro · clave: 'utilidades'|'capital'|'prestamo' */
  porTipo: {
    utilidades: number;
    capital: number;
    prestamo: number;
  };
  cantidadRetiros: number;
  fechaUltimoRetiro?: Timestamp;
}

/**
 * Resumen de TC personal asumida por el negocio para un socio (vigente).
 * Derivado de `cuentasCaja` con tipo='credito' + titularidad='personal' +
 * garantizadaPorSocioId.
 */
export interface TCPersonalSocioResumen {
  socioId: string;
  socioNombre: string;
  /** Cantidad de TCs personales del socio asumidas por el negocio */
  cantidadTCs: number;
  /**
   * Total comprometido · suma de `lineaCredito.utilizado` (deuda vigente
   * en PEN o convertida).
   */
  totalComprometidoPEN: number;
  /** Límite total combinado · capacidad máxima del socio */
  limiteTotalPEN: number;
  /** Detalle por TC · para drill-down */
  tarjetas: Array<{
    cuentaCajaId: string;
    nombre: string;
    banco?: string;
    moneda: MonedaTesoreria;
    utilizado: number;
    limite: number;
    porcentajeUso: number;
  }>;
}

// ===============================================
// MÉTRICAS CLAVE DEL MÓDULO
// ===============================================

/**
 * **Capital Comprometido Total** — métrica core del modelo mixto.
 *
 * Total que el socio (o el conjunto de socios) tiene comprometido en el
 * negocio. Suma:
 *  - Cash aportado (`totalAportadoPEN` de aportes)
 *  - Deuda personal vigente (`totalComprometidoPEN` de TC personales)
 *
 * Se diferencia del "Patrimonio" contable porque incluye la deuda asumida.
 */
export interface CapitalComprometido {
  /** Total cash aportado (lifetime · sin descontar retiros de capital) */
  cashAportadoPEN: number;
  /** Deuda personal TC vigente · asumida por el negocio */
  deudaTCPersonalPEN: number;
  /** TOTAL = cash + deuda · la cifra que aparece en el KPI strip */
  totalPEN: number;
  /** Desglose por socio (si hay >1) */
  porSocio?: Array<{
    socioId: string;
    socioNombre: string;
    cash: number;
    deudaTC: number;
    total: number;
    porcentajeDelTotal: number;
  }>;
}

/**
 * **Equity Ratio** — métrica de salud patrimonial.
 *
 * Patrimonio / Activos · cuánto del negocio es realmente del socio (no
 * financiado con deuda). Mayor = mejor (más libre de deuda).
 *
 *  - >70%  → muy saludable · poca deuda
 *  - 50-70% → saludable · balance razonable
 *  - 30-50% → moderado · monitorear
 *  - <30%  → riesgo · muy apalancado
 */
export interface EquityRatio {
  patrimonioPEN: number;
  activosPEN: number;
  /** Patrimonio / Activos · valor entre 0 y 1 */
  ratio: number;
  /** Mismo valor en porcentaje (0-100) */
  porcentaje: number;
  /** Clasificación de salud */
  salud: 'excelente' | 'saludable' | 'moderado' | 'riesgo';
}

/**
 * **ROI Dual** — retorno sobre inversión visto desde 2 ángulos.
 *
 * Importante porque la "rentabilidad real" depende de qué consideres como
 * "lo invertido":
 *  - Sobre cash aportado → ROI clásico, muy alto si el socio aportó poco
 *  - Sobre capital comprometido (cash + deuda TC) → ROI honesto del modelo mixto
 */
export interface ROIDual {
  /** Utilidad neta acumulada (lifetime) */
  utilidadNetaAcumuladaPEN: number;
  /** ROI sobre cash aportado · UN / cashAportado */
  sobreCashAportado: number;
  /** ROI sobre capital comprometido · UN / (cash + TC personal) */
  sobreCapitalComprometido: number;
  /** Diferencia interpretativa · "real vs apariencia" */
  diferencial: number;
}

/**
 * **Multiplicador de Capital** — cuántas veces el negocio ha multiplicado
 * el capital comprometido inicial.
 *
 * Patrimonio / Cash aportado original. Si es 3.15x, significa que cada S/ 1
 * de cash inyectado se ha convertido en S/ 3.15 de patrimonio neto.
 */
export interface MultiplicadorCapital {
  cashAportadoOriginal: number;
  patrimonioActual: number;
  /** Patrimonio / cashAportado */
  multiplicador: number;
}

/**
 * **Soberanía Financiera** — métrica única del modelo mixto.
 *
 * Cuántos meses estimados faltan para liberar toda la deuda personal TC
 * asumida por el negocio, asumiendo que el negocio destina X% de su
 * utilidad mensual a pagar TC.
 *
 *  - <6 meses  → cerca de soberanía
 *  - 6-12 meses → camino claro
 *  - 12-24 meses → largo plazo razonable
 *  - >24 meses → revisión estratégica
 */
export interface SoberaniaFinanciera {
  deudaTCPersonalVigentePEN: number;
  utilidadMensualPromedioPEN: number;
  /** Porcentaje de utilidad mensual destinado a pagar TC (asumido 0-1) */
  porcentajeAsignadoAPagoTC: number;
  /** Pago mensual estimado a TC · utilidadMensual × porcentaje */
  pagoMensualEstimadoPEN: number;
  /** Meses para liquidar · deuda / pagoMensual */
  mesesParaSoberania: number;
  /** Fecha estimada de soberanía · fechaActual + mesesParaSoberania */
  fechaEstimadaSoberania?: Timestamp;
  /** Clasificación · qué tan lejos está */
  estado: 'cerca' | 'camino_claro' | 'largo_plazo' | 'revision';
}

// ===============================================
// TRAYECTORIA · DATOS PARA SPARKLINES Y GRÁFICOS
// ===============================================

/**
 * Punto mensual de trayectoria · usado para graficar evolución 24m.
 */
export interface TrayectoriaMensual {
  /** Año-mes · "2026-05" */
  periodo: string;
  anio: number;
  mes: number;

  // Métricas patrimoniales
  patrimonio: number;
  activos: number;
  pasivos: number;

  // Métricas operativas
  utilidadNeta: number;
  margenNeto: number;
  ventas: number;

  // Métricas del modelo mixto
  capitalComprometido: number;
  cashAportadoAcumulado: number;
  deudaTCPersonal: number;
  equityRatio: number;
}

// ===============================================
// SALUD DEL INVERSIONISTA · BANNER PRINCIPAL
// ===============================================

/**
 * Estado general del negocio desde la lectura del inversionista.
 *
 * Distinto del "Estado del Negocio" de Contabilidad (que mira margen + cash)
 * porque acá ponderamos:
 *  - Equity ratio (cuán libre de deuda)
 *  - Tendencia de patrimonio (crece/baja últimos 6m)
 *  - Soberanía financiera (qué tan cerca de liberarse de TC)
 *  - ROI sobre capital comprometido
 */
export interface SaludInversionista {
  /** Estado general · drives color del banner */
  estado: 'saludable' | 'atencion' | 'critico';
  /** Score combinado 0-100 · ponderación de las 4 dimensiones */
  score: number;
  /** Lectura ejecutiva · 1-2 frases para el banner */
  resumen: string;
  /** Sub-scores por dimensión · para drill-down opcional */
  dimensiones: {
    equityRatio: number;       // 0-100
    tendenciaPatrimonio: number; // 0-100
    soberania: number;          // 0-100
    rentabilidad: number;       // 0-100
  };
}

// ===============================================
// RESUMEN MAESTRO DEL MÓDULO
// ===============================================

/**
 * Output principal del servicio · agrega todo lo necesario para renderizar
 * el módulo de Inversionistas en una sola llamada.
 *
 * El componente `<Inversionistas />` consume este objeto y mapea a sus 7
 * secciones canon:
 *
 *  1. Banner Salud (`salud`)
 *  2. KPI strip (`capitalComprometido`, `patrimonio`, `equityRatio`,
 *     `roiDual.sobreCapitalComprometido`, `multiplicador.multiplicador`)
 *  3. Por Socio (`aportesPorSocio`, `retirosPorSocio`, `tcPersonalesPorSocio`)
 *  4. Trayectoria 24m (`trayectoria`)
 *  5. Composición del Capital (`capitalComprometido.porSocio` + breakdown)
 *  6. Plan de Soberanía (`soberania`)
 *  7. Reporte Ejecutivo (botón export · genera PDF/CSV)
 */
export interface ResumenInversionista {
  // Periodo de análisis
  fechaCalculo: Date;
  /** TC PEN/USD usado para conversiones a la fecha de cálculo */
  tipoCambio: number;

  // Sección 1: Salud general
  salud: SaludInversionista;

  // Sección 2: KPIs principales
  capitalComprometido: CapitalComprometido;
  patrimonioPEN: number;
  activosPEN: number;
  pasivosPEN: number;
  equityRatio: EquityRatio;
  roiDual: ROIDual;
  multiplicador: MultiplicadorCapital;

  // Sección 3: Detalle por socio
  socios: Socio[];
  aportesPorSocio: AporteSocioResumen[];
  retirosPorSocio: RetiroSocioResumen[];
  tcPersonalesPorSocio: TCPersonalSocioResumen[];

  // Sección 4: Trayectoria histórica (últimos 24m)
  trayectoria: TrayectoriaMensual[];

  // Sección 6: Plan de soberanía financiera
  soberania: SoberaniaFinanciera;

  // Métricas operativas reusadas de Contabilidad/Finanzas
  utilidadNetaMesActualPEN: number;
  utilidadNetaAcumuladaPEN: number;
  ventasMesActualPEN: number;
  margenNetoMesActual: number;
}

// ===============================================
// FORM DATA · CRUD DE SOCIOS
// ===============================================

export interface SocioFormData {
  nombre: string;
  email?: string;
  porcentajeParticipacion: number;
  rol?: string;
  fechaIngreso: Date;
  activo: boolean;
  notas?: string;
}

// ===============================================
// CONFIGURACIÓN DEL MÓDULO
// ===============================================

/**
 * Parámetros configurables del módulo de Inversionistas.
 *
 * Editable desde un modal de configuración (similar al de Contabilidad).
 * Stored as singleton doc en `configuracion/inversionistas`.
 */
export interface ConfiguracionInversionistas {
  /**
   * % de utilidad mensual asumido como destinable a pago TC personal · default
   * 0.30 (30%). Usado para calcular `soberania.pagoMensualEstimadoPEN`.
   */
  porcentajeUtilidadAPagoTC: number;

  /**
   * Umbrales personalizados para `EquityRatio.salud` · defaults razonables
   * para PyME ecommerce.
   */
  umbralEquityRatio: {
    excelente: number;  // default 0.70
    saludable: number;  // default 0.50
    moderado: number;   // default 0.30
  };

  /** Meta de meses para alcanzar soberanía financiera · default 12 */
  metaMesesSoberania: number;

  // Auditoría
  ultimaActualizacion: Timestamp;
  actualizadoPor: string;
}

/** Defaults sensatos para una PyME ecommerce skincare en Perú */
export const DEFAULT_CONFIG_INVERSIONISTAS: Omit<
  ConfiguracionInversionistas,
  'ultimaActualizacion' | 'actualizadoPor'
> = {
  porcentajeUtilidadAPagoTC: 0.30,
  umbralEquityRatio: {
    excelente: 0.70,
    saludable: 0.50,
    moderado: 0.30,
  },
  metaMesesSoberania: 12,
};
