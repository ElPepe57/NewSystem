// src/services/invitacion.service.ts
// chk5.F4-USERS (2026-05-25) · Service cliente para gestión de invitaciones
//
// Las operaciones críticas (crear · aceptar) se hacen vía Cloud Functions
// para garantizar:
//   - Firmado del token JWT server-side
//   - Envío de email vía Resend
//   - Audit trail en audit_logs
//
// Este service hace SOLO lecturas y operaciones de UI (listar · cancelar ·
// re-enviar). Las CF correspondientes están en functions/src/users/.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';
import type {
  Invitacion,
  InvitacionEstado,
  CrearInvitacionInput,
} from '../types/invitacion.types';

const functions = getFunctions();

interface InviteUserResponse {
  success: boolean;
  invitacionId: string;
  emailEnviado: boolean;
}

interface CancelInvitacionResponse {
  success: boolean;
}

export const invitacionService = {
  /**
   * Crear una nueva invitación · llama a CF `inviteUser`.
   * CF se encarga de:
   *   1. Validar input (email · roles permitidos · whitelist · etc.)
   *   2. Generar token JWT firmado
   *   3. Crear doc en Firestore
   *   4. Enviar email vía Resend
   *   5. Audit log
   */
  async crear(input: CrearInvitacionInput): Promise<{ id: string; emailEnviado: boolean }> {
    try {
      const fn = httpsCallable<CrearInvitacionInput, InviteUserResponse>(functions, 'inviteUser');
      const result = await fn(input);
      logger.info('[invitacionService] Invitación creada:', result.data.invitacionId);
      return {
        id: result.data.invitacionId,
        emailEnviado: result.data.emailEnviado,
      };
    } catch (error) {
      logger.error('[invitacionService] Error al crear invitación:', error);
      throw error;
    }
  },

  /**
   * Listar todas las invitaciones · filtrable por estado.
   * Solo admin/gerente · enforced en Firestore rules.
   */
  async listAll(estado?: InvitacionEstado): Promise<Invitacion[]> {
    try {
      const colRef = collection(db, COLLECTIONS.INVITACIONES);
      const q = estado
        ? query(colRef, where('estado', '==', estado), orderBy('fechaEnvio', 'desc'))
        : query(colRef, orderBy('fechaEnvio', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Invitacion);
    } catch (error) {
      logger.error('[invitacionService] Error al listar invitaciones:', error);
      throw error;
    }
  },

  /**
   * Listar invitaciones PENDIENTES (enviadas + link_abierto).
   * Usado en el banner "X invitaciones activas" del tab Configuración.
   */
  async listPendientes(): Promise<Invitacion[]> {
    try {
      const colRef = collection(db, COLLECTIONS.INVITACIONES);
      const q = query(
        colRef,
        where('estado', 'in', ['enviada', 'link_abierto']),
        orderBy('fechaEnvio', 'desc'),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Invitacion);
    } catch (error) {
      logger.error('[invitacionService] Error al listar pendientes:', error);
      throw error;
    }
  },

  /**
   * Obtener una invitación por ID.
   */
  async getById(id: string): Promise<Invitacion | null> {
    try {
      const docRef = doc(db, COLLECTIONS.INVITACIONES, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as Invitacion;
    } catch (error) {
      logger.error('[invitacionService] Error al obtener invitación:', error);
      throw error;
    }
  },

  /**
   * Cancelar una invitación · llama a CF `cancelInvitation`.
   * Cambia estado a 'cancelada' + audit log.
   */
  async cancelar(invitacionId: string): Promise<void> {
    try {
      const fn = httpsCallable<{ invitacionId: string }, CancelInvitacionResponse>(
        functions,
        'cancelInvitation',
      );
      await fn({ invitacionId });
      logger.info('[invitacionService] Invitación cancelada:', invitacionId);
    } catch (error) {
      logger.error('[invitacionService] Error al cancelar:', error);
      throw error;
    }
  },

  /**
   * Re-enviar email de una invitación · llama a CF `resendInvitation`.
   * No cambia el estado · solo dispara el email otra vez.
   */
  async reEnviar(invitacionId: string): Promise<void> {
    try {
      const fn = httpsCallable<{ invitacionId: string }, CancelInvitacionResponse>(
        functions,
        'resendInvitation',
      );
      await fn({ invitacionId });
      logger.info('[invitacionService] Invitación re-enviada:', invitacionId);
    } catch (error) {
      logger.error('[invitacionService] Error al re-enviar:', error);
      throw error;
    }
  },

  /**
   * Helper · calcular días hasta que la invitación expire.
   */
  diasHastaExpiracion(invitacion: Invitacion): number {
    const ahora = Timestamp.now().toMillis();
    const expira = invitacion.fechaCaducidad.toMillis();
    return Math.max(0, Math.ceil((expira - ahora) / (1000 * 60 * 60 * 24)));
  },

  /**
   * Helper · armar URL del link de setup para copy-to-clipboard del admin.
   */
  buildSetupUrl(invitacionId: string, tokenPlain: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/setup-password/${invitacionId}?token=${tokenPlain}`;
  },
};
