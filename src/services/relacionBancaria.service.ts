/**
 * relacionBancaria.service.ts — ADR-PF-001 · F2
 *
 * CRUD de RelacionBancaria. Cada doc representa "el vínculo entre un titular
 * y un banco" — agrupa todos los productos financieros que ese titular tiene
 * en ese banco.
 *
 * Una misma persona puede tener:
 *   - RelacionBancaria(banco='BCP', titularidad='empresa')             → empresa
 *   - RelacionBancaria(banco='BCP', titularidad='personal', empleado:X) → personal
 * Son 2 relaciones distintas.
 *
 * Uso típico desde UI:
 *   1. Wizard de producto pregunta "qué banco" + "quién titulariza"
 *   2. Se busca/crea RelacionBancaria con findOrCreate()
 *   3. El producto guarda solo `relacionBancariaId`
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type {
  RelacionBancaria,
  RelacionBancariaFormData,
  TitularidadPF,
  TipoEntidadTitularPF,
} from '../types/relacionBancaria.types';
import { buildRelacionBancariaKey } from '../types/relacionBancaria.types';

const COL = COLLECTIONS.RELACIONES_BANCARIAS;

// ═════════════════════════════════════════════════════════════════════════
// CREAR
// ═════════════════════════════════════════════════════════════════════════

export async function crearRelacionBancaria(
  data: RelacionBancariaFormData,
  userId: string,
): Promise<string> {
  if (!data.banco?.trim()) {
    throw new Error('El banco es obligatorio');
  }
  if (!data.bancoNombreCompleto?.trim()) {
    throw new Error('El nombre completo del banco es obligatorio');
  }
  if (data.titularidad === 'personal' && !data.titularEntidadId) {
    throw new Error(
      'Para titularidad personal se requiere vincular a una entidad (empleado/colaborador/proveedor/cliente)',
    );
  }

  // Evitar duplicados: misma key (banco + titular)
  const existente = await findRelacionBancaria(
    data.banco.trim(),
    data.titularidad,
    data.titularEntidadId,
  );
  if (existente) {
    throw new Error(
      `Ya existe una relación bancaria con ${data.banco} para este titular. Usa la existente (id=${existente.id}).`,
    );
  }

  const docData: Record<string, unknown> = {
    banco: data.banco.trim(),
    bancoNombreCompleto: data.bancoNombreCompleto.trim(),
    titularidad: data.titularidad,
    activa: true,
    creadoPor: userId,
    fechaCreacion: Timestamp.now(),
  };

  // Opcionales
  if (data.bancoLogo?.trim()) docData.bancoLogo = data.bancoLogo.trim();
  if (data.titularEntidadId) docData.titularEntidadId = data.titularEntidadId;
  if (data.titularEntidadTipo) docData.titularEntidadTipo = data.titularEntidadTipo;
  if (data.titularNombre?.trim()) docData.titularNombre = data.titularNombre.trim();
  if (data.oficialDeCuenta?.trim()) docData.oficialDeCuenta = data.oficialDeCuenta.trim();
  if (data.numeroCliente?.trim()) docData.numeroCliente = data.numeroCliente.trim();
  if (data.fechaApertura) docData.fechaApertura = Timestamp.fromDate(data.fechaApertura);
  if (data.sucursal?.trim()) docData.sucursal = data.sucursal.trim();
  if (data.notas?.trim()) docData.notas = data.notas.trim();

  const ref = await addDoc(collection(db, COL), docData);
  return ref.id;
}

// ═════════════════════════════════════════════════════════════════════════
// LEER
// ═════════════════════════════════════════════════════════════════════════

export async function getRelacionBancaria(
  id: string,
): Promise<RelacionBancaria | null> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as RelacionBancaria;
}

export async function getRelacionesBancarias(): Promise<RelacionBancaria[]> {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RelacionBancaria);
}

export async function getRelacionesBancariasActivas(): Promise<RelacionBancaria[]> {
  const q = query(collection(db, COL), where('activa', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RelacionBancaria);
}

/**
 * Busca una relación bancaria por la tupla (banco, titularidad, titularEntidadId).
 * Retorna null si no existe.
 */
export async function findRelacionBancaria(
  banco: string,
  titularidad: TitularidadPF,
  titularEntidadId?: string,
): Promise<RelacionBancaria | null> {
  let q = query(
    collection(db, COL),
    where('banco', '==', banco),
    where('titularidad', '==', titularidad),
  );

  // Para titularidad personal, además filtrar por entidadId
  if (titularidad === 'personal' && titularEntidadId) {
    q = query(q, where('titularEntidadId', '==', titularEntidadId));
  }

  const snap = await getDocs(q);
  if (snap.empty) return null;

  // Si titularidad='empresa', no debería haber duplicados; tomar el primero
  const docFound = snap.docs[0];
  return { id: docFound.id, ...docFound.data() } as RelacionBancaria;
}

/**
 * Busca una relación bancaria, o la crea si no existe.
 * Patrón usado por el wizard de producto cuando el usuario elige banco
 * y titularidad pero todavía no hay relación.
 */
export async function findOrCreateRelacionBancaria(
  data: RelacionBancariaFormData,
  userId: string,
): Promise<{ id: string; created: boolean }> {
  const existente = await findRelacionBancaria(
    data.banco.trim(),
    data.titularidad,
    data.titularEntidadId,
  );
  if (existente) {
    return { id: existente.id, created: false };
  }
  const id = await crearRelacionBancaria(data, userId);
  return { id, created: true };
}

// ═════════════════════════════════════════════════════════════════════════
// ACTUALIZAR
// ═════════════════════════════════════════════════════════════════════════

export async function actualizarRelacionBancaria(
  id: string,
  data: Partial<RelacionBancariaFormData>,
  userId: string,
): Promise<void> {
  const updates: Record<string, unknown> = {
    actualizadoPor: userId,
    fechaActualizacion: Timestamp.now(),
  };

  if (data.banco !== undefined) updates.banco = data.banco.trim();
  if (data.bancoNombreCompleto !== undefined)
    updates.bancoNombreCompleto = data.bancoNombreCompleto.trim();
  if (data.bancoLogo !== undefined) updates.bancoLogo = data.bancoLogo;
  if (data.titularidad !== undefined) updates.titularidad = data.titularidad;
  if (data.titularEntidadId !== undefined)
    updates.titularEntidadId = data.titularEntidadId;
  if (data.titularEntidadTipo !== undefined)
    updates.titularEntidadTipo = data.titularEntidadTipo;
  if (data.titularNombre !== undefined) updates.titularNombre = data.titularNombre;
  if (data.oficialDeCuenta !== undefined)
    updates.oficialDeCuenta = data.oficialDeCuenta;
  if (data.numeroCliente !== undefined) updates.numeroCliente = data.numeroCliente;
  if (data.fechaApertura !== undefined && data.fechaApertura) {
    updates.fechaApertura = Timestamp.fromDate(data.fechaApertura);
  }
  if (data.sucursal !== undefined) updates.sucursal = data.sucursal;
  if (data.notas !== undefined) updates.notas = data.notas;

  await updateDoc(doc(db, COL, id), updates);
}

export async function toggleActivaRelacionBancaria(
  id: string,
  activa: boolean,
  userId: string,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    activa,
    actualizadoPor: userId,
    fechaActualizacion: Timestamp.now(),
  });
}

// ═════════════════════════════════════════════════════════════════════════
// ELIMINAR
// ═════════════════════════════════════════════════════════════════════════

/**
 * Borra una relación bancaria. Solo permitido si NO tiene productos
 * financieros activos vinculados.
 *
 * Importante: este servicio NO valida la existencia de productos vinculados.
 * Esa validación se hace en productoFinanciero.service.ts antes de invocar
 * este delete (mantenemos services desacoplados).
 */
export async function eliminarRelacionBancaria(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS DE AGRUPACION
// ═════════════════════════════════════════════════════════════════════════

/**
 * Mapa key → id para lookup rápido en UI.
 */
export function buildRelacionBancariaIndex(
  relaciones: RelacionBancaria[],
): Map<string, RelacionBancaria> {
  const index = new Map<string, RelacionBancaria>();
  for (const r of relaciones) {
    const key = buildRelacionBancariaKey(
      r.banco,
      r.titularidad,
      r.titularEntidadId,
    );
    index.set(key, r);
  }
  return index;
}

/**
 * Re-export de tipos por conveniencia (para que consumers no tengan que
 * importar de 2 lugares).
 */
export type {
  RelacionBancaria,
  RelacionBancariaFormData,
  TitularidadPF,
  TipoEntidadTitularPF,
};
