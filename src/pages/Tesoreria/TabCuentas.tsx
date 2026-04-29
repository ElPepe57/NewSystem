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
  ShieldCheck,
} from 'lucide-react';
import { Button, Card, FormSection } from '../../components/common';
import { DataTable } from '../../design-system';
import type { DataTableColumn } from '../../design-system';
import { CuentaWizard } from './CuentaWizard';
import { VistaPorTitular } from './VistaPorTitular';
import { useTarjetaCreditoStore } from '../../store/tarjetaCreditoStore';
import { useTesoreriaStore } from '../../store/tesoreriaStore';
import { TarjetaDetailModal } from './TarjetasCreditoV2';
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
  handleReconciliarPagos: () => void;
  handleGuardarCuentaNueva: (data: CuentaCajaFormData) => void;
  handleGuardarEdicion: (cuenta: CuentaCaja, data: CuentaCajaFormData) => void;
  handleGuardarMetodosBanco: (bancoNombre: string, metodos: string[]) => void;
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
  handleReconciliarPagos,
  handleGuardarCuentaNueva,
  handleGuardarEdicion,
  handleGuardarMetodosBanco,
  handleEliminarCuenta,
  getTipoLabel,
}) => {
  // F5a · ADR-PF-001 · estados de forms legacy eliminados.
  // Solo persiste el wizard universal y el estado de edición.
  const [showWizard, setShowWizard] = useState(false);
  const [cuentaEditando, setCuentaEditando] = useState<CuentaCaja | null>(null);

  // S58c parte 2 — Toggle vista (por tipo / por titular)
  const [vista, setVista] = useState<'tipo' | 'titular'>('titular');
  const tarjetas = useTarjetaCreditoStore((s) => s.tarjetas);
  // F3c · refresh tras crear con wizard nuevo (camino self-contained)
  const fetchCuentasUnificadas = useTesoreriaStore((s) => s.fetchCuentas);
  const fetchTarjetas = useTarjetaCreditoStore((s) => s.fetchTarjetas);
  const [tarjetaDetalle, setTarjetaDetalle] = useState<
    import('../../types/tarjetaCredito.types').TarjetaCredito | null
  >(null);

  // Cargar tarjetas si la vista por titular las necesita y no están cargadas
  React.useEffect(() => {
    if (vista === 'titular' && tarjetas.length === 0) {
      void fetchTarjetas();
    }
  }, [vista, tarjetas.length, fetchTarjetas]);

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

  // F5a · ADR-PF-001 · helpers legacy (abrirCuentaBanco, abrirMetodos,
  // guardarMetodos) eliminados. Toda la creación pasa por el wizard.
  // Edición de métodos: se hace abriendo el wizard de la cuenta.
  const abrirWizardNuevo = () => {
    setCuentaEditando(null);
    setShowWizard(true);
  };

  // Render saldo de cuenta
  const renderSaldo = (cuenta: CuentaCaja) => {
    if (cuenta.esBiMoneda) {
      return (
        <div className="space-y-0.5 text-right">
          <div className="text-sm font-bold text-emerald-600">S/ {(cuenta.saldoPEN || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</div>
          <div className="text-sm font-bold text-sky-600">$ {(cuenta.saldoUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
      );
    }
    if (cuenta.lineaCredito) {
      return (
        <div className="text-right">
          <div className="text-sm font-bold text-amber-700">
            Disp: {cuenta.moneda === 'USD' ? '$' : 'S/'} {(cuenta.lineaCredito.disponible || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400">
            Línea: {cuenta.moneda === 'USD' ? '$' : 'S/'} {(cuenta.lineaCredito.limiteTotal || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </div>
        </div>
      );
    }
    return (
      <div className="text-lg font-bold text-slate-900">
        {cuenta.moneda === 'PEN' ? 'S/' : '$'} {cuenta.saldoActual.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
      </div>
    );
  };

  // Render fila de cuenta (dentro de un banco)
  const renderCuentaRow = (cuenta: CuentaCaja) => (
    <div
      key={cuenta.id}
      className={`px-4 py-3 flex items-center justify-between group cursor-pointer transition-all hover:bg-white ${
        cuentaDetalle?.id === cuenta.id ? 'bg-white ring-1 ring-teal-200' : ''
      }`}
      onClick={() => { setCuentaDetalle(cuentaDetalle?.id === cuenta.id ? null : cuenta); setMovsLimit(50); }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-1.5 self-stretch rounded-full flex-shrink-0 ${
          cuenta.tipo === 'credito' ? 'bg-amber-400' :
          cuenta.moneda === 'USD' ? 'bg-sky-400' : 'bg-emerald-400'
        }`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900 truncate">{cuenta.nombre}</span>
            {cuenta.productoFinanciero && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex-shrink-0">
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
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-slate-600 flex-shrink-0">Bi-Moneda</span>
            )}
            {cuenta.moneda === 'USD' && !cuenta.esBiMoneda && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-600 flex-shrink-0">USD</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
            {getNumeroPrincipal(cuenta) && <span>#{getNumeroPrincipal(cuenta)}</span>}
            {(cuenta.numerosCuenta?.length || 0) > 1 && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-500">+{(cuenta.numerosCuenta!.length - 1)} más</span>
            )}
            {cuenta.titular && <span>· {cuenta.titular}</span>}
            {/* Canales vinculados (Yape/Plin) */}
            {cuenta.metodosDetalle && Object.entries(cuenta.metodosDetalle)
              .filter(([_, v]) => v.identificador)
              .map(([tipo, v]) => (
                <span key={tipo} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                  {tipo} · {v.identificador}
                </span>
              ))
            }
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {renderSaldo(cuenta)}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCuentaEditando(cuenta);
              setShowWizard(true);
            }}
            className="p-1.5 text-slate-300 hover:text-teal-600 hover:bg-teal-50 rounded-full"
            title="Editar cuenta"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleEliminarCuenta(cuenta); }}
            className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-full"
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
        cuentaDetalle?.id === cuenta.id ? 'ring-1 ring-teal-200 border-teal-200' : 'border-slate-200'
      }`}
      onClick={() => { setCuentaDetalle(cuentaDetalle?.id === cuenta.id ? null : cuenta); setMovsLimit(50); }}
    >
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCuentaEditando(cuenta);
            setShowWizard(true);
          }}
          className="p-1.5 text-slate-300 hover:text-teal-600 hover:bg-teal-50 rounded-full"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleEliminarCuenta(cuenta); }}
          className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-full"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <h4 className="font-medium text-slate-900 pr-16">{cuenta.nombre}</h4>
      <div className="text-xs text-slate-400 mt-0.5">
        {cuenta.moneda}{cuenta.titularidad ? ` · ${cuenta.titularidad === 'empresa' ? 'Empresa' : 'Personal'}` : ''}
      </div>
      {cuenta.titular && <div className="text-xs text-slate-400">{cuenta.titular}</div>}
      <div className="mt-3">
        {renderSaldo(cuenta)}
      </div>
    </div>
  );

  return (
    <>
      <Card padding="none">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">
              Cuentas de Caja ({cuentas.length})
            </h3>
            {/* Toggle vista */}
            <div className="flex bg-slate-100 rounded-md p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setVista('titular')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  vista === 'titular'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Agrupar por titular (empresa, empleados, etc.)"
              >
                Por titular
              </button>
              <button
                type="button"
                onClick={() => setVista('tipo')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  vista === 'tipo'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Agrupar por tipo de producto (banco, digital, efectivo)"
              >
                Por tipo
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="primary-soft"
              size="sm"
              onClick={() => setShowWizard(true)}
              disabled={isSubmitting}
              title="Crear cuenta paso a paso"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nueva cuenta
            </Button>
            <Button variant="outline" size="sm" onClick={handleReconciliarPagos}
              disabled={isSubmitting} title="Reconciliar pagos huérfanos">
              <ShieldCheck className={`h-4 w-4 mr-1`} />
              <span className="hidden sm:inline">Reconciliar</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleRecalcularSaldos}
              disabled={isSubmitting || cuentas.length === 0} title="Recalcular saldos">
              <RefreshCw className={`h-4 w-4 mr-1 ${isSubmitting ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Recalcular</span>
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* ==================== VISTA POR TITULAR (S58c parte 2) ==================== */}
          {vista === 'titular' && (
            <VistaPorTitular
              cuentas={cuentas}
              tarjetas={tarjetas}
              onCuentaClick={(c) =>
                setCuentaDetalle(cuentaDetalle?.id === c.id ? null : c)
              }
              onTarjetaClick={(t) => setTarjetaDetalle(t)}
              onEditarCuenta={(c) => {
                setCuentaEditando(c);
                setShowWizard(true);
              }}
              onEliminarCuenta={(c) => handleEliminarCuenta(c)}
            />
          )}

          {/* ==================== VISTA POR TIPO DE PRODUCTO (legacy) ==================== */}
          {vista === 'tipo' && (
            <>
          {/* ==================== SECCIÓN BANCOS ==================== */}
          <FormSection
            title="Bancos"
            icon={<Building2 className="h-4 w-4" />}
            defaultOpen
            badge={
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">{bancos.size} banco{bancos.size !== 1 ? 's' : ''} · {totalBancoCuentas} cuenta{totalBancoCuentas !== 1 ? 's' : ''}</span>
                <button onClick={(e) => { e.stopPropagation(); abrirWizardNuevo(); }}
                  className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2 py-1 rounded-md transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Banco
                </button>
              </div>
            }
          >
            {bancos.size === 0 ? (
              <div className="text-center py-6">
                <Building2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No hay bancos registrados</p>
                <button onClick={() => abrirWizardNuevo()}
                  className="mt-2 text-sm text-teal-600 hover:underline">+ Agregar primer banco</button>
              </div>
            ) : (
              <div className="space-y-3">
                {[...bancos.entries()].map(([banco, cuentasBanco]) => (
                  <div key={banco} className="rounded-xl border border-sky-200 bg-sky-50/30 overflow-hidden">
                    {/* Header del banco */}
                    <div className="px-4 py-3 bg-sky-50 flex items-center justify-between border-b border-sky-100">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-sky-600" />
                        <h4 className="font-semibold text-slate-900">{banco}</h4>
                        {cuentasBanco[0]?.bancoNombreCompleto && (
                          <span className="text-xs text-slate-500 hidden sm:inline">({cuentasBanco[0].bancoNombreCompleto})</span>
                        )}
                        <span className="text-xs text-slate-400">{cuentasBanco.length} cuenta{cuentasBanco.length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {cuentasBanco[0]?.metodosDisponibles?.length ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {cuentasBanco[0].metodosDisponibles.map(m => {
                              const det = cuentasBanco[0]?.metodosDetalle?.[m];
                              const esCanal = ['yape', 'plin'].includes(m);
                              return (
                                <span key={m} className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  esCanal ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'
                                }`}>
                                  {m}{det?.identificador ? ` · ${det.identificador}` : ''}
                                </span>
                              );
                            })}
                          </div>
                        ) : null}
                        {/* F5a · ADR-PF-001 · botón "editar métodos" eliminado.
                            Métodos de pago ahora se editan desde el wizard de cada cuenta. */}
                      </div>
                    </div>

                    {/* Cuentas del banco */}
                    <div className="divide-y divide-sky-100">
                      {cuentasBanco.map(renderCuentaRow)}
                    </div>

                    {/* Agregar cuenta */}
                    <div className="px-4 py-2 border-t border-sky-100 bg-sky-50/50">
                      <button onClick={() => abrirWizardNuevo()}
                        className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium">
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
                <span className="text-[10px] text-slate-400">{digitales.length} billetera{digitales.length !== 1 ? 's' : ''}</span>
                <button onClick={(e) => { e.stopPropagation(); abrirWizardNuevo(); }}
                  className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2 py-1 rounded-md transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Digital
                </button>
              </div>
            }
          >
            {digitales.length === 0 ? (
              <div className="text-center py-6">
                <Smartphone className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No hay billeteras digitales</p>
                <button onClick={() => abrirWizardNuevo()}
                  className="mt-2 text-sm text-teal-600 hover:underline">+ Agregar billetera</button>
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
                <span className="text-[10px] text-slate-400">{efectivo.length} caja{efectivo.length !== 1 ? 's' : ''}</span>
                <button onClick={(e) => { e.stopPropagation(); abrirWizardNuevo(); }}
                  className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2 py-1 rounded-md transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Caja
                </button>
              </div>
            }
          >
            {efectivo.length === 0 ? (
              <div className="text-center py-6">
                <Banknote className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No hay cajas de efectivo</p>
                <button onClick={() => abrirWizardNuevo()}
                  className="mt-2 text-sm text-teal-600 hover:underline">+ Agregar caja</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {efectivo.map(renderCuentaCard)}
              </div>
            )}
          </FormSection>
            </>
          )}
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
              <div className="border border-teal-200 rounded-xl bg-teal-50/30 overflow-hidden">
                <div className="px-4 py-3 border-b border-teal-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-teal-500" />
                    <h4 className="text-sm font-semibold text-slate-900">Movimientos de {cuentaDetalle.nombre}</h4>
                    <span className="text-xs text-slate-400">({movsCuenta.length})</span>
                  </div>
                  <button onClick={() => setCuentaDetalle(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>

                {movsCuenta.length > 0 && (
                  <div className="px-4 py-2.5 bg-white/60 border-b border-teal-100">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">Entradas:</span>
                        {entPEN > 0 && <span className="ml-1 font-semibold text-emerald-600">+S/ {entPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>}
                        {entUSD > 0 && <span className="ml-1 font-semibold text-emerald-600">+$ {entUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>}
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500">Salidas:</span>
                        {salPEN > 0 && <span className="ml-1 font-semibold text-red-600">-S/ {salPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>}
                        {salUSD > 0 && <span className="ml-1 font-semibold text-red-600">-$ {salUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>}
                      </div>
                    </div>
                  </div>
                )}

                {movsCuenta.length === 0 ? (
                  <div className="px-4 py-8 text-center text-slate-400 text-sm">No hay movimientos para esta cuenta</div>
                ) : (
                  <>
                    {/* Mobile */}
                    <div className="md:hidden divide-y divide-slate-100">
                      {movsDisplay.slice(0, movsLimit).map((mov) => {
                        const esIngreso = mov.cuentaDestino === cuentaDetalle.id;
                        const saldos = saldosPorMov.get(mov.id);
                        return (
                          <div key={mov.id} className={`px-4 py-2.5 ${mov.estado === 'anulado' ? 'opacity-40' : ''}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-[10px] text-slate-400 flex-shrink-0">{formatDate(mov.fecha)}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${esIngreso ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                  {esIngreso ? 'Entrada' : 'Salida'}
                                </span>
                              </div>
                              <span className={`text-sm font-bold ${esIngreso ? 'text-emerald-600' : 'text-red-600'}`}>
                                {esIngreso ? '+' : '-'}{mov.moneda === 'USD' ? '$' : 'S/'} {mov.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 truncate mt-0.5">{mov.concepto}</p>
                            {saldos && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
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
                    {(() => {
                      const cuentaMovColumns: DataTableColumn<MovimientoTesoreria>[] = [
                        {
                          key: 'fecha',
                          header: 'Fecha',
                          render: (mov) => (
                            <span className="text-slate-500 whitespace-nowrap">{formatDate(mov.fecha)}</span>
                          ),
                        },
                        {
                          key: 'tipo',
                          header: 'Tipo',
                          render: (mov) => {
                            const esIngreso = mov.cuentaDestino === cuentaDetalle.id;
                            return (
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${esIngreso ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {esIngreso ? <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> : <TrendingDown className="h-2.5 w-2.5 mr-0.5" />}
                                {getTipoLabel(mov.tipo)}
                              </span>
                            );
                          },
                        },
                        {
                          key: 'doc',
                          header: 'Doc.',
                          render: (mov) => (
                            <>
                              {mov.ordenCompraNumero && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-medium">{mov.ordenCompraNumero}</span>}
                              {mov.ventaNumero && <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-medium">{mov.ventaNumero}</span>}
                              {mov.gastoNumero && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 text-[10px] font-medium">{mov.gastoNumero}</span>}
                              {!mov.ordenCompraNumero && !mov.ventaNumero && !mov.gastoNumero && <span className="text-slate-300">-</span>}
                            </>
                          ),
                        },
                        {
                          key: 'concepto',
                          header: 'Concepto',
                          render: (mov) => (
                            <span className="text-slate-700 max-w-[240px] truncate block" title={mov.concepto}>{mov.concepto}</span>
                          ),
                        },
                        {
                          key: 'entrada',
                          header: 'Entrada',
                          align: 'right',
                          render: (mov) => {
                            const esIngreso = mov.cuentaDestino === cuentaDetalle.id;
                            const simbolo = mov.moneda === 'USD' ? '$' : 'S/';
                            return esIngreso ? (
                              <span className="font-medium text-emerald-600 whitespace-nowrap">
                                {simbolo} {mov.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                              </span>
                            ) : null;
                          },
                        },
                        {
                          key: 'salida',
                          header: 'Salida',
                          align: 'right',
                          render: (mov) => {
                            const esIngreso = mov.cuentaDestino === cuentaDetalle.id;
                            const simbolo = mov.moneda === 'USD' ? '$' : 'S/';
                            return !esIngreso ? (
                              <span className="font-medium text-red-600 whitespace-nowrap">
                                {simbolo} {mov.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                              </span>
                            ) : null;
                          },
                        },
                        {
                          key: 'saldo',
                          header: 'Saldo',
                          align: 'right',
                          render: (mov) => {
                            const saldos = saldosPorMov.get(mov.id);
                            const simbolo = mov.moneda === 'USD' ? '$' : 'S/';
                            return saldos ? (
                              <span className="text-slate-500 whitespace-nowrap">
                                {simbolo} {(cuentaDetalle.esBiMoneda
                                  ? (mov.moneda === 'PEN' ? saldos.pen : saldos.usd)
                                  : (cuentaDetalle.moneda === 'PEN' ? saldos.pen : saldos.usd)
                                ).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                              </span>
                            ) : null;
                          },
                        },
                      ];

                      return (
                        <div className="hidden md:block">
                          <DataTable
                            columns={cuentaMovColumns}
                            data={movsDisplay.slice(0, movsLimit)}
                            keyExtractor={(mov) => mov.id}
                            compact
                            emptyMessage="No hay movimientos para esta cuenta"
                          />
                        </div>
                      );
                    })()}

                    {movsDisplay.length > movsLimit && (
                      <div className="px-4 py-3 text-center border-t border-slate-100">
                        <p className="text-xs text-slate-400">Mostrando {movsLimit} de {movsDisplay.length}</p>
                        <button onClick={() => setMovsLimit(prev => prev + 50)}
                          className="text-sm text-teal-600 hover:text-teal-700 font-medium hover:underline">
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

      {/* F5a · ADR-PF-001 · forms legacy eliminados (BancoNuevoForm,
          CuentaBancoForm, DigitalForm, EfectivoForm, EditarMetodosBancoModal).
          Toda la creación pasa por el CuentaWizard universal abajo. */}

      {/* CuentaWizard — F3c.5+6 · ADR-PF-001 ·
          Toda la persistencia (creación + edición) va por el camino
          self-contained del wizard, que detecta nativo vs legacy y
          actualiza en la colección correcta. TabCuentas solo refresca al
          recibir onSuccess. */}
      <CuentaWizard
        isOpen={showWizard}
        onClose={() => {
          setShowWizard(false);
          setCuentaEditando(null);
        }}
        cuentaEditar={cuentaEditando}
        onSuccess={() => {
          void fetchCuentasUnificadas();
        }}
        isSubmitting={isSubmitting}
      />

      {/* S58c parte 2 — Detalle de tarjeta (cuando se click una TC en vista por titular) */}
      <TarjetaDetailModal
        isOpen={!!tarjetaDetalle}
        onClose={() => setTarjetaDetalle(null)}
        tarjeta={tarjetaDetalle}
      />
    </>
  );
};
