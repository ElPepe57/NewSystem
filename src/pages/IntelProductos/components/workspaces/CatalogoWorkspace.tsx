/**
 * CatalogoWorkspace · vista valorizada del catálogo · Cost Intelligence
 *
 * Mockup canónico: docs/mockups/cost-intelligence-vision-s3.6.html · Sección 2
 *
 * Layout multi-pane:
 *   [tabla densa izquierda] [drill-down right pane]
 *
 * MVP (chk5.B2 · sin transacciones): muestra los 212 productos reales con
 * costos derivados de `calcularInvestigacion()`. Sparklines y variance
 * diferidos hasta tener histórico real de costos en BD.
 */

import React, { useMemo, useState } from 'react';
import type { Producto } from '../../../../types/producto.types';
import { calcularInvestigacion } from '../../../Productos/utils/investigacionCalculos';
import { CatalogoTable } from './CatalogoTable';
import { ProductoDetailPane } from './ProductoDetailPane';
import { Search, X } from 'lucide-react';

interface CatalogoWorkspaceProps {
  productos: Producto[];
  tc: number;          // Tipo de cambio del día · pasa al cálculo de investigación
}

export type SortKey = 'sku' | 'nombre' | 'costo' | 'precio' | 'margen' | 'score';
export type SortDir = 'asc' | 'desc';

export interface ProductoEnriquecido {
  producto: Producto;
  costoPEN: number;
  precioEfectivo: number;
  margenPct: number | null;
  utilidad: number | null;
  /** Score 0-100 derivado de calidad de datos · MVP sin sparklines */
  score: number;
  tieneInvestigacion: boolean;
  esCompleta: boolean;
}

/** Calcula score 0-100 basado en calidad de datos de investigación (MVP) */
function calcularScore(prod: Producto, c: ReturnType<typeof calcularInvestigacion>): number {
  let score = 0;
  // 30 pts · tiene investigación completa (proveedores + competidores)
  if (c.esCompleta) score += 30;
  else if (c.tieneInvestigacion) score += 10;
  // 25 pts · margen saludable (>20%)
  if (c.margenPct >= 30) score += 25;
  else if (c.margenPct >= 20) score += 18;
  else if (c.margenPct >= 10) score += 8;
  // 20 pts · tiene precio de venta definido
  if (c.precioVentaManual > 0) score += 20;
  // 15 pts · tiene ≥2 proveedores comparables
  if (c.tieneProveedores) score += 15;
  // 10 pts · producto activo
  if (prod.estado === 'activo') score += 10;
  return Math.min(100, Math.max(0, score));
}

export const CatalogoWorkspace: React.FC<CatalogoWorkspaceProps> = ({ productos, tc }) => {
  const [search, setSearch] = useState('');
  const [filterLinea, setFilterLinea] = useState<string>('');
  const [filterEstado, setFilterEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos');
  const [filterInvestigado, setFilterInvestigado] = useState<'todos' | 'con' | 'sin'>('todos');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [seleccionado, setSeleccionado] = useState<ProductoEnriquecido | null>(null);

  // Enriquecer productos con cálculos derivados
  const enriquecidos = useMemo<ProductoEnriquecido[]>(() => {
    return productos.map(p => {
      const c = calcularInvestigacion(p, tc);
      const score = calcularScore(p, c);
      return {
        producto: p,
        costoPEN: c.costoPEN,
        precioEfectivo: c.precioEfectivo,
        margenPct: c.tieneInvestigacion ? c.margenPct : null,
        utilidad: c.tieneInvestigacion ? c.utilidad : null,
        score,
        tieneInvestigacion: c.tieneInvestigacion,
        esCompleta: c.esCompleta,
      };
    });
  }, [productos, tc]);

  // Líneas únicas para el filtro
  const lineasUnicas = useMemo(() => {
    const set = new Set<string>();
    productos.forEach(p => {
      if (p.lineaNegocioNombre) set.add(p.lineaNegocioNombre);
    });
    return Array.from(set).sort();
  }, [productos]);

  // Aplicar filtros + sort
  const visibles = useMemo(() => {
    let res = enriquecidos;

    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(e =>
        e.producto.sku?.toLowerCase().includes(q) ||
        e.producto.nombreComercial?.toLowerCase().includes(q) ||
        e.producto.marca?.toLowerCase().includes(q)
      );
    }
    if (filterLinea) {
      res = res.filter(e => e.producto.lineaNegocioNombre === filterLinea);
    }
    if (filterEstado !== 'todos') {
      res = res.filter(e => e.producto.estado === filterEstado);
    }
    if (filterInvestigado === 'con') {
      res = res.filter(e => e.tieneInvestigacion);
    } else if (filterInvestigado === 'sin') {
      res = res.filter(e => !e.tieneInvestigacion);
    }

    // Sort
    res = [...res].sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortKey) {
        case 'sku':
          av = a.producto.sku ?? '';
          bv = b.producto.sku ?? '';
          break;
        case 'nombre':
          av = a.producto.nombreComercial ?? '';
          bv = b.producto.nombreComercial ?? '';
          break;
        case 'costo':
          av = a.costoPEN;
          bv = b.costoPEN;
          break;
        case 'precio':
          av = a.precioEfectivo;
          bv = b.precioEfectivo;
          break;
        case 'margen':
          av = a.margenPct ?? -Infinity;
          bv = b.margenPct ?? -Infinity;
          break;
        case 'score':
        default:
          av = a.score;
          bv = b.score;
          break;
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(av);
      const bn = Number(bv);
      return sortDir === 'asc' ? an - bn : bn - an;
    });

    return res;
  }, [enriquecidos, search, filterLinea, filterEstado, filterInvestigado, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'sku' || key === 'nombre' ? 'asc' : 'desc');
    }
  };

  const tieneFiltrosActivos = search.trim() || filterLinea || filterEstado !== 'todos' || filterInvestigado !== 'todos';
  const limpiar = () => {
    setSearch('');
    setFilterLinea('');
    setFilterEstado('todos');
    setFilterInvestigado('todos');
  };

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: seleccionado ? 'minmax(0, 1fr) 420px' : '1fr' }}>
      {/* Pane izquierda · filtros + tabla densa */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
        {/* Filtros bar · canon FiltrosBar simplificado */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SKU · nombre · marca..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
          </div>

          <select
            value={filterLinea}
            onChange={(e) => setFilterLinea(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white"
          >
            <option value="">Todas las líneas</option>
            {lineasUnicas.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value as typeof filterEstado)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white"
          >
            <option value="todos">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>

          <select
            value={filterInvestigado}
            onChange={(e) => setFilterInvestigado(e.target.value as typeof filterInvestigado)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white"
          >
            <option value="todos">Todos</option>
            <option value="con">Con investigación</option>
            <option value="sin">Sin investigación</option>
          </select>

          {tieneFiltrosActivos && (
            <button
              type="button"
              onClick={limpiar}
              className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-0.5"
            >
              <X className="w-3 h-3" /> limpiar
            </button>
          )}

          <span className="ml-auto text-[10px] font-bold text-slate-600 uppercase tracking-wider tabular-nums">
            {visibles.length.toLocaleString('es-PE')} / {productos.length.toLocaleString('es-PE')} SKUs
          </span>
        </div>

        {/* Tabla densa */}
        <CatalogoTable
          enriquecidos={visibles}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          seleccionadoId={seleccionado?.producto.id ?? null}
          onSelect={setSeleccionado}
        />
      </div>

      {/* Pane derecha · drill-down */}
      {seleccionado && (
        <ProductoDetailPane
          item={seleccionado}
          onClose={() => setSeleccionado(null)}
        />
      )}
    </div>
  );
};
