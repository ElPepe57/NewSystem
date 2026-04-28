/**
 * pagoAbonoDistribuido.service.ts — S58b Fase 1
 *
 * Orquesta el caso "1 desembolso → N deudas":
 *   - 1 sola transferencia bancaria (1 movimiento de tesorería)
 *   - N abonos a documentos individuales (N movimientos CC, todos
 *     compartiendo el mismo `movimientoTesoreriaId` para trazabilidad)
 *   - N actualizaciones denormalizadas de `estadoPago` y `montoPendiente`
 *     en cada documento (OC, envío, gasto, boleta).
 *
 * Versión inicial: solo soporta `tipo='oc'`. Otros se agregan en fases
 * posteriores (S58b F4: envío · S58b F5: gasto).
 *
 * GARANTÍAS:
 *  - Las validaciones de input son estrictas y se ejecutan ANTES de
 *    cualquier escritura.
 *  - Si la creación de la tesorería falla → se aborta TODO antes de tocar CC.
 *  - Si un MovCC falla → se acumula en `errores[]`, los demás continúan
 *    (best-effort, igual que `registrarPago`).
 *  - Idempotencia: si se reintenta con la misma `idempotencyKey`, los
 *    movimientos CC con esa key no se duplican.
 *
 * Ver REGISTRO_IMPLEMENTACION.md S58b para decisiones.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import type {
  PagoAbonoDistribuidoInput,
  PagoAbonoDistribuidoResult,
  DeudaDistribuible,
  DeudasFiltro,
  DistribucionItem,
} from '../types/pagoAbonoDistribuido.types';
import type { MovimientoTesoreriaFormData } from '../types/tesoreria.types';
import type { OrdenCompra } from '../types/ordenCompra.types';
import type { Envio } from '../types/envio.types';
import type { Gasto, PagoGasto } from '../types/gasto.types';
import { tesoreriaService } from './tesoreria.service';
import { cuentaCorrienteService } from './cuentaCorriente.service';
import { ORDENES_COLLECTION } from './ordenCompra.shared';
import {
  getPagosOC,
  getPagosEnvio,
  getPagosGasto,
} from './cuentaCorriente.adaptadores';
import { normalizarEstadoPagoOC } from '../types/ordenCompra.types';

// ═════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═════════════════════════════════════════════════════════════════════════

/** Tolerancia para comparaciones de monto (centavos). */
const TOLERANCIA = 0.01;

/** Días de vencimiento heurístico para OCs (a futuro: condición de pago). */
const DIAS_VENCIMIENTO_DEFAULT_OC = 30;

/** Días de vencimiento heurístico para envíos (flete suele ser inmediato). */
const DIAS_VENCIMIENTO_DEFAULT_ENVIO = 14;

/** Días de vencimiento heurístico para gastos (servicios suelen mensuales). */
const DIAS_VENCIMIENTO_DEFAULT_GASTO = 30;

/** Colección de envíos. */
const ENVIOS_COLLECTION = COLLECTIONS.ENVIOS;

/** Colección de gastos. */
const GASTOS_COLLECTION = COLLECTIONS.GASTOS;

// ═════════════════════════════════════════════════════════════════════════
// HELPERS PRIVADOS
// ═════════════════════════════════════════════════════════════════════════

/**
 * Genera una idempotencyKey determinística a partir del input.
 * Útil cuando el caller no provee una.
 */
function generarIdempotencyKey(input: PagoAbonoDistribuidoInput): string {
  const docs = input.distribucion
    .map((d) => `${d.tipo}:${d.documentoId}:${d.montoAplicado.toFixed(2)}`)
    .sort()
    .join('|');
  const fechaIso = input.fecha.toISOString().split('T')[0];
  return `pad:${input.entidadId}:${fechaIso}:${input.monedaAbono}:${input.montoAbono.toFixed(
    2,
  )}:${docs}`;
}

/**
 * Calcula el monto pendiente de una OC desde la CC del proveedor.
 * (Fuente de verdad: CC; el campo `montoPendiente` denormalizado puede
 * estar desactualizado si hubo escrituras directas).
 */
async function calcularPendienteOCDesdeCC(oc: OrdenCompra): Promise<number> {
  const pagos = await getPagosOC(oc.id);
  const totalPagadoUSD = pagos.reduce((s, p) => s + p.montoUSD, 0);
  return Math.max(0, oc.totalUSD - totalPagadoUSD);
}

/**
 * Convierte una OrdenCompra cruda → DeudaDistribuible.
 */
function ocADeuda(oc: OrdenCompra, montoPendienteUSD: number): DeudaDistribuible {
  const fechaCreacion = oc.fechaCreacion;
  const ahora = Date.now();

  // Heurística de vencimiento: fechaCreacion + N días.
  // Cuando el sistema soporte condicionesPago en la OC, leer de ahí.
  const msVencimiento = DIAS_VENCIMIENTO_DEFAULT_OC * 24 * 60 * 60 * 1000;
  const fechaVencMs =
    (fechaCreacion?.toMillis ? fechaCreacion.toMillis() : ahora) + msVencimiento;
  const diasVenc = Math.floor((fechaVencMs - ahora) / (24 * 60 * 60 * 1000));

  return {
    tipo: 'oc',
    documentoId: oc.id,
    documentoNumero: oc.numeroOrden,
    fechaCreacion,
    fechaVencimiento: Timestamp.fromMillis(fechaVencMs),
    montoTotal: oc.totalUSD,
    montoPagado: oc.totalUSD - montoPendienteUSD,
    montoPendiente: montoPendienteUSD,
    moneda: 'USD', // OCs siempre USD por convención del negocio
    diasVencimiento: diasVenc,
    estaVencido: diasVenc < 0,
  };
}

/**
 * Calcula el monto pendiente de un envío desde la CC del colaborador.
 * Convención existente: `costoFleteTotal` se trata como USD aunque
 * `monedaFlete` sea otro valor (ver envio.pagos.service registrarPagoColaborador).
 */
async function calcularPendienteEnvioDesdeCC(envio: Envio): Promise<number> {
  const costoFlete = envio.costoFleteTotal || 0;
  if (costoFlete <= 0) return 0;
  const pagos = await getPagosEnvio(envio.id);
  const totalPagadoUSD = pagos.reduce(
    (s, p) => s + (p.monedaPago === 'USD' ? p.montoOriginal : p.montoUSD),
    0,
  );
  return Math.max(0, costoFlete - totalPagadoUSD);
}

/**
 * Calcula el monto pendiente de un gasto.
 *
 * Si el gasto tiene `proveedorId` (S58b F5+), lee desde CC y suma los pagos
 * en CC para sustraer del monto del gasto. Si NO tiene proveedorId (legacy),
 * lee del array `gasto.pagos[]` denormalizado (montoPagado).
 *
 * Retorna en la moneda nativa del gasto.
 */
async function calcularPendienteGasto(gasto: Gasto): Promise<number> {
  const montoTotal =
    gasto.moneda === 'USD' ? gasto.montoOriginal : gasto.montoPEN;

  // Si tiene proveedorId vinculado, fuente de verdad = CC
  if (gasto.proveedorId) {
    const pagos = await getPagosGasto(gasto.id);
    if (gasto.moneda === 'USD') {
      // Sumar pagos en USD; los PEN se convierten con TC del propio pago
      const totalPagadoUSD = pagos.reduce((s, p) => {
        if (p.monedaPago === 'USD') return s + p.montoOriginal;
        // Sin TC explícito en PagoGastoLegacy, fallback al TC del gasto
        const tc = gasto.tipoCambio || 1;
        return s + (tc > 0 ? p.montoOriginal / tc : 0);
      }, 0);
      return Math.max(0, gasto.montoOriginal - totalPagadoUSD);
    }
    // PEN nativo
    const totalPagadoPEN = pagos.reduce((s, p) => {
      if (p.monedaPago === 'PEN') return s + p.montoOriginal;
      const tc = gasto.tipoCambio || 1;
      return s + p.montoOriginal * tc;
    }, 0);
    return Math.max(0, gasto.montoPEN - totalPagadoPEN);
  }

  // Legacy sin proveedorId: usar pagos[] denormalizado
  const pagosLegacy: PagoGasto[] = gasto.pagos || [];
  if (gasto.moneda === 'USD') {
    const totalPagadoUSD = pagosLegacy.reduce(
      (s, p) => s + (p.montoUSD ?? 0),
      0,
    );
    return Math.max(0, gasto.montoOriginal - totalPagadoUSD);
  }
  const totalPagadoPEN = pagosLegacy.reduce(
    (s, p) => s + (p.montoPEN ?? 0),
    0,
  );
  return Math.max(0, gasto.montoPEN - totalPagadoPEN);
}

/**
 * Convierte un Gasto crudo → DeudaDistribuible.
 * Solo aplica para gastos con proveedorId (vinculación a CC).
 */
function gastoADeuda(gasto: Gasto, montoPendiente: number): DeudaDistribuible {
  const fechaCreacion = gasto.fecha;
  const ahora = Date.now();

  const baseMs = fechaCreacion?.toMillis?.() ?? ahora;
  const msVencimiento = DIAS_VENCIMIENTO_DEFAULT_GASTO * 24 * 60 * 60 * 1000;
  const fechaVencMs = baseMs + msVencimiento;
  const diasVenc = Math.floor((fechaVencMs - ahora) / (24 * 60 * 60 * 1000));

  const montoTotal =
    gasto.moneda === 'USD' ? gasto.montoOriginal : gasto.montoPEN;

  return {
    tipo: 'gasto',
    documentoId: gasto.id,
    documentoNumero: gasto.numeroGasto,
    fechaCreacion,
    fechaVencimiento: Timestamp.fromMillis(fechaVencMs),
    montoTotal,
    montoPagado: montoTotal - montoPendiente,
    montoPendiente,
    moneda: gasto.moneda === 'USD' ? 'USD' : 'PEN',
    diasVencimiento: diasVenc,
    estaVencido: diasVenc < 0,
  };
}

/**
 * Convierte un Envio crudo → DeudaDistribuible.
 * Solo aplica para envíos internacionales con flete > 0.
 */
function envioADeuda(envio: Envio, montoPendienteUSD: number): DeudaDistribuible {
  const fechaCreacion = envio.fechaCreacion;
  const ahora = Date.now();

  // Heurística: fecha confirmación > fechaSalida > fechaCreacion + 14d
  const baseMs = (envio.fechaConfirmacion || envio.fechaCreacion)?.toMillis?.() ?? ahora;
  const msVencimiento = DIAS_VENCIMIENTO_DEFAULT_ENVIO * 24 * 60 * 60 * 1000;
  const fechaVencMs = baseMs + msVencimiento;
  const diasVenc = Math.floor((fechaVencMs - ahora) / (24 * 60 * 60 * 1000));

  const costoFlete = envio.costoFleteTotal || 0;
  return {
    tipo: 'envio',
    documentoId: envio.id,
    documentoNumero: envio.numeroEnvio,
    fechaCreacion,
    fechaVencimiento: Timestamp.fromMillis(fechaVencMs),
    montoTotal: costoFlete,
    montoPagado: costoFlete - montoPendienteUSD,
    montoPendiente: montoPendienteUSD,
    moneda: 'USD', // Convención: flete tratado como USD en CC
    diasVencimiento: diasVenc,
    estaVencido: diasVenc < 0,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// API PÚBLICA: OBTENER DEUDAS
// ═════════════════════════════════════════════════════════════════════════

/**
 * Obtiene el listado de deudas distribuibles para una entidad.
 *
 * Soporta:
 *  - tipo='oc' para entidadTipo='proveedor' (caso default)
 *  - tipo='oc' para entidadTipo='colaborador' (deudor alternativo · recojo en origen)
 *  - tipo='envio' para entidadTipo='colaborador' (S58b F4 · flete pendiente)
 *  - tipo='gasto' para entidadTipo en {proveedor,colaborador,empleado} (S58b F5 ·
 *    solo gastos con proveedorId estructurado · gastos legacy NO aparecen)
 *
 * Filtra por estado != cancelado y estadoPago/estadoPagoColaborador != pagado.
 * Excluye documentos sin pendiente real (verificado contra CC, fuente de verdad).
 *
 * Default tipos: ['oc', 'envio', 'gasto'] — el caller puede limitarlo si necesita.
 */
export async function obtenerDeudasPorEntidad(
  filtro: DeudasFiltro,
): Promise<DeudaDistribuible[]> {
  const tipos = filtro.tipos ?? ['oc', 'envio', 'gasto'];
  const deudas: DeudaDistribuible[] = [];

  // ── Tipo: OC ──
  if (tipos.includes('oc') && filtro.entidadTipo === 'proveedor') {
    const q = query(
      collection(db, ORDENES_COLLECTION),
      where('proveedorId', '==', filtro.entidadId),
    );
    const snap = await getDocs(q);

    for (const d of snap.docs) {
      const oc = { id: d.id, ...d.data() } as OrdenCompra;

      // Excluir canceladas
      if (oc.estado === 'cancelada') continue;

      // Excluir si la deuda es con un colaborador (no con el proveedor)
      if (oc.deudorTipo === 'colaborador' && oc.deudorId) continue;

      const estadoPago = normalizarEstadoPagoOC(oc.estadoPago || 'pendiente');
      if (estadoPago === 'pagado') continue;

      // Calcular pendiente desde CC (fuente de verdad)
      const pendienteUSD = await calcularPendienteOCDesdeCC(oc);
      if (pendienteUSD <= TOLERANCIA) continue;

      deudas.push(ocADeuda(oc, pendienteUSD));
    }
  }

  // ── Tipo: OC pero deudor=colaborador ──
  // Si filtran por colaborador, también devolvemos OCs donde
  // deudorTipo='colaborador' y deudorId=entidadId.
  if (tipos.includes('oc') && filtro.entidadTipo === 'colaborador') {
    const q = query(
      collection(db, ORDENES_COLLECTION),
      where('deudorId', '==', filtro.entidadId),
      where('deudorTipo', '==', 'colaborador'),
    );
    const snap = await getDocs(q);

    for (const d of snap.docs) {
      const oc = { id: d.id, ...d.data() } as OrdenCompra;
      if (oc.estado === 'cancelada') continue;

      const estadoPago = normalizarEstadoPagoOC(oc.estadoPago || 'pendiente');
      if (estadoPago === 'pagado') continue;

      const pendienteUSD = await calcularPendienteOCDesdeCC(oc);
      if (pendienteUSD <= TOLERANCIA) continue;

      deudas.push(ocADeuda(oc, pendienteUSD));
    }
  }

  // ── Tipo: Envío (flete del colaborador transportista) — S58b F4 ──
  // Solo aplica para colaboradores. El flete del envío genera un crédito
  // en CC del colaborador via 'credito_pago_envio'.
  if (tipos.includes('envio') && filtro.entidadTipo === 'colaborador') {
    const q = query(
      collection(db, ENVIOS_COLLECTION),
      where('colaboradorId', '==', filtro.entidadId),
    );
    const snap = await getDocs(q);

    for (const d of snap.docs) {
      const envio = { id: d.id, ...d.data() } as Envio;
      if (envio.estado === 'cancelada') continue;
      if (envio.estadoPagoColaborador === 'pagado') continue;
      if (!envio.costoFleteTotal || envio.costoFleteTotal <= 0) continue;

      const pendienteUSD = await calcularPendienteEnvioDesdeCC(envio);
      if (pendienteUSD <= TOLERANCIA) continue;

      deudas.push(envioADeuda(envio, pendienteUSD));
    }
  }

  // ── Tipo: Gasto (servicios, alquiler, etc.) — S58b F5 ──
  // Solo gastos con proveedorId estructurado vinculado a esta entidad.
  // Gastos legacy con proveedor=string pero sin proveedorId NO aparecen
  // (siguen pagándose individualmente vía gasto.service.registrarPago).
  if (
    tipos.includes('gasto') &&
    (filtro.entidadTipo === 'proveedor' ||
      filtro.entidadTipo === 'colaborador' ||
      filtro.entidadTipo === 'empleado')
  ) {
    const q = query(
      collection(db, GASTOS_COLLECTION),
      where('proveedorId', '==', filtro.entidadId),
    );
    const snap = await getDocs(q);

    for (const d of snap.docs) {
      const gasto = { id: d.id, ...d.data() } as Gasto;
      if (gasto.estado === 'cancelado') continue;
      if (gasto.estado === 'pagado') continue;

      const pendiente = await calcularPendienteGasto(gasto);
      if (pendiente <= TOLERANCIA) continue;

      deudas.push(gastoADeuda(gasto, pendiente));
    }
  }

  // ── Filtros adicionales ──
  let resultado = deudas;
  if (filtro.soloVencidos) {
    resultado = resultado.filter((d) => d.estaVencido);
  }
  if (filtro.moneda) {
    resultado = resultado.filter((d) => d.moneda === filtro.moneda);
  }

  // Ordenar por antigüedad (más antiguas primero)
  resultado.sort(
    (a, b) =>
      (a.fechaCreacion?.toMillis?.() ?? 0) -
      (b.fechaCreacion?.toMillis?.() ?? 0),
  );

  return resultado;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS DE APLICACIÓN POR TIPO DE DOCUMENTO
// ═════════════════════════════════════════════════════════════════════════

/**
 * Aplica un item de distribución a una OC: crea MovCC y actualiza
 * denormalización (estadoPago, montoPendiente, sub-órdenes, diferencia
 * cambiaria si aplica).
 */
async function aplicarPagoOC(
  item: DistribucionItem,
  oc: OrdenCompra,
  input: PagoAbonoDistribuidoInput,
  movimientoTesoreriaId: string,
  idempotencyKey: string,
  userId: string,
  movimientosCCIds: string[],
): Promise<void> {
  // Determinar entidad CC (puede ser colaborador si OC tiene deudor alternativo)
  const esDeudorAlternativo =
    oc.deudorTipo === 'colaborador' && !!oc.deudorId;
  const entidadCC = esDeudorAlternativo
    ? {
        entidadId: oc.deudorId!,
        tipo: 'colaborador' as const,
        entidadNombre: oc.deudorNombre || 'Colaborador',
      }
    : {
        entidadId: oc.proveedorId,
        tipo: 'proveedor' as const,
        entidadNombre: oc.nombreProveedor,
      };

  // Registrar MovimientoCC (crédito = baja de la deuda)
  const ccResult = await cuentaCorrienteService.registrarMovimiento(
    {
      entidadId: entidadCC.entidadId,
      tipo: entidadCC.tipo,
      entidadNombre: entidadCC.entidadNombre,
      tipoMovimiento: 'credito_pago_oc',
      descripcion:
        `Pago distribuido OC ${oc.numeroOrden} · ` +
        `${input.monedaAbono} ${item.montoAplicado.toFixed(2)} ` +
        `(parte de pago total ${input.monedaAbono} ${input.montoAbono.toFixed(2)})`,
      moneda: input.monedaAbono,
      monto: item.montoAplicado,
      fecha: input.fecha,
      refDocumentoTipo: 'oc',
      refDocumentoId: oc.id,
      refDocumentoNumero: oc.numeroOrden,
      movimientoTesoreriaId,
      notas: input.notas,
      idempotencyKey: `${idempotencyKey}:${item.documentoId}`,
    },
    userId,
  );
  movimientosCCIds.push(ccResult.movimientoId);

  // Recalcular y actualizar denormalización en la OC
  const pagosCC = await getPagosOC(oc.id);
  const totalPagadoUSD = pagosCC.reduce((s, p) => s + p.montoUSD, 0);
  const pendienteUSD = oc.totalUSD - totalPagadoUSD;

  const tieneSubOrdenes = !!(oc.subOrdenes && oc.subOrdenes.length > 0);

  const updates: Record<string, unknown> = {
    tcPago: input.tipoCambio,
    montoPendiente: Math.max(0, pendienteUSD * input.tipoCambio),
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId,
  };

  if (tieneSubOrdenes) {
    updates.subOrdenes = oc.subOrdenes!.map((sub) => {
      const pagosSub = pagosCC.filter(
        (p) =>
          p.subOrdenId === sub.id ||
          (p.notas && p.notas.includes(`subOrdenId=${sub.id}`)),
      );
      const totalPagadoSub = pagosSub.reduce((s, p) => s + p.montoUSD, 0);
      let estadoPagoSub: 'pendiente' | 'parcial' | 'pagado';
      if (totalPagadoSub >= sub.totalUSD - TOLERANCIA) estadoPagoSub = 'pagado';
      else if (totalPagadoSub > TOLERANCIA) estadoPagoSub = 'parcial';
      else estadoPagoSub = 'pendiente';
      return { ...sub, estadoPago: estadoPagoSub };
    });

    const subOrdenesArr = updates.subOrdenes as Array<{ estadoPago: string }>;
    const todasPagadas = subOrdenesArr.every((s) => s.estadoPago === 'pagado');
    const algunaConPago = subOrdenesArr.some(
      (s) => s.estadoPago === 'pagado' || s.estadoPago === 'parcial',
    );
    updates.estadoPago = todasPagadas
      ? 'pagado'
      : algunaConPago
        ? 'parcial'
        : 'pendiente';
  } else {
    updates.estadoPago =
      pendienteUSD <= TOLERANCIA
        ? 'pagado'
        : totalPagadoUSD > TOLERANCIA
          ? 'parcial'
          : 'pendiente';
  }

  if (updates.estadoPago === 'pagado') {
    updates.totalPEN = oc.totalUSD * input.tipoCambio;
    if (oc.tcCompra) {
      const costoEnCompra = oc.totalUSD * oc.tcCompra;
      const costoEnPago = oc.totalUSD * input.tipoCambio;
      updates.diferenciaCambiaria = costoEnPago - costoEnCompra;
    }
  }

  await updateDoc(doc(db, ORDENES_COLLECTION, oc.id), updates);
}

/**
 * Aplica un item de distribución a un Envío: crea MovCC en CC del
 * colaborador y actualiza denormalización (estadoPagoColaborador,
 * montoPagadoUSD, montoPendienteUSD).
 *
 * Convención: el flete se trata como USD aunque envio.monedaFlete sea otra
 * (consistente con envio.pagos.service.registrarPagoColaborador).
 */
async function aplicarPagoEnvio(
  item: DistribucionItem,
  envio: Envio,
  input: PagoAbonoDistribuidoInput,
  movimientoTesoreriaId: string,
  idempotencyKey: string,
  userId: string,
  movimientosCCIds: string[],
): Promise<void> {
  if (!envio.colaboradorId) {
    throw new Error(
      `Envío ${envio.numeroEnvio} sin colaboradorId — no se puede registrar pago en CC`,
    );
  }

  // Convertir el aporte a USD (el flete se trata como USD)
  const montoAplicadoUSD =
    input.monedaAbono === 'USD'
      ? item.montoAplicado
      : item.montoAplicado / input.tipoCambio;

  // MovCC en CC del colaborador (siempre en USD por convención)
  const ccResult = await cuentaCorrienteService.registrarMovimiento(
    {
      entidadId: envio.colaboradorId,
      tipo: 'colaborador',
      entidadNombre: envio.colaboradorNombre || 'Colaborador',
      tipoMovimiento: 'credito_pago_envio',
      descripcion:
        `Pago distribuido flete ${envio.numeroEnvio} · ` +
        `USD ${montoAplicadoUSD.toFixed(2)} ` +
        `(parte de pago total ${input.monedaAbono} ${input.montoAbono.toFixed(2)})`,
      moneda: 'USD',
      monto: montoAplicadoUSD,
      fecha: input.fecha,
      refDocumentoTipo: 'envio',
      refDocumentoId: envio.id,
      refDocumentoNumero: envio.numeroEnvio,
      movimientoTesoreriaId,
      notas: input.notas,
      idempotencyKey: `${idempotencyKey}:${item.documentoId}`,
    },
    userId,
  );
  movimientosCCIds.push(ccResult.movimientoId);

  // Recalcular pendiente y actualizar denormalización
  const pagosCC = await getPagosEnvio(envio.id);
  const totalPagadoUSD = pagosCC.reduce(
    (s, p) => s + (p.monedaPago === 'USD' ? p.montoOriginal : p.montoUSD),
    0,
  );
  const costoFlete = envio.costoFleteTotal || 0;
  const pendienteUSD = Math.max(0, costoFlete - totalPagadoUSD);
  const nuevoEstado: 'pendiente' | 'parcial' | 'pagado' =
    pendienteUSD <= TOLERANCIA
      ? 'pagado'
      : totalPagadoUSD > TOLERANCIA
        ? 'parcial'
        : 'pendiente';

  await updateDoc(doc(db, ENVIOS_COLLECTION, envio.id), {
    estadoPagoColaborador: nuevoEstado,
    montoPagadoUSD: totalPagadoUSD,
    montoPendienteUSD: pendienteUSD,
    fechaActualizacion: Timestamp.now(),
    actualizadoPor: userId,
  });
}

/**
 * Aplica un item de distribución a un Gasto: crea MovCC en CC del proveedor,
 * agrega entry a `gasto.pagos[]` legacy y actualiza denormalización
 * (estado, montoPagado, montoPendiente).
 *
 * El gasto DEBE tener proveedorId estructurado (ya validado en ejecutar()).
 */
async function aplicarPagoGasto(
  item: DistribucionItem,
  gasto: Gasto,
  input: PagoAbonoDistribuidoInput,
  movimientoTesoreriaId: string,
  idempotencyKey: string,
  userId: string,
  movimientosCCIds: string[],
): Promise<void> {
  if (!gasto.proveedorId || !gasto.proveedorTipo) {
    throw new Error(
      `Gasto ${gasto.numeroGasto} sin proveedorId — no se puede registrar en CC`,
    );
  }

  // 1. MovCC en CC del proveedor (en la moneda del abono)
  const ccResult = await cuentaCorrienteService.registrarMovimiento(
    {
      entidadId: gasto.proveedorId,
      tipo: gasto.proveedorTipo,
      entidadNombre:
        gasto.proveedorNombre || gasto.proveedor || 'Proveedor',
      tipoMovimiento: 'credito_pago_gasto',
      descripcion:
        `Pago distribuido gasto ${gasto.numeroGasto} · ` +
        `${input.monedaAbono} ${item.montoAplicado.toFixed(2)} ` +
        `(parte de pago total ${input.monedaAbono} ${input.montoAbono.toFixed(2)})`,
      moneda: input.monedaAbono,
      monto: item.montoAplicado,
      fecha: input.fecha,
      refDocumentoTipo: 'gasto',
      refDocumentoId: gasto.id,
      refDocumentoNumero: gasto.numeroGasto,
      movimientoTesoreriaId,
      notas: input.notas,
      idempotencyKey: `${idempotencyKey}:${item.documentoId}`,
    },
    userId,
  );
  movimientosCCIds.push(ccResult.movimientoId);

  // 2. Calcular equivalencias para el PagoGasto legacy entry
  const montoUSD =
    input.monedaAbono === 'USD'
      ? item.montoAplicado
      : item.montoAplicado / input.tipoCambio;
  const montoPENPago =
    input.monedaAbono === 'PEN'
      ? item.montoAplicado
      : item.montoAplicado * input.tipoCambio;

  // 3. Agregar entry a gasto.pagos[] (legacy + denormalizado)
  const pagoId = `PAG-GAS-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const nuevoPago: PagoGasto = {
    id: pagoId,
    fecha: Timestamp.fromDate(input.fecha),
    monedaPago: input.monedaAbono,
    montoOriginal: item.montoAplicado,
    montoUSD,
    montoPEN: montoPENPago,
    tipoCambio: input.tipoCambio,
    metodoPago: input.metodo,
    movimientoTesoreriaId,
    registradoPor: userId,
    fechaRegistro: Timestamp.now(),
  };
  if (input.cuentaId) nuevoPago.cuentaOrigenId = input.cuentaId;
  if (input.cuentaNombre) nuevoPago.cuentaOrigenNombre = input.cuentaNombre;
  if (input.referencia) nuevoPago.referencia = input.referencia;
  if (input.notas) nuevoPago.notas = input.notas;

  // 4. Recalcular pendiente y estado
  const pagosLegacy: PagoGasto[] = gasto.pagos || [];
  const nuevosPagos = [...pagosLegacy, nuevoPago];
  const nuevoMontoPagadoPEN = nuevosPagos.reduce(
    (s, p) => s + (p.montoPEN ?? 0),
    0,
  );
  const nuevoMontoPendiente = Math.max(0, gasto.montoPEN - nuevoMontoPagadoPEN);
  const nuevoEstado: 'pendiente' | 'parcial' | 'pagado' =
    nuevoMontoPendiente <= TOLERANCIA
      ? 'pagado'
      : nuevoMontoPagadoPEN > TOLERANCIA
        ? 'parcial'
        : 'pendiente';

  const updates: Record<string, unknown> = {
    estado: nuevoEstado,
    pagos: nuevosPagos,
    montoPagado: nuevoMontoPagadoPEN,
    montoPendiente: nuevoMontoPendiente,
    ultimaEdicion: Timestamp.now(),
    editadoPor: userId,
  };
  if (nuevoEstado === 'pagado') {
    updates.fechaPago = Timestamp.fromDate(input.fecha);
    updates.metodoPago = input.metodo;
  }

  await updateDoc(doc(db, GASTOS_COLLECTION, gasto.id), updates);
}

/**
 * Aplica el sobrante (`saldoAFavor`) cuando el abono excede la suma de las
 * deudas distribuidas. Crea un MovCC sin `refDocumento` con el tipo correcto
 * según la dirección de la entidad:
 *
 *   - Cliente → `credito_anticipo` (resta del saldo del cliente, queda en
 *     negativo: el negocio le debe al cliente · saldo a favor del cliente)
 *   - Proveedor / Colaborador / Empleado → `debito_anticipo` (suma al saldo,
 *     queda en positivo: la entidad nos debe ese monto en futuras OCs/etc ·
 *     saldo a favor del negocio)
 *
 * Ambos tipos comparten el mismo `movimientoTesoreriaId` con el resto del
 * lote para preservar la trazabilidad del desembolso.
 */
async function aplicarSaldoAFavor(
  saldoAFavor: number,
  input: PagoAbonoDistribuidoInput,
  movimientoTesoreriaId: string,
  idempotencyKey: string,
  userId: string,
  movimientosCCIds: string[],
): Promise<void> {
  if (saldoAFavor <= TOLERANCIA) return;

  const tipoMov: 'debito_anticipo' | 'credito_anticipo' =
    input.entidadTipo === 'cliente' ? 'credito_anticipo' : 'debito_anticipo';

  const descripcion =
    input.entidadTipo === 'cliente'
      ? `Anticipo del cliente · ${input.monedaAbono} ${saldoAFavor.toFixed(2)} ` +
        `(sobrante de cobro ${input.monedaAbono} ${input.montoAbono.toFixed(2)})`
      : `Anticipo a aplicar · ${input.monedaAbono} ${saldoAFavor.toFixed(2)} ` +
        `(sobrante de pago ${input.monedaAbono} ${input.montoAbono.toFixed(2)})`;

  const ccResult = await cuentaCorrienteService.registrarMovimiento(
    {
      entidadId: input.entidadId,
      tipo: input.entidadTipo,
      entidadNombre: input.entidadNombre,
      tipoMovimiento: tipoMov,
      descripcion,
      moneda: input.monedaAbono,
      monto: saldoAFavor,
      fecha: input.fecha,
      // Sin refDocumento — es un saldo flotante a aplicar a futuro
      movimientoTesoreriaId,
      notas: input.notas,
      idempotencyKey: `${idempotencyKey}:saldo_a_favor`,
    },
    userId,
  );
  movimientosCCIds.push(ccResult.movimientoId);
}

// ═════════════════════════════════════════════════════════════════════════
// API PÚBLICA: EJECUTAR PAGO DISTRIBUIDO
// ═════════════════════════════════════════════════════════════════════════

/**
 * Ejecuta un pago con abono distribuido a N documentos.
 *
 * FLUJO:
 *   1. Validar input completo (montos, distribución, idempotencia)
 *   2. Crear 1 movimiento de tesorería (egreso o ingreso unificado)
 *   3. Por cada item de distribución:
 *      a. Crear MovimientoCC (crédito en CC del proveedor / débito en CC del cliente)
 *      b. Actualizar denormalización del documento (estadoPago, montoPendiente)
 *   4. Retornar resultado con IDs y resumen
 *
 * SI la tesorería falla → no se ejecuta nada (early throw).
 * SI un CC/documento falla → se acumula en errores[] y los demás siguen.
 */
export async function ejecutar(
  input: PagoAbonoDistribuidoInput,
  userId: string,
): Promise<PagoAbonoDistribuidoResult> {
  // ─── 1. Validaciones ────────────────────────────────────────────────
  if (!input.entidadId) throw new Error('entidadId es requerido');
  if (!input.entidadNombre) throw new Error('entidadNombre es requerido');
  if (input.montoAbono <= 0) throw new Error('montoAbono debe ser > 0');
  if (input.tipoCambio <= 0) throw new Error('tipoCambio debe ser > 0');
  if (!input.cuentaId) throw new Error('cuentaId es requerido');
  if (!input.distribucion || input.distribucion.length === 0) {
    throw new Error('Debe haber al menos 1 documento en la distribución');
  }

  // Σ(montoAplicado) <= montoAbono · S58b F6 permite saldo a favor
  // (la diferencia se aplica como anticipo en CC de la entidad).
  const sumaDistribuido = input.distribucion.reduce(
    (s, d) => s + d.montoAplicado,
    0,
  );
  const diferencia = input.montoAbono - sumaDistribuido;
  if (diferencia < -TOLERANCIA) {
    // Sobre-distribución: la suma de la distribución excede el monto del abono
    throw new Error(
      `La distribución (${sumaDistribuido.toFixed(2)}) excede el monto del abono ` +
        `(${input.montoAbono.toFixed(2)}). Sobrante: ${Math.abs(diferencia).toFixed(2)}.`,
    );
  }
  // Si diferencia > 0 → saldoAFavor; se aplicará como MovCC sin documento.
  const saldoAFavorCalc = diferencia > TOLERANCIA ? diferencia : 0;

  // Cada montoAplicado > 0
  for (const d of input.distribucion) {
    if (d.montoAplicado <= 0) {
      throw new Error(
        `Item ${d.documentoNumero}: montoAplicado debe ser > 0 (recibido: ${d.montoAplicado})`,
      );
    }
  }

  // Tipos soportados en S58b F5: 'oc', 'envio', 'gasto'
  for (const d of input.distribucion) {
    if (d.tipo !== 'oc' && d.tipo !== 'envio' && d.tipo !== 'gasto') {
      throw new Error(
        `Tipo de documento '${d.tipo}' aún no soportado. Versión actual soporta 'oc', 'envio' y 'gasto'.`,
      );
    }
  }

  // Validar que cada documento existe y su pendiente >= montoAplicado
  const ocsResolvedas: Map<string, OrdenCompra> = new Map();
  const enviosResolvidos: Map<string, Envio> = new Map();
  const gastosResolvidos: Map<string, Gasto> = new Map();
  for (const item of input.distribucion) {
    // Convertir montoAplicado a USD si abono está en PEN
    const montoAplicadoUSD =
      input.monedaAbono === 'USD'
        ? item.montoAplicado
        : item.montoAplicado / input.tipoCambio;

    if (item.tipo === 'oc') {
      const ocSnap = await getDoc(doc(db, ORDENES_COLLECTION, item.documentoId));
      if (!ocSnap.exists()) {
        throw new Error(`OC ${item.documentoNumero} (${item.documentoId}) no existe`);
      }
      const oc = { id: ocSnap.id, ...ocSnap.data() } as OrdenCompra;
      if (oc.estado === 'cancelada') {
        throw new Error(`OC ${oc.numeroOrden} está cancelada — no se puede pagar`);
      }
      const pendienteUSD = await calcularPendienteOCDesdeCC(oc);
      if (montoAplicadoUSD > pendienteUSD + TOLERANCIA) {
        throw new Error(
          `OC ${oc.numeroOrden}: monto a aplicar ($${montoAplicadoUSD.toFixed(2)}) ` +
            `excede el pendiente ($${pendienteUSD.toFixed(2)})`,
        );
      }
      ocsResolvedas.set(item.documentoId, oc);
    } else if (item.tipo === 'envio') {
      const envioSnap = await getDoc(doc(db, ENVIOS_COLLECTION, item.documentoId));
      if (!envioSnap.exists()) {
        throw new Error(
          `Envío ${item.documentoNumero} (${item.documentoId}) no existe`,
        );
      }
      const envio = { id: envioSnap.id, ...envioSnap.data() } as Envio;
      if (envio.estado === 'cancelada') {
        throw new Error(
          `Envío ${envio.numeroEnvio} está cancelado — no se puede pagar`,
        );
      }
      if (envio.estadoPagoColaborador === 'pagado') {
        throw new Error(
          `Envío ${envio.numeroEnvio} ya está pagado al colaborador`,
        );
      }
      const pendienteUSD = await calcularPendienteEnvioDesdeCC(envio);
      if (montoAplicadoUSD > pendienteUSD + TOLERANCIA) {
        throw new Error(
          `Envío ${envio.numeroEnvio}: monto a aplicar ($${montoAplicadoUSD.toFixed(2)}) ` +
            `excede el pendiente ($${pendienteUSD.toFixed(2)})`,
        );
      }
      enviosResolvidos.set(item.documentoId, envio);
    } else {
      // tipo === 'gasto'
      const gastoSnap = await getDoc(doc(db, GASTOS_COLLECTION, item.documentoId));
      if (!gastoSnap.exists()) {
        throw new Error(
          `Gasto ${item.documentoNumero} (${item.documentoId}) no existe`,
        );
      }
      const gasto = { id: gastoSnap.id, ...gastoSnap.data() } as Gasto;
      if (gasto.estado === 'cancelado') {
        throw new Error(
          `Gasto ${gasto.numeroGasto} está cancelado — no se puede pagar`,
        );
      }
      if (gasto.estado === 'pagado') {
        throw new Error(`Gasto ${gasto.numeroGasto} ya está pagado`);
      }
      if (!gasto.proveedorId) {
        throw new Error(
          `Gasto ${gasto.numeroGasto} no tiene proveedor estructurado · ` +
            `pagar individualmente desde el módulo Gastos`,
        );
      }
      const pendiente = await calcularPendienteGasto(gasto);
      // Comparar en la moneda nativa del gasto
      const montoAplicadoEnMonedaGasto =
        input.monedaAbono === gasto.moneda
          ? item.montoAplicado
          : input.monedaAbono === 'USD'
            ? item.montoAplicado * input.tipoCambio
            : item.montoAplicado / input.tipoCambio;
      if (montoAplicadoEnMonedaGasto > pendiente + TOLERANCIA) {
        const sym = gasto.moneda === 'USD' ? '$' : 'S/';
        throw new Error(
          `Gasto ${gasto.numeroGasto}: monto a aplicar (${sym}${montoAplicadoEnMonedaGasto.toFixed(2)}) ` +
            `excede el pendiente (${sym}${pendiente.toFixed(2)})`,
        );
      }
      gastosResolvidos.set(item.documentoId, gasto);
    }
  }

  // ─── 2. Idempotencia ────────────────────────────────────────────────
  const idempotencyKey = input.idempotencyKey ?? generarIdempotencyKey(input);

  // ─── 3. Crear 1 movimiento de tesorería ─────────────────────────────
  // Concept resume: "Pago distribuido a [Proveedor] · 5 OCs · USD 12,000"
  const conceptoTesoreria =
    `Pago distribuido a ${input.entidadNombre} · ` +
    `${input.distribucion.length} ${input.distribucion.length === 1 ? 'documento' : 'documentos'} · ` +
    `${input.monedaAbono} ${input.montoAbono.toFixed(2)}`;

  // Tipo de movimiento de tesorería · 1 solo desembolso para todo el lote.
  // Heurística por entidad + composición de la distribución:
  //   - cliente             → ingreso_venta (cobranza)
  //   - colaborador + envíos puros → pago_viajero (consistente con envio.pagos.service)
  //   - distribución solo gastos → gasto_operativo
  //   - resto (proveedor, mixta, etc.) → pago_orden_compra
  const distribUsaSoloEnvios = input.distribucion.every((d) => d.tipo === 'envio');
  const distribUsaSoloGastos = input.distribucion.every((d) => d.tipo === 'gasto');
  const tipoMov =
    input.entidadTipo === 'cliente'
      ? 'ingreso_venta'
      : input.entidadTipo === 'colaborador' && distribUsaSoloEnvios
        ? 'pago_viajero'
        : distribUsaSoloGastos
          ? 'gasto_operativo'
          : 'pago_orden_compra';

  const tesoreriaData: MovimientoTesoreriaFormData = {
    tipo: tipoMov,
    moneda: input.monedaAbono,
    monto: input.montoAbono,
    tipoCambio: input.tipoCambio,
    metodo: input.metodo,
    concepto: conceptoTesoreria,
    fecha: input.fecha,
  };
  if (input.referencia) tesoreriaData.referencia = input.referencia;
  if (input.notas) {
    tesoreriaData.notas = input.notas;
  } else {
    // Lista compacta de números de documento en notas para audit
    tesoreriaData.notas =
      `Distribución: ` +
      input.distribucion
        .map((d) => `${d.documentoNumero}=${d.montoAplicado.toFixed(2)}`)
        .join(', ');
  }
  // Para entidad=proveedor el dinero SALE de cuentaId
  // Para entidad=cliente el dinero ENTRA a cuentaId
  if (input.entidadTipo === 'cliente') {
    tesoreriaData.cuentaDestino = input.cuentaId;
  } else {
    tesoreriaData.cuentaOrigen = input.cuentaId;
  }

  let movimientoTesoreriaId: string;
  try {
    movimientoTesoreriaId = await tesoreriaService.registrarMovimiento(
      tesoreriaData,
      userId,
    );
  } catch (err) {
    logger.error(
      '[PagoAbonoDistribuido] Error creando movimiento tesorería — abortando',
      err,
    );
    throw new Error(
      `No se pudo registrar el movimiento de tesorería: ${
        err instanceof Error ? err.message : 'desconocido'
      }`,
    );
  }

  // ─── 4. Crear N movimientos CC (1 por documento) ────────────────────
  const movimientosCCIds: string[] = [];
  const errores: string[] = [];
  let documentosActualizados = 0;

  for (const item of input.distribucion) {
    try {
      if (item.tipo === 'oc') {
        await aplicarPagoOC(
          item,
          ocsResolvedas.get(item.documentoId)!,
          input,
          movimientoTesoreriaId,
          idempotencyKey,
          userId,
          movimientosCCIds,
        );
      } else if (item.tipo === 'envio') {
        await aplicarPagoEnvio(
          item,
          enviosResolvidos.get(item.documentoId)!,
          input,
          movimientoTesoreriaId,
          idempotencyKey,
          userId,
          movimientosCCIds,
        );
      } else {
        // tipo === 'gasto'
        await aplicarPagoGasto(
          item,
          gastosResolvidos.get(item.documentoId)!,
          input,
          movimientoTesoreriaId,
          idempotencyKey,
          userId,
          movimientosCCIds,
        );
      }
      documentosActualizados++;
    } catch (err) {
      const prefix =
        item.tipo === 'oc'
          ? 'OC'
          : item.tipo === 'envio'
            ? 'Envío'
            : 'Gasto';
      const msg = `${prefix} ${item.documentoNumero}: ${
        err instanceof Error ? err.message : 'error desconocido'
      }`;
      logger.error(`[PagoAbonoDistribuido] ${msg}`, err);
      errores.push(msg);
      // Continuar con los demás
    }
  }

  // ─── 4b. Saldo a favor (S58b F6) ────────────────────────────────────
  // Si Σ(distribución) < montoAbono, el sobrante se aplica como MovCC sin
  // refDocumento (anticipo). Es no-bloqueante: si falla, queda registrado
  // en errores[] pero el resto del flujo se mantiene.
  if (saldoAFavorCalc > TOLERANCIA) {
    try {
      await aplicarSaldoAFavor(
        saldoAFavorCalc,
        input,
        movimientoTesoreriaId,
        idempotencyKey,
        userId,
        movimientosCCIds,
      );
    } catch (err) {
      const msg = `Saldo a favor (${saldoAFavorCalc.toFixed(2)}): ${
        err instanceof Error ? err.message : 'error desconocido'
      }`;
      logger.error(`[PagoAbonoDistribuido] ${msg}`, err);
      errores.push(msg);
    }
  }

  // ─── 5. Resultado ───────────────────────────────────────────────────
  const saldoAFavor = saldoAFavorCalc;
  const result: PagoAbonoDistribuidoResult = {
    movimientoTesoreriaId,
    movimientosCCIds,
    documentosActualizados,
    saldoAFavor,
    idempotencyKey,
    errores,
  };

  if (errores.length === 0) {
    const sufijoSaldo =
      saldoAFavor > TOLERANCIA
        ? ` · saldo a favor ${input.monedaAbono} ${saldoAFavor.toFixed(2)}`
        : '';
    logger.success(
      `[PagoAbonoDistribuido] OK · ${input.monedaAbono} ${input.montoAbono.toFixed(2)} ` +
        `→ ${documentosActualizados} documentos${sufijoSaldo} · TX ${movimientoTesoreriaId}`,
    );
  } else {
    logger.warn(
      `[PagoAbonoDistribuido] PARCIAL · ${documentosActualizados}/${input.distribucion.length} ` +
        `documentos · ${errores.length} errores`,
    );
  }

  return result;
}

// ═════════════════════════════════════════════════════════════════════════
// FACADE
// ═════════════════════════════════════════════════════════════════════════

export const pagoAbonoDistribuidoService = {
  ejecutar,
  obtenerDeudasPorEntidad,
};
