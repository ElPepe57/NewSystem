import React, { useState, useEffect } from 'react';
import { Save, Tag } from 'lucide-react';
import { Button, Input, Modal, Select } from '../../common';
import { useEtiquetaStore } from '../../../store/etiquetaStore';
import { useAuthStore } from '../../../store/authStore';
import type { Etiqueta, EtiquetaFormData, TipoEtiqueta } from '../../../types/etiqueta.types';

interface EtiquetaFormProps {
  isOpen: boolean;
  onClose: () => void;
  etiqueta?: Etiqueta | null;
  tipoInicial?: TipoEtiqueta;
  onSuccess?: () => void;
}

const TIPO_OPTIONS: { value: TipoEtiqueta; label: string; descripcion: string }[] = [
  { value: 'atributo', label: 'Atributo', descripcion: 'Caracteristicas del producto (vegano, organico, sin gluten)' },
  { value: 'marketing', label: 'Marketing', descripcion: 'Etiquetas promocionales (best-seller, nuevo, oferta)' },
  { value: 'origen', label: 'Origen', descripcion: 'Procedencia del producto (USA, nacional, importado)' }
];

const COLORES_PRESET = {
  atributo: [
    { fondo: '#DCFCE7', texto: '#166534', borde: '#86EFAC', label: 'Verde' },
    { fondo: '#DBEAFE', texto: '#1E40AF', borde: '#93C5FD', label: 'Azul' },
    { fondo: '#F3E8FF', texto: '#7E22CE', borde: '#D8B4FE', label: 'Violeta' }
  ],
  marketing: [
    { fondo: '#FEF3C7', texto: '#92400E', borde: '#FCD34D', label: 'Amarillo' },
    { fondo: '#FFE4E6', texto: '#BE123C', borde: '#FDA4AF', label: 'Rosa' },
    { fondo: '#FFEDD5', texto: '#C2410C', borde: '#FDBA74', label: 'Naranja' }
  ],
  origen: [
    { fondo: '#E0E7FF', texto: '#3730A3', borde: '#A5B4FC', label: 'Indigo' },
    { fondo: '#CCFBF1', texto: '#0F766E', borde: '#5EEAD4', label: 'Teal' },
    { fondo: '#F1F5F9', texto: '#475569', borde: '#CBD5E1', label: 'Gris' }
  ]
};

const ICONOS_SUGERIDOS: Record<TipoEtiqueta, string[]> = {
  atributo: ['🌱', '🌿', '🍃', '💚', '✅', '🥗', '🌾', '🥛'],
  marketing: ['⭐', '🔥', '✨', '💎', '🏆', '🎯', '💰', '🆕'],
  origen: ['🇺🇸', '🇵🇪', '🌎', '🚢', '✈️', '🏭', '🏠', '📦']
};

export function EtiquetaForm({
  isOpen,
  onClose,
  etiqueta,
  tipoInicial = 'atributo',
  onSuccess
}: EtiquetaFormProps) {
  const { user } = useAuthStore();
  const { create, update, loading, error, clearError } = useEtiquetaStore();

  const [formData, setFormData] = useState<EtiquetaFormData>({
    nombre: '',
    tipo: tipoInicial,
    icono: '',
    colorFondo: COLORES_PRESET[tipoInicial][0].fondo,
    colorTexto: COLORES_PRESET[tipoInicial][0].texto,
    colorBorde: COLORES_PRESET[tipoInicial][0].borde
  });

  // Cargar datos si es edicion
  useEffect(() => {
    if (etiqueta) {
      setFormData({
        nombre: etiqueta.nombre,
        tipo: etiqueta.tipo,
        icono: etiqueta.icono || '',
        colorFondo: etiqueta.colorFondo || COLORES_PRESET[etiqueta.tipo][0].fondo,
        colorTexto: etiqueta.colorTexto || COLORES_PRESET[etiqueta.tipo][0].texto,
        colorBorde: etiqueta.colorBorde || COLORES_PRESET[etiqueta.tipo][0].borde
      });
    } else {
      setFormData({
        nombre: '',
        tipo: tipoInicial,
        icono: '',
        colorFondo: COLORES_PRESET[tipoInicial][0].fondo,
        colorTexto: COLORES_PRESET[tipoInicial][0].texto,
        colorBorde: COLORES_PRESET[tipoInicial][0].borde
      });
    }
    clearError();
  }, [etiqueta, tipoInicial, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'tipo') {
      const tipo = value as TipoEtiqueta;
      const coloresDefecto = COLORES_PRESET[tipo][0];
      setFormData(prev => ({
        ...prev,
        tipo,
        colorFondo: coloresDefecto.fondo,
        colorTexto: coloresDefecto.texto,
        colorBorde: coloresDefecto.borde
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleColorPreset = (preset: typeof COLORES_PRESET.atributo[0]) => {
    setFormData(prev => ({
      ...prev,
      colorFondo: preset.fondo,
      colorTexto: preset.texto,
      colorBorde: preset.borde
    }));
  };

  const handleIconSelect = (icono: string) => {
    setFormData(prev => ({
      ...prev,
      icono: prev.icono === icono ? '' : icono
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (etiqueta) {
        await update(etiqueta.id, formData, user.uid);
      } else {
        await create(formData, user.uid);
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      // Error ya manejado por el store
    }
  };

  const tipoActual = formData.tipo;
  const coloresDelTipo = COLORES_PRESET[tipoActual];
  const iconosDelTipo = ICONOS_SUGERIDOS[tipoActual];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={etiqueta ? 'Editar Etiqueta' : 'Nueva Etiqueta'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Tag className="h-5 w-5 text-blue-600" />
          <p className="text-sm text-blue-700">
            Las etiquetas permiten clasificar productos con atributos flexibles
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Nombre"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
            placeholder="ej: Vegano, Best-seller, USA"
          />

          <Select
            label="Tipo"
            name="tipo"
            value={formData.tipo}
            onChange={handleChange}
            options={TIPO_OPTIONS.map(t => ({
              value: t.value,
              label: t.label
            }))}
          />
        </div>

        {/* Descripcion del tipo seleccionado */}
        <div className="p-2 bg-gray-50 rounded text-sm text-gray-600">
          {TIPO_OPTIONS.find(t => t.value === tipoActual)?.descripcion}
        </div>

        {/* Selector de icono */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Icono (opcional)
          </label>
          <div className="flex flex-wrap gap-2">
            {iconosDelTipo.map(icono => (
              <button
                key={icono}
                type="button"
                onClick={() => handleIconSelect(icono)}
                className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                  formData.icono === icono
                    ? 'border-primary-500 bg-primary-50 scale-110'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {icono}
              </button>
            ))}
            <input
              type="text"
              name="icono"
              value={formData.icono || ''}
              onChange={handleChange}
              placeholder="..."
              className="w-10 h-10 text-center text-xl border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              maxLength={2}
            />
          </div>
        </div>

        {/* Selector de colores */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Esquema de color
          </label>
          <div className="flex gap-3">
            {coloresDelTipo.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleColorPreset(preset)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  formData.colorFondo === preset.fondo
                    ? 'ring-2 ring-offset-2 ring-primary-500 scale-105'
                    : 'hover:scale-105'
                }`}
                style={{
                  backgroundColor: preset.fondo,
                  color: preset.texto,
                  border: `1px solid ${preset.borde}`
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Vista previa */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vista previa
          </label>
          <div className="flex items-center gap-4">
            <span
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                backgroundColor: formData.colorFondo,
                color: formData.colorTexto,
                border: `1px solid ${formData.colorBorde}`
              }}
            >
              {formData.icono && <span>{formData.icono}</span>}
              <span>{formData.nombre || 'Etiqueta'}</span>
            </span>
            <span className="text-sm text-gray-500">
              Asi se vera en los productos
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || !formData.nombre.trim()}>
            <Save className="h-4 w-4 mr-1" />
            {loading ? 'Guardando...' : etiqueta ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
