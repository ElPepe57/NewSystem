/**
 * Servicio de Tareas del Día
 * Consolida pendientes operativos de múltiples fuentes en una lista priorizada.
 *
 * IMPORTANTE: Recibe datos pre-cargados desde los stores del Dashboard para evitar
 * nuevas queries a Firestore. No realiza lecturas directas a la base de datos.
 */

import { logger } from '../lib/logger';
import type { Venta } from '../types/venta.types';
import type { OrdenCompra } from '../types/ordenCompra.types';
import type { Cotizacion } from '../types/cotizacion.types';
import type { Requerimiento } from '../types/requerimiento.types';
import type { Transferencia } from '../types/transferencia.types';
import type { UserRole } from '../types/auth.types';
import type {
  TareaDia,
  CategoriaTarea,
  PrioridadTarea,
  ResumenTareasDia,
} from '../types/tareasDia.types';

// ============================================================
// TIPO INTERNO CON SCORE PARA ORDENAMIENTO
// ============================================================

type TareaConScore = TareaDia & { _score: number };

// ============================================================
// CONFIGURACIÓN DE ROLES
// ============================================================

const CATEGORIAS_POR_ROL: Record<UserRole, CategoriaTarea[]> = {
  admin: [
    'entrega_pendiente',
    'cobro_vencido',
    'oc_por_recibir',
    'cotizacion_por_vencer',
    'requerimiento_urgente',
    'transferencia_por_recibir',
  ],
  gerente: [
    'entrega_pendiente',
    'cobro_vencido',
    'oc_por_recibir',
    'cotizacion_por_vencer',
    'requerimiento_urgente',
    'transferencia_por_recibir',
  ],
  vendedor: ['cobro_vencido', 'cotizacion_por_vencer', 'entrega_pendiente'],
  finanzas: ['cobro_vencido', 'oc_por_recibir'],
  comprador: ['oc_por_recibir', 'requerimiento_urgente', 'transferencia_por_recibir'],
  almacenero: ['oc_por_recibir', 'transferencia_por_recibir', 'entrega_pendiente'],
  supervisor: [
    'entrega_pendiente',
    'cobro_vencido',
    'oc_por_recibir',
    'cotizacion_por_vencer',
    'requerimiento_urgente',
    'transferencia_por_recibir',
  ],
  invitado: [],
};

// ============================================================
// HELPERS DE PRIORIDAD
// ============================================================

const SCORE_BASE: Record<PrioridadTarea, number> = {
  critica: 1000,
  alta: 100,
  media: 10,
  baja: 1,
};

function calcularScore(prioridad: PrioridadTarea, diasAtraso = 0, monto = 0): number {
  const bonusAtraso = Math.max(0, diasAtraso) * 5;
  const bonusMonto = monto > 1000 ? 3 : monto > 500 ? 1 : 0;
  return SCORE_BASE[prioridad] + bonusAtraso + bonusMonto;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function timestampToDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate() as Date;
  if (ts instanceof Date) return ts;
  return null;
}

function diasDesdeHoy(fecha: Date): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.floor((hoy.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
}

function diasHastaFecha(fecha: Date): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

// ============================================================
// EXTRACTORES POR CATEGORÍA
// ============================================================

function extraerEntregasPendientes(ventas: Venta[]): TareaConScore[] {
  const estadosEntrega = ['en_entrega', 'despachada', 'asignada'];
  return ventas
    .filter(v => estadosEntrega.includes(v.estado))
    .map(v => {
      const fechaRef =
        timestampToDate(v.fechaEnEntrega) ?? timestampToDate(v.fechaCreacion) ?? new Date();
      const diasSinEntregar = diasDesdeHoy(fechaRef);
      const prioridad: PrioridadTarea =
        diasSinEntregar > 3 ? 'critica' : diasSinEntregar > 1 ? 'alta' : 'media';

      return {
        id: `entrega-${v.id}`,
        categoria: 'entrega_pendiente' as CategoriaTarea,
        prioridad,
        titulo: `Entrega pendiente: ${v.numeroVenta}`,
        subtitulo: `${v.nombreCliente}`,
        diasRestantes: -diasSinEntregar,
        monto: v.totalPEN,
        moneda: 'PEN' as const,
        rutaDestino: '/ventas',
        documentoId: v.id,
        _score: calcularScore(prioridad, diasSinEntregar, v.totalPEN),
      };
    });
}

function extraerCobrosVencidos(ventas: Venta[]): TareaConScore[] {
  const DIAS_VENCIDO = 7;

  return ventas
    .filter(v => {
      if (v.estadoPago === 'pagado') return false;
      if (v.estado === 'cancelada' || v.estado === 'cotizacion') return false;
      if (!v.montoPendiente || v.montoPendiente <= 0) return false;
      const fechaCreacion = timestampToDate(v.fechaCreacion);
      if (!fechaCreacion) return false;
      return diasDesdeHoy(fechaCreacion) >= DIAS_VENCIDO;
    })
    .map(v => {
      const fechaCreacion = timestampToDate(v.fechaCreacion) ?? new Date();
      const diasAtraso = diasDesdeHoy(fechaCreacion);
      const prioridad: PrioridadTarea =
        diasAtraso > 30 ? 'critica' : diasAtraso > 14 ? 'alta' : 'media';

      return {
        id: `cobro-${v.id}`,
        categoria: 'cobro_vencido' as CategoriaTarea,
        prioridad,
        titulo: `Cobro vencido: ${v.numeroVenta}`,
        subtitulo: `${v.nombreCliente} · ${diasAtraso}d de atraso`,
        diasRestantes: -diasAtraso,
        monto: v.montoPendiente,
        moneda: 'PEN' as const,
        rutaDestino: '/ventas',
        documentoId: v.id,
        _score: calcularScore(prioridad, diasAtraso, v.montoPendiente ?? 0),
      };
    });
}

function extraerOCPorRecibir(ordenes: OrdenCompra[]): TareaConScore[] {
  const estadosActivos = ['enviada', 'en_transito'];
  return ordenes
    .filter(o => estadosActivos.includes(o.estado))
    .map(o => {
      const fechaRef =
        timestampToDate(o.fechaEnTransito) ?? timestampToDate(o.fechaEnviada) ?? new Date();
      const diasEsperando = diasDesdeHoy(fechaRef);
      const prioridad: PrioridadTarea =
        diasEsperando > 30 ? 'alta' : diasEsperando > 14 ? 'media' : 'baja';

      return {
        id: `oc-${o.id}`,
        categoria: 'oc_por_recibir' as CategoriaTarea,
        prioridad,
        titulo: `OC en tránsito: ${o.numeroOrden}`,
        subtitulo: `${o.nombreProveedor} · ${diasEsperando}d en tránsito`,
        diasRestantes: -diasEsperando,
        monto: o.totalUSD,
        moneda: 'USD' as const,
        rutaDestino: '/ordenes-compra',
        documentoId: o.id,
        _score: calcularScore(prioridad, diasEsperando, o.totalUSD),
      };
    });
}

function extraerCotizacionesPorVencer(cotizaciones: Cotizacion[]): TareaConScore[] {
  const DIAS_ALERTA = 3;

  return cotizaciones
    .filter(c => {
      if (!['nueva', 'validada', 'pendiente_adelanto'].includes(c.estado)) return false;
      if (!c.fechaVencimiento) return false;
      const fechaVenc = timestampToDate(c.fechaVencimiento);
      if (!fechaVenc) return false;
      return diasHastaFecha(fechaVenc) <= DIAS_ALERTA;
    })
    .map(c => {
      const fechaVenc = timestampToDate(c.fechaVencimiento!)!;
      const diasRestantes = diasHastaFecha(fechaVenc);
      const prioridad: PrioridadTarea =
        diasRestantes <= 0 ? 'critica' : diasRestantes <= 1 ? 'alta' : 'media';

      return {
        id: `cot-${c.id}`,
        categoria: 'cotizacion_por_vencer' as CategoriaTarea,
        prioridad,
        titulo: `Cotización por vencer: ${c.numeroCotizacion}`,
        subtitulo: `${c.nombreCliente} · ${diasRestantes <= 0 ? 'Vencida' : `${diasRestantes}d restantes`}`,
        fechaLimite: fechaVenc,
        diasRestantes,
        monto: c.totalPEN,
        moneda: 'PEN' as const,
        rutaDestino: '/cotizaciones',
        documentoId: c.id,
        _score: calcularScore(prioridad, Math.max(0, -diasRestantes), c.totalPEN),
      };
    });
}

function extraerRequerimientosUrgentes(requerimientos: Requerimiento[]): TareaConScore[] {
  return requerimientos
    .filter(r => {
      if (['completado', 'cancelado'].includes(r.estado)) return false;
      if (r.prioridad !== 'urgente' && r.prioridad !== 'alta') return false;
      const tieneOC = !!(
        r.ordenCompraId ||
        (r.ordenCompraIds && r.ordenCompraIds.length > 0)
      );
      return !tieneOC;
    })
    .map(r => {
      const fechaRef = timestampToDate(r.fechaSolicitud) ?? new Date();
      const diasSinAtender = diasDesdeHoy(fechaRef);
      const prioridad: PrioridadTarea = r.prioridad === 'urgente' ? 'critica' : 'alta';

      return {
        id: `req-${r.id}`,
        categoria: 'requerimiento_urgente' as CategoriaTarea,
        prioridad,
        titulo: `Req. urgente sin OC: ${r.numeroRequerimiento}`,
        subtitulo: `${r.productos.length} producto(s) · ${diasSinAtender}d pendiente`,
        diasRestantes: -diasSinAtender,
        rutaDestino: '/requerimientos',
        documentoId: r.id,
        _score: calcularScore(prioridad, diasSinAtender),
      };
    });
}

function extraerTransferenciasPorRecibir(transferencias: Transferencia[]): TareaConScore[] {
  return transferencias
    .filter(t => t.estado === 'en_transito')
    .map(t => {
      const fechaRef =
        timestampToDate(t.fechaSalida) ?? timestampToDate(t.fechaCreacion) ?? new Date();
      const diasEnTransito = diasDesdeHoy(fechaRef);
      const prioridad: PrioridadTarea = diasEnTransito > 20 ? 'alta' : 'media';

      return {
        id: `trf-${t.id}`,
        categoria: 'transferencia_por_recibir' as CategoriaTarea,
        prioridad,
        titulo: `Transferencia en tránsito: ${t.numeroTransferencia}`,
        subtitulo: `${t.almacenOrigenNombre} → ${t.almacenDestinoNombre} · ${diasEnTransito}d`,
        diasRestantes: -diasEnTransito,
        rutaDestino: '/transferencias',
        documentoId: t.id,
        _score: calcularScore(prioridad, diasEnTransito),
      };
    });
}

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

export interface InputTareasDia {
  ventas: Venta[];
  ordenes: OrdenCompra[];
  cotizaciones: Cotizacion[];
  requerimientos: Requerimiento[];
  transferencias: Transferencia[];
  rol: UserRole;
}

export function calcularTareasDia(input: InputTareasDia): ResumenTareasDia {
  const { ventas, ordenes, cotizaciones, requerimientos, transferencias, rol } = input;
  const categoriasPermitidas = CATEGORIAS_POR_ROL[rol] ?? [];

  try {
    const candidatos: TareaConScore[] = [];

    if (categoriasPermitidas.includes('entrega_pendiente')) {
      candidatos.push(...extraerEntregasPendientes(ventas));
    }
    if (categoriasPermitidas.includes('cobro_vencido')) {
      candidatos.push(...extraerCobrosVencidos(ventas));
    }
    if (categoriasPermitidas.includes('oc_por_recibir')) {
      candidatos.push(...extraerOCPorRecibir(ordenes));
    }
    if (categoriasPermitidas.includes('cotizacion_por_vencer')) {
      candidatos.push(...extraerCotizacionesPorVencer(cotizaciones));
    }
    if (categoriasPermitidas.includes('requerimiento_urgente')) {
      candidatos.push(...extraerRequerimientosUrgentes(requerimientos));
    }
    if (categoriasPermitidas.includes('transferencia_por_recibir')) {
      candidatos.push(...extraerTransferenciasPorRecibir(transferencias));
    }

    // Ordenar por score descendente
    candidatos.sort((a, b) => b._score - a._score);

    // Extraer campo interno _score antes de devolver
    const tareas: TareaDia[] = candidatos.map(({ _score: _s, ...tarea }) => tarea);

    const resumen = {
      total: tareas.length,
      criticas: tareas.filter(t => t.prioridad === 'critica').length,
      altas: tareas.filter(t => t.prioridad === 'alta').length,
      medias: tareas.filter(t => t.prioridad === 'media').length,
      bajas: tareas.filter(t => t.prioridad === 'baja').length,
    };

    logger.debug('[TareasDia] Calculadas', resumen);

    return { fecha: new Date(), tareas, resumen };
  } catch (error) {
    logger.error('[TareasDia] Error al calcular tareas del día', error);
    return {
      fecha: new Date(),
      tareas: [],
      resumen: { total: 0, criticas: 0, altas: 0, medias: 0, bajas: 0 },
    };
  }
}
