import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Button, Input } from '../../common';
import type { TipoCambioFormData } from '../../../types/tipoCambio.types';

interface TipoCambioFormProps {
  onSubmit: (data: TipoCambioFormData) => void;
  onCancel: () => void;
  onObtenerSunat?: (fecha: Date) => void;
  loading?: boolean;
}

export const TipoCambioForm: React.FC<TipoCambioFormProps> = ({
  onSubmit,
  onCancel,
  onObtenerSunat,
  loading = false
}) => {
  const [formData, setFormData] = useState<TipoCambioFormData>({
    fecha: new Date(),
    compra: 0,
    venta: 0,
    fuente: 'manual'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'fecha') {
      setFormData(prev => ({ ...prev, [name]: new Date(value) }));
    } else if (name === 'compra' || name === 'venta') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleObtenerSunat = () => {
    if (onObtenerSunat) {
      onObtenerSunat(formData.fecha);
    }
  };

  const fechaString = formData.fecha.toISOString().split('T')[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <Input
          label="Fecha"
          name="fecha"
          type="date"
          value={fechaString}
          onChange={handleChange}
          required
        />

        {onObtenerSunat && (
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={handleObtenerSunat}
              disabled={loading}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Obtener TC de SUNAT
            </Button>
            <p className="text-xs text-gray-500 mt-1">
              Obtiene automáticamente el tipo de cambio oficial de SUNAT para la fecha seleccionada
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Tipo de Cambio Compra"
            name="compra"
            type="number"
            step="0.001"
            value={formData.compra}
            onChange={handleChange}
            required
            placeholder="ej: 3.750"
          />

          <Input
            label="Tipo de Cambio Venta"
            name="venta"
            type="number"
            step="0.001"
            value={formData.venta}
            onChange={handleChange}
            required
            placeholder="ej: 3.780"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fuente
          </label>
          <select
            name="fuente"
            value={formData.fuente}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="manual">Manual</option>
            <option value="sunat">SUNAT</option>
            <option value="bcrp">BCRP</option>
          </select>
        </div>
      </div>

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
          disabled={loading || formData.compra <= 0 || formData.venta <= 0}
        >
          {loading ? 'Guardando...' : 'Guardar Tipo de Cambio'}
        </Button>
      </div>
    </form>
  );
};
