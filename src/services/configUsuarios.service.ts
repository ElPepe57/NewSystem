// src/services/configUsuarios.service.ts
// chk5.F4-USERS (2026-05-25) · Configuración del módulo /usuarios
//
// Documento único en Firestore: configuracion/usuarios
// Solo admin puede modificar. Resto del sistema lee.

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';
import type {
  ConfigUsuarios,
  PolicyPassword,
  PolicyRegistro,
  PlantillaEmailInvitacion,
} from '../types/configUsuarios.types';
import {
  POLICY_PASSWORD_DEFAULT,
  POLICY_REGISTRO_DEFAULT,
  PLANTILLA_EMAIL_DEFAULT,
} from '../types/configUsuarios.types';

const CONFIG_DOC_ID = 'usuarios';

/**
 * Service singleton para gestionar la configuración del módulo /usuarios.
 */
export const configUsuariosService = {
  /**
   * Obtener la configuración actual.
   * Si no existe el doc · retorna los defaults y crea el doc en Firestore
   * con la marca de timestamp inicial (lazy init en primera lectura).
   */
  async get(): Promise<ConfigUsuarios> {
    try {
      const docRef = doc(db, COLLECTIONS.CONFIGURACION, CONFIG_DOC_ID);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data() as ConfigUsuarios;
      }

      // Lazy init · primera vez · crear con defaults
      logger.info('[configUsuariosService] Inicializando configuración con defaults');
      const defaultConfig: ConfigUsuarios = {
        policyRegistro: POLICY_REGISTRO_DEFAULT,
        policyPassword: POLICY_PASSWORD_DEFAULT,
        plantillaInvitacion: PLANTILLA_EMAIL_DEFAULT,
        fechaCreacion: Timestamp.now(),
        fechaUltimaModificacion: Timestamp.now(),
        modificadoPor: 'sistema',
      };

      await setDoc(docRef, defaultConfig);
      return defaultConfig;
    } catch (error) {
      logger.error('[configUsuariosService] Error al obtener config:', error);
      throw error;
    }
  },

  /**
   * Actualizar la política de registro completa.
   * Solo admin · enforced en Firestore rules.
   */
  async updatePolicyRegistro(
    policy: PolicyRegistro,
    modificadoPor: string,
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.CONFIGURACION, CONFIG_DOC_ID);
      await setDoc(
        docRef,
        {
          policyRegistro: policy,
          fechaUltimaModificacion: serverTimestamp(),
          modificadoPor,
        },
        { merge: true },
      );
      logger.info('[configUsuariosService] policyRegistro actualizada por', modificadoPor);
    } catch (error) {
      logger.error('[configUsuariosService] Error al actualizar policyRegistro:', error);
      throw error;
    }
  },

  /**
   * Actualizar la política de password.
   * Solo admin · enforced en Firestore rules.
   */
  async updatePolicyPassword(
    policy: PolicyPassword,
    modificadoPor: string,
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.CONFIGURACION, CONFIG_DOC_ID);
      await setDoc(
        docRef,
        {
          policyPassword: policy,
          fechaUltimaModificacion: serverTimestamp(),
          modificadoPor,
        },
        { merge: true },
      );
      logger.info('[configUsuariosService] policyPassword actualizada por', modificadoPor);
    } catch (error) {
      logger.error('[configUsuariosService] Error al actualizar policyPassword:', error);
      throw error;
    }
  },

  /**
   * Actualizar la plantilla de email de invitación.
   * Solo admin · enforced en Firestore rules.
   */
  async updatePlantillaInvitacion(
    plantilla: PlantillaEmailInvitacion,
    modificadoPor: string,
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.CONFIGURACION, CONFIG_DOC_ID);
      await setDoc(
        docRef,
        {
          plantillaInvitacion: plantilla,
          fechaUltimaModificacion: serverTimestamp(),
          modificadoPor,
        },
        { merge: true },
      );
      logger.info('[configUsuariosService] plantillaInvitacion actualizada por', modificadoPor);
    } catch (error) {
      logger.error('[configUsuariosService] Error al actualizar plantillaInvitacion:', error);
      throw error;
    }
  },

  /**
   * Helper · valida que un email esté permitido según whitelist.
   * Vacío = cualquier dominio aceptado.
   */
  async validateEmailDomain(email: string): Promise<{ permitido: boolean; razon?: string }> {
    const config = await this.get();
    const { whitelistDominios } = config.policyRegistro;

    if (whitelistDominios.length === 0) {
      return { permitido: true };
    }

    const dominio = '@' + email.split('@')[1]?.toLowerCase();
    if (!dominio) {
      return { permitido: false, razon: 'Email inválido' };
    }

    const permitido = whitelistDominios.some((d) => d.toLowerCase() === dominio);
    return permitido
      ? { permitido: true }
      : { permitido: false, razon: `Dominio ${dominio} no está en la lista de dominios permitidos` };
  },

  /**
   * Helper · valida que una password cumpla la policy.
   * Usado en /signup y /setup-password.
   */
  async validatePassword(password: string): Promise<{ valida: boolean; errores: string[] }> {
    const config = await this.get();
    const { policyPassword } = config;
    const errores: string[] = [];

    if (password.length < policyPassword.longitudMinima) {
      errores.push(`Debe tener al menos ${policyPassword.longitudMinima} caracteres`);
    }
    if (policyPassword.requiereMayusculas && !/[A-Z]/.test(password)) {
      errores.push('Debe incluir al menos una mayúscula');
    }
    if (policyPassword.requiereNumeros && !/[0-9]/.test(password)) {
      errores.push('Debe incluir al menos un número');
    }
    if (policyPassword.requiereEspeciales && !/[!@#$%^&*()_+\-=\[\]{};:'"\\|,.<>/?]/.test(password)) {
      errores.push('Debe incluir al menos un caracter especial');
    }
    if (policyPassword.bloquearComunes) {
      const comunes = ['password', '12345678', 'qwerty12', 'abc12345', '11111111'];
      if (comunes.some((c) => password.toLowerCase().includes(c))) {
        errores.push('Esta password es demasiado común');
      }
    }

    return { valida: errores.length === 0, errores };
  },
};
