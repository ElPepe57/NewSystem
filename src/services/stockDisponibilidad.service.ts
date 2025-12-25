import { Timestamp } from 'firebase/firestore';
import { inventarioService } from './inventario.service';
import { almacenService } from './almacen.service';
import { unidadService } from './unidad.service';
import type { Almacen } from '../types/almacen.types';
import type { InventarioProducto } from '../types/inventario.types';
import type { Unidad } from '../types/unidad.types';
import type {
  FuenteStock,
  EstadoDisponibilidad,
  DisponibilidadAlmacen,
  DisponibilidadProducto,
  RecomendacionStock,
  ConsultaDisponibilidadRequest,
  ConsultaDisponibilidadResponse,
  ReservaStockMultiAlmacen,
  ReservaProductoMultiAlmacen,
  ReservaAlmacen,
  ConfiguracionPrioridadStock,
  CriteriosSeleccionAlmacen
} from '../types/stockDisponibilidad.types';

/**
 * Configuración por defecto de prioridad de stock
 */
const CONFIG_DEFAULT: ConfiguracionPrioridadStock = {
  prioridadPeru: 1,
  prioridadUSAConViaje: 2,
  prioridadUSASinViaje: 3,
  diasMaximoEsperaUSA: 30,
  costoFleteMaximoUSD: 10,
  preferirPeruSiDisponible: true,
  permitirMezclaAlmacenes: true,
  generarRequerimientoAutomatico: true
};

/**
 * Criterios por defecto para selección de almacén
 */
const CRITERIOS_DEFAULT: CriteriosSeleccionAlmacen = {
  pesoDisponibilidadInmediata: 40,
  pesoCostoTotal: 25,
  pesoTiempoEntrega: 25,
  pesoVencimiento: 10
};

/**
 * Servicio de disponibilidad de stock multi-almacén
 *
 * Proporciona funcionalidad para:
 * - Consultar disponibilidad de productos en Perú y USA
 * - Recomendar la mejor fuente de stock
 * - Crear reservas multi-almacén
 * - Integrar con módulo de Requerimientos cuando no hay stock
 */
export const stockDisponibilidadService = {
  /**
   * Consultar disponibilidad de múltiples productos
   */
  async consultarDisponibilidad(
    request: ConsultaDisponibilidadRequest
  ): Promise<ConsultaDisponibilidadResponse> {
    const productos: DisponibilidadProducto[] = [];
    let tiempoMaximo = 0;
    let costoTotal = 0;
    let requiereRequerimiento = false;

    // Obtener inventario completo
    const inventarioCompleto = await inventarioService.getInventarioAgregado();
    const almacenesUSA = await almacenService.getAlmacenesUSA();
    const almacenesPeru = await almacenService.getAlmacenesPeru();

    // Mapear almacenes por ID
    const almacenesMap = new Map<string, Almacen>();
    [...almacenesUSA, ...almacenesPeru].forEach(a => almacenesMap.set(a.id, a));

    for (const item of request.productos) {
      const disponibilidad = await this.getDisponibilidadProducto(
        item.productoId,
        item.cantidadRequerida,
        inventarioCompleto,
        almacenesMap,
        request.incluirRecomendacion ?? true,
        request.priorizarPeru ?? true
      );

      productos.push(disponibilidad);

      // Actualizar resumen
      if (disponibilidad.requiereCompra) {
        requiereRequerimiento = true;
      }

      if (disponibilidad.recomendacion) {
        const tiempoMax = Math.max(
          ...disponibilidad.recomendacion.almacenesRecomendados.map(a => a.tiempoEstimadoDias)
        );
        tiempoMaximo = Math.max(tiempoMaximo, tiempoMax);

        const costo = disponibilidad.recomendacion.almacenesRecomendados.reduce(
          (sum, a) => sum + a.costoEstimadoUSD, 0
        );
        costoTotal += costo;
      }
    }

    const todosDisponibles = productos.every(
      p => p.estadoDisponibilidad === 'disponible'
    );
    const algunosParciales = productos.some(
      p => p.estadoDisponibilidad === 'parcial'
    );
    const algunosSinStock = productos.some(
      p => p.estadoDisponibilidad === 'sin_stock'
    );

    return {
      productos,
      resumen: {
        todosDisponibles,
        algunosParciales,
        algunosSinStock,
        tiempoMaximoEstimadoDias: tiempoMaximo,
        costoTotalEstimadoUSD: costoTotal,
        requiereRequerimiento
      },
      fechaConsulta: Timestamp.now()
    };
  },

  /**
   * Obtener disponibilidad detallada de un producto
   */
  async getDisponibilidadProducto(
    productoId: string,
    cantidadRequerida: number,
    inventarioCompleto?: InventarioProducto[],
    almacenesMap?: Map<string, Almacen>,
    incluirRecomendacion: boolean = true,
    priorizarPeru: boolean = true
  ): Promise<DisponibilidadProducto> {
    // Obtener inventario si no se proporcionó
    const inventario = inventarioCompleto ?? await inventarioService.getInventarioAgregado();

    // Filtrar inventario del producto
    const inventarioProducto = inventario.filter(i => i.productoId === productoId);

    // Si no hay almacenes mapeados, obtenerlos
    let almacenes = almacenesMap;
    if (!almacenes) {
      const [almacenesUSA, almacenesPeru] = await Promise.all([
        almacenService.getAlmacenesUSA(),
        almacenService.getAlmacenesPeru()
      ]);
      almacenes = new Map<string, Almacen>();
      [...almacenesUSA, ...almacenesPeru].forEach(a => almacenes!.set(a.id, a));
    }

    // Construir disponibilidad por almacén
    const disponibilidadAlmacenes: DisponibilidadAlmacen[] = [];
    let totalDisponible = 0;
    let totalReservado = 0;
    let disponiblePeru = 0;
    let disponibleUSA = 0;

    for (const inv of inventarioProducto) {
      const almacen = almacenes.get(inv.almacenId);
      if (!almacen) continue;

      // Obtener unidades disponibles para este almacén
      const unidadesDisponibles = await unidadService.buscar({
        productoId,
        almacenId: inv.almacenId,
        estado: inv.pais === 'Peru' ? 'disponible_peru' : 'recibida_usa'
      });

      // Calcular unidades libres (nunca negativo)
      const unidadesLibresCalc = Math.max(0, inv.disponibles - inv.reservadas);

      const disponibilidadAlmacen: DisponibilidadAlmacen = {
        almacenId: inv.almacenId,
        almacenNombre: inv.almacenNombre,
        almacenCodigo: almacen.codigo,
        pais: inv.pais,
        esViajero: almacen.esViajero,
        unidadesDisponibles: inv.disponibles,
        unidadesReservadas: inv.reservadas,
        unidadesLibres: unidadesLibresCalc,
        unidadesIds: unidadesDisponibles.slice(0, unidadesLibresCalc).map(u => u.id),
        costoPromedioUSD: inv.costoPromedioUSD,
        diasPromedioVencimiento: inv.diasPromedioVencimiento
      };

      // Agregar información de viajero si aplica
      if (almacen.esViajero && almacen.proximoViaje) {
        disponibilidadAlmacen.viajeroProximoViaje = almacen.proximoViaje;
        disponibilidadAlmacen.viajeroNombre = almacen.nombre;

        // Calcular días estimados de llegada
        const hoy = new Date();
        const proximoViaje = almacen.proximoViaje.toDate();
        const diasHastaViaje = Math.ceil(
          (proximoViaje.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
        );
        // Sumar días de viaje estimados (3 días promedio)
        disponibilidadAlmacen.tiempoEstimadoLlegadaDias = Math.max(0, diasHastaViaje) + 3;
      } else if (inv.pais === 'USA') {
        // Almacén USA sin viaje programado: estimar 15 días
        disponibilidadAlmacen.tiempoEstimadoLlegadaDias = 15;
      } else {
        // Perú: disponible inmediatamente
        disponibilidadAlmacen.tiempoEstimadoLlegadaDias = 0;
      }

      // Estimar costo de flete para USA
      if (inv.pais === 'USA') {
        disponibilidadAlmacen.costoFleteEstimadoUSD = almacen.costoPromedioFlete || 5;
      }

      disponibilidadAlmacenes.push(disponibilidadAlmacen);

      // Actualizar totales (asegurar que no sean negativos)
      const libres = Math.max(0, inv.disponibles - inv.reservadas);
      totalDisponible += inv.disponibles;
      totalReservado += inv.reservadas;

      if (inv.pais === 'Peru') {
        disponiblePeru += libres;
      } else {
        disponibleUSA += libres;
      }
    }

    // Ordenar por prioridad: Perú primero, luego USA con viaje, luego USA sin viaje
    disponibilidadAlmacenes.sort((a, b) => {
      if (a.pais === 'Peru' && b.pais !== 'Peru') return -1;
      if (a.pais !== 'Peru' && b.pais === 'Peru') return 1;
      if (a.viajeroProximoViaje && !b.viajeroProximoViaje) return -1;
      if (!a.viajeroProximoViaje && b.viajeroProximoViaje) return 1;
      return (a.tiempoEstimadoLlegadaDias || 0) - (b.tiempoEstimadoLlegadaDias || 0);
    });

    // Determinar estado de disponibilidad
    const totalLibre = disponiblePeru + disponibleUSA;
    let estadoDisponibilidad: EstadoDisponibilidad;

    if (totalLibre >= cantidadRequerida) {
      estadoDisponibilidad = 'disponible';
    } else if (totalLibre > 0) {
      estadoDisponibilidad = 'parcial';
    } else {
      estadoDisponibilidad = 'sin_stock';
    }

    // Construir información del producto
    const primerInventario = inventarioProducto[0];
    const resultado: DisponibilidadProducto = {
      productoId,
      sku: primerInventario?.productoSKU || '',
      marca: primerInventario?.productoMarca || '',
      nombreComercial: primerInventario?.productoNombre || '',
      presentacion: '',
      estadoDisponibilidad,
      totalDisponible,
      totalReservado,
      totalLibre,
      disponiblePeru,
      disponibleUSA,
      requiereCompra: totalLibre < cantidadRequerida,
      almacenes: disponibilidadAlmacenes
    };

    // Generar recomendación si se solicita
    if (incluirRecomendacion) {
      resultado.recomendacion = this.generarRecomendacion(
        cantidadRequerida,
        disponibilidadAlmacenes,
        totalLibre,
        priorizarPeru
      );
    }

    return resultado;
  },

  /**
   * Generar recomendación de fuente de stock
   */
  generarRecomendacion(
    cantidadRequerida: number,
    almacenes: DisponibilidadAlmacen[],
    totalLibre: number,
    priorizarPeru: boolean
  ): RecomendacionStock {
    const almacenesRecomendados: RecomendacionStock['almacenesRecomendados'] = [];
    let cantidadRestante = cantidadRequerida;
    let fuentePrincipal: FuenteStock = 'virtual';
    let razon = '';

    // Ordenar almacenes según criterios
    const almacenesOrdenados = [...almacenes].sort((a, b) => {
      // Priorizar Perú si se configura así
      if (priorizarPeru) {
        if (a.pais === 'Peru' && b.pais !== 'Peru') return -1;
        if (a.pais !== 'Peru' && b.pais === 'Peru') return 1;
      }

      // Luego por tiempo de llegada
      const tiempoA = a.tiempoEstimadoLlegadaDias || 0;
      const tiempoB = b.tiempoEstimadoLlegadaDias || 0;
      if (tiempoA !== tiempoB) return tiempoA - tiempoB;

      // Finalmente por costo
      const costoA = a.costoPromedioUSD + (a.costoFleteEstimadoUSD || 0);
      const costoB = b.costoPromedioUSD + (b.costoFleteEstimadoUSD || 0);
      return costoA - costoB;
    });

    // Distribuir cantidad entre almacenes
    for (const almacen of almacenesOrdenados) {
      if (cantidadRestante <= 0) break;
      if (almacen.unidadesLibres <= 0) continue;

      const cantidadDeEsteAlmacen = Math.min(cantidadRestante, almacen.unidadesLibres);

      almacenesRecomendados.push({
        almacenId: almacen.almacenId,
        almacenNombre: almacen.almacenNombre,
        cantidad: cantidadDeEsteAlmacen,
        tiempoEstimadoDias: almacen.tiempoEstimadoLlegadaDias || 0,
        costoEstimadoUSD: cantidadDeEsteAlmacen * (
          almacen.costoPromedioUSD + (almacen.costoFleteEstimadoUSD || 0)
        )
      });

      cantidadRestante -= cantidadDeEsteAlmacen;

      // Determinar fuente principal
      if (almacenesRecomendados.length === 1) {
        if (almacen.pais === 'Peru') {
          fuentePrincipal = 'peru';
          razon = 'Stock disponible en Perú (entrega inmediata)';
        } else if (almacen.esViajero && almacen.viajeroProximoViaje) {
          fuentePrincipal = 'usa_viajero';
          razon = `Stock en USA con ${almacen.viajeroNombre}, viaje próximo en ${almacen.tiempoEstimadoLlegadaDias} días`;
        } else {
          fuentePrincipal = 'usa_almacen';
          razon = `Stock en almacén USA, tiempo estimado ${almacen.tiempoEstimadoLlegadaDias} días`;
        }
      }
    }

    // Si hay faltante
    const cantidadFaltante = cantidadRestante > 0 ? cantidadRestante : undefined;
    if (cantidadFaltante) {
      if (almacenesRecomendados.length === 0) {
        fuentePrincipal = 'virtual';
        razon = 'Sin stock disponible, se generará requerimiento de compra';
      } else {
        razon += `. Faltante: ${cantidadFaltante} unidades (requerimiento de compra)`;
      }
    }

    // Generar alternativas
    const alternativas: RecomendacionStock['alternativas'] = [];

    if (fuentePrincipal === 'peru' && almacenes.some(a => a.pais === 'USA' && a.unidadesLibres > 0)) {
      const almacenUSA = almacenes.find(a => a.pais === 'USA' && a.unidadesLibres > 0);
      if (almacenUSA) {
        alternativas.push({
          fuente: almacenUSA.esViajero ? 'usa_viajero' : 'usa_almacen',
          razon: `Alternativa desde USA (${almacenUSA.almacenNombre})`,
          tiempoAdicionalDias: almacenUSA.tiempoEstimadoLlegadaDias || 10,
          costoAdicionalUSD: almacenUSA.costoFleteEstimadoUSD
        });
      }
    }

    return {
      fuente: fuentePrincipal,
      razon,
      almacenesRecomendados,
      cantidadFaltante,
      generaRequerimiento: !!cantidadFaltante,
      alternativas: alternativas.length > 0 ? alternativas : undefined
    };
  },

  /**
   * Crear reserva multi-almacén
   * Este método coordina la reserva de stock desde múltiples ubicaciones
   */
  async crearReservaMultiAlmacen(
    productos: Array<{
      productoId: string;
      cantidadRequerida: number;
      disponibilidad: DisponibilidadProducto;
    }>,
    horasVigencia: number = 48,
    cotizacionId?: string,
    cotizacionNumero?: string
  ): Promise<ReservaStockMultiAlmacen> {
    const productosReserva: ReservaProductoMultiAlmacen[] = [];
    let totalUnidades = 0;
    let unidadesPeru = 0;
    let unidadesUSA = 0;
    let unidadesVirtual = 0;
    let tiempoMaximo = 0;
    const requerimientosGenerados: ReservaStockMultiAlmacen['requerimientosGenerados'] = [];

    for (const item of productos) {
      const { productoId, cantidadRequerida, disponibilidad } = item;
      const reservasPorAlmacen: ReservaAlmacen[] = [];
      let cantidadRestante = cantidadRequerida;
      let cantidadPeru = 0;
      let cantidadUSA = 0;

      // Reservar desde almacenes recomendados
      if (disponibilidad.recomendacion) {
        for (const almacenRec of disponibilidad.recomendacion.almacenesRecomendados) {
          const almacenInfo = disponibilidad.almacenes.find(
            a => a.almacenId === almacenRec.almacenId
          );

          if (!almacenInfo) continue;

          const cantidadReservar = Math.min(cantidadRestante, almacenRec.cantidad);
          const unidadesIds = almacenInfo.unidadesIds.slice(0, cantidadReservar);

          // Reservar las unidades en la base de datos
          for (const unidadId of unidadesIds) {
            await unidadService.actualizarEstado(unidadId, 'reservada', 'Reserva desde cotización');
          }

          const reservaAlmacen: ReservaAlmacen = {
            almacenId: almacenInfo.almacenId,
            almacenNombre: almacenInfo.almacenNombre,
            almacenCodigo: almacenInfo.almacenCodigo,
            pais: almacenInfo.pais,
            esViajero: almacenInfo.esViajero,
            unidadesIds,
            cantidad: cantidadReservar,
            tiempoEstimadoLlegadaDias: almacenInfo.tiempoEstimadoLlegadaDias,
            estado: 'activa'
          };

          if (almacenInfo.tiempoEstimadoLlegadaDias) {
            const fechaEstimada = new Date();
            fechaEstimada.setDate(fechaEstimada.getDate() + almacenInfo.tiempoEstimadoLlegadaDias);
            reservaAlmacen.fechaEstimadaLlegada = Timestamp.fromDate(fechaEstimada);
          }

          reservasPorAlmacen.push(reservaAlmacen);

          // Actualizar contadores
          cantidadRestante -= cantidadReservar;
          if (almacenInfo.pais === 'Peru') {
            cantidadPeru += cantidadReservar;
          } else {
            cantidadUSA += cantidadReservar;
          }

          tiempoMaximo = Math.max(
            tiempoMaximo,
            almacenInfo.tiempoEstimadoLlegadaDias || 0
          );
        }
      }

      // Calcular cantidad virtual (faltante)
      const cantidadVirtual = cantidadRestante > 0 ? cantidadRestante : 0;

      productosReserva.push({
        productoId,
        sku: disponibilidad.sku,
        nombreProducto: `${disponibilidad.marca} ${disponibilidad.nombreComercial}`,
        cantidadTotal: cantidadRequerida,
        reservasPorAlmacen,
        cantidadPeru,
        cantidadUSA,
        cantidadVirtual
      });

      totalUnidades += cantidadRequerida;
      unidadesPeru += cantidadPeru;
      unidadesUSA += cantidadUSA;
      unidadesVirtual += cantidadVirtual;
    }

    // Calcular fecha estimada completa
    const fechaEstimadaCompleta = new Date();
    fechaEstimadaCompleta.setDate(fechaEstimadaCompleta.getDate() + tiempoMaximo);

    // Calcular fecha de vigencia
    const vigenciaHasta = new Date();
    vigenciaHasta.setHours(vigenciaHasta.getHours() + horasVigencia);

    const reserva: ReservaStockMultiAlmacen = {
      activo: true,
      fechaReserva: Timestamp.now(),
      vigenciaHasta: Timestamp.fromDate(vigenciaHasta),
      horasVigencia,
      productos: productosReserva,
      resumen: {
        totalUnidades,
        unidadesPeru,
        unidadesUSA,
        unidadesVirtual,
        tiempoMaximoLlegadaDias: tiempoMaximo,
        fechaEstimadaCompleta: Timestamp.fromDate(fechaEstimadaCompleta)
      },
      requerimientosGenerados: requerimientosGenerados.length > 0 ? requerimientosGenerados : undefined,
      cotizacionOrigenId: cotizacionId,
      cotizacionOrigenNumero: cotizacionNumero
    };

    return reserva;
  },

  /**
   * Liberar reserva multi-almacén
   */
  async liberarReservaMultiAlmacen(reserva: ReservaStockMultiAlmacen): Promise<void> {
    for (const producto of reserva.productos) {
      for (const reservaAlmacen of producto.reservasPorAlmacen) {
        for (const unidadId of reservaAlmacen.unidadesIds) {
          // Restaurar estado según ubicación
          const nuevoEstado = reservaAlmacen.pais === 'Peru' ? 'disponible_peru' : 'recibida_usa';
          await unidadService.actualizarEstado(
            unidadId,
            nuevoEstado as any,
            'Liberación de reserva'
          );
        }
      }
    }
  },

  /**
   * Verificar si una reserva sigue vigente
   */
  isReservaVigente(reserva: ReservaStockMultiAlmacen): boolean {
    if (!reserva.activo) return false;
    const ahora = new Date();
    const vigencia = reserva.vigenciaHasta.toDate();
    return ahora < vigencia;
  },

  /**
   * Calcular tiempo estimado total para una reserva
   */
  calcularTiempoEstimado(reserva: ReservaStockMultiAlmacen): number {
    return reserva.resumen.tiempoMaximoLlegadaDias;
  }
};
