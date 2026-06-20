/**
 * PendientesCompraContent · Tab "Pendientes de compra" del hub (F4 · HUB-4).
 *
 * Versión INLINE (tabla) del antiguo PendientesCompraPanel (que era un <Modal>): agrega por
 * PRODUCTO lo pendiente de comprar de los requerimientos (puente al OC Builder). Reusa el
 * helper compartido `calcularPendientesCompra` (DRY · misma fuente que el panel retirado).
 * BulkActionsToolbar azul (grupo Comercial) al seleccionar.
 *
 * Spec: docs/mockups/compras-f4-requerimientos-hub-target-v1.html (Acto 4).
 */
import React, { useMemo, useState } from 'react';
import { Search, Package, ArrowRight } from 'lucide-react';
import type { Requerimiento } from '../../types/requerimiento.types';
import { calcularPendientesCompra, requerimientosDeProductos, type PendienteItem } from '../../components/modules/ordenCompra/pendientesCompra.helper';

interface Props {
  requerimientos: Requerimiento[];
  onEnviarAlBuilder: (requerimientos: Requerimiento[]) => void;
}

export const PendientesCompraContent: React.FC<Props> = ({ requerimientos, onEnviarAlBuilder }) => {
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const pendientes = useMemo<PendienteItem[]>(() => calcularPendientesCompra(requerimientos), [requerimientos]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return pendientes;
    return pendientes.filter(p =>
      p.sku.toLowerCase().includes(term) ||
      p.marca.toLowerCase().includes(term) ||
      p.nombreComercial.toLowerCase().includes(term) ||
      p.proveedorSugerido?.toLowerCase().includes(term)
    );
  }, [pendientes, searchTerm]);

  const toggleProduct = (productoId: string) =>
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(productoId)) next.delete(productoId); else next.add(productoId);
      return next;
    });

  const toggleAll = () =>
    setSelectedProductIds(prev =>
      prev.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(p => p.productoId))
    );

  const handleEnviar = () => {
    if (selectedProductIds.size === 0) return;
    const reqs = requerimientosDeProductos(pendientes, selectedProductIds, requerimientos);
    onEnviarAlBuilder(reqs);
    setSelectedProductIds(new Set());
  };

  const totalPendiente = pendientes.reduce((s, p) => s + p.pendienteTotal, 0);
  const totalEstimadoUSD = pendientes.reduce((s, p) => s + p.pendienteTotal * p.costoEstimadoUSD, 0);
  const selectedItems = pendientes.filter(p => selectedProductIds.has(p.productoId));
  const selectedUnits = selectedItems.reduce((s, p) => s + p.pendienteTotal, 0);
  const selectedUSD = selectedItems.reduce((s, p) => s + p.pendienteTotal * p.costoEstimadoUSD, 0);
  const allSelected = selectedProductIds.size === filtered.length && filtered.length > 0;

  if (pendientes.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-white border border-slate-200 rounded-xl py-16 flex flex-col items-center justify-center text-slate-400">
          <Package className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-[13px] font-medium text-slate-500">No hay productos pendientes</p>
          <p className="text-[11px] mt-1">Todos los productos de requerimientos aprobados ya tienen OC</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-3">
      {/* header · stats + buscador */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[12px] text-slate-500">
          <b className="text-slate-800 tabular-nums">{pendientes.length}</b> productos pendientes ·{' '}
          <b className="text-slate-800 tabular-nums">{totalPendiente}</b> uds · ~<b className="text-slate-800 tabular-nums">$ {totalEstimadoUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}</b> USD
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar producto…"
            className="pl-8 pr-3 py-2 text-[12px] bg-white border border-slate-200 rounded-lg w-56 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* tabla agregada por producto */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100 bg-slate-50/50">
              <th className="px-4 py-2.5 w-10">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3.5 h-3.5 accent-blue-600" />
              </th>
              <th className="text-left font-semibold px-3 py-2.5">Producto</th>
              <th className="text-center font-semibold px-3 py-2.5">Pendiente</th>
              <th className="text-right font-semibold px-3 py-2.5 hidden sm:table-cell">Costo est.</th>
              <th className="text-left font-semibold px-3 py-2.5 hidden md:table-cell">Reqs origen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(item => {
              const isSelected = selectedProductIds.has(item.productoId);
              return (
                <tr
                  key={item.productoId}
                  onClick={() => toggleProduct(item.productoId)}
                  className={`cursor-pointer ${isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/60'}`}
                >
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleProduct(item.productoId)} className="w-3.5 h-3.5 accent-blue-600" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-800">{item.nombreComercial}</div>
                    <div className="text-[11px] text-slate-400">{item.marca}{item.proveedorSugerido ? ` · ${item.proveedorSugerido}` : ''} · <span className="font-mono">{item.sku}</span></div>
                  </td>
                  <td className="px-3 py-3 text-center"><span className="font-bold tabular-nums text-amber-700">{item.pendienteTotal} ud</span></td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700 hidden sm:table-cell">{item.costoEstimadoUSD > 0 ? `$ ${(item.pendienteTotal * item.costoEstimadoUSD).toFixed(2)}` : '—'}</td>
                  <td className="px-3 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {item.origenes.map((o, i) => (
                        <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{o.requerimientoNumero}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* BulkActionsToolbar (selección activa) */}
      {selectedProductIds.size > 0 && (
        <div className="sticky bottom-0 bg-blue-50/80 backdrop-blur border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[12px] font-medium text-blue-800 tabular-nums">
            {selectedProductIds.size} producto{selectedProductIds.size > 1 ? 's' : ''} · {selectedUnits} uds · $ {selectedUSD.toFixed(2)}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSelectedProductIds(new Set())} className="text-[12px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg px-3 py-2">Cancelar</button>
            <button type="button" onClick={handleEnviar} className="text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <ArrowRight className="w-4 h-4" /> Enviar al OC Builder
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
