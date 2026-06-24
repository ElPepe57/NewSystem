/**
 * onRetiroCapitalEjecutable · F3c · trigger de RESPALDO que ejecuta el cash de un retiro cuando está LISTO.
 *
 * Cierra el review chaining-edges#1/#2: un retiro APROBADO cuyo desembolso (encadenado en el cliente) falla
 * quedaba con estado='pendiente' SIN camino de re-ejecución (la bandeja ya no lo muestra · re-firmar lanza
 * "ya aprobado"). Este trigger es el backup: ante cualquier write del retiro, si está pendiente-y-listo
 * (≤$1k recién creado · o >$1k ya aprobado), invoca la CF de cash. `failurePolicy: true` → reintento
 * automático ante fallo transitorio o saldo aún no disponible (Cloud Functions reintenta con backoff).
 *
 * El camino PRIMARIO (registrarRetiroCapital para ≤$1k · autorizarRetiroCapital para >$1k) sigue dando
 * feedback inmediato; este trigger solo recupera los que quedaron pendientes. El core registrarRetiroCashCore
 * es IDEMPOTENTE (transición estado→ejecutado + query por idempotencyKey) → no hay doble desembolso aunque
 * el primario y el trigger corran a la vez. Cuando el core marca estado='ejecutado', el re-disparo del
 * trigger corta en la guarda (estado != 'pendiente') → sin loop.
 */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { COLLECTIONS } from "../collections";
import { requiereAutorizacionSocio } from "./autorizacionEgreso.helper";
import { registrarRetiroCashCore } from "./registrarRetiroCashTesoreria";

export const onRetiroCapitalEjecutable = functions
  .runWith({ failurePolicy: true })
  .firestore.document(`${COLLECTIONS.RETIROS_CAPITAL}/{retiroId}`)
  .onWrite(async (change, context) => {
    const after = change.after.exists ? (change.after.data() as admin.firestore.DocumentData) : null;
    if (!after) return; // borrado
    if (after.estado !== "pendiente") return; // ya ejecutado / cancelado / rechazado

    const monto = Number(after.monto ?? 0);
    const tc = Number(after.tipoCambio ?? 0);
    const montoUSD = after.moneda === "USD" ? monto : tc > 0 ? monto / tc : 0;
    // >$1k todavía sin quórum → no es momento de ejecutar (la guarda de la CF igual lo rechazaría).
    if (requiereAutorizacionSocio(montoUSD) && after.autorizacion?.estado !== "aprobado") return;

    await registrarRetiroCashCore(
      admin.firestore(),
      { retiroId: context.params.retiroId },
      "sistema-trigger-retiro",
    );
  });
