import React, { useEffect, useState, useMemo } from 'react';
import { useTipoCambio } from '../../hooks/useTipoCambio';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Plus,
  Calendar,
  BarChart3,
  ArrowLeftRight,
  Activity,
  AlertTriangle,
  CheckCircle,
  Info,
  Download,
  Calculator,
} from 'lucide-react';
import { Button, Card, Modal } from '../../components/common';
import { usePoolUSDStore } from '../../store/poolUSDStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import type {
  PoolUSDMovimiento,
  PoolUSDSnapshot,
  PoolUSDResumen,
  TipoMovimientoPool,
  RatioCobertura,
  MargenRealVsNominal,
  PrecioReposicion,
  NecesidadVentasPEN,
  EscenarioTC,
} from '../../types/rendimientoCambiario.types';
import { esEntrada } from '../../types/rendimientoCambiario.types';
import { poolUSDService } from '../../services/poolUSD.service';
import { VentaService } from '../../services/venta.service';
import { getCTRU, getTC } from '../../utils/ctru.utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts';

type TabActiva = 'resumen' | 'operaciones' | 'conversiones' | 'ciclo' | 'simulador' | 'tendencias';

// ============================================================
// LABELS Y HELPERS
// ============================================================

const TIPO_LABELS: Record<TipoMovimientoPool, string> = {
  COMPRA_USD_BANCO: 'Compra USD (Banco)',
  COMPRA_USD_EFECTIVO: 'Compra USD (Efectivo)',
  COBRO_VENTA_USD: 'Cobro Venta USD',
  SALDO_INICIAL: 'Saldo Inicial',
  AJUSTE_CONCILIACION_ENTRADA: 'Ajuste Conciliación (+)',
  PAGO_OC: 'Pago OC',
  GASTO_IMPORTACION_USD: 'Gasto Importación',
  GASTO_SERVICIO_USD: 'Gasto Servicio',
  COMISION_BANCARIA_USD: 'Comisión Bancaria',
  VENTA_USD: 'Venta USD',
  RETIRO_CAPITAL: 'Retiro Capital',
  AJUSTE_CONCILIACION_SALIDA: 'Ajuste Conciliación (-)',
};

function formatMonto(n: number, decimals = 2): string {
  return n.toLocaleString('es-PE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatTC(n: number): string {
  return n.toFixed(4);
}

function formatFecha(ts: any): string {
  if (!ts) return '-';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export const RendimientoCambiario: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const toast = useToastStore();
  const { tc: tcActual } = useTipoCambio();

  const {
    movimientos,
    snapshots,
    resumen,
    loading,
    error,
    fetchMovimientos,
    fetchSnapshots,
    fetchResumen,
    registrarMovimiento,
    registrarSaldoInicial,
    recalcularPool,
    generarSnapshot,
  } = usePoolUSDStore();

  const [tabActiva, setTabActiva] = useState<TabActiva>('resumen');
  const [showNuevoMovimiento, setShowNuevoMovimiento] = useState(false);
  const [showSaldoInicial, setShowSaldoInicial] = useState(false);

  // Form state
  const [formTipo, setFormTipo] = useState<TipoMovimientoPool>('COMPRA_USD_BANCO');
  const [formMonto, setFormMonto] = useState('');
  const [formTC, setFormTC] = useState('');
  const [formFecha, setFormFecha] = useState(new Date().toISOString().split('T')[0]);
  const [formNotas, setFormNotas] = useState('');

  // Saldo inicial form
  const [siMonto, setSiMonto] = useState('');
  const [siTCPA, setSiTCPA] = useState('');
  const [siFecha, setSiFecha] = useState('');

  useEffect(() => {
    fetchMovimientos();
    fetchSnapshots();
    fetchResumen();
  }, []);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleRegistrarMovimiento = async () => {
    if (!user?.uid || !formMonto || !formTC) return;
    try {
      await registrarMovimiento(
        {
          tipo: formTipo,
          montoUSD: parseFloat(formMonto),
          tcOperacion: parseFloat(formTC),
          fecha: new Date(formFecha + 'T12:00:00'),
          notas: formNotas || undefined,
        },
        user.uid
      );
      toast.success('Movimiento registrado correctamente');
      setShowNuevoMovimiento(false);
      setFormMonto('');
      setFormTC('');
      setFormNotas('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSaldoInicial = async () => {
    if (!user?.uid || !siMonto || !siTCPA || !siFecha) return;
    try {
      await registrarSaldoInicial(
        {
          saldoUSD: parseFloat(siMonto),
          tcpa: parseFloat(siTCPA),
          fecha: new Date(siFecha + 'T12:00:00'),
        },
        user.uid
      );
      toast.success('Saldo inicial registrado');
      setShowSaldoInicial(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRecalcular = async () => {
    if (!user?.uid) return;
    try {
      const result = await recalcularPool(user.uid);
      toast.success(
        `Pool recalculado: ${result.movimientosRecalculados} movimientos, ` +
        `saldo $${formatMonto(result.saldoFinal)}, TCPA ${formatTC(result.tcpaFinal)}`
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleGenerarSnapshot = async () => {
    if (!user?.uid) return;
    const ahora = new Date();
    try {
      await generarSnapshot(ahora.getFullYear(), ahora.getMonth() + 1, user.uid);
      toast.success('Snapshot mensual generado');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ============================================================
  // TABS
  // ============================================================

  const tabs: { id: TabActiva; label: string; icon: React.ElementType }[] = [
    { id: 'resumen', label: 'Resumen', icon: BarChart3 },
    { id: 'ciclo', label: 'Ciclo PEN↔USD', icon: TrendingUp },
    { id: 'simulador', label: 'Simulador TC', icon: Calculator },
    { id: 'operaciones', label: 'Operaciones', icon: ArrowLeftRight },
    { id: 'conversiones', label: 'Conversiones', icon: DollarSign },
    { id: 'tendencias', label: 'Tendencias', icon: Activity },
  ];

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rendimiento Cambiario</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pool USD con TCPA — Análisis de impacto cambiario en toda la operación
          </p>
        </div>
        <div className="flex gap-2">
          {movimientos.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSaldoInicial(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Saldo Inicial
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchMovimientos(); fetchResumen(); fetchSnapshots(); }}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Actualizar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowNuevoMovimiento(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Nuevo Movimiento
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTabActiva(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tabActiva === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {tabActiva === 'resumen' && <TabResumen resumen={resumen} tcActual={tcActual} onRecalcular={handleRecalcular} onSnapshot={handleGenerarSnapshot} />}
          {tabActiva === 'ciclo' && <TabCicloPENUSD resumen={resumen} tcActual={tcActual} movimientos={movimientos} />}
          {tabActiva === 'simulador' && <TabSimuladorTC resumen={resumen} tcActual={tcActual} />}
          {tabActiva === 'operaciones' && <TabOperaciones movimientos={movimientos} />}
          {tabActiva === 'conversiones' && <TabConversiones movimientos={movimientos.filter(m => m.documentoOrigenTipo === 'conversion_cambiaria')} />}
          {tabActiva === 'tendencias' && <TabTendencias snapshots={snapshots} movimientos={movimientos} />}
        </>
      )}

      {/* Modal: Nuevo Movimiento */}
      {showNuevoMovimiento && (
        <Modal
          isOpen={showNuevoMovimiento}
          onClose={() => setShowNuevoMovimiento(false)}
          title="Nuevo Movimiento del Pool"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={formTipo}
                onChange={e => setFormTipo(e.target.value as TipoMovimientoPool)}
                className="w-full border rounded-lg p-2 text-sm"
              >
                {Object.entries(TIPO_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {esEntrada(formTipo) ? '↑ Entrada — Recalcula TCPA' : '↓ Salida — No cambia TCPA'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto USD</label>
                <input
                  type="number"
                  step="0.01"
                  value={formMonto}
                  onChange={e => setFormMonto(e.target.value)}
                  className="w-full border rounded-lg p-2 text-sm"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TC Operación</label>
                <input
                  type="number"
                  step="0.0001"
                  value={formTC}
                  onChange={e => setFormTC(e.target.value)}
                  className="w-full border rounded-lg p-2 text-sm"
                  placeholder="3.7000"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={formFecha}
                onChange={e => setFormFecha(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
              <textarea
                value={formNotas}
                onChange={e => setFormNotas(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowNuevoMovimiento(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleRegistrarMovimiento}
                disabled={!formMonto || !formTC}
              >
                Registrar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Saldo Inicial */}
      {showSaldoInicial && (
        <Modal
          isOpen={showSaldoInicial}
          onClose={() => setShowSaldoInicial(false)}
          title="Registrar Saldo Inicial del Pool"
        >
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                <p className="text-sm text-blue-700">
                  Registre el saldo en USD que tenía el negocio al inicio del período a rastrear.
                  El TCPA es el tipo de cambio promedio al que se adquirió ese saldo.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Saldo USD</label>
                <input
                  type="number"
                  step="0.01"
                  value={siMonto}
                  onChange={e => setSiMonto(e.target.value)}
                  className="w-full border rounded-lg p-2 text-sm"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TCPA Estimado</label>
                <input
                  type="number"
                  step="0.0001"
                  value={siTCPA}
                  onChange={e => setSiTCPA(e.target.value)}
                  className="w-full border rounded-lg p-2 text-sm"
                  placeholder="3.7000"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha efectiva</label>
              <input
                type="date"
                value={siFecha}
                onChange={e => setSiFecha(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowSaldoInicial(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaldoInicial}
                disabled={!siMonto || !siTCPA || !siFecha}
              >
                Registrar Saldo Inicial
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ============================================================
// TAB: RESUMEN
// ============================================================

const TabResumen: React.FC<{
  resumen: PoolUSDResumen | null;
  tcActual: any;
  onRecalcular: () => void;
  onSnapshot: () => void;
}> = ({ resumen, tcActual, onRecalcular, onSnapshot }) => {
  if (!resumen) {
    return (
      <div className="text-center py-12 text-gray-500">
        <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>No hay movimientos en el pool</p>
        <p className="text-sm">Registre un saldo inicial o una conversión cambiaria para comenzar</p>
      </div>
    );
  }

  const tcMercado = tcActual?.venta ?? 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Saldo Pool USD</span>
            <DollarSign className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold mt-1">$ {formatMonto(resumen.saldoUSD)}</p>
          <p className="text-xs text-gray-500 mt-1">TCPA: {formatTC(resumen.tcpa)}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Valor según TCPA</span>
            <Calculator className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold mt-1">S/ {formatMonto(resumen.valorPEN_tcpa)}</p>
          <p className="text-xs text-gray-500 mt-1">$ {formatMonto(resumen.saldoUSD)} × {formatTC(resumen.tcpa)}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Valor de Mercado</span>
            <TrendingUp className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold mt-1">S/ {formatMonto(resumen.valorPEN_mercado)}</p>
          <p className="text-xs text-gray-500 mt-1">TC actual: {tcMercado ? formatTC(tcMercado) : '-'}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Ganancia No Realizada</span>
            {resumen.diferenciaNoRealizada >= 0
              ? <TrendingUp className="w-5 h-5 text-green-500" />
              : <TrendingDown className="w-5 h-5 text-red-500" />
            }
          </div>
          <p className={`text-2xl font-bold mt-1 ${resumen.diferenciaNoRealizada >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            S/ {resumen.diferenciaNoRealizada >= 0 ? '+' : ''}{formatMonto(resumen.diferenciaNoRealizada)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Diferencia mercado vs pool</p>
        </Card>
      </div>

      {/* Resumen del período */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Movimiento del Mes</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-600">Entradas USD</span>
              </div>
              <span className="font-medium text-green-600">$ {formatMonto(resumen.entradasUSD)}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-gray-600">Salidas USD</span>
              </div>
              <span className="font-medium text-red-600">$ {formatMonto(resumen.salidasUSD)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Operaciones</span>
              <span className="font-medium">{resumen.cantidadMovimientos}</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Rendimiento Cambiario (Mes)</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Ganancia Realizada (vs SUNAT)</span>
              <span className={`font-medium ${resumen.gananciaRealizadaPEN >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                S/ {resumen.gananciaRealizadaPEN >= 0 ? '+' : ''}{formatMonto(resumen.gananciaRealizadaPEN)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Impacto Operativo (real)</span>
              <span className={`font-medium ${resumen.gananciaOperativaPEN >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                S/ {resumen.gananciaOperativaPEN >= 0 ? '+' : ''}{formatMonto(resumen.gananciaOperativaPEN)}
              </span>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={onRecalcular}>
              <RefreshCw className="w-3 h-3 mr-1" />
              Recalcular Pool
            </Button>
            <Button variant="outline" size="sm" onClick={onSnapshot}>
              <Download className="w-3 h-3 mr-1" />
              Snapshot Mensual
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

// ============================================================
// TAB: POR OPERACIÓN
// ============================================================

const TabOperaciones: React.FC<{ movimientos: PoolUSDMovimiento[] }> = ({ movimientos }) => {
  // Mostrar todos los movimientos en orden más reciente primero
  const sorted = useMemo(() => [...movimientos].reverse(), [movimientos]);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>No hay operaciones registradas</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Fecha</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Tipo</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">Monto USD</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">TC Op.</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">TCPA</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">Pool USD</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">Impacto</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Ref.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map(mov => (
            <tr key={mov.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 whitespace-nowrap">{formatFecha(mov.fecha)}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  {mov.direccion === 'entrada'
                    ? <ArrowUpCircle className="w-3.5 h-3.5 text-green-500" />
                    : <ArrowDownCircle className="w-3.5 h-3.5 text-red-500" />
                  }
                  <span className="text-xs">{TIPO_LABELS[mov.tipo] || mov.tipo}</span>
                </div>
              </td>
              <td className={`px-3 py-2 text-right font-mono ${mov.direccion === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                {mov.direccion === 'entrada' ? '+' : '-'}${formatMonto(mov.montoUSD)}
              </td>
              <td className="px-3 py-2 text-right font-mono">{formatTC(mov.tcOperacion)}</td>
              <td className="px-3 py-2 text-right font-mono">{formatTC(mov.tcpaDespues)}</td>
              <td className="px-3 py-2 text-right font-mono">${formatMonto(mov.poolUSDDespues)}</td>
              <td className="px-3 py-2 text-right font-mono">
                {mov.impactoCambiario != null ? (
                  <span className={mov.impactoCambiario >= 0 ? 'text-green-600' : 'text-red-600'}>
                    S/ {mov.impactoCambiario >= 0 ? '+' : ''}{formatMonto(mov.impactoCambiario)}
                  </span>
                ) : (
                  <span className="text-gray-300">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-gray-500 max-w-[150px] truncate">
                {mov.documentoOrigenNumero || mov.notas || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================
// TAB: CONVERSIONES
// ============================================================

const TabConversiones: React.FC<{ movimientos: PoolUSDMovimiento[] }> = ({ movimientos }) => {
  const sorted = useMemo(() => [...movimientos].reverse(), [movimientos]);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>No hay conversiones vinculadas al pool</p>
        <p className="text-sm">Las conversiones cambiarias registradas en Tesorería aparecerán aquí automáticamente</p>
      </div>
    );
  }

  // Resumen de conversiones
  const totalComprasUSD = sorted.filter(m => m.direccion === 'entrada').reduce((s, m) => s + m.montoUSD, 0);
  const totalVentasUSD = sorted.filter(m => m.direccion === 'salida').reduce((s, m) => s + m.montoUSD, 0);
  const totalImpacto = sorted.reduce((s, m) => s + (m.impactoCambiario ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* KPI mini */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-xs text-gray-500">Compras USD (via conversión)</p>
          <p className="text-lg font-bold text-green-600">$ {formatMonto(totalComprasUSD)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-gray-500">Ventas USD (via conversión)</p>
          <p className="text-lg font-bold text-red-600">$ {formatMonto(totalVentasUSD)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-gray-500">Impacto Cambiario Total</p>
          <p className={`text-lg font-bold ${totalImpacto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            S/ {totalImpacto >= 0 ? '+' : ''}{formatMonto(totalImpacto)}
          </p>
        </Card>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Fecha</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Conversión</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Dirección</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Monto USD</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">TC Real</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">TCPA</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Impacto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map(mov => (
              <tr key={mov.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">{formatFecha(mov.fecha)}</td>
                <td className="px-3 py-2 font-mono text-xs">{mov.documentoOrigenNumero || '-'}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                    mov.direccion === 'entrada'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {mov.direccion === 'entrada' ? 'Compra USD' : 'Venta USD'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono">${formatMonto(mov.montoUSD)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatTC(mov.tcOperacion)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatTC(mov.tcpaDespues)}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {mov.impactoCambiario != null ? (
                    <span className={mov.impactoCambiario >= 0 ? 'text-green-600' : 'text-red-600'}>
                      S/ {mov.impactoCambiario >= 0 ? '+' : ''}{formatMonto(mov.impactoCambiario)}
                    </span>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================
// TAB: TENDENCIAS
// ============================================================

const TabTendencias: React.FC<{
  snapshots: PoolUSDSnapshot[];
  movimientos: PoolUSDMovimiento[];
}> = ({ snapshots, movimientos }) => {
  // Datos para gráfico de evolución del TCPA
  const tcpaData = useMemo(() => {
    return movimientos
      .filter((_, i) => i % Math.max(1, Math.floor(movimientos.length / 50)) === 0) // Sample max 50 points
      .map(m => ({
        fecha: formatFecha(m.fecha),
        tcpa: m.tcpaDespues,
        tcOperacion: m.tcOperacion,
        pool: m.poolUSDDespues,
      }));
  }, [movimientos]);

  // Datos para gráfico de snapshots mensuales
  const snapshotData = useMemo(() => {
    return [...snapshots].reverse().map(s => ({
      periodo: s.periodo,
      saldoUSD: s.saldoUSD,
      tcpa: s.tcpa,
      revaluacion: s.diferenciaRevaluacion,
      ganancia: s.gananciaCambiariaAcumulada,
    }));
  }, [snapshots]);

  if (movimientos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>No hay datos suficientes para mostrar tendencias</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Evolución del TCPA */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Evolución del TCPA</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={tcpaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="tcpa" name="TCPA" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tcOperacion" name="TC Operación" stroke="#9ca3af" strokeWidth={1} dot={false} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Evolución del Pool */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Evolución del Pool USD</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={tcpaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="pool" name="Saldo USD" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Snapshots mensuales */}
      {snapshotData.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Rendimiento Mensual</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={snapshotData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="periodo" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="ganancia" name="Ganancia Cambiaria" fill="#10b981" />
                <Bar dataKey="revaluacion" name="Revaluación" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
};

// ============================================================
// TAB: CICLO PEN↔USD
// ============================================================

const TabCicloPENUSD: React.FC<{
  resumen: PoolUSDResumen | null;
  tcActual: any;
  movimientos: PoolUSDMovimiento[];
}> = ({ resumen, tcActual, movimientos }) => {
  const [ventasData, setVentasData] = useState<{
    totalVentasPEN: number;
    totalCostoUSD: number;
    pipelinePEN: number;
    necesidadUSD: number;
    productos: Array<{
      productoId: string;
      nombreProducto: string;
      precioVenta: number;
      costoUSD: number;
      tcHistorico: number;
      gagoAsignado: number;
    }>;
  } | null>(null);
  const [loadingVentas, setLoadingVentas] = useState(false);

  const tcpa = resumen?.tcpa ?? 0;
  const tcMercado = tcActual?.venta ?? 0;

  // Cargar datos de ventas del mes actual
  useEffect(() => {
    const cargarDatos = async () => {
      setLoadingVentas(true);
      try {
        const ventas = await VentaService.getVentasRecientes(30);

        let totalVentasPEN = 0;
        let totalCostoUSD = 0;
        let pipelinePEN = 0;
        const productosMap = new Map<string, {
          productoId: string;
          nombreProducto: string;
          precioVenta: number;
          costoUSD: number;
          tcHistorico: number;
          gagoAsignado: number;
          count: number;
        }>();

        for (const v of ventas) {
          if (v.estado === 'cancelada') continue;

          // Ventas completadas/confirmadas → totalVentasPEN
          if (['confirmada', 'entregada'].includes(v.estado || '')) {
            totalVentasPEN += v.totalPEN || 0;
          }

          // Ventas pendientes → pipeline
          if (['nueva', 'pendiente', 'procesando'].includes(v.estado || '')) {
            pipelinePEN += v.totalPEN || 0;
          }

          // Agregar productos para análisis de margen
          for (const p of v.productos || []) {
            const key = p.productoId;
            const existing = productosMap.get(key);
            // Estimar costoUSD desde margen y precio si hay costoTotalUnidades
            const costoUSDEstimado = p.costoTotalUnidades && p.cantidad > 0
              ? (p.costoTotalUnidades / p.cantidad) / (tcpa || tcMercado || 3.70)
              : 0;
            if (existing) {
              existing.precioVenta = (existing.precioVenta * existing.count + (p.precioUnitario || 0)) / (existing.count + 1);
              if (costoUSDEstimado > 0 && existing.costoUSD === 0) {
                existing.costoUSD = costoUSDEstimado;
              }
              existing.count++;
            } else {
              productosMap.set(key, {
                productoId: p.productoId,
                nombreProducto: `${p.marca} ${p.nombreComercial}`,
                precioVenta: p.precioUnitario || 0,
                costoUSD: costoUSDEstimado,
                tcHistorico: tcpa || tcMercado || 3.70,
                gagoAsignado: 0,
                count: 1,
              });
            }
          }
        }

        // Estimar necesidad USD desde salidas del pool (últimos 30 días)
        const salidasRecientes = movimientos.filter(m => m.direccion === 'salida');
        const necesidadUSD = salidasRecientes.reduce((sum, m) => sum + m.montoUSD, 0);

        setVentasData({
          totalVentasPEN,
          totalCostoUSD: necesidadUSD,
          pipelinePEN,
          necesidadUSD,
          productos: Array.from(productosMap.values()),
        });
      } catch (err) {
        console.error('[CicloPENUSD] Error cargando datos:', err);
      } finally {
        setLoadingVentas(false);
      }
    };

    cargarDatos();
  }, [movimientos]);

  // Cálculos derivados
  const cobertura = useMemo(() => {
    if (!ventasData || !tcpa) return null;
    return poolUSDService.calcularNecesidadVentas(
      ventasData.necesidadUSD,
      tcMercado || tcpa,
      ventasData.totalVentasPEN + ventasData.pipelinePEN
    );
  }, [ventasData, tcpa, tcMercado]);

  const ratioCobertura = useMemo(() => {
    if (!ventasData || !tcpa) return null;
    const costoPEN = ventasData.totalCostoUSD * tcpa;
    return costoPEN > 0 ? ventasData.totalVentasPEN / costoPEN : 0;
  }, [ventasData, tcpa]);

  const margenAnalysis = useMemo(() => {
    if (!ventasData?.productos.length || !tcpa) return [];
    return poolUSDService.calcularMargenRealVsNominal(ventasData.productos, tcpa);
  }, [ventasData, tcpa]);

  const topGap = useMemo(() => {
    return [...margenAnalysis]
      .filter(m => m.gapCambiario !== 0)
      .sort((a, b) => a.gapCambiario - b.gapCambiario)
      .slice(0, 10);
  }, [margenAnalysis]);

  const preciosReposicion = useMemo(() => {
    if (!ventasData?.productos.length || !tcpa) return [];
    return poolUSDService.calcularPreciosReposicion(
      ventasData.productos.map(p => ({
        ...p,
        gagoEstimado: p.gagoAsignado,
        precioVentaActual: p.precioVenta,
      })),
      tcpa
    );
  }, [ventasData, tcpa]);

  const alertasReposicion = useMemo(() => {
    return preciosReposicion.filter(p => p.alertaReposicion);
  }, [preciosReposicion]);

  if (loadingVentas) {
    return (
      <div className="flex justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!resumen || resumen.saldoUSD === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>No hay datos en el pool para analizar el ciclo PEN↔USD</p>
        <p className="text-sm mt-1">Registre movimientos en el pool para activar este análisis</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ratio de Cobertura + Necesidad de Ventas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Ratio Cobertura</span>
            {(ratioCobertura ?? 0) >= 1
              ? <CheckCircle className="w-5 h-5 text-green-500" />
              : <AlertTriangle className="w-5 h-5 text-amber-500" />
            }
          </div>
          <p className={`text-2xl font-bold mt-1 ${(ratioCobertura ?? 0) >= 1 ? 'text-green-600' : 'text-amber-600'}`}>
            {(ratioCobertura ?? 0).toFixed(2)}x
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Ventas PEN / Costos USD×TCPA
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Ventas PEN (30d)</span>
            <DollarSign className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold mt-1">S/ {formatMonto(ventasData?.totalVentasPEN ?? 0)}</p>
          <p className="text-xs text-gray-500 mt-1">Pipeline: S/ {formatMonto(ventasData?.pipelinePEN ?? 0)}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Necesidad USD</span>
            <ArrowDownCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold mt-1">$ {formatMonto(ventasData?.necesidadUSD ?? 0)}</p>
          <p className="text-xs text-gray-500 mt-1">
            = S/ {formatMonto((ventasData?.necesidadUSD ?? 0) * (tcMercado || tcpa))} al TC mercado
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Cobertura Pipeline</span>
            {cobertura && cobertura.coberturaPipeline >= 1
              ? <CheckCircle className="w-5 h-5 text-green-500" />
              : <AlertTriangle className="w-5 h-5 text-red-500" />
            }
          </div>
          <p className={`text-2xl font-bold mt-1 ${cobertura && cobertura.coberturaPipeline >= 1 ? 'text-green-600' : 'text-red-600'}`}>
            {cobertura ? `${(cobertura.coberturaPipeline * 100).toFixed(0)}%` : '-'}
          </p>
          {cobertura && cobertura.brechaPEN > 0 && (
            <p className="text-xs text-red-500 mt-1">
              Brecha: S/ {formatMonto(cobertura.brechaPEN)}
            </p>
          )}
        </Card>
      </div>

      {/* Margen Real vs Nominal */}
      {topGap.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Gap Cambiario por Producto — Margen Real vs Nominal
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Diferencia entre el margen usando TC histórico (nominal) vs TCPA del pool (real).
            Un gap negativo indica que el margen real es menor al que aparenta.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Producto</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Precio</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">CTRU Nominal</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">CTRU Real</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Margen Nom.</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Margen Real</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Gap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topGap.map(m => (
                  <tr key={m.productoId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 max-w-[200px] truncate">{m.nombreProducto}</td>
                    <td className="px-3 py-2 text-right font-mono">S/ {formatMonto(m.precioVenta)}</td>
                    <td className="px-3 py-2 text-right font-mono">S/ {formatMonto(m.ctruNominal)}</td>
                    <td className="px-3 py-2 text-right font-mono">S/ {formatMonto(m.ctruReal)}</td>
                    <td className="px-3 py-2 text-right font-mono">{m.margenNominalPct.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right font-mono">{m.margenRealPct.toFixed(1)}%</td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold ${m.gapCambiario >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      S/ {m.gapCambiario >= 0 ? '+' : ''}{formatMonto(m.gapCambiario)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Alertas de Reposición */}
      {alertasReposicion.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50/30">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-800">
                Alertas de Precio de Reposición
              </h3>
              <p className="text-xs text-amber-600 mt-0.5">
                Productos cuyo precio de venta no cubre el costo de reposición al TCPA actual ({formatTC(tcpa)})
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {alertasReposicion.map(p => (
              <div key={p.productoId} className="flex items-center justify-between bg-white rounded-lg p-2 border border-amber-200">
                <span className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{p.nombreProducto}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-red-600">
                    Venta: S/ {formatMonto(p.precioVentaActual ?? 0)}
                  </span>
                  <span className="text-amber-700 font-semibold">
                    Reposición: S/ {formatMonto(p.precioMinReposicion)}
                  </span>
                  <span className="text-red-600 font-bold">
                    -{formatMonto(p.precioMinReposicion - (p.precioVentaActual ?? 0))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Info si no hay datos */}
      {!ventasData?.productos.length && (
        <Card className="p-6 text-center">
          <Info className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-500">No hay ventas recientes para analizar el ciclo PEN↔USD</p>
          <p className="text-xs text-gray-400 mt-1">Los datos se cargan de las ventas de los últimos 30 días</p>
        </Card>
      )}
    </div>
  );
};

// ============================================================
// TAB: SIMULADOR TC
// ============================================================

const TabSimuladorTC: React.FC<{
  resumen: PoolUSDResumen | null;
  tcActual: any;
}> = ({ resumen, tcActual }) => {
  const tcMercado = tcActual?.venta ?? 0;
  const tcpa = resumen?.tcpa ?? 0;
  const saldoPoolUSD = resumen?.saldoUSD ?? 0;

  const [tcCustom, setTcCustom] = useState('');

  // Escenarios predefinidos
  const escenarios = useMemo(() => {
    if (!tcMercado || !saldoPoolUSD) return [];
    return poolUSDService.generarEscenariosTC(
      tcMercado,
      saldoPoolUSD,
      tcpa,
      tcpa > 0 ? tcpa * 0.8 : tcMercado * 0.8, // CTRU real promedio estimado
      tcpa > 0 ? tcpa * 1.3 : tcMercado * 1.3, // Precio venta promedio estimado
      saldoPoolUSD * 0.5, // Necesidad USD estimada (50% del pool)
    );
  }, [tcMercado, saldoPoolUSD, tcpa]);

  // Escenario custom
  const escenarioCustom = useMemo(() => {
    const tc = parseFloat(tcCustom);
    if (!tc || !tcMercado || !saldoPoolUSD) return null;
    const variacionPct = ((tc - tcMercado) / tcMercado) * 100;
    const results = poolUSDService.generarEscenariosTC(
      tcMercado,
      saldoPoolUSD,
      tcpa,
      tcpa > 0 ? tcpa * 0.8 : tcMercado * 0.8,
      tcpa > 0 ? tcpa * 1.3 : tcMercado * 1.3,
      saldoPoolUSD * 0.5,
      [variacionPct]
    );
    return results[0] ?? null;
  }, [tcCustom, tcMercado, saldoPoolUSD, tcpa]);

  if (!resumen || resumen.saldoUSD === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Calculator className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>No hay datos en el pool para simular escenarios</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header info */}
      <Card className="p-4 bg-blue-50/50 border-blue-200">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-blue-800">Simulador de Escenarios de Tipo de Cambio</h3>
            <p className="text-xs text-blue-600 mt-1">
              ¿Qué pasa si el TC sube o baja? Este simulador muestra el impacto en tu pool USD, costos de reposición y márgenes.
              TC actual: <strong>{formatTC(tcMercado)}</strong> | TCPA del pool: <strong>{formatTC(tcpa)}</strong> | Pool: <strong>${formatMonto(saldoPoolUSD)}</strong>
            </p>
          </div>
        </div>
      </Card>

      {/* Custom TC input */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Simular TC Específico</h3>
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs text-gray-500 mb-1">Tipo de Cambio</label>
            <input
              type="number"
              step="0.01"
              value={tcCustom}
              onChange={e => setTcCustom(e.target.value)}
              placeholder={tcMercado.toFixed(4)}
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>
          {escenarioCustom && (
            <div className="flex gap-4 text-sm pb-2">
              <div className="text-center">
                <p className="text-xs text-gray-500">Variación</p>
                <p className={`font-bold ${escenarioCustom.variacionPct >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {escenarioCustom.variacionPct >= 0 ? '+' : ''}{escenarioCustom.variacionPct.toFixed(1)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Pool PEN</p>
                <p className={`font-bold ${escenarioCustom.impactoPoolPEN >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {escenarioCustom.impactoPoolPEN >= 0 ? '+' : ''}S/ {formatMonto(escenarioCustom.impactoPoolPEN)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Margen</p>
                <p className={`font-bold ${escenarioCustom.impactoMargenPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {escenarioCustom.impactoMargenPct >= 0 ? '+' : ''}{escenarioCustom.impactoMargenPct.toFixed(1)}%
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Tabla de escenarios predefinidos */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Escenarios Predefinidos</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Escenario</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">TC</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Variación</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Impacto Pool</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Impacto CTRU</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Impacto Margen</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Nec. Ventas PEN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {escenarios.map((esc, i) => {
                const isBase = esc.variacionPct === 0;
                return (
                  <tr key={i} className={isBase ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                    <td className={`px-3 py-2 font-medium ${isBase ? 'text-blue-700' : ''}`}>
                      {esc.nombre}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatTC(esc.tcSimulado)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${esc.variacionPct > 0 ? 'text-red-600' : esc.variacionPct < 0 ? 'text-green-600' : ''}`}>
                      {esc.variacionPct === 0 ? '-' : `${esc.variacionPct > 0 ? '+' : ''}${esc.variacionPct}%`}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${esc.impactoPoolPEN >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {isBase ? '-' : `${esc.impactoPoolPEN >= 0 ? '+' : ''}S/ ${formatMonto(esc.impactoPoolPEN)}`}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${esc.impactoCTRURealPEN > 0 ? 'text-red-600' : esc.impactoCTRURealPEN < 0 ? 'text-green-600' : ''}`}>
                      {isBase ? '-' : `${esc.impactoCTRURealPEN >= 0 ? '+' : ''}S/ ${formatMonto(esc.impactoCTRURealPEN)}`}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${esc.impactoMargenPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {isBase ? '-' : `${esc.impactoMargenPct >= 0 ? '+' : ''}${esc.impactoMargenPct.toFixed(1)}%`}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${esc.impactoNecesidadPEN > 0 ? 'text-red-600' : esc.impactoNecesidadPEN < 0 ? 'text-green-600' : ''}`}>
                      {isBase ? '-' : `${esc.impactoNecesidadPEN >= 0 ? '+' : ''}S/ ${formatMonto(esc.impactoNecesidadPEN)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Gráfico visual de impacto */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Impacto Visual por Escenario</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={escenarios}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="nombre" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value: number) => `S/ ${formatMonto(value)}`} />
              <Legend />
              <Bar dataKey="impactoPoolPEN" name="Pool PEN" fill="#3b82f6" />
              <Bar dataKey="impactoNecesidadPEN" name="Necesidad PEN" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
