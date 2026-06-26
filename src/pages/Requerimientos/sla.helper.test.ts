import { describe, it, expect } from 'vitest';
import { calcularSLA } from './sla.helper';
import type { Requerimiento } from '../../types/requerimiento.types';

const AHORA = 1_700_000_000_000; // fijo · sin Date.now en tests
const DIA = 1000 * 60 * 60 * 24;
const tsHaceDias = (d: number) => ({ toMillis: () => AHORA - d * DIA }) as any;

const makeReq = (r: Partial<Requerimiento> = {}): Requerimiento => ({
  id: 'R', numeroRequerimiento: 'REQ', origen: 'administrativo', subtipo: 'restock',
  productos: [], asignaciones: [], estado: 'pendiente', prioridad: 'normal',
  fechaSolicitud: tsHaceDias(0), solicitadoPor: 'u', creadoPor: 'u', fechaCreacion: tsHaceDias(0),
  ...r,
});

describe('calcularSLA', () => {
  it('administrativo: fresco <2d, envejeciendo 2-4d, crítico ≥5d', () => {
    expect(calcularSLA(makeReq({ fechaCreacion: tsHaceDias(1) }), AHORA).nivel).toBe('fresco');
    expect(calcularSLA(makeReq({ fechaCreacion: tsHaceDias(2) }), AHORA).nivel).toBe('envejeciendo');
    expect(calcularSLA(makeReq({ fechaCreacion: tsHaceDias(4) }), AHORA).nivel).toBe('envejeciendo');
    expect(calcularSLA(makeReq({ fechaCreacion: tsHaceDias(5) }), AHORA).nivel).toBe('critico');
  });

  it('demanda comprometida escala más rápido (amber ≥1d, rose ≥3d)', () => {
    const base = { origen: 'demanda_comprometida' as const, subtipo: undefined };
    expect(calcularSLA(makeReq({ ...base, fechaCreacion: tsHaceDias(0) }), AHORA).nivel).toBe('fresco');
    expect(calcularSLA(makeReq({ ...base, fechaCreacion: tsHaceDias(1) }), AHORA).nivel).toBe('envejeciendo');
    expect(calcularSLA(makeReq({ ...base, fechaCreacion: tsHaceDias(3) }), AHORA).nivel).toBe('critico');
    expect(calcularSLA(makeReq({ ...base, fechaCreacion: tsHaceDias(3) }), AHORA).esComprometida).toBe(true);
  });

  it('diasPendiente correcto + fallback a fechaSolicitud', () => {
    expect(calcularSLA(makeReq({ fechaCreacion: tsHaceDias(7) }), AHORA).diasPendiente).toBe(7);
    const r = makeReq({ fechaCreacion: undefined as any, fechaSolicitud: tsHaceDias(4) });
    expect(calcularSLA(r, AHORA).diasPendiente).toBe(4);
  });
});
