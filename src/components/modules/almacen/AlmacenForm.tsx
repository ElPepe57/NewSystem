import React, { useState, useEffect, useCallback } from 'react';
import { Button, Input, Select } from '../../common';
import { almacenService } from '../../../services/almacen.service';
import type { Almacen, AlmacenFormData, TipoAlmacen, EstadoAlmacen, PaisAlmacen, FrecuenciaViaje } from '../../../types/almacen.types';

interface AlmacenFormProps {
  almacen?: Almacen;
  onSubmit: (data: AlmacenFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const AlmacenForm: React.FC<AlmacenFormProps> = ({
  almacen,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState<AlmacenFormData>({
    codigo: '',
    nombre: '',
    pais: 'USA',
    tipo: 'viajero',
    estadoAlmacen: 'activo',
    direccion: '',
    ciudad: '',
    estado: '',
    codigoPostal: '',
    contacto: '',
    telefono: '',
    email: '',
    whatsapp: '',
    capacidadUnidades: undefined,
    esViajero: true,
    frecuenciaViaje: 'quincenal',
    proximoViaje: undefined,
    costoPromedioFlete: undefined,
    notas: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingCodigo, setLoadingCodigo] = useState(false);

  // Función para cargar el próximo código automático
  const cargarProximoCodigo = useCallback(async (tipo: TipoAlmacen) => {
    if (almacen) return; // No cargar si estamos editando

    setLoadingCodigo(true);
    try {
      const proximoCodigo = await almacenService.getProximoCodigo(tipo);
      setFormData(prev => ({ ...prev, codigo: proximoCodigo }));
    } catch (error) {
      console.error('Error al obtener próximo código:', error);
    } finally {
      setLoadingCodigo(false);
    }
  }, [almacen]);

  useEffect(() => {
    if (almacen) {
      // Modo edición: cargar datos del almacén
      setFormData({
        codigo: almacen.codigo,
        nombre: almacen.nombre,
        pais: almacen.pais,
        tipo: almacen.tipo,
        estadoAlmacen: almacen.estadoAlmacen,
        direccion: almacen.direccion,
        ciudad: almacen.ciudad,
        estado: almacen.estado || '',
        codigoPostal: almacen.codigoPostal || '',
        contacto: almacen.contacto || '',
        telefono: almacen.telefono || '',
        email: almacen.email || '',
        whatsapp: almacen.whatsapp || '',
        capacidadUnidades: almacen.capacidadUnidades,
        esViajero: almacen.esViajero,
        frecuenciaViaje: almacen.frecuenciaViaje,
        proximoViaje: almacen.proximoViaje?.toDate(),
        costoPromedioFlete: almacen.costoPromedioFlete,
        notas: almacen.notas || ''
      });
    } else {
      // Modo creación: cargar código automático para el tipo inicial
      cargarProximoCodigo('viajero');
    }
  }, [almacen, cargarProximoCodigo]);

  const handleChange = (field: keyof AlmacenFormData, value: string | number | boolean | Date | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpiar error del campo
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleTipoChange = (tipo: TipoAlmacen) => {
    const esViajero = tipo === 'viajero';
    const pais: PaisAlmacen = tipo === 'almacen_peru' ? 'Peru' : 'USA';
    setFormData(prev => ({
      ...prev,
      tipo,
      esViajero,
      pais,
      frecuenciaViaje: esViajero ? prev.frecuenciaViaje || 'quincenal' : undefined,
      proximoViaje: esViajero ? prev.proximoViaje : undefined,
      costoPromedioFlete: esViajero ? prev.costoPromedioFlete : undefined
    }));

    // Regenerar código automático al cambiar el tipo (solo en creación)
    if (!almacen) {
      cargarProximoCodigo(tipo);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // El código es automático, no necesita validación
    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }
    if (!formData.direccion.trim()) {
      newErrors.direccion = 'La dirección es requerida';
    }
    if (!formData.ciudad.trim()) {
      newErrors.ciudad = 'La ciudad es requerida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(formData);
  };

  const tipoOptions = [
    { value: 'viajero', label: 'Viajero (almacena y transporta)' },
    { value: 'almacen_usa', label: 'Almacén USA (fijo)' },
    { value: 'almacen_peru', label: 'Almacén Perú' }
  ];

  const estadoOptions = [
    { value: 'activo', label: 'Activo' },
    { value: 'inactivo', label: 'Inactivo' },
    { value: 'suspendido', label: 'Suspendido' }
  ];

  const frecuenciaOptions = [
    { value: 'semanal', label: 'Semanal' },
    { value: 'quincenal', label: 'Quincenal' },
    { value: 'mensual', label: 'Mensual' },
    { value: 'bimestral', label: 'Bimestral' },
    { value: 'variable', label: 'Variable' }
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tipo de almacén */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tipo
        </label>
        <div className="grid grid-cols-3 gap-3">
          {tipoOptions.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleTipoChange(option.value as TipoAlmacen)}
              className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                formData.tipo === option.value
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
            >
              {option.value === 'viajero' && <span className="block text-lg mb-1">👤</span>}
              {option.value === 'almacen_usa' && <span className="block text-lg mb-1">🇺🇸</span>}
              {option.value === 'almacen_peru' && <span className="block text-lg mb-1">🇵🇪</span>}
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Información básica */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Código <span className="text-xs text-gray-400">(automático)</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={loadingCodigo ? 'Generando...' : formData.codigo}
              readOnly
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-700 font-mono cursor-not-allowed"
            />
            {loadingCodigo && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>
        </div>
        <Input
          label="Nombre"
          value={formData.nombre}
          onChange={(e) => handleChange('nombre', e.target.value)}
          placeholder={formData.esViajero ? 'Nombre del viajero' : 'Nombre del almacén'}
          error={errors.nombre}
        />
      </div>

      <Select
        label="Estado"
        value={formData.estadoAlmacen}
        onChange={(e) => handleChange('estadoAlmacen', e.target.value as EstadoAlmacen)}
        options={estadoOptions}
      />

      {/* Ubicación */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700 border-b pb-2">Ubicación</h3>
        <Input
          label="Dirección"
          value={formData.direccion}
          onChange={(e) => handleChange('direccion', e.target.value)}
          placeholder="Calle y número"
          error={errors.direccion}
        />
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Ciudad"
            value={formData.ciudad}
            onChange={(e) => handleChange('ciudad', e.target.value)}
            placeholder="Miami"
            error={errors.ciudad}
          />
          <Input
            label="Estado/Región"
            value={formData.estado || ''}
            onChange={(e) => handleChange('estado', e.target.value)}
            placeholder="Florida"
          />
          <Input
            label="Código Postal"
            value={formData.codigoPostal || ''}
            onChange={(e) => handleChange('codigoPostal', e.target.value)}
            placeholder="33101"
          />
        </div>
      </div>

      {/* Contacto */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700 border-b pb-2">Contacto</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Nombre de Contacto"
            value={formData.contacto || ''}
            onChange={(e) => handleChange('contacto', e.target.value)}
            placeholder="Nombre completo"
          />
          <Input
            label="Teléfono"
            value={formData.telefono || ''}
            onChange={(e) => handleChange('telefono', e.target.value)}
            placeholder="+1 (305) 555-0100"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Email"
            type="email"
            value={formData.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="email@ejemplo.com"
          />
          <Input
            label="WhatsApp"
            value={formData.whatsapp || ''}
            onChange={(e) => handleChange('whatsapp', e.target.value)}
            placeholder="+1 (305) 555-0100"
          />
        </div>
      </div>

      {/* Capacidad */}
      <Input
        label="Capacidad (unidades)"
        type="number"
        value={formData.capacidadUnidades?.toString() || ''}
        onChange={(e) => handleChange('capacidadUnidades', e.target.value ? parseInt(e.target.value) : undefined)}
        placeholder="200"
      />

      {/* Configuración de viajero */}
      {formData.esViajero && (
        <div className="space-y-4 bg-purple-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-purple-800 border-b border-purple-200 pb-2">
            Configuración de Viajero
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Frecuencia de Viajes"
              value={formData.frecuenciaViaje || 'quincenal'}
              onChange={(e) => handleChange('frecuenciaViaje', e.target.value as FrecuenciaViaje)}
              options={frecuenciaOptions}
            />
            <Input
              label="Próximo Viaje"
              type="date"
              value={formData.proximoViaje ? formData.proximoViaje.toISOString().split('T')[0] : ''}
              onChange={(e) => handleChange('proximoViaje', e.target.value ? new Date(e.target.value) : undefined)}
            />
          </div>
          <Input
            label="Costo Promedio Flete (USD por unidad)"
            type="number"
            step="0.01"
            value={formData.costoPromedioFlete?.toString() || ''}
            onChange={(e) => handleChange('costoPromedioFlete', e.target.value ? parseFloat(e.target.value) : undefined)}
            placeholder="5.00"
          />
        </div>
      )}

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
        <textarea
          value={formData.notas || ''}
          onChange={(e) => handleChange('notas', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Notas adicionales..."
        />
      </div>

      {/* Botones */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Guardando...' : almacen ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  );
};
