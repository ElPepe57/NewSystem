import {
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import type { Envio, PagoColaborador } from '../types/envio.types';
import { tesoreriaService } from './tesoreria.service';
import type { MetodoTesoreria } from '../types/tesoreria.types';
import { TIPOS_ENVIO_INTERNACIONAL } from '../types/envio.types';

const COLL = COLLECTIONS.ENVIOS;

/**
 * Helper: obtiene pagos al colaborador como array (backward compat)
 */
function getPagosArray(envio: Envio): PagoColaborador[] {
  return envio.pagosColaborador && envio.pagosColaborador.length > 0
    ? envio.pagosColaborador
    : [];
}

export const envioPagosService = {
  /**
   * Registra un pago parcial o total al colaborador (viajero/courier) por el flete.
   * Integrado con Tesoreria.
   */
  async registrarPagoColaborador(
    envioId: string,
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
  ): Promise<PagoColaborador> {
    const ref = doc(db, COLL, envioId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Envio no encontrado');
    const envio = { id: snap.id, ...snap.data() } as Envio;

    // Solo se admiten pagos en envios internacionales (los que llevan flete al colaborador)
    if (envio.tipo && !TIPOS_ENVIO_INTERNACIONAL.includes(envio.tipo)) {
      throw new Error('Solo se pueden registrar pagos al colaborador en envios internacionales');
    }

    // Bloquear si ya esta completamente pagado
    const pagosAnteriores = getPagosArray(envio);
    if (envio.estadoPagoColaborador === 'pagado' && pagosAnteriores.length > 0) {
      throw new Error('El pago al colaborador ya fue completado');
    }

    const { fechaPago, monedaPago, montoOriginal, tipoCambio, metodoPago, cuentaOrigenId, referencia, notas } = datos;

    if (!tipoCambio || tipoCambio <= 0) throw new Error('El tipo de cambio es requerido y debe ser mayor a 0');
    if (!montoOriginal || montoOriginal <= 0) throw new Error('El monto es requerido y debe ser mayor a 0');

    const montoUSD = monedaPago === 'USD' ? montoOriginal : montoOriginal / tipoCambio;
    const montoPEN = monedaPago === 'PEN' ? montoOriginal : montoOriginal * tipoCambio;

    const costoFleteTotal = envio.costoFleteTotal || 0;
    const montoPagadoUSDAnterior = pagosAnteriores.reduce((sum, p) => sum + p.montoUSD, 0);
    const montoPendienteUSD = costoFleteTotal - montoPagadoUSDAnterior;

    if (montoUSD > montoPendienteUSD + 0.01) {
      throw new Error(`El monto excede el saldo pendiente. Pendiente: $${montoPendienteUSD.toFixed(2)} USD`);
    }

    const nuevoMontoPagadoUSD = montoPagadoUSDAnterior + montoUSD;
    const nuevoMontoPendienteUSD = costoFleteTotal - nuevoMontoPagadoUSD;
    const nuevoEstado = nuevoMontoPendienteUSD <= 0.01 ? 'pagado' : 'parcial';
    const esPagoCompleto = nuevoEstado === 'pagado';

    // Obtener nombre de cuenta si se especifico
    let cuentaOrigenNombre: string | undefined;
    if (cuentaOrigenId) {
      try {
        const cuenta = await tesoreriaService.getCuentaById(cuentaOrigenId);
        if (cuenta) cuentaOrigenNombre = cuenta.nombre;
      } catch (e) {
        logger.warn('No se pudo obtener nombre de cuenta:', e);
      }
    }

    // Crear registro de pago
    const pagoId = `PAG-COL-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const nuevoPago: PagoColaborador = {
      id: pagoId,
      fecha: Timestamp.fromDate(fechaPago),
      monedaPago,
      montoOriginal,
      montoUSD,
      montoPEN,
      tipoCambio,
      metodoPago,
      registradoPor: userId,
      fechaRegistro: Timestamp.now(),
    };
    if (cuentaOrigenId) nuevoPago.cuentaOrigenId = cuentaOrigenId;
    if (cuentaOrigenNombre) nuevoPago.cuentaOrigenNombre = cuentaOrigenNombre;
    if (referencia) nuevoPago.referencia = referencia;
    if (notas) nuevoPago.notas = notas;

    const nuevosPagos = [...pagosAnteriores, nuevoPago];

    // Actualizar el envio con el array de pagos y montos acumulados
    await updateDoc(ref, {
      estadoPagoColaborador: nuevoEstado,
      pagosColaborador: nuevosPagos,
      montoPagadoUSD: nuevoMontoPagadoUSD,
      montoPendienteUSD: Math.max(0, nuevoMontoPendienteUSD),
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });

    // ========== REGISTRAR EN TESORERIA ==========
    try {
      const movimientoData: Record<string, unknown> = {
        tipo: 'pago_viajero',
        moneda: monedaPago,
        monto: montoOriginal,
        tipoCambio,
        metodo: metodoPago,
        concepto: `Pago ${esPagoCompleto ? '' : 'parcial '}flete ${envio.numeroEnvio} - Colaborador: ${envio.colaboradorNombre || 'Sin nombre'}`,
        notas: notas || `Envio ${envio.numeroEnvio}. ${monedaPago === 'USD' ? `aprox. S/ ${montoPEN.toFixed(2)}` : `aprox. $${montoUSD.toFixed(2)} USD`}`,
        fecha: fechaPago,
        // Campos de referencia: usamos envioId (nuevo) para nuevos docs
        envioId: envioId,
        envioNumero: envio.numeroEnvio,
      };
      if (referencia) movimientoData.referencia = referencia;
      if (cuentaOrigenId) movimientoData.cuentaOrigen = cuentaOrigenId;

      const movimientoId = await tesoreriaService.registrarMovimiento(movimientoData as any, userId);
      nuevoPago.movimientoTesoreriaId = movimientoId;

      nuevosPagos[nuevosPagos.length - 1] = { ...nuevoPago, movimientoTesoreriaId: movimientoId };
      await updateDoc(ref, { pagosColaborador: nuevosPagos });

      logger.success(`Pago colaborador registrado en tesoreria: ${monedaPago} ${montoOriginal} para ${envio.numeroEnvio}`);
    } catch (tesoreriaError) {
      logger.error('Error registrando pago colaborador en tesoreria:', tesoreriaError);
      nuevosPagos[nuevosPagos.length - 1] = {
        ...nuevoPago,
        errorTesoreria: true,
        errorTesoreriaMsg: tesoreriaError instanceof Error ? tesoreriaError.message : 'Error desconocido',
      };
      await updateDoc(ref, { pagosColaborador: nuevosPagos }).catch(() => {});
    }

    return nuevoPago;
  },

  /**
   * Reconcilia un pago de colaborador: re-crea el movimiento en tesoreria
   * para pagos que se registraron pero cuyo movimiento fallo.
   */
  async reconciliarPagoColaborador(
    envioId: string,
    userId: string,
    pagoId?: string
  ): Promise<string> {
    const snap = await getDoc(doc(db, COLL, envioId));
    if (!snap.exists()) throw new Error('Envio no encontrado');
    const envio = { id: snap.id, ...snap.data() } as Envio;

    const pagos = getPagosArray(envio);
    if (pagos.length === 0) throw new Error('Este envio no tiene pagos registrados');

    let pago: PagoColaborador | undefined;
    if (pagoId) {
      pago = pagos.find(p => p.id === pagoId);
    } else {
      pago = pagos.find(p => p.errorTesoreria || !p.movimientoTesoreriaId);
    }

    // Verificar si el movimiento existe aunque tenga el ID
    if (!pago) {
      for (const p of pagos) {
        if (p.movimientoTesoreriaId) {
          const movExistente = await tesoreriaService.getMovimientoById(p.movimientoTesoreriaId);
          if (!movExistente) { pago = p; break; }
        }
      }
    }

    if (!pago) {
      throw new Error('Todos los pagos ya tienen sus movimientos de tesoreria vinculados correctamente');
    }

    const movimientoData: Record<string, unknown> = {
      tipo: 'pago_viajero',
      moneda: pago.monedaPago,
      monto: pago.montoOriginal,
      tipoCambio: pago.tipoCambio,
      metodo: pago.metodoPago,
      concepto: `Pago flete ${envio.numeroEnvio} - Colaborador: ${envio.colaboradorNombre || 'Sin nombre'}`,
      notas: `[Reconciliado] Envio ${envio.numeroEnvio}. ${pago.monedaPago === 'USD' ? `aprox. S/ ${pago.montoPEN.toFixed(2)}` : `aprox. $${pago.montoUSD.toFixed(2)} USD`}`,
      fecha: pago.fecha.toDate(),
      envioId: envioId,
      envioNumero: envio.numeroEnvio,
    };
    if (pago.referencia) movimientoData.referencia = pago.referencia;
    if (pago.cuentaOrigenId) movimientoData.cuentaOrigen = pago.cuentaOrigenId;

    const movimientoId = await tesoreriaService.registrarMovimiento(movimientoData as any, userId);

    const pagosActualizados = pagos.map(p =>
      p.id === pago!.id
        ? { ...p, movimientoTesoreriaId: movimientoId, errorTesoreria: undefined, errorTesoreriaMsg: undefined }
        : p
    );
    pagosActualizados.forEach(p => {
      if (p.errorTesoreria === undefined) delete (p as any).errorTesoreria;
      if (p.errorTesoreriaMsg === undefined) delete (p as any).errorTesoreriaMsg;
    });

    await updateDoc(doc(db, COLL, envioId), { pagosColaborador: pagosActualizados });
    logger.success(`Pago colaborador reconciliado en tesoreria: ${pago.monedaPago} ${pago.montoOriginal} para ${envio.numeroEnvio}`);
    return movimientoId;
  },

  /**
   * Retorna envios internacionales con flete pendiente de pago
   */
  async getPendientesPagoColaborador(): Promise<Envio[]> {
    const q = query(
      collection(db, COLL),
      where('estadoPagoColaborador', 'in', ['pendiente', 'parcial'])
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Envio)).filter(
      e => e.costoFleteTotal && e.costoFleteTotal > 0
    );
  },

  /**
   * Obtiene el historial financiero completo de un colaborador
   */
  async getHistorialFinancieroColaborador(colaboradorId: string): Promise<{
    envios: Envio[];
    resumen: {
      totalEnvios: number;
      completados: number;
      enTransito: number;
      totalUnidadesTransportadas: number;
      totalFletePagado: number;
      totalFletePendiente: number;
      promedioFletePorUnidad: number;
      primeraFecha?: Date;
      ultimaFecha?: Date;
    };
    pendientes: Envio[];
    pagados: Envio[];
  }> {
    const q = query(collection(db, COLL), where('colaboradorId', '==', colaboradorId));
    const snap = await getDocs(q);
    const envios = snap.docs.map(d => ({ id: d.id, ...d.data() } as Envio));

    let totalUnidadesTransportadas = 0;
    let totalFletePagado = 0;
    let totalFletePendiente = 0;
    let completados = 0;
    let enTransito = 0;
    const pendientes: Envio[] = [];
    const pagados: Envio[] = [];

    for (const e of envios) {
      const unidadesRecibidas = e.unidades.filter(u => u.estadoEnvio === 'recibida').length;
      totalUnidadesTransportadas += unidadesRecibidas;

      if (e.estado === 'recibida_completa' || e.estado === 'recibida_parcial') completados++;
      else if (e.estado === 'en_transito') enTransito++;

      if (e.costoFleteTotal && e.costoFleteTotal > 0) {
        if (e.estadoPagoColaborador === 'pagado') {
          totalFletePagado += e.costoFleteTotal;
          pagados.push(e);
        } else if (e.estadoPagoColaborador === 'parcial') {
          const pagadoUSD = e.montoPagadoUSD || 0;
          totalFletePagado += pagadoUSD;
          totalFletePendiente += (e.costoFleteTotal - pagadoUSD);
          pendientes.push(e);
        } else {
          totalFletePendiente += e.costoFleteTotal;
          pendientes.push(e);
        }
      }
    }

    const promedioFletePorUnidad = totalUnidadesTransportadas > 0
      ? (totalFletePagado + totalFletePendiente) / totalUnidadesTransportadas
      : 0;

    const fechas = envios.map(e => e.fechaCreacion.toDate()).sort((a, b) => a.getTime() - b.getTime());

    return {
      envios,
      resumen: {
        totalEnvios: envios.length,
        completados,
        enTransito,
        totalUnidadesTransportadas,
        totalFletePagado,
        totalFletePendiente,
        promedioFletePorUnidad,
        primeraFecha: fechas[0],
        ultimaFecha: fechas[fechas.length - 1],
      },
      pendientes,
      pagados,
    };
  },
};
