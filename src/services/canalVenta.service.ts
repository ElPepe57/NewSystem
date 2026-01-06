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
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import type {
  CanalVenta,
  CanalVentaFormData,
  EstadoCanalVenta
} from '../types/canalVenta.types';
import { CANALES_SISTEMA } from '../types/canalVenta.types';

const COLLECTION_NAME = 'canalesVenta';

/**
 * Genera el siguiente código de canal automáticamente
 * Formato: CV-001, CV-002, etc.
 */
async function generarCodigoCanal(): Promise<string> {
  const prefix = 'CV';
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

export const canalVentaService = {
  // ============================================
  // CRUD BÁSICO
  // ============================================

  /**
   * Obtiene todos los canales de venta
   */
  async getAll(): Promise<CanalVenta[]> {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const canales = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as CanalVenta));

    // Ordenar por campo 'orden'
    return canales.sort((a, b) => (a.orden || 99) - (b.orden || 99));
  },

  /**
   * Obtiene solo los canales activos
   */
  async getActivos(): Promise<CanalVenta[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('estado', '==', 'activo')
    );
    const snapshot = await getDocs(q);
    const canales = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as CanalVenta));

    return canales.sort((a, b) => (a.orden || 99) - (b.orden || 99));
  },

  /**
   * Obtiene un canal por ID
   */
  async getById(id: string): Promise<CanalVenta | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    } as CanalVenta;
  },

  /**
   * Obtiene un canal por código
   */
  async getByCodigo(codigo: string): Promise<CanalVenta | null> {
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
    } as CanalVenta;
  },

  /**
   * Obtiene un canal por nombre (case insensitive)
   */
  async getByNombre(nombre: string): Promise<CanalVenta | null> {
    const canales = await this.getAll();
    return canales.find(c => c.nombre.toLowerCase() === nombre.toLowerCase()) || null;
  },

  /**
   * Crea un nuevo canal de venta
   */
  async create(data: CanalVentaFormData, userId: string): Promise<string> {
    // Validar que no exista otro canal con el mismo nombre
    const existente = await this.getByNombre(data.nombre);
    if (existente) {
      throw new Error(`Ya existe un canal con el nombre "${data.nombre}"`);
    }

    // Generar código si no se provee
    const codigo = data.codigo || await generarCodigoCanal();

    // Verificar código único
    const existentePorCodigo = await this.getByCodigo(codigo);
    if (existentePorCodigo) {
      throw new Error(`Ya existe un canal con el código "${codigo}"`);
    }

    // Obtener el máximo orden actual
    const canales = await this.getAll();
    const maxOrden = Math.max(...canales.map(c => c.orden || 0), 0);

    const nuevoCanal = {
      codigo,
      nombre: data.nombre,
      descripcion: data.descripcion || null,
      comisionPorcentaje: data.comisionPorcentaje ?? 0,
      requiereEnvio: data.requiereEnvio ?? true,
      tiempoProcesamientoDias: data.tiempoProcesamientoDias ?? null,
      color: data.color || '#6b7280',
      icono: data.icono || 'Tag',
      estado: data.estado || 'activo',
      esSistema: false, // Los canales creados por usuario no son de sistema
      orden: data.orden ?? (maxOrden + 1),
      creadoPor: userId,
      fechaCreacion: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevoCanal);

    logger.info('Canal de venta creado', {
      id: docRef.id,
      codigo,
      nombre: data.nombre,
      creadoPor: userId
    });

    return docRef.id;
  },

  /**
   * Actualiza un canal de venta
   */
  async update(
    id: string,
    data: Partial<CanalVentaFormData>,
    userId: string
  ): Promise<void> {
    const canal = await this.getById(id);
    if (!canal) {
      throw new Error('Canal no encontrado');
    }

    // Validar nombre único si se está cambiando
    if (data.nombre && data.nombre !== canal.nombre) {
      const existente = await this.getByNombre(data.nombre);
      if (existente && existente.id !== id) {
        throw new Error(`Ya existe un canal con el nombre "${data.nombre}"`);
      }
    }

    // No permitir cambiar código de canales del sistema
    if (canal.esSistema && data.codigo && data.codigo !== canal.codigo) {
      throw new Error('No se puede cambiar el código de un canal del sistema');
    }

    const updateData: Record<string, unknown> = {
      ...data,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now()
    };

    // Limpiar campos undefined
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, updateData);

    logger.info('Canal de venta actualizado', {
      id,
      cambios: Object.keys(data),
      actualizadoPor: userId
    });
  },

  /**
   * Cambia el estado de un canal (activar/desactivar)
   */
  async cambiarEstado(
    id: string,
    estado: EstadoCanalVenta,
    userId: string
  ): Promise<void> {
    const canal = await this.getById(id);
    if (!canal) {
      throw new Error('Canal no encontrado');
    }

    // No permitir desactivar canales del sistema
    if (canal.esSistema && estado === 'inactivo') {
      throw new Error('No se puede desactivar un canal del sistema');
    }

    await this.update(id, { estado }, userId);
  },

  /**
   * Reordena los canales
   */
  async reordenar(ordenCanales: { id: string; orden: number }[]): Promise<void> {
    const batch = writeBatch(db);

    for (const item of ordenCanales) {
      const docRef = doc(db, COLLECTION_NAME, item.id);
      batch.update(docRef, { orden: item.orden });
    }

    await batch.commit();
    logger.info('Canales reordenados', { cantidad: ordenCanales.length });
  },

  // ============================================
  // INICIALIZACIÓN
  // ============================================

  /**
   * Inicializa los canales del sistema si no existen
   * Llamar al iniciar la aplicación o en primer uso
   */
  async inicializarCanalesSistema(userId: string): Promise<void> {
    const canalesExistentes = await this.getAll();

    // Si ya hay canales, no hacer nada
    if (canalesExistentes.length > 0) {
      logger.info('Canales del sistema ya inicializados', {
        cantidad: canalesExistentes.length
      });
      return;
    }

    logger.info('Inicializando canales del sistema...');

    const batch = writeBatch(db);

    for (const canalBase of CANALES_SISTEMA) {
      const nuevoCanal = {
        ...canalBase,
        creadoPor: userId,
        fechaCreacion: Timestamp.now()
      };

      const docRef = doc(collection(db, COLLECTION_NAME));
      batch.set(docRef, nuevoCanal);
    }

    await batch.commit();

    logger.info('Canales del sistema inicializados', {
      cantidad: CANALES_SISTEMA.length
    });
  },

  // ============================================
  // UTILIDADES
  // ============================================

  /**
   * Obtiene el próximo código disponible
   */
  async getProximoCodigo(): Promise<string> {
    return generarCodigoCanal();
  },

  /**
   * Obtiene un canal por valor legacy (para migración)
   */
  async getByLegacyValue(legacyValue: string): Promise<CanalVenta | null> {
    // Mapeo de valores legacy a nombres
    const nombreMap: Record<string, string> = {
      'venta_directa': 'Venta Directa',
      'directo': 'Venta Directa',
      'mercado_libre': 'Mercado Libre',
      'whatsapp': 'WhatsApp',
      'instagram': 'Instagram',
      'otro': 'Otro'
    };

    const nombreBuscado = nombreMap[legacyValue.toLowerCase()];
    if (!nombreBuscado) {
      return null;
    }

    return this.getByNombre(nombreBuscado);
  }
};
