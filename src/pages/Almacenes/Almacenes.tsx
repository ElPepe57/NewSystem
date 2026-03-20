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
  Phone,
  RefreshCw,
  Calculator
} from "lucide-react";
import {
  Button,
  Modal,
  GradientHeader,
  StatCard,
  EntityCard,
  TabNavigation,
  SectionHeader,
  EmptyState,
  HighlightBox,
  useConfirmDialog,
  ConfirmDialog
} from "../../components/common";
import { useAlmacenStore } from "../../store/almacenStore";
import { useAuthStore } from "../../store/authStore";
import type { Almacen, AlmacenFormData } from "../../types/almacen.types";
import { AlmacenForm } from "../../components/modules/almacen/AlmacenForm";
import { unidadService } from "../../services/unidad.service";
import { getPaisEmoji } from "../../utils/multiOrigen.helpers";

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

  // Hook para dialogo de confirmacion
  const { dialogProps, confirm } = useConfirmDialog();

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

    const confirmed = await confirm({
      title: 'Crear Almacenes por Defecto',
      message: '¿Deseas crear los almacenes por defecto (Almacenes de origen y destino)?',
      confirmText: 'Crear',
      variant: 'info'
    });
    if (!confirmed) return;

    try {
      await seedDefaultAlmacenes(user.uid);
      alert("Almacenes creados correctamente");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert("Error: " + message);
    }
  };

  const handleRecalcularCostosFlete = async () => {
    const confirmed = await confirm({
      title: 'Recalcular Costos de Flete',
      message: (
        <div className="space-y-2">
          <p>Esto buscara unidades en Peru que no tengan costo de flete registrado y lo recuperara desde las transferencias internacionales correspondientes.</p>
          <p className="text-sm text-gray-500">Es util para corregir discrepancias en costos de ventas.</p>
        </div>
      ),
      confirmText: 'Recalcular',
      variant: 'warning'
    });
    if (!confirmed) return;

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

  // Componente para mostrar una tarjeta de viajero profesional
  const ViajeroCardPro = ({ viajero }: { viajero: Almacen }) => {
    const proximoViaje = viajero.proximoViaje?.toDate();
    const diasParaViaje = proximoViaje
      ? Math.ceil((proximoViaje.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    const tags = [
      { label: viajero.estadoAlmacen === "activo" ? "Activo" : "Inactivo", variant: viajero.estadoAlmacen === "activo" ? "success" as const : "default" as const },
      { label: "Viajero", variant: "info" as const }
    ];

    const stats = [
      { label: "Unidades", value: viajero.unidadesActuales || 0, icon: Package },
      { label: "Valor USD", value: `$${(viajero.valorInventarioUSD || 0).toLocaleString()}`, icon: DollarSign }
    ];

    const details = [
      { icon: MapPin, text: `${viajero.ciudad}, ${viajero.estado}` },
      ...(viajero.frecuenciaViaje ? [{ icon: Calendar, text: `Viajes: ${viajero.frecuenciaViaje}` }] : []),
      ...(viajero.whatsapp ? [{ icon: Phone, text: viajero.whatsapp, highlight: true }] : [])
    ];

    const highlightContent = proximoViaje ? (
      <HighlightBox
        icon={Plane}
        label="Próximo viaje"
        value={proximoViaje.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
        subValue={diasParaViaje !== null ? (diasParaViaje === 0 ? 'Hoy' : diasParaViaje === 1 ? 'Mañana' : `En ${diasParaViaje} días`) : undefined}
        variant={diasParaViaje !== null && diasParaViaje <= 7 ? 'warning' : 'info'}
      />
    ) : undefined;

    return (
      <EntityCard
        name={viajero.nombre}
        code={viajero.codigo}
        variant="viajero"
        status={viajero.estadoAlmacen === "activo" ? "active" : "inactive"}
        stats={stats}
        tags={tags}
        details={details}
        onClick={() => openEditModal(viajero)}
        highlight={highlightContent}
      />
    );
  };

  // Componente para almacén regular profesional
  const AlmacenCardPro = ({ almacen }: { almacen: Almacen }) => {
    const variant = almacen.pais === 'USA' ? 'almacen-usa' : 'almacen-peru';

    const tags = [
      { label: almacen.estadoAlmacen === "activo" ? "Activo" : "Inactivo", variant: almacen.estadoAlmacen === "activo" ? "success" as const : "default" as const },
      { label: `${getPaisEmoji(almacen.pais)} ${almacen.pais}`, variant: almacen.pais === 'Peru' ? "warning" as const : "info" as const }
    ];

    const stats = [
      { label: "Unidades", value: almacen.unidadesActuales || 0, icon: Package },
      { label: "Capacidad", value: almacen.capacidadUnidades || '-', icon: TrendingUp }
    ];

    const details = [
      { icon: MapPin, text: `${almacen.direccion || ''} ${almacen.ciudad}, ${almacen.estado}` },
      ...(almacen.contacto ? [{ icon: Users, text: almacen.contacto }] : []),
      ...(almacen.telefono ? [{ icon: Phone, text: almacen.telefono }] : [])
    ];

    return (
      <EntityCard
        name={almacen.nombre}
        code={almacen.codigo}
        variant={variant}
        status={almacen.estadoAlmacen === "activo" ? "active" : "inactive"}
        stats={stats}
        tags={tags}
        details={details}
        onClick={() => openEditModal(almacen)}
      />
    );
  };

  // Tabs configuration
  const tabs = [
    { id: 'usa', label: 'USA', emoji: '🇺🇸', count: almacenesUSA.length },
    { id: 'peru', label: 'Perú', emoji: '🇵🇪', count: almacenesPeru.length }
  ];

  return (
    <div className="space-y-6">
      {/* Header Profesional con Gradiente */}
      <GradientHeader
        title="Almacenes y Viajeros"
        subtitle="Gestiona viajeros, couriers y almacenes"
        icon={Warehouse}
        variant="dark"
        actions={
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              onClick={handleRecalcularCostosFlete}
              disabled={isRecalculatingFlete || loading}
              title="Recalcular costos de flete faltantes"
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <Calculator className={`h-5 w-5 ${isRecalculatingFlete ? 'animate-pulse' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              onClick={refreshData}
              disabled={isRefreshing || loading}
              title="Actualizar datos"
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            {almacenes.length === 0 && !loading && (
              <Button variant="secondary" onClick={handleSeedAlmacenes} className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                <Download className="h-5 w-5 mr-2" />
                Crear por Defecto
              </Button>
            )}
            <Button variant="primary" onClick={openCreateModal} className="bg-white text-slate-800 hover:bg-gray-100">
              <Plus className="h-5 w-5 mr-2" />
              Nuevo
            </Button>
          </div>
        }
        stats={[
          { label: 'Viajeros Activos', value: viajeros.length },
          { label: 'Unidades Origen', value: resumenUSA?.totalUnidadesUSA || 0 },
          { label: 'Valor Origen', value: `$${(resumenUSA?.valorTotalUSA_USD || 0).toLocaleString()}` },
          { label: 'Almacenes Perú', value: almacenesPeru.length }
        ]}
      />

      {/* KPIs Navegables */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Viajeros Activos"
          value={viajeros.length}
          icon={Users}
          variant="purple"
          onClick={() => setActiveTab('usa')}
          active={activeTab === 'usa'}
        />
        <StatCard
          label="Unidades en Origen"
          value={resumenUSA?.totalUnidadesUSA || 0}
          icon={Package}
          variant="blue"
          onClick={() => setActiveTab('usa')}
        />
        <StatCard
          label="Valor Inventario Origen"
          value={`$${(resumenUSA?.valorTotalUSA_USD || 0).toLocaleString()}`}
          icon={DollarSign}
          variant="green"
        />
        <StatCard
          label="Almacenes Perú"
          value={almacenesPeru.length}
          icon={Warehouse}
          variant="red"
          onClick={() => setActiveTab('peru')}
          active={activeTab === 'peru'}
        />
      </div>

      {/* Tabs Profesionales */}
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as 'usa' | 'peru')}
        variant="pills"
      />

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : almacenes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay almacenes registrados"
          description="Crea un viajero o almacén para empezar a gestionar tu inventario"
          action={
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
          }
        />
      ) : (
        <>
          {activeTab === 'usa' && (
            <div className="space-y-8">
              {/* Viajeros */}
              {viajeros.length > 0 && (
                <div>
                  <SectionHeader
                    title="Viajeros"
                    icon={Users}
                    iconColor="text-purple-600"
                    count={viajeros.length}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {viajeros.map(viajero => (
                      <ViajeroCardPro key={viajero.id} viajero={viajero} />
                    ))}
                  </div>
                </div>
              )}

              {/* Otros almacenes USA (no viajeros) */}
              {almacenesUSA.filter(a => !a.esViajero).length > 0 && (
                <div>
                  <SectionHeader
                    title="Almacenes USA"
                    icon={Warehouse}
                    iconColor="text-blue-600"
                    count={almacenesUSA.filter(a => !a.esViajero).length}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {almacenesUSA.filter(a => !a.esViajero).map(almacen => (
                      <AlmacenCardPro key={almacen.id} almacen={almacen} />
                    ))}
                  </div>
                </div>
              )}

              {almacenesUSA.length === 0 && (
                <EmptyState
                  icon={Users}
                  title="No hay almacenes registrados"
                  description="Crea tu primer viajero o almacén para empezar"
                  action={
                    <Button variant="primary" onClick={openCreateModal}>
                      <Plus className="h-4 w-4 mr-2" />
                      Crear Viajero
                    </Button>
                  }
                />
              )}
            </div>
          )}

          {activeTab === 'peru' && (
            <div>
              <SectionHeader
                title="Almacenes Perú"
                icon={Warehouse}
                iconColor="text-red-600"
                count={almacenesPeru.length}
              />
              {almacenesPeru.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {almacenesPeru.map(almacen => (
                    <AlmacenCardPro key={almacen.id} almacen={almacen} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Warehouse}
                  title="No hay almacenes en Perú"
                  description="Crea tu primer almacén para comenzar"
                  action={
                    <Button variant="primary" onClick={openCreateModal}>
                      <Plus className="h-4 w-4 mr-2" />
                      Crear Almacén
                    </Button>
                  }
                />
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

      {/* Dialogo de Confirmacion */}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};
