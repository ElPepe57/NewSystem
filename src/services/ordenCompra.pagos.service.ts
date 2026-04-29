/**
 * ordenCompra.pagos.service.ts — S55 Fase 2 · Refactorizado para Cuenta Corriente
 *
 * Cambios respecto al modelo legacy:
 *  - YA NO escribe a `oc.historialPagos[]` (campo eliminado del tipo)
 *  - Cada pago se registra como `MovimientoCC` tipo='credito_pago_oc' en la
 *    CC del proveedor (vía `cuentaCorrienteService.registrarMovimiento`)
 *  - Sigue creando movimiento de tesorería (cash flow real)
 *  - Sigue actualizando `oc.estadoPago` y `oc.montoPendiente` DENORMALIZADOS
 *    para queries rápidos (Decisión D-CC-8)
 *  - Sub-órdenes mantienen `estadoPago` denormalizado (calculado desde CC)
 *
 * El payload retornado mantiene formato `PagoOCLegacy` para no romper consumers.
 */

import {
  doc,
  updateDoc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import type { MetodoTesoreria, MovimientoTesoreriaFormData } from '../types/tesoreria.types';
import { tesoreriaService } from './tesoreria.service';
import { ORDENES_COLLECTION } from './ordenCompra.shared';
import { getById } from './ordenCompra.crud.service';
import { cuentaCorrienteService } from './cuentaCorriente.service';
import {
  getPagosOC,
  type PagoOCLegacy,
} from './cuentaCorriente.adaptadores';

export async function registrarPago(
  id: string,
  datos: {
    fechaPago: Date;
    monedaPago: 'USD' | 'PEN';
    montoOriginal: number;
    tipoCambio: number;
    metodoPago: MetodoTesoreria;
    cuentaOrigenId?: string;
    referencia?: string;
    notas?: string;
    subOrdenId?: string;
  },
  userId: string,
): Promise<PagoOCLegacy> {
  const orden = await getById(id);
  if (!orden) throw new Error('Orden no encontrada');
  if (orden.estado === 'cancelada') {
    throw new Error('No se puede registrar pago en una orden cancelada');
  }
  if (!orden.proveedorId) {
    throw new Error('OC sin proveedorId — no se puede registrar pago en CC');
  }

  const {
    fechaPago,
    monedaPago,
    montoOriginal,
    tipoCambio,
    metodoPago,
    cuentaOrigenId,
    referencia,
    notas,
    subOrdenId,
  } = datos;

  if (!tipoCambio || tipoCambio <= 0) {
    throw new Error('El tipo de cambio es requerido y debe ser mayor a 0');
  }
  if (!montoOriginal || montoOriginal <= 0) {
    throw new Error('El monto es requerido y debe ser mayor a 0');
  }

  const montoUSD = monedaPago === 'USD' ? montoOriginal : montoOriginal / tipoCambio;
  const montoPEN = monedaPago === 'PEN' ? montoOriginal : montoOriginal * tipoCambio;

  let cuentaOrigenNombre: string | undefined;
  if (cuentaOrigenId) {
    try {
      const cuenta = await tesoreriaService.getCuentaById(cuentaOrigenId);
      if (cuenta) cuentaOrigenNombre = cuenta.nombre;
    } catch (e) {
      logger.warn('No se pudo obtener nombre de cuenta:', e);
    }
  }

  // ─── Determinar destinatario (deudor alternativo) ──────────────────────
  // S41 Bloque 5 — el concepto del movimiento refleja al destinatario real
  // del pago (colaborador si adelantó pago al proveedor, proveedor en otro caso).
  const esDeudorAlternativo =
    orden.deudorTipo === 'colaborador' && !!orden.deudorId;
  const destinatarioNombre = esDeudorAlternativo
    ? orden.deudorNombre || 'Colaborador'
    : orden.nombreProveedor;
  const conceptoSufijo = esDeudorAlternativo
    ? `${destinatarioNombre} (adelantó pago a ${orden.nombreProveedor})`
    : destinatarioNombre;

  // ─── 1. Registrar movimiento en libro mayor unificado (F4a · ADR-PF-001) ───
  let movimientoTesoreriaId: string | undefined;
  let errorTesoreria = false;
  let errorTesoreriaMsg: string | undefined;

  try {
    const { registrarMovimientoFinanciero } = await import(
      './movimientoFinanciero.service'
    );
    movimientoTesoreriaId = await registrarMovimientoFinanciero(
      {
        categoria: 'pago_orden_compra',
        moneda: monedaPago,
        monto: montoOriginal,
        tipoCambio,
        metodo: metodoPago,
        referencia,
        concepto: `Pago OC ${orden.numeroOrden} - ${conceptoSufijo}`,
        productoOrigenId: cuentaOrigenId,
        refDocumentoTipo: 'oc',
        refDocumentoId: id,
        refDocumentoNumero: orden.numeroOrden,
        notas:
          notas ||
          `${monedaPago === 'USD' ? `≈ S/ ${montoPEN.toFixed(2)}` : `≈ $${montoUSD.toFixed(2)} USD`}`,
        fecha: fechaPago,
      },
      userId,
    );
  } catch (tesoreriaError) {
    logger.error('Error registrando pago OC en libro mayor financiero:', tesoreriaError);
    errorTesoreria = true;
    errorTesoreriaMsg =
      tesoreriaError instanceof Error
        ? tesoreriaError.message
        : 'Error desconocido';
    // Continuamos: el movimiento CC se crea igual, marcado con error
  }

  // ─── 2. Registrar movimiento en CC del proveedor (libro contable) ──────
  // Para deudor alternativo (colaborador adelantó pago), el crédito va a
  // la CC del COLABORADOR (lo que adelantó), no del proveedor.
  const entidadCC = esDeudorAlternativo
    ? {
        entidadId: orden.deudorId!,
        tipo: 'colaborador' as const,
        entidadNombre: destinatarioNombre,
      }
    : {
        entidadId: orden.proveedorId,
        tipo: 'proveedor' as const,
        entidadNombre: orden.nombreProveedor,
      };

  // Construir descripción enriquecida que indique sub-orden si aplica
  const subOrdenSuffix = subOrdenId
    ? ` (sub-orden ${subOrdenId.slice(-6)})`
    : '';
  const descripcionMov =
    `Pago OC ${orden.numeroOrden}${subOrdenSuffix} · ${monedaPago} ${montoOriginal.toFixed(2)}`;

  const ccResult = await cuentaCorrienteService.registrarMovimiento(
    {
      entidadId: entidadCC.entidadId,
      tipo: entidadCC.tipo,
      entidadNombre: entidadCC.entidadNombre,
      tipoMovimiento: 'credito_pago_oc',
      descripcion: descripcionMov,
      moneda: monedaPago,
      monto: montoOriginal,
      fecha: fechaPago,
      refDocumentoTipo: 'oc',
      refDocumentoId: id,
      refDocumentoNumero: orden.numeroOrden,
      movimientoTesoreriaId,
      // Si es pago a sub-orden específica, lo guardamos en notas
      // (refSubDocumentoId aún no existe en el tipo; se agregará si se necesita)
      notas: subOrdenId ? `subOrdenId=${subOrdenId}${notas ? ' · ' + notas : ''}` : notas,
    },
    userId,
  );

  // ─── 3. Recalcular estado de pago denormalizado en OC ──────────────────
  // Lee TODOS los pagos de la OC desde CC (incluye el recién creado).
  const pagosCC = await getPagosOC(id);
  const totalPagadoUSD = pagosCC.reduce((s, p) => s + p.montoUSD, 0);
  const pendienteUSD = orden.totalUSD - totalPagadoUSD;

  const tieneSubOrdenes = !!(orden.subOrdenes && orden.subOrdenes.length > 0);

  const updates: Record<string, unknown> = {
    tcPago: tipoCambio,
    montoPendiente: Math.max(0, pendienteUSD * tipoCambio),
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId,
  };

  if (tieneSubOrdenes) {
    // BUG-002-PAG: cuando hay sub-órdenes, el estadoPago de la OC SE DERIVA ÚNICAMENTE
    // desde los estados de las sub-órdenes (consistencia entre niveles).
    updates.subOrdenes = orden.subOrdenes!.map((sub) => {
      // Pagos de esta sub-orden (filtrar por subOrdenId en notas — heurística
      // legacy hasta que se agregue refSubDocumentoId al tipo MovimientoCC)
      const pagosSub = pagosCC.filter(
        (p) => p.subOrdenId === sub.id || (p.notas && p.notas.includes(`subOrdenId=${sub.id}`)),
      );
      const totalPagadoSub = pagosSub.reduce((s, p) => s + p.montoUSD, 0);

      let estadoPagoSub: 'pendiente' | 'parcial' | 'pagado';
      if (totalPagadoSub >= sub.totalUSD - 0.01) estadoPagoSub = 'pagado';
      else if (totalPagadoSub > 0.01) estadoPagoSub = 'parcial';
      else estadoPagoSub = 'pendiente';

      return {
        ...sub,
        estadoPago: estadoPagoSub,
      };
    });

    const subOrdenesArr = updates.subOrdenes as Array<{ estadoPago: string }>;
    const todasPagadas = subOrdenesArr.every((s) => s.estadoPago === 'pagado');
    const algunaConPago = subOrdenesArr.some(
      (s) => s.estadoPago === 'pagado' || s.estadoPago === 'parcial',
    );
    updates.estadoPago = todasPagadas ? 'pagado' : algunaConPago ? 'parcial' : 'pendiente';
  } else {
    // Sin sub-órdenes: derivación clásica por total agregado
    updates.estadoPago =
      pendienteUSD <= 0.01 ? 'pagado' : totalPagadoUSD > 0.01 ? 'parcial' : 'pendiente';
  }

  // Si OC pasa a 'pagado', registrar diferencia cambiaria
  if (updates.estadoPago === 'pagado') {
    updates.totalPEN = orden.totalUSD * tipoCambio;
    if (orden.tcCompra) {
      const costoEnCompra = orden.totalUSD * orden.tcCompra;
      const costoEnPago = orden.totalUSD * tipoCambio;
      updates.diferenciaCambiaria = costoEnPago - costoEnCompra;
    }
  }

  // Limpieza de undefined antes de Firestore
  const removeUndefined = (obj: unknown): unknown => {
    if (Array.isArray(obj)) return obj.map(removeUndefined);
    if (
      obj &&
      typeof obj === 'object' &&
      !(obj as { toDate?: () => Date }).toDate &&
      !(obj instanceof Date)
    ) {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (v !== undefined) result[k] = removeUndefined(v);
      }
      return result;
    }
    return obj;
  };

  await updateDoc(
    doc(db, ORDENES_COLLECTION, id),
    removeUndefined(updates) as Record<string, unknown>,
  );

  if (errorTesoreria) {
    logger.warn(
      `Pago OC ${orden.numeroOrden} registrado en CC pero con error de tesorería: ${errorTesoreriaMsg}`,
    );
  } else {
    logger.success(
      `Pago OC registrado: ${monedaPago} ${montoOriginal.toFixed(2)} → ${orden.numeroOrden} (CC mov ${ccResult.movimientoId})`,
    );
  }

  // ─── 4. Retornar formato legacy para no romper consumers ───────────────
  const pagoLegacy: PagoOCLegacy = {
    id: ccResult.movimientoId,
    fecha: Timestamp.fromDate(fechaPago),
    monedaPago,
    montoOriginal,
    montoUSD,
    montoPEN,
    tipoCambio,
    metodoPago,
    cuentaOrigenId,
    cuentaOrigenNombre,
    referencia,
    notas,
    movimientoTesoreriaId,
    errorTesoreria,
    errorTesoreriaMsg,
    subOrdenId,
    registradoPor: userId,
    fechaRegistro: Timestamp.now(),
  };
  return pagoLegacy;
}
