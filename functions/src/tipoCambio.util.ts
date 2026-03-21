/**
 * Utilidad centralizada de Tipo de Cambio para Cloud Functions.
 *
 * Mirror de la lógica de src/services/tipoCambio.service.ts (resolverTC)
 * pero usando firebase-admin en vez de firebase/firestore.
 *
 * Decisión 6: Híbrido con umbral (<24h=fresh, 24-72h=stale, >72h=expired)
 * Decisión 11: Dual TC — paralelo (operaciones) + SUNAT (contabilidad)
 */
import * as admin from "firebase-admin";
import { COLLECTIONS } from "./collections";

const db = admin.firestore();

type TCModalidad = "paralelo" | "sunat" | "unico";

interface TCResuelto {
  compra: number;
  venta: number;
  promedio: number;
  fuente: string;
  modalidad: TCModalidad;
  fechaTC: Date;
  freshness: "fresh" | "stale" | "expired" | "unknown";
  edadHoras: number;
  esFallback: boolean;
}

interface TCConfig {
  umbralFreshHoras: number;
  umbralStaleHoras: number;
  fallbackCompra: number;
  fallbackVenta: number;
  fallbackHabilitado: boolean;
  alertaVariacionPorcentaje: number;
}

const TC_CONFIG_DEFAULTS: TCConfig = {
  umbralFreshHoras: 24,
  umbralStaleHoras: 72,
  fallbackCompra: 3.70,
  fallbackVenta: 3.75,
  fallbackHabilitado: true,
  alertaVariacionPorcentaje: 2,
};

// Cache en memoria (por instancia de Cloud Function)
let _cache: { tc: TCResuelto; timestamp: number } | null = null;
let _cacheSunat: { tc: TCResuelto; timestamp: number } | null = null;
let _configCache: { config: TCConfig; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function calcularFreshness(
  fechaTC: Date,
  config: TCConfig
): { freshness: TCResuelto["freshness"]; edadHoras: number } {
  const edadHoras = (Date.now() - fechaTC.getTime()) / 3_600_000;
  if (edadHoras <= config.umbralFreshHoras) return { freshness: "fresh", edadHoras };
  if (edadHoras <= config.umbralStaleHoras) return { freshness: "stale", edadHoras };
  return { freshness: "expired", edadHoras };
}

async function getConfig(): Promise<TCConfig> {
  if (_configCache && Date.now() - _configCache.timestamp < 10 * 60 * 1000) {
    return _configCache.config;
  }
  try {
    const configDoc = await db.collection(COLLECTIONS.CONFIGURACION).doc("tipoCambio").get();
    if (configDoc.exists) {
      const data = configDoc.data()!;
      const config: TCConfig = {
        umbralFreshHoras: data.umbralFreshHoras ?? TC_CONFIG_DEFAULTS.umbralFreshHoras,
        umbralStaleHoras: data.umbralStaleHoras ?? TC_CONFIG_DEFAULTS.umbralStaleHoras,
        fallbackCompra: data.fallbackCompra ?? TC_CONFIG_DEFAULTS.fallbackCompra,
        fallbackVenta: data.fallbackVenta ?? TC_CONFIG_DEFAULTS.fallbackVenta,
        fallbackHabilitado: data.fallbackHabilitado ?? TC_CONFIG_DEFAULTS.fallbackHabilitado,
        alertaVariacionPorcentaje: data.alertaVariacionPorcentaje ?? TC_CONFIG_DEFAULTS.alertaVariacionPorcentaje,
      };
      _configCache = { config, timestamp: Date.now() };
      return config;
    }
  } catch (error) {
    console.warn("[TC-CF] Error leyendo config, usando defaults:", error);
  }
  return TC_CONFIG_DEFAULTS;
}

/** Lee el TC más reciente de Firestore */
async function getTCMasReciente(): Promise<FirebaseFirestore.DocumentData | null> {
  const snapshot = await db
    .collection(COLLECTIONS.TIPOS_CAMBIO)
    .orderBy("fecha", "desc")
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0].data();
}

/**
 * Resuelve el TC actual (paralelo/operaciones) desde Firestore.
 * Flujo: cache memoria → query tiposCambio más reciente → fallback
 */
export async function resolverTC(): Promise<TCResuelto> {
  // [1] Cache en memoria
  if (_cache && Date.now() - _cache.timestamp < CACHE_TTL_MS) {
    return _cache.tc;
  }

  const config = await getConfig();

  // [2] Buscar TC más reciente
  try {
    const data = await getTCMasReciente();
    if (data) {
      const fechaTC = data.fecha?.toDate?.() || new Date(0);
      const { freshness, edadHoras } = calcularFreshness(fechaTC, config);

      // Usar campo paralelo si existe (Decisión 11), sino raíz
      const paraleloData = data.paralelo;
      const compra = paraleloData?.compra ?? data.compra;
      const venta = paraleloData?.venta ?? data.venta;

      const resultado: TCResuelto = {
        compra,
        venta,
        promedio: (compra + venta) / 2,
        fuente: data.fuente || "manual",
        modalidad: paraleloData ? "paralelo" : "unico",
        fechaTC,
        freshness,
        edadHoras,
        esFallback: false,
      };

      _cache = { tc: resultado, timestamp: Date.now() };
      return resultado;
    }
  } catch (error) {
    console.warn("[TC-CF] Error buscando TC:", error);
  }

  // [3] Fallback
  if (config.fallbackHabilitado) {
    return {
      compra: config.fallbackCompra,
      venta: config.fallbackVenta,
      promedio: (config.fallbackCompra + config.fallbackVenta) / 2,
      fuente: "fallback",
      modalidad: "unico",
      fechaTC: new Date(0),
      freshness: "expired",
      edadHoras: Infinity,
      esFallback: true,
    };
  }

  throw new Error("No hay tipo de cambio disponible y el fallback está deshabilitado");
}

/**
 * Resuelve el TC SUNAT/oficial (para contabilidad y cumplimiento fiscal).
 */
export async function resolverTCSunat(): Promise<TCResuelto> {
  if (_cacheSunat && Date.now() - _cacheSunat.timestamp < CACHE_TTL_MS) {
    return _cacheSunat.tc;
  }

  const config = await getConfig();

  try {
    const data = await getTCMasReciente();
    if (data) {
      const fechaTC = data.fecha?.toDate?.() || new Date(0);
      const { freshness, edadHoras } = calcularFreshness(fechaTC, config);

      const sunatData = data.sunat;
      const compra = sunatData?.compra ?? data.compra;
      const venta = sunatData?.venta ?? data.venta;

      const resultado: TCResuelto = {
        compra,
        venta,
        promedio: (compra + venta) / 2,
        fuente: sunatData ? "sunat" : data.fuente || "manual",
        modalidad: sunatData ? "sunat" : "unico",
        fechaTC,
        freshness,
        edadHoras,
        esFallback: false,
      };

      _cacheSunat = { tc: resultado, timestamp: Date.now() };
      return resultado;
    }
  } catch (error) {
    console.warn("[TC-CF] Error buscando TC SUNAT:", error);
  }

  return resolverTC();
}

/**
 * Igual que resolverTC pero LANZA ERROR si el TC está expired o es fallback.
 * Usar en operaciones transaccionales (crear venta, registrar pago).
 */
export async function resolverTCEstricto(): Promise<TCResuelto> {
  const tc = await resolverTC();
  if (tc.esFallback) {
    throw new Error(
      "No hay tipo de cambio registrado. Registre un TC antes de continuar con esta operación."
    );
  }
  if (tc.freshness === "expired") {
    throw new Error(
      `Tipo de cambio expirado (${Math.round(tc.edadHoras)}h de antigüedad). ` +
      "Actualice el TC antes de continuar con esta operación."
    );
  }
  return tc;
}

/**
 * Shortcut: devuelve solo el valor de venta del TC resuelto (permisivo).
 */
export async function resolverTCVenta(): Promise<number> {
  const tc = await resolverTC();
  return tc.venta;
}

/**
 * Shortcut: devuelve venta del TC SUNAT (para contabilidad).
 */
export async function resolverTCSunatVenta(): Promise<number> {
  const tc = await resolverTCSunat();
  return tc.venta;
}

/**
 * Shortcut estricto: devuelve venta del TC, lanza error si expired/fallback.
 */
export async function resolverTCVentaEstricto(): Promise<number> {
  const tc = await resolverTCEstricto();
  return tc.venta;
}

/**
 * Invalida el cache (llamar después de actualizar TC)
 */
export function invalidarCache(): void {
  _cache = null;
  _cacheSunat = null;
  _configCache = null;
}
