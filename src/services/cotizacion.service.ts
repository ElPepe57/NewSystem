/**
 * cotizacion.service.ts — FACADE
 *
 * Aggregates all cotización sub-modules into a single CotizacionService class
 * and a `cotizacionService` singleton.  All existing imports of the form:
 *
 *   import { CotizacionService } from '../services/cotizacion.service'
 *   import { cotizacionService } from '../services/cotizacion.service'
 *
 * continue to work without changes.
 *
 * Sub-modules:
 *   cotizacion.shared.ts           — constants and helpers
 *   cotizacion.queries.service.ts  — read-only Firestore queries
 *   cotizacion.crud.service.ts     — create, update, delete
 *   cotizacion.flujo.service.ts    — state transitions (validar, rechazar, etc.)
 *   cotizacion.adelanto.service.ts — adelanto payment + stock reservation
 *   cotizacion.confirmar.service.ts — confirm → create venta
 *   cotizacion.stats.service.ts    — getStats, getAnalisisDemanda
 */

// ─── Re-export shared constants for tree-shaking friendliness ─────────────────
export * from './cotizacion.shared';

// ─── Sub-module imports ───────────────────────────────────────────────────────

import {
  getAll as _getAll,
  getById as _getById,
  getByEstado as _getByEstado,
  getWithFilters as _getWithFilters
} from './cotizacion.queries.service';

import {
  create as _create,
  update as _update,
  deleteCotizacion as _deleteCotizacion
} from './cotizacion.crud.service';

import {
  validar as _validar,
  revertirValidacion as _revertirValidacion,
  comprometerAdelanto as _comprometerAdelanto,
  actualizarDiasValidez as _actualizarDiasValidez,
  actualizarDiasCompromisoEntrega as _actualizarDiasCompromisoEntrega,
  actualizarTiempoEstimadoImportacion as _actualizarTiempoEstimadoImportacion,
  rechazar as _rechazar,
  marcarVencida as _marcarVencida
} from './cotizacion.flujo.service';

import {
  registrarPagoAdelanto as _registrarPagoAdelanto,
  registrarAdelanto as _registrarAdelanto
} from './cotizacion.adelanto.service';

import { confirmar as _confirmar } from './cotizacion.confirmar.service';

import {
  getStats as _getStats,
  getAnalisisDemanda as _getAnalisisDemanda
} from './cotizacion.stats.service';

// ─── Type imports (for method signatures) ────────────────────────────────────

import type {
  Cotizacion,
  CotizacionFormData,
  EstadoCotizacion,
  ComprometerAdelantoData,
  RegistrarAdelantoData,
  RechazarCotizacionData,
  CotizacionStats,
  CotizacionFilters
} from '../types/cotizacion.types';
import type {
  TipoReserva,
  ProductoReservado,
  ProductoStockVirtual
} from '../types/venta.types';

// ─── Facade class ─────────────────────────────────────────────────────────────

/**
 * Servicio de Cotizaciones
 * All method signatures are identical to the original monolithic class so that
 * every existing caller (cotizacionStore, cuentasPendientes.service, etc.)
 * continues to work without modification.
 */
export class CotizacionService {

  // ========== CRUD BÁSICO ==========

  static async getAll(): Promise<Cotizacion[]> {
    return _getAll();
  }

  static async getById(id: string): Promise<Cotizacion | null> {
    return _getById(id);
  }

  static async getByEstado(estado: EstadoCotizacion | EstadoCotizacion[]): Promise<Cotizacion[]> {
    return _getByEstado(estado);
  }

  static async getWithFilters(filters: CotizacionFilters): Promise<Cotizacion[]> {
    return _getWithFilters(filters);
  }

  static async create(data: CotizacionFormData, userId: string): Promise<Cotizacion> {
    return _create(data, userId);
  }

  static async update(id: string, data: Partial<CotizacionFormData>, userId: string): Promise<void> {
    return _update(id, data, userId, (docId) => this.getById(docId));
  }

  static async delete(id: string): Promise<void> {
    return _deleteCotizacion(id, (docId) => this.getById(docId));
  }

  // ========== FLUJO DE COTIZACIÓN ==========

  static async validar(id: string, userId: string): Promise<void> {
    return _validar(id, userId, (docId) => this.getById(docId));
  }

  static async revertirValidacion(id: string, userId: string): Promise<void> {
    return _revertirValidacion(id, userId, (docId) => this.getById(docId));
  }

  static async comprometerAdelanto(
    id: string,
    data: ComprometerAdelantoData,
    userId: string
  ): Promise<void> {
    return _comprometerAdelanto(id, data, userId, (docId) => this.getById(docId));
  }

  static async actualizarDiasValidez(
    id: string,
    diasValidez: number,
    userId: string
  ): Promise<void> {
    return _actualizarDiasValidez(id, diasValidez, userId, (docId) => this.getById(docId));
  }

  static async actualizarDiasCompromisoEntrega(
    id: string,
    diasCompromisoEntrega: number,
    userId: string
  ): Promise<void> {
    return _actualizarDiasCompromisoEntrega(id, diasCompromisoEntrega, userId, (docId) => this.getById(docId));
  }

  static async actualizarTiempoEstimadoImportacion(
    id: string,
    tiempoEstimadoImportacion: number,
    userId: string
  ): Promise<void> {
    return _actualizarTiempoEstimadoImportacion(id, tiempoEstimadoImportacion, userId, (docId) => this.getById(docId));
  }

  static async rechazar(id: string, data: RechazarCotizacionData, userId: string): Promise<void> {
    return _rechazar(id, data, userId, (docId) => this.getById(docId));
  }

  static async marcarVencida(id: string, userId: string): Promise<void> {
    return _marcarVencida(id, userId, (docId) => this.getById(docId));
  }

  // ========== ADELANTO ==========

  static async registrarPagoAdelanto(
    id: string,
    data: RegistrarAdelantoData,
    userId: string
  ): Promise<{
    tipoReserva: TipoReserva;
    productosReservados: ProductoReservado[];
    productosVirtuales?: ProductoStockVirtual[];
    requerimientosGenerados?: Array<{ id: string; numero: string }>;
  }> {
    return _registrarPagoAdelanto(id, data, userId, (docId) => this.getById(docId));
  }

  /** @deprecated Usar comprometerAdelanto + registrarPagoAdelanto */
  static async registrarAdelanto(
    id: string,
    data: RegistrarAdelantoData & { horasVigencia?: number },
    userId: string
  ): Promise<{
    tipoReserva: TipoReserva;
    productosReservados: ProductoReservado[];
    productosVirtuales?: ProductoStockVirtual[];
    requerimientosGenerados?: Array<{ id: string; numero: string }>;
  }> {
    return _registrarAdelanto(id, data, userId, (docId) => this.getById(docId));
  }

  // ========== CONFIRMAR ==========

  static async confirmar(id: string, userId: string): Promise<{ ventaId: string; numeroVenta: string }> {
    return _confirmar(id, userId, (docId) => this.getById(docId));
  }

  // ========== ESTADÍSTICAS Y ANÁLISIS ==========

  static async getStats(): Promise<CotizacionStats> {
    return _getStats(() => this.getAll());
  }

  static async getAnalisisDemanda(): Promise<{
    productosMasCotizados: Array<{
      productoId: string;
      nombreProducto: string;
      vecesCotizado: number;
      vecesConfirmado: number;
      tasaConversion: number;
      montoTotalCotizado: number;
    }>;
    tendenciaMensual: Array<{
      mes: string;
      cotizaciones: number;
      confirmadas: number;
      rechazadas: number;
      montoTotal: number;
    }>;
  }> {
    return _getAnalisisDemanda(() => this.getAll());
  }
}

// ─── Singleton instance ───────────────────────────────────────────────────────

export const cotizacionService = new CotizacionService();
