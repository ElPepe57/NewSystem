/**
 * boletaPdf.service.ts
 *
 * Genera PDF de boleta de pago.
 * Patrón: lazy-load jsPDF como cotizacionPdf.service.ts.
 */

import { formatCurrency } from '../utils/format';
import type { Boleta } from '../types/planilla.types';

const getJsPDF = () => import('jspdf').then(m => m.jsPDF);

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const COLORS = {
  primary: [26, 107, 90] as [number, number, number],
  dark: [31, 41, 55] as [number, number, number],
  gray: [107, 114, 128] as [number, number, number],
  light: [243, 244, 246] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
};

export async function generarBoletaPdf(boleta: Boleta): Promise<Blob> {
  const JsPDF = await getJsPDF();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // --- Header ---
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('BOLETA DE PAGO', margin, 15);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Vita Skin Peru', margin, 22);
  doc.text(`RUC: 10471520590`, margin, 27);

  // Número boleta (derecha)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(boleta.id, pageWidth - margin, 15, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periodo: ${MESES[boleta.mes - 1]} ${boleta.anio}`, pageWidth - margin, 22, { align: 'right' });

  y = 45;

  // --- Datos empleado ---
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL EMPLEADO', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Nombre: ${boleta.empleadoNombre}`, margin, y); y += 5;
  if (boleta.empleadoCargo) {
    doc.text(`Cargo: ${boleta.empleadoCargo}`, margin, y); y += 5;
  }
  y += 5;

  // --- INGRESOS ---
  doc.setFillColor(...COLORS.light);
  doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
  doc.setTextColor(...COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('INGRESOS', margin + 3, y + 5);
  doc.text('MONTO', pageWidth - margin - 3, y + 5, { align: 'right' });
  y += 10;

  doc.setFont('helvetica', 'normal');
  const addLine = (label: string, value: number, color?: [number, number, number]) => {
    doc.setTextColor(...COLORS.dark);
    doc.text(label, margin + 3, y);
    if (color) doc.setTextColor(...color);
    doc.text(formatCurrency(value, 'PEN'), pageWidth - margin - 3, y, { align: 'right' });
    y += 5;
  };

  addLine('Salario base', boleta.salarioBase);
  if (boleta.comisionesVentas > 0) addLine(`Comisiones (${boleta.detalleComisiones.length} ventas)`, boleta.comisionesVentas, COLORS.green);
  if (boleta.bonificaciones > 0) addLine('Bonificaciones', boleta.bonificaciones);
  if (boleta.otrosIngresos > 0) addLine('Otros ingresos', boleta.otrosIngresos);

  // Subtotal bruto
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  addLine('TOTAL BRUTO', boleta.totalBruto);
  y += 3;

  // --- DESCUENTOS ---
  if (boleta.totalDescuentos > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFillColor(...COLORS.light);
    doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
    doc.setTextColor(...COLORS.dark);
    doc.setFont('helvetica', 'bold');
    doc.text('DESCUENTOS', margin + 3, y + 5);
    doc.text('MONTO', pageWidth - margin - 3, y + 5, { align: 'right' });
    y += 10;

    doc.setFont('helvetica', 'normal');
    if (boleta.adelantos > 0) addLine(`Adelantos (${boleta.detalleAdelantos.length})`, -boleta.adelantos, COLORS.red);
    if (boleta.otrosDescuentos > 0) addLine('Otros descuentos', -boleta.otrosDescuentos, COLORS.red);

    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.red);
    doc.text('TOTAL DESCUENTOS', margin + 3, y);
    doc.text(`-${formatCurrency(boleta.totalDescuentos, 'PEN')}`, pageWidth - margin - 3, y, { align: 'right' });
    y += 8;
  }

  // --- NETO ---
  doc.setFillColor(...COLORS.primary);
  doc.rect(margin, y, pageWidth - margin * 2, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('NETO A PAGAR', margin + 3, y + 7);
  doc.text(formatCurrency(boleta.totalNeto, 'PEN'), pageWidth - margin - 3, y + 7, { align: 'right' });
  y += 18;

  // --- Detalle comisiones ---
  if (boleta.detalleComisiones.length > 0) {
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLE DE COMISIONES', margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray);

    // Headers
    doc.text('VENTA', margin + 3, y);
    doc.text('MONTO', margin + 60, y);
    doc.text('%', margin + 95, y);
    doc.text('COMISION', margin + 115, y);
    y += 4;
    doc.line(margin, y - 1, pageWidth - margin, y - 1);

    doc.setTextColor(...COLORS.dark);
    for (const d of boleta.detalleComisiones.slice(0, 20)) {
      doc.text(d.ventaNumero, margin + 3, y);
      doc.text(formatCurrency(d.montoVenta, 'PEN'), margin + 60, y);
      doc.text(`${d.porcentaje}%`, margin + 95, y);
      doc.text(formatCurrency(d.montoComision, 'PEN'), margin + 115, y);
      y += 4;
      if (y > 270) break;
    }
    if (boleta.detalleComisiones.length > 20) {
      doc.setTextColor(...COLORS.gray);
      doc.text(`... y ${boleta.detalleComisiones.length - 20} ventas más`, margin + 3, y);
    }
  }

  // --- Footer ---
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-PE')} — Vita Skin Peru`, margin, footerY);
  doc.text(`${boleta.id}`, pageWidth - margin, footerY, { align: 'right' });

  return doc.output('blob');
}
