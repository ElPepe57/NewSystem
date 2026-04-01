import React, { useState, useMemo } from 'react';
import { formatFecha as formatDate } from '../../utils/dateFormatters';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Building2,
  Banknote,
  Edit2,
  FileText,
  XCircle,
  RefreshCw,
  CreditCard,
  Wallet,
  Smartphone,
  Settings2,
  Trash2,
} from 'lucide-react';
import { Button, Card, FormSection } from '../../components/common';
import { BancoNuevoForm } from './BancoNuevoForm';
import { CuentaBancoForm } from './CuentaBancoForm';
import { EditarMetodosBancoModal } from './EditarMetodosBancoModal';
import { DigitalForm } from './DigitalForm';
import { EfectivoForm } from './EfectivoForm';
import type {
  MovimientoTesoreria,
  CuentaCaja,
  CuentaCajaFormData,
  TipoMovimientoTesoreria
} from '../../types/tesoreria.types';
import { getNumeroPrincipal } from '../../types/tesoreria.types';

interface TabCuentasProps {
  cuentas: CuentaCaja[];
  movimientosFiltrados: MovimientoTesoreria[];
  cuentaDetalle: CuentaCaja | null;
  setCuentaDetalle: (c: CuentaCaja | null) => void;
  movsLimit: number;
  setMovsLimit: React.Dispatch<React.SetStateAction<number>>;
  isSubmitting: boolean;
  handleRecalcularSaldos: () => void;
  handleGuardarCuentaNueva: (data: CuentaCajaFormData) => void;
  handleGuardarEdicion: (cuenta: CuentaCaja, data: CuentaCajaFormData) => void;
  handleGuardarMetodosBanco: (bancoNombre: string, metodos: string[], detalle?: Record<string, { identificador?: string; cuentaVinculadaId?: string }>) => void;
  handleEliminarCuenta: (cuenta: CuentaCaja) => void;
  getTipoLabel: (tipo: TipoMovimientoTesoreria) => string;
  esIngresoMovimiento: (mov: MovimientoTesoreria) => boolean;
}

export const TabCuentas: React.FC<TabCuentasProps> = ({
  cuentas,
  movimientosFiltrados,
  cuentaDetalle,
  setCuentaDetalle,
  movsLimit,
  setMovsLimit,
  isSubmitting,
  handleRecalcularSaldos,
  handleGuardarCuentaNueva,
  handleGuardarEdicion,
  handleGuardarMetodosBanco,
  handleEliminarCuenta,
  getTipoLabel,
}) => {
  // Modal states
  const [showBancoNuevo, setShowBancoNuevo] = useState(false);
  const [showDigital, setShowDigital] = useState(false);
  const [showEfectivo, setShowEfectivo] = useState(false);
  const [showCuentaBanco, setShowCuentaBanco] = useState(false);
  const [bancoParaCuenta, setBancoParaCuenta] = useState('');
  const [cuentaEditando, setCuentaEditando] = useState<CuentaCaja | null>(null);
  const [showMetodos, setShowMetodos] = useState(false);
  const [bancoParaMetodos, setBancoParaMetodos] = useState('');
  const [metodosActuales, setMetodosActuales] = useState<string[]>([]);
  const [metodosDetalleActuales, setMetodosDetalleActuales] = useState<Record<string, { identificador?: string; cuentaVinculadaId?: string }>>({});
  const [cuentasBancoParaMetodos, setCuentasBancoParaMetodos] = useState<CuentaCaja[]>([]);

  // Agrupar cuentas
  const { bancos, digitales, efectivo } = useMemo(() => {
    const bancos = new Map<string, CuentaCaja[]>();
    const digitales: CuentaCaja[] = [];
    const efectivo: CuentaCaja[] = [];

    cuentas.forEach(c => {
      if (c.tipo === 'digital') {
        digitales.push(c);
      } else if (c.tipo === 'efectivo') {
        efectivo.push(c);
      } else if (c.banco) {
        // banco o credito con banco
        const arr = bancos.get(c.banco) || [];
        arr.push(c);
        bancos.set(c.banco, arr);
      } else {
        // Legacy sin banco — mostrar en efectivo como fallback
        efectivo.push(c);
      }
    });

    return { bancos, digitales, efectivo };
  }, [cuentas]);

  const totalBancoCuentas = [...bancos.values()].reduce((sum, arr) => sum + arr.length, 0);

  // Titulares únicos para autocomplete
  const titularesExistentes = useMemo(() =>
    [...new Set(cuentas.map(c => c.titular).filter(Boolean))].sort(),
  [cuentas]);

  const abrirCuentaBanco = (banco: string) => {
    setBancoParaCuenta(banco);
    setShowCuentaBanco(true);
  };

  const abrirMetodos = (banco: string, cuentasBancoArr: CuentaCaja[]) => {
    setBancoParaMetodos(banco);
    setMetodosActuales(cuentasBancoArr[0]?.metodosDisponibles || []);
    setMetodosDetalleActuales(cuentasBancoArr[0]?.metodosDetalle || {});
    setCuentasBancoParaMetodos(cuentasBancoArr);
    setShowMetodos(true);
  };

  const guardarMetodos = (metodos: string[], detalle: Record<string, { identificador?: string; cuentaVinculadaId?: string }>) => {
    handleGuardarMetodosBanco(bancoParaMetodos, metodos, detalle);
    setShowMetodos(false);
  };

  // Render saldo de cuenta
  const renderSaldo = (cuenta: CuentaCaja) => {
    if (cuenta.esBiMoneda) {
      return (
        <div className="space-y-0.5 text-right">
          <div className="text-sm font-bold text-green-600">S/ {(cuenta.saldoPEN || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</div>
          <div className="text-sm font-bold text-blue-600">$ {(cuenta.saldoUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
      );
    }
    if (cuenta.lineaCredito) {
      return (
        <div className="text-right">
          <div className="text-sm font-bold text-amber-700">
            Disp: {cuenta.moneda === 'USD' ? '$' : 'S/'} {(cuenta.lineaCredito.disponible || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-gray-400">
            Línea: {cuenta.moneda === 'USD' ? '$' : 'S/'} {(cuenta.lineaCredito.limiteTotal || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </div>
        </div>
      );
    }
    return (
      <div className="text-lg font-bold text-gray-900">
        {cuenta.moneda === 'PEN' ? 'S/' : '$'} {cuenta.saldoActual.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
      </div>
    );
  };

  // Render fila de cuenta (dentro de un banco)
  const renderCuentaRow = (cuenta: CuentaCaja) => (
    <div
      key={cuenta.id}
      className={`px-4 py-3 flex items-center justify-between group cursor-pointer transition-all hover:bg-white ${
        cuentaDetalle?.id === cuenta.id ? 'bg-white ring-1 ring-primary-200' : ''
      }`}
      onClick={() => { setCuentaDetalle(cuentaDetalle?.id === cuenta.id ? null : cuenta); setMovsLimit(50); }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-1.5 self-stretch rounded-full flex-shrink-0 ${
          cuenta.tipo === 'credito' ? 'bg-amber-400' :
          cuenta.moneda === 'USD' ? 'bg-blue-400' : 'bg-green-400'
        }`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 truncate">{cuenta.nombre}</span>
            {cuenta.productoFinanciero && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">
                {cuenta.productoFinanciero === 'cuenta_ahorros' ? 'Ahorros' :
                 cuenta.productoFinanciero === 'cuenta_corriente' ? 'Corriente' :
                 cuenta.productoFinanciero === 'tarjeta_credito' ? 'TC' :
                 cuenta.productoFinanciero === 'tarjeta_debito' ? 'TD' :
                 cuenta.productoFinanciero}
              </span>
            )}
            {cuenta.titularidad === 'personal' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 flex-shrink-0">Personal</span>
            )}
            {cuenta.esBiMoneda && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gradient-to-r from-green-100 to-blue-100 text-gray-600 flex-shrink-0">Bi-Moneda</span>
            )}
            {cuenta.moneda === 'USD' && !cuenta.esBiMoneda && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 flex-shrink-0">USD</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
            {getNumeroPrincipal(cuenta) && <span>#{getNumeroPrincipal(cuenta)}</span>}
            {(cuenta.numerosCuenta?.length || 0) > 1 && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-500">+{(cuenta.numerosCuenta!.length - 1)} más</span>
            )}
            {cuenta.titular && <span>· {cuenta.titular}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {renderSaldo(cuenta)}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={(e) => { e.stopPropagation(); (() => { setCuentaEditando(cuenta); setBancoParaCuenta(cuenta.banco || ''); setShowCuentaBanco(true); })(); }}
            className="p-1.5 text-gray-300 hover:text-primary-600 hover:bg-primary-50 rounded-full"
            title="Editar cuenta"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleEliminarCuenta(cuenta); }}
            className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full"
            title="Eliminar cuenta"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  // Render card para digital/efectivo
  const renderCuentaCard = (cuenta: CuentaCaja) => (
    <div key={cuenta.id}
      className={`relative rounded-xl border bg-white p-4 group cursor-pointer hover:shadow-sm transition-all ${
        cuentaDetalle?.id === cuenta.id ? 'ring-1 ring-primary-200 border-primary-200' : 'border-gray-200'
      }`}
      onClick={() => { setCuentaDetalle(cuentaDetalle?.id === cuenta.id ? null : cuenta); setMovsLimit(50); }}
    >
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={(e) => { e.stopPropagation(); (() => { setCuentaEditando(cuenta); setBancoParaCuenta(cuenta.banco || ''); setShowCuentaBanco(true); })(); }}
          className="p-1.5 text-gray-300 hover:text-primary-600 hover:bg-primary-50 rounded-full"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleEliminarCuenta(cuenta); }}
          className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <h4 className="font-medium text-gray-900 pr-16">{cuenta.nombre}</h4>
      <div className="text-xs text-gray-400 mt-0.5">
        {cuenta.moneda}{cuenta.titularidad ? ` · ${cuenta.titularidad === 'empresa' ? 'Empresa' : 'Personal'}` : ''}
      </div>
      {cuenta.titular && <div className="text-xs text-gray-400">{cuenta.titular}</div>}
      <div className="mt-3">
        {renderSaldo(cuenta)}
      </div>
    </div>
  );

  return (
    <>
      <Card padding="none">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            Cuentas de Caja ({cuentas.length})
          </h3>
          <Button variant="outline" onClick={handleRecalcularSaldos}
            disabled={isSubmitting || cuentas.length === 0} title="Recalcular saldos">
            <RefreshCw className={`h-4 w-4 mr-1 ${isSubmitting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Recalcular</span>
          </Button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* ==================== SECCIÓN BANCOS ==================== */}
          <FormSection
            title="Bancos"
            icon={<Building2 className="h-4 w-4" />}
            defaultOpen
            badge={
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">{bancos.size} banco{bancos.size !== 1 ? 's' : ''} · {totalBancoCuentas} cuenta{totalBancoCuentas !== 1 ? 's' : ''}</span>
                <button onClick={(e) => { e.stopPropagation(); setShowBancoNuevo(true); }}
                  className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 px-2 py-1 rounded-md transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Banco
                </button>
              </div>
            }
          >
            {bancos.size === 0 ? (
              <div className="text-center py-6">
                <Building2 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No hay bancos registrados</p>
                <button onClick={() => setShowBancoNuevo(true)}
                  className="mt-2 text-sm text-primary-600 hover:underline">+ Agregar primer banco</button>
              </div>
            ) : (
              <div className="space-y-3">
                {[...bancos.entries()].map(([banco, cuentasBanco]) => (
                  <div key={banco} className="rounded-xl border border-blue-200 bg-blue-50/30 overflow-hidden">
                    {/* Header del banco */}
                    <div className="px-4 py-3 bg-blue-50 flex items-center justify-between border-b border-blue-100">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        <h4 className="font-semibold text-gray-900">{banco}</h4>
                        {cuentasBanco[0]?.bancoNombreCompleto && (
                          <span className="text-xs text-gray-500 hidden sm:inline">({cuentasBanco[0].bancoNombreCompleto})</span>
                        )}
                        <span className="text-xs text-gray-400">{cuentasBanco.length} cuenta{cuentasBanco.length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {cuentasBanco[0]?.metodosDisponibles?.length ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {cuentasBanco[0].metodosDisponibles.map(m => {
                              const det = cuentasBanco[0]?.metodosDetalle?.[m];
                              const esCanal = ['yape', 'plin'].includes(m);
                              return (
                                <span key={m} className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  esCanal ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {m}{det?.identificador ? ` · ${det.identificador}` : ''}
                                </span>
                              );
                            })}
                          </div>
                        ) : null}
                        <button onClick={() => abrirMetodos(banco, cuentasBanco)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                          title="Editar métodos de pago">
                          <Settings2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Cuentas del banco */}
                    <div className="divide-y divide-blue-100">
                      {cuentasBanco.map(renderCuentaRow)}
                    </div>

                    {/* Agregar cuenta */}
                    <div className="px-4 py-2 border-t border-blue-100 bg-blue-50/50">
                      <button onClick={() => abrirCuentaBanco(banco)}
                        className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                        <Plus className="h-3.5 w-3.5" /> Agregar cuenta en {banco}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FormSection>

          {/* ==================== SECCIÓN DIGITAL ==================== */}
          <FormSection
            title="Digital"
            icon={<Smartphone className="h-4 w-4" />}
            defaultOpen
            badge={
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">{digitales.length} billetera{digitales.length !== 1 ? 's' : ''}</span>
                <button onClick={(e) => { e.stopPropagation(); setShowDigital(true); }}
                  className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 px-2 py-1 rounded-md transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Digital
                </button>
              </div>
            }
          >
            {digitales.length === 0 ? (
              <div className="text-center py-6">
                <Smartphone className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No hay billeteras digitales</p>
                <button onClick={() => setShowDigital(true)}
                  className="mt-2 text-sm text-primary-600 hover:underline">+ Agregar billetera</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {digitales.map(renderCuentaCard)}
              </div>
            )}
          </FormSection>

          {/* ==================== SECCIÓN EFECTIVO ==================== */}
          <FormSection
            title="Efectivo"
            icon={<Banknote className="h-4 w-4" />}
            defaultOpen
            badge={
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">{efectivo.length} caja{efectivo.length !== 1 ? 's' : ''}</span>
                <button onClick={(e) => { e.stopPropagation(); setShowEfectivo(true); }}
                  className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 px-2 py-1 rounded-md transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Caja
                </button>
              </div>
            }
          >
            {efectivo.length === 0 ? (
              <div className="text-center py-6">
                <Banknote className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No hay cajas de efectivo</p>
                <button onClick={() => setShowEfectivo(true)}
                  className="mt-2 text-sm text-primary-600 hover:underline">+ Agregar caja</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {efectivo.map(renderCuentaCard)}
              </div>
            )}
          </FormSection>
        </div>

        {/* ==================== DETALLE MOVIMIENTOS ==================== */}
        {cuentaDetalle && (() => {
          const movsCuenta = movimientosFiltrados.filter(m =>
            m.cuentaOrigen === cuentaDetalle.id || m.cuentaDestino === cuentaDetalle.id
          );
          const movsOrdenados = [...movsCuenta].sort((a, b) => {
            const fa = a.fecha?.toDate ? a.fecha.toDate().getTime() : new Date(a.fecha as any).getTime();
            const fb = b.fecha?.toDate ? b.fecha.toDate().getTime() : new Date(b.fecha as any).getTime();
            return fa - fb;
          });
          let saldoCorridoPEN = 0, saldoCorridoUSD = 0;
          const saldosPorMov = new Map<string, { pen: number; usd: number }>();
          for (const mov of movsOrdenados) {
            if (mov.estado === 'anulado') { saldosPorMov.set(mov.id, { pen: saldoCorridoPEN, usd: saldoCorridoUSD }); continue; }
            const esIngreso = mov.cuentaDestino === cuentaDetalle.id;
            const signo = esIngreso ? 1 : -1;
            if (mov.moneda === 'PEN') saldoCorridoPEN += signo * mov.monto;
            else saldoCorridoUSD += signo * mov.monto;
            saldosPorMov.set(mov.id, { pen: saldoCorridoPEN, usd: saldoCorridoUSD });
          }
          const movsDisplay = [...movsCuenta].sort((a, b) => {
            const fa = a.fecha?.toDate ? a.fecha.toDate().getTime() : new Date(a.fecha as any).getTime();
            const fb = b.fecha?.toDate ? b.fecha.toDate().getTime() : new Date(b.fecha as any).getTime();
            return fb - fa;
          });
          let entPEN = 0, salPEN = 0, entUSD = 0, salUSD = 0;
          for (const mov of movsCuenta) {
            if (mov.estado === 'anulado') continue;
            const esIng = mov.cuentaDestino === cuentaDetalle.id;
            if (mov.moneda === 'PEN') { if (esIng) entPEN += mov.monto; else salPEN += mov.monto; }
            else { if (esIng) entUSD += mov.monto; else salUSD += mov.monto; }
          }

          return (
            <div className="px-4 sm:px-6 pb-4">
              <div className="border border-primary-200 rounded-xl bg-primary-50/30 overflow-hidden">
                <div className="px-4 py-3 border-b border-primary-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary-500" />
                    <h4 className="text-sm font-semibold text-gray-900">Movimientos de {cuentaDetalle.nombre}</h4>
                    <span className="text-xs text-gray-400">({movsCuenta.length})</span>
                  </div>
                  <button onClick={() => setCuentaDetalle(null)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>

                {movsCuenta.length > 0 && (
                  <div className="px-4 py-2.5 bg-white/60 border-b border-primary-100">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Entradas:</span>
                        {entPEN > 0 && <span className="ml-1 font-semibold text-green-600">+S/ {entPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>}
                        {entUSD > 0 && <span className="ml-1 font-semibold text-green-600">+$ {entUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>}
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500">Salidas:</span>
                        {salPEN > 0 && <span className="ml-1 font-semibold text-red-600">-S/ {salPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>}
                        {salUSD > 0 && <span className="ml-1 font-semibold text-red-600">-$ {salUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>}
                      </div>
                    </div>
                  </div>
                )}

                {movsCuenta.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-400 text-sm">No hay movimientos para esta cuenta</div>
                ) : (
                  <>
                    {/* Mobile */}
                    <div className="md:hidden divide-y divide-gray-100">
                      {movsDisplay.slice(0, movsLimit).map((mov) => {
                        const esIngreso = mov.cuentaDestino === cuentaDetalle.id;
                        const saldos = saldosPorMov.get(mov.id);
                        return (
                          <div key={mov.id} className={`px-4 py-2.5 ${mov.estado === 'anulado' ? 'opacity-40' : ''}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-[10px] text-gray-400 flex-shrink-0">{formatDate(mov.fecha)}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${esIngreso ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {esIngreso ? 'Entrada' : 'Salida'}
                                </span>
                              </div>
                              <span className={`text-sm font-bold ${esIngreso ? 'text-green-600' : 'text-red-600'}`}>
                                {esIngreso ? '+' : '-'}{mov.moneda === 'USD' ? '$' : 'S/'} {mov.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 truncate mt-0.5">{mov.concepto}</p>
                            {saldos && (
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                Saldo: {cuentaDetalle.esBiMoneda
                                  ? `S/${saldos.pen.toFixed(2)} | $${saldos.usd.toFixed(2)}`
                                  : `${cuentaDetalle.moneda === 'PEN' ? 'S/' : '$'}${(cuentaDetalle.moneda === 'PEN' ? saldos.pen : saldos.usd).toFixed(2)}`}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-100 text-sm">
                        <thead className="bg-gray-50/50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Doc.</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-green-700 uppercase">Entrada</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-red-700 uppercase">Salida</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {movsDisplay.slice(0, movsLimit).map((mov) => {
                            const esIngreso = mov.cuentaDestino === cuentaDetalle.id;
                            const saldos = saldosPorMov.get(mov.id);
                            const simbolo = mov.moneda === 'USD' ? '$' : 'S/';
                            return (
                              <tr key={mov.id} className={`hover:bg-gray-50 ${mov.estado === 'anulado' ? 'opacity-40' : ''}`}>
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDate(mov.fecha)}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${esIngreso ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {esIngreso ? <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> : <TrendingDown className="h-2.5 w-2.5 mr-0.5" />}
                                    {getTipoLabel(mov.tipo)}
                                  </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {mov.ordenCompraNumero && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-medium">{mov.ordenCompraNumero}</span>}
                                  {mov.ventaNumero && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-medium">{mov.ventaNumero}</span>}
                                  {mov.gastoNumero && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 text-[10px] font-medium">{mov.gastoNumero}</span>}
                                  {!mov.ordenCompraNumero && !mov.ventaNumero && !mov.gastoNumero && <span className="text-gray-300">-</span>}
                                </td>
                                <td className="px-3 py-2 text-gray-700 max-w-[240px] truncate" title={mov.concepto}>{mov.concepto}</td>
                                <td className="px-3 py-2 text-right font-medium text-green-600 whitespace-nowrap">
                                  {esIngreso ? `${simbolo} ${mov.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : ''}
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-red-600 whitespace-nowrap">
                                  {!esIngreso ? `${simbolo} ${mov.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : ''}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                                  {saldos && (
                                    <span>{simbolo} {(cuentaDetalle.esBiMoneda
                                      ? (mov.moneda === 'PEN' ? saldos.pen : saldos.usd)
                                      : (cuentaDetalle.moneda === 'PEN' ? saldos.pen : saldos.usd)
                                    ).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {movsDisplay.length > movsLimit && (
                      <div className="px-4 py-3 text-center border-t border-gray-100">
                        <p className="text-xs text-gray-400">Mostrando {movsLimit} de {movsDisplay.length}</p>
                        <button onClick={() => setMovsLimit(prev => prev + 50)}
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium hover:underline">
                          Ver más movimientos
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </Card>

      {/* Modales */}
      <BancoNuevoForm isOpen={showBancoNuevo} onClose={() => setShowBancoNuevo(false)}
        onGuardar={(data) => { handleGuardarCuentaNueva(data); setShowBancoNuevo(false); }} isSubmitting={isSubmitting}
        titularesExistentes={titularesExistentes} />

      <CuentaBancoForm isOpen={showCuentaBanco}
        onClose={() => { setShowCuentaBanco(false); setCuentaEditando(null); }}
        bancoNombre={bancoParaCuenta}
        cuentaEditando={cuentaEditando}
        onGuardar={(data) => {
          if (cuentaEditando) {
            handleGuardarEdicion(cuentaEditando, data);
          } else {
            handleGuardarCuentaNueva(data);
          }
          setShowCuentaBanco(false);
          setCuentaEditando(null);
        }} isSubmitting={isSubmitting}
        titularesExistentes={titularesExistentes} />

      <EditarMetodosBancoModal isOpen={showMetodos} onClose={() => setShowMetodos(false)}
        bancoNombre={bancoParaMetodos} metodosActuales={metodosActuales}
        metodosDetalleActuales={metodosDetalleActuales}
        cuentasBanco={cuentasBancoParaMetodos}
        onGuardar={guardarMetodos} isSubmitting={isSubmitting} />

      <DigitalForm isOpen={showDigital} onClose={() => setShowDigital(false)}
        onGuardar={(data) => { handleGuardarCuentaNueva(data); setShowDigital(false); }} isSubmitting={isSubmitting}
        titularesExistentes={titularesExistentes} />

      <EfectivoForm isOpen={showEfectivo} onClose={() => setShowEfectivo(false)}
        onGuardar={(data) => { handleGuardarCuentaNueva(data); setShowEfectivo(false); }} isSubmitting={isSubmitting}
        titularesExistentes={titularesExistentes} />
    </>
  );
};
