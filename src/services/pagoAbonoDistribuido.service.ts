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
import type {
  PagoAbonoDistribuidoInput,
  PagoAbonoDistribuidoResult,
  DeudaDistribuible,
  DeudasFiltro,
  DistribucionItem,
} from '../types/pagoAbonoDistribuido.types';
import type { MovimientoTesoreriaFormData } from '../types/tesoreria.types';
import type { OrdenCompra } from '../types/ordenCompra.types';
import { tesoreriaService } from './tesoreria.service';
import { cuentaCorrienteService } from './cuentaCorriente.service';
import { ORDENES_COLLECTION } from './ordenCompra.shared';
import { getPagosOC } from './cuentaCorriente.adaptadores';
import { normalizarEstadoPagoOC } from '../types/ordenCompra.types';

// ═════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═════════════════════════════════════════════════════════════════════════

/** Tolerancia para comparaciones de monto (centavos). */
const TOLERANCIA = 0.01;

/** Días de vencimiento heurístico para OCs (a futuro: condición de pago). */
const DIAS_VENCIMIENTO_DEFAULT_OC = 30;

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

// ═════════════════════════════════════════════════════════════════════════
// API PÚBLICA: OBTENER DEUDAS
// ═════════════════════════════════════════════════════════════════════════

/**
 * Obtiene el listado de deudas distribuibles para una entidad.
 *
 * Versión inicial: solo soporta tipo='oc' (proveedor).
 * Filtra por `estadoPago in ['pendiente','parcial']` y excluye `cancelada`.
 *
 * NOTA: la deuda se considera del PROVEEDOR salvo que la OC tenga
 * `deudorTipo='colaborador'`, en cuyo caso la deuda real es con el
 * colaborador (no entra en este listado cuando entidadTipo='proveedor').
 */
export async function obtenerDeudasPorEntidad(
  filtro: DeudasFiltro,
): Promise<DeudaDistribuible[]> {
  const tipos = filtro.tipos ?? ['oc'];
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

  // Σ(montoAplicado) === montoAbono
  const sumaDistribuido = input.distribucion.reduce(
    (s, d) => s + d.montoAplicado,
    0,
  );
  const diferencia = input.montoAbono - sumaDistribuido;
  if (Math.abs(diferencia) > TOLERANCIA) {
    throw new Error(
      `La distribución (${sumaDistribuido.toFixed(2)}) no coincide con el ` +
        `monto del abono (${input.montoAbono.toFixed(2)}). Diferencia: ${diferencia.toFixed(
          2,
        )}.`,
    );
  }

  // Cada montoAplicado > 0
  for (const d of input.distribucion) {
    if (d.montoAplicado <= 0) {
      throw new Error(
        `Item ${d.documentoNumero}: montoAplicado debe ser > 0 (recibido: ${d.montoAplicado})`,
      );
    }
  }

  // Para versión inicial: solo OCs
  for (const d of input.distribucion) {
    if (d.tipo !== 'oc') {
      throw new Error(
        `Tipo de documento '${d.tipo}' aún no soportado. Versión inicial solo soporta 'oc'.`,
      );
    }
  }

  // Validar que cada OC existe y su pendiente >= montoAplicado
  const ocsResolvedas: Map<string, OrdenCompra> = new Map();
  for (const item of input.distribucion) {
    const ocSnap = await getDoc(doc(db, ORDENES_COLLECTION, item.documentoId));
    if (!ocSnap.exists()) {
      throw new Error(`OC ${item.documentoNumero} (${item.documentoId}) no existe`);
    }
    const oc = { id: ocSnap.id, ...ocSnap.data() } as OrdenCompra;
    if (oc.estado === 'cancelada') {
      throw new Error(`OC ${oc.numeroOrden} está cancelada — no se puede pagar`);
    }
    const pendienteUSD = await calcularPendienteOCDesdeCC(oc);
    // Convertir montoAplicado a USD si abono está en PEN (las OCs son en USD)
    const montoAplicadoUSD =
      input.monedaAbono === 'USD'
        ? item.montoAplicado
        : item.montoAplicado / input.tipoCambio;
    if (montoAplicadoUSD > pendienteUSD + TOLERANCIA) {
      throw new Error(
        `OC ${oc.numeroOrden}: monto a aplicar ($${montoAplicadoUSD.toFixed(2)}) ` +
          `excede el pendiente ($${pendienteUSD.toFixed(2)})`,
      );
    }
    ocsResolvedas.set(item.documentoId, oc);
  }

  // ─── 2. Idempotencia ────────────────────────────────────────────────
  const idempotencyKey = input.idempotencyKey ?? generarIdempotencyKey(input);

  // ─── 3. Crear 1 movimiento de tesorería ─────────────────────────────
  // Concept resume: "Pago distribuido a [Proveedor] · 5 OCs · USD 12,000"
  const conceptoTesoreria =
    `Pago distribuido a ${input.entidadNombre} · ` +
    `${input.distribucion.length} ${input.distribucion.length === 1 ? 'documento' : 'documentos'} · ` +
    `${input.monedaAbono} ${input.montoAbono.toFixed(2)}`;

  // Tipo de movimiento: por ahora solo proveedores → pago_orden_compra
  // Cuando entidadTipo='cliente' (cobranza distribuida) será ingreso_venta.
  const tipoMov =
    input.entidadTipo === 'cliente' ? 'ingreso_venta' : 'pago_orden_compra';

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
    const oc = ocsResolvedas.get(item.documentoId)!;

    try {
      // 4a. Determinar entidad CC (puede ser colaborador si OC tiene deudor alternativo)
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

      // 4b. Registrar MovimientoCC (crédito = baja de la deuda)
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

      // 4c. Recalcular y actualizar denormalización en la OC
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
        // Recalcular estado por sub-orden (consistencia con registrarPago)
        updates.subOrdenes = oc.subOrdenes!.map((sub) => {
          const pagosSub = pagosCC.filter(
            (p) =>
              p.subOrdenId === sub.id ||
              (p.notas && p.notas.includes(`subOrdenId=${sub.id}`)),
          );
          const totalPagadoSub = pagosSub.reduce((s, p) => s + p.montoUSD, 0);
          let estadoPagoSub: 'pendiente' | 'parcial' | 'pagado';
          if (totalPagadoSub >= sub.totalUSD - TOLERANCIA)
            estadoPagoSub = 'pagado';
          else if (totalPagadoSub > TOLERANCIA) estadoPagoSub = 'parcial';
          else estadoPagoSub = 'pendiente';
          return { ...sub, estadoPago: estadoPagoSub };
        });

        const subOrdenesArr = updates.subOrdenes as Array<{
          estadoPago: string;
        }>;
        const todasPagadas = subOrdenesArr.every(
          (s) => s.estadoPago === 'pagado',
        );
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

      // Si pasa a pagado, registrar diferencia cambiaria
      if (updates.estadoPago === 'pagado') {
        updates.totalPEN = oc.totalUSD * input.tipoCambio;
        if (oc.tcCompra) {
          const costoEnCompra = oc.totalUSD * oc.tcCompra;
          const costoEnPago = oc.totalUSD * input.tipoCambio;
          updates.diferenciaCambiaria = costoEnPago - costoEnCompra;
        }
      }

      await updateDoc(doc(db, ORDENES_COLLECTION, oc.id), updates);
      documentosActualizados++;
    } catch (err) {
      const msg = `OC ${item.documentoNumero}: ${
        err instanceof Error ? err.message : 'error desconocido'
      }`;
      logger.error(`[PagoAbonoDistribuido] ${msg}`, err);
      errores.push(msg);
      // Continuar con los demás
    }
  }

  // ─── 5. Resultado ───────────────────────────────────────────────────
  const saldoAFavor = 0; // En esta versión la validación previene saldoAFavor
  const result: PagoAbonoDistribuidoResult = {
    movimientoTesoreriaId,
    movimientosCCIds,
    documentosActualizados,
    saldoAFavor,
    idempotencyKey,
    errores,
  };

  if (errores.length === 0) {
    logger.success(
      `[PagoAbonoDistribuido] OK · ${input.monedaAbono} ${input.montoAbono.toFixed(2)} ` +
        `→ ${documentosActualizados} documentos · TX ${movimientoTesoreriaId}`,
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
