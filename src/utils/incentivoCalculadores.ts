/**
 * incentivoCalculadores.ts
 *
 * chk5.PERSONAS-v5.4 · F7 · 2026-05-26 (refactor real · reemplaza stub F5.A.2)
 *
 * Motor de cálculo real para los 4 tipos de incentivo:
 *  - comision: porcentaje/escalado/montoFijo sobre ventas del empleado
 *  - bono_meta: cumplimiento cuantitativo sobre envíos/OCs/reclamos
 *  - bono_kpi: cualitativo · requiere validación manual (devuelve 0 + flag)
 *  - bono_fijo: monto fijo según frecuencia
 *
 * API · el orquestador (CalcularBonosMesModal o cron F9) pre-carga las
 * fuentes de datos del mes y las pasa al motor. El motor es puro: sin
 * side effects ni queries a Firestore.
 */

import { Timestamp } from 'firebase/firestore';
import { generarIdCalculo } from '../services/calculoIncentivo.service';
import type {
  EsquemaIncentivo,
  CalculoIncentivoMes,
  EmpleadoConPerfil,
  ConfigComision,
  ConfigBonoMeta,
  ConfigBonoKPI,
  ConfigBonoFijo,
  EscalaComision,
} from '../types/planilla.types';
import type { Venta } from '../types/venta.types';
import type { Envio } from '../types/envio.types';
import type { OrdenCompra } from '../types/ordenCompra.types';

// ============================================
// TIPOS DE LA API DEL MOTOR
// ============================================

/**
 * Datos pre-cargados del mes. El orquestador hace los fetches y los pasa
 * al motor para evitar N+1 queries (1 esquema × N empleados = N×3 queries).
 */
export interface DatosFuenteMes {
  ventas: Venta[];
  envios: Envio[];
  ordenesCompra: OrdenCompra[];
}

const DATOS_VACIOS: DatosFuenteMes = {
  ventas: [],
  envios: [],
  ordenesCompra: [],
};

// ============================================
// UTILIDADES
// ============================================

/** Filtra docs por fecha en mes/anio · usa Timestamp si existe */
function esDelMes(ts: Timestamp | Date | undefined, mes: number, anio: number): boolean {
  if (!ts) return false;
  const d = ts instanceof Timestamp ? ts.toDate() : ts;
  return d.getMonth() + 1 === mes && d.getFullYear() === anio;
}

/** Filtra docs creados por un user específico */
function esCreadoPor(doc: { creadoPor?: string }, userId: string): boolean {
  return doc.creadoPor === userId;
}

// ============================================
// SELECCIÓN DE EMPLEADOS APLICABLES
// ============================================

export function empleadosAplicables(
  esquema: EsquemaIncentivo,
  empleados: EmpleadoConPerfil[],
): EmpleadoConPerfil[] {
  const ap = esquema.aplicableA;
  switch (ap.modo) {
    case 'todos':
      return empleados.filter((e) => e.activo);
    case 'rol':
      return empleados.filter(
        (e) =>
          e.activo &&
          (e.role === ap.rol ||
            ((e as { roles?: string[] }).roles?.includes(ap.rol) ?? false)),
      );
    case 'usuarios':
      return empleados.filter((e) => e.activo && ap.userIds.includes(e.uid));
    default:
      return [];
  }
}

// ============================================
// CÁLCULO TIPO 1 · COMISIÓN (sobre ventas)
// ============================================

interface ResultadoCalculo {
  valorMedido: number;
  unidad: string;
  bono: number;
  detalle: Record<string, any>;
  objetivoAplicable?: number;
  cumplePct?: number;
}

function calcularComision(
  config: ConfigComision,
  empleado: EmpleadoConPerfil,
  datos: DatosFuenteMes,
  mes: number,
  anio: number,
): ResultadoCalculo {
  // Ventas del mes del empleado (creadoPor)
  let ventasEmpleado = datos.ventas.filter(
    (v) =>
      esDelMes(v.fechaCreacion, mes, anio) &&
      esCreadoPor(v as { creadoPor?: string }, empleado.uid) &&
      v.estado !== 'cancelada',
  );

  // Filtros opcionales · líneas y canales
  if (config.soloLineas?.length) {
    ventasEmpleado = ventasEmpleado.filter(
      (v) => (v as { lineaNegocioId?: string }).lineaNegocioId &&
        config.soloLineas!.includes((v as { lineaNegocioId?: string }).lineaNegocioId!),
    );
  }
  if (config.soloCanales?.length) {
    ventasEmpleado = ventasEmpleado.filter(
      (v) => (v as { canalVentaId?: string }).canalVentaId &&
        config.soloCanales!.includes((v as { canalVentaId?: string }).canalVentaId!),
    );
  }

  const cantidadVentas = ventasEmpleado.length;

  // Calcular base sobre la cual aplicar % según config.aplicarSobre
  const base = ventasEmpleado.reduce((s, v) => {
    if (config.aplicarSobre === 'totalVenta') return s + (v.totalPEN ?? 0);
    if (config.aplicarSobre === 'margenContribucion') {
      return s + ((v as { utilidadBrutaPEN?: number }).utilidadBrutaPEN ?? 0);
    }
    return s; // 'monto' usa monto fijo · no acumula base
  }, 0);

  let bono = 0;
  let detalleStr = '';

  if (config.modelo === 'porcentaje_simple') {
    const pct = config.porcentaje ?? 0;
    bono = Number(((base * pct) / 100).toFixed(2));
    detalleStr = `${pct}% sobre ${config.aplicarSobre} · S/${base.toLocaleString('es-PE')} → S/${bono.toLocaleString('es-PE')}`;
  } else if (config.modelo === 'monto_fijo_por_venta') {
    const mf = config.montoFijo ?? 0;
    bono = Number((cantidadVentas * mf).toFixed(2));
    detalleStr = `${cantidadVentas} ventas × S/${mf} = S/${bono.toLocaleString('es-PE')}`;
  } else if (config.modelo === 'escalado' && config.escalas?.length) {
    // Escalado: aplica el % de la escala donde caiga `base`
    const escala = encontrarEscala(config.escalas, base);
    if (escala) {
      bono = Number(((base * escala.porcentaje) / 100).toFixed(2));
      const hastaLabel = escala.hastaS ? `≤ S/${escala.hastaS.toLocaleString('es-PE')}` : 'sin tope';
      detalleStr = `Escala S/${escala.desdeS.toLocaleString('es-PE')}-${hastaLabel} · ${escala.porcentaje}% × S/${base.toLocaleString('es-PE')} = S/${bono.toLocaleString('es-PE')}`;
    } else {
      detalleStr = `Base S/${base.toLocaleString('es-PE')} fuera de todas las escalas configuradas`;
    }
  }

  return {
    valorMedido: base,
    unidad: 'S/',
    bono,
    detalle: {
      cantidadVentas,
      base,
      modelo: config.modelo,
      aplicarSobre: config.aplicarSobre,
      descripcion: detalleStr,
    },
  };
}

/** Encuentra la escala donde cae el monto base */
function encontrarEscala(escalas: EscalaComision[], base: number): EscalaComision | null {
  for (const e of escalas) {
    const desde = e.desdeS;
    const hasta = e.hastaS ?? Infinity;
    if (base >= desde && base <= hasta) return e;
  }
  return null;
}

// ============================================
// CÁLCULO TIPO 2 · BONO META (cuantitativo)
// ============================================

function calcularBonoMeta(
  config: ConfigBonoMeta,
  empleado: EmpleadoConPerfil,
  datos: DatosFuenteMes,
  mes: number,
  anio: number,
): ResultadoCalculo {
  let valorMedido = 0;
  let unidad = '';
  let descripcionMetrica = '';

  switch (config.metricaTracked) {
    case 'cantidad_envios_entregados': {
      const envios = datos.envios.filter(
        (e) =>
          esDelMes(e.fechaCreacion as Timestamp | undefined, mes, anio) &&
          esCreadoPor(e as { creadoPor?: string }, empleado.uid) &&
          (e as { estado?: string }).estado === 'entregado',
      );
      valorMedido = envios.length;
      unidad = 'envíos entregados';
      descripcionMetrica = `${envios.length} envíos completados del mes`;
      break;
    }
    case 'tasa_entrega_a_tiempo': {
      const enviosEmp = datos.envios.filter(
        (e) =>
          esDelMes(e.fechaCreacion as Timestamp | undefined, mes, anio) &&
          esCreadoPor(e as { creadoPor?: string }, empleado.uid),
      );
      const entregados = enviosEmp.filter((e) => (e as { estado?: string }).estado === 'entregado');
      valorMedido = enviosEmp.length > 0 ? (entregados.length / enviosEmp.length) * 100 : 0;
      unidad = '% a tiempo';
      descripcionMetrica = `${entregados.length}/${enviosEmp.length} = ${valorMedido.toFixed(1)}%`;
      break;
    }
    case 'cantidad_ordenes_compra': {
      const ocs = datos.ordenesCompra.filter(
        (o) =>
          esDelMes(o.fechaCreacion as Timestamp | undefined, mes, anio) &&
          esCreadoPor(o as { creadoPor?: string }, empleado.uid),
      );
      valorMedido = ocs.length;
      unidad = 'OCs';
      descripcionMetrica = `${ocs.length} OCs creadas en el mes`;
      break;
    }
    case 'tasa_ordenes_completas': {
      const ocsEmp = datos.ordenesCompra.filter(
        (o) =>
          esDelMes(o.fechaCreacion as Timestamp | undefined, mes, anio) &&
          esCreadoPor(o as { creadoPor?: string }, empleado.uid),
      );
      const completas = ocsEmp.filter((o) => (o as { estado?: string }).estado === 'recibida_completa' || (o as { estado?: string }).estado === 'recibida_total');
      valorMedido = ocsEmp.length > 0 ? (completas.length / ocsEmp.length) * 100 : 0;
      unidad = '% completas';
      descripcionMetrica = `${completas.length}/${ocsEmp.length} = ${valorMedido.toFixed(1)}%`;
      break;
    }
    case 'cantidad_reclamos_resueltos': {
      // Métrica no fully wired · placeholder con 0 hasta que se conecte servicio reclamos
      valorMedido = 0;
      unidad = 'reclamos';
      descripcionMetrica = '0 (servicio reclamos no integrado en F7 · requiere ampliación futura)';
      break;
    }
    case 'custom': {
      // Métrica custom · siempre 0 · requiere validación manual
      valorMedido = 0;
      unidad = config.metricaCustomNombre ?? 'custom';
      descripcionMetrica = `Métrica custom "${config.metricaCustomNombre ?? 'sin nombre'}" · requiere validación manual`;
      break;
    }
  }

  // Calcular bono según cumplimiento
  const objetivo = config.objetivoMensual;
  const cumplePct = objetivo > 0 ? (valorMedido / objetivo) * 100 : 0;
  let bono = 0;
  if (valorMedido >= objetivo) {
    bono = config.bonoSiCumple;
    if (config.bonoExtraporExceso) {
      const exceso = valorMedido - objetivo;
      let extra = Number((exceso * config.bonoExtraporExceso.porUnidad).toFixed(2));
      if (config.bonoExtraporExceso.topeMaximo) {
        extra = Math.min(extra, config.bonoExtraporExceso.topeMaximo);
      }
      bono += extra;
    }
  }

  return {
    valorMedido,
    unidad,
    bono,
    objetivoAplicable: objetivo,
    cumplePct,
    detalle: {
      metricaTracked: config.metricaTracked,
      descripcion: descripcionMetrica,
      objetivoAlcanzado: valorMedido >= objetivo,
      bonoBase: valorMedido >= objetivo ? config.bonoSiCumple : 0,
      bonoExtra: bono - (valorMedido >= objetivo ? config.bonoSiCumple : 0),
    },
  };
}

// ============================================
// CÁLCULO TIPO 3 · BONO KPI (cualitativo · requiere validación manual)
// ============================================

function calcularBonoKPI(config: ConfigBonoKPI, _empleado: EmpleadoConPerfil): ResultadoCalculo {
  // KPIs cualitativos requieren validación humana. El motor NO presupone
  // cumplimiento · genera el cálculo en S/ 0 con flag para que gerente lo
  // revise y ajuste manualmente vía Aprobar/Rechazar.
  return {
    valorMedido: 0,
    unidad: 'pendiente validación',
    bono: 0,
    detalle: {
      metricaTracked: config.metricaTracked,
      formulaDescripcion: config.formulaDescripcion,
      bonoSiCumple: config.bonoSiCumple,
      evaluacionManual: config.evaluacionManual,
      nota:
        'Bono KPI cualitativo · requiere validación gerencial mensual. Si cumple, ' +
        `aprobar y ajustar monto a S/${config.bonoSiCumple.toLocaleString('es-PE')}.`,
    },
  };
}

// ============================================
// CÁLCULO TIPO 4 · BONO FIJO (recurrente)
// ============================================

function calcularBonoFijo(
  config: ConfigBonoFijo,
  _empleado: EmpleadoConPerfil,
  mes: number,
  anio: number,
): ResultadoCalculo {
  // Aplica el bono según frecuencia · solo se paga en meses que corresponden:
  // - mensual: todos los meses
  // - trimestral: mar/jun/sep/dic
  // - semestral: jun/dic
  // - anual: dic
  let aplicaEsteMes = false;
  switch (config.frecuencia) {
    case 'mensual':
      aplicaEsteMes = true;
      break;
    case 'trimestral':
      aplicaEsteMes = [3, 6, 9, 12].includes(mes);
      break;
    case 'semestral':
      aplicaEsteMes = [6, 12].includes(mes);
      break;
    case 'anual':
      aplicaEsteMes = mes === 12;
      break;
  }

  const bono = aplicaEsteMes ? config.monto : 0;

  return {
    valorMedido: 1,
    unidad: aplicaEsteMes ? 'aplica' : 'no aplica este mes',
    bono,
    detalle: {
      frecuencia: config.frecuencia,
      aplicaEsteMes,
      moneda: config.moneda,
      condicionado: config.condicionado,
      condicion: config.condicion,
      mesEvaluado: mes,
      anioEvaluado: anio,
      nota: config.condicionado
        ? `Sujeto a aprobación gerencial · ${config.condicion ?? 'condición no especificada'}`
        : 'Recurrente automático · no requiere aprobación adicional',
    },
  };
}

// ============================================
// FUNCIÓN PÚBLICA · calcular UN bono
// ============================================

export function calcularBonoEmpleado(
  esquema: EsquemaIncentivo,
  empleado: EmpleadoConPerfil,
  mes: number,
  anio: number,
  calculadoPor: string,
  datos: DatosFuenteMes = DATOS_VACIOS,
): CalculoIncentivoMes {
  const id = generarIdCalculo(mes, anio);
  let resultado: ResultadoCalculo;

  switch (esquema.tipo) {
    case 'comision':
      resultado = calcularComision(esquema.configuracion, empleado, datos, mes, anio);
      break;
    case 'bono_meta':
      resultado = calcularBonoMeta(esquema.configuracion, empleado, datos, mes, anio);
      break;
    case 'bono_kpi':
      resultado = calcularBonoKPI(esquema.configuracion, empleado);
      break;
    case 'bono_fijo':
      resultado = calcularBonoFijo(esquema.configuracion, empleado, mes, anio);
      break;
  }

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
      valorMedido: resultado.valorMedido,
      unidad: resultado.unidad,
      objetivoAplicable: resultado.objetivoAplicable,
      cumplePct: resultado.cumplePct,
      detalle: resultado.detalle,
    },
    bonoCalculado: resultado.bono,
    moneda: esquema.tipo === 'bono_fijo' ? (esquema.configuracion as ConfigBonoFijo).moneda : 'PEN',
    estado: 'calculado',
    calculadoPor,
    fechaCalculo: Timestamp.now(),
  };
}

// ============================================
// FUNCIÓN PÚBLICA · calcular TODOS los bonos del mes
// ============================================

/**
 * Procesa esquemas vigentes × empleados aplicables y produce array de
 * CalculoIncentivoMes listos para persistir.
 *
 * IMPORTANTE: pasar `datos` con ventas/envios/OCs pre-cargados del mes.
 * Si se omite, los cálculos de comisión y meta darán 0 (no rompe).
 */
export function calcularBonosDelMes(
  esquemas: EsquemaIncentivo[],
  empleados: EmpleadoConPerfil[],
  mes: number,
  anio: number,
  calculadoPor: string,
  datos: DatosFuenteMes = DATOS_VACIOS,
): CalculoIncentivoMes[] {
  const resultado: CalculoIncentivoMes[] = [];

  esquemas.forEach((esq) => {
    if (!esq.activo) return;
    const aplicables = empleadosAplicables(esq, empleados);
    aplicables.forEach((emp) => {
      resultado.push(calcularBonoEmpleado(esq, emp, mes, anio, calculadoPor, datos));
    });
  });

  return resultado;
}
