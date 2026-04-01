/**
 * tesoreria.service.ts — FACADE
 *
 * Aggregates all tesorería sub-modules into a single `tesoreriaService`
 * singleton.  All existing imports of the form:
 *
 *   import { tesoreriaService } from '../services/tesoreria.service'
 *
 * continue to work without changes.
 *
 * Sub-modules:
 *   tesoreria.shared.ts          — constants and type helpers
 *   tesoreria.movimientos.service.ts — movement CRUD and queries
 *   tesoreria.cuentas.service.ts     — account management
 *   tesoreria.conversiones.service.ts — currency conversion
 *   tesoreria.stats.service.ts       — statistics, TC tracking, cash-flow
 *   tesoreria.capital.service.ts     — transfers and partner capital
 */

// ─── Re-export sub-module functions for tree-shaking friendliness ─────────────
export * from './tesoreria.shared';

import type {
  MovimientoTesoreria,
  MovimientoTesoreriaFormData,
  MovimientoTesoreriaFiltros,
  ConversionCambiariaFormData,
  ConversionCambiariaFiltros,
  CuentaCajaFormData,
  TransferenciaEntreCuentasFormData,
  AporteCapitalFormData,
  RetiroCapitalFormData,
  MonedaTesoreria,
  MetodoTesoreria
} from '../types/tesoreria.types';

// ─── Sub-module imports ───────────────────────────────────────────────────────

import {
  generateNumeroMovimiento,
  registrarMovimiento as _registrarMovimiento,
  actualizarMovimiento as _actualizarMovimiento,
  getMovimientoById,
  eliminarMovimiento as _eliminarMovimiento,
  reconciliarPagosHuerfanos,
  reclasificarAnticipos as _reclasificarAnticipos,
  migrarAnticiposHistoricos as _migrarAnticiposHistoricos,
  getMovimientos
} from './tesoreria.movimientos.service';

import {
  crearCuenta,
  actualizarCuenta,
  toggleActivaCuenta,
  crearCuentasPorDefecto as _crearCuentasPorDefecto,
  getCuentaPorMetodoPago as _getCuentaPorMetodoPago,
  getCuentasActivas as _getCuentasActivas,
  getCuentas,
  getCuentaById,
  actualizarSaldoCuenta,
  recalcularSaldoCuenta,
  recalcularTodosLosSaldos,
  syncMetodosBanco,
  eliminarCuenta,
  cuentaTieneSaldo,
  cuentaTieneMovimientos
} from './tesoreria.cuentas.service';

import {
  generateNumeroConversion,
  registrarConversion as _registrarConversion,
  getConversiones
} from './tesoreria.conversiones.service';

import {
  _getMesKey,
  _crearEstadisticasMensualesVacias,
  registrarTCTransaccion,
  getHistorialTCDocumento,
  calcularDiferenciaCambiaria as _calcularDiferenciaCambiaria,
  getEstadisticasAgregadas,
  inicializarEstadisticas as _inicializarEstadisticas,
  actualizarEstadisticasPorMovimiento as _actualizarEstadisticasPorMovimiento,
  actualizarEstadisticasPorConversion,
  recalcularEstadisticasCompletas as _recalcularEstadisticasCompletas,
  getStats as _getStats,
  _calcularStatsEnTiempoReal as __calcularStatsEnTiempoReal,
  getFlujoCajaMensual as _getFlujoCajaMensual
} from './tesoreria.stats.service';

import {
  transferirEntreCuentas as _transferirEntreCuentas,
  registrarAporteCapital as _registrarAporteCapital,
  registrarRetiroCapital as _registrarRetiroCapital,
  getTotalAportesCapital,
  getTotalRetirosCapital
} from './tesoreria.capital.service';

// ─── Facade ───────────────────────────────────────────────────────────────────

/**
 * Servicio de Tesorería
 * Gestiona el flujo de dinero, conversiones cambiarias y tracking de TC.
 *
 * All method signatures are identical to the original monolithic service so
 * that every existing caller continues to work without modification.
 */
export const tesoreriaService = {

  // ===============================================
  // MOVIMIENTOS DE TESORERÍA
  // ===============================================

  async generateNumeroMovimiento(): Promise<string> {
    return generateNumeroMovimiento();
  },

  async registrarMovimiento(
    data: MovimientoTesoreriaFormData,
    userId: string
  ): Promise<string> {
    return _registrarMovimiento(
      data,
      userId,
      (id, diff, mon) => this.actualizarSaldoCuenta(id, diff, mon),
      (mov, esAnulacion) => this.actualizarEstadisticasPorMovimiento(mov, esAnulacion)
    );
  },

  async actualizarMovimiento(
    id: string,
    data: Partial<MovimientoTesoreriaFormData>,
    userId: string
  ): Promise<void> {
    return _actualizarMovimiento(
      id,
      data,
      userId,
      (movId) => this.getMovimientoById(movId),
      (cuentaId, diff, mon) => this.actualizarSaldoCuenta(cuentaId, diff, mon)
    );
  },

  async getMovimientoById(id: string): Promise<MovimientoTesoreria | null> {
    return getMovimientoById(id);
  },

  async eliminarMovimiento(id: string, userId: string, skipPropagacion = false): Promise<void> {
    return _eliminarMovimiento(
      id,
      userId,
      (movId) => this.getMovimientoById(movId),
      (cuentaId, diff, mon) => this.actualizarSaldoCuenta(cuentaId, diff, mon),
      (mov, esAnulacion) => this.actualizarEstadisticasPorMovimiento(mov, esAnulacion),
      skipPropagacion
    );
  },

  reconciliarPagosHuerfanos,

  async reclasificarAnticipos(
    ventaId: string,
    cotizacionOrigenId: string | undefined,
    userId: string
  ): Promise<number> {
    return _reclasificarAnticipos(
      ventaId,
      cotizacionOrigenId,
      userId,
      (filtros) => this.getMovimientos(filtros)
    );
  },

  async migrarAnticiposHistoricos(
    userId: string
  ): Promise<{ migrados: number; detalles: string[] }> {
    return _migrarAnticiposHistoricos(
      userId,
      (filtros) => this.getMovimientos(filtros)
    );
  },

  async getMovimientos(filtros?: MovimientoTesoreriaFiltros): Promise<MovimientoTesoreria[]> {
    return getMovimientos(filtros);
  },

  // ===============================================
  // CONVERSIONES CAMBIARIAS
  // ===============================================

  async generateNumeroConversion(): Promise<string> {
    return generateNumeroConversion();
  },

  async registrarConversion(
    data: ConversionCambiariaFormData,
    userId: string
  ): Promise<string> {
    return _registrarConversion(
      data,
      userId,
      () => this.generateNumeroMovimiento(),
      (cuentaId, diff, mon) => this.actualizarSaldoCuenta(cuentaId, diff, mon),
      (conv) => this.actualizarEstadisticasPorConversion(conv)
    );
  },

  async getConversiones(filtros?: ConversionCambiariaFiltros) {
    return getConversiones(filtros);
  },

  // ===============================================
  // CUENTAS DE CAJA
  // ===============================================

  async crearCuenta(data: CuentaCajaFormData, userId: string): Promise<string> {
    return crearCuenta(data, userId);
  },

  async actualizarCuenta(
    id: string,
    data: Partial<Omit<CuentaCajaFormData, 'saldoInicial' | 'saldoInicialUSD' | 'saldoInicialPEN'>>,
    userId: string
  ): Promise<void> {
    return actualizarCuenta(id, data, userId);
  },

  async toggleActivaCuenta(id: string, activa: boolean, userId: string): Promise<void> {
    return toggleActivaCuenta(id, activa, userId);
  },

  async syncMetodosBanco(
    bancoNombre: string, metodos: string[], userId: string,
    metodosDetalle?: Record<string, { identificador?: string; cuentaVinculadaId?: string }>
  ): Promise<number> {
    return syncMetodosBanco(bancoNombre, metodos, userId, metodosDetalle);
  },

  async eliminarCuenta(id: string): Promise<void> {
    return eliminarCuenta(id);
  },

  cuentaTieneSaldo,
  cuentaTieneMovimientos,

  async crearCuentasPorDefecto(userId: string): Promise<void> {
    return _crearCuentasPorDefecto(
      userId,
      () => this.getCuentas(),
      (data, uid) => this.crearCuenta(data, uid)
    );
  },

  async getCuentaPorMetodoPago(
    metodo: MetodoTesoreria,
    moneda: MonedaTesoreria = 'PEN'
  ) {
    return _getCuentaPorMetodoPago(metodo, moneda, () => this.getCuentas());
  },

  async getCuentasActivas(moneda?: MonedaTesoreria) {
    return _getCuentasActivas(moneda, () => this.getCuentas());
  },

  async getCuentas() {
    return getCuentas();
  },

  async getCuentaById(id: string) {
    return getCuentaById(id);
  },

  async actualizarSaldoCuenta(
    cuentaId: string,
    diferencia: number,
    monedaMovimiento?: MonedaTesoreria
  ): Promise<void> {
    return actualizarSaldoCuenta(cuentaId, diferencia, monedaMovimiento);
  },

  async recalcularSaldoCuenta(
    cuentaId: string
  ): Promise<{ saldoAnterior: number; saldoNuevo: number; movimientos: number }> {
    return recalcularSaldoCuenta(cuentaId);
  },

  async recalcularTodosLosSaldos(): Promise<{ cuentasActualizadas: number; errores: string[] }> {
    return recalcularTodosLosSaldos();
  },

  // ===============================================
  // REGISTRO DE TC POR TRANSACCIÓN
  // ===============================================

  async registrarTCTransaccion(
    tipoDocumento: 'orden_compra' | 'venta' | 'gasto' | 'pago_viajero',
    documentoId: string,
    documentoNumero: string,
    momento: 'cotizacion' | 'creacion' | 'confirmacion' | 'pago' | 'cobro' | 'conversion',
    montoUSD: number,
    tipoCambio: number,
    userId: string
  ): Promise<string> {
    return registrarTCTransaccion(
      tipoDocumento,
      documentoId,
      documentoNumero,
      momento,
      montoUSD,
      tipoCambio,
      userId
    );
  },

  async getHistorialTCDocumento(documentoId: string) {
    return getHistorialTCDocumento(documentoId);
  },

  // ===============================================
  // DIFERENCIA CAMBIARIA
  // ===============================================

  async calcularDiferenciaCambiaria(mes: number, anio: number) {
    return _calcularDiferenciaCambiaria(mes, anio, (filtros) => this.getConversiones(filtros));
  },

  // ===============================================
  // ESTADÍSTICAS AGREGADAS (MATERIALIZED)
  // ===============================================

  _getMesKey(fecha?: Date): string {
    return _getMesKey(fecha);
  },

  _crearEstadisticasMensualesVacias(mes: number, anio: number) {
    return _crearEstadisticasMensualesVacias(mes, anio);
  },

  async getEstadisticasAgregadas() {
    return getEstadisticasAgregadas();
  },

  async inicializarEstadisticas(userId: string): Promise<void> {
    return _inicializarEstadisticas(userId, () => this.getCuentas());
  },

  async actualizarEstadisticasPorMovimiento(
    movimiento: {
      tipo: any;
      moneda: MonedaTesoreria;
      monto: number;
      tipoCambio: number;
      cuentaOrigen?: string;
      cuentaDestino?: string;
    },
    esAnulacion: boolean = false
  ): Promise<void> {
    return _actualizarEstadisticasPorMovimiento(
      movimiento,
      esAnulacion,
      () => this.getCuentas()
    );
  },

  async actualizarEstadisticasPorConversion(conversion: {
    monedaOrigen: MonedaTesoreria;
    montoOrigen: number;
    montoDestino: number;
    tipoCambio: number;
    spreadCambiario: number;
    diferenciaVsReferencia: number;
  }): Promise<void> {
    return actualizarEstadisticasPorConversion(conversion);
  },

  async recalcularEstadisticasCompletas(
    userId: string
  ): Promise<{ mensaje: string; tiempoMs: number }> {
    return _recalcularEstadisticasCompletas(
      userId,
      (uid) => this.inicializarEstadisticas(uid),
      (filtros) => this.getMovimientos(filtros),
      (filtros) => this.getConversiones(filtros)
    );
  },

  // ===============================================
  // ESTADÍSTICAS (LECTURA RÁPIDA)
  // ===============================================

  async getStats() {
    return _getStats(
      () => this.getCuentas(),
      (filtros) => this.getMovimientos(filtros),
      (filtros) => this.getConversiones(filtros)
    );
  },

  async _calcularStatsEnTiempoReal() {
    return __calcularStatsEnTiempoReal(
      () => this.getCuentas(),
      (filtros) => this.getMovimientos(filtros),
      (filtros) => this.getConversiones(filtros)
    );
  },

  // ===============================================
  // FLUJO DE CAJA
  // ===============================================

  async getFlujoCajaMensual(mes: number, anio: number) {
    return _getFlujoCajaMensual(
      mes,
      anio,
      (filtros) => this.getMovimientos(filtros),
      (filtros) => this.getConversiones(filtros),
      () => this.getCuentas(),
      (m, a) => this.calcularDiferenciaCambiaria(m, a)
    );
  },

  // ===============================================
  // TRANSFERENCIAS ENTRE CUENTAS
  // ===============================================

  async transferirEntreCuentas(
    data: TransferenciaEntreCuentasFormData,
    userId: string
  ): Promise<{ movimientoSalidaId: string; movimientoEntradaId: string }> {
    return _transferirEntreCuentas(
      data,
      userId,
      (id) => this.getCuentaById(id),
      () => this.generateNumeroMovimiento(),
      (cuentaId, diff, mon) => this.actualizarSaldoCuenta(cuentaId, diff, mon)
    );
  },

  // ===============================================
  // APORTES DE CAPITAL
  // ===============================================

  async registrarAporteCapital(
    data: AporteCapitalFormData,
    userId: string
  ): Promise<string> {
    return _registrarAporteCapital(
      data,
      userId,
      (id) => this.getCuentaById(id),
      () => this.generateNumeroMovimiento(),
      (cuentaId, diff, mon) => this.actualizarSaldoCuenta(cuentaId, diff, mon),
      (mov, esAnulacion) => this.actualizarEstadisticasPorMovimiento(mov, esAnulacion)
    );
  },

  async registrarRetiroCapital(
    data: RetiroCapitalFormData,
    userId: string
  ): Promise<string> {
    return _registrarRetiroCapital(
      data,
      userId,
      (id) => this.getCuentaById(id),
      () => this.generateNumeroMovimiento(),
      (cuentaId, diff, mon) => this.actualizarSaldoCuenta(cuentaId, diff, mon),
      (mov, esAnulacion) => this.actualizarEstadisticasPorMovimiento(mov, esAnulacion)
    );
  },

  async getTotalAportesCapital(): Promise<{ totalPEN: number; totalUSD: number; cantidad: number }> {
    return getTotalAportesCapital();
  },

  async getTotalRetirosCapital(): Promise<{ totalPEN: number; totalUSD: number; cantidad: number; porTipo: Record<string, number> }> {
    return getTotalRetirosCapital();
  }
};

// Alias para compatibilidad con imports existentes
export const TesoreriaService = tesoreriaService;
