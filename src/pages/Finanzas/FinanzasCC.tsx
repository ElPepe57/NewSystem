/**
 * FinanzasCC — chk5.D-S3.bis · SF6
 *
 * Sub-vista canon `/finanzas/cc` · pixel-perfect MOCK 8.
 * Vista relacional por entidad (CxC + CxP + colaboradores + empleados + TC).
 *
 * Override del shell adaptativo (S3.SF1):
 *   - breadcrumb leaf: "Cuentas Corrientes"
 *   - header: icon Users indigo + "Cuentas Corrientes" + subtitle
 *   - actions: [Aging Excel · Enviar recordatorios · Registrar cobro/pago] + dropdown
 *   - kpiSlot: 5 KPIs CC propios (CxC · CxP · Saldo neto · Aging crítico · Top deudor)
 *
 * Conecta:
 *   - useFinanzasShellContext() → cuentas + tcpaActual (via miniStats)
 *   - cuentaCorrienteService.getAll() → todas las CC
 *   - filtros client-side (busqueda · tipo entidad · aging · soloConSaldo)
 *   - DrawerCCEntidadCanonico al click row
 *   - PagoAbonoWizard al CTA Registrar cobro/pago
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  Download,
  Mail,
  AlertCircle,
} from 'lucide-react';
import { useFinanzasShellContext } from './FinanzasLayout';
import { cuentaCorrienteService } from '../../services/cuentaCorriente.service';
import type {
  CuentaCorriente,
  TipoEntidadCC,
} from '../../types/cuentaCorriente.types';
import {
  agruparPorTipoEntidad,
  calcularSubtotalGrupo,
  calcularKPIsCC,
  diasDesde,
  tieneSaldoCero,
  TIPO_ENTIDAD_BADGE,
} from './components/cc/ccHelpers';
import {
  EntidadCCCardCanonico,
  type EntidadCCBadge,
} from './components/cc/EntidadCCCardCanonico';
import { GrupoEntidadHeader } from './components/cc/GrupoEntidadHeader';
import {
  FiltrosCCBar,
  defaultFiltrosCC,
  contarFiltrosCCActivos,
  type FiltrosCCState,
} from './components/cc/FiltrosCCBar';
import { DrawerCCEntidadCanonico } from './components/cc/DrawerCCEntidadCanonico';
import { PagoAbonoWizard } from './components/PagoAbonoWizard';
import { useToastStore } from '../../store/toastStore';

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

const fmt0 = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

const FinanzasCC: React.FC = () => {
  const { miniStats, setSubVistaConfig, onSeleccionarAccion } = useFinanzasShellContext();
  const toastInfo = useToastStore((s) => s.info);

  // Estado local
  const [ccs, setCCs] = useState<CuentaCorriente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosCCState>(defaultFiltrosCC);
  const [ccSeleccionada, setCCSeleccionada] = useState<CuentaCorriente | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardEntidad, setWizardEntidad] = useState<{
    entidadId: string;
    entidadTipo: CuentaCorriente['tipo'];
    entidadNombre: string;
    saldoUSD: number;
    saldoPEN: number;
  } | null>(null);

  // TCPA actual desde el shell · para equivalentes PEN
  const tcpaActual = miniStats?.tcpa ?? 0;

  // Fetch CC
  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    cuentaCorrienteService
      .getAll()
      .then((lista) => setCCs(lista))
      .catch((err) => setError(err?.message ?? 'Error cargando CC'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ─── Aplicar filtros client-side ─────────────────────────────────────
  const ccsFiltradas = useMemo(() => {
    const q = filtros.busqueda.trim().toLowerCase();
    return ccs.filter((cc) => {
      // Solo con saldo
      if (filtros.soloConSaldo && tieneSaldoCero(cc)) return false;

      // Tipo entidad
      if (filtros.tipoEntidad !== 'todas' && cc.tipo !== filtros.tipoEntidad) {
        return false;
      }

      // Aging filter · heurístico basado en fechaUltimoMovimiento
      if (filtros.aging !== 'todos') {
        const dias = diasDesde(cc.fechaUltimoMovimiento);
        if (filtros.aging === 'd0_30' && dias > 30) return false;
        if (filtros.aging === 'd31_60' && (dias <= 30 || dias > 60)) return false;
        if (filtros.aging === 'd60_plus' && dias <= 60) return false;
      }

      // Búsqueda · matchea nombre · ID
      if (q) {
        const haystack = `${cc.entidadNombre} ${cc.entidadId} ${cc.id}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [ccs, filtros]);

  // ─── Agrupar por tipo de entidad ─────────────────────────────────────
  const grupos = useMemo(
    () => agruparPorTipoEntidad(ccsFiltradas, false),
    [ccsFiltradas],
  );

  // ─── KPIs CC canon MOCK 8 ────────────────────────────────────────────
  const kpis = useMemo(() => calcularKPIsCC(ccs, tcpaActual), [ccs, tcpaActual]);

  // ─── Handlers ────────────────────────────────────────────────────────
  const handleLimpiar = useCallback(() => {
    setFiltros(defaultFiltrosCC());
  }, []);

  // chk5.D-S8.SF3.D2 · placeholders honestos: toast info en vez de console.info silencioso.
  const handleAgingExcel = useCallback(() => {
    toastInfo(
      `Export aging detallado Excel (${ccsFiltradas.length} entidades) llegará en chk5.D-S9.`,
      'Próximamente',
    );
  }, [toastInfo, ccsFiltradas.length]);

  const handleEnviarRecordatorios = useCallback(() => {
    toastInfo(
      'Envío masivo de recordatorios (email/WhatsApp) por aging llegará en chk5.D-S9. Conecta con el módulo de Comunicaciones.',
      'Próximamente',
    );
  }, [toastInfo]);

  const abrirWizardCobroPago = useCallback((cc?: CuentaCorriente) => {
    setWizardEntidad(
      cc
        ? {
            entidadId: cc.entidadId,
            entidadTipo: cc.tipo,
            entidadNombre: cc.entidadNombre,
            saldoUSD: cc.saldoUSD,
            saldoPEN: cc.saldoPEN,
          }
        : null,
    );
    setWizardOpen(true);
  }, []);

  // ─── Resolver badges contextuales por CC ─────────────────────────────
  const resolverBadges = useCallback(
    (cc: CuentaCorriente): EntidadCCBadge[] => {
      const badges: EntidadCCBadge[] = [];
      // Top deudor · sólo el primer cliente
      if (kpis.topDeudor && cc.id === kpis.topDeudor.id) {
        badges.push({ label: 'Top deudor', color: 'emerald' });
      }
      // USD · cuando tiene saldoUSD significativo
      if (Math.abs(cc.saldoUSD || 0) > 0.01) {
        badges.push({ label: 'USD', color: 'blue' });
      }
      // Aging crítico · vencido +60d
      const dias = diasDesde(cc.fechaUltimoMovimiento);
      if (dias > 60 && !tieneSaldoCero(cc)) {
        badges.push({ label: `+${dias}d sin mov`, color: 'rose' });
      }
      // Tarjeta de crédito · badge específico
      if (cc.tipo === 'tarjeta_credito') {
        badges.push({ label: 'TC', color: 'amber' });
      }
      return badges;
    },
    [kpis.topDeudor],
  );

  // ─── Resolver meta string por CC ─────────────────────────────────────
  const resolverMeta = useCallback((cc: CuentaCorriente): string => {
    const partes: string[] = [];
    if (cc.cantidadMovimientos > 0) {
      partes.push(`${cc.cantidadMovimientos} ${cc.cantidadMovimientos === 1 ? 'movimiento' : 'movimientos'}`);
    }
    if (cc.fechaUltimoMovimiento) {
      const dias = diasDesde(cc.fechaUltimoMovimiento);
      partes.push(`último: ${dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias}d`}`);
    }
    return partes.join(' · ') || 'CC sin movimientos aún';
  }, []);

  // ─── Resolver estado label por CC ────────────────────────────────────
  const resolverEstado = useCallback(
    (cc: CuentaCorriente): { label: string; color: 'emerald' | 'rose' | 'amber' | 'purple' | 'slate' } => {
      if (tieneSaldoCero(cc)) return { label: 'Saldado', color: 'slate' };
      const dias = diasDesde(cc.fechaUltimoMovimiento);
      if (dias > 60) return { label: `${dias}d sin mov ⚠️`, color: 'rose' };
      if (dias > 30) return { label: `${dias}d sin mov`, color: 'amber' };
      const pen = cc.saldoPEN || 0;
      const usd = cc.saldoUSD || 0;
      const positivo = pen > 0.01 || usd > 0.01;
      if (cc.tipo === 'cliente') return { label: positivo ? 'Al día' : 'Saldo a favor', color: 'emerald' };
      if (cc.tipo === 'proveedor') return { label: positivo ? 'Anticipo' : 'A pagar', color: 'rose' };
      if (cc.tipo === 'colaborador') return { label: 'Pendiente liquidar', color: 'purple' };
      if (cc.tipo === 'empleado') return { label: positivo ? 'A reembolsar' : 'Adelanto', color: 'indigo' === 'indigo' ? 'purple' : 'slate' };
      return { label: 'Pendiente', color: 'slate' };
    },
    [],
  );

  // ─── Setear sub-vista config en el shell ─────────────────────────────
  const kpiSlot = useMemo(() => {
    const saldoNetoColor = kpis.saldoNetoPEN >= 0 ? 'indigo' : 'rose';

    return (
      <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* KPI 1 · CxC total */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">
              CxC total
            </span>
            <Users className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">
            S/ {fmt0(kpis.cxcTotalPEN)}
            {kpis.cxcTotalUSD > 0.01 && (
              <span className="text-[11px] text-emerald-400 ml-1">
                + $ {fmt0(kpis.cxcTotalUSD)}
              </span>
            )}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">
            {kpis.cxcClientesCount} clientes · DSO {kpis.dsoDias}d
          </div>
        </div>

        {/* KPI 2 · CxP total */}
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">
              CxP total
            </span>
            <Users className="w-3.5 h-3.5 text-rose-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-rose-900">
            S/ {fmt0(kpis.cxpTotalPEN)}
            {kpis.cxpTotalUSD > 0.01 && (
              <span className="text-[11px] text-rose-400 ml-1">
                + $ {fmt0(kpis.cxpTotalUSD)}
              </span>
            )}
          </div>
          <div className="text-[11px] text-rose-700 mt-1">
            {kpis.cxpProveedoresCount} proveedores · DPO {kpis.dpoDias}d
          </div>
        </div>

        {/* KPI 3 · Saldo neto */}
        <div
          className={`bg-gradient-to-br ${
            saldoNetoColor === 'indigo'
              ? 'from-indigo-50 to-indigo-100/40 ring-indigo-200/50'
              : 'from-rose-50 to-rose-100/40 ring-rose-200/50'
          } ring-1 rounded-2xl p-4`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-[10px] uppercase tracking-wider font-bold ${
                saldoNetoColor === 'indigo' ? 'text-indigo-700' : 'text-rose-700'
              }`}
            >
              Saldo neto
            </span>
          </div>
          <div
            className={`text-2xl font-bold tabular-nums ${
              saldoNetoColor === 'indigo' ? 'text-indigo-900' : 'text-rose-900'
            }`}
          >
            {kpis.saldoNetoPEN >= 0 ? '+' : '−'}S/ {fmt0(Math.abs(kpis.saldoNetoPEN))}
          </div>
          <div
            className={`text-[11px] mt-1 ${
              saldoNetoColor === 'indigo' ? 'text-indigo-700' : 'text-rose-700'
            }`}
          >
            {kpis.saldoNetoPEN >= 0 ? 'CxC favorable' : 'CxP excede'}
          </div>
        </div>

        {/* KPI 4 · Aging crítico */}
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">
              Aging crítico
            </span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-rose-900">
            {kpis.agingCriticoCount} {kpis.agingCriticoCount === 1 ? 'doc' : 'docs'}
          </div>
          <div className="text-[11px] text-rose-700 mt-1 tabular-nums">
            +60d vencidos · S/ {fmt0(kpis.agingCriticoMonto)}
          </div>
        </div>

        {/* KPI 5 · Top deudor */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100/40 ring-1 ring-purple-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-purple-700 font-bold">
              Top deudor
            </span>
          </div>
          {kpis.topDeudor ? (
            <>
              <div className="text-base font-bold text-purple-900 truncate">
                {kpis.topDeudor.entidadNombre}
              </div>
              <div className="text-[11px] text-purple-700 mt-1 tabular-nums">
                {/* chk5.D-S6.SF3 · fix · incluir saldoUSD (antes ignorado) */}
                {(() => {
                  const penAbs = Math.abs(kpis.topDeudor.saldoPEN);
                  const usdAbs = Math.abs(kpis.topDeudor.saldoUSD);
                  if (penAbs > 0.01 && usdAbs > 0.01) {
                    return `S/ ${fmt0(penAbs)} + $ ${fmt0(usdAbs)} · ${kpis.topDeudorPctCxC}% CxC`;
                  }
                  if (usdAbs > 0.01) {
                    return `$ ${fmt0(usdAbs)} · ${kpis.topDeudorPctCxC}% CxC`;
                  }
                  return `S/ ${fmt0(penAbs)} · ${kpis.topDeudorPctCxC}% CxC`;
                })()}
              </div>
            </>
          ) : (
            <div className="text-[12px] text-purple-700 italic">Sin deudores</div>
          )}
        </div>
      </div>
    );
  }, [kpis]);

  const actionsCustom = useMemo(
    () => (
      <>
        <button
          type="button"
          onClick={handleAgingExcel}
          aria-label="Aging Excel"
          title="Exportar aging detallado a Excel"
          className="text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Download className="w-3 h-3" />
          <span className="hidden sm:inline">Aging Excel</span>
        </button>
        <button
          type="button"
          onClick={handleEnviarRecordatorios}
          aria-label="Recordatorios"
          title="Enviar recordatorios masivos"
          className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Mail className="w-3 h-3" />
          <span className="hidden sm:inline">Recordatorios</span>
        </button>
      </>
    ),
    [handleAgingExcel, handleEnviarRecordatorios],
  );

  useEffect(() => {
    setSubVistaConfig({
      breadcrumbLeaf: 'Cuentas Corrientes',
      header: {
        title: 'Cuentas Corrientes',
        subtitle:
          'Por cobrar (CxC) · Por pagar (CxP) · agrupado por tipo de entidad · drill por titular con sub-tabs',
        icon: Users,
        iconColor: 'indigo',
      },
      kpiSlot,
      actions: actionsCustom,
      actionsReplaceAll: false,
    });
  }, [setSubVistaConfig, kpiSlot, actionsCustom]);

  const activeCount = contarFiltrosCCActivos(filtros);

  // ─── Render grupo helper ────────────────────────────────────────────
  const renderGrupo = useCallback(
    (tipo: TipoEntidadCC, ccsGrupo: CuentaCorriente[]) => {
      if (ccsGrupo.length === 0) return null;
      const subt = calcularSubtotalGrupo(ccsGrupo, tcpaActual);
      const esCobrar = tipo === 'cliente';
      const esPagar = tipo === 'proveedor';
      const labelMonto = esCobrar
        ? `S/ ${fmt0(subt.totalPEN)} por cobrar`
        : esPagar
        ? `S/ ${fmt0(subt.totalPEN)} por pagar`
        : `S/ ${fmt0(subt.totalPEN)}${subt.totalUSD > 0.01 ? ` + $ ${fmt0(subt.totalUSD)}` : ''}`;
      const meta = esCobrar
        ? `DSO ${kpis.dsoDias}d`
        : esPagar
        ? `DPO ${kpis.dpoDias}d`
        : undefined;

      return (
        <div key={tipo}>
          <GrupoEntidadHeader
            tipo={tipo}
            count={ccsGrupo.length}
            subtotalLabel={labelMonto}
            meta={meta}
            badgeRol={TIPO_ENTIDAD_BADGE[tipo]}
          />
          <div className="divide-y divide-slate-100">
            {ccsGrupo.slice(0, 20).map((cc) => {
              const estado = resolverEstado(cc);
              const isTop = kpis.topDeudor?.id === cc.id;
              return (
                <EntidadCCCardCanonico
                  key={cc.id}
                  cc={cc}
                  badges={resolverBadges(cc)}
                  meta={resolverMeta(cc)}
                  estadoLabel={estado.label}
                  estadoColor={estado.color}
                  highlight={isTop}
                  onClick={() => setCCSeleccionada(cc)}
                />
              );
            })}
            {ccsGrupo.length > 20 && (
              <div className="px-6 py-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setFiltros({ ...filtros, tipoEntidad: tipo });
                  }}
                  className="text-[10px] text-slate-600 hover:underline"
                >
                  Ver {ccsGrupo.length - 20} {tipo} más →
                </button>
              </div>
            )}
          </div>
        </div>
      );
    },
    [filtros, kpis.topDeudor, kpis.dsoDias, kpis.dpoDias, tcpaActual, resolverBadges, resolverEstado, resolverMeta],
  );

  // ─── Renders condicionales ──────────────────────────────────────────
  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 ring-1 ring-rose-200 rounded-lg text-rose-900 text-[12px]">
          <AlertCircle className="w-4 h-4 text-rose-700" />
          <span>{error}</span>
          <button
            type="button"
            onClick={cargar}
            className="ml-2 text-[11px] font-bold text-rose-700 hover:underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <>
        <FiltrosCCBar
          state={filtros}
          onChange={setFiltros}
          activeCount={activeCount}
          onLimpiarTodo={handleLimpiar}
        />
        <div className="p-4 space-y-2">
          <div className="shimmer h-8 rounded" />
          <div className="shimmer h-12 rounded ml-3" />
          <div className="shimmer h-12 rounded ml-3" />
          <div className="shimmer h-8 rounded mt-3" />
          <div className="shimmer h-12 rounded ml-3" />
        </div>
      </>
    );
  }

  const algunGrupoConData =
    grupos.clientes.length +
      grupos.proveedores.length +
      grupos.colaboradores.length +
      grupos.empleados.length +
      grupos.tarjetasCredito.length >
    0;

  return (
    <>
      <FiltrosCCBar
        state={filtros}
        onChange={setFiltros}
        activeCount={activeCount}
        onLimpiarTodo={handleLimpiar}
      />

      {/* Listado agrupado por tipo de entidad */}
      <div className="divide-y divide-slate-200">
        {algunGrupoConData ? (
          <>
            {renderGrupo('cliente', grupos.clientes)}
            {renderGrupo('proveedor', grupos.proveedores)}
            {renderGrupo('colaborador', grupos.colaboradores)}
            {renderGrupo('empleado', grupos.empleados)}
            {renderGrupo('tarjeta_credito', grupos.tarjetasCredito)}
          </>
        ) : (
          <div className="p-8 text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
              <Users className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <div className="text-[14px] font-bold text-slate-900">
                {activeCount > 0
                  ? 'Sin CC para los filtros seleccionados'
                  : 'Aún no hay CC con entidades'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                {activeCount > 0
                  ? 'Ajustá los filtros o limpiá para ver todas las CC.'
                  : 'Las cuentas corrientes se crean automáticamente cuando registras una venta a cliente, una compra a proveedor o un pago a colaborador.'}
              </div>
            </div>
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={handleLimpiar}
                className="text-[11px] font-bold text-white bg-slate-700 hover:bg-slate-800 px-3 py-1.5 rounded-lg"
              >
                Limpiar filtros
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSeleccionarAccion('ingreso_simple')}
                className="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
              >
                Registrar primer movimiento
              </button>
            )}
          </div>
        )}
      </div>

      {/* Drawer detalle CC */}
      {ccSeleccionada && (
        <DrawerCCEntidadCanonico
          cc={ccSeleccionada}
          onClose={() => setCCSeleccionada(null)}
          onRegistrarCobro={() => {
            const cc = ccSeleccionada;
            setCCSeleccionada(null);
            abrirWizardCobroPago(cc);
          }}
          onEnviarRecordatorio={handleEnviarRecordatorios}
          onGenerarEstadoCuenta={handleAgingExcel}
        />
      )}

      {/* Wizard pago/cobro (legacy preservado) */}
      <PagoAbonoWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        entidadPreseleccionada={wizardEntidad ?? undefined}
        onSuccess={() => {
          cargar();
        }}
      />
    </>
  );
};

export default FinanzasCC;
