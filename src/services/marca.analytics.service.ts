/**
 * Servicio de Analytics para Marcas
 * Proporciona métricas avanzadas, KPIs y análisis por marca
 */
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Marca } from '../types/entidadesMaestras.types';
import type { Producto } from '../types/producto.types';
import type { Venta } from '../types/venta.types';

// ============================================
// TIPOS PARA ANALYTICS DE MARCAS
// ============================================

/**
 * Producto con métricas calculadas para una marca
 */
export interface ProductoMarcaMetrics {
  id: string;
  sku: string;
  nombre: string;
  presentacion: string;
  dosaje: string;
  contenido: string;
  grupo: string;
  subgrupo: string;

  // Stock
  stockTotal: number;
  stockDisponible: number;
  stockUSA: number;
  stockPeru: number;
  valorInventarioUSD: number;
  valorInventarioPEN: number;

  // Ventas
  unidadesVendidas: number;
  ventasTotalPEN: number;
  margenPromedio: number;
  margenTotal: number;

  // Performance
  rotacionDias: number;
  diasSinVenta: number;
  esProductoEstrella: boolean;
  tendencia: 'subiendo' | 'bajando' | 'estable';

  // Recompra
  cicloRecompraDias?: number;
  clientesConRecompra: number;

  // ML
  habilitadoML: boolean;
  restriccionML?: string;
}

/**
 * Métricas agregadas por categoría/grupo
 */
export interface MetricasPorCategoria {
  categoria: string;
  subcategorias: string[];
  totalProductos: number;
  unidadesVendidas: number;
  ventasTotalPEN: number;
  margenPromedio: number;
  stockTotal: number;
  productoEstrella?: {
    id: string;
    nombre: string;
    ventas: number;
  };
}

/**
 * Historial de ventas por período
 */
export interface VentasPeriodo {
  periodo: string; // "2024-01", "2024-02", etc.
  mes: number;
  anio: number;
  unidades: number;
  ventasPEN: number;
  margenPromedio: number;
  productosVendidos: number;
}

/**
 * Comparación entre marcas
 */
export interface ComparacionMarcas {
  marcaId: string;
  nombreMarca: string;
  categoria: string;
  productos: number;
  ventas: number;
  margen: number;
  participacion: number; // % del total en esa categoría
  ranking: number;
}

/**
 * Analytics completo de una marca
 */
export interface MarcaAnalytics {
  marca: Marca;

  // Productos
  productos: ProductoMarcaMetrics[];
  totalProductos: number;
  productosActivos: number;
  productosInactivos: number;
  productosDescontinuados: number;

  // Métricas por categoría
  categorias: MetricasPorCategoria[];

  // Ventas
  ventasTotalHistorico: number;
  ventasUltimos30Dias: number;
  ventasUltimos90Dias: number;
  ventasUltimos365Dias: number;
  unidadesVendidasTotal: number;
  ticketPromedio: number;

  // Historial
  historialVentas: VentasPeriodo[];
  tendenciaVentas: 'creciendo' | 'decreciendo' | 'estable';
  tasaCrecimiento: number; // % comparado con período anterior

  // Rentabilidad
  margenPromedioGlobal: number;
  margenPonderado: number;
  rentabilidadTotal: number;

  // Inventario
  valorInventarioTotalUSD: number;
  valorInventarioTotalPEN: number;
  stockTotalUnidades: number;
  rotacionPromedioGlobal: number;
  productosEnStockCritico: number;
  productosSobreStock: number;

  // Performance
  productoEstrella?: ProductoMarcaMetrics;
  productosTop5: ProductoMarcaMetrics[];
  productosBajoRendimiento: ProductoMarcaMetrics[];

  // Clientes
  clientesUnicos: number;
  clientesRecurrentes: number;
  tasaRecompra: number;

  // MercadoLibre
  productosHabilitadosML: number;
  productosRestringidosML: number;
  ventasML?: number;
}

/**
 * Servicio de Analytics para Marcas
 */
export const marcaAnalyticsService = {
  /**
   * Obtiene analytics completo de una marca
   */
  async getMarcaAnalytics(marcaId: string): Promise<MarcaAnalytics | null> {
    try {
      // 1. Obtener la marca
      const marcaDoc = await getDocs(
        query(collection(db, 'marcas'), where('__name__', '==', marcaId))
      );

      if (marcaDoc.empty) return null;

      const marca = { id: marcaDoc.docs[0].id, ...marcaDoc.docs[0].data() } as Marca;

      // 2. Obtener productos de esta marca
      const productosSnapshot = await getDocs(collection(db, 'productos'));
      const productosData = productosSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Producto))
        .filter(p =>
          p.marca?.toLowerCase() === marca.nombre.toLowerCase() ||
          p.marcaId === marcaId
        );

      // 3. Obtener ventas (últimos 365 días)
      const hace365Dias = new Date();
      hace365Dias.setFullYear(hace365Dias.getFullYear() - 1);

      const ventasSnapshot = await getDocs(collection(db, 'ventas'));
      const ventas = ventasSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Venta))
        .filter(v => {
          const fechaVenta = v.fechaCreacion?.toDate?.() || new Date(v.fechaCreacion as unknown as string);
          return fechaVenta >= hace365Dias && v.estado !== 'cancelada';
        });

      // 4. Calcular métricas por producto
      const productosMetrics = this.calcularMetricasProductos(productosData, ventas);

      // 5. Calcular métricas por categoría
      const categorias = this.calcularMetricasCategorias(productosMetrics);

      // 6. Calcular historial de ventas
      const historialVentas = this.calcularHistorialVentas(ventas, productosData.map(p => p.id));

      // 7. Calcular estadísticas de clientes
      const statsClientes = this.calcularStatsClientes(ventas, productosData.map(p => p.id));

      // 8. Calcular totales
      const ahora = new Date();
      const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
      const hace90Dias = new Date(ahora.getTime() - 90 * 24 * 60 * 60 * 1000);

      const ventasFiltradas = this.filtrarVentasPorProductos(ventas, productosData.map(p => p.id));

      const ventasUltimos30Dias = this.calcularVentasPeriodo(ventasFiltradas, hace30Dias, ahora);
      const ventasUltimos90Dias = this.calcularVentasPeriodo(ventasFiltradas, hace90Dias, ahora);
      const ventasUltimos365Dias = this.calcularVentasPeriodo(ventasFiltradas, hace365Dias, ahora);

      // Tendencia
      const ventasMesPasado = this.calcularVentasPeriodo(
        ventasFiltradas,
        new Date(ahora.getTime() - 60 * 24 * 60 * 60 * 1000),
        hace30Dias
      );

      let tendenciaVentas: 'creciendo' | 'decreciendo' | 'estable' = 'estable';
      let tasaCrecimiento = 0;

      if (ventasMesPasado.total > 0) {
        tasaCrecimiento = ((ventasUltimos30Dias.total - ventasMesPasado.total) / ventasMesPasado.total) * 100;
        if (tasaCrecimiento > 10) tendenciaVentas = 'creciendo';
        else if (tasaCrecimiento < -10) tendenciaVentas = 'decreciendo';
      }

      // Productos ordenados por ventas
      const productosOrdenados = [...productosMetrics].sort((a, b) => b.ventasTotalPEN - a.ventasTotalPEN);
      const productoEstrella = productosOrdenados[0];
      const productosTop5 = productosOrdenados.slice(0, 5);
      const productosBajoRendimiento = productosOrdenados
        .filter(p => p.unidadesVendidas === 0 && p.stockTotal > 0)
        .slice(0, 5);

      // Totales de inventario
      const valorInventarioTotalUSD = productosMetrics.reduce((sum, p) => sum + p.valorInventarioUSD, 0);
      const valorInventarioTotalPEN = productosMetrics.reduce((sum, p) => sum + p.valorInventarioPEN, 0);
      const stockTotalUnidades = productosMetrics.reduce((sum, p) => sum + p.stockTotal, 0);

      // Rotación promedio
      const productosConRotacion = productosMetrics.filter(p => p.rotacionDias > 0);
      const rotacionPromedioGlobal = productosConRotacion.length > 0
        ? productosConRotacion.reduce((sum, p) => sum + p.rotacionDias, 0) / productosConRotacion.length
        : 0;

      // Productos en stock crítico y sobre stock
      const productosEnStockCritico = productosData.filter(p =>
        (p.stockDisponible || 0) <= (p.stockMinimo || 0)
      ).length;

      const productosSobreStock = productosData.filter(p =>
        (p.stockDisponible || 0) >= (p.stockMaximo || 100)
      ).length;

      // ML
      const productosHabilitadosML = productosData.filter(p => p.habilitadoML).length;
      const productosRestringidosML = productosData.filter(p => p.habilitadoML && p.restriccionML).length;

      // Margen ponderado
      const totalUnidades = productosMetrics.reduce((sum, p) => sum + p.unidadesVendidas, 0);
      const margenPonderado = totalUnidades > 0
        ? productosMetrics.reduce((sum, p) => sum + p.margenPromedio * p.unidadesVendidas, 0) / totalUnidades
        : 0;

      const margenPromedioGlobal = productosMetrics.length > 0
        ? productosMetrics.reduce((sum, p) => sum + p.margenPromedio, 0) / productosMetrics.length
        : 0;

      const rentabilidadTotal = productosMetrics.reduce((sum, p) => sum + p.margenTotal, 0);

      return {
        marca,
        productos: productosMetrics,
        totalProductos: productosData.length,
        productosActivos: productosData.filter(p => p.estado === 'activo').length,
        productosInactivos: productosData.filter(p => p.estado === 'inactivo').length,
        productosDescontinuados: productosData.filter(p => p.estado === 'descontinuado').length,
        categorias,
        ventasTotalHistorico: marca.metricas?.ventasTotalPEN || 0,
        ventasUltimos30Dias: ventasUltimos30Dias.total,
        ventasUltimos90Dias: ventasUltimos90Dias.total,
        ventasUltimos365Dias: ventasUltimos365Dias.total,
        unidadesVendidasTotal: totalUnidades,
        ticketPromedio: ventasFiltradas.length > 0
          ? ventasUltimos365Dias.total / ventasFiltradas.length
          : 0,
        historialVentas,
        tendenciaVentas,
        tasaCrecimiento,
        margenPromedioGlobal,
        margenPonderado,
        rentabilidadTotal,
        valorInventarioTotalUSD,
        valorInventarioTotalPEN,
        stockTotalUnidades,
        rotacionPromedioGlobal,
        productosEnStockCritico,
        productosSobreStock,
        productoEstrella,
        productosTop5,
        productosBajoRendimiento,
        clientesUnicos: statsClientes.clientesUnicos,
        clientesRecurrentes: statsClientes.clientesRecurrentes,
        tasaRecompra: statsClientes.tasaRecompra,
        productosHabilitadosML,
        productosRestringidosML
      };
    } catch (error: any) {
      console.error('Error obteniendo analytics de marca:', error);
      return null;
    }
  },

  /**
   * Calcula métricas por producto
   */
  calcularMetricasProductos(productos: Producto[], ventas: Venta[]): ProductoMarcaMetrics[] {
    const ahora = new Date();

    return productos.map(producto => {
      // Filtrar ventas de este producto
      const ventasProducto = ventas.filter(v =>
        v.productos?.some(p => p.productoId === producto.id)
      );

      // Calcular totales
      let unidadesVendidas = 0;
      let ventasTotalPEN = 0;
      let margenTotal = 0;
      let ultimaVenta: Date | null = null;
      const clientesSet = new Set<string>();

      ventasProducto.forEach(venta => {
        const productoEnVenta = venta.productos?.find(p => p.productoId === producto.id);
        if (productoEnVenta) {
          unidadesVendidas += productoEnVenta.cantidad;
          ventasTotalPEN += productoEnVenta.subtotal || (productoEnVenta.cantidad * productoEnVenta.precioUnitario);

          // Calcular margen si hay costo de unidades asignadas
          if (productoEnVenta.costoTotalUnidades) {
            margenTotal += (productoEnVenta.subtotal || 0) - productoEnVenta.costoTotalUnidades;
          }

          const fechaVenta = venta.fechaCreacion?.toDate?.() || new Date(venta.fechaCreacion as unknown as string);
          if (!ultimaVenta || fechaVenta > ultimaVenta) {
            ultimaVenta = fechaVenta;
          }

          if (venta.clienteId) {
            clientesSet.add(venta.clienteId);
          }
        }
      });

      const margenPromedio = unidadesVendidas > 0
        ? (margenTotal / ventasTotalPEN) * 100
        : producto.margenObjetivo || 0;

      const diasSinVenta = ultimaVenta !== null
        ? Math.floor((ahora.getTime() - (ultimaVenta as Date).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // Rotación
      const stockTotal = (producto.stockUSA || 0) + (producto.stockPeru || 0) + (producto.stockTransito || 0);
      const rotacionDias = producto.rotacionPromedio ||
        (unidadesVendidas > 0 && stockTotal > 0
          ? Math.round((stockTotal / (unidadesVendidas / 365)) * 30)
          : 0);

      // Tendencia (comparar últimos 30 días vs 30 anteriores)
      const hace30 = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
      const hace60 = new Date(ahora.getTime() - 60 * 24 * 60 * 60 * 1000);

      const ventasRecientes = ventasProducto.filter(v => {
        const fecha = v.fechaCreacion?.toDate?.() || new Date(v.fechaCreacion as unknown as string);
        return fecha >= hace30;
      }).length;

      const ventasAnteriores = ventasProducto.filter(v => {
        const fecha = v.fechaCreacion?.toDate?.() || new Date(v.fechaCreacion as unknown as string);
        return fecha >= hace60 && fecha < hace30;
      }).length;

      let tendencia: 'subiendo' | 'bajando' | 'estable' = 'estable';
      if (ventasRecientes > ventasAnteriores * 1.2) tendencia = 'subiendo';
      else if (ventasRecientes < ventasAnteriores * 0.8) tendencia = 'bajando';

      // Valor inventario
      const ctru = producto.ctruPromedio || 0;
      const valorInventarioPEN = stockTotal * ctru;
      const tc = 3.75; // TODO: Obtener TC dinámico
      const valorInventarioUSD = valorInventarioPEN / tc;

      return {
        id: producto.id,
        sku: producto.sku,
        nombre: `${producto.nombreComercial} ${producto.dosaje || ''} ${producto.contenido || ''}`.trim(),
        presentacion: producto.presentacion,
        dosaje: producto.dosaje || '',
        contenido: producto.contenido || '',
        grupo: producto.grupo || '',
        subgrupo: producto.subgrupo || '',
        stockTotal,
        stockDisponible: producto.stockDisponible || 0,
        stockUSA: producto.stockUSA || 0,
        stockPeru: producto.stockPeru || 0,
        valorInventarioUSD,
        valorInventarioPEN,
        unidadesVendidas,
        ventasTotalPEN,
        margenPromedio,
        margenTotal,
        rotacionDias,
        diasSinVenta,
        esProductoEstrella: false, // Se marca después
        tendencia,
        cicloRecompraDias: producto.cicloRecompraDias,
        clientesConRecompra: clientesSet.size,
        habilitadoML: producto.habilitadoML || false,
        restriccionML: producto.restriccionML
      };
    });
  },

  /**
   * Calcula métricas agrupadas por categoría
   */
  calcularMetricasCategorias(productos: ProductoMarcaMetrics[]): MetricasPorCategoria[] {
    const categoriaMap = new Map<string, {
      subcategorias: Set<string>;
      productos: ProductoMarcaMetrics[];
    }>();

    productos.forEach(p => {
      const grupo = p.grupo || 'Sin categoría';
      if (!categoriaMap.has(grupo)) {
        categoriaMap.set(grupo, { subcategorias: new Set(), productos: [] });
      }
      const cat = categoriaMap.get(grupo)!;
      if (p.subgrupo) cat.subcategorias.add(p.subgrupo);
      cat.productos.push(p);
    });

    return Array.from(categoriaMap.entries()).map(([categoria, data]) => {
      const totalUnidades = data.productos.reduce((sum, p) => sum + p.unidadesVendidas, 0);
      const ventasTotalPEN = data.productos.reduce((sum, p) => sum + p.ventasTotalPEN, 0);
      const stockTotal = data.productos.reduce((sum, p) => sum + p.stockTotal, 0);

      const margenPromedio = totalUnidades > 0
        ? data.productos.reduce((sum, p) => sum + p.margenPromedio * p.unidadesVendidas, 0) / totalUnidades
        : 0;

      const productoTop = [...data.productos].sort((a, b) => b.ventasTotalPEN - a.ventasTotalPEN)[0];

      return {
        categoria,
        subcategorias: Array.from(data.subcategorias),
        totalProductos: data.productos.length,
        unidadesVendidas: totalUnidades,
        ventasTotalPEN,
        margenPromedio,
        stockTotal,
        productoEstrella: productoTop ? {
          id: productoTop.id,
          nombre: productoTop.nombre,
          ventas: productoTop.ventasTotalPEN
        } : undefined
      };
    }).sort((a, b) => b.ventasTotalPEN - a.ventasTotalPEN);
  },

  /**
   * Calcula historial de ventas por mes
   */
  calcularHistorialVentas(ventas: Venta[], productosIds: string[]): VentasPeriodo[] {
    const mesesMap = new Map<string, VentasPeriodo>();

    ventas.forEach(venta => {
      const fecha = venta.fechaCreacion?.toDate?.() || new Date(venta.fechaCreacion as unknown as string);
      const mes = fecha.getMonth() + 1;
      const anio = fecha.getFullYear();
      const periodo = `${anio}-${String(mes).padStart(2, '0')}`;

      const productosEnVenta = venta.productos?.filter(p => productosIds.includes(p.productoId)) || [];
      if (productosEnVenta.length === 0) return;

      if (!mesesMap.has(periodo)) {
        mesesMap.set(periodo, {
          periodo,
          mes,
          anio,
          unidades: 0,
          ventasPEN: 0,
          margenPromedio: 0,
          productosVendidos: 0
        });
      }

      const periodoData = mesesMap.get(periodo)!;
      productosEnVenta.forEach(p => {
        periodoData.unidades += p.cantidad;
        periodoData.ventasPEN += p.subtotal || (p.cantidad * p.precioUnitario);
      });
      periodoData.productosVendidos += 1;
    });

    return Array.from(mesesMap.values()).sort((a, b) => a.periodo.localeCompare(b.periodo));
  },

  /**
   * Filtra ventas que contienen productos de la lista
   */
  filtrarVentasPorProductos(ventas: Venta[], productosIds: string[]): Venta[] {
    return ventas.filter(v =>
      v.productos?.some(p => productosIds.includes(p.productoId))
    );
  },

  /**
   * Calcula ventas en un período
   */
  calcularVentasPeriodo(ventas: Venta[], desde: Date, hasta: Date): { total: number; unidades: number } {
    let total = 0;
    let unidades = 0;

    ventas.forEach(v => {
      const fecha = v.fechaCreacion?.toDate?.() || new Date(v.fechaCreacion as unknown as string);
      if (fecha >= desde && fecha <= hasta) {
        v.productos?.forEach(p => {
          total += p.subtotal || (p.cantidad * p.precioUnitario);
          unidades += p.cantidad;
        });
      }
    });

    return { total, unidades };
  },

  /**
   * Calcula estadísticas de clientes para la marca
   */
  calcularStatsClientes(ventas: Venta[], productosIds: string[]): {
    clientesUnicos: number;
    clientesRecurrentes: number;
    tasaRecompra: number;
  } {
    const clienteCompras = new Map<string, number>();

    ventas.forEach(venta => {
      const tieneProducto = venta.productos?.some(p => productosIds.includes(p.productoId));
      if (!tieneProducto) return;

      const clienteId = venta.clienteId;
      if (clienteId) {
        clienteCompras.set(clienteId, (clienteCompras.get(clienteId) || 0) + 1);
      }
    });

    const clientesUnicos = clienteCompras.size;
    const clientesRecurrentes = Array.from(clienteCompras.values()).filter(c => c > 1).length;
    const tasaRecompra = clientesUnicos > 0 ? (clientesRecurrentes / clientesUnicos) * 100 : 0;

    return { clientesUnicos, clientesRecurrentes, tasaRecompra };
  },

  /**
   * Compara marcas por categoría
   */
  async compararMarcasPorCategoria(categoria: string): Promise<ComparacionMarcas[]> {
    try {
      // 1. Obtener todos los productos de esta categoría
      const productosSnapshot = await getDocs(collection(db, 'productos'));
      const productosCategoria = productosSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Producto))
        .filter(p => p.grupo?.toLowerCase() === categoria.toLowerCase());

      if (productosCategoria.length === 0) return [];

      // 2. Agrupar por marca
      const marcasMap = new Map<string, Producto[]>();
      productosCategoria.forEach(p => {
        const marca = p.marca || 'Sin marca';
        if (!marcasMap.has(marca)) {
          marcasMap.set(marca, []);
        }
        marcasMap.get(marca)!.push(p);
      });

      // 3. Obtener ventas
      const ventasSnapshot = await getDocs(collection(db, 'ventas'));
      const ventas = ventasSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Venta))
        .filter(v => v.estado !== 'cancelada');

      // 4. Calcular métricas por marca
      const comparaciones: ComparacionMarcas[] = [];
      let totalVentasCategoria = 0;

      marcasMap.forEach((productos, nombreMarca) => {
        const productosIds = productos.map(p => p.id);
        let ventasMarca = 0;
        let unidadesMarca = 0;
        let margenTotal = 0;

        ventas.forEach(v => {
          v.productos?.forEach(p => {
            if (productosIds.includes(p.productoId)) {
              ventasMarca += p.subtotal || (p.cantidad * p.precioUnitario);
              unidadesMarca += p.cantidad;
              if (p.costoTotalUnidades) {
                margenTotal += (p.subtotal || 0) - p.costoTotalUnidades;
              }
            }
          });
        });

        totalVentasCategoria += ventasMarca;

        comparaciones.push({
          marcaId: productos[0].marcaId || nombreMarca,
          nombreMarca,
          categoria,
          productos: productos.length,
          ventas: ventasMarca,
          margen: ventasMarca > 0 ? (margenTotal / ventasMarca) * 100 : 0,
          participacion: 0, // Se calcula después
          ranking: 0
        });
      });

      // 5. Calcular participación y ranking
      comparaciones.forEach(c => {
        c.participacion = totalVentasCategoria > 0
          ? (c.ventas / totalVentasCategoria) * 100
          : 0;
      });

      comparaciones.sort((a, b) => b.ventas - a.ventas);
      comparaciones.forEach((c, idx) => {
        c.ranking = idx + 1;
      });

      return comparaciones;
    } catch (error: any) {
      console.error('Error comparando marcas:', error);
      return [];
    }
  },

  /**
   * Obtiene todas las categorías con productos
   */
  async getCategorias(): Promise<string[]> {
    try {
      const productosSnapshot = await getDocs(collection(db, 'productos'));
      const categorias = new Set<string>();

      productosSnapshot.docs.forEach(doc => {
        const grupo = doc.data().grupo;
        if (grupo) categorias.add(grupo);
      });

      return Array.from(categorias).sort();
    } catch (error: any) {
      console.error('Error obteniendo categorías:', error);
      return [];
    }
  },

  /**
   * Obtiene todos los tipos de producto (subgrupos) con productos
   */
  async getTiposProducto(): Promise<string[]> {
    try {
      const productosSnapshot = await getDocs(collection(db, 'productos'));
      const tipos = new Set<string>();

      productosSnapshot.docs.forEach(doc => {
        const subgrupo = doc.data().subgrupo;
        if (subgrupo) tipos.add(subgrupo);
      });

      return Array.from(tipos).sort();
    } catch (error: any) {
      console.error('Error obteniendo tipos de producto:', error);
      return [];
    }
  },

  /**
   * Compara marcas por tipo de producto (subgrupo)
   * Ej: Comparar marcas que venden "Aceite de Orégano", "Omega 3", etc.
   */
  async compararMarcasPorTipoProducto(tipoProducto: string): Promise<ComparacionMarcas[]> {
    try {
      // 1. Obtener todos los productos de este tipo
      const productosSnapshot = await getDocs(collection(db, 'productos'));
      const productosTipo = productosSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Producto))
        .filter(p => p.subgrupo?.toLowerCase() === tipoProducto.toLowerCase());

      if (productosTipo.length === 0) return [];

      // 2. Agrupar por marca
      const marcasMap = new Map<string, Producto[]>();
      productosTipo.forEach(p => {
        const marca = p.marca || 'Sin marca';
        if (!marcasMap.has(marca)) {
          marcasMap.set(marca, []);
        }
        marcasMap.get(marca)!.push(p);
      });

      // 3. Obtener ventas
      const ventasSnapshot = await getDocs(collection(db, 'ventas'));
      const ventas = ventasSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Venta))
        .filter(v => v.estado !== 'cancelada');

      // 4. Calcular métricas por marca
      const comparaciones: ComparacionMarcas[] = [];
      let totalVentasTipo = 0;

      marcasMap.forEach((productos, nombreMarca) => {
        const productosIds = productos.map(p => p.id);
        let ventasMarca = 0;
        let unidadesMarca = 0;
        let margenTotal = 0;

        ventas.forEach(v => {
          v.productos?.forEach(p => {
            if (productosIds.includes(p.productoId)) {
              ventasMarca += p.subtotal || (p.cantidad * p.precioUnitario);
              unidadesMarca += p.cantidad;
              if (p.costoTotalUnidades) {
                margenTotal += (p.subtotal || 0) - p.costoTotalUnidades;
              }
            }
          });
        });

        totalVentasTipo += ventasMarca;

        comparaciones.push({
          marcaId: productos[0].marcaId || nombreMarca,
          nombreMarca,
          categoria: tipoProducto, // Usamos el tipo de producto como categoría
          productos: productos.length,
          ventas: ventasMarca,
          margen: ventasMarca > 0 ? (margenTotal / ventasMarca) * 100 : 0,
          participacion: 0,
          ranking: 0
        });
      });

      // 5. Calcular participación y ranking
      comparaciones.forEach(c => {
        c.participacion = totalVentasTipo > 0
          ? (c.ventas / totalVentasTipo) * 100
          : 0;
      });

      comparaciones.sort((a, b) => b.ventas - a.ventas);
      comparaciones.forEach((c, idx) => {
        c.ranking = idx + 1;
      });

      return comparaciones;
    } catch (error: any) {
      console.error('Error comparando marcas por tipo de producto:', error);
      return [];
    }
  }
};

export const MarcaAnalyticsService = marcaAnalyticsService;
