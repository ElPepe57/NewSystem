import React, { useReducer, useMemo, useRef } from 'react';
import { WizardShell } from '../../../../design-system';
import type { WizardStep } from '../../../../design-system';
import type { OrdenCompraFormData } from '../../../../types/ordenCompra.types';
import { ocWizardReducer } from './ocWizardReducer';
import { initialWizardState, deriveDeliveryConfig } from './ocWizardTypes';
import type { OCWizardAction } from './ocWizardReducer';
import type { OCWizardState } from './ocWizardTypes';
import { StepRuta } from './StepRuta';
import { StepProductos } from './StepProductos';
import { StepCargos } from './StepCargos';
import { StepInteligencia } from './StepInteligencia';
import { StepConfirm } from './StepConfirm';
import { OCWizardPreview } from './OCWizardPreview';
import { useWizardAutosave } from '../../../../hooks/useWizardAutosave';
import { ConfirmarSalidaWizardModal } from '../../../../design-system';
import { BorradorOCBanner } from '../BorradorOCBanner';
import type { BorradorWizard } from '../../../../types/borradorWizard.types';

// ════════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════════

interface OCWizardV3Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: OrdenCompraFormData) => void;
  isSubmitting?: boolean;
  /** Pre-link a un único requerimiento */
  requerimientoId?: string;
  requerimientoNumero?: string;
  /** Pre-link a múltiples requerimientos */
  requerimientoIds?: string[];
  requerimientoNumeros?: string[];
  /**
   * S53.9 — Modo edición: cuando se pasa una OC existente, el wizard
   * pre-carga todos sus datos y el submit llama a `update()` en vez de `crear()`.
   * Solo permitido para OCs en estado 'borrador' (el servicio bloquea el resto).
   */
  ordenEditar?: import('../../../../types/ordenCompra.types').OrdenCompra;
}

// ════════════════════════════════════════════════════════════════════════════
// Step definitions — Nuevo orden S41 (mockup maestro)
//   1. Ruta        (proveedor + 3 tramos + deudor alternativo)
//   2. Productos   (separado de ruta — antes iba junto)
//   3. Cargos      (cargos + descuentos + impuestos comerciales)
//   4. Inteligencia (score viabilidad — fórmula mantenida)
//   5. Confirmar   (preview editable + TC + observaciones)
// ════════════════════════════════════════════════════════════════════════════

const STEPS: WizardStep[] = [
  { id: 'ruta', label: 'Ruta', description: 'Proveedor y tramos logísticos' },
  { id: 'productos', label: 'Productos', description: 'Items de la compra' },
  { id: 'cargos', label: 'Cargos', description: 'Shipping, descuentos, impuestos' },
  { id: 'inteligencia', label: 'Inteligencia', description: 'Viabilidad y margen' },
  { id: 'confirmar', label: 'Confirmar', description: 'Revisar y crear' },
];

// ════════════════════════════════════════════════════════════════════════════
// Validation por paso
// ════════════════════════════════════════════════════════════════════════════

function isStepValid(stepIndex: number, state: ReturnType<typeof ocWizardReducer>): boolean {
  const s = state;

  switch (stepIndex) {
    case 0: {
      // Paso Ruta: proveedor + tipo de ruta + casilla/almacén destino + tramo 1
      // S42ae — Tramo 2 (cruce) y Tramo 3 (última milla) ya no se piden en la OC.
      // El colaborador transportista se asigna al crear envío 2 desde /envios.
      const cfg = s.configLogistica;
      return (
        !!cfg.proveedorId &&
        !!cfg.llegadaPeru &&
        !!cfg.casillaDestinoId &&
        // Tramo 1 solo aplica a vía casilla (DDP no requiere salidaProveedor)
        (cfg.llegadaPeru === 'ddp_directo' || !!cfg.salidaProveedor)
      );
    }
    case 1:
      // Paso Productos: al menos 1 producto con costo
      return s.productos.length > 0 && s.productos.every((p) => p.costoUnitario > 0 && p.cantidad > 0);
    case 2: {
      // Paso Cargos: todos los items con concepto lleno
      const allCargosNamed = s.cargosOC.every((c) => c.concepto.trim().length > 0);
      const allDescNamed = s.descuentosOC.every((d) => d.concepto.trim().length > 0);
      const allImpNamed = s.impuestosOC.every((i) => i.concepto.trim().length > 0);
      return allCargosNamed && allDescNamed && allImpNamed;
    }
    case 3:
      // Paso Inteligencia: siempre válido (informativo)
      return true;
    case 4:
      // Paso Confirmar: TC obligatorio
      return s.tcCompra > 0;
    default:
      return true;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// OCWizardV3 — Main export
// ════════════════════════════════════════════════════════════════════════════

/**
 * OCWizardV3 — Wizard Nueva OC rework S41.
 *
 * Cambios respecto a V2:
 * - Usa WizardShell del design system (stepper + preview panel + footer)
 * - Orden de pasos: Ruta → Productos → Cargos → Inteligencia → Confirmar
 *   (V2 era: Entrega → Flete → Inteligencia → Cargos → Confirmar)
 * - Productos separados de la configuración de ruta
 * - Paso "Flete" eliminado (se derivaba automáticamente; ahora vive en Ruta)
 * - Cargos ANTES de Inteligencia (el score ya ve los cargos finales)
 * - Preview panel lateral con resumen en vivo
 * - Deudor alternativo capturado en paso Ruta (data lista para futuro)
 *
 * NOTA: El wizard V2 (OCWizardV2) se mantiene intacto hasta que V3 sea validado
 * en producción. Consumidores se migran en Bloque 2 (Vistas).
 */
export const OCWizardV3: React.FC<OCWizardV3Props> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  requerimientoId,
  requerimientoNumero,
  requerimientoIds,
  requerimientoNumeros,
  ordenEditar,
}) => {
  const [state, dispatch] = useReducer(ocWizardReducer, initialWizardState);
  // S53.9 — modo edición activo cuando se pasa una OC existente
  const esEdicion = !!ordenEditar;
  const submittedRef = useRef(false);
  const [currentStep, setCurrentStep] = React.useState(0);
  const [draftAceptado, setDraftAceptado] = React.useState(false);
  // S53.19 — Modal de confirmación al cerrar con cambios sin guardar
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  // S53.21 — Contador de aperturas: cada vez que el wizard se abre, incrementa.
  // Se usa como `key` del BorradorOCBanner interno para forzar re-mount y que
  // re-lea el borrador desde cero en cada apertura (ignora refs persistentes).
  const [openCount, setOpenCount] = React.useState(0);
  React.useEffect(() => {
    if (isOpen) setOpenCount((n) => n + 1);
  }, [isOpen]);

  // ─── Autoguardado 2 capas ────────────────────────────────────────────────
  // S53.21 — El wizard ya NO usa `borradorExistente` ni `continuarBorrador`
  // del hook: la lectura del borrador ahora la hace el componente
  // `BorradorOCBanner` (interno y el de /compras). El hook solo se usa para
  // las capas de escritura (Capa 1/2 en autosave + forceSave + descartar).
  const {
    descartarBorrador,
    clearDraft,
    forceSave,
  } = useWizardAutosave<OCWizardState>({
    tipo: 'oc',
    state,
    pasoActual: currentStep,
    // S53.9 — En modo edición NO autosave: la OC ya está persistida, cualquier
    // cambio temporal no debería crear un borrador paralelo. El submit hace
    // update() directo a la OC existente.
    enabled: isOpen && !submittedRef.current && !esEdicion,
    buildResumen: (s) => {
      const prov = s.configLogistica.proveedorNombre || s.proveedorNombre;
      const total = s.productos.reduce(
        (sum, p) => sum + (p.costoUnitario || 0) * (p.cantidad || 0),
        0
      );
      if (!prov && total === 0) return undefined;
      return prov ? `OC ${prov} · $${total.toFixed(2)}` : `OC en progreso · $${total.toFixed(2)}`;
    },
    buildMonto: (s) =>
      s.productos.reduce(
        (sum, p) => sum + (p.costoUnitario || 0) * (p.cantidad || 0),
        0
      ),
  });

  // ─── S53.9 — Modo edición: pre-cargar state desde la OC al abrir ─────────
  React.useEffect(() => {
    if (!isOpen || !ordenEditar) return;
    (async () => {
      const { buildStateFromOrden } = await import('./ocWizardFromOrden');
      dispatch({
        type: 'CARGAR_ORDEN',
        state: buildStateFromOrden(ordenEditar),
      } as OCWizardAction);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ordenEditar?.id]);

  // ─── Auto-fetch TC del día al abrir ──────────────────────────────────────
  React.useEffect(() => {
    if (!isOpen) return;
    const fetchTC = async () => {
      try {
        const { useTipoCambioStore } = await import('../../../../store/tipoCambioStore');
        const tc = await useTipoCambioStore.getState().getTCDelDia();
        if (tc?.venta && state.tcCompra === 0) {
          dispatch({ type: 'SET_TC', tc: tc.venta } as OCWizardAction);
        }
      } catch {
        /* silent */
      }
    };
    fetchTC();
  }, [isOpen]);

  // ─── S53.3 FIX — Reset state al cerrar el modal (cualquier camino) ──────
  // Bug previo: handleClose() reseteaba state, pero handleSubmit() no. Tras
  // crear una OC, el state quedaba pegado con los datos viejos. Al reabrir
  // el wizard el usuario veía la OC anterior ya completa.
  //
  // Este useEffect detecta la transición de isOpen true→false (cierre por
  // cualquier motivo: submit exitoso, submit fallido, cancelar, click
  // fuera, tecla Escape) y limpia el state. El useReducer persiste entre
  // renders cuando el componente no se desmonta, por eso hace falta el
  // reset explícito.
  const wasOpenRef = useRef(false);
  React.useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      // Modal acaba de cerrarse — resetear todo para la próxima apertura
      dispatch({ type: 'RESET' } as OCWizardAction);
      setCurrentStep(0);
      setDraftAceptado(false);
      submittedRef.current = false;
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  // ─── Totales en vivo ─────────────────────────────────────────────────────
  const subtotal = useMemo(
    () => state.productos.reduce((s, p) => s + (p.costoUnitario || 0) * (p.cantidad || 0), 0),
    [state.productos]
  );
  const totalCargos = useMemo(
    () => state.cargosOC.reduce((s, c) => s + (c.montoUSD || 0), 0),
    [state.cargosOC]
  );
  const totalDescuentos = useMemo(
    () => state.descuentosOC.reduce((s, d) => s + (d.montoUSD || 0), 0),
    [state.descuentosOC]
  );
  const totalImpuestos = useMemo(
    () => state.impuestosOC.reduce((s, i) => s + (i.montoUSD || 0), 0),
    [state.impuestosOC]
  );
  const grandTotal = subtotal + totalCargos - totalDescuentos + totalImpuestos;

  // ─── Auto-sync shipping (del tramo 1) al paso Cargos ─────────────────────
  // Si en paso Ruta se marcó "shipping pagado aparte", se agrega como cargo
  React.useEffect(() => {
    const cfg = state.configLogistica;
    if (
      cfg.fleteProveedorIncluido === false &&
      cfg.costoShippingProveedor &&
      cfg.costoShippingProveedor > 0
    ) {
      const shippingId = '__shipping_proveedor__';
      const alreadyExists = state.cargosOC.some((c) => c.id === shippingId);
      const label =
        cfg.tipoShipping === 'internacional'
          ? 'Shipping internacional'
          : cfg.tipoShipping === 'local'
            ? 'Shipping local'
            : 'Shipping proveedor';
      if (!alreadyExists) {
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
        const existing = state.cargosOC.find((c) => c.id === shippingId);
        if (existing && existing.montoUSD !== cfg.costoShippingProveedor) {
          dispatch({
            type: 'UPDATE_CARGO',
            cargo: { ...existing, concepto: label, montoUSD: cfg.costoShippingProveedor },
          } as OCWizardAction);
        }
      }
    }
  }, [
    state.configLogistica.costoShippingProveedor,
    state.configLogistica.tipoShipping,
    state.configLogistica.fleteProveedorIncluido,
  ]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const canProceed = isStepValid(currentStep, state);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  // S53.19 — Detectar si hay cambios significativos en el wizard que
  // merezcan preguntar al usuario antes de cerrar. Evita molestar si el
  // usuario solo abrió el wizard y no tocó nada.
  const hayCambiosSignificativos = React.useMemo(() => {
    if (esEdicion) return false; // en edición siempre cerrar directo
    return (
      !!state.configLogistica.proveedorId ||
      state.productos.length > 0 ||
      state.cargosOC.length > 0 ||
      state.descuentosOC.length > 0 ||
      state.impuestosOC.length > 0 ||
      !!state.observaciones
    );
  }, [
    esEdicion,
    state.configLogistica.proveedorId,
    state.productos.length,
    state.cargosOC.length,
    state.descuentosOC.length,
    state.impuestosOC.length,
    state.observaciones,
  ]);

  const handleClose = () => {
    // Si hay cambios, preguntar qué hacer en lugar de cerrar directo.
    // El autosave ya guardó silenciosamente en localStorage, pero darle
    // al usuario control explícito es mejor UX (patrón Gmail/Notion).
    if (hayCambiosSignificativos) {
      setShowExitConfirm(true);
      return;
    }
    onClose();
  };

  const handleGuardarBorradorYCerrar = async () => {
    // Asegurar persistencia en Firestore (además de localStorage que ya tiene).
    // Así el banner aparece al reabrir incluso desde otro navegador/dispositivo.
    await forceSave();
    setShowExitConfirm(false);
    onClose();
  };

  const handleDescartarYCerrar = async () => {
    // Borrar el borrador (localStorage + Firestore) antes de cerrar.
    await descartarBorrador();
    setShowExitConfirm(false);
    onClose();
  };

  const handleSeguirEditando = () => {
    // Solo cerrar el modal — mantener el wizard abierto con todos los datos.
    setShowExitConfirm(false);
  };

  const handleSubmit = () => {
    if (submittedRef.current || isSubmitting) return;
    submittedRef.current = true;

    const config = deriveDeliveryConfig(state.modoEntregaDetallado, state.quienPagaFlete);

    const formData: OrdenCompraFormData = {
      proveedorId: state.proveedorId || state.configLogistica.proveedorId,
      productos: state.productos.map((p) => ({
        productoId: p.productoId,
        sku: p.sku,
        marca: p.marca,
        nombreComercial: p.nombreComercial,
        presentacion: p.presentacion,
        contenido: p.contenido,
        dosaje: p.dosaje,
        sabor: p.sabor,
        pesoLibras: p.pesoLibras,
        cantidad: p.cantidad,
        costoUnitario: p.costoUnitario,
        subtotal: p.cantidad * p.costoUnitario,
        viajeroId: p.viajeroId,
        viajeroNombre: p.viajeroNombre,
      })),
      subtotalUSD: subtotal,
      totalUSD: grandTotal,
      tcCompra: state.tcCompra,
      ...(totalImpuestos > 0 && { impuestoCompraUSD: totalImpuestos }),
      ...(totalDescuentos > 0 && { descuentoUSD: totalDescuentos }),
      modoEntrega: config.modoEntrega,
      modoEntregaDetallado: state.modoEntregaDetallado || undefined,
      fleteIncluidoEnPrecio: config.fleteIncluidoEnPrecio,
      almacenDestino: state.configLogistica.casillaDestinoId || '',
      colaboradorTransporteId: state.configLogistica.colaboradorId || undefined,
      colaboradorTransporteNombre: state.configLogistica.colaboradorNombre || undefined,
      paisOrigen: state.paisOrigen || undefined,
      observaciones: state.observaciones || undefined,
      ...(state.cargosOC.length > 0 && { cargosOC: state.cargosOC }),
      ...(state.descuentosOC.length > 0 && { descuentosOC: state.descuentosOC }),
      ...(state.impuestosOC.length > 0 && { impuestosOC: state.impuestosOC }),
      ...(requerimientoId && { requerimientoId }),
      ...(requerimientoIds && requerimientoIds.length > 0 && { requerimientoIds }),
      // S41 Bloque 5 — Deudor alternativo: solo se persiste si el colaborador adelantó
      // el pago al proveedor (patrón "Recojo en origen" con quienPagaProveedor='recogedor_paga').
      // Si deudorTipo='proveedor' o vacío, se omite (default implícito al proveedor de la OC).
      ...(state.configLogistica.deudorTipo === 'colaborador' &&
        state.configLogistica.deudorId && {
          deudorId: state.configLogistica.deudorId,
          deudorNombre: state.configLogistica.deudorNombre,
          deudorTipo: 'colaborador' as const,
        }),
      // S42af — Recojo en origen: el colaborador ya tiene la mercadería al
      // confirmar la OC. Al procesar confirmarOC() el envío 1 nace en
      // 'recibida_completa' y el inventario de la casilla destino se actualiza
      // inmediatamente.
      ...(state.configLogistica.salidaProveedor === 'recojo_en_origen' && {
        recojoEnOrigen: true,
      }),
    };

    onSubmit(formData);
    // Limpiar borrador al confirmar (fire-and-forget, no bloquea el submit)
    void clearDraft();
  };

  // Reset submission guard cuando se reabre
  if (!isOpen) {
    submittedRef.current = false;
    return null;
  }

  // ─── Render paso actual ──────────────────────────────────────────────────
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <StepRuta state={state} dispatch={dispatch} />;
      case 1:
        return <StepProductos state={state} dispatch={dispatch} />;
      case 2:
        return <StepCargos state={state} dispatch={dispatch} subtotalProductos={subtotal} />;
      case 3:
        return <StepInteligencia state={state} subtotal={subtotal} grandTotal={grandTotal} onSaltar={handleNext} />;
      case 4:
        return (
          <StepConfirm
            state={state}
            dispatch={dispatch}
            subtotal={subtotal}
            totalCargos={totalCargos}
            totalDescuentos={totalDescuentos}
            totalImpuestos={totalImpuestos}
            grandTotal={grandTotal}
          />
        );
      default:
        return null;
    }
  };

  const requerimientoBadge =
    requerimientoIds && requerimientoIds.length > 1
      ? `${requerimientoIds.length} requerimientos`
      : requerimientoNumero || requerimientoId || '';

  const subtitle = requerimientoBadge
    ? `Desde requerimiento: ${requerimientoBadge}`
    : 'Captura los datos de la orden paso a paso';

  // ─── Render wizard ───────────────────────────────────────────────────────
  // S53.21 — Handler cuando el usuario hace click en "Continuar" desde el
  // BorradorOCBanner interno: carga el state del borrador y marca
  // draftAceptado=true para que el banner desaparezca hasta cerrar.
  const handleContinuarDesdeBannerInterno = (borrador: BorradorWizard) => {
    const draft = borrador.estado as OCWizardState | undefined;
    if (!draft) {
      setDraftAceptado(true);
      return;
    }
    dispatch({ type: 'RESET' } as OCWizardAction);
    if (draft.proveedorId) {
      dispatch({
        type: 'SET_PROVEEDOR',
        id: draft.proveedorId,
        nombre: draft.proveedorNombre,
      } as OCWizardAction);
    }
    if (draft.configLogistica) {
      dispatch({
        type: 'SET_CONFIG_LOGISTICA',
        config: draft.configLogistica,
      } as OCWizardAction);
    }
    if (draft.productos && draft.productos.length > 0) {
      dispatch({ type: 'SET_PRODUCTOS', productos: draft.productos } as OCWizardAction);
    }
    (draft.cargosOC || []).forEach((c) =>
      dispatch({ type: 'ADD_CARGO', cargo: c } as OCWizardAction)
    );
    (draft.descuentosOC || []).forEach((d) =>
      dispatch({ type: 'ADD_DESCUENTO', descuento: d } as OCWizardAction)
    );
    (draft.impuestosOC || []).forEach((i) =>
      dispatch({ type: 'ADD_IMPUESTO', impuesto: i } as OCWizardAction)
    );
    if (draft.tcCompra) dispatch({ type: 'SET_TC', tc: draft.tcCompra } as OCWizardAction);
    if (draft.observaciones) {
      dispatch({
        type: 'SET_OBSERVACIONES',
        text: draft.observaciones,
      } as OCWizardAction);
    }
    setCurrentStep((borrador.pasoActual as number) ?? 0);
    setDraftAceptado(true);
  };

  // Mostrar banner interno solo si: el wizard está abierto + no es edición
  // + el usuario no lo aceptó aún en esta sesión.
  const showBannerInterno = isOpen && !esEdicion && !draftAceptado;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6 md:p-8 flex flex-col">
      {showBannerInterno && (
        <div className="w-full max-w-7xl mx-auto mb-3 flex-shrink-0">
          <BorradorOCBanner
            key={`banner-interno-${openCount}`}
            refreshKey={openCount}
            onContinuar={handleContinuarDesdeBannerInterno}
          />
        </div>
      )}
      <div className="w-full max-w-7xl mx-auto flex-1 min-h-0">
        <WizardShell
          title={esEdicion ? `Editar OC ${ordenEditar?.numeroOrden}` : 'Nueva Orden de Compra'}
          subtitle={esEdicion ? 'Modificá los campos necesarios y guardá los cambios.' : subtitle}
          steps={STEPS}
          currentStep={currentStep}
          onStepChange={(i) => {
            // Permite regresar a pasos ya completados
            if (i < currentStep) setCurrentStep(i);
          }}
          onCancel={handleClose}
          onPrev={handlePrev}
          onNext={handleNext}
          onConfirm={handleSubmit}
          nextDisabled={!canProceed}
          loading={isSubmitting}
          confirmLabel={
            isSubmitting
              ? 'Guardando...'
              : esEdicion
              ? 'Guardar cambios'
              : 'Crear Orden'
          }
          nextHint={
            !canProceed
              ? 'Completa los datos obligatorios para continuar'
              : `Paso ${currentStep + 1} de ${STEPS.length}`
          }
          variant="page"
          previewPanel={
            <OCWizardPreview
              state={state}
              subtotal={subtotal}
              totalCargos={totalCargos}
              totalDescuentos={totalDescuentos}
              totalImpuestos={totalImpuestos}
              grandTotal={grandTotal}
              currentStep={currentStep}
            />
          }
          className="h-full"
        >
          {renderStep()}
        </WizardShell>
      </div>

      {/* S53.19 — Modal de confirmación al cerrar con cambios sin guardar */}
      <ConfirmarSalidaWizardModal
        isOpen={showExitConfirm}
        resumen={(() => {
          const prov =
            state.configLogistica.proveedorNombre || state.proveedorNombre;
          const unidades = state.productos.reduce(
            (s, p) => s + (p.cantidad || 0),
            0
          );
          const total = grandTotal;
          const partes: string[] = [];
          if (prov) partes.push(prov);
          if (state.productos.length > 0) {
            partes.push(
              `${state.productos.length} ${
                state.productos.length === 1 ? 'producto' : 'productos'
              }${unidades > 0 ? ` · ${unidades} uds` : ''}`
            );
          }
          if (total > 0) partes.push(`$${total.toFixed(2)}`);
          return partes.length > 0 ? partes.join(' · ') : undefined;
        })()}
        pasoActual={`Paso ${currentStep + 1} de ${STEPS.length}`}
        contextoSingular="esta orden de compra"
        onGuardarBorrador={handleGuardarBorradorYCerrar}
        onDescartar={handleDescartarYCerrar}
        onSeguirEditando={handleSeguirEditando}
      />
    </div>
  );
};
