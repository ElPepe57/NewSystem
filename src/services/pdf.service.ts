import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import type { Entrega, PDFEntregaData } from '../types/entrega.types';
import { ConfiguracionService } from './configuracion.service';

export interface PDFReportOptions {
  title: string;
  subtitle?: string;
  filename?: string;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'a4' | 'letter';
  logo?: string;
  footerText?: string;
}

export interface TableColumn {
  header: string;
  dataKey: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: (value: any) => string;
}

export interface PDFTableOptions {
  columns: TableColumn[];
  data: Record<string, any>[];
  title?: string;
  showSummary?: boolean;
  summaryData?: Record<string, any>;
}

// Configuración de empresa por defecto
const EMPRESA_DEFAULT = {
  nombre: 'BusinessMN',
  ruc: '20123456789',
  direccion: 'Lima, Perú',
  telefono: '999 999 999'
};

// QR de pagos por defecto (Yape/Plin)
const QR_PAGO_DEFAULT = {
  url: 'https://yape.pe/businessmn',
  cuenta: '999 999 999',
  banco: 'Yape/Plin'
};

class PDFService {
  private primaryColor: [number, number, number] = [37, 99, 235]; // blue-600
  private secondaryColor: [number, number, number] = [107, 114, 128]; // gray-500
  private successColor: [number, number, number] = [22, 163, 74]; // green-600
  private dangerColor: [number, number, number] = [220, 38, 38]; // red-600
  private warningColor: [number, number, number] = [217, 119, 6]; // amber-600

  /**
   * Crear un nuevo documento PDF
   */
  createDocument(options: PDFReportOptions): jsPDF {
    const doc = new jsPDF({
      orientation: options.orientation || 'portrait',
      unit: 'mm',
      format: options.pageSize || 'a4'
    });

    // Añadir cabecera
    this.addHeader(doc, options);

    return doc;
  }

  /**
   * Añadir cabecera al documento
   */
  private addHeader(doc: jsPDF, options: PDFReportOptions) {
    const pageWidth = doc.internal.pageSize.getWidth();

    // Logo o nombre de empresa
    doc.setFontSize(20);
    doc.setTextColor(...this.primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.text('BusinessMN', 14, 20);

    // Título del reporte
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(options.title, 14, 32);

    // Subtítulo
    if (options.subtitle) {
      doc.setFontSize(10);
      doc.setTextColor(...this.secondaryColor);
      doc.setFont('helvetica', 'normal');
      doc.text(options.subtitle, 14, 40);
    }

    // Fecha de generación
    doc.setFontSize(9);
    doc.setTextColor(...this.secondaryColor);
    const fecha = new Date().toLocaleString('es-PE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Generado: ${fecha}`, pageWidth - 14, 20, { align: 'right' });

    // Línea separadora
    doc.setDrawColor(...this.primaryColor);
    doc.setLineWidth(0.5);
    doc.line(14, 45, pageWidth - 14, 45);
  }

  /**
   * Añadir tabla al documento
   */
  addTable(doc: jsPDF, options: PDFTableOptions, startY: number = 55): number {
    const { columns, data, title, showSummary, summaryData } = options;

    // Título de la tabla
    if (title) {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 14, startY);
      startY += 8;
    }

    // Preparar datos para autoTable
    const tableData = data.map(row => {
      const formattedRow: Record<string, string> = {};
      columns.forEach(col => {
        const value = row[col.dataKey];
        formattedRow[col.dataKey] = col.format ? col.format(value) : String(value ?? '');
      });
      return formattedRow;
    });

    // Generar tabla
    autoTable(doc, {
      startY,
      head: [columns.map(c => c.header)],
      body: tableData.map(row => columns.map(c => row[c.dataKey])),
      theme: 'striped',
      headStyles: {
        fillColor: this.primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251] // gray-50
      },
      columnStyles: columns.reduce((acc, col, idx) => {
        acc[idx] = {
          halign: col.align || 'left',
          cellWidth: col.width || 'auto'
        };
        return acc;
      }, {} as Record<number, any>),
      margin: { left: 14, right: 14 }
    });

    // Obtener la posición final
    const finalY = (doc as any).lastAutoTable.finalY || startY + 50;

    // Añadir resumen si se solicita
    if (showSummary && summaryData) {
      this.addSummary(doc, summaryData, finalY + 10);
    }

    return finalY;
  }

  /**
   * Añadir sección de resumen
   */
  addSummary(doc: jsPDF, data: Record<string, any>, startY: number) {
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen', 14, startY);

    let y = startY + 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    Object.entries(data).forEach(([label, value]) => {
      doc.setTextColor(...this.secondaryColor);
      doc.text(`${label}:`, 14, y);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(String(value), 60, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
    });
  }

  /**
   * Añadir KPIs en formato de tarjetas
   */
  addKPICards(
    doc: jsPDF,
    kpis: Array<{ label: string; value: string | number; color?: 'primary' | 'success' | 'danger' }>,
    startY: number
  ): number {
    const pageWidth = doc.internal.pageSize.getWidth();
    const cardWidth = (pageWidth - 28 - (kpis.length - 1) * 5) / kpis.length;
    const cardHeight = 25;

    kpis.forEach((kpi, idx) => {
      const x = 14 + idx * (cardWidth + 5);

      // Fondo de la tarjeta
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(x, startY, cardWidth, cardHeight, 3, 3, 'F');

      // Borde
      const color = kpi.color === 'success' ? this.successColor
        : kpi.color === 'danger' ? this.dangerColor
          : this.primaryColor;
      doc.setDrawColor(...color);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, startY, cardWidth, cardHeight, 3, 3, 'S');

      // Label
      doc.setFontSize(8);
      doc.setTextColor(...this.secondaryColor);
      doc.setFont('helvetica', 'normal');
      doc.text(kpi.label, x + cardWidth / 2, startY + 8, { align: 'center' });

      // Valor
      doc.setFontSize(14);
      doc.setTextColor(...color);
      doc.setFont('helvetica', 'bold');
      doc.text(String(kpi.value), x + cardWidth / 2, startY + 18, { align: 'center' });
    });

    return startY + cardHeight + 10;
  }

  /**
   * Añadir pie de página
   */
  addFooter(doc: jsPDF, text?: string) {
    const pageCount = doc.getNumberOfPages();
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...this.secondaryColor);

      // Texto personalizado
      if (text) {
        doc.text(text, 14, pageHeight - 10);
      }

      // Número de página
      doc.text(
        `Página ${i} de ${pageCount}`,
        pageWidth - 14,
        pageHeight - 10,
        { align: 'right' }
      );
    }
  }

  /**
   * Guardar o descargar el PDF
   */
  save(doc: jsPDF, filename: string = 'reporte') {
    const safeFilename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`${safeFilename}_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  /**
   * Obtener el PDF como blob
   */
  toBlob(doc: jsPDF): Blob {
    return doc.output('blob');
  }

  /**
   * Obtener el PDF como base64
   */
  toBase64(doc: jsPDF): string {
    return doc.output('datauristring');
  }

  // ============================================
  // REPORTES PREDEFINIDOS
  // ============================================

  /**
   * Generar reporte de inventario
   */
  generateInventoryReport(
    productos: Array<{
      sku: string;
      nombre: string;
      marca: string;
      stockPeru: number;
      stockUSA: number;
      costoPromedio: number;
    }>,
    resumen: {
      totalProductos: number;
      valorInventario: number;
      stockCritico: number;
    }
  ) {
    const doc = this.createDocument({
      title: 'Reporte de Inventario',
      subtitle: 'Estado actual del inventario de productos'
    });

    // KPIs
    let y = this.addKPICards(doc, [
      { label: 'Total Productos', value: resumen.totalProductos, color: 'primary' },
      { label: 'Valor Inventario', value: `S/ ${resumen.valorInventario.toFixed(2)}`, color: 'success' },
      { label: 'Stock Crítico', value: resumen.stockCritico, color: 'danger' }
    ], 55);

    // Tabla de productos
    this.addTable(doc, {
      title: 'Detalle de Productos',
      columns: [
        { header: 'SKU', dataKey: 'sku', width: 25 },
        { header: 'Producto', dataKey: 'nombre', width: 50 },
        { header: 'Marca', dataKey: 'marca', width: 30 },
        { header: 'Stock Perú', dataKey: 'stockPeru', align: 'right', width: 25 },
        { header: 'Stock USA', dataKey: 'stockUSA', align: 'right', width: 25 },
        {
          header: 'Costo Prom.',
          dataKey: 'costoPromedio',
          align: 'right',
          width: 30,
          format: (v: number) => `S/ ${v.toFixed(2)}`
        }
      ],
      data: productos
    }, y);

    this.addFooter(doc, 'BusinessMN - Sistema de Gestión de Inventario');
    this.save(doc, 'reporte_inventario');
  }

  /**
   * Generar reporte de ventas
   */
  generateSalesReport(
    ventas: Array<{
      numero: string;
      fecha: string;
      cliente: string;
      total: number;
      estado: string;
    }>,
    resumen: {
      totalVentas: number;
      montoTotal: number;
      ticketPromedio: number;
    }
  ) {
    const doc = this.createDocument({
      title: 'Reporte de Ventas',
      subtitle: 'Resumen de ventas del período',
      orientation: 'landscape'
    });

    // KPIs
    let y = this.addKPICards(doc, [
      { label: 'Total Ventas', value: resumen.totalVentas, color: 'primary' },
      { label: 'Monto Total', value: `S/ ${resumen.montoTotal.toFixed(2)}`, color: 'success' },
      { label: 'Ticket Promedio', value: `S/ ${resumen.ticketPromedio.toFixed(2)}`, color: 'primary' }
    ], 55);

    // Tabla de ventas
    this.addTable(doc, {
      title: 'Detalle de Ventas',
      columns: [
        { header: 'N° Venta', dataKey: 'numero', width: 30 },
        { header: 'Fecha', dataKey: 'fecha', width: 35 },
        { header: 'Cliente', dataKey: 'cliente', width: 60 },
        {
          header: 'Total',
          dataKey: 'total',
          align: 'right',
          width: 35,
          format: (v: number) => `S/ ${v.toFixed(2)}`
        },
        { header: 'Estado', dataKey: 'estado', align: 'center', width: 30 }
      ],
      data: ventas
    }, y);

    this.addFooter(doc, 'BusinessMN - Sistema de Gestión de Ventas');
    this.save(doc, 'reporte_ventas');
  }

  /**
   * Generar reporte de gastos
   */
  generateExpenseReport(
    gastos: Array<{
      numero: string;
      fecha: string;
      tipo: string;
      descripcion: string;
      monto: number;
      estado: string;
    }>,
    resumen: {
      totalGastos: number;
      montoTotal: number;
      pendientePago: number;
    }
  ) {
    const doc = this.createDocument({
      title: 'Reporte de Gastos',
      subtitle: 'Resumen de gastos operativos'
    });

    // KPIs
    let y = this.addKPICards(doc, [
      { label: 'Total Gastos', value: resumen.totalGastos, color: 'primary' },
      { label: 'Monto Total', value: `S/ ${resumen.montoTotal.toFixed(2)}`, color: 'danger' },
      { label: 'Pendiente Pago', value: `S/ ${resumen.pendientePago.toFixed(2)}`, color: 'danger' }
    ], 55);

    // Tabla de gastos
    this.addTable(doc, {
      title: 'Detalle de Gastos',
      columns: [
        { header: 'N°', dataKey: 'numero', width: 20 },
        { header: 'Fecha', dataKey: 'fecha', width: 25 },
        { header: 'Tipo', dataKey: 'tipo', width: 30 },
        { header: 'Descripción', dataKey: 'descripcion', width: 50 },
        {
          header: 'Monto',
          dataKey: 'monto',
          align: 'right',
          width: 30,
          format: (v: number) => `S/ ${v.toFixed(2)}`
        },
        { header: 'Estado', dataKey: 'estado', align: 'center', width: 25 }
      ],
      data: gastos
    }, y);

    this.addFooter(doc, 'BusinessMN - Sistema de Gestión de Gastos');
    this.save(doc, 'reporte_gastos');
  }

  // ============================================
  // PDFs DE ENTREGAS
  // ============================================

  /**
   * Formatear timestamp para mostrar
   */
  private formatTimestamp(timestamp: any): string {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Generar código QR como Data URL
   */
  private async generateQRCode(data: string): Promise<string> {
    try {
      return await QRCode.toDataURL(data, {
        width: 150,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
    } catch (error) {
      console.error('Error generando QR:', error);
      return '';
    }
  }

  /**
   * Generar ticket de envío para pegar en la parte externa del paquete
   * Formato horizontal: izq información completa, der QR de pago
   */
  async generarGuiaTransportista(
    entrega: Entrega,
    empresa = EMPRESA_DEFAULT,
    qrPago = QR_PAGO_DEFAULT
  ): Promise<jsPDF> {
    // Formato horizontal tipo ticket
    const pageWidth = 210;
    const pageHeight = 85;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [pageHeight, pageWidth]
    });

    // Colores corporativos (amarillo/dorado)
    const colorPrimario: [number, number, number] = [234, 179, 8]; // yellow-500
    const colorOscuro: [number, number, number] = [161, 98, 7]; // yellow-700
    const colorNegro: [number, number, number] = [0, 0, 0];
    const colorBlanco: [number, number, number] = [255, 255, 255];
    const colorGris: [number, number, number] = [107, 114, 128]; // gray-500

    const margin = 3;
    const qrSectionWidth = 55; // Ancho de la sección QR (derecha)
    const infoSectionWidth = pageWidth - qrSectionWidth - (margin * 3);

    // === FONDO AMARILLO (marco completo) ===
    doc.setFillColor(...colorPrimario);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // === SECCIÓN IZQUIERDA (Información - fondo blanco) ===
    doc.setFillColor(...colorBlanco);
    doc.rect(margin, margin, infoSectionWidth, pageHeight - (margin * 2), 'F');

    // --- CABECERA ---
    // Empresa y código
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colorNegro);
    doc.text(empresa.nombre.toUpperCase(), margin + 4, margin + 8);

    doc.setFontSize(7);
    doc.setTextColor(...colorOscuro);
    doc.text('TICKET DE ENVÍO', margin + 4, margin + 13);

    // Códigos (derecha de la sección info)
    doc.setFontSize(8);
    doc.setTextColor(...colorGris);
    doc.text(entrega.codigo, margin + infoSectionWidth - 4, margin + 6, { align: 'right' });
    doc.setFontSize(7);
    doc.text(entrega.numeroVenta, margin + infoSectionWidth - 4, margin + 11, { align: 'right' });

    // Línea separadora
    doc.setDrawColor(...colorPrimario);
    doc.setLineWidth(0.5);
    doc.line(margin + 4, margin + 16, margin + infoSectionWidth - 4, margin + 16);

    // --- DATOS DEL CLIENTE (columna izquierda) ---
    let y = margin + 22;
    const col1X = margin + 4;
    const col2X = margin + 75; // Segunda columna

    // Cliente
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colorGris);
    doc.text('CLIENTE', col1X, y);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colorNegro);
    const nombreCliente = entrega.nombreCliente.length > 30
      ? entrega.nombreCliente.substring(0, 30) + '...'
      : entrega.nombreCliente;
    doc.text(nombreCliente, col1X, y + 4);

    // Teléfono (al lado)
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colorGris);
    doc.text('TEL', col2X, y);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colorNegro);
    doc.text(entrega.telefonoCliente || '-', col2X, y + 4);

    // Dirección
    y += 12;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colorGris);
    doc.text('DIRECCIÓN', col1X, y);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colorNegro);
    const direccion = entrega.distrito
      ? `${entrega.direccionEntrega} - ${entrega.distrito}`
      : entrega.direccionEntrega;
    const dirLines = doc.splitTextToSize(direccion, infoSectionWidth - 12);
    doc.text(dirLines.slice(0, 2), col1X, y + 4);

    // --- FECHA Y TRANSPORTISTA ---
    y += 14;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colorGris);
    doc.text('FECHA', col1X, y);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colorNegro);
    const fechaStr = this.formatTimestamp(entrega.fechaProgramada);
    const horaStr = entrega.horaProgramada ? ` (${entrega.horaProgramada})` : '';
    doc.text(`${fechaStr}${horaStr}`, col1X, y + 4);

    // Transportista
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colorGris);
    doc.text('TRANSPORTISTA', col2X, y);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colorNegro);
    const transportista = entrega.nombreTransportista.length > 20
      ? entrega.nombreTransportista.substring(0, 20) + '...'
      : entrega.nombreTransportista;
    doc.text(transportista, col2X, y + 4);

    // --- PRODUCTOS ---
    y += 12;
    doc.setFillColor(243, 244, 246); // gray-100
    doc.rect(col1X - 1, y - 2, infoSectionWidth - 6, 4, 'F');

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colorOscuro);
    doc.text(`PRODUCTOS (${entrega.cantidadItems})`, col1X, y);

    y += 5;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colorNegro);

    // Mostrar hasta 2 productos en el ticket
    const productosAMostrar = entrega.productos.slice(0, 2);
    for (const prod of productosAMostrar) {
      const productoNombre = `${prod.marca} - ${prod.nombreComercial}`;
      const productoCorto = productoNombre.length > 45
        ? productoNombre.substring(0, 45) + '...'
        : productoNombre;

      doc.text(`${prod.cantidad}x  ${productoCorto}`, col1X, y);
      doc.text(`S/ ${prod.subtotal.toFixed(2)}`, margin + infoSectionWidth - 6, y, { align: 'right' });
      y += 4;
    }

    if (entrega.productos.length > 2) {
      doc.setTextColor(...colorGris);
      doc.text(`... y ${entrega.productos.length - 2} más`, col1X, y);
    }

    // --- TOTAL (abajo izquierda) ---
    const totalBoxY = pageHeight - margin - 12;
    doc.setFillColor(...colorPrimario);
    doc.rect(col1X - 1, totalBoxY, 50, 9, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colorNegro);
    doc.text('TOTAL', col1X + 1, totalBoxY + 4);

    doc.setFontSize(10);
    doc.text(`S/ ${entrega.subtotalPEN.toFixed(2)}`, col1X + 1, totalBoxY + 8);

    // === LÍNEA DIVISORIA VERTICAL (punteada) ===
    const dividerX = margin + infoSectionWidth + margin;
    doc.setDrawColor(...colorGris);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.setLineWidth(0.3);
    doc.line(dividerX, margin + 8, dividerX, pageHeight - margin - 8);
    doc.setLineDashPattern([], 0);

    // === SECCIÓN DERECHA (QR de Pago - fondo blanco) ===
    const qrX = dividerX + margin;
    doc.setFillColor(...colorBlanco);
    doc.rect(qrX, margin, qrSectionWidth - margin, pageHeight - (margin * 2), 'F');

    // Si hay cobro pendiente, mostrar QR grande
    if (entrega.cobroPendiente && entrega.montoPorCobrar) {
      // Título
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colorOscuro);
      doc.text('PAGO', qrX + (qrSectionWidth - margin) / 2, margin + 8, { align: 'center' });

      // Monto grande
      doc.setFontSize(14);
      doc.setTextColor(...colorNegro);
      doc.text(`S/ ${entrega.montoPorCobrar.toFixed(2)}`, qrX + (qrSectionWidth - margin) / 2, margin + 16, { align: 'center' });

      // QR grande
      if (qrPago?.url) {
        try {
          const qrSize = 35;
          const qrXPos = qrX + ((qrSectionWidth - margin - qrSize) / 2);

          // Si es una imagen base64, usarla directamente
          if (qrPago.url.startsWith('data:image/')) {
            doc.addImage(qrPago.url, 'PNG', qrXPos, margin + 20, qrSize, qrSize);
          } else {
            // Si es una URL, generar QR
            const qrDataUrl = await this.generateQRCode(qrPago.url);
            if (qrDataUrl) {
              doc.addImage(qrDataUrl, 'PNG', qrXPos, margin + 20, qrSize, qrSize);
            }
          }
        } catch (e) {
          console.error('Error agregando QR:', e);
        }
      }

      // Número de teléfono Yape/Plin
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colorOscuro);
      doc.text('Yape / Plin', qrX + (qrSectionWidth - margin) / 2, margin + 60, { align: 'center' });

      doc.setFontSize(10);
      doc.setTextColor(...colorNegro);
      doc.text(qrPago.cuenta, qrX + (qrSectionWidth - margin) / 2, margin + 66, { align: 'center' });

      // Método esperado
      doc.setFontSize(6);
      doc.setTextColor(...colorGris);
      const metodo = entrega.metodoPagoEsperado || 'efectivo';
      doc.text(`Método: ${metodo}`, qrX + (qrSectionWidth - margin) / 2, margin + 72, { align: 'center' });
    } else {
      // Sin cobro pendiente - mostrar "PAGADO" o info de empresa
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 163, 74); // green-600
      doc.text('PAGADO', qrX + (qrSectionWidth - margin) / 2, pageHeight / 2 - 5, { align: 'center' });

      doc.setFontSize(7);
      doc.setTextColor(...colorGris);
      doc.setFont('helvetica', 'normal');
      doc.text('Sin cobro pendiente', qrX + (qrSectionWidth - margin) / 2, pageHeight / 2 + 2, { align: 'center' });
    }

    // === PIE DE PÁGINA (en área amarilla) ===
    doc.setFontSize(5);
    doc.setTextColor(...colorNegro);
    doc.text(`${empresa.telefono} | ${empresa.direccion}`, pageWidth / 2, pageHeight - 1, { align: 'center' });

    return doc;
  }

  /**
   * Generar cargo para el cliente
   * Documento más simple, enfocado en confirmación de recepción
   */
  async generarCargoCliente(
    entrega: Entrega,
    empresa = EMPRESA_DEFAULT,
    qrPago = QR_PAGO_DEFAULT
  ): Promise<jsPDF> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();

    // === CABECERA ===
    doc.setFillColor(...this.successColor);
    doc.rect(0, 0, pageWidth, 30, 'F');

    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('CARGO DE ENTREGA', pageWidth / 2, 12, { align: 'center' });

    doc.setFontSize(12);
    doc.text(entrega.codigo, pageWidth / 2, 22, { align: 'center' });

    // === DATOS DE EMPRESA ===
    let y = 40;
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(empresa.nombre, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`RUC: ${empresa.ruc}`, 14, y + 6);
    doc.text(empresa.direccion, 14, y + 11);
    doc.text(`Tel: ${empresa.telefono}`, 14, y + 16);

    // Fecha
    doc.setFontSize(10);
    doc.text(`Fecha: ${this.formatTimestamp(entrega.fechaProgramada)}`, pageWidth - 14, y + 6, { align: 'right' });
    doc.text(`Venta: ${entrega.numeroVenta}`, pageWidth - 14, y + 12, { align: 'right' });

    // === DATOS DEL CLIENTE ===
    y = 68;
    doc.setFillColor(240, 253, 244); // green-50
    doc.rect(14, y, pageWidth - 28, 22, 'F');
    doc.setDrawColor(...this.successColor);
    doc.setLineWidth(0.5);
    doc.rect(14, y, pageWidth - 28, 22, 'S');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('DATOS DEL CLIENTE', 20, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.text(`Cliente: ${entrega.nombreCliente}`, 20, y + 14);
    doc.text(`Dirección: ${entrega.direccionEntrega}${entrega.distrito ? ` - ${entrega.distrito}` : ''}`, 20, y + 19);

    // === DETALLE DE PRODUCTOS ===
    y = 98;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUCTOS ENTREGADOS', 14, y);

    autoTable(doc, {
      startY: y + 5,
      head: [['Producto', 'Cantidad', 'P. Unit.', 'Subtotal']],
      body: entrega.productos.map(prod => [
        `${prod.marca} ${prod.nombreComercial}`,
        prod.cantidad.toString(),
        `S/ ${prod.precioUnitario.toFixed(2)}`,
        `S/ ${prod.subtotal.toFixed(2)}`
      ]),
      foot: [[
        { content: 'TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `S/ ${entrega.subtotalPEN.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold' } }
      ]],
      theme: 'grid',
      headStyles: {
        fillColor: this.successColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      footStyles: {
        fillColor: [240, 253, 244],
        textColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: 'center', cellWidth: 25 },
        2: { halign: 'right', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 35 }
      },
      margin: { left: 14, right: 14 }
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // === INFORMACIÓN DE PAGO ===
    if (entrega.cobroPendiente && entrega.montoPorCobrar) {
      doc.setFillColor(254, 249, 195); // yellow-100
      doc.rect(14, y, pageWidth - 28, 50, 'F');
      doc.setDrawColor(...this.warningColor);
      doc.rect(14, y, pageWidth - 28, 50, 'S');

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...this.warningColor);
      doc.text('PAGO PENDIENTE', 20, y + 10);

      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text(`S/ ${entrega.montoPorCobrar.toFixed(2)}`, 20, y + 22);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Puede pagar con Yape o Plin escaneando el código QR', 20, y + 32);
      doc.text(`o al número: ${qrPago.cuenta}`, 20, y + 38);

      // QR de pago
      if (qrPago?.url) {
        try {
          // Si es una imagen base64, usarla directamente
          if (qrPago.url.startsWith('data:image/')) {
            doc.addImage(qrPago.url, 'PNG', pageWidth - 55, y + 5, 35, 35);
            doc.setFontSize(8);
            doc.text(qrPago.banco || 'Yape/Plin', pageWidth - 37, y + 43, { align: 'center' });
          } else {
            // Si es una URL, generar QR
            const qrDataUrl = await this.generateQRCode(qrPago.url);
            if (qrDataUrl) {
              doc.addImage(qrDataUrl, 'PNG', pageWidth - 55, y + 5, 35, 35);
              doc.setFontSize(8);
              doc.text(qrPago.banco || 'Yape/Plin', pageWidth - 37, y + 43, { align: 'center' });
            }
          }
        } catch (e) {
          console.error('Error agregando QR:', e);
        }
      }

      y += 55;
    }

    // === DECLARACIÓN DE CONFORMIDAD ===
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    const declaracion = 'Declaro haber recibido los productos arriba detallados en buen estado y conforme a mi pedido.';
    doc.text(declaracion, 14, y);

    // === FIRMA ===
    y += 15;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(14, y + 20, 90, y + 20);

    doc.setFontSize(9);
    doc.text('Nombre: _______________________', 14, y + 28);
    doc.text('DNI: _______________________', 14, y + 35);
    doc.text('Fecha: _______________________', 14, y + 42);

    // Espacio para firma
    doc.text('Firma:', 95, y + 5);

    // === PIE DE PÁGINA ===
    doc.setFontSize(8);
    doc.setTextColor(...this.secondaryColor);
    doc.text(`${empresa.nombre} - Gracias por su preferencia`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

    return doc;
  }

  /**
   * Obtener configuración de empresa para PDFs
   */
  private async getEmpresaConfig(): Promise<{
    empresa: typeof EMPRESA_DEFAULT;
    qrPago: typeof QR_PAGO_DEFAULT;
  }> {
    try {
      const empresaInfo = await ConfiguracionService.getEmpresa();

      if (empresaInfo) {
        return {
          empresa: {
            nombre: empresaInfo.nombreComercial || empresaInfo.razonSocial,
            ruc: empresaInfo.ruc,
            direccion: empresaInfo.direccion,
            telefono: empresaInfo.telefono || ''
          },
          qrPago: {
            url: empresaInfo.qrPagoUrl || QR_PAGO_DEFAULT.url,
            cuenta: empresaInfo.qrPagoTelefono || QR_PAGO_DEFAULT.cuenta,
            banco: empresaInfo.qrPagoBanco || QR_PAGO_DEFAULT.banco
          }
        };
      }
    } catch (error) {
      console.error('Error cargando configuración de empresa:', error);
    }

    return {
      empresa: EMPRESA_DEFAULT,
      qrPago: QR_PAGO_DEFAULT
    };
  }

  /**
   * Generar y descargar guía de transportista (usando config de empresa)
   */
  async downloadGuiaTransportista(entrega: Entrega): Promise<void> {
    const { empresa, qrPago } = await this.getEmpresaConfig();
    const doc = await this.generarGuiaTransportista(entrega, empresa, qrPago);
    this.save(doc, `guia_${entrega.codigo}`);
  }

  /**
   * Generar y descargar cargo de cliente (usando config de empresa)
   */
  async downloadCargoCliente(entrega: Entrega): Promise<void> {
    const { empresa, qrPago } = await this.getEmpresaConfig();
    const doc = await this.generarCargoCliente(entrega, empresa, qrPago);
    this.save(doc, `cargo_${entrega.codigo}`);
  }

  /**
   * Generar ambos documentos de entrega (usando config de empresa)
   */
  async generarDocumentosEntrega(entrega: Entrega): Promise<{ guia: jsPDF; cargo: jsPDF }> {
    const { empresa, qrPago } = await this.getEmpresaConfig();
    const [guia, cargo] = await Promise.all([
      this.generarGuiaTransportista(entrega, empresa, qrPago),
      this.generarCargoCliente(entrega, empresa, qrPago)
    ]);
    return { guia, cargo };
  }
}

export const pdfService = new PDFService();
export default pdfService;
