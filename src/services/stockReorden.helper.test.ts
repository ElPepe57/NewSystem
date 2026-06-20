import { describe, it, expect } from 'vitest';
import {
  evaluarReorden,
  generarAlertasReposicion,
  velocidadRobusta,
  desviacionEstandar,
  POLITICA_REORDEN_DEFAULT,
  type ReordenInput,
} from './stockReorden.helper';

/** Base sana: best-seller con buen historial y lead time conocido. */
function base(overrides: Partial<ReordenInput> = {}): ReordenInput {
  return {
    productoId: 'p1',
    sku: 'SKU1',
    nombreComercial: 'Crema A',
    marca: 'Vita',
    stockDisponible: 100,
    stockTotal: 100,
    velocidadDiaria: 2,
    unidadesVendidas90d: 180,
    clasificacionRotacion: 'alta',
    leadTimeDias: 30,
    leadTimeDesviacionDias: 5,
    leadTimeMuestras: 4,
    demandaComprometida: 0,
    ...overrides,
  };
}

describe('evaluarReorden · gate de señal real', () => {
  it('producto sin historial de ventas NI stock NO alerta (la queja del usuario)', () => {
    const r = evaluarReorden(base({
      stockDisponible: 0, stockTotal: 0, velocidadDiaria: 0, unidadesVendidas90d: 0,
    }));
    expect(r.tieneSenalReal).toBe(false);
    expect(r.necesitaReposicion).toBe(false);
    expect(r.cantidadSugerida).toBe(0);
  });

  it('producto sin ventas pero con stock + rotación efectiva SÍ tiene señal', () => {
    const r = evaluarReorden(base({ unidadesVendidas90d: 0, velocidadDiaria: 1, stockTotal: 10 }));
    expect(r.tieneSenalReal).toBe(true);
  });

  it('producto nuevo sin decisión (stock 0, ventas 0, velocidad 0) nunca entra a las alertas', () => {
    const alertas = generarAlertasReposicion([
      base({ productoId: 'nuevo', stockDisponible: 0, stockTotal: 0, velocidadDiaria: 0, unidadesVendidas90d: 0 }),
    ]);
    expect(alertas).toHaveLength(0);
  });
});

describe('evaluarReorden · punto de reorden y stock de seguridad', () => {
  it('best-seller bajo el reorden necesita reposición', () => {
    // reorden = 2×30 + SS. SS = 1.65×2×5 = 16.5 → 17. reorden ≈ 77.
    const r = evaluarReorden(base({ stockDisponible: 40 }));
    expect(r.puntoReorden).toBeGreaterThan(70);
    expect(r.stockSeguridad).toBe(Math.ceil(1.65 * 2 * 5));
    expect(r.necesitaReposicion).toBe(true);
    expect(r.cantidadSugerida).toBeGreaterThanOrEqual(POLITICA_REORDEN_DEFAULT.cantidadMinima);
  });

  it('stock holgado por encima del reorden NO necesita reposición', () => {
    const r = evaluarReorden(base({ stockDisponible: 500 }));
    expect(r.necesitaReposicion).toBe(false);
    expect(r.urgencia).toBe('baja');
  });

  it('reemplaza el umbral fijo: NO usa stockMinimo||5, usa velocidad×leadTime', () => {
    const r = evaluarReorden(base({ stockDisponible: 40 }));
    // con el umbral viejo (5), stock 40 jamás alertaría; con ROP real (~77) sí.
    expect(r.puntoReorden).not.toBe(5);
    expect(r.necesitaReposicion).toBe(true);
  });
});

describe('evaluarReorden · stock de seguridad DIFERENCIADO por rotación', () => {
  it('best-seller (muy_alta) tiene más stock de seguridad que nicho (baja) con mismos números', () => {
    const bestSeller = evaluarReorden(base({ clasificacionRotacion: 'muy_alta' }));
    const nicho = evaluarReorden(base({ clasificacionRotacion: 'baja' }));
    expect(bestSeller.stockSeguridad).toBeGreaterThan(nicho.stockSeguridad);
    // Z 1.65 vs 1.04
    expect(bestSeller.stockSeguridad).toBe(Math.ceil(1.65 * 2 * 5));
    expect(nicho.stockSeguridad).toBe(Math.ceil(1.04 * 2 * 5));
  });
});

describe('evaluarReorden · demanda comprometida netea el stock', () => {
  it('la demanda comprometida reduce el stock neto y puede gatillar la alerta', () => {
    const sin = evaluarReorden(base({ stockDisponible: 90, demandaComprometida: 0 }));
    const con = evaluarReorden(base({ stockDisponible: 90, demandaComprometida: 60 }));
    expect(con.stockNeto).toBe(30);
    expect(con.stockNeto).toBeLessThan(sin.stockNeto);
    expect(con.necesitaReposicion).toBe(true);
  });

  it('si el comprometido excede el disponible → crítica y razón específica', () => {
    const r = evaluarReorden(base({ stockDisponible: 10, demandaComprometida: 25 }));
    expect(r.stockNeto).toBe(-15);
    expect(r.urgencia).toBe('critica');
    expect(r.razon).toMatch(/comprometido excede/i);
  });
});

describe('evaluarReorden · lead time sin historial', () => {
  it('sin muestras de OC usa lead time default + desviación fallback (50%)', () => {
    const r = evaluarReorden(base({ leadTimeDias: 0, leadTimeMuestras: 0, leadTimeDesviacionDias: 0, stockDisponible: 10 }));
    expect(r.leadTimeDias).toBe(POLITICA_REORDEN_DEFAULT.leadTimeDefaultDias);
    // SS = z × vel × (leadTimeDefault × 0.5) = 1.65 × 2 × 15
    expect(r.stockSeguridad).toBe(Math.ceil(1.65 * 2 * (30 * 0.5)));
  });
});

describe('evaluarReorden · override manual', () => {
  it('toma el MAYOR entre el reorden calculado y el mínimo manual', () => {
    const calc = evaluarReorden(base({ stockDisponible: 200, stockMinimoManual: undefined }));
    const manual = evaluarReorden(base({ stockDisponible: 200, stockMinimoManual: 999 }));
    expect(manual.puntoReorden).toBe(Math.max(calc.puntoReorden, 999));
    expect(manual.necesitaReposicion).toBe(true); // 200 < 999
  });
});

describe('evaluarReorden · urgencia por cobertura', () => {
  it('crítica cuando la cobertura no alcanza al lead time', () => {
    // vel 2, stock 40 → cobertura 20d < leadTime 30 → critica
    const r = evaluarReorden(base({ stockDisponible: 40 }));
    expect(r.urgencia).toBe('critica');
  });

  it('stock 0 → crítica', () => {
    const r = evaluarReorden(base({ stockDisponible: 0 }));
    expect(r.urgencia).toBe('critica');
    expect(r.razon).toMatch(/sin stock/i);
  });
});

describe('generarAlertasReposicion · filtra y ordena', () => {
  it('solo devuelve las que necesitan reposición, ordenadas por prioridad', () => {
    const alertas = generarAlertasReposicion([
      base({ productoId: 'sano', stockDisponible: 1000 }),         // no necesita
      base({ productoId: 'critico', stockDisponible: 0 }),         // critica
      base({ productoId: 'medio', stockDisponible: 70, clasificacionRotacion: 'media' }),
      base({ productoId: 'fantasma', stockDisponible: 0, stockTotal: 0, velocidadDiaria: 0, unidadesVendidas90d: 0 }), // gate
    ]);
    const ids = alertas.map(a => a.productoId);
    expect(ids).not.toContain('sano');
    expect(ids).not.toContain('fantasma');
    expect(ids).toContain('critico');
    // ordenado desc por score
    for (let i = 1; i < alertas.length; i++) {
      expect(alertas[i - 1].scorePrioridad).toBeGreaterThanOrEqual(alertas[i].scorePrioridad);
    }
  });
});

describe('helpers estadísticos', () => {
  it('velocidadRobusta toma la mayor entre ventana corta y larga', () => {
    expect(velocidadRobusta(0, 90)).toBe(1);     // 30d=0 pero 90d=1/día → 1
    expect(velocidadRobusta(60, 90)).toBe(2);    // 30d=2/día gana
  });

  it('desviacionEstandar calcula correctamente', () => {
    expect(desviacionEstandar([])).toBe(0);
    expect(desviacionEstandar([10, 10, 10])).toBe(0);
    expect(Math.round(desviacionEstandar([10, 20, 30]))).toBe(8); // ~8.16
  });
});
