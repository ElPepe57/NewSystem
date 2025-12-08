import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export class AuthService {
  /**
   * Login con email y password
   */
  static async login(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  /**
   * Registro de nuevo usuario
   */
  static async register(email: string, password: string): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  /**
   * Logout
   */
  static async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      throw new Error('Error al cerrar sesión');
    }
  }

  /**
   * Enviar email de reseteo de contraseña
   */
  static async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  /**
   * Observar cambios en el estado de autenticación
   */
  static onAuthChange(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  }

  /**
   * Obtener usuario actual
   */
  static getCurrentUser(): User | null {
    return auth.currentUser;
  }

  /**
   * Mensajes de error en español
   */
  private static getErrorMessage(code: string): string {
    const messages: { [key: string]: string } = {
      'auth/email-already-in-use': 'Este email ya está registrado',
      'auth/invalid-email': 'Email inválido',
      'auth/operation-not-allowed': 'Operación no permitida',
      'auth/weak-password': 'La contraseña es muy débil',
      'auth/user-disabled': 'Usuario deshabilitado',
      'auth/user-not-found': 'Usuario no encontrado',
      'auth/wrong-password': 'Contraseña incorrecta',
      'auth/too-many-requests': 'Demasiados intentos, intenta más tarde',
      'auth/network-request-failed': 'Error de conexión'
    };
    
    return messages[code] || 'Error desconocido';
  }
}
