import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { tesoreriaService } from './tesoreria.service';
import { ctruService } from './ctru.service';
import type {
  Gasto,
  GastoFormData,
  GastoFiltros,
  ResumenGastosMes,
  GastoStats,
  ClaseGasto
} from '../types/gasto.types';

const GASTOS_COLLECTION = 'gastos';

export const gastoService = {
  /**
   * Crear un nuevo gasto
   * GVD: Gastos de Venta y Distribución (categorías GV y GD, asociados a ventas)
   * GAO: Gastos Administrativos y Operativos (categorías GA y GO)
   */
  async create(data: GastoFormData, userId: string): Promise<string> {
    try {
      // Determinar clase de gasto basado en:
      // 1. Si se especifica claseGasto explícitamente, usarla
      // 2. Si tiene ventaId/ventaNumero o categoría GV/GD → GVD
      // 3. Categoría GA/GO → GAO
      let claseGasto: ClaseGasto;
      if (data.claseGasto) {
        claseGasto = data.claseGasto;
      } else if (data.ventaId || data.ventaNumero || data.categoria === 'GV' || data.categoria === 'GD') {
        claseGasto = 'GVD';
      } else {
        claseGasto = 'GAO';
      }

      // Generar número de gasto según la clase
      const numeroGasto = await this.generateNumeroGasto(claseGasto);

      // Convertir a PEN si es necesario
      // Soporta: montoPEN directo, moneda PEN + montoOriginal, o moneda USD + montoOriginal + tipoCambio
      let montoPEN = data.montoPEN;
      if (montoPEN === undefined) {
        montoPEN = data.montoOriginal || 0;
        if (data.moneda === 'USD') {
          if (!data.tipoCambio) {
            throw new Error('Debe proporcionar el tipo de cambio para gastos en USD');
          }
          montoPEN = (data.montoOriginal || 0) * data.tipoCambio;
        }
      }

      // Crear objeto gasto - solo incluir campos con valor definido
      // Firestore no acepta valores undefined
      const gasto: Record<string, unknown> = {
        numeroGasto,
        claseGasto,
        tipo: data.tipo,
        categoria: data.categoria,
        descripcion: data.descripcion,
        moneda: data.moneda || 'PEN',
        montoOriginal: data.montoOriginal || montoPEN,
        montoPEN,
        esProrrateable: data.esProrrateable,
        mes: data.fecha.getMonth() + 1,
        anio: data.fecha.getFullYear(),
        fecha: Timestamp.fromDate(data.fecha),
        esRecurrente: data.frecuencia ? data.frecuencia !== 'unico' : false,
        estado: data.estado,
        impactaCTRU: data.impactaCTRU,
        ctruRecalculado: false,
        creadoPor: userId,
        fechaCreacion: Timestamp.now()
      };

      // Agregar campos opcionales solo si tienen valor
      if (data.tipoCambio !== undefined) gasto.tipoCambio = data.tipoCambio;
      if (data.prorrateoTipo) gasto.prorrateoTipo = data.prorrateoTipo;
      if (data.ordenCompraId) gasto.ordenCompraId = data.ordenCompraId;
      if (data.ventaId) gasto.ventaId = data.ventaId;
      if (data.ventaNumero) gasto.ventaNumero = data.ventaNumero;
      if (data.frecuencia) gasto.frecuencia = data.frecuencia;
      if (data.proveedor) gasto.proveedor = data.proveedor;
      if (data.responsable) gasto.responsable = data.responsable;
      if (data.metodoPago) gasto.metodoPago = data.metodoPago;
      if (data.estado === 'pagado') gasto.fechaPago = Timestamp.now();
      if (data.numeroComprobante) gasto.numeroComprobante = data.numeroComprobante;
      if (data.notas) gasto.notas = data.notas;
      if (data.cuentaOrigenId) gasto.cuentaOrigenId = data.cuentaOrigenId;

      const docRef = await addDoc(collection(db, GASTOS_COLLECTION), gasto);

      // Si el gasto está marcado como pagado, registrar movimiento en tesorería
      if (data.estado === 'pagado') {
        // Usar valores por defecto si se proporcionó montoPEN directamente
        const monedaMovimiento = data.moneda || 'PEN';
        const montoMovimiento = data.montoOriginal ?? montoPEN;

        const movimientoData: any = {
          tipo: 'gasto',
          moneda: monedaMovimiento,
          monto: montoMovimiento,
          tipoCambio: data.tipoCambio || 1,
          metodo: data.metodoPago || 'efectivo',
          concepto: `${data.tipo}: ${data.descripcion}`,
          gastoId: docRef.id,
          notas: data.notas,
          fecha: data.fecha
        };

        // Agregar cuenta origen si se especificó
        if (data.cuentaOrigenId) {
          movimientoData.cuentaOrigen = data.cuentaOrigenId;
        }

        await tesoreriaService.registrarMovimiento(movimientoData, userId);
      }

      // Si el gasto es prorrateable e impacta CTRU, recalcular automáticamente
      if (data.esProrrateable && data.impactaCTRU) {
        try {
          const resultado = await ctruService.recalcularCTRUDinamico();
          if (resultado.unidadesActualizadas > 0) {
            logger.success(
              `CTRU recalculado: ${resultado.unidadesActualizadas} unidades actualizadas, ` +
              `impacto S/ ${resultado.impactoPorUnidad.toFixed(2)} por unidad`
            );
          }
        } catch (ctruError) {
          // No bloquear la creación del gasto si falla el recálculo
          console.error('Error al recalcular CTRU automáticamente:', ctruError);
        }
      }

      return docRef.id;
    } catch (error: any) {
      console.error('Error al crear gasto:', error);
      throw new Error(`Error al crear gasto: ${error.message}`);
    }
  },

  /**
   * Generar número de gasto correlativo según la clase
   * GVD-0001, GVD-0002... para Gastos de Venta y Distribución
   * GAO-0001, GAO-0002... para Gastos Administrativos y Operativos
   */
  async generateNumeroGasto(claseGasto: ClaseGasto = 'GAO'): Promise<string> {
    const snapshot = await getDocs(collection(db, GASTOS_COLLECTION));

    if (snapshot.empty) {
      return `${claseGasto}-0001`;
    }

    // Buscar el número máximo existente para esta clase
    let maxNumber = 0;
    const prefijo = claseGasto;

    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data() as Gasto;
      const numero = data.numeroGasto;

      // Extraer el número del formato XXX-NNNN (donde XXX es GVD o GAO)
      // También soporta el formato antiguo GAS-NNNN para compatibilidad
      const matchNuevo = numero?.match(new RegExp(`^${prefijo}-(\\d+)$`));
      if (matchNuevo) {
        const num = parseInt(matchNuevo[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    });

    return `${claseGasto}-${(maxNumber + 1).toString().padStart(4, '0')}`;
  },

  /**
   * Obtener todos los gastos
   */
  async getAll(): Promise<Gasto[]> {
    try {
      // Obtener sin orderBy para evitar requerir índice compuesto
      const snapshot = await getDocs(collection(db, GASTOS_COLLECTION));

      const gastos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Gasto));

      // Ordenar en memoria por fecha descendente
      return gastos.sort((a, b) => {
        const fechaA = a.fecha?.toMillis?.() || 0;
        const fechaB = b.fecha?.toMillis?.() || 0;
        return fechaB - fechaA;
      });
    } catch (error: any) {
      console.error('Error al obtener gastos:', error);
      throw new Error(`Error al obtener gastos: ${error.message}`);
    }
  },

  /**
   * Obtener un gasto por ID
   */
  async getById(id: string): Promise<Gasto | null> {
    try {
      const docRef = doc(db, GASTOS_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Gasto;
    } catch (error: any) {
      console.error('Error al obtener gasto:', error);
      throw new Error(`Error al obtener gasto: ${error.message}`);
    }
  },

  /**
   * Actualizar un gasto
   */
  async update(id: string, data: Partial<GastoFormData>, userId: string): Promise<void> {
    try {
      const docRef = doc(db, GASTOS_COLLECTION, id);

      // Si cambió el monto o TC, recalcular montoPEN
      let montoPEN: number | undefined;
      if (data.montoOriginal !== undefined || data.tipoCambio !== undefined) {
        const gastoActual = await this.getById(id);
        if (!gastoActual) {
          throw new Error('Gasto no encontrado');
        }

        const montoOriginal = data.montoOriginal ?? gastoActual.montoOriginal;
        const moneda = data.moneda ?? gastoActual.moneda;
        const tipoCambio = data.tipoCambio ?? gastoActual.tipoCambio;

        if (moneda === 'USD') {
          if (!tipoCambio) {
            throw new Error('Debe proporcionar el tipo de cambio para gastos en USD');
          }
          montoPEN = montoOriginal * tipoCambio;
        } else {
          montoPEN = montoOriginal;
        }
      }

      const updateData: any = {
        ...data,
        ...(montoPEN && { montoPEN }),
        ultimaEdicion: Timestamp.now(),
        editadoPor: userId
      };

      // Si cambió la fecha, actualizar mes/año
      if (data.fecha) {
        updateData.mes = data.fecha.getMonth() + 1;
        updateData.anio = data.fecha.getFullYear();
        updateData.fecha = Timestamp.fromDate(data.fecha);
      }

      // Si se marca como pagado, registrar fecha de pago
      if (data.estado === 'pagado') {
        updateData.fechaPago = Timestamp.now();
      }

      await updateDoc(docRef, updateData);
    } catch (error: any) {
      console.error('Error al actualizar gasto:', error);
      throw new Error(`Error al actualizar gasto: ${error.message}`);
    }
  },

  /**
   * Buscar gastos con filtros
   */
  async buscar(filtros: GastoFiltros): Promise<Gasto[]> {
    try {
      let q = query(collection(db, GASTOS_COLLECTION));

      // Aplicar filtros
      if (filtros.claseGasto) {
        q = query(q, where('claseGasto', '==', filtros.claseGasto));
      }
      if (filtros.tipo) {
        q = query(q, where('tipo', '==', filtros.tipo));
      }
      if (filtros.categoria) {
        q = query(q, where('categoria', '==', filtros.categoria));
      }
      if (filtros.mes) {
        q = query(q, where('mes', '==', filtros.mes));
      }
      if (filtros.anio) {
        q = query(q, where('anio', '==', filtros.anio));
      }
      if (filtros.estado) {
        q = query(q, where('estado', '==', filtros.estado));
      }
      if (filtros.esProrrateable !== undefined) {
        q = query(q, where('esProrrateable', '==', filtros.esProrrateable));
      }
      if (filtros.ordenCompraId) {
        q = query(q, where('ordenCompraId', '==', filtros.ordenCompraId));
      }
      if (filtros.ventaId) {
        q = query(q, where('ventaId', '==', filtros.ventaId));
      }
      if (filtros.impactaCTRU !== undefined) {
        q = query(q, where('impactaCTRU', '==', filtros.impactaCTRU));
      }
      if (filtros.moneda) {
        q = query(q, where('moneda', '==', filtros.moneda));
      }

      // Ejecutar query sin orderBy para evitar índices compuestos
      const snapshot = await getDocs(q);

      const gastos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Gasto));

      // Ordenar en memoria por fecha descendente
      return gastos.sort((a, b) => {
        const fechaA = a.fecha?.toMillis?.() || 0;
        const fechaB = b.fecha?.toMillis?.() || 0;
        return fechaB - fechaA;
      });
    } catch (error: any) {
      console.error('Error al buscar gastos:', error);
      throw new Error(`Error al buscar gastos: ${error.message}`);
    }
  },

  /**
   * Obtener gastos de un mes específico
   */
  async getGastosMes(mes: number, anio: number): Promise<Gasto[]> {
    return this.buscar({ mes, anio });
  },

  /**
   * Obtener gastos del mes actual
   */
  async getGastosMesActual(): Promise<Gasto[]> {
    const ahora = new Date();
    return this.getGastosMes(ahora.getMonth() + 1, ahora.getFullYear());
  },

  /**
   * Obtener resumen de gastos de un mes
   */
  async getResumenMes(mes: number, anio: number): Promise<ResumenGastosMes> {
    const gastos = await this.getGastosMes(mes, anio);

    // Totales
    const totalPEN = gastos.reduce((sum, g) => sum + g.montoPEN, 0);
    const totalUSD = gastos
      .filter(g => g.moneda === 'USD')
      .reduce((sum, g) => sum + g.montoOriginal, 0);

    // Prorrateables vs Directos
    const gastosProrrateables = gastos.filter(g => g.esProrrateable).length;
    const montoProrrateable = gastos
      .filter(g => g.esProrrateable)
      .reduce((sum, g) => sum + g.montoPEN, 0);

    const gastosDirectos = gastos.filter(g => !g.esProrrateable).length;
    const montoDirecto = gastos
      .filter(g => !g.esProrrateable)
      .reduce((sum, g) => sum + g.montoPEN, 0);

    // Recurrentes
    const gastosRecurrentes = gastos.filter(g => g.esRecurrente).length;
    const montoRecurrente = gastos
      .filter(g => g.esRecurrente)
      .reduce((sum, g) => sum + g.montoPEN, 0);

    // Por categoría
    const categorias = new Set(gastos.map(g => g.categoria));
    const porCategoria = Array.from(categorias).map(categoria => ({
      categoria,
      totalPEN: gastos
        .filter(g => g.categoria === categoria)
        .reduce((sum, g) => sum + g.montoPEN, 0),
      cantidad: gastos.filter(g => g.categoria === categoria).length
    }));

    // Por tipo
    const tipos = new Set(gastos.map(g => g.tipo));
    const porTipo = Array.from(tipos).map(tipo => ({
      tipo,
      totalPEN: gastos
        .filter(g => g.tipo === tipo)
        .reduce((sum, g) => sum + g.montoPEN, 0),
      cantidad: gastos.filter(g => g.tipo === tipo).length
    }));

    return {
      mes,
      anio,
      totalPEN,
      totalUSD,
      totalGastos: gastos.length,
      gastosProrrateables,
      montoProrrateable,
      gastosDirectos,
      montoDirecto,
      gastosRecurrentes,
      montoRecurrente,
      porCategoria,
      porTipo
    };
  },

  /**
   * Obtener estadísticas globales de gastos
   */
  async getStats(): Promise<GastoStats> {
    const ahora = new Date();
    const mesActual = ahora.getMonth() + 1;
    const anioActual = ahora.getFullYear();

    // Gastos del mes actual
    const gastosMesActual = await this.getGastosMes(mesActual, anioActual);
    const totalMesActual = gastosMesActual.reduce((sum, g) => sum + g.montoPEN, 0);
    const gastosProrrateablesMesActual = gastosMesActual
      .filter(g => g.esProrrateable)
      .reduce((sum, g) => sum + g.montoPEN, 0);
    const gastosDirectosMesActual = gastosMesActual
      .filter(g => !g.esProrrateable)
      .reduce((sum, g) => sum + g.montoPEN, 0);

    // Gastos del año actual
    const gastosAnioActual = await this.buscar({ anio: anioActual });
    const totalAnioActual = gastosAnioActual.reduce((sum, g) => sum + g.montoPEN, 0);
    const mesesConGastos = new Set(gastosAnioActual.map(g => g.mes)).size;
    const promedioMensualAnioActual = mesesConGastos > 0 ? totalAnioActual / mesesConGastos : 0;

    // Gastos pendientes de pago
    const gastosPendientes = await this.buscar({ estado: 'pendiente' });
    const totalPendientePago = gastosPendientes.reduce((sum, g) => sum + g.montoPEN, 0);

    // Mes anterior para comparación
    const mesAnterior = mesActual === 1 ? 12 : mesActual - 1;
    const anioMesAnterior = mesActual === 1 ? anioActual - 1 : anioActual;
    const gastosMesAnterior = await this.getGastosMes(mesAnterior, anioMesAnterior);
    const totalMesAnterior = gastosMesAnterior.reduce((sum, g) => sum + g.montoPEN, 0);

    const variacionVsMesAnterior = totalMesAnterior > 0
      ? ((totalMesActual - totalMesAnterior) / totalMesAnterior) * 100
      : 0;

    const variacionVsPromedioAnual = promedioMensualAnioActual > 0
      ? ((totalMesActual - promedioMensualAnioActual) / promedioMensualAnioActual) * 100
      : 0;

    return {
      totalMesActual,
      gastosProrrateablesMesActual,
      gastosDirectosMesActual,
      cantidadGastosMesActual: gastosMesActual.length,
      totalAnioActual,
      promedioMensualAnioActual,
      totalPendientePago,
      cantidadPendientePago: gastosPendientes.length,
      variacionVsMesAnterior,
      variacionVsPromedioAnual
    };
  },

  /**
   * Marcar gasto como que ya se recalculó el CTRU
   */
  async marcarCTRURecalculado(gastoId: string): Promise<void> {
    try {
      const docRef = doc(db, GASTOS_COLLECTION, gastoId);
      await updateDoc(docRef, {
        ctruRecalculado: true,
        fechaRecalculoCTRU: Timestamp.now()
      });
    } catch (error: any) {
      console.error('Error al marcar CTRU recalculado:', error);
      throw new Error(`Error al marcar CTRU recalculado: ${error.message}`);
    }
  },

  /**
   * Obtener gastos GVD asociados a una venta específica
   * Filtra por ventaId y categorías GV/GD (sin requerir índice compuesto)
   */
  async getGastosVenta(ventaId: string): Promise<Gasto[]> {
    try {
      // Usar solo ventaId para evitar índice compuesto, filtrar en memoria
      const q = query(
        collection(db, GASTOS_COLLECTION),
        where('ventaId', '==', ventaId)
      );

      const snapshot = await getDocs(q);

      // Filtrar en memoria por categoría GV o GD
      return snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Gasto))
        .filter(g => g.categoria === 'GV' || g.categoria === 'GD');
    } catch (error: any) {
      console.error('Error al obtener gastos de venta:', error);
      throw new Error(`Error al obtener gastos de venta: ${error.message}`);
    }
  },

  /**
   * Obtener gastos que impactan CTRU y no han sido recalculados
   */
  async getGastosPendientesRecalculoCTRU(): Promise<Gasto[]> {
    try {
      // Obtener todos los gastos y filtrar en memoria para evitar índices compuestos
      const snapshot = await getDocs(collection(db, GASTOS_COLLECTION));

      const gastos = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Gasto))
        .filter(g => g.impactaCTRU === true && g.ctruRecalculado === false);

      // Ordenar por fecha ascendente en memoria
      return gastos.sort((a, b) => {
        const fechaA = a.fecha?.toMillis?.() || 0;
        const fechaB = b.fecha?.toMillis?.() || 0;
        return fechaA - fechaB;
      });
    } catch (error: any) {
      console.error('Error al obtener gastos pendientes de recálculo:', error);
      throw new Error(`Error al obtener gastos pendientes de recálculo: ${error.message}`);
    }
  }
};
