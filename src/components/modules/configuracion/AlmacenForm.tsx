import React, { useState } from 'react';
import { Button, Input, Select } from '../../common';
import type { AlmacenFormData } from '../../../types/configuracion.types';

interface AlmacenFormProps {
  initialData?: Partial<AlmacenFormData>;
  onSubmit: (data: AlmacenFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const AlmacenForm: React.FC<AlmacenFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState<AlmacenFormData>({
    codigo: initialData?.codigo || '',
    nombre: initialData?.nombre || '',
    tipo: initialData?.tipo || 'miami',
    direccion: initialData?.direccion || '',
    responsable: initialData?.responsable || ''
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Código"
          name="codigo"
          value={formData.codigo}
          onChange={handleChange}
          required
          placeholder="ej: MIA01"
        />
        
        <Input
          label="Nombre"
          name="nombre"
          value={formData.nombre}
          onChange={handleChange}
          required
          placeholder="ej: Miami Warehouse 1"
        />
      </div>

      <Select
        label="Tipo"
        name="tipo"
        value={formData.tipo}
        onChange={handleChange}
        options={[
          { value: 'miami', label: 'Miami' },
          { value: 'utah', label: 'Utah' },
          { value: 'peru', label: 'Perú' }
        ]}
        required
      />

      <Input
        label="Dirección"
        name="direccion"
        value={formData.direccion}
        onChange={handleChange}
      />

      <Input
        label="Responsable"
        name="responsable"
        value={formData.responsable}
        onChange={handleChange}
      />

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
          {initialData ? 'Actualizar' : 'Crear'} Almacén
        </Button>
      </div>
    </form>
  );
};