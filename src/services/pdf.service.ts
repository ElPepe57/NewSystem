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
  nombre: 'Vita Skin Peru',
  ruc: '10471520590',
  direccion: 'Lima, Perú',
  telefono: '988 681 245'
};

// QR de pagos por defecto (Yape/Plin — EMVCo data)
const QR_PAGO_DEFAULT = {
  url: '0002010102113944yJlhCWXwbmNAG5tdU5sXiqhg1luDoH+qH9NBnWE7Vqc=5204561153036045802PE5906YAPERO6004Lima6304E36D',
  cuenta: '988 681 245',
  banco: 'Yape/Plin'
};

class PDFService {
  private primaryColor: [number, number, number] = [26, 107, 90]; // brand teal
  private secondaryColor: [number, number, number] = [107, 114, 128]; // gray-500
  private successColor: [number, number, number] = [26, 107, 90]; // brand teal
  private dangerColor: [number, number, number] = [220, 38, 38]; // red-600
  private warningColor: [number, number, number] = [217, 119, 6]; // amber-600

  // Cache del logo de la empresa
  private logoDataUrl: string | null = null;

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
    doc.text('Vita Skin Peru', 14, 20);

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

    this.addFooter(doc, 'Vita Skin Peru - Sistema de Gestión de Inventario');
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

    this.addFooter(doc, 'Vita Skin Peru - Sistema de Gestión de Ventas');
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

    this.addFooter(doc, 'Vita Skin Peru - Sistema de Gestión de Gastos');
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
   * Cargar logo de empresa como Data URL (con cache)
   */
  private async loadLogo(): Promise<string> {
    if (this.logoDataUrl) return this.logoDataUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        this.logoDataUrl = canvas.toDataURL('image/png');
        resolve(this.logoDataUrl);
      };
      img.onerror = () => resolve('');
      img.src = '/logo.jpeg';
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
   * Generar QR con logo superpuesto en el centro
   * Usa error correction H (30%) para que el QR siga siendo escaneable
   */
  private async generateQRCodeWithLogo(data: string): Promise<string> {
    try {
      const logoDataUrl = await this.loadLogo();

      // Generar QR con alta corrección de errores
      const qrDataUrl = await QRCode.toDataURL(data, {
        width: 300,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#ffffff' }
      });

      // Si no hay logo, devolver QR solo
      if (!logoDataUrl) return qrDataUrl;

      // Componer QR + Logo en canvas
      return new Promise<string>((resolve) => {
        const canvas = document.createElement('canvas');
        const size = 300;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        const qrImg = new Image();
        qrImg.onload = () => {
          // Dibujar QR base
          ctx.drawImage(qrImg, 0, 0, size, size);

          const logoImg = new Image();
          logoImg.onload = () => {
            // Tamaño del logo: ~22% del QR (seguro para error correction H)
            const logoSize = Math.floor(size * 0.22);
            const center = size / 2;
            const logoX = center - logoSize / 2;
            const logoY = center - logoSize / 2;

            // Fondo blanco circular detrás del logo
            const radius = logoSize / 2 + 5;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(center, center, radius, 0, Math.PI * 2);
            ctx.fill();

            // Borde sutil circular
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(center, center, radius, 0, Math.PI * 2);
            ctx.stroke();

            // Recorte circular para el logo
            ctx.save();
            ctx.beginPath();
            ctx.arc(center, center, logoSize / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
            ctx.restore();

            resolve(canvas.toDataURL('image/png'));
          };
          logoImg.onerror = () => resolve(qrDataUrl);
          logoImg.src = logoDataUrl;
        };
        qrImg.onerror = () => resolve(qrDataUrl);
        qrImg.src = qrDataUrl;
      });
    } catch (error) {
      console.error('Error generando QR con logo:', error);
      return '';
    }
  }

  /**
   * Genera URL de Google Maps para navegación directa
   */
  private generarGoogleMapsUrl(entrega: Entrega): string | null {
    if (entrega.coordenadas?.lat && entrega.coordenadas?.lng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${entrega.coordenadas.lat},${entrega.coordenadas.lng}`;
    }
    if (entrega.direccionEntrega) {
      const query = [entrega.direccionEntrega, entrega.distrito, 'Peru'].filter(Boolean).join(', ');
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    }
    return null;
  }

  /**
   * Guía de entrega para transportista
   * Formato: A4 landscape, etiqueta compacta 1/3 ancho x 3/4 alto
   * Borde dibujado AL FINAL para que no sea tapado por los rellenos de color
   */
  async generarGuiaTransportista(
    entrega: Entrega,
    empresa = EMPRESA_DEFAULT,
    qrPago = QR_PAGO_DEFAULT
  ): Promise<jsPDF> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // ── Dimensiones ──
    const m = 7;
    const W = 86;
    const H = 146;
    const x0 = m;
    const y0 = m;
    const b = 0.4; // grosor borde exterior (inset para fills)
    const pad = 4;  // padding interno desde borde

    // Bordes internos del label (área donde los fills NO tapan el borde)
    const innerL = x0 + b;
    const innerR = x0 + W - b;
    const innerW = W - b * 2;

    // ── Paleta Vita Skin Peru ──
    const teal: [number, number, number] = [26, 107, 90];        // brand primary
    const tealMed: [number, number, number] = [42, 143, 122];    // brand secondary
    const tealBg: [number, number, number] = [232, 245, 241];    // brand bg light
    const tealDarkBg: [number, number, number] = [26, 107, 90];  // header/date bar fill
    const negro: [number, number, number] = [35, 35, 35];
    const grisOscuro: [number, number, number] = [75, 75, 75];
    const gris: [number, number, number] = [115, 115, 115];
    const grisSuave: [number, number, number] = [165, 165, 165];
    const grisLinea: [number, number, number] = [210, 225, 220]; // teal-tinted separator
    const rojo: [number, number, number] = [185, 35, 35];
    const ambar: [number, number, number] = [165, 95, 5];

    // ── Helper: separador horizontal suave (dentro del borde) ──
    const sep = (atY: number) => {
      doc.setDrawColor(...grisLinea);
      doc.setLineWidth(0.15);
      doc.line(innerL, atY, innerR, atY);
    };

    let y = y0;

    // ═══════════════════════════════════════════
    // 1. HEADER (10mm) — fondo teal oscuro (marca)
    // ═══════════════════════════════════════════
    const headerH = 10;
    doc.setFillColor(...tealDarkBg);
    doc.rect(innerL, y + b, innerW, headerH - b, 'F');

    // Empresa (blanco sobre teal)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(empresa.nombre.toUpperCase(), x0 + pad, y + 4.5);

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 230, 220);
    doc.text(`RUC: ${empresa.ruc}  ·  Tel: ${empresa.telefono}`, x0 + pad, y + 8.2);

    // Código entrega (derecha, blanco)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(entrega.codigo, x0 + W - pad, y + 4.5, { align: 'right' });

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 230, 220);
    doc.text(
      `${entrega.numeroVenta}  ·  ${entrega.numeroEntrega}${entrega.totalEntregas ? '/' + entrega.totalEntregas : ''}`,
      x0 + W - pad, y + 8.2, { align: 'right' }
    );

    y += headerH;
    sep(y);

    // ═══════════════════════════════════════════
    // 2. BARRA FECHA (6.5mm) — teal claro (marca)
    // ═══════════════════════════════════════════
    const fechaH = 6.5;
    doc.setFillColor(...tealBg);
    doc.rect(innerL, y, innerW, fechaH, 'F');

    const fechaStr = this.formatTimestamp(entrega.fechaProgramada);
    const horaStr = entrega.horaProgramada || '';

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...teal);
    doc.text('ENTREGA:', x0 + pad, y + 4.2);

    doc.setFontSize(8.5);
    doc.setTextColor(...negro);
    doc.text(fechaStr, x0 + 22, y + 4.2);

    if (horaStr) {
      doc.setFontSize(7);
      doc.setTextColor(...teal);
      doc.text(horaStr, x0 + W - pad, y + 4.2, { align: 'right' });
    }

    y += fechaH;
    sep(y);

    // ═══════════════════════════════════════════
    // 3. QR MAPS (izq) | DIRECCIÓN (der) — 32mm
    // ═══════════════════════════════════════════
    const qrSize = 22;
    const qrColW = 28;
    const dirColX = x0 + qrColW;
    const dirColW = W - qrColW;
    const addrSecH = 32;

    // Línea vertical entre columnas
    doc.setDrawColor(...grisLinea);
    doc.setLineWidth(0.15);
    doc.line(dirColX, y + 2, dirColX, y + addrSecH - 2);

    // ── QR Maps (centrado en columna izquierda) ──
    const mapsUrl = this.generarGoogleMapsUrl(entrega);
    if (mapsUrl) {
      try {
        const qrMapsData = await this.generateQRCode(mapsUrl);
        if (qrMapsData) {
          const qrX = x0 + (qrColW - qrSize) / 2;
          const qrY = y + 2;
          doc.addImage(qrMapsData, 'PNG', qrX, qrY, qrSize, qrSize);

          doc.setFontSize(5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...teal);
          doc.text('GOOGLE MAPS', x0 + qrColW / 2, qrY + qrSize + 2.5, { align: 'center' });
        }
      } catch (e) { /* silenciar */ }
    }

    // ── Columna derecha: Distrito + Dirección ──
    const dp = 3.5;
    let dY = y + 1;

    // Distrito — auto-reduce font for long names
    const distritoDisplay = (entrega.distrito || 'Sin distrito').toUpperCase();
    const distritoMaxW = dirColW - dp * 2;
    let distritoFontSize = 13;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(distritoFontSize);
    while (distritoFontSize > 8 && doc.getTextWidth(distritoDisplay) > distritoMaxW) {
      distritoFontSize -= 0.5;
      doc.setFontSize(distritoFontSize);
    }
    doc.setTextColor(...negro);
    doc.text(distritoDisplay, dirColX + dp, dY + 5);
    dY += 7.5;

    // Provincia + C.P. en una línea
    const infoLine = [
      entrega.provincia && entrega.provincia !== entrega.distrito ? entrega.provincia : null,
      entrega.codigoPostal ? `C.P. ${entrega.codigoPostal}` : null
    ].filter(Boolean).join('  ·  ');
    if (infoLine) {
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...grisSuave);
      doc.text(infoLine, dirColX + dp, dY);
      dY += 3.5;
    }

    // Dirección
    dY += 0.5;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grisOscuro);
    const dirMaxW = dirColW - dp - 2;
    const dirLines = doc.splitTextToSize(entrega.direccionEntrega, dirMaxW);
    doc.text(dirLines.slice(0, 2), dirColX + dp, dY);
    dY += Math.min(dirLines.length, 2) * 3;

    // Referencia
    if (entrega.referencia) {
      dY += 1.5;
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...tealMed);
      doc.text('Ref:', dirColX + dp, dY);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...grisOscuro);
      const refLines = doc.splitTextToSize(entrega.referencia, dirMaxW - 7);
      doc.text(refLines.slice(0, 2), dirColX + dp + 7, dY);
    }

    y += addrSecH;
    sep(y);

    // ═══════════════════════════════════════════
    // 4. DESTINATARIO (10mm)
    // ═══════════════════════════════════════════
    y += 1;

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...tealMed);
    doc.text('DESTINATARIO', x0 + pad, y + 2.5);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...negro);
    doc.text(entrega.nombreCliente, x0 + pad, y + 7);

    if (entrega.telefonoCliente) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gris);
      doc.text(`Tel: ${entrega.telefonoCliente}`, x0 + pad, y + 10.5);
    }

    y += 11.5;
    sep(y);

    // ═══════════════════════════════════════════
    // 5. PRODUCTOS | PAGO (2 sub-columnas)
    // ═══════════════════════════════════════════
    const subColY = y;
    const footerH = 7;
    const bottomEdge = y0 + H - footerH;
    const subColH = bottomEdge - subColY;
    const subCol1W = Math.floor(W * 0.46);
    const subCol2W = W - subCol1W;

    // Vertical divider
    doc.setDrawColor(...grisLinea);
    doc.setLineWidth(0.15);
    doc.line(x0 + subCol1W, subColY, x0 + subCol1W, bottomEdge);

    // ── PRODUCTOS ──
    // Sub-header
    const shH = 5;
    doc.setFillColor(...tealBg);
    doc.rect(innerL, subColY, subCol1W - b, shH, 'F');
    sep(subColY + shH);

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...teal);
    doc.text(`PRODUCTOS (${entrega.cantidadItems})`, x0 + pad, subColY + 3.5);

    // Lista de productos
    let prodY = subColY + shH + 3.5;
    for (const prod of entrega.productos.slice(0, 5)) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...negro);
      const nombre = `${prod.marca} ${prod.nombreComercial}`;
      const corto = nombre.length > 16 ? nombre.substring(0, 16) + '..' : nombre;
      doc.text(`${prod.cantidad}x ${corto}`, x0 + pad, prodY);

      doc.setTextColor(...gris);
      doc.setFontSize(6.5);
      doc.text(`S/${prod.subtotal.toFixed(0)}`, x0 + subCol1W - 3, prodY, { align: 'right' });
      prodY += 4;
    }
    if (entrega.productos.length > 5) {
      doc.setFontSize(5.5);
      doc.setTextColor(...grisSuave);
      doc.text(`+${entrega.productos.length - 5} más...`, x0 + pad, prodY);
    }

    // Total section — infer envío from cobro if costoEnvio not stored
    let envioEfectivo = entrega.costoEnvio || 0;
    if (!envioEfectivo && entrega.cobroPendiente && entrega.montoPorCobrar && entrega.montoPorCobrar > entrega.subtotalPEN) {
      envioEfectivo = entrega.montoPorCobrar - entrega.subtotalPEN;
    }
    const tieneEnvio = envioEfectivo > 0;
    const totalGeneral = entrega.subtotalPEN + envioEfectivo;
    const totalBlockH = tieneEnvio ? 16 : 10;
    const totalY = bottomEdge - totalBlockH;
    doc.setDrawColor(...grisLinea);
    doc.setLineWidth(0.15);
    doc.line(x0 + pad, totalY, x0 + subCol1W - 3, totalY);

    let tY = totalY + 3.5;

    // Subtotal productos
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grisSuave);
    doc.text('Productos', x0 + pad, tY);
    doc.setFontSize(7);
    doc.setTextColor(...grisOscuro);
    doc.text(`S/ ${entrega.subtotalPEN.toFixed(2)}`, x0 + subCol1W - 3, tY, { align: 'right' });

    if (tieneEnvio) {
      tY += 3.5;
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...grisSuave);
      doc.text('Envío', x0 + pad, tY);
      doc.setFontSize(7);
      doc.setTextColor(...grisOscuro);
      doc.text(`S/ ${envioEfectivo.toFixed(2)}`, x0 + subCol1W - 3, tY, { align: 'right' });
    }

    tY += 3.5;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...grisSuave);
    doc.text('TOTAL', x0 + pad, tY);
    doc.setFontSize(10);
    doc.setTextColor(...negro);
    doc.text(`S/ ${totalGeneral.toFixed(2)}`, x0 + subCol1W - 3, tY, { align: 'right' });

    // Observaciones
    if (entrega.observaciones) {
      doc.setFontSize(5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...ambar);
      const obsMaxW = subCol1W - pad * 2;
      const obsLines = doc.splitTextToSize(`Obs: ${entrega.observaciones}`, obsMaxW);
      doc.text(obsLines.slice(0, 2), x0 + pad, tY + 4);
    }

    // ── PAGO ──
    const pX = x0 + subCol1W;
    const tieneCobro = entrega.cobroPendiente && entrega.montoPorCobrar && entrega.montoPorCobrar > 0;

    // Sub-header pago
    const pagoFill: [number, number, number] = tieneCobro ? [255, 249, 225] : tealBg;
    doc.setFillColor(...pagoFill);
    doc.rect(pX, subColY, subCol2W - b, shH, 'F');
    // reutilizar la línea sep ya dibujada en subColY+shH

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(tieneCobro ? ambar : teal));
    doc.text(
      tieneCobro ? 'COBRO PENDIENTE' : 'PAGADO',
      pX + subCol2W / 2, subColY + 3.5, { align: 'center' }
    );

    const pCenter = pX + subCol2W / 2;
    const pagoAreaH = subColH - shH;

    if (tieneCobro) {
      // Calcular adelanto pagado
      const adelanto = totalGeneral - entrega.montoPorCobrar!;
      const tieneAdelanto = adelanto > 0.5; // Tolerancia para redondeos

      // Centrar todo el bloque verticalmente
      const qrPaySize = 25;
      const adelantoLineH = tieneAdelanto ? 10 : 0;
      const blockH = 5 + adelantoLineH + 3 + qrPaySize + 3 + 3;
      const pStart = subColY + shH + (pagoAreaH - blockH) / 2;
      let pY = pStart;

      // Adelanto pagado (si existe)
      if (tieneAdelanto) {
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...teal);
        doc.text(`Adelanto pagado: S/ ${adelanto.toFixed(2)}`, pCenter, pY, { align: 'center' });
        pY += 4;

        doc.setFontSize(5);
        doc.setTextColor(...gris);
        doc.text('Saldo por cobrar:', pCenter, pY, { align: 'center' });
        pY += 5;
      }

      // Monto por cobrar
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...rojo);
      doc.text(`S/ ${entrega.montoPorCobrar!.toFixed(2)}`, pCenter, pY, { align: 'center' });
      pY += 4.5;

      // Método
      const metodoLabel: Record<string, string> = { efectivo: 'Efectivo', yape: 'Yape', plin: 'Plin', transferencia: 'Transf.' };
      const metodo = entrega.metodoPagoEsperado || 'efectivo';
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gris);
      doc.text(`Método: ${metodoLabel[metodo] || metodo}`, pCenter, pY, { align: 'center' });
      pY += 3;

      // QR grande con logo
      if (qrPago?.url) {
        try {
          const qrPayData = qrPago.url.startsWith('data:image/')
            ? qrPago.url
            : await this.generateQRCodeWithLogo(qrPago.url);
          if (qrPayData) {
            doc.addImage(qrPayData, 'PNG', pCenter - qrPaySize / 2, pY, qrPaySize, qrPaySize);
            pY += qrPaySize + 2;
          }
        } catch (e) { /* silenciar */ }
      }

      // Label + cuenta
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...ambar);
      doc.text('YAPE / PLIN', pCenter, pY, { align: 'center' });
      pY += 3.5;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...negro);
      doc.text(qrPago.cuenta, pCenter, pY, { align: 'center' });

    } else {
      const midY = subColY + shH + pagoAreaH / 2;

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...teal);
      doc.text('PAGADO', pCenter, midY - 1, { align: 'center' });

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gris);
      doc.text('Sin cobro pendiente', pCenter, midY + 5, { align: 'center' });
    }

    // Línea inferior de subcols
    sep(bottomEdge);

    // ═══════════════════════════════════════════
    // 6. FOOTER (7mm)
    // ═══════════════════════════════════════════
    const fY = bottomEdge;

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...grisSuave);
    doc.text('Transp:', x0 + pad, fY + 3.5);

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grisOscuro);
    const transCorto = entrega.nombreTransportista.length > 24
      ? entrega.nombreTransportista.substring(0, 24) + '..'
      : entrega.nombreTransportista;
    doc.text(transCorto, x0 + 17, fY + 3.5);

    doc.setFontSize(4.5);
    doc.setTextColor(...grisSuave);
    const fechaImpresion = new Date().toLocaleDateString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    doc.text(`Imp: ${fechaImpresion}`, x0 + W - pad, fY + 3.5, { align: 'right' });

    // ═══════════════════════════════════════════
    // BORDE EXTERIOR — dibujado AL FINAL sobre todo
    // ═══════════════════════════════════════════
    doc.setDrawColor(...teal);
    doc.setLineWidth(0.5);
    doc.roundedRect(x0, y0, W, H, 1.5, 1.5, 'S');

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
    doc.rect(0, 0, pageWidth, 32, 'F');

    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('CARGO DE ENTREGA', pageWidth / 2, 13, { align: 'center' });

    doc.setFontSize(14);
    doc.text(entrega.codigo, pageWidth / 2, 24, { align: 'center' });

    // === DATOS DE EMPRESA ===
    let y = 42;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(empresa.nombre, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`RUC: ${empresa.ruc}`, 14, y + 7);
    doc.text(empresa.direccion, 14, y + 13);
    doc.text(`Tel: ${empresa.telefono}`, 14, y + 19);

    // Fecha
    doc.setFontSize(11);
    doc.text(`Fecha: ${this.formatTimestamp(entrega.fechaProgramada)}`, pageWidth - 14, y + 7, { align: 'right' });
    doc.text(`Venta: ${entrega.numeroVenta}`, pageWidth - 14, y + 14, { align: 'right' });

    // === DATOS DEL CLIENTE ===
    y = 72;
    doc.setFillColor(240, 253, 244); // green-50
    doc.rect(14, y, pageWidth - 28, 24, 'F');
    doc.setDrawColor(...this.successColor);
    doc.setLineWidth(0.5);
    doc.rect(14, y, pageWidth - 28, 24, 'S');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('DATOS DEL CLIENTE', 20, y + 8);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cliente: ${entrega.nombreCliente}`, 20, y + 15);
    doc.text(`Dirección: ${entrega.direccionEntrega}${entrega.distrito ? ` - ${entrega.distrito}` : ''}`, 20, y + 21);

    // === DETALLE DE PRODUCTOS ===
    y = 104;
    doc.setFontSize(13);
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
        { content: 'Subtotal Productos', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
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

    y = (doc as any).lastAutoTable.finalY + 6;

    // === DESGLOSE DE TOTALES ===
    let envioEfectivoCargo = entrega.costoEnvio || 0;
    if (!envioEfectivoCargo && entrega.cobroPendiente && entrega.montoPorCobrar && entrega.montoPorCobrar > entrega.subtotalPEN) {
      envioEfectivoCargo = entrega.montoPorCobrar - entrega.subtotalPEN;
    }
    const tieneEnvioCargo = envioEfectivoCargo > 0;
    const totalGeneralCargo = entrega.subtotalPEN + envioEfectivoCargo;

    if (tieneEnvioCargo) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text('Productos:', pageWidth - 75, y);
      doc.text(`S/ ${entrega.subtotalPEN.toFixed(2)}`, pageWidth - 15, y, { align: 'right' });
      y += 6;
      doc.text('Envío:', pageWidth - 75, y);
      doc.text(`S/ ${envioEfectivoCargo.toFixed(2)}`, pageWidth - 15, y, { align: 'right' });
      y += 3;
    }

    // Total general box
    doc.setFillColor(232, 245, 241); // teal bg
    doc.roundedRect(pageWidth - 80, y, 66, 10, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 107, 90);
    doc.text('TOTAL:', pageWidth - 75, y + 7);
    doc.text(`S/ ${totalGeneralCargo.toFixed(2)}`, pageWidth - 15, y + 7, { align: 'right' });
    y += 16;

    // === INFORMACIÓN DE PAGO ===
    if (entrega.cobroPendiente && entrega.montoPorCobrar) {
      // Calculate adelanto
      const adelantoCargo = totalGeneralCargo - entrega.montoPorCobrar;
      const tieneAdelantoCargo = adelantoCargo > 0.5;
      const pagoBoxH = tieneAdelantoCargo ? 60 : 50;

      doc.setFillColor(254, 249, 195); // yellow-100
      doc.rect(14, y, pageWidth - 28, pagoBoxH, 'F');
      doc.setDrawColor(...this.warningColor);
      doc.rect(14, y, pageWidth - 28, pagoBoxH, 'S');

      let pagoY = y + 10;

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...this.warningColor);
      doc.text('PAGO PENDIENTE', 20, pagoY);

      if (tieneAdelantoCargo) {
        pagoY += 8;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(34, 139, 34);
        doc.text(`Adelanto pagado: S/ ${adelantoCargo.toFixed(2)}`, 20, pagoY);
        pagoY += 6;
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text('Saldo por cobrar:', 20, pagoY);
        pagoY += 2;
      }

      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text(`S/ ${entrega.montoPorCobrar.toFixed(2)}`, 20, pagoY + (tieneAdelantoCargo ? 5 : 13));

      const infoY = pagoY + (tieneAdelantoCargo ? 13 : 23);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Puede pagar con Yape o Plin escaneando el código QR', 20, infoY);
      doc.text(`o al número: ${qrPago.cuenta}`, 20, infoY + 7);

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

      y += pagoBoxH + 5;
    }

    // === DECLARACIÓN DE CONFORMIDAD ===
    y += 5;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    const declaracion = 'Declaro haber recibido los productos arriba detallados en buen estado y conforme a mi pedido.';
    doc.text(declaracion, 14, y);

    // === FIRMA ===
    y += 15;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(14, y + 20, 90, y + 20);

    doc.setFontSize(10);
    doc.text('Nombre: _______________________', 14, y + 28);
    doc.text('DNI: _______________________', 14, y + 35);
    doc.text('Fecha: _______________________', 14, y + 42);

    // Espacio para firma
    doc.text('Firma:', 95, y + 5);

    // === PIE DE PÁGINA ===
    doc.setFontSize(9);
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
