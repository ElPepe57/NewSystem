/**
 * Servicio de Analytics Avanzado para Proveedores
 * Proporciona métricas detalladas, comparativos de precios,
 * análisis de incidencias y predicciones
 */

import type { Timestamp } from 'firebase/firestore';
import type { Proveedor, OrdenCompra, ProductoOrden, ClasificacionProveedor } from '../types/ordenCompra.types';
import type { Producto, ProveedorUSA } from '../types/producto.types';

// ============================================
// INTERFACES DE ANALYTICS
// ============================================

/**
 * Historial de una orden de compra
 */
export interface OrdenCompraHistorial {
  ordenId: string;
  numeroOrden: string;
  fecha: Date;
  productos: Array<{
    productoId: string;
    sku: string;
    nombre: string;
    cantidad: number;
    costoUnitario: number;
    subtotal: number;
  }>;
  totalUSD: number;
  totalPEN?: number;
  estado: string;
  estadoPago: string;
  diasEntrega?: number;
  tuvoProblemas?: boolean;
}

/**
 * Producto comprado al proveedor con métricas
 */
export interface ProductoProveedorMetrics {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  // Métricas de compra
  unidadesCompradas: number;
  ordenesCompra: number;
  costoPromedioUSD: number;
  costoMinimoUSD: number;
  costoMaximoUSD: number;
  ultimaCompra?: Date;
  ultimoCostoUSD: number;
  // Tendencia
  tendenciaCosto: 'subiendo' | 'bajando' | 'estable';
  variacionCosto: number; // % variación últimos 90 días
  // Comparativo
  costosOtrosProveedores?: Array<{
    proveedorId: string;
    proveedorNombre: string;
    costoPromedioUSD: number;
    diferencia: number; // % vs este proveedor
  }>;
  esMejorPrecio: boolean;
}

/**
 * Incidencia con proveedor
 */
export interface IncidenciaProveedor {
  id: string;
  fecha: Date;
  tipo: 'demora' | 'producto_danado' | 'faltante' | 'precio_incorrecto' | 'calidad' | 'otro';
  severidad: 'leve' | 'moderada' | 'grave';
  ordenCompraId?: string;
  numeroOrden?: string;
  descripcion: string;
  impactoUSD?: number;
  resuelta: boolean;
  fechaResolucion?: Date;
  resolucion?: string;
}

/**
 * Comparativo de precios entre proveedores para un producto
 */
export interface ComparativoPrecioProducto {
  productoId: string;
  sku: string;
  nombreProducto: string;
  preciosProveedores: Array<{
    proveedorId: string;
    proveedorNombre: string;
    costoPromedioUSD: number;
    ultimoCostoUSD: number;
    fechaUltimaCompra?: Date;
    ordenesCompra: number;
    esPreferido: boolean;
  }>;
  mejorPrecio: {
    proveedorId: string;
    proveedorNombre: string;
    costoUSD: number;
  };
  peorPrecio: {
    proveedorId: string;
    proveedorNombre: string;
    costoUSD: number;
  };
  diferenciaMaxima: number; // % entre mejor y peor
  precioPromedio: number;
}

/**
 * Predicciones del proveedor
 */
export interface PrediccionesProveedor {
  // Predicción de próxima compra
  diasEstimadosProximaCompra: number;
  fechaEstimadaProximaCompra: Date;
  montoEstimadoProximaCompra: number;
  // Tendencia
  tendenciaVolumen: 'creciente' | 'decreciente' | 'estable';
  tendenciaPrecios: 'subiendo' | 'bajando' | 'estable';
  // Riesgo
  riesgoIncidencia: number; // 0-100
  riesgoInactividad: number; // 0-100
  // CLV
  valorAnualEstimado: number;
  valorTotalHistorico: number;
}

/**
 * Analytics completo del proveedor
 */
export interface ProveedorAnalytics {
  proveedor: Proveedor;

  // Historial de órdenes
  historialOrdenes: OrdenCompraHistorial[];

  // Métricas generales
  totalOrdenes: number;
  ordenesUltimos30Dias: number;
  ordenesUltimos90Dias: number;
  ordenesUltimos365Dias: number;

  montoTotalUSD: number;
  montoUltimos30DiasUSD: number;
  montoUltimos90DiasUSD: number;
  montoUltimos365DiasUSD: number;

  ordenPromedio: number;
  diasDesdeUltimaOrden: number;
  frecuenciaCompraDias: number;

  // Productos
  productosComprados: ProductoProveedorMetrics[];
  totalProductosDistintos: number;
  productoMasComprado?: {
    productoId: string;
    nombre: string;
    unidades: number;
  };

  // Tiempos de entrega
  tiempoEntregaPromedio: number;
  tiempoEntregaMinimo: number;
  tiempoEntregaMaximo: number;
  desviacionTiempoEntrega: number;
  tasaPuntualidad: number; // % entregas a tiempo

  // Calidad e incidencias
  incidencias: IncidenciaProveedor[];
  totalIncidencias: number;
  incidenciasAbiertas: number;
  tasaIncidencias: number; // % órdenes con problemas
  costoIncidenciasUSD: number;

  // Evaluación
  puntuacionActual: number;
  clasificacion: ClasificacionProveedor;
  tendenciaEvaluacion: 'mejorando' | 'empeorando' | 'estable';

  // Predicciones
  predicciones: PrediccionesProveedor;

  // Alertas
  alertas: Array<{
    tipo: 'demora_pago' | 'sin_compras' | 'precio_alto' | 'incidencia_abierta' | 'evaluacion_baja';
    mensaje: string;
    severidad: 'info' | 'warning' | 'danger';
  }>;
}

/**
 * Ranking de proveedores
 */
export interface RankingProveedores {
  categoria: string;
  proveedores: Array<{
    proveedor: Proveedor;
    posicion: number;
    valor: number;
    insight: string;
  }>;
}

// ============================================
// SERVICIO DE ANALYTICS
// ============================================

export const ProveedorAnalyticsService = {
  /**
   * Obtiene analytics completo de un proveedor
   */
  async getProveedorAnalytics(
    proveedor: Proveedor,
    ordenesCompra: OrdenCompra[],
    productos: Producto[],
    allProveedores: Proveedor[]
  ): Promise<ProveedorAnalytics> {
    // Filtrar órdenes de este proveedor
    const ordenesProveedor = ordenesCompra.filter(oc => oc.proveedorId === proveedor.id);

    // Calcular historial
    const historialOrdenes = this.calcularHistorialOrdenes(ordenesProveedor);

    // Calcular métricas generales
    const metricas = this.calcularMetricasGenerales(ordenesProveedor);

    // Calcular métricas de productos
    const productosComprados = this.calcularProductosComprados(
      ordenesProveedor,
      productos,
      ordenesCompra,
      allProveedores
    );

    // Calcular tiempos de entrega
    const tiemposEntrega = this.calcularTiemposEntrega(ordenesProveedor);

    // Simular incidencias (en producción vendrían de la base de datos)
    const incidencias = this.calcularIncidencias(ordenesProveedor);

    // Calcular predicciones
    const predicciones = this.calcularPredicciones(ordenesProveedor, metricas);

    // Generar alertas
    const alertas = this.generarAlertas(proveedor, metricas, incidencias, tiemposEntrega);

    return {
      proveedor,
      historialOrdenes,
      // Métricas generales
      totalOrdenes: metricas.totalOrdenes,
      ordenesUltimos30Dias: metricas.ordenesUltimos30Dias,
      ordenesUltimos90Dias: metricas.ordenesUltimos90Dias,
      ordenesUltimos365Dias: metricas.ordenesUltimos365Dias,
      montoTotalUSD: metricas.montoTotalUSD,
      montoUltimos30DiasUSD: metricas.montoUltimos30DiasUSD,
      montoUltimos90DiasUSD: metricas.montoUltimos90DiasUSD,
      montoUltimos365DiasUSD: metricas.montoUltimos365DiasUSD,
      ordenPromedio: metricas.ordenPromedio,
      diasDesdeUltimaOrden: metricas.diasDesdeUltimaOrden,
      frecuenciaCompraDias: metricas.frecuenciaCompraDias,
      // Productos
      productosComprados,
      totalProductosDistintos: productosComprados.length,
      productoMasComprado: productosComprados.length > 0
        ? {
            productoId: productosComprados[0].productoId,
            nombre: productosComprados[0].nombreComercial,
            unidades: productosComprados[0].unidadesCompradas
          }
        : undefined,
      // Tiempos de entrega
      ...tiemposEntrega,
      // Incidencias
      incidencias,
      totalIncidencias: incidencias.length,
      incidenciasAbiertas: incidencias.filter(i => !i.resuelta).length,
      tasaIncidencias: metricas.totalOrdenes > 0
        ? (incidencias.length / metricas.totalOrdenes) * 100
        : 0,
      costoIncidenciasUSD: incidencias.reduce((sum, i) => sum + (i.impactoUSD || 0), 0),
      // Evaluación
      puntuacionActual: proveedor.evaluacion?.puntuacion || 0,
      clasificacion: proveedor.evaluacion?.clasificacion || 'aprobado',
      tendenciaEvaluacion: this.calcularTendenciaEvaluacion(proveedor),
      // Predicciones
      predicciones,
      // Alertas
      alertas
    };
  },

  /**
   * Calcula el historial de órdenes de compra
   */
  calcularHistorialOrdenes(ordenes: OrdenCompra[]): OrdenCompraHistorial[] {
    return ordenes
      .sort((a, b) => {
        const fechaA = a.fechaCreacion?.toDate?.() || new Date(a.fechaCreacion as unknown as string);
        const fechaB = b.fechaCreacion?.toDate?.() || new Date(b.fechaCreacion as unknown as string);
        return fechaB.getTime() - fechaA.getTime();
      })
      .map(oc => {
        const fecha = oc.fechaCreacion?.toDate?.() || new Date(oc.fechaCreacion as unknown as string);

        // Calcular días de entrega si aplica
        let diasEntrega: number | undefined;
        if (oc.fechaRecibida && oc.fechaEnviada) {
          const fechaEnviada = oc.fechaEnviada.toDate?.() || new Date(oc.fechaEnviada as unknown as string);
          const fechaRecibida = oc.fechaRecibida.toDate?.() || new Date(oc.fechaRecibida as unknown as string);
          diasEntrega = Math.floor((fechaRecibida.getTime() - fechaEnviada.getTime()) / (1000 * 60 * 60 * 24));
        }

        return {
          ordenId: oc.id,
          numeroOrden: oc.numeroOrden,
          fecha,
          productos: oc.productos.map(p => ({
            productoId: p.productoId,
            sku: p.sku,
            nombre: `${p.marca} ${p.nombreComercial} ${p.presentacion}`,
            cantidad: p.cantidad,
            costoUnitario: p.costoUnitario,
            subtotal: p.subtotal
          })),
          totalUSD: oc.totalUSD,
          totalPEN: oc.totalPEN,
          estado: oc.estado,
          estadoPago: oc.estadoPago,
          diasEntrega,
          tuvoProblemas: false // Se determinaría con datos de incidencias
        };
      });
  },

  /**
   * Calcula métricas generales del proveedor
   */
  calcularMetricasGenerales(ordenes: OrdenCompra[]) {
    const ahora = new Date();
    const hace30 = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hace90 = new Date(ahora.getTime() - 90 * 24 * 60 * 60 * 1000);
    const hace365 = new Date(ahora.getTime() - 365 * 24 * 60 * 60 * 1000);

    let montoTotalUSD = 0;
    let montoUltimos30DiasUSD = 0;
    let montoUltimos90DiasUSD = 0;
    let montoUltimos365DiasUSD = 0;
    let ordenesUltimos30Dias = 0;
    let ordenesUltimos90Dias = 0;
    let ordenesUltimos365Dias = 0;
    let ultimaOrdenFecha: Date | null = null;
    const fechasOrdenes: Date[] = [];

    ordenes.forEach(oc => {
      const fecha = oc.fechaCreacion?.toDate?.() || new Date(oc.fechaCreacion as unknown as string);
      fechasOrdenes.push(fecha);
      montoTotalUSD += oc.totalUSD;

      if (fecha >= hace30) {
        ordenesUltimos30Dias++;
        montoUltimos30DiasUSD += oc.totalUSD;
      }
      if (fecha >= hace90) {
        ordenesUltimos90Dias++;
        montoUltimos90DiasUSD += oc.totalUSD;
      }
      if (fecha >= hace365) {
        ordenesUltimos365Dias++;
        montoUltimos365DiasUSD += oc.totalUSD;
      }

      if (!ultimaOrdenFecha || fecha > ultimaOrdenFecha) {
        ultimaOrdenFecha = fecha;
      }
    });

    // Calcular frecuencia de compra
    let frecuenciaCompraDias = 0;
    if (fechasOrdenes.length >= 2) {
      fechasOrdenes.sort((a, b) => a.getTime() - b.getTime());
      let totalDias = 0;
      for (let i = 1; i < fechasOrdenes.length; i++) {
        totalDias += (fechasOrdenes[i].getTime() - fechasOrdenes[i - 1].getTime()) / (1000 * 60 * 60 * 24);
      }
      frecuenciaCompraDias = Math.round(totalDias / (fechasOrdenes.length - 1));
    }

    return {
      totalOrdenes: ordenes.length,
      ordenesUltimos30Dias,
      ordenesUltimos90Dias,
      ordenesUltimos365Dias,
      montoTotalUSD,
      montoUltimos30DiasUSD,
      montoUltimos90DiasUSD,
      montoUltimos365DiasUSD,
      ordenPromedio: ordenes.length > 0 ? montoTotalUSD / ordenes.length : 0,
      diasDesdeUltimaOrden: ultimaOrdenFecha !== null
        ? Math.floor((ahora.getTime() - (ultimaOrdenFecha as Date).getTime()) / (1000 * 60 * 60 * 24))
        : 999,
      frecuenciaCompraDias
    };
  },

  /**
   * Calcula métricas de productos comprados
   */
  calcularProductosComprados(
    ordenesProveedor: OrdenCompra[],
    productos: Producto[],
    todasOrdenes: OrdenCompra[],
    allProveedores: Proveedor[]
  ): ProductoProveedorMetrics[] {
    const productosMap = new Map<string, {
      sku: string;
      marca: string;
      nombreComercial: string;
      presentacion: string;
      unidades: number;
      ordenes: number;
      costos: number[];
      ultimaCompra?: Date;
      ultimoCosto: number;
    }>();

    // Recopilar datos de este proveedor
    ordenesProveedor.forEach(oc => {
      const fecha = oc.fechaCreacion?.toDate?.() || new Date(oc.fechaCreacion as unknown as string);
      oc.productos.forEach(p => {
        const existing = productosMap.get(p.productoId);
        if (existing) {
          existing.unidades += p.cantidad;
          existing.ordenes++;
          existing.costos.push(p.costoUnitario);
          if (!existing.ultimaCompra || fecha > existing.ultimaCompra) {
            existing.ultimaCompra = fecha;
            existing.ultimoCosto = p.costoUnitario;
          }
        } else {
          productosMap.set(p.productoId, {
            sku: p.sku,
            marca: p.marca,
            nombreComercial: p.nombreComercial,
            presentacion: p.presentacion,
            unidades: p.cantidad,
            ordenes: 1,
            costos: [p.costoUnitario],
            ultimaCompra: fecha,
            ultimoCosto: p.costoUnitario
          });
        }
      });
    });

    // Calcular costos de otros proveedores para comparativo
    const costosOtrosProveedores = new Map<string, Map<string, { costos: number[]; proveedorNombre: string }>>();
    todasOrdenes.forEach(oc => {
      if (oc.proveedorId === ordenesProveedor[0]?.proveedorId) return;
      oc.productos.forEach(p => {
        if (!productosMap.has(p.productoId)) return;

        if (!costosOtrosProveedores.has(p.productoId)) {
          costosOtrosProveedores.set(p.productoId, new Map());
        }
        const proveedoresProducto = costosOtrosProveedores.get(p.productoId)!;
        const proveedor = allProveedores.find(prov => prov.id === oc.proveedorId);

        if (!proveedoresProducto.has(oc.proveedorId)) {
          proveedoresProducto.set(oc.proveedorId, {
            costos: [],
            proveedorNombre: proveedor?.nombre || oc.nombreProveedor
          });
        }
        proveedoresProducto.get(oc.proveedorId)!.costos.push(p.costoUnitario);
      });
    });

    // Construir métricas
    return Array.from(productosMap.entries())
      .map(([productoId, data]) => {
        const costoPromedio = data.costos.reduce((a, b) => a + b, 0) / data.costos.length;
        const costoMinimo = Math.min(...data.costos);
        const costoMaximo = Math.max(...data.costos);

        // Comparativo con otros proveedores
        const otrosProveedores = costosOtrosProveedores.get(productoId);
        const costosComparativos: ProductoProveedorMetrics['costosOtrosProveedores'] = [];
        let esMejorPrecio = true;

        if (otrosProveedores) {
          otrosProveedores.forEach((datos, provId) => {
            const costoPromedioOtro = datos.costos.reduce((a, b) => a + b, 0) / datos.costos.length;
            const diferencia = ((costoPromedio - costoPromedioOtro) / costoPromedioOtro) * 100;
            costosComparativos.push({
              proveedorId: provId,
              proveedorNombre: datos.proveedorNombre,
              costoPromedioUSD: costoPromedioOtro,
              diferencia
            });
            if (costoPromedioOtro < costoPromedio) {
              esMejorPrecio = false;
            }
          });
        }

        // Calcular tendencia (simplificada)
        let tendenciaCosto: 'subiendo' | 'bajando' | 'estable' = 'estable';
        let variacionCosto = 0;
        if (data.costos.length >= 2) {
          const primerCosto = data.costos[0];
          const ultimoCosto = data.costos[data.costos.length - 1];
          variacionCosto = ((ultimoCosto - primerCosto) / primerCosto) * 100;
          if (variacionCosto > 5) tendenciaCosto = 'subiendo';
          else if (variacionCosto < -5) tendenciaCosto = 'bajando';
        }

        return {
          productoId,
          sku: data.sku,
          marca: data.marca,
          nombreComercial: data.nombreComercial,
          presentacion: data.presentacion,
          unidadesCompradas: data.unidades,
          ordenesCompra: data.ordenes,
          costoPromedioUSD: costoPromedio,
          costoMinimoUSD: costoMinimo,
          costoMaximoUSD: costoMaximo,
          ultimaCompra: data.ultimaCompra,
          ultimoCostoUSD: data.ultimoCosto,
          tendenciaCosto,
          variacionCosto,
          costosOtrosProveedores: costosComparativos.length > 0 ? costosComparativos : undefined,
          esMejorPrecio
        };
      })
      .sort((a, b) => b.unidadesCompradas - a.unidadesCompradas);
  },

  /**
   * Calcula tiempos de entrega
   */
  calcularTiemposEntrega(ordenes: OrdenCompra[]) {
    const tiemposEntrega: number[] = [];
    let ordenesEnTiempo = 0;
    const TIEMPO_ESPERADO_DIAS = 14; // 2 semanas como referencia

    ordenes.forEach(oc => {
      if (oc.fechaRecibida && oc.fechaEnviada) {
        const fechaEnviada = oc.fechaEnviada.toDate?.() || new Date(oc.fechaEnviada as unknown as string);
        const fechaRecibida = oc.fechaRecibida.toDate?.() || new Date(oc.fechaRecibida as unknown as string);
        const dias = Math.floor((fechaRecibida.getTime() - fechaEnviada.getTime()) / (1000 * 60 * 60 * 24));
        tiemposEntrega.push(dias);
        if (dias <= TIEMPO_ESPERADO_DIAS) {
          ordenesEnTiempo++;
        }
      }
    });

    if (tiemposEntrega.length === 0) {
      return {
        tiempoEntregaPromedio: 0,
        tiempoEntregaMinimo: 0,
        tiempoEntregaMaximo: 0,
        desviacionTiempoEntrega: 0,
        tasaPuntualidad: 100
      };
    }

    const promedio = tiemposEntrega.reduce((a, b) => a + b, 0) / tiemposEntrega.length;
    const desviacion = Math.sqrt(
      tiemposEntrega.reduce((sum, t) => sum + Math.pow(t - promedio, 2), 0) / tiemposEntrega.length
    );

    return {
      tiempoEntregaPromedio: Math.round(promedio * 10) / 10,
      tiempoEntregaMinimo: Math.min(...tiemposEntrega),
      tiempoEntregaMaximo: Math.max(...tiemposEntrega),
      desviacionTiempoEntrega: Math.round(desviacion * 10) / 10,
      tasaPuntualidad: (ordenesEnTiempo / tiemposEntrega.length) * 100
    };
  },

  /**
   * Calcula incidencias (simuladas - en producción vendrían de BD)
   */
  calcularIncidencias(ordenes: OrdenCompra[]): IncidenciaProveedor[] {
    // Por ahora retornamos array vacío
    // En producción esto vendría de una colección de incidencias
    return [];
  },

  /**
   * Calcula tendencia de evaluación
   */
  calcularTendenciaEvaluacion(proveedor: Proveedor): 'mejorando' | 'empeorando' | 'estable' {
    const historial = proveedor.evaluacionesHistorial || [];
    if (historial.length < 2) return 'estable';

    const ultimasPuntuaciones = historial.slice(-3).map(h => h.puntuacion);
    if (ultimasPuntuaciones.length < 2) return 'estable';

    const tendencia = ultimasPuntuaciones[ultimasPuntuaciones.length - 1] - ultimasPuntuaciones[0];
    if (tendencia > 5) return 'mejorando';
    if (tendencia < -5) return 'empeorando';
    return 'estable';
  },

  /**
   * Calcula predicciones
   */
  calcularPredicciones(ordenes: OrdenCompra[], metricas: any): PrediccionesProveedor {
    const ahora = new Date();

    // Días estimados para próxima compra basado en frecuencia
    const diasEstimados = metricas.frecuenciaCompraDias > 0
      ? Math.max(0, metricas.frecuenciaCompraDias - metricas.diasDesdeUltimaOrden)
      : 30;

    // Monto estimado basado en orden promedio
    const montoEstimado = metricas.ordenPromedio || 0;

    // Tendencia de volumen
    let tendenciaVolumen: 'creciente' | 'decreciente' | 'estable' = 'estable';
    if (metricas.ordenesUltimos90Dias > 0) {
      const tasaReciente = metricas.montoUltimos30DiasUSD / 30;
      const tasaAnterior = (metricas.montoUltimos90DiasUSD - metricas.montoUltimos30DiasUSD) / 60;
      if (tasaReciente > tasaAnterior * 1.2) tendenciaVolumen = 'creciente';
      else if (tasaReciente < tasaAnterior * 0.8) tendenciaVolumen = 'decreciente';
    }

    // Riesgo de inactividad
    const riesgoInactividad = Math.min(100,
      metricas.diasDesdeUltimaOrden > 90 ? 80 :
      metricas.diasDesdeUltimaOrden > 60 ? 50 :
      metricas.diasDesdeUltimaOrden > 30 ? 25 : 10
    );

    return {
      diasEstimadosProximaCompra: diasEstimados,
      fechaEstimadaProximaCompra: new Date(ahora.getTime() + diasEstimados * 24 * 60 * 60 * 1000),
      montoEstimadoProximaCompra: montoEstimado,
      tendenciaVolumen,
      tendenciaPrecios: 'estable',
      riesgoIncidencia: 10, // Bajo por defecto sin datos
      riesgoInactividad,
      valorAnualEstimado: metricas.montoUltimos365DiasUSD,
      valorTotalHistorico: metricas.montoTotalUSD
    };
  },

  /**
   * Genera alertas
   */
  generarAlertas(
    proveedor: Proveedor,
    metricas: any,
    incidencias: IncidenciaProveedor[],
    tiempos: any
  ): ProveedorAnalytics['alertas'] {
    const alertas: ProveedorAnalytics['alertas'] = [];

    // Alerta por inactividad
    if (metricas.diasDesdeUltimaOrden > 60) {
      alertas.push({
        tipo: 'sin_compras',
        mensaje: `Sin órdenes de compra hace ${metricas.diasDesdeUltimaOrden} días`,
        severidad: metricas.diasDesdeUltimaOrden > 90 ? 'warning' : 'info'
      });
    }

    // Alerta por evaluación baja
    if (proveedor.evaluacion && proveedor.evaluacion.puntuacion < 50) {
      alertas.push({
        tipo: 'evaluacion_baja',
        mensaje: `Evaluación por debajo del estándar (${proveedor.evaluacion.puntuacion.toFixed(1)}/100)`,
        severidad: proveedor.evaluacion.puntuacion < 40 ? 'danger' : 'warning'
      });
    }

    // Alerta por incidencias abiertas
    const incidenciasAbiertas = incidencias.filter(i => !i.resuelta);
    if (incidenciasAbiertas.length > 0) {
      alertas.push({
        tipo: 'incidencia_abierta',
        mensaje: `${incidenciasAbiertas.length} incidencia(s) sin resolver`,
        severidad: incidenciasAbiertas.some(i => i.severidad === 'grave') ? 'danger' : 'warning'
      });
    }

    // Alerta por puntualidad baja
    if (tiempos.tasaPuntualidad < 70 && metricas.totalOrdenes >= 3) {
      alertas.push({
        tipo: 'demora_pago',
        mensaje: `Tasa de puntualidad del ${tiempos.tasaPuntualidad.toFixed(0)}%`,
        severidad: 'warning'
      });
    }

    return alertas;
  },

  /**
   * Compara precios entre proveedores para productos específicos
   */
  compararPreciosProductos(
    productosIds: string[],
    ordenesCompra: OrdenCompra[],
    proveedores: Proveedor[]
  ): ComparativoPrecioProducto[] {
    const comparativos: ComparativoPrecioProducto[] = [];

    productosIds.forEach(productoId => {
      const preciosProveedores: ComparativoPrecioProducto['preciosProveedores'] = [];

      // Agrupar precios por proveedor
      const datosProveedor = new Map<string, {
        costos: number[];
        ultimoCosto: number;
        ultimaFecha?: Date;
        ordenes: number;
        nombreProveedor: string;
      }>();

      ordenesCompra.forEach(oc => {
        const productoEnOC = oc.productos.find(p => p.productoId === productoId);
        if (!productoEnOC) return;

        const fecha = oc.fechaCreacion?.toDate?.() || new Date(oc.fechaCreacion as unknown as string);

        if (!datosProveedor.has(oc.proveedorId)) {
          datosProveedor.set(oc.proveedorId, {
            costos: [],
            ultimoCosto: productoEnOC.costoUnitario,
            ultimaFecha: fecha,
            ordenes: 0,
            nombreProveedor: oc.nombreProveedor
          });
        }

        const datos = datosProveedor.get(oc.proveedorId)!;
        datos.costos.push(productoEnOC.costoUnitario);
        datos.ordenes++;
        if (!datos.ultimaFecha || fecha > datos.ultimaFecha) {
          datos.ultimaFecha = fecha;
          datos.ultimoCosto = productoEnOC.costoUnitario;
        }
      });

      if (datosProveedor.size === 0) return;

      // Construir lista de precios
      datosProveedor.forEach((datos, proveedorId) => {
        const proveedor = proveedores.find(p => p.id === proveedorId);
        preciosProveedores.push({
          proveedorId,
          proveedorNombre: datos.nombreProveedor,
          costoPromedioUSD: datos.costos.reduce((a, b) => a + b, 0) / datos.costos.length,
          ultimoCostoUSD: datos.ultimoCosto,
          fechaUltimaCompra: datos.ultimaFecha,
          ordenesCompra: datos.ordenes,
          esPreferido: proveedor?.evaluacion?.clasificacion === 'preferido'
        });
      });

      // Ordenar por costo promedio
      preciosProveedores.sort((a, b) => a.costoPromedioUSD - b.costoPromedioUSD);

      if (preciosProveedores.length > 0) {
        const mejorPrecio = preciosProveedores[0];
        const peorPrecio = preciosProveedores[preciosProveedores.length - 1];

        // Buscar nombre del producto
        let nombreProducto = productoId;
        const primeraOC = ordenesCompra.find(oc =>
          oc.productos.some(p => p.productoId === productoId)
        );
        if (primeraOC) {
          const prod = primeraOC.productos.find(p => p.productoId === productoId);
          if (prod) {
            nombreProducto = `${prod.marca} ${prod.nombreComercial}`;
          }
        }

        comparativos.push({
          productoId,
          sku: primeraOC?.productos.find(p => p.productoId === productoId)?.sku || '',
          nombreProducto,
          preciosProveedores,
          mejorPrecio: {
            proveedorId: mejorPrecio.proveedorId,
            proveedorNombre: mejorPrecio.proveedorNombre,
            costoUSD: mejorPrecio.costoPromedioUSD
          },
          peorPrecio: {
            proveedorId: peorPrecio.proveedorId,
            proveedorNombre: peorPrecio.proveedorNombre,
            costoUSD: peorPrecio.costoPromedioUSD
          },
          diferenciaMaxima: mejorPrecio.costoPromedioUSD > 0
            ? ((peorPrecio.costoPromedioUSD - mejorPrecio.costoPromedioUSD) / mejorPrecio.costoPromedioUSD) * 100
            : 0,
          precioPromedio: preciosProveedores.reduce((s, p) => s + p.costoPromedioUSD, 0) / preciosProveedores.length
        });
      }
    });

    return comparativos;
  },

  /**
   * Genera ranking de proveedores por diferentes criterios
   */
  generarRankings(
    proveedores: Proveedor[],
    ordenesCompra: OrdenCompra[]
  ): RankingProveedores[] {
    const rankings: RankingProveedores[] = [];

    // Calcular métricas por proveedor
    const metricasPorProveedor = new Map<string, {
      ordenesCompra: number;
      montoTotalUSD: number;
      diasDesdeUltimaOrden: number;
      productosDistintos: Set<string>;
    }>();

    const ahora = new Date();

    proveedores.forEach(p => {
      metricasPorProveedor.set(p.id, {
        ordenesCompra: 0,
        montoTotalUSD: 0,
        diasDesdeUltimaOrden: 999,
        productosDistintos: new Set()
      });
    });

    ordenesCompra.forEach(oc => {
      const metricas = metricasPorProveedor.get(oc.proveedorId);
      if (!metricas) return;

      metricas.ordenesCompra++;
      metricas.montoTotalUSD += oc.totalUSD;
      oc.productos.forEach(p => metricas.productosDistintos.add(p.productoId));

      const fecha = oc.fechaCreacion?.toDate?.() || new Date(oc.fechaCreacion as unknown as string);
      const dias = Math.floor((ahora.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
      if (dias < metricas.diasDesdeUltimaOrden) {
        metricas.diasDesdeUltimaOrden = dias;
      }
    });

    // Ranking por volumen de compras
    rankings.push({
      categoria: 'Mayor Volumen de Compras',
      proveedores: proveedores
        .map(p => ({
          proveedor: p,
          posicion: 0,
          valor: metricasPorProveedor.get(p.id)?.montoTotalUSD || 0,
          insight: `USD ${(metricasPorProveedor.get(p.id)?.montoTotalUSD || 0).toLocaleString()}`
        }))
        .filter(p => p.valor > 0)
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10)
        .map((p, i) => ({ ...p, posicion: i + 1 }))
    });

    // Ranking por evaluación
    rankings.push({
      categoria: 'Mejor Evaluación',
      proveedores: proveedores
        .filter(p => p.evaluacion && p.evaluacion.puntuacion > 0)
        .map(p => ({
          proveedor: p,
          posicion: 0,
          valor: p.evaluacion?.puntuacion || 0,
          insight: `${p.evaluacion?.puntuacion.toFixed(1)}/100 - ${p.evaluacion?.clasificacion}`
        }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10)
        .map((p, i) => ({ ...p, posicion: i + 1 }))
    });

    // Ranking por frecuencia de compra
    rankings.push({
      categoria: 'Mayor Frecuencia',
      proveedores: proveedores
        .map(p => ({
          proveedor: p,
          posicion: 0,
          valor: metricasPorProveedor.get(p.id)?.ordenesCompra || 0,
          insight: `${metricasPorProveedor.get(p.id)?.ordenesCompra || 0} órdenes`
        }))
        .filter(p => p.valor > 0)
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10)
        .map((p, i) => ({ ...p, posicion: i + 1 }))
    });

    // Ranking por variedad de productos
    rankings.push({
      categoria: 'Mayor Variedad',
      proveedores: proveedores
        .map(p => ({
          proveedor: p,
          posicion: 0,
          valor: metricasPorProveedor.get(p.id)?.productosDistintos.size || 0,
          insight: `${metricasPorProveedor.get(p.id)?.productosDistintos.size || 0} productos`
        }))
        .filter(p => p.valor > 0)
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10)
        .map((p, i) => ({ ...p, posicion: i + 1 }))
    });

    return rankings;
  },

  /**
   * Obtiene productos compartidos entre proveedores para comparar precios
   */
  getProductosCompartidos(
    ordenesCompra: OrdenCompra[],
    minProveedores: number = 2
  ): string[] {
    const productoProveedores = new Map<string, Set<string>>();

    ordenesCompra.forEach(oc => {
      oc.productos.forEach(p => {
        if (!productoProveedores.has(p.productoId)) {
          productoProveedores.set(p.productoId, new Set());
        }
        productoProveedores.get(p.productoId)!.add(oc.proveedorId);
      });
    });

    return Array.from(productoProveedores.entries())
      .filter(([_, provs]) => provs.size >= minProveedores)
      .map(([prodId]) => prodId);
  }
};
