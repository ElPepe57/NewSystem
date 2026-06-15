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

  /**
   * Meta de ventas mensual (S/) · objetivo del mes contra el que ResumenVendedor
   * mide progreso y proyección. undefined = sin meta.
   * FUENTE: el modelo vivo `RelacionLaboral.metaVentasMensual` (relación empleado),
   * leído vía `perfilPersona.adapter.getDatosLaboralesView`. Este campo es el
   * "carrier" de la VISTA del perfil · ya no se escribe en la colección datosLaborales.
   */
  metaVentasMensual?: number;

  /** Notas internas (admin/RRHH) */
  notas?: string;

  // ── Auditoría ──
  fechaCreacion: Timestamp;
  creadoPor: string;
  fechaActualizacion?: Timestamp;
  actualizadoPor?: string;
}

// NOTA: `DatosLaboralesFormData` (form de escritura legacy) se eliminó junto con
// el form huérfano `DatosLaboralesForm` y las funciones de escritura del service
// (2026-06-14) · la escritura laboral vive en `RelacionLaboral`. `DatosLaborales`
// queda SOLO como la forma de la VISTA de lectura que arma `perfilPersona.adapter`.
