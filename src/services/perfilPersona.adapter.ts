/**
 * src/services/perfilPersona.adapter.ts
 * 2026-06-14 · Adaptador de lectura del PERFIL de una persona (consolidación Personas).
 *
 * PROBLEMA que resuelve (deuda "Personas · 3 olas"): el lado de ESCRITURA del
 * sistema (Usuarios · Planilla · Inversionistas · Maestros) ya migró al modelo
 * vivo `RelacionLaboral`, pero el lado de LECTURA de "Mi Perfil" seguía leyendo
 * los modelos muertos `datosLaborales` / `datosSocio` (que ya nadie escribe).
 *
 * Este adaptador es la ÚNICA fuente de lectura del perfil: deriva la vista laboral
 * desde la relación VIGENTE del modelo vivo y, si la persona aún no tiene relación
 * (data sembrada a mano en el modelo viejo), cae de vuelta al legacy. Así nadie
 * queda en blanco · cero regresión · y el modelo viejo se puede deprecar después.
 *
 * Devuelve la forma `DatosLaborales` para minimizar el cambio en los consumidores
 * (MiPerfil, ResumenVendedor/Empleado, sub-páginas): solo cambian la llamada de
 * fetch, no el acceso a campos.
 */
import { relacionesLaboralesService } from './relacionesLaborales.service';
import { datosLaboralesService } from './datosLaborales.service';
import type { DatosLaborales } from '../types/datosLaborales.types';
import type { RelacionLaboral } from '../types/relacionLaboral.types';

/** Estados de relación que cuentan como "vigente" para mostrar en el perfil. */
const ESTADOS_ACTIVOS = new Set(['vigente', 'prueba', 'pausada']);

/**
 * Mapea una relación empleado del modelo vivo → la forma `DatosLaborales`
 * que el Perfil consume. Los campos que el modelo vivo no tiene (tipoContrato,
 * vacaciones) quedan undefined · son informativos.
 */
function relacionEmpleadoToVista(uid: string, rel: RelacionLaboral): DatosLaborales {
  return {
    uid,
    tipo: 'empleado',
    monedaSalario: rel.monedaReferencia ?? 'PEN',
    activo: ESTADOS_ACTIVOS.has(rel.estado),
    salarioBase: rel.montoMensualReferencia,
    lineaNegocioId: rel.lineaNegocioId,
    metaVentasMensual: rel.metaVentasMensual,
    area: rel.cargoDisplay,
    fechaIngreso: rel.fechaInicio,
    fechaCreacion: rel.fechaCreacion,
    creadoPor: rel.creadoPor,
    fechaActualizacion: rel.fechaModificacion,
    actualizadoPor: rel.modificadoPor,
  };
}

/**
 * Vista laboral del perfil de una persona.
 * 1) Modelo vivo: relación empleado vigente (sueldo · línea · meta · área).
 * 2) Fallback: modelo legacy `datosLaborales` (para personas aún sin relación migrada).
 * null si no hay ninguno de los dos.
 */
export async function getDatosLaboralesView(uid: string): Promise<DatosLaborales | null> {
  const relaciones = await relacionesLaboralesService.listVigentesByUser(uid).catch(() => []);
  const empleado = relaciones.find((r) => r.tipo === 'empleado');
  if (empleado) return relacionEmpleadoToVista(uid, empleado);
  return datosLaboralesService.get(uid).catch(() => null);
}
