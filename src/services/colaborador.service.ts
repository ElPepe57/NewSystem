import {
  collection, addDoc, getDocs, getDoc, doc, updateDoc,
  query, where, orderBy, Timestamp, writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import type {
  Colaborador, ColaboradorFormData, TipoColaborador
} from '../types/colaborador.types';

const COLL = COLLECTIONS.COLABORADORES;

async function generarCodigo(): Promise<string> {
  return getNextSequenceNumber('COL', 3);
}

export const colaboradorService = {
  async getAll(): Promise<Colaborador[]> {
    const q = query(collection(db, COLL), orderBy('nombre', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Colaborador));
  },

  async getById(id: string): Promise<Colaborador | null> {
    const ref = doc(db, COLL, id);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } as Colaborador : null;
  },

  async getByTipo(tipo: TipoColaborador): Promise<Colaborador[]> {
    const q = query(collection(db, COLL), where('tipo', '==', tipo));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Colaborador));
  },

  async crear(data: ColaboradorFormData, userId: string): Promise<string> {
    const codigo = await generarCodigo();

    const nuevoDoc: Record<string, unknown> = {
      codigo,
      nombre: data.nombre,
      tipo: data.tipo,
      estado: data.estado,
      pais: data.pais,
      metricas: {
        enviosRealizados: 0,
        enviosCompletados: 0,
        enviosConIncidencia: 0,
        tasaIncidencias: 0,
        unidadesTransportadas: 0,
        tiempoPromedioEntregaDias: 0,
      },
      creadoPor: userId,
      fechaCreacion: Timestamp.now(),
    };

    // Campos opcionales
    if (data.telefono) nuevoDoc.telefono = data.telefono;
    if (data.email) nuevoDoc.email = data.email;
    if (data.whatsapp) nuevoDoc.whatsapp = data.whatsapp;
    if (data.ciudad) nuevoDoc.ciudad = data.ciudad;
    if (data.direccion) nuevoDoc.direccion = data.direccion;
    if (data.tarifas) nuevoDoc.tarifas = data.tarifas;
    if (data.frecuenciaViaje) nuevoDoc.frecuenciaViaje = data.frecuenciaViaje;
    if (data.notas) nuevoDoc.notas = data.notas;

    const docRef = await addDoc(collection(db, COLL), nuevoDoc);
    logger.success(`Colaborador ${codigo} creado: ${data.nombre}`);
    return docRef.id;
  },

  async actualizar(id: string, data: Partial<ColaboradorFormData>, userId: string): Promise<void> {
    const ref = doc(db, COLL, id);
    const updateData: Record<string, unknown> = {
      ...data,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    };
    await updateDoc(ref, updateData);
  },

  async getViajeros(): Promise<Colaborador[]> {
    return this.getByTipo('viajero');
  },

  async getCouriers(): Promise<Colaborador[]> {
    return this.getByTipo('courier_externo');
  },

  async getEmpresa(): Promise<Colaborador | null> {
    const empresas = await this.getByTipo('empresa');
    return empresas[0] || null;
  },
};
