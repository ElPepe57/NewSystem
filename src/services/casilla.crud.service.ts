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

  /**
   * Cuenta las unidades 'disponible' por casilla, derivado de las UNIDADES REALES.
   * Fuente ÚNICA de verdad para "X uds disponibles" — evita confiar en el contador
   * denormalizado `unidadesActuales`, que se desincroniza (ej. al borrar unidades de
   * prueba sin pasar por el flujo de despacho → quedaba un "20 fantasma"). chk5.ENVIOS-CONTADOR.
   *
   * Misma regla que el selector de unidades del wizard (SeccionUnidades):
   * estado === 'disponible' · ubicación = casillaActualId (o el legacy almacenId).
   */
  async contarDisponiblesPorCasilla(): Promise<Record<string, number>> {
    const q = query(
      collection(db, COLLECTIONS.UNIDADES),
      where('estado', '==', 'disponible')
    );
    const snap = await getDocs(q);
    const conteo: Record<string, number> = {};
    snap.docs.forEach(d => {
      const data = d.data() as { casillaActualId?: string; almacenId?: string };
      const ubic = data.casillaActualId || data.almacenId;
      if (ubic) conteo[ubic] = (conteo[ubic] ?? 0) + 1;
    });
    return conteo;
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

  /**
   * Casillas de tipo viajero (la UBICACIÓN temporal de un viajero · ej. la casa de
   * Angie en California). El "viajero" como persona es el Colaborador dueño (colaboradorId);
   * esta casilla es solo su ubicación de acopio.
   *
   * Reemplaza almacenService.getViajeros(), que filtraba por los campos legacy
   * `esViajero`/`estadoAlmacen` — ausentes en las casillas nuevas (usan `tipo`/`estado`),
   * por lo que devolvía vacío para todo dato creado por el flujo actual. chk5.ENVIOS-UNIF.
   *
   * Un solo `where` sobre `tipo` (índice de campo único · sin índice compuesto) + filtro
   * de estado en memoria. Conteo en vivo (fuente única de verdad), no el contador denormalizado.
   */
  async getViajeros(): Promise<Casilla[]> {
    const q = query(collection(db, COLL), where('tipo', '==', 'casilla_viajero'));
    const [snap, conteo] = await Promise.all([
      getDocs(q),
      this.contarDisponiblesPorCasilla(),
    ]);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Casilla))
      .filter(c => c.estado === 'activa')
      .map(c => ({ ...c, unidadesActuales: conteo[c.id] ?? 0 }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
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
    if ((data as any).coordenadas) nuevaCasilla.coordenadas = (data as any).coordenadas;
    if (data.capacidadUnidades) nuevaCasilla.capacidadUnidades = data.capacidadUnidades;
    if (data.notas) nuevaCasilla.notas = data.notas;

    // S42g — Colaboradores secundarios (casilla compartida): desnormalizar nombres
    if (data.colaboradoresSecundariosIds && data.colaboradoresSecundariosIds.length > 0) {
      const { colaboradorService } = await import('./colaborador.service');
      const nombres: string[] = [];
      for (const cid of data.colaboradoresSecundariosIds) {
        const col = await colaboradorService.getById(cid);
        nombres.push(col?.nombre ?? cid);
      }
      nuevaCasilla.colaboradoresSecundariosIds = data.colaboradoresSecundariosIds;
      nuevaCasilla.colaboradoresSecundariosNombres = nombres;
    }

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

    // S42g — Si cambiaron los colaboradores secundarios, re-desnormalizar nombres
    if (data.colaboradoresSecundariosIds !== undefined) {
      const ids = data.colaboradoresSecundariosIds || [];
      if (ids.length > 0) {
        const { colaboradorService } = await import('./colaborador.service');
        const nombres: string[] = [];
        for (const cid of ids) {
          const col = await colaboradorService.getById(cid);
          nombres.push(col?.nombre ?? cid);
        }
        updates.colaboradoresSecundariosIds = ids;
        updates.colaboradoresSecundariosNombres = nombres;
      } else {
        // Array vacío → limpiar ambos campos
        updates.colaboradoresSecundariosIds = [];
        updates.colaboradoresSecundariosNombres = [];
      }
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
