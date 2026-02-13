/**
 * PRICE INTELLIGENCE SERVICE
 * Servicio de inteligencia de precios para órdenes de compra
 *
 * Proporciona análisis integral de precios incluyendo:
 * - Evaluación del precio ingresado vs histórico
 * - Comparativa de proveedores
 * - Proyección de rentabilidad
 * - Alertas y recomendaciones
 */

import { OrdenCompraService } from './ordenCompra.service';
import { ProductoService } from './producto.service';
import type { Producto } from '../types/producto.types';
import type {
  PriceIntelligenceResult,
  PriceIntelligenceInput,
  PriceIntelligenceConfig,
  EvaluacionPrecio,
  NivelPrecio,
  EstadisticasPrecioHistorico,
  TendenciaPrecio,
  PuntoHistorico,
  ProveedorComparativa,
  ProyeccionRentabilidad,
  AnalisisAhorro,
  AlertaPrecio,
  PrecioHistorico
} from '../types/priceIntelligence.types';

export class PriceIntelligenceService {

  /**
   * Analiza el precio de compra de un producto y genera recomendaciones
   */
  static async analizarPrecio(input: PriceIntelligenceInput): Promise<PriceIntelligenceResult> {
    const { productoId, precioCompra, config } = input;

    // 1. Obtener información del producto
    const producto = await ProductoService.getById(productoId);
    if (!producto) {
      throw new Error(`Producto ${productoId} no encontrado`);
    }

    // 2. Obtener histórico de precios de órdenes de compra
    const historialOC = await OrdenCompraService.getPreciosHistoricos(productoId);

    // 3. Calcular estadísticas del histórico
    const estadisticasHistorico = this.calcularEstadisticasHistorico(historialOC);

    // 4. Preparar puntos para gráfico
    const puntosHistorico = this.prepararPuntosHistorico(historialOC);

    // 5. Evaluar el precio ingresado
    const evaluacion = this.evaluarPrecio(
      precioCompra,
      estadisticasHistorico,
      producto
    );

    // 6. Preparar comparativa de proveedores
    const comparativaProveedores = this.prepararComparativaProveedores(
      producto,
      config.proveedorActual
    );

    // 7. Proyectar rentabilidad
    const proyeccionRentabilidad = this.proyectarRentabilidad(
      precioCompra,
      producto,
      config
    );

    // 8. Analizar potencial de ahorro
    const analisisAhorro = this.analizarAhorro(
      precioCompra,
      comparativaProveedores,
      producto,
      config
    );

    // 9. Generar alertas
    const alertas = this.generarAlertas(
      evaluacion,
      proyeccionRentabilidad,
      producto,
      estadisticasHistorico,
      comparativaProveedores
    );

    // Calcular vigencia de investigación
    const investigacion = producto.investigacion;
    const tieneInvestigacion = !!investigacion;
    let investigacionVigente = false;
    let diasDesdeInvestigacion: number | null = null;

    if (investigacion?.fechaInvestigacion) {
      const fechaInv = investigacion.fechaInvestigacion.toDate();
      const ahora = new Date();
      diasDesdeInvestigacion = Math.floor((ahora.getTime() - fechaInv.getTime()) / (1000 * 60 * 60 * 24));
      investigacionVigente = diasDesdeInvestigacion <= 60; // 60 días de vigencia
    }

    return {
      productoId,
      sku: producto.sku,
      nombreProducto: `${producto.marca} - ${producto.nombreComercial}`,
      precioIngresado: precioCompra,
      evaluacion,
      estadisticasHistorico,
      puntosHistorico,
      comparativaProveedores,
      proyeccionRentabilidad,
      analisisAhorro,
      alertas,
      tieneInvestigacion,
      investigacionVigente,
      diasDesdeInvestigacion,
      tieneHistorico: historialOC.length > 0,
      fechaAnalisis: new Date()
    };
  }

  /**
   * Calcula estadísticas del histórico de precios
   */
  private static calcularEstadisticasHistorico(
    historial: PrecioHistorico[]
  ): EstadisticasPrecioHistorico {
    if (historial.length === 0) {
      return {
        minimo: 0,
        maximo: 0,
        promedio: 0,
        promedioPonderado: 0,
        desviacionEstandar: 0,
        tendencia: 'estable',
        variacion90Dias: 0,
        totalCompras: 0,
        primeraCompra: null,
        ultimaCompra: null
      };
    }

    const precios = historial.map(h => h.costoUnitarioUSD);
    const minimo = Math.min(...precios);
    const maximo = Math.max(...precios);
    const promedio = precios.reduce((a, b) => a + b, 0) / precios.length;

    // Promedio ponderado por cantidad
    const totalCantidad = historial.reduce((sum, h) => sum + h.cantidad, 0);
    const promedioPonderado = totalCantidad > 0
      ? historial.reduce((sum, h) => sum + (h.costoUnitarioUSD * h.cantidad), 0) / totalCantidad
      : promedio;

    // Desviación estándar
    const varianza = precios.reduce((sum, p) => sum + Math.pow(p - promedio, 2), 0) / precios.length;
    const desviacionEstandar = Math.sqrt(varianza);

    // Ordenar por fecha
    const ordenado = [...historial].sort((a, b) =>
      a.fechaCompra.getTime() - b.fechaCompra.getTime()
    );

    // Calcular tendencia y variación en últimos 90 días
    const ahora = new Date();
    const hace90Dias = new Date(ahora.getTime() - 90 * 24 * 60 * 60 * 1000);
    const ultimos90Dias = historial.filter(h => h.fechaCompra >= hace90Dias);

    let tendencia: TendenciaPrecio = 'estable';
    let variacion90Dias = 0;

    if (ultimos90Dias.length >= 2) {
      const ordenados90 = [...ultimos90Dias].sort((a, b) =>
        a.fechaCompra.getTime() - b.fechaCompra.getTime()
      );
      const primero = ordenados90[0].costoUnitarioUSD;
      const ultimo = ordenados90[ordenados90.length - 1].costoUnitarioUSD;
      variacion90Dias = primero > 0 ? ((ultimo - primero) / primero) * 100 : 0;

      if (variacion90Dias > 5) tendencia = 'subiendo';
      else if (variacion90Dias < -5) tendencia = 'bajando';
    } else if (historial.length >= 2) {
      // Usar todo el histórico si no hay suficientes datos recientes
      const primero = ordenado[0].costoUnitarioUSD;
      const ultimo = ordenado[ordenado.length - 1].costoUnitarioUSD;
      variacion90Dias = primero > 0 ? ((ultimo - primero) / primero) * 100 : 0;

      if (variacion90Dias > 5) tendencia = 'subiendo';
      else if (variacion90Dias < -5) tendencia = 'bajando';
    }

    return {
      minimo,
      maximo,
      promedio,
      promedioPonderado,
      desviacionEstandar,
      tendencia,
      variacion90Dias,
      totalCompras: historial.length,
      primeraCompra: ordenado[0]?.fechaCompra || null,
      ultimaCompra: ordenado[ordenado.length - 1]?.fechaCompra || null
    };
  }

  /**
   * Prepara los puntos para el gráfico de histórico
   */
  private static prepararPuntosHistorico(historial: PrecioHistorico[]): PuntoHistorico[] {
    return historial
      .sort((a, b) => a.fechaCompra.getTime() - b.fechaCompra.getTime())
      .slice(-20) // Últimos 20 registros
      .map(h => ({
        fecha: h.fechaCompra,
        precio: h.costoUnitarioUSD,
        proveedor: h.proveedorNombre,
        cantidad: h.cantidad,
        numeroOrden: h.numeroOrden
      }));
  }

  /**
   * Evalúa el precio ingresado y genera una puntuación
   */
  private static evaluarPrecio(
    precioIngresado: number,
    estadisticas: EstadisticasPrecioHistorico,
    producto: Producto
  ): EvaluacionPrecio {
    const inv = producto.investigacion;
    const precioInvestigacion = inv?.precioUSAPromedio || null;

    // Si no hay histórico ni investigación
    if (estadisticas.totalCompras === 0 && !precioInvestigacion) {
      return {
        nivel: 'aceptable',
        puntuacion: 50,
        color: 'yellow',
        mensaje: 'Sin referencia histórica',
        descripcion: 'Este es el primer registro de precio para este producto. Se usará como referencia futura.',
        vsPromedioHistorico: 0,
        vsInvestigacion: null,
        vsMejorHistorico: 0
      };
    }

    // Calcular porcentajes de comparación
    const vsPromedioHistorico = estadisticas.promedio > 0
      ? ((precioIngresado - estadisticas.promedio) / estadisticas.promedio) * 100
      : 0;

    const vsInvestigacion = precioInvestigacion
      ? ((precioIngresado - precioInvestigacion) / precioInvestigacion) * 100
      : null;

    const vsMejorHistorico = estadisticas.minimo > 0
      ? ((precioIngresado - estadisticas.minimo) / estadisticas.minimo) * 100
      : 0;

    // Calcular puntuación base (100 = igual al mejor precio, 0 = muy por encima)
    let puntuacion = 100;

    // Penalizar si está por encima del promedio
    if (vsPromedioHistorico > 0) {
      puntuacion -= vsPromedioHistorico * 2; // -2 puntos por cada % sobre promedio
    } else {
      puntuacion += Math.abs(vsPromedioHistorico); // +1 punto por cada % bajo promedio (max 100)
    }

    // Penalizar si está por encima del mejor histórico
    if (vsMejorHistorico > 10) {
      puntuacion -= (vsMejorHistorico - 10); // Penalizar extra si > 10% sobre el mejor
    }

    // Considerar investigación si existe
    if (vsInvestigacion !== null && vsInvestigacion > 5) {
      puntuacion -= vsInvestigacion; // Penalizar si está muy por encima de investigación
    }

    // Normalizar puntuación
    puntuacion = Math.max(0, Math.min(100, puntuacion));

    // Determinar nivel y color
    let nivel: NivelPrecio;
    let color: 'green' | 'yellow' | 'orange' | 'red';
    let mensaje: string;
    let descripcion: string;

    if (puntuacion >= 85) {
      nivel = 'excelente';
      color = 'green';
      mensaje = 'Precio excelente';
      descripcion = `El precio está ${Math.abs(vsPromedioHistorico).toFixed(1)}% ${vsPromedioHistorico <= 0 ? 'por debajo' : 'cerca'} del promedio histórico.`;
    } else if (puntuacion >= 70) {
      nivel = 'bueno';
      color = 'green';
      mensaje = 'Buen precio';
      descripcion = 'El precio está dentro de un rango favorable basado en tu historial de compras.';
    } else if (puntuacion >= 50) {
      nivel = 'aceptable';
      color = 'yellow';
      mensaje = 'Precio aceptable';
      descripcion = `El precio está ${vsPromedioHistorico.toFixed(1)}% ${vsPromedioHistorico > 0 ? 'sobre' : 'bajo'} el promedio histórico.`;
    } else if (puntuacion >= 30) {
      nivel = 'alto';
      color = 'orange';
      mensaje = 'Precio alto';
      descripcion = `El precio está ${vsPromedioHistorico.toFixed(1)}% sobre el promedio. Considera buscar alternativas.`;
    } else {
      nivel = 'muy_alto';
      color = 'red';
      mensaje = 'Precio muy alto';
      descripcion = `El precio está significativamente por encima del histórico (${vsPromedioHistorico.toFixed(1)}%). Revisa otras opciones.`;
    }

    return {
      nivel,
      puntuacion,
      color,
      mensaje,
      descripcion,
      vsPromedioHistorico,
      vsInvestigacion,
      vsMejorHistorico
    };
  }

  /**
   * Prepara la comparativa de proveedores desde la investigación
   */
  private static prepararComparativaProveedores(
    producto: Producto,
    proveedorActual?: string
  ): ProveedorComparativa[] {
    const inv = producto.investigacion;
    if (!inv?.proveedoresUSA || inv.proveedoresUSA.length === 0) {
      return [];
    }

    // Calcular precio total para cada proveedor
    const proveedoresConTotal = inv.proveedoresUSA.map(p => {
      const impuesto = p.impuesto || 0;
      const precioConImpuesto = p.precio * (1 + impuesto / 100);
      const envioEstimado = p.envioEstimado || 0;
      const precioTotal = precioConImpuesto + envioEstimado;

      return {
        proveedorId: undefined, // No tenemos ID de proveedor en la investigación
        nombre: p.nombre,
        precioBase: p.precio,
        impuesto,
        precioConImpuesto,
        envioEstimado,
        precioTotal,
        disponibilidad: p.disponibilidad || 'desconocido' as const,
        url: p.url,
        fechaConsulta: p.fechaConsulta?.toDate(),
        esRecomendado: false,
        esActual: proveedorActual?.toLowerCase() === p.nombre.toLowerCase(),
        diferenciaVsMejor: 0,
        porcentajeVsMejor: 0
      };
    });

    // Encontrar el mejor precio (menor)
    const mejorPrecio = Math.min(...proveedoresConTotal.map(p => p.precioTotal).filter(p => p > 0));

    // Calcular diferencias y marcar recomendado
    return proveedoresConTotal.map(p => ({
      ...p,
      esRecomendado: p.precioTotal === mejorPrecio && p.disponibilidad !== 'sin_stock',
      diferenciaVsMejor: p.precioTotal - mejorPrecio,
      porcentajeVsMejor: mejorPrecio > 0 ? ((p.precioTotal - mejorPrecio) / mejorPrecio) * 100 : 0
    })).sort((a, b) => a.precioTotal - b.precioTotal);
  }

  /**
   * Proyecta la rentabilidad basada en el precio de compra
   */
  private static proyectarRentabilidad(
    precioCompra: number,
    producto: Producto,
    config: PriceIntelligenceConfig
  ): ProyeccionRentabilidad {
    const { tipoCambio, costoFleteUSAPeru, logisticaAdicional = 0, margenObjetivo, margenMinimo } = config;
    const inv = producto.investigacion;

    // Calcular CTRU
    const costoTotalUSD = precioCompra + costoFleteUSAPeru + logisticaAdicional;
    const ctruProyectadoUSD = costoTotalUSD;
    const ctruProyectado = costoTotalUSD * tipoCambio;

    // Precio de venta sugerido (para alcanzar margen objetivo)
    const precioVentaSugerido = ctruProyectado / (1 - margenObjetivo / 100);

    // Si tiene precio sugerido en el producto, usar ese
    const precioVentaFinal = producto.precioSugerido > 0 ? producto.precioSugerido : precioVentaSugerido;

    // Calcular margen estimado
    const margenEstimado = precioVentaFinal > 0
      ? ((precioVentaFinal - ctruProyectado) / precioVentaFinal) * 100
      : 0;

    // Ganancia por unidad
    const gananciaPorUnidad = precioVentaFinal - ctruProyectado;

    // Comparar con competencia Perú
    let vsCompetenciaPeru: ProyeccionRentabilidad['vsCompetenciaPeru'] = null;
    if (inv?.precioPERUPromedio && inv.precioPERUPromedio > 0) {
      const diferencia = precioVentaFinal - inv.precioPERUPromedio;
      const porcentaje = (diferencia / inv.precioPERUPromedio) * 100;
      vsCompetenciaPeru = {
        precioPromedio: inv.precioPERUPromedio,
        diferencia,
        porcentaje,
        posicion: porcentaje < -2 ? 'mas_barato' : porcentaje > 2 ? 'mas_caro' : 'igual'
      };
    }

    return {
      ctruProyectado,
      ctruProyectadoUSD,
      precioVentaSugerido: precioVentaFinal,
      margenEstimado,
      gananciaPorUnidad,
      vsCompetenciaPeru,
      alertaMargenBajo: margenEstimado < margenMinimo,
      alertaPrecioNoCompetitivo: vsCompetenciaPeru?.posicion === 'mas_caro' && vsCompetenciaPeru.porcentaje > 10
    };
  }

  /**
   * Analiza el potencial de ahorro comprando a otro proveedor
   */
  private static analizarAhorro(
    precioIngresado: number,
    comparativa: ProveedorComparativa[],
    producto: Producto,
    config: PriceIntelligenceConfig
  ): AnalisisAhorro | null {
    if (comparativa.length < 2) return null;

    const mejorProveedor = comparativa.find(p => p.esRecomendado && !p.esActual);
    if (!mejorProveedor) return null;

    const ahorroPorUnidad = precioIngresado - mejorProveedor.precioConImpuesto;
    if (ahorroPorUnidad <= 0.5) return null; // No vale la pena si el ahorro es mínimo

    const porcentajeAhorro = (ahorroPorUnidad / precioIngresado) * 100;

    // Calcular impacto en margen
    const { tipoCambio, costoFleteUSAPeru, margenObjetivo } = config;
    const ctruActual = (precioIngresado + costoFleteUSAPeru) * tipoCambio;
    const ctruAlternativo = (mejorProveedor.precioConImpuesto + costoFleteUSAPeru) * tipoCambio;
    const precioVenta = producto.precioSugerido || ctruActual / (1 - margenObjetivo / 100);

    const margenActual = precioVenta > 0 ? ((precioVenta - ctruActual) / precioVenta) * 100 : 0;
    const margenAlternativo = precioVenta > 0 ? ((precioVenta - ctruAlternativo) / precioVenta) * 100 : 0;
    const impactoEnMargen = margenAlternativo - margenActual;

    return {
      proveedorAlternativo: mejorProveedor.nombre,
      ahorroPorUnidad,
      porcentajeAhorro,
      impactoEnMargen,
      mensaje: `Con ${mejorProveedor.nombre} ahorrarías $${ahorroPorUnidad.toFixed(2)}/unidad (+${impactoEnMargen.toFixed(1)}% margen)`
    };
  }

  /**
   * Genera alertas basadas en el análisis
   */
  private static generarAlertas(
    evaluacion: EvaluacionPrecio,
    rentabilidad: ProyeccionRentabilidad,
    producto: Producto,
    estadisticas: EstadisticasPrecioHistorico,
    comparativa: ProveedorComparativa[]
  ): AlertaPrecio[] {
    const alertas: AlertaPrecio[] = [];

    // Alerta de precio alto
    if (evaluacion.nivel === 'alto' || evaluacion.nivel === 'muy_alto') {
      alertas.push({
        tipo: 'warning',
        titulo: 'Precio por encima del histórico',
        mensaje: `Este precio está ${evaluacion.vsPromedioHistorico.toFixed(1)}% sobre tu promedio de compra.`,
        accion: 'Considera negociar o buscar alternativas'
      });
    }

    // Alerta de margen bajo
    if (rentabilidad.alertaMargenBajo) {
      alertas.push({
        tipo: 'danger',
        titulo: 'Margen proyectado bajo',
        mensaje: `El margen estimado (${rentabilidad.margenEstimado.toFixed(1)}%) está por debajo del mínimo aceptable.`,
        accion: 'Evalúa ajustar el precio de venta o buscar mejor precio de compra'
      });
    }

    // Alerta de precio no competitivo
    if (rentabilidad.alertaPrecioNoCompetitivo) {
      alertas.push({
        tipo: 'warning',
        titulo: 'Precio de venta alto vs competencia',
        mensaje: `Tu precio de venta estaría ${Math.abs(rentabilidad.vsCompetenciaPeru?.porcentaje || 0).toFixed(1)}% sobre la competencia.`,
        accion: 'Considera reducir el margen o buscar mejor precio de compra'
      });
    }

    // Alerta de tendencia al alza
    if (estadisticas.tendencia === 'subiendo' && estadisticas.variacion90Dias > 10) {
      alertas.push({
        tipo: 'info',
        titulo: 'Tendencia de precio al alza',
        mensaje: `Los precios han subido ${estadisticas.variacion90Dias.toFixed(1)}% en los últimos 90 días.`,
        accion: 'Considera comprar más cantidad si el precio actual es aceptable'
      });
    }

    // Alerta de mejor proveedor disponible
    const mejorProveedor = comparativa.find(p => p.esRecomendado && !p.esActual);
    if (mejorProveedor && mejorProveedor.diferenciaVsMejor > 1) {
      alertas.push({
        tipo: 'info',
        titulo: 'Proveedor más económico disponible',
        mensaje: `${mejorProveedor.nombre} tiene mejor precio ($${mejorProveedor.precioConImpuesto.toFixed(2)}).`,
        accion: `Ahorro potencial: $${mejorProveedor.diferenciaVsMejor.toFixed(2)}/unidad`
      });
    }

    // Alerta de investigación vencida
    const inv = producto.investigacion;
    if (inv?.fechaInvestigacion) {
      const diasDesde = Math.floor(
        (new Date().getTime() - inv.fechaInvestigacion.toDate().getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diasDesde > 60) {
        alertas.push({
          tipo: 'warning',
          titulo: 'Investigación de mercado desactualizada',
          mensaje: `La investigación tiene ${diasDesde} días. Los precios de referencia pueden haber cambiado.`,
          accion: 'Actualiza la investigación de mercado'
        });
      }
    } else if (!inv) {
      alertas.push({
        tipo: 'info',
        titulo: 'Sin investigación de mercado',
        mensaje: 'Este producto no tiene investigación de precios. Las comparativas están limitadas.',
        accion: 'Realiza una investigación de mercado'
      });
    }

    // Alerta positiva si todo está bien
    if (alertas.length === 0 && evaluacion.puntuacion >= 70 && !rentabilidad.alertaMargenBajo) {
      alertas.push({
        tipo: 'success',
        titulo: 'Precio óptimo',
        mensaje: 'Este precio está dentro de los parámetros saludables según tu historial y rentabilidad.',
        accion: 'Puedes proceder con la compra'
      });
    }

    return alertas;
  }

  /**
   * Obtiene un resumen rápido del precio (para mostrar inline)
   */
  static async getResumenRapido(
    productoId: string,
    precioCompra: number
  ): Promise<{
    tieneReferencia: boolean;
    promedioHistorico: number;
    mejorHistorico: number;
    precioInvestigacion: number | null;
    evaluacionRapida: 'excelente' | 'bueno' | 'normal' | 'alto' | 'muy_alto';
    porcentajeVsPromedio: number;
  }> {
    const historial = await OrdenCompraService.getPreciosHistoricos(productoId);
    const producto = await ProductoService.getById(productoId);

    if (historial.length === 0) {
      return {
        tieneReferencia: false,
        promedioHistorico: 0,
        mejorHistorico: 0,
        precioInvestigacion: producto?.investigacion?.precioUSAPromedio || null,
        evaluacionRapida: 'normal',
        porcentajeVsPromedio: 0
      };
    }

    const precios = historial.map(h => h.costoUnitarioUSD);
    const promedio = precios.reduce((a, b) => a + b, 0) / precios.length;
    const mejor = Math.min(...precios);
    const porcentaje = ((precioCompra - promedio) / promedio) * 100;

    let evaluacion: 'excelente' | 'bueno' | 'normal' | 'alto' | 'muy_alto';
    if (porcentaje <= -10) evaluacion = 'excelente';
    else if (porcentaje <= 0) evaluacion = 'bueno';
    else if (porcentaje <= 10) evaluacion = 'normal';
    else if (porcentaje <= 25) evaluacion = 'alto';
    else evaluacion = 'muy_alto';

    return {
      tieneReferencia: true,
      promedioHistorico: promedio,
      mejorHistorico: mejor,
      precioInvestigacion: producto?.investigacion?.precioUSAPromedio || null,
      evaluacionRapida: evaluacion,
      porcentajeVsPromedio: porcentaje
    };
  }
}
