/**
 * DocumentosPendientesTable.tsx
 *
 * Tabla de documentos pendientes con checkboxes y montos editables.
 */
import React, { useState, useMemo } from 'react';
import { Search, FileText, ShoppingCart, Receipt, ArrowUpDown } from 'lucide-react';
import { Badge } from '../../../components/common';
import { formatCurrency } from '../../../utils/format';
import { usePagoMasivoStore } from '../../../store/pagoMasivoStore';
import type { PendienteFinanciero } from '../../../types/tesoreria.types';

const TIPO_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  venta_por_cobrar:       { label: 'Venta',  color: 'bg-green-100 text-green-700', icon: <FileText size={14} /> },
  orden_compra_por_pagar: { label: 'OC',     color: 'bg-blue-100 text-blue-700',   icon: <ShoppingCart size={14} /> },
  gasto_por_pagar:        { label: 'Gasto',  color: 'bg-amber-100 text-amber-700', icon: <Receipt size={14} /> },
};

export const DocumentosPendientesTable: React.FC = () => {
  const {
    pendientes,
    loadingPendientes,
    seleccionados,
    toggleSeleccion,
    seleccionarTodos,
    deseleccionarTodos,
    actualizarMontoPagar,
  } = usePagoMasivoStore();

  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'monto' | 'dias' | 'nombre'>('dias');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const tiposDisponibles = useMemo(() => {
    const tipos = new Set(pendientes.map((p) => p.tipo));
    return Array.from(tipos);
  }, [pendientes]);

  const pendientesFiltrados = useMemo(() => {
    let resultado = pendientes;

    if (filtroTipo !== 'todos') {
      resultado = resultado.filter((p) => p.tipo === filtroTipo);
    }

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      resultado = resultado.filter(
        (p) =>
          p.numeroDocumento.toLowerCase().includes(q) ||
          p.contraparteNombre.toLowerCase().includes(q)
      );
    }

    resultado.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'monto') cmp = a.montoPendiente - b.montoPendiente;
      else if (sortBy === 'dias') cmp = a.diasPendiente - b.diasPendiente;
      else cmp = a.contraparteNombre.localeCompare(b.contraparteNombre);
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return resultado;
  }, [pendientes, filtroTipo, busqueda, sortBy, sortDir]);

  const todosSeleccionados =
    pendientesFiltrados.length > 0 &&
    pendientesFiltrados.every((p) => seleccionados.has(p.documentoId));

  const handleToggleAll = () => {
    if (todosSeleccionados) {
      deseleccionarTodos();
    } else {
      seleccionarTodos(pendientesFiltrados);
    }
  };

  const handleSort = (col: 'monto' | 'dias' | 'nombre') => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const totalSeleccionado = useMemo(() => {
    let pen = 0, usd = 0;
    for (const item of seleccionados.values()) {
      if (item.monedaDocumento === 'PEN') pen += item.montoPagar;
      else usd += item.montoPagar;
    }
    return { pen, usd };
  }, [seleccionados]);

  if (loadingPendientes) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mr-3" />
        Cargando documentos pendientes...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por documento o contraparte..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
        >
          <option value="todos">Todos los tipos</option>
          {tiposDisponibles.map((t) => (
            <option key={t} value={t}>{TIPO_LABELS[t]?.label || t}</option>
          ))}
        </select>
      </div>

      {/* Resumen selección */}
      {seleccionados.size > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2 flex items-center justify-between text-sm">
          <span className="font-medium text-teal-700">
            {seleccionados.size} documento{seleccionados.size !== 1 ? 's' : ''} seleccionado{seleccionados.size !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-4 text-teal-600">
            {totalSeleccionado.pen > 0 && <span>{formatCurrency(totalSeleccionado.pen, 'PEN')}</span>}
            {totalSeleccionado.usd > 0 && <span>{formatCurrency(totalSeleccionado.usd, 'USD')}</span>}
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  onChange={handleToggleAll}
                  className="rounded border-slate-300"
                />
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Documento</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer select-none" onClick={() => handleSort('nombre')}>
                <span className="flex items-center gap-1">Contraparte <ArrowUpDown size={12} /></span>
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase cursor-pointer select-none" onClick={() => handleSort('monto')}>
                <span className="flex items-center justify-end gap-1">Pendiente <ArrowUpDown size={12} /></span>
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">A pagar</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase cursor-pointer select-none" onClick={() => handleSort('dias')}>
                <span className="flex items-center justify-center gap-1">Dias <ArrowUpDown size={12} /></span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pendientesFiltrados.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No hay documentos pendientes
                </td>
              </tr>
            ) : (
              pendientesFiltrados.map((p) => {
                const sel = seleccionados.get(p.documentoId);
                const isSelected = !!sel;
                const tipo = TIPO_LABELS[p.tipo];

                return (
                  <tr
                    key={p.documentoId}
                    className={`hover:bg-slate-50 ${isSelected ? 'bg-teal-50/50' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSeleccion(p)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {tipo && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tipo.color}`}>
                          {tipo.icon} {tipo.label}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{p.numeroDocumento}</td>
                    <td className="px-3 py-2 truncate max-w-[180px]">{p.contraparteNombre}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatCurrency(p.montoPendiente, p.moneda)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isSelected ? (
                        <input
                          type="number"
                          value={sel.montoPagar}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val > 0) {
                              actualizarMontoPagar(p.documentoId, val);
                            }
                          }}
                          className="w-24 text-right border rounded px-2 py-1 text-sm font-mono focus:ring-2 focus:ring-teal-500"
                          step="0.01"
                          min="0.01"
                          max={p.montoPendiente}
                        />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs font-medium ${
                        p.diasPendiente > 30 ? 'text-red-600' :
                        p.diasPendiente > 15 ? 'text-amber-600' : 'text-slate-600'
                      }`}>
                        {p.diasPendiente}d
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
