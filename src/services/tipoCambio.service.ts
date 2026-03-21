import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { TipoCambio, TipoCambioFormData, TipoCambioFiltros, SunatTCResponse, TCResuelto, TCConfig, TCFreshness, TCModalidad } from '../types/tipoCambio.types';
import { TC_CONFIG_DEFAULTS } from '../types/tipoCambio.types';
import { COLLECTIONS } from '../config/collections';

const COLLECTION_NAME = COLLECTIONS.TIPOS_CAMBIO;

/**
 * Servicio para gestionar Tipos de Cambio
 */
export const tipoCambioService = {
  /**
   * Obtener todos los tipos de cambio
   */
  async getAll(): Promise<TipoCambio[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('fecha', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        promedio: data.promedio ?? (data.compra + data.venta) / 2
      } as TipoCambio;
    });
  },

  /**
   * Obtener tipo de cambio por ID
   */
  async getById(id: string): Promise<TipoCambio | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      promedio: data.promedio ?? (data.compra + data.venta) / 2
    } as TipoCambio;
  },

  /**
   * Obtener tipo de cambio por fecha específica
   */
  async getByFecha(fecha: Date): Promise<TipoCambio | null> {
    const inicioDia = new Date(fecha);
    inicioDia.setHours(0, 0, 0, 0);
    
    const finDia = new Date(fecha);
    finDia.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, COLLECTION_NAME),
      where('fecha', '>=', Timestamp.fromDate(inicioDia)),
      where('fecha', '<=', Timestamp.fromDate(finDia)),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const docSnap = snapshot.docs[0];
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      promedio: data.promedio ?? (data.compra + data.venta) / 2
    } as TipoCambio;
  },

  /**
   * Obtener historial de tipos de cambio con filtros
   */
  async getHistorial(filtros?: TipoCambioFiltros): Promise<TipoCambio[]> {
    let q = query(
      collection(db, COLLECTION_NAME),
      orderBy('fecha', 'desc')
    );

    // Aplicar filtros si existen
    if (filtros?.fechaInicio) {
      const inicio = new Date(filtros.fechaInicio);
      inicio.setHours(0, 0, 0, 0);
      q = query(q, where('fecha', '>=', Timestamp.fromDate(inicio)));
    }

    if (filtros?.fechaFin) {
      const fin = new Date(filtros.fechaFin);
      fin.setHours(23, 59, 59, 999);
      q = query(q, where('fecha', '<=', Timestamp.fromDate(fin)));
    }

    if (filtros?.fuente) {
      q = query(q, where('fuente', '==', filtros.fuente));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        promedio: data.promedio ?? (data.compra + data.venta) / 2
      } as TipoCambio;
    });
  },

  /**
   * Obtener TC del día actual
   * Si no hay TC para hoy, busca el más reciente
   */
  async getTCDelDia(): Promise<TipoCambio | null> {
    const hoy = new Date();
    const tcHoy = await this.getByFecha(hoy);

    if (tcHoy) {
      return tcHoy;
    }

    // Si no hay TC para hoy, buscar el más reciente
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('fecha', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        fecha: data.fecha,
        compra: data.compra,
        venta: data.venta,
        fuente: data.fuente,
        creadoPor: data.creadoPor,
        fechaCreacion: data.fechaCreacion,
        promedio: data.promedio ?? (data.compra + data.venta) / 2
      } as TipoCambio;
    } catch (error) {
      console.error('Error buscando TC más reciente:', error);
      return null;
    }
  },

  /**
   * Crear un nuevo tipo de cambio
   */
  async create(data: TipoCambioFormData, userId: string): Promise<string> {
    // Verificar que no exista ya un TC para esta fecha
    const existente = await this.getByFecha(data.fecha);
    if (existente) {
      throw new Error('Ya existe un tipo de cambio registrado para esta fecha');
    }

    const now = Timestamp.now();
    const newTC = {
      fecha: Timestamp.fromDate(data.fecha),
      compra: data.compra,
      venta: data.venta,
      promedio: (data.compra + data.venta) / 2,
      fuente: data.fuente,
      creadoPor: userId,
      fechaCreacion: now
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), newTC);
    return docRef.id;
  },

  /**
   * Actualizar un tipo de cambio
   */
  async update(id: string, data: Partial<TipoCambioFormData>, userId: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData: any = {
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now()
    };

    if (data.compra !== undefined) updateData.compra = data.compra;
    if (data.venta !== undefined) updateData.venta = data.venta;
    if (data.fuente !== undefined) updateData.fuente = data.fuente;
    if (data.fecha !== undefined) updateData.fecha = Timestamp.fromDate(data.fecha);

    // Recalcular promedio si se actualiza compra o venta
    if (data.compra !== undefined || data.venta !== undefined) {
      const current = await this.getById(id);
      const compra = data.compra ?? current?.compra ?? 0;
      const venta = data.venta ?? current?.venta ?? 0;
      updateData.promedio = (compra + venta) / 2;
    }

    await updateDoc(docRef, updateData);
  },

  /**
   * Obtener TC desde la API de SUNAT
   * Usa un proxy CORS para evitar problemas de bloqueo del navegador
   */
  async obtenerDeSunat(fecha?: Date): Promise<SunatTCResponse> {
    try {
      const fechaStr = fecha
        ? fecha.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      // Usar proxy CORS público para evitar bloqueo del navegador
      const corsProxy = 'https://corsproxy.io/?';
      const apiUrl = `https://api.apis.net.pe/v1/tipo-cambio-sunat?fecha=${fechaStr}`;
      const url = corsProxy + encodeURIComponent(apiUrl);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('No se pudo obtener el tipo de cambio de SUNAT');
      }

      const data = await response.json();

      return {
        fecha: fechaStr,
        compra: parseFloat(data.compra || data.precioCompra || 0),
        venta: parseFloat(data.venta || data.precioVenta || 0)
      };
    } catch (error) {
      console.error('Error al obtener TC de SUNAT:', error);
      throw new Error('No se pudo conectar con el servicio de SUNAT. Intente con ingreso manual.');
    }
  },

  /**
   * Registrar TC automáticamente desde SUNAT
   */
  async registrarDesdeSunat(fecha: Date, userId: string): Promise<string> {
    // Verificar que no exista ya un TC para esta fecha
    const existente = await this.getByFecha(fecha);
    if (existente) {
      throw new Error('Ya existe un tipo de cambio registrado para esta fecha');
    }

    // Obtener TC de SUNAT
    const tcSunat = await this.obtenerDeSunat(fecha);

    // Crear registro
    return this.create({
      fecha,
      compra: tcSunat.compra,
      venta: tcSunat.venta,
      fuente: 'sunat'
    }, userId);
  },

  /**
   * Obtener promedio del tipo de cambio para un mes específico
   */
  async getPromedioMensual(mes?: number, anio?: number): Promise<number> {
    const ahora = new Date();
    const mesTarget = mes ?? ahora.getMonth();
    const anioTarget = anio ?? ahora.getFullYear();

    const inicioMes = new Date(anioTarget, mesTarget, 1);
    const finMes = new Date(anioTarget, mesTarget + 1, 0, 23, 59, 59, 999);

    const q = query(
      collection(db, COLLECTION_NAME),
      where('fecha', '>=', Timestamp.fromDate(inicioMes)),
      where('fecha', '<=', Timestamp.fromDate(finMes))
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return 0;
    }

    const registros = snapshot.docs.map(doc => {
      const data = doc.data();
      return (data.compra + data.venta) / 2;
    });

    return registros.reduce((sum, val) => sum + val, 0) / registros.length;
  },

  /**
   * Obtener últimos N días de TC para gráficos
   */
  async getUltimosDias(dias: number = 30): Promise<TipoCambio[]> {
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - dias);
    fechaInicio.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, COLLECTION_NAME),
      where('fecha', '>=', Timestamp.fromDate(fechaInicio)),
      orderBy('fecha', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as TipoCambio));
  },

  // ============================================================
  // TC CENTRALIZADO — resolverTC con cache y freshness
  // ============================================================

  /** Cache en memoria con TTL de 5 minutos */
  _cache: null as { tc: TCResuelto; timestamp: number } | null,
  _cacheSunat: null as { tc: TCResuelto; timestamp: number } | null,
  _configCache: null as { config: TCConfig; timestamp: number } | null,
  _CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutos

  /**
   * Obtiene la configuración de umbrales de TC desde Firestore
   */
  async getConfig(): Promise<TCConfig> {
    // Cache de config (10 min TTL)
    if (this._configCache && Date.now() - this._configCache.timestamp < 10 * 60 * 1000) {
      return this._configCache.config;
    }
    try {
      const configDoc = await getDoc(doc(db, COLLECTIONS.CONFIGURACION, 'tipoCambio'));
      if (configDoc.exists()) {
        const data = configDoc.data();
        const config: TCConfig = {
          umbralFreshHoras: data.umbralFreshHoras ?? TC_CONFIG_DEFAULTS.umbralFreshHoras,
          umbralStaleHoras: data.umbralStaleHoras ?? TC_CONFIG_DEFAULTS.umbralStaleHoras,
          fallbackCompra: data.fallbackCompra ?? TC_CONFIG_DEFAULTS.fallbackCompra,
          fallbackVenta: data.fallbackVenta ?? TC_CONFIG_DEFAULTS.fallbackVenta,
          fallbackHabilitado: data.fallbackHabilitado ?? TC_CONFIG_DEFAULTS.fallbackHabilitado,
          alertaVariacionPorcentaje: data.alertaVariacionPorcentaje ?? TC_CONFIG_DEFAULTS.alertaVariacionPorcentaje,
        };
        this._configCache = { config, timestamp: Date.now() };
        return config;
      }
    } catch (error) {
      console.warn('[TC] Error leyendo config, usando defaults:', error);
    }
    return TC_CONFIG_DEFAULTS;
  },

  /**
   * Calcula la frescura del TC basada en su antigüedad
   */
  _calcularFreshness(fechaTC: Date, config: TCConfig): { freshness: TCFreshness; edadHoras: number } {
    const edadHoras = (Date.now() - fechaTC.getTime()) / 3_600_000;
    let freshness: TCFreshness;
    if (edadHoras <= config.umbralFreshHoras) {
      freshness = 'fresh';
    } else if (edadHoras <= config.umbralStaleHoras) {
      freshness = 'stale';
    } else {
      freshness = 'expired';
    }
    return { freshness, edadHoras };
  },

  /**
   * MÉTODO PRINCIPAL: Resuelve el TC actual con información de frescura.
   * Reemplaza TODOS los patrones `let tc = 3.70; try { ... } catch { }`.
   *
   * Flujo: cache memoria → query Firestore → fallback configurado
   */
  async resolverTC(): Promise<TCResuelto> {
    // [1] Cache en memoria válido?
    if (this._cache && Date.now() - this._cache.timestamp < this._CACHE_TTL_MS) {
      return this._cache.tc;
    }

    const config = await this.getConfig();

    // [2] Buscar TC más reciente en Firestore
    try {
      const tc = await this.getTCDelDia();
      if (tc) {
        const fechaTC = tc.fecha instanceof Timestamp ? tc.fecha.toDate() : new Date(tc.fecha as any);
        const { freshness, edadHoras } = this._calcularFreshness(fechaTC, config);

        // Usar campo paralelo si existe (Decisión 11), sino raíz
        const paraleloData = tc.paralelo;
        const compra = paraleloData?.compra ?? tc.compra;
        const venta = paraleloData?.venta ?? tc.venta;

        const resultado: TCResuelto = {
          compra,
          venta,
          promedio: (compra + venta) / 2,
          fuente: tc.fuente,
          modalidad: paraleloData ? 'paralelo' : 'unico',
          fechaTC,
          freshness,
          edadHoras,
          esFallback: false,
        };

        this._cache = { tc: resultado, timestamp: Date.now() };
        return resultado;
      }
    } catch (error) {
      console.warn('[TC] Error buscando TC del día:', error);
    }

    // [3] Fallback de emergencia
    if (config.fallbackHabilitado) {
      const resultado: TCResuelto = {
        compra: config.fallbackCompra,
        venta: config.fallbackVenta,
        promedio: (config.fallbackCompra + config.fallbackVenta) / 2,
        fuente: 'manual',
        modalidad: 'unico',
        fechaTC: new Date(0), // Epoch = claramente no es real
        freshness: 'expired',
        edadHoras: Infinity,
        esFallback: true,
      };
      // NO cachear fallback — cada llamada re-intenta Firestore
      return resultado;
    }

    throw new Error('No hay tipo de cambio disponible y el fallback de emergencia está deshabilitado. Registre un TC manualmente.');
  },

  /**
   * Igual que resolverTC pero LANZA ERROR si el TC está expired.
   * Usar para operaciones transaccionales (crear venta, registrar pago).
   */
  async resolverTCEstricto(): Promise<TCResuelto> {
    const tc = await this.resolverTC();
    if (tc.esFallback) {
      throw new Error(
        'No hay tipo de cambio registrado. Registre un TC antes de continuar con esta operación.'
      );
    }
    if (tc.freshness === 'expired') {
      throw new Error(
        `Tipo de cambio expirado (${Math.round(tc.edadHoras)}h de antigüedad). ` +
        'Actualice el TC antes de continuar con esta operación.'
      );
    }
    return tc;
  },

  /**
   * Shortcut: devuelve solo el valor de venta del TC resuelto (permisivo).
   * Reemplazo directo para `let tc = 3.70; try { tc = (await getTCDelDia()).venta } catch {}`
   */
  async resolverTCVenta(): Promise<number> {
    const tc = await this.resolverTC();
    return tc.venta;
  },

  /**
   * Shortcut: devuelve solo el valor de compra del TC resuelto (permisivo).
   */
  async resolverTCCompra(): Promise<number> {
    const tc = await this.resolverTC();
    return tc.compra;
  },

  /**
   * Shortcut estricto: devuelve venta del TC, lanza error si expired/fallback.
   * Usar en operaciones transaccionales (crear venta, registrar pago, adelantos).
   */
  async resolverTCVentaEstricto(): Promise<number> {
    const tc = await this.resolverTCEstricto();
    return tc.venta;
  },

  /**
   * Resuelve el TC SUNAT/oficial (para contabilidad y cumplimiento fiscal).
   * Si el registro tiene campo sunat, lo usa. Sino devuelve el TC raíz.
   */
  async resolverTCSunat(): Promise<TCResuelto> {
    // Cache separada para SUNAT
    if (this._cacheSunat && Date.now() - this._cacheSunat.timestamp < this._CACHE_TTL_MS) {
      return this._cacheSunat.tc;
    }

    const config = await this.getConfig();

    try {
      const tc = await this.getTCDelDia();
      if (tc) {
        const fechaTC = tc.fecha instanceof Timestamp ? tc.fecha.toDate() : new Date(tc.fecha as any);
        const { freshness, edadHoras } = this._calcularFreshness(fechaTC, config);

        // Usar campo sunat si existe, sino raíz (compatibilidad)
        const sunatData = tc.sunat;
        const compra = sunatData?.compra ?? tc.compra;
        const venta = sunatData?.venta ?? tc.venta;

        const resultado: TCResuelto = {
          compra,
          venta,
          promedio: (compra + venta) / 2,
          fuente: sunatData ? 'sunat' : tc.fuente,
          modalidad: sunatData ? 'sunat' : 'unico',
          fechaTC,
          freshness,
          edadHoras,
          esFallback: false,
        };

        this._cacheSunat = { tc: resultado, timestamp: Date.now() };
        return resultado;
      }
    } catch (error) {
      console.warn('[TC] Error buscando TC SUNAT:', error);
    }

    // Fallback: devolver el resolver normal (mejor que nada)
    return this.resolverTC();
  },

  /**
   * Shortcut: devuelve venta del TC SUNAT (para contabilidad).
   */
  async resolverTCSunatVenta(): Promise<number> {
    const tc = await this.resolverTCSunat();
    return tc.venta;
  },

  /**
   * Invalida el cache en memoria (usar después de registrar un TC nuevo)
   */
  invalidarCache(): void {
    this._cache = null;
    this._cacheSunat = null;
    this._configCache = null;
  },
};
