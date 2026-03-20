import React, { useState, useEffect } from 'react';
import { X, Save, FolderTree } from 'lucide-react';
import { Button, Input, Modal, Select } from '../../common';
import { useCategoriaStore } from '../../../store/categoriaStore';
import { useLineaNegocioStore } from '../../../store/lineaNegocioStore';
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
  { value: 'activity', label: '🫃 Digestivo' },
  { value: 'pill', label: '💊 Medicamentos' },
  { value: 'shield', label: '🛡️ Inmunidad' },
  { value: 'zap', label: '⚡ Energia' },
  { value: 'moon', label: '🌙 Sueno' },
  { value: 'user', label: '😊 Bienestar' },
  { value: 'droplet', label: '💧 Hidratacion' },
  { value: 'leaf', label: '🍃 Natural' },
  { value: 'flame', label: '🔥 Metabolismo' },
  { value: 'sun', label: '☀️ Vitaminas' },
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
  const { lineasActivas, fetchLineasActivas } = useLineaNegocioStore();

  const [selectedLineas, setSelectedLineas] = useState<string[]>([]);

  // Cargar lineas activas
  useEffect(() => {
    if (lineasActivas.length === 0) {
      fetchLineasActivas();
    }
  }, []);

  const [formData, setFormData] = useState<CategoriaFormData>({
    nombre: '',
    nivel: 1,
    descripcion: '',
    icono: undefined,
    color: '#3B82F6',
    mostrarEnWeb: true,
    ordenDisplay: 0,
    margenMinimo: 20,
    margenObjetivo: 35,
    margenMaximo: 60
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
        ordenDisplay: categoria.ordenDisplay || 0,
        margenMinimo: categoria.margenMinimo ?? 20,
        margenObjetivo: categoria.margenObjetivo ?? 35,
        margenMaximo: categoria.margenMaximo ?? 60
      });
      setSelectedLineas(categoria.lineaNegocioIds || []);
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
        ordenDisplay: 0,
        margenMinimo: 20,
        margenObjetivo: 35,
        margenMaximo: 60
      });
      setSelectedLineas([]);
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
    } else if (name === 'margenMinimo' || name === 'margenObjetivo' || name === 'margenMaximo') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? undefined : parseFloat(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
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
      if (categoria) {
        await update(categoria.id, dataToSave, user.uid);
      } else {
        await create(dataToSave, user.uid);
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

        {/* Rangos de Margen */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rangos de Margen (%)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Define los rangos de margen para productos de esta categoria
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Margen Minimo (%)"
              name="margenMinimo"
              type="number"
              value={formData.margenMinimo?.toString() || ''}
              onChange={handleChange}
              placeholder="ej: 20"
            />
            <Input
              label="Margen Objetivo (%)"
              name="margenObjetivo"
              type="number"
              value={formData.margenObjetivo?.toString() || ''}
              onChange={handleChange}
              placeholder="ej: 35"
            />
            <Input
              label="Margen Maximo (%)"
              name="margenMaximo"
              type="number"
              value={formData.margenMaximo?.toString() || ''}
              onChange={handleChange}
              placeholder="ej: 60"
            />
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
              name="ordenDisplay"
              type="number"
              value={formData.ordenDisplay?.toString() || '0'}
              onChange={handleChange}
              className="w-24"
            />
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
            {loading ? 'Guardando...' : categoria ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
