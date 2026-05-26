/**
 * functions/src/users/users.email.ts
 * chk5.F4-USERS (2026-05-25) · Envío de emails transaccionales vía Resend.
 *
 * 4 templates · canon ACTO 10 del mockup:
 *   1. emailInvitacion       · admin invita por email
 *   2. emailCuentaAprobada   · admin aprobó · cuenta activa
 *   3. emailSolicitudExpirada · auto-rechazo 7d
 *   4. emailAlertaAdminSelfSignup · alerta al admin · self-signup pendiente
 */
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "BusinessMN";
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || "";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:5178";

let _resend: Resend | null = null;
function getClient(): Resend {
  if (!_resend) {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY no configurado en env");
    _resend = new Resend(RESEND_API_KEY);
  }
  return _resend;
}

function from(): string {
  return EMAIL_FROM_NAME ? `${EMAIL_FROM_NAME} <${EMAIL_FROM}>` : EMAIL_FROM;
}

// ─────────────────────────────────────────────────────────────────────────
// CSS común de los emails · estilo teal canon Vita Skin
// ─────────────────────────────────────────────────────────────────────────
const baseStyles = `
  body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; }
  .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
  .logo { width: 56px; height: 56px; margin: 0 auto 16px; display: block; }
  .title { font-size: 20px; font-weight: 700; color: #0f172a; text-align: center; margin: 0 0 8px; }
  .subtitle { font-size: 13px; color: #64748b; text-align: center; margin: 0 0 24px; }
  .btn { display: inline-block; background: #14b8a6; color: #ffffff !important; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; }
  .btn-block { display: block; text-align: center; width: 100%; box-sizing: border-box; }
  .info { background: #f1f5f9; border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #475569; margin: 16px 0; }
  .info strong { color: #0f172a; }
  .footer { text-align: center; font-size: 11px; color: #94a3b8; padding-top: 24px; margin-top: 24px; border-top: 1px solid #e2e8f0; }
  .alert { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #92400e; margin: 16px 0; }
  .danger { background: #fee2e2; border: 1px solid #fca5a5; border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #991b1b; margin: 16px 0; }
`;

const logoSvg = `
  <svg viewBox="0 0 64 64" class="logo" style="width:56px;height:56px;display:block;margin:0 auto 16px;">
    <defs>
      <linearGradient id="g1" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#14b8a6"/>
        <stop offset="100%" stop-color="#0d9488"/>
      </linearGradient>
    </defs>
    <path d="M32 4 C 32 4, 50 28, 50 42 C 50 53, 41 60, 32 60 C 23 60, 14 53, 14 42 C 14 28, 32 4, 32 4 Z" fill="url(#g1)"/>
    <ellipse cx="26" cy="28" rx="4" ry="6" fill="white" opacity="0.4"/>
  </svg>
`;

const footer = `
  <div class="footer">
    BusinessMN · Vita Skin Peru<br>
    Vitaminas, Skincare y Bienestar
  </div>
`;

function wrap(content: string, preheader = ""): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>BusinessMN</title>
<style>${baseStyles}</style>
</head>
<body>
${preheader ? `<div style="display:none;visibility:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${preheader}</div>` : ""}
<div class="container">
  ${logoSvg}
  ${content}
  ${footer}
</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────
// TEMPLATE 10.1 · Invitación de admin
// ─────────────────────────────────────────────────────────────────────────
export interface InvitacionEmailParams {
  to: string;
  nombreSugerido?: string;
  invitedByNombre: string;
  rolesPreAsignados: string[];
  invitacionId: string;
  tokenPlain: string;
  expiraEn: Date;
  mensajePersonalizado?: string;
  asuntoOverride?: string;
}

export async function sendInvitacionEmail(params: InvitacionEmailParams): Promise<{
  ok: boolean;
  id?: string;
  error?: string;
}> {
  try {
    const setupUrl = `${APP_BASE_URL}/setup-password/${params.invitacionId}?token=${params.tokenPlain}`;
    const nombre = params.nombreSugerido || params.to.split("@")[0];
    const rolesText = params.rolesPreAsignados.length > 0
      ? params.rolesPreAsignados.join(", ")
      : "(sin rol pre-asignado · admin asignará al activar)";
    const expiraFmt = params.expiraEn.toLocaleDateString("es-PE", {
      day: "numeric", month: "long", year: "numeric",
    });

    const html = wrap(`
      <h1 class="title">Creá tu cuenta · BusinessMN</h1>
      <p class="subtitle">${params.invitedByNombre} te invitó a unirte al sistema</p>

      <p style="font-size:13px;color:#475569;line-height:1.6;">
        Hola <strong>${nombre}</strong>,<br><br>
        ${params.invitedByNombre} te invitó a unirte a <strong>BusinessMN — Vita Skin Peru</strong>.
        Hacé click para activar tu cuenta y definir tu contraseña.
      </p>

      ${params.mensajePersonalizado ? `
        <div class="info"><strong>Mensaje:</strong> ${escapeHtml(params.mensajePersonalizado)}</div>
      ` : ""}

      <div style="text-align:center;margin:24px 0;">
        <a href="${setupUrl}" class="btn">Activar mi cuenta →</a>
      </div>

      <div class="info">
        <strong>Tu rol pre-asignado:</strong> ${rolesText}<br>
        <strong>Link válido hasta:</strong> ${expiraFmt} (7 días desde envío)
      </div>

      <p style="font-size:11px;color:#94a3b8;line-height:1.5;margin-top:16px;">
        Si el botón no funciona, copia y pega este link en tu navegador:<br>
        <code style="word-break:break-all;background:#f1f5f9;padding:4px 8px;border-radius:4px;display:inline-block;margin-top:4px;font-size:10px;">${setupUrl}</code>
      </p>

      <p style="font-size:11px;color:#94a3b8;margin-top:16px;">
        Si no esperabas esta invitación, ignorala y el link expirará automáticamente.
      </p>
    `, `${params.invitedByNombre} te invitó a unirte a BusinessMN`);

    const result = await getClient().emails.send({
      from: from(),
      to: params.to,
      replyTo: EMAIL_REPLY_TO || undefined,
      subject: params.asuntoOverride || "Te invitamos a unirte a BusinessMN",
      html,
    });

    if (result.error) {
      return { ok: false, error: result.error.message };
    }
    return { ok: true, id: result.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[users.email] sendInvitacionEmail error:", msg);
    return { ok: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TEMPLATE 10.2 · Cuenta aprobada
// ─────────────────────────────────────────────────────────────────────────
export async function sendCuentaAprobadaEmail(params: {
  to: string;
  nombre: string;
  aprobadoPorNombre: string;
  rolesAsignados: string[];
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const rolesText = params.rolesAsignados.join(", ");
    const html = wrap(`
      <h1 class="title">¡Tu cuenta fue aprobada!</h1>
      <p class="subtitle">Ya podés ingresar al sistema</p>

      <p style="font-size:13px;color:#475569;line-height:1.6;">
        Hola <strong>${params.nombre}</strong>,<br><br>
        Tu cuenta fue aprobada por <strong>${params.aprobadoPorNombre}</strong>.
        Ya podés ingresar y operar normalmente.
      </p>

      <div class="info">
        <strong>Tu rol asignado:</strong> ${rolesText}
      </div>

      <div style="text-align:center;margin:24px 0;">
        <a href="${APP_BASE_URL}/login" class="btn">Ingresar al sistema →</a>
      </div>

      <p style="font-size:11px;color:#94a3b8;margin-top:16px;">
        ¿Dudas? Contactá a <a href="mailto:${EMAIL_REPLY_TO}">${EMAIL_REPLY_TO}</a>
      </p>
    `, "Tu cuenta fue aprobada");

    const result = await getClient().emails.send({
      from: from(),
      to: params.to,
      replyTo: EMAIL_REPLY_TO || undefined,
      subject: "Tu cuenta de BusinessMN fue aprobada",
      html,
    });

    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, id: result.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TEMPLATE 10.3 · Solicitud expirada (auto-rechazo 7d)
// ─────────────────────────────────────────────────────────────────────────
export async function sendSolicitudExpiradaEmail(params: {
  to: string;
  motivo?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const html = wrap(`
      <h1 class="title">Tu solicitud de cuenta expiró</h1>

      <p style="font-size:13px;color:#475569;line-height:1.6;">
        Hola,<br><br>
        Tu solicitud de registro a BusinessMN <strong>expiró</strong> por falta
        de aprobación en el plazo configurado (7 días).
        ${params.motivo ? `<br><br>Motivo: ${escapeHtml(params.motivo)}` : ""}
      </p>

      <div class="alert">
        Si seguís interesado, podés volver a registrarte en
        <a href="${APP_BASE_URL}/signup" style="color:#92400e;">${APP_BASE_URL}/signup</a>
      </div>

      <p style="font-size:11px;color:#94a3b8;margin-top:16px;">
        No conservamos tus datos · podés volver a aplicar cuando quieras.
      </p>
    `);

    const result = await getClient().emails.send({
      from: from(),
      to: params.to,
      replyTo: EMAIL_REPLY_TO || undefined,
      subject: "Tu solicitud de cuenta expiró",
      html,
    });

    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, id: result.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TEMPLATE 10.4 · Alerta al admin · self-signup pendiente
// ─────────────────────────────────────────────────────────────────────────
export async function sendAlertaAdminSelfSignupEmail(params: {
  toAdmin: string;
  userEmail: string;
  userNombre: string;
  ip?: string;
  userAgent?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const html = wrap(`
      <h1 class="title" style="color:#92400e;">⚠ Alguien se registró sin invitación</h1>
      <p class="subtitle">Self-signup pendiente · validar antes de aprobar</p>

      <p style="font-size:13px;color:#475569;line-height:1.6;">
        Un usuario nuevo completó el formulario de registro público (<code>/signup</code>):
      </p>

      <div class="info">
        <strong>Email:</strong> ${escapeHtml(params.userEmail)}<br>
        <strong>Nombre:</strong> ${escapeHtml(params.userNombre)}<br>
        ${params.ip ? `<strong>IP:</strong> ${escapeHtml(params.ip)}<br>` : ""}
        ${params.userAgent ? `<strong>Navegador:</strong> ${escapeHtml(params.userAgent.slice(0, 80))}<br>` : ""}
      </div>

      <div class="alert">
        ⚠ Validá la identidad antes de aprobar · self-signup tiene menor nivel
        de confianza que invitación directa.
      </div>

      <div style="text-align:center;margin:24px 0;">
        <a href="${APP_BASE_URL}/usuarios" class="btn">Revisar en /usuarios →</a>
      </div>

      <p style="font-size:11px;color:#94a3b8;margin-top:16px;">
        Auto-rechazo configurado: 7 días.
      </p>
    `, "Alguien se registró sin invitación · revisá");

    const result = await getClient().emails.send({
      from: from(),
      to: params.toAdmin,
      replyTo: EMAIL_REPLY_TO || undefined,
      subject: "[BusinessMN] Self-signup pendiente · revisar",
      html,
    });

    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, id: result.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
