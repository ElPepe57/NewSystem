import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  Timestamp,
  writeBatch,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  Gasto,
  GastoFormData,
  GastoFiltros,
  ResumenGastosMes,
  GastoStats,
  CategoriaGasto,
  PagoGasto
} from '../types/gasto.types';
import { getClaseGasto } from '../types/gasto.types';
import { ctruService } from './ctru.service';
import { tesoreriaService } from './tesoreria.service';
// poolUSDService + TipoMovimientoPool: eliminados — tesorería registra automáticamente en Pool USD
import type { MetodoTesoreria, MonedaTesoreria } from '../types/tesoreria.types';
import { actividadService } from './actividad.service';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import { logBackgroundError } from '../lib/logger';
import { logger } from '../lib/logger';

const GASTOS_COLLECTION = COLLECTIONS.GASTOS;

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
      if (data.lineaNegocioId !== undefined) {
        gasto.lineaNegocioId = data.lineaNegocioId;
      }
      if (data.lineaNegocioNombre !== undefined) {
        gasto.lineaNegocioNombre = data.lineaNegocioNombre;
      }

      const docRef = await addDoc(collection(db, GASTOS_COLLECTION), gasto);

      // Si el gasto se crea directamente como "pagado" con cuenta de origen,
      // registrar el movimiento de tesorería y crear el registro de pago
      if (data.estado === 'pagado' && data.cuentaOrigenId) {
        try {
          const monedaPago: MonedaTesoreria = (data.moneda === 'USD' ? 'USD' : 'PEN') as MonedaTesoreria;
          const movimientoId = await tesoreriaService.registrarMovimiento({
            tipo: 'gasto_operativo',
            moneda: monedaPago,
            monto: data.montoOriginal,
            tipoCambio: data.tipoCambio || 1,
            metodo: (data.metodoPago || 'efectivo') as MetodoTesoreria,
            concepto: `Pago ${numeroGasto}: ${data.descripcion}`,
            fecha: data.fecha,
            cuentaOrigen: data.cuentaOrigenId,
            gastoId: docRef.id,
            gastoNumero: numeroGasto,
            referencia: data.referenciaPago,
            notas: data.notas
          }, userId);

          // Crear registro de pago en el gasto
          const pagoId = `PAG-GAS-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          const nuevoPago: PagoGasto = {
            id: pagoId,
            fecha: Timestamp.fromDate(data.fecha),
            monedaPago: monedaPago,
            montoOriginal: data.montoOriginal,
            montoUSD: data.moneda === 'USD' ? data.montoOriginal : data.montoOriginal / (data.tipoCambio || 1),
            montoPEN: montoPEN,
            tipoCambio: data.tipoCambio || 1,
            metodoPago: (data.metodoPago || 'efectivo') as MetodoTesoreria,
            registradoPor: userId,
            fechaRegistro: Timestamp.now()
          };
          if (data.cuentaOrigenId) nuevoPago.cuentaOrigenId = data.cuentaOrigenId;
          if (movimientoId) nuevoPago.movimientoTesoreriaId = movimientoId;
          if (data.referenciaPago) nuevoPago.referencia = data.referenciaPago;

          await updateDoc(doc(db, GASTOS_COLLECTION, docRef.id), {
            pagos: [nuevoPago],
            montoPagado: montoPEN,
            montoPendiente: 0
          });
        } catch (tesoreriaError) {
          logger.error('Error registrando movimiento en tesorería al crear gasto pagado:', tesoreriaError);
          // No bloquear la creación del gasto, pero logear el error
        }

        // Pool USD: NO registrar aquí — tesorería.movimientos.service lo hace automáticamente
        // al recibir un movimiento tipo 'gasto_operativo' en USD.
        // Registrarlo aquí causaba DOBLE REGISTRO en Pool USD.
      }

      // Auto-recálculo de CTRU cuando se crea un gasto GA/GO prorrateable
      // Se ejecuta en background (no bloquea la creación del gasto)
      if (data.esProrrateable && (data.categoria === 'GA' || data.categoria === 'GO')) {
        ctruService.recalcularCTRUDinamicoSafe()
          .then(result => {
            if (result) {
              logger.log(`[CTRU] Auto-recálculo completado: ${result.unidadesActualizadas} unidades actualizadas, ${result.gastosAplicados} gastos aplicados`);
            } else {
              logger.log('[CTRU] Auto-recálculo encolado (otro en ejecución)');
            }
          })
          .catch(error => {
            logger.error('[CTRU] Error en auto-recálculo (no bloqueante):', error);
            logBackgroundError('ctru.recalcPostGasto', error, 'critical', { gastoCategoria: data.categoria, esProrrateable: data.esProrrateable });
          });
      }

      // Broadcast actividad (fire-and-forget)
      actividadService.registrar({
        tipo: 'gasto_creado',
        mensaje: `Gasto ${numeroGasto} creado: ${data.descripcion} - ${data.moneda} ${data.montoOriginal.toFixed(2)}`,
        userId,
        displayName: userId,
        metadata: { entidadId: docRef.id, entidadTipo: 'gasto', monto: data.montoOriginal, moneda: data.moneda }
      }).catch(() => {});

      return docRef.id;
    } catch (error: any) {
      logger.error('Error al crear gasto:', error);
      throw new Error(`Error al crear gasto: ${error.message}`);
    }
  },

  /**
   * Generar número de gasto usando contador atómico.
   * Formato: GAS-NNNN (ej: GAS-0043)
   * Usa runTransaction para evitar duplicados en acceso concurrente.
   */
  async generateNumeroGasto(): Promise<string> {
    return getNextSequenceNumber('GAS', 4);
  },

  /**
   * Obtener todos los gastos
   */
  async getAll(): Promise<Gasto[]> {
    try {
      // Obtener sin orderBy para evitar requerir índice compuesto — limit de seguridad
      const snapshot = await getDocs(query(
        collection(db, GASTOS_COLLECTION),
        limit(1000)
      ));

      // Normalizar campos numéricos: documentos históricos o de prueba pueden no tener montoPEN
      const gastos = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          montoPEN: typeof data.montoPEN === 'number' ? data.montoPEN : (data.montoOriginal || 0),
          montoUSD: typeof data.montoUSD === 'number' ? data.montoUSD : 0,
        } as Gasto;
      });

      // Ordenar en memoria por fecha descendente
      return gastos.sort((a, b) => {
        const fechaA = a.fecha?.toMillis?.() || 0;
        const fechaB = b.fecha?.toMillis?.() || 0;
        return fechaB - fechaA;
      });
    } catch (error: any) {
      logger.error('Error al obtener gastos:', error);
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
      logger.error('Error al obtener gasto:', error);
      throw new Error(`Error al obtener gasto: ${error.message}`);
    }
  },

  /**
   * Actualizar un gasto
   */
  async update(id: string, data: Partial<GastoFormData>, userId: string): Promise<void> {
    try {
      const docRef = doc(db, GASTOS_COLLECTION, id);

      // Siempre obtener el gasto actual para detectar transiciones de estado
      const gastoActual = await this.getById(id);
      if (!gastoActual) {
        throw new Error('Gasto no encontrado');
      }

      // Recalcular montoPEN
      const montoOriginal = data.montoOriginal ?? gastoActual.montoOriginal;
      const moneda = data.moneda ?? gastoActual.moneda;
      const tipoCambio = data.tipoCambio ?? gastoActual.tipoCambio;
      let montoPEN: number;

      if (moneda === 'USD') {
        if (!tipoCambio) {
          throw new Error('Debe proporcionar el tipo de cambio para gastos en USD');
        }
        montoPEN = montoOriginal * tipoCambio;
      } else {
        montoPEN = montoOriginal;
      }

      // Limpiar campos internos que no deben ir al updateData
      const { cuentaOrigenId, referenciaPago, ...dataParaFirestore } = data as any;

      const updateData: any = {
        ...dataParaFirestore,
        montoPEN,
        ultimaEdicion: Timestamp.now(),
        editadoPor: userId
      };

      // Si cambió la fecha, actualizar mes/año
      if (data.fecha) {
        updateData.mes = data.fecha.getMonth() + 1;
        updateData.anio = data.fecha.getFullYear();
        updateData.fecha = Timestamp.fromDate(data.fecha);
      }

      // --- TRANSICIONES DE ESTADO CON TESORERÍA ---
      const oldEstado = gastoActual.estado;
      const newEstado = data.estado ?? oldEstado;
      const isLegacyPagado = oldEstado === 'pagado' && (!gastoActual.pagos || gastoActual.pagos.length === 0);
      const tienePagosMultiples = (gastoActual.pagos?.length || 0) > 1;

      // Bloquear cambios de estado/monto en gastos con múltiples pagos parciales
      if (tienePagosMultiples && (data.estado !== undefined && data.estado !== oldEstado)) {
        throw new Error('No se puede cambiar el estado de un gasto con múltiples pagos parciales. Use la opción de pago para gestionar pagos individuales.');
      }
      if (tienePagosMultiples && (data.montoOriginal !== undefined && data.montoOriginal !== gastoActual.montoOriginal)) {
        throw new Error('No se puede cambiar el monto de un gasto con múltiples pagos parciales.');
      }

      // CASO A: X → pagado (crear movimiento de tesorería)
      if (newEstado === 'pagado' && (oldEstado !== 'pagado' || isLegacyPagado)) {
        updateData.fechaPago = Timestamp.now();

        if (cuentaOrigenId) {
          const monedaPago: MonedaTesoreria = (moneda === 'USD' ? 'USD' : 'PEN') as MonedaTesoreria;
          const movimientoId = await tesoreriaService.registrarMovimiento({
            tipo: 'gasto_operativo',
            moneda: monedaPago,
            monto: montoOriginal,
            tipoCambio: tipoCambio || 1,
            metodo: (data.metodoPago || 'efectivo') as MetodoTesoreria,
            concepto: `Pago ${gastoActual.numeroGasto}: ${data.descripcion ?? gastoActual.descripcion}`,
            fecha: data.fecha ?? gastoActual.fecha.toDate(),
            cuentaOrigen: cuentaOrigenId,
            gastoId: id,
            gastoNumero: gastoActual.numeroGasto,
            referencia: referenciaPago,
            notas: data.notas ?? gastoActual.notas
          }, userId);

          const nuevoPago = this._buildPagoGasto({
            monedaPago, montoOriginal, montoPEN, moneda, tipoCambio: tipoCambio || 1,
            metodoPago: data.metodoPago, cuentaOrigenId, referenciaPago,
            fecha: data.fecha ?? gastoActual.fecha.toDate(),
            movimientoId, userId
          });

          updateData.pagos = [nuevoPago];
          updateData.montoPagado = montoPEN;
          updateData.montoPendiente = 0;
        }
      }
      // CASO B: pagado → pendiente (reversar pago)
      else if (oldEstado === 'pagado' && newEstado === 'pendiente') {
        // Anular movimientos de tesorería existentes
        if (gastoActual.pagos && gastoActual.pagos.length > 0) {
          for (const pago of gastoActual.pagos) {
            if (pago.movimientoTesoreriaId) {
              try {
                await tesoreriaService.eliminarMovimiento(pago.movimientoTesoreriaId, userId, true);
              } catch (err) {
                logger.warn(`Error anulando movimiento ${pago.movimientoTesoreriaId}:`, err);
              }
            }
          }
        }
        updateData.pagos = [];
        updateData.montoPagado = 0;
        updateData.montoPendiente = montoPEN;
        updateData.fechaPago = deleteField();
      }
      // CASO C: pagado → pagado (editar gasto pagado — monto, cuenta, método)
      else if (oldEstado === 'pagado' && newEstado === 'pagado' && !isLegacyPagado && !tienePagosMultiples) {
        const pagoExistente = gastoActual.pagos?.[0];

        // Detectar si cambió algo relevante para tesorería
        const cambioMonto = data.montoOriginal !== undefined && data.montoOriginal !== gastoActual.montoOriginal;
        const cambioCuenta = cuentaOrigenId && pagoExistente?.cuentaOrigenId && cuentaOrigenId !== pagoExistente.cuentaOrigenId;
        const cambioMetodo = data.metodoPago && pagoExistente?.metodoPago && data.metodoPago !== pagoExistente.metodoPago;
        const cambioMoneda = data.moneda !== undefined && data.moneda !== gastoActual.moneda;
        const cambioTC = data.tipoCambio !== undefined && data.tipoCambio !== gastoActual.tipoCambio;

        if (cambioMonto || cambioCuenta || cambioMetodo || cambioMoneda || cambioTC) {
          // Anular movimiento viejo
          if (pagoExistente?.movimientoTesoreriaId) {
            try {
              await tesoreriaService.eliminarMovimiento(pagoExistente.movimientoTesoreriaId, userId, true);
            } catch (err) {
              logger.warn('Error anulando movimiento viejo:', err);
            }
          }

          // Crear movimiento nuevo con datos actualizados
          const cuentaFinal = cuentaOrigenId || pagoExistente?.cuentaOrigenId;
          if (cuentaFinal) {
            const monedaPago: MonedaTesoreria = (moneda === 'USD' ? 'USD' : 'PEN') as MonedaTesoreria;
            const nuevoMovId = await tesoreriaService.registrarMovimiento({
              tipo: 'gasto_operativo',
              moneda: monedaPago,
              monto: montoOriginal,
              tipoCambio: tipoCambio || 1,
              metodo: (data.metodoPago || pagoExistente?.metodoPago || 'efectivo') as MetodoTesoreria,
              concepto: `Pago ${gastoActual.numeroGasto}: ${data.descripcion ?? gastoActual.descripcion}`,
              fecha: data.fecha ?? gastoActual.fecha.toDate(),
              cuentaOrigen: cuentaFinal,
              gastoId: id,
              gastoNumero: gastoActual.numeroGasto,
              referencia: referenciaPago || pagoExistente?.referencia,
              notas: data.notas ?? gastoActual.notas
            }, userId);

            const nuevoPago = this._buildPagoGasto({
              monedaPago, montoOriginal, montoPEN, moneda, tipoCambio: tipoCambio || 1,
              metodoPago: data.metodoPago || pagoExistente?.metodoPago,
              cuentaOrigenId: cuentaFinal,
              referenciaPago: referenciaPago || pagoExistente?.referencia,
              fecha: data.fecha ?? gastoActual.fecha.toDate(),
              movimientoId: nuevoMovId, userId
            });

            updateData.pagos = [nuevoPago];
            updateData.montoPagado = montoPEN;
            updateData.montoPendiente = 0;
          }
        }
      }
      // CASO D: sin cambio de estado, solo campos básicos → no tocar tesorería

      // Limpiar valores undefined que Firestore no acepta
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await updateDoc(docRef, updateData);

    } catch (error: any) {
      logger.error('Error al actualizar gasto:', error);
      throw new Error(`Error al actualizar gasto: ${error.message}`);
    }
  },

  /**
   * Helper: construir objeto PagoGasto
   */
  _buildPagoGasto(params: {
    monedaPago: MonedaTesoreria;
    montoOriginal: number;
    montoPEN: number;
    moneda: string;
    tipoCambio: number;
    metodoPago?: string;
    cuentaOrigenId?: string;
    referenciaPago?: string;
    fecha: Date;
    movimientoId: string;
    userId: string;
  }): PagoGasto {
    const pagoId = `PAG-GAS-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const pago: PagoGasto = {
      id: pagoId,
      fecha: Timestamp.fromDate(params.fecha),
      monedaPago: params.monedaPago,
      montoOriginal: params.montoOriginal,
      montoUSD: params.moneda === 'USD' ? params.montoOriginal : params.montoOriginal / (params.tipoCambio || 1),
      montoPEN: params.montoPEN,
      tipoCambio: params.tipoCambio || 1,
      metodoPago: (params.metodoPago || 'efectivo') as MetodoTesoreria,
      registradoPor: params.userId,
      fechaRegistro: Timestamp.now()
    };
    if (params.cuentaOrigenId) pago.cuentaOrigenId = params.cuentaOrigenId;
    if (params.movimientoId) pago.movimientoTesoreriaId = params.movimientoId;
    if (params.referenciaPago) pago.referencia = params.referenciaPago;
    return pago;
  },

  /**
   * Eliminar un gasto
   * Solo se permite eliminar gastos en estado pendiente o cancelado.
   * Gastos con pagos registrados no se pueden eliminar.
   */
  async delete(id: string): Promise<void> {
    try {
      const gasto = await this.getById(id);
      if (!gasto) {
        throw new Error('Gasto no encontrado');
      }

      if (gasto.estado === 'pagado') {
        throw new Error('No se puede eliminar un gasto que ya fue pagado');
      }

      if (gasto.estado === 'parcial') {
        throw new Error('No se puede eliminar un gasto con pagos parciales registrados');
      }

      if (gasto.pagos && gasto.pagos.length > 0) {
        throw new Error('No se puede eliminar un gasto que tiene pagos registrados');
      }

      // Archivar antes de eliminar
      const gastoSnap = await getDoc(doc(db, GASTOS_COLLECTION, id));
      if (gastoSnap.exists()) {
        await addDoc(collection(db, 'gastosArchivo'), {
          ...gastoSnap.data(), gastoOriginalId: id, fechaArchivo: Timestamp.now(), motivoArchivo: 'eliminado'
        });
      }

      const docRef = doc(db, GASTOS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error: any) {
      logger.error('Error al eliminar gasto:', error);
      throw new Error(`Error al eliminar gasto: ${error.message}`);
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

      // Normalizar montoPEN: documentos históricos pueden no tener el campo
      const gastos = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          montoPEN: typeof data.montoPEN === 'number' ? data.montoPEN : (data.montoOriginal || 0),
          montoUSD: typeof data.montoUSD === 'number' ? data.montoUSD : 0,
        } as Gasto;
      });

      // Ordenar en memoria por fecha descendente
      return gastos.sort((a, b) => {
        const fechaA = a.fecha?.toMillis?.() || 0;
        const fechaB = b.fecha?.toMillis?.() || 0;
        return fechaB - fechaA;
      });
    } catch (error: any) {
      logger.error('Error al buscar gastos:', error);
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

    // Gastos pendientes de pago (incluye pendientes + parciales)
    const gastosPendientes = await this.buscar({ estado: 'pendiente' });
    const gastosParciales = await this.buscar({ estado: 'parcial' });
    const todosConDeuda = [...gastosPendientes, ...gastosParciales];
    const totalPendientePago = todosConDeuda.reduce((sum, g) => {
      // Para parciales, usar montoPendiente; para pendientes, usar montoPEN completo
      if (g.estado === 'parcial' && g.montoPendiente !== undefined) {
        return sum + g.montoPendiente;
      }
      return sum + g.montoPEN;
    }, 0);

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
      cantidadPendientePago: todosConDeuda.length,
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
      logger.error('Error al marcar CTRU recalculado:', error);
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
      logger.error('Error al obtener gastos de venta:', error);
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
      logger.error('Error al crear gastos de venta:', error);
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
        .filter(g => (g.categoria === 'GA' || g.categoria === 'GO') && g.ctruRecalculado === false);

      // Ordenar por fecha ascendente en memoria
      return gastos.sort((a, b) => {
        const fechaA = a.fecha?.toMillis?.() || 0;
        const fechaB = b.fecha?.toMillis?.() || 0;
        return fechaA - fechaB;
      });
    } catch (error: any) {
      logger.error('Error al obtener gastos pendientes de recálculo:', error);
      throw new Error(`Error al obtener gastos pendientes de recálculo: ${error.message}`);
    }
  },

  /**
   * Registrar pago de un gasto (soporta pagos parciales)
   * Crea un movimiento de tesorería, registra el pago en el array pagos[]
   * y actualiza montoPagado/montoPendiente/estado
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

      // Permitir gastos "pagados" sin pagos[] registrados (corrección retroactiva)
      const esPagadoSinRegistro = gasto.estado === 'pagado' && (!gasto.pagos || gasto.pagos.length === 0);
      if (gasto.estado === 'pagado' && !esPagadoSinRegistro) {
        throw new Error('Este gasto ya está pagado');
      }

      if (gasto.estado === 'cancelado') {
        throw new Error('No se puede pagar un gasto cancelado');
      }

      if (data.montoPago <= 0) {
        throw new Error('El monto debe ser mayor a 0');
      }

      // Calcular monto pendiente actual desde pagos existentes
      const pagosAnteriores: PagoGasto[] = gasto.pagos || [];
      const montoPagadoAnterior = pagosAnteriores.reduce((sum, p) => sum + p.montoPEN, 0);
      const montoPendienteActual = gasto.montoPEN - montoPagadoAnterior;

      // Calcular equivalencias de ESTE pago
      const montoUSD = data.monedaPago === 'USD'
        ? data.montoPago
        : data.montoPago / data.tipoCambio;
      const montoPENPago = data.monedaPago === 'PEN'
        ? data.montoPago
        : data.montoPago * data.tipoCambio;

      // Validar que no exceda el saldo pendiente
      if (montoPENPago > montoPendienteActual + 0.01) {
        throw new Error(
          `El monto excede el saldo pendiente. Pendiente: S/ ${montoPendienteActual.toFixed(2)}`
        );
      }

      // Calcular nuevos totales
      const nuevoMontoPagado = montoPagadoAnterior + montoPENPago;
      const nuevoMontoPendiente = gasto.montoPEN - nuevoMontoPagado;
      const nuevoEstado = nuevoMontoPendiente <= 0.01 ? 'pagado' : 'parcial';
      const esPagoCompleto = nuevoEstado === 'pagado';

      // Crear registro de pago (PagoGasto)
      const pagoId = `PAG-GAS-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const nuevoPago: PagoGasto = {
        id: pagoId,
        fecha: Timestamp.fromDate(data.fechaPago),
        monedaPago: data.monedaPago,
        montoOriginal: data.montoPago,
        montoUSD,
        montoPEN: montoPENPago,
        tipoCambio: data.tipoCambio,
        metodoPago: data.metodoPago,
        registradoPor: userId,
        fechaRegistro: Timestamp.now()
      };

      // Agregar campos opcionales solo si tienen valor
      if (data.cuentaOrigenId) nuevoPago.cuentaOrigenId = data.cuentaOrigenId;
      if (data.referenciaPago) nuevoPago.referencia = data.referenciaPago;
      if (data.notas) nuevoPago.notas = data.notas;

      // Registrar movimiento de tesorería (egreso)
      try {
        const movimientoId = await tesoreriaService.registrarMovimiento({
          tipo: 'gasto_operativo',
          moneda: data.monedaPago,
          monto: data.montoPago,
          tipoCambio: data.tipoCambio,
          metodo: data.metodoPago,
          concepto: `Pago ${esPagoCompleto ? '' : 'parcial '}${gasto.numeroGasto}: ${gasto.descripcion}`,
          fecha: data.fechaPago,
          cuentaOrigen: data.cuentaOrigenId,
          gastoId: gastoId,
          gastoNumero: gasto.numeroGasto,
          referencia: data.referenciaPago,
          notas: data.notas
        }, userId);

        if (movimientoId) {
          nuevoPago.movimientoTesoreriaId = movimientoId;
        }
      } catch (tesoreriaError) {
        logger.error('Error registrando movimiento en tesorería:', tesoreriaError);
        // No bloquear el pago — marcar para reconciliación posterior
        nuevoPago.errorTesoreria = true;
        nuevoPago.errorTesoreriaMsg = tesoreriaError instanceof Error ? tesoreriaError.message : 'Error desconocido';
      }

      // Pool USD: NO registrar aquí — tesorería.movimientos.service lo hace automáticamente
      // al recibir un movimiento tipo 'gasto_operativo' en USD.
      // Registrarlo aquí causaba DOBLE REGISTRO en Pool USD.

      // Actualizar el gasto en Firestore
      const docRef = doc(db, GASTOS_COLLECTION, gastoId);
      const updateData: Record<string, any> = {
        estado: nuevoEstado,
        pagos: [...pagosAnteriores, nuevoPago],
        montoPagado: nuevoMontoPagado,
        montoPendiente: Math.max(0, nuevoMontoPendiente),
        ultimaEdicion: Timestamp.now(),
        editadoPor: userId
      };

      // Si se completó el pago, escribir campos legacy para compat
      if (esPagoCompleto) {
        updateData.fechaPago = Timestamp.fromDate(data.fechaPago);
        updateData.metodoPago = data.metodoPago;
      }

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
      logger.error('Error al registrar pago de gasto:', error);
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
    /** Descripción personalizada (para costos extra) */
    descripcionExtra?: string;
  }, userId: string): Promise<string> {
    try {
      // Idempotency check: si ya existe un gasto GD para esta entrega, retornar su ID
      const existingQ = query(
        collection(db, GASTOS_COLLECTION),
        where('entregaId', '==', data.entregaId),
        where('tipo', '==', 'delivery')
      );
      const existingSnap = await getDocs(existingQ);
      if (!existingSnap.empty) {
        const existingId = existingSnap.docs[0].id;
        logger.warn(`[Gasto GD] Ya existe gasto para entrega ${data.entregaCodigo}: ${existingId} — omitiendo duplicado`);
        return existingId;
      }

      const numeroGasto = await this.generateNumeroGasto();
      const ahora = new Date();

      // GD = Gasto de Distribución (delivery)
      const claseGasto = getClaseGasto('GD');

      const descripcionBase = `Entrega ${data.entregaCodigo} - ${data.transportistaNombre}${data.distrito ? ` (${data.distrito})` : ''}`;

      const gasto: Record<string, unknown> = {
        numeroGasto,
        tipo: 'delivery',
        categoria: 'GD',
        claseGasto,
        descripcion: data.descripcionExtra
          ? `${descripcionBase} - ${data.descripcionExtra}`
          : descripcionBase,
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
        notas: data.descripcionExtra
          ? `Costo adicional: ${data.descripcionExtra} - Entrega ${data.entregaCodigo}`
          : `Gasto de distribución generado automáticamente por entrega ${data.entregaCodigo}`,
        creadoPor: userId,
        fechaCreacion: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, GASTOS_COLLECTION), gasto);

      logger.log(`[Gasto GD] Creado ${numeroGasto} por S/${data.costoEntrega.toFixed(2)} - Entrega ${data.entregaCodigo} - VentaId: ${data.ventaId}`);

      return docRef.id;
    } catch (error: any) {
      logger.error('Error al crear gasto de distribución:', error);
      throw new Error(`Error al crear gasto de distribución: ${error.message}`);
    }
  }
};
