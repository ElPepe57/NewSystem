import React, { useEffect, useState, useMemo } from 'react';
import { DollarSign, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { Card, Badge } from '../../components/common';
import { VentaService } from '../../services/venta.service';
import type { Venta } from '../../types/venta.types';

/**
 * Tab CxC — Cuentas por Cobrar
 * Muestra ventas con saldo pendiente de cobro.
 */
export const TabCxC: React.FC = () => {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const todas = await VentaService.getAll(500);
        setVentas(todas);
      } catch { /* silenciar */ } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const ventasPendientes = useMemo(() => {
    return ventas.filter(v => {
      if (v.estado === 'cotizacion' || v.estado === 'cancelada') return false;
      const estadoPago = (v as any).estadoPago || 'pendiente';
      return estadoPago === 'pendiente' || estadoPago === 'parcial';
    });
  }, [ventas]);

  const totalPendiente = ventasPendientes.reduce((sum, v) => sum + (v.totalPEN || 0), 0);
  const totalPagado = ventasPendientes.reduce((sum, v) => sum + ((v as any).montoPagado || 0), 0);
  const saldoPendiente = totalPendiente - totalPagado;

  // Aging buckets
  const hoy = new Date();
  const aging = useMemo(() => {
    const buckets = { corriente: 0, dias30: 0, dias60: 0, dias90: 0 };
    for (const v of ventasPendientes) {
      const fecha = v.fechaVenta?.toDate?.() || v.fechaCreacion?.toDate?.();
      if (!fecha) continue;
      const dias = Math.floor((hoy.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
      const monto = (v.totalPEN || 0) - ((v as any).montoPagado || 0);
      if (dias <= 30) buckets.corriente += monto;
      else if (dias <= 60) buckets.dias30 += monto;
      else if (dias <= 90) buckets.dias60 += monto;
      else buckets.dias90 += monto;
    }
    return buckets;
  }, [ventasPendientes]);

  if (loading) return <div className="text-center py-8 text-slate-500">Cargando CxC...</div>;

  const fmt = (n: number) => `S/${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <div className="text-xs text-slate-500">Total pendiente</div>
          <div className="text-2xl font-bold text-red-600">{fmt(saldoPendiente)}</div>
          <div className="text-xs text-slate-400">{ventasPendientes.length} ventas</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-slate-500">Facturado</div>
          <div className="text-2xl font-bold text-slate-900">{fmt(totalPendiente)}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-slate-500">Cobrado</div>
          <div className="text-2xl font-bold text-green-600">{fmt(totalPagado)}</div>
        </Card>
      </div>

      {/* Aging */}
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Antig\u00fcedad de Cartera</h4>
        <div className="grid grid-cols-4 gap-2">
          <AgingBucket label="Corriente" monto={aging.corriente} color="green" />
          <AgingBucket label="31-60 d\u00edas" monto={aging.dias30} color="amber" />
          <AgingBucket label="61-90 d\u00edas" monto={aging.dias60} color="orange" />
          <AgingBucket label="+90 d\u00edas" monto={aging.dias90} color="red" />
        </div>
      </Card>

      {/* Lista de ventas pendientes */}
      {ventasPendientes.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-300" />
          <p>Sin cuentas por cobrar pendientes</p>
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Venta</th>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Pendiente</th>
                <th className="px-3 py-2 text-center">D\u00edas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ventasPendientes.slice(0, 20).map(v => {
                const fecha = v.fechaVenta?.toDate?.() || v.fechaCreacion?.toDate?.();
                const dias = fecha ? Math.floor((hoy.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                const pendiente = (v.totalPEN || 0) - ((v as any).montoPagado || 0);
                return (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900">{v.numeroVenta}</td>
                    <td className="px-3 py-2 text-slate-600">{v.nombreCliente}</td>
                    <td className="px-3 py-2 text-right">{fmt(v.totalPEN)}</td>
                    <td className="px-3 py-2 text-right font-medium text-red-600">{fmt(pendiente)}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant={dias > 60 ? 'danger' : dias > 30 ? 'warning' : 'default'} className="text-xs">
                        {dias}d
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

const AgingBucket: React.FC<{ label: string; monto: number; color: string }> = ({ label, monto, color }) => {
  const fmt = (n: number) => `S/${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const colorMap: Record<string, string> = {
    green: 'text-green-700 bg-green-50',
    amber: 'text-amber-700 bg-amber-50',
    orange: 'text-orange-700 bg-orange-50',
    red: 'text-red-700 bg-red-50',
  };
  return (
    <div className={`rounded-lg p-2 text-center ${colorMap[color] || 'bg-slate-50'}`}>
      <div className="text-xs font-medium">{label}</div>
      <div className="text-sm font-bold mt-1">{fmt(monto)}</div>
    </div>
  );
};
