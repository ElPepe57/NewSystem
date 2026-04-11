import React, { useEffect, useState, useMemo } from 'react';
import { DollarSign, CheckCircle } from 'lucide-react';
import { Card, Badge } from '../../components/common';
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

  if (loading) return <div className="text-center py-8 text-gray-500">Cargando CxP...</div>;

  const fmtUSD = (n: number) => `$${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <div className="text-xs text-gray-500">Pendiente de pago</div>
          <div className="text-2xl font-bold text-red-600">{fmtUSD(saldoPendiente)}</div>
          <div className="text-xs text-gray-400">{ocPendientes.length} OCs</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-gray-500">Total comprometido</div>
          <div className="text-2xl font-bold text-gray-900">{fmtUSD(totalDeuda)}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-gray-500">Ya pagado</div>
          <div className="text-2xl font-bold text-green-600">{fmtUSD(totalPagado)}</div>
        </Card>
      </div>

      {/* Lista de OCs pendientes */}
      {ocPendientes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-300" />
          <p>Sin cuentas por pagar pendientes</p>
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">OC</th>
                <th className="px-3 py-2 text-left">Proveedor</th>
                <th className="px-3 py-2 text-right">Total USD</th>
                <th className="px-3 py-2 text-right">Pendiente</th>
                <th className="px-3 py-2 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ocPendientes.map(oc => {
                const pagado = (oc.historialPagos || []).reduce((s, p) => s + (p.montoUSD || 0), 0);
                const pendiente = (oc.totalUSD || 0) - pagado;
                return (
                  <tr key={oc.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{oc.numeroOrden}</td>
                    <td className="px-3 py-2 text-gray-600">{oc.nombreProveedor}</td>
                    <td className="px-3 py-2 text-right">{fmtUSD(oc.totalUSD)}</td>
                    <td className="px-3 py-2 text-right font-medium text-red-600">{fmtUSD(pendiente)}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant={oc.estadoPago === 'parcial' ? 'warning' : 'danger'} className="text-xs">
                        {oc.estadoPago === 'parcial' ? 'Parcial' : 'Pendiente'}
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
