/**
 * csvExport.ts — utility para exports CSV cliente-side
 *
 * chk5.D-S9 Fase A · cierra placeholders "Exportar" del módulo Finanzas
 * (Movimientos · Saldos · CC Aging) y cualquier otra vista del ERP que
 * necesite exportar tabla a CSV.
 *
 * Patrón: 100% navegador · Blob + URL.createObjectURL · cero dependencias.
 * Soporta:
 *   - Headers personalizados
 *   - Escape de comas y comillas dentro de campos
 *   - BOM UTF-8 para que Excel lo abra con tildes correctas
 *   - Nombre de archivo con timestamp automático opcional
 */

// ─── Tipos públicos ─────────────────────────────────────────────────

export interface CsvColumn<T> {
  /** Header visible en la primera fila del CSV */
  header: string;
  /** Función que extrae el valor de cada row · debe devolver string/number/null */
  get: (row: T) => string | number | null | undefined;
}

export interface CsvExportOptions<T> {
  /** Filas a exportar */
  rows: T[];
  /** Definición de columnas (en orden) */
  columns: CsvColumn<T>[];
  /**
   * Nombre del archivo · sin extensión. Si incluye `{timestamp}` se reemplaza
   * por la fecha-hora actual en formato `YYYY-MM-DD_HHmm`.
   * Default: `export_{timestamp}`
   */
  filename?: string;
  /** Separador · default: coma. Para Excel-ES preferir `;` */
  separator?: ',' | ';';
}

// ─── Implementación ─────────────────────────────────────────────────

/**
 * Genera y dispara la descarga del CSV.
 * Maneja escape RFC-4180 (campos con coma/comilla/newline van envueltos
 * en comillas dobles · comillas internas se duplican).
 */
export function exportToCsv<T>(opts: CsvExportOptions<T>): void {
  const sep = opts.separator ?? ',';
  const filename = formatFilename(opts.filename ?? 'export_{timestamp}');

  // Headers
  const headerLine = opts.columns.map((c) => escapeCsv(c.header, sep)).join(sep);

  // Rows
  const dataLines = opts.rows.map((row) =>
    opts.columns
      .map((col) => {
        const raw = col.get(row);
        if (raw === null || raw === undefined) return '';
        return escapeCsv(String(raw), sep);
      })
      .join(sep),
  );

  const csvBody = [headerLine, ...dataLines].join('\r\n');

  // BOM UTF-8 para que Excel respete tildes (ej. "Categoría", "España")
  const bom = '﻿';
  const blob = new Blob([bom + csvBody], { type: 'text/csv;charset=utf-8' });

  // Trigger descarga
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Liberar memoria del Blob después de un tick
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ─── Helpers internos ───────────────────────────────────────────────

/**
 * Escape RFC-4180:
 *  - Si el valor contiene separador, comilla doble, o salto de línea →
 *    envolver en comillas dobles
 *  - Comillas dobles internas se duplican (`"` → `""`)
 */
function escapeCsv(value: string, sep: string): string {
  const needsQuoting =
    value.includes(sep) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r');
  if (!needsQuoting) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Reemplaza `{timestamp}` en el filename por la fecha-hora actual.
 * Formato: 2026-05-21_1530
 */
function formatFilename(template: string): string {
  if (!template.includes('{timestamp}')) return template;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return template.replace('{timestamp}', `${yyyy}-${mm}-${dd}_${hh}${mi}`);
}

/**
 * Helper para formatear fechas Firestore-Timestamp / Date / millis a string
 * legible en CSV. Devuelve "" si la fecha es null/undefined.
 */
export function fmtFechaCsv(
  fecha: { toMillis?: () => number } | Date | number | null | undefined,
): string {
  if (fecha === null || fecha === undefined) return '';
  let ms: number;
  if (typeof fecha === 'number') ms = fecha;
  else if (fecha instanceof Date) ms = fecha.getTime();
  else if (typeof fecha.toMillis === 'function') ms = fecha.toMillis();
  else return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Helper para formatear montos a string CSV-friendly (sin separador miles
 * para evitar conflicto con sep CSV · 2 decimales fijos).
 */
export function fmtMontoCsv(monto: number | null | undefined): string {
  if (monto === null || monto === undefined || !Number.isFinite(monto)) return '0.00';
  return monto.toFixed(2);
}
