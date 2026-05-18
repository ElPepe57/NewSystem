/**
 * cajaRecaudadora.service.ts — chk5.D-S1f · F3
 *
 * CRUD + cálculo de balance de eventos de Caja Recaudadora (D5 + D12).
 * No ejecuta liquidación · solo registra eventos atómicos:
 *   - registrarCobroEntrante: rider cobró al cliente final
 *   - registrarServicioDescontado: recaudador descontó su tarifa
 *   - calcularBalanceMes: consolidado del periodo + breakdown por canal D12
 *   - cancelarEvento: anular (preserva auditoría)
 *
 * La liquidación real (transferencia al banco destino) la hace
 * `liquidarCajaRecaudadora.service.ts` con runTransaction atómica.
 *
 * IDEMPOTENCIA: si se reintenta con la misma `idempotencyKey`, el evento
 * NO se duplica (consulta por key antes de crear).
 *
 * Decisiones aplicadas:
 *   - D5: 6to tipo `caja_recaudadora` con responsable tercero + tarifa
 *   - D12: multi-canal · balance consolidado · 1 CC con proveedor
 *   - DEUDA-MODELO-RECAUDADOR (refinada) · ver docs/mockups/SUPERSEDED-v5.md
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  addDoc,
  updateDoc,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import type {
  ProductoFinanciero,
  TipoCanalRecaudacion,
} from '../types/productoFinanciero.types';
import {
  validarCanalesAceptados,
} from '../types/productoFinanciero.types';
import type {
  EventoServicioRecaudador,
  CrearCobroEntranteInput,
  CrearServicioDescontadoInput,
  BalanceRecaudadora,
  TipoEventoRecaudador,
  EstadoEventoRecaudador,
} from '../types/eventoServicioRecaudador.types';

// ═════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═════════════════════════════════════════════════════════════════════════

const EVENTOS_COLL = COLLECTIONS.EVENTOS_SERVICIO_RECAUDADOR;
const PRODUCTOS_COLL = COLLECTIONS.PRODUCTOS_FINANCIEROS;
const TOLERANCIA = 0.01;

// ═════════════════════════════════════════════════════════════════════════
// HELPERS PRIVADOS
// ═════════════════════════════════════════════════════════════════════════

async function generarCodigoEvento(): Promise<string> {
  const year = new Date().getFullYear();
  return getNextSequenceNumber(`ESR-${year}`, 4);
}

function generarIdempotencyKeyCobro(input: CrearCobroEntranteInput): string {
  const fechaIso = input.fecha.toISOString().split('T')[0];
  return [
    'cobro',
    input.recaudadoraId,
    fechaIso,
    input.monto.toFixed(2),
    input.moneda,
    input.canalCobro,
    input.vinculacionTipo,
    input.vinculacionId ?? 'sin-vinculo',
  ].join('|');
}

function generarIdempotencyKeyServicio(input: CrearServicioDescontadoInput): string {
  const fechaIso = input.fecha.toISOString().split('T')[0];
  return [
    'servicio',
    input.recaudadoraId,
    fechaIso,
    input.monto.toFixed(2),
    input.moneda,
    input.unidadesDeServicio.toString(),
  ].join('|');
}

async function buscarEventoPorIdempotencyKey(
  key: string,
): Promise<EventoServicioRecaudador | null> {
  const q = query(
    collection(db, EVENTOS_COLL),
    where('idempotencyKey', '==', key),
    limit(1),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as EventoServicioRecaudador;
}

async function getRecaudadora(id: string): Promise<ProductoFinanciero | null> {
  const docSnap = await getDoc(doc(db, PRODUCTOS_COLL, id));
  if (!docSnap.exists()) return null;
  const data = { id: docSnap.id, ...docSnap.data() } as ProductoFinanciero;
  if (data.tipoProducto !== 'caja_recaudadora') {
    logger.warn(
      `getRecaudadora(${id}) · producto existe pero tipoProducto='${data.tipoProducto}' (esperado 'caja_recaudadora')`,
    );
    return null;
  }
  return data;
}

function validarCobroEntrante(
  input: CrearCobroEntranteInput,
  recaudadora: ProductoFinanciero,
): string | null {
  if (!recaudadora.activa) {
    return `Recaudadora ${recaudadora.codigo} no está activa.`;
  }
  if (input.monto <= 0) {
    return 'El monto del cobro debe ser mayor a 0.';
  }
  if (input.moneda !== recaudadora.moneda) {
    return `Moneda del cobro (${input.moneda}) no coincide con moneda de la recaudadora (${recaudadora.moneda}).`;
  }
  // Validar canal en canales aceptados activos
  const canales = recaudadora.canalesAceptados ?? [];
  const canal = canales.find((c) => c.tipo === input.canalCobro);
  if (!canal) {
    return `Canal '${input.canalCobro}' no está configurado en esta recaudadora. Configurá el canal antes de registrar cobros.`;
  }
  if (!canal.activo) {
    return `Canal '${input.canalCobro}' está desactivado en esta recaudadora. Reactivá el canal o usá otro.`;
  }
  // Validar vinculación
  if (input.vinculacionTipo !== 'manual' && !input.vinculacionId) {
    return `Vinculación tipo '${input.vinculacionTipo}' requiere vinculacionId del documento de origen.`;
  }
  return null;
}

function validarServicioDescontado(
  input: CrearServicioDescontadoInput,
  recaudadora: ProductoFinanciero,
): string | null {
  if (!recaudadora.activa) {
    return `Recaudadora ${recaudadora.codigo} no está activa.`;
  }
  if (input.monto <= 0) {
    return 'El monto del servicio descontado debe ser mayor a 0.';
  }
  if (input.unidadesDeServicio <= 0) {
    return 'Las unidades de servicio deben ser mayor a 0.';
  }
  if (input.moneda !== recaudadora.moneda) {
    return `Moneda del servicio (${input.moneda}) no coincide con moneda de la recaudadora (${recaudadora.moneda}).`;
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════════
// SERVICIO
// ═════════════════════════════════════════════════════════════════════════

export const cajaRecaudadoraService = {

  // ════════════════════════════════════════════════════════════════════
  // CREAR EVENTOS
  // ════════════════════════════════════════════════════════════════════

  /**
   * Registra un cobro entrante (rider cobró al cliente final).
   * Crea un evento tipo='cobro_entrante' en estado 'pendiente'.
   *
   * IDEMPOTENCIA: si la key ya existe, retorna el evento existente.
   */
  async registrarCobroEntrante(
    input: CrearCobroEntranteInput,
    userId: string,
  ): Promise<EventoServicioRecaudador> {
    const key = input.idempotencyKey ?? generarIdempotencyKeyCobro(input);

    // Idempotencia
    const existente = await buscarEventoPorIdempotencyKey(key);
    if (existente) {
      logger.info(`Cobro entrante ya registrado con key ${key} · retornando existente ${existente.codigo}`);
      return existente;
    }

    // Validar recaudadora
    const recaudadora = await getRecaudadora(input.recaudadoraId);
    if (!recaudadora) {
      throw new Error(`Caja recaudadora ${input.recaudadoraId} no encontrada o no es tipo 'caja_recaudadora'.`);
    }

    // Validar input
    const error = validarCobroEntrante(input, recaudadora);
    if (error) throw new Error(error);

    // Construir evento
    const codigo = await generarCodigoEvento();
    const fechaTs = Timestamp.fromDate(input.fecha);
    const eventoData: Omit<EventoServicioRecaudador, 'id'> & { idempotencyKey: string } = {
      codigo,
      recaudadoraId: input.recaudadoraId,
      recaudadoraNombre: recaudadora.nombre,
      tipo: 'cobro_entrante',
      fecha: fechaTs,
      moneda: input.moneda,
      monto: input.monto,
      canalCobro: input.canalCobro,
      vinculacionTipo: input.vinculacionTipo,
      vinculacionId: input.vinculacionId,
      vinculacionRefDoc: input.vinculacionRefDoc,
      clienteFinalNombre: input.clienteFinalNombre,
      estado: 'pendiente',
      registradoPor: userId,
      fechaRegistro: serverTimestamp() as Timestamp,
      notas: input.notas,
      idempotencyKey: key,
    } as any;

    const docRef = await addDoc(collection(db, EVENTOS_COLL), eventoData);
    logger.info(`Cobro entrante registrado: ${codigo} · ${input.moneda} ${input.monto} · canal ${input.canalCobro}`);
    return { id: docRef.id, ...eventoData } as EventoServicioRecaudador;
  },

  /**
   * Registra un servicio descontado (recaudador cobra su tarifa).
   * Tipicamente se genera AUTO al cerrar el periodo desde
   * `liquidarCajaRecaudadora.service.ts` calculando unidades del periodo
   * × tarifa snapshot. También puede registrarse manualmente.
   */
  async registrarServicioDescontado(
    input: CrearServicioDescontadoInput,
    userId: string,
  ): Promise<EventoServicioRecaudador> {
    const key = input.idempotencyKey ?? generarIdempotencyKeyServicio(input);

    const existente = await buscarEventoPorIdempotencyKey(key);
    if (existente) {
      logger.info(`Servicio descontado ya registrado con key ${key} · retornando existente ${existente.codigo}`);
      return existente;
    }

    const recaudadora = await getRecaudadora(input.recaudadoraId);
    if (!recaudadora) {
      throw new Error(`Caja recaudadora ${input.recaudadoraId} no encontrada.`);
    }

    const error = validarServicioDescontado(input, recaudadora);
    if (error) throw new Error(error);

    const codigo = await generarCodigoEvento();
    const fechaTs = Timestamp.fromDate(input.fecha);
    const eventoData: Omit<EventoServicioRecaudador, 'id'> & { idempotencyKey: string } = {
      codigo,
      recaudadoraId: input.recaudadoraId,
      recaudadoraNombre: recaudadora.nombre,
      tipo: 'servicio_descontado',
      fecha: fechaTs,
      moneda: input.moneda,
      monto: input.monto,
      tarifaSnapshot: input.tarifaSnapshot,
      unidadesDeServicio: input.unidadesDeServicio,
      descripcionServicio: input.descripcionServicio,
      estado: 'pendiente',
      registradoPor: userId,
      fechaRegistro: serverTimestamp() as Timestamp,
      notas: input.notas,
      idempotencyKey: key,
    } as any;

    const docRef = await addDoc(collection(db, EVENTOS_COLL), eventoData);
    logger.info(`Servicio descontado registrado: ${codigo} · ${input.moneda} ${input.monto} · ${input.unidadesDeServicio} unidades`);
    return { id: docRef.id, ...eventoData } as EventoServicioRecaudador;
  },

  // ════════════════════════════════════════════════════════════════════
  // LECTURA
  // ════════════════════════════════════════════════════════════════════

  async getEventoById(id: string): Promise<EventoServicioRecaudador | null> {
    const docSnap = await getDoc(doc(db, EVENTOS_COLL, id));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as EventoServicioRecaudador;
  },

  /**
   * Lista todos los eventos de una recaudadora en un periodo.
   * Filtra por fecha · ordena cronológico.
   */
  async getEventosPorPeriodo(
    recaudadoraId: string,
    fechaInicio: Date,
    fechaFin: Date,
    filtros?: {
      tipo?: TipoEventoRecaudador;
      estado?: EstadoEventoRecaudador;
      canalCobro?: TipoCanalRecaudacion;
    },
  ): Promise<EventoServicioRecaudador[]> {
    const q = query(
      collection(db, EVENTOS_COLL),
      where('recaudadoraId', '==', recaudadoraId),
      where('fecha', '>=', Timestamp.fromDate(fechaInicio)),
      where('fecha', '<=', Timestamp.fromDate(fechaFin)),
      orderBy('fecha', 'asc'),
    );
    const snapshot = await getDocs(q);
    let eventos = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as EventoServicioRecaudador));

    // Filtros en memoria (Firestore no admite múltiples inequality)
    if (filtros?.tipo) {
      eventos = eventos.filter((e) => e.tipo === filtros.tipo);
    }
    if (filtros?.estado) {
      eventos = eventos.filter((e) => e.estado === filtros.estado);
    }
    if (filtros?.canalCobro) {
      eventos = eventos.filter((e) => e.canalCobro === filtros.canalCobro);
    }
    return eventos;
  },

  /**
   * Lista eventos pendientes de una recaudadora (todos los no liquidados ni cancelados).
   */
  async getEventosPendientes(
    recaudadoraId: string,
  ): Promise<EventoServicioRecaudador[]> {
    const q = query(
      collection(db, EVENTOS_COLL),
      where('recaudadoraId', '==', recaudadoraId),
      where('estado', '==', 'pendiente'),
      orderBy('fecha', 'asc'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as EventoServicioRecaudador));
  },

  // ════════════════════════════════════════════════════════════════════
  // BALANCE CONSOLIDADO (D12 · breakdown por canal)
  // ════════════════════════════════════════════════════════════════════

  /**
   * Calcula el balance de una recaudadora en un periodo:
   *   - cobros recibidos (suma eventos tipo='cobro_entrante')
   *   - servicios descontados (suma eventos tipo='servicio_descontado')
   *   - liquidaciones previas del periodo
   *   - pendiente liquidar = cobros − servicios − liquidaciones
   *   - breakdown por canal (D12) · útil para UI drill
   */
  async calcularBalanceMes(
    recaudadoraId: string,
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<BalanceRecaudadora> {
    const eventos = await this.getEventosPorPeriodo(recaudadoraId, fechaInicio, fechaFin);

    let cobrosRecibidos = 0;
    let serviciosDescontados = 0;
    let cobrosCount = 0;
    let serviciosCount = 0;
    let eventosPendientesCount = 0;
    const porCanal: Partial<Record<TipoCanalRecaudacion, { monto: number; eventos: number }>> = {};

    for (const e of eventos) {
      if (e.estado === 'cancelado') continue;
      if (e.estado === 'pendiente') eventosPendientesCount += 1;

      if (e.tipo === 'cobro_entrante') {
        cobrosRecibidos += e.monto;
        cobrosCount += 1;
        if (e.canalCobro) {
          const slot = porCanal[e.canalCobro] ?? { monto: 0, eventos: 0 };
          slot.monto += e.monto;
          slot.eventos += 1;
          porCanal[e.canalCobro] = slot;
        }
      } else if (e.tipo === 'servicio_descontado') {
        serviciosDescontados += e.monto;
        serviciosCount += 1;
      }
    }

    // Sumar liquidaciones del periodo
    const liqQ = query(
      collection(db, COLLECTIONS.LIQUIDACIONES_RECAUDADORA),
      where('recaudadoraId', '==', recaudadoraId),
      where('fechaLiquidacion', '>=', Timestamp.fromDate(fechaInicio)),
      where('fechaLiquidacion', '<=', Timestamp.fromDate(fechaFin)),
      where('estado', '==', 'confirmada'),
    );
    const liqSnap = await getDocs(liqQ);
    let liquidacionesYa = 0;
    let liquidacionesCount = 0;
    let ultimaLiquidacionFecha: Date | undefined;
    for (const d of liqSnap.docs) {
      const data = d.data();
      liquidacionesYa += data.saldoLiquidado || 0;
      liquidacionesCount += 1;
      const ts = data.fechaLiquidacion as Timestamp;
      const fecha = ts.toDate();
      if (!ultimaLiquidacionFecha || fecha > ultimaLiquidacionFecha) {
        ultimaLiquidacionFecha = fecha;
      }
    }

    const pendienteLiquidar = cobrosRecibidos - serviciosDescontados - liquidacionesYa;
    const diasDesdeUltimaLiquidacion = ultimaLiquidacionFecha
      ? Math.floor((Date.now() - ultimaLiquidacionFecha.getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    return {
      recaudadoraId,
      fechaInicio,
      fechaFin,
      cobrosRecibidos,
      serviciosDescontados,
      liquidacionesYa,
      pendienteLiquidar,
      porCanal,
      cobrosCount,
      serviciosCount,
      liquidacionesCount,
      eventosPendientesCount,
      ultimaLiquidacionFecha,
      diasDesdeUltimaLiquidacion,
    };
  },

  // ════════════════════════════════════════════════════════════════════
  // CANCELACIÓN
  // ════════════════════════════════════════════════════════════════════

  /**
   * Cancela un evento · preserva auditoría · NO permite cancelar eventos
   * ya liquidados (deben revertirse vía anulación de liquidación).
   */
  async cancelarEvento(
    eventoId: string,
    motivo: string,
    userId: string,
  ): Promise<void> {
    const evento = await this.getEventoById(eventoId);
    if (!evento) throw new Error(`Evento ${eventoId} no encontrado.`);
    if (evento.estado === 'cancelado') {
      throw new Error(`Evento ${evento.codigo} ya estaba cancelado.`);
    }
    if (evento.estado === 'liquidado') {
      throw new Error(
        `Evento ${evento.codigo} ya fue liquidado (liquidación ${evento.liquidacionCodigo}). ` +
        `Para revertir, anular la liquidación primero.`,
      );
    }
    if (!motivo || !motivo.trim()) {
      throw new Error('El motivo de cancelación es obligatorio.');
    }

    await updateDoc(doc(db, EVENTOS_COLL, eventoId), {
      estado: 'cancelado',
      motivoCancelacion: motivo,
      canceladoPor: userId,
      fechaCancelacion: serverTimestamp(),
    });
    logger.info(`Evento ${evento.codigo} cancelado por ${userId} · motivo: ${motivo}`);
  },
};

// ═════════════════════════════════════════════════════════════════════════
// HELPER · validar configuración recaudadora (uso externo)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Valida que una recaudadora esté correctamente configurada para operar:
 *   - tipoProducto = 'caja_recaudadora'
 *   - responsableTercero presente
 *   - tarifaServicio presente
 *   - cuentaLiquidacionDefaultId presente
 *   - canalesAceptados >= 1 activo · cada canal válido
 *
 * Retorna null si OK · string con error si hay inconsistencia.
 * Útil pre-creación o pre-edición del wizard CajaRecaudadoraPaso2DatosTercero.
 */
export function validarConfigRecaudadora(
  pf: Partial<ProductoFinanciero>,
): string | null {
  if (pf.tipoProducto !== 'caja_recaudadora') {
    return 'Esta validación solo aplica a productos con tipoProducto="caja_recaudadora".';
  }
  if (!pf.responsableTerceroId || !pf.responsableTerceroNombre) {
    return 'Falta configurar el responsable tercero de la recaudadora.';
  }
  if (!pf.tarifaServicio) {
    return 'Falta configurar la tarifa de servicio del recaudador.';
  }
  if (pf.tarifaServicio.valor <= 0) {
    return 'La tarifa de servicio debe ser mayor a 0.';
  }
  if (!pf.cuentaLiquidacionDefaultId) {
    return 'Falta configurar la cuenta destino de liquidación.';
  }
  if (!pf.canalesAceptados || pf.canalesAceptados.length === 0) {
    return 'Debe haber al menos 1 canal aceptado configurado.';
  }
  const errCanales = validarCanalesAceptados(pf.canalesAceptados);
  if (errCanales) return errCanales;

  return null;
}
