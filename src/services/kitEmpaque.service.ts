import {
  collection, addDoc, getDocs, getDoc, doc, updateDoc,
  query, where, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import { insumoService } from './insumo.service';
import type { KitEmpaque, KitEmpaqueFormData } from '../types/kitEmpaque.types';

const COLL = COLLECTIONS.KITS_EMPAQUE;

async function generarCodigo(): Promise<string> {
  return getNextSequenceNumber('KIT', 3);
}

export const kitEmpaqueService = {
  async getAll(): Promise<KitEmpaque[]> {
    const q = query(collection(db, COLL), orderBy('pesoMinLb', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as KitEmpaque));
  },

  async getById(id: string): Promise<KitEmpaque | null> {
    const ref = doc(db, COLL, id);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } as KitEmpaque : null;
  },

  /**
   * Selecciona el kit correcto segun el peso del despacho
   */
  async seleccionarPorPeso(pesoLb: number): Promise<KitEmpaque | null> {
    const todos = await this.getAll();
    const activos = todos.filter(k => k.activo);

    // Buscar el kit cuyo rango de peso incluye el peso dado
    const kit = activos.find(k => pesoLb >= k.pesoMinLb && pesoLb <= k.pesoMaxLb);
    if (kit) return kit;

    // Si no hay rango exacto, usar el kit mas grande
    const masGrande = activos[activos.length - 1];
    return masGrande || null;
  },

  async crear(data: KitEmpaqueFormData, userId: string): Promise<string> {
    const codigo = await generarCodigo();

    // Calcular costo total del kit
    let costoTotalPEN = 0;
    const componentesConDatos = [];

    for (const comp of data.componentes) {
      const insumo = await insumoService.getById(comp.insumoId);
      if (!insumo) throw new Error(`Insumo ${comp.insumoId} no encontrado`);

      costoTotalPEN += insumo.costoUnitarioPEN * comp.cantidad;
      componentesConDatos.push({
        insumoId: comp.insumoId,
        insumoNombre: insumo.nombre,
        cantidad: comp.cantidad,
        costoUnitarioPEN: insumo.costoUnitarioPEN,
      });
    }

    const nuevoDoc: Record<string, unknown> = {
      codigo,
      nombre: data.nombre,
      pesoMinLb: data.pesoMinLb,
      pesoMaxLb: data.pesoMaxLb,
      componentes: componentesConDatos,
      costoTotalPEN: Math.round(costoTotalPEN * 100) / 100,
      activo: data.activo,
      creadoPor: userId,
      fechaCreacion: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, COLL), nuevoDoc);
    logger.success(`Kit ${codigo} creado: ${data.nombre} (S/${costoTotalPEN.toFixed(2)})`);
    return docRef.id;
  },

  async actualizar(id: string, data: Partial<KitEmpaqueFormData>, userId: string): Promise<void> {
    const ref = doc(db, COLL, id);
    await updateDoc(ref, {
      ...data,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });
  },

  /**
   * Consume insumos del kit al despachar una venta.
   * Resta stock de cada insumo componente.
   */
  async consumirKit(kitId: string, userId: string): Promise<number> {
    const kit = await this.getById(kitId);
    if (!kit) throw new Error('Kit no encontrado');

    for (const comp of kit.componentes) {
      await insumoService.registrarSalida(
        comp.insumoId,
        comp.cantidad,
        `Consumo kit ${kit.codigo}`,
        userId
      );
    }

    logger.info(`Kit ${kit.codigo} consumido (${kit.componentes.length} insumos)`);
    return kit.costoTotalPEN;
  },
};
