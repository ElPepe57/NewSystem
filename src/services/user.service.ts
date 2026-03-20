import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../lib/firebase';
import type { UserProfile, UserRole } from '../types/auth.types';
import { DEFAULT_PERMISOS, PERMISOS } from '../types/auth.types';
import { auditoriaService } from './auditoria.service';
import { presenciaService } from './presencia.service';
import { COLLECTIONS } from '../config/collections';

// Inicializar Cloud Functions
const functions = getFunctions();

// Interfaces para las respuestas de Cloud Functions
interface CreateUserResponse {
  success: boolean;
  user: {
    uid: string;
    email: string;
    displayName: string;
    role: string;
    permisos: string[];
  };
}

interface CloudFunctionResponse {
  success: boolean;
}

// Descripciones de permisos para la UI (30 permisos agrupados)
export const PERMISOS_INFO: Record<string, { label: string; descripcion: string; grupo: string }> = {
  // === General ===
  [PERMISOS.VER_DASHBOARD]: { label: 'Ver Dashboard', descripcion: 'Acceso al panel principal con métricas y resúmenes', grupo: 'General' },
  // === Ventas ===
  [PERMISOS.VER_VENTAS]: { label: 'Ver Ventas', descripcion: 'Ver listado de ventas y sus detalles', grupo: 'Ventas' },
  [PERMISOS.CREAR_VENTA]: { label: 'Crear Ventas', descripcion: 'Registrar nuevas ventas en el sistema', grupo: 'Ventas' },
  [PERMISOS.EDITAR_VENTA]: { label: 'Editar Ventas', descripcion: 'Modificar ventas existentes (precios, productos, datos)', grupo: 'Ventas' },
  [PERMISOS.CONFIRMAR_VENTA]: { label: 'Confirmar Ventas', descripcion: 'Marcar ventas como confirmadas/pagadas', grupo: 'Ventas' },
  [PERMISOS.CANCELAR_VENTA]: { label: 'Cancelar Ventas', descripcion: 'Cancelar ventas y liberar unidades reservadas', grupo: 'Ventas' },
  // === Cotizaciones ===
  [PERMISOS.VER_COTIZACIONES]: { label: 'Ver Cotizaciones', descripcion: 'Ver listado de cotizaciones y sus detalles', grupo: 'Cotizaciones' },
  [PERMISOS.CREAR_COTIZACION]: { label: 'Crear Cotizaciones', descripcion: 'Generar nuevas cotizaciones para clientes', grupo: 'Cotizaciones' },
  [PERMISOS.VALIDAR_COTIZACION]: { label: 'Validar Cotizaciones', descripcion: 'Aprobar cotizaciones y convertirlas en ventas', grupo: 'Cotizaciones' },
  // === Entregas ===
  [PERMISOS.VER_ENTREGAS]: { label: 'Ver Entregas', descripcion: 'Ver programación de entregas y su estado', grupo: 'Entregas' },
  [PERMISOS.PROGRAMAR_ENTREGA]: { label: 'Programar Entregas', descripcion: 'Crear y programar entregas a clientes', grupo: 'Entregas' },
  [PERMISOS.REGISTRAR_ENTREGA]: { label: 'Registrar Entregas', descripcion: 'Registrar resultado de entregas (exitosa o fallida)', grupo: 'Entregas' },
  // === Compras ===
  [PERMISOS.VER_REQUERIMIENTOS]: { label: 'Ver Requerimientos', descripcion: 'Ver listado de requerimientos de compra', grupo: 'Compras' },
  [PERMISOS.CREAR_REQUERIMIENTO]: { label: 'Crear Requerimientos', descripcion: 'Generar nuevos requerimientos de compra', grupo: 'Compras' },
  [PERMISOS.APROBAR_REQUERIMIENTO]: { label: 'Aprobar Requerimientos', descripcion: 'Aprobar requerimientos para generar OC', grupo: 'Compras' },
  [PERMISOS.VER_ORDENES_COMPRA]: { label: 'Ver Órdenes de Compra', descripcion: 'Ver listado de OC y sus detalles', grupo: 'Compras' },
  [PERMISOS.CREAR_OC]: { label: 'Crear Órdenes de Compra', descripcion: 'Generar órdenes de compra a proveedores', grupo: 'Compras' },
  [PERMISOS.RECIBIR_OC]: { label: 'Recibir Órdenes de Compra', descripcion: 'Registrar recepción de mercadería', grupo: 'Compras' },
  // === Inventario ===
  [PERMISOS.VER_INVENTARIO]: { label: 'Ver Inventario', descripcion: 'Ver productos, almacenes, stock y unidades', grupo: 'Inventario' },
  [PERMISOS.GESTIONAR_INVENTARIO]: { label: 'Gestionar Inventario', descripcion: 'Modificar productos, organizar stock y almacenes', grupo: 'Inventario' },
  [PERMISOS.TRANSFERIR_UNIDADES]: { label: 'Transferir Unidades', descripcion: 'Mover unidades entre almacenes', grupo: 'Inventario' },
  // === Finanzas ===
  [PERMISOS.VER_GASTOS]: { label: 'Ver Gastos', descripcion: 'Ver listado de gastos operativos y de entrega', grupo: 'Finanzas' },
  [PERMISOS.CREAR_GASTO]: { label: 'Crear Gastos', descripcion: 'Registrar nuevos gastos en el sistema', grupo: 'Finanzas' },
  [PERMISOS.VER_TESORERIA]: { label: 'Ver Tesorería', descripcion: 'Ver movimientos de caja, cuentas y conversiones', grupo: 'Finanzas' },
  [PERMISOS.GESTIONAR_TESORERIA]: { label: 'Gestionar Tesorería', descripcion: 'Registrar movimientos, aportes, retiros y conversiones', grupo: 'Finanzas' },
  [PERMISOS.VER_REPORTES]: { label: 'Ver Reportes', descripcion: 'Acceso a reportes financieros y de gestión', grupo: 'Finanzas' },
  [PERMISOS.VER_CTRU]: { label: 'Ver CTRU', descripcion: 'Costo Total Real Unitario y análisis de márgenes', grupo: 'Finanzas' },
  // === Administración ===
  [PERMISOS.GESTIONAR_USUARIOS]: { label: 'Gestionar Usuarios', descripcion: 'Crear, editar y eliminar usuarios del sistema', grupo: 'Administración' },
  [PERMISOS.GESTIONAR_CONFIGURACION]: { label: 'Gestionar Configuración', descripcion: 'Modificar configuración, maestros y almacenes', grupo: 'Administración' },
  [PERMISOS.VER_AUDITORIA]: { label: 'Ver Auditoría', descripcion: 'Acceso al registro de auditoría del sistema', grupo: 'Administración' },
  [PERMISOS.ADMIN_TOTAL]: { label: 'Administración Total', descripcion: 'Poder absoluto sobre todo el sistema', grupo: 'Administración' },
};

const COLLECTION_NAME = COLLECTIONS.USERS;

export const userService = {
  /**
   * Obtener perfil de usuario por UID
   */
  async getByUid(uid: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { uid: docSnap.id, ...docSnap.data() } as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      throw error;
    }
  },

  /**
   * Crear perfil de usuario (al registrarse o primer login)
   */
  async createProfile(
    uid: string,
    email: string,
    displayName: string,
    role: UserRole = 'invitado',
    permisos?: string[],
    activo: boolean = true
  ): Promise<UserProfile> {
    try {
      const userProfile: Omit<UserProfile, 'uid'> = {
        email,
        displayName,
        role,
        permisos: permisos || DEFAULT_PERMISOS[role],
        activo,
        fechaCreacion: Timestamp.now(),
        ultimaConexion: Timestamp.now()
      };

      await setDoc(doc(db, COLLECTION_NAME, uid), userProfile);

      return { uid, ...userProfile };
    } catch (error) {
      console.error('Error al crear perfil de usuario:', error);
      throw error;
    }
  },

  /**
   * Actualizar última conexión del usuario
   */
  async updateLastConnection(uid: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, uid);
      await updateDoc(docRef, {
        ultimaConexion: Timestamp.now()
      });
    } catch (error) {
      console.error('Error al actualizar última conexión:', error);
    }
  },

  /**
   * Actualizar rol de usuario (solo admin)
   */
  async updateRole(uid: string, role: UserRole): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, uid);
      await updateDoc(docRef, {
        role,
        permisos: DEFAULT_PERMISOS[role]
      });
    } catch (error) {
      console.error('Error al actualizar rol:', error);
      throw error;
    }
  },

  /**
   * Actualizar permisos específicos de usuario
   */
  async updatePermisos(uid: string, permisos: string[]): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, uid);
      await updateDoc(docRef, { permisos });
    } catch (error) {
      console.error('Error al actualizar permisos:', error);
      throw error;
    }
  },

  /**
   * Activar/Desactivar usuario
   */
  async setActivo(uid: string, activo: boolean): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, uid);
      await updateDoc(docRef, { activo });
    } catch (error) {
      console.error('Error al cambiar estado de usuario:', error);
      throw error;
    }
  },

  /**
   * Aprobar usuario pendiente: activar + asignar rol + permisos
   */
  async aprobarUsuario(uid: string, role: UserRole): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, uid);
      await updateDoc(docRef, {
        activo: true,
        role,
        permisos: DEFAULT_PERMISOS[role]
      });
    } catch (error) {
      console.error('Error al aprobar usuario:', error);
      throw error;
    }
  },

  /**
   * Obtener todos los usuarios
   */
  async getAll(): Promise<UserProfile[]> {
    try {
      const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
      return querySnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as UserProfile[];
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw error;
    }
  },

  /**
   * Obtener usuarios por rol
   */
  async getByRole(role: UserRole): Promise<UserProfile[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('role', '==', role)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as UserProfile[];
    } catch (error) {
      console.error('Error al obtener usuarios por rol:', error);
      throw error;
    }
  },

  /**
   * Obtener usuarios activos
   */
  async getActivos(): Promise<UserProfile[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('activo', '==', true)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as UserProfile[];
    } catch (error) {
      console.error('Error al obtener usuarios activos:', error);
      throw error;
    }
  },

  /**
   * Verificar si un usuario tiene un permiso específico
   */
  hasPermiso(userProfile: UserProfile | null, permiso: string): boolean {
    if (!userProfile) return false;
    if (!userProfile.activo) return false;
    if (userProfile.role === 'admin') return true;
    return userProfile.permisos.includes(permiso);
  },

  /**
   * Verificar si un usuario tiene alguno de los permisos
   */
  hasAnyPermiso(userProfile: UserProfile | null, permisos: string[]): boolean {
    if (!userProfile) return false;
    if (!userProfile.activo) return false;
    if (userProfile.role === 'admin') return true;
    return permisos.some(p => userProfile.permisos.includes(p));
  },

  /**
   * Verificar si un usuario tiene todos los permisos
   */
  hasAllPermisos(userProfile: UserProfile | null, permisos: string[]): boolean {
    if (!userProfile) return false;
    if (!userProfile.activo) return false;
    if (userProfile.role === 'admin') return true;
    return permisos.every(p => userProfile.permisos.includes(p));
  },

  /**
   * Crear nuevo usuario completo usando Cloud Function
   * Esto permite crear usuarios sin cerrar la sesión del admin actual
   */
  async createUser(
    email: string,
    password: string,
    displayName: string,
    role: UserRole,
    permisos?: string[]
  ): Promise<UserProfile> {
    try {
      const createUserFn = httpsCallable<
        { email: string; password: string; displayName: string; role: string; permisos?: string[] },
        CreateUserResponse
      >(functions, 'createUser');

      const result = await createUserFn({
        email,
        password,
        displayName,
        role,
        permisos
      });

      if (result.data.success) {
        const user = result.data.user;

        // Registrar en auditoría
        await auditoriaService.logUsuario(
          user.uid,
          user.displayName,
          'crear_usuario',
          `Rol: ${user.role}`
        );

        return {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: user.role as UserRole,
          permisos: user.permisos,
          activo: true,
          fechaCreacion: Timestamp.now()
        };
      }

      throw new Error('Error al crear usuario');
    } catch (error: any) {
      console.error('Error al crear usuario:', error);

      // Manejar errores específicos de Cloud Functions
      if (error.code === 'functions/already-exists') {
        throw new Error('Este email ya está registrado');
      }
      if (error.code === 'functions/invalid-argument') {
        throw new Error(error.message || 'Datos inválidos');
      }
      if (error.code === 'functions/permission-denied') {
        throw new Error('No tienes permisos para crear usuarios');
      }
      if (error.code === 'functions/unauthenticated') {
        throw new Error('Debes iniciar sesión como administrador');
      }

      throw new Error(error.message || 'Error al crear usuario');
    }
  },

  /**
   * Actualizar perfil de usuario (nombre, foto)
   */
  async updateProfile(uid: string, data: { displayName?: string; photoURL?: string }): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, uid);
      await updateDoc(docRef, data);
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      throw error;
    }
  },

  /**
   * Actualizar rol y permisos de usuario usando Cloud Function
   */
  async updateRoleAndPermisos(uid: string, role: UserRole, permisos: string[]): Promise<void> {
    try {
      // Obtener datos anteriores para auditoría
      const usuarioAnterior = await this.getByUid(uid);

      const updateUserRoleFn = httpsCallable<
        { uid: string; role: string; permisos: string[] },
        CloudFunctionResponse
      >(functions, 'updateUserRole');

      const result = await updateUserRoleFn({ uid, role, permisos });

      if (!result.data.success) {
        throw new Error('Error al actualizar rol y permisos');
      }

      // Registrar en auditoría
      if (usuarioAnterior) {
        await auditoriaService.logUsuario(
          uid,
          usuarioAnterior.displayName,
          'cambiar_rol',
          `${usuarioAnterior.role} → ${role}`
        );
      }
    } catch (error: any) {
      console.error('Error al actualizar rol y permisos:', error);

      if (error.code === 'functions/permission-denied') {
        throw new Error('No tienes permisos para modificar usuarios');
      }
      if (error.code === 'functions/not-found') {
        throw new Error('Usuario no encontrado');
      }
      if (error.code === 'functions/failed-precondition') {
        throw new Error(error.message || 'No se puede realizar esta acción');
      }

      throw new Error(error.message || 'Error al actualizar rol y permisos');
    }
  },

  /**
   * Eliminar usuario completamente usando Cloud Function
   * Elimina tanto de Firebase Auth como de Firestore
   */
  async deleteUser(uid: string): Promise<void> {
    try {
      // Obtener datos antes de eliminar para auditoría
      const usuario = await this.getByUid(uid);

      const deleteUserFn = httpsCallable<
        { uid: string },
        CloudFunctionResponse
      >(functions, 'deleteUser');

      const result = await deleteUserFn({ uid });

      if (!result.data.success) {
        throw new Error('Error al eliminar usuario');
      }

      // Limpiar documento de presencia
      await presenciaService.eliminarPresencia(uid);

      // Registrar en auditoría
      if (usuario) {
        await auditoriaService.logEliminar(
          'usuarios',
          'usuario',
          uid,
          usuario.displayName
        );
      }
    } catch (error: any) {
      console.error('Error al eliminar usuario:', error);

      if (error.code === 'functions/permission-denied') {
        throw new Error('No tienes permisos para eliminar usuarios');
      }
      if (error.code === 'functions/failed-precondition') {
        throw new Error('No puedes eliminarte a ti mismo');
      }

      throw new Error(error.message || 'Error al eliminar usuario');
    }
  },

  /**
   * Resetear contraseña de usuario usando Cloud Function
   */
  async resetUserPassword(uid: string, newPassword: string): Promise<void> {
    try {
      // Obtener datos para auditoría
      const usuario = await this.getByUid(uid);

      const resetPasswordFn = httpsCallable<
        { uid: string; newPassword: string },
        CloudFunctionResponse
      >(functions, 'resetUserPassword');

      const result = await resetPasswordFn({ uid, newPassword });

      if (!result.data.success) {
        throw new Error('Error al resetear contraseña');
      }

      // Registrar en auditoría
      if (usuario) {
        await auditoriaService.logUsuario(
          uid,
          usuario.displayName,
          'resetear_password'
        );
      }
    } catch (error: any) {
      console.error('Error al resetear contraseña:', error);

      if (error.code === 'functions/permission-denied') {
        throw new Error('No tienes permisos para resetear contraseñas');
      }
      if (error.code === 'functions/invalid-argument') {
        throw new Error(error.message || 'La contraseña debe tener al menos 6 caracteres');
      }

      throw new Error(error.message || 'Error al resetear contraseña');
    }
  },

  /**
   * Obtener todos los permisos disponibles con su info
   */
  getAllPermisosInfo() {
    return PERMISOS_INFO;
  },

  /**
   * Obtener permisos agrupados por categoría
   */
  getPermisosAgrupados() {
    const grupos: Record<string, { permiso: string; info: typeof PERMISOS_INFO[string] }[]> = {};

    Object.entries(PERMISOS_INFO).forEach(([permiso, info]) => {
      if (!grupos[info.grupo]) {
        grupos[info.grupo] = [];
      }
      grupos[info.grupo].push({ permiso, info });
    });

    return grupos;
  },

  /**
   * Subir foto de perfil a Firebase Storage
   */
  async uploadProfilePhoto(uid: string, file: File): Promise<string> {
    try {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../lib/firebase');
      const storageRef = ref(storage, `profile-photos/${uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      // Actualizar documento del usuario con la nueva URL
      await this.updateProfile(uid, { photoURL: url });
      return url;
    } catch (error) {
      console.error('Error al subir foto de perfil:', error);
      throw new Error('Error al subir la foto. Intenta con una imagen más pequeña.');
    }
  },

  /**
   * Cambiar contraseña propia usando Cloud Function
   * Usa context.auth.uid en el servidor (no uid del cliente) para seguridad
   */
  async changeOwnPassword(newPassword: string): Promise<void> {
    try {
      const changePasswordFn = httpsCallable<
        { newPassword: string },
        CloudFunctionResponse
      >(functions, 'changeOwnPassword');

      const result = await changePasswordFn({ newPassword });

      if (!result.data.success) {
        throw new Error('Error al cambiar contraseña');
      }
    } catch (error: any) {
      console.error('Error al cambiar contraseña:', error);

      if (error.code === 'functions/invalid-argument') {
        throw new Error(error.message || 'La contraseña debe tener al menos 6 caracteres');
      }
      if (error.code === 'functions/unauthenticated') {
        throw new Error('Debes iniciar sesión para cambiar tu contraseña');
      }

      throw new Error(error.message || 'Error al cambiar contraseña');
    }
  },

  /**
   * Forzar desconexión de un usuario (solo admin)
   */
  async forceDisconnectUser(uid: string): Promise<void> {
    try {
      const forceDisconnectFn = httpsCallable<
        { uid: string },
        CloudFunctionResponse
      >(functions, 'forceDisconnectUser');

      const result = await forceDisconnectFn({ uid });

      if (!result.data.success) {
        throw new Error('Error al desconectar usuario');
      }
    } catch (error: any) {
      console.error('Error al desconectar usuario:', error);
      throw new Error(error.message || 'Error al desconectar usuario');
    }
  },

  /**
   * Forzar desconexión de TODOS los usuarios (solo admin)
   */
  async forceDisconnectAll(): Promise<number> {
    try {
      const forceDisconnectAllFn = httpsCallable<
        unknown,
        CloudFunctionResponse & { disconnected?: number }
      >(functions, 'forceDisconnectAll');

      const result = await forceDisconnectAllFn({});

      if (!result.data.success) {
        throw new Error('Error al desconectar usuarios');
      }

      return result.data.disconnected || 0;
    } catch (error: any) {
      console.error('Error al desconectar todos los usuarios:', error);
      throw new Error(error.message || 'Error al desconectar usuarios');
    }
  },
};

export const UserService = userService;
