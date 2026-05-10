/**
 * ReclamosEjecutivoSection — S40 Bloque F
 *
 * KPIs ejecutivos de reclamos para el tab Logística de /reportes.
 * Muestra: monto reclamado, cobrado, perdido, tasa de recuperación, breakdown por destinatario.
 */
import React, { useEffect, useMemo } from 'react';
import { Gavel, DollarSign, TrendingUp, AlertOctagon, Clock, Percent } from 'lucide-react';
import { useReclamoStore } from '../../../store/reclamoStore';
import { formatCurrency } from '../../../utils/format';
import type { DestinatarioReclamo } from '../../../types/reclamo.types';

const DESTINATARIO_LABELS: Record<DestinatarioReclamo, string> = {
  proveedor: 'Proveedor',
  courier: 'Courier',
  seguro: 'Seguro',
  otro: 'Otro',
};

export const ReclamosEjecutivoSection: React.FC = () => {
  const { reclamos, resumen, fetchReclamos, fetchResumen } = useReclamoStore();

  useEffect(() => {
    if (reclamos.length === 0) fetchReclamos();
    fetchResumen();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const porDestinatario = useMemo(() => {
    const map = new Map<DestinatarioReclamo, {
      count: number;
      reclamado: number;
      cobrado: number;
      perdido: number;
      activos: number;
    }>();
    for (const r of reclamos) {
      const curr = map.get(r.destinatario) || { count: 0, reclamado: 0, cobrado: 0, perdido: 0, activos: 0 };
      curr.count++;
      curr.reclamado += r.montoReclamadoPEN || 0;
      curr.cobrado += r.montoCobradoPEN || 0;
      if (r.estado === 'rechazado' || r.estado === 'cerrado_sin_cobrar') {
        curr.perdido += r.montoReclamadoPEN || 0;
      }
      if (r.estado === 'enviado' || r.estado === 'en_disputa' || r.estado === 'aceptado') {
        curr.activos++;
      }
      map.set(r.destinatario, curr);
    }
    return [...map.entries()].sort((a, b) => b[1].reclamado - a[1].reclamado);
  }, [reclamos]);

  if (!resumen || resumen.totalReclamos === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
        <Gavel className="h-5 w-5 text-slate-400 flex-shrink-0" />
        <p className="text-sm text-slate-600">No hay reclamos registrados en el sistema.</p>
      </div>
    );
  }

  const semaforoVariant = resumen.tasaRecuperacion >= 70 ? 'success'
    : resumen.tasaRecuperacion >= 40 ? 'warning'
    : 'danger';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Gavel className="h-5 w-5 text-slate-700" />
        <h3 className="font-semibold text-slate-900">Reclamos — vista ejecutiva</h3>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPIBox
          icon={<Gavel className="w-4 h-4 text-slate-600" />}
          label="Total reclamos"
          value={resumen.totalReclamos.toString()}
          bg="bg-slate-50"
          sub={`${resumen.reclamosPendientes} activos`}
        />
        <KPIBox
          icon={<DollarSign className="w-4 h-4 text-sky-600" />}
          label="Reclamado"
          value={formatCurrency(resumen.totalReclamadoPEN, 'PEN')}
          bg="bg-sky-50"
          sub="monto total"
        />
        <KPIBox
          icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
          label="Cobrado"
          value={formatCurrency(resumen.totalCobradoPEN, 'PEN')}
          bg="bg-emerald-50"
          sub={`${resumen.reclamosCobrados} recuperados`}
        />
        <KPIBox
          icon={<AlertOctagon className="w-4 h-4 text-red-600" />}
          label="Perdido"
          value={formatCurrency(resumen.totalPerdidoPEN, 'PEN')}
          bg="bg-red-50"
          sub={`${resumen.reclamosRechazados} rechazados`}
        />
        <KPIBox
          icon={<Percent className="w-4 h-4 text-slate-600" />}
          label="Recovery rate"
          value={`${resumen.tasaRecuperacion.toFixed(1)}%`}
          bg={semaforoVariant === 'success' ? 'bg-emerald-50' : semaforoVariant === 'warning' ? 'bg-amber-50' : 'bg-red-50'}
          sub={`${resumen.reclamosPendientes} pendientes`}
        />
      </div>

      {/* Breakdown por destinatario */}
      {porDestinatario.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b">
            <h4 className="text-sm font-semibold text-slate-900">Breakdown por destinatario</h4>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Destinatario</th>
                <th className="px-4 py-2 text-right font-medium">Reclamos</th>
                <th className="px-4 py-2 text-right font-medium">Activos</th>
                <th className="px-4 py-2 text-right font-medium">Reclamado</th>
                <th className="px-4 py-2 text-right font-medium">Cobrado</th>
                <th className="px-4 py-2 text-right font-medium">Perdido</th>
                <th className="px-4 py-2 text-right font-medium">Recovery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {porDestinatario.map(([dest, stats]) => {
                const recovery = stats.reclamado > 0 ? (stats.cobrado / stats.reclamado) * 100 : 0;
                return (
                  <tr key={dest}>
                    <td className="px-4 py-2 font-medium text-slate-800">{DESTINATARIO_LABELS[dest]}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{stats.count}</td>
                    <td className="px-4 py-2 text-right">
                      {stats.activos > 0 ? (
                        <span className="text-amber-700 font-medium">
                          <Clock className="inline w-3 h-3 mr-0.5" />
                          {stats.activos}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-800">{formatCurrency(stats.reclamado, 'PEN')}</td>
                    <td className="px-4 py-2 text-right text-emerald-700">{formatCurrency(stats.cobrado, 'PEN')}</td>
                    <td className="px-4 py-2 text-right text-red-700">{formatCurrency(stats.perdido, 'PEN')}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`font-semibold ${recovery >= 70 ? 'text-emerald-700' : recovery >= 40 ? 'text-amber-700' : 'text-red-700'}`}>
                        {recovery.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const KPIBox: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string; bg: string }> = ({ icon, label, value, sub, bg }) => (
  <div className={`${bg} rounded-xl p-4`}>
    <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs font-medium text-slate-600">{label}</span></div>
    <p className="text-2xl font-bold text-slate-900">{value}</p>
    {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
  </div>
);
