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
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  Transportista,
  TransportistaFormData,
  TransportistaStats,
  TransportistaFilters,
  TipoTransportista
} from '../types/transportista.types';

const COLLECTION_NAME = 'transportistas';

/**
 * Genera el siguiente código de transportista automáticamente
 * TR-001, TR-002, etc.
 */
async function generarCodigoTransportista(): Promise<string> {
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));

  let maxNumber = 0;
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    const codigo = data.codigo as string;

    if (codigo && codigo.startsWith('TR-')) {
      const match = codigo.match(/TR-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  });

  return `TR-${String(maxNumber + 1).padStart(3, '0')}`;
}

export const transportistaService = {
  // ============================================
  // CRUD BÁSICO
  // ============================================

  async getAll(): Promise<Transportista[]> {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const transportistas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Transportista));

    // Ordenar: activos primero, luego por nombre
    return transportistas.sort((a, b) => {
      if (a.estado !== b.estado) {
        return a.estado === 'activo' ? -1 : 1;
      }
      return a.nombre.localeCompare(b.nombre);
    });
  },

  async getActivos(): Promise<Transportista[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('estado', '==', 'activo')
    );
    const snapshot = await getDocs(q);
    const transportistas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Transportista));

    return transportistas.sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  async getById(id: string): Promise<Transportista | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    } as Transportista;
  },

  async getByCodigo(codigo: string): Promise<Transportista | null> {
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
    } as Transportista;
  },

  async getByTipo(tipo: TipoTransportista): Promise<Transportista[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('tipo', '==', tipo),
      where('estado', '==', 'activo')
    );
    const snapshot = await getDocs(q);
    const transportistas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Transportista));

    return transportistas.sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  async search(filters: TransportistaFilters): Promise<Transportista[]> {
    let q = query(collection(db, COLLECTION_NAME));

    if (filters.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }

    if (filters.courierExterno) {
      q = query(q, where('courierExterno', '==', filters.courierExterno));
    }

    if (filters.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }

    const snapshot = await getDocs(q);
    let transportistas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Transportista));

    // Filtro de búsqueda por texto (cliente)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      transportistas = transportistas.filter(t =>
        t.nombre.toLowerCase().includes(searchLower) ||
        t.codigo.toLowerCase().includes(searchLower) ||
        t.telefono?.toLowerCase().includes(searchLower)
      );
    }

    return transportistas.sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  // ============================================
  // CREAR Y ACTUALIZAR
  // ============================================

  async create(data: TransportistaFormData, userId: string): Promise<string> {
    // Generar código automático si no se proporciona
    let codigo = data.codigo?.trim();
    if (!codigo) {
      codigo = await generarCodigoTransportista();
    } else {
      // Si se proporciona código manual, verificar que no exista
      const existente = await this.getByCodigo(codigo);
      if (existente) {
        throw new Error('Ya existe un transportista con este código');
      }
    }

    const now = Timestamp.now();

    const newTransportista: Record<string, unknown> = {
      codigo,
      nombre: data.nombre,
      tipo: data.tipo,
      estado: 'activo',
      // Métricas iniciales
      totalEntregas: 0,
      entregasExitosas: 0,
      entregasFallidas: 0,
      tasaExito: 0,
      tiempoPromedioEntrega: 0,
      costoTotalHistorico: 0,
      zonasAtendidas: [],
      // Auditoría
      creadoPor: userId,
      fechaCreacion: now
    };

    // Campos opcionales
    if (data.courierExterno) newTransportista.courierExterno = data.courierExterno;
    if (data.telefono) newTransportista.telefono = data.telefono;
    if (data.email) newTransportista.email = data.email;
    if (data.comisionPorcentaje !== undefined) newTransportista.comisionPorcentaje = data.comisionPorcentaje;
    if (data.costoFijo !== undefined) newTransportista.costoFijo = data.costoFijo;
    if (data.dni) newTransportista.dni = data.dni;
    if (data.licencia) newTransportista.licencia = data.licencia;
    if (data.observaciones) newTransportista.observaciones = data.observaciones;

    const docRef = await addDoc(collection(db, COLLECTION_NAME), newTransportista);
    return docRef.id;
  },

  async update(id: string, data: Partial<TransportistaFormData>, userId: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);

    const updateData: Record<string, unknown> = {
      editadoPor: userId,
      ultimaEdicion: Timestamp.now()
    };

    // Solo agregar campos que tienen valor definido
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        updateData[key] = value;
      }
    });

    await updateDoc(docRef, updateData);
  },

  async toggleEstado(id: string, userId: string): Promise<void> {
    const transportista = await this.getById(id);
    if (!transportista) {
      throw new Error('Transportista no encontrado');
    }

    const nuevoEstado = transportista.estado === 'activo' ? 'inactivo' : 'activo';
    await this.update(id, { } as TransportistaFormData, userId);

    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      estado: nuevoEstado,
      editadoPor: userId,
      ultimaEdicion: Timestamp.now()
    });
  },

  // ============================================
  // MÉTRICAS
  // ============================================

  /**
   * Actualiza las métricas de un transportista después de una entrega
   */
  async registrarEntrega(
    transportistaId: string,
    exitosa: boolean,
    tiempoMinutos: number,
    costo: number,
    zona?: string
  ): Promise<void> {
    const transportista = await this.getById(transportistaId);
    if (!transportista) {
      throw new Error('Transportista no encontrado');
    }

    const totalEntregas = (transportista.totalEntregas || 0) + 1;
    const entregasExitosas = (transportista.entregasExitosas || 0) + (exitosa ? 1 : 0);
    const entregasFallidas = (transportista.entregasFallidas || 0) + (exitosa ? 0 : 1);
    const tasaExito = (entregasExitosas / totalEntregas) * 100;

    // Calcular nuevo tiempo promedio
    const tiempoAnterior = transportista.tiempoPromedioEntrega || 0;
    const tiempoPromedioEntrega = ((tiempoAnterior * (totalEntregas - 1)) + tiempoMinutos) / totalEntregas;

    // Actualizar costo total
    const costoTotalHistorico = (transportista.costoTotalHistorico || 0) + costo;
    const costoPromedioPorEntrega = costoTotalHistorico / totalEntregas;

    // Actualizar zonas atendidas
    let zonasAtendidas = transportista.zonasAtendidas || [];
    if (zona && !zonasAtendidas.includes(zona)) {
      zonasAtendidas = [...zonasAtendidas, zona];
    }

    const docRef = doc(db, COLLECTION_NAME, transportistaId);
    await updateDoc(docRef, {
      totalEntregas,
      entregasExitosas,
      entregasFallidas,
      tasaExito,
      tiempoPromedioEntrega,
      costoTotalHistorico,
      costoPromedioPorEntrega,
      zonasAtendidas,
      fechaUltimaEntrega: Timestamp.now()
    });
  },

  /**
   * Obtiene estadísticas detalladas de un transportista en un período
   */
  async getStats(
    transportistaId: string,
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<TransportistaStats> {
    const transportista = await this.getById(transportistaId);
    if (!transportista) {
      throw new Error('Transportista no encontrado');
    }

    // Obtener entregas del período
    const q = query(
      collection(db, 'entregas'),
      where('transportistaId', '==', transportistaId),
      where('fechaProgramada', '>=', Timestamp.fromDate(fechaInicio)),
      where('fechaProgramada', '<=', Timestamp.fromDate(fechaFin))
    );

    const snapshot = await getDocs(q);
    const entregas = snapshot.docs.map(doc => doc.data());

    const entregasExitosas = entregas.filter(e => e.estado === 'entregada').length;
    const entregasFallidas = entregas.filter(e => e.estado === 'fallida').length;
    const entregasPendientes = entregas.filter(e =>
      ['programada', 'en_camino', 'reprogramada'].includes(e.estado)
    ).length;

    const tasaExito = entregas.length > 0
      ? (entregasExitosas / entregas.length) * 100
      : 0;

    // Calcular tiempo promedio
    const entregasConTiempo = entregas.filter(e => e.tiempoEntregaMinutos);
    const tiempoPromedioHoras = entregasConTiempo.length > 0
      ? entregasConTiempo.reduce((sum, e) => sum + e.tiempoEntregaMinutos, 0) / entregasConTiempo.length / 60
      : 0;

    // Calcular costos
    const costoTotal = entregas.reduce((sum, e) => sum + (e.costoTransportista || 0), 0);
    const ingresoGenerado = entregas
      .filter(e => e.estado === 'entregada')
      .reduce((sum, e) => sum + (e.subtotalPEN || 0), 0);

    // Por zona
    const entregasPorZonaMap: Record<string, { cantidad: number; exitosas: number }> = {};
    entregas.forEach(e => {
      const zona = e.distrito || 'Sin zona';
      if (!entregasPorZonaMap[zona]) {
        entregasPorZonaMap[zona] = { cantidad: 0, exitosas: 0 };
      }
      entregasPorZonaMap[zona].cantidad++;
      if (e.estado === 'entregada') {
        entregasPorZonaMap[zona].exitosas++;
      }
    });

    // Por día de la semana
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const entregasPorDiaMap: Record<string, number> = {};
    diasSemana.forEach(dia => entregasPorDiaMap[dia] = 0);

    entregas.forEach(e => {
      if (e.fechaProgramada) {
        const fecha = e.fechaProgramada.toDate();
        const dia = diasSemana[fecha.getDay()];
        entregasPorDiaMap[dia]++;
      }
    });

    return {
      transportistaId,
      periodo: {
        inicio: Timestamp.fromDate(fechaInicio),
        fin: Timestamp.fromDate(fechaFin)
      },
      totalEntregas: entregas.length,
      entregasExitosas,
      entregasFallidas,
      entregasPendientes,
      tasaExito,
      tiempoPromedioHoras,
      costoTotal,
      ingresoGenerado,
      entregasPorZona: Object.entries(entregasPorZonaMap).map(([zona, data]) => ({
        zona,
        cantidad: data.cantidad,
        exitosas: data.exitosas
      })),
      entregasPorDia: Object.entries(entregasPorDiaMap).map(([dia, cantidad]) => ({
        dia,
        cantidad
      }))
    };
  },

  /**
   * Obtiene el ranking de transportistas por tasa de éxito
   */
  async getRanking(limite: number = 10): Promise<Transportista[]> {
    const transportistas = await this.getActivos();

    // Filtrar solo los que tienen entregas
    const conEntregas = transportistas.filter(t => (t.totalEntregas || 0) > 0);

    // Ordenar por tasa de éxito descendente
    return conEntregas
      .sort((a, b) => (b.tasaExito || 0) - (a.tasaExito || 0))
      .slice(0, limite);
  },

  // ============================================
  // CÓDIGOS
  // ============================================

  async getProximoCodigo(): Promise<string> {
    return generarCodigoTransportista();
  },

  // ============================================
  // SEED DE DATOS INICIALES
  // ============================================

  async seedDefaultTransportistas(userId: string): Promise<void> {
    const existentes = await this.getAll();

    if (existentes.length > 0) {
      console.log('Ya existen transportistas, no se ejecuta el seed');
      return;
    }

    const transportistasDefault: TransportistaFormData[] = [
      // Internos (Lima)
      {
        nombre: 'Carlos Mendoza',
        tipo: 'interno',
        telefono: '+51 999 111 222',
        comisionPorcentaje: 5,
        costoFijo: 8,
        dni: '12345678',
        observaciones: 'Socio repartidor Lima Norte'
      },
      {
        nombre: 'Luis García',
        tipo: 'interno',
        telefono: '+51 999 333 444',
        comisionPorcentaje: 5,
        costoFijo: 8,
        dni: '87654321',
        observaciones: 'Socio repartidor Lima Sur'
      },
      // Externos (Couriers)
      {
        nombre: 'Olva Courier',
        tipo: 'externo',
        courierExterno: 'olva',
        telefono: '0800-12345',
        costoFijo: 15,
        observaciones: 'Envíos a provincia - tarifas variables según destino'
      },
      {
        nombre: 'Mercado Envíos',
        tipo: 'externo',
        courierExterno: 'mercado_envios',
        costoFijo: 0,
        observaciones: 'Envíos Mercado Libre - costo incluido en venta'
      },
      {
        nombre: 'Urbano Express',
        tipo: 'externo',
        courierExterno: 'urbano',
        telefono: '01 234-5678',
        costoFijo: 12,
        observaciones: 'Envíos express Lima y Callao'
      },
      {
        nombre: 'Shalom',
        tipo: 'externo',
        courierExterno: 'shalom',
        telefono: '01 555-1234',
        costoFijo: 10,
        observaciones: 'Envíos económicos a provincia'
      }
    ];

    for (const transportista of transportistasDefault) {
      await this.create(transportista, userId);
    }

    console.log('Seed de transportistas completado:', transportistasDefault.length, 'transportistas creados');
  }
};
