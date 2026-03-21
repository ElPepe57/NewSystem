import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Producto } from '../types/producto.types';
import type { Venta, ProductoVenta } from '../types/venta.types';
import type { OrdenCompra } from '../types/ordenCompra.types';
import type {
  MetricasRotacion,
  MetricasRentabilidad,
  ScoreLiquidez,
  ProductoIntel,
  AlertaProductoIntel,
  ClasificacionRotacion,
  ClasificacionLiquidez,
  TendenciaProducto,
  ResumenCaja,
  FlujoCajaProyectado,
  SugerenciaReposicion,
  MetricasLeadTime,
  RendimientoProductoCanal
} from '../types/productoIntel.types';

// ============================================
// SERVICIO DE INTELIGENCIA DE PRODUCTOS
// ============================================

export const productoIntelService = {
  // ============================================
  // OBTENCION DE DATOS BASE
  // ============================================

  /**
   * Obtiene ventas de los ultimos N dias
   */
  async getVentasRecientes(dias: number): Promise<Venta[]> {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);

    try {
      const q = query(
        collection(db, 'ventas'),
        where('fechaCreacion', '>=', Timestamp.fromDate(fechaLimite)),
        orderBy('fechaCreacion', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Venta));
    } catch (error) {
      // Fallback sin indice
      const allVentas = await getDocs(collection(db, 'ventas'));
      return allVentas.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Venta))
        .filter(v => {
          const fecha = v.fechaCreacion?.toDate?.() || new Date(0);
          return fecha >= fechaLimite;
        });
    }
  },

  /**
   * Obtiene todas las OC para calcular lead time
   */
  async getOrdenesCompra(): Promise<OrdenCompra[]> {
    const snapshot = await getDocs(collection(db, 'ordenesCompra'));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as OrdenCompra));
  },

  /**
   * Obtiene productos con stock real (excluye los que solo tienen investigacion o datos de prueba)
   * Un producto tiene "stock real" si:
   * - Tiene stock en USA, Peru o transito > 0
   *
   * Nota: Ya NO usamos ctruPromedio como indicador porque puede haber datos de prueba
   */
  async getProductosConStock(): Promise<Producto[]> {
    const q = query(
      collection(db, 'productos'),
      where('estado', '==', 'activo')
    );
    const snapshot = await getDocs(q);
    const productos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Producto));

    // Filtrar SOLO productos que tienen stock actual real
    return productos.filter(p => {
      const stockTotal = (p.stockUSA || 0) + (p.stockPeru || 0) + (p.stockTransito || 0) + (p.stockReservado || 0);
      // SOLO incluir si tiene stock actual > 0
      return stockTotal > 0;
    });
  },

  /**
   * Obtiene todos los productos activos (incluyendo solo investigados)
   * @deprecated Usar getProductosConStock() para analisis de caja
   */
  async getProductosActivos(): Promise<Producto[]> {
    const q = query(
      collection(db, 'productos'),
      where('estado', '==', 'activo')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Producto));
  },

  // ============================================
  // CALCULOS DE ROTACION
  // ============================================

  /**
   * Calcula metricas de rotacion para un producto
   */
  calcularRotacion(
    producto: Producto,
    ventas30d: Venta[],
    ventas90d: Venta[],
    ventas30dAnterior: Venta[] // 30 dias previos para comparar
  ): MetricasRotacion {
    // Filtrar ventas de este producto (solo ventas efectivas, no cotizaciones)
    const estadosValidos = ['confirmada', 'asignada', 'en_entrega', 'despachada', 'entrega_parcial', 'entregada'];

    const ventasProducto30d = this.filtrarVentasProducto(ventas30d, producto.id, estadosValidos);
    const ventasProducto90d = this.filtrarVentasProducto(ventas90d, producto.id, estadosValidos);
    const ventasProducto30dAnterior = this.filtrarVentasProducto(ventas30dAnterior, producto.id, estadosValidos);

    // Calcular unidades vendidas
    const unidadesVendidas30d = this.sumarUnidadesVendidas(ventasProducto30d, producto.id);
    const unidadesVendidas90d = this.sumarUnidadesVendidas(ventasProducto90d, producto.id);
    const unidadesVendidas30dAnterior = this.sumarUnidadesVendidas(ventasProducto30dAnterior, producto.id);

    // Calcular ventas en PEN
    const ventasPEN30d = this.sumarVentasPEN(ventasProducto30d, producto.id);
    const ventasPEN90d = this.sumarVentasPEN(ventasProducto90d, producto.id);

    // Promedio de ventas diarias
    const promedioVentasDiarias = unidadesVendidas30d / 30;

    // Stock total
    const stockTotal = (producto.stockUSA || 0) + (producto.stockPeru || 0) + (producto.stockTransito || 0);
    const stockDisponible = producto.stockDisponible || (producto.stockPeru || 0);
    const stockReservado = producto.stockReservado || 0;

    // Rotacion en dias (cuantos dias para vender el stock actual)
    const rotacionDias = promedioVentasDiarias > 0
      ? Math.round(stockTotal / promedioVentasDiarias)
      : stockTotal > 0 ? 999 : 0;

    // Dias para quiebre (solo stock disponible)
    const diasParaQuiebre = promedioVentasDiarias > 0
      ? Math.round(stockDisponible / promedioVentasDiarias)
      : stockDisponible > 0 ? 999 : 0;

    // Clasificacion de rotacion
    const clasificacionRotacion = this.clasificarRotacion(rotacionDias, unidadesVendidas30d);

    // Frecuencia de ventas
    const ventasPorSemana = Math.round((unidadesVendidas30d / 30) * 7 * 10) / 10;
    const ventasPorMes = unidadesVendidas30d;

    // Dias desde ultima venta
    const diasDesdeUltimaVenta = this.calcularDiasDesdeUltimaVenta(ventasProducto90d);

    // Variacion de ventas (comparar 30d actual vs 30d anterior)
    const variacionVentas = unidadesVendidas30dAnterior > 0
      ? Math.round(((unidadesVendidas30d - unidadesVendidas30dAnterior) / unidadesVendidas30dAnterior) * 100)
      : unidadesVendidas30d > 0 ? 100 : 0;

    // Tendencia
    const tendencia = this.calcularTendencia(variacionVentas, unidadesVendidas30d, producto);

    return {
      productoId: producto.id,
      sku: producto.sku,
      nombreComercial: producto.nombreComercial,
      marca: producto.marca,
      stockTotal,
      stockDisponible,
      stockReservado,
      stockTransito: producto.stockTransito || 0,
      unidadesVendidas30d,
      ventasPEN30d,
      promedioVentasDiarias: Math.round(promedioVentasDiarias * 100) / 100,
      unidadesVendidas90d,
      ventasPEN90d,
      rotacionDias,
      diasParaQuiebre,
      clasificacionRotacion,
      ventasPorSemana,
      ventasPorMes,
      diasDesdeUltimaVenta,
      variacionVentas,
      tendencia
    };
  },

  /**
   * Filtra ventas que contengan un producto especifico
   */
  filtrarVentasProducto(ventas: Venta[], productoId: string, estadosValidos: string[]): Venta[] {
    return ventas.filter(v =>
      estadosValidos.includes(v.estado) &&
      v.productos?.some(p => p.productoId === productoId)
    );
  },

  /**
   * Suma unidades vendidas de un producto en un conjunto de ventas
   */
  sumarUnidadesVendidas(ventas: Venta[], productoId: string): number {
    return ventas.reduce((total, venta) => {
      const producto = venta.productos?.find(p => p.productoId === productoId);
      return total + (producto?.cantidad || 0);
    }, 0);
  },

  /**
   * Suma ventas en PEN de un producto
   */
  sumarVentasPEN(ventas: Venta[], productoId: string): number {
    return ventas.reduce((total, venta) => {
      const producto = venta.productos?.find(p => p.productoId === productoId);
      return total + (producto?.subtotal || 0);
    }, 0);
  },

  /**
   * Calcula dias desde la ultima venta
   */
  calcularDiasDesdeUltimaVenta(ventas: Venta[]): number {
    if (ventas.length === 0) return 999;

    const fechas = ventas
      .map(v => v.fechaCreacion?.toDate?.() || new Date(0))
      .sort((a, b) => b.getTime() - a.getTime());

    const ultimaVenta = fechas[0];
    const hoy = new Date();
    return Math.floor((hoy.getTime() - ultimaVenta.getTime()) / (1000 * 60 * 60 * 24));
  },

  /**
   * Clasifica la rotacion del producto
   */
  clasificarRotacion(rotacionDias: number, unidadesVendidas30d: number): ClasificacionRotacion {
    if (unidadesVendidas30d === 0 && rotacionDias >= 90) return 'sin_movimiento';
    if (rotacionDias <= 7) return 'muy_alta';
    if (rotacionDias <= 15) return 'alta';
    if (rotacionDias <= 30) return 'media';
    if (rotacionDias <= 60) return 'baja';
    if (rotacionDias <= 90) return 'muy_baja';
    return 'sin_movimiento';
  },

  /**
   * Calcula tendencia del producto
   */
  calcularTendencia(
    variacionVentas: number,
    unidadesVendidas30d: number,
    producto: Producto
  ): TendenciaProducto {
    // Si el producto es nuevo (creado hace menos de 30 dias)
    const fechaCreacion = (producto as any).fechaCreacion?.toDate?.() || new Date();
    const diasDesdeCreacion = Math.floor((new Date().getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));

    if (diasDesdeCreacion < 30) return 'nuevo';
    if (unidadesVendidas30d === 0) return 'sin_datos';
    if (variacionVentas > 10) return 'creciendo';
    if (variacionVentas < -10) return 'decreciendo';
    return 'estable';
  },

  // ============================================
  // CALCULOS DE RENTABILIDAD
  // ============================================

  /**
   * Calcula metricas de rentabilidad para un producto
   */
  calcularRentabilidad(
    producto: Producto,
    ventas30d: Venta[],
    ventas90d: Venta[],
    tc: number = 3.70
  ): MetricasRentabilidad {
    const estadosValidos = ['confirmada', 'asignada', 'en_entrega', 'despachada', 'entrega_parcial', 'entregada'];

    const ventasProducto30d = this.filtrarVentasProducto(ventas30d, producto.id, estadosValidos);
    const ventasProducto90d = this.filtrarVentasProducto(ventas90d, producto.id, estadosValidos);

    // Costos
    const costoPromedioUSD = producto.ctruPromedio || 0;
    const costoPromedioConFlete = costoPromedioUSD;

    // Precios de venta
    const preciosVenta = this.extraerPreciosVenta(ventasProducto30d, producto.id);
    const precioVentaPromedio = preciosVenta.length > 0
      ? preciosVenta.reduce((a, b) => a + b, 0) / preciosVenta.length
      : 0;

    // Margenes de ventas reales
    const margenes = this.extraerMargenes(ventasProducto30d, producto.id);
    const margenBrutoPromedio = margenes.length > 0
      ? margenes.reduce((a, b) => a + b, 0) / margenes.length
      : this.calcularMargenTeorico(producto);

    // Si tenemos costos y precios, calcular margen neto estimado
    // Asumimos ~10% de gastos de venta (comisiones ML, envio, etc)
    const margenNetoPromedio = margenBrutoPromedio > 0
      ? margenBrutoPromedio - 10
      : 0;

    // Utilidades
    const utilidadTotal30d = this.calcularUtilidadTotal(ventasProducto30d, producto.id);
    const utilidadTotal90d = this.calcularUtilidadTotal(ventasProducto90d, producto.id);

    const unidadesVendidas30d = this.sumarUnidadesVendidas(ventasProducto30d, producto.id);
    const utilidadPorUnidad = unidadesVendidas30d > 0
      ? utilidadTotal30d / unidadesVendidas30d
      : (precioVentaPromedio - (costoPromedioConFlete * tc));

    // ROI
    const inversionPorUnidad = costoPromedioConFlete * tc;
    const roiPromedio = inversionPorUnidad > 0
      ? Math.round((utilidadPorUnidad / inversionPorUnidad) * 100)
      : 0;

    // Tiempo de recuperacion
    const rotacion = producto.rotacionPromedio || 30;
    const tiempoRecuperacionDias = roiPromedio > 0
      ? Math.round(rotacion * (100 / roiPromedio))
      : 999;

    return {
      productoId: producto.id,
      costoPromedioUSD,
      costoPromedioConFlete,
      precioVentaPromedio,
      precioSugerido: 0,
      margenBrutoPromedio: Math.round(margenBrutoPromedio * 10) / 10,
      margenNetoPromedio: Math.round(margenNetoPromedio * 10) / 10,
      margenMinimo: margenes.length > 0 ? Math.min(...margenes) : 0,
      margenMaximo: margenes.length > 0 ? Math.max(...margenes) : 0,
      utilidadTotal30d,
      utilidadTotal90d,
      utilidadPorUnidad: Math.round(utilidadPorUnidad * 100) / 100,
      roiPromedio,
      tiempoRecuperacionDias
    };
  },

  /**
   * Extrae precios de venta reales
   */
  extraerPreciosVenta(ventas: Venta[], productoId: string): number[] {
    return ventas
      .flatMap(v => v.productos || [])
      .filter(p => p.productoId === productoId)
      .map(p => p.precioUnitario)
      .filter(p => p > 0);
  },

  /**
   * Extrae margenes reales de ventas
   */
  extraerMargenes(ventas: Venta[], productoId: string): number[] {
    return ventas
      .flatMap(v => v.productos || [])
      .filter(p => p.productoId === productoId && p.margenReal !== undefined)
      .map(p => p.margenReal as number);
  },

  /**
   * Calcula margen teorico basado en datos del producto
   */
  calcularMargenTeorico(producto: Producto, tc: number = 3.70): number {
    const costo = (producto.ctruPromedio || 0) * tc;
    const precio = 0; // precioSugerido removed - use actual sales data
    if (precio <= 0 || costo <= 0) return 0;
    return Math.round(((precio - costo) / precio) * 100);
  },

  /**
   * Calcula utilidad total de ventas
   */
  calcularUtilidadTotal(ventas: Venta[], productoId: string): number {
    return ventas.reduce((total, venta) => {
      const producto = venta.productos?.find(p => p.productoId === productoId);
      if (!producto) return total;

      // Si tenemos margen real, calcular utilidad
      if (producto.margenReal !== undefined && producto.subtotal) {
        return total + (producto.subtotal * producto.margenReal / 100);
      }

      // Si no, usar costos si estan disponibles
      if (producto.costoTotalUnidades !== undefined) {
        return total + (producto.subtotal - producto.costoTotalUnidades);
      }

      return total;
    }, 0);
  },

  // ============================================
  // SCORE DE LIQUIDEZ
  // ============================================

  /**
   * Calcula el score de liquidez de un producto
   */
  calcularScoreLiquidez(
    producto: Producto,
    rotacion: MetricasRotacion,
    rentabilidad: MetricasRentabilidad,
    tc: number
  ): ScoreLiquidez {
    // Componente Rotacion (0-50 puntos)
    // Muy alta = 50, Alta = 40, Media = 30, Baja = 15, Muy baja = 5, Sin mov = 0
    const puntosRotacion: Record<string, number> = {
      'muy_alta': 50,
      'alta': 40,
      'media': 30,
      'baja': 15,
      'muy_baja': 5,
      'sin_movimiento': 0
    };
    const componenteRotacion = puntosRotacion[rotacion.clasificacionRotacion] || 0;

    // Componente Margen (0-30 puntos)
    // >= 50% = 30, >= 40% = 25, >= 30% = 20, >= 20% = 15, >= 10% = 10, < 10% = 5
    let componenteMargen = 0;
    const margen = rentabilidad.margenBrutoPromedio;
    if (margen >= 50) componenteMargen = 30;
    else if (margen >= 40) componenteMargen = 25;
    else if (margen >= 30) componenteMargen = 20;
    else if (margen >= 20) componenteMargen = 15;
    else if (margen >= 10) componenteMargen = 10;
    else componenteMargen = 5;

    // Componente Demanda (0-20 puntos)
    // Basado en variacion de ventas y tendencia
    let componenteDemanda = 10; // Base
    if (rotacion.tendencia === 'creciendo') componenteDemanda = 20;
    else if (rotacion.tendencia === 'estable') componenteDemanda = 15;
    else if (rotacion.tendencia === 'decreciendo') componenteDemanda = 5;
    else if (rotacion.tendencia === 'sin_datos') componenteDemanda = 0;

    // Score total
    const score = componenteRotacion + componenteMargen + componenteDemanda;

    // Clasificacion
    let clasificacion: ClasificacionLiquidez;
    if (score >= 70) clasificacion = 'alta';
    else if (score >= 40) clasificacion = 'media';
    else if (score >= 20) clasificacion = 'baja';
    else clasificacion = 'critica';

    // Descripcion y recomendacion
    const { descripcion, recomendacion } = this.generarDescripcionLiquidez(
      clasificacion, rotacion, rentabilidad
    );

    // Valores de inventario
    const costoUnitarioPEN = (producto.ctruPromedio || 0) * tc;
    const valorInventarioUSD = rotacion.stockTotal * (producto.ctruPromedio || 0);
    const valorInventarioPEN = valorInventarioUSD * tc;
    const potencialVentaPEN = rotacion.stockTotal * (rentabilidad.precioVentaPromedio || 0);
    const potencialUtilidadPEN = potencialVentaPEN - valorInventarioPEN;

    return {
      productoId: producto.id,
      score,
      clasificacion,
      componenteRotacion,
      componenteMargen,
      componenteDemanda,
      descripcion,
      recomendacion,
      valorInventarioUSD: Math.round(valorInventarioUSD * 100) / 100,
      valorInventarioPEN: Math.round(valorInventarioPEN * 100) / 100,
      potencialVentaPEN: Math.round(potencialVentaPEN * 100) / 100,
      potencialUtilidadPEN: Math.round(potencialUtilidadPEN * 100) / 100
    };
  },

  /**
   * Genera descripcion y recomendacion basada en liquidez
   */
  generarDescripcionLiquidez(
    clasificacion: ClasificacionLiquidez,
    rotacion: MetricasRotacion,
    rentabilidad: MetricasRentabilidad
  ): { descripcion: string; recomendacion: string } {
    const rotDesc = rotacion.clasificacionRotacion.replace('_', ' ');
    const margen = rentabilidad.margenBrutoPromedio;

    let descripcion = '';
    let recomendacion = '';

    switch (clasificacion) {
      case 'alta':
        descripcion = `Rotacion ${rotDesc}, margen ${margen.toFixed(0)}%`;
        recomendacion = rotacion.diasParaQuiebre < 15
          ? 'Reponer urgente - genera caja rapida'
          : 'Mantener stock - producto estrella';
        break;
      case 'media':
        descripcion = `Rotacion ${rotDesc}, margen ${margen.toFixed(0)}%`;
        recomendacion = 'Monitorear - potencial de mejora';
        break;
      case 'baja':
        descripcion = `Rotacion ${rotDesc}, margen ${margen.toFixed(0)}%`;
        recomendacion = 'Evaluar promocion o descuento';
        break;
      case 'critica':
        descripcion = `Sin movimiento o muy baja rotacion`;
        recomendacion = 'Liquidar stock - caja congelada';
        break;
    }

    return { descripcion, recomendacion };
  },

  // ============================================
  // ALERTAS
  // ============================================

  /**
   * Genera alertas para un producto
   */
  generarAlertas(
    producto: Producto,
    rotacion: MetricasRotacion,
    rentabilidad: MetricasRentabilidad,
    liquidez: ScoreLiquidez
  ): AlertaProductoIntel[] {
    const alertas: AlertaProductoIntel[] = [];
    const ahora = new Date();

    // Stock critico
    if (rotacion.stockDisponible <= (producto.stockMinimo || 0) && rotacion.stockDisponible > 0) {
      alertas.push({
        tipo: 'stock_critico',
        severidad: 'danger',
        mensaje: `Stock critico: ${rotacion.stockDisponible} unidades (minimo: ${producto.stockMinimo})`,
        valor: rotacion.stockDisponible,
        fechaCreacion: ahora
      });
    }

    // Quiebre inminente (menos de 7 dias)
    if (rotacion.diasParaQuiebre > 0 && rotacion.diasParaQuiebre <= 7 && rotacion.clasificacionRotacion !== 'sin_movimiento') {
      alertas.push({
        tipo: 'quiebre_inminente',
        severidad: 'warning',
        mensaje: `Stock para ${rotacion.diasParaQuiebre} dias - reponer pronto`,
        valor: rotacion.diasParaQuiebre,
        fechaCreacion: ahora
      });
    }

    // Caja congelada
    if (liquidez.clasificacion === 'critica' && rotacion.stockTotal > 0) {
      alertas.push({
        tipo: 'caja_congelada',
        severidad: 'danger',
        mensaje: `S/${liquidez.valorInventarioPEN.toFixed(0)} en inventario sin movimiento`,
        valor: liquidez.valorInventarioPEN,
        fechaCreacion: ahora
      });
    }

    // Margen bajo - read from product's category
    const categoriaPrincipal = producto.categorias?.find((c: any) => c.categoriaId === producto.categoriaPrincipalId) || producto.categorias?.[0];
    const margenMinimoCategoria = categoriaPrincipal?.margenMinimo ?? 20;
    if (rentabilidad.margenBrutoPromedio < margenMinimoCategoria && rentabilidad.margenBrutoPromedio > 0) {
      alertas.push({
        tipo: 'margen_bajo',
        severidad: 'warning',
        mensaje: `Margen ${rentabilidad.margenBrutoPromedio.toFixed(1)}% por debajo del minimo de categoria (${margenMinimoCategoria}%)`,
        valor: rentabilidad.margenBrutoPromedio,
        fechaCreacion: ahora
      });
    }

    // Tendencia negativa
    if (rotacion.tendencia === 'decreciendo' && rotacion.variacionVentas < -20) {
      alertas.push({
        tipo: 'tendencia_negativa',
        severidad: 'warning',
        mensaje: `Ventas cayendo ${Math.abs(rotacion.variacionVentas)}% vs periodo anterior`,
        valor: rotacion.variacionVentas,
        fechaCreacion: ahora
      });
    }

    // Oportunidad de reposicion (alta rotacion + bajo stock)
    if (
      (rotacion.clasificacionRotacion === 'muy_alta' || rotacion.clasificacionRotacion === 'alta') &&
      rotacion.diasParaQuiebre <= 15
    ) {
      alertas.push({
        tipo: 'oportunidad_reposicion',
        severidad: 'info',
        mensaje: `Alta rotacion - oportunidad de compra`,
        valor: rotacion.diasParaQuiebre,
        fechaCreacion: ahora
      });
    }

    // Sobre stock
    const stockMaximo = producto.stockMaximo || (rotacion.ventasPorMes * 3);
    if (rotacion.stockTotal > stockMaximo && stockMaximo > 0) {
      alertas.push({
        tipo: 'sobre_stock',
        severidad: 'info',
        mensaje: `Stock (${rotacion.stockTotal}) superior al maximo recomendado (${stockMaximo})`,
        valor: rotacion.stockTotal,
        fechaCreacion: ahora
      });
    }

    return alertas;
  },

  // ============================================
  // ANALISIS COMPLETO
  // ============================================

  /**
   * Genera analisis completo de inteligencia para un producto
   */
  async analizarProducto(producto: Producto, tc: number): Promise<ProductoIntel> {
    // Obtener ventas
    const [ventas90d, ordenesCompra] = await Promise.all([
      this.getVentasRecientes(90),
      this.getOrdenesCompra()
    ]);

    // Separar periodos
    const ahora = new Date();
    const hace30dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hace60dias = new Date(ahora.getTime() - 60 * 24 * 60 * 60 * 1000);

    const ventas30d = ventas90d.filter(v => {
      const fecha = v.fechaCreacion?.toDate?.() || new Date(0);
      return fecha >= hace30dias;
    });

    const ventas30dAnterior = ventas90d.filter(v => {
      const fecha = v.fechaCreacion?.toDate?.() || new Date(0);
      return fecha >= hace60dias && fecha < hace30dias;
    });

    // Calcular metricas
    const rotacion = this.calcularRotacion(producto, ventas30d, ventas90d, ventas30dAnterior);
    const rentabilidad = this.calcularRentabilidad(producto, ventas30d, ventas90d, tc);
    const liquidez = this.calcularScoreLiquidez(producto, rotacion, rentabilidad, tc);
    const alertas = this.generarAlertas(producto, rotacion, rentabilidad, liquidez);

    // Calcular lead time
    const leadTime = this.calcularLeadTimeProducto(producto.id, ordenesCompra);

    return {
      productoId: producto.id,
      sku: producto.sku,
      nombreComercial: producto.nombreComercial,
      marca: producto.marca,
      rotacion,
      rentabilidad,
      liquidez,
      leadTimePromedioDias: leadTime?.tiempoPromedioTotal,
      ultimaCompraFecha: leadTime?.ultimaCompra,
      alertas,
      lineaNegocioId: producto.lineaNegocioId,
      ultimoCalculo: ahora
    };
  },

  /**
   * Analiza todos los productos con stock real (excluye solo investigados)
   */
  async analizarTodosProductos(tc: number): Promise<ProductoIntel[]> {
    const [productos, ventas90d, ordenesCompra] = await Promise.all([
      this.getProductosConStock(), // Solo productos con stock real o historial de compra
      this.getVentasRecientes(90),
      this.getOrdenesCompra()
    ]);

    // Separar periodos
    const ahora = new Date();
    const hace30dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hace60dias = new Date(ahora.getTime() - 60 * 24 * 60 * 60 * 1000);

    const ventas30d = ventas90d.filter(v => {
      const fecha = v.fechaCreacion?.toDate?.() || new Date(0);
      return fecha >= hace30dias;
    });

    const ventas30dAnterior = ventas90d.filter(v => {
      const fecha = v.fechaCreacion?.toDate?.() || new Date(0);
      return fecha >= hace60dias && fecha < hace30dias;
    });

    // Analizar cada producto
    return productos.map(producto => {
      const rotacion = this.calcularRotacion(producto, ventas30d, ventas90d, ventas30dAnterior);
      const rentabilidad = this.calcularRentabilidad(producto, ventas30d, ventas90d, tc);
      const liquidez = this.calcularScoreLiquidez(producto, rotacion, rentabilidad, tc);
      const alertas = this.generarAlertas(producto, rotacion, rentabilidad, liquidez);
      const leadTime = this.calcularLeadTimeProducto(producto.id, ordenesCompra);

      return {
        productoId: producto.id,
        sku: producto.sku,
        nombreComercial: producto.nombreComercial,
        marca: producto.marca,
        rotacion,
        rentabilidad,
        liquidez,
        leadTimePromedioDias: leadTime?.tiempoPromedioTotal,
        ultimaCompraFecha: leadTime?.ultimaCompra,
        alertas,
        lineaNegocioId: producto.lineaNegocioId,
        ultimoCalculo: ahora
      };
    });
  },

  // ============================================
  // RESUMEN DE CAJA
  // ============================================

  /**
   * Genera resumen de caja por liquidez - EXPANDIDO con 4 categorías
   *
   * Categorías:
   * - Activa: Stock disponible con buena rotación (alta/media liquidez, NO reservado, NO en tránsito)
   * - Comprometida: Stock reservado (ya tiene comprador)
   * - Tránsito: Stock en camino USA → Perú
   * - Congelada: Stock sin movimiento o baja rotación
   */
  generarResumenCaja(productosIntel: ProductoIntel[], preventasVirtuales?: import('../types/productoIntel.types').PreventaVirtual[], tc: number = 3.70): ResumenCaja {
    // Inicializar categorías con estructura completa
    const cajaActiva = {
      productos: 0,
      unidades: 0,
      valorInventarioUSD: 0,
      valorInventarioPEN: 0,
      potencialVentaPEN: 0,
      potencialUtilidadPEN: 0,
      rotacionPromedioDias: 0
    };

    const cajaComprometida = {
      productos: 0,
      unidades: 0,
      valorInventarioUSD: 0,
      valorInventarioPEN: 0,
      potencialVentaPEN: 0,
      potencialUtilidadPEN: 0,
      adelantosRecibidosPEN: 0,
      porCobrarPEN: 0,
      ventasReservadas: 0
    };

    const cajaTransito = {
      productos: 0,
      unidades: 0,
      valorInventarioUSD: 0,
      valorInventarioPEN: 0,
      potencialVentaPEN: 0,
      potencialUtilidadPEN: 0,
      diasPromedioLlegada: 0,
      ordenesEnTransito: 0
    };

    const cajaCongelada = {
      productos: 0,
      unidades: 0,
      valorInventarioUSD: 0,
      valorInventarioPEN: 0,
      potencialVentaPEN: 0,
      potencialUtilidadPEN: 0,
      diasPromedioSinMovimiento: 0
    };

    // Legacy: mantener cajaMedia para compatibilidad
    const cajaMedia = {
      productos: 0,
      unidades: 0,
      valorInventarioUSD: 0,
      valorInventarioPEN: 0,
      potencialVentaPEN: 0,
      potencialUtilidadPEN: 0
    };

    let totalDiasSinMov = 0;
    let totalRotacionActiva = 0;
    let productosConRotacion = 0;

    for (const p of productosIntel) {
      const liq = p.liquidez;
      const rot = p.rotacion;

      // Primero: Separar stock por tipo (reservado, tránsito, disponible)
      const stockReservado = rot.stockReservado || 0;
      const stockTransito = rot.stockTransito || 0;
      const stockDisponible = rot.stockDisponible || 0;

      // Calcular valores por tipo de stock (proporcional al stock)
      const stockTotal = rot.stockTotal || 1; // evitar division por cero
      const costoUnitarioPEN = stockTotal > 0 ? liq.valorInventarioPEN / stockTotal : 0;
      const precioUnitarioPEN = stockTotal > 0 ? liq.potencialVentaPEN / stockTotal : 0;
      const utilidadUnitariaPEN = stockTotal > 0 ? liq.potencialUtilidadPEN / stockTotal : 0;

      // ===== CAJA COMPROMETIDA (stock reservado) =====
      if (stockReservado > 0) {
        cajaComprometida.productos++;
        cajaComprometida.unidades += stockReservado;
        cajaComprometida.valorInventarioPEN += stockReservado * costoUnitarioPEN;
        cajaComprometida.potencialVentaPEN += stockReservado * precioUnitarioPEN;
        cajaComprometida.potencialUtilidadPEN += stockReservado * utilidadUnitariaPEN;
      }

      // ===== CAJA EN TRÁNSITO =====
      if (stockTransito > 0) {
        cajaTransito.productos++;
        cajaTransito.unidades += stockTransito;
        cajaTransito.valorInventarioPEN += stockTransito * costoUnitarioPEN;
        cajaTransito.potencialVentaPEN += stockTransito * precioUnitarioPEN;
        cajaTransito.potencialUtilidadPEN += stockTransito * utilidadUnitariaPEN;
      }

      // ===== CAJA DISPONIBLE (Activa o Congelada según liquidez) =====
      if (stockDisponible > 0) {
        const valorDisponiblePEN = stockDisponible * costoUnitarioPEN;
        const potencialVentaDisponible = stockDisponible * precioUnitarioPEN;
        const utilidadDisponible = stockDisponible * utilidadUnitariaPEN;

        if (liq.clasificacion === 'alta' || liq.clasificacion === 'media') {
          // CAJA ACTIVA: buena rotación
          cajaActiva.productos++;
          cajaActiva.unidades += stockDisponible;
          cajaActiva.valorInventarioPEN += valorDisponiblePEN;
          cajaActiva.potencialVentaPEN += potencialVentaDisponible;
          cajaActiva.potencialUtilidadPEN += utilidadDisponible;

          if (rot.rotacionDias > 0 && rot.rotacionDias < 999) {
            totalRotacionActiva += rot.rotacionDias;
            productosConRotacion++;
          }

          // Legacy: también agregar a cajaMedia si es 'media'
          if (liq.clasificacion === 'media') {
            cajaMedia.productos++;
            cajaMedia.unidades += stockDisponible;
            cajaMedia.valorInventarioPEN += valorDisponiblePEN;
            cajaMedia.potencialVentaPEN += potencialVentaDisponible;
            cajaMedia.potencialUtilidadPEN += utilidadDisponible;
          }
        } else {
          // CAJA CONGELADA: baja/critica rotación
          cajaCongelada.productos++;
          cajaCongelada.unidades += stockDisponible;
          cajaCongelada.valorInventarioPEN += valorDisponiblePEN;
          cajaCongelada.potencialVentaPEN += potencialVentaDisponible;
          cajaCongelada.potencialUtilidadPEN += utilidadDisponible;
          totalDiasSinMov += rot.diasDesdeUltimaVenta;
        }
      }
    }

    // Calcular promedios
    cajaCongelada.diasPromedioSinMovimiento = cajaCongelada.productos > 0
      ? Math.round(totalDiasSinMov / cajaCongelada.productos)
      : 0;

    cajaActiva.rotacionPromedioDias = productosConRotacion > 0
      ? Math.round(totalRotacionActiva / productosConRotacion)
      : 0;

    const tcRef = tc;
    cajaActiva.valorInventarioUSD = Math.round(cajaActiva.valorInventarioPEN / tcRef * 100) / 100;
    cajaComprometida.valorInventarioUSD = Math.round(cajaComprometida.valorInventarioPEN / tcRef * 100) / 100;
    cajaTransito.valorInventarioUSD = Math.round(cajaTransito.valorInventarioPEN / tcRef * 100) / 100;
    cajaCongelada.valorInventarioUSD = Math.round(cajaCongelada.valorInventarioPEN / tcRef * 100) / 100;
    cajaMedia.valorInventarioUSD = Math.round(cajaMedia.valorInventarioPEN / tcRef * 100) / 100;

    // Preventas virtuales (Fase 3)
    const preventas = {
      cantidad: preventasVirtuales?.length || 0,
      valorTotalPEN: preventasVirtuales?.reduce((sum, pv) => sum + pv.totalVenta, 0) || 0,
      adelantosRecibidosPEN: preventasVirtuales?.reduce((sum, pv) => sum + pv.montoAdelanto, 0) || 0,
      detalles: preventasVirtuales || []
    };

    // Totales
    const totalInventarioPEN = cajaActiva.valorInventarioPEN + cajaComprometida.valorInventarioPEN +
                               cajaTransito.valorInventarioPEN + cajaCongelada.valorInventarioPEN;
    const totalInventarioUSD = cajaActiva.valorInventarioUSD + cajaComprometida.valorInventarioUSD +
                               cajaTransito.valorInventarioUSD + cajaCongelada.valorInventarioUSD;
    const totalPotencialVentaPEN = cajaActiva.potencialVentaPEN + cajaComprometida.potencialVentaPEN +
                                   cajaTransito.potencialVentaPEN + cajaCongelada.potencialVentaPEN;
    const totalPotencialUtilidadPEN = cajaActiva.potencialUtilidadPEN + cajaComprometida.potencialUtilidadPEN +
                                      cajaTransito.potencialUtilidadPEN + cajaCongelada.potencialUtilidadPEN;

    // Porcentajes
    const calcPorcentaje = (valor: number) => totalInventarioPEN > 0
      ? Math.round((valor / totalInventarioPEN) * 100)
      : 0;

    return {
      cajaActiva,
      cajaComprometida,
      cajaTransito,
      cajaCongelada,
      cajaMedia, // Legacy
      preventasVirtuales: preventas,
      totalInventarioUSD: Math.round(totalInventarioUSD * 100) / 100,
      totalInventarioPEN: Math.round(totalInventarioPEN * 100) / 100,
      totalPotencialVentaPEN: Math.round(totalPotencialVentaPEN * 100) / 100,
      totalPotencialUtilidadPEN: Math.round(totalPotencialUtilidadPEN * 100) / 100,
      porcentajeCajaActiva: calcPorcentaje(cajaActiva.valorInventarioPEN),
      porcentajeCajaComprometida: calcPorcentaje(cajaComprometida.valorInventarioPEN),
      porcentajeCajaTransito: calcPorcentaje(cajaTransito.valorInventarioPEN),
      porcentajeCajaCongelada: calcPorcentaje(cajaCongelada.valorInventarioPEN),
      porcentajeCajaMedia: calcPorcentaje(cajaMedia.valorInventarioPEN)
    };
  },

  // ============================================
  // FLUJO DE CAJA PROYECTADO
  // ============================================

  /**
   * Genera proyeccion de flujo de caja
   */
  async generarFlujoCajaProyectado(
    productosIntel: ProductoIntel[],
    tc: number
  ): Promise<FlujoCajaProyectado> {
    // Proyeccion de ingresos basada en rotacion
    let ingresosProyectados7d = 0;
    let ingresosProyectados15d = 0;
    let ingresosProyectados30d = 0;

    for (const p of productosIntel) {
      const ventaDiaria = p.rotacion.promedioVentasDiarias;
      const precioPromedio = p.rentabilidad.precioVentaPromedio || 0;

      ingresosProyectados7d += ventaDiaria * 7 * precioPromedio;
      ingresosProyectados15d += ventaDiaria * 15 * precioPromedio;
      ingresosProyectados30d += ventaDiaria * 30 * precioPromedio;
    }

    // Obtener ventas pendientes de cobro (contra entrega)
    const ventasRecientes = await this.getVentasRecientes(30);
    const ventasPendientes = ventasRecientes.filter(v =>
      v.estadoPago !== 'pagado' &&
      ['confirmada', 'asignada', 'en_entrega', 'despachada'].includes(v.estado)
    );

    const cajaPendienteCobrar = ventasPendientes.reduce((sum, v) => {
      const pagado = v.pagos?.reduce((s, p) => s + p.monto, 0) || 0;
      return sum + (v.totalPEN - pagado);
    }, 0);

    // Caja confirmada (ventas pagadas)
    const ventasPagadas = ventasRecientes.filter(v => v.estadoPago === 'pagado');
    const cajaConfirmada = ventasPagadas.reduce((sum, v) => sum + v.totalPEN, 0);

    // Egresos comprometidos (OC pendientes)
    const ordenesCompra = await this.getOrdenesCompra();
    const ocPendientes = ordenesCompra.filter(oc =>
      oc.estadoPago !== 'pagada' &&
      oc.estado !== 'cancelada'
    );

    const egresosComprometidos = ocPendientes.reduce((sum, oc) => {
      const pagado = oc.historialPagos?.reduce((s, p) => s + p.montoPEN, 0) || 0;
      return sum + ((oc.totalPEN || oc.totalUSD * tc) - pagado);
    }, 0);

    return {
      ingresosProyectados7d: Math.round(ingresosProyectados7d),
      ingresosProyectados15d: Math.round(ingresosProyectados15d),
      ingresosProyectados30d: Math.round(ingresosProyectados30d),
      cajaPendienteCobrar: Math.round(cajaPendienteCobrar),
      ventasPendientesCobro: ventasPendientes.length,
      cajaConfirmada: Math.round(cajaConfirmada),
      egresosComprometidos: Math.round(egresosComprometidos),
      ordenesCompraPendientes: ocPendientes.length,
      flujoNetoProyectado30d: Math.round(ingresosProyectados30d - egresosComprometidos)
    };
  },

  // ============================================
  // SUGERENCIAS DE REPOSICION
  // ============================================

  /**
   * Genera sugerencias de reposicion ordenadas por prioridad
   * SOLO para productos que tienen historial de ventas real
   */
  generarSugerenciasReposicion(
    productosIntel: ProductoIntel[],
    tc: number
  ): SugerenciaReposicion[] {
    const sugerencias: SugerenciaReposicion[] = [];

    for (const p of productosIntel) {
      const rotacion = p.rotacion;
      const rentabilidad = p.rentabilidad;
      const liquidez = p.liquidez;

      // FILTRO CRITICO: Solo sugerir reposicion de productos que:
      // 1. Tienen historial de ventas (unidadesVendidas90d > 0), O
      // 2. Tienen stock actual Y rotacion conocida
      const tieneHistorialVentas = rotacion.unidadesVendidas90d > 0;
      const tieneStockYRotacion = rotacion.stockTotal > 0 && rotacion.promedioVentasDiarias > 0;

      if (!tieneHistorialVentas && !tieneStockYRotacion) {
        continue; // Saltar productos sin historial real
      }

      // Solo productos con rotacion positiva o stock critico
      if (rotacion.clasificacionRotacion === 'sin_movimiento' && rotacion.stockTotal > 5) {
        continue; // No sugerir reponer productos sin movimiento que ya tienen stock
      }

      // Calcular si necesita reposicion
      const stockMinimo = rotacion.ventasPorMes > 0 ? Math.max(rotacion.ventasPorMes * 0.5, 3) : 3;
      const necesitaReposicion =
        (rotacion.stockDisponible <= stockMinimo && tieneHistorialVentas) ||
        (rotacion.diasParaQuiebre <= 15 && rotacion.diasParaQuiebre > 0) ||
        (liquidez.clasificacion === 'alta' && rotacion.stockTotal < rotacion.ventasPorMes * 2);

      if (!necesitaReposicion) continue;

      // Calcular cantidad sugerida (stock para 45 dias de venta)
      const leadTime = p.leadTimePromedioDias || 30;
      const stockObjetivo = rotacion.promedioVentasDiarias * (leadTime + 45);
      const cantidadSugerida = Math.max(
        Math.ceil(stockObjetivo - rotacion.stockTotal),
        5 // Minimo 5 unidades
      );

      // Determinar urgencia
      let urgencia: 'critica' | 'alta' | 'media' | 'baja';
      if (rotacion.stockDisponible === 0) urgencia = 'critica';
      else if (rotacion.diasParaQuiebre <= 7) urgencia = 'critica';
      else if (rotacion.diasParaQuiebre <= 15) urgencia = 'alta';
      else if (liquidez.clasificacion === 'alta') urgencia = 'media';
      else urgencia = 'baja';

      // Razon
      let razon = '';
      if (rotacion.stockDisponible === 0) razon = 'Sin stock disponible';
      else if (rotacion.diasParaQuiebre <= 7) razon = `Stock para ${rotacion.diasParaQuiebre} dias`;
      else if (liquidez.clasificacion === 'alta') razon = 'Alta rotacion - oportunidad de venta';
      else razon = 'Stock por debajo del minimo';

      // Proyecciones
      const inversionEstimadaUSD = cantidadSugerida * rentabilidad.costoPromedioConFlete;
      const utilidadProyectadaPEN = cantidadSugerida * rentabilidad.utilidadPorUnidad;
      const tiempoRecuperacionDias = rotacion.promedioVentasDiarias > 0
        ? Math.ceil(cantidadSugerida / rotacion.promedioVentasDiarias)
        : 999;

      // Score de prioridad (para ordenar)
      let scorePrioridad = 0;
      if (urgencia === 'critica') scorePrioridad += 40;
      else if (urgencia === 'alta') scorePrioridad += 30;
      else if (urgencia === 'media') scorePrioridad += 20;
      else scorePrioridad += 10;

      scorePrioridad += liquidez.score * 0.5; // Hasta 50 puntos por liquidez
      scorePrioridad += Math.min(rentabilidad.roiPromedio * 0.1, 10); // Hasta 10 puntos por ROI

      sugerencias.push({
        productoId: p.productoId,
        sku: p.sku,
        nombreComercial: p.nombreComercial,
        marca: p.marca,
        stockActual: rotacion.stockTotal,
        stockMinimo: Math.round(stockMinimo),
        diasParaQuiebre: rotacion.diasParaQuiebre,
        cantidadSugerida,
        urgencia,
        razon,
        inversionEstimadaUSD: Math.round(inversionEstimadaUSD * 100) / 100,
        utilidadProyectadaPEN: Math.round(utilidadProyectadaPEN * 100) / 100,
        tiempoRecuperacionDias,
        scorePrioridad: Math.round(scorePrioridad)
      });
    }

    // Ordenar por score de prioridad (mayor primero)
    return sugerencias.sort((a, b) => b.scorePrioridad - a.scorePrioridad);
  },

  // ============================================
  // LEAD TIME
  // ============================================

  /**
   * Calcula lead time para un producto basado en OC historicas
   */
  calcularLeadTimeProducto(
    productoId: string,
    ordenesCompra: OrdenCompra[]
  ): { tiempoPromedioTotal: number; ultimaCompra?: Date } | null {
    // Filtrar OC que contengan este producto y esten completadas
    const ocProducto = ordenesCompra.filter(oc =>
      oc.estado === 'recibida' &&
      oc.productos?.some(p => p.productoId === productoId) &&
      oc.fechaCreacion && oc.fechaRecibida
    );

    if (ocProducto.length === 0) return null;

    // Calcular tiempos
    const tiempos = ocProducto.map(oc => {
      const fechaCreacion = oc.fechaCreacion?.toDate?.() || new Date();
      const fechaRecibida = oc.fechaRecibida?.toDate?.() || new Date();
      return Math.floor((fechaRecibida.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));
    }).filter(t => t > 0 && t < 365); // Filtrar outliers

    if (tiempos.length === 0) return null;

    const tiempoPromedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;

    // Ultima compra
    const ultimaOC = ocProducto.sort((a, b) => {
      const fechaA = a.fechaCreacion?.toDate?.() || new Date(0);
      const fechaB = b.fechaCreacion?.toDate?.() || new Date(0);
      return fechaB.getTime() - fechaA.getTime();
    })[0];

    return {
      tiempoPromedioTotal: Math.round(tiempoPromedio),
      ultimaCompra: ultimaOC?.fechaCreacion?.toDate?.()
    };
  },

  /**
   * Calcula lead time global (todos los productos/proveedores)
   */
  async calcularLeadTimeGlobal(): Promise<MetricasLeadTime> {
    const ordenesCompra = await this.getOrdenesCompra();

    const ocCompletadas = ordenesCompra.filter(oc =>
      oc.estado === 'recibida' &&
      oc.fechaCreacion && oc.fechaRecibida
    );

    if (ocCompletadas.length === 0) {
      return {
        tiempoPromedioTotal: 0,
        tiempoPromedioCompraEnvio: 0,
        tiempoPromedioTransitoUSA: 0,
        tiempoPromedioUSAPeru: 0,
        tiempoMinimo: 0,
        tiempoMaximo: 0,
        desviacionEstandar: 0,
        ordenesAnalizadas: 0,
        periodoAnalisis: { desde: new Date(), hasta: new Date() }
      };
    }

    // Calcular tiempos totales
    const tiempos = ocCompletadas.map(oc => {
      const fechaCreacion = oc.fechaCreacion?.toDate?.() || new Date();
      const fechaRecibida = oc.fechaRecibida?.toDate?.() || new Date();
      return Math.floor((fechaRecibida.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));
    }).filter(t => t > 0 && t < 365);

    const tiempoPromedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
    const tiempoMinimo = Math.min(...tiempos);
    const tiempoMaximo = Math.max(...tiempos);

    // Desviacion estandar
    const varianza = tiempos.reduce((sum, t) => sum + Math.pow(t - tiempoPromedio, 2), 0) / tiempos.length;
    const desviacionEstandar = Math.sqrt(varianza);

    // Periodo de analisis
    const fechas = ocCompletadas.map(oc => oc.fechaCreacion?.toDate?.() || new Date());
    const desde = new Date(Math.min(...fechas.map(f => f.getTime())));
    const hasta = new Date(Math.max(...fechas.map(f => f.getTime())));

    // Tiempos parciales (estimados si no hay datos detallados)
    // Asumimos: 30% compra-envio, 20% transito USA, 50% USA-Peru
    const tiempoPromedioCompraEnvio = Math.round(tiempoPromedio * 0.3);
    const tiempoPromedioTransitoUSA = Math.round(tiempoPromedio * 0.2);
    const tiempoPromedioUSAPeru = Math.round(tiempoPromedio * 0.5);

    return {
      tiempoPromedioTotal: Math.round(tiempoPromedio),
      tiempoPromedioCompraEnvio,
      tiempoPromedioTransitoUSA,
      tiempoPromedioUSAPeru,
      tiempoMinimo,
      tiempoMaximo,
      desviacionEstandar: Math.round(desviacionEstandar * 10) / 10,
      ordenesAnalizadas: ocCompletadas.length,
      periodoAnalisis: { desde, hasta }
    };
  },

  // ============================================
  // RENDIMIENTO POR CANAL
  // ============================================

  /**
   * Calcula rendimiento de productos por canal de venta
   */
  async calcularRendimientoPorCanal(
    productoId: string,
    dias: number = 90
  ): Promise<RendimientoProductoCanal[]> {
    const ventas = await this.getVentasRecientes(dias);
    const estadosValidos = ['confirmada', 'asignada', 'en_entrega', 'despachada', 'entrega_parcial', 'entregada'];

    const ventasProducto = ventas.filter(v =>
      estadosValidos.includes(v.estado) &&
      v.productos?.some(p => p.productoId === productoId)
    );

    // Agrupar por canal
    const porCanal = new Map<string, RendimientoProductoCanal>();

    for (const venta of ventasProducto) {
      const canal = venta.canal || 'directo';
      const producto = venta.productos?.find(p => p.productoId === productoId);
      if (!producto) continue;

      if (!porCanal.has(canal)) {
        porCanal.set(canal, {
          productoId,
          canalId: canal,
          canalNombre: canal,
          unidadesVendidas: 0,
          ventasBrutasPEN: 0,
          comisionesCanal: 0,
          gastosEnvioCanal: 0,
          ventasNetasPEN: 0,
          margenNetoCanal: 0,
          porcentajeVentasTotal: 0,
          esCanallMasRentable: false
        });
      }

      const data = porCanal.get(canal)!;
      data.unidadesVendidas += producto.cantidad;
      data.ventasBrutasPEN += producto.subtotal;

      // Prorratear gastos de la venta
      const totalProductosVenta = venta.productos?.reduce((s, p) => s + p.subtotal, 0) || 1;
      const proporcion = producto.subtotal / totalProductosVenta;

      data.comisionesCanal += (venta.comisionML || 0) * proporcion;
      data.gastosEnvioCanal += (venta.costoEnvioNegocio || 0) * proporcion;
    }

    // Calcular totales y metricas
    const totalUnidades = Array.from(porCanal.values()).reduce((s, c) => s + c.unidadesVendidas, 0);
    let maxMargen = -Infinity;
    let canalMasRentable = '';

    for (const [canal, data] of porCanal) {
      data.ventasNetasPEN = data.ventasBrutasPEN - data.comisionesCanal - data.gastosEnvioCanal;
      data.margenNetoCanal = data.ventasBrutasPEN > 0
        ? Math.round((data.ventasNetasPEN / data.ventasBrutasPEN) * 100 * 10) / 10
        : 0;
      data.porcentajeVentasTotal = totalUnidades > 0
        ? Math.round((data.unidadesVendidas / totalUnidades) * 100)
        : 0;

      if (data.margenNetoCanal > maxMargen) {
        maxMargen = data.margenNetoCanal;
        canalMasRentable = canal;
      }
    }

    // Marcar el canal mas rentable
    if (canalMasRentable && porCanal.has(canalMasRentable)) {
      porCanal.get(canalMasRentable)!.esCanallMasRentable = true;
    }

    return Array.from(porCanal.values());
  },

  // ============================================
  // PREVENTAS VIRTUALES (Fase 3)
  // ============================================

  /**
   * Obtiene preventas virtuales (ventas reservadas sin stock físico)
   * Estas son ventas en estado 'reservada' con tipoReserva: 'virtual'
   */
  async getPreventasVirtuales(): Promise<import('../types/productoIntel.types').PreventaVirtual[]> {
    try {
      const ventasRef = collection(db, 'ventas');
      const q = query(
        ventasRef,
        where('estado', '==', 'reservada')
      );

      const snapshot = await getDocs(q);
      const ventas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Venta[];

      const preventas: import('../types/productoIntel.types').PreventaVirtual[] = [];

      for (const venta of ventas) {
        // Solo preventas virtuales (sin stock físico disponible al momento)
        if (venta.stockReservado?.tipoReserva !== 'virtual') continue;
        if (!venta.stockReservado?.activo) continue;

        const productosVirtuales = venta.stockReservado.stockVirtual?.productosVirtuales || [];
        if (productosVirtuales.length === 0) continue;

        preventas.push({
          ventaId: venta.id,
          numeroVenta: venta.numeroVenta,
          clienteNombre: venta.nombreCliente,
          fechaReserva: venta.stockReservado.fechaReserva?.toDate?.() || new Date(),
          vigenciaHasta: venta.stockReservado.vigenciaHasta?.toDate?.() || new Date(),
          montoAdelanto: venta.stockReservado.montoAdelanto || 0,
          totalVenta: venta.totalPEN,
          productos: productosVirtuales.map(pv => ({
            productoId: pv.productoId,
            sku: pv.sku,
            nombreProducto: pv.nombreProducto,
            cantidadRequerida: pv.cantidadRequerida,
            cantidadFaltante: pv.cantidadFaltante
          })),
          requerimientoId: venta.stockReservado.stockVirtual?.requerimientoGenerado,
          fechaEstimadaStock: venta.stockReservado.stockVirtual?.fechaEstimadaStock?.toDate?.()
        });
      }

      return preventas;
    } catch (error) {
      console.error('Error obteniendo preventas virtuales:', error);
      return [];
    }
  }
};
