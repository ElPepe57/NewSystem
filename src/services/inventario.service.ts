import { Timestamp, collection, getDocs, doc, getDoc, updateDoc, writeBatch, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { unidadService } from './unidad.service';
import { ProductoService } from './producto.service';
import { transferenciaService } from './transferencia.service';
import type {
  InventarioProducto,
  InventarioPorPais,
  InventarioResumen,
  InventarioFiltros,
  InventarioStats
} from '../types/inventario.types';
import type { Unidad } from '../types/unidad.types';
import type { Producto } from '../types/producto.types';

export const inventarioService = {
  /**
   * Obtener inventario agregado por producto y almacén
   * Consolida todas las unidades en una vista agregada
   */
  async getInventarioAgregado(filtros?: InventarioFiltros): Promise<InventarioProducto[]> {
    // Obtener todas las unidades
    const unidades = filtros
      ? await unidadService.buscar(filtros)
      : await unidadService.getAll();

    // Obtener todos los productos para metadata adicional
    const productos = await ProductoService.getAll();
    const productosMap = new Map(productos.map(p => [p.id, p]));

    // Agrupar unidades por productoId-almacenId
    const agrupaciones = new Map<string, Unidad[]>();

    unidades.forEach(unidad => {
      const key = `${unidad.productoId}-${unidad.almacenId}`;
      if (!agrupaciones.has(key)) {
        agrupaciones.set(key, []);
      }
      agrupaciones.get(key)!.push(unidad);
    });

    // Crear inventario agregado
    const inventario: InventarioProducto[] = [];
    const ahora = new Date();
    const en30Dias = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);
    const en90Dias = new Date(ahora.getTime() + 90 * 24 * 60 * 60 * 1000);

    agrupaciones.forEach((unidadesGrupo, key) => {
      const primeraUnidad = unidadesGrupo[0];
      const producto = productosMap.get(primeraUnidad.productoId);

      if (!producto) return; // Skip si no hay producto

      // Contar por estados (usando los estados correctos del flujo USA → Perú)
      // Disponibles: recibida_usa (en USA) o disponible_peru (en Perú)
      const disponibles = unidadesGrupo.filter(u =>
        u.estado === 'recibida_usa' || u.estado === 'disponible_peru'
      );
      // En tránsito: entre almacenes USA o de USA a Perú
      const enTransito = unidadesGrupo.filter(u =>
        u.estado === 'en_transito_usa' || u.estado === 'en_transito_peru'
      ).length;
      const reservadas = unidadesGrupo.filter(u => u.estado === 'reservada').length;
      const vendidas = unidadesGrupo.filter(u => u.estado === 'vendida').length;
      const vencidas = unidadesGrupo.filter(u => u.estado === 'vencida').length;
      const danadas = unidadesGrupo.filter(u => u.estado === 'danada').length;

      // Calcular valores financieros (costo de compra + flete)
      // Incluir TODAS las unidades activas (disponibles + reservadas + en tránsito)
      // ya que representan el valor real del inventario
      const unidadesActivas = unidadesGrupo.filter(u =>
        u.estado === 'recibida_usa' ||
        u.estado === 'disponible_peru' ||
        u.estado === 'reservada' ||
        u.estado === 'en_transito_usa' ||
        u.estado === 'en_transito_peru'
      );
      const valorTotal = unidadesActivas.reduce((sum, u) => {
        const costoFlete = (u as any).costoFleteUSD || 0;
        return sum + u.costoUnitarioUSD + costoFlete;
      }, 0);
      const costoPromedio = unidadesActivas.length > 0 ? valorTotal / unidadesActivas.length : 0;

      // Calcular vencimientos
      const proximasVencer30 = disponibles.filter(u =>
        u.fechaVencimiento.toDate() <= en30Dias &&
        u.fechaVencimiento.toDate() > ahora
      ).length;

      const proximasVencer90 = disponibles.filter(u =>
        u.fechaVencimiento.toDate() <= en90Dias &&
        u.fechaVencimiento.toDate() > ahora
      ).length;

      // Calcular promedio de días hasta vencimiento
      const diasVencimiento = disponibles.map(u => {
        const diff = u.fechaVencimiento.toDate().getTime() - ahora.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
      });
      const diasPromedio = diasVencimiento.length > 0
        ? diasVencimiento.reduce((a, b) => a + b, 0) / diasVencimiento.length
        : 0;

      // Determinar si hay stock crítico
      const stockCritico = producto.stockMinimo
        ? disponibles.length <= producto.stockMinimo
        : false;

      inventario.push({
        id: key,
        productoId: primeraUnidad.productoId,
        productoSKU: primeraUnidad.productoSKU,
        productoNombre: primeraUnidad.productoNombre,
        productoMarca: producto.marca,
        productoGrupo: producto.grupo,
        productoSubgrupo: producto.subgrupo || '',
        almacenId: primeraUnidad.almacenId,
        almacenNombre: primeraUnidad.almacenNombre,
        pais: primeraUnidad.pais,
        totalUnidades: unidadesGrupo.length,
        disponibles: disponibles.length,
        enTransito,
        reservadas,
        vendidas,
        vencidas,
        dañadas: danadas,
        valorTotalUSD: valorTotal,
        costoPromedioUSD: costoPromedio,
        proximasAVencer30Dias: proximasVencer30,
        proximasAVencer90Dias: proximasVencer90,
        diasPromedioVencimiento: diasPromedio,
        stockCritico,
        stockMinimo: producto.stockMinimo,
        stockMaximo: producto.stockMaximo,
        ultimaActualizacion: Timestamp.now()
      });
    });

    // Aplicar filtros adicionales
    let resultado = inventario;

    if (filtros?.soloStockCritico) {
      resultado = resultado.filter(i => i.stockCritico);
    }

    if (filtros?.soloAgotados) {
      resultado = resultado.filter(i => i.disponibles === 0);
    }

    if (filtros?.soloConStock) {
      resultado = resultado.filter(i => i.disponibles > 0);
    }

    if (filtros?.grupo) {
      resultado = resultado.filter(i => i.productoGrupo === filtros.grupo);
    }

    if (filtros?.subgrupo) {
      resultado = resultado.filter(i => i.productoSubgrupo === filtros.subgrupo);
    }

    if (filtros?.marca) {
      resultado = resultado.filter(i => i.productoMarca === filtros.marca);
    }

    return resultado;
  },

  /**
   * Obtener inventario por país
   */
  async getInventarioPorPais(pais: 'USA' | 'Peru'): Promise<InventarioPorPais> {
    const inventario = await this.getInventarioAgregado({ pais });

    return {
      pais,
      totalProductos: inventario.length,
      totalUnidades: inventario.reduce((sum, i) => sum + i.totalUnidades, 0),
      disponibles: inventario.reduce((sum, i) => sum + i.disponibles, 0),
      enTransito: inventario.reduce((sum, i) => sum + i.enTransito, 0),
      reservadas: inventario.reduce((sum, i) => sum + i.reservadas, 0),
      valorTotalUSD: inventario.reduce((sum, i) => sum + i.valorTotalUSD, 0),
      productosStockCritico: inventario.filter(i => i.stockCritico).length,
      productosAgotados: inventario.filter(i => i.disponibles === 0).length,
      unidadesProximasVencer30: inventario.reduce((sum, i) => sum + i.proximasAVencer30Dias, 0),
      unidadesProximasVencer90: inventario.reduce((sum, i) => sum + i.proximasAVencer90Dias, 0)
    };
  },

  /**
   * Obtener resumen general de inventario (ambos países)
   */
  async getResumenGeneral(): Promise<InventarioResumen> {
    const [usa, peru] = await Promise.all([
      this.getInventarioPorPais('USA'),
      this.getInventarioPorPais('Peru')
    ]);

    return {
      usa,
      peru,
      total: {
        productos: usa.totalProductos + peru.totalProductos,
        unidades: usa.totalUnidades + peru.totalUnidades,
        valorUSD: usa.valorTotalUSD + peru.valorTotalUSD
      }
    };
  },

  /**
   * Obtener estadísticas globales de inventario
   *
   * IMPORTANTE: Usa UNA SOLA fuente de verdad (unidades) para todos los cálculos
   * Esto evita inconsistencias entre diferentes métricas
   */
  async getStats(): Promise<InventarioStats> {
    const [inventario, unidades, transferencias] = await Promise.all([
      this.getInventarioAgregado(),
      unidadService.getAll(),
      transferenciaService.getAll()
    ]);

    // ================================================================
    // CALCULAR TODO DESDE LAS UNIDADES (fuente única de verdad)
    // ================================================================

    // Contadores por estado y país
    let disponiblesUSA = 0;
    let disponiblesPeru = 0;
    let reservadasUSA = 0;
    let reservadasPeru = 0;
    let enTransitoUSA = 0;
    let enTransitoPeru = 0;
    let vencidas = 0;
    let totalUnidadesUSA = 0;
    let totalUnidadesPeru = 0;

    // Valor total del inventario activo
    let valorTotalUSD = 0;
    let valorUSA = 0;
    let valorPeru = 0;

    for (const u of unidades) {
      const costoUnidad = u.costoUnitarioUSD + ((u as any).costoFleteUSD || 0);

      switch (u.estado) {
        case 'recibida_usa':
          disponiblesUSA++;
          totalUnidadesUSA++;
          valorUSA += costoUnidad;
          valorTotalUSD += costoUnidad;
          break;
        case 'disponible_peru':
          disponiblesPeru++;
          totalUnidadesPeru++;
          valorPeru += costoUnidad;
          valorTotalUSD += costoUnidad;
          break;
        case 'reservada':
          if (u.pais === 'USA') {
            reservadasUSA++;
            totalUnidadesUSA++;
            valorUSA += costoUnidad;
          } else {
            reservadasPeru++;
            totalUnidadesPeru++;
            valorPeru += costoUnidad;
          }
          valorTotalUSD += costoUnidad;
          break;
        case 'en_transito_usa':
          enTransitoUSA++;
          valorTotalUSD += costoUnidad;
          break;
        case 'en_transito_peru':
          enTransitoPeru++;
          valorTotalUSD += costoUnidad;
          break;
        case 'vencida':
          vencidas++;
          break;
        // vendida, danada no se cuentan en inventario activo
      }
    }

    // Calcular unidades con movimiento en los últimos 7 días
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    hace7Dias.setHours(0, 0, 0, 0);

    const movimientosRecientes = unidades.filter(u => {
      const fechaActualizacion = u.fechaActualizacion?.toDate() || u.fechaCreacion?.toDate();
      return fechaActualizacion && fechaActualizacion >= hace7Dias;
    }).length;

    // Contar transferencias de los últimos 7 días
    const transferenciasRecientes = transferencias.filter(t => {
      const fechaCreacion = t.fechaCreacion?.toDate();
      return fechaCreacion && fechaCreacion >= hace7Dias;
    }).length;

    // Productos únicos con stock crítico o agotados
    const productosStockCritico = inventario.filter(i => i.stockCritico).length;
    const productosAgotados = inventario.filter(i => i.disponibles === 0 && i.reservadas === 0 && i.enTransito === 0).length;
    const unidadesProximasVencer30 = inventario.reduce((sum, i) => sum + i.proximasAVencer30Dias, 0);

    return {
      totalUnidadesUSA,
      totalUnidadesPeru,
      disponiblesUSA,
      disponiblesPeru,
      reservadasUSA,
      reservadasPeru,
      enTransitoUSA,
      enTransitoPeru,
      valorUSA,
      valorPeru,
      totalProductos: inventario.length,
      totalUnidades: totalUnidadesUSA + totalUnidadesPeru + enTransitoUSA + enTransitoPeru,
      totalDisponibles: disponiblesUSA + disponiblesPeru,
      totalReservadas: reservadasUSA + reservadasPeru,
      totalEnTransito: enTransitoUSA + enTransitoPeru,
      valorTotalUSD,
      productosStockCritico,
      productosAgotados,
      unidadesProximasVencer30,
      unidadesVencidas: vencidas,
      movimientosUltimos7Dias: movimientosRecientes,
      transferenciasUltimos7Dias: transferenciasRecientes
    };
  },

  /**
   * Obtener inventario de un producto específico en todos los almacenes
   */
  async getInventarioProducto(productoId: string): Promise<InventarioProducto[]> {
    return this.getInventarioAgregado({ productoId });
  },

  /**
   * Obtener inventario de un almacén específico
   */
  async getInventarioAlmacen(almacenId: string): Promise<InventarioProducto[]> {
    return this.getInventarioAgregado({ almacenId });
  },

  /**
   * Obtener productos con stock crítico
   */
  async getProductosStockCritico(): Promise<InventarioProducto[]> {
    return this.getInventarioAgregado({ soloStockCritico: true });
  },

  /**
   * Obtener productos agotados
   */
  async getProductosAgotados(): Promise<InventarioProducto[]> {
    return this.getInventarioAgregado({ soloAgotados: true });
  },

  /**
   * Buscar inventario por SKU o nombre de producto
   */
  async buscarInventario(termino: string): Promise<InventarioProducto[]> {
    const inventario = await this.getInventarioAgregado();
    const terminoLower = termino.toLowerCase();

    return inventario.filter(i =>
      i.productoSKU.toLowerCase().includes(terminoLower) ||
      i.productoNombre.toLowerCase().includes(terminoLower) ||
      i.productoMarca.toLowerCase().includes(terminoLower)
    );
  },

  /**
   * Sincronizar reservas huérfanas
   * Limpia unidades reservadas cuya venta/cotización ya no existe
   * Útil cuando se eliminan ventas o cotizaciones directamente desde Firebase
   */
  async sincronizarReservasHuerfanas(): Promise<{
    unidadesRevisadas: number;
    unidadesLiberadas: number;
    errores: number;
    detalle: Array<{
      unidadId: string;
      productoNombre: string;
      referenciaId: string;
      tipoReferencia: 'venta' | 'cotizacion' | 'desconocido';
    }>;
  }> {
    try {
      // Obtener todas las unidades con estado 'reservada'
      const unidadesReservadas = await unidadService.buscar({ estado: 'reservada' });

      if (unidadesReservadas.length === 0) {
        return {
          unidadesRevisadas: 0,
          unidadesLiberadas: 0,
          errores: 0,
          detalle: []
        };
      }

      // Obtener todos los IDs de ventas existentes
      const ventasSnapshot = await getDocs(collection(db, 'ventas'));
      const ventasExistentes = new Set(ventasSnapshot.docs.map(d => d.id));

      // Obtener todos los IDs de cotizaciones existentes
      const cotizacionesSnapshot = await getDocs(collection(db, 'cotizaciones'));
      const cotizacionesExistentes = new Set(cotizacionesSnapshot.docs.map(d => d.id));

      let liberadas = 0;
      let errores = 0;
      const detalle: Array<{
        unidadId: string;
        productoNombre: string;
        referenciaId: string;
        tipoReferencia: 'venta' | 'cotizacion' | 'desconocido';
      }> = [];

      // Usar batch para actualizaciones más eficientes
      const batch = writeBatch(db);
      let batchCount = 0;
      const MAX_BATCH = 500;

      for (const unidad of unidadesReservadas) {
        const referenciaId = unidad.reservadaPara || unidad.ventaId;

        if (!referenciaId) {
          // Unidad reservada sin referencia - liberar
          try {
            batch.update(doc(db, 'unidades', unidad.id), {
              estado: 'disponible_peru',
              reservadaPara: null,
              fechaReserva: null,
              reservaVigenciaHasta: null,
              fechaActualizacion: Timestamp.now()
            });
            batchCount++;
            liberadas++;
            detalle.push({
              unidadId: unidad.id,
              productoNombre: unidad.productoNombre,
              referenciaId: 'sin_referencia',
              tipoReferencia: 'desconocido'
            });
          } catch (e) {
            errores++;
          }
          continue;
        }

        // Determinar si es venta o cotización
        const esVenta = ventasExistentes.has(referenciaId);
        const esCotizacion = cotizacionesExistentes.has(referenciaId);

        // Si no existe ni como venta ni como cotización, liberar
        if (!esVenta && !esCotizacion) {
          try {
            batch.update(doc(db, 'unidades', unidad.id), {
              estado: 'disponible_peru',
              reservadaPara: null,
              fechaReserva: null,
              reservaVigenciaHasta: null,
              fechaActualizacion: Timestamp.now()
            });
            batchCount++;
            liberadas++;
            detalle.push({
              unidadId: unidad.id,
              productoNombre: unidad.productoNombre,
              referenciaId,
              tipoReferencia: referenciaId.startsWith('COT') ? 'cotizacion' : 'venta'
            });
          } catch (e) {
            errores++;
          }
        }

        // Commit batch si alcanzamos el límite
        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          batchCount = 0;
        }
      }

      // Commit batch final si hay operaciones pendientes
      if (batchCount > 0) {
        await batch.commit();
      }

      console.log(
        `[Sincronización Reservas] ${unidadesReservadas.length} revisadas, ` +
        `${liberadas} liberadas, ${errores} errores`
      );

      return {
        unidadesRevisadas: unidadesReservadas.length,
        unidadesLiberadas: liberadas,
        errores,
        detalle
      };
    } catch (error: any) {
      console.error('Error sincronizando reservas huérfanas:', error);
      throw new Error(`Error sincronizando reservas: ${error.message}`);
    }
  },

  /**
   * Verificar si una reserva específica es válida
   * Útil para verificar una unidad individual
   */
  async verificarReserva(unidadId: string): Promise<{
    esValida: boolean;
    razon?: string;
    referenciaId?: string;
    tipoReferencia?: 'venta' | 'cotizacion';
  }> {
    const unidad = await unidadService.getById(unidadId);

    if (!unidad) {
      return { esValida: false, razon: 'Unidad no encontrada' };
    }

    if (unidad.estado !== 'reservada') {
      return { esValida: true, razon: 'Unidad no está reservada' };
    }

    const referenciaId = unidad.reservadaPara || unidad.ventaId;

    if (!referenciaId) {
      return { esValida: false, razon: 'Unidad reservada sin referencia' };
    }

    // Verificar si existe la venta
    const ventaDoc = await getDoc(doc(db, 'ventas', referenciaId));
    if (ventaDoc.exists()) {
      return {
        esValida: true,
        referenciaId,
        tipoReferencia: 'venta'
      };
    }

    // Verificar si existe la cotización
    const cotizacionDoc = await getDoc(doc(db, 'cotizaciones', referenciaId));
    if (cotizacionDoc.exists()) {
      return {
        esValida: true,
        referenciaId,
        tipoReferencia: 'cotizacion'
      };
    }

    return {
      esValida: false,
      razon: 'Referencia no existe en ventas ni cotizaciones',
      referenciaId
    };
  },

  /**
   * Sincronización completa de estados de unidades
   * Corrige inconsistencias entre el estado de la unidad y su ubicación real
   *
   * Lógica de corrección:
   * 1. Si pais='Peru' y estado='recibida_usa' → cambiar a 'disponible_peru'
   * 2. Si pais='USA' y estado='disponible_peru' → cambiar a 'recibida_usa'
   * 3. Unidades reservadas cuya venta/cotización no existe → liberar
   * 4. Unidades en tránsito sin transferencia activa → corregir según almacén
   */
  async sincronizarEstadosCompleto(): Promise<{
    unidadesRevisadas: number;
    correccionesRealizadas: number;
    reservasLiberadas: number;
    errores: number;
    detalle: Array<{
      unidadId: string;
      productoNombre: string;
      estadoAnterior: string;
      estadoNuevo: string;
      razon: string;
    }>;
  }> {
    try {
      // Obtener TODAS las unidades
      const snapshot = await getDocs(collection(db, 'unidades'));
      const todasUnidades = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Unidad[];

      if (todasUnidades.length === 0) {
        return {
          unidadesRevisadas: 0,
          correccionesRealizadas: 0,
          reservasLiberadas: 0,
          errores: 0,
          detalle: []
        };
      }

      // Obtener ventas y cotizaciones existentes para validar reservas
      const ventasSnapshot = await getDocs(collection(db, 'ventas'));
      const ventasExistentes = new Set(ventasSnapshot.docs.map(d => d.id));

      const cotizacionesSnapshot = await getDocs(collection(db, 'cotizaciones'));
      const cotizacionesExistentes = new Set(cotizacionesSnapshot.docs.map(d => d.id));

      // Obtener transferencias activas (en_transito)
      const transferenciasQuery = query(
        collection(db, 'transferencias'),
        where('estado', 'in', ['pendiente', 'en_transito'])
      );
      const transferenciasSnapshot = await getDocs(transferenciasQuery);
      const unidadesEnTransferencia = new Set<string>();
      transferenciasSnapshot.docs.forEach(d => {
        const data = d.data();
        if (data.unidadesIds) {
          data.unidadesIds.forEach((id: string) => unidadesEnTransferencia.add(id));
        }
      });

      let correcciones = 0;
      let reservasLiberadas = 0;
      let errores = 0;
      const detalle: Array<{
        unidadId: string;
        productoNombre: string;
        estadoAnterior: string;
        estadoNuevo: string;
        razon: string;
      }> = [];

      const batch = writeBatch(db);
      let batchCount = 0;
      const MAX_BATCH = 500;

      for (const unidad of todasUnidades) {
        const estadoActual = unidad.estado;
        let nuevoEstado: string | null = null;
        let razon = '';

        // CASO 1: Unidad reservada - verificar si la reserva es válida
        if (estadoActual === 'reservada') {
          const referenciaId = unidad.reservadaPara || unidad.ventaId;

          if (!referenciaId) {
            // Sin referencia - liberar a disponible según país
            nuevoEstado = unidad.pais === 'Peru' ? 'disponible_peru' : 'recibida_usa';
            razon = 'Reserva sin referencia';
          } else {
            const existeVenta = ventasExistentes.has(referenciaId);
            const existeCotizacion = cotizacionesExistentes.has(referenciaId);

            if (!existeVenta && !existeCotizacion) {
              // Referencia eliminada - liberar según país
              nuevoEstado = unidad.pais === 'Peru' ? 'disponible_peru' : 'recibida_usa';
              razon = `Referencia ${referenciaId} eliminada`;
              reservasLiberadas++;
            }
          }
        }
        // CASO 2: En Perú pero con estado de USA
        else if (unidad.pais === 'Peru' && estadoActual === 'recibida_usa') {
          // No está en transferencia activa ni reservada
          if (!unidadesEnTransferencia.has(unidad.id)) {
            nuevoEstado = 'disponible_peru';
            razon = 'Unidad en Perú con estado USA';
          }
        }
        // CASO 3: En USA pero con estado de Perú
        else if (unidad.pais === 'USA' && estadoActual === 'disponible_peru') {
          if (!unidadesEnTransferencia.has(unidad.id)) {
            nuevoEstado = 'recibida_usa';
            razon = 'Unidad en USA con estado Perú';
          }
        }
        // CASO 4: En tránsito pero no hay transferencia activa
        else if ((estadoActual === 'en_transito_peru' || estadoActual === 'en_transito_usa')) {
          if (!unidadesEnTransferencia.has(unidad.id)) {
            // Corregir según país actual
            nuevoEstado = unidad.pais === 'Peru' ? 'disponible_peru' : 'recibida_usa';
            razon = 'En tránsito sin transferencia activa';
          }
        }

        // Si hay corrección que hacer
        if (nuevoEstado && nuevoEstado !== estadoActual) {
          try {
            const updateData: Record<string, any> = {
              estado: nuevoEstado,
              fechaActualizacion: Timestamp.now()
            };

            // Si era reservada, limpiar campos de reserva
            if (estadoActual === 'reservada') {
              updateData.reservadaPara = null;
              updateData.fechaReserva = null;
              updateData.reservaVigenciaHasta = null;
            }

            batch.update(doc(db, 'unidades', unidad.id), updateData);
            batchCount++;
            correcciones++;

            detalle.push({
              unidadId: unidad.id,
              productoNombre: unidad.productoNombre || `${unidad.productoSKU}`,
              estadoAnterior: estadoActual,
              estadoNuevo: nuevoEstado,
              razon
            });

            // Commit batch si alcanzamos el límite
            if (batchCount >= MAX_BATCH) {
              await batch.commit();
              batchCount = 0;
            }
          } catch (e) {
            errores++;
            console.error(`Error actualizando unidad ${unidad.id}:`, e);
          }
        }
      }

      // Commit batch final
      if (batchCount > 0) {
        await batch.commit();
      }

      console.log(
        `[Sincronización Estados] ${todasUnidades.length} revisadas, ` +
        `${correcciones} corregidas, ${reservasLiberadas} reservas liberadas, ${errores} errores`
      );

      return {
        unidadesRevisadas: todasUnidades.length,
        correccionesRealizadas: correcciones,
        reservasLiberadas,
        errores,
        detalle
      };
    } catch (error: any) {
      console.error('Error en sincronización completa de estados:', error);
      throw new Error(`Error sincronizando estados: ${error.message}`);
    }
  },

  /**
   * SINCRONIZACIÓN COMPLETA DE STOCK EN PRODUCTOS
   * Recalcula stockUSA, stockPeru, stockTransito, stockReservado y stockDisponible
   * basándose en las unidades reales en la colección 'unidades'.
   *
   * Esta función es útil cuando:
   * - Se eliminan datos directamente desde Firebase
   * - Los contadores de stock se desincronizaron
   * - Se quiere verificar integridad de datos
   */
  async sincronizarStockProductos(): Promise<{
    productosRevisados: number;
    productosActualizados: number;
    errores: number;
    detalle: Array<{
      productoId: string;
      productoSKU: string;
      productoNombre: string;
      stockAnterior: { usa: number; peru: number; transito: number; reservado: number };
      stockNuevo: { usa: number; peru: number; transito: number; reservado: number };
      diferencia: { usa: number; peru: number; transito: number; reservado: number };
    }>;
  }> {
    try {
      // Obtener TODAS las unidades
      const unidadesSnapshot = await getDocs(collection(db, 'unidades'));
      const todasUnidades = unidadesSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Unidad[];

      // Obtener TODOS los productos
      const productosSnapshot = await getDocs(collection(db, 'productos'));
      const productos = productosSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Producto[];

      if (productos.length === 0) {
        return {
          productosRevisados: 0,
          productosActualizados: 0,
          errores: 0,
          detalle: []
        };
      }

      // Calcular stock real por producto desde las unidades
      const stockRealPorProducto = new Map<string, {
        usa: number;
        peru: number;
        transito: number;
        reservado: number;
        disponible: number;
      }>();

      // Inicializar todos los productos con 0
      productos.forEach(p => {
        stockRealPorProducto.set(p.id, {
          usa: 0,
          peru: 0,
          transito: 0,
          reservado: 0,
          disponible: 0
        });
      });

      // Contar unidades por estado y país
      for (const unidad of todasUnidades) {
        const stockProducto = stockRealPorProducto.get(unidad.productoId);
        if (!stockProducto) continue;

        switch (unidad.estado) {
          case 'recibida_usa':
            // Stock disponible en USA
            stockProducto.usa++;
            stockProducto.disponible++;
            break;
          case 'disponible_peru':
            // Stock disponible en Perú
            stockProducto.peru++;
            stockProducto.disponible++;
            break;
          case 'en_transito_usa':
          case 'en_transito_peru':
            // En tránsito (entre almacenes)
            stockProducto.transito++;
            break;
          case 'reservada':
            // Reservada para venta/cotización
            stockProducto.reservado++;
            // Las reservadas también se cuentan según país
            if (unidad.pais === 'USA') {
              stockProducto.usa++;
            } else {
              stockProducto.peru++;
            }
            break;
          // Estados terminales (vendida, vencida, dañada) no se cuentan en stock
          case 'vendida':
          case 'vencida':
          case 'danada':
            break;
        }
      }

      // Comparar y actualizar productos
      let actualizados = 0;
      let errores = 0;
      const detalle: Array<{
        productoId: string;
        productoSKU: string;
        productoNombre: string;
        stockAnterior: { usa: number; peru: number; transito: number; reservado: number };
        stockNuevo: { usa: number; peru: number; transito: number; reservado: number };
        diferencia: { usa: number; peru: number; transito: number; reservado: number };
      }> = [];

      const batch = writeBatch(db);
      let batchCount = 0;
      const MAX_BATCH = 500;

      for (const producto of productos) {
        const stockReal = stockRealPorProducto.get(producto.id)!;
        const stockActual = {
          usa: (producto as any).stockUSA || 0,
          peru: (producto as any).stockPeru || 0,
          transito: (producto as any).stockTransito || 0,
          reservado: (producto as any).stockReservado || 0
        };

        // Verificar si hay diferencias
        const hayDiferencia =
          stockActual.usa !== stockReal.usa ||
          stockActual.peru !== stockReal.peru ||
          stockActual.transito !== stockReal.transito ||
          stockActual.reservado !== stockReal.reservado;

        if (hayDiferencia) {
          try {
            batch.update(doc(db, 'productos', producto.id), {
              stockUSA: stockReal.usa,
              stockPeru: stockReal.peru,
              stockTransito: stockReal.transito,
              stockReservado: stockReal.reservado,
              stockDisponible: stockReal.disponible,
              ultimaEdicion: serverTimestamp()
            });
            batchCount++;
            actualizados++;

            detalle.push({
              productoId: producto.id,
              productoSKU: (producto as any).sku || '',
              productoNombre: `${(producto as any).marca || ''} ${(producto as any).nombreComercial || ''}`.trim(),
              stockAnterior: stockActual,
              stockNuevo: {
                usa: stockReal.usa,
                peru: stockReal.peru,
                transito: stockReal.transito,
                reservado: stockReal.reservado
              },
              diferencia: {
                usa: stockReal.usa - stockActual.usa,
                peru: stockReal.peru - stockActual.peru,
                transito: stockReal.transito - stockActual.transito,
                reservado: stockReal.reservado - stockActual.reservado
              }
            });

            // Commit batch si alcanzamos el límite
            if (batchCount >= MAX_BATCH) {
              await batch.commit();
              batchCount = 0;
            }
          } catch (e) {
            errores++;
            console.error(`Error actualizando producto ${producto.id}:`, e);
          }
        }
      }

      // Commit batch final
      if (batchCount > 0) {
        await batch.commit();
      }

      console.log(
        `[Sincronización Stock] ${productos.length} productos revisados, ` +
        `${actualizados} actualizados, ${errores} errores`
      );

      return {
        productosRevisados: productos.length,
        productosActualizados: actualizados,
        errores,
        detalle
      };
    } catch (error: any) {
      console.error('Error sincronizando stock de productos:', error);
      throw new Error(`Error sincronizando stock: ${error.message}`);
    }
  },

  /**
   * SINCRONIZACIÓN COMPLETA DEL SISTEMA
   * Ejecuta todas las sincronizaciones en orden:
   * 1. Sincronizar estados de unidades
   * 2. Sincronizar stock de productos
   * 3. Actualizar CTRU promedio de productos
   */
  async sincronizacionCompleta(): Promise<{
    estadosUnidades: {
      unidadesRevisadas: number;
      correccionesRealizadas: number;
      reservasLiberadas: number;
    };
    stockProductos: {
      productosRevisados: number;
      productosActualizados: number;
    };
    ctruActualizados: number;
    errores: number;
  }> {
    try {
      console.log('[Sincronización] Iniciando sincronización completa del sistema...');

      // Paso 1: Sincronizar estados de unidades
      console.log('[Sincronización] Paso 1/3: Sincronizando estados de unidades...');
      const resultadoEstados = await this.sincronizarEstadosCompleto();

      // Paso 2: Sincronizar stock de productos
      console.log('[Sincronización] Paso 2/3: Sincronizando stock de productos...');
      const resultadoStock = await this.sincronizarStockProductos();

      // Paso 3: Actualizar CTRU promedio de productos
      console.log('[Sincronización] Paso 3/3: Actualizando CTRU de productos...');
      const { ctruService } = await import('./ctru.service');
      const ctruActualizados = await ctruService.actualizarCTRUPromedioProductos();

      const totalErrores = resultadoEstados.errores + resultadoStock.errores;

      console.log('[Sincronización] ✅ Sincronización completa finalizada');
      console.log(`  - Unidades: ${resultadoEstados.correccionesRealizadas} corregidas`);
      console.log(`  - Productos: ${resultadoStock.productosActualizados} actualizados`);
      console.log(`  - CTRU: ${ctruActualizados} productos actualizados`);
      if (totalErrores > 0) {
        console.log(`  - Errores: ${totalErrores}`);
      }

      return {
        estadosUnidades: {
          unidadesRevisadas: resultadoEstados.unidadesRevisadas,
          correccionesRealizadas: resultadoEstados.correccionesRealizadas,
          reservasLiberadas: resultadoEstados.reservasLiberadas
        },
        stockProductos: {
          productosRevisados: resultadoStock.productosRevisados,
          productosActualizados: resultadoStock.productosActualizados
        },
        ctruActualizados,
        errores: totalErrores
      };
    } catch (error: any) {
      console.error('Error en sincronización completa:', error);
      throw new Error(`Error en sincronización completa: ${error.message}`);
    }
  }
};
