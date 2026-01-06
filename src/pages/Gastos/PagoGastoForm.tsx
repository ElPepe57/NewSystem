import React, { useState, useEffect, useMemo } from 'react';
import { X, CreditCard, Wallet, Calendar, DollarSign, Banknote, AlertCircle } from 'lucide-react';
import { Button } from '../../components/common';
import { useAuthStore } from '../../store/authStore';
import { useGastoStore } from '../../store/gastoStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { tesoreriaService } from '../../services/tesoreria.service';
import type { Gasto } from '../../types/gasto.types';
import type { CuentaCaja, MetodoTesoreria } from '../../types/tesoreria.types';

interface PagoGastoFormProps {
  gasto: Gasto;
  onClose: () => void;
  onSuccess: () => void;
}

export const PagoGastoForm: React.FC<PagoGastoFormProps> = ({
  gasto,
  onClose,
  onSuccess
}) => {
  const { user } = useAuthStore();
  const { registrarPagoGasto } = useGastoStore();
  const { getTCDelDia } = useTipoCambioStore();

  // Estado del formulario
  const [fechaPago, setFechaPago] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [monedaPago, setMonedaPago] = useState<'USD' | 'PEN'>(gasto.moneda);
  const [montoPago, setMontoPago] = useState<number>(gasto.montoOriginal);
  const [tipoCambio, setTipoCambio] = useState<number>(gasto.tipoCambio || 3.70);
  const [metodoPago, setMetodoPago] = useState<MetodoTesoreria>('efectivo');
  const [cuentaOrigenId, setCuentaOrigenId] = useState<string>('');
  const [referenciaPago, setReferenciaPago] = useState<string>('');
  const [notas, setNotas] = useState<string>('');

  // Estado de cuentas
  const [cuentas, setCuentas] = useState<CuentaCaja[]>([]);
  const [loadingCuentas, setLoadingCuentas] = useState(true);
  const [loading, setLoading] = useState(false);

  // Cargar TC del día
  useEffect(() => {
    const loadTC = async () => {
      const tc = await getTCDelDia();
      if (tc) {
        setTipoCambio(gasto.tipoCambio || tc.compra);
      }
    };
    loadTC();
  }, [getTCDelDia, gasto.tipoCambio]);

  // Cargar cuentas
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

  // Filtrar cuentas por moneda seleccionada
  const cuentasFiltradas = useMemo(() => {
    return cuentas.filter(c => c.esBiMoneda || c.moneda === monedaPago);
  }, [cuentas, monedaPago]);

  // Auto-seleccionar cuenta al cambiar moneda
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

  // Cuenta seleccionada
  const cuentaSeleccionada = cuentas.find(c => c.id === cuentaOrigenId);

  // Calcular equivalencias
  const montoUSD = monedaPago === 'USD' ? montoPago : montoPago / tipoCambio;
  const montoPEN = monedaPago === 'PEN' ? montoPago : montoPago * tipoCambio;

  // Calcular saldo nuevo
  const saldoActualCuenta = cuentaSeleccionada
    ? (cuentaSeleccionada.esBiMoneda
        ? (monedaPago === 'USD' ? cuentaSeleccionada.saldoUSD : cuentaSeleccionada.saldoPEN) || 0
        : cuentaSeleccionada.saldoActual)
    : 0;
  const saldoNuevo = saldoActualCuenta - montoPago;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert('Debe iniciar sesión');
      return;
    }

    if (!cuentaOrigenId) {
      alert('Debe seleccionar una cuenta de origen');
      return;
    }

    if (montoPago <= 0) {
      alert('El monto debe ser mayor a 0');
      return;
    }

    if (tipoCambio <= 0) {
      alert('El tipo de cambio debe ser mayor a 0');
      return;
    }

    setLoading(true);

    try {
      await registrarPagoGasto(gasto.id, {
        fechaPago: new Date(fechaPago),
        monedaPago,
        montoPago,
        tipoCambio,
        metodoPago,
        cuentaOrigenId,
        referenciaPago: referenciaPago || undefined,
        notas: notas || undefined
      }, user.uid);

      alert('✅ Pago registrado exitosamente');
      onSuccess();
    } catch (error: any) {
      alert(`❌ Error al registrar pago: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-green-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Registrar Pago de Gasto</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                {gasto.numeroGasto} - {gasto.descripcion}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Resumen del Gasto */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">Gasto a Pagar</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Tipo:</span>
                <span className="font-medium text-gray-900 ml-2">{gasto.tipo}</span>
              </div>
              <div>
                <span className="text-gray-600">Categoría:</span>
                <span className="font-medium text-gray-900 ml-2">{gasto.categoria}</span>
              </div>
              <div>
                <span className="text-gray-600">Monto Original:</span>
                <span className="font-bold text-amber-700 ml-2">
                  {gasto.moneda === 'USD' ? '$' : 'S/'} {gasto.montoOriginal.toFixed(2)} {gasto.moneda}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Equivalente PEN:</span>
                <span className="font-medium text-gray-900 ml-2">
                  S/ {gasto.montoPEN.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Fecha de Pago */}
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
          </div>

          {/* Moneda de Pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Moneda de Pago *</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setMonedaPago('PEN');
                  if (gasto.moneda === 'PEN') {
                    setMontoPago(gasto.montoOriginal);
                  } else {
                    setMontoPago(gasto.montoPEN);
                  }
                }}
                className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all flex items-center justify-center gap-2 ${
                  monedaPago === 'PEN'
                    ? 'border-green-500 bg-green-50 text-green-700 ring-2 ring-green-200'
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Banknote className="h-5 w-5" />
                S/ Soles (PEN)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMonedaPago('USD');
                  if (gasto.moneda === 'USD') {
                    setMontoPago(gasto.montoOriginal);
                  } else {
                    setMontoPago(gasto.montoOriginal / tipoCambio);
                  }
                }}
                className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all flex items-center justify-center gap-2 ${
                  monedaPago === 'USD'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <DollarSign className="h-5 w-5" />
                $ Dólares (USD)
              </button>
            </div>
          </div>

          {/* Monto y TC */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto a Pagar ({monedaPago === 'USD' ? '$' : 'S/'}) *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={montoPago || ''}
                onChange={(e) => setMontoPago(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-lg font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Cambio *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.001"
                value={tipoCambio || ''}
                onChange={(e) => setTipoCambio(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Preview de equivalencias */}
          {montoPago > 0 && tipoCambio > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center">
                <div className={`text-center ${monedaPago === 'PEN' ? 'font-bold' : ''}`}>
                  <div className="text-xs text-gray-500">En Soles</div>
                  <div className="text-lg text-green-700">S/ {montoPEN.toFixed(2)}</div>
                </div>
                <div className="text-gray-400">=</div>
                <div className={`text-center ${monedaPago === 'USD' ? 'font-bold' : ''}`}>
                  <div className="text-xs text-gray-500">En Dólares</div>
                  <div className="text-lg text-blue-700">$ {montoUSD.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Método de Pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago *</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'efectivo', label: 'Efectivo', icon: '💵' },
                { value: 'transferencia_bancaria', label: 'Transferencia', icon: '🏦' },
                { value: 'yape', label: 'Yape', icon: '📱' },
                { value: 'plin', label: 'Plin', icon: '📲' },
                { value: 'tarjeta_credito', label: 'T. Crédito', icon: '💳' },
                { value: 'otro', label: 'Otro', icon: '📋' }
              ].map((metodo) => (
                <button
                  key={metodo.value}
                  type="button"
                  onClick={() => setMetodoPago(metodo.value as MetodoTesoreria)}
                  className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    metodoPago === metodo.value
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-1">{metodo.icon}</span>
                  {metodo.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cuenta de Origen */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Wallet className="inline h-4 w-4 mr-1" />
              Cuenta de Origen *
            </label>
            {loadingCuentas ? (
              <div className="text-sm text-gray-500 py-2">Cargando cuentas...</div>
            ) : cuentasFiltradas.length === 0 ? (
              <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                <AlertCircle className="inline h-4 w-4 mr-1" />
                No hay cuentas disponibles para {monedaPago}. Configure cuentas en Tesorería.
              </div>
            ) : (
              <>
                <select
                  value={cuentaOrigenId}
                  onChange={(e) => setCuentaOrigenId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Seleccionar cuenta...</option>
                  {cuentasFiltradas.map((cuenta) => {
                    const saldo = cuenta.esBiMoneda
                      ? (monedaPago === 'USD' ? cuenta.saldoUSD : cuenta.saldoPEN) || 0
                      : cuenta.saldoActual;
                    const simbolo = monedaPago === 'USD' ? '$' : 'S/';
                    const etiquetaBiMoneda = cuenta.esBiMoneda ? ' [BI-MONEDA]' : '';
                    return (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.nombre}{etiquetaBiMoneda} - Saldo: {simbolo} {saldo.toFixed(2)}
                      </option>
                    );
                  })}
                </select>

                {cuentaSeleccionada && montoPago > 0 && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Saldo actual:</span>
                      <span className="font-medium">
                        {monedaPago === 'USD' ? '$' : 'S/'} {saldoActualCuenta.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Egreso:</span>
                      <span className="font-medium">
                        - {monedaPago === 'USD' ? '$' : 'S/'} {montoPago.toFixed(2)}
                      </span>
                    </div>
                    <div className={`flex justify-between text-sm font-bold mt-1 pt-1 border-t ${
                      saldoNuevo < 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      <span>Nuevo saldo:</span>
                      <span>
                        {monedaPago === 'USD' ? '$' : 'S/'} {saldoNuevo.toFixed(2)}
                      </span>
                    </div>
                    {saldoNuevo < 0 && (
                      <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Saldo insuficiente. El pago dejará la cuenta en negativo.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Referencia */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referencia / Nº Operación (Opcional)
            </label>
            <input
              type="text"
              value={referenciaPago}
              onChange={(e) => setReferenciaPago(e.target.value)}
              placeholder="Ej: OP-123456, Voucher, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas (Opcional)
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Observaciones adicionales..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !cuentaOrigenId}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Registrando...' : 'Registrar Pago'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
