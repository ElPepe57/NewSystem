/**
 * ===============================================
 * SERVICIO DE INVERSIONISTAS (chk5.E-INV)
 * ===============================================
 *
 * Agrega datos de varios módulos (Contabilidad + Tesorería + aportes/retiros)
 * para producir la vista ejecutiva del inversionista bajo el modelo MIXTO
 * (cash propio + TC personal asumida por el negocio).
 *
 * NO duplica funcionalidad — reusa:
 *  - `contabilidadService.generarBalanceGeneral` (patrimonio · activos · pasivos)
 *  - `contabilidadService.generarEstadoResultados` (utilidad neta · margen)
 *  - `tesoreriaService.getTotalAportesCapital` (lifetime)
 *  - `tesoreriaService.getTotalRetirosCapital` (lifetime por tipo)
 *  - `tipoCambioService.resolverTC` (TC vigente)
 *  - `cuentasCaja` filtrado por tipo='credito' + titularidad='personal' +
 *    garantizadaPorSocioId (deuda personal TC)
 *
 * Solo agrega:
 *  - CRUD de catálogo de socios
 *  - Agregaciones por socio (aportes/retiros/TCs)
 *  - Cálculos de las métricas nuevas: Capital Comprometido, Equity Ratio,
 *    ROI Dual, Multiplicador, Soberanía Financiera, Salud
 *  - Trayectoria 24m (combinación mes a mes de patrimonio + comprometido)
 */

import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';

import type {
  Socio,
  SocioFormData,
  AporteSocioResumen,
  RetiroSocioResumen,
  TCPersonalSocioResumen,
  CapitalComprometido,
  EquityRatio,
  ROIDual,
  MultiplicadorCapital,
  SoberaniaFinanciera,
  TrayectoriaMensual,
  SaludInversionista,
  ResumenInversionista,
  ConfiguracionInversionistas,
} from '../types/inversionista.types';
import { DEFAULT_CONFIG_INVERSIONISTAS } from '../types/inversionista.types';
import type { CuentaCaja, MonedaTesoreria } from '../types/tesoreria.types';

import { contabilidadService } from './contabilidad.service';
import { tesoreriaService } from './tesoreria.service';
import { tipoCambioService } from './tipoCambio.service';

// ===============================================
// CONSTANTES
// ===============================================

const SOCIOS_COLLECTION = COLLECTIONS.SOCIOS;
const CONFIG_DOC_PATH = 'configuracion/inversionistas';

// ===============================================
// CRUD SOCIOS
// ===============================================

/** Doc id determinístico · snake_case del nombre · "Jose Lopez" → "jose_lopez" */
function generarIdSocio(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar acentos
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

export async function listarSocios(): Promise<Socio[]> {
  const snapshot = await getDocs(collection(db, SOCIOS_COLLECTION));
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Socio[];
}

export async function getSocio(id: string): Promise<Socio | null> {
  const snap = await getDoc(doc(db, SOCIOS_COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Socio;
}

export async function crearSocio(
  data: SocioFormData,
  userId: string
): Promise<string> {
  const id = generarIdSocio(data.nombre);
  const docData: Omit<Socio, 'id'> = {
    nombre: data.nombre.trim(),
    porcentajeParticipacion: data.porcentajeParticipacion,
    fechaIngreso: Timestamp.fromDate(data.fechaIngreso),
    activo: data.activo,
    creadoPor: userId,
    fechaCreacion: Timestamp.now(),
  };
  if (data.email) (docData as any).email = data.email;
  if (data.rol) (docData as any).rol = data.rol;
  if (data.notas) (docData as any).notas = data.notas;

  await setDoc(doc(db, SOCIOS_COLLECTION, id), docData);
  logger.success(`Socio creado: ${data.nombre} (id: ${id})`);
  return id;
}

export async function actualizarSocio(
  id: string,
  data: Partial<SocioFormData>,
  userId: string
): Promise<void> {
  const updates: Record<string, any> = {
    actualizadoPor: userId,
    fechaActualizacion: Timestamp.now(),
  };
  if (data.nombre !== undefined) updates.nombre = data.nombre.trim();
  if (data.email !== undefined) updates.email = data.email;
  if (data.porcentajeParticipacion !== undefined)
    updates.porcentajeParticipacion = data.porcentajeParticipacion;
  if (data.rol !== undefined) updates.rol = data.rol;
  if (data.fechaIngreso !== undefined)
    updates.fechaIngreso = Timestamp.fromDate(data.fechaIngreso);
  if (data.activo !== undefined) updates.activo = data.activo;
  if (data.notas !== undefined) updates.notas = data.notas;

  await updateDoc(doc(db, SOCIOS_COLLECTION, id), updates);
  logger.success(`Socio actualizado: ${id}`);
}

export async function eliminarSocio(id: string): Promise<void> {
  await deleteDoc(doc(db, SOCIOS_COLLECTION, id));
  logger.success(`Socio eliminado: ${id}`);
}

// ===============================================
// CRUD CONFIGURACIÓN
// ===============================================

export async function getConfiguracionInversionistas(): Promise<ConfiguracionInversionistas> {
  const snap = await getDoc(doc(db, CONFIG_DOC_PATH));
  if (!snap.exists()) {
    return {
      ...DEFAULT_CONFIG_INVERSIONISTAS,
      ultimaActualizacion: Timestamp.now(),
      actualizadoPor: 'system',
    };
  }
  return snap.data() as ConfiguracionInversionistas;
}

export async function actualizarConfiguracionInversionistas(
  data: Partial<ConfiguracionInversionistas>,
  userId: string
): Promise<void> {
  const updates: Record<string, any> = {
    ...data,
    actualizadoPor: userId,
    ultimaActualizacion: Timestamp.now(),
  };
  await setDoc(doc(db, CONFIG_DOC_PATH), updates, { merge: true });
}

// ===============================================
// AGREGACIONES POR SOCIO
// ===============================================

/**
 * Lee `aportesCapital` lifetime y los agrupa por `socioId`.
 *
 * Si un aporte no tiene socioId (registros viejos pre-catálogo), se ignora
 * para el detalle por socio · pero se cuenta en `totalGlobal`.
 */
export async function getAportesPorSocio(): Promise<{
  porSocio: AporteSocioResumen[];
  totalGlobalPEN: number;
}> {
  const snapshot = await getDocs(collection(db, COLLECTIONS.APORTES_CAPITAL));
  const acumPorSocio = new Map<string, AporteSocioResumen>();
  let totalGlobalPEN = 0;

  snapshot.forEach((d) => {
    const a = d.data() as any;
    const montoPEN = a.montoEquivalentePEN || 0;
    totalGlobalPEN += montoPEN;

    if (!a.socioId) return; // ignorar registros sin socio

    const existing = acumPorSocio.get(a.socioId);
    if (!existing) {
      acumPorSocio.set(a.socioId, {
        socioId: a.socioId,
        socioNombre: a.socioNombre || 'Socio sin nombre',
        totalAportadoPEN: montoPEN,
        totalAportadoUSD: a.moneda === 'USD' ? a.monto || 0 : 0,
        cantidadAportes: 1,
        fechaPrimerAporte: a.fecha,
        fechaUltimoAporte: a.fecha,
      });
    } else {
      existing.totalAportadoPEN += montoPEN;
      if (a.moneda === 'USD') existing.totalAportadoUSD += a.monto || 0;
      existing.cantidadAportes += 1;
      if (
        a.fecha &&
        (!existing.fechaPrimerAporte ||
          a.fecha.toMillis() < existing.fechaPrimerAporte.toMillis())
      ) {
        existing.fechaPrimerAporte = a.fecha;
      }
      if (
        a.fecha &&
        (!existing.fechaUltimoAporte ||
          a.fecha.toMillis() > existing.fechaUltimoAporte.toMillis())
      ) {
        existing.fechaUltimoAporte = a.fecha;
      }
    }
  });

  return {
    porSocio: Array.from(acumPorSocio.values()),
    totalGlobalPEN,
  };
}

/**
 * Lee `retirosCapital` lifetime y los agrupa por `socioId` con detalle por tipo.
 */
export async function getRetirosPorSocio(): Promise<{
  porSocio: RetiroSocioResumen[];
  totalGlobalPEN: number;
}> {
  const snapshot = await getDocs(collection(db, COLLECTIONS.RETIROS_CAPITAL));
  const acum = new Map<string, RetiroSocioResumen>();
  let totalGlobalPEN = 0;

  snapshot.forEach((d) => {
    const r = d.data() as any;
    const montoPEN = r.montoEquivalentePEN || 0;
    const tipo = r.tipoRetiro as 'utilidades' | 'capital' | 'prestamo';
    totalGlobalPEN += montoPEN;

    if (!r.socioId) return;

    const existing = acum.get(r.socioId);
    if (!existing) {
      acum.set(r.socioId, {
        socioId: r.socioId,
        socioNombre: r.socioNombre || 'Socio sin nombre',
        totalRetiradoPEN: montoPEN,
        porTipo: {
          utilidades: tipo === 'utilidades' ? montoPEN : 0,
          capital: tipo === 'capital' ? montoPEN : 0,
          prestamo: tipo === 'prestamo' ? montoPEN : 0,
        },
        cantidadRetiros: 1,
        fechaUltimoRetiro: r.fecha,
      });
    } else {
      existing.totalRetiradoPEN += montoPEN;
      if (tipo && existing.porTipo[tipo] !== undefined) {
        existing.porTipo[tipo] += montoPEN;
      }
      existing.cantidadRetiros += 1;
      if (
        r.fecha &&
        (!existing.fechaUltimoRetiro ||
          r.fecha.toMillis() > existing.fechaUltimoRetiro.toMillis())
      ) {
        existing.fechaUltimoRetiro = r.fecha;
      }
    }
  });

  return {
    porSocio: Array.from(acum.values()),
    totalGlobalPEN,
  };
}

/**
 * Lee cuentas tipo `credito` con `titularidad='personal'` + `garantizadaPorSocioId`
 * y agrega por socio: deuda vigente + límite disponible.
 *
 * Para cuentas USD usa el TC vigente para convertir a PEN.
 */
export async function getTCPersonalesPorSocio(
  tipoCambioActual: number
): Promise<{
  porSocio: TCPersonalSocioResumen[];
  totalDeudaPEN: number;
}> {
  const q = query(
    collection(db, COLLECTIONS.CUENTAS_CAJA),
    where('tipo', '==', 'credito'),
    where('titularidad', '==', 'personal')
  );
  const snapshot = await getDocs(q);
  const acum = new Map<string, TCPersonalSocioResumen>();
  let totalDeudaPEN = 0;

  snapshot.forEach((d) => {
    const cuenta = { id: d.id, ...d.data() } as CuentaCaja;
    // Solo si está marcada como garantizada por socio
    if (!cuenta.garantizadaPorSocioId) return;
    if (!cuenta.activa) return;

    const utilizado = cuenta.lineaCredito?.utilizado || 0;
    const limite = cuenta.lineaCredito?.limiteTotal || 0;
    const utilizadoPEN =
      cuenta.moneda === 'USD' ? utilizado * tipoCambioActual : utilizado;
    const limitePEN =
      cuenta.moneda === 'USD' ? limite * tipoCambioActual : limite;

    totalDeudaPEN += utilizadoPEN;

    const socioId = cuenta.garantizadaPorSocioId;
    const existing = acum.get(socioId);
    const detalleTarjeta = {
      cuentaCajaId: cuenta.id,
      nombre: cuenta.nombre,
      banco: cuenta.banco,
      moneda: cuenta.moneda,
      utilizado: utilizadoPEN,
      limite: limitePEN,
      porcentajeUso: limitePEN > 0 ? (utilizadoPEN / limitePEN) * 100 : 0,
    };

    if (!existing) {
      acum.set(socioId, {
        socioId,
        socioNombre: cuenta.titularNombre || cuenta.titular || 'Socio',
        cantidadTCs: 1,
        totalComprometidoPEN: utilizadoPEN,
        limiteTotalPEN: limitePEN,
        tarjetas: [detalleTarjeta],
      });
    } else {
      existing.cantidadTCs += 1;
      existing.totalComprometidoPEN += utilizadoPEN;
      existing.limiteTotalPEN += limitePEN;
      existing.tarjetas.push(detalleTarjeta);
    }
  });

  return {
    porSocio: Array.from(acum.values()),
    totalDeudaPEN,
  };
}

// ===============================================
// CÁLCULOS DE MÉTRICAS
// ===============================================

export function calcularCapitalComprometido(
  cashAportadoPEN: number,
  deudaTCPersonalPEN: number,
  socios: Socio[],
  aportesPorSocio: AporteSocioResumen[],
  tcsPorSocio: TCPersonalSocioResumen[]
): CapitalComprometido {
  const totalPEN = cashAportadoPEN + deudaTCPersonalPEN;

  const porSocio = socios.map((s) => {
    const aporte = aportesPorSocio.find((a) => a.socioId === s.id);
    const tcs = tcsPorSocio.find((t) => t.socioId === s.id);
    const cash = aporte?.totalAportadoPEN || 0;
    const deudaTC = tcs?.totalComprometidoPEN || 0;
    const total = cash + deudaTC;
    return {
      socioId: s.id,
      socioNombre: s.nombre,
      cash,
      deudaTC,
      total,
      porcentajeDelTotal: totalPEN > 0 ? (total / totalPEN) * 100 : 0,
    };
  });

  return {
    cashAportadoPEN,
    deudaTCPersonalPEN,
    totalPEN,
    porSocio,
  };
}

export function calcularEquityRatio(
  patrimonioPEN: number,
  activosPEN: number,
  umbrales: {
    excelente: number;
    saludable: number;
    moderado: number;
  }
): EquityRatio {
  const ratio = activosPEN > 0 ? patrimonioPEN / activosPEN : 0;
  const porcentaje = ratio * 100;
  let salud: EquityRatio['salud'];
  if (ratio >= umbrales.excelente) salud = 'excelente';
  else if (ratio >= umbrales.saludable) salud = 'saludable';
  else if (ratio >= umbrales.moderado) salud = 'moderado';
  else salud = 'riesgo';

  return { patrimonioPEN, activosPEN, ratio, porcentaje, salud };
}

export function calcularROIDual(
  utilidadNetaAcumuladaPEN: number,
  cashAportadoPEN: number,
  capitalComprometidoPEN: number
): ROIDual {
  const sobreCashAportado =
    cashAportadoPEN > 0 ? utilidadNetaAcumuladaPEN / cashAportadoPEN : 0;
  const sobreCapitalComprometido =
    capitalComprometidoPEN > 0
      ? utilidadNetaAcumuladaPEN / capitalComprometidoPEN
      : 0;

  return {
    utilidadNetaAcumuladaPEN,
    sobreCashAportado,
    sobreCapitalComprometido,
    diferencial: sobreCashAportado - sobreCapitalComprometido,
  };
}

export function calcularMultiplicador(
  cashAportadoOriginal: number,
  patrimonioActual: number
): MultiplicadorCapital {
  return {
    cashAportadoOriginal,
    patrimonioActual,
    multiplicador:
      cashAportadoOriginal > 0 ? patrimonioActual / cashAportadoOriginal : 0,
  };
}

export function calcularSoberania(
  deudaTCPersonalVigentePEN: number,
  utilidadMensualPromedioPEN: number,
  porcentajeAsignadoAPagoTC: number
): SoberaniaFinanciera {
  const pagoMensualEstimadoPEN =
    utilidadMensualPromedioPEN * porcentajeAsignadoAPagoTC;
  const mesesParaSoberania =
    pagoMensualEstimadoPEN > 0
      ? deudaTCPersonalVigentePEN / pagoMensualEstimadoPEN
      : 0;

  let estado: SoberaniaFinanciera['estado'];
  if (deudaTCPersonalVigentePEN === 0 || mesesParaSoberania < 6) estado = 'cerca';
  else if (mesesParaSoberania < 12) estado = 'camino_claro';
  else if (mesesParaSoberania < 24) estado = 'largo_plazo';
  else estado = 'revision';

  let fechaEstimadaSoberania: Timestamp | undefined;
  if (mesesParaSoberania > 0 && Number.isFinite(mesesParaSoberania)) {
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() + Math.ceil(mesesParaSoberania));
    fechaEstimadaSoberania = Timestamp.fromDate(fecha);
  }

  return {
    deudaTCPersonalVigentePEN,
    utilidadMensualPromedioPEN,
    porcentajeAsignadoAPagoTC,
    pagoMensualEstimadoPEN,
    mesesParaSoberania,
    fechaEstimadaSoberania,
    estado,
  };
}

export function calcularSaludInversionista(
  equity: EquityRatio,
  tendenciaPatrimonio: number, // -1 a +1
  soberania: SoberaniaFinanciera,
  roi: ROIDual
): SaludInversionista {
  // Dimensión 1: Equity ratio (0-100)
  const equityScore = Math.min(100, equity.porcentaje);

  // Dimensión 2: Tendencia patrimonio (-1 a +1) → (0-100)
  const tendenciaScore = Math.max(0, Math.min(100, (tendenciaPatrimonio + 1) * 50));

  // Dimensión 3: Soberanía (estado → score)
  const soberaniaScore =
    soberania.estado === 'cerca'
      ? 90
      : soberania.estado === 'camino_claro'
      ? 70
      : soberania.estado === 'largo_plazo'
      ? 45
      : 20;

  // Dimensión 4: Rentabilidad (sobre comprometido · 30%+ = excelente)
  const rentabilidadScore = Math.min(
    100,
    Math.max(0, roi.sobreCapitalComprometido * 100 * 3) // 33% → 100
  );

  const score =
    equityScore * 0.30 +
    tendenciaScore * 0.25 +
    soberaniaScore * 0.25 +
    rentabilidadScore * 0.20;

  let estado: SaludInversionista['estado'];
  let resumen: string;
  if (score >= 70) {
    estado = 'saludable';
    resumen = `Negocio sólido · Equity ${equity.porcentaje.toFixed(0)}% · ROI ${(roi.sobreCapitalComprometido * 100).toFixed(0)}% · ${soberania.estado === 'cerca' ? 'cerca de soberanía' : 'soberanía en curso'}.`;
  } else if (score >= 45) {
    estado = 'atencion';
    resumen = `Atención · Equity ${equity.porcentaje.toFixed(0)}% · ROI ${(roi.sobreCapitalComprometido * 100).toFixed(0)}% · ${soberania.mesesParaSoberania > 0 ? `${Math.ceil(soberania.mesesParaSoberania)}m a soberanía` : 'sin deuda personal'}.`;
  } else {
    estado = 'critico';
    resumen = `Revisión estratégica · Equity ${equity.porcentaje.toFixed(0)}% bajo · ROI sobre comprometido ${(roi.sobreCapitalComprometido * 100).toFixed(0)}%.`;
  }

  return {
    estado,
    score: Math.round(score),
    resumen,
    dimensiones: {
      equityRatio: Math.round(equityScore),
      tendenciaPatrimonio: Math.round(tendenciaScore),
      soberania: Math.round(soberaniaScore),
      rentabilidad: Math.round(rentabilidadScore),
    },
  };
}

// ===============================================
// TRAYECTORIA 24 MESES
// ===============================================

/**
 * Construye trayectoria mensual de los últimos N meses combinando Balance +
 * P&L de cada mes. Cara para ejecutar (N llamadas a contabilidadService),
 * pero solo se ejecuta cuando se entra al módulo. En producción se debería
 * cachear en Firestore como materialized view.
 *
 * Para meses sin data, retorna ceros para evitar romper la UI.
 */
export async function calcularTrayectoria24Meses(
  hastaMes: number,
  hastaAnio: number
): Promise<TrayectoriaMensual[]> {
  const trayectoria: TrayectoriaMensual[] = [];

  for (let i = 23; i >= 0; i--) {
    const fecha = new Date(hastaAnio, hastaMes - 1 - i, 1);
    const m = fecha.getMonth() + 1;
    const a = fecha.getFullYear();

    try {
      const [balance, estado] = await Promise.all([
        contabilidadService.generarBalanceGeneral(m, a),
        contabilidadService.generarEstadoResultados(m, a),
      ]);

      trayectoria.push({
        periodo: `${a}-${String(m).padStart(2, '0')}`,
        anio: a,
        mes: m,
        patrimonio: balance.patrimonio.totalPatrimonio,
        activos: balance.activos.totalActivos,
        pasivos: balance.pasivos.totalPasivos,
        utilidadNeta: estado.utilidadNeta,
        margenNeto: estado.utilidadNetaPorcentaje,
        ventas: estado.ventasNetas,
        // Capital comprometido y deudaTCPersonal se rellenan en el aggregator
        // principal porque dependen de query global · acá quedan en 0 para
        // estos puntos históricos (la lógica de trayectoria precisa requiere
        // snapshots históricos · DEUDA-INV-HIST).
        capitalComprometido: 0,
        cashAportadoAcumulado: 0,
        deudaTCPersonal: 0,
        equityRatio:
          balance.activos.totalActivos > 0
            ? balance.patrimonio.totalPatrimonio / balance.activos.totalActivos
            : 0,
      });
    } catch (err) {
      logger.warn(`Trayectoria: sin data para ${a}-${m}`, err);
      trayectoria.push({
        periodo: `${a}-${String(m).padStart(2, '0')}`,
        anio: a,
        mes: m,
        patrimonio: 0,
        activos: 0,
        pasivos: 0,
        utilidadNeta: 0,
        margenNeto: 0,
        ventas: 0,
        capitalComprometido: 0,
        cashAportadoAcumulado: 0,
        deudaTCPersonal: 0,
        equityRatio: 0,
      });
    }
  }

  return trayectoria;
}

// ===============================================
// RESUMEN MAESTRO · ENTRY POINT DEL MÓDULO
// ===============================================

/**
 * Calcula todo lo necesario para renderizar el módulo de Inversionistas en una
 * sola llamada. Es el método principal que consume el componente UI.
 *
 * @param mes  · mes corte para Balance + P&L (1-12)
 * @param anio · año corte
 */
export async function calcularResumenInversionista(
  mes: number,
  anio: number
): Promise<ResumenInversionista> {
  // 1. TC vigente
  const tcResuelto = await tipoCambioService.resolverTC();
  const tipoCambio = tcResuelto.venta;

  // 2. Configuración del módulo
  const config = await getConfiguracionInversionistas();

  // 3. Datos base en paralelo
  const [
    socios,
    aportesData,
    retirosData,
    tcsData,
    balance,
    estadoMesActual,
  ] = await Promise.all([
    listarSocios(),
    getAportesPorSocio(),
    getRetirosPorSocio(),
    getTCPersonalesPorSocio(tipoCambio),
    contabilidadService.generarBalanceGeneral(mes, anio),
    contabilidadService.generarEstadoResultados(mes, anio),
  ]);

  // 4. Métricas calculadas
  // Cash aportado neto = aportes lifetime - retiros de capital
  const retirosDeCapital = retirosData.porSocio.reduce(
    (acc, r) => acc + r.porTipo.capital,
    0
  );
  const cashAportadoNeto = Math.max(
    0,
    aportesData.totalGlobalPEN - retirosDeCapital
  );

  const capitalComprometido = calcularCapitalComprometido(
    cashAportadoNeto,
    tcsData.totalDeudaPEN,
    socios,
    aportesData.porSocio,
    tcsData.porSocio
  );

  const equityRatio = calcularEquityRatio(
    balance.patrimonio.totalPatrimonio,
    balance.activos.totalActivos,
    config.umbralEquityRatio
  );

  // Utilidad neta acumulada · sumamos los últimos 12 meses para tener un
  // proxy de "lifetime" sin requerir snapshots históricos
  const utilidadNetaAcumulada = await calcularUNAcumulada12m(mes, anio);

  const roiDual = calcularROIDual(
    utilidadNetaAcumulada,
    cashAportadoNeto,
    capitalComprometido.totalPEN
  );

  const multiplicador = calcularMultiplicador(
    aportesData.totalGlobalPEN,
    balance.patrimonio.totalPatrimonio
  );

  // Utilidad mensual promedio últimos 6m · para soberanía
  const utilidadMensualPromedio = await calcularUNPromedio6m(mes, anio);

  const soberania = calcularSoberania(
    tcsData.totalDeudaPEN,
    utilidadMensualPromedio,
    config.porcentajeUtilidadAPagoTC
  );

  // 5. Trayectoria 24m
  const trayectoria = await calcularTrayectoria24Meses(mes, anio);

  // Tendencia patrimonio: comparar último mes vs 6m atrás · normalizado a [-1, +1]
  const tendenciaPatrimonio = calcularTendenciaNormalizada(
    trayectoria.slice(-6).map((t) => t.patrimonio)
  );

  const salud = calcularSaludInversionista(
    equityRatio,
    tendenciaPatrimonio,
    soberania,
    roiDual
  );

  return {
    fechaCalculo: new Date(),
    tipoCambio,
    salud,
    capitalComprometido,
    patrimonioPEN: balance.patrimonio.totalPatrimonio,
    activosPEN: balance.activos.totalActivos,
    pasivosPEN: balance.pasivos.totalPasivos,
    equityRatio,
    roiDual,
    multiplicador,
    socios,
    aportesPorSocio: aportesData.porSocio,
    retirosPorSocio: retirosData.porSocio,
    tcPersonalesPorSocio: tcsData.porSocio,
    trayectoria,
    soberania,
    utilidadNetaMesActualPEN: estadoMesActual.utilidadNeta,
    utilidadNetaAcumuladaPEN: utilidadNetaAcumulada,
    ventasMesActualPEN: estadoMesActual.ventasNetas,
    margenNetoMesActual: estadoMesActual.utilidadNetaPorcentaje,
  };
}

// ===============================================
// HELPERS PRIVADOS
// ===============================================

async function calcularUNAcumulada12m(mes: number, anio: number): Promise<number> {
  let acum = 0;
  for (let i = 0; i < 12; i++) {
    const fecha = new Date(anio, mes - 1 - i, 1);
    try {
      const estado = await contabilidadService.generarEstadoResultados(
        fecha.getMonth() + 1,
        fecha.getFullYear()
      );
      acum += estado.utilidadNeta || 0;
    } catch {
      // sin data ese mes · contribuye 0
    }
  }
  return acum;
}

async function calcularUNPromedio6m(mes: number, anio: number): Promise<number> {
  let acum = 0;
  let cuenta = 0;
  for (let i = 0; i < 6; i++) {
    const fecha = new Date(anio, mes - 1 - i, 1);
    try {
      const estado = await contabilidadService.generarEstadoResultados(
        fecha.getMonth() + 1,
        fecha.getFullYear()
      );
      acum += estado.utilidadNeta || 0;
      cuenta++;
    } catch {
      // ignorar
    }
  }
  return cuenta > 0 ? acum / cuenta : 0;
}

/**
 * Calcula una tendencia normalizada [-1, +1] sobre una serie de valores.
 *
 * +1 = crece consistentemente · -1 = decrece · 0 = plano.
 * Usa pendiente de regresión lineal simplificada.
 */
function calcularTendenciaNormalizada(serie: number[]): number {
  if (serie.length < 2) return 0;
  const n = serie.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = serie.reduce((a, b) => a + b, 0);
  const sumXY = serie.reduce((acc, y, x) => acc + x * y, 0);
  const sumXX = serie.reduce((acc, _, x) => acc + x * x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const promedio = sumY / n;
  if (promedio === 0) return 0;
  // Normalizar slope relativo al promedio · clamp [-1, +1]
  const normalized = slope / Math.abs(promedio);
  return Math.max(-1, Math.min(1, normalized));
}

// ===============================================
// EXPORT NAMESPACE
// ===============================================

export const inversionistaService = {
  // Socios CRUD
  listarSocios,
  getSocio,
  crearSocio,
  actualizarSocio,
  eliminarSocio,
  // Config
  getConfiguracionInversionistas,
  actualizarConfiguracionInversionistas,
  // Agregaciones
  getAportesPorSocio,
  getRetirosPorSocio,
  getTCPersonalesPorSocio,
  // Cálculos
  calcularCapitalComprometido,
  calcularEquityRatio,
  calcularROIDual,
  calcularMultiplicador,
  calcularSoberania,
  calcularSaludInversionista,
  calcularTrayectoria24Meses,
  // Resumen maestro
  calcularResumenInversionista,
};
