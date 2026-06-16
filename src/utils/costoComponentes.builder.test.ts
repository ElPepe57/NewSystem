import { describe, it, expect } from 'vitest';
import type { Timestamp } from 'firebase/firestore';
import type { CostoLanded, EnvioUnidad, SubEnvioT1 } from '../types/envio.types';
import {
  buildUnidadesPorTanda,
  prorratearLandedAComponentes,
  construirComponentesUnidad,
} from './costoComponentes.builder';
import { sumarComponentesCosto } from './ctru.utils';

// El builder solo ALMACENA congeladoEn (no invoca métodos) → un stub basta.
const TS = { seconds: 0, nanoseconds: 0 } as unknown as Timestamp;

function unidad(id: string, productoId = 'P1'): EnvioUnidad {
  return { unidadId: id, productoId, sku: 'SKU', codigoUnidad: id, estadoEnvio: 'pendiente' };
}

function costoLanded(over: Partial<CostoLanded>): CostoLanded {
  return {
    id: 'CL', categoriaCostoId: 'flete', categoriaCostoNombre: 'Flete',
    monto: 0, moneda: 'PEN', montoPEN: 0, metodoProrrateo: 'fijo_por_unidad',
    pagado: false, creadoPor: 'test', fechaCreacion: TS, ...over,
  };
}

const tanda2: SubEnvioT1 = {
  id: 'T2', secuencia: 2, tipo: 'normal',
  unidadesIds: ['u7', 'u8', 'u9', 'u10'], // la etapa 2 = 4 unidades
  estado: 'entregado', creadoPor: 'test', fechaCreacion: TS,
};

describe('prorratearLandedAComponentes · por ámbito', () => {
  const todas = Array.from({ length: 10 }, (_, i) => unidad(`u${i + 1}`));

  it('costo scope=envio se reparte entre TODAS las unidades (denominador estable)', () => {
    const flete = costoLanded({ categoriaCostoNombre: 'Flete remesa', montoPEN: 200 });
    const map = prorratearLandedAComponentes([flete], todas, new Map(), new Map(), TS);
    expect(map.size).toBe(10);
    for (const comps of map.values()) {
      expect(comps).toHaveLength(1);
      expect(comps[0].montoPEN).toBeCloseTo(20); // 200 / 10
      expect(comps[0].ambito).toBe('envio');
      expect(comps[0].categoria).toBe('flete');
    }
  });

  it('costo scope=tanda se reparte SOLO entre las unidades de su tanda', () => {
    const recojo = costoLanded({
      categoriaCostoId: 'recojo', categoriaCostoNombre: 'Recojo etapa 2',
      montoPEN: 40, scope: 'tanda', tandaId: 'T2',
    });
    const porTanda = buildUnidadesPorTanda([tanda2], todas);
    const map = prorratearLandedAComponentes([recojo], todas, porTanda, new Map(), TS);
    expect(map.size).toBe(4); // solo las 4 de la tanda
    const enTanda = map.get('u7')!;
    expect(enTanda[0].montoPEN).toBeCloseTo(10); // 40 / 4
    expect(enTanda[0].ambito).toBe('etapa');
    expect(enTanda[0].tandaId).toBe('T2');
    expect(enTanda[0].categoria).toBe('recojo');
    expect(map.has('u1')).toBe(false); // una de la etapa 1 NO carga el recojo
  });

  it('caso canon: u de etapa 2 = flete(20)+recojo(10)=30 ; u de etapa 1 = solo flete(20)', () => {
    const flete = costoLanded({ categoriaCostoNombre: 'Flete remesa', montoPEN: 200 });
    const recojo = costoLanded({
      categoriaCostoId: 'recojo', categoriaCostoNombre: 'Recojo etapa 2',
      montoPEN: 40, scope: 'tanda', tandaId: 'T2',
    });
    const porTanda = buildUnidadesPorTanda([tanda2], todas);
    const map = prorratearLandedAComponentes([flete, recojo], todas, porTanda, new Map(), TS);
    expect(sumarComponentesCosto(map.get('u10'))).toBeCloseTo(30); // 20 + 10 (etapa 2)
    expect(sumarComponentesCosto(map.get('u1'))).toBeCloseTo(20);  // solo flete (etapa 1)
  });
});

describe('construirComponentesUnidad', () => {
  it('arma producto + landed y Σ = CTRU del ejemplo (178)', () => {
    const landed = prorratearLandedAComponentes(
      [
        costoLanded({ categoriaCostoNombre: 'Flete remesa', montoPEN: 200 }),
        costoLanded({ categoriaCostoId: 'recojo', categoriaCostoNombre: 'Recojo etapa 2', montoPEN: 40, scope: 'tanda', tandaId: 'T2' }),
      ],
      Array.from({ length: 10 }, (_, i) => unidad(`u${i + 1}`)),
      buildUnidadesPorTanda([tanda2], Array.from({ length: 10 }, (_, i) => unidad(`u${i + 1}`))),
      new Map(),
      TS,
    ).get('u10')!; // unidad de la etapa 2 → flete 20 + recojo 10

    const comps = construirComponentesUnidad({ costoUnitarioUSD: 40, tcPago: 3.7 }, landed, TS);
    // producto: 40 × 3.7 = 148 ; + flete 20 + recojo 10 = 178
    expect(comps[0].categoria).toBe('producto');
    expect(comps[0].montoPEN).toBeCloseTo(148);
    expect(sumarComponentesCosto(comps)).toBeCloseTo(178);
  });

  it('produce el componente producto aun SIN costos landed (guard killed)', () => {
    const comps = construirComponentesUnidad({ costoUnitarioUSD: 40, tcPago: 3.7 }, [], TS);
    expect(comps).toHaveLength(1);
    expect(comps[0].categoria).toBe('producto');
    expect(sumarComponentesCosto(comps)).toBeCloseTo(148);
  });
});
