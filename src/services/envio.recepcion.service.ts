import {
  doc, updateDoc, writeBatch, getDoc, Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { envioCrudService } from './envio.crud.service';
import { getCostoBasePEN, getTC } from '../utils/ctru.utils';
import {
  calcularCostosLandedPorUnidad,
  buildProductosInfoFromOC,
  type ProductoInfo,
} from '../utils/prorrateoLanded';
import type { Envio, EstadoEnvio, RecepcionEnvio, EnvioUnidad, CostoLanded, MetodoProrrateo } from '../types/envio.types';
import type { Unidad, EstadoUnidad, MovimientoUnidad } from '../types/unidad.types';

const ENVIOS_COLL = COLLECTIONS.ENVIOS;
const UNIDADES_COLL = COLLECTIONS.UNIDADES;
const BATCH_LIMIT = 450;

// S53.7 — `prorratearCosto` y el helper de prorrateo extraídos a
// `src/utils/prorrateoLanded.ts` para reutilizar desde `aplicarRecojoEnOrigen`
// en `ordenCompra.crud.service.ts`. El fix incluido es el paso de
// `productosInfo` correcto al método 'total_por_valor' (antes degeneraba
// a prorrateo uniforme por falta de datos de producto).

export const envioRecepcionService = {
  /**
   * Registra la recepcion de un envio.
   * Al recibir: actualiza CTRU de unidades con costos landed prorrateados.
   * Mueve unidades a 'disponible' en casilla destino.
   */
  /**
   * Registra la recepción de un envío.
   * Contrato canónico: recibe el formData del modal de recepción + userId.
   * (Reescrito en S38-013 — antes tenía firma posicional que el caller post-S37 no respetaba)
   *
   * S40 — opcionalmente acepta `extras.gastosAduanaPEN` para registrar los gastos de
   * liberación aduanera pagados en esta recepción como CostoLanded categoría Aduana.
   */
  async registrarRecepcion(
    formData: import('../types/envio.types').RecepcionEnvioFormData,
    userId: string,
    extras?: { gastosAduanaPEN?: number; gastosAduanaDescripcion?: string }
  ): Promise<void> {
    const { envioId, observaciones, fechasVencimiento } = formData;

    // Mergear fechas de vencimiento del formData en cada unidad si no la trae
    const unidadesRecibidas = formData.unidadesRecibidas.map(u => ({
      ...u,
      fechaVencimiento: (u as any).fechaVencimiento || fechasVencimiento?.[u.unidadId],
    }));

    const envio = await envioCrudService.getById(envioId);
    if (!envio) throw new Error('Envio no encontrado');

    if (envio.estado !== 'en_transito' && envio.estado !== 'recibida_parcial') {
      throw new Error('Solo se pueden recibir envios en transito o con recepcion parcial');
    }

    const now = Timestamp.now();
    const batch = writeBatch(db);

    // S53.7 — Calcular prorrateo de costos landed para CADA unidad recibida.
    // Construimos `productosInfo` leyendo los costos base desde las primeras
    // unidades de cada productoId (están desnormalizados en el envío + en
    // la unidad real via `costoUnitarioUSD`). Esto arregla el bug CONT-003
    // donde `total_por_valor` degeneraba en prorrateo uniforme.
    const costosLandedPorUnidad = new Map<string, number>();
    if (envio.costosLanded.length > 0) {
      const unidadesPendientes = envio.unidades.filter(
        u => u.estadoEnvio === 'pendiente' || u.estadoEnvio === 'enviada'
      );

      // Construir productosInfo leyendo el costoUnitarioUSD real de Firestore
      // (una lectura por productoId distinto, no por unidad individual).
      const productosInfo = new Map<string, ProductoInfo>();
      const productoIdsUnicos = Array.from(
        new Set(unidadesPendientes.map(u => u.productoId))
      );
      for (const pid of productoIdsUnicos) {
        // Tomar una unidad de ese producto para leer su costoUnitarioUSD
        // desnormalizado y su pesoLibras (si existe).
        const primera = unidadesPendientes.find(u => u.productoId === pid);
        if (!primera) continue;
        const unidadRef = doc(db, UNIDADES_COLL, primera.unidadId);
        const unidadSnap = await getDoc(unidadRef);
        if (unidadSnap.exists()) {
          const data = unidadSnap.data() as Unidad;
          productosInfo.set(pid, {
            costoUSD: data.costoUnitarioUSD || 0,
            pesoLb: primera.pesoLibras || 0,
          });
        }
      }

      const prorrateo = calcularCostosLandedPorUnidad(
        envio.costosLanded,
        unidadesPendientes,
        productosInfo
      );
      for (const [unidadId, monto] of prorrateo) {
        costosLandedPorUnidad.set(unidadId, monto);
      }
    }

    // Procesar unidades
    let recEnEsta = 0;
    let faltEnEsta = 0;
    let danEnEsta = 0;
    const unidadesActualizadas = [...envio.unidades];
    const unidadesProcesadas: RecepcionEnvio['unidadesProcesadas'] = [];

    for (const ur of unidadesRecibidas) {
      const idx = unidadesActualizadas.findIndex(u => u.unidadId === ur.unidadId);
      if (idx === -1) continue;

      let estadoEnvio: EnvioUnidad['estadoEnvio'];
      let resultado: 'recibida' | 'faltante' | 'danada' | 'perdida' | 'retenida';

      // S39: clasificar resultado — retenida se detecta por incidencia (patrón "Retenida en aduana")
      const esRetenida = !ur.recibida && !ur.perdida && ur.incidencia?.includes('Retenida en aduana');
      if (!ur.recibida) {
        if (ur.perdida) {
          estadoEnvio = 'perdida'; resultado = 'perdida'; faltEnEsta++;
        } else if (esRetenida) {
          estadoEnvio = 'retenida'; resultado = 'retenida'; faltEnEsta++;
        } else {
          estadoEnvio = 'faltante'; resultado = 'faltante'; faltEnEsta++;
        }
      } else if (ur.danada) {
        estadoEnvio = 'danada'; resultado = 'danada'; danEnEsta++; recEnEsta++;
      } else {
        estadoEnvio = 'recibida'; resultado = 'recibida'; recEnEsta++;
      }

      unidadesActualizadas[idx] = {
        ...unidadesActualizadas[idx],
        estadoEnvio,
        ...(ur.incidencia ? { incidencia: ur.incidencia } : {}),
      };

      unidadesProcesadas.push({
        unidadId: ur.unidadId,
        resultado,
        ...(ur.incidencia ? { incidencia: ur.incidencia } : {}),
        ...(ur.fechaVencimiento ? { fechaVencimiento: ur.fechaVencimiento } : {}),
      });

      // Actualizar documento de Unidad en Firestore
      const unidadRef = doc(db, UNIDADES_COLL, ur.unidadId);
      const unidadSnap = await getDoc(unidadRef);

      if (unidadSnap.exists()) {
        const unidadData = unidadSnap.data() as Unidad;

        if (ur.recibida) {
          const estabaReservada = (unidadData as any).reservadaPara;
          let estadoNuevo: EstadoUnidad;

          if (ur.danada) {
            estadoNuevo = 'danada';
          } else if (estabaReservada) {
            estadoNuevo = 'reservada';
          } else {
            estadoNuevo = 'disponible';
          }

          const updateData: Record<string, unknown> = {
            estado: estadoNuevo,
            casillaActualId: envio.destinoCasillaId,
            casillaNombre: envio.destinoCasillaNombre,
            pais: 'Peru', // Recepcion = llego a Peru (o casilla destino)
            actualizadoPor: userId,
            fechaActualizacion: now,
          };

          // Costos landed prorrateados
          const costosLanded = costosLandedPorUnidad.get(ur.unidadId) || 0;
          if (costosLanded > 0) {
            updateData.costosLandedPEN = costosLanded;

            // Recalcular CTRU con costos landed
            const tc = getTC(unidadData);
            const costoProductoPEN = (unidadData.costoUnitarioUSD || 0) * tc;
            const costoFletePEN = (unidadData.costoFleteUSD || 0) * tc;
            const ctruNuevo = costoProductoPEN + costoFletePEN + costosLanded;

            updateData.ctruInicial = ctruNuevo;
            updateData.ctruDinamico = ctruNuevo;
            updateData.ctruContable = ctruNuevo;
            updateData.ctruGerencial = ctruNuevo;
          }

          // Fecha de vencimiento
          if (ur.fechaVencimiento) {
            updateData.fechaVencimiento = Timestamp.fromDate(new Date(ur.fechaVencimiento + 'T00:00:00'));
          }

          batch.update(unidadRef, updateData);
        } else {
          // Faltante/perdida/retenida
          const estadoNuevo: EstadoUnidad = ur.perdida ? 'perdida'
            : esRetenida ? 'retenida_aduana'
            : 'en_transito'; // faltante: puede llegar después
          batch.update(unidadRef, {
            estado: estadoNuevo,
            actualizadoPor: userId,
            fechaActualizacion: now,
          });
        }
      }
    }

    // Calcular totales
    const totalRecibidas = unidadesActualizadas.filter(u => u.estadoEnvio === 'recibida').length;
    const totalFaltantes = unidadesActualizadas.filter(u => u.estadoEnvio === 'faltante' || u.estadoEnvio === 'perdida').length;
    const totalDanadas = unidadesActualizadas.filter(u => u.estadoEnvio === 'danada').length;
    const totalRetenidas = unidadesActualizadas.filter(u => u.estadoEnvio === 'retenida').length;
    const totalPendientes = unidadesActualizadas.filter(u => u.estadoEnvio === 'enviada' || u.estadoEnvio === 'pendiente').length;

    // S39: solo es "completa" si TODO fue recibido (incluye dañadas como procesadas).
    // Faltantes, retenidas = no resueltas aún = parcial.
    const estadoFinal: EstadoEnvio =
      totalPendientes === 0 && totalFaltantes === 0 && totalRetenidas === 0
        ? 'recibida_completa'
        : 'recibida_parcial';

    const diasEnTransito = envio.fechaSalida
      ? Math.ceil((now.toMillis() - envio.fechaSalida.toMillis()) / (1000 * 60 * 60 * 24))
      : 0;

    // Crear registro de recepcion
    const recepcionesAnteriores = envio.recepciones || [];
    const nuevaRecepcion: RecepcionEnvio = {
      id: `REC-ENV-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      numero: recepcionesAnteriores.length + 1,
      fechaRecepcion: now,
      recibidoPor: userId,
      unidadesEsperadas: envio.totalUnidades,
      unidadesRecibidas: recEnEsta,
      unidadesFaltantes: faltEnEsta,
      unidadesDanadas: danEnEsta,
      unidadesProcesadas,
      ...(observaciones ? { observaciones } : {}),
    };

    // S39/S40: Crear IncidenciaEnvio para dañadas, perdidas y retenidas
    // S40: tipo 'aduana' explícito para retenidas (antes era 'otro') + fechaRetencion
    const incidenciasExistentes: import('../types/envio.types').IncidenciaEnvio[] = envio.incidencias || [];
    const nuevasIncidencias: import('../types/envio.types').IncidenciaEnvio[] = [];
    for (const up of unidadesProcesadas) {
      if (up.resultado === 'danada' || up.resultado === 'perdida' || up.resultado === 'retenida') {
        const unidadEnvio = unidadesActualizadas.find(u => u.unidadId === up.unidadId);
        const esAduana = up.resultado === 'retenida';
        nuevasIncidencias.push({
          id: `INC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          tipo: up.resultado === 'danada' ? 'danada' : esAduana ? 'aduana' : 'faltante',
          unidadId: up.unidadId,
          productoId: unidadEnvio?.productoId,
          sku: unidadEnvio?.sku,
          productoNombre: unidadEnvio?.sku, // fallback a SKU
          descripcion: up.incidencia || (up.resultado === 'danada' ? 'Unidad dañada' : esAduana ? 'Retenida en aduana — pendiente de liberación' : 'Unidad perdida'),
          fechaRegistro: now,
          registradoPor: userId,
          resuelta: false,
          ...(esAduana ? { fechaRetencion: now } : {}),
        });
      }
    }
    const todasIncidencias = [...incidenciasExistentes, ...nuevasIncidencias];

    // Actualizar envio
    const envioRef = doc(db, ENVIOS_COLL, envioId);
    batch.update(envioRef, {
      estado: estadoFinal,
      diasEnTransito,
      unidades: unidadesActualizadas,
      recepciones: [...recepcionesAnteriores, nuevaRecepcion],
      totalUnidadesRecibidas: totalRecibidas,
      totalUnidadesFaltantes: totalFaltantes,
      totalUnidadesDanadas: totalDanadas,
      ...(nuevasIncidencias.length > 0 ? { incidencias: todasIncidencias } : {}),
      ...(envio.estado === 'en_transito' ? { fechaLlegadaReal: now } : {}),
      actualizadoPor: userId,
      fechaActualizacion: now,
    });

    await batch.commit();

    logger.success(`Envio ${envio.numeroEnvio}: recepcion ${nuevaRecepcion.numero} — ${recEnEsta} recibidas, ${faltEnEsta} faltantes, ${danEnEsta} danadas`);

    // S40: Registrar gastos de liberación aduanera como CostoLanded categoría Aduana (si vienen)
    if (extras?.gastosAduanaPEN && extras.gastosAduanaPEN > 0) {
      try {
        await envioCrudService.agregarCostoLanded(envioId, {
          categoriaCostoId: 'aduana',
          categoriaCostoNombre: 'Aduana',
          descripcion: extras.gastosAduanaDescripcion || `Gastos de liberación aduanera — Recepción #${nuevaRecepcion.numero}`,
          monto: extras.gastosAduanaPEN,
          moneda: 'PEN',
          montoPEN: extras.gastosAduanaPEN,
          metodoProrrateo: 'fijo_por_unidad',
          pagado: false,
        }, userId);
        logger.info(`Gastos aduana S/ ${extras.gastosAduanaPEN.toFixed(2)} registrados como CostoLanded en envio ${envio.numeroEnvio}`);
      } catch (err) {
        logger.error('Error registrando gastos aduana como CostoLanded (no bloqueante):', err);
      }
    }

    // S38-014: Sync Envío → OC. Si el envío está vinculado a una OC, propagar el estado
    // - Recepción parcial → OC pasa a 'recibida_parcial'
    // - Recepción completa Y todos los envíos de la OC también completos → OC pasa a 'completada'
    if (envio.ordenCompraId) {
      try {
        const ocRef = doc(db, 'ordenesCompra', envio.ordenCompraId);
        const ocSnap = await getDoc(ocRef);
        if (!ocSnap.exists()) {
          logger.warn(`OC ${envio.ordenCompraId} no encontrada al sincronizar recepción`);
        } else {
          const oc = ocSnap.data() as any;

          // Buscar TODOS los envíos vinculados a esta OC
          const enviosOC = await envioCrudService.getByFiltros({ ordenCompraId: envio.ordenCompraId });
          // Reemplazar el actual con su nuevo estado (todavía no se refleja en el getByFiltros recién hecho)
          const enviosActuales = enviosOC.map(e => e.id === envioId ? { ...e, estado: estadoFinal } : e);

          const todosCompletos = enviosActuales.every(e => e.estado === 'recibida_completa' || e.estado === 'cancelada');
          const algunoConRecepcion = enviosActuales.some(e =>
            e.estado === 'recibida_completa' || e.estado === 'recibida_parcial'
          );

          let nuevoEstadoOC: string | null = null;
          if (todosCompletos && oc.estado !== 'completada' && oc.estado !== 'recibida') {
            nuevoEstadoOC = 'completada';
          } else if (algunoConRecepcion && oc.estado !== 'recibida_parcial' && oc.estado !== 'completada' && oc.estado !== 'recibida') {
            nuevoEstadoOC = 'recibida_parcial';
          }

          if (nuevoEstadoOC) {
            const updates: any = {
              estado: nuevoEstadoOC,
              ultimaEdicion: now,
              editadoPor: userId,
            };
            if (nuevoEstadoOC === 'recibida_parcial' && !oc.fechaPrimeraRecepcion) {
              updates.fechaPrimeraRecepcion = now;
            }
            if (nuevoEstadoOC === 'completada') {
              updates.fechaRecibida = updates.fechaRecibida || now;
            }
            await updateDoc(ocRef, updates);
            logger.info(`OC ${oc.numeroOrden} → ${nuevoEstadoOC} (sync desde Envío ${envio.numeroEnvio})`);
          }
        }
      } catch (err: any) {
        // No bloquear si falla el sync
        logger.error('Error al sincronizar OC tras recepción de envío (no bloqueante):', err);
      }
    }
  },

  /**
   * S40 — Libera unidades retenidas en aduana.
   *
   * Flujo:
   *  1. Marca las incidencias tipo 'aduana' (o legacy 'otro' con "Retenida en aduana") como
   *     resueltas, con fechaLiberacion, gastosLiberacionPEN y documentoLiberacion.
   *  2. Las unidades NO cambian de estado automáticamente: la liberación aduanera es un
   *     paso administrativo; su recepción física se registra en una recepción posterior
   *     vía `registrarRecepcion`.
   *     (La única excepción es actualizar `EnvioUnidad.estadoEnvio` de 'retenida' a 'enviada'
   *     para que aparezcan como pendientes en la próxima recepción.)
   *  3. Si `gastosLiberacionPEN > 0` → crea CostoLanded categoría Aduana en el envío.
   *
   * @param envioId         ID del envío
   * @param unidadIds       IDs de las unidades que se liberan (subset de las retenidas)
   * @param gastosPEN       Gastos de liberación (tasas, aranceles, brokerage) en soles
   * @param userId          Usuario que registra
   * @param documentoLiberacion  URL de evidencia (DUA, constancia) — opcional
   * @param descripcionGastos    Descripción del cargo — opcional
   */
  async liberarUnidadesAduana(
    envioId: string,
    unidadIds: string[],
    gastosPEN: number,
    userId: string,
    documentoLiberacion?: string,
    descripcionGastos?: string
  ): Promise<void> {
    if (unidadIds.length === 0) {
      throw new Error('Debe indicar al menos una unidad a liberar');
    }

    const envio = await envioCrudService.getById(envioId);
    if (!envio) throw new Error('Envío no encontrado');

    const unidadIdsSet = new Set(unidadIds);
    const now = Timestamp.now();
    const batch = writeBatch(db);

    // 1. Actualizar incidencias: marcar como resueltas, agregar datos de liberación
    // S40: sin fallback legacy — solo tipo='aduana' canónico
    const incidenciasActualizadas = (envio.incidencias || []).map(inc => {
      if (inc.tipo !== 'aduana' || inc.resuelta) return inc;
      if (!inc.unidadId || !unidadIdsSet.has(inc.unidadId)) return inc;
      return {
        ...inc,
        resuelta: true,
        resolucion: 'Liberada de aduana',
        fechaResolucion: now,
        fechaLiberacion: now,
        ...(gastosPEN > 0 ? { gastosLiberacionPEN: gastosPEN } : {}),
        ...(documentoLiberacion ? { documentoLiberacion } : {}),
      };
    });

    // 2. Actualizar EnvioUnidad: 'retenida' → 'enviada' para que puedan recibirse
    const unidadesActualizadas = envio.unidades.map(u => {
      if (!unidadIdsSet.has(u.unidadId)) return u;
      if (u.estadoEnvio !== 'retenida') return u;
      return { ...u, estadoEnvio: 'enviada' as const };
    });

    // 3. Actualizar doc envío
    const envioRef = doc(db, ENVIOS_COLL, envioId);
    batch.update(envioRef, {
      incidencias: incidenciasActualizadas,
      unidades: unidadesActualizadas,
      actualizadoPor: userId,
      fechaActualizacion: now,
    });

    // 4. Actualizar Unidad.estado: 'retenida_aduana' → 'en_transito' (puede recibirse)
    for (const unidadId of unidadIds) {
      const unidadRef = doc(db, UNIDADES_COLL, unidadId);
      const snap = await getDoc(unidadRef);
      if (snap.exists()) {
        const data = snap.data() as Unidad;
        if (data.estado === 'retenida_aduana') {
          batch.update(unidadRef, {
            estado: 'en_transito' as EstadoUnidad,
            actualizadoPor: userId,
            fechaActualizacion: now,
          });
        }
      }
    }

    await batch.commit();

    // 5. Registrar CostoLanded (fuera de batch — usa updateDoc interno)
    if (gastosPEN > 0) {
      try {
        await envioCrudService.agregarCostoLanded(envioId, {
          categoriaCostoId: 'aduana',
          categoriaCostoNombre: 'Aduana',
          descripcion: descripcionGastos || `Liberación aduanera — ${unidadIds.length} unidad(es)`,
          monto: gastosPEN,
          moneda: 'PEN',
          montoPEN: gastosPEN,
          metodoProrrateo: 'fijo_por_unidad',
          pagado: false,
        }, userId);
      } catch (err) {
        logger.error('Error registrando gastos aduana como CostoLanded (no bloqueante):', err);
      }
    }

    logger.success(`Envío ${envio.numeroEnvio}: ${unidadIds.length} unidad(es) liberadas de aduana${gastosPEN > 0 ? ` con gastos S/ ${gastosPEN.toFixed(2)}` : ''}`);
  },
};
