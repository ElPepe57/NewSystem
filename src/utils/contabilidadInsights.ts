/**
 * Contabilidad Insights · canon v5.2 chk5.E-C · Sprint C
 *
 * Funciones puras (sin IO) que generan:
 * - Estado del negocio (Saludable / Atención / Crítico) con razones objetivas
 * - Insights del mes (4-6 hallazgos automáticos · polaridad clara)
 *
 * Reglas determinísticas basadas en umbrales configurables (no IA).
 */

import type {
  EstadoResultados,
  BalanceGeneral,
  ResumenContable,
  TendenciaMensual,
} from '../types/contabilidad.types';
import type { UmbralesSalud } from '../services/contabilidad.service';
import { DEFAULT_UMBRALES } from '../services/contabilidad.service';

// ============================================================================
// ESTADO DEL NEGOCIO
// ============================================================================

export type EstadoNegocio = 'saludable' | 'atencion' | 'critico';

export interface RazonEstado {
  /** Polaridad del indicador */
  polaridad: 'ok' | 'warning' | 'critico';
  /** Label corto (ej. "Margen bruto sano") */
  titulo: string;
  /** Valor actual formateado (ej. "58.5%") */
  valor: string;
  /** Texto de meta o contexto (ej. "meta ≥40% · +18pp") */
  meta: string;
}

export interface ResultadoEstadoNegocio {
  estado: EstadoNegocio;
  razones: RazonEstado[];
  indicadoresOK: number;
  indicadoresTotal: number;
  /** Si hay acciones sugeridas (cuando estado != saludable) */
  acciones?: string[];
}

/**
 * Calcula el estado holístico del negocio · 7 indicadores evaluados:
 * 1. Margen bruto vs umbral
 * 2. Margen neto vs umbral
 * 3. Crecimiento ventas vs umbral
 * 4. Días de caja libre (estimado · necesita Balance + gastos)
 * 5. Liquidez corriente
 * 6. Días de inventario máx (cuanto MENOR, mejor)
 * 7. Utilidad neta positiva
 */
export function calcularEstadoNegocio(
  estado: EstadoResultados | null,
  balance: BalanceGeneral | null,
  mesAnterior: ResumenContable | null,
  umbrales: UmbralesSalud = DEFAULT_UMBRALES,
): ResultadoEstadoNegocio {
  const razones: RazonEstado[] = [];
  let indicadoresOK = 0;
  let indicadoresCriticos = 0;
  let indicadoresTotal = 0;
  const acciones: string[] = [];

  if (!estado || !balance) {
    return {
      estado: 'saludable',
      razones: [],
      indicadoresOK: 0,
      indicadoresTotal: 0,
    };
  }

  // === 1. Margen Bruto ===
  indicadoresTotal++;
  const mb = estado.utilidadBrutaPorcentaje;
  if (mb >= umbrales.margenBrutoMin) {
    indicadoresOK++;
    razones.push({
      polaridad: 'ok',
      titulo: 'Margen bruto sano',
      valor: `${mb.toFixed(1)}%`,
      meta: `meta ≥${umbrales.margenBrutoMin}% · +${(mb - umbrales.margenBrutoMin).toFixed(1)}pp`,
    });
  } else {
    razones.push({
      polaridad: 'warning',
      titulo: 'Margen bruto bajo',
      valor: `${mb.toFixed(1)}%`,
      meta: `meta ≥${umbrales.margenBrutoMin}% · ${(mb - umbrales.margenBrutoMin).toFixed(1)}pp`,
    });
    acciones.push('Revisar costo de productos · TC compras · negociar con proveedores para mejorar margen bruto.');
  }

  // === 2. Margen Neto ===
  indicadoresTotal++;
  const mn = estado.utilidadNetaPorcentaje;
  if (mn >= umbrales.margenNetoMin) {
    indicadoresOK++;
    razones.push({
      polaridad: 'ok',
      titulo: 'Margen neto saludable',
      valor: `${mn.toFixed(1)}%`,
      meta: `meta ≥${umbrales.margenNetoMin}% · +${(mn - umbrales.margenNetoMin).toFixed(1)}pp`,
    });
  } else if (mn > 0) {
    razones.push({
      polaridad: 'warning',
      titulo: 'Margen neto bajo',
      valor: `${mn.toFixed(1)}%`,
      meta: `meta ≥${umbrales.margenNetoMin}%`,
    });
    acciones.push('Revisar gastos operativos · cuál componente subió más este mes.');
  } else {
    indicadoresCriticos++;
    razones.push({
      polaridad: 'critico',
      titulo: 'Utilidad NEGATIVA',
      valor: `${mn.toFixed(1)}%`,
      meta: 'mes con pérdida',
    });
    acciones.push('URGENTE: revisar por qué hay pérdida · congelar gastos no críticos · plan de contención.');
  }

  // === 3. Crecimiento ventas vs mes anterior ===
  indicadoresTotal++;
  if (mesAnterior && mesAnterior.ventasNetas > 0) {
    const crecimiento = ((estado.ventasNetas - mesAnterior.ventasNetas) / mesAnterior.ventasNetas) * 100;
    if (crecimiento >= umbrales.crecimientoVentasMin) {
      indicadoresOK++;
      razones.push({
        polaridad: 'ok',
        titulo: 'Crecimiento ventas',
        valor: `+${crecimiento.toFixed(1)}%`,
        meta: 'vs mes anterior · sostenido',
      });
    } else if (crecimiento >= -20) {
      razones.push({
        polaridad: 'warning',
        titulo: 'Ventas decreciendo',
        valor: `${crecimiento.toFixed(1)}%`,
        meta: `meta ≥${umbrales.crecimientoVentasMin}% · revisar canal/producto`,
      });
      acciones.push('Investigar caída de ventas · cambio de canal · competidor · estacionalidad.');
    } else {
      indicadoresCriticos++;
      razones.push({
        polaridad: 'critico',
        titulo: 'Caída de ventas fuerte',
        valor: `${crecimiento.toFixed(1)}%`,
        meta: 'vs mes anterior · alerta crítica',
      });
      acciones.push('URGENTE: caída de ventas >20% · revisar inmediatamente.');
    }
  } else {
    // Sin data mes anterior · indicador no aplicable
    indicadoresTotal--;
  }

  // === 4. Liquidez Corriente ===
  indicadoresTotal++;
  const liquidez =
    balance.pasivos.corriente.total > 0
      ? balance.activos.corriente.total / balance.pasivos.corriente.total
      : 999; // Sin pasivo corriente · liquidez infinita (saludable)
  if (liquidez >= umbrales.liquidezCorrienteMin) {
    indicadoresOK++;
    razones.push({
      polaridad: 'ok',
      titulo: 'Liquidez OK',
      valor: `${liquidez.toFixed(2)}x`,
      meta: `meta ≥${umbrales.liquidezCorrienteMin}x`,
    });
  } else if (liquidez >= 1.0) {
    razones.push({
      polaridad: 'warning',
      titulo: 'Liquidez ajustada',
      valor: `${liquidez.toFixed(2)}x`,
      meta: `meta ≥${umbrales.liquidezCorrienteMin}x · vigilar`,
    });
  } else {
    indicadoresCriticos++;
    razones.push({
      polaridad: 'critico',
      titulo: 'Liquidez insuficiente',
      valor: `${liquidez.toFixed(2)}x`,
      meta: 'meta ≥1.0x · riesgo de impago',
    });
    acciones.push('URGENTE: liquidez bajo 1.0x · activos corto plazo insuficientes para deuda corto plazo.');
  }

  // === 5. Días de caja libre (aprox · efectivo / gastos opex mensuales) ===
  indicadoresTotal++;
  const efectivo = balance.activos.corriente.efectivo.total;
  const gastosOpDiarios = estado.totalGastosOperativos / 30; // aprox mensual → diario
  const diasCaja = gastosOpDiarios > 0 ? efectivo / gastosOpDiarios : 999;
  if (diasCaja >= umbrales.diasCajaMin) {
    indicadoresOK++;
    razones.push({
      polaridad: 'ok',
      titulo: 'Caja con buffer',
      valor: `${diasCaja.toFixed(0)} días`,
      meta: `meta ≥${umbrales.diasCajaMin} · holgado`,
    });
  } else if (diasCaja >= 30) {
    razones.push({
      polaridad: 'warning',
      titulo: 'Caja ajustada',
      valor: `${diasCaja.toFixed(0)} días`,
      meta: `meta ≥${umbrales.diasCajaMin} · vigilar`,
    });
    acciones.push(`Caja en ${diasCaja.toFixed(0)} días · evitar compras grandes hasta tener ${umbrales.diasCajaMin}+ días de buffer.`);
  } else {
    indicadoresCriticos++;
    razones.push({
      polaridad: 'critico',
      titulo: 'Caja muy baja',
      valor: `${diasCaja.toFixed(0)} días`,
      meta: 'meta ≥60 · riesgo alto',
    });
    acciones.push('URGENTE: caja <30 días · congelar gastos no críticos · acelerar cobranza.');
  }

  // === 6. Utilidad neta del mes positiva ===
  indicadoresTotal++;
  if (estado.utilidadNeta > 0) {
    indicadoresOK++;
    razones.push({
      polaridad: 'ok',
      titulo: 'Mes con ganancia',
      valor: formatCurrency(estado.utilidadNeta),
      meta: 'utilidad positiva',
    });
  } else if (estado.utilidadNeta === 0) {
    razones.push({
      polaridad: 'warning',
      titulo: 'Mes en equilibrio',
      valor: 'S/ 0',
      meta: 'sin ganancia ni pérdida',
    });
  } else {
    // ya contabilizado arriba en Margen Neto · evitar duplicación
    indicadoresTotal--;
  }

  // === 7. Inventario días (aprox) ===
  indicadoresTotal++;
  const cogs = estado.compras.total;
  const inventario = balance.activos.corriente.inventarios.totalValorPEN;
  const diasInv = cogs > 0 ? (inventario / cogs) * 30 : 0;
  if (diasInv > 0 && diasInv <= umbrales.diasInventarioMax) {
    indicadoresOK++;
    razones.push({
      polaridad: 'ok',
      titulo: 'Rotación inventario OK',
      valor: `${diasInv.toFixed(0)} días`,
      meta: `meta ≤${umbrales.diasInventarioMax} días`,
    });
  } else if (diasInv > 0) {
    razones.push({
      polaridad: 'warning',
      titulo: 'Inventario lento',
      valor: `${diasInv.toFixed(0)} días`,
      meta: `meta ≤${umbrales.diasInventarioMax} · stock muerto?`,
    });
    acciones.push('Revisar productos con baja rotación · considerar promociones para liquidar stock viejo.');
  } else {
    // Sin data suficiente
    indicadoresTotal--;
  }

  // === Determinar estado final ===
  let estadoFinal: EstadoNegocio;
  if (indicadoresCriticos > 0 || estado.utilidadNeta < 0) {
    estadoFinal = 'critico';
  } else if (indicadoresOK >= 5) {
    estadoFinal = 'saludable';
  } else if (indicadoresOK >= 3) {
    estadoFinal = 'atencion';
  } else {
    estadoFinal = 'critico';
  }

  return {
    estado: estadoFinal,
    razones,
    indicadoresOK,
    indicadoresTotal,
    acciones: acciones.length > 0 ? acciones : undefined,
  };
}

// ============================================================================
// INSIGHTS DEL MES
// ============================================================================

export type InsightPolaridad = 'positivo' | 'neutral' | 'atencion' | 'critico';

export interface Insight {
  id: string;
  polaridad: InsightPolaridad;
  /** Icon name de lucide-react · ej "trending-up" */
  iconName: string;
  /** Título corto declarativo */
  titulo: string;
  /** Descripción 1-2 líneas */
  descripcion: string;
  /** Cross-link contextual a otro módulo · opcional */
  crossLink?: {
    label: string;
    ruta: string;
  };
}

/**
 * Genera 4-6 insights automáticos del mes · reglas determinísticas
 */
export function generarInsightsMes(
  estado: EstadoResultados | null,
  balance: BalanceGeneral | null,
  mesAnterior: ResumenContable | null,
  tendencia: TendenciaMensual[],
  umbrales: UmbralesSalud = DEFAULT_UMBRALES,
): Insight[] {
  const insights: Insight[] = [];

  if (!estado || !balance) return insights;

  // === Insight 1 · Ventas vs mes anterior ===
  if (mesAnterior && mesAnterior.ventasNetas > 0) {
    const crecimiento = ((estado.ventasNetas - mesAnterior.ventasNetas) / mesAnterior.ventasNetas) * 100;
    if (crecimiento >= 10) {
      // Detectar si es récord del año
      const esRecord =
        tendencia.length > 0 &&
        estado.ventasNetas === Math.max(...tendencia.map((m) => m.ventasNetas));
      insights.push({
        id: 'ventas-crecimiento',
        polaridad: 'positivo',
        iconName: 'trending-up',
        titulo: esRecord
          ? `Récord de ventas del año · ${formatCurrency(estado.ventasNetas)} (+${crecimiento.toFixed(1)}% vs mes ant.)`
          : `Ventas crecieron +${crecimiento.toFixed(1)}% vs mes anterior`,
        descripcion: esRecord
          ? `El mejor mes en lo que va del año. ${estado.metricas.transacciones} transacciones · ticket promedio ${formatCurrency(estado.metricas.ticketPromedio)}.`
          : `Crecimiento sostenido · ${estado.metricas.transacciones} transacciones este mes.`,
      });
    } else if (crecimiento <= -10) {
      insights.push({
        id: 'ventas-caida',
        polaridad: 'atencion',
        iconName: 'trending-down',
        titulo: `Caída de ventas · ${crecimiento.toFixed(1)}% vs mes anterior`,
        descripcion: `Pasaste de ${formatCurrency(mesAnterior.ventasNetas)} a ${formatCurrency(estado.ventasNetas)}. Revisar canal · estacionalidad · competidores.`,
        crossLink: { label: 'Ver detalle en Ventas', ruta: '/ventas' },
      });
    }
  }

  // === Insight 2 · Margen bruto vs umbral ===
  const mb = estado.utilidadBrutaPorcentaje;
  if (mb >= umbrales.margenBrutoMin) {
    // Si subió vs mes anterior
    if (mesAnterior) {
      const mbAnt = mesAnterior.ventasNetas > 0
        ? ((mesAnterior.ventasNetas - mesAnterior.compras) / mesAnterior.ventasNetas) * 100
        : 0;
      const deltaMb = mb - mbAnt;
      if (Math.abs(deltaMb) >= 0.5) {
        insights.push({
          id: 'margen-bruto-trend',
          polaridad: deltaMb > 0 ? 'positivo' : 'atencion',
          iconName: 'zap',
          titulo: `Margen bruto ${deltaMb > 0 ? 'subió' : 'bajó'} ${Math.abs(deltaMb).toFixed(1)}pp · de ${mbAnt.toFixed(1)}% a ${mb.toFixed(1)}%`,
          descripcion: deltaMb > 0
            ? 'Buen control sobre costo de producto. Posible explicación: TC favorable · negociación con proveedores · mix de productos.'
            : 'Atención al costo de producto · revisar TC compras y mix de productos.',
        });
      }
    }
  } else {
    insights.push({
      id: 'margen-bruto-bajo',
      polaridad: 'atencion',
      iconName: 'alert-circle',
      titulo: `Margen bruto bajo · ${mb.toFixed(1)}% vs meta ${umbrales.margenBrutoMin}%`,
      descripcion: `Estás ${(umbrales.margenBrutoMin - mb).toFixed(1)}pp debajo del piso saludable. Revisar costos de compra y TC.`,
    });
  }

  // === Insight 3 · Gastos vs ventas (ratio) ===
  if (mesAnterior && mesAnterior.ventasNetas > 0) {
    const crecVentas = ((estado.ventasNetas - mesAnterior.ventasNetas) / mesAnterior.ventasNetas) * 100;
    const gastosOpAnt = mesAnterior.gastosOperativos ?? 0;
    if (gastosOpAnt > 0) {
      const crecGastos = ((estado.totalGastosOperativos - gastosOpAnt) / gastosOpAnt) * 100;
      if (crecGastos > crecVentas + 2) {
        insights.push({
          id: 'gastos-crecen-rapido',
          polaridad: 'atencion',
          iconName: 'alert-circle',
          titulo: `Gastos operativos crecen más rápido que ventas · +${crecGastos.toFixed(1)}% vs +${crecVentas.toFixed(1)}%`,
          descripcion: 'Vigilá el ratio gastos/ventas. Si sigue así, el margen neto bajará el próximo mes.',
          crossLink: { label: 'Ver detalle en Gastos', ruta: '/gastos' },
        });
      }
    }
  }

  // === Insight 4 · Anticipos clientes (pasivo cross-cutting) ===
  const anticipos = balance.pasivos.corriente.anticiposClientes?.totalAnticiposPEN ?? 0;
  const cantAnticipos = balance.pasivos.corriente.anticiposClientes?.cantidadVentas ?? 0;
  if (anticipos > 0 && cantAnticipos > 0) {
    insights.push({
      id: 'anticipos-pendientes',
      polaridad: 'atencion',
      iconName: 'clock',
      titulo: `${cantAnticipos} ventas con anticipo sin entregar · ${formatCurrency(anticipos)} pendientes`,
      descripcion: 'Clientes ya pagaron · falta entregar. Asegurate de tener stock para cumplir antes de generar nuevos anticipos.',
      crossLink: { label: 'Ver ventas pendientes', ruta: '/ventas' },
    });
  }

  // === Insight 5 · Deudas bajaron ===
  if (mesAnterior) {
    const deudasAnt = mesAnterior.utilidadNeta !== undefined && balance.pasivos.corriente.deudasFinancieras
      ? balance.pasivos.corriente.deudasFinancieras.total
      : 0;
    // Simplificado · solo si hay deudas actuales y son menores que algún valor previsible
    if (balance.pasivos.corriente.deudasFinancieras && balance.pasivos.corriente.deudasFinancieras.total > 0) {
      insights.push({
        id: 'deudas-activas',
        polaridad: 'neutral',
        iconName: 'credit-card',
        titulo: `Deudas financieras activas · ${formatCurrency(balance.pasivos.corriente.deudasFinancieras.total)}`,
        descripcion: 'Pagar deudas reduce el ratio de endeudamiento y mejora autonomía financiera.',
      });
    }
  }

  // === Insight 6 · Inventario sobre activo ===
  const inv = balance.activos.corriente.inventarios.totalValorPEN;
  const totalAct = balance.activos.totalActivos;
  if (totalAct > 0 && inv / totalAct > 0.6) {
    insights.push({
      id: 'capital-en-inventario',
      polaridad: 'neutral',
      iconName: 'package',
      titulo: `Inventario representa ${((inv / totalAct) * 100).toFixed(0)}% del activo · ${formatCurrency(inv)}`,
      descripcion: 'Normal en retail · vigilar que la proporción no crezca (más capital atrapado = menos flexibilidad).',
    });
  }

  // === Insight 7 · Mes con pérdida (siempre crítico al final) ===
  if (estado.utilidadNeta < 0) {
    insights.unshift({
      // unshift · va al principio (es lo más urgente)
      id: 'mes-perdida',
      polaridad: 'critico',
      iconName: 'alert-octagon',
      titulo: `Mes con pérdida · ${formatCurrency(estado.utilidadNeta)}`,
      descripcion: 'Utilidad neta negativa este mes. Revisar urgentemente costos · gastos · ventas.',
    });
  }

  // Limitar a 6 insights · sortear por prioridad implícita
  return insights.slice(0, 6);
}

// Helper local · formatCurrency mínimo para evitar import circular
function formatCurrency(v: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}
