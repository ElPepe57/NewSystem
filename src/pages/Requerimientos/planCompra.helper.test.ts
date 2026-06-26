import { describe, it, expect } from 'vitest';
import { calcularMerito, construirPlanCompra, detectarConsolidaciones } from './planCompra.helper';
import type { Requerimiento, ProductoRequerimiento, ExpectativaRequerimiento } from '../../types/requerimiento.types';

const prod = (p: Partial<ProductoRequerimiento> = {}): ProductoRequerimiento => ({
  productoId: 'P1', sku: 'SKU1', marca: 'M', nombreComercial: 'Prod 1',
  cantidadSolicitada: 10, cantidadAsignada: 0, cantidadRecibida: 0, cantidadPendiente: 10,
  cantidadEnOC: 0, pendienteCompra: 10, completado: false, precioEstimadoUSD: 10, ...p,
});

const exp = (pen: number): ExpectativaRequerimiento => ({
  tcInvestigacion: 4, costoEstimadoUSD: 0, costoEstimadoPEN: 0, costoTotalEstimadoUSD: 0, costoTotalEstimadoPEN: pen,
});

const makeReq = (r: Partial<Requerimiento> = {}): Requerimiento => ({
  id: 'R1', numeroRequerimiento: 'REQ-1', origen: 'administrativo', subtipo: 'manual',
  productos: [prod()], asignaciones: [], estado: 'pendiente', prioridad: 'normal',
  fechaSolicitud: {} as any, solicitadoPor: 'u', creadoPor: 'u', fechaCreacion: {} as any,
  expectativa: exp(1000), ...r,
});

describe('calcularMerito', () => {
  it('ordena por certeza de demanda: demanda > restock > manual > apuesta', () => {
    const demanda = calcularMerito({ origen: 'demanda_comprometida', subtipo: undefined, prioridad: 'normal' });
    const restock = calcularMerito({ origen: 'administrativo', subtipo: 'restock', prioridad: 'normal' });
    const manual = calcularMerito({ origen: 'administrativo', subtipo: 'manual', prioridad: 'normal' });
    const apuesta = calcularMerito({ origen: 'administrativo', subtipo: 'apuesta', prioridad: 'normal' });
    expect(demanda).toBeGreaterThan(restock);
    expect(restock).toBeGreaterThan(manual);
    expect(manual).toBeGreaterThan(apuesta);
  });
  it('dentro del mismo origen, prioridad desempata', () => {
    const urgente = calcularMerito({ origen: 'administrativo', subtipo: 'restock', prioridad: 'urgente' });
    const baja = calcularMerito({ origen: 'administrativo', subtipo: 'restock', prioridad: 'baja' });
    expect(urgente).toBeGreaterThan(baja);
  });
});

describe('construirPlanCompra · waterline', () => {
  it('ordena por mérito y corta por acumulado vs tope', () => {
    const reqs = [
      makeReq({ id: 'A', origen: 'demanda_comprometida', subtipo: undefined, expectativa: exp(1000) }),
      makeReq({ id: 'B', subtipo: 'restock', expectativa: exp(800) }),
      makeReq({ id: 'C', subtipo: 'apuesta', expectativa: exp(500) }),
    ];
    const plan = construirPlanCompra(reqs, 1500);
    // orden por mérito: demanda → restock → apuesta
    expect(plan.filas.map((f) => f.req.id)).toEqual(['A', 'B', 'C']);
    // waterline: A acum 1000 ≤ 1500 entra · B acum 1800 > 1500 difiere · C difiere
    expect(plan.filas[0].entra).toBe(true);
    expect(plan.filas[1].entra).toBe(false);
    expect(plan.filas[2].entra).toBe(false);
    expect(plan.countEntra).toBe(1);
    expect(plan.countDifiere).toBe(2);
    expect(plan.totalEntraPEN).toBe(1000);
    expect(plan.totalColaPEN).toBe(2300);
  });

  it('tope amplio → entra todo', () => {
    const reqs = [makeReq({ id: 'A', expectativa: exp(1000) }), makeReq({ id: 'B', expectativa: exp(800) })];
    const plan = construirPlanCompra(reqs, 999999);
    expect(plan.countEntra).toBe(2);
    expect(plan.countDifiere).toBe(0);
  });

  it('solo cuenta la cola (excluye completado/cancelado/en_proceso)', () => {
    const reqs = [
      makeReq({ id: 'A', estado: 'pendiente' }),
      makeReq({ id: 'B', estado: 'completado' }),
      makeReq({ id: 'C', estado: 'cancelado' }),
    ];
    expect(construirPlanCompra(reqs, 999999).filas).toHaveLength(1);
  });
});

describe('detectarConsolidaciones', () => {
  it('producto pedido por 2+ reqs → oportunidad', () => {
    const reqs = [
      makeReq({ id: 'A', numeroRequerimiento: 'REQ-A', productos: [prod({ productoId: 'P1', pendienteCompra: 10, proveedorSugerido: 'Amazon' })] }),
      makeReq({ id: 'B', numeroRequerimiento: 'REQ-B', productos: [prod({ productoId: 'P1', pendienteCompra: 5, proveedorSugerido: 'Amazon' })] }),
      makeReq({ id: 'C', numeroRequerimiento: 'REQ-C', productos: [prod({ productoId: 'P2', pendienteCompra: 3 })] }),
    ];
    const ops = detectarConsolidaciones(reqs);
    expect(ops).toHaveLength(1);
    expect(ops[0].productoId).toBe('P1');
    expect(ops[0].reqsIds.sort()).toEqual(['A', 'B']);
    expect(ops[0].cantidadTotal).toBe(15);
    expect(ops[0].proveedorComun).toBe('Amazon'); // ambos sugieren Amazon
  });

  it('proveedorComun undefined si difieren', () => {
    const reqs = [
      makeReq({ id: 'A', productos: [prod({ productoId: 'P1', proveedorSugerido: 'Amazon' })] }),
      makeReq({ id: 'B', productos: [prod({ productoId: 'P1', proveedorSugerido: 'iHerb' })] }),
    ];
    expect(detectarConsolidaciones(reqs)[0].proveedorComun).toBeUndefined();
  });

  it('producto sin compra pendiente no cuenta', () => {
    const reqs = [
      makeReq({ id: 'A', productos: [prod({ productoId: 'P1', pendienteCompra: 0 })] }),
      makeReq({ id: 'B', productos: [prod({ productoId: 'P1', pendienteCompra: 0 })] }),
    ];
    expect(detectarConsolidaciones(reqs)).toHaveLength(0);
  });
});
