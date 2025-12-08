import React, { useState } from 'react';
import { Button, Input, Select } from '../../common';
import type { TipoCambioFormData, FuenteTC } from '../../../types/tipoCambio.types';

interface TipoCambioFormProps {
  onSubmit: (data: TipoCambioFormData) => void;
  onCancel: () => void;
  loading?: boolean;
  initialData?: Partial<TipoCambioFormData>;
}

const fuenteOptions: Array<{ value: FuenteTC; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'api_sunat', label: 'SUNAT' },
  { value: 'api_sbs', label: 'SBS' },
  { value: 'api_net', label: 'APIs.net.pe' },
  { value: 'promedio', label: 'Promedio' }
];

export const TipoCambioForm: React.FC<TipoCambioFormProps> = ({
  onSubmit,
  onCancel,
  loading = false,
  initialData
}) => {
  const [formData, setFormData] = useState<TipoCambioFormData>({
    fecha: initialData?.fecha || new Date(),
    compra: initialData?.compra || 0,
    venta: initialData?.venta || 0,
    fuente: initialData?.fuente || 'manual',
    observaciones: initialData?.observaciones || ''
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

  const promedio = formData.compra > 0 && formData.venta > 0 
    ? (formData.compra + formData.venta) / 2 
    : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Fecha */}
      <div>
        <Input
          label="Fecha"
          name="fecha"
          type="date"
          value={formData.fecha instanceof Date ? formData.fecha.toISOString().split('T')[0] : ''}
          onChange={handleChange}
          required
        />
      </div>

      {/* Tipos de Cambio */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Tipo de Cambio</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Compra"
            name="compra"
            type="number"
            step="0.001"
            value={formData.compra}
            onChange={handleChange}
            required
            helperText="TC para vender dólares"
          />
          
          <Input
            label="Venta"
            name="venta"
            type="number"
            step="0.001"
            value={formData.venta}
            onChange={handleChange}
            required
            helperText="TC para comprar dólares"
          />
        </div>
        
        {promedio > 0 && (
          <div className="mt-4 p-4 bg-primary-50 rounded-lg">
            <div className="text-sm text-gray-600">Promedio</div>
            <div className="text-2xl font-bold text-primary-600">
              {promedio.toFixed(3)}
            </div>
          </div>
        )}
      </div>

      {/* Fuente */}
      <div>
        <Select
          label="Fuente"
          name="fuente"
          value={formData.fuente}
          onChange={handleChange}
          options={fuenteOptions}
          required
        />
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
          placeholder="Notas adicionales..."
        />
      </div>

      {/* Botones */}
      <div className="flex items-center justify-end space-x-3 pt-6 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={loading}
        >
          {initialData ? 'Actualizar' : 'Registrar'} TC
        </Button>
      </div>
    </form>
  );
};