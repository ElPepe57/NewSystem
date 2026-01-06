/**
 * Servicio de Analytics Avanzado para Almacenes
 * Proporciona métricas detalladas, historial de movimientos, rotación y predicciones
 */
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  Almacen,
  ClasificacionAlmacen,
  HistorialEvaluacionAlmacen
} from '../types/almacen.types';
import type { Unidad } from '../types/unidad.types';
import type { Transferencia } from '../types/transferencia.types';

// ============================================
// TIPOS PARA ANALYTICS DE ALMACENES
// ============================================

/**
 * Movimiento de inventario en el almacén
 */
export interface MovimientoAlmacen {
  id: string;
  fecha: Date;
  tipo: 'entrada' | 'salida' | 'transferencia_entrada' | 'transferencia_salida';
  cantidad: number;
  productoId: string;
  productoSKU: string;
  productoNombre: string;
  origen?: string;
  destino?: string;
  ordenCompraId?: string;
  ventaId?: string;
  transferenciaId?: string;
  valorUSD: number;
}

/**
 * Historial de capacidad del almacén
 */
export interface CapacidadHistorico {
  fecha: Date;
  capacidadTotal: number;
  capacidadUtilizada: number;
  porcentajeUtilizacion: number;
  productosUnicos: number;
  unidadesTotales: number;
  valorInventarioUSD: number;
}

/**
 * Rotación de producto en el almacén
 */
export interface RotacionProducto {
  productoId: string;
  sku: string;
  nombre: string;
  marca: string;
  stockActual: number;
  entradasPeriodo: number;
  salidasPeriodo: number;
  rotacionDias: number;
  valorInventarioUSD: number;
  diasSinMovimiento: number;
  ultimoMovimiento?: Date;
  tendencia: 'alta' | 'normal' | 'baja' | 'estancado';
}

/**
 * Incidencia en el almacén
 */
export interface IncidenciaAlmacen {
  id: string;
  fecha: Date;
  tipo: 'merma' | 'vencimiento' | 'danio' | 'diferencia_inventario' | 'robo' | 'otro';
  severidad: 'leve' | 'moderada' | 'grave';
  productoId?: string;
  productoSKU?: string;
  cantidad?: number;
  impactoUSD?: number;
  descripcion: string;
  resuelta: boolean;
  accionCorrectiva?: string;
}

/**
 * Historial de transferencia
 */
export interface TransferenciaHistorial {
  id: string;
  fecha: Date;
  tipoMovimiento: 'entrada' | 'salida';
  almacenOrigenId: string;
  almacenOrigenNombre: string;
  almacenDestinoId: string;
  almacenDestinoNombre: string;
  productos: Array<{
    productoId: string;
    sku: string;
    nombre: string;
    cantidad: number;
    valorUSD: number;
  }>;
  totalUnidades: number;
  valorTotalUSD: number;
  estado: string;
  tiempoTransito?: number;
}

/**
 * Métricas específicas de viajero
 */
export interface MetricasViajero {
  totalViajes: number;
  viajesUltimos30Dias: number;
  viajesUltimos90Dias: number;
  proximoViaje?: Date;
  diasParaProximoViaje?: number;
  capacidadPromedioViaje: number;
  unidadesTransportadasTotal: number;
  valorTransportadoUSD: number;
  tiempoPromedioViaje: number;
  tasaPuntualidad: number;
  viajesATiempo: number;
  viajesRetrasados: number;
}

/**
 * Comparativa entre almacenes
 */
export interface ComparativaAlmacen {
  almacenId: string;
  codigo: string;
  nombreAlmacen: string;
  tipo: string;
  pais: string;
  esViajero: boolean;
  capacidadUtilizada: number;
  unidadesActuales: number;
  rotacionPromedio: number;
  valorInventarioUSD: number;
  movimientosMensuales: number;
  incidencias: number;
  evaluacion: number;
  ranking: number;
}

/**
 * Producto en inventario del almacén
 */
export interface ProductoInventario {
  productoId: string;
  sku: string;
  nombre: string;
  marca: string;
  presentacion: string;
  cantidad: number;
  valorUnitarioUSD: number;
  valorTotalUSD: number;
  diasEnAlmacen: number;
  fechaIngreso?: Date;
  fechaVencimiento?: Date;
  diasParaVencer?: number;
  esProximoVencer: boolean;
  rotacion: 'alta' | 'normal' | 'baja' | 'estancado';
}

/**
 * Alerta del almacén
 */
export interface AlertaAlmacen {
  tipo: 'capacidad' | 'rotacion' | 'incidencia' | 'evaluacion' | 'viaje' | 'vencimiento';
  severidad: 'info' | 'warning' | 'danger';
  mensaje: string;
  detalle?: string;
  accionRecomendada?: string;
  fechaGeneracion: Date;
  productoId?: string;
}

/**
 * Predicciones del almacén
 */
export interface PrediccionesAlmacen {
  capacidadEstimada30Dias: number;
  riesgoSobrecapacidad: number;
  productosProximosVencer: number;
  valorEnRiesgoUSD: number;
  movimientosEstimados30Dias: number;
  tendenciaInventario: 'creciendo' | 'estable' | 'decreciendo';
}

/**
 * Distribución de inventario por categoría
 */
export interface DistribucionCategoria {
  categoria: string;
  cantidad: number;
  valorUSD: number;
  porcentajeCantidad: number;
  porcentajeValor: number;
}

/**
 * Analytics completo de un almacén
 */
export interface AlmacenAnalytics {
  almacen: Almacen;

  // Inventario actual
  inventarioActual: {
    productosUnicos: number;
    unidadesTotales: number;
    valorTotalUSD: number;
    valorTotalPEN: number;
    capacidadTotal: number;
    capacidadUtilizada: number;
    porcentajeCapacidad: number;
    diasPromedioInventario: number;
  };

  // Productos en inventario
  productosInventario: ProductoInventario[];
  distribucionPorCategoria: DistribucionCategoria[];
  distribucionPorMarca: DistribucionCategoria[];

  // Historial de capacidad
  historialCapacidad: CapacidadHistorico[];
  tendenciaCapacidad: 'creciendo' | 'decreciendo' | 'estable';

  // Movimientos
  movimientosHistorial: MovimientoAlmacen[];
  movimientosUltimos30Dias: number;
  movimientosUltimos90Dias: number;
  promedioMovimientosDiarios: number;
  balanceMovimientos: number; // positivo = más entradas

  // Rotación por producto
  rotacionProductos: RotacionProducto[];
  rotacionPromedioGlobal: number;
  productosEstancados: RotacionProducto[];
  productosAltaRotacion: RotacionProducto[];

  // Transferencias
  transferenciasHistorial: TransferenciaHistorial[];
  transferenciasEnviadas: number;
  transferenciasRecibidas: number;
  balanceTransferencias: number;

  // Incidencias
  incidencias: IncidenciaAlmacen[];
  totalIncidencias: number;
  incidenciasAbiertas: number;
  tasaIncidencia: number;
  impactoTotalIncidenciasUSD: number;

  // Productos próximos a vencer
  productosProximosVencer: ProductoInventario[];
  valorEnRiesgoVencimiento: number;

  // Métricas de viajero (solo si es viajero)
  metricasViajero?: MetricasViajero;

  // Evaluación
  evaluacionActual: number;
  clasificacionActual: ClasificacionAlmacen;
  historialEvaluaciones: HistorialEvaluacionAlmacen[];
  tendenciaEvaluacion: 'mejorando' | 'estable' | 'empeorando';

  // Comparativa
  comparativaAlmacenes: ComparativaAlmacen[];
  rankingGeneral: number;
  totalAlmacenes: number;
  percentilRendimiento: number;

  // Alertas
  alertas: AlertaAlmacen[];
  alertasCriticas: number;

  // Predicciones
  predicciones: PrediccionesAlmacen;

  // Métricas de tiempo
  fechaAnalisis: Date;
  periodoAnalisis: {
    desde: Date;
    hasta: Date;
  };
}

// ============================================
// SERVICIO DE ANALYTICS
// ============================================

class AlmacenAnalyticsService {
  private tipoCambioPEN = 3.75; // Tipo de cambio por defecto

  /**
   * Obtiene analytics completos de un almacén
   */
  async getAlmacenAnalytics(almacenId: string): Promise<AlmacenAnalytics | null> {
    try {
      // Obtener almacén
      const almacenDoc = await getDocs(
        query(collection(db, 'almacenes'), where('__name__', '==', almacenId))
      );

      if (almacenDoc.empty) {
        console.error('Almacén no encontrado:', almacenId);
        return null;
      }

      const almacen = {
        id: almacenDoc.docs[0].id,
        ...almacenDoc.docs[0].data()
      } as Almacen;

      // Calcular período de análisis (últimos 365 días)
      const ahora = new Date();
      const hace365Dias = new Date(ahora.getTime() - 365 * 24 * 60 * 60 * 1000);

      // Obtener datos en paralelo
      const [
        unidadesData,
        transferenciasData,
        todosAlmacenesData
      ] = await Promise.all([
        this.getUnidadesAlmacen(almacenId),
        this.getTransferenciasAlmacen(almacenId),
        this.getTodosAlmacenes()
      ]);

      // Calcular inventario actual
      const inventarioActual = this.calcularInventarioActual(unidadesData, almacen);

      // Calcular productos en inventario
      const productosInventario = this.calcularProductosInventario(unidadesData);

      // Calcular distribución
      const distribucionPorCategoria = this.calcularDistribucionCategoria(productosInventario);
      const distribucionPorMarca = this.calcularDistribucionMarca(productosInventario);

      // Calcular movimientos
      const movimientosHistorial = this.construirMovimientosHistorial(unidadesData, transferenciasData, almacenId);
      const { movimientos30, movimientos90 } = this.contarMovimientosPorPeriodo(movimientosHistorial);

      // Calcular rotación
      const rotacionProductos = this.calcularRotacionProductos(productosInventario, movimientosHistorial);
      const productosEstancados = rotacionProductos.filter(p => p.tendencia === 'estancado');
      const productosAltaRotacion = rotacionProductos.filter(p => p.tendencia === 'alta');

      // Historial de transferencias
      const transferenciasHistorial = this.construirTransferenciasHistorial(transferenciasData, almacenId);

      // Calcular productos próximos a vencer
      const productosProximosVencer = productosInventario.filter(p => p.esProximoVencer);
      const valorEnRiesgoVencimiento = productosProximosVencer.reduce((sum, p) => sum + p.valorTotalUSD, 0);

      // Calcular métricas de viajero si aplica
      const metricasViajero = almacen.esViajero
        ? this.calcularMetricasViajero(almacen, transferenciasData)
        : undefined;

      // Historial de evaluaciones
      const historialEvaluaciones = almacen.evaluacionesHistorial || [];
      const tendenciaEvaluacion = this.calcularTendenciaEvaluacion(historialEvaluaciones);

      // Comparativa con otros almacenes
      const comparativaAlmacenes = this.calcularComparativa(almacen, todosAlmacenesData, unidadesData);
      const rankingGeneral = comparativaAlmacenes.find(c => c.almacenId === almacenId)?.ranking || 0;

      // Generar alertas
      const alertas = this.generarAlertas(almacen, inventarioActual, productosEstancados, productosProximosVencer, metricasViajero);

      // Calcular predicciones
      const predicciones = this.calcularPredicciones(inventarioActual, movimientosHistorial, productosProximosVencer);

      // Incidencias (simuladas por ahora, podrían venir de una colección)
      const incidencias: IncidenciaAlmacen[] = [];

      return {
        almacen,

        inventarioActual,
        productosInventario,
        distribucionPorCategoria,
        distribucionPorMarca,

        historialCapacidad: [], // Se puede implementar con snapshots periódicos
        tendenciaCapacidad: this.calcularTendenciaCapacidad(movimientosHistorial),

        movimientosHistorial,
        movimientosUltimos30Dias: movimientos30,
        movimientosUltimos90Dias: movimientos90,
        promedioMovimientosDiarios: movimientos30 / 30,
        balanceMovimientos: this.calcularBalanceMovimientos(movimientosHistorial),

        rotacionProductos,
        rotacionPromedioGlobal: this.calcularRotacionPromedio(rotacionProductos),
        productosEstancados,
        productosAltaRotacion,

        transferenciasHistorial,
        transferenciasEnviadas: transferenciasHistorial.filter(t => t.tipoMovimiento === 'salida').length,
        transferenciasRecibidas: transferenciasHistorial.filter(t => t.tipoMovimiento === 'entrada').length,
        balanceTransferencias: transferenciasHistorial.filter(t => t.tipoMovimiento === 'entrada').length -
                               transferenciasHistorial.filter(t => t.tipoMovimiento === 'salida').length,

        incidencias,
        totalIncidencias: incidencias.length,
        incidenciasAbiertas: incidencias.filter(i => !i.resuelta).length,
        tasaIncidencia: movimientos30 > 0 ? (incidencias.length / movimientos30) * 100 : 0,
        impactoTotalIncidenciasUSD: incidencias.reduce((sum, i) => sum + (i.impactoUSD || 0), 0),

        productosProximosVencer,
        valorEnRiesgoVencimiento,

        metricasViajero,

        evaluacionActual: almacen.evaluacion?.puntuacion || 0,
        clasificacionActual: almacen.evaluacion?.clasificacion || 'regular',
        historialEvaluaciones,
        tendenciaEvaluacion,

        comparativaAlmacenes,
        rankingGeneral,
        totalAlmacenes: todosAlmacenesData.length,
        percentilRendimiento: todosAlmacenesData.length > 0
          ? Math.round(((todosAlmacenesData.length - rankingGeneral + 1) / todosAlmacenesData.length) * 100)
          : 0,

        alertas,
        alertasCriticas: alertas.filter(a => a.severidad === 'danger').length,

        predicciones,

        fechaAnalisis: ahora,
        periodoAnalisis: {
          desde: hace365Dias,
          hasta: ahora
        }
      };
    } catch (error) {
      console.error('Error obteniendo analytics de almacén:', error);
      throw error;
    }
  }

  /**
   * Obtiene unidades del almacén
   */
  private async getUnidadesAlmacen(almacenId: string): Promise<Unidad[]> {
    const q = query(
      collection(db, 'unidades'),
      where('almacenId', '==', almacenId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Unidad[];
  }

  /**
   * Obtiene transferencias relacionadas con el almacén
   */
  private async getTransferenciasAlmacen(almacenId: string): Promise<Transferencia[]> {
    // Transferencias donde es origen o destino
    const [origenSnapshot, destinoSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'transferencias'), where('almacenOrigenId', '==', almacenId))),
      getDocs(query(collection(db, 'transferencias'), where('almacenDestinoId', '==', almacenId)))
    ]);

    const transferencias: Transferencia[] = [];
    const ids = new Set<string>();

    origenSnapshot.docs.forEach(doc => {
      if (!ids.has(doc.id)) {
        ids.add(doc.id);
        transferencias.push({ id: doc.id, ...doc.data() } as Transferencia);
      }
    });

    destinoSnapshot.docs.forEach(doc => {
      if (!ids.has(doc.id)) {
        ids.add(doc.id);
        transferencias.push({ id: doc.id, ...doc.data() } as Transferencia);
      }
    });

    return transferencias;
  }

  /**
   * Obtiene todos los almacenes para comparativa
   */
  private async getTodosAlmacenes(): Promise<Almacen[]> {
    const snapshot = await getDocs(collection(db, 'almacenes'));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Almacen[];
  }

  /**
   * Calcula inventario actual
   */
  private calcularInventarioActual(unidades: Unidad[], almacen: Almacen) {
    const estadosExcluidos = ['vendida', 'vencida', 'danada', 'en_transito'];
    const unidadesDisponibles = unidades.filter(u => !estadosExcluidos.includes(u.estado || ''));

    const productosUnicos = new Set(unidadesDisponibles.map(u => u.productoId)).size;
    const unidadesTotales = unidadesDisponibles.length;
    const valorTotalUSD = unidadesDisponibles.reduce((sum, u) => sum + (u.costoUnitarioUSD || 0), 0);

    // Calcular días promedio en almacén
    const ahora = new Date();
    let sumaDias = 0;
    unidadesDisponibles.forEach(u => {
      if (u.fechaIngreso) {
        const fechaIngreso = u.fechaIngreso instanceof Timestamp ? u.fechaIngreso.toDate() : new Date(u.fechaIngreso);
        sumaDias += Math.floor((ahora.getTime() - fechaIngreso.getTime()) / (1000 * 60 * 60 * 24));
      }
    });

    const capacidadTotal = almacen.capacidadUnidades || 0;
    const porcentajeCapacidad = capacidadTotal > 0 ? (unidadesTotales / capacidadTotal) * 100 : 0;

    return {
      productosUnicos,
      unidadesTotales,
      valorTotalUSD,
      valorTotalPEN: valorTotalUSD * this.tipoCambioPEN,
      capacidadTotal,
      capacidadUtilizada: unidadesTotales,
      porcentajeCapacidad,
      diasPromedioInventario: unidadesTotales > 0 ? sumaDias / unidadesTotales : 0
    };
  }

  /**
   * Calcula productos en inventario agrupados
   */
  private calcularProductosInventario(unidades: Unidad[]): ProductoInventario[] {
    const estadosExcluidos = ['vendida', 'vencida', 'danada', 'en_transito'];
    const unidadesDisponibles = unidades.filter(u => !estadosExcluidos.includes(u.estado || ''));

    const productosMap = new Map<string, {
      productoId: string;
      sku: string;
      nombre: string;
      marca: string;
      presentacion: string;
      cantidad: number;
      valorTotal: number;
      diasTotal: number;
      fechaIngresoMin?: Date;
      fechaVencimientoMin?: Date;
    }>();

    const ahora = new Date();

    unidadesDisponibles.forEach(u => {
      const key = u.productoId;
      const existing = productosMap.get(key);

      const fechaIngreso = u.fechaIngreso instanceof Timestamp ? u.fechaIngreso.toDate() : (u.fechaIngreso ? new Date(u.fechaIngreso) : undefined);
      const fechaVencimiento = u.fechaVencimiento instanceof Timestamp ? u.fechaVencimiento.toDate() : (u.fechaVencimiento ? new Date(u.fechaVencimiento) : undefined);
      const diasEnAlmacen = fechaIngreso ? Math.floor((ahora.getTime() - fechaIngreso.getTime()) / (1000 * 60 * 60 * 24)) : 0;

      if (existing) {
        existing.cantidad++;
        existing.valorTotal += u.costoUnitarioUSD || 0;
        existing.diasTotal += diasEnAlmacen;
        if (fechaIngreso && (!existing.fechaIngresoMin || fechaIngreso < existing.fechaIngresoMin)) {
          existing.fechaIngresoMin = fechaIngreso;
        }
        if (fechaVencimiento && (!existing.fechaVencimientoMin || fechaVencimiento < existing.fechaVencimientoMin)) {
          existing.fechaVencimientoMin = fechaVencimiento;
        }
      } else {
        productosMap.set(key, {
          productoId: u.productoId,
          sku: u.sku || '',
          nombre: u.nombreProducto || u.sku || '',
          marca: u.marca || '',
          presentacion: u.presentacion || '',
          cantidad: 1,
          valorTotal: u.costoUnitarioUSD || 0,
          diasTotal: diasEnAlmacen,
          fechaIngresoMin: fechaIngreso,
          fechaVencimientoMin: fechaVencimiento
        });
      }
    });

    return Array.from(productosMap.values()).map(p => {
      const diasEnAlmacen = p.cantidad > 0 ? Math.round(p.diasTotal / p.cantidad) : 0;
      const diasParaVencer = p.fechaVencimientoMin
        ? Math.floor((p.fechaVencimientoMin.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

      let rotacion: 'alta' | 'normal' | 'baja' | 'estancado' = 'normal';
      if (diasEnAlmacen > 90) rotacion = 'estancado';
      else if (diasEnAlmacen > 60) rotacion = 'baja';
      else if (diasEnAlmacen < 15) rotacion = 'alta';

      return {
        productoId: p.productoId,
        sku: p.sku,
        nombre: p.nombre,
        marca: p.marca,
        presentacion: p.presentacion,
        cantidad: p.cantidad,
        valorUnitarioUSD: p.cantidad > 0 ? p.valorTotal / p.cantidad : 0,
        valorTotalUSD: p.valorTotal,
        diasEnAlmacen,
        fechaIngreso: p.fechaIngresoMin,
        fechaVencimiento: p.fechaVencimientoMin,
        diasParaVencer,
        esProximoVencer: diasParaVencer !== undefined && diasParaVencer <= 30 && diasParaVencer > 0,
        rotacion
      };
    }).sort((a, b) => b.valorTotalUSD - a.valorTotalUSD);
  }

  /**
   * Calcula distribución por categoría
   */
  private calcularDistribucionCategoria(productos: ProductoInventario[]): DistribucionCategoria[] {
    const totalCantidad = productos.reduce((sum, p) => sum + p.cantidad, 0);
    const totalValor = productos.reduce((sum, p) => sum + p.valorTotalUSD, 0);

    const categoriasMap = new Map<string, { cantidad: number; valor: number }>();

    productos.forEach(p => {
      const categoria = p.marca || 'Sin categoría';
      const existing = categoriasMap.get(categoria);
      if (existing) {
        existing.cantidad += p.cantidad;
        existing.valor += p.valorTotalUSD;
      } else {
        categoriasMap.set(categoria, { cantidad: p.cantidad, valor: p.valorTotalUSD });
      }
    });

    return Array.from(categoriasMap.entries())
      .map(([categoria, data]) => ({
        categoria,
        cantidad: data.cantidad,
        valorUSD: data.valor,
        porcentajeCantidad: totalCantidad > 0 ? (data.cantidad / totalCantidad) * 100 : 0,
        porcentajeValor: totalValor > 0 ? (data.valor / totalValor) * 100 : 0
      }))
      .sort((a, b) => b.valorUSD - a.valorUSD);
  }

  /**
   * Calcula distribución por marca
   */
  private calcularDistribucionMarca(productos: ProductoInventario[]): DistribucionCategoria[] {
    return this.calcularDistribucionCategoria(productos);
  }

  /**
   * Construye historial de movimientos
   */
  private construirMovimientosHistorial(
    unidades: Unidad[],
    transferencias: Transferencia[],
    almacenId: string
  ): MovimientoAlmacen[] {
    const movimientos: MovimientoAlmacen[] = [];

    // Movimientos de entrada (recepción de OC)
    unidades.forEach(u => {
      if (u.fechaIngreso) {
        const fecha = u.fechaIngreso instanceof Timestamp ? u.fechaIngreso.toDate() : new Date(u.fechaIngreso);
        movimientos.push({
          id: `entrada-${u.id}`,
          fecha,
          tipo: 'entrada',
          cantidad: 1,
          productoId: u.productoId,
          productoSKU: u.sku || '',
          productoNombre: u.nombreProducto || u.sku || '',
          ordenCompraId: u.ordenCompraId,
          valorUSD: u.costoUnitarioUSD || 0
        });
      }
    });

    // Movimientos de transferencia
    transferencias.forEach(t => {
      const fecha = t.fechaCreacion instanceof Timestamp ? t.fechaCreacion.toDate() : new Date(t.fechaCreacion);
      const esOrigen = t.almacenOrigenId === almacenId;

      if (t.unidadesIds && t.unidadesIds.length > 0) {
        movimientos.push({
          id: `trans-${t.id}`,
          fecha,
          tipo: esOrigen ? 'transferencia_salida' : 'transferencia_entrada',
          cantidad: t.unidadesIds.length,
          productoId: '',
          productoSKU: 'Múltiples',
          productoNombre: `Transferencia ${t.codigo || t.id}`,
          origen: esOrigen ? almacenId : t.almacenOrigenId,
          destino: esOrigen ? t.almacenDestinoId : almacenId,
          transferenciaId: t.id,
          valorUSD: t.valorTotalUSD || 0
        });
      }
    });

    return movimientos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }

  /**
   * Cuenta movimientos por período
   */
  private contarMovimientosPorPeriodo(movimientos: MovimientoAlmacen[]) {
    const ahora = new Date();
    const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hace90Dias = new Date(ahora.getTime() - 90 * 24 * 60 * 60 * 1000);

    return {
      movimientos30: movimientos.filter(m => m.fecha >= hace30Dias).length,
      movimientos90: movimientos.filter(m => m.fecha >= hace90Dias).length
    };
  }

  /**
   * Calcula balance de movimientos
   */
  private calcularBalanceMovimientos(movimientos: MovimientoAlmacen[]): number {
    let balance = 0;
    movimientos.forEach(m => {
      if (m.tipo === 'entrada' || m.tipo === 'transferencia_entrada') {
        balance += m.cantidad;
      } else {
        balance -= m.cantidad;
      }
    });
    return balance;
  }

  /**
   * Calcula tendencia de capacidad
   */
  private calcularTendenciaCapacidad(movimientos: MovimientoAlmacen[]): 'creciendo' | 'decreciendo' | 'estable' {
    const ahora = new Date();
    const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hace60Dias = new Date(ahora.getTime() - 60 * 24 * 60 * 60 * 1000);

    const movimientos30 = movimientos.filter(m => m.fecha >= hace30Dias);
    const movimientos30a60 = movimientos.filter(m => m.fecha >= hace60Dias && m.fecha < hace30Dias);

    const balance30 = this.calcularBalanceMovimientos(movimientos30);
    const balance30a60 = this.calcularBalanceMovimientos(movimientos30a60);

    if (balance30 > balance30a60 + 5) return 'creciendo';
    if (balance30 < balance30a60 - 5) return 'decreciendo';
    return 'estable';
  }

  /**
   * Calcula rotación de productos
   */
  private calcularRotacionProductos(
    productos: ProductoInventario[],
    movimientos: MovimientoAlmacen[]
  ): RotacionProducto[] {
    return productos.map(p => {
      const movimientosProducto = movimientos.filter(m => m.productoId === p.productoId);
      const entradas = movimientosProducto.filter(m => m.tipo === 'entrada' || m.tipo === 'transferencia_entrada');
      const salidas = movimientosProducto.filter(m => m.tipo === 'salida' || m.tipo === 'transferencia_salida');

      const ultimoMovimiento = movimientosProducto[0]?.fecha;
      const diasSinMovimiento = ultimoMovimiento
        ? Math.floor((new Date().getTime() - ultimoMovimiento.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      return {
        productoId: p.productoId,
        sku: p.sku,
        nombre: p.nombre,
        marca: p.marca,
        stockActual: p.cantidad,
        entradasPeriodo: entradas.reduce((sum, e) => sum + e.cantidad, 0),
        salidasPeriodo: salidas.reduce((sum, s) => sum + s.cantidad, 0),
        rotacionDias: p.diasEnAlmacen,
        valorInventarioUSD: p.valorTotalUSD,
        diasSinMovimiento,
        ultimoMovimiento,
        tendencia: p.rotacion
      };
    });
  }

  /**
   * Calcula rotación promedio
   */
  private calcularRotacionPromedio(rotaciones: RotacionProducto[]): number {
    if (rotaciones.length === 0) return 0;
    const suma = rotaciones.reduce((sum, r) => sum + r.rotacionDias, 0);
    return Math.round(suma / rotaciones.length);
  }

  /**
   * Construye historial de transferencias
   */
  private construirTransferenciasHistorial(
    transferencias: Transferencia[],
    almacenId: string
  ): TransferenciaHistorial[] {
    return transferencias.map(t => {
      const fecha = t.fechaCreacion instanceof Timestamp ? t.fechaCreacion.toDate() : new Date(t.fechaCreacion);
      const esOrigen = t.almacenOrigenId === almacenId;

      return {
        id: t.id,
        fecha,
        tipoMovimiento: esOrigen ? 'salida' : 'entrada',
        almacenOrigenId: t.almacenOrigenId,
        almacenOrigenNombre: t.almacenOrigenNombre || '',
        almacenDestinoId: t.almacenDestinoId,
        almacenDestinoNombre: t.almacenDestinoNombre || '',
        productos: [], // Se podría expandir con datos de productos
        totalUnidades: t.unidadesIds?.length || 0,
        valorTotalUSD: t.valorTotalUSD || 0,
        estado: t.estado || 'completada',
        tiempoTransito: t.tiempoTransito
      };
    }).sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }

  /**
   * Calcula métricas de viajero
   */
  private calcularMetricasViajero(almacen: Almacen, transferencias: Transferencia[]): MetricasViajero {
    const ahora = new Date();
    const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hace90Dias = new Date(ahora.getTime() - 90 * 24 * 60 * 60 * 1000);

    const metricas = almacen.metricasOperativas;
    const proximoViaje = almacen.proximoViaje instanceof Timestamp ? almacen.proximoViaje.toDate() : undefined;

    // Transferencias salientes (viajes)
    const viajes = transferencias.filter(t => t.almacenOrigenId === almacen.id);
    const viajes30 = viajes.filter(t => {
      const fecha = t.fechaCreacion instanceof Timestamp ? t.fechaCreacion.toDate() : new Date(t.fechaCreacion);
      return fecha >= hace30Dias;
    });
    const viajes90 = viajes.filter(t => {
      const fecha = t.fechaCreacion instanceof Timestamp ? t.fechaCreacion.toDate() : new Date(t.fechaCreacion);
      return fecha >= hace90Dias;
    });

    const unidadesTotal = viajes.reduce((sum, v) => sum + (v.unidadesIds?.length || 0), 0);
    const valorTotal = viajes.reduce((sum, v) => sum + (v.valorTotalUSD || 0), 0);

    return {
      totalViajes: metricas?.viajesRealizados || viajes.length,
      viajesUltimos30Dias: viajes30.length,
      viajesUltimos90Dias: viajes90.length,
      proximoViaje,
      diasParaProximoViaje: proximoViaje
        ? Math.ceil((proximoViaje.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24))
        : undefined,
      capacidadPromedioViaje: viajes.length > 0 ? unidadesTotal / viajes.length : 0,
      unidadesTransportadasTotal: unidadesTotal,
      valorTransportadoUSD: valorTotal,
      tiempoPromedioViaje: 0, // Se podría calcular con datos adicionales
      tasaPuntualidad: metricas?.tasaPuntualidadViajes || 0,
      viajesATiempo: metricas?.viajesATiempo || 0,
      viajesRetrasados: (metricas?.viajesRealizados || 0) - (metricas?.viajesATiempo || 0)
    };
  }

  /**
   * Calcula tendencia de evaluación
   */
  private calcularTendenciaEvaluacion(
    historial: HistorialEvaluacionAlmacen[]
  ): 'mejorando' | 'estable' | 'empeorando' {
    if (historial.length < 2) return 'estable';

    const ultimas3 = historial.slice(-3);
    if (ultimas3.length < 2) return 'estable';

    const primera = ultimas3[0].puntuacion;
    const ultima = ultimas3[ultimas3.length - 1].puntuacion;

    if (ultima > primera + 5) return 'mejorando';
    if (ultima < primera - 5) return 'empeorando';
    return 'estable';
  }

  /**
   * Calcula comparativa con otros almacenes
   */
  private calcularComparativa(
    almacenActual: Almacen,
    todosAlmacenes: Almacen[],
    unidadesActual: Unidad[]
  ): ComparativaAlmacen[] {
    const comparativas = todosAlmacenes
      .filter(a => a.estadoAlmacen === 'activo')
      .map(a => {
        const esActual = a.id === almacenActual.id;
        const unidadesCount = esActual ? unidadesActual.length : (a.unidadesActuales || 0);
        const capacidad = a.capacidadUnidades || 1;

        return {
          almacenId: a.id,
          codigo: a.codigo,
          nombreAlmacen: a.nombre,
          tipo: a.tipo,
          pais: a.pais,
          esViajero: a.esViajero,
          capacidadUtilizada: (unidadesCount / capacidad) * 100,
          unidadesActuales: unidadesCount,
          rotacionPromedio: a.tiempoPromedioAlmacenamiento || 0,
          valorInventarioUSD: a.valorInventarioUSD || 0,
          movimientosMensuales: 0, // Se podría calcular con más datos
          incidencias: a.metricasOperativas?.incidenciasReportadas || 0,
          evaluacion: a.evaluacion?.puntuacion || 0,
          ranking: 0
        };
      });

    // Ordenar por evaluación y asignar ranking
    comparativas.sort((a, b) => b.evaluacion - a.evaluacion);
    comparativas.forEach((c, idx) => {
      c.ranking = idx + 1;
    });

    return comparativas;
  }

  /**
   * Genera alertas del almacén
   */
  private generarAlertas(
    almacen: Almacen,
    inventario: AlmacenAnalytics['inventarioActual'],
    productosEstancados: RotacionProducto[],
    productosProximosVencer: ProductoInventario[],
    metricasViajero?: MetricasViajero
  ): AlertaAlmacen[] {
    const alertas: AlertaAlmacen[] = [];
    const ahora = new Date();

    // Alerta de capacidad
    if (inventario.porcentajeCapacidad > 90) {
      alertas.push({
        tipo: 'capacidad',
        severidad: 'danger',
        mensaje: `Capacidad crítica: ${inventario.porcentajeCapacidad.toFixed(1)}% utilizado`,
        detalle: `${inventario.capacidadUtilizada} de ${inventario.capacidadTotal} unidades`,
        accionRecomendada: 'Programar transferencia o aumentar capacidad',
        fechaGeneracion: ahora
      });
    } else if (inventario.porcentajeCapacidad > 75) {
      alertas.push({
        tipo: 'capacidad',
        severidad: 'warning',
        mensaje: `Capacidad alta: ${inventario.porcentajeCapacidad.toFixed(1)}% utilizado`,
        accionRecomendada: 'Monitorear y planificar expansión',
        fechaGeneracion: ahora
      });
    }

    // Alertas de productos estancados
    if (productosEstancados.length > 0) {
      alertas.push({
        tipo: 'rotacion',
        severidad: productosEstancados.length > 5 ? 'danger' : 'warning',
        mensaje: `${productosEstancados.length} productos estancados (>90 días)`,
        detalle: productosEstancados.slice(0, 3).map(p => p.sku).join(', '),
        accionRecomendada: 'Revisar estrategia de precios o promociones',
        fechaGeneracion: ahora
      });
    }

    // Alertas de productos por vencer
    if (productosProximosVencer.length > 0) {
      const valorEnRiesgo = productosProximosVencer.reduce((sum, p) => sum + p.valorTotalUSD, 0);
      alertas.push({
        tipo: 'vencimiento',
        severidad: 'danger',
        mensaje: `${productosProximosVencer.length} productos próximos a vencer`,
        detalle: `Valor en riesgo: $${valorEnRiesgo.toFixed(2)} USD`,
        accionRecomendada: 'Priorizar venta o considerar promociones',
        fechaGeneracion: ahora
      });
    }

    // Alertas de evaluación baja
    if (almacen.evaluacion && almacen.evaluacion.puntuacion < 50) {
      alertas.push({
        tipo: 'evaluacion',
        severidad: 'warning',
        mensaje: `Evaluación baja: ${almacen.evaluacion.puntuacion}/100`,
        detalle: `Clasificación: ${almacen.evaluacion.clasificacion}`,
        accionRecomendada: 'Revisar métricas operativas y tomar acciones correctivas',
        fechaGeneracion: ahora
      });
    }

    // Alertas de viajero
    if (metricasViajero) {
      if (metricasViajero.diasParaProximoViaje !== undefined && metricasViajero.diasParaProximoViaje <= 7) {
        alertas.push({
          tipo: 'viaje',
          severidad: metricasViajero.diasParaProximoViaje <= 3 ? 'danger' : 'warning',
          mensaje: `Próximo viaje en ${metricasViajero.diasParaProximoViaje} días`,
          accionRecomendada: 'Preparar carga y documentación',
          fechaGeneracion: ahora
        });
      }

      if (metricasViajero.tasaPuntualidad < 80) {
        alertas.push({
          tipo: 'viaje',
          severidad: 'warning',
          mensaje: `Puntualidad baja: ${metricasViajero.tasaPuntualidad.toFixed(1)}%`,
          detalle: `${metricasViajero.viajesRetrasados} viajes retrasados`,
          accionRecomendada: 'Revisar planificación de viajes',
          fechaGeneracion: ahora
        });
      }
    }

    return alertas.sort((a, b) => {
      const severidadOrden = { danger: 0, warning: 1, info: 2 };
      return severidadOrden[a.severidad] - severidadOrden[b.severidad];
    });
  }

  /**
   * Calcula predicciones
   */
  private calcularPredicciones(
    inventario: AlmacenAnalytics['inventarioActual'],
    movimientos: MovimientoAlmacen[],
    productosProximosVencer: ProductoInventario[]
  ): PrediccionesAlmacen {
    const ahora = new Date();
    const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);

    const movimientos30 = movimientos.filter(m => m.fecha >= hace30Dias);
    const balance30 = this.calcularBalanceMovimientos(movimientos30);

    // Estimar capacidad en 30 días
    const capacidadEstimada = inventario.capacidadUtilizada + balance30;
    const porcentajeEstimado = inventario.capacidadTotal > 0
      ? (capacidadEstimada / inventario.capacidadTotal) * 100
      : 0;

    // Riesgo de sobrecapacidad
    let riesgoSobrecapacidad = 0;
    if (porcentajeEstimado > 100) riesgoSobrecapacidad = 100;
    else if (porcentajeEstimado > 90) riesgoSobrecapacidad = 80;
    else if (porcentajeEstimado > 80) riesgoSobrecapacidad = 50;
    else if (porcentajeEstimado > 70) riesgoSobrecapacidad = 25;

    // Tendencia de inventario
    let tendenciaInventario: 'creciendo' | 'estable' | 'decreciendo' = 'estable';
    if (balance30 > 10) tendenciaInventario = 'creciendo';
    else if (balance30 < -10) tendenciaInventario = 'decreciendo';

    return {
      capacidadEstimada30Dias: Math.max(0, capacidadEstimada),
      riesgoSobrecapacidad,
      productosProximosVencer: productosProximosVencer.length,
      valorEnRiesgoUSD: productosProximosVencer.reduce((sum, p) => sum + p.valorTotalUSD, 0),
      movimientosEstimados30Dias: movimientos30.length, // Proyección simple
      tendenciaInventario
    };
  }

  /**
   * Compara múltiples almacenes
   */
  async compararAlmacenes(almacenIds?: string[]): Promise<ComparativaAlmacen[]> {
    const todosAlmacenes = await this.getTodosAlmacenes();
    const almacenesFiltrados = almacenIds
      ? todosAlmacenes.filter(a => almacenIds.includes(a.id))
      : todosAlmacenes.filter(a => a.estadoAlmacen === 'activo');

    return almacenesFiltrados.map((a, idx) => ({
      almacenId: a.id,
      codigo: a.codigo,
      nombreAlmacen: a.nombre,
      tipo: a.tipo,
      pais: a.pais,
      esViajero: a.esViajero,
      capacidadUtilizada: a.capacidadUnidades
        ? ((a.unidadesActuales || 0) / a.capacidadUnidades) * 100
        : 0,
      unidadesActuales: a.unidadesActuales || 0,
      rotacionPromedio: a.tiempoPromedioAlmacenamiento || 0,
      valorInventarioUSD: a.valorInventarioUSD || 0,
      movimientosMensuales: 0,
      incidencias: a.metricasOperativas?.incidenciasReportadas || 0,
      evaluacion: a.evaluacion?.puntuacion || 0,
      ranking: idx + 1
    })).sort((a, b) => b.evaluacion - a.evaluacion);
  }
}

export const almacenAnalyticsService = new AlmacenAnalyticsService();
