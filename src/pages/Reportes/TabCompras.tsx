import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Clock, CheckCircle, DollarSign, Loader2, TrendingUp, AlertTriangle } from 'lucide-react';
import { OrdenCompraService } from '../../services/ordenCompra.service';
import { formatCurrency } from '../../utils/format';
import type { OrdenCompra } from '../../types/ordenCompra.types';

export const TabCompras: React.FC = () => {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    OrdenCompraService.getAll()
      .then(setOrdenes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Métricas por proveedor
  const proveedores = useMemo(() => {
    const map = new Map<string, {
      nombre: string;
      ordenes: number;
      totalUSD: number;
      recibidas: number;
      pendientes: number;
      diasPromedioRecepcion: number;
      diasAcum: number;
      ordenesConDias: number;
    }>();

    for (const oc of ordenes) {
      if (oc.estado === 'cancelada') continue;
      const key = oc.proveedorId || oc.nombreProveedor;
      const prev = map.get(key) || { nombre: oc.nombreProveedor, ordenes: 0, totalUSD: 0, recibidas: 0, pendientes: 0, diasPromedioRecepcion: 0, diasAcum: 0, ordenesConDias: 0 };
      prev.ordenes++;
      prev.totalUSD += oc.totalUSD || 0;

      if (oc.estado === 'recibida' || oc.estado === 'recibida_parcial') {
        prev.recibidas++;
        const fechaCreacion = oc.fechaCreacion?.toDate?.();
        const fechaRecibida = oc.fechaRecibida?.toDate?.();
        if (fechaCreacion && fechaRecibida) {
          const dias = Math.ceil((fechaRecibida.getTime() - fechaCreacion.getTime()) / 86400000);
          if (dias > 0) {
            prev.diasAcum += dias;
            prev.ordenesConDias++;
          }
        }
      } else {
        prev.pendientes++;
      }

      map.set(key, prev);
    }

    return [...map.values()]
      .map(p => ({
        ...p,
        diasPromedioRecepcion: p.ordenesConDias > 0 ? p.diasAcum / p.ordenesConDias : 0,
      }))
      .sort((a, b) => b.totalUSD - a.totalUSD);
  }, [ordenes]);

  // KPIs globales
  const kpis = useMemo(() => {
    const activas = ordenes.filter(o => !['cancelada', 'recibida'].includes(o.estado));
    const inversionTotal = ordenes.filter(o => o.estado !== 'cancelada').reduce((s, o) => s + (o.totalUSD || 0), 0);
    const recibidas = ordenes.filter(o => o.estado === 'recibida' || o.estado === 'recibida_parcial');

    let diasAcum = 0;
    let conDias = 0;
    for (const oc of recibidas) {
      const fc = oc.fechaCreacion?.toDate?.();
      const fr = oc.fechaRecibida?.toDate?.();
      if (fc && fr) {
        const d = Math.ceil((fr.getTime() - fc.getTime()) / 86400000);
        if (d > 0) { diasAcum += d; conDias++; }
      }
    }

    return {
      activas: activas.length,
      inversionTotal,
      diasPromedio: conDias > 0 ? diasAcum / conDias : 0,
      totalProveedores: proveedores.length,
    };
  }, [ordenes, proveedores]);

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><ShoppingCart className="h-5 w-5 text-blue-600" /><span className="text-xs font-medium text-blue-600">OC activas</span></div>
          <p className="text-2xl font-bold text-blue-900">{kpis.activas}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="h-5 w-5 text-green-600" /><span className="text-xs font-medium text-green-600">Inversion total</span></div>
          <p className="text-2xl font-bold text-green-900">${kpis.inversionTotal.toFixed(0)}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="h-5 w-5 text-purple-600" /><span className="text-xs font-medium text-purple-600">Lead time prom.</span></div>
          <p className="text-2xl font-bold text-purple-900">{kpis.diasPromedio.toFixed(0)} dias</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-5 w-5 text-amber-600" /><span className="text-xs font-medium text-amber-600">Proveedores</span></div>
          <p className="text-2xl font-bold text-amber-900">{kpis.totalProveedores}</p>
        </div>
      </div>

      {/* Tabla por proveedor */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h3 className="font-semibold text-gray-900">Rendimiento por Proveedor</h3>
        </div>

        {proveedores.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No hay ordenes de compra</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b bg-gray-50">
                  <th className="text-left py-2 px-4">Proveedor</th>
                  <th className="text-center py-2 px-3">OC</th>
                  <th className="text-right py-2 px-3">Inversion (USD)</th>
                  <th className="text-center py-2 px-3">Recibidas</th>
                  <th className="text-center py-2 px-3">Pendientes</th>
                  <th className="text-center py-2 px-3">Lead Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {proveedores.map(p => (
                  <tr key={p.nombre} className="hover:bg-gray-50">
                    <td className="py-2.5 px-4 font-medium text-gray-900">{p.nombre}</td>
                    <td className="py-2.5 px-3 text-center text-gray-600">{p.ordenes}</td>
                    <td className="py-2.5 px-3 text-right text-gray-700">${p.totalUSD.toFixed(0)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-green-600 font-medium">{p.recibidas}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {p.pendientes > 0 ? (
                        <span className="text-amber-600 font-medium">{p.pendientes}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {p.diasPromedioRecepcion > 0 ? (
                        <span className={p.diasPromedioRecepcion <= 14 ? 'text-green-600' : p.diasPromedioRecepcion <= 21 ? 'text-amber-600' : 'text-red-600'}>
                          {p.diasPromedioRecepcion.toFixed(0)}d
                        </span>
                      ) : '-'}
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
