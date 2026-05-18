/**
 * Tests · validaciones puras Caja Recaudadora (D5 + D12 · chk5.D-S1f · F6).
 *
 * Cubre helpers exportados de `productoFinanciero.types.ts` que NO dependen
 * de Firestore · puros · testables aislados:
 *   - requiereResponsableTercero
 *   - admiteCanalesRecaudacion
 *   - validarCanalRecaudacion
 *   - validarCanalesAceptados
 */

import { describe, it, expect } from 'vitest';
import {
  requiereResponsableTercero,
  admiteCanalesRecaudacion,
  validarCanalRecaudacion,
  validarCanalesAceptados,
  type CanalAceptado,
  type TipoProductoFinanciero,
} from './productoFinanciero.types';

// ─── requiereResponsableTercero ──────────────────────────────────────

describe('requiereResponsableTercero', () => {
  it('retorna true solo para caja_recaudadora', () => {
    expect(requiereResponsableTercero('caja_recaudadora')).toBe(true);
  });
  it('retorna false para los otros 6 tipos', () => {
    const otros: TipoProductoFinanciero[] = [
      'cuenta_corriente',
      'cuenta_ahorros',
      'tarjeta_credito',
      'tarjeta_debito',
      'caja_efectivo',
      'wallet_digital',
    ];
    for (const tipo of otros) {
      expect(requiereResponsableTercero(tipo)).toBe(false);
    }
  });
});

// ─── admiteCanalesRecaudacion ────────────────────────────────────────

describe('admiteCanalesRecaudacion', () => {
  it('retorna true solo para caja_recaudadora', () => {
    expect(admiteCanalesRecaudacion('caja_recaudadora')).toBe(true);
  });
  it('retorna false para cuentas bancarias (que usan canalesDigitales, no canalesAceptados)', () => {
    expect(admiteCanalesRecaudacion('cuenta_corriente')).toBe(false);
    expect(admiteCanalesRecaudacion('cuenta_ahorros')).toBe(false);
  });
});

// ─── validarCanalRecaudacion ─────────────────────────────────────────

describe('validarCanalRecaudacion', () => {
  it('OK · efectivo NO requiere identificador', () => {
    const canal: CanalAceptado = { tipo: 'efectivo', activo: true };
    expect(validarCanalRecaudacion(canal)).toBeNull();
  });
  it('OK · yape con identificador válido', () => {
    const canal: CanalAceptado = {
      tipo: 'yape',
      identificador: '+51 999-888-777',
      activo: true,
    };
    expect(validarCanalRecaudacion(canal)).toBeNull();
  });
  it('FALLA · yape sin identificador', () => {
    const canal: CanalAceptado = { tipo: 'yape', activo: true };
    expect(validarCanalRecaudacion(canal)).toContain('falta identificador');
  });
  it('FALLA · pos_niubiz con identificador vacío whitespace', () => {
    const canal: CanalAceptado = {
      tipo: 'pos_niubiz',
      identificador: '   ',
      activo: true,
    };
    expect(validarCanalRecaudacion(canal)).toContain('falta identificador');
  });
  it('OK · transferencia con CCI', () => {
    const canal: CanalAceptado = {
      tipo: 'transferencia',
      identificador: '00219400123456701258',
      activo: true,
    };
    expect(validarCanalRecaudacion(canal)).toBeNull();
  });
});

// ─── validarCanalesAceptados ────────────────────────────────────────

describe('validarCanalesAceptados', () => {
  it('FALLA · array vacío', () => {
    expect(validarCanalesAceptados([])).toContain('al menos 1 canal aceptado');
  });
  it('FALLA · todos los canales inactivos', () => {
    const canales: CanalAceptado[] = [
      { tipo: 'yape', identificador: '+51 999-888-777', activo: false },
      { tipo: 'plin', identificador: '+51 999-888-777', activo: false },
    ];
    expect(validarCanalesAceptados(canales)).toContain('al menos 1 canal activo');
  });
  it('FALLA · canales duplicados (mismo tipo)', () => {
    const canales: CanalAceptado[] = [
      { tipo: 'yape', identificador: '+51 999-888-777', activo: true },
      { tipo: 'yape', identificador: '+51 999-000-000', activo: true },
    ];
    expect(validarCanalesAceptados(canales)).toContain('duplicado');
  });
  it('FALLA · canal con identificador faltante', () => {
    const canales: CanalAceptado[] = [
      { tipo: 'pos_izipay', activo: true },
    ];
    expect(validarCanalesAceptados(canales)).toContain('falta identificador');
  });
  it('OK · mix válido yape + plin + efectivo (efectivo sin id)', () => {
    const canales: CanalAceptado[] = [
      { tipo: 'yape', identificador: '+51 999-888-777', activo: true },
      { tipo: 'plin', identificador: '+51 999-888-777', activo: true },
      { tipo: 'efectivo', activo: true },
    ];
    expect(validarCanalesAceptados(canales)).toBeNull();
  });
  it('OK · canal inactivo no bloquea si hay otro activo', () => {
    const canales: CanalAceptado[] = [
      { tipo: 'yape', identificador: '+51 999-888-777', activo: true },
      { tipo: 'pos_niubiz', identificador: 'MID-12345', activo: false },
    ];
    expect(validarCanalesAceptados(canales)).toBeNull();
  });
});
