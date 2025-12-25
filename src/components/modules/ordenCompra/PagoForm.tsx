import React, { useState, useEffect, useMemo } from 'react';
import { X, CreditCard, AlertCircle, Wallet, Calendar, DollarSign, History, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Input, Card, Select, Badge } from '../../common';
import { useTipoCambioStore } from '../../../store/tipoCambioStore';
import { tesoreriaService } from '../../../services/tesoreria.service';
import type { OrdenCompra, PagoOrdenCompra } from '../../../types/ordenCompra.types';
import type { MetodoTesoreria, CuentaCaja, MonedaTesoreria } from '../../../types/tesoreria.types';

interface PagoFormData {
  fechaPago: Date;
  monedaPago: 'USD' | 'PEN';
  montoOriginal: number;
  tipoCambio: number;
  metodoPago: MetodoTesoreria;
  cuentaOrigenId?: string;
  referencia?: string;
  notas?: string;
}

interface PagoFormProps {
  orden: OrdenCompra;
  onSubmit: (datos: PagoFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const PagoForm: React.FC<PagoFormProps> = ({
  orden,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const { getTCDelDia } = useTipoCambioStore();

  // ========== Estado del formulario ==========
  const [fechaPago, setFechaPago] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [monedaPago, setMonedaPago] = useState<'USD' | 'PEN'>('USD');
  const [montoOriginal, setMontoOriginal] = useState(0);
  const [tipoCambio, setTipoCambio] = useState(orden.tcPago || orden.tcCompra || 3.70);
  const [metodoPago, setMetodoPago] = useState<MetodoTesoreria>('transferencia_bancaria');
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas] = useState('');
  const [esPagoCompleto, setEsPagoCompleto] = useState(true);

  // ========== Estado para cuentas ==========
  const [cuentas, setCuentas] = useState<CuentaCaja[]>([]);
  const [cuentaOrigenId, setCuentaOrigenId] = useState<string>('');
  const [loadingCuentas, setLoadingCuentas] = useState(true);

  // ========== Estado para historial ==========
  const [showHistorial, setShowHistorial] = useState(false);

  // ========== Cargar TC y cuentas ==========
  useEffect(() => {
    const loadTC = async () => {
      if (!orden.tcPago && !orden.tcCompra) {
        const tc = await getTCDelDia();
        if (tc) {
          setTipoCambio(tc.compra);
        }
      }
    };
    loadTC();
  }, [getTCDelDia, orden.tcPago, orden.tcCompra]);

  useEffect(() => {
    const cargarCuentas = async () => {
      try {
        setLoadingCuentas(true);
        const todasCuentas = await tesoreriaService.getCuentas();
        const cuentasActivas = todasCuentas.filter(c => c.activa);
        setCuentas(cuentasActivas);
      } catch (error) {
        console.error('Error al cargar cuentas:', error);
      } finally {
        setLoadingCuentas(false);
      }
    };
    cargarCuentas();
  }, []);

  // ========== Filtrar cuentas por moneda seleccionada ==========
  // Incluye cuentas bi-moneda que manejan ambas monedas
  const cuentasFiltradas = useMemo(() => {
    return cuentas.filter(c => c.esBiMoneda || c.moneda === monedaPago);
  }, [cuentas, monedaPago]);

  // ========== Auto-seleccionar cuenta al cambiar moneda ==========
  useEffect(() => {
    const cuentaPorDefecto = cuentasFiltradas.find(c => c.esCuentaPorDefecto);
    if (cuentaPorDefecto) {
      setCuentaOrigenId(cuentaPorDefecto.id);
    } else if (cuentasFiltradas.length > 0) {
      setCuentaOrigenId(cuentasFiltradas[0].id);
    } else {
      setCuentaOrigenId('');
    }
  }, [cuentasFiltradas]);

  // ========== Calcular totales ==========
  const calcularPendiente = () => {
    // Calcular total pagado de historialPagos
    const pagadoHistorial = orden.historialPagos?.reduce((sum, p) => sum + p.montoUSD, 0) || 0;
    // Si no hay historial, usar legacy
    const pagadoLegacy = orden.montosPagados?.reduce((sum, m) => sum + m, 0) || 0;
    const pagadoUSD = pagadoHistorial > 0 ? pagadoHistorial : (pagadoLegacy / (orden.tcPago || tipoCambio));
    return orden.totalUSD - pagadoUSD;
  };

  const pendienteUSD = calcularPendiente();

  // Calcular equivalencias
  const montoUSD = monedaPago === 'USD' ? montoOriginal : montoOriginal / tipoCambio;
  const montoPEN = monedaPago === 'PEN' ? montoOriginal : montoOriginal * tipoCambio;

  // ========== Establecer monto por defecto ==========
  useEffect(() => {
    if (esPagoCompleto) {
      if (monedaPago === 'USD') {
        setMontoOriginal(pendienteUSD > 0 ? pendienteUSD : orden.totalUSD);
      } else {
        setMontoOriginal(pendienteUSD > 0 ? pendienteUSD * tipoCambio : orden.totalUSD * tipoCambio);
      }
    }
  }, [esPagoCompleto, pendienteUSD, orden.totalUSD, monedaPago, tipoCambio]);

  // ========== Cuenta seleccionada ==========
  const cuentaSeleccionada = cuentas.find(c => c.id === cuentaOrigenId);

  // ========== Formatters ==========
  const formatCurrency = (amount: number, currency: 'USD' | 'PEN') => {
    const symbol = currency === 'USD' ? '$' : 'S/';
    return `${symbol} ${amount.toFixed(2)}`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // ========== Submit ==========
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (tipoCambio <= 0) {
      alert('El tipo de cambio debe ser mayor a 0');
      return;
    }

    if (montoOriginal <= 0) {
      alert('El monto debe ser mayor a 0');
      return;
    }

    if (montoUSD > pendienteUSD + 0.01) {
      alert(`El monto no puede ser mayor al pendiente ($${pendienteUSD.toFixed(2)} USD)`);
      return;
    }

    onSubmit({
      fechaPago: new Date(fechaPago),
      monedaPago,
      montoOriginal,
      tipoCambio,
      metodoPago,
      cuentaOrigenId: cuentaOrigenId || undefined,
      referencia: referencia || undefined,
      notas: notas || undefined
    });
  };

  // ========== Historial de pagos ==========
  const historialPagos = orden.historialPagos || [];
  const tieneHistorial = historialPagos.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-primary-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Registrar Pago</h2>
              <p className="text-sm text-gray-600 mt-1">
                Orden {orden.numeroOrden} - {orden.nombreProveedor}
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* ========== Resumen de Orden ========== */}
          <Card padding="md" className="bg-blue-50">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Resumen de Orden</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total USD:</span>
                <span className="font-medium text-gray-900 ml-2">${orden.totalUSD.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">TC Referencia:</span>
                <span className="font-medium text-gray-900 ml-2">{(orden.tcPago || orden.tcCompra || tipoCambio).toFixed(3)}</span>
              </div>
              <div>
                <span className="text-gray-600">Total PEN (ref):</span>
                <span className="font-medium text-gray-900 ml-2">S/ {(orden.totalUSD * (orden.tcPago || orden.tcCompra || tipoCambio)).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">Estado:</span>
                <Badge
                  variant={orden.estadoPago === 'pagada' ? 'success' : orden.estadoPago === 'pago_parcial' ? 'warning' : 'danger'}
                  className="ml-2"
                >
                  {orden.estadoPago === 'pagada' ? 'Pagada' : orden.estadoPago === 'pago_parcial' ? 'Parcial' : 'Pendiente'}
                </Badge>
              </div>
            </div>

            {orden.estadoPago !== 'pagada' && pendienteUSD > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">Pendiente por pagar:</span>
                  <div className="text-right">
                    <div className="text-lg font-bold text-danger-600">${pendienteUSD.toFixed(2)} USD</div>
                    <div className="text-sm text-gray-500">≈ S/ {(pendienteUSD * tipoCambio).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* ========== Historial de Pagos ========== */}
          {tieneHistorial && (
            <Card padding="md" className="bg-gray-50">
              <button
                type="button"
                onClick={() => setShowHistorial(!showHistorial)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-gray-600" />
                  <span className="font-semibold text-gray-900">
                    Historial de Pagos ({historialPagos.length})
                  </span>
                </div>
                {showHistorial ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>

              {showHistorial && (
                <div className="mt-4 space-y-3">
                  {historialPagos.map((pago, idx) => (
                    <div key={pago.id || idx} className="bg-white p-3 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900">
                            {formatCurrency(pago.montoOriginal, pago.monedaPago)}
                            <span className="text-gray-500 text-sm ml-2">
                              ({pago.monedaPago === 'USD' ? `≈ S/ ${pago.montoPEN.toFixed(2)}` : `≈ $${pago.montoUSD.toFixed(2)}`})
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {pago.metodoPago} • TC: {pago.tipoCambio.toFixed(3)}
                            {pago.cuentaOrigenNombre && ` • ${pago.cuentaOrigenNombre}`}
                          </div>
                          {pago.referencia && (
                            <div className="text-xs text-gray-500 mt-1">Ref: {pago.referencia}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">{formatDate(pago.fecha)}</div>
                          <Badge variant="success" size="sm">Pagado</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* ========== Fecha de Pago ========== */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="inline h-4 w-4 mr-1" />
                Fecha de Pago *
              </label>
              <input
                type="date"
                required
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">Fecha real en que se realizó el pago</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <DollarSign className="inline h-4 w-4 mr-1" />
                Moneda de Pago *
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMonedaPago('USD')}
                  className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-colors ${
                    monedaPago === 'USD'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  $ USD
                </button>
                <button
                  type="button"
                  onClick={() => setMonedaPago('PEN')}
                  className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-colors ${
                    monedaPago === 'PEN'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  S/ PEN
                </button>
              </div>
            </div>
          </div>

          {/* ========== Tipo de Pago ========== */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Tipo de Pago</label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                esPagoCompleto ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  checked={esPagoCompleto}
                  onChange={() => setEsPagoCompleto(true)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900">Pago Completo</div>
                  <div className="text-xs text-gray-500">
                    {monedaPago === 'USD' ? `$${pendienteUSD.toFixed(2)}` : `S/ ${(pendienteUSD * tipoCambio).toFixed(2)}`}
                  </div>
                </div>
              </label>

              <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                !esPagoCompleto ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  checked={!esPagoCompleto}
                  onChange={() => setEsPagoCompleto(false)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900">Pago Parcial</div>
                  <div className="text-xs text-gray-500">Monto personalizado</div>
                </div>
              </label>
            </div>
          </div>

          {/* ========== Monto y TC ========== */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="Tipo de Cambio *"
                type="number"
                required
                min="0"
                step="0.001"
                value={tipoCambio}
                onChange={(e) => setTipoCambio(parseFloat(e.target.value) || 0)}
                helperText="TC al momento del pago"
              />
            </div>

            <div>
              <Input
                label={`Monto a Pagar (${monedaPago}) *`}
                type="number"
                required
                min="0"
                step="0.01"
                value={montoOriginal}
                onChange={(e) => setMontoOriginal(parseFloat(e.target.value) || 0)}
                disabled={esPagoCompleto}
              />
              <div className="text-xs text-gray-500 mt-1">
                {monedaPago === 'USD'
                  ? `Equivale a S/ ${montoPEN.toFixed(2)}`
                  : `Equivale a $${montoUSD.toFixed(2)} USD`
                }
              </div>
            </div>
          </div>

          {/* ========== Método y Cuenta ========== */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Método de Pago *"
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value as MetodoTesoreria)}
              options={[
                { value: 'transferencia_bancaria', label: 'Transferencia Bancaria' },
                { value: 'zelle', label: 'Zelle' },
                { value: 'paypal', label: 'PayPal' },
                { value: 'efectivo', label: 'Efectivo' },
                { value: 'tarjeta', label: 'Tarjeta' },
                { value: 'otro', label: 'Otro' }
              ]}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Wallet className="inline h-4 w-4 mr-1" />
                Cuenta de Origen ({monedaPago})
              </label>
              {loadingCuentas ? (
                <div className="text-sm text-gray-500 py-2">Cargando cuentas...</div>
              ) : cuentasFiltradas.length === 0 ? (
                <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">
                  No hay cuentas en {monedaPago} configuradas
                </div>
              ) : (
                <select
                  value={cuentaOrigenId}
                  onChange={(e) => setCuentaOrigenId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm"
                >
                  <option value="">Sin cuenta específica</option>
                  {cuentasFiltradas.map((cuenta) => {
                    // Para cuentas bi-moneda, mostrar el saldo de la moneda seleccionada
                    const saldoMostrar = cuenta.esBiMoneda
                      ? (monedaPago === 'USD' ? (cuenta.saldoUSD || 0) : (cuenta.saldoPEN || 0))
                      : cuenta.saldoActual;
                    const etiquetaBiMoneda = cuenta.esBiMoneda ? ' [BI-MONEDA]' : '';
                    return (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.nombre}{etiquetaBiMoneda} {cuenta.banco ? `(${cuenta.banco})` : ''} - Saldo {monedaPago}: {monedaPago === 'USD' ? '$' : 'S/'} {saldoMostrar.toFixed(2)}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          </div>

          {/* Info de cuenta seleccionada */}
          {cuentaSeleccionada && (() => {
            // Para cuentas bi-moneda, usar el saldo de la moneda seleccionada
            const saldoActual = cuentaSeleccionada.esBiMoneda
              ? (monedaPago === 'USD' ? (cuentaSeleccionada.saldoUSD || 0) : (cuentaSeleccionada.saldoPEN || 0))
              : cuentaSeleccionada.saldoActual;
            const simbolo = monedaPago === 'USD' ? '$' : 'S/';

            return (
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Cuenta:</span>
                  <span className="font-medium">
                    {cuentaSeleccionada.nombre}
                    {cuentaSeleccionada.esBiMoneda && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-gradient-to-r from-green-100 to-blue-100 text-gray-700">
                        BI-MONEDA
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Saldo actual ({monedaPago}):</span>
                  <span className="font-medium">
                    {simbolo} {saldoActual.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-primary-600 font-medium">
                  <span>Saldo después del pago:</span>
                  <span>
                    {simbolo} {(saldoActual - montoOriginal).toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* ========== Referencia y Notas ========== */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Referencia / Nro. Operación"
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej: OP-123456"
            />
            <Input
              label="Notas"
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas adicionales"
            />
          </div>

          {/* ========== Advertencia TC ========== */}
          {orden.tcCompra && Math.abs(tipoCambio - orden.tcCompra) > 0.01 && (
            <div className="p-4 bg-yellow-50 rounded-lg flex items-start">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <strong>Diferencia cambiaria:</strong> TC actual ({tipoCambio.toFixed(3)}) vs TC de compra ({orden.tcCompra.toFixed(3)}).
                {tipoCambio > orden.tcCompra
                  ? ` Pérdida estimada: S/ ${((tipoCambio - orden.tcCompra) * montoUSD).toFixed(2)}`
                  : ` Ganancia estimada: S/ ${((orden.tcCompra - tipoCambio) * montoUSD).toFixed(2)}`
                }
              </div>
            </div>
          )}

          {/* ========== Resumen del Pago ========== */}
          <Card padding="md" className="bg-green-50 border-green-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Resumen del Pago a Registrar</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Fecha:</span>
                <span className="font-medium text-gray-900 ml-2">
                  {new Date(fechaPago).toLocaleDateString('es-PE')}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Moneda:</span>
                <span className="font-medium text-gray-900 ml-2">{monedaPago}</span>
              </div>
              <div>
                <span className="text-gray-600">Monto:</span>
                <span className="font-bold text-lg text-gray-900 ml-2">
                  {formatCurrency(montoOriginal, monedaPago)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Equivalente:</span>
                <span className="font-medium text-gray-900 ml-2">
                  {monedaPago === 'USD' ? `S/ ${montoPEN.toFixed(2)}` : `$${montoUSD.toFixed(2)}`}
                </span>
              </div>
            </div>
          </Card>

          {/* ========== Acciones ========== */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || montoOriginal <= 0 || tipoCambio <= 0}>
              {loading ? 'Registrando...' : `Registrar Pago (${formatCurrency(montoOriginal, monedaPago)})`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
