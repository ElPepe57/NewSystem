/**
 * casilla.crud.service.ts
 *
 * CRUD para la colección 'casillas' (modelo nuevo — Acuerdos 13-15 S32).
 * Cada casilla pertenece a un Colaborador (viajero, courier, empresa).
 */

import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc,
  query, where, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import { logger } from '../lib/logger';
import type { Casilla, CasillaFormData } from '../types/casilla.types';

const COLL = COLLECTIONS.CASILLAS;

async function generarCodigoCasilla(): Promise<string> {
  return getNextSequenceNumber('CAS', 3);
}

export const casillaCrudService = {
  async getAll(): Promise<Casilla[]> {
    const q = query(collection(db, COLL), orderBy('nombre', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Casilla));
  },

  async getById(id: string): Promise<Casilla | null> {
    const ref = doc(db, COLL, id);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } as Casilla : null;
  },

  async getByColaboradorId(colaboradorId: string): Promise<Casilla[]> {
    const q = query(
      collection(db, COLL),
      where('colaboradorId', '==', colaboradorId),
      where('estado', '==', 'activa')
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Casilla))
      .sort((a, b) => (b.esPrincipal ? 1 : 0) - (a.esPrincipal ? 1 : 0));
  },

  async getCasillaPrincipal(colaboradorId: string): Promise<Casilla | null> {
    const casillas = await this.getByColaboradorId(colaboradorId);
    return casillas.find(c => c.esPrincipal) || casillas[0] || null;
  },

  async crear(data: CasillaFormData, userId: string): Promise<string> {
    const codigo = await generarCodigoCasilla();
    const now = Timestamp.now();

    const nuevaCasilla: Record<string, unknown> = {
      codigo,
      nombre: data.nombre,
      tipo: data.tipo,
      estado: data.estado || 'activa',
      pais: data.pais,
      colaboradorId: data.colaboradorId,
      esPrincipal: data.esPrincipal ?? false,
      totalUnidadesRecibidas: 0,
      totalUnidadesEnviadas: 0,
      valorInventarioUSD: 0,
      unidadesActuales: 0,
      creadoPor: userId,
      fechaCreacion: now,
    };

    // Campos opcionales
    if (data.colaboradorId) {
      // Desnormalizar nombre del colaborador
      const { colaboradorService } = await import('./colaborador.service');
      const colab = await colaboradorService.getById(data.colaboradorId);
      if (colab) nuevaCasilla.colaboradorNombre = colab.nombre;
    }
    if (data.direccion) nuevaCasilla.direccion = data.direccion;
    if (data.ciudad) nuevaCasilla.ciudad = data.ciudad;
    if (data.codigoPostal) nuevaCasilla.codigoPostal = data.codigoPostal;
    if (data.capacidadUnidades) nuevaCasilla.capacidadUnidades = data.capacidadUnidades;
    if (data.notas) nuevaCasilla.notas = data.notas;

    const ref = await addDoc(collection(db, COLL), nuevaCasilla);
    logger.success(`Casilla ${codigo} creada para colaborador ${nuevaCasilla.colaboradorNombre || data.colaboradorId}`);
    return ref.id;
  },

  async actualizar(id: string, data: Partial<CasillaFormData>, userId: string): Promise<void> {
    // S42c fix — defensa contra `undefined` en payload (Firestore lo rechaza).
    const updates: Record<string, unknown> = {
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    };
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) updates[key] = value;
    }
    await updateDoc(doc(db, COLL, id), updates);
  },

  // ── Métricas ──

  async incrementarUnidadesRecibidas(casillaId: string, cantidad: number): Promise<void> {
    const casilla = await this.getById(casillaId);
    if (!casilla) return;
    await updateDoc(doc(db, COLL, casillaId), {
      totalUnidadesRecibidas: (casilla.totalUnidadesRecibidas || 0) + cantidad,
      unidadesActuales: (casilla.unidadesActuales || 0) + cantidad,
    });
  },

  async incrementarUnidadesEnviadas(casillaId: string, cantidad: number): Promise<void> {
    const casilla = await this.getById(casillaId);
    if (!casilla) return;
    await updateDoc(doc(db, COLL, casillaId), {
      totalUnidadesEnviadas: (casilla.totalUnidadesEnviadas || 0) + cantidad,
      unidadesActuales: Math.max(0, (casilla.unidadesActuales || 0) - cantidad),
    });
  },

  async actualizarValorInventario(casillaId: string, valorUSD: number): Promise<void> {
    const casilla = await this.getById(casillaId);
    if (!casilla) return;
    await updateDoc(doc(db, COLL, casillaId), {
      valorInventarioUSD: (casilla.valorInventarioUSD || 0) + valorUSD,
    });
  },
};
