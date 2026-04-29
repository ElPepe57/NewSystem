/**
 * TitularDrilldownView.tsx — Imp-L5 · Refactor visual S58e (mockup M4)
 *
 * Vista dedicada del ecosistema financiero de un titular específico.
 * Se renderea como pantalla completa cuando el usuario hace click en el
 * header de un titular en VistaPorTitular (Imp-L1).
 *
 * Estructura:
 *   - Header con breadcrumb + botón Volver + Editar perfil + Nuevo producto
 *   - Hero gradiente diferenciado por tipo (teal/sky/purple/amber/rose)
 *   - KPI strip (4 KPIs ejecutivos del titular)
 *   - Mini pipeline filtrado al titular
 *   - Sub-grupos por banco con cards de productos + sparklines
 *   - Timeline horizontal de actividad reciente (últimos 10 movs)
 *   - Footer con métricas lifetime
 */

import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Edit3,
  Plus,
  Building,
  IdCard,
  Truck,
  User as UserIcon,
  Users as UsersIcon,
  MapPin,
  LayoutGrid,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CalendarClock,
  ChevronRight,
} from 'lucide-react';
import type { CuentaCaja, MovimientoTesoreria } from '../../types/tesoreria.types';
import { useTesoreriaStore } from '../../store/tesoreriaStore';
import { ProductCard, BankSubheader } from './components';
import { calcularEstadoSaldo } from './components/SaldoAlertChip';
import { ProductoDetalleModal } from './ProductoDetalleModal';
import type { GrupoTitular, TipoTitular } from './VistaPorTitular/helpers';
import { cn } from '../../design-system/utils';

// ═════════════════════════════════════════════════════════════════════════
// CONFIG POR TIPO DE TITULAR
// ═════════════════════════════════════════════════════════════════════════

interface TipoConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  heroGradient: string;
  heroAccent: string;
  heroChipBg: string;
}

const TIPO_CONFIG: Record<TipoTitular, TipoConfig> = {
  empresa: {
    icon: Building,
    label: 'Empresa',
    heroGradient: 'bg-gradient-to-br from-teal-700 to-teal-500',
    heroAccent: 'text-teal-200',
    heroChipBg: 'bg-teal-400/30 text-teal-100',
  },
  empleado: {
    icon: IdCard,
    label: 'Empleado',
    heroGradient: 'bg-gradient-to-br from-sky-700 to-sky-500',
    heroAccent: 'text-sky-200',
    heroChipBg: 'bg-sky-400/30 text-sky-100',
  },
  colaborador: {
    icon: UsersIcon,
    label: 'Colaborador',
    heroGradient: 'bg-gradient-to-br from-purple-700 to-purple-500',
    heroAccent: 'text-purple-200',
    heroChipBg: 'bg-purple-400/30 text-purple-100',
  },
  proveedor: {
    icon: Truck,
    label: 'Proveedor',
    heroGradient: 'bg-gradient-to-br from-amber-700 to-amber-500',
    heroAccent: 'text-amber-100',
    heroChipBg: 'bg-amber-400/30 text-amber-100',
  },
  cliente: {
    icon: UserIcon,
    label: 'Cliente',
    heroGradient: 'bg-gradient-to-br from-rose-700 to-rose-500',
    heroAccent: 'text-rose-200',
    heroChipBg: 'bg-rose-400/30 text-rose-100',
  },
};

// ═════════════════════════════════════════════════════════════════════════
// SPARKLINE SVG
// ═════════════════════════════════════════════════════════════════════════

/**
 * Genera datos mock estables para sparkline basados en el id del producto.
 * En F4 (con histórico real de saldos) se reemplaza con datos verdaderos.
 */
function generarSparklineMock(seed: string, baseSaldo: number): number[] {
  const hash = seed
    .split('')
    .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 0);
  const points: number[] = [];
  let curr = baseSaldo;
  for (let i = 0; i < 30; i++) {
    const variation = (((hash * (i + 1)) % 200) - 100) / 1000; // ±10%
    curr = curr * (1 + variation);
    points.push(curr);
  }
  return points;
}

const Sparkline: React.FC<{
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}> = ({ data, width = 80, height = 24, color = '#0d9488' }) => {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function fmtPEN(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
}

function patrimonioPENDeProducto(c: CuentaCaja, tc = 3.85): number {
  if (c.esBiMoneda) return (c.saldoPEN ?? 0) + (c.saldoUSD ?? 0) * tc;
  if (c.moneda === 'USD') return c.saldoActual * tc;
  return c.saldoActual;
}

function fechaRelativa(d: Date | null): string {
  if (!d) return '—';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const dias = Math.floor(h / 24);
  return `hace ${dias}d`;
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════

export interface TitularDrilldownViewProps {
  grupo: GrupoTitular;
  onVolver: () => void;
  onNuevoProducto?: () => void;
  onEditarPerfil?: () => void;
}

export const TitularDrilldownView: React.FC<TitularDrilldownViewProps> = ({
  grupo,
  onVolver,
  onNuevoProducto,
  onEditarPerfil,
}) => {
  const movimientos = useTesoreriaStore((s) => s.movimientos);
  const [productoDetalle, setProductoDetalle] = useState<CuentaCaja | null>(null);

  const tipoCfg = TIPO_CONFIG[grupo.tipo];
  const TipoIcon = tipoCfg.icon;

  // Cuentas del grupo
  const cuentasDelGrupo = useMemo<CuentaCaja[]>(() => {
    return grupo.items
      .filter((i) => i.kind === 'cuenta')
      .map((i) => (i.kind === 'cuenta' ? i.cuenta : null))
      .filter(Boolean) as CuentaCaja[];
  }, [grupo]);

  // Patrimonio total PEN equivalente
  const patrimonioTotalPEN = useMemo(() => {
    return cuentasDelGrupo.reduce((sum, c) => sum + patrimonioPENDeProducto(c), 0);
  }, [cuentasDelGrupo]);

  // Movimientos del mes filtrados al titular (cuentas del grupo como origen o destino)
  const movsDelMes = useMemo(() => {
    const idsCuentas = new Set(cuentasDelGrupo.map((c) => c.id));
    const ahora = new Date();
    return movimientos.filter((m) => {
      const tieneCuenta =
        idsCuentas.has(m.cuentaOrigen ?? '') || idsCuentas.has(m.cuentaDestino ?? '');
      if (!tieneCuenta) return false;
      const d = m.fecha?.toDate?.();
      if (!d) return false;
      return (
        d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear()
      );
    });
  }, [movimientos, cuentasDelGrupo]);

  const ultimoMov = useMemo<MovimientoTesoreria | null>(() => {
    const idsCuentas = new Set(cuentasDelGrupo.map((c) => c.id));
    let ultimo: MovimientoTesoreria | null = null;
    let tsUltimo = 0;
    for (const m of movimientos) {
      const tieneCuenta =
        idsCuentas.has(m.cuentaOrigen ?? '') || idsCuentas.has(m.cuentaDestino ?? '');
      if (!tieneCuenta) continue;
      const t = m.fecha?.toDate?.()?.getTime() ?? 0;
      if (t > tsUltimo) {
        tsUltimo = t;
        ultimo = m;
      }
    }
    return ultimo;
  }, [movimientos, cuentasDelGrupo]);

  // Pipeline mini del titular
  const pipelineMini = useMemo(() => {
    let saludable = 0;
    let atencion = 0;
    let critico = 0;
    let cortePromixo = 0;
    for (const c of cuentasDelGrupo) {
      if (!c.activa) continue;
      const estado = calcularEstadoSaldo({
        saldoActual: c.esBiMoneda ? (c.saldoPEN ?? 0) : c.saldoActual,
        saldoMinimo: c.saldoMinimo,
        esTarjetaCredito: c.tipo === 'credito' && c.productoFinanciero === 'tarjeta_credito',
      });
      if (estado === 'critico') critico++;
      else if (estado === 'atencion') atencion++;
      else saludable++;
    }
    return { saludable, atencion, critico, cortePromixo };
  }, [cuentasDelGrupo]);

  // Sub-grupos por banco (igual que vista por titular pero sólo este grupo)
  const subgruposBanco = grupo.subgrupos;

  // Activity timeline: últimos 10 movs del titular
  const activityRecent = useMemo(() => {
    const idsCuentas = new Set(cuentasDelGrupo.map((c) => c.id));
    return movimientos
      .filter(
        (m) =>
          idsCuentas.has(m.cuentaOrigen ?? '') ||
          idsCuentas.has(m.cuentaDestino ?? ''),
      )
      .sort((a, b) => {
        const ta = a.fecha?.toDate?.()?.getTime() ?? 0;
        const tb = b.fecha?.toDate?.()?.getTime() ?? 0;
        return tb - ta;
      })
      .slice(0, 10);
  }, [movimientos, cuentasDelGrupo]);

  return (
    <div>
      {/* Header con back */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <button
              type="button"
              onClick={onVolver}
              className="hover:text-teal-600 transition-colors"
            >
              Tesorería
            </button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-600 font-medium">{grupo.nombre}</span>
          </div>
        </div>
      </div>

      {/* Hero del titular */}
      <div className={cn('rounded-2xl p-6 mb-5 text-white', tipoCfg.heroGradient)}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-5 min-w-0">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center flex-shrink-0">
              <TipoIcon className="w-8 h-8 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[10px] font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full">
                  {tipoCfg.label}
                </span>
                {grupo.entidadId && (
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                      tipoCfg.heroChipBg,
                    )}
                  >
                    ID {grupo.entidadId.slice(0, 8)}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight truncate">
                {grupo.nombre}
              </h1>
              <div
                className={cn(
                  'flex items-center gap-3 mt-1.5 text-sm flex-wrap',
                  tipoCfg.heroAccent,
                )}
              >
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Perú
                </span>
                <span className="opacity-50">·</span>
                <span className="flex items-center gap-1">
                  <LayoutGrid className="w-3.5 h-3.5" />
                  {cuentasDelGrupo.length} productos activos
                </span>
                <span className="opacity-50">·</span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {fmtPEN(patrimonioTotalPEN)} en cartera
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onVolver}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all border border-white/20"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver
            </button>
            {onEditarPerfil && (
              <button
                type="button"
                onClick={onEditarPerfil}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all border border-white/20"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar perfil
              </button>
            )}
            {onNuevoProducto && (
              <button
                type="button"
                onClick={onNuevoProducto}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white text-teal-700 hover:bg-teal-50 rounded-lg transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Nuevo producto
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 mb-5 divide-x divide-slate-200">
        <div className="p-4">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Patrimonio total
          </div>
          <div className="text-xl font-bold text-slate-900 tabular-nums">
            {fmtPEN(patrimonioTotalPEN)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Equivalente PEN al TC 3.85
          </div>
        </div>
        <div className="p-4">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Productos activos
          </div>
          <div className="text-xl font-bold text-slate-900 tabular-nums">
            {cuentasDelGrupo.length}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            En {subgruposBanco.length} {subgruposBanco.length === 1 ? 'banco' : 'bancos'}
          </div>
        </div>
        <div className="p-4">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Movimientos del mes
          </div>
          <div className="text-xl font-bold text-slate-900 tabular-nums">
            {movsDelMes.length}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Mes en curso</div>
        </div>
        <div className="p-4">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Última actividad
          </div>
          <div className="text-sm font-semibold text-slate-800">
            {ultimoMov ? fechaRelativa(ultimoMov.fecha?.toDate?.() ?? null) : '—'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">
            {ultimoMov?.concepto ?? 'Sin actividad reciente'}
          </div>
        </div>
      </div>

      {/* Pipeline mini del titular */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">
          Salud de los productos · {grupo.nombre}
        </h3>
        <div className="grid grid-cols-2 lg:flex gap-2 items-center">
          <MiniStage
            label="Saludable"
            count={pipelineMini.saludable}
            icon={CheckCircle2}
            tone="emerald"
          />
          <ChevronRight className="w-4 h-4 text-slate-300 hidden lg:block" />
          <MiniStage
            label="Atención"
            count={pipelineMini.atencion}
            icon={AlertTriangle}
            tone="amber"
          />
          <ChevronRight className="w-4 h-4 text-slate-300 hidden lg:block" />
          <MiniStage
            label="Crítico"
            count={pipelineMini.critico}
            icon={XCircle}
            tone="red"
          />
          <ChevronRight className="w-4 h-4 text-slate-300 hidden lg:block" />
          <MiniStage
            label="TC corte"
            count={pipelineMini.cortePromixo}
            icon={CalendarClock}
            tone="sky"
          />
        </div>
      </div>

      {/* Sub-grupos por banco con cards + sparklines */}
      <div className="space-y-5 mb-5">
        {subgruposBanco.map((sg) => {
          const cuentasDelBanco = sg.items
            .filter((i) => i.kind === 'cuenta')
            .map((i) => (i.kind === 'cuenta' ? i.cuenta : null))
            .filter(Boolean) as CuentaCaja[];

          // Saldo agregado del banco (PEN equivalente)
          const totalBanco = cuentasDelBanco.reduce(
            (sum, c) => sum + patrimonioPENDeProducto(c),
            0,
          );

          return (
            <div key={sg.banco}>
              <BankSubheader
                banco={sg.banco}
                bancoNombreCompleto={sg.bancoNombreCompleto}
                productosCount={sg.items.length}
                saldoTexto={fmtPEN(totalBanco)}
              />
              <div className="ml-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {cuentasDelBanco.map((c) => {
                  const baseSaldo = c.saldoActual || 1000;
                  const sparkData = generarSparklineMock(c.id, baseSaldo);
                  return (
                    <div
                      key={c.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
                      onClick={() => setProductoDetalle(c)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {c.nombre}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {c.tipo === 'banco'
                              ? c.productoFinanciero === 'cuenta_ahorros'
                                ? 'Ahorros'
                                : 'Corriente'
                              : c.tipo === 'credito'
                                ? c.productoFinanciero === 'tarjeta_credito'
                                  ? 'TC'
                                  : 'TD'
                                : c.tipo === 'efectivo'
                                  ? 'Caja'
                                  : 'Wallet'}{' '}
                            · {c.moneda}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-lg font-bold text-slate-900 tabular-nums">
                            {fmtPEN(c.esBiMoneda ? (c.saldoPEN ?? 0) : c.saldoActual)}
                          </div>
                          {c.esBiMoneda && (
                            <div className="text-xs text-sky-600 tabular-nums">
                              US$ {(c.saldoUSD ?? 0).toLocaleString('es-PE')}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <Sparkline data={sparkData} />
                        <span className="text-[10px] text-slate-400">
                          últimos 30 días
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Timeline de actividad reciente */}
      {activityRecent.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Actividad reciente
            </h3>
            <span className="text-xs text-slate-400">
              últimos {activityRecent.length} movimientos
            </span>
          </div>
          <div className="overflow-x-auto">
            <div className="flex gap-3 pb-2" style={{ minWidth: 'min-content' }}>
              {activityRecent.map((m) => {
                const fecha = m.fecha?.toDate?.();
                const idsCuentas = new Set(cuentasDelGrupo.map((c) => c.id));
                const esIngreso = idsCuentas.has(m.cuentaDestino ?? '');
                return (
                  <div
                    key={m.id}
                    className="flex-shrink-0 w-44 bg-slate-50 border border-slate-200 rounded-lg p-3"
                  >
                    <div className="text-[10px] text-slate-400 mb-1">
                      {fecha
                        ? fecha.toLocaleDateString('es-PE', {
                            day: '2-digit',
                            month: 'short',
                          })
                        : '—'}
                    </div>
                    <div className="text-xs text-slate-800 truncate font-medium">
                      {m.concepto}
                    </div>
                    <div
                      className={cn(
                        'mt-1.5 text-sm font-bold tabular-nums',
                        esIngreso ? 'text-emerald-700' : 'text-red-600',
                      )}
                    >
                      {esIngreso ? '+' : '−'}
                      {m.moneda === 'USD' ? 'US$' : 'S/'}{' '}
                      {m.monto.toLocaleString('es-PE', {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Footer ejecutivo */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
        <div className="text-xs text-slate-500">
          Cliente bancario · {cuentasDelGrupo.length} productos lifetime
          {grupo.tipo !== 'empresa' &&
            ` · vinculado vía ${grupo.tipo === 'cliente' ? 'cuenta corriente' : 'titularidad personal'}`}
        </div>
      </div>

      {/* Modal detalle del producto */}
      <ProductoDetalleModal
        isOpen={!!productoDetalle}
        cuenta={productoDetalle}
        onClose={() => setProductoDetalle(null)}
      />
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// MINI STAGE (pipeline reducido)
// ═════════════════════════════════════════════════════════════════════════

const MiniStage: React.FC<{
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'emerald' | 'amber' | 'red' | 'sky';
}> = ({ label, count, icon: Icon, tone }) => {
  const cfg = {
    emerald: { bg: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-600', text: 'text-emerald-800', label: 'text-emerald-700' },
    amber: { bg: 'bg-amber-50 border-amber-200', icon: 'text-amber-600', text: 'text-amber-800', label: 'text-amber-700' },
    red: { bg: 'bg-red-50 border-red-200', icon: 'text-red-600', text: 'text-red-800', label: 'text-red-700' },
    sky: { bg: 'bg-sky-50 border-sky-200', icon: 'text-sky-600', text: 'text-sky-800', label: 'text-sky-700' },
  }[tone];
  return (
    <div className={cn('flex-1 border rounded-lg p-2.5', cfg.bg)}>
      <div className="flex items-center gap-1 justify-center mb-0.5">
        <Icon className={cn('w-3 h-3', cfg.icon)} />
        <span className={cn('text-[10px] font-semibold', cfg.label)}>{label}</span>
      </div>
      <div className={cn('text-lg font-bold tabular-nums text-center', cfg.text)}>
        {count}
      </div>
    </div>
  );
};
