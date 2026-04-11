import { Timestamp } from 'firebase/firestore';

/**
 * Tipo de casilla (ubicacion de almacenamiento)
 * - almacen_propio: Almacen de la empresa (ej. ALM-PE-001 en Lima)
 * - casilla_viajero: Casilla temporal de un viajero (ej. Angie en California)
 * - punto_courier: Ubicacion virtual de un courier (ej. centro DHL)
 * - ubicacion_proveedor: Ubicacion virtual del proveedor (origen de unidades pedidas)
 */
export type TipoCasilla = 'almacen_propio' | 'casilla_viajero' | 'punto_courier' | 'ubicacion_proveedor';

/**
 * Estado de la casilla
 */
export type EstadoCasilla = 'activa' | 'inactiva';

/**
 * Pais de la casilla
 */
export type PaisCasilla = 'USA' | 'Peru' | 'China' | 'Corea' | 'Peru_local';

/**
 * Configuracion de pais para display y logica
 */
export const PAISES_CONFIG: Record<string, { nombre: string; emoji: string; esOrigen: boolean; monedaDefault: string }> = {
  USA:        { nombre: 'Estados Unidos', emoji: '\u{1F1FA}\u{1F1F8}', esOrigen: true, monedaDefault: 'USD' },
  China:      { nombre: 'China',          emoji: '\u{1F1E8}\u{1F1F3}', esOrigen: true, monedaDefault: 'USD' },
  Corea:      { nombre: 'Corea del Sur',  emoji: '\u{1F1F0}\u{1F1F7}', esOrigen: true, monedaDefault: 'USD' },
  Peru:       { nombre: 'Per\u00FA',           emoji: '\u{1F1F5}\u{1F1EA}', esOrigen: false, monedaDefault: 'PEN' },
  Peru_local: { nombre: 'Per\u00FA (local)',   emoji: '\u{1F1F5}\u{1F1EA}', esOrigen: false, monedaDefault: 'PEN' },
};

/**
 * Casilla — ubicacion de almacenamiento en la red logistica
 * Cada casilla pertenece a un Colaborador.
 */
export interface Casilla {
  id: string;
  codigo: string;                     // CAS-001, CAS-PE-001, etc.
  nombre: string;
  tipo: TipoCasilla;
  estado: EstadoCasilla;
  pais: PaisCasilla;

  // Vinculo con colaborador
  colaboradorId: string;              // Dueno de esta casilla
  colaboradorNombre: string;          // Desnormalizado

  // Es la casilla principal del colaborador?
  esPrincipal: boolean;

  // Ubicacion
  direccion?: string;
  ciudad?: string;
  codigoPostal?: string;

  // Capacidad
  capacidadUnidades?: number;
  unidadesActuales?: number;

  // Metricas
  totalUnidadesRecibidas: number;
  totalUnidadesEnviadas: number;
  valorInventarioUSD: number;

  // Notas
  notas?: string;

  // Auditoria
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Datos para crear/editar una casilla
 */
export interface CasillaFormData {
  nombre: string;
  tipo: TipoCasilla;
  estado: EstadoCasilla;
  pais: PaisCasilla;
  colaboradorId: string;
  esPrincipal: boolean;
  direccion?: string;
  ciudad?: string;
  codigoPostal?: string;
  capacidadUnidades?: number;
  notas?: string;
}
