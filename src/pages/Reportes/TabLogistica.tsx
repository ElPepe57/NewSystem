import React, { useState, useEffect, useMemo } from 'react';
import { Truck, Clock, DollarSign, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Package, Weight, Scale } from 'lucide-react';
import { logisticaReporteService, type ResumenLogistica, type RendimientoViajero } from '../../services/logistica.reporte.service';
import { useProductoStore } from '../../store/productoStore';
import { formatCurrency } from '../../utils/format';

export const TabLogistica: React.FC = () => {
  const [data, setData] = useState<ResumenLogistica | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedViajero, setExpandedViajero] = useState<string | null>(null);
  const { productos, fetchProductos } = useProductoStore();

  useEffect(() => {
    logisticaReporteService.getResumenLogistica()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
    if (productos.length === 0) fetchProductos();
  }, []);

  // Ranking de productos por eficiencia logística (margen/lb)
  const rankingProductos = useMemo(() => {
    const conPeso = productos
      .filter(p => p.pesoLibras && p.pesoLibras > 0 && p.estado === 'activo')
      .map(p => {
        const ctru = p.ctruPromedio || 0;
        const precioVenta = (p as any).precioSugerido || (p as any).precioVenta || ctru * 1.5;
        const margen = precioVenta - ctru;
        const margenPorLibra = margen / p.pesoLibras!;
        const segmento = p.pesoLibras! < 0.5 ? 'Ultraliviano' : p.pesoLibras! < 1 ? 'Liviano' : p.pesoLibras! < 3 ? 'Medio' : 'Pesado';
        const segmentoColor = p.pesoLibras! < 0.5 ? 'text-green-700 bg-green-100' : p.pesoLibras! < 1 ? 'text-blue-700 bg-blue-100' : p.pesoLibras! < 3 ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100';
        return {
          sku: p.sku,
          nombre: `${p.marca} ${p.nombreComercial}`,
          pesoLibras: p.pesoLibras!,
          ctru,
          margen,
          margenPorLibra,
          segmento,
          segmentoColor,
        };
      })
      .sort((a, b) => b.margenPorLibra - a.margenPorLibra);
    return conPeso;
  }, [productos]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!data) return <p className="text-center text-slate-500 py-10">Error al cargar datos</p>;

  return (
    <div className="space-y-6">
      {/* KPIs Header */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard icon={<Truck className="h-5 w-5 text-blue-600" />} label="En transito" value={`${data.enviosEnTransito}`} sub={`${data.unidadesEnTransito} uds`} bg="bg-blue-50" />
        <KPICard icon={<Clock className="h-5 w-5 text-purple-600" />} label="Dias promedio" value={data.diasPromedioTransitoGlobal.toFixed(1)} sub="transito internacional" bg="bg-purple-50" />
        <KPICard icon={<CheckCircle className="h-5 w-5 text-green-600" />} label="Cumplimiento" value={`${data.tasaCumplimientoGlobal.toFixed(0)}%`} sub="entregas a tiempo" bg="bg-green-50" />
        <KPICard icon={<DollarSign className="h-5 w-5 text-amber-600" />} label="Flete prom." value={`$${data.tarifaPromedioGlobal.toFixed(2)}`} sub="por unidad" bg="bg-amber-50" />
        <KPICard icon={<Package className="h-5 w-5 text-teal-600" />} label="Peso total" value={`${data.pesoTotalTransportadoLb.toFixed(1)}`} sub="libras transportadas" bg="bg-teal-50" />
        <KPICard icon={<Scale className="h-5 w-5 text-teal-600" />} label="Costo/lb" value={data.costoPromedioPorLibraGlobal > 0 ? `$${data.costoPromedioPorLibraGlobal.toFixed(2)}` : '—'} sub="USD por libra" bg="bg-teal-50" />
      </div>

      {/* Tabla de viajeros */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b">
          <h3 className="font-semibold text-slate-900">Rendimiento por Viajero / Courier</h3>
        </div>

        {data.viajeros.length === 0 ? (
          <p className="text-center text-slate-400 py-10">No hay transferencias internacionales registradas</p>
        ) : (
          <div className="divide-y">
            {data.viajeros.map(v => (
              <ViajeroRow
                key={v.viajeroId}
                viajero={v}
                isExpanded={expandedViajero === v.viajeroId}
                onToggle={() => setExpandedViajero(expandedViajero === v.viajeroId ? null : v.viajeroId)}
              />
            ))}
          </div>
        )}
      </div>
      {/* Ranking de productos por eficiencia logística */}
      {rankingProductos.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Eficiencia Logistica por Producto</h3>
            <span className="text-xs text-slate-500">{rankingProductos.length} productos con peso</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b bg-slate-50">
                  <th className="text-left py-2 px-3">#</th>
                  <th className="text-left py-2 px-3">Producto</th>
                  <th className="text-center py-2 px-3">Peso</th>
                  <th className="text-center py-2 px-3">Segmento</th>
                  <th className="text-right py-2 px-3">CTRU</th>
                  <th className="text-right py-2 px-3">Margen</th>
                  <th className="text-right py-2 px-3">Margen/lb</th>
                </tr>
              </thead>
              <tbody>
                {rankingProductos.slice(0, 15).map((p, i) => (
                  <tr key={p.sku} className={`border-b border-slate-100 ${i < 3 ? 'bg-green-50/30' : ''} ${i >= rankingProductos.length - 3 ? 'bg-red-50/30' : ''}`}>
                    <td className="py-1.5 px-3 text-slate-500">{i + 1}</td>
                    <td className="py-1.5 px-3">
                      <div className="font-medium text-slate-900 truncate max-w-[200px]">{p.nombre}</div>
                      <div className="text-slate-400">{p.sku}</div>
                    </td>
                    <td className="py-1.5 px-3 text-center font-mono">{p.pesoLibras.toFixed(2)} lb</td>
                    <td className="py-1.5 px-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${p.segmentoColor}`}>{p.segmento}</span>
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono">{formatCurrency(p.ctru, 'PEN')}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{formatCurrency(p.margen, 'PEN')}</td>
                    <td className="py-1.5 px-3 text-right font-mono font-semibold text-teal-600">{formatCurrency(p.margenPorLibra, 'PEN')}/lb</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {productos.filter(p => p.estado === 'activo' && !p.pesoLibras).length > 0 && (
            <div className="px-4 py-2 bg-amber-50 border-t text-xs text-amber-700">
              {productos.filter(p => p.estado === 'activo' && !p.pesoLibras).length} productos activos sin peso registrado — no aparecen en este ranking
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---- Sub-componentes ----

const KPICard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub: string; bg: string }> = ({ icon, label, value, sub, bg }) => (
  <div className={`${bg} rounded-xl p-4`}>
    <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs font-medium text-slate-600">{label}</span></div>
    <p className="text-2xl font-bold text-slate-900">{value}</p>
    <p className="text-xs text-slate-500">{sub}</p>
  </div>
);

const ViajeroRow: React.FC<{ viajero: RendimientoViajero; isExpanded: boolean; onToggle: () => void }> = ({ viajero: v, isExpanded, onToggle }) => {
  const cumplimientoColor = v.tasaCumplimiento >= 80 ? 'text-green-700 bg-green-100' : v.tasaCumplimiento >= 60 ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100';
  const integridadColor = v.tasaIntegridad >= 95 ? 'text-green-600' : v.tasaIntegridad >= 85 ? 'text-amber-600' : 'text-red-600';

  return (
    <div>
      <button type="button" onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 text-left">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
            <Truck className="h-4 w-4 text-primary-600" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate">{v.viajeroNombre}</p>
            <p className="text-xs text-slate-500">
              {v.enviosTotales} envios · {v.unidadesTransportadas} uds · ${v.tarifaPromedioUSD.toFixed(2)}/ud
              {v.pesoTotalTransportadoLb > 0 && ` · ${v.pesoTotalTransportadoLb.toFixed(1)} lb · $${v.costoPromedioPorLibra.toFixed(2)}/lb`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cumplimientoColor}`}>
            {v.tasaCumplimiento.toFixed(0)}%
          </span>
          {v.montoPendientePagoUSD > 0 && (
            <span className="text-xs text-amber-600 font-medium">Pend: ${v.montoPendientePagoUSD.toFixed(0)}</span>
          )}
          {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 bg-slate-50/50">
          {/* Métricas detalladas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
            <MiniStat label="Dias promedio" value={`${v.diasPromedioTransito.toFixed(1)}d`} />
            <MiniStat label="Integridad" value={`${v.tasaIntegridad.toFixed(0)}%`} className={integridadColor} />
            <MiniStat label="Flete total" value={`$${v.costoFleteTotal.toFixed(0)}`} />
            <MiniStat label="Danadas/Faltantes" value={`${v.unidadesDanadas}/${v.unidadesFaltantes}`} className={v.unidadesDanadas + v.unidadesFaltantes > 0 ? 'text-red-600' : 'text-green-600'} />
            <MiniStat label="Peso total" value={v.pesoTotalTransportadoLb > 0 ? `${v.pesoTotalTransportadoLb.toFixed(1)} lb` : '—'} />
            <MiniStat label="Costo/lb" value={v.costoPromedioPorLibra > 0 ? `$${v.costoPromedioPorLibra.toFixed(2)}` : '—'} className={v.costoPromedioPorLibra > 0 ? 'text-teal-600' : 'text-slate-400'} />
          </div>

          {/* Historial de envíos */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b">
                  <th className="text-left py-1.5 pr-2">#</th>
                  <th className="text-left py-1.5 pr-2">Fecha</th>
                  <th className="text-center py-1.5 px-2">Uds</th>
                  <th className="text-center py-1.5 px-2">Peso</th>
                  <th className="text-center py-1.5 px-2">Dias</th>
                  <th className="text-center py-1.5 px-2">Puntual</th>
                  <th className="text-right py-1.5 px-2">Flete</th>
                  <th className="text-right py-1.5 px-2">$/ud</th>
                  <th className="text-right py-1.5">$/lb</th>
                </tr>
              </thead>
              <tbody>
                {v.transferencias.slice(0, 10).map(t => (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 text-slate-600">{t.numero}</td>
                    <td className="py-1.5 pr-2 text-slate-600">{t.fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</td>
                    <td className="py-1.5 px-2 text-center">{t.unidades}</td>
                    <td className="py-1.5 px-2 text-center text-slate-500">{t.pesoTotalLb ? `${t.pesoTotalLb.toFixed(1)}` : '-'}</td>
                    <td className="py-1.5 px-2 text-center">{t.diasTransito ?? '-'}</td>
                    <td className="py-1.5 px-2 text-center">
                      {t.aTiempo === null ? <span className="text-slate-300">-</span> : t.aTiempo ? <CheckCircle className="h-3.5 w-3.5 text-green-500 mx-auto" /> : <AlertTriangle className="h-3.5 w-3.5 text-red-500 mx-auto" />}
                    </td>
                    <td className="py-1.5 px-2 text-right">${t.costoFlete.toFixed(0)}</td>
                    <td className="py-1.5 px-2 text-right">${t.tarifaPorUnidad.toFixed(2)}</td>
                    <td className="py-1.5 text-right text-teal-600">{t.costoFletePorLibra ? `$${t.costoFletePorLibra.toFixed(2)}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const MiniStat: React.FC<{ label: string; value: string; className?: string }> = ({ label, value, className = 'text-slate-900' }) => (
  <div className="bg-white rounded-lg p-2 border border-slate-100">
    <p className="text-[10px] text-slate-500">{label}</p>
    <p className={`text-sm font-semibold ${className}`}>{value}</p>
  </div>
);
