import React, { useState, useMemo } from 'react';
import { formatFecha as formatDate } from '../../utils/dateFormatters';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Plus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  Banknote,
  Edit2,
  FileText,
  Trash2,
  ExternalLink,
  RefreshCw,
  User,
  X,
  Link2,
  Coins,
  ArrowLeftRight,
  Check,
  Wallet,
} from 'lucide-react';
import { Button, Card } from '../../components/common';
import {
  FormModalV2,
  DataTable,
  TextField,
  MoneyField,
  DateField,
  ToggleGroup,
  Combobox,
} from '../../design-system';
import type { ComboboxGroup } from '../../design-system';
import type { DataTableColumn } from '../../design-system';
import type {
  MovimientoTesoreria,
  CuentaCaja,
  MovimientoTesoreriaFormData,
  TipoMovimientoTesoreria,
  MonedaTesoreria
} from '../../types/tesoreria.types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { cuentaCorrienteService } from '../../services/cuentaCorriente.service';
import type { CuentaCorriente } from '../../types/cuentaCorriente.types';
import { EntidadCCDrawer } from '../Finanzas/components/EntidadCCDrawer';
import { EntidadCCDetailModal } from '../Finanzas/components/EntidadCCDetailModal';
import { PagoAbonoWizard } from '../Finanzas/components/PagoAbonoWizard';
import { MovimientosKpiRow, MovimientosBreakdown } from './components';

interface TabMovimientosProps {
  movimientosFiltrados: MovimientoTesoreria[];
  cuentas: CuentaCaja[];
  saldosCorridos: Map<string, { pen: number; usd: number }>;
  chartEvolucionSaldo: { fecha: string; saldo: number }[];
  chartEvolucionSaldoUSD: { fecha: string; saldo: number }[];
  totalesMovimientos: {
    entradasPEN: number;
    salidasPEN: number;
    entradasUSD: number;
    salidasUSD: number;
    total: number;
  };
  isMovimientoModalOpen: boolean;
  setIsMovimientoModalOpen: (open: boolean) => void;
  movimientoEditando: MovimientoTesoreria | null;
  movimientoForm: Partial<MovimientoTesoreriaFormData>;
  setMovimientoForm: React.Dispatch<React.SetStateAction<Partial<MovimientoTesoreriaFormData>>>;
  isSubmitting: boolean;
  tcDefault: number;
  isAdmin: boolean;
  esIngreso: (tipo: TipoMovimientoTesoreria) => boolean;
  esIngresoMovimiento: (mov: MovimientoTesoreria) => boolean;
  getTipoLabel: (tipo: TipoMovimientoTesoreria) => string;
  handleEditarMovimiento: (mov: MovimientoTesoreria) => void;
  handleAnularMovimiento: (mov: MovimientoTesoreria) => void;
  handleGuardarMovimiento: () => void;
  handleCerrarModalMovimiento: () => void;
  // S58 Fase 4 — Auto-save de borradores (opcional)
  draftHasDraft?: boolean;
  draftRestored?: boolean;
  draftSavedAt?: Date | null;
  draftSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  draftSavedAgo?: string | null;
  onDraftRestore?: () => void;
  onDraftDiscard?: () => void;
}

export const TabMovimientos: React.FC<TabMovimientosProps> = ({
  movimientosFiltrados,
  cuentas,
  saldosCorridos,
  chartEvolucionSaldo,
  chartEvolucionSaldoUSD,
  totalesMovimientos,
  isMovimientoModalOpen,
  setIsMovimientoModalOpen,
  movimientoEditando,
  movimientoForm,
  setMovimientoForm,
  isSubmitting,
  tcDefault,
  isAdmin,
  esIngreso,
  esIngresoMovimiento,
  getTipoLabel,
  handleEditarMovimiento,
  handleAnularMovimiento,
  // S58 Fase 4
  draftHasDraft,
  draftRestored,
  draftSavedAt,
  draftSaveStatus = 'idle',
  draftSavedAgo,
  onDraftRestore,
  onDraftDiscard,
  handleGuardarMovimiento,
  handleCerrarModalMovimiento,
}) => {
  const [filtroTitular, setFiltroTitular] = useState<string>('');

  // Cross-link CC ↔ Tesorería (S57 Fase B)
  const [ccDrawer, setCCDrawer] = useState<{
    cc: CuentaCorriente | null;
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [ccModalAbierto, setCCModalAbierto] = useState<CuentaCorriente | null>(null);

  // Wizard de pago/cobro distribuido (S58b F3)
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardEntidad, setWizardEntidad] = useState<{
    entidadId: string;
    entidadTipo: CuentaCorriente['tipo'];
    entidadNombre: string;
    saldoUSD: number;
    saldoPEN: number;
  } | null>(null);

  const abrirWizardConCC = (cc: CuentaCorriente) => {
    setWizardEntidad({
      entidadId: cc.entidadId,
      entidadTipo: cc.tipo,
      entidadNombre: cc.entidadNombre,
      saldoUSD: cc.saldoUSD,
      saldoPEN: cc.saldoPEN,
    });
    setWizardOpen(true);
  };

  // Lookup desde un movimiento de tesorería → CC vinculada (si existe)
  const abrirCCDesdeMovimiento = async (movId: string) => {
    setCCDrawer({ cc: null, loading: true, error: null });
    try {
      const movCC = await cuentaCorrienteService.getMovimientoByTesoreriaId(movId);
      if (!movCC) {
        setCCDrawer({
          cc: null,
          loading: false,
          error: 'Este movimiento no tiene contraparte en cuenta corriente.',
        });
        return;
      }
      const cc = await cuentaCorrienteService.getById(movCC.cuentaCorrienteId);
      if (!cc) {
        setCCDrawer({
          cc: null,
          loading: false,
          error: 'Cuenta corriente vinculada no encontrada.',
        });
        return;
      }
      setCCDrawer({ cc, loading: false, error: null });
    } catch (err) {
      setCCDrawer({
        cc: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Error cargando cuenta corriente',
      });
    }
  };

  // Titulares únicos con sus cuentas
  const titularesConCuentas = useMemo(() => {
    const map = new Map<string, string[]>();
    cuentas.forEach(c => {
      if (!c.titular) return;
      const ids = map.get(c.titular) || [];
      ids.push(c.id);
      map.set(c.titular, ids);
    });
    return map;
  }, [cuentas]);

  const titulares = useMemo(() => [...titularesConCuentas.keys()].sort(), [titularesConCuentas]);

  // Movimientos filtrados por titular
  const movsFiltradosPorTitular = useMemo(() => {
    if (!filtroTitular) return movimientosFiltrados;
    const cuentaIds = titularesConCuentas.get(filtroTitular) || [];
    const idSet = new Set(cuentaIds);
    return movimientosFiltrados.filter(m =>
      (m.cuentaOrigen && idSet.has(m.cuentaOrigen)) ||
      (m.cuentaDestino && idSet.has(m.cuentaDestino))
    );
  }, [movimientosFiltrados, filtroTitular, titularesConCuentas]);

  // Totales recalculados con el filtro de titular
  const totalesFiltrados = useMemo(() => {
    if (!filtroTitular) return totalesMovimientos;
    const activos = movsFiltradosPorTitular.filter(m => m.estado !== 'anulado');
    let entradasPEN = 0, salidasPEN = 0, entradasUSD = 0, salidasUSD = 0;
    for (const m of activos) {
      const esIng = esIngresoMovimiento(m);
      if (m.moneda === 'PEN') { if (esIng) entradasPEN += m.monto; else salidasPEN += m.monto; }
      else { if (esIng) entradasUSD += m.monto; else salidasUSD += m.monto; }
    }
    return { entradasPEN, salidasPEN, entradasUSD, salidasUSD, total: activos.length };
  }, [movsFiltradosPorTitular, filtroTitular, totalesMovimientos, esIngresoMovimiento]);

  // Resumen de cuentas del titular seleccionado
  const cuentasTitular = useMemo(() => {
    if (!filtroTitular) return [];
    return cuentas.filter(c => c.titular === filtroTitular);
  }, [cuentas, filtroTitular]);

  // Usar los movimientos filtrados para el render
  const movsRender = movsFiltradosPorTitular;
  const totalesRender = totalesFiltrados;

  const movimientoColumns: DataTableColumn<MovimientoTesoreria>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      render: (mov) => (
        <span className={`text-sm text-slate-500${mov.estado === 'anulado' ? ' opacity-50' : ''}`}>
          {formatDate(mov.fecha)}
        </span>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (mov) => (
        <div className={`flex flex-col gap-1${mov.estado === 'anulado' ? ' opacity-50' : ''}`}>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              mov.tipo === 'ingreso_anticipo'
                ? 'bg-purple-100 text-purple-800'
                : esIngresoMovimiento(mov)
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            {esIngresoMovimiento(mov) && <TrendingUp className="h-3 w-3 mr-1" />}
            {!esIngresoMovimiento(mov) && <TrendingDown className="h-3 w-3 mr-1" />}
            {getTipoLabel(mov.tipo)}
          </span>
          {mov.estado === 'anulado' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-600">
              ANULADO
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'doc',
      header: 'Doc.',
      render: (mov) => (
        <span className={mov.estado === 'anulado' ? 'opacity-50' : ''}>
          {mov.ordenCompraNumero ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs font-medium">{mov.ordenCompraNumero}</span>
          ) : mov.ventaNumero ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-xs font-medium">{mov.ventaNumero}</span>
          ) : mov.cotizacionNumero ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 text-xs font-medium">{mov.cotizacionNumero}</span>
          ) : mov.transferenciaNumero ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-xs font-medium">{mov.transferenciaNumero}</span>
          ) : mov.gastoNumero ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-100 text-orange-800 text-xs font-medium">{mov.gastoNumero}</span>
          ) : mov.conversionId ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs font-medium">Conversion</span>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </span>
      ),
    },
    {
      key: 'cuenta',
      header: 'Cuenta',
      render: (mov) => {
        const cuentaId = esIngresoMovimiento(mov) ? mov.cuentaDestino : mov.cuentaOrigen;
        const cuenta = cuentaId ? cuentas.find(c => c.id === cuentaId) : null;
        if (cuenta) {
          const saldos = saldosCorridos.get(mov.id);
          return (
            <div className={`flex flex-col${mov.estado === 'anulado' ? ' opacity-50' : ''}`}>
              <span className="font-medium text-slate-900 truncate max-w-[120px]" title={cuenta.nombre}>
                {cuenta.nombre}
              </span>
              {saldos && saldos.pen !== 0 && saldos.usd !== 0 ? (
                <div className="flex gap-2 text-xs text-slate-500">
                  <span className={mov.moneda === 'PEN' ? 'font-semibold text-slate-700' : ''}>
                    S/{saldos.pen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className={mov.moneda === 'USD' ? 'font-semibold text-slate-700' : ''}>
                    ${saldos.usd.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-500">
                  Saldo: {mov.moneda === 'USD' ? '$' : 'S/'}{(saldos ? (mov.moneda === 'USD' ? saldos.usd : saldos.pen) : 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          );
        }
        return <span className={`text-slate-400${mov.estado === 'anulado' ? ' opacity-50' : ''}`}>-</span>;
      },
    },
    {
      key: 'concepto',
      header: 'Concepto',
      render: (mov) => (
        <span
          className={`text-sm text-slate-900 block max-w-xs truncate${mov.estado === 'anulado' ? ' opacity-50' : ''}`}
          title={mov.concepto}
        >
          {mov.concepto || '-'}
        </span>
      ),
    },
    {
      key: 'soles',
      header: 'Soles (S/)',
      align: 'right',
      render: (mov) => {
        const esIngresoPEN = mov.moneda === 'PEN' && esIngresoMovimiento(mov);
        return (
          <span className={`text-sm font-medium${mov.estado === 'anulado' ? ' opacity-50' : ''}`}>
            {mov.moneda === 'PEN' ? (
              <span className={esIngresoPEN ? 'text-emerald-600' : 'text-red-600'}>
                {esIngresoPEN ? '+' : '-'} S/ {mov.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </span>
            ) : (
              <span className="text-slate-300">-</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'dolares',
      header: 'Dolares ($)',
      align: 'right',
      render: (mov) => {
        const esIngresoUSD = mov.moneda === 'USD' && esIngresoMovimiento(mov);
        return (
          <span className={`text-sm font-medium${mov.estado === 'anulado' ? ' opacity-50' : ''}`}>
            {mov.moneda === 'USD' ? (
              <span className={esIngresoUSD ? 'text-emerald-600' : 'text-red-600'}>
                {esIngresoUSD ? '+' : '-'} $ {mov.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </span>
            ) : (
              <span className="text-slate-300">-</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'tc',
      header: 'TC',
      align: 'right',
      render: (mov) => (
        <span className={`text-sm text-slate-500${mov.estado === 'anulado' ? ' opacity-50' : ''}`}>
          {mov.tipoCambio.toFixed(3)}
        </span>
      ),
    },
    {
      key: 'cc',
      header: 'CC',
      align: 'center',
      render: (mov) => {
        // Solo movimientos con contraparte potencial en CC
        // (los gastos sueltos, conversiones y transferencias no aplican)
        const tieneContraparte = !!(
          mov.ordenCompraId ||
          mov.ventaId ||
          mov.cotizacionId ||
          mov.transferenciaId
        );
        if (!tieneContraparte) {
          return <span className="text-slate-300 text-[10px]">—</span>;
        }
        return (
          <button
            onClick={() => abrirCCDesdeMovimiento(mov.id)}
            className="inline-flex items-center justify-center w-7 h-7 rounded text-teal-600 hover:bg-teal-50 hover:text-teal-700 transition"
            title="Ver cuenta corriente vinculada"
          >
            <Coins className="h-4 w-4" />
          </button>
        );
      },
    },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'center',
      render: (mov) => (
        mov.estado !== 'anulado' && isAdmin ? (
          <div className="flex justify-center gap-1">
            <button
              onClick={() => handleEditarMovimiento(mov)}
              className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-full transition-colors"
              title="Editar movimiento"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleAnularMovimiento(mov)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="Anular movimiento"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null
      ),
    },
  ];

  return (
    <>
      {/* ─── Imp-L6 · Header banking-grade S58e M6 ─────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-teal-600" />
            Movimientos
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Libro mayor unificado · {movsRender.length} {movsRender.length === 1 ? 'movimiento' : 'movimientos'}
          </p>
        </div>
      </div>

      {/* KPI row del periodo · Imp-L6 */}
      <MovimientosKpiRow movimientos={movsRender} tipoCambio={tcDefault} />

      {/* Layout principal: contenido + sidebar donut */}
      <div className="flex gap-4 items-start flex-col lg:flex-row mb-4">
        <div className="flex-1 min-w-0 w-full">

      <Card padding="none">
        <div className="px-4 sm:px-6 py-3 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Imp-L11 · Header h3 duplicado eliminado. El título del módulo
                vive arriba en el header banking-grade. Aquí solo filtros. */}
            {titulares.length > 0 && (
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={filtroTitular}
                  onChange={e => setFiltroTitular(e.target.value)}
                  className={`rounded-md border-slate-300 text-xs py-1 pl-2 pr-6 focus:border-teal-500 focus:ring-teal-500 ${
                    filtroTitular ? 'bg-teal-50 border-teal-300 text-teal-700 font-medium' : ''
                  }`}
                >
                  <option value="">Todos los titulares</option>
                  {titulares.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {filtroTitular && (
                  <button onClick={() => setFiltroTitular('')}
                    className="p-0.5 text-slate-400 hover:text-slate-600 rounded-full">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
          <Button variant="primary-soft" onClick={() => setIsMovimientoModalOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
            <span className="sm:hidden">Nuevo</span>
            <span className="hidden sm:inline">Nuevo Movimiento</span>
          </Button>
        </div>

        {/* Resumen del titular seleccionado */}
        {filtroTitular && cuentasTitular.length > 0 && (
          <div className="px-4 sm:px-6 py-3 bg-teal-50/50 border-b border-teal-100">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-teal-600" />
              <span className="text-sm font-semibold text-teal-800">{filtroTitular}</span>
              <span className="text-xs text-teal-500">{cuentasTitular.length} cuenta{cuentasTitular.length > 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {cuentasTitular.map(c => {
                const saldo = c.esBiMoneda
                  ? `S/${(c.saldoPEN || 0).toFixed(2)} / $${(c.saldoUSD || 0).toFixed(2)}`
                  : `${c.moneda === 'USD' ? '$' : 'S/'}${(c.saldoActual || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
                const prodLabel = c.productoFinanciero === 'cuenta_ahorros' ? 'Ahorros' :
                  c.productoFinanciero === 'cuenta_corriente' ? 'Corriente' :
                  c.productoFinanciero === 'tarjeta_credito' ? 'TC' :
                  c.productoFinanciero === 'tarjeta_debito' ? 'TD' :
                  c.productoFinanciero === 'billetera_digital' ? 'Digital' :
                  c.productoFinanciero === 'caja' ? 'Caja' : '';
                return (
                  <div key={c.id} className="text-xs px-3 py-2 rounded-lg bg-white border border-teal-200 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.moneda === 'USD' ? 'bg-sky-400' : 'bg-emerald-400'}`} />
                      <span className="font-medium text-slate-800">{c.nombre}</span>
                      {prodLabel && <span className="text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-500">{prodLabel}</span>}
                      <span className="text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-500">{c.moneda}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                      <span>
                        {(() => {
                          const esCaja = c.productoFinanciero === 'caja' || c.tipo === 'efectivo';
                          const esDigital = c.productoFinanciero === 'billetera_digital' || c.tipo === 'digital';
                          const label = esCaja ? 'Efectivo' : esDigital ? 'Digital' : c.tipo === 'credito' ? 'Crédito' : 'Banca';
                          const color = esCaja ? 'bg-emerald-50 text-emerald-600' : esDigital ? 'bg-purple-50 text-purple-600' : c.tipo === 'credito' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600';
                          return <span className={`text-[9px] px-1 py-0.5 rounded mr-1 ${color}`}>{label}</span>;
                        })()}
                        {c.banco && <span>{c.banco}</span>}
                        {c.numeroCuenta && <span> · #{c.numeroCuenta}</span>}
                      </span>
                      <span className="font-semibold text-slate-800">{saldo}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Graficas Evolución de Saldo */}
        {(chartEvolucionSaldo.length > 1 || chartEvolucionSaldoUSD.length > 1) && (
          <div className="px-4 sm:px-6 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {chartEvolucionSaldo.length > 1 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Evolución de Saldo (PEN)
                </h4>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartEvolucionSaldo}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v: number) => v >= 1000 ? `S/${(v / 1000).toFixed(1)}K` : `S/${v}`}
                        width={70}
                      />
                      <Tooltip
                        formatter={(value: number) => [`S/ ${value.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, 'Saldo']}
                        contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Line type="monotone" dataKey="saldo" stroke="#10B981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {chartEvolucionSaldoUSD.length > 1 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-sky-500" />
                  Evolución de Saldo (USD)
                </h4>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartEvolucionSaldoUSD}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v}`}
                        width={70}
                      />
                      <Tooltip
                        formatter={(value: number) => [`$ ${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Saldo']}
                        contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Line type="monotone" dataKey="saldo" stroke="#3B82F6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Totales de movimientos */}
        {movsRender.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
              <div>
                <span className="text-slate-500">Entradas:</span>
                {totalesRender.entradasPEN > 0 && (
                  <span className="ml-2 font-semibold text-emerald-600">+S/ {totalesRender.entradasPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                )}
                {totalesRender.entradasUSD > 0 && (
                  <span className="ml-2 font-semibold text-emerald-600">+$ {totalesRender.entradasUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                )}
              </div>
              <div className="text-right">
                <span className="text-slate-500">Salidas:</span>
                {totalesRender.salidasPEN > 0 && (
                  <span className="ml-2 font-semibold text-red-600">-S/ {totalesRender.salidasPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                )}
                {totalesRender.salidasUSD > 0 && (
                  <span className="ml-2 font-semibold text-red-600">-$ {totalesRender.salidasUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                )}
              </div>
            </div>
            <div className="mt-1 pt-1 border-t border-slate-200 flex justify-between text-xs sm:text-sm">
              <span className="text-slate-500">Balance neto:</span>
              <div className="flex gap-3">
                {(totalesRender.entradasPEN > 0 || totalesMovimientos.salidasPEN > 0) && (
                  <span className={`font-bold ${(totalesRender.entradasPEN - totalesMovimientos.salidasPEN) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {(totalesRender.entradasPEN - totalesMovimientos.salidasPEN) >= 0 ? '+' : ''}S/ {(totalesRender.entradasPEN - totalesMovimientos.salidasPEN).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                )}
                {(totalesRender.entradasUSD > 0 || totalesMovimientos.salidasUSD > 0) && (
                  <span className={`font-bold ${(totalesRender.entradasUSD - totalesMovimientos.salidasUSD) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {(totalesRender.entradasUSD - totalesMovimientos.salidasUSD) >= 0 ? '+' : ''}$ {(totalesRender.entradasUSD - totalesMovimientos.salidasUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mobile card layout */}
        <div className="md:hidden divide-y divide-slate-200">
          {movsRender.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500">
              {filtroTitular ? `No hay movimientos para ${filtroTitular}` : 'No hay movimientos registrados'}
            </div>
          ) : (
            movsRender.map((mov) => {
              const esIng = esIngresoMovimiento(mov);
              return (
                <div
                  key={mov.id}
                  className={`px-4 py-3 space-y-2 ${mov.estado === 'anulado' ? 'opacity-50 bg-slate-100' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-500">{formatDate(mov.fecha)}</span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          mov.tipo === 'ingreso_anticipo'
                            ? 'bg-purple-100 text-purple-800'
                            : esIng
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {esIng ? <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> : <TrendingDown className="h-2.5 w-2.5 mr-0.5" />}
                        {getTipoLabel(mov.tipo)}
                      </span>
                      {mov.estado === 'anulado' && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600">
                          ANULADO
                        </span>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className={`text-sm font-bold ${esIng ? 'text-emerald-600' : 'text-red-600'}`}>
                        {esIng ? '+' : '-'} {mov.moneda === 'USD' ? '$' : 'S/'} {mov.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-slate-400">TC: {mov.tipoCambio.toFixed(3)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {mov.ordenCompraNumero && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-medium">{mov.ordenCompraNumero}</span>}
                    {mov.ventaNumero && <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-medium">{mov.ventaNumero}</span>}
                    {mov.cotizacionNumero && <span className="px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 text-[10px] font-medium">{mov.cotizacionNumero}</span>}
                    {mov.transferenciaNumero && <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 text-[10px] font-medium">{mov.transferenciaNumero}</span>}
                    {mov.gastoNumero && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 text-[10px] font-medium">{mov.gastoNumero}</span>}
                    {mov.conversionId && <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 text-[10px] font-medium">Conversion</span>}
                    {(() => {
                      const cuentaId = esIng ? mov.cuentaDestino : mov.cuentaOrigen;
                      const cuenta = cuentaId ? cuentas.find(c => c.id === cuentaId) : null;
                      return cuenta ? <span className="text-slate-500 truncate max-w-[120px]">{cuenta.nombre}</span> : null;
                    })()}
                  </div>
                  {mov.concepto && (
                    <p className="text-xs text-slate-600 truncate">{mov.concepto}</p>
                  )}
                  {mov.estado !== 'anulado' && isAdmin && (
                    <div className="flex gap-1 pt-1">
                      <button onClick={() => handleEditarMovimiento(mov)} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-full"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleAnularMovimiento(mov)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <DataTable
            columns={movimientoColumns}
            data={movsRender}
            keyExtractor={(mov) => mov.id}
            compact
            emptyMessage={filtroTitular ? `No hay movimientos para ${filtroTitular}` : 'No hay movimientos registrados'}
          />
        </div>
      </Card>

        {/* fin contenido principal · cierra <div className="flex-1 ...> */}
        </div>

        {/* Sidebar donut breakdown · Imp-L6 */}
        <MovimientosBreakdown movimientos={movsRender} tipoCambio={tcDefault} />
      {/* cierra <div className="flex gap-4 ..."> */}
      </div>

      {/* Modal Nuevo/Editar Movimiento — S58 Fase 1 con FormModalV2 */}
      <FormModalV2
        isOpen={isMovimientoModalOpen}
        onClose={handleCerrarModalMovimiento}
        title={movimientoEditando ? `Editar ${movimientoEditando.numeroMovimiento}` : 'Nuevo movimiento'}
        breadcrumb="Cash flow · Movimiento de tesorería"
        icon={ArrowLeftRight}
        iconTone="teal"
        size="lg"
        loading={isSubmitting}
        disabled={isSubmitting || !movimientoForm.monto}
        submitLabel={movimientoEditando ? 'Guardar cambios' : 'Crear movimiento'}
        submitVariant="primary-soft"
        submitIcon={Check}
        onSubmit={handleGuardarMovimiento}
        // S58 Fase 4 — indicador auto-save (solo en modo nuevo, después de restaurar)
        autoSaveStatus={
          !movimientoEditando && draftRestored && draftSaveStatus === 'saved' ? 'saved' : 'idle'
        }
        autoSaveLabel={draftSavedAgo ?? undefined}
      >
        <div className="space-y-6">
          {/* S58 Fase 4 — Banner "Tienes un borrador" cuando hay draft sin restaurar */}
          {!movimientoEditando && draftHasDraft && !draftRestored && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
              <span className="w-8 h-8 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-amber-900">
                  Tienes un borrador sin guardar
                </div>
                <div className="text-[11px] text-amber-700">
                  {draftSavedAt
                    ? `Última edición: ${draftSavedAt.toLocaleString('es-PE', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                    : 'Borrador detectado'}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={onDraftRestore}
                  className="text-[11px] px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-semibold"
                >
                  Continuar
                </button>
                <button
                  type="button"
                  onClick={onDraftDiscard}
                  className="text-[11px] px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md font-medium"
                >
                  Descartar
                </button>
              </div>
            </div>
          )}

          {/* Bloque 1: Dirección + Tipo + Fecha */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">1</span>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Dirección y tipo</span>
              <span
                className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1 ${
                  esIngreso(movimientoForm.tipo as TipoMovimientoTesoreria)
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {esIngreso(movimientoForm.tipo as TipoMovimientoTesoreria) ? (
                  <><ArrowUpCircle className="w-3 h-3" /> Ingreso</>
                ) : (
                  <><ArrowDownCircle className="w-3 h-3" /> Egreso</>
                )}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Combobox<TipoMovimientoTesoreria>
                label="Tipo de movimiento"
                value={movimientoForm.tipo}
                onChange={(v) => setMovimientoForm({ ...movimientoForm, tipo: v })}
                groups={[
                  {
                    label: 'Ingresos',
                    options: [
                      { value: 'ingreso_venta', label: 'Ingreso por venta' },
                      { value: 'ingreso_anticipo', label: 'Anticipo / Adelanto' },
                      { value: 'ingreso_otro', label: 'Otro ingreso' },
                      { value: 'aporte_capital', label: 'Aporte de capital (Socio)' },
                      { value: 'ajuste_positivo', label: 'Ajuste positivo' },
                    ],
                  },
                  {
                    label: 'Egresos',
                    options: [
                      { value: 'pago_orden_compra', label: 'Pago orden de compra' },
                      { value: 'pago_viajero', label: 'Pago a viajero' },
                      { value: 'pago_proveedor_local', label: 'Pago proveedor local' },
                      { value: 'gasto_operativo', label: 'Gasto operativo' },
                      { value: 'retiro_socio', label: 'Retiro socio' },
                      { value: 'ajuste_negativo', label: 'Ajuste negativo' },
                    ],
                  },
                ]}
              />
              <DateField
                label="Fecha"
                value={
                  movimientoForm.fecha instanceof Date && !isNaN(movimientoForm.fecha.getTime())
                    ? movimientoForm.fecha
                    : new Date()
                }
                onChange={(d) =>
                  setMovimientoForm({
                    ...movimientoForm,
                    fecha: d ?? new Date(),
                  })
                }
              />
            </div>
          </div>

          {/* Bloque 2: Monto */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">2</span>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Monto</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ToggleGroup<MonedaTesoreria>
                label="Moneda"
                value={movimientoForm.moneda ?? 'PEN'}
                onChange={(v) => setMovimientoForm({ ...movimientoForm, moneda: v })}
                options={[
                  { value: 'PEN', label: 'PEN' },
                  { value: 'USD', label: 'USD' },
                ]}
              />
              <MoneyField
                label="Monto"
                value={movimientoForm.monto}
                onChange={(v) => setMovimientoForm({ ...movimientoForm, monto: v ?? 0 })}
                moneda={movimientoForm.moneda ?? 'PEN'}
                equivalente={
                  movimientoForm.monto && movimientoForm.tipoCambio
                    ? {
                        valor:
                          movimientoForm.moneda === 'USD'
                            ? movimientoForm.monto * movimientoForm.tipoCambio
                            : movimientoForm.monto / movimientoForm.tipoCambio,
                        moneda: movimientoForm.moneda === 'USD' ? 'PEN' : 'USD',
                        tcUsado: movimientoForm.tipoCambio,
                      }
                    : undefined
                }
              />
              <TextField
                label="Tipo de cambio"
                value={movimientoForm.tipoCambio?.toString() ?? ''}
                onChange={(v) => {
                  const num = parseFloat(v);
                  setMovimientoForm({
                    ...movimientoForm,
                    tipoCambio: isNaN(num) ? undefined : num,
                  });
                }}
                placeholder="3.703"
                rightHint={
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-medium">
                    Día
                  </span>
                }
                hint="Auto-llenado desde tipoCambio.service del día"
                className="[&_input]:tabular-nums"
              />
            </div>
          </div>

          {/* Bloque 3: Cuenta y método */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">3</span>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Cuenta y método</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(() => {
                const esIng = esIngreso(movimientoForm.tipo as TipoMovimientoTesoreria);
                const cuentaSelected = esIng
                  ? movimientoForm.cuentaDestino
                  : movimientoForm.cuentaOrigen;

                const cuentasFiltradas = cuentas.filter(
                  (c) => c.activa && (c.esBiMoneda || c.moneda === movimientoForm.moneda),
                );

                const cuentaGroups: ComboboxGroup<string>[] = [
                  {
                    options: cuentasFiltradas.map((cuenta) => {
                      const saldoActual = cuenta.esBiMoneda
                        ? movimientoForm.moneda === 'USD'
                          ? cuenta.saldoUSD
                          : cuenta.saldoPEN
                        : cuenta.saldoActual;
                      const sym = movimientoForm.moneda === 'USD' ? 'US$' : 'S/';
                      return {
                        value: cuenta.id,
                        label: cuenta.nombre,
                        subLabel: `Saldo ${sym} ${(saldoActual ?? 0).toFixed(2)}`,
                      };
                    }),
                  },
                ];

                return (
                  <Combobox<string>
                    label={esIng ? 'Cuenta destino' : 'Cuenta origen'}
                    value={cuentaSelected}
                    onChange={(v) => {
                      if (esIng) {
                        setMovimientoForm({ ...movimientoForm, cuentaDestino: v });
                      } else {
                        setMovimientoForm({ ...movimientoForm, cuentaOrigen: v });
                      }
                    }}
                    groups={cuentaGroups}
                    placeholder="Seleccionar cuenta..."
                    hint={esIng ? 'Donde entra el dinero' : 'De donde sale el dinero'}
                    emptyMessage={`No hay cuentas activas en ${movimientoForm.moneda}`}
                  />
                );
              })()}
              <Combobox<string>
                label="Método de pago"
                value={movimientoForm.metodo || 'efectivo'}
                onChange={(v) =>
                  setMovimientoForm({
                    ...movimientoForm,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    metodo: v as any,
                  })
                }
                groups={[
                  {
                    options: [
                      { value: 'efectivo', label: 'Efectivo' },
                      { value: 'transferencia_bancaria', label: 'Transferencia bancaria' },
                      { value: 'yape', label: 'Yape' },
                      { value: 'plin', label: 'Plin' },
                      { value: 'mercado_pago', label: 'Mercado Pago' },
                      { value: 'tarjeta', label: 'Tarjeta débito' },
                      { value: 'tarjeta_credito', label: 'Tarjeta crédito' },
                      { value: 'paypal', label: 'PayPal' },
                      { value: 'zelle', label: 'Zelle' },
                      { value: 'otro', label: 'Otro' },
                    ],
                  },
                ]}
              />
            </div>
            {movimientoEditando && (
              <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                <i className="text-amber-600">⚠</i> Al cambiar cuenta/monto/moneda se ajustarán automáticamente los saldos
              </div>
            )}
          </div>

          {/* Bloque 4: Detalle */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">4</span>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Detalle</span>
            </div>
            <div className="space-y-3">
              <TextField
                label="Concepto"
                value={movimientoForm.concepto || ''}
                onChange={(v) => setMovimientoForm({ ...movimientoForm, concepto: v })}
                placeholder="Descripción del movimiento"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField
                  label="Referencia"
                  optional
                  value={movimientoForm.referencia || ''}
                  onChange={(v) => setMovimientoForm({ ...movimientoForm, referencia: v })}
                  placeholder="N° operación, factura..."
                />
                <TextField
                  label="Notas"
                  optional
                  value={movimientoForm.notas || ''}
                  onChange={(v) => setMovimientoForm({ ...movimientoForm, notas: v })}
                  placeholder="Notas adicionales"
                />
              </div>
            </div>
          </div>

          {/* Documentos relacionados (solo en edición) */}
          {movimientoEditando && (movimientoEditando.ordenCompraNumero || movimientoEditando.ventaNumero || movimientoEditando.gastoNumero) && (
            <div className="border-t border-slate-100 pt-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center gap-1.5">
                <ExternalLink className="w-3 h-3" /> Documentos relacionados
              </div>
              <div className="flex flex-wrap gap-1.5">
                {movimientoEditando.ordenCompraNumero && (
                  <span className="text-[11px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-mono">
                    OC: {movimientoEditando.ordenCompraNumero}
                  </span>
                )}
                {movimientoEditando.ventaNumero && (
                  <span className="text-[11px] px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded font-mono">
                    Venta: {movimientoEditando.ventaNumero}
                  </span>
                )}
                {movimientoEditando.gastoNumero && (
                  <span className="text-[11px] px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded font-mono">
                    Gasto: {movimientoEditando.gastoNumero}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </FormModalV2>

      {/* Drawer CC — abierto desde columna "CC" del listado */}
      {ccDrawer && (
        <>
          {ccDrawer.loading ? (
            <div
              className="fixed inset-0 z-[60] flex justify-end"
              onClick={() => setCCDrawer(null)}
            >
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
              <div className="relative w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex items-center justify-center">
                <div className="text-sm text-slate-400 italic">
                  Cargando cuenta corriente vinculada...
                </div>
              </div>
            </div>
          ) : ccDrawer.error ? (
            <div
              className="fixed inset-0 z-[60] flex justify-end"
              onClick={() => setCCDrawer(null)}
            >
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
              <div
                className="relative w-full max-w-md bg-white border-l border-slate-200 shadow-2xl p-6 flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-slate-900">
                    Sin cuenta corriente
                  </span>
                  <button
                    type="button"
                    onClick={() => setCCDrawer(null)}
                    className="text-slate-400 hover:text-slate-700 p-1 hover:bg-slate-100 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-center py-12 text-sm text-slate-500">
                  <Coins className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  {ccDrawer.error}
                </div>
              </div>
            </div>
          ) : ccDrawer.cc ? (
            <EntidadCCDrawer
              cc={ccDrawer.cc}
              onClose={() => setCCDrawer(null)}
              onVerCompleto={(cc) => {
                setCCDrawer(null);
                setCCModalAbierto(cc);
              }}
              onAccionPrincipal={(cc) => {
                setCCDrawer(null);
                abrirWizardConCC(cc);
              }}
            />
          ) : null}
        </>
      )}

      {/* Modal CC completo — abierto desde el botón "Ver detalle completo" del drawer */}
      {ccModalAbierto && (
        <EntidadCCDetailModal
          cc={ccModalAbierto}
          onClose={() => setCCModalAbierto(null)}
          onAccionPrincipal={() => {
            const cc = ccModalAbierto;
            setCCModalAbierto(null);
            abrirWizardConCC(cc);
          }}
        />
      )}

      {/* Wizard de pago/cobro distribuido — S58b F3 */}
      <PagoAbonoWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        entidadPreseleccionada={wizardEntidad ?? undefined}
      />
    </>
  );
};
