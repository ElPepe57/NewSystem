import React, { useState, useMemo, useEffect } from "react";
import { useToastStore } from "../../store/toastStore";
import {
  AlertTriangle,
  DollarSign,
  Banknote,
} from "lucide-react";
import { Modal, Button, useConfirmDialog, ConfirmDialog } from "../../components/common";
import type { Transferencia } from "../../types/transferencia.types";
import type { CuentaCaja, MetodoTesoreria } from "../../types/tesoreria.types";

interface PagoViajeroModalProps {
  transferencia: Transferencia;
  tipoCambioActual: { tasaVenta: number } | null;
  cuentasTesoreria: CuentaCaja[];
  onClose: () => void;
  onConfirm: (datos: {
    fechaPago: Date;
    monedaPago: 'USD' | 'PEN';
    montoOriginal: number;
    tipoCambio: number;
    metodoPago: MetodoTesoreria;
    cuentaOrigenId?: string;
    referencia?: string;
    notas?: string;
  }) => Promise<void>;
}

export const PagoViajeroModal: React.FC<PagoViajeroModalProps> = ({
  transferencia,
  tipoCambioActual,
  cuentasTesoreria,
  onClose,
  onConfirm,
}) => {
  const toast = useToastStore();
  const fleteUSD = transferencia.costoFleteTotal || 0;
  const monedaFleteOriginal = transferencia.monedaFlete || 'USD';
  const tieneFleteDefinido = fleteUSD > 0;

  const pagosAnteriores = transferencia.pagosViajero && transferencia.pagosViajero.length > 0
    ? transferencia.pagosViajero
    : (transferencia.pagoViajero ? [transferencia.pagoViajero] : []);
  const montoPagadoUSD = pagosAnteriores.reduce((sum, p) => sum + p.montoUSD, 0);
  const montoPendienteUSD = fleteUSD - montoPagadoUSD;
  const tienePagosAnteriores = pagosAnteriores.length > 0;

  const [formData, setFormData] = useState({
    fechaPago: new Date().toISOString().split('T')[0],
    monedaPago: monedaFleteOriginal as 'USD' | 'PEN',
    montoOriginal: montoPendienteUSD > 0 ? montoPendienteUSD : fleteUSD,
    tipoCambio: tipoCambioActual?.tasaVenta || 3.75,
    metodoPago: 'transferencia_bancaria' as MetodoTesoreria,
    cuentaOrigenId: '',
    referencia: '',
    notas: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const { dialogProps: pagoDialogProps, confirm: confirmPago } = useConfirmDialog();

  const montoUSD = formData.monedaPago === 'USD'
    ? formData.montoOriginal
    : formData.montoOriginal / formData.tipoCambio;
  const montoPEN = formData.monedaPago === 'PEN'
    ? formData.montoOriginal
    : formData.montoOriginal * formData.tipoCambio;

  const cuentasFiltradas = useMemo(() => {
    return cuentasTesoreria.filter(c => c.activa && (c.esBiMoneda || c.moneda === formData.monedaPago));
  }, [cuentasTesoreria, formData.monedaPago]);

  useEffect(() => {
    const cuentaPorDefecto = cuentasFiltradas.find(c => c.esCuentaPorDefecto);
    if (cuentaPorDefecto) {
      setFormData(prev => ({ ...prev, cuentaOrigenId: cuentaPorDefecto.id }));
    } else if (cuentasFiltradas.length > 0) {
      setFormData(prev => ({ ...prev, cuentaOrigenId: cuentasFiltradas[0].id }));
    } else {
      setFormData(prev => ({ ...prev, cuentaOrigenId: '' }));
    }
  }, [cuentasFiltradas]);

  const montoBaseUSD = montoPendienteUSD > 0 ? montoPendienteUSD : fleteUSD;
  const handleMonedaChange = (nuevaMoneda: 'USD' | 'PEN') => {
    const nuevoMonto = nuevaMoneda === 'USD' ? montoBaseUSD : montoBaseUSD * formData.tipoCambio;
    setFormData(prev => ({ ...prev, monedaPago: nuevaMoneda, montoOriginal: nuevoMonto }));
  };

  const cuentaSeleccionada = cuentasTesoreria.find(c => c.id === formData.cuentaOrigenId);
  const saldoCuenta = cuentaSeleccionada
    ? (cuentaSeleccionada.esBiMoneda
        ? (formData.monedaPago === 'USD' ? (cuentaSeleccionada.saldoUSD || 0) : (cuentaSeleccionada.saldoPEN || 0))
        : cuentaSeleccionada.saldoActual)
    : 0;
  const saldoDespues = saldoCuenta - formData.montoOriginal;
  const saldoInsuficiente = cuentaSeleccionada && saldoDespues < 0;

  const montoReferenciaUSD = montoPendienteUSD > 0 ? montoPendienteUSD : fleteUSD;
  const montoDiferenteAlFlete = tieneFleteDefinido && Math.abs(montoUSD - montoReferenciaUSD) > 0.01;
  const montoPagaMasFlete = tieneFleteDefinido && montoUSD > montoReferenciaUSD + 0.01;

  const costoPorUnidad = transferencia.totalUnidades > 0
    ? fleteUSD / transferencia.totalUnidades
    : 0;

  const handleSubmit = async () => {
    if (formData.montoOriginal <= 0) {
      toast.warning('El monto debe ser mayor a 0');
      return;
    }
    if (formData.tipoCambio <= 0) {
      toast.warning('El tipo de cambio debe ser mayor a 0');
      return;
    }
    if (!formData.cuentaOrigenId) {
      toast.warning('Selecciona una cuenta de origen para el pago');
      return;
    }
    if (montoPagaMasFlete) {
      const confirmar = await confirmPago({
        title: 'Pago Mayor al Pendiente',
        message: (
          <div className="space-y-2">
            <p>Estas pagando mas del monto pendiente:</p>
            <div className="bg-amber-50 p-3 rounded-lg text-sm">
              <div className="flex justify-between"><span>Pendiente:</span><span>${montoReferenciaUSD.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Monto a pagar:</span><span>${montoUSD.toFixed(2)}</span></div>
              <div className="flex justify-between font-medium text-amber-700"><span>Diferencia:</span><span>+${(montoUSD - montoReferenciaUSD).toFixed(2)}</span></div>
            </div>
          </div>
        ),
        confirmText: 'Continuar',
        variant: 'warning'
      });
      if (!confirmar) return;
    }
    if (saldoInsuficiente) {
      const simbolo = formData.monedaPago === 'USD' ? '$' : 'S/';
      const confirmar = await confirmPago({
        title: 'Saldo Insuficiente',
        message: (
          <div className="space-y-2">
            <p>El saldo de la cuenta sera negativo despues del pago:</p>
            <div className="bg-red-50 p-3 rounded-lg text-sm">
              <div className="flex justify-between"><span>Saldo actual:</span><span>{simbolo} {saldoCuenta.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Monto a pagar:</span><span>{simbolo} {formData.montoOriginal.toFixed(2)}</span></div>
              <div className="flex justify-between font-medium text-red-700"><span>Saldo despues:</span><span>{simbolo} {saldoDespues.toFixed(2)}</span></div>
            </div>
          </div>
        ),
        confirmText: 'Continuar de Todas Formas',
        variant: 'danger'
      });
      if (!confirmar) return;
    }

    setSubmitting(true);
    try {
      await onConfirm({
        fechaPago: new Date(formData.fechaPago),
        monedaPago: formData.monedaPago,
        montoOriginal: formData.montoOriginal,
        tipoCambio: formData.tipoCambio,
        metodoPago: formData.metodoPago,
        cuentaOrigenId: formData.cuentaOrigenId || undefined,
        referencia: formData.referencia || undefined,
        notas: formData.notas || undefined
      });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast.error('Error: ' + message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Pago al Viajero - ${transferencia.numeroTransferencia}`}
      size="lg"
    >
      <div className="space-y-5">
        {/* Info de la transferencia */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-blue-600 uppercase tracking-wide">Viajero</div>
              <div className="text-lg font-bold text-blue-900">
                {transferencia.almacenOrigenNombre}
              </div>
              <div className="text-sm text-blue-600 mt-1">
                {transferencia.totalUnidades} unidades · {transferencia.productosSummary.length} productos
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-blue-600 uppercase tracking-wide">Flete Total</div>
              <div className="text-3xl font-bold text-blue-700">
                ${fleteUSD.toFixed(2)}
              </div>
              {montoPagadoUSD > 0 && (
                <div className="text-sm text-green-600 font-medium">
                  Pagado: ${montoPagadoUSD.toFixed(2)} | Pendiente: ${montoPendienteUSD.toFixed(2)}
                </div>
              )}
              <div className="text-sm text-blue-500">
                ≈ S/ {(fleteUSD * formData.tipoCambio).toFixed(2)} · ${costoPorUnidad.toFixed(2)}/ud
              </div>
            </div>
          </div>
        </div>

        {/* Pagos anteriores */}
        {tienePagosAnteriores && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-xs text-green-600 uppercase tracking-wide mb-2 font-semibold">
              Pagos Anteriores ({pagosAnteriores.length})
            </div>
            {pagosAnteriores.map((pago, idx) => (
              <div key={pago.id} className="flex justify-between items-center text-sm py-1.5 border-b border-green-100 last:border-0">
                <div>
                  <span className="font-medium text-gray-900">Pago {idx + 1}</span>
                  <span className="text-gray-500 ml-2">
                    {pago.fecha?.toDate?.() ? pago.fecha.toDate().toLocaleDateString('es-PE') : ''}
                  </span>
                  <span className="text-gray-400 ml-2 text-xs capitalize">
                    {pago.metodoPago?.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="font-semibold text-green-700">
                  ${pago.montoUSD.toFixed(2)} USD
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center text-sm font-bold pt-2 mt-1 border-t border-green-300">
              <span>Pendiente</span>
              <span className="text-amber-700">${montoPendienteUSD.toFixed(2)} USD</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (montoPagadoUSD / fleteUSD) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Advertencia si no hay flete definido */}
        {!tieneFleteDefinido && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <strong>Sin flete registrado:</strong> Esta transferencia no tiene costo de flete definido.
              Por favor ingresa el monto acordado con el viajero.
            </div>
          </div>
        )}

        {/* Formulario */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Pago *
              </label>
              <input
                type="date"
                value={formData.fechaPago}
                onChange={(e) => setFormData({ ...formData, fechaPago: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Moneda de Pago *
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleMonedaChange('USD')}
                  className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-semibold transition-all ${
                    formData.monedaPago === 'USD'
                      ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                      : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  $ USD
                </button>
                <button
                  type="button"
                  onClick={() => handleMonedaChange('PEN')}
                  className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-semibold transition-all ${
                    formData.monedaPago === 'PEN'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  S/ PEN
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Cambio *
              </label>
              <input
                type="number"
                value={formData.tipoCambio}
                onChange={(e) => {
                  const nuevoTC = parseFloat(e.target.value) || 0;
                  if (formData.monedaPago === 'PEN') {
                    setFormData({
                      ...formData,
                      tipoCambio: nuevoTC,
                      montoOriginal: fleteUSD * nuevoTC
                    });
                  } else {
                    setFormData({ ...formData, tipoCambio: nuevoTC });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                step="0.001"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto a Pagar ({formData.monedaPago}) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                  {formData.monedaPago === 'USD' ? '$' : 'S/'}
                </span>
                <input
                  type="number"
                  value={formData.montoOriginal}
                  onChange={(e) => setFormData({ ...formData, montoOriginal: parseFloat(e.target.value) || 0 })}
                  className={`w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    montoPagaMasFlete
                      ? 'border-amber-400 focus:ring-amber-500 bg-amber-50'
                      : 'border-gray-300 focus:ring-primary-500'
                  }`}
                  step="0.01"
                  min="0"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formData.monedaPago === 'USD'
                  ? `≈ S/ ${montoPEN.toFixed(2)}`
                  : `≈ $${montoUSD.toFixed(2)} USD`
                }
              </p>
            </div>
          </div>

          {montoDiferenteAlFlete && !montoPagaMasFlete && montoUSD > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-sm text-amber-700 flex items-center gap-2">
              <DollarSign className="h-4 w-4 flex-shrink-0" />
              <span>
                Pago parcial: quedara pendiente <strong>${(montoReferenciaUSD - montoUSD).toFixed(2)} USD</strong> de ${montoReferenciaUSD.toFixed(2)}
              </span>
            </div>
          )}
          {montoPagaMasFlete && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-2 text-sm text-amber-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <strong>Pagando mas del flete:</strong> ${(montoUSD - fleteUSD).toFixed(2)} adicionales
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Metodo de Pago *
              </label>
              <select
                value={formData.metodoPago}
                onChange={(e) => setFormData({ ...formData, metodoPago: e.target.value as MetodoTesoreria })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="transferencia_bancaria">Transferencia Bancaria</option>
                <option value="efectivo">Efectivo</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cuenta de Origen ({formData.monedaPago})
              </label>
              {cuentasFiltradas.length === 0 ? (
                <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">
                  No hay cuentas en {formData.monedaPago}
                </div>
              ) : (
                <select
                  value={formData.cuentaOrigenId}
                  onChange={(e) => setFormData({ ...formData, cuentaOrigenId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Sin cuenta especifica</option>
                  {cuentasFiltradas.map(cuenta => {
                    const saldo = cuenta.esBiMoneda
                      ? (formData.monedaPago === 'USD' ? (cuenta.saldoUSD || 0) : (cuenta.saldoPEN || 0))
                      : cuenta.saldoActual;
                    const simbolo = formData.monedaPago === 'USD' ? '$' : 'S/';
                    const etiqueta = cuenta.esBiMoneda ? ' [BI]' : '';
                    return (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.nombre}{etiqueta} - {simbolo} {saldo.toFixed(2)}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          </div>

          {cuentaSeleccionada && (
            <div className={`p-3 rounded-lg text-sm ${saldoInsuficiente ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 flex items-center gap-1">
                  {cuentaSeleccionada.nombre}
                  {cuentaSeleccionada.esBiMoneda && (
                    <span className="px-1.5 py-0.5 text-xs rounded bg-gradient-to-r from-green-100 to-blue-100 text-gray-600">
                      BI-MONEDA
                    </span>
                  )}
                </span>
                <span className="font-medium">
                  {formData.monedaPago === 'USD' ? '$' : 'S/'} {saldoCuenta.toFixed(2)}
                </span>
              </div>
              <div className={`flex justify-between mt-1 font-semibold ${saldoInsuficiente ? 'text-red-600' : 'text-primary-600'}`}>
                <span>Saldo despues:</span>
                <span>
                  {formData.monedaPago === 'USD' ? '$' : 'S/'} {saldoDespues.toFixed(2)}
                  {saldoInsuficiente && ' ⚠️'}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referencia / Nro. Operacion
              </label>
              <input
                type="text"
                value={formData.referencia}
                onChange={(e) => setFormData({ ...formData, referencia: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ej: OP-123456"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas
              </label>
              <input
                type="text"
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Observaciones..."
              />
            </div>
          </div>
        </div>

        {/* Resumen del Pago */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-green-600 uppercase tracking-wide">Total a Pagar</div>
              <div className="text-2xl font-bold text-green-700">
                {formData.monedaPago === 'USD' ? '$' : 'S/'} {formData.montoOriginal.toFixed(2)}
              </div>
              <div className="text-sm text-green-600">
                {formData.monedaPago === 'USD' ? `≈ S/ ${montoPEN.toFixed(2)}` : `≈ $${montoUSD.toFixed(2)} USD`}
              </div>
            </div>
            <div className="text-right text-sm text-green-700">
              <div>{new Date(formData.fechaPago).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              <div className="capitalize">{formData.metodoPago.replace('_', ' ')}</div>
              <div>TC: {formData.tipoCambio.toFixed(3)}</div>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end space-x-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || formData.montoOriginal <= 0 || formData.tipoCambio <= 0}
          >
            {submitting ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Procesando...
              </span>
            ) : (
              <span className="flex items-center">
                <Banknote className="h-4 w-4 mr-2" />
                Confirmar Pago
              </span>
            )}
          </Button>
        </div>

        <ConfirmDialog {...pagoDialogProps} />
      </div>
    </Modal>
  );
};
