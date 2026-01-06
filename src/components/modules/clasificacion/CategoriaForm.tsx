import React, { useState, useEffect } from 'react';
import { X, Save, FolderTree } from 'lucide-react';
import { Button, Input, Modal, Select } from '../../common';
import { useCategoriaStore } from '../../../store/categoriaStore';
import { useAuthStore } from '../../../store/authStore';
import type { Categoria, CategoriaFormData, NivelCategoria, IconoCategoria } from '../../../types/categoria.types';

interface CategoriaFormProps {
  isOpen: boolean;
  onClose: () => void;
  categoria?: Categoria | null;
  categoriaPadreId?: string;
  onSuccess?: () => void;
}

const ICONOS_DISPONIBLES: { value: IconoCategoria; label: string }[] = [
  { value: 'heart', label: '❤️ Corazon' },
  { value: 'brain', label: '🧠 Cerebro' },
  { value: 'bone', label: '🦴 Huesos' },
  { value: 'eye', label: '👁️ Ojos' },
  { value: 'stomach', label: '🫃 Digestivo' },
  { value: 'lungs', label: '🫁 Pulmones' },
  { value: 'shield', label: '🛡️ Inmunidad' },
  { value: 'zap', label: '⚡ Energia' },
  { value: 'moon', label: '🌙 Sueno' },
  { value: 'smile', label: '😊 Bienestar' },
  { value: 'droplet', label: '💧 Hidratacion' },
  { value: 'leaf', label: '🍃 Natural' },
  { value: 'flame', label: '🔥 Metabolismo' },
  { value: 'activity', label: '📈 Rendimiento' },
  { value: 'sparkles', label: '✨ Belleza' }
];

const COLORES_DISPONIBLES = [
  { value: '#3B82F6', label: 'Azul' },
  { value: '#10B981', label: 'Verde' },
  { value: '#8B5CF6', label: 'Violeta' },
  { value: '#F59E0B', label: 'Naranja' },
  { value: '#EF4444', label: 'Rojo' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#14B8A6', label: 'Teal' },
  { value: '#6366F1', label: 'Indigo' }
];

export function CategoriaForm({
  isOpen,
  onClose,
  categoria,
  categoriaPadreId,
  onSuccess
}: CategoriaFormProps) {
  const { user } = useAuthStore();
  const { create, update, categoriasActivas, loading, error, clearError } = useCategoriaStore();

  const [formData, setFormData] = useState<CategoriaFormData>({
    nombre: '',
    nivel: 1,
    descripcion: '',
    icono: undefined,
    color: '#3B82F6',
    mostrarEnWeb: true,
    ordenWeb: 0
  });

  // Cargar datos si es edicion
  useEffect(() => {
    if (categoria) {
      setFormData({
        nombre: categoria.nombre,
        nivel: categoria.nivel,
        descripcion: categoria.descripcion || '',
        categoriaPadreId: categoria.categoriaPadreId,
        icono: categoria.icono,
        color: categoria.color || '#3B82F6',
        mostrarEnWeb: categoria.mostrarEnWeb,
        ordenWeb: categoria.ordenWeb || 0
      });
    } else {
      // Si viene con categoriaPadreId, es nivel 2
      setFormData({
        nombre: '',
        nivel: categoriaPadreId ? 2 : 1,
        descripcion: '',
        categoriaPadreId: categoriaPadreId,
        icono: undefined,
        color: '#3B82F6',
        mostrarEnWeb: true,
        ordenWeb: 0
      });
    }
    clearError();
  }, [categoria, categoriaPadreId, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'nivel') {
      const nivel = parseInt(value) as NivelCategoria;
      setFormData(prev => ({
        ...prev,
        nivel,
        categoriaPadreId: nivel === 1 ? undefined : prev.categoriaPadreId
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (categoria) {
        await update(categoria.id, formData, user.uid);
      } else {
        await create(formData, user.uid);
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      // Error ya manejado por el store
    }
  };

  // Obtener categorias padre (nivel 1) para el selector
  const categoriasPadre = categoriasActivas.filter(c => c.nivel === 1);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={categoria ? 'Editar Categoria' : 'Nueva Categoria'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <FolderTree className="h-5 w-5 text-blue-600" />
          <p className="text-sm text-blue-700">
            Las categorias representan areas de salud o beneficio (ej: Sistema Inmune, Digestivo)
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Nombre"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
            placeholder="ej: Sistema Inmune, Digestivo"
          />

          <Select
            label="Nivel"
            name="nivel"
            value={formData.nivel.toString()}
            onChange={handleChange}
            options={[
              { value: '1', label: 'Nivel 1 - Categoria Principal' },
              { value: '2', label: 'Nivel 2 - Subcategoria' }
            ]}
          />
        </div>

        {formData.nivel === 2 && (
          <Select
            label="Categoria Padre"
            name="categoriaPadreId"
            value={formData.categoriaPadreId || ''}
            onChange={handleChange}
            required
            options={[
              { value: '', label: 'Seleccionar categoria padre...' },
              ...categoriasPadre.map(c => ({
                value: c.id,
                label: c.nombre
              }))
            ]}
          />
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripcion
          </label>
          <textarea
            name="descripcion"
            value={formData.descripcion || ''}
            onChange={handleChange}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            placeholder="Descripcion breve de la categoria..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Icono
            </label>
            <select
              name="icono"
              value={formData.icono || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Sin icono</option>
              {ICONOS_DISPONIBLES.map(icono => (
                <option key={icono.value} value={icono.value}>
                  {icono.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color
            </label>
            <div className="flex gap-2">
              {COLORES_DISPONIBLES.map(color => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    formData.color === color.value
                      ? 'border-gray-800 scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="mostrarEnWeb"
              checked={formData.mostrarEnWeb}
              onChange={handleChange}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Mostrar en Web</span>
          </label>

          {formData.mostrarEnWeb && (
            <Input
              label="Orden en Web"
              name="ordenWeb"
              type="number"
              value={formData.ordenWeb?.toString() || '0'}
              onChange={handleChange}
              className="w-24"
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || !formData.nombre.trim()}>
            <Save className="h-4 w-4 mr-1" />
            {loading ? 'Guardando...' : categoria ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
