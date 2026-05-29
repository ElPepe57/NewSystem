/**
 * useCreateUserWithRelacion.ts · chk5.PERSONAS-v5.8 · E1-extended (2026-05-28)
 *
 * Hook compartido para crear un UserProfile + RelacionLaboral inicial
 * desde modales contextuales (NuevoEmpleadoModal · NuevoSocioModal).
 *
 * Encapsula el mismo flow idempotente que CrearUsuarioWizard.tsx líneas 296-394:
 *  1. userService.createUser → crea UserProfile en Auth + Firestore
 *  2. Si email ya existe → orphan recovery vía userService.getByEmail
 *  3. Verificar que no tenga relación vigente del mismo tipo (evita duplicados reales)
 *  4. relacionesLaboralesService.create con los datos de la relación
 *
 * Métodos adicionales (E1-extended):
 *  - lookupUserByEmail(email) → detecta user existente + sus relaciones vigentes
 *  - addRelacionToExisting(uid, input) → crea solo la relación en un user ya existente
 *
 * NO toca el backend · solo consume services existentes.
 */

import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { userService } from '../services/user.service';
import { relacionesLaboralesService } from '../services/relacionesLaborales.service';
import { useLineaNegocioStore } from '../store/lineaNegocioStore';
import type { UserRole, UserProfile } from '../types/auth.types';
import type { LineaNegocio, LineaNegocioSnapshot } from '../types/lineaNegocio.types';
import type {
  TipoRelacion,
  SubTipoRelacion,
  CrearRelacionInput,
  EntidadMaestroRef,
  TipoEntidadMaestro,
  RelacionLaboral,
} from '../types/relacionLaboral.types';

/**
 * Arma el snapshot desnormalizado de una línea desde su id, usando las líneas
 * cargadas en memoria. Devuelve undefined si no hay id (= compartido) o si la
 * línea no se encuentra (no rompe · solo omite el snapshot).
 */
function buildLineaSnapshot(
  lineaNegocioId: string | undefined,
  lineas: LineaNegocio[],
): LineaNegocioSnapshot | undefined {
  if (!lineaNegocioId) return undefined;
  const l = lineas.find((x) => x.id === lineaNegocioId);
  if (!l) return undefined;
  return {
    lineaNegocioId: l.id,
    lineaNegocioNombre: l.nombre,
    lineaNegocioCodigo: l.codigo,
    lineaNegocioColor: l.color,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// TIPOS DEL HOOK
// ═════════════════════════════════════════════════════════════════════════

export interface CreateUserWithRelacionInput {
  // ── Datos personales ──
  displayName: string;
  email: string;
  telefono?: string;
  password: string;
  /** Rol del sistema. Default 'invitado'. */
  rol?: UserRole;

  // ── Tipo + datos de la relación ──
  tipo: TipoRelacion;
  subTipo?: SubTipoRelacion;
  cargoDisplay?: string;
  montoMensualReferencia?: number;
  monedaReferencia?: 'PEN' | 'USD';
  fechaInicio?: Timestamp;
  notas?: string;
  /** Id de línea de negocio · ausente = compartido / empresa global · chk5-LINEAS */
  lineaNegocioId?: string;

  // ── Solo para 'externo' con vinculación a Maestros ──
  entidadMaestroRef?: Omit<EntidadMaestroRef, 'fechaVinculacion' | 'vinculadoPor'>;
}

export interface CreateUserWithRelacionResult {
  uid: string;
  esOrphanRecovery: boolean;
}

/** Resultado de lookupUserByEmail */
export interface LookupUserResult {
  user: UserProfile | null;
  relacionesVigentes: RelacionLaboral[];
}

/**
 * Input para addRelacionToExisting.
 * Mismos campos relacionales que CreateUserWithRelacionInput pero sin
 * los datos personales (displayName · email · telefono · password · rol).
 */
export type AddRelacionToExistingInput = Omit<
  CreateUserWithRelacionInput,
  'displayName' | 'email' | 'telefono' | 'password' | 'rol'
>;

// ═════════════════════════════════════════════════════════════════════════
// HOOK
// ═════════════════════════════════════════════════════════════════════════

export function useCreateUserWithRelacion(creadoPor: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Líneas en memoria · para armar el snapshot desnormalizado al crear la relación
  const lineasActivas = useLineaNegocioStore((s) => s.lineasActivas);

  const create = async (
    input: CreateUserWithRelacionInput,
  ): Promise<CreateUserWithRelacionResult> => {
    setLoading(true);
    setError(null);

    try {
      const rol = input.rol ?? 'invitado';
      let newUser: UserProfile | null = null;
      let esOrphanRecovery = false;

      // 1. Intentar crear UserProfile en Auth + Firestore
      try {
        newUser = await userService.createUser(
          input.email.trim().toLowerCase(),
          input.password,
          input.displayName.trim(),
          rol,
        );
      } catch (createErr) {
        const msg = createErr instanceof Error ? createErr.message : String(createErr);
        const yaExiste = /ya está registrado|already exists|already-exists/i.test(msg);
        if (!yaExiste) {
          throw createErr;
        }

        // Email ya existe · buscar User huérfano
        const existing = await userService.getByEmail(input.email.trim().toLowerCase());
        if (!existing) {
          throw new Error(
            'El email ya está en Firebase Auth pero no hay UserProfile en Firestore. ' +
              'Contactá al administrador del sistema para limpiar manualmente.',
          );
        }

        // Verificar que el user existente NO tenga ya una relación vigente del mismo tipo
        // (si la tiene → es duplicado real, no orphan recovery)
        const relacionesExistentes = await relacionesLaboralesService.listVigentesByUser(
          existing.uid,
        );
        const yaConRelacionDelTipo = relacionesExistentes.some((r) => r.tipo === input.tipo);
        if (yaConRelacionDelTipo) {
          throw new Error(
            `El usuario "${existing.displayName}" ya existe y tiene una relación ` +
              `vigente tipo "${input.tipo}". Si querés agregar OTRA relación, ` +
              `usá "+ Agregar relación" desde el UserPanel de ese usuario.`,
          );
        }

        newUser = existing;
        esOrphanRecovery = true;
      }

      // Guardia de seguridad: si newUser es null algo falló antes y el try externo capturó
      if (!newUser) throw new Error('No se pudo obtener o crear el UserProfile');

      // 2. Construir input de la relación
      const relacionInput: CrearRelacionInput = {
        userId: newUser.uid,
        tipo: input.tipo,
        subTipo: input.subTipo,
        estado: 'vigente',
        fechaInicio: input.fechaInicio ?? Timestamp.now(),
        cargoDisplay: input.cargoDisplay?.trim() || undefined,
        montoMensualReferencia:
          input.montoMensualReferencia !== undefined && input.montoMensualReferencia > 0
            ? input.montoMensualReferencia
            : undefined,
        monedaReferencia:
          input.montoMensualReferencia !== undefined && input.montoMensualReferencia > 0
            ? (input.monedaReferencia ?? 'PEN')
            : undefined,
        // Línea de negocio · single · ausente = compartido (chk5-LINEAS)
        lineaNegocioId: input.lineaNegocioId || undefined,
        lineaNegocioSnapshot: buildLineaSnapshot(input.lineaNegocioId, lineasActivas),
        notas: input.notas?.trim() || undefined,
        entidadMaestroRef: input.entidadMaestroRef,
      };

      // 3. Crear RelacionLaboral
      await relacionesLaboralesService.create(relacionInput, creadoPor);

      return { uid: newUser!.uid, esOrphanRecovery };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al crear usuario';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ─── lookupUserByEmail ───────────────────────────────────────────────────
  /**
   * Busca un user por email y recupera sus relaciones laborales vigentes.
   * Silencioso: si el email es incompleto devuelve { user: null, relacionesVigentes: [] }.
   * Solo lanza si hay un error real de red/Firestore.
   */
  const lookupUserByEmail = async (email: string): Promise<LookupUserResult> => {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@') || !normalized.includes('.')) {
      return { user: null, relacionesVigentes: [] };
    }

    try {
      const user = await userService.getByEmail(normalized);
      if (!user) return { user: null, relacionesVigentes: [] };
      const relacionesVigentes = await relacionesLaboralesService.listVigentesByUser(user.uid);
      return { user, relacionesVigentes };
    } catch (err) {
      console.warn('[useCreateUserWithRelacion] lookupUserByEmail error:', err);
      return { user: null, relacionesVigentes: [] };
    }
  };

  // ─── addRelacionToExisting ───────────────────────────────────────────────
  /**
   * Crea SOLO una RelacionLaboral para un user que ya existe.
   * No crea ni modifica el UserProfile.
   * Replica la lógica de construcción del relacionInput del método create().
   */
  const addRelacionToExisting = async (
    uid: string,
    input: AddRelacionToExistingInput,
  ): Promise<{ uid: string }> => {
    setLoading(true);
    setError(null);

    try {
      const relacionInput: CrearRelacionInput = {
        userId: uid,
        tipo: input.tipo,
        subTipo: input.subTipo,
        estado: 'vigente',
        fechaInicio: input.fechaInicio ?? Timestamp.now(),
        cargoDisplay: input.cargoDisplay?.trim() || undefined,
        montoMensualReferencia:
          input.montoMensualReferencia !== undefined && input.montoMensualReferencia > 0
            ? input.montoMensualReferencia
            : undefined,
        monedaReferencia:
          input.montoMensualReferencia !== undefined && input.montoMensualReferencia > 0
            ? (input.monedaReferencia ?? 'PEN')
            : undefined,
        // Línea de negocio · single · ausente = compartido (chk5-LINEAS)
        lineaNegocioId: input.lineaNegocioId || undefined,
        lineaNegocioSnapshot: buildLineaSnapshot(input.lineaNegocioId, lineasActivas),
        notas: input.notas?.trim() || undefined,
        entidadMaestroRef: input.entidadMaestroRef,
      };

      await relacionesLaboralesService.create(relacionInput, creadoPor);
      return { uid };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al agregar relación';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  return { create, lookupUserByEmail, addRelacionToExisting, loading, error, clearError };
}
