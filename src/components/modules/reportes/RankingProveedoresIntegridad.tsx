/**
 * RankingProveedoresIntegridad — S40 Bloque F
 *
 * Ranking de proveedores por tasa de daño/pérdida sobre las unidades recibidas
 * desde ellos. Calculado en memoria desde envíos + OCs.
 *
 * Metodología:
 *   - Para cada proveedor, sumar unidades recibidas + dañadas + perdidas en envíos
 *     donde proveedorId coincide.
 *   - damageRate = danadas / (recibidas + danadas)
 *   - lossRate = perdidas / totalEsperadas
 *   - integridadRate = recibidas_OK / totalEsperadas
 */
import React, { useEffect, useMemo } from 'react';
import { Building2, AlertTriangle, XCircle, Package } from 'lucide-react';
import { useEnvioStore } from '../../../store/envioStore';
import { useProveedorStore } from '../../../store/proveedorStore';

interface ProveedorStats {
  proveedorId: string;
  nombre: string;
  codigo?: string;
  envios: number;
  totalEsperadas: number;
  totalRecibidas: number;
  totalDanadas: number;
  totalPerdidas: number;
  damageRate: number;
  lossRate: number;
  integridadRate: number;
}

export const RankingProveedoresIntegridad: React.FC = () => {
  const { envios, fetchEnvios } = useEnvioStore();
  const { proveedores, fetchProveedores } = useProveedorStore();

  useEffect(() => {
    if (envios.length === 0) fetchEnvios();
    if (proveedores.length === 0) fetchProveedores();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ranking = useMemo<ProveedorStats[]>(() => {
    // Agrupar envíos por proveedor (solo los que vinieron de un proveedor y tienen recepciones)
    const map = new Map<string, { envio: typeof envios[0] }[]>();
    for (const envio of envios) {
      if (envio.origenTipo !== 'proveedor' || !envio.origenProveedorId) continue;
      if (envio.estado !== 'recibida_completa' && envio.estado !== 'recibida_parcial') continue;
      const arr = map.get(envio.origenProveedorId) || [];
      arr.push({ envio });
      map.set(envio.origenProveedorId, arr);
    }

    const proveedorById = new Map(proveedores.map(p => [p.id, p]));

    const stats: ProveedorStats[] = [];
    for (const [provId, items] of map.entries()) {
      let esperadas = 0, recibidas = 0, danadas = 0, perdidas = 0;
      for (const { envio } of items) {
        esperadas += envio.totalUnidades || 0;
        recibidas += envio.totalUnidadesRecibidas || 0;
        danadas += envio.totalUnidadesDanadas || 0;
        perdidas += envio.totalUnidadesFaltantes || 0;
      }
      const recibidasBase = recibidas + danadas;
      const damageRate = recibidasBase > 0 ? (danadas / recibidasBase) * 100 : 0;
      const lossRate = esperadas > 0 ? (perdidas / esperadas) * 100 : 0;
      const integridadRate = esperadas > 0 ? ((recibidas - danadas) / esperadas) * 100 : 0;
      const prov = proveedorById.get(provId);
      stats.push({
        proveedorId: provId,
        nombre: prov?.nombre || items[0].envio.origenProveedorNombre || '—',
        codigo: prov?.codigo,
        envios: items.length,
        totalEsperadas: esperadas,
        totalRecibidas: recibidas,
        totalDanadas: danadas,
        totalPerdidas: perdidas,
        damageRate,
        lossRate,
        integridadRate,
      });
    }

    // Orden: por volumen (envíos) descendente — muestra los más relevantes primero
    return stats.sort((a, b) => b.envios - a.envios).slice(0, 10);
  }, [envios, proveedores]);

  if (ranking.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
        <Building2 className="h-5 w-5 text-slate-400 flex-shrink-0" />
        <p className="text-sm text-slate-600">No hay envíos con recepciones para calcular integridad por proveedor.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b flex items-center gap-2">
        <Building2 className="w-4 h-4 text-slate-700" />
        <h3 className="font-semibold text-slate-900">Ranking proveedores — integridad</h3>
        <span className="text-xs text-slate-500 ml-2">Top 10 por volumen</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Proveedor</th>
            <th className="px-4 py-2 text-right font-medium">Envíos</th>
            <th className="px-4 py-2 text-right font-medium">Unidades</th>
            <th className="px-4 py-2 text-right font-medium">Integridad</th>
            <th className="px-4 py-2 text-right font-medium">Damage</th>
            <th className="px-4 py-2 text-right font-medium">Loss</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ranking.map(r => (
            <tr key={r.proveedorId}>
              <td className="px-4 py-2">
                <div className="font-medium text-slate-900 truncate max-w-[200px]">{r.nombre}</div>
                {r.codigo && <div className="text-xs text-slate-500">{r.codigo}</div>}
              </td>
              <td className="px-4 py-2 text-right text-slate-700 font-medium">{r.envios}</td>
              <td className="px-4 py-2 text-right">
                <span className="text-xs text-slate-600">
                  <Package className="inline w-3 h-3 mr-0.5" />
                  {r.totalRecibidas}/{r.totalEsperadas}
                </span>
              </td>
              <td className={`px-4 py-2 text-right font-semibold ${
                r.integridadRate >= 95 ? 'text-emerald-700'
                : r.integridadRate >= 85 ? 'text-amber-700'
                : 'text-red-700'
              }`}>
                {r.integridadRate.toFixed(1)}%
              </td>
              <td className="px-4 py-2 text-right">
                {r.totalDanadas > 0 ? (
                  <span className={`font-medium ${r.damageRate >= 10 ? 'text-red-700' : 'text-amber-700'}`}>
                    <AlertTriangle className="inline w-3 h-3 mr-0.5" />
                    {r.damageRate.toFixed(1)}% ({r.totalDanadas})
                  </span>
                ) : (
                  <span className="text-emerald-700">—</span>
                )}
              </td>
              <td className="px-4 py-2 text-right">
                {r.totalPerdidas > 0 ? (
                  <span className={`font-medium ${r.lossRate >= 5 ? 'text-red-700' : 'text-amber-700'}`}>
                    <XCircle className="inline w-3 h-3 mr-0.5" />
                    {r.lossRate.toFixed(1)}% ({r.totalPerdidas})
                  </span>
                ) : (
                  <span className="text-emerald-700">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 bg-slate-50 border-t text-xs text-slate-500">
        <strong>Integridad</strong> = (recibidas – dañadas) / esperadas · <strong>Damage</strong> = dañadas / (recibidas + dañadas) · <strong>Loss</strong> = perdidas / esperadas
      </div>
    </div>
  );
};
