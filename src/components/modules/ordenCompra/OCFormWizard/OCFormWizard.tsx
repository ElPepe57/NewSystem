/**
 * OC FORM WIZARD - Main Orchestrator
 * 3-step wizard for creating/editing purchase orders.
 * Step 0: Origin (proveedor, almacen, products)
 * Step 1: Intelligence (price analysis, margins)
 * Step 2: Confirm (costs, summary, tracking, submit)
 */

import React, { useReducer, useEffect, useMemo, useCallback } from 'react';
import { Package, DollarSign } from 'lucide-react';
import { Stepper, StepContent, StepNavigation } from '../../../common/Stepper';
import type { Step } from '../../../common/Stepper';
import { OCFormStep1 } from './OCFormStep1';
import { OCFormStep2 } from './OCFormStep2';
import { OCFormStep3 } from './OCFormStep3';
import { ocFormReducer } from './ocFormReducer';
import {
  INITIAL_STATE,
  STEP_CONFIG,
  getProductosValidos,
  getSubtotalUSD,
  getImpuestoUSD,
  getTotalUSD,
  getTotalPEN,
  getTotalUnidades,
} from './ocFormTypes';
import { OrdenCompraService } from '../../../../services/ordenCompra.service';
import { useAuthStore } from '../../../../store/authStore';
import { useToastStore } from '../../../../store/toastStore';
import { usePaisOrigenStore } from '../../../../store/paisOrigenStore';
import type { OrdenCompraFormData, Proveedor, ProveedorFormData } from '../../../../types/ordenCompra.types';
import type { Producto } from '../../../../types/producto.types';

// ============================================
// PROPS - mirrors the old OrdenCompraFormProps
// ============================================

export interface OCFormWizardProps {
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
  requerimientoIds?: string[];
  requerimientoNumeros?: string[];
  clientesOrigen?: Array<{ requerimientoId: string; requerimientoNumero: string; clienteNombre: string }>;
  productosOrigen?: Array<{ productoId: string; requerimientoId: string; cantidad: number; cotizacionId?: string; clienteNombre?: string }>;
  initialViajero?: {
    id: string;
    nombre: string;
  };
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
    gastosEnvioUSD?: number;
    otrosGastosUSD?: number;
    descuentoUSD?: number;
    totalUSD: number;
    tcCompra: number;
    numeroTracking?: string;
    courier?: string;
    observaciones?: string;
  };
  isEditMode?: boolean;
}

// ============================================
// STEPPER STEPS
// ============================================

const STEPS: Step[] = STEP_CONFIG.map((s, i) => ({
  id: i,
  label: s.label,
  description: s.description,
}));

// ============================================
// COMPONENT
// ============================================

export const OCFormWizard: React.FC<OCFormWizardProps> = ({
  proveedores,
  productos,
  onSubmit,
  onCancel,
  loading = false,
  tcSugerido,
  initialProductos,
  requerimientoId,
  requerimientoNumero,
  requerimientoIds,
  requerimientoNumeros,
  clientesOrigen,
  productosOrigen,
  initialViajero,
  ordenEditar,
  isEditMode = false,
}) => {
  const { user } = useAuthStore();
  const toast = useToastStore();
  const { paisesActivos: paisesOrigen } = usePaisOrigenStore();

  const [state, dispatch] = useReducer(ocFormReducer, INITIAL_STATE);

  // ── Initialization ──
  useEffect(() => {
    const init: Partial<typeof state> = {};

    // Edit mode
    if (ordenEditar) {
      init.proveedor = {
        proveedorId: ordenEditar.proveedorId,
        nombre: ordenEditar.nombreProveedor,
        pais: '',
      };
      init.almacenDestino = {
        almacenId: ordenEditar.almacenDestino,
        nombre: '',
        ciudad: '',
        pais: '',
      };
      init.tcCompra = ordenEditar.tcCompra;
      init.productos = ordenEditar.productos.map(p => ({
        productoId: p.productoId,
        sku: p.sku,
        marca: p.marca,
        nombreComercial: p.nombreComercial,
        presentacion: p.presentacion,
        cantidad: p.cantidad,
        costoUnitario: p.costoUnitario,
      }));
      if (ordenEditar.impuestoUSD && ordenEditar.subtotalUSD > 0) {
        init.porcentajeTax = (ordenEditar.impuestoUSD / ordenEditar.subtotalUSD) * 100;
      }
      init.gastosEnvioUSD = ordenEditar.gastosEnvioUSD || 0;
      init.otrosGastosUSD = ordenEditar.otrosGastosUSD || 0;
      init.descuentoUSD = ordenEditar.descuentoUSD || 0;
      init.numeroTracking = ordenEditar.numeroTracking || '';
      init.courier = ordenEditar.courier || '';
      init.observaciones = ordenEditar.observaciones || '';
    } else {
      // New order with initial products
      if (initialProductos && initialProductos.length > 0) {
        init.productos = initialProductos.map(p => {
          const prod = productos.find(pr => pr.id === p.productoId);
          return {
            productoId: p.productoId,
            sku: prod?.sku || '',
            marca: prod?.marca || '',
            nombreComercial: prod?.nombreComercial || '',
            presentacion: prod?.presentacion || '',
            cantidad: p.cantidad,
            costoUnitario: p.precioUnitarioUSD,
          };
        });
      }
    }

    // TC
    if (!ordenEditar && tcSugerido && tcSugerido > 0) {
      init.tcCompra = tcSugerido;
    }

    // Initial viajero
    if (!ordenEditar && initialViajero) {
      init.almacenDestino = {
        almacenId: initialViajero.id,
        nombre: initialViajero.nombre,
        ciudad: '',
        pais: '',
      };
    }

    if (Object.keys(init).length > 0) {
      dispatch({ type: 'INIT', payload: init });
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // TC sugerido update (if it arrives after mount)
  useEffect(() => {
    if (tcSugerido && tcSugerido > 0 && state.tcCompra === 0) {
      dispatch({ type: 'SET_TC', payload: tcSugerido });
    }
  }, [tcSugerido, state.tcCompra]);

  // ── Derived values ──
  const productosValidos = getProductosValidos(state);
  const subtotalUSD = getSubtotalUSD(state);
  const totalUSD = getTotalUSD(state);
  const totalPEN = getTotalPEN(state);
  const totalUnidades = getTotalUnidades(state);

  // Derive lineaNegocioId and paisOrigen from products (same logic as old form)
  const { derivedLineaNegocioId, derivedLineaNegocioNombre, derivedPaisOrigen } = useMemo(() => {
    const lineaIds: string[] = [];
    const lineaNombres: Record<string, string> = {};
    const paises: string[] = [];

    for (const item of productosValidos) {
      const prod = productos.find(p => p.id === item.productoId);
      if (prod) {
        if (prod.lineaNegocioId) {
          lineaIds.push(prod.lineaNegocioId);
          if (prod.lineaNegocioNombre) lineaNombres[prod.lineaNegocioId] = prod.lineaNegocioNombre;
        }
        if (prod.paisOrigen) paises.push(prod.paisOrigen);
      }
    }

    let dLineaId: string | undefined;
    let dLineaNombre: string | undefined;
    if (lineaIds.length > 0) {
      const freq: Record<string, number> = {};
      for (const id of lineaIds) freq[id] = (freq[id] || 0) + 1;
      dLineaId = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
      dLineaNombre = lineaNombres[dLineaId];
    }

    // paisOrigenOC has priority (explicitly selected by user)
    let dPais: string | undefined = state.paisOrigenOC || undefined;
    if (!dPais && paises.length > 0) {
      const freq: Record<string, number> = {};
      for (const p of paises) freq[p] = (freq[p] || 0) + 1;
      dPais = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    } else if (!dPais && state.proveedor?.pais) {
      dPais = state.proveedor.pais;
    }

    return {
      derivedLineaNegocioId: dLineaId,
      derivedLineaNegocioNombre: dLineaNombre,
      derivedPaisOrigen: dPais,
    };
  }, [productosValidos, productos, state.proveedor, state.paisOrigenOC]);

  // Pais origen nombre for display
  const paisOrigenNombre = useMemo(() => {
    const p = derivedPaisOrigen;
    if (!p) return undefined;
    const pais = paisesOrigen.find(po => po.id === p || po.codigo === p || po.nombre === p);
    return pais?.nombre || p;
  }, [derivedPaisOrigen, paisesOrigen]);

  // ── Handlers ──
  const handleCreateProveedor = useCallback(async (data: ProveedorFormData): Promise<Proveedor> => {
    if (!user) throw new Error('Usuario no autenticado');
    return await OrdenCompraService.createProveedor(data, user.uid);
  }, [user]);

  // Step validation
  const validateStep = useCallback((step: number): boolean => {
    switch (step) {
      case 0: {
        if (!state.proveedor) {
          toast.warning('Debe seleccionar un proveedor');
          return false;
        }
        if (!state.almacenDestino) {
          toast.warning('Debe seleccionar un almacen de destino');
          return false;
        }
        if (state.tcCompra <= 0) {
          toast.warning('El tipo de cambio debe ser mayor a 0');
          return false;
        }
        if (productosValidos.length === 0) {
          toast.warning('Debe agregar al menos un producto con cantidad y costo validos');
          return false;
        }
        return true;
      }
      case 1:
        // Intelligence step is informational, no required validation
        return true;
      case 2:
        if (totalUSD <= 0) {
          toast.warning('El total debe ser mayor a 0');
          return false;
        }
        return true;
      default:
        return true;
    }
  }, [state.proveedor, state.almacenDestino, state.tcCompra, productosValidos.length, totalUSD, toast]);

  const handleNext = useCallback(() => {
    if (!validateStep(state.currentStep)) return;

    if (state.currentStep < STEPS.length - 1) {
      dispatch({ type: 'SET_STEP', payload: state.currentStep + 1 });
    }
  }, [state.currentStep, validateStep]);

  const handlePrev = useCallback(() => {
    if (state.currentStep > 0) {
      dispatch({ type: 'SET_STEP', payload: state.currentStep - 1 });
    }
  }, [state.currentStep]);

  const handleStepClick = useCallback((stepIndex: number) => {
    // Allow clicking to go back only
    if (stepIndex < state.currentStep) {
      dispatch({ type: 'SET_STEP', payload: stepIndex });
    }
  }, [state.currentStep]);

  // Submit handler - builds the EXACT same OrdenCompraFormData as the old form
  const handleSubmit = useCallback(() => {
    if (!validateStep(2)) return;
    if (!state.proveedor || !state.almacenDestino) return;

    const productosConInfo = productosValidos.map(item => ({
      productoId: item.productoId,
      sku: item.sku,
      marca: item.marca,
      nombreComercial: item.nombreComercial,
      presentacion: item.presentacion,
      cantidad: item.cantidad,
      costoUnitario: item.costoUnitario,
      subtotal: item.cantidad * item.costoUnitario,
      viajeroId: state.almacenDestino!.almacenId,
      viajeroNombre: state.almacenDestino!.nombre,
    }));

    const impuestoUSD = getImpuestoUSD(state);

    const formData: OrdenCompraFormData = {
      proveedorId: state.proveedor.proveedorId,
      productos: productosConInfo,
      subtotalUSD,
      impuestoUSD: impuestoUSD > 0 ? impuestoUSD : undefined,
      gastosEnvioUSD: state.gastosEnvioUSD > 0 ? state.gastosEnvioUSD : undefined,
      otrosGastosUSD: state.otrosGastosUSD > 0 ? state.otrosGastosUSD : undefined,
      descuentoUSD: state.descuentoUSD > 0 ? state.descuentoUSD : undefined,
      totalUSD,
      tcCompra: state.tcCompra,
      almacenDestino: state.almacenDestino.almacenId,
      numeroTracking: state.numeroTracking.trim() || undefined,
      courier: state.courier.trim() || undefined,
      observaciones: state.observaciones.trim() || undefined,
      // Origen y linea de negocio (auto-heredados de productos)
      paisOrigen: derivedPaisOrigen,
      lineaNegocioId: derivedLineaNegocioId,
      lineaNegocioNombre: derivedLineaNegocioNombre,
      requerimientoId: requerimientoId || undefined,
      // Multi-requerimiento (OC consolidada)
      ...(requerimientoIds && requerimientoIds.length > 0 ? {
        requerimientoIds,
        productosOrigen: productosOrigen || undefined,
      } : {}),
    };

    onSubmit(formData);
  }, [
    state, productosValidos, subtotalUSD, totalUSD,
    derivedPaisOrigen, derivedLineaNegocioId, derivedLineaNegocioNombre,
    requerimientoId, requerimientoIds, productosOrigen,
    onSubmit, validateStep,
  ]);

  // Navigation handler for last step
  const handleNextOrSubmit = useCallback(() => {
    if (state.currentStep === STEPS.length - 1) {
      handleSubmit();
    } else {
      handleNext();
    }
  }, [state.currentStep, handleSubmit, handleNext]);

  const isFirstStep = state.currentStep === 0;
  const isLastStep = state.currentStep === STEPS.length - 1;

  return (
    <div className="space-y-4">
      {/* ── Stepper Header ── */}
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Stepper */}
          <div className="flex-1 min-w-0">
            <Stepper
              steps={STEPS}
              currentStep={state.currentStep}
              onStepClick={handleStepClick}
              size="sm"
              allowClickCompleted={true}
              allowClickFuture={false}
              autoResponsive={false}
            />
          </div>

          {/* Summary badges */}
          <div className="flex items-center gap-2 text-xs flex-shrink-0">
            {state.tcCompra > 0 && (
              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full whitespace-nowrap">
                TC {state.tcCompra.toFixed(3)}
              </span>
            )}
            {totalUSD > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 rounded-full font-medium whitespace-nowrap">
                <DollarSign className="h-3 w-3" />
                ${totalUSD.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Step Content ── */}
      <StepContent currentStep={state.currentStep}>
        {/* Step 0 */}
        <OCFormStep1
          state={state}
          dispatch={dispatch}
          productos={productos}
          proveedores={proveedores}
          onCreateProveedor={handleCreateProveedor}
          requerimientoId={requerimientoId}
          requerimientoNumero={requerimientoNumero}
          requerimientoIds={requerimientoIds}
          requerimientoNumeros={requerimientoNumeros}
          clientesOrigen={clientesOrigen}
        />

        {/* Step 1 */}
        <OCFormStep2
          state={state}
          dispatch={dispatch}
          productos={productos}
        />

        {/* Step 2 */}
        <OCFormStep3
          state={state}
          dispatch={dispatch}
          productos={productos}
          paisOrigenNombre={paisOrigenNombre}
          fleteEstimadoTotal={0}
        />
      </StepContent>

      {/* ── Navigation ── */}
      <StepNavigation
        onPrev={isFirstStep ? onCancel : handlePrev}
        onNext={handleNextOrSubmit}
        isFirstStep={false}
        isLastStep={isLastStep}
        prevLabel={isFirstStep ? 'Cancelar' : 'Anterior'}
        nextLabel="Siguiente"
        completeLabel={loading
          ? (isEditMode ? 'Actualizando...' : 'Creando...')
          : (isEditMode ? 'Actualizar Orden' : 'Crear Orden')
        }
        loading={loading}
      />
    </div>
  );
};

export default OCFormWizard;
