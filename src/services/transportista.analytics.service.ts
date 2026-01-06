/**
 * Servicio de Analytics Avanzado para Transportistas
 * Proporciona métricas de rendimiento, costos, zonas y ROI
 */
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Transportista, TransportistaStats } from '../types/transportista.types';
import type { Entrega } from '../types/entrega.types';

// ============================================
// TIPOS PARA ANALYTICS DE TRANSPORTISTAS
// ============================================

/**
 * Entrega en el historial
 */
export interface EntregaHistorial {
  id: string;
  fecha: Date;
  ventaId: string;
  numeroVenta: string;
  clienteId: string;
  clienteNombre: string;
  zona: string;
  distrito: string;
  direccion: string;
  unidades: number;
  pesoKg?: number;
  volumenM3?: number;
  costoEntrega: number;
  tiempoEntrega: number;
  estado: 'completada' | 'fallida' | 'reprogramada' | 'en_proceso';
  motivoFallo?: string;
  calificacionCliente?: number;
  comentarioCliente?: string;
  observaciones?: string;
  fechaAsignacion?: Date;
  fechaCompletada?: Date;
}

/**
 * Métricas por zona
 */
export interface MetricasZona {
  zona: string;
  distrito: string;
  totalEntregas: number;
  entregasExitosas: number;
  entregasFallidas: number;
  entregasReprogramadas: number;
  tasaExito: number;
  tiempoPromedioHoras: number;
  costoPromedio: number;
  distanciaPromedioKm?: number;
  valorPromedioEntrega: number;
  diasConMasEntregas: string[];
  horariosOptimos: string[];
  esZonaProblematica: boolean;
}

/**
 * Métricas de costos
 */
export interface MetricasCosto {
  costoTotalPeriodo: number;
  costoPromedioEntrega: number;
  costoPromedioUnidad: number;
  costoPorKm?: number;
  costoPorKg?: number;
  costoFijo: number;
  costoVariable: number;

  distribucionCostos: {
    combustible: number;
    manoObra: number;
    vehiculo: number;
    peajes: number;
    otros: number;
  };

  tendenciaCostos: 'aumentando' | 'estable' | 'disminuyendo';
  variacionCostosMes: number;
  costoVsPromedio: number;
}

/**
 * Análisis de rendimiento
 */
export interface AnalisisRendimiento {
  entregasTotales: number;
  entregasExitosas: number;
  entregasFallidas: number;
  entregasReprogramadas: number;
  entregasEnProceso: number;
  tasaExitoGlobal: number;
  tasaReprogramacion: number;
  tasaFallo: number;

  tiempoPromedioEntrega: number;
  tiempoMinimoEntrega: number;
  tiempoMaximoEntrega: number;
  desviacionTiempo: number;

  puntualidad: number;
  entregasATiempo: number;
  entregasRetrasadas: number;

  calificacionPromedio: number;
  totalCalificaciones: number;
  distribucionCalificaciones: Record<number, number>;

  capacidadDiaria: number;
  capacidadUtilizada: number;
  utilizacionCapacidad: number;
}

/**
 * Incidencia del transportista
 */
export interface IncidenciaTransportista {
  id: string;
  fecha: Date;
  tipo: 'retraso' | 'danio_producto' | 'perdida' | 'queja_cliente' | 'accidente' | 'documentacion' | 'otro';
  severidad: 'leve' | 'moderada' | 'grave';
  entregaId?: string;
  numeroEntrega?: string;
  descripcion: string;
  impactoCosto?: number;
  clienteAfectado?: string;
  resuelta: boolean;
  fechaResolucion?: Date;
  accionCorrectiva?: string;
}

/**
 * Comparativa entre transportistas
 */
export interface ComparativaTransportistas {
  transportistaId: string;
  codigo: string;
  nombre: string;
  tipo: 'interno' | 'externo';
  entregas: number;
  tasaExito: number;
  tiempoPromedio: number;
  costoPromedio: number;
  calificacion: number;
  incidencias: number;
  puntualidad: number;
  ranking: number;
  esRecomendado: boolean;
  tendencia: 'mejorando' | 'estable' | 'empeorando';
}

/**
 * Distribución temporal
 */
export interface DistribucionTemporal {
  dia: string;
  entregas: number;
  entregasExitosas: number;
  tasaExito: number;
  tiempoPromedio: number;
  costoPromedio: number;
}

/**
 * Distribución por hora
 */
export interface DistribucionHoraria {
  hora: string;
  entregas: number;
  tasaExito: number;
  tiempoPromedio: number;
}

/**
 * ROI del transportista
 */
export interface ROITransportista {
  ingresoGenerado: number;
  valorEntregasCompletadas: number;
  costoTotal: number;
  margenBruto: number;
  margenNeto: number;
  retornoInversion: number;
  costoOportunidadFallos: number;
  valorPorEntrega: number;
  rentabilidadPorHora: number;
}

/**
 * Alerta del transportista
 */
export interface AlertaTransportista {
  id: string;
  tipo: 'rendimiento' | 'costo' | 'incidencia' | 'capacidad' | 'calificacion' | 'puntualidad';
  severidad: 'info' | 'warning' | 'danger';
  mensaje: string;
  detalle?: string;
  metricaActual?: number;
  metricaObjetivo?: number;
  accionRecomendada?: string;
  fechaGeneracion: Date;
}

/**
 * Predicciones del transportista
 */
export interface PrediccionesTransportista {
  entregasEstimadas30Dias: number;
  costoEstimado30Dias: number;
  tasaExitoProyectada: number;
  riesgoRotacion: number;
  capacidadOptima: number;
  zonasRecomendadas: string[];
  horariosOptimos: string[];
}

/**
 * Comentario de cliente
 */
export interface ComentarioCliente {
  fecha: Date;
  calificacion: number;
  comentario: string;
  clienteNombre: string;
  entregaId: string;
  esPositivo: boolean;
}

// ============================================
// ANALYTICS COMPLETO
// ============================================

export interface TransportistaAnalytics {
  transportista: Transportista;

  // Rendimiento general
  rendimiento: AnalisisRendimiento;
  tendenciaRendimiento: 'mejorando' | 'estable' | 'empeorando';

  // Historial de entregas
  entregasHistorial: EntregaHistorial[];
  entregasUltimos30Dias: number;
  entregasUltimos90Dias: number;
  primeraEntrega?: Date;
  ultimaEntrega?: Date;
  diasActivo: number;

  // Por zona
  metricasPorZona: MetricasZona[];
  zonasConMejorRendimiento: string[];
  zonasProblematicas: string[];
  coberturadistribucionZonas: number;

  // Costos
  metricasCosto: MetricasCosto;
  costoTotalHistorico: number;
  tendenciaCostos: 'aumentando' | 'estable' | 'disminuyendo';

  // Distribución temporal
  distribucionPorDia: DistribucionTemporal[];
  distribucionPorHora: DistribucionHoraria[];
  diaMasProductivo: string;
  horaMasProductiva: string;

  // Incidencias
  incidencias: IncidenciaTransportista[];
  totalIncidencias: number;
  incidenciasAbiertas: number;
  tasaIncidencia: number;
  impactoTotalIncidencias: number;

  // Calidad y satisfacción
  calificacionPromedio: number;
  totalCalificaciones: number;
  distribucionCalificaciones: Record<number, number>;
  comentariosRecientes: ComentarioCliente[];
  satisfaccionClientes: number;

  // Comparativa
  comparativaTransportistas: ComparativaTransportistas[];
  rankingGeneral: number;
  totalTransportistas: number;
  percentilRendimiento: number;

  // ROI
  roi: ROITransportista;

  // Alertas
  alertas: AlertaTransportista[];
  alertasCriticas: number;

  // Predicciones
  predicciones: PrediccionesTransportista;

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

class TransportistaAnalyticsService {
  /**
   * Obtiene analytics completos de un transportista
   */
  async getTransportistaAnalytics(transportistaId: string): Promise<TransportistaAnalytics | null> {
    try {
      // Obtener transportista
      const transportistaDoc = await getDocs(
        query(collection(db, 'transportistas'), where('__name__', '==', transportistaId))
      );

      if (transportistaDoc.empty) {
        console.error('Transportista no encontrado:', transportistaId);
        return null;
      }

      const transportista = {
        id: transportistaDoc.docs[0].id,
        ...transportistaDoc.docs[0].data()
      } as Transportista;

      const ahora = new Date();
      const hace365Dias = new Date(ahora.getTime() - 365 * 24 * 60 * 60 * 1000);

      // Obtener datos relacionados
      const [
        entregasData,
        todosTransportistasData
      ] = await Promise.all([
        this.getEntregasTransportista(transportistaId),
        this.getTodosTransportistas()
      ]);

      // Construir historial de entregas
      const entregasHistorial = this.construirEntregasHistorial(entregasData);

      // Calcular rendimiento
      const rendimiento = this.calcularRendimiento(entregasHistorial, transportista);
      const tendenciaRendimiento = this.calcularTendenciaRendimiento(entregasHistorial);

      // Métricas por zona
      const metricasPorZona = this.calcularMetricasPorZona(entregasHistorial);
      const zonasConMejorRendimiento = metricasPorZona
        .filter(z => z.tasaExito >= 90)
        .map(z => z.zona);
      const zonasProblematicas = metricasPorZona
        .filter(z => z.esZonaProblematica)
        .map(z => z.zona);

      // Métricas de costos
      const metricasCosto = this.calcularMetricasCosto(entregasHistorial, transportista);

      // Distribución temporal
      const distribucionPorDia = this.calcularDistribucionPorDia(entregasHistorial);
      const distribucionPorHora = this.calcularDistribucionPorHora(entregasHistorial);

      // Incidencias (simuladas por ahora)
      const incidencias = this.generarIncidencias(entregasHistorial);

      // Calidad
      const { calificacionPromedio, distribucionCalificaciones, comentariosRecientes } =
        this.calcularMetricasCalidad(entregasHistorial);

      // Comparativa
      const comparativaTransportistas = await this.calcularComparativa(
        transportista,
        todosTransportistasData
      );
      const rankingGeneral = comparativaTransportistas.find(c => c.transportistaId === transportistaId)?.ranking || 0;

      // ROI
      const roi = this.calcularROI(entregasHistorial, metricasCosto);

      // Alertas
      const alertas = this.generarAlertas(transportista, rendimiento, metricasCosto, calificacionPromedio);

      // Predicciones
      const predicciones = this.calcularPredicciones(entregasHistorial, rendimiento, metricasPorZona);

      // Conteos por período
      const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
      const hace90Dias = new Date(ahora.getTime() - 90 * 24 * 60 * 60 * 1000);
      const entregasUltimos30Dias = entregasHistorial.filter(e => e.fecha >= hace30Dias).length;
      const entregasUltimos90Dias = entregasHistorial.filter(e => e.fecha >= hace90Dias).length;

      // Primera y última entrega
      const entregasOrdenadas = [...entregasHistorial].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
      const primeraEntrega = entregasOrdenadas[0]?.fecha;
      const ultimaEntrega = entregasOrdenadas[entregasOrdenadas.length - 1]?.fecha;

      // Días activo
      const diasActivo = primeraEntrega
        ? Math.floor((ahora.getTime() - primeraEntrega.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        transportista,

        rendimiento,
        tendenciaRendimiento,

        entregasHistorial,
        entregasUltimos30Dias,
        entregasUltimos90Dias,
        primeraEntrega,
        ultimaEntrega,
        diasActivo,

        metricasPorZona,
        zonasConMejorRendimiento,
        zonasProblematicas,
        coberturadistribucionZonas: metricasPorZona.length,

        metricasCosto,
        costoTotalHistorico: metricasCosto.costoTotalPeriodo,
        tendenciaCostos: metricasCosto.tendenciaCostos,

        distribucionPorDia,
        distribucionPorHora,
        diaMasProductivo: distribucionPorDia.sort((a, b) => b.entregas - a.entregas)[0]?.dia || 'N/A',
        horaMasProductiva: distribucionPorHora.sort((a, b) => b.entregas - a.entregas)[0]?.hora || 'N/A',

        incidencias,
        totalIncidencias: incidencias.length,
        incidenciasAbiertas: incidencias.filter(i => !i.resuelta).length,
        tasaIncidencia: entregasHistorial.length > 0
          ? (incidencias.length / entregasHistorial.length) * 100
          : 0,
        impactoTotalIncidencias: incidencias.reduce((sum, i) => sum + (i.impactoCosto || 0), 0),

        calificacionPromedio,
        totalCalificaciones: entregasHistorial.filter(e => e.calificacionCliente).length,
        distribucionCalificaciones,
        comentariosRecientes,
        satisfaccionClientes: calificacionPromedio >= 4 ? 100 * (calificacionPromedio / 5) : calificacionPromedio * 20,

        comparativaTransportistas,
        rankingGeneral,
        totalTransportistas: todosTransportistasData.length,
        percentilRendimiento: todosTransportistasData.length > 0
          ? Math.round(((todosTransportistasData.length - rankingGeneral + 1) / todosTransportistasData.length) * 100)
          : 0,

        roi,

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
      console.error('Error obteniendo analytics de transportista:', error);
      throw error;
    }
  }

  /**
   * Obtiene entregas del transportista
   */
  private async getEntregasTransportista(transportistaId: string): Promise<Entrega[]> {
    try {
      const q = query(
        collection(db, 'entregas'),
        where('transportistaId', '==', transportistaId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Entrega[];
    } catch {
      // Si no existe la colección, retornar array vacío
      return [];
    }
  }

  /**
   * Obtiene todos los transportistas
   */
  private async getTodosTransportistas(): Promise<Transportista[]> {
    const snapshot = await getDocs(collection(db, 'transportistas'));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Transportista[];
  }

  /**
   * Construye historial de entregas
   */
  private construirEntregasHistorial(entregas: Entrega[]): EntregaHistorial[] {
    return entregas.map(e => {
      const fecha = e.fechaEntrega instanceof Timestamp
        ? e.fechaEntrega.toDate()
        : e.fechaProgramada instanceof Timestamp
        ? e.fechaProgramada.toDate()
        : new Date();

      return {
        id: e.id,
        fecha,
        ventaId: e.ventaId || '',
        numeroVenta: e.numeroVenta || '',
        clienteId: e.clienteId || '',
        clienteNombre: e.clienteNombre || '',
        zona: e.zona || e.distrito || 'Sin zona',
        distrito: e.distrito || '',
        direccion: e.direccion || '',
        unidades: e.unidades || 1,
        pesoKg: e.pesoKg,
        volumenM3: e.volumenM3,
        costoEntrega: e.costoEntrega || 0,
        tiempoEntrega: e.tiempoEntrega || 0,
        estado: (e.estado as EntregaHistorial['estado']) || 'completada',
        motivoFallo: e.motivoFallo,
        calificacionCliente: e.calificacion,
        comentarioCliente: e.comentario,
        observaciones: e.observaciones,
        fechaAsignacion: e.fechaAsignacion instanceof Timestamp ? e.fechaAsignacion.toDate() : undefined,
        fechaCompletada: e.fechaEntrega instanceof Timestamp ? e.fechaEntrega.toDate() : undefined
      };
    }).sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }

  /**
   * Calcula métricas de rendimiento
   */
  private calcularRendimiento(entregas: EntregaHistorial[], transportista: Transportista): AnalisisRendimiento {
    const total = entregas.length;
    const exitosas = entregas.filter(e => e.estado === 'completada').length;
    const fallidas = entregas.filter(e => e.estado === 'fallida').length;
    const reprogramadas = entregas.filter(e => e.estado === 'reprogramada').length;
    const enProceso = entregas.filter(e => e.estado === 'en_proceso').length;

    const tiempos = entregas.filter(e => e.tiempoEntrega > 0).map(e => e.tiempoEntrega);
    const tiempoPromedio = tiempos.length > 0 ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : 0;
    const tiempoMin = tiempos.length > 0 ? Math.min(...tiempos) : 0;
    const tiempoMax = tiempos.length > 0 ? Math.max(...tiempos) : 0;

    // Desviación estándar de tiempo
    const varianza = tiempos.length > 0
      ? tiempos.reduce((sum, t) => sum + Math.pow(t - tiempoPromedio, 2), 0) / tiempos.length
      : 0;
    const desviacion = Math.sqrt(varianza);

    // Calificaciones
    const calificaciones = entregas.filter(e => e.calificacionCliente).map(e => e.calificacionCliente!);
    const calificacionPromedio = calificaciones.length > 0
      ? calificaciones.reduce((a, b) => a + b, 0) / calificaciones.length
      : 0;

    const distribucionCalificaciones: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    calificaciones.forEach(c => {
      const key = Math.round(c);
      if (key >= 1 && key <= 5) {
        distribucionCalificaciones[key]++;
      }
    });

    // Usar métricas del transportista si existen
    const metricas = transportista.metricas;
    const entregasExitosasFromMetricas = metricas?.entregasExitosas || exitosas;
    const tasaExitoFromMetricas = metricas?.tasaExito || (total > 0 ? (exitosas / total) * 100 : 0);

    return {
      entregasTotales: total,
      entregasExitosas: entregasExitosasFromMetricas,
      entregasFallidas: fallidas,
      entregasReprogramadas: reprogramadas,
      entregasEnProceso: enProceso,
      tasaExitoGlobal: tasaExitoFromMetricas,
      tasaReprogramacion: total > 0 ? (reprogramadas / total) * 100 : 0,
      tasaFallo: total > 0 ? (fallidas / total) * 100 : 0,

      tiempoPromedioEntrega: metricas?.tiempoPromedioHoras || tiempoPromedio,
      tiempoMinimoEntrega: tiempoMin,
      tiempoMaximoEntrega: tiempoMax,
      desviacionTiempo: desviacion,

      puntualidad: 85, // Se calcularía con datos de hora prometida
      entregasATiempo: Math.round(exitosas * 0.85),
      entregasRetrasadas: Math.round(exitosas * 0.15),

      calificacionPromedio,
      totalCalificaciones: calificaciones.length,
      distribucionCalificaciones,

      capacidadDiaria: transportista.capacidadDiaria || 20,
      capacidadUtilizada: 0, // Se calcularía con entregas del día
      utilizacionCapacidad: 70 // Promedio estimado
    };
  }

  /**
   * Calcula tendencia de rendimiento
   */
  private calcularTendenciaRendimiento(entregas: EntregaHistorial[]): 'mejorando' | 'estable' | 'empeorando' {
    const ahora = new Date();
    const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hace60Dias = new Date(ahora.getTime() - 60 * 24 * 60 * 60 * 1000);

    const entregasRecientes = entregas.filter(e => e.fecha >= hace30Dias);
    const entregasAnteriores = entregas.filter(e => e.fecha >= hace60Dias && e.fecha < hace30Dias);

    const tasaReciente = entregasRecientes.length > 0
      ? (entregasRecientes.filter(e => e.estado === 'completada').length / entregasRecientes.length) * 100
      : 0;
    const tasaAnterior = entregasAnteriores.length > 0
      ? (entregasAnteriores.filter(e => e.estado === 'completada').length / entregasAnteriores.length) * 100
      : 0;

    if (tasaReciente > tasaAnterior + 5) return 'mejorando';
    if (tasaReciente < tasaAnterior - 5) return 'empeorando';
    return 'estable';
  }

  /**
   * Calcula métricas por zona
   */
  private calcularMetricasPorZona(entregas: EntregaHistorial[]): MetricasZona[] {
    const zonasMap = new Map<string, EntregaHistorial[]>();

    entregas.forEach(e => {
      const zona = e.zona || 'Sin zona';
      const existing = zonasMap.get(zona) || [];
      existing.push(e);
      zonasMap.set(zona, existing);
    });

    return Array.from(zonasMap.entries()).map(([zona, entregasZona]) => {
      const exitosas = entregasZona.filter(e => e.estado === 'completada').length;
      const fallidas = entregasZona.filter(e => e.estado === 'fallida').length;
      const reprogramadas = entregasZona.filter(e => e.estado === 'reprogramada').length;
      const total = entregasZona.length;

      const tiempos = entregasZona.filter(e => e.tiempoEntrega > 0).map(e => e.tiempoEntrega);
      const tiempoPromedio = tiempos.length > 0 ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : 0;

      const costos = entregasZona.filter(e => e.costoEntrega > 0).map(e => e.costoEntrega);
      const costoPromedio = costos.length > 0 ? costos.reduce((a, b) => a + b, 0) / costos.length : 0;

      const tasaExito = total > 0 ? (exitosas / total) * 100 : 0;

      // Calcular días con más entregas
      const diasCount: Record<string, number> = {};
      entregasZona.forEach(e => {
        const dia = e.fecha.toLocaleDateString('es-PE', { weekday: 'long' });
        diasCount[dia] = (diasCount[dia] || 0) + 1;
      });
      const diasOrdenados = Object.entries(diasCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([dia]) => dia);

      return {
        zona,
        distrito: entregasZona[0]?.distrito || '',
        totalEntregas: total,
        entregasExitosas: exitosas,
        entregasFallidas: fallidas,
        entregasReprogramadas: reprogramadas,
        tasaExito,
        tiempoPromedioHoras: tiempoPromedio,
        costoPromedio,
        valorPromedioEntrega: 0, // Se calcularía con datos de ventas
        diasConMasEntregas: diasOrdenados,
        horariosOptimos: ['09:00-12:00', '14:00-17:00'],
        esZonaProblematica: tasaExito < 80 || fallidas > 3
      };
    }).sort((a, b) => b.totalEntregas - a.totalEntregas);
  }

  /**
   * Calcula métricas de costos
   */
  private calcularMetricasCosto(entregas: EntregaHistorial[], transportista: Transportista): MetricasCosto {
    const costos = entregas.filter(e => e.costoEntrega > 0).map(e => e.costoEntrega);
    const costoTotal = costos.reduce((a, b) => a + b, 0);
    const costoPromedio = costos.length > 0 ? costoTotal / costos.length : 0;

    const unidadesTotal = entregas.reduce((sum, e) => sum + e.unidades, 0);
    const costoPromedioUnidad = unidadesTotal > 0 ? costoTotal / unidadesTotal : 0;

    // Costos del transportista si existen
    const costoFijo = transportista.costoFijo || 0;
    const costoVariable = transportista.costoPorEntrega || costoPromedio;

    return {
      costoTotalPeriodo: costoTotal,
      costoPromedioEntrega: costoPromedio,
      costoPromedioUnidad,
      costoFijo,
      costoVariable,

      distribucionCostos: {
        combustible: costoTotal * 0.30,
        manoObra: costoTotal * 0.40,
        vehiculo: costoTotal * 0.15,
        peajes: costoTotal * 0.05,
        otros: costoTotal * 0.10
      },

      tendenciaCostos: 'estable',
      variacionCostosMes: 0,
      costoVsPromedio: 0
    };
  }

  /**
   * Calcula distribución por día
   */
  private calcularDistribucionPorDia(entregas: EntregaHistorial[]): DistribucionTemporal[] {
    const dias = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    const diasMap = new Map<string, EntregaHistorial[]>();

    dias.forEach(dia => diasMap.set(dia, []));

    entregas.forEach(e => {
      const dia = e.fecha.toLocaleDateString('es-PE', { weekday: 'long' }).toLowerCase();
      const existing = diasMap.get(dia) || [];
      existing.push(e);
      diasMap.set(dia, existing);
    });

    return dias.map(dia => {
      const entregasDia = diasMap.get(dia) || [];
      const exitosas = entregasDia.filter(e => e.estado === 'completada').length;
      const tiempos = entregasDia.filter(e => e.tiempoEntrega > 0).map(e => e.tiempoEntrega);
      const costos = entregasDia.filter(e => e.costoEntrega > 0).map(e => e.costoEntrega);

      return {
        dia,
        entregas: entregasDia.length,
        entregasExitosas: exitosas,
        tasaExito: entregasDia.length > 0 ? (exitosas / entregasDia.length) * 100 : 0,
        tiempoPromedio: tiempos.length > 0 ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : 0,
        costoPromedio: costos.length > 0 ? costos.reduce((a, b) => a + b, 0) / costos.length : 0
      };
    });
  }

  /**
   * Calcula distribución por hora
   */
  private calcularDistribucionPorHora(entregas: EntregaHistorial[]): DistribucionHoraria[] {
    const horas: DistribucionHoraria[] = [];

    for (let h = 8; h <= 20; h++) {
      const horaStr = `${h.toString().padStart(2, '0')}:00`;
      const entregasHora = entregas.filter(e => e.fecha.getHours() === h);
      const exitosas = entregasHora.filter(e => e.estado === 'completada').length;
      const tiempos = entregasHora.filter(e => e.tiempoEntrega > 0).map(e => e.tiempoEntrega);

      horas.push({
        hora: horaStr,
        entregas: entregasHora.length,
        tasaExito: entregasHora.length > 0 ? (exitosas / entregasHora.length) * 100 : 0,
        tiempoPromedio: tiempos.length > 0 ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : 0
      });
    }

    return horas;
  }

  /**
   * Genera incidencias simuladas
   */
  private generarIncidencias(entregas: EntregaHistorial[]): IncidenciaTransportista[] {
    const incidencias: IncidenciaTransportista[] = [];
    let idCounter = 1;

    // Generar incidencias basadas en entregas fallidas
    entregas.filter(e => e.estado === 'fallida').forEach(e => {
      incidencias.push({
        id: `inc-${idCounter++}`,
        fecha: e.fecha,
        tipo: 'retraso',
        severidad: 'moderada',
        entregaId: e.id,
        numeroEntrega: e.numeroVenta,
        descripcion: e.motivoFallo || 'Entrega fallida',
        clienteAfectado: e.clienteNombre,
        resuelta: true,
        accionCorrectiva: 'Reprogramación de entrega'
      });
    });

    return incidencias;
  }

  /**
   * Calcula métricas de calidad
   */
  private calcularMetricasCalidad(entregas: EntregaHistorial[]): {
    calificacionPromedio: number;
    distribucionCalificaciones: Record<number, number>;
    comentariosRecientes: ComentarioCliente[];
  } {
    const calificaciones = entregas.filter(e => e.calificacionCliente);
    const promedio = calificaciones.length > 0
      ? calificaciones.reduce((sum, e) => sum + e.calificacionCliente!, 0) / calificaciones.length
      : 0;

    const distribucion: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    calificaciones.forEach(e => {
      const key = Math.round(e.calificacionCliente!);
      if (key >= 1 && key <= 5) {
        distribucion[key]++;
      }
    });

    const comentarios: ComentarioCliente[] = entregas
      .filter(e => e.comentarioCliente && e.calificacionCliente)
      .slice(0, 10)
      .map(e => ({
        fecha: e.fecha,
        calificacion: e.calificacionCliente!,
        comentario: e.comentarioCliente!,
        clienteNombre: e.clienteNombre,
        entregaId: e.id,
        esPositivo: e.calificacionCliente! >= 4
      }));

    return {
      calificacionPromedio: promedio,
      distribucionCalificaciones: distribucion,
      comentariosRecientes: comentarios
    };
  }

  /**
   * Calcula comparativa con otros transportistas
   */
  private async calcularComparativa(
    transportistaActual: Transportista,
    todosTransportistas: Transportista[]
  ): Promise<ComparativaTransportistas[]> {
    const comparativas = todosTransportistas
      .filter(t => t.estado === 'activo')
      .map(t => {
        const metricas = t.metricas;
        return {
          transportistaId: t.id,
          codigo: t.codigo,
          nombre: t.nombre,
          tipo: t.tipo,
          entregas: metricas?.entregasExitosas || 0,
          tasaExito: metricas?.tasaExito || 0,
          tiempoPromedio: metricas?.tiempoPromedioHoras || 0,
          costoPromedio: t.costoPorEntrega || 0,
          calificacion: 4.0, // Se calcularía con datos reales
          incidencias: 0,
          puntualidad: 85,
          ranking: 0,
          esRecomendado: (metricas?.tasaExito || 0) >= 90,
          tendencia: 'estable' as const
        };
      });

    // Ordenar por tasa de éxito y asignar ranking
    comparativas.sort((a, b) => b.tasaExito - a.tasaExito);
    comparativas.forEach((c, idx) => {
      c.ranking = idx + 1;
    });

    return comparativas;
  }

  /**
   * Calcula ROI del transportista
   */
  private calcularROI(entregas: EntregaHistorial[], costos: MetricasCosto): ROITransportista {
    const entregasCompletadas = entregas.filter(e => e.estado === 'completada');
    const costoTotal = costos.costoTotalPeriodo;

    // Valor estimado de entregas (asumiendo valor promedio)
    const valorPromedioPorEntrega = 150; // PEN
    const valorEntregas = entregasCompletadas.length * valorPromedioPorEntrega;

    const margenBruto = valorEntregas - costoTotal;
    const margenNeto = margenBruto * 0.8; // Asumiendo 20% de overhead

    const entregasFallidas = entregas.filter(e => e.estado === 'fallida').length;
    const costoOportunidad = entregasFallidas * valorPromedioPorEntrega;

    return {
      ingresoGenerado: valorEntregas,
      valorEntregasCompletadas: valorEntregas,
      costoTotal,
      margenBruto,
      margenNeto,
      retornoInversion: costoTotal > 0 ? ((margenNeto / costoTotal) * 100) : 0,
      costoOportunidadFallos: costoOportunidad,
      valorPorEntrega: entregasCompletadas.length > 0 ? valorEntregas / entregasCompletadas.length : 0,
      rentabilidadPorHora: 0 // Se calcularía con datos de horas trabajadas
    };
  }

  /**
   * Genera alertas del transportista
   */
  private generarAlertas(
    transportista: Transportista,
    rendimiento: AnalisisRendimiento,
    costos: MetricasCosto,
    calificacion: number
  ): AlertaTransportista[] {
    const alertas: AlertaTransportista[] = [];
    const ahora = new Date();
    let idCounter = 1;

    // Alerta de tasa de éxito baja
    if (rendimiento.tasaExitoGlobal < 85) {
      alertas.push({
        id: `alert-${idCounter++}`,
        tipo: 'rendimiento',
        severidad: rendimiento.tasaExitoGlobal < 75 ? 'danger' : 'warning',
        mensaje: `Tasa de éxito por debajo del objetivo`,
        detalle: `Actual: ${rendimiento.tasaExitoGlobal.toFixed(1)}%, Objetivo: 85%`,
        metricaActual: rendimiento.tasaExitoGlobal,
        metricaObjetivo: 85,
        accionRecomendada: 'Revisar causas de entregas fallidas',
        fechaGeneracion: ahora
      });
    }

    // Alerta de calificación baja
    if (calificacion > 0 && calificacion < 4) {
      alertas.push({
        id: `alert-${idCounter++}`,
        tipo: 'calificacion',
        severidad: calificacion < 3 ? 'danger' : 'warning',
        mensaje: `Calificación de clientes por debajo del promedio`,
        detalle: `Actual: ${calificacion.toFixed(1)}/5`,
        metricaActual: calificacion,
        metricaObjetivo: 4,
        accionRecomendada: 'Mejorar servicio al cliente',
        fechaGeneracion: ahora
      });
    }

    // Alerta de puntualidad
    if (rendimiento.puntualidad < 80) {
      alertas.push({
        id: `alert-${idCounter++}`,
        tipo: 'puntualidad',
        severidad: rendimiento.puntualidad < 70 ? 'danger' : 'warning',
        mensaje: `Puntualidad por debajo del objetivo`,
        detalle: `Actual: ${rendimiento.puntualidad.toFixed(1)}%, Objetivo: 80%`,
        metricaActual: rendimiento.puntualidad,
        metricaObjetivo: 80,
        accionRecomendada: 'Optimizar rutas y tiempos',
        fechaGeneracion: ahora
      });
    }

    // Alerta de costos altos
    if (costos.costoPromedioEntrega > 20) {
      alertas.push({
        id: `alert-${idCounter++}`,
        tipo: 'costo',
        severidad: 'warning',
        mensaje: `Costo por entrega elevado`,
        detalle: `Actual: S/ ${costos.costoPromedioEntrega.toFixed(2)}`,
        metricaActual: costos.costoPromedioEntrega,
        accionRecomendada: 'Revisar eficiencia de rutas',
        fechaGeneracion: ahora
      });
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
    entregas: EntregaHistorial[],
    rendimiento: AnalisisRendimiento,
    zonas: MetricasZona[]
  ): PrediccionesTransportista {
    const ahora = new Date();
    const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const entregas30 = entregas.filter(e => e.fecha >= hace30Dias).length;

    // Zonas recomendadas (mejor tasa de éxito)
    const zonasRecomendadas = zonas
      .filter(z => z.tasaExito >= 90)
      .slice(0, 5)
      .map(z => z.zona);

    return {
      entregasEstimadas30Dias: entregas30,
      costoEstimado30Dias: entregas30 * 15, // Estimación simple
      tasaExitoProyectada: rendimiento.tasaExitoGlobal,
      riesgoRotacion: rendimiento.tasaExitoGlobal < 75 ? 30 : rendimiento.tasaExitoGlobal < 85 ? 15 : 5,
      capacidadOptima: rendimiento.capacidadDiaria * 0.8,
      zonasRecomendadas,
      horariosOptimos: ['09:00-12:00', '14:00-17:00']
    };
  }

  /**
   * Compara múltiples transportistas
   */
  async compararTransportistas(transportistaIds?: string[]): Promise<ComparativaTransportistas[]> {
    const todosTransportistas = await this.getTodosTransportistas();

    const transportistasFiltrados = transportistaIds
      ? todosTransportistas.filter(t => transportistaIds.includes(t.id))
      : todosTransportistas.filter(t => t.estado === 'activo');

    const comparativas = transportistasFiltrados.map(t => ({
      transportistaId: t.id,
      codigo: t.codigo,
      nombre: t.nombre,
      tipo: t.tipo,
      entregas: t.metricas?.entregasExitosas || 0,
      tasaExito: t.metricas?.tasaExito || 0,
      tiempoPromedio: t.metricas?.tiempoPromedioHoras || 0,
      costoPromedio: t.costoPorEntrega || 0,
      calificacion: 4.0,
      incidencias: 0,
      puntualidad: 85,
      ranking: 0,
      esRecomendado: (t.metricas?.tasaExito || 0) >= 90,
      tendencia: 'estable' as const
    }));

    comparativas.sort((a, b) => b.tasaExito - a.tasaExito);
    comparativas.forEach((c, idx) => {
      c.ranking = idx + 1;
    });

    return comparativas;
  }
}

export const transportistaAnalyticsService = new TransportistaAnalyticsService();
