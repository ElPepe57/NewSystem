import { Timestamp } from 'firebase/firestore';

/**
 * Tipo de insumo de empaque
 */
export type TipoInsumo = 'caja' | 'bolsa' | 'relleno' | 'cinta' | 'etiqueta' | 'otro';

/**
 * Unidad de medida del insumo
 */
export type UnidadMedidaInsumo = 'unidad' | 'metro' | 'rollo' | 'kg';

/**
 * Insumo de empaque — material usado para preparar envios a clientes
 */
export interface Insumo {
  id: string;
  codigo: string;                      // INS-001, INS-002, etc.
  nombre: string;
  tipo: TipoInsumo;
  unidadMedida: UnidadMedidaInsumo;

  // Stock
  stockActual: number;
  stockMinimo: number;                 // Alerta cuando stock < stockMinimo
  costoUnitarioPEN: number;            // Costo por unidad de medida

  // Proveedor
  proveedorNombre?: string;
  proveedorContacto?: string;

  // Estado
  activo: boolean;

  // Auditoria
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Datos para crear/editar un insumo
 */
export interface InsumoFormData {
  nombre: string;
  tipo: TipoInsumo;
  unidadMedida: UnidadMedidaInsumo;
  stockMinimo: number;
  costoUnitarioPEN: number;
  proveedorNombre?: string;
  proveedorContacto?: string;
  activo: boolean;
}

/**
 * Movimiento de insumo (entrada o salida)
 */
export interface MovimientoInsumo {
  id: string;
  insumoId: string;
  tipo: 'entrada' | 'salida';
  cantidad: number;
  costoUnitarioPEN?: number;           // Solo entradas
  motivo: string;                      // 'compra', 'consumo_kit', 'ajuste', etc.
  referenciaId?: string;               // ventaId, kitId, etc.
  fecha: Timestamp;
  registradoPor: string;
}
