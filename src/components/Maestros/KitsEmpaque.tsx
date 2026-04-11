import React, { useEffect, useState } from 'react';
import { Package, Plus, ChevronRight } from 'lucide-react';
import { useInsumoStore } from '../../store/insumoStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { kitEmpaqueService } from '../../services/kitEmpaque.service';
import { Card, Badge, Button, Modal, Input } from '../common';
import type { KitEmpaque, KitEmpaqueFormData } from '../../types/kitEmpaque.types';

interface ComponenteForm {
  insumoId: string;
  insumoNombre: string;
  cantidad: number;
}

export const KitsEmpaque: React.FC = () => {
  const { insumos, fetchInsumos } = useInsumoStore();
  const user = useAuthStore(s => s.user);
  const toast = useToastStore();

  const [kits, setKits] = useState<KitEmpaque[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [nombre, setNombre] = useState('');
  const [pesoMinLb, setPesoMinLb] = useState(0);
  const [pesoMaxLb, setPesoMaxLb] = useState(1);
  const [componentes, setComponentes] = useState<ComponenteForm[]>([]);

  const openEdit = (kit: KitEmpaque) => {
    setNombre(kit.nombre);
    setPesoMinLb(kit.pesoMinLb);
    setPesoMaxLb(kit.pesoMaxLb);
    setComponentes(kit.componentes.map(c => ({
      insumoId: c.insumoId,
      insumoNombre: c.insumoNombre,
      cantidad: c.cantidad,
    })));
    setEditingId(kit.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setNombre('');
    setPesoMinLb(0);
    setPesoMaxLb(1);
    setComponentes([]);
  };

  const fetchKits = async () => {
    try {
      const data = await kitEmpaqueService.getAll();
      setKits(data);
    } catch { /* silenciar */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKits();
    fetchInsumos();
  }, [fetchInsumos]);

  const handleAddComponente = () => {
    if (insumos.length === 0) {
      toast.error('Primero agrega insumos de empaque');
      return;
    }
    const primerInsumo = insumos[0];
    setComponentes([...componentes, {
      insumoId: primerInsumo.id,
      insumoNombre: primerInsumo.nombre,
      cantidad: 1,
    }]);
  };

  const handleRemoveComponente = (index: number) => {
    setComponentes(componentes.filter((_, i) => i !== index));
  };

  const handleComponenteChange = (index: number, field: string, value: any) => {
    const updated = [...componentes];
    if (field === 'insumoId') {
      const insumo = insumos.find(i => i.id === value);
      updated[index] = { ...updated[index], insumoId: value, insumoNombre: insumo?.nombre || '' };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setComponentes(updated);
  };

  const handleSubmit = async () => {
    if (!user || !nombre || componentes.length === 0) {
      toast.error('Nombre y al menos 1 componente son obligatorios');
      return;
    }
    if (pesoMinLb >= pesoMaxLb) {
      toast.error('Peso m\u00ednimo debe ser menor al m\u00e1ximo');
      return;
    }

    setSubmitting(true);
    try {
      const data: KitEmpaqueFormData = {
        nombre,
        pesoMinLb,
        pesoMaxLb,
        componentes: componentes.map(c => ({ insumoId: c.insumoId, cantidad: c.cantidad })),
        activo: true,
      };
      if (editingId) {
        await kitEmpaqueService.actualizar(editingId, data, user.uid);
        toast.success('Kit actualizado');
      } else {
        await kitEmpaqueService.crear(data, user.uid);
        toast.success(`Kit ${nombre} creado`);
      }
      closeForm();
      await fetchKits();
    } catch (error: any) {
      toast.error(error.message, 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Cargando kits...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Kits de Empaque</h3>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo Kit
        </Button>
      </div>

      {kits.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Sin kits de empaque</p>
          <p className="text-sm mt-1">Los kits se seleccionan autom\u00e1ticamente por peso al despachar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {kits.map(kit => (
            <Card key={kit.id} className="p-4 cursor-pointer hover:border-blue-300 transition-colors" onClick={() => openEdit(kit)}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-gray-900">{kit.nombre}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {kit.codigo} &middot; {kit.pesoMinLb}-{kit.pesoMaxLb} lb
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={kit.activo ? 'success' : 'secondary'} className="text-xs">
                    {kit.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <div className="text-sm font-bold text-gray-900 mt-1">
                    S/{kit.costoTotalPEN.toFixed(2)}
                  </div>
                </div>
              </div>
              {kit.componentes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {kit.componentes.map((comp, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                      <ChevronRight className="h-3 w-3 text-gray-300" />
                      <span>{comp.insumoNombre}</span>
                      <span className="text-gray-400">x{comp.cantidad}</span>
                      <span className="text-gray-400 ml-auto">S/{(comp.costoUnitarioPEN * comp.cantidad).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal crear kit */}
      <Modal isOpen={showForm} onClose={closeForm} title={editingId ? 'Editar Kit' : 'Nuevo Kit de Empaque'} size="md">
        <div className="space-y-4">
          <Input
            label="Nombre del kit"
            placeholder="Kit peque\u00f1o (0-1 lb)"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Peso m\u00ednimo (lb)"
              type="number"
              min={0}
              step={0.1}
              value={pesoMinLb}
              onChange={e => setPesoMinLb(parseFloat(e.target.value) || 0)}
            />
            <Input
              label="Peso m\u00e1ximo (lb)"
              type="number"
              min={0}
              step={0.1}
              value={pesoMaxLb}
              onChange={e => setPesoMaxLb(parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Componentes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Componentes</label>
              <button
                type="button"
                onClick={handleAddComponente}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                + Agregar insumo
              </button>
            </div>
            {componentes.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3 border border-dashed rounded">
                Agrega insumos al kit
              </p>
            ) : (
              <div className="space-y-2">
                {componentes.map((comp, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      className="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5"
                      value={comp.insumoId}
                      onChange={e => handleComponenteChange(i, 'insumoId', e.target.value)}
                    >
                      {insumos.map(ins => (
                        <option key={ins.id} value={ins.id}>{ins.nombre} (S/{ins.costoUnitarioPEN.toFixed(2)})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      className="w-16 text-sm border border-gray-300 rounded px-2 py-1.5 text-center"
                      value={comp.cantidad}
                      onChange={e => handleComponenteChange(i, 'cantidad', parseInt(e.target.value) || 1)}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveComponente(i)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeForm}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting || componentes.length === 0}>
              {submitting ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Kit'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
