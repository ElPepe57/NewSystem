/**
 * cargoTarjeta.service.ts — S58d v2 · TX-1
 *
 * Carga una compra/gasto a una tarjeta de crédito. La operación es atómica
 * en intención (best-effort después de la creación del cargo en BD):
 *
 *   1. Crear documento CargoTarjeta
 *   2. Generar débito en CC de la tarjeta (saldo TC sube)
 *   3. Por cada documento cancelado:
 *      a. Generar crédito en su CC (proveedor/colaborador) tipo
 *         'credito_aplicacion_cargo_tc' — saldo del doc baja
 *      b. Actualizar denormalización del documento
 *
 * NO toca tesorería (la tarjeta es un pasivo, no movimiento de caja).
 * El movimiento real de tesorería ocurre cuando se paga el estado de cuenta
 * (TX-2 vía pagoEstadoCuentaTarjeta.service).
 *
 * IDEMPOTENCIA: si se reintenta con la misma `idempotencyKey`, los MovsCC
 * con esa key no se duplican (CC service la valida internamente).
 *
 * Decisiones aplicadas:
 *   - D-S58-9: No mezclar monedas en un solo cargo (validación)
 *   - D-S58-10: Sí soportar pagos parciales de cargos (estado/montoPagado)
 *   - D-S58-11: Cargos sin OC vinculan a Gasto Fijo (caller construye Gasto antes)
 */

import {
  collection,
  doc,
  getDoc,
  Timestamp,
  serverTimestamp,
  updateDoc,
  addDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import type {
  CargoTarjeta,
  CargoTarjetaInput,
  CargoTarjetaResult,
  TarjetaCredito,
  DocumentoCanceladoCargoTC,
} from '../types/tarjetaCredito.types';
import type { OrdenCompra } from '../types/ordenCompra.types';
import type { Envio } from '../types/envio.types';
import type { Gasto } from '../types/gasto.types';
import { cuentaCorrienteService } from './cuentaCorriente.service';
import { ORDENES_COLLECTION } from './ordenCompra.shared';
import {
  getPagosOC,
  getPagosEnvio,
} from './cuentaCorriente.adaptadores';
import { normalizarEstadoPagoOC } from '../types/ordenCompra.types';

// ═════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═════════════════════════════════════════════════════════════════════════

const CARGOS_COLL = COLLECTIONS.CARGOS_TARJETA;
const TARJETAS_COLL = COLLECTIONS.TARJETAS_CREDITO;
const TOLERANCIA = 0.01;

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

async function generarNumeroCargo(): Promise<string> {
  const year = new Date().getFullYear();
  return getNextSequenceNumber(`CARG-${year}`, 4);
}

function generarIdempotencyKey(input: CargoTarjetaInput): string {
  const docs = input.documentosCancelados
    .map((d) => `${d.tipo}:${d.documentoId}:${d.montoAplicado.toFixed(2)}`)
    .sort()
    .join('|');
  const fechaIso = input.fecha.toISOString().split('T')[0];
  return `cargo:${input.tarjetaCreditoId}:${fechaIso}:${input.moneda}:${input.monto.toFixed(2)}:${docs}`;
}

// ═════════════════════════════════════════════════════════════════════════
// API PÚBLICA
// ═════════════════════════════════════════════════════════════════════════

/**
 * Ejecuta TX-1 · Cargar una compra/gasto a tarjeta de crédito.
 */
export async function ejecutar(
  input: CargoTarjetaInput,
  userId: string,
): Promise<CargoTarjetaResult> {
  // ─── 1. Validaciones ────────────────────────────────────────────────
  if (!input.tarjetaCreditoId) throw new Error('tarjetaCreditoId es requerido');
  if (input.monto <= 0) throw new Error('monto debe ser > 0');
  if (!input.documentosCancelados || input.documentosCancelados.length === 0) {
    throw new Error('Debe haber al menos 1 documento cancelado');
  }

  // Σ(montoAplicado) === monto del cargo
  const sumaAplicado = input.documentosCancelados.reduce(
    (s, d) => s + d.montoAplicado,
    0,
  );
  if (Math.abs(sumaAplicado - input.monto) > TOLERANCIA) {
    throw new Error(
      `Suma documentos cancelados (${sumaAplicado.toFixed(2)}) ≠ monto del cargo (${input.monto.toFixed(2)})`,
    );
  }

  // No mezclar monedas (D-S58-9): todos los docs en la misma moneda que el cargo
  for (const d of input.documentosCancelados) {
    if (d.monedaDocumento !== input.moneda) {
      throw new Error(
        `Doc ${d.documentoNumero}: moneda (${d.monedaDocumento}) ≠ moneda del cargo (${input.moneda})`,
      );
    }
  }

  // Validar cada documento existe y tiene pendiente suficiente
  const ocsResolvedas = new Map<string, OrdenCompra>();
  const enviosResolvidos = new Map<string, Envio>();
  const gastosResolvidos = new Map<string, Gasto>();
  for (const item of input.documentosCancelados) {
    if (item.tipo === 'oc') {
      const ocSnap = await getDoc(doc(db, ORDENES_COLLECTION, item.documentoId));
      if (!ocSnap.exists())
        throw new Error(`OC ${item.documentoNumero} no existe`);
      const oc = { id: ocSnap.id, ...ocSnap.data() } as OrdenCompra;
      if (oc.estado === 'cancelada')
        throw new Error(`OC ${oc.numeroOrden} está cancelada`);
      const pagosCC = await getPagosOC(oc.id);
      const totalPagadoUSD = pagosCC.reduce((s, p) => s + p.montoUSD, 0);
      const pendienteUSD = oc.totalUSD - totalPagadoUSD;
      // Convertir si moneda del cargo no es USD (OCs siempre USD)
      const montoAplicadoUSD = item.montoAplicado;
      if (montoAplicadoUSD > pendienteUSD + TOLERANCIA) {
        throw new Error(
          `OC ${oc.numeroOrden}: monto a aplicar (${montoAplicadoUSD.toFixed(2)}) excede pendiente (${pendienteUSD.toFixed(2)})`,
        );
      }
      ocsResolvedas.set(item.documentoId, oc);
    } else if (item.tipo === 'envio') {
      const envSnap = await getDoc(doc(db, COLLECTIONS.ENVIOS, item.documentoId));
      if (!envSnap.exists())
        throw new Error(`Envío ${item.documentoNumero} no existe`);
      const env = { id: envSnap.id, ...envSnap.data() } as Envio;
      if (env.estado === 'cancelada')
        throw new Error(`Envío ${env.numeroEnvio} está cancelado`);
      if (env.estadoPagoColaborador === 'pagado')
        throw new Error(`Envío ${env.numeroEnvio} ya está pagado`);
      const pagosEnv = await getPagosEnvio(env.id);
      const totalPagadoUSD = pagosEnv.reduce(
        (s, p) => s + (p.monedaPago === 'USD' ? p.montoOriginal : p.montoUSD),
        0,
      );
      const pendienteUSD = (env.costoFleteTotal || 0) - totalPagadoUSD;
      if (item.montoAplicado > pendienteUSD + TOLERANCIA) {
        throw new Error(
          `Envío ${env.numeroEnvio}: monto a aplicar excede pendiente`,
        );
      }
      enviosResolvidos.set(item.documentoId, env);
    } else {
      // gasto
      const gastoSnap = await getDoc(doc(db, COLLECTIONS.GASTOS, item.documentoId));
      if (!gastoSnap.exists())
        throw new Error(`Gasto ${item.documentoNumero} no existe`);
      const gasto = { id: gastoSnap.id, ...gastoSnap.data() } as Gasto;
      if (gasto.estado === 'cancelado')
        throw new Error(`Gasto ${gasto.numeroGasto} está cancelado`);
      if (gasto.estado === 'pagado')
        throw new Error(`Gasto ${gasto.numeroGasto} ya está pagado`);
      if (!gasto.proveedorId) {
        throw new Error(
          `Gasto ${gasto.numeroGasto} sin proveedorId — no puede cargarse a TC vía CC`,
        );
      }
      gastosResolvidos.set(item.documentoId, gasto);
    }
  }

  // Validar tarjeta existe + obtener info
  const tarjetaSnap = await getDoc(doc(db, TARJETAS_COLL, input.tarjetaCreditoId));
  if (!tarjetaSnap.exists()) throw new Error('Tarjeta no encontrada');
  const tarjeta = { id: tarjetaSnap.id, ...tarjetaSnap.data() } as TarjetaCredito;
  if (!tarjeta.activa) throw new Error('Tarjeta inactiva');

  // ─── 2. Idempotencia ────────────────────────────────────────────────
  const idempotencyKey = input.idempotencyKey ?? generarIdempotencyKey(input);

  // ─── 3. Crear documento CargoTarjeta ────────────────────────────────
  const numeroCargo = await generarNumeroCargo();
  const cargoDoc: Record<string, unknown> = {
    numeroCargo,
    tarjetaCreditoId: tarjeta.id,
    tarjetaCreditoNombre: tarjeta.nombre,
    fecha: Timestamp.fromDate(input.fecha),
    descripcion: input.descripcion,
    moneda: input.moneda,
    monto: input.monto,
    documentosCancelados: input.documentosCancelados,
    estado: 'pendiente',
    montoPagado: 0,
    montoPendiente: input.monto,
    creadoPor: userId,
    fechaCreacion: Timestamp.now(),
  };
  if (input.tcDelDia !== undefined) cargoDoc.tcDelDia = input.tcDelDia;
  if (input.fuenteTcDelDia) cargoDoc.fuenteTcDelDia = input.fuenteTcDelDia;
  if (input.motivoOverrideTc) cargoDoc.motivoOverrideTc = input.motivoOverrideTc;

  const cargoRef = await addDoc(collection(db, CARGOS_COLL), cargoDoc);
  const cargoId = cargoRef.id;

  // ─── 4. MovimientoCC débito en CC de la tarjeta ─────────────────────
  let movimientoCCTarjetaId = '';
  try {
    const result = await cuentaCorrienteService.registrarMovimiento(
      {
        entidadId: tarjeta.id,
        tipo: 'tarjeta_credito',
        entidadNombre: tarjeta.nombre,
        tipoMovimiento: 'debito_cargo_tc',
        descripcion: `Cargo ${numeroCargo} · ${input.descripcion}`,
        moneda: input.moneda,
        monto: input.monto,
        fecha: input.fecha,
        refDocumentoTipo: 'cargo_tc',
        refDocumentoId: cargoId,
        refDocumentoNumero: numeroCargo,
        idempotencyKey,
      },
      userId,
    );
    movimientoCCTarjetaId = result.movimientoId;
    // Update cargo con FK
    await updateDoc(doc(db, CARGOS_COLL, cargoId), {
      movimientoCCTarjetaId,
    });
  } catch (err) {
    logger.error('[CargoTarjeta] Error creando MovCC en TC', err);
    throw new Error(
      `No se pudo crear el débito en CC de la tarjeta: ${err instanceof Error ? err.message : 'desconocido'}`,
    );
  }

  // ─── 5. MovimientosCC en CC de cada doc cancelado + actualizar denorm ───
  const movimientosCCDocumentosIds: string[] = [];
  const errores: string[] = [];

  for (const item of input.documentosCancelados) {
    try {
      if (item.tipo === 'oc') {
        const oc = ocsResolvedas.get(item.documentoId)!;
        await aplicarCargoAOC(
          item,
          oc,
          numeroCargo,
          cargoId,
          input,
          movimientoCCTarjetaId,
          idempotencyKey,
          userId,
          movimientosCCDocumentosIds,
        );
      } else if (item.tipo === 'envio') {
        const env = enviosResolvidos.get(item.documentoId)!;
        await aplicarCargoAEnvio(
          item,
          env,
          numeroCargo,
          cargoId,
          input,
          movimientoCCTarjetaId,
          idempotencyKey,
          userId,
          movimientosCCDocumentosIds,
        );
      } else {
        const gasto = gastosResolvidos.get(item.documentoId)!;
        await aplicarCargoAGasto(
          item,
          gasto,
          numeroCargo,
          cargoId,
          input,
          movimientoCCTarjetaId,
          idempotencyKey,
          userId,
          movimientosCCDocumentosIds,
        );
      }
    } catch (err) {
      const msg = `${item.tipo} ${item.documentoNumero}: ${
        err instanceof Error ? err.message : 'error'
      }`;
      logger.error(`[CargoTarjeta] ${msg}`, err);
      errores.push(msg);
    }
  }

  // ─── 6. Resultado ───────────────────────────────────────────────────
  if (errores.length === 0) {
    logger.success(
      `[CargoTarjeta] OK · ${numeroCargo} · ${input.moneda} ${input.monto.toFixed(2)} → ${input.documentosCancelados.length} docs`,
    );
  } else {
    logger.warn(
      `[CargoTarjeta] PARCIAL · ${numeroCargo} · ${errores.length} errores`,
    );
  }

  return {
    cargoId,
    numeroCargo,
    movimientoCCTarjetaId,
    movimientosCCDocumentosIds,
    errores,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS POR TIPO DE DOCUMENTO
// ═════════════════════════════════════════════════════════════════════════

async function aplicarCargoAOC(
  item: DocumentoCanceladoCargoTC,
  oc: OrdenCompra,
  numeroCargo: string,
  cargoId: string,
  input: CargoTarjetaInput,
  _movTCId: string,
  idempotencyKey: string,
  userId: string,
  movimientosCCDocumentosIds: string[],
): Promise<void> {
  const ccResult = await cuentaCorrienteService.registrarMovimiento(
    {
      entidadId: oc.proveedorId,
      tipo: 'proveedor',
      entidadNombre: oc.nombreProveedor,
      tipoMovimiento: 'credito_aplicacion_cargo_tc',
      descripcion:
        `Cargo TC ${numeroCargo} aplicado a OC ${oc.numeroOrden} · ` +
        `${input.moneda} ${item.montoAplicado.toFixed(2)}`,
      moneda: input.moneda,
      monto: item.montoAplicado,
      fecha: input.fecha,
      refDocumentoTipo: 'oc',
      refDocumentoId: oc.id,
      refDocumentoNumero: oc.numeroOrden,
      // El "movimiento de tesorería" del cargo TC no existe (es a futuro)
      // pero linkeamos al cargo via aplicado a
      aplicadoARefTipo: 'oc',
      aplicadoARefId: oc.id,
      aplicadoARefNumero: oc.numeroOrden,
      notas: `cargoTarjetaId=${cargoId}`,
      idempotencyKey: `${idempotencyKey}:${item.documentoId}`,
    },
    userId,
  );
  movimientosCCDocumentosIds.push(ccResult.movimientoId);

  // Actualizar denorm OC
  const pagosCC = await getPagosOC(oc.id);
  const totalPagadoUSD = pagosCC.reduce((s, p) => s + p.montoUSD, 0);
  const pendienteUSD = oc.totalUSD - totalPagadoUSD;
  const estadoPago: 'pendiente' | 'parcial' | 'pagado' =
    pendienteUSD <= TOLERANCIA
      ? 'pagado'
      : totalPagadoUSD > TOLERANCIA
        ? 'parcial'
        : 'pendiente';
  void normalizarEstadoPagoOC; // silenciar import si no se usa
  await updateDoc(doc(db, ORDENES_COLLECTION, oc.id), {
    estadoPago,
    montoPendiente: Math.max(0, pendienteUSD * (oc.tcCompra || 1)),
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId,
  });
}

async function aplicarCargoAEnvio(
  item: DocumentoCanceladoCargoTC,
  envio: Envio,
  numeroCargo: string,
  cargoId: string,
  input: CargoTarjetaInput,
  _movTCId: string,
  idempotencyKey: string,
  userId: string,
  movimientosCCDocumentosIds: string[],
): Promise<void> {
  if (!envio.colaboradorId) {
    throw new Error(`Envío ${envio.numeroEnvio} sin colaboradorId`);
  }

  const ccResult = await cuentaCorrienteService.registrarMovimiento(
    {
      entidadId: envio.colaboradorId,
      tipo: 'colaborador',
      entidadNombre: envio.colaboradorNombre || 'Colaborador',
      tipoMovimiento: 'credito_aplicacion_cargo_tc',
      descripcion:
        `Cargo TC ${numeroCargo} aplicado a flete ${envio.numeroEnvio} · ` +
        `USD ${item.montoAplicado.toFixed(2)}`,
      moneda: 'USD',
      monto: item.montoAplicado,
      fecha: input.fecha,
      refDocumentoTipo: 'envio',
      refDocumentoId: envio.id,
      refDocumentoNumero: envio.numeroEnvio,
      notas: `cargoTarjetaId=${cargoId} · aplicadoA=envio:${envio.id}`,
      idempotencyKey: `${idempotencyKey}:${item.documentoId}`,
    },
    userId,
  );
  movimientosCCDocumentosIds.push(ccResult.movimientoId);

  // Actualizar denorm envío
  const pagos = await getPagosEnvio(envio.id);
  const totalPagadoUSD = pagos.reduce(
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
  await updateDoc(doc(db, COLLECTIONS.ENVIOS, envio.id), {
    estadoPagoColaborador: nuevoEstado,
    montoPagadoUSD: totalPagadoUSD,
    montoPendienteUSD: pendienteUSD,
    fechaActualizacion: Timestamp.now(),
    actualizadoPor: userId,
  });
}

async function aplicarCargoAGasto(
  item: DocumentoCanceladoCargoTC,
  gasto: Gasto,
  numeroCargo: string,
  cargoId: string,
  input: CargoTarjetaInput,
  _movTCId: string,
  idempotencyKey: string,
  userId: string,
  movimientosCCDocumentosIds: string[],
): Promise<void> {
  const ccResult = await cuentaCorrienteService.registrarMovimiento(
    {
      entidadId: gasto.proveedorId!,
      tipo: gasto.proveedorTipo!,
      entidadNombre:
        gasto.proveedorNombre || gasto.proveedor || 'Proveedor',
      tipoMovimiento: 'credito_aplicacion_cargo_tc',
      descripcion:
        `Cargo TC ${numeroCargo} aplicado a gasto ${gasto.numeroGasto} · ` +
        `${input.moneda} ${item.montoAplicado.toFixed(2)}`,
      moneda: input.moneda,
      monto: item.montoAplicado,
      fecha: input.fecha,
      refDocumentoTipo: 'gasto',
      refDocumentoId: gasto.id,
      refDocumentoNumero: gasto.numeroGasto,
      notas: `cargoTarjetaId=${cargoId} · aplicadoA=gasto:${gasto.id}`,
      idempotencyKey: `${idempotencyKey}:${item.documentoId}`,
    },
    userId,
  );
  movimientosCCDocumentosIds.push(ccResult.movimientoId);

  // Actualizar denorm gasto (estado/montoPagado/pendiente)
  const montoAplicadoPEN =
    input.moneda === 'PEN'
      ? item.montoAplicado
      : item.montoAplicado * (input.tcDelDia || gasto.tipoCambio || 1);
  const nuevoMontoPagado = (gasto.montoPagado || 0) + montoAplicadoPEN;
  const nuevoPendiente = Math.max(0, gasto.montoPEN - nuevoMontoPagado);
  const nuevoEstado: 'pendiente' | 'parcial' | 'pagado' =
    nuevoPendiente <= TOLERANCIA
      ? 'pagado'
      : nuevoMontoPagado > TOLERANCIA
        ? 'parcial'
        : 'pendiente';

  await updateDoc(doc(db, COLLECTIONS.GASTOS, gasto.id), {
    estado: nuevoEstado,
    montoPagado: nuevoMontoPagado,
    montoPendiente: nuevoPendiente,
    ultimaEdicion: Timestamp.now(),
    editadoPor: userId,
  });
}

// ═════════════════════════════════════════════════════════════════════════
// FACADE
// ═════════════════════════════════════════════════════════════════════════

export const cargoTarjetaService = {
  ejecutar,
};

// Export type re-export for convenience
export type { CargoTarjeta };
