import { describe, it, expect } from 'vitest';
import {
  calcularVigenciaReservaMs,
  resolverEstadoLiberacion,
  getReservaPara,
  esReservaVencida,
  VIGENCIA_FALLBACK_MS,
} from './reserva.helper';

const H = 60 * 60 * 1000;
const D = 24 * H;
const T0 = 1_700_000_000_000; // epoch fijo de referencia

describe('calcularVigenciaReservaMs · vigencia por origen (decisión 2026-06-20)', () => {
  it('venta → +48h', () => {
    expect(calcularVigenciaReservaMs(T0, 'venta')).toBe(T0 + 48 * H);
  });
  it('cotizacion → +90d', () => {
    expect(calcularVigenciaReservaMs(T0, 'cotizacion')).toBe(T0 + 90 * D);
  });
  it('ml → +60d', () => {
    expect(calcularVigenciaReservaMs(T0, 'ml')).toBe(T0 + 60 * D);
  });
  it('requerimiento → null (demanda comprometida · NO expira)', () => {
    expect(calcularVigenciaReservaMs(T0, 'requerimiento')).toBeNull();
  });
  it('override numérico reemplaza el default del origen', () => {
    expect(calcularVigenciaReservaMs(T0, 'venta', 7 * D)).toBe(T0 + 7 * D);
  });
  it('override null fuerza no-expira (aunque el origen sí expiraría)', () => {
    expect(calcularVigenciaReservaMs(T0, 'venta', null)).toBeNull();
  });
  it('fallback = 60d (constante exportada)', () => {
    expect(VIGENCIA_FALLBACK_MS).toBe(60 * D);
  });
});

describe('resolverEstadoLiberacion · restauración por país', () => {
  it('país de origen (USA) → recibida_origen', () => {
    expect(resolverEstadoLiberacion('USA')).toBe('recibida_origen');
  });
  it('Perú → disponible_peru', () => {
    expect(resolverEstadoLiberacion('Peru')).toBe('disponible_peru');
  });
  it('NUNCA hardcodea "disponible" (el bug del cron roto)', () => {
    expect(resolverEstadoLiberacion('USA')).not.toBe('disponible');
    expect(resolverEstadoLiberacion('Peru')).not.toBe('disponible');
  });
});

describe('getReservaPara · consolida schema nuevo + planos legacy', () => {
  it('prioriza reserva.para (schema nuevo)', () => {
    expect(getReservaPara({ reserva: { para: 'NEW' }, reservadaPara: 'OLD', reservadoPara: 'VAR' })).toBe('NEW');
  });
  it('cae a reservadaPara si no hay reserva.para', () => {
    expect(getReservaPara({ reservadaPara: 'OLD', reservadoPara: 'VAR' })).toBe('OLD');
  });
  it('cae a la variante de naming reservadoPara', () => {
    expect(getReservaPara({ reservadoPara: 'VAR' })).toBe('VAR');
  });
  it('null si no hay ningún vínculo', () => {
    expect(getReservaPara({})).toBeNull();
  });
});

describe('esReservaVencida', () => {
  it('null = nunca vence (demanda comprometida)', () => {
    expect(esReservaVencida(null, T0)).toBe(false);
  });
  it('vigencia futura = no vencida', () => {
    expect(esReservaVencida(T0 + D, T0)).toBe(false);
  });
  it('vigencia pasada = vencida', () => {
    expect(esReservaVencida(T0 - 1, T0)).toBe(true);
  });
  it('vigencia == ahora = vencida (límite inclusivo · igual que el cron <=)', () => {
    expect(esReservaVencida(T0, T0)).toBe(true);
  });
});
