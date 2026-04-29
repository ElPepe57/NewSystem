/**
 * EntidadCCDetailModal — S56 Fase 2 · Detalle de cuenta corriente
 *
 * Modal con la misma estructura visual que OrdenCompraCard (referencia
 * canónica S54.x): header hero + pipeline contextual + 4 KPIs + tabs
 * sticky con scroll independiente.
 *
 * Tabs:
 *  - Extracto: libro mayor de movimientos CC
 *  - Documentos: OCs/Ventas/Envios asociados con saldo individual
 *  - Histórico: pagos cobrados/realizados (filtrado del extracto)
 *  - Acciones: CTAs Pagar/Cobrar/Aplicar (placeholder Fase 3)
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Receipt,
  FileText,
  History,
  Bolt,
  ArrowUp,
  ArrowDown,
  CircleDot,
  Coins,
  CircleDollarSign,
  Building,
  Users as UsersIcon,
  Truck,
  IdCard,
  CheckCircle2,
  Calendar,
  TrendingUp,
  Wallet,
  ArrowRightLeft,
  PartyPopper,
  Hourglass,
  Flag,
  Link2,
  CreditCard,
} from 'lucide-react';
import { cn } from '../../../design-system';
import { Button } from '../../../components/common';
import { useMovimientosCC } from '../../../hooks/useMovimientosCC';
import { MovimientoTesoreriaDrawer } from './MovimientoTesoreriaDrawer';
import {
  buildCuentaCorrienteId,
  esDebito,
  esCredito,
  TIPO_ENTIDAD_CC_LABELS,
  TIPO_MOVIMIENTO_CC_LABELS,
  type CuentaCorriente,
  type TipoEntidadCC,
  type MovimientoCC,
  type MonedaCC,
} from '../../../types/cuentaCorriente.types';

interface EntidadCCDetailModalProps {
  cc: CuentaCorriente;
  onClose: () => void;
  /** Click en CTA "Cobrar/Pagar/Aplicar" (Fase 3). */
  onAccionPrincipal?: () => void;
}

type TabActivo = 'extracto' | 'documentos' | 'historico' | 'acciones';

// ─── Helpers visuales ──────────────────────────────────────────────────

const ICONO_TIPO: Record<TipoEntidadCC, React.ComponentType<{ className?: string }>> = {
  cliente: UsersIcon,
  proveedor: Building,
  colaborador: Truck,
  empleado: IdCard,
  tarjeta_credito: CreditCard,
};

const COLOR_TIPO: Record<TipoEntidadCC, { badge: string }> = {
  cliente: { badge: 'bg-sky-100 text-sky-700 border-sky-200' },
  proveedor: { badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  colaborador: { badge: 'bg-purple-100 text-purple-700 border-purple-200' },
  empleado: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  tarjeta_credito: { badge: 'bg-rose-100 text-rose-700 border-rose-200' },
};

function fmt(monto: number, moneda: MonedaCC): string {
  const simbolo = moneda === 'USD' ? 'US$' : 'S/';
  const abs = Math.abs(monto).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (monto > 0.01) return `+${simbolo} ${abs}`;
  if (monto < -0.01) return `−${simbolo} ${abs}`;
  return `${simbolo} 0.00`;
}

function clasificarSaldoMoneda(saldo: number): {
  signo: 'positivo' | 'negativo' | 'cero';
  classes: { container: string; text: string; subtitulo: string };
  label: string;
} {
  if (Math.abs(saldo) < 0.01) {
    return {
      signo: 'cero',
      classes: {
        container: 'border border-slate-200 bg-white',
        text: 'text-slate-400',
        subtitulo: 'text-slate-400',
      },
      label: 'Sin saldo',
    };
  }
  if (saldo > 0) {
    return {
      signo: 'positivo',
      classes: {
        container: 'border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white',
        text: 'text-emerald-700',
        subtitulo: 'text-emerald-600',
      },
      label: 'Por cobrar',
    };
  }
  return {
    signo: 'negativo',
    classes: {
      container: 'border-2 border-red-200 bg-gradient-to-br from-red-50 to-white',
      text: 'text-red-700',
      subtitulo: 'text-red-600',
    },
    label: 'Por pagar',
  };
}

// ─── Componente ─────────────────────────────────────────────────────────

export const EntidadCCDetailModal: React.FC<EntidadCCDetailModalProps> = ({
  cc,
  onClose,
  onAccionPrincipal,
}) => {
  const [tab, setTab] = useState<TabActivo>('extracto');
  const [drawerTesoreriaId, setDrawerTesoreriaId] = useState<string | null>(null);
  const ccId = buildCuentaCorrienteId(cc.entidadId, cc.tipo);
  const { movimientos, loading: loadingMovs } = useMovimientosCC(ccId, { limit: 200 });

  // ESC para cerrar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const TipoIcon = ICONO_TIPO[cc.tipo];
  const tipoColor = COLOR_TIPO[cc.tipo];

  // ── Saldos ──
  const fmtPENClass = clasificarSaldoMoneda(cc.saldoPEN);
  const fmtUSDClass = clasificarSaldoMoneda(cc.saldoUSD);

  // ── KPIs derivados de movimientos ──
  const kpis = useMemo(() => {
    let totalDebitado = 0; // en moneda dominante
    let totalCreditado = 0;
    let monedaDominante: MonedaCC = 'PEN';
    if (Math.abs(cc.saldoUSD) > Math.abs(cc.saldoPEN)) monedaDominante = 'USD';

    let movMasAntiguo: MovimientoCC | null = null;
    let movMasReciente: MovimientoCC | null = null;
    let docsUnicos = new Set<string>();

    for (const m of movimientos) {
      if (m.moneda !== monedaDominante) continue;
      if (esDebito(m.tipo)) totalDebitado += m.monto;
      if (esCredito(m.tipo)) totalCreditado += m.monto;
      if (!movMasAntiguo || m.fecha.toMillis() < movMasAntiguo.fecha.toMillis()) {
        movMasAntiguo = m;
      }
      if (!movMasReciente || m.fecha.toMillis() > movMasReciente.fecha.toMillis()) {
        movMasReciente = m;
      }
      if (m.refDocumentoId) docsUnicos.add(m.refDocumentoId);
    }

    const diasAntiguo = movMasAntiguo
      ? Math.floor((Date.now() - movMasAntiguo.fecha.toMillis()) / (1000 * 60 * 60 * 24))
      : 0;
    const diasReciente = movMasReciente
      ? Math.floor((Date.now() - movMasReciente.fecha.toMillis()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      monedaDominante,
      totalDebitado,
      totalCreditado,
      diasAntiguo,
      diasReciente,
      docsUnicos: docsUnicos.size,
      movMasAntiguo,
      movMasReciente,
    };
  }, [movimientos, cc.saldoUSD, cc.saldoPEN]);

  // ── Pipeline: 4 etapas contextuales ──
  const pipelineEtapas = useMemo(() => {
    const tieneMovs = movimientos.length > 0;
    const tieneSaldo = Math.abs(cc.saldoPEN) > 0.01 || Math.abs(cc.saldoUSD) > 0.01;
    const algunaTransaccion = movimientos.some((m) => esDebito(m.tipo));
    const algunPago = movimientos.some((m) => esCredito(m.tipo));
    const saldada = !tieneSaldo && tieneMovs;

    return [
      {
        label: 'Cuenta abierta',
        icon: PartyPopper,
        completado: tieneMovs,
        sublabel: cc.fechaCreacion
          ? cc.fechaCreacion.toDate().toLocaleDateString('es-PE', { month: 'short', year: 'numeric' })
          : '—',
      },
      {
        label: 'Transacciones',
        icon: ArrowRightLeft,
        completado: algunaTransaccion,
        sublabel: `${movimientos.filter((m) => esDebito(m.tipo)).length} débitos`,
      },
      {
        label: 'Pagos',
        icon: CircleDollarSign,
        completado: algunPago,
        activo: tieneSaldo,
        sublabel: `${movimientos.filter((m) => esCredito(m.tipo)).length} créditos`,
      },
      {
        label: 'Saldada',
        icon: Flag,
        completado: saldada,
        sublabel: saldada ? 'Sin saldo pendiente' : 'Pendiente',
      },
    ];
  }, [movimientos, cc.saldoPEN, cc.saldoUSD, cc.fechaCreacion]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header (sticky · breadcrumb + close) ─────────────────────── */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Coins className="w-4 h-4 text-teal-600 flex-shrink-0" />
            <span className="font-semibold text-slate-900">Cuenta corriente</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-700 truncate">{cc.entidadNombre}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={`/tesoreria?entidadId=${encodeURIComponent(cc.entidadId)}&entidadTipo=${cc.tipo}&entidadNombre=${encodeURIComponent(cc.entidadNombre)}`}
              className="text-[11px] px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-medium flex items-center gap-1.5 transition"
              title="Ver los movimientos de tesorería vinculados a esta entidad"
            >
              <ArrowRightLeft className="w-3 h-3" />
              Ver en Cash flow
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── Hero ──────────────────────────────────────────────────────── */}
        <div className="p-6">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <TipoIcon className="w-3 h-3" />
              <span>{TIPO_ENTIDAD_CC_LABELS[cc.tipo]}</span>
              {cc.fechaCreacion && (
                <>
                  <span>·</span>
                  <span>
                    Activa desde{' '}
                    {cc.fechaCreacion.toDate().toLocaleDateString('es-PE', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-900">{cc.entidadNombre}</h2>
              <div className="text-xs text-slate-500 mt-0.5">
                ID: <span className="font-mono">{cc.entidadId.slice(0, 18)}{cc.entidadId.length > 18 ? '…' : ''}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span
                className={cn(
                  'text-[11px] px-2 py-0.5 rounded-full font-medium border',
                  tipoColor.badge,
                )}
              >
                <TipoIcon className="w-3 h-3 inline mr-0.5" />
                {TIPO_ENTIDAD_CC_LABELS[cc.tipo]}
              </span>
              {(fmtPENClass.signo !== 'cero' || fmtUSDClass.signo !== 'cero') && (
                <span
                  className={cn(
                    'text-[11px] px-2 py-0.5 rounded-full font-medium border',
                    fmtPENClass.signo === 'positivo' || fmtUSDClass.signo === 'positivo'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200',
                  )}
                >
                  {fmtPENClass.signo === 'positivo' || fmtUSDClass.signo === 'positivo'
                    ? 'Saldo a favor (nos deben)'
                    : 'Saldo en contra (les debemos)'}
                </span>
              )}
            </div>
          </div>

          {/* Saldos hero PEN + USD */}
          <div className="grid grid-cols-2 gap-3">
            <div className={cn('rounded-xl p-4', fmtPENClass.classes.container)}>
              <div className={cn('text-[10px] uppercase tracking-wider font-semibold mb-1', fmtPENClass.classes.subtitulo)}>
                Saldo PEN
              </div>
              <div className={cn('text-3xl font-bold tabular-nums', fmtPENClass.classes.text)}>
                {fmt(cc.saldoPEN, 'PEN')}
              </div>
              <div className={cn('text-[11px] mt-1', fmtPENClass.classes.subtitulo)}>
                {fmtPENClass.label}
              </div>
            </div>
            <div className={cn('rounded-xl p-4', fmtUSDClass.classes.container)}>
              <div className={cn('text-[10px] uppercase tracking-wider font-semibold mb-1', fmtUSDClass.classes.subtitulo)}>
                Saldo USD
              </div>
              <div className={cn('text-3xl font-bold tabular-nums', fmtUSDClass.classes.text)}>
                {fmt(cc.saldoUSD, 'USD')}
              </div>
              <div className={cn('text-[11px] mt-1', fmtUSDClass.classes.subtitulo)}>
                {fmtUSDClass.label}
              </div>
            </div>
          </div>

          {/* Pipeline contextual */}
          <div className="mt-5 bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="grid grid-cols-4 gap-2 items-center relative">
              <div className="absolute left-[12.5%] right-[12.5%] top-5 h-0.5 bg-slate-200 -z-0" />
              {pipelineEtapas.map((etapa, idx) => {
                const Icon = etapa.icon;
                const colorBg = etapa.completado
                  ? 'bg-emerald-500 text-white'
                  : etapa.activo
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-200 text-slate-400';
                return (
                  <div key={idx} className="text-center relative z-10">
                    <div
                      className={cn(
                        'w-10 h-10 mx-auto rounded-full flex items-center justify-center border-4 border-white',
                        colorBg,
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div
                      className={cn(
                        'text-xs font-semibold mt-1.5',
                        !etapa.completado && !etapa.activo && 'text-slate-400',
                      )}
                    >
                      {etapa.label}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{etapa.sublabel}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4 KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="text-[10px] uppercase text-slate-500 font-semibold mb-0.5">
                Total movimientos
              </div>
              <div className="text-base font-bold text-slate-900 tabular-nums">
                {cc.cantidadMovimientos}
              </div>
              <div className="text-[10px] text-slate-500">
                Histórico completo
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="text-[10px] uppercase text-slate-500 font-semibold mb-0.5">
                Total débitos
              </div>
              <div className="text-base font-bold text-emerald-700 tabular-nums">
                {fmt(kpis.totalDebitado, kpis.monedaDominante)}
              </div>
              <div className="text-[10px] text-slate-500">
                {kpis.monedaDominante} acumulado
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="text-[10px] uppercase text-slate-500 font-semibold mb-0.5">
                Total créditos
              </div>
              <div className="text-base font-bold text-red-700 tabular-nums">
                {fmt(-kpis.totalCreditado, kpis.monedaDominante)}
              </div>
              <div className="text-[10px] text-slate-500">
                {kpis.monedaDominante} acumulado
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="text-[10px] uppercase text-slate-500 font-semibold mb-0.5">
                Última actividad
              </div>
              <div className="text-base font-bold text-slate-900 tabular-nums">
                {kpis.movMasReciente
                  ? kpis.diasReciente === 0
                    ? 'Hoy'
                    : `Hace ${kpis.diasReciente}d`
                  : '—'}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {kpis.movMasReciente
                  ? TIPO_MOVIMIENTO_CC_LABELS[kpis.movMasReciente.tipo]
                  : 'Sin movimientos'}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Tabs sticky ─────────────────────────────────────────────── */}
        <div className="sticky top-12 bg-white border-y border-slate-200 z-[15]">
          <div className="px-6 flex items-center gap-1 overflow-x-auto">
            <TabButton
              active={tab === 'extracto'}
              onClick={() => setTab('extracto')}
              icon={Receipt}
              label="Extracto"
              count={movimientos.length}
            />
            <TabButton
              active={tab === 'documentos'}
              onClick={() => setTab('documentos')}
              icon={FileText}
              label="Documentos"
              count={kpis.docsUnicos}
            />
            <TabButton
              active={tab === 'historico'}
              onClick={() => setTab('historico')}
              icon={History}
              label="Histórico pagos"
            />
            <TabButton
              active={tab === 'acciones'}
              onClick={() => setTab('acciones')}
              icon={Bolt}
              label="Acciones"
            />

            <div className="ml-auto flex items-center gap-2 py-2.5 flex-shrink-0">
              {onAccionPrincipal &&
                (Math.abs(cc.saldoPEN) > 0.01 || Math.abs(cc.saldoUSD) > 0.01) && (
                  <Button
                    variant={
                      cc.saldoPEN < 0 || cc.saldoUSD < 0 ? 'danger' : 'primary'
                    }
                    size="sm"
                    onClick={onAccionPrincipal}
                  >
                    <CircleDollarSign className="w-4 h-4 mr-1.5" />
                    {cc.saldoPEN < 0 || cc.saldoUSD < 0
                      ? 'Registrar pago'
                      : 'Registrar cobro'}
                  </Button>
                )}
            </div>
          </div>
        </div>

        {/* ─── Contenido del tab ──────────────────────────────────────── */}
        <div className="px-6 py-5">
          {tab === 'extracto' && (
            <ExtractoTab
              movimientos={movimientos}
              loading={loadingMovs}
              onAbrirTesoreria={(id) => setDrawerTesoreriaId(id)}
            />
          )}
          {tab === 'documentos' && (
            <DocumentosTab movimientos={movimientos} loading={loadingMovs} />
          )}
          {tab === 'historico' && (
            <HistoricoTab movimientos={movimientos} loading={loadingMovs} />
          )}
          {tab === 'acciones' && <AccionesTab cc={cc} />}
        </div>
      </div>

      {/* Drawer Tesorería superpuesto al modal */}
      {drawerTesoreriaId && (
        <MovimientoTesoreriaDrawer
          movimientoId={drawerTesoreriaId}
          onClose={() => setDrawerTesoreriaId(null)}
        />
      )}
    </div>
  );
};

// ─── Sub-componentes ───────────────────────────────────────────────────

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
}> = ({ active, onClick, icon: Icon, label, count }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'text-[12px] px-3 py-2.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors',
      active
        ? 'border-teal-600 text-teal-700 font-semibold'
        : 'border-transparent text-slate-500 hover:text-slate-700',
    )}
  >
    <Icon className="w-3.5 h-3.5" />
    {label}
    {count !== undefined && (
      <span
        className={cn(
          'text-[10px] px-1.5 py-0.5 rounded',
          active ? 'bg-teal-100' : 'bg-slate-100',
        )}
      >
        {count}
      </span>
    )}
  </button>
);

// ── Tab: Extracto ──
const ExtractoTab: React.FC<{
  movimientos: MovimientoCC[];
  loading: boolean;
  onAbrirTesoreria?: (movimientoTesoreriaId: string) => void;
}> = ({ movimientos, loading, onAbrirTesoreria }) => {
  const [filtroMoneda, setFiltroMoneda] = useState<'todas' | MonedaCC>('todas');

  const movsFiltrados = useMemo(() => {
    if (filtroMoneda === 'todas') return movimientos;
    return movimientos.filter((m) => m.moneda === filtroMoneda);
  }, [movimientos, filtroMoneda]);

  if (loading) {
    return <div className="text-center py-8 text-sm text-slate-400 italic">Cargando movimientos...</div>;
  }

  if (movsFiltrados.length === 0) {
    return (
      <div className="text-center py-12">
        <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <div className="text-sm text-slate-500">
          {movimientos.length === 0
            ? 'Esta cuenta corriente aún no tiene movimientos registrados.'
            : 'No hay movimientos en esta moneda.'}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex bg-slate-100 rounded-md p-0.5">
          {(['todas', 'PEN', 'USD'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setFiltroMoneda(m)}
              className={cn(
                'px-2.5 py-1 text-[11px] rounded transition-colors',
                filtroMoneda === m
                  ? 'bg-white text-slate-900 shadow-sm font-medium'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {m === 'todas' ? 'Todas' : m}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-slate-500">
          {movsFiltrados.length} movimiento{movsFiltrados.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-600">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold">Fecha</th>
              <th className="text-left px-3 py-2.5 font-semibold">Concepto</th>
              <th className="text-left px-3 py-2.5 font-semibold">Doc</th>
              <th className="text-right px-3 py-2.5 font-semibold">Débito</th>
              <th className="text-right px-3 py-2.5 font-semibold">Crédito</th>
              <th className="text-right px-3 py-2.5 font-semibold">Saldo</th>
              <th className="text-center px-3 py-2.5 font-semibold w-12">Cash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {movsFiltrados.map((mov) => {
              const isDebito = esDebito(mov.tipo);
              const isCredito = esCredito(mov.tipo);
              const saldoPost = mov.moneda === 'USD' ? mov.saldoUSDDespues : mov.saldoPENDespues;
              const saldoColor =
                Math.abs(saldoPost) < 0.01
                  ? 'text-slate-500'
                  : saldoPost > 0
                    ? 'text-emerald-700'
                    : 'text-red-700';
              return (
                <tr key={mov.id} className="hover:bg-slate-50/50">
                  <td className="px-3 py-2.5 text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                    {mov.fecha.toDate().toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                          isDebito
                            ? 'bg-emerald-100 text-emerald-700'
                            : isCredito
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700',
                        )}
                      >
                        {isDebito ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : isCredito ? (
                          <ArrowDown className="w-3 h-3" />
                        ) : (
                          <CircleDot className="w-3 h-3" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] text-slate-900">
                          {TIPO_MOVIMIENTO_CC_LABELS[mov.tipo]}
                        </div>
                        {mov.descripcion && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[280px]">
                            {mov.descripcion}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-700 font-mono whitespace-nowrap">
                    {mov.refDocumentoNumero || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] tabular-nums whitespace-nowrap">
                    {isDebito ? (
                      <span className="text-emerald-700 font-medium">
                        {fmt(mov.monto, mov.moneda).replace('+', '')}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] tabular-nums whitespace-nowrap">
                    {isCredito ? (
                      <span className="text-red-600 font-medium">
                        {fmt(mov.monto, mov.moneda).replace('+', '')}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2.5 text-right text-[12px] font-bold tabular-nums whitespace-nowrap',
                      saldoColor,
                    )}
                  >
                    {fmt(saldoPost, mov.moneda)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {mov.movimientoTesoreriaId && onAbrirTesoreria ? (
                      <button
                        type="button"
                        onClick={() => onAbrirTesoreria(mov.movimientoTesoreriaId!)}
                        className="inline-flex items-center justify-center w-6 h-6 rounded text-purple-600 hover:bg-purple-50 hover:text-purple-700 transition"
                        title="Ver movimiento de tesorería vinculado"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-slate-300 text-[10px]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-slate-400 italic mt-3 px-2">
        <span className="text-emerald-700 font-medium">Débito</span> = la entidad nos debe más ·{' '}
        <span className="text-red-700 font-medium">Crédito</span> = saldamos / nos pagan ·{' '}
        Saldo se calcula post-movimiento ·{' '}
        <Link2 className="inline w-3 h-3 text-purple-600" /> abre el movimiento de tesorería vinculado.
      </div>
    </div>
  );
};

// ── Tab: Documentos (vista por documento) ──
const DocumentosTab: React.FC<{ movimientos: MovimientoCC[]; loading: boolean }> = ({
  movimientos,
  loading,
}) => {
  // Agrupar movimientos por refDocumentoId
  const docsAgrupados = useMemo(() => {
    const map = new Map<
      string,
      {
        docId: string;
        docNumero: string;
        docTipo: string;
        movs: MovimientoCC[];
        debitos: number;
        creditos: number;
        moneda: MonedaCC;
        ultimoMov: MovimientoCC;
      }
    >();
    for (const m of movimientos) {
      if (!m.refDocumentoId) continue;
      const k = m.refDocumentoId;
      const existing = map.get(k);
      if (existing) {
        existing.movs.push(m);
        if (esDebito(m.tipo)) existing.debitos += m.monto;
        if (esCredito(m.tipo)) existing.creditos += m.monto;
        if (m.fecha.toMillis() > existing.ultimoMov.fecha.toMillis()) {
          existing.ultimoMov = m;
        }
      } else {
        map.set(k, {
          docId: k,
          docNumero: m.refDocumentoNumero || k.slice(0, 12),
          docTipo: m.refDocumentoTipo || 'doc',
          movs: [m],
          debitos: esDebito(m.tipo) ? m.monto : 0,
          creditos: esCredito(m.tipo) ? m.monto : 0,
          moneda: m.moneda,
          ultimoMov: m,
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.ultimoMov.fecha.toMillis() - a.ultimoMov.fecha.toMillis(),
    );
  }, [movimientos]);

  if (loading) {
    return <div className="text-center py-8 text-sm text-slate-400 italic">Cargando documentos...</div>;
  }

  if (docsAgrupados.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <div className="text-sm text-slate-500">
          Aún no hay documentos asociados a esta cuenta corriente.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-[11px] text-slate-500 mb-3">
        {docsAgrupados.length} documento{docsAgrupados.length !== 1 ? 's' : ''} con movimientos
      </div>
      <div className="space-y-2">
        {docsAgrupados.map((d) => {
          const pendiente = d.debitos - d.creditos;
          const porcentajePagado = d.debitos > 0 ? (d.creditos / d.debitos) * 100 : 0;
          const saldado = Math.abs(pendiente) < 0.01;
          const containerCls = saldado
            ? 'border border-slate-200 opacity-70'
            : pendiente > 0
              ? 'border border-amber-200 bg-amber-50/30'
              : 'border border-emerald-200 bg-emerald-50/30';

          return (
            <div
              key={d.docId}
              className={cn(
                'rounded-lg p-3 hover:shadow-sm transition cursor-pointer',
                containerCls,
              )}
            >
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-1">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-md flex items-center justify-center',
                      saldado
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-700',
                    )}
                  >
                    {saldado ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Receipt className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>
                <div className="col-span-3">
                  <div className="font-mono text-sm font-bold text-slate-900">{d.docNumero}</div>
                  <div className="text-[10px] text-slate-500 capitalize">
                    {d.docTipo} · {d.movs.length} mov{d.movs.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="col-span-2">
                  {saldado ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Saldado
                    </span>
                  ) : pendiente > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                      <Hourglass className="w-2.5 h-2.5" /> Por cobrar
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Saldo a favor
                    </span>
                  )}
                </div>
                <div className="col-span-3 text-[11px] text-slate-600">
                  <div>
                    Total:{' '}
                    <span className="tabular-nums font-medium text-slate-900">
                      {fmt(d.debitos, d.moneda).replace('+', '')}
                    </span>
                  </div>
                  <div>
                    Pagado:{' '}
                    <span className="tabular-nums text-emerald-700">
                      {fmt(d.creditos, d.moneda).replace('+', '')}
                    </span>
                  </div>
                </div>
                <div className="col-span-3 text-right">
                  <div className="text-[10px] text-slate-400 uppercase">Pendiente</div>
                  <div
                    className={cn(
                      'text-base font-bold tabular-nums',
                      saldado ? 'text-slate-500' : pendiente > 0 ? 'text-amber-700' : 'text-emerald-700',
                    )}
                  >
                    {fmt(pendiente, d.moneda)}
                  </div>
                  <div className="h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all',
                        saldado ? 'bg-emerald-500' : porcentajePagado > 0 ? 'bg-amber-500' : 'bg-slate-300',
                      )}
                      style={{ width: `${Math.min(100, porcentajePagado)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Tab: Histórico (créditos = pagos pasados) ──
const HistoricoTab: React.FC<{ movimientos: MovimientoCC[]; loading: boolean }> = ({
  movimientos,
  loading,
}) => {
  const pagos = useMemo(
    () => movimientos.filter((m) => esCredito(m.tipo) && m.movimientoTesoreriaId),
    [movimientos],
  );

  if (loading) {
    return <div className="text-center py-8 text-sm text-slate-400 italic">Cargando histórico...</div>;
  }

  if (pagos.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <div className="text-sm text-slate-500">
          Aún no se han registrado pagos vinculados a esta cuenta.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-[11px] text-slate-500 mb-3">
        {pagos.length} pago{pagos.length !== 1 ? 's' : ''} registrado{pagos.length !== 1 ? 's' : ''}
      </div>
      <div className="space-y-2">
        {pagos.map((p) => (
          <div
            key={p.id}
            className="border border-slate-200 rounded-lg p-3 flex items-center gap-3 hover:bg-slate-50/50"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <CircleDollarSign className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900 text-sm truncate">
                {p.descripcion || TIPO_MOVIMIENTO_CC_LABELS[p.tipo]}
              </div>
              <div className="text-[11px] text-slate-500">
                {p.fecha.toDate().toLocaleDateString('es-PE', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
                {p.refDocumentoNumero && (
                  <>
                    {' · '}
                    <span className="font-mono">{p.refDocumentoNumero}</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-base font-bold text-emerald-700 tabular-nums">
                {fmt(p.monto, p.moneda).replace('+', '')}
              </div>
              <div className="text-[10px] text-slate-500">
                Vía tesorería
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Tab: Acciones (placeholder Fase 3) ──
const AccionesTab: React.FC<{ cc: CuentaCorriente }> = ({ cc }) => {
  const tieneSaldo = Math.abs(cc.saldoPEN) > 0.01 || Math.abs(cc.saldoUSD) > 0.01;
  return (
    <div className="space-y-3">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <Bolt className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <div className="font-semibold">Acciones rápidas (Fase 3 · próxima sesión)</div>
          <div className="text-[12px] mt-1">
            Aquí se conectará el <code className="text-[11px] bg-white px-1 rounded">PagoUnificadoForm</code>{' '}
            existente para registrar pagos/cobros desde la cuenta corriente sin navegar a otras páginas.
          </div>
        </div>
      </div>

      {tieneSaldo && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            disabled
            className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-3 text-left opacity-60 cursor-not-allowed"
          >
            <div className="flex items-center gap-2 mb-1">
              <CircleDollarSign className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-900">Cobrar</span>
            </div>
            <div className="text-[11px] text-emerald-700">
              Si la entidad nos debe → registrar pago recibido
            </div>
          </button>
          <button
            type="button"
            disabled
            className="border border-red-200 bg-red-50/40 rounded-lg p-3 text-left opacity-60 cursor-not-allowed"
          >
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-red-600" />
              <span className="text-sm font-semibold text-red-900">Pagar</span>
            </div>
            <div className="text-[11px] text-red-700">
              Si le debemos → registrar pago realizado
            </div>
          </button>
          <button
            type="button"
            disabled
            className="border border-purple-200 bg-purple-50/40 rounded-lg p-3 text-left opacity-60 cursor-not-allowed"
          >
            <div className="flex items-center gap-2 mb-1">
              <ArrowRightLeft className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-900">Aplicar saldo</span>
            </div>
            <div className="text-[11px] text-purple-700">
              Aplicar saldo a favor a documento futuro
            </div>
          </button>
        </div>
      )}

      <div className="border border-slate-200 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Ajuste manual</span>
        </div>
        <div className="text-[11px] text-slate-600">
          Para correcciones contables justificadas (motivo obligatorio). Disponible en Fase 3.
        </div>
      </div>
    </div>
  );
};
