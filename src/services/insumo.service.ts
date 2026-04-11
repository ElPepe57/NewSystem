import {
  collection, addDoc, getDocs, getDoc, doc, updateDoc,
  query, where, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import type { Insumo, InsumoFormData, MovimientoInsumo } from '../types/insumo.types';

const COLL = COLLECTIONS.INSUMOS;

async function generarCodigo(): Promise<string> {
  return getNextSequenceNumber('INS', 3);
}

export const insumoService = {
  async getAll(): Promise<Insumo[]> {
    const q = query(collection(db, COLL), orderBy('nombre', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Insumo));
  },

  async getById(id: string): Promise<Insumo | null> {
    const ref = doc(db, COLL, id);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } as Insumo : null;
  },

  async getActivos(): Promise<Insumo[]> {
    const q = query(collection(db, COLL), where('activo', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Insumo));
  },

  async crear(data: InsumoFormData, userId: string): Promise<string> {
    const codigo = await generarCodigo();

    const nuevoDoc: Record<string, unknown> = {
      codigo,
      nombre: data.nombre,
      tipo: data.tipo,
      unidadMedida: data.unidadMedida,
      stockActual: 0,
      stockMinimo: data.stockMinimo,
      costoUnitarioPEN: data.costoUnitarioPEN,
      activo: data.activo,
      creadoPor: userId,
      fechaCreacion: Timestamp.now(),
    };

    if (data.proveedorNombre) nuevoDoc.proveedorNombre = data.proveedorNombre;
    if (data.proveedorContacto) nuevoDoc.proveedorContacto = data.proveedorContacto;

    const docRef = await addDoc(collection(db, COLL), nuevoDoc);
    logger.success(`Insumo ${codigo} creado: ${data.nombre}`);
    return docRef.id;
  },

  async actualizar(id: string, data: Partial<InsumoFormData>, userId: string): Promise<void> {
    const ref = doc(db, COLL, id);
    await updateDoc(ref, {
      ...data,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });
  },

  /**
   * Registra entrada de stock (compra de insumos)
   */
  async registrarEntrada(insumoId: string, cantidad: number, costoUnitarioPEN: number, userId: string): Promise<void> {
    const insumo = await this.getById(insumoId);
    if (!insumo) throw new Error('Insumo no encontrado');

    const nuevoStock = insumo.stockActual + cantidad;
    const ref = doc(db, COLL, insumoId);
    await updateDoc(ref, {
      stockActual: nuevoStock,
      costoUnitarioPEN, // actualizar costo al ultimo precio
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });

    logger.info(`Insumo ${insumo.codigo}: +${cantidad} unidades (stock: ${nuevoStock})`);
  },

  /**
   * Registra salida de stock (consumo por kit o ajuste)
   */
  async registrarSalida(insumoId: string, cantidad: number, motivo: string, userId: string): Promise<void> {
    const insumo = await this.getById(insumoId);
    if (!insumo) throw new Error('Insumo no encontrado');

    if (insumo.stockActual < cantidad) {
      throw new Error(`Stock insuficiente de ${insumo.nombre}: ${insumo.stockActual} disponibles, ${cantidad} solicitados`);
    }

    const nuevoStock = insumo.stockActual - cantidad;
    const ref = doc(db, COLL, insumoId);
    await updateDoc(ref, {
      stockActual: nuevoStock,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });

    logger.info(`Insumo ${insumo.codigo}: -${cantidad} (${motivo}) (stock: ${nuevoStock})`);
  },

  /**
   * Obtener insumos con stock bajo (por debajo del minimo)
   */
  async getConStockBajo(): Promise<Insumo[]> {
    const activos = await this.getActivos();
    return activos.filter(i => i.stockActual < i.stockMinimo);
  },
};
