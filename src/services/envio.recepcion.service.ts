import {
  doc, updateDoc, writeBatch, getDoc, Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getReservaPara } from './reserva.helper';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { envioCrudService } from './envio.crud.service';
import { type ProductoInfo } from '../utils/prorrateoLanded';
import {
  buildUnidadesPorTanda,
  prorratearLandedAComponentes,
  construirComponentesUnidad,
} from '../utils/costoComponentes.builder';
import type { RecepcionEnvio, EnvioUnidad } from '../types/envio.types';
import type { Unidad, EstadoUnidad } from '../types/unidad.types';
import type { ComponenteCostoUnidad } from '../types/ctru.types';
import { mapEnvioEstadoToSubOrden } from '../utils/ordenCompra.helpers';

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
    // INVARIANTE DE INMUTABILIDAD (fundación 2026-06-17): solo los costos CONFIRMADOS
    // se congelan en las unidades. Un costo 'estimado' es un preview financiero (su
    // monto puede cambiar al llegar la factura firme); si se congelara ahora y luego
    // cambiara al confirmar, se rompería la inmutabilidad (componente ya escrito ≠
    // monto firme). Al filtrar aquí, la unidad NUNCA recibe el componente de un
    // estimado → al confirmarse, el backfill (envio.crud.service.confirmarCostoLanded
    // → materializarCostoConfirmado) lo materializa al monto CONFIRMADO, sin sub-conteo
    // del delta. El recojo inline de ESTA recepción (más abajo) es un evento de la
    // recepción, no un CostoLanded del doc → no se filtra acá.
    const costosLandedConfirmados = envio.costosLanded.filter(
      c => (c.estado ?? 'estimado') === 'confirmado'
    );

    const landedComponentesPorUnidad = new Map<string, ComponenteCostoUnidad[]>();
    if (costosLandedConfirmados.length > 0) {
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
        costosLandedConfirmados,
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
          const estabaReservada = getReservaPara(unidadData);
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

          updateData.componentesCosto = componentes;
          // Limpieza 2026-07 · componentesCosto[] es la FUENTE ÚNICA del CTRU: no se
          // escribe ningún escalar derivado (costosLandedPEN/ctru* eliminados del tipo).

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
    // Cambio 6 (2026-06-17): la aduana que se está pagando es un monto FIRME → nace
    // estado='confirmado' (no 'estimado') para que materialice en el CTRU. Como las
    // unidades de ESTA recepción ya quedaron congeladas en el batch de arriba, el
    // backfill las alcanza vía materializarCostoLandedConfirmado (append-only + idempotente).
    if (extras?.gastosAduanaPEN && extras.gastosAduanaPEN > 0) {
      try {
        const costoId = await envioCrudService.agregarCostoLanded(envioId, {
          categoriaCostoId: 'aduana',
          categoriaCostoNombre: 'Aduana',
          descripcion: extras.gastosAduanaDescripcion || `Gastos de liberación aduanera — Recepción #${nuevaRecepcion.numero}`,
          monto: extras.gastosAduanaPEN,
          moneda: 'PEN',
          montoPEN: extras.gastosAduanaPEN,
          metodoProrrateo: 'fijo_por_unidad',
          estado: 'confirmado',
          pagado: false,
        }, userId);
        await envioCrudService.materializarCostoLandedConfirmado(envioId, costoId, userId);
        logger.info(`Gastos aduana S/ ${extras.gastosAduanaPEN.toFixed(2)} registrados (confirmado) y materializados como CostoLanded en envio ${envio.numeroEnvio}`);
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

          const updates: any = {};

          // ── Sync SUB-ORDEN 1:1 (fuente de verdad = el envío) ──────────────
          // La recepción REAL congela CTRU + mueve inventario aquí; la sub-orden
          // solo REFLEJA el estado + contadores de su envío vinculado. Antes el
          // marcado manual en OrdenCompraCard divergía (estado sin recepción real).
          if (envio.subOrdenId && Array.isArray(oc.subOrdenes)) {
            const subEstado = mapEnvioEstadoToSubOrden(estadoFinal);
            const totalU = envio.totalUnidades
              ?? (Array.isArray(envio.unidades) ? envio.unidades.length : undefined);
            const marcaRecepcion = subEstado === 'recibida' || subEstado === 'recibida_parcial';
            let subEncontrada = false;
            updates.subOrdenes = oc.subOrdenes.map((s: any) => {
              if (s.id !== envio.subOrdenId) return s;
              subEncontrada = true;
              return {
                ...s,                                       // preserva tracking/courier/pago/etc.
                estado: subEstado,
                unidadesRecibidas: estadoCalc.totalUnidadesRecibidas ?? 0,
                unidadesFaltantes: estadoCalc.totalUnidadesFaltantes ?? 0,
                unidadesDanadas: estadoCalc.totalUnidadesDanadas ?? 0,
                ...(totalU !== undefined ? { totalUnidades: totalU } : {}),
                ...(marcaRecepcion ? { fechaRecepcion: now } : {}),
              };
            });
            if (!subEncontrada) {
              // Invariante roto (subOrdenId apunta a una sub-orden inexistente):
              // no reescribimos el array; el estado de la OC sí puede actualizarse abajo.
              logger.warn(`Recepción envío ${envio.numeroEnvio}: subOrdenId ${envio.subOrdenId} no está en OC ${oc.numeroOrden} — sub-orden no sincronizada`);
              delete updates.subOrdenes;
            }
          }

          // ── Estado de la OC (roll-up desde los envíos) ────────────────────
          let nuevoEstadoOC: string | null = null;
          if (todosCompletos && oc.estado !== 'completada' && oc.estado !== 'recibida') {
            nuevoEstadoOC = 'completada';
          } else if (algunoConRecepcion && oc.estado !== 'recibida_parcial' && oc.estado !== 'completada' && oc.estado !== 'recibida') {
            nuevoEstadoOC = 'recibida_parcial';
          }
          if (nuevoEstadoOC) {
            updates.estado = nuevoEstadoOC;
            if (nuevoEstadoOC === 'recibida_parcial' && !oc.fechaPrimeraRecepcion) {
              updates.fechaPrimeraRecepcion = now;
            }
            if (nuevoEstadoOC === 'completada') {
              updates.fechaRecibida = oc.fechaRecibida || now;
            }
          }

          if (Object.keys(updates).length > 0) {
            updates.ultimaEdicion = now;
            updates.editadoPor = userId;
            await updateDoc(ocRef, updates);
            logger.info(`OC ${oc.numeroOrden}: sync desde Envío ${envio.numeroEnvio}${nuevoEstadoOC ? ` → ${nuevoEstadoOC}` : ''}${envio.subOrdenId ? ` · sub-orden ${envio.subOrdenId} → ${mapEnvioEstadoToSubOrden(estadoFinal)}` : ''}`);
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
    // Cambio 6 (2026-06-17): monto FIRME de aduana → nace 'confirmado' y se materializa.
    // Las unidades que se acaban de liberar (retenida→enviada) AÚN NO están congeladas →
    // recogerán su cuota al recibirse (Cambio 3 sobre costos confirmados). El backfill de
    // acá alcanza a las unidades del envío que YA estaban congeladas de recepciones previas
    // (un costo scope='envio' prorratea sobre TODAS · denominador estable).
    if (gastosPEN > 0) {
      try {
        const costoId = await envioCrudService.agregarCostoLanded(envioId, {
          categoriaCostoId: 'aduana',
          categoriaCostoNombre: 'Aduana',
          descripcion: descripcionGastos || `Liberación aduanera — ${unidadIds.length} unidad(es)`,
          monto: gastosPEN,
          moneda: 'PEN',
          montoPEN: gastosPEN,
          metodoProrrateo: 'fijo_por_unidad',
          estado: 'confirmado',
          pagado: false,
        }, userId);
        await envioCrudService.materializarCostoLandedConfirmado(envioId, costoId, userId);
      } catch (err) {
        logger.error('Error registrando gastos aduana como CostoLanded (no bloqueante):', err);
      }
    }

    logger.success(`Envío ${envio.numeroEnvio}: ${unidadIds.length} unidad(es) liberadas de aduana${gastosPEN > 0 ? ` con gastos S/ ${gastosPEN.toFixed(2)}` : ''}`);
  },
};
