import React from 'react';
import { formatFecha as formatDate } from '../../utils/dateFormatters';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Building2,
  Banknote,
  Edit2,
  User,
  FileText,
  XCircle,
  RefreshCw,
  CreditCard,
  Wallet
} from 'lucide-react';
import { Button, Card, Modal } from '../../components/common';
import type {
  MovimientoTesoreria,
  CuentaCaja,
  CuentaCajaFormData,
  MonedaTesoreria,
  TipoMovimientoTesoreria
} from '../../types/tesoreria.types';

interface TabCuentasProps {
  cuentas: CuentaCaja[];
  movimientosFiltrados: MovimientoTesoreria[];
  cuentaDetalle: CuentaCaja | null;
  setCuentaDetalle: (c: CuentaCaja | null) => void;
  movsLimit: number;
  setMovsLimit: React.Dispatch<React.SetStateAction<number>>;
  isCuentaModalOpen: boolean;
  setIsCuentaModalOpen: (open: boolean) => void;
  cuentaEditando: CuentaCaja | null;
  cuentaForm: Partial<CuentaCajaFormData>;
  setCuentaForm: React.Dispatch<React.SetStateAction<Partial<CuentaCajaFormData>>>;
  isSubmitting: boolean;
  handleEditarCuenta: (cuenta: CuentaCaja) => void;
  handleGuardarCuenta: () => void;
  handleCerrarModalCuenta: () => void;
  handleRecalcularSaldos: () => void;
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
  isCuentaModalOpen,
  setIsCuentaModalOpen,
  cuentaEditando,
  cuentaForm,
  setCuentaForm,
  isSubmitting,
  handleEditarCuenta,
  handleGuardarCuenta,
  handleCerrarModalCuenta,
  handleRecalcularSaldos,
  getTipoLabel,
  esIngresoMovimiento,
}) => {
  return (
    <>
      <Card padding="none">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            Cuentas de Caja ({cuentas.length})
          </h3>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleRecalcularSaldos}
              disabled={isSubmitting || cuentas.length === 0}
              title="Recalcular saldos basandose en los movimientos registrados"
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 ${isSubmitting ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Recalcular</span>
            </Button>
            <Button variant="primary" onClick={() => setIsCuentaModalOpen(true)} className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
              <span className="sm:hidden">Nueva</span>
              <span className="hidden sm:inline">Nueva Cuenta</span>
            </Button>
          </div>
        </div>

        {cuentas.length === 0 ? (
          <div className="text-center text-gray-500 py-8 px-6">No hay cuentas registradas</div>
        ) : (
          <>
            {/* Cuentas de Caja (Activos) */}
            <div className="p-4 sm:p-6">
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Cuentas de Caja
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cuentas.filter(c => c.tipo !== 'credito').map((cuenta) => (
                  <Card
                    key={cuenta.id}
                    padding="md"
                    className={`border relative group cursor-pointer transition-all hover:shadow-md ${
                      cuentaDetalle?.id === cuenta.id
                        ? 'border-primary-400 ring-2 ring-primary-100 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => { setCuentaDetalle(cuentaDetalle?.id === cuenta.id ? null : cuenta); setMovsLimit(50); }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEditarCuenta(cuenta); }}
                      className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title="Editar cuenta"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        {cuenta.tipo === 'efectivo' && <Banknote className="h-6 w-6 text-green-500 mr-2" />}
                        {cuenta.tipo === 'banco' && <Building2 className="h-6 w-6 text-blue-500 mr-2" />}
                        {cuenta.tipo === 'digital' && <Wallet className="h-6 w-6 text-purple-500 mr-2" />}
                        <div>
                          <h4 className="font-medium text-gray-900">{cuenta.nombre}</h4>
                          <p className="text-xs text-gray-500">{cuenta.tipo}</p>
                        </div>
                      </div>
                      {cuenta.esBiMoneda ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gradient-to-r from-green-100 to-blue-100 text-gray-800 border border-gray-200">
                          BI-MONEDA
                        </span>
                      ) : (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          cuenta.moneda === 'PEN' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {cuenta.moneda}
                        </span>
                      )}
                    </div>
                    {cuenta.esBiMoneda ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Saldo PEN:</span>
                          <span className="text-lg font-bold text-green-600">
                            S/ {(cuenta.saldoPEN || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Saldo USD:</span>
                          <span className="text-lg font-bold text-blue-600">
                            $ {(cuenta.saldoUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-2xl font-bold text-gray-900">
                        {cuenta.moneda === 'PEN' ? 'S/ ' : '$ '}
                        {cuenta.saldoActual.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                    )}
                    {cuenta.titular && (
                      <div className="flex items-center text-sm text-gray-600 mt-2">
                        <User className="h-4 w-4 mr-1 text-gray-400" />
                        <span>{cuenta.titular}</span>
                      </div>
                    )}
                    {cuenta.banco && (
                      <p className="text-sm text-gray-500 mt-1">{cuenta.banco}</p>
                    )}
                  </Card>
                ))}
              </div>
            </div>

            {/* Detalle de movimientos de cuenta seleccionada */}
            {cuentaDetalle && cuentaDetalle.tipo !== 'credito' && (() => {
              const movsCuenta = movimientosFiltrados.filter(m =>
                m.cuentaOrigen === cuentaDetalle.id || m.cuentaDestino === cuentaDetalle.id
              );
              const movsOrdenados = [...movsCuenta].sort((a, b) => {
                const fa = a.fecha?.toDate ? a.fecha.toDate().getTime() : new Date(a.fecha as any).getTime();
                const fb = b.fecha?.toDate ? b.fecha.toDate().getTime() : new Date(b.fecha as any).getTime();
                return fa - fb;
              });
              let saldoCorridoPEN = 0;
              let saldoCorridoUSD = 0;
              const saldosPorMov = new Map<string, { pen: number; usd: number }>();
              for (const mov of movsOrdenados) {
                if (mov.estado === 'anulado') {
                  saldosPorMov.set(mov.id, { pen: saldoCorridoPEN, usd: saldoCorridoUSD });
                  continue;
                }
                const esIngreso = mov.cuentaDestino === cuentaDetalle.id;
                const signo = esIngreso ? 1 : -1;
                if (mov.moneda === 'PEN') {
                  saldoCorridoPEN += signo * mov.monto;
                } else {
                  saldoCorridoUSD += signo * mov.monto;
                }
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
                if (mov.moneda === 'PEN') {
                  if (esIng) entPEN += mov.monto; else salPEN += mov.monto;
                } else {
                  if (esIng) entUSD += mov.monto; else salUSD += mov.monto;
                }
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
                      <button
                        onClick={() => setCuentaDetalle(null)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                      >
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
                        <div className="mt-1 pt-1 border-t border-gray-200/50 flex justify-between text-xs">
                          <span className="text-gray-500">Balance:</span>
                          <div className="flex gap-2">
                            {(entPEN > 0 || salPEN > 0) && (
                              <span className={`font-bold ${(entPEN - salPEN) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(entPEN - salPEN) >= 0 ? '+' : ''}S/ {(entPEN - salPEN).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                            {(entUSD > 0 || salUSD > 0) && (
                              <span className={`font-bold ${(entUSD - salUSD) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(entUSD - salUSD) >= 0 ? '+' : ''}$ {(entUSD - salUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {movsCuenta.length === 0 ? (
                      <div className="px-4 py-8 text-center text-gray-400 text-sm">
                        No hay movimientos para esta cuenta
                      </div>
                    ) : (
                      <>
                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-gray-100">
                          {movsDisplay.slice(0, movsLimit).map((mov) => {
                            const esIngreso = mov.cuentaDestino === cuentaDetalle.id;
                            const saldos = saldosPorMov.get(mov.id);
                            return (
                              <div key={mov.id} className={`px-4 py-2.5 ${mov.estado === 'anulado' ? 'opacity-40' : ''}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="text-[10px] text-gray-400 flex-shrink-0">{formatDate(mov.fecha)}</span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${
                                      esIngreso ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                      {esIngreso ? 'Entrada' : 'Salida'}
                                    </span>
                                  </div>
                                  <span className={`text-sm font-bold flex-shrink-0 ${esIngreso ? 'text-green-600' : 'text-red-600'}`}>
                                    {esIngreso ? '+' : '-'}{mov.moneda === 'USD' ? '$' : 'S/'} {mov.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 truncate mt-0.5">{mov.concepto}</p>
                                {saldos && (
                                  <div className="text-[10px] text-gray-400 mt-0.5">
                                    Saldo: {cuentaDetalle.esBiMoneda
                                      ? `S/${saldos.pen.toFixed(2)} | $${saldos.usd.toFixed(2)}`
                                      : `${cuentaDetalle.moneda === 'PEN' ? 'S/' : '$'}${(cuentaDetalle.moneda === 'PEN' ? saldos.pen : saldos.usd).toFixed(2)}`
                                    }
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Desktop table */}
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
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                        esIngreso ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                      }`}>
                                        {esIngreso ? <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> : <TrendingDown className="h-2.5 w-2.5 mr-0.5" />}
                                        {getTipoLabel(mov.tipo)}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                      {mov.ordenCompraNumero && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-medium">{mov.ordenCompraNumero}</span>}
                                      {mov.ventaNumero && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-medium">{mov.ventaNumero}</span>}
                                      {mov.gastoNumero && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 text-[10px] font-medium">{mov.gastoNumero}</span>}
                                      {mov.cotizacionNumero && <span className="px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 text-[10px] font-medium">{mov.cotizacionNumero}</span>}
                                      {mov.transferenciaNumero && <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-medium">{mov.transferenciaNumero}</span>}
                                      {mov.conversionId && <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 text-[10px] font-medium">Conv.</span>}
                                      {!mov.ordenCompraNumero && !mov.ventaNumero && !mov.gastoNumero && !mov.cotizacionNumero && !mov.transferenciaNumero && !mov.conversionId && (
                                        <span className="text-gray-300">-</span>
                                      )}
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
                                        cuentaDetalle.esBiMoneda
                                          ? <span>{simbolo} {(mov.moneda === 'PEN' ? saldos.pen : saldos.usd).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                          : <span>{simbolo} {(cuentaDetalle.moneda === 'PEN' ? saldos.pen : saldos.usd).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {movsDisplay.length > movsLimit ? (
                          <div className="px-4 py-3 text-center border-t border-gray-100 space-y-1">
                            <p className="text-xs text-gray-400">Mostrando {movsLimit} de {movsDisplay.length} movimientos</p>
                            <button
                              onClick={() => setMovsLimit(prev => prev + 50)}
                              className="text-sm text-primary-600 hover:text-primary-700 font-medium hover:underline"
                            >
                              Ver mas movimientos
                            </button>
                          </div>
                        ) : movsDisplay.length > 50 && (
                          <div className="px-4 py-2 text-center text-xs text-gray-400 border-t border-gray-100">
                            Mostrando todos los {movsDisplay.length} movimientos
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Cuentas de Credito (Deudas) */}
            {cuentas.some(c => c.tipo === 'credito') && (
              <div className="p-4 sm:p-6 border-t border-red-200 bg-red-50/30">
                <h4 className="text-sm font-semibold text-red-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Lineas de Credito / Deudas
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cuentas.filter(c => c.tipo === 'credito').map((cuenta) => (
                    <Card key={cuenta.id} padding="md" className="border border-red-200 bg-white relative group">
                      <button
                        onClick={() => handleEditarCuenta(cuenta)}
                        className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Editar cuenta"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <CreditCard className="h-6 w-6 text-red-500 mr-2" />
                          <div>
                            <h4 className="font-medium text-gray-900">{cuenta.nombre}</h4>
                            <p className="text-xs text-red-500">credito</p>
                          </div>
                        </div>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">CREDITO</span>
                      </div>
                      {cuenta.esBiMoneda ? (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500">PEN:</span>
                            <span className={`text-lg font-bold ${(cuenta.saldoPEN || 0) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                              {(cuenta.saldoPEN || 0) < 0 ? 'Deuda: ' : ''}S/ {Math.abs(cuenta.saldoPEN || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500">USD:</span>
                            <span className={`text-lg font-bold ${(cuenta.saldoUSD || 0) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                              {(cuenta.saldoUSD || 0) < 0 ? 'Deuda: ' : ''}$ {Math.abs(cuenta.saldoUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className={`text-2xl font-bold ${cuenta.saldoActual < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {cuenta.saldoActual < 0 ? 'Deuda: ' : ''}
                          {cuenta.moneda === 'PEN' ? 'S/ ' : '$ '}
                          {Math.abs(cuenta.saldoActual).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                      {cuenta.titular && (
                        <div className="flex items-center text-sm text-gray-600 mt-2">
                          <User className="h-4 w-4 mr-1 text-gray-400" />
                          <span>{cuenta.titular}</span>
                        </div>
                      )}
                      {cuenta.banco && <p className="text-sm text-gray-500 mt-1">{cuenta.banco}</p>}
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Modal Nueva/Editar Cuenta */}
      <Modal
        isOpen={isCuentaModalOpen}
        onClose={handleCerrarModalCuenta}
        title={cuentaEditando ? 'Editar Cuenta' : 'Nueva Cuenta de Caja'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Cuenta *</label>
            <input
              type="text"
              value={cuentaForm.nombre || ''}
              onChange={(e) => setCuentaForm({ ...cuentaForm, nombre: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Ej: Caja PEN, Cuenta USD BCP"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="inline h-4 w-4 mr-1" />
              Titular de la Cuenta *
            </label>
            <input
              type="text"
              value={cuentaForm.titular || ''}
              onChange={(e) => setCuentaForm({ ...cuentaForm, titular: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Nombre completo del titular"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Persona responsable o propietaria de la cuenta</p>
          </div>

          {/* Toggle Bi-Moneda */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-gray-200">
            <div>
              <label className="text-sm font-medium text-gray-700">Cuenta Bi-Moneda</label>
              <p className="text-xs text-gray-500">Maneja USD y PEN en la misma cuenta</p>
            </div>
            <button
              type="button"
              onClick={() => setCuentaForm({ ...cuentaForm, esBiMoneda: !cuentaForm.esBiMoneda })}
              disabled={!!cuentaEditando}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                cuentaForm.esBiMoneda ? 'bg-primary-600' : 'bg-gray-200'
              } ${cuentaEditando ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                cuentaForm.esBiMoneda ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {cuentaForm.esBiMoneda ? 'Moneda Principal' : 'Moneda'}
              </label>
              <select
                value={cuentaForm.moneda}
                onChange={(e) => setCuentaForm({ ...cuentaForm, moneda: e.target.value as MonedaTesoreria })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                disabled={!!cuentaEditando}
              >
                <option value="PEN">PEN (Soles)</option>
                <option value="USD">USD (Dolares)</option>
              </select>
              {cuentaEditando && !cuentaForm.esBiMoneda && (
                <p className="text-xs text-gray-500 mt-1">No se puede cambiar la moneda</p>
              )}
              {cuentaForm.esBiMoneda && (
                <p className="text-xs text-gray-500 mt-1">Para display y reportes</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={cuentaForm.tipo}
                onChange={(e) => setCuentaForm({ ...cuentaForm, tipo: e.target.value as any })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="efectivo">Efectivo</option>
                <option value="banco">Banco</option>
                <option value="digital">Digital (Yape/Plin)</option>
                <option value="credito">Credito (TC / Prestamo)</option>
              </select>
            </div>
          </div>

          {(cuentaForm.tipo === 'banco' || cuentaForm.tipo === 'credito') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                <input
                  type="text"
                  value={cuentaForm.banco || ''}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, banco: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Ej: BCP, Interbank"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">N° Cuenta</label>
                <input
                  type="text"
                  value={cuentaForm.numeroCuenta || ''}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, numeroCuenta: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Opcional"
                />
              </div>
            </div>
          )}

          {(cuentaForm.tipo === 'banco' || cuentaForm.tipo === 'credito') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CCI (Codigo Interbancario)</label>
              <input
                type="text"
                value={cuentaForm.cci || ''}
                onChange={(e) => setCuentaForm({ ...cuentaForm, cci: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="Opcional - Para transferencias interbancarias"
              />
            </div>
          )}

          {/* Producto Financiero y Titularidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Producto Financiero</label>
              <select
                value={cuentaForm.productoFinanciero || ''}
                onChange={(e) => setCuentaForm({ ...cuentaForm, productoFinanciero: e.target.value as any })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Seleccionar...</option>
                {cuentaForm.tipo === 'efectivo' && <option value="caja">Caja</option>}
                {cuentaForm.tipo === 'banco' && (
                  <>
                    <option value="cuenta_ahorros">Cuenta de Ahorros</option>
                    <option value="cuenta_corriente">Cuenta Corriente</option>
                  </>
                )}
                {cuentaForm.tipo === 'credito' && (
                  <>
                    <option value="tarjeta_credito">Tarjeta de Crédito</option>
                    <option value="tarjeta_debito">Tarjeta de Débito</option>
                  </>
                )}
                {cuentaForm.tipo === 'digital' && <option value="billetera_digital">Billetera Digital</option>}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titularidad</label>
              <select
                value={cuentaForm.titularidad || ''}
                onChange={(e) => setCuentaForm({ ...cuentaForm, titularidad: e.target.value as any })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Seleccionar...</option>
                <option value="empresa">Empresa</option>
                <option value="personal">Personal</option>
              </select>
            </div>
          </div>

          {/* Métodos de pago disponibles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Métodos de Pago Disponibles</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(() => {
                const opciones: { id: string; label: string }[] = [];
                if (cuentaForm.tipo === 'efectivo') opciones.push({ id: 'efectivo', label: 'Efectivo' });
                if (cuentaForm.tipo === 'banco') {
                  opciones.push({ id: 'transferencia', label: 'Transferencia' });
                  const banco = (cuentaForm.banco || '').toUpperCase();
                  if (banco.includes('BCP')) opciones.push({ id: 'yape', label: 'Yape' });
                  if (banco.includes('INTERBANK') || banco.includes('IBK')) opciones.push({ id: 'plin', label: 'Plin' });
                }
                if (cuentaForm.tipo === 'digital') {
                  const nombre = (cuentaForm.nombre || '').toLowerCase();
                  if (nombre.includes('mercado')) opciones.push({ id: 'mercado_pago', label: 'Mercado Pago' });
                  else if (nombre.includes('paypal')) opciones.push({ id: 'paypal', label: 'PayPal' });
                  else if (nombre.includes('zelle')) opciones.push({ id: 'zelle', label: 'Zelle' });
                  else opciones.push({ id: 'otro', label: 'Otro' });
                }
                if (cuentaForm.tipo === 'credito') {
                  opciones.push({ id: 'tarjeta_credito', label: 'Tarjeta Crédito' });
                  opciones.push({ id: 'tarjeta_debito', label: 'Tarjeta Débito' });
                }
                const seleccionados = cuentaForm.metodosDisponibles || [];
                return opciones.map(op => (
                  <label key={op.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                    seleccionados.includes(op.id) ? 'bg-primary-50 border-primary-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}>
                    <input type="checkbox" checked={seleccionados.includes(op.id)}
                      onChange={(e) => {
                        const nuevos = e.target.checked
                          ? [...seleccionados, op.id]
                          : seleccionados.filter(m => m !== op.id);
                        setCuentaForm({ ...cuentaForm, metodosDisponibles: nuevos });
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                    <span className="text-sm">{op.label}</span>
                  </label>
                ));
              })()}
            </div>
            <p className="text-xs text-gray-500 mt-1">Estos métodos aparecerán al registrar pagos desde esta cuenta</p>
          </div>

          {/* Línea de crédito (solo tarjeta_credito) */}
          {(cuentaForm.productoFinanciero === 'tarjeta_credito' || cuentaForm.tipo === 'credito') && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
              <h4 className="text-sm font-medium text-amber-800">Línea de Crédito</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Límite</label>
                  <input type="number" step="0.01" placeholder="0.00"
                    value={cuentaForm.lineaCreditoLimite || ''}
                    onChange={(e) => setCuentaForm({ ...cuentaForm, lineaCreditoLimite: +e.target.value })}
                    className="w-full px-3 py-2 rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tasa anual (%)</label>
                  <input type="number" step="0.1" placeholder="0.0"
                    value={cuentaForm.lineaCreditoTasa || ''}
                    onChange={(e) => setCuentaForm({ ...cuentaForm, lineaCreditoTasa: +e.target.value })}
                    className="w-full px-3 py-2 rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Día de corte</label>
                  <input type="number" min="1" max="28" placeholder="15"
                    value={cuentaForm.lineaCreditoFechaCorte || ''}
                    onChange={(e) => setCuentaForm({ ...cuentaForm, lineaCreditoFechaCorte: +e.target.value })}
                    className="w-full px-3 py-2 rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Día de pago</label>
                  <input type="number" min="1" max="28" placeholder="5"
                    value={cuentaForm.lineaCreditoFechaPago || ''}
                    onChange={(e) => setCuentaForm({ ...cuentaForm, lineaCreditoFechaPago: +e.target.value })}
                    className="w-full px-3 py-2 rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500" />
                </div>
              </div>
            </div>
          )}

          {/* Saldos Iniciales - Solo para creacion */}
          {!cuentaEditando && (
            cuentaForm.esBiMoneda ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Inicial PEN</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">S/</span>
                    <input
                      type="number"
                      step="0.01"
                      value={cuentaForm.saldoInicialPEN || ''}
                      onChange={(e) => setCuentaForm({ ...cuentaForm, saldoInicialPEN: parseFloat(e.target.value) })}
                      className="w-full pl-8 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Inicial USD</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={cuentaForm.saldoInicialUSD || ''}
                      onChange={(e) => setCuentaForm({ ...cuentaForm, saldoInicialUSD: parseFloat(e.target.value) })}
                      className="w-full pl-8 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Inicial</label>
                <input
                  type="number"
                  step="0.01"
                  value={cuentaForm.saldoInicial || ''}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, saldoInicial: parseFloat(e.target.value) })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="0.00"
                />
              </div>
            )
          )}

          {/* Saldos Actuales - Solo para edicion */}
          {cuentaEditando && (
            cuentaForm.esBiMoneda ? (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-3">Saldos actuales:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="text-center">
                    <span className="text-sm text-gray-500">PEN</span>
                    <p className="text-xl font-bold text-green-600">
                      S/ {(cuentaForm.saldoInicialPEN || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-center">
                    <span className="text-sm text-gray-500">USD</span>
                    <p className="text-xl font-bold text-blue-600">
                      $ {(cuentaForm.saldoInicialUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">Los saldos solo se modifican mediante movimientos</p>
              </div>
            ) : (
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Saldo actual:</span>{' '}
                  <span className="text-lg font-bold text-gray-900">
                    {cuentaForm.moneda === 'PEN' ? 'S/ ' : '$ '}
                    {cuentaForm.saldoInicial?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-1">El saldo solo se modifica mediante movimientos</p>
              </div>
            )
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="ghost" onClick={handleCerrarModalCuenta}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={handleGuardarCuenta}
              disabled={isSubmitting || !cuentaForm.nombre || !cuentaForm.titular?.trim()}
            >
              {isSubmitting ? 'Guardando...' : cuentaEditando ? 'Guardar Cambios' : 'Crear Cuenta'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
