/**
 * Transferencia Pagos Service — Split de transferencia.service.ts
 * Contiene: registrarPagoViajero, anularPagoViajero, getTransferenciasPendientesPago,
 *           actualizarFleteTransferencia, getByViajeroId, getHistorialFinancieroViajero
 *
 * @deprecated Este modulo sera reemplazado por envio.pagos.service.ts en Fase 3
 */
export { transferenciaService as transferenciaPagosService } from './transferencia.service';

// Re-export types para conveniencia
export type {
  PagoViajero,
} from '../types/transferencia.types';
