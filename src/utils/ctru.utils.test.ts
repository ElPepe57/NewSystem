import { describe, it, expect } from 'vitest';
import { getCTRU, getTC, getCostoBasePEN, getCTRU_Real, resumirLandedOC } from './ctru.utils';
import type { ComponenteCostoUnidad } from '../types/ctru.types';
import type { Unidad } from '../types/unidad.types';

// ---------------------------------------------------------------------------
// resumirLandedOC · re-home del costo landed en el detalle de OC (F3)
// ---------------------------------------------------------------------------
describe('resumirLandedOC', () => {
  const comp = (categoria: ComponenteCostoUnidad['categoria'], montoPEN: number): ComponenteCostoUnidad =>
    ({ categoria, concepto: categoria, montoPEN, fuente: 'recepcion', ambito: 'envio' });
  const u = (componentesCosto?: ComponenteCostoUnidad[]) =>
    ({ componentesCosto } as unknown as Unidad);

  it('suma getCTRU solo sobre unidades aterrizadas (las no recibidas no cuentan)', () => {
    const r = resumirLandedOC([
      u([comp('producto', 100), comp('flete', 30), comp('impuesto', 10)]),
      u([comp('producto', 120), comp('descuento', -20)]),
      u(undefined), // no recibida → no aterriza
      u([]),        // sin componentes → no aterriza
    ]);
    expect(r.unidadesTotal).toBe(4);
    expect(r.unidadesConCosto).toBe(2);
    expect(r.landedTotalPEN).toBeCloseTo(240); // (100+30+10) + (120-20)
  });

  it('mantiene el INVARIANTE landedTotalPEN === suma de capas', () => {
    const r = resumirLandedOC([
      u([comp('producto', 100), comp('flete', 30), comp('recojo', 5), comp('landed', 8), comp('impuesto', 10), comp('descuento', -12), comp('otro', 3)]),
    ]);
    const sumaCapas = r.capas.producto + r.capas.impuesto + r.capas.flete + r.capas.otros;
    expect(sumaCapas).toBeCloseTo(r.landedTotalPEN);
  });

  it('agrupa capas: flete = flete+recojo+landed · otros = descuento(neg)+otro', () => {
    const r = resumirLandedOC([
      u([comp('producto', 100), comp('flete', 30), comp('recojo', 5), comp('landed', 8), comp('impuesto', 10), comp('descuento', -12), comp('otro', 3)]),
    ]);
    expect(r.capas.producto).toBeCloseTo(100);
    expect(r.capas.impuesto).toBeCloseTo(10);
    expect(r.capas.flete).toBeCloseTo(43);  // 30+5+8
    expect(r.capas.otros).toBeCloseTo(-9);  // -12+3
  });

  it('OC sin unidades aterrizadas → landed 0 (empty state)', () => {
    const r = resumirLandedOC([u(undefined), u([])]);
    expect(r.landedTotalPEN).toBe(0);
    expect(r.unidadesConCosto).toBe(0);
    expect(r.unidadesTotal).toBe(2);
  });
});

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
// getCostoBasePEN · estimado pre-recepción (sin componentesCosto)
// ---------------------------------------------------------------------------
describe('getCostoBasePEN', () => {
  it('calcula (costoUSD + flete) × TC cuando hay flete', () => {
    const unidad = {
      costoUnitarioUSD: 100,
      costoFleteUSD: 20,
      tcPago: 3.80,
      tcCompra: undefined as number | undefined,
    };
    // (100 + 20) × 3.80 = 456
    expect(getCostoBasePEN(unidad)).toBeCloseTo(456);
  });

  it('calcula costoUSD × TC cuando no hay flete', () => {
    const unidad = {
      costoUnitarioUSD: 100,
      costoFleteUSD: 0,
      tcPago: 3.80,
      tcCompra: undefined as number | undefined,
    };
    expect(getCostoBasePEN(unidad)).toBeCloseTo(380);
  });

  it('suma costoRecojoPEN al estimado escalar', () => {
    const unidad = {
      costoUnitarioUSD: 100,
      costoFleteUSD: 0,
      tcPago: 3.80,
      tcCompra: undefined as number | undefined,
      costoRecojoPEN: 15,
    };
    // 100 × 3.80 + 15 = 395
    expect(getCostoBasePEN(unidad)).toBeCloseTo(395);
  });

  it('retorna 0 cuando no hay TC ni costo', () => {
    const unidad = {
      costoUnitarioUSD: 0,
      costoFleteUSD: 0,
      tcPago: undefined as number | undefined,
      tcCompra: undefined as number | undefined,
    };
    expect(getCostoBasePEN(unidad)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getCTRU · contrato limpio (2026-07): componentes congelados o estimado
// ---------------------------------------------------------------------------
describe('getCTRU', () => {
  it('CONTRATO: unidad NO recibida (solo costoUnitarioUSD + tcCompra) → estimado = USD × TC', () => {
    const unidad = {
      costoUnitarioUSD: 100,
      costoFleteUSD: undefined as number | undefined,
      tcPago: undefined as number | undefined,
      tcCompra: 3.70,
      componentesCosto: undefined,
    };
    // Pedida/en tránsito: sin componentes congelados → 100 × 3.70 = 370
    expect(getCTRU(unidad)).toBeCloseTo(370);
  });

  it('sin componentes y con flete: estimado = (producto + flete) × TC', () => {
    const unidad = {
      costoUnitarioUSD: 100,
      costoFleteUSD: 20,
      tcPago: 3.80,
      tcCompra: undefined as number | undefined,
    };
    // (100 + 20) × 3.80 = 456
    expect(getCTRU(unidad)).toBeCloseTo(456);
  });

  it('prefiere tcPago sobre tcCompra en el estimado', () => {
    const unidad = {
      costoUnitarioUSD: 100,
      costoFleteUSD: 0,
      tcPago: 3.85,
      tcCompra: 3.70,
    };
    expect(getCTRU(unidad)).toBeCloseTo(385);
  });

  it('retorna 0 cuando no hay datos y no hay TC', () => {
    const unidad = {
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
  it('calcula (costoUSD + flete) × TCPA, SIN GA/GO (Acuerdo 3)', () => {
    const unidad = {
      costoUnitarioUSD: 100,
      costoFleteUSD: 20,
    };
    // (100 + 20) × 3.90 = 468 ; GA/GO ya NO se suma al CTRU Real
    expect(getCTRU_Real(unidad, 3.90)).toBeCloseTo(468);
  });

  it('retorna 0 cuando tcpa es 0', () => {
    const unidad = {
      costoUnitarioUSD: 100,
      costoFleteUSD: 20,
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
// Modelo adaptativo · componentesCosto[] (fundación 2026-06-16)
// Caso canon del ejemplo "por ámbito": flete remesa 20 + recojo etapa 10 = +30
// ---------------------------------------------------------------------------
describe('getCTRU · componentesCosto (modelo adaptativo)', () => {
  const componentes: ComponenteCostoUnidad[] = [
    { categoria: 'producto', concepto: 'Compra', montoPEN: 148, fuente: 'oc', ambito: 'envio' },
    { categoria: 'flete', concepto: 'Flete remesa', montoPEN: 20, fuente: 'envio', ambito: 'envio' },
    { categoria: 'recojo', concepto: 'Recojo etapa 2', montoPEN: 10, fuente: 'recepcion', ambito: 'etapa', recepcionId: 'REC-2' },
  ];

  it('getCTRU suma los componentes e IGNORA los inputs escalares (congelado manda)', () => {
    const unidad = {
      componentesCosto: componentes,
      // inputs escalares presentes pero que NO deben influir cuando hay componentes
      costoUnitarioUSD: 500,
      costoFleteUSD: 50,
      tcPago: 3.8,
      tcCompra: undefined as number | undefined,
    };
    expect(getCTRU(unidad)).toBeCloseTo(178); // 148 + 20 + 10
  });

  it('INVARIANTE DE PARIDAD: getCTRU === getCostoBasePEN cuando hay componentes', () => {
    const unidad = {
      componentesCosto: componentes,
      costoUnitarioUSD: 0,
      costoFleteUSD: 0,
      tcPago: 3.8,
      tcCompra: undefined as number | undefined,
    };
    expect(getCTRU(unidad)).toBeCloseTo(getCostoBasePEN(unidad));
  });

  it('un descuento (montoPEN negativo) baja el CTRU neto', () => {
    const conDescuento: ComponenteCostoUnidad[] = [
      ...componentes,
      { categoria: 'descuento', concepto: 'Descuento proveedor', montoPEN: -28, fuente: 'oc', ambito: 'envio' },
    ];
    const unidad = {
      componentesCosto: conDescuento,
      costoUnitarioUSD: 0,
      costoFleteUSD: 0,
      tcPago: 3.8,
      tcCompra: undefined as number | undefined,
    };
    expect(getCTRU(unidad)).toBeCloseTo(150); // 178 - 28
  });

  it('lista VACÍA cae al estimado base por escalares (pre-recepción)', () => {
    const unidad = {
      componentesCosto: [] as ComponenteCostoUnidad[],
      costoUnitarioUSD: 100,
      costoFleteUSD: 0,
      tcPago: 3.8,
      tcCompra: undefined as number | undefined,
    };
    expect(getCTRU(unidad)).toBeCloseTo(380); // estimado = 100 × 3.8
  });

  it('getCTRU_Real revalúa al TCPA solo los componentes nacidos en USD', () => {
    const comps: ComponenteCostoUnidad[] = [
      { categoria: 'producto', concepto: 'Compra', montoPEN: 370, montoOrigenUSD: 100, tc: 3.7, fuente: 'oc', ambito: 'envio' },
      { categoria: 'recojo', concepto: 'Recojo Lima', montoPEN: 10, fuente: 'recepcion', ambito: 'etapa' }, // PEN puro
    ];
    const unidad = { componentesCosto: comps, costoUnitarioUSD: 100, costoFleteUSD: 0 };
    // producto revaluado: 100 * 3.9 = 390 ; recojo PEN se mantiene: +10 → 400
    expect(getCTRU_Real(unidad, 3.9)).toBeCloseTo(400);
  });
});
