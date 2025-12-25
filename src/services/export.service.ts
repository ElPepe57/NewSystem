import * as XLSX from 'xlsx';
import type { Producto } from '../types/producto.types';
import type { Venta } from '../types/venta.types';
import type { OrdenCompra } from '../types/ordenCompra.types';
import type { Gasto } from '../types/gasto.types';
import type { InventarioProducto } from '../types/inventario.types';

/**
 * Servicio para exportar datos a Excel
 */
export const exportService = {
  /**
   * Exporta productos a Excel
   */
  exportProductos(productos: Producto[], filename = 'productos'): void {
    const data = productos.map(p => ({
      'SKU': p.sku,
      'Marca': p.marca,
      'Nombre Comercial': p.nombreComercial,
      'Presentación': p.presentacion,
      'Dosaje': p.dosaje || '',
      'Contenido': p.contenido || '',
      'Grupo': p.grupo,
      'Subgrupo': p.subgrupo || '',
      'Stock Perú': p.stockPeru,
      'Stock USA': p.stockUSA,
      'Stock Tránsito': p.stockTransito,
      'Stock Mínimo': p.stockMinimo,
      'CTRU Promedio': p.ctruPromedio || 0,
      'Precio Sugerido': p.precioSugerido || 0,
      'Estado': p.estado,
      'Habilitado ML': p.habilitadoML ? 'Sí' : 'No'
    }));

    this.downloadExcel(data, filename);
  },

  /**
   * Exporta ventas a Excel
   */
  exportVentas(ventas: Venta[], filename = 'ventas'): void {
    const data = ventas.map(v => ({
      'N° Venta': v.numeroVenta,
      'Fecha': v.fechaCreacion?.toDate?.().toLocaleDateString('es-PE') || '',
      'Cliente': v.nombreCliente,
      'DNI/RUC': v.dniRuc || '',
      'Canal': v.canal === 'mercado_libre' ? 'Mercado Libre' : v.canal === 'directo' ? 'Directo' : 'Otro',
      'Productos': v.productos.length,
      'Subtotal': v.subtotalPEN,
      'Descuento': v.descuento || 0,
      'Costo Envío': v.costoEnvio || 0,
      'Total PEN': v.totalPEN,
      'Costo Productos': v.costoTotalPEN || 0,
      'Utilidad Bruta': v.utilidadBrutaPEN || 0,
      'Margen %': v.margenPromedio?.toFixed(1) || '0',
      'Estado': v.estado,
      'Estado Pago': v.estadoPago || 'pendiente',
      'Monto Pagado': v.montoPagado || 0,
      'Monto Pendiente': v.montoPendiente || 0
    }));

    this.downloadExcel(data, filename);
  },

  /**
   * Exporta órdenes de compra a Excel
   */
  exportOrdenesCompra(ordenes: OrdenCompra[], filename = 'ordenes_compra'): void {
    const data = ordenes.map(oc => ({
      'N° Orden': oc.numeroOrden,
      'Fecha Creación': oc.fechaCreacion?.toDate?.().toLocaleDateString('es-PE') || '',
      'Proveedor': oc.nombreProveedor,
      'Productos': oc.productos.length,
      'Subtotal USD': oc.subtotalUSD,
      'Gastos Envío USD': oc.gastosEnvioUSD || 0,
      'Total USD': oc.totalUSD,
      'TC Compra': oc.tcCompra || 0,
      'TC Pago': oc.tcPago || 0,
      'Total PEN': oc.totalPEN || 0,
      'Diferencia Cambiaria': oc.diferenciaCambiaria || 0,
      'Estado': oc.estado,
      'Estado Pago': oc.estadoPago || 'pendiente',
      'Tracking': oc.numeroTracking || '',
      'Courier': oc.courier || '',
      'Inventario Generado': oc.inventarioGenerado ? 'Sí' : 'No'
    }));

    this.downloadExcel(data, filename);
  },

  /**
   * Exporta gastos a Excel
   */
  exportGastos(gastos: Gasto[], filename = 'gastos'): void {
    const data = gastos.map(g => ({
      'N° Gasto': g.numeroGasto,
      'Fecha': g.fecha?.toDate?.().toLocaleDateString('es-PE') || '',
      'Tipo': g.tipo,
      'Categoría': g.categoria,
      'Descripción': g.descripcion,
      'Moneda': g.moneda,
      'Monto Original': g.montoOriginal,
      'Monto PEN': g.montoPEN,
      'TC Usado': g.tipoCambio || 0,
      'Prorrateable': g.esProrrateable ? 'Sí' : 'No',
      'Impacta CTRU': g.impactaCTRU ? 'Sí' : 'No',
      'Estado': g.estado,
      'Proveedor': g.proveedor || '',
      'N° Comprobante': g.numeroComprobante || ''
    }));

    this.downloadExcel(data, filename);
  },

  /**
   * Exporta inventario a Excel
   */
  exportInventario(inventario: InventarioProducto[], filename = 'inventario'): void {
    const data = inventario.map(inv => ({
      'SKU': inv.productoSKU,
      'Producto': `${inv.productoMarca} ${inv.productoNombre}`,
      'Grupo': inv.productoGrupo,
      'Subgrupo': inv.productoSubgrupo || '',
      'Almacén': inv.almacenNombre,
      'País': inv.pais,
      'Total Unidades': inv.totalUnidades,
      'Disponibles': inv.disponibles,
      'En Tránsito': inv.enTransito,
      'Reservadas': inv.reservadas,
      'Vendidas': inv.vendidas,
      'Vencidas': inv.vencidas,
      'Valor Total USD': inv.valorTotalUSD,
      'Costo Promedio USD': inv.costoPromedioUSD,
      'Próx. Vencer 30d': inv.proximasAVencer30Dias,
      'Próx. Vencer 90d': inv.proximasAVencer90Dias,
      'Stock Crítico': inv.stockCritico ? 'Sí' : 'No'
    }));

    this.downloadExcel(data, filename);
  },

  /**
   * Exporta reporte de rentabilidad mensual
   */
  exportReporteRentabilidad(
    ventas: Venta[],
    gastos: Gasto[],
    mes: number,
    anio: number,
    filename = 'reporte_rentabilidad'
  ): void {
    // Filtrar ventas del mes
    const ventasMes = ventas.filter(v => {
      if (v.estado === 'cancelada' || v.estado === 'cotizacion') return false;
      const fecha = v.fechaCreacion?.toDate?.();
      if (!fecha) return false;
      return fecha.getMonth() + 1 === mes && fecha.getFullYear() === anio;
    });

    // Filtrar gastos del mes
    const gastosMes = gastos.filter(g => g.mes === mes && g.anio === anio);

    // Calcular totales
    const totalVentas = ventasMes.reduce((sum, v) => sum + v.totalPEN, 0);
    const totalCostos = ventasMes.reduce((sum, v) => sum + (v.costoTotalPEN || 0), 0);
    const utilidadBruta = totalVentas - totalCostos;
    const totalGastos = gastosMes.reduce((sum, g) => sum + g.montoPEN, 0);
    const gastosOperativos = gastosMes.filter(g => g.esProrrateable).reduce((sum, g) => sum + g.montoPEN, 0);
    const utilidadNeta = utilidadBruta - gastosOperativos;

    // Crear hoja de resumen
    const resumen = [
      { 'Concepto': 'Período', 'Valor': `${mes}/${anio}` },
      { 'Concepto': '', 'Valor': '' },
      { 'Concepto': 'VENTAS', 'Valor': '' },
      { 'Concepto': 'Total Ventas', 'Valor': totalVentas },
      { 'Concepto': 'N° de Ventas', 'Valor': ventasMes.length },
      { 'Concepto': 'Unidades Vendidas', 'Valor': ventasMes.reduce((sum, v) => sum + v.productos.reduce((s, p) => s + p.cantidad, 0), 0) },
      { 'Concepto': '', 'Valor': '' },
      { 'Concepto': 'COSTOS', 'Valor': '' },
      { 'Concepto': 'Costo de Productos', 'Valor': totalCostos },
      { 'Concepto': 'Utilidad Bruta', 'Valor': utilidadBruta },
      { 'Concepto': 'Margen Bruto %', 'Valor': totalVentas > 0 ? ((utilidadBruta / totalVentas) * 100).toFixed(1) + '%' : '0%' },
      { 'Concepto': '', 'Valor': '' },
      { 'Concepto': 'GASTOS', 'Valor': '' },
      { 'Concepto': 'Total Gastos', 'Valor': totalGastos },
      { 'Concepto': 'Gastos Operativos (Prorrateables)', 'Valor': gastosOperativos },
      { 'Concepto': '', 'Valor': '' },
      { 'Concepto': 'RESULTADO', 'Valor': '' },
      { 'Concepto': 'Utilidad Neta', 'Valor': utilidadNeta },
      { 'Concepto': 'Margen Neto %', 'Valor': totalVentas > 0 ? ((utilidadNeta / totalVentas) * 100).toFixed(1) + '%' : '0%' }
    ];

    // Crear detalle de ventas
    const detalleVentas = ventasMes.map(v => ({
      'N° Venta': v.numeroVenta,
      'Fecha': v.fechaCreacion?.toDate?.().toLocaleDateString('es-PE') || '',
      'Cliente': v.nombreCliente,
      'Total': v.totalPEN,
      'Costo': v.costoTotalPEN || 0,
      'Utilidad': v.utilidadBrutaPEN || 0,
      'Margen %': v.margenPromedio?.toFixed(1) || '0'
    }));

    // Crear detalle de gastos
    const detalleGastos = gastosMes.map(g => ({
      'N° Gasto': g.numeroGasto,
      'Fecha': g.fecha?.toDate?.().toLocaleDateString('es-PE') || '',
      'Descripción': g.descripcion,
      'Categoría': g.categoria,
      'Monto PEN': g.montoPEN,
      'Prorrateable': g.esProrrateable ? 'Sí' : 'No'
    }));

    // Crear workbook con múltiples hojas
    this.downloadExcelMultiSheet({
      'Resumen': resumen,
      'Detalle Ventas': detalleVentas,
      'Detalle Gastos': detalleGastos
    }, `${filename}_${mes}_${anio}`);
  },

  /**
   * Descarga un archivo Excel con una sola hoja
   */
  downloadExcel(data: Record<string, any>[], filename: string): void {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');

    // Ajustar ancho de columnas
    const maxWidths = this.getColumnWidths(data);
    worksheet['!cols'] = maxWidths;

    XLSX.writeFile(workbook, `${filename}_${this.getDateSuffix()}.xlsx`);
  },

  /**
   * Descarga un archivo Excel con múltiples hojas
   */
  downloadExcelMultiSheet(sheets: Record<string, Record<string, any>[]>, filename: string): void {
    const workbook = XLSX.utils.book_new();

    Object.entries(sheets).forEach(([sheetName, data]) => {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const maxWidths = this.getColumnWidths(data);
      worksheet['!cols'] = maxWidths;
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    XLSX.writeFile(workbook, `${filename}_${this.getDateSuffix()}.xlsx`);
  },

  /**
   * Calcula el ancho óptimo de las columnas
   */
  getColumnWidths(data: Record<string, any>[]): { wch: number }[] {
    if (data.length === 0) return [];

    const keys = Object.keys(data[0]);
    return keys.map(key => {
      const maxLength = Math.max(
        key.length,
        ...data.map(row => String(row[key] || '').length)
      );
      return { wch: Math.min(maxLength + 2, 50) };
    });
  },

  /**
   * Genera sufijo de fecha para el nombre del archivo
   */
  getDateSuffix(): string {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  }
};
