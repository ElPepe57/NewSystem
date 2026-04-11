import { Timestamp } from 'firebase/firestore';

/**
 * Tarjeta de credito — pasivo financiero
 * Se usa para compras en USD (Amazon, proveedores).
 * El pago al banco genera diferencial cambiario.
 */
export interface TarjetaCredito {
  id: string;
  codigo: string;                      // TC-001, TC-002, etc.
  nombre: string;                      // "Visa BBVA ****6411"
  banco: string;
  ultimosDigitos: string;              // "6411"
  moneda: 'USD' | 'PEN';

  // Limites
  limiteUSD: number;
  saldoActualUSD: number;              // Cuanto se debe actualmente
  disponibleUSD: number;               // limite - saldo

  // Fecha de corte y pago
  diaCorte: number;                    // 1-31
  diaPago: number;                     // 1-31

  // Estado
  activa: boolean;

  // Auditoria
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Datos para crear/editar una tarjeta
 */
export interface TarjetaCreditoFormData {
  nombre: string;
  banco: string;
  ultimosDigitos: string;
  moneda: 'USD' | 'PEN';
  limiteUSD: number;
  diaCorte: number;
  diaPago: number;
  activa: boolean;
}

/**
 * Cargo a tarjeta de credito (pasivo)
 */
export interface CargoTarjeta {
  id: string;
  tarjetaCreditoId: string;
  fecha: Timestamp;
  descripcion: string;
  montoUSD: number;
  tcDelDia: number;                    // TC referencial del dia del cargo
  montoPENReferencial: number;         // montoUSD * tcDelDia

  // Vinculo
  ordenCompraId?: string;
  ordenCompraNumero?: string;

  // Pago
  pagado: boolean;
  fechaPago?: Timestamp;
  tcPago?: number;                     // TC del dia del pago al banco
  montoPENReal?: number;               // montoUSD * tcPago
  diferencialCambiarioPEN?: number;    // montoPENReal - montoPENReferencial

  // Auditoria
  creadoPor: string;
  fechaCreacion: Timestamp;
}
