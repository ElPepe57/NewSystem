import React, { useState } from 'react';
import { Button, Input } from '../../common';
import type { ConfiguracionFormData } from '../../../types/configuracion.types';

interface ConfiguracionFormProps {
  initialData?: Partial<ConfiguracionFormData>;
  onSubmit: (data: ConfiguracionFormData) => void;
  onCancel?: () => void;
  loading?: boolean;
}

export const ConfiguracionForm: React.FC<ConfiguracionFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState<ConfiguracionFormData>({
    skuAutomatico: initialData?.skuAutomatico ?? true,
    prefijoSKU: initialData?.prefijoSKU || 'BMN',
    stockMinimoDefault: initialData?.stockMinimoDefault || 10,
    alertaStockBajo: initialData?.alertaStockBajo ?? true,
    alertaVencimiento: initialData?.alertaVencimiento ?? true,
    diasAlertaVencimiento: initialData?.diasAlertaVencimiento || 30,
    descuentoMaximo: initialData?.descuentoMaximo || 20,
    permitirVentaSinStock: initialData?.permitirVentaSinStock ?? false,
    alertaVariacionTC: initialData?.alertaVariacionTC ?? true,
    porcentajeAlertaTC: initialData?.porcentajeAlertaTC || 3
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) : value)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Productos */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Productos</h3>
        <div className="space-y-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="skuAutomatico"
              checked={formData.skuAutomatico}
              onChange={handleChange}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="ml-2 text-sm text-gray-700">Generar SKU automáticamente</span>
          </label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Prefijo para SKU"
              name="prefijoSKU"
              value={formData.prefijoSKU}
              onChange={handleChange}
              disabled={!formData.skuAutomatico}
              maxLength={5}
            />
            
            <Input
              label="Stock Mínimo por Defecto"
              name="stockMinimoDefault"
              type="number"
              min="0"
              value={formData.stockMinimoDefault}
              onChange={handleChange}
            />
          </div>
          
          <label className="flex items-center">
            <input
              type="checkbox"
              name="alertaStockBajo"
              checked={formData.alertaStockBajo}
              onChange={handleChange}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="ml-2 text-sm text-gray-700">Alertas de stock bajo</span>
          </label>
        </div>
      </div>

      {/* Inventario */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventario</h3>
        <div className="space-y-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="alertaVencimiento"
              checked={formData.alertaVencimiento}
              onChange={handleChange}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="ml-2 text-sm text-gray-700">Alertas de vencimiento</span>
          </label>
          
          <Input
            label="Días de anticipación para alertas"
            name="diasAlertaVencimiento"
            type="number"
            min="1"
            value={formData.diasAlertaVencimiento}
            onChange={handleChange}
            disabled={!formData.alertaVencimiento}
            helperText="Alertar cuando falten estos días para vencer"
          />
        </div>
      </div>

      {/* Ventas */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ventas</h3>
        <div className="space-y-4">
          <Input
            label="Descuento Máximo Permitido (%)"
            name="descuentoMaximo"
            type="number"
            min="0"
            max="100"
            value={formData.descuentoMaximo}
            onChange={handleChange}
          />
          
          <label className="flex items-center">
            <input
              type="checkbox"
              name="permitirVentaSinStock"
              checked={formData.permitirVentaSinStock}
              onChange={handleChange}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="ml-2 text-sm text-gray-700">Permitir ventas sin stock disponible</span>
          </label>
        </div>
      </div>

      {/* Tipo de Cambio */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tipo de Cambio</h3>
        <div className="space-y-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="alertaVariacionTC"
              checked={formData.alertaVariacionTC}
              onChange={handleChange}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="ml-2 text-sm text-gray-700">Alertas de variación de TC</span>
          </label>
          
          <Input
            label="Porcentaje de variación para alertar (%)"
            name="porcentajeAlertaTC"
            type="number"
            min="0"
            step="0.1"
            value={formData.porcentajeAlertaTC}
            onChange={handleChange}
            disabled={!formData.alertaVariacionTC}
          />
        </div>
      </div>

      <div className="flex items-center justify-end space-x-3 pt-6 border-t">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          loading={loading}
        >
          Guardar Configuración
        </Button>
      </div>
    </form>
  );
};