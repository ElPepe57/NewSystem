/**
 * Servicio de Analytics Avanzado para Clientes
 * Proporciona métricas detalladas, historial de compras, patrones y predicciones
 */
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Cliente, ClasificacionABC, SegmentoCliente } from '../types/entidadesMaestras.types';
import type { Venta, ProductoVenta } from '../types/venta.types';

// ============================================
// TIPOS PARA ANALYTICS DE CLIENTES
// ============================================

/**
 * Compra individual en el historial
 */
export interface CompraHistorial {
  ventaId: string;
  numeroVenta: string;
  fecha: Date;
  productos: Array<{
    productoId: string;
    sku: string;
    nombre: string;
    marca: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
  totalPEN: number;
  estado: string;
  canal: string;
  diasDesdeCompraAnterior?: number;
}

/**
 * Producto favorito del cliente
 */
export interface ProductoFavorito {
  productoId: string;
  sku: string;
  nombre: string;
  marca: string;
  vecesComprado: number;
  unidadesTotales: number;
  gastoTotal: number;
  ultimaCompra: Date;
  frecuenciaPromedioDias: number;
  proximaCompraEstimada?: Date;
}

/**
 * Marca preferida del cliente
 */
export interface MarcaPreferida {
  marca: string;
  productosComprados: number;
  unidadesTotales: number;
  gastoTotal: number;
  porcentajeGasto: number;
}

/**
 * Patrón de compra detectado
 */
export interface PatronCompra {
  tipo: 'frecuencia' | 'monto' | 'producto' | 'estacionalidad';
  descripcion: string;
  confianza: number; // 0-100
  datos: Record<string, any>;
}

/**
 * Predicción de comportamiento
 */
export interface PrediccionCliente {
  probabilidadRecompra30Dias: number;
  probabilidadChurn: number;
  valorVidaEstimado: number;
  proximaCompraEstimada?: Date;
  productosProbables: string[];
}

/**
 * Métricas por período
 */
export interface MetricasPeriodo {
  periodo: string;
  mes: number;
  anio: number;
  compras: number;
  gastoPEN: number;
  productosComprados: number;
  ticketPromedio: number;
}

/**
 * Comparación con otros clientes
 */
export interface ComparacionCliente {
  metrica: string;
  valorCliente: number;
  promedioGeneral: number;
  percentil: number;
  comparacion: 'superior' | 'promedio' | 'inferior';
}

/**
 * Analytics completo de un cliente
 */
export interface ClienteAnalytics {
  cliente: Cliente;

  // Historial de compras
  historialCompras: CompraHistorial[];
  totalCompras: number;
  primeraCompra?: Date;
  ultimaCompra?: Date;
  diasComoCliente: number;

  // Métricas financieras
  gastoTotalHistorico: number;
  gastoUltimos30Dias: number;
  gastoUltimos90Dias: number;
  gastoUltimos365Dias: number;
  ticketPromedio: number;
  ticketMaximo: number;
  ticketMinimo: number;

  // Frecuencia
  frecuenciaCompraDias: number;
  comprasPorMes: number;
  diasDesdeUltimaCompra: number;
  tendenciaFrecuencia: 'aumentando' | 'estable' | 'disminuyendo';

  // Productos y preferencias
  productosFavoritos: ProductoFavorito[];
  marcasPreferidas: MarcaPreferida[];
  categoriasPreferidas: Array<{ categoria: string; gasto: number; porcentaje: number }>;
  totalProductosUnicos: number;
  totalUnidadesCompradas: number;

  // Patrones detectados
  patronesCompra: PatronCompra[];
  diaSemanaPreferido?: string;
  horarioPreferido?: string;

  // Predicciones
  predicciones: PrediccionCliente;

  // Historial por período
  metricasPorMes: MetricasPeriodo[];
  tendenciaGasto: 'creciendo' | 'estable' | 'decreciendo';
  tasaCrecimiento: number;

  // Comparación con otros
  comparaciones: ComparacionCliente[];
  rankingGeneral: number;
  totalClientes: number;

  // Alertas y oportunidades
  alertasRecompra: Array<{
    productoId: string;
    nombre: string;
    diasDesdeCompra: number;
    cicloEstimado: number;
    urgencia: 'alta' | 'media' | 'baja';
  }>;
  oportunidadesCrossSell: Array<{
    productoId: string;
    nombre: string;
    razon: string;
    probabilidad: number;
  }>;
}

/**
 * Servicio de Analytics para Clientes
 */
export const clienteAnalyticsService = {
  /**
   * Obtiene analytics completo de un cliente
   */
  async getClienteAnalytics(clienteId: string): Promise<ClienteAnalytics | null> {
    try {
      // 1. Obtener el cliente
      const clienteDoc = await getDocs(
        query(collection(db, 'clientes'), where('__name__', '==', clienteId))
      );

      if (clienteDoc.empty) return null;

      const cliente = { id: clienteDoc.docs[0].id, ...clienteDoc.docs[0].data() } as Cliente;

      // 2. Obtener todas las ventas del cliente
      const ventasSnapshot = await getDocs(collection(db, 'ventas'));
      const ventasCliente = ventasSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Venta))
        .filter(v => v.clienteId === clienteId && v.estado !== 'cancelada')
        .sort((a, b) => {
          const fechaA = a.fechaCreacion?.toDate?.() || new Date(0);
          const fechaB = b.fechaCreacion?.toDate?.() || new Date(0);
          return fechaB.getTime() - fechaA.getTime();
        });

      // 3. Obtener productos para enriquecer datos
      const productosSnapshot = await getDocs(collection(db, 'productos'));
      const productosMap = new Map<string, { nombre: string; marca: string; grupo: string; cicloRecompraDias?: number }>();
      productosSnapshot.docs.forEach(doc => {
        const data = doc.data();
        productosMap.set(doc.id, {
          nombre: `${data.nombreComercial} ${data.dosaje || ''} ${data.contenido || ''}`.trim(),
          marca: data.marca || '',
          grupo: data.grupo || '',
          cicloRecompraDias: data.cicloRecompraDias
        });
      });

      // 4. Construir historial de compras
      const historialCompras = this.construirHistorial(ventasCliente, productosMap);

      // 5. Calcular métricas
      const ahora = new Date();
      const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
      const hace90Dias = new Date(ahora.getTime() - 90 * 24 * 60 * 60 * 1000);
      const hace365Dias = new Date(ahora.getTime() - 365 * 24 * 60 * 60 * 1000);

      const primeraCompra = historialCompras.length > 0
        ? historialCompras[historialCompras.length - 1].fecha
        : undefined;
      const ultimaCompra = historialCompras.length > 0
        ? historialCompras[0].fecha
        : undefined;

      const diasComoCliente = primeraCompra
        ? Math.floor((ahora.getTime() - primeraCompra.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const diasDesdeUltimaCompra = ultimaCompra
        ? Math.floor((ahora.getTime() - ultimaCompra.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // Gastos por período
      const gastoTotalHistorico = historialCompras.reduce((sum, c) => sum + c.totalPEN, 0);
      const gastoUltimos30Dias = historialCompras.filter(c => c.fecha >= hace30Dias).reduce((sum, c) => sum + c.totalPEN, 0);
      const gastoUltimos90Dias = historialCompras.filter(c => c.fecha >= hace90Dias).reduce((sum, c) => sum + c.totalPEN, 0);
      const gastoUltimos365Dias = historialCompras.filter(c => c.fecha >= hace365Dias).reduce((sum, c) => sum + c.totalPEN, 0);

      // Tickets
      const tickets = historialCompras.map(c => c.totalPEN);
      const ticketPromedio = tickets.length > 0 ? gastoTotalHistorico / tickets.length : 0;
      const ticketMaximo = tickets.length > 0 ? Math.max(...tickets) : 0;
      const ticketMinimo = tickets.length > 0 ? Math.min(...tickets) : 0;

      // Frecuencia
      const frecuenciaCompraDias = this.calcularFrecuenciaPromedio(historialCompras);
      const comprasPorMes = diasComoCliente > 0 ? (historialCompras.length / diasComoCliente) * 30 : 0;

      // Tendencia de frecuencia
      const tendenciaFrecuencia = this.calcularTendenciaFrecuencia(historialCompras);

      // Productos y preferencias
      const productosFavoritos = this.calcularProductosFavoritos(historialCompras, productosMap);
      const marcasPreferidas = this.calcularMarcasPreferidas(historialCompras, gastoTotalHistorico);
      const categoriasPreferidas = this.calcularCategoriasPreferidas(historialCompras, productosMap, gastoTotalHistorico);

      const totalProductosUnicos = new Set(
        historialCompras.flatMap(c => c.productos.map(p => p.productoId))
      ).size;
      const totalUnidadesCompradas = historialCompras.reduce(
        (sum, c) => sum + c.productos.reduce((s, p) => s + p.cantidad, 0), 0
      );

      // Patrones
      const patronesCompra = this.detectarPatrones(historialCompras, frecuenciaCompraDias);

      // Métricas por mes
      const metricasPorMes = this.calcularMetricasPorMes(historialCompras);

      // Tendencia de gasto
      const { tendencia: tendenciaGasto, tasa: tasaCrecimiento } = this.calcularTendenciaGasto(metricasPorMes);

      // Predicciones
      const predicciones = this.calcularPredicciones(
        historialCompras,
        diasDesdeUltimaCompra,
        frecuenciaCompraDias,
        ticketPromedio,
        productosFavoritos
      );

      // Comparaciones (necesita todos los clientes)
      const todosClientes = await getDocs(collection(db, 'clientes'));
      const { comparaciones, ranking, total } = await this.calcularComparaciones(
        cliente,
        gastoTotalHistorico,
        historialCompras.length,
        ticketPromedio,
        todosClientes.docs.map(d => ({ id: d.id, ...d.data() } as Cliente))
      );

      // Alertas de recompra
      const alertasRecompra = this.calcularAlertasRecompra(productosFavoritos, productosMap);

      // Oportunidades cross-sell
      const oportunidadesCrossSell = await this.calcularOportunidadesCrossSell(
        historialCompras,
        marcasPreferidas,
        productosMap
      );

      return {
        cliente,
        historialCompras,
        totalCompras: historialCompras.length,
        primeraCompra,
        ultimaCompra,
        diasComoCliente,
        gastoTotalHistorico,
        gastoUltimos30Dias,
        gastoUltimos90Dias,
        gastoUltimos365Dias,
        ticketPromedio,
        ticketMaximo,
        ticketMinimo,
        frecuenciaCompraDias,
        comprasPorMes,
        diasDesdeUltimaCompra,
        tendenciaFrecuencia,
        productosFavoritos,
        marcasPreferidas,
        categoriasPreferidas,
        totalProductosUnicos,
        totalUnidadesCompradas,
        patronesCompra,
        predicciones,
        metricasPorMes,
        tendenciaGasto,
        tasaCrecimiento,
        comparaciones,
        rankingGeneral: ranking,
        totalClientes: total,
        alertasRecompra,
        oportunidadesCrossSell
      };
    } catch (error: any) {
      console.error('Error obteniendo analytics de cliente:', error);
      return null;
    }
  },

  /**
   * Construye el historial de compras ordenado
   */
  construirHistorial(
    ventas: Venta[],
    productosMap: Map<string, { nombre: string; marca: string; grupo: string }>
  ): CompraHistorial[] {
    const historial: CompraHistorial[] = [];
    let compraAnterior: Date | null = null;

    // Las ventas ya vienen ordenadas de más reciente a más antigua
    for (let i = ventas.length - 1; i >= 0; i--) {
      const venta = ventas[i];
      const fecha = venta.fechaCreacion?.toDate?.() || new Date(venta.fechaCreacion as unknown as string);

      const productos = (venta.productos || []).map((p: ProductoVenta) => {
        const prodInfo = productosMap.get(p.productoId);
        return {
          productoId: p.productoId,
          sku: p.sku,
          nombre: prodInfo?.nombre || p.nombreComercial,
          marca: prodInfo?.marca || p.marca,
          cantidad: p.cantidad,
          precioUnitario: p.precioUnitario,
          subtotal: p.subtotal || (p.cantidad * p.precioUnitario)
        };
      });

      const diasDesdeAnterior = compraAnterior
        ? Math.floor((fecha.getTime() - compraAnterior.getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

      historial.push({
        ventaId: venta.id,
        numeroVenta: venta.numeroVenta,
        fecha,
        productos,
        totalPEN: venta.totalPEN || productos.reduce((s, p) => s + p.subtotal, 0),
        estado: venta.estado,
        canal: 'directo',
        diasDesdeCompraAnterior: diasDesdeAnterior
      });

      compraAnterior = fecha;
    }

    // Revertir para que quede de más reciente a más antiguo
    return historial.reverse();
  },

  /**
   * Calcula la frecuencia promedio de compra en días
   */
  calcularFrecuenciaPromedio(historial: CompraHistorial[]): number {
    if (historial.length < 2) return 0;

    const intervalos = historial
      .filter(c => c.diasDesdeCompraAnterior !== undefined)
      .map(c => c.diasDesdeCompraAnterior!);

    if (intervalos.length === 0) return 0;

    return Math.round(intervalos.reduce((a, b) => a + b, 0) / intervalos.length);
  },

  /**
   * Calcula la tendencia de frecuencia de compra
   */
  calcularTendenciaFrecuencia(historial: CompraHistorial[]): 'aumentando' | 'estable' | 'disminuyendo' {
    if (historial.length < 4) return 'estable';

    const mitad = Math.floor(historial.length / 2);
    const primerasMitad = historial.slice(mitad);
    const segundaMitad = historial.slice(0, mitad);

    const freqPrimera = this.calcularFrecuenciaPromedio(primerasMitad);
    const freqSegunda = this.calcularFrecuenciaPromedio(segundaMitad);

    if (freqPrimera === 0 || freqSegunda === 0) return 'estable';

    const cambio = ((freqSegunda - freqPrimera) / freqPrimera) * 100;

    if (cambio < -15) return 'aumentando'; // Menos días = más frecuente
    if (cambio > 15) return 'disminuyendo';
    return 'estable';
  },

  /**
   * Calcula productos favoritos del cliente
   */
  calcularProductosFavoritos(
    historial: CompraHistorial[],
    productosMap: Map<string, { nombre: string; marca: string; cicloRecompraDias?: number }>
  ): ProductoFavorito[] {
    const productoStats = new Map<string, {
      sku: string;
      nombre: string;
      marca: string;
      compras: number;
      unidades: number;
      gasto: number;
      fechas: Date[];
    }>();

    historial.forEach(compra => {
      compra.productos.forEach(prod => {
        const existing = productoStats.get(prod.productoId) || {
          sku: prod.sku,
          nombre: prod.nombre,
          marca: prod.marca,
          compras: 0,
          unidades: 0,
          gasto: 0,
          fechas: []
        };

        existing.compras++;
        existing.unidades += prod.cantidad;
        existing.gasto += prod.subtotal;
        existing.fechas.push(compra.fecha);

        productoStats.set(prod.productoId, existing);
      });
    });

    const ahora = new Date();

    return Array.from(productoStats.entries())
      .map(([productoId, stats]) => {
        // Calcular frecuencia promedio
        const fechasOrdenadas = stats.fechas.sort((a, b) => a.getTime() - b.getTime());
        let frecuenciaPromedio = 0;
        if (fechasOrdenadas.length >= 2) {
          const intervalos: number[] = [];
          for (let i = 1; i < fechasOrdenadas.length; i++) {
            intervalos.push(
              Math.floor((fechasOrdenadas[i].getTime() - fechasOrdenadas[i-1].getTime()) / (1000 * 60 * 60 * 24))
            );
          }
          frecuenciaPromedio = Math.round(intervalos.reduce((a, b) => a + b, 0) / intervalos.length);
        }

        const ultimaCompra = fechasOrdenadas[fechasOrdenadas.length - 1];
        const prodInfo = productosMap.get(productoId);
        const ciclo = prodInfo?.cicloRecompraDias || frecuenciaPromedio || 30;

        // Estimar próxima compra
        let proximaCompraEstimada: Date | undefined;
        if (frecuenciaPromedio > 0 || ciclo > 0) {
          const diasParaProxima = (frecuenciaPromedio || ciclo);
          proximaCompraEstimada = new Date(ultimaCompra.getTime() + diasParaProxima * 24 * 60 * 60 * 1000);
        }

        return {
          productoId,
          sku: stats.sku,
          nombre: stats.nombre,
          marca: stats.marca,
          vecesComprado: stats.compras,
          unidadesTotales: stats.unidades,
          gastoTotal: stats.gasto,
          ultimaCompra,
          frecuenciaPromedioDias: frecuenciaPromedio,
          proximaCompraEstimada
        };
      })
      .sort((a, b) => b.vecesComprado - a.vecesComprado)
      .slice(0, 10);
  },

  /**
   * Calcula marcas preferidas
   */
  calcularMarcasPreferidas(historial: CompraHistorial[], gastoTotal: number): MarcaPreferida[] {
    const marcaStats = new Map<string, { productos: Set<string>; unidades: number; gasto: number }>();

    historial.forEach(compra => {
      compra.productos.forEach(prod => {
        const marca = prod.marca || 'Sin marca';
        const existing = marcaStats.get(marca) || { productos: new Set(), unidades: 0, gasto: 0 };
        existing.productos.add(prod.productoId);
        existing.unidades += prod.cantidad;
        existing.gasto += prod.subtotal;
        marcaStats.set(marca, existing);
      });
    });

    return Array.from(marcaStats.entries())
      .map(([marca, stats]) => ({
        marca,
        productosComprados: stats.productos.size,
        unidadesTotales: stats.unidades,
        gastoTotal: stats.gasto,
        porcentajeGasto: gastoTotal > 0 ? (stats.gasto / gastoTotal) * 100 : 0
      }))
      .sort((a, b) => b.gastoTotal - a.gastoTotal)
      .slice(0, 5);
  },

  /**
   * Calcula categorías preferidas
   */
  calcularCategoriasPreferidas(
    historial: CompraHistorial[],
    productosMap: Map<string, { nombre: string; marca: string; grupo: string }>,
    gastoTotal: number
  ): Array<{ categoria: string; gasto: number; porcentaje: number }> {
    const categoriaGasto = new Map<string, number>();

    historial.forEach(compra => {
      compra.productos.forEach(prod => {
        const prodInfo = productosMap.get(prod.productoId);
        const categoria = prodInfo?.grupo || 'Sin categoría';
        categoriaGasto.set(categoria, (categoriaGasto.get(categoria) || 0) + prod.subtotal);
      });
    });

    return Array.from(categoriaGasto.entries())
      .map(([categoria, gasto]) => ({
        categoria,
        gasto,
        porcentaje: gastoTotal > 0 ? (gasto / gastoTotal) * 100 : 0
      }))
      .sort((a, b) => b.gasto - a.gasto);
  },

  /**
   * Detecta patrones de compra
   */
  detectarPatrones(historial: CompraHistorial[], frecuenciaPromedio: number): PatronCompra[] {
    const patrones: PatronCompra[] = [];

    if (historial.length < 3) return patrones;

    // Patrón de frecuencia regular
    if (frecuenciaPromedio > 0) {
      const desviaciones = historial
        .filter(c => c.diasDesdeCompraAnterior !== undefined)
        .map(c => Math.abs(c.diasDesdeCompraAnterior! - frecuenciaPromedio));

      if (desviaciones.length > 0) {
        const desviacionPromedio = desviaciones.reduce((a, b) => a + b, 0) / desviaciones.length;
        const regularidad = Math.max(0, 100 - (desviacionPromedio / frecuenciaPromedio) * 100);

        if (regularidad > 60) {
          patrones.push({
            tipo: 'frecuencia',
            descripcion: `Compra regular cada ~${frecuenciaPromedio} días`,
            confianza: regularidad,
            datos: { frecuenciaDias: frecuenciaPromedio, regularidad }
          });
        }
      }
    }

    // Patrón de monto consistente
    const montos = historial.map(c => c.totalPEN);
    const montoPromedio = montos.reduce((a, b) => a + b, 0) / montos.length;
    const desviacionMonto = Math.sqrt(
      montos.reduce((sum, m) => sum + Math.pow(m - montoPromedio, 2), 0) / montos.length
    );
    const coefVariacion = (desviacionMonto / montoPromedio) * 100;

    if (coefVariacion < 30) {
      patrones.push({
        tipo: 'monto',
        descripcion: `Ticket consistente de ~S/${Math.round(montoPromedio)}`,
        confianza: 100 - coefVariacion,
        datos: { montoPromedio, desviacion: desviacionMonto }
      });
    }

    // Patrón de producto recurrente
    const productoCounts = new Map<string, number>();
    historial.forEach(c => {
      c.productos.forEach(p => {
        productoCounts.set(p.nombre, (productoCounts.get(p.nombre) || 0) + 1);
      });
    });

    const productoMasFrecuente = Array.from(productoCounts.entries())
      .sort((a, b) => b[1] - a[1])[0];

    if (productoMasFrecuente && productoMasFrecuente[1] >= historial.length * 0.5) {
      patrones.push({
        tipo: 'producto',
        descripcion: `Compra frecuente de ${productoMasFrecuente[0]}`,
        confianza: (productoMasFrecuente[1] / historial.length) * 100,
        datos: { producto: productoMasFrecuente[0], frecuencia: productoMasFrecuente[1] }
      });
    }

    return patrones;
  },

  /**
   * Calcula métricas por mes
   */
  calcularMetricasPorMes(historial: CompraHistorial[]): MetricasPeriodo[] {
    const mesesMap = new Map<string, MetricasPeriodo>();

    historial.forEach(compra => {
      const mes = compra.fecha.getMonth() + 1;
      const anio = compra.fecha.getFullYear();
      const periodo = `${anio}-${String(mes).padStart(2, '0')}`;

      const existing = mesesMap.get(periodo) || {
        periodo,
        mes,
        anio,
        compras: 0,
        gastoPEN: 0,
        productosComprados: 0,
        ticketPromedio: 0
      };

      existing.compras++;
      existing.gastoPEN += compra.totalPEN;
      existing.productosComprados += compra.productos.reduce((s, p) => s + p.cantidad, 0);

      mesesMap.set(periodo, existing);
    });

    // Calcular ticket promedio
    mesesMap.forEach(m => {
      m.ticketPromedio = m.compras > 0 ? m.gastoPEN / m.compras : 0;
    });

    return Array.from(mesesMap.values()).sort((a, b) => a.periodo.localeCompare(b.periodo));
  },

  /**
   * Calcula tendencia de gasto
   */
  calcularTendenciaGasto(metricas: MetricasPeriodo[]): { tendencia: 'creciendo' | 'estable' | 'decreciendo'; tasa: number } {
    if (metricas.length < 2) return { tendencia: 'estable', tasa: 0 };

    const ultimos3 = metricas.slice(-3);
    const anteriores3 = metricas.slice(-6, -3);

    if (anteriores3.length === 0) return { tendencia: 'estable', tasa: 0 };

    const gastoReciente = ultimos3.reduce((s, m) => s + m.gastoPEN, 0);
    const gastoAnterior = anteriores3.reduce((s, m) => s + m.gastoPEN, 0);

    if (gastoAnterior === 0) return { tendencia: 'estable', tasa: 0 };

    const tasa = ((gastoReciente - gastoAnterior) / gastoAnterior) * 100;

    let tendencia: 'creciendo' | 'estable' | 'decreciendo' = 'estable';
    if (tasa > 15) tendencia = 'creciendo';
    else if (tasa < -15) tendencia = 'decreciendo';

    return { tendencia, tasa };
  },

  /**
   * Calcula predicciones para el cliente
   */
  calcularPredicciones(
    historial: CompraHistorial[],
    diasDesdeUltima: number,
    frecuencia: number,
    ticketPromedio: number,
    productosFavoritos: ProductoFavorito[]
  ): PrediccionCliente {
    // Probabilidad de recompra en 30 días
    let probRecompra = 0;
    if (frecuencia > 0 && frecuencia <= 30) {
      probRecompra = Math.min(90, Math.max(10, 100 - (diasDesdeUltima / frecuencia) * 30));
    } else if (diasDesdeUltima < 30) {
      probRecompra = 60;
    } else if (diasDesdeUltima < 60) {
      probRecompra = 40;
    } else {
      probRecompra = 20;
    }

    // Probabilidad de churn
    let probChurn = 0;
    if (diasDesdeUltima > 180) probChurn = 80;
    else if (diasDesdeUltima > 90) probChurn = 50;
    else if (diasDesdeUltima > 60) probChurn = 30;
    else probChurn = 10;

    // Valor de vida estimado (CLV simplificado)
    const comprasAnualesEstimadas = frecuencia > 0 ? 365 / frecuencia : 4;
    const valorVidaEstimado = ticketPromedio * comprasAnualesEstimadas * 3; // 3 años estimados

    // Próxima compra estimada
    let proximaCompraEstimada: Date | undefined;
    if (frecuencia > 0 && historial.length > 0) {
      const ultimaCompra = historial[0].fecha;
      proximaCompraEstimada = new Date(ultimaCompra.getTime() + frecuencia * 24 * 60 * 60 * 1000);
    }

    // Productos probables
    const productosProbables = productosFavoritos
      .slice(0, 3)
      .map(p => p.nombre);

    return {
      probabilidadRecompra30Dias: Math.round(probRecompra),
      probabilidadChurn: Math.round(probChurn),
      valorVidaEstimado: Math.round(valorVidaEstimado),
      proximaCompraEstimada,
      productosProbables
    };
  },

  /**
   * Calcula comparaciones con otros clientes
   */
  async calcularComparaciones(
    cliente: Cliente,
    gastoTotal: number,
    totalCompras: number,
    ticketPromedio: number,
    todosClientes: Cliente[]
  ): Promise<{ comparaciones: ComparacionCliente[]; ranking: number; total: number }> {
    const clientesConCompras = todosClientes.filter(c => (c.metricas?.totalCompras || 0) > 0);

    // Ordenar por gasto total
    const ordenadosPorGasto = [...clientesConCompras]
      .sort((a, b) => (b.metricas?.montoTotalPEN || 0) - (a.metricas?.montoTotalPEN || 0));

    const ranking = ordenadosPorGasto.findIndex(c => c.id === cliente.id) + 1;

    // Calcular promedios
    const promedioGasto = clientesConCompras.reduce((s, c) => s + (c.metricas?.montoTotalPEN || 0), 0) / clientesConCompras.length;
    const promedioCompras = clientesConCompras.reduce((s, c) => s + (c.metricas?.totalCompras || 0), 0) / clientesConCompras.length;
    const promedioTicket = clientesConCompras.reduce((s, c) => s + (c.metricas?.ticketPromedio || 0), 0) / clientesConCompras.length;

    const comparaciones: ComparacionCliente[] = [
      {
        metrica: 'Gasto Total',
        valorCliente: gastoTotal,
        promedioGeneral: promedioGasto,
        percentil: Math.round((1 - (ranking / clientesConCompras.length)) * 100),
        comparacion: gastoTotal > promedioGasto * 1.2 ? 'superior' :
                     gastoTotal < promedioGasto * 0.8 ? 'inferior' : 'promedio'
      },
      {
        metrica: 'Total Compras',
        valorCliente: totalCompras,
        promedioGeneral: promedioCompras,
        percentil: 0, // Se calcularía con otro ordenamiento
        comparacion: totalCompras > promedioCompras * 1.2 ? 'superior' :
                     totalCompras < promedioCompras * 0.8 ? 'inferior' : 'promedio'
      },
      {
        metrica: 'Ticket Promedio',
        valorCliente: ticketPromedio,
        promedioGeneral: promedioTicket,
        percentil: 0,
        comparacion: ticketPromedio > promedioTicket * 1.2 ? 'superior' :
                     ticketPromedio < promedioTicket * 0.8 ? 'inferior' : 'promedio'
      }
    ];

    return { comparaciones, ranking, total: clientesConCompras.length };
  },

  /**
   * Calcula alertas de recompra para productos
   */
  calcularAlertasRecompra(
    productosFavoritos: ProductoFavorito[],
    productosMap: Map<string, { nombre: string; marca: string; cicloRecompraDias?: number }>
  ): Array<{
    productoId: string;
    nombre: string;
    diasDesdeCompra: number;
    cicloEstimado: number;
    urgencia: 'alta' | 'media' | 'baja';
  }> {
    const ahora = new Date();
    const alertas: Array<{
      productoId: string;
      nombre: string;
      diasDesdeCompra: number;
      cicloEstimado: number;
      urgencia: 'alta' | 'media' | 'baja';
    }> = [];

    productosFavoritos.forEach(prod => {
      const prodInfo = productosMap.get(prod.productoId);
      const ciclo = prodInfo?.cicloRecompraDias || prod.frecuenciaPromedioDias || 30;
      const diasDesdeCompra = Math.floor(
        (ahora.getTime() - prod.ultimaCompra.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diasDesdeCompra >= ciclo * 0.7) {
        let urgencia: 'alta' | 'media' | 'baja' = 'baja';
        if (diasDesdeCompra >= ciclo) urgencia = 'alta';
        else if (diasDesdeCompra >= ciclo * 0.85) urgencia = 'media';

        alertas.push({
          productoId: prod.productoId,
          nombre: prod.nombre,
          diasDesdeCompra,
          cicloEstimado: ciclo,
          urgencia
        });
      }
    });

    return alertas.sort((a, b) => {
      const prioridad = { alta: 0, media: 1, baja: 2 };
      return prioridad[a.urgencia] - prioridad[b.urgencia];
    });
  },

  /**
   * Calcula oportunidades de cross-sell
   */
  async calcularOportunidadesCrossSell(
    historial: CompraHistorial[],
    marcasPreferidas: MarcaPreferida[],
    productosMap: Map<string, { nombre: string; marca: string; grupo: string }>
  ): Promise<Array<{
    productoId: string;
    nombre: string;
    razon: string;
    probabilidad: number;
  }>> {
    const productosComprados = new Set(
      historial.flatMap(c => c.productos.map(p => p.productoId))
    );

    const oportunidades: Array<{
      productoId: string;
      nombre: string;
      razon: string;
      probabilidad: number;
    }> = [];

    // Buscar productos de marcas preferidas que no ha comprado
    const marcaTop = marcasPreferidas[0];
    if (marcaTop) {
      productosMap.forEach((info, productoId) => {
        if (info.marca === marcaTop.marca && !productosComprados.has(productoId)) {
          oportunidades.push({
            productoId,
            nombre: info.nombre,
            razon: `Mismo fabricante que sus productos favoritos (${marcaTop.marca})`,
            probabilidad: 70
          });
        }
      });
    }

    return oportunidades.slice(0, 5);
  }
};

export const ClienteAnalyticsService = clienteAnalyticsService;
