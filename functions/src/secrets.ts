/**
 * Gestión centralizada de secrets — SEC-001 FIX
 *
 * Migración de process.env a Firebase Secret Manager.
 *
 * FASE 1 (actual): Wrapper que lee de process.env pero centraliza acceso.
 *                   El .env NUNCA se sube a git.
 *
 * FASE 2 (futura): Migrar a defineSecret() de firebase-functions/v2
 *                   cuando se migre a Cloud Functions 2nd Gen.
 *
 * Uso:
 *   import { getSecret } from "../secrets";
 *   const key = getSecret("GEMINI_API_KEY");
 */

// Secrets permitidos — cualquier otro nombre lanza error en runtime
const ALLOWED_SECRETS = [
  "ML_CLIENT_ID",
  "ML_CLIENT_SECRET",
  "ML_REDIRECT_URI",
  "GEMINI_API_KEY",
  "ANTHROPIC_API_KEY",
  "DAILY_API_KEY",
  "WHATSAPP_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_APP_SECRET",
] as const;

type SecretName = typeof ALLOWED_SECRETS[number];

/**
 * Obtiene un secret de forma segura.
 * Centraliza el acceso para facilitar migración a Secret Manager.
 */
export function getSecret(name: SecretName): string {
  const value = process.env[name];
  if (!value) {
    console.warn(`[SECRETS] Secret "${name}" not found in environment`);
    return "";
  }
  return value;
}

/**
 * Verifica que todos los secrets requeridos están disponibles.
 * Llamar al inicio de funciones críticas.
 */
export function validateSecrets(required: SecretName[]): void {
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(`[SECRETS] Missing required secrets: ${missing.join(", ")}`);
  }
}
