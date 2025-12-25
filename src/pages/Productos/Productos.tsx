import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, X, Download } from 'lucide-react';
import { Button, Card, Modal } from '../../components/common';
import { ProductoForm } from '../../components/modules/productos/ProductoForm';
import { ProductoTable } from '../../components/modules/productos/ProductoTable';
import { ProductoCard } from '../../components/modules/productos/ProductoCard';
import { InvestigacionModal } from '../../components/modules/productos/InvestigacionModal';
import { useProductoStore } from '../../store/productoStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { useAuthStore } from '../../store/authStore';
import type { Producto, ProductoFormData, EstadoProducto, InvestigacionFormData } from '../../types/producto.types';
import { exportService } from '../../services/export.service';
import type { TipoCambio } from '../../types/tipoCambio.types';

export const Productos: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore(state => state.user);
  const { productos, loading, fetchProductos, createProducto, updateProducto, deleteProducto, guardarInvestigacion, eliminarInvestigacion } = useProductoStore();
  const { getTCDelDia } = useTipoCambioStore();

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isInvestigacionModalOpen, setIsInvestigacionModalOpen] = useState(false);
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
    investigacion: '' as 'todos' | 'sin_investigar' | 'vigente' | 'vencida' | 'importar' | 'descartar' | ''
  });

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Ordenamiento
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Producto | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  useEffect(() => {
    fetchProductos();
    // Cargar tipo de cambio del día
    getTCDelDia().then(tc => {
      if (tc) setTipoCambioActual(tc);
    }).catch(console.error);
  }, [fetchProductos, getTCDelDia]);

  // Manejar query parameter ?action=create para abrir modal desde otros módulos
  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setSelectedProducto(null);
      setIsEditing(false);
      setIsFormModalOpen(true);
      // Limpiar el query parameter para evitar reabrir al navegar
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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
        alert('✅ Producto actualizado correctamente');
      } else {
        await createProducto(data, user.uid);
        alert('✅ Producto creado correctamente');
      }
      setIsFormModalOpen(false);
      setSelectedProducto(null);
    } catch (error: any) {
      alert(error.message);
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
      // Búsqueda por término
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchSearch =
          producto.sku.toLowerCase().includes(term) ||
          producto.marca.toLowerCase().includes(term) ||
          producto.nombreComercial.toLowerCase().includes(term) ||
          producto.grupo.toLowerCase().includes(term) ||
          (producto.subgrupo && producto.subgrupo.toLowerCase().includes(term));

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

      return true;
    });
  }, [productos, searchTerm, filters]);

  // Ordenar productos
  const sortedProductos = useMemo(() => {
    if (!sortConfig.key) return filteredProductos;

    return [...filteredProductos].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

      if (aValue === undefined || bValue === undefined) return 0;

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [filteredProductos, sortConfig]);

  // Paginar productos
  const paginatedProductos = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedProductos.slice(startIndex, endIndex);
  }, [sortedProductos, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedProductos.length / itemsPerPage);

  // Obtener listas únicas para filtros
  const uniqueGrupos = useMemo(() => {
    const grupos = Array.from(new Set(productos.map(p => p.grupo))).filter(Boolean);
    return grupos.sort();
  }, [productos]);

  const uniqueMarcas = useMemo(() => {
    const marcas = Array.from(new Set(productos.map(p => p.marca))).filter(Boolean);
    return marcas.sort();
  }, [productos]);

  // Métricas
  const productosArray = Array.isArray(productos) ? productos : [];
  const productosActivos = productosArray.filter(p => p.estado === 'activo').length;
  const productosConML = productosArray.filter(p => p.habilitadoML).length;
  const productosStockCritico = productosArray.filter(p => p.stockPeru <= p.stockMinimo).length;
  const productosSinInvestigar = productosArray.filter(p => !p.investigacion).length;

  const handleClearFilters = () => {
    setFilters({
      estado: '',
      grupo: '',
      marca: '',
      stockStatus: '',
      habilitadoML: '',
      investigacion: ''
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => exportService.exportProductos(filteredProductos)}
            disabled={filteredProductos.length === 0}
          >
            <Download className="h-5 w-5 mr-2" />
            Exportar Excel
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
          productosExistentes={productos}
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
    </div>
  );
};