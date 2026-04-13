import {
  collection, addDoc, getDocs, getDoc, doc, updateDoc,
  query, where, orderBy, Timestamp, writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import type {
  Envio, EnvioFormData, EnvioFiltros, EnvioUnidad,
  EstadoEnvio, CostoLanded, RecepcionEnvio
} from '../types/envio.types';

const COLL = COLLECTIONS.ENVIOS;
const UNIDADES_COLL = COLLECTIONS.UNIDADES;

async function generarNumeroEnvio(): Promise<string> {
  const year = new Date().getFullYear();
  return getNextSequenceNumber(`ENV-${year}`, 3);
}

export const envioCrudService = {
  async getAll(): Promise<Envio[]> {
    const q = query(collection(db, COLL), orderBy('fechaCreacion', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Envio));
  },

  async getById(id: string): Promise<Envio | null> {
    const ref = doc(db, COLL, id);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } as Envio : null;
  },

  async getByOrdenCompra(ordenCompraId: string): Promise<Envio[]> {
    const q = query(collection(db, COLL), where('ordenCompraId', '==', ordenCompraId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Envio));
  },

  async getByFiltros(filtros: EnvioFiltros): Promise<Envio[]> {
    let q = query(collection(db, COLL));

    if (filtros.estado) q = query(q, where('estado', '==', filtros.estado));
    if (filtros.origenTipo) q = query(q, where('origenTipo', '==', filtros.origenTipo));
    if (filtros.colaboradorId) q = query(q, where('colaboradorId', '==', filtros.colaboradorId));
    if (filtros.ordenCompraId) q = query(q, where('ordenCompraId', '==', filtros.ordenCompraId));
    if (filtros.destinoCasillaId) q = query(q, where('destinoCasillaId', '==', filtros.destinoCasillaId));

    const snap = await getDocs(q);
    let envios = snap.docs.map(d => ({ id: d.id, ...d.data() } as Envio));

    // Filtros en memoria
    if (filtros.fechaDesde) {
      const desde = Timestamp.fromDate(filtros.fechaDesde);
      envios = envios.filter(e => e.fechaCreacion.toMillis() >= desde.toMillis());
    }
    if (filtros.fechaHasta) {
      const hasta = Timestamp.fromDate(filtros.fechaHasta);
      envios = envios.filter(e => e.fechaCreacion.toMillis() <= hasta.toMillis());
    }

    return envios.sort((a, b) => b.fechaCreacion.toMillis() - a.fechaCreacion.toMillis());
  },

  /**
   * Crea un envio nuevo (T1 desde OC o manual entre casillas)
   */
  async crear(data: EnvioFormData, userId: string): Promise<{ id: string; numeroEnvio: string }> {
    const numeroEnvio = await generarNumeroEnvio();
    const now = Timestamp.now();

    const nuevoEnvio: Record<string, unknown> = {
      numeroEnvio,
      estado: 'borrador' as EstadoEnvio,
      origenTipo: data.origenTipo,

      // Destino
      destinoCasillaId: data.destinoCasillaId,

      // Unidades
      unidades: data.unidadesDetalle || [],
      totalUnidades: data.unidadesDetalle?.length || 0,
      productosSummary: [],

      // Costos landed (vacios, se agregan despues)
      costosLanded: [],
      costoLandedTotalPEN: 0,

      // Auditoria
      creadoPor: userId,
      fechaCreacion: now,
    };

    // Origen
    if (data.origenTipo === 'proveedor' && data.origenProveedorId) {
      nuevoEnvio.origenProveedorId = data.origenProveedorId;
    } else if (data.origenTipo === 'casilla' && data.origenCasillaId) {
      nuevoEnvio.origenCasillaId = data.origenCasillaId;
    }

    // Colaborador transportador
    if (data.colaboradorId) nuevoEnvio.colaboradorId = data.colaboradorId;

    // Vinculo OC
    if (data.ordenCompraId) nuevoEnvio.ordenCompraId = data.ordenCompraId;
    if (data.subOrdenId) nuevoEnvio.subOrdenId = data.subOrdenId;

    // Tracking
    if (data.numeroTracking) nuevoEnvio.numeroTracking = data.numeroTracking;
    if (data.courier) nuevoEnvio.courier = data.courier;
    if (data.fechaLlegadaEstimada) nuevoEnvio.fechaLlegadaEstimada = Timestamp.fromDate(data.fechaLlegadaEstimada);
    if (data.notas) nuevoEnvio.notas = data.notas;

    const docRef = await addDoc(collection(db, COLL), nuevoEnvio);
    logger.success(`Envio ${numeroEnvio} creado`);
    return { id: docRef.id, numeroEnvio };
  },

  /**
   * Agrega un costo landed al envio
   */
  async agregarCostoLanded(envioId: string, costo: Omit<CostoLanded, 'id' | 'creadoPor' | 'fechaCreacion'>, userId: string): Promise<void> {
    const envio = await this.getById(envioId);
    if (!envio) throw new Error('Envio no encontrado');

    const nuevoCosto: CostoLanded = {
      ...costo,
      id: `CL-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      creadoPor: userId,
      fechaCreacion: Timestamp.now(),
    };

    const costosActualizados = [...envio.costosLanded, nuevoCosto];
    const totalPEN = costosActualizados.reduce((sum, c) => sum + c.montoPEN, 0);

    const ref = doc(db, COLL, envioId);
    await updateDoc(ref, {
      costosLanded: costosActualizados,
      costoLandedTotalPEN: totalPEN,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });

    logger.info(`Costo landed agregado a envio ${envio.numeroEnvio}: ${costo.categoriaCostoNombre} S/${costo.montoPEN.toFixed(2)}`);
  },

  /**
   * Confirma el envio (borrador → confirmado)
   */
  async confirmar(envioId: string, userId: string): Promise<void> {
    const envio = await this.getById(envioId);
    if (!envio) throw new Error('Envio no encontrado');
    if (envio.estado !== 'borrador') throw new Error('Solo se pueden confirmar envios en borrador');

    const ref = doc(db, COLL, envioId);
    await updateDoc(ref, {
      estado: 'confirmado' as EstadoEnvio,
      fechaConfirmacion: Timestamp.now(),
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });
  },

  /**
   * Marca el envio como en transito
   */
  async enviar(envioId: string, datos: { numeroTracking?: string; fechaSalida?: Date }, userId: string): Promise<void> {
    const envio = await this.getById(envioId);
    if (!envio) throw new Error('Envio no encontrado');
    if (envio.estado !== 'confirmado') throw new Error('Solo se pueden enviar envios confirmados');

    const now = Timestamp.now();
    const updateData: Record<string, unknown> = {
      estado: 'en_transito' as EstadoEnvio,
      fechaSalida: datos.fechaSalida ? Timestamp.fromDate(datos.fechaSalida) : now,
      actualizadoPor: userId,
      fechaActualizacion: now,
    };

    if (datos.numeroTracking) updateData.numeroTracking = datos.numeroTracking;

    // Actualizar estado de unidades en el envio a 'enviada'
    if (envio.unidades.length > 0) {
      updateData.unidades = envio.unidades.map(u => ({
        ...u,
        estadoEnvio: 'enviada',
      }));
    }

    const ref = doc(db, COLL, envioId);
    await updateDoc(ref, updateData);

    // Actualizar estado de unidades en Firestore a 'en_transito'
    if (envio.unidades.length > 0) {
      const batch = writeBatch(db);
      for (const u of envio.unidades) {
        batch.update(doc(db, UNIDADES_COLL, u.unidadId), {
          estado: 'en_transito',
          actualizadoPor: userId,
          fechaActualizacion: now,
        });
      }
      await batch.commit();
    }

    logger.success(`Envio ${envio.numeroEnvio} marcado como en transito`);
  },

  /**
   * Cancela un envio
   */
  async cancelar(envioId: string, motivo: string, userId: string): Promise<void> {
    const envio = await this.getById(envioId);
    if (!envio) throw new Error('Envio no encontrado');

    const cancelables: EstadoEnvio[] = ['borrador', 'confirmado'];
    if (!cancelables.includes(envio.estado)) {
      throw new Error('Solo se pueden cancelar envios en borrador o confirmados');
    }

    const ref = doc(db, COLL, envioId);
    await updateDoc(ref, {
      estado: 'cancelada' as EstadoEnvio,
      notas: `${envio.notas || ''}\n[CANCELADO] ${motivo}`.trim(),
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });
  },

  async getEnTransito(): Promise<Envio[]> {
    return this.getByFiltros({ estado: 'en_transito' });
  },

  async getPendientesRecepcion(): Promise<Envio[]> {
    const q = query(collection(db, COLL), where('estado', 'in', ['en_transito', 'recibida_parcial']));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Envio));
  },
};
