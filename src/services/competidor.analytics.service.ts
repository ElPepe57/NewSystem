/**
 * Servicio de Analytics Avanzado para Competidores
 * Proporciona análisis de precios, tendencias, nivel de amenaza y recomendaciones estratégicas
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
import type { Competidor } from '../types/entidadesMaestras.types';
import type { Producto } from '../types/producto.types';

// ============================================
// TIPOS PARA ANALYTICS DE COMPETIDORES
// ============================================

/**
 * Análisis de precio de un producto vs competidor
 */
export interface AnalisisPrecio {
  productoId: string;
  sku: string;
  nombreProducto: string;
  marca: string;
  categoria: string;
  fechaAnalisis: Date;
  precioCompetidor: number;
  nuestroPrecio: number;
  diferenciaPorcentaje: number;
  diferenciaAbsoluta: number;
  ventajaCompetitiva: 'nosotros' | 'competidor' | 'igual';
  plataforma: string;
  urlProducto?: string;
  disponibleCompetidor: boolean;
}

/**
 * Historial de precio de un producto
 */
export interface HistorialPrecio {
  fecha: Date;
  productoId: string;
  sku: string;
  precio: number;
  plataforma: string;
  disponible: boolean;
  observaciones?: string;
}

/**
 * Tendencia de precio de un producto
 */
export interface TendenciaPrecio {
  productoId: string;
  sku: string;
  nombreProducto: string;
  marca: string;
  precioInicial: number;
  precioActual: number;
  precioMinimo: number;
  precioMaximo: number;
  variacionPorcentaje: number;
  tendencia: 'subiendo' | 'bajando' | 'estable';
  volatilidad: 'alta' | 'media' | 'baja';
  historial: Array<{ fecha: Date; precio: number }>;
}

/**
 * Análisis por plataforma
 */
export interface AnalisisPlataforma {
  plataforma: string;
  productosAnalizados: number;
  precioPromedio: number;
  diferenciaPromedioVsNosotros: number;
  productosConVentaja: number;
  productosConDesventaja: number;
  reputacionPlataforma: number;
  ultimoAnalisis?: Date;
  activo: boolean;
}

/**
 * Fortaleza o debilidad detectada
 */
export interface FortalezaDebilidad {
  id: string;
  tipo: 'fortaleza' | 'debilidad';
  categoria: 'precio' | 'variedad' | 'reputacion' | 'servicio' | 'disponibilidad' | 'marca';
  titulo: string;
  descripcion: string;
  impacto: 'alto' | 'medio' | 'bajo';
  productosAfectados: number;
  valorAfectadoUSD?: number;
  evidencia?: string;
}

/**
 * Comparativa entre competidores
 */
export interface ComparativaCompetidores {
  competidorId: string;
  nombre: string;
  plataformas: string[];
  productosEnComun: number;
  precioPromedioVsNosotros: number;
  nivelAmenaza: 'alto' | 'medio' | 'bajo';
  nivelAmenazaScore: number;
  reputacion: number;
  ventajasNuestras: number;
  ventajasSuyas: number;
  ranking: number;
  tendencia: 'creciendo' | 'estable' | 'decreciendo';
}

/**
 * Alerta de competencia
 */
export interface AlertaCompetencia {
  id: string;
  tipo: 'precio_bajo' | 'nuevo_producto' | 'promocion' | 'reputacion' | 'actividad' | 'stock';
  severidad: 'info' | 'warning' | 'danger';
  fecha: Date;
  competidorId: string;
  competidorNombre: string;
  mensaje: string;
  detalle?: string;
  productoAfectado?: {
    id: string;
    sku: string;
    nombre: string;
  };
  impactoEstimadoUSD?: number;
  accionRecomendada?: string;
  atendida: boolean;
}

/**
 * Recomendación estratégica
 */
export interface RecomendacionEstrategica {
  id: string;
  tipo: 'precio' | 'producto' | 'marketing' | 'estrategia' | 'inventario';
  prioridad: 'alta' | 'media' | 'baja';
  titulo: string;
  descripcion: string;
  impactoEstimado: string;
  productosRelacionados: string[];
  accionesConcretas: string[];
  fechaGeneracion: Date;
}

/**
 * Factores de nivel de amenaza
 */
export interface FactoresAmenaza {
  precioCompetitivo: number;      // 0-100: qué tan competitivos son sus precios
  variedadProductos: number;      // 0-100: variedad de productos que ofrece
  reputacion: number;             // 0-100: reputación en el mercado
  actividadReciente: number;      // 0-100: qué tan activo está
  crecimiento: number;            // 0-100: tendencia de crecimiento
  disponibilidadStock: number;    // 0-100: disponibilidad de productos
}

/**
 * Actividad del competidor
 */
export interface ActividadCompetidor {
  fecha: Date;
  tipo: 'cambio_precio' | 'nuevo_producto' | 'promocion' | 'cambio_stock';
  descripcion: string;
  productoId?: string;
  valorAnterior?: number;
  valorNuevo?: number;
  impacto: 'alto' | 'medio' | 'bajo';
}

// ============================================
// ANALYTICS COMPLETO
// ============================================

export interface CompetidorAnalytics {
  competidor: Competidor;

  // Análisis de precios
  analisisPreciosActual: AnalisisPrecio[];
  productosAnalizados: number;
  productosMasBaratos: number;
  productosMasCaros: number;
  productosIgualPrecio: number;
  diferenciaPromedioGlobal: number;
  ahorroClientePotencial: number;

  // Historial y tendencias de precios
  historialPrecios: HistorialPrecio[];
  tendenciasPrecios: TendenciaPrecio[];
  tendenciaGeneralPrecios: 'subiendo' | 'bajando' | 'estable';
  volatilidadGeneral: 'alta' | 'media' | 'baja';

  // Análisis por plataforma
  analisisPorPlataforma: AnalisisPlataforma[];
  plataformaPrincipal: string;
  plataformasActivas: number;

  // Fortalezas y debilidades
  fortalezas: FortalezaDebilidad[];
  debilidades: FortalezaDebilidad[];
  scoreCompetitivoNuestro: number;
  scoreCompetitivoSuyo: number;

  // Métricas de amenaza
  nivelAmenaza: 'alto' | 'medio' | 'bajo';
  nivelAmenazaScore: number;
  factoresAmenaza: FactoresAmenaza;
  tendenciaAmenaza: 'aumentando' | 'estable' | 'disminuyendo';

  // Actividad
  actividadReciente: ActividadCompetidor[];
  ultimoAnalisis?: Date;
  diasSinAnalisis: number;
  frecuenciaAnalisisPromedio: number;
  totalAnalisisHistoricos: number;

  // Comparativa
  comparativaCompetidores: ComparativaCompetidores[];
  rankingAmenaza: number;
  totalCompetidores: number;
  percentilAmenaza: number;

  // Alertas
  alertas: AlertaCompetencia[];
  alertasActivas: number;
  alertasCriticas: number;

  // Historial resumido
  historialAnalisis: Array<{
    fecha: Date;
    productosAnalizados: number;
    precioPromedio: number;
    diferenciaPromedio: number;
    nivelAmenaza: number;
  }>;

  // Recomendaciones
  recomendaciones: RecomendacionEstrategica[];
  recomendacionesPrioritarias: number;

  // Productos clave
  productosClave: Array<{
    productoId: string;
    sku: string;
    nombre: string;
    nuestroPrecio: number;
    precioCompetidor: number;
    diferencia: number;
    importanciaEstrategica: 'alta' | 'media' | 'baja';
    recomendacion: string;
  }>;

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

class CompetidorAnalyticsService {
  /**
   * Obtiene analytics completos de un competidor
   */
  async getCompetidorAnalytics(competidorId: string): Promise<CompetidorAnalytics | null> {
    try {
      // Obtener competidor
      const competidorDoc = await getDocs(
        query(collection(db, 'competidores'), where('__name__', '==', competidorId))
      );

      if (competidorDoc.empty) {
        console.error('Competidor no encontrado:', competidorId);
        return null;
      }

      const competidor = {
        id: competidorDoc.docs[0].id,
        ...competidorDoc.docs[0].data()
      } as Competidor;

      // Obtener datos relacionados
      const [
        productosData,
        todosCompetidoresData
      ] = await Promise.all([
        this.getProductosConPrecios(),
        this.getTodosCompetidores()
      ]);

      const ahora = new Date();
      const hace365Dias = new Date(ahora.getTime() - 365 * 24 * 60 * 60 * 1000);

      // Análisis de precios
      const analisisPreciosActual = this.analizarPrecios(competidor, productosData);
      const productosMasBaratos = analisisPreciosActual.filter(a => a.ventajaCompetitiva === 'competidor').length;
      const productosMasCaros = analisisPreciosActual.filter(a => a.ventajaCompetitiva === 'nosotros').length;
      const productosIgualPrecio = analisisPreciosActual.filter(a => a.ventajaCompetitiva === 'igual').length;

      // Diferencia promedio
      const diferenciaPromedioGlobal = this.calcularDiferenciaPromedio(analisisPreciosActual);

      // Ahorro potencial para clientes si compran al competidor
      const ahorroClientePotencial = analisisPreciosActual
        .filter(a => a.ventajaCompetitiva === 'competidor')
        .reduce((sum, a) => sum + a.diferenciaAbsoluta, 0);

      // Tendencias (simuladas sin historial real)
      const tendenciasPrecios = this.calcularTendenciasPrecios(analisisPreciosActual);
      const tendenciaGeneralPrecios = this.determinarTendenciaGeneral(tendenciasPrecios);

      // Análisis por plataforma
      const analisisPorPlataforma = this.analizarPorPlataforma(competidor, analisisPreciosActual);

      // Fortalezas y debilidades
      const { fortalezas, debilidades } = this.analizarFortalezasDebilidades(
        competidor,
        analisisPreciosActual,
        analisisPorPlataforma
      );

      // Score competitivo
      const scoreCompetitivoNuestro = this.calcularScoreCompetitivo(fortalezas.length, debilidades.length, true);
      const scoreCompetitivoSuyo = this.calcularScoreCompetitivo(debilidades.length, fortalezas.length, false);

      // Factores de amenaza
      const factoresAmenaza = this.calcularFactoresAmenaza(
        competidor,
        analisisPreciosActual,
        analisisPorPlataforma
      );
      const nivelAmenazaScore = this.calcularNivelAmenazaScore(factoresAmenaza);
      const nivelAmenaza = this.determinarNivelAmenaza(nivelAmenazaScore);

      // Actividad reciente (simulada)
      const actividadReciente = this.generarActividadReciente(competidor, analisisPreciosActual);

      // Días sin análisis
      const ultimoAnalisis = competidor.ultimoAnalisis instanceof Timestamp
        ? competidor.ultimoAnalisis.toDate()
        : undefined;
      const diasSinAnalisis = ultimoAnalisis
        ? Math.floor((ahora.getTime() - ultimoAnalisis.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // Comparativa con otros competidores
      const comparativaCompetidores = this.calcularComparativa(
        competidor,
        todosCompetidoresData,
        productosData
      );
      const rankingAmenaza = comparativaCompetidores.find(c => c.competidorId === competidorId)?.ranking || 0;

      // Alertas
      const alertas = this.generarAlertas(
        competidor,
        analisisPreciosActual,
        factoresAmenaza,
        diasSinAnalisis
      );

      // Recomendaciones
      const recomendaciones = this.generarRecomendaciones(
        competidor,
        analisisPreciosActual,
        fortalezas,
        debilidades,
        factoresAmenaza
      );

      // Productos clave
      const productosClave = this.identificarProductosClave(analisisPreciosActual);

      return {
        competidor,

        analisisPreciosActual,
        productosAnalizados: analisisPreciosActual.length,
        productosMasBaratos,
        productosMasCaros,
        productosIgualPrecio,
        diferenciaPromedioGlobal,
        ahorroClientePotencial,

        historialPrecios: [], // Se implementaría con colección de historial
        tendenciasPrecios,
        tendenciaGeneralPrecios,
        volatilidadGeneral: 'media',

        analisisPorPlataforma,
        plataformaPrincipal: analisisPorPlataforma[0]?.plataforma || competidor.plataforma || 'desconocida',
        plataformasActivas: analisisPorPlataforma.filter(p => p.activo).length,

        fortalezas,
        debilidades,
        scoreCompetitivoNuestro,
        scoreCompetitivoSuyo,

        nivelAmenaza,
        nivelAmenazaScore,
        factoresAmenaza,
        tendenciaAmenaza: 'estable',

        actividadReciente,
        ultimoAnalisis,
        diasSinAnalisis,
        frecuenciaAnalisisPromedio: 7,
        totalAnalisisHistoricos: competidor.metricas?.productosAnalizados || 0,

        comparativaCompetidores,
        rankingAmenaza,
        totalCompetidores: todosCompetidoresData.length,
        percentilAmenaza: todosCompetidoresData.length > 0
          ? Math.round((rankingAmenaza / todosCompetidoresData.length) * 100)
          : 0,

        alertas,
        alertasActivas: alertas.filter(a => !a.atendida).length,
        alertasCriticas: alertas.filter(a => a.severidad === 'danger' && !a.atendida).length,

        historialAnalisis: [],

        recomendaciones,
        recomendacionesPrioritarias: recomendaciones.filter(r => r.prioridad === 'alta').length,

        productosClave,

        fechaAnalisis: ahora,
        periodoAnalisis: {
          desde: hace365Dias,
          hasta: ahora
        }
      };
    } catch (error) {
      console.error('Error obteniendo analytics de competidor:', error);
      throw error;
    }
  }

  /**
   * Obtiene productos con sus precios
   */
  private async getProductosConPrecios(): Promise<Producto[]> {
    const snapshot = await getDocs(collection(db, 'productos'));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Producto[];
  }

  /**
   * Obtiene todos los competidores
   */
  private async getTodosCompetidores(): Promise<Competidor[]> {
    const snapshot = await getDocs(collection(db, 'competidores'));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Competidor[];
  }

  /**
   * Analiza precios del competidor vs nuestros productos
   */
  private analizarPrecios(competidor: Competidor, productos: Producto[]): AnalisisPrecio[] {
    const analisis: AnalisisPrecio[] = [];
    const ahora = new Date();

    // Por cada producto nuestro, buscar si hay info del competidor
    productos.forEach(producto => {
      // Buscar precio del competidor en los datos del producto
      const competidorPeru = producto.competidoresPeru?.find(
        c => c.competidorId === competidor.id || c.nombre?.toLowerCase().includes(competidor.nombre.toLowerCase())
      );

      if (competidorPeru && competidorPeru.precio && competidorPeru.precio > 0) {
        const nuestroPrecio = producto.precioVentaPEN || 0;
        const precioCompetidor = competidorPeru.precio;
        const diferencia = nuestroPrecio - precioCompetidor;
        const diferenciaPorcentaje = nuestroPrecio > 0 ? (diferencia / nuestroPrecio) * 100 : 0;

        let ventaja: 'nosotros' | 'competidor' | 'igual' = 'igual';
        if (Math.abs(diferenciaPorcentaje) < 2) ventaja = 'igual';
        else if (diferencia > 0) ventaja = 'competidor'; // Ellos más baratos
        else ventaja = 'nosotros'; // Nosotros más baratos

        analisis.push({
          productoId: producto.id,
          sku: producto.sku,
          nombreProducto: producto.nombreComercial || producto.sku,
          marca: producto.marca || '',
          categoria: producto.grupo || '',
          fechaAnalisis: ahora,
          precioCompetidor,
          nuestroPrecio,
          diferenciaPorcentaje,
          diferenciaAbsoluta: Math.abs(diferencia),
          ventajaCompetitiva: ventaja,
          plataforma: competidorPeru.plataforma || competidor.plataforma || 'mercado_libre',
          urlProducto: competidorPeru.url,
          disponibleCompetidor: true
        });
      }
    });

    return analisis.sort((a, b) => Math.abs(b.diferenciaPorcentaje) - Math.abs(a.diferenciaPorcentaje));
  }

  /**
   * Calcula diferencia promedio de precios
   */
  private calcularDiferenciaPromedio(analisis: AnalisisPrecio[]): number {
    if (analisis.length === 0) return 0;
    const suma = analisis.reduce((sum, a) => sum + a.diferenciaPorcentaje, 0);
    return suma / analisis.length;
  }

  /**
   * Calcula tendencias de precios
   */
  private calcularTendenciasPrecios(analisis: AnalisisPrecio[]): TendenciaPrecio[] {
    return analisis.slice(0, 20).map(a => ({
      productoId: a.productoId,
      sku: a.sku,
      nombreProducto: a.nombreProducto,
      marca: a.marca,
      precioInicial: a.precioCompetidor,
      precioActual: a.precioCompetidor,
      precioMinimo: a.precioCompetidor * 0.95,
      precioMaximo: a.precioCompetidor * 1.05,
      variacionPorcentaje: 0,
      tendencia: 'estable' as const,
      volatilidad: 'baja' as const,
      historial: [{ fecha: a.fechaAnalisis, precio: a.precioCompetidor }]
    }));
  }

  /**
   * Determina tendencia general
   */
  private determinarTendenciaGeneral(tendencias: TendenciaPrecio[]): 'subiendo' | 'bajando' | 'estable' {
    if (tendencias.length === 0) return 'estable';

    const subiendo = tendencias.filter(t => t.tendencia === 'subiendo').length;
    const bajando = tendencias.filter(t => t.tendencia === 'bajando').length;

    if (subiendo > bajando + 3) return 'subiendo';
    if (bajando > subiendo + 3) return 'bajando';
    return 'estable';
  }

  /**
   * Analiza por plataforma
   */
  private analizarPorPlataforma(
    competidor: Competidor,
    analisis: AnalisisPrecio[]
  ): AnalisisPlataforma[] {
    const plataformasMap = new Map<string, {
      productos: AnalisisPrecio[];
      total: number;
    }>();

    analisis.forEach(a => {
      const plataforma = a.plataforma || 'desconocida';
      const existing = plataformasMap.get(plataforma);
      if (existing) {
        existing.productos.push(a);
        existing.total++;
      } else {
        plataformasMap.set(plataforma, { productos: [a], total: 1 });
      }
    });

    // Si no hay análisis, usar la plataforma del competidor
    if (plataformasMap.size === 0 && competidor.plataforma) {
      plataformasMap.set(competidor.plataforma, { productos: [], total: 0 });
    }

    return Array.from(plataformasMap.entries()).map(([plataforma, data]) => {
      const precioPromedio = data.productos.length > 0
        ? data.productos.reduce((sum, p) => sum + p.precioCompetidor, 0) / data.productos.length
        : 0;
      const diferenciaPromedio = data.productos.length > 0
        ? data.productos.reduce((sum, p) => sum + p.diferenciaPorcentaje, 0) / data.productos.length
        : 0;

      return {
        plataforma,
        productosAnalizados: data.total,
        precioPromedio,
        diferenciaPromedioVsNosotros: diferenciaPromedio,
        productosConVentaja: data.productos.filter(p => p.ventajaCompetitiva === 'nosotros').length,
        productosConDesventaja: data.productos.filter(p => p.ventajaCompetitiva === 'competidor').length,
        reputacionPlataforma: competidor.metricas?.reputacion || 80,
        ultimoAnalisis: data.productos[0]?.fechaAnalisis,
        activo: true
      };
    }).sort((a, b) => b.productosAnalizados - a.productosAnalizados);
  }

  /**
   * Analiza fortalezas y debilidades
   */
  private analizarFortalezasDebilidades(
    competidor: Competidor,
    analisis: AnalisisPrecio[],
    plataformas: AnalisisPlataforma[]
  ): { fortalezas: FortalezaDebilidad[]; debilidades: FortalezaDebilidad[] } {
    const fortalezas: FortalezaDebilidad[] = [];
    const debilidades: FortalezaDebilidad[] = [];
    let idCounter = 1;

    // Análisis de precios
    const productosMasBaratos = analisis.filter(a => a.ventajaCompetitiva === 'competidor').length;
    const productosMasCaros = analisis.filter(a => a.ventajaCompetitiva === 'nosotros').length;
    const totalProductos = analisis.length;

    if (totalProductos > 0) {
      const porcentajeMasBaratos = (productosMasBaratos / totalProductos) * 100;
      const porcentajeMasCaros = (productosMasCaros / totalProductos) * 100;

      if (porcentajeMasBaratos > 60) {
        debilidades.push({
          id: `fd-${idCounter++}`,
          tipo: 'debilidad',
          categoria: 'precio',
          titulo: 'Precios más competitivos',
          descripcion: `El competidor tiene precios más bajos en ${productosMasBaratos} productos (${porcentajeMasBaratos.toFixed(1)}%)`,
          impacto: porcentajeMasBaratos > 75 ? 'alto' : 'medio',
          productosAfectados: productosMasBaratos
        });
      } else if (porcentajeMasCaros > 60) {
        fortalezas.push({
          id: `fd-${idCounter++}`,
          tipo: 'fortaleza',
          categoria: 'precio',
          titulo: 'Nuestros precios son más competitivos',
          descripcion: `Tenemos precios más bajos en ${productosMasCaros} productos (${porcentajeMasCaros.toFixed(1)}%)`,
          impacto: porcentajeMasCaros > 75 ? 'alto' : 'medio',
          productosAfectados: productosMasCaros
        });
      }
    }

    // Análisis de reputación
    const reputacion = competidor.metricas?.reputacion || 0;
    if (reputacion >= 90) {
      debilidades.push({
        id: `fd-${idCounter++}`,
        tipo: 'debilidad',
        categoria: 'reputacion',
        titulo: 'Alta reputación del competidor',
        descripcion: `El competidor tiene una reputación de ${reputacion}/100`,
        impacto: 'alto',
        productosAfectados: totalProductos
      });
    } else if (reputacion < 70) {
      fortalezas.push({
        id: `fd-${idCounter++}`,
        tipo: 'fortaleza',
        categoria: 'reputacion',
        titulo: 'Baja reputación del competidor',
        descripcion: `El competidor tiene una reputación de solo ${reputacion}/100`,
        impacto: reputacion < 50 ? 'alto' : 'medio',
        productosAfectados: totalProductos
      });
    }

    // Análisis de variedad
    const productosAnalizados = competidor.metricas?.productosAnalizados || 0;
    if (productosAnalizados > 50) {
      debilidades.push({
        id: `fd-${idCounter++}`,
        tipo: 'debilidad',
        categoria: 'variedad',
        titulo: 'Amplia variedad de productos',
        descripcion: `El competidor tiene ${productosAnalizados} productos analizados`,
        impacto: productosAnalizados > 100 ? 'alto' : 'medio',
        productosAfectados: productosAnalizados
      });
    } else if (productosAnalizados < 10) {
      fortalezas.push({
        id: `fd-${idCounter++}`,
        tipo: 'fortaleza',
        categoria: 'variedad',
        titulo: 'Variedad limitada del competidor',
        descripcion: `El competidor solo tiene ${productosAnalizados} productos`,
        impacto: 'medio',
        productosAfectados: productosAnalizados
      });
    }

    // Análisis de disponibilidad
    const productosDisponibles = analisis.filter(a => a.disponibleCompetidor).length;
    const tasaDisponibilidad = totalProductos > 0 ? (productosDisponibles / totalProductos) * 100 : 0;

    if (tasaDisponibilidad < 80) {
      fortalezas.push({
        id: `fd-${idCounter++}`,
        tipo: 'fortaleza',
        categoria: 'disponibilidad',
        titulo: 'Problemas de stock del competidor',
        descripcion: `Solo ${tasaDisponibilidad.toFixed(1)}% de productos disponibles`,
        impacto: tasaDisponibilidad < 60 ? 'alto' : 'medio',
        productosAfectados: totalProductos - productosDisponibles
      });
    }

    return { fortalezas, debilidades };
  }

  /**
   * Calcula score competitivo
   */
  private calcularScoreCompetitivo(ventajas: number, desventajas: number, esNuestro: boolean): number {
    const total = ventajas + desventajas;
    if (total === 0) return 50;

    const base = (ventajas / total) * 100;
    return Math.min(100, Math.max(0, Math.round(base)));
  }

  /**
   * Calcula factores de amenaza
   */
  private calcularFactoresAmenaza(
    competidor: Competidor,
    analisis: AnalisisPrecio[],
    plataformas: AnalisisPlataforma[]
  ): FactoresAmenaza {
    const totalProductos = analisis.length || 1;
    const productosMasBaratos = analisis.filter(a => a.ventajaCompetitiva === 'competidor').length;

    // Precio competitivo: % de productos donde son más baratos
    const precioCompetitivo = Math.round((productosMasBaratos / totalProductos) * 100);

    // Variedad: basado en productos analizados
    const productosAnalizados = competidor.metricas?.productosAnalizados || 0;
    const variedadProductos = Math.min(100, productosAnalizados * 2);

    // Reputación
    const reputacion = competidor.metricas?.reputacion || 50;

    // Actividad reciente: basado en último análisis
    const ultimoAnalisis = competidor.ultimoAnalisis instanceof Timestamp
      ? competidor.ultimoAnalisis.toDate()
      : undefined;
    const diasSinActividad = ultimoAnalisis
      ? Math.floor((new Date().getTime() - ultimoAnalisis.getTime()) / (1000 * 60 * 60 * 24))
      : 30;
    const actividadReciente = Math.max(0, 100 - diasSinActividad * 3);

    // Crecimiento: simulado
    const crecimiento = 50;

    // Disponibilidad de stock
    const productosDisponibles = analisis.filter(a => a.disponibleCompetidor).length;
    const disponibilidadStock = Math.round((productosDisponibles / totalProductos) * 100);

    return {
      precioCompetitivo,
      variedadProductos,
      reputacion,
      actividadReciente,
      crecimiento,
      disponibilidadStock
    };
  }

  /**
   * Calcula score de nivel de amenaza
   */
  private calcularNivelAmenazaScore(factores: FactoresAmenaza): number {
    // Ponderación de factores
    const pesos = {
      precioCompetitivo: 0.30,
      variedadProductos: 0.15,
      reputacion: 0.25,
      actividadReciente: 0.10,
      crecimiento: 0.10,
      disponibilidadStock: 0.10
    };

    let score = 0;
    score += factores.precioCompetitivo * pesos.precioCompetitivo;
    score += factores.variedadProductos * pesos.variedadProductos;
    score += factores.reputacion * pesos.reputacion;
    score += factores.actividadReciente * pesos.actividadReciente;
    score += factores.crecimiento * pesos.crecimiento;
    score += factores.disponibilidadStock * pesos.disponibilidadStock;

    return Math.round(score);
  }

  /**
   * Determina nivel de amenaza
   */
  private determinarNivelAmenaza(score: number): 'alto' | 'medio' | 'bajo' {
    if (score >= 70) return 'alto';
    if (score >= 40) return 'medio';
    return 'bajo';
  }

  /**
   * Genera actividad reciente simulada
   */
  private generarActividadReciente(
    competidor: Competidor,
    analisis: AnalisisPrecio[]
  ): ActividadCompetidor[] {
    const actividades: ActividadCompetidor[] = [];
    const ahora = new Date();

    // Simular algunas actividades basadas en el análisis
    if (analisis.length > 0) {
      actividades.push({
        fecha: ahora,
        tipo: 'cambio_precio',
        descripcion: `Análisis de ${analisis.length} productos`,
        impacto: 'medio'
      });
    }

    return actividades;
  }

  /**
   * Calcula comparativa con otros competidores
   */
  private calcularComparativa(
    competidorActual: Competidor,
    todosCompetidores: Competidor[],
    productos: Producto[]
  ): ComparativaCompetidores[] {
    const comparativas = todosCompetidores
      .filter(c => c.estado === 'activo')
      .map(c => {
        const analisis = this.analizarPrecios(c, productos);
        const productosEnComun = analisis.length;
        const productosMasBaratos = analisis.filter(a => a.ventajaCompetitiva === 'competidor').length;
        const productosMasCaros = analisis.filter(a => a.ventajaCompetitiva === 'nosotros').length;
        const diferenciaPromedio = this.calcularDiferenciaPromedio(analisis);

        const factores = this.calcularFactoresAmenaza(c, analisis, []);
        const nivelAmenazaScore = this.calcularNivelAmenazaScore(factores);

        return {
          competidorId: c.id,
          nombre: c.nombre,
          plataformas: c.plataforma ? [c.plataforma] : [],
          productosEnComun,
          precioPromedioVsNosotros: diferenciaPromedio,
          nivelAmenaza: this.determinarNivelAmenaza(nivelAmenazaScore),
          nivelAmenazaScore,
          reputacion: c.metricas?.reputacion || 0,
          ventajasNuestras: productosMasCaros,
          ventajasSuyas: productosMasBaratos,
          ranking: 0,
          tendencia: 'estable' as const
        };
      });

    // Ordenar por nivel de amenaza y asignar ranking
    comparativas.sort((a, b) => b.nivelAmenazaScore - a.nivelAmenazaScore);
    comparativas.forEach((c, idx) => {
      c.ranking = idx + 1;
    });

    return comparativas;
  }

  /**
   * Genera alertas
   */
  private generarAlertas(
    competidor: Competidor,
    analisis: AnalisisPrecio[],
    factores: FactoresAmenaza,
    diasSinAnalisis: number
  ): AlertaCompetencia[] {
    const alertas: AlertaCompetencia[] = [];
    const ahora = new Date();
    let idCounter = 1;

    // Alerta de precios agresivos
    const productosMuyBaratos = analisis.filter(a => a.diferenciaPorcentaje > 20);
    if (productosMuyBaratos.length > 0) {
      alertas.push({
        id: `alert-${idCounter++}`,
        tipo: 'precio_bajo',
        severidad: productosMuyBaratos.length > 5 ? 'danger' : 'warning',
        fecha: ahora,
        competidorId: competidor.id,
        competidorNombre: competidor.nombre,
        mensaje: `${productosMuyBaratos.length} productos con precios 20%+ más bajos`,
        detalle: productosMuyBaratos.slice(0, 3).map(p => p.sku).join(', '),
        accionRecomendada: 'Revisar estrategia de precios',
        atendida: false
      });
    }

    // Alerta de alta amenaza
    if (factores.precioCompetitivo > 70 && factores.reputacion > 80) {
      alertas.push({
        id: `alert-${idCounter++}`,
        tipo: 'actividad',
        severidad: 'danger',
        fecha: ahora,
        competidorId: competidor.id,
        competidorNombre: competidor.nombre,
        mensaje: 'Competidor de alta amenaza detectado',
        detalle: `Precios competitivos: ${factores.precioCompetitivo}%, Reputación: ${factores.reputacion}%`,
        accionRecomendada: 'Monitorear de cerca y ajustar estrategia',
        atendida: false
      });
    }

    // Alerta de falta de análisis
    if (diasSinAnalisis > 14) {
      alertas.push({
        id: `alert-${idCounter++}`,
        tipo: 'actividad',
        severidad: diasSinAnalisis > 30 ? 'warning' : 'info',
        fecha: ahora,
        competidorId: competidor.id,
        competidorNombre: competidor.nombre,
        mensaje: `${diasSinAnalisis} días sin analizar este competidor`,
        accionRecomendada: 'Actualizar análisis de precios',
        atendida: false
      });
    }

    return alertas.sort((a, b) => {
      const severidadOrden = { danger: 0, warning: 1, info: 2 };
      return severidadOrden[a.severidad] - severidadOrden[b.severidad];
    });
  }

  /**
   * Genera recomendaciones estratégicas
   */
  private generarRecomendaciones(
    competidor: Competidor,
    analisis: AnalisisPrecio[],
    fortalezas: FortalezaDebilidad[],
    debilidades: FortalezaDebilidad[],
    factores: FactoresAmenaza
  ): RecomendacionEstrategica[] {
    const recomendaciones: RecomendacionEstrategica[] = [];
    const ahora = new Date();
    let idCounter = 1;

    // Recomendación de precios
    const productosMasBaratos = analisis.filter(a => a.ventajaCompetitiva === 'competidor');
    if (productosMasBaratos.length > 5) {
      recomendaciones.push({
        id: `rec-${idCounter++}`,
        tipo: 'precio',
        prioridad: productosMasBaratos.length > 10 ? 'alta' : 'media',
        titulo: 'Revisar estrategia de precios',
        descripcion: `El competidor tiene precios más bajos en ${productosMasBaratos.length} productos`,
        impactoEstimado: 'Potencial pérdida de ventas en productos afectados',
        productosRelacionados: productosMasBaratos.slice(0, 10).map(p => p.sku),
        accionesConcretas: [
          'Analizar márgenes de los productos afectados',
          'Evaluar promociones temporales',
          'Considerar ajuste de precios en productos clave'
        ],
        fechaGeneracion: ahora
      });
    }

    // Recomendación de diferenciación
    if (factores.reputacion > 80) {
      recomendaciones.push({
        id: `rec-${idCounter++}`,
        tipo: 'estrategia',
        prioridad: 'media',
        titulo: 'Fortalecer diferenciación',
        descripcion: 'El competidor tiene alta reputación, enfocarse en otros diferenciadores',
        impactoEstimado: 'Mejora en retención de clientes',
        productosRelacionados: [],
        accionesConcretas: [
          'Mejorar servicio al cliente',
          'Ofrecer garantías adicionales',
          'Desarrollar programa de fidelización'
        ],
        fechaGeneracion: ahora
      });
    }

    // Recomendación de monitoreo
    recomendaciones.push({
      id: `rec-${idCounter++}`,
      tipo: 'estrategia',
      prioridad: 'baja',
      titulo: 'Mantener monitoreo activo',
      descripcion: 'Continuar monitoreando precios y actividad del competidor',
      impactoEstimado: 'Detección temprana de cambios en el mercado',
      productosRelacionados: [],
      accionesConcretas: [
        'Actualizar análisis de precios semanalmente',
        'Configurar alertas de cambios significativos',
        'Documentar patrones de comportamiento'
      ],
      fechaGeneracion: ahora
    });

    return recomendaciones.sort((a, b) => {
      const prioridadOrden = { alta: 0, media: 1, baja: 2 };
      return prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad];
    });
  }

  /**
   * Identifica productos clave
   */
  private identificarProductosClave(analisis: AnalisisPrecio[]): CompetidorAnalytics['productosClave'] {
    // Productos con mayor diferencia de precio
    return analisis
      .sort((a, b) => Math.abs(b.diferenciaPorcentaje) - Math.abs(a.diferenciaPorcentaje))
      .slice(0, 10)
      .map(a => ({
        productoId: a.productoId,
        sku: a.sku,
        nombre: a.nombreProducto,
        nuestroPrecio: a.nuestroPrecio,
        precioCompetidor: a.precioCompetidor,
        diferencia: a.diferenciaPorcentaje,
        importanciaEstrategica: Math.abs(a.diferenciaPorcentaje) > 30 ? 'alta' as const :
                               Math.abs(a.diferenciaPorcentaje) > 15 ? 'media' as const : 'baja' as const,
        recomendacion: a.ventajaCompetitiva === 'competidor'
          ? 'Considerar ajuste de precio'
          : a.ventajaCompetitiva === 'nosotros'
          ? 'Mantener ventaja competitiva'
          : 'Monitorear cambios'
      }));
  }

  /**
   * Compara múltiples competidores
   */
  async compararCompetidores(competidorIds?: string[]): Promise<ComparativaCompetidores[]> {
    const [todosCompetidores, productos] = await Promise.all([
      this.getTodosCompetidores(),
      this.getProductosConPrecios()
    ]);

    const competidoresFiltrados = competidorIds
      ? todosCompetidores.filter(c => competidorIds.includes(c.id))
      : todosCompetidores.filter(c => c.estado === 'activo');

    const comparativas = competidoresFiltrados.map(c => {
      const analisis = this.analizarPrecios(c, productos);
      const factores = this.calcularFactoresAmenaza(c, analisis, []);
      const nivelAmenazaScore = this.calcularNivelAmenazaScore(factores);

      return {
        competidorId: c.id,
        nombre: c.nombre,
        plataformas: c.plataforma ? [c.plataforma] : [],
        productosEnComun: analisis.length,
        precioPromedioVsNosotros: this.calcularDiferenciaPromedio(analisis),
        nivelAmenaza: this.determinarNivelAmenaza(nivelAmenazaScore),
        nivelAmenazaScore,
        reputacion: c.metricas?.reputacion || 0,
        ventajasNuestras: analisis.filter(a => a.ventajaCompetitiva === 'nosotros').length,
        ventajasSuyas: analisis.filter(a => a.ventajaCompetitiva === 'competidor').length,
        ranking: 0,
        tendencia: 'estable' as const
      };
    });

    comparativas.sort((a, b) => b.nivelAmenazaScore - a.nivelAmenazaScore);
    comparativas.forEach((c, idx) => {
      c.ranking = idx + 1;
    });

    return comparativas;
  }
}

export const competidorAnalyticsService = new CompetidorAnalyticsService();
