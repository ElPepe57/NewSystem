import React, { useEffect, useState } from 'react';
import { StatCard as DSStatCard, DataTable } from '../../design-system';
import type { DataTableColumn } from '../../design-system';
import { Layers, Plus, Pencil, Package, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { Button, Modal } from '../../components/common';
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
        label="Lineas de Negocio"
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
        <DSStatCard
          label="Total lineas"
          value={totalLineas}
          icon={Layers}
         
        />
        <DSStatCard
          label="Activas"
          value={totalActivas}
          icon={CheckCircle}
         
        />
        <DSStatCard
          label="Total productos"
          value={totalProductos}
          icon={Package}
         
        />
        <DSStatCard
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
          {(() => {
            const lineaColumns: DataTableColumn<LineaNegocioType>[] = [
              {
                key: 'color',
                header: 'Color',
                render: (linea) => (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm"
                    style={{ backgroundColor: linea.color }}
                  >
                    {linea.icono || linea.codigo.slice(0, 2)}
                  </div>
                ),
              },
              {
                key: 'codigo',
                header: 'Codigo',
                render: (linea) => (
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white"
                    style={{ backgroundColor: linea.color }}
                  >
                    {linea.codigo}
                  </span>
                ),
              },
              {
                key: 'nombre',
                header: 'Nombre',
                render: (linea) => (
                  <span className="font-medium text-slate-900">{linea.nombre}</span>
                ),
              },
              {
                key: 'descripcion',
                header: 'Descripcion',
                hideOnMobile: true,
                render: (linea) => (
                  <span className="text-sm text-slate-500 max-w-xs truncate block">
                    {linea.descripcion || '-'}
                  </span>
                ),
              },
              {
                key: 'estado',
                header: 'Estado',
                align: 'center',
                render: (linea) => (
                  linea.activa ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      <CheckCircle className="h-3 w-3" />
                      Activa
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                      <XCircle className="h-3 w-3" />
                      Inactiva
                    </span>
                  )
                ),
              },
              {
                key: 'productos',
                header: 'Productos',
                align: 'center',
                hideOnMobile: true,
                render: (linea) => (
                  <span className="text-sm text-slate-700">{linea.totalProductos ?? 0}</span>
                ),
              },
              {
                key: 'unidades',
                header: 'Unidades',
                align: 'center',
                hideOnMobile: true,
                render: (linea) => (
                  <span className="text-sm text-slate-700">{linea.totalUnidadesActivas ?? 0}</span>
                ),
              },
              {
                key: 'acciones',
                header: 'Acciones',
                align: 'right',
                render: (linea) => (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleActiva(linea); }}
                      className={`p-1.5 rounded-lg transition-colors ${
                        linea.activa
                          ? 'text-emerald-600 hover:bg-emerald-50'
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
                      onClick={(e) => { e.stopPropagation(); handleEdit(linea); }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                ),
              },
            ];

            return (
              <div className="hidden md:block">
                <DataTable<LineaNegocioType>
                  columns={lineaColumns}
                  data={lineas}
                  keyExtractor={(l) => l.id}
                />
              </div>
            );
          })()}

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
                      <span className="text-emerald-600">Activa</span>
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
                        ? 'text-emerald-600 hover:bg-emerald-50'
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
        label={selectedLinea ? 'Editar linea de negocio' : 'Nueva linea de negocio'}
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
