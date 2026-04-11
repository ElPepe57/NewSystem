import React, { useEffect, useState } from 'react';
import { Package, AlertTriangle, Plus } from 'lucide-react';
import { useInsumoStore } from '../../store/insumoStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { Card, Badge, Button, Modal, Input, Select } from '../common';
import type { InsumoFormData } from '../../types/insumo.types';

const FORM_INITIAL: InsumoFormData = {
  nombre: '',
  tipo: 'caja',
  unidadMedida: 'unidad',
  stockMinimo: 10,
  costoUnitarioPEN: 0,
  proveedorNombre: '',
  proveedorContacto: '',
  activo: true,
};

const TIPOS_INSUMO = [
  { value: 'caja', label: 'Caja' },
  { value: 'bolsa', label: 'Bolsa' },
  { value: 'relleno', label: 'Relleno' },
  { value: 'cinta', label: 'Cinta' },
  { value: 'etiqueta', label: 'Etiqueta' },
  { value: 'otro', label: 'Otro' },
];

const UNIDADES_MEDIDA = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'metro', label: 'Metro' },
  { value: 'rollo', label: 'Rollo' },
  { value: 'kg', label: 'Kg' },
];

export const InsumosEmpaque: React.FC = () => {
  const { insumos, insumosStockBajo, loading, fetchInsumos, crearInsumo, actualizarInsumo } = useInsumoStore();
  const user = useAuthStore(s => s.user);
  const toast = useToastStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<InsumoFormData>(FORM_INITIAL);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInsumos();
  }, [fetchInsumos]);

  const openEdit = (insumo: any) => {
    setFormData({
      nombre: insumo.nombre,
      tipo: insumo.tipo,
      unidadMedida: insumo.unidadMedida,
      stockMinimo: insumo.stockMinimo,
      costoUnitarioPEN: insumo.costoUnitarioPEN,
      proveedorNombre: insumo.proveedorNombre || '',
      proveedorContacto: insumo.proveedorContacto || '',
      activo: insumo.activo,
    });
    setEditingId(insumo.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(FORM_INITIAL);
  };

  const handleSubmit = async () => {
    if (!user || !formData.nombre) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await actualizarInsumo(editingId, formData, user.uid);
        toast.success('Insumo actualizado');
      } else {
        await crearInsumo(formData, user.uid);
        toast.success(`Insumo ${formData.nombre} creado`);
      }
      closeForm();
    } catch (error: any) {
      toast.error(error.message, 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && insumos.length === 0) {
    return <div className="text-center py-8 text-gray-500">Cargando insumos...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Insumos de Empaque</h3>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo Insumo
        </Button>
      </div>

      {/* Alerta stock bajo */}
      {insumosStockBajo.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-medium">{insumosStockBajo.length} insumo(s) con stock bajo:</span>
            {' '}{insumosStockBajo.map(i => i.nombre).join(', ')}
          </div>
        </div>
      )}

      {/* Lista o empty state */}
      {insumos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Sin insumos registrados</p>
          <p className="text-sm mt-1">Agrega insumos de empaque (cajas, bolsas, relleno, etc.)</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {insumos.map(insumo => (
            <Card key={insumo.id} className="p-3 cursor-pointer hover:border-blue-300 transition-colors" onClick={() => openEdit(insumo)}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{insumo.nombre}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{insumo.codigo} &middot; {insumo.tipo}</div>
                </div>
                <Badge
                  variant={insumo.stockActual < insumo.stockMinimo ? 'danger' : 'success'}
                  className="text-xs"
                >
                  {insumo.stockActual} {insumo.unidadMedida}
                </Badge>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                <span>Min: {insumo.stockMinimo}</span>
                <span>S/{insumo.costoUnitarioPEN.toFixed(2)}/{insumo.unidadMedida}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal crear insumo */}
      <Modal isOpen={showForm} onClose={closeForm} title={editingId ? 'Editar Insumo' : 'Nuevo Insumo de Empaque'} size="md">
        <div className="space-y-4">
          <Input
            label="Nombre"
            placeholder="Caja peque\u00f1a 20x15x10"
            value={formData.nombre}
            onChange={e => setFormData({ ...formData, nombre: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo"
              value={formData.tipo}
              onChange={e => setFormData({ ...formData, tipo: e.target.value as any })}
              options={TIPOS_INSUMO}
            />
            <Select
              label="Unidad de medida"
              value={formData.unidadMedida}
              onChange={e => setFormData({ ...formData, unidadMedida: e.target.value as any })}
              options={UNIDADES_MEDIDA}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Stock m\u00ednimo"
              type="number"
              min={0}
              value={formData.stockMinimo}
              onChange={e => setFormData({ ...formData, stockMinimo: parseInt(e.target.value) || 0 })}
            />
            <Input
              label="Costo unitario (PEN)"
              type="number"
              min={0}
              step={0.01}
              value={formData.costoUnitarioPEN || ''}
              onChange={e => setFormData({ ...formData, costoUnitarioPEN: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <Input
            label="Proveedor (opcional)"
            placeholder="Nombre del proveedor"
            value={formData.proveedorNombre || ''}
            onChange={e => setFormData({ ...formData, proveedorNombre: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeForm}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Insumo'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
