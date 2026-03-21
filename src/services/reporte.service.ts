import { Timestamp } from 'firebase/firestore';
import type { 
  ResumenEjecutivo,
  ProductoRentabilidad,
  InventarioValorizado,
  VentasPorCanal,
  TendenciaVentas,
  AlertaInventario,
  RangoFechas
} from '../types/reporte.types';
import { ProductoService } from './producto.service';
import { inventarioService } from './inventario.service';
import { VentaService } from './venta.service';
import { OrdenCompraService } from './ordenCompra.service';
import { tipoCambioService } from './tipoCambio.service';
import { transferenciaService } from './transferencia.service';

export class ReporteService {
  /**
   * Obtener resumen ejecutivo completo
   */
  static async getResumenEjecutivo(rango?: RangoFechas): Promise<ResumenEjecutivo> {
    try {
      // Si no se proporciona rango, usar rango por defecto (mes actual)
      const ahora = new Date();
      const rangoFinal = rango || {
        inicio: new Date(ahora.getFullYear(), ahora.getMonth(), 1),
        fin: ahora
      };

      const [
        ventasStats,
        productos,
        ordenesStats,
        productosMasVendidos
      ] = await Promise.all([
        VentaService.getStats(),
        ProductoService.getAll(),
        OrdenCompraService.getStats(),
        this.getProductosRentabilidad(rangoFinal)
      ]);

      // Obtener TC actual y promedio mensual
      const [tcActual, tcPromedioMensual] = await Promise.all([
        tipoCambioService.getTCDelDia(),
        tipoCambioService.getPromedioMensual()
      ]);

      // Calcular ventas por período (basado en el rango seleccionado)
      const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
      const inicioSemana = new Date(ahora);
      inicioSemana.setDate(ahora.getDate() - 7);
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

      const [ventasHoy, ventasSemana, ventasMes, ventasRango, transferencias, ventas] = await Promise.all([
        this.getVentasPorRango({ inicio: inicioHoy, fin: ahora }),
        this.getVentasPorRango({ inicio: inicioSemana, fin: ahora }),
        this.getVentasPorRango({ inicio: inicioMes, fin: ahora }),
        this.getVentasPorRango(rangoFinal),
        transferenciaService.getAll(),
        VentaService.getAll()
      ]);

      // Calcular costo total de flete de transferencias USA→Perú
      const costoFleteTotal = transferencias
        .filter(t => t.tipo === 'usa_peru' && t.costoFleteTotal)
        .reduce((sum, t) => sum + (t.costoFleteTotal || 0), 0);

      // Calcular costo de envío asumido por la empresa (incluyeEnvio = true)
      const costoEnvioAsumidoPEN = ventas
        .filter(v => v.estado !== 'cancelada' && v.estado !== 'cotizacion' && v.incluyeEnvio && v.costoEnvio)
        .reduce((sum, v) => sum + (v.costoEnvio || 0), 0);

      // NOTA: Inventario valorizado se calcula por separado (getInventarioValorizado)
      // para no bloquear el resumen. Los valores se computan en el frontend.

      return {
        // Ventas
        ventasTotalesPEN: ventasStats.ventasTotalPEN,
        ventasMes: ventasMes.totalPEN,
        ventasSemana: ventasSemana.totalPEN,
        ventasHoy: ventasHoy.totalPEN,

        // Ventas del rango seleccionado
        ventasRangoPEN: ventasRango.totalPEN,
        ventasRangoCantidad: ventasRango.cantidad,
        utilidadRangoPEN: ventasRango.utilidadPEN,

        // Rentabilidad
        utilidadTotalPEN: ventasStats.utilidadTotalPEN,
        margenPromedio: ventasStats.margenPromedio,
        costoEnvioAsumidoPEN,

        // Inventario (se completa en frontend con datos de inventarioValorizado)
        valorInventarioPEN: 0,
        unidadesTotales: 0,
        unidadesDisponibles: 0,

        // Órdenes (inversión = mercancía + flete)
        ordenesActivas: ordenesStats.enviadas + ordenesStats.pagadas + ordenesStats.enTransito,
        ordenesRecibidas: ordenesStats.recibidas,
        inversionTotalUSD: ordenesStats.valorTotalUSD + costoFleteTotal,
        
        // Productos
        productosActivos: productos.filter(p => p.estado === 'activo').length,
        productosMasVendidos: productosMasVendidos.slice(0, 5),
        
        // TC
        tcActual: tcActual ? (tcActual.compra + tcActual.venta) / 2 : 0,
        tcPromedio: tcPromedioMensual || (tcActual ? (tcActual.compra + tcActual.venta) / 2 : 0)
      };
    } catch (error: any) {
      console.error('Error al obtener resumen ejecutivo:', error);
      throw new Error('Error al generar resumen');
    }
  }

  /**
   * Obtener productos ordenados por rentabilidad
   * VERSIÓN ROBUSTA - Calcula el descuento desde los datos reales
   * y detecta/convierte costos en USD a PEN
   */
  static async getProductosRentabilidad(rango: RangoFechas): Promise<ProductoRentabilidad[]> {
    try {
      const ventas = await VentaService.getAll();
      const ventasEntregadas = ventas.filter(v => {
        if (v.estado !== 'entregada') return false;
        // Excluir ventas a socios de reportes de rentabilidad
        if (v.esVentaSocio) return false;
        // Fallback: fechaEntrega → fechaDespacho → fechaCreacion (legacy sin fecha de entrega)
        const fecha = v.fechaEntrega?.toDate?.()
          || (v as any).fechaDespacho?.toDate?.()
          || v.fechaCreacion?.toDate?.();
        if (!fecha) return false;
        return fecha >= rango.inicio && fecha <= rango.fin;
      });

      // Obtener tipo de cambio centralizado (no bloquea si stale — es reporte)
      const tipoCambioVenta = await tipoCambioService.resolverTCVenta();

      const productosMap = new Map<string, ProductoRentabilidad>();

      for (const venta of ventasEntregadas) {
        // CALCULAR descuento de manera robusta desde los datos reales
        const subtotalProductos = venta.productos.reduce((sum, p) => sum + p.subtotal, 0);

        // Calcular factor de descuento: totalReal / subtotal
        const factorDescuento = subtotalProductos > 0
          ? (venta.totalPEN / subtotalProductos)
          : 1;

        for (const producto of venta.productos) {
          if (!productosMap.has(producto.productoId)) {
            productosMap.set(producto.productoId, {
              productoId: producto.productoId,
              sku: producto.sku,
              marca: producto.marca,
              nombreComercial: producto.nombreComercial,
              unidadesVendidas: 0,
              ventasTotalPEN: 0,
              costoTotalPEN: 0,
              utilidadPEN: 0,
              margenPromedio: 0,
              precioPromedioVenta: 0,
              costoPromedioUnidad: 0
            });
          }

          const item = productosMap.get(producto.productoId)!;

          // Aplicar el factor de descuento proporcional al subtotal del producto
          const ventaRealProducto = producto.subtotal * factorDescuento;

          // Detectar si el costo está en USD (datos legacy)
          // Heurística: si el costo por unidad es < 30% del precio de venta,
          // probablemente está en USD y necesita conversión
          let costoProducto = producto.costoTotalUnidades || 0;
          if (costoProducto > 0 && producto.cantidad > 0) {
            const costoPorUnidad = costoProducto / producto.cantidad;
            const precioPorUnidad = producto.subtotal / producto.cantidad;
            const ratioCosteVenta = costoPorUnidad / precioPorUnidad;

            // Si el ratio es menor a 0.15 (15%), el costo probablemente está en USD
            // Un margen del 85%+ es imposible en este negocio
            if (ratioCosteVenta < 0.15) {
              costoProducto = costoProducto * tipoCambioVenta;
            }
          }

          item.unidadesVendidas += producto.cantidad;
          item.ventasTotalPEN += ventaRealProducto;
          item.costoTotalPEN += costoProducto;
        }
      }

      // Calcular promedios y utilidad
      const productos = Array.from(productosMap.values()).map(p => ({
        ...p,
        utilidadPEN: p.ventasTotalPEN - p.costoTotalPEN,
        margenPromedio: p.ventasTotalPEN > 0
          ? ((p.ventasTotalPEN - p.costoTotalPEN) / p.ventasTotalPEN) * 100
          : 0,
        precioPromedioVenta: p.unidadesVendidas > 0
          ? p.ventasTotalPEN / p.unidadesVendidas
          : 0,
        costoPromedioUnidad: p.unidadesVendidas > 0
          ? p.costoTotalPEN / p.unidadesVendidas
          : 0
      }));

      // Ordenar por ventas totales
      return productos.sort((a, b) => b.ventasTotalPEN - a.ventasTotalPEN);
    } catch (error: any) {
      console.error('Error al obtener rentabilidad:', error);
      throw new Error('Error al calcular rentabilidad');
    }
  }

  /**
   * Obtener inventario valorizado
   */
  static async getInventarioValorizado(): Promise<InventarioValorizado[]> {
    try {
      const productos = await ProductoService.getAll();
      const inventarioValorizado: InventarioValorizado[] = [];

      // Obtener tipo de cambio centralizado para conversión USD → PEN
      const tipoCambioVenta = await tipoCambioService.resolverTCVenta();

      for (const producto of productos) {
        if (producto.estado !== 'activo') continue;

        const inventario = await inventarioService.getInventarioProducto(producto.id);

        if (inventario.length === 0) continue;

        // Verificar que tenga unidades activas (no solo vendidas/dañadas)
        const tieneActivas = inventario.some(i => i.disponibles > 0 || i.reservadas > 0 || i.enTransito > 0);
        if (!tieneActivas) continue;

        // Agregar datos por país
        const inventarioUSA = inventario.filter(i => i.pais === 'USA');
        const inventarioPeru = inventario.filter(i => i.pais === 'Peru');

        const unidadesDisponibles = inventario.reduce((sum, i) => sum + i.disponibles, 0);
        const unidadesAsignadas = inventario.reduce((sum, i) => sum + i.reservadas, 0);
        const enTransito = inventario.reduce((sum, i) => sum + i.enTransito, 0);
        // Total = solo unidades activas (disponibles + reservadas + en tránsito)
        // NO incluir vendidas/dañadas/vencidas — ya no son inventario
        const unidadesTotal = unidadesDisponibles + unidadesAsignadas + enTransito;

        // Ubicación: solo unidades activas por país (genérico)
        const unidadesPorPais: Record<string, number> = {};
        for (const inv of inventario) {
          const pais = inv.pais || 'Sin país';
          const activas = (inv.disponibles || 0) + (inv.reservadas || 0) + (inv.enTransito || 0);
          if (activas > 0) {
            unidadesPorPais[pais] = (unidadesPorPais[pais] || 0) + activas;
          }
        }

        // Backward compat: mantener campos legacy
        const unidadesMiami = inventarioUSA.reduce((sum, i) => sum + i.disponibles + i.reservadas + i.enTransito, 0);
        const unidadesUtah = 0;
        const unidadesPeru = inventarioPeru.reduce((sum, i) => sum + i.disponibles + i.reservadas + i.enTransito, 0);

        // valorTotalUSD ya solo incluye unidades activas (calculado en inventario.service)
        const valorTotalUSD = inventario.reduce((sum, i) => sum + i.valorTotalUSD, 0);
        const valorTotalPEN = valorTotalUSD * tipoCambioVenta;
        // costoPromedio: valorTotal ya es de activas, dividir por unidades activas
        const costoPromedioUSD = unidadesTotal > 0 ? valorTotalUSD / unidadesTotal : 0;
        const costoPromedioPEN = costoPromedioUSD * tipoCambioVenta;

        inventarioValorizado.push({
          productoId: producto.id,
          sku: producto.sku,
          marca: producto.marca,
          nombreComercial: producto.nombreComercial,
          unidadesDisponibles,
          unidadesAsignadas,
          unidadesTotal,
          valorTotalPEN,
          costoPromedioUnidad: costoPromedioPEN,
          unidadesMiami,
          unidadesUtah,
          unidadesPeru,
          unidadesPorPais
        });
      }

      return inventarioValorizado.sort((a, b) => b.valorTotalPEN - a.valorTotalPEN);
    } catch (error: any) {
      console.error('Error al obtener inventario valorizado:', error);
      throw new Error('Error al calcular inventario');
    }
  }

  /**
   * Obtener ventas por canal
   */
  static async getVentasPorCanal(rango?: RangoFechas): Promise<VentasPorCanal> {
    try {
      const ventas = await VentaService.getAll();
      // Incluir todas las ventas válidas (no cotizaciones ni canceladas ni ventas a socios)
      const estadosValidos = ['confirmada', 'parcial', 'asignada', 'en_entrega', 'despachada', 'entrega_parcial', 'entregada', 'reservada'];
      let ventasValidas = ventas.filter(v => estadosValidos.includes(v.estado) && !v.esVentaSocio);

      // Filtrar por rango si se proporciona
      if (rango) {
        ventasValidas = ventasValidas.filter(v => {
          const fechaVenta = v.fechaEntrega?.toDate() || v.fechaConfirmacion?.toDate() || v.fechaCreacion?.toDate();
          if (!fechaVenta) return false;
          return fechaVenta >= rango.inicio && fechaVenta <= rango.fin;
        });
      }

      const stats: VentasPorCanal = {
        mercadoLibre: { cantidad: 0, totalPEN: 0, porcentaje: 0 },
        directo: { cantidad: 0, totalPEN: 0, porcentaje: 0 },
        otro: { cantidad: 0, totalPEN: 0, porcentaje: 0 }
      };

      let totalVentas = 0;

      ventasValidas.forEach(venta => {
        totalVentas += venta.totalPEN;

        if (venta.canal === 'mercado_libre') {
          stats.mercadoLibre.cantidad++;
          stats.mercadoLibre.totalPEN += venta.totalPEN;
        } else if (venta.canal === 'directo') {
          stats.directo.cantidad++;
          stats.directo.totalPEN += venta.totalPEN;
        } else {
          stats.otro.cantidad++;
          stats.otro.totalPEN += venta.totalPEN;
        }
      });

      // Calcular porcentajes
      if (totalVentas > 0) {
        stats.mercadoLibre.porcentaje = (stats.mercadoLibre.totalPEN / totalVentas) * 100;
        stats.directo.porcentaje = (stats.directo.totalPEN / totalVentas) * 100;
        stats.otro.porcentaje = (stats.otro.totalPEN / totalVentas) * 100;
      }

      return stats;
    } catch (error: any) {
      console.error('Error al obtener ventas por canal:', error);
      throw new Error('Error al calcular ventas por canal');
    }
  }

  /**
   * Obtener tendencia de ventas
   * Incluye ventas confirmadas, asignadas, en_entrega y entregadas
   */
  static async getTendenciaVentas(rango?: RangoFechas): Promise<TendenciaVentas[]> {
    try {
      const ventas = await VentaService.getAll();
      // Incluir todas las ventas válidas (no cotizaciones ni canceladas ni ventas a socios)
      const estadosValidos = ['confirmada', 'parcial', 'asignada', 'en_entrega', 'despachada', 'entrega_parcial', 'entregada', 'reservada'];
      const ventasValidas = ventas.filter(v => estadosValidos.includes(v.estado) && !v.esVentaSocio);

      // Usar rango proporcionado o default últimos 30 días
      const fin = rango?.fin || new Date();
      const inicio = rango?.inicio || (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();

      // Calcular días entre inicio y fin
      const msPerDay = 24 * 60 * 60 * 1000;
      const dias = Math.max(1, Math.ceil((fin.getTime() - inicio.getTime()) / msPerDay) + 1);

      const tendencias: TendenciaVentas[] = [];

      for (let i = 0; i < dias; i++) {
        const fecha = new Date(inicio);
        fecha.setDate(inicio.getDate() + i);
        fecha.setHours(0, 0, 0, 0);

        const fechaFinDia = new Date(fecha);
        fechaFinDia.setHours(23, 59, 59, 999);

        const ventasDia = ventasValidas.filter(v => {
          // Usar fechaEntrega si existe, sino fechaConfirmacion, sino fechaCreacion
          const fechaVenta = v.fechaEntrega?.toDate() || v.fechaConfirmacion?.toDate() || v.fechaCreacion?.toDate();
          if (!fechaVenta) return false;
          return fechaVenta >= fecha && fechaVenta <= fechaFinDia;
        });

        const totalVentas = ventasDia.reduce((sum, v) => sum + v.totalPEN, 0);
        const totalUtilidad = ventasDia.reduce((sum, v) => sum + (v.utilidadBrutaPEN || 0), 0);
        const margenPromedio = totalVentas > 0 ? (totalUtilidad / totalVentas) * 100 : 0;

        tendencias.push({
          fecha: fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
          ventas: totalVentas,
          utilidad: totalUtilidad,
          margen: margenPromedio
        });
      }

      return tendencias;
    } catch (error: any) {
      console.error('Error al obtener tendencia:', error);
      throw new Error('Error al calcular tendencia');
    }
  }

  /**
   * Obtener alertas de inventario
   */
  static async getAlertasInventario(): Promise<AlertaInventario[]> {
    try {
      const productos = await ProductoService.getAll();
      const alertas: AlertaInventario[] = [];
      const ahora = new Date();
      const en30Dias = new Date(ahora);
      en30Dias.setDate(ahora.getDate() + 30);

      for (const producto of productos) {
        if (producto.estado !== 'activo') continue;

        const inventario = await inventarioService.getInventarioProducto(producto.id);

        if (inventario.length === 0) continue;

        // Sumar disponibles de todos los almacenes
        const totalDisponibles = inventario.reduce((sum, i) => sum + i.disponibles, 0);

        // Stock bajo o crítico
        if (producto.stockMinimo && totalDisponibles < producto.stockMinimo) {
          alertas.push({
            tipo: totalDisponibles === 0 ? 'stock_critico' : 'stock_bajo',
            productoId: producto.id,
            sku: producto.sku,
            marca: producto.marca,
            nombreComercial: producto.nombreComercial,
            mensaje: `Stock ${totalDisponibles === 0 ? 'agotado' : 'bajo'}: ${totalDisponibles} unidades (mínimo: ${producto.stockMinimo})`,
            prioridad: totalDisponibles === 0 ? 'alta' : 'media',
            cantidad: totalDisponibles
          });
        }

        // Próximos a vencer (sumar de todos los almacenes)
        const totalProximosVencer30 = inventario.reduce((sum, i) => sum + i.proximasAVencer30Dias, 0);

        if (totalProximosVencer30 > 0) {
          alertas.push({
            tipo: 'proximo_vencer',
            productoId: producto.id,
            sku: producto.sku,
            marca: producto.marca,
            nombreComercial: producto.nombreComercial,
            mensaje: `${totalProximosVencer30} unidades vencen en los próximos 30 días`,
            prioridad: 'media',
            cantidad: totalProximosVencer30
          });
        }

        // Vencidos (sumar de todos los almacenes)
        const totalVencidas = inventario.reduce((sum, i) => sum + i.vencidas, 0);

        if (totalVencidas > 0) {
          alertas.push({
            tipo: 'vencido',
            productoId: producto.id,
            sku: producto.sku,
            marca: producto.marca,
            nombreComercial: producto.nombreComercial,
            mensaje: `${totalVencidas} unidades VENCIDAS`,
            prioridad: 'alta',
            cantidad: totalVencidas
          });
        }
      }

      return alertas.sort((a, b) => {
        const prioridadOrden = { alta: 0, media: 1, baja: 2 };
        return prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad];
      });
    } catch (error: any) {
      console.error('Error al obtener alertas:', error);
      throw new Error('Error al generar alertas');
    }
  }

  /**
   * Helper: Obtener ventas por rango
   */
  private static async getVentasPorRango(rango: RangoFechas): Promise<{ cantidad: number; totalPEN: number; utilidadPEN: number }> {
    const ventas = await VentaService.getAll();
    // Incluir todas las ventas válidas (no cotizaciones ni canceladas ni ventas a socios)
    const estadosValidos = ['confirmada', 'parcial', 'asignada', 'en_entrega', 'entrega_parcial', 'entregada', 'reservada'];

    const ventasRango = ventas.filter(v => {
      if (!estadosValidos.includes(v.estado)) return false;
      if (v.esVentaSocio) return false;
      // Usar fechaEntrega si existe, sino fechaConfirmacion, sino fechaCreacion
      const fechaVenta = v.fechaEntrega?.toDate() || v.fechaConfirmacion?.toDate() || v.fechaCreacion?.toDate();
      if (!fechaVenta) return false;
      return fechaVenta >= rango.inicio && fechaVenta <= rango.fin;
    });

    return {
      cantidad: ventasRango.length,
      totalPEN: ventasRango.reduce((sum, v) => sum + v.totalPEN, 0),
      utilidadPEN: ventasRango.reduce((sum, v) => sum + (v.utilidadBrutaPEN || 0), 0)
    };
  }
}