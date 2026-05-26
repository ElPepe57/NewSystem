/**
 * functions/src/users/users.jwt.ts
 * chk5.F4-USERS (2026-05-25) · Firma y verificación de tokens de invitación.
 *
 * Token JWT firmado (HS256) con payload:
 *   { invitacionId: string, email: string, iat, exp }
 *
 * Guardado en Firestore como hash (SHA256) en Invitacion.tokenHash.
 * Server compara hash al validar · si admin compromete la DB · el token
 * plain no es derivable.
 */
import * as jwt from "jsonwebtoken";
import * as crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_ISSUER = "businessmn-v2";
const JWT_AUDIENCE = "businessmn-v2-invitation";

if (!JWT_SECRET) {
  console.error("[users.jwt] JWT_SECRET no configurado en env · invitaciones fallarán");
}

export interface InvitacionTokenPayload {
  invitacionId: string;
  email: string;
}

/**
 * Firma un token de invitación. Retorna el token plain (va al email)
 * y el hash (se guarda en Firestore).
 */
export function signInvitacionToken(
  payload: InvitacionTokenPayload,
  expiresInDays: number,
): { token: string; tokenHash: string } {
  const token = jwt.sign(
    {
      invitacionId: payload.invitacionId,
      email: payload.email,
    },
    JWT_SECRET,
    {
      expiresIn: `${expiresInDays}d`,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: "HS256",
    },
  );

  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

/**
 * Verifica un token de invitación. Retorna el payload si es válido · null si no.
 */
export function verifyInvitacionToken(token: string): InvitacionTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    }) as InvitacionTokenPayload & { iat: number; exp: number };
    return {
      invitacionId: decoded.invitacionId,
      email: decoded.email,
    };
  } catch (err) {
    // jwt.JsonWebTokenError · TokenExpiredError · etc.
    return null;
  }
}

/**
 * Hash SHA256 del token · usado para validación server-side.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
