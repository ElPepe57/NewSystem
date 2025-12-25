import React, { useState } from 'react';
import { Button, Input, Select } from '../../common';
import type { AlmacenFormData } from '../../../types/almacen.types';

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
    pais: initialData?.pais || 'USA',
    direccion: initialData?.direccion || '',
    ciudad: initialData?.ciudad || '',
    estado: initialData?.estado || '',
    codigoPostal: initialData?.codigoPostal || '',
    tipo: initialData?.tipo || 'viajero',
    estadoAlmacen: initialData?.estadoAlmacen || 'activo',
    capacidadUnidades: initialData?.capacidadUnidades,
    contacto: initialData?.contacto || '',
    telefono: initialData?.telefono || '',
    email: initialData?.email || '',
    esViajero: initialData?.esViajero ?? true,
    notas: initialData?.notas || ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? undefined : parseFloat(value)) : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Información Básica */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Información Básica</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Código *"
            name="codigo"
            value={formData.codigo}
            onChange={handleChange}
            required
            placeholder="ej: ALM-USA-001"
            disabled={!!initialData?.codigo}
          />

          <Input
            label="Nombre *"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
            placeholder="ej: Almacén Principal USA"
          />

          <Select
            label="País *"
            name="pais"
            value={formData.pais}
            onChange={handleChange}
            options={[
              { value: 'USA', label: '🇺🇸 Estados Unidos' },
              { value: 'Peru', label: '🇵🇪 Perú' }
            ]}
            required
          />

          <Select
            label="Tipo de Almacén *"
            name="tipo"
            value={formData.tipo}
            onChange={handleChange}
            options={[
              { value: 'viajero', label: 'Viajero' },
              { value: 'almacen_usa', label: 'Almacén USA' },
              { value: 'almacen_peru', label: 'Almacén Perú' }
            ]}
            required
          />

          <Select
            label="Estado *"
            name="estadoAlmacen"
            value={formData.estadoAlmacen}
            onChange={handleChange}
            options={[
              { value: 'activo', label: 'Activo' },
              { value: 'inactivo', label: 'Inactivo' }
            ]}
            required
          />

          <Input
            label="Capacidad (unidades)"
            name="capacidadUnidades"
            type="number"
            value={formData.capacidadUnidades || ''}
            onChange={handleChange}
            placeholder="ej: 500"
          />
        </div>
      </div>

      {/* Ubicación */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Ubicación</h3>
        <div className="grid grid-cols-1 gap-4">
          <Input
            label="Dirección"
            name="direccion"
            value={formData.direccion}
            onChange={handleChange}
            placeholder="ej: 1234 Warehouse Drive"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Ciudad"
              name="ciudad"
              value={formData.ciudad}
              onChange={handleChange}
              placeholder="ej: Miami"
            />

            <Input
              label="Estado/Región"
              name="estado"
              value={formData.estado || ''}
              onChange={handleChange}
              placeholder="ej: Florida"
            />

            <Input
              label="Código Postal"
              name="codigoPostal"
              value={formData.codigoPostal || ''}
              onChange={handleChange}
              placeholder="ej: 33101"
            />
          </div>
        </div>
      </div>

      {/* Información de Contacto */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Información de Contacto</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Contacto"
            name="contacto"
            value={formData.contacto || ''}
            onChange={handleChange}
            placeholder="ej: John Smith"
          />

          <Input
            label="Teléfono"
            name="telefono"
            value={formData.telefono || ''}
            onChange={handleChange}
            placeholder="ej: +1 (305) 123-4567"
          />

          <div className="md:col-span-2">
            <Input
              label="Email"
              name="email"
              type="email"
              value={formData.email || ''}
              onChange={handleChange}
              placeholder="ej: warehouse@businessmn.com"
            />
          </div>
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notas
        </label>
        <textarea
          name="notas"
          value={formData.notas || ''}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Información adicional sobre el almacén..."
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
          {initialData ? 'Actualizar' : 'Crear'} Almacén
        </Button>
      </div>
    </form>
  );
};
