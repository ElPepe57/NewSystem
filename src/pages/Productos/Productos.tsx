import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Card, Modal } from '../../components/common';
import { ProductoForm } from '../../components/modules/productos/ProductoForm';
import { ProductoTable } from '../../components/modules/productos/ProductoTable';
import { ProductoCard } from '../../components/modules/productos/ProductoCard';
import { useProductoStore } from '../../store/productoStore';
import { useAuthStore } from '../../store/authStore';
import type { Producto, ProductoFormData } from '../../types/producto.types';

export const Productos: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { productos, loading, fetchProductos, createProducto, updateProducto, deleteProducto } = useProductoStore();
  
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProductos();
  }, [fetchProductos]);

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
        await updateProducto(selectedProducto.id, data, user.uid);
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

  const productosArray = Array.isArray(productos) ? productos : [];
  const productosActivos = productosArray.filter(p => p.estado === 'activo').length;
  const productosConML = productosArray.filter(p => p.urlMercadoLibre).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-600 mt-1">Gestiona tu catálogo de productos</p>
        </div>
        <Button variant="primary" onClick={handleCreate}>
          <Plus className="h-5 w-5 mr-2" />
          Nuevo Producto
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </div>

      <Card padding="md">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <ProductoTable
            productos={productosArray}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
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
          />
        )}
      </Modal>
    </div>
  );
};