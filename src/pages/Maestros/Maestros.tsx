import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
  Tag,
  Truck,
  Plus,
  RefreshCw,
  Warehouse,
  Shield,
  Store,
  Crown,
  LayoutDashboard,
  Zap,
  Boxes
} from 'lucide-react';
import {
  Button,
  StatCard,
  GradientHeader,
  TabNavigation,
  useConfirmDialog,
  ConfirmDialog
} from '../../components/common';
import { useToastStore } from '../../store/toastStore';
import { useClienteStore } from '../../store/clienteStore';
import { useMarcaStore } from '../../store/marcaStore';
import { useProveedorStore } from '../../store/proveedorStore';
import { useAlmacenStore } from '../../store/almacenStore';
import { useCompetidorStore } from '../../store/competidorStore';
import { useTransportistaStore } from '../../store/transportistaStore';
import { useCanalVentaStore } from '../../store/canalVentaStore';
import { useAuthStore } from '../../store/authStore';
import { metricasService } from '../../services/metricas.service';
import { almacenService } from '../../services/almacen.service';
import { MaestrosModals } from './MaestrosModals';
import type {
  Cliente,
  ClienteFormData,
  Competidor,
  CompetidorFormData,
  PlataformaCompetidorData
} from '../../types/entidadesMaestras.types';
import type { Marca, MarcaFormData } from '../../types/entidadesMaestras.types';
import type { Proveedor, ProveedorFormData } from '../../types/ordenCompra.types';
import type { Almacen, AlmacenFormData } from '../../types/almacen.types';

// Lazy-loaded tab components — each chunk is only fetched when the user first visits that tab
const TabResumen = lazy(() => import('./TabResumen').then(m => ({ default: m.TabResumen })));
const TabClasificacion = lazy(() => import('./TabClasificacion').then(m => ({ default: m.TabClasificacion })));
const ClientesCRM = lazy(() => import('../../components/Maestros/ClientesCRM').then(m => ({ default: m.ClientesCRM })));
const MarcasAnalytics = lazy(() => import('../../components/Maestros/MarcasAnalytics').then(m => ({ default: m.MarcasAnalytics })));
const ProveedoresSRM = lazy(() => import('../../components/Maestros/ProveedoresSRM').then(m => ({ default: m.ProveedoresSRM })));
const AlmacenesLogistica = lazy(() => import('../../components/Maestros/AlmacenesLogistica').then(m => ({ default: m.AlmacenesLogistica })));
const CompetidoresIntel = lazy(() => import('../../components/Maestros/CompetidoresIntel').then(m => ({ default: m.CompetidoresIntel })));
const TransportistasLogistica = lazy(() => import('../../components/Maestros/TransportistasLogistica').then(m => ({ default: m.TransportistasLogistica })));
const CanalesVentaAnalytics = lazy(() => import('../../components/Maestros/CanalesVentaAnalytics').then(m => ({ default: m.CanalesVentaAnalytics })));

const TabFallback = (
  <div className="flex justify-center items-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
  </div>
);

type TabActiva = 'resumen' | 'clientes' | 'marcas' | 'proveedores' | 'almacenes' | 'competidores' | 'transportistas' | 'canales' | 'clasificacion';

const VALID_TABS: TabActiva[] = ['resumen', 'clientes', 'marcas', 'proveedores', 'almacenes', 'competidores', 'transportistas', 'canales', 'clasificacion'];

export const Maestros: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const [searchParams] = useSearchParams();

  const tabFromUrl = searchParams.get('tab') as TabActiva | null;
  const initialTab: TabActiva = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'resumen';

  const [tabActiva, setTabActiva] = useState<TabActiva>(initialTab);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRecalculando, setIsRecalculando] = useState(false);

  const { dialogProps, confirm } = useConfirmDialog();
  const toast = useToastStore();

  // Stores
  const {
    clientes,
    stats: clienteStats,
    loading: loadingClientes,
    fetchClientes,
    fetchStats: fetchClienteStats,
    createCliente,
    updateCliente,
    deleteCliente,
    recalcularMetricasDesdeVentas
  } = useClienteStore();

  const {
    marcas,
    stats: marcaStats,
    loading: loadingMarcas,
    fetchMarcas,
    fetchStats: fetchMarcaStats,
    createMarca,
    updateMarca,
    deleteMarca,
    recalcularMetricasDesdeVentas: recalcularMetricasMarcas
  } = useMarcaStore();

  const {
    proveedores,
    stats: proveedorStats,
    loading: loadingProveedores,
    fetchProveedores,
    fetchStats: fetchProveedorStats,
    createProveedor,
    updateProveedor,
    deleteProveedor,
    cambiarEstado: cambiarEstadoProveedor
  } = useProveedorStore();

  const {
    almacenes,
    stats: almacenStats,
    loading: loadingAlmacenes,
    fetchAlmacenes,
    fetchStats: fetchAlmacenStats,
    createAlmacen,
    updateAlmacen
  } = useAlmacenStore();

  const {
    competidores,
    stats: competidorStats,
    loading: loadingCompetidores,
    fetchCompetidores,
    fetchStats: fetchCompetidorStats,
    createCompetidor,
    updateCompetidor,
    deleteCompetidor,
    cambiarEstado: cambiarEstadoCompetidor
  } = useCompetidorStore();

  const {
    transportistas,
    loading: loadingTransportistas,
    fetchTransportistas
  } = useTransportistaStore();

  const {
    canales,
    canalesActivos,
    loading: loadingCanales,
    fetchCanales,
    fetchCanalesActivos
  } = useCanalVentaStore();

  // Modal visibility state
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showMarcaModal, setShowMarcaModal] = useState(false);
  const [showProveedorModal, setShowProveedorModal] = useState(false);
  const [showAlmacenModal, setShowAlmacenModal] = useState(false);
  const [showCompetidorModal, setShowCompetidorModal] = useState(false);

  // Editing entities
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [editingMarca, setEditingMarca] = useState<Marca | null>(null);
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [editingAlmacen, setEditingAlmacen] = useState<Almacen | null>(null);
  const [editingCompetidor, setEditingCompetidor] = useState<Competidor | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail modals
  const [detalleCliente, setDetalleCliente] = useState<Cliente | null>(null);
  const [detalleMarca, setDetalleMarca] = useState<Marca | null>(null);
  const [detalleProveedor, setDetalleProveedor] = useState<Proveedor | null>(null);
  const [detalleAlmacen, setDetalleAlmacen] = useState<Almacen | null>(null);
  const [detalleCompetidor, setDetalleCompetidor] = useState<Competidor | null>(null);
  const [historialViajero, setHistorialViajero] = useState<Almacen | null>(null);
  const [historialCliente, setHistorialCliente] = useState<Cliente | null>(null);

  // Form state
  const [clienteForm, setClienteForm] = useState<Partial<ClienteFormData>>({
    tipoCliente: 'persona',
    canalOrigen: ''
  });
  const [marcaForm, setMarcaForm] = useState<Partial<MarcaFormData>>({
    tipoMarca: 'farmaceutica'
  });
  const [proveedorForm, setProveedorForm] = useState<Partial<ProveedorFormData>>({
    tipo: 'distribuidor',
    pais: 'USA'
  });
  const [almacenForm, setAlmacenForm] = useState<Partial<AlmacenFormData>>({
    pais: 'USA',
    tipo: 'viajero',
    estadoAlmacen: 'activo',
    esViajero: true
  });
  const [competidorForm, setCompetidorForm] = useState<Partial<CompetidorFormData>>({
    plataformasData: [],
    reputacion: 'desconocida',
    nivelAmenaza: 'medio'
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchClientes(),
        fetchClienteStats(),
        fetchMarcas(),
        fetchMarcaStats(),
        fetchProveedores(),
        fetchProveedorStats(),
        fetchAlmacenes(),
        fetchAlmacenStats(),
        fetchCompetidores(),
        fetchCompetidorStats(),
        fetchTransportistas(),
        fetchCanales(),
        fetchCanalesActivos()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSyncMetricas = async () => {
    const confirmed = await confirm({
      title: 'Sincronizar Metricas',
      message: 'Esto vinculara ventas/productos/investigaciones existentes con clientes/marcas/proveedores/competidores y recalculara las estadisticas. El proceso puede tomar unos segundos.',
      confirmText: 'Sincronizar',
      variant: 'info'
    });
    if (!confirmed) return;

    setIsSyncing(true);
    try {
      await metricasService.vincularVentasConClientes();
      await metricasService.vincularProductosConMarcas();
      await metricasService.sincronizarMetricasClientes();
      await metricasService.sincronizarMetricasMarcas();
      await metricasService.sincronizarVentasMarcas();
      await metricasService.sincronizarMetricasProveedores();
      await metricasService.sincronizarMetricasCompetidores();
      await metricasService.sincronizarOrdenesProveedores();
      await almacenService.recalcularTodosLosAlmacenes();
      await loadAllData();
      toast.success(
        'Metricas de clientes, marcas, proveedores, competidores y almacenes sincronizadas correctamente.',
        'Sincronizacion Completada'
      );
    } catch (error: any) {
      console.error('Error en sincronizacion:', error);
      toast.error(error.message, 'Error en sincronizacion');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRecalcularMetricas = async () => {
    if (!user) return;
    const confirmado = await confirm({
      title: 'Recalcular Metricas',
      message: 'Deseas recalcular las metricas de todos los clientes y marcas basandose en las ventas actuales? Esto es util si borraste ventas manualmente desde Firebase.',
      confirmText: 'Recalcular',
      cancelText: 'Cancelar'
    });
    if (!confirmado) return;

    setIsRecalculando(true);
    try {
      const resultadoClientes = await recalcularMetricasDesdeVentas(user.uid);
      const resultadoMarcas = await recalcularMetricasMarcas();
      toast.success(
        `Metricas recalculadas: ${resultadoClientes.actualizados} clientes, ${resultadoMarcas.marcasActualizadas} marcas`,
        'Recalculo Completado'
      );
    } catch (error: any) {
      toast.error(error.message || 'Error al recalcular metricas');
    } finally {
      setIsRecalculando(false);
    }
  };

  // Cliente handlers
  const handleOpenClienteModal = (cliente?: Cliente) => {
    if (cliente) {
      setEditingCliente(cliente);
      setClienteForm({
        nombre: cliente.nombre,
        nombreCorto: cliente.nombreCorto,
        tipoCliente: cliente.tipoCliente,
        dniRuc: cliente.dniRuc,
        telefono: cliente.telefono,
        telefonoAlt: cliente.telefonoAlt,
        email: cliente.email,
        canalOrigen: cliente.canalOrigen,
        notas: cliente.notas,
        etiquetas: cliente.etiquetas
      });
    } else {
      setEditingCliente(null);
      setClienteForm({ tipoCliente: 'persona', canalOrigen: canalesActivos[0]?.id || '' });
    }
    setShowClienteModal(true);
  };

  const handleSaveCliente = async () => {
    if (!user || !clienteForm.nombre) return;
    setIsSubmitting(true);
    try {
      if (editingCliente) {
        await updateCliente(editingCliente.id, clienteForm, user.uid);
      } else {
        await createCliente(clienteForm as ClienteFormData, user.uid);
      }
      setShowClienteModal(false);
      setEditingCliente(null);
      toast.success(editingCliente ? 'Cliente actualizado' : 'Cliente creado');
    } catch (error: any) {
      toast.error(error.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCliente = async (id: string) => {
    const confirmed = await confirm({
      title: 'Eliminar Cliente',
      message: 'Esta seguro de eliminar este cliente?',
      confirmText: 'Eliminar',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      await deleteCliente(id);
      toast.success('Cliente eliminado');
    } catch (error: any) {
      toast.error(error.message, 'Error');
    }
  };

  // Marca handlers
  const handleOpenMarcaModal = (marca?: Marca) => {
    if (marca) {
      setEditingMarca(marca);
      setMarcaForm({
        nombre: marca.nombre,
        alias: marca.alias,
        descripcion: marca.descripcion,
        paisOrigen: marca.paisOrigen,
        tipoMarca: marca.tipoMarca,
        sitioWeb: marca.sitioWeb,
        notas: marca.notas
      });
    } else {
      setEditingMarca(null);
      setMarcaForm({ tipoMarca: 'farmaceutica' });
    }
    setShowMarcaModal(true);
  };

  const handleSaveMarca = async () => {
    if (!user || !marcaForm.nombre) return;
    setIsSubmitting(true);
    try {
      if (editingMarca) {
        await updateMarca(editingMarca.id, marcaForm, user.uid);
      } else {
        await createMarca(marcaForm as MarcaFormData, user.uid);
      }
      setShowMarcaModal(false);
      setEditingMarca(null);
      toast.success(editingMarca ? 'Marca actualizada' : 'Marca creada');
    } catch (error: any) {
      toast.error(error.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMarca = async (id: string) => {
    const confirmed = await confirm({
      title: 'Eliminar Marca',
      message: 'Esta seguro de eliminar esta marca?',
      confirmText: 'Eliminar',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      await deleteMarca(id);
      toast.success('Marca eliminada');
    } catch (error: any) {
      toast.error(error.message, 'Error');
    }
  };

  // Proveedor handlers
  const handleOpenProveedorModal = (proveedor?: Proveedor) => {
    if (proveedor) {
      setEditingProveedor(proveedor);
      setProveedorForm({
        nombre: proveedor.nombre,
        tipo: proveedor.tipo,
        url: proveedor.url || '',
        telefono: proveedor.telefono,
        direccion: proveedor.direccion,
        pais: proveedor.pais,
        notasInternas: proveedor.notasInternas
      });
    } else {
      setEditingProveedor(null);
      setProveedorForm({ tipo: 'distribuidor', pais: 'USA', url: '' });
    }
    setShowProveedorModal(true);
  };

  const handleSaveProveedor = async () => {
    if (!user || !proveedorForm.nombre) return;
    setIsSubmitting(true);
    try {
      if (editingProveedor) {
        await updateProveedor(editingProveedor.id, proveedorForm, user.uid);
      } else {
        await createProveedor(proveedorForm as ProveedorFormData, user.uid);
      }
      setShowProveedorModal(false);
      setEditingProveedor(null);
      toast.success(editingProveedor ? 'Proveedor actualizado' : 'Proveedor creado');
    } catch (error: any) {
      toast.error(error.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProveedor = async (id: string) => {
    if (!user) return;
    const confirmed = await confirm({
      title: 'Eliminar Proveedor',
      message: 'Esta seguro de eliminar este proveedor?',
      confirmText: 'Eliminar',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      await deleteProveedor(id, user.uid);
      toast.success('Proveedor eliminado');
    } catch (error: any) {
      toast.error(error.message, 'Error');
    }
  };

  // Almacen handlers
  const handleOpenAlmacenModal = (almacen?: Almacen) => {
    if (almacen) {
      setEditingAlmacen(almacen);
      setAlmacenForm({
        codigo: almacen.codigo,
        nombre: almacen.nombre,
        pais: almacen.pais,
        tipo: almacen.tipo,
        estadoAlmacen: almacen.estadoAlmacen,
        direccion: almacen.direccion,
        ciudad: almacen.ciudad,
        estado: almacen.estado,
        codigoPostal: almacen.codigoPostal,
        contacto: almacen.contacto,
        telefono: almacen.telefono,
        email: almacen.email,
        whatsapp: almacen.whatsapp,
        capacidadUnidades: almacen.capacidadUnidades,
        esViajero: almacen.esViajero,
        frecuenciaViaje: almacen.frecuenciaViaje,
        proximoViaje: almacen.proximoViaje?.toDate(),
        costoPromedioFlete: almacen.costoPromedioFlete,
        notas: almacen.notas
      });
    } else {
      setEditingAlmacen(null);
      setAlmacenForm({
        pais: 'USA',
        tipo: 'viajero',
        estadoAlmacen: 'activo',
        esViajero: true
      });
    }
    setShowAlmacenModal(true);
  };

  const handleSaveAlmacen = async () => {
    if (!user) return;
    if (!almacenForm.nombre?.trim()) {
      toast.error('Ingresa el nombre del almacen o viajero', 'Campo requerido');
      return;
    }
    if (!almacenForm.direccion?.trim()) {
      toast.error('Ingresa la direccion del almacen', 'Campo requerido');
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingAlmacen) {
        await updateAlmacen(editingAlmacen.id, almacenForm, user.uid);
      } else {
        await createAlmacen(almacenForm as AlmacenFormData, user.uid);
      }
      setShowAlmacenModal(false);
      setEditingAlmacen(null);
      toast.success(editingAlmacen ? 'Almacen actualizado' : 'Almacen creado');
    } catch (error: any) {
      toast.error(error.message, 'Error al guardar almacen');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Competidor handlers
  const handleOpenCompetidorModal = (competidor?: Competidor) => {
    if (competidor) {
      setEditingCompetidor(competidor);
      setCompetidorForm({
        nombre: competidor.nombre,
        plataformasData: competidor.plataformasData || [],
        ciudad: competidor.ciudad,
        departamento: competidor.departamento,
        reputacion: competidor.reputacion,
        ventasEstimadas: competidor.ventasEstimadas,
        esLiderCategoria: competidor.esLiderCategoria,
        categoriasLider: competidor.categoriasLider,
        fortalezas: competidor.fortalezas,
        debilidades: competidor.debilidades,
        estrategiaPrecio: competidor.estrategiaPrecio,
        nivelAmenaza: competidor.nivelAmenaza,
        notas: competidor.notas
      });
    } else {
      setEditingCompetidor(null);
      setCompetidorForm({
        plataformasData: [],
        reputacion: 'desconocida',
        nivelAmenaza: 'medio'
      });
    }
    setShowCompetidorModal(true);
  };

  const handleAddPlataforma = () => {
    const newPlataforma: PlataformaCompetidorData = {
      id: `plat_${Date.now()}`,
      nombre: '',
      url: '',
      esPrincipal: (competidorForm.plataformasData?.length || 0) === 0
    };
    setCompetidorForm({
      ...competidorForm,
      plataformasData: [...(competidorForm.plataformasData || []), newPlataforma]
    });
  };

  const handleUpdatePlataforma = (index: number, field: keyof PlataformaCompetidorData, value: string | boolean) => {
    const updated = [...(competidorForm.plataformasData || [])];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'esPrincipal' && value === true) {
      updated.forEach((p, i) => { if (i !== index) p.esPrincipal = false; });
    }
    setCompetidorForm({ ...competidorForm, plataformasData: updated });
  };

  const handleRemovePlataforma = (index: number) => {
    const updated = [...(competidorForm.plataformasData || [])];
    const wasMain = updated[index].esPrincipal;
    updated.splice(index, 1);
    if (wasMain && updated.length > 0) updated[0].esPrincipal = true;
    setCompetidorForm({ ...competidorForm, plataformasData: updated });
  };

  const handleSaveCompetidor = async () => {
    if (!user || !competidorForm.nombre) return;
    setIsSubmitting(true);
    try {
      if (editingCompetidor) {
        await updateCompetidor(editingCompetidor.id, competidorForm, user.uid);
      } else {
        await createCompetidor(competidorForm as CompetidorFormData, user.uid);
      }
      setShowCompetidorModal(false);
      setEditingCompetidor(null);
      toast.success(editingCompetidor ? 'Competidor actualizado' : 'Competidor creado');
    } catch (error: any) {
      toast.error(error.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCompetidor = async (id: string) => {
    const confirmed = await confirm({
      title: 'Eliminar Competidor',
      message: 'Esta seguro de eliminar este competidor?',
      confirmText: 'Eliminar',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      await deleteCompetidor(id);
      toast.success('Competidor eliminado');
    } catch (error: any) {
      toast.error(error.message, 'Error');
    }
  };

  // Loading state
  const hayDatos = clientes.length > 0 || marcas.length > 0 || proveedores.length > 0 || almacenes.length > 0 || competidores.length > 0;
  const loading = !hayDatos && (loadingClientes || loadingMarcas || loadingProveedores || loadingAlmacenes || loadingCompetidores);

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { id: 'clientes', label: 'Clientes', icon: Users, count: clientes.length },
    { id: 'marcas', label: 'Marcas', icon: Tag, count: marcas.length },
    { id: 'proveedores', label: 'Proveedores', icon: Truck, count: proveedores.length },
    { id: 'almacenes', label: 'Almacenes', icon: Warehouse, count: almacenes.length },
    { id: 'competidores', label: 'Competidores', icon: Shield, count: competidores.length },
    { id: 'transportistas', label: 'Transportistas', icon: Truck },
    { id: 'canales', label: 'Canales', icon: Store },
    { id: 'clasificacion', label: 'Clasificacion', icon: Boxes }
  ];

  const getActionButton = () => {
    switch (tabActiva) {
      case 'resumen':
        return (
          <Button
            variant="secondary"
            onClick={handleSyncMetricas}
            disabled={isSyncing || isRefreshing}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20"
          >
            <Zap className={`h-5 w-5 mr-2 ${isSyncing ? 'animate-pulse' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
        );
      case 'clientes':
        return (
          <Button variant="primary" onClick={() => handleOpenClienteModal()} className="bg-white text-slate-800 hover:bg-gray-100">
            <Plus className="h-5 w-5 mr-2" />
            Nuevo Cliente
          </Button>
        );
      case 'marcas':
        return (
          <Button variant="primary" onClick={() => handleOpenMarcaModal()} className="bg-white text-slate-800 hover:bg-gray-100">
            <Plus className="h-5 w-5 mr-2" />
            Nueva Marca
          </Button>
        );
      case 'proveedores':
        return (
          <Button variant="primary" onClick={() => handleOpenProveedorModal()} className="bg-white text-slate-800 hover:bg-gray-100">
            <Plus className="h-5 w-5 mr-2" />
            Nuevo Proveedor
          </Button>
        );
      case 'almacenes':
        return (
          <Button variant="primary" onClick={() => handleOpenAlmacenModal()} className="bg-white text-slate-800 hover:bg-gray-100">
            <Plus className="h-5 w-5 mr-2" />
            Nuevo Almacen
          </Button>
        );
      case 'competidores':
        return (
          <Button variant="primary" onClick={() => handleOpenCompetidorModal()} className="bg-white text-slate-800 hover:bg-gray-100">
            <Plus className="h-5 w-5 mr-2" />
            Nuevo Competidor
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <GradientHeader
        title="Gestion de Maestros"
        subtitle="Administra clientes, marcas, proveedores, almacenes y competidores"
        icon={Boxes}
        variant="dark"
        actions={
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              onClick={loadAllData}
              disabled={isRefreshing || isSyncing}
              title="Actualizar datos"
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            {getActionButton()}
          </div>
        }
        stats={[
          { label: 'Clientes', value: clientes.length },
          { label: 'Marcas', value: marcas.length },
          { label: 'Proveedores', value: proveedores.length },
          { label: 'Almacenes', value: almacenes.length },
          { label: 'Transportistas', value: transportistas.length },
          { label: 'Canales', value: canales.length }
        ]}
      />

      <TabNavigation
        tabs={tabs}
        activeTab={tabActiva}
        onTabChange={(tabId) => setTabActiva(tabId as TabActiva)}
        variant="pills"
      />

      {tabActiva !== 'resumen' && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <StatCard
            label="Clientes"
            value={clientes.length}
            icon={Users}
            variant="blue"
            onClick={() => setTabActiva('clientes')}
            active={tabActiva === 'clientes'}
          />
          <StatCard
            label="Marcas"
            value={marcas.length}
            icon={Tag}
            variant="green"
            onClick={() => setTabActiva('marcas')}
            active={tabActiva === 'marcas'}
          />
          <StatCard
            label="Proveedores"
            value={proveedores.length}
            icon={Truck}
            variant="purple"
            onClick={() => setTabActiva('proveedores')}
            active={tabActiva === 'proveedores'}
          />
          <StatCard
            label="Almacenes"
            value={almacenes.length}
            icon={Warehouse}
            variant="amber"
            onClick={() => setTabActiva('almacenes')}
            active={tabActiva === 'almacenes'}
          />
          <StatCard
            label="Competidores"
            value={competidores.length}
            icon={Shield}
            variant="red"
            onClick={() => setTabActiva('competidores')}
            active={tabActiva === 'competidores'}
          />
          <StatCard
            label="Transportistas"
            value={transportistas.length}
            icon={Truck}
            variant="blue"
            onClick={() => setTabActiva('transportistas')}
            active={tabActiva === 'transportistas'}
          />
          <StatCard
            label="Canales"
            value={canales.length}
            icon={Store}
            variant="green"
            onClick={() => setTabActiva('canales')}
            active={tabActiva === 'canales'}
          />
          <StatCard
            label="Resumen 360"
            value="Ver"
            icon={LayoutDashboard}
            variant="default"
            onClick={() => setTabActiva('resumen')}
            active={false}
          />
        </div>
      )}

      {/* Tab: Resumen (lazy loaded) */}
      {tabActiva === 'resumen' && (
        <Suspense fallback={TabFallback}>
          <TabResumen
            clientes={clientes}
            marcas={marcas}
            proveedores={proveedores}
            almacenes={almacenes}
            competidores={competidores}
            transportistas={transportistas}
            canales={canales}
            clienteStats={clienteStats}
            marcaStats={marcaStats}
            proveedorStats={proveedorStats}
            almacenStats={almacenStats}
            competidorStats={competidorStats}
            isRefreshing={isRefreshing}
            isRecalculando={isRecalculando}
            onSetTab={(tab) => setTabActiva(tab as TabActiva)}
            onLoadAllData={loadAllData}
            onOpenClienteModal={() => handleOpenClienteModal()}
            onOpenMarcaModal={() => handleOpenMarcaModal()}
            onOpenProveedorModal={() => handleOpenProveedorModal()}
            onOpenAlmacenModal={() => handleOpenAlmacenModal()}
            onOpenCompetidorModal={() => handleOpenCompetidorModal()}
            onRecalcularMetricas={handleRecalcularMetricas}
          />
        </Suspense>
      )}

      {/* Content by tab */}
      {loading && !isRefreshing ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          {tabActiva === 'clientes' && (
            <Suspense fallback={TabFallback}>
              <ClientesCRM
                onOpenClienteModal={handleOpenClienteModal}
                onViewCliente={(cliente) => setDetalleCliente(cliente)}
                onEditCliente={(cliente) => handleOpenClienteModal(cliente)}
                onDeleteCliente={handleDeleteCliente}
              />
            </Suspense>
          )}

          {tabActiva === 'marcas' && (
            <Suspense fallback={TabFallback}>
              <MarcasAnalytics
                onOpenMarcaModal={handleOpenMarcaModal}
                onViewMarca={(marca) => setDetalleMarca(marca)}
                onEditMarca={(marca) => handleOpenMarcaModal(marca)}
                onDeleteMarca={handleDeleteMarca}
              />
            </Suspense>
          )}

          {tabActiva === 'proveedores' && (
            <Suspense fallback={TabFallback}>
              <ProveedoresSRM
                onOpenProveedorModal={handleOpenProveedorModal}
                onViewProveedor={(proveedor) => setDetalleProveedor(proveedor)}
                onEditProveedor={(proveedor) => handleOpenProveedorModal(proveedor)}
                onDeleteProveedor={handleDeleteProveedor}
              />
            </Suspense>
          )}

          {tabActiva === 'almacenes' && (
            <Suspense fallback={TabFallback}>
              <AlmacenesLogistica
                onOpenAlmacenModal={handleOpenAlmacenModal}
                onViewAlmacen={(almacen) => setDetalleAlmacen(almacen)}
                onEditAlmacen={(almacen) => handleOpenAlmacenModal(almacen)}
              />
            </Suspense>
          )}

          {tabActiva === 'competidores' && (
            <Suspense fallback={TabFallback}>
              <CompetidoresIntel
                onOpenCompetidorModal={handleOpenCompetidorModal}
                onViewCompetidor={(competidor) => setDetalleCompetidor(competidor)}
                onEditCompetidor={(competidor) => handleOpenCompetidorModal(competidor)}
                onDeleteCompetidor={handleDeleteCompetidor}
              />
            </Suspense>
          )}

          {tabActiva === 'transportistas' && (
            <Suspense fallback={TabFallback}>
              <TransportistasLogistica />
            </Suspense>
          )}

          {tabActiva === 'canales' && (
            <Suspense fallback={TabFallback}>
              <CanalesVentaAnalytics />
            </Suspense>
          )}

          {tabActiva === 'clasificacion' && (
            <Suspense fallback={TabFallback}>
              <TabClasificacion />
            </Suspense>
          )}
        </>
      )}

      <MaestrosModals
        // Cliente
        showClienteModal={showClienteModal}
        editingCliente={editingCliente}
        clienteForm={clienteForm}
        isSubmitting={isSubmitting}
        onCloseClienteModal={() => { setShowClienteModal(false); setEditingCliente(null); }}
        onClienteFormChange={setClienteForm}
        onSaveCliente={handleSaveCliente}
        // Marca
        showMarcaModal={showMarcaModal}
        editingMarca={editingMarca}
        marcaForm={marcaForm}
        onCloseMarcaModal={() => { setShowMarcaModal(false); setEditingMarca(null); }}
        onMarcaFormChange={setMarcaForm}
        onSaveMarca={handleSaveMarca}
        // Proveedor
        showProveedorModal={showProveedorModal}
        editingProveedor={editingProveedor}
        proveedorForm={proveedorForm}
        onCloseProveedorModal={() => { setShowProveedorModal(false); setEditingProveedor(null); }}
        onProveedorFormChange={setProveedorForm}
        onSaveProveedor={handleSaveProveedor}
        // Almacen
        showAlmacenModal={showAlmacenModal}
        editingAlmacen={editingAlmacen}
        almacenForm={almacenForm}
        onCloseAlmacenModal={() => { setShowAlmacenModal(false); setEditingAlmacen(null); }}
        onAlmacenFormChange={setAlmacenForm}
        onSaveAlmacen={handleSaveAlmacen}
        // Competidor
        showCompetidorModal={showCompetidorModal}
        editingCompetidor={editingCompetidor}
        competidorForm={competidorForm}
        onCloseCompetidorModal={() => { setShowCompetidorModal(false); setEditingCompetidor(null); }}
        onCompetidorFormChange={setCompetidorForm}
        onSaveCompetidor={handleSaveCompetidor}
        onAddPlataforma={handleAddPlataforma}
        onUpdatePlataforma={handleUpdatePlataforma}
        onRemovePlataforma={handleRemovePlataforma}
        // Detalle modals
        detalleCliente={detalleCliente}
        detalleMarca={detalleMarca}
        detalleProveedor={detalleProveedor}
        detalleAlmacen={detalleAlmacen}
        detalleCompetidor={detalleCompetidor}
        historialViajero={historialViajero}
        historialCliente={historialCliente}
        onCloseDetalleCliente={() => setDetalleCliente(null)}
        onCloseDetalleMarca={() => setDetalleMarca(null)}
        onCloseDetalleProveedor={() => setDetalleProveedor(null)}
        onCloseDetalleAlmacen={() => setDetalleAlmacen(null)}
        onCloseDetalleCompetidor={() => setDetalleCompetidor(null)}
        onCloseHistorialViajero={() => setHistorialViajero(null)}
        onCloseHistorialCliente={() => setHistorialCliente(null)}
        onEditFromDetalleCliente={() => {
          if (detalleCliente) { handleOpenClienteModal(detalleCliente); setDetalleCliente(null); }
        }}
        onEditFromDetalleMarca={() => {
          if (detalleMarca) { handleOpenMarcaModal(detalleMarca); setDetalleMarca(null); }
        }}
        onEditFromDetalleProveedor={() => {
          if (detalleProveedor) { handleOpenProveedorModal(detalleProveedor); setDetalleProveedor(null); }
        }}
        onEditFromDetalleAlmacen={() => {
          if (detalleAlmacen) { handleOpenAlmacenModal(detalleAlmacen); setDetalleAlmacen(null); }
        }}
        onEditFromDetalleCompetidor={() => {
          if (detalleCompetidor) { handleOpenCompetidorModal(detalleCompetidor); setDetalleCompetidor(null); }
        }}
        onEditFromHistorialViajero={() => {
          if (historialViajero) { handleOpenAlmacenModal(historialViajero); setHistorialViajero(null); }
        }}
        onEditFromHistorialCliente={() => {
          if (historialCliente) { handleOpenClienteModal(historialCliente); setHistorialCliente(null); }
        }}
        onViewHistoryFromDetalleCliente={() => {
          if (detalleCliente) { setHistorialCliente(detalleCliente); setDetalleCliente(null); }
        }}
        onViewHistoryFromDetalleAlmacen={detalleAlmacen?.esViajero ? () => {
          setHistorialViajero(detalleAlmacen);
          setDetalleAlmacen(null);
        } : undefined}
        confirmDialog={<ConfirmDialog {...dialogProps} />}
      />
    </div>
  );
};
