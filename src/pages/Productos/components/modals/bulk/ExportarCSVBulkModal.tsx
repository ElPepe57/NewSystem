/**
 * ExportarCSVBulkModal · Mini-modal "Exportar CSV" (Fase G · #44 Estado D)
 *
 * Acción 3 de 4 del BulkActionsToolbar.
 *
 * Estructura:
 *   - Header con count + meta (Excel-compatible · UTF-8 · separador coma)
 *   - Lista colapsable de columnas agrupadas (Identidad · Comercial · Stock · Atributos)
 *   - Recordamos selección anterior en localStorage (key: productos-csv-cols-v1)
 *   - Footer: Cancelar / Descargar productos.csv
 *
 * Generación CSV es 100% client-side · sin backend.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { X, Download } from 'lucide-react';
import type { Producto } from '../../../../../types/producto.types';

interface ExportarCSVBulkModalProps {
  open: boolean;
  productos: Producto[];
  onClose: () => void;
}

interface ColumnaCSV {
  key: string;
  label: string;
  grupo: 'Identidad' | 'Comercial' | 'Stock' | 'Atributos';
  defaultChecked: boolean;
  getValue: (p: any) => string;
}

const COLUMNAS: ColumnaCSV[] = [
  // Identidad
  { key: 'sku', label: 'SKU', grupo: 'Identidad', defaultChecked: true, getValue: (p) => p.sku ?? '' },
  { key: 'nombreComercial', label: 'Nombre comercial', grupo: 'Identidad', defaultChecked: true, getValue: (p) => p.nombreComercial ?? '' },
  { key: 'marca', label: 'Marca', grupo: 'Identidad', defaultChecked: true, getValue: (p) => p.marca ?? '' },
  { key: 'lineaNegocio', label: 'Línea negocio', grupo: 'Identidad', defaultChecked: true, getValue: (p) => p.lineaNegocioNombre ?? '' },
  { key: 'tipoProducto', label: 'Tipo producto', grupo: 'Identidad', defaultChecked: false, getValue: (p) => p.tipoProducto?.nombre ?? '' },
  { key: 'paisOrigen', label: 'País origen', grupo: 'Identidad', defaultChecked: false, getValue: (p) => p.paisOrigen ?? '' },

  // Comercial
  { key: 'precioVenta', label: 'Precio venta', grupo: 'Comercial', defaultChecked: true, getValue: (p) => String(p.precioVenta ?? '') },
  { key: 'ctru', label: 'CTRU', grupo: 'Comercial', defaultChecked: true, getValue: (p) => String(p.ctruPromedio ?? '') },
  { key: 'margenPct', label: 'Margen %', grupo: 'Comercial', defaultChecked: true, getValue: (p) => {
    const pv = p.precioVenta ?? 0;
    const ct = p.ctruPromedio ?? 0;
    if (pv > 0 && ct > 0) return ((pv - ct) / pv * 100).toFixed(1);
    return '';
  }},

  // Stock
  { key: 'stockDisponible', label: 'Stock disponible', grupo: 'Stock', defaultChecked: true, getValue: (p) => String(p.stockDisponible ?? p.stockTotal ?? 0) },
  { key: 'stockMinMax', label: 'Stock min/max', grupo: 'Stock', defaultChecked: false, getValue: (p) => `${p.stockMinimo ?? 0}/${p.stockMaximo ?? 0}` },
  { key: 'stockUSA', label: 'Stock USA', grupo: 'Stock', defaultChecked: false, getValue: (p) => String(p.stockUSA ?? 0) },
  { key: 'stockPeru', label: 'Stock Perú', grupo: 'Stock', defaultChecked: false, getValue: (p) => String(p.stockPeru ?? 0) },

  // Atributos
  { key: 'atributosSkincare', label: 'Atributos Skincare (JSON)', grupo: 'Atributos', defaultChecked: false, getValue: (p) =>
    p.atributosSkincare ? JSON.stringify(p.atributosSkincare) : '' },
  { key: 'atributosSuplementos', label: 'Atributos Suplementos (JSON)', grupo: 'Atributos', defaultChecked: false, getValue: (p) =>
    p.atributosSuplementos ? JSON.stringify(p.atributosSuplementos) : '' },
  { key: 'categorias', label: 'Categorías', grupo: 'Atributos', defaultChecked: false, getValue: (p) =>
    Array.isArray(p.categorias) ? p.categorias.map((c: any) => c.nombre).join('|') : '' },
  { key: 'etiquetas', label: 'Etiquetas', grupo: 'Atributos', defaultChecked: false, getValue: (p) =>
    Array.isArray(p.etiquetasData) ? p.etiquetasData.map((e: any) => e.nombre).join('|') : '' },
  { key: 'estado', label: 'Estado', grupo: 'Identidad', defaultChecked: false, getValue: (p) => p.estado ?? 'activo' },
];

const STORAGE_KEY = 'productos-csv-cols-v1';

function loadSelection(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch { /* ignore */ }
  return new Set(COLUMNAS.filter(c => c.defaultChecked).map(c => c.key));
}

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export const ExportarCSVBulkModal: React.FC<ExportarCSVBulkModalProps> = ({
  open,
  productos,
  onClose,
}) => {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setSeleccion(loadSelection());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  const grupos = useMemo(() => {
    const g: Record<string, ColumnaCSV[]> = {};
    COLUMNAS.forEach(c => {
      if (!g[c.grupo]) g[c.grupo] = [];
      g[c.grupo].push(c);
    });
    return g;
  }, []);

  const toggle = (key: string) => {
    const next = new Set(seleccion);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSeleccion(next);
  };

  const handleDescargar = () => {
    const colsActivas = COLUMNAS.filter(c => seleccion.has(c.key));
    if (colsActivas.length === 0) return;

    // Guardar selección
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(seleccion))); } catch { /* ignore */ }

    // Generar CSV
    const headers = colsActivas.map(c => c.label).map(escapeCSV).join(',');
    const rows = productos.map(p =>
      colsActivas.map(c => escapeCSV(c.getValue(p))).join(',')
    );
    const csv = [headers, ...rows].join('\n');

    // BOM UTF-8 para Excel
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fecha = new Date().toISOString().slice(0, 10);
    a.download = `productos_${fecha}_${productos.length}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onClose();
  };

  if (!open) return null;

  const colsCount = seleccion.size;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <button onClick={onClose} className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" aria-label="Cerrar" />
      <div className="relative w-full max-w-md mx-4 bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4 text-slate-700" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900">Exportar {productos.length} producto{productos.length === 1 ? '' : 's'} · CSV</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Excel-compatible · UTF-8 · separador coma</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-500"><X className="w-4 h-4" /></button>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
              Columnas a exportar · {colsCount} / {COLUMNAS.length}
            </label>
            <div className="border border-slate-200 rounded-lg p-2 bg-slate-50 max-h-60 overflow-y-auto space-y-2">
              {Object.entries(grupos).map(([grupo, cols]) => (
                <div key={grupo}>
                  <div className="text-[9px] uppercase text-slate-400 font-bold mb-1">{grupo}</div>
                  {cols.map(c => (
                    <label key={c.key} className="flex items-center gap-2 text-[11px] px-1 cursor-pointer hover:bg-white rounded">
                      <input
                        type="checkbox"
                        checked={seleccion.has(c.key)}
                        onChange={() => toggle(c.key)}
                        className="rounded text-amber-600 focus:ring-amber-400"
                      />
                      <span className="text-slate-700">{c.label}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <div className="text-[9px] text-slate-500 italic mt-1">
              Recordamos tu última selección · próxima vez ya estará marcada
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancelar
            </button>
            <button onClick={handleDescargar} disabled={colsCount === 0}
              className="px-3 py-1.5 text-xs font-bold text-white bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Descargar productos.csv
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
