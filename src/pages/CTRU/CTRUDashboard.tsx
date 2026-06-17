/**
 * CTRU — Hub Kit (indigo · grupo Análisis) · organizado POR DECISIÓN.
 *
 * Mockup: docs/mockups/ctru-recuperacion-hub-v2.html.
 * 4 tabs por decisión: ¿Qué decido hoy? · ¿A cuánto vendo? · ¿Qué repongo/corto? · ¿Dónde se va la plata?
 *
 * F5 sub-fase 5A: shell Hub Kit + tab Resumen ("¿Qué decido hoy?") wireada a las
 * funciones puras del modelo (recuperación + utilidad real 3 cajas). Las otras 3 tabs
 * usan los componentes existentes de forma TRANSICIONAL · su rework + el mini-dossier
 * + la limpieza de labels muertos van en 5B-5E.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calculator, RefreshCw, Package, TrendingUp, Wallet, Hourglass, AlertTriangle,
  Compass, Tag, Repeat, TrendingDown, Inbox, ArrowRight, Construction,
} from 'lucide-react';
import { HubShell, HubTopBar, HubHeader, HubKpiStrip, HubTabs, HubBody, type HubKpi, type HubTab } from '../../design-system';
import { useAuthStore } from '../../store/authStore';
import { hasRole } from '../../types/auth.types';
import { LineaDropdown } from '../../components/common/LineaDropdown';
import {
  CostCompositionChart,
  CostEvolutionChart,
  ExpenseTrendChart,
  ProductoCTRUTable,
  ProductoCTRUDetail,
  LoteOCTable,
} from '../../components/modules/ctru';
import { useCTRUStore } from '../../store/ctruStore';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import { calcularCurvaRecuperacion } from '../../utils/recuperacion.utils';
import { calcularUtilidad3Cajas, type VentaCaja } from '../../utils/utilidadReal.utils';
import type { CTRUProductoDetalle } from '../../store/ctruStore';

type TabCTRU = 'resumen' | 'precio' | 'reponer' | 'fuga';

// Formato de dinero para el KPI strip (valor + sufijo atenuado · canon F7).
const fmtMoneyKpi = (n: number): { valor: string; sufijo?: string } =>
  Math.abs(n) >= 1000 ? { valor: `S/ ${(n / 1000).toFixed(1)}`, sufijo: 'k' } : { valor: `S/ ${Math.round(n)}` };
const fmtMoney = (n: number) => `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;

export const CTRUDashboard: React.FC = () => {
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);
  const esAdmin = hasRole(userProfile, 'admin');

  const {
    resumen, productosDetalle, historialMensual, historialGastos, lotesOC,
    loading, error, fetchAll,
  } = useCTRUStore();

  const [tab, setTab] = useState<TabCTRU>('resumen');
  const [productoSeleccionado, setProductoSeleccionado] = useState<CTRUProductoDetalle | null>(null);

  // Deep-link entrante (ej. desde detalle de OC) · mapeo viejo→nuevo (5E pulirá el ocId).
  const [searchParams] = useSearchParams();
  const tabURL = searchParams.get('tab');
  const ocIdDeURL = searchParams.get('ocId');
  useEffect(() => {
    const map: Record<string, TabCTRU> = { resumen: 'resumen', catalogo: 'reponer', lote: 'fuga', precio: 'precio', reponer: 'reponer', fuga: 'fuga' };
    if (tabURL && map[tabURL]) setTab(map[tabURL]);
  }, [tabURL]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const productos = useLineaFilter(productosDetalle, (p) => p.lineaNegocioId);

  // ── Wiring del MODELO (funciones puras testeadas) → agregados del Resumen ──
  const agg = useMemo(() => {
    const filas = productos.map((p) => {
      const base = (p.ctruContableProm || 0) * (p.totalUnidades || 0);
      const curva = calcularCurvaRecuperacion(
        p.ventasDetalle.map((v) => ({
          fecha: v.fecha, cantidad: v.cantidad,
          contribucionUnitaria: v.contribucionUnitaria, costoUnitario: v.costoUnitario, canal: v.canal,
        })),
        base,
      );
      // Mejor canal = el de mayor contribución acumulada (de la data real, no promedio plano).
      const porCanal = new Map<string, number>();
      p.ventasDetalle.forEach((v) => {
        const k = v.canalNombre || v.canal || '—';
        porCanal.set(k, (porCanal.get(k) || 0) + v.contribucionUnitaria * v.cantidad);
      });
      const mejorCanal = [...porCanal.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
      return { p, base, curva, utilidadPct: p.margenNetoProm, mejorCanal };
    });

    const invertido = filas.reduce((s, f) => s + f.base, 0);
    const totalRecuperado = filas.reduce((s, f) => s + f.curva.totalRecuperado, 0);
    const porRecuperar = filas.reduce((s, f) => s + f.curva.porRecuperar, 0);
    const recuperadoPct = invertido > 0 ? (totalRecuperado / invertido) * 100 : 0;

    // Utilidad real 3 cajas (channel-aware) sobre las ventas analizadas.
    const ventasCaja: VentaCaja[] = productos.flatMap((p) =>
      p.ventasDetalle.map((v) => ({
        canal: v.canal, canalNombre: v.canalNombre,
        ingreso: v.precioUnitario * v.cantidad,
        costoProducto: v.costoUnitario * v.cantidad,
        gastoVenta: v.gvgdUnitario * v.cantidad,
      })),
    );
    const ultimoMes = historialGastos[historialGastos.length - 1];
    const gastoFijoMes = ultimoMes ? ultimoMes.GA + ultimoMes.GO : 0;
    const utilidad = calcularUtilidad3Cajas(ventasCaja, gastoFijoMes);

    const esRezagado = (f: typeof filas[number]) => f.base > 0 && f.curva.pctRecuperado < 50;
    const requierenAccion = filas.filter((f) => f.utilidadPct < 0 || esRezagado(f)).length;

    const cola = filas
      .map((f) => {
        if (f.utilidadPct < 0) return { p: f.p, tono: 'rose' as const, titulo: `${f.p.productoNombre} · pierde en utilidad real`, sub: `Utilidad real ${f.utilidadPct.toFixed(0)}% · revisar canal o precio`, urgencia: 0 };
        if (esRezagado(f)) return { p: f.p, tono: 'amber' as const, titulo: `${f.p.productoNombre} · recuperó solo ${f.curva.pctRecuperado.toFixed(0)}%`, sub: 'Rota lento · evaluar reponer o bajar precio', urgencia: 1 };
        return null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.urgencia - b.urgencia)
      .slice(0, 5);

    const comparativo = filas
      .map((f) => ({
        p: f.p, utilidadPct: f.utilidadPct, recuperadoPct: f.curva.pctRecuperado, mejorCanal: f.mejorCanal,
        estado: f.utilidadPct < 0 ? 'pierde' : f.curva.pctRecuperado >= 100 ? 'estrella' : esRezagado(f) ? 'lento' : 'sano',
      }))
      .sort((a, b) => b.utilidadPct - a.utilidadPct);

    return { invertido, recuperadoPct, porRecuperar, utilidad, cola, requierenAccion, comparativo };
  }, [productos, historialGastos]);

  const tabs: HubTab[] = [
    { id: 'resumen', label: '¿Qué decido hoy?', icon: Compass, badge: agg.requierenAccion > 0 ? agg.requierenAccion : undefined, badgeTono: 'rose' },
    { id: 'precio', label: '¿A cuánto vendo?', icon: Tag },
    { id: 'reponer', label: '¿Qué repongo / corto?', icon: Repeat },
    { id: 'fuga', label: '¿Dónde se va la plata?', icon: TrendingDown },
  ];

  const inv = fmtMoneyKpi(agg.invertido);
  const porRec = fmtMoneyKpi(agg.porRecuperar);
  const kpis: HubKpi[] = [
    { label: 'Invertido', valor: inv.valor, sufijo: inv.sufijo, tono: 'sky', icon: Package, tooltip: 'Σ CTRU de todas las unidades (capital en inventario).' },
    { label: 'Recuperado', valor: `${Math.round(agg.recuperadoPct)}`, sufijo: '%', tono: 'emerald', icon: TrendingUp, tooltip: 'Cuánto del capital invertido se recuperó vendiendo.' },
    { label: 'Utilidad real', valor: `${Math.round(agg.utilidad.total.margenOperativoPct)}`, sufijo: '%', tono: 'emerald', icon: Wallet, tooltip: 'Las 3 cajas: ingresos − CTRU − gastos de venta − gasto fijo.' },
    { label: 'Por recuperar', valor: porRec.valor, sufijo: porRec.sufijo, tono: 'amber', icon: Hourglass, tooltip: 'Capital aún por amortizar.' },
    { label: 'Requieren acción', valor: `${agg.requierenAccion}`, tono: 'rose', icon: AlertTriangle, tooltip: 'Productos que pierden o recuperan lento.' },
  ];

  // ── Loading ──
  if (loading && !resumen) {
    return (
      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-indigo-600 mx-auto" />
            <p className="mt-4 text-slate-500 text-sm">Cargando CTRU…</p>
          </div>
        </div>
      </div>
    );
  }

  const sinDatos = !!resumen && resumen.totalProductos === 0;

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
      <HubShell>
        <HubTopBar
          grupo="analisis"
          modulo="CTRU"
          leaf={tabs.find((t) => t.id === tab)?.label}
          esAdmin={esAdmin}
          onInicio={() => navigate('/')}
          onModulo={() => setTab('resumen')}
        />
        <HubHeader
          grupo="analisis"
          icon={Calculator}
          titulo="CTRU"
          subtitulo="Decidí precio, canal y reposición con la verdad de cada producto"
          extraActions={<LineaDropdown />}
          acciones={[{ label: 'Recalcular', icon: RefreshCw, onClick: () => fetchAll(), tier: 'neutral' }]}
        />
        <HubKpiStrip cols={5} kpis={kpis} />
        <HubTabs grupo="analisis" tabs={tabs} activa={tab} onChange={(id) => setTab(id as TabCTRU)} />

        <HubBody flush>
          {error && (
            <div className="p-4 sm:p-6">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                <div className="flex-1"><p className="text-sm text-rose-700">{error}</p></div>
                <button onClick={() => fetchAll()} className="text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Reintentar</button>
              </div>
            </div>
          )}

          {/* TAB · ¿Qué decido hoy? (Resumen) */}
          {tab === 'resumen' && (
            <div className="p-3 sm:p-4 md:p-6 space-y-4">
              {sinDatos ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-3"><Package className="w-6 h-6 text-indigo-400" /></div>
                  <h3 className="text-[15px] font-semibold text-slate-900">Sin productos todavía</h3>
                  <p className="text-[12px] text-slate-500 mt-1 max-w-md">Cuando recibas tu primera compra, acá vas a ver el costo real, el piso por canal y la recuperación de cada producto.</p>
                </div>
              ) : (
                <>
                  {/* Cola de atención */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[14px] font-semibold text-slate-900 flex items-center gap-2"><Inbox className="w-4 h-4 text-rose-500" /> Lo que necesita tu decisión</h3>
                      {agg.cola.length > 0 && <span className="text-[10px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{agg.cola.length} {agg.cola.length === 1 ? 'producto' : 'productos'} · por urgencia</span>}
                    </div>
                    {agg.cola.length === 0 ? (
                      <p className="text-[12px] text-slate-500 py-2">Nada urgente ahora mismo · todos tus productos rinden y recuperan bien. 🎉</p>
                    ) : (
                      <div className="space-y-2">
                        {agg.cola.map((c) => (
                          <button key={c.p.productoId} onClick={() => setProductoSeleccionado(c.p)} className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${c.tono === 'rose' ? 'bg-rose-50 border-rose-200 hover:bg-rose-100/50' : 'bg-amber-50 border-amber-200 hover:bg-amber-100/50'}`}>
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.tono === 'rose' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                            <div className="flex-1 min-w-0"><div className="text-[13px] font-medium text-slate-900 truncate">{c.titulo}</div><div className="text-[11px] text-slate-500 truncate">{c.sub}</div></div>
                            <span className={`text-[11px] font-semibold flex items-center gap-1 flex-shrink-0 ${c.tono === 'rose' ? 'text-rose-700' : 'text-amber-700'}`}>Decidir <ArrowRight className="w-3.5 h-3.5" /></span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Utilidad real del período (3 cajas) */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <h3 className="text-[14px] font-semibold text-slate-900 mb-3 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-600" /> Utilidad real del período (las 3 cajas)</h3>
                    <div className="space-y-1 text-[13px]">
                      <div className="flex justify-between py-1 font-semibold"><span>Ingresos</span><span className="tabular-nums">{fmtMoney(agg.utilidad.total.ingresos)}</span></div>
                      <div className="flex justify-between py-1"><span className="text-slate-500">(−) CTRU producto</span><span className="tabular-nums text-rose-500">{fmtMoney(agg.utilidad.total.ctru)}</span></div>
                      <div className="flex justify-between py-1"><span className="text-slate-500">(−) Gastos de venta</span><span className="tabular-nums text-rose-500">{fmtMoney(agg.utilidad.total.gastosVenta)}</span></div>
                      <div className="flex justify-between py-1"><span className="text-slate-500">(−) Gasto fijo del mes</span><span className="tabular-nums text-rose-500">{fmtMoney(agg.utilidad.total.overhead)}</span></div>
                      <div className="flex justify-between py-1.5 font-bold border-t-2 border-slate-300 mt-1"><span>= Utilidad operativa real</span><span className="flex items-center gap-2"><span className={`tabular-nums ${agg.utilidad.total.utilidadOperativa >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtMoney(agg.utilidad.total.utilidadOperativa)}</span><span className={`text-[11px] font-bold ${agg.utilidad.total.utilidadOperativa >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{Math.round(agg.utilidad.total.margenOperativoPct)}%</span></span></div>
                    </div>
                  </div>

                  {/* Comparativo por producto */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <h3 className="text-[14px] font-semibold text-slate-900 mb-3">Comparativo por producto</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12px]">
                        <thead><tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                          <th className="text-left font-bold py-2">Producto</th><th className="text-right font-bold py-2">Utilidad real</th><th className="text-left font-bold py-2 pl-3">Mejor canal</th><th className="text-right font-bold py-2">Recuperado</th><th className="text-center font-bold py-2">Estado</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {agg.comparativo.map((r) => (
                            <tr key={r.p.productoId} onClick={() => setProductoSeleccionado(r.p)} className={`cursor-pointer ${r.estado === 'pierde' ? 'bg-rose-50/40 hover:bg-rose-50' : 'hover:bg-slate-50'}`}>
                              <td className={`py-2 font-medium ${r.estado === 'pierde' ? 'text-rose-800' : ''}`}>{r.p.productoNombre}</td>
                              <td className={`text-right tabular-nums font-bold ${r.utilidadPct < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{Math.round(r.utilidadPct)}%</td>
                              <td className="pl-3 text-slate-600">{r.mejorCanal}</td>
                              <td className={`text-right tabular-nums ${r.recuperadoPct < 50 ? 'text-amber-600' : ''}`}>{Math.round(r.recuperadoPct)}%</td>
                              <td className="text-center"><EstadoBadge estado={r.estado} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB · ¿A cuánto vendo? (precio por canal · 5B) */}
          {tab === 'precio' && (
            <div className="p-3 sm:p-4 md:p-6">
              <EnConstruccion sub="El piso de precio por canal (Mercado Libre, directo, tienda) se está conectando · sub-fase 5B." />
            </div>
          )}

          {/* TAB · ¿Qué repongo / corto? (catálogo · transicional) */}
          {tab === 'reponer' && (
            <div className="p-3 sm:p-4 md:p-6">
              <ProductoCTRUTable productos={productos} onSelectProducto={setProductoSeleccionado} vistaCosto="contable" />
            </div>
          )}

          {/* TAB · ¿Dónde se va la plata? (composición de costo · transicional) */}
          {tab === 'fuga' && (
            <div className="p-3 sm:p-4 md:p-6 space-y-4">
              <CostCompositionChart productos={productos} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <CostEvolutionChart historialMensual={historialMensual} />
                <ExpenseTrendChart historialGastos={historialGastos} />
              </div>
              <LoteOCTable lotes={lotesOC} autoExpandId={ocIdDeURL} />
            </div>
          )}
        </HubBody>
      </HubShell>

      {productoSeleccionado && (
        <ProductoCTRUDetail producto={productoSeleccionado} onClose={() => setProductoSeleccionado(null)} />
      )}
    </div>
  );
};

const EstadoBadge: React.FC<{ estado: string }> = ({ estado }) => {
  const cfg: Record<string, { cls: string; label: string }> = {
    estrella: { cls: 'bg-emerald-100 text-emerald-700', label: '★ estrella' },
    sano: { cls: 'bg-emerald-100 text-emerald-700', label: 'sano' },
    lento: { cls: 'bg-amber-100 text-amber-700', label: 'lento' },
    pierde: { cls: 'bg-rose-100 text-rose-700', label: '⚠ pierde' },
  };
  const c = cfg[estado] ?? cfg.sano;
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.cls}`}>{c.label}</span>;
};

const EnConstruccion: React.FC<{ sub: string }> = ({ sub }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center text-center">
    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-3"><Construction className="w-6 h-6 text-indigo-400" /></div>
    <h3 className="text-[15px] font-semibold text-slate-900">En construcción</h3>
    <p className="text-[12px] text-slate-500 mt-1 max-w-md">{sub}</p>
  </div>
);
