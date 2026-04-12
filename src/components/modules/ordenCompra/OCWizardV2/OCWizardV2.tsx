import React, { useReducer, useMemo, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import { cn } from '../../../../design-system';
import type { OrdenCompraFormData } from '../../../../types/ordenCompra.types';
import { ocWizardReducer } from './ocWizardReducer';
import {
  initialWizardState,
  getActiveSteps,
  getNextStep,
  getPrevStep,
  deriveDeliveryConfig,
} from './ocWizardTypes';
import type { OCWizardAction } from './ocWizardReducer';
import { WizardStepEntrega } from './WizardStepEntrega';
import { WizardStepFlete } from './WizardStepFlete';
import { WizardStepProductos } from './WizardStepProductos';
import { WizardStepCargos } from './WizardStepCargos';
import { WizardStepConfirm } from './WizardStepConfirm';
import type { ProductoOrden, CargoOC, DescuentoOC, ImpuestoOC } from '../../../../types/ordenCompra.types';

// ---- Props ----

interface OCWizardV2Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: OrdenCompraFormData) => void;
  isSubmitting?: boolean;
  /** Optional: pre-link to a single requerimiento */
  requerimientoId?: string;
  requerimientoNumero?: string;
  /** Optional: pre-link to multiple requerimientos */
  requerimientoIds?: string[];
  requerimientoNumeros?: string[];
}

// ---- Step metadata ----

const STEP_LABELS: Record<number, string> = {
  0: 'Entrega',
  1: 'Flete',
  2: 'Productos',
  3: 'Cargos',
  4: 'Confirmar',
};

// ---- Validation per step ----

function isStepValid(step: number, state: ReturnType<typeof initialWizardState extends infer T ? () => T : never>): boolean;
function isStepValid(step: number, state: typeof initialWizardState): boolean {
  switch (step) {
    case 0:
      return !!state.configLogistica.proveedorId && !!state.configLogistica.salidaProveedor && !!state.configLogistica.llegadaPeru;
    case 1:
      return state.quienPagaFlete !== null;
    case 2:
      return (
        state.proveedorId !== '' &&
        state.tcCompra > 0 &&
        state.productos.length > 0 &&
        state.productos.every((p) => p.productoId && p.cantidad > 0)
      );
    case 3:
      // Cargos step is always optional
      return true;
    case 4:
      return true;
    default:
      return true;
  }
}

// ---- Component ----

export const OCWizardV2: React.FC<OCWizardV2Props> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  requerimientoId,
  requerimientoNumero,
  requerimientoIds,
  requerimientoNumeros,
}) => {
  const [state, dispatch] = useReducer(ocWizardReducer, initialWizardState);
  const submittedRef = useRef(false);

  const activeSteps = useMemo(() => getActiveSteps(state), [state.modoEntregaDetallado, state.quienPagaFlete]);
  const currentStepIdx = activeSteps.indexOf(state.currentStep);
  const isFirstStep = currentStepIdx === 0;
  const isLastStep = currentStepIdx === activeSteps.length - 1;
  const canProceed = isStepValid(state.currentStep, state);

  const config = useMemo(
    () => deriveDeliveryConfig(state.modoEntregaDetallado, state.quienPagaFlete),
    [state.modoEntregaDetallado, state.quienPagaFlete],
  );

  // ---- Totals ----
  const subtotal = useMemo(
    () => state.productos.reduce((s, p) => s + (p.costoUnitario || 0) * (p.cantidad || 0), 0),
    [state.productos],
  );
  const totalCargos = useMemo(
    () => state.cargosOC.reduce((s, c) => s + (c.montoUSD || 0), 0),
    [state.cargosOC],
  );
  const totalDescuentos = useMemo(
    () => state.descuentosOC.reduce((s, d) => s + (d.montoUSD || 0), 0),
    [state.descuentosOC],
  );
  const totalImpuestos = useMemo(
    () => state.impuestosOC.reduce((s, i) => s + (i.montoUSD || 0), 0),
    [state.impuestosOC],
  );
  const grandTotal = subtotal + totalCargos - totalDescuentos + totalImpuestos;

  // ---- Auto-sync shipping cost from config logistica to cargos ----
  // When moving to cargos step, if shipping was specified in entrega, add it as a cargo
  React.useEffect(() => {
    const cfg = state.configLogistica;
    if (cfg.fleteProveedorIncluido === false && cfg.costoShippingProveedor && cfg.costoShippingProveedor > 0) {
      const shippingId = '__shipping_proveedor__';
      const alreadyExists = state.cargosOC.some(c => c.id === shippingId);
      if (!alreadyExists) {
        const label = cfg.tipoShipping === 'internacional' ? 'Shipping internacional' : cfg.tipoShipping === 'local' ? 'Shipping local' : 'Shipping proveedor';
        dispatch({
          type: 'ADD_CARGO',
          cargo: {
            id: shippingId,
            concepto: label,
            montoUSD: cfg.costoShippingProveedor,
            metodoProrrateo: 'por_valor',
          },
        } as OCWizardAction);
      } else {
        // Update existing shipping cargo if amount changed
        const existing = state.cargosOC.find(c => c.id === shippingId);
        if (existing && existing.montoUSD !== cfg.costoShippingProveedor) {
          const label = cfg.tipoShipping === 'internacional' ? 'Shipping internacional' : cfg.tipoShipping === 'local' ? 'Shipping local' : 'Shipping proveedor';
          dispatch({
            type: 'UPDATE_CARGO',
            cargo: { ...existing, concepto: label, montoUSD: cfg.costoShippingProveedor },
          } as OCWizardAction);
        }
      }
    }
  }, [state.configLogistica.costoShippingProveedor, state.configLogistica.tipoShipping, state.configLogistica.fleteProveedorIncluido]);

  // ---- Navigation ----

  const handleNext = () => {
    const next = getNextStep(state);
    if (next !== null) {
      dispatch({ type: 'SET_STEP', step: next } as OCWizardAction);
    }
  };

  const handleBack = () => {
    const prev = getPrevStep(state);
    if (prev !== null) {
      dispatch({ type: 'SET_STEP', step: prev } as OCWizardAction);
    }
  };

  const handleClose = () => {
    dispatch({ type: 'RESET' } as OCWizardAction);
    onClose();
  };

  // ---- Submit ----

  const handleSubmit = () => {
    if (submittedRef.current || isSubmitting) return;
    submittedRef.current = true;

    const formData: OrdenCompraFormData = {
      proveedorId: state.proveedorId,
      productos: state.productos.map((p) => ({
        productoId: p.productoId,
        sku: p.sku,
        marca: p.marca,
        nombreComercial: p.nombreComercial,
        presentacion: p.presentacion,
        cantidad: p.cantidad,
        costoUnitario: p.costoUnitario,
        subtotal: p.cantidad * p.costoUnitario,
        viajeroId: p.viajeroId,
        viajeroNombre: p.viajeroNombre,
      })),
      subtotalUSD: subtotal,
      totalUSD: grandTotal,
      tcCompra: state.tcCompra,
      modoEntrega: config.modoEntrega,
      fleteIncluidoEnPrecio: config.fleteIncluidoEnPrecio,
      // almacenDestino is managed downstream (casilla selection is outside wizard scope)
      almacenDestino: '',
      paisOrigen: state.paisOrigen || undefined,
      observaciones: state.observaciones || undefined,
      // Cargos / descuentos / impuestos
      ...(state.cargosOC.length > 0 && { cargosOC: state.cargosOC }),
      ...(state.descuentosOC.length > 0 && { descuentosOC: state.descuentosOC }),
      ...(state.impuestosOC.length > 0 && { impuestosOC: state.impuestosOC }),
      // Sub-órdenes are configured in ConfirmarOCModal, not at creation time
      // Impuesto total from impuestosOC
      ...(totalImpuestos > 0 && { impuestoCompraUSD: totalImpuestos }),
      // Requerimiento links
      ...(requerimientoId && { requerimientoId }),
      ...(requerimientoIds && requerimientoIds.length > 0 && { requerimientoIds }),
    };

    onSubmit(formData);
  };

  // Reset guard when wizard reopens
  if (!isOpen) {
    submittedRef.current = false;
    return null;
  }

  // ---- Step renderer ----

  const renderStep = () => {
    switch (state.currentStep) {
      case 0:
        return (
          <WizardStepEntrega
            config={state.configLogistica}
            onChange={(config) => dispatch({ type: 'SET_CONFIG_LOGISTICA', config } as OCWizardAction)}
          />
        );

      case 1:
        return (
          <WizardStepFlete
            value={state.quienPagaFlete}
            onChange={(quien) => dispatch({ type: 'SET_QUIEN_PAGA', quien } as OCWizardAction)}
            modoEntrega={state.modoEntregaDetallado}
          />
        );

      case 2:
        return (
          <WizardStepProductos
            proveedorId={state.proveedorId}
            proveedorNombre={state.proveedorNombre}
            paisOrigen={state.paisOrigen}
            tcCompra={state.tcCompra}
            productos={state.productos}
            onSetProveedor={(id, nombre) =>
              dispatch({ type: 'SET_PROVEEDOR', id, nombre } as OCWizardAction)
            }
            onSetPaisOrigen={(pais) =>
              dispatch({ type: 'SET_PAIS_ORIGEN', pais } as OCWizardAction)
            }
            onSetTC={(tc) => dispatch({ type: 'SET_TC', tc } as OCWizardAction)}
            onAddProducto={(producto: ProductoOrden) =>
              dispatch({ type: 'ADD_PRODUCTO', producto } as OCWizardAction)
            }
            onRemoveProducto={(index: number) =>
              dispatch({ type: 'REMOVE_PRODUCTO', index } as OCWizardAction)
            }
            onUpdateProducto={(index: number, producto: ProductoOrden) =>
              dispatch({ type: 'UPDATE_PRODUCTO', index, producto } as OCWizardAction)
            }
          />
        );

      case 3:
        return (
          <WizardStepCargos
            cargos={state.cargosOC}
            descuentos={state.descuentosOC}
            impuestos={state.impuestosOC}
            subtotalProductos={subtotal}
            onAddCargo={(cargo: CargoOC) =>
              dispatch({ type: 'ADD_CARGO', cargo } as OCWizardAction)
            }
            onRemoveCargo={(id: string) =>
              dispatch({ type: 'REMOVE_CARGO', id } as OCWizardAction)
            }
            onUpdateCargo={(cargo: CargoOC) =>
              dispatch({ type: 'UPDATE_CARGO', cargo } as OCWizardAction)
            }
            onAddDescuento={(descuento: DescuentoOC) =>
              dispatch({ type: 'ADD_DESCUENTO', descuento } as OCWizardAction)
            }
            onRemoveDescuento={(id: string) =>
              dispatch({ type: 'REMOVE_DESCUENTO', id } as OCWizardAction)
            }
            onUpdateDescuento={(descuento: DescuentoOC) =>
              dispatch({ type: 'UPDATE_DESCUENTO', descuento } as OCWizardAction)
            }
            onAddImpuesto={(impuesto: ImpuestoOC) =>
              dispatch({ type: 'ADD_IMPUESTO', impuesto } as OCWizardAction)
            }
            onRemoveImpuesto={(id: string) =>
              dispatch({ type: 'REMOVE_IMPUESTO', id } as OCWizardAction)
            }
            onUpdateImpuesto={(impuesto: ImpuestoOC) =>
              dispatch({ type: 'UPDATE_IMPUESTO', impuesto } as OCWizardAction)
            }
          />
        );

      case 4:
        return <WizardStepConfirm state={state} />;

      default:
        return null;
    }
  };

  return (
    /* Full-screen overlay */
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ---- Header ---- */}
      <div className="flex-shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-slate-900">Nueva Orden de Compra</h1>
            {(requerimientoId || (requerimientoIds && requerimientoIds.length > 0)) && (
              <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">
                {requerimientoIds && requerimientoIds.length > 1
                  ? `${requerimientoIds.length} requerimientos`
                  : requerimientoNumero || requerimientoId}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Cerrar wizard"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-4 sm:px-6 pb-3">
          <div className="flex items-center gap-1 sm:gap-2">
            {activeSteps.map((stepNum, idx) => {
              const isCurrent = state.currentStep === stepNum;
              const isDone = idx < currentStepIdx;
              return (
                <React.Fragment key={stepNum}>
                  {/* Step dot */}
                  <div className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
                        isCurrent
                          ? 'bg-teal-600 text-white shadow-sm'
                          : isDone
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-slate-100 text-slate-400',
                      )}
                    >
                      {isDone ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-xs font-medium hidden sm:block',
                        isCurrent
                          ? 'text-teal-700'
                          : isDone
                            ? 'text-teal-600'
                            : 'text-slate-400',
                      )}
                    >
                      {STEP_LABELS[stepNum]}
                    </span>
                  </div>

                  {/* Connector */}
                  {idx < activeSteps.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 rounded-full max-w-[40px] sm:max-w-none',
                        idx < currentStepIdx ? 'bg-teal-300' : 'bg-slate-200',
                      )}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---- Body (scrollable) ---- */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-6 py-6">
          {renderStep()}
        </div>
      </div>

      {/* ---- Footer ---- */}
      <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {/* Back button */}
          <button
            type="button"
            onClick={handleBack}
            disabled={isFirstStep || isSubmitting}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              isFirstStep
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>

          {/* Step summary (center) */}
          <div className="text-xs text-slate-400 hidden sm:block">
            Paso {currentStepIdx + 1} de {activeSteps.length}
            {subtotal > 0 && (
              <span className="ml-2 text-slate-500">
                · <span className="font-medium text-slate-700">${grandTotal.toFixed(2)}</span> USD
              </span>
            )}
          </div>

          {/* Next / Submit */}
          {isLastStep ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !canProceed}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors',
                isSubmitting || !canProceed
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-teal-600 text-white hover:bg-teal-700',
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Crear Orden
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed || isSubmitting}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors',
                !canProceed || isSubmitting
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-teal-600 text-white hover:bg-teal-700',
              )}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
