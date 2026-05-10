import { doc, updateDoc, collection, addDoc, getDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { gastoService } from './gasto.service';
import { categoriaCostoService } from './categoriaCosto.service';
import { resolverCategoriaCostoIdParaTipo, type ArbolCategorias } from '../utils/gasto.bloque';
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
    //
    // BUG-INC-001 fix (S54.x): si la unidad no existe en Firestore (hueco
    // heredado del flujo de recepción que solo actualiza unidades existentes),
    // la creamos on-the-fly con los datos disponibles de la incidencia + envío.
    // Esto desbloquea el cierre de incidencias que antes fallaba con
    // "1 baja(s) fallaron · 0 procesadas".
    const unidadRef = doc(db, COLLECTIONS.UNIDADES, data.unidadId);
    let unidadSnap = await getDoc(unidadRef);
    let unidadDoc: Unidad;

    if (!unidadSnap.exists()) {
      logger.warn(
        `[BUG-INC-001] Unidad ${data.unidadId} no existía al procesar baja. ` +
        `Creando doc mínimo desde envío ${data.envioId} + incidencia ${data.incidenciaId}. ` +
        `Investigar por qué la recepción no la creó.`
      );

      // Leer envío para tener contexto (casilla destino, OC, costos)
      const envioRef = doc(db, COLLECTIONS.ENVIOS, data.envioId);
      const envioSnap = await getDoc(envioRef);
      if (!envioSnap.exists()) {
        throw new Error(`Envío ${data.envioId} no encontrado al recuperar contexto de unidad ${data.unidadId}`);
      }
      const envioData = envioSnap.data() as { [k: string]: any };

      // Buscar la EnvioUnidad correspondiente para tomar costos / lote
      const envioUnidad = (envioData.unidades || []).find(
        (u: { unidadId: string }) => u.unidadId === data.unidadId
      );

      // BUG-INC-011 fix (S54.x) — Derivar costo desde la OC para que el doc
      // creado on-the-fly tenga CTRU calculado. Sin esto, la unidad queda
      // con costos en 0 y los reclamos posteriores no pueden auto-cargar.
      let costoProductoUSD = 0;
      let tcCompra = 0;
      if (envioData.ordenCompraId) {
        try {
          const ocSnap = await getDoc(
            doc(db, COLLECTIONS.ORDENES_COMPRA, envioData.ordenCompraId)
          );
          if (ocSnap.exists()) {
            const oc = ocSnap.data() as {
              productos?: Array<{ productoId: string; costoUnitario: number }>;
              tcCompra?: number;
            };
            const productoEnOC = oc.productos?.find(
              (p) => p.productoId === data.productoId
            );
            costoProductoUSD = productoEnOC?.costoUnitario || 0;
            tcCompra = oc.tcCompra || 0;
          }
        } catch (err) {
          logger.warn(`[BUG-INC-001] No se pudo leer OC ${envioData.ordenCompraId} para CTRU:`, err);
        }
      }

      const costoFleteUSD = envioUnidad?.costoFleteUSD || 0;
      const ctruInicial = tcCompra > 0
        ? (costoProductoUSD + costoFleteUSD) * tcCompra
        : 0;

      const unidadMinima: Partial<Unidad> & { id: string } = {
        id: data.unidadId,
        productoId: data.productoId,
        productoSKU: data.sku,
        productoNombre: data.productoNombre,
        lote: envioUnidad?.lote || 'PENDIENTE',
        fechaVencimiento: envioUnidad?.fechaVencimiento || Timestamp.fromDate(new Date('2099-12-31')),
        casillaActualId: envioData.destinoCasillaId || envioData.almacenDestinoId || '',
        casillaNombre: envioData.destinoCasillaNombre || envioData.nombreAlmacenDestino || '',
        pais: envioData.destinoCasillaPais || 'Peru',
        estado: 'danada',
        costoUnitarioUSD: costoProductoUSD,
        costoFleteUSD,
        tcCompra,
        ctruInicial,
        ctruDinamico: ctruInicial,
        ctruContable: ctruInicial,
        ctruGerencial: ctruInicial,
        ordenCompraId: envioData.ordenCompraId || '',
        ordenCompraNumero: envioData.ordenCompraNumero || '',
        fechaRecepcion: now,
        envioId: data.envioId,
        envioNumero: envioData.numeroEnvio || '',
        creadoPor: userId,
        fechaCreacion: now,
        actualizadoPor: userId,
        fechaActualizacion: now,
      };

      // setDoc para crear con id explícito
      const { setDoc } = await import('firebase/firestore');
      await setDoc(unidadRef, unidadMinima);

      // Releer para tener el snap consistente
      unidadSnap = await getDoc(unidadRef);
      if (!unidadSnap.exists()) {
        throw new Error(`Falló la creación defensiva de Unidad ${data.unidadId}`);
      }
    }

    unidadDoc = unidadSnap.data() as Unidad;

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
          // chk5.A6 · resolver categoriaCostoId canónico desde el tipo (bloque 'producto' · Pérdidas)
          const arbol = await categoriaCostoService.getArbol() as ArbolCategorias;
          const categoriaCostoId = resolverCategoriaCostoIdParaTipo(tipoGasto, arbol);
          gastoId = await gastoService.create(
            {
              tipo: tipoGasto,
              categoria: 'GV',                // legacy compat · @deprecated (chk5.A9 marcará deprecated · chk5.A8 eliminará escritura)
              categoriaCostoId: categoriaCostoId ?? undefined,  // canon (bloque 'producto' · Pérdidas · Merma transferencia)
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

      // BUG-INC-006/007/008 fix (S54.x) — Recalcular estado del envío
      // tomando en cuenta las incidencias resueltas. Antes la baja solo
      // marcaba la incidencia como resuelta pero el envío seguía en
      // 'recibida_parcial' eternamente porque la lógica miraba solo
      // unidad.estadoEnvio sin considerar si la incidencia ya estaba cerrada.
      const { buildEnvioEstadoUpdates } = await import('../utils/envio.estado.helpers');
      const envioEstadoUpdates = buildEnvioEstadoUpdates(
        transferData.unidades,
        updatedIncidencias,
      );

      await updateDoc(transferRef, {
        incidencias: updatedIncidencias,
        ...envioEstadoUpdates,
        ultimaEdicion: now,
      });

      logger.info(
        `Envío ${data.envioId}: incidencia ${data.incidenciaId} resuelta. ` +
        `Nuevo estado del envío: ${envioEstadoUpdates.estado}`
      );
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
      // chk5.A6 · resolver categoriaCostoId canónico desde el tipo (bloque 'producto' · Pérdidas)
      const arbol = await categoriaCostoService.getArbol() as ArbolCategorias;
      const categoriaCostoId = resolverCategoriaCostoIdParaTipo('merma_vencimiento', arbol);
      const gastoRef = await addDoc(collection(db, COLLECTIONS.GASTOS), {
        tipo: 'merma_vencimiento' as TipoGasto,
        categoria: 'GO',                       // legacy compat · @deprecated (chk5.A9)
        categoriaCostoId: categoriaCostoId ?? null,  // canon (bloque 'producto' · Pérdidas · Merma vencimiento)
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
