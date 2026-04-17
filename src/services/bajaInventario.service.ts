import { doc, updateDoc, collection, addDoc, getDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { gastoService } from './gasto.service';
import type { DisposicionDanada, ResponsableDano, IncidenciaEnvio } from '../types/envio.types';
import type { EstadoUnidad, DisposicionVencida, Unidad } from '../types/unidad.types';
import type { TipoGasto } from '../types/gasto.types';

/**
 * Datos para registrar una baja de inventario por daño
 */
export interface BajaDanoData {
  unidadId: string;
  envioId: string;
  incidenciaId: string;
  productoId: string;
  productoNombre: string;
  sku: string;
  disposicion: DisposicionDanada;
  motivo: string;
  responsable: ResponsableDano;
  costoUnidadPEN: number;  // ctruInicial o costoBase de la unidad
  costoUnidadUSD?: number;
  evidenciaURL?: string;
}

/**
 * Resultado de una baja procesada
 */
export interface BajaResultado {
  unidadId: string;
  nuevoEstado: EstadoUnidad;
  gastoGenerado?: string; // ID del gasto si se generó
  reclamoGenerado?: boolean;
}

/**
 * Servicio de baja de inventario por daño en transferencia
 * Cuenta contable: 6952 - Desmedros (PCGE Perú / NIC 2)
 */
export const bajaInventarioService = {

  /**
   * Registra la baja de una unidad dañada
   * - Actualiza estado de la unidad
   * - Genera gasto contable si es baja definitiva (usa gastoService.create con categoría válida)
   * - Marca la incidencia como resuelta
   * - Si disposición = devolucion_proveedor → reclamoGenerado=true (el caller abre ReclamoPanel)
   *
   * S40 Bloque C — fixes:
   *  - DATA-001: si `costoUnidadPEN` viene 0/undefined, lee `ctruDinamico` del doc Unidad.
   *  - DATA-003/004/005: usa `gastoService.create` (categoría GV válida), no addDoc directo.
   */
  async registrarBajaPorDano(
    data: BajaDanoData,
    userId: string
  ): Promise<BajaResultado> {
    const now = Timestamp.now();
    let nuevoEstado: EstadoUnidad;
    let gastoId: string | undefined;

    // 0. Leer la unidad real. Sirve para:
    //    - Fallback de costo si el caller pasó 0 (DATA-001)
    //    - Validar que la unidad existe antes de actualizar
    const unidadRef = doc(db, COLLECTIONS.UNIDADES, data.unidadId);
    const unidadSnap = await getDoc(unidadRef);
    if (!unidadSnap.exists()) {
      throw new Error(`Unidad ${data.unidadId} no encontrada`);
    }
    const unidadDoc = unidadSnap.data() as Unidad;

    // Costo efectivo: prefiere el que pasa el caller; si viene 0 usa ctruDinamico del doc.
    const costoEfectivoPEN = (data.costoUnidadPEN && data.costoUnidadPEN > 0)
      ? data.costoUnidadPEN
      : (unidadDoc.ctruDinamico || unidadDoc.ctruInicial || 0);

    // 1. Determinar nuevo estado según disposición
    switch (data.disposicion) {
      case 'baja_definitiva':
        nuevoEstado = 'baja';
        break;
      case 'devolucion_proveedor':
        nuevoEstado = 'perdida'; // S39: 'en_reclamo' legacy → usar 'perdida' con flag de reclamo
        break;
      case 'reparacion_reingreso':
        nuevoEstado = 'disponible'; // S39: 'disponible_peru' legacy eliminado
        break;
    }

    // 2. Actualizar estado de la unidad
    await updateDoc(unidadRef, {
      estado: nuevoEstado,
      disposicionDano: data.disposicion,
      disposicionMotivo: data.motivo,
      disposicionPor: userId,
      disposicionFecha: now,
      ultimaEdicion: now,
    });

    // 3. Generar gasto contable si es baja definitiva o sin responsable identificado
    //    (DATA-003: usar gastoService.create con categoria GV válida — no addDoc directo)
    if (data.disposicion === 'baja_definitiva' ||
        (data.disposicion === 'devolucion_proveedor' && data.responsable === 'sin_responsable')) {
      if (costoEfectivoPEN <= 0) {
        logger.warn(`Baja unidad ${data.sku}: costo 0, gasto NO generado. Revisar ctruDinamico de la unidad.`);
      } else {
        try {
          const tipoGasto: TipoGasto = 'merma_transferencia';
          gastoId = await gastoService.create(
            {
              tipo: tipoGasto,
              categoria: 'GV',                // S40: categoría válida (antes: 'operativo' inválido)
              descripcion: `Baja por daño ${data.sku} — ${data.productoNombre}. Disposición: ${data.disposicion}. ${data.motivo}`,
              moneda: 'PEN',
              montoOriginal: costoEfectivoPEN,
              esProrrateable: false,
              fecha: now.toDate(),
              frecuencia: 'unico',
              estado: 'pendiente',             // Reconocido contablemente, sin implicar pago
              impactaCTRU: false,
              notas: `Unidad: ${data.unidadId} · Envío: ${data.envioId} · Responsable: ${data.responsable}`,
            },
            userId,
          );
          logger.info(`Gasto merma ${gastoId} generado por baja de ${data.sku} (S/ ${costoEfectivoPEN.toFixed(2)})`);
        } catch (err) {
          logger.error(`Error generando gasto para baja de ${data.sku} (no bloqueante):`, err);
        }
      }
    }

    // 4. Actualizar la incidencia en el envio como resuelta
    const transferRef = doc(db, COLLECTIONS.ENVIOS, data.envioId);
    const transferSnap = await getDoc(transferRef);
    if (transferSnap.exists()) {
      const transferData = transferSnap.data();
      const incidencias: IncidenciaEnvio[] = transferData.incidencias || [];
      const updatedIncidencias = incidencias.map(inc => {
        if (inc.id === data.incidenciaId) {
          return {
            ...inc,
            resuelta: true,
            resolucion: `${data.disposicion}: ${data.motivo}`,
            fechaResolucion: now,
            disposicion: data.disposicion,
            disposicionMotivo: data.motivo,
            disposicionPor: userId,
            disposicionFecha: now,
            responsable: data.responsable,
            montoReclamoPEN: data.disposicion === 'devolucion_proveedor' ? costoEfectivoPEN : undefined,
            estadoReclamo: data.disposicion === 'devolucion_proveedor' ? 'pendiente' as const : undefined,
          };
        }
        return inc;
      });

      await updateDoc(transferRef, {
        incidencias: updatedIncidencias,
        ultimaEdicion: now,
      });
    }

    return {
      unidadId: data.unidadId,
      nuevoEstado,
      gastoGenerado: gastoId,
      reclamoGenerado: data.disposicion === 'devolucion_proveedor' && data.responsable !== 'sin_responsable',
    };
  },

  /**
   * Procesa múltiples bajas en lote.
   *
   * S40 Bloque C — fix EDGE-002: antes era un `for` secuencial que se detenía en el primer
   * error. Ahora usa `Promise.allSettled` para procesar todas en paralelo y reportar qué
   * fallaron, permitiendo al caller mostrar "N procesadas, M fallidas" en vez de perder
   * trabajo por una sola falla.
   *
   * Nota: las bajas son semi-independientes (cada una toca una Unidad distinta + un gasto
   * separado) — NO hay garantía transaccional. Si esto es crítico en el futuro, hay que
   * reescribir usando `writeBatch` (máx 450 ops por batch) con todas las unidades juntas.
   */
  async procesarBajasLote(
    bajas: BajaDanoData[],
    userId: string
  ): Promise<Array<BajaResultado & { error?: string }>> {
    const settled = await Promise.allSettled(
      bajas.map(baja => this.registrarBajaPorDano(baja, userId))
    );

    return settled.map((s, i): BajaResultado & { error?: string } => {
      if (s.status === 'fulfilled') return s.value;
      const err = s.reason instanceof Error ? s.reason.message : String(s.reason);
      logger.error(`Baja ${bajas[i].sku} fallida:`, s.reason);
      return {
        unidadId: bajas[i].unidadId,
        nuevoEstado: 'danada' as EstadoUnidad,  // Se queda en estado previo
        error: err,
      };
    });
  },

  /**
   * Obtiene todas las unidades dañadas sin resolver (para tab en Inventario)
   */
  async getUnidadesDanadasPendientes(): Promise<any[]> {
    const q = query(
      collection(db, COLLECTIONS.UNIDADES),
      where('estado', '==', 'danada')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /**
   * Obtiene resumen de bajas por período (para cierre contable)
   */
  async getBajasPeriodo(mes: number, anio: number): Promise<{
    totalBajas: number;
    montoPEN: number;
    montoUSD: number;
    porDisposicion: Record<string, number>;
  }> {
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 0, 23, 59, 59);

    const q = query(
      collection(db, COLLECTIONS.GASTOS),
      where('origenGasto', '==', 'baja_inventario'),
      where('fecha', '>=', Timestamp.fromDate(inicio)),
      where('fecha', '<=', Timestamp.fromDate(fin))
    );

    const snap = await getDocs(q);
    let montoPEN = 0;
    let montoUSD = 0;
    const porDisposicion: Record<string, number> = {};

    snap.docs.forEach(d => {
      const data = d.data();
      montoPEN += data.montoPEN || 0;
      montoUSD += data.montoUSD || 0;
      // Count by tipo
      const tipo = data.tipo || 'merma_transferencia';
      porDisposicion[tipo] = (porDisposicion[tipo] || 0) + 1;
    });

    return {
      totalBajas: snap.size,
      montoPEN,
      montoUSD,
      porDisposicion,
    };
  },

  // ===================== VENCIDAS =====================

  /**
   * Datos para registrar baja por vencimiento
   */

  /**
   * Registra la baja de una unidad vencida
   * - Baja definitiva: estado 'baja', gasto en cuenta 6951 Mermas
   * - Donación: estado 'donada', sin gasto contable (ya no hay valor)
   */
  async registrarBajaPorVencimiento(
    data: {
      unidadId: string;
      productoId: string;
      productoNombre: string;
      sku: string;
      disposicion: DisposicionVencida;
      motivo: string;
      costoUnidadPEN: number;
      costoUnidadUSD?: number;
      destinatarioDonacion?: string;
    },
    userId: string
  ): Promise<BajaResultado> {
    const now = Timestamp.now();
    let nuevoEstado: EstadoUnidad;
    let gastoId: string | undefined;

    switch (data.disposicion) {
      case 'baja_definitiva':
        nuevoEstado = 'baja';
        break;
      case 'donacion':
        nuevoEstado = 'donada';
        break;
    }

    // 1. Actualizar unidad
    const unidadRef = doc(db, COLLECTIONS.UNIDADES, data.unidadId);
    await updateDoc(unidadRef, {
      estado: nuevoEstado,
      disposicionVencimiento: data.disposicion,
      disposicionMotivo: data.motivo,
      disposicionPor: userId,
      disposicionFecha: now,
      ...(data.destinatarioDonacion ? { destinatarioDonacion: data.destinatarioDonacion } : {}),
      ultimaEdicion: now,
    });

    // 2. Generar gasto contable solo para baja definitiva
    if (data.disposicion === 'baja_definitiva') {
      const gastoRef = await addDoc(collection(db, COLLECTIONS.GASTOS), {
        tipo: 'merma_vencimiento' as TipoGasto,
        categoria: 'operativo',
        concepto: `Baja por vencimiento: ${data.sku} - ${data.productoNombre}`,
        descripcion: `Producto vencido. Motivo: ${data.motivo}`,
        montoOriginal: data.costoUnidadPEN,
        moneda: 'PEN',
        montoPEN: data.costoUnidadPEN,
        montoUSD: data.costoUnidadUSD || 0,
        fecha: now,
        estado: 'pendiente', // Requiere confirmación
        unidadId: data.unidadId,
        productoId: data.productoId,
        cuentaContable: '6951', // Mermas
        cuentaContrapartida: '2011', // Mercaderías importadas
        creadoPor: userId,
        fechaCreacion: now,
        esAutomatico: false,
        origenGasto: 'baja_vencimiento',
      });
      gastoId = gastoRef.id;
    }

    return {
      unidadId: data.unidadId,
      nuevoEstado,
      gastoGenerado: gastoId,
      reclamoGenerado: false,
    };
  },

  /**
   * Procesa múltiples bajas por vencimiento en lote
   */
  async procesarBajasVencimientoLote(
    bajas: {
      unidadId: string;
      productoId: string;
      productoNombre: string;
      sku: string;
      disposicion: DisposicionVencida;
      motivo: string;
      costoUnidadPEN: number;
      costoUnidadUSD?: number;
      destinatarioDonacion?: string;
    }[],
    userId: string
  ): Promise<BajaResultado[]> {
    const resultados: BajaResultado[] = [];
    for (const baja of bajas) {
      const resultado = await this.registrarBajaPorVencimiento(baja, userId);
      resultados.push(resultado);
    }
    return resultados;
  },

  /**
   * Obtiene unidades vencidas pendientes de gestión
   */
  async getUnidadesVencidasPendientes(): Promise<any[]> {
    const q = query(
      collection(db, COLLECTIONS.UNIDADES),
      where('estado', '==', 'vencida')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
};
