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

  // === chk5.PERSONAS-v5.4 · F3 · Planilla v5.4 (2026-05-26) ===
  /**
   * Historial salarial · variaciones de sueldo por empleado.
   * Doc id auto-generado. FK userId. Trazabilidad de promociones, ajustes,
   * méritos. Lectura para timeline en Ficha 360. Ver planilla.types.ts::HistorialSalarial.
   */
  HISTORIAL_SALARIAL: 'historialSalarial',
  /**
   * Esquemas de incentivo (templates) · 4 tipos (comisión · bono_meta ·
   * bono_kpi · bono_fijo). Configurables por rol o lista de usuarios.
   * Doc id auto-generado. Ver planilla.types.ts::EsquemaIncentivo.
   */
  ESQUEMAS_INCENTIVO: 'esquemasIncentivo',
  /**
   * Cálculos mensuales de incentivos · resultado de aplicar un esquema a
   * un usuario en un mes específico. Workflow: calculado → aprobado/rechazado
   * → incluido_en_boleta. Ver planilla.types.ts::CalculoIncentivoMes.
   */
  CALCULOS_INCENTIVO: 'calculosIncentivo',
  /**
   * Liquidaciones por baja de empleado · conceptos + neto + estado.
   * Workflow: borrador → aprobada → pagada (genera movimiento tesorería).
   * Ver planilla.types.ts::LiquidacionEmpleado.
   */
  LIQUIDACIONES_EMPLEADO: 'liquidacionesEmpleado',
  /**
   * Gratificaciones · solo Julio y Diciembre (Perú · Vita Skin NO paga CTS).
   * Doc id `GRAT-{anio}-{mes}-{seq}`. Genera boleta + gasto + movimiento
   * cuando se aprueba. Ver planilla.types.ts::Gratificacion.
   */
  GRATIFICACIONES: 'gratificaciones',

  // === Contabilidad ===
  CIERRES_CONTABLES: 'cierresContables', // @deprecated · reemplazado por REVISIONES_MENSUALES (chk5.E-RM)
  REVISIONES_MENSUALES: 'revisionesMensuales', // chk5.E-RM · revisión informal sin bloqueo

  // === chk5.E-INV · Inversionistas ===
  /** Catálogo de socios/inversionistas · doc id determinístico snake_case del nombre */
  SOCIOS: 'socios',

  // === chk5.F4-USERS · Módulo /usuarios completo (2026-05-25) ===
  /**
   * Invitaciones por email enviadas por admin · doc id auto-generado.
   * Estado del ciclo: enviada → link_abierto → aceptada / expirada / cancelada.
   * Ver invitacion.types.ts
   */
  INVITACIONES: 'invitaciones',

  // === chk5.PERSONAS-v5.6 / v5.8 / v5.9 (2026-05-28) ===
  /**
   * Relaciones laborales · una persona puede tener N relaciones simultáneas
   * (empleado + socio) y M históricas (reclasificadas · finalizadas). Reemplaza
   * en código nuevo a users/{uid}/private/datosLaborales y datosSocio.
   * Doc id auto-generado · FK userId. Ver relacionLaboral.types.ts.
   * Campos clave: tipo · estado · subTipo · entidadMaestroRef (v5.8 vinculación
   * con Maestros) · snapshots inmutables al finalizar.
   */
  RELACIONES_LABORALES: 'relacionesLaborales',
  /**
   * Solicitudes de acceso externas · pre-stage antes de crear UserProfile.
   * Externos (proveedores · clientes · transportistas) solicitan acceso vía
   * página pública /solicitar-acceso. Admin las procesa desde bandeja en
   * /usuarios. Workflow: pendiente → info_solicitada / aprobada / rechazada /
   * caducada. Ver solicitudAccesoExterno.types.ts.
   */
  SOLICITUDES_ACCESO_EXTERNO: 'solicitudesAccesoExterno',
  /**
   * Sesiones activas del sistema · tracking custom porque Firebase Auth no
   * tiene listado nativo. Permite UI "Sesiones activas" en Ficha 360 y
   * "Desconectar todas" desde admin. Ver sesion.types.ts.
   * Doc id: sessionId UUID generado al login.
   */
  SESSIONS: 'sessions',

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

  // === chk5.D-S1f · Caja Recaudadora (D5 + D12 · 2026-05-15) ===
  /**
   * Eventos atomicos de Caja Recaudadora (cobros entrantes + servicios
   * descontados). Cada evento es FK a productoFinanciero con tipoProducto
   * 'caja_recaudadora'. Ver eventoServicioRecaudador.types.ts.
   */
  EVENTOS_SERVICIO_RECAUDADOR: 'eventosServicioRecaudador',
  /**
   * Documentos de liquidacion periodica de Caja Recaudadora (transfiere
   * saldo neto del periodo al banco destino · consolida cobros − servicios).
   * Ver eventoServicioRecaudador.types.ts::LiquidacionRecaudadora.
   */
  LIQUIDACIONES_RECAUDADORA: 'liquidacionesRecaudadora',
} as const;

/** Tipo union de todos los nombres de colección */
export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];
