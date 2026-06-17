import { describe, it, expect } from 'vitest';
import { calcularCurvaRecuperacion, filtrarVentanaMeses, type VentaRecuperacion } from './recuperacion.utils';

function venta(fecha: string, cantidad: number, contribucionUnitaria: number, costoUnitario = 30): VentaRecuperacion {
  return { fecha: new Date(fecha), cantidad, contribucionUnitaria, costoUnitario };
}

describe('calcularCurvaRecuperacion', () => {
  it('acumula la contribución y calcula %recuperado / por recuperar', () => {
    const c = calcularCurvaRecuperacion([venta('2026-01-01', 1, 40), venta('2026-02-01', 1, 40)], 100);
    expect(c.totalRecuperado).toBeCloseTo(80);
    expect(c.pctRecuperado).toBeCloseTo(80);
    expect(c.porRecuperar).toBeCloseTo(20);
    expect(c.puntos[0].acumulado).toBeCloseTo(40);
    expect(c.puntos[1].acumulado).toBeCloseTo(80);
  });

  it('detecta el break-even (primer punto donde acumulado ≥ base)', () => {
    const c = calcularCurvaRecuperacion(
      [venta('2026-01-01', 1, 40), venta('2026-02-01', 1, 40), venta('2026-03-01', 1, 40)],
      100,
    );
    expect(c.breakEvenIndex).toBe(2); // 40+40+40=120 ≥ 100 en el 3er punto (idx 2)
    expect(c.breakEvenFecha).toEqual(new Date('2026-03-01'));
    expect(c.pctRecuperado).toBeCloseTo(120);
  });

  it('no marca break-even si nunca cubre la base', () => {
    const c = calcularCurvaRecuperacion([venta('2026-01-01', 1, 30)], 100);
    expect(c.breakEvenIndex).toBeNull();
    expect(c.porRecuperar).toBeCloseTo(70);
  });

  it('EXCLUYE ventas sin costo asignado (costoUnitario ≤ 0) y las reporta (no es 100%)', () => {
    const c = calcularCurvaRecuperacion(
      [venta('2026-01-01', 1, 40, 30), venta('2026-02-01', 1, 50, 0)],
      100,
    );
    expect(c.ventasSinCosto).toBe(1);
    expect(c.puntos).toHaveLength(1);          // solo la válida entra a la curva
    expect(c.totalRecuperado).toBeCloseTo(40); // NO suma la de costo 0 (que la inflaría a 90)
  });

  it('ordena ASC por fecha aunque entren desordenadas', () => {
    const c = calcularCurvaRecuperacion(
      [venta('2026-03-01', 1, 10), venta('2026-01-01', 1, 20), venta('2026-02-01', 1, 30)],
      100,
    );
    expect(c.puntos.map((p) => p.contribucionVenta)).toEqual([20, 30, 10]); // ene, feb, mar
  });

  it('base 0 → pct 0 sin división por cero', () => {
    const c = calcularCurvaRecuperacion([venta('2026-01-01', 1, 40)], 0);
    expect(c.pctRecuperado).toBe(0);
    expect(c.breakEvenIndex).toBeNull();
  });

  it('multiplica la contribución unitaria por la cantidad', () => {
    const c = calcularCurvaRecuperacion([venta('2026-01-01', 5, 10)], 100);
    expect(c.totalRecuperado).toBeCloseTo(50); // 10 × 5
  });
});

describe('filtrarVentanaMeses', () => {
  it('recorta a los últimos N meses desde la fecha de referencia', () => {
    const ahora = new Date('2026-06-15');
    const ventas = [
      { fecha: new Date('2025-11-01') }, // 7 meses atrás → fuera
      { fecha: new Date('2026-01-01') }, // dentro de 6m
      { fecha: new Date('2026-06-01') }, // dentro
    ];
    expect(filtrarVentanaMeses(ventas, 6, ahora)).toHaveLength(2);
  });

  it('descarta ventas sin fecha', () => {
    const ahora = new Date('2026-06-15');
    expect(filtrarVentanaMeses([{ fecha: null }, { fecha: new Date('2026-06-01') }], 6, ahora)).toHaveLength(1);
  });
});
