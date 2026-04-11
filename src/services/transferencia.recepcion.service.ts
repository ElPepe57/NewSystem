/**
 * Transferencia Recepcion Service — Split de transferencia.service.ts
 * Contiene: registrarRecepcion, migrarCostoFleteAProductos, migrarStockDesdeTransferencias
 *
 * @deprecated Este modulo sera reemplazado por envio.recepcion.service.ts en Fase 3
 */
export { transferenciaService as transferenciaRecepcionService } from './transferencia.service';

// Re-export types para conveniencia
export type {
  RecepcionFormData,
  RecepcionTransferencia,
} from '../types/transferencia.types';
