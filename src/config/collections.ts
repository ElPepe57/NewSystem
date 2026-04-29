/**
 * Nombres de colecciones Firestore centralizados.
 *
 * Usar SIEMPRE estas constantes en lugar de strings hardcodeados
 * para evitar errores de tipeo y facilitar refactoring.
 *
 * Ejemplo: collection(db, COLLECTIONS.VENTAS)
 */
export const COLLECTIONS = {
  // === Flujo de Ventas ===
  VENTAS: 'ventas',
  COTIZACIONES: 'cotizaciones',
  CLIENTES: 'clientes',
  ENTREGAS: 'entregas',
  ENTREGAS_PARCIALES: 'entregas_parciales',

  // === Compras / Abastecimiento ===
  REQUERIMIENTOS: 'requerimientos',
  ORDENES_COMPRA: 'ordenesCompra',
  PROVEEDORES: 'proveedores',

  // === Inventario ===
  PRODUCTOS: 'productos',
  UNIDADES: 'unidades',
  ALMACENES: 'almacenes',
  TRANSFERENCIAS: 'transferencias',

  // === Finanzas / Tesorería ===
  GASTOS: 'gastos',
  MOVIMIENTOS_TESORERIA: 'movimientosTesoreria',
  CONVERSIONES_CAMBIARIAS: 'conversionesCambiarias',
  CUENTAS_CAJA: 'cuentasCaja',
  REGISTROS_TC_TRANSACCION: 'registrosTCTransaccion',
  APORTES_CAPITAL: 'aportesCapital',
  RETIROS_CAPITAL: 'retirosCapital',

  // === Líneas de Negocio ===
  LINEAS_NEGOCIO: 'lineasNegocio',

  // === Países de Origen ===
  PAISES_ORIGEN: 'paisesOrigen',

  // === Datos Maestros ===
  MARCAS: 'marcas',
  CATEGORIAS: 'categorias',
  TIPOS_PRODUCTO: 'tiposProducto',
  CANALES_VENTA: 'canalesVenta',
  ETIQUETAS: 'etiquetas',
  COMPETIDORES: 'competidores',
  TRANSPORTISTAS: 'transportistas',
  TIPOS_CAMBIO: 'tiposCambio',

  // === Configuración ===
  CONFIGURACION: 'configuracion',
  CONTADORES: 'contadores',

  // === Sistema ===
  USERS: 'users',
  NOTIFICACIONES: 'notificaciones',
  AUDIT_LOGS: 'audit_logs',
  MOVIMIENTOS_TRANSPORTISTA: 'movimientos_transportista',
  HISTORIAL_CTRU: 'historialRecalculoCTRU',

  // === Escáner ===
  SCAN_HISTORY: 'scanHistory',
  CONTEOS_INVENTARIO: 'conteosInventario',

  // === Rendimiento Cambiario (Pool USD) — deprecado, se fusiona con Tesoreria ===
  /** @deprecated Se fusionara con Tesoreria en reingenieria */ POOL_USD_MOVIMIENTOS: 'poolUSDMovimientos',
  /** @deprecated Se fusionara con Tesoreria en reingenieria */ POOL_USD_SNAPSHOTS: 'poolUSDSnapshots',

  // === Reingenieria: Red Logistica ===
  CASILLAS: 'casillas',
  COLABORADORES: 'colaboradores',
  ENVIOS: 'envios',
  RECLAMOS: 'reclamos',

  // === Reingenieria: Costos y Finanzas ===
  CATEGORIAS_COSTOS: 'categoriasCostos',
  INSUMOS: 'insumos',
  KITS_EMPAQUE: 'kitsEmpaque',
  TARJETAS_CREDITO: 'tarjetasCredito',

  // === S58d v2 — Tarjetas de crédito (cargos + pagos estado de cuenta) ===
  CARGOS_TARJETA: 'cargosTarjeta',
  PAGOS_ESTADO_CUENTA_TC: 'pagosEstadoCuentaTC',

  // === Colaboración ===
  PRESENCIA: 'presencia',
  ACTIVIDAD: 'actividad',
  CHAT_MENSAJES: 'chat_mensajes',
  CHAT_META: 'chat_meta',
  LLAMADAS: 'llamadas',
  LLAMADAS_INTEL: 'llamadasIntel',

  // === MercadoLibre ===
  ML_PRODUCT_MAP: 'mlProductMap',
  ML_ORDER_SYNC: 'mlOrderSync',
  ML_CONFIG: 'mlConfig',
  ML_QUESTIONS: 'mlQuestions',
  ML_WEBHOOK_LOG: 'mlWebhookLog',

  // === Estadísticas ===
  ESTADISTICAS: 'estadisticas',

  // === Devoluciones ===
  DEVOLUCIONES: 'devoluciones',

  // === Pagos Masivos ===
  LOTES_PAGOS: 'lotePagos',

  // === Planilla ===
  BOLETAS: 'boletas',
  ADELANTOS_NOMINA: 'adelantosNomina',

  // === Contabilidad ===
  CIERRES_CONTABLES: 'cierresContables',

  // === WhatsApp ===
  WHATSAPP_SESSIONS: 'whatsapp_sessions',
  WHATSAPP_CONFIG: 'whatsapp_config',

  // === ML adicionales ===
  ML_SHIPMENT_LOG: 'mlShipmentLog',

  // === Sistema: Error Log ===
  ERROR_LOG: '_errorLog',

  // === S55 · Cuenta Corriente Unificada ===
  // Doc raíz por entidad (cliente/proveedor/colaborador/empleado).
  // ID determinístico: `{tipo}_{entidadId}`. Ver cuentaCorriente.types.ts
  CUENTAS_CORRIENTES: 'cuentasCorrientes',
  // Movimientos del libro de cada CC. Inmutables (audit trail).
  MOVIMIENTOS_CC: 'movimientosCC',

  // === S58c-PF · ADR-PF-001 · Producto Financiero Unificado (F1) ===
  // Reemplaza CUENTAS_CAJA + TARJETAS_CREDITO + CARGOS_TARJETA +
  // PAGOS_ESTADO_CUENTA_TC + MOVIMIENTOS_TESORERIA + CONVERSIONES_CAMBIARIAS.
  // Coexiste con los legacy durante F1-F4. Eliminacion de legacy en F5.
  /** Productos financieros unificados (cuentas + tarjetas + wallets). */
  PRODUCTOS_FINANCIEROS: 'productosFinancieros',
  /** Vinculo titular - banco. Agrupa productos del mismo banco/titular. */
  RELACIONES_BANCARIAS: 'relacionesBancarias',
  /** Libro mayor unico (movs tesoreria + cargos TC + pagos TC + conversiones). */
  MOVIMIENTOS_FINANCIEROS: 'movimientosFinancieros',
} as const;

/** Tipo union de todos los nombres de colección */
export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];
