import { describe, it, expect } from 'vitest';
import { distributeOrigenes } from './ocBuilderUtils';
import type { ProductoOrigen } from './ocBuilderTypes';

const origen = (id: string, cantidad: number): ProductoOrigen => ({
  requerimientoId: id,
  requerimientoNumero: id,
  cantidad,
});

const sum = (os: ProductoOrigen[]) => os.reduce((s, o) => s + o.cantidad, 0);

describe('distributeOrigenes · reparto justo del redondeo (BUG-3)', () => {
  it('un solo origen recibe toda la cantidad asignada', () => {
    expect(distributeOrigenes([origen('A', 10)], 7, 10)).toEqual([origen('A', 7)]);
  });

  it('la suma SIEMPRE es exactamente la cantidad asignada (invariante)', () => {
    const casos: Array<[ProductoOrigen[], number, number]> = [
      [[origen('A', 10), origen('B', 10)], 15, 20],
      [[origen('A', 10), origen('B', 10), origen('C', 10)], 20, 30],
      [[origen('A', 1), origen('B', 1), origen('C', 28)], 15, 30],
      [[origen('A', 7), origen('B', 13), origen('C', 5)], 11, 25],
      [[origen('A', 3), origen('B', 3), origen('C', 3), origen('D', 3)], 7, 12],
    ];
    for (const [os, cant, total] of casos) {
      expect(sum(distributeOrigenes(os, cant, total))).toBe(cant);
    }
  });

  it('NO vuelca el remanente en el último origen (el skew que arregla BUG-3)', () => {
    // [1,1,28]/30 → 15. El viejo (último absorbe) daba C=13 (subvaluado);
    // el reparto justo respeta la proporción: C (el grande) se lleva 14.
    const r = distributeOrigenes([origen('A', 1), origen('B', 1), origen('C', 28)], 15, 30);
    expect(r.find(o => o.requerimientoId === 'C')!.cantidad).toBe(14);
    expect(sum(r)).toBe(15);
  });

  it('reparte de a una unidad por mayor parte fraccionaria (Hamilton)', () => {
    // [10,10]/20 → 15: 7.5 c/u, el +1 va al de mayor fracción (empate → primero).
    expect(distributeOrigenes([origen('A', 10), origen('B', 10)], 15, 20))
      .toEqual([origen('A', 8), origen('B', 7)]);
  });

  it('cada origen queda a menos de 1 unidad de su cuota exacta', () => {
    const os = [origen('A', 7), origen('B', 13), origen('C', 5)];
    const cant = 11, total = 25;
    distributeOrigenes(os, cant, total).forEach((o, i) => {
      const exacta = os[i].cantidad * (cant / total);
      expect(Math.abs(o.cantidad - exacta)).toBeLessThan(1);
    });
  });

  it('totalOriginal <= 0 → todos en 0 (sin división por cero)', () => {
    const r = distributeOrigenes([origen('A', 5), origen('B', 5)], 10, 0);
    expect(r.every(o => o.cantidad === 0)).toBe(true);
  });
});
