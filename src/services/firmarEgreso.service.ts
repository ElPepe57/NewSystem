/**
 * firmarEgreso · F4 · dispatcher de firma de socio para la bandeja unificada.
 *
 * Enruta la firma al método `autorizar` del módulo correcto según el origen. NO re-valida la
 * regla de firma: los 3 servicios ya consumen `evaluarFirmaSocio` internamente (fuente única).
 * Solo enruta y propaga el resultado { completa, faltanFirmas? }.
 */

import { requerimientoService } from './requerimiento.service';
import { gastoService } from './gasto.service';
import { OrdenCompraService } from './ordenCompra.service';
import type { OrigenEgreso } from './egresosPendientesSocio.helper';

export function firmarEgreso(
  origen: OrigenEgreso,
  id: string,
  userId: string,
  userRoles: string[],
): Promise<{ completa: boolean; faltanFirmas?: number; equityFirmado?: number; equityElegible?: number; equityFaltante?: number }> {
  switch (origen) {
    case 'requerimiento':
      return requerimientoService.aprobar(id, userId, userRoles);
    case 'gasto':
      return gastoService.autorizarGasto(id, userId, userRoles);
    case 'oc':
      return OrdenCompraService.autorizarOC(id, userId, userRoles);
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
    case 'requerimiento':
      return requerimientoService.cancelarRequerimiento(id, userId);
    case 'gasto':
      return gastoService.rechazarGasto(id, userId, userRoles, motivo);
    case 'oc':
      return OrdenCompraService.rechazarOC(id, userId, userRoles, motivo);
  }
}
