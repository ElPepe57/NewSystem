/**
 * prorrateoLanded — Helpers compartidos para prorrateo de costos landed
 * entre unidades de un envío.
 *
 * Extraído en S53.7 desde `envio.recepcion.service.ts` para poder reutilizarlo
 * desde el flujo de "Recojo en origen" (`ordenCompra.crud.service.aplicarRecojoEnOrigen`),
 * que también necesita persistir el CTRU calculado en las unidades pero no
 * pasa por `registrarRecepcion`.
 *
 * Cubre el bug CONT-003 (prorrateo 'total_por_valor' sin productosInfo
 * degeneraba en prorrateo uniforme) pasando siempre un `productosInfo` real
 * cuando las unidades tienen datos de producto disponibles.
 */
import type { CostoLanded, EnvioUnidad } from '../types/envio.types';

export interface ProductoInfo {
  costoUSD: number;
  pesoLb: number;
}

/**
 * Prorratea un costo landed entre las unidades del envío según su
 * `metodoProrrateo`. Devuelve un Map `unidadId → monto PEN prorrateado`.
 *
 * Para `total_por_valor` y `total_por_peso` se requiere `productosInfo`
 * con costo y peso de cada producto involucrado. Si no se pasa y el método
 * es `total_por_valor`, el fallback a `valorUnitario = 1` producía un
 * prorrateo uniforme (bug CONT-003). Los callers deben construir el map
 * antes de invocar.
 */
export function prorratearCosto(
  costo: CostoLanded,
  unidades: EnvioUnidad[],
  productosInfo?: Map<string, ProductoInfo>
): Map<string, number> {
  const resultado = new Map<string, number>();
  const totalUnidades = unidades.length;

  if (totalUnidades === 0) return resultado;

  switch (costo.metodoProrrateo) {
    case 'fijo_por_unidad': {
      const montoPorUnidad = costo.montoPEN / totalUnidades;
      for (const u of unidades) {
        resultado.set(u.unidadId, montoPorUnidad);
      }
      break;
    }

    case 'variado_por_producto': {
      if (!costo.detalleVariado) {
        // Fallback a fijo si no hay detalle
        const montoPorUnidad = costo.montoPEN / totalUnidades;
        for (const u of unidades) resultado.set(u.unidadId, montoPorUnidad);
      } else {
        // `detalleVariado` es un Map productoId → monto total del costo para ese producto.
        // Lo distribuimos uniformemente entre las unidades del mismo productoId.
        const countPorProducto = new Map<string, number>();
        for (const u of unidades) {
          countPorProducto.set(
            u.productoId,
            (countPorProducto.get(u.productoId) || 0) + 1
          );
        }
        for (const u of unidades) {
          const totalProducto = costo.detalleVariado[u.productoId] || 0;
          const cantProducto = countPorProducto.get(u.productoId) || 1;
          resultado.set(u.unidadId, totalProducto / cantProducto);
        }
      }
      break;
    }

    case 'total_por_peso': {
      let pesoTotal = 0;
      for (const u of unidades) {
        const info = productosInfo?.get(u.productoId);
        pesoTotal += info?.pesoLb || u.pesoLibras || 1;
      }
      for (const u of unidades) {
        const info = productosInfo?.get(u.productoId);
        const peso = info?.pesoLb || u.pesoLibras || 1;
        resultado.set(u.unidadId, costo.montoPEN * (peso / pesoTotal));
      }
      break;
    }

    case 'total_por_valor': {
      // Calcular el valor TOTAL de la tanda (sumando por unidad: costoUSD × 1)
      let valorTotal = 0;
      for (const u of unidades) {
        const info = productosInfo?.get(u.productoId);
        valorTotal += info?.costoUSD || 1;
      }
      for (const u of unidades) {
        const info = productosInfo?.get(u.productoId);
        const valor = info?.costoUSD || 1;
        resultado.set(u.unidadId, costo.montoPEN * (valor / valorTotal));
      }
      break;
    }

    default: {
      const montoPorUnidad = costo.montoPEN / totalUnidades;
      for (const u of unidades) resultado.set(u.unidadId, montoPorUnidad);
    }
  }

  return resultado;
}

/**
 * Construye el Map productoId → {costoUSD, pesoLb} desde el array de
 * productos de una OC o directamente desde las unidades con sus datos
 * desnormalizados.
 *
 * Requerido para que `prorratearCosto` con método `total_por_valor` o
 * `total_por_peso` calcule correctamente los pesos relativos. Sin este
 * mapa, el prorrateo por valor degenera a uniforme (bug CONT-003).
 */
export function buildProductosInfoFromOC(
  productos: Array<{ productoId: string; costoUnitario: number; pesoLibras?: number }>
): Map<string, ProductoInfo> {
  const map = new Map<string, ProductoInfo>();
  for (const p of productos) {
    map.set(p.productoId, {
      costoUSD: p.costoUnitario || 0,
      pesoLb: p.pesoLibras || 0,
    });
  }
  return map;
}

/**
 * Calcula el total de costos landed prorrateados a cada unidad de un envío.
 * Retorna Map `unidadId → total PEN` ya sumando todos los costos del envío.
 *
 * Ejemplo: envío con 3 costos landed (flete $100, aduana $50, fee recepción $20),
 * 10 unidades → retorna Map de 10 entradas con la suma del prorrateo de los 3
 * costos para cada unidad.
 */
export function calcularCostosLandedPorUnidad(
  costosLanded: CostoLanded[],
  unidadesParaProrratear: EnvioUnidad[],
  productosInfo: Map<string, ProductoInfo>
): Map<string, number> {
  const resultado = new Map<string, number>();

  if (costosLanded.length === 0 || unidadesParaProrratear.length === 0) {
    return resultado;
  }

  for (const costo of costosLanded) {
    const prorrateo = prorratearCosto(costo, unidadesParaProrratear, productosInfo);
    for (const [unidadId, monto] of prorrateo) {
      resultado.set(unidadId, (resultado.get(unidadId) || 0) + monto);
    }
  }

  return resultado;
}
