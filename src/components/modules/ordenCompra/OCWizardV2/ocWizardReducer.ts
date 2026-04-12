import { initialWizardState } from './ocWizardTypes';
import type { OCWizardState } from './ocWizardTypes';
import type {
  ModoEntregaDetallado, QuienPagaFlete,
  ProductoOrden, CargoOC, DescuentoOC, ImpuestoOC,
  SubOrdenCompra,
} from '../../../../types/ordenCompra.types';

export type OCWizardAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_MODO_ENTREGA'; modo: ModoEntregaDetallado }
  | { type: 'SET_QUIEN_PAGA'; quien: QuienPagaFlete }
  | { type: 'SET_COLABORADOR'; id: string; nombre: string }
  | { type: 'SET_PROVEEDOR'; id: string; nombre: string }
  | { type: 'SET_PAIS_ORIGEN'; pais: string }
  | { type: 'SET_TC'; tc: number }
  | { type: 'SET_PRODUCTOS'; productos: ProductoOrden[] }
  | { type: 'ADD_PRODUCTO'; producto: ProductoOrden }
  | { type: 'REMOVE_PRODUCTO'; index: number }
  | { type: 'UPDATE_PRODUCTO'; index: number; producto: ProductoOrden }
  | { type: 'TOGGLE_SUBORDENES' }
  | { type: 'SET_SUBORDENES'; subOrdenes: SubOrdenCompra[] }
  | { type: 'ADD_CARGO'; cargo: CargoOC }
  | { type: 'REMOVE_CARGO'; id: string }
  | { type: 'UPDATE_CARGO'; cargo: CargoOC }
  | { type: 'ADD_DESCUENTO'; descuento: DescuentoOC }
  | { type: 'REMOVE_DESCUENTO'; id: string }
  | { type: 'UPDATE_DESCUENTO'; descuento: DescuentoOC }
  | { type: 'ADD_IMPUESTO'; impuesto: ImpuestoOC }
  | { type: 'REMOVE_IMPUESTO'; id: string }
  | { type: 'UPDATE_IMPUESTO'; impuesto: ImpuestoOC }
  | { type: 'SET_OBSERVACIONES'; text: string }
  | { type: 'RESET' };

export function ocWizardReducer(state: OCWizardState, action: OCWizardAction): OCWizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step };

    case 'SET_MODO_ENTREGA':
      return {
        ...state,
        modoEntregaDetallado: action.modo,
        // Reset flete when changing mode
        quienPagaFlete: null,
        colaboradorId: '',
        colaboradorNombre: '',
      };

    case 'SET_QUIEN_PAGA':
      return { ...state, quienPagaFlete: action.quien };

    case 'SET_COLABORADOR':
      return { ...state, colaboradorId: action.id, colaboradorNombre: action.nombre };

    case 'SET_PROVEEDOR':
      return { ...state, proveedorId: action.id, proveedorNombre: action.nombre };

    case 'SET_PAIS_ORIGEN':
      return { ...state, paisOrigen: action.pais };

    case 'SET_TC':
      return { ...state, tcCompra: action.tc };

    case 'SET_PRODUCTOS':
      return { ...state, productos: action.productos };

    case 'ADD_PRODUCTO':
      return { ...state, productos: [...state.productos, action.producto] };

    case 'REMOVE_PRODUCTO':
      return { ...state, productos: state.productos.filter((_, i) => i !== action.index) };

    case 'UPDATE_PRODUCTO':
      return {
        ...state,
        productos: state.productos.map((p, i) => i === action.index ? action.producto : p),
      };

    case 'TOGGLE_SUBORDENES':
      return { ...state, useSubOrdenes: !state.useSubOrdenes, subOrdenes: [] };

    case 'SET_SUBORDENES':
      return { ...state, subOrdenes: action.subOrdenes };

    case 'ADD_CARGO':
      return { ...state, cargosOC: [...state.cargosOC, action.cargo] };
    case 'REMOVE_CARGO':
      return { ...state, cargosOC: state.cargosOC.filter(c => c.id !== action.id) };
    case 'UPDATE_CARGO':
      return { ...state, cargosOC: state.cargosOC.map(c => c.id === action.cargo.id ? action.cargo : c) };

    case 'ADD_DESCUENTO':
      return { ...state, descuentosOC: [...state.descuentosOC, action.descuento] };
    case 'REMOVE_DESCUENTO':
      return { ...state, descuentosOC: state.descuentosOC.filter(d => d.id !== action.id) };
    case 'UPDATE_DESCUENTO':
      return { ...state, descuentosOC: state.descuentosOC.map(d => d.id === action.descuento.id ? action.descuento : d) };

    case 'ADD_IMPUESTO':
      return { ...state, impuestosOC: [...state.impuestosOC, action.impuesto] };
    case 'REMOVE_IMPUESTO':
      return { ...state, impuestosOC: state.impuestosOC.filter(i => i.id !== action.id) };
    case 'UPDATE_IMPUESTO':
      return { ...state, impuestosOC: state.impuestosOC.map(i => i.id === action.impuesto.id ? action.impuesto : i) };

    case 'SET_OBSERVACIONES':
      return { ...state, observaciones: action.text };

    case 'RESET':
      return { ...initialWizardState };

    default:
      return state;
  }
}
