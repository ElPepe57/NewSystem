import { describe, it, expect } from 'vitest';
import {
  gastoAEgreso,
  ocAEgreso,
  esPendienteDeFirma,
  puedoFirmar,
  chipFirma,
  progresoEquity,
  firmadoPorMi,
  autorizacionCompleta,
  type EgresoPendiente,
} from './egresosPendientesSocio.helper';
import type { SocioEquity } from './autorizacionEgreso.helper';

const socioA = 'socio-A';
const socioB = 'socio-B';
const creador = 'gerente-C';
const socios: SocioEquity[] = [{ uid: socioA, participacion: 50 }, { uid: socioB, participacion: 50 }];

const egreso = (over: Partial<EgresoPendiente> = {}): EgresoPendiente => ({
  origen: 'oc', id: 'x', numero: 'X', montoUSD: 2000, firmas: [], creadoPor: creador, aprobado: false, descartado: false, ...over,
});

describe('mapeo · estado por campo PERSISTIDO (no por conteo de firmas)', () => {
  it('gasto (USD) → aprobado desde autorizacion.estado', () => {
    const e = gastoAEgreso({
      id: 'g1', numeroGasto: 'GAS-1', descripcion: 'Alquiler', moneda: 'USD',
      montoOriginal: 1500, montoPEN: 5550, creadoPor: creador,
      autorizacion: { estado: 'aprobado', firmas: [] },
    } as any);
    expect(e.origen).toBe('gasto');
    expect(e.montoUSD).toBe(1500);
    expect(e.aprobado).toBe(true);
    expect(e.descripcion).toBe('Alquiler');
  });
  it('OC pendiente → aprobado false · montoUSD = totalUSD', () => {
    const e = ocAEgreso({ id: 'o1', numeroOrden: 'OC-1', totalUSD: 2000, creadoPor: creador, nombreProveedor: 'iHerb', autorizacion: { estado: 'pendiente', firmas: [] } } as any);
    expect(e.montoUSD).toBe(2000);
    expect(e.aprobado).toBe(false);
  });
  it('OC rechazada → descartado', () => {
    const e = ocAEgreso({ id: 'o2', numeroOrden: 'OC-2', totalUSD: 2000, creadoPor: creador, autorizacion: { estado: 'rechazado', firmas: [] } } as any);
    expect(e.descartado).toBe(true);
  });
});

describe('esPendienteDeFirma · filtro (estado persistido)', () => {
  it('> umbral y no aprobado → pendiente', () => {
    expect(esPendienteDeFirma(egreso())).toBe(true);
  });
  it('≤ umbral → NO pendiente', () => {
    expect(esPendienteDeFirma(egreso({ montoUSD: 900 }))).toBe(false);
  });
  it('aprobado → NO pendiente', () => {
    expect(esPendienteDeFirma(egreso({ aprobado: true }))).toBe(false);
  });
  it('descartado → NO pendiente · sale de la bandeja', () => {
    expect(esPendienteDeFirma(egreso({ descartado: true }))).toBe(false);
  });
});

describe('puedoFirmar · segregación + socio + estado', () => {
  it('socio que no es creador → puede', () => {
    expect(puedoFirmar(egreso(), socioA, true)).toBe(true);
  });
  it('el creador NO puede (segregación)', () => {
    expect(puedoFirmar(egreso({ creadoPor: socioA }), socioA, true)).toBe(false);
  });
  it('no-socio NO puede', () => {
    expect(puedoFirmar(egreso(), socioA, false)).toBe(false);
  });
  it('socio que ya firmó NO puede de nuevo', () => {
    expect(puedoFirmar(egreso({ firmas: [{ usuarioId: socioA }] }), socioA, true)).toBe(false);
  });
  it('aprobado → nadie firma más', () => {
    expect(puedoFirmar(egreso({ aprobado: true }), socioA, true)).toBe(false);
  });
});

describe('firmadoPorMi + autorizacionCompleta', () => {
  it('firmadoPorMi: true si mi uid está en las firmas', () => {
    const e = egreso({ firmas: [{ usuarioId: socioA }] });
    expect(firmadoPorMi(e, socioA)).toBe(true);
    expect(firmadoPorMi(e, socioB)).toBe(false);
  });
  it('autorizacionCompleta = aprobado (estado persistido)', () => {
    expect(autorizacionCompleta(egreso())).toBe(false);
    expect(autorizacionCompleta(egreso({ aprobado: true }))).toBe(true);
  });
});

describe('progresoEquity + chipFirma · por equity', () => {
  // creador externo (gerente-C) · electorado = A(50)+B(50) = 100 · mayoría > 50.
  it('1 firma de A (representa 50%) → 50% firmado · no completa', () => {
    const e = egreso({ firmas: [{ usuarioId: socioA, representaSocios: [socioA] }] });
    const p = progresoEquity(e, socios);
    expect(p.equityFirmado).toBe(50);
    expect(p.pctFirmado).toBe(50);
    expect(p.completa).toBe(false);
  });
  it('chipFirma: aprobado → "Autorizado"', () => {
    expect(chipFirma(egreso({ aprobado: true }), socios)).toBe('Autorizado');
  });
  it('chipFirma: 0 firmas → falta la mayoría', () => {
    expect(chipFirma(egreso(), socios)).toMatch(/mayor[ií]a/i);
  });
  it('chipFirma: 1 firma → muestra el % del equity', () => {
    const e = egreso({ firmas: [{ usuarioId: socioA, representaSocios: [socioA] }] });
    expect(chipFirma(e, socios)).toMatch(/50%/);
  });
});
