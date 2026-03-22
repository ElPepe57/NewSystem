/**
 * Servicio de Cierre Contable Mensual
 *
 * Gestiona el ciclo de vida del cierre de periodos contables:
 * validacion pre-cierre, ejecucion del cierre con snapshot,
 * reapertura con justificacion, e historial completo.
 */

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  orderBy,
  Timestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { contabilidadService } from './contabilidad.service';
import { tipoCambioService } from './tipoCambio.service';
import { logger } from '../lib/logger';
import type {
  CierreContable,
  ValidacionPreCierre,
  ResultadoValidacion,
  SnapshotCierre,
} from '../types/cierreContable.types';

// ============================================================================
// CACHE EN MEMORIA
// ============================================================================

interface CacheEntry {
  cierre: CierreContable | null;
  timestamp: number;
}

const TTL_MS = 30_000; // 30 segundos
const _cache = new Map<string, CacheEntry>();

function periodoKey(mes: number, anio: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

function getCached(key: string): CierreContable | null | undefined {
  const entry = _cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > TTL_MS) {
    _cache.delete(key);
    return undefined;
  }
  return entry.cierre;
}

function setCache(key: string, cierre: CierreContable | null): void {
  _cache.set(key, { cierre, timestamp: Date.now() });
}

function invalidateCache(key?: string): void {
  if (key) {
    _cache.delete(key);
  } else {
    _cache.clear();
  }
}

// ============================================================================
// VALIDACIONES PRE-CIERRE
// ============================================================================

async function validarVentasPendientes(mes: number, anio: number): Promise<ValidacionPreCierre> {
  try {
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 0, 23, 59, 59);

    const q = query(
      collection(db, COLLECTIONS.VENTAS),
      where('fechaEntrega', '>=', Timestamp.fromDate(inicio)),
      where('fechaEntrega', '<=', Timestamp.fromDate(fin))
    );
    const snap = await getDocs(q);
    const pendientes = snap.docs.filter(d => {
      const data = d.data();
      return data.estado === 'pendiente' || data.estado === 'en_proceso';
    });

    return {
      id: 'ventas-pendientes',
      nombre: 'Ventas del mes sin estado final',
      severidad: 'advertencia',
      resultado: pendientes.length === 0 ? 'aprobada' : 'advertencia',
      detalle: pendientes.length === 0
        ? 'Todas las ventas del periodo tienen estado final'
        : `${pendientes.length} venta(s) aun en estado pendiente o en proceso`,
    };
  } catch (error) {
    logger.error('Error validando ventas pendientes:', error);
    return {
      id: 'ventas-pendientes',
      nombre: 'Ventas del mes sin estado final',
      severidad: 'advertencia',
      resultado: 'advertencia',
      detalle: 'No se pudo verificar el estado de las ventas',
    };
  }
}

async function validarPagosParciales(mes: number, anio: number): Promise<ValidacionPreCierre> {
  try {
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 0, 23, 59, 59);

    const q = query(
      collection(db, COLLECTIONS.VENTAS),
      where('fechaEntrega', '>=', Timestamp.fromDate(inicio)),
      where('fechaEntrega', '<=', Timestamp.fromDate(fin))
    );
    const snap = await getDocs(q);
    const parciales = snap.docs.filter(d => {
      const data = d.data();
      return data.estadoPago === 'parcial';
    });

    return {
      id: 'pagos-parciales',
      nombre: 'Pagos parciales registrados',
      severidad: 'advertencia',
      resultado: parciales.length === 0 ? 'aprobada' : 'advertencia',
      detalle: parciales.length === 0
        ? 'No hay ventas con pago parcial en el periodo'
        : `${parciales.length} venta(s) con pago parcial pendiente`,
    };
  } catch (error) {
    logger.error('Error validando pagos parciales:', error);
    return {
      id: 'pagos-parciales',
      nombre: 'Pagos parciales registrados',
      severidad: 'advertencia',
      resultado: 'advertencia',
      detalle: 'No se pudo verificar el estado de pagos',
    };
  }
}

async function validarGastosCompletos(mes: number, anio: number): Promise<ValidacionPreCierre> {
  try {
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 0, 23, 59, 59);

    const q = query(
      collection(db, COLLECTIONS.GASTOS),
      where('fecha', '>=', Timestamp.fromDate(inicio)),
      where('fecha', '<=', Timestamp.fromDate(fin))
    );
    const snap = await getDocs(q);
    const sinComprobante = snap.docs.filter(d => {
      const data = d.data();
      return !data.comprobante && !data.numeroComprobante;
    });

    return {
      id: 'gastos-completos',
      nombre: 'Gastos del mes completos',
      severidad: 'advertencia',
      resultado: sinComprobante.length === 0 ? 'aprobada' : 'advertencia',
      detalle: sinComprobante.length === 0
        ? `${snap.size} gasto(s) registrados, todos con comprobante`
        : `${sinComprobante.length} de ${snap.size} gasto(s) sin comprobante adjunto`,
    };
  } catch (error) {
    logger.error('Error validando gastos:', error);
    return {
      id: 'gastos-completos',
      nombre: 'Gastos del mes completos',
      severidad: 'advertencia',
      resultado: 'advertencia',
      detalle: 'No se pudo verificar el estado de los gastos',
    };
  }
}

async function validarOCsRecibidas(mes: number, anio: number): Promise<ValidacionPreCierre> {
  try {
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 0, 23, 59, 59);

    const q = query(
      collection(db, COLLECTIONS.ORDENES_COMPRA),
      where('fechaCreacion', '>=', Timestamp.fromDate(inicio)),
      where('fechaCreacion', '<=', Timestamp.fromDate(fin))
    );
    const snap = await getDocs(q);
    const sinRecibir = snap.docs.filter(d => {
      const data = d.data();
      return data.estado !== 'recibida' && data.estado !== 'cancelada';
    });

    return {
      id: 'ocs-recibidas',
      nombre: 'OCs del mes recibidas',
      severidad: 'advertencia',
      resultado: sinRecibir.length === 0 ? 'aprobada' : 'advertencia',
      detalle: sinRecibir.length === 0
        ? `Todas las OCs del periodo estan recibidas o canceladas`
        : `${sinRecibir.length} OC(s) aun sin recibir`,
    };
  } catch (error) {
    logger.error('Error validando OCs:', error);
    return {
      id: 'ocs-recibidas',
      nombre: 'OCs del mes recibidas',
      severidad: 'advertencia',
      resultado: 'advertencia',
      detalle: 'No se pudo verificar el estado de las ordenes de compra',
    };
  }
}

async function validarBalanceCuadra(mes: number, anio: number): Promise<ValidacionPreCierre> {
  try {
    const balance = await contabilidadService.generarBalanceGeneral(mes, anio);

    return {
      id: 'balance-cuadra',
      nombre: 'Balance general cuadra (A = P + Pat)',
      severidad: 'critica',
      resultado: balance.balanceCuadra ? 'aprobada' : 'rechazada',
      detalle: balance.balanceCuadra
        ? `Balance cuadra: Activos ${balance.activos.totalActivos.toFixed(2)} = P+Pat ${balance.totalPasivosPatrimonio.toFixed(2)}`
        : `Descuadre de ${Math.abs(balance.diferencia).toFixed(2)} PEN (Activos: ${balance.activos.totalActivos.toFixed(2)}, P+Pat: ${balance.totalPasivosPatrimonio.toFixed(2)})`,
    };
  } catch (error) {
    logger.error('Error validando balance:', error);
    return {
      id: 'balance-cuadra',
      nombre: 'Balance general cuadra (A = P + Pat)',
      severidad: 'critica',
      resultado: 'rechazada',
      detalle: 'No se pudo generar el balance general para validar',
    };
  }
}

async function validarNoExisteCierrePrevio(mes: number, anio: number): Promise<ValidacionPreCierre> {
  try {
    const cierre = await getCierreInterno(mes, anio);

    return {
      id: 'no-cierre-previo',
      nombre: 'No existe cierre previo para este periodo',
      severidad: 'critica',
      resultado: !cierre || cierre.estado === 'reabierto' ? 'aprobada' : 'rechazada',
      detalle: !cierre
        ? 'El periodo no ha sido cerrado previamente'
        : cierre.estado === 'reabierto'
          ? 'El periodo fue reabierto y puede cerrarse nuevamente'
          : `El periodo ya fue cerrado el ${cierre.fechaCierre instanceof Date ? cierre.fechaCierre.toLocaleDateString() : 'fecha desconocida'}`,
    };
  } catch (error) {
    logger.error('Error verificando cierre previo:', error);
    return {
      id: 'no-cierre-previo',
      nombre: 'No existe cierre previo para este periodo',
      severidad: 'critica',
      resultado: 'rechazada',
      detalle: 'No se pudo verificar si existe un cierre previo',
    };
  }
}

async function validarPeriodoAnteriorCerrado(mes: number, anio: number): Promise<ValidacionPreCierre> {
  try {
    // Primer periodo: no requiere periodo anterior
    const mesAnt = mes === 1 ? 12 : mes - 1;
    const anioAnt = mes === 1 ? anio - 1 : anio;

    // Si es enero 2024 o anterior, se considera primer cierre posible
    if (anioAnt < 2024) {
      return {
        id: 'periodo-anterior-cerrado',
        nombre: 'Periodo anterior cerrado',
        severidad: 'critica',
        resultado: 'aprobada',
        detalle: 'Primer periodo contable, no requiere cierre anterior',
      };
    }

    const cierreAnterior = await getCierreInterno(mesAnt, anioAnt);

    return {
      id: 'periodo-anterior-cerrado',
      nombre: 'Periodo anterior cerrado',
      severidad: 'critica',
      resultado: cierreAnterior && cierreAnterior.estado === 'cerrado' ? 'aprobada' : 'rechazada',
      detalle: cierreAnterior && cierreAnterior.estado === 'cerrado'
        ? `Periodo ${periodoKey(mesAnt, anioAnt)} cerrado correctamente`
        : `El periodo anterior (${periodoKey(mesAnt, anioAnt)}) no ha sido cerrado`,
    };
  } catch (error) {
    logger.error('Error verificando periodo anterior:', error);
    return {
      id: 'periodo-anterior-cerrado',
      nombre: 'Periodo anterior cerrado',
      severidad: 'critica',
      resultado: 'rechazada',
      detalle: 'No se pudo verificar el cierre del periodo anterior',
    };
  }
}

// ============================================================================
// FUNCIONES INTERNAS
// ============================================================================

async function getCierreInterno(mes: number, anio: number): Promise<CierreContable | null> {
  const key = periodoKey(mes, anio);
  const cached = getCached(key);
  if (cached !== undefined) return cached;

  const q = query(
    collection(db, COLLECTIONS.CIERRES_CONTABLES),
    where('periodoKey', '==', key),
    limit(1)
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    setCache(key, null);
    return null;
  }

  const docData = snap.docs[0];
  const data = docData.data();
  const cierre: CierreContable = {
    id: docData.id,
    mes: data.mes,
    anio: data.anio,
    periodoKey: data.periodoKey,
    estado: data.estado,
    fechaCierre: data.fechaCierre?.toDate?.() ?? new Date(data.fechaCierre),
    cerradoPor: data.cerradoPor,
    validaciones: data.validaciones || [],
    snapshot: data.snapshot,
    reapertura: data.reapertura
      ? {
          ...data.reapertura,
          fecha: data.reapertura.fecha?.toDate?.() ?? new Date(data.reapertura.fecha),
        }
      : undefined,
  };

  setCache(key, cierre);
  return cierre;
}

async function generarSnapshot(mes: number, anio: number): Promise<SnapshotCierre> {
  const [estadoResultados, balanceGeneral, indicadoresFinancieros] = await Promise.all([
    contabilidadService.generarEstadoResultados(mes, anio),
    contabilidadService.generarBalanceGeneral(mes, anio),
    contabilidadService.calcularIndicadoresFinancieros(mes, anio),
  ]);

  let tipoCambioAlCierre = 0;
  try {
    const tc = await tipoCambioService.resolverTCVenta();
    tipoCambioAlCierre = tc;
  } catch {
    tipoCambioAlCierre = balanceGeneral.tipoCambio || 0;
  }

  return {
    estadoResultados,
    balanceGeneral,
    indicadoresFinancieros,
    totalVentas: estadoResultados.ventasNetas,
    totalGastos: estadoResultados.totalGastosOperativos,
    totalCompras: estadoResultados.compras.total,
    unidadesVendidas: estadoResultados.metricas.unidadesVendidas,
    tipoCambioAlCierre,
  };
}

// ============================================================================
// API PUBLICA
// ============================================================================

/**
 * Ejecuta las 7 validaciones pre-cierre y retorna el resultado agregado
 */
async function validarPreCierre(mes: number, anio: number): Promise<ResultadoValidacion> {
  const validaciones = await Promise.all([
    validarVentasPendientes(mes, anio),
    validarPagosParciales(mes, anio),
    validarGastosCompletos(mes, anio),
    validarOCsRecibidas(mes, anio),
    validarBalanceCuadra(mes, anio),
    validarNoExisteCierrePrevio(mes, anio),
    validarPeriodoAnteriorCerrado(mes, anio),
  ]);

  const criticas = validaciones.filter(
    v => v.severidad === 'critica' && v.resultado === 'rechazada'
  ).length;
  const advertencias = validaciones.filter(
    v => v.resultado === 'advertencia'
  ).length;

  return {
    validaciones,
    puedesCerrar: criticas === 0,
    advertencias,
    criticas,
  };
}

/**
 * Ejecuta el cierre contable: valida, genera snapshot, persiste en Firestore
 */
async function ejecutarCierre(
  mes: number,
  anio: number,
  userId: string
): Promise<CierreContable> {
  // 1. Validar
  const resultado = await validarPreCierre(mes, anio);
  if (!resultado.puedesCerrar) {
    throw new Error(
      `No se puede cerrar el periodo: ${resultado.criticas} validacion(es) critica(s) rechazada(s)`
    );
  }

  // 2. Generar snapshot
  const snapshot = await generarSnapshot(mes, anio);

  // 3. Construir documento
  const cierre: Omit<CierreContable, 'id'> = {
    mes,
    anio,
    periodoKey: periodoKey(mes, anio),
    estado: 'cerrado',
    fechaCierre: new Date(),
    cerradoPor: userId,
    validaciones: resultado.validaciones,
    snapshot,
  };

  // 4. Guardar en Firestore
  const docRef = await addDoc(
    collection(db, COLLECTIONS.CIERRES_CONTABLES),
    {
      ...cierre,
      fechaCierre: Timestamp.fromDate(cierre.fechaCierre),
    }
  );

  const cierreCompleto: CierreContable = {
    ...cierre,
    id: docRef.id,
  };

  // 5. Invalidar cache
  invalidateCache(periodoKey(mes, anio));

  logger.info(`Cierre contable ejecutado: ${periodoKey(mes, anio)} por ${userId}`);
  return cierreCompleto;
}

/**
 * Reabre un cierre contable previamente cerrado
 */
async function reabrir(
  cierreId: string,
  motivo: string,
  userId: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.CIERRES_CONTABLES, cierreId);

  // Obtener cierre actual para guardar snapshot anterior
  const q = query(
    collection(db, COLLECTIONS.CIERRES_CONTABLES),
    where('__name__', '==', cierreId)
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    throw new Error('Cierre no encontrado');
  }

  const data = snap.docs[0].data();

  await updateDoc(docRef, {
    estado: 'reabierto',
    reapertura: {
      fecha: Timestamp.fromDate(new Date()),
      motivo,
      usuario: userId,
      snapshotAnterior: data.snapshot,
    },
  });

  // Invalidar cache
  invalidateCache(data.periodoKey);
  logger.info(`Cierre contable reabierto: ${data.periodoKey} por ${userId} — Motivo: ${motivo}`);
}

/**
 * Obtiene el cierre activo para un periodo dado
 */
async function getCierre(mes: number, anio: number): Promise<CierreContable | null> {
  return getCierreInterno(mes, anio);
}

/**
 * Lista todos los cierres ordenados por periodo (descendente)
 */
async function getHistorial(): Promise<CierreContable[]> {
  const q = query(
    collection(db, COLLECTIONS.CIERRES_CONTABLES),
    orderBy('anio', 'desc'),
    orderBy('mes', 'desc')
  );
  const snap = await getDocs(q);

  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      mes: data.mes,
      anio: data.anio,
      periodoKey: data.periodoKey,
      estado: data.estado,
      fechaCierre: data.fechaCierre?.toDate?.() ?? new Date(data.fechaCierre),
      cerradoPor: data.cerradoPor,
      validaciones: data.validaciones || [],
      snapshot: data.snapshot,
      reapertura: data.reapertura
        ? {
            ...data.reapertura,
            fecha: data.reapertura.fecha?.toDate?.() ?? new Date(data.reapertura.fecha),
          }
        : undefined,
    } as CierreContable;
  });
}

/**
 * Verifica si un periodo esta cerrado. Lanza error si lo esta.
 * Usar en otros servicios antes de permitir modificaciones.
 */
async function verificarPeriodoAbierto(mes: number, anio: number): Promise<void> {
  const cierre = await getCierreInterno(mes, anio);
  if (cierre && cierre.estado === 'cerrado') {
    throw new Error(
      `El periodo ${periodoKey(mes, anio)} esta cerrado. Debe reabrirse antes de realizar modificaciones.`
    );
  }
}

// ============================================================================
// EXPORTACION
// ============================================================================

export const cierreContableService = {
  validarPreCierre,
  ejecutarCierre,
  reabrir,
  getCierre,
  getHistorial,
  verificarPeriodoAbierto,
};
