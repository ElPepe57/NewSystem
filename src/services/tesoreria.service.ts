import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { tipoCambioService } from './tipoCambio.service';
import type {
  MovimientoTesoreria,
  MovimientoTesoreriaFormData,
  MovimientoTesoreriaFiltros,
  ConversionCambiaria,
  ConversionCambiariaFormData,
  ConversionCambiariaFiltros,
  CuentaCaja,
  CuentaCajaFormData,
  RegistroTCTransaccion,
  DiferenciaCambiariaPeriodo,
  TesoreriaStats,
  FlujoCajaDiario,
  FlujoCajaMensual,
  TipoMovimientoTesoreria,
  MonedaTesoreria,
  MetodoTesoreria
} from '../types/tesoreria.types';

const MOVIMIENTOS_COLLECTION = 'movimientosTesoreria';
const CONVERSIONES_COLLECTION = 'conversionesCambiarias';
const CUENTAS_COLLECTION = 'cuentasCaja';
const REGISTROS_TC_COLLECTION = 'registrosTCTransaccion';

// Tipos de movimiento que son ingresos (entradas de dinero)
const TIPOS_INGRESO: TipoMovimientoTesoreria[] = [
  'ingreso_venta',
  'ingreso_otro',
  'ajuste_positivo'
];

// Tipos de movimiento que son egresos (salidas de dinero)
const TIPOS_EGRESO: TipoMovimientoTesoreria[] = [
  'pago_orden_compra',
  'pago_viajero',
  'pago_proveedor_local',
  'gasto_operativo',
  'retiro_socio',
  'ajuste_negativo'
];

/**
 * Helper para determinar si un tipo de movimiento es ingreso
 */
const esMovimientoIngreso = (tipo: TipoMovimientoTesoreria): boolean => {
  return TIPOS_INGRESO.includes(tipo);
};

/**
 * Helper para determinar si un tipo de movimiento es egreso
 */
const esMovimientoEgreso = (tipo: TipoMovimientoTesoreria): boolean => {
  return TIPOS_EGRESO.includes(tipo);
};

/**
 * Servicio de Tesorería
 * Gestiona el flujo de dinero, conversiones cambiarias y tracking de TC
 */
export const tesoreriaService = {
  // ===============================================
  // MOVIMIENTOS DE TESORERÍA
  // ===============================================

  /**
   * Generar número de movimiento
   */
  async generateNumeroMovimiento(): Promise<string> {
    const year = new Date().getFullYear();
    const q = query(
      collection(db, MOVIMIENTOS_COLLECTION),
      orderBy('fechaCreacion', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);

    let nextNumber = 1;
    if (!snapshot.empty) {
      const lastDoc = snapshot.docs[0].data();
      const lastNumero = lastDoc.numeroMovimiento as string;
      const match = lastNumero.match(/MOV-\d{4}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `MOV-${year}-${nextNumber.toString().padStart(4, '0')}`;
  },

  /**
   * Registrar un movimiento de tesorería
   */
  async registrarMovimiento(
    data: MovimientoTesoreriaFormData,
    userId: string
  ): Promise<string> {
    const numeroMovimiento = await this.generateNumeroMovimiento();

    // Calcular equivalentes
    let montoEquivalentePEN = data.monto;
    let montoEquivalenteUSD = data.monto;

    if (data.moneda === 'USD') {
      montoEquivalentePEN = data.monto * data.tipoCambio;
      montoEquivalenteUSD = data.monto;
    } else {
      montoEquivalentePEN = data.monto;
      montoEquivalenteUSD = data.monto / data.tipoCambio;
    }

    // Construir objeto base (solo campos requeridos)
    const movimiento: Record<string, any> = {
      numeroMovimiento,
      tipo: data.tipo,
      estado: 'ejecutado',
      moneda: data.moneda,
      monto: data.monto,
      tipoCambio: data.tipoCambio,
      montoEquivalentePEN,
      montoEquivalenteUSD,
      metodo: data.metodo,
      concepto: data.concepto,
      fecha: Timestamp.fromDate(data.fecha),
      creadoPor: userId,
      fechaCreacion: Timestamp.now()
    };

    // Agregar campos opcionales solo si tienen valor (Firebase no acepta undefined)
    if (data.referencia) movimiento.referencia = data.referencia;
    if (data.notas) movimiento.notas = data.notas;
    if (data.ordenCompraId) movimiento.ordenCompraId = data.ordenCompraId;
    if (data.ordenCompraNumero) movimiento.ordenCompraNumero = data.ordenCompraNumero;
    if (data.ventaId) movimiento.ventaId = data.ventaId;
    if (data.ventaNumero) movimiento.ventaNumero = data.ventaNumero;
    if (data.gastoId) movimiento.gastoId = data.gastoId;
    if (data.cuentaOrigen) movimiento.cuentaOrigen = data.cuentaOrigen;
    if (data.cuentaDestino) movimiento.cuentaDestino = data.cuentaDestino;

    const docRef = await addDoc(collection(db, MOVIMIENTOS_COLLECTION), movimiento);

    // Actualizar saldos de cuentas si aplica
    // Pasamos la moneda del movimiento para cuentas bi-moneda
    if (data.cuentaOrigen) {
      await this.actualizarSaldoCuenta(data.cuentaOrigen, -data.monto, data.moneda);
    }
    if (data.cuentaDestino) {
      await this.actualizarSaldoCuenta(data.cuentaDestino, data.monto, data.moneda);
    }

    return docRef.id;
  },

  /**
   * Obtener movimientos con filtros
   */
  async getMovimientos(filtros?: MovimientoTesoreriaFiltros): Promise<MovimientoTesoreria[]> {
    let q = query(
      collection(db, MOVIMIENTOS_COLLECTION),
      orderBy('fecha', 'desc')
    );

    if (filtros?.tipo) {
      q = query(q, where('tipo', '==', filtros.tipo));
    }
    if (filtros?.estado) {
      q = query(q, where('estado', '==', filtros.estado));
    }
    if (filtros?.moneda) {
      q = query(q, where('moneda', '==', filtros.moneda));
    }
    if (filtros?.cuentaId) {
      // Buscar en origen o destino
      q = query(q, where('cuentaOrigen', '==', filtros.cuentaId));
    }

    const snapshot = await getDocs(q);
    let movimientos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MovimientoTesoreria));

    // Filtros adicionales en memoria
    if (filtros?.fechaInicio) {
      const desde = Timestamp.fromDate(filtros.fechaInicio);
      movimientos = movimientos.filter(m => m.fecha.seconds >= desde.seconds);
    }
    if (filtros?.fechaFin) {
      const hasta = Timestamp.fromDate(filtros.fechaFin);
      movimientos = movimientos.filter(m => m.fecha.seconds <= hasta.seconds);
    }

    return movimientos;
  },

  // ===============================================
  // CONVERSIONES CAMBIARIAS
  // ===============================================

  /**
   * Generar número de conversión
   */
  async generateNumeroConversion(): Promise<string> {
    const year = new Date().getFullYear();
    const q = query(
      collection(db, CONVERSIONES_COLLECTION),
      orderBy('fechaCreacion', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);

    let nextNumber = 1;
    if (!snapshot.empty) {
      const lastDoc = snapshot.docs[0].data();
      const lastNumero = lastDoc.numeroConversion as string;
      const match = lastNumero.match(/CONV-\d{4}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `CONV-${year}-${nextNumber.toString().padStart(4, '0')}`;
  },

  /**
   * Registrar una conversión cambiaria
   */
  async registrarConversion(
    data: ConversionCambiariaFormData,
    userId: string
  ): Promise<string> {
    const numeroConversion = await this.generateNumeroConversion();

    // Obtener TC de referencia del día
    let tipoCambioReferencia = data.tipoCambio;
    try {
      const tcDelDia = await tipoCambioService.getTCDelDia();
      if (tcDelDia) {
        tipoCambioReferencia = data.monedaOrigen === 'USD' ? tcDelDia.venta : tcDelDia.compra;
      }
    } catch (e) {
      console.warn('No se pudo obtener TC de referencia');
    }

    // Calcular monto destino
    const montoDestino = data.monedaOrigen === 'USD'
      ? data.montoOrigen * data.tipoCambio
      : data.montoOrigen / data.tipoCambio;

    const monedaDestino: MonedaTesoreria = data.monedaOrigen === 'USD' ? 'PEN' : 'USD';

    // Calcular spread (diferencia vs TC referencia)
    const spreadCambiario = ((data.tipoCambio - tipoCambioReferencia) / tipoCambioReferencia) * 100;

    // Calcular diferencia vs referencia (pérdida/ganancia)
    const diferenciaVsReferencia = data.monedaOrigen === 'USD'
      ? (data.tipoCambio - tipoCambioReferencia) * data.montoOrigen
      : (tipoCambioReferencia - data.tipoCambio) * montoDestino;

    const conversion: Omit<ConversionCambiaria, 'id'> = {
      numeroConversion,
      monedaOrigen: data.monedaOrigen,
      monedaDestino,
      montoOrigen: data.montoOrigen,
      montoDestino,
      tipoCambio: data.tipoCambio,
      tipoCambioReferencia,
      spreadCambiario,
      entidadCambio: data.entidadCambio,
      diferenciaVsReferencia,
      fecha: Timestamp.fromDate(data.fecha),
      motivo: data.motivo,
      notas: data.notas,
      creadoPor: userId,
      fechaCreacion: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, CONVERSIONES_COLLECTION), conversion);
    return docRef.id;
  },

  /**
   * Obtener conversiones con filtros
   */
  async getConversiones(filtros?: ConversionCambiariaFiltros): Promise<ConversionCambiaria[]> {
    let q = query(
      collection(db, CONVERSIONES_COLLECTION),
      orderBy('fecha', 'desc')
    );

    if (filtros?.monedaOrigen) {
      q = query(q, where('monedaOrigen', '==', filtros.monedaOrigen));
    }
    if (filtros?.entidadCambio) {
      q = query(q, where('entidadCambio', '==', filtros.entidadCambio));
    }

    const snapshot = await getDocs(q);
    let conversiones = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ConversionCambiaria));

    // Filtros de fecha en memoria
    if (filtros?.fechaInicio) {
      const desde = Timestamp.fromDate(filtros.fechaInicio);
      conversiones = conversiones.filter(c => c.fecha.seconds >= desde.seconds);
    }
    if (filtros?.fechaFin) {
      const hasta = Timestamp.fromDate(filtros.fechaFin);
      conversiones = conversiones.filter(c => c.fecha.seconds <= hasta.seconds);
    }

    return conversiones;
  },

  // ===============================================
  // CUENTAS DE CAJA
  // ===============================================

  /**
   * Crear cuenta de caja
   * Soporta cuentas mono-moneda y bi-moneda
   */
  async crearCuenta(data: CuentaCajaFormData, userId: string): Promise<string> {
    // Validar campo obligatorio
    if (!data.titular?.trim()) {
      throw new Error('El titular de la cuenta es obligatorio');
    }

    const esBiMoneda = data.esBiMoneda || false;

    // Filtrar campos undefined para evitar errores de Firebase
    const cuenta: Record<string, any> = {
      nombre: data.nombre,
      titular: data.titular.trim(),
      tipo: data.tipo,
      esBiMoneda,
      moneda: data.moneda,
      activa: true,
      creadoPor: userId,
      fechaCreacion: Timestamp.now()
    };

    // Configurar saldos según tipo de cuenta
    if (esBiMoneda) {
      // Cuenta bi-moneda: saldos separados para USD y PEN
      cuenta.saldoUSD = data.saldoInicialUSD || 0;
      cuenta.saldoPEN = data.saldoInicialPEN || 0;
      cuenta.saldoActual = 0; // No se usa en bi-moneda, pero mantenemos compatibilidad

      // Saldos mínimos bi-moneda
      if (data.saldoMinimoUSD !== undefined && data.saldoMinimoUSD !== null) {
        cuenta.saldoMinimoUSD = data.saldoMinimoUSD;
      }
      if (data.saldoMinimoPEN !== undefined && data.saldoMinimoPEN !== null) {
        cuenta.saldoMinimoPEN = data.saldoMinimoPEN;
      }
    } else {
      // Cuenta mono-moneda
      cuenta.saldoActual = data.saldoInicial || 0;
      if (data.saldoMinimo !== undefined && data.saldoMinimo !== null) {
        cuenta.saldoMinimo = data.saldoMinimo;
      }
    }

    // Campos opcionales
    if (data.banco) {
      cuenta.banco = data.banco;
    }
    if (data.numeroCuenta) {
      cuenta.numeroCuenta = data.numeroCuenta;
    }
    if (data.cci) {
      cuenta.cci = data.cci;
    }
    if (data.metodoPagoAsociado) {
      cuenta.metodoPagoAsociado = data.metodoPagoAsociado;
    }
    if (data.esCuentaPorDefecto !== undefined) {
      cuenta.esCuentaPorDefecto = data.esCuentaPorDefecto;
    }

    const docRef = await addDoc(collection(db, CUENTAS_COLLECTION), cuenta);
    return docRef.id;
  },

  /**
   * Actualizar cuenta de caja
   * Soporta actualización de cuentas mono-moneda y bi-moneda
   */
  async actualizarCuenta(
    id: string,
    data: Partial<Omit<CuentaCajaFormData, 'saldoInicial' | 'saldoInicialUSD' | 'saldoInicialPEN'>>,
    userId: string
  ): Promise<void> {
    // Validar campo obligatorio si se está actualizando
    if (data.titular !== undefined && !data.titular?.trim()) {
      throw new Error('El titular de la cuenta es obligatorio');
    }

    const updates: Record<string, any> = {
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now()
    };

    // Campos básicos
    if (data.nombre !== undefined) updates.nombre = data.nombre;
    if (data.titular !== undefined) updates.titular = data.titular.trim();
    if (data.tipo !== undefined) updates.tipo = data.tipo;
    if (data.moneda !== undefined) updates.moneda = data.moneda;
    if (data.esBiMoneda !== undefined) updates.esBiMoneda = data.esBiMoneda;

    // Saldos mínimos mono-moneda
    if (data.saldoMinimo !== undefined) updates.saldoMinimo = data.saldoMinimo;

    // Saldos mínimos bi-moneda
    if (data.saldoMinimoUSD !== undefined) updates.saldoMinimoUSD = data.saldoMinimoUSD;
    if (data.saldoMinimoPEN !== undefined) updates.saldoMinimoPEN = data.saldoMinimoPEN;

    // Datos bancarios
    if (data.banco !== undefined) updates.banco = data.banco;
    if (data.numeroCuenta !== undefined) updates.numeroCuenta = data.numeroCuenta;
    if (data.cci !== undefined) updates.cci = data.cci;
    if (data.metodoPagoAsociado !== undefined) updates.metodoPagoAsociado = data.metodoPagoAsociado;
    if (data.esCuentaPorDefecto !== undefined) updates.esCuentaPorDefecto = data.esCuentaPorDefecto;

    await updateDoc(doc(db, CUENTAS_COLLECTION, id), updates);
  },

  /**
   * Activar/Desactivar cuenta
   */
  async toggleActivaCuenta(id: string, activa: boolean, userId: string): Promise<void> {
    await updateDoc(doc(db, CUENTAS_COLLECTION, id), {
      activa,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now()
    });
  },

  /**
   * Crear cuentas por defecto asociadas a métodos de pago
   * Esta función se ejecuta una sola vez para inicializar el sistema
   */
  async crearCuentasPorDefecto(userId: string): Promise<void> {
    const cuentasExistentes = await this.getCuentas();

    // Si ya hay cuentas, no crear las por defecto
    if (cuentasExistentes.length > 0) {
      logger.info('Ya existen cuentas, omitiendo creación de cuentas por defecto');
      return;
    }

    const cuentasPorDefecto: CuentaCajaFormData[] = [
      {
        nombre: 'Caja Efectivo',
        titular: 'Empresa',
        tipo: 'efectivo' as const,
        moneda: 'PEN' as const,
        esBiMoneda: false,
        saldoInicial: 0,
        metodoPagoAsociado: 'efectivo' as const,
        esCuentaPorDefecto: true
      },
      {
        nombre: 'Cuenta BCP',
        titular: 'Empresa',
        tipo: 'banco' as const,
        moneda: 'PEN' as const,
        esBiMoneda: false,
        saldoInicial: 0,
        banco: 'BCP',
        metodoPagoAsociado: 'transferencia_bancaria' as const,
        esCuentaPorDefecto: true
      },
      {
        nombre: 'Cuenta Interbank',
        titular: 'Empresa',
        tipo: 'banco' as const,
        moneda: 'PEN' as const,
        esBiMoneda: false,
        saldoInicial: 0,
        banco: 'Interbank',
        metodoPagoAsociado: 'transferencia_bancaria' as const,
        esCuentaPorDefecto: false
      },
      {
        nombre: 'Yape',
        titular: 'Empresa',
        tipo: 'digital' as const,
        moneda: 'PEN' as const,
        esBiMoneda: false,
        saldoInicial: 0,
        metodoPagoAsociado: 'yape' as const,
        esCuentaPorDefecto: true
      },
      {
        nombre: 'Plin',
        titular: 'Empresa',
        tipo: 'digital' as const,
        moneda: 'PEN' as const,
        esBiMoneda: false,
        saldoInicial: 0,
        metodoPagoAsociado: 'plin' as const,
        esCuentaPorDefecto: true
      },
      {
        nombre: 'Mercado Pago',
        titular: 'Empresa',
        tipo: 'digital' as const,
        moneda: 'PEN' as const,
        esBiMoneda: false,
        saldoInicial: 0,
        metodoPagoAsociado: 'mercado_pago' as const,
        esCuentaPorDefecto: true
      },
      {
        nombre: 'Tarjeta (POS)',
        titular: 'Empresa',
        tipo: 'digital' as const,
        moneda: 'PEN' as const,
        esBiMoneda: false,
        saldoInicial: 0,
        metodoPagoAsociado: 'tarjeta' as const,
        esCuentaPorDefecto: true
      },
      {
        nombre: 'Cuenta USD',
        titular: 'Empresa',
        tipo: 'banco' as const,
        moneda: 'USD' as const,
        esBiMoneda: false,
        saldoInicial: 0,
        banco: 'BCP',
        metodoPagoAsociado: 'transferencia_bancaria' as const,
        esCuentaPorDefecto: false
      }
    ];

    for (const cuenta of cuentasPorDefecto) {
      await this.crearCuenta(cuenta, userId);
    }

    logger.success('Cuentas por defecto creadas exitosamente');
  },

  /**
   * Obtener cuenta por defecto según método de pago
   */
  async getCuentaPorMetodoPago(metodo: MetodoTesoreria, moneda: MonedaTesoreria = 'PEN'): Promise<CuentaCaja | null> {
    const cuentas = await this.getCuentas();

    // Helper para verificar si la cuenta acepta la moneda
    const aceptaMoneda = (c: CuentaCaja): boolean => {
      // Cuentas bi-moneda aceptan ambas monedas
      if (c.esBiMoneda) return true;
      // Cuentas mono-moneda solo aceptan su moneda configurada
      return c.moneda === moneda;
    };

    // Primero buscar cuenta por defecto para ese método
    let cuenta = cuentas.find(
      c => c.metodoPagoAsociado === metodo &&
           c.esCuentaPorDefecto === true &&
           aceptaMoneda(c) &&
           c.activa
    );

    // Si no hay cuenta por defecto, buscar cualquier cuenta activa con ese método
    if (!cuenta) {
      cuenta = cuentas.find(
        c => c.metodoPagoAsociado === metodo &&
             aceptaMoneda(c) &&
             c.activa
      );
    }

    // Si aún no hay, buscar cualquier cuenta activa que acepte esa moneda
    if (!cuenta) {
      cuenta = cuentas.find(
        c => aceptaMoneda(c) && c.activa
      );
    }

    return cuenta || null;
  },

  /**
   * Obtener cuentas activas por moneda
   * Las cuentas bi-moneda aparecen para ambas monedas (USD y PEN)
   */
  async getCuentasActivas(moneda?: MonedaTesoreria): Promise<CuentaCaja[]> {
    const cuentas = await this.getCuentas();
    return cuentas.filter(c => {
      if (!c.activa) return false;
      if (!moneda) return true;

      // Cuentas bi-moneda aplican para ambas monedas
      if (c.esBiMoneda) return true;

      // Cuentas mono-moneda solo para su moneda
      return c.moneda === moneda;
    });
  },

  /**
   * Obtener todas las cuentas
   */
  async getCuentas(): Promise<CuentaCaja[]> {
    const snapshot = await getDocs(collection(db, CUENTAS_COLLECTION));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as CuentaCaja));
  },

  /**
   * Obtener cuenta por ID
   */
  async getCuentaById(id: string): Promise<CuentaCaja | null> {
    const docRef = doc(db, CUENTAS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    } as CuentaCaja;
  },

  /**
   * Actualizar saldo de cuenta
   * Para cuentas bi-moneda, requiere especificar la moneda del movimiento
   */
  async actualizarSaldoCuenta(
    cuentaId: string,
    diferencia: number,
    monedaMovimiento?: MonedaTesoreria
  ): Promise<void> {
    const cuenta = await this.getCuentaById(cuentaId);
    if (!cuenta) {
      throw new Error('Cuenta no encontrada');
    }

    const updates: Record<string, any> = {
      fechaActualizacion: serverTimestamp()
    };

    if (cuenta.esBiMoneda) {
      // Cuenta bi-moneda: actualizar el saldo de la moneda correspondiente
      if (!monedaMovimiento) {
        throw new Error('Para cuentas bi-moneda se debe especificar la moneda del movimiento');
      }

      if (monedaMovimiento === 'USD') {
        updates.saldoUSD = (cuenta.saldoUSD || 0) + diferencia;
      } else {
        updates.saldoPEN = (cuenta.saldoPEN || 0) + diferencia;
      }
    } else {
      // Cuenta mono-moneda: actualizar saldoActual
      updates.saldoActual = cuenta.saldoActual + diferencia;
    }

    await updateDoc(doc(db, CUENTAS_COLLECTION, cuentaId), updates);
  },

  /**
   * Recalcular saldo de una cuenta basándose en los movimientos existentes
   * Útil para corregir inconsistencias en los saldos
   */
  async recalcularSaldoCuenta(cuentaId: string): Promise<{ saldoAnterior: number; saldoNuevo: number; movimientos: number }> {
    const cuenta = await this.getCuentaById(cuentaId);
    if (!cuenta) {
      throw new Error('Cuenta no encontrada');
    }

    // Obtener todos los movimientos relacionados con esta cuenta
    const todosMovimientos = await this.getMovimientos({});
    const movimientosCuenta = todosMovimientos.filter(
      m => m.cuentaOrigen === cuentaId || m.cuentaDestino === cuentaId
    );

    // Calcular saldos basándose en los movimientos
    let saldoPEN = 0;
    let saldoUSD = 0;

    for (const mov of movimientosCuenta) {
      const esIngreso = esMovimientoIngreso(mov.tipo);
      const esEgreso = esMovimientoEgreso(mov.tipo);

      // Si es cuenta destino y es ingreso, suma
      // Si es cuenta origen y es egreso, resta
      const esCuentaDestino = mov.cuentaDestino === cuentaId;
      const esCuentaOrigen = mov.cuentaOrigen === cuentaId;

      let diferencia = 0;
      if (esCuentaDestino && (esIngreso || mov.tipo.includes('conversion'))) {
        diferencia = mov.monto;
      } else if (esCuentaOrigen && (esEgreso || mov.tipo.includes('conversion'))) {
        diferencia = -mov.monto;
      } else if (esCuentaDestino) {
        // Para movimientos que llegan a destino, siempre sumar
        diferencia = mov.monto;
      } else if (esCuentaOrigen) {
        // Para movimientos que salen de origen, siempre restar
        diferencia = -mov.monto;
      }

      if (mov.moneda === 'USD') {
        saldoUSD += diferencia;
      } else {
        saldoPEN += diferencia;
      }
    }

    // Guardar saldo anterior para el reporte
    const saldoAnterior = cuenta.esBiMoneda
      ? (cuenta.saldoPEN || 0)
      : cuenta.saldoActual;

    // Actualizar la cuenta con los saldos calculados
    const updates: Record<string, any> = {
      fechaActualizacion: serverTimestamp()
    };

    if (cuenta.esBiMoneda) {
      updates.saldoUSD = saldoUSD;
      updates.saldoPEN = saldoPEN;
    } else {
      updates.saldoActual = cuenta.moneda === 'USD' ? saldoUSD : saldoPEN;
    }

    await updateDoc(doc(db, CUENTAS_COLLECTION, cuentaId), updates);

    return {
      saldoAnterior,
      saldoNuevo: cuenta.esBiMoneda ? saldoPEN : (cuenta.moneda === 'USD' ? saldoUSD : saldoPEN),
      movimientos: movimientosCuenta.length
    };
  },

  /**
   * Recalcular saldos de todas las cuentas
   */
  async recalcularTodosLosSaldos(): Promise<{ cuentasActualizadas: number; errores: string[] }> {
    const cuentas = await this.getCuentas();
    const errores: string[] = [];
    let cuentasActualizadas = 0;

    for (const cuenta of cuentas) {
      try {
        await this.recalcularSaldoCuenta(cuenta.id);
        cuentasActualizadas++;
      } catch (error) {
        errores.push(`${cuenta.nombre}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }
    }

    return { cuentasActualizadas, errores };
  },

  // ===============================================
  // REGISTRO DE TC POR TRANSACCIÓN
  // ===============================================

  /**
   * Registrar TC de una transacción
   * Permite tracking del TC en cada momento del flujo
   */
  async registrarTCTransaccion(
    tipoDocumento: 'orden_compra' | 'venta' | 'gasto' | 'pago_viajero',
    documentoId: string,
    documentoNumero: string,
    momento: 'cotizacion' | 'creacion' | 'confirmacion' | 'pago' | 'cobro' | 'conversion',
    montoUSD: number,
    tipoCambio: number,
    userId: string
  ): Promise<string> {
    // Buscar registro anterior del mismo documento
    const q = query(
      collection(db, REGISTROS_TC_COLLECTION),
      where('documentoId', '==', documentoId),
      orderBy('fecha', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);

    let tcMomentoAnterior: number | undefined;
    let diferenciaVsMomentoAnterior: number | undefined;

    if (!snapshot.empty) {
      const registroAnterior = snapshot.docs[0].data();
      tcMomentoAnterior = registroAnterior.tipoCambio;
      if (tcMomentoAnterior !== undefined) {
        diferenciaVsMomentoAnterior = (tipoCambio - tcMomentoAnterior) * montoUSD;
      }
    }

    const registro: Omit<RegistroTCTransaccion, 'id'> = {
      tipoDocumento,
      documentoId,
      documentoNumero,
      momento,
      montoUSD,
      tipoCambio,
      montoPEN: montoUSD * tipoCambio,
      tcMomentoAnterior,
      diferenciaVsMomentoAnterior,
      fecha: Timestamp.now(),
      registradoPor: userId
    };

    const docRef = await addDoc(collection(db, REGISTROS_TC_COLLECTION), registro);
    return docRef.id;
  },

  /**
   * Obtener historial de TC de un documento
   */
  async getHistorialTCDocumento(documentoId: string): Promise<RegistroTCTransaccion[]> {
    const q = query(
      collection(db, REGISTROS_TC_COLLECTION),
      where('documentoId', '==', documentoId),
      orderBy('fecha', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as RegistroTCTransaccion));
  },

  // ===============================================
  // DIFERENCIA CAMBIARIA
  // ===============================================

  /**
   * Calcular diferencia cambiaria de un período
   */
  async calcularDiferenciaCambiaria(mes: number, anio: number): Promise<DiferenciaCambiariaPeriodo> {
    const inicioMes = new Date(anio, mes - 1, 1);
    const finMes = new Date(anio, mes, 0, 23, 59, 59);

    // Obtener registros TC del período
    const q = query(
      collection(db, REGISTROS_TC_COLLECTION),
      orderBy('fecha', 'asc')
    );
    const snapshot = await getDocs(q);

    const registros = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as RegistroTCTransaccion))
      .filter(r => {
        const fecha = r.fecha.toDate();
        return fecha >= inicioMes && fecha <= finMes;
      });

    // Agrupar por tipo de documento
    const porOC = registros.filter(r => r.tipoDocumento === 'orden_compra');
    const porVenta = registros.filter(r => r.tipoDocumento === 'venta');

    // Calcular diferencias por OC
    const diferenciaOC = porOC.reduce((sum, r) => sum + (r.diferenciaVsMomentoAnterior || 0), 0);
    const tcPromedioCompraOC = porOC.filter(r => r.momento === 'creacion').length > 0
      ? porOC.filter(r => r.momento === 'creacion').reduce((sum, r) => sum + r.tipoCambio, 0) / porOC.filter(r => r.momento === 'creacion').length
      : 0;
    const tcPromedioPagoOC = porOC.filter(r => r.momento === 'pago').length > 0
      ? porOC.filter(r => r.momento === 'pago').reduce((sum, r) => sum + r.tipoCambio, 0) / porOC.filter(r => r.momento === 'pago').length
      : 0;

    // Calcular diferencias por Venta
    const diferenciaVenta = porVenta.reduce((sum, r) => sum + (r.diferenciaVsMomentoAnterior || 0), 0);
    const tcPromedioVenta = porVenta.filter(r => r.momento === 'creacion').length > 0
      ? porVenta.filter(r => r.momento === 'creacion').reduce((sum, r) => sum + r.tipoCambio, 0) / porVenta.filter(r => r.momento === 'creacion').length
      : 0;
    const tcPromedioCobro = porVenta.filter(r => r.momento === 'cobro').length > 0
      ? porVenta.filter(r => r.momento === 'cobro').reduce((sum, r) => sum + r.tipoCambio, 0) / porVenta.filter(r => r.momento === 'cobro').length
      : 0;

    // Obtener conversiones del período
    const conversiones = await this.getConversiones({
      fechaInicio: inicioMes,
      fechaFin: finMes
    });

    const diferenciaConversiones = conversiones.reduce((sum, c) => sum + c.diferenciaVsReferencia, 0);
    const spreadPromedio = conversiones.length > 0
      ? conversiones.reduce((sum, c) => sum + c.spreadCambiario, 0) / conversiones.length
      : 0;

    const diferenciaNetoMes = diferenciaOC + diferenciaVenta + diferenciaConversiones;

    return {
      mes,
      anio,
      ordenesCompra: {
        cantidad: [...new Set(porOC.map(r => r.documentoId))].length,
        diferenciaTotal: diferenciaOC,
        tcPromedioCompra: tcPromedioCompraOC,
        tcPromedioPago: tcPromedioPagoOC
      },
      ventas: {
        cantidad: [...new Set(porVenta.map(r => r.documentoId))].length,
        diferenciaTotal: diferenciaVenta,
        tcPromedioVenta,
        tcPromedioCobro
      },
      conversiones: {
        cantidad: conversiones.length,
        diferenciaTotal: diferenciaConversiones,
        spreadPromedio
      },
      diferenciaNetoMes,
      impactoEnUtilidad: 0 // Se calcula cuando se tiene la utilidad del mes
    };
  },

  // ===============================================
  // ESTADÍSTICAS
  // ===============================================

  /**
   * Obtener estadísticas generales de tesorería
   */
  async getStats(): Promise<TesoreriaStats> {
    const cuentas = await this.getCuentas();
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    // Calcular saldos totales considerando cuentas bi-moneda
    let saldoTotalUSD = 0;
    let saldoTotalPEN = 0;

    cuentas.filter(c => c.activa).forEach(c => {
      if (c.esBiMoneda) {
        // Cuenta bi-moneda: sumar ambos saldos
        saldoTotalUSD += c.saldoUSD || 0;
        saldoTotalPEN += c.saldoPEN || 0;
      } else {
        // Cuenta mono-moneda
        if (c.moneda === 'USD') {
          saldoTotalUSD += c.saldoActual;
        } else {
          saldoTotalPEN += c.saldoActual;
        }
      }
    });

    // Obtener TC actual para calcular equivalente
    let tcActual = 3.70;
    try {
      const tc = await tipoCambioService.getTCDelDia();
      if (tc) tcActual = tc.venta;
    } catch (e) {
      console.warn('No se pudo obtener TC actual');
    }

    const saldoTotalEquivalentePEN = saldoTotalPEN + (saldoTotalUSD * tcActual);

    // Obtener movimientos del mes
    const movimientosMes = await this.getMovimientos({
      fechaInicio: inicioMes,
      fechaFin: ahora
    });

    // Clasificar movimientos usando helpers centralizados
    const ingresosMes = movimientosMes.filter(m => esMovimientoIngreso(m.tipo));
    const egresosMes = movimientosMes.filter(m => esMovimientoEgreso(m.tipo));

    const ingresosMesUSD = ingresosMes.filter(m => m.moneda === 'USD').reduce((sum, m) => sum + m.monto, 0);
    const ingresosMesPEN = ingresosMes.filter(m => m.moneda === 'PEN').reduce((sum, m) => sum + m.monto, 0);
    const egresosMesUSD = egresosMes.filter(m => m.moneda === 'USD').reduce((sum, m) => sum + m.monto, 0);
    const egresosMesPEN = egresosMes.filter(m => m.moneda === 'PEN').reduce((sum, m) => sum + m.monto, 0);

    // Obtener conversiones del mes
    const conversionesMes = await this.getConversiones({
      fechaInicio: inicioMes,
      fechaFin: ahora
    });

    const montoConvertidoMes = conversionesMes.reduce((sum, c) => sum + c.montoOrigen, 0);
    const spreadPromedioMes = conversionesMes.length > 0
      ? conversionesMes.reduce((sum, c) => sum + c.spreadCambiario, 0) / conversionesMes.length
      : 0;

    // Calcular diferencia cambiaria del mes
    const diferenciaMes = await this.calcularDiferenciaCambiaria(ahora.getMonth() + 1, ahora.getFullYear());

    // Calcular diferencia acumulada del año
    let diferenciaAcumuladaAnio = 0;
    for (let mes = 1; mes <= ahora.getMonth() + 1; mes++) {
      const diff = await this.calcularDiferenciaCambiaria(mes, ahora.getFullYear());
      diferenciaAcumuladaAnio += diff.diferenciaNetoMes;
    }

    // Movimientos pendientes
    const pendientes = movimientosMes.filter(m => m.estado === 'pendiente');
    const pagosPendientesUSD = pendientes.filter(m => m.moneda === 'USD' && esMovimientoEgreso(m.tipo))
      .reduce((sum, m) => sum + m.monto, 0);
    const pagosPendientesPEN = pendientes.filter(m => m.moneda === 'PEN' && esMovimientoEgreso(m.tipo))
      .reduce((sum, m) => sum + m.monto, 0);

    return {
      saldoTotalUSD,
      saldoTotalPEN,
      saldoTotalEquivalentePEN,
      ingresosMesUSD,
      ingresosMesPEN,
      egresosMesUSD,
      egresosMesPEN,
      conversionesMes: conversionesMes.length,
      montoConvertidoMes,
      spreadPromedioMes,
      diferenciaNetaMes: diferenciaMes.diferenciaNetoMes,
      diferenciaAcumuladaAnio,
      pagosPendientesUSD,
      pagosPendientesPEN,
      porCobrarPEN: 0 // Se calcula desde ventas pendientes
    };
  },

  // ===============================================
  // FLUJO DE CAJA
  // ===============================================

  /**
   * Obtener flujo de caja mensual
   */
  async getFlujoCajaMensual(mes: number, anio: number): Promise<FlujoCajaMensual> {
    const inicioMes = new Date(anio, mes - 1, 1);
    const finMes = new Date(anio, mes, 0, 23, 59, 59);

    // Obtener movimientos del mes
    const movimientos = await this.getMovimientos({
      fechaInicio: inicioMes,
      fechaFin: finMes
    });

    // Obtener conversiones del mes
    const conversiones = await this.getConversiones({
      fechaInicio: inicioMes,
      fechaFin: finMes
    });

    // Clasificar movimientos usando helpers centralizados
    const ingresos = movimientos.filter(m => esMovimientoIngreso(m.tipo));
    const egresos = movimientos.filter(m => esMovimientoEgreso(m.tipo));

    const ingresosUSD = ingresos.filter(m => m.moneda === 'USD').reduce((sum, m) => sum + m.monto, 0);
    const ingresosPEN = ingresos.filter(m => m.moneda === 'PEN').reduce((sum, m) => sum + m.monto, 0);
    const egresosUSD = egresos.filter(m => m.moneda === 'USD').reduce((sum, m) => sum + m.monto, 0);
    const egresosPEN = egresos.filter(m => m.moneda === 'PEN').reduce((sum, m) => sum + m.monto, 0);

    // Conversiones
    const convUSDaPEN = conversiones.filter(c => c.monedaOrigen === 'USD').reduce((sum, c) => sum + c.montoOrigen, 0);
    const convPENaUSD = conversiones.filter(c => c.monedaOrigen === 'PEN').reduce((sum, c) => sum + c.montoDestino, 0);

    // Diferencia cambiaria
    const diferencia = await this.calcularDiferenciaCambiaria(mes, anio);

    // TC promedio del mes
    const tcPromedio = movimientos.length > 0
      ? movimientos.reduce((sum, m) => sum + m.tipoCambio, 0) / movimientos.length
      : 3.70;

    // Calcular saldo inicial del mes (saldo final del mes anterior)
    // Obtenemos movimientos hasta el inicio del mes actual
    const movimientosAnteriores = await this.getMovimientos({
      fechaFin: new Date(inicioMes.getTime() - 1) // Hasta un ms antes del inicio del mes
    });

    // Obtener saldos iniciales de las cuentas
    const cuentas = await this.getCuentas();
    let saldoBaseUSD = 0;
    let saldoBasePEN = 0;

    cuentas.filter(c => c.activa).forEach(c => {
      if (c.esBiMoneda) {
        saldoBaseUSD += c.saldoInicialUSD || 0;
        saldoBasePEN += c.saldoInicialPEN || 0;
      } else {
        if (c.moneda === 'USD') {
          saldoBaseUSD += c.saldoInicial || 0;
        } else {
          saldoBasePEN += c.saldoInicial || 0;
        }
      }
    });

    // Calcular saldo al inicio del mes (saldo base + movimientos anteriores)
    let saldoInicialUSD = saldoBaseUSD;
    let saldoInicialPEN = saldoBasePEN;

    for (const mov of movimientosAnteriores) {
      // Usar el helper para determinar si es ingreso basándose en el tipo
      const esIngreso = esMovimientoIngreso(mov.tipo);
      if (mov.moneda === 'USD') {
        saldoInicialUSD += esIngreso ? mov.monto : -mov.monto;
      } else {
        saldoInicialPEN += esIngreso ? mov.monto : -mov.monto;
      }
    }

    // Calcular saldo final del mes
    const saldoFinalUSD = saldoInicialUSD + ingresosUSD - egresosUSD - convUSDaPEN + convPENaUSD;
    const saldoFinalPEN = saldoInicialPEN + ingresosPEN - egresosPEN + (convUSDaPEN * tcPromedio) - (convPENaUSD / tcPromedio);

    return {
      mes,
      anio,
      saldoInicialUSD,
      saldoInicialPEN,
      ingresosUSD,
      ingresosPEN,
      egresosUSD,
      egresosPEN,
      totalConvertidoUSDaPEN: convUSDaPEN,
      totalConvertidoPENaUSD: convPENaUSD,
      diferenciaNetaMes: diferencia.diferenciaNetoMes,
      saldoFinalUSD,
      saldoFinalPEN,
      tcPromedioMes: tcPromedio
    };
  }
};

// Alias para compatibilidad con imports existentes
export const TesoreriaService = tesoreriaService;
