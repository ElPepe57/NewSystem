/**
 * ordenCompra.service.ts — FACADE
 *
 * Aggregates all ordenCompra sub-modules into the original `OrdenCompraService`
 * static class.  All existing imports of the form:
 *
 *   import { OrdenCompraService } from '../services/ordenCompra.service'
 *
 * continue to work without changes.
 *
 * Sub-modules:
 *   ordenCompra.shared.ts              — constants and sequence-number helper
 *   ordenCompra.proveedores.service.ts — CRUD for Proveedores
 *   ordenCompra.crud.service.ts        — OC getAll/getById/create/update/delete/cambiarEstado
 *   ordenCompra.pagos.service.ts       — registrarPago (Tesorería + Pool USD)
 *   ordenCompra.recepcion.service.ts   — recibirOrdenParcial / recibirOrden / revertirRecepciones
 *   ordenCompra.stats.service.ts       — getStats, precios históricos, investigación mercado
 */

import type {
  OrdenCompra,
  OrdenCompraFormData,
  EstadoOrden,
  OrdenCompraStats,
  Proveedor,
  ProveedorFormData,
  PagoOrdenCompra,
  RecepcionParcial
} from '../types/ordenCompra.types';
import type { MetodoTesoreria } from '../types/tesoreria.types';

// ─── Sub-module imports ───────────────────────────────────────────────────────

import {
  getAllProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor
} from './ordenCompra.proveedores.service';

import {
  getAll,
  getById,
  getByEstado,
  create,
  update,
  cambiarEstado,
  deleteOrden
} from './ordenCompra.crud.service';

import { registrarPago } from './ordenCompra.pagos.service';

import {
  recibirOrdenParcial,
  recibirOrden,
  revertirRecepciones
} from './ordenCompra.recepcion.service';

import {
  getStats,
  getPreciosHistoricos,
  getMejorPrecioHistorico,
  getPrecioPromedioHistorico,
  getUltimoPrecioProveedor,
  getInvestigacionMercado,
  getProductosProveedor
} from './ordenCompra.stats.service';

// ─── Facade ───────────────────────────────────────────────────────────────────

/**
 * Servicio de Órdenes de Compra.
 *
 * All method signatures are identical to the original monolithic class so that
 * every existing caller continues to work without modification.
 */
export class OrdenCompraService {
  // ========================================
  // PROVEEDORES
  // ========================================

  static async getAllProveedores(): Promise<Proveedor[]> {
    return getAllProveedores();
  }

  static async getProveedorById(id: string): Promise<Proveedor | null> {
    return getProveedorById(id);
  }

  static async createProveedor(data: ProveedorFormData, userId: string): Promise<Proveedor> {
    return createProveedor(data, userId);
  }

  static async updateProveedor(id: string, data: Partial<ProveedorFormData>): Promise<void> {
    return updateProveedor(id, data);
  }

  static async deleteProveedor(id: string): Promise<void> {
    return deleteProveedor(id);
  }

  // ========================================
  // ÓRDENES DE COMPRA
  // ========================================

  static async getAll(): Promise<OrdenCompra[]> {
    return getAll();
  }

  static async getById(id: string): Promise<OrdenCompra | null> {
    return getById(id);
  }

  static async getByEstado(estado: EstadoOrden): Promise<OrdenCompra[]> {
    return getByEstado(estado);
  }

  static async create(data: OrdenCompraFormData, userId: string): Promise<OrdenCompra> {
    return create(data, userId);
  }

  static async update(
    id: string,
    data: Partial<OrdenCompraFormData>,
    userId: string
  ): Promise<void> {
    return update(id, data, userId);
  }

  static async cambiarEstado(
    id: string,
    nuevoEstado: EstadoOrden,
    userId: string,
    datos?: {
      tcPago?: number;
      numeroTracking?: string;
      courier?: string;
      motivo?: string;
      observaciones?: string;
    }
  ): Promise<void> {
    return cambiarEstado(id, nuevoEstado, userId, datos);
  }

  static async registrarPago(
    id: string,
    datos: {
      fechaPago: Date;
      monedaPago: 'USD' | 'PEN';
      montoOriginal: number;
      tipoCambio: number;
      metodoPago: MetodoTesoreria;
      cuentaOrigenId?: string;
      referencia?: string;
      notas?: string;
    },
    userId: string
  ): Promise<PagoOrdenCompra> {
    return registrarPago(id, datos, userId);
  }

  static async recibirOrdenParcial(
    id: string,
    productosRecibidos: Array<{ productoId: string; cantidadRecibida: number }>,
    userId: string,
    observaciones?: string
  ): Promise<{
    recepcionId: string;
    unidadesGeneradas: string[];
    unidadesReservadas: string[];
    unidadesDisponibles: string[];
    esRecepcionFinal: boolean;
    cotizacionVinculada?: string;
  }> {
    return recibirOrdenParcial(id, productosRecibidos, userId, observaciones);
  }

  static async recibirOrden(
    id: string,
    userId: string
  ): Promise<{
    unidadesGeneradas: string[];
    unidadesReservadas: string[];
    unidadesDisponibles: string[];
    cotizacionVinculada?: string;
  }> {
    return recibirOrden(id, userId);
  }

  static async delete(id: string): Promise<void> {
    return deleteOrden(id);
  }

  static async getStats(): Promise<OrdenCompraStats> {
    return getStats();
  }

  // ========================================
  // LIMPIEZA DE DATOS DE PRUEBA
  // ========================================

  static async revertirRecepciones(
    ordenId: string,
    userId: string
  ): Promise<{
    unidadesEliminadas: number;
    recepcionesEliminadas: number;
    estadoRestaurado: string;
  }> {
    return revertirRecepciones(ordenId, userId);
  }

  // ========================================
  // INVESTIGACIÓN DE MERCADO / PRECIOS HISTÓRICOS
  // ========================================

  static async getPreciosHistoricos(
    productoId: string
  ): Promise<
    Array<{
      proveedorId: string;
      proveedorNombre: string;
      costoUnitarioUSD: number;
      cantidad: number;
      fechaCompra: Date;
      numeroOrden: string;
      tcCompra?: number;
    }>
  > {
    return getPreciosHistoricos(productoId);
  }

  static async getMejorPrecioHistorico(productoId: string): Promise<{
    proveedorId: string;
    proveedorNombre: string;
    costoUnitarioUSD: number;
    fechaCompra: Date;
    numeroOrden: string;
  } | null> {
    return getMejorPrecioHistorico(productoId);
  }

  static async getPrecioPromedioHistorico(productoId: string): Promise<number> {
    return getPrecioPromedioHistorico(productoId);
  }

  static async getUltimoPrecioProveedor(
    productoId: string,
    proveedorId: string
  ): Promise<{
    costoUnitarioUSD: number;
    fechaCompra: Date;
    numeroOrden: string;
    tcCompra?: number;
  } | null> {
    return getUltimoPrecioProveedor(productoId, proveedorId);
  }

  static async getInvestigacionMercado(
    productoIds: string[]
  ): Promise<
    Map<
      string,
      {
        productoId: string;
        precioPromedioUSD: number;
        precioMinimoUSD: number;
        precioMaximoUSD: number;
        ultimoPrecioUSD: number;
        proveedorRecomendado?: { id: string; nombre: string; ultimoPrecioUSD: number };
        historial: Array<{
          proveedorNombre: string;
          costoUnitarioUSD: number;
          fechaCompra: Date;
        }>;
      }
    >
  > {
    return getInvestigacionMercado(productoIds);
  }

  static async getProductosProveedor(
    proveedorId: string
  ): Promise<
    Array<{
      productoId: string;
      sku: string;
      marca: string;
      nombreComercial: string;
      ultimoCostoUSD: number;
      cantidadTotal: number;
      ordenesCount: number;
    }>
  > {
    return getProductosProveedor(proveedorId);
  }
}
