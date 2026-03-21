/**
 * Nombres de colecciones Firestore centralizados — Cloud Functions
 *
 * ARCH-003 FIX: Mirror de src/config/collections.ts del frontend.
 * Mantener sincronizado con la versión del frontend.
 *
 * Usar SIEMPRE estas constantes en lugar de strings hardcodeados
 * para evitar errores de tipeo y facilitar refactoring.
 *
 * Ejemplo: db.collection(COLLECTIONS.VENTAS)
 */
export const COLLECTIONS = {
  // === Flujo de Ventas ===
  VENTAS: "ventas",
  COTIZACIONES: "cotizaciones",
  CLIENTES: "clientes",
  ENTREGAS: "entregas",
  ENTREGAS_PARCIALES: "entregas_parciales",

  // === Compras / Abastecimiento ===
  REQUERIMIENTOS: "requerimientos",
  ORDENES_COMPRA: "ordenesCompra",
  PROVEEDORES: "proveedores",

  // === Inventario ===
  PRODUCTOS: "productos",
  UNIDADES: "unidades",
  ALMACENES: "almacenes",
  TRANSFERENCIAS: "transferencias",

  // === Finanzas / Tesorería ===
  GASTOS: "gastos",
  MOVIMIENTOS_TESORERIA: "movimientosTesoreria",
  CONVERSIONES_CAMBIARIAS: "conversionesCambiarias",
  CUENTAS_CAJA: "cuentasCaja",
  REGISTROS_TC_TRANSACCION: "registrosTCTransaccion",
  APORTES_CAPITAL: "aportesCapital",
  RETIROS_CAPITAL: "retirosCapital",

  // === Líneas de Negocio ===
  LINEAS_NEGOCIO: "lineasNegocio",

  // === Países de Origen ===
  PAISES_ORIGEN: "paisesOrigen",

  // === Datos Maestros ===
  MARCAS: "marcas",
  CATEGORIAS: "categorias",
  TIPOS_PRODUCTO: "tiposProducto",
  CANALES_VENTA: "canalesVenta",
  ETIQUETAS: "etiquetas",
  COMPETIDORES: "competidores",
  TRANSPORTISTAS: "transportistas",
  TIPOS_CAMBIO: "tiposCambio",

  // === Configuración ===
  CONFIGURACION: "configuracion",
  CONTADORES: "contadores",

  // === Sistema ===
  USERS: "users",
  NOTIFICACIONES: "notificaciones",
  AUDIT_LOGS: "audit_logs",
  MOVIMIENTOS_TRANSPORTISTA: "movimientos_transportista",
  HISTORIAL_CTRU: "historialRecalculoCTRU",

  // === Escáner ===
  SCAN_HISTORY: "scanHistory",
  CONTEOS_INVENTARIO: "conteosInventario",

  // === Rendimiento Cambiario (Pool USD) ===
  POOL_USD_MOVIMIENTOS: "poolUSDMovimientos",
  POOL_USD_SNAPSHOTS: "poolUSDSnapshots",

  // === Colaboración ===
  PRESENCIA: "presencia",
  ACTIVIDAD: "actividad",
  CHAT_MENSAJES: "chat_mensajes",
  CHAT_META: "chat_meta",
  LLAMADAS: "llamadas",
  LLAMADAS_INTEL: "llamadasIntel",

  // === MercadoLibre ===
  ML_CONFIG: "mlConfig",
  ML_PRODUCT_MAP: "mlProductMap",
  ML_ORDER_SYNC: "mlOrderSync",
  ML_WEBHOOK_LOG: "mlWebhookLog",
  ML_QUESTIONS: "mlQuestions",
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];
