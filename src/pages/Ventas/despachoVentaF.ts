/**
 * despachoVentaF — puente Ventas → motor de despacho F (A4).
 *
 * Cuando el flag WIZARD_F está activo, el despacho de una venta corre por el
 * modelo único `Envío` (Caso F) en vez del legacy `Entrega`. Este módulo:
 *   - mapea el `ProgramarEntregaData` del modal existente a `DespacharVentaPayload`
 *     (`despacharVentaDesdeData`), y
 *   - provee las GUARDIAS anti-doble-camino ASIMÉTRICAS: cada camino verifica que
 *     la venta no tenga un despacho ACTIVO en el OTRO camino (evita doble
 *     gasto/cobro). NO bloquea múltiples despachos del MISMO camino (entregas
 *     parciales legítimas).
 */
import { envioDespachoService } from '../../services/envio.despacho.service';
import { entregaService } from '../../services/entrega.service';
import { unidadService } from '../../services/unidad.service';
import type { ProgramarEntregaData } from '../../types/entrega.types';
import type { Venta } from '../../types/venta.types';
import type { Unidad } from '../../types/unidad.types';

// Estados TERMINALES de una entrega legacy · todo lo demás cuenta como "activa"
// (blacklist defensiva ante estados legacy desconocidos · DATA-001).
const ESTADOS_ENTREGA_TERMINAL: readonly string[] = ['entregada', 'cancelada', 'fallida'];

/**
 * Mapea el resultado del `ProgramarEntregaModal` a `DespacharVentaPayload` y
 * dispara el motor F (`despacharVenta`). Expande las unidades asignadas a los
 * detalles que el motor necesita y deriva el almacén de origen de las unidades.
 */
export async function despacharVentaDesdeData(
  data: ProgramarEntregaData,
  venta: Venta,
  userId: string,
): Promise<{ envioId: string; numeroEnvio: string }> {
  const ids = data.productos.flatMap((p) => p.unidadesAsignadas);
  if (ids.length === 0) {
    throw new Error('No hay unidades seleccionadas para despachar.');
  }

  const full = (await Promise.all(ids.map((id) => unidadService.getById(id))))
    .filter((u): u is Unidad => !!u);
  if (full.length < ids.length) {
    const faltantes = ids.length - full.length;
    throw new Error(
      `${faltantes} unidad(es) seleccionada(s) ya no existen o fueron movidas. Recargá la lista e intentá de nuevo.`,
    );
  }

  // Todas las unidades deben compartir la casilla de origen (un despacho = un origen).
  const casillas = new Set(full.map((u) => u.casillaActualId || u.almacenId || ''));
  if (casillas.size > 1) {
    throw new Error('Las unidades seleccionadas están en distintas casillas. Despachá una casilla de origen a la vez.');
  }

  const unidades = full.map((u) => ({
    unidadId: u.id,
    productoId: u.productoId,
    sku: u.productoSKU ?? '',
    codigoUnidad: u.id,
  }));

  const almacenOrigenId = full[0].casillaActualId || full[0].almacenId || '';

  return envioDespachoService.despacharVenta(
    {
      venta,
      almacenOrigenId,
      unidades,
      colaboradorTransporteId: data.transportistaId || undefined,
      fechaProgramada: data.fechaProgramada,
      horaProgramada: data.horaProgramada,
      cobroPendiente: data.cobroPendiente,
      montoPorCobrar: data.montoPorCobrar,
      metodoPagoEsperado: data.metodoPagoEsperado,
      costoDeliveryPEN: data.costoTransportista || undefined,
      notas: data.observaciones,
    },
    userId,
  );
}

/**
 * Guardia para el camino F: devuelve un mensaje si la venta tiene una entrega
 * LEGACY activa (evita despachar por ambos caminos). null = se puede despachar por F.
 */
export async function bloqueoDespachoF(ventaId: string): Promise<string | null> {
  const entregas = await entregaService.getByVenta(ventaId);
  const legacyActiva = entregas.some((e) => !ESTADOS_ENTREGA_TERMINAL.includes(e.estado));
  return legacyActiva
    ? 'Esta venta tiene una entrega activa en el flujo anterior. Complétala o cancélala antes de despachar por el flujo nuevo.'
    : null;
}

/**
 * Guardia para el camino LEGACY: devuelve un mensaje si la venta ya tiene un
 * despacho F activo (evita despachar por ambos caminos). null = se puede programar
 * por el flujo legacy.
 */
export async function bloqueoDespachoLegacy(ventaId: string): Promise<string | null> {
  const hayF = await envioDespachoService.existeEnvioFActivo(ventaId);
  return hayF
    ? 'Esta venta ya tiene un despacho activo en el flujo nuevo (módulo Envíos).'
    : null;
}
