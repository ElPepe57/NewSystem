import React, { useEffect, useState, useMemo } from 'react';
import { DollarSign, CheckCircle } from 'lucide-react';
import { Card, Badge } from '../../components/common';
import { DataTable } from '../../design-system';
import * as OrdenCompraService from '../../services/ordenCompra.crud.service';
import type { OrdenCompra } from '../../types/ordenCompra.types';

/**
 * Tab CxP — Cuentas por Pagar
 * Muestra OCs con saldo pendiente de pago a proveedores.
 */
export const TabCxP: React.FC = () => {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const todas = await OrdenCompraService.getAll();
        setOrdenes(todas);
      } catch { /* silenciar */ } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const ocPendientes = useMemo(() => {
    return ordenes.filter(oc => {
      if (oc.estado === 'cancelada') return false;
      const estadoPago = oc.estadoPago || 'pendiente';
      return estadoPago === 'pendiente' || estadoPago === 'parcial';
    });
  }, [ordenes]);

  const totalDeuda = ocPendientes.reduce((sum, oc) => sum + (oc.totalUSD || 0), 0);
  const totalPagado = ocPendientes.reduce((sum, oc) => {
    const pagos = oc.historialPagos || [];
    return sum + pagos.reduce((s, p) => s + (p.montoUSD || 0), 0);
  }, 0);
  const saldoPendiente = totalDeuda - totalPagado;

  if (loading) return <div className="text-center py-8 text-slate-500">Cargando CxP...</div>;

  const fmtUSD = (n: number) => `$${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <div className="text-xs text-slate-500">Pendiente de pago</div>
          <div className="text-2xl font-bold text-red-600">{fmtUSD(saldoPendiente)}</div>
          <div className="text-xs text-slate-400">{ocPendientes.length} OCs</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-slate-500">Total comprometido</div>
          <div className="text-2xl font-bold text-slate-900">{fmtUSD(totalDeuda)}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-slate-500">Ya pagado</div>
          <div className="text-2xl font-bold text-emerald-600">{fmtUSD(totalPagado)}</div>
        </Card>
      </div>

      {/* Lista de OCs pendientes */}
      {ocPendientes.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <CheckCircle className="h-10 w-10 mx-auto mb-2 text-emerald-300" />
          <p>Sin cuentas por pagar pendientes</p>
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <DataTable
            columns={[
              { key: 'oc', header: 'OC', render: (oc: OrdenCompra) => <span className="font-medium text-slate-900">{oc.numeroOrden}</span> },
              { key: 'proveedor', header: 'Proveedor', render: (oc: OrdenCompra) => oc.nombreProveedor },
              { key: 'total', header: 'Total USD', align: 'right' as const, render: (oc: OrdenCompra) => fmtUSD(oc.totalUSD) },
              { key: 'pendiente', header: 'Pendiente', align: 'right' as const, render: (oc: OrdenCompra) => {
                const pagado = (oc.historialPagos || []).reduce((s, p) => s + (p.montoUSD || 0), 0);
                return <span className="font-medium text-red-600">{fmtUSD((oc.totalUSD || 0) - pagado)}</span>;
              }},
              { key: 'estado', header: 'Estado', align: 'center' as const, render: (oc: OrdenCompra) => (
                <Badge variant={oc.estadoPago === 'parcial' ? 'warning' : 'danger'} className="text-xs">
                  {oc.estadoPago === 'parcial' ? 'Parcial' : 'Pendiente'}
                </Badge>
              )},
            ]}
            data={ocPendientes}
            keyExtractor={(oc: OrdenCompra) => oc.id}
            compact
          />
        </Card>
      )}
    </div>
  );
};
