/**
 * Feature flags para deploys graduales.
 * Cambiar a true para activar en producción.
 *
 * Proceso:
 * 1. Deploy código con flag en false
 * 2. Verificar cálculos con smoke tests
 * 3. Cambiar a true y redeploy solo hosting
 */
export const FEATURES = {
  /**
   * S45 — Sub-envíos T1 + Reemplazo físico (D-16)
   *
   * Controla la visibilidad de:
   *   - Tab "Tandas" en EnvioDetailModal (solo para envíos T1: origenTipo='proveedor')
   *   - Botón "Resolver con reemplazo" en el panel de reclamo
   *
   * Al activarse, envíos existentes que no tengan `subEnvios[]` funcionan planos
   * (sin tandas). El usuario puede decidir fraccionar o no cada envío.
   *
   * Flujo de rollout idéntico a WIZARD_T2:
   *   1. false (default) → código desplegado, sin acceso del usuario
   *   2. localStorage.setItem('FEATURE_SUBENVIOS_T1', 'true') para UAT individual
   *   3. true global tras validación end-to-end
   */
  SUBENVIOS_T1: false,

  /**
   * S46 — Costos landed con scope (envío vs tanda) + cierre financiero explícito
   *
   * Controla:
   *   - Reemplazo de TabCostos antigua por CostosLandedPanel en EnvioDetailModal
   *   - Selector scope en modal "Agregar costo" (envío global vs tanda)
   *   - Estados estimado/confirmado en cada costo
   *   - Acción "Finalizar costos" con confirmación + cierre financiero
   *
   * Retrocompat: costos existentes sin scope/estado se asumen 'envio'/'estimado'.
   */
  COSTOS_SCOPE_V2: false,

  /**
   * S49 — Wizard F (Despacho venta Almacén Perú → cliente · caso F del
   * Modelo Envíos Transversal). Absorbe el despacho de ventas existentes
   * bajo el hub unificado de Envíos.
   *
   * Controla:
   *   - Visibilidad del botón "Despachar venta" en la vista /envios
   *   - Acceso a la ruta `/envios/nuevo-f`
   *
   * Características:
   *   - Vinculado obligatoriamente a una Venta existente
   *   - Unidades default = las reservadas para esa venta (reservadaPara)
   *   - Cliente + dirección se leen desde la Venta (desnormalizado en Envio)
   *   - Todo en PEN (despacho local en Perú)
   */
  WIZARD_F: false,

  /**
   * S51 — Wizard G (Devolución cliente → Almacén Perú · caso G del Modelo
   * Envíos Transversal). Cierra el loop logístico de las devoluciones
   * registrando el movimiento físico de retorno de unidades.
   *
   * Controla:
   *   - Visibilidad del botón "Retorno físico devolución" en la vista /envios
   *   - Acceso a la ruta `/envios/nuevo-g`
   *
   * Características:
   *   - Vinculado obligatoriamente a una Devolucion existente
   *   - origenTipo='cliente' en el Envio
   *   - D-7: unidades no vuelven a 'disponible' hasta revisión del operador
   *   - Complementa el DevolucionFormModal existente (no lo reemplaza)
   */
  WIZARD_G: false,

  /**
   * TAREA-105 — Producto Pack/Kit en catálogo (extra fuera de secuencia S47-S52).
   *
   * Controla:
   *   - 4º modo "Pack / Kit" en ProductoCreacionWizard
   *   - Paso "Componentes" en el wizard (picker vinculados + form exclusivos)
   *   - Sección "Este pack contiene" en detalle de producto
   *   - Badge "Pack" en ProductoCard, ProductoTable y ProductoSearchVentas
   *   - Filtro "Packs" en listado /productos
   *
   * Segregación por línea de negocio (D-PACK-02, D-PACK-05):
   *   - El pack declara su línea (SKC o SUP) al crearlo
   *   - Componentes vinculados deben compartir línea con el pack
   *   - Componentes exclusivos usan labels/nomenclatura de la línea
   *
   * Sin anidamiento (D-PACK-01): un pack no puede contener otro pack.
   *
   * Flujo de rollout idéntico al resto:
   *   1. false (default) → código desplegado sin acceso del usuario
   *   2. localStorage.setItem('FEATURE_PRODUCTO_PACK', 'true') para UAT
   *   3. true global tras validación end-to-end
   */
  PRODUCTO_PACK: false,

  // S3.4 (2026-05-04) · Flags PRODUCTOS_V2 y WIZARD_PRODUCTO_V2 ELIMINADOS.
  // El módulo Productos corre 100% en V2 sin bifurcación ni rollback.
  // Snapshot pre-limpieza: tag git `pre-limpieza-v1-2026-05-04` (commit 935c012).
} as const;

// S53 F5 · isWizardT2Enabled ELIMINADO — wizard unificado no tiene flag (D-4 reemplazo directo).

/**
 * S45 — Helper análogo para el flag SUBENVIOS_T1.
 */
export function isSubenviosT1Enabled(): boolean {
  if (FEATURES.SUBENVIOS_T1) return true;
  if (typeof window !== 'undefined') {
    try {
      return window.localStorage.getItem('FEATURE_SUBENVIOS_T1') === 'true';
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * S46 — Helper análogo para el flag COSTOS_SCOPE_V2.
 */
export function isCostosScopeV2Enabled(): boolean {
  if (FEATURES.COSTOS_SCOPE_V2) return true;
  if (typeof window !== 'undefined') {
    try {
      return window.localStorage.getItem('FEATURE_COSTOS_SCOPE_V2') === 'true';
    } catch {
      return false;
    }
  }
  return false;
}

// S53 F5 · isWizardJEnabled e isWizardEEnabled ELIMINADOS — reemplazados por wizard unificado.

/**
 * S49 — Helper análogo para el flag WIZARD_F (Despacho venta a cliente).
 */
export function isWizardFEnabled(): boolean {
  if (FEATURES.WIZARD_F) return true;
  if (typeof window !== 'undefined') {
    try {
      return window.localStorage.getItem('FEATURE_WIZARD_F') === 'true';
    } catch {
      return false;
    }
  }
  return false;
}

// S53 F5 · isWizardIEnabled ELIMINADO — tipo I ahora maneja el wizard unificado.

/**
 * S51 — Helper análogo para el flag WIZARD_G (Devolución cliente → Almacén Perú).
 */
export function isWizardGEnabled(): boolean {
  if (FEATURES.WIZARD_G) return true;
  if (typeof window !== 'undefined') {
    try {
      return window.localStorage.getItem('FEATURE_WIZARD_G') === 'true';
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * TAREA-105 — Helper análogo para el flag PRODUCTO_PACK (Pack/Kit en catálogo).
 */
export function isProductoPackEnabled(): boolean {
  if (FEATURES.PRODUCTO_PACK) return true;
  if (typeof window !== 'undefined') {
    try {
      return window.localStorage.getItem('FEATURE_PRODUCTO_PACK') === 'true';
    } catch {
      return false;
    }
  }
  return false;
}

// S3.4 (2026-05-04) · Helpers `isProductosV2Enabled` e `isWizardProductoV2Enabled`
// ELIMINADOS junto con sus flags. El módulo Productos corre 100% en V2.
