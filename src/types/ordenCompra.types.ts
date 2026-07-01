import type { Timestamp } from 'firebase/firestore';
import type { AtributosSkincare } from './producto.types';

// Estado logístico de la orden (ciclo de vida del producto físico)
export type EstadoOrden =
  | 'borrador'          // Creada pero no enviada
  | 'confirmada'        // OC aprobada, unidades creadas en estado 'pedida', Envio T1 creado
  | 'en_proceso'        // Al menos una unidad salio de 'pedida' (en transito)
  | 'despachada'        // Todas las unidades salieron del proveedor
  | 'completada'        // Todas las unidades llegaron a destino
  | 'cancelada'         // Cancelada
  // Legacy (backward compat — no usar en codigo nuevo)
  | 'enviada'           // Legacy: equivale a confirmada
  | 'en_transito'       // Legacy: equivale a en_proceso
  | 'recibida_parcial'  // Legacy: equivale a en_proceso
  | 'recibida';         // Legacy: equivale a completada

// Estado de pago (independiente del estado logístico)
export type EstadoPagoOC =
  | 'pendiente'     // No pagada
  | 'parcial'       // Pagada parcialmente (normalizado: antes 'pago_parcial')
  | 'pagado';       // Pago completado (normalizado: antes 'pagada')

/** Normaliza estados legacy de Firestore al formato canónico */
export function normalizarEstadoPagoOC(estado: string): EstadoPagoOC {
  if (estado === 'pagada') return 'pagado';
  if (estado === 'pago_parcial') return 'parcial';
  if (estado === 'pendiente_pago') return 'pendiente';
  return estado as EstadoPagoOC;
}

export type TipoProveedor =
  | 'fabricante'
  | 'distribuidor'
  | 'mayorista'
  | 'minorista';

// ========== SRM - EVALUACIÓN DE PROVEEDORES ==========

/**
 * Clasificación de proveedor basada en evaluación
 */
export type ClasificacionProveedor =
  | 'preferido'     // >=80 pts, sin problemas recientes
  | 'aprobado'      // 60-79 pts
  | 'condicional'   // 40-59 pts, requiere seguimiento
  | 'suspendido';   // <40 pts o problemas graves

/**
 * Factores de evaluación del proveedor (0-25 cada uno)
 */
export interface FactoresEvaluacionProveedor {
  calidadProductos: number;     // 0-25 (% sin defectos)
  puntualidadEntrega: number;   // 0-25 (% entregas a tiempo)
  competitividadPrecios: number;// 0-25 (vs mercado)
  comunicacion: number;         // 0-25 (manual/override)
}

/**
 * Evaluación del proveedor
 */
export interface EvaluacionProveedor {
  puntuacion: number;             // 0-100 (calculado)
  clasificacion: ClasificacionProveedor;
  factores: FactoresEvaluacionProveedor;
  ultimoCalculo: Timestamp;
  calculoAutomatico: boolean;     // false si fue override manual
}

/**
 * Historial de evaluación del proveedor
 */
export interface HistorialEvaluacionProveedor {
  fecha: Timestamp;
  puntuacion: number;
  factores: FactoresEvaluacionProveedor;
  notas?: string;
  evaluadoPor: string;
}

/**
 * Métricas del proveedor para evaluación
 */
export interface MetricasProveedor {
  ordenesCompra: number;
  montoTotalUSD: number;
  ultimaCompra?: Timestamp;
  productosComprados: string[];
  // Métricas de evaluación automática
  ordenesCompletadas: number;
  ordenesConProblemas: number;
  tasaProblemas: number;            // %
  tiempoEntregaPromedioDias: number;
  desviacionTiempoEntrega: number;  // días
  // Métricas de investigación
  productosAnalizados?: number;
  precioPromedio?: number;
  ultimaInvestigacion?: Timestamp;
}

export interface Proveedor {
  id: string;
  codigo: string;                    // PRV-001, PRV-002, etc.
  lineaNegocioIds?: string[];        // Líneas de negocio (si vacío = todas)
  nombre: string;
  tipo: TipoProveedor;
  url: string;                       // URL del sitio web del proveedor (obligatorio)
  contacto?: string;                 // Nombre de contacto
  email?: string;
  telefono?: string;
  direccion?: string;
  pais: string;
  notasInternas?: string;
  activo: boolean;

  // Métricas (desnormalizadas para reportes rápidos)
  metricas?: MetricasProveedor;

  // ========== SRM - Evaluación ==========
  evaluacion?: EvaluacionProveedor;
  evaluacionesHistorial?: HistorialEvaluacionProveedor[];

  // ========== F-DatosBanc · Datos bancarios pasivos (S58c) ==========
  // Lista de cuentas/billeteras del proveedor para hacerle pagos. NO trackea
  // saldo — solo es referencia. Si una cuenta empieza a recibir dinero del
  // negocio (caso agente recaudador), se puede promover a CuentaCaja.
  datosBancarios?: import('./tesoreria.types').DatoBancarioPasivo[];

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  ultimaEdicion?: Timestamp;
  editadoPor?: string;
}

/**
 * Snapshot de forecast comercial (Lente 2) congelado al CREAR la OC.
 * Expectativa del comprador en el momento de la decisión — INMUTABLE.
 * Puramente retrospectivo: NO entra al costo/CTRU/inventario (off money-path).
 * Se lee en el detalle de la OC ("¿la compra acertó?") vs. la realidad.
 * La fecha del congelado = fechaCreacion de la OC (no se re-guarda acá).
 * Todos los campos numéricos usan null (no undefined) para persistencia Firestore limpia.
 */
export interface ForecastSnapshot {
  /** PVP efectivo esperado (PEN) al comprar · null si no había investigación. */
  precioVentaEsperado: number | null;
  /** Margen % landed proyectado · null si no calculable. */
  margenProyectadoPct: number | null;
  /** Costo aterrizado/unidad estimado (PEN) · null si no calculable. */
  ctruEstimado: number | null;
  /** Score holístico de viabilidad 0-100 (analizarPrecio · 40/30/20/10). */
  scoreViabilidad: number;
  /** Delta % del costo negociado vs. la base histórica · null si sin base. */
  precioVsHistoricoPct: number | null;
  /** Origen de la base de comparación (honestidad del dato). */
  fuenteReferencia: 'historico' | 'mercado' | 'ninguna';
  /** TC USD→PEN usado en el análisis (el snapshot se lee con su propio TC). */
  tcCongelado: number;
}

export interface ProductoOrden {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  contenido?: string;        // Ej: "60 cápsulas", "500g"
  dosaje?: string;           // Ej: "150mg", "1000 UI"
  sabor?: string;            // Ej: "Limón", "Fresa", "Natural"
  atributosSkincare?: AtributosSkincare; // Solo para productos SKC
  codigoUPC?: string;       // Codigo UPC/EAN para escaneo en recepcion
  cantidad: number;
  costoUnitario: number;    // Precio por unidad en USD
  subtotal: number;         // cantidad × costoUnitario
  pesoLibras?: number;      // Peso por unidad en lb (desnormalizado del producto)
  cantidadRecibida?: number; // Acumulado de unidades recibidas (0 por defecto)
  // Viajero destino (para distribución multi-viajero)
  viajeroId?: string;       // ID del almacén tipo viajero
  viajeroNombre?: string;   // Nombre del viajero (desnormalizado)
  // Origen multi-requerimiento (tracking por cliente)
  origenRequerimientos?: Array<{
    requerimientoId: string;
    cotizacionId?: string;
    clienteNombre?: string;
    cantidad: number;
  }>;
  /** Lente 2 · forecast comercial congelado al crear la OC (retrospectivo · off money-path). */
  forecastSnapshot?: ForecastSnapshot;
}

/**
 * @deprecated S55 Fase 2 — Este tipo se reemplazó por `MovimientoCC` con
 * `tipo: 'credito_pago_oc'` en la nueva colección `movimientosCC`.
 *
 * Para nuevos consumidores, usar:
 *   - Hook reactivo: `usePagosOC(ocId)` desde `src/hooks/usePagosOC.ts`
 *   - Query directa: `getPagosOC(ocId)` desde `src/services/cuentaCorriente.adaptadores.ts`
 *
 * Este tipo se mantiene SOLO porque algunos consumers (UIs, services) aún no
 * fueron migrados. El adaptador `cuentaCorriente.adaptadores.ts` provee
 * `PagoOCLegacy` con la misma forma para compatibilidad. Borrar este tipo
 * cuando todos los consumers usen el modelo nuevo (probable Fase 8 o post).
 */
export interface PagoOrdenCompra {
  id: string;                       // PAG-OC-{timestamp}
  fecha: Timestamp;                 // Fecha real del pago

  // Moneda y montos
  monedaPago: 'USD' | 'PEN';       // Moneda en la que se pagó
  montoOriginal: number;            // Monto en la moneda de pago
  montoUSD: number;                 // Equivalente en USD
  montoPEN: number;                 // Equivalente en PEN

  // Tipo de cambio
  tipoCambio: number;               // TC usado para conversión

  // Cuenta y método
  metodoPago: string;               // transferencia_bancaria, zelle, paypal, etc.
  cuentaOrigenId?: string;          // ID de la cuenta de tesorería
  cuentaOrigenNombre?: string;      // Nombre de la cuenta (desnormalizado)

  // Referencias
  referencia?: string;              // Nro de operación, voucher, etc.
  notas?: string;

  // Tesorería
  movimientoTesoreriaId?: string;   // ID del movimiento en tesorería
  errorTesoreria?: boolean;          // true si falló el registro en tesorería
  errorTesoreriaMsg?: string;        // Mensaje de error para reconciliación

  // Pago masivo (trazabilidad de lote)
  lotePagoId?: string;
  esPagoMasivo?: boolean;

  // Sub-orden (pago vinculado a una sub-orden específica de la OC)
  subOrdenId?: string;

  // Auditoría
  registradoPor: string;
  fechaRegistro: Timestamp;
}

// ========== RECEPCIÓN PARCIAL ==========

export interface RecepcionParcial {
  id: string;                         // REC-{timestamp}
  fecha: Timestamp;
  numero: number;                     // Secuencial: 1, 2, 3...
  productosRecibidos: Array<{
    productoId: string;
    cantidadRecibida: number;         // Cuántas llegaron EN ESTA entrega
    cantidadAcumulada: number;        // Acumulado después de esta recepción
    cantidadDanada?: number;          // Cuántas llegaron dañadas
    cantidadPerdida?: number;         // Cuántas no llegaron (perdidas/faltantes)
  }>;
  unidadesGeneradas: string[];
  unidadesReservadas: string[];
  unidadesDisponibles: string[];
  unidadesDanadas?: string[];
  unidadesPerdidas?: string[];
  totalUnidadesRecepcion: number;
  totalUnidadesDanadas?: number;
  totalUnidadesPerdidas?: number;
  costoAdicionalPorUnidad: number;
  registradoPor: string;
  observaciones?: string;
  subOrdenId?: string;              // Si la recepción fue por sub-orden
}

export interface RecepcionParcialFormData {
  productosRecibidos: Array<{
    productoId: string;
    cantidadRecibida: number;
    cantidadDanada?: number;
    cantidadPerdida?: number;
  }>;
  observaciones?: string;
}

export interface OrdenCompra {
  id: string;
  numeroOrden: string;        // OC-2024-001
  
  // Proveedor
  proveedorId: string;
  nombreProveedor: string;
  
  // Productos
  productos: ProductoOrden[];
  
  // Totales
  subtotalUSD: number;                  // Suma de todos los productos (sin impuesto)
  // Fase A · el costo de cabecera vive en los arrays v2 (cargosOC/descuentosOC/impuestosOC).
  totalUSD: number;                     // subtotalUSD + Σcargos + Σimpuestos − Σdescuentos (v2)
  pesoTotalEstimadoLb?: number;         // SUM(pesoLibras × cantidad) de todos los productos

  // Modo de entrega
  modoEntrega?: 'viajero' | 'envio_directo'; // Cómo llega a Perú
  fleteIncluidoEnPrecio?: boolean;            // true = DDP (flete ya en costoUnitario)
  modoEntregaDetallado?: ModoEntregaDetallado;
  quienPagaFlete?: QuienPagaFlete;
  colaboradorTransporteId?: string;    // viajero o courier asignado
  colaboradorTransporteNombre?: string;
  // S42af — Recojo en origen: el colaborador ya tiene la mercadería al momento
  // de confirmar la OC (recogió del proveedor). El envío nace en estado
  // 'recibida_completa' y el inventario de la casilla destino se actualiza
  // inmediatamente, no después.
  recojoEnOrigen?: boolean;

  // Origen y línea de negocio
  paisOrigen?: string;             // País de origen del proveedor ('USA', 'China', 'Corea', 'Peru')
  lineaNegocioId?: string;         // Si todos los productos son de la misma línea
  lineaNegocioNombre?: string;

  // Tipo de Cambio
  tcReferencial?: number;     // TC del dia que se crea la OC (para estimar costos en PEN)
  tcCompra?: number;          // TC al momento de crear la orden (legacy alias de tcReferencial)
  tcPago?: number;            // TC al momento del pago real
  totalPEN?: number;          // totalUSD × tcPago

  // Diferencia cambiaria (si TC pago != TC compra)
  diferenciaCambiaria?: number;

  // ========== Sub-Ordenes (Acuerdo 5) ==========
  subOrdenes?: SubOrdenCompra[];

  // ========== Cargos y Descuentos del proveedor (Acuerdo 5) ==========
  cargosOC?: CargoOC[];
  descuentosOC?: DescuentoOC[];
  impuestosOC?: ImpuestoOC[];

  // Estados (logístico y financiero son independientes)
  estado: EstadoOrden;              // Estado logístico
  estadoPago: EstadoPagoOC;           // Estado de pago (independiente)

  // F4 · Autorización de egreso por SOCIO. Una OC cuyo total (totalUSD landed) supera el umbral
  // requiere doble firma de 2 socios distintos ANTES de poder pagarse (aunque el requerimiento de
  // origen ya esté aprobado · "el pago también necesita firma"). ≤ umbral = directo (sin este bloque).
  // Mismo modelo que Gastos/Requerimientos · autorizacionEgreso.helper como fuente única.
  autorizacion?: {
    estado: 'pendiente' | 'aprobado' | 'rechazado';
    firmas: { usuarioId: string; nombre?: string; fecha: Timestamp }[];
    solicitadaPor?: string;
    fechaSolicitud?: Timestamp;
    fechaAprobacion?: Timestamp;
    rechazadoPor?: string;
    motivoRechazo?: string;
    fechaRechazo?: Timestamp;
  };

  // Fechas logísticas
  fechaCreacion: Timestamp;
  fechaEnviada?: Timestamp;
  fechaEnTransito?: Timestamp;
  fechaRecibida?: Timestamp;

  // ── Saldos financieros denormalizados (S55 Fase 2) ──
  // La fuente de verdad ahora es la Cuenta Corriente del proveedor.
  // `montoPendiente` se actualiza automáticamente al registrar pagos vía
  // `registrarPago`. Decisión D-CC-8: estado denormalizado para queries.
  /** Saldo pendiente de pago en PEN (denormalizado · derivado de CC). */
  montoPendiente?: number;

  // CAMPOS LEGACY ELIMINADOS en S55 Fase 2 (movidos a movimientosCC):
  //   - fechaPago               → MovimientoCC.fecha del último pago
  //   - fechasPagoParcial[]     → MovimientoCC.fecha por cada pago
  //   - montosPagados[]         → MovimientoCC.monto por cada pago
  //   - historialPagos[]        → query movimientosCC con refDocumentoId=ocId
  //                                (usar `getPagosOC()` o hook `usePagosOC()`)

  // Tracking y logística
  numeroTracking?: string;
  courier?: string;
  almacenDestino?: string;        // ID del almacén (viajero)
  nombreAlmacenDestino?: string;  // Nombre del almacén para display
  
  // Información adicional
  observaciones?: string;
  documentos?: string[];      // URLs de facturas, etc.

  // ========== S41 — Deudor alternativo (Bloque 5) ==========
  // Si el colaborador adelanta el pago al proveedor (patron "Recojo en origen"),
  // la CxP se dirige al colaborador, no al proveedor. Estos campos permiten
  // distinguir quien es el acreedor real de la deuda comercial.
  //
  // Default (NO presente o deudorTipo='proveedor'): la deuda es con el proveedor
  //   (deudorId = proveedorId, deudorNombre = nombreProveedor)
  // Si deudorTipo='colaborador': la deuda es con el colaborador que adelanto
  //   (deudorId = colaboradorId, deudorNombre = nombre del colaborador)
  deudorId?: string;
  deudorNombre?: string;
  deudorTipo?: 'proveedor' | 'colaborador';

  // Inventario generado
  inventarioGenerado: boolean;
  unidadesGeneradas?: string[];  // IDs de las unidades creadas

  // ========== Recepciones Parciales (LEGACY pre-S37) ==========
  // @deprecated S40 — el flujo canónico de recepción es vía Envío (envio.recepcion.service).
  // Estos campos se preservan en el tipo solo para retrocompat con OCs históricas
  // que tengan data en ellos (contabilidad.service.ts los lee para reconocimiento de ingresos).
  // NO se escriben más desde la app (recibirOrdenParcial eliminado en S40).
  /** @deprecated Usar envio.recepciones[] del Envío asociado */
  recepcionesParciales?: RecepcionParcial[];
  /** @deprecated Usar envio.totalUnidadesRecibidas del Envío asociado */
  totalUnidadesRecibidas?: number;
  /** @deprecated Usar envio.fechaLlegadaReal o fecha de la primera recepción del envío */
  fechaPrimeraRecepcion?: Timestamp;

  // ========== Requerimiento de origen ==========
  // Si la OC se generó desde un requerimiento (singular - legacy)
  requerimientoId?: string;
  requerimientoNumero?: string;

  // ========== Soporte Multi-Requerimiento (OC Consolidada) ==========
  requerimientoIds?: string[];
  requerimientoNumeros?: string[];
  productosOrigen?: Array<{
    productoId: string;
    requerimientoId: string;
    requerimientoNumero: string;
    cotizacionId?: string;
    clienteNombre?: string;
    cantidad: number;
  }>;

  // ========== Expectativa vs Realidad ==========
  // Si viene de un requerimiento, guardar la expectativa para comparar
  expectativaRequerimiento?: {
    tcInvestigacion: number;          // TC al momento de investigar
    costoEstimadoUSD: number;         // Costo USD esperado
    costoEstimadoPEN: number;         // costoEstimadoUSD × tcInvestigacion
    impuestoEstimadoUSD?: number;     // Impuesto estimado
    fleteEstimadoUSD?: number;        // Flete estimado
    costoTotalEstimadoUSD: number;
    costoTotalEstimadoPEN: number;
    fechaInvestigacion?: Timestamp;
  };

  // Comparación con la realidad (se calcula al crear/pagar)
  comparacionExpectativa?: {
    diferenciaCostoUSD: number;       // costoReal - costoEstimado
    diferenciaCostoPEN: number;       // Considerando diferencia de TC
    diferenciaTC: number;             // tcCompra - tcInvestigacion
    diferenciaTCPago?: number;        // tcPago - tcCompra (si aplica)
    dentroPresupuesto: boolean;       // true si está dentro del 5% de tolerancia
    porcentajeDesviacion: number;     // % de desviación vs presupuesto
    razones?: string[];               // Razones de la diferencia
  };

  // Auditoría
  creadoPor: string;
  ultimaEdicion?: Timestamp;
  editadoPor?: string;
}

export interface OrdenCompraFormData {
  proveedorId: string;
  productos: Array<{
    productoId: string;
    sku: string;
    marca: string;
    nombreComercial: string;
    presentacion: string;
    cantidad: number;
    costoUnitario: number;
    subtotal: number;
    // Viajero destino (para distribución multi-viajero)
    viajeroId?: string;
    viajeroNombre?: string;
    // Lente 2 · snapshot de forecast congelado (se pasa-through a create() · off money-path)
    forecastSnapshot?: ForecastSnapshot;
  }>;
  subtotalUSD: number;
  totalUSD: number;
  tcCompra: number;
  modoEntrega?: 'viajero' | 'envio_directo';
  fleteIncluidoEnPrecio?: boolean;
  // Wizard V2 (Acuerdos 40-41)
  modoEntregaDetallado?: ModoEntregaDetallado;
  quienPagaFlete?: QuienPagaFlete;
  colaboradorTransporteId?: string;
  colaboradorTransporteNombre?: string;
  // S42af — Recojo en origen (disponibilidad inmediata en casilla)
  recojoEnOrigen?: boolean;
  cargosOC?: CargoOC[];
  descuentosOC?: DescuentoOC[];
  impuestosOC?: ImpuestoOC[];
  almacenDestino: string;
  // Origen y línea de negocio (auto-heredados de productos)
  paisOrigen?: string;
  lineaNegocioId?: string;
  lineaNegocioNombre?: string;
  numeroTracking?: string;
  courier?: string;
  observaciones?: string;
  requerimientoId?: string;   // Vinculación con requerimiento origen (singular)
  // S41 — Deudor alternativo (Bloque 5). Ver OrdenCompra arriba para semantica.
  deudorId?: string;
  deudorNombre?: string;
  deudorTipo?: 'proveedor' | 'colaborador';
  // Sub-órdenes (división de OC en órdenes separadas del proveedor)
  subOrdenes?: SubOrdenCompra[];
  // Soporte multi-requerimiento (OC consolidada)
  requerimientoIds?: string[];
  productosOrigen?: Array<{
    productoId: string;
    requerimientoId: string;
    cantidad: number;
    cotizacionId?: string;
    clienteNombre?: string;
  }>;
}

export interface CambioEstadoOrden {
  estadoAnterior: EstadoOrden;
  estadoNuevo: EstadoOrden;
  fecha: Timestamp;
  realizadoPor: string;
  motivo?: string;
  observaciones?: string;
  
  // Datos adicionales según el estado
  tcPago?: number;            // Si cambia a "pagada"
  numeroTracking?: string;    // Si cambia a "en_transito"
  courier?: string;           // Si cambia a "en_transito"
}

export interface OrdenCompraStats {
  totalOrdenes: number;
  borradores: number;
  enviadas: number;
  pagadas: number;
  enTransito: number;
  recibidasParcial: number;
  recibidas: number;
  canceladas: number;
  valorTotalUSD: number;
  valorTotalPEN: number;
}

export interface ProveedorFormData {
  nombre: string;
  lineaNegocioIds?: string[];
  tipo: TipoProveedor;
  url: string;                       // URL del sitio web (obligatorio)
  contacto?: string;                 // Nombre de contacto
  email?: string;
  telefono?: string;
  direccion?: string;
  pais: string;
  notasInternas?: string;
}

/**
 * Estadísticas de proveedores para dashboard
 */
export interface ProveedorStats {
  totalProveedores: number;
  proveedoresActivos: number;
  proveedoresPorPais: Record<string, number>;
  proveedoresPorTipo: Record<TipoProveedor, number>;
  proveedoresPorClasificacion: Record<ClasificacionProveedor, number>;
  topProveedoresPorCompras: Array<{
    proveedorId: string;
    nombre: string;
    ordenesCompra: number;
    montoTotalUSD: number;
    clasificacion?: ClasificacionProveedor;
  }>;
}

// ========== REINGENIERIA: Sub-Ordenes, Cargos, Descuentos ==========

/**
 * Sub-orden de compra — division de una OC matriz
 * Cada sub-orden tiene su propia referencia de proveedor y genera su propio Envio T1.
 */
export interface SubOrdenCompra {
  id: string;                          // SUB-{ocId}-{secuencial}
  referenciaProveedor: string;         // Numero de orden/factura del proveedor
  productos: ProductoOrden[];
  totalUSD: number;                    // subtotal productos + shipping + tax - descuento
  // Costos individuales por sub-orden
  descuentoUSD?: number;
  shippingUSD?: number;
  impuestoUSD?: number;
  subtotalProductosUSD?: number;
  // Ciclo de vida independiente
  // `recibida_parcial` = el envío 1:1 llegó incompleto (faltantes/retenidas).
  // La fuente de verdad de la recepción es el ENVÍO; la sub-orden lo refleja
  // (se sincroniza en envioRecepcionService.registrarRecepcion).
  estado?: 'borrador' | 'en_transito' | 'recibida_parcial' | 'recibida' | 'cancelado';
  estadoPago?: 'pendiente' | 'parcial' | 'pagado';
  // Contadores de recepción · mirror del envío vinculado (relación 1:1)
  totalUnidades?: number;              // unidades esperadas del envío
  unidadesRecibidas?: number;
  unidadesFaltantes?: number;
  unidadesDanadas?: number;
  numeroTracking?: string;
  courier?: string;
  fechaEnvio?: any;                    // Timestamp
  fechaRecepcion?: any;                // Timestamp
  // S55 Fase 2 — `fechaPago` eliminada. Última fecha de pago vive en
  // MovimientoCC.fecha (filtrar por refDocumentoId=ocId + heurística subId en notas).
  envioId?: string;
  envioNumero?: string;
}

/**
 * Cargo adicional en la OC (cobrado por el proveedor)
 */
export interface CargoOC {
  id: string;
  concepto: string;                    // "Shipping fee", "Handling fee", etc.
  montoUSD: number;
  metodoProrrateo: 'por_valor' | 'por_cantidad' | 'por_peso';
}

/**
 * Descuento en la OC (dado por el proveedor)
 */
export interface DescuentoOC {
  id: string;
  concepto: string;                    // "Subscribe & Save", "Bulk discount", etc.
  montoUSD: number;
  metodoProrrateo: 'por_valor' | 'por_cantidad' | 'proporcional';
}

// ========== Wizard V2 — Acuerdos 40-41 ==========

/** Modo de entrega detallado (Acuerdo 40) */
export type ModoEntregaDetallado =
  | 'ddp_directo'     // "Me lo traen directamente"
  | 'via_viajero'     // "Lo recoge un viajero"
  | 'via_courier'     // "Lo envían por courier"
  | 'recojo_propio';  // "Lo recojo yo"

/** Quién paga el flete (Acuerdo 40) */
export type QuienPagaFlete =
  | 'proveedor'    // "El proveedor lo incluye en el precio"
  | 'comprador'    // "Yo pago el flete por separado"
  | 'viajero';     // "El viajero cobra por llevarlo"

/** Impuesto de proveedor individual (Acuerdo 41) */
export interface ImpuestoOC {
  id: string;
  concepto: string;     // "Sales Tax CA", "VAT", etc.
  modo: 'porcentaje' | 'fijo';  // Dual: el usuario elige
  porcentaje?: number;  // Ej: 9.5 para 9.5% (cuando modo='porcentaje')
  montoUSD: number;     // Calculado si %, directo si fijo
}