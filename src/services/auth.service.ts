import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  linkWithPopup,
  unlink,
  fetchSignInMethodsForEmail,
  EmailAuthProvider,
  linkWithCredential,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

// ═════════════════════════════════════════════════════════════════════════
// chk5.AUTH-LINK (2026-05-28) · Account linking canon
//
// Maneja escenarios donde un user tiene múltiples providers:
//   - password (email + contraseña)
//   - google.com (Sign in with Google)
//
// Comportamiento Firebase Auth con "One account per email" (default):
//   - User intenta loginWithGoogle con email ya registrado con password
//   - Firebase rechaza con auth/account-exists-with-different-credential
//   - Solución canon: detectar error → mostrar al user qué hacer
//     ("entrá con tu password · luego desde /perfil podés vincular Google")
//
// Account linking explícito (desde /perfil):
//   - linkGoogleToCurrentUser() · vincula provider Google a la cuenta actual
//   - unlinkProvider(providerId) · desvincula un provider (mantiene los demás)
//   - getCurrentProviders() · lista providers vigentes (para UI)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Error custom thrown cuando login con Google falla porque el email YA existe
 * con otro provider. Contiene info útil para la UI.
 */
export class AccountExistsError extends Error {
  email: string;
  /** Métodos de sign-in que el email tiene actualmente · ej. ['password', 'google.com'] */
  existingMethods: string[];

  constructor(email: string, existingMethods: string[]) {
    super(
      `Ya existe una cuenta con ${email} usando otro método. ` +
      `Métodos existentes: ${existingMethods.join(', ')}. ` +
      `Iniciá con ese método · después podés vincular este desde tu perfil.`,
    );
    this.name = 'AccountExistsError';
    this.email = email;
    this.existingMethods = existingMethods;
  }
}

export class AuthService {
  // ───────────────────────────────────────────────────────────────────────
  // LOGIN · email/password
  // ───────────────────────────────────────────────────────────────────────
  static async login(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // LOGIN · Google (popup) · con handler de account linking
  // ───────────────────────────────────────────────────────────────────────
  static async loginWithGoogle(): Promise<User> {
    try {
      const provider = new GoogleAuthProvider();
      // Forzar a Google a mostrar el selector de cuenta · útil cuando user
      // está logueado en múltiples cuentas Google en el navegador
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Inicio de sesión cancelado');
      }
      if (error.code === 'auth/popup-blocked') {
        throw new Error('El navegador bloqueó la ventana emergente. Permite pop-ups e intenta de nuevo.');
      }
      // chk5.AUTH-LINK · CASO CRÍTICO: email ya registrado con otro provider
      if (error.code === 'auth/account-exists-with-different-credential') {
        const email = error.customData?.email as string | undefined;
        if (email) {
          // Obtener qué métodos tiene el email · para informar al user
          try {
            const methods = await fetchSignInMethodsForEmail(auth, email);
            throw new AccountExistsError(email, methods);
          } catch (innerErr) {
            // Si el fetch falla · igualmente disparar AccountExistsError sin lista de métodos
            if (innerErr instanceof AccountExistsError) throw innerErr;
            throw new AccountExistsError(email, []);
          }
        }
        throw new Error('Ya existe una cuenta con este email usando otro método de inicio.');
      }
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // REGISTRO
  // ───────────────────────────────────────────────────────────────────────
  static async register(email: string, password: string): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  static async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      throw new Error('Error al cerrar sesión');
    }
  }

  static async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  static onAuthChange(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  }

  static getCurrentUser(): User | null {
    return auth.currentUser;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // chk5.AUTH-LINK · ACCOUNT LINKING (canon 2026-05-28)
  // Métodos para gestionar múltiples providers vinculados al user actual.
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Lista los providers vigentes vinculados al user actual.
   * Devuelve array de providerIds: ['password', 'google.com', etc].
   * Vacío si no hay user logueado.
   */
  static getCurrentProviders(): string[] {
    const user = auth.currentUser;
    if (!user) return [];
    return user.providerData.map((p) => p.providerId);
  }

  /**
   * Chequea si el user actual tiene un provider específico vinculado.
   */
  static hasProvider(providerId: 'password' | 'google.com'): boolean {
    return this.getCurrentProviders().includes(providerId);
  }

  /**
   * Vincula Google al user actual (que está logueado con password o algún otro).
   * Después, el user puede iniciar sesión con cualquiera de los 2 métodos.
   *
   * Errores comunes:
   *   - auth/credential-already-in-use · ese Google account ya está vinculado a OTRO user
   *   - auth/provider-already-linked · este user ya tiene Google vinculado
   *   - auth/popup-closed-by-user · user canceló el popup
   */
  static async linkGoogleToCurrentUser(): Promise<UserCredential> {
    const user = auth.currentUser;
    if (!user) throw new Error('Tenés que estar logueado para vincular Google');
    if (this.hasProvider('google.com')) {
      throw new Error('Google ya está vinculado a tu cuenta');
    }
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return await linkWithPopup(user, provider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Vinculación cancelada');
      }
      if (error.code === 'auth/credential-already-in-use') {
        throw new Error(
          'Esa cuenta de Google ya está vinculada a otro usuario del sistema. ' +
          'Usá una cuenta de Google distinta.',
        );
      }
      if (error.code === 'auth/provider-already-linked') {
        throw new Error('Google ya está vinculado a tu cuenta');
      }
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  /**
   * Vincula email + password al user actual (que típicamente entró con Google).
   * Permite al user setear una contraseña para poder loguearse también con email.
   */
  static async linkPasswordToCurrentUser(email: string, password: string): Promise<UserCredential> {
    const user = auth.currentUser;
    if (!user) throw new Error('Tenés que estar logueado para configurar contraseña');
    if (this.hasProvider('password')) {
      throw new Error('Ya tenés contraseña configurada · usá "Resetear contraseña" si no la recordás');
    }
    try {
      const credential = EmailAuthProvider.credential(email, password);
      return await linkWithCredential(user, credential);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Ese email ya está en uso por otro usuario');
      }
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  /**
   * Desvincula un provider del user actual.
   * Requiere que tenga AL MENOS otro provider activo (no se puede quedar sin métodos).
   */
  static async unlinkProvider(providerId: 'password' | 'google.com'): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('No hay usuario logueado');
    const providers = this.getCurrentProviders();
    if (!providers.includes(providerId)) {
      throw new Error('Ese método de inicio no está vinculado');
    }
    if (providers.length <= 1) {
      throw new Error(
        'No podés desvincular tu único método de inicio · agregá otro primero ' +
        '(ej. configurar contraseña antes de desvincular Google).',
      );
    }
    try {
      await unlink(user, providerId);
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Mensajes de error en español
  // ───────────────────────────────────────────────────────────────────────
  private static getErrorMessage(code: string): string {
    const messages: { [key: string]: string } = {
      'auth/email-already-in-use': 'Este email ya está registrado',
      'auth/invalid-email': 'Email inválido',
      'auth/operation-not-allowed': 'Operación no permitida',
      'auth/weak-password': 'La contraseña es muy débil',
      'auth/user-disabled': 'Usuario deshabilitado',
      // SEC-004: Unified error messages to prevent email enumeration
      'auth/user-not-found': 'Credenciales inválidas. Verifica tu email y contraseña.',
      'auth/wrong-password': 'Credenciales inválidas. Verifica tu email y contraseña.',
      'auth/invalid-credential': 'Credenciales inválidas. Verifica tu email y contraseña.',
      'auth/too-many-requests': 'Demasiados intentos, intenta más tarde',
      'auth/network-request-failed': 'Error de conexión',
      // chk5.AUTH-LINK · account linking
      'auth/requires-recent-login': 'Operación sensible · cerrá sesión y volvé a entrar antes de continuar',
      'auth/credential-already-in-use': 'Esa cuenta ya está vinculada a otro usuario',
      'auth/provider-already-linked': 'Ese método ya está vinculado a tu cuenta',
    };

    return messages[code] || 'Error desconocido';
  }
}
