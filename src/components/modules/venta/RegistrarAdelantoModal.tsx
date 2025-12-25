import React, { useState, useMemo } from 'react';
import { Lock, Clock, AlertTriangle, Package, CheckCircle } from 'lucide-react';
import { Modal, Input, Select, Button } from '../../common';
import type { Venta, MetodoPago } from '../../../types/venta.types';

interface RegistrarAdelantoModalProps {
  venta: Venta;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    monto: number;
    metodoPago: MetodoPago;
    referencia?: string;
    horasVigencia: number;
  }) => Promise<void>;
}

const METODOS_PAGO: { value: MetodoPago; label: string }[] = [
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
];

const HORAS_VIGENCIA: { value: number; label: string }[] = [
  { value: 24, label: '24 horas' },
  { value: 48, label: '48 horas (recomendado)' },
  { value: 72, label: '72 horas' },
  { value: 168, label: '1 semana' },
];

export const RegistrarAdelantoModal: React.FC<RegistrarAdelantoModalProps> = ({
  venta,
  isOpen,
  onClose,
  onConfirm
}) => {
  const [montoAdelanto, setMontoAdelanto] = useState(0);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('yape');
  const [referencia, setReferencia] = useState('');
  const [horasVigencia, setHorasVigencia] = useState(48);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calcular información de stock
  const infoStock = useMemo(() => {
    const productosConStock: Array<{ nombre: string; disponible: number; solicitado: number }> = [];
    const productosSinStock: Array<{ nombre: string; disponible: number; solicitado: number }> = [];

    // Si la venta ya tiene info de productos con faltante
    if (venta.productosConFaltante) {
      venta.productosConFaltante.forEach(p => {
        if (p.disponibles >= p.solicitados) {
          productosConStock.push({
            nombre: p.nombre,
            disponible: p.disponibles,
            solicitado: p.solicitados
          });
        } else {
          productosSinStock.push({
            nombre: p.nombre,
            disponible: p.disponibles,
            solicitado: p.solicitados
          });
        }
      });
    }

    // Agregar productos que no están en faltante (tienen stock completo)
    venta.productos.forEach(p => {
      const enFaltante = venta.productosConFaltante?.some(
        f => f.nombre.includes(p.nombreComercial) || f.nombre.includes(p.marca)
      );
      if (!enFaltante) {
        productosConStock.push({
          nombre: `${p.marca} ${p.nombreComercial}`,
          disponible: p.cantidad, // Asumimos que tiene stock si no está en faltante
          solicitado: p.cantidad
        });
      }
    });

    const tipoReserva = productosSinStock.length > 0 ? 'virtual' : 'fisica';

    return { productosConStock, productosSinStock, tipoReserva };
  }, [venta]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (montoAdelanto <= 0) {
      alert('El monto del adelanto debe ser mayor a 0');
      return;
    }

    if (montoAdelanto > venta.totalPEN) {
      alert('El adelanto no puede ser mayor al total de la cotización');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        monto: montoAdelanto,
        metodoPago,
        referencia: referencia.trim() || undefined,
        horasVigencia
      });
      onClose();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const saldoPendiente = venta.totalPEN - montoAdelanto;
  const porcentajeAdelanto = montoAdelanto > 0 ? (montoAdelanto / venta.totalPEN) * 100 : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Adelanto y Reservar Stock"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información de la cotización */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-gray-900">{venta.numeroVenta}</h3>
              <p className="text-sm text-gray-600">{venta.nombreCliente}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary-600">
                {formatCurrency(venta.totalPEN)}
              </p>
              <p className="text-xs text-gray-500">Total cotización</p>
            </div>
          </div>
        </div>

        {/* Tipo de reserva que se creará */}
        <div className={`p-4 rounded-lg border-2 ${
          infoStock.tipoReserva === 'fisica'
            ? 'bg-green-50 border-green-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-start gap-3">
            {infoStock.tipoReserva === 'fisica' ? (
              <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h4 className={`font-medium ${
                infoStock.tipoReserva === 'fisica' ? 'text-green-800' : 'text-amber-800'
              }`}>
                {infoStock.tipoReserva === 'fisica'
                  ? 'Reserva Física'
                  : 'Reserva Virtual (Parcial)'}
              </h4>
              <p className={`text-sm mt-1 ${
                infoStock.tipoReserva === 'fisica' ? 'text-green-700' : 'text-amber-700'
              }`}>
                {infoStock.tipoReserva === 'fisica'
                  ? 'Hay stock suficiente. Las unidades se bloquearán físicamente.'
                  : 'No hay stock completo. Se creará una reserva virtual y serás notificado cuando llegue stock.'}
              </p>

              {/* Detalle de productos */}
              {infoStock.productosSinStock.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-medium text-amber-800">Productos sin stock suficiente:</p>
                  {infoStock.productosSinStock.map((p, i) => (
                    <div key={i} className="text-xs text-amber-700 flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {p.nombre}: {p.disponible}/{p.solicitado} disponibles
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Formulario de adelanto */}
        <div className="space-y-4">
          <div>
            <Input
              label="Monto del Adelanto (S/)"
              type="number"
              step="0.01"
              min="0"
              max={venta.totalPEN}
              value={montoAdelanto || ''}
              onChange={(e) => setMontoAdelanto(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
            {/* Botones rápidos de porcentaje */}
            <div className="flex gap-2 mt-2">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setMontoAdelanto(Math.round((venta.totalPEN * pct / 100) * 100) / 100)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    Math.abs(porcentajeAdelanto - pct) < 1
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Método de Pago"
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
              options={METODOS_PAGO}
            />

            <Select
              label="Vigencia de Reserva"
              value={horasVigencia.toString()}
              onChange={(e) => setHorasVigencia(parseInt(e.target.value))}
              options={HORAS_VIGENCIA.map(h => ({ value: h.value.toString(), label: h.label }))}
            />
          </div>

          <Input
            label="Referencia / N° Operación (opcional)"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Ej: OP-123456"
          />
        </div>

        {/* Resumen */}
        {montoAdelanto > 0 && (
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-purple-800">Resumen de la Reserva</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Adelanto:</p>
                <p className="font-bold text-green-600">{formatCurrency(montoAdelanto)}</p>
              </div>
              <div>
                <p className="text-gray-600">Saldo pendiente:</p>
                <p className="font-bold text-purple-600">{formatCurrency(saldoPendiente)}</p>
              </div>
              <div>
                <p className="text-gray-600">Porcentaje:</p>
                <p className="font-medium">{porcentajeAdelanto.toFixed(0)}% adelantado</p>
              </div>
              <div>
                <p className="text-gray-600">Vigencia:</p>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {horasVigencia} horas
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || montoAdelanto <= 0}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Lock className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Procesando...' : 'Registrar Adelanto y Reservar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
