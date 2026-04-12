import React, { useState, useEffect } from 'react';
import { User, Truck, Phone, Mail, DollarSign, Percent, FileText } from 'lucide-react';
import { Button, Input } from '../../common';
import type {
  Transportista,
  TransportistaFormData,
  TipoTransportista,
  CourierExterno
} from '../../../types/transportista.types';

interface TransportistaFormProps {
  transportista?: Transportista;
  onSubmit: (data: TransportistaFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const courierOptions: Array<{ value: CourierExterno; label: string }> = [
  { value: 'olva', label: 'Olva Courier' },
  { value: 'mercado_envios', label: 'Mercado Envíos' },
  { value: 'urbano', label: 'Urbano Express' },
  { value: 'shalom', label: 'Shalom' },
  { value: 'otro', label: 'Otro' }
];

export const TransportistaForm: React.FC<TransportistaFormProps> = ({
  transportista,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState<TransportistaFormData>({
    nombre: '',
    tipo: 'interno',
    telefono: '',
    email: '',
    comisionPorcentaje: undefined,
    costoFijo: undefined,
    dni: '',
    licencia: '',
    observaciones: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (transportista) {
      setFormData({
        codigo: transportista.codigo,
        nombre: transportista.nombre,
        tipo: transportista.tipo,
        courierExterno: transportista.courierExterno,
        telefono: transportista.telefono || '',
        email: transportista.email || '',
        comisionPorcentaje: transportista.comisionPorcentaje,
        costoFijo: transportista.costoFijo,
        dni: transportista.dni || '',
        licencia: transportista.licencia || '',
        observaciones: transportista.observaciones || ''
      });
    }
  }, [transportista]);

  const handleChange = (field: keyof TransportistaFormData, value: string | number | undefined) => {
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

    if (formData.tipo === 'externo' && !formData.courierExterno) {
      newErrors.courierExterno = 'Selecciona un courier';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tipo de Transportista */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Tipo de Transportista *
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleChange('tipo', 'interno')}
            className={`p-4 border-2 rounded-lg flex flex-col items-center transition-all ${
              formData.tipo === 'interno'
                ? 'border-teal-500 bg-teal-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <User className={`h-8 w-8 mb-2 ${
              formData.tipo === 'interno' ? 'text-teal-600' : 'text-slate-400'
            }`} />
            <span className={`font-medium ${
              formData.tipo === 'interno' ? 'text-teal-700' : 'text-slate-600'
            }`}>
              Interno (Socio)
            </span>
            <span className="text-xs text-slate-500 mt-1">
              Repartidor propio en Lima
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleChange('tipo', 'externo')}
            className={`p-4 border-2 rounded-lg flex flex-col items-center transition-all ${
              formData.tipo === 'externo'
                ? 'border-teal-500 bg-teal-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <Truck className={`h-8 w-8 mb-2 ${
              formData.tipo === 'externo' ? 'text-teal-600' : 'text-slate-400'
            }`} />
            <span className={`font-medium ${
              formData.tipo === 'externo' ? 'text-teal-700' : 'text-slate-600'
            }`}>
              Externo (Courier)
            </span>
            <span className="text-xs text-slate-500 mt-1">
              Olva, Mercado Envíos, etc.
            </span>
          </button>
        </div>
      </div>

      {/* Courier Externo */}
      {formData.tipo === 'externo' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Courier *
          </label>
          <select
            value={formData.courierExterno || ''}
            onChange={(e) => handleChange('courierExterno', e.target.value as CourierExterno)}
            className={`block w-full rounded-lg border ${
              errors.courierExterno ? 'border-red-300' : 'border-slate-300'
            } px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500`}
          >
            <option value="">Seleccionar courier...</option>
            {courierOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.courierExterno && (
            <p className="mt-1 text-sm text-red-600">{errors.courierExterno}</p>
          )}
        </div>
      )}

      {/* Nombre */}
      <Input
        label="Nombre"
        value={formData.nombre}
        onChange={(e) => handleChange('nombre', e.target.value)}
        placeholder={formData.tipo === 'interno' ? 'Ej: Carlos Mendoza' : 'Ej: Olva Courier'}
        required
        error={errors.nombre}
        icon={<User className="h-5 w-5 text-slate-400" />}
      />

      {/* Contacto */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Teléfono"
          type="tel"
          value={formData.telefono || ''}
          onChange={(e) => handleChange('telefono', e.target.value)}
          placeholder="+51 999 123 456"
          icon={<Phone className="h-5 w-5 text-slate-400" />}
        />

        <Input
          label="Email"
          type="email"
          value={formData.email || ''}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="email@ejemplo.com"
          icon={<Mail className="h-5 w-5 text-slate-400" />}
        />
      </div>

      {/* Costos */}
      <div className="bg-slate-50 p-4 rounded-lg">
        <h4 className="font-medium text-slate-900 mb-3 flex items-center">
          <DollarSign className="h-5 w-5 mr-2 text-emerald-600" />
          Costos y Comisiones
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Comisión %"
            type="number"
            value={formData.comisionPorcentaje ?? ''}
            onChange={(e) => handleChange('comisionPorcentaje', e.target.value ? parseFloat(e.target.value) : undefined)}
            placeholder="5"
            min={0}
            max={100}
            step={0.5}
            helperText="Porcentaje sobre el valor de la venta"
            icon={<Percent className="h-5 w-5 text-slate-400" />}
          />

          <Input
            label="Costo Fijo (PEN)"
            type="number"
            value={formData.costoFijo ?? ''}
            onChange={(e) => handleChange('costoFijo', e.target.value ? parseFloat(e.target.value) : undefined)}
            placeholder="10.00"
            min={0}
            step={0.50}
            helperText="Costo fijo por entrega"
            icon={<DollarSign className="h-5 w-5 text-slate-400" />}
          />
        </div>
      </div>

      {/* Documentos (solo para internos) */}
      {formData.tipo === 'interno' && (
        <div className="bg-sky-50 p-4 rounded-lg">
          <h4 className="font-medium text-slate-900 mb-3 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-sky-600" />
            Documentos
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="DNI"
              value={formData.dni || ''}
              onChange={(e) => handleChange('dni', e.target.value)}
              placeholder="12345678"
              maxLength={8}
            />

            <Input
              label="Licencia de Conducir"
              value={formData.licencia || ''}
              onChange={(e) => handleChange('licencia', e.target.value)}
              placeholder="Q12345678"
            />
          </div>
        </div>
      )}

      {/* Observaciones */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Observaciones
        </label>
        <textarea
          value={formData.observaciones || ''}
          onChange={(e) => handleChange('observaciones', e.target.value)}
          rows={3}
          className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
          placeholder="Notas adicionales sobre el transportista..."
        />
      </div>

      {/* Botones */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          {transportista ? 'Actualizar' : 'Crear'} Transportista
        </Button>
      </div>
    </form>
  );
};
