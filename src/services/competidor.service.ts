/**
 * Servicio para gestión de Competidores
 * Centralizado en el Gestor Maestro
 */
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  Competidor,
  CompetidorFormData,
  PlataformaCompetidor,
  ReputacionCompetidor
} from '../types/entidadesMaestras.types';

const COLLECTION_NAME = 'competidores';

// Normalizar texto para búsquedas
const normalizarTexto = (texto: string): string => {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

/**
 * Genera el siguiente código de competidor automáticamente
 * Formato: CMP-001, CMP-002, etc.
 */
async function generarCodigoCompetidor(): Promise<string> {
  const prefix = 'CMP';

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

export const competidorService = {
  /**
   * Obtener todos los competidores
   */
  async getAll(): Promise<Competidor[]> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));

      return snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Competidor[];
    } catch (error: any) {
      console.error('Error obteniendo competidores:', error);
      throw new Error('Error al cargar competidores');
    }
  },

  /**
   * Obtener solo competidores activos
   */
  async getActivos(): Promise<Competidor[]> {
    try {
      const todos = await this.getAll();
      return todos.filter(c => c.estado === 'activo');
    } catch (error: any) {
      console.error('Error obteniendo competidores activos:', error);
      throw new Error('Error al cargar competidores');
    }
  },

  /**
   * Obtener competidor por ID
   */
  async getById(id: string): Promise<Competidor | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Competidor;
    } catch (error: any) {
      console.error('Error obteniendo competidor:', error);
      throw new Error('Error al cargar competidor');
    }
  },

  /**
   * Buscar competidor por nombre exacto (normalizado)
   */
  async buscarPorNombreExacto(nombre: string): Promise<Competidor | null> {
    try {
      const nombreNorm = normalizarTexto(nombre);
      const todos = await this.getAll();

      return todos.find(c =>
        c.nombreNormalizado === nombreNorm ||
        c.alias?.some(a => normalizarTexto(a) === nombreNorm)
      ) || null;
    } catch (error: any) {
      console.error('Error buscando competidor:', error);
      return null;
    }
  },

  /**
   * Buscar competidores por texto (fuzzy)
   */
  async buscar(texto: string): Promise<Competidor[]> {
    try {
      const textoNorm = normalizarTexto(texto);
      const todos = await this.getActivos();

      return todos.filter(c =>
        c.nombreNormalizado.includes(textoNorm) ||
        c.codigo?.toLowerCase().includes(textoNorm) ||
        c.alias?.some(a => normalizarTexto(a).includes(textoNorm))
      );
    } catch (error: any) {
      console.error('Error buscando competidores:', error);
      return [];
    }
  },

  /**
   * Crear nuevo competidor
   */
  async create(data: CompetidorFormData, userId: string): Promise<string> {
    try {
      // Verificar duplicados
      const existente = await this.buscarPorNombreExacto(data.nombre);
      if (existente) {
        throw new Error(`Ya existe un competidor con el nombre "${data.nombre}"`);
      }

      // Generar código automático
      const codigo = await generarCodigoCompetidor();

      const nuevoCompetidor: any = {
        codigo,
        nombre: data.nombre.trim(),
        nombreNormalizado: normalizarTexto(data.nombre),
        plataformaPrincipal: data.plataformaPrincipal,
        plataformas: data.plataformas || [data.plataformaPrincipal],
        reputacion: data.reputacion || 'desconocida',
        nivelAmenaza: data.nivelAmenaza || 'medio',
        estado: 'activo',
        creadoPor: userId,
        fechaCreacion: serverTimestamp(),
        metricas: {
          productosAnalizados: 0,
          precioPromedio: 0
        }
      };

      // Agregar campos opcionales solo si tienen valor
      if (data.urlTienda) nuevoCompetidor.urlTienda = data.urlTienda;
      if (data.urlMercadoLibre) nuevoCompetidor.urlMercadoLibre = data.urlMercadoLibre;
      if (data.ciudad) nuevoCompetidor.ciudad = data.ciudad;
      if (data.departamento) nuevoCompetidor.departamento = data.departamento;
      if (data.ventasEstimadas) nuevoCompetidor.ventasEstimadas = data.ventasEstimadas;
      if (data.esLiderCategoria !== undefined) nuevoCompetidor.esLiderCategoria = data.esLiderCategoria;
      if (data.categoriasLider) nuevoCompetidor.categoriasLider = data.categoriasLider;
      if (data.fortalezas) nuevoCompetidor.fortalezas = data.fortalezas;
      if (data.debilidades) nuevoCompetidor.debilidades = data.debilidades;
      if (data.estrategiaPrecio) nuevoCompetidor.estrategiaPrecio = data.estrategiaPrecio;
      if (data.notas) nuevoCompetidor.notas = data.notas;

      const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevoCompetidor);
      return docRef.id;
    } catch (error: any) {
      console.error('Error creando competidor:', error);
      throw new Error(error.message || 'Error al crear competidor');
    }
  },

  /**
   * Actualizar competidor existente
   */
  async update(id: string, data: Partial<CompetidorFormData>, userId: string): Promise<void> {
    try {
      const competidor = await this.getById(id);
      if (!competidor) throw new Error('Competidor no encontrado');

      // Si cambió el nombre, verificar duplicados
      if (data.nombre && data.nombre !== competidor.nombre) {
        const existente = await this.buscarPorNombreExacto(data.nombre);
        if (existente && existente.id !== id) {
          throw new Error(`Ya existe un competidor con el nombre "${data.nombre}"`);
        }
      }

      const updates: any = {
        actualizadoPor: userId,
        fechaActualizacion: serverTimestamp()
      };

      // Actualizar campos que vienen en data
      if (data.nombre) {
        updates.nombre = data.nombre.trim();
        updates.nombreNormalizado = normalizarTexto(data.nombre);
      }
      if (data.plataformaPrincipal) updates.plataformaPrincipal = data.plataformaPrincipal;
      if (data.plataformas) updates.plataformas = data.plataformas;
      if (data.urlTienda !== undefined) updates.urlTienda = data.urlTienda || null;
      if (data.urlMercadoLibre !== undefined) updates.urlMercadoLibre = data.urlMercadoLibre || null;
      if (data.ciudad !== undefined) updates.ciudad = data.ciudad || null;
      if (data.departamento !== undefined) updates.departamento = data.departamento || null;
      if (data.reputacion) updates.reputacion = data.reputacion;
      if (data.ventasEstimadas !== undefined) updates.ventasEstimadas = data.ventasEstimadas;
      if (data.esLiderCategoria !== undefined) updates.esLiderCategoria = data.esLiderCategoria;
      if (data.categoriasLider !== undefined) updates.categoriasLider = data.categoriasLider;
      if (data.fortalezas !== undefined) updates.fortalezas = data.fortalezas || null;
      if (data.debilidades !== undefined) updates.debilidades = data.debilidades || null;
      if (data.estrategiaPrecio !== undefined) updates.estrategiaPrecio = data.estrategiaPrecio;
      if (data.nivelAmenaza) updates.nivelAmenaza = data.nivelAmenaza;
      if (data.notas !== undefined) updates.notas = data.notas || null;

      await updateDoc(doc(db, COLLECTION_NAME, id), updates);
    } catch (error: any) {
      console.error('Error actualizando competidor:', error);
      throw new Error(error.message || 'Error al actualizar competidor');
    }
  },

  /**
   * Cambiar estado del competidor
   */
  async cambiarEstado(id: string, estado: 'activo' | 'inactivo' | 'cerrado', userId: string): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTION_NAME, id), {
        estado,
        actualizadoPor: userId,
        fechaActualizacion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error cambiando estado:', error);
      throw new Error('Error al cambiar estado del competidor');
    }
  },

  /**
   * Actualizar métricas del competidor
   * Se llama cuando se registra una investigación de mercado
   *
   * @param id - ID del competidor
   * @param datosMetricas - Objeto con productosAnalizados y/o precioPromedio
   */
  async actualizarMetricas(
    id: string,
    datosMetricas: { productosAnalizados?: number; precioPromedio?: number }
  ): Promise<void> {
    try {
      const updateData: Record<string, any> = {
        'metricas.ultimaActualizacion': serverTimestamp()
      };

      if (datosMetricas.productosAnalizados !== undefined) {
        updateData['metricas.productosAnalizados'] = datosMetricas.productosAnalizados;
      }
      if (datosMetricas.precioPromedio !== undefined) {
        updateData['metricas.precioPromedio'] = datosMetricas.precioPromedio;
      }

      await updateDoc(doc(db, COLLECTION_NAME, id), updateData);
    } catch (error: any) {
      console.error('Error actualizando métricas:', error);
    }
  },

  /**
   * Eliminar competidor (solo si no tiene análisis asociados)
   */
  async delete(id: string): Promise<void> {
    try {
      const competidor = await this.getById(id);
      if (!competidor) throw new Error('Competidor no encontrado');

      if (competidor.metricas?.productosAnalizados > 0) {
        throw new Error('No se puede eliminar un competidor con análisis asociados. Márquelo como inactivo.');
      }

      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error: any) {
      console.error('Error eliminando competidor:', error);
      throw new Error(error.message || 'Error al eliminar competidor');
    }
  },

  /**
   * Obtener estadísticas completas de competidores
   */
  async getStats(): Promise<{
    total: number;
    activos: number;
    inactivos: number;
    porPlataforma: Record<PlataformaCompetidor, number>;
    porNivelAmenaza: Record<string, number>;
    porReputacion: Record<ReputacionCompetidor, number>;
    lideresCategoria: number;
    totalProductosAnalizados: number;
    precioPromedioGeneral: number;
    topCompetidoresPorAnalisis: Array<{
      id: string;
      codigo: string;
      nombre: string;
      productosAnalizados: number;
      precioPromedio: number;
      nivelAmenaza: string;
    }>;
    competidoresAmenazaAlta: Array<{
      id: string;
      codigo: string;
      nombre: string;
      plataformaPrincipal: PlataformaCompetidor;
      productosAnalizados: number;
    }>;
  }> {
    try {
      const todos = await this.getAll();
      const activos = todos.filter(c => c.estado === 'activo');
      const inactivos = todos.filter(c => c.estado !== 'activo');

      const porPlataforma: Record<PlataformaCompetidor, number> = {
        mercado_libre: 0,
        web_propia: 0,
        inkafarma: 0,
        mifarma: 0,
        amazon: 0,
        falabella: 0,
        otra: 0
      };

      const porNivelAmenaza: Record<string, number> = {
        bajo: 0,
        medio: 0,
        alto: 0
      };

      const porReputacion: Record<ReputacionCompetidor, number> = {
        excelente: 0,
        buena: 0,
        regular: 0,
        mala: 0,
        desconocida: 0
      };

      let lideresCategoria = 0;
      let totalProductosAnalizados = 0;
      let sumaPreciosPromedio = 0;
      let competidoresConPrecio = 0;

      activos.forEach(c => {
        porPlataforma[c.plataformaPrincipal]++;
        porNivelAmenaza[c.nivelAmenaza]++;
        porReputacion[c.reputacion]++;
        if (c.esLiderCategoria) lideresCategoria++;

        // Métricas de análisis
        const productosAnalizados = c.metricas?.productosAnalizados || 0;
        totalProductosAnalizados += productosAnalizados;

        if (c.metricas?.precioPromedio && c.metricas.precioPromedio > 0) {
          sumaPreciosPromedio += c.metricas.precioPromedio;
          competidoresConPrecio++;
        }
      });

      // Top competidores por productos analizados
      const topCompetidoresPorAnalisis = activos
        .filter(c => (c.metricas?.productosAnalizados || 0) > 0)
        .sort((a, b) => (b.metricas?.productosAnalizados || 0) - (a.metricas?.productosAnalizados || 0))
        .slice(0, 5)
        .map(c => ({
          id: c.id,
          codigo: c.codigo,
          nombre: c.nombre,
          productosAnalizados: c.metricas?.productosAnalizados || 0,
          precioPromedio: c.metricas?.precioPromedio || 0,
          nivelAmenaza: c.nivelAmenaza
        }));

      // Competidores con amenaza alta
      const competidoresAmenazaAlta = activos
        .filter(c => c.nivelAmenaza === 'alto')
        .map(c => ({
          id: c.id,
          codigo: c.codigo,
          nombre: c.nombre,
          plataformaPrincipal: c.plataformaPrincipal,
          productosAnalizados: c.metricas?.productosAnalizados || 0
        }));

      return {
        total: todos.length,
        activos: activos.length,
        inactivos: inactivos.length,
        porPlataforma,
        porNivelAmenaza,
        porReputacion,
        lideresCategoria,
        totalProductosAnalizados,
        precioPromedioGeneral: competidoresConPrecio > 0 ? sumaPreciosPromedio / competidoresConPrecio : 0,
        topCompetidoresPorAnalisis,
        competidoresAmenazaAlta
      };
    } catch (error: any) {
      console.error('Error obteniendo stats:', error);
      throw new Error('Error al cargar estadísticas');
    }
  },

  /**
   * Obtiene el próximo código que se generará
   */
  async getProximoCodigo(): Promise<string> {
    return generarCodigoCompetidor();
  }
};

export const CompetidorService = competidorService;
