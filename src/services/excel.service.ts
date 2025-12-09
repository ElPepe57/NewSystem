import * as XLSX from 'xlsx';

export class ExcelService {
  /**
   * Exporta un array de objetos a un archivo Excel (.xlsx)
   * @param data Datos a exportar (Array de objetos planos)
   * @param fileName Nombre del archivo (sin extensión)
   * @param sheetName Nombre de la hoja (Opcional, default: 'Datos')
   */
  static exportToExcel(data: any[], fileName: string, sheetName: string = 'Datos'): void {
    try {
      // 1. Validar que haya datos
      if (!data || data.length === 0) {
        console.warn('ExcelService: No hay datos para exportar.');
        return;
      }

      // 2. Crear la hoja de trabajo a partir del JSON
      const worksheet = XLSX.utils.json_to_sheet(data);

      // 3. Ajustar el ancho de las columnas automáticamente (Auto-fit)
      this.autoFitColumns(worksheet, data);

      // 4. Crear el libro de trabajo (Workbook) y agregar la hoja
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // 5. Generar nombre de archivo con fecha actual (YYYY-MM-DD)
      const fecha = new Date().toISOString().split('T')[0];
      const fullFileName = `${fileName}_${fecha}.xlsx`;

      // 6. Descargar el archivo
      XLSX.writeFile(workbook, fullFileName);
      
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      // Opcional: Podrías lanzar el error para que lo maneje la UI
      throw new Error('No se pudo generar el reporte de Excel.');
    }
  }

  /**
   * Calcula y aplica el ancho óptimo para cada columna
   */
  private static autoFitColumns(worksheet: XLSX.WorkSheet, data: any[]) {
    // Obtener todas las llaves (encabezados) del primer objeto
    const keys = Object.keys(data[0]);

    // Calcular el ancho máximo necesario para cada columna
    const columnWidths = keys.map(key => {
      // Empezar con el ancho del encabezado
      let maxLength = key.length;

      // Revisar el contenido de cada fila para esa columna
      data.forEach(row => {
        const cellValue = row[key] ? String(row[key]) : '';
        if (cellValue.length > maxLength) {
          maxLength = cellValue.length;
        }
      });

      // Retornar el ancho + un pequeño padding (2 caracteres extra)
      return { width: maxLength + 2 };
    });

    // Aplicar los anchos a la propiedad '!cols' de la hoja
    worksheet['!cols'] = columnWidths;
  }
}