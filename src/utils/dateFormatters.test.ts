import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatFecha, formatFechaRelativa, calcularDiasParaVencer } from './dateFormatters';

// formatFecha usa Timestamp de Firebase solo para instancias reales.
// Aquí testeamos con Date, number, string y objetos planos serializados —
// que son los formatos más comunes al leer de Firestore en el cliente.

// ---------------------------------------------------------------------------
// formatFecha
// ---------------------------------------------------------------------------
describe('formatFecha', () => {
  it('retorna "-" para null', () => {
    expect(formatFecha(null)).toBe('-');
  });

  it('retorna "-" para undefined', () => {
    expect(formatFecha(undefined)).toBe('-');
  });

  it('formatea un Date correctamente', () => {
    // 2026-03-20T00:00:00.000Z
    const date = new Date(2026, 2, 20); // mes 0-indexado
    const result = formatFecha(date);
    expect(result).toContain('2026');
    expect(result).toContain('03');
    expect(result).toContain('20');
  });

  it('formatea un timestamp numérico (ms desde epoch)', () => {
    const ms = new Date(2026, 2, 20).getTime();
    const result = formatFecha(ms);
    expect(result).toContain('2026');
  });

  it('formatea un string ISO de fecha', () => {
    const result = formatFecha('2026-03-20');
    expect(result).toContain('2026');
  });

  it('retorna "-" para string inválido', () => {
    expect(formatFecha('not-a-date')).toBe('-');
  });

  it('formatea un objeto serializado { seconds, nanoseconds }', () => {
    // Firestore Timestamp serializado (ej. después de JSON.parse)
    const epoch = new Date(2026, 2, 20).getTime() / 1000;
    const result = formatFecha({ seconds: Math.floor(epoch), nanoseconds: 0 } as unknown as Date);
    expect(result).toContain('2026');
  });

  it('incluye hora cuando se pide includeTime', () => {
    const date = new Date(2026, 2, 20, 15, 30);
    const result = formatFecha(date, { includeTime: true });
    // El resultado debe incluir hora y minuto (formato 15:30 o 03:30 PM)
    expect(result.length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// formatFechaRelativa
// ---------------------------------------------------------------------------
describe('formatFechaRelativa', () => {
  beforeEach(() => {
    // Fijar el tiempo actual en 2026-03-20 12:00:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 20, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna "-" para null', () => {
    expect(formatFechaRelativa(null)).toBe('-');
  });

  it('retorna "Justo ahora" para fechas muy recientes (< 1 min)', () => {
    const hace30s = new Date(2026, 2, 20, 11, 59, 30).getTime();
    expect(formatFechaRelativa(hace30s)).toBe('Justo ahora');
  });

  it('retorna "Hace X min" para fechas entre 1-59 minutos', () => {
    const hace15min = new Date(2026, 2, 20, 11, 45, 0).getTime();
    expect(formatFechaRelativa(hace15min)).toBe('Hace 15 min');
  });

  it('retorna "Hace Xh" para fechas entre 1-23 horas', () => {
    const hace3h = new Date(2026, 2, 20, 9, 0, 0).getTime();
    expect(formatFechaRelativa(hace3h)).toBe('Hace 3h');
  });

  it('retorna "Hace Xd" para fechas entre 1-6 días', () => {
    const hace2d = new Date(2026, 2, 18, 12, 0, 0).getTime();
    expect(formatFechaRelativa(hace2d)).toBe('Hace 2d');
  });

  it('retorna fecha formateada para fechas > 7 días', () => {
    // 15 días atrás
    const hace15d = new Date(2026, 2, 5, 12, 0, 0).getTime();
    const result = formatFechaRelativa(hace15d);
    expect(result).toContain('2026');
    expect(result).toContain('03');
  });

  it('acepta un objeto Date directamente', () => {
    const hace5min = new Date(2026, 2, 20, 11, 55, 0);
    expect(formatFechaRelativa(hace5min)).toBe('Hace 5 min');
  });
});

// ---------------------------------------------------------------------------
// calcularDiasParaVencer
// ---------------------------------------------------------------------------
describe('calcularDiasParaVencer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 20, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna null para undefined', () => {
    expect(calcularDiasParaVencer(undefined)).toBeNull();
  });

  it('retorna null para null', () => {
    expect(calcularDiasParaVencer(null)).toBeNull();
  });

  it('retorna número positivo para fecha futura', () => {
    // Vence en 10 días
    const fecha = new Date(2026, 2, 30);
    const dias = calcularDiasParaVencer(fecha);
    expect(dias).toBe(10);
  });

  it('retorna número negativo para fecha pasada (ya vencido)', () => {
    // Venció hace 5 días
    const fecha = new Date(2026, 2, 15);
    const dias = calcularDiasParaVencer(fecha);
    expect(dias).toBe(-5);
  });

  it('retorna 0 para fecha de hoy al mismo momento exacto', () => {
    // Misma hora exacta → 0 ms de diferencia → ceil(0) = 0
    const fecha = new Date(2026, 2, 20, 12, 0, 0);
    const dias = calcularDiasParaVencer(fecha);
    expect(dias).toBe(0);
  });

  it('acepta timestamp numérico', () => {
    const fecha = new Date(2026, 2, 25).getTime();
    const dias = calcularDiasParaVencer(fecha);
    expect(dias).toBe(5);
  });

  it('acepta string ISO de fecha', () => {
    const fecha = '2026-03-30';
    const dias = calcularDiasParaVencer(fecha);
    // La diferencia exacta depende del timezone local, pero debe ser positiva
    expect(dias).toBeGreaterThan(0);
  });

  it('retorna null para string inválido', () => {
    expect(calcularDiasParaVencer('no-es-fecha')).toBeNull();
  });

  it('retorna null para objeto con seconds NaN', () => {
    const resultado = calcularDiasParaVencer({ seconds: NaN, nanoseconds: 0 } as unknown as Date);
    expect(resultado).toBeNull();
  });
});
