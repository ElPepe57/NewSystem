/**
 * Tipos para el Cierre Contable Mensual
 * Permite cerrar, validar y auditar periodos contables
 */

import type {
  EstadoResultados,
  BalanceGeneral,
  IndicadoresFinancieros,
} from './contabilidad.types';

/** Estado del cierre contable */
export type EstadoCierre = 'cerrado' | 'reabierto';

/** Severidad de una validacion pre-cierre */
export type SeveridadValidacion = 'critica' | 'advertencia';

/** Resultado individual de una validacion */
export type ResultadoValidacionItem = 'aprobada' | 'rechazada' | 'advertencia';

/**
 * Validacion individual que se ejecuta antes de cerrar un periodo
 */
export interface ValidacionPreCierre {
  id: string;
  nombre: string;
  severidad: SeveridadValidacion;
  resultado: ResultadoValidacionItem;
  detalle: string;
}

/**
 * Resultado agregado de todas las validaciones pre-cierre
 */
export interface ResultadoValidacion {
  validaciones: ValidacionPreCierre[];
  /** true si no hay validaciones criticas rechazadas */
  puedesCerrar: boolean;
  /** Cantidad de advertencias */
  advertencias: number;
  /** Cantidad de criticas rechazadas */
  criticas: number;
}

/**
 * Snapshot financiero tomado al momento del cierre
 * Preserva el estado exacto de los estados financieros
 */
export interface SnapshotCierre {
  estadoResultados: EstadoResultados;
  balanceGeneral: BalanceGeneral;
  indicadoresFinancieros: IndicadoresFinancieros;
  /** Metricas operativas adicionales */
  totalVentas: number;
  totalGastos: number;
  totalCompras: number;
  unidadesVendidas: number;
  /** TC al momento del cierre */
  tipoCambioAlCierre: number;
}

/**
 * Informacion de reapertura de un cierre
 */
export interface ReaperturaCierre {
  fecha: Date;
  motivo: string;
  usuario: string;
  /** Snapshot que tenia antes de reabrir */
  snapshotAnterior: SnapshotCierre;
}

/**
 * Documento principal de cierre contable
 * Almacenado en la coleccion 'cierresContables'
 */
export interface CierreContable {
  id?: string;
  mes: number;
  anio: number;
  /** Clave del periodo, ej: '2026-03' */
  periodoKey: string;
  estado: EstadoCierre;
  fechaCierre: Date;
  cerradoPor: string;
  validaciones: ValidacionPreCierre[];
  snapshot: SnapshotCierre;
  reapertura?: ReaperturaCierre;
}
