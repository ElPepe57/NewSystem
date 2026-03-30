/**
 * Servicio de reportes logísticos.
 * Orquesta datos de transferencias + almacenes para generar
 * métricas de rendimiento por viajero/courier.
 */

import { transferenciaService } from './transferencia.service';
import { almacenService } from './almacen.service';
import type { Transferencia } from '../types/transferencia.types';
import type { Almacen } from '../types/almacen.types';
import { logger } from '../lib/logger';

// ---- Tipos ----
export interface RendimientoViajero {
  viajeroId: string;
  viajeroNombre: string;
  tipo: string; // viajero | courier
  enviosTotales: number;
  enviosATiempo: number;
  enviosAtrasados: number;
  tasaCumplimiento: number; // %
  diasPromedioTransito: number;
  tarifaPromedioUSD: number; // flete/unidad promedio
  unidadesTransportadas: number;
  unidadesRecibidas: number;
  unidadesDanadas: number;
  unidadesFaltantes: number;
  tasaIntegridad: number; // %
  montoPendientePagoUSD: number;
  costoFleteTotal: number;
  ultimoEnvio: Date | null;
  transferencias: TransferenciaResumen[];
}

export interface TransferenciaResumen {
  id: string;
  numero: string;
  fecha: Date;
  unidades: number;
  diasTransito: number | null;
  aTiempo: boolean | null;
  costoFlete: number;
  tarifaPorUnidad: number;
  estado: string;
  danadas: number;
  faltantes: number;
}

export interface ResumenLogistica {
  enviosEnTransito: number;
  unidadesEnTransito: number;
  diasPromedioTransitoGlobal: number;
  tasaCumplimientoGlobal: number;
  tarifaPromedioGlobal: number;
  costoFleteTotal: number;
  viajeros: RendimientoViajero[];
}

// ---- Servicio ----
export const logisticaReporteService = {
  async getResumenLogistica(): Promise<ResumenLogistica> {
    try {
      const [transferencias, almacenes] = await Promise.all([
        transferenciaService.getAll(),
        almacenService.getAll(),
      ]);

      // Solo transferencias internacionales (USA → Perú)
      const internacionales = transferencias.filter(t =>
        t.tipo === 'internacional_peru' || t.tipo === 'usa_peru'
      );

      // En tránsito
      const enTransito = internacionales.filter(t => t.estado === 'en_transito');
      const unidadesEnTransito = enTransito.reduce((s, t) => s + (t.totalUnidades || 0), 0);

      // Agrupar por viajero
      const viajeroMap = new Map<string, Transferencia[]>();
      for (const t of internacionales) {
        const key = t.viajeroId || t.viajeroNombre || t.courier || 'Sin asignar';
        const arr = viajeroMap.get(key) || [];
        arr.push(t);
        viajeroMap.set(key, arr);
      }

      const viajeros: RendimientoViajero[] = [];
      let totalDiasTransito = 0;
      let totalEnviosConDias = 0;
      let totalATiempo = 0;
      let totalEnviosConFecha = 0;
      let costoFleteGlobal = 0;
      let totalUnidadesGlobal = 0;

      for (const [key, trfs] of viajeroMap) {
        const almacen = almacenes.find(a =>
          a.id === trfs[0]?.viajeroId || a.nombre === key
        );

        const resultado = calcularRendimientoViajero(key, trfs, almacen);
        viajeros.push(resultado);

        // Acumulados globales
        costoFleteGlobal += resultado.costoFleteTotal;
        totalUnidadesGlobal += resultado.unidadesTransportadas;

        for (const t of resultado.transferencias) {
          if (t.diasTransito != null) {
            totalDiasTransito += t.diasTransito;
            totalEnviosConDias++;
          }
          if (t.aTiempo != null) {
            if (t.aTiempo) totalATiempo++;
            totalEnviosConFecha++;
          }
        }
      }

      // Ordenar por envíos totales desc
      viajeros.sort((a, b) => b.enviosTotales - a.enviosTotales);

      return {
        enviosEnTransito: enTransito.length,
        unidadesEnTransito,
        diasPromedioTransitoGlobal: totalEnviosConDias > 0 ? totalDiasTransito / totalEnviosConDias : 0,
        tasaCumplimientoGlobal: totalEnviosConFecha > 0 ? (totalATiempo / totalEnviosConFecha) * 100 : 0,
        tarifaPromedioGlobal: totalUnidadesGlobal > 0 ? costoFleteGlobal / totalUnidadesGlobal : 0,
        costoFleteTotal: costoFleteGlobal,
        viajeros,
      };
    } catch (error) {
      logger.error('[logisticaReporte] Error generando resumen:', error);
      throw error;
    }
  },
};

function calcularRendimientoViajero(
  nombre: string,
  transferencias: Transferencia[],
  almacen?: Almacen
): RendimientoViajero {
  const completadas = transferencias.filter(t =>
    t.estado === 'recibida_completa' || t.estado === 'recibida_parcial'
  );

  let enviosATiempo = 0;
  let enviosAtrasados = 0;
  let totalDias = 0;
  let enviosConDias = 0;
  let totalFlete = 0;
  let totalUnidades = 0;
  let totalRecibidas = 0;
  let totalDanadas = 0;
  let totalFaltantes = 0;
  let montoPendiente = 0;
  let ultimoEnvio: Date | null = null;

  const resumenTransferencias: TransferenciaResumen[] = [];

  for (const t of transferencias) {
    const fechaSalida = t.fechaSalida?.toDate?.();
    const fechaEstimada = t.fechaLlegadaEstimada?.toDate?.();
    const fechaReal = t.fechaLlegadaReal?.toDate?.();
    const dias = t.diasEnTransito || (fechaReal && fechaSalida
      ? Math.ceil((fechaReal.getTime() - fechaSalida.getTime()) / 86400000)
      : null);

    let aTiempo: boolean | null = null;
    if (fechaReal && fechaEstimada) {
      aTiempo = fechaReal <= fechaEstimada;
      if (aTiempo) enviosATiempo++;
      else enviosAtrasados++;
    }

    if (dias != null && dias > 0) {
      totalDias += dias;
      enviosConDias++;
    }

    const flete = t.costoFleteTotal || 0;
    const uds = t.totalUnidades || 0;
    totalFlete += flete;
    totalUnidades += uds;
    totalRecibidas += t.totalUnidadesRecibidas || 0;
    totalDanadas += t.totalUnidadesDanadas || 0;
    totalFaltantes += t.totalUnidadesFaltantes || 0;

    if (t.estadoPagoViajero === 'pendiente' || t.estadoPagoViajero === 'parcial') {
      montoPendiente += (t.montoPendienteUSD || flete - (t.montoPagadoUSD || 0));
    }

    const fecha = fechaSalida || t.fechaCreacion?.toDate?.();
    if (fecha && (!ultimoEnvio || fecha > ultimoEnvio)) {
      ultimoEnvio = fecha;
    }

    resumenTransferencias.push({
      id: t.id,
      numero: t.numeroTransferencia,
      fecha: fecha || new Date(),
      unidades: uds,
      diasTransito: dias,
      aTiempo,
      costoFlete: flete,
      tarifaPorUnidad: uds > 0 ? flete / uds : 0,
      estado: t.estado,
      danadas: t.totalUnidadesDanadas || 0,
      faltantes: t.totalUnidadesFaltantes || 0,
    });
  }

  // Ordenar por fecha desc
  resumenTransferencias.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  const enviosConFecha = enviosATiempo + enviosAtrasados;
  const integridadBase = totalUnidades > 0 ? totalUnidades - totalDanadas - totalFaltantes : 0;

  return {
    viajeroId: almacen?.id || nombre,
    viajeroNombre: nombre,
    tipo: almacen?.esViajero ? 'viajero' : 'courier',
    enviosTotales: transferencias.length,
    enviosATiempo,
    enviosAtrasados,
    tasaCumplimiento: enviosConFecha > 0 ? (enviosATiempo / enviosConFecha) * 100 : 0,
    diasPromedioTransito: enviosConDias > 0 ? totalDias / enviosConDias : 0,
    tarifaPromedioUSD: totalUnidades > 0 ? totalFlete / totalUnidades : 0,
    unidadesTransportadas: totalUnidades,
    unidadesRecibidas: totalRecibidas,
    unidadesDanadas: totalDanadas,
    unidadesFaltantes: totalFaltantes,
    tasaIntegridad: totalUnidades > 0 ? (integridadBase / totalUnidades) * 100 : 0,
    montoPendientePagoUSD: montoPendiente,
    costoFleteTotal: totalFlete,
    ultimoEnvio,
    transferencias: resumenTransferencias,
  };
}
