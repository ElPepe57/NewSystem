import { describe, it, expect } from 'vitest';
import {
  evaluarCandado,
  seleccionarCandidatosApuesta,
  computeStrip,
  buildReqEfimero,
  buildFormsRestock,
  buildFormApuesta,
  buildFormComprometida,
} from './creacionGuiada.helper';
import type { Producto } from '../../../types/producto.types';
import type { Requerimiento } from '../../../types/requerimiento.types';

const prod = (p: Record<string, unknown> = {}): Producto =>
  ({ id: 'P', estado: 'activo', ctruPromedio: 0, stockPeru: 0, stockUSA: 0, stockTransito: 0, investigacion: undefined, ...p }) as unknown as Producto;

describe('evaluarCandado', () => {
  it('producto NUEVO sin investigación → candado CERRADO', () => {
    const c = evaluarCandado(prod({ investigacion: undefined }));
    expect(c.esNuevo).toBe(true);
    expect(c.habilitado).toBe(false);
  });
  it('producto NUEVO con investigación (≥1 prov + ≥1 comp) → candado ABIERTO', () => {
    const c = evaluarCandado(prod({ investigacion: { proveedoresUSA: [{}], competidoresPeru: [{}] } }));
    expect(c.esNuevo).toBe(true);
    expect(c.habilitado).toBe(true);
  });
  it('producto PROBADO (con stock/ctru) → pasa sin candado', () => {
    expect(evaluarCandado(prod({ ctruPromedio: 10, stockPeru: 5 })).esNuevo).toBe(false);
    expect(evaluarCandado(prod({ ctruPromedio: 10, stockPeru: 5 })).habilitado).toBe(true);
  });
});

describe('seleccionarCandidatosApuesta', () => {
  it('solo nuevos con candado abierto, no ya-apostados, no probados', () => {
    const productos = [
      prod({ id: 'NUEVO_OK', investigacion: { proveedoresUSA: [{}], competidoresPeru: [{}] } }),
      prod({ id: 'NUEVO_SIN_INV', investigacion: undefined }),
      prod({ id: 'PROBADO', ctruPromedio: 10, stockPeru: 5 }),
      prod({ id: 'YA_APOSTADO', investigacion: { proveedoresUSA: [{}], competidoresPeru: [{}] } }),
    ];
    const reqs = [
      { subtipo: 'apuesta', estado: 'pendiente', productos: [{ productoId: 'YA_APOSTADO' }] },
    ] as unknown as Requerimiento[];
    const ids = seleccionarCandidatosApuesta(productos, reqs).map((c) => c.producto.id);
    expect(ids).toEqual(['NUEVO_OK']);
  });
});

describe('computeStrip', () => {
  it('valor + margen + impacto en caja (entra)', () => {
    const req = buildReqEfimero([{ precioEstimadoUSD: 10, precioVentaPEN: 100, cantidadSolicitada: 5 }], 4);
    const strip = computeStrip(req, 4, 10000, 100);
    expect(strip.valorUSD).toBe(50);
    expect(strip.valorPEN).toBe(200);
    expect(strip.entra).toBe(true);
    expect(strip.impactoCajaPct).toBeCloseTo(2, 0);
    expect(strip.margenPct).toBeGreaterThan(0);
  });
  it('NO entra si el valor supera la caja', () => {
    const req = buildReqEfimero([{ precioEstimadoUSD: 1000, cantidadSolicitada: 100 }], 4);
    expect(computeStrip(req, 4, 1000, undefined).entra).toBe(false);
  });
  it('caja null → impacto undefined', () => {
    const req = buildReqEfimero([{ precioEstimadoUSD: 10, cantidadSolicitada: 1 }], 4);
    expect(computeStrip(req, 4, null).impactoCajaPct).toBeUndefined();
  });
});

describe('build forms por modo', () => {
  it('restock → subtipo restock · 1 form por sugerencia · cantidad sugerida', () => {
    const sugs = [{ producto: { id: 'P1' }, stockActual: 2, stockMinimo: 10, cantidadSugerida: 8, urgencia: 'alta', precioEstimadoUSD: 5, razon: 'bajo' }] as any;
    const forms = buildFormsRestock(sugs, {});
    expect(forms).toHaveLength(1);
    expect(forms[0].subtipo).toBe('restock');
    expect(forms[0].productos[0].cantidadSolicitada).toBe(8);
    expect(forms[0].prioridad).toBe('alta');
  });
  it('apuesta → subtipo apuesta + tesis trim + precio', () => {
    const cand = { producto: { id: 'P1', investigacion: { precioUSAPromedio: 10 } }, candado: {}, proveedorMinUSD: 8 } as any;
    const f = buildFormApuesta(cand, 5, '  mi tesis  ', 50, 'media');
    expect(f.subtipo).toBe('apuesta');
    expect(f.tesis).toBe('mi tesis');
    expect(f.productos[0].precioEstimadoUSD).toBe(8);
    expect(f.productos[0].precioVentaPEN).toBe(50);
  });
  it('comprometida → origen demanda_comprometida + cotización vinculada', () => {
    const f = buildFormComprometida({ id: 'C1', numeroVenta: 'COT-1', nombreCliente: 'Ana', productos: [{ productoId: 'P1', cantidad: 3, precioUnitario: 60 }] });
    expect(f.origen).toBe('demanda_comprometida');
    expect(f.cotizacionId).toBe('C1');
    expect(f.nombreClienteSolicitante).toBe('Ana');
    expect(f.productos[0].cantidadSolicitada).toBe(3);
  });
});
