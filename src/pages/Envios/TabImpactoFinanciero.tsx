/**
 * TabImpactoFinanciero — 7ª tab del hub de Envíos · lente de dinero de logística
 * (SOLO LECTURA · Acto 16 del mockup master).
 *
 * Responde "¿cómo golpea Envíos a la caja?": agrega dinero que ya vive en otros
 * módulos (flete por pagar en la CC del colaborador · COD por cobrar · pérdidas ·
 * reclamos por recuperar). NO paga ni cobra: cada bloque cross-linkea a su dueño.
 *
 * FIRST-PASS (2026-07-04): §A KPIs con lo real (COD por cobrar computado de los
 * envíos F · por recuperar de `reclamo.getResumen`); flete/pérdidas quedan como
 * "en construcción" (requieren agregaciones por courier/período). §B-§E (aging de
 * flete · conciliación COD · perdido-vs-recuperado · FX) = pasada dedicada.
 *
 * Chrome del tab = orange (grupo Inventario · lo pone HubTabs). Los KPIs usan
 * color SEMÁNTICO fijo (amber=dinero · indigo=cobro · rose=pérdida · emerald=
 * recuperación) — no es chrome.
 */
import React from 'react';
import {
  Coins, Wallet, HandCoins, PackageX, Gavel, Truck, PackageCheck,
  TrendingDown, Receipt, Eye, AlertTriangle, ShieldCheck, Construction,
} from 'lucide-react';

export interface ImpactoFinancieroData {
  /** Flete por pagar (CxP en la CC del colaborador). `null` = agregación pendiente. */
  fletePorPagar: number | null;
  /** COD por cobrar contra-entrega (clientes por pagar en despachos F activos). */
  codPorCobrar: number;
  /** N.º de despachos F con COD pendiente. */
  codDespachos: number;
  /** Pérdidas del período (mermas / incidencias). `null` = agregación pendiente. */
  perdidas: number | null;
  /** Por recuperar (monto de reclamos en disputa). */
  porRecuperar: number;
  /** N.º de reclamos pendientes. */
  reclamosDisputa: number;
}

// ── Helper: monto con decimales atenuados (canon F7) ──
const money = (n: number) => {
  const [int, dec] = n.toFixed(2).split('.');
  const intFmt = Number(int).toLocaleString('es-PE');
  return { intFmt, dec };
};

interface KpiCardProps {
  label: string;
  icon: React.ReactNode;
  monto: number | null;
  sub: React.ReactNode;
  tone: 'amber' | 'indigo' | 'rose' | 'emerald';
}

const TONE: Record<KpiCardProps['tone'], { grad: string; ring: string; label: string; value: string; dec: string; sub: string }> = {
  amber: { grad: 'from-amber-50 to-amber-100/40', ring: 'ring-amber-200/50', label: 'text-amber-700', value: 'text-amber-900', dec: 'text-amber-400', sub: 'text-amber-700' },
  indigo: { grad: 'from-indigo-50 to-indigo-100/40', ring: 'ring-indigo-200/50', label: 'text-indigo-700', value: 'text-indigo-900', dec: 'text-indigo-400', sub: 'text-indigo-700' },
  rose: { grad: 'from-rose-50 to-rose-100/40', ring: 'ring-rose-200/50', label: 'text-rose-700', value: 'text-rose-900', dec: 'text-rose-400', sub: 'text-rose-700' },
  emerald: { grad: 'from-emerald-50 to-emerald-100/40', ring: 'ring-emerald-200/50', label: 'text-emerald-700', value: 'text-emerald-900', dec: 'text-emerald-400', sub: 'text-emerald-700' },
};

const KpiCard: React.FC<KpiCardProps> = ({ label, icon, monto, sub, tone }) => {
  const t = TONE[tone];
  const enConstruccion = monto === null;
  const m = enConstruccion ? null : money(monto);
  return (
    <div className={`bg-gradient-to-br ${t.grad} ring-1 ${t.ring} rounded-2xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] uppercase tracking-wider ${t.label} font-bold`}>{label}</span>
        <span className={t.label}>{icon}</span>
      </div>
      {enConstruccion ? (
        <>
          <div className={`text-2xl font-bold tabular-nums ${t.value} opacity-40`}>S/ —</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
            <Construction className="w-3 h-3" /> En construcción
          </div>
        </>
      ) : (
        <>
          <div className={`text-2xl font-bold tabular-nums ${t.value}`}>
            S/ {m!.intFmt}<span className={t.dec}>.{m!.dec}</span>
          </div>
          <div className={`text-[11px] ${t.sub} flex items-center gap-1 mt-1`}>{sub}</div>
        </>
      )}
    </div>
  );
};

interface TabImpactoFinancieroProps {
  data: ImpactoFinancieroData;
}

export const TabImpactoFinanciero: React.FC<TabImpactoFinancieroProps> = ({ data }) => {
  return (
    <div className="space-y-5">

      {/* Aviso · lente de solo-lectura */}
      <div className="flex items-start gap-3 bg-gradient-to-r from-rose-50 to-rose-100/30 ring-1 ring-rose-200/60 rounded-2xl p-4">
        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
          <Coins className="w-5 h-5 text-rose-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-rose-900">Lente de SOLO-LECTURA · no re-implementa módulos</div>
          <div className="text-[12px] text-rose-700 mt-0.5 leading-snug">
            Agrega el dinero que ya vive en otros módulos: <b>flete por pagar</b> (Cuenta Corriente del
            courier/viajero) · <b>COD por cobrar</b> (contra-entrega de los despachos) · <b>pérdidas</b>
            (mermas / incidencias) · <b>reclamos por recuperar</b>. Aquí NO se paga ni se cobra: cada bloque
            cross-linkea a su dueño. <span className="font-semibold">Pagar el flete vive en Finanzas · el COD se concilia con el courier.</span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 flex-shrink-0 text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-600 border border-slate-200 rounded-full px-2 py-0.5">
          <Eye className="w-2.5 h-2.5" /> Read-only
        </span>
      </div>

      {/* §A · KPIs de dinero de logística */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">§A · El dinero de Envíos hoy</span>
          <span className="text-[11px] text-slate-400">fuentes: CC del colaborador · incidencias · reclamos · despachos F</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Flete por pagar"
            icon={<Wallet className="w-3.5 h-3.5" />}
            monto={data.fletePorPagar}
            tone="amber"
            sub={<><Truck className="w-3 h-3" /> CxP en la CC del courier · aging §B</>}
          />
          <KpiCard
            label="COD por cobrar"
            icon={<HandCoins className="w-3.5 h-3.5" />}
            monto={data.codPorCobrar}
            tone="indigo"
            sub={<><PackageCheck className="w-3 h-3" /> {data.codDespachos} despacho{data.codDespachos !== 1 ? 's' : ''} F con cobro</>}
          />
          <KpiCard
            label="Pérdidas del período"
            icon={<PackageX className="w-3.5 h-3.5" />}
            monto={data.perdidas}
            tone="rose"
            sub={<><TrendingDown className="w-3 h-3" /> dañado + perdido + merma</>}
          />
          <KpiCard
            label="Por recuperar"
            icon={<Gavel className="w-3.5 h-3.5" />}
            monto={data.porRecuperar}
            tone="emerald"
            sub={<><Receipt className="w-3 h-3" /> {data.reclamosDisputa} reclamo{data.reclamosDisputa !== 1 ? 's' : ''} en disputa</>}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Canon no-redundancia: la tab NO clona el strip del hub — el strip da los conteos · aquí se abre el DINERO.
        </p>
      </div>

      {/* §B-§E · próxima pasada dedicada */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Construction className="w-5 h-5 text-orange-600" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-slate-900">Análisis detallado · en construcción</div>
            <div className="text-[12px] text-slate-500 mt-0.5 leading-snug">
              El desglose profundo llega en la pasada dedicada (requiere agregaciones por courier/período):
            </div>
            <ul className="mt-2 space-y-1 text-[12px] text-slate-600">
              <li className="flex items-center gap-2"><span className="text-slate-400 font-bold">§B</span> Aging de flete por pagar · por courier / viajero (CC del colaborador)</li>
              <li className="flex items-center gap-2"><span className="text-slate-400 font-bold">§C</span> Conciliación COD por courier (recaudado − flete = neto a liquidar)</li>
              <li className="flex items-center gap-2"><span className="text-slate-400 font-bold">§D</span> Perdido vs. recuperado · tasa de recovery</li>
              <li className="flex items-center gap-2"><span className="text-slate-400 font-bold">§E</span> FX del landed en USD</li>
            </ul>
            <div className="mt-3 flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Flete por pagar y Pérdidas también quedan pendientes de su agregación (por eso figuran "en construcción" arriba).</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
