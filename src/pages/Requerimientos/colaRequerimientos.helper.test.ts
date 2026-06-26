import { describe, it, expect } from 'vitest';
import { analizarCola } from './colaRequerimientos.helper';
import type { Requerimiento, ProductoRequerimiento, ExpectativaRequerimiento } from '../../types/requerimiento.types';

const prod = (p: Partial<ProductoRequerimiento> = {}): ProductoRequerimiento => ({
  productoId: 'P', sku: 'S', marca: 'M', nombreComercial: 'N',
  cantidadSolicitada: 1, cantidadAsignada: 0, cantidadRecibida: 0, cantidadPendiente: 1,
  cantidadEnOC: 0, pendienteCompra: 1, completado: false,
  precioEstimadoUSD: 10, precioVentaPEN: 50, ...p,
});

const exp = (pen: number): ExpectativaRequerimiento => ({
  tcInvestigacion: 4, costoEstimadoUSD: 0, costoEstimadoPEN: 0,
  costoTotalEstimadoUSD: 0, costoTotalEstimadoPEN: pen,
});

const makeReq = (r: Partial<Requerimiento> = {}): Requerimiento => ({
  id: 'R', numeroRequerimiento: 'REQ', origen: 'administrativo', subtipo: 'manual',
  productos: [prod()], asignaciones: [], estado: 'pendiente', prioridad: 'normal',
  fechaSolicitud: {} as any, solicitadoPor: 'u', creadoPor: 'u', fechaCreacion: {} as any,
  expectativa: exp(1000), driverDemanda: 'tiktok', tesis: 'x', ...r,
});

describe('analizarCola', () => {
  it('cola vacía → todo en cero', () => {
    const a = analizarCola([], 1000);
    expect(a.enCola).toBe(0);
    expect(a.totalPendientePEN).toBe(0);
    expect(a.enPresion).toBe(false);
    expect(a.mix).toEqual([]);
  });

  it('solo cuenta estados de cola (pendiente/aprobado/parcial)', () => {
    const reqs = [
      makeReq({ estado: 'pendiente' }),
      makeReq({ estado: 'aprobado' }),
      makeReq({ estado: 'parcial' }),
      makeReq({ estado: 'completado' }),
      makeReq({ estado: 'cancelado' }),
      makeReq({ estado: 'en_proceso' }),
      makeReq({ estado: 'borrador' }),
    ];
    expect(analizarCola(reqs, null).enCola).toBe(3);
  });

  it('total + mix por origen ponderado por gasto (ordenado desc)', () => {
    const reqs = [
      makeReq({ origen: 'demanda_comprometida', subtipo: undefined, expectativa: exp(1000) }),
      makeReq({ subtipo: 'restock', expectativa: exp(500) }),
      makeReq({ subtipo: 'apuesta', expectativa: exp(500) }),
    ];
    const a = analizarCola(reqs, null);
    expect(a.totalPendientePEN).toBe(2000);
    expect(a.mix[0].lente).toBe('demanda_comprometida'); // mayor gasto primero
    expect(a.mix.find((m) => m.lente === 'demanda_comprometida')!.pct).toBe(50);
    expect(a.mix.find((m) => m.lente === 'restock')!.pct).toBe(25);
  });

  it('higiene: apuesta sin tesis · manual sin driver · sin precio venta', () => {
    const reqs = [
      makeReq({ subtipo: 'apuesta', tesis: undefined }),                               // apuesta sin tesis
      makeReq({ subtipo: 'manual', driverDemanda: undefined }),                        // manual sin driver
      makeReq({ subtipo: 'apuesta', tesis: 'ok', productos: [prod({ precioVentaPEN: undefined })] }), // sin precio
    ];
    const a = analizarCola(reqs, null);
    expect(a.higiene.apuestasSinTesis).toBe(1);
    expect(a.higiene.manualesSinDriver).toBe(1);
    expect(a.higiene.sinPrecioVenta).toBe(1);
  });

  it('presión de caja: total excede caja → exceso + ratio', () => {
    const a = analizarCola([makeReq({ expectativa: exp(2000) })], 1500);
    expect(a.totalPendientePEN).toBe(2000);
    expect(a.enPresion).toBe(true);
    expect(a.excesoPEN).toBe(500);
    expect(a.ratioColaCaja).toBeCloseTo(1.33, 1);
  });

  it('dentro de caja → sin presión', () => {
    const a = analizarCola([makeReq({ expectativa: exp(1000) })], 5000);
    expect(a.enPresion).toBe(false);
    expect(a.excesoPEN).toBe(0);
  });

  it('caja desconocida (null) → sin presión, ratio null', () => {
    const a = analizarCola([makeReq({ expectativa: exp(2000) })], null);
    expect(a.enPresion).toBe(false);
    expect(a.excesoPEN).toBe(0);
    expect(a.ratioColaCaja).toBe(null);
  });
});
