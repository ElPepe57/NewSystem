import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import type {
  Proveedor,
  ProveedorFormData,
  TipoProveedor,
  ClasificacionProveedor,
  EvaluacionProveedor,
  FactoresEvaluacionProveedor,
  HistorialEvaluacionProveedor,
  MetricasProveedor,
  ProveedorStats
} from '../types/ordenCompra.types';

const COLLECTION_NAME = 'proveedores';

/**
 * Genera el siguiente código de proveedor automáticamente
 * Formato: PRV-001, PRV-002, etc.
 */
async function generarCodigoProveedor(): Promise<string> {
  const prefix = 'PRV';

  const snapshot = await getDocs(collection(db, COLLECTION_NAME));

  let maxNumber = 0;
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    const codigo = data.codigo as string;

    if (codigo && codigo.startsWith(prefix)) {
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

/**
 * Servicio dedicado para gestión de Proveedores
 * Centralizado en el Gestor Maestro
 */
class ProveedorService {
  /**
   * Obtener todos los proveedores
   */
  async getAll(): Promise<Proveedor[]> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      const proveedores = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Proveedor));

      // Ordenar por nombre en cliente
      return proveedores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (error: any) {
      console.error('Error al obtener proveedores:', error);
      throw new Error('Error al cargar proveedores');
    }
  }

  /**
   * Obtener solo proveedores activos
   */
  async getActivos(): Promise<Proveedor[]> {
    try {
      const proveedores = await this.getAll();
      return proveedores.filter(p => p.activo);
    } catch (error: any) {
      console.error('Error al obtener proveedores activos:', error);
      throw new Error('Error al cargar proveedores activos');
    }
  }

  /**
   * Obtener proveedores por país
   */
  async getByPais(pais: string): Promise<Proveedor[]> {
    try {
      const proveedores = await this.getActivos();
      return proveedores.filter(p => p.pais === pais);
    } catch (error: any) {
      console.error('Error al obtener proveedores por país:', error);
      throw new Error('Error al cargar proveedores');
    }
  }

  /**
   * Obtener proveedor por ID
   */
  async getById(id: string): Promise<Proveedor | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Proveedor;
    } catch (error: any) {
      console.error('Error al obtener proveedor:', error);
      throw new Error('Error al cargar proveedor');
    }
  }

  /**
   * Buscar proveedores por nombre
   */
  async buscar(termino: string): Promise<Proveedor[]> {
    try {
      const proveedores = await this.getAll();
      const terminoLower = termino.toLowerCase();

      return proveedores.filter(p =>
        p.nombre.toLowerCase().includes(terminoLower) ||
        p.contacto?.toLowerCase().includes(terminoLower) ||
        p.email?.toLowerCase().includes(terminoLower) ||
        p.pais?.toLowerCase().includes(terminoLower)
      );
    } catch (error: any) {
      console.error('Error en búsqueda:', error);
      return [];
    }
  }

  /**
   * Buscar por nombre exacto
   */
  async buscarPorNombreExacto(nombre: string): Promise<Proveedor | null> {
    try {
      const proveedores = await this.getAll();
      return proveedores.find(
        p => p.nombre.toLowerCase() === nombre.toLowerCase()
      ) || null;
    } catch (error: any) {
      console.error('Error buscando por nombre exacto:', error);
      return null;
    }
  }

  /**
   * Crear nuevo proveedor
   */
  async create(data: ProveedorFormData, userId: string): Promise<string> {
    try {
      // Verificar duplicados
      const existente = await this.buscarPorNombreExacto(data.nombre);
      if (existente) {
        throw new Error(`Ya existe un proveedor con el nombre "${data.nombre}"`);
      }

      // Generar código automático
      const codigo = await generarCodigoProveedor();

      const nuevoProveedor: any = {
        codigo,
        nombre: data.nombre.trim(),
        tipo: data.tipo,
        url: data.url.trim(),
        pais: data.pais,
        activo: true,
        creadoPor: userId,
        fechaCreacion: serverTimestamp(),
        // Métricas iniciales
        metricas: {
          ordenesCompra: 0,
          montoTotalUSD: 0,
          ultimaCompra: null,
          productosComprados: [],
          productosAnalizados: 0,
          precioPromedio: 0,
          ultimaInvestigacion: null
        }
      };

      // Agregar campos opcionales solo si existen
      if (data.telefono?.trim()) nuevoProveedor.telefono = data.telefono.trim();
      if (data.direccion?.trim()) nuevoProveedor.direccion = data.direccion.trim();
      if (data.notasInternas?.trim()) nuevoProveedor.notasInternas = data.notasInternas.trim();

      const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevoProveedor);
      return docRef.id;
    } catch (error: any) {
      console.error('Error al crear proveedor:', error);
      throw new Error(error.message || 'Error al crear proveedor');
    }
  }

  /**
   * Actualizar proveedor
   */
  async update(id: string, data: Partial<ProveedorFormData>, userId: string): Promise<void> {
    try {
      const updates: any = {
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      };

      if (data.nombre !== undefined) updates.nombre = data.nombre.trim();
      if (data.tipo !== undefined) updates.tipo = data.tipo;
      if (data.url !== undefined) updates.url = data.url.trim();
      if (data.telefono !== undefined) updates.telefono = data.telefono?.trim() || null;
      if (data.direccion !== undefined) updates.direccion = data.direccion?.trim() || null;
      if (data.pais !== undefined) updates.pais = data.pais;
      if (data.notasInternas !== undefined) updates.notasInternas = data.notasInternas?.trim() || null;

      await updateDoc(doc(db, COLLECTION_NAME, id), updates);
    } catch (error: any) {
      console.error('Error al actualizar proveedor:', error);
      throw new Error('Error al actualizar proveedor');
    }
  }

  /**
   * Activar/Desactivar proveedor (soft delete)
   */
  async cambiarEstado(id: string, activo: boolean, userId: string): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTION_NAME, id), {
        activo,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });
    } catch (error: any) {
      console.error('Error al cambiar estado del proveedor:', error);
      throw new Error('Error al cambiar estado del proveedor');
    }
  }

  /**
   * Eliminar proveedor (soft delete - marca como inactivo)
   */
  async delete(id: string, userId: string): Promise<void> {
    return this.cambiarEstado(id, false, userId);
  }

  /**
   * Obtener o crear proveedor por nombre
   */
  async getOrCreate(nombre: string, pais: string, tipo: TipoProveedor, userId: string): Promise<{ proveedor: Proveedor; esNuevo: boolean }> {
    try {
      // Buscar existente
      const existente = await this.buscarPorNombreExacto(nombre);
      if (existente) {
        return { proveedor: existente, esNuevo: false };
      }

      // Crear nuevo
      const id = await this.create({
        nombre,
        pais,
        tipo,
        url: ''
      }, userId);

      const nuevoProveedor = await this.getById(id);
      if (!nuevoProveedor) {
        throw new Error('Error al crear proveedor');
      }

      return { proveedor: nuevoProveedor, esNuevo: true };
    } catch (error: any) {
      console.error('Error en getOrCreate:', error);
      throw error;
    }
  }

  /**
   * Actualizar métricas del proveedor cuando se crea una orden de compra
   */
  async actualizarMetricasPorCompra(
    proveedorId: string,
    montoUSD: number,
    productos: string[]
  ): Promise<void> {
    try {
      const proveedor = await this.getById(proveedorId);
      if (!proveedor) return;

      const metricas = proveedor.metricas || {
        ordenesCompra: 0,
        montoTotalUSD: 0,
        productosComprados: []
      };

      // Actualizar métricas
      const productosSet = new Set([...(metricas.productosComprados || []), ...productos]);

      await updateDoc(doc(db, COLLECTION_NAME, proveedorId), {
        'metricas.ordenesCompra': (metricas.ordenesCompra || 0) + 1,
        'metricas.montoTotalUSD': (metricas.montoTotalUSD || 0) + montoUSD,
        'metricas.ultimaCompra': Timestamp.now(),
        'metricas.productosComprados': Array.from(productosSet)
      });
    } catch (error: any) {
      console.error('Error actualizando métricas del proveedor:', error);
    }
  }

  /**
   * Actualizar métricas de investigación del proveedor
   */
  async actualizarMetricasInvestigacion(
    proveedorId: string,
    metricas: {
      productosAnalizados?: number;
      precioPromedio?: number;
    }
  ): Promise<void> {
    try {
      const updateData: Record<string, any> = {
        'metricas.ultimaInvestigacion': serverTimestamp()
      };

      if (metricas.productosAnalizados !== undefined) {
        updateData['metricas.productosAnalizados'] = metricas.productosAnalizados;
      }
      if (metricas.precioPromedio !== undefined) {
        updateData['metricas.precioPromedio'] = metricas.precioPromedio;
      }

      await updateDoc(doc(db, COLLECTION_NAME, proveedorId), updateData);
    } catch (error: any) {
      console.error('Error actualizando métricas de investigación:', error);
    }
  }

  /**
   * Obtener estadísticas de proveedores
   */
  async getStats(): Promise<{
    totalProveedores: number;
    proveedoresActivos: number;
    proveedoresPorPais: Record<string, number>;
    proveedoresPorTipo: Record<TipoProveedor, number>;
    topProveedoresPorCompras: Array<{
      proveedorId: string;
      nombre: string;
      ordenesCompra: number;
      montoTotalUSD: number;
    }>;
  }> {
    try {
      const proveedores = await this.getAll();

      const stats = {
        totalProveedores: proveedores.length,
        proveedoresActivos: proveedores.filter(p => p.activo).length,
        proveedoresPorPais: {} as Record<string, number>,
        proveedoresPorTipo: {} as Record<TipoProveedor, number>,
        topProveedoresPorCompras: [] as Array<{
          proveedorId: string;
          nombre: string;
          ordenesCompra: number;
          montoTotalUSD: number;
        }>
      };

      proveedores.forEach(p => {
        // Por país
        stats.proveedoresPorPais[p.pais] = (stats.proveedoresPorPais[p.pais] || 0) + 1;

        // Por tipo
        stats.proveedoresPorTipo[p.tipo] = (stats.proveedoresPorTipo[p.tipo] || 0) + 1;
      });

      // Top proveedores por compras
      stats.topProveedoresPorCompras = proveedores
        .filter(p => p.metricas && p.metricas.ordenesCompra > 0)
        .sort((a, b) => (b.metricas?.montoTotalUSD || 0) - (a.metricas?.montoTotalUSD || 0))
        .slice(0, 5)
        .map(p => ({
          proveedorId: p.id,
          nombre: p.nombre,
          ordenesCompra: p.metricas?.ordenesCompra || 0,
          montoTotalUSD: p.metricas?.montoTotalUSD || 0
        }));

      return stats;
    } catch (error: any) {
      console.error('Error obteniendo stats de proveedores:', error);
      throw new Error('Error al cargar estadísticas');
    }
  }

  /**
   * Obtiene el próximo código que se generará
   * Útil para mostrar al usuario antes de crear
   */
  async getProximoCodigo(): Promise<string> {
    return generarCodigoProveedor();
  }

  // ========== SRM - EVALUACIÓN DE PROVEEDORES ==========

  /**
   * Determina la clasificación basada en puntuación
   */
  private determinarClasificacion(puntuacion: number): ClasificacionProveedor {
    if (puntuacion >= 80) return 'preferido';
    if (puntuacion >= 60) return 'aprobado';
    if (puntuacion >= 40) return 'condicional';
    return 'suspendido';
  }

  /**
   * Recalcula la evaluación de un proveedor basándose en métricas
   * Esto es semi-automático: calcula factores automáticamente pero permite override
   */
  async recalcularEvaluacion(proveedorId: string): Promise<EvaluacionProveedor> {
    try {
      const proveedor = await this.getById(proveedorId);
      if (!proveedor) {
        throw new Error('Proveedor no encontrado');
      }

      const metricas = proveedor.metricas || {
        ordenesCompra: 0,
        montoTotalUSD: 0,
        productosComprados: [],
        ordenesCompletadas: 0,
        ordenesConProblemas: 0,
        tasaProblemas: 0,
        tiempoEntregaPromedioDias: 0,
        desviacionTiempoEntrega: 0
      };

      // Calcular factores automáticamente
      const factores: FactoresEvaluacionProveedor = {
        // Calidad: basada en tasa de problemas (invertida)
        calidadProductos: Math.round(25 * (1 - (metricas.tasaProblemas || 0) / 100)),

        // Puntualidad: basada en desviación de tiempo de entrega
        puntualidadEntrega: metricas.desviacionTiempoEntrega <= 1 ? 25 :
                            metricas.desviacionTiempoEntrega <= 3 ? 20 :
                            metricas.desviacionTiempoEntrega <= 5 ? 15 :
                            metricas.desviacionTiempoEntrega <= 7 ? 10 : 5,

        // Competitividad: mantener el valor existente o valor por defecto
        competitividadPrecios: proveedor.evaluacion?.factores.competitividadPrecios || 15,

        // Comunicación: mantener el valor existente (siempre manual)
        comunicacion: proveedor.evaluacion?.factores.comunicacion || 15
      };

      const puntuacion = factores.calidadProductos +
                         factores.puntualidadEntrega +
                         factores.competitividadPrecios +
                         factores.comunicacion;

      const evaluacion: EvaluacionProveedor = {
        puntuacion,
        clasificacion: this.determinarClasificacion(puntuacion),
        factores,
        ultimoCalculo: Timestamp.now(),
        calculoAutomatico: true
      };

      // Guardar evaluación
      await updateDoc(doc(db, COLLECTION_NAME, proveedorId), {
        evaluacion,
        ultimaEdicion: serverTimestamp()
      });

      return evaluacion;
    } catch (error: any) {
      console.error('Error al recalcular evaluación:', error);
      throw new Error('Error al recalcular evaluación');
    }
  }

  /**
   * Evaluar manualmente un proveedor (override de cálculo automático)
   */
  async evaluarManualmente(
    proveedorId: string,
    factores: FactoresEvaluacionProveedor,
    userId: string,
    notas?: string
  ): Promise<EvaluacionProveedor> {
    try {
      const proveedor = await this.getById(proveedorId);
      if (!proveedor) {
        throw new Error('Proveedor no encontrado');
      }

      // Validar factores (cada uno entre 0 y 25)
      const factoresValidos = ['calidadProductos', 'puntualidadEntrega', 'competitividadPrecios', 'comunicacion'];
      for (const factor of factoresValidos) {
        const valor = factores[factor as keyof FactoresEvaluacionProveedor];
        if (valor < 0 || valor > 25) {
          throw new Error(`El factor ${factor} debe estar entre 0 y 25`);
        }
      }

      const puntuacion = factores.calidadProductos +
                         factores.puntualidadEntrega +
                         factores.competitividadPrecios +
                         factores.comunicacion;

      const ahora = Timestamp.now();

      const evaluacion: EvaluacionProveedor = {
        puntuacion,
        clasificacion: this.determinarClasificacion(puntuacion),
        factores,
        ultimoCalculo: ahora,
        calculoAutomatico: false
      };

      // Agregar al historial
      const historialEvaluacion: HistorialEvaluacionProveedor = {
        fecha: ahora,
        puntuacion,
        factores,
        evaluadoPor: userId
      };
      if (notas) historialEvaluacion.notas = notas;

      const historialActual = proveedor.evaluacionesHistorial || [];

      // Guardar evaluación
      await updateDoc(doc(db, COLLECTION_NAME, proveedorId), {
        evaluacion,
        evaluacionesHistorial: [...historialActual.slice(-9), historialEvaluacion],
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });

      return evaluacion;
    } catch (error: any) {
      console.error('Error al evaluar manualmente:', error);
      throw new Error(error.message || 'Error al evaluar proveedor');
    }
  }

  /**
   * Actualizar métricas del proveedor cuando se completa una orden de compra
   */
  async actualizarMetricasPorOrden(
    proveedorId: string,
    datosOrden: {
      montoUSD: number;
      productos: string[];
      diasEntrega?: number;
      tuvoProblemas?: boolean;
    }
  ): Promise<void> {
    try {
      const proveedor = await this.getById(proveedorId);
      if (!proveedor) return;

      const metricas: MetricasProveedor = proveedor.metricas || {
        ordenesCompra: 0,
        montoTotalUSD: 0,
        productosComprados: [],
        ordenesCompletadas: 0,
        ordenesConProblemas: 0,
        tasaProblemas: 0,
        tiempoEntregaPromedioDias: 0,
        desviacionTiempoEntrega: 0
      };

      // Actualizar métricas
      metricas.ordenesCompra += 1;
      metricas.montoTotalUSD += datosOrden.montoUSD;
      metricas.ultimaCompra = Timestamp.now();
      metricas.ordenesCompletadas += 1;

      // Actualizar productos comprados
      const productosSet = new Set([...metricas.productosComprados, ...datosOrden.productos]);
      metricas.productosComprados = Array.from(productosSet);

      // Actualizar problemas
      if (datosOrden.tuvoProblemas) {
        metricas.ordenesConProblemas += 1;
      }
      metricas.tasaProblemas = (metricas.ordenesConProblemas / metricas.ordenesCompletadas) * 100;

      // Actualizar tiempo de entrega
      if (datosOrden.diasEntrega !== undefined) {
        const n = metricas.ordenesCompletadas;
        const promedioAnterior = metricas.tiempoEntregaPromedioDias || datosOrden.diasEntrega;
        metricas.tiempoEntregaPromedioDias = ((promedioAnterior * (n - 1)) + datosOrden.diasEntrega) / n;

        // Calcular desviación (simplificada)
        metricas.desviacionTiempoEntrega = Math.abs(datosOrden.diasEntrega - metricas.tiempoEntregaPromedioDias);
      }

      await updateDoc(doc(db, COLLECTION_NAME, proveedorId), {
        metricas,
        ultimaEdicion: serverTimestamp()
      });

      // Recalcular evaluación automáticamente
      await this.recalcularEvaluacion(proveedorId);

      logger.success(`Métricas SRM actualizadas para proveedor ${proveedorId}`);
    } catch (error: any) {
      console.error('Error al actualizar métricas del proveedor:', error);
    }
  }

  /**
   * Obtener proveedores por clasificación
   */
  async getByClasificacion(clasificacion: ClasificacionProveedor): Promise<Proveedor[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('evaluacion.clasificacion', '==', clasificacion)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Proveedor));
    } catch (error: any) {
      console.error('Error al obtener proveedores por clasificación:', error);
      return [];
    }
  }

  /**
   * Obtener proveedores preferidos (clasificación = preferido)
   */
  async getProveedoresPreferidos(): Promise<Proveedor[]> {
    return this.getByClasificacion('preferido');
  }

  /**
   * Obtener proveedores que requieren atención (condicional o suspendido)
   */
  async getProveedoresEnRiesgo(): Promise<Proveedor[]> {
    try {
      const condicionales = await this.getByClasificacion('condicional');
      const suspendidos = await this.getByClasificacion('suspendido');
      return [...condicionales, ...suspendidos];
    } catch (error: any) {
      console.error('Error al obtener proveedores en riesgo:', error);
      return [];
    }
  }

  /**
   * Obtener estadísticas completas de proveedores (con clasificación)
   */
  async getStatsConClasificacion(): Promise<ProveedorStats> {
    try {
      const proveedores = await this.getAll();

      const stats: ProveedorStats = {
        totalProveedores: proveedores.length,
        proveedoresActivos: proveedores.filter(p => p.activo).length,
        proveedoresPorPais: {},
        proveedoresPorTipo: {} as Record<TipoProveedor, number>,
        proveedoresPorClasificacion: {
          preferido: 0,
          aprobado: 0,
          condicional: 0,
          suspendido: 0
        },
        topProveedoresPorCompras: []
      };

      proveedores.forEach(p => {
        // Por país
        stats.proveedoresPorPais[p.pais] = (stats.proveedoresPorPais[p.pais] || 0) + 1;

        // Por tipo
        stats.proveedoresPorTipo[p.tipo] = (stats.proveedoresPorTipo[p.tipo] || 0) + 1;

        // Por clasificación
        if (p.evaluacion?.clasificacion) {
          stats.proveedoresPorClasificacion[p.evaluacion.clasificacion] += 1;
        }
      });

      // Top proveedores por compras
      stats.topProveedoresPorCompras = proveedores
        .filter(p => p.metricas?.ordenesCompra && p.metricas.ordenesCompra > 0)
        .sort((a, b) => (b.metricas?.montoTotalUSD || 0) - (a.metricas?.montoTotalUSD || 0))
        .slice(0, 5)
        .map(p => ({
          proveedorId: p.id,
          nombre: p.nombre,
          ordenesCompra: p.metricas?.ordenesCompra || 0,
          montoTotalUSD: p.metricas?.montoTotalUSD || 0,
          clasificacion: p.evaluacion?.clasificacion
        }));

      return stats;
    } catch (error: any) {
      console.error('Error obteniendo stats de proveedores:', error);
      throw new Error('Error al cargar estadísticas');
    }
  }
}

// Export nombrado para imports específicos
export { ProveedorService };

export const proveedorService = new ProveedorService();
