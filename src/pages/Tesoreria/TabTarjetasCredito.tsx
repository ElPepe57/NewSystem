import React, { useEffect, useState } from 'react';
import { CreditCard, Plus, X } from 'lucide-react';
import { useTarjetaCreditoStore } from '../../store/tarjetaCreditoStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { Card, Badge, Button, Modal, Input, Select } from '../../components/common';
import type { TarjetaCreditoFormData } from '../../types/tarjetaCredito.types';

const FORM_INITIAL: TarjetaCreditoFormData = {
  nombre: '',
  banco: '',
  ultimosDigitos: '',
  moneda: 'USD',
  limiteUSD: 0,
  diaCorte: 15,
  diaPago: 5,
  activa: true,
};

export const TabTarjetasCredito: React.FC = () => {
  const { tarjetas, tarjetasActivas, saldoTotalUSD, loading, fetchTarjetas, crearTarjeta, actualizarTarjeta } = useTarjetaCreditoStore();
  const user = useAuthStore(s => s.user);
  const toast = useToastStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TarjetaCreditoFormData>(FORM_INITIAL);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTarjetas();
  }, [fetchTarjetas]);

  const openEdit = (tarjeta: any) => {
    setFormData({
      nombre: tarjeta.nombre,
      banco: tarjeta.banco,
      ultimosDigitos: tarjeta.ultimosDigitos,
      moneda: tarjeta.moneda || 'USD',
      limiteUSD: tarjeta.limiteUSD,
      diaCorte: tarjeta.diaCorte,
      diaPago: tarjeta.diaPago,
      activa: tarjeta.activa,
    });
    setEditingId(tarjeta.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(FORM_INITIAL);
  };

  const handleSubmit = async () => {
    if (!user || !formData.nombre || !formData.banco || !formData.ultimosDigitos) {
      toast.error('Completa todos los campos obligatorios');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await actualizarTarjeta(editingId, formData, user.uid);
        toast.success('Tarjeta actualizada');
      } else {
        await crearTarjeta(formData, user.uid);
        toast.success(`Tarjeta ${formData.nombre} creada`);
      }
      closeForm();
    } catch (error: any) {
      toast.error(error.message, 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header con boton crear */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Tarjetas de Cr\u00e9dito</h3>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nueva Tarjeta
        </Button>
      </div>

      {/* Resumen */}
      {tarjetas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <div className="text-xs text-gray-500">Tarjetas activas</div>
            <div className="text-2xl font-bold text-gray-900">{tarjetasActivas.length}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-xs text-gray-500">Saldo adeudado</div>
            <div className="text-2xl font-bold text-red-600">${saldoTotalUSD.toFixed(2)}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-xs text-gray-500">Disponible total</div>
            <div className="text-2xl font-bold text-green-600">
              ${tarjetasActivas.reduce((s, t) => s + t.disponibleUSD, 0).toFixed(2)}
            </div>
          </Card>
        </div>
      )}

      {/* Lista o empty state */}
      {tarjetas.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Sin tarjetas registradas</p>
          <p className="text-sm mt-1">Agrega tu primera tarjeta para registrar compras como pasivos.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tarjetas.map(tarjeta => {
            const uso = tarjeta.limiteUSD > 0 ? (tarjeta.saldoActualUSD / tarjeta.limiteUSD) * 100 : 0;
            return (
              <Card key={tarjeta.id} className="p-4 cursor-pointer hover:border-blue-300 transition-colors" onClick={() => openEdit(tarjeta)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <CreditCard className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{tarjeta.nombre}</div>
                      <div className="text-xs text-gray-500">{tarjeta.banco} &middot; ****{tarjeta.ultimosDigitos}</div>
                    </div>
                  </div>
                  <Badge variant={tarjeta.activa ? 'success' : 'secondary'} className="text-xs">
                    {tarjeta.activa ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Usado: ${tarjeta.saldoActualUSD.toFixed(2)}</span>
                    <span>L\u00edmite: ${tarjeta.limiteUSD.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${uso > 80 ? 'bg-red-500' : uso > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(uso, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1 text-right">
                    Disponible: ${tarjeta.disponibleUSD.toFixed(2)}
                  </div>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-gray-400">
                  <span>Corte: d\u00eda {tarjeta.diaCorte}</span>
                  <span>Pago: d\u00eda {tarjeta.diaPago}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal crear tarjeta */}
      <Modal isOpen={showForm} onClose={closeForm} title={editingId ? 'Editar Tarjeta' : 'Nueva Tarjeta de Cr\u00e9dito'} size="md">
        <div className="space-y-4">
          <Input
            label="Nombre"
            placeholder="Visa BBVA ****6411"
            value={formData.nombre}
            onChange={e => setFormData({ ...formData, nombre: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Banco"
              placeholder="BBVA, BCP, Interbank..."
              value={formData.banco}
              onChange={e => setFormData({ ...formData, banco: e.target.value })}
              required
            />
            <Input
              label="\u00daltimos 4 d\u00edgitos"
              placeholder="6411"
              maxLength={4}
              value={formData.ultimosDigitos}
              onChange={e => setFormData({ ...formData, ultimosDigitos: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="L\u00edmite USD"
              type="number"
              min={0}
              value={formData.limiteUSD || ''}
              onChange={e => setFormData({ ...formData, limiteUSD: parseFloat(e.target.value) || 0 })}
              required
            />
            <Input
              label="D\u00eda corte"
              type="number"
              min={1}
              max={31}
              value={formData.diaCorte}
              onChange={e => setFormData({ ...formData, diaCorte: parseInt(e.target.value) || 15 })}
            />
            <Input
              label="D\u00eda pago"
              type="number"
              min={1}
              max={31}
              value={formData.diaPago}
              onChange={e => setFormData({ ...formData, diaPago: parseInt(e.target.value) || 5 })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeForm}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Tarjeta'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
