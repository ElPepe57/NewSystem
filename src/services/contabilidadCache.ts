/**
 * contabilidadCache.ts · chk5.PERF-CACHE (2026-05-29)
 *
 * SOLUCIÓN INTEGRAL de performance para las "vistas ejecutivas" del ERP.
 *
 * PROBLEMA (transversal · reportado por el usuario):
 *   generarEstadoResultados / generarBalanceGeneral son los cálculos contables
 *   base. Múltiples vistas los recalculan N veces (Contabilidad tendencia 6m,
 *   Inversionistas acumulados 12m, Perfil ResumenAdmin/Socio, Reportes, etc.).
 *   Sin cache, cada vista — y cada navegación entre vistas — recalcula los
 *   MISMOS meses desde cero. Los meses cerrados (que no cambian) se recalculan
 *   una y otra vez. Por eso "Cargando vista ejecutiva" se demora en varias secciones.
 *
 * SOLUCIÓN:
 *   Cache compartido en memoria (vida = sesión) que memoiza los cálculos por
 *   (mes, anio, lineaNegocioId). Beneficios:
 *     - Cross-módulo: si Contabilidad ya calculó junio, Inversionistas lo reusa.
 *     - Dedup concurrente: 12 llamadas paralelas al mismo mes → 1 sola ejecución.
 *     - TTL diferenciado: mes actual corto (datos vivos) · meses pasados largo.
 *     - Invalidación manual: invalidarContabilidadCache() tras registrar
 *       venta/gasto/movimiento → datos siempre frescos donde importa.
 *
 * NO cambia la lógica contable · es un wrapper memoizado sobre el service.
 * Para cálculos que requieren frescura garantizada (cierre, auditoría puntual),
 * llamar directamente a contabilidad.service (sin pasar por este cache).
 */

import {
  generarEstadoResultados,
  generarBalanceGeneral,
} from './contabilidad.service';

// Inferimos los tipos de retorno sin tener que importarlos explícitamente.
type EstadoResultados = Awaited<ReturnType<typeof generarEstadoResultados>>;
type BalanceGeneral = Awaited<ReturnType<typeof generarBalanceGeneral>>;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ─── TTL · mes actual/futuro vive poco (datos vivos) · meses pasados más ───
const TTL_MES_VIVO = 60 * 1000;        // 60s · mes actual o futuro
const TTL_MES_CERRADO = 10 * 60 * 1000; // 10 min · meses pasados (rara vez cambian)

function ttlPara(mes: number, anio: number): number {
  // NOTA: new Date() sin args es válido en runtime de app (no en workflow scripts).
  const ahora = new Date();
  const anioActual = ahora.getFullYear();
  const mesActual = ahora.getMonth() + 1;
  const esVivo = anio > anioActual || (anio === anioActual && mes >= mesActual);
  return esVivo ? TTL_MES_VIVO : TTL_MES_CERRADO;
}

function keyDe(mes: number, anio: number, lineaNegocioId?: string | null): string {
  return `${anio}-${String(mes).padStart(2, '0')}-${lineaNegocioId ?? 'all'}`;
}

// ─── Stores ─────────────────────────────────────────────────────────────
const estadoCache = new Map<string, CacheEntry<EstadoResultados>>();
const balanceCache = new Map<string, CacheEntry<BalanceGeneral>>();
// Promesas en vuelo · dedup de llamadas concurrentes al mismo (mes,anio,linea)
const estadoInflight = new Map<string, Promise<EstadoResultados>>();
const balanceInflight = new Map<string, Promise<BalanceGeneral>>();

// ─── Estado de resultados (P&L) cacheado ────────────────────────────────
export async function getEstadoResultadosCached(
  mes: number,
  anio: number,
  lineaNegocioId?: string | null,
): Promise<EstadoResultados> {
  const k = keyDe(mes, anio, lineaNegocioId);

  const cached = estadoCache.get(k);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const inflight = estadoInflight.get(k);
  if (inflight) return inflight; // dedup · ya hay una llamada en curso para esta key

  const p = generarEstadoResultados(mes, anio, lineaNegocioId)
    .then((data) => {
      estadoCache.set(k, { data, expiresAt: Date.now() + ttlPara(mes, anio) });
      estadoInflight.delete(k);
      return data;
    })
    .catch((err) => {
      estadoInflight.delete(k);
      throw err;
    });

  estadoInflight.set(k, p);
  return p;
}

// ─── Balance general cacheado ───────────────────────────────────────────
export async function getBalanceGeneralCached(
  mes: number,
  anio: number,
): Promise<BalanceGeneral> {
  const k = keyDe(mes, anio);

  const cached = balanceCache.get(k);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const inflight = balanceInflight.get(k);
  if (inflight) return inflight;

  const p = generarBalanceGeneral(mes, anio)
    .then((data) => {
      balanceCache.set(k, { data, expiresAt: Date.now() + ttlPara(mes, anio) });
      balanceInflight.delete(k);
      return data;
    })
    .catch((err) => {
      balanceInflight.delete(k);
      throw err;
    });

  balanceInflight.set(k, p);
  return p;
}

// ─── Invalidación ───────────────────────────────────────────────────────
/**
 * Invalida el cache contable. Llamar tras registrar/editar una venta, gasto,
 * movimiento financiero o compra que afecte el período.
 *
 * - Sin argumentos → invalida TODO (lo más seguro tras una operación amplia).
 * - Con (mes, anio) → invalida solo ese período (todas sus líneas).
 */
export function invalidarContabilidadCache(mes?: number, anio?: number): void {
  if (mes === undefined || anio === undefined) {
    estadoCache.clear();
    balanceCache.clear();
    return;
  }
  const prefijo = `${anio}-${String(mes).padStart(2, '0')}-`;
  for (const k of estadoCache.keys()) {
    if (k.startsWith(prefijo)) estadoCache.delete(k);
  }
  for (const k of balanceCache.keys()) {
    if (k.startsWith(prefijo)) balanceCache.delete(k);
  }
}
