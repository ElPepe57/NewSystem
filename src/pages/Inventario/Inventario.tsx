import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, Plus, TrendingUp, Warehouse, Truck, Box } from 'lucide-react';
import { Button, Card, Modal, Select } from '../../components/common';
import { RecepcionForm } from '../../components/modules/inventario/RecepcionForm';
import { UnidadTable } from '../../components/modules/inventario/UnidadTable';
import { UnidadDetailsModal } from '../../components/modules/inventario/UnidadDetailsModal';
import { useInventarioStore } from '../../store/inventarioStore';
import { useProductoStore } from '../../store/productoStore';
import { useAuthStore } from '../../store/authStore';
import type { Unidad, UnidadFormData, Producto } from '../../types/producto.types';

export const Inventario: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productoIdParam = searchParams.get('productoId');
  
  const user = useAuthStore(state => state.user);
  const { productos, fetchProductos } = useProductoStore();
  const { 
    unidades, 
    resumen, 
    loading, 
    fetchUnidadesByProducto, 
    crearUnidades, 
    fetchResumen,
    clearUnidades 
  } = useInventarioStore();
  
  const [selectedProductoId, setSelectedProductoId] = useState<string>(productoIdParam || '');
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [isRecepcionModalOpen, setIsRecepcionModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedUnidad, setSelectedUnidad] = useState<Unidad | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar productos al montar
  useEffect(() => {
    if (productos.length === 0) {
      fetchProductos();
    }
  }, [fetchProductos, productos.length]);

  // Cargar inventario cuando se selecciona un producto
  useEffect(() => {
    if (selectedProductoId) {
      const producto = productos.find(p => p.id === selectedProductoId);
      setSelectedProducto(producto || null);
      fetchUnidadesByProducto(selectedProductoId);
      fetchResumen(selectedProductoId);
    } else {
      setSelectedProducto(null);
      clearUnidades();
    }
  }, [selectedProductoId, productos, fetchUnidadesByProducto, fetchResumen, clearUnidades]);

  // Manejar cambio de producto
  const handleProductoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const productoId = e.target.value;
    setSelectedProductoId(productoId);
    if (productoId) {
      navigate(`/inventario?productoId=${productoId}`);
    } else {
      navigate('/inventario');
    }
  };

  // Crear unidades
  const handleCrearUnidades = async (data: UnidadFormData) => {
    if (!user || !selectedProducto) return;
    
    setIsSubmitting(true);
    try {
      await crearUnidades(data, selectedProducto.sku, user.uid);
      setIsRecepcionModalOpen(false);
      
      // CRÍTICO: Recargar TANTO las unidades COMO el resumen
      await fetchUnidadesByProducto(selectedProductoId);
      await fetchResumen(selectedProductoId);
    } catch (error) {
      console.error('Error al crear unidades:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ver detalles de unidad
  const handleViewDetails = (unidad: Unidad) => {
    setSelectedUnidad(unidad);
    setIsDetailsModalOpen(true);
  };

  // Opciones de productos para el select
  const productoOptions = productos
    .filter(p => p.estado === 'activo')
    .map(p => ({
      value: p.id,
      label: `${p.sku} - ${p.marca} ${p.nombreComercial}`
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-600 mt-1">Trazabilidad por unidad individual</p>
        </div>
        {selectedProductoId && (
          <Button
            variant="primary"
            onClick={() => setIsRecepcionModalOpen(true)}
          >
            <Plus className="h-5 w-5 mr-2" />
            Recibir Unidades
          </Button>
        )}
      </div>

      {/* Selector de Producto */}
      <Card padding="md">
        <div className="max-w-2xl">
          <Select
            label="Seleccionar Producto"
            value={selectedProductoId}
            onChange={handleProductoChange}
            options={productoOptions}
          />
        </div>
      </Card>

      {/* Contenido Principal */}
      {selectedProductoId ? (
        <>
          {/* Información del Producto */}
          {selectedProducto && (
            <Card padding="md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-3">
                    <Package className="h-8 w-8 text-primary-600" />
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {selectedProducto.marca} {selectedProducto.nombreComercial}
                      </h2>
                      <p className="text-sm text-gray-600">
                        {selectedProducto.dosaje} · {selectedProducto.contenido} · {selectedProducto.presentacion}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">SKU</div>
                  <div className="text-lg font-mono font-semibold text-gray-900">
                    {selectedProducto.sku}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Resumen de Inventario */}
          {resumen && (
            <>
              {/* KPIs Principales */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card padding="md">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Total Unidades</div>
                      <div className="text-2xl font-bold text-gray-900 mt-1">
                        {resumen.totalUnidades}
                      </div>
                    </div>
                    <Box className="h-10 w-10 text-gray-400" />
                  </div>
                </Card>

                <Card padding="md">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">USA</div>
                      <div className="text-2xl font-bold text-primary-600 mt-1">
                        {resumen.unidadesUSA}
                      </div>
                    </div>
                    <Warehouse className="h-10 w-10 text-primary-400" />
                  </div>
                </Card>

                <Card padding="md">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Perú</div>
                      <div className="text-2xl font-bold text-success-600 mt-1">
                        {resumen.unidadesPeru}
                      </div>
                    </div>
                    <Warehouse className="h-10 w-10 text-success-400" />
                  </div>
                </Card>

                <Card padding="md">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">En Tránsito</div>
                      <div className="text-2xl font-bold text-warning-600 mt-1">
                        {resumen.unidadesTransito}
                      </div>
                    </div>
                    <Truck className="h-10 w-10 text-warning-400" />
                  </div>
                </Card>
              </div>

              {/* Stock por Almacén */}
              <Card>
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Stock por Almacén</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {resumen.stockPorAlmacen.map(stock => (
                      <div key={stock.almacen} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-gray-600">{stock.nombreAlmacen}</div>
                            <div className="text-xl font-bold text-gray-900 mt-1">
                              {stock.cantidad}
                            </div>
                          </div>
                          <Warehouse className="h-8 w-8 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Valor Total */}
              <Card padding="md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <TrendingUp className="h-8 w-8 text-primary-600" />
                    <div>
                      <div className="text-sm text-gray-600">Valor Total de Inventario</div>
                      <div className="text-3xl font-bold text-primary-600 mt-1">
                        S/ {resumen.valorTotalPEN.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <div>Disponibles: {resumen.unidadesDisponibles}</div>
                    <div>Asignadas: {resumen.unidadesAsignadas}</div>
                  </div>
                </div>
              </Card>
            </>
          )}

          {/* Tabla de Unidades */}
          <Card padding="none">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Unidades Individuales ({unidades.length})
              </h3>
            </div>
            <UnidadTable
              unidades={unidades}
              onViewDetails={handleViewDetails}
              loading={loading}
            />
          </Card>
        </>
      ) : (
        /* Estado vacío */
        <Card padding="lg">
          <div className="text-center py-12">
            <Package className="mx-auto h-16 w-16 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Selecciona un Producto
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Elige un producto para ver su inventario y gestionar unidades
            </p>
          </div>
        </Card>
      )}

      {/* Modal Recepción */}
      {selectedProducto && (
        <Modal
          isOpen={isRecepcionModalOpen}
          onClose={() => setIsRecepcionModalOpen(false)}
          title="Recibir Unidades"
          size="lg"
        >
          <RecepcionForm
            productoId={selectedProductoId}
            sku={selectedProducto.sku}
            onSubmit={handleCrearUnidades}
            onCancel={() => setIsRecepcionModalOpen(false)}
            loading={isSubmitting}
          />
        </Modal>
      )}

      {/* Modal Detalles */}
      <UnidadDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        unidad={selectedUnidad}
      />
    </div>
  );
};