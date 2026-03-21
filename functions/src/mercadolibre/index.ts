/**
 * Mercado Libre Integration - Barrel export
 *
 * Exporta todas las Cloud Functions de ML para que
 * se registren en Firebase desde el index.ts principal.
 *
 * Módulos:
 * - ml.auth.ts        → auth, status, webhooks config
 * - ml.webhooks.ts    → webhook receiver
 * - ml.questions.ts   → preguntas ML
 * - ml.stock.ts       → stock, precios, vinculación
 * - ml.orders.ts      → órdenes, procesamiento, sync
 * - ml.diagnostics.ts → diagnóstico y reparación
 * - ml.reconciliation.ts → reconciliación MP
 * - ml.reingenieria.ts → reingeniería completa
 */

export {
  mlauthcallback,
  mlgetauthurl,
  mlrefreshtoken,
  mlgetstatus,
  mlregisterwebhook,
  mlgetwebhookstatus,
} from "./ml.auth";

export { mlwebhook } from "./ml.webhooks";

export { mlgetquestions, mlanswerquestion } from "./ml.questions";

export {
  mlsyncitems,
  mlvinculateproduct,
  mldesvincularproduct,
  mlsyncstock,
  mlupdateprice,
  mlsyncbuybox,
  mlmigratestockpendiente,
} from "./ml.stock";

export {
  mlimporthistoricalorders,
  mlprocesarorden,
  mlprocesarpendientes,
  mlautocreateventas,
  mlconsolidatepackorders,
} from "./ml.orders";

export {
  mlreenrichbuyers,
  mlrepararventasurbano,
  mlrepararnamesdni,
  mldiagshipping,
  mlpatchenvio,
  mlfixventashistoricas,
  mlrepairgastosml,
  mlrepairmetodoenvio,
} from "./ml.diagnostics";

export {
  mldiagnosticosistema,
  mlrecalcularbalancemp,
  mlmatchsuggestions,
  mlconfirmmatch,
  mldiaginconsistencias,
  mlresolverinconsistencias,
} from "./ml.reconciliation";

export { mlreingenieria } from "./ml.reingenieria";
