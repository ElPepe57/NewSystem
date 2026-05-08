/**
 * DocumentosPendientesTable.tsx
 *
 * Tabla de documentos pendientes con checkboxes y montos editables.
 */
import React, { useState, useMemo } from 'react';
import { Search, FileText, ShoppingCart, Receipt } from 'lucide-react';
import { DataTable } from '../../../../design-system';
import type { DataTableColumn } from '../../../../design-system';
import { formatCurrency } from '../../../../utils/format';
import { usePagoMasivoStore } from '../../../../store/pagoMasivoStore';
import type { PendienteFinanciero } from '../../../../types/tesoreria.types';

const TIPO_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  venta_por_cobrar:       { label: 'Venta',  color: 'bg-emerald-100 text-emerald-700', icon: <FileText size={14} /> },
  orden_compra_por_pagar: { label: 'OC',     color: 'bg-sky-100 text-sky-700',   icon: <ShoppingCart size={14} /> },
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

  const handleSort = (key: string) => {
    const colMap: Record<string, 'monto' | 'dias' | 'nombre'> = {
      montoPendiente: 'monto',
      diasPendiente: 'dias',
      contraparteNombre: 'nombre',
    };
    const col = colMap[key];
    if (!col) return;
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const columns: DataTableColumn<PendienteFinanciero>[] = [
    {
      key: 'tipo',
      header: 'Tipo',
      render: (p) => {
        const tipo = TIPO_LABELS[p.tipo];
        return tipo ? (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tipo.color}`}>
            {tipo.icon} {tipo.label}
          </span>
        ) : null;
      },
    },
    {
      key: 'numeroDocumento',
      header: 'Documento',
      render: (p) => <span className="font-mono text-xs">{p.numeroDocumento}</span>,
    },
    {
      key: 'contraparteNombre',
      header: 'Contraparte',
      sortable: true,
      render: (p) => <span className="truncate max-w-[180px] block">{p.contraparteNombre}</span>,
    },
    {
      key: 'montoPendiente',
      header: 'Pendiente',
      align: 'right',
      sortable: true,
      render: (p) => <span className="font-mono">{formatCurrency(p.montoPendiente, p.moneda)}</span>,
    },
    {
      key: 'montoPagar',
      header: 'A pagar',
      align: 'right',
      render: (p) => {
        const sel = seleccionados.get(p.documentoId);
        return sel ? (
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
        );
      },
    },
    {
      key: 'diasPendiente',
      header: 'Dias',
      align: 'center',
      sortable: true,
      render: (p) => (
        <span className={`text-xs font-medium ${
          p.diasPendiente > 30 ? 'text-red-600' :
          p.diasPendiente > 15 ? 'text-amber-600' : 'text-slate-600'
        }`}>
          {p.diasPendiente}d
        </span>
      ),
    },
  ];

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
      <DataTable<PendienteFinanciero>
        columns={columns}
        data={pendientesFiltrados}
        keyExtractor={(p) => p.documentoId}
        sortBy={sortBy === 'monto' ? 'montoPendiente' : sortBy === 'dias' ? 'diasPendiente' : 'contraparteNombre'}
        sortDirection={sortDir}
        onSort={handleSort}
        selectable
        selectedKeys={new Set(seleccionados.keys())}
        onToggleSelect={(key) => {
          const item = pendientesFiltrados.find((p) => p.documentoId === key);
          if (item) toggleSeleccion(item);
        }}
        onToggleSelectAll={handleToggleAll}
        emptyMessage="No hay documentos pendientes"
        compact
      />
    </div>
  );
};
