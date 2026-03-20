import React, { useState, useEffect } from 'react';
import { Button, Input, Select } from '../../common';
import { almacenService } from '../../../services/almacen.service';

// Tipos locales para este formulario
interface RecepcionFormData {
  productoId: string;
  cantidad: number;
  lote?: string;
  fechaVencimiento?: Date;
  costoUnitarioUSD: number;
  tcCompra: number;
  tcPago: number;
  almacenDestinoId: string;
  observaciones?: string;
  numeroTracking?: string;
  courier?: string;
}

interface RecepcionFormProps {
  productoId: string;
  sku: string;
  onSubmit: (data: RecepcionFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

// NOTE: Almacen options should be passed as props or fetched from almacen.service
// Fallback options for backward compatibility
const almacenOptionsFallback = [
  { value: 'peru_principal', label: 'Perú Principal' },
  { value: 'peru_secundario', label: 'Perú Secundario' }
];

export const RecepcionForm: React.FC<RecepcionFormProps> = ({
  productoId,
  sku,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [almacenOptions, setAlmacenOptions] = useState(almacenOptionsFallback);

  // Load almacenes dynamically
  useEffect(() => {
    const loadAlmacenes = async () => {
      try {
        const almacenes = await almacenService.getAll();
        const options = almacenes
          .filter(a => a.estadoAlmacen !== 'inactivo')
          .map(a => ({ value: a.id, label: `${a.nombre} (${a.pais})` }));
        if (options.length > 0) {
          setAlmacenOptions(options);
          setFormData(prev => ({ ...prev, almacenDestinoId: prev.almacenDestinoId || options[0].value }));
        }
      } catch (error) {
        console.error('Error loading almacenes:', error);
      }
    };
    loadAlmacenes();
  }, []);

  const [formData, setFormData] = useState<RecepcionFormData>({
    productoId,
    cantidad: 1,
    lote: '',
    costoUnitarioUSD: 0,
    tcCompra: 0,
    tcPago: 0,
    almacenDestinoId: '',
    observaciones: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 :
              type === 'date' ? new Date(value) :
              value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const costoPEN = formData.costoUnitarioUSD * formData.tcPago;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Información del Producto */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="text-sm text-gray-600">Producto</div>
        <div className="text-lg font-semibold text-gray-900">{sku}</div>
      </div>

      {/* Recepción */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Recepción de Unidades</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Cantidad de Unidades"
            name="cantidad"
            type="number"
            min="1"
            value={formData.cantidad}
            onChange={handleChange}
            required
            helperText="Número de unidades a recibir"
          />

          <Select
            label="Almacén Destino"
            name="almacenDestinoId"
            value={formData.almacenDestinoId}
            onChange={handleChange}
            options={almacenOptions}
            required
          />

          <Input
            label="Lote"
            name="lote"
            value={formData.lote || ''}
            onChange={handleChange}
            required
            placeholder="ej: LOT-2024-001"
          />

          <Input
            label="Fecha de Vencimiento"
            name="fechaVencimiento"
            type="date"
            onChange={handleChange}
            helperText="Opcional"
          />
        </div>
      </div>

      {/* Costos */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Costos y Tipo de Cambio</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Costo Unitario (USD)"
            name="costoUnitarioUSD"
            type="number"
            step="0.01"
            value={formData.costoUnitarioUSD}
            onChange={handleChange}
            required
          />

          <Input
            label="TC Compra"
            name="tcCompra"
            type="number"
            step="0.001"
            value={formData.tcCompra}
            onChange={handleChange}
            required
            helperText="TC al momento de la compra"
          />

          <Input
            label="TC Pago"
            name="tcPago"
            type="number"
            step="0.001"
            value={formData.tcPago}
            onChange={handleChange}
            required
            helperText="TC al momento del pago"
          />
        </div>

        {formData.costoUnitarioUSD > 0 && formData.tcPago > 0 && (
          <div className="mt-4 p-4 bg-primary-50 rounded-lg">
            <div className="text-sm text-gray-600">Costo Total por Unidad (PEN)</div>
            <div className="text-2xl font-bold text-primary-600">
              S/ {costoPEN.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Total {formData.cantidad} unidades: S/ {(costoPEN * formData.cantidad).toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Tracking */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Tracking (Opcional)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Número de Tracking"
            name="numeroTracking"
            value={formData.numeroTracking || ''}
            onChange={handleChange}
            placeholder="ej: 1Z999AA10123456784"
          />

          <Input
            label="Courier"
            name="courier"
            value={formData.courier || ''}
            onChange={handleChange}
            placeholder="ej: FedEx, UPS, USPS"
          />
        </div>
      </div>

      {/* Observaciones */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Observaciones
        </label>
        <textarea
          name="observaciones"
          value={formData.observaciones}
          onChange={handleChange}
          rows={3}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Notas adicionales sobre la recepción..."
        />
      </div>

      {/* Botones */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-6 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          className="w-full sm:w-auto"
        >
          Recibir {formData.cantidad} {formData.cantidad === 1 ? 'Unidad' : 'Unidades'}
        </Button>
      </div>
    </form>
  );
};
