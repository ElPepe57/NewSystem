import React, { useState, useEffect } from 'react';
import { Button } from '../../common/Button';

const COLOR_PALETTE = [
  { hex: '#3B82F6', name: 'Azul' },
  { hex: '#10B981', name: 'Verde' },
  { hex: '#F59E0B', name: 'Naranja' },
  { hex: '#EF4444', name: 'Rojo' },
  { hex: '#8B5CF6', name: 'Morado' },
  { hex: '#EC4899', name: 'Rosa' },
  { hex: '#14B8A6', name: 'Teal' },
  { hex: '#6366F1', name: 'Indigo' },
  { hex: '#D97706', name: 'Amber' },
  { hex: '#06B6D4', name: 'Cyan' },
];

const EMOJI_OPTIONS = ['💊', '✨', '🧴', '🛒', '📦', '🏷️', '🔬', '🧪', '💄', '🌿', '⚡', '🎯'];

interface LineaNegocioFormProps {
  initialData?: {
    id: string;
    nombre: string;
    codigo: string;
    descripcion?: string;
    color: string;
    icono?: string;
    activa: boolean;
  } | null;
  onSubmit: (data: {
    nombre: string;
    codigo: string;
    descripcion?: string;
    color: string;
    icono?: string;
    activa: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const LineaNegocioForm: React.FC<LineaNegocioFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
}) => {
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [color, setColor] = useState(COLOR_PALETTE[0].hex);
  const [icono, setIcono] = useState('');
  const [activa, setActiva] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setNombre(initialData.nombre);
      setCodigo(initialData.codigo);
      setDescripcion(initialData.descripcion || '');
      setColor(initialData.color);
      setIcono(initialData.icono || '');
      setActiva(initialData.activa);
    }
  }, [initialData]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio';
    }

    if (!codigo.trim()) {
      newErrors.codigo = 'El codigo es obligatorio';
    } else if (codigo.length > 5) {
      newErrors.codigo = 'El codigo no puede tener mas de 5 caracteres';
    }

    if (!color) {
      newErrors.color = 'Selecciona un color';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      nombre: nombre.trim(),
      codigo: codigo.trim().toUpperCase(),
      descripcion: descripcion.trim() || undefined,
      color,
      icono: icono || undefined,
      activa,
    });
  };

  const handleCodigoChange = (value: string) => {
    setCodigo(value.toUpperCase().slice(0, 5));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Nombre */}
      <div>
        <label htmlFor="ln-nombre" className="block text-sm font-medium text-gray-700 mb-1">
          Nombre de la linea <span className="text-red-500">*</span>
        </label>
        <input
          id="ln-nombre"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Suplementos y Vitaminas"
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.nombre ? 'border-red-300' : 'border-gray-300'
          }`}
        />
        {errors.nombre && <p className="mt-1 text-sm text-red-600">{errors.nombre}</p>}
      </div>

      {/* Codigo */}
      <div>
        <label htmlFor="ln-codigo" className="block text-sm font-medium text-gray-700 mb-1">
          Codigo (ej: SUP, SKC) <span className="text-red-500">*</span>
        </label>
        <input
          id="ln-codigo"
          type="text"
          value={codigo}
          onChange={(e) => handleCodigoChange(e.target.value)}
          placeholder="SUP"
          maxLength={5}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase ${
            errors.codigo ? 'border-red-300' : 'border-gray-300'
          }`}
        />
        {errors.codigo && <p className="mt-1 text-sm text-red-600">{errors.codigo}</p>}
        <p className="mt-1 text-xs text-gray-400">{codigo.length}/5 caracteres</p>
      </div>

      {/* Descripcion */}
      <div>
        <label htmlFor="ln-descripcion" className="block text-sm font-medium text-gray-700 mb-1">
          Descripcion
        </label>
        <textarea
          id="ln-descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripcion opcional de la linea de negocio"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </div>

      {/* Color */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Color identificador <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.name}
              onClick={() => setColor(c.hex)}
              className={`w-9 h-9 rounded-lg transition-all ${
                color === c.hex
                  ? 'ring-2 ring-offset-2 ring-gray-800 scale-110'
                  : 'hover:scale-105'
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
        {errors.color && <p className="mt-1 text-sm text-red-600">{errors.color}</p>}
      </div>

      {/* Icono / Emoji */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Icono/Emoji
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setIcono(emoji)}
              className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all border ${
                icono === emoji
                  ? 'border-gray-800 bg-gray-100 ring-2 ring-offset-1 ring-gray-800 scale-110'
                  : 'border-gray-200 hover:border-gray-400 hover:scale-105'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={icono}
          onChange={(e) => setIcono(e.target.value)}
          placeholder="O escribe un emoji personalizado"
          maxLength={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-center text-lg"
        />
      </div>

      {/* Activa Toggle */}
      <div className="flex items-center justify-between py-2">
        <div>
          <label htmlFor="ln-activa" className="text-sm font-medium text-gray-700">
            Activa
          </label>
          <p className="text-xs text-gray-400">Las lineas inactivas no aparecen en seleccion</p>
        </div>
        <button
          id="ln-activa"
          type="button"
          role="switch"
          aria-checked={activa}
          onClick={() => setActiva(!activa)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            activa ? 'bg-primary-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              activa ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Preview */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <p className="text-xs text-gray-500 mb-2 font-medium">Vista previa</p>
        <div className="flex items-center space-x-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: color }}
          >
            {icono || codigo.slice(0, 2) || '?'}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{nombre || 'Nombre de la linea'}</p>
            <p className="text-xs text-gray-500">
              <span
                className="inline-block px-1.5 py-0.5 rounded text-white text-xs font-medium mr-1"
                style={{ backgroundColor: color }}
              >
                {codigo || 'COD'}
              </span>
              {activa ? (
                <span className="text-green-600">Activa</span>
              ) : (
                <span className="text-gray-400">Inactiva</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          {initialData ? 'Guardar cambios' : 'Crear linea'}
        </Button>
      </div>
    </form>
  );
};
