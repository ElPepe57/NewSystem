/**
 * DrawerCCEntidadCanonico — chk5.D-S3.bis · SF5
 *
 * Drawer lateral con detalle completo de una CC entidad · 4 sub-tabs canon
 * MOCK 8 §2 (Resumen · Movimientos · Documentos · Análisis 12m).
 *
 * Reemplaza al legacy `EntidadCCDetailModal.tsx` (que sigue activo en el
 * Overview · SF6 marca deprecation cuando se migre el Overview).
 *
 * Estructura:
 *   1. Header drawer · avatar + nombre + RUC + cliente desde + cross-links
 *      + grid 4 métricas (Por cobrar · Vencido +60d · DSO · Ventas 12m)
 *   2. Sub-tabs: Resumen / Movimientos / Documentos / Análisis 12m
 *   3. Contenido sub-tab activo (scroll independiente)
 *   4. Footer acciones canon N10 · Generar estado cuenta · Recordatorio · Registrar cobro
 *
 * NOTAS de wiring:
 *   - Las sub-tabs Movimientos / Documentos / Análisis 12m hacen fetch lazy
 *     (sólo al activar la pestaña · evita carga innecesaria).
 *   - Para esta versión SF5: Movimientos lista movs de la CC desde
 *     `cuentaCorrienteService.getMovimientos`. Documentos y Análisis 12m
 *     quedan como sub-tabs placeholder (datos reales requieren queries
 *     adicionales · chk5.D-S4 cierra wiring real).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  BarChart2,
  Phone,
  ExternalLink,
  Mail,
  Plus,
  FileText,
  Activity,
  LineChart,
  AlertCircle,
} from 'lucide-react';
import type { CuentaCorriente, MovimientoCC } from '../../../../types/cuentaCorriente.types';
import { cuentaCorrienteService } from '../../../../services/cuentaCorriente.service';
import {
  obtenerIniciales,
  TIPO_ENTIDAD_COLOR,
  diasDesde,
  calcularAgingHeuristico,
  type AgingBuckets,
} from './ccHelpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export type SubTabCC = 'resumen' | 'movimientos' | 'documentos' | 'analisis';

export interface DrawerCCEntidadCanonicoProps {
  cc: CuentaCorriente;
  onClose: () => void;
  /** Click "Registrar cobro/pago" · padre dispara wizard */
  onRegistrarCobro: () => void;
  /** Click "Enviar recordatorio" · padre dispara modal recordatorio */
  onEnviarRecordatorio?: () => void;
  /** Click "Generar estado de cuenta" · padre dispara export PDF/XLSX */
  onGenerarEstadoCuenta?: () => void;
  /** Click cross-link "Ficha entidad" · padre navega a /maestros */
  onIrAFichaEntidad?: () => void;
  /** Click cross-link "Histórico ventas/compras" · padre navega */
  onVerHistorico?: () => void;
}

// ═════════════════════════════════════════════════════════════════════════
// MAPS canon
// ═════════════════════════════════════════════════════════════════════════

const HEADER_BG: Record<ReturnType<typeof colorTipo>, string> = {
  emerald: 'bg-gradient-to-br from-emerald-50 to-emerald-100/40 border-emerald-200',
  rose: 'bg-gradient-to-br from-rose-50 to-rose-100/40 border-rose-200',
  purple: 'bg-gradient-to-br from-purple-50 to-purple-100/40 border-purple-200',
  indigo: 'bg-gradient-to-br from-indigo-50 to-indigo-100/40 border-indigo-200',
  amber: 'bg-gradient-to-br from-amber-50 to-amber-100/40 border-amber-200',
};

const AVATAR_BG: Record<ReturnType<typeof colorTipo>, string> = {
  emerald: 'bg-gradient-to-br from-emerald-500 to-emerald-700 ring-2 ring-emerald-200',
  rose: 'bg-gradient-to-br from-rose-500 to-rose-700 ring-2 ring-rose-200',
  purple: 'bg-gradient-to-br from-purple-500 to-purple-700 ring-2 ring-purple-200',
  indigo: 'bg-gradient-to-br from-indigo-500 to-indigo-700 ring-2 ring-indigo-200',
  amber: 'bg-gradient-to-br from-amber-500 to-amber-700 ring-2 ring-amber-200',
};

const SUB_TAB_ACTIVE: Record<ReturnType<typeof colorTipo>, string> = {
  emerald: 'border-emerald-600 text-emerald-700',
  rose: 'border-rose-600 text-rose-700',
  purple: 'border-purple-600 text-purple-700',
  indigo: 'border-indigo-600 text-indigo-700',
  amber: 'border-amber-600 text-amber-700',
};

const CTA_BTN_BG: Record<ReturnType<typeof colorTipo>, string> = {
  emerald: 'bg-emerald-600 hover:bg-emerald-700',
  rose: 'bg-rose-600 hover:bg-rose-700',
  purple: 'bg-purple-600 hover:bg-purple-700',
  indigo: 'bg-indigo-600 hover:bg-indigo-700',
  amber: 'bg-amber-600 hover:bg-amber-700',
};

function colorTipo(cc: CuentaCorriente) {
  return TIPO_ENTIDAD_COLOR[cc.tipo];
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS de formato
// ═════════════════════════════════════════════════════════════════════════

const fmt0 = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtSigned = (n: number, moneda: 'PEN' | 'USD' = 'PEN') => {
  const sim = moneda === 'USD' ? '$' : 'S/';
  return `${n >= 0 ? '+' : '−'}${sim} ${fmt0(Math.abs(n))}`;
};

function formatFechaCorta(d: Date): string {
  return d
    .toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit' })
    .replace(/\./g, '');
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════

export const DrawerCCEntidadCanonico: React.FC<DrawerCCEntidadCanonicoProps> = ({
  cc,
  onClose,
  onRegistrarCobro,
  onEnviarRecordatorio,
  onGenerarEstadoCuenta,
  onIrAFichaEntidad,
  onVerHistorico,
}) => {
  const [tab, setTab] = useState<SubTabCC>('resumen');

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const color = colorTipo(cc);
  const iniciales = obtenerIniciales(cc.entidadNombre);

  const aging = useMemo(() => calcularAgingHeuristico(cc), [cc]);

  // Métricas del header · canon mockup
  const porCobrarPEN = Math.max(0, cc.saldoPEN || 0);
  const porCobrarUSD = Math.max(0, cc.saldoUSD || 0);
  const lePagamos = (cc.saldoPEN || 0) < 0 || (cc.saldoUSD || 0) < 0;
  // Vencido +60d · heurística
  const vencidoMas60 = aging.monto60plus;
  const dsoCliente = diasDesde(cc.fechaUltimoMovimiento);

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 z-50 flex items-end sm:items-stretch sm:justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-cc-title"
    >
      <aside
        className="bg-white rounded-t-2xl sm:rounded-none sm:max-w-[640px] w-full sm:h-full flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── HEADER DRAWER ──────────────────────────────────────────── */}
        <div className={`border-b px-5 py-4 ${HEADER_BG[color]}`}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-[12px] font-bold ${AVATAR_BG[color]}`}
              >
                {iniciales}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span id="drawer-cc-title" className="text-[14px] font-bold text-slate-900">
                    {cc.entidadNombre}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 truncate">
                  ID interno: {cc.entidadId} · CC desde{' '}
                  {cc.fechaCreacion ? formatFechaCorta(cc.fechaCreacion.toDate()) : '—'}
                </p>
                <div className="flex gap-2 mt-1 text-[10px] flex-wrap">
                  {onIrAFichaEntidad && (
                    <button
                      type="button"
                      onClick={onIrAFichaEntidad}
                      className="text-teal-700 hover:underline flex items-center gap-0.5"
                    >
                      <ExternalLink className="w-2.5 h-2.5" /> Ficha {cc.tipo}
                    </button>
                  )}
                  {onVerHistorico && (
                    <>
                      <span className="text-slate-300">·</span>
                      <button
                        type="button"
                        onClick={onVerHistorico}
                        className="text-teal-700 hover:underline flex items-center gap-0.5"
                      >
                        <ExternalLink className="w-2.5 h-2.5" /> Histórico
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Cerrar drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Grid 4 métricas · canon mockup */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            <MetricCard
              label={lePagamos ? 'Por pagar' : 'Por cobrar'}
              value={
                porCobrarUSD > 0.01 && porCobrarPEN < 0.01
                  ? `$ ${fmt0(porCobrarUSD)}`
                  : `S/ ${fmt0(Math.abs(cc.saldoPEN) || porCobrarPEN)}`
              }
              colorText={lePagamos ? 'text-rose-900' : 'text-emerald-900'}
              colorLabel={lePagamos ? 'text-rose-700' : 'text-emerald-700'}
            />
            <MetricCard
              label="Vencido +60d"
              value={`S/ ${fmt0(vencidoMas60)}`}
              colorText={vencidoMas60 > 0 ? 'text-amber-900' : 'text-slate-900'}
              colorLabel={vencidoMas60 > 0 ? 'text-amber-700' : 'text-slate-500'}
            />
            <MetricCard
              label={lePagamos ? 'DPO entidad' : 'DSO entidad'}
              value={`${dsoCliente}d`}
              colorText="text-slate-900"
              colorLabel="text-slate-700"
            />
            <MetricCard
              label="Movs total"
              value={String(cc.cantidadMovimientos ?? 0)}
              colorText="text-slate-900"
              colorLabel="text-slate-700"
            />
          </div>
        </div>

        {/* ─── SUB-TABS ───────────────────────────────────────────────── */}
        <div className="border-b border-slate-200 px-5">
          <div className="flex items-center gap-1 -mb-px overflow-x-auto scrollbar-hide">
            <SubTabBtn
              label="Resumen"
              icon={BarChart2}
              active={tab === 'resumen'}
              color={color}
              onClick={() => setTab('resumen')}
            />
            <SubTabBtn
              label="Movimientos"
              icon={Activity}
              active={tab === 'movimientos'}
              color={color}
              onClick={() => setTab('movimientos')}
            />
            <SubTabBtn
              label="Documentos"
              icon={FileText}
              active={tab === 'documentos'}
              color={color}
              onClick={() => setTab('documentos')}
            />
            <SubTabBtn
              label="Análisis 12m"
              icon={LineChart}
              active={tab === 'analisis'}
              color={color}
              onClick={() => setTab('analisis')}
            />
          </div>
        </div>

        {/* ─── CONTENIDO SUB-TAB ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'resumen' && <TabResumen cc={cc} aging={aging} />}
          {tab === 'movimientos' && <TabMovimientos cc={cc} />}
          {tab === 'documentos' && <TabDocumentosStub />}
          {tab === 'analisis' && <TabAnalisisStub />}
        </div>

        {/* ─── FOOTER ACCIONES · canon N10 ───────────────────────────── */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between gap-2 flex-wrap">
          {onGenerarEstadoCuenta ? (
            <button
              type="button"
              onClick={onGenerarEstadoCuenta}
              className="text-[11px] font-semibold text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg"
            >
              Generar estado cuenta
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {onEnviarRecordatorio && (
              <button
                type="button"
                onClick={onEnviarRecordatorio}
                className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <Mail className="w-3 h-3" /> Recordatorio
              </button>
            )}
            <button
              type="button"
              onClick={onRegistrarCobro}
              className={`text-[11px] font-bold text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${CTA_BTN_BG[color]}`}
            >
              <Plus className="w-3 h-3" /> Registrar {lePagamos ? 'pago' : 'cobro'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES · sub-tabs
// ═════════════════════════════════════════════════════════════════════════

interface MetricCardProps {
  label: string;
  value: string;
  colorText: string;
  colorLabel: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, colorText, colorLabel }) => (
  <div className="bg-white rounded-lg p-2">
    <div className={`text-[8px] uppercase tracking-wider font-bold ${colorLabel}`}>{label}</div>
    <div className={`text-[14px] font-bold tabular-nums ${colorText}`}>{value}</div>
  </div>
);

interface SubTabBtnProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  color: ReturnType<typeof colorTipo>;
  onClick: () => void;
}

const SubTabBtn: React.FC<SubTabBtnProps> = ({ label, icon: Icon, active, color, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-2.5 text-[11px] border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
      active
        ? `font-semibold ${SUB_TAB_ACTIVE[color]}`
        : 'border-transparent text-slate-600 hover:text-slate-900 font-medium'
    }`}
  >
    <Icon className="w-3.5 h-3.5" />
    {label}
  </button>
);

// ─── TAB RESUMEN ─────────────────────────────────────────────────────────

interface TabResumenProps {
  cc: CuentaCorriente;
  aging: AgingBuckets;
}

const TabResumen: React.FC<TabResumenProps> = ({ cc, aging }) => {
  return (
    <div className="p-5 space-y-4">
      {/* Aging detallado · canon mockup §2 */}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2 flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5" /> Aging detallado
        </div>
        <div className="bg-slate-50 rounded-lg p-3 space-y-2">
          <AgingRow
            label="0-30 días"
            pct={aging.pct0a30}
            monto={aging.monto0a30}
            color="emerald"
          />
          <AgingRow
            label="31-60 días"
            pct={aging.pct31a60}
            monto={aging.monto31a60}
            color="amber"
          />
          <AgingRow
            label="+60 días ⚠️"
            pct={aging.pct60plus}
            monto={aging.monto60plus}
            color="rose"
          />
        </div>
      </div>

      {/* Notas operativas · placeholder */}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2 flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5" /> Notas administrativas
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-[11px] space-y-1">
          {cc.notas ? (
            <div className="text-slate-700 whitespace-pre-wrap">{cc.notas}</div>
          ) : (
            <div className="text-slate-400 italic">
              Sin notas registradas en esta CC. Las notas se pueden agregar desde el
              módulo de Maestros · ficha {cc.tipo}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface AgingRowProps {
  label: string;
  pct: number;
  monto: number;
  color: 'emerald' | 'amber' | 'rose';
}

const AGING_TEXT: Record<AgingRowProps['color'], string> = {
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
};
const AGING_VALUE: Record<AgingRowProps['color'], string> = {
  emerald: 'text-emerald-900',
  amber: 'text-amber-900',
  rose: 'text-rose-900',
};
const AGING_TRACK: Record<AgingRowProps['color'], string> = {
  emerald: 'bg-emerald-100',
  amber: 'bg-amber-100',
  rose: 'bg-rose-100',
};
const AGING_FILL: Record<AgingRowProps['color'], string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
};

const AgingRow: React.FC<AgingRowProps> = ({ label, pct, monto, color }) => (
  <div className="flex items-center justify-between text-[11px] gap-2">
    <span className={`font-bold ${AGING_TEXT[color]}`}>{label}</span>
    <div className="flex items-center gap-2 flex-1 max-w-[260px]">
      <div className={`flex-1 h-2 rounded-full overflow-hidden ${AGING_TRACK[color]}`}>
        <div
          className={`h-full ${AGING_FILL[color]}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span className={`font-bold tabular-nums whitespace-nowrap ${AGING_VALUE[color]}`}>
        S/ {fmt0(monto)}
      </span>
    </div>
  </div>
);

// ─── TAB MOVIMIENTOS ─────────────────────────────────────────────────────

interface TabMovimientosProps {
  cc: CuentaCorriente;
}

const TabMovimientos: React.FC<TabMovimientosProps> = ({ cc }) => {
  const [movs, setMovs] = useState<MovimientoCC[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMovs(null);
    setError(null);
    cuentaCorrienteService
      .getMovimientos(cc.id, { limit: 50 })
      .then((lista) => {
        if (cancelled) return;
        setMovs(lista);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? 'Error cargando movimientos');
      });
    return () => {
      cancelled = true;
    };
  }, [cc.entidadId, cc.tipo]);

  if (error) {
    return (
      <div className="p-5">
        <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 text-[11px] text-rose-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-700 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-bold">Error cargando movimientos</div>
            <div className="text-rose-700 mt-0.5">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (movs === null) {
    return (
      <div className="p-5 space-y-1.5">
        <div className="shimmer h-8 rounded" />
        <div className="shimmer h-8 rounded" />
        <div className="shimmer h-8 rounded" />
      </div>
    );
  }

  if (movs.length === 0) {
    return (
      <div className="p-5 text-[12px] text-slate-500 text-center italic">
        Esta CC no tiene movimientos registrados aún.
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2 flex items-center gap-1.5">
        <Activity className="w-3.5 h-3.5" /> Libro de movimientos
        <span className="text-[10px] text-slate-500 normal-case">
          · {movs.length} {movs.length === 1 ? 'movimiento' : 'movimientos'}
        </span>
      </div>
      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
        {movs.slice(0, 20).map((m) => (
          <MovimientoCCRow key={m.id} mov={m} />
        ))}
      </div>
      {movs.length > 20 && (
        <div className="text-[10px] text-slate-500 text-center mt-2">
          Mostrando 20 de {movs.length} · drill completo en chk5.D-S4.
        </div>
      )}
    </div>
  );
};

interface MovimientoCCRowProps {
  mov: MovimientoCC;
}

const MovimientoCCRow: React.FC<MovimientoCCRowProps> = ({ mov }) => {
  const fecha = mov.fecha?.toDate();
  const esDebito = String(mov.tipo).startsWith('debito');
  const moneda = mov.moneda;
  const sim = moneda === 'USD' ? '$' : 'S/';
  return (
    <div className="px-3 py-2 flex items-center gap-2 hover:bg-slate-50 text-[11px]">
      <div className="text-[10px] text-slate-500 w-20 flex-shrink-0">
        {fecha ? formatFechaCorta(fecha) : '—'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-900 truncate">{mov.tipo}</div>
        {mov.descripcion && (
          <div className="text-[10px] text-slate-500 truncate">{mov.descripcion}</div>
        )}
      </div>
      <div
        className={`text-right tabular-nums font-bold whitespace-nowrap ${
          esDebito ? 'text-amber-700' : 'text-emerald-700'
        }`}
      >
        {esDebito ? '+' : '−'}
        {sim} {fmt0(Math.abs(mov.monto || 0))}
      </div>
    </div>
  );
};

// ─── TAB DOCUMENTOS · stub para chk5.D-S4 ───────────────────────────────

const TabDocumentosStub: React.FC = () => (
  <div className="p-5">
    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2 flex items-center gap-1.5">
      <FileText className="w-3.5 h-3.5" /> Documentos abiertos
    </div>
    <div className="bg-amber-50 ring-1 ring-amber-200 rounded-lg p-3 text-[11px] text-amber-900">
      <strong>Próximamente · chk5.D-S4.</strong> Tabla de facturas / OCs / boletas abiertas
      de esta CC con columna de aging por fila + acción "Cobrar/Pagar" directa.
      Canon completo en MOCK 8 §2 sub-tab Documentos.
    </div>
  </div>
);

// ─── TAB ANÁLISIS 12m · stub para chk5.D-S4 / S3.bisAnálisis ───────────

const TabAnalisisStub: React.FC = () => (
  <div className="p-5">
    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2 flex items-center gap-1.5">
      <LineChart className="w-3.5 h-3.5" /> Análisis 12 meses
    </div>
    <div className="bg-amber-50 ring-1 ring-amber-200 rounded-lg p-3 text-[11px] text-amber-900">
      <strong>Próximamente · chk5.D-S4.</strong> Mini-charts de cobro promedio · evolución
      saldo · concentración por mes · DSO/DPO trend · ratio de pagos en plazo.
    </div>
  </div>
);
