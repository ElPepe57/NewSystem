import React, { useState } from 'react';
import { Button, Input, Select } from '../../common';
import type { AlmacenFormData, PaisAlmacen } from '../../../types/almacen.types';
import { PAISES_CONFIG } from '../../../types/almacen.types';

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
    pais: initialData?.pais || ('' as PaisAlmacen),
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

  // Opciones de país generadas dinámicamente desde PAISES_CONFIG
  const opcionesPais = [
    { value: '', label: 'Selecciona un país...' },
    ...Object.entries(PAISES_CONFIG).map(([key, config]) => ({
      value: key,
      label: `${config.emoji} ${config.nombre}`
    }))
  ];

  // Tipo de almacén con label dinámico según el país seleccionado
  const paisSeleccionado = formData.pais ? PAISES_CONFIG[formData.pais] : null;
  const esOrigen = paisSeleccionado?.esOrigen ?? true;
  const labelAlmacen = paisSeleccionado
    ? `Almacén ${paisSeleccionado.nombre}`
    : 'Almacén';

  const opcionesTipo = [
    { value: 'viajero', label: 'Viajero' },
    { value: esOrigen ? 'almacen_origen' : 'almacen_peru', label: labelAlmacen },
    { value: 'courier', label: 'Courier' },
  ];

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
            placeholder="ej: ALM-001"
            disabled={!!initialData?.codigo}
          />

          <Input
            label="Nombre *"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
            placeholder="ej: Almacén Principal"
          />

          <Select
            label="País *"
            name="pais"
            value={formData.pais}
            onChange={handleChange}
            options={opcionesPais}
            required
          />

          <Select
            label="Tipo de Almacén *"
            name="tipo"
            value={formData.tipo}
            onChange={handleChange}
            options={opcionesTipo}
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
              placeholder="ej: Ciudad"
            />

            <Input
              label="Estado/Región"
              name="estado"
              value={formData.estado || ''}
              onChange={handleChange}
              placeholder="ej: Estado/Provincia"
            />

            <Input
              label="Código Postal"
              name="codigoPostal"
              value={formData.codigoPostal || ''}
              onChange={handleChange}
              placeholder="ej: Código postal"
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
            placeholder="ej: Nombre del contacto"
          />

          <Input
            label="Teléfono"
            name="telefono"
            value={formData.telefono || ''}
            onChange={handleChange}
            placeholder="ej: +51 999 999 999"
          />

          <div className="md:col-span-2">
            <Input
              label="Email"
              name="email"
              type="email"
              value={formData.email || ''}
              onChange={handleChange}
              placeholder="ej: almacen@vitaskinperu.com"
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
