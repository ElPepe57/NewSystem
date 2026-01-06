import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  Timestamp,
  increment
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import type {
  Almacen,
  AlmacenFormData,
  InventarioAlmacen,
  ResumenAlmacenesUSA,
  ClasificacionAlmacen,
  EvaluacionAlmacen,
  FactoresEvaluacionAlmacen,
  HistorialEvaluacionAlmacen,
  MetricasOperativasAlmacen
} from '../types/almacen.types';

const COLLECTION_NAME = 'almacenes';

/**
 * Genera el siguiente código de almacén automáticamente según el tipo
 * - Viajero: VIA-001, VIA-002...
 * - Almacén Perú: ALM-PE-001...
 */
async function generarCodigoAlmacen(tipo: 'viajero' | 'almacen_peru'): Promise<string> {
  const prefix = tipo === 'viajero' ? 'VIA' : 'ALM-PE';

  // Obtener todos los almacenes y encontrar el número máximo para este prefijo
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));

  let maxNumber = 0;
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    const codigo = data.codigo as string;

    // Verificar si el código comienza con el prefijo correcto
    if (codigo && codigo.startsWith(prefix)) {
      // Extraer el número del final (ej: VIA-001 -> 001, ALM-USA-001 -> 001)
      const match = codigo.match(/-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  });

  return `${prefix}-${String(maxNumber + 1).padStart(3, '0')}`;
}

export const almacenService = {
  // ============================================
  // CRUD BÁSICO
  // ============================================

  async getAll(): Promise<Almacen[]> {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const almacenes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Almacen));

    // Ordenar: primero viajeros, luego por país y nombre
    return almacenes.sort((a, b) => {
      // Viajeros primero
      if (a.esViajero !== b.esViajero) {
        return a.esViajero ? -1 : 1;
      }
      // Luego por país
      if (a.pais !== b.pais) {
        return a.pais.localeCompare(b.pais);
      }
      return a.nombre.localeCompare(b.nombre);
    });
  },

  async getById(id: string): Promise<Almacen | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    } as Almacen;
  },

  async getByCodigo(codigo: string): Promise<Almacen | null> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('codigo', '==', codigo)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const docSnap = snapshot.docs[0];
    return {
      id: docSnap.id,
      ...docSnap.data()
    } as Almacen;
  },

  async getByPais(pais: 'USA' | 'Peru'): Promise<Almacen[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('pais', '==', pais)
    );
    const snapshot = await getDocs(q);
    const almacenes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Almacen));

    return almacenes.sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  // ============================================
  // VIAJEROS (Almacenes USA tipo viajero)
  // ============================================

  /**
   * Obtiene todos los viajeros activos con inventario calculado desde unidades
   */
  async getViajeros(): Promise<Almacen[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('esViajero', '==', true),
      where('estadoAlmacen', '==', 'activo')
    );
    const snapshot = await getDocs(q);
    const viajeros = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Almacen));

    // Obtener IDs de viajeros
    const viajerosIds = viajeros.map(v => v.id);

    if (viajerosIds.length === 0) {
      return [];
    }

    // Obtener todas las unidades en estos viajeros
    const unidadesSnapshot = await getDocs(collection(db, 'unidades'));
    const unidadesPorAlmacen: Record<string, { cantidad: number; valor: number }> = {};

    unidadesSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      // Solo contar si pertenece a un viajero
      if (!viajerosIds.includes(data.almacenId)) return;
      // Solo contar unidades disponibles o sin estado definido (legacy)
      // Excluir solo las que claramente no están disponibles
      const estadosExcluidos = ['vendida', 'vencida', 'danada', 'en_transito_peru'];
      if (estadosExcluidos.includes(data.estado)) return;

      if (!unidadesPorAlmacen[data.almacenId]) {
        unidadesPorAlmacen[data.almacenId] = { cantidad: 0, valor: 0 };
      }
      unidadesPorAlmacen[data.almacenId].cantidad++;
      unidadesPorAlmacen[data.almacenId].valor += data.costoUnitarioUSD || 0;
    });

    // Enriquecer viajeros con datos de inventario
    const viajerosConInventario = viajeros.map(v => ({
      ...v,
      unidadesActuales: unidadesPorAlmacen[v.id]?.cantidad || 0,
      valorInventarioUSD: unidadesPorAlmacen[v.id]?.valor || 0
    }));

    return viajerosConInventario.sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  /**
   * Obtiene viajeros con próximo viaje programado
   */
  async getViajerosConProximoViaje(): Promise<Almacen[]> {
    const viajeros = await this.getViajeros();
    const hoy = new Date();

    return viajeros
      .filter(v => v.proximoViaje && v.proximoViaje.toDate() > hoy)
      .sort((a, b) => {
        if (!a.proximoViaje || !b.proximoViaje) return 0;
        return a.proximoViaje.toMillis() - b.proximoViaje.toMillis();
      });
  },

  // ============================================
  // ALMACENES USA (para recepción de OC)
  // ============================================

  /**
   * Obtiene todos los almacenes USA activos (viajeros + almacenes fijos) con inventario calculado
   */
  async getAlmacenesUSA(): Promise<Almacen[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('pais', '==', 'USA'),
      where('estadoAlmacen', '==', 'activo')
    );
    const snapshot = await getDocs(q);
    const almacenes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Almacen));

    // Obtener IDs de almacenes
    const almacenesIds = almacenes.map(a => a.id);

    if (almacenesIds.length === 0) {
      return [];
    }

    // Obtener todas las unidades en estos almacenes
    const unidadesSnapshot = await getDocs(collection(db, 'unidades'));
    const unidadesPorAlmacen: Record<string, { cantidad: number; valor: number }> = {};

    unidadesSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      // Solo contar si pertenece a un almacén USA
      if (!almacenesIds.includes(data.almacenId)) return;
      // Solo contar unidades disponibles (recibida_usa) o sin estado definido (legacy)
      // Excluir solo las que claramente no están disponibles
      const estadosExcluidos = ['vendida', 'vencida', 'danada', 'en_transito_peru'];
      if (estadosExcluidos.includes(data.estado)) return;

      if (!unidadesPorAlmacen[data.almacenId]) {
        unidadesPorAlmacen[data.almacenId] = { cantidad: 0, valor: 0 };
      }
      unidadesPorAlmacen[data.almacenId].cantidad++;
      unidadesPorAlmacen[data.almacenId].valor += data.costoUnitarioUSD || 0;
    });

    // Enriquecer almacenes con datos de inventario
    const almacenesConInventario = almacenes.map(a => ({
      ...a,
      unidadesActuales: unidadesPorAlmacen[a.id]?.cantidad || 0,
      valorInventarioUSD: unidadesPorAlmacen[a.id]?.valor || 0
    }));

    // Ordenar: viajeros primero, luego por nombre
    return almacenesConInventario.sort((a, b) => {
      if (a.esViajero !== b.esViajero) {
        return a.esViajero ? -1 : 1;
      }
      return a.nombre.localeCompare(b.nombre);
    });
  },

  /**
   * Obtiene almacenes Perú activos
   */
  async getAlmacenesPeru(): Promise<Almacen[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('pais', '==', 'Peru'),
      where('estadoAlmacen', '==', 'activo')
    );
    const snapshot = await getDocs(q);
    const almacenes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Almacen));

    return almacenes.sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  // ============================================
  // CREAR Y ACTUALIZAR
  // ============================================

  async create(data: AlmacenFormData, userId: string): Promise<string> {
    // Siempre generar código automático según el tipo
    const codigo = await generarCodigoAlmacen(data.tipo);

    const now = Timestamp.now();

    // Construir objeto base sin campos undefined
    const newAlmacen: Record<string, unknown> = {
      codigo,
      nombre: data.nombre,
      pais: data.pais,
      tipo: data.tipo,
      estadoAlmacen: data.estadoAlmacen,
      direccion: data.direccion,
      ciudad: data.ciudad,
      esViajero: data.esViajero,
      // Métricas iniciales en 0
      totalUnidadesRecibidas: 0,
      totalUnidadesEnviadas: 0,
      valorInventarioUSD: 0,
      tiempoPromedioAlmacenamiento: 0,
      unidadesActuales: 0,
      creadoPor: userId,
      fechaCreacion: now
    };

    // Agregar campos opcionales solo si tienen valor
    if (data.estado) newAlmacen.estado = data.estado;
    if (data.codigoPostal) newAlmacen.codigoPostal = data.codigoPostal;
    if (data.contacto) newAlmacen.contacto = data.contacto;
    if (data.telefono) newAlmacen.telefono = data.telefono;
    if (data.email) newAlmacen.email = data.email;
    if (data.whatsapp) newAlmacen.whatsapp = data.whatsapp;
    if (data.capacidadUnidades !== undefined) newAlmacen.capacidadUnidades = data.capacidadUnidades;
    if (data.frecuenciaViaje) newAlmacen.frecuenciaViaje = data.frecuenciaViaje;
    if (data.proximoViaje) newAlmacen.proximoViaje = Timestamp.fromDate(data.proximoViaje);
    if (data.costoPromedioFlete !== undefined) newAlmacen.costoPromedioFlete = data.costoPromedioFlete;
    if (data.notas) newAlmacen.notas = data.notas;

    const docRef = await addDoc(collection(db, COLLECTION_NAME), newAlmacen);
    return docRef.id;
  },

  async update(id: string, data: Partial<AlmacenFormData>, userId: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);

    // Filtrar campos undefined antes de enviar a Firestore
    const updateData: Record<string, unknown> = {
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now()
    };

    // Solo agregar campos que tienen valor definido
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'proximoViaje' && value instanceof Date) {
          updateData[key] = Timestamp.fromDate(value);
        } else {
          updateData[key] = value;
        }
      }
    });

    await updateDoc(docRef, updateData);
  },

  // ============================================
  // MÉTRICAS Y ESTADÍSTICAS
  // ============================================

  /**
   * Incrementa el contador de unidades recibidas
   */
  async incrementarUnidadesRecibidas(almacenId: string, cantidad: number): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, almacenId);
    await updateDoc(docRef, {
      totalUnidadesRecibidas: increment(cantidad),
      unidadesActuales: increment(cantidad)
    });
  },

  /**
   * Incrementa el contador de unidades enviadas (salen del almacén)
   */
  async incrementarUnidadesEnviadas(almacenId: string, cantidad: number): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, almacenId);
    await updateDoc(docRef, {
      totalUnidadesEnviadas: increment(cantidad),
      unidadesActuales: increment(-cantidad)
    });
  },

  /**
   * Actualiza el valor del inventario en un almacén
   */
  async actualizarValorInventario(almacenId: string, valorUSD: number): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, almacenId);
    await updateDoc(docRef, {
      valorInventarioUSD: valorUSD,
      fechaActualizacion: Timestamp.now()
    });
  },

  /**
   * Obtiene el resumen de inventario de un almacén específico
   * NOTA: Este método necesita datos de unidades, se completará con unidad.service
   */
  async getInventarioAlmacen(almacenId: string): Promise<InventarioAlmacen | null> {
    const almacen = await this.getById(almacenId);
    if (!almacen) return null;

    // Estructura base - los datos de unidades se llenan desde unidad.service
    return {
      almacenId: almacen.id,
      almacenNombre: almacen.nombre,
      almacenCodigo: almacen.codigo,
      pais: almacen.pais,
      esViajero: almacen.esViajero,
      totalUnidades: almacen.unidadesActuales || 0,
      unidadesDisponibles: 0,
      unidadesEnTransito: 0,
      valorTotalUSD: almacen.valorInventarioUSD || 0,
      valorTotalPEN: 0,
      tiempoPromedioAlmacenamiento: almacen.tiempoPromedioAlmacenamiento || 0,
      productosPorSKU: []
    };
  },

  /**
   * Recalcula el inventario de un almacén basándose en las unidades reales
   * Útil para sincronizar datos si hay inconsistencias
   */
  async recalcularInventarioAlmacen(almacenId: string): Promise<{ unidades: number; valorUSD: number }> {
    // Obtener todas las unidades de este almacén que están disponibles
    const unidadesSnapshot = await getDocs(
      query(
        collection(db, 'unidades'),
        where('almacenId', '==', almacenId)
      )
    );

    // Filtrar unidades disponibles (excluir las claramente no disponibles)
    const estadosExcluidos = ['vendida', 'vencida', 'danada', 'en_transito_peru'];
    const unidadesDisponibles = unidadesSnapshot.docs.filter(docSnap => {
      const estado = docSnap.data().estado;
      return !estadosExcluidos.includes(estado);
    });

    const totalUnidades = unidadesDisponibles.length;
    const valorTotalUSD = unidadesDisponibles.reduce(
      (sum, docSnap) => sum + (docSnap.data().costoUnitarioUSD || 0), 0
    );

    // Actualizar el almacén con los valores correctos
    const docRef = doc(db, COLLECTION_NAME, almacenId);
    await updateDoc(docRef, {
      unidadesActuales: totalUnidades,
      valorInventarioUSD: valorTotalUSD,
      fechaActualizacion: Timestamp.now()
    });

    return { unidades: totalUnidades, valorUSD: valorTotalUSD };
  },

  /**
   * Recalcula el inventario de TODOS los almacenes basándose en las unidades reales
   * Actualiza unidadesActuales y valorInventarioUSD en cada documento de almacén
   */
  async recalcularTodosLosAlmacenes(): Promise<{ almacenesActualizados: number; errores: string[] }> {
    const errores: string[] = [];
    let almacenesActualizados = 0;

    try {
      // Obtener todos los almacenes
      const almacenesSnapshot = await getDocs(collection(db, COLLECTION_NAME));
      const almacenes = almacenesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // Obtener todas las unidades de una sola vez (más eficiente)
      const unidadesSnapshot = await getDocs(collection(db, 'unidades'));

      // Agrupar unidades por almacenId
      const estadosExcluidos = ['vendida', 'vencida', 'danada', 'en_transito_peru'];
      const unidadesPorAlmacen: Record<string, { cantidad: number; valor: number }> = {};

      unidadesSnapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const almacenId = data.almacenId;
        if (!almacenId) return;

        // Solo contar unidades disponibles
        if (!estadosExcluidos.includes(data.estado)) {
          if (!unidadesPorAlmacen[almacenId]) {
            unidadesPorAlmacen[almacenId] = { cantidad: 0, valor: 0 };
          }
          unidadesPorAlmacen[almacenId].cantidad++;
          unidadesPorAlmacen[almacenId].valor += data.costoUnitarioUSD || 0;
        }
      });

      // Actualizar cada almacén
      for (const almacen of almacenes) {
        try {
          const datos = unidadesPorAlmacen[almacen.id] || { cantidad: 0, valor: 0 };
          const docRef = doc(db, COLLECTION_NAME, almacen.id);

          await updateDoc(docRef, {
            unidadesActuales: datos.cantidad,
            valorInventarioUSD: datos.valor,
            fechaActualizacion: Timestamp.now()
          });

          almacenesActualizados++;
        } catch (error: any) {
          errores.push(`Almacén ${almacen.id}: ${error.message}`);
        }
      }

      console.log(`[recalcularTodosLosAlmacenes] ${almacenesActualizados} almacenes actualizados`);
    } catch (error: any) {
      errores.push(`Error general: ${error.message}`);
      console.error('Error recalculando almacenes:', error);
    }

    return { almacenesActualizados, errores };
  },

  /**
   * Obtiene resumen de todos los almacenes USA
   * Calcula el inventario directamente desde las unidades para mayor precisión
   */
  async getResumenAlmacenesUSA(): Promise<ResumenAlmacenesUSA> {
    const almacenesUSA = await this.getAlmacenesUSA();
    const viajeros = almacenesUSA.filter(a => a.esViajero);

    // Obtener todas las unidades de USA para calcular totales precisos
    const unidadesSnapshot = await getDocs(
      query(
        collection(db, 'unidades'),
        where('pais', '==', 'USA')
      )
    );

    // Filtrar unidades disponibles (excluir las claramente no disponibles)
    const estadosExcluidos = ['vendida', 'vencida', 'danada', 'en_transito_peru'];
    const unidadesUSA = unidadesSnapshot.docs.filter(docSnap => {
      const estado = docSnap.data().estado;
      return !estadosExcluidos.includes(estado);
    });

    const totalUnidadesUSA = unidadesUSA.length;
    const valorTotalUSA_USD = unidadesUSA.reduce(
      (sum, docSnap) => sum + (docSnap.data().costoUnitarioUSD || 0), 0
    );

    // Calcular unidades por almacén para actualizar los contadores
    const unidadesPorAlmacen: Record<string, { cantidad: number; valor: number }> = {};
    unidadesUSA.forEach(docSnap => {
      const data = docSnap.data();
      const almacenId = data.almacenId;
      if (!unidadesPorAlmacen[almacenId]) {
        unidadesPorAlmacen[almacenId] = { cantidad: 0, valor: 0 };
      }
      unidadesPorAlmacen[almacenId].cantidad++;
      unidadesPorAlmacen[almacenId].valor += data.costoUnitarioUSD || 0;
    });

    // Actualizar almacenes con contadores correctos y crear lista enriquecida
    const almacenesConInventario = almacenesUSA.map(a => ({
      ...a,
      unidadesActuales: unidadesPorAlmacen[a.id]?.cantidad || 0,
      valorInventarioUSD: unidadesPorAlmacen[a.id]?.valor || 0
    }));

    // Alertas de capacidad
    const almacenesConCapacidadAlta = almacenesConInventario.filter(a => {
      if (!a.capacidadUnidades || !a.unidadesActuales) return false;
      return (a.unidadesActuales / a.capacidadUnidades) > 0.8;
    });

    return {
      totalAlmacenes: almacenesUSA.length,
      totalViajeros: viajeros.length,
      totalUnidadesUSA,
      valorTotalUSA_USD,
      inventarioPorAlmacen: [], // Se llena desde el componente con datos completos
      almacenesConCapacidadAlta,
      unidadesConMuchotiempo: [] // Se calcula desde unidad.service
    };
  },

  // ============================================
  // ESTADÍSTICAS COMPLETAS
  // ============================================

  /**
   * Obtiene estadísticas completas de almacenes para el dashboard
   */
  async getStats(): Promise<{
    totalAlmacenes: number;
    almacenesActivos: number;
    almacenesUSA: number;
    almacenesPeru: number;
    viajeros: number;
    unidadesTotalesUSA: number;
    valorInventarioUSA: number;
    capacidadPromedioUsada: number;
    almacenesCapacidadCritica: Array<{
      id: string;
      codigo: string;
      nombre: string;
      capacidadUsada: number;
      unidadesActuales: number;
      capacidadTotal: number;
    }>;
    proximosViajes: Array<{
      id: string;
      codigo: string;
      nombre: string;
      fechaViaje: Date;
      diasRestantes: number;
      unidadesActuales: number;
    }>;
    inventarioPorAlmacen: Array<{
      id: string;
      codigo: string;
      nombre: string;
      esViajero: boolean;
      unidadesActuales: number;
      valorInventarioUSD: number;
      capacidadUsada: number;
    }>;
  }> {
    const todos = await this.getAll();
    const activos = todos.filter(a => a.estadoAlmacen === 'activo');
    const usa = activos.filter(a => a.pais === 'USA');
    const peru = activos.filter(a => a.pais === 'Peru');
    const viajeros = activos.filter(a => a.esViajero);

    // Obtener unidades USA para cálculos precisos
    const unidadesSnapshot = await getDocs(collection(db, 'unidades'));
    const estadosExcluidos = ['vendida', 'vencida', 'danada', 'en_transito_peru'];

    const unidadesPorAlmacen: Record<string, { cantidad: number; valor: number }> = {};
    let totalUnidadesUSA = 0;
    let valorTotalUSA = 0;

    unidadesSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (estadosExcluidos.includes(data.estado)) return;

      const almacenId = data.almacenId;
      const esUSA = usa.some(a => a.id === almacenId);

      if (!unidadesPorAlmacen[almacenId]) {
        unidadesPorAlmacen[almacenId] = { cantidad: 0, valor: 0 };
      }
      unidadesPorAlmacen[almacenId].cantidad++;
      unidadesPorAlmacen[almacenId].valor += data.costoUnitarioUSD || 0;

      if (esUSA) {
        totalUnidadesUSA++;
        valorTotalUSA += data.costoUnitarioUSD || 0;
      }
    });

    // Calcular capacidad promedio usada
    let sumaCapacidadUsada = 0;
    let almacenesConCapacidad = 0;

    const inventarioPorAlmacen = usa.map(a => {
      const unidades = unidadesPorAlmacen[a.id]?.cantidad || 0;
      const valor = unidadesPorAlmacen[a.id]?.valor || 0;
      const capacidadUsada = a.capacidadUnidades ? (unidades / a.capacidadUnidades) * 100 : 0;

      if (a.capacidadUnidades) {
        sumaCapacidadUsada += capacidadUsada;
        almacenesConCapacidad++;
      }

      return {
        id: a.id,
        codigo: a.codigo,
        nombre: a.nombre,
        esViajero: a.esViajero,
        unidadesActuales: unidades,
        valorInventarioUSD: valor,
        capacidadUsada
      };
    });

    // Almacenes con capacidad crítica (>80%)
    const almacenesCapacidadCritica = inventarioPorAlmacen
      .filter(a => a.capacidadUsada > 80)
      .map(a => {
        const almacen = usa.find(al => al.id === a.id)!;
        return {
          id: a.id,
          codigo: a.codigo,
          nombre: a.nombre,
          capacidadUsada: a.capacidadUsada,
          unidadesActuales: a.unidadesActuales,
          capacidadTotal: almacen.capacidadUnidades || 0
        };
      });

    // Próximos viajes
    const hoy = new Date();
    const proximosViajes = viajeros
      .filter(v => v.proximoViaje && v.proximoViaje.toDate() > hoy)
      .map(v => {
        const fechaViaje = v.proximoViaje!.toDate();
        const diasRestantes = Math.ceil((fechaViaje.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: v.id,
          codigo: v.codigo,
          nombre: v.nombre,
          fechaViaje,
          diasRestantes,
          unidadesActuales: unidadesPorAlmacen[v.id]?.cantidad || 0
        };
      })
      .sort((a, b) => a.diasRestantes - b.diasRestantes)
      .slice(0, 5);

    return {
      totalAlmacenes: todos.length,
      almacenesActivos: activos.length,
      almacenesUSA: usa.length,
      almacenesPeru: peru.length,
      viajeros: viajeros.length,
      unidadesTotalesUSA: totalUnidadesUSA,
      valorInventarioUSA: valorTotalUSA,
      capacidadPromedioUsada: almacenesConCapacidad > 0 ? sumaCapacidadUsada / almacenesConCapacidad : 0,
      almacenesCapacidadCritica,
      proximosViajes,
      inventarioPorAlmacen: inventarioPorAlmacen.sort((a, b) => b.unidadesActuales - a.unidadesActuales)
    };
  },

  // ============================================
  // GENERACIÓN DE CÓDIGOS
  // ============================================

  /**
   * Obtiene el próximo código que se generará para un tipo de almacén
   * Útil para mostrar al usuario antes de crear
   */
  async getProximoCodigo(tipo: 'viajero' | 'almacen_peru'): Promise<string> {
    return generarCodigoAlmacen(tipo);
  },

  // ============================================
  // SEED DE DATOS INICIALES
  // ============================================

  async seedDefaultAlmacenes(userId: string): Promise<void> {
    const almacenesExistentes = await this.getAll();

    if (almacenesExistentes.length > 0) {
      logger.info('Ya existen almacenes, no se ejecuta el seed');
      return;
    }

    const almacenesDefault: AlmacenFormData[] = [
      // Viajero ejemplo (código se genera automáticamente: VIA-001)
      {
        nombre: 'Viajero Principal',
        pais: 'USA',
        tipo: 'viajero',
        estadoAlmacen: 'activo',
        direccion: '123 Main St',
        ciudad: 'Miami',
        estado: 'Florida',
        contacto: 'Carlos Rodríguez',
        telefono: '+1 (305) 555-0101',
        whatsapp: '+1 (305) 555-0101',
        capacidadUnidades: 200,
        esViajero: true,
        frecuenciaViaje: 'quincenal',
        costoPromedioFlete: 5.00,
        notas: 'Viajero principal - viaja cada 2 semanas'
      },
      // Almacén Perú (código se genera automáticamente: ALM-PE-001)
      {
        nombre: 'Almacén Principal Lima',
        pais: 'Peru',
        tipo: 'almacen_peru',
        estadoAlmacen: 'activo',
        direccion: 'Av. Industrial 456',
        ciudad: 'Lima',
        estado: 'Lima',
        codigoPostal: '15001',
        contacto: 'Juan Pérez',
        telefono: '+51 1 234-5678',
        email: 'almacen@businessmn.com',
        capacidadUnidades: 1000,
        esViajero: false,
        notas: 'Almacén principal para ventas en Perú'
      }
    ];

    for (const almacen of almacenesDefault) {
      await this.create(almacen, userId);
    }

    logger.success('Seed de almacenes completado: 2 almacenes creados');
  },

  // ============================================
  // EVALUACIÓN DE ALMACENES/VIAJEROS
  // ============================================

  /**
   * Determina la clasificación basada en puntuación
   */
  determinarClasificacion(puntuacion: number): ClasificacionAlmacen {
    if (puntuacion >= 80) return 'excelente';
    if (puntuacion >= 60) return 'bueno';
    if (puntuacion >= 40) return 'regular';
    return 'deficiente';
  },

  /**
   * Recalcula la evaluación de un almacén basándose en métricas
   * Esto es semi-automático: calcula factores automáticamente pero permite override
   */
  async recalcularEvaluacion(almacenId: string): Promise<EvaluacionAlmacen> {
    const almacen = await this.getById(almacenId);
    if (!almacen) {
      throw new Error('Almacén no encontrado');
    }

    const metricas = almacen.metricasOperativas || {
      transferenciasRecibidas: 0,
      transferenciasEnviadas: 0,
      productosAlmacenados: 0,
      incidenciasReportadas: 0,
      tasaIncidencias: 0,
      tiempoPromedioAlmacenaje: 0
    };

    // Calcular factores automáticamente
    const factores: FactoresEvaluacionAlmacen = {
      // Conservación: basada en tasa de incidencias (invertida)
      conservacionProductos: Math.round(25 * (1 - (metricas.tasaIncidencias || 0) / 100)),

      // Tiempo de respuesta: basado en tiempo promedio de almacenaje
      tiempoRespuesta: metricas.tiempoPromedioAlmacenaje <= 5 ? 25 :
                       metricas.tiempoPromedioAlmacenaje <= 10 ? 20 :
                       metricas.tiempoPromedioAlmacenaje <= 15 ? 15 :
                       metricas.tiempoPromedioAlmacenaje <= 20 ? 10 : 5,

      // Cumplimiento de fechas (para viajeros)
      cumplimientoFechas: almacen.esViajero && metricas.tasaPuntualidadViajes !== undefined
        ? Math.round(25 * (metricas.tasaPuntualidadViajes / 100))
        : almacen.evaluacion?.factores.cumplimientoFechas || 20,

      // Comunicación: mantener el valor existente (siempre manual)
      comunicacion: almacen.evaluacion?.factores.comunicacion || 15
    };

    const puntuacion = factores.conservacionProductos +
                       factores.tiempoRespuesta +
                       factores.cumplimientoFechas +
                       factores.comunicacion;

    const evaluacion: EvaluacionAlmacen = {
      puntuacion,
      clasificacion: this.determinarClasificacion(puntuacion),
      factores,
      ultimoCalculo: Timestamp.now(),
      calculoAutomatico: true
    };

    // Guardar evaluación
    const docRef = doc(db, COLLECTION_NAME, almacenId);
    await updateDoc(docRef, {
      evaluacion,
      fechaActualizacion: Timestamp.now()
    });

    return evaluacion;
  },

  /**
   * Evaluar manualmente un almacén (override de cálculo automático)
   */
  async evaluarManualmente(
    almacenId: string,
    factores: FactoresEvaluacionAlmacen,
    userId: string,
    notas?: string
  ): Promise<EvaluacionAlmacen> {
    const almacen = await this.getById(almacenId);
    if (!almacen) {
      throw new Error('Almacén no encontrado');
    }

    // Validar factores (cada uno entre 0 y 25)
    const factoresValidos = ['conservacionProductos', 'tiempoRespuesta', 'cumplimientoFechas', 'comunicacion'];
    for (const factor of factoresValidos) {
      const valor = factores[factor as keyof FactoresEvaluacionAlmacen];
      if (valor < 0 || valor > 25) {
        throw new Error(`El factor ${factor} debe estar entre 0 y 25`);
      }
    }

    const puntuacion = factores.conservacionProductos +
                       factores.tiempoRespuesta +
                       factores.cumplimientoFechas +
                       factores.comunicacion;

    const ahora = Timestamp.now();

    const evaluacion: EvaluacionAlmacen = {
      puntuacion,
      clasificacion: this.determinarClasificacion(puntuacion),
      factores,
      ultimoCalculo: ahora,
      calculoAutomatico: false
    };

    // Agregar al historial
    const historialEvaluacion: HistorialEvaluacionAlmacen = {
      fecha: ahora,
      puntuacion,
      factores,
      evaluadoPor: userId
    };
    if (notas) historialEvaluacion.notas = notas;

    const historialActual = almacen.evaluacionesHistorial || [];

    // Guardar evaluación
    const docRef = doc(db, COLLECTION_NAME, almacenId);
    await updateDoc(docRef, {
      evaluacion,
      evaluacionesHistorial: [...historialActual.slice(-9), historialEvaluacion],
      actualizadoPor: userId,
      fechaActualizacion: ahora
    });

    return evaluacion;
  },

  /**
   * Actualizar métricas operativas del almacén
   */
  async actualizarMetricasOperativas(
    almacenId: string,
    datosOperacion: {
      tipoOperacion: 'recepcion' | 'envio' | 'viaje';
      tuvoIncidencia?: boolean;
      diasAlmacenaje?: number;
      viajeATiempo?: boolean;
    }
  ): Promise<void> {
    const almacen = await this.getById(almacenId);
    if (!almacen) return;

    const metricas: MetricasOperativasAlmacen = almacen.metricasOperativas || {
      transferenciasRecibidas: 0,
      transferenciasEnviadas: 0,
      productosAlmacenados: 0,
      incidenciasReportadas: 0,
      tasaIncidencias: 0,
      tiempoPromedioAlmacenaje: 0
    };

    // Actualizar según tipo de operación
    if (datosOperacion.tipoOperacion === 'recepcion') {
      metricas.transferenciasRecibidas += 1;
      metricas.productosAlmacenados = (almacen.unidadesActuales || 0);
    } else if (datosOperacion.tipoOperacion === 'envio') {
      metricas.transferenciasEnviadas += 1;
    } else if (datosOperacion.tipoOperacion === 'viaje' && almacen.esViajero) {
      metricas.viajesRealizados = (metricas.viajesRealizados || 0) + 1;
      if (datosOperacion.viajeATiempo) {
        metricas.viajesATiempo = (metricas.viajesATiempo || 0) + 1;
      }
      metricas.tasaPuntualidadViajes = metricas.viajesRealizados > 0
        ? ((metricas.viajesATiempo || 0) / metricas.viajesRealizados) * 100
        : 0;
    }

    // Actualizar incidencias
    if (datosOperacion.tuvoIncidencia) {
      metricas.incidenciasReportadas += 1;
    }
    const totalOperaciones = metricas.transferenciasRecibidas + metricas.transferenciasEnviadas;
    metricas.tasaIncidencias = totalOperaciones > 0
      ? (metricas.incidenciasReportadas / totalOperaciones) * 100
      : 0;

    // Actualizar tiempo promedio de almacenaje
    if (datosOperacion.diasAlmacenaje !== undefined) {
      const n = metricas.transferenciasEnviadas;
      const promedioAnterior = metricas.tiempoPromedioAlmacenaje || datosOperacion.diasAlmacenaje;
      metricas.tiempoPromedioAlmacenaje = n > 1
        ? ((promedioAnterior * (n - 1)) + datosOperacion.diasAlmacenaje) / n
        : datosOperacion.diasAlmacenaje;
    }

    // Calcular capacidad utilizada promedio
    if (almacen.capacidadUnidades && almacen.capacidadUnidades > 0) {
      const capacidadActual = ((almacen.unidadesActuales || 0) / almacen.capacidadUnidades) * 100;
      const n = totalOperaciones + 1;
      metricas.capacidadUtilizadaPromedio = metricas.capacidadUtilizadaPromedio !== undefined
        ? ((metricas.capacidadUtilizadaPromedio * (n - 1)) + capacidadActual) / n
        : capacidadActual;
    }

    const docRef = doc(db, COLLECTION_NAME, almacenId);
    await updateDoc(docRef, {
      metricasOperativas: metricas,
      fechaActualizacion: Timestamp.now()
    });

    // Recalcular evaluación automáticamente
    await this.recalcularEvaluacion(almacenId);

    logger.success(`Métricas operativas actualizadas para almacén ${almacenId}`);
  },

  /**
   * Obtener almacenes por clasificación
   */
  async getByClasificacion(clasificacion: ClasificacionAlmacen): Promise<Almacen[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('evaluacion.clasificacion', '==', clasificacion)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as Almacen));
  },

  /**
   * Obtener almacenes excelentes
   */
  async getAlmacenesExcelentes(): Promise<Almacen[]> {
    return this.getByClasificacion('excelente');
  },

  /**
   * Obtener almacenes que requieren atención (regular o deficiente)
   */
  async getAlmacenesEnRiesgo(): Promise<Almacen[]> {
    const regulares = await this.getByClasificacion('regular');
    const deficientes = await this.getByClasificacion('deficiente');
    return [...regulares, ...deficientes];
  }
};
