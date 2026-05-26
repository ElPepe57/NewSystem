/**
 * planillaAnalytics.service.ts
 *
 * chk5.PERSONAS-v5.4 · F3 · 2026-05-26
 *
 * Agregaciones para el tab "Análisis y Reportes" del módulo Planilla.
 *
 * Vistas cubiertas:
 *  - Costo laboral mensual (12-24 meses · serie temporal)
 *  - Distribución por departamento (donut)
 *  - Impacto en cash flow (próximos 30/60/90 días)
 *  - Top empleados por bonos del año
 *  - Variación salarial histórica del sistema
 *
 * Este service es 100% LECTURA · no escribe a Firestore. Consume boletas,
 * cálculos, liquidaciones, gratificaciones y los agrega.
 */

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type {
  Boleta,
  CalculoIncentivoMes,
  Gratificacion,
  LiquidacionEmpleado,
  HistorialSalarial,
  TipoIncentivo,
} from '../types/planilla.types';

// ============================================
// HELPERS
// ============================================

function colRef(name: string) {
  return collection(db, name);
}

interface RangoMeses {
  desde: { mes: number; anio: number };
  hasta: { mes: number; anio: number };
}

/** Convierte mes/anio a un número ordenado para sort (YYYYMM) */
function mesId(mes: number, anio: number): number {
  return anio * 100 + mes;
}

// ============================================
// TIPOS DE RESULTADO
// ============================================

export interface CostoLaboralMensual {
  mes: number;
  anio: number;
  totalBoletas: number;          // suma de totalNeto
  totalBonos: number;             // suma de bonificacionesIncentivo
  totalGratificaciones: number;   // suma de gratificación si aplica
  totalLiquidaciones: number;     // suma de bajas pagadas en el mes
  totalCostoLaboral: number;      // boletas + bonos + grat + liq
  cantidadEmpleados: number;
}

export interface DistribucionDepartamento {
  departamento: string;           // cargo o departamento
  cantidadEmpleados: number;
  costoTotalPEN: number;
  pctDelTotal: number;
}

export interface ProximoCompromisoPlanilla {
  fechaProyectada: Date;
  concepto: string;               // "Boletas marzo" · "Gratificación julio" · etc
  montoEstimadoPEN: number;
  tipo: 'boleta' | 'adelanto' | 'gratificacion' | 'liquidacion' | 'bono';
}

export interface TopEmpleadoBonos {
  userId: string;
  empleadoNombre: string;
  totalBonosPEN: number;
  cantidadBonos: number;
  porTipo: Record<TipoIncentivo, number>;
}

// ============================================
// SERVICE
// ============================================

export const planillaAnalyticsService = {
  /**
   * Serie temporal de costo laboral por mes (default últimos 12 meses).
   * Para gráfica "Costo laboral mensual" en tab Análisis y Reportes.
   */
  async costoLaboralPorMes(meses: number = 12): Promise<CostoLaboralMensual[]> {
    const ahora = new Date();
    const desde = new Date(ahora.getFullYear(), ahora.getMonth() - (meses - 1), 1);
    const desdeTs = Timestamp.fromDate(desde);

    // Boletas: cargar todas las del rango
    const boletasSnap = await getDocs(
      query(colRef(COLLECTIONS.BOLETAS), orderBy('fechaCreacion', 'desc')),
    );
    const boletas = boletasSnap.docs
      .map((d) => d.data() as Boleta)
      .filter((b) => b.fechaCreacion.toMillis() >= desdeTs.toMillis());

    // Gratificaciones del rango
    const gratSnap = await getDocs(colRef(COLLECTIONS.GRATIFICACIONES));
    const gratificaciones = gratSnap.docs
      .map((d) => d.data() as Gratificacion)
      .filter((g) => mesId(g.mes, g.anio) >= mesId(desde.getMonth() + 1, desde.getFullYear()));

    // Liquidaciones pagadas del rango
    const liqSnap = await getDocs(
      query(colRef(COLLECTIONS.LIQUIDACIONES_EMPLEADO), where('estado', '==', 'pagada')),
    );
    const liquidaciones = liqSnap.docs
      .map((d) => d.data() as LiquidacionEmpleado)
      .filter((l) => l.fechaEfectiva.toMillis() >= desdeTs.toMillis());

    // Agrupar por mes/año
    const mapa = new Map<number, CostoLaboralMensual>();

    boletas.forEach((b) => {
      const k = mesId(b.mes, b.anio);
      const prev = mapa.get(k) ?? {
        mes: b.mes,
        anio: b.anio,
        totalBoletas: 0,
        totalBonos: 0,
        totalGratificaciones: 0,
        totalLiquidaciones: 0,
        totalCostoLaboral: 0,
        cantidadEmpleados: 0,
      };
      prev.totalBoletas += b.totalNeto;
      // Bonos: si existe el campo nuevo bonificacionesIncentivo lo sumamos · si no, usamos b.bonificaciones
      const extra: any = b;
      if (Array.isArray(extra.bonificacionesIncentivo)) {
        prev.totalBonos += (extra.bonificacionesIncentivo as Array<{ montoBruto: number }>).reduce(
          (s, x) => s + x.montoBruto,
          0,
        );
      } else {
        prev.totalBonos += b.bonificaciones;
      }
      prev.cantidadEmpleados += 1;
      mapa.set(k, prev);
    });

    gratificaciones.forEach((g) => {
      const k = mesId(g.mes, g.anio);
      const prev = mapa.get(k) ?? {
        mes: g.mes,
        anio: g.anio,
        totalBoletas: 0,
        totalBonos: 0,
        totalGratificaciones: 0,
        totalLiquidaciones: 0,
        totalCostoLaboral: 0,
        cantidadEmpleados: 0,
      };
      prev.totalGratificaciones += g.montoCalculado;
      mapa.set(k, prev);
    });

    liquidaciones.forEach((l) => {
      const d = l.fechaEfectiva.toDate();
      const mes = d.getMonth() + 1;
      const anio = d.getFullYear();
      const k = mesId(mes, anio);
      const prev = mapa.get(k) ?? {
        mes,
        anio,
        totalBoletas: 0,
        totalBonos: 0,
        totalGratificaciones: 0,
        totalLiquidaciones: 0,
        totalCostoLaboral: 0,
        cantidadEmpleados: 0,
      };
      prev.totalLiquidaciones += l.netoALiquidar;
      mapa.set(k, prev);
    });

    // Cerrar totales
    Array.from(mapa.values()).forEach((v) => {
      v.totalCostoLaboral =
        v.totalBoletas + v.totalBonos + v.totalGratificaciones + v.totalLiquidaciones;
    });

    return Array.from(mapa.values()).sort(
      (a, b) => mesId(a.mes, a.anio) - mesId(b.mes, b.anio),
    );
  },

  /**
   * Distribución por departamento/cargo del último mes con boletas.
   * Para donut "Costo por departamento".
   */
  async distribucionDepartamentoMes(
    mes: number,
    anio: number,
  ): Promise<DistribucionDepartamento[]> {
    const snap = await getDocs(
      query(
        colRef(COLLECTIONS.BOLETAS),
        where('mes', '==', mes),
        where('anio', '==', anio),
      ),
    );
    const boletas = snap.docs.map((d) => d.data() as Boleta);

    const mapa = new Map<string, { cantidad: number; total: number }>();
    boletas.forEach((b) => {
      const dep = b.empleadoCargo ?? 'Sin departamento';
      const prev = mapa.get(dep) ?? { cantidad: 0, total: 0 };
      prev.cantidad += 1;
      prev.total += b.totalNeto;
      mapa.set(dep, prev);
    });

    const totalGlobal = Array.from(mapa.values()).reduce((s, v) => s + v.total, 0);
    return Array.from(mapa.entries())
      .map(([departamento, v]) => ({
        departamento,
        cantidadEmpleados: v.cantidad,
        costoTotalPEN: v.total,
        pctDelTotal: totalGlobal > 0 ? (v.total / totalGlobal) * 100 : 0,
      }))
      .sort((a, b) => b.costoTotalPEN - a.costoTotalPEN);
  },

  /**
   * Top N empleados por bonos del año.
   * Para tab Análisis y Reportes · ranking.
   */
  async topEmpleadosBonosAnio(anio: number, limite: number = 10): Promise<TopEmpleadoBonos[]> {
    const snap = await getDocs(
      query(
        colRef(COLLECTIONS.CALCULOS_INCENTIVO),
        where('anio', '==', anio),
        where('estado', '==', 'incluido_en_boleta'),
      ),
    );
    const calculos = snap.docs.map((d) => d.data() as CalculoIncentivoMes);

    const mapa = new Map<string, TopEmpleadoBonos>();
    calculos.forEach((c) => {
      const prev = mapa.get(c.userId) ?? {
        userId: c.userId,
        empleadoNombre: c.empleadoNombre,
        totalBonosPEN: 0,
        cantidadBonos: 0,
        porTipo: {
          comision: 0,
          bono_meta: 0,
          bono_kpi: 0,
          bono_fijo: 0,
        },
      };
      const monto = c.moneda === 'PEN' ? c.bonoCalculado : c.bonoCalculado;
      prev.totalBonosPEN += monto;
      prev.cantidadBonos += 1;
      prev.porTipo[c.esquemaTipo] += monto;
      mapa.set(c.userId, prev);
    });

    return Array.from(mapa.values())
      .sort((a, b) => b.totalBonosPEN - a.totalBonosPEN)
      .slice(0, limite);
  },

  /**
   * Próximos compromisos de planilla (estimación).
   * Para banner "Próximo pago planilla" en /finanzas/cash-flow y para el
   * cross-link 360 sky.
   *
   * Heurística simple v1:
   *  - Día 30 del mes actual: boletas estimadas (promedio últimos 3 meses)
   *  - Si estamos en junio: julio = gratificación
   *  - Si estamos en noviembre: diciembre = gratificación
   *  - Liquidaciones en estado 'aprobada' = compromiso inmediato
   */
  async proximosCompromisos(): Promise<ProximoCompromisoPlanilla[]> {
    const compromisos: ProximoCompromisoPlanilla[] = [];
    const ahora = new Date();

    // Estimación próxima boleta: promedio de últimas 3 boletas
    const serie = await this.costoLaboralPorMes(3);
    if (serie.length > 0) {
      const promedio =
        serie.reduce((s, m) => s + m.totalBoletas, 0) / serie.length;
      const proximaBoleta = new Date(
        ahora.getFullYear(),
        ahora.getMonth(),
        Math.min(30, new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate()),
      );
      compromisos.push({
        fechaProyectada: proximaBoleta,
        concepto: `Boletas ${proximaBoleta.toLocaleDateString('es-PE', {
          month: 'long',
          year: 'numeric',
        })}`,
        montoEstimadoPEN: promedio,
        tipo: 'boleta',
      });
    }

    // Gratificación próxima (jul / dic)
    const mesActual = ahora.getMonth() + 1;
    if (mesActual === 6) {
      compromisos.push({
        fechaProyectada: new Date(ahora.getFullYear(), 6, 15),
        concepto: 'Gratificación Julio',
        montoEstimadoPEN: 0, // se calcula al crear gratificaciones reales
        tipo: 'gratificacion',
      });
    } else if (mesActual === 11) {
      compromisos.push({
        fechaProyectada: new Date(ahora.getFullYear(), 11, 15),
        concepto: 'Gratificación Diciembre',
        montoEstimadoPEN: 0,
        tipo: 'gratificacion',
      });
    }

    // Liquidaciones aprobadas pendientes pago
    const liqSnap = await getDocs(
      query(colRef(COLLECTIONS.LIQUIDACIONES_EMPLEADO), where('estado', '==', 'aprobada')),
    );
    liqSnap.docs.forEach((d) => {
      const l = d.data() as LiquidacionEmpleado;
      compromisos.push({
        fechaProyectada: l.fechaEfectiva.toDate(),
        concepto: `Liquidación ${l.empleadoNombre} (${l.tipoBaja})`,
        montoEstimadoPEN: l.netoALiquidar,
        tipo: 'liquidacion',
      });
    });

    return compromisos.sort(
      (a, b) => a.fechaProyectada.getTime() - b.fechaProyectada.getTime(),
    );
  },

  /**
   * Variación salarial histórica del sistema · últimas N (default 20).
   */
  async ultimasVariacionesSalariales(limite: number = 20): Promise<HistorialSalarial[]> {
    const snap = await getDocs(
      query(colRef(COLLECTIONS.HISTORIAL_SALARIAL), orderBy('fechaRegistro', 'desc')),
    );
    return snap.docs.slice(0, limite).map((d) => d.data() as HistorialSalarial);
  },
};
