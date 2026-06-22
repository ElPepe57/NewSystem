import { describe, it, expect } from 'vitest';
import {
  delegacionVigente,
  tieneAutoridadDelegada,
  etiquetaDelegado,
  type DelegacionAutorizacion,
} from './delegacionAutorizacion.helper';

const AHORA = 1_000_000_000_000; // ms fijo para tests deterministas
const ts = (ms: number) => ({ toMillis: () => ms });

const base: DelegacionAutorizacion = {
  id: 'd1',
  delegadoPor: 'socio-A',
  tipo: 'usuario',
  delegadoAUsuario: 'gerente-G',
  activa: true,
};

describe('delegacionVigente', () => {
  it('activa sin vigencia → vigente', () => {
    expect(delegacionVigente(base, AHORA)).toBe(true);
  });
  it('revocada (activa=false) → NO vigente', () => {
    expect(delegacionVigente({ ...base, activa: false }, AHORA)).toBe(false);
  });
  it('expirada (hasta < ahora) → NO vigente', () => {
    expect(delegacionVigente({ ...base, hasta: ts(AHORA - 1000) }, AHORA)).toBe(false);
  });
  it('aún no empieza (desde > ahora) → NO vigente', () => {
    expect(delegacionVigente({ ...base, desde: ts(AHORA + 1000) }, AHORA)).toBe(false);
  });
  it('dentro del rango → vigente', () => {
    expect(delegacionVigente({ ...base, desde: ts(AHORA - 1000), hasta: ts(AHORA + 1000) }, AHORA)).toBe(true);
  });
});

describe('tieneAutoridadDelegada · por usuario', () => {
  it('el usuario delegado tiene autoridad', () => {
    expect(tieneAutoridadDelegada([base], 'gerente-G', ['gerente'], AHORA)).toBe(true);
  });
  it('otro usuario NO', () => {
    expect(tieneAutoridadDelegada([base], 'otro-X', ['gerente'], AHORA)).toBe(false);
  });
  it('si la delegación está revocada → NO', () => {
    expect(tieneAutoridadDelegada([{ ...base, activa: false }], 'gerente-G', ['gerente'], AHORA)).toBe(false);
  });
});

describe('tieneAutoridadDelegada · por rol', () => {
  const porRol: DelegacionAutorizacion = { id: 'd2', delegadoPor: 'socio-A', tipo: 'rol', delegadoARol: 'gerente', activa: true };
  it('cualquiera con el rol delegado tiene autoridad', () => {
    expect(tieneAutoridadDelegada([porRol], 'cualquiera', ['gerente', 'vendedor'], AHORA)).toBe(true);
  });
  it('sin el rol → NO', () => {
    expect(tieneAutoridadDelegada([porRol], 'cualquiera', ['vendedor'], AHORA)).toBe(false);
  });
});

describe('etiquetaDelegado', () => {
  it('usuario → nombre', () => {
    expect(etiquetaDelegado({ ...base, delegadoANombre: 'Juan Pérez' })).toBe('Juan Pérez');
  });
  it('rol → "Rol: X"', () => {
    expect(etiquetaDelegado({ id: 'd', delegadoPor: 'a', tipo: 'rol', delegadoARol: 'gerente', activa: true })).toBe('Rol: gerente');
  });
});
