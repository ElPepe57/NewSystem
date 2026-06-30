import { useMemo } from 'react';
import { useProductoStore } from '../../../../store/productoStore';
import { useOrdenCompraStore } from '../../../../store/ordenCompraStore';
import { getReferenciaPreciosEnMemoria } from '../../../../services/ordenCompra.stats.service';
import { calcularInvestigacion } from '../../../../pages/Productos/utils/investigacionCalculos';
import {
  analizarPrecio,
  scoreLabelAndTone,
  type AnalisisPrecioResult,
  type ScoreTone,
} from '../../../../utils/precioInteligencia.helper';
import type { OCWizardState } from './ocWizardTypes';

/**
 * useAnalisisOC · DECISIÓN C (2026-06-30).
 *
 * Análisis de precio AGREGADO de la OC, para la franja "Salud de la compra" del paso Confirmar
 * (que ABSORBE el ex-paso "Inteligencia" eliminado · 5→4 pasos). Reusa el motor PURO `analizarPrecio`
 * (los 3 bugs ya corregidos · sin campos deprecados): por producto arma la referencia histórica
 * (getReferenciaPreciosEnMemoria · sync, en-memoria) + la investigación VIVA (calcularInvestigacion).
 *
 * El margen es LANDED (incluye cargos/descuentos prorrateados · disponibles en Confirmar, que va
 * DESPUÉS de Cargos). El semáforo per-producto (crudo-vs-crudo) vive en StepProductos al tipear.
 */

export interface AnalisisProductoOC {
  productoId: string;
  nombre: string;
  res: AnalisisPrecioResult;
}

export interface SaludCompra {
  /** Score promedio (0-100) de los productos con datos · 0 si ninguno. */
  score: number;
  scoreLabel: string;
  scoreTone: ScoreTone;
  /** Margen % landed ponderado por inversión · null si no calculable. */
  margenPromedio: number | null;
  /** Productos con veredicto caro / no_recomendable. */
  nCaros: number;
  nProductos: number;
  /** Productos con análisis real (score > 0). */
  conDatos: number;
}

export function useAnalisisOC(state: OCWizardState): {
  porProducto: AnalisisProductoOC[];
  salud: SaludCompra;
} {
  const catalogo = useProductoStore((s) => s.productos);
  const ordenes = useOrdenCompraStore((s) => s.ordenes);

  return useMemo(() => {
    const prods = state.productos;
    const ids = prods.map((p) => p.productoId).filter(Boolean) as string[];
    const refs = getReferenciaPreciosEnMemoria(ids, ordenes);

    const totalUds = prods.reduce((s, p) => s + (p.cantidad || 0), 0);
    const totalCargos = state.cargosOC.reduce((s, c) => s + (c.montoUSD || 0), 0);
    const totalDesc = state.descuentosOC.reduce((s, d) => s + (d.montoUSD || 0), 0);
    const adicionalPorUd = totalUds > 0 ? (totalCargos - totalDesc) / totalUds : 0;

    const porProducto: AnalisisProductoOC[] = prods.map((p) => {
      const item = catalogo.find((c) => c.id === p.productoId);
      const calc = item ? calcularInvestigacion(item, state.tcCompra) : null;
      const investigacion = calc
        ? {
            precioMejorProvUSD: calc.precioMejorProvUSD,
            precioEfectivo: calc.precioEfectivo,
            tieneProveedores: calc.tieneProveedores,
            tieneCompetidores: calc.tieneCompetidores,
          }
        : null;
      const ref = refs.get(p.productoId) ?? { ultimaCompra: null, promedio: null, nMuestras: 0 };
      const res = analizarPrecio({
        costoUnitarioUSD: p.costoUnitario || 0,
        costoAdicionalPorUnidadUSD: adicionalPorUd,
        tc: state.tcCompra,
        referencia: { ultimaCompra: ref.ultimaCompra, promedio: ref.promedio, nMuestras: ref.nMuestras },
        investigacion,
        puntuacionViabilidad: item?.investigacion?.puntuacionViabilidad,
      });
      return { productoId: p.productoId, nombre: p.nombreComercial || p.sku || '—', res };
    });

    // ── Agregados ──
    const conScore = porProducto.filter((a) => a.res.score > 0);
    const score = conScore.length > 0
      ? Math.round(conScore.reduce((s, a) => s + a.res.score, 0) / conScore.length)
      : 0;

    // Margen landed ponderado por inversión (costo × cantidad).
    let mSum = 0;
    let mW = 0;
    for (const p of prods) {
      const a = porProducto.find((x) => x.productoId === p.productoId);
      const inv = (p.costoUnitario || 0) * (p.cantidad || 0);
      if (a && a.res.margenPct != null && inv > 0) {
        mSum += a.res.margenPct * inv;
        mW += inv;
      }
    }
    const margenPromedio = mW > 0 ? Math.round(mSum / mW) : null;
    const nCaros = porProducto.filter(
      (a) => a.res.veredicto === 'caro' || a.res.veredicto === 'no_recomendable',
    ).length;

    const { label, tone } = scoreLabelAndTone(score);

    return {
      porProducto,
      salud: {
        score,
        scoreLabel: label,
        scoreTone: tone,
        margenPromedio,
        nCaros,
        nProductos: prods.length,
        conDatos: conScore.length,
      },
    };
  }, [state.productos, state.tcCompra, state.cargosOC, state.descuentosOC, catalogo, ordenes]);
}
