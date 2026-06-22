import { describe, it, expect } from 'vitest';
import {
  UMBRAL_AUTORIZACION_SOCIO_USD,
  tramoEgreso,
  requiereAutorizacionSocio,
  firmasSocioRequeridas,
  evaluarFirmaSocio,
  puedeAutorizarEgreso,
  evaluarAprobacionEgreso,
  sociosRepresentados,
  type FirmaSocio,
  type SocioEquity,
  type FirmaEgreso,
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

// ════════════════════════════════════════════════════════════════════════════════
// MODELO v3 · QUÓRUM PONDERADO POR EQUITY
// ════════════════════════════════════════════════════════════════════════════════

const firmaDe = (uid: string, representa: string[] = [uid]): FirmaEgreso => ({ usuarioId: uid, representaSocios: representa });

describe('sociosRepresentados · resolución de equity por firmante', () => {
  const socios: SocioEquity[] = [
    { uid: 'A', participacion: 50 },
    { uid: 'B', participacion: 30 },
    { uid: 'C', participacion: 20 },
  ];

  it('un socio se representa a sí mismo', () => {
    expect(sociosRepresentados({ firmanteUid: 'A', firmanteRoles: ['socio'], socios, delegacionesVigentes: [] })).toEqual(['A']);
  });
  it('un no-socio sin delegación no representa a nadie', () => {
    expect(sociosRepresentados({ firmanteUid: 'X', firmanteRoles: ['gerente'], socios, delegacionesVigentes: [] })).toEqual([]);
  });
  it('delegado por usuario representa al socio que lo delegó', () => {
    const deleg = [{ delegadoPor: 'B', delegadoAUsuario: 'X' }];
    expect(sociosRepresentados({ firmanteUid: 'X', firmanteRoles: ['gerente'], socios, delegacionesVigentes: deleg })).toEqual(['B']);
  });
  it('delegado por rol representa al socio que delegó a ese rol', () => {
    const deleg = [{ delegadoPor: 'C', delegadoARol: 'gerente' }];
    expect(sociosRepresentados({ firmanteUid: 'X', firmanteRoles: ['gerente'], socios, delegacionesVigentes: deleg })).toEqual(['C']);
  });
  it('una misma persona delegada por 2 socios ACUMULA ambos (potestad plena de los socios)', () => {
    const deleg = [
      { delegadoPor: 'B', delegadoAUsuario: 'X' },
      { delegadoPor: 'C', delegadoAUsuario: 'X' },
    ];
    const r = sociosRepresentados({ firmanteUid: 'X', firmanteRoles: ['gerente'], socios, delegacionesVigentes: deleg });
    expect(r.sort()).toEqual(['B', 'C']);
  });
  it('socio que ADEMÁS es delegado de otro acumula ambos equities', () => {
    const deleg = [{ delegadoPor: 'C', delegadoAUsuario: 'A' }];
    const r = sociosRepresentados({ firmanteUid: 'A', firmanteRoles: ['socio'], socios, delegacionesVigentes: deleg });
    expect(r.sort()).toEqual(['A', 'C']);
  });
});

describe('evaluarAprobacionEgreso · quórum por equity', () => {
  const socios2: SocioEquity[] = [{ uid: 'A', participacion: 50 }, { uid: 'B', participacion: 50 }];
  const socios3: SocioEquity[] = [{ uid: 'A', participacion: 50 }, { uid: 'B', participacion: 30 }, { uid: 'C', participacion: 20 }];

  it('≤ umbral → directo · no requiere socios', () => {
    const r = evaluarAprobacionEgreso({ montoUSD: 800, socios: socios3, firmas: [] });
    expect(r.requiereSocios).toBe(false);
    expect(r.completa).toBe(true);
  });

  it('admin actor → override root · aprueba solo', () => {
    const r = evaluarAprobacionEgreso({ montoUSD: 5000, socios: socios3, firmas: [], esAdminActor: true });
    expect(r.completa).toBe(true);
    expect(r.nota).toMatch(/admin/i);
  });

  it('2 socios 50/50 (creador externo): UN socio NO alcanza (>50 estricto)', () => {
    const r = evaluarAprobacionEgreso({ montoUSD: 5000, socios: socios2, creadorId: 'gerente-X', firmas: [firmaDe('A')] });
    expect(r.equityFirmado).toBe(50);
    expect(r.equityElegible).toBe(100);
    expect(r.completa).toBe(false);
    expect(r.equityFaltante).toBe(0); // 50 - 50·0.5 ... requerido=50, firmado=50, falta = max(0, 50-50)=0 pero NO completa (estricto)
  });

  it('2 socios 50/50 (creador externo): AMBOS alcanzan mayoría', () => {
    const r = evaluarAprobacionEgreso({ montoUSD: 5000, socios: socios2, creadorId: 'gerente-X', firmas: [firmaDe('A'), firmaDe('B')] });
    expect(r.equityFirmado).toBe(100);
    expect(r.completa).toBe(true);
  });

  it('CREADOR EXCLUIDO: socio A(50) crea · B(50) firma → B es el 100% del electorado → completa', () => {
    const r = evaluarAprobacionEgreso({ montoUSD: 5000, socios: socios2, creadorId: 'A', firmas: [firmaDe('B')] });
    expect(r.equityElegible).toBe(50); // solo B (A excluido)
    expect(r.equityFirmado).toBe(50);
    expect(r.completa).toBe(true); // 50 > 0.5·50 = 25
  });

  it('3 socios 50/30/20 (creador externo): A solo (50) NO alcanza', () => {
    const r = evaluarAprobacionEgreso({ montoUSD: 5000, socios: socios3, creadorId: 'ext', firmas: [firmaDe('A')] });
    expect(r.completa).toBe(false); // 50 > 50 es falso
  });
  it('3 socios 50/30/20 (creador externo): A+C (70) alcanza', () => {
    const r = evaluarAprobacionEgreso({ montoUSD: 5000, socios: socios3, creadorId: 'ext', firmas: [firmaDe('A'), firmaDe('C')] });
    expect(r.equityFirmado).toBe(70);
    expect(r.completa).toBe(true);
  });
  it('3 socios 50/30/20 (creador externo): B+C (50) NO alcanza (empate no es mayoría)', () => {
    const r = evaluarAprobacionEgreso({ montoUSD: 5000, socios: socios3, creadorId: 'ext', firmas: [firmaDe('B'), firmaDe('C')] });
    expect(r.equityFirmado).toBe(50);
    expect(r.completa).toBe(false);
  });

  it('DELEGADO carga el equity del socio: X (delegado de B) firma representando a B', () => {
    const r = evaluarAprobacionEgreso({ montoUSD: 5000, socios: socios2, creadorId: 'A', firmas: [firmaDe('X', ['B'])] });
    expect(r.equityFirmado).toBe(50); // X representa el 50% de B
    expect(r.completa).toBe(true);
  });

  it('SIN DOBLE-CONTEO: el mismo socio representado por 2 firmas cuenta una sola vez', () => {
    const r = evaluarAprobacionEgreso({ montoUSD: 5000, socios: socios3, creadorId: 'ext', firmas: [firmaDe('A'), firmaDe('Y', ['A'])] });
    expect(r.equityFirmado).toBe(50); // A contado una vez, no 100
    expect(r.completa).toBe(false);
  });

  it('SIN ELECTORADO: el único socio es el creador → no se puede por la vía socio (requiere admin)', () => {
    const soloA: SocioEquity[] = [{ uid: 'A', participacion: 100 }];
    const r = evaluarAprobacionEgreso({ montoUSD: 5000, socios: soloA, creadorId: 'A', firmas: [] });
    expect(r.completa).toBe(false);
    expect(r.equityElegible).toBe(0);
    expect(r.nota).toMatch(/admin/i);
  });

  it('equityFaltante refleja cuánto falta para superar la mayoría', () => {
    const r = evaluarAprobacionEgreso({ montoUSD: 5000, socios: socios3, creadorId: 'ext', firmas: [firmaDe('C')] });
    // elegible=100, requerido=50, firmado=20 → falta 30
    expect(r.equityFaltante).toBe(30);
  });
});
