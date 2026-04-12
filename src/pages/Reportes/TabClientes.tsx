import React, { useState, useEffect, useMemo } from 'react';
import { Users, TrendingUp, ShoppingBag, Star, RefreshCw, Loader2 } from 'lucide-react';
import { clienteService } from '../../services/cliente.service';
import { VentaService } from '../../services/venta.service';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import { filtrarVentasReporte } from '../../utils/kpi.calculators';
import { formatCurrencyPEN } from '../../utils/format';
import type { Cliente } from '../../types/entidadesMaestras.types';
import type { Venta } from '../../types/venta.types';
import { DataTable } from '../../design-system';
import type { DataTableColumn } from '../../design-system';

type ClienteConMetricas = Cliente & {
  ventasTotal: number;
  ventasCantidad: number;
  utilidad: number;
  margen: number;
  diasDesdeUltima: number | null;
  ticketPromedio: number;
  esTop3: boolean;
};

const columns: DataTableColumn<ClienteConMetricas>[] = [
  {
    key: 'nombre',
    header: 'Cliente',
    align: 'left',
    render: (c) => (
      <div className="flex items-center gap-2">
        {c.esTop3 && <Star className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
        <div>
          <p className="font-medium text-slate-900 truncate max-w-[200px]">{c.nombre}</p>
          {c.telefono && <p className="text-xs text-slate-400">{c.telefono}</p>}
        </div>
      </div>
    ),
  },
  {
    key: 'ventasCantidad',
    header: 'Compras',
    align: 'center',
    hideOnMobile: true,
    render: (c) => <span className="text-slate-600">{c.ventasCantidad}</span>,
  },
  {
    key: 'ventasTotal',
    header: 'Total',
    align: 'right',
    hideOnMobile: true,
    render: (c) => <span className="text-slate-700">{formatCurrencyPEN(c.ventasTotal)}</span>,
  },
  {
    key: 'utilidad',
    header: 'Utilidad',
    align: 'right',
    render: (c) => <span className="font-medium text-emerald-700">{formatCurrencyPEN(c.utilidad)}</span>,
  },
  {
    key: 'margen',
    header: 'Margen',
    align: 'center',
    hideOnMobile: true,
    render: (c) => (
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
        c.margen >= 25 ? 'bg-emerald-100 text-emerald-700'
          : c.margen >= 10 ? 'bg-amber-100 text-amber-700'
          : 'bg-red-100 text-red-700'
      }`}>
        {c.margen.toFixed(0)}%
      </span>
    ),
  },
  {
    key: 'ticketPromedio',
    header: 'Ticket Prom.',
    align: 'right',
    hideOnMobile: true,
    render: (c) => <span className="text-slate-600">{formatCurrencyPEN(c.ticketPromedio)}</span>,
  },
  {
    key: 'diasDesdeUltima',
    header: 'Ultima',
    align: 'center',
    hideOnMobile: true,
    render: (c) =>
      c.diasDesdeUltima != null ? (
        <span className={`text-xs ${
          c.diasDesdeUltima <= 30 ? 'text-emerald-600'
            : c.diasDesdeUltima <= 90 ? 'text-slate-600'
            : 'text-red-600'
        }`}>
          {c.diasDesdeUltima}d
        </span>
      ) : (
        <span className="text-xs text-slate-400">-</span>
      ),
  },
  {
    key: 'clasificacionABC',
    header: 'ABC',
    align: 'center',
    render: (c) =>
      c.clasificacionABC ? (
        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
          c.clasificacionABC === 'A' ? 'bg-emerald-100 text-emerald-800'
            : c.clasificacionABC === 'B' ? 'bg-sky-100 text-sky-800'
            : 'bg-slate-100 text-slate-600'
        }`}>
          {c.clasificacionABC}
        </span>
      ) : null,
  },
];

export const TabClientes: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      clienteService.getAll(),
      VentaService.getAll(),
    ]).then(([c, v]) => {
      setClientes(c.filter(cl => cl.estado === 'activo'));
      setVentas(filtrarVentasReporte(v));
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Calcular métricas por cliente cruzando con ventas
  const clientesConMetricas = useMemo(() => {
    const ventasPorCliente = new Map<string, { total: number; cantidad: number; ultimaFecha: Date | null; utilidad: number }>();

    for (const v of ventas) {
      if (!v.clienteId) continue;
      const prev = ventasPorCliente.get(v.clienteId) || { total: 0, cantidad: 0, ultimaFecha: null, utilidad: 0 };
      prev.total += v.totalPEN || 0;
      prev.cantidad++;
      prev.utilidad += v.utilidadBrutaPEN || 0;
      const fecha = v.fechaEntrega?.toDate?.() || v.fechaCreacion?.toDate?.();
      if (fecha && (!prev.ultimaFecha || fecha > prev.ultimaFecha)) prev.ultimaFecha = fecha;
      ventasPorCliente.set(v.clienteId, prev);
    }

    const sorted = clientes.map(c => {
      const stats = ventasPorCliente.get(c.id) || { total: 0, cantidad: 0, ultimaFecha: null, utilidad: 0 };
      const diasDesdeUltima = stats.ultimaFecha
        ? Math.ceil((Date.now() - stats.ultimaFecha.getTime()) / 86400000)
        : null;
      const margen = stats.total > 0 ? (stats.utilidad / stats.total) * 100 : 0;

      return {
        ...c,
        ventasTotal: stats.total,
        ventasCantidad: stats.cantidad,
        utilidad: stats.utilidad,
        margen,
        diasDesdeUltima,
        ticketPromedio: stats.cantidad > 0 ? stats.total / stats.cantidad : 0,
        esTop3: false,
      };
    }).filter(c => c.ventasCantidad > 0)
      .sort((a, b) => b.utilidad - a.utilidad) // Ordenar por RENTABILIDAD, no por monto
      .slice(0, 20);

    // Marcar los primeros 3 como top después de ordenar
    sorted.forEach((c, idx) => { c.esTop3 = idx < 3; });
    return sorted;
  }, [clientes, ventas]);

  // KPIs
  const kpis = useMemo(() => {
    if (clientesConMetricas.length === 0) return null;
    const activos90d = clientesConMetricas.filter(c => c.diasDesdeUltima != null && c.diasDesdeUltima <= 90).length;
    const totalClientes = clientesConMetricas.length;
    const recompra = clientesConMetricas.filter(c => c.ventasCantidad > 1).length;
    const tasaRecompra = totalClientes > 0 ? (recompra / totalClientes) * 100 : 0;
    const ticketGlobal = clientesConMetricas.reduce((s, c) => s + c.ventasTotal, 0) / clientesConMetricas.reduce((s, c) => s + c.ventasCantidad, 0);
    const utilidadTotal = clientesConMetricas.reduce((s, c) => s + c.utilidad, 0);

    return { totalClientes, activos90d, tasaRecompra, ticketGlobal, utilidadTotal };
  }, [clientesConMetricas]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-sky-50 rounded-xl p-4">
            <p className="text-xs text-sky-600 font-medium">Clientes con compras</p>
            <p className="text-2xl font-bold text-sky-900">{kpis.totalClientes}</p>
            <p className="text-xs text-sky-500">{kpis.activos90d} activos (90d)</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4">
            <p className="text-xs text-emerald-600 font-medium">Tasa recompra</p>
            <p className="text-2xl font-bold text-emerald-900">{kpis.tasaRecompra.toFixed(0)}%</p>
            <p className="text-xs text-emerald-500">clientes que vuelven</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-4">
            <p className="text-xs text-purple-600 font-medium">Ticket promedio</p>
            <p className="text-2xl font-bold text-purple-900">{formatCurrencyPEN(kpis.ticketGlobal)}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-4">
            <p className="text-xs text-amber-600 font-medium">Utilidad total</p>
            <p className="text-2xl font-bold text-amber-900">{formatCurrencyPEN(kpis.utilidadTotal)}</p>
          </div>
        </div>
      )}

      {/* Tabla de clientes por rentabilidad */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b">
          <h3 className="font-semibold text-slate-900">Top Clientes por Rentabilidad</h3>
          <p className="text-xs text-slate-500">Ordenados por utilidad generada, no solo por monto de compra</p>
        </div>

        <DataTable
          columns={columns}
          data={clientesConMetricas}
          keyExtractor={(c) => c.id}
          emptyMessage="No hay clientes con compras"
          compact
        />
      </div>
    </div>
  );
};
