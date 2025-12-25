import React, { useEffect, useState } from "react";
import {
  Warehouse,
  MapPin,
  Package,
  Download,
  Plus,
  Users,
  Plane,
  Calendar,
  DollarSign,
  TrendingUp,
  ChevronRight,
  RefreshCw,
  Calculator
} from "lucide-react";
import { Button, Card, Badge, Modal } from "../../components/common";
import { useAlmacenStore } from "../../store/almacenStore";
import { useAuthStore } from "../../store/authStore";
import type { Almacen, AlmacenFormData } from "../../types/almacen.types";
import { AlmacenForm } from "../../components/modules/almacen/AlmacenForm";
import { unidadService } from "../../services/unidad.service";

export const Almacenes: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const {
    almacenes,
    almacenesUSA,
    almacenesPeru,
    viajeros,
    resumenUSA,
    loading,
    fetchAlmacenes,
    fetchAlmacenesUSA,
    fetchAlmacenesPeru,
    fetchViajeros,
    fetchResumenUSA,
    createAlmacen,
    updateAlmacen,
    seedDefaultAlmacenes
  } = useAlmacenStore();

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingAlmacen, setEditingAlmacen] = useState<Almacen | null>(null);
  const [activeTab, setActiveTab] = useState<'usa' | 'peru'>('usa');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRecalculatingFlete, setIsRecalculatingFlete] = useState(false);

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchAlmacenes(),
        fetchAlmacenesUSA(),
        fetchAlmacenesPeru(),
        fetchViajeros(),
        fetchResumenUSA()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleSeedAlmacenes = async () => {
    if (!user) return;

    if (!confirm("¿Deseas crear los almacenes por defecto (Viajero USA y Almacén Perú)?")) {
      return;
    }

    try {
      await seedDefaultAlmacenes(user.uid);
      alert("Almacenes creados correctamente");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert("Error: " + message);
    }
  };

  const handleRecalcularCostosFlete = async () => {
    if (!window.confirm(
      "¿Recalcular costos de flete?\n\n" +
      "Esto buscará unidades en Perú que no tengan costo de flete registrado " +
      "y lo recuperará desde las transferencias USA→Perú correspondientes.\n\n" +
      "Es útil para corregir discrepancias en costos de ventas."
    )) {
      return;
    }

    setIsRecalculatingFlete(true);
    try {
      const resultado = await unidadService.recalcularCostosFlete();

      if (resultado.unidadesSinFlete === 0) {
        alert("Todas las unidades ya tienen su costo de flete correctamente asignado.");
      } else if (resultado.unidadesActualizadas === 0) {
        alert(
          `Se encontraron ${resultado.unidadesSinFlete} unidades sin costo de flete, ` +
          "pero no se encontraron datos de transferencia para actualizarlas.\n\n" +
          "Puede que las transferencias no tengan registrado el costo de flete."
        );
      } else {
        alert(
          `Recálculo completado:\n\n` +
          `• Unidades sin flete encontradas: ${resultado.unidadesSinFlete}\n` +
          `• Unidades actualizadas: ${resultado.unidadesActualizadas}\n` +
          `• Errores: ${resultado.errores}\n\n` +
          "Los costos de las próximas ventas usarán los valores corregidos."
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert("Error al recalcular: " + message);
    } finally {
      setIsRecalculatingFlete(false);
    }
  };

  const handleCreateAlmacen = async (data: AlmacenFormData) => {
    if (!user) return;
    try {
      await createAlmacen(data, user.uid);
      setShowFormModal(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert("Error al crear: " + message);
    }
  };

  const handleUpdateAlmacen = async (data: AlmacenFormData) => {
    if (!user || !editingAlmacen) return;
    try {
      await updateAlmacen(editingAlmacen.id, data, user.uid);
      setEditingAlmacen(null);
      setShowFormModal(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert("Error al actualizar: " + message);
    }
  };

  const openCreateModal = () => {
    setEditingAlmacen(null);
    setShowFormModal(true);
  };

  const openEditModal = (almacen: Almacen) => {
    setEditingAlmacen(almacen);
    setShowFormModal(true);
  };

  // Componente para mostrar una tarjeta de viajero
  const ViajeroCard = ({ viajero }: { viajero: Almacen }) => {
    const proximoViaje = viajero.proximoViaje?.toDate();
    const diasParaViaje = proximoViaje
      ? Math.ceil((proximoViaje.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    return (
      <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => openEditModal(viajero)}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{viajero.nombre}</h3>
              <p className="text-sm text-gray-500">{viajero.codigo}</p>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-1">
            <Badge variant={viajero.estadoAlmacen === "activo" ? "success" : "default"}>
              {viajero.estadoAlmacen === "activo" ? "Activo" : "Inactivo"}
            </Badge>
            <Badge variant="info">Viajero</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center text-gray-500 text-xs mb-1">
              <Package className="h-3 w-3 mr-1" />
              Unidades
            </div>
            <div className="text-xl font-bold text-gray-900">
              {viajero.unidadesActuales || 0}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center text-gray-500 text-xs mb-1">
              <DollarSign className="h-3 w-3 mr-1" />
              Valor USD
            </div>
            <div className="text-xl font-bold text-green-600">
              ${(viajero.valorInventarioUSD || 0).toFixed(0)}
            </div>
          </div>
        </div>

        {proximoViaje && (
          <div className={`flex items-center justify-between p-3 rounded-lg ${diasParaViaje && diasParaViaje <= 7 ? 'bg-amber-50' : 'bg-blue-50'}`}>
            <div className="flex items-center space-x-2">
              <Plane className={`h-4 w-4 ${diasParaViaje && diasParaViaje <= 7 ? 'text-amber-600' : 'text-blue-600'}`} />
              <span className="text-sm font-medium">Próximo viaje</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold">
                {proximoViaje.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
              </div>
              {diasParaViaje !== null && (
                <div className={`text-xs ${diasParaViaje <= 7 ? 'text-amber-600' : 'text-blue-600'}`}>
                  {diasParaViaje === 0 ? 'Hoy' : diasParaViaje === 1 ? 'Mañana' : `En ${diasParaViaje} días`}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t space-y-2">
          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-2 text-gray-400" />
            {viajero.ciudad}, {viajero.estado}
          </div>
          {viajero.frecuenciaViaje && (
            <div className="flex items-center text-sm text-gray-600">
              <Calendar className="h-4 w-4 mr-2 text-gray-400" />
              Viajes: {viajero.frecuenciaViaje}
            </div>
          )}
          {viajero.whatsapp && (
            <div className="flex items-center text-sm text-green-600">
              <span className="mr-2">📱</span>
              {viajero.whatsapp}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
      </Card>
    );
  };

  // Componente para almacén regular (no viajero)
  const AlmacenCard = ({ almacen }: { almacen: Almacen }) => (
    <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => openEditModal(almacen)}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
            almacen.pais === 'USA' ? 'bg-blue-100' : 'bg-red-100'
          }`}>
            <Warehouse className={`h-6 w-6 ${
              almacen.pais === 'USA' ? 'text-blue-600' : 'text-red-600'
            }`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{almacen.nombre}</h3>
            <p className="text-sm text-gray-500">{almacen.codigo}</p>
          </div>
        </div>
        <Badge variant={almacen.estadoAlmacen === "activo" ? "success" : "default"}>
          {almacen.estadoAlmacen === "activo" ? "Activo" : "Inactivo"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center text-gray-500 text-xs mb-1">
            <Package className="h-3 w-3 mr-1" />
            Unidades
          </div>
          <div className="text-xl font-bold text-gray-900">
            {almacen.unidadesActuales || 0}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center text-gray-500 text-xs mb-1">
            <TrendingUp className="h-3 w-3 mr-1" />
            Capacidad
          </div>
          <div className="text-xl font-bold text-gray-900">
            {almacen.capacidadUnidades || '-'}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-start space-x-2">
          <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-600">
            <div>{almacen.direccion}</div>
            <div>{almacen.ciudad}, {almacen.estado}</div>
          </div>
        </div>

        {almacen.contacto && (
          <div className="pt-3 border-t">
            <div className="text-xs text-gray-500 mb-1">Contacto</div>
            <div className="text-sm font-medium text-gray-900">{almacen.contacto}</div>
            {almacen.telefono && (
              <div className="text-sm text-gray-600">{almacen.telefono}</div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Almacenes y Viajeros</h1>
          <p className="text-gray-600 mt-1">
            Gestiona viajeros en USA y almacenes de inventario
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="ghost"
            onClick={handleRecalcularCostosFlete}
            disabled={isRecalculatingFlete || loading}
            title="Recalcular costos de flete faltantes en unidades"
          >
            <Calculator className={`h-5 w-5 ${isRecalculatingFlete ? 'animate-pulse' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            onClick={refreshData}
            disabled={isRefreshing || loading}
            title="Actualizar datos"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          {almacenes.length === 0 && !loading && (
            <Button variant="secondary" onClick={handleSeedAlmacenes}>
              <Download className="h-5 w-5 mr-2" />
              Crear por Defecto
            </Button>
          )}
          <Button variant="primary" onClick={openCreateModal}>
            <Plus className="h-5 w-5 mr-2" />
            Nuevo Viajero/Almacén
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Viajeros Activos</div>
              <div className="text-2xl font-bold text-purple-600 mt-1">
                {viajeros.length}
              </div>
            </div>
            <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Unidades en USA</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {resumenUSA?.totalUnidadesUSA || 0}
              </div>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Valor USA</div>
              <div className="text-2xl font-bold text-green-600 mt-1">
                ${(resumenUSA?.valorTotalUSA_USD || 0).toLocaleString()}
              </div>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Almacenes Perú</div>
              <div className="text-2xl font-bold text-red-600 mt-1">
                {almacenesPeru.length}
              </div>
            </div>
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
              <Warehouse className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('usa')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'usa'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="mr-2">🇺🇸</span>
            USA ({almacenesUSA.length})
          </button>
          <button
            onClick={() => setActiveTab('peru')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'peru'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="mr-2">🇵🇪</span>
            Perú ({almacenesPeru.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : almacenes.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay viajeros ni almacenes registrados
            </h3>
            <p className="text-gray-600 mb-6">
              Crea un viajero para empezar a gestionar tu inventario en USA
            </p>
            <div className="flex justify-center space-x-4">
              <Button variant="secondary" onClick={handleSeedAlmacenes}>
                <Download className="h-5 w-5 mr-2" />
                Crear por Defecto
              </Button>
              <Button variant="primary" onClick={openCreateModal}>
                <Plus className="h-5 w-5 mr-2" />
                Crear Viajero
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {activeTab === 'usa' && (
            <div className="space-y-6">
              {/* Viajeros */}
              {viajeros.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <Users className="h-5 w-5 mr-2 text-purple-600" />
                    Viajeros
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {viajeros.map(viajero => (
                      <ViajeroCard key={viajero.id} viajero={viajero} />
                    ))}
                  </div>
                </div>
              )}

              {/* Otros almacenes USA (no viajeros) */}
              {almacenesUSA.filter(a => !a.esViajero).length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <Warehouse className="h-5 w-5 mr-2 text-blue-600" />
                    Almacenes USA
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {almacenesUSA.filter(a => !a.esViajero).map(almacen => (
                      <AlmacenCard key={almacen.id} almacen={almacen} />
                    ))}
                  </div>
                </div>
              )}

              {almacenesUSA.length === 0 && (
                <Card padding="lg">
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No hay viajeros ni almacenes en USA</p>
                    <Button variant="primary" onClick={openCreateModal} className="mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      Crear Viajero
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'peru' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Warehouse className="h-5 w-5 mr-2 text-red-600" />
                Almacenes Perú
              </h2>
              {almacenesPeru.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {almacenesPeru.map(almacen => (
                    <AlmacenCard key={almacen.id} almacen={almacen} />
                  ))}
                </div>
              ) : (
                <Card padding="lg">
                  <div className="text-center py-8">
                    <Warehouse className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No hay almacenes en Perú</p>
                    <Button variant="primary" onClick={openCreateModal} className="mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      Crear Almacén
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal de creación/edición */}
      <Modal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingAlmacen(null);
        }}
        title={editingAlmacen ? "Editar Almacén/Viajero" : "Nuevo Almacén/Viajero"}
        size="lg"
      >
        <AlmacenForm
          almacen={editingAlmacen || undefined}
          onSubmit={editingAlmacen ? handleUpdateAlmacen : handleCreateAlmacen}
          onCancel={() => {
            setShowFormModal(false);
            setEditingAlmacen(null);
          }}
          loading={loading}
        />
      </Modal>
    </div>
  );
};
