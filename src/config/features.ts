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
   * S44 — Wizard T2 (Casilla Internacional → Almacén Perú)
   *
   * Controla la visibilidad del botón "Nuevo envío — Casilla a Perú" en la vista
   * /envios y del acceso a la ruta `/envios/nuevo-t2`.
   *
   * Flujo de rollout:
   *   1. false (default) → código desplegado sin acceso del usuario · smoke tests en
   *      ambiente staging con el flag activado localmente vía localStorage override
   *   2. Activación gradual: `localStorage.setItem('FEATURE_WIZARD_T2', 'true')` por
   *      usuario específico para UAT
   *   3. true (global) → disponible para todos tras validación
   *
   * El Wizard T2 reemplaza al wizard antiguo (EnvioWizardV2) para el caso de envíos
   * desde casilla internacional → Perú (caso C del Modelo Envíos Transversal, D-1).
   */
  WIZARD_T2: false,
} as const;

/**
 * Helper: verifica si el flag WIZARD_T2 está activo (globalmente o por override
 * de localStorage, útil para UAT por usuario antes del rollout completo).
 */
export function isWizardT2Enabled(): boolean {
  if (FEATURES.WIZARD_T2) return true;
  if (typeof window !== 'undefined') {
    try {
      return window.localStorage.getItem('FEATURE_WIZARD_T2') === 'true';
    } catch {
      return false;
    }
  }
  return false;
}
