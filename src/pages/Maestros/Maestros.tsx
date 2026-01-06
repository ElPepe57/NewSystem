import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
  Tag,
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Globe,
  Package,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Building2,
  User,
  ShoppingCart,
  DollarSign,
  Warehouse,
  Plane,
  Calendar,
  Store,
  Crown,
  ExternalLink,
  Shield,
  Target,
  Activity,
  BarChart3,
  AlertTriangle,
  LayoutDashboard,
  Zap,
  Clock,
  TrendingDown,
  Boxes,
  Eye,
  Calculator
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  Modal,
  KPICard,
  KPIGrid,
  AlertCard,
  StatDistribution,
  GradientHeader,
  StatCard,
  TabNavigation,
  SectionHeader,
  EmptyState,
  MasterCard,
  useConfirmDialog,
  ConfirmDialog,
  SearchInput
} from '../../components/common';
import { useToastStore } from '../../store/toastStore';
import {
  ClienteDetalleModal,
  MarcaDetalleModal,
  ProveedorDetalleModal,
  AlmacenDetalleModal,
  CompetidorDetalleModal
} from '../../components/Maestros/DetalleModals';
import { ClientesCRM } from '../../components/Maestros/ClientesCRM';
import { MarcasAnalytics } from '../../components/Maestros/MarcasAnalytics';
import { ProveedoresSRM } from '../../components/Maestros/ProveedoresSRM';
import { CompetidoresIntel } from '../../components/Maestros/CompetidoresIntel';
import { TransportistasLogistica } from '../../components/Maestros/TransportistasLogistica';
import { CanalesVentaAnalytics } from '../../components/Maestros/CanalesVentaAnalytics';
import { AlmacenesLogistica } from '../../components/Maestros/AlmacenesLogistica';
import { ViajeroDetalle } from '../../components/modules/almacen/ViajeroDetalle';
import { ClienteDetalle } from '../../components/modules/cliente/ClienteDetalle';
import { TipoProductoList, CategoriaList, EtiquetaList } from '../../components/modules/clasificacion';
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
import type { Cliente, ClienteFormData, Competidor, CompetidorFormData, PlataformaCompetidor, ReputacionCompetidor } from '../../types/entidadesMaestras.types';
import type { Marca, MarcaFormData } from '../../types/entidadesMaestras.types';
import type { Proveedor, ProveedorFormData, TipoProveedor } from '../../types/ordenCompra.types';
import type { Almacen, AlmacenFormData, TipoAlmacen, EstadoAlmacen, FrecuenciaViaje } from '../../types/almacen.types';

type TabActiva = 'resumen' | 'clientes' | 'marcas' | 'proveedores' | 'almacenes' | 'competidores' | 'transportistas' | 'canales' | 'clasificacion';

export const Maestros: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const [searchParams] = useSearchParams();

  // Leer tab inicial desde query param
  const tabFromUrl = searchParams.get('tab') as TabActiva | null;
  const initialTab: TabActiva = tabFromUrl && ['resumen', 'clientes', 'marcas', 'proveedores', 'almacenes', 'competidores', 'transportistas', 'canales', 'clasificacion'].includes(tabFromUrl)
    ? tabFromUrl
    : 'resumen';

  const [tabActiva, setTabActiva] = useState<TabActiva>(initialTab);
  const [busqueda, setBusqueda] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRecalculando, setIsRecalculando] = useState(false);

  // Hook para dialogo de confirmacion y toasts
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
    cambiarEstado: cambiarEstadoCliente,
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
    cambiarEstado: cambiarEstadoMarca,
    migrarDesdeProductos,
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
    competidoresActivos,
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
    loading: loadingCanales,
    fetchCanales
  } = useCanalVentaStore();

  // Modales
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showMarcaModal, setShowMarcaModal] = useState(false);
  const [showProveedorModal, setShowProveedorModal] = useState(false);
  const [showAlmacenModal, setShowAlmacenModal] = useState(false);
  const [showCompetidorModal, setShowCompetidorModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [editingMarca, setEditingMarca] = useState<Marca | null>(null);
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [editingAlmacen, setEditingAlmacen] = useState<Almacen | null>(null);
  const [editingCompetidor, setEditingCompetidor] = useState<Competidor | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modales de detalle
  const [detalleCliente, setDetalleCliente] = useState<Cliente | null>(null);
  const [detalleMarca, setDetalleMarca] = useState<Marca | null>(null);
  const [detalleProveedor, setDetalleProveedor] = useState<Proveedor | null>(null);
  const [detalleAlmacen, setDetalleAlmacen] = useState<Almacen | null>(null);
  const [detalleCompetidor, setDetalleCompetidor] = useState<Competidor | null>(null);
  const [historialViajero, setHistorialViajero] = useState<Almacen | null>(null);
  const [historialCliente, setHistorialCliente] = useState<Cliente | null>(null);

  // Forms
  const [clienteForm, setClienteForm] = useState<Partial<ClienteFormData>>({
    tipoCliente: 'persona',
    canalOrigen: 'whatsapp'
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
    plataformaPrincipal: 'mercado_libre',
    reputacion: 'desconocida',
    nivelAmenaza: 'medio'
  });

  // Cargar datos iniciales
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
        fetchCanales()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Sincronizar métricas (vincular datos existentes)
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
      // 1. Vincular ventas con clientes
      const ventasResult = await metricasService.vincularVentasConClientes();
      console.log('Ventas vinculadas:', ventasResult);

      // 2. Vincular productos con marcas
      const productosResult = await metricasService.vincularProductosConMarcas();
      console.log('Productos vinculados:', productosResult);

      // 3. Sincronizar métricas de clientes
      const clientesResult = await metricasService.sincronizarMetricasClientes();
      console.log('Métricas clientes:', clientesResult);

      // 4. Sincronizar métricas de marcas (productos activos)
      const marcasResult = await metricasService.sincronizarMetricasMarcas();
      console.log('Métricas marcas (productos):', marcasResult);

      // 5. Sincronizar ventas de marcas (unidades, ingresos, margen)
      const ventasMarcasResult = await metricasService.sincronizarVentasMarcas();
      console.log('Métricas marcas (ventas):', ventasMarcasResult);

      // 7. Sincronizar métricas de proveedores (desde investigaciones de mercado)
      const proveedoresInvResult = await metricasService.sincronizarMetricasProveedores();
      console.log('Métricas proveedores (investigación):', proveedoresInvResult);

      // 8. Sincronizar métricas de competidores (desde investigaciones de mercado)
      const competidoresResult = await metricasService.sincronizarMetricasCompetidores();
      console.log('Métricas competidores:', competidoresResult);

      // 9. Sincronizar órdenes de compra con proveedores
      const ordenesProvResult = await metricasService.sincronizarOrdenesProveedores();
      console.log('Órdenes proveedores:', ordenesProvResult);

      // 10. Recalcular inventario de todos los almacenes
      const almacenesResult = await almacenService.recalcularTodosLosAlmacenes();
      console.log('Almacenes recalculados:', almacenesResult);

      // Recargar datos
      await loadAllData();

      toast.success(
        `Clientes: ${clientesResult.clientesActualizados}, Marcas: ${marcasResult.marcasActualizadas}, Proveedores: ${ordenesProvResult.proveedoresActualizados}, Competidores: ${competidoresResult.competidoresActualizados}, Almacenes: ${almacenesResult.almacenesActualizados}`,
        'Sincronizacion Completada'
      );
    } catch (error: any) {
      console.error('Error en sincronización:', error);
      toast.error(error.message, 'Error en sincronizacion');
    } finally {
      setIsSyncing(false);
    }
  };

  // Filtrar por búsqueda (con validación segura)
  const termino = busqueda.toLowerCase();
  const clientesArr = Array.isArray(clientes) ? clientes : [];
  const clientesFiltrados = clientesArr.filter(c => {
    const nombre = (c.nombre ?? '').toLowerCase();
    const codigo = (c.codigo ?? '').toLowerCase();
    const telefono = c.telefono ?? '';
    const dniRuc = c.dniRuc ?? '';
    const email = (c.email ?? '').toLowerCase();
    return nombre.includes(termino) || codigo.includes(termino) ||
           telefono.includes(busqueda) || dniRuc.includes(busqueda) || email.includes(termino);
  });

  const marcasArr = Array.isArray(marcas) ? marcas : [];
  const marcasFiltradas = marcasArr.filter(m => {
    const nombre = (m.nombre ?? '').toLowerCase();
    const codigo = (m.codigo ?? '').toLowerCase();
    const aliasMatch = m.alias?.some(a => (a ?? '').toLowerCase().includes(termino)) ?? false;
    return nombre.includes(termino) || codigo.includes(termino) || aliasMatch;
  });

  const proveedoresArr = Array.isArray(proveedores) ? proveedores : [];
  const proveedoresFiltrados = proveedoresArr.filter(p => {
    const nombre = (p.nombre ?? '').toLowerCase();
    const codigo = (p.codigo ?? '').toLowerCase();
    const url = (p.url ?? '').toLowerCase();
    return nombre.includes(termino) || codigo.includes(termino) || url.includes(termino);
  });

  const almacenesArr = Array.isArray(almacenes) ? almacenes : [];
  const almacenesFiltrados = almacenesArr.filter(a => {
    const nombre = (a.nombre ?? '').toLowerCase();
    const codigo = (a.codigo ?? '').toLowerCase();
    const ciudad = (a.ciudad ?? '').toLowerCase();
    const estado = (a.estado ?? '').toLowerCase();
    return nombre.includes(termino) || codigo.includes(termino) || ciudad.includes(termino) || estado.includes(termino);
  });

  const competidoresArr = Array.isArray(competidores) ? competidores : [];
  const competidoresFiltrados = competidoresArr.filter(c => {
    const nombre = (c.nombre ?? '').toLowerCase();
    const codigo = (c.codigo ?? '').toLowerCase();
    const aliasMatch = c.alias?.some(a => (a ?? '').toLowerCase().includes(termino)) ?? false;
    return nombre.includes(termino) || codigo.includes(termino) || aliasMatch;
  });

  // Estadísticas de almacenes
  const almacenesUSA = almacenes.filter(a => a.pais === 'USA');
  const almacenesPeru = almacenes.filter(a => a.pais === 'Peru');
  const viajeros = almacenes.filter(a => a.esViajero);

  // Handlers de Cliente
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
      setClienteForm({ tipoCliente: 'persona', canalOrigen: 'whatsapp' });
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
      message: '¿Esta seguro de eliminar este cliente?',
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

  // Handlers de Marca
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
      message: '¿Esta seguro de eliminar esta marca?',
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

  const handleMigrarMarcas = async () => {
    if (!user) return;
    const confirmed = await confirm({
      title: 'Migrar Marcas',
      message: '¿Desea migrar las marcas existentes desde los productos? Esto creara marcas basadas en los nombres de marca actuales.',
      confirmText: 'Migrar',
      variant: 'info'
    });
    if (!confirmed) return;

    try {
      const resultado = await migrarDesdeProductos(user.uid);
      toast.success(`${resultado.migradas} marcas creadas${resultado.errores.length > 0 ? `. Errores: ${resultado.errores.length}` : ''}`, 'Migracion Completada');
    } catch (error: any) {
      toast.error(error.message, 'Error');
    }
  };

  // Handlers de Proveedor
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
      message: '¿Esta seguro de eliminar este proveedor?',
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

  const handleToggleProveedorActivo = async (proveedor: Proveedor) => {
    if (!user) return;
    try {
      await cambiarEstadoProveedor(proveedor.id, !proveedor.activo, user.uid);
      toast.success(proveedor.activo ? 'Proveedor desactivado' : 'Proveedor activado');
    } catch (error: any) {
      toast.error(error.message, 'Error');
    }
  };

  // Helpers para colores de tipo proveedor
  const getTipoProveedorColor = (tipo: TipoProveedor) => {
    switch (tipo) {
      case 'fabricante':
        return 'bg-purple-100 text-purple-800';
      case 'distribuidor':
        return 'bg-blue-100 text-blue-800';
      case 'mayorista':
        return 'bg-green-100 text-green-800';
      case 'minorista':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Handlers de Almacén
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
    if (!user || !almacenForm.nombre) return;

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
      toast.error(error.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helpers para almacenes
  const getTipoAlmacenColor = (tipo: TipoAlmacen) => {
    switch (tipo) {
      case 'viajero':
        return 'bg-purple-100 text-purple-800';
      case 'almacen_peru':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatProximoViaje = (fecha: any) => {
    if (!fecha) return null;
    const date = fecha.toDate?.() || new Date(fecha);
    const dias = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (dias < 0) return 'Pasado';
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Mañana';
    return `En ${dias} días`;
  };

  // Handlers de Competidor
  const handleOpenCompetidorModal = (competidor?: Competidor) => {
    if (competidor) {
      setEditingCompetidor(competidor);
      setCompetidorForm({
        nombre: competidor.nombre,
        plataformaPrincipal: competidor.plataformaPrincipal,
        plataformas: competidor.plataformas,
        urlTienda: competidor.urlTienda,
        urlMercadoLibre: competidor.urlMercadoLibre,
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
        plataformaPrincipal: 'mercado_libre',
        reputacion: 'desconocida',
        nivelAmenaza: 'medio'
      });
    }
    setShowCompetidorModal(true);
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
      message: '¿Esta seguro de eliminar este competidor?',
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

  const handleToggleCompetidorEstado = async (competidor: Competidor) => {
    if (!user) return;
    try {
      const nuevoEstado = competidor.estado === 'activo' ? 'inactivo' : 'activo';
      await cambiarEstadoCompetidor(competidor.id, nuevoEstado, user.uid);
      toast.success(nuevoEstado === 'activo' ? 'Competidor activado' : 'Competidor desactivado');
    } catch (error: any) {
      toast.error(error.message, 'Error');
    }
  };

  // Helper para colores de plataforma
  const getPlataformaColor = (plataforma: PlataformaCompetidor) => {
    switch (plataforma) {
      case 'mercado_libre':
        return 'bg-yellow-100 text-yellow-800';
      case 'amazon':
        return 'bg-orange-100 text-orange-800';
      case 'web_propia':
        return 'bg-blue-100 text-blue-800';
      case 'inkafarma':
        return 'bg-red-100 text-red-800';
      case 'mifarma':
        return 'bg-green-100 text-green-800';
      case 'falabella':
        return 'bg-lime-100 text-lime-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlataformaLabel = (plataforma: PlataformaCompetidor) => {
    switch (plataforma) {
      case 'mercado_libre': return 'MercadoLibre';
      case 'amazon': return 'Amazon';
      case 'web_propia': return 'Web Propia';
      case 'inkafarma': return 'InkaFarma';
      case 'mifarma': return 'MiFarma';
      case 'falabella': return 'Falabella';
      default: return 'Otra';
    }
  };

  const getNivelAmenazaColor = (nivel: string) => {
    switch (nivel) {
      case 'alto': return 'bg-red-100 text-red-800';
      case 'medio': return 'bg-yellow-100 text-yellow-800';
      case 'bajo': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Helpers de UI
  const getEstadoColor = (estado: string): 'success' | 'default' | 'warning' | 'danger' | 'info' => {
    switch (estado) {
      case 'activo':
      case 'activa':
        return 'success';
      case 'inactivo':
      case 'inactiva':
        return 'default';
      case 'potencial':
        return 'warning';
      case 'descontinuada':
        return 'danger';
      default:
        return 'default';
    }
  };

  const getTipoMarcaColor = (tipo: string) => {
    switch (tipo) {
      case 'farmaceutica':
        return 'bg-blue-100 text-blue-800';
      case 'suplementos':
        return 'bg-green-100 text-green-800';
      case 'cosmetica':
        return 'bg-pink-100 text-pink-800';
      case 'tecnologia':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Loading global solo cuando NO hay datos aún (primera carga)
  const hayDatos = clientes.length > 0 || marcas.length > 0 || proveedores.length > 0 || almacenes.length > 0 || competidores.length > 0;
  const loading = !hayDatos && (loadingClientes || loadingMarcas || loadingProveedores || loadingAlmacenes || loadingCompetidores);

  // Configuración de tabs profesionales
  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { id: 'clientes', label: 'Clientes', icon: Users, count: clientes.length },
    { id: 'marcas', label: 'Marcas', icon: Tag, count: marcas.length },
    { id: 'proveedores', label: 'Proveedores', icon: Truck, count: proveedores.length },
    { id: 'almacenes', label: 'Almacenes', icon: Warehouse, count: almacenes.length },
    { id: 'competidores', label: 'Competidores', icon: Shield, count: competidores.length },
    { id: 'transportistas', label: 'Transportistas', icon: Truck },
    { id: 'canales', label: 'Canales', icon: Store },
    { id: 'clasificacion', label: 'Clasificación', icon: Boxes }
  ];

  // Función para obtener el botón de acción según el tab activo
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
            Nuevo Almacén
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
      {/* Header Profesional con Gradiente */}
      <GradientHeader
        title="Gestión de Maestros"
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

      {/* Navegación por Tabs Profesional */}
      <TabNavigation
        tabs={tabs}
        activeTab={tabActiva}
        onTabChange={(tabId) => setTabActiva(tabId as TabActiva)}
        variant="pills"
      />

      {/* Stats Cards - Solo visible cuando NO es resumen */}
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
            label="Resumen 360°"
            value="Ver"
            icon={LayoutDashboard}
            variant="default"
            onClick={() => setTabActiva('resumen')}
            active={false}
          />
        </div>
      )}

      {/* Resumen Ejecutivo Consolidado */}
      {tabActiva === 'resumen' && (
        <div className="space-y-6">
          {/* KPIs Globales del Negocio */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              Métricas Globales del Negocio
            </h3>
            <KPIGrid columns={5}>
              <KPICard
                title="Total Entidades"
                value={clientes.length + marcas.length + proveedores.length + almacenes.length + competidores.length + transportistas.length + canales.length}
                subtitle="en el sistema"
                icon={Boxes}
                variant="info"
                size="sm"
              />
              <KPICard
                title="Clientes Activos"
                value={clienteStats?.clientesActivos || 0}
                subtitle={`de ${clientes.length} totales`}
                icon={Users}
                variant="success"
                size="sm"
              />
              <KPICard
                title="Proveedores Activos"
                value={proveedores.filter(p => p.activo).length}
                subtitle={`de ${proveedores.length} totales`}
                icon={Truck}
                variant="success"
                size="sm"
              />
              <KPICard
                title="Inventario USA"
                value={almacenStats?.unidadesTotalesUSA?.toLocaleString() || '0'}
                subtitle={`$${(almacenStats?.valorInventarioUSA || 0).toLocaleString()} USD`}
                icon={Package}
                variant="info"
                size="sm"
              />
              <KPICard
                title="Ticket Promedio"
                value={`S/ ${clienteStats?.ticketPromedioGeneral?.toFixed(0) || 0}`}
                subtitle="por cliente"
                icon={DollarSign}
                variant="success"
                size="sm"
              />
              <KPICard
                title="Transportistas"
                value={transportistas.filter(t => t.estado === 'activo').length}
                subtitle={`de ${transportistas.length} totales`}
                icon={Truck}
                variant="info"
                size="sm"
              />
              <KPICard
                title="Canales Venta"
                value={canales.filter(c => c.estado === 'activo').length}
                subtitle={`de ${canales.length} totales`}
                icon={Store}
                variant="success"
                size="sm"
              />
            </KPIGrid>
          </div>

          {/* Distribución de Entidades */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatDistribution
              title="Distribución de Almacenes"
              data={[
                { label: 'Viajeros USA', value: almacenes.filter(a => a.esViajero && a.pais === 'USA').length, color: 'bg-blue-500' },
                { label: 'Fijos USA', value: almacenes.filter(a => !a.esViajero && a.pais === 'USA').length, color: 'bg-green-500' },
                { label: 'Perú', value: almacenes.filter(a => a.pais === 'Peru').length, color: 'bg-amber-500' }
              ]}
            />
            <StatDistribution
              title="Competidores por Nivel de Amenaza"
              data={[
                { label: 'Bajo', value: competidores.filter(c => c.nivelAmenaza === 'bajo').length, color: 'bg-green-500' },
                { label: 'Medio', value: competidores.filter(c => c.nivelAmenaza === 'medio').length, color: 'bg-yellow-500' },
                { label: 'Alto', value: competidores.filter(c => c.nivelAmenaza === 'alto').length, color: 'bg-red-500' }
              ]}
            />
            <StatDistribution
              title="Transportistas por Tipo"
              data={[
                { label: 'Internos', value: transportistas.filter(t => t.tipo === 'interno').length, color: 'bg-blue-500' },
                { label: 'Externos', value: transportistas.filter(t => t.tipo === 'externo').length, color: 'bg-purple-500' }
              ]}
            />
            <StatDistribution
              title="Canales de Venta"
              data={[
                { label: 'Activos', value: canales.filter(c => c.estado === 'activo').length, color: 'bg-green-500' },
                { label: 'Inactivos', value: canales.filter(c => c.estado === 'inactivo').length, color: 'bg-gray-400' }
              ]}
            />
          </div>

          {/* Alertas Críticas Consolidadas */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Alertas y Puntos de Atención
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Almacenes con capacidad crítica */}
              <AlertCard
                title="Almacenes Capacidad Crítica"
                icon={Warehouse}
                variant="danger"
                emptyMessage="Sin almacenes en capacidad crítica"
                items={(almacenStats?.almacenesCapacidadCritica || []).map(a => ({
                  id: a.id,
                  label: a.nombre,
                  value: `${a.capacidadUsada.toFixed(0)}%`,
                  sublabel: `${a.unidadesActuales} de ${a.capacidadTotal} unidades`
                }))}
                maxItems={3}
                onItemClick={() => setTabActiva('almacenes')}
              />

              {/* Próximos viajes */}
              <AlertCard
                title="Próximos Viajes"
                icon={Plane}
                variant="info"
                emptyMessage="Sin viajes programados"
                items={(almacenStats?.proximosViajes || []).slice(0, 3).map(v => ({
                  id: v.id,
                  label: v.nombre,
                  value: `${v.diasRestantes}d`,
                  sublabel: `${v.unidadesActuales} unidades`
                }))}
                maxItems={3}
                onItemClick={() => setTabActiva('almacenes')}
              />

              {/* Competidores de alto riesgo */}
              <AlertCard
                title="Competidores Alto Riesgo"
                icon={Shield}
                variant="warning"
                emptyMessage="Sin competidores de alto riesgo"
                items={(competidorStats?.competidoresAmenazaAlta || []).slice(0, 3).map(c => ({
                  id: c.id,
                  label: c.nombre,
                  value: `${c.productosAnalizados} prods`,
                  sublabel: c.plataformaPrincipal.replace('_', ' ')
                }))}
                maxItems={3}
                onItemClick={() => setTabActiva('competidores')}
              />
            </div>
          </div>

          {/* Top Performers */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-600" />
              Top Performers
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Top Clientes */}
              <AlertCard
                title="Top Clientes por Ventas"
                icon={Users}
                variant="success"
                emptyMessage="Sin datos de ventas"
                items={(clienteStats?.topClientesPorMonto || []).slice(0, 4).map(c => ({
                  id: c.clienteId,
                  label: c.nombre,
                  value: `S/ ${c.montoTotalPEN.toLocaleString()}`,
                  sublabel: `${c.montoTotalPEN > 0 ? 'Cliente activo' : ''}`
                }))}
                maxItems={4}
                onItemClick={() => setTabActiva('clientes')}
              />

              {/* Top Marcas */}
              <AlertCard
                title="Top Marcas por Productos"
                icon={Tag}
                variant="success"
                emptyMessage="Sin productos asociados"
                items={(marcaStats?.topMarcasPorVentas || []).slice(0, 4).map((m: { marcaId: string; nombre: string; ventasTotalPEN: number }) => ({
                  id: m.marcaId,
                  label: m.nombre,
                  value: `S/ ${m.ventasTotalPEN.toLocaleString()}`,
                  sublabel: 'Por ventas'
                }))}
                maxItems={4}
                onItemClick={() => setTabActiva('marcas')}
              />

              {/* Top Proveedores */}
              <AlertCard
                title="Top Proveedores por Productos"
                icon={Truck}
                variant="success"
                emptyMessage="Sin productos asociados"
                items={(proveedorStats?.topProveedoresPorCompras || []).slice(0, 4).map((p: { proveedorId: string; nombre: string; ordenesCompra: number }) => ({
                  id: p.proveedorId,
                  label: p.nombre,
                  value: `${p.ordenesCompra} órdenes`,
                  sublabel: 'Por compras'
                }))}
                maxItems={4}
                onItemClick={() => setTabActiva('proveedores')}
              />
            </div>
          </div>

          {/* Acciones Rápidas */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600" />
              Acciones Rápidas
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Button
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto py-4"
                onClick={() => {
                  setTabActiva('clientes');
                  handleOpenClienteModal();
                }}
              >
                <Users className="h-6 w-6 text-primary-600" />
                <span className="text-xs">Nuevo Cliente</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto py-4"
                onClick={() => {
                  setTabActiva('marcas');
                  handleOpenMarcaModal();
                }}
              >
                <Tag className="h-6 w-6 text-green-600" />
                <span className="text-xs">Nueva Marca</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto py-4"
                onClick={() => {
                  setTabActiva('proveedores');
                  handleOpenProveedorModal();
                }}
              >
                <Truck className="h-6 w-6 text-purple-600" />
                <span className="text-xs">Nuevo Proveedor</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto py-4"
                onClick={() => {
                  setTabActiva('almacenes');
                  handleOpenAlmacenModal();
                }}
              >
                <Warehouse className="h-6 w-6 text-amber-600" />
                <span className="text-xs">Nuevo Almacén</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto py-4"
                onClick={() => {
                  setTabActiva('competidores');
                  handleOpenCompetidorModal();
                }}
              >
                <Shield className="h-6 w-6 text-red-600" />
                <span className="text-xs">Nuevo Competidor</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto py-4"
                onClick={loadAllData}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-6 w-6 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="text-xs">Actualizar Todo</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto py-4"
                onClick={async () => {
                  if (!user) return;
                  const confirmado = await confirm({
                    title: 'Recalcular Métricas',
                    message: '¿Deseas recalcular las métricas de todos los clientes y marcas basándose en las ventas actuales? Esto es útil si borraste ventas manualmente desde Firebase.',
                    confirmText: 'Recalcular',
                    cancelText: 'Cancelar'
                  });
                  if (!confirmado) return;

                  setIsRecalculando(true);
                  try {
                    // Recalcular clientes
                    const resultadoClientes = await recalcularMetricasDesdeVentas(user.uid);
                    // Recalcular marcas
                    const resultadoMarcas = await recalcularMetricasMarcas();
                    toast.success(
                      `Métricas recalculadas: ${resultadoClientes.actualizados} clientes, ${resultadoMarcas.marcasActualizadas} marcas`,
                      'Recálculo Completado'
                    );
                  } catch (error: any) {
                    toast.error(error.message || 'Error al recalcular métricas');
                  } finally {
                    setIsRecalculando(false);
                  }
                }}
                disabled={isRecalculando}
              >
                <Calculator className={`h-6 w-6 text-blue-600 ${isRecalculando ? 'animate-pulse' : ''}`} />
                <span className="text-xs">Recalcular Métricas</span>
              </Button>
            </div>
          </div>

          {/* Resumen de Inventario por Almacén */}
          {almacenStats?.inventarioPorAlmacen && almacenStats.inventarioPorAlmacen.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-amber-600" />
                Estado de Inventario por Almacén
              </h3>
              <Card padding="md">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Almacén</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unidades</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor USD</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Capacidad</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {almacenStats.inventarioPorAlmacen.slice(0, 8).map(a => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">{a.nombre}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            <Badge variant={a.esViajero ? 'info' : 'default'} size="sm">
                              {a.esViajero ? 'Viajero' : 'Fijo'}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">{a.unidadesActuales.toLocaleString()}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">${a.valorInventarioUSD.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    a.capacidadUsada >= 90 ? 'bg-red-500' :
                                    a.capacidadUsada >= 70 ? 'bg-yellow-500' :
                                    'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(a.capacidadUsada, 100)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-medium ${
                                a.capacidadUsada >= 90 ? 'text-red-600' :
                                a.capacidadUsada >= 70 ? 'text-yellow-600' :
                                'text-green-600'
                              }`}>
                                {a.capacidadUsada.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {almacenStats.inventarioPorAlmacen.length > 8 && (
                  <div className="mt-2 text-center">
                    <Button variant="ghost" size="sm" onClick={() => setTabActiva('almacenes')}>
                      Ver todos los almacenes ({almacenStats.inventarioPorAlmacen.length})
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Cards Informativas por Tab */}
      {/* Nota: Los tabs de Clientes, Marcas, Proveedores y Competidores ahora usan componentes especializados con sus propios dashboards */}

      {/* Nota: El módulo de Almacenes ahora usa AlmacenesLogistica con su propio dashboard, KPIs y búsqueda integrada */}

      {/* Contenido por Tab */}
      {loading && !isRefreshing ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* ============ CLIENTES (CRM Potenciado) ============ */}
          {tabActiva === 'clientes' && (
            <ClientesCRM
              onOpenClienteModal={handleOpenClienteModal}
              onViewCliente={(cliente) => setDetalleCliente(cliente)}
              onEditCliente={(cliente) => handleOpenClienteModal(cliente)}
              onDeleteCliente={handleDeleteCliente}
            />
          )}

          {/* ============ MARCAS (Analytics Potenciado) ============ */}
          {tabActiva === 'marcas' && (
            <MarcasAnalytics
              onOpenMarcaModal={handleOpenMarcaModal}
              onViewMarca={(marca) => setDetalleMarca(marca)}
              onEditMarca={(marca) => handleOpenMarcaModal(marca)}
              onDeleteMarca={handleDeleteMarca}
            />
          )}

          {/* ============ PROVEEDORES (SRM Potenciado) ============ */}
          {tabActiva === 'proveedores' && (
            <ProveedoresSRM
              onOpenProveedorModal={handleOpenProveedorModal}
              onViewProveedor={(proveedor) => setDetalleProveedor(proveedor)}
              onEditProveedor={(proveedor) => handleOpenProveedorModal(proveedor)}
              onDeleteProveedor={handleDeleteProveedor}
            />
          )}

          {/* ============ ALMACENES (Logística Potenciado) ============ */}
          {tabActiva === 'almacenes' && (
            <AlmacenesLogistica
              onOpenAlmacenModal={handleOpenAlmacenModal}
              onViewAlmacen={(almacen) => setDetalleAlmacen(almacen)}
              onEditAlmacen={(almacen) => handleOpenAlmacenModal(almacen)}
            />
          )}

          {/* ============ COMPETIDORES (Intel Potenciado) ============ */}
          {tabActiva === 'competidores' && (
            <CompetidoresIntel
              onOpenCompetidorModal={handleOpenCompetidorModal}
              onViewCompetidor={(competidor) => setDetalleCompetidor(competidor)}
              onEditCompetidor={(competidor) => handleOpenCompetidorModal(competidor)}
              onDeleteCompetidor={handleDeleteCompetidor}
            />
          )}

          {/* ============ TRANSPORTISTAS ============ */}
          {tabActiva === 'transportistas' && (
            <TransportistasLogistica />
          )}

          {/* ============ CANALES DE VENTA ============ */}
          {tabActiva === 'canales' && (
            <CanalesVentaAnalytics />
          )}

          {/* ============ CLASIFICACION DE PRODUCTOS ============ */}
          {tabActiva === 'clasificacion' && (
            <div className="space-y-8">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-indigo-900 mb-2">
                  Sistema de Clasificación de Productos
                </h3>
                <p className="text-sm text-indigo-700">
                  Gestiona los tipos de producto, categorías y etiquetas para organizar tu catálogo de manera flexible.
                  Los productos pueden tener múltiples categorías y etiquetas para mejor filtrado y SEO.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tipos de Producto */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <TipoProductoList />
                </div>

                {/* Categorias */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <CategoriaList />
                </div>
              </div>

              {/* Etiquetas - Full width */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <EtiquetaList />
              </div>
            </div>
          )}
        </>
      )}

      {/* ============ MODAL CLIENTE ============ */}
      <Modal
        isOpen={showClienteModal}
        onClose={() => {
          setShowClienteModal(false);
          setEditingCliente(null);
        }}
        title={editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                value={clienteForm.nombre || ''}
                onChange={(e) => setClienteForm({ ...clienteForm, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Juan Pérez García"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Cliente
              </label>
              <select
                value={clienteForm.tipoCliente}
                onChange={(e) => setClienteForm({ ...clienteForm, tipoCliente: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="persona">Persona Natural</option>
                <option value="empresa">Empresa</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                DNI / RUC
              </label>
              <input
                type="text"
                value={clienteForm.dniRuc || ''}
                onChange={(e) => setClienteForm({ ...clienteForm, dniRuc: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="12345678"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono (WhatsApp)
              </label>
              <input
                type="tel"
                value={clienteForm.telefono || ''}
                onChange={(e) => setClienteForm({ ...clienteForm, telefono: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="999 123 456"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={clienteForm.email || ''}
                onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="cliente@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Canal de Origen
              </label>
              <select
                value={clienteForm.canalOrigen}
                onChange={(e) => setClienteForm({ ...clienteForm, canalOrigen: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="mercadolibre">MercadoLibre</option>
                <option value="referido">Referido</option>
                <option value="web">Web</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referido por
              </label>
              <input
                type="text"
                value={clienteForm.referidoPor || ''}
                onChange={(e) => setClienteForm({ ...clienteForm, referidoPor: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Nombre de quien refirió"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas
              </label>
              <textarea
                value={clienteForm.notas || ''}
                onChange={(e) => setClienteForm({ ...clienteForm, notas: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
                placeholder="Notas internas sobre el cliente..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="ghost" onClick={() => setShowClienteModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveCliente}
              disabled={isSubmitting || !clienteForm.nombre}
            >
              {isSubmitting ? 'Guardando...' : editingCliente ? 'Actualizar' : 'Crear Cliente'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ============ MODAL MARCA ============ */}
      <Modal
        isOpen={showMarcaModal}
        onClose={() => {
          setShowMarcaModal(false);
          setEditingMarca(null);
        }}
        title={editingMarca ? 'Editar Marca' : 'Nueva Marca'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la Marca *
            </label>
            <input
              type="text"
              value={marcaForm.nombre || ''}
              onChange={(e) => setMarcaForm({ ...marcaForm, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Pfizer, NOW Foods, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Marca
              </label>
              <select
                value={marcaForm.tipoMarca}
                onChange={(e) => setMarcaForm({ ...marcaForm, tipoMarca: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="farmaceutica">Farmacéutica</option>
                <option value="suplementos">Suplementos</option>
                <option value="cosmetica">Cosmética</option>
                <option value="tecnologia">Tecnología</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                País de Origen
              </label>
              <input
                type="text"
                value={marcaForm.paisOrigen || ''}
                onChange={(e) => setMarcaForm({ ...marcaForm, paisOrigen: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="USA, Alemania, etc."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alias (separados por coma)
            </label>
            <input
              type="text"
              value={(marcaForm.alias || []).join(', ')}
              onChange={(e) => setMarcaForm({
                ...marcaForm,
                alias: e.target.value.split(',').map(a => a.trim()).filter(Boolean)
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Phizer, PFIZER, etc."
            />
            <p className="text-xs text-gray-500 mt-1">
              Nombres alternativos que puedan escribir los usuarios
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sitio Web
            </label>
            <input
              type="url"
              value={marcaForm.sitioWeb || ''}
              onChange={(e) => setMarcaForm({ ...marcaForm, sitioWeb: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="https://www.marca.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              value={marcaForm.descripcion || ''}
              onChange={(e) => setMarcaForm({ ...marcaForm, descripcion: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={2}
              placeholder="Breve descripción de la marca..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="ghost" onClick={() => setShowMarcaModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveMarca}
              disabled={isSubmitting || !marcaForm.nombre}
            >
              {isSubmitting ? 'Guardando...' : editingMarca ? 'Actualizar' : 'Crear Marca'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ============ MODAL PROVEEDOR ============ */}
      <Modal
        isOpen={showProveedorModal}
        onClose={() => {
          setShowProveedorModal(false);
          setEditingProveedor(null);
        }}
        title={editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Proveedor *
              </label>
              <input
                type="text"
                value={proveedorForm.nombre || ''}
                onChange={(e) => setProveedorForm({ ...proveedorForm, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Amazon, iHerb, Carlyle, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Proveedor
              </label>
              <select
                value={proveedorForm.tipo}
                onChange={(e) => setProveedorForm({ ...proveedorForm, tipo: e.target.value as TipoProveedor })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="distribuidor">Distribuidor</option>
                <option value="fabricante">Fabricante</option>
                <option value="mayorista">Mayorista</option>
                <option value="minorista">Minorista</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                País *
              </label>
              <select
                value={proveedorForm.pais}
                onChange={(e) => setProveedorForm({ ...proveedorForm, pais: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="USA">USA</option>
                <option value="China">China</option>
                <option value="Alemania">Alemania</option>
                <option value="India">India</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL del Sitio Web *
              </label>
              <input
                type="url"
                value={proveedorForm.url || ''}
                onChange={(e) => setProveedorForm({ ...proveedorForm, url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="https://www.amazon.com, https://www.iherb.com, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                value={proveedorForm.telefono || ''}
                onChange={(e) => setProveedorForm({ ...proveedorForm, telefono: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="+1 555 123 4567"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección
              </label>
              <input
                type="text"
                value={proveedorForm.direccion || ''}
                onChange={(e) => setProveedorForm({ ...proveedorForm, direccion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Dirección del proveedor"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas Internas
              </label>
              <textarea
                value={proveedorForm.notasInternas || ''}
                onChange={(e) => setProveedorForm({ ...proveedorForm, notasInternas: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
                placeholder="Notas internas sobre el proveedor..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="ghost" onClick={() => setShowProveedorModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveProveedor}
              disabled={isSubmitting || !proveedorForm.nombre || !proveedorForm.url}
            >
              {isSubmitting ? 'Guardando...' : editingProveedor ? 'Actualizar' : 'Crear Proveedor'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ============ MODAL ALMACÉN ============ */}
      <Modal
        isOpen={showAlmacenModal}
        onClose={() => {
          setShowAlmacenModal(false);
          setEditingAlmacen(null);
        }}
        title={editingAlmacen ? 'Editar Almacén' : 'Nuevo Almacén / Viajero'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Código (solo lectura en edición) y Nombre */}
            {editingAlmacen && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código
                </label>
                <input
                  type="text"
                  value={editingAlmacen.codigo}
                  disabled
                  className="w-full px-3 py-2 border border-gray-200 rounded-md font-mono bg-gray-100 text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">
                  El código no se puede modificar
                </p>
              </div>
            )}

            <div className={editingAlmacen ? '' : 'col-span-2'}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={almacenForm.nombre || ''}
                onChange={(e) => setAlmacenForm({ ...almacenForm, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Carlos Rodríguez, Almacén Miami..."
              />
              {!editingAlmacen && (
                <p className="text-xs text-gray-500 mt-1">
                  El código se generará automáticamente según el tipo
                </p>
              )}
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo *
              </label>
              <select
                value={almacenForm.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as TipoAlmacen;
                  setAlmacenForm({
                    ...almacenForm,
                    tipo,
                    esViajero: tipo === 'viajero',
                    pais: tipo === 'almacen_peru' ? 'Peru' : 'USA'
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="viajero">Viajero (USA - Almacena y transporta)</option>
                <option value="almacen_peru">Almacén Perú</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={almacenForm.estadoAlmacen}
                onChange={(e) => setAlmacenForm({ ...almacenForm, estadoAlmacen: e.target.value as EstadoAlmacen })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="suspendido">Suspendido</option>
              </select>
            </div>

            {/* Ubicación */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección
              </label>
              <input
                type="text"
                value={almacenForm.direccion || ''}
                onChange={(e) => setAlmacenForm({ ...almacenForm, direccion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="123 Main Street, Apt 4B"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ciudad
              </label>
              <input
                type="text"
                value={almacenForm.ciudad || ''}
                onChange={(e) => setAlmacenForm({ ...almacenForm, ciudad: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Miami, Lima, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado/Región
              </label>
              <input
                type="text"
                value={almacenForm.estado || ''}
                onChange={(e) => setAlmacenForm({ ...almacenForm, estado: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Florida, California, Lima..."
              />
            </div>

            {/* Contacto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contacto
              </label>
              <input
                type="text"
                value={almacenForm.contacto || ''}
                onChange={(e) => setAlmacenForm({ ...almacenForm, contacto: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Nombre del contacto"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono / WhatsApp
              </label>
              <input
                type="tel"
                value={almacenForm.telefono || ''}
                onChange={(e) => setAlmacenForm({ ...almacenForm, telefono: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="+1 (305) 555-0101"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={almacenForm.email || ''}
                onChange={(e) => setAlmacenForm({ ...almacenForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="contacto@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capacidad (unidades)
              </label>
              <input
                type="number"
                value={almacenForm.capacidadUnidades || ''}
                onChange={(e) => setAlmacenForm({ ...almacenForm, capacidadUnidades: parseInt(e.target.value) || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="200"
              />
            </div>

            {/* Sección específica para Viajeros */}
            {almacenForm.esViajero && (
              <>
                <div className="col-span-2 border-t pt-4 mt-2">
                  <h4 className="text-sm font-semibold text-purple-700 flex items-center">
                    <Plane className="h-4 w-4 mr-2" />
                    Configuración de Viajero
                  </h4>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frecuencia de Viaje
                  </label>
                  <select
                    value={almacenForm.frecuenciaViaje || ''}
                    onChange={(e) => setAlmacenForm({ ...almacenForm, frecuenciaViaje: e.target.value as FrecuenciaViaje })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                    <option value="bimestral">Bimestral</option>
                    <option value="variable">Variable</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Próximo Viaje
                  </label>
                  <input
                    type="date"
                    value={almacenForm.proximoViaje ? new Date(almacenForm.proximoViaje).toISOString().split('T')[0] : ''}
                    onChange={(e) => setAlmacenForm({ ...almacenForm, proximoViaje: e.target.value ? new Date(e.target.value) : undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Costo Promedio Flete (USD/unidad)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={almacenForm.costoPromedioFlete || ''}
                    onChange={(e) => setAlmacenForm({ ...almacenForm, costoPromedioFlete: parseFloat(e.target.value) || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="5.00"
                  />
                </div>
              </>
            )}

            {/* Notas */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas
              </label>
              <textarea
                value={almacenForm.notas || ''}
                onChange={(e) => setAlmacenForm({ ...almacenForm, notas: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
                placeholder="Notas adicionales sobre el almacén o viajero..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="ghost" onClick={() => setShowAlmacenModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveAlmacen}
              disabled={isSubmitting || !almacenForm.nombre}
            >
              {isSubmitting ? 'Guardando...' : editingAlmacen ? 'Actualizar' : 'Crear Almacén'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ============ MODAL COMPETIDOR ============ */}
      <Modal
        isOpen={showCompetidorModal}
        onClose={() => {
          setShowCompetidorModal(false);
          setEditingCompetidor(null);
        }}
        title={editingCompetidor ? 'Editar Competidor' : 'Nuevo Competidor'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Nombre */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Competidor *
              </label>
              <input
                type="text"
                value={competidorForm.nombre || ''}
                onChange={(e) => setCompetidorForm({ ...competidorForm, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Nombre o usuario del competidor"
              />
            </div>

            {/* Plataforma Principal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plataforma Principal *
              </label>
              <select
                value={competidorForm.plataformaPrincipal}
                onChange={(e) => setCompetidorForm({ ...competidorForm, plataformaPrincipal: e.target.value as PlataformaCompetidor })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="mercado_libre">MercadoLibre</option>
                <option value="amazon">Amazon</option>
                <option value="web_propia">Web Propia</option>
                <option value="inkafarma">InkaFarma</option>
                <option value="mifarma">MiFarma</option>
                <option value="falabella">Falabella</option>
                <option value="otra">Otra</option>
              </select>
            </div>

            {/* Nivel de Amenaza */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nivel de Amenaza
              </label>
              <select
                value={competidorForm.nivelAmenaza}
                onChange={(e) => setCompetidorForm({ ...competidorForm, nivelAmenaza: e.target.value as 'bajo' | 'medio' | 'alto' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="bajo">Bajo</option>
                <option value="medio">Medio</option>
                <option value="alto">Alto</option>
              </select>
            </div>

            {/* URLs */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL Tienda
              </label>
              <input
                type="url"
                value={competidorForm.urlTienda || ''}
                onChange={(e) => setCompetidorForm({ ...competidorForm, urlTienda: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL MercadoLibre
              </label>
              <input
                type="url"
                value={competidorForm.urlMercadoLibre || ''}
                onChange={(e) => setCompetidorForm({ ...competidorForm, urlMercadoLibre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="https://perfil.mercadolibre.com.pe/..."
              />
            </div>

            {/* Ubicación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ciudad
              </label>
              <input
                type="text"
                value={competidorForm.ciudad || ''}
                onChange={(e) => setCompetidorForm({ ...competidorForm, ciudad: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Lima, Arequipa, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Departamento
              </label>
              <input
                type="text"
                value={competidorForm.departamento || ''}
                onChange={(e) => setCompetidorForm({ ...competidorForm, departamento: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Lima, Cusco, etc."
              />
            </div>

            {/* Reputación y Estrategia */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reputación
              </label>
              <select
                value={competidorForm.reputacion}
                onChange={(e) => setCompetidorForm({ ...competidorForm, reputacion: e.target.value as ReputacionCompetidor })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="desconocida">Desconocida</option>
                <option value="excelente">Excelente</option>
                <option value="buena">Buena</option>
                <option value="regular">Regular</option>
                <option value="mala">Mala</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estrategia de Precio
              </label>
              <select
                value={competidorForm.estrategiaPrecio || ''}
                onChange={(e) => setCompetidorForm({ ...competidorForm, estrategiaPrecio: e.target.value as any || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Sin definir</option>
                <option value="premium">Premium (precios altos)</option>
                <option value="competitivo">Competitivo (precios mercado)</option>
                <option value="bajo">Bajo costo</option>
                <option value="variable">Variable</option>
              </select>
            </div>

            {/* Ventas y Líder */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ventas Estimadas (mensuales)
              </label>
              <input
                type="number"
                value={competidorForm.ventasEstimadas || ''}
                onChange={(e) => setCompetidorForm({ ...competidorForm, ventasEstimadas: parseInt(e.target.value) || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Cantidad estimada de ventas"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={competidorForm.esLiderCategoria || false}
                  onChange={(e) => setCompetidorForm({ ...competidorForm, esLiderCategoria: e.target.checked })}
                  className="mr-2 h-4 w-4 text-primary-600 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700 flex items-center">
                  <Crown className="h-4 w-4 mr-1 text-amber-500" />
                  Es líder en alguna categoría
                </span>
              </label>
            </div>

            {/* Fortalezas y Debilidades */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fortalezas
              </label>
              <textarea
                value={competidorForm.fortalezas || ''}
                onChange={(e) => setCompetidorForm({ ...competidorForm, fortalezas: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
                placeholder="Precios bajos, envío rápido..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Debilidades
              </label>
              <textarea
                value={competidorForm.debilidades || ''}
                onChange={(e) => setCompetidorForm({ ...competidorForm, debilidades: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
                placeholder="Poca variedad, mala atención..."
              />
            </div>

            {/* Notas */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas
              </label>
              <textarea
                value={competidorForm.notas || ''}
                onChange={(e) => setCompetidorForm({ ...competidorForm, notas: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
                placeholder="Notas adicionales sobre este competidor..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="ghost" onClick={() => setShowCompetidorModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveCompetidor}
              disabled={isSubmitting || !competidorForm.nombre}
            >
              {isSubmitting ? 'Guardando...' : editingCompetidor ? 'Actualizar' : 'Crear Competidor'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ============ MODALES DE DETALLE ============ */}
      <ClienteDetalleModal
        isOpen={!!detalleCliente}
        onClose={() => setDetalleCliente(null)}
        cliente={detalleCliente}
        onEdit={() => {
          if (detalleCliente) {
            handleOpenClienteModal(detalleCliente);
            setDetalleCliente(null);
          }
        }}
        onViewHistory={() => {
          if (detalleCliente) {
            setHistorialCliente(detalleCliente);
            setDetalleCliente(null);
          }
        }}
      />

      <MarcaDetalleModal
        isOpen={!!detalleMarca}
        onClose={() => setDetalleMarca(null)}
        marca={detalleMarca}
        onEdit={() => {
          if (detalleMarca) {
            handleOpenMarcaModal(detalleMarca);
            setDetalleMarca(null);
          }
        }}
      />

      <ProveedorDetalleModal
        isOpen={!!detalleProveedor}
        onClose={() => setDetalleProveedor(null)}
        proveedor={detalleProveedor}
        onEdit={() => {
          if (detalleProveedor) {
            handleOpenProveedorModal(detalleProveedor);
            setDetalleProveedor(null);
          }
        }}
      />

      <AlmacenDetalleModal
        isOpen={!!detalleAlmacen}
        onClose={() => setDetalleAlmacen(null)}
        almacen={detalleAlmacen}
        onEdit={() => {
          if (detalleAlmacen) {
            handleOpenAlmacenModal(detalleAlmacen);
            setDetalleAlmacen(null);
          }
        }}
        onViewHistory={detalleAlmacen?.esViajero ? () => {
          setHistorialViajero(detalleAlmacen);
          setDetalleAlmacen(null);
        } : undefined}
      />

      {/* Modal de historial financiero del viajero */}
      {historialViajero && (
        <ViajeroDetalle
          viajero={historialViajero}
          onClose={() => setHistorialViajero(null)}
          onEdit={() => {
            handleOpenAlmacenModal(historialViajero);
            setHistorialViajero(null);
          }}
        />
      )}

      {/* Modal de historial financiero del cliente */}
      {historialCliente && (
        <ClienteDetalle
          cliente={historialCliente}
          onClose={() => setHistorialCliente(null)}
          onEdit={() => {
            handleOpenClienteModal(historialCliente);
            setHistorialCliente(null);
          }}
        />
      )}

      <CompetidorDetalleModal
        isOpen={!!detalleCompetidor}
        onClose={() => setDetalleCompetidor(null)}
        competidor={detalleCompetidor}
        onEdit={() => {
          if (detalleCompetidor) {
            handleOpenCompetidorModal(detalleCompetidor);
            setDetalleCompetidor(null);
          }
        }}
      />

      {/* Dialogo de Confirmacion */}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};
