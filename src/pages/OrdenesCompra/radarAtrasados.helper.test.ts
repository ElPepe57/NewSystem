import { describe, it, expect } from 'vitest';
import {
  clasificarAtraso,
  esMudo,
  resumirRadar,
  ordenarRadar,
  type FilaAtraso,
} from './radarAtrasados.helper';

const fila = (p: Partial<FilaAtraso>): FilaAtraso =>
  ({
    id: 'X', numero: 'OC-1', proveedor: 'COSRX', diasEnVuelo: 10, leadTimeEsperado: 14,
    ratio: 0.7, gravedad: 'leve', capitalUSD: 1000, diasUltimaSenal: 2, mudo: false,
    culpable: 'proveedor', ...p,
  });

describe('clasificarAtraso', () => {
  it('no atrasado (ratio ≤ 1) → null', () => {
    expect(clasificarAtraso(10, 14)).toBeNull();
    expect(clasificarAtraso(14, 14)).toBeNull();
  });
  it('leve (1 < ratio ≤ 1.5)', () => {
    expect(clasificarAtraso(18, 14)?.gravedad).toBe('leve'); // 1.29
  });
  it('severo (1.5 < ratio ≤ 2)', () => {
    expect(clasificarAtraso(24, 14)?.gravedad).toBe('severo'); // 1.71
  });
  it('crítico (ratio > 2)', () => {
    expect(clasificarAtraso(30, 14)?.gravedad).toBe('critico'); // 2.14
  });
  it('sin lead-time conocido → null (no se afirma "va tarde")', () => {
    expect(clasificarAtraso(30, 0)).toBeNull();
  });
});

describe('esMudo', () => {
  it('sin tracking (null) → no mudo', () => {
    expect(esMudo(null)).toBe(false);
  });
  it('señal reciente → no mudo · señal vieja (>7d) → mudo', () => {
    expect(esMudo(3)).toBe(false);
    expect(esMudo(20)).toBe(true);
  });
});

describe('resumirRadar', () => {
  it('cuenta gravedades · badge = severo+crítico · capital en riesgo excluye leves', () => {
    const filas = [
      fila({ gravedad: 'critico', capitalUSD: 5000 }),
      fila({ gravedad: 'severo', capitalUSD: 3000 }),
      fila({ gravedad: 'leve', capitalUSD: 1000 }),
    ];
    const r = resumirRadar(filas);
    expect(r.criticos).toBe(1);
    expect(r.severos).toBe(1);
    expect(r.leves).toBe(1);
    expect(r.badge).toBe(2); // severo + crítico (el leve no demanda acción)
    expect(r.capitalEnRiesgoUSD).toBe(8000); // 5000 + 3000 · NO el leve
  });
});

describe('ordenarRadar', () => {
  it('crítico → severo → leve, y por ratio desc dentro de cada gravedad', () => {
    const filas = [
      fila({ id: 'L', gravedad: 'leve', ratio: 1.2 }),
      fila({ id: 'C', gravedad: 'critico', ratio: 2.1 }),
      fila({ id: 'S', gravedad: 'severo', ratio: 1.7 }),
    ];
    expect(ordenarRadar(filas).map((f) => f.id)).toEqual(['C', 'S', 'L']);
  });
  it('conserva el culpable por pierna (proveedor vs viajero) al ordenar', () => {
    const filas = [
      fila({ id: 'P', gravedad: 'severo', ratio: 1.6, culpable: 'proveedor' }),
      fila({ id: 'V', gravedad: 'critico', ratio: 2.3, culpable: 'viajero' }),
    ];
    const ordenadas = ordenarRadar(filas);
    expect(ordenadas.map((f) => f.id)).toEqual(['V', 'P']);
    expect(ordenadas[0].culpable).toBe('viajero');
    expect(ordenadas[1].culpable).toBe('proveedor');
  });
});
