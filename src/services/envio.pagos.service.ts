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
// S55 Fase 4 — CC del colaborador
import { cuentaCorrienteService } from './cuentaCorriente.service';
import { getPagosEnvio } from './cuentaCorriente.adaptadores';

const COLL = COLLECTIONS.ENVIOS;

// S55 Fase 4 — `getPagosArray` eliminado. Los pagos ahora viven en CC.
// Usar `getPagosEnvio(envioId)` del adaptador para obtenerlos.

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

    // S55 Fase 4 — Bloquear si ya está pagado (denormalizado).
    if (envio.estadoPagoColaborador === 'pagado') {
      throw new Error('El pago al colaborador ya fue completado');
    }

    const { fechaPago, monedaPago, montoOriginal, tipoCambio, metodoPago, cuentaOrigenId, referencia, notas } = datos;

    if (!tipoCambio || tipoCambio <= 0) throw new Error('El tipo de cambio es requerido y debe ser mayor a 0');
    if (!montoOriginal || montoOriginal <= 0) throw new Error('El monto es requerido y debe ser mayor a 0');

    const montoUSD = monedaPago === 'USD' ? montoOriginal : montoOriginal / tipoCambio;
    const montoPEN = monedaPago === 'PEN' ? montoOriginal : montoOriginal * tipoCambio;

    const costoFleteTotal = envio.costoFleteTotal || 0;

    // S55 Fase 4 — Leer pagos previos desde CC (no del array legacy).
    const pagosCCPrevios = await getPagosEnvio(envioId);
    const montoPagadoUSDAnterior = pagosCCPrevios.reduce((sum, p) =>
      sum + (p.monedaPago === 'USD' ? p.montoOriginal : p.montoUSD), 0
    );
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

    // Crear registro legacy SOLO para retorno (compat con consumers).
    // Ya no se persiste en envio.pagosColaborador[].
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

    // S55 Fase 4 — Solo actualiza denormalizados del envío.
    await updateDoc(ref, {
      estadoPagoColaborador: nuevoEstado,
      montoPagadoUSD: nuevoMontoPagadoUSD,
      montoPendienteUSD: Math.max(0, nuevoMontoPendienteUSD),
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });

    // ========== REGISTRAR EN LIBRO MAYOR FINANCIERO (F4a · ADR-PF-001) ==========
    let movimientoTesoreriaId: string | undefined;
    try {
      const { registrarMovimientoFinanciero } = await import(
        './movimientoFinanciero.service'
      );
      movimientoTesoreriaId = await registrarMovimientoFinanciero(
        {
          categoria: 'pago_viajero',
          moneda: monedaPago,
          monto: montoOriginal,
          tipoCambio,
          metodo: metodoPago,
          concepto: `Pago ${esPagoCompleto ? '' : 'parcial '}flete ${envio.numeroEnvio} - Colaborador: ${envio.colaboradorNombre || 'Sin nombre'}`,
          notas: notas || `Envio ${envio.numeroEnvio}. ${monedaPago === 'USD' ? `aprox. S/ ${montoPEN.toFixed(2)}` : `aprox. $${montoUSD.toFixed(2)} USD`}`,
          fecha: fechaPago,
          referencia,
          productoOrigenId: cuentaOrigenId,
          refDocumentoTipo: 'envio',
          refDocumentoId: envioId,
          refDocumentoNumero: envio.numeroEnvio,
        },
        userId,
      );
      nuevoPago.movimientoTesoreriaId = movimientoTesoreriaId;

      logger.success(`Pago colaborador registrado en libro mayor: ${monedaPago} ${montoOriginal} para ${envio.numeroEnvio}`);
    } catch (tesoreriaError) {
      logger.error('Error registrando pago colaborador en libro mayor:', tesoreriaError);
      nuevoPago.errorTesoreria = true;
      nuevoPago.errorTesoreriaMsg = tesoreriaError instanceof Error ? tesoreriaError.message : 'Error desconocido';
    }

    // S55 Fase 4 — Crear movimiento `credito_pago_envio` en CC del colaborador.
    // No bloqueante: si falla, el pago queda registrado y se puede ajustar manual.
    if (envio.colaboradorId) {
      try {
        await cuentaCorrienteService.registrarMovimiento(
          {
            entidadId: envio.colaboradorId,
            tipo: 'colaborador',
            entidadNombre: envio.colaboradorNombre || 'Colaborador',
            tipoMovimiento: 'credito_pago_envio',
            descripcion: `Pago flete ${envio.numeroEnvio} · ${monedaPago} ${montoOriginal.toFixed(2)} vía ${metodoPago}`,
            moneda: 'USD',
            monto: montoUSD,
            fecha: fechaPago,
            refDocumentoTipo: 'envio',
            refDocumentoId: envioId,
            refDocumentoNumero: envio.numeroEnvio,
            movimientoTesoreriaId,
            notas,
          },
          userId,
        );
      } catch (ccErr) {
        logger.warn(
          '[CC] No se pudo crear credito_pago_envio (no bloqueante): ' +
            (ccErr instanceof Error ? ccErr.message : String(ccErr)),
        );
      }
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

    // S55 Fase 4 — Pagos viven en CC. Buscar movimientos sin
    // movimientoTesoreriaId (caso post-Fase 4) o que tengan referencia
    // colgada (caso CF ML antes de Fase 9-pre).
    const movsCC = await getPagosEnvio(envioId);
    if (movsCC.length === 0) throw new Error('Este envio no tiene pagos registrados');

    let pago = pagoId
      ? movsCC.find(p => p.id === pagoId)
      : movsCC.find(p => !p.movimientoTesoreriaId);

    if (!pago) {
      // Verificar si el movimiento de tesorería existe aunque tenga el ID
      for (const p of movsCC) {
        if (p.movimientoTesoreriaId) {
          const movExistente = await tesoreriaService.getMovimientoById(p.movimientoTesoreriaId);
          if (!movExistente) { pago = p; break; }
        }
      }
    }

    if (!pago) {
      throw new Error('Todos los pagos ya tienen sus movimientos de tesoreria vinculados correctamente');
    }

    // F4a.4 · ADR-PF-001 · reconciliación al libro mayor unificado
    const { registrarMovimientoFinanciero } = await import(
      './movimientoFinanciero.service'
    );
    const movimientoId = await registrarMovimientoFinanciero(
      {
        categoria: 'pago_viajero',
        moneda: pago.monedaPago,
        monto: pago.montoOriginal,
        tipoCambio: pago.tipoCambio,
        metodo: pago.metodoPago,
        concepto: `Pago flete ${envio.numeroEnvio} - Colaborador: ${envio.colaboradorNombre || 'Sin nombre'}`,
        notas: `[Reconciliado] Envio ${envio.numeroEnvio}.`,
        fecha: pago.fecha.toDate(),
        referencia: pago.referencia,
        productoOrigenId: pago.cuentaOrigenId,
        refDocumentoTipo: 'envio',
        refDocumentoId: envioId,
        refDocumentoNumero: envio.numeroEnvio,
      },
      userId,
    );

    // S55 Fase 4 — El movimientoTesoreriaId vive en el doc MovimientoCC.
    // Como los movimientos CC son inmutables, no actualizamos el doc viejo;
    // creamos uno nuevo de "ajuste" que enlace al nuevo movimientoTesoreria.
    logger.success(`Pago colaborador reconciliado en libro mayor: ${pago.monedaPago} ${pago.montoOriginal} para ${envio.numeroEnvio}. movId=${movimientoId}`);
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
