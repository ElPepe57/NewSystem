import { describe, it, expect } from 'vitest';
import {
  resolverLente,
  calcularMargen,
  esteReqPEN,
  computePanelDecision,
  type PanelDecisionInput,
} from './panelDecision.helper';
import type { Requerimiento, ProductoRequerimiento } from '../../types/requerimiento.types';

const prod = (p: Partial<ProductoRequerimiento> = {}): ProductoRequerimiento => ({
  productoId: 'P1', sku: 'SKU1', marca: 'M', nombreComercial: 'N',
  cantidadSolicitada: 20, cantidadAsignada: 0, cantidadRecibida: 0, cantidadPendiente: 20,
  cantidadEnOC: 0, pendienteCompra: 20, completado: false,
  precioEstimadoUSD: 10, ...p,
});

const makeReq = (r: Partial<Requerimiento> = {}): Requerimiento => ({
  id: 'R1', numeroRequerimiento: 'REQ-1',
  origen: 'administrativo', subtipo: 'manual',
  productos: [prod()], asignaciones: [],
  estado: 'pendiente', prioridad: 'normal',
  fechaSolicitud: {} as any, solicitadoPor: 'u1', creadoPor: 'u1', fechaCreacion: {} as any,
  expectativa: { tcInvestigacion: 4, costoEstimadoUSD: 200, costoEstimadoPEN: 800, costoTotalEstimadoUSD: 200, costoTotalEstimadoPEN: 800 },
  ...r,
});

describe('resolverLente', () => {
  it('mapea origen/subtipo a la lente correcta', () => {
    expect(resolverLente({ origen: 'administrativo', subtipo: 'restock' })).toBe('restock');
    expect(resolverLente({ origen: 'administrativo', subtipo: 'apuesta' })).toBe('apuesta');
    expect(resolverLente({ origen: 'administrativo', subtipo: 'manual' })).toBe('manual');
    expect(resolverLente({ origen: 'administrativo', subtipo: undefined })).toBe('manual');
    expect(resolverLente({ origen: 'demanda_comprometida', subtipo: undefined })).toBe('demanda_comprometida');
  });
});

describe('calcularMargen', () => {
  it('margen sano (≥25%) · landed + utilidad + break-even', () => {
    // landedUnit = 10 USD × tc 4 = 40 PEN · venta 60 · utilidad 20 · margen 33.3% · breakEven ceil(40×20/60)=14
    const m = calcularMargen(makeReq({ productos: [prod({ precioVentaPEN: 60 })] }))!;
    expect(m.tieneVenta).toBe(true);
    expect(m.landedUnitPEN).toBe(40);
    expect(m.utilidadUnitPEN).toBe(20);
    expect(m.margenPct).toBeCloseTo(33.33, 1);
    expect(m.breakEvenUds).toBe(14);
    expect(m.salud).toBe('sano');
  });

  it('margen flaco (entre 0 y 25%)', () => {
    // venta 50 · utilidad 10 · margen 20%
    const m = calcularMargen(makeReq({ productos: [prod({ precioVentaPEN: 50 })] }))!;
    expect(m.margenPct).toBe(20);
    expect(m.salud).toBe('flaco');
  });

  it('margen negativo · vende por debajo del costo', () => {
    const m = calcularMargen(makeReq({ productos: [prod({ precioVentaPEN: 30 })] }))!;
    expect(m.utilidadUnitPEN).toBe(-10);
    expect(m.salud).toBe('negativo');
  });

  it('sin precio de venta → tieneVenta=false, sin margen', () => {
    const m = calcularMargen(makeReq({ productos: [prod({ precioVentaPEN: undefined })] }))!;
    expect(m.tieneVenta).toBe(false);
    expect(m.margenPct).toBe(0);
    expect(m.breakEvenUds).toBe(0);
  });

  it('prorratea impuesto+flete del req por unidad', () => {
    // extras 40 USD / 20 ud = 2 USD/ud → landedUnitUSD = 12 → ×tc4 = 48
    const m = calcularMargen(makeReq({
      productos: [prod({ precioVentaPEN: 100 })],
      expectativa: { tcInvestigacion: 4, costoEstimadoUSD: 200, costoEstimadoPEN: 800, impuestoEstimadoUSD: 20, fleteEstimadoUSD: 20, costoTotalEstimadoUSD: 240, costoTotalEstimadoPEN: 960 },
    }))!;
    expect(m.landedUnitPEN).toBe(48);
  });

  it('precioVentaOverride pisa el del producto (captura inline)', () => {
    const m = calcularMargen(makeReq({ productos: [prod({ precioVentaPEN: 50 })] }), 80)!;
    expect(m.precioVentaPEN).toBe(80);
    expect(m.utilidadUnitPEN).toBe(40); // 80 - 40
  });
});

describe('esteReqPEN', () => {
  it('usa costoTotalEstimadoPEN si existe', () => {
    expect(esteReqPEN(makeReq({ expectativa: { tcInvestigacion: 4, costoEstimadoUSD: 0, costoEstimadoPEN: 0, costoTotalEstimadoUSD: 0, costoTotalEstimadoPEN: 1500 } }))).toBe(1500);
  });
  it('fallback: suma productos × TC', () => {
    const r = makeReq({ productos: [prod({ precioEstimadoUSD: 10, cantidadSolicitada: 5 })], expectativa: { tcInvestigacion: 4, costoEstimadoUSD: 0, costoEstimadoPEN: 0, costoTotalEstimadoUSD: 0, costoTotalEstimadoPEN: 0 } });
    expect(esteReqPEN(r)).toBe(200); // 10×5×4
  });
});

describe('computePanelDecision · veredicto', () => {
  const baseInput = (r: Partial<Requerimiento>, extra: Partial<PanelDecisionInput> = {}): PanelDecisionInput => ({
    req: makeReq(r), cajaDisponiblePEN: 1_000_000, ...extra,
  });

  it('demanda comprometida con adelanto pagado → recomendado', () => {
    const d = computePanelDecision(baseInput({ origen: 'demanda_comprometida', subtipo: undefined }, { demanda: { adelantoPagado: true } }));
    expect(d.lente).toBe('demanda_comprometida');
    expect(d.veredicto.nivel).toBe('recomendado');
  });

  it('restock con señal de reorden → recomendado', () => {
    const d = computePanelDecision(baseInput({ subtipo: 'restock' }, {
      restock: { puntoReorden: 22, stockNeto: 8, diasCobertura: 4, velocidadDiaria: 2, leadTimeDias: 21, stockSeguridad: 7, urgencia: 'alta', razon: 'x', cantidadSugerida: 45, necesitaReposicion: true },
    }));
    expect(d.veredicto.nivel).toBe('recomendado');
  });

  it('restock sin señal → revisar', () => {
    const d = computePanelDecision(baseInput({ subtipo: 'restock' }, {
      restock: { puntoReorden: 22, stockNeto: 50, diasCobertura: 30, velocidadDiaria: 2, leadTimeDias: 21, stockSeguridad: 7, urgencia: 'baja', razon: 'x', cantidadSugerida: 0, necesitaReposicion: false },
    }));
    expect(d.veredicto.nivel).toBe('revisar');
  });

  it('apuesta → revisar (incertidumbre)', () => {
    const d = computePanelDecision(baseInput({ subtipo: 'apuesta', productos: [prod({ precioVentaPEN: 60 })] }));
    expect(d.veredicto.nivel).toBe('revisar');
    expect(d.margen?.salud).toBe('sano');
  });

  it('apuesta con margen negativo → precaucion', () => {
    const d = computePanelDecision(baseInput({ subtipo: 'apuesta', productos: [prod({ precioVentaPEN: 30 })] }));
    expect(d.veredicto.nivel).toBe('precaucion');
  });

  it('manual con rotación alta → recomendado', () => {
    const d = computePanelDecision(baseInput({ subtipo: 'manual', productos: [prod({ precioVentaPEN: 60 })] }, {
      rotacion: { velocidadDiaria: 1.8, clasificacionRotacion: 'alta', diasCobertura: 3 },
    }));
    expect(d.veredicto.nivel).toBe('recomendado');
  });

  it('caja excedida → precaucion (override sobre la lente)', () => {
    // demanda comprometida normalmente recomendado, pero si el req excede la caja → precaucion
    const d = computePanelDecision({
      req: makeReq({ origen: 'demanda_comprometida', subtipo: undefined, expectativa: { tcInvestigacion: 4, costoEstimadoUSD: 0, costoEstimadoPEN: 0, costoTotalEstimadoUSD: 0, costoTotalEstimadoPEN: 5000 } }),
      cajaDisponiblePEN: 1000,
      demanda: { adelantoPagado: true },
    });
    expect(d.caja.estado).toBe('precaucion');
    expect(d.veredicto.nivel).toBe('precaucion');
  });

  it('caja desconocida (null) no fuerza precaucion', () => {
    const d = computePanelDecision({ req: makeReq({ subtipo: 'restock' }), cajaDisponiblePEN: null,
      restock: { puntoReorden: 22, stockNeto: 8, diasCobertura: 4, velocidadDiaria: 2, leadTimeDias: 21, stockSeguridad: 7, urgencia: 'alta', razon: 'x', cantidadSugerida: 45, necesitaReposicion: true } });
    expect(d.caja.estado).toBe('desconocido');
    expect(d.veredicto.nivel).toBe('recomendado');
  });

  it('driverOverride pisa el del req', () => {
    const d = computePanelDecision(baseInput({ subtipo: 'manual', driverDemanda: 'otro' }, { driverOverride: 'tiktok' }));
    expect(d.driver).toBe('tiktok');
  });
});
