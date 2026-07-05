/**
 * despachoVentaF — puente Ventas → motor de despacho F (A4).
 *
 * El despacho de una venta corre por el modelo único `Envío` (Caso F). Este módulo
 * mapea el `ProgramarEntregaData` del modal existente a `DespacharVentaPayload`
 * (`despacharVentaDesdeData`) y dispara el motor `envio.despacho.service`.
 */
import { envioDespachoService } from '../../services/envio.despacho.service';
import { unidadService } from '../../services/unidad.service';
import type { ProgramarEntregaData } from '../../types/envio.types';
import type { Venta } from '../../types/venta.types';
import type { Unidad } from '../../types/unidad.types';

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
