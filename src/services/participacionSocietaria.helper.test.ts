import { describe, it, expect } from 'vitest';
import {
  sumaParticipacion,
  disponibleParaSocio,
  estadoCapTable,
} from './participacionSocietaria.helper';

describe('participacionSocietaria.helper', () => {
  const dos = [
    { uid: 'a', porcentajeParticipacion: 51 },
    { uid: 'b', porcentajeParticipacion: 49 },
  ];

  it('suma todas las participaciones (sin % cuenta como 0)', () => {
    expect(sumaParticipacion(dos)).toBe(100);
    expect(sumaParticipacion([])).toBe(0);
    expect(sumaParticipacion([{ uid: 'x' }])).toBe(0);
  });

  it('disponible para un socio existente = 100 − los demás', () => {
    expect(disponibleParaSocio(dos, 'a')).toBe(51); // 100 − 49 (b)
    expect(disponibleParaSocio(dos, 'b')).toBe(49); // 100 − 51 (a)
  });

  it('disponible para un socio NUEVO = lo que queda libre', () => {
    expect(disponibleParaSocio(dos, 'c')).toBe(0); // 100 − 100 → no hay margen
    expect(disponibleParaSocio([{ uid: 'a', porcentajeParticipacion: 60 }], 'c')).toBe(40);
  });

  it('disponible nunca es negativo aunque el cap table ya esté excedido', () => {
    const excedido = [
      { uid: 'a', porcentajeParticipacion: 80 },
      { uid: 'b', porcentajeParticipacion: 80 },
    ];
    expect(disponibleParaSocio(excedido, 'a')).toBe(20); // 100 − 80 (b)
    expect(disponibleParaSocio(excedido, 'c')).toBe(0); // 100 − 160 → clamp a 0
  });

  it('estado del cap table: completo / excedido / incompleto', () => {
    expect(estadoCapTable(100)).toBe('completo');
    expect(estadoCapTable(100.0005)).toBe('completo'); // dentro de la tolerancia
    expect(estadoCapTable(120)).toBe('excedido');
    expect(estadoCapTable(85)).toBe('incompleto');
    expect(estadoCapTable(0)).toBe('incompleto');
  });
});
