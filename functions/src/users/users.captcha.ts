/**
 * functions/src/users/users.captcha.ts
 * chk5.F4-USERS (2026-05-25) · Validación server-side de Cloudflare Turnstile.
 *
 * Doc: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
import axios from "axios";

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || "";
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

if (!TURNSTILE_SECRET_KEY) {
  console.error("[users.captcha] TURNSTILE_SECRET_KEY no configurado · self-signup permitirá bots");
}

export interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
  hostname?: string;
  challenge_ts?: string;
}

/**
 * Valida un token de Turnstile generado por el widget en el frontend.
 *
 * @param token Token enviado por el frontend (Turnstile callback)
 * @param remoteIp Opcional · IP del cliente para tracking (anti-replay)
 */
export async function validateTurnstile(
  token: string,
  remoteIp?: string,
): Promise<{ valid: boolean; reason?: string }> {
  if (!TURNSTILE_SECRET_KEY) {
    // En desarrollo sin secret · permitimos (con warning) para no bloquear
    console.warn("[users.captcha] secret no configurado · validación SKIPPED");
    return { valid: true };
  }

  if (!token) {
    return { valid: false, reason: "Captcha token vacío" };
  }

  try {
    const params = new URLSearchParams();
    params.append("secret", TURNSTILE_SECRET_KEY);
    params.append("response", token);
    if (remoteIp) params.append("remoteip", remoteIp);

    const { data } = await axios.post<TurnstileResponse>(VERIFY_URL, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 5000,
    });

    if (!data.success) {
      const codes = data["error-codes"]?.join(", ") || "unknown";
      return { valid: false, reason: `Captcha rechazado: ${codes}` };
    }

    return { valid: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[users.captcha] Error al validar Turnstile:", msg);
    return { valid: false, reason: "Error de comunicación con servicio captcha" };
  }
}
