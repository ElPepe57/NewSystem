import type { Timestamp } from 'firebase/firestore';
import type { TipoProductoSnapshot } from './tipoProducto.types';
import type { CategoriaSnapshot } from './categoria.types';
import type { EtiquetaSnapshot } from './etiqueta.types';

// ============================================
// TIPOS DE PRODUCTO (Ya existentes)
// ============================================

export type Presentacion =
  | 'tabletas'
  | 'gomitas'
  | 'capsulas'
  | 'capsulas_blandas'
  | 'polvo'
  | 'liquido';

export type EstadoProducto = 'activo' | 'inactivo' | 'descontinuado' | 'eliminado';

// ============================================
// ATRIBUTOS SKINCARE (SKC)
// ============================================

export type TipoProductoSKC =
  | 'serum'
  | 'crema'
  | 'tonico'
  | 'limpiador'
  | 'aceite_limpiador'
  | 'exfoliante'
  | 'mascarilla'
  | 'protector_solar'
  | 'esencia'
  | 'ampolla'
  | 'contorno_ojos'
  | 'bruma'
  | 'balsamo'
  | 'parches'
  | 'peeling'
  | 'mist'
  | 'otro';

export type PasoRutinaSKC =
  | 'limpieza_aceite'
  | 'limpieza_agua'
  | 'exfoliacion'
  | 'tonificacion'
  | 'esencia'
  | 'serum_tratamiento'
  | 'mascarilla'
  | 'contorno_ojos'
  | 'hidratacion'
  | 'proteccion_solar';

export type TexturaSKC =
  | 'gel'
  | 'crema'
  | 'aceite'
  | 'espuma'
  | 'stick'
  | 'parche'
  | 'polvo'
  | 'agua'
  | 'balsamo'
  | 'locion'
  // S3.5 (2026-05-05) · Onda 2 · agregado tras feedback usuario · sérum es textura propia
  | 'serum';

export interface AtributosSkincare {
  tipoProductoSKC: TipoProductoSKC;
  /** @deprecated S3.2 · usar `Producto.contenidoNeto` (campo cross-línea) · era el mismo dato */
  volumen: string;
  /** @deprecated S3.2 · usar `Producto.contenidoNeto.unidad` (cross-línea) */
  unidadMedida?: 'ml' | 'g' | 'oz' | 'unidades';
  ingredienteClave?: string;
  ingredientesSecundarios?: string[];
  lineaProducto?: string;
  tipoPiel?: string[];
  preocupaciones?: string[];
  pasoRutina?: PasoRutinaSKC;
  textura?: TexturaSKC;
  zonaAplicacion?: string[];
  spf?: number;
  pa?: string;
  pao?: number;
}

// Labels para UI
export const TIPO_PRODUCTO_SKC_LABELS: Record<TipoProductoSKC, string> = {
  serum: 'Serum',
  crema: 'Crema',
  tonico: 'Tónico',
  limpiador: 'Limpiador',
  aceite_limpiador: 'Aceite Limpiador',
  exfoliante: 'Exfoliante',
  mascarilla: 'Mascarilla',
  protector_solar: 'Protector Solar',
  esencia: 'Esencia',
  ampolla: 'Ampolla',
  contorno_ojos: 'Contorno de Ojos',
  bruma: 'Bruma Facial',
  balsamo: 'Bálsamo',
  parches: 'Parches',
  peeling: 'Peeling',
  mist: 'Mist',
  otro: 'Otro',
};

export const PASO_RUTINA_LABELS: Record<PasoRutinaSKC, string> = {
  limpieza_aceite: 'Limpieza (Aceite)',
  limpieza_agua: 'Limpieza (Agua)',
  exfoliacion: 'Exfoliación',
  tonificacion: 'Tonificación',
  esencia: 'Esencia',
  serum_tratamiento: 'Serum / Tratamiento',
  mascarilla: 'Mascarilla',
  contorno_ojos: 'Contorno de Ojos',
  hidratacion: 'Hidratación',
  proteccion_solar: 'Protección Solar',
};

export const TEXTURA_LABELS: Record<TexturaSKC, string> = {
  gel: 'Gel',
  crema: 'Crema',
  aceite: 'Aceite',
  espuma: 'Espuma',
  stick: 'Stick',
  parche: 'Parche',
  polvo: 'Polvo',
  agua: 'Agua / Mist',
  balsamo: 'Bálsamo',
  locion: 'Loción',
  serum: 'Sérum',
};

export const TIPO_PIEL_OPTIONS = [
  'Todo tipo', 'Grasa', 'Seca', 'Mixta', 'Sensible', 'Madura', 'Con acné',
];

export const PREOCUPACIONES_OPTIONS = [
  // Textura y superficie
  'Acné', 'Puntos negros', 'Poros', 'Textura irregular', 'Oleosidad', 'Piel áspera',
  // Pigmentación
  'Manchas', 'Hiperpigmentación', 'Melasma', 'Marcas post-acné', 'Tono desigual', 'Piel opaca',
  // Anti-aging
  'Arrugas', 'Líneas finas', 'Flacidez', 'Firmeza', 'Pérdida de elasticidad', 'Patas de gallo',
  // Hidratación y barrera
  'Deshidratación', 'Hidratación', 'Piel seca', 'Barrera dañada', 'Descamación',
  // Sensibilidad
  'Rojeces', 'Rosácea', 'Irritación', 'Piel reactiva', 'Eczema', 'Dermatitis',
  // Zona de ojos
  'Ojeras', 'Bolsas', 'Párpados caídos',
  // Luminosidad
  'Luminosidad', 'Falta de brillo', 'Tez apagada',
  // Cicatrices
  'Cicatrices', 'Cicatrices de acné', 'Estrías',
  // Protección
  'Protección Solar', 'Daño solar', 'Fotoenvejecimiento',
  // Específicos
  'Exceso de sebo', 'Poros dilatados', 'Celulitis', 'Cuello y escote',
];

export const ZONA_APLICACION_OPTIONS = [
  'Rostro', 'Cuello', 'Escote', 'Contorno de ojos', 'Labios', 'Manos',
  'Cuerpo', 'Pies', 'Cuero cabelludo',
];

// ============================================
// ATRIBUTOS SUPLEMENTOS (SUP) — Fase E2
// ============================================
// Vocabulario cerrado documentado en mockup #41 v4 ("Estado A").
// Se almacena como ENUM hardcoded · sin Firestore.

/** Presentación SUP cerrada · 11 opciones (mockup #41 v4) */
export type PresentacionSUP =
  | 'capsulas'
  | 'capsulas_blandas'
  | 'tabletas'
  | 'gomitas'
  | 'polvo'
  | 'liquido'
  | 'sublingual'
  | 'spray_oral'
  | 'sticks_sobres'
  | 'goteros_tinctura'
  | 'barras';

export const PRESENTACION_SUP_LABELS: Record<PresentacionSUP, string> = {
  capsulas: 'Cápsulas',
  capsulas_blandas: 'Cápsulas blandas',
  tabletas: 'Tabletas',
  gomitas: 'Gomitas',
  polvo: 'Polvo',
  liquido: 'Líquido',
  sublingual: 'Sublingual',
  spray_oral: 'Spray oral',
  sticks_sobres: 'Sticks / sobres',
  goteros_tinctura: 'Goteros / tintura',
  barras: 'Barras',
};

/** Momento del día (multi-select cerrado · 6 opciones) */
export const MOMENTO_DIA_OPTIONS = [
  'Mañana', 'Tarde', 'Noche', 'Pre-entreno', 'Post-entreno', 'Cualquiera',
];

/** Toma con/sin comida (single-select cerrado · 4 opciones) */
export type TomaConComida = 'con_comida' | 'en_ayunas' | 'indiferente' | 'antes_dormir';

export const TOMA_CON_COMIDA_LABELS: Record<TomaConComida, string> = {
  con_comida: 'Con comida',
  en_ayunas: 'En ayunas',
  indiferente: 'Indiferente',
  antes_dormir: 'Antes de dormir',
};

/** Edad recomendada (single-select cerrado · 5 opciones) */
export type EdadRecomendada =
  | 'ninos_3_12'
  | 'adolescentes_13_17'
  | 'adultos_18'
  | 'adultos_mayores_60'
  | 'cualquier_edad';

export const EDAD_RECOMENDADA_LABELS: Record<EdadRecomendada, string> = {
  ninos_3_12: 'Niños (3-12)',
  adolescentes_13_17: 'Adolescentes (13-17)',
  adultos_18: 'Adultos (18+)',
  adultos_mayores_60: 'Adultos mayores (60+)',
  cualquier_edad: 'Cualquier edad',
};

/** Restricciones / certificaciones SUP (CHIPS creables · sugerencias rápidas) */
export const RESTRICCIONES_SUGERIDAS = [
  'Vegano', 'Sin gluten', 'Non-GMO', 'Kosher', 'Halal', 'Vegetariano',
  'Sin lactosa', 'Sin azúcar', 'Sin soya', 'Orgánico',
];

/** Sabores SUP más usados (CHIPS creables · sugerencias rápidas) */
export const SABORES_SUGERIDOS = [
  'Sin sabor', 'Limón', 'Frutos rojos', 'Vainilla', 'Chocolate', 'Naranja',
];

/** Atributos Suplementos · estructura denormalizada en el Producto */
export interface AtributosSuplementos {
  /**
   * @deprecated S3.4 (2026-05-04) · La presentación física (cápsulas/tabletas/polvo)
   * ahora se infiere de `producto.contenidoNeto.unidad`. Se mantiene en lectura para
   * productos legacy pero NO se renderiza en el wizard ni editor V2. Migración lazy:
   * cuando se edita un producto legacy con `presentacion='capsulas'` y la unidad de
   * `contenidoNeto` ya cubre el caso, este campo se ignora silenciosamente.
   */
  presentacion?: PresentacionSUP;            // CERRADO single
  momentoDia?: string[];                     // CERRADO multi
  tomaConComida?: TomaConComida;             // CERRADO single
  edadRecomendada?: EdadRecomendada;         // CERRADO single
  restricciones?: string[];                  // CHIPS creables (free)
  sabor?: string;                            // single string (legacy compat)
  advertencias?: string;                     // TEXTAREA
  /** Composición / ingredientes activos por serving · ej. "5000 IU D3 + 100 mcg K2 (MK-7)" · S3.2 movido desde top-level */
  dosaje?: string;
}

// ============================================
// CONTENIDO NETO (cross-línea · S3.2)
// ============================================

/**
 * Contenido neto del envase · campo único cross-línea (S3.2 · 2026-05-03).
 *
 * Reemplaza el ex-`AtributosSkincare.volumen` + `AtributosSkincare.unidadMedida`
 * (ahora @deprecated) por un campo unificado que aplica a TODAS las líneas:
 *   - SKC: 50 ml · 30 ml · 100 g
 *   - SUP: 90 cápsulas · 60 tabletas · 250 g polvo
 *   - Apparel: 1 unidad
 *   - Alimentos: 500 g · 1 kg
 *
 * El campo legacy `Producto.contenido` (string) se conserva para retrocompat
 * pero las nuevas creaciones usan `contenidoNeto` estructurado.
 */
export type UnidadContenido =
  | 'ml'
  | 'g'
  | 'oz'
  | 'fl_oz'
  | 'kg'
  | 'lb'
  | 'capsulas'
  | 'tabletas'
  | 'gomitas'
  | 'sobres'
  | 'sticks'
  | 'scoops'
  | 'unidades'
  | 'pares';

export const UNIDAD_CONTENIDO_LABELS: Record<UnidadContenido, string> = {
  ml: 'ml',
  g: 'g',
  oz: 'oz',
  fl_oz: 'fl oz',
  kg: 'kg',
  lb: 'lb',
  capsulas: 'cápsulas',
  tabletas: 'tabletas',
  gomitas: 'gomitas',
  sobres: 'sobres',
  sticks: 'sticks',
  scoops: 'scoops',
  unidades: 'unidades',
  pares: 'pares',
};

/**
 * S3.4 (2026-05-04) · Unidades discretas: cuando el contenido se mide en
 * piezas contables (cápsulas, tabletas, gomitas, sobres, sticks, scoops),
 * la duración del envase es directa: contenido / servings/día.
 * Para unidades continuas (ml/g/lb) se requiere `dosaje` para calcular.
 */
export const UNIDADES_DISCRETAS_SUP: ReadonlyArray<UnidadContenido> = [
  'capsulas', 'tabletas', 'gomitas', 'sobres', 'sticks', 'scoops',
] as const;

/** S3.4 · Unidades válidas para suplementos. */
export const UNIDADES_SUP: ReadonlyArray<UnidadContenido> = [
  'capsulas', 'tabletas', 'gomitas', 'sobres', 'sticks', 'scoops',
  'g', 'ml', 'lb', 'oz',
] as const;

/** S3.4 · Unidades válidas para skincare. */
export const UNIDADES_SKC: ReadonlyArray<UnidadContenido> = [
  'ml', 'g', 'oz', 'fl_oz',
] as const;

/** S3.4 · Unidades válidas para apparel. */
export const UNIDADES_APPAREL: ReadonlyArray<UnidadContenido> = [
  'unidades', 'pares',
] as const;

/** S3.4 · Unidades válidas para alimentos. */
export const UNIDADES_ALIMENTOS: ReadonlyArray<UnidadContenido> = [
  'g', 'kg', 'ml', 'oz', 'lb',
] as const;

export interface ContenidoNeto {
  valor: number;
  unidad: UnidadContenido;
}

// ============================================
// MARKETING COMERCIAL (S3.2 · IA · DEUDA-IA-001)
// ============================================

/**
 * Marketing comercial generado por IA · 3 niveles (S3.2 · 2026-05-03).
 *
 * Implementa DEUDA-IA-001 declarada en MEMORY.md:
 *   - Generación con Gemini Flash 2.0 vía Cloud Function `generarDescripcionProducto`
 *   - Compliance DIGEMID/INDECOPI integrado en prompt (sin claims terapéuticos)
 *   - Disclaimer auto en SUP
 *   - Auditoría por campo (ia/manual/mixto) + timestamps
 *   - Botón "Generar con IA" deshabilitado hasta tener Sec.1-5 completas
 */

/** Fuente del campo marketing · permite trackear origen */
export type FuenteMarketing = 'ia' | 'manual' | 'mixto';

/**
 * Audit info de un campo marketing.
 *
 * - `generadoEn` = última vez que IA produjo el contenido (timestamp)
 * - `editadoEn` = última edición manual del usuario (timestamp)
 * - Si edición manual diverge ≥30% del texto generado → `fuente` pasa a 'mixto'
 */
export interface MarketingFieldAudit<T = string> {
  texto: T;
  fuente: FuenteMarketing;
  generadoEn?: Timestamp;
  editadoEn?: Timestamp;
  generadoPor?: string;     // userId
  editadoPor?: string;      // userId
}

/**
 * Estructura completa de marketing comercial · 3 niveles.
 *
 * Cada nivel trackea su propia auditoría: un usuario puede generar todo
 * con IA y después editar manualmente solo el tagline → tagline pasa a
 * 'mixto' pero beneficios y descripción siguen 'ia'.
 */
export interface DescripcionMarketing {
  /** Nivel 1 · Hook ~10-15 palabras · listings, ads, MercadoLibre título extendido · arranca con keyword principal */
  tagline: MarketingFieldAudit<string>;
  /** Nivel 2 · 3-5 bullets escaneables · página producto, banners, redes */
  beneficios: MarketingFieldAudit<string[]>;
  /** Nivel 3 · 2-3 párrafos persuasivos · ~120-180 palabras · marketplaces, fichas · primer párrafo carga keyword principal + LSI */
  descripcion: MarketingFieldAudit<string>;
  /**
   * S3.4 (2026-05-04) · Keywords objetivo para SEO orgánico Google + Mercado Libre.
   * 5-10 frases largas (long-tail) generadas por la IA desde marca + ingrediente
   * clave + tipo + beneficios. Usables en meta-tags, sitemap, palabras clave
   * de Mercado Libre, atributos schema.org. NO requiere edición manual.
   */
  keywordsSEO?: MarketingFieldAudit<string[]>;
}

// ============================================
// INVESTIGACIÓN DE MERCADO
// ============================================

/**
 * Registro histórico de precios para análisis de tendencias
 */
export interface HistorialPrecio {
  fecha: Timestamp;
  precioUSAPromedio: number;
  precioUSAMin: number;
  precioPERUPromedio: number;
  precioPERUMin: number;
  margenEstimado: number;
  tipoCambio: number;
}

/**
 * Alerta automática del sistema
 */
export interface AlertaInvestigacion {
  id: string;
  tipo: 'vigencia' | 'margen_bajo' | 'precio_competidor' | 'sin_stock';
  mensaje: string;
  severidad: 'info' | 'warning' | 'danger';
  fecha: Timestamp;
  leida: boolean;
  datos?: Record<string, any>;
}

/**
 * Proveedor USA para investigación de mercado
 */
export interface ProveedorUSA {
  id: string;
  nombre: string;                  // "Amazon", "iHerb", "Vitacost", etc.
  precio: number;                  // Precio en USD
  impuesto?: number;               // Porcentaje de impuesto USA (sales tax), ej: 8.25
  url?: string;                    // Link al producto
  disponibilidad?: 'en_stock' | 'bajo_stock' | 'sin_stock' | 'desconocido';
  envioEstimado?: number;          // Costo de envío estimado USD
  notas?: string;
  fechaConsulta: Timestamp;
}

/**
 * Competidor en Perú para investigación de mercado
 */
export interface CompetidorPeru {
  id: string;
  nombre: string;                  // Nombre del vendedor o tienda
  plataforma: 'mercado_libre' | 'web_propia' | 'inkafarma' | 'mifarma' | 'otra';
  precio: number;                  // Precio en PEN
  url?: string;                    // Link al producto
  ventas?: number;                 // Ventas mensuales estimadas (si está disponible)
  reputacion?: 'excelente' | 'buena' | 'regular' | 'mala' | 'desconocida';
  esLiderCategoria?: boolean;
  notas?: string;
  fechaConsulta: Timestamp;
}

/**
 * Investigación de mercado para un producto
 * Permite analizar precios USA vs Perú y calcular viabilidad
 */
export interface InvestigacionMercado {
  // Identificación
  id: string;
  productoId: string;

  // === PROVEEDORES USA ===
  proveedoresUSA: ProveedorUSA[];  // Lista de proveedores con precios
  precioUSAMin: number;            // Calculado: mínimo de proveedores
  precioUSAMax: number;            // Calculado: máximo de proveedores
  precioUSAPromedio: number;       // Calculado: promedio ponderado
  proveedorRecomendado?: string;   // ID del proveedor recomendado (mejor precio)
  fuenteUSA?: string;              // DEPRECADO: mantener para compatibilidad

  // === COMPETENCIA PERÚ ===
  competidoresPeru: CompetidorPeru[];  // Lista de competidores
  precioPERUMin: number;           // Calculado: mínimo de competidores
  precioPERUMax: number;           // Calculado: máximo de competidores
  precioPERUPromedio: number;      // Calculado: promedio ponderado
  competidorPrincipal?: string;    // ID del competidor principal (más ventas)
  fuentePeru?: string;             // DEPRECADO: mantener para compatibilidad

  // === ANÁLISIS DE COMPETENCIA ===
  presenciaML: boolean;            // ¿Hay competencia en ML?
  numeroCompetidores: number;      // Calculado: competidoresPeru.length
  vendedorPrincipal?: string;      // DEPRECADO: usar competidorPrincipal
  nivelCompetencia: 'baja' | 'media' | 'alta' | 'saturada';
  ventajasCompetitivas?: string;   // ¿Qué ventajas tendríamos?

  // === ESTIMACIONES ===
  // Fase H+ · ctruEstimado/precioSugeridoCalculado/margenEstimado son LEGACY.
  // Ya NO se guardan en nuevas investigaciones · el frontend V2 calcula en
  // vivo vía calcularInvestigacion(). Quedan tipados como required SOLO para
  // no romper código legacy V1 (ProductoCard antiguo, venta.service). Para
  // docs nuevos siempre llegan en 0 (default desde Firestore al leer undefined).
  /** @deprecated Fase H+ · usar calcularInvestigacion(p).costoPEN */
  ctruEstimado: number;
  logisticaEstimada: number;
  /** @deprecated Fase H+ · usar calcularInvestigacion(p).precioReferencia */
  precioSugeridoCalculado: number;
  /** @deprecated Fase H+ · usar calcularInvestigacion(p).margenPct */
  margenEstimado: number;
  /** @deprecated Fase H+ · usar calcularInvestigacion(p).precioReferencia */
  precioEntrada?: number;

  // === DEMANDA ===
  demandaEstimada: 'baja' | 'media' | 'alta';
  tendencia: 'subiendo' | 'bajando' | 'estable';
  volumenMercadoEstimado?: number; // Unidades mensuales estimadas en el mercado

  // === RECOMENDACIÓN ===
  recomendacion: 'importar' | 'investigar_mas' | 'descartar';
  razonamiento?: string;
  puntuacionViabilidad?: number;   // 0-100 calculado automáticamente

  // === VIGENCIA ===
  fechaInvestigacion: Timestamp;
  vigenciaHasta: Timestamp;        // +60 días por defecto
  estaVigente?: boolean;           // Calculado

  // === NOTAS ===
  notas?: string;

  // === HISTORIAL Y ALERTAS ===
  historialPrecios: HistorialPrecio[];    // Historial de cambios de precios
  alertas: AlertaInvestigacion[];          // Alertas automáticas generadas

  // === AUDITORÍA ===
  realizadoPor: string;
  fechaCreacion: Timestamp;
  ultimaActualizacion?: Timestamp;
}

/**
 * Datos de proveedor para el formulario (sin Timestamp)
 */
export interface ProveedorUSAFormData {
  id: string;
  proveedorId?: string;            // ID del proveedor en Gestor Maestro (si está vinculado)
  nombre: string;
  precio: number;
  impuesto?: number;               // Porcentaje de impuesto USA (sales tax), ej: 8.25
  url?: string;
  disponibilidad?: 'en_stock' | 'bajo_stock' | 'sin_stock' | 'desconocido';
  envioEstimado?: number;
  notas?: string;
}

/**
 * Datos de competidor para el formulario (sin Timestamp)
 */
export interface CompetidorPeruFormData {
  id: string;
  competidorId?: string;  // ID del competidor en Gestor Maestro
  nombre: string;
  plataforma: 'mercado_libre' | 'web_propia' | 'inkafarma' | 'mifarma' | 'falabella' | 'amazon' | 'otra';
  precio: number;
  url?: string;
  ventas?: number;
  reputacion?: 'excelente' | 'buena' | 'regular' | 'mala' | 'desconocida';
  esLiderCategoria?: boolean;
  notas?: string;
}

/**
 * Datos para crear/actualizar una investigación
 */
export interface InvestigacionFormData {
  // Proveedores USA (lista)
  proveedoresUSA: ProveedorUSAFormData[];

  // Competidores Perú (lista)
  competidoresPeru: CompetidorPeruFormData[];

  // Precios calculados (se llenan automáticamente pero se pueden sobreescribir)
  precioUSAMin?: number;
  precioUSAMax?: number;
  precioUSAPromedio?: number;
  precioPERUMin?: number;
  precioPERUMax?: number;
  precioPERUPromedio?: number;

  // Análisis de competencia
  presenciaML: boolean;
  nivelCompetencia: 'baja' | 'media' | 'alta' | 'saturada';
  ventajasCompetitivas?: string;

  // Estimaciones manuales (opcionales, se calculan si no se proveen)
  logisticaEstimada?: number;

  // Demanda
  demandaEstimada: 'baja' | 'media' | 'alta';
  tendencia: 'subiendo' | 'bajando' | 'estable';
  volumenMercadoEstimado?: number;

  // Recomendación
  recomendacion: 'importar' | 'investigar_mas' | 'descartar';
  razonamiento?: string;

  // Notas
  notas?: string;
}

/**
 * Análisis de punto de equilibrio
 */
export interface PuntoEquilibrio {
  /** Unidades a vender para recuperar la inversión (ingresos = inversión) */
  unidadesParaRecuperarCapital: number;
  /** Unidades a vender para que ganancia acumulada = inversión (ROI 100%) */
  unidadesParaROI100: number;
  /** Inversión total (unidades × CTRU) */
  inversionTotal: number;
  /** Ganancia por unidad (precio venta - CTRU) */
  gananciaUnitaria: number;
  /** Meses para recuperar capital (ingresos = inversión) */
  tiempoRecuperacionCapital: number;
  /** Meses para ROI 100% */
  tiempoROI100: number;
  /** % rentabilidad mensual estimada */
  rentabilidadMensual?: number;
  /** Ganancia total si se vende todo el inventario */
  gananciaTotalPotencial: number;
  /** ROI total si se vende todo (ganancia total / inversión × 100) */
  roiTotalPotencial: number;
  /** @deprecated usar unidadesParaRecuperarCapital */
  unidadesNecesarias: number;
  /** @deprecated usar tiempoRecuperacionCapital */
  tiempoRecuperacion: number;
}

/**
 * Resumen de investigación para mostrar en cards
 */
export interface InvestigacionResumen {
  tieneInvestigacion: boolean;
  estaVigente: boolean;
  diasRestantes?: number;
  precioUSAPromedio?: number;
  precioPERUPromedio?: number;
  margenEstimado?: number;
  recomendacion?: 'importar' | 'investigar_mas' | 'descartar';
  fechaInvestigacion?: Date;
  alertasActivas?: number;           // Cantidad de alertas no leídas
  tendenciaPrecio?: 'subiendo' | 'bajando' | 'estable';  // Tendencia del historial
}

// ============================================
// PRODUCTO PACK / KIT (TAREA-105)
// ============================================

/**
 * Componente dentro de un Producto Pack/Kit.
 *
 * Dos modalidades según si `productoId` está presente:
 *   - VINCULADO (productoId definido): referencia a un Producto del catálogo.
 *     Habilita reporting cruzado (ventas sueltas + dentro de packs).
 *     Debe compartir línea de negocio con el pack que lo contiene.
 *   - EXCLUSIVO (productoId ausente): texto libre. El componente solo existe
 *     dentro del pack (ej: edición limitada, mini no vendida suelta).
 *
 * Decisiones de negocio TAREA-105 (D-PACK-01 a D-PACK-08):
 *   - Sin anidamiento: un pack no puede contener otro pack.
 *   - Vender el pack NO descuenta stock de componentes vinculados
 *     (son unidades físicas distintas).
 */
export interface ComponentePack {
  /** Nombre visible del componente (siempre presente). */
  nombre: string;
  /** Cantidad del componente dentro del pack. */
  cantidad: number;
  /** Presentación del componente (ej: "30ml", "60 caps"). Opcional. */
  presentacion?: string;
  /** Notas adicionales (ej: "versión mini", "edición limitada"). */
  notas?: string;

  // === VINCULADO ===
  /** Si está presente, es un componente vinculado a un Producto del catálogo. */
  productoId?: string;
  /** Snapshot del SKU del producto vinculado (denormalizado). */
  sku?: string;
  /** Snapshot de la marca del producto vinculado (denormalizado). */
  marca?: string;

  // === IDENTIFICACIÓN EXTENDIDA (SUP) ===
  /** Dosaje (ej: "1000mg"). */
  dosaje?: string;
  /** Contenido total (ej: "60 cápsulas"). */
  contenido?: string;
  /** Sabor (ej: "Limón", "Natural"). */
  sabor?: string;

  // === IDENTIFICACIÓN EXTENDIDA (SKC) ===
  /** Atributos Skincare: snapshot para vinculados, input libre para exclusivos. */
  atributosSkincare?: {
    tipoProductoSKC?: TipoProductoSKC;
    volumen?: string;
    ingredienteClave?: string;
    textura?: TexturaSKC;
    spf?: number;
    pa?: string;
    lineaProducto?: string;
  };
}

export interface Producto {
  id: string;
  sku: string;
  marca: string;
  marcaId?: string;    // Referencia a la entidad Marca en el Gestor Maestro
  nombreComercial: string;
  presentacion: Presentacion;
  dosaje: string;
  contenido: string;

  // ======== CLASIFICACION LEGACY (mantener para compatibilidad) ========
  /** @deprecated Usar categorias[] en su lugar. Se mantiene para compatibilidad */
  grupo: string;
  /** @deprecated Usar tipoProducto en su lugar. Se mantiene para compatibilidad */
  subgrupo: string;

  // ======== NUEVA CLASIFICACION ========
  /**
   * Tipo de Producto (composicion/principio activo)
   * Agrupa productos que son "lo mismo" de diferentes marcas
   * Ej: "Aceite de Oregano", "Omega 3 EPA/DHA", "Sulfato de Zinc"
   */
  tipoProductoId?: string;
  tipoProducto?: TipoProductoSnapshot;

  /**
   * Categorias (areas de salud/beneficio)
   * Un producto puede tener MULTIPLES categorias (max 5)
   * Ej: ["Sistema Inmune", "Digestivo", "Antibacteriano"]
   */
  categoriaIds?: string[];
  categorias?: CategoriaSnapshot[];
  /** Categoria principal para display destacado */
  categoriaPrincipalId?: string;

  /**
   * Etiquetas (tags flexibles)
   * Para atributos, marketing y origen
   * Ej: ["vegano", "organico", "importado-usa", "best-seller"]
   */
  etiquetaIds?: string[];
  etiquetasData?: EtiquetaSnapshot[];

  codigoUPC: string;

  estado: EstadoProducto;
  fechaEliminacion?: any;
  eliminadoPor?: string;
  etiquetas: string[];

  // === COSTOS ===
  /**
   * CMV Promedio - Costo de Mercadería Vendida promedio de las unidades en stock
   * Antes llamado "ctruPromedio"
   */
  ctruPromedio: number;

  /**
   * @deprecated S3.2 · vive en envíos/OC dinámico (ruta + modalidad + peso)
   * Mantenido para retrocompat con productos existentes.
   */
  costoFleteInternacional?: number;

  /** Peso por unidad en libras (lb). Ej: 0.12, 1.5, 5.0 */
  pesoLibras?: number;

  // === ORIGEN Y LÍNEA DE NEGOCIO ===
  paisOrigen?: string;                    // País de origen del producto ('USA', 'China', 'Corea', 'Peru')
  lineaNegocioId?: string;                // ID de la línea de negocio
  lineaNegocioNombre?: string;            // Desnormalizado para display

  // === ATRIBUTOS SKINCARE (solo línea SKC) ===
  atributosSkincare?: AtributosSkincare;

  // === ATRIBUTOS SUPLEMENTOS (solo línea SUP) — Fase E2 ===
  atributosSuplementos?: AtributosSuplementos;

  // === CONTENIDO NETO (S3.2 · cross-línea) ===
  /** Cantidad real del envase · ml/g/oz para SKC · cápsulas/tabletas para SUP · unidades para Apparel · g/kg para Alimentos. Reemplaza al ex-`atributosSkincare.volumen`. */
  contenidoNeto?: ContenidoNeto;

  // === MARKETING COMERCIAL (S3.2 · IA · DEUDA-IA-001) ===
  /** Copy comercial 3 niveles (tagline + beneficios + descripción) generado por IA con auditoría por campo. Se genera al final del wizard una vez todas las secciones están completas. */
  descripcionMarketing?: DescripcionMarketing;

  // === STOCK ===
  /** @deprecated Usar stockOrigen para multi-país */
  stockUSA: number;
  stockPeru: number;
  stockTransito: number;
  stockReservado: number;
  stockDisponible: number;
  stockDisponiblePeru?: number; // Solo disponible_peru (lo que ML puede vender)
  stockPendienteML?: number;    // Unidades comprometidas en órdenes ML no procesadas aún
  stockEfectivoML?: number;     // stockDisponiblePeru - stockPendienteML (lo que se pushea a ML)

  stockMinimo: number;
  stockMaximo: number;

  rotacionPromedio: number;
  diasParaQuiebre: number;

  // === VARIANTES (modelo grupoVarianteId — hermanos iguales, sin jerarquía) ===
  /** ID compartido del grupo de variantes. Todos los hermanos tienen el mismo valor. */
  grupoVarianteId?: string;
  /** true = es el representante visual del grupo en listados y reportes */
  esPrincipalGrupo?: boolean;
  /** Label descriptivo de esta variante: "90 caps", "120 caps - Fresa" */
  varianteLabel?: string;

  // === LEGACY (mantener para backward compat, deprecar progresivamente) ===
  /** @deprecated Usar grupoVarianteId + esPrincipalGrupo */
  esPadre: boolean;
  /** @deprecated Usar grupoVarianteId + esPrincipalGrupo */
  esAgrupador?: boolean;
  /** @deprecated Usar grupoVarianteId */
  parentId?: string;
  /** @deprecated Usar grupoVarianteId */
  grupoId?: string;
  /** @deprecated Usar !!grupoVarianteId */
  esVariante?: boolean;

  // === SABOR ===
  /**
   * Sabor del producto (ej: "Limón", "Fresa", "Natural", "Sin sabor")
   */
  sabor?: string;

  // === CICLO DE RECOMPRA ===
  /**
   * Frecuencia de consumo diario recomendada (ej: 1, 2, 3 veces al día)
   * El total de porciones se toma del campo "contenido"
   */
  servingsPerDay?: number;

  /**
   * Días estimados para que un cliente necesite recomprar este producto.
   * Se calcula automáticamente: (número en contenido) / servingsPerDay
   * Ej: "60 softgels" / 2 al día = 30 días
   */
  cicloRecompraDias?: number;

  // === INVESTIGACIÓN DE MERCADO ===
  investigacion?: InvestigacionMercado;

  // === PACK / KIT (TAREA-105) ===
  /**
   * true si este Producto es un Pack/Kit cerrado (cajita armada de fábrica,
   * no desarmable). Se compra y vende como un SKU normal; los componentes
   * son informativos y base para reporting cruzado.
   */
  esPack?: boolean;
  /** Componentes dentro del pack. Requerido cuando esPack=true (min 1). */
  componentesPack?: ComponentePack[];

  creadoPor: string;
  fechaCreacion: Timestamp;
  ultimaEdicion?: Timestamp;
}

export interface ProductoFormData {
  marca: string;
  marcaId?: string;    // Referencia a la entidad Marca en el Gestor Maestro
  nombreComercial: string;
  presentacion: Presentacion;
  dosaje: string;
  contenido: string;
  sabor?: string;      // Sabor del producto (ej: "Limón", "Fresa", "Natural")

  // ======== CLASIFICACION LEGACY (mantener para compatibilidad) ========
  /** @deprecated Usar categoriaIds en su lugar */
  grupo: string;
  /** @deprecated Usar tipoProductoId en su lugar */
  subgrupo: string;

  // ======== NUEVA CLASIFICACION ========
  /** Tipo de Producto (composicion/principio activo) */
  tipoProductoId?: string;
  /** IDs de categorias seleccionadas (max 5) */
  categoriaIds?: string[];
  /** Categoria principal para display destacado */
  categoriaPrincipalId?: string;
  /** IDs de etiquetas seleccionadas */
  etiquetaIds?: string[];

  codigoUPC: string;
  stockMinimo: number;
  stockMaximo: number;
  /** @deprecated S3.2 · vive en envíos/OC · ya no se llena en wizard nuevo */
  costoFleteInternacional?: number;
  pesoLibras?: number;                      // Peso por unidad en libras (lb)
  paisOrigen?: string;                      // País de origen del producto
  lineaNegocioId?: string;                  // ID de la línea de negocio

  // === ATRIBUTOS SKINCARE (solo línea SKC) ===
  atributosSkincare?: AtributosSkincare;

  // === ATRIBUTOS SUPLEMENTOS (solo línea SUP) — Fase E2 ===
  atributosSuplementos?: AtributosSuplementos;

  // === CONTENIDO NETO (S3.2 · cross-línea) ===
  contenidoNeto?: ContenidoNeto;

  // === MARKETING COMERCIAL (S3.2 · IA) ===
  descripcionMarketing?: DescripcionMarketing;

  // === CICLO DE RECOMPRA ===
  /**
   * Frecuencia de consumo diario (el total de porciones se toma del campo "contenido")
   */
  servingsPerDay?: number;

  /**
   * Días estimados para que un cliente necesite recomprar este producto.
   * Se calcula automáticamente: (número en contenido) / servingsPerDay
   */
  cicloRecompraDias?: number;

  // === VARIANTES ===
  grupoVarianteId?: string;     // ID compartido del grupo
  esPrincipalGrupo?: boolean;   // Representante visual del grupo
  varianteLabel?: string;       // "90 caps", "200ml"
  // Legacy compat
  parentId?: string;
  grupoId?: string;
  esVariante?: boolean;

  // === PACK / KIT (TAREA-105) ===
  esPack?: boolean;
  componentesPack?: ComponentePack[];
}

// Los tipos de Unidad, EstadoUnidad, MovimientoUnidad, UnidadFormData
// están definidos en unidad.types.ts (fuente canónica)