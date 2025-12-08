import React, { useState } from 'react';
import { Button, Input, Select } from '../../common';
import type { ProductoFormData } from '../../../types/producto.types';

interface ProductoFormProps {
  initialData?: Partial<ProductoFormData>;
  onSubmit: (data: ProductoFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ProductoForm: React.FC<ProductoFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState<ProductoFormData>({
    marca: initialData?.marca || '',
    nombreComercial: initialData?.nombreComercial || '',
    presentacion: initialData?.presentacion || '',
    clasificacion: initialData?.clasificacion || '',
    subclasificacion: initialData?.subclasificacion || '',
    precioVentaPEN: initialData?.precioVentaPEN || 0,
    margenObjetivo: initialData?.margenObjetivo || 0,
    stockMinimo: initialData?.stockMinimo || 10,
    urlMercadoLibre: initialData?.urlMercadoLibre || '',
    estado: initialData?.estado || 'activo'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: ['precioVentaPEN', 'margenObjetivo', 'stockMinimo'].includes(name)
        ? parseFloat(value) || 0
        : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Marca"
          name="marca"
          value={formData.marca}
          onChange={handleChange}
          required
          placeholder="ej: Nordic Naturals"
        />
        
        <Input
          label="Nombre Comercial"
          name="nombreComercial"
          value={formData.nombreComercial}
          onChange={handleChange}
          required
          placeholder="ej: Omega-3"
        />
      </div>

      <Input
        label="Presentación"
        name="presentacion"
        value={formData.presentacion}
        onChange={handleChange}
        required
        placeholder="ej: 60 cápsulas blandas"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Clasificación"
          name="clasificacion"
          value={formData.clasificacion}
          onChange={handleChange}
          required
          placeholder="ej: Suplemento Nutricional"
        />
        
        <Input
          label="Subclasificación"
          name="subclasificacion"
          value={formData.subclasificacion}
          onChange={handleChange}
          placeholder="ej: Omega 3"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label="Precio Venta (S/)"
          name="precioVentaPEN"
          type="number"
          step="0.01"
          value={formData.precioVentaPEN}
          onChange={handleChange}
          required
        />
        
        <Input
          label="Margen Objetivo (%)"
          name="margenObjetivo"
          type="number"
          step="1"
          value={formData.margenObjetivo}
          onChange={handleChange}
          required
        />
        
        <Input
          label="Stock Mínimo"
          name="stockMinimo"
          type="number"
          value={formData.stockMinimo}
          onChange={handleChange}
        />
      </div>

      <Input
        label="URL Mercado Libre (opcional)"
        name="urlMercadoLibre"
        value={formData.urlMercadoLibre}
        onChange={handleChange}
        placeholder="https://..."
      />

      <Select
        label="Estado"
        name="estado"
        value={formData.estado}
        onChange={handleChange}
        options={[
          { value: 'activo', label: 'Activo' },
          { value: 'inactivo', label: 'Inactivo' }
        ]}
        required
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
          {initialData ? 'Actualizar' : 'Crear'} Producto
        </Button>
      </div>
    </form>
  );
};