import type { OCFormState, OCFormAction } from './ocFormTypes';
import { EMPTY_PRODUCTO } from './ocFormTypes';

export function ocFormReducer(state: OCFormState, action: OCFormAction): OCFormState {
  switch (action.type) {
    case 'INIT':
      return { ...state, ...action.payload };

    case 'SET_PROVEEDOR':
      return { ...state, proveedor: action.payload };

    case 'SET_PAIS_ORIGEN': {
      // If country changes and almacen doesn't match, clear it
      const newState: OCFormState = { ...state, paisOrigenOC: action.payload };
      if (state.almacenDestino?.pais && state.almacenDestino.pais !== action.payload) {
        newState.almacenDestino = null;
      }
      return newState;
    }

    case 'SET_ALMACEN':
      return { ...state, almacenDestino: action.payload };

    case 'SET_TC':
      return { ...state, tcCompra: action.payload };

    case 'ADD_PRODUCTO':
      return { ...state, productos: [...state.productos, { ...EMPTY_PRODUCTO }] };

    case 'REMOVE_PRODUCTO':
      if (state.productos.length <= 1) return state;
      return { ...state, productos: state.productos.filter((_, i) => i !== action.payload) };

    case 'UPDATE_PRODUCTO': {
      const productos = [...state.productos];
      productos[action.payload.index] = {
        ...productos[action.payload.index],
        [action.payload.field]: action.payload.value,
      };
      return { ...state, productos };
    }

    case 'SELECT_PRODUCTO': {
      const productos = [...state.productos];
      productos[action.payload.index] = action.payload.producto;
      return { ...state, productos };
    }

    case 'SET_INTELLIGENCE':
      return {
        ...state,
        intelligenceCache: {
          ...state.intelligenceCache,
          [action.payload.productoId]: action.payload.result,
        },
      };

    case 'SET_INTELLIGENCE_LOADING':
      return {
        ...state,
        intelligenceLoading: {
          ...state.intelligenceLoading,
          [action.payload.productoId]: action.payload.loading,
        },
      };

    case 'APPLY_SUGGESTED_PRICE': {
      const productos = [...state.productos];
      productos[action.payload.index] = {
        ...productos[action.payload.index],
        costoUnitario: action.payload.precio,
      };
      return { ...state, productos };
    }

    case 'SET_TAX':
      return { ...state, porcentajeTax: action.payload };
    case 'SET_ENVIO':
      return { ...state, gastosEnvioUSD: action.payload };
    case 'SET_OTROS':
      return { ...state, otrosGastosUSD: action.payload };
    case 'SET_DESCUENTO':
      return { ...state, descuentoUSD: action.payload };
    case 'SET_TRACKING':
      return { ...state, numeroTracking: action.payload };
    case 'SET_COURIER':
      return { ...state, courier: action.payload };
    case 'SET_OBSERVACIONES':
      return { ...state, observaciones: action.payload };
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };

    default:
      return state;
  }
}
