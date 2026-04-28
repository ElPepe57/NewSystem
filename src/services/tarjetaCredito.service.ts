import {
  collection, addDoc, getDocs, getDoc, doc, updateDoc,
  query, where, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import type {
  TarjetaCredito, TarjetaCreditoFormData, CargoTarjeta
} from '../types/tarjetaCredito.types';

const COLL = COLLECTIONS.TARJETAS_CREDITO;

async function generarCodigo(): Promise<string> {
  return getNextSequenceNumber('TC', 3);
}

export const tarjetaCreditoService = {
  async getAll(): Promise<TarjetaCredito[]> {
    const q = query(collection(db, COLL), orderBy('nombre', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as TarjetaCredito));
  },

  async getById(id: string): Promise<TarjetaCredito | null> {
    const ref = doc(db, COLL, id);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } as TarjetaCredito : null;
  },

  async getActivas(): Promise<TarjetaCredito[]> {
    const q = query(collection(db, COLL), where('activa', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as TarjetaCredito));
  },

  async crear(data: TarjetaCreditoFormData, userId: string): Promise<string> {
    const codigo = await generarCodigo();

    const nuevoDoc: Record<string, unknown> = {
      codigo,
      nombre: data.nombre,
      banco: data.banco,
      ultimosDigitos: data.ultimosDigitos,
      moneda: data.moneda,
      // Legacy v1 (mantener para retrocompat con UI v1)
      limiteUSD: data.limiteUSD ?? 0,
      saldoActualUSD: 0,
      disponibleUSD: data.limiteUSD ?? 0,
      diaCorte: data.diaCorte,
      diaPago: data.diaPago,
      activa: data.activa,
      creadoPor: userId,
      fechaCreacion: Timestamp.now(),
    };

    // Campos v2 (S58d) — solo si están presentes
    if (data.bancoNombreCompleto) nuevoDoc.bancoNombreCompleto = data.bancoNombreCompleto;
    if (data.marca) nuevoDoc.marca = data.marca;
    if (data.esBiMoneda !== undefined) nuevoDoc.esBiMoneda = data.esBiMoneda;
    if (data.titularidad) nuevoDoc.titularidad = data.titularidad;
    if (data.titularEntidadId) nuevoDoc.titularEntidadId = data.titularEntidadId;
    if (data.titularEntidadTipo)
      nuevoDoc.titularEntidadTipo = data.titularEntidadTipo;
    if (data.titularNombre) nuevoDoc.titularNombre = data.titularNombre;
    if (data.topeControlUSD !== undefined && data.topeControlUSD > 0)
      nuevoDoc.topeControlUSD = data.topeControlUSD;
    if (data.topeControlPEN !== undefined && data.topeControlPEN > 0)
      nuevoDoc.topeControlPEN = data.topeControlPEN;
    if (data.cuentaPagoDefaultId)
      nuevoDoc.cuentaPagoDefaultId = data.cuentaPagoDefaultId;

    const docRef = await addDoc(collection(db, COLL), nuevoDoc);
    logger.success(`Tarjeta ${codigo} creada: ${data.nombre}`);
    return docRef.id;
  },

  async actualizar(id: string, data: Partial<TarjetaCreditoFormData>, userId: string): Promise<void> {
    const ref = doc(db, COLL, id);
    await updateDoc(ref, {
      ...data,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });
  },

  /**
   * Registra un cargo a la tarjeta (compra = pasivo)
   */
  async registrarCargo(
    tarjetaId: string,
    montoUSD: number,
    tcDelDia: number,
    descripcion: string,
    userId: string,
    ordenCompraId?: string
  ): Promise<void> {
    const tarjeta = await this.getById(tarjetaId);
    if (!tarjeta) throw new Error('Tarjeta no encontrada');

    const nuevoSaldo = tarjeta.saldoActualUSD + montoUSD;
    if (nuevoSaldo > tarjeta.limiteUSD) {
      throw new Error(`Cargo excede limite de tarjeta: $${nuevoSaldo.toFixed(2)} > $${tarjeta.limiteUSD.toFixed(2)}`);
    }

    const ref = doc(db, COLL, tarjetaId);
    await updateDoc(ref, {
      saldoActualUSD: nuevoSaldo,
      disponibleUSD: tarjeta.limiteUSD - nuevoSaldo,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });

    logger.info(`Tarjeta ${tarjeta.codigo}: cargo $${montoUSD.toFixed(2)} (saldo: $${nuevoSaldo.toFixed(2)})`);
  },

  /**
   * Registra pago al banco (reduce pasivo, genera diferencial cambiario)
   */
  async registrarPago(
    tarjetaId: string,
    montoUSD: number,
    tcPago: number,
    userId: string
  ): Promise<{ diferencialCambiarioPEN: number }> {
    const tarjeta = await this.getById(tarjetaId);
    if (!tarjeta) throw new Error('Tarjeta no encontrada');

    if (montoUSD > tarjeta.saldoActualUSD) {
      throw new Error(`Pago excede saldo: $${montoUSD.toFixed(2)} > $${tarjeta.saldoActualUSD.toFixed(2)}`);
    }

    const nuevoSaldo = tarjeta.saldoActualUSD - montoUSD;
    const ref = doc(db, COLL, tarjetaId);
    await updateDoc(ref, {
      saldoActualUSD: nuevoSaldo,
      disponibleUSD: tarjeta.limiteUSD - nuevoSaldo,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });

    // El diferencial cambiario se calculara cuando se integre con tesoreria
    // Por ahora retornamos 0
    logger.info(`Tarjeta ${tarjeta.codigo}: pago $${montoUSD.toFixed(2)} (saldo: $${nuevoSaldo.toFixed(2)})`);

    return { diferencialCambiarioPEN: 0 };
  },
};
