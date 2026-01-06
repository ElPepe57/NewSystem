/**
 * Servicio de Analytics Avanzado para Canales de Venta
 * Proporciona métricas de conversión, ROI, clientes y tendencias
 */
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CanalVenta, CanalVentaStats } from '../types/canalVenta.types';
import type { Venta } from '../types/venta.types';
import type { Cotizacion } from '../types/cotizacion.types';

// ============================================
// TIPOS PARA ANALYTICS DE CANALES DE VENTA
// ============================================

/**
 * Venta del canal
 */
export interface VentaCanal {
  ventaId: string;
  numeroVenta: string;
  fecha: Date;
  clienteId: string;
  clienteNombre: string;
  productos: number;
  unidades: number;
  subtotalPEN: number;
  descuento: number;
  totalPEN: number;
  margen: number;
  margenPorcentaje: number;
  estado: string;
  tiempoConversion?: number;
  esClienteNuevo: boolean;
}

/**
 * Cotización del canal
 */
export interface CotizacionCanal {
  cotizacionId: string;
  numero: string;
  fecha: Date;
  clienteId: string;
  clienteNombre: string;
  montoPEN: number;
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'vencida' | 'convertida';
  convertidaVenta: boolean;
  ventaId?: string;
  diasHastaConversion?: number;
  motivoRechazo?: string;
  fechaVencimiento?: Date;
}

/**
 * Métricas de conversión
 */
export interface MetricasConversion {
  cotizacionesTotales: number;
  cotizacionesConvertidas: number;
  cotizacionesRechazadas: number;
  cotizacionesPendientes: number;
  cotizacionesVencidas: number;

  tasaConversion: number;
  tasaRechazo: number;
  tasaVencimiento: number;

  tiempoPromedioConversion: number;
  tiempoMinimoConversion: number;
  tiempoMaximoConversion: number;

  valorPromedioConvertida: number;
  valorPromedioPerdida: number;
  valorTotalPerdido: number;

  motivosRechazo: Array<{
    motivo: string;
    count: number;
    porcentaje: number;
    valorPerdidoPEN: number;
  }>;
}

/**
 * Métricas de ventas
 */
export interface MetricasVenta {
  ventasTotales: number;
  ventasUltimos7Dias: number;
  ventasUltimos30Dias: number;
  ventasUltimos90Dias: number;

  ingresosTotales: number;
  ingresosUltimos7Dias: number;
  ingresosUltimos30Dias: number;
  ingresosUltimos90Dias: number;

  ticketPromedio: number;
  ticketMaximo: number;
  ticketMinimo: number;
  ticketMediano: number;

  unidadesVendidas: number;
  productosUnicos: number;

  margenPromedio: number;
  margenTotal: number;
  margenPorcentajePromedio: number;

  descuentoPromedio: number;
  descuentoTotal: number;
}

/**
 * Métricas de clientes
 */
export interface MetricasCliente {
  clientesUnicos: number;
  clientesNuevos: number;
  clientesRecurrentes: number;
  tasaRecurrencia: number;
  tasaRetencion: number;

  clienteTop: {
    id: string;
    nombre: string;
    compras: number;
    montoPEN: number;
    ultimaCompra: Date;
  };

  promedioComprasPorCliente: number;
  frecuenciaCompra: number;

  adquisicionClientes: Array<{
    periodo: string;
    mes: number;
    anio: number;
    nuevos: number;
    recurrentes: number;
    total: number;
  }>;

  segmentacionClientes: {
    vip: number;
    frecuentes: number;
    ocasionales: number;
    nuevos: number;
  };
}

/**
 * Métricas de ROI
 */
export interface MetricasROI {
  ingresosTotales: number;
  costoCanal: number;
  comisionesPagadas: number;
  tasaComision: number;
  margenBruto: number;
  margenNeto: number;
  roiPorcentaje: number;
  rentabilidadNeta: number;
  costoAdquisicionCliente: number;
  valorVidaCliente: number;
  ingresoPorCliente: number;
}

/**
 * Historial por período
 */
export interface HistorialPeriodo {
  periodo: string;
  mes: number;
  anio: number;
  ventas: number;
  ingresos: number;
  margen: number;
  margenPorcentaje: number;
  clientes: number;
  clientesNuevos: number;
  ticketPromedio: number;
  tasaConversion: number;
  crecimientoVentas: number;
  crecimientoIngresos: number;
}

/**
 * Comparativa entre canales
 */
export interface ComparativaCanales {
  canalId: string;
  codigo: string;
  nombre: string;
  icono?: string;
  ventas: number;
  ingresos: number;
  margen: number;
  margenPorcentaje: number;
  ticketPromedio: number;
  tasaConversion: number;
  clientes: number;
  clientesNuevos: number;
  participacion: number;
  ranking: number;
  tendencia: 'creciendo' | 'estable' | 'decreciendo';
  esDestacado: boolean;
}

/**
 * Producto top del canal
 */
export interface ProductoTopCanal {
  productoId: string;
  sku: string;
  nombre: string;
  marca: string;
  unidades: number;
  ingresos: number;
  margen: number;
  ventasCount: number;
  participacion: number;
}

/**
 * Categoría top del canal
 */
export interface CategoriaTopCanal {
  categoria: string;
  unidades: number;
  ingresos: number;
  margen: number;
  productosUnicos: number;
  participacion: number;
}

/**
 * Patrón estacional
 */
export interface PatronEstacional {
  patron: string;
  descripcion: string;
  mesesAfectados: number[];
  impacto: 'positivo' | 'negativo' | 'neutro';
  variacionPromedio: number;
}

/**
 * Funnel de conversión
 */
export interface FunnelConversion {
  cotizaciones: number;
  enNegociacion: number;
  aprobadas: number;
  convertidas: number;
  tasaCotizacionNegociacion: number;
  tasaNegociacionAprobacion: number;
  tasaAprobacionConversion: number;
  tasaGlobal: number;
}

/**
 * Alerta del canal
 */
export interface AlertaCanal {
  id: string;
  tipo: 'ventas' | 'conversion' | 'clientes' | 'roi' | 'margen' | 'tendencia';
  severidad: 'info' | 'warning' | 'danger';
  mensaje: string;
  detalle?: string;
  metricaActual?: number;
  metricaAnterior?: number;
  variacion?: number;
  accionRecomendada?: string;
  fechaGeneracion: Date;
}

/**
 * Predicciones del canal
 */
export interface PrediccionesCanal {
  ventasEstimadas30Dias: number;
  ingresosEstimados30Dias: number;
  clientesEstimados30Dias: number;
  tendenciaProxMes: 'positiva' | 'negativa' | 'estable';
  riesgoDeclinacion: number;
  oportunidadCrecimiento: number;
  factoresRiesgo: string[];
  factoresOportunidad: string[];
}

// ============================================
// ANALYTICS COMPLETO
// ============================================

export interface CanalVentaAnalytics {
  canal: CanalVenta;

  // Ventas
  metricasVenta: MetricasVenta;
  ventasHistorial: VentaCanal[];
  tendenciaVentas: 'creciendo' | 'decreciendo' | 'estable';
  tasaCrecimiento: number;

  // Conversión
  metricasConversion: MetricasConversion;
  cotizacionesHistorial: CotizacionCanal[];
  funnelConversion: FunnelConversion;

  // Clientes
  metricasCliente: MetricasCliente;
  clientesTop: Array<{
    id: string;
    nombre: string;
    compras: number;
    monto: number;
    ultimaCompra: Date;
    esVIP: boolean;
  }>;

  // Productos
  productosTop: ProductoTopCanal[];
  categoriasTop: CategoriaTopCanal[];
  marcasTop: Array<{
    marca: string;
    ingresos: number;
    unidades: number;
    participacion: number;
  }>;

  // ROI
  metricasROI: MetricasROI;

  // Historial
  historialMensual: HistorialPeriodo[];
  mejorMes: HistorialPeriodo | null;
  peorMes: HistorialPeriodo | null;

  // Estacionalidad
  patronesEstacionales: PatronEstacional[];

  // Comparativa
  comparativaCanales: ComparativaCanales[];
  rankingGeneral: number;
  totalCanales: number;
  participacionMercado: number;

  // Alertas
  alertas: AlertaCanal[];
  alertasCriticas: number;

  // Predicciones
  predicciones: PrediccionesCanal;

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

class CanalVentaAnalyticsService {
  /**
   * Obtiene analytics completos de un canal de venta
   */
  async getCanalVentaAnalytics(canalId: string): Promise<CanalVentaAnalytics | null> {
    try {
      // Obtener canal
      const canalDoc = await getDocs(
        query(collection(db, 'canalesVenta'), where('__name__', '==', canalId))
      );

      if (canalDoc.empty) {
        console.error('Canal de venta no encontrado:', canalId);
        return null;
      }

      const canal = {
        id: canalDoc.docs[0].id,
        ...canalDoc.docs[0].data()
      } as CanalVenta;

      const ahora = new Date();
      const hace365Dias = new Date(ahora.getTime() - 365 * 24 * 60 * 60 * 1000);

      // Obtener datos relacionados
      const [
        ventasData,
        cotizacionesData,
        todosCanalesData
      ] = await Promise.all([
        this.getVentasCanal(canalId, canal.codigo),
        this.getCotizacionesCanal(canalId, canal.codigo),
        this.getTodosCanales()
      ]);

      // Construir historiales
      const ventasHistorial = this.construirVentasHistorial(ventasData);
      const cotizacionesHistorial = this.construirCotizacionesHistorial(cotizacionesData);

      // Métricas de ventas
      const metricasVenta = this.calcularMetricasVenta(ventasHistorial);
      const tendenciaVentas = this.calcularTendenciaVentas(ventasHistorial);
      const tasaCrecimiento = this.calcularTasaCrecimiento(ventasHistorial);

      // Métricas de conversión
      const metricasConversion = this.calcularMetricasConversion(cotizacionesHistorial);
      const funnelConversion = this.construirFunnelConversion(cotizacionesHistorial);

      // Métricas de clientes
      const metricasCliente = this.calcularMetricasCliente(ventasHistorial);
      const clientesTop = this.identificarClientesTop(ventasHistorial);

      // Productos y categorías
      const productosTop = this.identificarProductosTop(ventasData);
      const categoriasTop = this.identificarCategoriasTop(ventasData);
      const marcasTop = this.identificarMarcasTop(ventasData);

      // ROI
      const metricasROI = this.calcularMetricasROI(metricasVenta, canal);

      // Historial mensual
      const historialMensual = this.construirHistorialMensual(ventasHistorial, cotizacionesHistorial);
      const mejorMes = historialMensual.length > 0
        ? historialMensual.reduce((max, h) => h.ingresos > max.ingresos ? h : max)
        : null;
      const peorMes = historialMensual.length > 0
        ? historialMensual.reduce((min, h) => h.ingresos < min.ingresos ? h : min)
        : null;

      // Patrones estacionales
      const patronesEstacionales = this.detectarPatronesEstacionales(historialMensual);

      // Comparativa con otros canales
      const comparativaCanales = await this.calcularComparativa(canal, todosCanalesData);
      const rankingGeneral = comparativaCanales.find(c => c.canalId === canalId)?.ranking || 0;
      const totalIngresos = comparativaCanales.reduce((sum, c) => sum + c.ingresos, 0);
      const participacionMercado = totalIngresos > 0
        ? (metricasVenta.ingresosTotales / totalIngresos) * 100
        : 0;

      // Alertas
      const alertas = this.generarAlertas(canal, metricasVenta, metricasConversion, metricasROI, tendenciaVentas);

      // Predicciones
      const predicciones = this.calcularPredicciones(ventasHistorial, metricasVenta, tendenciaVentas);

      return {
        canal,

        metricasVenta,
        ventasHistorial,
        tendenciaVentas,
        tasaCrecimiento,

        metricasConversion,
        cotizacionesHistorial,
        funnelConversion,

        metricasCliente,
        clientesTop,

        productosTop,
        categoriasTop,
        marcasTop,

        metricasROI,

        historialMensual,
        mejorMes,
        peorMes,

        patronesEstacionales,

        comparativaCanales,
        rankingGeneral,
        totalCanales: todosCanalesData.length,
        participacionMercado,

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
      console.error('Error obteniendo analytics de canal de venta:', error);
      throw error;
    }
  }

  /**
   * Obtiene ventas del canal
   */
  private async getVentasCanal(canalId: string, canalCodigo: string): Promise<Venta[]> {
    try {
      // Intentar buscar por canalVentaId o canal
      const [porId, porCodigo] = await Promise.all([
        getDocs(query(collection(db, 'ventas'), where('canalVentaId', '==', canalId))),
        getDocs(query(collection(db, 'ventas'), where('canal', '==', canalCodigo)))
      ]);

      const ventasMap = new Map<string, Venta>();

      porId.docs.forEach(doc => {
        ventasMap.set(doc.id, { id: doc.id, ...doc.data() } as Venta);
      });

      porCodigo.docs.forEach(doc => {
        if (!ventasMap.has(doc.id)) {
          ventasMap.set(doc.id, { id: doc.id, ...doc.data() } as Venta);
        }
      });

      return Array.from(ventasMap.values());
    } catch {
      return [];
    }
  }

  /**
   * Obtiene cotizaciones del canal
   */
  private async getCotizacionesCanal(canalId: string, canalCodigo: string): Promise<Cotizacion[]> {
    try {
      const [porId, porCodigo] = await Promise.all([
        getDocs(query(collection(db, 'cotizaciones'), where('canalVentaId', '==', canalId))),
        getDocs(query(collection(db, 'cotizaciones'), where('canal', '==', canalCodigo)))
      ]);

      const cotizacionesMap = new Map<string, Cotizacion>();

      porId.docs.forEach(doc => {
        cotizacionesMap.set(doc.id, { id: doc.id, ...doc.data() } as Cotizacion);
      });

      porCodigo.docs.forEach(doc => {
        if (!cotizacionesMap.has(doc.id)) {
          cotizacionesMap.set(doc.id, { id: doc.id, ...doc.data() } as Cotizacion);
        }
      });

      return Array.from(cotizacionesMap.values());
    } catch {
      return [];
    }
  }

  /**
   * Obtiene todos los canales
   */
  private async getTodosCanales(): Promise<CanalVenta[]> {
    const snapshot = await getDocs(collection(db, 'canalesVenta'));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CanalVenta[];
  }

  /**
   * Construye historial de ventas
   */
  private construirVentasHistorial(ventas: Venta[]): VentaCanal[] {
    return ventas.map(v => {
      const fecha = v.fecha instanceof Timestamp ? v.fecha.toDate() : new Date(v.fecha || Date.now());

      return {
        ventaId: v.id,
        numeroVenta: v.numeroVenta || v.id,
        fecha,
        clienteId: v.clienteId || '',
        clienteNombre: v.clienteNombre || 'Cliente',
        productos: v.productos?.length || 0,
        unidades: v.productos?.reduce((sum, p) => sum + (p.cantidad || 0), 0) || 0,
        subtotalPEN: v.subtotal || 0,
        descuento: v.descuento || 0,
        totalPEN: v.total || 0,
        margen: v.margen || 0,
        margenPorcentaje: v.total > 0 ? ((v.margen || 0) / v.total) * 100 : 0,
        estado: v.estado || 'completada',
        esClienteNuevo: false // Se calcularía con datos históricos
      };
    }).sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }

  /**
   * Construye historial de cotizaciones
   */
  private construirCotizacionesHistorial(cotizaciones: Cotizacion[]): CotizacionCanal[] {
    return cotizaciones.map(c => {
      const fecha = c.fecha instanceof Timestamp ? c.fecha.toDate() : new Date(c.fecha || Date.now());

      let estado: CotizacionCanal['estado'] = 'pendiente';
      if (c.convertidaVenta || c.ventaId) estado = 'convertida';
      else if (c.estado === 'aprobada') estado = 'aprobada';
      else if (c.estado === 'rechazada') estado = 'rechazada';
      else if (c.estado === 'vencida') estado = 'vencida';

      return {
        cotizacionId: c.id,
        numero: c.numero || c.id,
        fecha,
        clienteId: c.clienteId || '',
        clienteNombre: c.clienteNombre || 'Cliente',
        montoPEN: c.total || 0,
        estado,
        convertidaVenta: estado === 'convertida',
        ventaId: c.ventaId,
        motivoRechazo: c.motivoRechazo
      };
    }).sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }

  /**
   * Calcula métricas de ventas
   */
  private calcularMetricasVenta(ventas: VentaCanal[]): MetricasVenta {
    const ahora = new Date();
    const hace7Dias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hace90Dias = new Date(ahora.getTime() - 90 * 24 * 60 * 60 * 1000);

    const ventas7 = ventas.filter(v => v.fecha >= hace7Dias);
    const ventas30 = ventas.filter(v => v.fecha >= hace30Dias);
    const ventas90 = ventas.filter(v => v.fecha >= hace90Dias);

    const totales = ventas.map(v => v.totalPEN).sort((a, b) => a - b);
    const ticketMediano = totales.length > 0
      ? totales[Math.floor(totales.length / 2)]
      : 0;

    const productosSet = new Set<string>();
    ventas.forEach(v => {
      // Asumimos que cada venta tiene productos únicos
    });

    return {
      ventasTotales: ventas.length,
      ventasUltimos7Dias: ventas7.length,
      ventasUltimos30Dias: ventas30.length,
      ventasUltimos90Dias: ventas90.length,

      ingresosTotales: ventas.reduce((sum, v) => sum + v.totalPEN, 0),
      ingresosUltimos7Dias: ventas7.reduce((sum, v) => sum + v.totalPEN, 0),
      ingresosUltimos30Dias: ventas30.reduce((sum, v) => sum + v.totalPEN, 0),
      ingresosUltimos90Dias: ventas90.reduce((sum, v) => sum + v.totalPEN, 0),

      ticketPromedio: ventas.length > 0
        ? ventas.reduce((sum, v) => sum + v.totalPEN, 0) / ventas.length
        : 0,
      ticketMaximo: ventas.length > 0 ? Math.max(...ventas.map(v => v.totalPEN)) : 0,
      ticketMinimo: ventas.length > 0 ? Math.min(...ventas.map(v => v.totalPEN)) : 0,
      ticketMediano,

      unidadesVendidas: ventas.reduce((sum, v) => sum + v.unidades, 0),
      productosUnicos: ventas.reduce((sum, v) => sum + v.productos, 0),

      margenPromedio: ventas.length > 0
        ? ventas.reduce((sum, v) => sum + v.margen, 0) / ventas.length
        : 0,
      margenTotal: ventas.reduce((sum, v) => sum + v.margen, 0),
      margenPorcentajePromedio: ventas.length > 0
        ? ventas.reduce((sum, v) => sum + v.margenPorcentaje, 0) / ventas.length
        : 0,

      descuentoPromedio: ventas.length > 0
        ? ventas.reduce((sum, v) => sum + v.descuento, 0) / ventas.length
        : 0,
      descuentoTotal: ventas.reduce((sum, v) => sum + v.descuento, 0)
    };
  }

  /**
   * Calcula tendencia de ventas
   */
  private calcularTendenciaVentas(ventas: VentaCanal[]): 'creciendo' | 'decreciendo' | 'estable' {
    const ahora = new Date();
    const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hace60Dias = new Date(ahora.getTime() - 60 * 24 * 60 * 60 * 1000);

    const ventas30 = ventas.filter(v => v.fecha >= hace30Dias);
    const ventas30a60 = ventas.filter(v => v.fecha >= hace60Dias && v.fecha < hace30Dias);

    const ingresos30 = ventas30.reduce((sum, v) => sum + v.totalPEN, 0);
    const ingresos30a60 = ventas30a60.reduce((sum, v) => sum + v.totalPEN, 0);

    if (ingresos30a60 === 0) return 'estable';

    const variacion = ((ingresos30 - ingresos30a60) / ingresos30a60) * 100;

    if (variacion > 10) return 'creciendo';
    if (variacion < -10) return 'decreciendo';
    return 'estable';
  }

  /**
   * Calcula tasa de crecimiento
   */
  private calcularTasaCrecimiento(ventas: VentaCanal[]): number {
    const ahora = new Date();
    const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hace60Dias = new Date(ahora.getTime() - 60 * 24 * 60 * 60 * 1000);

    const ingresos30 = ventas.filter(v => v.fecha >= hace30Dias)
      .reduce((sum, v) => sum + v.totalPEN, 0);
    const ingresos30a60 = ventas.filter(v => v.fecha >= hace60Dias && v.fecha < hace30Dias)
      .reduce((sum, v) => sum + v.totalPEN, 0);

    if (ingresos30a60 === 0) return 0;
    return ((ingresos30 - ingresos30a60) / ingresos30a60) * 100;
  }

  /**
   * Calcula métricas de conversión
   */
  private calcularMetricasConversion(cotizaciones: CotizacionCanal[]): MetricasConversion {
    const total = cotizaciones.length;
    const convertidas = cotizaciones.filter(c => c.convertidaVenta).length;
    const rechazadas = cotizaciones.filter(c => c.estado === 'rechazada').length;
    const pendientes = cotizaciones.filter(c => c.estado === 'pendiente').length;
    const vencidas = cotizaciones.filter(c => c.estado === 'vencida').length;

    // Tiempo de conversión
    const tiemposConversion = cotizaciones
      .filter(c => c.convertidaVenta && c.diasHastaConversion)
      .map(c => c.diasHastaConversion!);

    // Motivos de rechazo
    const motivosMap = new Map<string, { count: number; valor: number }>();
    cotizaciones.filter(c => c.estado === 'rechazada').forEach(c => {
      const motivo = c.motivoRechazo || 'Sin especificar';
      const existing = motivosMap.get(motivo) || { count: 0, valor: 0 };
      existing.count++;
      existing.valor += c.montoPEN;
      motivosMap.set(motivo, existing);
    });

    const motivosRechazo = Array.from(motivosMap.entries())
      .map(([motivo, data]) => ({
        motivo,
        count: data.count,
        porcentaje: rechazadas > 0 ? (data.count / rechazadas) * 100 : 0,
        valorPerdidoPEN: data.valor
      }))
      .sort((a, b) => b.count - a.count);

    const valorPerdidas = cotizaciones
      .filter(c => c.estado === 'rechazada' || c.estado === 'vencida')
      .reduce((sum, c) => sum + c.montoPEN, 0);

    return {
      cotizacionesTotales: total,
      cotizacionesConvertidas: convertidas,
      cotizacionesRechazadas: rechazadas,
      cotizacionesPendientes: pendientes,
      cotizacionesVencidas: vencidas,

      tasaConversion: total > 0 ? (convertidas / total) * 100 : 0,
      tasaRechazo: total > 0 ? (rechazadas / total) * 100 : 0,
      tasaVencimiento: total > 0 ? (vencidas / total) * 100 : 0,

      tiempoPromedioConversion: tiemposConversion.length > 0
        ? tiemposConversion.reduce((a, b) => a + b, 0) / tiemposConversion.length
        : 0,
      tiempoMinimoConversion: tiemposConversion.length > 0 ? Math.min(...tiemposConversion) : 0,
      tiempoMaximoConversion: tiemposConversion.length > 0 ? Math.max(...tiemposConversion) : 0,

      valorPromedioConvertida: convertidas > 0
        ? cotizaciones.filter(c => c.convertidaVenta).reduce((sum, c) => sum + c.montoPEN, 0) / convertidas
        : 0,
      valorPromedioPerdida: (rechazadas + vencidas) > 0
        ? valorPerdidas / (rechazadas + vencidas)
        : 0,
      valorTotalPerdido: valorPerdidas,

      motivosRechazo
    };
  }

  /**
   * Construye funnel de conversión
   */
  private construirFunnelConversion(cotizaciones: CotizacionCanal[]): FunnelConversion {
    const total = cotizaciones.length;
    const enNegociacion = cotizaciones.filter(c => c.estado === 'pendiente').length;
    const aprobadas = cotizaciones.filter(c => c.estado === 'aprobada' || c.convertidaVenta).length;
    const convertidas = cotizaciones.filter(c => c.convertidaVenta).length;

    return {
      cotizaciones: total,
      enNegociacion,
      aprobadas,
      convertidas,
      tasaCotizacionNegociacion: total > 0 ? (enNegociacion / total) * 100 : 0,
      tasaNegociacionAprobacion: enNegociacion > 0 ? (aprobadas / enNegociacion) * 100 : 0,
      tasaAprobacionConversion: aprobadas > 0 ? (convertidas / aprobadas) * 100 : 0,
      tasaGlobal: total > 0 ? (convertidas / total) * 100 : 0
    };
  }

  /**
   * Calcula métricas de clientes
   */
  private calcularMetricasCliente(ventas: VentaCanal[]): MetricasCliente {
    const clientesMap = new Map<string, { compras: number; monto: number; fechas: Date[] }>();

    ventas.forEach(v => {
      const existing = clientesMap.get(v.clienteId) || { compras: 0, monto: 0, fechas: [] };
      existing.compras++;
      existing.monto += v.totalPEN;
      existing.fechas.push(v.fecha);
      clientesMap.set(v.clienteId, existing);
    });

    const clientesUnicos = clientesMap.size;
    const clientesRecurrentes = Array.from(clientesMap.values()).filter(c => c.compras > 1).length;
    const clientesNuevos = clientesUnicos - clientesRecurrentes;

    // Cliente top
    let clienteTop = { id: '', nombre: '', compras: 0, montoPEN: 0, ultimaCompra: new Date() };
    clientesMap.forEach((data, clienteId) => {
      if (data.monto > clienteTop.montoPEN) {
        const venta = ventas.find(v => v.clienteId === clienteId);
        clienteTop = {
          id: clienteId,
          nombre: venta?.clienteNombre || 'Cliente',
          compras: data.compras,
          montoPEN: data.monto,
          ultimaCompra: data.fechas.sort((a, b) => b.getTime() - a.getTime())[0]
        };
      }
    });

    // Adquisición por mes
    const adquisicionMap = new Map<string, { nuevos: number; recurrentes: number }>();
    // Simplificado - en producción se calcularía con datos históricos

    return {
      clientesUnicos,
      clientesNuevos,
      clientesRecurrentes,
      tasaRecurrencia: clientesUnicos > 0 ? (clientesRecurrentes / clientesUnicos) * 100 : 0,
      tasaRetencion: 70, // Estimado

      clienteTop,

      promedioComprasPorCliente: clientesUnicos > 0 ? ventas.length / clientesUnicos : 0,
      frecuenciaCompra: 30, // Estimado en días

      adquisicionClientes: [],

      segmentacionClientes: {
        vip: Math.round(clientesUnicos * 0.1),
        frecuentes: Math.round(clientesUnicos * 0.2),
        ocasionales: Math.round(clientesUnicos * 0.4),
        nuevos: Math.round(clientesUnicos * 0.3)
      }
    };
  }

  /**
   * Identifica clientes top
   */
  private identificarClientesTop(ventas: VentaCanal[]): CanalVentaAnalytics['clientesTop'] {
    const clientesMap = new Map<string, { nombre: string; compras: number; monto: number; ultimaCompra: Date }>();

    ventas.forEach(v => {
      const existing = clientesMap.get(v.clienteId) || {
        nombre: v.clienteNombre,
        compras: 0,
        monto: 0,
        ultimaCompra: v.fecha
      };
      existing.compras++;
      existing.monto += v.totalPEN;
      if (v.fecha > existing.ultimaCompra) {
        existing.ultimaCompra = v.fecha;
      }
      clientesMap.set(v.clienteId, existing);
    });

    return Array.from(clientesMap.entries())
      .map(([id, data]) => ({
        id,
        nombre: data.nombre,
        compras: data.compras,
        monto: data.monto,
        ultimaCompra: data.ultimaCompra,
        esVIP: data.monto > 5000 || data.compras > 5
      }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 10);
  }

  /**
   * Identifica productos top
   */
  private identificarProductosTop(ventas: Venta[]): ProductoTopCanal[] {
    const productosMap = new Map<string, {
      sku: string;
      nombre: string;
      marca: string;
      unidades: number;
      ingresos: number;
      margen: number;
      ventasCount: number;
    }>();

    ventas.forEach(v => {
      v.productos?.forEach(p => {
        const existing = productosMap.get(p.productoId) || {
          sku: p.sku || '',
          nombre: p.nombre || p.sku || '',
          marca: p.marca || '',
          unidades: 0,
          ingresos: 0,
          margen: 0,
          ventasCount: 0
        };
        existing.unidades += p.cantidad || 0;
        existing.ingresos += p.subtotal || 0;
        existing.margen += (p.subtotal || 0) * 0.25; // Estimado
        existing.ventasCount++;
        productosMap.set(p.productoId, existing);
      });
    });

    const totalIngresos = Array.from(productosMap.values()).reduce((sum, p) => sum + p.ingresos, 0);

    return Array.from(productosMap.entries())
      .map(([productoId, data]) => ({
        productoId,
        ...data,
        participacion: totalIngresos > 0 ? (data.ingresos / totalIngresos) * 100 : 0
      }))
      .sort((a, b) => b.ingresos - a.ingresos)
      .slice(0, 10);
  }

  /**
   * Identifica categorías top
   */
  private identificarCategoriasTop(ventas: Venta[]): CategoriaTopCanal[] {
    const categoriasMap = new Map<string, {
      unidades: number;
      ingresos: number;
      margen: number;
      productos: Set<string>;
    }>();

    ventas.forEach(v => {
      v.productos?.forEach(p => {
        const categoria = p.grupo || p.marca || 'Sin categoría';
        const existing = categoriasMap.get(categoria) || {
          unidades: 0,
          ingresos: 0,
          margen: 0,
          productos: new Set()
        };
        existing.unidades += p.cantidad || 0;
        existing.ingresos += p.subtotal || 0;
        existing.margen += (p.subtotal || 0) * 0.25;
        existing.productos.add(p.productoId);
        categoriasMap.set(categoria, existing);
      });
    });

    const totalIngresos = Array.from(categoriasMap.values()).reduce((sum, c) => sum + c.ingresos, 0);

    return Array.from(categoriasMap.entries())
      .map(([categoria, data]) => ({
        categoria,
        unidades: data.unidades,
        ingresos: data.ingresos,
        margen: data.margen,
        productosUnicos: data.productos.size,
        participacion: totalIngresos > 0 ? (data.ingresos / totalIngresos) * 100 : 0
      }))
      .sort((a, b) => b.ingresos - a.ingresos)
      .slice(0, 10);
  }

  /**
   * Identifica marcas top
   */
  private identificarMarcasTop(ventas: Venta[]): CanalVentaAnalytics['marcasTop'] {
    const marcasMap = new Map<string, { ingresos: number; unidades: number }>();

    ventas.forEach(v => {
      v.productos?.forEach(p => {
        const marca = p.marca || 'Sin marca';
        const existing = marcasMap.get(marca) || { ingresos: 0, unidades: 0 };
        existing.ingresos += p.subtotal || 0;
        existing.unidades += p.cantidad || 0;
        marcasMap.set(marca, existing);
      });
    });

    const totalIngresos = Array.from(marcasMap.values()).reduce((sum, m) => sum + m.ingresos, 0);

    return Array.from(marcasMap.entries())
      .map(([marca, data]) => ({
        marca,
        ingresos: data.ingresos,
        unidades: data.unidades,
        participacion: totalIngresos > 0 ? (data.ingresos / totalIngresos) * 100 : 0
      }))
      .sort((a, b) => b.ingresos - a.ingresos)
      .slice(0, 10);
  }

  /**
   * Calcula métricas de ROI
   */
  private calcularMetricasROI(metricas: MetricasVenta, canal: CanalVenta): MetricasROI {
    const ingresos = metricas.ingresosTotales;
    const tasaComision = canal.comision || 0;
    const comisiones = ingresos * (tasaComision / 100);
    const costoCanal = canal.costoFijo || 0;

    const margenBruto = metricas.margenTotal;
    const margenNeto = margenBruto - comisiones - costoCanal;

    return {
      ingresosTotales: ingresos,
      costoCanal,
      comisionesPagadas: comisiones,
      tasaComision,
      margenBruto,
      margenNeto,
      roiPorcentaje: (costoCanal + comisiones) > 0
        ? ((margenNeto / (costoCanal + comisiones)) * 100)
        : 0,
      rentabilidadNeta: margenNeto,
      costoAdquisicionCliente: 0, // Se calcularía con datos de marketing
      valorVidaCliente: 0, // Se calcularía con historial
      ingresoPorCliente: metricas.ventasTotales > 0
        ? ingresos / metricas.ventasTotales
        : 0
    };
  }

  /**
   * Construye historial mensual
   */
  private construirHistorialMensual(
    ventas: VentaCanal[],
    cotizaciones: CotizacionCanal[]
  ): HistorialPeriodo[] {
    const mesesMap = new Map<string, {
      ventas: VentaCanal[];
      cotizaciones: CotizacionCanal[];
    }>();

    // Agrupar ventas por mes
    ventas.forEach(v => {
      const key = `${v.fecha.getFullYear()}-${String(v.fecha.getMonth() + 1).padStart(2, '0')}`;
      const existing = mesesMap.get(key) || { ventas: [], cotizaciones: [] };
      existing.ventas.push(v);
      mesesMap.set(key, existing);
    });

    // Agrupar cotizaciones por mes
    cotizaciones.forEach(c => {
      const key = `${c.fecha.getFullYear()}-${String(c.fecha.getMonth() + 1).padStart(2, '0')}`;
      const existing = mesesMap.get(key) || { ventas: [], cotizaciones: [] };
      existing.cotizaciones.push(c);
      mesesMap.set(key, existing);
    });

    const historial: HistorialPeriodo[] = [];
    let mesAnterior: HistorialPeriodo | null = null;

    Array.from(mesesMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([periodo, data]) => {
        const [anio, mes] = periodo.split('-').map(Number);
        const ingresos = data.ventas.reduce((sum, v) => sum + v.totalPEN, 0);
        const margen = data.ventas.reduce((sum, v) => sum + v.margen, 0);
        const clientesSet = new Set(data.ventas.map(v => v.clienteId));
        const cotizacionesConvertidas = data.cotizaciones.filter(c => c.convertidaVenta).length;

        const periodoData: HistorialPeriodo = {
          periodo,
          mes,
          anio,
          ventas: data.ventas.length,
          ingresos,
          margen,
          margenPorcentaje: ingresos > 0 ? (margen / ingresos) * 100 : 0,
          clientes: clientesSet.size,
          clientesNuevos: 0, // Se calcularía comparando con meses anteriores
          ticketPromedio: data.ventas.length > 0 ? ingresos / data.ventas.length : 0,
          tasaConversion: data.cotizaciones.length > 0
            ? (cotizacionesConvertidas / data.cotizaciones.length) * 100
            : 0,
          crecimientoVentas: mesAnterior
            ? ((data.ventas.length - mesAnterior.ventas) / (mesAnterior.ventas || 1)) * 100
            : 0,
          crecimientoIngresos: mesAnterior
            ? ((ingresos - mesAnterior.ingresos) / (mesAnterior.ingresos || 1)) * 100
            : 0
        };

        historial.push(periodoData);
        mesAnterior = periodoData;
      });

    return historial;
  }

  /**
   * Detecta patrones estacionales
   */
  private detectarPatronesEstacionales(historial: HistorialPeriodo[]): PatronEstacional[] {
    const patrones: PatronEstacional[] = [];

    if (historial.length < 6) return patrones;

    // Analizar tendencias por mes
    const promedioGeneral = historial.reduce((sum, h) => sum + h.ingresos, 0) / historial.length;

    // Detectar meses altos y bajos
    const mesesAltos = historial.filter(h => h.ingresos > promedioGeneral * 1.2);
    const mesesBajos = historial.filter(h => h.ingresos < promedioGeneral * 0.8);

    if (mesesAltos.length > 0) {
      patrones.push({
        patron: 'Temporada alta',
        descripcion: `Ventas por encima del promedio en ${mesesAltos.length} meses`,
        mesesAfectados: mesesAltos.map(m => m.mes),
        impacto: 'positivo',
        variacionPromedio: 20
      });
    }

    if (mesesBajos.length > 0) {
      patrones.push({
        patron: 'Temporada baja',
        descripcion: `Ventas por debajo del promedio en ${mesesBajos.length} meses`,
        mesesAfectados: mesesBajos.map(m => m.mes),
        impacto: 'negativo',
        variacionPromedio: -20
      });
    }

    return patrones;
  }

  /**
   * Calcula comparativa con otros canales
   */
  private async calcularComparativa(
    canalActual: CanalVenta,
    todosCanales: CanalVenta[]
  ): Promise<ComparativaCanales[]> {
    const comparativas: ComparativaCanales[] = [];

    for (const canal of todosCanales.filter(c => c.estado === 'activo')) {
      const ventas = await this.getVentasCanal(canal.id, canal.codigo);
      const ventasHistorial = this.construirVentasHistorial(ventas);
      const metricas = this.calcularMetricasVenta(ventasHistorial);

      comparativas.push({
        canalId: canal.id,
        codigo: canal.codigo,
        nombre: canal.nombre,
        icono: canal.icono,
        ventas: metricas.ventasTotales,
        ingresos: metricas.ingresosTotales,
        margen: metricas.margenTotal,
        margenPorcentaje: metricas.margenPorcentajePromedio,
        ticketPromedio: metricas.ticketPromedio,
        tasaConversion: 0, // Se calcularía con cotizaciones
        clientes: new Set(ventasHistorial.map(v => v.clienteId)).size,
        clientesNuevos: 0,
        participacion: 0,
        ranking: 0,
        tendencia: this.calcularTendenciaVentas(ventasHistorial),
        esDestacado: metricas.ingresosTotales > 10000
      });
    }

    // Calcular participación
    const totalIngresos = comparativas.reduce((sum, c) => sum + c.ingresos, 0);
    comparativas.forEach(c => {
      c.participacion = totalIngresos > 0 ? (c.ingresos / totalIngresos) * 100 : 0;
    });

    // Ordenar y asignar ranking
    comparativas.sort((a, b) => b.ingresos - a.ingresos);
    comparativas.forEach((c, idx) => {
      c.ranking = idx + 1;
    });

    return comparativas;
  }

  /**
   * Genera alertas
   */
  private generarAlertas(
    canal: CanalVenta,
    metricas: MetricasVenta,
    conversion: MetricasConversion,
    roi: MetricasROI,
    tendencia: 'creciendo' | 'decreciendo' | 'estable'
  ): AlertaCanal[] {
    const alertas: AlertaCanal[] = [];
    const ahora = new Date();
    let idCounter = 1;

    // Alerta de tendencia negativa
    if (tendencia === 'decreciendo') {
      alertas.push({
        id: `alert-${idCounter++}`,
        tipo: 'tendencia',
        severidad: 'warning',
        mensaje: 'Tendencia de ventas a la baja',
        detalle: 'Las ventas del último mes son menores al mes anterior',
        accionRecomendada: 'Revisar estrategia de marketing y promociones',
        fechaGeneracion: ahora
      });
    }

    // Alerta de baja conversión
    if (conversion.tasaConversion < 30 && conversion.cotizacionesTotales > 5) {
      alertas.push({
        id: `alert-${idCounter++}`,
        tipo: 'conversion',
        severidad: conversion.tasaConversion < 20 ? 'danger' : 'warning',
        mensaje: `Tasa de conversión baja: ${conversion.tasaConversion.toFixed(1)}%`,
        metricaActual: conversion.tasaConversion,
        accionRecomendada: 'Revisar proceso de seguimiento de cotizaciones',
        fechaGeneracion: ahora
      });
    }

    // Alerta de margen bajo
    if (metricas.margenPorcentajePromedio < 20 && metricas.ventasTotales > 0) {
      alertas.push({
        id: `alert-${idCounter++}`,
        tipo: 'margen',
        severidad: metricas.margenPorcentajePromedio < 15 ? 'danger' : 'warning',
        mensaje: `Margen promedio bajo: ${metricas.margenPorcentajePromedio.toFixed(1)}%`,
        metricaActual: metricas.margenPorcentajePromedio,
        accionRecomendada: 'Revisar política de precios y descuentos',
        fechaGeneracion: ahora
      });
    }

    // Alerta de ROI negativo
    if (roi.roiPorcentaje < 0) {
      alertas.push({
        id: `alert-${idCounter++}`,
        tipo: 'roi',
        severidad: 'danger',
        mensaje: 'ROI negativo en el canal',
        detalle: `ROI: ${roi.roiPorcentaje.toFixed(1)}%`,
        accionRecomendada: 'Evaluar costos y comisiones del canal',
        fechaGeneracion: ahora
      });
    }

    // Alerta de pocos clientes
    if (metricas.ventasUltimos30Dias === 0) {
      alertas.push({
        id: `alert-${idCounter++}`,
        tipo: 'ventas',
        severidad: 'warning',
        mensaje: 'Sin ventas en los últimos 30 días',
        accionRecomendada: 'Reactivar canal con promociones',
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
    ventas: VentaCanal[],
    metricas: MetricasVenta,
    tendencia: 'creciendo' | 'decreciendo' | 'estable'
  ): PrediccionesCanal {
    const ventasEstimadas = Math.round(metricas.ventasUltimos30Dias * (
      tendencia === 'creciendo' ? 1.1 :
      tendencia === 'decreciendo' ? 0.9 : 1
    ));

    const ingresosEstimados = Math.round(metricas.ingresosUltimos30Dias * (
      tendencia === 'creciendo' ? 1.1 :
      tendencia === 'decreciendo' ? 0.9 : 1
    ));

    const clientesSet = new Set(ventas.filter(v => {
      const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return v.fecha >= hace30Dias;
    }).map(v => v.clienteId));

    return {
      ventasEstimadas30Dias: ventasEstimadas,
      ingresosEstimados30Dias: ingresosEstimados,
      clientesEstimados30Dias: Math.round(clientesSet.size * 1.05),
      tendenciaProxMes: tendencia === 'creciendo' ? 'positiva' :
                        tendencia === 'decreciendo' ? 'negativa' : 'estable',
      riesgoDeclinacion: tendencia === 'decreciendo' ? 40 :
                         tendencia === 'estable' ? 20 : 10,
      oportunidadCrecimiento: tendencia === 'creciendo' ? 60 :
                              tendencia === 'estable' ? 40 : 20,
      factoresRiesgo: tendencia === 'decreciendo'
        ? ['Tendencia negativa', 'Competencia activa']
        : [],
      factoresOportunidad: tendencia === 'creciendo'
        ? ['Momentum positivo', 'Base de clientes creciendo']
        : ['Potencial de reactivación']
    };
  }

  /**
   * Compara múltiples canales
   */
  async compararCanales(canalIds?: string[]): Promise<ComparativaCanales[]> {
    const todosCanales = await this.getTodosCanales();

    const canalesFiltrados = canalIds
      ? todosCanales.filter(c => canalIds.includes(c.id))
      : todosCanales.filter(c => c.estado === 'activo');

    const comparativas: ComparativaCanales[] = [];

    for (const canal of canalesFiltrados) {
      const ventas = await this.getVentasCanal(canal.id, canal.codigo);
      const ventasHistorial = this.construirVentasHistorial(ventas);
      const metricas = this.calcularMetricasVenta(ventasHistorial);

      comparativas.push({
        canalId: canal.id,
        codigo: canal.codigo,
        nombre: canal.nombre,
        icono: canal.icono,
        ventas: metricas.ventasTotales,
        ingresos: metricas.ingresosTotales,
        margen: metricas.margenTotal,
        margenPorcentaje: metricas.margenPorcentajePromedio,
        ticketPromedio: metricas.ticketPromedio,
        tasaConversion: 0,
        clientes: new Set(ventasHistorial.map(v => v.clienteId)).size,
        clientesNuevos: 0,
        participacion: 0,
        ranking: 0,
        tendencia: this.calcularTendenciaVentas(ventasHistorial),
        esDestacado: metricas.ingresosTotales > 10000
      });
    }

    const totalIngresos = comparativas.reduce((sum, c) => sum + c.ingresos, 0);
    comparativas.forEach(c => {
      c.participacion = totalIngresos > 0 ? (c.ingresos / totalIngresos) * 100 : 0;
    });

    comparativas.sort((a, b) => b.ingresos - a.ingresos);
    comparativas.forEach((c, idx) => {
      c.ranking = idx + 1;
    });

    return comparativas;
  }
}

export const canalVentaAnalyticsService = new CanalVentaAnalyticsService();
