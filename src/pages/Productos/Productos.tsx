import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Search, Filter, X, Package, Trash2, BarChart3 } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import { Button, Card, Modal, GradientHeader } from '../../components/common';
import { ProductoForm } from '../../components/modules/productos/ProductoForm';
import { ProductoTable } from '../../components/modules/productos/ProductoTable';
import { ProductoCard } from '../../components/modules/productos/ProductoCard';
import { InvestigacionModal } from '../../components/modules/productos/InvestigacionModal';
import { ArchivoModal } from '../../components/modules/productos/PapeleraModal';
// VincularVariantesModal removed — replaced by ProductoCreacionWizard flows
import { DashboardCatalogo } from '../../components/modules/productos/DashboardCatalogo';
import { ProductoCreacionWizard, type TipoCreacion } from '../../components/modules/productos/ProductoCreacionWizard';
import { FilterChip } from '../../components/modules/productos/FilterChip';
import { FiltrosRapidos } from '../../components/modules/productos/FiltrosRapidos';
import { FiltrosDrawerMobile } from '../../components/modules/productos/FiltrosDrawerMobile';
import { BuscadorGrupoProducto } from '../../components/modules/productos/BuscadorGrupoProducto';
import { FormVarianteReducida, type VarianteReducidaData } from '../../components/modules/productos/FormVarianteReducida';
import { VariantesTable, type VarianteRow } from '../../components/modules/productos/VariantesTable';
import { ProductoService } from '../../services/producto.service';
import { useProductoStore } from '../../store/productoStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { useAuthStore } from '../../store/authStore';
import { useTipoProductoStore } from '../../store/tipoProductoStore';
import { useCategoriaStore } from '../../store/categoriaStore';
import { useEtiquetaStore } from '../../store/etiquetaStore';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import type { Producto, ProductoFormData, EstadoProducto, InvestigacionFormData } from '../../types/producto.types';
import type { TipoCambio } from '../../types/tipoCambio.types';

export const Productos: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const toast = useToastStore();
  const { productos, archivados, loading, loadingArchivados, fetchProductos, fetchArchivados, createProducto, updateProducto, deleteProducto, reactivarProducto, getVariantes, vincularVariante, guardarInvestigacion, eliminarInvestigacion } = useProductoStore();
  const { getTCDelDia } = useTipoCambioStore();
  const { tiposActivos, fetchTiposActivos } = useTipoProductoStore();
  const { categoriasActivas, fetchCategoriasActivas } = useCategoriaStore();
  const { etiquetasActivas, fetchEtiquetasActivas } = useEtiquetaStore();
  const productosPorLinea = useLineaFilter(
    Array.isArray(productos) ? productos : [],
    p => p.lineaNegocioId
  );

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isInvestigacionModalOpen, setIsInvestigacionModalOpen] = useState(false);
  const [isArchivoModalOpen, setIsArchivoModalOpen] = useState(false);
  // isVincularModalOpen removed — replaced by wizard flows
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isBuscadorVarianteOpen, setIsBuscadorVarianteOpen] = useState(false);
  const [isFormVarianteReducidaOpen, setIsFormVarianteReducidaOpen] = useState(false);
  const [grupoSeleccionadoParaVariante, setGrupoSeleccionadoParaVariante] = useState<Producto | null>(null);
  const [wizardTipo, setWizardTipo] = useState<'simple' | 'con_variantes' | 'variante_existente'>('simple');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tipoCambioActual, setTipoCambioActual] = useState<TipoCambio | null>(null);
  const [variantesDelProducto, setVariantesDelProducto] = useState<Producto[]>([]);
  const [parentProducto, setParentProducto] = useState<Producto | null>(null);

  // Filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filters, setFilters] = useState({
    estado: '' as EstadoProducto | '',
    grupo: '',
    marca: '',
    stockStatus: '' as 'todos' | 'critico' | 'agotado' | '',
    investigacion: '' as 'todos' | 'sin_investigar' | 'vigente' | 'vencida' | 'importar' | 'descartar' | '',
    tipoProductoId: '',
    categoriaId: '',
    etiquetaId: ''
  });

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Ordenamiento múltiple
  const [sortConfigs, setSortConfigs] = useState<Array<{
    key: string;
    direction: 'asc' | 'desc';
  }>>([
    { key: 'sku', direction: 'desc' },
  ]);

  // Detectar si Ctrl está presionado para multiorden
  const [ctrlPressed, setCtrlPressed] = useState(false);

  // Escuchar teclas Ctrl
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') setCtrlPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') setCtrlPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Handler para ordenamiento
  const handleSort = (key: string) => {
    setSortConfigs(prev => {
      const existingIndex = prev.findIndex(s => s.key === key);

      if (ctrlPressed) {
        // Multiorden: agregar o cambiar dirección
        if (existingIndex >= 0) {
          // Ya existe, cambiar dirección o remover
          const existing = prev[existingIndex];
          if (existing.direction === 'asc') {
            // Cambiar a desc
            const newConfigs = [...prev];
            newConfigs[existingIndex] = { ...existing, direction: 'desc' };
            return newConfigs;
          } else {
            // Remover del ordenamiento
            return prev.filter((_, i) => i !== existingIndex);
          }
        } else {
          // Agregar nuevo ordenamiento
          return [...prev, { key, direction: 'asc' }];
        }
      } else {
        // Sin Ctrl: ordenamiento simple
        if (existingIndex >= 0 && prev.length === 1) {
          // Ya es el único, cambiar dirección o limpiar
          const existing = prev[existingIndex];
          if (existing.direction === 'asc') {
            return [{ key, direction: 'desc' }];
          } else {
            return []; // Limpiar ordenamiento
          }
        } else {
          // Nuevo ordenamiento simple
          return [{ key, direction: 'asc' }];
        }
      }
    });
    setCurrentPage(1);
  };

  useEffect(() => {
    fetchProductos();
    fetchArchivados();
    fetchTiposActivos();
    fetchCategoriasActivas();
    fetchEtiquetasActivas();
    // Cargar tipo de cambio del día
    getTCDelDia().then(tc => {
      if (tc) setTipoCambioActual(tc);
    }).catch(console.error);
  }, [fetchProductos, getTCDelDia, fetchTiposActivos, fetchCategoriasActivas, fetchEtiquetasActivas]);

  const handleCreate = () => {
    setIsWizardOpen(true);
  };

  const handleWizardSelect = (tipo: 'simple' | 'con_variantes' | 'variante_existente') => {
    setIsWizardOpen(false);
    setWizardTipo(tipo);
    if (tipo === 'simple' || tipo === 'con_variantes') {
      setSelectedProducto(null);
      setIsEditing(false);
      setIsFormModalOpen(true);
    } else if (tipo === 'variante_existente') {
      setIsBuscadorVarianteOpen(true);
    }
  };

  // Flujo 3: usuario selecciona grupo en buscador → abrir formulario reducido
  const handleGrupoSeleccionado = (producto: Producto) => {
    setGrupoSeleccionadoParaVariante(producto);
    setIsBuscadorVarianteOpen(false);
    setIsFormVarianteReducidaOpen(true);
  };

  // Flujo 3: crear variante desde formulario reducido
  const handleCrearVarianteReducida = async (data: VarianteReducidaData) => {
    if (!user || !grupoSeleccionadoParaVariante) return;
    const grupo = grupoSeleccionadoParaVariante;
    const grupoVId = grupo.grupoVarianteId || grupo.id;

    // If the group product doesn't have grupoVarianteId yet, update it
    if (!grupo.grupoVarianteId) {
      await updateProducto(grupo.id, {
        grupoVarianteId: grupoVId,
        esPrincipalGrupo: true,
        esPadre: true,
      } as any);
    }

    await createProducto({
      marca: grupo.marca,
      marcaId: grupo.marcaId,
      nombreComercial: grupo.nombreComercial,
      presentacion: grupo.presentacion || '',
      grupo: grupo.grupo || '',
      subgrupo: grupo.subgrupo || '',
      lineaNegocioId: grupo.lineaNegocioId || '',
      paisOrigen: grupo.paisOrigen || '',
      tipoProductoId: grupo.tipoProductoId || '',
      categoriaIds: grupo.categoriaIds || [],
      categoriaPrincipalId: grupo.categoriaPrincipalId || '',
      etiquetaIds: grupo.etiquetaIds || [],
      contenido: data.contenido,
      sabor: data.sabor,
      dosaje: data.dosaje,
      varianteLabel: data.varianteLabel,
      stockMinimo: data.stockMinimo,
      grupoVarianteId: grupoVId,
      esPrincipalGrupo: false,
      parentId: grupo.id,
      esVariante: true,
    } as any);

    toast.success(`Variante "${data.varianteLabel}" creada en el grupo de ${grupo.nombreComercial}`);
    setIsFormVarianteReducidaOpen(false);
    setGrupoSeleccionadoParaVariante(null);
    fetchProductos();
  };

  const handleEdit = (producto: Producto) => {
    setSelectedProducto(producto);
    setIsEditing(true);
    setIsFormModalOpen(true);
  };

  const handleView = async (producto: Producto) => {
    setSelectedProducto(producto);
    setIsViewModalOpen(true);
    // Cargar variantes si pertenece a un grupo
    if (producto.grupoVarianteId || producto.esPadre) {
      const vars = await getVariantes(producto.grupoVarianteId || producto.id);
      setVariantesDelProducto(vars.filter(v => v.id !== producto.id));
    } else {
      setVariantesDelProducto([]);
    }
  };

  const handleCreateVariante = (padre: Producto) => {
    // Pre-llenar formulario con datos del padre
    const varianteData: Partial<ProductoFormData> = {
      marca: padre.marca,
      marcaId: padre.marcaId,
      nombreComercial: padre.nombreComercial,
      grupo: padre.grupo,
      subgrupo: padre.subgrupo,
      tipoProductoId: padre.tipoProductoId,
      categoriaIds: padre.categoriaIds || [],
      categoriaPrincipalId: padre.categoriaPrincipalId,
      etiquetaIds: padre.etiquetaIds || [],
      paisOrigen: padre.paisOrigen,
      lineaNegocioId: padre.lineaNegocioId,
      atributosSkincare: padre.atributosSkincare,
      parentId: padre.id,
      esVariante: true,
    };
    setSelectedProducto(varianteData as any);
    setIsEditing(false);
    setIsFormModalOpen(true);
    setIsViewModalOpen(false);
  };

  // Detectar productos similares al crear
  const detectarDuplicados = (data: ProductoFormData): Producto[] => {
    const normalize = (s?: string) => (s ?? '').toLowerCase().trim();
    const marca = normalize(data.marca);
    const nombre = normalize(data.nombreComercial);
    const dosaje = normalize(data.dosaje);
    const contenido = normalize(data.contenido);
    const sabor = normalize(data.sabor);
    const presentacion = normalize(data.presentacion);

    return productosArray.filter(p => {
      // No comparar consigo mismo al editar
      if (isEditing && selectedProducto && p.id === selectedProducto.id) return false;

      const pMarca = normalize(p.marca);
      const pNombre = normalize(p.nombreComercial);

      // Debe coincidir al menos marca + nombre
      if (pMarca !== marca || pNombre !== nombre) return false;

      // Si además coincide dosaje, contenido, sabor o presentación → duplicado fuerte
      const pDosaje = normalize(p.dosaje);
      const pContenido = normalize(p.contenido);
      const pSabor = normalize(p.sabor);
      const pPresentacion = normalize(p.presentacion);

      const coincidencias = [
        dosaje && pDosaje && dosaje === pDosaje,
        contenido && pContenido && contenido === pContenido,
        sabor && pSabor && sabor === pSabor,
        presentacion && pPresentacion && presentacion === pPresentacion,
      ].filter(Boolean).length;

      // Marca + nombre iguales ya es sospechoso
      return true;
    });
  };

  const handleSubmit = async (data: ProductoFormData) => {
    if (!user) return;

    // Validación de duplicados antes de crear
    if (!isEditing) {
      const similares = detectarDuplicados(data);
      if (similares.length > 0) {
        const lista = similares.map(p =>
          `• ${p.sku} — ${p.marca} ${p.nombreComercial}${p.dosaje ? ` ${p.dosaje}` : ''}${p.contenido ? ` ${p.contenido}` : ''}${p.sabor ? ` (${p.sabor})` : ''}`
        ).join('\n');
        const confirmar = window.confirm(
          `⚠️ Se encontraron ${similares.length} producto(s) similar(es):\n\n${lista}\n\n¿Deseas crear el producto de todas formas?`
        );
        if (!confirmar) return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isEditing && selectedProducto) {
        await updateProducto(selectedProducto.id, data);
        toast.success('Producto actualizado correctamente');
      } else {
        await createProducto(data, user.uid);
        toast.success('Producto creado correctamente');
      }
      setIsFormModalOpen(false);
      setSelectedProducto(null);
    } catch (error: any) {
      console.error('Error en handleSubmit:', error);
      const mensaje = error.message || 'Error desconocido al guardar el producto';
      toast.error(`Error: ${mensaje}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (producto: Producto) => {
    if (!window.confirm(`¿Enviar "${producto.marca} ${producto.nombreComercial}" a la papelera?`)) {
      return;
    }

    try {
      await deleteProducto(producto.id, user?.uid);
      await fetchArchivados(); // Actualizar badge de papelera
      toast.success('Producto enviado a la papelera');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCloseFormModal = () => {
    setIsFormModalOpen(false);
    setSelectedProducto(null);
    setIsEditing(false);
  };

  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setSelectedProducto(null);
  };

  // Helper: obtener producto fresco del store (evita stale closure)
  const refreshSelectedProducto = (productoId: string) => {
    const freshProductos = useProductoStore.getState().productos;
    const productoActualizado = freshProductos.find(p => p.id === productoId);
    if (productoActualizado) setSelectedProducto(productoActualizado);
  };

  // Investigación de Mercado
  const handleOpenInvestigacion = (producto: Producto) => {
    setSelectedProducto(producto);
    setIsInvestigacionModalOpen(true);
  };

  const handleCloseInvestigacionModal = () => {
    setIsInvestigacionModalOpen(false);
    // No resetear selectedProducto si el view modal sigue abierto
    if (!isViewModalOpen) {
      setSelectedProducto(null);
    }
  };

  const handleSaveInvestigacion = async (data: InvestigacionFormData) => {
    if (!user || !selectedProducto) return;

    setIsSubmitting(true);
    try {
      const tc = tipoCambioActual?.venta || 3.70;
      await guardarInvestigacion(selectedProducto.id, data, user.uid, tc);
      toast.success('Investigación guardada correctamente');
      setIsInvestigacionModalOpen(false);

      // Refrescar producto seleccionado si el view modal sigue abierto
      if (isViewModalOpen) {
        refreshSelectedProducto(selectedProducto.id);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInvestigacion = async () => {
    if (!selectedProducto) return;

    if (!window.confirm('¿Eliminar la investigación de mercado de este producto?')) {
      return;
    }

    setIsSubmitting(true);
    try {
      await eliminarInvestigacion(selectedProducto.id);
      toast.success('Investigación eliminada');
      setIsInvestigacionModalOpen(false);

      // Refrescar producto seleccionado si el view modal sigue abierto
      if (isViewModalOpen) {
        refreshSelectedProducto(selectedProducto.id);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrar y buscar productos
  const filteredProductos = useMemo(() => {
    return productosPorLinea.filter(producto => {
      // Búsqueda por término (con validación segura)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const sku = (producto.sku ?? '').toLowerCase();
        const marca = (producto.marca ?? '').toLowerCase();
        const nombreComercial = (producto.nombreComercial ?? '').toLowerCase();
        const grupo = (producto.grupo ?? '').toLowerCase();
        const subgrupo = (producto.subgrupo ?? '').toLowerCase();
        const tipoProductoNombre = (producto.tipoProducto?.nombre ?? '').toLowerCase();

        const matchSearch =
          sku.includes(term) ||
          marca.includes(term) ||
          nombreComercial.includes(term) ||
          grupo.includes(term) ||
          subgrupo.includes(term) ||
          tipoProductoNombre.includes(term) ||
          (producto.categorias && producto.categorias.some(c => (c.nombre ?? '').toLowerCase().includes(term))) ||
          (producto.etiquetasData && producto.etiquetasData.some(e => (e.nombre ?? '').toLowerCase().includes(term)));

        if (!matchSearch) return false;
      }

      // Filtro por estado
      if (filters.estado && producto.estado !== filters.estado) {
        return false;
      }

      // Filtro por grupo
      if (filters.grupo && producto.grupo !== filters.grupo) {
        return false;
      }

      // Filtro por marca
      if (filters.marca && producto.marca !== filters.marca) {
        return false;
      }

      // Filtro por stock
      if (filters.stockStatus === 'critico' && producto.stockPeru > producto.stockMinimo) {
        return false;
      }
      if (filters.stockStatus === 'agotado' && producto.stockPeru > 0) {
        return false;
      }


      // Filtro por investigación
      if (filters.investigacion) {
        const tieneInv = !!producto.investigacion;
        const ahora = new Date();
        const vigenciaHasta = producto.investigacion?.vigenciaHasta?.toDate?.();
        const estaVigente = vigenciaHasta ? vigenciaHasta > ahora : false;

        switch (filters.investigacion) {
          case 'sin_investigar':
            if (tieneInv) return false;
            break;
          case 'vigente':
            if (!tieneInv || !estaVigente) return false;
            break;
          case 'vencida':
            if (!tieneInv || estaVigente) return false;
            break;
          case 'importar':
            if (!tieneInv || producto.investigacion?.recomendacion !== 'importar') return false;
            break;
          case 'descartar':
            if (!tieneInv || producto.investigacion?.recomendacion !== 'descartar') return false;
            break;
        }
      }

      // Filtro por tipo de producto
      if (filters.tipoProductoId && producto.tipoProductoId !== filters.tipoProductoId) {
        return false;
      }

      // Filtro por categoría
      if (filters.categoriaId && !producto.categoriaIds?.includes(filters.categoriaId)) {
        return false;
      }

      // Filtro por etiqueta
      if (filters.etiquetaId && !producto.etiquetaIds?.includes(filters.etiquetaId)) {
        return false;
      }

      return true;
    });
  }, [productosPorLinea, searchTerm, filters]);

  // Función auxiliar para obtener valor de ordenamiento
  const getSortValue = (producto: Producto, key: string): any => {
    switch (key) {
      case 'sku':
        return producto.sku || '';
      case 'marca':
        return producto.marca || '';
      case 'nombreComercial':
        return producto.nombreComercial || '';
      case 'ctruPromedio':
        return producto.ctruPromedio || 0;
      case 'stockPeru':
        return producto.stockPeru || 0;
      case 'estado':
        return producto.estado || '';
      case 'precioCompra': {
        // P. Compra Sugerido (costo estimado)
        const inv = producto.investigacion;
        if (!inv) return -Infinity;
        return inv.ctruEstimado || -Infinity;
      }
      case 'precioVenta': {
        // P. Venta Sugerido
        const inv = producto.investigacion;
        if (!inv) return -Infinity;
        return inv.precioEntrada || inv.precioSugeridoCalculado || -Infinity;
      }
      case 'roi': {
        // ROI = (ganancia / costo) * 100
        const inv = producto.investigacion;
        if (!inv || !inv.ctruEstimado || inv.ctruEstimado <= 0) return -Infinity;
        const precioVenta = inv.precioEntrada || inv.precioSugeridoCalculado || 0;
        if (precioVenta <= 0) return -Infinity;
        const ganancia = precioVenta - inv.ctruEstimado;
        return (ganancia / inv.ctruEstimado) * 100;
      }
      case 'margen': {
        // Margen = (ganancia / precioVenta) * 100
        const inv = producto.investigacion;
        if (!inv || !inv.ctruEstimado || inv.ctruEstimado <= 0) return -Infinity;
        const precioVenta = inv.precioEntrada || inv.precioSugeridoCalculado || 0;
        if (precioVenta <= 0) return -Infinity;
        const ganancia = precioVenta - inv.ctruEstimado;
        return (ganancia / precioVenta) * 100;
      }
      case 'multiplicador': {
        // Multiplicador = precioVenta / precioCompra
        const inv = producto.investigacion;
        if (!inv || !inv.ctruEstimado || inv.ctruEstimado <= 0) return -Infinity;
        const precioVenta = inv.precioEntrada || inv.precioSugeridoCalculado || 0;
        if (precioVenta <= 0) return -Infinity;
        return precioVenta / inv.ctruEstimado;
      }
      case 'gananciaUnidad': {
        // Ganancia por unidad = precioVenta - precioCompra
        const inv = producto.investigacion;
        if (!inv || !inv.ctruEstimado || inv.ctruEstimado <= 0) return -Infinity;
        const precioVenta = inv.precioEntrada || inv.precioSugeridoCalculado || 0;
        if (precioVenta <= 0) return -Infinity;
        return precioVenta - inv.ctruEstimado;
      }
      default:
        return (producto as any)[key] ?? '';
    }
  };

  // Ordenar productos con múltiples claves
  const sortedProductos = useMemo(() => {
    if (sortConfigs.length === 0) return filteredProductos;

    return [...filteredProductos].sort((a, b) => {
      for (const config of sortConfigs) {
        const aValue = getSortValue(a, config.key);
        const bValue = getSortValue(b, config.key);

        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue, 'es', { sensitivity: 'base' });
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else {
          if (aValue < bValue) comparison = -1;
          if (aValue > bValue) comparison = 1;
        }

        if (comparison !== 0) {
          return config.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }, [filteredProductos, sortConfigs]);

  // Paginar productos
  const paginatedProductos = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedProductos.slice(startIndex, endIndex);
  }, [sortedProductos, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedProductos.length / itemsPerPage);

  // Obtener listas únicas para filtros
  const uniqueGrupos = useMemo(() => {
    const productosArr = Array.isArray(productos) ? productos : [];
    const grupos = Array.from(new Set(productosArr.map(p => p.grupo))).filter(Boolean);
    return grupos.sort();
  }, [productos]);

  const uniqueMarcas = useMemo(() => {
    const productosArr = Array.isArray(productos) ? productos : [];
    const marcas = Array.from(new Set(productosArr.map(p => p.marca))).filter(Boolean);
    return marcas.sort();
  }, [productos]);

  // Métricas
  const productosArray = Array.isArray(productos) ? productos : [];
  const productosActivos = productosArray.filter(p => p.estado === 'activo').length;
  const productosConML = 0; // ML field removed
  const productosStockCritico = productosArray.filter(p => p.stockPeru <= p.stockMinimo).length;
  const productosSinInvestigar = productosArray.filter(p => !p.investigacion).length;

  const handleClearFilters = () => {
    setFilters({
      estado: '',
      grupo: '',
      marca: '',
      stockStatus: '',
      investigacion: '',
      tipoProductoId: '',
      categoriaId: '',
      etiquetaId: ''
    });
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      {/* Header Profesional con Gradiente - Estilo Maestros */}
      <GradientHeader
        title="Gestión de Productos"
        subtitle="Administra tu catálogo de productos, precios e investigaciones de mercado"
        icon={Package}
        variant="dark"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              onClick={() => setIsArchivoModalOpen(true)}
              className="relative text-white/70 hover:text-white hover:bg-white/10 !px-2 !py-1.5"
            >
              <Trash2 className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline text-sm">Archivo</span>
              {archivados.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {archivados.length}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setIsDashboardOpen(true)}
              className="text-white/70 hover:text-white hover:bg-white/10 !px-2 !py-1.5"
            >
              <BarChart3 className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline text-sm">Intel</span>
            </Button>
            <Button variant="ghost" onClick={handleCreate} className="text-white/70 hover:text-white hover:bg-white/10 !px-2 !py-1.5">
              <Plus className="h-5 w-5 sm:mr-1.5" />
              <span className="hidden sm:inline text-sm">Nuevo</span>
            </Button>
          </div>
        }
        stats={[
          { label: 'Total Productos', value: productosArray.length },
          { label: 'Activos', value: productosActivos },
          { label: 'En Mercado Libre', value: productosConML },
          { label: 'Stock Crítico', value: productosStockCritico },
          { label: 'Sin Investigar', value: productosSinInvestigar }
        ]}
      />

      {/* Búsqueda y Filtros — Rediseñado */}
      <Card padding="md">
        <div className="space-y-3">
          {/* Barra de búsqueda */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por SKU, marca, nombre..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            {/* Desktop: toggle panel */}
            <Button
              variant={showFilters ? 'primary' : 'outline'}
              onClick={() => setShowFilters(!showFilters)}
              className="hidden sm:flex"
            >
              <Filter className="h-5 w-5 mr-2" />
              Filtros
            </Button>
            {/* Mobile: open bottom sheet */}
            <Button
              variant="outline"
              onClick={() => setShowMobileFilters(true)}
              className="sm:hidden"
            >
              <Filter className="h-5 w-5" />
            </Button>
          </div>

          {/* Pills rápidos — siempre visibles */}
          <FiltrosRapidos
            totalProductos={productosArray.length}
            activos={productosArray.filter(p => p.estado === 'activo').length}
            stockCritico={productosStockCritico}
            sinInvestigar={productosSinInvestigar}
            activeFilter={
              filters.stockStatus === 'critico' ? 'stock_critico'
              : filters.investigacion === 'sin_investigar' ? 'sin_investigar'
              : filters.estado === 'activo' ? 'activos'
              : (filters.estado || filters.marca || filters.tipoProductoId || filters.categoriaId || filters.etiquetaId || filters.stockStatus || filters.investigacion) ? null
              : null
            }
            onFilter={(filterId) => {
              handleClearFilters();
              if (filterId === 'activos') setFilters(prev => ({ ...prev, estado: 'activo' }));
              else if (filterId === 'stock_critico') setFilters(prev => ({ ...prev, stockStatus: 'critico' }));
              else if (filterId === 'sin_investigar') setFilters(prev => ({ ...prev, investigacion: 'sin_investigar' }));
              setCurrentPage(1);
            }}
          />

          {/* Chips de filtros activos — siempre visible cuando hay filtros */}
          {(filters.estado || filters.marca || filters.tipoProductoId || filters.categoriaId || filters.etiquetaId || filters.stockStatus || filters.investigacion || filters.grupo) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm text-gray-500 flex-shrink-0">
                <strong>{sortedProductos.length}</strong> de <strong>{productosArray.length}</strong> productos
              </span>
              <div className="flex flex-wrap gap-1.5">
                {filters.estado && (
                  <FilterChip label="Estado" value={filters.estado} onRemove={() => setFilters(prev => ({ ...prev, estado: '' }))} />
                )}
                {filters.marca && (
                  <FilterChip label="Marca" value={filters.marca} onRemove={() => setFilters(prev => ({ ...prev, marca: '' }))} />
                )}
                {filters.stockStatus && (
                  <FilterChip label="Stock" value={filters.stockStatus} onRemove={() => setFilters(prev => ({ ...prev, stockStatus: '' }))} />
                )}
                {filters.investigacion && (
                  <FilterChip label="Investigación" value={filters.investigacion.replace('_', ' ')} onRemove={() => setFilters(prev => ({ ...prev, investigacion: '' }))} />
                )}
                {filters.tipoProductoId && (
                  <FilterChip label="Tipo" value={filters.tipoProductoId} onRemove={() => setFilters(prev => ({ ...prev, tipoProductoId: '' }))} />
                )}
                {filters.categoriaId && (
                  <FilterChip label="Categoría" value={filters.categoriaId} onRemove={() => setFilters(prev => ({ ...prev, categoriaId: '' }))} />
                )}
                {filters.etiquetaId && (
                  <FilterChip label="Etiqueta" value={filters.etiquetaId} onRemove={() => setFilters(prev => ({ ...prev, etiquetaId: '' }))} />
                )}
                {filters.grupo && (
                  <FilterChip label="Grupo" value={filters.grupo} onRemove={() => setFilters(prev => ({ ...prev, grupo: '' }))} />
                )}
              </div>
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-[10px] sm:text-xs text-gray-400 hover:text-red-500 ml-auto flex-shrink-0"
              >
                Limpiar todos
              </button>
            </div>
          )}

          {/* Panel de filtros */}
          {showFilters && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Filtros</h3>
                <button
                  onClick={handleClearFilters}
                  className="text-sm text-primary-600 hover:text-primary-800 flex items-center"
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpiar filtros
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Filtro por Estado */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Estado
                  </label>
                  <select
                    value={filters.estado}
                    onChange={(e) => {
                      const nuevoEstado = e.target.value as EstadoProducto | '';
                      setFilters({ ...filters, estado: nuevoEstado });
                      setCurrentPage(1);
                      // Recargar incluyendo inactivos si el filtro lo necesita
                      const necesitaInactivos = nuevoEstado === '' || nuevoEstado === 'inactivo' || nuevoEstado === 'descontinuado';
                      fetchProductos(necesitaInactivos);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Todos</option>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="descontinuado">Descontinuado</option>
                  </select>
                </div>

                {/* Filtro por Grupo */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Grupo
                  </label>
                  <select
                    value={filters.grupo}
                    onChange={(e) => {
                      setFilters({ ...filters, grupo: e.target.value });
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Todos</option>
                    {uniqueGrupos.map(grupo => (
                      <option key={grupo} value={grupo}>{grupo}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro por Marca */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Marca
                  </label>
                  <select
                    value={filters.marca}
                    onChange={(e) => {
                      setFilters({ ...filters, marca: e.target.value });
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Todas</option>
                    {uniqueMarcas.map(marca => (
                      <option key={marca} value={marca}>{marca}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro por Stock */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Stock
                  </label>
                  <select
                    value={filters.stockStatus}
                    onChange={(e) => {
                      setFilters({ ...filters, stockStatus: e.target.value as any });
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Todos</option>
                    <option value="critico">Stock Crítico</option>
                    <option value="agotado">Agotado</option>
                  </select>
                </div>


                {/* Filtro por Investigación */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Investigación
                  </label>
                  <select
                    value={filters.investigacion}
                    onChange={(e) => {
                      setFilters({ ...filters, investigacion: e.target.value as any });
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Todas</option>
                    <option value="sin_investigar">Sin investigar</option>
                    <option value="vigente">Investigación vigente</option>
                    <option value="vencida">Investigación vencida</option>
                    <option value="importar">Recomendado importar</option>
                    <option value="descartar">Recomendado descartar</option>
                  </select>
                </div>
              </div>

              {/* Segunda fila de filtros - Clasificación */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-gray-200">
                {/* Filtro por Tipo de Producto */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Tipo de Producto
                  </label>
                  <select
                    value={filters.tipoProductoId}
                    onChange={(e) => {
                      setFilters({ ...filters, tipoProductoId: e.target.value });
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Todos los tipos</option>
                    {tiposActivos.map(tipo => (
                      <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro por Categoría */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Categoría
                  </label>
                  <select
                    value={filters.categoriaId}
                    onChange={(e) => {
                      setFilters({ ...filters, categoriaId: e.target.value });
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Todas las categorías</option>
                    {categoriasActivas.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nivel === 2 && cat.categoriaPadreNombre ? `${cat.categoriaPadreNombre} > ` : ''}
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro por Etiqueta */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Etiqueta
                  </label>
                  <select
                    value={filters.etiquetaId}
                    onChange={(e) => {
                      setFilters({ ...filters, etiquetaId: e.target.value });
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Todas las etiquetas</option>
                    {etiquetasActivas.map(etq => (
                      <option key={etq.id} value={etq.id}>{etq.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Resultados */}
              <div className="text-sm text-gray-600 pt-2 border-t">
                Mostrando {paginatedProductos.length} de {sortedProductos.length} productos
                {sortedProductos.length !== productosArray.length && ` (${productosArray.length} total)`}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Tabla de productos */}
      <Card padding="md">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : paginatedProductos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchTerm || Object.values(filters).some(Boolean)
                ? 'No se encontraron productos con los filtros aplicados'
                : 'No hay productos registrados'}
            </p>
          </div>
        ) : (
          <>
            <ProductoTable
              productos={paginatedProductos}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReactivar={async (producto) => {
                try {
                  await reactivarProducto(producto.id);
                  toast.success(`Producto ${producto.sku} reactivado`);
                } catch (err: any) {
                  toast.error(err.message || 'Error al reactivar');
                }
              }}
              sortConfigs={sortConfigs}
              onSort={handleSort}
            />

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <div className="text-sm text-gray-600">
                  Página {currentPage} de {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>

                  {/* Números de página */}
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNumber;
                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNumber}
                          onClick={() => handlePageChange(pageNumber)}
                          className={`px-3 py-1 rounded text-sm ${
                            currentPage === pageNumber
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Wizard de intención al crear */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title="Crear Producto"
        size="md"
      >
        <ProductoCreacionWizard
          onSelect={handleWizardSelect}
          onCancel={() => setIsWizardOpen(false)}
        />
      </Modal>

      {/* Flujo 3 — Paso 1: Buscador de grupo */}
      <Modal
        isOpen={isBuscadorVarianteOpen}
        onClose={() => setIsBuscadorVarianteOpen(false)}
        title="Agregar Variante"
        size="md"
      >
        <BuscadorGrupoProducto
          productos={productos}
          onSelect={handleGrupoSeleccionado}
          onCancel={() => setIsBuscadorVarianteOpen(false)}
        />
      </Modal>

      {/* Flujo 3 — Paso 2: Formulario reducido */}
      <Modal
        isOpen={isFormVarianteReducidaOpen}
        onClose={() => { setIsFormVarianteReducidaOpen(false); setGrupoSeleccionadoParaVariante(null); }}
        title="Nueva Variante"
        size="md"
      >
        {grupoSeleccionadoParaVariante && (
          <FormVarianteReducida
            grupoProducto={grupoSeleccionadoParaVariante}
            variantesExistentes={
              productos
                .filter(p => (p.grupoVarianteId || p.parentId) === (grupoSeleccionadoParaVariante.grupoVarianteId || grupoSeleccionadoParaVariante.id))
                .map(p => p.varianteLabel || p.contenido || '')
                .filter(Boolean)
            }
            onSubmit={handleCrearVarianteReducida}
            onBack={() => {
              setIsFormVarianteReducidaOpen(false);
              setGrupoSeleccionadoParaVariante(null);
              setIsBuscadorVarianteOpen(true);
            }}
            onCancel={() => { setIsFormVarianteReducidaOpen(false); setGrupoSeleccionadoParaVariante(null); }}
          />
        )}
      </Modal>

      <Modal
        isOpen={isFormModalOpen}
        onClose={handleCloseFormModal}
        title={isEditing ? 'Editar Producto' : wizardTipo === 'con_variantes' ? 'Nuevo Producto con Variantes' : 'Nuevo Producto'}
        size="xl"
      >
        <ProductoForm
          initialData={selectedProducto || undefined}
          onSubmit={handleSubmit}
          onCancel={handleCloseFormModal}
          loading={isSubmitting}
          modoVariantes={!isEditing && wizardTipo === 'con_variantes'}
          onSubmitConVariantes={async (datosComunes, variantes) => {
            if (!user) return;
            setIsSubmitting(true);
            try {
              await ProductoService.createConVariantes(datosComunes, variantes, user.uid);
              toast.success(`Grupo creado con ${variantes.length} variantes`);
              handleCloseFormModal();
              fetchProductos();
            } catch (err: any) {
              toast.error(err.message || 'Error al crear grupo');
            } finally {
              setIsSubmitting(false);
            }
          }}
        />
      </Modal>

      <Modal
        isOpen={isViewModalOpen}
        onClose={handleCloseViewModal}
        title={selectedProducto ? `${selectedProducto.marca} - ${selectedProducto.nombreComercial}` : 'Detalles del Producto'}
        size="xl"
      >
        {selectedProducto && (
          <ProductoCard
            producto={selectedProducto}
            onEdit={() => {
              handleCloseViewModal();
              handleEdit(selectedProducto);
            }}
            onDelete={() => {
              handleCloseViewModal();
              handleDelete(selectedProducto);
            }}
            onInvestigar={() => handleOpenInvestigacion(selectedProducto)}
            onReactivar={selectedProducto.estado === 'inactivo' ? async () => {
              try {
                await reactivarProducto(selectedProducto.id);
                toast.success(`Producto ${selectedProducto.sku} reactivado`);
                setSelectedProducto({ ...selectedProducto, estado: 'activo' });
              } catch (err: any) {
                toast.error(err.message || 'Error al reactivar');
              }
            } : undefined}
            onCreateVariante={selectedProducto.estado === 'activo' ? () => handleCreateVariante(selectedProducto) : undefined}
            variantes={variantesDelProducto}
            onViewVariante={(v) => { handleCloseViewModal(); handleView(v); }}
          />
        )}
      </Modal>

      {/* Modal de Investigación de Mercado */}
      <Modal
        isOpen={isInvestigacionModalOpen}
        onClose={handleCloseInvestigacionModal}
        title={`Investigación de Mercado`}
        size="xl"
      >
        {selectedProducto && (
          <InvestigacionModal
            producto={selectedProducto}
            tipoCambio={tipoCambioActual?.venta || 3.70}
            onSave={handleSaveInvestigacion}
            onDelete={selectedProducto.investigacion ? handleDeleteInvestigacion : undefined}
            onClose={handleCloseInvestigacionModal}
            loading={isSubmitting}
          />
        )}
      </Modal>

      {/* Modal de Archivo */}
      <ArchivoModal
        isOpen={isArchivoModalOpen}
        onClose={() => setIsArchivoModalOpen(false)}
        archivados={archivados}
        loading={loadingArchivados}
        onFetch={fetchArchivados}
        onReactivar={async (id) => {
          try {
            await reactivarProducto(id);
            toast.success('Producto reactivado');
          } catch (err: any) {
            toast.error(err.message || 'Error al reactivar');
          }
        }}
      />

      {/* Dashboard de Catálogo */}
      <DashboardCatalogo
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
        productos={productosArray}
      />

      {/* Bottom Sheet de Filtros — Mobile */}
      <FiltrosDrawerMobile
        isOpen={showMobileFilters}
        onClose={() => setShowMobileFilters(false)}
        filters={filters}
        onApply={(newFilters) => {
          setFilters(newFilters);
          setCurrentPage(1);
          const necesitaInactivos = newFilters.estado === '' || newFilters.estado === 'inactivo' || newFilters.estado === 'descontinuado';
          fetchProductos(necesitaInactivos);
        }}
        onClear={() => { handleClearFilters(); setShowMobileFilters(false); }}
        uniqueMarcas={uniqueMarcas}
        uniqueGrupos={uniqueGrupos}
        tiposProducto={(tiposActivos || []).map(t => ({ id: t.id, nombre: t.nombre }))}
        categorias={(categoriasActivas || []).map(c => ({ id: c.id, nombre: c.nombre }))}
        etiquetas={(etiquetasActivas || []).map(e => ({ id: e.id, nombre: e.nombre }))}
        resultCount={sortedProductos.length}
      />

    </div>
  );
};