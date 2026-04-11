import { Timestamp } from 'firebase/firestore';

/**
 * Componente de un kit de empaque
 */
export interface ComponenteKit {
  insumoId: string;
  insumoNombre: string;                // Desnormalizado
  cantidad: number;                    // Cantidad por kit
  costoUnitarioPEN: number;            // Costo al momento de definir el kit
}

/**
 * Kit de empaque — conjunto de insumos seleccionado por peso del producto
 * El kit correcto se elige automaticamente segun el peso del despacho.
 */
export interface KitEmpaque {
  id: string;
  codigo: string;                      // KIT-001, KIT-002, etc.
  nombre: string;                      // "Kit peque\u00f1o (0-1 lb)", "Kit mediano (1-3 lb)", etc.

  // Rango de peso (en libras)
  pesoMinLb: number;
  pesoMaxLb: number;

  // Componentes
  componentes: ComponenteKit[];
  costoTotalPEN: number;               // Suma de (cantidad * costoUnitario) de cada componente

  // Estado
  activo: boolean;

  // Auditoria
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Datos para crear/editar un kit
 */
export interface KitEmpaqueFormData {
  nombre: string;
  pesoMinLb: number;
  pesoMaxLb: number;
  componentes: {
    insumoId: string;
    cantidad: number;
  }[];
  activo: boolean;
}
