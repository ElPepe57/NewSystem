// src/services/sesion.service.ts
// chk5.F4-USERS (2026-05-25) · Sistema de sesiones activas
//
// Tracking custom de sesiones porque Firebase Auth no tiene listado nativo.
// Cada login (email/Google) crea un doc en /sessions. Lifecycle:
//   1. Login → crear sesión (sessionId UUID local + doc Firestore)
//   2. Activity → updatear lastActive periódicamente
//   3. Logout normal → marcar cerrada (motivoCierre: 'logout_user')
//   4. Admin desconecta → CF revoca refresh token + cierra doc
//
// El sessionId se guarda en sessionStorage local del navegador para que
// updates de lastActive sepan a cuál sesión actualizar.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  limit,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';
import type { SesionActiva, SesionMotivoCierre } from '../types/sesion.types';
import { parseUserAgent } from '../types/sesion.types';

const functions = getFunctions();
const SESSION_ID_KEY = 'businessmn_session_id';

/**
 * Genera un UUID v4 compatible con browsers · sin dependencias.
 */
function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback simple para entornos sin crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const sesionService = {
  /**
   * Crear una nueva sesión al login (email/Google). Llamar desde authStore.setUser.
   * Guarda sessionId en sessionStorage del navegador para tracking.
   */
  async iniciar(uid: string): Promise<string> {
    try {
      const sessionId = generateSessionId();
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
      const { browser, os, device } = parseUserAgent(ua);

      const sesion: Omit<SesionActiva, 'id'> = {
        uid,
        device,
        browser,
        os,
        userAgent: ua,
        fechaInicio: Timestamp.now(),
        lastActive: Timestamp.now(),
        estado: 'activa',
      };

      await setDoc(doc(db, COLLECTIONS.SESSIONS, sessionId), sesion);

      // Guardar localmente para updates futuros
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SESSION_ID_KEY, sessionId);
      }

      logger.info('[sesionService] Sesión iniciada:', sessionId, device);
      return sessionId;
    } catch (error) {
      // No bloquear el login si falla el tracking · solo loggear
      logger.error('[sesionService] Error al iniciar sesión (no bloquea login):', error);
      return '';
    }
  },

  /**
   * Marcar actividad reciente. Llamar periódicamente desde el cliente
   * (ej. cada 5 min vía interval) o en eventos clave (route change).
   */
  async marcarActividad(): Promise<void> {
    try {
      if (typeof sessionStorage === 'undefined') return;
      const sessionId = sessionStorage.getItem(SESSION_ID_KEY);
      if (!sessionId) return;

      await updateDoc(doc(db, COLLECTIONS.SESSIONS, sessionId), {
        lastActive: serverTimestamp(),
      });
    } catch (error) {
      // Silent fail · si la sesión fue cerrada por admin · esto fallará
      // y el next request del user va a recibir 401 lo cual disparará logout
      logger.debug('[sesionService] marcarActividad falló (esperado si sesión cerrada)');
    }
  },

  /**
   * Cerrar la sesión actual (logout normal del user).
   * Llamar desde authStore.logout antes de signOut Firebase.
   */
  async cerrarActual(motivo: SesionMotivoCierre = 'logout_user'): Promise<void> {
    try {
      if (typeof sessionStorage === 'undefined') return;
      const sessionId = sessionStorage.getItem(SESSION_ID_KEY);
      if (!sessionId) return;

      await updateDoc(doc(db, COLLECTIONS.SESSIONS, sessionId), {
        estado: 'cerrada',
        fechaCierre: serverTimestamp(),
        motivoCierre: motivo,
      });

      sessionStorage.removeItem(SESSION_ID_KEY);
      logger.info('[sesionService] Sesión cerrada:', sessionId, motivo);
    } catch (error) {
      logger.error('[sesionService] Error al cerrar sesión:', error);
    }
  },

  /**
   * Obtener el sessionId actual del navegador (read-only).
   */
  getSessionIdActual(): string | null {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(SESSION_ID_KEY);
  },

  /**
   * Listar sesiones activas de un usuario · usado en Ficha 360.
   * Marca `esActual: true` si coincide con el sessionId local.
   */
  async listActivasByUid(uid: string): Promise<SesionActiva[]> {
    try {
      const colRef = collection(db, COLLECTIONS.SESSIONS);
      const q = query(
        colRef,
        where('uid', '==', uid),
        where('estado', '==', 'activa'),
        orderBy('lastActive', 'desc'),
        limit(20),
      );
      const snapshot = await getDocs(q);
      const sessionIdActual = this.getSessionIdActual();
      return snapshot.docs.map((d) => {
        const data = d.data() as Omit<SesionActiva, 'id'>;
        return {
          id: d.id,
          ...data,
          esActual: d.id === sessionIdActual,
        };
      });
    } catch (error) {
      logger.error('[sesionService] Error al listar sesiones:', error);
      throw error;
    }
  },

  /**
   * Desconectar una sesión específica · llama a CF `desconectarSesion`.
   * Admin only · revoca el refresh token de ese sessionId.
   */
  async desconectar(sessionId: string): Promise<void> {
    try {
      const fn = httpsCallable<{ sessionId: string }, { success: boolean }>(
        functions,
        'desconectarSesion',
      );
      await fn({ sessionId });
      logger.info('[sesionService] Sesión desconectada:', sessionId);
    } catch (error) {
      logger.error('[sesionService] Error al desconectar:', error);
      throw error;
    }
  },

  /**
   * Desconectar TODAS las sesiones de un usuario · llama a CF.
   * Caso uso: emergencia de seguridad · reset password obligatorio.
   */
  async desconectarTodasDeUsuario(uid: string): Promise<void> {
    try {
      const fn = httpsCallable<{ uid: string }, { success: boolean; count: number }>(
        functions,
        'desconectarTodasSesiones',
      );
      const result = await fn({ uid });
      logger.info('[sesionService] Sesiones desconectadas:', result.data.count, 'del user', uid);
    } catch (error) {
      logger.error('[sesionService] Error al desconectar todas:', error);
      throw error;
    }
  },

  /**
   * Caso emergencia · desconectar TODAS las sesiones del sistema (todos los users).
   * Llama a CF `desconectarTodasSistema` · solo admin con confirmación extra.
   */
  async desconectarTodasSistema(): Promise<{ count: number }> {
    try {
      const fn = httpsCallable<unknown, { success: boolean; count: number }>(
        functions,
        'desconectarTodasSistema',
      );
      const result = await fn({});
      logger.warn('[sesionService] EMERGENCIA · sesiones desconectadas sistema:', result.data.count);
      return { count: result.data.count };
    } catch (error) {
      logger.error('[sesionService] Error al desconectar sistema:', error);
      throw error;
    }
  },
};
