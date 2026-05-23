/**
 * FinanzasSaldos — chk5.D-S3.ter · SF6
 *
 * REEMPLAZO COMPLETO de la versión legacy (S57 Fase C).
 *
 * Sub-vista canon `/finanzas/saldos` · pixel-perfect MOCK 6.
 * Lista productos financieros físicos: cuentas bancarias · wallets digitales ·
 * tarjetas de crédito · tarjetas de débito · cajas efectivo · cajas recaudadoras.
 * Agrupado por titular (Empresa · Personal · Recaudador) con sub-grupo Pool USD
 * (D13 · vista agregada de cuentas USD físicas).
 *
 * IMPORTANTE: la versión legacy de esta página mostraba CC entidades · NO
 * productos financieros. Esa funcionalidad ahora vive en `/finanzas/cc` (S3.bis).
 * El cambio de comportamiento es intencional según mockup canon MOCK 6.
 *
 * Override del shell adaptativo (S3.SF1):
 *   - breadcrumb leaf: "Saldos"
 *   - header: icon Wallet emerald + "Saldos" + subtitle
 *   - actions: [Exportar · Conciliar bancos · Nueva cuenta] + dropdown
 *   - kpiSlot: 5 KPIs Saldos propios (Patrimonio · PEN · Pool USD · Deuda TC · Recaudadoras)
 *
 * Conecta:
 *   - useFinanzasShellContext() → cuentas + tcpaActual
 *   - tarjetaCreditoService.getAll() → tarjetas
 *   - getProductosFinancierosActivos() → cajas recaudadoras
 *   - cajaRecaudadoraService.calcularBalanceMes() → saldos pendientes
 *   - DrawerProductoFinanciero al click row
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  Download,
  RefreshCw,
  AlertTriangle,
  Building2,
  Smartphone,
  CreditCard,
  Banknote,
  Truck,
  Plus,
} from 'lucide-react';
import { useFinanzasShellContext } from './FinanzasLayout';
import { tarjetaCreditoService } from '../../services/tarjetaCredito.service';
import { tesoreriaService } from '../../services/tesoreria.service';
import { getProductosFinancierosActivos } from '../../services/productoFinanciero.service';
import { cajaRecaudadoraService } from '../../services/cajaRecaudadora.service';
import type { TarjetaCredito } from '../../types/tarjetaCredito.types';
import type { ProductoFinanciero } from '../../types/productoFinanciero.types';
import type { CuentaCaja, CuentaCajaFormData } from '../../types/tesoreria.types';
import { CuentaWizard } from './components/wizards/CuentaWizard/CuentaWizard';
import { VerificarSaldoModal } from './components/saldos/VerificarSaldoModal';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { exportToCsv, fmtMontoCsv } from '../../utils/csvExport';
import {
  ProductoFinancieroRow,
  type ProductoFinancieroBadge,
} from './components/saldos/ProductoFinancieroRow';
import { GrupoTitularHeader, SubGrupoPoolUSDHeader, GrupoGenericoHeader } from './components/saldos/GruposHeaders';
import {
  FiltrosSaldosBar,
  ToolbarAgruparSaldos,
  type VistaSaldos,
} from './components/saldos/FiltrosSaldosBar';
import { DrawerProductoFinanciero } from './components/saldos/DrawerProductoFinanciero';
import {
  wrapCuentaCaja,
  wrapTarjetaCredito,
  wrapCajaRecaudadora,
  aplicarFiltrosSaldos,
  contarFiltrosSaldosActivos,
  defaultFiltrosSaldos,
  agruparPorTitular,
  agruparPorTipo,
  agruparPorMoneda,
  agruparPorBanco,
  calcularKPIsSaldos,
  extraerCuentasPoolUSD,
  kindFinalDe,
  monedaPrincipalDe,
  esBiMonedaDe,
  titularGrupoDe,
  saldoUSDDe,
  nombreDe,
  type ProductoFinancieroUnif,
  type FiltrosSaldosState,
  type GrupoSaldos,
} from './components/saldos/saldosHelpers';

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

const fmt0 = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════

const FinanzasSaldos: React.FC = () => {
  const navigate = useNavigate();
  const { cuentas, miniStats, setSubVistaConfig, onSeleccionarAccion } =
    useFinanzasShellContext();
  const tcpaActual = miniStats?.tcpa ?? 0;

  // Estado local · fetch extra (tarjetas + recaudadoras)
  const [tarjetas, setTarjetas] = useState<TarjetaCredito[]>([]);
  const [recaudadoras, setRecaudadoras] = useState<ProductoFinanciero[]>([]);
  const [saldosRecaudadoras, setSaldosRecaudadoras] = useState<Map<string, number>>(new Map());
  const [loadingExtra, setLoadingExtra] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros + agrupación + vista
  const [filtros, setFiltros] = useState<FiltrosSaldosState>(defaultFiltrosSaldos);
  const [agrupacion, setAgrupacion] = useState<GrupoSaldos>('titular');
  const [vista, setVista] = useState<VistaSaldos>('lista');
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoFinancieroUnif | null>(
    null,
  );

  // ─── CuentaWizard inline (chk5.D-S6.SF1 · cierra gap del audit) ─────
  const [cuentaWizardOpen, setCuentaWizardOpen] = useState(false);
  const [cuentaWizardEditar, setCuentaWizardEditar] = useState<CuentaCaja | null>(null);
  const [cuentaWizardSubmitting, setCuentaWizardSubmitting] = useState(false);

  // chk5.D-S9.B · Verificación de saldos manual
  const [verificarSaldoCuenta, setVerificarSaldoCuenta] = useState<CuentaCaja | null>(null);

  // chk5.D-S9.D1 · Tipo pre-seleccionado para abrir CuentaWizard desde quick-start cards
  const [tipoInicialWizard, setTipoInicialWizard] = useState<'banco' | 'digital' | 'credito' | 'efectivo' | undefined>(undefined);
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);
  const toastInfo = useToastStore((s) => s.info);
  const userIdAuth = useAuthStore((s) => s.user?.uid ?? '');

  // ─── Fetch extra ─────────────────────────────────────────────────────
  const cargarExtra = useCallback(() => {
    setLoadingExtra(true);
    setError(null);

    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    Promise.all([tarjetaCreditoService.getAll(), getProductosFinancierosActivos()])
      .then(async ([tarj, prodsFinancieros]) => {
        setTarjetas(tarj);
        const recList = prodsFinancieros.filter((p) => p.tipoProducto === 'caja_recaudadora');
        setRecaudadoras(recList);

        // Calcular saldos pendientes de liquidación por cada recaudadora
        const saldosMap = new Map<string, number>();
        await Promise.all(
          recList.map(async (r) => {
            if (!r.id) return;
            try {
              const balance = await cajaRecaudadoraService.calcularBalanceMes(
                r.id,
                inicioMes,
                ahora,
              );
              saldosMap.set(r.id, balance.pendienteLiquidar);
            } catch {
              saldosMap.set(r.id, 0);
            }
          }),
        );
        setSaldosRecaudadoras(saldosMap);
      })
      .catch((err) => {
        setError(err?.message ?? 'Error cargando productos financieros');
      })
      .finally(() => setLoadingExtra(false));
  }, []);

  useEffect(() => {
    cargarExtra();
  }, [cargarExtra]);

  // ─── Productos unificados ───────────────────────────────────────────
  const productosUnif = useMemo<ProductoFinancieroUnif[]>(() => {
    const lista: ProductoFinancieroUnif[] = [];

    for (const c of cuentas) {
      lista.push(wrapCuentaCaja(c));
    }
    for (const tc of tarjetas) {
      // TODO chk5.D-S4 · cargar saldo CC espejo real (legacy saldoActualUSD por ahora)
      lista.push(wrapTarjetaCredito(tc));
    }
    for (const r of recaudadoras) {
      lista.push(wrapCajaRecaudadora(r, saldosRecaudadoras.get(r.id ?? '') ?? 0));
    }
    return lista;
  }, [cuentas, tarjetas, recaudadoras, saldosRecaudadoras]);

  // ─── Productos filtrados ────────────────────────────────────────────
  const productosFiltrados = useMemo(
    () => aplicarFiltrosSaldos(productosUnif, filtros),
    [productosUnif, filtros],
  );

  // ─── KPIs canon MOCK 6 ──────────────────────────────────────────────
  const kpis = useMemo(
    () => calcularKPIsSaldos(productosUnif, tcpaActual),
    [productosUnif, tcpaActual],
  );

  // ─── Grupos según agrupación seleccionada ───────────────────────────
  const grupos = useMemo(() => {
    switch (agrupacion) {
      case 'titular':
        return agruparPorTitular(productosFiltrados);
      case 'tipo':
        return agruparPorTipo(productosFiltrados);
      case 'moneda':
        return agruparPorMoneda(productosFiltrados);
      case 'banco':
        return agruparPorBanco(productosFiltrados);
    }
  }, [productosFiltrados, agrupacion]);

  // ─── Pool USD (D13) · sub-grupo dentro de titular Empresa ──────────
  const poolUSDCuentas = useMemo(() => {
    if (agrupacion !== 'titular') return [];
    const empresaGrupo = grupos.find((g) => g.key === 'empresa');
    if (!empresaGrupo) return [];
    return extraerCuentasPoolUSD(empresaGrupo.productos);
  }, [grupos, agrupacion]);

  const poolUSDTotal = useMemo(
    () => poolUSDCuentas.reduce((sum, p) => sum + saldoUSDDe(p), 0),
    [poolUSDCuentas],
  );

  // ─── Handlers ────────────────────────────────────────────────────────
  // chk5.D-S9.A · export CSV real · saldos consolidados por producto.
  const handleExportar = useCallback(() => {
    if (productosFiltrados.length === 0) {
      toastInfo('No hay cuentas para exportar en el filtro actual.', 'Export vacío');
      return;
    }
    exportToCsv({
      filename: 'saldos_consolidados_{timestamp}',
      separator: ';',
      rows: productosFiltrados,
      columns: [
        { header: 'Tipo', get: (p) => kindFinalDe(p) },
        { header: 'Nombre', get: (p) => nombreDe(p) },
        { header: 'Moneda principal', get: (p) => monedaPrincipalDe(p) },
        {
          header: 'Saldo PEN',
          get: (p) => {
            if (p.kind === 'cuenta_bancaria') {
              return fmtMontoCsv(esBiMonedaDe(p) ? p.kindData.saldoPEN ?? 0 : monedaPrincipalDe(p) === 'PEN' ? p.kindData.saldoActual ?? 0 : 0);
            }
            if (p.kind === 'wallet_digital' || p.kind === 'caja_efectivo') {
              return fmtMontoCsv(monedaPrincipalDe(p) === 'PEN' ? p.kindData.saldoActual ?? 0 : 0);
            }
            return '0.00';
          },
        },
        {
          header: 'Saldo USD',
          get: (p) => fmtMontoCsv(saldoUSDDe(p)),
        },
        {
          header: 'Estado',
          get: (p) => (p.kind === 'cuenta_bancaria' || p.kind === 'wallet_digital' || p.kind === 'caja_efectivo' ? (p.kindData.activa ? 'activa' : 'inactiva') : 'activa'),
        },
        { header: 'Titular', get: (p) => titularGrupoDe(p) ?? '' },
      ],
    });
    toastInfo(
      `${productosFiltrados.length} cuentas exportadas a CSV.`,
      'Export listo',
    );
  }, [toastInfo, productosFiltrados]);

  // chk5.D-S9.B · Verificar saldos manual (re-scope de "Conciliar bancos")
  // Abre el modal apuntando a la primera cuenta bancaria/wallet/caja del listado
  // como punto de entrada · si no hay cuentas, muestra toast info.
  const handleConciliar = useCallback(() => {
    const candidatas = productosFiltrados.filter(
      (p) => p.kind === 'cuenta_bancaria' || p.kind === 'wallet_digital' || p.kind === 'caja_efectivo',
    );
    if (candidatas.length === 0) {
      toastInfo(
        'No hay cuentas verificables · agregá una cuenta bancaria, wallet o caja primero.',
        'Sin cuentas',
      );
      return;
    }
    // Abre el modal con la primera · UX simple para PyME 2-3 socios
    setVerificarSaldoCuenta(candidatas[0].kindData as CuentaCaja);
  }, [productosFiltrados, toastInfo]);

  const handleNuevaCuenta = useCallback(
    (tipoInicial?: 'banco' | 'digital' | 'credito' | 'efectivo') => {
      // chk5.D-S6.SF1 · Wire-up directo al CuentaWizard como modal · cero salidas a /tesoreria
      // chk5.D-S9.D1 · tipoInicial opcional · usado por quick-start cards del empty state
      // para pre-seleccionar el tipo en Paso 1 (Bancaria→banco · Wallet→digital · etc.).
      setCuentaWizardEditar(null);
      setTipoInicialWizard(tipoInicial);
      setCuentaWizardOpen(true);
    },
    [],
  );

  const handleEditarCuenta = useCallback((cuenta: CuentaCaja) => {
    // chk5.D-S6.SF1 · Edit mode del wizard inline
    setCuentaWizardEditar(cuenta);
    setCuentaWizardOpen(true);
  }, []);

  const handleGuardarCuenta = useCallback(
    async (data: CuentaCajaFormData, editar?: CuentaCaja | null) => {
      if (!userIdAuth) {
        toastError('Sesión inválida · recargá la página', 'Error');
        return;
      }
      setCuentaWizardSubmitting(true);
      try {
        if (editar?.id) {
          await tesoreriaService.actualizarCuenta(editar.id, data, userIdAuth);
          toastSuccess(`Cuenta "${data.nombre}" actualizada`, 'Cuenta editada');
        } else {
          await tesoreriaService.crearCuenta(data, userIdAuth);
          toastSuccess(`Cuenta "${data.nombre}" creada`, 'Cuenta nueva');
        }
        setCuentaWizardOpen(false);
        setCuentaWizardEditar(null);
        setTipoInicialWizard(undefined);
        // Refresh data del shell · trigger refetch
        cargarExtra();
      } catch (e: any) {
        toastError(e?.message ?? 'Error al guardar la cuenta', 'Error');
      } finally {
        setCuentaWizardSubmitting(false);
      }
    },
    [userIdAuth, toastSuccess, toastError, cargarExtra],
  );

  const handleLimpiarFiltros = useCallback(() => {
    setFiltros(defaultFiltrosSaldos());
  }, []);

  // ─── Resolver badges por producto ───────────────────────────────────
  const resolverBadges = useCallback(
    (p: ProductoFinancieroUnif): ProductoFinancieroBadge[] => {
      const badges: ProductoFinancieroBadge[] = [];
      const kind = kindFinalDe(p);

      // Default PEN · primera cuenta bancaria PEN del titular Empresa
      // Heurística: si la cuenta tiene esCuentaPorDefecto=true
      if (p.kind === 'cuenta_bancaria') {
        const c = p.kindData;
        if (c.esCuentaPorDefecto) {
          const mon = monedaPrincipalDe(p);
          badges.push({ label: `Default ${mon}`, color: 'emerald' });
        }
      }

      // TC bimoneda
      if (kind === 'tarjeta_credito') {
        if (esBiMonedaDe(p)) {
          badges.push({ label: 'TC Bimoneda', color: 'amber' });
        } else {
          badges.push({ label: `TC ${monedaPrincipalDe(p)}`, color: 'amber' });
        }
        // Vencimiento próximo
        if (p.kind === 'tarjeta_credito') {
          const diaPago = p.kindData.diaPago;
          const hoy = new Date();
          const diaActual = hoy.getDate();
          let diasHasta = diaPago - diaActual;
          if (diasHasta < 0) diasHasta += 30;
          if (diasHasta <= 7) {
            badges.push({
              label: `Vence ${diasHasta}d`,
              color: 'rose',
              pulse: diasHasta <= 3,
            });
          }
          // Reembolso para TC personal
          if (p.kindData.titularidad === 'personal') {
            badges.push({ label: 'Reembolso', color: 'indigo' });
          }
        }
      }

      // Wallet
      if (kind === 'wallet_digital') {
        badges.push({ label: 'Wallet', color: 'sky' });
      }

      // TC débito vinculada
      if (kind === 'tarjeta_debito') {
        badges.push({ label: 'TC Débito', color: 'indigo' });
        badges.push({ label: '↗ Pool USD', color: 'amber' });
      }

      // Caja efectivo
      if (kind === 'caja_efectivo') {
        badges.push({ label: 'Caja', color: 'slate' });
      }

      // Recaudadora
      if (kind === 'caja_recaudadora') {
        badges.push({ label: 'Recaudadora', color: 'purple' });
      }

      return badges;
    },
    [],
  );

  // ─── Resolver estado label ──────────────────────────────────────────
  const resolverEstado = useCallback(
    (p: ProductoFinancieroUnif): { label: string; color: ProductoFinancieroBadge['color'] } => {
      const kind = kindFinalDe(p);
      if (kind === 'caja_recaudadora') {
        return { label: 'Pendiente liquidar', color: 'purple' };
      }
      if (kind === 'tarjeta_credito') {
        if (esBiMonedaDe(p)) return { label: '2 saldos · ciclo cerrado', color: 'amber' };
        return { label: 'Ciclo cerrado', color: 'amber' };
      }
      if (kind === 'tarjeta_debito') {
        return { label: 'Disponible Pool USD', color: 'indigo' };
      }
      if (kind === 'wallet_digital') {
        return { label: 'Pendiente payout', color: 'sky' };
      }
      if (kind === 'caja_efectivo') {
        if (p.kind === 'caja_efectivo' && p.kindData.titular) {
          return { label: `Resp: ${p.kindData.titular}`, color: 'slate' };
        }
        return { label: 'Caja activa', color: 'slate' };
      }
      // Cuenta bancaria
      if (p.kind === 'cuenta_bancaria' && p.kindData.esCuentaPorDefecto) {
        const mon = monedaPrincipalDe(p);
        return { label: `Default ${mon}`, color: 'emerald' };
      }
      return { label: '', color: 'slate' };
    },
    [],
  );

  // ─── Resolver highlight (Pool USD sub-grupo) ────────────────────────
  const esCuentaPoolUSD = useCallback(
    (p: ProductoFinancieroUnif): boolean => {
      return poolUSDCuentas.some((c) => c.id === p.id);
    },
    [poolUSDCuentas],
  );

  // ─── KPI slot canon MOCK 6 §1 ────────────────────────────────────────
  const kpiSlot = useMemo(
    () => (
      <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* KPI 1 · Patrimonio total · teal */}
        <KpiSaldoCard
          color="teal"
          icon={Building2}
          label="Total patrimonio"
          value={`S/ ${fmt0(kpis.patrimonioTotalPEN)}`}
          subtitle={`${kpis.productosActivosCount} productos activos`}
        />
        {/* KPI 2 · Cuentas PEN · emerald */}
        <KpiSaldoCard
          color="emerald"
          icon={Banknote}
          label="Cuentas PEN"
          value={`S/ ${fmt0(kpis.cuentasPENTotal)}`}
          subtitle={`${kpis.cuentasPENCount} ${kpis.cuentasPENCount === 1 ? 'cuenta' : 'cuentas'} · ${kpis.cuentasPENPctPatrimonio}%`}
        />
        {/* KPI 3 · Pool USD · teal */}
        <KpiSaldoCard
          color="teal"
          icon={Banknote}
          label={`Pool USD (vista · ${kpis.poolUSDCuentasCount} ${kpis.poolUSDCuentasCount === 1 ? 'cta' : 'ctas'})`}
          value={`$ ${fmt0(kpis.poolUSDTotal)}`}
          subtitle={`≈ S/ ${fmt0(kpis.poolUSDEquivPEN)} · TCPA ${tcpaActual > 0 ? tcpaActual.toFixed(3) : '—'}`}
        />
        {/* KPI 4 · Deuda TC · amber */}
        <KpiSaldoCard
          color="amber"
          icon={CreditCard}
          label="Deuda TC total"
          value={kpis.deudaTCTotalUSD > 0 ? `$ ${fmt0(kpis.deudaTCTotalUSD)}` : `S/ ${fmt0(kpis.deudaTCTotalPEN)}`}
          subtitle={`${kpis.tcCount} TC${
            kpis.tcPersonalReembolsoCount > 0
              ? ` · ${kpis.tcPersonalReembolsoCount} personal reembolso`
              : ''
          }`}
        />
        {/* KPI 5 · Recaudadoras · purple */}
        <KpiSaldoCard
          color="purple"
          icon={Truck}
          label="Recaudadoras"
          value={`S/ ${fmt0(kpis.recaudadorasPendientePEN)}`}
          subtitle={`${kpis.recaudadorasCount} ${kpis.recaudadorasCount === 1 ? 'caja' : 'cajas'} · pendiente liq.`}
        />
      </div>
    ),
    [kpis, tcpaActual],
  );

  // ─── Actions custom ─────────────────────────────────────────────────
  const actionsCustom = useMemo(
    () => (
      <>
        <button
          type="button"
          onClick={handleExportar}
          aria-label="Exportar"
          title="Exportar"
          className="text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Download className="w-3 h-3" />
          <span className="hidden sm:inline">Exportar</span>
        </button>
        <button
          type="button"
          onClick={handleConciliar}
          aria-label="Verificar saldo"
          title="Verificar saldo contra el banco real (snapshot manual)"
          className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <RefreshCw className="w-3 h-3" />
          <span className="hidden sm:inline">Verificar saldo</span>
        </button>
        <button
          type="button"
          onClick={() => handleNuevaCuenta()}
          aria-label="Nueva cuenta"
          title="Nueva cuenta"
          className="text-[11px] font-bold text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3 h-3" />
          <span className="hidden sm:inline">Nueva cuenta</span>
        </button>
      </>
    ),
    [handleExportar, handleConciliar, handleNuevaCuenta],
  );

  // ─── Setear sub-vista config en el shell ────────────────────────────
  useEffect(() => {
    setSubVistaConfig({
      breadcrumbLeaf: 'Saldos',
      header: {
        title: 'Saldos',
        subtitle:
          'Estado consolidado de TODAS las cuentas · bancarias · wallets · TC · cajas · recaudadoras',
        icon: Wallet,
        iconColor: 'emerald',
      },
      kpiSlot,
      actions: actionsCustom,
      // El header del mockup MOCK 6 incluye "Nueva cuenta" como CTA propia
      // del módulo Saldos · ya NO mostrar el dropdown "+ Nuevo movimiento" general.
      actionsReplaceAll: true,
    });
  }, [setSubVistaConfig, kpiSlot, actionsCustom]);

  const activeCount = contarFiltrosSaldosActivos(filtros);
  const totalPEN = productosFiltrados.reduce((s, p) => {
    const kind = kindFinalDe(p);
    if (kind === 'tarjeta_credito' || kind === 'tarjeta_debito' || kind === 'caja_recaudadora') {
      return s;
    }
    if (monedaPrincipalDe(p) === 'PEN') {
      return s + (esBiMonedaDe(p) ? Math.abs(p.kind === 'cuenta_bancaria' ? p.kindData.saldoPEN ?? 0 : 0) : Math.abs(p.kind === 'cuenta_bancaria' || p.kind === 'wallet_digital' || p.kind === 'caja_efectivo' ? p.kindData.saldoActual ?? 0 : 0));
    }
    return s;
  }, 0);
  const totalUSDListado = productosFiltrados.reduce((s, p) => {
    const kind = kindFinalDe(p);
    if (kind === 'cuenta_bancaria' && monedaPrincipalDe(p) === 'USD') {
      return s + saldoUSDDe(p);
    }
    return s;
  }, 0);

  const resumenToolbar = `${productosFiltrados.length} ${productosFiltrados.length === 1 ? 'producto' : 'productos'} · S/ ${fmt0(totalPEN)}${
    totalUSDListado > 0 ? ` + $ ${fmt0(totalUSDListado)}` : ''
  }`;

  // ═════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════

  // Error state
  if (error) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-rose-600" />
        </div>
        <div>
          <div className="text-[14px] font-bold text-slate-900">No se pudieron cargar los saldos</div>
          <div className="text-[11px] text-slate-500 mt-1">{error}</div>
        </div>
        <button
          type="button"
          onClick={cargarExtra}
          className="text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
        >
          <RefreshCw className="w-3 h-3" /> Reintentar
        </button>
      </div>
    );
  }

  // Loading state
  if (loadingExtra && cuentas.length === 0) {
    return (
      <>
        <FiltrosSaldosBar
          state={filtros}
          onChange={setFiltros}
          activeCount={activeCount}
          onLimpiarTodo={handleLimpiarFiltros}
        />
        <div className="p-4 space-y-2">
          <div className="shimmer h-12 rounded-lg" />
          <div className="shimmer h-12 rounded-lg" />
          <div className="shimmer h-12 rounded-lg" />
          <div className="shimmer h-12 rounded-lg" />
          <div className="text-center pt-4">
            <div className="text-[10px] text-slate-500">Cargando saldos...</div>
          </div>
        </div>
      </>
    );
  }

  // Empty state · ningún producto registrado
  // chk5.D-S8.SF3.D6 · CuentaWizard también debe vivir aquí · sin esto el wizard
  // nunca se monta cuando la BD está vacía y el botón "+ Nueva cuenta" parece roto.
  if (productosUnif.length === 0) {
    return (
      <>
        <EmptyStateSaldos onNuevaCuenta={handleNuevaCuenta} />
        <CuentaWizard
          isOpen={cuentaWizardOpen}
          onClose={() => {
            setCuentaWizardOpen(false);
            setCuentaWizardEditar(null);
            setTipoInicialWizard(undefined);
          }}
          cuentaEditar={cuentaWizardEditar}
          tipoInicial={tipoInicialWizard}
          onGuardar={handleGuardarCuenta}
          isSubmitting={cuentaWizardSubmitting}
        />
        {/* chk5.D-S9.B · Modal de verificación (raro que se llegue acá sin cuentas, pero por consistencia) */}
        <VerificarSaldoModal
          isOpen={!!verificarSaldoCuenta}
          onClose={() => setVerificarSaldoCuenta(null)}
          cuenta={verificarSaldoCuenta}
          onVerificado={() => cargarExtra()}
        />
      </>
    );
  }

  // Render principal
  return (
    <>
      <FiltrosSaldosBar
        state={filtros}
        onChange={setFiltros}
        activeCount={activeCount}
        onLimpiarTodo={handleLimpiarFiltros}
      />
      <ToolbarAgruparSaldos
        resumen={resumenToolbar}
        agrupacion={agrupacion}
        onAgrupacionChange={setAgrupacion}
        vista={vista}
        onVistaChange={setVista}
      />

      {vista === 'grid' ? (
        <div className="p-6 text-center text-[12px] text-slate-500">
          Vista <strong className="text-slate-700">grid</strong> próximamente · chk5.D-S4. Cambiá a
          vista <strong>lista</strong> para ver el listado completo.
        </div>
      ) : grupos.length === 0 ? (
        <div className="p-8 text-center space-y-3">
          <Wallet className="w-12 h-12 text-slate-300 mx-auto" />
          <div>
            <div className="text-[14px] font-bold text-slate-900">
              Sin productos para los filtros seleccionados
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Ajustá los filtros o limpiá para ver todo.
            </div>
          </div>
          <button
            type="button"
            onClick={handleLimpiarFiltros}
            className="text-[11px] font-bold text-white bg-slate-700 hover:bg-slate-800 px-3 py-1.5 rounded-lg"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {grupos.map((grupo) => (
            <div key={grupo.key}>
              {agrupacion === 'titular' ? (
                <GrupoTitularHeader
                  grupo={grupo.key as 'empresa' | 'personal' | 'recaudador'}
                  label={grupo.label}
                  count={grupo.productos.length}
                  subtotalLabel={`${grupo.subtotalPEN > 0 ? `S/ ${fmt0(grupo.subtotalPEN)}` : ''}${
                    grupo.subtotalUSD > 0 ? ` + $ ${fmt0(grupo.subtotalUSD)}` : ''
                  }`.trim() || '—'}
                />
              ) : (
                <GrupoGenericoHeader
                  label={grupo.label}
                  count={grupo.productos.length}
                  subtotalLabel={`${grupo.subtotalPEN > 0 ? `S/ ${fmt0(grupo.subtotalPEN)}` : ''}${
                    grupo.subtotalUSD > 0 ? ` + $ ${fmt0(grupo.subtotalUSD)}` : ''
                  }`.trim() || '—'}
                  color={agrupacion === 'tipo' ? 'teal' : 'slate'}
                  icon={iconParaGrupoTipo(grupo.key)}
                />
              )}

              {/* Render productos · con sub-header Pool USD intercalado si aplica */}
              <div className="divide-y divide-slate-100">
                {agrupacion === 'titular' && grupo.key === 'empresa' && poolUSDCuentas.length > 0
                  ? renderProductosConPoolUSD(grupo.productos, poolUSDCuentas, poolUSDTotal, tcpaActual, {
                      resolverBadges,
                      resolverEstado,
                      esCuentaPoolUSD,
                      setProductoSeleccionado,
                    })
                  : grupo.productos.map((p) => {
                      const estado = resolverEstado(p);
                      return (
                        <ProductoFinancieroRow
                          key={p.id}
                          producto={p}
                          badges={resolverBadges(p)}
                          estadoLabel={estado.label}
                          estadoColor={estado.color as never}
                          highlight={esCuentaPoolUSD(p)}
                          onClick={() => setProductoSeleccionado(p)}
                        />
                      );
                    })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer detalle */}
      {productoSeleccionado && (
        <DrawerProductoFinanciero
          producto={productoSeleccionado}
          onClose={() => setProductoSeleccionado(null)}
          onAccionPrimary={() => {
            // chk5.D-S9.D2 · acciones drawer · toast info para las que aún no tienen flow propio.
            // chk5.D-S9.B · cuenta_bancaria + wallet + caja → abren modal de verificación de saldo.
            const kind = kindFinalDe(productoSeleccionado);
            const cuentaCajaData =
              kind === 'cuenta_bancaria' || kind === 'wallet_digital' || kind === 'caja_efectivo' || kind === 'tarjeta_debito'
                ? (productoSeleccionado.kindData as CuentaCaja)
                : null;
            setProductoSeleccionado(null);
            if (kind === 'caja_recaudadora') onSeleccionarAccion('liquidar_recaudadora');
            else if (kind === 'tarjeta_credito') onSeleccionarAccion('pagar_tc');
            else if (kind === 'tarjeta_debito') navigate('/finanzas/saldos');
            else if (kind === 'wallet_digital' && cuentaCajaData) {
              // Para wallets el botón primary es "Verificar saldo" (mismo modal).
              // "Forzar payout" se difiere hasta tener API real de Stripe/PayPal/MP.
              setVerificarSaldoCuenta(cuentaCajaData);
            } else if (kind === 'cuenta_bancaria' && cuentaCajaData) {
              setVerificarSaldoCuenta(cuentaCajaData);
            } else if (kind === 'caja_efectivo' && cuentaCajaData) {
              // Para caja efectivo el primary es también verificar saldo (sin app banco,
              // el usuario cuenta físicamente el efectivo y lo ingresa). El "arqueo formal
              // con diferencia automática a cuenta-pérdida/ganancia" llega después.
              setVerificarSaldoCuenta(cuentaCajaData);
            }
          }}
          onEditar={() => {
            // chk5.D-S6.SF1 · Solo cuentas (CuentaCaja) editables via CuentaWizard.
            // Tarjetas de crédito · recaudadoras tienen sus propios editores legacy
            // (DEUDA-S6-EDITORES-PRODUCTOS: refactor a invocables canon · sprint futuro).
            const kind = kindFinalDe(productoSeleccionado);
            if (
              kind === 'cuenta_bancaria' ||
              kind === 'wallet_digital' ||
              kind === 'tarjeta_debito' ||
              kind === 'caja_efectivo'
            ) {
              // Producto.kindData es CuentaCaja para estos 4 kinds
              handleEditarCuenta(productoSeleccionado.kindData as CuentaCaja);
              setProductoSeleccionado(null);
            } else {
              // Tarjeta de crédito · caja recaudadora · sin editor canon aún
              toastError(
                `Editar ${kind} aún no disponible inline · sprint S6.bis pendiente`,
                'Editor canon pendiente',
              );
            }
          }}
          onVerHistorico={() => navigate('/finanzas/movimientos')}
        />
      )}

      {/* CuentaWizard inline · chk5.D-S6.SF1 · cierra gap del audit honesto */}
      <CuentaWizard
        isOpen={cuentaWizardOpen}
        onClose={() => {
          setCuentaWizardOpen(false);
          setCuentaWizardEditar(null);
        }}
        cuentaEditar={cuentaWizardEditar}
        tipoInicial={tipoInicialWizard}
        onGuardar={handleGuardarCuenta}
        isSubmitting={cuentaWizardSubmitting}
      />

      {/* chk5.D-S9.B · Modal de verificación de saldo (snapshot manual contra banco) */}
      <VerificarSaldoModal
        isOpen={!!verificarSaldoCuenta}
        onClose={() => setVerificarSaldoCuenta(null)}
        cuenta={verificarSaldoCuenta}
        onVerificado={() => cargarExtra()}
      />
    </>
  );
};

export default FinanzasSaldos;

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES INLINE
// ═════════════════════════════════════════════════════════════════════════

interface KpiSaldoCardProps {
  color: 'teal' | 'emerald' | 'amber' | 'purple';
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle: string;
}

const KPI_BG: Record<KpiSaldoCardProps['color'], string> = {
  teal: 'bg-gradient-to-br from-teal-50 to-teal-100/40 ring-teal-200/50',
  emerald: 'bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-emerald-200/50',
  amber: 'bg-gradient-to-br from-amber-50 to-amber-100/40 ring-amber-200/50',
  purple: 'bg-gradient-to-br from-purple-50 to-purple-100/40 ring-purple-200/50',
};

const KPI_LABEL: Record<KpiSaldoCardProps['color'], string> = {
  teal: 'text-teal-700',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  purple: 'text-purple-700',
};

const KPI_VALUE: Record<KpiSaldoCardProps['color'], string> = {
  teal: 'text-teal-900',
  emerald: 'text-emerald-900',
  amber: 'text-amber-900',
  purple: 'text-purple-900',
};

const KpiSaldoCard: React.FC<KpiSaldoCardProps> = ({ color, icon: Icon, label, value, subtitle }) => (
  <div className={`ring-1 rounded-2xl p-4 ${KPI_BG[color]}`}>
    <div className="flex items-center justify-between mb-2 gap-2">
      <span className={`text-[10px] uppercase tracking-wider font-bold truncate ${KPI_LABEL[color]}`}>
        {label}
      </span>
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${KPI_LABEL[color]}`} />
    </div>
    <div className={`text-2xl font-bold tabular-nums ${KPI_VALUE[color]}`}>{value}</div>
    <div className={`text-[11px] mt-1 ${KPI_LABEL[color]}`}>{subtitle}</div>
  </div>
);

interface EmptyStateProps {
  /**
   * chk5.D-S9.D1 · acepta tipo opcional para pre-seleccionar en el wizard.
   * Cada quick-start card lo dispara con su tipo correspondiente:
   *   Bancaria → 'banco' · Wallet → 'digital' · Tarjeta → 'credito' · Caja → 'efectivo'
   * El botón "+ Nueva cuenta" genérico no pasa tipo (default 'banco').
   */
  onNuevaCuenta: (tipo?: 'banco' | 'digital' | 'credito' | 'efectivo') => void;
}

const EmptyStateSaldos: React.FC<EmptyStateProps> = ({ onNuevaCuenta }) => (
  <div className="p-8 text-center space-y-4">
    <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
      <Wallet className="w-8 h-8 text-emerald-600" />
    </div>
    <div>
      <div className="text-[14px] font-bold text-slate-900">
        Aún no tienes cuentas registradas
      </div>
      <div className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
        Creá tu primera cuenta bancaria, wallet digital, tarjeta o caja para empezar a operar
        Finanzas.
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
      <QuickStartCard icon={Building2} label="Bancaria" hint="BCP · IBK · BBVA" color="teal" onClick={() => onNuevaCuenta('banco')} />
      <QuickStartCard icon={Smartphone} label="Wallet" hint="Stripe · PayPal · MP" color="sky" onClick={() => onNuevaCuenta('digital')} />
      <QuickStartCard icon={CreditCard} label="Tarjeta" hint="Visa · MC · Amex" color="amber" onClick={() => onNuevaCuenta('credito')} />
      <QuickStartCard icon={Banknote} label="Caja" hint="Efectivo + arqueo" color="slate" onClick={() => onNuevaCuenta('efectivo')} />
    </div>
    <button
      type="button"
      onClick={() => onNuevaCuenta()}
      className="text-[11px] font-bold text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
    >
      + Nueva cuenta
    </button>
  </div>
);

interface QuickStartCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  color: 'teal' | 'sky' | 'amber' | 'slate';
  onClick: () => void;
}

const QUICKSTART_HOVER: Record<QuickStartCardProps['color'], string> = {
  teal: 'hover:border-teal-300 hover:bg-teal-50/30',
  sky: 'hover:border-sky-300 hover:bg-sky-50/30',
  amber: 'hover:border-amber-300 hover:bg-amber-50/30',
  slate: 'hover:border-slate-400 hover:bg-slate-50',
};

const QUICKSTART_ICON: Record<QuickStartCardProps['color'], string> = {
  teal: 'text-teal-600',
  sky: 'text-sky-600',
  amber: 'text-amber-600',
  slate: 'text-slate-600',
};

const QuickStartCard: React.FC<QuickStartCardProps> = ({ icon: Icon, label, hint, color, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-left p-2 bg-white border border-slate-200 rounded-lg transition-colors ${QUICKSTART_HOVER[color]}`}
  >
    <Icon className={`w-4 h-4 mb-1 ${QUICKSTART_ICON[color]}`} />
    <div className="text-[11px] font-bold">{label}</div>
    <div className="text-[9px] text-slate-500">{hint}</div>
  </button>
);

// ═════════════════════════════════════════════════════════════════════════
// HELPERS RENDER
// ═════════════════════════════════════════════════════════════════════════

interface RenderHelpers {
  resolverBadges: (p: ProductoFinancieroUnif) => ProductoFinancieroBadge[];
  resolverEstado: (p: ProductoFinancieroUnif) => {
    label: string;
    color: ProductoFinancieroBadge['color'];
  };
  esCuentaPoolUSD: (p: ProductoFinancieroUnif) => boolean;
  setProductoSeleccionado: (p: ProductoFinancieroUnif) => void;
}

/**
 * Renderiza productos del titular Empresa intercalando el sub-header Pool USD
 * justo ANTES de la primera cuenta USD del pool. Las cuentas que NO son del
 * pool se renderizan normal · las del pool con highlight bg-teal-50/10.
 */
function renderProductosConPoolUSD(
  productos: ProductoFinancieroUnif[],
  poolUSDCuentas: ProductoFinancieroUnif[],
  poolUSDTotal: number,
  tcpa: number,
  helpers: RenderHelpers,
): React.ReactNode[] {
  const poolUSDIds = new Set(poolUSDCuentas.map((p) => p.id));
  const noPool = productos.filter((p) => !poolUSDIds.has(p.id));
  const pool = productos.filter((p) => poolUSDIds.has(p.id));

  // Insertar pool después de la primera cuenta bancaria PEN si existe
  // (canon mockup: BCP Soles Operativa va primero · luego sub-header Pool USD)
  const cuentaPENIdx = noPool.findIndex(
    (p) => p.kind === 'cuenta_bancaria' && monedaPrincipalDe(p) === 'PEN',
  );
  const insertAfter = cuentaPENIdx >= 0 ? cuentaPENIdx + 1 : 0;

  const items: React.ReactNode[] = [];
  noPool.slice(0, insertAfter).forEach((p) => {
    const estado = helpers.resolverEstado(p);
    items.push(
      <ProductoFinancieroRow
        key={p.id}
        producto={p}
        badges={helpers.resolverBadges(p)}
        estadoLabel={estado.label}
        estadoColor={estado.color as never}
        onClick={() => helpers.setProductoSeleccionado(p)}
      />,
    );
  });

  if (pool.length > 0) {
    items.push(
      <SubGrupoPoolUSDHeader
        key="pool-usd-header"
        cuentasCount={pool.length}
        tcpa={tcpa}
        totalUSD={poolUSDTotal}
        equivPEN={poolUSDTotal * (tcpa || 0)}
      />,
    );
    pool.forEach((p) => {
      const estado = helpers.resolverEstado(p);
      items.push(
        <ProductoFinancieroRow
          key={p.id}
          producto={p}
          badges={helpers.resolverBadges(p)}
          estadoLabel={estado.label}
          estadoColor={estado.color as never}
          highlight={true}
          onClick={() => helpers.setProductoSeleccionado(p)}
        />,
      );
    });
  }

  noPool.slice(insertAfter).forEach((p) => {
    const estado = helpers.resolverEstado(p);
    items.push(
      <ProductoFinancieroRow
        key={p.id}
        producto={p}
        badges={helpers.resolverBadges(p)}
        estadoLabel={estado.label}
        estadoColor={estado.color as never}
        onClick={() => helpers.setProductoSeleccionado(p)}
      />,
    );
  });

  return items;
}

function iconParaGrupoTipo(key: string): React.ComponentType<{ className?: string }> | undefined {
  switch (key) {
    case 'cuenta_bancaria':
      return Building2;
    case 'wallet_digital':
      return Smartphone;
    case 'tarjeta_credito':
    case 'tarjeta_debito':
      return CreditCard;
    case 'caja_efectivo':
      return Banknote;
    case 'caja_recaudadora':
      return Truck;
    default:
      return undefined;
  }
}

void titularGrupoDe; // suprimir warning · usado solo via helpers
