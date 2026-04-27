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
} from 'lucide-react';
import { Button, Card } from '../../components/common';
import { FormModal, DataTable } from '../../design-system';
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
      <Card padding="none">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">
              Movimientos ({movsRender.length})
            </h3>
            {/* Filtro por titular */}
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

      {/* Modal Nuevo/Editar Movimiento */}
      <FormModal
        isOpen={isMovimientoModalOpen}
        onClose={handleCerrarModalMovimiento}
        title={movimientoEditando ? `Editar Movimiento ${movimientoEditando.numeroMovimiento}` : 'Nuevo Movimiento'}
        size="lg"
        variant={movimientoEditando ? 'edit' : 'create'}
        submitLabel={isSubmitting ? 'Guardando...' : movimientoEditando ? 'Guardar Cambios' : 'Guardar'}
        onSubmit={handleGuardarMovimiento}
        loading={isSubmitting}
        disabled={isSubmitting || !movimientoForm.monto}
      >
        <div className="space-y-5">
          {/* Seccion 1: Tipo y Clasificacion */}
          <div className={`rounded-lg p-4 border ${esIngreso(movimientoForm.tipo as TipoMovimientoTesoreria) ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              {esIngreso(movimientoForm.tipo as TipoMovimientoTesoreria)
                ? <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                : <ArrowDownCircle className="h-4 w-4 text-red-600" />
              }
              <h4 className={`text-sm font-semibold ${esIngreso(movimientoForm.tipo as TipoMovimientoTesoreria) ? 'text-emerald-800' : 'text-red-800'}`}>
                {esIngreso(movimientoForm.tipo as TipoMovimientoTesoreria) ? 'Ingreso' : 'Egreso'}
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de movimiento</label>
                <select
                  value={movimientoForm.tipo}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, tipo: e.target.value as TipoMovimientoTesoreria })}
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm"
                >
                  <optgroup label="Ingresos">
                    <option value="ingreso_venta">Ingreso por Venta</option>
                    <option value="ingreso_anticipo">Anticipo / Adelanto</option>
                    <option value="ingreso_otro">Otro Ingreso</option>
                    <option value="aporte_capital">Aporte de Capital (Socio)</option>
                    <option value="ajuste_positivo">Ajuste Positivo</option>
                  </optgroup>
                  <optgroup label="Egresos">
                    <option value="pago_orden_compra">Pago Orden de Compra</option>
                    <option value="pago_viajero">Pago a Viajero</option>
                    <option value="pago_proveedor_local">Pago Proveedor Local</option>
                    <option value="gasto_operativo">Gasto Operativo</option>
                    <option value="retiro_socio">Retiro Socio</option>
                    <option value="ajuste_negativo">Ajuste Negativo</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
                <input
                  type="date"
                  value={(() => {
                    if (!movimientoForm.fecha) return new Date().toISOString().split('T')[0];
                    if (movimientoForm.fecha instanceof Date && !isNaN(movimientoForm.fecha.getTime())) {
                      return movimientoForm.fecha.toISOString().split('T')[0];
                    }
                    return new Date().toISOString().split('T')[0];
                  })()}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const [year, month, day] = e.target.value.split('-').map(Number);
                    const nuevaFecha = new Date(year, month - 1, day, new Date().getHours(), new Date().getMinutes());
                    if (!isNaN(nuevaFecha.getTime())) {
                      setMovimientoForm({ ...movimientoForm, fecha: nuevaFecha });
                    }
                  }}
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Seccion 2: Monto y Moneda */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 text-slate-600" />
              <h4 className="text-sm font-semibold text-slate-700">Monto</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Moneda</label>
                <select
                  value={movimientoForm.moneda}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, moneda: e.target.value as MonedaTesoreria })}
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm"
                >
                  <option value="PEN">PEN (Soles)</option>
                  <option value="USD">USD (Dolares)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Monto</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                    {movimientoForm.moneda === 'USD' ? '$' : 'S/'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={movimientoForm.monto || ''}
                    onChange={(e) => setMovimientoForm({ ...movimientoForm, monto: parseFloat(e.target.value) })}
                    className="w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm pl-8"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de Cambio</label>
                <input
                  type="number"
                  step="0.001"
                  value={movimientoForm.tipoCambio || ''}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, tipoCambio: parseFloat(e.target.value) })}
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm"
                  placeholder="3.700"
                />
              </div>
            </div>
            {movimientoForm.monto && movimientoForm.tipoCambio ? (
              <div className="mt-2 text-xs text-slate-500 text-right">
                Equivale a{' '}
                <span className="font-medium text-slate-700">
                  {movimientoForm.moneda === 'USD'
                    ? `S/ ${(movimientoForm.monto * movimientoForm.tipoCambio).toFixed(2)}`
                    : `$ ${(movimientoForm.monto / movimientoForm.tipoCambio).toFixed(2)}`
                  }
                </span>
              </div>
            ) : null}
          </div>

          {/* Seccion 3: Cuenta y Metodo */}
          <div className="bg-sky-50 rounded-lg p-4 border border-sky-200">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-sky-600" />
              <h4 className="text-sm font-semibold text-sky-800">Cuenta y Metodo de Pago</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {esIngreso(movimientoForm.tipo as TipoMovimientoTesoreria) ? 'Cuenta destino (donde entra el dinero)' : 'Cuenta origen (de donde sale el dinero)'}
                </label>
                <select
                  value={(esIngreso(movimientoForm.tipo as TipoMovimientoTesoreria) ? movimientoForm.cuentaDestino : movimientoForm.cuentaOrigen) || ''}
                  onChange={(e) => {
                    const value = e.target.value || undefined;
                    if (esIngreso(movimientoForm.tipo as TipoMovimientoTesoreria)) {
                      setMovimientoForm({ ...movimientoForm, cuentaDestino: value });
                    } else {
                      setMovimientoForm({ ...movimientoForm, cuentaOrigen: value });
                    }
                  }}
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm"
                >
                  <option value="">Seleccionar cuenta...</option>
                  {cuentas
                    .filter(c => c.activa && (c.esBiMoneda || c.moneda === movimientoForm.moneda))
                    .map(cuenta => {
                      const saldoActual = cuenta.esBiMoneda
                        ? (movimientoForm.moneda === 'USD' ? cuenta.saldoUSD : cuenta.saldoPEN)
                        : cuenta.saldoActual;
                      return (
                        <option key={cuenta.id} value={cuenta.id}>
                          {cuenta.nombre} — Saldo: {movimientoForm.moneda === 'USD' ? '$' : 'S/'}{saldoActual?.toFixed(2) || '0.00'}
                        </option>
                      );
                    })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Metodo de pago</label>
                <select
                  value={movimientoForm.metodo || 'efectivo'}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, metodo: e.target.value as any })}
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia_bancaria">Transferencia Bancaria</option>
                  <option value="yape">Yape</option>
                  <option value="plin">Plin</option>
                  <option value="mercado_pago">MercadoPago</option>
                  <option value="tarjeta">Tarjeta Debito</option>
                  <option value="tarjeta_credito">Tarjeta Credito</option>
                  <option value="paypal">PayPal</option>
                  <option value="zelle">Zelle</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
            {movimientoEditando && (
              <div className="mt-3 bg-white/60 rounded p-2 text-xs text-orange-600">
                * Al cambiar cuenta/monto/moneda se ajustaran automaticamente los saldos
              </div>
            )}
          </div>

          {/* Seccion 4: Detalle */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              <h4 className="text-sm font-semibold text-slate-700">Detalle</h4>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Concepto</label>
              <input
                type="text"
                value={movimientoForm.concepto || ''}
                onChange={(e) => setMovimientoForm({ ...movimientoForm, concepto: e.target.value })}
                className="w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm"
                placeholder="Descripcion del movimiento"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Referencia</label>
                <input
                  type="text"
                  value={movimientoForm.referencia || ''}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, referencia: e.target.value })}
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm"
                  placeholder="N° de documento, factura, etc."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notas (opcional)</label>
                <input
                  type="text"
                  value={movimientoForm.notas || ''}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, notas: e.target.value })}
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm"
                  placeholder="Notas adicionales"
                />
              </div>
            </div>
          </div>

          {movimientoEditando && (movimientoEditando.ordenCompraNumero || movimientoEditando.ventaNumero || movimientoEditando.gastoNumero) && (
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-medium text-slate-600">Documentos relacionados</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600 text-xs">
                {movimientoEditando.ordenCompraNumero && (
                  <div className="bg-white rounded px-2 py-1"><span className="font-medium">OC:</span> {movimientoEditando.ordenCompraNumero}</div>
                )}
                {movimientoEditando.ventaNumero && (
                  <div className="bg-white rounded px-2 py-1"><span className="font-medium">Venta:</span> {movimientoEditando.ventaNumero}</div>
                )}
                {movimientoEditando.gastoNumero && (
                  <div className="bg-white rounded px-2 py-1"><span className="font-medium">Gasto:</span> {movimientoEditando.gastoNumero}</div>
                )}
              </div>
            </div>
          )}

        </div>
      </FormModal>

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
            />
          ) : null}
        </>
      )}

      {/* Modal CC completo — abierto desde el botón "Ver detalle completo" del drawer */}
      {ccModalAbierto && (
        <EntidadCCDetailModal
          cc={ccModalAbierto}
          onClose={() => setCCModalAbierto(null)}
        />
      )}
    </>
  );
};
