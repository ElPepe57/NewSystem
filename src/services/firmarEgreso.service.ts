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
): Promise<{ completa: boolean; faltanFirmas?: number }> {
  switch (origen) {
    case 'requerimiento':
      return requerimientoService.aprobar(id, userId, userRoles);
    case 'gasto':
      return gastoService.autorizarGasto(id, userId, userRoles);
    case 'oc':
      return OrdenCompraService.autorizarOC(id, userId, userRoles);
  }
}
