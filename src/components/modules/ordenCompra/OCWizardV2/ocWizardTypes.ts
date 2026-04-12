import type {
  ModoEntregaDetallado, QuienPagaFlete,
  ProductoOrden, CargoOC, DescuentoOC, ImpuestoOC,
  SubOrdenCompra,
} from '../../../../types/ordenCompra.types';
import type { ConfigLogistica } from './WizardStepEntrega';

// ========== Delivery Config (derived from steps 0+1) ==========

export interface DeliveryConfig {
  modoEntrega: 'viajero' | 'envio_directo';
  fleteIncluidoEnPrecio: boolean;
  needsColaboradorSelector: boolean;
  colaboradorTipoFilter: 'viajero' | 'courier_externo' | null;
  showCostoEnvioField: boolean;
  skipStepFlete: boolean;
}

export function deriveDeliveryConfig(
  modo: ModoEntregaDetallado | null,
  quienPaga: QuienPagaFlete | null
): DeliveryConfig {
  const defaults: DeliveryConfig = {
    modoEntrega: 'envio_directo',
    fleteIncluidoEnPrecio: false,
    needsColaboradorSelector: false,
    colaboradorTipoFilter: null,
    showCostoEnvioField: false,
    skipStepFlete: false,
  };

  if (!modo) return defaults;

  // Paso de flete siempre se skipea — quienPaga se auto-deriva de la opción
  switch (modo) {
    case 'ddp_directo':
      return {
        ...defaults,
        fleteIncluidoEnPrecio: true,
        skipStepFlete: true,
      };
    case 'via_viajero':
      return {
        ...defaults,
        modoEntrega: 'viajero',
        needsColaboradorSelector: true,
        colaboradorTipoFilter: 'viajero',
        fleteIncluidoEnPrecio: false,
        showCostoEnvioField: true,
        skipStepFlete: true,
      };
    case 'via_courier':
      return {
        ...defaults,
        needsColaboradorSelector: true,
        colaboradorTipoFilter: 'courier_externo',
        fleteIncluidoEnPrecio: false,
        showCostoEnvioField: true,
        skipStepFlete: true,
      };
    case 'recojo_propio':
      return {
        ...defaults,
        skipStepFlete: true,
      };
    default:
      return defaults;
  }
}

// ========== Wizard State ==========

export interface OCWizardState {
  currentStep: number;

  // Step 0: Delivery config (smart form)
  configLogistica: ConfigLogistica;

  // Step 0-1: Delivery (derived from configLogistica at submit time)
  modoEntregaDetallado: ModoEntregaDetallado | null;
  quienPagaFlete: QuienPagaFlete | null;
  colaboradorId: string;
  colaboradorNombre: string;

  // Step 2: Provider + Products
  proveedorId: string;
  proveedorNombre: string;
  paisOrigen: string;
  tcCompra: number;
  productos: ProductoOrden[];
  subOrdenes: SubOrdenCompra[];
  useSubOrdenes: boolean;

  // Step 3: Cargos/Descuentos/Impuestos
  cargosOC: CargoOC[];
  descuentosOC: DescuentoOC[];
  impuestosOC: ImpuestoOC[];

  // Step 4: Notes
  observaciones: string;
}

export const initialWizardState: OCWizardState = {
  currentStep: 0,
  configLogistica: {
    salidaProveedor: null,
    fleteProveedorIncluido: null,
    costoShippingProveedor: null,
    tipoShipping: null,
    llegadaPeru: null,
    colaboradorId: '',
    colaboradorNombre: '',
    ultimaMilla: null,
    requiereRecojo: false,
  },
  modoEntregaDetallado: null,
  quienPagaFlete: null,
  colaboradorId: '',
  colaboradorNombre: '',
  proveedorId: '',
  proveedorNombre: '',
  paisOrigen: 'USA',
  tcCompra: 0,
  productos: [],
  subOrdenes: [],
  useSubOrdenes: false,
  cargosOC: [],
  descuentosOC: [],
  impuestosOC: [],
  observaciones: '',
};

// ========== Active Steps Logic ==========

export function getActiveSteps(state: OCWizardState): number[] {
  const config = deriveDeliveryConfig(state.modoEntregaDetallado, state.quienPagaFlete);
  const steps = [0]; // Step 0 always active
  if (!config.skipStepFlete) steps.push(1);
  steps.push(2, 3, 4);
  return steps;
}

export function getNextStep(state: OCWizardState): number | null {
  const active = getActiveSteps(state);
  const currentIdx = active.indexOf(state.currentStep);
  return currentIdx < active.length - 1 ? active[currentIdx + 1] : null;
}

export function getPrevStep(state: OCWizardState): number | null {
  const active = getActiveSteps(state);
  const currentIdx = active.indexOf(state.currentStep);
  return currentIdx > 0 ? active[currentIdx - 1] : null;
}
