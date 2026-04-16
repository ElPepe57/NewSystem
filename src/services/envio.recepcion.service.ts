import {
  doc, updateDoc, writeBatch, getDoc, Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { envioCrudService } from './envio.crud.service';
import { getCostoBasePEN, getTC } from '../utils/ctru.utils';
import type { Envio, EstadoEnvio, RecepcionEnvio, EnvioUnidad, CostoLanded, MetodoProrrateo } from '../types/envio.types';
import type { Unidad, EstadoUnidad, MovimientoUnidad } from '../types/unidad.types';

const ENVIOS_COLL = COLLECTIONS.ENVIOS;
const UNIDADES_COLL = COLLECTIONS.UNIDADES;
const BATCH_LIMIT = 450;

/**
 * Prorratea un monto entre unidades segun el metodo indicado
 */
function prorratearCosto(
  costo: CostoLanded,
  unidades: EnvioUnidad[],
  productosInfo?: Map<string, { costoUSD: number; pesoLb: number }>
): Map<string, number> {
  const resultado = new Map<string, number>();
  const totalUnidades = unidades.length;

  if (totalUnidades === 0) return resultado;

  switch (costo.metodoProrrateo) {
    case 'fijo_por_unidad': {
      const montoPorUnidad = costo.montoPEN / totalUnidades;
      for (const u of unidades) {
        resultado.set(u.unidadId, montoPorUnidad);
      }
      break;
    }

    case 'variado_por_producto': {
      if (!costo.detalleVariado) {
        // Fallback a fijo si no hay detalle
        const montoPorUnidad = costo.montoPEN / totalUnidades;
        for (const u of unidades) resultado.set(u.unidadId, montoPorUnidad);
      } else {
        for (const u of unidades) {
          resultado.set(u.unidadId, costo.detalleVariado[u.productoId] || 0);
        }
      }
      break;
    }

    case 'total_por_peso': {
      let pesoTotal = 0;
      for (const u of unidades) {
        pesoTotal += u.pesoLibras || 1; // fallback 1 lb si no tiene peso
      }
      for (const u of unidades) {
        const peso = u.pesoLibras || 1;
        resultado.set(u.unidadId, costo.montoPEN * (peso / pesoTotal));
      }
      break;
    }

    case 'total_por_valor': {
      let valorTotal = 0;
      for (const u of unidades) {
        const info = productosInfo?.get(u.productoId);
        valorTotal += info?.costoUSD || 1;
      }
      for (const u of unidades) {
        const info = productosInfo?.get(u.productoId);
        const valor = info?.costoUSD || 1;
        resultado.set(u.unidadId, costo.montoPEN * (valor / valorTotal));
      }
      break;
    }

    default: {
      const montoPorUnidad = costo.montoPEN / totalUnidades;
      for (const u of unidades) resultado.set(u.unidadId, montoPorUnidad);
    }
  }

  return resultado;
}

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
   */
  async registrarRecepcion(
    formData: import('../types/envio.types').RecepcionEnvioFormData,
    userId: string
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

    // Calcular prorrateo de costos landed para CADA unidad recibida
    const costosLandedPorUnidad = new Map<string, number>();
    if (envio.costosLanded.length > 0) {
      const unidadesPendientes = envio.unidades.filter(
        u => u.estadoEnvio === 'pendiente' || u.estadoEnvio === 'enviada'
      );

      for (const costo of envio.costosLanded) {
        const prorrateo = prorratearCosto(costo, unidadesPendientes);
        for (const [unidadId, monto] of prorrateo) {
          costosLandedPorUnidad.set(
            unidadId,
            (costosLandedPorUnidad.get(unidadId) || 0) + monto
          );
        }
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

      if (!ur.recibida) {
        if (ur.perdida) {
          estadoEnvio = 'perdida'; resultado = 'perdida'; faltEnEsta++;
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
          // Faltante/perdida — perdida explicita o mantener en transito (faltante, puede llegar despues)
          const estadoNuevo: EstadoUnidad = ur.perdida ? 'perdida' : 'en_transito';
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
    const totalPendientes = unidadesActualizadas.filter(u => u.estadoEnvio === 'enviada' || u.estadoEnvio === 'pendiente').length;

    // S39: solo es "completa" si TODO fue recibido (incluye dañadas como procesadas).
    // Faltantes = no recibidas aún = parcial (pueden llegar después).
    const estadoFinal: EstadoEnvio =
      totalPendientes === 0 && totalFaltantes === 0
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
      ...(envio.estado === 'en_transito' ? { fechaLlegadaReal: now } : {}),
      actualizadoPor: userId,
      fechaActualizacion: now,
    });

    await batch.commit();

    logger.success(`Envio ${envio.numeroEnvio}: recepcion ${nuevaRecepcion.numero} — ${recEnEsta} recibidas, ${faltEnEsta} faltantes, ${danEnEsta} danadas`);

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
};
