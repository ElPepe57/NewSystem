import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Search, Filter, X, Copy } from 'lucide-react';
import { Button, Card, Modal } from '../../components/common';
import { ProductoForm } from '../../components/modules/productos/ProductoForm';
import { ProductoTable } from '../../components/modules/productos/ProductoTable';
import { ProductoCard } from '../../components/modules/productos/ProductoCard';
import { InvestigacionModal } from '../../components/modules/productos/InvestigacionModal';
import { DuplicadosModal } from '../../components/modules/productos/DuplicadosModal';
import { useProductoStore } from '../../store/productoStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { useAuthStore } from '../../store/authStore';
import { useTipoProductoStore } from '../../store/tipoProductoStore';
import { useCategoriaStore } from '../../store/categoriaStore';
import { useEtiquetaStore } from '../../store/etiquetaStore';
import type { Producto, ProductoFormData, EstadoProducto, InvestigacionFormData } from '../../types/producto.types';
import type { TipoCambio } from '../../types/tipoCambio.types';

export const Productos: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { productos, loading, fetchProductos, createProducto, updateProducto, deleteProducto, guardarInvestigacion, eliminarInvestigacion } = useProductoStore();
  const { getTCDelDia } = useTipoCambioStore();
  const { tiposActivos, fetchTiposActivos } = useTipoProductoStore();
  const { categoriasActivas, fetchCategoriasActivas } = useCategoriaStore();
  const { etiquetasActivas, fetchEtiquetasActivas } = useEtiquetaStore();

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isInvestigacionModalOpen, setIsInvestigacionModalOpen] = useState(false);
  const [isDuplicadosModalOpen, setIsDuplicadosModalOpen] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tipoCambioActual, setTipoCambioActual] = useState<TipoCambio | null>(null);

  // Filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    estado: '' as EstadoProducto | '',
    grupo: '',
    marca: '',
    stockStatus: '' as 'todos' | 'critico' | 'agotado' | '',
    habilitadoML: '' as 'true' | 'false' | '',
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
  }>>([]);

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
    fetchTiposActivos();
    fetchCategoriasActivas();
    fetchEtiquetasActivas();
    // Cargar tipo de cambio del día
    getTCDelDia().then(tc => {
      if (tc) setTipoCambioActual(tc);
    }).catch(console.error);
  }, [fetchProductos, getTCDelDia, fetchTiposActivos, fetchCategoriasActivas, fetchEtiquetasActivas]);

  const handleCreate = () => {
    setSelectedProducto(null);
    setIsEditing(false);
    setIsFormModalOpen(true);
  };

  const handleEdit = (producto: Producto) => {
    setSelectedProducto(producto);
    setIsEditing(true);
    setIsFormModalOpen(true);
  };

  const handleView = (producto: Producto) => {
    setSelectedProducto(producto);
    setIsViewModalOpen(true);
  };

  const handleSubmit = async (data: ProductoFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      if (isEditing && selectedProducto) {
        await updateProducto(selectedProducto.id, data);
        alert('Producto actualizado correctamente');
      } else {
        await createProducto(data, user.uid);
        alert('Producto creado correctamente');
      }
      setIsFormModalOpen(false);
      setSelectedProducto(null);
    } catch (error: any) {
      console.error('Error en handleSubmit:', error);
      const mensaje = error.message || 'Error desconocido al guardar el producto';
      alert(`Error: ${mensaje}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (producto: Producto) => {
    if (!window.confirm(`¿Eliminar ${producto.marca} ${producto.nombreComercial}?`)) {
      return;
    }
    
    try {
      await deleteProducto(producto.id);
      alert('✅ Producto eliminado');
    } catch (error: any) {
      alert(error.message);
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
      alert('Investigación guardada correctamente');
      setIsInvestigacionModalOpen(false);

      // Refrescar producto seleccionado si el view modal sigue abierto
      if (isViewModalOpen) {
        const productoActualizado = productos.find(p => p.id === selectedProducto.id);
        if (productoActualizado) {
          setSelectedProducto(productoActualizado);
        }
      }
    } catch (error: any) {
      alert(error.message);
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
      alert('Investigación eliminada');
      setIsInvestigacionModalOpen(false);

      // Refrescar producto seleccionado si el view modal sigue abierto
      if (isViewModalOpen) {
        const productoActualizado = productos.find(p => p.id === selectedProducto.id);
        if (productoActualizado) {
          setSelectedProducto(productoActualizado);
        }
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrar y buscar productos
  const filteredProductos = useMemo(() => {
    const productosArray = Array.isArray(productos) ? productos : [];

    return productosArray.filter(producto => {
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

      // Filtro por ML
      if (filters.habilitadoML === 'true' && !producto.habilitadoML) {
        return false;
      }
      if (filters.habilitadoML === 'false' && producto.habilitadoML) {
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
  }, [productos, searchTerm, filters]);

  // Función auxiliar para obtener valor de ordenamiento
  const getSortValue = (producto: Producto, key: string): any => {
    switch (key) {
      case 'sku':
        return producto.sku || '';
      case 'marca':
        return producto.marca || '';
      case 'nombreComercial':
        return producto.nombreComercial || '';
      case 'precioSugerido':
        return producto.precioSugerido || 0;
      case 'stockPeru':
        return producto.stockPeru || 0;
      case 'estado':
        return producto.estado || '';
      case 'roi': {
        // Calcular ROI para ordenamiento
        const inv = producto.investigacion;
        if (!inv || inv.ctruEstimado <= 0) return -Infinity;
        const precioVenta = inv.precioEntrada || inv.precioPERUPromedio || 0;
        if (precioVenta <= 0) return -Infinity;
        return ((precioVenta - inv.ctruEstimado) / inv.ctruEstimado) * 100;
      }
      case 'margenEstimado':
        return producto.investigacion?.margenEstimado || -Infinity;
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
  const productosConML = productosArray.filter(p => p.habilitadoML).length;
  const productosStockCritico = productosArray.filter(p => p.stockPeru <= p.stockMinimo).length;
  const productosSinInvestigar = productosArray.filter(p => !p.investigacion).length;

  // Contar duplicados para el badge
  const duplicadosCount = useMemo(() => {
    const porClaveExacta = new Map<string, number>();
    productosArray.forEach(p => {
      const marca = (p.marca ?? '').toLowerCase().trim();
      const nombre = (p.nombreComercial ?? '').toLowerCase().trim();
      const dosaje = (p.dosaje ?? '').toLowerCase().trim();
      const contenido = (p.contenido ?? '').toLowerCase().trim();
      const key = `${marca}|${nombre}|${dosaje}|${contenido}`;
      porClaveExacta.set(key, (porClaveExacta.get(key) || 0) + 1);
    });
    return Array.from(porClaveExacta.values()).filter(count => count > 1).length;
  }, [productosArray]);

  const handleClearFilters = () => {
    setFilters({
      estado: '',
      grupo: '',
      marca: '',
      stockStatus: '',
      habilitadoML: '',
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-600 mt-1">Gestiona tu catálogo de productos</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={duplicadosCount > 0 ? 'danger' : 'outline'}
            onClick={() => setIsDuplicadosModalOpen(true)}
            className="relative"
          >
            <Copy className="h-5 w-5 mr-2" />
            Duplicados
            {duplicadosCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {duplicadosCount}
              </span>
            )}
          </Button>
          <Button variant="primary" onClick={handleCreate}>
            <Plus className="h-5 w-5 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card padding="md">
          <div className="text-sm text-gray-600">Total Productos</div>
          <div className="text-2xl font-bold text-primary-600 mt-1">{productosArray.length}</div>
        </Card>
        <Card padding="md">
          <div className="text-sm text-gray-600">Activos</div>
          <div className="text-2xl font-bold text-success-600 mt-1">{productosActivos}</div>
        </Card>
        <Card padding="md">
          <div className="text-sm text-gray-600">En Mercado Libre</div>
          <div className="text-2xl font-bold text-info-600 mt-1">{productosConML}</div>
        </Card>
        <Card padding="md">
          <div className="text-sm text-gray-600">Stock Crítico</div>
          <div className="text-2xl font-bold text-danger-600 mt-1">{productosStockCritico}</div>
        </Card>
        <Card padding="md">
          <div className="text-sm text-gray-600">Sin Investigar</div>
          <div className="text-2xl font-bold text-warning-600 mt-1">{productosSinInvestigar}</div>
        </Card>
      </div>

      {/* Búsqueda y Filtros */}
      <Card padding="md">
        <div className="space-y-4">
          {/* Barra de búsqueda */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por SKU, marca, nombre, grupo..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <Button
              variant={showFilters ? 'primary' : 'outline'}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-5 w-5 mr-2" />
              Filtros
            </Button>
          </div>

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
                      setFilters({ ...filters, estado: e.target.value as EstadoProducto | '' });
                      setCurrentPage(1);
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

                {/* Filtro por ML */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Mercado Libre
                  </label>
                  <select
                    value={filters.habilitadoML}
                    onChange={(e) => {
                      setFilters({ ...filters, habilitadoML: e.target.value as any });
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Todos</option>
                    <option value="true">Habilitados</option>
                    <option value="false">No habilitados</option>
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

      <Modal
        isOpen={isFormModalOpen}
        onClose={handleCloseFormModal}
        title={isEditing ? 'Editar Producto' : 'Nuevo Producto'}
        size="xl"
      >
        <ProductoForm
          initialData={selectedProducto || undefined}
          onSubmit={handleSubmit}
          onCancel={handleCloseFormModal}
          loading={isSubmitting}
        />
      </Modal>

      <Modal
        isOpen={isViewModalOpen}
        onClose={handleCloseViewModal}
        title="Detalles del Producto"
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

      {/* Modal de Duplicados */}
      <DuplicadosModal
        isOpen={isDuplicadosModalOpen}
        onClose={() => setIsDuplicadosModalOpen(false)}
        productos={productosArray}
        onVerProducto={(producto) => {
          setIsDuplicadosModalOpen(false);
          handleView(producto);
        }}
        onEliminarProducto={handleDelete}
      />
    </div>
  );
};