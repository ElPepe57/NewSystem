import type { Timestamp } from 'firebase/firestore';

export interface EmpresaInfo {
  id: string;
  razonSocial: string;
  nombreComercial: string;
  ruc: string;
  direccion: string;
  telefono?: string;
  email?: string;
  sitioWeb?: string;
  logo?: string;

  // Configuración
  monedaPrincipal: 'PEN' | 'USD';
  decimalesPrecio: number;
  decimalesCantidad: number;

  // QR de Pagos (Yape/Plin)
  qrPagoUrl?: string;        // URL o data para el QR (puede ser imagen base64 o link de pago)
  qrPagoTelefono?: string;   // Número de teléfono para Yape/Plin
  qrPagoBanco?: string;      // Nombre del banco/app (ej: "Yape", "Plin", "Yape/Plin")

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  ultimaEdicion?: Timestamp;
}

export interface ConfiguracionGeneral {
  id: string;
  
  // Productos
  skuAutomatico: boolean;
  prefijoSKU: string;
  stockMinimoDefault: number;
  alertaStockBajo: boolean;
  
  // Inventario
  alertaVencimiento: boolean;
  diasAlertaVencimiento: number;
  usarLotes: boolean;
  
  // Ventas
  descuentoMaximo: number;
  permitirVentaSinStock: boolean;
  
  // Tipo de cambio
  alertaVariacionTC: boolean;
  porcentajeAlertaTC: number;
  
  // Órdenes de compra
  aprobarOrdenesGrandes: boolean;
  montoAprobarUSD: number;
  
  // Sistema
  idioma: 'es' | 'en';
  formatoFecha: 'DD/MM/YYYY' | 'MM/DD/YYYY';
  
  // Auditoría
  ultimaEdicion?: Timestamp;
  editadoPor?: string;
}

export interface Almacen {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'miami' | 'utah' | 'peru';
  direccion?: string;
  responsable?: string;
  activo: boolean;
  
  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  ultimaEdicion?: Timestamp;
}

export interface UsuarioPerfil {
  uid: string;
  nombre: string;
  email: string;
  rol: 'admin' | 'usuario';
  telefono?: string;
  avatar?: string;
  
  // Preferencias
  notificaciones: boolean;
  emailNotificaciones: boolean;
  
  // Auditoría
  fechaCreacion: Timestamp;
  ultimoAcceso?: Timestamp;
}

export interface EmpresaFormData {
  razonSocial: string;
  nombreComercial: string;
  ruc: string;
  direccion: string;
  telefono?: string;
  email?: string;
  sitioWeb?: string;
  monedaPrincipal: 'PEN' | 'USD';
  // QR de Pagos
  qrPagoUrl?: string;
  qrPagoTelefono?: string;
  qrPagoBanco?: string;
}

export interface ConfiguracionFormData {
  // Productos
  skuAutomatico: boolean;
  prefijoSKU: string;
  stockMinimoDefault: number;
  alertaStockBajo: boolean;
  
  // Inventario
  alertaVencimiento: boolean;
  diasAlertaVencimiento: number;
  
  // Ventas
  descuentoMaximo: number;
  permitirVentaSinStock: boolean;
  
  // TC
  alertaVariacionTC: boolean;
  porcentajeAlertaTC: number;
}

export interface AlmacenFormData {
  codigo: string;
  nombre: string;
  tipo: 'miami' | 'utah' | 'peru';
  direccion?: string;
  responsable?: string;
}