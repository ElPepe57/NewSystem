import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit,
  writeBatch,
  deleteDoc,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { tipoCambioService } from './tipoCambio.service';
import type {
  PoolUSDMovimiento,
  PoolUSDSnapshot,
  PoolUSDResumen,
  PoolMovimientoFormData,
  SaldoInicialFormData,
  TipoMovimientoPool,
  ImpactoCambiarioOperacion,
  PoolUSDConfig,
  RatioCobertura,
  MargenRealVsNominal,
  PrecioReposicion,
  NecesidadVentasPEN,
  EscenarioTC,
} from '../types/rendimientoCambiario.types';
import { esEntrada, POOL_USD_CONFIG_DEFAULTS } from '../types/rendimientoCambiario.types';

const MOV_COLLECTION = COLLECTIONS.POOL_USD_MOVIMIENTOS;
const SNAP_COLLECTION = COLLECTIONS.POOL_USD_SNAPSHOTS;
/** Documento de estado atómico: mantiene saldo y TCPA actual para transacciones */
const ESTADO_DOC_REF = () => doc(db, SNAP_COLLECTION, '_estado');

// ============================================================
// SERVICIO POOL USD — TCPA (TC Promedio Ponderado de Adquisición)
// ============================================================

export const poolUSDService = {

  // ==========================================================
  // LECTURA
  // ==========================================================

  /** Obtener todos los movimientos ordenados cronológicamente */
  async getMovimientos(filtros?: {
    fechaInicio?: Date;
    fechaFin?: Date;
    tipo?: TipoMovimientoPool;
    direccion?: 'entrada' | 'salida';
  }): Promise<PoolUSDMovimiento[]> {
    let q = query(
      collection(db, MOV_COLLECTION),
      orderBy('fecha', 'asc')
    );

    // Firestore no permite múltiples inequality filters — filtramos en memoria
    const snapshot = await getDocs(q);
    let movimientos = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PoolUSDMovimiento));

    if (filtros?.fechaInicio) {
      const ts = Timestamp.fromDate(filtros.fechaInicio);
      movimientos = movimientos.filter(m => m.fecha >= ts);
    }
    if (filtros?.fechaFin) {
      const ts = Timestamp.fromDate(filtros.fechaFin);
      movimientos = movimientos.filter(m => m.fecha <= ts);
    }
    if (filtros?.tipo) {
      movimientos = movimientos.filter(m => m.tipo === filtros.tipo);
    }
    if (filtros?.direccion) {
      movimientos = movimientos.filter(m => m.direccion === filtros.direccion);
    }

    return movimientos;
  },

  /** Obtener movimientos de un período específico (mes) */
  async getMovimientosPeriodo(anio: number, mes: number): Promise<PoolUSDMovimiento[]> {
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 0, 23, 59, 59);
    return this.getMovimientos({ fechaInicio: inicio, fechaFin: fin });
  },

  /** Obtener el último movimiento (estado actual del pool) */
  async getUltimoMovimiento(): Promise<PoolUSDMovimiento | null> {
    const q = query(
      collection(db, MOV_COLLECTION),
      orderBy('fecha', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PoolUSDMovimiento;
  },

  /** Obtener snapshot de un período */
  async getSnapshot(periodo: string): Promise<PoolUSDSnapshot | null> {
    const docRef = doc(db, SNAP_COLLECTION, periodo);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as PoolUSDSnapshot;
  },

  /** Obtener todos los snapshots */
  async getSnapshots(): Promise<PoolUSDSnapshot[]> {
    const q = query(collection(db, SNAP_COLLECTION), orderBy('periodo', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PoolUSDSnapshot));
  },

  /** Obtener configuración del módulo */
  async getConfig(): Promise<PoolUSDConfig> {
    try {
      const docRef = doc(db, COLLECTIONS.CONFIGURACION, 'poolUSD');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          diaCorte: data.diaCorte ?? POOL_USD_CONFIG_DEFAULTS.diaCorte,
          asientoAutoRevaluacion: data.asientoAutoRevaluacion ?? POOL_USD_CONFIG_DEFAULTS.asientoAutoRevaluacion,
          alertaDesviacionPorcentaje: data.alertaDesviacionPorcentaje ?? POOL_USD_CONFIG_DEFAULTS.alertaDesviacionPorcentaje,
          habilitado: data.habilitado ?? POOL_USD_CONFIG_DEFAULTS.habilitado,
        };
      }
    } catch (error) {
      console.warn('[PoolUSD] Error leyendo config, usando defaults:', error);
    }
    return POOL_USD_CONFIG_DEFAULTS;
  },

  // ==========================================================
  // RESUMEN EN TIEMPO REAL
  // ==========================================================

  /** Calcular el resumen actual del pool */
  async getResumen(): Promise<PoolUSDResumen> {
    const ultimo = await this.getUltimoMovimiento();
    const tcActual = await tipoCambioService.resolverTC();

    if (!ultimo) {
      return {
        saldoUSD: 0,
        tcpa: 0,
        valorPEN_tcpa: 0,
        valorPEN_mercado: 0,
        diferenciaNoRealizada: 0,
        entradasUSD: 0,
        salidasUSD: 0,
        gananciaRealizadaPEN: 0,
        gananciaOperativaPEN: 0,
        cantidadMovimientos: 0,
      };
    }

    const saldoUSD = ultimo.poolUSDDespues;
    const tcpa = ultimo.tcpaDespues;
    const valorPEN_tcpa = saldoUSD * tcpa;
    const valorPEN_mercado = saldoUSD * tcActual.venta;

    // Acumulados del mes actual
    const ahora = new Date();
    const movsMes = await this.getMovimientosPeriodo(ahora.getFullYear(), ahora.getMonth() + 1);

    let entradasUSD = 0;
    let salidasUSD = 0;
    let gananciaRealizadaPEN = 0;
    let gananciaOperativaPEN = 0;

    for (const m of movsMes) {
      if (m.direccion === 'entrada') {
        entradasUSD += m.montoUSD;
      } else {
        salidasUSD += m.montoUSD;
        gananciaRealizadaPEN += m.impactoCambiario ?? 0;
        gananciaOperativaPEN += m.impactoOperativo ?? 0;
      }
    }

    return {
      saldoUSD,
      tcpa,
      valorPEN_tcpa,
      valorPEN_mercado,
      diferenciaNoRealizada: valorPEN_mercado - valorPEN_tcpa,
      entradasUSD,
      salidasUSD,
      gananciaRealizadaPEN,
      gananciaOperativaPEN,
      cantidadMovimientos: movsMes.length,
    };
  },

  // ==========================================================
  // ESCRITURA — REGISTRAR MOVIMIENTO
  // ==========================================================

  /**
   * Registrar un movimiento en el pool USD.
   * Calcula automáticamente TCPA, saldos, e impacto cambiario.
   *
   * BUG-003 FIX: Usa runTransaction + documento de estado (_estado)
   * para garantizar atomicidad del saldo y TCPA bajo concurrencia.
   */
  async registrarMovimiento(
    data: PoolMovimientoFormData,
    userId: string
  ): Promise<PoolUSDMovimiento> {
    const entrada = esEntrada(data.tipo);

    // Obtener TC SUNAT ANTES de la transacción (llamada de red externa)
    let tcSunat: number;
    try {
      const tcSunatResuelto = await tipoCambioService.resolverTCSunat();
      tcSunat = tcSunatResuelto.venta;
    } catch {
      tcSunat = data.tcOperacion; // Fallback al TC de operación
    }

    // === TRANSACCIÓN ATÓMICA: leer estado → calcular → escribir movimiento + actualizar estado ===
    const estadoRef = ESTADO_DOC_REF();
    const movDocRef = doc(collection(db, MOV_COLLECTION)); // Pre-generar ID

    const movimiento = await runTransaction(db, async (transaction) => {
      const estadoSnap = await transaction.get(estadoRef);

      let poolAntes: number;
      let tcpaAntes: number;

      if (estadoSnap.exists()) {
        const estado = estadoSnap.data();
        poolAntes = estado.saldoUSD ?? 0;
        tcpaAntes = estado.tcpa ?? 0;
      } else {
        // Primera vez: inicializar desde último movimiento (migración) o cero
        const ultimo = await this.getUltimoMovimiento();
        poolAntes = ultimo?.poolUSDDespues ?? 0;
        tcpaAntes = ultimo?.tcpaDespues ?? 0;
      }

      // Validar que no quede negativo en salidas
      if (!entrada && data.montoUSD > poolAntes) {
        throw new Error(
          `Saldo insuficiente en pool USD. Disponible: $${poolAntes.toFixed(2)}, ` +
          `requerido: $${data.montoUSD.toFixed(2)}`
        );
      }

      // Calcular nuevo saldo
      const poolDespues = entrada
        ? poolAntes + data.montoUSD
        : poolAntes - data.montoUSD;

      // Calcular nuevo TCPA (solo cambia en entradas)
      let tcpaDespues: number;
      if (entrada) {
        if (poolAntes === 0) {
          tcpaDespues = data.tcOperacion;
        } else {
          tcpaDespues = (poolAntes * tcpaAntes + data.montoUSD * data.tcOperacion) / poolDespues;
        }
      } else {
        tcpaDespues = tcpaAntes;
      }

      // Calcular impacto cambiario (solo en salidas)
      let impactoCambiario: number | undefined;
      let impactoOperativo: number | undefined;
      if (!entrada) {
        impactoCambiario = (tcSunat - tcpaAntes) * data.montoUSD;
        impactoOperativo = (data.tcOperacion - tcpaAntes) * data.montoUSD;
      }

      const mov: Omit<PoolUSDMovimiento, 'id'> = {
        tipo: data.tipo,
        direccion: entrada ? 'entrada' : 'salida',
        montoUSD: data.montoUSD,
        tcOperacion: data.tcOperacion,
        tcSunat,
        montoPEN: data.montoUSD * data.tcOperacion,
        poolUSDAntes: poolAntes,
        poolUSDDespues: poolDespues,
        tcpaAntes,
        tcpaDespues,
        impactoCambiario,
        impactoOperativo,
        documentoOrigenTipo: data.documentoOrigenTipo,
        documentoOrigenId: data.documentoOrigenId,
        documentoOrigenNumero: data.documentoOrigenNumero,
        fecha: Timestamp.fromDate(data.fecha),
        fechaCreacion: Timestamp.now(),
        creadoPor: userId,
        notas: data.notas,
      };

      // Escribir movimiento
      transaction.set(movDocRef, mov);

      // Actualizar documento de estado atómicamente
      transaction.set(estadoRef, {
        saldoUSD: poolDespues,
        tcpa: tcpaDespues,
        ultimoMovimientoId: movDocRef.id,
        ultimaActualizacion: Timestamp.now(),
      });

      return { id: movDocRef.id, ...mov };
    });

    return movimiento as PoolUSDMovimiento;
  },

  // ==========================================================
  // SALDO INICIAL (carga retroactiva)
  // ==========================================================

  /** Registrar saldo inicial del pool (primera entrada retroactiva) */
  async registrarSaldoInicial(
    data: SaldoInicialFormData,
    userId: string
  ): Promise<PoolUSDMovimiento> {
    // Verificar que no existan movimientos previos
    const existente = await this.getUltimoMovimiento();
    if (existente) {
      throw new Error(
        'Ya existe un pool con movimientos. Use recálculo retroactivo si necesita corregir el historial.'
      );
    }

    return this.registrarMovimiento(
      {
        tipo: 'SALDO_INICIAL',
        montoUSD: data.saldoUSD,
        tcOperacion: data.tcpa,
        fecha: data.fecha,
        notas: data.notas ?? 'Saldo inicial del pool USD (carga retroactiva)',
      },
      userId
    );
  },

  // ==========================================================
  // RECÁLCULO RETROACTIVO
  // ==========================================================

  /**
   * Reconstruye todo el pool desde cero, recalculando TCPA
   * y saldos en orden cronológico estricto.
   * Usar después de cargar datos retroactivos o corregir errores.
   */
  async recalcularPoolDesdeHistorico(userId: string): Promise<{
    movimientosRecalculados: number;
    saldoFinal: number;
    tcpaFinal: number;
  }> {
    // Leer todos los movimientos en orden cronológico
    const movimientos = await this.getMovimientos();

    if (movimientos.length === 0) {
      return { movimientosRecalculados: 0, saldoFinal: 0, tcpaFinal: 0 };
    }

    const batch = writeBatch(db);
    let poolUSD = 0;
    let tcpa = 0;

    for (const mov of movimientos) {
      const entrada = esEntrada(mov.tipo);
      const poolAntes = poolUSD;
      const tcpaAntes = tcpa;

      if (entrada) {
        const nuevoPool = poolUSD + mov.montoUSD;
        if (poolUSD === 0) {
          tcpa = mov.tcOperacion;
        } else {
          tcpa = (poolUSD * tcpa + mov.montoUSD * mov.tcOperacion) / nuevoPool;
        }
        poolUSD = nuevoPool;
      } else {
        poolUSD = Math.max(0, poolUSD - mov.montoUSD);
        // TCPA no cambia en salidas
      }

      // Recalcular impacto cambiario en salidas
      let impactoCambiario: number | undefined;
      let impactoOperativo: number | undefined;
      if (!entrada) {
        impactoCambiario = (mov.tcSunat - tcpaAntes) * mov.montoUSD;
        impactoOperativo = (mov.tcOperacion - tcpaAntes) * mov.montoUSD;
      }

      const docRef = doc(db, MOV_COLLECTION, mov.id);
      batch.update(docRef, {
        poolUSDAntes: poolAntes,
        poolUSDDespues: poolUSD,
        tcpaAntes,
        tcpaDespues: tcpa,
        impactoCambiario: impactoCambiario ?? null,
        impactoOperativo: impactoOperativo ?? null,
      });
    }

    // Incluir actualización del documento de estado en el batch
    batch.set(ESTADO_DOC_REF(), {
      saldoUSD: poolUSD,
      tcpa,
      ultimoMovimientoId: movimientos[movimientos.length - 1].id,
      ultimaActualizacion: Timestamp.now(),
    });

    await batch.commit();

    return {
      movimientosRecalculados: movimientos.length,
      saldoFinal: poolUSD,
      tcpaFinal: tcpa,
    };
  },

  // ==========================================================
  // SNAPSHOT MENSUAL + REVALUACIÓN
  // ==========================================================

  /**
   * Genera snapshot del pool al cierre de un período.
   * Calcula revaluación: diferencia entre valor a TCPA vs TC de cierre.
   * La diferencia genera asiento contable 676 (pérdida) o 776 (ganancia).
   */
  async generarSnapshot(
    anio: number,
    mes: number,
    userId: string
  ): Promise<PoolUSDSnapshot> {
    const periodo = `${anio}-${String(mes).padStart(2, '0')}`;

    // Estado actual del pool
    const movimientos = await this.getMovimientos({
      fechaFin: new Date(anio, mes, 0, 23, 59, 59), // Último momento del mes
    });

    if (movimientos.length === 0) {
      throw new Error(`No hay movimientos hasta ${periodo}`);
    }

    // Último movimiento hasta el cierre de este mes
    const ultimoDelMes = movimientos[movimientos.length - 1];
    const saldoUSD = ultimoDelMes.poolUSDDespues;
    const tcpa = ultimoDelMes.tcpaDespues;

    // TC de cierre (del último día del mes)
    let tcCierreSunat: number;
    let tcCierreParalelo: number;
    try {
      const tcSunat = await tipoCambioService.resolverTCSunat();
      tcCierreSunat = tcSunat.venta;
      const tcParalelo = await tipoCambioService.resolverTC();
      tcCierreParalelo = tcParalelo.venta;
    } catch {
      // Si no hay TC para el cierre, usar TCPA
      tcCierreSunat = tcpa;
      tcCierreParalelo = tcpa;
    }

    const valorPEN_tcpa = saldoUSD * tcpa;
    const valorPEN_cierre = saldoUSD * tcCierreSunat;
    const diferenciaRevaluacion = valorPEN_cierre - valorPEN_tcpa;

    // Movimientos solo del mes
    const inicioMes = new Date(anio, mes - 1, 1);
    const movsMes = movimientos.filter(m => {
      const fechaM = m.fecha.toDate();
      return fechaM >= inicioMes;
    });

    let totalEntradasUSD = 0;
    let totalSalidasUSD = 0;
    let gananciaCambiaria = 0;
    let gananciaOperativa = 0;

    for (const m of movsMes) {
      if (m.direccion === 'entrada') {
        totalEntradasUSD += m.montoUSD;
      } else {
        totalSalidasUSD += m.montoUSD;
        gananciaCambiaria += m.impactoCambiario ?? 0;
        gananciaOperativa += m.impactoOperativo ?? 0;
      }
    }

    const snapshot: Omit<PoolUSDSnapshot, 'id'> = {
      periodo,
      anio,
      mes,
      saldoUSD,
      tcpa,
      valorPEN_tcpa,
      tcCierreSunat,
      tcCierreParalelo,
      valorPEN_cierre,
      diferenciaRevaluacion,
      asientoGenerado: false, // Se marca true cuando contabilidad genera el asiento
      totalEntradasUSD,
      totalSalidasUSD,
      cantidadMovimientos: movsMes.length,
      gananciaCambiariaAcumulada: gananciaCambiaria,
      gananciaOperativaAcumulada: gananciaOperativa,
      fechaGeneracion: Timestamp.now(),
      generadoPor: userId,
    };

    // Usar periodo como ID del documento (idempotente)
    const docRef = doc(db, SNAP_COLLECTION, periodo);
    await setDoc(docRef, snapshot);

    return { id: periodo, ...snapshot };
  },

  // ==========================================================
  // INTEGRACIÓN CON CONVERSIONES CAMBIARIAS
  // ==========================================================

  /**
   * Registra movimiento del pool automáticamente al crear una conversión cambiaria.
   * Llamar desde tesoreria.service cuando se crea una conversión PEN→USD o USD→PEN.
   */
  async registrarDesdeConversion(
    conversionId: string,
    conversionNumero: string,
    monedaOrigen: 'USD' | 'PEN',
    monedaDestino: 'USD' | 'PEN',
    montoOrigen: number,
    montoDestino: number,
    tipoCambio: number,
    fecha: Date,
    userId: string
  ): Promise<PoolUSDMovimiento | null> {
    // Solo nos interesan conversiones que involucren USD
    if (monedaOrigen === 'PEN' && monedaDestino === 'USD') {
      // Compra de USD: entrada al pool
      return this.registrarMovimiento(
        {
          tipo: 'COMPRA_USD_BANCO',
          montoUSD: montoDestino,
          tcOperacion: tipoCambio,
          fecha,
          documentoOrigenTipo: 'conversion_cambiaria',
          documentoOrigenId: conversionId,
          documentoOrigenNumero: conversionNumero,
          notas: `Conversión ${conversionNumero}: ${montoOrigen.toFixed(2)} PEN → ${montoDestino.toFixed(2)} USD @ ${tipoCambio}`,
        },
        userId
      );
    } else if (monedaOrigen === 'USD' && monedaDestino === 'PEN') {
      // Venta de USD: salida del pool
      return this.registrarMovimiento(
        {
          tipo: 'VENTA_USD',
          montoUSD: montoOrigen,
          tcOperacion: tipoCambio,
          fecha,
          documentoOrigenTipo: 'conversion_cambiaria',
          documentoOrigenId: conversionId,
          documentoOrigenNumero: conversionNumero,
          notas: `Conversión ${conversionNumero}: ${montoOrigen.toFixed(2)} USD → ${montoDestino.toFixed(2)} PEN @ ${tipoCambio}`,
        },
        userId
      );
    }

    return null; // No es una conversión que involucre USD
  },

  /**
   * Registra movimiento del pool al pagar una OC en USD.
   */
  async registrarPagoOC(
    ocId: string,
    ocNumero: string,
    montoUSD: number,
    tcOperacion: number,
    fecha: Date,
    userId: string
  ): Promise<PoolUSDMovimiento> {
    return this.registrarMovimiento(
      {
        tipo: 'PAGO_OC',
        montoUSD,
        tcOperacion,
        fecha,
        documentoOrigenTipo: 'orden_compra',
        documentoOrigenId: ocId,
        documentoOrigenNumero: ocNumero,
        notas: `Pago OC ${ocNumero}: $${montoUSD.toFixed(2)} @ ${tcOperacion}`,
      },
      userId
    );
  },

  /**
   * Registra movimiento del pool al cobrar venta en USD (Zelle/PayPal).
   */
  async registrarCobroVentaUSD(
    ventaId: string,
    ventaNumero: string,
    montoUSD: number,
    tcOperacion: number,
    fecha: Date,
    userId: string
  ): Promise<PoolUSDMovimiento> {
    return this.registrarMovimiento(
      {
        tipo: 'COBRO_VENTA_USD',
        montoUSD,
        tcOperacion,
        fecha,
        documentoOrigenTipo: 'venta',
        documentoOrigenId: ventaId,
        documentoOrigenNumero: ventaNumero,
        notas: `Cobro venta ${ventaNumero}: $${montoUSD.toFixed(2)} @ ${tcOperacion}`,
      },
      userId
    );
  },

  // ==========================================================
  // ANÁLISIS POR OPERACIÓN
  // ==========================================================

  /**
   * Calcula el impacto cambiario de una operación específica
   * comparando TC de operación vs TCPA del pool vs TC SUNAT.
   */
  calcularImpactoOperacion(
    documentoTipo: ImpactoCambiarioOperacion['documentoTipo'],
    documentoId: string,
    documentoNumero: string,
    fecha: Date,
    montoUSD: number,
    tcOperacion: number,
    tcPool: number,
    tcSunat: number
  ): ImpactoCambiarioOperacion {
    return {
      documentoTipo,
      documentoId,
      documentoNumero,
      fecha,
      montoUSD,
      tcOperacion,
      tcPool,
      tcSunat,
      costoPoolPEN: montoUSD * tcPool,
      costoOperacionPEN: montoUSD * tcOperacion,
      costoSunatPEN: montoUSD * tcSunat,
      gananciaVsPool: (tcOperacion - tcPool) * montoUSD,
      gananciaVsSunat: (tcOperacion - tcSunat) * montoUSD,
    };
  },

  // ==========================================================
  // UTILIDADES
  // ==========================================================

  /** Eliminar un movimiento (solo admin, para correcciones) */
  async eliminarMovimiento(movimientoId: string): Promise<void> {
    await deleteDoc(doc(db, MOV_COLLECTION, movimientoId));
  },

  /** Guardar configuración del módulo */
  async guardarConfig(config: Partial<PoolUSDConfig>, userId: string): Promise<void> {
    const docRef = doc(db, COLLECTIONS.CONFIGURACION, 'poolUSD');
    await setDoc(docRef, {
      ...config,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    }, { merge: true });
  },

  // ==========================================================
  // CICLO PEN↔USD — Funciones de Análisis
  // ==========================================================

  /**
   * Obtener el TCPA vigente en una fecha determinada.
   * Busca el último movimiento antes o en esa fecha.
   */
  async getTCPAEnFecha(fecha: Date): Promise<number> {
    const movimientos = await this.getMovimientos({ fechaFin: fecha });
    if (movimientos.length === 0) return 0;
    return movimientos[movimientos.length - 1].tcpaDespues;
  },

  /**
   * Calcular el Ratio de Cobertura PEN→USD.
   * Mide cuántos soles de ventas cubren los costos en dólares.
   */
  async calcularRatioCobertura(
    ventasPEN: number,
    costosUSD: number,
    periodoInicio: Date,
    periodoFin: Date
  ): Promise<RatioCobertura> {
    const tcpa = await this.getTCPAEnFecha(periodoFin);
    const costoPEN = costosUSD * (tcpa || 1);
    const ratio = costoPEN > 0 ? ventasPEN / costoPEN : 0;
    const brechaPEN = costoPEN - ventasPEN;

    return {
      totalVentasPEN: ventasPEN,
      totalCostosUSD: costosUSD,
      tcpa: tcpa || 0,
      costoPEN,
      ratio,
      brechaPEN: Math.max(0, brechaPEN),
      periodoInicio,
      periodoFin,
    };
  },

  /**
   * Calcular el Margen Real vs Nominal para una lista de productos vendidos.
   * Nominal = usando tcPago/tcCompra de cada unidad (histórico).
   * Real = usando TCPA del pool (costo real del dólar).
   */
  calcularMargenRealVsNominal(
    productos: Array<{
      productoId: string;
      nombreProducto: string;
      precioVenta: number;
      costoUSD: number;
      tcHistorico: number;
      gagoAsignado: number;
    }>,
    tcpa: number
  ): MargenRealVsNominal[] {
    return productos.map(p => {
      const ctruNominal = p.costoUSD * p.tcHistorico + p.gagoAsignado;
      const ctruReal = p.costoUSD * tcpa + p.gagoAsignado;
      const margenNominalPEN = p.precioVenta - ctruNominal;
      const margenRealPEN = p.precioVenta - ctruReal;
      const margenNominalPct = p.precioVenta > 0 ? (margenNominalPEN / p.precioVenta) * 100 : 0;
      const margenRealPct = p.precioVenta > 0 ? (margenRealPEN / p.precioVenta) * 100 : 0;

      return {
        productoId: p.productoId,
        nombreProducto: p.nombreProducto,
        precioVenta: p.precioVenta,
        ctruNominal,
        ctruReal,
        margenNominalPEN,
        margenRealPEN,
        margenNominalPct,
        margenRealPct,
        gapCambiario: margenRealPEN - margenNominalPEN,
      };
    });
  },

  /**
   * Calcular Precio Mínimo de Reposición para productos.
   * Cuánto se debería cobrar para cubrir el costo de REPONER al TCPA actual.
   */
  calcularPreciosReposicion(
    productos: Array<{
      productoId: string;
      nombreProducto: string;
      costoUSD: number;
      gagoEstimado: number;
      precioVentaActual?: number;
    }>,
    tcpa: number
  ): PrecioReposicion[] {
    return productos.map(p => {
      const costoBasePEN = p.costoUSD * tcpa;
      const precioMinReposicion = costoBasePEN + p.gagoEstimado;
      return {
        productoId: p.productoId,
        nombreProducto: p.nombreProducto,
        costoUSD: p.costoUSD,
        tcpa,
        costoBasePEN,
        gagoEstimado: p.gagoEstimado,
        precioMinReposicion,
        precioVentaActual: p.precioVentaActual,
        alertaReposicion: (p.precioVentaActual ?? 0) > 0 && (p.precioVentaActual ?? 0) < precioMinReposicion,
      };
    });
  },

  /**
   * Calcular Necesidad de Ventas PEN para cubrir compromisos USD.
   */
  calcularNecesidadVentas(
    necesidadUSD: number,
    tcMercado: number,
    ventasPipelinePEN: number
  ): NecesidadVentasPEN {
    const penNecesarios = necesidadUSD * tcMercado;
    const coberturaPipeline = penNecesarios > 0 ? ventasPipelinePEN / penNecesarios : 0;
    return {
      necesidadUSD,
      tcMercado,
      penNecesarios,
      ventasPipelinePEN,
      coberturaPipeline,
      brechaPEN: Math.max(0, penNecesarios - ventasPipelinePEN),
    };
  },

  /**
   * Generar escenarios TC para el simulador.
   * Calcula impacto de variaciones de TC en pool, CTRU y márgenes.
   */
  generarEscenariosTC(
    tcActual: number,
    saldoPoolUSD: number,
    tcpa: number,
    ctruRealPromedio: number,
    precioVentaPromedio: number,
    necesidadUSD: number,
    variaciones: number[] = [-10, -5, -2, 0, 2, 5, 10]
  ): EscenarioTC[] {
    return variaciones.map(pct => {
      const tcSimulado = tcActual * (1 + pct / 100);
      // Impacto en valor del pool
      const valorPoolActual = saldoPoolUSD * tcActual;
      const valorPoolSimulado = saldoPoolUSD * tcSimulado;
      const impactoPoolPEN = valorPoolSimulado - valorPoolActual;
      // Impacto en CTRU real (proporcional al cambio en TC)
      // Si TC sube, el CTRU real de reposición sube
      const ctruSimulado = ctruRealPromedio * (tcSimulado / (tcpa || tcActual));
      const impactoCTRURealPEN = ctruSimulado - ctruRealPromedio;
      // Impacto en margen
      const margenActual = precioVentaPromedio > 0 ? ((precioVentaPromedio - ctruRealPromedio) / precioVentaPromedio) * 100 : 0;
      const margenSimulado = precioVentaPromedio > 0 ? ((precioVentaPromedio - ctruSimulado) / precioVentaPromedio) * 100 : 0;
      const impactoMargenPct = margenSimulado - margenActual;
      // Impacto en necesidad de PEN
      const penActual = necesidadUSD * tcActual;
      const penSimulado = necesidadUSD * tcSimulado;
      const impactoNecesidadPEN = penSimulado - penActual;

      return {
        nombre: pct === 0 ? 'Base' : `TC ${pct > 0 ? '+' : ''}${pct}%`,
        tcSimulado,
        variacionPct: pct,
        impactoPoolPEN,
        impactoCTRURealPEN,
        impactoMargenPct,
        impactoNecesidadPEN,
      };
    });
  },
};
