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
} as const;
