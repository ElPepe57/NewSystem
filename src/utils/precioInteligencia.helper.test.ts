import { describe, it, expect } from 'vitest';
import { analizarPrecio, type AnalisisPrecioInput } from './precioInteligencia.helper';

const base = (p: Partial<AnalisisPrecioInput>): AnalisisPrecioInput => ({
  costoUnitarioUSD: 10,
  costoAdicionalPorUnidadUSD: 0,
  tc: 3.7,
  referencia: { ultimaCompra: null, promedio: null, nMuestras: 0 },
  investigacion: null,
  ...p,
});

describe('base de comparación unificada (fix bug #3 · crudo vs crudo)', () => {
  it('prefiere tu histórico (promedio) sobre el mercado', () => {
    const r = analizarPrecio(base({
      referencia: { ultimaCompra: 11, promedio: 10, nMuestras: 3 },
      investigacion: { precioMejorProvUSD: 8, precioEfectivo: 0, tieneProveedores: true, tieneCompetidores: false },
    }));
    expect(r.baseComparacionUSD).toBe(10);
    expect(r.fuenteBase).toBe('historico');
  });
  it('cae al mercado (mejor proveedor) si no hay histórico', () => {
    const r = analizarPrecio(base({
      investigacion: { precioMejorProvUSD: 8, precioEfectivo: 0, tieneProveedores: true, tieneCompetidores: false },
    }));
    expect(r.baseComparacionUSD).toBe(8);
    expect(r.fuenteBase).toBe('mercado');
  });
  it('sin referencia ni investigación → null + veredicto sin_referencia (no inventa)', () => {
    const r = analizarPrecio(base({ costoUnitarioUSD: 10 }));
    expect(r.baseComparacionUSD).toBeNull();
    expect(r.fuenteBase).toBe('ninguna');
    expect(r.veredicto).toBe('sin_referencia');
    expect(r.deltaPct).toBeNull();
  });
});

describe('veredicto del semáforo (delta vs base)', () => {
  const conBase = (costo: number) => analizarPrecio(base({
    costoUnitarioUSD: costo,
    referencia: { ultimaCompra: 10, promedio: 10, nMuestras: 2 },
  }));
  it('excelente cuando es ≥5% más barato', () => {
    const r = conBase(9); // -10%
    expect(r.deltaPct).toBe(-10);
    expect(r.veredicto).toBe('excelente');
  });
  it('en_rango cerca de tu base', () => {
    expect(conBase(10).veredicto).toBe('en_rango');   // 0%
    expect(conBase(10.3).veredicto).toBe('en_rango'); // +3%
  });
  it('caro entre +3% y +10%', () => {
    expect(conBase(10.5).veredicto).toBe('caro'); // +5%
  });
  it('no_recomendable por encima de +10%', () => {
    expect(conBase(12).veredicto).toBe('no_recomendable'); // +20%
  });
});

describe('margen LANDED en vivo (fix bugs #1 y #2 · PVP de investigación viva)', () => {
  it('landed incluye los cargos prorrateados · margen sobre el PVP efectivo', () => {
    const r = analizarPrecio(base({
      costoUnitarioUSD: 10,
      costoAdicionalPorUnidadUSD: 2,
      tc: 3.7,
      investigacion: { precioMejorProvUSD: 9, precioEfectivo: 60, tieneProveedores: true, tieneCompetidores: true },
    }));
    expect(r.landedUnitPEN).toBe(44.4);     // (10+2)*3.7
    expect(r.precioVentaPEN).toBe(60);
    expect(r.margenPct).toBe(26);           // (60-44.4)/60
  });
  it('margen null si no hay PVP (sin investigación viva)', () => {
    const r = analizarPrecio(base({ costoUnitarioUSD: 10, investigacion: null }));
    expect(r.precioVentaPEN).toBeNull();
    expect(r.margenPct).toBeNull();
    expect(r.landedUnitPEN).toBe(37);       // landed sí se computa
  });
});

describe('score holístico 40/30/20/10 (preservado · alimentado con valores vivos)', () => {
  it('score sin margen ni viabilidad (solo precio histórico + carga)', () => {
    // f1 precio: diff 0% vs promedio → s=75 (×40) · f3 carga: ratio 0 → s=70 (×20) · weight=60
    const r = analizarPrecio(base({
      costoUnitarioUSD: 10,
      referencia: { ultimaCompra: 10, promedio: 10, nMuestras: 2 },
    }));
    expect(r.score).toBe(73); // round((75*40 + 70*20)/60)
    expect(r.scoreTone).toBe('emerald');
  });
  it('score con margen (PVP vivo) sube el peso', () => {
    // f1=75×40 · f2 margen 38.3%→s=60×30 · f3=70×20 · weight=90
    const r = analizarPrecio(base({
      costoUnitarioUSD: 10,
      referencia: { ultimaCompra: 10, promedio: 10, nMuestras: 2 },
      investigacion: { precioMejorProvUSD: 0, precioEfectivo: 60, tieneProveedores: false, tieneCompetidores: true },
    }));
    expect(r.margenPct).toBe(38.3);
    expect(r.score).toBe(69); // round((75*40 + 60*30 + 70*20)/90)
  });
  it('score 0 → sin datos suficientes', () => {
    const r = analizarPrecio(base({ costoUnitarioUSD: 0 }));
    expect(r.score).toBe(0);
    expect(r.scoreLabel).toBe('Sin datos suficientes');
    expect(r.scoreTone).toBe('slate');
  });
  it('viabilidad suma como factor 10%', () => {
    const sinViab = analizarPrecio(base({ costoUnitarioUSD: 10, referencia: { ultimaCompra: 10, promedio: 10, nMuestras: 2 } }));
    const conViab = analizarPrecio(base({ costoUnitarioUSD: 10, referencia: { ultimaCompra: 10, promedio: 10, nMuestras: 2 }, puntuacionViabilidad: 80 }));
    expect(conViab.score).not.toBe(sinViab.score); // entra el factor 4
  });
});
