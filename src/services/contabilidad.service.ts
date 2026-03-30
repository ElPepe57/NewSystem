/**
 * Servicio de Contabilidad
 * Genera reportes financieros: Estado de Resultados basado en flujo de actividad
 *
 * CRITERIO CONTABLE:
 * - Ventas: Se reconocen cuando la venta es registrada (no cotización)
 * - Compras: Se reconocen cuando la mercadería es RECIBIDA en almacén (OCs recibidas)
 * - Gastos: Se reconocen en el mes/año al que corresponden
 *
 * El costo principal es las COMPRAS del período, no el CMV de ventas.
 */

import { COLLECTIONS } from '../config/collections';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { tipoCambioService } from './tipoCambio.service';
import { tesoreriaService } from './tesoreria.service';
import type { Venta } from '../types/venta.types';
import type { Gasto } from '../types/gasto.types';
import type { OrdenCompra } from '../types/ordenCompra.types';
import type { Transferencia } from '../types/transferencia.types';
import type {
  EstadoResultados,
  PeriodoContable,
  ComprasPeriodo,
  GastosVenta,
  GastosDistribucion,
  GastosAdministrativos,
  GastosOperativos,
  CostosVariables,
  CostosFijos,
  OtrosIngresosGastos,
  IndicadoresEstadoResultados,
  MetricasOperativas,
  ResumenContable,
  TendenciaMensual,
  BalanceGeneral,
  EfectivoEquivalentes,
  CuentasPorCobrar,
  Inventarios,
  CuentasPorPagarProveedores,
  OtrasCuentasPorPagar,
  AnticiposClientes,
  DeudasFinancieras,
  DeudaFinanciera,
  IndicadoresFinancieros,
  AnalisisFinanciero,
} from '../types/contabilidad.types';
import type { CuentaCaja } from '../types/tesoreria.types';
import type { Unidad } from '../types/unidad.types';
import { esEstadoEnOrigen, esEstadoEnTransitoOrigen, esPaisOrigen } from '../utils/multiOrigen.helpers';
import { getCTRU } from '../utils/ctru.utils';
import { logger } from '../lib/logger';

// ============================================================================
// CONFIGURACIÓN CONTABLE
// ============================================================================

interface ConfiguracionContable {
  capitalSocial: number;
  reservaLegal: number;
  tcPorDefecto: number;
  provisionIncobrablesPct: number;
  fechaActualizacion?: Timestamp;
}

const CONFIG_DOC_ID = 'configuracion_contable';
const DEFAULT_CONFIG: ConfiguracionContable = {
  capitalSocial: 0,  // Inicia en 0, el capital real viene de aportes registrados
  reservaLegal: 0,
  tcPorDefecto: 0, // Se resuelve dinámicamente via tipoCambioService.resolverTCVenta()
  provisionIncobrablesPct: 5,
};

/**
 * Obtener configuración contable desde Firestore
 */
async function getConfiguracionContable(): Promise<ConfiguracionContable> {
  try {
    const docRef = doc(db, COLLECTIONS.CONFIGURACION, CONFIG_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { ...DEFAULT_CONFIG, ...docSnap.data() } as ConfiguracionContable;
    }

    // Si no existe, crear con valores por defecto
    await setDoc(docRef, { ...DEFAULT_CONFIG, fechaActualizacion: Timestamp.now() });
    return DEFAULT_CONFIG;
  } catch (error) {
    logger.warn('Error obteniendo configuración contable, usando valores por defecto:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Actualizar configuración contable
 */
export async function actualizarConfiguracionContable(
  config: Partial<ConfiguracionContable>
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.CONFIGURACION, CONFIG_DOC_ID);
  await setDoc(docRef, {
    ...config,
    fechaActualizacion: Timestamp.now()
  }, { merge: true });
}

/**
 * Obtener tipo de cambio actual (real o por defecto)
 */
async function obtenerTipoCambio(): Promise<number> {
  try {
    const tcDelDia = await tipoCambioService.getTCDelDia();
    if (tcDelDia && tcDelDia.promedio > 0) {
      return tcDelDia.promedio;
    }
    // Fallback a configuración
    const config = await getConfiguracionContable();
    return config.tcPorDefecto;
  } catch (error) {
    logger.warn('Error obteniendo TC, usando valor por defecto:', error);
    return DEFAULT_CONFIG.tcPorDefecto;
  }
}

/**
 * Obtener pagos a viajeros pendientes desde transferencias
 *
 * CRITERIO: Transferencias usa_peru recibidas (completa o parcial) con flete pendiente de pago.
 * El campo estadoPagoViajero puede ser 'pendiente', undefined, o null - cualquier valor
 * diferente de 'pagado' se considera pendiente.
 */
async function getPagosViajerosPendientes(tc: number): Promise<number> {
  try {
    const transferenciasRef = collection(db, COLLECTIONS.TRANSFERENCIAS);
    // No podemos filtrar por estadoPagoViajero !== 'pagado' en Firestore,
    // así que traemos todas las usa_peru y filtramos en memoria
    const q = query(
      transferenciasRef,
      where('tipo', '==', 'usa_peru')
    );
    const snapshot = await getDocs(q);

    let totalPendiente = 0;
    snapshot.forEach(docSnap => {
      const transferencia = docSnap.data() as Transferencia;

      // Misma lógica que cuentasPendientesService.getViajerosPorPagar():
      // - Tiene costo de flete > 0
      // - NO está pagado (estadoPagoViajero !== 'pagado')
      // - Estado es recibida_completa o recibida_parcial
      const costoFlete = transferencia.costoFleteTotal || 0;
      const estaPagado = transferencia.estadoPagoViajero === 'pagado';
      const estaRecibida = transferencia.estado === 'recibida_completa' ||
                           transferencia.estado === 'recibida_parcial';

      if (costoFlete > 0 && !estaPagado && estaRecibida) {
        const moneda = transferencia.monedaFlete || 'USD';
        // Restar pagos parciales ya realizados
        const montoPagadoUSD = transferencia.montoPagadoUSD || 0;
        const montoPendienteUSD = costoFlete - montoPagadoUSD;
        if (moneda === 'USD') {
          totalPendiente += montoPendienteUSD * tc;
        } else {
          totalPendiente += montoPendienteUSD;
        }
      }
    });

    return totalPendiente;
  } catch (error) {
    logger.warn('Error obteniendo pagos viajeros pendientes:', error);
    return 0;
  }
}

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// ============================================================================
// FUNCIONES DE OBTENCIÓN DE DATOS
// ============================================================================

/**
 * Obtener ventas del período contable.
 * Decisión 1 (fecha híbrida): Contabilidad usa fechaEntrega (con fallback a fechaDespacho → fechaCreacion).
 * Query amplio en fechaCreacion para capturar ventas creadas antes pero entregadas en el mes.
 */
async function getVentasPeriodo(mes: number, anio: number, lineaNegocioId?: string | null): Promise<Venta[]> {
  const ventasRef = collection(db, COLLECTIONS.VENTAS);

  const inicioMes = new Date(anio, mes - 1, 1);
  const finMes = new Date(anio, mes, 0, 23, 59, 59);

  // Ampliar ventana de query 2 meses atrás para capturar ventas creadas antes pero entregadas en el mes
  const inicioQuery = new Date(anio, mes - 3, 1);

  const q = query(
    ventasRef,
    where('fechaCreacion', '>=', Timestamp.fromDate(inicioQuery)),
    where('fechaCreacion', '<=', Timestamp.fromDate(finMes))
  );

  const snapshot = await getDocs(q);
  const ventas: Venta[] = [];

  snapshot.forEach(docSnap => {
    const venta = { id: docSnap.id, ...docSnap.data() } as Venta;
    // Solo ventas válidas (no cotizaciones ni canceladas)
    if (venta.estado === 'cotizacion' || venta.estado === 'cancelada') return;
    // Filtrar por línea de negocio si se especifica
    if (lineaNegocioId && venta.lineaNegocioId && venta.lineaNegocioId !== lineaNegocioId) return;

    // Fecha contable: fechaEntrega → fechaDespacho → fechaCreacion
    const fechaContable = (venta as any).fechaEntrega?.toDate?.()
      || (venta as any).fechaDespacho?.toDate?.()
      || venta.fechaCreacion?.toDate?.();
    if (!fechaContable) return;

    // Filtrar por mes contable exacto
    if (fechaContable >= inicioMes && fechaContable <= finMes) {
      ventas.push(venta);
    }
  });

  return ventas;
}

/**
 * Obtener gastos del período
 */
async function getGastosPeriodo(mes: number, anio: number, lineaNegocioId?: string | null): Promise<Gasto[]> {
  const gastosRef = collection(db, COLLECTIONS.GASTOS);

  const q = query(
    gastosRef,
    where('mes', '==', mes),
    where('anio', '==', anio)
  );

  const snapshot = await getDocs(q);
  const gastos: Gasto[] = [];

  snapshot.forEach(doc => {
    const gasto = { id: doc.id, ...doc.data() } as Gasto;
    if (gasto.estado !== 'cancelado') {
      // Filtrar por línea de negocio: incluir gastos compartidos (null) + los de la línea
      if (lineaNegocioId && gasto.lineaNegocioId && gasto.lineaNegocioId !== lineaNegocioId) return;
      gastos.push(gasto);
    }
  });

  return gastos;
}

/**
 * Obtener órdenes de compra RECIBIDAS en el período
 * Las compras se reconocen cuando la mercadería es recibida
 * Incluye: OCs completamente recibidas Y OCs con recepciones parciales en el período
 */
async function getComprasPeriodo(mes: number, anio: number): Promise<OrdenCompra[]> {
  const ordenesRef = collection(db, COLLECTIONS.ORDENES_COMPRA);

  const inicioMes = new Date(anio, mes - 1, 1);
  const finMes = new Date(anio, mes, 0, 23, 59, 59);

  // Query 1: OCs completamente recibidas en el período (legacy + nuevas)
  const qRecibidas = query(
    ordenesRef,
    where('fechaRecibida', '>=', Timestamp.fromDate(inicioMes)),
    where('fechaRecibida', '<=', Timestamp.fromDate(finMes))
  );

  const snapshotRecibidas = await getDocs(qRecibidas);
  const ordenesMap = new Map<string, OrdenCompra>();

  snapshotRecibidas.forEach(doc => {
    const orden = { id: doc.id, ...doc.data() } as OrdenCompra;
    if (orden.estado === 'recibida') {
      ordenesMap.set(doc.id, orden);
    }
  });

  // Query 2: OCs con recepciones parciales (estado recibida_parcial o recibida con parciales)
  // Buscar OCs que tengan fechaPrimeraRecepcion (indica que usaron el flujo parcial)
  const qParciales = query(
    ordenesRef,
    where('estado', 'in', ['recibida_parcial', 'recibida'])
  );

  const snapshotParciales = await getDocs(qParciales);

  snapshotParciales.forEach(doc => {
    if (ordenesMap.has(doc.id)) return; // Ya incluida por query 1

    const orden = { id: doc.id, ...doc.data() } as OrdenCompra;

    // Si tiene recepciones parciales, verificar si alguna cae en el período
    if (orden.recepcionesParciales && orden.recepcionesParciales.length > 0) {
      const tieneRecepcionEnPeriodo = orden.recepcionesParciales.some(rec => {
        const fechaRec = rec.fecha?.toDate();
        return fechaRec && fechaRec >= inicioMes && fechaRec <= finMes;
      });

      if (tieneRecepcionEnPeriodo) {
        ordenesMap.set(doc.id, orden);
      }
    }
  });

  return Array.from(ordenesMap.values());
}

/**
 * Obtener transferencias USA-PERU recibidas en el período
 * El flete de estas transferencias es parte del costo de mercadería
 */
async function getTransferenciasPeriodo(mes: number, anio: number): Promise<Transferencia[]> {
  try {
    const transferenciasRef = collection(db, COLLECTIONS.TRANSFERENCIAS);

    const inicioMes = new Date(anio, mes - 1, 1);
    const finMes = new Date(anio, mes, 0, 23, 59, 59);

    // Query simple solo por tipo para evitar índice compuesto
    const q = query(
      transferenciasRef,
      where('tipo', '==', 'usa_peru')
    );

    const snapshot = await getDocs(q);
    const transferencias: Transferencia[] = [];

    snapshot.forEach(docSnap => {
      const transferencia = { id: docSnap.id, ...docSnap.data() } as Transferencia;

      // Filtrar por estado (recibidas)
      if (transferencia.estado !== 'recibida_completa' && transferencia.estado !== 'recibida_parcial') {
        return;
      }

      // Filtrar por fecha de llegada real (recepción) en el período
      const fechaRecepcion = transferencia.fechaLlegadaReal || transferencia.recepcion?.fechaRecepcion;
      if (fechaRecepcion) {
        const fecha = fechaRecepcion.toDate();
        if (fecha >= inicioMes && fecha <= finMes) {
          transferencias.push(transferencia);
        }
      }
    });

    return transferencias;
  } catch (error) {
    logger.warn('Error obteniendo transferencias del período:', error);
    return []; // Retornar array vacío en caso de error para no bloquear el reporte
  }
}

// ============================================================================
// FUNCIONES DE CÁLCULO
// ============================================================================

/**
 * Calcular Compras del Período
 * Este es el COSTO DE MERCADERÍA principal en el Estado de Resultados
 * Incluye: Costo de productos + Impuestos + Flete de OC + Flete de Transferencias USA-PERU
 */
function calcularCompras(
  ordenes: OrdenCompra[],
  transferencias: Transferencia[],
  ventasNetas: number,
  tcDefault: number
): ComprasPeriodo {
  let costoProductos = 0;
  let impuestos = 0;
  let fleteInternacional = 0;
  let otrosGastosImportacion = 0;
  let unidadesCompradas = 0;

  // 1. Procesar órdenes de compra
  ordenes.forEach(orden => {
    const tc = orden.tcPago || orden.tcCompra || tcDefault;
    const totalUnidadesOrden = orden.productos.reduce((sum, p) => sum + p.cantidad, 0);

    // Determinar fracción a reconocer
    // OCs legacy (sin recepcionesParciales): reconocer 100%
    // OCs con recepciones parciales: prorratear por unidades recibidas
    let fraccion = 1;

    if (orden.recepcionesParciales && orden.recepcionesParciales.length > 0 && orden.estado !== 'recibida') {
      // OC parcial: reconocer solo la proporción de unidades recibidas
      const totalRecibido = orden.productos.reduce((sum, p) => sum + (p.cantidadRecibida || 0), 0);
      fraccion = totalUnidadesOrden > 0 ? totalRecibido / totalUnidadesOrden : 0;
    }

    // Costo de productos (subtotal)
    costoProductos += orden.subtotalUSD * tc * fraccion;

    // Impuestos de compra (sales tax, IVA origen, etc.)
    impuestos += (orden.impuestoCompraUSD ?? orden.impuestoUSD ?? 0) * tc * fraccion;

    // Envío del proveedor al punto de recojo
    otrosGastosImportacion += (orden.costoEnvioProveedorUSD ?? orden.gastosEnvioUSD ?? 0) * tc * fraccion;

    // Otros gastos de la compra
    otrosGastosImportacion += (orden.otrosGastosCompraUSD ?? orden.otrosGastosUSD ?? 0) * tc * fraccion;

    // Contar unidades (solo las recibidas para parciales)
    if (fraccion < 1) {
      orden.productos.forEach(p => {
        unidadesCompradas += (p.cantidadRecibida || 0);
      });
    } else {
      orden.productos.forEach(p => {
        unidadesCompradas += p.cantidad;
      });
    }
  });

  // 2. Procesar transferencias USA-PERU (FLETE INTERNACIONAL)
  // Este es el costo REAL del transporte de mercadería a Perú
  let unidadesTransferidas = 0;
  transferencias.forEach(transferencia => {
    const costoFlete = transferencia.costoFleteTotal || 0;
    const moneda = transferencia.monedaFlete || 'USD';

    // Convertir a PEN si está en USD
    if (moneda === 'USD') {
      fleteInternacional += costoFlete * tcDefault;
    } else {
      fleteInternacional += costoFlete;
    }

    // Contar unidades transferidas
    unidadesTransferidas += transferencia.totalUnidades || 0;
  });

  const total = costoProductos + impuestos + fleteInternacional + otrosGastosImportacion;

  return {
    costoProductos,
    impuestos,
    fleteInternacional,
    otrosGastosImportacion,
    total,
    porcentajeVentas: ventasNetas > 0 ? (total / ventasNetas) * 100 : 0,
    ordenesRecibidas: ordenes.length,
    unidadesCompradas,
    // Agregar info de transferencias
    transferenciasRecibidas: transferencias.length,
    unidadesTransferidas
  };
}

/**
 * Calcular Gastos de Venta (GV) - COSTO VARIABLE
 */
function calcularGV(ventas: Venta[], gastos: Gasto[]): GastosVenta {
  let comisionesPlataformas = 0;
  let marketingPublicidad = 0;
  let otros = 0;

  // Desde ventas (comisiones directas)
  ventas.forEach(venta => {
    if (venta.comisionML) comisionesPlataformas += venta.comisionML;
    if (venta.costoEnvioML) comisionesPlataformas += venta.costoEnvioML;
    if (venta.otrosGastosVenta) otros += venta.otrosGastosVenta;
  });

  // Desde gastos registrados como GV
  gastos
    .filter(g => g.categoria === 'GV')
    .forEach(g => {
      if (g.tipo === 'marketing') {
        marketingPublicidad += g.montoPEN;
      } else if (g.tipo === 'comision_ml') {
        comisionesPlataformas += g.montoPEN;
      } else {
        otros += g.montoPEN;
      }
    });

  return {
    comisionesPlataformas,
    marketingPublicidad,
    otros,
    total: comisionesPlataformas + marketingPublicidad + otros
  };
}

/**
 * Calcular Gastos de Distribución (GD) - COSTO VARIABLE
 */
function calcularGD(ventas: Venta[], gastos: Gasto[]): GastosDistribucion {
  let delivery = 0;
  let empaque = 0;
  let fleteLocal = 0;
  let otros = 0;

  // Desde ventas (costo de envío asumido por negocio)
  ventas.forEach(venta => {
    if (venta.costoEnvioNegocio) delivery += venta.costoEnvioNegocio;
  });

  // Desde gastos registrados como GD
  gastos
    .filter(g => g.categoria === 'GD')
    .forEach(g => {
      if (g.tipo === 'delivery') {
        delivery += g.montoPEN;
      } else if (g.tipo === 'empaque') {
        empaque += g.montoPEN;
      } else {
        otros += g.montoPEN;
      }
    });

  return {
    delivery,
    empaque,
    fleteLocal,
    otros,
    total: delivery + empaque + fleteLocal + otros
  };
}

/**
 * Calcular Gastos Administrativos (GA) - COSTO FIJO
 */
function calcularGA(gastos: Gasto[]): GastosAdministrativos {
  let planilla = 0;
  let servicios = 0;
  let alquiler = 0;
  let contabilidad = 0;
  let otros = 0;

  gastos
    .filter(g => g.categoria === 'GA')
    .forEach(g => {
      const desc = g.descripcion?.toLowerCase() || '';
      if (desc.includes('planilla') || desc.includes('sueldo') || desc.includes('salario')) {
        planilla += g.montoPEN;
      } else if (desc.includes('luz') || desc.includes('agua') || desc.includes('internet') || desc.includes('servicio')) {
        servicios += g.montoPEN;
      } else if (desc.includes('alquiler') || desc.includes('renta')) {
        alquiler += g.montoPEN;
      } else if (desc.includes('contador') || desc.includes('contab') || desc.includes('asesor')) {
        contabilidad += g.montoPEN;
      } else {
        otros += g.montoPEN;
      }
    });

  return {
    planilla,
    servicios,
    alquiler,
    contabilidad,
    otros,
    total: planilla + servicios + alquiler + contabilidad + otros
  };
}

/**
 * Calcular Gastos Operativos (GO) - COSTO FIJO
 */
function calcularGO(gastos: Gasto[]): GastosOperativos {
  let movilidad = 0;
  let suministros = 0;
  let mantenimiento = 0;
  let otros = 0;

  gastos
    .filter(g => g.categoria === 'GO')
    .forEach(g => {
      const desc = g.descripcion?.toLowerCase() || '';
      if (desc.includes('movilidad') || desc.includes('transporte') || desc.includes('gasolina')) {
        movilidad += g.montoPEN;
      } else if (desc.includes('suministro') || desc.includes('oficina') || desc.includes('papelería')) {
        suministros += g.montoPEN;
      } else if (desc.includes('mantenimiento') || desc.includes('reparación')) {
        mantenimiento += g.montoPEN;
      } else {
        otros += g.montoPEN;
      }
    });

  return {
    movilidad,
    suministros,
    mantenimiento,
    otros,
    total: movilidad + suministros + mantenimiento + otros
  };
}

/**
 * Calcular otros ingresos y gastos (diferencia cambiaria, financieros)
 */
function calcularOtrosIngresosGastos(ventas: Venta[], compras: OrdenCompra[]): OtrosIngresosGastos {
  let gananciaCambiariaVentas = 0;
  let perdidaCambiariaVentas = 0;
  let gananciaCambiariaCompras = 0;
  let perdidaCambiariaCompras = 0;

  // Diferencia cambiaria desde ventas
  ventas.forEach(venta => {
    if (venta.diferenciaTC) {
      if (venta.diferenciaTC > 0) {
        gananciaCambiariaVentas += venta.diferenciaTC;
      } else {
        perdidaCambiariaVentas += Math.abs(venta.diferenciaTC);
      }
    }
  });

  // Diferencia cambiaria desde compras
  compras.forEach(orden => {
    if (orden.diferenciaCambiaria) {
      if (orden.diferenciaCambiaria > 0) {
        gananciaCambiariaCompras += orden.diferenciaCambiaria;
      } else {
        perdidaCambiariaCompras += Math.abs(orden.diferenciaCambiaria);
      }
    }
  });

  const diferenciaCambiariaNeta =
    (gananciaCambiariaVentas + gananciaCambiariaCompras) -
    (perdidaCambiariaVentas + perdidaCambiariaCompras);

  const total = diferenciaCambiariaNeta; // + otros cuando se implementen

  return {
    gananciaCambiariaVentas,
    perdidaCambiariaVentas,
    gananciaCambiariaCompras,
    perdidaCambiariaCompras,
    diferenciaCambiariaNeta,
    gastosFinancieros: 0,
    otrosIngresos: 0,
    otrosGastos: 0,
    total
  };
}

/**
 * Calcular indicadores del Estado de Resultados
 */
function calcularIndicadores(
  ventasNetas: number,
  compras: number,
  utilidadBruta: number,
  gastosVariables: number,
  gastosFijos: number,
  utilidadOperativa: number,
  utilidadNeta: number,
  unidadesVendidas: number
): IndicadoresEstadoResultados {
  const margenBruto = ventasNetas > 0 ? (utilidadBruta / ventasNetas) * 100 : 0;
  const margenOperativo = ventasNetas > 0 ? (utilidadOperativa / ventasNetas) * 100 : 0;
  const margenNeto = ventasNetas > 0 ? (utilidadNeta / ventasNetas) * 100 : 0;
  const ratioInversion = ventasNetas > 0 ? (compras / ventasNetas) * 100 : 0;
  const ratioGastosVariables = ventasNetas > 0 ? (gastosVariables / ventasNetas) * 100 : 0;
  const ratioGastosFijos = ventasNetas > 0 ? (gastosFijos / ventasNetas) * 100 : 0;

  // Punto de equilibrio
  // Margen de contribución % = (Ventas - Compras - Gastos Variables) / Ventas
  const margenContribucionPct = ventasNetas > 0
    ? ((ventasNetas - compras - gastosVariables) / ventasNetas)
    : 0;

  const puntoEquilibrioSoles = margenContribucionPct > 0
    ? gastosFijos / margenContribucionPct
    : 0;

  const precioPromedio = unidadesVendidas > 0 ? ventasNetas / unidadesVendidas : 0;
  const puntoEquilibrioUnidades = precioPromedio > 0
    ? Math.ceil(puntoEquilibrioSoles / precioPromedio)
    : 0;

  // Margen de seguridad
  const margenSeguridad = ventasNetas > 0
    ? ((ventasNetas - puntoEquilibrioSoles) / ventasNetas) * 100
    : 0;

  return {
    margenBruto,
    margenOperativo,
    margenNeto,
    ratioInversion,
    ratioGastosVariables,
    ratioGastosFijos,
    puntoEquilibrioSoles,
    puntoEquilibrioUnidades,
    margenSeguridad
  };
}

/**
 * Calcular métricas operativas
 */
function calcularMetricas(
  ventas: Venta[],
  compras: ComprasPeriodo,
  ventasNetas: number
): MetricasOperativas {
  const transacciones = ventas.length;
  const ticketPromedio = transacciones > 0 ? ventasNetas / transacciones : 0;

  let unidadesVendidas = 0;
  ventas.forEach(v => {
    v.productos.forEach(p => {
      unidadesVendidas += p.cantidad;
    });
  });

  const precioPromedioUnidad = unidadesVendidas > 0 ? ventasNetas / unidadesVendidas : 0;
  const rotacionImplicita = compras.total > 0 ? ventasNetas / compras.total : 0;

  return {
    transacciones,
    ticketPromedio,
    unidadesVendidas,
    precioPromedioUnidad,
    ordenesCompra: compras.ordenesRecibidas,
    unidadesCompradas: compras.unidadesCompradas,
    rotacionImplicita
  };
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

/**
 * GENERAR ESTADO DE RESULTADOS
 * Basado en flujo de actividad del negocio
 */
export async function generarEstadoResultados(mes: number, anio: number, lineaNegocioId?: string | null): Promise<EstadoResultados> {
  // Obtener TC centralizado para conversiones
  const tcDefault = await tipoCambioService.resolverTCVenta();

  // Obtener datos de todas las fuentes (filtrados por línea de negocio si aplica)
  const [ventas, gastos, ordenesCompra, transferencias] = await Promise.all([
    getVentasPeriodo(mes, anio, lineaNegocioId),
    getGastosPeriodo(mes, anio, lineaNegocioId),
    getComprasPeriodo(mes, anio),
    getTransferenciasPeriodo(mes, anio)
  ]);

  // Período
  const periodo: PeriodoContable = {
    mes,
    anio,
    nombreMes: MESES[mes]
  };

  // ========== INGRESOS ==========
  const ventasBrutas = ventas.reduce((sum, v) => sum + v.subtotalPEN + (v.costoEnvio || 0), 0);
  const descuentos = ventas.reduce((sum, v) => sum + (v.descuento || 0), 0);
  const devoluciones = 0; // TODO: Implementar módulo de devoluciones
  const ventasNetas = ventas.reduce((sum, v) => sum + v.totalPEN, 0);

  // ========== ANTICIPOS (informativo) ==========
  // Consultar movimientos de tesorería tipo ingreso_anticipo para saber cuánto
  // de los ingresos registrados son anticipos (producto aún no entregado)
  let anticiposPendientes = 0;
  try {
    // Obtener todos los movimientos y filtrar en memoria para evitar índices compuestos
    const todosMovimientos = await tesoreriaService.getMovimientos({});
    anticiposPendientes = todosMovimientos
      .filter(m => m.tipo === 'ingreso_anticipo' && m.estado === 'ejecutado')
      .reduce((sum, m) => sum + (m.montoEquivalentePEN || m.monto), 0);
  } catch {
    // Si falla, dejamos en 0
  }
  const ventasNetasRealizadas = ventasNetas - anticiposPendientes;

  // ========== COSTO DE MERCADERÍA (COMPRAS + FLETE) ==========
  // Incluye: productos + impuestos + flete USA-PERU (transferencias)
  const compras = calcularCompras(ordenesCompra, transferencias, ventasNetas, tcDefault);

  // ========== UTILIDAD BRUTA ==========
  const utilidadBruta = ventasNetas - compras.total;
  const utilidadBrutaPorcentaje = ventasNetas > 0 ? (utilidadBruta / ventasNetas) * 100 : 0;

  // ========== GASTOS OPERATIVOS ==========
  const gv = calcularGV(ventas, gastos);
  const gd = calcularGD(ventas, gastos);
  const ga = calcularGA(gastos);
  const go = calcularGO(gastos);

  // Costos Variables (GV + GD)
  const totalCostosVariables = gv.total + gd.total;
  const costosVariables: CostosVariables = {
    gv,
    gd,
    total: totalCostosVariables,
    porcentajeVentas: ventasNetas > 0 ? (totalCostosVariables / ventasNetas) * 100 : 0
  };

  // Costos Fijos (GA + GO)
  const totalCostosFijos = ga.total + go.total;
  const costosFijos: CostosFijos = {
    ga,
    go,
    total: totalCostosFijos,
    porcentajeVentas: ventasNetas > 0 ? (totalCostosFijos / ventasNetas) * 100 : 0
  };

  const totalGastosOperativos = totalCostosVariables + totalCostosFijos;
  const totalGastosOperativosPorcentaje = ventasNetas > 0 ? (totalGastosOperativos / ventasNetas) * 100 : 0;

  // ========== UTILIDAD OPERATIVA (EBIT) ==========
  const utilidadOperativa = utilidadBruta - totalGastosOperativos;
  const utilidadOperativaPorcentaje = ventasNetas > 0 ? (utilidadOperativa / ventasNetas) * 100 : 0;

  // ========== OTROS INGRESOS/GASTOS ==========
  const otrosIngresosGastos = calcularOtrosIngresosGastos(ventas, ordenesCompra);

  // ========== UTILIDAD NETA ==========
  const utilidadNeta = utilidadOperativa + otrosIngresosGastos.total;
  const utilidadNetaPorcentaje = ventasNetas > 0 ? (utilidadNeta / ventasNetas) * 100 : 0;

  // ========== MÉTRICAS ==========
  const metricas = calcularMetricas(ventas, compras, ventasNetas);

  // ========== INDICADORES ==========
  const indicadores = calcularIndicadores(
    ventasNetas,
    compras.total,
    utilidadBruta,
    totalCostosVariables,
    totalCostosFijos,
    utilidadOperativa,
    utilidadNeta,
    metricas.unidadesVendidas
  );

  return {
    periodo,
    fechaGeneracion: new Date(),
    ventasBrutas,
    descuentos,
    devoluciones,
    ventasNetas,
    compras,
    utilidadBruta,
    utilidadBrutaPorcentaje,
    costosVariables,
    costosFijos,
    totalGastosOperativos,
    totalGastosOperativosPorcentaje,
    utilidadOperativa,
    utilidadOperativaPorcentaje,
    otrosIngresosGastos,
    utilidadNeta,
    utilidadNetaPorcentaje,
    anticiposPendientes,
    ventasNetasRealizadas,
    indicadores,
    metricas
  };
}

/**
 * Obtener resumen rápido para dashboard
 */
export async function getResumenContable(mes: number, anio: number, lineaNegocioId?: string | null): Promise<ResumenContable> {
  const estado = await generarEstadoResultados(mes, anio, lineaNegocioId);

  // Obtener mes anterior para comparación
  let variacionVsMesAnterior: number | undefined;
  let tendencia: 'subiendo' | 'bajando' | 'estable' = 'estable';

  try {
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const anioAnterior = mes === 1 ? anio - 1 : anio;
    const estadoAnterior = await generarEstadoResultados(mesAnterior, anioAnterior, lineaNegocioId);

    if (estadoAnterior.ventasNetas > 0) {
      variacionVsMesAnterior = ((estado.ventasNetas - estadoAnterior.ventasNetas) / estadoAnterior.ventasNetas) * 100;

      if (variacionVsMesAnterior > 5) tendencia = 'subiendo';
      else if (variacionVsMesAnterior < -5) tendencia = 'bajando';
    }
  } catch {
    // Si no hay datos del mes anterior, no hay variación
  }

  return {
    periodo: estado.periodo,
    ventasNetas: estado.ventasNetas,
    compras: estado.compras.total,
    utilidadBruta: estado.utilidadBruta,
    gastosOperativos: estado.totalGastosOperativos,
    utilidadNeta: estado.utilidadNeta,
    margenNeto: estado.utilidadNetaPorcentaje,
    variacionVsMesAnterior,
    tendencia
  };
}

/**
 * Obtener tendencia mensual para gráficos
 */
export async function getTendenciaMensual(anio: number, lineaNegocioId?: string | null): Promise<TendenciaMensual[]> {
  const tendencia: TendenciaMensual[] = [];
  const mesActual = new Date().getMonth() + 1;
  const anioActual = new Date().getFullYear();

  const hastasMes = anio === anioActual ? mesActual : 12;

  for (let mes = 1; mes <= hastasMes; mes++) {
    try {
      const estado = await generarEstadoResultados(mes, anio, lineaNegocioId);
      tendencia.push({
        mes,
        anio,
        nombreMes: MESES[mes],
        ventasNetas: estado.ventasNetas,
        compras: estado.compras.total,
        utilidadBruta: estado.utilidadBruta,
        gastosOperativos: estado.totalGastosOperativos,
        utilidadOperativa: estado.utilidadOperativa,
        utilidadNeta: estado.utilidadNeta
      });
    } catch {
      tendencia.push({
        mes,
        anio,
        nombreMes: MESES[mes],
        ventasNetas: 0,
        compras: 0,
        utilidadBruta: 0,
        gastosOperativos: 0,
        utilidadOperativa: 0,
        utilidadNeta: 0
      });
    }
  }

  return tendencia;
}

// ============================================================================
// BALANCE GENERAL (Balance Sheet)
// ============================================================================

/**
 * Obtener efectivo y equivalentes desde cuentas de tesorería
 */
async function getEfectivoEquivalentes(tc: number): Promise<EfectivoEquivalentes> {
  const cuentasRef = collection(db, COLLECTIONS.CUENTAS_CAJA);
  const q = query(cuentasRef, where('activa', '==', true));
  const snapshot = await getDocs(q);

  let cajaEfectivo = 0;
  let bancosPEN = 0;
  let bancosUSD = 0;
  let bancosUSDOriginal = 0;
  let billeterasDigitales = 0;
  const detalleCuentas: EfectivoEquivalentes['detalleCuentas'] = [];

  snapshot.forEach(doc => {
    const cuenta = { id: doc.id, ...doc.data() } as CuentaCaja;

    // Excluir cuentas de crédito (son pasivo, no activo)
    if (cuenta.tipo === 'credito') return;

    let saldoPEN = 0;
    let saldoOriginal = 0;
    let moneda = 'PEN';

    if (cuenta.esBiMoneda) {
      // Cuenta bimoneda
      const saldoUSD = cuenta.saldoUSD || 0;
      const saldoPENDirecto = cuenta.saldoPEN || 0;
      saldoPEN = saldoPENDirecto + (saldoUSD * tc);
      saldoOriginal = saldoPENDirecto + saldoUSD;
      moneda = 'USD+PEN';

      if (cuenta.tipo === 'banco') {
        bancosPEN += saldoPENDirecto;
        bancosUSD += saldoUSD * tc;
        bancosUSDOriginal += saldoUSD;
      } else if (cuenta.tipo === 'efectivo') {
        cajaEfectivo += saldoPEN;
      } else {
        billeterasDigitales += saldoPEN;
      }
    } else {
      // Cuenta mono-moneda
      saldoOriginal = cuenta.saldoActual || 0;
      if (cuenta.moneda === 'USD') {
        saldoPEN = saldoOriginal * tc;
        moneda = 'USD';
        if (cuenta.tipo === 'banco') {
          bancosUSD += saldoPEN;
          bancosUSDOriginal += saldoOriginal;
        }
      } else {
        saldoPEN = saldoOriginal;
        moneda = 'PEN';
        if (cuenta.tipo === 'banco') {
          bancosPEN += saldoPEN;
        } else if (cuenta.tipo === 'efectivo') {
          cajaEfectivo += saldoPEN;
        } else {
          billeterasDigitales += saldoPEN;
        }
      }
    }

    detalleCuentas.push({
      id: doc.id,
      nombre: cuenta.nombre,
      tipo: cuenta.tipo,
      moneda,
      saldo: saldoOriginal,
      saldoPEN
    });
  });

  const total = cajaEfectivo + bancosPEN + bancosUSD + billeterasDigitales;

  return {
    cajaEfectivo,
    bancosPEN,
    bancosUSD,
    bancosUSDOriginal,
    billeterasDigitales,
    total,
    tipoCambio: tc,
    detalleCuentas
  };
}

/**
 * Obtener cuentas por cobrar (ventas pendientes de pago)
 */
async function getCuentasPorCobrar(): Promise<CuentasPorCobrar> {
  const ventasRef = collection(db, COLLECTIONS.VENTAS);
  const snapshot = await getDocs(ventasRef);

  let ventasPendientes = 0;
  let cantidadVentas = 0;
  const antiguedad = {
    de0a7dias: 0,
    de8a15dias: 0,
    de16a30dias: 0,
    mayor30dias: 0
  };
  const porCanal: Record<string, number> = {};
  const ahora = new Date();

  snapshot.forEach(doc => {
    const venta = doc.data() as Venta;

    // Solo ventas válidas con pago pendiente
    if (
      venta.estado !== 'cotizacion' &&
      venta.estado !== 'cancelada' &&
      venta.estadoPago !== 'pagado'
    ) {
      const pendiente = venta.montoPendiente || (venta.totalPEN - (venta.montoPagado || 0));

      if (pendiente > 0) {
        ventasPendientes += pendiente;
        cantidadVentas++;

        // Calcular antigüedad
        const fechaVenta = venta.fechaCreacion?.toDate?.() ||
          (venta.fechaCreacion && typeof venta.fechaCreacion === 'object' && 'seconds' in venta.fechaCreacion
            ? new Date((venta.fechaCreacion as { seconds: number }).seconds * 1000)
            : new Date());
        const diasPendiente = Math.floor((ahora.getTime() - fechaVenta.getTime()) / (1000 * 60 * 60 * 24));

        if (diasPendiente <= 7) {
          antiguedad.de0a7dias += pendiente;
        } else if (diasPendiente <= 15) {
          antiguedad.de8a15dias += pendiente;
        } else if (diasPendiente <= 30) {
          antiguedad.de16a30dias += pendiente;
        } else {
          antiguedad.mayor30dias += pendiente;
        }

        // Por canal
        const canal = venta.canal || 'otros';
        porCanal[canal] = (porCanal[canal] || 0) + pendiente;
      }
    }
  });

  // Provisión para incobrables: 5% de cartera > 30 días
  const provisionIncobrables = antiguedad.mayor30dias * 0.05;

  return {
    ventasPendientes,
    cantidadVentas,
    provisionIncobrables,
    neto: ventasPendientes - provisionIncobrables,
    antiguedad,
    porCanal
  };
}

/**
 * Obtener inventarios valorizados con CTRU
 */
async function getInventarios(tc: number): Promise<Inventarios> {
  const unidadesRef = collection(db, COLLECTIONS.UNIDADES);
  const snapshot = await getDocs(unidadesRef);

  // Origen (legacy: USA)
  let unidadesUSA = 0;
  let valorUSA_USD = 0;
  let enAlmacenesUSA = 0;
  let enTransitoUSA = 0;

  // Destino (legacy: Perú)
  let unidadesPeru = 0;
  let valorPeru_PEN = 0;
  let disponiblePeru = 0;
  let reservadoPeru = 0;

  let sumaCTRU = 0;
  let countCTRU = 0;

  snapshot.forEach(doc => {
    const unidad = doc.data() as Unidad;

    // Solo contar unidades activas (no vendidas, no dañadas, no vencidas)
    const esActiva = esEstadoEnOrigen(unidad.estado) ||
      esEstadoEnTransitoOrigen(unidad.estado) ||
      unidad.estado === 'en_transito_peru' ||
      unidad.estado === 'disponible_peru' ||
      unidad.estado === 'reservada' ||
      unidad.estado === 'asignada_pedido';
    if (!esActiva) return;

    // Costo total de la unidad (producto + flete)
    const costoProductoUSD = unidad.costoUnitarioUSD || 0;
    const costoFleteUSD = unidad.costoFleteUSD || 0;
    const costoTotalUSD = costoProductoUSD + costoFleteUSD;
    const tcUnidad = unidad.tcPago || unidad.tcCompra || tc;

    // CTRU: usar utility centralizado
    const ctru = getCTRU(unidad);

    if (ctru > 0) {
      sumaCTRU += ctru;
      countCTRU++;
    }

    // Clasificar por ubicación
    if (esPaisOrigen(unidad.pais) || esEstadoEnOrigen(unidad.estado)) {
      unidadesUSA++;
      // En origen: valor = costo producto (el flete aún no aplica)
      valorUSA_USD += costoProductoUSD;

      if (esEstadoEnOrigen(unidad.estado)) {
        enAlmacenesUSA++;
      }
    } else if (unidad.estado === 'en_transito_peru' || esEstadoEnTransitoOrigen(unidad.estado)) {
      // En tránsito: ya incluye el flete comprometido
      unidadesUSA++; // Se cuenta como origen en ubicación
      valorUSA_USD += costoTotalUSD; // Incluye flete porque ya está en camino
      enTransitoUSA++;
    } else {
      // Perú: CTRU completo (producto + flete + gastos)
      unidadesPeru++;
      valorPeru_PEN += ctru;

      if (unidad.estado === 'disponible_peru') {
        disponiblePeru++;
      } else if (unidad.estado === 'reservada' || unidad.estado === 'asignada_pedido') {
        reservadoPeru++;
      }
    }
  });

  const ctruPromedio = countCTRU > 0 ? sumaCTRU / countCTRU : 0;
  const valorUSA_PEN = valorUSA_USD * tc;
  const totalValorPEN = valorUSA_PEN + valorPeru_PEN;

  const inventarioUSA = {
    unidades: unidadesUSA,
    valorUSD: valorUSA_USD,
    valorPEN: valorUSA_PEN,
    enAlmacenes: enAlmacenesUSA,
    enTransito: enTransitoUSA
  };
  const inventarioPeru = {
    unidades: unidadesPeru,
    valorPEN: valorPeru_PEN,
    disponible: disponiblePeru,
    reservado: reservadoPeru
  };

  return {
    inventarioUSA,
    inventarioPeru,
    inventarioOrigen: inventarioUSA,
    inventarioDestino: inventarioPeru,
    totalUnidades: unidadesUSA + unidadesPeru,
    totalValorPEN,
    metodoValorizacion: 'CTRU',
    ctruPromedio,
    tipoCambio: tc
  };
}

/**
 * Obtener cuentas por pagar a proveedores (OCs pendientes)
 */
async function getCuentasPorPagarProveedores(tc: number): Promise<CuentasPorPagarProveedores> {
  const ordenesRef = collection(db, COLLECTIONS.ORDENES_COMPRA);
  const snapshot = await getDocs(ordenesRef);

  let ordenesCompraPendientes = 0;
  let ordenesCompraUSD = 0;
  let cantidadOCs = 0;
  const antiguedad = {
    de0a7dias: 0,
    de8a15dias: 0,
    de16a30dias: 0,
    mayor30dias: 0
  };
  const ahora = new Date();

  snapshot.forEach(doc => {
    const orden = doc.data() as OrdenCompra;

    // Solo OCs con pago pendiente
    if (orden.estadoPago === 'pendiente' || orden.estadoPago === 'parcial') {
      const pendienteUSD = orden.montoPendiente || orden.totalUSD - (orden.montosPagados?.reduce((s, m) => s + m, 0) || 0);

      if (pendienteUSD > 0) {
        ordenesCompraUSD += pendienteUSD;
        ordenesCompraPendientes += pendienteUSD * tc;
        cantidadOCs++;

        // Calcular antigüedad
        const fechaOC = orden.fechaCreacion?.toDate?.() || new Date();
        const diasPendiente = Math.floor((ahora.getTime() - fechaOC.getTime()) / (1000 * 60 * 60 * 24));

        const montoPEN = pendienteUSD * tc;
        if (diasPendiente <= 7) {
          antiguedad.de0a7dias += montoPEN;
        } else if (diasPendiente <= 15) {
          antiguedad.de8a15dias += montoPEN;
        } else if (diasPendiente <= 30) {
          antiguedad.de16a30dias += montoPEN;
        } else {
          antiguedad.mayor30dias += montoPEN;
        }
      }
    }
  });

  return {
    ordenesCompraPendientes,
    ordenesCompraUSD,
    cantidadOCs,
    antiguedad
  };
}

/**
 * Obtener otras cuentas por pagar (gastos, viajeros)
 */
async function getOtrasCuentasPorPagar(tc: number): Promise<OtrasCuentasPorPagar> {
  // Gastos pendientes
  const gastosRef = collection(db, COLLECTIONS.GASTOS);
  const qGastos = query(gastosRef, where('estado', '==', 'pendiente'));
  const snapshotGastos = await getDocs(qGastos);

  let gastosPendientes = 0;
  snapshotGastos.forEach(docSnap => {
    const gasto = docSnap.data() as Gasto;
    gastosPendientes += gasto.montoPEN || 0;
  });

  // Pagos a viajeros (transferencias usa_peru con flete pendiente)
  const pagosViajerosPendientes = await getPagosViajerosPendientes(tc);

  return {
    gastosPendientes,
    pagosViajerosPendientes,
    impuestosPorPagar: 0,
    otras: 0,
    total: gastosPendientes + pagosViajerosPendientes
  };
}

/**
 * Obtener anticipos de clientes (ingresos diferidos)
 * Busca en movimientosTesoreria los movimientos tipo 'ingreso_anticipo' ejecutados.
 * Estos representan pagos recibidos por productos aún no entregados (pasivo).
 */
async function getAnticiposClientes(): Promise<AnticiposClientes> {
  // Obtener todos los movimientos de tesorería y filtrar en memoria
  // para evitar requerir índices compuestos adicionales en Firestore
  const movimientos = await tesoreriaService.getMovimientos({});

  // Filtrar ingreso_anticipo ejecutados en memoria
  const anticipos = movimientos.filter(m =>
    m.tipo === 'ingreso_anticipo' && m.estado === 'ejecutado'
  );

  let totalAnticiposPEN = 0;
  let cantidadVentas = 0;
  const detalle: AnticiposClientes['detalle'] = [];
  // Agrupar por ventaId o cotizacionId para no duplicar
  const vistos = new Set<string>();

  for (const mov of anticipos) {
    const key = mov.ventaId || mov.cotizacionId || mov.id;
    if (vistos.has(key)) {
      // Sumar al existente
      totalAnticiposPEN += mov.montoEquivalentePEN || mov.monto;
      const existing = detalle.find(d => d.ventaId === key);
      if (existing) existing.montoAnticipo += mov.montoEquivalentePEN || mov.monto;
      continue;
    }
    vistos.add(key);

    const montoAnticipo = mov.montoEquivalentePEN || mov.monto;
    totalAnticiposPEN += montoAnticipo;
    cantidadVentas++;

    detalle.push({
      ventaId: key,
      numeroVenta: mov.ventaNumero || mov.cotizacionNumero || mov.numeroMovimiento || 'S/N',
      clienteNombre: mov.concepto || 'Sin nombre',
      montoAnticipo,
      estado: 'anticipo_pendiente'
    });
  }

  return { totalAnticiposPEN, cantidadVentas, detalle };
}

/**
 * Obtener deudas financieras de corto plazo
 * Lee cuentas tipo 'credito' con saldo negativo (TC, préstamos, líneas de crédito)
 * y suma préstamos de viajeros pendientes
 */
async function getDeudasFinancieras(tc: number): Promise<DeudasFinancieras> {
  const cuentasRef = collection(db, COLLECTIONS.CUENTAS_CAJA);
  const snapshot = await getDocs(query(cuentasRef, where('activa', '==', true)));

  let tarjetasCredito = 0;
  let otrasDeudas = 0;
  const detalle: DeudaFinanciera[] = [];

  snapshot.forEach(docSnap => {
    const cuenta = { id: docSnap.id, ...docSnap.data() } as CuentaCaja;
    if (cuenta.tipo !== 'credito') return;

    // Saldo negativo = deuda activa
    const saldo = cuenta.esBiMoneda
      ? (cuenta.saldoPEN || 0) + ((cuenta.saldoUSD || 0) * tc)
      : cuenta.saldoActual || 0;

    if (saldo < 0) {
      const montoDeuda = Math.abs(saldo);
      // Para cuentas USD mono-moneda, convertir a PEN
      const montoPEN = (!cuenta.esBiMoneda && cuenta.moneda === 'USD')
        ? montoDeuda * tc
        : montoDeuda;

      // Clasificar por nombre
      const nombreLower = cuenta.nombre.toLowerCase();
      const esTC = nombreLower.includes('tarjeta') || nombreLower.includes('tc ') || nombreLower.includes('visa') || nombreLower.includes('mastercard');
      if (esTC) {
        tarjetasCredito += montoPEN;
      } else {
        otrasDeudas += montoPEN;
      }

      detalle.push({
        cuentaId: docSnap.id,
        nombreCuenta: cuenta.nombre,
        banco: cuenta.banco,
        montoDeuda,
        moneda: cuenta.moneda,
        montoPEN
      });
    }
  });

  // Préstamos viajeros pendientes (ya calculado, se mueve aquí desde OtrasCxP)
  const prestamosViajeros = await getPagosViajerosPendientes(tc);

  return {
    tarjetasCredito,
    prestamosViajeros,
    otrasDeudas,
    total: tarjetasCredito + prestamosViajeros + otrasDeudas,
    detalle
  };
}

/**
 * Calcular utilidades acumuladas (YTD)
 */
async function calcularUtilidadesAcumuladas(anio: number, hastasMes: number): Promise<number> {
  let utilidadAcumulada = 0;

  for (let mes = 1; mes <= hastasMes; mes++) {
    try {
      const estado = await generarEstadoResultados(mes, anio);
      utilidadAcumulada += estado.utilidadNeta;
    } catch {
      // Sin datos para ese mes
    }
  }

  return utilidadAcumulada;
}

/**
 * GENERAR BALANCE GENERAL
 */
export async function generarBalanceGeneral(mes: number, anio: number): Promise<BalanceGeneral> {
  // Obtener tipo de cambio real y configuración en paralelo
  const [tc, config] = await Promise.all([
    obtenerTipoCambio(),
    getConfiguracionContable()
  ]);

  const periodo: PeriodoContable = {
    mes,
    anio,
    nombreMes: MESES[mes]
  };

  // ========== ACTIVOS ==========
  const [efectivo, cuentasPorCobrar, inventarios] = await Promise.all([
    getEfectivoEquivalentes(tc),
    getCuentasPorCobrar(),
    getInventarios(tc)
  ]);

  const activoCorriente = {
    efectivo,
    cuentasPorCobrar,
    inventarios,
    gastosPagadosAnticipado: 0,
    otrosActivosCorrientes: 0,
    total: efectivo.total + cuentasPorCobrar.neto + inventarios.totalValorPEN
  };

  const activoNoCorriente = {
    propiedadPlantaEquipo: 0,
    depreciacionAcumulada: 0,
    intangibles: 0,
    otros: 0,
    total: 0
  };

  const totalActivos = activoCorriente.total + activoNoCorriente.total;

  // ========== PASIVOS ==========
  const [cuentasPorPagarProv, otrasCuentasPorPagar, anticiposClientes, deudasFinancieras] = await Promise.all([
    getCuentasPorPagarProveedores(tc),
    getOtrasCuentasPorPagar(tc),
    getAnticiposClientes(),
    getDeudasFinancieras(tc)
  ]);

  // Ajustar otrasCxP: quitar viajeros (ahora en deudasFinancieras) para no duplicar
  const otrasCxPAjustado = {
    ...otrasCuentasPorPagar,
    pagosViajerosPendientes: 0,
    total: otrasCuentasPorPagar.total - otrasCuentasPorPagar.pagosViajerosPendientes
  };

  const pasivoCorriente = {
    cuentasPorPagarProveedores: cuentasPorPagarProv,
    otrasCuentasPorPagar: otrasCxPAjustado,
    anticiposClientes,
    deudasFinancieras,
    total: cuentasPorPagarProv.ordenesCompraPendientes + otrasCxPAjustado.total + anticiposClientes.totalAnticiposPEN + deudasFinancieras.total
  };

  const pasivoNoCorriente = {
    deudasLargoPlazo: 0,
    provisiones: 0,
    otros: 0,
    total: 0
  };

  const totalPasivos = pasivoCorriente.total + pasivoNoCorriente.total;

  // ========== PATRIMONIO ==========
  // Capital social: config base + aportes de capital registrados
  const capitalSocialBase = config.capitalSocial;
  const reservaLegal = config.reservaLegal;

  // Obtener aportes y retiros de capital reales desde tesorería
  const [aportesCapital, retirosCapital] = await Promise.all([
    tesoreriaService.getTotalAportesCapital(),
    tesoreriaService.getTotalRetirosCapital()
  ]);

  // Capital social = base + aportes - retiros de capital (no utilidades)
  const capitalSocial = capitalSocialBase + aportesCapital.totalPEN - (retirosCapital.porTipo.capital || 0);

  // Utilidades acumuladas del ejercicio actual (YTD)
  const utilidadEjercicio = await calcularUtilidadesAcumuladas(anio, mes);

  // Retiros de utilidades (distribuidos a socios)
  const utilidadesDistribuidas = retirosCapital.porTipo.utilidades || 0;

  // Utilidades acumuladas de años anteriores: 0 por defecto
  // TODO: Implementar registro de utilidades de años anteriores si se necesita
  const utilidadesAcumuladas = 0;

  // Patrimonio = Capital + Reservas + Utilidades Acumuladas + Utilidad del Ejercicio - Utilidades Distribuidas
  const totalPatrimonio = capitalSocial + reservaLegal + utilidadesAcumuladas + utilidadEjercicio - utilidadesDistribuidas;

  const patrimonio = {
    capitalSocial,
    reservas: reservaLegal,
    utilidadesAcumuladas,
    utilidadEjercicio,
    totalPatrimonio,
    // Metadata adicional para transparencia
    _detalle: {
      capitalSocialBase,
      aportesCapitalTotal: aportesCapital.totalPEN,
      retirosCapitalTotal: retirosCapital.porTipo.capital || 0,
      utilidadesDistribuidas,
      cantidadAportes: aportesCapital.cantidad,
      cantidadRetiros: retirosCapital.cantidad
    }
  };

  // ========== VERIFICACIÓN ==========
  const totalPasivosPatrimonio = totalPasivos + patrimonio.totalPatrimonio;
  const diferencia = totalActivos - totalPasivosPatrimonio; // Puede ser positivo o negativo

  return {
    fechaCorte: new Date(),
    periodo,
    tipoCambio: tc,
    activos: {
      corriente: activoCorriente,
      noCorriente: activoNoCorriente,
      totalActivos
    },
    pasivos: {
      corriente: pasivoCorriente,
      noCorriente: pasivoNoCorriente,
      totalPasivos
    },
    patrimonio,
    totalPasivosPatrimonio,
    diferencia,
    // El balance cuadra si la diferencia es menor a S/ 1 (por redondeos)
    // Diferencia positiva = Activos > Pasivos + Patrimonio (faltan pasivos o sobran activos)
    // Diferencia negativa = Activos < Pasivos + Patrimonio (sobran pasivos o faltan activos)
    balanceCuadra: Math.abs(diferencia) < 1
  };
}

/**
 * Calcular indicadores financieros
 */
export async function calcularIndicadoresFinancieros(
  mes: number,
  anio: number,
  lineaNegocioId?: string | null
): Promise<IndicadoresFinancieros> {
  const [balance, estado] = await Promise.all([
    generarBalanceGeneral(mes, anio),
    generarEstadoResultados(mes, anio, lineaNegocioId)
  ]);

  const actCorriente = balance.activos.corriente.total;
  const pasCorriente = balance.pasivos.corriente.total;
  const inventarios = balance.activos.corriente.inventarios.totalValorPEN;
  const efectivo = balance.activos.corriente.efectivo.total;
  const totalActivos = balance.activos.totalActivos;
  const totalPasivos = balance.pasivos.totalPasivos;
  const totalPatrimonio = balance.patrimonio.totalPatrimonio;

  // Ratios de Liquidez
  const liquidez = {
    razonCorriente: pasCorriente > 0 ? actCorriente / pasCorriente : 0,
    pruebaAcida: pasCorriente > 0 ? (actCorriente - inventarios) / pasCorriente : 0,
    capitalTrabajo: actCorriente - pasCorriente,
    razonEfectivo: pasCorriente > 0 ? efectivo / pasCorriente : 0
  };

  // Ratios de Solvencia
  const solvencia = {
    endeudamientoTotal: totalActivos > 0 ? (totalPasivos / totalActivos) * 100 : 0,
    endeudamientoPatrimonio: totalPatrimonio > 0 ? (totalPasivos / totalPatrimonio) * 100 : 0,
    autonomia: totalActivos > 0 ? (totalPatrimonio / totalActivos) * 100 : 0,
    apalancamiento: totalPatrimonio > 0 ? totalActivos / totalPatrimonio : 0
  };

  // Ratios de Rentabilidad
  const rentabilidad = {
    roa: totalActivos > 0 ? (estado.utilidadNeta / totalActivos) * 100 : 0,
    roe: totalPatrimonio > 0 ? (estado.utilidadNeta / totalPatrimonio) * 100 : 0,
    margenBruto: estado.indicadores.margenBruto,
    margenOperativo: estado.indicadores.margenOperativo,
    margenNeto: estado.indicadores.margenNeto
  };

  // Ratios de Actividad (anualizados)
  const cxc = balance.activos.corriente.cuentasPorCobrar.ventasPendientes;
  const cxp = balance.pasivos.corriente.cuentasPorPagarProveedores.ordenesCompraPendientes;
  const ventasMes = estado.ventasNetas;
  const comprasMes = estado.compras.total;

  // Anualizamos para cálculos
  const ventasAnualizadas = ventasMes * 12;
  const comprasAnualizadas = comprasMes * 12;

  const rotacionInventarios = inventarios > 0 ? comprasAnualizadas / inventarios : 0;
  const rotacionCxC = cxc > 0 ? ventasAnualizadas / cxc : 0;
  const rotacionCxP = cxp > 0 ? comprasAnualizadas / cxp : 0;

  const actividad = {
    rotacionInventarios,
    diasInventario: rotacionInventarios > 0 ? 365 / rotacionInventarios : 0,
    rotacionCxC,
    diasCobro: rotacionCxC > 0 ? 365 / rotacionCxC : 0,
    rotacionCxP,
    diasPago: rotacionCxP > 0 ? 365 / rotacionCxP : 0,
    cicloConversionEfectivo: 0
  };

  // Ciclo de conversión de efectivo
  actividad.cicloConversionEfectivo = actividad.diasInventario + actividad.diasCobro - actividad.diasPago;

  return {
    liquidez,
    solvencia,
    rentabilidad,
    actividad,
    fechaCalculo: new Date(),
    periodo: { mes, anio, nombreMes: MESES[mes] }
  };
}

/**
 * Generar análisis financiero con semáforo
 */
export function generarAnalisisFinanciero(indicadores: IndicadoresFinancieros): AnalisisFinanciero[] {
  const analisis: AnalisisFinanciero[] = [];

  // Razón corriente
  const rc = indicadores.liquidez.razonCorriente;
  analisis.push({
    indicador: 'Razón Corriente',
    valor: rc,
    valorFormateado: rc.toFixed(2),
    estado: rc >= 2 ? 'excelente' : rc >= 1.5 ? 'bueno' : rc >= 1 ? 'regular' : 'critico',
    descripcion: 'Capacidad de pagar deudas a corto plazo',
    recomendacion: rc < 1 ? 'Mejorar liquidez: aumentar cobros o reducir deudas corto plazo' : undefined
  });

  // Prueba ácida
  const pa = indicadores.liquidez.pruebaAcida;
  analisis.push({
    indicador: 'Prueba Ácida',
    valor: pa,
    valorFormateado: pa.toFixed(2),
    estado: pa >= 1 ? 'excelente' : pa >= 0.7 ? 'bueno' : pa >= 0.5 ? 'regular' : 'critico',
    descripcion: 'Liquidez sin depender de inventarios',
    recomendacion: pa < 0.5 ? 'Liquidez muy baja sin considerar inventarios' : undefined
  });

  // Endeudamiento
  const ed = indicadores.solvencia.endeudamientoTotal;
  analisis.push({
    indicador: 'Endeudamiento Total',
    valor: ed,
    valorFormateado: `${ed.toFixed(1)}%`,
    estado: ed <= 40 ? 'excelente' : ed <= 60 ? 'bueno' : ed <= 80 ? 'regular' : 'critico',
    descripcion: 'Porcentaje de activos financiados con deuda',
    recomendacion: ed > 60 ? 'Considerar reducir deuda o aumentar patrimonio' : undefined
  });

  // ROE
  const roe = indicadores.rentabilidad.roe;
  analisis.push({
    indicador: 'ROE (Rentabilidad Patrimonio)',
    valor: roe,
    valorFormateado: `${roe.toFixed(1)}%`,
    estado: roe >= 20 ? 'excelente' : roe >= 10 ? 'bueno' : roe >= 5 ? 'regular' : roe >= 0 ? 'malo' : 'critico',
    descripcion: 'Retorno sobre el capital de los dueños',
    recomendacion: roe < 10 ? 'Buscar mejorar rentabilidad o eficiencia' : undefined
  });

  // Margen Neto
  const mn = indicadores.rentabilidad.margenNeto;
  analisis.push({
    indicador: 'Margen Neto',
    valor: mn,
    valorFormateado: `${mn.toFixed(1)}%`,
    estado: mn >= 15 ? 'excelente' : mn >= 10 ? 'bueno' : mn >= 5 ? 'regular' : mn >= 0 ? 'malo' : 'critico',
    descripcion: 'Porcentaje de utilidad por cada sol vendido',
    recomendacion: mn < 5 ? 'Revisar estructura de costos y precios' : undefined
  });

  // Días de cobro
  const dc = indicadores.actividad.diasCobro;
  analisis.push({
    indicador: 'Días de Cobro',
    valor: dc,
    valorFormateado: `${dc.toFixed(0)} días`,
    estado: dc <= 15 ? 'excelente' : dc <= 30 ? 'bueno' : dc <= 45 ? 'regular' : 'malo',
    descripcion: 'Tiempo promedio para cobrar a clientes',
    recomendacion: dc > 30 ? 'Mejorar gestión de cobranza' : undefined
  });

  // Ciclo de conversión
  const cce = indicadores.actividad.cicloConversionEfectivo;
  analisis.push({
    indicador: 'Ciclo de Conversión de Efectivo',
    valor: cce,
    valorFormateado: `${cce.toFixed(0)} días`,
    estado: cce <= 30 ? 'excelente' : cce <= 60 ? 'bueno' : cce <= 90 ? 'regular' : 'malo',
    descripcion: 'Tiempo que el dinero está atado en operaciones',
    recomendacion: cce > 60 ? 'Optimizar inventarios y cobranza, negociar plazos con proveedores' : undefined
  });

  return analisis;
}

// Exportar servicio
export const contabilidadService = {
  generarEstadoResultados,
  getResumenContable,
  getTendenciaMensual,
  generarBalanceGeneral,
  calcularIndicadoresFinancieros,
  generarAnalisisFinanciero,
  actualizarConfiguracionContable,
  getConfiguracionContable,
};
