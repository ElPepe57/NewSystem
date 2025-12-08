import React, { useState } from 'react';
import { Button, Input, Select } from '../../common';
import type { ProveedorFormData, TipoProveedor } from '../../../types/ordenCompra.types';

interface ProveedorFormProps {
  onSubmit: (data: ProveedorFormData) => void;
  onCancel: () => void;
  loading?: boolean;
  initialData?: Partial<ProveedorFormData>;
}

const tipoOptions: Array<{ value: TipoProveedor; label: string }> = [
  { value: 'fabricante', label: 'Fabricante' },
  { value: 'distribuidor', label: 'Distribuidor' },
  { value: 'mayorista', label: 'Mayorista' },
  { value: 'minorista', label: 'Minorista' }
];

const paisOptions = [
  { value: 'USA', label: 'Estados Unidos' },
  { value: 'China', label: 'China' },
  { value: 'India', label: 'India' },
  { value: 'Peru', label: 'Perú' },
  { value: 'Mexico', label: 'México' },
  { value: 'Canada', label: 'Canadá' }
];

export const ProveedorForm: React.FC<ProveedorFormProps> = ({
  onSubmit,
  onCancel,
  loading = false,
  initialData
}) => {
  const [formData, setFormData] = useState<ProveedorFormData>({
    nombre: initialData?.nombre || '',
    tipo: initialData?.tipo || 'distribuidor',
    contacto: initialData?.contacto || '',
    email: initialData?.email || '',
    telefono: initialData?.telefono || '',
    direccion: initialData?.direccion || '',
    pais: initialData?.pais || 'USA',
    notasInternas: initialData?.notasInternas || ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Información Básica */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Información Básica</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nombre del Proveedor"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
          />
          
          <Select
            label="Tipo"
            name="tipo"
            value={formData.tipo}
            onChange={handleChange}
            options={tipoOptions}
            required
          />
          
          <Select
            label="País"
            name="pais"
            value={formData.pais}
            onChange={handleChange}
            options={paisOptions}
            required
          />
          
          <Input
            label="Persona de Contacto"
            name="contacto"
            value={formData.contacto}
            onChange={handleChange}
          />
        </div>
      </div>

      {/* Contacto */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Datos de Contacto</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
          />
          
          <Input
            label="Teléfono"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
          />
        </div>
        
        <div className="mt-4">
          <Input
            label="Dirección"
            name="direccion"
            value={formData.direccion}
            onChange={handleChange}
          />
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notas Internas
        </label>
        <textarea
          name="notasInternas"
          value={formData.notasInternas}
          onChange={handleChange}
          rows={3}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Términos de pago, condiciones especiales, etc."
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
          {initialData ? 'Actualizar' : 'Crear'} Proveedor
        </Button>
      </div>
    </form>
  );
};