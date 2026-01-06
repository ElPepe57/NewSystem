import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import type {
  Cliente,
  ClienteFormData,
  ClienteFiltros,
  ClienteSnapshot,
  ClienteStats,
  DireccionCliente,
  DuplicadoEncontrado,
  ClasificacionABC,
  SegmentoCliente,
  AnalisisRFM,
  HistorialClasificacion
} from '../types/entidadesMaestras.types';

const COLLECTION_NAME = 'clientes';

/**
 * Normalizar texto para búsqueda
 * Remueve acentos, convierte a minúsculas
 */
const normalizarTexto = (texto: string): string => {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .trim();
};

/**
 * Calcular similitud entre dos strings (0-100)
 */
const calcularSimilitud = (str1: string, str2: string): number => {
  const s1 = normalizarTexto(str1);
  const s2 = normalizarTexto(str2);

  if (s1 === s2) return 100;
  if (s1.includes(s2) || s2.includes(s1)) return 80;

  // Calcular distancia de Levenshtein simplificada
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 100;

  const editDistance = levenshteinDistance(longer, shorter);
  return Math.round((1 - editDistance / longer.length) * 100);
};

const levenshteinDistance = (s1: string, s2: string): number => {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
};

/**
 * Genera el siguiente código de cliente automáticamente
 * Formato: CLI-001, CLI-002, etc.
 */
async function generarCodigoCliente(): Promise<string> {
  const prefix = 'CLI';

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

export const clienteService = {
  /**
   * Obtener todos los clientes
   */
  async getAll(): Promise<Cliente[]> {
    try {
      // Sin orderBy para evitar requerir índices compuestos
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      const clientes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Cliente[];
      // Ordenar en cliente
      return clientes.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (error: any) {
      console.error('Error al obtener clientes:', error);
      throw new Error('Error al cargar clientes');
    }
  },

  /**
   * Obtener cliente por ID
   */
  async getById(id: string): Promise<Cliente | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Cliente;
    } catch (error: any) {
      console.error('Error al obtener cliente:', error);
      throw new Error('Error al cargar cliente');
    }
  },

  /**
   * Buscar clientes por término (nombre, teléfono, DNI/RUC, email)
   * Búsqueda inteligente con fuzzy matching
   */
  async buscar(termino: string, limite: number = 10): Promise<Cliente[]> {
    try {
      const terminoNormalizado = normalizarTexto(termino);

      // Obtener todos los clientes activos para búsqueda local
      // (Firestore no soporta búsqueda fuzzy nativa)
      const q = query(
        collection(db, COLLECTION_NAME),
        where('estado', 'in', ['activo', 'potencial']),
        limit(200) // Limitar para performance
      );

      const snapshot = await getDocs(q);
      const clientes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Cliente[];

      // Filtrar y ordenar por relevancia
      const resultados = clientes
        .map(cliente => {
          let score = 0;

          // Match exacto en DNI/RUC (máxima prioridad)
          if (cliente.dniRuc && normalizarTexto(cliente.dniRuc) === terminoNormalizado) {
            score = 100;
          }
          // Match exacto en teléfono
          else if (cliente.telefono && cliente.telefono.replace(/\D/g, '').includes(termino.replace(/\D/g, ''))) {
            score = 95;
          }
          // Match en email
          else if (cliente.email && normalizarTexto(cliente.email).includes(terminoNormalizado)) {
            score = 90;
          }
          // Match en nombre
          else {
            const nombreNorm = normalizarTexto(cliente.nombre);
            if (nombreNorm.includes(terminoNormalizado)) {
              score = 85;
            } else if (terminoNormalizado.split(' ').every(t => nombreNorm.includes(t))) {
              score = 75;
            } else {
              score = calcularSimilitud(cliente.nombre, termino);
              if (score < 50) score = 0; // Umbral mínimo
            }
          }

          return { cliente, score };
        })
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limite)
        .map(r => r.cliente);

      return resultados;
    } catch (error: any) {
      console.error('Error al buscar clientes:', error);
      throw new Error('Error en búsqueda de clientes');
    }
  },

  /**
   * Buscar por DNI/RUC exacto
   */
  async buscarPorDniRuc(dniRuc: string): Promise<Cliente | null> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('dniRuc', '==', dniRuc),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      return {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      } as Cliente;
    } catch (error: any) {
      console.error('Error al buscar por DNI/RUC:', error);
      throw new Error('Error en búsqueda');
    }
  },

  /**
   * Buscar por teléfono
   */
  async buscarPorTelefono(telefono: string): Promise<Cliente | null> {
    try {
      // Normalizar teléfono (solo dígitos)
      const telefonoLimpio = telefono.replace(/\D/g, '');

      const q = query(
        collection(db, COLLECTION_NAME),
        limit(100)
      );

      const snapshot = await getDocs(q);
      const clientes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Cliente[];

      // Buscar coincidencia en teléfono o teléfono alternativo
      const encontrado = clientes.find(c =>
        (c.telefono && c.telefono.replace(/\D/g, '').includes(telefonoLimpio)) ||
        (c.telefonoAlt && c.telefonoAlt.replace(/\D/g, '').includes(telefonoLimpio))
      );

      return encontrado || null;
    } catch (error: any) {
      console.error('Error al buscar por teléfono:', error);
      throw new Error('Error en búsqueda');
    }
  },

  /**
   * Detectar posibles duplicados antes de crear
   */
  async detectarDuplicados(data: ClienteFormData): Promise<DuplicadoEncontrado<Cliente>[]> {
    const duplicados: DuplicadoEncontrado<Cliente>[] = [];

    try {
      // Verificar DNI/RUC
      if (data.dniRuc) {
        const porDni = await this.buscarPorDniRuc(data.dniRuc);
        if (porDni) {
          duplicados.push({
            entidad: porDni,
            campo: 'dniRuc',
            valorCoincidente: data.dniRuc,
            similitud: 100
          });
        }
      }

      // Verificar teléfono
      if (data.telefono) {
        const porTelefono = await this.buscarPorTelefono(data.telefono);
        if (porTelefono && !duplicados.find(d => d.entidad.id === porTelefono.id)) {
          duplicados.push({
            entidad: porTelefono,
            campo: 'telefono',
            valorCoincidente: data.telefono,
            similitud: 100
          });
        }
      }

      // Verificar nombre similar
      const porNombre = await this.buscar(data.nombre, 3);
      for (const cliente of porNombre) {
        if (!duplicados.find(d => d.entidad.id === cliente.id)) {
          const similitud = calcularSimilitud(data.nombre, cliente.nombre);
          if (similitud >= 80) {
            duplicados.push({
              entidad: cliente,
              campo: 'nombre',
              valorCoincidente: cliente.nombre,
              similitud
            });
          }
        }
      }

      return duplicados;
    } catch (error: any) {
      console.error('Error al detectar duplicados:', error);
      return [];
    }
  },

  /**
   * Crear nuevo cliente
   */
  async create(data: ClienteFormData, userId: string): Promise<string> {
    try {
      // Generar IDs para direcciones
      const direcciones: DireccionCliente[] = (data.direcciones || []).map((dir, idx) => ({
        ...dir,
        id: `DIR-${Date.now()}-${idx}`,
        esPrincipal: idx === 0
      }));

      const direccionPrincipal = direcciones.find(d => d.esPrincipal)?.direccion;

      // Generar código automático
      const codigo = await generarCodigoCliente();

      // Construir objeto sin valores undefined (Firestore no los acepta)
      const nuevoCliente: any = {
        codigo,
        nombre: data.nombre.trim(),
        tipoCliente: data.tipoCliente,
        canalOrigen: data.canalOrigen,
        estado: 'activo',
        metricas: {
          totalCompras: 0,
          montoTotalPEN: 0,
          ticketPromedio: 0
        },
        etiquetas: data.etiquetas || [],
        creadoPor: userId,
        fechaCreacion: serverTimestamp()
      };

      // Solo agregar campos opcionales si tienen valor
      if (data.nombreCorto?.trim()) nuevoCliente.nombreCorto = data.nombreCorto.trim();
      if (data.dniRuc?.trim()) nuevoCliente.dniRuc = data.dniRuc.trim();
      if (data.telefono?.trim()) nuevoCliente.telefono = data.telefono.trim();
      if (data.telefonoAlt?.trim()) nuevoCliente.telefonoAlt = data.telefonoAlt.trim();
      if (data.email?.trim()) nuevoCliente.email = data.email.trim().toLowerCase();
      if (direcciones.length > 0) nuevoCliente.direcciones = direcciones;
      if (direccionPrincipal) nuevoCliente.direccionPrincipal = direccionPrincipal;
      if (data.referidoPor?.trim()) nuevoCliente.referidoPor = data.referidoPor.trim();
      if (data.notas?.trim()) nuevoCliente.notas = data.notas.trim();

      const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevoCliente);
      return docRef.id;
    } catch (error: any) {
      console.error('Error al crear cliente:', error);
      throw new Error('Error al crear cliente');
    }
  },

  /**
   * Actualizar cliente
   */
  async update(id: string, data: Partial<ClienteFormData>, userId: string): Promise<void> {
    try {
      const updates: any = {
        actualizadoPor: userId,
        fechaActualizacion: serverTimestamp()
      };

      if (data.nombre !== undefined) updates.nombre = data.nombre.trim();
      if (data.nombreCorto !== undefined) updates.nombreCorto = data.nombreCorto?.trim();
      if (data.tipoCliente !== undefined) updates.tipoCliente = data.tipoCliente;
      if (data.dniRuc !== undefined) updates.dniRuc = data.dniRuc?.trim();
      if (data.telefono !== undefined) updates.telefono = data.telefono?.trim();
      if (data.telefonoAlt !== undefined) updates.telefonoAlt = data.telefonoAlt?.trim();
      if (data.email !== undefined) updates.email = data.email?.trim().toLowerCase();
      if (data.canalOrigen !== undefined) updates.canalOrigen = data.canalOrigen;
      if (data.referidoPor !== undefined) updates.referidoPor = data.referidoPor?.trim();
      if (data.notas !== undefined) updates.notas = data.notas?.trim();
      if (data.etiquetas !== undefined) updates.etiquetas = data.etiquetas;

      if (data.direcciones !== undefined) {
        const direcciones: DireccionCliente[] = data.direcciones.map((dir, idx) => ({
          ...dir,
          id: `DIR-${Date.now()}-${idx}`,
          esPrincipal: idx === 0
        }));
        updates.direcciones = direcciones;
        updates.direccionPrincipal = direcciones.find(d => d.esPrincipal)?.direccion;
      }

      await updateDoc(doc(db, COLLECTION_NAME, id), updates);
    } catch (error: any) {
      console.error('Error al actualizar cliente:', error);
      throw new Error('Error al actualizar cliente');
    }
  },

  /**
   * Cambiar estado del cliente
   */
  async cambiarEstado(id: string, estado: 'activo' | 'inactivo' | 'potencial', userId: string): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTION_NAME, id), {
        estado,
        actualizadoPor: userId,
        fechaActualizacion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error al cambiar estado:', error);
      throw new Error('Error al cambiar estado');
    }
  },

  /**
   * Actualizar métricas del cliente (llamado después de cada venta)
   */
  async actualizarMetricas(
    clienteId: string,
    montoVenta: number,
    productoIds?: string[]
  ): Promise<void> {
    try {
      const cliente = await this.getById(clienteId);
      if (!cliente) return;

      const metricas = cliente.metricas || {
        totalCompras: 0,
        montoTotalPEN: 0,
        ticketPromedio: 0
      };

      const nuevoTotal = metricas.totalCompras + 1;
      const nuevoMonto = metricas.montoTotalPEN + montoVenta;

      // Actualizar productos favoritos
      let productosFavoritos = metricas.productosFavoritos || [];
      if (productoIds) {
        productosFavoritos = [...new Set([...productosFavoritos, ...productoIds])].slice(0, 10);
      }

      await updateDoc(doc(db, COLLECTION_NAME, clienteId), {
        metricas: {
          totalCompras: nuevoTotal,
          montoTotalPEN: nuevoMonto,
          ultimaCompra: serverTimestamp(),
          ticketPromedio: nuevoMonto / nuevoTotal,
          productosFavoritos
        }
      });
    } catch (error: any) {
      console.error('Error al actualizar métricas:', error);
    }
  },

  /**
   * Obtener o crear cliente
   * Si existe por DNI/teléfono, retorna existente. Si no, crea nuevo.
   */
  async getOrCreate(data: ClienteFormData, userId: string): Promise<{ cliente: Cliente; esNuevo: boolean }> {
    try {
      // Buscar por DNI/RUC primero
      if (data.dniRuc) {
        const existente = await this.buscarPorDniRuc(data.dniRuc);
        if (existente) {
          return { cliente: existente, esNuevo: false };
        }
      }

      // Buscar por teléfono
      if (data.telefono) {
        const existente = await this.buscarPorTelefono(data.telefono);
        if (existente) {
          return { cliente: existente, esNuevo: false };
        }
      }

      // Crear nuevo
      const nuevoId = await this.create(data, userId);
      const nuevoCliente = await this.getById(nuevoId);

      return { cliente: nuevoCliente!, esNuevo: true };
    } catch (error: any) {
      console.error('Error en getOrCreate:', error);
      throw new Error('Error al obtener/crear cliente');
    }
  },

  /**
   * Obtener snapshot para desnormalizar en venta
   */
  getSnapshot(cliente: Cliente): ClienteSnapshot {
    return {
      clienteId: cliente.id,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      email: cliente.email,
      dniRuc: cliente.dniRuc
    };
  },

  /**
   * Obtener estadísticas de clientes
   */
  async getStats(): Promise<ClienteStats> {
    try {
      const clientes = await this.getAll();

      const clientesActivos = clientes.filter(c => c.estado === 'activo');
      const clientesConCompras = clientes.filter(c => c.metricas.totalCompras > 0);

      const ahora = new Date();
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      const clientesNuevosMes = clientes.filter(c => {
        const fecha = c.fechaCreacion?.toDate?.() || new Date(0);
        return fecha >= inicioMes;
      });

      // Top clientes por monto
      const topClientesPorMonto = [...clientesConCompras]
        .sort((a, b) => b.metricas.montoTotalPEN - a.metricas.montoTotalPEN)
        .slice(0, 10)
        .map(c => ({
          clienteId: c.id,
          nombre: c.nombre,
          montoTotalPEN: c.metricas.montoTotalPEN
        }));

      // Por canal
      const clientesPorCanal: Record<string, number> = {};
      for (const cliente of clientes) {
        clientesPorCanal[cliente.canalOrigen] = (clientesPorCanal[cliente.canalOrigen] || 0) + 1;
      }

      // Ticket promedio general
      const montoTotal = clientesConCompras.reduce((sum, c) => sum + c.metricas.montoTotalPEN, 0);
      const comprasTotal = clientesConCompras.reduce((sum, c) => sum + c.metricas.totalCompras, 0);
      const ticketPromedioGeneral = comprasTotal > 0 ? montoTotal / comprasTotal : 0;

      return {
        totalClientes: clientes.length,
        clientesActivos: clientesActivos.length,
        clientesNuevosMes: clientesNuevosMes.length,
        clientesConCompras: clientesConCompras.length,
        ticketPromedioGeneral,
        topClientesPorMonto,
        clientesPorCanal: clientesPorCanal as any
      };
    } catch (error: any) {
      console.error('Error al obtener stats:', error);
      throw new Error('Error al obtener estadísticas');
    }
  },

  /**
   * Agregar dirección a cliente
   */
  async agregarDireccion(
    clienteId: string,
    direccion: Omit<DireccionCliente, 'id'>,
    userId: string
  ): Promise<void> {
    try {
      const cliente = await this.getById(clienteId);
      if (!cliente) throw new Error('Cliente no encontrado');

      const nuevaDireccion: DireccionCliente = {
        ...direccion,
        id: `DIR-${Date.now()}`
      };

      // Si es principal, desmarcar las demás
      let direcciones = cliente.direcciones || [];
      if (direccion.esPrincipal) {
        direcciones = direcciones.map(d => ({ ...d, esPrincipal: false }));
      }

      direcciones.push(nuevaDireccion);

      await updateDoc(doc(db, COLLECTION_NAME, clienteId), {
        direcciones,
        direccionPrincipal: direccion.esPrincipal ? direccion.direccion : cliente.direccionPrincipal,
        actualizadoPor: userId,
        fechaActualizacion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error al agregar dirección:', error);
      throw new Error('Error al agregar dirección');
    }
  },

  /**
   * Eliminar cliente (solo si no tiene ventas)
   */
  async delete(id: string): Promise<void> {
    try {
      const cliente = await this.getById(id);
      if (!cliente) throw new Error('Cliente no encontrado');

      if (cliente.metricas.totalCompras > 0) {
        throw new Error('No se puede eliminar un cliente con historial de compras. Márquelo como inactivo.');
      }

      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error: any) {
      console.error('Error al eliminar cliente:', error);
      throw new Error(error.message || 'Error al eliminar cliente');
    }
  },

  /**
   * Obtiene el próximo código que se generará
   * Útil para mostrar al usuario antes de crear
   */
  async getProximoCodigo(): Promise<string> {
    return generarCodigoCliente();
  },

  // ========== CRM - CLASIFICACIÓN ABC ==========

  /**
   * Calcula la clasificación ABC de todos los clientes
   * Usa el principio de Pareto: 20% genera 80%, 30% genera 15%, 50% genera 5%
   */
  async calcularClasificacionABC(): Promise<{
    actualizados: number;
    clientesPorClase: Record<ClasificacionABC, number>;
  }> {
    try {
      const clientes = await this.getAll();

      // Filtrar clientes con compras y ordenar por monto
      const clientesConCompras = clientes
        .filter(c => c.metricas.montoTotalPEN > 0)
        .sort((a, b) => b.metricas.montoTotalPEN - a.metricas.montoTotalPEN);

      if (clientesConCompras.length === 0) {
        return { actualizados: 0, clientesPorClase: { A: 0, B: 0, C: 0, nuevo: clientes.length } };
      }

      // Calcular monto total
      const montoTotal = clientesConCompras.reduce(
        (sum, c) => sum + c.metricas.montoTotalPEN, 0
      );

      // Calcular acumulado y asignar clasificación
      let montoAcumulado = 0;
      const clasificaciones: Array<{ clienteId: string; clasificacion: ClasificacionABC }> = [];

      for (const cliente of clientesConCompras) {
        montoAcumulado += cliente.metricas.montoTotalPEN;
        const porcentajeAcumulado = (montoAcumulado / montoTotal) * 100;

        let clasificacion: ClasificacionABC;
        if (porcentajeAcumulado <= 80) {
          clasificacion = 'A';  // Top 20% que genera ~80%
        } else if (porcentajeAcumulado <= 95) {
          clasificacion = 'B';  // Siguiente 30% que genera ~15%
        } else {
          clasificacion = 'C';  // Restante 50% que genera ~5%
        }

        clasificaciones.push({ clienteId: cliente.id, clasificacion });
      }

      // Actualizar en batch
      const batch = writeBatch(db);
      const ahora = Timestamp.now();

      for (const { clienteId, clasificacion } of clasificaciones) {
        const clienteRef = doc(db, COLLECTION_NAME, clienteId);
        const clienteActual = clientes.find(c => c.id === clienteId);

        // Crear historial si la clasificación cambió
        const updates: Record<string, unknown> = {
          clasificacionABC: clasificacion,
          fechaUltimaClasificacion: ahora
        };

        if (clienteActual?.clasificacionABC && clienteActual.clasificacionABC !== clasificacion) {
          const historial: HistorialClasificacion = {
            fecha: ahora,
            clasificacionAnterior: clienteActual.clasificacionABC,
            clasificacionNueva: clasificacion,
            segmentoAnterior: clienteActual.segmento || 'nuevo',
            segmentoNuevo: clienteActual.segmento || 'nuevo',
            motivo: 'Recálculo automático ABC'
          };

          const historialActual = clienteActual.historialClasificacion || [];
          updates.historialClasificacion = [...historialActual.slice(-9), historial];
        }

        batch.update(clienteRef, updates);
      }

      // Marcar clientes sin compras como 'nuevo'
      const clientesSinCompras = clientes.filter(c => c.metricas.montoTotalPEN === 0);
      for (const cliente of clientesSinCompras) {
        const clienteRef = doc(db, COLLECTION_NAME, cliente.id);
        batch.update(clienteRef, {
          clasificacionABC: 'nuevo',
          fechaUltimaClasificacion: ahora
        });
      }

      await batch.commit();

      // Contar por clase
      const clientesPorClase: Record<ClasificacionABC, number> = {
        A: clasificaciones.filter(c => c.clasificacion === 'A').length,
        B: clasificaciones.filter(c => c.clasificacion === 'B').length,
        C: clasificaciones.filter(c => c.clasificacion === 'C').length,
        nuevo: clientesSinCompras.length
      };

      return {
        actualizados: clientes.length,
        clientesPorClase
      };
    } catch (error: any) {
      console.error('Error al calcular clasificación ABC:', error);
      throw new Error('Error al calcular clasificación ABC');
    }
  },

  /**
   * Determina el segmento de un cliente basado en RFM
   */
  determinarSegmento(
    clasificacionABC: ClasificacionABC,
    diasDesdeUltimaCompra: number,
    frecuenciaAnual: number
  ): SegmentoCliente {
    // Sin compras
    if (clasificacionABC === 'nuevo' || frecuenciaAnual === 0) {
      return 'nuevo';
    }

    // Perdido: más de 180 días sin comprar
    if (diasDesdeUltimaCompra > 180) {
      return 'perdido';
    }

    // Inactivo: más de 90 días sin comprar
    if (diasDesdeUltimaCompra > 90) {
      // Si era frecuente, está en riesgo
      if (frecuenciaAnual >= 4) {
        return 'en_riesgo';
      }
      return 'inactivo';
    }

    // Clasificación A
    if (clasificacionABC === 'A') {
      if (frecuenciaAnual >= 6 && diasDesdeUltimaCompra <= 30) {
        return 'vip';
      }
      return 'premium';
    }

    // Clasificación B
    if (clasificacionABC === 'B') {
      if (frecuenciaAnual >= 4) {
        return 'frecuente';
      }
      return 'regular';
    }

    // Clasificación C
    return 'ocasional';
  },

  /**
   * Calcula el análisis RFM para un cliente
   */
  calcularRFM(
    diasDesdeUltimaCompra: number,
    frecuenciaAnual: number,
    montoAnual: number,
    promediosGlobales: { recencia: number; frecuencia: number; monetario: number }
  ): AnalisisRFM {
    // Calcular scores (1-5)
    const scoreRecencia = diasDesdeUltimaCompra <= 7 ? 5 :
                          diasDesdeUltimaCompra <= 30 ? 4 :
                          diasDesdeUltimaCompra <= 60 ? 3 :
                          diasDesdeUltimaCompra <= 90 ? 2 : 1;

    const scoreFrecuencia = frecuenciaAnual >= 12 ? 5 :
                            frecuenciaAnual >= 6 ? 4 :
                            frecuenciaAnual >= 4 ? 3 :
                            frecuenciaAnual >= 2 ? 2 : 1;

    const ratioMonetario = promediosGlobales.monetario > 0
      ? montoAnual / promediosGlobales.monetario
      : 1;

    const scoreMonetario = ratioMonetario >= 2 ? 5 :
                           ratioMonetario >= 1.5 ? 4 :
                           ratioMonetario >= 1 ? 3 :
                           ratioMonetario >= 0.5 ? 2 : 1;

    return {
      recencia: diasDesdeUltimaCompra,
      frecuencia: frecuenciaAnual,
      valorMonetario: montoAnual,
      scoreRecencia,
      scoreFrecuencia,
      scoreMonetario,
      scoreTotal: (scoreRecencia + scoreFrecuencia + scoreMonetario) / 3
    };
  },

  /**
   * Actualiza métricas y clasificación de un cliente después de una venta
   */
  async actualizarMetricasPorVenta(
    clienteId: string,
    datosVenta: {
      montoVenta: number;
      productoIds?: string[];
    }
  ): Promise<void> {
    try {
      const cliente = await this.getById(clienteId);
      if (!cliente) return;

      const ahora = new Date();
      const metricas = cliente.metricas || {
        totalCompras: 0,
        montoTotalPEN: 0,
        ticketPromedio: 0
      };

      // Actualizar métricas básicas
      const nuevoTotal = metricas.totalCompras + 1;
      const nuevoMonto = metricas.montoTotalPEN + datosVenta.montoVenta;

      // Actualizar productos favoritos
      let productosFavoritos = metricas.productosFavoritos || [];
      if (datosVenta.productoIds) {
        productosFavoritos = [...new Set([...productosFavoritos, ...datosVenta.productoIds])].slice(0, 10);
      }

      // Calcular días desde última compra (0 porque es compra actual)
      const diasDesdeUltimaCompra = 0;

      // Estimar frecuencia anual (simplificado)
      const frecuenciaAnual = Math.min(nuevoTotal, 12);

      // Determinar nuevo segmento
      const clasificacionActual = cliente.clasificacionABC || 'nuevo';
      const nuevoSegmento = this.determinarSegmento(
        clasificacionActual,
        diasDesdeUltimaCompra,
        frecuenciaAnual
      );

      // Preparar actualización
      const updates: Record<string, unknown> = {
        metricas: {
          totalCompras: nuevoTotal,
          montoTotalPEN: nuevoMonto,
          ultimaCompra: serverTimestamp(),
          ticketPromedio: nuevoMonto / nuevoTotal,
          productosFavoritos,
          comprasUltimos30Dias: (metricas.comprasUltimos30Dias || 0) + 1,
          comprasUltimos90Dias: (metricas.comprasUltimos90Dias || 0) + 1,
          comprasUltimos365Dias: (metricas.comprasUltimos365Dias || 0) + 1,
          montoUltimos365Dias: (metricas.montoUltimos365Dias || 0) + datosVenta.montoVenta
        },
        segmento: nuevoSegmento
      };

      // Si el segmento cambió, agregar al historial
      if (cliente.segmento && cliente.segmento !== nuevoSegmento) {
        const historial: HistorialClasificacion = {
          fecha: Timestamp.now(),
          clasificacionAnterior: clasificacionActual,
          clasificacionNueva: clasificacionActual,
          segmentoAnterior: cliente.segmento,
          segmentoNuevo: nuevoSegmento,
          motivo: 'Actualización por venta'
        };

        const historialActual = cliente.historialClasificacion || [];
        updates.historialClasificacion = [...historialActual.slice(-9), historial];
      }

      await updateDoc(doc(db, COLLECTION_NAME, clienteId), updates);

      logger.success(`Métricas CRM actualizadas para cliente ${clienteId}`);
    } catch (error: any) {
      console.error('Error al actualizar métricas CRM:', error);
    }
  },

  /**
   * Obtiene clientes por clasificación ABC
   */
  async getByClasificacion(clasificacion: ClasificacionABC): Promise<Cliente[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('clasificacionABC', '==', clasificacion)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Cliente));
    } catch (error: any) {
      console.error('Error al obtener clientes por clasificación:', error);
      return [];
    }
  },

  /**
   * Obtiene clientes por segmento
   */
  async getBySegmento(segmento: SegmentoCliente): Promise<Cliente[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('segmento', '==', segmento)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Cliente));
    } catch (error: any) {
      console.error('Error al obtener clientes por segmento:', error);
      return [];
    }
  },

  /**
   * Obtiene clientes en riesgo de perderse
   */
  async getClientesEnRiesgo(): Promise<Cliente[]> {
    try {
      const enRiesgo = await this.getBySegmento('en_riesgo');
      const inactivos = await this.getBySegmento('inactivo');
      return [...enRiesgo, ...inactivos];
    } catch (error: any) {
      console.error('Error al obtener clientes en riesgo:', error);
      return [];
    }
  },

  // ========== CRM AVANZADO - ESTADÍSTICAS Y ALERTAS ==========

  /**
   * Obtiene estadísticas CRM completas para el dashboard
   */
  async getStatsCRM(): Promise<{
    // Clasificación ABC
    distribucionABC: { clase: ClasificacionABC; cantidad: number; porcentaje: number; valorTotal: number }[];
    valorPorClase: Record<ClasificacionABC, number>;

    // Segmentación
    distribucionSegmentos: { segmento: SegmentoCliente; cantidad: number; porcentaje: number }[];

    // Alertas
    clientesEnRiesgo: Cliente[];
    clientesPerdidos: Cliente[];
    clientesSinContacto30Dias: Cliente[];
    clientesVIPInactivos: Cliente[];

    // Tendencias
    clientesNuevosUltimos7Dias: number;
    clientesNuevosUltimos30Dias: number;
    tasaRetencion: number;

    // Top performers
    topVIP: Cliente[];
    topPremium: Cliente[];
    clientesMayorCrecimiento: Cliente[];
  }> {
    try {
      const clientes = await this.getAll();
      const ahora = new Date();
      const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
      const hace7Dias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
      const hace90Dias = new Date(ahora.getTime() - 90 * 24 * 60 * 60 * 1000);

      // Distribución ABC
      const clientesPorABC: Record<ClasificacionABC, Cliente[]> = {
        A: [], B: [], C: [], nuevo: []
      };
      const valorPorClase: Record<ClasificacionABC, number> = {
        A: 0, B: 0, C: 0, nuevo: 0
      };

      for (const c of clientes) {
        const clase = c.clasificacionABC || 'nuevo';
        clientesPorABC[clase].push(c);
        valorPorClase[clase] += c.metricas.montoTotalPEN || 0;
      }

      const totalClientes = clientes.length;
      const valorTotal = Object.values(valorPorClase).reduce((a, b) => a + b, 0);

      const distribucionABC = (['A', 'B', 'C', 'nuevo'] as ClasificacionABC[]).map(clase => ({
        clase,
        cantidad: clientesPorABC[clase].length,
        porcentaje: totalClientes > 0 ? (clientesPorABC[clase].length / totalClientes) * 100 : 0,
        valorTotal: valorPorClase[clase]
      }));

      // Distribución por segmentos
      const clientesPorSegmento: Record<SegmentoCliente, number> = {
        vip: 0, premium: 0, frecuente: 0, regular: 0,
        ocasional: 0, nuevo: 0, inactivo: 0, en_riesgo: 0, perdido: 0
      };

      for (const c of clientes) {
        const segmento = c.segmento || 'nuevo';
        clientesPorSegmento[segmento]++;
      }

      const distribucionSegmentos = Object.entries(clientesPorSegmento)
        .filter(([, cantidad]) => cantidad > 0)
        .map(([segmento, cantidad]) => ({
          segmento: segmento as SegmentoCliente,
          cantidad,
          porcentaje: totalClientes > 0 ? (cantidad / totalClientes) * 100 : 0
        }))
        .sort((a, b) => b.cantidad - a.cantidad);

      // Alertas: Clientes en riesgo
      const clientesEnRiesgo = clientes.filter(c => c.segmento === 'en_riesgo')
        .sort((a, b) => b.metricas.montoTotalPEN - a.metricas.montoTotalPEN)
        .slice(0, 10);

      // Alertas: Clientes perdidos (> 180 días sin comprar, pero con historial significativo)
      const clientesPerdidos = clientes.filter(c => {
        if (c.segmento !== 'perdido') return false;
        return c.metricas.totalCompras >= 2; // Al menos 2 compras históricas
      }).sort((a, b) => b.metricas.montoTotalPEN - a.metricas.montoTotalPEN)
        .slice(0, 10);

      // Alertas: Clientes sin contacto en 30 días (pero activos)
      const clientesSinContacto30Dias = clientes.filter(c => {
        if (c.estado !== 'activo') return false;
        if (!c.metricas.ultimaCompra) return false;
        const ultimaCompra = c.metricas.ultimaCompra.toDate?.() || new Date(c.metricas.ultimaCompra as unknown as string);
        const dias = Math.floor((ahora.getTime() - ultimaCompra.getTime()) / (1000 * 60 * 60 * 24));
        return dias >= 30 && dias < 90 && c.metricas.totalCompras >= 2;
      }).sort((a, b) => b.metricas.montoTotalPEN - a.metricas.montoTotalPEN)
        .slice(0, 10);

      // Alertas: VIPs que no han comprado en 15+ días
      const clientesVIPInactivos = clientes.filter(c => {
        if (c.clasificacionABC !== 'A') return false;
        if (!c.metricas.ultimaCompra) return false;
        const ultimaCompra = c.metricas.ultimaCompra.toDate?.() || new Date(c.metricas.ultimaCompra as unknown as string);
        const dias = Math.floor((ahora.getTime() - ultimaCompra.getTime()) / (1000 * 60 * 60 * 24));
        return dias >= 15;
      }).sort((a, b) => b.metricas.montoTotalPEN - a.metricas.montoTotalPEN)
        .slice(0, 5);

      // Tendencias: Nuevos últimos 7 días
      const clientesNuevosUltimos7Dias = clientes.filter(c => {
        const fecha = c.fechaCreacion?.toDate?.() || new Date(0);
        return fecha >= hace7Dias;
      }).length;

      // Tendencias: Nuevos últimos 30 días
      const clientesNuevosUltimos30Dias = clientes.filter(c => {
        const fecha = c.fechaCreacion?.toDate?.() || new Date(0);
        return fecha >= hace30Dias;
      }).length;

      // Tasa de retención (clientes que compraron en últimos 90 días / clientes con al menos 1 compra)
      const clientesConCompras = clientes.filter(c => c.metricas.totalCompras > 0);
      const clientesRecientes = clientes.filter(c => {
        if (!c.metricas.ultimaCompra) return false;
        const ultimaCompra = c.metricas.ultimaCompra.toDate?.() || new Date(c.metricas.ultimaCompra as unknown as string);
        return ultimaCompra >= hace90Dias;
      });
      const tasaRetencion = clientesConCompras.length > 0
        ? (clientesRecientes.length / clientesConCompras.length) * 100
        : 0;

      // Top Clase A (mejores clientes por valor - clasificación ABC)
      const topVIP = clientes
        .filter(c => c.clasificacionABC === 'A')
        .sort((a, b) => b.metricas.montoTotalPEN - a.metricas.montoTotalPEN)
        .slice(0, 5);

      // Top Premium (clientes frecuentes Clase B con buen valor)
      const topPremium = clientes
        .filter(c => c.clasificacionABC === 'B' || c.segmento === 'frecuente')
        .sort((a, b) => b.metricas.montoTotalPEN - a.metricas.montoTotalPEN)
        .slice(0, 5);

      // Clientes con mayor crecimiento (más compras en últimos 30 días)
      const clientesMayorCrecimiento = clientes
        .filter(c => (c.metricas.comprasUltimos30Dias || 0) >= 2)
        .sort((a, b) =>
          (b.metricas.comprasUltimos30Dias || 0) - (a.metricas.comprasUltimos30Dias || 0)
        )
        .slice(0, 5);

      return {
        distribucionABC,
        valorPorClase,
        distribucionSegmentos,
        clientesEnRiesgo,
        clientesPerdidos,
        clientesSinContacto30Dias,
        clientesVIPInactivos,
        clientesNuevosUltimos7Dias,
        clientesNuevosUltimos30Dias,
        tasaRetencion,
        topVIP,
        topPremium,
        clientesMayorCrecimiento
      };
    } catch (error: any) {
      console.error('Error al obtener stats CRM:', error);
      throw new Error('Error al obtener estadísticas CRM');
    }
  },

  /**
   * Obtiene el conteo de alertas activas para badge
   */
  async getAlertasCRM(): Promise<{
    enRiesgo: number;
    perdidos: number;
    vipInactivos: number;
    sinContacto: number;
    total: number;
  }> {
    try {
      const stats = await this.getStatsCRM();
      return {
        enRiesgo: stats.clientesEnRiesgo.length,
        perdidos: stats.clientesPerdidos.length,
        vipInactivos: stats.clientesVIPInactivos.length,
        sinContacto: stats.clientesSinContacto30Dias.length,
        total: stats.clientesEnRiesgo.length + stats.clientesPerdidos.length +
               stats.clientesVIPInactivos.length
      };
    } catch (error: any) {
      console.error('Error al obtener alertas CRM:', error);
      return { enRiesgo: 0, perdidos: 0, vipInactivos: 0, sinContacto: 0, total: 0 };
    }
  },

  /**
   * Recalcula segmentos de todos los clientes basado en comportamiento actual
   */
  async recalcularSegmentos(): Promise<{ actualizados: number }> {
    try {
      const clientes = await this.getAll();
      const ahora = new Date();
      const batch = writeBatch(db);
      let actualizados = 0;

      for (const cliente of clientes) {
        // Calcular días desde última compra
        let diasDesdeUltimaCompra = 999;
        if (cliente.metricas.ultimaCompra) {
          const ultimaCompra = cliente.metricas.ultimaCompra.toDate?.() ||
            new Date(cliente.metricas.ultimaCompra as unknown as string);
          diasDesdeUltimaCompra = Math.floor(
            (ahora.getTime() - ultimaCompra.getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        // Estimar frecuencia anual
        const frecuenciaAnual = cliente.metricas.comprasUltimos365Dias ||
          Math.min(cliente.metricas.totalCompras, 12);

        // Determinar nuevo segmento
        const clasificacion = cliente.clasificacionABC || 'nuevo';
        const nuevoSegmento = this.determinarSegmento(
          clasificacion,
          diasDesdeUltimaCompra,
          frecuenciaAnual
        );

        // Solo actualizar si cambió
        if (cliente.segmento !== nuevoSegmento) {
          const clienteRef = doc(db, COLLECTION_NAME, cliente.id);
          batch.update(clienteRef, {
            segmento: nuevoSegmento,
            fechaActualizacion: serverTimestamp()
          });
          actualizados++;
        }
      }

      if (actualizados > 0) {
        await batch.commit();
      }

      return { actualizados };
    } catch (error: any) {
      console.error('Error al recalcular segmentos:', error);
      throw new Error('Error al recalcular segmentos');
    }
  },

  /**
   * Agregar nota/seguimiento a un cliente
   */
  async agregarNota(
    clienteId: string,
    nota: string,
    userId: string
  ): Promise<void> {
    try {
      const cliente = await this.getById(clienteId);
      if (!cliente) throw new Error('Cliente no encontrado');

      const notaActual = cliente.notas || '';
      const fechaHora = new Date().toLocaleString('es-PE');
      const nuevaNota = `[${fechaHora}] ${nota}\n\n${notaActual}`.trim();

      await updateDoc(doc(db, COLLECTION_NAME, clienteId), {
        notas: nuevaNota,
        actualizadoPor: userId,
        fechaActualizacion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error al agregar nota:', error);
      throw new Error('Error al agregar nota');
    }
  },

  /**
   * Agregar etiqueta a un cliente
   */
  async agregarEtiqueta(
    clienteId: string,
    etiqueta: string,
    userId: string
  ): Promise<void> {
    try {
      const cliente = await this.getById(clienteId);
      if (!cliente) throw new Error('Cliente no encontrado');

      const etiquetas = cliente.etiquetas || [];
      if (!etiquetas.includes(etiqueta)) {
        etiquetas.push(etiqueta);
        await updateDoc(doc(db, COLLECTION_NAME, clienteId), {
          etiquetas,
          actualizadoPor: userId,
          fechaActualizacion: serverTimestamp()
        });
      }
    } catch (error: any) {
      console.error('Error al agregar etiqueta:', error);
      throw new Error('Error al agregar etiqueta');
    }
  },

  /**
   * Quitar etiqueta de un cliente
   */
  async quitarEtiqueta(
    clienteId: string,
    etiqueta: string,
    userId: string
  ): Promise<void> {
    try {
      const cliente = await this.getById(clienteId);
      if (!cliente) throw new Error('Cliente no encontrado');

      const etiquetas = (cliente.etiquetas || []).filter(e => e !== etiqueta);
      await updateDoc(doc(db, COLLECTION_NAME, clienteId), {
        etiquetas,
        actualizadoPor: userId,
        fechaActualizacion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error al quitar etiqueta:', error);
      throw new Error('Error al quitar etiqueta');
    }
  },

  /**
   * Recalcular métricas de todos los clientes basándose en las ventas actuales
   * Útil cuando se borran ventas manualmente de Firebase
   */
  async recalcularMetricasDesdeVentas(userId: string): Promise<{ actualizados: number; errores: number }> {
    try {
      // Importar dinámicamente para evitar dependencia circular
      const { VentaService } = await import('./venta.service');

      // Obtener todas las ventas (excluyendo canceladas y cotizaciones)
      const todasLasVentas = await VentaService.getAll();
      const ventasValidas = todasLasVentas.filter(v =>
        v.estado !== 'cancelada' && v.estado !== 'cotizacion'
      );

      // Obtener todos los clientes
      const clientes = await this.getAll();

      // Crear mapa de métricas por cliente
      const metricasPorCliente: Map<string, {
        totalCompras: number;
        montoTotalPEN: number;
        ultimaCompra: Date | null;
        productoIds: string[];
      }> = new Map();

      // Inicializar todos los clientes con métricas en cero
      for (const cliente of clientes) {
        metricasPorCliente.set(cliente.id, {
          totalCompras: 0,
          montoTotalPEN: 0,
          ultimaCompra: null,
          productoIds: []
        });
      }

      // Calcular métricas desde las ventas
      for (const venta of ventasValidas) {
        if (!venta.clienteId) continue;

        const metricas = metricasPorCliente.get(venta.clienteId);
        if (!metricas) continue; // Cliente no existe

        metricas.totalCompras += 1;
        metricas.montoTotalPEN += venta.totalPEN || 0;

        // Actualizar última compra
        const fechaVenta = venta.fechaCreacion?.toDate?.() || null;
        if (fechaVenta && (!metricas.ultimaCompra || fechaVenta > metricas.ultimaCompra)) {
          metricas.ultimaCompra = fechaVenta;
        }

        // Agregar productos
        for (const producto of venta.productos || []) {
          if (producto.productoId && !metricas.productoIds.includes(producto.productoId)) {
            metricas.productoIds.push(producto.productoId);
          }
        }
      }

      // Actualizar clientes en batch
      let batch = writeBatch(db);
      let actualizados = 0;
      let errores = 0;
      let operacionesEnBatch = 0;

      for (const cliente of clientes) {
        try {
          const metricas = metricasPorCliente.get(cliente.id);
          if (!metricas) continue;

          const ticketPromedio = metricas.totalCompras > 0
            ? metricas.montoTotalPEN / metricas.totalCompras
            : 0;

          // Obtener los 5 productos más frecuentes como favoritos
          const productosFavoritos = metricas.productoIds.slice(0, 5);

          const clienteRef = doc(db, COLLECTION_NAME, cliente.id);
          batch.update(clienteRef, {
            'metricas.totalCompras': metricas.totalCompras,
            'metricas.montoTotalPEN': metricas.montoTotalPEN,
            'metricas.ticketPromedio': ticketPromedio,
            'metricas.ultimaCompra': metricas.ultimaCompra ? Timestamp.fromDate(metricas.ultimaCompra) : null,
            'metricas.productosFavoritos': productosFavoritos,
            actualizadoPor: userId,
            fechaActualizacion: serverTimestamp()
          });

          actualizados++;
          operacionesEnBatch++;

          // Firebase tiene límite de 500 operaciones por batch
          if (operacionesEnBatch >= 450) {
            await batch.commit();
            batch = writeBatch(db); // Crear nuevo batch
            operacionesEnBatch = 0;
          }
        } catch (err) {
          console.error(`Error actualizando cliente ${cliente.id}:`, err);
          errores++;
        }
      }

      // Commit final si quedan operaciones pendientes
      if (operacionesEnBatch > 0) {
        await batch.commit();
      }

      logger.info('Métricas de clientes recalculadas', { actualizados, errores });
      return { actualizados, errores };
    } catch (error: any) {
      console.error('Error al recalcular métricas desde ventas:', error);
      throw new Error('Error al recalcular métricas de clientes');
    }
  }
};

// Alias para compatibilidad
export const ClienteService = clienteService;
