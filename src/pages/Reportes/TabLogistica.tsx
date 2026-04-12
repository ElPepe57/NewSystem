import React, { useState, useEffect, useMemo } from 'react';
import { Truck, Clock, DollarSign, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Package, Weight, Scale } from 'lucide-react';
import { logisticaReporteService, type ResumenLogistica, type RendimientoViajero, type TransferenciaResumen } from '../../services/logistica.reporte.service';
import { useProductoStore } from '../../store/productoStore';
import { formatCurrency } from '../../utils/format';
import { DataTable } from '../../design-system';
import type { DataTableColumn } from '../../design-system';

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
        const segmentoColor = p.pesoLibras! < 0.5 ? 'text-emerald-700 bg-emerald-100' : p.pesoLibras! < 1 ? 'text-sky-700 bg-sky-100' : p.pesoLibras! < 3 ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100';
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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!data) return <p className="text-center text-slate-500 py-10">Error al cargar datos</p>;

  return (
    <div className="space-y-6">
      {/* KPIs Header */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard icon={<Truck className="h-5 w-5 text-sky-600" />} label="En transito" value={`${data.enviosEnTransito}`} sub={`${data.unidadesEnTransito} uds`} bg="bg-sky-50" />
        <KPICard icon={<Clock className="h-5 w-5 text-purple-600" />} label="Dias promedio" value={data.diasPromedioTransitoGlobal.toFixed(1)} sub="transito internacional" bg="bg-purple-50" />
        <KPICard icon={<CheckCircle className="h-5 w-5 text-emerald-600" />} label="Cumplimiento" value={`${data.tasaCumplimientoGlobal.toFixed(0)}%`} sub="entregas a tiempo" bg="bg-emerald-50" />
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
        <RankingEficienciaTable
          rankingProductos={rankingProductos}
          sinPeso={productos.filter(p => p.estado === 'activo' && !p.pesoLibras).length}
        />
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
  const cumplimientoColor = v.tasaCumplimiento >= 80 ? 'text-emerald-700 bg-emerald-100' : v.tasaCumplimiento >= 60 ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100';
  const integridadColor = v.tasaIntegridad >= 95 ? 'text-emerald-600' : v.tasaIntegridad >= 85 ? 'text-amber-600' : 'text-red-600';

  return (
    <div>
      <button type="button" onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 text-left">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
            <Truck className="h-4 w-4 text-teal-600" />
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
            <MiniStat label="Danadas/Faltantes" value={`${v.unidadesDanadas}/${v.unidadesFaltantes}`} className={v.unidadesDanadas + v.unidadesFaltantes > 0 ? 'text-red-600' : 'text-emerald-600'} />
            <MiniStat label="Peso total" value={v.pesoTotalTransportadoLb > 0 ? `${v.pesoTotalTransportadoLb.toFixed(1)} lb` : '—'} />
            <MiniStat label="Costo/lb" value={v.costoPromedioPorLibra > 0 ? `$${v.costoPromedioPorLibra.toFixed(2)}` : '—'} className={v.costoPromedioPorLibra > 0 ? 'text-teal-600' : 'text-slate-400'} />
          </div>

          {/* Historial de envíos */}
          <HistorialEnviosTable transferencias={v.transferencias.slice(0, 10)} />
        </div>
      )}
    </div>
  );
};

// ---- Tabla: Historial de envios por viajero ----

type RankingItem = {
  sku: string;
  nombre: string;
  pesoLibras: number;
  ctru: number;
  margen: number;
  margenPorLibra: number;
  segmento: string;
  segmentoColor: string;
};

const columnasHistorialEnvios: DataTableColumn<TransferenciaResumen>[] = [
  {
    key: 'numero',
    header: '#',
    render: (t) => <span className="text-slate-600">{t.numero}</span>,
  },
  {
    key: 'fecha',
    header: 'Fecha',
    render: (t) => (
      <span className="text-slate-600">
        {t.fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
      </span>
    ),
  },
  {
    key: 'unidades',
    header: 'Uds',
    align: 'center',
    render: (t) => <span>{t.unidades}</span>,
  },
  {
    key: 'peso',
    header: 'Peso',
    align: 'center',
    render: (t) => (
      <span className="text-slate-500">{t.pesoTotalLb ? t.pesoTotalLb.toFixed(1) : '-'}</span>
    ),
  },
  {
    key: 'dias',
    header: 'Dias',
    align: 'center',
    render: (t) => <span>{t.diasTransito ?? '-'}</span>,
  },
  {
    key: 'puntual',
    header: 'Puntual',
    align: 'center',
    render: (t) =>
      t.aTiempo === null ? (
        <span className="text-slate-300">-</span>
      ) : t.aTiempo ? (
        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 text-red-500 mx-auto" />
      ),
  },
  {
    key: 'flete',
    header: 'Flete',
    align: 'right',
    render: (t) => <span>${t.costoFlete.toFixed(0)}</span>,
  },
  {
    key: 'porUnidad',
    header: '$/ud',
    align: 'right',
    render: (t) => <span>${t.tarifaPorUnidad.toFixed(2)}</span>,
  },
  {
    key: 'porLibra',
    header: '$/lb',
    align: 'right',
    render: (t) => (
      <span className="text-teal-600">
        {t.costoFletePorLibra ? `$${t.costoFletePorLibra.toFixed(2)}` : '-'}
      </span>
    ),
  },
];

const HistorialEnviosTable: React.FC<{ transferencias: TransferenciaResumen[] }> = ({ transferencias }) => (
  <DataTable
    columns={columnasHistorialEnvios}
    data={transferencias}
    keyExtractor={t => t.id}
    compact
  />
);

// ---- Tabla: Ranking de eficiencia logistica por producto ----

const columnasRanking: DataTableColumn<RankingItem>[] = [
  {
    key: 'num',
    header: '#',
    render: (_p) => null, // placeholder — se sobrescribe en el componente
  },
  {
    key: 'producto',
    header: 'Producto',
    render: (p) => (
      <div>
        <div className="font-medium text-slate-900 truncate max-w-[200px]">{p.nombre}</div>
        <div className="text-slate-400">{p.sku}</div>
      </div>
    ),
  },
  {
    key: 'peso',
    header: 'Peso',
    align: 'center',
    render: (p) => <span className="font-mono">{p.pesoLibras.toFixed(2)} lb</span>,
  },
  {
    key: 'segmento',
    header: 'Segmento',
    align: 'center',
    render: (p) => (
      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${p.segmentoColor}`}>
        {p.segmento}
      </span>
    ),
  },
  {
    key: 'ctru',
    header: 'CTRU',
    align: 'right',
    render: (p) => <span className="font-mono">{formatCurrency(p.ctru, 'PEN')}</span>,
  },
  {
    key: 'margen',
    header: 'Margen',
    align: 'right',
    render: (p) => <span className="font-mono">{formatCurrency(p.margen, 'PEN')}</span>,
  },
  {
    key: 'margenPorLibra',
    header: 'Margen/lb',
    align: 'right',
    render: (p) => (
      <span className="font-mono font-semibold text-teal-600">
        {formatCurrency(p.margenPorLibra, 'PEN')}/lb
      </span>
    ),
  },
];

const RankingEficienciaTable: React.FC<{ rankingProductos: RankingItem[]; sinPeso: number }> = ({
  rankingProductos,
  sinPeso,
}) => {
  // Inject row index into the # column at render time
  const columnsConIndice: DataTableColumn<RankingItem>[] = columnasRanking.map(col =>
    col.key === 'num'
      ? {
          ...col,
          render: (p) => (
            <span className="text-slate-500">{rankingProductos.indexOf(p) + 1}</span>
          ),
        }
      : col
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Eficiencia Logistica por Producto</h3>
        <span className="text-xs text-slate-500">{rankingProductos.length} productos con peso</span>
      </div>
      <DataTable
        columns={columnsConIndice}
        data={rankingProductos.slice(0, 15)}
        keyExtractor={p => p.sku}
        compact
      />
      {sinPeso > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-t text-xs text-amber-700">
          {sinPeso} productos activos sin peso registrado — no aparecen en este ranking
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
