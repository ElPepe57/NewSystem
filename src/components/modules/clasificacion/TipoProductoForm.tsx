import React, { useState, useEffect } from 'react';
import { X, Save, FlaskConical } from 'lucide-react';
import { Button, Input, Modal } from '../../common';
import { useTipoProductoStore } from '../../../store/tipoProductoStore';
import { useAuthStore } from '../../../store/authStore';
import type { TipoProducto, TipoProductoFormData } from '../../../types/tipoProducto.types';

interface TipoProductoFormProps {
  isOpen: boolean;
  onClose: () => void;
  tipoProducto?: TipoProducto | null;
  onSuccess?: () => void;
}

export function TipoProductoForm({
  isOpen,
  onClose,
  tipoProducto,
  onSuccess
}: TipoProductoFormProps) {
  const { user } = useAuthStore();
  const { create, update, loading, error, clearError } = useTipoProductoStore();

  const [formData, setFormData] = useState<TipoProductoFormData>({
    nombre: '',
    alias: [],
    descripcion: '',
    principioActivo: '',
    beneficiosPrincipales: []
  });

  const [aliasInput, setAliasInput] = useState('');
  const [beneficioInput, setBeneficioInput] = useState('');

  // Cargar datos si es edicion
  useEffect(() => {
    if (tipoProducto) {
      setFormData({
        nombre: tipoProducto.nombre,
        alias: tipoProducto.alias || [],
        descripcion: tipoProducto.descripcion || '',
        principioActivo: tipoProducto.principioActivo || '',
        beneficiosPrincipales: tipoProducto.beneficiosPrincipales || []
      });
    } else {
      setFormData({
        nombre: '',
        alias: [],
        descripcion: '',
        principioActivo: '',
        beneficiosPrincipales: []
      });
    }
    clearError();
  }, [tipoProducto, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddAlias = () => {
    if (aliasInput.trim() && !formData.alias?.includes(aliasInput.trim())) {
      setFormData(prev => ({
        ...prev,
        alias: [...(prev.alias || []), aliasInput.trim()]
      }));
      setAliasInput('');
    }
  };

  const handleRemoveAlias = (alias: string) => {
    setFormData(prev => ({
      ...prev,
      alias: prev.alias?.filter(a => a !== alias) || []
    }));
  };

  const handleAddBeneficio = () => {
    if (beneficioInput.trim() && !formData.beneficiosPrincipales?.includes(beneficioInput.trim())) {
      setFormData(prev => ({
        ...prev,
        beneficiosPrincipales: [...(prev.beneficiosPrincipales || []), beneficioInput.trim()]
      }));
      setBeneficioInput('');
    }
  };

  const handleRemoveBeneficio = (beneficio: string) => {
    setFormData(prev => ({
      ...prev,
      beneficiosPrincipales: prev.beneficiosPrincipales?.filter(b => b !== beneficio) || []
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (tipoProducto) {
        await update(tipoProducto.id, formData, user.uid);
      } else {
        await create(formData, user.uid);
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      // Error ya manejado por el store
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tipoProducto ? 'Editar Tipo de Producto' : 'Nuevo Tipo de Producto'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <FlaskConical className="h-5 w-5 text-blue-600" />
          <p className="text-sm text-blue-700">
            El tipo agrupa productos que son "lo mismo" de diferentes marcas (ej: Omega 3, Colageno)
          </p>
        </div>

        <Input
          label="Nombre del Tipo"
          name="nombre"
          value={formData.nombre}
          onChange={handleChange}
          required
          placeholder="ej: Aceite de Oregano, Omega 3 EPA/DHA"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alias (nombres alternativos)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAlias())}
              placeholder="Agregar alias..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
            <Button type="button" variant="secondary" size="sm" onClick={handleAddAlias}>
              Agregar
            </Button>
          </div>
          {formData.alias && formData.alias.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {formData.alias.map((alias) => (
                <span
                  key={alias}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-sm"
                >
                  {alias}
                  <button
                    type="button"
                    onClick={() => handleRemoveAlias(alias)}
                    className="hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <Input
          label="Principio Activo"
          name="principioActivo"
          value={formData.principioActivo || ''}
          onChange={handleChange}
          placeholder="ej: Carvacrol, EPA/DHA"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripcion
          </label>
          <textarea
            name="descripcion"
            value={formData.descripcion || ''}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            placeholder="Descripcion general del tipo de producto..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Beneficios Principales
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={beneficioInput}
              onChange={(e) => setBeneficioInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBeneficio())}
              placeholder="Agregar beneficio..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
            <Button type="button" variant="secondary" size="sm" onClick={handleAddBeneficio}>
              Agregar
            </Button>
          </div>
          {formData.beneficiosPrincipales && formData.beneficiosPrincipales.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {formData.beneficiosPrincipales.map((beneficio) => (
                <span
                  key={beneficio}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                >
                  {beneficio}
                  <button
                    type="button"
                    onClick={() => handleRemoveBeneficio(beneficio)}
                    className="hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || !formData.nombre.trim()}>
            <Save className="h-4 w-4 mr-1" />
            {loading ? 'Guardando...' : tipoProducto ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
