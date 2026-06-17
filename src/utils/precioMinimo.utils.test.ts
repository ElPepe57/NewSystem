import { describe, it, expect } from 'vitest';
import { calcPisoCanal, buildPisosPorCanal } from './precioMinimo.utils';

describe('calcPisoCanal · piso por canal', () => {
  it("don't-lose (margen 0) sin comisión = CTRU exacto", () => {
    expect(calcPisoCanal({ ctru: 40, comisionFraccion: 0 })).toBeCloseTo(40);
  });

  it("don't-lose con comisión ML 13% SUBE el piso por el sangrado de comisión", () => {
    // 40 / (1 - 0.13) = 45.977
    expect(calcPisoCanal({ ctru: 40, comisionFraccion: 0.13 })).toBeCloseTo(40 / 0.87, 4);
  });

  it('margen objetivo sin comisión == fórmula legacy CTRU/(1-margen)', () => {
    // 40 / (1 - 0.20) = 50
    expect(calcPisoCanal({ ctru: 40, comisionFraccion: 0, margenObjetivoFraccion: 0.2 })).toBeCloseTo(50);
  });

  it('ML piso > Directa para el mismo producto y margen (la comisión sube el piso)', () => {
    const ml = calcPisoCanal({ ctru: 40, comisionFraccion: 0.13, margenObjetivoFraccion: 0.2 });
    const directa = calcPisoCanal({ ctru: 40, comisionFraccion: 0, margenObjetivoFraccion: 0.2 });
    expect(ml).toBeGreaterThan(directa);
  });

  it('suma el costo de envío fijo del canal', () => {
    // (40 + 5) / 0.87
    expect(calcPisoCanal({ ctru: 40, comisionFraccion: 0.13, costoEnvioFijo: 5 })).toBeCloseTo(45 / 0.87, 4);
  });

  it('margen inalcanzable (comisión + margen ≥ 1) → Infinity', () => {
    expect(calcPisoCanal({ ctru: 40, comisionFraccion: 0.9, margenObjetivoFraccion: 0.2 })).toBe(Infinity);
  });

  it("INVARIANTE: vender al piso don't-lose deja contribución ≈ 0 (la fórmula cierra)", () => {
    const ctru = 40;
    const c = 0.13;
    const piso = calcPisoCanal({ ctru, comisionFraccion: c });
    const contribucion = piso * (1 - c) - ctru; // sin envío
    expect(contribucion).toBeCloseTo(0, 6);
  });
});

describe('buildPisosPorCanal · matriz por canal', () => {
  const canales = [
    { id: 'CV-001', nombre: 'Venta Directa', comisionPorcentaje: 0 },
    { id: 'CV-002', nombre: 'Mercado Libre', comisionPorcentaje: 13 },
  ];

  it('normaliza comisionPorcentaje 0-100 → fracción y produce la matriz', () => {
    const pisos = buildPisosPorCanal(40, canales);
    const directa = pisos.find((p) => p.canalId === 'CV-001')!;
    const ml = pisos.find((p) => p.canalId === 'CV-002')!;

    expect(directa.pisoAbsoluto).toBeCloseTo(40); // sin comisión = CTRU
    expect(ml.pisoAbsoluto).toBeGreaterThan(directa.pisoAbsoluto); // ML > Directa
    expect(ml.piso20).toBeCloseTo(40 / (1 - 0.13 - 0.2)); // 40 / 0.67
    expect(ml.comisionPct).toBe(13); // preserva el 0-100 para display
  });

  it('canal sin comisión reproduce los 3 pisos legacy 10/20/30', () => {
    const [directa] = buildPisosPorCanal(100, [{ id: 'CV-001', nombre: 'Directa', comisionPorcentaje: 0 }]);
    expect(directa.piso10).toBeCloseTo(100 / 0.9);
    expect(directa.piso20).toBeCloseTo(100 / 0.8);
    expect(directa.piso30).toBeCloseTo(100 / 0.7);
  });
});
