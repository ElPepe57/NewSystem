import { jsPDF } from 'jspdf';
import type { Cotizacion } from '../types/cotizacion.types';
import type { EmpresaInfo } from '../types/configuracion.types';

/**
 * Configuración de colores para el PDF
 * Tema: Dorado/Amarillo similar al modelo "Buy Me Now!"
 */
const COLORS = {
  primary: { r: 218, g: 165, b: 32 },      // Dorado
  primaryDark: { r: 184, g: 134, b: 11 },  // Dorado oscuro
  black: { r: 0, g: 0, b: 0 },
  gray: { r: 128, g: 128, b: 128 },
  lightGray: { r: 200, g: 200, b: 200 },
  white: { r: 255, g: 255, b: 255 }
};

/**
 * Formatea un número como moneda
 */
const formatCurrency = (amount: number): string => {
  return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Formatea una fecha
 */
const formatDate = (date: Date | { toDate: () => Date }): string => {
  const d = 'toDate' in date ? date.toDate() : date;
  return d.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Servicio para generación de PDFs de cotizaciones
 */
export class CotizacionPdfService {
  /**
   * Genera un PDF de cotización formal
   */
  static async generatePdf(cotizacion: Cotizacion, empresa: EmpresaInfo): Promise<Blob> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    // ========== HEADER CON FONDO DORADO ==========
    doc.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Nombre del negocio (grande, blanco)
    doc.setTextColor(COLORS.white.r, COLORS.white.g, COLORS.white.b);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text(empresa.nombreComercial || empresa.razonSocial, pageWidth / 2, 22, { align: 'center' });

    // Slogan o razón social (si es diferente)
    if (empresa.nombreComercial && empresa.razonSocial !== empresa.nombreComercial) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(empresa.razonSocial, pageWidth / 2, 32, { align: 'center' });
    }

    // RUC
    doc.setFontSize(10);
    doc.text(`RUC: ${empresa.ruc}`, pageWidth / 2, 40, { align: 'center' });

    yPosition = 55;

    // ========== TÍTULO "COTIZACIÓN" ==========
    doc.setTextColor(COLORS.black.r, COLORS.black.g, COLORS.black.b);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('COTIZACIÓN', pageWidth / 2, yPosition, { align: 'center' });

    // Línea decorativa debajo del título
    yPosition += 3;
    doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
    doc.setLineWidth(1);
    doc.line(margin + 40, yPosition, pageWidth - margin - 40, yPosition);

    yPosition += 15;

    // ========== INFORMACIÓN DE LA COTIZACIÓN ==========
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    // Número de cotización y fecha (lado a lado)
    doc.setFont('helvetica', 'bold');
    doc.text('N° Cotización:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(cotizacion.numeroCotizacion, margin + 35, yPosition);

    doc.setFont('helvetica', 'bold');
    doc.text('Fecha:', pageWidth - margin - 50, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(cotizacion.fechaCreacion), pageWidth - margin - 30, yPosition);

    yPosition += 8;

    // Cliente
    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(cotizacion.nombreCliente, margin + 20, yPosition);

    yPosition += 6;

    // Teléfono del cliente (si existe)
    if (cotizacion.telefonoCliente) {
      doc.setFont('helvetica', 'bold');
      doc.text('Teléfono:', margin, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(cotizacion.telefonoCliente, margin + 24, yPosition);
      yPosition += 6;
    }

    // DNI/RUC del cliente (si existe)
    if (cotizacion.dniRuc) {
      doc.setFont('helvetica', 'bold');
      doc.text('DNI/RUC:', margin, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(cotizacion.dniRuc, margin + 24, yPosition);
      yPosition += 6;
    }

    yPosition += 8;

    // ========== TABLA DE PRODUCTOS ==========
    const tableTop = yPosition;
    const colWidths = {
      producto: 80,
      cantidad: 25,
      precio: 35,
      total: 30
    };
    const tableWidth = colWidths.producto + colWidths.cantidad + colWidths.precio + colWidths.total;
    const tableLeft = (pageWidth - tableWidth) / 2;

    // Encabezado de tabla con fondo dorado
    doc.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
    doc.rect(tableLeft, tableTop, tableWidth, 10, 'F');

    doc.setTextColor(COLORS.white.r, COLORS.white.g, COLORS.white.b);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');

    let xPos = tableLeft + 3;
    doc.text('Producto', xPos, tableTop + 7);
    xPos += colWidths.producto;
    doc.text('Cant.', xPos, tableTop + 7);
    xPos += colWidths.cantidad;
    doc.text('Precio', xPos, tableTop + 7);
    xPos += colWidths.precio;
    doc.text('Total', xPos, tableTop + 7);

    yPosition = tableTop + 10;

    // Filas de productos
    doc.setTextColor(COLORS.black.r, COLORS.black.g, COLORS.black.b);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    cotizacion.productos.forEach((producto, index) => {
      const rowHeight = 8;

      // Fondo alternado
      if (index % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(tableLeft, yPosition, tableWidth, rowHeight, 'F');
      }

      // Borde de la fila
      doc.setDrawColor(COLORS.lightGray.r, COLORS.lightGray.g, COLORS.lightGray.b);
      doc.setLineWidth(0.3);
      doc.rect(tableLeft, yPosition, tableWidth, rowHeight, 'S');

      xPos = tableLeft + 3;

      // Nombre del producto (truncar si es muy largo)
      let nombreProducto = `${producto.marca} - ${producto.nombreComercial}`;
      if (producto.presentacion) {
        nombreProducto += ` (${producto.presentacion})`;
      }
      if (nombreProducto.length > 45) {
        nombreProducto = nombreProducto.substring(0, 42) + '...';
      }
      doc.text(nombreProducto, xPos, yPosition + 5.5);

      xPos += colWidths.producto;
      doc.text(producto.cantidad.toString(), xPos + 5, yPosition + 5.5);

      xPos += colWidths.cantidad;
      doc.text(formatCurrency(producto.precioUnitario), xPos, yPosition + 5.5);

      xPos += colWidths.precio;
      doc.text(formatCurrency(producto.subtotal), xPos, yPosition + 5.5);

      yPosition += rowHeight;
    });

    // Línea final de la tabla
    doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
    doc.setLineWidth(0.5);
    doc.line(tableLeft, yPosition, tableLeft + tableWidth, yPosition);

    yPosition += 8;

    // ========== TOTALES ==========
    const totalsLeft = tableLeft + colWidths.producto + colWidths.cantidad;

    doc.setFontSize(10);

    // Subtotal
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', totalsLeft, yPosition);
    doc.text(formatCurrency(cotizacion.subtotalPEN), totalsLeft + colWidths.precio + 5, yPosition);
    yPosition += 6;

    // Descuento (si aplica)
    if (cotizacion.descuento && cotizacion.descuento > 0) {
      doc.text('Descuento:', totalsLeft, yPosition);
      doc.text(`- ${formatCurrency(cotizacion.descuento)}`, totalsLeft + colWidths.precio + 5, yPosition);
      yPosition += 6;
    }

    // Costo de envío (si aplica)
    if (cotizacion.costoEnvio && cotizacion.costoEnvio > 0) {
      doc.text('Envío:', totalsLeft, yPosition);
      doc.text(formatCurrency(cotizacion.costoEnvio), totalsLeft + colWidths.precio + 5, yPosition);
      yPosition += 6;
    } else if (cotizacion.incluyeEnvio) {
      doc.text('Envío:', totalsLeft, yPosition);
      doc.setTextColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
      doc.text('INCLUIDO', totalsLeft + colWidths.precio + 5, yPosition);
      doc.setTextColor(COLORS.black.r, COLORS.black.g, COLORS.black.b);
      yPosition += 6;
    }

    // Total (destacado)
    yPosition += 2;
    doc.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
    doc.rect(totalsLeft - 5, yPosition - 4, colWidths.precio + colWidths.total + 10, 10, 'F');

    doc.setTextColor(COLORS.white.r, COLORS.white.g, COLORS.white.b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL:', totalsLeft, yPosition + 3);
    doc.text(formatCurrency(cotizacion.totalPEN), totalsLeft + colWidths.precio + 5, yPosition + 3);

    yPosition += 15;

    // ========== ADELANTO COMPROMETIDO (si existe) ==========
    if (cotizacion.adelantoComprometido || cotizacion.adelanto) {
      const adelantoInfo = cotizacion.adelantoComprometido || cotizacion.adelanto;
      const montoAdelanto = adelantoInfo?.monto || 0;
      const porcentaje = cotizacion.adelantoComprometido?.porcentaje ||
        Math.round((montoAdelanto / cotizacion.totalPEN) * 100);

      // Caja de adelanto
      doc.setFillColor(230, 255, 230); // Verde muy claro
      doc.setDrawColor(34, 139, 34); // Verde bosque
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPosition, pageWidth - margin * 2, 20, 3, 3, 'FD');

      doc.setTextColor(34, 100, 34);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);

      // Título
      const tituloAdelanto = cotizacion.adelanto
        ? 'ADELANTO PAGADO'
        : 'ADELANTO REQUERIDO';
      doc.text(tituloAdelanto, margin + 5, yPosition + 8);

      // Monto y porcentaje
      doc.setFontSize(12);
      doc.text(
        `${formatCurrency(montoAdelanto)} (${porcentaje}%)`,
        pageWidth - margin - 5,
        yPosition + 8,
        { align: 'right' }
      );

      // Saldo pendiente
      const saldo = cotizacion.totalPEN - montoAdelanto;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(
        `Saldo a pagar: ${formatCurrency(saldo)}`,
        pageWidth - margin - 5,
        yPosition + 15,
        { align: 'right' }
      );

      yPosition += 25;
    }

    // ========== OBSERVACIONES (si existen) ==========
    doc.setTextColor(COLORS.black.r, COLORS.black.g, COLORS.black.b);
    if (cotizacion.observaciones) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Observaciones:', margin, yPosition);
      yPosition += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const obsLines = doc.splitTextToSize(cotizacion.observaciones, pageWidth - margin * 2);
      doc.text(obsLines, margin, yPosition);
      yPosition += obsLines.length * 4 + 10;
    }

    // ========== CONDICIONES DE VALIDEZ ==========
    // Calcular días de vigencia
    const fechaCreacion = 'toDate' in cotizacion.fechaCreacion
      ? cotizacion.fechaCreacion.toDate()
      : cotizacion.fechaCreacion;

    let diasVigencia = 7; // Default
    if (cotizacion.fechaVencimiento) {
      const fechaVencimiento = 'toDate' in cotizacion.fechaVencimiento
        ? cotizacion.fechaVencimiento.toDate()
        : cotizacion.fechaVencimiento;
      diasVigencia = Math.ceil((fechaVencimiento.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Caja de vigencia
    const vigenciaBoxY = yPosition;
    doc.setFillColor(255, 250, 230); // Amarillo muy claro
    doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, vigenciaBoxY, pageWidth - margin * 2, 15, 3, 3, 'FD');

    doc.setTextColor(COLORS.primaryDark.r, COLORS.primaryDark.g, COLORS.primaryDark.b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(
      `ESTE PRESUPUESTO TIENE VALIDEZ DE ${diasVigencia} DÍAS DESPUÉS DE SU EMISIÓN`,
      pageWidth / 2,
      vigenciaBoxY + 9,
      { align: 'center' }
    );

    // ========== FOOTER CON INFORMACIÓN DE CONTACTO ==========
    const footerY = pageHeight - 30;

    // Línea decorativa
    doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    doc.setTextColor(COLORS.gray.r, COLORS.gray.g, COLORS.gray.b);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    // Información de contacto en una línea
    const contactInfo: string[] = [];
    if (empresa.telefono) contactInfo.push(`Tel: ${empresa.telefono}`);
    if (empresa.email) contactInfo.push(`Email: ${empresa.email}`);
    if (empresa.sitioWeb) contactInfo.push(empresa.sitioWeb);

    if (contactInfo.length > 0) {
      doc.text(contactInfo.join('  |  '), pageWidth / 2, footerY, { align: 'center' });
    }

    // Dirección
    if (empresa.direccion) {
      doc.text(empresa.direccion, pageWidth / 2, footerY + 5, { align: 'center' });
    }

    // Pie de página
    doc.setFontSize(8);
    doc.setTextColor(COLORS.lightGray.r, COLORS.lightGray.g, COLORS.lightGray.b);
    doc.text(
      `Generado el ${new Date().toLocaleDateString('es-PE')} a las ${new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );

    // Retornar el PDF como Blob
    return doc.output('blob');
  }

  /**
   * Genera y descarga el PDF de cotización
   */
  static async downloadPdf(cotizacion: Cotizacion, empresa: EmpresaInfo): Promise<void> {
    const blob = await this.generatePdf(cotizacion, empresa);

    // Crear URL del blob y descargar
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cotizacion.numeroCotizacion}_${cotizacion.nombreCliente.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Abre el PDF en una nueva pestaña
   */
  static async openPdf(cotizacion: Cotizacion, empresa: EmpresaInfo): Promise<void> {
    const blob = await this.generatePdf(cotizacion, empresa);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
}
