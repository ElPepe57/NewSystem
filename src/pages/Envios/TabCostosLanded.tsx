/**
 * TabCostosLanded — S40 Bloque D
 *
 * Breakdown de costos landed (flete, aduana, brokerage, seguro, otros) por envío.
 * Permite identificar envíos con costos anómalos y drill-down al detalle de cada uno.
 *
 * Fuente de datos: `envio.costosLanded[]` y `envio.costoLandedTotalPEN`.
 * No re-calcula — usa los valores ya almacenados en Firestore.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  DollarSign,
  ShieldAlert,
  Truck,
  Package,
  Wallet,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  Filter as FilterIcon,
} from 'lucide-react';
import { DataTable, StatCard } from '../../design-system';
import type { DataTableColumn } from '../../design-system';
import { Badge, Button, SearchInput } from '../../components/common';
import { useEnvioStore } from '../../store/envioStore';
import { formatCurrency } from '../../utils/format';
import type { Envio, CostoLanded } from '../../types/envio.types';

/**
 * Clasifica un CostoLanded en una categoría visual común.
 */
function clasificarCosto(c: CostoLanded): 'flete' | 'aduana' | 'brokerage' | 'seguro' | 'otros' {
  const nombre = (c.categoriaCostoNombre || '').toLowerCase();
  const id = (c.categoriaCostoId || '').toLowerCase();
  if (nombre.includes('flete') || id === 'flete') return 'flete';
  if (nombre.includes('aduana') || id === 'aduana' || id === 'impuesto') return 'aduana';
  if (nombre.includes('broker') || id === 'brokerage') return 'brokerage';
  if (nombre.includes('seguro') || id === 'seguro') return 'seguro';
  return 'otros';
}

const CATEGORIA_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  flete: { label: 'Flete', icon: Truck, color: 'text-sky-600' },
  aduana: { label: 'Aduana', icon: ShieldAlert, color: 'text-orange-600' },
  brokerage: { label: 'Brokerage', icon: Wallet, color: 'text-purple-600' },
  seguro: { label: 'Seguro', icon: Package, color: 'text-emerald-600' },
  otros: { label: 'Otros', icon: DollarSign, color: 'text-slate-500' },
};

interface EnvioConCostos {
  envio: Envio;
  costos: CostoLanded[];
  totalPEN: number;
  porCategoria: Record<string, number>;
  porUnidad: number;  // Total / unidades del envío
}

type FiltroPeriodo = 'todos' | 'mes_actual' | 'ultimos_3_meses' | 'ultimos_6_meses';

export const TabCostosLanded: React.FC = () => {
  const { envios, fetchEnvios } = useEnvioStore();
  const [search, setSearch] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>('ultimos_3_meses');
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (envios.length === 0) fetchEnvios();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Construcción de dataset
  const enviosConCostos = useMemo<EnvioConCostos[]>(() => {
    return envios
      .filter(e => (e.costosLanded || []).length > 0)
      .map(envio => {
        const costos = envio.costosLanded || [];
        const totalPEN = envio.costoLandedTotalPEN || costos.reduce((s, c) => s + (c.montoPEN || 0), 0);
        const porCategoria: Record<string, number> = {};
        for (const c of costos) {
          const cat = clasificarCosto(c);
          porCategoria[cat] = (porCategoria[cat] || 0) + (c.montoPEN || 0);
        }
        const unidades = envio.totalUnidades || 1;
        return {
          envio,
          costos,
          totalPEN,
          porCategoria,
          porUnidad: totalPEN / unidades,
        };
      });
  }, [envios]);

  // Filtros
  const filtrados = useMemo(() => {
    let list = enviosConCostos;

    // Período
    const now = Date.now();
    const MES_MS = 30 * 24 * 60 * 60 * 1000;
    if (filtroPeriodo === 'mes_actual') {
      const mesAtras = now - MES_MS;
      list = list.filter(e => e.envio.fechaCreacion.toMillis() >= mesAtras);
    } else if (filtroPeriodo === 'ultimos_3_meses') {
      const cutoff = now - 3 * MES_MS;
      list = list.filter(e => e.envio.fechaCreacion.toMillis() >= cutoff);
    } else if (filtroPeriodo === 'ultimos_6_meses') {
      const cutoff = now - 6 * MES_MS;
      list = list.filter(e => e.envio.fechaCreacion.toMillis() >= cutoff);
    }

    // Búsqueda
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(e =>
        e.envio.numeroEnvio.toLowerCase().includes(q)
        || e.envio.ordenCompraNumero?.toLowerCase().includes(q)
        || e.envio.origenProveedorNombre?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [enviosConCostos, filtroPeriodo, search]);

  // KPIs agregados sobre los filtrados
  const resumen = useMemo(() => {
    const total = filtrados.reduce((s, e) => s + e.totalPEN, 0);
    const unidades = filtrados.reduce((s, e) => s + (e.envio.totalUnidades || 0), 0);
    const porCategoria = filtrados.reduce<Record<string, number>>((acc, e) => {
      for (const [cat, monto] of Object.entries(e.porCategoria)) {
        acc[cat] = (acc[cat] || 0) + monto;
      }
      return acc;
    }, {});
    return {
      totalEnvios: filtrados.length,
      totalPEN: total,
      costoPorUnidad: unidades > 0 ? total / unidades : 0,
      costoPromedioEnvio: filtrados.length > 0 ? total / filtrados.length : 0,
      porCategoria,
    };
  }, [filtrados]);

  const toggleExpand = (id: string) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const columnas: DataTableColumn<EnvioConCostos>[] = [
    {
      key: 'expand',
      header: '',
      width: '4%',
      render: r => {
        const expandido = expandidos.has(r.envio.id);
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleExpand(r.envio.id); }}
            className="text-slate-400 hover:text-slate-600"
          >
            {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        );
      },
    },
    {
      key: 'envio',
      header: 'Envío',
      width: '16%',
      render: r => (
        <div>
          <div className="font-medium text-slate-900">{r.envio.numeroEnvio}</div>
          <div className="text-xs text-slate-500">
            {r.envio.fechaCreacion.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
            {r.envio.ordenCompraNumero && <> · {r.envio.ordenCompraNumero}</>}
          </div>
        </div>
      ),
    },
    {
      key: 'origen',
      header: 'Origen',
      width: '18%',
      hideOnMobile: true,
      render: r => (
        <div className="text-sm">
          <div className="text-slate-700 truncate">
            {r.envio.origenProveedorNombre || r.envio.origenCasillaNombre || '—'}
          </div>
          <div className="text-xs text-slate-500">
            {r.envio.totalUnidades || 0} unidades
          </div>
        </div>
      ),
    },
    {
      key: 'flete',
      header: 'Flete',
      width: '10%',
      align: 'right',
      hideOnMobile: true,
      render: r => (
        <span className="text-xs text-sky-700">
          {r.porCategoria.flete ? formatCurrency(r.porCategoria.flete, 'PEN') : '—'}
        </span>
      ),
    },
    {
      key: 'aduana',
      header: 'Aduana',
      width: '10%',
      align: 'right',
      hideOnMobile: true,
      render: r => (
        <span className="text-xs text-orange-700">
          {r.porCategoria.aduana ? formatCurrency(r.porCategoria.aduana, 'PEN') : '—'}
        </span>
      ),
    },
    {
      key: 'otros',
      header: 'Otros',
      width: '10%',
      align: 'right',
      hideOnMobile: true,
      render: r => {
        const otros = (r.porCategoria.otros || 0) + (r.porCategoria.brokerage || 0) + (r.porCategoria.seguro || 0);
        return (
          <span className="text-xs text-slate-600">
            {otros > 0 ? formatCurrency(otros, 'PEN') : '—'}
          </span>
        );
      },
    },
    {
      key: 'total',
      header: 'Total',
      width: '16%',
      align: 'right',
      render: r => (
        <div>
          <div className="font-semibold text-slate-900 text-sm">{formatCurrency(r.totalPEN, 'PEN')}</div>
          <div className="text-xs text-slate-500">
            {formatCurrency(r.porUnidad, 'PEN')} / unidad
          </div>
        </div>
      ),
    },
    {
      key: 'cantidadCostos',
      header: '# cargos',
      width: '8%',
      align: 'center',
      render: r => <Badge variant="default" size="sm">{r.costos.length}</Badge>,
    },
  ];

  const expandedRender = (r: EnvioConCostos) => (
    <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2">
      <div className="text-xs font-medium text-slate-700 mb-2">
        Desglose de cargos del envío {r.envio.numeroEnvio}
      </div>
      {r.costos.map(c => {
        const cat = clasificarCosto(c);
        const cfg = CATEGORIA_CONFIG[cat];
        const Icon = cfg.icon;
        return (
          <div key={c.id} className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-lg text-xs">
            <Icon className={`w-4 h-4 ${cfg.color} flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="text-slate-900 font-medium">
                {c.categoriaCostoNombre || cfg.label}
              </div>
              {c.descripcion && (
                <div className="text-slate-500 truncate">{c.descripcion}</div>
              )}
              <div className="text-[10px] text-slate-400 mt-0.5">
                Prorrateo: {c.metodoProrrateo}
                {c.pagado ? ' · Pagado' : ' · Pendiente'}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-semibold text-slate-900">
                {formatCurrency(c.montoPEN, 'PEN')}
              </div>
              {c.moneda === 'USD' && (
                <div className="text-[10px] text-slate-500">
                  ${c.monto.toFixed(2)} @ {c.tipoCambio?.toFixed(2) || '—'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* KPIs agregados */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
        <StatCard
          label="Envíos con costos"
          value={resumen.totalEnvios}
          icon={Package}
          variant="neutral"
        />
        <StatCard
          label="Total landed"
          value={formatCurrency(resumen.totalPEN, 'PEN')}
          icon={DollarSign}
          variant="info"
        />
        <StatCard
          label="Promedio / envío"
          value={formatCurrency(resumen.costoPromedioEnvio, 'PEN')}
          icon={TrendingUp}
          variant="warning"
        />
        <StatCard
          label="Costo / unidad"
          value={formatCurrency(resumen.costoPorUnidad, 'PEN')}
          icon={Package}
          variant="brand"
        />
        <StatCard
          label="Aduana total"
          value={formatCurrency(resumen.porCategoria.aduana || 0, 'PEN')}
          icon={ShieldAlert}
          variant="danger"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-slate-200 rounded-lg">
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar envío, OC, proveedor..."
          />
        </div>
        <div className="flex items-center gap-1.5">
          <FilterIcon className="w-4 h-4 text-slate-400" />
          <select
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value as FiltroPeriodo)}
            className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="mes_actual">Último mes</option>
            <option value="ultimos_3_meses">Últimos 3 meses</option>
            <option value="ultimos_6_meses">Últimos 6 meses</option>
            <option value="todos">Todos</option>
          </select>
        </div>
      </div>

      {/* Tabla con expand */}
      <DataTable<EnvioConCostos>
        data={filtrados}
        columns={columnas}
        keyExtractor={r => r.envio.id}
        onRowClick={(r) => toggleExpand(r.envio.id)}
        expandedRowRender={expandedRender}
        expandedKeys={expandidos}
        onToggleExpand={toggleExpand}
        emptyMessage={
          search
            ? 'No hay envíos que coincidan con la búsqueda.'
            : 'No hay envíos con costos landed en el período seleccionado.'
        }
      />
    </div>
  );
};
