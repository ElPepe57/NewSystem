import { describe, it, expect } from 'vitest';
import {
  requerimientoAEgreso,
  gastoAEgreso,
  ocAEgreso,
  esPendienteDeFirma,
  puedoFirmar,
  chipFirma,
  firmadoPorMi,
  autorizacionCompleta,
  type EgresoPendiente,
} from './egresosPendientesSocio.helper';

const socioA = 'socio-A';
const socioB = 'socio-B';
const creador = 'gerente-C';

describe('mapeo · normaliza la divergencia req/gasto/OC', () => {
  it('requerimiento → firmas desde aprobaciones.firmas', () => {
    const e = requerimientoAEgreso({
      id: 'r1', numeroRequerimiento: 'REQ-1', montoEstimadoUSD: 2340,
      creadoPor: creador, aprobaciones: { firmas: [{ usuarioId: socioA }] },
    } as any);
    expect(e.origen).toBe('requerimiento');
    expect(e.montoUSD).toBe(2340);
    expect(e.firmas).toHaveLength(1);
    expect(e.faltanFirmas).toBe(1); // requiere 2, tiene 1
    expect(e.creadoPor).toBe(creador);
  });

  it('gasto (USD) → firmas desde autorizacion.firmas', () => {
    const e = gastoAEgreso({
      id: 'g1', numeroGasto: 'GAS-1', descripcion: 'Alquiler', moneda: 'USD',
      montoOriginal: 1500, montoPEN: 5550, creadoPor: creador,
      autorizacion: { estado: 'pendiente', firmas: [] },
    } as any);
    expect(e.origen).toBe('gasto');
    expect(e.montoUSD).toBe(1500);
    expect(e.faltanFirmas).toBe(2); // 0 firmas
    expect(e.descripcion).toBe('Alquiler');
  });

  it('OC → montoUSD = totalUSD (ya landed)', () => {
    const e = ocAEgreso({
      id: 'o1', numeroOrden: 'OC-1', totalUSD: 800, creadoPor: creador, nombreProveedor: 'iHerb',
    } as any);
    expect(e.origen).toBe('oc');
    expect(e.montoUSD).toBe(800);
    expect(e.faltanFirmas).toBe(0); // ≤ umbral → no requiere socio
  });
});

describe('esPendienteDeFirma · filtro de la bandeja', () => {
  const base: EgresoPendiente = { origen: 'oc', id: 'x', numero: 'X', montoUSD: 2000, firmas: [], faltanFirmas: 2, creadoPor: creador };
  it('> umbral con firmas faltantes → pendiente', () => {
    expect(esPendienteDeFirma(base)).toBe(true);
  });
  it('≤ umbral → NO pendiente', () => {
    expect(esPendienteDeFirma({ ...base, montoUSD: 900, faltanFirmas: 0 })).toBe(false);
  });
  it('> umbral pero ya completas (2 firmas) → NO pendiente', () => {
    expect(esPendienteDeFirma({ ...base, firmas: [{ usuarioId: 'a' }, { usuarioId: 'b' }], faltanFirmas: 0 })).toBe(false);
  });
});

describe('puedoFirmar · segregación + socio', () => {
  const e: EgresoPendiente = { origen: 'oc', id: 'x', numero: 'X', montoUSD: 2000, firmas: [], faltanFirmas: 2, creadoPor: creador };
  it('socio que no es creador → puede', () => {
    expect(puedoFirmar(e, socioA, true)).toBe(true);
  });
  it('el creador NO puede (segregación)', () => {
    expect(puedoFirmar({ ...e, creadoPor: socioA }, socioA, true)).toBe(false);
  });
  it('no-socio NO puede', () => {
    expect(puedoFirmar(e, socioA, false)).toBe(false);
  });
  it('socio que ya firmó NO puede de nuevo', () => {
    expect(puedoFirmar({ ...e, firmas: [{ usuarioId: socioA }] }, socioA, true)).toBe(false);
  });
});

describe('firmadoPorMi + autorizacionCompleta · Mis aprobaciones dadas', () => {
  const base: EgresoPendiente = { origen: 'oc', id: 'x', numero: 'X', montoUSD: 2000, firmas: [{ usuarioId: socioA }], faltanFirmas: 1, creadoPor: creador };
  it('firmadoPorMi: true si mi uid está en las firmas', () => {
    expect(firmadoPorMi(base, socioA)).toBe(true);
    expect(firmadoPorMi(base, socioB)).toBe(false);
  });
  it('autorizacionCompleta: false si falta firma · true si 0 faltan', () => {
    expect(autorizacionCompleta(base)).toBe(false);
    expect(autorizacionCompleta({ ...base, firmas: [{ usuarioId: socioA }, { usuarioId: socioB }], faltanFirmas: 0 })).toBe(true);
  });
});

describe('chipFirma · progreso', () => {
  it('0 firmas → "Falta tu firma (0/2)"', () => {
    expect(chipFirma({ origen: 'oc', id: 'x', numero: 'X', montoUSD: 2000, firmas: [], faltanFirmas: 2 })).toBe('Falta tu firma (0/2)');
  });
  it('1 firma → "Falta 1 socio (1/2)"', () => {
    expect(chipFirma({ origen: 'oc', id: 'x', numero: 'X', montoUSD: 2000, firmas: [{ usuarioId: 'a' }], faltanFirmas: 1 })).toBe('Falta 1 socio (1/2)');
  });
});
