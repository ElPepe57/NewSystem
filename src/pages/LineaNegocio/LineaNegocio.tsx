import React, { useEffect, useState } from 'react';
import { Layers, Plus, Pencil, Package, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { Button, Modal, StatCard } from '../../components/common';
import { PageShell, PageHeader } from '../../design-system';
import { LineaNegocioForm } from '../../components/modules/lineaNegocio/LineaNegocioForm';
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import type { LineaNegocio as LineaNegocioType, LineaNegocioFormData } from '../../types/lineaNegocio.types';

export const LineaNegocio: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const toast = useToastStore();

  const {
    lineas,
    loading,
    fetchLineas,
    create,
    update,
  } = useLineaNegocioStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLinea, setSelectedLinea] = useState<LineaNegocioType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchLineas();
  }, [fetchLineas]);

  // Stats
  const totalLineas = lineas.length;
  const totalActivas = lineas.filter(l => l.activa).length;
  const totalProductos = lineas.reduce((sum, l) => sum + (l.totalProductos || 0), 0);
  const totalVentasMes = lineas.reduce((sum, l) => sum + (l.ventasMesActualPEN || 0), 0);

  // CRUD handlers
  const handleCreate = async (data: LineaNegocioFormData) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await create(data, user.uid);
      toast.success('Linea de negocio creada');
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error(error.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (data: LineaNegocioFormData) => {
    if (!user || !selectedLinea) return;
    setIsSubmitting(true);
    try {
      await update(selectedLinea.id, data, user.uid);
      toast.success('Linea de negocio actualizada');
      setIsModalOpen(false);
      setSelectedLinea(null);
    } catch (error: any) {
      toast.error(error.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActiva = async (linea: LineaNegocioType) => {
    if (!user) return;
    try {
      await update(linea.id, { activa: !linea.activa }, user.uid);
      toast.success(
        linea.activa ? 'Linea desactivada' : 'Linea activada'
      );
    } catch (error: any) {
      toast.error(error.message, 'Error');
    }
  };

  const handleEdit = (linea: LineaNegocioType) => {
    setSelectedLinea(linea);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setSelectedLinea(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedLinea(null);
  };

  return (
    <PageShell>
      {/* Header */}
      <PageHeader
        title="Lineas de Negocio"
        subtitle="Gestiona las lineas de tu negocio"
        icon={Layers}
       
        actions={
          <Button
            onClick={handleNew}
            className="bg-white/20 hover:bg-white/30 text-white border-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva linea
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total lineas"
          value={totalLineas}
          icon={Layers}
         
        />
        <StatCard
          label="Activas"
          value={totalActivas}
          icon={CheckCircle}
         
        />
        <StatCard
          label="Total productos"
          value={totalProductos}
          icon={Package}
         
        />
        <StatCard
          label="Ventas del mes"
          value={`S/ ${totalVentasMes.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
          variant="amber"
        />
      </div>

      {/* Table / Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
        </div>
      ) : lineas.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <Layers className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-4">No hay lineas de negocio registradas</p>
          <Button onClick={handleNew} variant="primary" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Crear primera linea
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Color</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Codigo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Descripcion</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Estado</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Productos</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Unidades</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lineas.map((linea) => (
                  <tr key={linea.id} className="hover:bg-slate-50 transition-colors">
                    {/* Color swatch + icon */}
                    <td className="px-4 py-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm"
                        style={{ backgroundColor: linea.color }}
                      >
                        {linea.icono || linea.codigo.slice(0, 2)}
                      </div>
                    </td>
                    {/* Codigo */}
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white"
                        style={{ backgroundColor: linea.color }}
                      >
                        {linea.codigo}
                      </span>
                    </td>
                    {/* Nombre */}
                    <td className="px-4 py-3 font-medium text-slate-900">{linea.nombre}</td>
                    {/* Descripcion */}
                    <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">
                      {linea.descripcion || '-'}
                    </td>
                    {/* Estado */}
                    <td className="px-4 py-3 text-center">
                      {linea.activa ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle className="h-3 w-3" />
                          Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                          <XCircle className="h-3 w-3" />
                          Inactiva
                        </span>
                      )}
                    </td>
                    {/* Productos */}
                    <td className="px-4 py-3 text-center text-sm text-slate-700">
                      {linea.totalProductos ?? 0}
                    </td>
                    {/* Unidades */}
                    <td className="px-4 py-3 text-center text-sm text-slate-700">
                      {linea.totalUnidadesActivas ?? 0}
                    </td>
                    {/* Acciones */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleActiva(linea)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            linea.activa
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-slate-400 hover:bg-slate-100'
                          }`}
                          title={linea.activa ? 'Desactivar' : 'Activar'}
                        >
                          {linea.activa ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(linea)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {lineas.map((linea) => (
              <div key={linea.id} className="p-4 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm flex-shrink-0"
                  style={{ backgroundColor: linea.color }}
                >
                  {linea.icono || linea.codigo.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 truncate">{linea.nombre}</p>
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: linea.color }}
                    >
                      {linea.codigo}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                    {linea.activa ? (
                      <span className="text-green-600">Activa</span>
                    ) : (
                      <span className="text-slate-400">Inactiva</span>
                    )}
                    <span>{linea.totalProductos ?? 0} productos</span>
                    <span>{linea.totalUnidadesActivas ?? 0} uds</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggleActiva(linea)}
                    className={`p-2 rounded-lg ${
                      linea.activa
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {linea.activa ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(linea)}
                    className="p-2 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={selectedLinea ? 'Editar linea de negocio' : 'Nueva linea de negocio'}
        size="sm"
      >
        <LineaNegocioForm
          initialData={selectedLinea}
          onSubmit={selectedLinea ? handleUpdate : handleCreate}
          onCancel={handleCloseModal}
          isSubmitting={isSubmitting}
        />
      </Modal>
    </PageShell>
  );
};
