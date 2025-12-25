/**
 * BMN System - Cloud Functions
 *
 * Funciones serverless para automatización:
 * 1. Generar unidades de inventario al recibir OC
 * 2. Obtener tipo de cambio automático diario
 * 3. Recálculo de CTRU cuando se registran gastos
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Inicializar Firebase Admin
admin.initializeApp();
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
 * Permisos disponibles en el sistema
 */
const PERMISOS = {
  VER_DASHBOARD: "ver_dashboard",
  VER_VENTAS: "ver_ventas",
  CREAR_VENTA: "crear_venta",
  EDITAR_VENTA: "editar_venta",
  VER_INVENTARIO: "ver_inventario",
  GESTIONAR_INVENTARIO: "gestionar_inventario",
  VER_FINANZAS: "ver_finanzas",
  ADMIN_TOTAL: "admin_total",
};

/**
 * Roles predefinidos con sus permisos
 */
const ROLES_PERMISOS: Record<string, string[]> = {
  admin: Object.values(PERMISOS),
  vendedor: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_VENTAS,
    PERMISOS.CREAR_VENTA,
    PERMISOS.EDITAR_VENTA,
    PERMISOS.VER_INVENTARIO,
  ],
  almacenero: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_INVENTARIO,
    PERMISOS.GESTIONAR_INVENTARIO,
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
  if (adminData?.role !== "admin" && !adminData?.permisos?.includes(PERMISOS.ADMIN_TOTAL)) {
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
