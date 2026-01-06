import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Producto, Unidad } from '../types/producto.types';
import type { Venta } from '../types/venta.types';

// ============ TIPOS ============

export interface ClasificacionMetricas {
  // Productos
  totalProductos: number;
  productosActivos: number;
  productosInactivos: number;

  // Stock
  stockTotal: number;
  stockPeru: number;
  stockUSA: number;
  stockTransito: number;
  valorInventario: number; // Stock * CTRU promedio
  productosStockCritico: number;
  productosAgotados: number;

  // Ventas (periodo)
  unidadesVendidas: number;
  ventasTotalPEN: number;
  costoTotalPEN: number;
  utilidadBruta: number;
  margenPromedio: number;
  ticketPromedio: number;
  numeroVentas: number;

  // Comparativo
  participacionVentas: number; // % del total de ventas
  participacionUnidades: number; // % del total de unidades

  // Productos destacados
  productoMasVendido?: { id: string; nombre: string; unidades: number };
  productoMasRentable?: { id: string; nombre: string; margen: number };
  productoMenosStock?: { id: string; nombre: string; stock: number };
}

export interface ProductoEnClasificacion {
  id: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  estado: string;
  stockPeru: number;
  stockUSA: number;
  ctruPromedio: number;
  precioSugerido: number;
  unidadesVendidas: number;
  ventasPEN: number;
  margen: number;
}

export interface ClasificacionAnalyticsResult {
  metricas: ClasificacionMetricas;
  productos: ProductoEnClasificacion[];
  tendenciaVentas: { fecha: string; ventas: number; unidades: number }[];
}

// ============ SERVICIO ============

class ClasificacionAnalyticsService {

  /**
   * Obtiene analytics para un Tipo de Producto específico
   */
  async getAnalyticsTipoProducto(
    tipoProductoId: string,
    fechaInicio?: Date,
    fechaFin?: Date
  ): Promise<ClasificacionAnalyticsResult> {
    // Obtener productos del tipo
    const productosQuery = query(
      collection(db, 'productos'),
      where('tipoProductoId', '==', tipoProductoId)
    );
    const productosSnap = await getDocs(productosQuery);
    const productos = productosSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Producto[];

    return this.calcularAnalytics(productos, fechaInicio, fechaFin);
  }

  /**
   * Obtiene analytics para una Categoría específica
   */
  async getAnalyticsCategoria(
    categoriaId: string,
    fechaInicio?: Date,
    fechaFin?: Date
  ): Promise<ClasificacionAnalyticsResult> {
    // Obtener productos de la categoría
    const productosQuery = query(
      collection(db, 'productos'),
      where('categoriaIds', 'array-contains', categoriaId)
    );
    const productosSnap = await getDocs(productosQuery);
    const productos = productosSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Producto[];

    return this.calcularAnalytics(productos, fechaInicio, fechaFin);
  }

  /**
   * Obtiene analytics para una Etiqueta específica
   */
  async getAnalyticsEtiqueta(
    etiquetaId: string,
    fechaInicio?: Date,
    fechaFin?: Date
  ): Promise<ClasificacionAnalyticsResult> {
    // Obtener productos con la etiqueta
    const productosQuery = query(
      collection(db, 'productos'),
      where('etiquetaIds', 'array-contains', etiquetaId)
    );
    const productosSnap = await getDocs(productosQuery);
    const productos = productosSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Producto[];

    return this.calcularAnalytics(productos, fechaInicio, fechaFin);
  }

  /**
   * Calcula analytics para un conjunto de productos
   */
  private async calcularAnalytics(
    productos: Producto[],
    fechaInicio?: Date,
    fechaFin?: Date
  ): Promise<ClasificacionAnalyticsResult> {
    const productIds = productos.map(p => p.id);

    // Si no hay productos, retornar métricas vacías
    if (productIds.length === 0) {
      return {
        metricas: this.getMetricasVacias(),
        productos: [],
        tendenciaVentas: []
      };
    }

    // Obtener ventas del periodo
    const ahora = new Date();
    const inicio = fechaInicio || new Date(ahora.getFullYear(), ahora.getMonth() - 3, 1); // Últimos 3 meses por defecto
    const fin = fechaFin || ahora;

    // Obtener todas las ventas del periodo
    const ventasQuery = query(
      collection(db, 'ventas'),
      where('fecha', '>=', Timestamp.fromDate(inicio)),
      where('fecha', '<=', Timestamp.fromDate(fin))
    );
    const ventasSnap = await getDocs(ventasQuery);
    const todasLasVentas = ventasSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Venta[];

    // ============ OBTENER STOCK REAL DESDE UNIDADES ============
    // Consultar unidades directamente para obtener stock actualizado
    const stockRealPorProducto = new Map<string, { peru: number; usa: number; transito: number; ctruTotal: number }>();

    // Inicializar todos los productos con stock 0
    for (const prodId of productIds) {
      stockRealPorProducto.set(prodId, { peru: 0, usa: 0, transito: 0, ctruTotal: 0 });
    }

    // Firestore no permite 'in' con más de 30 elementos, así que dividimos en chunks
    const chunkSize = 30;
    for (let i = 0; i < productIds.length; i += chunkSize) {
      const chunk = productIds.slice(i, i + chunkSize);
      const unidadesQuery = query(
        collection(db, 'unidades'),
        where('productoId', 'in', chunk)
      );
      const unidadesSnap = await getDocs(unidadesQuery);

      for (const docSnap of unidadesSnap.docs) {
        const unidad = docSnap.data() as Unidad;
        const stock = stockRealPorProducto.get(unidad.productoId);
        if (!stock) continue;

        // Solo contar unidades activas (no vendidas, vencidas, dañadas)
        switch (unidad.estado) {
          case 'recibida_usa':
            stock.usa++;
            stock.ctruTotal += unidad.ctruDinamico || unidad.ctruBase || 0;
            break;
          case 'disponible_peru':
            stock.peru++;
            stock.ctruTotal += unidad.ctruDinamico || unidad.ctruBase || 0;
            break;
          case 'en_transito_usa':
          case 'en_transito_peru':
            stock.transito++;
            stock.ctruTotal += unidad.ctruDinamico || unidad.ctruBase || 0;
            break;
          case 'asignada_pedido':
          case 'en_despacho':
            // Estas cuentan como stock Perú pero reservadas
            stock.peru++;
            stock.ctruTotal += unidad.ctruDinamico || unidad.ctruBase || 0;
            break;
          // Estados terminales no cuentan: vendida, entregada, devuelta, danada, vencida
        }
      }
    }

    // Filtrar items de ventas que corresponden a los productos
    const ventasProductos: Map<string, { unidades: number; ventas: number; costo: number }> = new Map();
    let totalVentasGeneral = 0;
    let totalUnidadesGeneral = 0;

    for (const venta of todasLasVentas) {
      if (venta.estado === 'anulada') continue;

      for (const item of venta.items || []) {
        totalVentasGeneral += item.subtotal || 0;
        totalUnidadesGeneral += item.cantidad || 0;

        if (productIds.includes(item.productoId)) {
          const current = ventasProductos.get(item.productoId) || { unidades: 0, ventas: 0, costo: 0 };
          current.unidades += item.cantidad || 0;
          current.ventas += item.subtotal || 0;
          current.costo += (item.ctru || 0) * (item.cantidad || 0);
          ventasProductos.set(item.productoId, current);
        }
      }
    }

    // Calcular métricas de productos
    let stockTotal = 0;
    let stockPeru = 0;
    let stockUSA = 0;
    let stockTransito = 0;
    let valorInventario = 0;
    let productosActivos = 0;
    let productosInactivos = 0;
    let productosStockCritico = 0;
    let productosAgotados = 0;

    const productosConMetricas: ProductoEnClasificacion[] = [];
    let productoMasVendido: { id: string; nombre: string; unidades: number } | undefined;
    let productoMasRentable: { id: string; nombre: string; margen: number } | undefined;
    let productoMenosStock: { id: string; nombre: string; stock: number } | undefined;

    for (const producto of productos) {
      // Stock - usar datos reales de unidades
      const stockReal = stockRealPorProducto.get(producto.id) || { peru: 0, usa: 0, transito: 0, ctruTotal: 0 };
      const pStock = stockReal.peru;
      const uStock = stockReal.usa;
      const tStock = stockReal.transito;
      const total = pStock + uStock + tStock;
      const ctruPromedioReal = total > 0 ? stockReal.ctruTotal / total : (producto.ctruPromedio || 0);

      stockPeru += pStock;
      stockUSA += uStock;
      stockTransito += tStock;
      stockTotal += total;
      valorInventario += stockReal.ctruTotal; // Usar valor real acumulado

      // Estado
      if (producto.estado === 'activo') {
        productosActivos++;
      } else {
        productosInactivos++;
      }

      // Stock crítico
      if (pStock <= (producto.stockMinimo || 0) && pStock > 0) {
        productosStockCritico++;
      }
      if (pStock === 0) {
        productosAgotados++;
      }

      // Ventas del producto
      const ventasProd = ventasProductos.get(producto.id) || { unidades: 0, ventas: 0, costo: 0 };
      const margen = ventasProd.ventas > 0
        ? ((ventasProd.ventas - ventasProd.costo) / ventasProd.ventas) * 100
        : 0;

      productosConMetricas.push({
        id: producto.id,
        sku: producto.sku,
        marca: producto.marca,
        nombreComercial: producto.nombreComercial,
        estado: producto.estado,
        stockPeru: pStock,
        stockUSA: uStock,
        ctruPromedio: ctruPromedioReal,
        precioSugerido: producto.precioSugerido || 0,
        unidadesVendidas: ventasProd.unidades,
        ventasPEN: ventasProd.ventas,
        margen
      });

      // Producto más vendido
      if (!productoMasVendido || ventasProd.unidades > productoMasVendido.unidades) {
        productoMasVendido = {
          id: producto.id,
          nombre: `${producto.marca} ${producto.nombreComercial}`,
          unidades: ventasProd.unidades
        };
      }

      // Producto más rentable (con ventas)
      if (ventasProd.ventas > 0 && (!productoMasRentable || margen > productoMasRentable.margen)) {
        productoMasRentable = {
          id: producto.id,
          nombre: `${producto.marca} ${producto.nombreComercial}`,
          margen
        };
      }

      // Producto con menos stock (activo)
      if (producto.estado === 'activo') {
        if (!productoMenosStock || pStock < productoMenosStock.stock) {
          productoMenosStock = {
            id: producto.id,
            nombre: `${producto.marca} ${producto.nombreComercial}`,
            stock: pStock
          };
        }
      }
    }

    // Calcular totales de ventas
    let unidadesVendidas = 0;
    let ventasTotalPEN = 0;
    let costoTotalPEN = 0;

    ventasProductos.forEach(v => {
      unidadesVendidas += v.unidades;
      ventasTotalPEN += v.ventas;
      costoTotalPEN += v.costo;
    });

    const utilidadBruta = ventasTotalPEN - costoTotalPEN;
    const margenPromedio = ventasTotalPEN > 0 ? (utilidadBruta / ventasTotalPEN) * 100 : 0;

    // Número de ventas únicas que incluyen estos productos
    const ventasUnicas = new Set<string>();
    for (const venta of todasLasVentas) {
      if (venta.estado === 'anulada') continue;
      for (const item of venta.items || []) {
        if (productIds.includes(item.productoId)) {
          ventasUnicas.add(venta.id);
          break;
        }
      }
    }
    const numeroVentas = ventasUnicas.size;
    const ticketPromedio = numeroVentas > 0 ? ventasTotalPEN / numeroVentas : 0;

    // Participación
    const participacionVentas = totalVentasGeneral > 0 ? (ventasTotalPEN / totalVentasGeneral) * 100 : 0;
    const participacionUnidades = totalUnidadesGeneral > 0 ? (unidadesVendidas / totalUnidadesGeneral) * 100 : 0;

    // Tendencia de ventas (agrupado por semana)
    const tendenciaMap = new Map<string, { ventas: number; unidades: number }>();

    for (const venta of todasLasVentas) {
      if (venta.estado === 'anulada') continue;

      const fecha = venta.fecha?.toDate?.() || new Date();
      // Agrupar por semana
      const weekStart = new Date(fecha);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];

      for (const item of venta.items || []) {
        if (productIds.includes(item.productoId)) {
          const current = tendenciaMap.get(weekKey) || { ventas: 0, unidades: 0 };
          current.ventas += item.subtotal || 0;
          current.unidades += item.cantidad || 0;
          tendenciaMap.set(weekKey, current);
        }
      }
    }

    const tendenciaVentas = Array.from(tendenciaMap.entries())
      .map(([fecha, data]) => ({ fecha, ...data }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Ordenar productos por ventas
    productosConMetricas.sort((a, b) => b.ventasPEN - a.ventasPEN);

    return {
      metricas: {
        totalProductos: productos.length,
        productosActivos,
        productosInactivos,
        stockTotal,
        stockPeru,
        stockUSA,
        stockTransito,
        valorInventario,
        productosStockCritico,
        productosAgotados,
        unidadesVendidas,
        ventasTotalPEN,
        costoTotalPEN,
        utilidadBruta,
        margenPromedio,
        ticketPromedio,
        numeroVentas,
        participacionVentas,
        participacionUnidades,
        productoMasVendido,
        productoMasRentable,
        productoMenosStock
      },
      productos: productosConMetricas,
      tendenciaVentas
    };
  }

  private getMetricasVacias(): ClasificacionMetricas {
    return {
      totalProductos: 0,
      productosActivos: 0,
      productosInactivos: 0,
      stockTotal: 0,
      stockPeru: 0,
      stockUSA: 0,
      stockTransito: 0,
      valorInventario: 0,
      productosStockCritico: 0,
      productosAgotados: 0,
      unidadesVendidas: 0,
      ventasTotalPEN: 0,
      costoTotalPEN: 0,
      utilidadBruta: 0,
      margenPromedio: 0,
      ticketPromedio: 0,
      numeroVentas: 0,
      participacionVentas: 0,
      participacionUnidades: 0
    };
  }

  /**
   * Comparativa entre múltiples tipos de producto
   */
  async getComparativaTipos(
    tipoIds: string[],
    fechaInicio?: Date,
    fechaFin?: Date
  ): Promise<Map<string, ClasificacionMetricas>> {
    const resultados = new Map<string, ClasificacionMetricas>();

    for (const tipoId of tipoIds) {
      const analytics = await this.getAnalyticsTipoProducto(tipoId, fechaInicio, fechaFin);
      resultados.set(tipoId, analytics.metricas);
    }

    return resultados;
  }

  /**
   * Comparativa entre múltiples categorías
   */
  async getComparativaCategorias(
    categoriaIds: string[],
    fechaInicio?: Date,
    fechaFin?: Date
  ): Promise<Map<string, ClasificacionMetricas>> {
    const resultados = new Map<string, ClasificacionMetricas>();

    for (const catId of categoriaIds) {
      const analytics = await this.getAnalyticsCategoria(catId, fechaInicio, fechaFin);
      resultados.set(catId, analytics.metricas);
    }

    return resultados;
  }
}

export const clasificacionAnalyticsService = new ClasificacionAnalyticsService();
