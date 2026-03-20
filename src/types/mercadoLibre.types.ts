/**
 * Tipos frontend para la integración con Mercado Libre
 * Estos tipos representan los datos almacenados en Firestore
 * que fueron traducidos desde la API de ML por las Cloud Functions.
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================
// CONFIGURACIÓN / ESTADO DE CONEXIÓN
// ============================================================

export interface MLConfig {
  connected: boolean;
  userId: number | null;
  nickname: string | null;
  firstName?: string;
  lastName?: string;
  email?: string;
  autoCreateVentas: boolean;
  autoCreateClientes: boolean;
  defaultComisionPorcentaje: number;
  lastSync: Timestamp | null;
  tokenExpiresAt: Timestamp | null;
  connectedAt?: Timestamp;
}

// ============================================================
// MAPEO DE PRODUCTOS ML ↔ ERP
// ============================================================

export interface MLProductMap {
  id: string;
  mlItemId: string;
  mlTitle: string;
  mlPrice: number;
  mlThumbnail: string;
  mlPermalink: string;
  mlSku: string | null;
  mlAvailableQuantity: number;
  mlStatus: string;
  // Campos de agrupacion (catalogo vs clasica)
  mlCatalogProductId: string | null;
  mlListingTypeId: string | null; // "gold_special", "gold_pro", etc.
  mlListingType: 'clasica' | 'catalogo';
  skuGroupKey: string | null;
  // Vinculacion con ERP
  productoId: string | null;
  productoSku: string | null;
  productoNombre: string | null;
  vinculado: boolean;
  fechaVinculacion: Timestamp | null;
  fechaSync: Timestamp;
  // Competencia Buy Box (solo catálogo)
  buyBoxStatus?: 'winning' | 'competing' | 'sharing_first_place' | 'listed' | null;
  buyBoxPriceToWin?: number | null;
  buyBoxWinnerPrice?: number | null;
  buyBoxVisitShare?: 'maximum' | 'medium' | 'minimum' | null;
  buyBoxBoosts?: Array<{ id: string; status: string }>;
  buyBoxLastCheck?: Timestamp | null;
}

/**
 * Agrupacion de publicaciones ML por SKU.
 * Multiples publicaciones (clasica + catalogo) del mismo producto
 * se agrupan bajo un solo MLProductGroup.
 */
export interface MLProductGroup {
  groupKey: string;
  mlSku: string | null;
  productoId: string | null;
  productoSku: string | null;
  productoNombre: string | null;
  vinculado: boolean;
  listings: MLProductMap[];
  /** Stock compartido en ML (NO sumar — es el mismo para todas las publicaciones del grupo) */
  stockML: number;
}

// ============================================================
// ÓRDENES ML SINCRONIZADAS
// ============================================================

export interface MLOrderSync {
  id: string;
  mlOrderId: number;
  mlStatus: string;
  mlBuyerId: number;
  mlBuyerName: string | null;
  mlBuyerNickname?: string | null;
  ventaId: string | null;
  numeroVenta: string | null;
  clienteId: string | null;
  estado: 'pendiente' | 'procesada' | 'error' | 'ignorada';
  errorDetalle: string | null;
  totalML: number;
  comisionML: number;
  costoEnvioML: number;
  costoEnvioCliente?: number; // Lo que el cliente pagó por envío (payment.shipping_cost)
  metodoEnvio?: 'flex' | 'urbano' | null; // Método de envío detectado
  cargoEnvioML?: number; // Cargo por envío que ML cobra al vendedor (Urbano) — deducción
  fechaOrdenML: Timestamp;
  fechaProcesada: Timestamp | null;
  fechaSync: Timestamp;
  // Origen del registro: cómo llegó al sistema
  origen?: 'webhook' | 'importacion_historica' | 'manual';
  fechaImportacion?: Timestamp | null;
  // Datos extendidos
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  buyerDni?: string | null;
  buyerDocType?: string | null; // "DNI" | "RUC" | etc.
  razonSocial?: string | null; // Razón social para compradores con RUC
  direccionEntrega?: string;
  distrito?: string;
  provincia?: string;
  codigoPostal?: string | null;
  referenciaEntrega?: string | null; // Referencia de entrega del comprador
  coordenadas?: { lat: number; lng: number } | null;
  trackingNumber?: string | null;
  trackingMethod?: string | null; // "flex", "urbano", etc. — método de envío ML
  shipmentStatus?: string;
  todosVinculados?: boolean;
  stockPendienteContabilizado?: boolean; // true si ya se incrementó stockPendienteML en productos
  productos?: MLOrderProduct[];
  // Pack orders: cuando el comprador compra 2+ productos en un solo carrito
  packId?: number | null; // ML pack_id que agrupa sub-órdenes
  subOrderIds?: number[]; // Lista de mlOrderIds que componen este pack
  subOrdersRecibidas?: number; // Cantidad de sub-órdenes recibidas hasta ahora
}

export interface MLOrderProduct {
  mlItemId: string;
  mlTitle: string;
  mlVariationId: number | null;
  cantidad: number;
  precioUnitario: number;
  saleFee: number;
  productoId: string | null;
  productoSku: string | null;
  productoNombre: string | null;
  vinculado: boolean;
}

// ============================================================
// PREGUNTAS ML
// ============================================================

export interface MLQuestion {
  id: number;
  text: string;
  status: 'UNANSWERED' | 'ANSWERED' | 'CLOSED_UNANSWERED' | 'UNDER_REVIEW' | 'BANNED' | 'DELETED' | 'DISABLED';
  item_id: string;
  date_created: string;
  from: {
    id: number;
    answered_questions: number;
  };
  answer: {
    text: string;
    status: string;
    date_created: string;
  } | null;
}

// ============================================================
// REPUTACIÓN / MÉTRICAS
// ============================================================

export interface MLSellerMetrics {
  level_id: string;
  power_seller_status: string | null;
  transactions: {
    total: number;
    completed: number;
    canceled: number;
    ratings: {
      positive: number;
      negative: number;
      neutral: number;
    };
  };
  metrics: {
    claims: { rate: number; value: number };
    delayed_handling_time: { rate: number; value: number };
    cancellations: { rate: number; value: number };
  };
}

// ============================================================
// TABS / UI
// ============================================================

export type MLTabType = 'resumen' | 'productos' | 'ordenes' | 'preguntas' | 'rendimiento' | 'config';
