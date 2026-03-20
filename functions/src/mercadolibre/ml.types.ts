/**
 * Tipos TypeScript para la API de Mercado Libre
 * Representan las respuestas reales de la API de ML
 */

// ============================================================
// AUTH / TOKENS
// ============================================================

export interface MLTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
}

export interface MLTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: FirebaseFirestore.Timestamp;
  userId: number;
  lastRefreshed: FirebaseFirestore.Timestamp;
}

// ============================================================
// USERS / BUYERS
// ============================================================

export interface MLUser {
  id: number;
  nickname: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: {
    area_code: string | null;
    number: string;
    extension: string | null;
    verified: boolean;
  } | null;
  alternative_phone: {
    area_code: string | null;
    number: string;
    extension: string | null;
  } | null;
  identification: {
    type: string; // "DNI" | "RUC" | etc.
    number: string;
  } | null;
  address: {
    state: string;
    city: string;
    address: string;
    zip_code: string;
  } | null;
}

// ============================================================
// ITEMS / PRODUCTS
// ============================================================

export interface MLItem {
  id: string; // "MPE12345678"
  site_id: string; // "MPE" para Perú
  title: string;
  subtitle: string | null;
  seller_id: number;
  category_id: string;
  price: number;
  base_price: number;
  currency_id: string; // "PEN"
  initial_quantity: number;
  available_quantity: number;
  sold_quantity: number;
  condition: "new" | "used" | "not_specified";
  permalink: string;
  thumbnail: string;
  pictures: MLItemPicture[];
  shipping: MLItemShipping;
  seller_custom_field: string | null; // SKU del seller
  attributes: MLAttribute[];
  variations: MLVariation[];
  status: "active" | "paused" | "closed" | "under_review";
  date_created: string;
  last_updated: string;
  health: number | null;
  catalog_product_id: string | null;
  listing_type_id: string; // "gold_special", "gold_pro", etc.
  catalog_listing: boolean; // true = publicacion de catalogo, false = directa/clasica
}

export interface MLItemPicture {
  id: string;
  url: string;
  secure_url: string;
  size: string;
  max_size: string;
}

export interface MLItemShipping {
  mode: string;
  free_shipping: boolean;
  logistic_type: string | null;
  store_pick_up: boolean;
}

export interface MLAttribute {
  id: string;
  name: string;
  value_id: string | null;
  value_name: string | null;
  values: Array<{
    id: string | null;
    name: string;
  }>;
}

export interface MLVariation {
  id: number;
  price: number;
  attribute_combinations: MLAttribute[];
  available_quantity: number;
  sold_quantity: number;
  picture_ids: string[];
  attributes: MLAttribute[];
}

// ============================================================
// ORDERS
// ============================================================

export interface MLOrder {
  id: number;
  pack_id?: number | null; // ID del pack cuando el comprador compra 2+ productos en un solo carrito
  status: "confirmed" | "payment_required" | "payment_in_process" | "partially_paid" | "paid" | "cancelled";
  status_detail: string | null;
  date_created: string;
  date_closed: string | null;
  order_items: MLOrderItem[];
  total_amount: number;
  currency_id: string;
  buyer: {
    id: number;
    nickname?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: {
      area_code: string | null;
      number: string;
      extension: string | null;
      verified: boolean;
    };
    billing_info?: {
      doc_type: string;
      doc_number: string;
    };
  };
  seller: {
    id: number;
  };
  payments: MLPayment[];
  shipping: {
    id: number | null;
  };
  tags: string[];
  context: {
    channel: string;
    site: string;
  };
  taxes: {
    amount: number | null;
    currency_id: string | null;
  };
  cancel_detail: {
    reason: string;
    description: string;
  } | null;
}

export interface MLBillingInfoInner {
  doc_type?: string;
  doc_number?: string;
  additional_info?: Array<{
    type: string;
    value: string;
  }>;
}

export interface MLBillingInfoResponse {
  billing_info: MLBillingInfoInner;
}

export interface MLOrderItem {
  item: {
    id: string;
    title: string;
    category_id: string;
    variation_id: number | null;
    variation_attributes: MLAttribute[];
    seller_custom_field: string | null;
    seller_sku: string | null;
  };
  quantity: number;
  unit_price: number;
  full_unit_price: number | null;
  sale_fee: number;
  currency_id: string;
  manufacturing_days: number | null;
}

export interface MLPayment {
  id: number;
  order_id: number;
  payer_id: number;
  status: "approved" | "pending" | "authorized" | "in_process" | "in_mediation" | "rejected" | "cancelled" | "refunded" | "charged_back";
  status_detail: string;
  transaction_amount: number;
  currency_id: string;
  date_created: string;
  date_last_modified: string;
  shipping_cost: number;
  total_paid_amount: number;
  payment_method_id: string;
  payment_type: string;
  installments: number;
}

// ============================================================
// SHIPPING
// ============================================================

export interface MLShipment {
  id: number;
  status: "pending" | "handling" | "ready_to_ship" | "shipped" | "delivered" | "not_delivered" | "cancelled";
  substatus: string | null;
  tracking_number: string | null;
  tracking_method: string | null;
  service_id: number;
  shipping_mode: string;
  date_created: string;
  date_first_printed: string | null;
  receiver_address: {
    id: number;
    address_line: string;
    street_name: string;
    street_number: string;
    city: { id: string; name: string };
    state: { id: string; name: string };
    country: { id: string; name: string };
    zip_code: string;
    comment: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  sender_address: {
    address_line: string;
    city: { id: string; name: string };
    state: { id: string; name: string };
    country: { id: string; name: string };
  };
  lead_time: {
    cost: number;
    currency_id: string;
  } | null;
  shipping_option?: {
    cost: number;
    list_cost: number;
    currency_id: string;
  } | null;
  sender_id: number;
  receiver_id: number;
}

// ============================================================
// QUESTIONS
// ============================================================

export interface MLQuestion {
  id: number;
  text: string;
  status: "UNANSWERED" | "ANSWERED" | "CLOSED_UNANSWERED" | "UNDER_REVIEW" | "BANNED" | "DELETED" | "DISABLED";
  item_id: string;
  seller_id: number;
  from: {
    id: number;
    answered_questions: number;
  };
  answer: {
    text: string;
    status: string;
    date_created: string;
  } | null;
  date_created: string;
}

// ============================================================
// SELLER REPUTATION
// ============================================================

export interface MLSellerReputation {
  level_id: string; // "5_green", "4_light_green", etc.
  power_seller_status: "platinum" | "gold" | "silver" | null;
  transactions: {
    period: string;
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
    sales: { period: string; completed: number };
    claims: { period: string; rate: number; value: number };
    delayed_handling_time: { period: string; rate: number; value: number };
    cancellations: { period: string; rate: number; value: number };
  };
}

// ============================================================
// FEES
// ============================================================

export interface MLFeeDetail {
  listing_type_id: string;
  sale_fee_amount: number;
  currency_id: string;
  sale_fee_details: {
    percentage_fee: number;
    fixed_fee: number;
    meli_percentage_fee: number;
    financing_add_on_fee: number;
    gross_amount: number;
  };
}

// ============================================================
// WEBHOOK NOTIFICATIONS
// ============================================================

export interface MLWebhookNotification {
  _id: string;
  resource: string; // "/orders/12345678" or "/items/MPE123"
  user_id: number;
  topic: string; // "orders_v2", "items", "payments", "shipments", etc.
  application_id: number;
  attempts: number;
  sent: string;
  received: string;
}

// ============================================================
// BUY BOX / COMPETITION (price_to_win)
// ============================================================

export interface MLPriceToWin {
  item_id: string;
  current_price: number;
  currency_id: string;
  price_to_win: number | null;
  status: "winning" | "competing" | "sharing_first_place" | "listed";
  consistent: boolean;
  visit_share: "maximum" | "medium" | "minimum";
  competitors_sharing_first_place: number | null;
  catalog_product_id: string;
  reason: string[];
  boosts: Array<{ id: string; status: string; description: string }>;
  winner: {
    item_id: string;
    price: number;
    currency_id: string;
    boosts: Array<{ id: string; status: string }>;
  } | null;
}

// ============================================================
// MAPEO ML <-> ERP (Firestore)
// ============================================================

export interface MLProductMap {
  id?: string;
  mlItemId: string; // "MPE12345678"
  mlTitle: string;
  mlPrice: number;
  mlThumbnail: string;
  mlPermalink: string;
  mlSku: string | null; // seller_custom_field
  mlAvailableQuantity: number;
  mlStatus: string;
  // Campos de agrupacion (catalogo vs clasica)
  mlCatalogProductId: string | null;
  mlListingTypeId: string | null; // "gold_special", "gold_pro", etc.
  mlListingType: "clasica" | "catalogo";
  skuGroupKey: string | null; // = mlSku || catalog_product_id, null para items sin SKU
  // Vinculacion con ERP
  productoId: string | null; // ID de Firestore del producto ERP
  productoSku: string | null; // SKU del ERP
  productoNombre: string | null;
  vinculado: boolean;
  fechaVinculacion: FirebaseFirestore.Timestamp | null;
  fechaSync: FirebaseFirestore.Timestamp;
  // Competencia Buy Box (solo catálogo)
  buyBoxStatus?: "winning" | "competing" | "sharing_first_place" | "listed" | null;
  buyBoxPriceToWin?: number | null;
  buyBoxWinnerPrice?: number | null;
  buyBoxVisitShare?: "maximum" | "medium" | "minimum" | null;
  buyBoxBoosts?: Array<{ id: string; status: string }>;
  buyBoxLastCheck?: FirebaseFirestore.Timestamp | null;
}

export interface MLOrderSync {
  id?: string;
  mlOrderId: number;
  mlStatus: string;
  mlBuyerId: number;
  mlBuyerName: string | null;
  mlBuyerNickname?: string | null; // Username de MercadoLibre
  ventaId: string | null; // ID de la Venta creada en ERP
  numeroVenta: string | null;
  clienteId: string | null;
  estado: "pendiente" | "procesada" | "error" | "ignorada";
  errorDetalle: string | null;
  totalML: number;
  comisionML: number;
  costoEnvioML: number;
  costoEnvioCliente: number; // Lo que el cliente pagó por envío (payment.shipping_cost)
  metodoEnvio?: "flex" | "urbano" | null; // Método de envío detectado
  cargoEnvioML?: number; // Cargo por envío que ML cobra al vendedor (Urbano) — es una deducción, no ingreso
  fechaOrdenML: FirebaseFirestore.Timestamp;
  fechaProcesada: FirebaseFirestore.Timestamp | null;
  fechaSync: FirebaseFirestore.Timestamp;
  // Origen del registro: cómo llegó al sistema
  origen?: "webhook" | "importacion_historica" | "manual";
  fechaImportacion?: FirebaseFirestore.Timestamp | null;
  // Datos extendidos del buyer y shipment
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  buyerDni?: string | null;
  buyerDocType?: string | null; // "DNI" | "RUC" | etc. (tipo de documento)
  razonSocial?: string | null; // Razón social para compradores con RUC (empresa)
  direccionEntrega?: string;
  distrito?: string;
  provincia?: string;
  codigoPostal?: string | null;
  referenciaEntrega?: string | null; // Referencia/comentario de entrega del comprador
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
  // Delay de creación de venta: timestamp a partir del cual se puede crear la venta
  crearVentaDespuesDe?: FirebaseFirestore.Timestamp | null;
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

export interface MLConfig {
  connected: boolean;
  userId: number | null;
  nickname: string | null;
  autoCreateVentas: boolean;
  autoCreateClientes: boolean;
  defaultComisionPorcentaje: number;
  lastSync: FirebaseFirestore.Timestamp | null;
  tokenExpiresAt: FirebaseFirestore.Timestamp | null;
}
