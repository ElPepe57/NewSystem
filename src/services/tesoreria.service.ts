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
  MetodoTesoreria,
  EstadisticasTesoreriaAgregadas,
  EstadisticasMensuales
} from '../types/tesoreria.types';

const MOVIMIENTOS_COLLECTION = 'movimientosTesoreria';
const CONVERSIONES_COLLECTION = 'conversionesCambiarias';
const CUENTAS_COLLECTION = 'cuentasCaja';
const REGISTROS_TC_COLLECTION = 'registrosTCTransaccion';
const ESTADISTICAS_DOC = 'estadisticas/tesoreria';

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

// Tipos de conversión (son tanto ingreso como egreso dependiendo del contexto)
const TIPOS_CONVERSION: TipoMovimientoTesoreria[] = [
  'conversion_usd_pen',
  'conversion_pen_usd'
];

/**
 * Helper para determinar si un tipo de movimiento es ingreso
 * Para conversiones, depende de si tiene cuentaDestino (entrada de dinero)
 */
const esMovimientoIngreso = (tipo: TipoMovimientoTesoreria, movimiento?: { cuentaOrigen?: string; cuentaDestino?: string }): boolean => {
  if (TIPOS_CONVERSION.includes(tipo) && movimiento) {
    // Para conversiones, es ingreso si tiene cuentaDestino (dinero que entra)
    return !!movimiento.cuentaDestino;
  }
  return TIPOS_INGRESO.includes(tipo);
};

/**
 * Helper para determinar si un tipo de movimiento es egreso
 * Para conversiones, depende de si tiene cuentaOrigen (salida de dinero)
 */
const esMovimientoEgreso = (tipo: TipoMovimientoTesoreria, movimiento?: { cuentaOrigen?: string; cuentaDestino?: string }): boolean => {
  if (TIPOS_CONVERSION.includes(tipo) && movimiento) {
    // Para conversiones, es egreso si tiene cuentaOrigen (dinero que sale)
    return !!movimiento.cuentaOrigen;
  }
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
    if (data.gastoNumero) movimiento.gastoNumero = data.gastoNumero;
    if (data.cotizacionId) movimiento.cotizacionId = data.cotizacionId;
    if (data.cotizacionNumero) movimiento.cotizacionNumero = data.cotizacionNumero;
    if (data.transferenciaId) movimiento.transferenciaId = data.transferenciaId;
    if (data.transferenciaNumero) movimiento.transferenciaNumero = data.transferenciaNumero;
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

    // Actualizar estadísticas agregadas
    await this.actualizarEstadisticasPorMovimiento({
      tipo: data.tipo,
      moneda: data.moneda,
      monto: data.monto,
      tipoCambio: data.tipoCambio,
      cuentaOrigen: data.cuentaOrigen,
      cuentaDestino: data.cuentaDestino
    }).catch(err => console.warn('Error actualizando estadísticas:', err));

    return docRef.id;
  },

  /**
   * Actualizar un movimiento de tesorería existente
   * Solo para administradores
   */
  async actualizarMovimiento(
    id: string,
    data: Partial<MovimientoTesoreriaFormData>,
    userId: string
  ): Promise<void> {
    // Obtener movimiento actual para calcular diferencias de saldo
    const movimientoActual = await this.getMovimientoById(id);
    if (!movimientoActual) {
      throw new Error('Movimiento no encontrado');
    }

    const updates: Record<string, any> = {
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now()
    };

    // Campos que se pueden actualizar
    if (data.tipo !== undefined) updates.tipo = data.tipo;
    if (data.concepto !== undefined) updates.concepto = data.concepto;
    if (data.referencia !== undefined) updates.referencia = data.referencia;
    if (data.notas !== undefined) updates.notas = data.notas;
    if (data.fecha !== undefined) updates.fecha = Timestamp.fromDate(data.fecha);

    // Si cambia el monto o el tipo de cambio, recalcular equivalentes
    if (data.monto !== undefined || data.tipoCambio !== undefined || data.moneda !== undefined) {
      const nuevoMonto = data.monto ?? movimientoActual.monto;
      const nuevoTC = data.tipoCambio ?? movimientoActual.tipoCambio;
      const nuevaMoneda = data.moneda ?? movimientoActual.moneda;

      updates.monto = nuevoMonto;
      updates.tipoCambio = nuevoTC;
      updates.moneda = nuevaMoneda;

      if (nuevaMoneda === 'USD') {
        updates.montoEquivalentePEN = nuevoMonto * nuevoTC;
        updates.montoEquivalenteUSD = nuevoMonto;
      } else {
        updates.montoEquivalentePEN = nuevoMonto;
        updates.montoEquivalenteUSD = nuevoMonto / nuevoTC;
      }

      // Calcular diferencia de saldo si hay cuenta asociada
      const diferenciaMonto = nuevoMonto - movimientoActual.monto;

      if (diferenciaMonto !== 0) {
        // Ajustar saldo de cuenta si aplica
        if (movimientoActual.cuentaOrigen) {
          const esEgreso = esMovimientoEgreso(movimientoActual.tipo, movimientoActual);
          // Si es egreso, una diferencia positiva significa más egreso (más negativo para la cuenta)
          await this.actualizarSaldoCuenta(
            movimientoActual.cuentaOrigen,
            esEgreso ? -diferenciaMonto : diferenciaMonto,
            nuevaMoneda
          );
        }
        if (movimientoActual.cuentaDestino) {
          const esIngreso = esMovimientoIngreso(movimientoActual.tipo, movimientoActual);
          // Si es ingreso, una diferencia positiva significa más ingreso (más positivo para la cuenta)
          await this.actualizarSaldoCuenta(
            movimientoActual.cuentaDestino,
            esIngreso ? diferenciaMonto : -diferenciaMonto,
            nuevaMoneda
          );
        }
      }
    }

    if (data.metodo !== undefined) updates.metodo = data.metodo;

    await updateDoc(doc(db, MOVIMIENTOS_COLLECTION, id), updates);
  },

  /**
   * Obtener movimiento por ID
   */
  async getMovimientoById(id: string): Promise<MovimientoTesoreria | null> {
    const docRef = doc(db, MOVIMIENTOS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    } as MovimientoTesoreria;
  },

  /**
   * Eliminar un movimiento de tesorería
   * Solo para administradores - Revierte el efecto en saldos
   */
  async eliminarMovimiento(id: string, userId: string): Promise<void> {
    const movimiento = await this.getMovimientoById(id);
    if (!movimiento) {
      throw new Error('Movimiento no encontrado');
    }

    // Revertir efecto en saldos
    if (movimiento.cuentaOrigen) {
      const esEgreso = esMovimientoEgreso(movimiento.tipo, movimiento);
      // Si era egreso, al eliminarlo devolvemos el dinero (suma)
      await this.actualizarSaldoCuenta(
        movimiento.cuentaOrigen,
        esEgreso ? movimiento.monto : -movimiento.monto,
        movimiento.moneda
      );
    }
    if (movimiento.cuentaDestino) {
      const esIngreso = esMovimientoIngreso(movimiento.tipo, movimiento);
      // Si era ingreso, al eliminarlo quitamos el dinero (resta)
      await this.actualizarSaldoCuenta(
        movimiento.cuentaDestino,
        esIngreso ? -movimiento.monto : movimiento.monto,
        movimiento.moneda
      );
    }

    // En lugar de eliminar, marcamos como anulado para mantener historial
    await updateDoc(doc(db, MOVIMIENTOS_COLLECTION, id), {
      estado: 'anulado',
      anuladoPor: userId,
      fechaAnulacion: Timestamp.now()
    });

    // Actualizar estadísticas agregadas (revertir el movimiento)
    await this.actualizarEstadisticasPorMovimiento({
      tipo: movimiento.tipo,
      moneda: movimiento.moneda,
      monto: movimiento.monto,
      tipoCambio: movimiento.tipoCambio,
      cuentaOrigen: movimiento.cuentaOrigen,
      cuentaDestino: movimiento.cuentaDestino
    }, true).catch(err => console.warn('Error actualizando estadísticas:', err));
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
   * Ahora vinculada a cuentas de tesorería y registra movimientos
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

    // Construir objeto de conversión (sin campos undefined para Firestore)
    const conversion: Record<string, any> = {
      numeroConversion,
      monedaOrigen: data.monedaOrigen,
      monedaDestino,
      montoOrigen: data.montoOrigen,
      montoDestino,
      tipoCambio: data.tipoCambio,
      tipoCambioReferencia,
      spreadCambiario,
      diferenciaVsReferencia,
      fecha: Timestamp.fromDate(data.fecha),
      creadoPor: userId,
      fechaCreacion: Timestamp.now()
    };

    // Agregar campos opcionales solo si tienen valor
    if (data.entidadCambio) conversion.entidadCambio = data.entidadCambio;
    if (data.motivo) conversion.motivo = data.motivo;
    if (data.notas) conversion.notas = data.notas;
    if (data.cuentaOrigenId) conversion.cuentaOrigenId = data.cuentaOrigenId;
    if (data.cuentaDestinoId) conversion.cuentaDestinoId = data.cuentaDestinoId;

    const docRef = await addDoc(collection(db, CONVERSIONES_COLLECTION), conversion);
    const conversionId = docRef.id;

    // Si se especificaron cuentas, actualizar saldos y registrar movimientos
    if (data.cuentaOrigenId || data.cuentaDestinoId) {
      const tipoMovimiento: TipoMovimientoTesoreria = data.monedaOrigen === 'USD'
        ? 'conversion_usd_pen'
        : 'conversion_pen_usd';

      const conceptoConversion = `Conversión ${numeroConversion}: ${data.monedaOrigen} ${data.montoOrigen.toFixed(2)} → ${monedaDestino} ${montoDestino.toFixed(2)} (TC: ${data.tipoCambio.toFixed(3)})`;

      // Registrar movimiento de salida (moneda origen)
      if (data.cuentaOrigenId) {
        const movSalida: Record<string, any> = {
          numeroMovimiento: await this.generateNumeroMovimiento(),
          tipo: tipoMovimiento,
          estado: 'ejecutado',
          moneda: data.monedaOrigen,
          monto: data.montoOrigen,
          tipoCambio: data.tipoCambio,
          montoEquivalentePEN: data.monedaOrigen === 'PEN' ? data.montoOrigen : data.montoOrigen * data.tipoCambio,
          montoEquivalenteUSD: data.monedaOrigen === 'USD' ? data.montoOrigen : data.montoOrigen / data.tipoCambio,
          metodo: 'otro',
          concepto: conceptoConversion,
          cuentaOrigen: data.cuentaOrigenId,
          fecha: Timestamp.fromDate(data.fecha),
          creadoPor: userId,
          fechaCreacion: Timestamp.now(),
          conversionId // Vincular al registro de conversión
        };

        await addDoc(collection(db, MOVIMIENTOS_COLLECTION), movSalida);

        // Actualizar saldo de cuenta origen (resta)
        await this.actualizarSaldoCuenta(data.cuentaOrigenId, -data.montoOrigen, data.monedaOrigen);
      }

      // Registrar movimiento de entrada (moneda destino)
      if (data.cuentaDestinoId) {
        const movEntrada: Record<string, any> = {
          numeroMovimiento: await this.generateNumeroMovimiento(),
          tipo: tipoMovimiento,
          estado: 'ejecutado',
          moneda: monedaDestino,
          monto: montoDestino,
          tipoCambio: data.tipoCambio,
          montoEquivalentePEN: monedaDestino === 'PEN' ? montoDestino : montoDestino * data.tipoCambio,
          montoEquivalenteUSD: monedaDestino === 'USD' ? montoDestino : montoDestino / data.tipoCambio,
          metodo: 'otro',
          concepto: conceptoConversion,
          cuentaDestino: data.cuentaDestinoId,
          fecha: Timestamp.fromDate(data.fecha),
          creadoPor: userId,
          fechaCreacion: Timestamp.now(),
          conversionId // Vincular al registro de conversión
        };

        await addDoc(collection(db, MOVIMIENTOS_COLLECTION), movEntrada);

        // Actualizar saldo de cuenta destino (suma)
        await this.actualizarSaldoCuenta(data.cuentaDestinoId, montoDestino, monedaDestino);
      }
    }

    // Actualizar estadísticas agregadas con la conversión
    await this.actualizarEstadisticasPorConversion({
      monedaOrigen: data.monedaOrigen,
      montoOrigen: data.montoOrigen,
      montoDestino,
      tipoCambio: data.tipoCambio,
      spreadCambiario,
      diferenciaVsReferencia
    }).catch(err => console.warn('Error actualizando estadísticas por conversión:', err));

    return conversionId;
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
      const esIngreso = esMovimientoIngreso(mov.tipo, mov);
      const esEgreso = esMovimientoEgreso(mov.tipo, mov);

      // Si es cuenta destino y es ingreso, suma
      // Si es cuenta origen y es egreso, resta
      const esCuentaDestino = mov.cuentaDestino === cuentaId;
      const esCuentaOrigen = mov.cuentaOrigen === cuentaId;

      let diferencia = 0;
      if (esCuentaDestino && esIngreso) {
        // Dinero que entra a esta cuenta
        diferencia = mov.monto;
      } else if (esCuentaOrigen && esEgreso) {
        // Dinero que sale de esta cuenta
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
  // ESTADÍSTICAS AGREGADAS (MATERIALIZED)
  // ===============================================

  /**
   * Helper para obtener la clave del mes actual
   */
  _getMesKey(fecha: Date = new Date()): string {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
  },

  /**
   * Helper para crear estadísticas mensuales vacías
   */
  _crearEstadisticasMensualesVacias(mes: number, anio: number): EstadisticasMensuales {
    return {
      mes,
      anio,
      ingresosUSD: 0,
      ingresosPEN: 0,
      cantidadIngresos: 0,
      egresosUSD: 0,
      egresosPEN: 0,
      cantidadEgresos: 0,
      conversionesUSDaPEN: 0,
      conversionesPENaUSD: 0,
      cantidadConversiones: 0,
      spreadAcumulado: 0,
      diferenciaOrdenesCompra: 0,
      diferenciaVentas: 0,
      diferenciaConversiones: 0,
      diferenciaNetaMes: 0,
      sumaTipoCambio: 0,
      cantidadOperacionesTC: 0
    };
  },

  /**
   * Obtener estadísticas agregadas (lectura instantánea)
   */
  async getEstadisticasAgregadas(): Promise<EstadisticasTesoreriaAgregadas | null> {
    try {
      const docRef = doc(db, ESTADISTICAS_DOC);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return docSnap.data() as EstadisticasTesoreriaAgregadas;
    } catch (error) {
      logger.error('Error obteniendo estadísticas agregadas:', error);
      return null;
    }
  },

  /**
   * Inicializar documento de estadísticas (primera vez o reset)
   */
  async inicializarEstadisticas(userId: string): Promise<void> {
    const ahora = new Date();
    const mesActual = this._crearEstadisticasMensualesVacias(ahora.getMonth() + 1, ahora.getFullYear());

    // Calcular saldos actuales de las cuentas
    const cuentas = await this.getCuentas();
    let saldoTotalUSD = 0;
    let saldoTotalPEN = 0;

    cuentas.filter(c => c.activa).forEach(c => {
      if (c.esBiMoneda) {
        saldoTotalUSD += c.saldoUSD || 0;
        saldoTotalPEN += c.saldoPEN || 0;
      } else {
        if (c.moneda === 'USD') {
          saldoTotalUSD += c.saldoActual;
        } else {
          saldoTotalPEN += c.saldoActual;
        }
      }
    });

    // Obtener TC actual
    let tcActual = 3.70;
    try {
      const tc = await tipoCambioService.getTCDelDia();
      if (tc) tcActual = tc.venta;
    } catch (e) {
      console.warn('No se pudo obtener TC actual');
    }

    const estadisticas: EstadisticasTesoreriaAgregadas = {
      saldoTotalUSD,
      saldoTotalPEN,
      saldoTotalEquivalentePEN: saldoTotalPEN + (saldoTotalUSD * tcActual),
      tipoCambioActual: tcActual,
      mesActual,
      historicoPorMes: {
        [this._getMesKey()]: mesActual
      },
      acumuladoAnio: {
        anio: ahora.getFullYear(),
        ingresosUSD: 0,
        ingresosPEN: 0,
        egresosUSD: 0,
        egresosPEN: 0,
        diferenciaNetaAnio: 0,
        cantidadOperaciones: 0
      },
      ultimoNumeroMovimiento: 0,
      ultimoNumeroConversion: 0,
      ultimaActualizacion: Timestamp.now(),
      actualizadoPor: userId,
      version: 1
    };

    const docRef = doc(db, ESTADISTICAS_DOC);
    await updateDoc(docRef, estadisticas as any).catch(async () => {
      // Si el documento no existe, crearlo con setDoc
      const { setDoc } = await import('firebase/firestore');
      await setDoc(docRef, estadisticas);
    });

    logger.success('Estadísticas de tesorería inicializadas');
  },

  /**
   * Actualizar estadísticas después de un movimiento
   */
  async actualizarEstadisticasPorMovimiento(
    movimiento: {
      tipo: TipoMovimientoTesoreria;
      moneda: MonedaTesoreria;
      monto: number;
      tipoCambio: number;
      cuentaOrigen?: string;
      cuentaDestino?: string;
    },
    esAnulacion: boolean = false
  ): Promise<void> {
    const docRef = doc(db, ESTADISTICAS_DOC);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      // Si no existe, no hacer nada (se inicializará después)
      return;
    }

    const stats = docSnap.data() as EstadisticasTesoreriaAgregadas;
    const ahora = new Date();
    const mesKey = this._getMesKey();
    const multiplicador = esAnulacion ? -1 : 1;

    // Asegurar que existe el mes actual
    if (!stats.historicoPorMes[mesKey]) {
      stats.historicoPorMes[mesKey] = this._crearEstadisticasMensualesVacias(ahora.getMonth() + 1, ahora.getFullYear());
    }

    const mesActual = stats.historicoPorMes[mesKey];
    const esIngreso = esMovimientoIngreso(movimiento.tipo, movimiento);
    const esEgreso = esMovimientoEgreso(movimiento.tipo, movimiento);

    // Actualizar estadísticas del mes
    if (esIngreso) {
      if (movimiento.moneda === 'USD') {
        mesActual.ingresosUSD += movimiento.monto * multiplicador;
      } else {
        mesActual.ingresosPEN += movimiento.monto * multiplicador;
      }
      mesActual.cantidadIngresos += 1 * multiplicador;
    }

    if (esEgreso) {
      if (movimiento.moneda === 'USD') {
        mesActual.egresosUSD += movimiento.monto * multiplicador;
      } else {
        mesActual.egresosPEN += movimiento.monto * multiplicador;
      }
      mesActual.cantidadEgresos += 1 * multiplicador;
    }

    // Actualizar TC promedio
    if (movimiento.tipoCambio > 0) {
      mesActual.sumaTipoCambio += movimiento.tipoCambio * multiplicador;
      mesActual.cantidadOperacionesTC += 1 * multiplicador;
    }

    // Actualizar acumulado del año
    if (esIngreso) {
      if (movimiento.moneda === 'USD') {
        stats.acumuladoAnio.ingresosUSD += movimiento.monto * multiplicador;
      } else {
        stats.acumuladoAnio.ingresosPEN += movimiento.monto * multiplicador;
      }
    }
    if (esEgreso) {
      if (movimiento.moneda === 'USD') {
        stats.acumuladoAnio.egresosUSD += movimiento.monto * multiplicador;
      } else {
        stats.acumuladoAnio.egresosPEN += movimiento.monto * multiplicador;
      }
    }
    stats.acumuladoAnio.cantidadOperaciones += 1 * multiplicador;

    // Recalcular saldos de cuentas
    const cuentas = await this.getCuentas();
    let saldoTotalUSD = 0;
    let saldoTotalPEN = 0;

    cuentas.filter(c => c.activa).forEach(c => {
      if (c.esBiMoneda) {
        saldoTotalUSD += c.saldoUSD || 0;
        saldoTotalPEN += c.saldoPEN || 0;
      } else {
        if (c.moneda === 'USD') {
          saldoTotalUSD += c.saldoActual;
        } else {
          saldoTotalPEN += c.saldoActual;
        }
      }
    });

    stats.saldoTotalUSD = saldoTotalUSD;
    stats.saldoTotalPEN = saldoTotalPEN;
    stats.saldoTotalEquivalentePEN = saldoTotalPEN + (saldoTotalUSD * stats.tipoCambioActual);

    // Actualizar mes actual
    stats.mesActual = mesActual;
    stats.historicoPorMes[mesKey] = mesActual;
    stats.ultimaActualizacion = Timestamp.now();

    await updateDoc(docRef, stats as any);
  },

  /**
   * Actualizar estadísticas después de una conversión
   */
  async actualizarEstadisticasPorConversion(
    conversion: {
      monedaOrigen: MonedaTesoreria;
      montoOrigen: number;
      montoDestino: number;
      tipoCambio: number;
      spreadCambiario: number;
      diferenciaVsReferencia: number;
    }
  ): Promise<void> {
    const docRef = doc(db, ESTADISTICAS_DOC);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return;
    }

    const stats = docSnap.data() as EstadisticasTesoreriaAgregadas;
    const mesKey = this._getMesKey();

    // Asegurar que existe el mes actual
    if (!stats.historicoPorMes[mesKey]) {
      const ahora = new Date();
      stats.historicoPorMes[mesKey] = this._crearEstadisticasMensualesVacias(ahora.getMonth() + 1, ahora.getFullYear());
    }

    const mesActual = stats.historicoPorMes[mesKey];

    // Actualizar conversiones
    if (conversion.monedaOrigen === 'USD') {
      mesActual.conversionesUSDaPEN += conversion.montoOrigen;
    } else {
      mesActual.conversionesPENaUSD += conversion.montoDestino;
    }

    mesActual.cantidadConversiones += 1;
    mesActual.spreadAcumulado += conversion.spreadCambiario;
    mesActual.diferenciaConversiones += conversion.diferenciaVsReferencia;
    mesActual.diferenciaNetaMes = mesActual.diferenciaOrdenesCompra + mesActual.diferenciaVentas + mesActual.diferenciaConversiones;

    // Actualizar acumulado del año
    stats.acumuladoAnio.diferenciaNetaAnio += conversion.diferenciaVsReferencia;

    // Actualizar mes actual
    stats.mesActual = mesActual;
    stats.historicoPorMes[mesKey] = mesActual;
    stats.ultimaActualizacion = Timestamp.now();

    await updateDoc(docRef, stats as any);
  },

  /**
   * Recalcular estadísticas completas (para admin/corrección)
   * NOTA: Esta función es pesada, solo usar cuando sea necesario
   */
  async recalcularEstadisticasCompletas(userId: string): Promise<{ mensaje: string; tiempoMs: number }> {
    const inicio = Date.now();
    const ahora = new Date();

    // Inicializar estructura
    await this.inicializarEstadisticas(userId);

    // Obtener todos los movimientos del año
    const inicioAnio = new Date(ahora.getFullYear(), 0, 1);
    const movimientos = await this.getMovimientos({
      fechaInicio: inicioAnio,
      fechaFin: ahora
    });

    // Obtener todas las conversiones del año
    const conversiones = await this.getConversiones({
      fechaInicio: inicioAnio,
      fechaFin: ahora
    });

    // Agrupar por mes y procesar
    const docRef = doc(db, ESTADISTICAS_DOC);
    const docSnap = await getDoc(docRef);
    const stats = docSnap.data() as EstadisticasTesoreriaAgregadas;

    // Procesar movimientos
    for (const mov of movimientos) {
      if (mov.estado === 'anulado') continue;

      const fechaMov = mov.fecha.toDate();
      const mesKey = this._getMesKey(fechaMov);

      if (!stats.historicoPorMes[mesKey]) {
        stats.historicoPorMes[mesKey] = this._crearEstadisticasMensualesVacias(fechaMov.getMonth() + 1, fechaMov.getFullYear());
      }

      const mes = stats.historicoPorMes[mesKey];
      const esIngreso = esMovimientoIngreso(mov.tipo, mov);
      const esEgreso = esMovimientoEgreso(mov.tipo, mov);

      if (esIngreso) {
        if (mov.moneda === 'USD') {
          mes.ingresosUSD += mov.monto;
          stats.acumuladoAnio.ingresosUSD += mov.monto;
        } else {
          mes.ingresosPEN += mov.monto;
          stats.acumuladoAnio.ingresosPEN += mov.monto;
        }
        mes.cantidadIngresos++;
      }

      if (esEgreso) {
        if (mov.moneda === 'USD') {
          mes.egresosUSD += mov.monto;
          stats.acumuladoAnio.egresosUSD += mov.monto;
        } else {
          mes.egresosPEN += mov.monto;
          stats.acumuladoAnio.egresosPEN += mov.monto;
        }
        mes.cantidadEgresos++;
      }

      if (mov.tipoCambio > 0) {
        mes.sumaTipoCambio += mov.tipoCambio;
        mes.cantidadOperacionesTC++;
      }

      stats.acumuladoAnio.cantidadOperaciones++;
    }

    // Procesar conversiones
    for (const conv of conversiones) {
      const fechaConv = conv.fecha.toDate();
      const mesKey = this._getMesKey(fechaConv);

      if (!stats.historicoPorMes[mesKey]) {
        stats.historicoPorMes[mesKey] = this._crearEstadisticasMensualesVacias(fechaConv.getMonth() + 1, fechaConv.getFullYear());
      }

      const mes = stats.historicoPorMes[mesKey];

      if (conv.monedaOrigen === 'USD') {
        mes.conversionesUSDaPEN += conv.montoOrigen;
      } else {
        mes.conversionesPENaUSD += conv.montoDestino;
      }

      mes.cantidadConversiones++;
      mes.spreadAcumulado += conv.spreadCambiario;
      mes.diferenciaConversiones += conv.diferenciaVsReferencia;
      mes.diferenciaNetaMes = mes.diferenciaOrdenesCompra + mes.diferenciaVentas + mes.diferenciaConversiones;

      stats.acumuladoAnio.diferenciaNetaAnio += conv.diferenciaVsReferencia;
    }

    // Actualizar mes actual
    const mesKeyActual = this._getMesKey();
    if (stats.historicoPorMes[mesKeyActual]) {
      stats.mesActual = stats.historicoPorMes[mesKeyActual];
    }

    stats.ultimaActualizacion = Timestamp.now();
    stats.actualizadoPor = userId;

    await updateDoc(docRef, stats as any);

    const tiempoMs = Date.now() - inicio;
    logger.success(`Estadísticas recalculadas en ${tiempoMs}ms`);

    return {
      mensaje: `Recálculo completo: ${movimientos.length} movimientos, ${conversiones.length} conversiones procesados`,
      tiempoMs
    };
  },

  // ===============================================
  // ESTADÍSTICAS (LECTURA RÁPIDA)
  // ===============================================

  /**
   * Obtener estadísticas generales de tesorería (OPTIMIZADO)
   * Lee directamente del documento materializado
   */
  async getStats(): Promise<TesoreriaStats> {
    // Intentar leer estadísticas materializadas
    const statsAgregadas = await this.getEstadisticasAgregadas();

    if (statsAgregadas) {
      const mes = statsAgregadas.mesActual;
      const tcPromedio = mes.cantidadOperacionesTC > 0
        ? mes.sumaTipoCambio / mes.cantidadOperacionesTC
        : statsAgregadas.tipoCambioActual;

      const spreadPromedio = mes.cantidadConversiones > 0
        ? mes.spreadAcumulado / mes.cantidadConversiones
        : 0;

      return {
        saldoTotalUSD: statsAgregadas.saldoTotalUSD,
        saldoTotalPEN: statsAgregadas.saldoTotalPEN,
        saldoTotalEquivalentePEN: statsAgregadas.saldoTotalEquivalentePEN,
        ingresosMesUSD: mes.ingresosUSD,
        ingresosMesPEN: mes.ingresosPEN,
        egresosMesUSD: mes.egresosUSD,
        egresosMesPEN: mes.egresosPEN,
        conversionesMes: mes.cantidadConversiones,
        montoConvertidoMes: mes.conversionesUSDaPEN + mes.conversionesPENaUSD,
        spreadPromedioMes: spreadPromedio,
        tcPromedioMes: tcPromedio,
        diferenciaNetaMes: mes.diferenciaNetaMes,
        diferenciaAcumuladaAnio: statsAgregadas.acumuladoAnio.diferenciaNetaAnio,
        pagosPendientesUSD: 0, // Se calcula desde pendientes
        pagosPendientesPEN: 0,
        porCobrarPEN: 0
      };
    }

    // Fallback: cálculo en tiempo real (solo si no hay estadísticas materializadas)
    logger.warn('Estadísticas materializadas no encontradas, calculando en tiempo real...');
    return this._calcularStatsEnTiempoReal();
  },

  /**
   * Cálculo de estadísticas en tiempo real (fallback)
   * Solo se usa si no existen estadísticas materializadas
   */
  async _calcularStatsEnTiempoReal(): Promise<TesoreriaStats> {
    const cuentas = await this.getCuentas();
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    let saldoTotalUSD = 0;
    let saldoTotalPEN = 0;

    cuentas.filter(c => c.activa).forEach(c => {
      if (c.esBiMoneda) {
        saldoTotalUSD += c.saldoUSD || 0;
        saldoTotalPEN += c.saldoPEN || 0;
      } else {
        if (c.moneda === 'USD') {
          saldoTotalUSD += c.saldoActual;
        } else {
          saldoTotalPEN += c.saldoActual;
        }
      }
    });

    let tcActual = 3.70;
    try {
      const tc = await tipoCambioService.getTCDelDia();
      if (tc) tcActual = tc.venta;
    } catch (e) {
      console.warn('No se pudo obtener TC actual');
    }

    const saldoTotalEquivalentePEN = saldoTotalPEN + (saldoTotalUSD * tcActual);

    const movimientosMes = await this.getMovimientos({
      fechaInicio: inicioMes,
      fechaFin: ahora
    });

    const ingresosMes = movimientosMes.filter(m => esMovimientoIngreso(m.tipo, m));
    const egresosMes = movimientosMes.filter(m => esMovimientoEgreso(m.tipo, m));

    const ingresosMesUSD = ingresosMes.filter(m => m.moneda === 'USD').reduce((sum, m) => sum + m.monto, 0);
    const ingresosMesPEN = ingresosMes.filter(m => m.moneda === 'PEN').reduce((sum, m) => sum + m.monto, 0);
    const egresosMesUSD = egresosMes.filter(m => m.moneda === 'USD').reduce((sum, m) => sum + m.monto, 0);
    const egresosMesPEN = egresosMes.filter(m => m.moneda === 'PEN').reduce((sum, m) => sum + m.monto, 0);

    const conversionesMes = await this.getConversiones({
      fechaInicio: inicioMes,
      fechaFin: ahora
    });

    const montoConvertidoMes = conversionesMes.reduce((sum, c) => sum + c.montoOrigen, 0);
    const spreadPromedioMes = conversionesMes.length > 0
      ? conversionesMes.reduce((sum, c) => sum + c.spreadCambiario, 0) / conversionesMes.length
      : 0;

    const movimientosConTC = movimientosMes.filter(m => m.tipoCambio > 0 && m.estado !== 'anulado');
    const tcPromedioMes = movimientosConTC.length > 0
      ? movimientosConTC.reduce((sum, m) => sum + m.tipoCambio, 0) / movimientosConTC.length
      : tcActual;

    // Solo calcular diferencia del mes actual (no todo el año)
    const diferenciaConversiones = conversionesMes.reduce((sum, c) => sum + c.diferenciaVsReferencia, 0);

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
      tcPromedioMes,
      diferenciaNetaMes: diferenciaConversiones,
      diferenciaAcumuladaAnio: diferenciaConversiones, // Solo mes actual como fallback
      pagosPendientesUSD: 0,
      pagosPendientesPEN: 0,
      porCobrarPEN: 0
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
    const ingresos = movimientos.filter(m => esMovimientoIngreso(m.tipo, m));
    const egresos = movimientos.filter(m => esMovimientoEgreso(m.tipo, m));

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
        saldoBaseUSD += c.saldoUSD || 0;
        saldoBasePEN += c.saldoPEN || 0;
      } else {
        if (c.moneda === 'USD') {
          saldoBaseUSD += c.saldoActual || 0;
        } else {
          saldoBasePEN += c.saldoActual || 0;
        }
      }
    });

    // Calcular saldo al inicio del mes (saldo base + movimientos anteriores)
    let saldoInicialUSD = saldoBaseUSD;
    let saldoInicialPEN = saldoBasePEN;

    for (const mov of movimientosAnteriores) {
      // Usar el helper para determinar si es ingreso basándose en el tipo y contexto
      const esIngreso = esMovimientoIngreso(mov.tipo, mov);
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
