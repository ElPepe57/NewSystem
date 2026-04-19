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
    // S42c fix — Firestore rechaza `undefined` en updateDoc. Omitimos los campos
    // con ese valor en lugar de propagarlos (defensa contra callers que pasan
    // `campo: form.x || undefined` sin darse cuenta del side-effect).
    const updateData: Record<string, unknown> = {
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    };
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) updateData[key] = value;
    }
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

  /** Obtiene transportistas_local activos (reemplaza transportistaService.getActivos) */
  async getTransportistasActivos(): Promise<Colaborador[]> {
    const q = query(
      collection(db, COLL),
      where('tipo', '==', 'transportista_local'),
      where('estado', '==', 'activo')
    );
    const snap = await getDocs(q);
    const resultado = snap.docs.map(d => ({ id: d.id, ...d.data() } as Colaborador));
    return resultado.sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  /**
   * Actualiza las metricas de un transportista_local despues de una entrega.
   * Equivale a transportistaService.registrarEntrega.
   */
  async registrarEntrega(
    colaboradorId: string,
    exitosa: boolean,
    tiempoMinutos: number,
    costo: number,
    zona?: string
  ): Promise<void> {
    const colaborador = await this.getById(colaboradorId);
    if (!colaborador) return;

    const m = colaborador.metricas || {
      enviosRealizados: 0,
      enviosCompletados: 0,
      enviosConIncidencia: 0,
      tasaIncidencias: 0,
      unidadesTransportadas: 0,
      tiempoPromedioEntregaDias: 0,
    };

    const totalEntregas = (m.totalEntregas || 0) + 1;
    const entregasExitosas = (m.entregasExitosas || 0) + (exitosa ? 1 : 0);
    const entregasFallidas = (m.entregasFallidas || 0) + (exitosa ? 0 : 1);
    const tasaExito = totalEntregas > 0 ? (entregasExitosas / totalEntregas) * 100 : 0;

    const tiempoAnterior = m.tiempoPromedioEntrega || 0;
    const tiempoPromedioEntrega = ((tiempoAnterior * (totalEntregas - 1)) + tiempoMinutos) / totalEntregas;

    const costoTotalHistorico = ((colaborador as unknown as Record<string, unknown>).costoTotalHistorico as number || 0) + costo;
    const costoPromedioPorEntrega = costoTotalHistorico / totalEntregas;

    let zonasAtendidas = m.zonasAtendidas || [];
    if (zona && !zonasAtendidas.includes(zona)) {
      zonasAtendidas = [...zonasAtendidas, zona];
    }

    const ref = doc(db, COLL, colaboradorId);
    await updateDoc(ref, {
      'metricas.totalEntregas': totalEntregas,
      'metricas.entregasExitosas': entregasExitosas,
      'metricas.entregasFallidas': entregasFallidas,
      'metricas.tasaExito': tasaExito,
      'metricas.tiempoPromedioEntrega': tiempoPromedioEntrega,
      'metricas.costoPromedioPorEntrega': costoPromedioPorEntrega,
      'metricas.zonasAtendidas': zonasAtendidas,
      costoTotalHistorico,
      fechaUltimaEntrega: Timestamp.now(),
    });
  },
};
