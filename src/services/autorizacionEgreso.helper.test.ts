import { describe, it, expect } from 'vitest';
import {
  UMBRAL_AUTORIZACION_SOCIO_USD,
  tramoEgreso,
  requiereAutorizacionSocio,
  firmasSocioRequeridas,
  evaluarFirmaSocio,
  puedeAutorizarEgreso,
  type FirmaSocio,
} from './autorizacionEgreso.helper';

const socioA = 'socio-A';
const socioB = 'socio-B';
const creador = 'gerente-C';

describe('tramoEgreso · umbral', () => {
  it('≤ umbral → directo', () => {
    expect(tramoEgreso(0)).toBe('directo');
    expect(tramoEgreso(500)).toBe('directo');
    expect(tramoEgreso(UMBRAL_AUTORIZACION_SOCIO_USD)).toBe('directo'); // exactamente $1000 = directo
  });
  it('> umbral → doble_socio', () => {
    expect(tramoEgreso(UMBRAL_AUTORIZACION_SOCIO_USD + 0.01)).toBe('doble_socio');
    expect(tramoEgreso(2340)).toBe('doble_socio');
  });
  it('requiereAutorizacionSocio + firmasSocioRequeridas', () => {
    expect(requiereAutorizacionSocio(1000)).toBe(false);
    expect(requiereAutorizacionSocio(1000.01)).toBe(true);
    expect(firmasSocioRequeridas(1000)).toBe(0);
    expect(firmasSocioRequeridas(1500)).toBe(2);
  });
});

describe('evaluarFirmaSocio · tramo directo (≤ umbral)', () => {
  it('no requiere firma de socio · completa directo', () => {
    const r = evaluarFirmaSocio({ montoUSD: 800, firmas: [], userId: socioA, esSocio: true, creadorId: creador });
    expect(r.ok).toBe(false);
    expect(r.completa).toBe(true);
    expect(r.faltanFirmas).toBe(0);
  });
});

describe('evaluarFirmaSocio · tramo doble socio (> umbral)', () => {
  it('un no-socio NO puede firmar', () => {
    const r = evaluarFirmaSocio({ montoUSD: 2340, firmas: [], userId: creador, esSocio: false, creadorId: creador });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/socios/i);
    expect(r.faltanFirmas).toBe(2);
  });

  it('segregación · el creador (aunque sea socio) NO firma lo suyo', () => {
    const r = evaluarFirmaSocio({ montoUSD: 2340, firmas: [], userId: socioA, esSocio: true, creadorId: socioA });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/tu propio/i);
  });

  it('primera firma válida de socio → ok, falta 1', () => {
    const r = evaluarFirmaSocio({ montoUSD: 2340, firmas: [], userId: socioA, esSocio: true, creadorId: creador });
    expect(r.ok).toBe(true);
    expect(r.completa).toBe(false);
    expect(r.faltanFirmas).toBe(1);
  });

  it('segunda firma de OTRO socio → completa', () => {
    const firmas: FirmaSocio[] = [{ usuarioId: socioA }];
    const r = evaluarFirmaSocio({ montoUSD: 2340, firmas, userId: socioB, esSocio: true, creadorId: creador });
    expect(r.ok).toBe(true);
    expect(r.completa).toBe(true);
    expect(r.faltanFirmas).toBe(0);
  });

  it('el mismo socio NO puede firmar dos veces', () => {
    const firmas: FirmaSocio[] = [{ usuarioId: socioA }];
    const r = evaluarFirmaSocio({ montoUSD: 2340, firmas, userId: socioA, esSocio: true, creadorId: creador });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/ya firmaste/i);
    expect(r.faltanFirmas).toBe(1);
  });
});

describe('puedeAutorizarEgreso · gating por tramo', () => {
  it('≤ umbral → manda la autoridad del cargo', () => {
    expect(puedeAutorizarEgreso({ montoUSD: 800, esSocio: false, tieneAutoridadCargo: true })).toBe(true);
    expect(puedeAutorizarEgreso({ montoUSD: 800, esSocio: false, tieneAutoridadCargo: false })).toBe(false);
  });
  it('> umbral → manda ser socio (el cargo no alcanza)', () => {
    expect(puedeAutorizarEgreso({ montoUSD: 2340, esSocio: false, tieneAutoridadCargo: true })).toBe(false);
    expect(puedeAutorizarEgreso({ montoUSD: 2340, esSocio: true, tieneAutoridadCargo: false })).toBe(true);
  });
});
