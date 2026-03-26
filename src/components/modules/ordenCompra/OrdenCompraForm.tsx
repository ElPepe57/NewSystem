import React from 'react';
import { OCFormWizard } from './OCFormWizard/OCFormWizard';
import type { OrdenCompraFormData, Proveedor } from '../../../types/ordenCompra.types';
import type { Producto } from '../../../types/producto.types';

export interface OrdenCompraFormProps {
  proveedores: Proveedor[];
  productos: Producto[];
  onSubmit: (data: OrdenCompraFormData) => void;
  onCancel: () => void;
  loading?: boolean;
  tcSugerido?: number;
  initialProductos?: Array<{
    productoId: string;
    cantidad: number;
    precioUnitarioUSD: number;
  }>;
  requerimientoId?: string;
  requerimientoNumero?: string;
  // Multi-requerimiento (OC consolidada)
  requerimientoIds?: string[];
  requerimientoNumeros?: string[];
  clientesOrigen?: Array<{ requerimientoId: string; requerimientoNumero: string; clienteNombre: string }>;
  productosOrigen?: Array<{ productoId: string; requerimientoId: string; cantidad: number; cotizacionId?: string; clienteNombre?: string }>;
  initialViajero?: {
    id: string;
    nombre: string;
  };
  // Props para modo edicion
  ordenEditar?: {
    id: string;
    numeroOrden: string;
    proveedorId: string;
    nombreProveedor: string;
    almacenDestino: string;
    productos: Array<{
      productoId: string;
      sku: string;
      marca: string;
      nombreComercial: string;
      presentacion: string;
      cantidad: number;
      costoUnitario: number;
    }>;
    subtotalUSD: number;
    impuestoUSD?: number;
    costoEnvioProveedorUSD?: number;
    otrosGastosCompraUSD?: number;
    descuentoUSD?: number;
    totalUSD: number;
    tcCompra: number;
    numeroTracking?: string;
    courier?: string;
    observaciones?: string;
  };
  isEditMode?: boolean;
}

export const OrdenCompraForm: React.FC<OrdenCompraFormProps> = (props) => {
  return <OCFormWizard {...props} />;
};
