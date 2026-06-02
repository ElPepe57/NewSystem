import React, { useMemo, useState } from 'react';
import { Package, Search, CheckSquare, Square, Layers, ShoppingCart, Plus, ArrowRight, Boxes, DollarSign } from 'lucide-react';
import type { Requerimiento } from '../../../types/requerimiento.types';
import { calcularPendientesCompra, requerimientosDeProductos, resumenPendientes } from '../../../components/modules/ordenCompra/pendientesCompra.helper';

// chk5.COMERCIALES-F3a · Tab Pendientes del hub de Compras.
// Productos de requerimientos aprobados/parciales sin OC · selección → OC consolidada.
// Reusa el motor existente (calcularPendientesCompra + OCBuilder · no duplica lógica).

interface Props {
  requerimientos: Requerimiento[];
  loading: boolean;
  onCrearOCConsolidada: (reqs: Requerimiento[]) => void;
  onNuevaOC: () => void;
}

export const TabPendientesCompras: React.FC<Props> = ({ requerimientos, loading, onCrearOCConsolidada, onNuevaOC }) => {
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const pendientes = useMemo(() => calcularPendientesCompra(requerimientos), [requerimientos]);
  const { totalProductos, totalUnidades, totalEstimadoUSD } = useMemo(() => resumenPendientes(pendientes), [pendientes]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return pendientes;
    const term = searchTerm.toLowerCase();
    return pendientes.filter((p) =>
      p.sku.toLowerCase().includes(term) ||
      p.marca.toLowerCase().includes(term) ||
      p.nombreComercial.toLowerCase().includes(term) ||
      p.proveedorSugerido?.toLowerCase().includes(term),
    );
  }, [pendientes, searchTerm]);

  const toggleProduct = (productoId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productoId)) next.delete(productoId); else next.add(productoId);
      return next;
    });
  };
  const toggleAll = () => {
    if (filtered.every((p) => selectedProductIds.has(p.productoId)) && filtered.length > 0) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filtered.map((p) => p.productoId)));
    }
  };

  const selectedCount = selectedProductIds.size;
  const selectedUnits = pendientes.filter((p) => selectedProductIds.has(p.productoId)).reduce((s, p) => s + p.pendienteTotal, 0);
  const allSelected = filtered.length > 0 && filtered.every((p) => selectedProductIds.has(p.productoId));

  const handleCrear = () => {
    if (selectedCount === 0) return;
    const reqs = requerimientosDeProductos(pendientes, selectedProductIds, requerimientos);
    onCrearOCConsolidada(reqs);
    setSelectedProductIds(new Set());
  };

  // ── Loading ──
  if (loading && pendientes.length === 0) {
    return (
      <div className="bg-slate-50/30 p-4 sm:p-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 animate-pulse">
            <div className="h-3 w-24 bg-slate-100 rounded mb-2" />
            <div className="h-4 w-2/3 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // ── Empty (sin pendientes) ──
  if (pendientes.length === 0) {
    return (
      <div className="bg-slate-50/30 p-4 sm:p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mb-4 mx-auto">
            <CheckSquare className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Sin productos pendientes de comprar</h3>
          <p className="text-[12px] text-slate-500 mt-1 max-w-sm mx-auto">
            Todos los productos de requerimientos aprobados ya tienen orden de compra. Cuando se aprueben nuevos requerimientos aparecerán aquí.
          </p>
          <button onClick={onNuevaOC} className="mt-5 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Nueva orden de compra
          </button>
        </div>
      </div>
    );
  }

  // ── Dashboard ──
  return (
    <div className="bg-slate-50/30 p-4 sm:p-6 space-y-4">

      {/* header de sección + mini-stats */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-[13px] font-bold text-slate-900">Pendientes de comprar</div>
          <div className="text-[11px] text-slate-500">productos de requerimientos aprobados sin orden de compra</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[11px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"><Package className="w-3.5 h-3.5 text-blue-600" /><span className="font-semibold text-slate-900 tabular-nums">{totalProductos}</span> <span className="text-slate-500">productos</span></span>
          <span className="inline-flex items-center gap-1.5 text-[11px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"><Boxes className="w-3.5 h-3.5 text-blue-600" /><span className="font-semibold text-slate-900 tabular-nums">{totalUnidades.toLocaleString('es-PE')}</span> <span className="text-slate-500">uds</span></span>
          <span className="inline-flex items-center gap-1.5 text-[11px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"><DollarSign className="w-3.5 h-3.5 text-amber-600" /><span className="font-semibold text-slate-900 tabular-nums">${totalEstimadoUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span> <span className="text-slate-500">est.</span></span>
        </div>
      </div>

      {/* buscador */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por SKU, marca, producto, proveedor…"
          className="w-full pl-9 pr-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>

      {/* barra de selección masiva (BulkActions) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={toggleAll} className="inline-flex items-center gap-2 text-[12px] text-slate-600 hover:text-blue-600">
          {allSelected ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4" />}
          Seleccionar todos
          <span className="text-[11px] text-slate-400">({filtered.length})</span>
        </button>
        {selectedCount > 0 && (
          <div className="inline-flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg pl-3 pr-1.5 py-1.5">
            <span className="text-[12px] text-blue-800 font-medium tabular-nums">{selectedCount} producto{selectedCount !== 1 ? 's' : ''} · {selectedUnits.toLocaleString('es-PE')} uds</span>
            <button onClick={handleCrear} className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold px-3 py-1.5 rounded-md transition-colors">
              <Layers className="w-3.5 h-3.5" /> Crear OC consolidada
            </button>
          </div>
        )}
      </div>

      {/* lista de cards */}
      <div className="space-y-2">
        {filtered.map((item) => {
          const isSelected = selectedProductIds.has(item.productoId);
          return (
            <div
              key={item.productoId}
              onClick={() => toggleProduct(item.productoId)}
              className={`rounded-xl border p-3 cursor-pointer transition-all ${isSelected ? 'border-blue-400 bg-blue-50/60 ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  {isSelected ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 font-mono">{item.sku}</span>
                    {item.proveedorSugerido && (
                      <span className="text-[10px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded">{item.proveedorSugerido}</span>
                    )}
                  </div>
                  <p className="text-[13px] font-medium text-slate-900 truncate">{item.marca} · {item.nombreComercial}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {item.origenes.map((o, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        <span className="font-medium">{o.requerimientoNumero}</span>
                        <span className="text-slate-400">·</span>
                        <span className="tabular-nums">{o.cantidad} ud</span>
                        {o.clienteNombre && (<><span className="text-slate-400">·</span><span className="truncate max-w-[90px]">{o.clienteNombre}</span></>)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-[14px] font-bold text-slate-900 tabular-nums">{item.pendienteTotal} <span className="text-[11px] font-normal text-slate-400">ud</span></div>
                  {item.costoEstimadoUSD > 0 && (
                    <div className="text-[11px] text-amber-700 tabular-nums">~${(item.pendienteTotal * item.costoEstimadoUSD).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-[12px] text-slate-500">Sin resultados para «{searchTerm}»</p>
          </div>
        )}
      </div>

      {/* CTA flujo completo */}
      <div className="pt-1">
        <button onClick={onNuevaOC} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline">
          <Plus className="w-3.5 h-3.5" /> ¿Comprar algo fuera de requerimientos? Crear OC manual <ArrowRight className="w-3 h-3" />
        </button>
      </div>

    </div>
  );
};
