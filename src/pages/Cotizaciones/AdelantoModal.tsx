import React from 'react';
import { Clock, Lock, DollarSign } from 'lucide-react';
import { formatCurrencyPEN, formatCurrency as formatCurrencyUtil } from '../../utils/format';
import { Modal, Input, Select, Button } from '../../components/common';
import { useToastStore } from '../../store/toastStore';
import type { Cotizacion } from '../../types/cotizacion.types';
import type { MetodoPago } from '../../types/venta.types';
import type { CuentaCaja, MonedaTesoreria } from '../../types/tesoreria.types';

interface AdelantoModalProps {
  isOpen: boolean;
  cotizacion: Cotizacion;
  tipoModal: 'comprometer' | 'pago';
  monto: number;
  metodoPago: MetodoPago;
  referencia: string;
  cuentaDestinoId: string;
  cuentasDisponibles: CuentaCaja[];
  moneda: MonedaTesoreria;
  tipoCambio: number;
  procesando: boolean;
  onMonto: (v: number) => void;
  onMetodoPago: (v: MetodoPago) => void;
  onReferencia: (v: string) => void;
  onCuentaDestino: (v: string) => void;
  onMonedaChange: (moneda: MonedaTesoreria) => void;
  onTipoCambio: (v: number) => void;
  onConfirmar: (data: {
    monto: number;
    metodoPago?: MetodoPago;
    referencia?: string;
    cuentaDestinoId?: string;
    moneda?: MonedaTesoreria;
    tipoCambio?: number;
  }) => Promise<void>;
  onClose: () => void;
}

export const AdelantoModal: React.FC<AdelantoModalProps> = ({
  isOpen,
  cotizacion,
  tipoModal,
  monto,
  metodoPago,
  referencia,
  cuentaDestinoId,
  cuentasDisponibles,
  moneda,
  tipoCambio,
  procesando,
  onMonto,
  onMetodoPago,
  onReferencia,
  onCuentaDestino,
  onMonedaChange,
  onTipoCambio,
  onConfirmar,
  onClose
}) => {
  const toast = useToastStore();
  const formatCurrency = (amount: number): string => formatCurrencyPEN(amount);
  const formatCurrencyBimoneda = (amount: number, mon: MonedaTesoreria): string =>
    formatCurrencyUtil(amount, mon as 'USD' | 'PEN');

  const handleSubmit = async () => {
    try {
      await onConfirmar({
        monto,
        metodoPago: tipoModal === 'pago' ? metodoPago : undefined,
        referencia: tipoModal === 'pago' ? (referencia || undefined) : undefined,
        cuentaDestinoId: tipoModal === 'pago' ? (cuentaDestinoId || undefined) : undefined,
        moneda: tipoModal === 'pago' ? moneda : undefined,
        tipoCambio: tipoModal === 'pago' && moneda === 'USD' ? tipoCambio : undefined
      });
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tipoModal === 'comprometer' ? 'Comprometer Adelanto' : 'Registrar Pago de Adelanto'}
      size="md"
    >
      <div className="space-y-5">
        {/* Info de la cotización */}
        <div className={`rounded-lg p-4 ${tipoModal === 'comprometer' ? 'bg-gradient-to-r from-purple-50 to-indigo-50' : 'bg-gradient-to-r from-green-50 to-emerald-50'}`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600">Cotización</p>
              <p className="font-bold text-primary-600">{cotizacion.numeroCotizacion}</p>
              <p className="text-sm text-gray-700 mt-1">{cotizacion.nombreCliente}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(cotizacion.totalPEN)}</p>
            </div>
          </div>
        </div>

        {/* Mensaje explicativo */}
        {tipoModal === 'comprometer' ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>Comprometer adelanto:</strong> El cliente se compromete a pagar este monto.
              La cotización pasará a "Esperando Pago" hasta que registres el pago.
            </p>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800">
              <strong>Registrar pago:</strong> El cliente ya pagó el adelanto.
              El stock se reservará y la cotización estará lista para confirmar.
            </p>
          </div>
        )}

        {/* Productos resumidos */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase mb-2">Productos ({cotizacion.productos.length})</p>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {cotizacion.productos.map((p, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-gray-700">{p.cantidad}x {p.marca} {p.nombreComercial}</span>
                <span className="font-medium">{formatCurrency(p.subtotal)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Formulario */}
        <div className="space-y-4">
          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto del Adelanto (S/)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={cotizacion.totalPEN}
              value={monto}
              onChange={(e) => onMonto(parseFloat(e.target.value) || 0)}
              disabled={tipoModal === 'pago' && !!cotizacion.adelantoComprometido}
            />
            {tipoModal === 'comprometer' && (
              <div className="flex gap-2 mt-2">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => onMonto(Math.round(cotizacion.totalPEN * pct / 100 * 100) / 100)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      Math.abs(monto - (cotizacion.totalPEN * pct / 100)) < 0.01
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Campos solo para registrar pago */}
          {tipoModal === 'pago' && (
            <>
              {/* Selector de moneda */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Moneda del Pago
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onMonedaChange('PEN')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                      moneda === 'PEN'
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Soles (PEN)
                  </button>
                  <button
                    type="button"
                    onClick={() => onMonedaChange('USD')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                      moneda === 'USD'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Dólares (USD)
                  </button>
                </div>
              </div>

              {/* Método de pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de Pago
                </label>
                <Select
                  value={metodoPago}
                  onChange={(e) => onMetodoPago(e.target.value as MetodoPago)}
                  options={moneda === 'PEN' ? [
                    { value: 'yape', label: 'Yape' },
                    { value: 'plin', label: 'Plin' },
                    { value: 'transferencia', label: 'Transferencia' },
                    { value: 'efectivo', label: 'Efectivo' }
                  ] : [
                    { value: 'transferencia', label: 'Transferencia' },
                    { value: 'efectivo', label: 'Efectivo' },
                    { value: 'paypal', label: 'PayPal' },
                    { value: 'zelle', label: 'Zelle' }
                  ]}
                />
              </div>

              {/* Cuenta destino */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cuenta Destino {moneda === 'USD' && '(USD)'}
                </label>
                {cuentasDisponibles.length > 0 ? (
                  <Select
                    value={cuentaDestinoId}
                    onChange={(e) => onCuentaDestino(e.target.value)}
                    options={cuentasDisponibles.map(c => ({
                      value: c.id,
                      label: `${c.nombre} (${c.tipo})${c.esBiMoneda ? ' - Bimoneda' : ''}`
                    }))}
                  />
                ) : (
                  <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                    No hay cuentas configuradas para {moneda}
                  </p>
                )}
              </div>

              {/* Tipo de cambio - Solo para USD */}
              {moneda === 'USD' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Cambio (PEN / USD)
                    </label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0.01"
                      value={tipoCambio}
                      onChange={(e) => onTipoCambio(parseFloat(e.target.value) || 3.7)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      TC del día cargado automáticamente. Puedes ajustarlo si es necesario.
                    </p>
                  </div>
                  <div className="bg-white rounded p-2 border border-blue-100">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Adelanto comprometido:</span>
                      <span className="font-medium">{formatCurrency(monto)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm mt-1">
                      <span className="text-gray-600">Equivalente a pagar en USD:</span>
                      <span className="font-bold text-blue-700">
                        {formatCurrencyBimoneda(
                          Math.round((monto / tipoCambio) * 100) / 100,
                          'USD'
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Referencia */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referencia / N° Operación (opcional)
                </label>
                <Input
                  type="text"
                  value={referencia}
                  onChange={(e) => onReferencia(e.target.value)}
                  placeholder="Ej: OP-123456"
                />
              </div>
            </>
          )}
        </div>

        {/* Resumen */}
        <div className={`border rounded-lg p-4 ${tipoModal === 'comprometer' ? 'bg-purple-50 border-purple-200' : 'bg-green-50 border-green-200'}`}>
          {tipoModal === 'comprometer' ? (
            <>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Adelanto:</span>
                <span className="font-bold text-purple-700">{formatCurrency(monto)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Saldo pendiente:</span>
                <span className="font-bold text-gray-900">{formatCurrency(cotizacion.totalPEN - monto)}</span>
              </div>
            </>
          ) : (
            <>
              {moneda === 'PEN' && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Adelanto a pagar:</span>
                  <span className="font-bold text-green-700">{formatCurrency(monto)}</span>
                </div>
              )}
              {moneda === 'USD' && (
                <>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">Adelanto comprometido:</span>
                    <span className="font-medium text-gray-700">{formatCurrency(monto)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">A pagar en USD:</span>
                    <span className="font-bold text-blue-700">
                      {formatCurrencyBimoneda(
                        Math.round((monto / tipoCambio) * 100) / 100,
                        'USD'
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2 text-xs text-gray-500">
                    <span>TC aplicado:</span>
                    <span>{tipoCambio.toFixed(3)}</span>
                  </div>
                </>
              )}
              <div className="mt-3 pt-3 border-t border-green-200">
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <Clock className="h-4 w-4" />
                  <span>El stock se reservará por <strong>90 días</strong></span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={procesando}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            className={`flex-1 ${tipoModal === 'comprometer' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'}`}
            disabled={procesando || monto <= 0 || monto > cotizacion.totalPEN}
            onClick={handleSubmit}
          >
            {tipoModal === 'comprometer' ? (
              <>
                <Lock className="h-4 w-4 mr-2" />
                {procesando ? 'Procesando...' : 'Comprometer Adelanto'}
              </>
            ) : (
              <>
                <DollarSign className="h-4 w-4 mr-2" />
                {procesando ? 'Procesando...' : 'Registrar Pago'}
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
