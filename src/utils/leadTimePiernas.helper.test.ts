import { describe, it, expect } from 'vitest';
import {
  diasEntre,
  leadTimePiernaA,
  leadTimePiernaB,
  resumirLeadTime,
} from './leadTimePiernas.helper';

const ts = (dia: number) => ({ toMillis: () => dia * 1000 * 60 * 60 * 24 });

describe('diasEntre', () => {
  it('cuenta días enteros', () => {
    expect(diasEntre(ts(0), ts(7))).toBe(7);
  });
  it('null si falta una fecha', () => {
    expect(diasEntre(undefined, ts(7))).toBeNull();
    expect(diasEntre(ts(3), null)).toBeNull();
  });
  it('null si el rango es negativo (dato inválido)', () => {
    expect(diasEntre(ts(10), ts(3))).toBeNull();
  });
});

describe('leadTimePiernaA (proveedor · ponderado por unidades)', () => {
  it('promedio ponderado por unidades de las tandas medibles', () => {
    // tanda1: 6 días × 10 un · tanda2: 10 días × 30 un → (60+300)/40 = 9
    const tandas = [
      { fechaDespachoProveedor: ts(0), fechaEntrega: ts(6), unidadesIds: Array(10).fill('u') },
      { fechaDespachoProveedor: ts(0), fechaEntrega: ts(10), unidadesIds: Array(30).fill('u') },
    ];
    expect(leadTimePiernaA(tandas)).toBe(9);
  });
  it('ignora tandas sin ambas fechas', () => {
    const tandas = [
      { fechaDespachoProveedor: ts(0), fechaEntrega: ts(8), unidadesIds: ['u'] },
      { fechaEntrega: ts(5), unidadesIds: ['u'] }, // sin despacho → ignorada
    ];
    expect(leadTimePiernaA(tandas)).toBe(8);
  });
  it('null si no hay tandas medibles (envío plano · degrada honesto)', () => {
    expect(leadTimePiernaA([])).toBeNull();
    expect(leadTimePiernaA(undefined)).toBeNull();
    expect(leadTimePiernaA([{ fechaEntrega: ts(5) }])).toBeNull();
  });
});

describe('leadTimePiernaB (viajero · días en tránsito)', () => {
  it('prefiere el campo diasEnTransito ya computado', () => {
    expect(leadTimePiernaB({ diasEnTransito: 12, fechaSalida: ts(0), fechaLlegadaReal: ts(99) })).toBe(12);
  });
  it('deriva de fechaLlegadaReal − fechaSalida si no hay diasEnTransito', () => {
    expect(leadTimePiernaB({ fechaSalida: ts(2), fechaLlegadaReal: ts(15) })).toBe(13);
  });
  it('null si no es medible', () => {
    expect(leadTimePiernaB({ fechaSalida: ts(2) })).toBeNull();
  });
});

describe('resumirLeadTime', () => {
  it('promedio/min/max/desviación/n', () => {
    const r = resumirLeadTime([10, 10, 10]);
    expect(r).toEqual({ promedio: 10, min: 10, max: 10, desviacion: 0, n: 3 });
  });
  it('null si no hay muestras', () => {
    expect(resumirLeadTime([])).toBeNull();
  });
  it('descarta valores inválidos (negativos)', () => {
    const r = resumirLeadTime([8, -1, 12]);
    expect(r?.n).toBe(2);
    expect(r?.promedio).toBe(10);
  });
});
