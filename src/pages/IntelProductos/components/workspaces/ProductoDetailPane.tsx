/**
 * ProductoDetailPane · drill-down pane derecha · Cost Intelligence
 *
 * chk5.B8 (S3.6 M1.bis · Cost Intelligence) · refactor canon CI · 4 tabs
 * propios CI (NO investigación). Sustituye tabs Resumen/Costo/Mercado por:
 *
 *   Tab 1 · Variance   → attribution waterfall + mini time-series + acciones
 *   Tab 2 · Histórico  → time-series 90d de costos por lote
 *   Tab 3 · Lotes      → tabla de lotes con OC + fecha + cantidad + costo
 *   Tab 4 · Proveedores→ proveedores REALES que vendieron este SKU
 *
 * Footer: "Crear alerta" (icon bell) + "Generar OC" (icon shopping-cart).
 *
 * Mockup canónico: docs/mockups/cost-intelligence-canon-productos.html · Sec 1
 */

import React, { useState } from 'react';
import {
  X,
  ShoppingCart,
  Bell,
  TrendingUp,
  LineChart,
  Layers,
  Users,
  Lightbulb,
  ArrowRight,
  Zap,
} from 'lucide-react';
import {
  ProductoAvatar,
  inferLineaFromProducto,
} from '../../../Productos/components/shared/ProductoAvatar';
import type { SkuConCostos } from '../../utils/costIntelligence';
import { calcularVarianceAttribution } from '../../utils/costIntelligence';

interface ProductoDetailPaneProps {
  sku: SkuConCostos;
  onClose: () => void;
}

type Tab = 'variance' | 'historico' | 'lotes' | 'proveedores';

const fmtPEN = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPEN0 = (n: number) =>
  n.toLocaleString('es-PE', { maximumFractionDigits: 0 });
const fmtUSD = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number, decimals = 1) =>
  `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;
const fmtPp = (n: number) =>
  `${n >= 0 ? '+' : ''}${n.toFixed(1)} pp`;

function fmtFechaCorta(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit' });
}

function lineaBadgeClasses(linea: string | undefined): string {
  const code = (linea ?? '').toLowerCase();
  if (code.includes('skin')) return 'bg-amber-50 text-amber-700';
  if (code.includes('sup') || code.includes('vita')) return 'bg-indigo-50 text-indigo-700';
  return 'bg-slate-50 text-slate-600';
}

export const ProductoDetailPane: React.FC<ProductoDetailPaneProps> = ({ sku, onClose }) => {
  const [tab, setTab] = useState<Tab>('variance');
  const isAnomalia = sku.estadoCosto === 'anomalo';

  const linea = inferLineaFromProducto({
    linea: sku.lineaNegocioNombre,
    tipo: sku.tipoProductoNombre,
    esPack: sku.esPack,
  });

  // Header gradient · rose si anomalía · línea-based si no
  const headerBg = isAnomalia
    ? 'from-rose-50/60 to-white'
    : linea === 'skincare'
    ? 'from-amber-50/60 to-white'
    : linea === 'suplemento'
    ? 'from-indigo-50/60 to-white'
    : linea === 'pack'
    ? 'from-purple-50/60 to-white'
    : 'from-slate-50/60 to-white';

  return (
    <aside className="bg-white border border-slate-200 rounded-xl flex flex-col max-h-[calc(100vh-200px)] overflow-hidden sticky top-4">
      {/* Header pane · gradient + chips */}
      <div className={`px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2 bg-gradient-to-br ${headerBg}`}>
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <ProductoAvatar linea={linea} size="md" />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-mono text-slate-500 mb-0.5 flex items-center gap-1">
              <span>{sku.sku || '—'}</span>
              {isAnomalia && (
                <span className="px-1 py-0.5 rounded bg-rose-100 text-rose-700 text-[8px] font-bold flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5" />
                  ANOMALÍA
                </span>
              )}
            </div>
            <div className="font-bold text-slate-900 text-sm truncate" title={sku.nombreComercial}>
              {sku.nombreComercial}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              {sku.marca && <span>{sku.marca}</span>}
              {sku.marca && (sku.lineaNegocioNombre || sku.unidadesActivas > 0) && <span>·</span>}
              {sku.lineaNegocioNombre && (
                <span className={`px-1.5 py-0.5 rounded font-bold ${lineaBadgeClasses(sku.lineaNegocioNombre)}`}>
                  {sku.lineaNegocioNombre}
                </span>
              )}
              {sku.unidadesActivas > 0 && (
                <>
                  <span>·</span>
                  <span>{sku.unidadesActivas} uds activas · S/ {fmtPEN0(sku.capitalActivoPEN)} capital</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 p-1 -m-1 rounded"
          aria-label="Cerrar (esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs sticky · 4 tabs canon CI */}
      <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
        <TabButton active={tab === 'variance'} onClick={() => setTab('variance')} icon={TrendingUp}>
          Variance
        </TabButton>
        <TabButton active={tab === 'historico'} onClick={() => setTab('historico')} icon={LineChart}>
          Histórico
        </TabButton>
        <TabButton active={tab === 'lotes'} onClick={() => setTab('lotes')} icon={Layers}>
          Lotes
        </TabButton>
        <TabButton active={tab === 'proveedores'} onClick={() => setTab('proveedores')} icon={Users}>
          Proveedores
        </TabButton>
      </div>

      {/* Contenido scrolleable según tab */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {tab === 'variance' && <VarianceTab sku={sku} />}
        {tab === 'historico' && <HistoricoTab sku={sku} />}
        {tab === 'lotes' && <LotesTab sku={sku} />}
        {tab === 'proveedores' && <ProveedoresTab sku={sku} />}
      </div>

      {/* Footer · acciones canon CI */}
      <div className="border-t border-slate-200 p-2.5 flex items-center gap-2 bg-slate-50">
        <button
          type="button"
          className="flex-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md px-2 py-1.5 flex items-center justify-center gap-1.5"
          title="Crear alerta · próximamente"
          onClick={() => alert('Crear alerta · próximamente')}
        >
          <Bell className="w-3 h-3" />
          Crear alerta
        </button>
        <button
          type="button"
          className="flex-1 text-[11px] font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-md px-2 py-1.5 flex items-center justify-center gap-1.5"
          title="Generar OC · próximamente"
          onClick={() => alert('Generar OC desde Cost Intelligence · próximamente')}
        >
          <ShoppingCart className="w-3 h-3" />
          Generar OC
        </button>
      </div>
    </aside>
  );
};

// ─── TAB 1 · Variance attribution waterfall ──────────────────────────────────
const VarianceTab: React.FC<{ sku: SkuConCostos }> = ({ sku }) => {
  const attribution = calcularVarianceAttribution(sku);

  if (sku.varianceVsLoteAntPct === null || !attribution) {
    return (
      <div className="text-center text-xs text-slate-500 py-6">
        <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        Sólo 1 lote registrado · Variance requiere ≥2 OCs
      </div>
    );
  }

  const totalAbs = Math.abs(attribution.totalPp) || 1;
  const drivers: Array<{ label: string; valuePp: number; colorBar: string; colorText: string }> = [
    { label: 'Precio proveedor', valuePp: attribution.precioProveedorPp, colorBar: 'bg-rose-500',   colorText: 'text-rose-700'   },
    { label: 'Flete intl.',      valuePp: attribution.fleteIntlPp,       colorBar: 'bg-amber-500',  colorText: 'text-amber-700'  },
    { label: 'TC (TCPA)',        valuePp: attribution.tcPp,              colorBar: 'bg-sky-500',    colorText: 'text-sky-700'    },
    { label: 'Costos landed',    valuePp: attribution.costosLandedPp,    colorBar: 'bg-purple-500', colorText: 'text-purple-700' },
  ];

  return (
    <>
      {/* Resumen */}
      <div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          Variance attribution
        </div>
        <div className="text-[11px] text-slate-700">
          Costo varió{' '}
          <span className={`font-bold tabular-nums ${
            sku.varianceVsLoteAntPct >= 0 ? 'text-rose-600' : 'text-emerald-600'
          }`}>
            {fmtPct(sku.varianceVsLoteAntPct)}
          </span>{' '}
          entre los últimos 2 lotes
        </div>
      </div>

      {/* Drivers waterfall */}
      <div className="space-y-2">
        {drivers.map((d) => {
          const width = Math.min(100, (Math.abs(d.valuePp) / totalAbs) * 100);
          return (
            <div key={d.label} className="flex items-center gap-2">
              <div className="w-24 text-[10px] text-slate-700 font-medium">{d.label}</div>
              <div className="relative flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                <div className={`absolute inset-y-0 left-0 ${d.colorBar} rounded`} style={{ width: `${width}%` }} />
                <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
                  {fmtPp(d.valuePp)}
                </div>
              </div>
              <div className={`w-10 text-[10px] text-right font-bold tabular-nums ${d.colorText}`}>
                {Math.round((Math.abs(d.valuePp) / totalAbs) * 100)}%
              </div>
            </div>
          );
        })}
        <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
          <span className="text-[11px] text-slate-700 font-bold">Total atribuido</span>
          <span
            className={`text-[12px] font-bold tabular-nums ${
              attribution.totalPp >= 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            {fmtPp(attribution.totalPp)} ✓
          </span>
        </div>
      </div>

      {/* Acciones data-driven (NO investigación) */}
      {sku.estadoCosto === 'anomalo' && (
        <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb className="w-3.5 h-3.5 text-amber-700" />
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
              Acciones sugeridas
            </span>
          </div>
          <div className="space-y-1.5">
            {sku.proveedores.length > 0 && (
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 text-left bg-white border border-amber-200 rounded px-2.5 py-1.5 text-[11px] hover:border-amber-300"
              >
                <span className="text-slate-700">
                  Renegociar con {sku.proveedores[0].proveedorNombre}
                </span>
                <ArrowRight className="w-3 h-3 text-amber-700" />
              </button>
            )}
            <button
              type="button"
              className="w-full flex items-center justify-between gap-2 text-left bg-white border border-amber-200 rounded px-2.5 py-1.5 text-[11px] hover:border-amber-300"
            >
              <span className="text-slate-700">
                Revisar próxima OC · ajustar cantidad
              </span>
              <ArrowRight className="w-3 h-3 text-amber-700" />
            </button>
            <button
              type="button"
              className="w-full flex items-center justify-between gap-2 text-left bg-white border border-amber-200 rounded px-2.5 py-1.5 text-[11px] hover:border-amber-300"
            >
              <span className="text-slate-700">Subir precio venta para mantener margen</span>
              <ArrowRight className="w-3 h-3 text-amber-700" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// ─── TAB 2 · Histórico time-series ───────────────────────────────────────────
const HistoricoTab: React.FC<{ sku: SkuConCostos }> = ({ sku }) => {
  if (sku.trendCostosPEN.length < 2) {
    return (
      <div className="text-center text-xs text-slate-500 py-6">
        <LineChart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        Necesita ≥2 lotes para serie temporal
      </div>
    );
  }

  const valores = sku.trendCostosPEN;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const range = max - min || 1;
  const fechas = sku.lotes.map((l) => l.fechaRecepcion);

  // Generar polyline SVG (viewBox 280x60)
  const points = valores.map((v, i) => {
    const x = (i / (valores.length - 1)) * 280;
    const y = 55 - ((v - min) / range) * 50;
    return `${x},${y}`;
  }).join(' ');

  const ultimo = valores[valores.length - 1];
  const primero = valores[0];
  const deltaPct = ((ultimo - primero) / primero) * 100;

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          Costo unitario · histórico
        </div>
        <div className="text-[11px] text-slate-700 tabular-nums">
          S/ {fmtPEN(primero)} → S/ {fmtPEN(ultimo)}{' '}
          <span className={deltaPct >= 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
            ({fmtPct(deltaPct)})
          </span>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
        <svg viewBox="0 0 280 60" className="w-full h-16">
          <polyline
            points={points}
            fill="none"
            stroke={deltaPct >= 0 ? '#e11d48' : '#10b981'}
            strokeWidth="2"
          />
          {valores.map((v, i) => {
            const x = (i / (valores.length - 1)) * 280;
            const y = 55 - ((v - min) / range) * 50;
            return <circle key={i} cx={x} cy={y} r="2.5" fill={deltaPct >= 0 ? '#e11d48' : '#10b981'} />;
          })}
        </svg>
        <div className="flex items-center justify-between mt-1 text-[9px] text-slate-500">
          <span>{fmtFechaCorta(fechas[0] ?? null)}</span>
          <span>{fmtFechaCorta(fechas[fechas.length - 1] ?? null)}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-50 border border-slate-200 rounded p-2">
          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Mín</div>
          <div className="text-sm font-bold text-slate-900 tabular-nums">S/ {fmtPEN(min)}</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded p-2">
          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Máx</div>
          <div className="text-sm font-bold text-slate-900 tabular-nums">S/ {fmtPEN(max)}</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded p-2">
          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Stability</div>
          <div className="text-sm font-bold text-slate-900 tabular-nums">{sku.stabilityScore}/100</div>
        </div>
      </div>
    </div>
  );
};

// ─── TAB 3 · Lotes ───────────────────────────────────────────────────────────
const LotesTab: React.FC<{ sku: SkuConCostos }> = ({ sku }) => {
  if (sku.lotes.length === 0) {
    return (
      <div className="text-center text-xs text-slate-500 py-6">
        <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        Sin lotes registrados
      </div>
    );
  }

  // Render en orden descendente (más reciente arriba)
  const lotesDesc = [...sku.lotes].reverse();

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Lotes registrados
        </div>
        <span className="text-[9px] text-slate-400 tabular-nums">
          {sku.lotes.length} {sku.lotes.length === 1 ? 'lote' : 'lotes'}
        </span>
      </div>
      <div className="space-y-1.5">
        {lotesDesc.map((lote, idx) => {
          const esElUltimo = idx === 0;
          // Variance vs siguiente (anterior cronológicamente)
          const next = lotesDesc[idx + 1];
          const variancePct = next && next.costoUnitarioPEN > 0
            ? ((lote.costoUnitarioPEN - next.costoUnitarioPEN) / next.costoUnitarioPEN) * 100
            : null;
          const varianceClass = variancePct === null
            ? 'text-slate-400'
            : Math.abs(variancePct) <= 2
            ? 'text-emerald-600'
            : Math.abs(variancePct) <= 5
            ? 'text-amber-600'
            : 'text-rose-600';

          return (
            <div
              key={`${lote.ordenCompraId}-${lote.loteId}`}
              className={`border rounded-lg p-2.5 ${
                esElUltimo ? 'bg-teal-50/40 border-teal-200' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-bold text-slate-900 font-mono">
                    {lote.loteId}
                  </span>
                  {esElUltimo && (
                    <span className="px-1 py-0.5 text-[8px] rounded bg-teal-100 text-teal-700 font-bold">
                      ACTUAL
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 tabular-nums">
                  {fmtFechaCorta(lote.fechaRecepcion)}
                </span>
              </div>
              <div className="flex items-end justify-between">
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-500 truncate">
                    {lote.ordenCompraNumero || '—'} · {lote.cantidad} uds
                  </div>
                  {lote.proveedorNombre && (
                    <div className="text-[10px] text-slate-500 truncate">
                      {lote.proveedorNombre}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900 tabular-nums">
                    S/ {fmtPEN(lote.costoUnitarioPEN)}
                  </div>
                  <div className="text-[10px] text-slate-500 tabular-nums">
                    $ {fmtUSD(lote.costoUnitarioUSD)} · TC {lote.tc.toFixed(2)}
                  </div>
                  {variancePct !== null && (
                    <div className={`text-[10px] font-bold tabular-nums ${varianceClass}`}>
                      {fmtPct(variancePct)} vs anterior
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── TAB 4 · Proveedores REALES (de OCs · NO investigación) ──────────────────
const ProveedoresTab: React.FC<{ sku: SkuConCostos }> = ({ sku }) => {
  if (sku.proveedores.length === 0) {
    return (
      <div className="text-center text-xs text-slate-500 py-6">
        <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        Sin proveedores registrados en OCs
      </div>
    );
  }

  // Ordenar por costo promedio ascendente (mejor primero)
  const provs = [...sku.proveedores].sort((a, b) => a.costoPromedioUSD - b.costoPromedioUSD);
  const mejorId = provs[0]?.proveedorId;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Proveedores reales · de OCs
        </div>
        <span className="text-[9px] text-slate-400 tabular-nums">
          {sku.proveedores.length}
        </span>
      </div>
      <ul className="space-y-1">
        {provs.map((prov) => {
          const esMejor = prov.proveedorId === mejorId;
          return (
            <li
              key={prov.proveedorId}
              className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded border ${
                esMejor ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {esMejor && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-900 truncate">
                    {prov.proveedorNombre}
                  </div>
                  <div className="text-[9px] text-slate-500 tabular-nums">
                    {prov.ocs} {prov.ocs === 1 ? 'OC' : 'OCs'} · última {fmtFechaCorta(prov.ultimaOC)}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                {esMejor && (
                  <span className="px-1 py-0.5 text-[8px] rounded bg-emerald-50 text-emerald-700 font-bold">
                    MEJOR
                  </span>
                )}
                <div className="text-sm font-bold text-slate-900 tabular-nums">
                  $ {fmtUSD(prov.costoPromedioUSD)}
                </div>
                <div className="text-[9px] text-slate-500 tabular-nums">
                  últ. $ {fmtUSD(prov.ultimoCostoUSD)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-500">
        <span className="font-bold">Nota:</span> esta lista proviene de OCs reales · NO de
        investigación de mercado. Para precios sugeridos pre-compra ver módulo Productos.
      </div>
    </div>
  );
};

// ─── Helpers UI ──────────────────────────────────────────────────────────────
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}
const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon: Icon, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 py-2 text-[11px] font-medium border-b-2 transition-colors flex items-center justify-center gap-1 ${
      active
        ? 'text-teal-700 border-teal-600 font-bold'
        : 'text-slate-500 border-transparent hover:text-slate-700'
    }`}
  >
    <Icon className="w-3 h-3" />
    {children}
  </button>
);
