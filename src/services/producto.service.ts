import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  Producto,
  ProductoFormData,
  InvestigacionMercado,
  InvestigacionFormData,
  InvestigacionResumen,
  HistorialPrecio,
  AlertaInvestigacion,
  PuntoEquilibrio
} from '../types/producto.types';
import * as competidorService from './competidor.service';
import { proveedorService } from './proveedor.service';

const COLLECTION_NAME = 'productos';

export class ProductoService {
  /**
   * Obtener todos los productos
   */
  static async getAll(): Promise<Producto[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('fechaCreacion', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Producto));
    } catch (error: any) {
      console.error('Error al obtener productos:', error);
      throw new Error('Error al cargar productos');
    }
  }

  /**
   * Obtener producto por ID
   */
  static async getById(id: string): Promise<Producto | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as Producto;
      }
      
      return null;
    } catch (error: any) {
      console.error('Error al obtener producto:', error);
      throw new Error('Error al cargar producto');
    }
  }

  /**
   * Crear nuevo producto
   */
  static async create(data: ProductoFormData, userId: string): Promise<Producto> {
    try {
      // Generar SKU automático
      const sku = await this.generateSKU();
      
      const newProducto = {
        sku,
        marca: data.marca,
        nombreComercial: data.nombreComercial,
        presentacion: data.presentacion,
        dosaje: data.dosaje,
        contenido: data.contenido,
        grupo: data.grupo,
        subgrupo: data.subgrupo,
        enlaceProveedor: data.enlaceProveedor,
        codigoUPC: data.codigoUPC || '',
        
        estado: 'activo' as const,
        etiquetas: [],
        
        habilitadoML: data.habilitadoML,
        restriccionML: data.restriccionML || '',
        
        ctruPromedio: 0,
        precioSugerido: data.precioSugerido,
        margenMinimo: data.margenMinimo,
        margenObjetivo: data.margenObjetivo,
        costoFleteUSAPeru: data.costoFleteUSAPeru || 0,

        stockUSA: 0,
        stockPeru: 0,
        stockTransito: 0,
        stockReservado: 0,
        stockDisponible: 0,
        
        stockMinimo: data.stockMinimo,
        stockMaximo: data.stockMaximo,
        
        rotacionPromedio: 0,
        diasParaQuiebre: 0,
        
        esPadre: false,
        
        creadoPor: userId,
        fechaCreacion: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), newProducto);
      
      return {
        id: docRef.id,
        ...newProducto,
        fechaCreacion: Timestamp.now()
      } as Producto;
    } catch (error: any) {
      console.error('Error al crear producto:', error);
      throw new Error('Error al crear producto');
    }
  }

  /**
   * Actualizar producto
   */
  static async update(id: string, data: Partial<ProductoFormData>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      
      await updateDoc(docRef, {
        ...data,
        ultimaEdicion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error al actualizar producto:', error);
      throw new Error('Error al actualizar producto');
    }
  }

  /**
   * Eliminar producto (soft delete)
   */
  static async delete(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      
      await updateDoc(docRef, {
        estado: 'inactivo',
        ultimaEdicion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error al eliminar producto:', error);
      throw new Error('Error al eliminar producto');
    }
  }

  /**
   * Incrementar stock de un producto
   * @param id ID del producto
   * @param cantidad Cantidad a incrementar
   * @param pais 'USA' o 'Peru' o 'transito'
   */
  static async incrementarStock(id: string, cantidad: number, pais: 'USA' | 'Peru' | 'transito'): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData: Record<string, unknown> = {
        ultimaEdicion: serverTimestamp()
      };

      switch (pais) {
        case 'USA':
          updateData.stockUSA = increment(cantidad);
          break;
        case 'Peru':
          updateData.stockPeru = increment(cantidad);
          break;
        case 'transito':
          updateData.stockTransito = increment(cantidad);
          break;
      }

      await updateDoc(docRef, updateData);
    } catch (error: any) {
      console.error('Error al incrementar stock:', error);
      throw new Error('Error al incrementar stock');
    }
  }

  /**
   * Decrementar stock de un producto
   * @param id ID del producto
   * @param cantidad Cantidad a decrementar (positiva)
   * @param pais 'USA' o 'Peru' o 'transito'
   */
  static async decrementarStock(id: string, cantidad: number, pais: 'USA' | 'Peru' | 'transito'): Promise<void> {
    return this.incrementarStock(id, -cantidad, pais);
  }

  /**
   * Generar SKU automático (BMN-0001, BMN-0002, etc.)
   */
  private static async generateSKU(): Promise<string> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));

      // Encontrar el número máximo existente
      let maxNumber = 0;
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const sku = data.sku as string;

        if (sku && sku.startsWith('BMN-')) {
          const match = sku.match(/BMN-(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) {
              maxNumber = num;
            }
          }
        }
      });

      return `BMN-${(maxNumber + 1).toString().padStart(4, '0')}`;
    } catch (error) {
      // Si falla, usar timestamp
      return `BMN-${Date.now().toString().slice(-4)}`;
    }
  }

  /**
   * Obtener el próximo SKU que se generará (para mostrar en UI)
   */
  static async getProximoSKU(): Promise<string> {
    return this.generateSKU();
  }

  /**
   * Buscar productos por texto
   */
  static async search(searchTerm: string): Promise<Producto[]> {
    try {
      const allProducts = await this.getAll();

      const term = searchTerm.toLowerCase();

      return allProducts.filter(p =>
        p.sku.toLowerCase().includes(term) ||
        p.marca.toLowerCase().includes(term) ||
        p.nombreComercial.toLowerCase().includes(term) ||
        p.grupo.toLowerCase().includes(term) ||
        p.subgrupo.toLowerCase().includes(term)
      );
    } catch (error: any) {
      console.error('Error al buscar productos:', error);
      throw new Error('Error al buscar productos');
    }
  }

  // ============================================
  // INVESTIGACIÓN DE MERCADO
  // ============================================

  /**
   * Elimina propiedades con valor undefined de un objeto
   * Firestore no acepta valores undefined
   */
  private static removeUndefined<T extends Record<string, any>>(obj: T): T {
    const cleaned = {} as T;
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        cleaned[key as keyof T] = obj[key];
      }
    }
    return cleaned;
  }

  /**
   * Crear o actualizar investigación de mercado de un producto
   */
  static async guardarInvestigacion(
    productoId: string,
    data: InvestigacionFormData,
    userId: string,
    tipoCambio: number = 3.70
  ): Promise<InvestigacionMercado> {
    try {
      const producto = await this.getById(productoId);
      if (!producto) {
        throw new Error('Producto no encontrado');
      }

      // Convertir proveedores al formato con Timestamp (limpiando undefined)
      const proveedoresUSA = (data.proveedoresUSA || []).map(p => this.removeUndefined({
        id: p.id,
        nombre: p.nombre || '',
        precio: p.precio || 0,
        impuesto: p.impuesto || 0,  // Sales tax del estado USA (%)
        url: p.url || null,
        disponibilidad: p.disponibilidad || 'desconocido',
        envioEstimado: p.envioEstimado || null,
        notas: p.notas || null,
        fechaConsulta: Timestamp.now()
      }));

      // Convertir competidores al formato con Timestamp (limpiando undefined)
      const competidoresPeru = (data.competidoresPeru || []).map(c => this.removeUndefined({
        id: c.id,
        competidorId: c.competidorId || null,  // Vínculo con Gestor Maestro
        nombre: c.nombre || '',
        plataforma: c.plataforma || 'mercado_libre',
        precio: c.precio || 0,
        url: c.url || null,
        ventas: c.ventas || null,
        reputacion: c.reputacion || 'desconocida',
        esLiderCategoria: c.esLiderCategoria || false,
        notas: c.notas || null,
        fechaConsulta: Timestamp.now()
      }));

      // Calcular precios desde proveedores
      const preciosUSA = proveedoresUSA.map(p => p.precio).filter(p => p > 0);
      const precioUSAMin = preciosUSA.length > 0 ? Math.min(...preciosUSA) : (data.precioUSAMin || 0);
      const precioUSAMax = preciosUSA.length > 0 ? Math.max(...preciosUSA) : (data.precioUSAMax || 0);
      const precioUSAPromedio = preciosUSA.length > 0
        ? preciosUSA.reduce((a, b) => a + b, 0) / preciosUSA.length
        : (data.precioUSAPromedio || 0);

      // Encontrar mejor proveedor
      const mejorProveedor = proveedoresUSA.find(p => p.precio === precioUSAMin && p.precio > 0);

      // Calcular precios desde competidores
      const preciosPeru = competidoresPeru.map(c => c.precio).filter(p => p > 0);
      const precioPERUMin = preciosPeru.length > 0 ? Math.min(...preciosPeru) : (data.precioPERUMin || 0);
      const precioPERUMax = preciosPeru.length > 0 ? Math.max(...preciosPeru) : (data.precioPERUMax || 0);
      const precioPERUPromedio = preciosPeru.length > 0
        ? preciosPeru.reduce((a, b) => a + b, 0) / preciosPeru.length
        : (data.precioPERUPromedio || 0);

      // Encontrar competidor principal (el de más ventas o marcado como líder)
      const competidorPrincipal = competidoresPeru.find(c => c.esLiderCategoria) ||
        competidoresPeru.sort((a, b) => (b.ventas || 0) - (a.ventas || 0))[0];

      // Calcular estimaciones con el mejor precio USA
      const logisticaEstimada = data.logisticaEstimada || 5;
      const mejorPrecioUSA = precioUSAMin > 0 ? precioUSAMin : precioUSAPromedio;
      const costoTotalUSD = mejorPrecioUSA + logisticaEstimada;
      const ctruEstimado = costoTotalUSD * tipoCambio;

      // Calcular precio sugerido con margen objetivo
      const margenObjetivo = producto.margenObjetivo || 30;
      const precioSugeridoCalculado = ctruEstimado > 0
        ? ctruEstimado / (1 - margenObjetivo / 100)
        : 0;

      // Calcular margen estimado basado en precio Perú promedio
      const margenEstimado = precioPERUPromedio > 0 && ctruEstimado > 0
        ? ((precioPERUPromedio - ctruEstimado) / precioPERUPromedio) * 100
        : 0;

      // Precio de entrada competitivo (5% menos que el más bajo)
      const precioEntrada = precioPERUMin > 0 ? precioPERUMin * 0.95 : precioSugeridoCalculado;

      // Detectar presencia en ML
      const presenciaML = data.presenciaML || competidoresPeru.some(c => c.plataforma === 'mercado_libre');
      const numeroCompetidores = competidoresPeru.length;

      // Calcular puntuación de viabilidad
      let puntuacionViabilidad = 0;
      if (margenEstimado >= 30) puntuacionViabilidad += 30;
      else if (margenEstimado >= 20) puntuacionViabilidad += 20;
      else if (margenEstimado >= 15) puntuacionViabilidad += 10;

      if (data.demandaEstimada === 'alta') puntuacionViabilidad += 25;
      else if (data.demandaEstimada === 'media') puntuacionViabilidad += 15;
      else puntuacionViabilidad += 5;

      if (data.tendencia === 'subiendo') puntuacionViabilidad += 20;
      else if (data.tendencia === 'estable') puntuacionViabilidad += 10;

      if (data.nivelCompetencia === 'baja') puntuacionViabilidad += 25;
      else if (data.nivelCompetencia === 'media') puntuacionViabilidad += 15;
      else if (data.nivelCompetencia === 'alta') puntuacionViabilidad += 5;

      // Fechas de vigencia (+60 días)
      const ahora = new Date();
      const vigenciaHasta = new Date(ahora);
      vigenciaHasta.setDate(vigenciaHasta.getDate() + 60);

      // === HISTORIAL DE PRECIOS ===
      // Obtener historial existente o crear uno nuevo
      const historialExistente = producto.investigacion?.historialPrecios || [];

      // Crear nuevo registro de historial
      const nuevoRegistroHistorial: HistorialPrecio = {
        fecha: Timestamp.now(),
        precioUSAPromedio,
        precioUSAMin,
        precioPERUPromedio,
        precioPERUMin,
        margenEstimado,
        tipoCambio
      };

      // Agregar al historial (mantener máximo 20 registros)
      const historialPrecios = [...historialExistente, nuevoRegistroHistorial].slice(-20);

      // === ALERTAS AUTOMÁTICAS ===
      const alertasExistentes = producto.investigacion?.alertas || [];
      const nuevasAlertas: AlertaInvestigacion[] = [];

      // Alerta: Margen bajo
      if (margenEstimado > 0 && margenEstimado < 15) {
        nuevasAlertas.push({
          id: `alerta-margen-${Date.now()}`,
          tipo: 'margen_bajo',
          mensaje: `Margen estimado muy bajo (${margenEstimado.toFixed(1)}%). Revisar viabilidad del producto.`,
          severidad: margenEstimado < 10 ? 'danger' : 'warning',
          fecha: Timestamp.now(),
          leida: false,
          datos: { margenEstimado }
        });
      }

      // Alerta: Precio de competidor más bajo que nuestro costo
      if (precioPERUMin > 0 && ctruEstimado > 0 && precioPERUMin < ctruEstimado) {
        nuevasAlertas.push({
          id: `alerta-precio-${Date.now()}`,
          tipo: 'precio_competidor',
          mensaje: `El precio más bajo del mercado (S/${precioPERUMin.toFixed(2)}) es menor que tu CTRU estimado (S/${ctruEstimado.toFixed(2)}).`,
          severidad: 'danger',
          fecha: Timestamp.now(),
          leida: false,
          datos: { precioPERUMin, ctruEstimado }
        });
      }

      // Alerta: Sin stock en proveedores USA
      const proveedoresSinStock = proveedoresUSA.filter(p => p.disponibilidad === 'sin_stock');
      if (proveedoresSinStock.length > 0 && proveedoresSinStock.length === proveedoresUSA.length) {
        nuevasAlertas.push({
          id: `alerta-stock-${Date.now()}`,
          tipo: 'sin_stock',
          mensaje: `Ningún proveedor USA tiene stock disponible.`,
          severidad: 'warning',
          fecha: Timestamp.now(),
          leida: false,
          datos: { proveedoresSinStock: proveedoresSinStock.map(p => p.nombre) }
        });
      }

      // Combinar alertas (mantener las no leídas antiguas + nuevas)
      const alertasNoLeidas = alertasExistentes.filter(a => !a.leida);
      const alertas = [...alertasNoLeidas, ...nuevasAlertas].slice(-10);

      // Construir objeto de investigación limpiando valores undefined
      const investigacion = this.removeUndefined({
        id: `INV-${productoId}-${Date.now()}`,
        productoId,

        // Proveedores USA
        proveedoresUSA,
        precioUSAMin,
        precioUSAMax,
        precioUSAPromedio,
        proveedorRecomendado: mejorProveedor?.id || null,

        // Competidores Perú
        competidoresPeru,
        precioPERUMin,
        precioPERUMax,
        precioPERUPromedio,
        competidorPrincipal: competidorPrincipal?.id || null,

        // Análisis de competencia
        presenciaML,
        numeroCompetidores,
        nivelCompetencia: data.nivelCompetencia,
        ventajasCompetitivas: data.ventajasCompetitivas || null,

        // Estimaciones calculadas
        ctruEstimado,
        logisticaEstimada,
        precioSugeridoCalculado,
        margenEstimado,
        precioEntrada,

        // Demanda
        demandaEstimada: data.demandaEstimada,
        tendencia: data.tendencia,
        volumenMercadoEstimado: data.volumenMercadoEstimado || null,

        // Recomendación
        recomendacion: data.recomendacion,
        razonamiento: data.razonamiento || null,
        puntuacionViabilidad: Math.min(100, puntuacionViabilidad),

        // Vigencia
        fechaInvestigacion: Timestamp.now(),
        vigenciaHasta: Timestamp.fromDate(vigenciaHasta),
        estaVigente: true,

        // Notas
        notas: data.notas || null,

        // Historial y Alertas
        historialPrecios,
        alertas,

        // Auditoría
        realizadoPor: userId,
        fechaCreacion: producto.investigacion?.fechaCreacion || Timestamp.now(),
        ultimaActualizacion: Timestamp.now()
      }) as InvestigacionMercado;

      // Actualizar el producto con la investigación
      const docRef = doc(db, COLLECTION_NAME, productoId);
      await updateDoc(docRef, {
        investigacion,
        // Actualizar precio sugerido si no tiene uno
        ...(producto.precioSugerido === 0 && { precioSugerido: precioSugeridoCalculado }),
        ultimaEdicion: serverTimestamp()
      });

      // === ACTUALIZAR MÉTRICAS DE COMPETIDORES EN GESTOR MAESTRO ===
      // Obtener competidorIds que ya existían en la investigación anterior
      const competidorIdsAnteriores = new Set(
        (producto.investigacion?.competidoresPeru || [])
          .map((c: any) => c.competidorId)
          .filter(Boolean)
      );

      // Agrupar precios por competidorId para calcular promedio
      const metricasPorCompetidor = new Map<string, { precios: number[]; esNuevo: boolean }>();

      for (const comp of competidoresPeru) {
        if (comp.competidorId) {
          const existing = metricasPorCompetidor.get(comp.competidorId) || {
            precios: [],
            esNuevo: !competidorIdsAnteriores.has(comp.competidorId)
          };
          if (comp.precio > 0) {
            existing.precios.push(comp.precio);
          }
          metricasPorCompetidor.set(comp.competidorId, existing);
        }
      }

      // Actualizar métricas de cada competidor vinculado
      for (const [competidorId, metricas] of metricasPorCompetidor) {
        try {
          const precioPromedio = metricas.precios.length > 0
            ? metricas.precios.reduce((a, b) => a + b, 0) / metricas.precios.length
            : 0;

          // Solo incrementar contador si es un vínculo NUEVO (no existía antes)
          if (metricas.esNuevo) {
            const competidorActual = await competidorService.getById(competidorId);
            const productosActuales = competidorActual?.metricas?.productosAnalizados || 0;

            await competidorService.actualizarMetricas(competidorId, {
              productosAnalizados: productosActuales + 1,
              precioPromedio
            });
          } else {
            // Solo actualizar precio promedio, sin incrementar contador
            await competidorService.actualizarMetricas(competidorId, {
              precioPromedio
            });
          }
        } catch (error) {
          console.warn(`No se pudo actualizar métricas del competidor ${competidorId}:`, error);
        }
      }

      // === ACTUALIZAR MÉTRICAS DE PROVEEDORES EN GESTOR MAESTRO ===
      // Obtener proveedorIds que ya existían en la investigación anterior
      const proveedorIdsAnteriores = new Set(
        (producto.investigacion?.proveedoresUSA || [])
          .map((p: any) => p.proveedorId)
          .filter(Boolean)
      );

      // Agrupar precios por proveedorId para calcular promedio
      const metricasPorProveedor = new Map<string, { precios: number[]; esNuevo: boolean }>();

      for (const prov of proveedoresUSA) {
        if (prov.proveedorId) {
          const existing = metricasPorProveedor.get(prov.proveedorId) || {
            precios: [],
            esNuevo: !proveedorIdsAnteriores.has(prov.proveedorId)
          };
          if (prov.precio > 0) {
            existing.precios.push(prov.precio);
          }
          metricasPorProveedor.set(prov.proveedorId, existing);
        }
      }

      // Actualizar métricas de cada proveedor vinculado
      for (const [proveedorId, metricas] of metricasPorProveedor) {
        try {
          const precioPromedio = metricas.precios.length > 0
            ? metricas.precios.reduce((a, b) => a + b, 0) / metricas.precios.length
            : 0;

          // Solo incrementar contador si es un vínculo NUEVO (no existía antes)
          if (metricas.esNuevo) {
            const proveedorActual = await proveedorService.getById(proveedorId);
            const productosActuales = proveedorActual?.metricas?.productosAnalizados || 0;

            await proveedorService.actualizarMetricasInvestigacion(proveedorId, {
              productosAnalizados: productosActuales + 1,
              precioPromedio
            });
          } else {
            // Solo actualizar precio promedio, sin incrementar contador
            await proveedorService.actualizarMetricasInvestigacion(proveedorId, {
              precioPromedio
            });
          }
        } catch (error) {
          console.warn(`No se pudo actualizar métricas del proveedor ${proveedorId}:`, error);
        }
      }

      return investigacion;
    } catch (error: any) {
      console.error('Error al guardar investigación:', error);
      throw new Error(`Error al guardar investigación: ${error.message}`);
    }
  }

  /**
   * Obtener resumen de investigación de un producto
   */
  static getResumenInvestigacion(producto: Producto): InvestigacionResumen {
    if (!producto.investigacion) {
      return {
        tieneInvestigacion: false,
        estaVigente: false
      };
    }

    const inv = producto.investigacion;
    const ahora = new Date();
    const vigenciaHasta = inv.vigenciaHasta?.toDate?.() || new Date();
    const estaVigente = vigenciaHasta > ahora;
    const diasRestantes = Math.ceil((vigenciaHasta.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));

    // Calcular alertas no leídas
    const alertasActivas = (inv.alertas || []).filter(a => !a.leida).length;

    // Calcular tendencia de precios basada en historial
    let tendenciaPrecio: 'subiendo' | 'bajando' | 'estable' | undefined;
    if (inv.historialPrecios && inv.historialPrecios.length >= 2) {
      const ultimos = inv.historialPrecios.slice(-3);
      const primero = ultimos[0].margenEstimado;
      const ultimo = ultimos[ultimos.length - 1].margenEstimado;
      const diferencia = ultimo - primero;

      if (diferencia > 2) tendenciaPrecio = 'subiendo';
      else if (diferencia < -2) tendenciaPrecio = 'bajando';
      else tendenciaPrecio = 'estable';
    }

    return {
      tieneInvestigacion: true,
      estaVigente,
      diasRestantes: estaVigente ? diasRestantes : 0,
      precioUSAPromedio: inv.precioUSAPromedio,
      precioPERUPromedio: inv.precioPERUPromedio,
      margenEstimado: inv.margenEstimado,
      recomendacion: inv.recomendacion,
      fechaInvestigacion: inv.fechaInvestigacion?.toDate?.(),
      alertasActivas,
      tendenciaPrecio
    };
  }

  /**
   * Calcular punto de equilibrio de inversión
   *
   * Métricas clave:
   * - Recuperación de Capital: ¿Cuántas unidades vender para que los INGRESOS cubran la INVERSIÓN?
   *   Formula: unidades = inversión / precioVenta
   *   Ejemplo: S/1775 inversión / S/140 precio = 12.68 ≈ 13 unidades
   *
   * - ROI 100%: ¿Cuántas unidades vender para que la GANANCIA ACUMULADA = INVERSIÓN?
   *   Formula: unidades = inversión / gananciaUnitaria
   *   Ejemplo: S/1775 inversión / S/66 ganancia = 26.9 unidades (pero limitado a unidades compradas)
   */
  static calcularPuntoEquilibrio(
    ctruEstimado: number,
    precioVenta: number,
    inversionInicial: number = 500,
    ventasMensualesEstimadas: number = 20,
    unidadesCompradas?: number
  ): PuntoEquilibrio {
    const gananciaUnitaria = precioVenta - ctruEstimado;

    // Calcular unidades compradas si no se proporciona
    const unidadesTotales = unidadesCompradas ?? (ctruEstimado > 0
      ? Math.round(inversionInicial / ctruEstimado)
      : 0);

    // Si no hay ganancia, retornar valores de advertencia
    if (gananciaUnitaria <= 0 || precioVenta <= 0) {
      return {
        unidadesParaRecuperarCapital: Infinity,
        unidadesParaROI100: Infinity,
        inversionTotal: inversionInicial,
        gananciaUnitaria: gananciaUnitaria,
        tiempoRecuperacionCapital: Infinity,
        tiempoROI100: Infinity,
        rentabilidadMensual: 0,
        gananciaTotalPotencial: unidadesTotales * gananciaUnitaria,
        roiTotalPotencial: 0,
        // Deprecados - mantener para compatibilidad
        unidadesNecesarias: Infinity,
        tiempoRecuperacion: Infinity
      };
    }

    // RECUPERACIÓN DE CAPITAL: ¿Cuándo los ingresos cubren la inversión?
    // ingresos = n × precioVenta >= inversión
    // n = inversión / precioVenta
    const unidadesParaRecuperarCapital = Math.ceil(inversionInicial / precioVenta);

    // ROI 100%: ¿Cuándo la ganancia acumulada = inversión?
    // gananciaAcumulada = n × gananciaUnitaria >= inversión
    // n = inversión / gananciaUnitaria
    const unidadesParaROI100Raw = Math.ceil(inversionInicial / gananciaUnitaria);
    // Limitar a unidades disponibles (no puedes vender más de lo que compraste)
    const unidadesParaROI100 = Math.min(unidadesParaROI100Raw, unidadesTotales);

    // Tiempos de recuperación
    const tiempoRecuperacionCapital = ventasMensualesEstimadas > 0
      ? unidadesParaRecuperarCapital / ventasMensualesEstimadas
      : Infinity;

    const tiempoROI100 = ventasMensualesEstimadas > 0
      ? unidadesParaROI100Raw / ventasMensualesEstimadas
      : Infinity;

    // Rentabilidad mensual estimada
    const gananciaMensual = ventasMensualesEstimadas * gananciaUnitaria;
    const rentabilidadMensual = inversionInicial > 0
      ? (gananciaMensual / inversionInicial) * 100
      : 0;

    // Ganancia total potencial si se vende todo el inventario
    const gananciaTotalPotencial = unidadesTotales * gananciaUnitaria;
    const roiTotalPotencial = inversionInicial > 0
      ? (gananciaTotalPotencial / inversionInicial) * 100
      : 0;

    return {
      unidadesParaRecuperarCapital,
      unidadesParaROI100,
      inversionTotal: inversionInicial,
      gananciaUnitaria,
      tiempoRecuperacionCapital: Math.round(tiempoRecuperacionCapital * 10) / 10,
      tiempoROI100: Math.round(tiempoROI100 * 10) / 10,
      rentabilidadMensual: Math.round(rentabilidadMensual * 10) / 10,
      gananciaTotalPotencial: Math.round(gananciaTotalPotencial * 100) / 100,
      roiTotalPotencial: Math.round(roiTotalPotencial * 10) / 10,
      // Deprecados - mantener para compatibilidad
      unidadesNecesarias: unidadesParaRecuperarCapital,
      tiempoRecuperacion: Math.round(tiempoRecuperacionCapital * 10) / 10
    };
  }

  /**
   * Marcar alertas como leídas
   */
  static async marcarAlertasLeidas(productoId: string, alertaIds?: string[]): Promise<void> {
    try {
      const producto = await this.getById(productoId);
      if (!producto?.investigacion?.alertas) return;

      const alertasActualizadas = producto.investigacion.alertas.map(a => {
        if (!alertaIds || alertaIds.includes(a.id)) {
          return { ...a, leida: true };
        }
        return a;
      });

      const docRef = doc(db, COLLECTION_NAME, productoId);
      await updateDoc(docRef, {
        'investigacion.alertas': alertasActualizadas
      });
    } catch (error: any) {
      console.error('Error al marcar alertas como leídas:', error);
    }
  }

  /**
   * Eliminar investigación de un producto
   */
  static async eliminarInvestigacion(productoId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, productoId);
      await updateDoc(docRef, {
        investigacion: null,
        ultimaEdicion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error al eliminar investigación:', error);
      throw new Error('Error al eliminar investigación');
    }
  }

  /**
   * Verificar y actualizar vigencia de investigaciones
   * (Puede llamarse periódicamente o al cargar productos)
   */
  static async actualizarVigenciaInvestigaciones(): Promise<number> {
    try {
      const productos = await this.getAll();
      let actualizados = 0;
      const ahora = new Date();

      for (const producto of productos) {
        if (producto.investigacion) {
          const vigenciaHasta = producto.investigacion.vigenciaHasta?.toDate?.();
          const estaVigente = vigenciaHasta && vigenciaHasta > ahora;

          if (producto.investigacion.estaVigente !== estaVigente) {
            const docRef = doc(db, COLLECTION_NAME, producto.id);
            await updateDoc(docRef, {
              'investigacion.estaVigente': estaVigente
            });
            actualizados++;
          }
        }
      }

      return actualizados;
    } catch (error: any) {
      console.error('Error al actualizar vigencias:', error);
      return 0;
    }
  }

  /**
   * Obtener productos con investigación vencida
   */
  static async getProductosInvestigacionVencida(): Promise<Producto[]> {
    try {
      const productos = await this.getAll();
      const ahora = new Date();

      return productos.filter(p => {
        if (!p.investigacion) return false;
        const vigenciaHasta = p.investigacion.vigenciaHasta?.toDate?.();
        return vigenciaHasta && vigenciaHasta <= ahora;
      });
    } catch (error: any) {
      console.error('Error al obtener productos con investigación vencida:', error);
      return [];
    }
  }

  /**
   * Obtener productos sin investigación
   */
  static async getProductosSinInvestigacion(): Promise<Producto[]> {
    try {
      const productos = await this.getAll();
      return productos.filter(p => !p.investigacion);
    } catch (error: any) {
      console.error('Error al obtener productos sin investigación:', error);
      return [];
    }
  }

  /**
   * Obtener valores únicos de un campo específico
   * Útil para autocompletado de campos como marca, grupo, subgrupo, etc.
   */
  static async getUniqueValues(field: 'marca' | 'nombreComercial' | 'grupo' | 'subgrupo' | 'presentacion' | 'dosaje' | 'contenido'): Promise<string[]> {
    try {
      const allProducts = await this.getAll();

      const values = new Set<string>();

      allProducts.forEach(p => {
        const value = p[field];
        if (value && typeof value === 'string' && value.trim()) {
          values.add(value.trim());
        }
      });

      return Array.from(values).sort((a, b) => a.localeCompare(b, 'es'));
    } catch (error: any) {
      console.error(`Error al obtener valores únicos de ${field}:`, error);
      return [];
    }
  }

  /**
   * Obtener nombres únicos de proveedores USA y competidores Perú
   * de las investigaciones existentes para autocompletado inteligente
   */
  static async getUniqueInvestigacionValues(): Promise<{
    proveedoresUSA: string[];
    competidoresPeru: string[];
    plataformas: string[];
  }> {
    try {
      const allProducts = await this.getAll();

      const proveedoresUSA = new Set<string>();
      const competidoresPeru = new Set<string>();
      const plataformas = new Set<string>();

      allProducts.forEach(p => {
        if (p.investigacion) {
          // Extraer nombres de proveedores USA
          p.investigacion.proveedoresUSA?.forEach(prov => {
            if (prov.nombre?.trim()) {
              proveedoresUSA.add(prov.nombre.trim());
            }
          });

          // Extraer nombres de competidores Perú
          p.investigacion.competidoresPeru?.forEach(comp => {
            if (comp.nombre?.trim()) {
              competidoresPeru.add(comp.nombre.trim());
            }
            if (comp.plataforma?.trim()) {
              plataformas.add(comp.plataforma.trim());
            }
          });
        }
      });

      const sortFn = (a: string, b: string) => a.localeCompare(b, 'es');

      return {
        proveedoresUSA: Array.from(proveedoresUSA).sort(sortFn),
        competidoresPeru: Array.from(competidoresPeru).sort(sortFn),
        plataformas: Array.from(plataformas).sort(sortFn),
      };
    } catch (error: any) {
      console.error('Error al obtener valores únicos de investigación:', error);
      return {
        proveedoresUSA: [],
        competidoresPeru: [],
        plataformas: [],
      };
    }
  }

  /**
   * Obtener todos los valores únicos para autocompletado
   * Devuelve un objeto con todos los campos relevantes
   */
  static async getAllUniqueValues(): Promise<{
    marcas: string[];
    nombresComerciales: string[];
    grupos: string[];
    subgrupos: string[];
    presentaciones: string[];
    dosajes: string[];
    contenidos: string[];
  }> {
    try {
      const allProducts = await this.getAll();

      const marcas = new Set<string>();
      const nombresComerciales = new Set<string>();
      const grupos = new Set<string>();
      const subgrupos = new Set<string>();
      const presentaciones = new Set<string>();
      const dosajes = new Set<string>();
      const contenidos = new Set<string>();

      allProducts.forEach(p => {
        if (p.marca?.trim()) marcas.add(p.marca.trim());
        if (p.nombreComercial?.trim()) nombresComerciales.add(p.nombreComercial.trim());
        if (p.grupo?.trim()) grupos.add(p.grupo.trim());
        if (p.subgrupo?.trim()) subgrupos.add(p.subgrupo.trim());
        if (p.presentacion?.trim()) presentaciones.add(p.presentacion.trim());
        if (p.dosaje?.trim()) dosajes.add(p.dosaje.trim());
        if (p.contenido?.trim()) contenidos.add(p.contenido.trim());
      });

      const sortFn = (a: string, b: string) => a.localeCompare(b, 'es');

      return {
        marcas: Array.from(marcas).sort(sortFn),
        nombresComerciales: Array.from(nombresComerciales).sort(sortFn),
        grupos: Array.from(grupos).sort(sortFn),
        subgrupos: Array.from(subgrupos).sort(sortFn),
        presentaciones: Array.from(presentaciones).sort(sortFn),
        dosajes: Array.from(dosajes).sort(sortFn),
        contenidos: Array.from(contenidos).sort(sortFn),
      };
    } catch (error: any) {
      console.error('Error al obtener valores únicos:', error);
      return {
        marcas: [],
        nombresComerciales: [],
        grupos: [],
        subgrupos: [],
        presentaciones: [],
        dosajes: [],
        contenidos: [],
      };
    }
  }
}