import type { ProveedorSnapshot } from '../../entidades/ProveedorAutocomplete';
import type { AlmacenSnapshot } from '../../entidades/AlmacenAutocomplete';
import type { PriceIntelligenceResult } from '../../../../types/priceIntelligence.types';

export interface ProductoOrdenItem {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  cantidad: number;
  costoUnitario: number;
  sugerenciaPrecio?: number;
  // Intelligence
  lineaNegocioId?: string;
  paisOrigen?: string;
}

export interface OCFormState {
  // Step 1
  proveedor: ProveedorSnapshot | null;
  paisOrigenOC: string;
  almacenDestino: AlmacenSnapshot | null;
  tcCompra: number;
  productos: ProductoOrdenItem[];

  // Step 2 - Intelligence cache
  intelligenceCache: Record<string, PriceIntelligenceResult>;
  intelligenceLoading: Record<string, boolean>;

  // Step 3 - Costs
  porcentajeTax: number;
  costoEnvioProveedorUSD: number;
  otrosGastosCompraUSD: number;
  descuentoUSD: number;
  numeroTracking: string;
  courier: string;
  observaciones: string;

  // Navigation
  currentStep: number;
}

export type OCFormAction =
  | { type: 'SET_PROVEEDOR'; payload: ProveedorSnapshot | null }
  | { type: 'SET_PAIS_ORIGEN'; payload: string }
  | { type: 'SET_ALMACEN'; payload: AlmacenSnapshot | null }
  | { type: 'SET_TC'; payload: number }
  | { type: 'ADD_PRODUCTO' }
  | { type: 'REMOVE_PRODUCTO'; payload: number }
  | { type: 'UPDATE_PRODUCTO'; payload: { index: number; field: string; value: any } }
  | { type: 'SELECT_PRODUCTO'; payload: { index: number; producto: ProductoOrdenItem } }
  | { type: 'SET_INTELLIGENCE'; payload: { productoId: string; result: PriceIntelligenceResult } }
  | { type: 'SET_INTELLIGENCE_LOADING'; payload: { productoId: string; loading: boolean } }
  | { type: 'APPLY_SUGGESTED_PRICE'; payload: { index: number; precio: number } }
  | { type: 'SET_TAX'; payload: number }
  | { type: 'SET_ENVIO'; payload: number }
  | { type: 'SET_OTROS'; payload: number }
  | { type: 'SET_DESCUENTO'; payload: number }
  | { type: 'SET_TRACKING'; payload: string }
  | { type: 'SET_COURIER'; payload: string }
  | { type: 'SET_OBSERVACIONES'; payload: string }
  | { type: 'SET_STEP'; payload: number }
  | { type: 'INIT'; payload: Partial<OCFormState> };

export const EMPTY_PRODUCTO: ProductoOrdenItem = {
  productoId: '',
  sku: '',
  marca: '',
  nombreComercial: '',
  presentacion: '',
  cantidad: 1,
  costoUnitario: 0,
};

export const INITIAL_STATE: OCFormState = {
  proveedor: null,
  paisOrigenOC: '',
  almacenDestino: null,
  tcCompra: 0,
  productos: [{ ...EMPTY_PRODUCTO }],
  intelligenceCache: {},
  intelligenceLoading: {},
  porcentajeTax: 0,
  costoEnvioProveedorUSD: 0,
  otrosGastosCompraUSD: 0,
  descuentoUSD: 0,
  numeroTracking: '',
  courier: '',
  observaciones: '',
  currentStep: 0,
};

// Computed selectors
export const getProductosValidos = (state: OCFormState) =>
  state.productos.filter(p => p.productoId && p.cantidad > 0 && p.costoUnitario > 0);

export const getSubtotalUSD = (state: OCFormState) =>
  state.productos.reduce((sum, p) => p.productoId ? sum + p.cantidad * p.costoUnitario : sum, 0);

export const getImpuestoUSD = (state: OCFormState) => {
  const subtotal = getSubtotalUSD(state);
  return subtotal > 0 ? (subtotal * state.porcentajeTax) / 100 : 0;
};

export const getTotalUSD = (state: OCFormState) => {
  return getSubtotalUSD(state) + getImpuestoUSD(state) + state.costoEnvioProveedorUSD + state.otrosGastosCompraUSD - state.descuentoUSD;
};

export const getTotalPEN = (state: OCFormState) => {
  return state.tcCompra > 0 ? getTotalUSD(state) * state.tcCompra : 0;
};

export const getTotalUnidades = (state: OCFormState) =>
  state.productos.reduce((sum, p) => p.productoId ? sum + p.cantidad : sum, 0);

export const STEP_CONFIG = [
  { label: 'Origen', description: 'Proveedor, destino y productos' },
  { label: 'Inteligencia', description: 'Análisis de precios y márgenes' },
  { label: 'Confirmar', description: 'Costos, resumen y confirmación' },
];
