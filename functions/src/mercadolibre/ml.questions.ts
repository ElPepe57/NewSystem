/**
 * Mercado Libre — Preguntas y respuestas (Q&A)
 *
 * Funciones:
 * - mlgetquestions: Obtiene preguntas sin responder del seller
 * - mlanswerquestion: Responde una pregunta
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * Obtiene preguntas sin responder
 */
export const mlgetquestions = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }

  const settingsDoc = await db.collection("mlConfig").doc("settings").get();
  if (!settingsDoc.exists || !settingsDoc.data()?.connected) {
    throw new functions.https.HttpsError("failed-precondition", "ML no está conectado");
  }

  const { userId } = settingsDoc.data()!;

  try {
    const { getSellerQuestions } = await import("./ml.api");
    const result = await getSellerQuestions(userId);
    return result;
  } catch (err: any) {
    throw new functions.https.HttpsError("internal", err.message);
  }
});

/**
 * Responde una pregunta de ML
 */
export const mlanswerquestion = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }

  const { questionId, text } = data;
  if (!questionId || !text) {
    throw new functions.https.HttpsError("invalid-argument", "questionId y text son requeridos");
  }

  try {
    const { answerQuestion } = await import("./ml.api");
    await answerQuestion(questionId, text);
    return { success: true };
  } catch (err: any) {
    throw new functions.https.HttpsError("internal", err.message);
  }
});
