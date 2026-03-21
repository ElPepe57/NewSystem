import React from 'react';
import { formatFecha as formatDate } from '../../utils/dateFormatters';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Plus,
  ArrowLeftRight,
  Building2,
  Banknote,
  CreditCard,
  AlertTriangle
} from 'lucide-react';
import { Button, Card, Modal } from '../../components/common';
import type {
  CuentaCaja,
  TransferenciaEntreCuentasFormData,
  MonedaTesoreria
} from '../../types/tesoreria.types';

// Local type matching the one defined in Tesoreria.tsx
interface TransferenciaEntreCuentas {
  id: string;
  fecha: Date;
  cuentaOrigenId: string;
  cuentaOrigenNombre: string;
  cuentaDestinoId: string;
  cuentaDestinoNombre: string;
  monto: number;
  moneda: MonedaTesoreria;
  concepto?: string;
  creadoPor: string;
  creadoEn: Date;
}

interface TabTransferenciasProps {
  transferencias: TransferenciaEntreCuentas[];
  cuentas: CuentaCaja[];
  isTransferenciaModalOpen: boolean;
  setIsTransferenciaModalOpen: (open: boolean) => void;
  transferenciaForm: Partial<TransferenciaEntreCuentasFormData>;
  setTransferenciaForm: React.Dispatch<React.SetStateAction<Partial<TransferenciaEntreCuentasFormData>>>;
  isSubmitting: boolean;
  tcDefault: number;
  handleCrearTransferencia: () => void;
}

export const TabTransferencias: React.FC<TabTransferenciasProps> = ({
  transferencias,
  cuentas,
  isTransferenciaModalOpen,
  setIsTransferenciaModalOpen,
  transferenciaForm,
  setTransferenciaForm,
  isSubmitting,
  tcDefault,
  handleCrearTransferencia,
}) => {
  const moneda = (transferenciaForm.moneda || 'PEN') as MonedaTesoreria;
  const simbolo = moneda === 'USD' ? '$' : 'S/';
  const monto = transferenciaForm.monto || 0;

  const getSaldo = (cuenta: CuentaCaja): number => {
    if (cuenta.esBiMoneda) {
      return moneda === 'USD' ? (cuenta.saldoUSD || 0) : (cuenta.saldoPEN || 0);
    }
    return cuenta.saldoActual || 0;
  };

  const getTipoIcon = (tipo: string) => {
    if (tipo === 'banco') return <Building2 className="w-3.5 h-3.5" />;
    if (tipo === 'digital') return <CreditCard className="w-3.5 h-3.5" />;
    return <Banknote className="w-3.5 h-3.5" />;
  };

  const cuentasCompatibles = cuentas.filter(c => c.activa && (c.esBiMoneda || c.moneda === moneda));

  const cuentaOrigen = cuentas.find(c => c.id === transferenciaForm.cuentaOrigenId);
  const cuentaDestino = cuentas.find(c => c.id === transferenciaForm.cuentaDestinoId);

  const saldoOrigen = cuentaOrigen ? getSaldo(cuentaOrigen) : 0;
  const saldoDestino = cuentaDestino ? getSaldo(cuentaDestino) : 0;
  const saldoOrigenPost = saldoOrigen - monto;
  const saldoDestinoPost = saldoDestino + monto;
  const fondosInsuficientes = !!cuentaOrigen && monto > 0 && saldoOrigenPost < 0;
  const origenBajoMinimo = !!cuentaOrigen && monto > 0 && (() => {
    if (cuentaOrigen.esBiMoneda) {
      const min = moneda === 'USD' ? cuentaOrigen.saldoMinimoUSD : cuentaOrigen.saldoMinimoPEN;
      return min !== undefined && saldoOrigenPost < min;
    }
    return cuentaOrigen.saldoMinimo !== undefined && saldoOrigenPost < cuentaOrigen.saldoMinimo;
  })();

  return (
    <>
      <Card padding="none">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Transferencias entre Cuentas</h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 hidden sm:block">
              Mueve fondos entre tus propias cuentas sin afectar el patrimonio
            </p>
          </div>
          <Button variant="primary" onClick={() => setIsTransferenciaModalOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
            <span className="sm:hidden">Nueva</span>
            <span className="hidden sm:inline">Nueva Transferencia</span>
          </Button>
        </div>

        {/* Mobile card layout */}
        <div className="md:hidden divide-y divide-gray-200">
          {transferencias.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              <ArrowLeftRight className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-sm">No hay transferencias registradas</p>
              <p className="text-xs mt-1">Las transferencias entre cuentas se mostraran aqui</p>
            </div>
          ) : (
            transferencias.map((transf) => (
              <div key={transf.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{formatDate(transf.fecha)}</span>
                  <span className="text-sm font-bold text-gray-900">
                    {transf.moneda === 'PEN' ? 'S/ ' : '$ '}{transf.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-xs">
                    <div className="text-[10px] text-gray-400 uppercase">Origen</div>
                    <div className="font-medium text-gray-900 truncate">{transf.cuentaOrigenNombre}</div>
                  </div>
                  <ArrowLeftRight className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                  <div className="flex-1 text-xs text-right">
                    <div className="text-[10px] text-gray-400 uppercase">Destino</div>
                    <div className="font-medium text-gray-900 truncate">{transf.cuentaDestinoNombre}</div>
                  </div>
                </div>
                {transf.concepto && (
                  <p className="text-xs text-gray-500 truncate">{transf.concepto}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cuenta Origen</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">→</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cuenta Destino</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transferencias.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    <ArrowLeftRight className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">No hay transferencias registradas</p>
                    <p className="text-sm mt-1">Las transferencias entre cuentas se mostraran aqui</p>
                  </td>
                </tr>
              ) : (
                transferencias.map((transf) => (
                  <tr key={transf.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(transf.fecha)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="font-medium text-gray-900">{transf.cuentaOrigenNombre}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <ArrowLeftRight className="h-4 w-4 text-gray-400 inline" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="font-medium text-gray-900">{transf.cuentaDestinoNombre}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                      {transf.moneda === 'PEN' ? 'S/ ' : '$ '}
                      {transf.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transf.concepto || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Transferencia entre Cuentas */}
      <Modal
        isOpen={isTransferenciaModalOpen}
        onClose={() => {
          setIsTransferenciaModalOpen(false);
          setTransferenciaForm({ moneda: 'PEN', fecha: new Date(), tipoCambio: tcDefault });
        }}
        title="Transferencia entre Cuentas"
        size="lg"
      >
        <div className="space-y-4">
          {/* Saldos de cuentas - resumen rapido */}
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wide font-medium text-gray-400">
                Saldos en {moneda}
              </span>
              <div className="flex gap-1">
                {(['PEN', 'USD'] as MonedaTesoreria[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setTransferenciaForm({
                      ...transferenciaForm,
                      moneda: m,
                      cuentaOrigenId: undefined,
                      cuentaDestinoId: undefined
                    })}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                      moneda === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {cuentasCompatibles.map(c => {
                const saldo = getSaldo(c);
                const isOrigen = c.id === transferenciaForm.cuentaOrigenId;
                const isDestino = c.id === transferenciaForm.cuentaDestinoId;
                return (
                  <div
                    key={c.id}
                    className={`rounded-lg p-2 text-xs transition-all ${
                      isOrigen ? 'bg-red-50 border border-red-200 ring-1 ring-red-200' :
                      isDestino ? 'bg-green-50 border border-green-200 ring-1 ring-green-200' :
                      'bg-white border border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-1 text-gray-400 mb-0.5">
                      {getTipoIcon(c.tipo)}
                      <span className="truncate font-medium text-gray-600">{c.nombre}</span>
                    </div>
                    <div className={`text-sm font-bold ${
                      saldo < 0 ? 'text-red-600' : isOrigen ? 'text-red-700' : isDestino ? 'text-green-700' : 'text-gray-900'
                    }`}>
                      {simbolo} {saldo.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    {isOrigen && <span className="text-[9px] text-red-400 font-medium">ORIGEN</span>}
                    {isDestino && <span className="text-[9px] text-green-500 font-medium">DESTINO</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto a Transferir</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">{simbolo}</span>
              <input
                type="number"
                step="0.01"
                value={transferenciaForm.monto || ''}
                onChange={(e) => setTransferenciaForm({ ...transferenciaForm, monto: parseFloat(e.target.value) })}
                className="w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-lg font-semibold"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Cuenta Origen y Destino */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <ArrowUpCircle className="inline h-4 w-4 mr-1 text-red-500" />
                Cuenta Origen (Sale)
              </label>
              <select
                value={transferenciaForm.cuentaOrigenId || ''}
                onChange={(e) => setTransferenciaForm({ ...transferenciaForm, cuentaOrigenId: e.target.value || undefined })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Seleccionar cuenta...</option>
                {cuentasCompatibles
                  .filter(c => c.id !== transferenciaForm.cuentaDestinoId)
                  .map(cuenta => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.nombre} — {simbolo} {getSaldo(cuenta).toFixed(2)}
                    </option>
                  ))}
              </select>
              {cuentaOrigen && (
                <div className={`mt-1.5 rounded-lg p-2 text-xs ${fondosInsuficientes ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Saldo actual</span>
                    <span className="font-semibold text-gray-700">{simbolo} {saldoOrigen.toFixed(2)}</span>
                  </div>
                  {monto > 0 && (
                    <div className="flex justify-between mt-0.5">
                      <span className="text-gray-500">Saldo despues</span>
                      <span className={`font-bold ${saldoOrigenPost < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {simbolo} {saldoOrigenPost.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <ArrowDownCircle className="inline h-4 w-4 mr-1 text-green-500" />
                Cuenta Destino (Entra)
              </label>
              <select
                value={transferenciaForm.cuentaDestinoId || ''}
                onChange={(e) => setTransferenciaForm({ ...transferenciaForm, cuentaDestinoId: e.target.value || undefined })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Seleccionar cuenta...</option>
                {cuentasCompatibles
                  .filter(c => c.id !== transferenciaForm.cuentaOrigenId)
                  .map(cuenta => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.nombre} — {simbolo} {getSaldo(cuenta).toFixed(2)}
                    </option>
                  ))}
              </select>
              {cuentaDestino && (
                <div className="mt-1.5 rounded-lg p-2 text-xs bg-gray-50">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Saldo actual</span>
                    <span className="font-semibold text-gray-700">{simbolo} {saldoDestino.toFixed(2)}</span>
                  </div>
                  {monto > 0 && (
                    <div className="flex justify-between mt-0.5">
                      <span className="text-gray-500">Saldo despues</span>
                      <span className="font-bold text-green-600">{simbolo} {saldoDestinoPost.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Warnings */}
          {fondosInsuficientes && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-700">
                <strong>Fondos insuficientes.</strong> La cuenta origen solo tiene {simbolo} {saldoOrigen.toFixed(2)} disponibles.
              </div>
            </div>
          )}
          {!fondosInsuficientes && origenBajoMinimo && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700">
                <strong>Alerta:</strong> Esta transferencia dejara la cuenta origen por debajo de su saldo minimo configurado.
              </div>
            </div>
          )}

          {/* Concepto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Concepto / Motivo (Opcional)</label>
            <input
              type="text"
              value={transferenciaForm.concepto || ''}
              onChange={(e) => setTransferenciaForm({ ...transferenciaForm, concepto: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Ej: Reposicion de caja chica, fondeo de cuenta..."
            />
          </div>

          {/* Preview visual */}
          {monto > 0 && cuentaOrigen && cuentaDestino && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-xl border border-purple-100">
              <div className="flex items-center justify-center gap-3 sm:gap-6">
                <div className="text-center flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Sale de</p>
                  <p className="text-xs font-semibold text-gray-900 truncate">{cuentaOrigen.nombre}</p>
                  <p className="text-sm text-gray-400 line-through">{simbolo} {saldoOrigen.toFixed(2)}</p>
                  <p className="text-base font-bold text-red-600">{simbolo} {saldoOrigenPost.toFixed(2)}</p>
                </div>
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center">
                    <ArrowLeftRight className="h-4 w-4 text-purple-500" />
                  </div>
                  <span className="text-xs font-bold text-purple-600">{simbolo} {monto.toFixed(2)}</span>
                </div>
                <div className="text-center flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Entra a</p>
                  <p className="text-xs font-semibold text-gray-900 truncate">{cuentaDestino.nombre}</p>
                  <p className="text-sm text-gray-400 line-through">{simbolo} {saldoDestino.toFixed(2)}</p>
                  <p className="text-base font-bold text-green-600">{simbolo} {saldoDestinoPost.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <Button variant="ghost" onClick={() => setIsTransferenciaModalOpen(false)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={handleCrearTransferencia}
              disabled={
                isSubmitting ||
                !transferenciaForm.monto ||
                !transferenciaForm.cuentaOrigenId ||
                !transferenciaForm.cuentaDestinoId
              }
            >
              {isSubmitting ? 'Procesando...' : 'Realizar Transferencia'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
