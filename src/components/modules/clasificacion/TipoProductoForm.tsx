import React, { useState, useEffect } from 'react';
import { X, Save, FlaskConical } from 'lucide-react';
import { Button, Input, Modal } from '../../common';
import { useTipoProductoStore } from '../../../store/tipoProductoStore';
import { useLineaNegocioStore } from '../../../store/lineaNegocioStore';
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
  const { lineasActivas, fetchLineasActivas } = useLineaNegocioStore();

  const [formData, setFormData] = useState<TipoProductoFormData>({
    nombre: '',
    alias: [],
    descripcion: '',
    principioActivo: '',
    beneficiosPrincipales: []
  });

  const [selectedLineas, setSelectedLineas] = useState<string[]>([]);
  const [aliasInput, setAliasInput] = useState('');
  const [beneficioInput, setBeneficioInput] = useState('');

  // Cargar lineas activas
  useEffect(() => {
    if (lineasActivas.length === 0) {
      fetchLineasActivas();
    }
  }, []);

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
      setSelectedLineas(tipoProducto.lineaNegocioIds || []);
    } else {
      setFormData({
        nombre: '',
        alias: [],
        descripcion: '',
        principioActivo: '',
        beneficiosPrincipales: []
      });
      setSelectedLineas([]);
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

  const toggleLinea = (lineaId: string) => {
    setSelectedLineas(prev =>
      prev.includes(lineaId)
        ? prev.filter(id => id !== lineaId)
        : [...prev, lineaId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const dataToSave = { ...formData, lineaNegocioIds: selectedLineas };

    try {
      if (tipoProducto) {
        await update(tipoProducto.id, dataToSave, user.uid);
      } else {
        await create(dataToSave, user.uid);
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

        {/* Lineas de Negocio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lineas de negocio
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Dejar vacio para disponible en todas las lineas
          </p>
          <div className="flex flex-wrap gap-2">
            {lineasActivas.map(linea => {
              const isSelected = selectedLineas.includes(linea.id);
              return (
                <button
                  key={linea.id}
                  type="button"
                  onClick={() => toggleLinea(linea.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    isSelected
                      ? 'border-transparent text-white'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
                  style={isSelected ? { backgroundColor: linea.color } : undefined}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: linea.color }} />
                  {linea.icono} {linea.nombre}
                </button>
              );
            })}
          </div>
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
