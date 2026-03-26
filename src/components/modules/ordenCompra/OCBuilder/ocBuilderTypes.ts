import type { ProveedorSnapshot } from '../../entidades/ProveedorAutocomplete';
import type { AlmacenSnapshot } from '../../entidades/AlmacenAutocomplete';
import type { Requerimiento, ProductoRequerimiento } from '../../../../types/requerimiento.types';

// ============ Product types ============

/** Origen de un producto (de qué requerimiento/cliente viene) */
export interface ProductoOrigen {
  requerimientoId: string;
  requerimientoNumero: string;
  cotizacionId?: string;
  clienteNombre?: string;
  cantidad: number;
}

/** Un producto dentro de un grupo draft */
export interface OCBuilderProducto {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  contenido?: string;
  dosaje?: string;
  sabor?: string;
  cantidad: number;
  costoUnitarioUSD: number;
  proveedorSugerido?: string;
  urlReferencia?: string;
  origenes: ProductoOrigen[];
}

/** Producto en el pool (sin asignar o parcialmente asignado) */
export interface PoolProducto extends OCBuilderProducto {
  cantidadOriginal: number;
  cantidadAsignada: number; // suma de cantidades en todos los grupos
}

// ============ Group types ============

const GROUP_COLORS = ['blue', 'emerald', 'amber', 'purple', 'rose', 'cyan', 'orange', 'indigo'] as const;
export type GroupColor = typeof GROUP_COLORS[number];
export { GROUP_COLORS };

/** Un grupo draft = 1 futura OC */
export interface OCDraftGroup {
  id: string;
  nombre: string;
  color: GroupColor;
  proveedor: ProveedorSnapshot | null;
  almacenDestino: AlmacenSnapshot | null;
  productos: OCBuilderProducto[];
  tcCompra: number;
  porcentajeTax: number;
  costoEnvioProveedorUSD: number;
  otrosGastosCompraUSD: number;
  descuentoUSD: number;
  observaciones: string;
}

// ============ State ============

export interface OCBuilderState {
  // Source
  requerimientos: Requerimiento[];
  pool: PoolProducto[];

  // Draft OCs
  groups: OCDraftGroup[];
  activeGroupId: string | null;

  // Global settings
  tcGlobal: number;
  tcMode: 'global' | 'per_group';

  // Wizard
  currentStep: number;

  // Creation
  isCreating: boolean;
  creationProgress: { completed: number; total: number; currentName: string } | null;
  creationErrors: Array<{ groupId: string; groupName: string; error: string }>;
  createdOCs: Array<{ id: string; numeroOrden: string; groupName: string }>;
}

// ============ Actions ============

export type OCBuilderAction =
  // Init
  | { type: 'INIT'; payload: { requerimientos: Requerimiento[]; tcSugerido: number } }

  // Groups
  | { type: 'ADD_GROUP'; payload?: { nombre?: string; almacenDestino?: AlmacenSnapshot | null } }
  | { type: 'REMOVE_GROUP'; payload: { groupId: string } }
  | { type: 'SET_ACTIVE_GROUP'; payload: { groupId: string } }
  | { type: 'RENAME_GROUP'; payload: { groupId: string; nombre: string } }

  // Product assignment
  | { type: 'ASSIGN_PRODUCT'; payload: { productoId: string; groupId: string; cantidad: number } }
  | { type: 'UNASSIGN_PRODUCT'; payload: { productoId: string; groupId: string } }
  | { type: 'UPDATE_PRODUCT_IN_GROUP'; payload: { groupId: string; productoId: string; changes: Partial<Pick<OCBuilderProducto, 'cantidad' | 'costoUnitarioUSD'>> } }

  // Auto-grouping
  | { type: 'AUTO_GROUP_BY_PROVEEDOR' }
  | { type: 'ASSIGN_ALL_TO_GROUP'; payload: { groupId: string } }
  | { type: 'RESET_GROUPS' }

  // Group config (Step 2)
  | { type: 'SET_GROUP_PROVEEDOR'; payload: { groupId: string; proveedor: ProveedorSnapshot | null } }
  | { type: 'SET_GROUP_DESTINO'; payload: { groupId: string; almacen: AlmacenSnapshot | null } }
  | { type: 'SET_GROUP_TC'; payload: { groupId: string; tc: number } }
  | { type: 'SET_GROUP_TAX'; payload: { groupId: string; porcentajeTax: number } }
  | { type: 'SET_GROUP_ENVIO'; payload: { groupId: string; costoEnvioProveedorUSD: number } }
  | { type: 'SET_GROUP_OTROS'; payload: { groupId: string; otrosGastosCompraUSD: number } }
  | { type: 'SET_GROUP_DESCUENTO'; payload: { groupId: string; descuentoUSD: number } }
  | { type: 'SET_GROUP_OBSERVACIONES'; payload: { groupId: string; observaciones: string } }

  // Global
  | { type: 'SET_TC_GLOBAL'; payload: { tc: number } }
  | { type: 'SET_TC_MODE'; payload: { mode: 'global' | 'per_group' } }

  // Navigation
  | { type: 'SET_STEP'; payload: { step: number } }

  // Draft restore
  | { type: 'RESTORE_DRAFT'; payload: { groups: OCDraftGroup[]; tcGlobal: number; tcMode: 'global' | 'per_group'; currentStep: number; activeGroupId: string | null } }

  // Creation
  | { type: 'START_CREATION' }
  | { type: 'CREATION_PROGRESS'; payload: { completed: number; total: number; currentName: string } }
  | { type: 'CREATION_ERROR'; payload: { groupId: string; groupName: string; error: string } }
  | { type: 'CREATION_SUCCESS'; payload: { id: string; numeroOrden: string; groupName: string } }
  | { type: 'CREATION_COMPLETE' };

// ============ Props ============

export interface OCBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  requerimientos: Requerimiento[];
  tcSugerido?: number;
  onComplete: (ordenesCreadas: Array<{ id: string; numeroOrden: string; groupName: string }>) => void;
}

// ============ Computed helpers ============

export interface GroupTotals {
  subtotalUSD: number;
  impuestoUSD: number;
  costoEnvioProveedorUSD: number;
  otrosGastosCompraUSD: number;
  descuentoUSD: number;
  totalUSD: number;
  totalPEN: number;
  cantidadProductos: number;
  cantidadUnidades: number;
}
