/**
 * datosLaborales.types.ts · chk5.F2-SUB-PERFILES (2026-05-24)
 *
 * Sub-perfil "laborales" del UserProfile · vive en
 * `/users/{uid}/private/datosLaborales` (sub-colección privada).
 *
 * Captura los datos de relación laboral entre la persona (User) y el
 * negocio. SOLO aplica si el user tiene un rol de planilla
 * (vendedor · gerente · comprador · almacenero · finanzas · supervisor).
 *
 * Modelo B (chk5.F1-MULTI-ROL) · una persona puede tener múltiples roles
 * y este sub-perfil consolida los datos laborales en UN solo lugar.
 *
 * Reusa `PerfilLaboral` existente en planilla.types.ts · le agrega
 * metadata de sub-perfil (fechas de creación · responsable).
 */

import { Timestamp } from 'firebase/firestore';
import type { PerfilLaboral } from './planilla.types';

/**
 * Sub-perfil de datos laborales del usuario.
 *
 * Stored en `/users/{uid}/private/datosLaborales`.
 *
 * Es el ÚNICO lugar canon donde viven los datos de planilla a partir de
 * Fase 2 · la colección `/empleados` queda deprecada y se migra.
 */
export interface DatosLaborales extends PerfilLaboral {
  /** UID del UserProfile padre · espejo · facilita queries reverse */
  uid: string;

  /** Fecha de ingreso al negocio · cuándo empezó la relación laboral */
  fechaIngreso: Timestamp;

  /** Fecha de salida · undefined si sigue activo · si tiene valor, está retirado */
  fechaSalida?: Timestamp;

  /** Tipo de contrato · informativo */
  tipoContrato?:
    | 'indefinido'
    | 'plazo_fijo'
    | 'locacion_servicios'
    | 'practicas'
    | 'recibo_honorarios'
    | 'otro';

  /** Modalidad de trabajo · informativo */
  modalidad?: 'presencial' | 'hibrido' | 'remoto';

  /** Área del negocio · ventas · finanzas · almacén · marketing · operaciones · etc */
  area?: string;

  /** Días de vacaciones disponibles · informativo */
  vacacionesDisponibles?: number;

  /** Notas internas (admin/RRHH) */
  notas?: string;

  // ── Auditoría ──
  fechaCreacion: Timestamp;
  creadoPor: string;
  fechaActualizacion?: Timestamp;
  actualizadoPor?: string;
}

/**
 * Form data para crear/editar datos laborales · sin auditoría.
 */
export interface DatosLaboralesFormData extends Omit<DatosLaborales,
  | 'uid'
  | 'fechaCreacion'
  | 'creadoPor'
  | 'fechaActualizacion'
  | 'actualizadoPor'
  | 'fechaIngreso'
  | 'fechaSalida'
> {
  fechaIngreso: Date;
  fechaSalida?: Date;
}
