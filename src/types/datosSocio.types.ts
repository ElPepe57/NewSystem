/**
 * datosSocio.types.ts · chk5.F2-SUB-PERFILES (2026-05-24)
 *
 * Sub-perfil "socio" del UserProfile · vive en
 * `/users/{uid}/private/datosSocio` (sub-colección privada).
 *
 * Captura los datos de participación del User en el negocio. SOLO aplica
 * si el user tiene el rol 'socio' (chk5.F1-MULTI-ROL).
 *
 * Modelo B + D7 (chk5.E-INV-PERF · 2026-05-24):
 * La participación NO se mide solo en cash · también en VALOR aportado.
 * Por eso este modelo soporta 3 tipos:
 *   - cash_puro · todo el aporte es monetario
 *   - mixta · cash + valor (lo más común)
 *   - valor_puro · silent partner · NO puso cash · trae cartera/marca/IP/etc
 *
 * Reemplaza el modelo previo de Socio (catálogo /socios separado) que
 * desaparece en Fase 2 a favor del modelo unificado users + sub-perfil.
 */

import { Timestamp } from 'firebase/firestore';

// ═════════════════════════════════════════════════════════════════════════
// PARTICIPACIÓN · NATURALEZA
// ═════════════════════════════════════════════════════════════════════════

/**
 * Tipo de participación del socio · canónico.
 *
 * - `cash_puro` · todo el aporte fue dinero · cap table proporcional al cash
 * - `mixta` · cash + valor (caso más común en PyMEs · ej: 60% por cash + know-how + CEO)
 * - `valor_puro` · NO puso cash · participación por aporte no-monetario (silent partner
 *   con cartera de clientes · marca personal · IP · etc)
 */
export type TipoParticipacionSocio = 'cash_puro' | 'mixta' | 'valor_puro';

/**
 * Tipos de aporte de valor NO-MONETARIO al negocio.
 * Multi-select · un socio puede aportar varios tipos simultáneamente.
 *
 * Lista finalizada en mockup canon v5.2 · NO ampliar sin discusión.
 */
export type TipoAporteValor =
  | 'know_how'                   // experiencia técnica · expertise vertical
  | 'gestion_ceo'                // CEO / gestión sin sueldo de mercado
  | 'networking_clientes'        // cartera de clientes · contactos comerciales
  | 'marca_personal'             // reputación · followers · cara visible
  | 'idea_original_ip'           // concepto del negocio · propiedad intelectual
  | 'tiempo_dedicacion'          // sweat equity · full-time sin sueldo proporcional
  | 'activos_no_monetarios'      // espacio físico · equipamiento · vehículo personal
  | 'otro';

/**
 * Detalle del aporte de valor cuando `tipoParticipacion === 'mixta' | 'valor_puro'`.
 */
export interface AporteDeValor {
  /** Tipos de valor aportado · multi-select de TipoAporteValor */
  tiposDeValor: TipoAporteValor[];

  /** Descripción libre del aporte · ej: "20 años en industria skincare · cartera 500 clientes" */
  descripcion: string;

  /**
   * Valuación estimada del aporte de valor en PEN · OPCIONAL.
   * Si el contador o el acuerdo de socios valuó el aporte, ingresarlo acá.
   * Permite calcular ROI ajustado y composición del cap table.
   * Si está vacío, el módulo Inversionistas muestra "—" en el slot de valor.
   */
  valuacionEstimadaPEN?: number;

  /**
   * Vesting · materialización del aporte con el tiempo. OPCIONAL.
   * Si está vacío, se asume vesting inmediato (100% desde día 1).
   */
  vesting?: VestingConfig;
}

/**
 * Configuración de vesting para aportes de valor.
 * Inspirado en startups · permite que el % de participación se materialice
 * gradualmente (típico cuando el aporte es tiempo · know-how · gestión).
 */
export interface VestingConfig {
  /** Tipo de vesting */
  tipoVesting: 'inmediato' | 'lineal' | 'cliff';

  /** Total de meses del período de vesting · obligatorio si tipo != inmediato */
  mesesVesting?: number;

  /**
   * Meses de cliff · período inicial sin vesting (obligatorio si tipo='cliff').
   * Ej: 12m cliff + 36m vesting · primer año (12m) acumula y vestea recién después.
   */
  mesesCliff?: number;

  /**
   * Fecha desde la cual empieza a contar el vesting · default = fechaIngresoNegocio.
   */
  fechaInicioVesting?: Timestamp;
}

// ═════════════════════════════════════════════════════════════════════════
// SUB-PERFIL DATOS SOCIO
// ═════════════════════════════════════════════════════════════════════════

/**
 * Sub-perfil de datos del socio dentro del UserProfile.
 *
 * Stored en `/users/{uid}/private/datosSocio`.
 *
 * Es el ÚNICO lugar canon donde viven los datos de socio a partir de Fase 2.
 * La colección `/socios` separada queda deprecada y se elimina post-migración.
 */
export interface DatosSocio {
  /** UID del UserProfile padre · espejo · facilita queries reverse */
  uid: string;

  /**
   * Porcentaje de participación en el negocio (0-100).
   * NO necesariamente proporcional al cash aportado · ver `tipoParticipacion`.
   */
  porcentajeParticipacion: number;

  /** Fecha de ingreso del socio al negocio · puede diferir de fechaIngreso laboral */
  fechaIngresoNegocio: Timestamp;

  /** Rol descriptivo en el negocio · ej: "Co-fundador · CEO" · NO el rol del sistema */
  rolEnNegocio?: string;

  /**
   * Naturaleza de la participación · canon D7 (chk5.E-INV-PERF).
   * Determina qué campos son relevantes en el módulo Inversionistas:
   *  - cash_puro · solo se muestran aportes monetarios
   *  - mixta · cash + TC + valor (la realidad de la mayoría de PyMEs)
   *  - valor_puro · "silent partner" · cero cash · solo valor
   */
  tipoParticipacion: TipoParticipacionSocio;

  /**
   * Detalle del aporte de valor · presente cuando tipoParticipacion != 'cash_puro'.
   * Si tipoParticipacion = 'cash_puro' este campo queda undefined.
   */
  aporteDeValor?: AporteDeValor;

  /**
   * IDs de cuentas (CuentaCaja) vinculadas como TC personales del socio.
   * Cada item apunta a una cuenta con tipo='credito' + titularidad='personal'
   * + titularEntidadTipo='socio' + titularEntidadId=uid (el mismo).
   *
   * Espejo redundante para facilitar consulta directa desde el módulo
   * Inversionistas sin tener que hacer query reverse a cuentasCaja.
   */
  tcsPersonalesVinculadas?: string[];

  /** Notas internas del socio · opcional */
  notas?: string;

  // ── Auditoría ──
  fechaCreacion: Timestamp;
  creadoPor: string;
  fechaActualizacion?: Timestamp;
  actualizadoPor?: string;
}

/**
 * Form data para crear/editar datos socio · sin auditoría.
 */
export interface DatosSocioFormData {
  porcentajeParticipacion: number;
  fechaIngresoNegocio: Date;
  rolEnNegocio?: string;
  tipoParticipacion: TipoParticipacionSocio;
  aporteDeValor?: {
    tiposDeValor: TipoAporteValor[];
    descripcion: string;
    valuacionEstimadaPEN?: number;
    vesting?: {
      tipoVesting: 'inmediato' | 'lineal' | 'cliff';
      mesesVesting?: number;
      mesesCliff?: number;
      fechaInicioVesting?: Date;
    };
  };
  tcsPersonalesVinculadas?: string[];
  notas?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// LABELS para UI
// ═════════════════════════════════════════════════════════════════════════

export const TIPO_PARTICIPACION_LABEL: Record<TipoParticipacionSocio, string> = {
  cash_puro: 'Cash puro · solo aporte económico',
  mixta: 'Mixta · cash + valor (lo más común)',
  valor_puro: 'Valor puro · silent partner sin cash',
};

export const TIPO_PARTICIPACION_DESC: Record<TipoParticipacionSocio, string> = {
  cash_puro: 'Todo el aporte fue monetario. El % participación es proporcional al cash invertido.',
  mixta: 'Combinación de aporte económico y valor no-monetario (know-how · cartera · gestión · IP · etc).',
  valor_puro: 'No aportó cash al negocio. La participación viene de valor no-monetario (silent partner típico).',
};

export const TIPO_VALOR_LABEL: Record<TipoAporteValor, string> = {
  know_how: 'Know-how técnico',
  gestion_ceo: 'Gestión · CEO sin sueldo de mercado',
  networking_clientes: 'Networking · cartera de clientes',
  marca_personal: 'Marca personal · followers',
  idea_original_ip: 'Idea original / IP',
  tiempo_dedicacion: 'Tiempo · sweat equity',
  activos_no_monetarios: 'Activos no monetarios (espacio · equipo · vehículo)',
  otro: 'Otro',
};

/** Icono lucide-react asociado a cada tipo de valor (para chips) */
export const TIPO_VALOR_ICON: Record<TipoAporteValor, string> = {
  know_how: 'brain',
  gestion_ceo: 'crown',
  networking_clientes: 'network',
  marca_personal: 'megaphone',
  idea_original_ip: 'lightbulb',
  tiempo_dedicacion: 'clock',
  activos_no_monetarios: 'building',
  otro: 'more-horizontal',
};
