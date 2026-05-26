/**
 * incentivoCalculadores.ts
 *
 * chk5.PERSONAS-v5.4 · F5 stub · 2026-05-26
 *
 * STUB del motor de cálculo de incentivos · F7 lo amplía con la lógica real
 * de los 4 tipos (comision · bono_meta · bono_kpi · bono_fijo).
 *
 * Esta versión devuelve placeholder { valor: 0 } para que F5 pueda crear el
 * CalcularBonosMesModal y la UI funcione end-to-end (el cálculo real se
 * conecta en F7 sin tocar la UI).
 */

import { Timestamp } from 'firebase/firestore';
import { generarIdCalculo } from '../services/calculoIncentivo.service';
import type {
  EsquemaIncentivo,
  CalculoIncentivoMes,
  EmpleadoConPerfil,
} from '../types/planilla.types';

/**
 * Determina qué empleados aplican a un esquema según su `aplicableA`.
 */
export function empleadosAplicables(
  esquema: EsquemaIncentivo,
  empleados: EmpleadoConPerfil[],
): EmpleadoConPerfil[] {
  // Narrow el aplicableA en una const local para que TypeScript pueda hacer
  // el discriminator correctamente dentro de los filtros.
  const ap = esquema.aplicableA;
  switch (ap.modo) {
    case 'todos':
      return empleados.filter((e) => e.activo);
    case 'rol':
      return empleados.filter(
        (e) =>
          e.activo &&
          (e.role === ap.rol ||
            // multi-rol-aware: si el user tiene roles[], chequear ahí también
            ((e as { roles?: string[] }).roles?.includes(ap.rol) ?? false)),
      );
    case 'usuarios':
      return empleados.filter((e) => e.activo && ap.userIds.includes(e.uid));
    default:
      return [];
  }
}

/**
 * Calcula UN bono para UN empleado bajo UN esquema en UN mes específico.
 *
 * STUB v5.4 F5: devuelve { valor: 0, unidad: 'pendiente' }. F7 implementa
 * la lógica real consultando ventas (comisión), envíos (bono meta), KPIs
 * (bono KPI) o aplicando el monto fijo (bono fijo).
 */
export function calcularBonoEmpleado(
  esquema: EsquemaIncentivo,
  empleado: EmpleadoConPerfil,
  mes: number,
  anio: number,
  calculadoPor: string,
): CalculoIncentivoMes {
  // STUB: por ahora devuelve cálculo vacío. F7 reemplaza este body.
  const id = generarIdCalculo(mes, anio);

  return {
    id,
    esquemaId: esquema.id,
    esquemaNombre: esquema.nombre,
    esquemaTipo: esquema.tipo,
    userId: empleado.uid,
    empleadoNombre: empleado.displayName,
    mes,
    anio,
    metricaCalculada: {
      valorMedido: 0,
      unidad: 'pendiente F7',
      detalle: {
        nota: 'Motor de cálculo se implementa en F7 del roadmap personas v5.x',
      },
    },
    bonoCalculado: 0,
    moneda: 'PEN',
    estado: 'calculado',
    calculadoPor,
    fechaCalculo: Timestamp.now(),
  };
}

/**
 * Calcula bonos para TODOS los empleados aplicables de TODOS los esquemas
 * vigentes en un mes/año. Retorna array de cálculos listos para persistir
 * vía calculoIncentivoService.guardarBatch.
 *
 * STUB v5.4 F5: usa calcularBonoEmpleado (placeholder). F7 lo reemplaza.
 */
export function calcularBonosDelMes(
  esquemas: EsquemaIncentivo[],
  empleados: EmpleadoConPerfil[],
  mes: number,
  anio: number,
  calculadoPor: string,
): CalculoIncentivoMes[] {
  const resultado: CalculoIncentivoMes[] = [];

  esquemas.forEach((esq) => {
    if (!esq.activo) return;
    const aplicables = empleadosAplicables(esq, empleados);
    aplicables.forEach((emp) => {
      resultado.push(calcularBonoEmpleado(esq, emp, mes, anio, calculadoPor));
    });
  });

  return resultado;
}
