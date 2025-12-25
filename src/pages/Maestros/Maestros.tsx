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
  Eye
} from 'lucide-react';
import { Button, Card, Badge, Modal, KPICard, KPIGrid, AlertCard, StatDistribution } from '../../components/common';
import {
  ClienteDetalleModal,
  MarcaDetalleModal,
  ProveedorDetalleModal,
  AlmacenDetalleModal,
  CompetidorDetalleModal
} from '../../components/Maestros/DetalleModals';
import { ViajeroDetalle } from '../../components/modules/almacen/ViajeroDetalle';
import { ClienteDetalle } from '../../components/modules/cliente/ClienteDetalle';
import { useClienteStore } from '../../store/clienteStore';
import { useMarcaStore } from '../../store/marcaStore';
import { useProveedorStore } from '../../store/proveedorStore';
import { useAlmacenStore } from '../../store/almacenStore';
import { useCompetidorStore } from '../../store/competidorStore';
import { useAuthStore } from '../../store/authStore';
import type { Cliente, ClienteFormData, Competidor, CompetidorFormData, PlataformaCompetidor, ReputacionCompetidor } from '../../types/entidadesMaestras.types';
import type { Marca, MarcaFormData } from '../../types/entidadesMaestras.types';
import type { Proveedor, ProveedorFormData, TipoProveedor } from '../../types/ordenCompra.types';
import type { Almacen, AlmacenFormData, TipoAlmacen, EstadoAlmacen, FrecuenciaViaje } from '../../types/almacen.types';

type TabActiva = 'resumen' | 'clientes' | 'marcas' | 'proveedores' | 'almacenes' | 'competidores';

export const Maestros: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const [searchParams] = useSearchParams();

  // Leer tab inicial desde query param
  const tabFromUrl = searchParams.get('tab') as TabActiva | null;
  const initialTab: TabActiva = tabFromUrl && ['resumen', 'clientes', 'marcas', 'proveedores', 'almacenes', 'competidores'].includes(tabFromUrl)
    ? tabFromUrl
    : 'resumen';

  const [tabActiva, setTabActiva] = useState<TabActiva>(initialTab);
  const [busqueda, setBusqueda] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    cambiarEstado: cambiarEstadoCliente
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
    migrarDesdeProductos
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
        fetchCompetidorStats()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filtrar por búsqueda
  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.telefono?.includes(busqueda) ||
    c.dniRuc?.includes(busqueda) ||
    c.email?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const marcasFiltradas = marcas.filter(m =>
    m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    m.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    m.alias?.some(a => a.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const proveedoresFiltrados = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.url?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const almacenesFiltrados = almacenes.filter(a =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.ciudad?.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.estado?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const competidoresFiltrados = competidores.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.alias?.some(a => a.toLowerCase().includes(busqueda.toLowerCase()))
  );

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
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCliente = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este cliente?')) return;
    try {
      await deleteCliente(id);
    } catch (error: any) {
      alert(error.message);
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
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMarca = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta marca?')) return;
    try {
      await deleteMarca(id);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleMigrarMarcas = async () => {
    if (!user) return;
    if (!confirm('¿Desea migrar las marcas existentes desde los productos? Esto creará marcas basadas en los nombres de marca actuales.')) return;

    try {
      const resultado = await migrarDesdeProductos(user.uid);
      alert(`Migración completada: ${resultado.migradas} marcas creadas. ${resultado.errores.length > 0 ? `Errores: ${resultado.errores.join(', ')}` : ''}`);
    } catch (error: any) {
      alert(error.message);
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
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProveedor = async (id: string) => {
    if (!user) return;
    if (!confirm('¿Está seguro de eliminar este proveedor?')) return;
    try {
      await deleteProveedor(id, user.uid);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleToggleProveedorActivo = async (proveedor: Proveedor) => {
    if (!user) return;
    try {
      await cambiarEstadoProveedor(proveedor.id, !proveedor.activo, user.uid);
    } catch (error: any) {
      alert(error.message);
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
    } catch (error: any) {
      alert(error.message);
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
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCompetidor = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este competidor?')) return;
    try {
      await deleteCompetidor(id);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleToggleCompetidorEstado = async (competidor: Competidor) => {
    if (!user) return;
    try {
      const nuevoEstado = competidor.estado === 'activo' ? 'inactivo' : 'activo';
      await cambiarEstadoCompetidor(competidor.id, nuevoEstado, user.uid);
    } catch (error: any) {
      alert(error.message);
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

  const loading = loadingClientes || loadingMarcas || loadingProveedores || loadingAlmacenes || loadingCompetidores;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Maestros</h1>
          <p className="text-gray-600 mt-1">
            Administra clientes, marcas, proveedores y almacenes
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="ghost"
            onClick={loadAllData}
            disabled={isRefreshing}
            title="Actualizar datos"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          {tabActiva === 'clientes' && (
            <Button variant="primary" onClick={() => handleOpenClienteModal()}>
              <Plus className="h-5 w-5 mr-2" />
              Nuevo Cliente
            </Button>
          )}
          {tabActiva === 'marcas' && (
            <Button variant="primary" onClick={() => handleOpenMarcaModal()}>
              <Plus className="h-5 w-5 mr-2" />
              Nueva Marca
            </Button>
          )}
          {tabActiva === 'proveedores' && (
            <Button variant="primary" onClick={() => handleOpenProveedorModal()}>
              <Plus className="h-5 w-5 mr-2" />
              Nuevo Proveedor
            </Button>
          )}
          {tabActiva === 'almacenes' && (
            <Button variant="primary" onClick={() => handleOpenAlmacenModal()}>
              <Plus className="h-5 w-5 mr-2" />
              Nuevo Almacén
            </Button>
          )}
          {tabActiva === 'competidores' && (
            <Button variant="primary" onClick={() => handleOpenCompetidorModal()}>
              <Plus className="h-5 w-5 mr-2" />
              Nuevo Competidor
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card padding="md" className={tabActiva === 'resumen' ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}>
          <button
            onClick={() => setTabActiva('resumen')}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Resumen</div>
                <div className="text-2xl font-bold text-indigo-600 mt-1">
                  360°
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Visión consolidada
                </div>
              </div>
              <LayoutDashboard className="h-10 w-10 text-indigo-400" />
            </div>
          </button>
        </Card>

        <Card padding="md" className={tabActiva === 'clientes' ? 'ring-2 ring-primary-500' : ''}>
          <button
            onClick={() => setTabActiva('clientes')}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Clientes</div>
                <div className="text-2xl font-bold text-primary-600 mt-1">
                  {clientes.length}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {clienteStats?.clientesConCompras || 0} con compras
                </div>
              </div>
              <Users className="h-10 w-10 text-primary-400" />
            </div>
          </button>
        </Card>

        <Card padding="md" className={tabActiva === 'marcas' ? 'ring-2 ring-primary-500' : ''}>
          <button
            onClick={() => setTabActiva('marcas')}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Marcas</div>
                <div className="text-2xl font-bold text-green-600 mt-1">
                  {marcas.length}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {marcaStats?.marcasConProductos || 0} con productos
                </div>
              </div>
              <Tag className="h-10 w-10 text-green-400" />
            </div>
          </button>
        </Card>

        <Card padding="md" className={tabActiva === 'proveedores' ? 'ring-2 ring-primary-500' : ''}>
          <button
            onClick={() => setTabActiva('proveedores')}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Proveedores</div>
                <div className="text-2xl font-bold text-purple-600 mt-1">
                  {proveedores.length}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {proveedores.filter(p => p.activo).length} activos
                </div>
              </div>
              <Truck className="h-10 w-10 text-purple-400" />
            </div>
          </button>
        </Card>

        <Card padding="md" className={tabActiva === 'almacenes' ? 'ring-2 ring-primary-500' : ''}>
          <button
            onClick={() => setTabActiva('almacenes')}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Almacenes</div>
                <div className="text-2xl font-bold text-amber-600 mt-1">
                  {almacenes.length}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {viajeros.length} viajeros · {almacenesUSA.length} USA · {almacenesPeru.length} Perú
                </div>
              </div>
              <Warehouse className="h-10 w-10 text-amber-400" />
            </div>
          </button>
        </Card>

        <Card padding="md" className={tabActiva === 'competidores' ? 'ring-2 ring-primary-500' : ''}>
          <button
            onClick={() => setTabActiva('competidores')}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Competidores</div>
                <div className="text-2xl font-bold text-red-600 mt-1">
                  {competidores.length}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {competidoresActivos.length} activos · {competidores.filter(c => c.nivelAmenaza === 'alto').length} alto riesgo
                </div>
              </div>
              <Shield className="h-10 w-10 text-red-400" />
            </div>
          </button>
        </Card>
      </div>

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
                value={clientes.length + marcas.length + proveedores.length + almacenes.length + competidores.length}
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
            </KPIGrid>
          </div>

          {/* Distribución de Entidades */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                  sublabel: `${c.totalCompras} compras`
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
                items={(marcaStats?.topMarcasPorProductos || []).slice(0, 4).map(m => ({
                  id: m.id,
                  label: m.nombre,
                  value: `${m.productosActivos} prods`,
                  sublabel: m.tipoMarca
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
                items={(proveedorStats?.topProveedoresPorProductos || []).slice(0, 4).map(p => ({
                  id: p.id,
                  label: p.nombre,
                  value: `${p.productosActivos} prods`,
                  sublabel: p.tipo
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
      {tabActiva === 'clientes' && clienteStats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <KPIGrid columns={4}>
              <KPICard
                title="Ticket Promedio"
                value={`S/ ${clienteStats.ticketPromedioGeneral?.toFixed(0) || 0}`}
                icon={DollarSign}
                variant="success"
                size="sm"
              />
              <KPICard
                title="Clientes Activos"
                value={clienteStats.clientesActivos || 0}
                subtitle="con estado activo"
                icon={CheckCircle}
                variant="info"
                size="sm"
              />
              <KPICard
                title="Nuevos Este Mes"
                value={clienteStats.clientesNuevosMes || 0}
                icon={TrendingUp}
                variant="success"
                size="sm"
              />
              <KPICard
                title="Con Compras"
                value={clienteStats.clientesConCompras || 0}
                subtitle={`${((clienteStats.clientesConCompras || 0) / (clienteStats.totalClientes || 1) * 100).toFixed(0)}% del total`}
                icon={ShoppingCart}
                variant="default"
                size="sm"
              />
            </KPIGrid>
          </div>
          {clienteStats.topClientesPorMonto && clienteStats.topClientesPorMonto.length > 0 && (
            <AlertCard
              title="Top Clientes"
              icon={Crown}
              variant="success"
              items={clienteStats.topClientesPorMonto.slice(0, 3).map(c => ({
                id: c.clienteId,
                label: c.nombre,
                value: `S/ ${c.montoTotalPEN.toFixed(0)}`
              }))}
              emptyMessage="Sin datos de compras"
            />
          )}
        </div>
      )}

      {tabActiva === 'marcas' && marcaStats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <KPIGrid columns={4}>
              <KPICard
                title="Marcas Activas"
                value={marcaStats.marcasActivas || 0}
                icon={Tag}
                variant="info"
                size="sm"
              />
              <KPICard
                title="Con Productos"
                value={marcaStats.marcasConProductos || 0}
                icon={Package}
                variant="success"
                size="sm"
              />
              <KPICard
                title="Margen Promedio"
                value={`${(marcaStats.topMarcasPorMargen?.[0]?.margenPromedio || 0).toFixed(1)}%`}
                subtitle="mejor marca"
                icon={TrendingUp}
                variant="success"
                size="sm"
              />
              <KPICard
                title="Total Marcas"
                value={marcaStats.totalMarcas || 0}
                icon={BarChart3}
                variant="default"
                size="sm"
              />
            </KPIGrid>
          </div>
          {marcaStats.topMarcasPorVentas && marcaStats.topMarcasPorVentas.length > 0 && (
            <AlertCard
              title="Top Marcas por Ventas"
              icon={Crown}
              variant="success"
              items={marcaStats.topMarcasPorVentas.slice(0, 3).map(m => ({
                id: m.marcaId,
                label: m.nombre,
                value: `S/ ${m.ventasTotalPEN.toFixed(0)}`,
                sublabel: `${m.margenPromedio.toFixed(1)}% margen`
              }))}
              emptyMessage="Sin datos de ventas"
            />
          )}
        </div>
      )}

      {tabActiva === 'proveedores' && proveedorStats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <KPIGrid columns={4}>
              <KPICard
                title="Proveedores Activos"
                value={proveedorStats.proveedoresActivos || 0}
                icon={Truck}
                variant="info"
                size="sm"
              />
              <KPICard
                title="Total Compras"
                value={`$${((proveedorStats.topProveedoresPorCompras?.reduce((sum, p) => sum + p.montoTotalUSD, 0) || 0) / 1000).toFixed(1)}K`}
                subtitle="USD acumulado"
                icon={DollarSign}
                variant="success"
                size="sm"
              />
              <KPICard
                title="USA"
                value={proveedorStats.proveedoresPorPais?.['USA'] || 0}
                icon={Globe}
                variant="default"
                size="sm"
              />
              <KPICard
                title="China"
                value={proveedorStats.proveedoresPorPais?.['China'] || 0}
                icon={Globe}
                variant="default"
                size="sm"
              />
            </KPIGrid>
          </div>
          {proveedorStats.topProveedoresPorCompras && proveedorStats.topProveedoresPorCompras.length > 0 && (
            <AlertCard
              title="Top Proveedores"
              icon={Crown}
              variant="success"
              items={proveedorStats.topProveedoresPorCompras.slice(0, 3).map(p => ({
                id: p.proveedorId,
                label: p.nombre,
                value: `$${p.montoTotalUSD.toFixed(0)}`,
                sublabel: `${p.ordenesCompra} órdenes`
              }))}
              emptyMessage="Sin datos de compras"
            />
          )}
        </div>
      )}

      {tabActiva === 'almacenes' && almacenStats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <KPIGrid columns={4}>
              <KPICard
                title="Unidades USA"
                value={almacenStats.unidadesTotalesUSA || 0}
                icon={Package}
                variant="info"
                size="sm"
              />
              <KPICard
                title="Valor Inventario"
                value={`$${((almacenStats.valorInventarioUSA || 0) / 1000).toFixed(1)}K`}
                subtitle="USD en almacenes"
                icon={DollarSign}
                variant="success"
                size="sm"
              />
              <KPICard
                title="Viajeros"
                value={almacenStats.viajeros || 0}
                subtitle={`de ${almacenStats.almacenesUSA || 0} USA`}
                icon={Plane}
                variant="default"
                size="sm"
              />
              <KPICard
                title="Capacidad Usada"
                value={`${(almacenStats.capacidadPromedioUsada || 0).toFixed(0)}%`}
                icon={Warehouse}
                variant={almacenStats.capacidadPromedioUsada > 80 ? 'warning' : 'default'}
                size="sm"
              />
            </KPIGrid>
          </div>
          <div className="space-y-4">
            {almacenStats.proximosViajes && almacenStats.proximosViajes.length > 0 && (
              <AlertCard
                title="Próximos Viajes"
                icon={Plane}
                variant="info"
                items={almacenStats.proximosViajes.slice(0, 3).map(v => ({
                  id: v.id,
                  label: v.nombre,
                  value: `${v.diasRestantes}d`,
                  sublabel: `${v.unidadesActuales} uds`
                }))}
                emptyMessage="Sin viajes programados"
              />
            )}
            {almacenStats.almacenesCapacidadCritica && almacenStats.almacenesCapacidadCritica.length > 0 && (
              <AlertCard
                title="Capacidad Crítica"
                icon={AlertTriangle}
                variant="warning"
                items={almacenStats.almacenesCapacidadCritica.map(a => ({
                  id: a.id,
                  label: a.nombre,
                  value: `${a.capacidadUsada.toFixed(0)}%`,
                  sublabel: `${a.unidadesActuales}/${a.capacidadTotal}`
                }))}
                emptyMessage="Todo en orden"
              />
            )}
          </div>
        </div>
      )}

      {tabActiva === 'competidores' && competidorStats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <KPIGrid columns={4}>
              <KPICard
                title="Competidores Activos"
                value={competidorStats.activos || 0}
                icon={Shield}
                variant="info"
                size="sm"
              />
              <KPICard
                title="Amenaza Alta"
                value={competidorStats.porNivelAmenaza?.['alto'] || 0}
                icon={AlertTriangle}
                variant="danger"
                size="sm"
              />
              <KPICard
                title="Productos Analizados"
                value={competidorStats.totalProductosAnalizados || 0}
                icon={Search}
                variant="default"
                size="sm"
              />
              <KPICard
                title="Líderes"
                value={competidorStats.lideresCategoria || 0}
                subtitle="de categoría"
                icon={Crown}
                variant="warning"
                size="sm"
              />
            </KPIGrid>
          </div>
          <div className="space-y-4">
            {competidorStats.competidoresAmenazaAlta && competidorStats.competidoresAmenazaAlta.length > 0 && (
              <AlertCard
                title="Amenaza Alta - Monitorear"
                icon={AlertTriangle}
                variant="danger"
                items={competidorStats.competidoresAmenazaAlta.slice(0, 4).map(c => ({
                  id: c.id,
                  label: c.nombre,
                  value: c.codigo,
                  sublabel: `${c.productosAnalizados} productos`
                }))}
                emptyMessage="Sin amenazas altas"
              />
            )}
            {competidorStats.topCompetidoresPorAnalisis && competidorStats.topCompetidoresPorAnalisis.length > 0 && (
              <AlertCard
                title="Más Analizados"
                icon={Activity}
                variant="info"
                items={competidorStats.topCompetidoresPorAnalisis.slice(0, 3).map(c => ({
                  id: c.id,
                  label: c.nombre,
                  value: `${c.productosAnalizados}`,
                  sublabel: `S/ ${c.precioPromedio.toFixed(0)} prom.`
                }))}
                emptyMessage="Sin análisis"
              />
            )}
          </div>
        </div>
      )}

      {/* Barra de búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={
            tabActiva === 'clientes' ? 'Buscar por nombre, teléfono, DNI o email...' :
            tabActiva === 'marcas' ? 'Buscar por nombre de marca...' :
            tabActiva === 'proveedores' ? 'Buscar por nombre de proveedor...' :
            tabActiva === 'almacenes' ? 'Buscar por nombre, código o ciudad del almacén...' :
            'Buscar por nombre de competidor...'
          }
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Contenido por Tab */}
      {loading && !isRefreshing ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* ============ CLIENTES ============ */}
          {tabActiva === 'clientes' && (
            <Card padding="none">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  Clientes ({clientesFiltrados.length})
                </h3>
              </div>

              {clientesFiltrados.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No hay clientes registrados</p>
                  <Button
                    variant="primary"
                    onClick={() => handleOpenClienteModal()}
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Primer Cliente
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {clientesFiltrados.map((cliente) => (
                    <div
                      key={cliente.id}
                      className="px-6 py-4 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                          {cliente.tipoCliente === 'empresa' ? (
                            <Building2 className="h-5 w-5 text-primary-600" />
                          ) : (
                            <User className="h-5 w-5 text-primary-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            {cliente.codigo && (
                              <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{cliente.codigo}</span>
                            )}
                            <span className="font-medium text-gray-900">{cliente.nombre}</span>
                            <Badge variant={getEstadoColor(cliente.estado)}>
                              {cliente.estado}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                            {cliente.telefono && (
                              <span className="flex items-center">
                                <Phone className="h-3 w-3 mr-1" />
                                {cliente.telefono}
                              </span>
                            )}
                            {cliente.email && (
                              <span className="flex items-center">
                                <Mail className="h-3 w-3 mr-1" />
                                {cliente.email}
                              </span>
                            )}
                            {cliente.dniRuc && (
                              <span className="flex items-center">
                                <User className="h-3 w-3 mr-1" />
                                {cliente.dniRuc}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {cliente.metricas.totalCompras} compras
                          </div>
                          <div className="text-xs text-gray-500">
                            S/ {cliente.metricas.montoTotalPEN.toFixed(0)} total
                          </div>
                        </div>

                        <div className="flex space-x-1">
                          <button
                            onClick={() => setDetalleCliente(cliente)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenClienteModal(cliente)}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCliente(cliente.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* ============ MARCAS ============ */}
          {tabActiva === 'marcas' && (
            <Card padding="none">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  Marcas ({marcasFiltradas.length})
                </h3>
                {marcas.length === 0 && (
                  <Button variant="secondary" onClick={handleMigrarMarcas} size="sm">
                    Migrar desde Productos
                  </Button>
                )}
              </div>

              {marcasFiltradas.length === 0 ? (
                <div className="text-center py-12">
                  <Tag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">No hay marcas registradas</p>
                  <div className="flex justify-center space-x-3">
                    <Button
                      variant="secondary"
                      onClick={handleMigrarMarcas}
                    >
                      Migrar desde Productos
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => handleOpenMarcaModal()}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Crear Marca
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {marcasFiltradas.map((marca) => (
                    <div
                      key={marca.id}
                      className="px-6 py-4 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <Tag className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            {marca.codigo && (
                              <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{marca.codigo}</span>
                            )}
                            <span className="font-medium text-gray-900">{marca.nombre}</span>
                            <span className={`px-2 py-0.5 text-xs rounded ${getTipoMarcaColor(marca.tipoMarca)}`}>
                              {marca.tipoMarca}
                            </span>
                            <Badge variant={getEstadoColor(marca.estado)}>
                              {marca.estado}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                            {marca.paisOrigen && (
                              <span className="flex items-center">
                                <Globe className="h-3 w-3 mr-1" />
                                {marca.paisOrigen}
                              </span>
                            )}
                            {marca.alias && marca.alias.length > 0 && (
                              <span className="text-xs text-gray-400">
                                Alias: {marca.alias.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="flex items-center text-sm text-gray-900">
                            <Package className="h-3 w-3 mr-1" />
                            {marca.metricas.productosActivos} productos
                          </div>
                          <div className="text-xs text-gray-500">
                            {marca.metricas.unidadesVendidas} unidades vendidas
                          </div>
                        </div>

                        <div className="flex space-x-1">
                          <button
                            onClick={() => setDetalleMarca(marca)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenMarcaModal(marca)}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteMarca(marca.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* ============ PROVEEDORES ============ */}
          {tabActiva === 'proveedores' && (
            <Card padding="none">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  Proveedores ({proveedoresFiltrados.length})
                </h3>
              </div>

              {proveedoresFiltrados.length === 0 ? (
                <div className="text-center py-12">
                  <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No hay proveedores registrados</p>
                  <Button
                    variant="primary"
                    onClick={() => handleOpenProveedorModal()}
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Primer Proveedor
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {proveedoresFiltrados.map((proveedor) => (
                    <div
                      key={proveedor.id}
                      className="px-6 py-4 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Truck className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            {proveedor.codigo && (
                              <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{proveedor.codigo}</span>
                            )}
                            <span className="font-medium text-gray-900">{proveedor.nombre}</span>
                            <Badge variant={proveedor.activo ? 'success' : 'default'}>
                              {proveedor.activo ? 'Activo' : 'Inactivo'}
                            </Badge>
                            <span className={`px-2 py-0.5 text-xs rounded ${getTipoProveedorColor(proveedor.tipo)}`}>
                              {proveedor.tipo}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                            {proveedor.url && (
                              <a
                                href={proveedor.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center text-blue-600 hover:text-blue-800"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Sitio web
                              </a>
                            )}
                            {proveedor.telefono && (
                              <span className="flex items-center">
                                <Phone className="h-3 w-3 mr-1" />
                                {proveedor.telefono}
                              </span>
                            )}
                            <span className="flex items-center">
                              <Globe className="h-3 w-3 mr-1" />
                              {proveedor.pais}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="flex items-center text-sm text-gray-900">
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            {proveedor.metricas?.ordenesCompra || 0} órdenes
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <Search className="h-3 w-3 mr-1" />
                            {proveedor.metricas?.productosAnalizados || 0} productos analizados
                          </div>
                          {(proveedor.metricas?.montoTotalUSD || 0) > 0 && (
                            <div className="flex items-center text-xs text-gray-500">
                              <DollarSign className="h-3 w-3" />
                              {proveedor.metricas?.montoTotalUSD.toFixed(0)} USD total
                            </div>
                          )}
                        </div>

                        <div className="flex space-x-1">
                          <button
                            onClick={() => setDetalleProveedor(proveedor)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenProveedorModal(proveedor)}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProveedor(proveedor.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* ============ ALMACENES ============ */}
          {tabActiva === 'almacenes' && (
            <Card padding="none">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  Almacenes y Viajeros ({almacenesFiltrados.length})
                </h3>
              </div>

              {almacenesFiltrados.length === 0 ? (
                <div className="text-center py-12">
                  <Warehouse className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No hay almacenes registrados</p>
                  <Button
                    variant="primary"
                    onClick={() => handleOpenAlmacenModal()}
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Primer Almacén
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {almacenesFiltrados.map((almacen) => (
                    <div
                      key={almacen.id}
                      className="px-6 py-4 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          almacen.esViajero ? 'bg-purple-100' : almacen.pais === 'USA' ? 'bg-blue-100' : 'bg-green-100'
                        }`}>
                          {almacen.esViajero ? (
                            <Plane className={`h-5 w-5 text-purple-600`} />
                          ) : (
                            <Warehouse className={`h-5 w-5 ${almacen.pais === 'USA' ? 'text-blue-600' : 'text-green-600'}`} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">{almacen.nombre}</span>
                            <span className="text-xs text-gray-500 font-mono">{almacen.codigo}</span>
                            <Badge variant={almacen.estadoAlmacen === 'activo' ? 'success' : 'default'}>
                              {almacen.estadoAlmacen}
                            </Badge>
                            <span className={`px-2 py-0.5 text-xs rounded ${getTipoAlmacenColor(almacen.tipo)}`}>
                              {almacen.tipo === 'viajero' ? 'Viajero' : 'Perú'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                            <span className="flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              {almacen.ciudad}{almacen.estado ? `, ${almacen.estado}` : ''} - {almacen.pais}
                            </span>
                            {almacen.telefono && (
                              <span className="flex items-center">
                                <Phone className="h-3 w-3 mr-1" />
                                {almacen.telefono}
                              </span>
                            )}
                            {almacen.esViajero && almacen.proximoViaje && (
                              <span className="flex items-center text-purple-600">
                                <Calendar className="h-3 w-3 mr-1" />
                                Próximo viaje: {formatProximoViaje(almacen.proximoViaje)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="flex items-center text-sm text-gray-900">
                            <Package className="h-3 w-3 mr-1" />
                            {almacen.unidadesActuales || 0} unidades
                          </div>
                          {(almacen.valorInventarioUSD || 0) > 0 && (
                            <div className="flex items-center text-xs text-gray-500">
                              <DollarSign className="h-3 w-3" />
                              {almacen.valorInventarioUSD?.toFixed(0)} USD
                            </div>
                          )}
                          {almacen.esViajero && almacen.frecuenciaViaje && (
                            <div className="text-xs text-purple-500">
                              Viaja: {almacen.frecuenciaViaje}
                            </div>
                          )}
                        </div>

                        <div className="flex space-x-1">
                          <button
                            onClick={() => setDetalleAlmacen(almacen)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenAlmacenModal(almacen)}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* ============ COMPETIDORES ============ */}
          {tabActiva === 'competidores' && (
            <Card padding="none">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  Competidores ({competidoresFiltrados.length})
                </h3>
              </div>

              {competidoresFiltrados.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No hay competidores registrados</p>
                  <Button
                    variant="primary"
                    onClick={() => handleOpenCompetidorModal()}
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Registrar Primer Competidor
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {competidoresFiltrados.map((competidor) => (
                    <div
                      key={competidor.id}
                      className="px-6 py-4 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          competidor.nivelAmenaza === 'alto' ? 'bg-red-100' :
                          competidor.nivelAmenaza === 'medio' ? 'bg-yellow-100' : 'bg-green-100'
                        }`}>
                          <Shield className={`h-5 w-5 ${
                            competidor.nivelAmenaza === 'alto' ? 'text-red-600' :
                            competidor.nivelAmenaza === 'medio' ? 'text-yellow-600' : 'text-green-600'
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            {competidor.codigo && (
                              <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{competidor.codigo}</span>
                            )}
                            <span className="font-medium text-gray-900">{competidor.nombre}</span>
                            <Badge variant={getEstadoColor(competidor.estado)}>
                              {competidor.estado}
                            </Badge>
                            <span className={`px-2 py-0.5 text-xs rounded ${getPlataformaColor(competidor.plataformaPrincipal)}`}>
                              {getPlataformaLabel(competidor.plataformaPrincipal)}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded ${getNivelAmenazaColor(competidor.nivelAmenaza)}`}>
                              {competidor.nivelAmenaza === 'alto' ? 'Alto Riesgo' :
                               competidor.nivelAmenaza === 'medio' ? 'Riesgo Medio' : 'Bajo Riesgo'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                            {competidor.ciudad && (
                              <span className="flex items-center">
                                <MapPin className="h-3 w-3 mr-1" />
                                {competidor.ciudad}{competidor.departamento ? `, ${competidor.departamento}` : ''}
                              </span>
                            )}
                            {competidor.esLiderCategoria && (
                              <span className="flex items-center text-amber-600">
                                <Crown className="h-3 w-3 mr-1" />
                                Líder en categoría
                              </span>
                            )}
                            {competidor.urlTienda && (
                              <a
                                href={competidor.urlTienda}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center text-blue-600 hover:underline"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Ver tienda
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="flex items-center text-sm text-gray-900">
                            <Package className="h-3 w-3 mr-1" />
                            {competidor.metricas?.productosAnalizados || 0} productos analizados
                          </div>
                          {(competidor.metricas?.precioPromedio || 0) > 0 && (
                            <div className="flex items-center text-xs text-gray-500">
                              <DollarSign className="h-3 w-3" />
                              S/ {competidor.metricas?.precioPromedio?.toFixed(2)} precio prom.
                            </div>
                          )}
                          {competidor.estrategiaPrecio && (
                            <div className="text-xs text-gray-500">
                              Estrategia: {competidor.estrategiaPrecio}
                            </div>
                          )}
                        </div>

                        <div className="flex space-x-1">
                          <button
                            onClick={() => setDetalleCompetidor(competidor)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenCompetidorModal(competidor)}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCompetidor(competidor.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
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
    </div>
  );
};
