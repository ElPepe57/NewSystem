import React, { useEffect, useState } from 'react';
import { Building2, Settings, Warehouse, User, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button, Card, Modal } from '../../components/common';
import { EmpresaForm } from '../../components/modules/configuracion/EmpresaForm';
import { ConfiguracionForm } from '../../components/modules/configuracion/ConfiguracionForm';
import { AlmacenForm } from '../../components/modules/configuracion/AlmacenForm';
import { useConfiguracionStore } from '../../store/configuracionStore';
import { useAlmacenStore } from '../../store/almacenStore';
import { useAuthStore } from '../../store/authStore';
import type { EmpresaFormData, ConfiguracionFormData } from '../../types/configuracion.types';
import type { AlmacenFormData, Almacen } from '../../types/almacen.types';

type TabType = 'empresa' | 'general' | 'almacenes' | 'perfil';

export const Configuracion: React.FC = () => {
  const user = useAuthStore(state => state.user);

  // Store de Configuración (Empresa y General)
  const {
    empresa,
    configuracion,
    loading: configLoading,
    fetchEmpresa,
    saveEmpresa,
    fetchConfiguracion,
    saveConfiguracion
  } = useConfiguracionStore();

  // Store de Almacenes
  const {
    almacenes,
    loading: almacenesLoading,
    fetchAlmacenes,
    createAlmacen,
    updateAlmacen
  } = useAlmacenStore();

  const loading = configLoading || almacenesLoading;

  const [activeTab, setActiveTab] = useState<TabType>('empresa');
  const [isAlmacenModalOpen, setIsAlmacenModalOpen] = useState(false);
  const [selectedAlmacen, setSelectedAlmacen] = useState<Almacen | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar datos al montar
  useEffect(() => {
    fetchEmpresa();
    fetchConfiguracion();
    fetchAlmacenes();
  }, [fetchEmpresa, fetchConfiguracion, fetchAlmacenes]);

  // Guardar empresa
  const handleSaveEmpresa = async (data: EmpresaFormData) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      await saveEmpresa(data, user.uid);
      alert('✅ Información de la empresa guardada correctamente');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Guardar configuración
  const handleSaveConfiguracion = async (data: ConfiguracionFormData) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      await saveConfiguracion(data, user.uid);
      alert('✅ Configuración guardada correctamente');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Crear/actualizar almacén
  const handleSaveAlmacen = async (data: AlmacenFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      if (selectedAlmacen) {
        await updateAlmacen(selectedAlmacen.id, data, user.uid);
        alert('✅ Almacén actualizado correctamente');
      } else {
        await createAlmacen(data, user.uid);
        alert('✅ Almacén creado correctamente');
      }
      setIsAlmacenModalOpen(false);
      setSelectedAlmacen(null);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir modal para editar almacén
  const handleEditAlmacen = (almacen: Almacen) => {
    setSelectedAlmacen(almacen);
    setIsAlmacenModalOpen(true);
  };

  // Abrir modal para nuevo almacén
  const handleNewAlmacen = () => {
    setSelectedAlmacen(null);
    setIsAlmacenModalOpen(true);
  };

  const tabs = [
    { id: 'empresa' as TabType, label: 'Empresa', icon: Building2 },
    { id: 'general' as TabType, label: 'General', icon: Settings },
    { id: 'almacenes' as TabType, label: 'Almacenes', icon: Warehouse },
    { id: 'perfil' as TabType, label: 'Mi Perfil', icon: User }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-600 mt-1">Administra la configuración del sistema</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center py-4 px-1 border-b-2 font-medium text-sm
                  ${isActive
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="h-5 w-5 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div>
        {/* Tab: Empresa */}
        {activeTab === 'empresa' && (
          <Card padding="lg">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Información de la Empresa</h2>
              <p className="text-sm text-gray-600 mt-1">
                Datos generales de tu empresa
              </p>
            </div>
            <EmpresaForm
              initialData={empresa || undefined}
              onSubmit={handleSaveEmpresa}
              loading={isSubmitting}
            />
          </Card>
        )}

        {/* Tab: General */}
        {activeTab === 'general' && (
          <Card padding="lg">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Configuración General</h2>
              <p className="text-sm text-gray-600 mt-1">
                Parámetros de operación del sistema
              </p>
            </div>
            {configuracion && (
              <ConfiguracionForm
                initialData={configuracion}
                onSubmit={handleSaveConfiguracion}
                loading={isSubmitting}
              />
            )}
          </Card>
        )}

        {/* Tab: Almacenes */}
        {activeTab === 'almacenes' && (
          <div className="space-y-6">
            <Card padding="md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Almacenes</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Gestiona tus ubicaciones de inventario
                  </p>
                </div>
                <Button
                  variant="primary"
                  onClick={handleNewAlmacen}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Nuevo Almacén
                </Button>
              </div>

              {almacenes.length === 0 ? (
                <div className="text-center py-12">
                  <Warehouse className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No hay almacenes</h3>
                  <p className="mt-1 text-sm text-gray-500">Comienza creando tu primer almacén</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Código
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Nombre
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          País
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Tipo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Dirección
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Contacto
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {almacenes.map((almacen) => (
                        <tr key={almacen.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {almacen.codigo}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{almacen.nombre}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm">
                              {almacen.pais === 'USA' ? '🇺🇸 USA' : '🇵🇪 Perú'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              almacen.tipo === 'viajero' ? 'bg-blue-100 text-blue-800' :
                              almacen.tipo === 'almacen_usa' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-purple-100 text-purple-800'
                            }`}>
                              {almacen.tipo === 'viajero' ? 'Viajero' :
                               almacen.tipo === 'almacen_usa' ? 'Almacén USA' : 'Almacén Perú'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-600">
                              {almacen.direccion ? `${almacen.direccion}, ${almacen.ciudad || ''}` : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{almacen.contacto || '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleEditAlmacen(almacen)}
                                className="text-primary-600 hover:text-primary-900"
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
              )}
            </Card>
          </div>
        )}

        {/* Tab: Perfil */}
        {activeTab === 'perfil' && user && (
          <Card padding="lg">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Mi Perfil</h2>
              <p className="text-sm text-gray-600 mt-1">
                Información de tu cuenta
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="h-20 w-20 rounded-full bg-primary-100 flex items-center justify-center">
                  <User className="h-10 w-10 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{user.displayName || 'Usuario'}</h3>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">UID</label>
                    <p className="text-sm text-gray-900 font-mono">{user.uid}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Rol</label>
                    <p className="text-sm text-gray-900">Administrador</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <p className="text-sm text-gray-900">{user.email}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Estado de verificación</label>
                  <p className="text-sm text-gray-900">
                    {user.emailVerified ? (
                      <span className="text-success-600">✓ Email verificado</span>
                    ) : (
                      <span className="text-warning-600">⚠ Email no verificado</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Para cambiar tu contraseña o actualizar información de la cuenta, 
                  contacta al administrador del sistema.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Modal Almacén */}
      <Modal
        isOpen={isAlmacenModalOpen}
        onClose={() => {
          setIsAlmacenModalOpen(false);
          setSelectedAlmacen(null);
        }}
        title={selectedAlmacen ? 'Editar Almacén' : 'Nuevo Almacén'}
        size="lg"
      >
        <AlmacenForm
          initialData={selectedAlmacen ? {
            ...selectedAlmacen,
            proximoViaje: selectedAlmacen.proximoViaje?.toDate()
          } : undefined}
          onSubmit={handleSaveAlmacen}
          onCancel={() => {
            setIsAlmacenModalOpen(false);
            setSelectedAlmacen(null);
          }}
          loading={isSubmitting}
        />
      </Modal>
    </div>
  );
};