/**
 * envio.unificado.service — Adaptador del state del wizard unificado al
 * servicio legacy `envio.crud.service.ts`.
 *
 * S53 F4: no se reescribe la lógica de persistencia. Se reutilizan los
 * métodos `crearEnvioT2 / J / E / I` del servicio existente. Este adaptador
 * solo:
 *   1. Recibe el state del wizard unificado
 *   2. Según el tipo inferido, arma el payload correcto
 *   3. Llama al método correspondiente del servicio legacy
 */
import { envioCrudService } from '../../../../services/envio.crud.service';
import type {
  EnvioWizardState,
  UnidadSeleccionadaWizard,
  CostoPorProducto,
  ModalidadCosto,
} from '../envioWizardTypes';
import { encontrarTramoPorPeso } from '../envioWizardTypes';
import type { TipoInferido } from '../envioWizardTypes';
import type {
  CrearEnvioT2Payload,
  CrearEnvioJPayload,
  CrearEnvioEPayload,
  CrearEnvioIPayload,
  MetodoProrrateo,
} from '../../../../types/envio.types';
import type { TramoPeso } from '../../../../types/colaborador.types';

// ============================================================================
// Helpers
// ============================================================================

/**
 * S53.1 FIX — Expande las unidades agrupadas (1 grupo por SKU con N IDs reales)
 * a unidades individuales con su unidadId específico.
 *
 * Cada `UnidadSeleccionadaWizard` contiene un array `unidadIdsAsignados`
 * con los IDs físicos que el usuario asignó (manualmente o vía stepper).
 * Iteramos ese array y generamos una entry por ID real — NO replicamos.
 *
 * Esto preserva la trazabilidad: cada unidad física del envío referencia
 * su propio registro en la colección `unidades` con su lote, vencimiento,
 * costo y peso específicos.
 *
 * `codigoUnidad` usa el unidadId como fallback (el servicio legacy lo
 * sobreescribe con el código real cuando persiste EnvioUnidad).
 */
function expandirUnidades(
  unidades: UnidadSeleccionadaWizard[]
): Array<{
  unidadId: string;
  productoId: string;
  sku: string;
  codigoUnidad: string;
  pesoLibras?: number;
}> {
  const expandidas: Array<{
    unidadId: string;
    productoId: string;
    sku: string;
    codigoUnidad: string;
    pesoLibras?: number;
  }> = [];

  for (const grupo of unidades) {
    for (const unidadIdReal of grupo.unidadIdsAsignados) {
      expandidas.push({
        unidadId: unidadIdReal,
        productoId: grupo.productoId,
        sku: grupo.sku,
        codigoUnidad: unidadIdReal, // el servicio legacy lee el código real al persistir
        ...(grupo.pesoLibras !== undefined ? { pesoLibras: grupo.pesoLibras } : {}),
      });
    }
  }

  return expandidas;
}

/**
 * Convierte la modalidad de costo del wizard al `metodoProrrateo` del
 * servicio legacy. El mapping es directo:
 *   flete_total  → fijo_por_unidad (se prorratea uniforme por unidad)
 *   tarifa_unidad → fijo_por_unidad
 *   por_producto  → variado_por_producto
 *   por_tramos    → variado_por_producto (el costo ya viene calculado por SKU)
 */
function modalidadAMetodoProrrateo(modalidad: ModalidadCosto): MetodoProrrateo {
  if (modalidad === 'por_producto' || modalidad === 'por_tramos') {
    return 'variado_por_producto';
  }
  return 'fijo_por_unidad';
}

/**
 * Calcula el `detalleVariado` (productoId → monto) según la modalidad.
 * Solo se genera para modalidades 'por_producto' y 'por_tramos'.
 */
function calcularDetalleVariado(
  unidades: UnidadSeleccionadaWizard[],
  modalidad: ModalidadCosto,
  costosPorProducto: CostoPorProducto[],
  tramos: TramoPeso[]
): Record<string, number> | undefined {
  if (modalidad === 'por_producto') {
    const detalle: Record<string, number> = {};
    for (const u of unidades) {
      const costo = costosPorProducto.find(c => c.productoId === u.productoId);
      if (costo) {
        detalle[u.productoId] = costo.costoUnitario * u.cantidadSeleccionada;
      }
    }
    return detalle;
  }
  if (modalidad === 'por_tramos') {
    const detalle: Record<string, number> = {};
    for (const u of unidades) {
      if (u.pesoLibras === undefined) continue;
      const tramo = encontrarTramoPorPeso(tramos, u.pesoLibras);
      if (tramo) {
        detalle[u.productoId] = tramo.costoUnitario * u.cantidadSeleccionada;
      }
    }
    return detalle;
  }
  return undefined;
}

// ============================================================================
// Construcción de payload según tipo
// ============================================================================

function buildPayloadC(
  state: EnvioWizardState,
  totalFleteUSD: number,
  tipoTransporteT2: 'viajero' | 'courier'
): CrearEnvioT2Payload {
  const unidadesExpandidas = expandirUnidades(state.unidadesSeleccionadas);
  const metodoProrrateo = modalidadAMetodoProrrateo(state.modalidadCosto);
  const detalleVariado = calcularDetalleVariado(
    state.unidadesSeleccionadas,
    state.modalidadCosto,
    state.costosPorProducto,
    state.tramosPeso
  );

  const costos: CrearEnvioT2Payload['costos'] =
    totalFleteUSD > 0 && state.tipoCambio > 0
      ? [
          {
            categoriaCostoId: 'flete-transporte',
            categoriaCostoNombre: 'Flete',
            descripcion:
              state.modalidadCosto === 'por_tramos'
                ? 'Flete calculado por tramos de peso'
                : undefined,
            montoUSD: totalFleteUSD,
            tipoCambio: state.tipoCambio,
            metodoProrrateo,
            ...(detalleVariado ? { detalleVariado } : {}),
          },
        ]
      : [];

  return {
    casillaOrigenId: state.ubicacionOrigenId,
    almacenDestinoId: state.ubicacionDestinoId,
    tipoTransporte: tipoTransporteT2,
    colaboradorId: state.colaboradorTransporteId,
    numeroTracking: state.numeroTracking || undefined,
    notas: state.notas || undefined,
    unidades: unidadesExpandidas,
    costos,
  };
}

function buildPayloadJ(
  state: EnvioWizardState,
  totalFleteUSD: number
): CrearEnvioJPayload {
  const unidadesExpandidas = expandirUnidades(state.unidadesSeleccionadas);
  const metodoProrrateo = modalidadAMetodoProrrateo(state.modalidadCosto);
  const detalleVariado = calcularDetalleVariado(
    state.unidadesSeleccionadas,
    state.modalidadCosto,
    state.costosPorProducto,
    state.tramosPeso
  );

  const costos: CrearEnvioJPayload['costos'] =
    totalFleteUSD > 0 && state.tipoCambio > 0
      ? [
          {
            categoriaCostoId: 'flete-transporte',
            categoriaCostoNombre: 'Flete',
            montoUSD: totalFleteUSD,
            tipoCambio: state.tipoCambio,
            metodoProrrateo,
            ...(detalleVariado ? { detalleVariado } : {}),
          },
        ]
      : [];

  // S53.1 FIX — Detectar variante J1/J2:
  //   J1 = misma persona dueña de ambas casillas (movimiento interno)
  //   J2 = 2 colaboradores distintos (remitente → destinatario)
  // El state guarda `ubicacionOrigenColaboradorId` y `ubicacionDestinoColaboradorId`
  // en cada `SET_UBICACION_*`. Comparación directa.
  const varianteJ: 'J1' | 'J2' =
    state.ubicacionOrigenColaboradorId &&
    state.ubicacionDestinoColaboradorId &&
    state.ubicacionOrigenColaboradorId === state.ubicacionDestinoColaboradorId
      ? 'J1'
      : 'J2';

  return {
    casillaOrigenId: state.ubicacionOrigenId,
    casillaDestinoId: state.ubicacionDestinoId,
    variante: varianteJ,
    colaboradorTransporteId: state.colaboradorTransporteId,
    numeroTracking: state.numeroTracking || undefined,
    notas: state.notas || undefined,
    advertenciaCambioPais: state.advertenciaCambioPais,
    unidades: unidadesExpandidas,
    costos,
  };
}

function buildPayloadE(
  state: EnvioWizardState,
  totalFletePEN: number
): CrearEnvioEPayload {
  const unidadesExpandidas = expandirUnidades(state.unidadesSeleccionadas);
  const metodoProrrateo = modalidadAMetodoProrrateo(state.modalidadCosto);

  // Tipo E usa PEN (no USD). Si el usuario ingresó costo en UI, lo tomamos
  // como si ya estuviera en PEN. Si quisiera USD+TC, el TCChip no se muestra
  // para E (config.moneda='PEN').
  const detalleVariadoPEN: Record<string, number> | undefined = (() => {
    if (state.modalidadCosto === 'por_producto') {
      const d: Record<string, number> = {};
      for (const u of state.unidadesSeleccionadas) {
        const c = state.costosPorProducto.find(cp => cp.productoId === u.productoId);
        if (c) d[u.productoId] = c.costoUnitario * u.cantidadSeleccionada;
      }
      return d;
    }
    return undefined;
  })();

  const costosPEN: CrearEnvioEPayload['costosPEN'] =
    totalFletePEN > 0
      ? [
          {
            categoriaCostoId: 'flete-local',
            categoriaCostoNombre: 'Flete local',
            montoPEN: totalFletePEN,
            metodoProrrateo,
            ...(detalleVariadoPEN ? { detalleVariado: detalleVariadoPEN } : {}),
          },
        ]
      : [];

  if (!state.motivo) {
    throw new Error('Motivo obligatorio para envío tipo E');
  }

  return {
    casillaOrigenId: state.ubicacionOrigenId,
    casillaDestinoId: state.ubicacionDestinoId,
    motivo: state.motivo,
    motivoDetalle: state.motivoDetalle || undefined,
    colaboradorTransporteId: state.colaboradorTransporteId || undefined,
    numeroTracking: state.numeroTracking || undefined,
    notas: state.notas || undefined,
    unidades: unidadesExpandidas,
    costosPEN,
  };
}

function buildPayloadI(
  state: EnvioWizardState,
  totalFleteUSD: number
): CrearEnvioIPayload {
  const unidadesExpandidas = expandirUnidades(state.unidadesSeleccionadas);
  const metodoProrrateo = modalidadAMetodoProrrateo(state.modalidadCosto);

  // Tipo I es multi-moneda. En el MVP del wizard unificado, los costos
  // ingresados se asumen USD (la mayoría de casos FBA internacional).
  const costos: CrearEnvioIPayload['costos'] =
    totalFleteUSD > 0
      ? [
          {
            categoriaCostoId: 'flete-transporte',
            categoriaCostoNombre: 'Flete',
            monto: totalFleteUSD,
            moneda: 'USD',
            tipoCambio: state.tipoCambio,
            metodoProrrateo,
          },
        ]
      : [];

  if (!state.referenciaTercero?.trim()) {
    throw new Error('Referencia del tercero obligatoria para envío tipo I');
  }

  return {
    almacenOrigenId: state.ubicacionOrigenId,
    almacenTerceroDestinoId: state.ubicacionDestinoId,
    referenciaTercero: state.referenciaTercero,
    tipoRelacion: state.tipoRelacion,
    colaboradorTransporteId: state.colaboradorTransporteId || undefined,
    numeroTracking: state.numeroTracking || undefined,
    notas: state.notas || undefined,
    unidades: unidadesExpandidas,
    costos,
  };
}

// ============================================================================
// Servicio unificado
// ============================================================================

export interface CrearEnvioUnificadoResult {
  id: string;
  numeroEnvio: string;
  tipo: TipoInferido;
}

export const envioUnificadoService = {
  /**
   * Crea un envío unificado despachando al servicio legacy correcto
   * según el tipo inferido.
   *
   * @param tipo - Tipo inferido del Paso 1 (C/J/E/I)
   * @param state - State completo del wizard
   * @param totalFleteUSD - Total del flete calculado por el selector
   *                        (puede estar en PEN si tipoConfig.moneda='PEN')
   * @param userId - UID del usuario autenticado
   */
  async crear(
    tipo: TipoInferido,
    state: EnvioWizardState,
    totalFleteUSD: number,
    userId: string
  ): Promise<CrearEnvioUnificadoResult> {
    switch (tipo) {
      case 'C': {
        // El wizard unificado no distingue viajero vs courier en el state
        // actual. Mapeamos según tipoTransportador.
        const tipoT2: 'viajero' | 'courier' =
          state.tipoTransportador === 'viajero' ? 'viajero' : 'courier';
        const payload = buildPayloadC(state, totalFleteUSD, tipoT2);
        const resultado = await envioCrudService.crearEnvioT2(payload, userId);
        return { ...resultado, tipo: 'C' };
      }
      case 'J': {
        const payload = buildPayloadJ(state, totalFleteUSD);
        const resultado = await envioCrudService.crearEnvioJ(payload, userId);
        return { ...resultado, tipo: 'J' };
      }
      case 'E': {
        // Para E, totalFleteUSD es realmente PEN (no hay TC para E)
        const payload = buildPayloadE(state, totalFleteUSD);
        const resultado = await envioCrudService.crearEnvioE(payload, userId);
        return { ...resultado, tipo: 'E' };
      }
      case 'I': {
        const payload = buildPayloadI(state, totalFleteUSD);
        const resultado = await envioCrudService.crearEnvioI(payload, userId);
        return { ...resultado, tipo: 'I' };
      }
      default:
        throw new Error(`Tipo de envío no soportado: ${tipo}`);
    }
  },
};
