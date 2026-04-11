/**
 * Transferencia CRUD Service — Split de transferencia.service.ts
 * Contiene: getAll, getById, getByNumero, getByFiltros, getEnTransito,
 *           getPendientesRecepcion, crear, confirmar, enviar, cancelar, getResumen
 *
 * @deprecated Este modulo sera reemplazado por envio.crud.service.ts en Fase 3
 */
export { transferenciaService as transferenciaCrudService } from './transferencia.service';

// Re-export types para conveniencia
export type {
  Transferencia,
  TransferenciaFormData,
  TransferenciaFiltros,
  ResumenTransferencias,
  EstadoTransferencia,
} from '../types/transferencia.types';
