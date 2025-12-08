import React, { useState } from 'react';
import { Button, Input, Select } from '../../common';
import type { EmpresaFormData } from '../../../types/configuracion.types';

interface EmpresaFormProps {
  initialData?: Partial<EmpresaFormData>;
  onSubmit: (data: EmpresaFormData) => void;
  onCancel?: () => void;
  loading?: boolean;
}

export const EmpresaForm: React.FC<EmpresaFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState<EmpresaFormData>({
    razonSocial: initialData?.razonSocial || '',
    nombreComercial: initialData?.nombreComercial || '',
    ruc: initialData?.ruc || '',
    direccion: initialData?.direccion || '',
    telefono: initialData?.telefono || '',
    email: initialData?.email || '',
    sitioWeb: initialData?.sitioWeb || '',
    monedaPrincipal: initialData?.monedaPrincipal || 'PEN'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Razón Social"
          name="razonSocial"
          value={formData.razonSocial}
          onChange={handleChange}
          required
        />
        
        <Input
          label="Nombre Comercial"
          name="nombreComercial"
          value={formData.nombreComercial}
          onChange={handleChange}
          required
        />
        
        <Input
          label="RUC"
          name="ruc"
          value={formData.ruc}
          onChange={handleChange}
          required
          maxLength={11}
        />
        
        <Select
          label="Moneda Principal"
          name="monedaPrincipal"
          value={formData.monedaPrincipal}
          onChange={handleChange}
          options={[
            { value: 'PEN', label: 'Soles (PEN)' },
            { value: 'USD', label: 'Dólares (USD)' }
          ]}
          required
        />
      </div>

      <Input
        label="Dirección"
        name="direccion"
        value={formData.direccion}
        onChange={handleChange}
        required
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label="Teléfono"
          name="telefono"
          value={formData.telefono}
          onChange={handleChange}
        />
        
        <Input
          label="Email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
        />
        
        <Input
          label="Sitio Web"
          name="sitioWeb"
          value={formData.sitioWeb}
          onChange={handleChange}
          placeholder="https://..."
        />
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
          Guardar Información
        </Button>
      </div>
    </form>
  );
};