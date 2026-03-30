import React, { useState, useEffect, useMemo } from 'react';
import { Users, TrendingUp, ShoppingBag, Star, RefreshCw, Loader2 } from 'lucide-react';
import { clienteService } from '../../services/cliente.service';
import { VentaService } from '../../services/venta.service';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import { filtrarVentasReporte } from '../../utils/kpi.calculators';
import { formatCurrencyPEN } from '../../utils/format';
import type { Cliente } from '../../types/entidadesMaestras.types';
import type { Venta } from '../../types/venta.types';

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

    return clientes.map(c => {
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
      };
    }).filter(c => c.ventasCantidad > 0)
      .sort((a, b) => b.utilidad - a.utilidad); // Ordenar por RENTABILIDAD, no por monto
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
        <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs text-blue-600 font-medium">Clientes con compras</p>
            <p className="text-2xl font-bold text-blue-900">{kpis.totalClientes}</p>
            <p className="text-xs text-blue-500">{kpis.activos90d} activos (90d)</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-xs text-green-600 font-medium">Tasa recompra</p>
            <p className="text-2xl font-bold text-green-900">{kpis.tasaRecompra.toFixed(0)}%</p>
            <p className="text-xs text-green-500">clientes que vuelven</p>
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
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h3 className="font-semibold text-gray-900">Top Clientes por Rentabilidad</h3>
          <p className="text-xs text-gray-500">Ordenados por utilidad generada, no solo por monto de compra</p>
        </div>

        {clientesConMetricas.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No hay clientes con compras</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b bg-gray-50">
                  <th className="text-left py-2 px-4">Cliente</th>
                  <th className="text-center py-2 px-3">Compras</th>
                  <th className="text-right py-2 px-3">Total</th>
                  <th className="text-right py-2 px-3">Utilidad</th>
                  <th className="text-center py-2 px-3">Margen</th>
                  <th className="text-right py-2 px-3">Ticket Prom.</th>
                  <th className="text-center py-2 px-3">Ultima</th>
                  <th className="text-center py-2 px-3">ABC</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clientesConMetricas.slice(0, 20).map((c, idx) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        {idx < 3 && <Star className="h-3.5 w-3.5 text-amber-400" />}
                        <div>
                          <p className="font-medium text-gray-900 truncate max-w-[200px]">{c.nombre}</p>
                          {c.telefono && <p className="text-xs text-gray-400">{c.telefono}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center text-gray-600">{c.ventasCantidad}</td>
                    <td className="py-2.5 px-3 text-right text-gray-700">{formatCurrencyPEN(c.ventasTotal)}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-green-700">{formatCurrencyPEN(c.utilidad)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        c.margen >= 25 ? 'bg-green-100 text-green-700' : c.margen >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>{c.margen.toFixed(0)}%</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-600">{formatCurrencyPEN(c.ticketPromedio)}</td>
                    <td className="py-2.5 px-3 text-center text-xs text-gray-500">
                      {c.diasDesdeUltima != null ? (
                        <span className={c.diasDesdeUltima <= 30 ? 'text-green-600' : c.diasDesdeUltima <= 90 ? 'text-gray-600' : 'text-red-600'}>
                          {c.diasDesdeUltima}d
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {c.clasificacionABC && (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                          c.clasificacionABC === 'A' ? 'bg-green-100 text-green-800'
                            : c.clasificacionABC === 'B' ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>{c.clasificacionABC}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
