import { describe, it, expect } from 'vitest';
import { getCTRU, getTC, getCostoBasePEN, getCTRU_Real, calcularGAGOProporcional } from './ctru.utils';

// ---------------------------------------------------------------------------
// getTC
// ---------------------------------------------------------------------------
describe('getTC', () => {
  it('retorna tcPago cuando ambos TC están presentes', () => {
    expect(getTC({ tcPago: 3.85, tcCompra: 3.70 })).toBe(3.85);
  });

  it('retorna tcCompra cuando tcPago es undefined', () => {
    expect(getTC({ tcPago: undefined, tcCompra: 3.70 })).toBe(3.70);
  });

  it('retorna tcCompra cuando tcPago es 0', () => {
    expect(getTC({ tcPago: 0, tcCompra: 3.70 })).toBe(3.70);
  });

  it('retorna 0 cuando ningún TC está disponible', () => {
    expect(getTC({ tcPago: undefined, tcCompra: undefined })).toBe(0);
  });

  it('retorna 0 cuando ambos son 0', () => {
    expect(getTC({ tcPago: 0, tcCompra: 0 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getCostoBasePEN
// ---------------------------------------------------------------------------
describe('getCostoBasePEN', () => {
  it('usa ctruInicial cuando no hay flete y ctruInicial existe', () => {
    const unidad = {
      ctruInicial: 400,
      costoUnitarioUSD: 100,
      costoFleteUSD: 0,
      tcPago: 3.80,
      tcCompra: undefined as number | undefined,
    };
    expect(getCostoBasePEN(unidad)).toBe(400);
  });

  it('calcula (costoUSD + flete) × TC cuando hay flete', () => {
    const unidad = {
      ctruInicial: 300,     // valor obsoleto, pre-flete
      costoUnitarioUSD: 100,
      costoFleteUSD: 20,
      tcPago: 3.80,
      tcCompra: undefined as number | undefined,
    };
    // (100 + 20) × 3.80 = 456
    expect(getCostoBasePEN(unidad)).toBeCloseTo(456);
  });

  it('calcula costoUSD × TC cuando no hay flete ni ctruInicial', () => {
    const unidad = {
      ctruInicial: undefined as number | undefined,
      costoUnitarioUSD: 100,
      costoFleteUSD: 0,
      tcPago: 3.80,
      tcCompra: undefined as number | undefined,
    };
    expect(getCostoBasePEN(unidad)).toBeCloseTo(380);
  });

  it('retorna 0 cuando no hay TC ni costo', () => {
    const unidad = {
      ctruInicial: undefined as number | undefined,
      costoUnitarioUSD: 0,
      costoFleteUSD: 0,
      tcPago: undefined as number | undefined,
      tcCompra: undefined as number | undefined,
    };
    expect(getCostoBasePEN(unidad)).toBe(0);
  });

  it('ignora ctruInicial = 0 (tratado como ausente)', () => {
    const unidad = {
      ctruInicial: 0,
      costoUnitarioUSD: 50,
      costoFleteUSD: 0,
      tcPago: 3.80,
      tcCompra: undefined as number | undefined,
    };
    // ctruInicial es 0, cae al cálculo manual
    expect(getCostoBasePEN(unidad)).toBeCloseTo(190);
  });
});

// ---------------------------------------------------------------------------
// getCTRU
// ---------------------------------------------------------------------------
describe('getCTRU', () => {
  it('retorna ctruDinamico cuando no hay flete y ctruDinamico > 0', () => {
    const unidad = {
      ctruDinamico: 450,
      ctruInicial: 400,
      costoUnitarioUSD: 100,
      costoFleteUSD: 0,
      tcPago: 3.80,
      tcCompra: undefined as number | undefined,
    };
    expect(getCTRU(unidad)).toBe(450);
  });

  it('retorna ctruInicial cuando ctruDinamico es 0 o undefined, sin flete', () => {
    const unidad = {
      ctruDinamico: 0,
      ctruInicial: 400,
      costoUnitarioUSD: 100,
      costoFleteUSD: 0,
      tcPago: 3.80,
      tcCompra: undefined as number | undefined,
    };
    expect(getCTRU(unidad)).toBe(400);
  });

  it('calcula fallback manual cuando no hay ctruDinamico ni ctruInicial, sin flete', () => {
    const unidad = {
      ctruDinamico: 0,
      ctruInicial: 0,
      costoUnitarioUSD: 100,
      costoFleteUSD: 0,
      tcPago: 3.80,
      tcCompra: undefined as number | undefined,
    };
    // 100 × 3.80 = 380
    expect(getCTRU(unidad)).toBeCloseTo(380);
  });

  it('con flete: usa max(ctruDinamico, costoBase + GAGO)', () => {
    const unidad = {
      ctruDinamico: 500,
      ctruInicial: 400,
      costoUnitarioUSD: 100,
      costoFleteUSD: 20,
      tcPago: 3.80,
      tcCompra: undefined as number | undefined,
      costoGAGOAsignado: 30,
    };
    // costoBase = (100 + 20) × 3.80 = 456
    // ctruRecalculado = 456 + 30 = 486
    // max(500, 486) = 500
    expect(getCTRU(unidad)).toBe(500);
  });

  it('con flete: usa ctruRecalculado cuando es mayor que ctruDinamico', () => {
    const unidad = {
      ctruDinamico: 420,  // calculado ANTES de asignar flete — incorrecto
      ctruInicial: 380,
      costoUnitarioUSD: 100,
      costoFleteUSD: 20,
      tcPago: 3.80,
      tcCompra: undefined as number | undefined,
      costoGAGOAsignado: 50,
    };
    // costoBase = (100 + 20) × 3.80 = 456
    // ctruRecalculado = 456 + 50 = 506
    // max(420, 506) = 506
    expect(getCTRU(unidad)).toBeCloseTo(506);
  });

  it('con flete y sin ctruDinamico: retorna costoBase', () => {
    const unidad = {
      ctruDinamico: 0,
      ctruInicial: 0,
      costoUnitarioUSD: 100,
      costoFleteUSD: 20,
      tcPago: 3.80,
      tcCompra: undefined as number | undefined,
    };
    // costoBase = (100 + 20) × 3.80 = 456
    expect(getCTRU(unidad)).toBeCloseTo(456);
  });

  it('retorna 0 cuando no hay datos y no hay TC', () => {
    const unidad = {
      ctruDinamico: 0,
      ctruInicial: 0,
      costoUnitarioUSD: 0,
      costoFleteUSD: 0,
      tcPago: undefined as number | undefined,
      tcCompra: undefined as number | undefined,
    };
    expect(getCTRU(unidad)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getCTRU_Real
// ---------------------------------------------------------------------------
describe('getCTRU_Real', () => {
  it('calcula (costoUSD + flete) × TCPA + GAGO', () => {
    const unidad = {
      costoUnitarioUSD: 100,
      costoFleteUSD: 20,
      costoGAGOAsignado: 30,
    };
    // (100 + 20) × 3.90 + 30 = 468 + 30 = 498
    expect(getCTRU_Real(unidad, 3.90)).toBeCloseTo(498);
  });

  it('retorna 0 cuando tcpa es 0', () => {
    const unidad = {
      costoUnitarioUSD: 100,
      costoFleteUSD: 20,
      costoGAGOAsignado: 30,
    };
    expect(getCTRU_Real(unidad, 0)).toBe(0);
  });

  it('retorna 0 cuando tcpa es negativo', () => {
    const unidad = {
      costoUnitarioUSD: 100,
      costoFleteUSD: 0,
    };
    expect(getCTRU_Real(unidad, -1)).toBe(0);
  });

  it('funciona sin flete ni GAGO', () => {
    const unidad = {
      costoUnitarioUSD: 100,
      costoFleteUSD: 0,
    };
    // 100 × 3.85 = 385
    expect(getCTRU_Real(unidad, 3.85)).toBeCloseTo(385);
  });

  it('trata costoUnitarioUSD undefined como 0', () => {
    const unidad = {
      costoUnitarioUSD: undefined as unknown as number,
      costoFleteUSD: 0,
    };
    expect(getCTRU_Real(unidad, 3.85)).toBeCloseTo(0);
  });
});

// ---------------------------------------------------------------------------
// calcularGAGOProporcional
// ---------------------------------------------------------------------------
describe('calcularGAGOProporcional', () => {
  it('distribuye GAGO proporcionalmente al costo base', () => {
    // Unidad con 25% del costo total → recibe 25% del GAGO
    expect(calcularGAGOProporcional(250, 1000, 400)).toBeCloseTo(100);
  });

  it('retorna 0 cuando el costo base total es 0', () => {
    expect(calcularGAGOProporcional(250, 0, 400)).toBe(0);
  });

  it('retorna 0 cuando el totalGAGO es 0', () => {
    expect(calcularGAGOProporcional(250, 1000, 0)).toBe(0);
  });

  it('retorna 0 cuando el costo base total es negativo', () => {
    expect(calcularGAGOProporcional(250, -500, 400)).toBe(0);
  });

  it('retorna totalGAGO completo cuando la unidad tiene el 100% del costo', () => {
    expect(calcularGAGOProporcional(500, 500, 200)).toBeCloseTo(200);
  });

  it('retorna proporcion correcta con decimales', () => {
    // 1/3 del costo total
    const resultado = calcularGAGOProporcional(100, 300, 90);
    expect(resultado).toBeCloseTo(30);
  });

  it('no hay GAGO si la unidad tiene costo base 0', () => {
    expect(calcularGAGOProporcional(0, 1000, 400)).toBe(0);
  });
});
