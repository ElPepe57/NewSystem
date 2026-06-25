/**
 * firmarEgreso · F4 · dispatcher de firma de socio para la bandeja unificada.
 *
 * Enruta la firma al método `autorizar` del módulo correcto según el origen. NO re-valida la
 * regla de firma: los 3 servicios ya consumen `evaluarFirmaSocio` internamente (fuente única).
 * Solo enruta y propaga el resultado { completa, faltanFirmas? }.
 */

import { gastoService } from './gasto.service';
import { OrdenCompraService } from './ordenCompra.service';
import { autorizarRetiroCapital, rechazarRetiroCapital } from './retiroCash.client';
import { autorizarEnvioFlete, rechazarEnvioFlete, autorizarDevolucionReembolso, rechazarDevolucionReembolso } from './egresoCash.client';
import { autorizarAjusteConciliacion, rechazarAjusteConciliacion } from './tesoreria.ajustes.service';
import type { OrigenEgreso } from './egresosPendientesSocio.helper';

export function firmarEgreso(
  origen: OrigenEgreso,
  id: string,
  userId: string,
  userRoles: string[],
): Promise<{ completa: boolean; faltanFirmas?: number; equityFirmado?: number; equityElegible?: number; equityFaltante?: number }> {
  switch (origen) {
    case 'gasto':
      return gastoService.autorizarGasto(id, userId, userRoles);
    case 'oc':
      return OrdenCompraService.autorizarOC(id, userId, userRoles);
    case 'retiro':
      // F3c · sin método de módulo · va directo a la CF autorizarEgreso (colección retirosCapital) y, al
      // completarse el quórum, encadena el desembolso (el retiro ES el pago).
      return autorizarRetiroCapital(id);
    case 'envio':
      // F3c · flete · va a la CF autorizarEgreso (colección envios) · NO encadena cash (el flete se paga
      // aparte por envio.pagos · gateado por registrarEgresoCash).
      return autorizarEnvioFlete(id);
    case 'devolucion':
      // A.2 · reembolso · va a la CF autorizarEgreso (colección devoluciones) · NO encadena cash (el reembolso
      // se paga aparte por devolucion.devolverDinero · gateado por registrarMovimientoCash).
      return autorizarDevolucionReembolso(id);
    case 'ajuste':
      // A.2 · ajuste standalone · va a la CF autorizarEgreso (colección ajustesConciliacion) y, al completarse,
      // ENCADENA la ejecución del cash (el ajuste ES el egreso · como el retiro).
      return autorizarAjusteConciliacion(id, userId);
  }
}

/**
 * F4 · rechazar un egreso (decisión de socio · deniega la autorización). Enruta por origen:
 * el requerimiento se cancela · gasto/OC quedan con autorizacion.estado='rechazado' (no-pagables).
 */
export function rechazarEgreso(
  origen: OrigenEgreso,
  id: string,
  userId: string,
  userRoles: string[],
  motivo?: string,
): Promise<void> {
  switch (origen) {
    case 'gasto':
      return gastoService.rechazarGasto(id, userId, userRoles, motivo);
    case 'oc':
      return OrdenCompraService.rechazarOC(id, userId, userRoles, motivo);
    case 'retiro':
      return rechazarRetiroCapital(id, motivo);
    case 'envio':
      return rechazarEnvioFlete(id, motivo);
    case 'devolucion':
      return rechazarDevolucionReembolso(id, motivo);
    case 'ajuste':
      return rechazarAjusteConciliacion(id, motivo);
  }
}
