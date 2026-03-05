/**
 * BMN System - Cloud Functions
 *
 * Funciones serverless para automatización:
 * 1. Generar unidades de inventario al recibir OC
 * 2. Obtener tipo de cambio automático diario
 * 3. Recálculo de CTRU cuando se registran gastos
 * 4. Integración Mercado Libre (OAuth, webhooks, sync)
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Inicializar Firebase Admin ANTES de cualquier import que use admin
admin.initializeApp();

// ============================================================
// MERCADO LIBRE - Integración completa
// ============================================================
export {
  mlauthcallback,
  mlwebhook,
  mlrefreshtoken,
  mlgetauthurl,
  mlgetstatus,
  mlsyncitems,
  mlgetquestions,
  mlanswerquestion,
  mlvinculateproduct,
  mldesvincularproduct,
  mlsyncstock,
  mlupdateprice,
  mlprocesarorden,
  mlprocesarpendientes,
} from "./mercadolibre";
const db = admin.firestore();

// ============================================================
// FUNCIÓN 1: Generar unidades al cambiar OC a "recibida"
// ============================================================

/**
 * FUNCIÓN 1: Generar unidades al recibir OC en USA
 *
 * FLUJO CORRECTO según el modelo de negocio:
 * 1. OC se marca como "recibida" (en almacén/viajero USA)
 * 2. Se generan unidades con estado "recibida_usa"
 * 3. Posteriormente se crea una Transferencia USA → Perú
 * 4. Al recibir en Perú, las unidades pasan a "disponible_peru"
 */
export const onOrdenCompraRecibida = functions.firestore
  .document("ordenesCompra/{ordenId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Solo procesar si cambió a estado "recibida" y no se han generado unidades
    if (
      before.estado !== "recibida" &&
      after.estado === "recibida" &&
      !after.inventarioGenerado
    ) {
      const ordenId = context.params.ordenId;

      functions.logger.info(`Generando unidades para OC ${after.numeroOrden}`, {
        ordenId,
      });

      try {
        const batch = db.batch();
        const unidadesGeneradas: string[] = [];
        let unidadCount = 1;

        // Obtener TC de pago para calcular costos
        const tcCompra = after.tcCompra || 3.7;
        const tcPago = after.tcPago || tcCompra;

        // Obtener datos del almacén/viajero destino
        const almacenDestinoId = after.almacenDestinoId;
        let almacenNombre = "Almacén USA";
        let almacenCodigo = "USA";

        if (almacenDestinoId) {
          const almacenSnap = await db.collection("almacenes").doc(almacenDestinoId).get();
          if (almacenSnap.exists) {
            const almacenData = almacenSnap.data();
            almacenNombre = almacenData?.nombre || almacenNombre;
            almacenCodigo = almacenData?.codigo || almacenCodigo;
          }
        }

        // Generar unidades para cada producto
        for (const producto of after.productos) {
          // Obtener el costo de flete fijo del producto
          let costoFleteUSD = 0;
          const productoSnap = await db.collection("productos").doc(producto.productoId).get();
          if (productoSnap.exists) {
            const productoData = productoSnap.data();
            costoFleteUSD = productoData?.costoFleteUSAPeru || 0;
          }

          for (let i = 0; i < producto.cantidad; i++) {
            const unidadRef = db.collection("unidades").doc();
            const codigoUnidad = `${after.numeroOrden}-${String(
              unidadCount
            ).padStart(3, "0")}`;

            // Calcular costos
            const costoUnitarioUSD = producto.costoUnitario;
            const costoTotalUSD = costoUnitarioUSD + costoFleteUSD;

            // El CTRU se calculará al llegar a Perú, por ahora solo base
            const ctruBase = costoTotalUSD * tcPago;

            const unidadData = {
              // Identificación
              productoId: producto.productoId,
              sku: producto.sku,
              productoNombre: producto.nombre || producto.sku,
              numeroUnidad: unidadCount,
              codigoUnidad,
              lote: producto.lote || null,
              fechaVencimiento: producto.fechaVencimiento || null,

              // Trazabilidad
              ordenCompraId: ordenId,
              numeroOrden: after.numeroOrden,
              proveedorId: after.proveedorId,

              // === ESTADO: recibida_usa (NO disponible_peru) ===
              estado: "recibida_usa",
              paisActual: "USA",

              // Ubicación en USA (almacén/viajero)
              almacenActualId: almacenDestinoId || null,
              almacenActualNombre: almacenNombre,
              almacenActualCodigo: almacenCodigo,

              // Costos
              costoUnitarioUSD,
              costoFleteUSD,  // Flete FIJO del producto
              costoTotalUSD,
              tcCompra,
              tcPago,

              // CTRU (se completará al recibir en Perú)
              ctruBase,
              ctruGastos: 0,
              ctruDinamico: ctruBase,

              // Fechas
              fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
              fechaRecepcionUSA: admin.firestore.FieldValue.serverTimestamp(),
              // fechaLlegadaPeru se llenará cuando llegue a Perú

              // Historial inicial
              historial: [{
                id: `mov-${Date.now()}`,
                fecha: admin.firestore.FieldValue.serverTimestamp(),
                tipo: "recepcion_usa",
                estadoAnterior: null,
                estadoNuevo: "recibida_usa",
                almacenDestinoId: almacenDestinoId || null,
                almacenDestinoNombre: almacenNombre,
                referenciaId: ordenId,
                referenciaTipo: "orden_compra",
                referenciaNumero: after.numeroOrden,
                motivo: "Recepción de OC en almacén USA",
                realizadoPor: "system",
              }],

              // Auditoría
              creadoPor: after.creadoPor || "system",
            };

            batch.set(unidadRef, unidadData);
            unidadesGeneradas.push(unidadRef.id);
            unidadCount++;
          }
        }

        // Actualizar orden con referencia a unidades generadas
        const ordenRef = db.collection("ordenesCompra").doc(ordenId);
        batch.update(ordenRef, {
          inventarioGenerado: true,
          unidadesGeneradas,
          fechaGeneracionInventario:
            admin.firestore.FieldValue.serverTimestamp(),
        });

        // Incrementar contador de unidades en el almacén/viajero
        if (almacenDestinoId) {
          const almacenRef = db.collection("almacenes").doc(almacenDestinoId);
          batch.update(almacenRef, {
            totalUnidadesRecibidas: admin.firestore.FieldValue.increment(unidadesGeneradas.length),
            unidadesActuales: admin.firestore.FieldValue.increment(unidadesGeneradas.length),
          });
        }

        await batch.commit();

        functions.logger.info(
          `✅ Generadas ${unidadesGeneradas.length} unidades en USA para OC ${after.numeroOrden}`
        );

        return { success: true, unidadesGeneradas: unidadesGeneradas.length };
      } catch (error) {
        functions.logger.error("Error generando unidades:", error);
        throw new functions.https.HttpsError(
          "internal",
          "Error generando unidades de inventario"
        );
      }
    }

    return null;
  });

// ============================================================
// FUNCIÓN 2: Obtener Tipo de Cambio Automático (SUNAT/SBS)
// ============================================================

import axios from "axios";

interface TipoCambioAPI {
  compra: number;
  venta: number;
  fecha: string;
}

/**
 * Función programada: Obtiene TC diario a las 9:00 AM (hora Perú)
 * Se ejecuta de lunes a viernes
 */
export const obtenerTipoCambioDiario = functions.pubsub
  .schedule("0 9 * * 1-5") // 9:00 AM, lunes a viernes
  .timeZone("America/Lima")
  .onRun(async () => {
    functions.logger.info("Iniciando obtención de tipo de cambio diario");

    try {
      // Intentar obtener de API de SUNAT (o alternativa)
      const tc = await obtenerTCDeAPI();

      if (tc) {
        // Guardar en Firestore
        const hoy = new Date();
        const fechaStr = hoy.toISOString().split("T")[0]; // YYYY-MM-DD

        const tcRef = db.collection("tiposCambio").doc(fechaStr);

        await tcRef.set({
          fecha: admin.firestore.Timestamp.fromDate(hoy),
          compra: tc.compra,
          venta: tc.venta,
          fuente: "API_SBS",
          fechaObtencion: admin.firestore.FieldValue.serverTimestamp(),
          esAutomatico: true,
        });

        functions.logger.info(`✅ TC guardado: Compra ${tc.compra}, Venta ${tc.venta}`);
        return { success: true, tc };
      }

      functions.logger.warn("No se pudo obtener TC de API");
      return { success: false, error: "No se pudo obtener TC" };
    } catch (error) {
      functions.logger.error("Error obteniendo TC:", error);
      return { success: false, error: String(error) };
    }
  });

/**
 * Función HTTP para obtener TC manualmente
 */
export const obtenerTipoCambioManual = functions.https.onCall(async () => {
  try {
    const tc = await obtenerTCDeAPI();

    if (tc) {
      const hoy = new Date();
      const fechaStr = hoy.toISOString().split("T")[0];

      const tcRef = db.collection("tiposCambio").doc(fechaStr);

      await tcRef.set(
        {
          fecha: admin.firestore.Timestamp.fromDate(hoy),
          compra: tc.compra,
          venta: tc.venta,
          fuente: "API_SBS",
          fechaObtencion: admin.firestore.FieldValue.serverTimestamp(),
          esAutomatico: false,
        },
        { merge: true }
      );

      return { success: true, tc };
    }

    throw new functions.https.HttpsError(
      "unavailable",
      "No se pudo obtener el tipo de cambio"
    );
  } catch (error) {
    functions.logger.error("Error en obtención manual de TC:", error);
    throw new functions.https.HttpsError("internal", "Error obteniendo TC");
  }
});

/**
 * Obtiene TC de API externa (SBS o alternativa)
 */
async function obtenerTCDeAPI(): Promise<TipoCambioAPI | null> {
  try {
    // Opción 1: API de la SBS (requiere verificar disponibilidad)
    // const response = await axios.get('https://api.apis.net.pe/v1/tipo-cambio-sunat');

    // Opción 2: API alternativa gratuita
    const response = await axios.get(
      "https://api.exchangerate-api.com/v4/latest/USD"
    );

    if (response.data && response.data.rates && response.data.rates.PEN) {
      const ventaUSD = response.data.rates.PEN;
      // Aproximación: compra suele ser ~0.5% menor que venta
      const compraUSD = ventaUSD * 0.995;

      return {
        compra: Math.round(compraUSD * 1000) / 1000,
        venta: Math.round(ventaUSD * 1000) / 1000,
        fecha: new Date().toISOString(),
      };
    }

    return null;
  } catch (error) {
    functions.logger.error("Error llamando API de TC:", error);

    // Fallback: valores por defecto si la API falla
    // En producción, podrías tener un valor almacenado como fallback
    return null;
  }
}

// ============================================================
// FUNCIÓN 3: Recalcular CTRU al registrar gasto prorrateable
// ============================================================

export const onGastoCreado = functions.firestore
  .document("gastos/{gastoId}")
  .onCreate(async (snapshot, context) => {
    const gasto = snapshot.data();

    // Solo procesar gastos prorrateables que impactan CTRU
    if (!gasto.esProrrateable || !gasto.impactaCTRU) {
      return null;
    }

    const gastoId = context.params.gastoId;
    functions.logger.info(`Procesando gasto prorrateable ${gasto.numeroGasto}`, {
      gastoId,
    });

    try {
      // Determinar unidades afectadas según tipo de prorrateo
      let unidadesSnapshot;

      if (gasto.prorrateoTipo === "oc" && gasto.ordenCompraId) {
        // Prorratear entre unidades de una OC específica
        unidadesSnapshot = await db
          .collection("unidades")
          .where("ordenCompraId", "==", gasto.ordenCompraId)
          .where("estado", "in", [
            "disponible_peru",
            "asignada_pedido",
          ])
          .get();
      } else {
        // Prorratear entre todas las unidades disponibles del mes
        const inicioMes = new Date(gasto.anio, gasto.mes - 1, 1);
        const finMes = new Date(gasto.anio, gasto.mes, 0, 23, 59, 59);

        unidadesSnapshot = await db
          .collection("unidades")
          .where("estado", "in", [
            "disponible_peru",
            "asignada_pedido",
          ])
          .where("fechaLlegadaPeru", ">=", inicioMes)
          .where("fechaLlegadaPeru", "<=", finMes)
          .get();
      }

      if (unidadesSnapshot.empty) {
        functions.logger.warn("No hay unidades para prorratear el gasto");
        return null;
      }

      const totalUnidades = unidadesSnapshot.size;
      const montoPorUnidad = gasto.montoPEN / totalUnidades;

      const batch = db.batch();
      const unidadesIds: string[] = [];

      unidadesSnapshot.docs.forEach((doc) => {
        const unidad = doc.data();
        const nuevoCtruGastos = (unidad.ctruGastos || 0) + montoPorUnidad;
        const nuevoCtruDinamico = (unidad.ctruBase || 0) + nuevoCtruGastos;

        batch.update(doc.ref, {
          ctruGastos: nuevoCtruGastos,
          ctruDinamico: nuevoCtruDinamico,
          ultimoRecalculoCTRU: admin.firestore.FieldValue.serverTimestamp(),
        });

        unidadesIds.push(doc.id);
      });

      // Marcar gasto como recalculado
      batch.update(snapshot.ref, {
        ctruRecalculado: true,
        fechaRecalculoCTRU: admin.firestore.FieldValue.serverTimestamp(),
        unidadesAfectadas: totalUnidades,
        montoPorUnidad,
      });

      await batch.commit();

      functions.logger.info(
        `✅ CTRU actualizado en ${totalUnidades} unidades. Impacto: S/ ${montoPorUnidad.toFixed(4)}/unidad`
      );

      // Registrar en historial
      await db.collection("historialRecalculoCTRU").add({
        gastoId,
        numeroGasto: gasto.numeroGasto,
        montoGasto: gasto.montoPEN,
        unidadesAfectadas: totalUnidades,
        impactoPorUnidad: montoPorUnidad,
        fechaRecalculo: admin.firestore.FieldValue.serverTimestamp(),
        ejecutadoPor: "system",
      });

      return { success: true, unidadesAfectadas: totalUnidades, montoPorUnidad };
    } catch (error) {
      functions.logger.error("Error recalculando CTRU:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error recalculando CTRU"
      );
    }
  });

// ============================================================
// FUNCIÓN 4: Limpiar caché y estadísticas diarias (opcional)
// ============================================================

export const limpiezaDiaria = functions.pubsub
  .schedule("0 1 * * *") // 1:00 AM diario
  .timeZone("America/Lima")
  .onRun(async () => {
    functions.logger.info("Iniciando limpieza diaria");

    // Aquí puedes agregar tareas de mantenimiento:
    // - Limpiar documentos temporales
    // - Consolidar estadísticas
    // - Archivar datos antiguos

    return null;
  });

// ============================================================
// FUNCIÓN 5: Gestión de Usuarios (Admin Only)
// ============================================================

/**
 * Permisos disponibles en el sistema (30 permisos granulares)
 * MIRROR de src/types/auth.types.ts - mantener sincronizado
 */
const PERMISOS = {
  // General
  VER_DASHBOARD: "ver_dashboard",
  // Ventas
  VER_VENTAS: "ver_ventas",
  CREAR_VENTA: "crear_venta",
  EDITAR_VENTA: "editar_venta",
  CONFIRMAR_VENTA: "confirmar_venta",
  CANCELAR_VENTA: "cancelar_venta",
  // Cotizaciones
  VER_COTIZACIONES: "ver_cotizaciones",
  CREAR_COTIZACION: "crear_cotizacion",
  VALIDAR_COTIZACION: "validar_cotizacion",
  // Entregas
  VER_ENTREGAS: "ver_entregas",
  PROGRAMAR_ENTREGA: "programar_entrega",
  REGISTRAR_ENTREGA: "registrar_entrega",
  // Compras
  VER_REQUERIMIENTOS: "ver_requerimientos",
  CREAR_REQUERIMIENTO: "crear_requerimiento",
  APROBAR_REQUERIMIENTO: "aprobar_requerimiento",
  VER_ORDENES_COMPRA: "ver_ordenes_compra",
  CREAR_OC: "crear_oc",
  RECIBIR_OC: "recibir_oc",
  // Inventario
  VER_INVENTARIO: "ver_inventario",
  GESTIONAR_INVENTARIO: "gestionar_inventario",
  TRANSFERIR_UNIDADES: "transferir_unidades",
  // Finanzas
  VER_GASTOS: "ver_gastos",
  CREAR_GASTO: "crear_gasto",
  VER_TESORERIA: "ver_tesoreria",
  GESTIONAR_TESORERIA: "gestionar_tesoreria",
  VER_REPORTES: "ver_reportes",
  VER_CTRU: "ver_ctru",
  // Administración
  GESTIONAR_USUARIOS: "gestionar_usuarios",
  GESTIONAR_CONFIGURACION: "gestionar_configuracion",
  VER_AUDITORIA: "ver_auditoria",
  ADMIN_TOTAL: "admin_total",
};

/**
 * Roles predefinidos con sus permisos (8 roles)
 * MIRROR de src/types/auth.types.ts - mantener sincronizado
 */
const ROLES_PERMISOS: Record<string, string[]> = {
  admin: Object.values(PERMISOS),
  gerente: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_VENTAS, PERMISOS.CREAR_VENTA, PERMISOS.EDITAR_VENTA,
    PERMISOS.CONFIRMAR_VENTA, PERMISOS.CANCELAR_VENTA,
    PERMISOS.VER_COTIZACIONES, PERMISOS.CREAR_COTIZACION, PERMISOS.VALIDAR_COTIZACION,
    PERMISOS.VER_ENTREGAS, PERMISOS.PROGRAMAR_ENTREGA, PERMISOS.REGISTRAR_ENTREGA,
    PERMISOS.VER_REQUERIMIENTOS, PERMISOS.CREAR_REQUERIMIENTO, PERMISOS.APROBAR_REQUERIMIENTO,
    PERMISOS.VER_ORDENES_COMPRA, PERMISOS.CREAR_OC, PERMISOS.RECIBIR_OC,
    PERMISOS.VER_INVENTARIO, PERMISOS.GESTIONAR_INVENTARIO, PERMISOS.TRANSFERIR_UNIDADES,
    PERMISOS.VER_GASTOS, PERMISOS.CREAR_GASTO,
    PERMISOS.VER_TESORERIA, PERMISOS.GESTIONAR_TESORERIA,
    PERMISOS.VER_REPORTES, PERMISOS.VER_CTRU,
    PERMISOS.VER_AUDITORIA,
  ],
  vendedor: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_VENTAS, PERMISOS.CREAR_VENTA, PERMISOS.EDITAR_VENTA,
    PERMISOS.CONFIRMAR_VENTA, PERMISOS.CANCELAR_VENTA,
    PERMISOS.VER_COTIZACIONES, PERMISOS.CREAR_COTIZACION, PERMISOS.VALIDAR_COTIZACION,
    PERMISOS.VER_ENTREGAS, PERMISOS.PROGRAMAR_ENTREGA, PERMISOS.REGISTRAR_ENTREGA,
    PERMISOS.VER_REQUERIMIENTOS, PERMISOS.CREAR_REQUERIMIENTO,
    PERMISOS.VER_ORDENES_COMPRA,
    PERMISOS.VER_INVENTARIO,
    PERMISOS.VER_GASTOS,
    PERMISOS.VER_REPORTES,
  ],
  comprador: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_REQUERIMIENTOS, PERMISOS.CREAR_REQUERIMIENTO, PERMISOS.APROBAR_REQUERIMIENTO,
    PERMISOS.VER_ORDENES_COMPRA, PERMISOS.CREAR_OC, PERMISOS.RECIBIR_OC,
    PERMISOS.VER_INVENTARIO, PERMISOS.GESTIONAR_INVENTARIO, PERMISOS.TRANSFERIR_UNIDADES,
    PERMISOS.VER_GASTOS,
  ],
  almacenero: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_INVENTARIO, PERMISOS.GESTIONAR_INVENTARIO, PERMISOS.TRANSFERIR_UNIDADES,
    PERMISOS.RECIBIR_OC,
    PERMISOS.VER_ORDENES_COMPRA,
    PERMISOS.VER_VENTAS,
    PERMISOS.VER_ENTREGAS,
  ],
  finanzas: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_GASTOS, PERMISOS.CREAR_GASTO,
    PERMISOS.VER_TESORERIA, PERMISOS.GESTIONAR_TESORERIA,
    PERMISOS.VER_REPORTES, PERMISOS.VER_CTRU,
    PERMISOS.VER_VENTAS,
    PERMISOS.VER_ORDENES_COMPRA,
    PERMISOS.VER_AUDITORIA,
  ],
  supervisor: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_VENTAS,
    PERMISOS.VER_COTIZACIONES,
    PERMISOS.VER_ENTREGAS,
    PERMISOS.VER_REQUERIMIENTOS,
    PERMISOS.VER_ORDENES_COMPRA,
    PERMISOS.VER_INVENTARIO,
    PERMISOS.VER_GASTOS,
    PERMISOS.VER_TESORERIA,
    PERMISOS.VER_REPORTES,
    PERMISOS.VER_CTRU,
    PERMISOS.VER_AUDITORIA,
  ],
  invitado: [],
};

interface CreateUserData {
  email: string;
  password: string;
  displayName: string;
  role: string;
  permisos?: string[];
}

interface UpdateUserRoleData {
  uid: string;
  role: string;
  permisos: string[];
}

interface DeleteUserData {
  uid: string;
}

/**
 * Verifica si el usuario que llama es admin
 */
async function verificarAdmin(context: functions.https.CallableContext): Promise<void> {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Debes estar autenticado"
    );
  }

  const adminDoc = await db.collection("users").doc(context.auth.uid).get();

  if (!adminDoc.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Usuario no encontrado"
    );
  }

  const adminData = adminDoc.data();
  const esAdmin = adminData?.role === "admin" ||
    adminData?.permisos?.includes(PERMISOS.ADMIN_TOTAL) ||
    adminData?.permisos?.includes(PERMISOS.GESTIONAR_USUARIOS);

  if (!esAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "No tienes permisos de administrador"
    );
  }
}

/**
 * Crear un nuevo usuario (solo admin)
 * Esta función usa Firebase Admin SDK para crear usuarios sin cerrar la sesión del admin
 */
export const createUser = functions.https.onCall(
  async (data: CreateUserData, context) => {
    // Verificar que quien llama es admin
    await verificarAdmin(context);

    const { email, password, displayName, role, permisos } = data;

    // Validaciones
    if (!email || !password || !displayName) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Email, contraseña y nombre son requeridos"
      );
    }

    if (password.length < 6) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "La contraseña debe tener al menos 6 caracteres"
      );
    }

    const validRole = role || "invitado";
    if (!ROLES_PERMISOS[validRole]) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Rol no válido"
      );
    }

    try {
      // Crear usuario en Firebase Auth usando Admin SDK
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
        emailVerified: false,
      });

      functions.logger.info(`Usuario creado en Auth: ${userRecord.uid}`);

      // Determinar permisos (usar los del rol si no se especifican)
      const permisosFinales = permisos && permisos.length > 0
        ? permisos
        : ROLES_PERMISOS[validRole];

      // Crear perfil en Firestore
      const userProfile = {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName,
        role: validRole,
        permisos: permisosFinales,
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        creadoPor: context.auth!.uid,
        activo: true,
      };

      await db.collection("users").doc(userRecord.uid).set(userProfile);

      functions.logger.info(`Perfil creado en Firestore para: ${userRecord.uid}`);

      return {
        success: true,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName,
          role: validRole,
          permisos: permisosFinales,
        },
      };
    } catch (error: unknown) {
      functions.logger.error("Error creando usuario:", error);

      const firebaseError = error as { code?: string; message?: string };

      if (firebaseError.code === "auth/email-already-exists") {
        throw new functions.https.HttpsError(
          "already-exists",
          "Ya existe un usuario con este email"
        );
      }

      if (firebaseError.code === "auth/invalid-email") {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "El email no es válido"
        );
      }

      if (firebaseError.code === "auth/weak-password") {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "La contraseña es muy débil"
        );
      }

      throw new functions.https.HttpsError(
        "internal",
        firebaseError.message || "Error creando usuario"
      );
    }
  }
);

/**
 * Actualizar rol y permisos de un usuario (solo admin)
 */
export const updateUserRole = functions.https.onCall(
  async (data: UpdateUserRoleData, context) => {
    await verificarAdmin(context);

    const { uid, role, permisos } = data;

    if (!uid) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "UID del usuario es requerido"
      );
    }

    // Verificar que el usuario existe
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Usuario no encontrado"
      );
    }

    // No permitir que un admin se quite sus propios permisos de admin
    if (uid === context.auth!.uid && role !== "admin") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No puedes quitarte tus propios permisos de administrador"
      );
    }

    try {
      await db.collection("users").doc(uid).update({
        role,
        permisos,
        ultimaEdicion: admin.firestore.FieldValue.serverTimestamp(),
        editadoPor: context.auth!.uid,
      });

      functions.logger.info(`Rol actualizado para usuario ${uid}: ${role}`);

      return { success: true };
    } catch (error) {
      functions.logger.error("Error actualizando rol:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error actualizando rol de usuario"
      );
    }
  }
);

/**
 * Eliminar usuario (solo admin)
 */
export const deleteUser = functions.https.onCall(
  async (data: DeleteUserData, context) => {
    await verificarAdmin(context);

    const { uid } = data;

    if (!uid) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "UID del usuario es requerido"
      );
    }

    // No permitir auto-eliminación
    if (uid === context.auth!.uid) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No puedes eliminarte a ti mismo"
      );
    }

    try {
      // Eliminar de Firebase Auth
      await admin.auth().deleteUser(uid);

      // Eliminar perfil de Firestore
      await db.collection("users").doc(uid).delete();

      functions.logger.info(`Usuario eliminado: ${uid}`);

      return { success: true };
    } catch (error) {
      functions.logger.error("Error eliminando usuario:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error eliminando usuario"
      );
    }
  }
);

/**
 * Resetear contraseña de usuario (solo admin)
 */
export const resetUserPassword = functions.https.onCall(
  async (data: { uid: string; newPassword: string }, context) => {
    await verificarAdmin(context);

    const { uid, newPassword } = data;

    if (!uid || !newPassword) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "UID y nueva contraseña son requeridos"
      );
    }

    if (newPassword.length < 6) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "La contraseña debe tener al menos 6 caracteres"
      );
    }

    try {
      await admin.auth().updateUser(uid, { password: newPassword });

      functions.logger.info(`Contraseña reseteada para usuario: ${uid}`);

      return { success: true };
    } catch (error) {
      functions.logger.error("Error reseteando contraseña:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error reseteando contraseña"
      );
    }
  }
);

// ============================================================
// FUNCIÓN 7: Cambiar Contraseña Propia (Self-Service)
// ============================================================

/**
 * Permite a un usuario autenticado cambiar su propia contraseña.
 * Usa context.auth.uid (NO data.uid) para seguridad contra IDOR.
 */
export const changeOwnPassword = functions.https.onCall(
  async (data: { newPassword: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Debes estar autenticado"
      );
    }

    const { newPassword } = data;

    if (!newPassword || newPassword.length < 6) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "La contraseña debe tener al menos 6 caracteres"
      );
    }

    try {
      // Usar context.auth.uid (seguro, no manipulable por el cliente)
      await admin.auth().updateUser(context.auth.uid, { password: newPassword });

      functions.logger.info(`Usuario ${context.auth.uid} cambió su contraseña`);

      return { success: true };
    } catch (error) {
      functions.logger.error("Error cambiando contraseña propia:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error al cambiar la contraseña"
      );
    }
  }
);

// ============================================================
// FUNCIÓN 8: Forzar Desconexión de Usuarios (Admin Only)
// ============================================================

/**
 * Desconectar un usuario específico: revoca tokens + marca en Firestore.
 * El cliente detecta el campo `forceLogoutAt` y cierra sesión automáticamente.
 */
export const forceDisconnectUser = functions.https.onCall(
  async (data: { uid: string }, context) => {
    await verificarAdmin(context);

    const { uid } = data;

    if (!uid) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "UID del usuario es requerido"
      );
    }

    // No permitir auto-desconexión
    if (uid === context.auth!.uid) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No puedes desconectarte a ti mismo desde aquí"
      );
    }

    try {
      // 1. Revocar refresh tokens en Firebase Auth
      await admin.auth().revokeRefreshTokens(uid);

      // 2. Marcar en Firestore para que el cliente detecte y cierre sesión
      await db.collection("users").doc(uid).update({
        forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Usuario ${uid} desconectado forzosamente por ${context.auth!.uid}`);

      return { success: true };
    } catch (error) {
      functions.logger.error("Error desconectando usuario:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error al desconectar usuario"
      );
    }
  }
);

// ============================================================
// FUNCIÓN 9: Crear sala Daily.co para videollamadas
// ============================================================

interface CreateDailyRoomData {
  roomName: string;
  isTeamCall: boolean;
}

/**
 * Crea una sala en Daily.co via REST API.
 * Si la sala ya existe (409), retorna la URL existente.
 */
export const createDailyRoom = functions.https.onCall(
  async (data: CreateDailyRoomData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Debes estar autenticado"
      );
    }

    const { roomName } = data;
    if (!roomName) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "roomName es requerido"
      );
    }

    const apiKey = process.env.DAILY_API_KEY;
    if (!apiKey) {
      functions.logger.error("DAILY_API_KEY not configured in functions/.env");
      throw new functions.https.HttpsError(
        "internal",
        "Video service not configured"
      );
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    // Helper: create a new room
    const createRoom = async () => {
      const response = await axios.post(
        "https://api.daily.co/v1/rooms",
        {
          name: roomName,
          privacy: "public",
          properties: {
            exp: Math.floor(Date.now() / 1000) + 3600,
            enable_chat: true,
            enable_screenshare: true,
            enable_prejoin_ui: false,
            lang: "es",
            start_audio_off: false,
            start_video_off: true,
          },
        },
        { headers }
      );
      return response.data;
    };

    // Helper: get existing room
    const getRoom = async () => {
      const response = await axios.get(
        `https://api.daily.co/v1/rooms/${roomName}`,
        { headers }
      );
      return response.data;
    };

    // Helper: delete a room
    const deleteRoom = async () => {
      await axios.delete(
        `https://api.daily.co/v1/rooms/${roomName}`,
        { headers }
      );
    };

    try {
      const room = await createRoom();
      functions.logger.info(`Daily room created: ${room.url}`, {
        roomName,
        userId: context.auth.uid,
      });
      return { success: true, roomUrl: room.url, roomName: room.name };
    } catch (error: unknown) {
      const axErr = error as { response?: { status?: number; data?: unknown }; message?: string };
      const status = axErr.response?.status;
      const detail = JSON.stringify(axErr.response?.data || axErr.message || error);

      functions.logger.warn(`Daily create failed (${status}): ${detail}`, {
        roomName,
        userId: context.auth.uid,
      });

      // Room already exists (400 "already exists" or 409) — reuse or recreate
      const dataStr = JSON.stringify(axErr.response?.data || "");
      const alreadyExists = status === 409
        || (status === 400 && dataStr.includes("already exists"));

      if (alreadyExists) {
        try {
          const existing = await getRoom();
          const now = Math.floor(Date.now() / 1000);

          // If room expired, delete and recreate
          if (existing.config?.exp && existing.config.exp < now) {
            functions.logger.info(`Room ${roomName} expired, recreating...`);
            await deleteRoom();
            const fresh = await createRoom();
            return { success: true, roomUrl: fresh.url, roomName: fresh.name };
          }

          // Room still valid — reuse it
          functions.logger.info(`Reusing existing room: ${existing.url}`);
          return { success: true, roomUrl: existing.url, roomName: existing.name };
        } catch (getErr: unknown) {
          const gErr = getErr as { response?: { status?: number; data?: unknown }; message?: string };
          const gDetail = JSON.stringify(gErr.response?.data || gErr.message || getErr);
          functions.logger.error(`409 recovery failed: ${gDetail}`);
          throw new functions.https.HttpsError(
            "internal",
            `Room exists but recovery failed: ${gDetail}`
          );
        }
      }

      throw new functions.https.HttpsError(
        "internal",
        `Daily API error (${status}): ${detail}`
      );
    }
  }
);

/**
 * Desconectar TODOS los usuarios excepto el admin que ejecuta la acción.
 */
export const forceDisconnectAll = functions.https.onCall(
  async (_data: unknown, context) => {
    await verificarAdmin(context);

    try {
      // Obtener todos los usuarios activos excepto el admin actual
      const usersSnapshot = await db
        .collection("users")
        .where("activo", "==", true)
        .get();

      let disconnected = 0;
      const batch = db.batch();
      const revokePromises: Promise<void>[] = [];

      usersSnapshot.docs.forEach((doc) => {
        if (doc.id !== context.auth!.uid) {
          // Revocar tokens
          revokePromises.push(admin.auth().revokeRefreshTokens(doc.id));

          // Marcar en Firestore
          batch.update(doc.ref, {
            forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          disconnected++;
        }
      });

      // Ejecutar todo en paralelo
      await Promise.all([
        ...revokePromises,
        batch.commit(),
      ]);

      functions.logger.info(
        `${disconnected} usuarios desconectados forzosamente por ${context.auth!.uid}`
      );

      return { success: true, disconnected };
    } catch (error) {
      functions.logger.error("Error desconectando todos los usuarios:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error al desconectar usuarios"
      );
    }
  }
);

// ============================================================
// FUNCIÓN 11: Recalcular Métricas de Clientes y Marcas
// ============================================================

/**
 * Recalcula las métricas desnormalizadas de clientes y marcas
 * basándose en las ventas reales existentes en Firestore.
 * Solo admin puede ejecutarla.
 */
export const recalcularMetricas = functions.https.onCall(
  async (_data: unknown, context) => {
    await verificarAdmin(context);

    try {
      // 1. Leer todas las ventas (no anuladas)
      const ventasSnap = await db.collection("ventas").get();
      const ventas = ventasSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((v: any) => v.estado !== "anulada" && v.estado !== "cancelada");

      // 2. Agregar métricas por clienteId
      const clienteMetricas: Record<string, {
        totalCompras: number;
        montoTotalPEN: number;
        ultimaCompra: any;
      }> = {};

      for (const venta of ventas as any[]) {
        const cid = venta.clienteId;
        if (!cid) continue;

        if (!clienteMetricas[cid]) {
          clienteMetricas[cid] = { totalCompras: 0, montoTotalPEN: 0, ultimaCompra: null };
        }
        clienteMetricas[cid].totalCompras += 1;
        clienteMetricas[cid].montoTotalPEN += (venta.totalPEN || 0);

        const fechaVenta = venta.fechaVenta || venta.fechaCreacion;
        if (fechaVenta && (!clienteMetricas[cid].ultimaCompra ||
          fechaVenta.toMillis?.() > clienteMetricas[cid].ultimaCompra.toMillis?.())) {
          clienteMetricas[cid].ultimaCompra = fechaVenta;
        }
      }

      // 3. Agregar métricas por marca (via productos en ventas)
      const marcaVentas: Record<string, {
        unidadesVendidas: number;
        ventasTotalPEN: number;
        ultimaVenta: any;
      }> = {};

      for (const venta of ventas as any[]) {
        if (!venta.productos) continue;
        for (const prod of venta.productos) {
          const mid = prod.marcaId;
          if (!mid) continue;

          if (!marcaVentas[mid]) {
            marcaVentas[mid] = { unidadesVendidas: 0, ventasTotalPEN: 0, ultimaVenta: null };
          }
          marcaVentas[mid].unidadesVendidas += (prod.cantidad || 1);
          marcaVentas[mid].ventasTotalPEN += (prod.subtotal || 0);

          const fechaVenta = venta.fechaVenta || venta.fechaCreacion;
          if (fechaVenta && (!marcaVentas[mid].ultimaVenta ||
            fechaVenta.toMillis?.() > marcaVentas[mid].ultimaVenta.toMillis?.())) {
            marcaVentas[mid].ultimaVenta = fechaVenta;
          }
        }
      }

      // 4. Actualizar clientes en batches de 500
      const clientesSnap = await db.collection("clientes").get();
      let clientesActualizados = 0;
      let batch = db.batch();
      let batchCount = 0;

      for (const doc of clientesSnap.docs) {
        const metricas = clienteMetricas[doc.id] || {
          totalCompras: 0, montoTotalPEN: 0, ultimaCompra: null
        };
        const ticketPromedio = metricas.totalCompras > 0
          ? metricas.montoTotalPEN / metricas.totalCompras : 0;

        const updateData: any = {
          "metricas.totalCompras": metricas.totalCompras,
          "metricas.montoTotalPEN": Math.round(metricas.montoTotalPEN * 100) / 100,
          "metricas.ticketPromedio": Math.round(ticketPromedio * 100) / 100,
        };
        if (metricas.ultimaCompra) {
          updateData["metricas.ultimaCompra"] = metricas.ultimaCompra;
        }

        batch.update(doc.ref, updateData);
        batchCount++;
        clientesActualizados++;

        if (batchCount >= 450) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
      if (batchCount > 0) await batch.commit();

      // 5. Actualizar marcas en batches de 500
      // Primero contar productos activos por marca
      const productosSnap = await db.collection("productos").get();
      const productosActivosPorMarca: Record<string, number> = {};
      for (const doc of productosSnap.docs) {
        const p = doc.data();
        const mid = p.marcaId;
        if (mid && p.estado === "activo") {
          productosActivosPorMarca[mid] = (productosActivosPorMarca[mid] || 0) + 1;
        }
      }

      const marcasSnap = await db.collection("marcas").get();
      let marcasActualizadas = 0;
      batch = db.batch();
      batchCount = 0;

      for (const doc of marcasSnap.docs) {
        const mv = marcaVentas[doc.id] || {
          unidadesVendidas: 0, ventasTotalPEN: 0, ultimaVenta: null
        };
        const productosActivos = productosActivosPorMarca[doc.id] || 0;

        const updateData: any = {
          "metricas.productosActivos": productosActivos,
          "metricas.unidadesVendidas": mv.unidadesVendidas,
          "metricas.ventasTotalPEN": Math.round(mv.ventasTotalPEN * 100) / 100,
          "metricas.margenPromedio": 0,
        };
        if (mv.ultimaVenta) {
          updateData["metricas.ultimaVenta"] = mv.ultimaVenta;
        }

        batch.update(doc.ref, updateData);
        batchCount++;
        marcasActualizadas++;

        if (batchCount >= 450) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
      if (batchCount > 0) await batch.commit();

      functions.logger.info(
        `✅ Métricas recalculadas: ${clientesActualizados} clientes, ${marcasActualizadas} marcas, desde ${ventas.length} ventas`
      );

      return {
        success: true,
        ventasProcesadas: ventas.length,
        clientesActualizados,
        marcasActualizadas,
      };
    } catch (error) {
      functions.logger.error("Error recalculando métricas:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error recalculando métricas"
      );
    }
  }
);
