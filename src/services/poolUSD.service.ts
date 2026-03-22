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
import { logger } from '../lib/logger';

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
          metaPEN: data.metaPEN ?? POOL_USD_CONFIG_DEFAULTS.metaPEN,
        };
      }
    } catch (error) {
      logger.warn('[PoolUSD] Error leyendo config, usando defaults:', error);
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

    // DATA-002 FIX: getUltimoMovimiento() usa getDocs() — una query que Firestore
    // no permite ejecutar dentro de runTransaction (solo acepta transaction.get()
    // sobre DocumentReferences). Si _estado no existe (primera vez), lo resolvemos
    // ANTES de entrar a la transacción y pasamos el resultado como captura.
    // Si _estado sí existe, la transacción lo lee atómicamente y este valor queda sin usar.
    const estadoInicialFallback = await (async () => {
      // Verificar si _estado ya existe para evitar la query innecesaria en el caso normal
      const estadoPreSnap = await getDoc(estadoRef);
      if (estadoPreSnap.exists()) {
        return { pool: 0, tcpa: 0 }; // no se usará; _estado tiene prioridad
      }
      const ultimo = await this.getUltimoMovimiento();
      return {
        pool: ultimo?.poolUSDDespues ?? 0,
        tcpa: ultimo?.tcpaDespues ?? 0,
      };
    })();

    const movimiento = await runTransaction(db, async (transaction) => {
      const estadoSnap = await transaction.get(estadoRef);

      let poolAntes: number;
      let tcpaAntes: number;

      if (estadoSnap.exists()) {
        const estado = estadoSnap.data();
        poolAntes = estado.saldoUSD ?? 0;
        tcpaAntes = estado.tcpa ?? 0;
      } else {
        // Primera vez: usar el fallback calculado fuera de la transacción.
        // getUltimoMovimiento() no puede llamarse aquí porque usa getDocs()
        // (query de colección), que Firestore prohíbe dentro de runTransaction.
        poolAntes = estadoInicialFallback.pool;
        tcpaAntes = estadoInicialFallback.tcpa;
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

  /**
   * Eliminar un movimiento (solo admin, para correcciones).
   * BUG-001 FIX: tras eliminar el documento, recalcula _estado desde el
   * último movimiento restante. Si no quedan movimientos, elimina _estado.
   */
  async eliminarMovimiento(movimientoId: string): Promise<void> {
    await deleteDoc(doc(db, MOV_COLLECTION, movimientoId));

    // Recalcular _estado desde el nuevo último movimiento
    const estadoRef = ESTADO_DOC_REF();
    const ultimo = await this.getUltimoMovimiento();

    if (!ultimo) {
      // No quedan movimientos: eliminar el documento de estado para evitar
      // que registrarMovimiento lea un saldo/TCPA obsoleto.
      await deleteDoc(estadoRef);
      return;
    }

    // Actualizar _estado con los valores del último movimiento restante
    await setDoc(estadoRef, {
      saldoUSD: ultimo.poolUSDDespues,
      tcpa: ultimo.tcpaDespues,
      ultimoMovimientoId: ultimo.id,
      ultimaActualizacion: Timestamp.now(),
    });
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
  // CARGA RETROACTIVA (TAREA-065)
  // ==========================================================

  /**
   * Carga retroactiva: recopila pagos OC en USD, gastos USD pagados,
   * y conversiones cambiarias históricas, los ordena cronológicamente,
   * y los registra en el pool uno a uno.
   *
   * PRECONDICIÓN: Pool debe estar vacío (sin movimientos).
   * Si ya hay movimientos, lanzar error para evitar duplicados.
   *
   * @param mesesAtras - Cuántos meses hacia atrás cargar (default: 3)
   * @param userId - ID del usuario que ejecuta la carga
   * @returns Resumen de la carga
   */
  async cargarRetroactivo(
    mesesAtras: number,
    userId: string,
    onProgress?: (msg: string, pct: number) => void
  ): Promise<{
    totalMovimientos: number;
    pagosOC: number;
    gastosUSD: number;
    conversiones: number;
    saldoFinal: number;
    tcpaFinal: number;
  }> {
    // Verificar que no hay movimientos existentes
    const existente = await this.getUltimoMovimiento();
    if (existente) {
      throw new Error(
        'Ya existen movimientos en el pool. Elimine todos los movimientos primero si desea recargar.'
      );
    }

    const ahora = new Date();
    const fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth() - mesesAtras, 1);

    onProgress?.('Leyendo pagos de órdenes de compra...', 5);

    // 1. Obtener pagos OC en USD — filtrar desde fechaInicio para evitar leer TODAS las OC
    const ocSnap = await getDocs(query(
      collection(db, COLLECTIONS.ORDENES_COMPRA),
      where('fechaCreacion', '>=', Timestamp.fromDate(fechaInicio))
    ));
    const pagosOC: Array<{
      tipo: TipoMovimientoPool;
      montoUSD: number;
      tcOperacion: number;
      fecha: Date;
      docTipo: PoolUSDMovimiento['documentoOrigenTipo'];
      docId: string;
      docNumero: string;
      notas: string;
    }> = [];

    ocSnap.docs.forEach(d => {
      const oc = d.data();
      const pagos = oc.historialPagos || [];
      for (const pago of pagos) {
        if (pago.monedaPago === 'USD' || (!pago.monedaPago && oc.moneda === 'USD')) {
          const fechaPago = pago.fecha?.toDate?.() || pago.fechaRegistro?.toDate?.();
          if (!fechaPago || fechaPago < fechaInicio) continue;
          pagosOC.push({
            tipo: 'PAGO_OC',
            montoUSD: pago.montoUSD || pago.montoOriginal || 0,
            tcOperacion: pago.tipoCambio || oc.tcPago || oc.tcCompra || 3.70,
            fecha: fechaPago,
            docTipo: 'orden_compra',
            docId: d.id,
            docNumero: oc.numeroOrden || d.id,
            notas: `[Retro] Pago OC ${oc.numeroOrden || d.id}`,
          });
        }
      }
    });

    onProgress?.(`${pagosOC.length} pagos OC encontrados. Leyendo gastos USD...`, 25);

    // 2. Obtener gastos USD pagados
    const gastosSnap = await getDocs(
      query(collection(db, COLLECTIONS.GASTOS), where('moneda', '==', 'USD'))
    );
    const gastosUSD: typeof pagosOC = [];

    gastosSnap.docs.forEach(d => {
      const g = d.data();
      if (g.estado !== 'pagado' && g.estado !== 'aprobado') return;
      const fechaGasto = g.fechaPago?.toDate?.() || g.fecha?.toDate?.();
      if (!fechaGasto || fechaGasto < fechaInicio) return;
      const esImportacion = ['GI', 'flete', 'aduana'].includes(g.categoria);
      gastosUSD.push({
        tipo: esImportacion ? 'GASTO_IMPORTACION_USD' : 'GASTO_SERVICIO_USD',
        montoUSD: g.montoOriginal || g.monto || 0,
        tcOperacion: g.tipoCambio || 3.70,
        fecha: fechaGasto,
        docTipo: 'gasto',
        docId: d.id,
        docNumero: g.numeroGasto || d.id,
        notas: `[Retro] Gasto ${g.numeroGasto || d.id}: ${g.descripcion || ''}`.slice(0, 200),
      });
    });

    onProgress?.(`${gastosUSD.length} gastos USD encontrados. Leyendo conversiones...`, 50);

    // 3. Obtener conversiones cambiarias
    const convSnap = await getDocs(collection(db, COLLECTIONS.CONVERSIONES_CAMBIARIAS));
    const conversiones: typeof pagosOC = [];

    convSnap.docs.forEach(d => {
      const c = d.data();
      const fechaConv = c.fecha?.toDate?.();
      if (!fechaConv || fechaConv < fechaInicio) return;

      if (c.monedaOrigen === 'PEN' && c.monedaDestino === 'USD') {
        // Compra USD: entrada
        conversiones.push({
          tipo: 'COMPRA_USD_BANCO',
          montoUSD: c.montoDestino || 0,
          tcOperacion: c.tipoCambio || 3.70,
          fecha: fechaConv,
          docTipo: 'conversion_cambiaria',
          docId: d.id,
          docNumero: c.numeroConversion || d.id,
          notas: `[Retro] Conversión ${c.numeroConversion || d.id}: PEN→USD`,
        });
      } else if (c.monedaOrigen === 'USD' && c.monedaDestino === 'PEN') {
        // Venta USD: salida
        conversiones.push({
          tipo: 'VENTA_USD',
          montoUSD: c.montoOrigen || 0,
          tcOperacion: c.tipoCambio || 3.70,
          fecha: fechaConv,
          docTipo: 'conversion_cambiaria',
          docId: d.id,
          docNumero: c.numeroConversion || d.id,
          notas: `[Retro] Conversión ${c.numeroConversion || d.id}: USD→PEN`,
        });
      }
    });

    onProgress?.(`${conversiones.length} conversiones encontradas. Ordenando cronológicamente...`, 65);

    // 4. Combinar y ordenar cronológicamente
    const todosMovimientos = [...pagosOC, ...gastosUSD, ...conversiones]
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    if (todosMovimientos.length === 0) {
      return {
        totalMovimientos: 0,
        pagosOC: 0,
        gastosUSD: 0,
        conversiones: 0,
        saldoFinal: 0,
        tcpaFinal: 0,
      };
    }

    onProgress?.(`Registrando ${todosMovimientos.length} movimientos en orden...`, 70);

    // 5. Registrar uno por uno en orden (cada uno actualiza _estado atómicamente)
    for (let i = 0; i < todosMovimientos.length; i++) {
      const m = todosMovimientos[i];
      try {
        await this.registrarMovimiento(
          {
            tipo: m.tipo,
            montoUSD: m.montoUSD,
            tcOperacion: m.tcOperacion,
            fecha: m.fecha,
            documentoOrigenTipo: m.docTipo,
            documentoOrigenId: m.docId,
            documentoOrigenNumero: m.docNumero,
            notas: m.notas,
          },
          userId
        );
      } catch (err) {
        logger.warn(`[Retro] Error en movimiento ${i + 1}/${todosMovimientos.length}:`, err);
        // Continuar con el siguiente — salidas sin saldo se ignoran
      }
      if ((i + 1) % 5 === 0 || i === todosMovimientos.length - 1) {
        const pct = 70 + ((i + 1) / todosMovimientos.length) * 28;
        onProgress?.(`Movimiento ${i + 1}/${todosMovimientos.length}...`, pct);
      }
    }

    // 6. Obtener estado final
    const ultimo = await this.getUltimoMovimiento();
    onProgress?.('Carga retroactiva completada', 100);

    return {
      totalMovimientos: todosMovimientos.length,
      pagosOC: pagosOC.length,
      gastosUSD: gastosUSD.length,
      conversiones: conversiones.length,
      saldoFinal: ultimo?.poolUSDDespues ?? 0,
      tcpaFinal: ultimo?.tcpaDespues ?? 0,
    };
  },

  /**
   * Eliminar TODOS los movimientos del pool (para reset antes de carga retroactiva).
   * Solo admin.
   */
  async eliminarTodosMovimientos(): Promise<number> {
    const snap = await getDocs(collection(db, MOV_COLLECTION));
    if (snap.empty) return 0;

    let eliminados = 0;
    // Batch en grupos de 450
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = writeBatch(db);
      const slice = docs.slice(i, i + 450);
      for (const d of slice) {
        batch.delete(d.ref);
      }
      // También eliminar _estado en el último batch
      if (i + 450 >= docs.length) {
        batch.delete(ESTADO_DOC_REF());
      }
      await batch.commit();
      eliminados += slice.length;
    }

    return eliminados;
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
