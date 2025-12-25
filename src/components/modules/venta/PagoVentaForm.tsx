import React, { useState, useEffect } from 'react';
import { X, CreditCard, Banknote, Smartphone, Building2, Wallet } from 'lucide-react';
import { Button, Input, Card } from '../../common';
import { tesoreriaService } from '../../../services/tesoreria.service';
import type { Venta, MetodoPago } from '../../../types/venta.types';
import type { CuentaCaja, MetodoTesoreria } from '../../../types/tesoreria.types';

interface PagoVentaFormProps {
  venta: Venta;
  onSubmit: (datosPago: {
    monto: number;
    metodoPago: MetodoPago;
    referencia?: string;
    notas?: string;
    cuentaDestinoId?: string;
  }) => void;
  onCancel: () => void;
  loading?: boolean;
}

// Mapeo de MetodoPago (ventas) a MetodoTesoreria
const mapMetodoPagoToTesoreria = (metodo: MetodoPago): MetodoTesoreria => {
  const mapping: Record<MetodoPago, MetodoTesoreria> = {
    'efectivo': 'efectivo',
    'transferencia': 'transferencia_bancaria',
    'yape': 'yape',
    'plin': 'plin',
    'tarjeta': 'tarjeta',
    'mercado_pago': 'mercado_pago',
    'otro': 'otro'
  };
  return mapping[metodo];
};

const METODOS_PAGO: { value: MetodoPago; label: string; icon: React.ReactNode }[] = [
  { value: 'efectivo', label: 'Efectivo', icon: <Banknote className="h-4 w-4" /> },
  { value: 'transferencia', label: 'Transferencia', icon: <Building2 className="h-4 w-4" /> },
  { value: 'yape', label: 'Yape', icon: <Smartphone className="h-4 w-4" /> },
  { value: 'plin', label: 'Plin', icon: <Smartphone className="h-4 w-4" /> },
  { value: 'tarjeta', label: 'Tarjeta', icon: <CreditCard className="h-4 w-4" /> },
  { value: 'mercado_pago', label: 'Mercado Pago', icon: <CreditCard className="h-4 w-4" /> },
  { value: 'otro', label: 'Otro', icon: <Banknote className="h-4 w-4" /> },
];

export const PagoVentaForm: React.FC<PagoVentaFormProps> = ({
  venta,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [monto, setMonto] = useState(venta.montoPendiente);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas] = useState('');
  const [esPagoCompleto, setEsPagoCompleto] = useState(true);

  // Estado para cuentas de tesorería
  const [cuentas, setCuentas] = useState<CuentaCaja[]>([]);
  const [cuentaDestinoId, setCuentaDestinoId] = useState<string>('');
  const [loadingCuentas, setLoadingCuentas] = useState(true);

  // Cargar cuentas al montar el componente
  useEffect(() => {
    const cargarCuentas = async () => {
      try {
        setLoadingCuentas(true);
        const cuentasActivas = await tesoreriaService.getCuentasActivas('PEN');
        setCuentas(cuentasActivas);

        // Seleccionar cuenta por defecto según método de pago
        const metodoTesoreria = mapMetodoPagoToTesoreria(metodoPago);
        const cuentaPorDefecto = await tesoreriaService.getCuentaPorMetodoPago(metodoTesoreria, 'PEN');
        if (cuentaPorDefecto) {
          setCuentaDestinoId(cuentaPorDefecto.id);
        } else if (cuentasActivas.length > 0) {
          setCuentaDestinoId(cuentasActivas[0].id);
        }
      } catch (error) {
        console.error('Error al cargar cuentas:', error);
      } finally {
        setLoadingCuentas(false);
      }
    };

    cargarCuentas();
  }, []);

  // Actualizar cuenta destino cuando cambia el método de pago
  useEffect(() => {
    const actualizarCuentaPorMetodo = async () => {
      const metodoTesoreria = mapMetodoPagoToTesoreria(metodoPago);
      const cuentaPorDefecto = await tesoreriaService.getCuentaPorMetodoPago(metodoTesoreria, 'PEN');
      if (cuentaPorDefecto) {
        setCuentaDestinoId(cuentaPorDefecto.id);
      }
    };

    if (!loadingCuentas) {
      actualizarCuentaPorMetodo();
    }
  }, [metodoPago, loadingCuentas]);

  // Actualizar monto según tipo de pago
  const handleTipoPagoChange = (completo: boolean) => {
    setEsPagoCompleto(completo);
    if (completo) {
      setMonto(venta.montoPendiente);
    } else {
      setMonto(0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (monto <= 0) {
      alert('El monto debe ser mayor a 0');
      return;
    }

    // Permitir sobrepagos con confirmación
    if (monto > venta.montoPendiente) {
      const excedente = monto - venta.montoPendiente;
      const confirmar = window.confirm(
        `El monto ingresado (S/ ${monto.toFixed(2)}) excede el saldo pendiente por S/ ${excedente.toFixed(2)}.\n\n` +
        `¿Deseas registrar este pago de todas formas?\n\n` +
        `El excedente quedará como saldo a favor del cliente.`
      );
      if (!confirmar) return;
    }

    onSubmit({
      monto,
      metodoPago,
      referencia: referencia.trim() || undefined,
      notas: notas.trim() || undefined,
      cuentaDestinoId: cuentaDestinoId || undefined
    });
  };

  // Obtener nombre de cuenta seleccionada
  const cuentaSeleccionada = cuentas.find(c => c.id === cuentaDestinoId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-success-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Registrar Pago</h2>
              <p className="text-sm text-gray-600 mt-1">
                Venta {venta.numeroVenta} - {venta.nombreCliente}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Resumen de venta */}
          <Card padding="md" className="bg-green-50">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Resumen de Venta</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Venta:</span>
                <span className="font-semibold text-gray-900">S/ {venta.totalPEN.toFixed(2)}</span>
              </div>

              {venta.montoPagado > 0 && (
                <div className="flex justify-between text-success-600">
                  <span>Ya cobrado:</span>
                  <span className="font-medium">S/ {venta.montoPagado.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t border-green-200">
                <span className="text-gray-700 font-medium">Pendiente de cobro:</span>
                <span className="font-bold text-lg text-danger-600">S/ {venta.montoPendiente.toFixed(2)}</span>
              </div>
            </div>
          </Card>

          {/* Tipo de pago */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Tipo de Pago
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                esPagoCompleto
                  ? 'border-success-500 bg-success-50 ring-2 ring-success-200'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  checked={esPagoCompleto}
                  onChange={() => handleTipoPagoChange(true)}
                  className="h-4 w-4 text-success-600 focus:ring-success-500"
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900">
                    Pago Completo
                  </div>
                  <div className="text-xs text-gray-500">
                    S/ {venta.montoPendiente.toFixed(2)}
                  </div>
                </div>
              </label>

              <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                !esPagoCompleto
                  ? 'border-warning-500 bg-warning-50 ring-2 ring-warning-200'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  checked={!esPagoCompleto}
                  onChange={() => handleTipoPagoChange(false)}
                  className="h-4 w-4 text-warning-600 focus:ring-warning-500"
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900">
                    Pago Parcial
                  </div>
                  <div className="text-xs text-gray-500">
                    Monto personalizado
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Monto */}
          <div>
            <Input
              label="Monto a Cobrar (PEN)"
              type="number"
              required
              min="0.01"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(parseFloat(e.target.value) || 0)}
              disabled={esPagoCompleto}
              helperText={!esPagoCompleto ? `Máximo: S/ ${venta.montoPendiente.toFixed(2)}` : undefined}
            />
            {/* Advertencia de sobrepago */}
            {monto > venta.montoPendiente && (
              <div className="mt-2 flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-amber-600 text-sm">⚠️</span>
                <span className="text-sm text-amber-700">
                  El valor debe ser menor de o igual a {venta.montoPendiente.toFixed(2)} -
                  <span className="font-medium"> Excedente: S/ {(monto - venta.montoPendiente).toFixed(2)}</span>
                </span>
              </div>
            )}
          </div>

          {/* Método de pago */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Método de Pago
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {METODOS_PAGO.map((metodo) => (
                <button
                  key={metodo.value}
                  type="button"
                  onClick={() => setMetodoPago(metodo.value)}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                    metodoPago === metodo.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-200'
                      : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {metodo.icon}
                  <span className="text-sm font-medium">{metodo.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cuenta Destino */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Cuenta Destino
              </div>
            </label>
            {loadingCuentas ? (
              <div className="text-sm text-gray-500">Cargando cuentas...</div>
            ) : cuentas.length === 0 ? (
              <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                No hay cuentas configuradas. El pago se registrará sin asociar a una cuenta específica.
              </div>
            ) : (
              <select
                value={cuentaDestinoId}
                onChange={(e) => setCuentaDestinoId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm"
              >
                <option value="">Sin cuenta específica</option>
                {cuentas.map((cuenta) => {
                   // Para cuentas bi-moneda, mostrar saldoPEN; para mono-moneda, saldoActual
                   const saldoPEN = cuenta.esBiMoneda ? (cuenta.saldoPEN || 0) : cuenta.saldoActual;
                   return (
                     <option key={cuenta.id} value={cuenta.id}>
                       {cuenta.nombre} {cuenta.banco ? `(${cuenta.banco})` : ''} - Saldo: S/ {saldoPEN.toFixed(2)}
                     </option>
                   );
                 })}
              </select>
            )}
            {cuentaSeleccionada && (
              <div className="text-xs text-gray-500">
                El monto se sumará al saldo de "{cuentaSeleccionada.nombre}"
              </div>
            )}
          </div>

          {/* Referencia (opcional) */}
          <Input
            label="Referencia / N° Operación"
            type="text"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Ej: N° de transferencia, voucher, etc."
            helperText="Opcional - Para identificar el pago"
          />

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas adicionales
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm"
              placeholder="Observaciones del pago (opcional)"
            />
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="success"
              disabled={loading || monto <= 0}
            >
              {loading ? 'Registrando...' : `Registrar Cobro S/ ${monto.toFixed(2)}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
