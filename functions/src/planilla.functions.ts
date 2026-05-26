/**
 * planilla.functions.ts
 *
 * chk5.PERSONAS-v5.4 · F9 · 2026-05-26
 *
 * Cloud Functions del módulo de Planilla v5.4:
 *
 *  1. scheduledCalcularBonosMes
 *     · pubsub schedule día 1 de cada mes a las 07:00 AM Lima
 *     · procesa el mes anterior (cierre del mes pasado)
 *     · usa motor de cálculo (utils/incentivoCalculadores · clon del frontend)
 *     · idempotente: skip si ya hay cálculos del mes
 *
 *  2. onLiquidacionAprobada
 *     · Firestore trigger onUpdate en liquidacionesEmpleado/{id}
 *     · dispara cuando estado: 'borrador' → 'aprobada'
 *     · acción SEGURA: desactiva PerfilLaboral + marca adelantos como descontados
 *     · NO crea movimientos tesorería (decisión humana · evita errores de cuenta)
 *     · idempotente: verifica antes de actuar
 *
 *  3. onGratificacionAprobada
 *     · Firestore trigger onUpdate en gratificaciones/{id}
 *     · dispara cuando estado: 'pendiente' → 'aprobada'
 *     · acción: log + notificación (sin crear boleta automática · decisión humana)
 *
 * DECISIÓN DE DISEÑO · estas CFs NO crean documentos de tesorería automáticamente.
 * La razón: requiere seleccionar cuenta de pago + categoría de gasto, decisión que
 * exige juicio humano. El usuario opera estos pagos desde UI (drill manual).
 * Las CFs sí automatizan el workflow no-financiero (desactivar perfil, logs).
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { COLLECTIONS } from "./collections";

// ============================================================
// TIPOS (copia ligera para no depender del frontend)
// ============================================================

type EstadoLiquidacion = "borrador" | "aprobada" | "pagada" | "anulada";
type EstadoGratificacion = "pendiente" | "aprobada" | "pagada" | "anulada";
type EstadoAdelanto = "pendiente" | "pagado" | "descontado" | "anulado";

interface AplicabilidadIncentivo {
  modo: "rol" | "usuarios" | "todos";
  rol?: string;
  userIds?: string[];
}

interface EsquemaIncentivo {
  id: string;
  nombre: string;
  tipo: "comision" | "bono_meta" | "bono_kpi" | "bono_fijo";
  aplicableA: AplicabilidadIncentivo;
  configuracion: any; // Discriminado en frontend · aquí lo tratamos genérico
  activo: boolean;
  vigenteDesde: admin.firestore.Timestamp;
  vigenteHasta?: admin.firestore.Timestamp;
}

interface CalculoIncentivoMes {
  id: string;
  esquemaId: string;
  esquemaNombre: string;
  esquemaTipo: "comision" | "bono_meta" | "bono_kpi" | "bono_fijo";
  userId: string;
  empleadoNombre: string;
  mes: number;
  anio: number;
  metricaCalculada: {
    valorMedido: number;
    unidad: string;
    objetivoAplicable?: number;
    cumplePct?: number;
    detalle?: Record<string, any>;
  };
  bonoCalculado: number;
  moneda: "PEN" | "USD";
  estado: "calculado" | "aprobado" | "rechazado" | "incluido_en_boleta";
  calculadoPor: string;
  fechaCalculo: admin.firestore.Timestamp;
}

// ============================================================
// HELPERS
// ============================================================

function generarIdCalculo(mes: number, anio: number): string {
  const mesStr = String(mes).padStart(2, "0");
  const rnd = Math.floor(Math.random() * 100000).toString(36).toUpperCase().padStart(4, "0");
  return `CALC-${anio}-${mesStr}-${rnd}`;
}

function esDelMes(
  ts: admin.firestore.Timestamp | undefined,
  mes: number,
  anio: number,
): boolean {
  if (!ts) return false;
  const d = ts.toDate();
  return d.getMonth() + 1 === mes && d.getFullYear() === anio;
}

/** Determina si un esquema está vigente en una fecha dada */
function esVigente(esquema: EsquemaIncentivo, fecha: Date): boolean {
  const fechaTs = fecha.getTime();
  if (esquema.vigenteDesde.toMillis() > fechaTs) return false;
  if (esquema.vigenteHasta && esquema.vigenteHasta.toMillis() < fechaTs) return false;
  return esquema.activo;
}

// ============================================================
// MOTOR DE CÁLCULO (clon backend · simplificado · solo los 4 tipos)
// ============================================================

interface DatosFuente {
  ventas: any[];
  envios: any[];
  ordenesCompra: any[];
}

interface ResultadoCalculo {
  valorMedido: number;
  unidad: string;
  bono: number;
  objetivoAplicable?: number;
  cumplePct?: number;
  detalle: Record<string, any>;
}

function calcularComision(
  config: any,
  empleado: { uid: string },
  datos: DatosFuente,
  mes: number,
  anio: number,
): ResultadoCalculo {
  const ventasEmp = datos.ventas.filter(
    (v) =>
      esDelMes(v.fechaCreacion, mes, anio) &&
      v.creadoPor === empleado.uid &&
      v.estado !== "cancelada",
  );

  const base = ventasEmp.reduce((s, v) => {
    if (config.aplicarSobre === "totalVenta") return s + (v.totalPEN ?? 0);
    if (config.aplicarSobre === "margenContribucion") return s + (v.utilidadBrutaPEN ?? 0);
    return s;
  }, 0);

  let bono = 0;
  if (config.modelo === "porcentaje_simple") {
    bono = Number(((base * (config.porcentaje ?? 0)) / 100).toFixed(2));
  } else if (config.modelo === "monto_fijo_por_venta") {
    bono = Number((ventasEmp.length * (config.montoFijo ?? 0)).toFixed(2));
  } else if (config.modelo === "escalado" && config.escalas?.length) {
    for (const e of config.escalas) {
      const hasta = e.hastaS ?? Infinity;
      if (base >= e.desdeS && base <= hasta) {
        bono = Number(((base * e.porcentaje) / 100).toFixed(2));
        break;
      }
    }
  }

  return {
    valorMedido: base,
    unidad: "S/",
    bono,
    detalle: {
      cantidadVentas: ventasEmp.length,
      base,
      modelo: config.modelo,
      cfOrigin: "scheduledCalcularBonosMes",
    },
  };
}

function calcularBonoMeta(
  config: any,
  empleado: { uid: string },
  datos: DatosFuente,
  mes: number,
  anio: number,
): ResultadoCalculo {
  let valorMedido = 0;
  let unidad = "";

  switch (config.metricaTracked) {
  case "cantidad_envios_entregados": {
    const envios = datos.envios.filter(
      (e) =>
        esDelMes(e.fechaCreacion, mes, anio) &&
          e.creadoPor === empleado.uid &&
          e.estado === "entregado",
    );
    valorMedido = envios.length;
    unidad = "envíos entregados";
    break;
  }
  case "cantidad_ordenes_compra": {
    const ocs = datos.ordenesCompra.filter(
      (o) => esDelMes(o.fechaCreacion, mes, anio) && o.creadoPor === empleado.uid,
    );
    valorMedido = ocs.length;
    unidad = "OCs";
    break;
  }
  default: {
    valorMedido = 0;
    unidad = config.metricaCustomNombre ?? "custom";
  }
  }

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
      cfOrigin: "scheduledCalcularBonosMes",
    },
  };
}

function calcularBonoKPI(config: any): ResultadoCalculo {
  return {
    valorMedido: 0,
    unidad: "pendiente validación",
    bono: 0,
    detalle: {
      metricaTracked: config.metricaTracked,
      formulaDescripcion: config.formulaDescripcion,
      bonoSiCumple: config.bonoSiCumple,
      nota: "Bono KPI cualitativo · requiere validación gerencial mensual.",
      cfOrigin: "scheduledCalcularBonosMes",
    },
  };
}

function calcularBonoFijo(config: any, mes: number): ResultadoCalculo {
  let aplicaEsteMes = false;
  switch (config.frecuencia) {
  case "mensual":
    aplicaEsteMes = true;
    break;
  case "trimestral":
    aplicaEsteMes = [3, 6, 9, 12].includes(mes);
    break;
  case "semestral":
    aplicaEsteMes = [6, 12].includes(mes);
    break;
  case "anual":
    aplicaEsteMes = mes === 12;
    break;
  }
  return {
    valorMedido: 1,
    unidad: aplicaEsteMes ? "aplica" : "no aplica este mes",
    bono: aplicaEsteMes ? config.monto : 0,
    detalle: {
      frecuencia: config.frecuencia,
      aplicaEsteMes,
      condicionado: config.condicionado,
      cfOrigin: "scheduledCalcularBonosMes",
    },
  };
}

// ============================================================
// CF #1 · SCHEDULED · cálculo mensual automático de bonos
// ============================================================

/**
 * Cron: día 1 de cada mes a las 07:00 AM hora Lima.
 * Procesa el MES ANTERIOR (cierre del mes pasado).
 *
 * Idempotencia: si ya hay cálculos para mes/año, NO crea duplicados.
 * Audit log completo via functions.logger.
 */
export const scheduledCalcularBonosMes = functions.pubsub
  .schedule("0 7 1 * *") // minuto 0 · hora 7 · día 1 · todos los meses · todos los días-semana
  .timeZone("America/Lima")
  .onRun(async () => {
    const db = admin.firestore();

    // Calcular mes anterior
    const ahora = new Date();
    const mesAnterior = ahora.getMonth() === 0 ? 12 : ahora.getMonth();
    const anioCalc = ahora.getMonth() === 0 ? ahora.getFullYear() - 1 : ahora.getFullYear();

    functions.logger.info("[scheduledCalcularBonosMes] Iniciando", {
      mes: mesAnterior,
      anio: anioCalc,
    });

    try {
      // Verificar si ya hay cálculos del mes (idempotencia)
      const yaExisten = await db
        .collection(COLLECTIONS.CALCULOS_INCENTIVO)
        .where("mes", "==", mesAnterior)
        .where("anio", "==", anioCalc)
        .limit(1)
        .get();

      if (!yaExisten.empty) {
        functions.logger.info(
          "[scheduledCalcularBonosMes] Cálculos ya existen para este período · skip",
          { mes: mesAnterior, anio: anioCalc },
        );
        return null;
      }

      // Cargar esquemas vigentes en el mes
      const fechaMes = new Date(anioCalc, mesAnterior - 1, 15);
      const esquemasSnap = await db
        .collection(COLLECTIONS.ESQUEMAS_INCENTIVO)
        .where("activo", "==", true)
        .get();
      const esquemas = esquemasSnap.docs
        .map((d) => d.data() as EsquemaIncentivo)
        .filter((e) => esVigente(e, fechaMes));

      if (esquemas.length === 0) {
        functions.logger.info("[scheduledCalcularBonosMes] Sin esquemas vigentes · skip");
        return null;
      }

      // Cargar empleados activos (users con private/laboral.activo == true)
      // En el modelo Vita Skin · los empleados son users con PerfilLaboral activo
      const usersSnap = await db.collection(COLLECTIONS.USERS).get();
      const empleados: Array<{ uid: string; displayName: string; role: string; roles?: string[] }> = [];
      for (const userDoc of usersSnap.docs) {
        const user = userDoc.data();
        if (user.activo === false) continue;
        // Verificar si tiene perfil laboral activo
        const perfilDoc = await userDoc.ref.collection("private").doc("laboral").get();
        if (perfilDoc.exists && perfilDoc.data()?.activo === true) {
          empleados.push({
            uid: userDoc.id,
            displayName: user.displayName ?? user.email ?? userDoc.id,
            role: user.role,
            roles: user.roles,
          });
        }
      }

      if (empleados.length === 0) {
        functions.logger.info("[scheduledCalcularBonosMes] Sin empleados activos · skip");
        return null;
      }

      // Cargar fuentes del mes (ventas/envíos/OCs)
      const inicioMes = admin.firestore.Timestamp.fromDate(new Date(anioCalc, mesAnterior - 1, 1));
      const finMes = admin.firestore.Timestamp.fromDate(
        new Date(anioCalc, mesAnterior, 0, 23, 59, 59),
      );

      const [ventasSnap, enviosSnap, ocsSnap] = await Promise.all([
        db.collection(COLLECTIONS.VENTAS)
          .where("fechaCreacion", ">=", inicioMes)
          .where("fechaCreacion", "<=", finMes)
          .get(),
        db.collection(COLLECTIONS.ENVIOS)
          .where("fechaCreacion", ">=", inicioMes)
          .where("fechaCreacion", "<=", finMes)
          .get(),
        db.collection(COLLECTIONS.ORDENES_COMPRA)
          .where("fechaCreacion", ">=", inicioMes)
          .where("fechaCreacion", "<=", finMes)
          .get(),
      ]);

      const datos: DatosFuente = {
        ventas: ventasSnap.docs.map((d) => d.data()),
        envios: enviosSnap.docs.map((d) => d.data()),
        ordenesCompra: ocsSnap.docs.map((d) => d.data()),
      };

      // Procesar esquemas × empleados aplicables
      const calculos: CalculoIncentivoMes[] = [];
      for (const esq of esquemas) {
        const aplicables = empleados.filter((e) => {
          const ap = esq.aplicableA;
          if (ap.modo === "todos") return true;
          if (ap.modo === "rol")
            return e.role === ap.rol || (e.roles?.includes(ap.rol ?? "") ?? false);
          if (ap.modo === "usuarios") return ap.userIds?.includes(e.uid) ?? false;
          return false;
        });

        for (const emp of aplicables) {
          let resultado: ResultadoCalculo;
          switch (esq.tipo) {
          case "comision":
            resultado = calcularComision(esq.configuracion, emp, datos, mesAnterior, anioCalc);
            break;
          case "bono_meta":
            resultado = calcularBonoMeta(esq.configuracion, emp, datos, mesAnterior, anioCalc);
            break;
          case "bono_kpi":
            resultado = calcularBonoKPI(esq.configuracion);
            break;
          case "bono_fijo":
            resultado = calcularBonoFijo(esq.configuracion, mesAnterior);
            break;
          }

          calculos.push({
            id: generarIdCalculo(mesAnterior, anioCalc),
            esquemaId: esq.id,
            esquemaNombre: esq.nombre,
            esquemaTipo: esq.tipo,
            userId: emp.uid,
            empleadoNombre: emp.displayName,
            mes: mesAnterior,
            anio: anioCalc,
            metricaCalculada: {
              valorMedido: resultado.valorMedido,
              unidad: resultado.unidad,
              objetivoAplicable: resultado.objetivoAplicable,
              cumplePct: resultado.cumplePct,
              detalle: resultado.detalle,
            },
            bonoCalculado: resultado.bono,
            moneda: esq.tipo === "bono_fijo" ? (esq.configuracion.moneda ?? "PEN") : "PEN",
            estado: "calculado",
            calculadoPor: "system",
            fechaCalculo: admin.firestore.Timestamp.now(),
          });
        }
      }

      if (calculos.length === 0) {
        functions.logger.info("[scheduledCalcularBonosMes] Sin cálculos a persistir");
        return null;
      }

      // Persistir en batches de 500 (límite Firestore)
      const CHUNK = 500;
      for (let i = 0; i < calculos.length; i += CHUNK) {
        const slice = calculos.slice(i, i + CHUNK);
        const batch = db.batch();
        slice.forEach((c) => {
          batch.set(db.collection(COLLECTIONS.CALCULOS_INCENTIVO).doc(c.id), c);
        });
        await batch.commit();
      }

      const totalBonos = calculos.reduce((s, c) => s + c.bonoCalculado, 0);
      functions.logger.info("[scheduledCalcularBonosMes] Completado", {
        mes: mesAnterior,
        anio: anioCalc,
        cantidad: calculos.length,
        totalBonos,
        esquemas: esquemas.length,
        empleados: empleados.length,
      });

      return null;
    } catch (err) {
      functions.logger.error("[scheduledCalcularBonosMes] Error", { err });
      throw err;
    }
  });

// ============================================================
// CF #2 · TRIGGER · liquidación aprobada → desactivar perfil + adelantos
// ============================================================

/**
 * Trigger: cuando una liquidación pasa de 'borrador' → 'aprobada'.
 * Acción SEGURA (sin tocar tesorería):
 *  - Desactiva PerfilLaboral del empleado (users/{uid}/private/laboral.activo = false)
 *  - Marca adelantos pendientes del empleado como 'descontado' con vínculo a la liquidación
 *  - Logging audit completo
 *
 * NO crea movimiento tesorería · NO crea gasto contable.
 * Esa acción la hace el usuario manualmente desde UI (decisión de cuenta).
 */
export const onLiquidacionAprobada = functions.firestore
  .document(`${COLLECTIONS.LIQUIDACIONES_EMPLEADO}/{liquidacionId}`)
  .onUpdate(async (change, context) => {
    const before = change.before.data() as { estado: EstadoLiquidacion; userId: string };
    const after = change.after.data() as {
      estado: EstadoLiquidacion;
      userId: string;
      empleadoNombre: string;
      netoALiquidar: number;
    };

    // Solo dispara en transición borrador → aprobada
    if (before.estado !== "borrador" || after.estado !== "aprobada") {
      return null;
    }

    const liquidacionId = context.params.liquidacionId;
    const userId = after.userId;
    const db = admin.firestore();

    functions.logger.info("[onLiquidacionAprobada] Procesando", {
      liquidacionId,
      userId,
      empleado: after.empleadoNombre,
      neto: after.netoALiquidar,
    });

    try {
      // 1. Desactivar PerfilLaboral · idempotente (si ya está inactivo, no hace nada)
      const perfilRef = db.collection(COLLECTIONS.USERS).doc(userId).collection("private").doc("laboral");
      const perfilSnap = await perfilRef.get();
      if (perfilSnap.exists && perfilSnap.data()?.activo === true) {
        await perfilRef.update({ activo: false });
        functions.logger.info("[onLiquidacionAprobada] PerfilLaboral desactivado", { userId });
      } else {
        functions.logger.info("[onLiquidacionAprobada] PerfilLaboral ya estaba inactivo · skip", { userId });
      }

      // 2. Marcar adelantos pendientes del empleado como descontado
      const adelantosSnap = await db
        .collection(COLLECTIONS.ADELANTOS_NOMINA)
        .where("userId", "==", userId)
        .where("estado", "==", "pendiente" as EstadoAdelanto)
        .get();

      if (!adelantosSnap.empty) {
        const batch = db.batch();
        const adelantoIds: string[] = [];
        adelantosSnap.docs.forEach((d) => {
          batch.update(d.ref, {
            estado: "descontado" as EstadoAdelanto,
            boletaDescontadaId: `LIQ-${liquidacionId}`, // referencia cruzada
          });
          adelantoIds.push(d.id);
        });
        await batch.commit();
        functions.logger.info("[onLiquidacionAprobada] Adelantos marcados como descontados", {
          userId,
          cantidad: adelantosSnap.size,
          ids: adelantoIds,
        });

        // Actualizar la liquidación con la lista de adelantos descontados
        await change.after.ref.update({ adelantosPendientes: adelantoIds });
      }

      functions.logger.info("[onLiquidacionAprobada] Completado · pendiente pago humano", {
        liquidacionId,
      });

      return null;
    } catch (err) {
      functions.logger.error("[onLiquidacionAprobada] Error", { liquidacionId, err });
      throw err;
    }
  });

// ============================================================
// CF #3 · TRIGGER · gratificación aprobada → log audit
// ============================================================

/**
 * Trigger: cuando una gratificación pasa de 'pendiente' → 'aprobada'.
 * Acción mínima: logging + audit trail.
 *
 * NO crea boleta extra automática · NO crea gasto · NO crea movimiento.
 * El admin la procesa manualmente desde UI eligiendo cuenta y fecha de pago.
 *
 * Esta CF existe principalmente para audit y para emitir notificación al
 * empleado (futuro) cuando se apruebe.
 */
export const onGratificacionAprobada = functions.firestore
  .document(`${COLLECTIONS.GRATIFICACIONES}/{gratificacionId}`)
  .onUpdate(async (change, context) => {
    const before = change.before.data() as { estado: EstadoGratificacion };
    const after = change.after.data() as {
      estado: EstadoGratificacion;
      userId: string;
      empleadoNombre: string;
      mes: number;
      anio: number;
      montoCalculado: number;
      moneda: string;
    };

    // Solo dispara en transición pendiente → aprobada
    if (before.estado !== "pendiente" || after.estado !== "aprobada") {
      return null;
    }

    const gratificacionId = context.params.gratificacionId;

    functions.logger.info("[onGratificacionAprobada] Gratificación aprobada · audit", {
      gratificacionId,
      userId: after.userId,
      empleado: after.empleadoNombre,
      periodo: `${after.mes}/${after.anio}`,
      monto: after.montoCalculado,
      moneda: after.moneda,
    });

    try {
      // Hook futuro: enviar notificación al empleado vía Resend / push
      // Por ahora · solo audit log (canónico para troubleshooting)
      return null;
    } catch (err) {
      functions.logger.error("[onGratificacionAprobada] Error", { gratificacionId, err });
      throw err;
    }
  });
