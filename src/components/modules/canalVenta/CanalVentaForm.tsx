import React, { useState, useEffect } from 'react';
import { Tag, Percent, Clock, Truck, Palette } from 'lucide-react';
import { Button, Input } from '../../common';
import type { CanalVenta, CanalVentaFormData } from '../../../types/canalVenta.types';

interface CanalVentaFormProps {
  canal?: CanalVenta;
  onSubmit: (data: CanalVentaFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

// Opciones de iconos disponibles
const iconOptions = [
  { value: 'Store', label: 'Tienda' },
  { value: 'ShoppingBag', label: 'Bolsa de compras' },
  { value: 'MessageCircle', label: 'Mensaje (WhatsApp)' },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'Globe', label: 'Web' },
  { value: 'Phone', label: 'Teléfono' },
  { value: 'Mail', label: 'Email' },
  { value: 'Users', label: 'Referidos' },
  { value: 'Tag', label: 'Etiqueta' },
  { value: 'MoreHorizontal', label: 'Otro' }
];

// Colores predefinidos
const colorOptions = [
  { value: '#22c55e', label: 'Verde' },
  { value: '#ffe600', label: 'Amarillo (ML)' },
  { value: '#25d366', label: 'Verde WhatsApp' },
  { value: '#e1306c', label: 'Rosa Instagram' },
  { value: '#1877f2', label: 'Azul Facebook' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#8b5cf6', label: 'Púrpura' },
  { value: '#f97316', label: 'Naranja' },
  { value: '#ef4444', label: 'Rojo' },
  { value: '#6b7280', label: 'Gris' }
];

export const CanalVentaForm: React.FC<CanalVentaFormProps> = ({
  canal,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState<CanalVentaFormData>({
    nombre: '',
    descripcion: '',
    comisionPorcentaje: 0,
    requiereEnvio: true,
    tiempoProcesamientoDias: undefined,
    color: '#6b7280',
    icono: 'Tag',
    estado: 'activo'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (canal) {
      setFormData({
        codigo: canal.codigo,
        nombre: canal.nombre,
        descripcion: canal.descripcion || '',
        comisionPorcentaje: canal.comisionPorcentaje || 0,
        requiereEnvio: canal.requiereEnvio ?? true,
        tiempoProcesamientoDias: canal.tiempoProcesamientoDias,
        color: canal.color || '#6b7280',
        icono: canal.icono || 'Tag',
        estado: canal.estado
      });
    }
  }, [canal]);

  const handleChange = (field: keyof CanalVentaFormData, value: string | number | boolean | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpiar error del campo
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (formData.comisionPorcentaje !== undefined && formData.comisionPorcentaje < 0) {
      newErrors.comisionPorcentaje = 'La comisión no puede ser negativa';
    }

    if (formData.comisionPorcentaje !== undefined && formData.comisionPorcentaje > 100) {
      newErrors.comisionPorcentaje = 'La comisión no puede ser mayor a 100%';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    await onSubmit(formData);
  };

  const isEditing = !!canal;
  const esSistema = canal?.esSistema || false;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Información Básica */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary-600" />
          Información del Canal
        </h3>

        {/* Nombre */}
        <Input
          label="Nombre del Canal *"
          value={formData.nombre}
          onChange={(e) => handleChange('nombre', e.target.value)}
          placeholder="Ej: TikTok Shop, Referidos, etc."
          error={errors.nombre}
          disabled={loading || esSistema}
        />

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <textarea
            value={formData.descripcion}
            onChange={(e) => handleChange('descripcion', e.target.value)}
            placeholder="Descripción opcional del canal de venta"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={loading}
          />
        </div>
      </div>

      {/* Configuración Comercial */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          <Percent className="h-5 w-5 text-primary-600" />
          Configuración Comercial
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {/* Comisión */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comisión (%)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.comisionPorcentaje || ''}
                onChange={(e) => handleChange('comisionPorcentaje', e.target.value ? parseFloat(e.target.value) : 0)}
                placeholder="0"
                className={`w-full px-3 py-2 pr-8 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.comisionPorcentaje ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={loading}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
            </div>
            {errors.comisionPorcentaje && (
              <p className="text-sm text-red-600 mt-1">{errors.comisionPorcentaje}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Ej: Mercado Libre cobra ~13%
            </p>
          </div>

          {/* Tiempo de procesamiento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tiempo procesamiento (días)
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="number"
                min="0"
                max="30"
                value={formData.tiempoProcesamientoDias || ''}
                onChange={(e) => handleChange('tiempoProcesamientoDias', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="0"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Días adicionales para procesar pedidos
            </p>
          </div>
        </div>

        {/* Requiere envío */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="requiereEnvio"
            checked={formData.requiereEnvio}
            onChange={(e) => handleChange('requiereEnvio', e.target.checked)}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            disabled={loading}
          />
          <label htmlFor="requiereEnvio" className="flex items-center gap-2 text-sm text-gray-700">
            <Truck className="h-4 w-4 text-gray-400" />
            Este canal típicamente requiere envío
          </label>
        </div>
      </div>

      {/* Visualización */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary-600" />
          Visualización
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => handleChange('color', color.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    formData.color === color.value
                      ? 'border-gray-800 scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                  disabled={loading}
                />
              ))}
            </div>
          </div>

          {/* Icono */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Icono
            </label>
            <select
              value={formData.icono}
              onChange={(e) => handleChange('icono', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={loading}
            >
              {iconOptions.map((icon) => (
                <option key={icon.value} value={icon.value}>
                  {icon.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Preview del badge */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vista previa
          </label>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                backgroundColor: `${formData.color}20`,
                color: formData.color
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: formData.color }}
              />
              {formData.nombre || 'Nombre del canal'}
            </span>
          </div>
        </div>
      </div>

      {/* Estado */}
      {isEditing && !esSistema && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Estado
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="estado"
                value="activo"
                checked={formData.estado === 'activo'}
                onChange={() => handleChange('estado', 'activo')}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                disabled={loading}
              />
              <span className="text-sm text-gray-700">Activo</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="estado"
                value="inactivo"
                checked={formData.estado === 'inactivo'}
                onChange={() => handleChange('estado', 'inactivo')}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                disabled={loading}
              />
              <span className="text-sm text-gray-700">Inactivo</span>
            </label>
          </div>
        </div>
      )}

      {/* Advertencia canal del sistema */}
      {esSistema && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800">
            Este es un canal del sistema. Solo puedes modificar la comisión, tiempo de procesamiento y visualización.
          </p>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t">
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
          disabled={loading}
        >
          {loading ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Canal'}
        </Button>
      </div>
    </form>
  );
};
