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
import { InventarioService } from './inventario.service';
import { VentaService } from './venta.service';
import { OrdenCompraService } from './ordenCompra.service';
import { TipoCambioService } from './tipoCambio.service';

export class ReporteService {
  /**
   * Obtener resumen ejecutivo completo
   */
  static async getResumenEjecutivo(): Promise<ResumenEjecutivo> {
    try {
      const [
        ventasStats,
        productos,
        ordenesStats,
        tcStats,
        productosMasVendidos
      ] = await Promise.all([
        VentaService.getStats(),
        ProductoService.getAll(),
        OrdenCompraService.getStats(),
        TipoCambioService.getStats(),
        this.getProductosRentabilidad({ inicio: new Date(0), fin: new Date() })
      ]);

      // Calcular ventas por período
      const ahora = new Date();
      const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
      const inicioSemana = new Date(ahora);
      inicioSemana.setDate(ahora.getDate() - 7);
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

      const [ventasHoy, ventasSemana, ventasMes] = await Promise.all([
        this.getVentasPorRango({ inicio: inicioHoy, fin: ahora }),
        this.getVentasPorRango({ inicio: inicioSemana, fin: ahora }),
        this.getVentasPorRango({ inicio: inicioMes, fin: ahora })
      ]);

      // Calcular valor de inventario
      const inventarioValorizado = await this.getInventarioValorizado();
      const valorInventarioPEN = inventarioValorizado.reduce((sum, item) => sum + item.valorTotalPEN, 0);
      const unidadesTotales = inventarioValorizado.reduce((sum, item) => sum + item.unidadesTotal, 0);
      const unidadesDisponibles = inventarioValorizado.reduce((sum, item) => sum + item.unidadesDisponibles, 0);

      return {
        // Ventas
        ventasTotalesPEN: ventasStats.ventasTotalPEN,
        ventasMes: ventasMes.totalPEN,
        ventasSemana: ventasSemana.totalPEN,
        ventasHoy: ventasHoy.totalPEN,
        
        // Rentabilidad
        utilidadTotalPEN: ventasStats.utilidadTotalPEN,
        margenPromedio: ventasStats.margenPromedio,
        
        // Inventario
        valorInventarioPEN,
        unidadesTotales,
        unidadesDisponibles,
        
        // Órdenes
        ordenesActivas: ordenesStats.enviadas + ordenesStats.pagadas + ordenesStats.enTransito,
        ordenesRecibidas: ordenesStats.recibidas,
        inversionTotalUSD: ordenesStats.valorTotalUSD,
        
        // Productos
        productosActivos: productos.filter(p => p.estado === 'activo').length,
        productosMasVendidos: productosMasVendidos.slice(0, 5),
        
        // TC
        tcActual: tcStats.tcActual?.promedio || 0,
        tcPromedio: tcStats.promedioMes
      };
    } catch (error: any) {
      console.error('Error al obtener resumen ejecutivo:', error);
      throw new Error('Error al generar resumen');
    }
  }

  /**
   * Obtener productos ordenados por rentabilidad
   * VERSIÓN ROBUSTA - Calcula el descuento desde los datos reales
   */
  static async getProductosRentabilidad(rango: RangoFechas): Promise<ProductoRentabilidad[]> {
    try {
      const ventas = await VentaService.getAll();
      const ventasEntregadas = ventas.filter(v => 
        v.estado === 'entregada' &&
        v.fechaEntrega &&
        v.fechaEntrega.toDate() >= rango.inicio &&
        v.fechaEntrega.toDate() <= rango.fin
      );

      console.log('🔍 VENTAS ENTREGADAS:', ventasEntregadas.length);

      const productosMap = new Map<string, ProductoRentabilidad>();

      for (const venta of ventasEntregadas) {
        // CALCULAR descuento de manera robusta desde los datos reales
        // En lugar de confiar en venta.descuentoPEN (que puede no existir),
        // calculamos: descuento = suma(subtotales) - total
        const subtotalProductos = venta.productos.reduce((sum, p) => sum + p.subtotal, 0);
        const descuentoReal = subtotalProductos - venta.totalPEN;
        
        console.log('📦 PROCESANDO VENTA:', {
          numero: venta.numeroVenta,
          subtotalProductos: subtotalProductos,
          totalPEN: venta.totalPEN,
          descuentoCalculado: descuentoReal
        });

        // Calcular factor de descuento: totalReal / subtotal
        // Ejemplo: 170 / 220 = 0.7727 (77.27% del precio original)
        const factorDescuento = subtotalProductos > 0 
          ? (venta.totalPEN / subtotalProductos)
          : 1;

        console.log('📊 FACTOR DE DESCUENTO:', factorDescuento);

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
          // Ejemplo: 220 * 0.7727 = 170
          const ventaRealProducto = producto.subtotal * factorDescuento;
          
          console.log('💰 PRODUCTO:', {
            nombre: producto.nombreComercial,
            subtotalOriginal: producto.subtotal,
            factorDescuento: factorDescuento,
            ventaReal: ventaRealProducto,
            costo: producto.costoTotalUnidades
          });
          
          item.unidadesVendidas += producto.cantidad;
          item.ventasTotalPEN += ventaRealProducto; // Venta con descuento aplicado
          item.costoTotalPEN += producto.costoTotalUnidades || 0;
        }
      }

      // Calcular promedios y utilidad
      const productos = Array.from(productosMap.values()).map(p => {
        const resultado = {
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
        };

        console.log('✅ RESULTADO FINAL:', {
          producto: resultado.nombreComercial,
          ventasTotalPEN: resultado.ventasTotalPEN,
          costoTotalPEN: resultado.costoTotalPEN,
          utilidadPEN: resultado.utilidadPEN,
          margenPromedio: resultado.margenPromedio
        });

        return resultado;
      });

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

      for (const producto of productos) {
        if (producto.estado !== 'activo') continue;

        const unidades = await InventarioService.getByProducto(producto.id);
        
        const disponibles = unidades.filter(u => u.estado === 'disponible_peru');
        const asignadas = unidades.filter(u => u.estado === 'asignada_pedido');
        
        const unidadesMiami = unidades.filter(u => u.almacenActual.startsWith('miami')).length;
        const unidadesUtah = unidades.filter(u => u.almacenActual === 'utah').length;
        const unidadesPeru = unidades.filter(u => u.almacenActual.startsWith('peru')).length;
        
        const valorTotal = unidades.reduce((sum, u) => sum + u.ctruDinamico, 0);
        const costoPromedio = unidades.length > 0 ? valorTotal / unidades.length : 0;

        if (unidades.length > 0) {
          inventarioValorizado.push({
            productoId: producto.id,
            sku: producto.sku,
            marca: producto.marca,
            nombreComercial: producto.nombreComercial,
            unidadesDisponibles: disponibles.length,
            unidadesAsignadas: asignadas.length,
            unidadesTotal: unidades.length,
            valorTotalPEN: valorTotal,
            costoPromedioUnidad: costoPromedio,
            unidadesMiami,
            unidadesUtah,
            unidadesPeru
          });
        }
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
  static async getVentasPorCanal(): Promise<VentasPorCanal> {
    try {
      const ventas = await VentaService.getAll();
      const ventasEntregadas = ventas.filter(v => v.estado === 'entregada');

      const stats: VentasPorCanal = {
        mercadoLibre: { cantidad: 0, totalPEN: 0, porcentaje: 0 },
        directo: { cantidad: 0, totalPEN: 0, porcentaje: 0 },
        otro: { cantidad: 0, totalPEN: 0, porcentaje: 0 }
      };

      let totalVentas = 0;

      ventasEntregadas.forEach(venta => {
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
   */
  static async getTendenciaVentas(dias: number = 30): Promise<TendenciaVentas[]> {
    try {
      const ventas = await VentaService.getAll();
      const ventasEntregadas = ventas.filter(v => v.estado === 'entregada' && v.fechaEntrega);

      const hoy = new Date();
      const tendencias: TendenciaVentas[] = [];

      for (let i = dias - 1; i >= 0; i--) {
        const fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() - i);
        fecha.setHours(0, 0, 0, 0);

        const ventasDia = ventasEntregadas.filter(v => {
          const fechaVenta = v.fechaEntrega!.toDate();
          return fechaVenta.toDateString() === fecha.toDateString();
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

        const unidades = await InventarioService.getByProducto(producto.id);
        const disponibles = unidades.filter(u => u.estado === 'disponible_peru');

        // Stock bajo
        if (producto.stockMinimo && disponibles.length < producto.stockMinimo) {
          alertas.push({
            tipo: disponibles.length === 0 ? 'stock_critico' : 'stock_bajo',
            productoId: producto.id,
            sku: producto.sku,
            marca: producto.marca,
            nombreComercial: producto.nombreComercial,
            mensaje: `Stock ${disponibles.length === 0 ? 'agotado' : 'bajo'}: ${disponibles.length} unidades (mínimo: ${producto.stockMinimo})`,
            prioridad: disponibles.length === 0 ? 'alta' : 'media',
            cantidad: disponibles.length
          });
        }

        // Próximos a vencer
        const proximosVencer = unidades.filter(u => 
          u.estado === 'disponible_peru' &&
          u.fechaVencimiento &&
          u.fechaVencimiento.toDate() > ahora &&
          u.fechaVencimiento.toDate() <= en30Dias
        );

        if (proximosVencer.length > 0) {
          const masProximo = proximosVencer.sort((a, b) => 
            a.fechaVencimiento!.toMillis() - b.fechaVencimiento!.toMillis()
          )[0];

          alertas.push({
            tipo: 'proximo_vencer',
            productoId: producto.id,
            sku: producto.sku,
            marca: producto.marca,
            nombreComercial: producto.nombreComercial,
            mensaje: `${proximosVencer.length} unidades vencen pronto (${masProximo.fechaVencimiento!.toDate().toLocaleDateString('es-PE')})`,
            prioridad: 'media',
            cantidad: proximosVencer.length,
            fechaVencimiento: masProximo.fechaVencimiento
          });
        }

        // Vencidos
        const vencidos = unidades.filter(u =>
          u.estado === 'disponible_peru' &&
          u.fechaVencimiento &&
          u.fechaVencimiento.toDate() <= ahora
        );

        if (vencidos.length > 0) {
          alertas.push({
            tipo: 'vencido',
            productoId: producto.id,
            sku: producto.sku,
            marca: producto.marca,
            nombreComercial: producto.nombreComercial,
            mensaje: `${vencidos.length} unidades VENCIDAS`,
            prioridad: 'alta',
            cantidad: vencidos.length
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
    const ventasRango = ventas.filter(v => 
      v.estado === 'entregada' &&
      v.fechaEntrega &&
      v.fechaEntrega.toDate() >= rango.inicio &&
      v.fechaEntrega.toDate() <= rango.fin
    );

    return {
      cantidad: ventasRango.length,
      totalPEN: ventasRango.reduce((sum, v) => sum + v.totalPEN, 0),
      utilidadPEN: ventasRango.reduce((sum, v) => sum + (v.utilidadBrutaPEN || 0), 0)
    };
  }
}