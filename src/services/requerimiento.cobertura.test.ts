import { describe, it, expect } from 'vitest';
import { esFirme, recomputarCoberturaProductos } from './requerimiento.cobertura';

// ── factories ───────────────────────────────────────────────────────────────
const ref = (cantidad: number, estadoOC?: string, estado?: 'vigente' | 'cancelada') =>
  ({ ordenCompraId: 'OC', ordenCompraNumero: 'X', cantidad, estadoOC, estado });
const prod = (cantidadSolicitada: number, refs: ReturnType<typeof ref>[] = []) =>
  ({ productoId: 'P', cantidadSolicitada, ordenCompraRefs: refs });

describe('esFirme', () => {
  it('cuenta los estados firmes (confirmada en adelante + legacy)', () => {
    for (const e of ['confirmada', 'en_proceso', 'despachada', 'completada', 'enviada', 'en_transito', 'recibida_parcial', 'recibida']) {
      expect(esFirme(e)).toBe(true);
    }
  });
  it('NO cuenta borrador ni cancelada', () => {
    expect(esFirme('borrador')).toBe(false);
    expect(esFirme('cancelada')).toBe(false);
  });
  it('ref legacy sin estadoOC se trata como firme (preserva comportamiento hasta backfill)', () => {
    expect(esFirme(undefined)).toBe(true);
    expect(esFirme(null)).toBe(true);
  });
});

describe('recomputarCoberturaProductos · cobertura derivada (§4)', () => {
  it('OC en borrador NO cuenta (gate desde enviada)', () => {
    const { productos, ocCoverage, estadoSugerido } = recomputarCoberturaProductos([prod(10, [ref(10, 'borrador')])]);
    expect(productos[0].cantidadEnOC).toBe(0);
    expect(productos[0].pendienteCompra).toBe(10);
    expect(ocCoverage.porcentaje).toBe(0);
    expect(estadoSugerido).toBe('aprobado');
  });

  it('OC enviada cuenta y sube el estado a en_proceso', () => {
    const { productos, ocCoverage, estadoSugerido } = recomputarCoberturaProductos([prod(10, [ref(10, 'enviada')])]);
    expect(productos[0].cantidadEnOC).toBe(10);
    expect(productos[0].pendienteCompra).toBe(0);
    expect(ocCoverage.porcentaje).toBe(100);
    expect(estadoSugerido).toBe('en_proceso');
  });

  it('ref cancelada no cuenta (vuelve a pendiente)', () => {
    const { productos } = recomputarCoberturaProductos([prod(10, [ref(10, 'enviada', 'cancelada')])]);
    expect(productos[0].cantidadEnOC).toBe(0);
    expect(productos[0].pendienteCompra).toBe(10);
  });

  it('cobertura parcial (firme < solicitada) → parcial', () => {
    const { productos, ocCoverage, estadoSugerido } = recomputarCoberturaProductos([prod(10, [ref(6, 'confirmada')])]);
    expect(productos[0].cantidadEnOC).toBe(6);
    expect(productos[0].pendienteCompra).toBe(4);
    expect(ocCoverage.porcentaje).toBe(60);
    expect(estadoSugerido).toBe('parcial');
  });

  it('SOBRE-COMPRA: enOC > solicitada → sobrecompra visible, % capeado a 100, pendiente 0', () => {
    const { productos, ocCoverage } = recomputarCoberturaProductos([prod(10, [ref(8, 'enviada'), ref(7, 'enviada')])]);
    expect(productos[0].cantidadEnOC).toBe(15);
    expect(productos[0].pendienteCompra).toBe(0);
    expect(productos[0].sobrecompra).toBe(5);
    expect(ocCoverage.porcentaje).toBe(100);       // capeado · nunca >100
    expect(ocCoverage.tieneSobrecompra).toBe(true);
  });

  it('ref legacy sin estadoOC cuenta (backward-compat)', () => {
    const { productos } = recomputarCoberturaProductos([prod(10, [ref(10)])]);
    expect(productos[0].cantidadEnOC).toBe(10);
  });

  it('INVARIANTE solicitada = enOC_vigente + pendiente · cancelado y borrador caen en pendiente', () => {
    // solicitada=20 · 8 firme-vigente cuenta · 5 cancelada NO · 4 borrador NO → enOC=8, pendiente=12
    const refs = [ref(8, 'enviada', 'vigente'), ref(5, 'enviada', 'cancelada'), ref(4, 'borrador')];
    const { productos } = recomputarCoberturaProductos([prod(20, refs)]);
    const p = productos[0];
    expect(p.cantidadEnOC).toBe(8);
    expect(p.pendienteCompra).toBe(12);
    expect(p.sobrecompra).toBe(0);
    expect(p.cantidadEnOC + p.pendienteCompra).toBe(20); // invariante (sin sobre-compra)
  });

  it('mezcla multi-producto agrega bien el % y los flags', () => {
    const { ocCoverage } = recomputarCoberturaProductos([
      prod(10, [ref(10, 'enviada')]),   // 100%
      prod(10, [ref(0)]),               // 0%
    ]);
    expect(ocCoverage.totalProductos).toBe(2);
    expect(ocCoverage.productosEnOC).toBe(1);
    expect(ocCoverage.productosPendientes).toBe(1);
    expect(ocCoverage.porcentaje).toBe(50);
    expect(ocCoverage.tieneSobrecompra).toBe(false);
  });

  it('es PURA: no muta la entrada', () => {
    const input = [prod(10, [ref(10, 'enviada')])];
    const snapshot = JSON.stringify(input);
    recomputarCoberturaProductos(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
