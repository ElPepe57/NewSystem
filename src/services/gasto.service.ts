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
import type {
  Gasto,
  GastoFormData,
  GastoFiltros,
  ResumenGastosMes,
  GastoStats,
  CategoriaGasto
} from '../types/gasto.types';
import { getClaseGasto } from '../types/gasto.types';
import { ctruService } from './ctru.service';
import { tesoreriaService } from './tesoreria.service';
import type { MetodoTesoreria, MonedaTesoreria } from '../types/tesoreria.types';

const GASTOS_COLLECTION = 'gastos';

export const gastoService = {
  /**
   * Crear un nuevo gasto
   */
  async create(data: GastoFormData, userId: string): Promise<string> {
    try {
      // Generar número de gasto
      const numeroGasto = await this.generateNumeroGasto();

      // Convertir a PEN si es necesario
      let montoPEN = data.montoOriginal;
      if (data.moneda === 'USD') {
        if (!data.tipoCambio) {
          throw new Error('Debe proporcionar el tipo de cambio para gastos en USD');
        }
        montoPEN = data.montoOriginal * data.tipoCambio;
      }

      // Determinar clase de gasto a partir de la categoría
      const claseGasto = getClaseGasto(data.categoria);

      // Crear objeto gasto - solo incluir campos con valor definido
      // Firestore no acepta valores undefined
      const gasto: Record<string, unknown> = {
        numeroGasto,
        tipo: data.tipo,
        categoria: data.categoria,
        claseGasto,
        descripcion: data.descripcion,
        moneda: data.moneda,
        montoOriginal: data.montoOriginal,
        montoPEN,
        esProrrateable: data.esProrrateable,
        mes: data.fecha.getMonth() + 1,
        anio: data.fecha.getFullYear(),
        fecha: Timestamp.fromDate(data.fecha),
        esRecurrente: data.frecuencia !== 'unico',
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
      if (data.frecuencia) gasto.frecuencia = data.frecuencia;
      if (data.proveedor) gasto.proveedor = data.proveedor;
      if (data.responsable) gasto.responsable = data.responsable;
      if (data.metodoPago) gasto.metodoPago = data.metodoPago;
      if (data.estado === 'pagado') gasto.fechaPago = Timestamp.now();
      if (data.numeroComprobante) gasto.numeroComprobante = data.numeroComprobante;
      if (data.notas) gasto.notas = data.notas;

      const docRef = await addDoc(collection(db, GASTOS_COLLECTION), gasto);

      // NOTA: El recálculo automático de CTRU se deshabilitó porque es muy costoso
      // (actualiza todas las unidades y productos). El usuario puede recalcular
      // manualmente desde el botón "Recalcular CTRU" cuando lo necesite.
      // El gasto queda marcado con ctruRecalculado: false para procesarse después.
      if (data.esProrrateable && (data.categoria === 'GA' || data.categoria === 'GO')) {
        console.log('[CTRU] Gasto GA/GO prorrateable creado. Recálculo pendiente (usar botón "Recalcular CTRU").');
      }

      return docRef.id;
    } catch (error: any) {
      console.error('Error al crear gasto:', error);
      throw new Error(`Error al crear gasto: ${error.message}`);
    }
  },

  /**
   * Generar número de gasto correlativo (busca el máximo para evitar duplicados)
   */
  async generateNumeroGasto(): Promise<string> {
    const snapshot = await getDocs(collection(db, GASTOS_COLLECTION));

    if (snapshot.empty) {
      return 'GAS-0001';
    }

    // Buscar el número máximo existente
    let maxNumber = 0;
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data() as Gasto;
      const numero = data.numeroGasto;

      // Extraer el número del formato GAS-NNNN
      const match = numero?.match(/GAS-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    });

    return `GAS-${(maxNumber + 1).toString().padStart(4, '0')}`;
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

      // NOTA: El recálculo automático de CTRU se deshabilitó porque es muy costoso.
      // El usuario puede recalcular manualmente desde el botón "Recalcular CTRU".
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
   * Obtener gastos directos asociados a una venta específica
   */
  async getGastosVenta(ventaId: string): Promise<Gasto[]> {
    try {
      const q = query(
        collection(db, GASTOS_COLLECTION),
        where('ventaId', '==', ventaId)
      );

      const snapshot = await getDocs(q);

      const gastos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Gasto));

      // Ordenar por fecha descendente
      return gastos.sort((a, b) => {
        const fechaA = a.fecha?.toMillis?.() || 0;
        const fechaB = b.fecha?.toMillis?.() || 0;
        return fechaB - fechaA;
      });
    } catch (error: any) {
      console.error('Error al obtener gastos de venta:', error);
      throw new Error(`Error al obtener gastos de venta: ${error.message}`);
    }
  },

  /**
   * Crear múltiples gastos asociados a una venta
   */
  async createGastosVenta(
    ventaId: string,
    gastos: Array<{
      tipo: string;
      categoria: string;
      descripcion: string;
      monto: number;
      ventaNumero?: string;
    }>,
    userId: string
  ): Promise<string[]> {
    try {
      const batch = writeBatch(db);
      const ids: string[] = [];
      const ahora = new Date();

      // Obtener número base para los gastos
      let numeroBase = await this.generateNumeroGasto();
      let baseNum = parseInt(numeroBase.replace('GAS-', ''), 10);

      for (const gasto of gastos) {
        const docRef = doc(collection(db, GASTOS_COLLECTION));
        ids.push(docRef.id);

        const numeroGasto = `GAS-${baseNum.toString().padStart(4, '0')}`;
        baseNum++;

        // Determinar clase de gasto a partir de la categoría
        const claseGasto = getClaseGasto(gasto.categoria as CategoriaGasto);

        batch.set(docRef, {
          numeroGasto,
          tipo: gasto.tipo,
          categoria: gasto.categoria,
          claseGasto,
          descripcion: gasto.descripcion,
          moneda: 'PEN',
          montoOriginal: gasto.monto,
          montoPEN: gasto.monto,
          esProrrateable: false,
          ventaId,
          ventaNumero: gasto.ventaNumero,
          mes: ahora.getMonth() + 1,
          anio: ahora.getFullYear(),
          fecha: Timestamp.fromDate(ahora),
          frecuencia: 'unico',
          esRecurrente: false,
          estado: 'pendiente',  // Pendiente para ser pagado desde Gastos con trazabilidad completa
          impactaCTRU: false,
          ctruRecalculado: false,
          creadoPor: userId,
          fechaCreacion: Timestamp.now()
        });
      }

      await batch.commit();
      return ids;
    } catch (error: any) {
      console.error('Error al crear gastos de venta:', error);
      throw new Error(`Error al crear gastos de venta: ${error.message}`);
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
  },

  /**
   * Registrar pago de un gasto pendiente
   * Crea un movimiento de tesorería y actualiza el estado del gasto
   */
  async registrarPago(
    gastoId: string,
    data: {
      fechaPago: Date;
      monedaPago: MonedaTesoreria;
      montoPago: number;
      tipoCambio: number;
      metodoPago: MetodoTesoreria;
      cuentaOrigenId: string;
      referenciaPago?: string;
      notas?: string;
    },
    userId: string
  ): Promise<void> {
    try {
      // Obtener el gasto
      const gasto = await this.getById(gastoId);
      if (!gasto) {
        throw new Error('Gasto no encontrado');
      }

      if (gasto.estado === 'pagado') {
        throw new Error('Este gasto ya está pagado');
      }

      // Registrar movimiento de tesorería (egreso)
      await tesoreriaService.registrarMovimiento({
        tipo: 'gasto_operativo',
        moneda: data.monedaPago,
        monto: data.montoPago,
        tipoCambio: data.tipoCambio,
        metodo: data.metodoPago,
        concepto: `Pago ${gasto.numeroGasto}: ${gasto.descripcion}`,
        fecha: data.fechaPago,
        cuentaOrigen: data.cuentaOrigenId,
        gastoId: gastoId,
        gastoNumero: gasto.numeroGasto,
        referencia: data.referenciaPago,
        notas: data.notas
      }, userId);

      // Actualizar el gasto a estado pagado
      const docRef = doc(db, GASTOS_COLLECTION, gastoId);
      const updateData: Record<string, any> = {
        estado: 'pagado',
        fechaPago: Timestamp.fromDate(data.fechaPago),
        metodoPago: data.metodoPago,
        cuentaOrigenId: data.cuentaOrigenId,
        monedaPago: data.monedaPago,
        montoPagado: data.montoPago,
        tipoCambioPago: data.tipoCambio,
        ultimaEdicion: Timestamp.now(),
        editadoPor: userId
      };

      // Solo agregar campos opcionales si tienen valor (Firebase no acepta undefined)
      if (data.referenciaPago) updateData.referenciaPago = data.referenciaPago;
      if (data.notas) updateData.notasPago = data.notas;

      await updateDoc(docRef, updateData);

      // Registrar TC de la transacción si el gasto original era en USD
      if (gasto.moneda === 'USD') {
        await tesoreriaService.registrarTCTransaccion(
          'gasto',
          gastoId,
          gasto.numeroGasto,
          'pago',
          gasto.montoOriginal,
          data.tipoCambio,
          userId
        );
      }
    } catch (error: any) {
      console.error('Error al registrar pago de gasto:', error);
      throw new Error(`Error al registrar pago: ${error.message}`);
    }
  },

  /**
   * Crear gasto GD (Gasto de Distribución) automático desde una entrega
   * Se crea cuando una entrega es exitosa
   */
  async crearGastoDistribucion(data: {
    entregaId: string;
    entregaCodigo: string;
    ventaId: string;
    ventaNumero: string;
    transportistaId: string;
    transportistaNombre: string;
    costoEntrega: number;
    distrito?: string;
  }, userId: string): Promise<string> {
    try {
      const numeroGasto = await this.generateNumeroGasto();
      const ahora = new Date();

      // GD = Gasto de Distribución (delivery)
      const claseGasto = getClaseGasto('GD');

      const gasto: Record<string, unknown> = {
        numeroGasto,
        tipo: 'delivery',
        categoria: 'GD',
        claseGasto,
        descripcion: `Entrega ${data.entregaCodigo} - ${data.transportistaNombre}${data.distrito ? ` (${data.distrito})` : ''}`,
        moneda: 'PEN',
        montoOriginal: data.costoEntrega,
        montoPEN: data.costoEntrega,
        esProrrateable: false,
        ventaId: data.ventaId,
        ventaNumero: data.ventaNumero,
        entregaId: data.entregaId,
        entregaCodigo: data.entregaCodigo,
        transportistaId: data.transportistaId,
        transportistaNombre: data.transportistaNombre,
        mes: ahora.getMonth() + 1,
        anio: ahora.getFullYear(),
        fecha: Timestamp.fromDate(ahora),
        frecuencia: 'unico',
        esRecurrente: false,
        // Pendiente de pago al transportista
        estado: 'pendiente',
        // GD no impacta CTRU (es gasto directo de venta)
        impactaCTRU: false,
        ctruRecalculado: false,
        proveedor: data.transportistaNombre,
        notas: `Gasto de distribución generado automáticamente por entrega ${data.entregaCodigo}`,
        creadoPor: userId,
        fechaCreacion: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, GASTOS_COLLECTION), gasto);

      console.log(`[Gasto GD] Creado ${numeroGasto} por S/${data.costoEntrega.toFixed(2)} - Entrega ${data.entregaCodigo} - VentaId: ${data.ventaId}`);

      return docRef.id;
    } catch (error: any) {
      console.error('Error al crear gasto de distribución:', error);
      throw new Error(`Error al crear gasto de distribución: ${error.message}`);
    }
  }
};
