import {
  doc, updateDoc, writeBatch, getDoc, Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { envioCrudService } from './envio.crud.service';
import { sumarComponentesCosto } from '../utils/ctru.utils';
import { type ProductoInfo } from '../utils/prorrateoLanded';
import {
  buildUnidadesPorTanda,
  prorratearLandedAComponentes,
  construirComponentesUnidad,
} from '../utils/costoComponentes.builder';
import type { RecepcionEnvio, EnvioUnidad } from '../types/envio.types';
import type { Unidad, EstadoUnidad } from '../types/unidad.types';
import type { ComponenteCostoUnidad } from '../types/ctru.types';

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

    // Prorrateo de costos landed → ComponenteCostoUnidad[] por unidad, POR ÁMBITO
    // (fundación 2026-06-16). El denominador del prorrateo scope='envio' es el total
    // ESTABLE del envío (todas las unidades), no las "pendientes" de esta recepción
    // — así la cuota de cada unidad es igual en cualquier recepción y no se re-toca
    // a las ya congeladas. Los costos scope='tanda' se reparten solo en su tanda.
    // (Arregla además CONT-003 pasando productosInfo real a total_por_valor/peso.)
    const landedComponentesPorUnidad = new Map<string, ComponenteCostoUnidad[]>();
    if (envio.costosLanded.length > 0) {
      const todasUnidades = envio.unidades;

      // productosInfo leyendo el costoUnitarioUSD real de Firestore (una lectura por
      // productoId distinto) sobre TODAS las unidades del envío.
      const productosInfo = new Map<string, ProductoInfo>();
      const productoIdsUnicos = Array.from(new Set(todasUnidades.map(u => u.productoId)));
      for (const pid of productoIdsUnicos) {
        const primera = todasUnidades.find(u => u.productoId === pid);
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

      const unidadesPorTanda = buildUnidadesPorTanda(envio.subEnvios, todasUnidades);
      const comps = prorratearLandedAComponentes(
        envio.costosLanded,
        todasUnidades,
        unidadesPorTanda,
        productosInfo,
        now
      );
      for (const [uid, list] of comps) landedComponentesPorUnidad.set(uid, list);
    }

    // Paso 5 (fundación) — Recojo en Perú de ESTA recepción como componente de ETAPA.
    // Se prorratea SOLO entre las unidades RECIBIDAS en esta recepción (ámbito='etapa',
    // recepcionId), respetando la inmutabilidad de las etapas previas. Antes el campo
    // formData.costoRecojoPEN se capturaba en el modal pero registrarRecepcion nunca
    // lo leía (BUG-2 · costo de recojo perdido end-to-end).
    const recepcionesAnteriores = envio.recepciones || [];
    const numeroRecepcion = recepcionesAnteriores.length + 1;
    const recepcionId = `REC-ENV-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const nRecibidasRecojo = unidadesRecibidas.filter(ur => ur.recibida).length;
    const recojoPorUnidad = (formData.costoRecojoPEN && formData.costoRecojoPEN > 0 && nRecibidasRecojo > 0)
      ? formData.costoRecojoPEN / nRecibidasRecojo
      : 0;

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

          // Congelar los componentes de costo de la unidad (fundación 2026-06-16).
          // Guard `costosLanded>0` ELIMINADO: ahora SIEMPRE se materializa al menos
          // el componente producto, así ninguna unidad recibida queda sin CTRU.
          const landedComps = landedComponentesPorUnidad.get(ur.unidadId) || [];
          // Recojo en Perú de esta recepción (ámbito='etapa') · solo si el usuario lo ingresó.
          const compsLandedEtapa: ComponenteCostoUnidad[] = recojoPorUnidad > 0
            ? [...landedComps, {
                categoria: 'recojo',
                concepto: `Recojo en Perú · recepción ${numeroRecepcion}`,
                montoPEN: recojoPorUnidad,
                fuente: 'recepcion',
                ambito: 'etapa',
                recepcionId,
                congeladoEn: now,
              }]
            : landedComps;
          const componentes = construirComponentesUnidad(unidadData, compsLandedEtapa, now);
          const costosLandedPEN = sumarComponentesCosto(compsLandedEtapa);

          updateData.componentesCosto = componentes;
          if (costosLandedPEN > 0) updateData.costosLandedPEN = costosLandedPEN;
          // Fase B3 · sin doble-escritura escalar: el CTRU vive en componentesCosto[] (getCTRU
          // prioridad 0). Los escalares ctru* quedan solo como fallback para unidades legacy.

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

    // BUG-INC-006/007/008 fix (S54.x) — Cálculo del estado del envío movido
    // al helper centralizado `utils/envio.estado.helpers.ts`. La lógica
    // simplista que estaba acá (totalFaltantes++ → siempre parcial) se
    // reemplazó por buildEnvioEstadoUpdates() que considera el estado de
    // cada incidencia. Se aplica más abajo en el batch.update.

    const diasEnTransito = envio.fechaSalida
      ? Math.ceil((now.toMillis() - envio.fechaSalida.toMillis()) / (1000 * 60 * 60 * 24))
      : 0;

    // Crear registro de recepcion (id/numero ya calculados arriba para el componente recojo)
    const nuevaRecepcion: RecepcionEnvio = {
      id: recepcionId,
      numero: numeroRecepcion,
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

    // BUG-INC-006/007/008 fix (S54.x) — Cálculo del estado final del envío
    // usando el helper centralizado, que considera incidencias resueltas.
    //
    // En este flujo (recepción), las incidencias nuevas se crean como
    // resuelta=false, así que para una recepción que reporta faltante,
    // el estado quedará 'recibida_parcial' como antes — pero después
    // cuando el usuario gestione esas incidencias (vía bajaInventarioService
    // o reclamoService), se recalculará y podrá pasar a 'recibida_completa'.
    const { buildEnvioEstadoUpdates } = await import('../utils/envio.estado.helpers');
    const estadoCalc = buildEnvioEstadoUpdates(unidadesActualizadas, todasIncidencias);
    const estadoFinal = estadoCalc.estado;

    // Actualizar envio
    const envioRef = doc(db, ENVIOS_COLL, envioId);
    batch.update(envioRef, {
      estado: estadoFinal,
      diasEnTransito,
      unidades: unidadesActualizadas,
      recepciones: [...recepcionesAnteriores, nuevaRecepcion],
      totalUnidadesRecibidas: estadoCalc.totalUnidadesRecibidas,
      totalUnidadesFaltantes: estadoCalc.totalUnidadesFaltantes,
      totalUnidadesDanadas: estadoCalc.totalUnidadesDanadas,
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
