/**
 * TabPipeline.tsx — Imp-L4 · Refactor visual S58e (mockup M3)
 *
 * Pantalla expandida del pipeline de salud financiera. NO es solo el
 * componente PipelineTesoreria pequeño — es la vista dedicada con:
 *   - 4 KPIs ejecutivos
 *   - 5 secciones colapsables (Saludable / Atención / Crítico / TC Corte
 *     próximo / TC Vencida) con cards de productos adentro
 *   - Timeline horizontal de próximos 30 días con eventos
 *   - Sidebar derecho de "Acciones recomendadas" priorizadas
 *
 * Cada CTA en una card de producto abre el ProductoDetalleModal (M2).
 */

import React, { useMemo, useState } from 'react';
import {
  GitBranch,
  RefreshCw,
  ArrowLeft,
  LayoutGrid,
  XCircle,
  CalendarClock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  AlarmClockOff,
  ChevronDown,
  ChevronUp,
  TrendingUp,
} from 'lucide-react';
import type { CuentaCaja } from '../../types/tesoreria.types';
import type { TarjetaCredito } from '../../types/tarjetaCredito.types';
import { useTesoreriaStore } from '../../store/tesoreriaStore';
import { useTarjetaCreditoStore } from '../../store/tarjetaCreditoStore';
import { ProductCard } from './components';
import { calcularEstadoSaldo } from './components/SaldoAlertChip';
import { ProductoDetalleModal } from './ProductoDetalleModal';
import { cn } from '../../design-system/utils';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

type SeccionKey = 'saludable' | 'atencion' | 'critico' | 'corte_proximo' | 'tc_vencida';

interface SeccionConfig {
  key: SeccionKey;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  border: string;
  iconBg: string;
  iconText: string;
  textTitle: string;
  textDesc: string;
  /** Si true, arranca expandida por default (Crítico y TC Vencida) */
  defaultExpanded?: boolean;
}

const SECCIONES: SeccionConfig[] = [
  {
    key: 'critico',
    label: 'Crítico',
    desc: 'Saldo < 50% del mínimo · Acción urgente requerida',
    icon: XCircle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
    textTitle: 'text-red-800',
    textDesc: 'text-red-600',
    defaultExpanded: true,
  },
  {
    key: 'tc_vencida',
    label: 'TC Vencida',
    desc: 'Día de pago pasado con saldo de cargos > 0',
    icon: AlarmClockOff,
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    iconBg: 'bg-rose-100',
    iconText: 'text-rose-600',
    textTitle: 'text-rose-800',
    textDesc: 'text-rose-600',
    defaultExpanded: true,
  },
  {
    key: 'atencion',
    label: 'Atención',
    desc: 'Saldo entre 50% – 100% del mínimo · Revisar en próximos 7 días',
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    textTitle: 'text-amber-800',
    textDesc: 'text-amber-600',
  },
  {
    key: 'corte_proximo',
    label: 'TC · Corte próximo',
    desc: 'Día de corte en los próximos 7 días',
    icon: CalendarClock,
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    iconBg: 'bg-sky-100',
    iconText: 'text-sky-600',
    textTitle: 'text-sky-800',
    textDesc: 'text-sky-600',
  },
  {
    key: 'saludable',
    label: 'Saludable',
    desc: 'Saldo sobre el mínimo configurado · Sin acciones requeridas',
    icon: CheckCircle2,
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    textTitle: 'text-emerald-800',
    textDesc: 'text-emerald-600',
  },
];

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function fmtPEN(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
}

function fmtUSD(n: number): string {
  return `US$ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
}

function clasificarCuenta(c: CuentaCaja): SeccionKey | null {
  if (c.tipo === 'credito' && c.productoFinanciero === 'tarjeta_credito') {
    // TCs van a corte_proximo / tc_vencida si aplica · stub por ahora
    return null;
  }
  const estado = calcularEstadoSaldo({
    saldoActual: c.esBiMoneda ? (c.saldoPEN ?? 0) : c.saldoActual,
    saldoMinimo: c.saldoMinimo,
  });
  if (estado === 'critico') return 'critico';
  if (estado === 'atencion') return 'atencion';
  if (estado === 'saludable') return 'saludable';
  return null;
}

// ═════════════════════════════════════════════════════════════════════════
// SECCION COMPONENT
// ═════════════════════════════════════════════════════════════════════════

const Seccion: React.FC<{
  config: SeccionConfig;
  cuentas: CuentaCaja[];
  totalAgregadoPEN: number;
  expandedDefault?: boolean;
  onProductClick?: (c: CuentaCaja) => void;
}> = ({ config, cuentas, totalAgregadoPEN, expandedDefault, onProductClick }) => {
  const [expanded, setExpanded] = useState(!!expandedDefault);
  const Icon = config.icon;
  const count = cuentas.length;

  return (
    <div
      className={cn(
        'rounded-xl border transition-all duration-200 mb-3 overflow-hidden',
        config.bg,
        config.border,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:brightness-[0.98] transition-all"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
              config.iconBg,
            )}
          >
            <Icon className={cn('w-5 h-5', config.iconText)} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-sm font-bold', config.textTitle)}>
                {config.label}
              </span>
              <span
                className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                  config.iconBg,
                  config.textTitle,
                )}
              >
                {count} {count === 1 ? 'producto' : 'productos'}
              </span>
              {totalAgregadoPEN > 0 && (
                <span
                  className={cn(
                    'text-[10px] font-semibold tabular-nums',
                    config.textTitle,
                  )}
                >
                  · {fmtPEN(totalAgregadoPEN)}
                </span>
              )}
            </div>
            <div className={cn('text-xs mt-0.5', config.textDesc)}>{config.desc}</div>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 transition-transform flex-shrink-0',
            config.iconText,
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded && (
        <div className="bg-white p-3 sm:p-4 space-y-2 border-t border-slate-200">
          {count === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400">
              No hay productos en este estado.
            </div>
          ) : (
            cuentas.map((c) => (
              <ProductCard
                key={c.id}
                cuenta={c}
                onVerDetalle={onProductClick}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════

export interface TabPipelineProps {
  /** Callback para volver al listado principal de productos */
  onVolverListado?: () => void;
}

export const TabPipeline: React.FC<TabPipelineProps> = ({ onVolverListado }) => {
  const cuentas = useTesoreriaStore((s) => s.cuentas);
  const tarjetas = useTarjetaCreditoStore((s) => s.tarjetas);
  const fetchAll = useTesoreriaStore((s) => s.fetchAll);

  const [productoDetalle, setProductoDetalle] = useState<CuentaCaja | null>(null);

  // Clasificar cuentas por sección
  const cuentasPorSeccion = useMemo(() => {
    const groups: Record<SeccionKey, CuentaCaja[]> = {
      saludable: [],
      atencion: [],
      critico: [],
      corte_proximo: [],
      tc_vencida: [],
    };
    for (const c of cuentas) {
      if (!c.activa) continue;
      const seccion = clasificarCuenta(c);
      if (seccion) groups[seccion].push(c);
    }
    return groups;
  }, [cuentas]);

  // KPIs
  const kpis = useMemo(() => {
    const productosActivos = cuentas.filter((c) => c.activa);
    const productosTotal = productosActivos.length + tarjetas.filter((t) => t.activa !== false).length;
    const criticos = cuentasPorSeccion.critico.length;
    const tcCortes = 0; // stub · F4 con fecha real
    const accionesRequeridas = criticos + cuentasPorSeccion.atencion.length + tcCortes;

    let cuentasCount = 0;
    let tcsCount = tarjetas.filter((t) => t.activa !== false).length;
    let cajasCount = 0;
    let walletsCount = 0;
    for (const c of productosActivos) {
      if (c.tipo === 'banco') cuentasCount++;
      else if (c.tipo === 'efectivo') cajasCount++;
      else if (c.tipo === 'digital') walletsCount++;
    }
    return {
      productosTotal,
      breakdown: `${cuentasCount} cuentas · ${tcsCount} TCs · ${cajasCount} cajas · ${walletsCount} wallets`,
      criticos,
      tcCortes,
      accionesRequeridas,
    };
  }, [cuentas, tarjetas, cuentasPorSeccion]);

  // Acciones recomendadas top 3 (priorizar críticos)
  const accionesRecomendadas = useMemo(() => {
    const acciones: Array<{
      tipo: 'critico' | 'atencion' | 'corte';
      titulo: string;
      descripcion: string;
      cuenta: CuentaCaja;
    }> = [];
    for (const c of cuentasPorSeccion.critico.slice(0, 3)) {
      acciones.push({
        tipo: 'critico',
        titulo: c.nombre,
        descripcion: `Saldo crítico · ${c.banco ?? 'sin banco'}`,
        cuenta: c,
      });
    }
    if (acciones.length < 3) {
      for (const c of cuentasPorSeccion.atencion.slice(0, 3 - acciones.length)) {
        acciones.push({
          tipo: 'atencion',
          titulo: c.nombre,
          descripcion: `Saldo bajo · ${c.banco ?? 'sin banco'}`,
          cuenta: c,
        });
      }
    }
    return acciones;
  }, [cuentasPorSeccion]);

  // Saldo agregado PEN equivalente por sección
  function totalAgregadoPENDeSeccion(seccion: SeccionKey): number {
    const items = cuentasPorSeccion[seccion];
    const tc = 3.85;
    let total = 0;
    for (const c of items) {
      if (c.esBiMoneda) {
        total += (c.saldoPEN ?? 0) + (c.saldoUSD ?? 0) * tc;
      } else if (c.moneda === 'PEN') {
        total += c.saldoActual;
      } else {
        total += c.saldoActual * tc;
      }
    }
    return total;
  }

  return (
    <>
      {/* Header de página */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Tesorería</span>
            <span>·</span>
            <span className="text-slate-600 font-medium">Pipeline</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <GitBranch className="w-6 h-6 text-teal-600" />
            Pipeline · Tesorería
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Vista expandida de salud financiera · {kpis.productosTotal} productos activos
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void fetchAll()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar saldos
          </button>
          {onVolverListado && (
            <button
              type="button"
              onClick={onVolverListado}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-all shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver al listado
            </button>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Productos en pipeline
            </span>
            <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center">
              <LayoutGrid className="w-4 h-4 text-teal-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{kpis.productosTotal}</div>
          <div className="text-xs text-slate-500 mt-1">{kpis.breakdown}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Productos críticos
            </span>
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
              <XCircle className="w-4 h-4 text-red-600" />
            </div>
          </div>
          <div
            className={cn(
              'text-2xl font-bold tabular-nums',
              kpis.criticos > 0 ? 'text-red-600 animate-pulse' : 'text-slate-900',
            )}
          >
            {kpis.criticos}
          </div>
          <div className="text-xs text-red-500 mt-1">Saldo &lt; 50% del mínimo</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              TC con corte próximo
            </span>
            <div className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center">
              <CalendarClock className="w-4 h-4 text-sky-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-sky-700 tabular-nums">{kpis.tcCortes}</div>
          <div className="text-xs text-sky-600 mt-1">Próximos 7 días</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Acciones requeridas
            </span>
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div
            className={cn(
              'text-2xl font-bold tabular-nums',
              kpis.accionesRequeridas > 0 ? 'text-amber-600' : 'text-slate-900',
            )}
          >
            {kpis.accionesRequeridas}
          </div>
          <div className="text-xs text-amber-600 mt-1">
            {kpis.criticos > 0 ? `${kpis.criticos} urgentes` : 'Sin urgentes'}
          </div>
        </div>
      </div>

      {/* Layout principal: secciones + sidebar acciones */}
      <div className="flex gap-5 items-start flex-col lg:flex-row">
        {/* Columna principal: secciones */}
        <div className="flex-1 min-w-0 w-full">
          {SECCIONES.map((cfg) => (
            <Seccion
              key={cfg.key}
              config={cfg}
              cuentas={cuentasPorSeccion[cfg.key]}
              totalAgregadoPEN={totalAgregadoPENDeSeccion(cfg.key)}
              expandedDefault={cfg.defaultExpanded}
              onProductClick={(c) => setProductoDetalle(c)}
            />
          ))}
        </div>

        {/* Sidebar derecho: acciones recomendadas */}
        <aside className="w-full lg:w-72 flex-shrink-0 lg:sticky lg:top-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-gradient-to-br from-teal-700 to-teal-500 p-4 text-white">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Acciones recomendadas
                </span>
              </div>
              <p className="text-[11px] mt-1 text-teal-100">
                Top 3 priorizadas por urgencia
              </p>
            </div>
            <div className="p-3 space-y-2">
              {accionesRecomendadas.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">Todo en orden</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Sin acciones urgentes pendientes.
                  </p>
                </div>
              ) : (
                accionesRecomendadas.map((a, idx) => {
                  const accent =
                    a.tipo === 'critico'
                      ? { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' }
                      : a.tipo === 'atencion'
                        ? { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' }
                        : { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700' };
                  return (
                    <button
                      key={`${a.cuenta.id}-${idx}`}
                      type="button"
                      onClick={() => setProductoDetalle(a.cuenta)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border transition-all',
                        accent.bg,
                        accent.border,
                        'hover:shadow-sm hover:-translate-y-0.5 active:scale-[0.99]',
                      )}
                    >
                      <div className={cn('text-xs font-bold', accent.text)}>
                        {idx + 1}. {a.titulo}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {a.descripcion}
                      </div>
                      <div className={cn('text-[10px] font-semibold mt-1.5', accent.text)}>
                        Ver detalle →
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Modal detalle producto */}
      <ProductoDetalleModal
        isOpen={!!productoDetalle}
        cuenta={productoDetalle}
        onClose={() => setProductoDetalle(null)}
      />
    </>
  );
};
