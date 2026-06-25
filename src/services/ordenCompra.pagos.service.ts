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
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import type { MetodoTesoreria } from '../types/tesoreria.types';
import { tesoreriaService } from './tesoreria.service';
import { ORDENES_COLLECTION } from './ordenCompra.shared';
import { getById } from './ordenCompra.crud.service';
import { cuentaCorrienteService } from './cuentaCorriente.service';
import {
  getPagosOC,
  getReversasPagoOC,
  getTotalPagadoNetoOC_USD,
  type PagoOCLegacy,
} from './cuentaCorriente.adaptadores';
import type { OrdenCompra } from '../types/ordenCompra.types';
import { requiereAutorizacionSocio, type ResultadoAutorizacionCF } from './autorizacionEgreso.helper';
import { userService } from './user.service';
import { NotificationService } from './notification.service';

const functions = getFunctions();

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
    /** F4b · ADR-PF-001 · si el pago nace de un Pago Masivo, propagar lote */
    loteId?: string;
    loteNumero?: string;
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

  // F4 · GATE de autorización de socio: una OC cuyo TOTAL (totalUSD landed) supera el umbral no
  // egresa plata hasta que 2 socios la firmen (autorizacionEgreso.helper · fuente única). El pago
  // necesita firma propia aunque el requerimiento de origen ya esté aprobado. El throw acá lo hereda
  // el pago masivo automáticamente (ejecutarPagoIndividual llama a registrarPago directo).
  if (requiereAutorizacionSocio(orden.totalUSD || 0) && orden.autorizacion?.estado !== 'aprobado') {
    throw new Error('Esta OC supera el umbral · requiere la autorización de 2 socios antes de pagarse.');
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
    loteId,
    loteNumero,
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

  // ─── 1. F3 · el cash del pago lo escribe la Cloud Function registrarEgresoCash (valida la aprobación
  //         server-side · única escritora del cash de egreso). Si rechaza (no autorizado / excede /
  //         cancelado) LANZA → el pago NO se registra (atómico-con-autorización · ya no se sigue con la
  //         CC marcada con error, que dejaría plata comprometida sin aprobar). ───
  if (!cuentaOrigenId) throw new Error('Falta la cuenta de origen del pago.');
  const { registrarEgresoCashFn } = await import('./egresoCash.client');
  const cashResult = await registrarEgresoCashFn({
    refDocumentoTipo: 'oc',
    refDocumentoId: id,
    refDocumentoNumero: orden.numeroOrden,
    categoria: 'pago_orden_compra',
    productoOrigenId: cuentaOrigenId,
    moneda: monedaPago as 'USD' | 'PEN',
    monto: montoOriginal,
    tipoCambio,
    concepto: `Pago OC ${orden.numeroOrden} - ${conceptoSufijo}`,
    fecha: fechaPago,
    metodo: metodoPago,
    referencia,
    notas: notas || `${monedaPago === 'USD' ? `≈ S/ ${montoPEN.toFixed(2)}` : `≈ $${montoUSD.toFixed(2)} USD`}`,
  });
  const movimientoTesoreriaId: string | undefined = cashResult.movimientoId;
  const errorTesoreria = false;
  const errorTesoreriaMsg: string | undefined = undefined;

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
  // Helper compartido: lee TODOS los pagos/reversas de la OC desde CC (incluye el
  // recién creado) y deriva estadoPago/montoPendiente (+ sub-órdenes) por TOTAL NETO.
  // Pasamos `tipoCambio` como TC de contexto del evento de pago: preserva 1:1 el
  // comportamiento previo (tcPago, montoPendiente PEN, totalPEN/diferenciaCambiaria).
  await recalcularEstadoPagoOCDesdeCC(orden, userId, tipoCambio);

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

/**
 * Recalcula el estado de pago DENORMALIZADO de una OC (`estadoPago`,
 * `montoPendiente`, y `subOrdenes[].estadoPago`) leyendo la verdad desde la CC.
 *
 * Fuente única de la derivación: usa el TOTAL NETO pagado (credito_pago_oc menos
 * reversa_pago_oc), de modo que tanto registrar un pago como anularlo converjan
 * al mismo cálculo. Hace el `updateDoc` de la OC.
 *
 * **TC de contexto (`tcContexto`)** — distingue los dos llamadores:
 *  - `registrarPago` pasa el TC del pago → comportamiento 1:1 con el legacy:
 *    sella `tcPago`, denomina `montoPendiente` en PEN con ese TC, y si la OC
 *    queda 'pagado' sella `totalPEN` + `diferenciaCambiaria`.
 *  - La anulación de pago pasa `undefined` → NO inventa un evento cambiario:
 *    para la denominación PEN cae a `orden.tcPago ?? orden.tcCompra ?? 1` y NO
 *    toca `tcPago`/`totalPEN`/`diferenciaCambiaria` (son artefactos del pago).
 *
 * BACKWARD-COMPAT: sin reversas, `neto == suma(credito_pago_oc)` → idéntico al
 * bloque inline anterior. Con `tcContexto` provisto, los campos sellados son los
 * mismos que producía `registrarPago`.
 */
export async function recalcularEstadoPagoOCDesdeCC(
  orden: OrdenCompra,
  userId: string,
  tcContexto?: number,
): Promise<void> {
  const id = orden.id;

  // Pagos y reversas crudos (para netting por sub-orden vía heurística de notas).
  const [pagosCC, reversasCC, totalPagadoNetoUSD] = await Promise.all([
    getPagosOC(id),
    getReversasPagoOC(id),
    getTotalPagadoNetoOC_USD(id),
  ]);

  const pendienteUSD = orden.totalUSD - totalPagadoNetoUSD;

  // TC para denominar el pendiente en PEN. Con contexto (pago) usa ese TC; sin
  // contexto (reversa) cae al TC del último pago sellado, luego al de compra, luego 1.
  const tcDenominacion = tcContexto ?? orden.tcPago ?? orden.tcCompra ?? 1;

  const tieneSubOrdenes = !!(orden.subOrdenes && orden.subOrdenes.length > 0);

  const updates: Record<string, unknown> = {
    montoPendiente: Math.max(0, pendienteUSD * tcDenominacion),
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId,
  };

  // Solo el evento de pago sella el TC del pago (tcPago). La reversa no fabrica TC.
  if (tcContexto !== undefined) {
    updates.tcPago = tcContexto;
  }

  if (tieneSubOrdenes) {
    // BUG-002-PAG: cuando hay sub-órdenes, el estadoPago de la OC SE DERIVA ÚNICAMENTE
    // desde los estados de las sub-órdenes (consistencia entre niveles).
    updates.subOrdenes = orden.subOrdenes!.map((sub) => {
      // Pagos/reversas de esta sub-orden (filtrar por subOrdenId en notas — heurística
      // legacy hasta que se agregue refSubDocumentoId al tipo MovimientoCC)
      const matchSub = (p: PagoOCLegacy) =>
        p.subOrdenId === sub.id || (p.notas != null && p.notas.includes(`subOrdenId=${sub.id}`));
      const totalPagadoSub = pagosCC.filter(matchSub).reduce((s, p) => s + p.montoUSD, 0);
      const totalReversaSub = reversasCC.filter(matchSub).reduce((s, p) => s + p.montoUSD, 0);
      const netoSub = totalPagadoSub - totalReversaSub;

      let estadoPagoSub: 'pendiente' | 'parcial' | 'pagado';
      if (netoSub >= sub.totalUSD - 0.01) estadoPagoSub = 'pagado';
      else if (netoSub > 0.01) estadoPagoSub = 'parcial';
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
    // Sin sub-órdenes: derivación clásica por total neto agregado
    updates.estadoPago =
      pendienteUSD <= 0.01 ? 'pagado' : totalPagadoNetoUSD > 0.01 ? 'parcial' : 'pendiente';
  }

  // Si OC pasa a 'pagado' POR UN EVENTO DE PAGO, sellar diferencia cambiaria.
  // En la reversa no se sella (no hay TC de evento) — además una reversa rara vez
  // deja la OC en 'pagado'.
  if (updates.estadoPago === 'pagado' && tcContexto !== undefined) {
    updates.totalPEN = orden.totalUSD * tcContexto;
    if (orden.tcCompra) {
      const costoEnCompra = orden.totalUSD * orden.tcCompra;
      const costoEnPago = orden.totalUSD * tcContexto;
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
}

/**
 * F4 · Autorizar una OC para pago (firma de socio). Una OC cuyo total (totalUSD landed) supera el
 * umbral requiere 2 socios distintos (doble firma) antes de poder pagarse. Usa autorizacionEgreso.helper
 * como fuente única. Segregación: el creador de la OC no firma lo suyo.
 * @param userRoles roles del usuario (debe incluir 'socio').
 */
export async function autorizarOC(
  ocId: string,
  userId: string,
  userRoles: string[],
): Promise<ResultadoAutorizacionCF> {
  // F2 · la firma de socio (quórum por equity) la enforza la Cloud Function `autorizarEgreso`
  // (admin SDK · ÚNICA escritora del campo · ver functions/src/egresos/autorizarEgreso.ts).
  void userRoles;
  const fn = httpsCallable<{ coleccion: string; docId: string }, ResultadoAutorizacionCF>(functions, 'autorizarEgreso');
  const { data } = await fn({ coleccion: ORDENES_COLLECTION, docId: ocId });

  // Notificar a los OTROS socios si aún falta para la mayoría (preserva comportamiento).
  if (!data.completa) {
    try {
      const orden = await getById(ocId);
      const montoUSD = orden?.totalUSD || 0;
      const socios = await userService.getByRole('socio' as any);
      const otros = socios.filter((u) => u.activo && u.uid !== userId && u.uid !== orden?.creadoPor);
      for (const socio of otros) {
        await NotificationService.crear({
          tipo: 'aprobacion_pendiente',
          prioridad: 'alta',
          titulo: `Firma de socio pendiente — ${orden?.numeroOrden || ocId}`,
          mensaje: `Otro socio ya firmó. Falta alcanzar la mayoría de socios para autorizar el pago de esta OC de $${montoUSD.toFixed(0)} USD.`,
          usuarioId: socio.uid,
          entidadTipo: 'usuario',
          entidadId: ocId,
          creadoPor: 'sistema',
          metadata: { montoUSD },
        });
      }
    } catch (notifError) {
      logger.warn('Error notificando socios (autorizarOC):', notifError);
    }
  }

  return data;
}

/**
 * F4 · Rechazar la autorización de pago de una OC (decisión de socio). La OC queda no-pagable
 * (el gate exige estado 'aprobado') y sale de la bandeja de pendientes.
 */
export async function rechazarOC(ocId: string, userId: string, userRoles: string[], motivo?: string): Promise<void> {
  // F2 · el rechazo lo enforza la Cloud Function `rechazarEgreso` (admin SDK · única escritora).
  void userId; void userRoles;
  const fn = httpsCallable<{ coleccion: string; docId: string; motivo?: string }, { ok: true }>(functions, 'rechazarEgreso');
  await fn({ coleccion: ORDENES_COLLECTION, docId: ocId, motivo });
}
