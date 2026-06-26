/**
 * PanelDecisionRequerimiento · F4 · capa de medición #4.
 *
 * Panel Recomendador del modal de aprobación: 2 ejes (DEMANDA por lente × CAJA universal) → veredicto
 * NO-binding ("el sistema recomienda, vos decidís"). 4 lentes: Restock · Apuesta · Manual · Demanda
 * comprometida. Captura inline: precio de venta (apuesta) + driver (manual), con persistencia.
 *
 * Pixel-perfect del mockup docs/mockups/requerimientos-medicion-panel-v1.html (canon M1).
 * Chrome blue (módulo Requerimientos) · color semántico en el dato (emerald/amber/rose/indigo/sky).
 */
import React, { useState } from 'react';
import {
  BarChart2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Zap,
  Info,
  TrendingUp,
  Clock,
  Shield,
  Calendar,
  Sparkles,
  MessageSquare,
  Percent,
  Target,
  Package,
  Tag,
  Plus,
  Settings2,
  Video,
  Facebook,
  ShoppingBag,
  MoreHorizontal,
  Users,
  User,
  FileText,
  ExternalLink,
  CreditCard,
} from 'lucide-react';
import { usePanelDecision } from './usePanelDecision';
import { requerimientoService } from '../../services/requerimiento.service';
import { LABEL_DRIVER_DEMANDA } from '../../types/requerimiento.types';
import type { Requerimiento, DriverDemanda } from '../../types/requerimiento.types';
import type {
  NivelVeredicto,
  RestockLensInput,
  RotacionContexto,
  MargenEstimado,
  DemandaComprometidaInput,
  CajaContexto,
} from './panelDecision.helper';

const fmtPEN = (n: number) =>
  `S/ ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n))}`;
const fmtPEN2 = (n: number) =>
  `S/ ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
const fmtNum = (n: number, d = 0) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);

const URGENCIA_LABEL: Record<RestockLensInput['urgencia'], string> = {
  critica: 'Urgencia Crítica',
  alta: 'Urgencia Alta',
  media: 'Urgencia Media',
  baja: 'Urgencia Baja',
};

const ROTACION_LABEL: Record<RotacionContexto['clasificacionRotacion'], string> = {
  muy_alta: 'Muy alta',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
  muy_baja: 'Muy baja',
  sin_movimiento: 'Sin mov.',
};

const DRIVER_ICON: Record<DriverDemanda, React.ComponentType<{ style?: React.CSSProperties }>> = {
  tiktok: Video,
  facebook: Facebook,
  marketplace: ShoppingBag,
  promocion: Tag,
  otro: MoreHorizontal,
};

// ── Veredicto chip ───────────────────────────────────────────────────────────
const VEREDICTO_CFG: Record<
  NivelVeredicto,
  { label: string; cls: string; Icon: React.ComponentType<{ style?: React.CSSProperties }> }
> = {
  recomendado: {
    label: 'Recomendado',
    cls: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
    Icon: CheckCircle2,
  },
  revisar: {
    label: 'Revisar',
    cls: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
    Icon: AlertCircle,
  },
  precaucion: {
    label: 'Precaución',
    cls: 'bg-rose-100 text-rose-800 ring-1 ring-rose-200',
    Icon: AlertTriangle,
  },
};

const VeredictoChip: React.FC<{ nivel: NivelVeredicto }> = ({ nivel }) => {
  const { label, cls, Icon } = VEREDICTO_CFG[nivel];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${cls}`}>
      <Icon style={{ width: 10, height: 10 }} />
      {label}
    </span>
  );
};

// ── Franja de caja ───────────────────────────────────────────────────────────
const FranjaCaja: React.FC<{ caja: CajaContexto }> = ({ caja }) => {
  if (caja.estado === 'desconocido') {
    return (
      <div className="bg-white rounded-xl ring-1 ring-slate-200 px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap opacity-70">
        <div className="flex items-center gap-3 text-[12px]">
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Este req.</div>
            <div className="text-base font-bold tabular-nums text-slate-900">{fmtPEN(caja.esteReqPEN)}</div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500">
          <Info style={{ width: 11, height: 11 }} />
          Caja no disponible
        </span>
      </div>
    );
  }

  if (caja.estado === 'precaucion') {
    const exceso = Math.max(0, caja.esteReqPEN - (caja.disponiblePEN ?? 0));
    return (
      <div className="bg-rose-50 rounded-xl ring-1 ring-rose-200 px-3 py-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-2">Eje caja · precaución</div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[11px]">
            <div className="text-rose-500 text-[10px]">Disponible</div>
            <div className="text-base font-bold tabular-nums text-rose-900">{fmtPEN(caja.disponiblePEN ?? 0)}</div>
          </div>
          <div className="text-rose-300 font-light text-lg">vs</div>
          <div className="text-[11px] text-right">
            <div className="text-rose-500 text-[10px]">Este req.</div>
            <div className="text-base font-bold tabular-nums text-rose-900">{fmtPEN(caja.esteReqPEN)}</div>
          </div>
        </div>
        <div className="bg-rose-100 rounded-lg px-2.5 py-2 flex items-start gap-1.5 text-[10px] text-rose-800">
          <AlertTriangle style={{ width: 11, height: 11, flexShrink: 0, marginTop: 1 }} />
          <span>
            <strong>Excede la caja disponible</strong> en {fmtPEN(exceso)}. Considerá diferir, reducir cantidad o
            gestionar ingreso de caja primero.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 text-[12px]">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Disponible</div>
          <div className="text-base font-bold tabular-nums text-slate-900">{fmtPEN(caja.disponiblePEN ?? 0)}</div>
        </div>
        <div className="w-px h-8 bg-slate-200" />
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Este req.</div>
          <div className="text-base font-bold tabular-nums text-slate-900">{fmtPEN(caja.esteReqPEN)}</div>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
        <CheckCircle2 style={{ width: 11, height: 11 }} />
        Dentro de caja
      </span>
    </div>
  );
};

// ── Lente RESTOCK ────────────────────────────────────────────────────────────
const LenteRestock: React.FC<{ req: Requerimiento; restock: RestockLensInput }> = ({ req, restock }) => {
  const solicitado = req.productos.reduce((s, p) => s + (p.cantidadSolicitada || 0), 0);
  const sugerido = restock.cantidadSugerida;
  const delta = solicitado - sugerido;

  return (
    <div className="px-4 py-3 space-y-3">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Eje demanda · Restock (ROP)</div>

        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 ring-1 ring-amber-200">
            <Zap style={{ width: 10, height: 10 }} />
            {URGENCIA_LABEL[restock.urgencia]}
          </span>
          <span className="text-[11px] text-slate-500">Stock neto bajo el punto de reorden</span>
        </div>

        <div className="bg-white rounded-lg px-3 py-2.5 ring-1 ring-slate-200 text-[12px] text-slate-700 leading-relaxed">
          <Info style={{ width: 11, height: 11, display: 'inline', marginRight: 4, color: '#64748b' }} />
          {restock.razon}.
        </div>

        <div className="grid grid-cols-3 gap-2 mt-2">
          <div className="bg-white rounded-xl ring-1 ring-slate-200 p-2.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Solicitado</div>
            <div className="text-xl font-bold tabular-nums text-slate-900">{solicitado}</div>
            <div className="text-[10px] text-slate-400">ud</div>
          </div>
          <div className="bg-emerald-50 rounded-xl ring-1 ring-emerald-200 p-2.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">ROP sugiere</div>
            <div className="text-xl font-bold tabular-nums text-emerald-900">{sugerido}</div>
            <div className="text-[10px] text-emerald-600">ud</div>
          </div>
          {delta !== 0 ? (
            <div
              className={`rounded-xl ring-1 p-2.5 text-center ${
                delta < 0 ? 'bg-rose-50 ring-rose-200' : 'bg-amber-50 ring-amber-200'
              }`}
            >
              <div
                className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                  delta < 0 ? 'text-rose-700' : 'text-amber-700'
                }`}
              >
                Delta
              </div>
              <div className={`text-xl font-bold tabular-nums ${delta < 0 ? 'text-rose-900' : 'text-amber-900'}`}>
                {delta > 0 ? `+${delta}` : delta}
              </div>
              <div className={`text-[10px] ${delta < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                {delta < 0 ? 'pide más' : 'pide menos'}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl ring-1 ring-slate-200 p-2.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Delta</div>
              <div className="text-xl font-bold tabular-nums text-slate-900">0</div>
              <div className="text-[10px] text-slate-400">alineado</div>
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-600">
          <span className="flex items-center gap-1">
            <TrendingUp style={{ width: 11, height: 11, color: '#64748b' }} />
            <span className="tabular-nums font-medium text-slate-900">{fmtNum(restock.velocidadDiaria, 1)}</span> ud/día
          </span>
          <span className="flex items-center gap-1">
            <Clock style={{ width: 11, height: 11, color: '#64748b' }} />
            Lead time <span className="tabular-nums font-medium text-slate-900 ml-1">{restock.leadTimeDias}</span> días
          </span>
          <span className="flex items-center gap-1">
            <Shield style={{ width: 11, height: 11, color: '#64748b' }} />
            Stock seg. <span className="tabular-nums font-medium text-slate-900 ml-1">{restock.stockSeguridad}</span> ud
          </span>
          <span className="flex items-center gap-1">
            <Calendar style={{ width: 11, height: 11, color: '#64748b' }} />
            Cobertura actual{' '}
            <span className="tabular-nums font-medium text-amber-700 ml-1">{restock.diasCobertura}</span> días
          </span>
        </div>
      </div>

      <div className="border-t border-slate-200/60" />

      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
          Eje caja · contexto de convergencia
        </div>
        <CajaSlot />
      </div>
    </div>
  );
};

// ── Lente APUESTA ────────────────────────────────────────────────────────────
const LenteApuesta: React.FC<{
  req: Requerimiento;
  margen?: MargenEstimado;
  onCapturarPrecio: (v: number) => void;
}> = ({ req, margen, onCapturarPrecio }) => {
  const tieneVenta = margen?.tieneVenta ?? false;
  const margenPct = margen?.margenPct ?? 0;
  const saludLabel =
    margen?.salud === 'sano' ? 'Saludable' : margen?.salud === 'negativo' ? 'Negativo' : 'Ajustado';
  // Clases LITERALES por salud (Tailwind JIT no compila clases interpoladas).
  const margenCard =
    margen?.salud === 'negativo'
      ? {
          box: 'bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50',
          label: 'text-rose-700',
          value: 'text-rose-900',
          unit: 'text-rose-400',
          sub: 'text-rose-700',
        }
      : margen?.salud === 'flaco'
        ? {
            box: 'bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50',
            label: 'text-amber-700',
            value: 'text-amber-900',
            unit: 'text-amber-400',
            sub: 'text-amber-700',
          }
        : {
            box: 'bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50',
            label: 'text-emerald-700',
            value: 'text-emerald-900',
            unit: 'text-emerald-400',
            sub: 'text-emerald-700',
          };

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200">
          <Sparkles style={{ width: 10, height: 10 }} />
          Producto nuevo · Apuesta
        </span>
        <span className="text-[11px] text-slate-500">Demanda incierta · tesis obligatoria</span>
      </div>

      {req.tesis && (
        <div className="bg-indigo-50 rounded-xl ring-1 ring-indigo-200 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-1 flex items-center gap-1">
            <MessageSquare style={{ width: 10, height: 10 }} />
            Tesis de inversión
          </div>
          <div className="text-[12px] text-indigo-900 leading-relaxed">{req.tesis}</div>
        </div>
      )}

      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
          Eje demanda · Análisis financiero estimado
        </div>

        {tieneVenta && margen ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className={`${margenCard.box} rounded-xl p-3 col-span-1`}>
                <div
                  className={`text-[10px] font-bold uppercase tracking-wider ${margenCard.label} mb-1 flex items-center gap-1`}
                >
                  <Percent style={{ width: 10, height: 10 }} />
                  Margen estimado
                </div>
                <div className={`text-2xl font-bold tabular-nums ${margenCard.value}`}>
                  {fmtNum(margenPct, 0)}
                  <span className={margenCard.unit}>%</span>
                </div>
                <div className={`text-[11px] ${margenCard.sub} mt-1`}>{saludLabel}</div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/40 ring-1 ring-blue-200/50 rounded-xl p-3 col-span-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1 flex items-center gap-1">
                  <Target style={{ width: 10, height: 10 }} />
                  Break-even
                </div>
                <div className="text-2xl font-bold tabular-nums text-blue-900">
                  {margen.breakEvenUds}
                  <span className="text-[14px] text-blue-400 font-semibold ml-0.5">ud</span>
                </div>
                <div className="text-[11px] text-blue-700 mt-1">vendidas para recuperar</div>
              </div>
            </div>

            <div className="mt-2 bg-white rounded-xl ring-1 ring-slate-200 divide-y divide-slate-100">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Package style={{ width: 11, height: 11 }} />
                  Costo landed (CTRU estimado)
                </span>
                <span className="text-[12px] font-semibold tabular-nums text-slate-900">{fmtPEN2(margen.landedUnitPEN)}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Tag style={{ width: 11, height: 11 }} />
                  Precio venta capturado
                </span>
                <span className="text-[12px] font-semibold tabular-nums text-slate-900">{fmtPEN2(margen.precioVentaPEN)}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 bg-emerald-50/50">
                <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                  <TrendingUp style={{ width: 11, height: 11 }} />
                  Utilidad por unidad
                </span>
                <span className="text-[12px] font-bold tabular-nums text-emerald-900">{fmtPEN2(margen.utilidadUnitPEN)}</span>
              </div>
            </div>
          </>
        ) : (
          <CapturaPrecioVenta onCapturar={onCapturarPrecio} />
        )}
      </div>

      <div className="border-t border-slate-200/60" />

      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Eje caja</div>
        <CajaSlot />
      </div>

      <div className="bg-amber-50 rounded-lg px-3 py-2 text-[11px] text-amber-800 flex items-start gap-1.5">
        <AlertTriangle style={{ width: 11, height: 11, flexShrink: 0, marginTop: 1 }} />
        <span>
          Es una <strong>apuesta</strong>: demanda sin historial en el sistema. El margen es estimado. La tesis define
          si el riesgo vale.
        </span>
      </div>
    </div>
  );
};

// ── Captura inline · precio de venta (estado 5A) ──────────────────────────────
const CapturaPrecioVenta: React.FC<{ onCapturar: (v: number) => void }> = ({ onCapturar }) => {
  const [valor, setValor] = useState('');

  const commit = () => {
    const n = parseFloat(valor);
    if (!isNaN(n) && n > 0) onCapturar(n);
  };

  return (
    <div className="bg-amber-50 rounded-xl ring-1 ring-amber-200 px-3 py-3 text-center">
      <Tag style={{ width: 16, height: 16, color: '#92400e', margin: '0 auto 6px', display: 'block' }} />
      <div className="text-[11px] text-amber-800 font-medium mb-2">Sin precio de venta capturado</div>
      <div className="text-[10px] text-amber-700 leading-relaxed mb-3">
        Capturá el precio de venta para calcular el margen, utilidad y break-even.
      </div>
      <div className="flex items-center gap-2 max-w-[220px] mx-auto">
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-amber-700 font-medium">S/</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
            }}
            placeholder="0.00"
            className="w-full h-8 pl-8 pr-2 rounded-lg text-[12px] font-medium tabular-nums text-amber-900 bg-white ring-1 ring-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>
        <button
          type="button"
          onClick={commit}
          className="h-8 px-3 rounded-lg text-[10px] font-bold text-white bg-amber-600 hover:bg-amber-700 flex items-center gap-1 flex-shrink-0"
        >
          <Plus style={{ width: 10, height: 10 }} />
          Calcular
        </button>
      </div>
    </div>
  );
};

// ── Lente MANUAL ─────────────────────────────────────────────────────────────
const LenteManual: React.FC<{
  req: Requerimiento;
  rotacion?: RotacionContexto;
  margen?: MargenEstimado;
  driver?: DriverDemanda;
  onSeleccionarDriver: (d: DriverDemanda) => void;
}> = ({ req, rotacion, margen, driver, onSeleccionarDriver }) => {
  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700 ring-1 ring-slate-300">
          <Settings2 style={{ width: 10, height: 10 }} />
          Manual · Producto probado
        </span>
        <span className="text-[11px] text-slate-500">Decisión deliberada · el vendedor intuye demanda fuera del forecast</span>
      </div>

      {(req.tesis || req.justificacion) && (
        <div className="bg-slate-100 rounded-xl ring-1 ring-slate-200 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
            <MessageSquare style={{ width: 10, height: 10 }} />
            Motivo del pedido
          </div>
          <div className="text-[12px] text-slate-800 leading-relaxed">{req.tesis || req.justificacion}</div>
        </div>
      )}

      {/* DRIVER selector */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
          <Zap style={{ width: 10, height: 10 }} />
          Driver de demanda
          <span className="ml-1 text-[9px] text-slate-400">(¿qué lo generó?)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(LABEL_DRIVER_DEMANDA) as DriverDemanda[]).map((d) => {
            const Icon = DRIVER_ICON[d];
            const activo = driver === d;
            const activoCls =
              d === 'tiktok'
                ? 'bg-pink-600 text-white ring-1 ring-pink-700'
                : 'bg-blue-600 text-white ring-1 ring-blue-700';
            return (
              <button
                key={d}
                type="button"
                onClick={() => onSeleccionarDriver(d)}
                className={`h-8 px-3 rounded-lg text-[11px] flex items-center gap-1.5 ${
                  activo
                    ? `font-bold ${activoCls}`
                    : 'font-medium text-slate-600 bg-white ring-1 ring-slate-300 hover:bg-slate-50'
                }`}
              >
                <Icon style={{ width: 11, height: 11 }} />
                {LABEL_DRIVER_DEMANDA[d]}
              </button>
            );
          })}
        </div>
        {driver && (
          <div className="mt-1 text-[10px] text-slate-400">
            Seleccionado: {LABEL_DRIVER_DEMANDA[driver]} · se registra en el scorecard de acierto
          </div>
        )}
      </div>

      <div className="border-t border-slate-200/60" />

      {/* Contexto histórico de rotación */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
          Contexto · producto probado (historial)
        </div>
        {rotacion ? (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl ring-1 ring-slate-200 p-2.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Velocidad</div>
              <div className="text-lg font-bold tabular-nums text-slate-900">{fmtNum(rotacion.velocidadDiaria, 1)}</div>
              <div className="text-[10px] text-slate-400">ud/día</div>
            </div>
            <div className="bg-white rounded-xl ring-1 ring-slate-200 p-2.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Rotación</div>
              <div className="text-lg font-bold tabular-nums text-slate-900">
                {ROTACION_LABEL[rotacion.clasificacionRotacion]}
              </div>
              <div className="text-[10px] text-emerald-600">
                {rotacion.clasificacionRotacion === 'muy_alta' || rotacion.clasificacionRotacion === 'alta'
                  ? 'best-seller'
                  : ''}
              </div>
            </div>
            <div className="bg-white rounded-xl ring-1 ring-slate-200 p-2.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Cobertura</div>
              <div className="text-lg font-bold tabular-nums text-slate-900">{rotacion.diasCobertura}</div>
              <div className="text-[10px] text-amber-600">días</div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg ring-1 ring-slate-200 px-3 py-2.5 text-[11px] text-slate-500">
            Sin historial de rotación para este producto todavía.
          </div>
        )}

        {margen?.tieneVenta && (
          <div className="mt-2 bg-white rounded-xl ring-1 ring-slate-200 divide-y divide-slate-100">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[11px] text-slate-500">Costo landed (CTRU real)</span>
              <span className="text-[12px] font-semibold tabular-nums text-slate-900">{fmtPEN2(margen.landedUnitPEN)}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[11px] text-slate-500">Precio venta</span>
              <span className="text-[12px] font-semibold tabular-nums text-slate-900">{fmtPEN2(margen.precioVentaPEN)}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-emerald-50/50">
              <span className="text-[11px] text-emerald-700 font-medium">Margen actual</span>
              <span className="text-[12px] font-bold tabular-nums text-emerald-900">{fmtNum(margen.margenPct, 1)}%</span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200/60" />

      <CajaSlot />
    </div>
  );
};

// ── Lente DEMANDA COMPROMETIDA ────────────────────────────────────────────────
const LenteDemanda: React.FC<{ demanda?: DemandaComprometidaInput }> = ({ demanda }) => {
  const adelantoPagado = demanda?.adelantoPagado ?? false;

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="bg-emerald-50 rounded-xl ring-1 ring-emerald-200 px-3 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-700 text-white">
            <Users style={{ width: 10, height: 10 }} />
            Demanda real
          </span>
          <span className="text-[11px] text-emerald-700 font-medium">Sin riesgo de forecast</span>
        </div>
        <div className="text-[12px] text-emerald-900 leading-relaxed">
          Cliente comprometido vía cotización. La demanda ya existe — no es estimada.
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Origen del pedido</div>
        <div className="bg-white rounded-xl ring-1 ring-slate-200 divide-y divide-slate-100">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <User style={{ width: 14, height: 14, color: '#64748b', flexShrink: 0 }} />
            <div>
              <div className="text-[10px] text-slate-500">Cliente</div>
              <div className="text-[12px] font-semibold text-slate-900">{demanda?.clienteNombre || '—'}</div>
            </div>
          </div>
          {demanda?.cotizacionNumero && (
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-3">
                <FileText style={{ width: 14, height: 14, color: '#64748b', flexShrink: 0 }} />
                <div>
                  <div className="text-[10px] text-slate-500">Cotización</div>
                  <div className="text-[12px] font-semibold text-slate-900">{demanda.cotizacionNumero}</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                <ExternalLink style={{ width: 10, height: 10 }} />
              </span>
            </div>
          )}
          {demanda?.adelantoMontoPEN != null && demanda.adelantoMontoPEN > 0 && (
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-3">
                <CreditCard style={{ width: 14, height: 14, color: '#64748b', flexShrink: 0 }} />
                <div>
                  <div className="text-[10px] text-slate-500">Adelanto</div>
                  <div className="text-[12px] font-semibold tabular-nums text-slate-900">
                    {fmtPEN2(demanda.adelantoMontoPEN)}
                  </div>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  adelantoPagado ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                <CheckCircle2 style={{ width: 10, height: 10 }} />
                {adelantoPagado ? 'Pagado' : 'Comprometido'}
              </span>
            </div>
          )}
        </div>
      </div>

      {adelantoPagado && (
        <div className="bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-2 text-[11px] text-emerald-800">
          <Zap style={{ width: 12, height: 12, flexShrink: 0 }} />
          <span>
            Adelanto pagado · <strong>Auto-aprobable sugerido</strong>. El botón sigue siendo tuyo.
          </span>
        </div>
      )}

      <div className="border-t border-slate-200/60" />

      <CajaSlot />
    </div>
  );
};

// ── Skeleton (estado 5C) ─────────────────────────────────────────────────────
const PanelSkeleton: React.FC = () => (
  <div className="bg-gradient-to-br from-slate-50 to-slate-100/60 ring-1 ring-slate-200/80 rounded-xl overflow-hidden animate-pulse">
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200/70">
      <div className="h-3 w-28 rounded bg-slate-200" />
      <div className="h-5 w-20 rounded-full bg-slate-200" />
    </div>
    <div className="px-3 py-3 space-y-3">
      <div className="h-4 w-32 rounded bg-slate-200" />
      <div className="h-14 w-full rounded-xl bg-slate-200" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-16 rounded-xl bg-slate-200" />
        <div className="h-16 rounded-xl bg-slate-200" />
        <div className="h-16 rounded-xl bg-slate-200" />
      </div>
      <div className="h-3 w-full rounded bg-slate-200" />
      <div className="h-3 w-4/5 rounded bg-slate-200" />
      <div className="border-t border-slate-200/60" />
      <div className="h-12 w-full rounded-xl bg-slate-200" />
    </div>
  </div>
);

// ── Contexto interno para inyectar la franja de caja en cada lente ────────────
const CajaCtx = React.createContext<CajaContexto | null>(null);
const CajaSlot: React.FC = () => {
  const caja = React.useContext(CajaCtx);
  if (!caja) return null;
  return <FranjaCaja caja={caja} />;
};

// ── Componente principal ──────────────────────────────────────────────────────
interface Props {
  req: Requerimiento;
}

export const PanelDecisionRequerimiento: React.FC<Props> = ({ req }) => {
  const {
    decision,
    loading,
    restockSinDatos,
    setPrecioVentaOverride,
    driverOverride,
    setDriverOverride,
  } = usePanelDecision(req);

  if (loading) return <PanelSkeleton />;

  const { lente, veredicto, caja } = decision;
  const productoPrimarioId = req.productos[0]?.productoId;

  // Captura inline · precio de venta (apuesta/manual) → override local + persistencia.
  const handleCapturarPrecio = (v: number) => {
    setPrecioVentaOverride(v);
    if (productoPrimarioId) {
      requerimientoService
        .actualizarCamposDecision(req.id, { productos: [{ productoId: productoPrimarioId, precioVentaPEN: v }] })
        .catch(() => {});
    }
  };

  // Captura inline · driver (manual) → override local + persistencia.
  const handleSeleccionarDriver = (d: DriverDemanda) => {
    setDriverOverride(d);
    requerimientoService.actualizarCamposDecision(req.id, { driverDemanda: d }).catch(() => {});
  };

  const esDemanda = lente === 'demanda_comprometida';
  const shellCls = esDemanda
    ? 'bg-gradient-to-br from-emerald-50/40 to-slate-50 ring-1 ring-emerald-200/60'
    : 'bg-gradient-to-br from-slate-50 to-slate-100/60 ring-1 ring-slate-200/80';
  const headerBorder = esDemanda ? 'border-emerald-100/70' : 'border-slate-200/70';

  return (
    <CajaCtx.Provider value={caja}>
      <div className={`${shellCls} rounded-xl overflow-hidden`}>
        {/* Panel header: título + veredicto chip */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${headerBorder}`}>
          <div className="flex items-center gap-2">
            <BarChart2 style={{ width: 14, height: 14, color: '#475569' }} />
            <span className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">Análisis de decisión</span>
          </div>
          <div className="flex items-center gap-2">
            <VeredictoChip nivel={veredicto.nivel} />
            <span className="text-[10px] text-slate-400 hidden sm:block">el sistema recomienda · vos decidís</span>
          </div>
        </div>

        {/* Cuerpo · lente correspondiente */}
        {lente === 'restock' &&
          (restockSinDatos || !decision.restock ? (
            <div className="px-4 py-3 space-y-3">
              <div className="bg-white rounded-lg ring-1 ring-slate-200 px-3 py-2.5 text-[12px] text-slate-600 flex items-start gap-2">
                <Info style={{ width: 13, height: 13, color: '#64748b', flexShrink: 0, marginTop: 1 }} />
                <span>
                  Sin datos de inteligencia para este producto todavía (no figura en el motor de reorden). El veredicto
                  se basa solo en la caja.
                </span>
              </div>
              <div className="border-t border-slate-200/60" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Eje caja</div>
                <FranjaCaja caja={caja} />
              </div>
            </div>
          ) : (
            <LenteRestock req={req} restock={decision.restock} />
          ))}

        {lente === 'apuesta' && (
          <LenteApuesta req={req} margen={decision.margen} onCapturarPrecio={handleCapturarPrecio} />
        )}

        {lente === 'manual' && (
          <LenteManual
            req={req}
            rotacion={decision.rotacion}
            margen={decision.margen}
            driver={driverOverride ?? decision.driver}
            onSeleccionarDriver={handleSeleccionarDriver}
          />
        )}

        {lente === 'demanda_comprometida' && <LenteDemanda demanda={decision.demanda} />}
      </div>
    </CajaCtx.Provider>
  );
};

export default PanelDecisionRequerimiento;
