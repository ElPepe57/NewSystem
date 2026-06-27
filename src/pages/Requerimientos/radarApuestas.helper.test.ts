import { describe, it, expect } from 'vitest';
import {
  evaluarVeredicto,
  resumirRadar,
  ordenarRadar,
  tonoRecuperacion,
  type FilaApuesta,
} from './radarApuestas.helper';

const fila = (p: Partial<FilaApuesta>): FilaApuesta =>
  ({
    requerimientoId: 'R', productoId: 'P', nombre: 'X', tesis: '', ctruInvertidoUSD: 100,
    recuperacionPct: 0, rotacionLabel: 'media', rotacionTono: 'slate', diasDesdeCreacion: 30,
    veredicto: 'en_evaluacion', ...p,
  });

describe('evaluarVeredicto', () => {
  it('recuperó CTRU (≥100%) → acierto, aunque sea antes del año', () => {
    expect(evaluarVeredicto(118, 96)).toBe('acierto');
    expect(evaluarVeredicto(100, 10)).toBe('acierto');
  });
  it('dentro del ciclo y sin recuperar → en evaluación', () => {
    expect(evaluarVeredicto(52, 120)).toBe('en_evaluacion');
    expect(evaluarVeredicto(0, 365)).toBe('en_evaluacion'); // día 365 todavía cuenta
  });
  it('pasó el año sin recuperar → fallida', () => {
    expect(evaluarVeredicto(14, 371)).toBe('fallida');
    expect(evaluarVeredicto(99, 366)).toBe('fallida');
  });
});

describe('tonoRecuperacion', () => {
  it('recuperado emerald · avanzando sky · estancado rose', () => {
    expect(tonoRecuperacion(118)).toBe('emerald');
    expect(tonoRecuperacion(52)).toBe('sky');
    expect(tonoRecuperacion(14)).toBe('rose');
  });
});

describe('resumirRadar', () => {
  it('cuenta veredictos + tasa de acierto sobre resueltas', () => {
    const filas = [
      fila({ veredicto: 'acierto' }), fila({ veredicto: 'acierto' }),
      fila({ veredicto: 'fallida' }),
      fila({ veredicto: 'en_evaluacion' }), fila({ veredicto: 'en_evaluacion' }),
    ];
    const r = resumirRadar(filas);
    expect(r.aciertos).toBe(2);
    expect(r.fallidas).toBe(1);
    expect(r.enEvaluacion).toBe(2);
    expect(r.tasaAciertoPct).toBe(67); // 2/(2+1)
  });
  it('sin resueltas → tasa null (no divide por cero)', () => {
    expect(resumirRadar([fila({ veredicto: 'en_evaluacion' })]).tasaAciertoPct).toBeNull();
  });
});

describe('ordenarRadar', () => {
  it('prioriza acción: fallida → en evaluación → acierto, y por día desc', () => {
    const filas = [
      fila({ requerimientoId: 'A', veredicto: 'acierto', diasDesdeCreacion: 96 }),
      fila({ requerimientoId: 'E', veredicto: 'en_evaluacion', diasDesdeCreacion: 120 }),
      fila({ requerimientoId: 'F', veredicto: 'fallida', diasDesdeCreacion: 371 }),
    ];
    expect(ordenarRadar(filas).map((f) => f.requerimientoId)).toEqual(['F', 'E', 'A']);
  });
});
