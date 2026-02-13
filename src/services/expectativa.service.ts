import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { tipoCambioService } from './tipoCambio.service';
import { ctruService } from './ctru.service';
import { VentaService } from './venta.service';
import { OrdenCompraService } from './ordenCompra.service';
import { ProductoService } from './producto.service';
import { unidadService } from './unidad.service';
import type {
  Requerimiento,
  RequerimientoFormData,
  RequerimientoFiltros,
  ComparacionVenta,
  ComparacionCompra,
  ExpectativaStats,
  ReporteExpectativaVsRealidad
} from '../types/expectativa.types';
import type { Venta } from '../types/venta.types';
import type { OrdenCompra } from '../types/ordenCompra.types';

const REQUERIMIENTOS_COLLECTION = 'requerimientos';

/**
 * Servicio de Expectativa vs Realidad
 * Analiza la diferencia entre lo esperado y lo real en ventas y compras
 */
export const expectativaService = {
  // ===============================================
  // REQUERIMIENTOS
  // ===============================================

  /**
   * Generar número de requerimiento
   */
  async generateNumeroRequerimiento(): Promise<string> {
    const year = new Date().getFullYear();
    const q = query(
      collection(db, REQUERIMIENTOS_COLLECTION),
      orderBy('fechaCreacion', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);

    let nextNumber = 1;
    if (!snapshot.empty) {
      const lastDoc = snapshot.docs[0].data();
      const lastNumero = lastDoc.numeroRequerimiento as string;
      const match = lastNumero.match(/REQ-\d{4}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `REQ-${year}-${nextNumber.toString().padStart(4, '0')}`;
  },

  /**
   * Crear un requerimiento de compra
   */
  async crearRequerimiento(
    data: RequerimientoFormData,
    userId: string
  ): Promise<string> {
    const numeroRequerimiento = await this.generateNumeroRequerimiento();

    // Obtener TC actual para la expectativa
    let tcInvestigacion = 3.70;
    try {
      const tcDelDia = await tipoCambioService.getTCDelDia();
      if (tcDelDia) {
        tcInvestigacion = tcDelDia.venta;
      }
    } catch (e) {
      console.warn('No se pudo obtener TC del día');
    }

    // Calcular expectativa financiera usando datos reales de investigación
    // Costo base = precio USA × cantidad
    const costoEstimadoUSD = data.productos.reduce(
      (sum, p) => sum + (p.precioEstimadoUSD || 0) * p.cantidadSolicitada,
      0
    );

    // Impuesto = usar % de sales tax de proveedores USA
    const impuestoEstimadoUSD = data.productos.reduce((sum, p) => {
      if (p.impuestoPorcentaje && p.impuestoPorcentaje > 0) {
        // Calcular impuesto: precio × cantidad × (porcentaje / 100)
        return sum + (p.precioEstimadoUSD || 0) * p.cantidadSolicitada * (p.impuestoPorcentaje / 100);
      }
      return sum;
    }, 0);

    // Flete = usar logística real de investigación, o 10% como fallback
    const fleteEstimadoUSD = data.productos.reduce((sum, p) => {
      if (p.logisticaEstimadaUSD) {
        // Usar logística real de la investigación de mercado
        return sum + p.logisticaEstimadaUSD * p.cantidadSolicitada;
      }
      // Fallback: 10% del costo del producto
      return sum + (p.precioEstimadoUSD || 0) * p.cantidadSolicitada * 0.10;
    }, 0);

    const costoTotalEstimadoUSD = costoEstimadoUSD + impuestoEstimadoUSD + fleteEstimadoUSD;
    const costoTotalEstimadoPEN = costoTotalEstimadoUSD * tcInvestigacion;

    // Obtener información completa de cada producto
    const productosConInfo = await Promise.all(
      data.productos.map(async (p) => {
        // Obtener información del producto desde la base de datos
        const productoInfo = await ProductoService.getById(p.productoId);

        const producto: Record<string, any> = {
          productoId: p.productoId,
          sku: productoInfo?.sku || '',
          marca: productoInfo?.marca || '',
          nombreComercial: productoInfo?.nombreComercial || '',
          cantidadSolicitada: p.cantidadSolicitada,
          // Campos para tracking de asignación múltiple
          cantidadAsignada: 0,
          cantidadPendiente: p.cantidadSolicitada,
          cantidadRecibida: 0,
          fechaInvestigacion: Timestamp.now()
        };
        // Solo agregar campos opcionales si tienen valor
        if (p.precioEstimadoUSD !== undefined && p.precioEstimadoUSD !== null) {
          producto.precioEstimadoUSD = p.precioEstimadoUSD;
        }
        if (p.proveedorSugerido) {
          producto.proveedorSugerido = p.proveedorSugerido;
        }
        if (p.urlReferencia) {
          producto.urlReferencia = p.urlReferencia;
        }
        return producto;
      })
    );

    // Construir objeto base sin campos undefined
    const requerimiento: Record<string, any> = {
      numeroRequerimiento,
      origen: data.origen,
      tipoSolicitante: data.tipoSolicitante,
      productos: productosConInfo,
      // Array vacío para asignaciones de responsables/viajeros
      asignaciones: [],
      expectativa: {
        tcInvestigacion,
        costoEstimadoUSD,
        costoEstimadoPEN: costoEstimadoUSD * tcInvestigacion,
        impuestoEstimadoUSD,
        fleteEstimadoUSD,
        costoTotalEstimadoUSD,
        costoTotalEstimadoPEN
      },
      prioridad: data.prioridad,
      estado: 'pendiente',
      solicitadoPor: userId,
      fechaSolicitud: Timestamp.now(),
      creadoPor: userId,
      fechaCreacion: Timestamp.now()
    };

    // Agregar campos opcionales solo si tienen valor
    if (data.ventaRelacionadaId) {
      requerimiento.ventaRelacionadaId = data.ventaRelacionadaId;
    }
    if (data.nombreClienteSolicitante) {
      requerimiento.nombreClienteSolicitante = data.nombreClienteSolicitante;
    }
    if (data.fechaRequerida) {
      requerimiento.fechaRequerida = Timestamp.fromDate(data.fechaRequerida);
    }
    if (data.justificacion) {
      requerimiento.justificacion = data.justificacion;
    }
    if (data.observaciones) {
      requerimiento.observaciones = data.observaciones;
    }

    const docRef = await addDoc(collection(db, REQUERIMIENTOS_COLLECTION), requerimiento);
    return docRef.id;
  },

  /**
   * Crear requerimiento desde cotización (cuando no hay stock)
   * Este método se usa cuando una cotización necesita stock que no existe
   */
  async crearRequerimientoDesdeCotizacion(
    cotizacionId: string,
    cotizacionNumero: string,
    nombreCliente: string,
    productos: Array<{
      productoId: string;
      sku: string;
      marca: string;
      nombreComercial: string;
      cantidadFaltante: number;
      precioEstimadoUSD?: number;
      impuestoPorcentaje?: number;
      logisticaEstimadaUSD?: number;
      ctruEstimado?: number;
    }>,
    userId: string
  ): Promise<{ id: string; numero: string }> {
    const formData: RequerimientoFormData = {
      origen: 'venta_pendiente',
      ventaRelacionadaId: cotizacionId,
      tipoSolicitante: 'cliente',
      nombreClienteSolicitante: nombreCliente,
      prioridad: 'alta',
      productos: productos.map(p => ({
        productoId: p.productoId,
        cantidadSolicitada: p.cantidadFaltante,
        precioEstimadoUSD: p.precioEstimadoUSD,
        impuestoPorcentaje: p.impuestoPorcentaje,
        logisticaEstimadaUSD: p.logisticaEstimadaUSD,
        ctruEstimado: p.ctruEstimado
      })),
      justificacion: `Requerimiento automático desde cotización ${cotizacionNumero} - Cliente: ${nombreCliente}`
    };

    const id = await this.crearRequerimiento(formData, userId);
    const req = await this.getRequerimientoById(id);

    return {
      id,
      numero: req?.numeroRequerimiento || ''
    };
  },

  /**
   * Obtener requerimiento por ID
   */
  async getRequerimientoById(id: string): Promise<Requerimiento | null> {
    const docRef = doc(db, REQUERIMIENTOS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    } as Requerimiento;
  },

  /**
   * Obtener requerimientos con filtros
   */
  async getRequerimientos(filtros?: RequerimientoFiltros): Promise<Requerimiento[]> {
    let q = query(
      collection(db, REQUERIMIENTOS_COLLECTION),
      orderBy('fechaCreacion', 'desc')
    );

    if (filtros?.estado) {
      q = query(q, where('estado', '==', filtros.estado));
    }
    if (filtros?.prioridad) {
      q = query(q, where('prioridad', '==', filtros.prioridad));
    }
    if (filtros?.origen) {
      q = query(q, where('origen', '==', filtros.origen));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Requerimiento));
  },

  /**
   * Actualizar estado de un requerimiento
   */
  async actualizarEstado(
    requerimientoId: string,
    nuevoEstado: 'pendiente' | 'aprobado' | 'en_proceso' | 'completado' | 'cancelado',
    userId: string
  ): Promise<void> {
    const updateData: Record<string, any> = {
      estado: nuevoEstado,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    };

    // Agregar fechas específicas según el estado
    if (nuevoEstado === 'aprobado') {
      updateData.fechaAprobacion = serverTimestamp();
      updateData.aprobadoPor = userId;
    } else if (nuevoEstado === 'completado') {
      updateData.fechaCompletado = serverTimestamp();
    }

    await updateDoc(doc(db, REQUERIMIENTOS_COLLECTION, requerimientoId), updateData);
  },

  /**
   * Vincular requerimiento con OC
   */
  async vincularConOC(
    requerimientoId: string,
    ordenCompraId: string,
    ordenCompraNumero: string,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, REQUERIMIENTOS_COLLECTION, requerimientoId), {
      estado: 'en_proceso',
      ordenCompraId,
      ordenCompraNumero,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    });
  },

  // ===============================================
  // CÁLCULO DE EXPECTATIVAS
  // ===============================================

  /**
   * Calcular expectativa de una cotización
   * Se usa al crear una venta en estado 'cotizacion'
   */
  async calcularExpectativaCotizacion(
    productos: Array<{ productoId: string; cantidad: number; precioUnitario: number }>,
    tcActual: number
  ): Promise<{
    costoEstimadoUSD: number;
    costoEstimadoPEN: number;
    margenEsperado: number;
    utilidadEsperadaPEN: number;
    productosEstimados: Array<{
      productoId: string;
      costoUnitarioEstimadoUSD: number;
      margenEstimado: number;
    }>;
  }> {
    let costoTotalUSD = 0;
    let ventaTotalPEN = 0;
    const productosEstimados: Array<{
      productoId: string;
      costoUnitarioEstimadoUSD: number;
      margenEstimado: number;
    }> = [];

    for (const prod of productos) {
      // Obtener CTRU actual del producto
      try {
        const ctruInfo = await ctruService.getCTRUProducto(prod.productoId);
        const costoUnitarioUSD = ctruInfo.ctruPromedio / tcActual; // Convertir CTRU PEN a USD
        const costoProductoUSD = costoUnitarioUSD * prod.cantidad;
        costoTotalUSD += costoProductoUSD;

        const subtotalVenta = prod.cantidad * prod.precioUnitario;
        ventaTotalPEN += subtotalVenta;

        const costoProductoPEN = costoProductoUSD * tcActual;
        const utilidadProducto = subtotalVenta - costoProductoPEN;
        const margenProducto = subtotalVenta > 0 ? (utilidadProducto / subtotalVenta) * 100 : 0;

        productosEstimados.push({
          productoId: prod.productoId,
          costoUnitarioEstimadoUSD: costoUnitarioUSD,
          margenEstimado: margenProducto
        });
      } catch (e) {
        // Si no hay CTRU, usar estimado
        productosEstimados.push({
          productoId: prod.productoId,
          costoUnitarioEstimadoUSD: 0,
          margenEstimado: 0
        });
      }
    }

    const costoEstimadoPEN = costoTotalUSD * tcActual;
    const utilidadEsperadaPEN = ventaTotalPEN - costoEstimadoPEN;
    const margenEsperado = ventaTotalPEN > 0 ? (utilidadEsperadaPEN / ventaTotalPEN) * 100 : 0;

    return {
      costoEstimadoUSD: costoTotalUSD,
      costoEstimadoPEN,
      margenEsperado,
      utilidadEsperadaPEN,
      productosEstimados
    };
  },

  /**
   * Comparar expectativa vs realidad de una venta
   */
  async compararVenta(ventaId: string): Promise<ComparacionVenta | null> {
    const venta = await VentaService.getById(ventaId);
    if (!venta) return null;

    // Si no tiene expectativa guardada, no podemos comparar
    if (!venta.expectativaCotizacion) {
      return null;
    }

    const expectativa = venta.expectativaCotizacion;

    // Obtener datos reales
    const costoRealPEN = venta.costoTotalPEN || 0;
    const utilidadRealPEN = venta.utilidadBrutaPEN || 0;
    const margenReal = venta.margenPromedio || 0;
    const tcVenta = venta.tcVenta || expectativa.tcCotizacion;

    // Calcular costoRealUSD
    const costoRealUSD = tcVenta > 0 ? costoRealPEN / tcVenta : 0;

    // Calcular diferencias
    const diferenciaTC = tcVenta - expectativa.tcCotizacion;
    const diferenciaCostoPEN = costoRealPEN - expectativa.costoEstimadoPEN;
    const diferenciaMargen = margenReal - expectativa.margenEsperado;
    const diferenciaUtilidadPEN = utilidadRealPEN - expectativa.utilidadEsperadaPEN;

    const cumplioExpectativa = utilidadRealPEN >= expectativa.utilidadEsperadaPEN;
    const porcentajeCumplimiento = expectativa.utilidadEsperadaPEN > 0
      ? (utilidadRealPEN / expectativa.utilidadEsperadaPEN) * 100
      : 0;

    
    // Generar razones de la diferencia
    const razones: string[] = [];

    // Calcular impacto del tipo de cambio sobre los costos
    const impactoTC = expectativa.costoEstimadoUSD * diferenciaTC;

    // Analizar impacto del tipo de cambio
    if (Math.abs(diferenciaTC) >= 0.01) {
      if (diferenciaTC > 0) {
        // TC subió = el costo en PEN aumentó = menor utilidad
        razones.push(`TC subió de ${expectativa.tcCotizacion.toFixed(3)} a ${tcVenta.toFixed(3)} (+${diferenciaTC.toFixed(3)}). Pérdida cambiaria: -S/ ${Math.abs(impactoTC).toFixed(2)}`);
      } else {
        // TC bajó = el costo en PEN disminuyó = mayor utilidad
        razones.push(`TC bajó de ${expectativa.tcCotizacion.toFixed(3)} a ${tcVenta.toFixed(3)} (${diferenciaTC.toFixed(3)}). Ganancia cambiaria: +S/ ${Math.abs(impactoTC).toFixed(2)}`);
      }
    }

    // Calcular la diferencia de costo EXCLUYENDO el impacto del TC
    // diferenciaCostoPEN incluye tanto el cambio de TC como el cambio de costo real
    // Para aislar el costo real: costoRealPEN vs lo que hubiera costado al mismo TC
    const costoAjustadoAlTCVenta = expectativa.costoEstimadoUSD * tcVenta;
    const diferenciaCostoSinTC = costoRealPEN - costoAjustadoAlTCVenta;

    // Analizar diferencia de costo (sin incluir impacto TC)
    if (Math.abs(diferenciaCostoSinTC) >= 1) {
      if (diferenciaCostoSinTC > 0) {
        razones.push(`Costo real fue mayor al estimado: +S/ ${diferenciaCostoSinTC.toFixed(2)}`);
      } else {
        razones.push(`Costo real fue menor al estimado: -S/ ${Math.abs(diferenciaCostoSinTC).toFixed(2)}`);
      }
    }

    // Analizar diferencia de margen
    if (Math.abs(diferenciaMargen) >= 1) {
      if (diferenciaMargen > 0) {
        razones.push(`Margen superó expectativa: +${diferenciaMargen.toFixed(1)}%`);
      } else {
        razones.push(`Margen no alcanzó expectativa: ${diferenciaMargen.toFixed(1)}%`);
      }
    }

    // Si no hay razones específicas
    if (razones.length === 0) {
      if (cumplioExpectativa) {
        razones.push('La venta cumplió con las expectativas financieras');
      } else {
        razones.push('La utilidad fue menor a la esperada');
      }
    }

    return {
      ventaId,
      numeroVenta: venta.numeroVenta,
      expectativa: {
        tcCotizacion: expectativa.tcCotizacion,
        costoEstimadoPEN: expectativa.costoEstimadoPEN,
        margenEsperado: expectativa.margenEsperado,
        utilidadEsperadaPEN: expectativa.utilidadEsperadaPEN,
        fechaCotizacion: venta.fechaCreacion
      },
      realidad: {
        tcVenta,
        costoRealPEN,
        margenReal,
        utilidadRealPEN,
        fechaVenta: venta.fechaConfirmacion || venta.fechaCreacion
      },
      diferencias: {
        diferenciaTC,
        impactoTCenPEN: expectativa.costoEstimadoUSD * diferenciaTC,
        diferenciaCostoPEN,
        diferenciaMargen,
        diferenciaUtilidadPEN,
        cumplioExpectativa,
        porcentajeCumplimiento
      },
      razones
    };
  },

  /**
   * Comparar expectativa vs realidad de una compra (OC)
   */
  async compararCompra(ordenCompraId: string): Promise<ComparacionCompra | null> {
    const orden = await OrdenCompraService.getById(ordenCompraId);
    if (!orden) return null;

    // Si no tiene expectativa de requerimiento, no podemos comparar
    if (!orden.expectativaRequerimiento || !orden.requerimientoId) {
      return null;
    }

    const requerimiento = await this.getRequerimientoById(orden.requerimientoId);
    if (!requerimiento) return null;

    const expectativa = orden.expectativaRequerimiento;

    // Datos reales de la OC
    const tcCompra = orden.tcCompra || expectativa.tcInvestigacion;
    const tcPago = orden.tcPago;
    const costoProductosUSD = orden.subtotalUSD;
    const impuestoRealUSD = orden.impuestoUSD || 0;
    const fleteRealUSD = (orden.gastosEnvioUSD || 0) + (orden.otrosGastosUSD || 0);
    const costoTotalRealUSD = orden.totalUSD;
    const costoTotalRealPEN = tcPago
      ? costoTotalRealUSD * tcPago
      : costoTotalRealUSD * tcCompra;

    // Calcular diferencias
    const diferenciaCostoUSD = costoTotalRealUSD - expectativa.costoTotalEstimadoUSD;
    const diferenciaTC = tcCompra - expectativa.tcInvestigacion;
    const diferenciaTCPago = tcPago ? tcPago - tcCompra : undefined;

    // Diferencia en PEN considerando TC
    const diferenciaCostoPEN = costoTotalRealPEN - expectativa.costoTotalEstimadoPEN;

    // Verificar si está dentro del presupuesto (tolerancia 5%)
    const tolerancia = expectativa.costoTotalEstimadoUSD * 0.05;
    const dentroPresupuesto = diferenciaCostoUSD <= tolerancia;

    const porcentajeDesviacion = expectativa.costoTotalEstimadoUSD > 0
      ? (diferenciaCostoUSD / expectativa.costoTotalEstimadoUSD) * 100
      : 0;

    return {
      requerimientoId: orden.requerimientoId,
      numeroRequerimiento: orden.requerimientoNumero || '',
      ordenCompraId,
      numeroOrdenCompra: orden.numeroOrden,
      expectativa: {
        tcInvestigacion: expectativa.tcInvestigacion,
        costoEstimadoUSD: expectativa.costoEstimadoUSD,
        costoEstimadoPEN: expectativa.costoEstimadoPEN,
        impuestoEstimadoUSD: expectativa.impuestoEstimadoUSD || 0,
        fleteEstimadoUSD: expectativa.fleteEstimadoUSD || 0,
        costoTotalEstimadoUSD: expectativa.costoTotalEstimadoUSD,
        costoTotalEstimadoPEN: expectativa.costoTotalEstimadoPEN,
        fechaInvestigacion: expectativa.fechaInvestigacion || requerimiento.fechaSolicitud
      },
      realidad: {
        tcCompra,
        tcPago,
        costoProductosUSD,
        impuestoRealUSD,
        fleteRealUSD,
        costoTotalRealUSD,
        costoTotalRealPEN,
        fechaCompra: orden.fechaCreacion,
        fechaPago: orden.fechaPago
      },
      diferencias: {
        diferenciaTC,
        diferenciaTCPago,
        diferenciaCostoUSD,
        diferenciaCostoPEN,
        diferenciaImpuesto: impuestoRealUSD - (expectativa.impuestoEstimadoUSD || 0),
        diferenciaFlete: fleteRealUSD - (expectativa.fleteEstimadoUSD || 0),
        dentroPresupuesto,
        porcentajeDesviacion
      }
    };
  },

  // ===============================================
  // ESTADÍSTICAS Y REPORTES
  // ===============================================

  /**
   * Obtener estadísticas de expectativa vs realidad
   */
  async getStats(mes?: number, anio?: number): Promise<ExpectativaStats> {
    const ahora = new Date();
    const mesActual = mes || ahora.getMonth() + 1;
    const anioActual = anio || ahora.getFullYear();

    // Obtener ventas del período
    const ventas = await VentaService.getAll();
    const ventasPeriodo = ventas.filter(v => {
      const fecha = v.fechaCreacion.toDate();
      return fecha.getMonth() + 1 === mesActual && fecha.getFullYear() === anioActual;
    });

    // Ventas con expectativa
    const ventasConExpectativa = ventasPeriodo.filter(v => v.expectativaCotizacion);
    const ventasConvertidas = ventasConExpectativa.filter(v => v.estado !== 'cotizacion' && v.estado !== 'cancelada');

    // Calcular métricas de ventas
    let utilidadTotalEsperada = 0;
    let utilidadTotalReal = 0;
    let margenTotalEsperado = 0;
    let margenTotalReal = 0;

    for (const venta of ventasConvertidas) {
      if (venta.expectativaCotizacion) {
        utilidadTotalEsperada += venta.expectativaCotizacion.utilidadEsperadaPEN;
        margenTotalEsperado += venta.expectativaCotizacion.margenEsperado;
      }
      utilidadTotalReal += venta.utilidadBrutaPEN || 0;
      margenTotalReal += venta.margenPromedio || 0;
    }

    const margenPromedioEsperado = ventasConvertidas.length > 0
      ? margenTotalEsperado / ventasConvertidas.length
      : 0;
    const margenPromedioReal = ventasConvertidas.length > 0
      ? margenTotalReal / ventasConvertidas.length
      : 0;

    // Obtener requerimientos del período
    const requerimientos = await this.getRequerimientos();
    const reqPeriodo = requerimientos.filter(r => {
      const fecha = r.fechaCreacion.toDate();
      return fecha.getMonth() + 1 === mesActual && fecha.getFullYear() === anioActual;
    });

    const reqCompletados = reqPeriodo.filter(r => r.estado === 'completado');

    // Calcular métricas de compras
    let costoTotalEstimado = 0;
    let costoTotalReal = 0;
    let reqDentroPresupuesto = 0;

    for (const req of reqCompletados) {
      costoTotalEstimado += req.expectativa.costoTotalEstimadoPEN;

      if (req.ordenCompraId) {
        const comparacion = await this.compararCompra(req.ordenCompraId);
        if (comparacion) {
          costoTotalReal += comparacion.realidad.costoTotalRealPEN;
          if (comparacion.diferencias.dentroPresupuesto) {
            reqDentroPresupuesto++;
          }
        }
      }
    }

    // Calcular impacto del tipo de cambio en ventas
    let ventasAfectadasPorTC = 0;
    let impactoTotalTCVentas = 0;

    for (const venta of ventasConvertidas) {
      if (venta.expectativaCotizacion && venta.tcVenta) {
        const tcCotizacion = venta.expectativaCotizacion.tcCotizacion || 0;
        const tcReal = venta.tcVenta;
        if (tcCotizacion > 0 && Math.abs(tcReal - tcCotizacion) > 0.01) {
          ventasAfectadasPorTC++;
          // Impacto = (TCreal - TCcotizacion) * costoUSD de productos
          const costoUSD = venta.productos.reduce((sum, p) => sum + (p.costoTotalUnidades || 0), 0);
          impactoTotalTCVentas += (tcReal - tcCotizacion) * costoUSD;
        }
      }
    }

    // Calcular impacto del TC en compras
    let comprasAfectadasPorTC = 0;
    let impactoTotalTCCompras = 0;

    for (const req of reqCompletados) {
      if (req.ordenCompraId && req.expectativa.tcInvestigacion) {
        const comparacion = await this.compararCompra(req.ordenCompraId);
        if (comparacion && Math.abs(comparacion.diferencias.diferenciaTC) > 0.01) {
          comprasAfectadasPorTC++;
          // Impacto = diferencia TC * costo USD
          impactoTotalTCCompras += comparacion.diferencias.diferenciaTC * comparacion.realidad.costoTotalRealUSD;
        }
      }
    }

    return {
      ventas: {
        totalCotizaciones: ventasConExpectativa.length,
        cotizacionesConvertidas: ventasConvertidas.length,
        tasaConversion: ventasConExpectativa.length > 0
          ? (ventasConvertidas.length / ventasConExpectativa.length) * 100
          : 0,
        margenPromedioEsperado,
        margenPromedioReal,
        diferenciaMargenPromedio: margenPromedioReal - margenPromedioEsperado,
        utilidadTotalEsperada,
        utilidadTotalReal,
        cumplimientoUtilidad: utilidadTotalEsperada > 0
          ? (utilidadTotalReal / utilidadTotalEsperada) * 100
          : 0
      },
      compras: {
        totalRequerimientos: reqPeriodo.length,
        requerimientosCompletados: reqCompletados.length,
        tasaCompletado: reqPeriodo.length > 0
          ? (reqCompletados.length / reqPeriodo.length) * 100
          : 0,
        costoTotalEstimado,
        costoTotalReal,
        desviacionPromedio: costoTotalEstimado > 0
          ? ((costoTotalReal - costoTotalEstimado) / costoTotalEstimado) * 100
          : 0,
        requerimientosDentroPresupuesto: reqDentroPresupuesto,
        porcentajeDentroPresupuesto: reqCompletados.length > 0
          ? (reqDentroPresupuesto / reqCompletados.length) * 100
          : 0
      },
      impactoTC: {
        ventasAfectadasPorTC,
        impactoTotalTCVentas,
        comprasAfectadasPorTC,
        impactoTotalTCCompras,
        impactoNetoTC: impactoTotalTCVentas - impactoTotalTCCompras
      }
    };
  },

  /**
   * Generar reporte de expectativa vs realidad
   */
  async generarReporte(mes: number, anio: number): Promise<ReporteExpectativaVsRealidad> {
    const stats = await this.getStats(mes, anio);

    // Obtener comparaciones detalladas de ventas
    const ventas = await VentaService.getAll();
    const ventasPeriodo = ventas.filter(v => {
      const fecha = v.fechaCreacion.toDate();
      return fecha.getMonth() + 1 === mes &&
             fecha.getFullYear() === anio &&
             v.expectativaCotizacion &&
             v.estado !== 'cotizacion';
    });

    const comparacionesVentas: ComparacionVenta[] = [];
    for (const venta of ventasPeriodo) {
      const comp = await this.compararVenta(venta.id);
      if (comp) {
        comparacionesVentas.push(comp);
      }
    }

    // Obtener comparaciones detalladas de compras
    const requerimientos = await this.getRequerimientos({ estado: 'completado' });
    const reqPeriodo = requerimientos.filter(r => {
      const fecha = r.fechaCreacion.toDate();
      return fecha.getMonth() + 1 === mes && fecha.getFullYear() === anio;
    });

    const comparacionesCompras: ComparacionCompra[] = [];
    for (const req of reqPeriodo) {
      if (req.ordenCompraId) {
        const comp = await this.compararCompra(req.ordenCompraId);
        if (comp) {
          comparacionesCompras.push(comp);
        }
      }
    }

    // Calcular TC promedio
    const tcEsperadoVentas = comparacionesVentas.length > 0
      ? comparacionesVentas.reduce((sum, c) => sum + c.expectativa.tcCotizacion, 0) / comparacionesVentas.length
      : 0;
    const tcRealVentas = comparacionesVentas.length > 0
      ? comparacionesVentas.reduce((sum, c) => sum + c.realidad.tcVenta, 0) / comparacionesVentas.length
      : 0;

    // Generar insights
    const insights: Array<{ tipo: 'positivo' | 'negativo' | 'neutral'; mensaje: string; impacto?: number }> = [];

    if (stats.ventas.cumplimientoUtilidad >= 100) {
      insights.push({
        tipo: 'positivo',
        mensaje: `Las ventas superaron la expectativa de utilidad en ${(stats.ventas.cumplimientoUtilidad - 100).toFixed(1)}%`,
        impacto: stats.ventas.utilidadTotalReal - stats.ventas.utilidadTotalEsperada
      });
    } else if (stats.ventas.cumplimientoUtilidad < 90) {
      insights.push({
        tipo: 'negativo',
        mensaje: `Las ventas no alcanzaron la expectativa de utilidad (${stats.ventas.cumplimientoUtilidad.toFixed(1)}% del objetivo)`,
        impacto: stats.ventas.utilidadTotalReal - stats.ventas.utilidadTotalEsperada
      });
    }

    if (stats.compras.porcentajeDentroPresupuesto < 80) {
      insights.push({
        tipo: 'negativo',
        mensaje: `Solo ${stats.compras.porcentajeDentroPresupuesto.toFixed(0)}% de las compras estuvieron dentro del presupuesto`,
        impacto: stats.compras.costoTotalReal - stats.compras.costoTotalEstimado
      });
    }

    return {
      mes,
      anio,
      ventas: {
        cantidad: comparacionesVentas.length,
        utilidadEsperadaTotal: stats.ventas.utilidadTotalEsperada,
        utilidadRealTotal: stats.ventas.utilidadTotalReal,
        diferencia: stats.ventas.utilidadTotalReal - stats.ventas.utilidadTotalEsperada,
        cumplimiento: stats.ventas.cumplimientoUtilidad,
        detalle: comparacionesVentas
      },
      compras: {
        cantidad: comparacionesCompras.length,
        costoEstimadoTotal: stats.compras.costoTotalEstimado,
        costoRealTotal: stats.compras.costoTotalReal,
        diferencia: stats.compras.costoTotalReal - stats.compras.costoTotalEstimado,
        desviacion: stats.compras.desviacionPromedio,
        detalle: comparacionesCompras
      },
      impactoTC: {
        tcPromedioEsperado: tcEsperadoVentas,
        tcPromedioReal: tcRealVentas,
        impactoNetoEnPEN: stats.impactoTC.impactoNetoTC
      },
      insights
    };
  },

  // ===============================================
  // VINCULACIÓN RETROACTIVA Y CONSOLIDACIÓN
  // ===============================================

  /**
   * Vincular retroactivamente una OC existente con una cotización
   * Crea requerimiento → lo aprueba → vincula con OC → reserva unidades → completa
   */
  async vincularOCRetroactivamente(params: {
    cotizacionId: string;
    cotizacionNumero: string;
    nombreCliente: string;
    ordenCompraId: string;
    ordenCompraNumero: string;
    productos: Array<{
      productoId: string;
      sku: string;
      marca: string;
      nombreComercial: string;
      cantidadFaltante: number;
      precioEstimadoUSD?: number;
    }>;
    userId: string;
  }): Promise<{ requerimientoId: string; requerimientoNumero: string; unidadesReservadas: number; detalles: Array<{ productoId: string; reservadas: number; faltantes: number }> }> {
    const { cotizacionId, cotizacionNumero, nombreCliente, ordenCompraId, ordenCompraNumero, productos, userId } = params;

    // 1. Buscar requerimiento existente para esta cotización (evitar duplicados)
    let requerimientoId: string;
    let requerimientoNumero: string;
    let reqYaVinculadoAEstaOC = false;

    const reqsExistentes = await this.getRequerimientos();
    // Primero buscar uno sin OC vinculada (pendiente o aprobado)
    let reqExistente = reqsExistentes.find(r =>
      r.ventaRelacionadaId === cotizacionId &&
      r.estado !== 'cancelado' &&
      !r.ordenCompraId
    );

    // Si no hay sin vincular, buscar uno ya vinculado a ESTA misma OC (re-ejecución)
    if (!reqExistente) {
      reqExistente = reqsExistentes.find(r =>
        r.ventaRelacionadaId === cotizacionId &&
        r.estado !== 'cancelado' &&
        r.ordenCompraId === ordenCompraId
      );
      if (reqExistente) reqYaVinculadoAEstaOC = true;
    }

    if (reqExistente) {
      // Reutilizar el requerimiento existente
      requerimientoId = reqExistente.id!;
      requerimientoNumero = reqExistente.numeroRequerimiento;

      // Si estaba pendiente, aprobarlo
      if (reqExistente.estado === 'pendiente') {
        await this.actualizarEstado(requerimientoId, 'aprobado', userId);
      }
    } else {
      // Crear nuevo solo si no existe ninguno para esta cotización
      const created = await this.crearRequerimientoDesdeCotizacion(
        cotizacionId,
        cotizacionNumero,
        nombreCliente,
        productos.map(p => ({
          productoId: p.productoId,
          sku: p.sku,
          marca: p.marca,
          nombreComercial: p.nombreComercial,
          cantidadFaltante: p.cantidadFaltante,
          precioEstimadoUSD: p.precioEstimadoUSD
        })),
        userId
      );
      requerimientoId = created.id;
      requerimientoNumero = created.numero;

      // Aprobar inmediatamente
      await this.actualizarEstado(requerimientoId, 'aprobado', userId);
    }

    // 2. Vincular con la OC (saltar si ya estaba vinculado a esta misma OC)
    if (!reqYaVinculadoAEstaOC) {
      await this.vincularConOC(requerimientoId, ordenCompraId, ordenCompraNumero, userId);
    }

    // 2b. Recalcular expectativa financiera con costos reales de la OC
    try {
      const ordenCompra = await OrdenCompraService.getById(ordenCompraId);
      if (ordenCompra) {
        // Obtener TC actual
        let tcActual = 3.70;
        try {
          const tcDelDia = await tipoCambioService.getTCDelDia();
          if (tcDelDia) tcActual = tcDelDia.venta;
        } catch { /* usar fallback */ }

        // Calcular costos reales basados en la OC
        const costoEstimadoUSD = productos.reduce((sum, p) => {
          const productoOC = ordenCompra.productos.find(po => po.productoId === p.productoId);
          const costoReal = productoOC?.costoUnitario || p.precioEstimadoUSD || 0;
          return sum + costoReal * p.cantidadFaltante;
        }, 0);

        // Sin flete ficticio — el flete se calcula cuando realmente se envía
        const fleteEstimadoUSD = 0;
        const impuestoEstimadoUSD = 0;
        const costoTotalEstimadoUSD = costoEstimadoUSD + impuestoEstimadoUSD + fleteEstimadoUSD;

        await updateDoc(doc(db, REQUERIMIENTOS_COLLECTION, requerimientoId), {
          expectativa: {
            tcInvestigacion: tcActual,
            costoEstimadoUSD,
            costoEstimadoPEN: costoEstimadoUSD * tcActual,
            impuestoEstimadoUSD,
            fleteEstimadoUSD,
            costoTotalEstimadoUSD,
            costoTotalEstimadoPEN: costoTotalEstimadoUSD * tcActual
          }
        });
      }
    } catch (e) {
      console.warn('No se pudo recalcular expectativa con datos de OC:', e);
    }

    // 3. Actualizar la OC con el requerimientoId (solo si no estaba ya vinculado)
    const ORDENES_COLLECTION = 'ordenesCompra';
    const ordenRef = doc(db, ORDENES_COLLECTION, ordenCompraId);

    if (!reqYaVinculadoAEstaOC) {
      const ordenSnap = await getDoc(ordenRef);
      if (ordenSnap.exists()) {
        const ordenData = ordenSnap.data();
        const existingReqIds = ordenData.requerimientoIds || [];
        const existingReqNumeros = ordenData.requerimientoNumeros || [];
        const existingProductosOrigen = ordenData.productosOrigen || [];

        const newProductosOrigen = productos.map(p => ({
          productoId: p.productoId,
          requerimientoId,
          requerimientoNumero,
          cotizacionId,
          clienteNombre: nombreCliente,
          cantidad: p.cantidadFaltante
        }));

        await updateDoc(ordenRef, {
          // Actualizar campo singular (backwards compat) si no existía
          ...(!ordenData.requerimientoId ? { requerimientoId, requerimientoNumero } : {}),
          // Actualizar campos multi-req
          requerimientoIds: [...existingReqIds, requerimientoId],
          requerimientoNumeros: [...existingReqNumeros, requerimientoNumero],
          productosOrigen: [...existingProductosOrigen, ...newProductosOrigen],
          ultimaEdicion: serverTimestamp(),
          editadoPor: userId
        });
      }
    }

    // 4. Reservar unidades existentes
    const reservaResult = await unidadService.reservarUnidadesParaCotizacion({
      ordenCompraId,
      cotizacionId,
      requerimientoId,
      productos: productos.map(p => ({
        productoId: p.productoId,
        cantidad: p.cantidadFaltante
      })),
      userId
    });

    // 5. Marcar requerimiento como completado
    await this.actualizarEstado(requerimientoId, 'completado', userId);

    // 6. Actualizar cotización/venta con el requerimiento generado
    const VENTAS_COLLECTION = 'ventas';
    try {
      const ventaRef = doc(db, VENTAS_COLLECTION, cotizacionId);
      const ventaSnap = await getDoc(ventaRef);
      if (ventaSnap.exists()) {
        const ventaData = ventaSnap.data();
        const existingReqIds = ventaData.requerimientosIds || [];
        const existingReqNumeros = ventaData.requerimientosNumeros || [];

        // Verificar si todas las unidades fueron reservadas (sin faltantes)
        const todasReservadas = reservaResult.detalles.every(d => d.faltantes === 0);

        const updateData: Record<string, any> = {
          requerimientosIds: [...new Set([...existingReqIds, requerimientoId])],
          requerimientosNumeros: [...new Set([...existingReqNumeros, requerimientoNumero])]
        };

        // Si todas las unidades se reservaron, quitar el flag de faltante
        if (todasReservadas && reservaResult.totalReservadas > 0) {
          updateData.requiereStock = false;
          updateData.productosConFaltante = null;
        }

        await updateDoc(ventaRef, updateData);
      }
    } catch (e) {
      console.warn('No se pudo actualizar la venta con requerimientoId:', e);
    }

    return {
      requerimientoId,
      requerimientoNumero,
      unidadesReservadas: reservaResult.totalReservadas,
      detalles: reservaResult.detalles
    };
  },

  /**
   * Consolidar productos de múltiples requerimientos para OC unificada
   * Agrupa por productoId y trackea el origen por cliente/requerimiento
   */
  consolidarProductosRequerimientos(requerimientos: Requerimiento[]): {
    productosConsolidados: Array<{
      productoId: string;
      sku: string;
      marca: string;
      nombreComercial: string;
      cantidadTotal: number;
      precioEstimadoUSD: number;
      origenes: Array<{
        requerimientoId: string;
        requerimientoNumero: string;
        cotizacionId?: string;
        clienteNombre?: string;
        cantidad: number;
      }>;
    }>;
    resumen: { totalProductos: number; totalUnidades: number; clientes: string[] };
  } {
    const productoMap = new Map<string, {
      productoId: string;
      sku: string;
      marca: string;
      nombreComercial: string;
      cantidadTotal: number;
      precioAcumulado: number;
      cantidadParaPrecio: number;
      origenes: Array<{
        requerimientoId: string;
        requerimientoNumero: string;
        cotizacionId?: string;
        clienteNombre?: string;
        cantidad: number;
      }>;
    }>();

    const clientesSet = new Set<string>();

    for (const req of requerimientos) {
      const clienteNombre = req.nombreClienteSolicitante || 'Stock interno';
      clientesSet.add(clienteNombre);

      for (const prod of req.productos) {
        const existing = productoMap.get(prod.productoId);
        const origen = {
          requerimientoId: req.id!,
          requerimientoNumero: req.numeroRequerimiento,
          cotizacionId: req.ventaRelacionadaId,
          clienteNombre,
          cantidad: prod.cantidadSolicitada
        };

        if (existing) {
          existing.cantidadTotal += prod.cantidadSolicitada;
          if (prod.precioEstimadoUSD) {
            existing.precioAcumulado += prod.precioEstimadoUSD * prod.cantidadSolicitada;
            existing.cantidadParaPrecio += prod.cantidadSolicitada;
          }
          existing.origenes.push(origen);
        } else {
          productoMap.set(prod.productoId, {
            productoId: prod.productoId,
            sku: prod.sku || '',
            marca: prod.marca || '',
            nombreComercial: prod.nombreComercial || '',
            cantidadTotal: prod.cantidadSolicitada,
            precioAcumulado: (prod.precioEstimadoUSD || 0) * prod.cantidadSolicitada,
            cantidadParaPrecio: prod.precioEstimadoUSD ? prod.cantidadSolicitada : 0,
            origenes: [origen]
          });
        }
      }
    }

    const productosConsolidados = Array.from(productoMap.values()).map(p => ({
      productoId: p.productoId,
      sku: p.sku,
      marca: p.marca,
      nombreComercial: p.nombreComercial,
      cantidadTotal: p.cantidadTotal,
      precioEstimadoUSD: p.cantidadParaPrecio > 0 ? p.precioAcumulado / p.cantidadParaPrecio : 0,
      origenes: p.origenes
    }));

    return {
      productosConsolidados,
      resumen: {
        totalProductos: productosConsolidados.length,
        totalUnidades: productosConsolidados.reduce((sum, p) => sum + p.cantidadTotal, 0),
        clientes: Array.from(clientesSet)
      }
    };
  },

  /**
   * Limpieza de datos: eliminar requerimientos duplicados y corregir flags de ventas.
   * - Agrupa reqs por ventaRelacionadaId, conserva el más reciente no-cancelado, cancela el resto
   * - Para cada venta con requiereStock=true que ya tiene unidades reservadas, marca requiereStock=false
   */
  async limpiarDatosVinculacion(userId: string): Promise<{
    reqsCancelados: string[];
    ventasCorregidas: string[];
    resumen: string;
  }> {
    const reqsCancelados: string[] = [];
    const ventasCorregidas: string[] = [];

    // 1. Obtener todos los requerimientos
    const allReqs = await this.getRequerimientos();

    // 2. Agrupar por ventaRelacionadaId (cotización)
    const reqsPorCotizacion = new Map<string, typeof allReqs>();
    for (const req of allReqs) {
      if (!req.ventaRelacionadaId || req.estado === 'cancelado') continue;
      const existing = reqsPorCotizacion.get(req.ventaRelacionadaId) || [];
      existing.push(req);
      reqsPorCotizacion.set(req.ventaRelacionadaId, existing);
    }

    // 3. Para cada grupo con duplicados, mantener el que tiene OC vinculada más reciente
    for (const [cotId, reqs] of reqsPorCotizacion) {
      if (reqs.length <= 1) continue;

      // Priorizar: completado con OC > aprobado con OC > aprobado sin OC > pendiente
      const sorted = [...reqs].sort((a, b) => {
        // Primero por tener OC vinculada
        const aHasOC = a.ordenCompraId ? 1 : 0;
        const bHasOC = b.ordenCompraId ? 1 : 0;
        if (aHasOC !== bHasOC) return bHasOC - aHasOC;
        // Luego por estado (completado > aprobado > pendiente)
        const stateOrder: Record<string, number> = { completado: 3, en_proceso: 2, aprobado: 1, pendiente: 0 };
        return (stateOrder[b.estado] || 0) - (stateOrder[a.estado] || 0);
      });

      // Mantener el primero, cancelar el resto
      const keeper = sorted[0];
      for (let i = 1; i < sorted.length; i++) {
        const dup = sorted[i];
        try {
          await this.actualizarEstado(dup.id!, 'cancelado', userId);
          reqsCancelados.push(`${dup.numeroRequerimiento} (${dup.nombreClienteSolicitante || cotId})`);
        } catch (e) {
          console.error(`Error cancelando ${dup.numeroRequerimiento}:`, e);
        }
      }
    }

    // 4. Corregir ventas con requiereStock=true que ya tienen reqs completados con OC
    const ventas = await VentaService.getAll();
    const ventasConFaltante = ventas.filter(v => v.estado === 'confirmada' && v.requiereStock === true);

    for (const venta of ventasConFaltante) {
      // Buscar si tiene un requerimiento completado con OC vinculada
      const reqsDeEstaVenta = allReqs.filter(r =>
        r.ventaRelacionadaId === venta.id &&
        r.estado !== 'cancelado'
      );

      const tieneReqCompletadoConOC = reqsDeEstaVenta.some(r =>
        r.estado === 'completado' && r.ordenCompraId
      );

      if (tieneReqCompletadoConOC) {
        try {
          const ventaRef = doc(db, 'ventas', venta.id);
          await updateDoc(ventaRef, {
            requiereStock: false,
            productosConFaltante: null
          });
          ventasCorregidas.push(`${venta.numeroVenta} (${venta.nombreCliente})`);
        } catch (e) {
          console.error(`Error actualizando venta ${venta.numeroVenta}:`, e);
        }
      }
    }

    const resumen = [
      `Requerimientos duplicados cancelados: ${reqsCancelados.length}`,
      ...reqsCancelados.map(r => `  - ${r}`),
      `Ventas corregidas (requiereStock → false): ${ventasCorregidas.length}`,
      ...ventasCorregidas.map(v => `  - ${v}`)
    ].join('\n');

    return { reqsCancelados, ventasCorregidas, resumen };
  }
};

// Alias para compatibilidad con imports existentes
export const ExpectativaService = expectativaService;
