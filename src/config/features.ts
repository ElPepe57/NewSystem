/**
 * Feature flags para deploys graduales.
 * Cambiar a true para activar en producción.
 *
 * Proceso:
 * 1. Deploy código con flag en false
 * 2. Verificar cálculos con smoke tests
 * 3. Cambiar a true y redeploy solo hosting
 *
 * NOTA (CTRU v2 — 2026-03-28): Estos tres flags son VESTIGIALES.
 * La funcionalidad de CTRU v2 (vista dual contable/gerencial, costos de recojo
 * y capas de OC) se activó directamente en el código durante las fases 1-6 sin
 * leer estos flags en ningún punto de ejecución. Ningún componente ni servicio
 * hace referencia a FEATURES.CTRU_DUAL_VIEW, FEATURES.CTRU_RECOJO_EN_CALCULO
 * ni FEATURES.CTRU_CAPAS_OC_EN_INICIAL. Los flags se mantienen por historial
 * pero NO controlan ningún comportamiento del sistema.
 */
export const FEATURES = {
  /**
   * CTRU v2: Vista dual contable/gerencial.
   * - false: usa ctruDinamico (modelo actual)
   * - true: usa ctruContable + ctruGerencial (modelo nuevo)
   */
  CTRU_DUAL_VIEW: false,

  /**
   * CTRU v2: Incluir costoRecojoPEN (C3) en el cálculo.
   * - false: ctruInicial = C1 + C2 (sin recojo)
   * - true: ctruInicial = C1 + C2 + C3
   */
  CTRU_RECOJO_EN_CALCULO: false,

  /**
   * CTRU v2: Incluir capas 2-4 de la OC en ctruInicial.
   * - false: ctruInicial = costoUnitarioUSD*TC + flete (modelo actual)
   * - true: ctruInicial = (costoUnitario + envioProveedor + impuesto + otros)*TC + flete
   */
  CTRU_CAPAS_OC_EN_INICIAL: false,

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

  /**
   * Etapa 4 mockups · PRODUCTOS_V2
   *
   * Controla la migración pixel-perfect del módulo Productos a la versión nueva
   * basada en los 42 mockups validados que viven en `docs/mockups/productos/`.
   *
   * Cuando está activo:
   *   - La página `/productos` renderiza `ProductosPageV2` (nuevo árbol)
   *   - Cuando está inactivo (default): renderiza `Productos` legacy
   *
   * Implementación gradual por fases (0-10):
   *   - Fase 0+1 · Átomos compartidos + shell + estados vacíos/loading
   *   - Fase 2  · Filtros y bulk actions
   *   - Fase 3  · Card de producto (6 estados)
   *   - Fase 4  · Modal detalle (Resumen + Variantes + Stock)
   *   - Fase 5  · Modal detalle (Investigación + Histórico + Pipeline)
   *   - Fase 6  · Tab Componentes Pack
   *   - Fase 7  · Wizards de creación (cuidar consumidores externos)
   *   - Fase 8  · Papelera + Investigación completa
   *   - Fase 9  · Herramientas (Productos Intel · PEC · Sugerencias del día)
   *   - Fase 10 · Cleanup + eliminar flag
   *
   * Flujo de rollout:
   *   1. false (default) → código desplegado sin acceso del usuario
   *   2. localStorage.setItem('FEATURE_PRODUCTOS_V2', 'true') para UAT
   *   3. true global tras validación end-to-end de TODAS las fases
   */
  PRODUCTOS_V2: false,
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

/**
 * Etapa 4 — Helper análogo para el flag PRODUCTOS_V2 (refactor pixel-perfect).
 */
export function isProductosV2Enabled(): boolean {
  if (FEATURES.PRODUCTOS_V2) return true;
  if (typeof window !== 'undefined') {
    try {
      return window.localStorage.getItem('FEATURE_PRODUCTOS_V2') === 'true';
    } catch {
      return false;
    }
  }
  return false;
}
