import { describe, it, expect } from 'vitest';
import { calcularUtilidad3Cajas, type VentaCaja } from './utilidadReal.utils';

describe('calcularUtilidad3Cajas · 3 cajas channel-aware', () => {
  it('mismo ingreso/costo pero ML carga comisión → utilidad ML < directa', () => {
    const ventas: VentaCaja[] = [
      { canal: 'CV-001', canalNombre: 'Directa', ingreso: 100, costoProducto: 40, gastoVenta: 0 },
      { canal: 'CV-002', canalNombre: 'ML', ingreso: 100, costoProducto: 40, gastoVenta: 13 },
    ];
    const r = calcularUtilidad3Cajas(ventas, 0);
    const directa = r.porCanal.find((c) => c.canal === 'CV-001')!;
    const ml = r.porCanal.find((c) => c.canal === 'CV-002')!;
    expect(directa.contribucion).toBeCloseTo(60); // 100 − 40 − 0
    expect(ml.contribucion).toBeCloseTo(47); // 100 − 40 − 13
    expect(ml.utilidadOperativa).toBeLessThan(directa.utilidadOperativa);
  });

  it('prorratea el gasto fijo del mes por % de ventas (Σ overhead == gastoFijoMes)', () => {
    const ventas: VentaCaja[] = [
      { canal: 'A', ingreso: 60, costoProducto: 0, gastoVenta: 0 },
      { canal: 'B', ingreso: 40, costoProducto: 0, gastoVenta: 0 },
    ];
    const r = calcularUtilidad3Cajas(ventas, 100);
    const a = r.porCanal.find((c) => c.canal === 'A')!;
    const b = r.porCanal.find((c) => c.canal === 'B')!;
    expect(a.overhead).toBeCloseTo(60); // 100 × 60/100
    expect(b.overhead).toBeCloseTo(40);
    expect(a.overhead + b.overhead).toBeCloseTo(100); // suma exacta el total del mes
    expect(r.total.overhead).toBeCloseTo(100);
  });

  it('el total reconcilia con la suma de los canales', () => {
    const ventas: VentaCaja[] = [
      { canal: 'A', ingreso: 100, costoProducto: 40, gastoVenta: 5 },
      { canal: 'B', ingreso: 200, costoProducto: 90, gastoVenta: 30 },
    ];
    const r = calcularUtilidad3Cajas(ventas, 50);
    const sumaUtil = r.porCanal.reduce((s, c) => s + c.utilidadOperativa, 0);
    expect(r.total.utilidadOperativa).toBeCloseTo(sumaUtil);
    expect(r.total.ingresos).toBeCloseTo(300);
    expect(r.total.ctru).toBeCloseTo(130);
  });

  it('PERDEDOR OCULTO: pierde en ML, gana en directa → abierto, no promediado', () => {
    const ventas: VentaCaja[] = [
      { canal: 'ML', ingreso: 50, costoProducto: 40, gastoVenta: 13 }, // contrib −3
      { canal: 'Directa', ingreso: 60, costoProducto: 40, gastoVenta: 0 }, // contrib +20
    ];
    const r = calcularUtilidad3Cajas(ventas, 0);
    expect(r.porCanal.find((c) => c.canal === 'ML')!.contribucion).toBeCloseTo(-3);
    expect(r.porCanal.find((c) => c.canal === 'Directa')!.contribucion).toBeCloseTo(20);
  });

  it('sin ventas → sin división por cero, overhead 0', () => {
    const r = calcularUtilidad3Cajas([], 100);
    expect(r.total.ingresos).toBe(0);
    expect(r.total.overhead).toBe(0); // no hay ventas para prorratear
    expect(r.total.margenOperativoPct).toBe(0);
  });

  it('agrupa varias ventas del mismo canal', () => {
    const ventas: VentaCaja[] = [
      { canal: 'A', ingreso: 50, costoProducto: 20, gastoVenta: 5 },
      { canal: 'A', ingreso: 50, costoProducto: 20, gastoVenta: 5 },
    ];
    const r = calcularUtilidad3Cajas(ventas, 0);
    expect(r.porCanal).toHaveLength(1);
    expect(r.porCanal[0].ingresos).toBe(100);
    expect(r.porCanal[0].contribucion).toBeCloseTo(50); // 100 − 40 − 10
  });
});
