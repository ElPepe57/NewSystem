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
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  Entrega,
  ProgramarEntregaData,
  ResultadoEntregaData,
  ResumenEntregasVenta,
  EntregaStats,
  EntregaFilters,
  EstadoEntrega
} from '../types/entrega.types';
import type { Venta, EstadoVenta } from '../types/venta.types';
import { transportistaService } from './transportista.service';
import { movimientoTransportistaService } from './movimiento-transportista.service';
import { gastoService } from './gasto.service';
import { unidadService } from './unidad.service';

const COLLECTION_NAME = 'entregas';

/**
 * Genera el siguiente código de entrega automáticamente
 * ENT-2024-001, ENT-2024-002, etc.
 */
async function generarCodigoEntrega(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ENT-${year}`;

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

export const entregaService = {
  // ============================================
  // CRUD BÁSICO
  // ============================================

  async getAll(): Promise<Entrega[]> {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const entregas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Entrega));

    // Ordenar por fecha programada descendente
    return entregas.sort((a, b) => {
      const fechaA = a.fechaProgramada?.toMillis() || 0;
      const fechaB = b.fechaProgramada?.toMillis() || 0;
      return fechaB - fechaA;
    });
  },

  async getById(id: string): Promise<Entrega | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    } as Entrega;
  },

  async getByCodigo(codigo: string): Promise<Entrega | null> {
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
    } as Entrega;
  },

  async getByVenta(ventaId: string): Promise<Entrega[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('ventaId', '==', ventaId)
    );
    const snapshot = await getDocs(q);
    const entregas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Entrega));

    // Ordenar por número de entrega
    return entregas.sort((a, b) => a.numeroEntrega - b.numeroEntrega);
  },

  async getByTransportista(transportistaId: string): Promise<Entrega[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('transportistaId', '==', transportistaId)
    );
    const snapshot = await getDocs(q);
    const entregas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Entrega));

    return entregas.sort((a, b) => {
      const fechaA = a.fechaProgramada?.toMillis() || 0;
      const fechaB = b.fechaProgramada?.toMillis() || 0;
      return fechaB - fechaA;
    });
  },

  async getPendientes(): Promise<Entrega[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('estado', 'in', ['programada', 'en_camino', 'reprogramada'])
    );
    const snapshot = await getDocs(q);
    const entregas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Entrega));

    // Ordenar por fecha programada ascendente (próximas primero)
    return entregas.sort((a, b) => {
      const fechaA = a.fechaProgramada?.toMillis() || 0;
      const fechaB = b.fechaProgramada?.toMillis() || 0;
      return fechaA - fechaB;
    });
  },

  async getDelDia(fecha?: Date): Promise<Entrega[]> {
    const dia = fecha || new Date();
    const inicioDelDia = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 0, 0, 0);
    const finDelDia = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 23, 59, 59);

    const q = query(
      collection(db, COLLECTION_NAME),
      where('fechaProgramada', '>=', Timestamp.fromDate(inicioDelDia)),
      where('fechaProgramada', '<=', Timestamp.fromDate(finDelDia))
    );
    const snapshot = await getDocs(q);
    const entregas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Entrega));

    return entregas.sort((a, b) => a.nombreTransportista.localeCompare(b.nombreTransportista));
  },

  async search(filters: EntregaFilters): Promise<Entrega[]> {
    let q = query(collection(db, COLLECTION_NAME));

    if (filters.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }

    if (filters.transportistaId) {
      q = query(q, where('transportistaId', '==', filters.transportistaId));
    }

    if (filters.ventaId) {
      q = query(q, where('ventaId', '==', filters.ventaId));
    }

    if (filters.cobroPendiente !== undefined) {
      q = query(q, where('cobroPendiente', '==', filters.cobroPendiente));
    }

    const snapshot = await getDocs(q);
    let entregas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Entrega));

    // Filtros de fecha (cliente)
    if (filters.fechaDesde) {
      const desde = Timestamp.fromDate(filters.fechaDesde);
      entregas = entregas.filter(e => e.fechaProgramada && e.fechaProgramada >= desde);
    }

    if (filters.fechaHasta) {
      const hasta = Timestamp.fromDate(filters.fechaHasta);
      entregas = entregas.filter(e => e.fechaProgramada && e.fechaProgramada <= hasta);
    }

    if (filters.distrito) {
      entregas = entregas.filter(e =>
        e.distrito?.toLowerCase().includes(filters.distrito!.toLowerCase())
      );
    }

    return entregas.sort((a, b) => {
      const fechaA = a.fechaProgramada?.toMillis() || 0;
      const fechaB = b.fechaProgramada?.toMillis() || 0;
      return fechaB - fechaA;
    });
  },

  // ============================================
  // PROGRAMAR ENTREGA
  // ============================================

  async programar(
    data: ProgramarEntregaData,
    venta: Venta,
    userId: string
  ): Promise<string> {
    // Obtener transportista
    const transportista = await transportistaService.getById(data.transportistaId);
    if (!transportista) {
      throw new Error('Transportista no encontrado');
    }

    // Contar entregas previas de esta venta
    const entregasPrevias = await this.getByVenta(data.ventaId);
    const numeroEntrega = entregasPrevias.length + 1;

    // Generar código
    const codigo = await generarCodigoEntrega();

    // Construir productos de la entrega
    const productosEntrega = data.productos.map(p => {
      const productoVenta = venta.productos.find(pv => pv.productoId === p.productoId);
      if (!productoVenta) {
        throw new Error(`Producto ${p.productoId} no encontrado en la venta`);
      }
      return {
        productoId: p.productoId,
        sku: productoVenta.sku,
        marca: productoVenta.marca,
        nombreComercial: productoVenta.nombreComercial,
        presentacion: productoVenta.presentacion,
        cantidad: p.cantidad,
        unidadesAsignadas: p.unidadesAsignadas,
        precioUnitario: productoVenta.precioUnitario,
        subtotal: p.cantidad * productoVenta.precioUnitario
      };
    });

    const cantidadItems = productosEntrega.reduce((sum, p) => sum + p.cantidad, 0);
    const subtotalPEN = productosEntrega.reduce((sum, p) => sum + p.subtotal, 0);

    const now = Timestamp.now();

    const newEntrega: Record<string, unknown> = {
      codigo,
      ventaId: data.ventaId,
      numeroVenta: venta.numeroVenta,
      numeroEntrega,
      // Transportista
      transportistaId: data.transportistaId,
      nombreTransportista: transportista.nombre,
      tipoTransportista: transportista.tipo,
      // Cliente
      nombreCliente: venta.nombreCliente,
      // Dirección
      direccionEntrega: data.direccionEntrega,
      // Productos
      productos: productosEntrega,
      cantidadItems,
      subtotalPEN,
      // Cobro
      cobroPendiente: data.cobroPendiente,
      // Costo
      costoTransportista: data.costoTransportista,
      // Estado
      estado: 'programada' as EstadoEntrega,
      fechaProgramada: Timestamp.fromDate(data.fechaProgramada),
      // Auditoría
      creadoPor: userId,
      fechaCreacion: now
    };

    // Agregar campos opcionales solo si tienen valor (Firebase no acepta undefined)
    if (transportista.telefono) newEntrega.telefonoTransportista = transportista.telefono;
    if (transportista.courierExterno) newEntrega.courierExterno = transportista.courierExterno;
    if (venta.telefonoCliente) newEntrega.telefonoCliente = venta.telefonoCliente;
    if (venta.emailCliente) newEntrega.emailCliente = venta.emailCliente;
    if (data.distrito) newEntrega.distrito = data.distrito;
    if (data.referencia) newEntrega.referencia = data.referencia;
    if (data.montoPorCobrar !== undefined) newEntrega.montoPorCobrar = data.montoPorCobrar;
    if (data.metodoPagoEsperado) newEntrega.metodoPagoEsperado = data.metodoPagoEsperado;
    if (data.horaProgramada) newEntrega.horaProgramada = data.horaProgramada;
    if (data.observaciones) newEntrega.observaciones = data.observaciones;

    const docRef = await addDoc(collection(db, COLLECTION_NAME), newEntrega);

    // Actualizar el estado de la venta a "en_entrega"
    const ventaRef = doc(db, 'ventas', data.ventaId);
    await updateDoc(ventaRef, {
      estado: 'en_entrega',
      editadoPor: userId,
      ultimaEdicion: Timestamp.now()
    });

    return docRef.id;
  },

  // ============================================
  // ACTUALIZAR ESTADO
  // ============================================

  async marcarEnCamino(id: string, userId: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      estado: 'en_camino',
      fechaSalida: Timestamp.now(),
      editadoPor: userId,
      ultimaEdicion: Timestamp.now()
    });
  },

  async registrarResultado(data: ResultadoEntregaData, userId: string): Promise<void> {
    const entrega = await this.getById(data.entregaId);
    if (!entrega) {
      throw new Error('Entrega no encontrada');
    }

    const docRef = doc(db, COLLECTION_NAME, data.entregaId);
    const now = Timestamp.now();

    if (data.exitosa) {
      // ============================================
      // ENTREGA EXITOSA - FLUJO COMPLETO
      // ============================================

      // 1. Calcular tiempo de entrega
      let tiempoEntregaMinutos: number | undefined;
      if (entrega.fechaSalida) {
        const salida = entrega.fechaSalida.toMillis();
        const llegada = data.fechaEntrega
          ? new Date(data.fechaEntrega).getTime()
          : Date.now();
        tiempoEntregaMinutos = Math.round((llegada - salida) / 60000);
      }

      // 2. Actualizar estado de la entrega
      // Construir objeto solo con campos definidos (Firestore rechaza undefined)
      const updateData: Record<string, unknown> = {
        estado: 'entregada',
        fechaEntrega: data.fechaEntrega
          ? Timestamp.fromDate(data.fechaEntrega)
          : now,
        editadoPor: userId,
        ultimaEdicion: now
      };

      // Agregar campos opcionales solo si tienen valor
      if (tiempoEntregaMinutos !== undefined) {
        updateData.tiempoEntregaMinutos = tiempoEntregaMinutos;
      }
      if (data.fotoEntrega !== undefined) {
        updateData.fotoEntrega = data.fotoEntrega;
      }
      if (data.firmaCliente !== undefined) {
        updateData.firmaCliente = data.firmaCliente;
      }
      if (data.cobroRealizado !== undefined) {
        updateData.cobroRealizado = data.cobroRealizado;
      }
      if (data.montoRecaudado !== undefined) {
        updateData.montoRecaudado = data.montoRecaudado;
      }
      if (data.metodoPagoRecibido !== undefined) {
        updateData.metodoPagoRecibido = data.metodoPagoRecibido;
      }
      if (data.notasEntrega !== undefined) {
        updateData.notasEntrega = data.notasEntrega;
      }

      await updateDoc(docRef, updateData);

      // 3. Confirmar venta de unidades (reservada → vendida)
      const unidadIds = entrega.productos.flatMap(p => p.unidadesAsignadas || []);
      if (unidadIds.length > 0) {
        try {
          const resultadoUnidades = await unidadService.confirmarVentaUnidades(
            unidadIds,
            entrega.ventaId,
            entrega.numeroVenta,
            entrega.subtotalPEN,
            userId
          );
          console.log(`[Entrega ${entrega.codigo}] Unidades confirmadas: ${resultadoUnidades.exitos}/${unidadIds.length}`);
        } catch (error) {
          console.error(`[Entrega ${entrega.codigo}] Error confirmando unidades:`, error);
        }
      }

      // 4. Crear gasto GD (Gasto de Distribución) automático
      // SIEMPRE crear el gasto GD para trazabilidad, incluso si el costo es 0
      // (ej: Mercado Envíos incluido, promocional, etc.)
      let gastoId: string | undefined;
      try {
        gastoId = await gastoService.crearGastoDistribucion({
          entregaId: entrega.id,
          entregaCodigo: entrega.codigo,
          ventaId: entrega.ventaId,
          ventaNumero: entrega.numeroVenta,
          transportistaId: entrega.transportistaId,
          transportistaNombre: entrega.nombreTransportista,
          costoEntrega: entrega.costoTransportista || 0,
          distrito: entrega.distrito
        }, userId);

        // Guardar referencia al gasto en la entrega
        await updateDoc(docRef, { gastoDistribucionId: gastoId });
        console.log(`[Entrega ${entrega.codigo}] Gasto GD creado: ${gastoId} por S/${(entrega.costoTransportista || 0).toFixed(2)}`);
      } catch (error) {
        console.error(`[Entrega ${entrega.codigo}] Error creando gasto GD:`, error);
      }

      // 5. Registrar movimiento contable del transportista
      try {
        await movimientoTransportistaService.registrarEntregaExitosa(
          entrega,
          data.montoRecaudado,
          gastoId,
          userId
        );
      } catch (error) {
        console.error(`[Entrega ${entrega.codigo}] Error registrando movimiento transportista:`, error);
      }

      // 6. Actualizar métricas del transportista
      await transportistaService.registrarEntrega(
        entrega.transportistaId,
        true,
        tiempoEntregaMinutos || 0,
        entrega.costoTransportista,
        entrega.distrito
      );

      // 7. Verificar si TODAS las entregas de la venta están completas
      await this.actualizarEstadoVentaSiCompleta(entrega.ventaId, userId);

    } else {
      // ============================================
      // ENTREGA FALLIDA
      // ============================================

      const nuevoEstado = data.reprogramar ? 'reprogramada' : 'fallida';

      // 1. Actualizar estado de la entrega
      const updateData: Record<string, unknown> = {
        estado: nuevoEstado,
        motivoFallo: data.motivoFallo,
        descripcionFallo: data.descripcionFallo,
        notasEntrega: data.notasEntrega,
        editadoPor: userId,
        ultimaEdicion: now
      };

      if (data.reprogramar && data.nuevaFechaProgramada) {
        updateData.fechaProgramada = Timestamp.fromDate(data.nuevaFechaProgramada);
      }

      await updateDoc(docRef, updateData);

      // 2. Si NO se reprograma, liberar las unidades
      if (!data.reprogramar) {
        const unidadIds = entrega.productos.flatMap(p => p.unidadesAsignadas || []);
        if (unidadIds.length > 0) {
          try {
            const motivo = `Entrega fallida: ${data.motivoFallo || 'sin especificar'}`;
            const resultadoLiberacion = await unidadService.liberarUnidades(
              unidadIds,
              motivo,
              userId
            );
            console.log(`[Entrega ${entrega.codigo}] Unidades liberadas: ${resultadoLiberacion.exitos}/${unidadIds.length}`);
          } catch (error) {
            console.error(`[Entrega ${entrega.codigo}] Error liberando unidades:`, error);
          }
        }
      }

      // 3. Registrar movimiento contable (solo historial, sin costo)
      try {
        await movimientoTransportistaService.registrarEntregaFallida(
          entrega,
          data.motivoFallo || 'Sin especificar',
          userId
        );
      } catch (error) {
        console.error(`[Entrega ${entrega.codigo}] Error registrando fallo:`, error);
      }

      // 4. Actualizar métricas del transportista (fallo)
      await transportistaService.registrarEntrega(
        entrega.transportistaId,
        false,
        0,
        0, // No se cobra por entrega fallida
        entrega.distrito
      );
    }
  },

  /**
   * Verifica si todas las entregas de una venta están completas
   * y actualiza el estado de la venta a 'entregada' si corresponde
   */
  async actualizarEstadoVentaSiCompleta(ventaId: string, userId: string): Promise<void> {
    try {
      // Obtener la venta
      const ventaRef = doc(db, 'ventas', ventaId);
      const ventaSnap = await getDoc(ventaRef);

      if (!ventaSnap.exists()) {
        console.warn(`[actualizarEstadoVenta] Venta ${ventaId} no encontrada`);
        return;
      }

      const venta = ventaSnap.data() as Venta;

      // Calcular total de productos de la venta
      const totalProductosVenta = venta.productos.reduce((sum, p) => sum + p.cantidad, 0);

      // Obtener entregas de esta venta
      const entregas = await this.getByVenta(ventaId);

      // Calcular productos entregados (solo de entregas con estado 'entregada')
      let productosEntregados = 0;
      entregas.forEach(e => {
        if (e.estado === 'entregada') {
          productosEntregados += e.cantidadItems;
        }
      });

      console.log(`[Venta ${venta.numeroVenta}] Productos: ${productosEntregados}/${totalProductosVenta} entregados`);

      // Determinar nuevo estado
      let nuevoEstado: EstadoVenta | null = null;

      if (productosEntregados >= totalProductosVenta) {
        // Todos los productos entregados → venta completa
        nuevoEstado = 'entregada';
      } else if (productosEntregados > 0) {
        // Algunos productos entregados → entrega parcial, mantener en_entrega
        nuevoEstado = 'en_entrega';
      }

      // Actualizar estado de la venta si cambió
      if (nuevoEstado && nuevoEstado !== venta.estado) {
        await updateDoc(ventaRef, {
          estado: nuevoEstado,
          editadoPor: userId,
          ultimaEdicion: Timestamp.now()
        });
        console.log(`[Venta ${venta.numeroVenta}] Estado actualizado a: ${nuevoEstado}`);
      }
    } catch (error) {
      console.error(`[actualizarEstadoVenta] Error para venta ${ventaId}:`, error);
    }
  },

  async cancelar(id: string, motivo: string, userId: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      estado: 'cancelada',
      descripcionFallo: motivo,
      editadoPor: userId,
      ultimaEdicion: Timestamp.now()
    });
  },

  // ============================================
  // TRACKING (para couriers externos)
  // ============================================

  async registrarTracking(id: string, numeroTracking: string, userId: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      numeroTracking,
      editadoPor: userId,
      ultimaEdicion: Timestamp.now()
    });
  },

  // ============================================
  // RESUMEN DE ENTREGAS POR VENTA
  // ============================================

  async getResumenVenta(ventaId: string): Promise<ResumenEntregasVenta> {
    // Obtener venta
    const ventaDoc = await getDoc(doc(db, 'ventas', ventaId));
    if (!ventaDoc.exists()) {
      throw new Error('Venta no encontrada');
    }
    const venta = ventaDoc.data() as Venta;

    // Obtener entregas de la venta
    const entregas = await this.getByVenta(ventaId);

    // Calcular productos totales de la venta
    const totalProductos = venta.productos.reduce((sum, p) => sum + p.cantidad, 0);

    // Calcular productos ya entregados o en proceso
    let productosEntregados = 0;
    entregas.forEach(e => {
      if (e.estado === 'entregada') {
        productosEntregados += e.cantidadItems;
      }
    });

    // Costo total de distribución
    const costoTotalDistribucion = entregas.reduce((sum, e) => sum + e.costoTransportista, 0);

    return {
      ventaId,
      totalProductos,
      productosEntregados,
      productosPendientes: totalProductos - productosEntregados,
      entregas: entregas.map(e => ({
        entregaId: e.id,
        codigo: e.codigo,
        estado: e.estado,
        transportista: e.nombreTransportista,
        fecha: e.fechaProgramada,
        productos: e.cantidadItems
      })),
      costoTotalDistribucion,
      entregaCompleta: productosEntregados >= totalProductos
    };
  },

  // ============================================
  // ESTADÍSTICAS GENERALES
  // ============================================

  async getStats(fechaInicio: Date, fechaFin: Date): Promise<EntregaStats> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('fechaProgramada', '>=', Timestamp.fromDate(fechaInicio)),
      where('fechaProgramada', '<=', Timestamp.fromDate(fechaFin))
    );

    const snapshot = await getDocs(q);
    const entregas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Entrega));

    const entregasExitosas = entregas.filter(e => e.estado === 'entregada').length;
    const entregasFallidas = entregas.filter(e => e.estado === 'fallida').length;
    const entregasPendientes = entregas.filter(e =>
      ['programada', 'en_camino', 'reprogramada'].includes(e.estado)
    ).length;

    const tasaExito = entregas.length > 0
      ? (entregasExitosas / entregas.length) * 100
      : 0;

    // Tiempo y costo promedio
    const entregasConTiempo = entregas.filter(e => e.tiempoEntregaMinutos);
    const tiempoPromedioEntrega = entregasConTiempo.length > 0
      ? entregasConTiempo.reduce((sum, e) => sum + (e.tiempoEntregaMinutos || 0), 0) / entregasConTiempo.length
      : 0;

    const costoTotalDistribucion = entregas.reduce((sum, e) => sum + e.costoTransportista, 0);
    const costoPromedioEntrega = entregas.length > 0
      ? costoTotalDistribucion / entregas.length
      : 0;

    // Por transportista
    const transportistaMap: Record<string, { id: string; nombre: string; entregas: number; exitosas: number }> = {};
    entregas.forEach(e => {
      if (!transportistaMap[e.transportistaId]) {
        transportistaMap[e.transportistaId] = {
          id: e.transportistaId,
          nombre: e.nombreTransportista,
          entregas: 0,
          exitosas: 0
        };
      }
      transportistaMap[e.transportistaId].entregas++;
      if (e.estado === 'entregada') {
        transportistaMap[e.transportistaId].exitosas++;
      }
    });

    // Por zona
    const zonaMap: Record<string, { entregas: number; exitosas: number }> = {};
    entregas.forEach(e => {
      const zona = e.distrito || 'Sin zona';
      if (!zonaMap[zona]) {
        zonaMap[zona] = { entregas: 0, exitosas: 0 };
      }
      zonaMap[zona].entregas++;
      if (e.estado === 'entregada') {
        zonaMap[zona].exitosas++;
      }
    });

    return {
      periodo: {
        inicio: Timestamp.fromDate(fechaInicio),
        fin: Timestamp.fromDate(fechaFin)
      },
      totalEntregas: entregas.length,
      entregasExitosas,
      entregasFallidas,
      entregasPendientes,
      tasaExito,
      tiempoPromedioEntrega,
      costoPromedioEntrega,
      costoTotalDistribucion,
      porTransportista: Object.values(transportistaMap).map(t => ({
        transportistaId: t.id,
        nombre: t.nombre,
        entregas: t.entregas,
        exitosas: t.exitosas,
        tasaExito: t.entregas > 0 ? (t.exitosas / t.entregas) * 100 : 0
      })),
      porZona: Object.entries(zonaMap).map(([zona, data]) => ({
        zona,
        entregas: data.entregas,
        exitosas: data.exitosas
      }))
    };
  },

  // ============================================
  // PDF
  // ============================================

  /**
   * Registra la URL del PDF generado
   */
  async registrarPDF(
    id: string,
    tipo: 'guia_transportista' | 'cargo_cliente',
    url: string,
    userId: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const campo = tipo === 'guia_transportista' ? 'pdfGuiaTransportista' : 'pdfCargoCliente';

    await updateDoc(docRef, {
      [campo]: url,
      editadoPor: userId,
      ultimaEdicion: Timestamp.now()
    });
  },

  // ============================================
  // CÓDIGOS
  // ============================================

  async getProximoCodigo(): Promise<string> {
    return generarCodigoEntrega();
  }
};
