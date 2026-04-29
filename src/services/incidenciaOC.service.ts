import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  IncidenciaOC,
  NuevaIncidenciaOCInput,
  NuevaAccionIncidenciaInput,
  EstadoIncidenciaOC,
  AccionIncidenciaOC,
} from '../types/incidenciaOC.types';

/**
 * S54 · Tanda 2 — Servicio de Incidencias de OC.
 * Operaciones: crear · listar (snapshot) · actualizar estado · agregar acción · resolver.
 */

const COL = 'incidenciasOC';

// ─────────────────────────────────────────────────────────────────────────────

/** Genera número legible secuencial: INC-OC-20260424-001. */
async function generarNumeroIncidencia(): Promise<string> {
  const hoy = new Date();
  const fechaStr =
    `${hoy.getFullYear()}` +
    `${String(hoy.getMonth() + 1).padStart(2, '0')}` +
    `${String(hoy.getDate()).padStart(2, '0')}`;

  // Contar cuántas incidencias se crearon hoy para el siguiente secuencial
  const inicioDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const q = query(
    collection(db, COL),
    where('fechaCreacion', '>=', Timestamp.fromDate(inicioDelDia))
  );
  const snap = await getDocs(q);
  const siguiente = String(snap.size + 1).padStart(3, '0');
  return `INC-OC-${fechaStr}-${siguiente}`;
}

// ─────────────────────────────────────────────────────────────────────────────

export const incidenciaOCService = {
  /** Crea una nueva incidencia ligada a una OC. */
  async crear(
    input: NuevaIncidenciaOCInput,
    creadoPor: string,
    creadoPorNombre?: string
  ): Promise<string> {
    const numero = await generarNumeroIncidencia();

    // Firestore no acepta undefined; limpiamos.
    const clean: Record<string, unknown> = {
      numero,
      ocId: input.ocId,
      ocNumero: input.ocNumero,
      tipo: input.tipo,
      estado: 'abierta' as EstadoIncidenciaOC,
      titulo: input.titulo,
      creadoPor,
      fechaCreacion: serverTimestamp(),
      acciones: [],
    };
    if (input.proveedorId) clean.proveedorId = input.proveedorId;
    if (input.proveedorNombre) clean.proveedorNombre = input.proveedorNombre;
    if (creadoPorNombre) clean.creadoPorNombre = creadoPorNombre;
    if (input.descripcion) clean.descripcion = input.descripcion;
    if (input.severidad) clean.severidad = input.severidad;
    if (input.impactoEstimadoUSD !== undefined) clean.impactoEstimadoUSD = input.impactoEstimadoUSD;
    if (input.envioId) clean.envioId = input.envioId;
    if (input.envioNumero) clean.envioNumero = input.envioNumero;
    if (input.productoId) clean.productoId = input.productoId;
    if (input.productoSku) clean.productoSku = input.productoSku;
    if (input.productoNombre) clean.productoNombre = input.productoNombre;
    if (input.lote) clean.lote = input.lote;
    if (input.cantidad !== undefined) clean.cantidad = input.cantidad;

    const ref = await addDoc(collection(db, COL), clean);
    return ref.id;
  },

  /**
   * Subscribe a incidencias de una OC. Devuelve unsubscribe.
   * Query simple sin orderBy (no requiere índice compuesto); ordenamos
   * por fechaCreacion desc en memoria.
   */
  subscribeByOC(
    ocId: string,
    cb: (items: IncidenciaOC[]) => void
  ): () => void {
    const q = query(collection(db, COL), where('ocId', '==', ocId));
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<IncidenciaOC, 'id'>),
      }));
      items.sort((a, b) => {
        const ta = (a.fechaCreacion as Timestamp)?.toMillis?.() ?? 0;
        const tb = (b.fechaCreacion as Timestamp)?.toMillis?.() ?? 0;
        return tb - ta;
      });
      cb(items);
    });
  },

  /** Cambia el estado de una incidencia. */
  async actualizarEstado(id: string, nuevoEstado: EstadoIncidenciaOC): Promise<void> {
    await updateDoc(doc(db, COL, id), {
      estado: nuevoEstado,
      fechaActualizacion: serverTimestamp(),
    });
  },

  /** Agrega una acción al log de la incidencia (arrayUnion). */
  async agregarAccion(
    id: string,
    input: NuevaAccionIncidenciaInput,
    usuarioId: string,
    usuarioNombre?: string
  ): Promise<void> {
    // arrayUnion no soporta serverTimestamp() directamente; usamos Timestamp.now().
    const accion: AccionIncidenciaOC = {
      id: `ACT-${Date.now()}`,
      tipo: input.tipo,
      descripcion: input.descripcion,
      fecha: Timestamp.now(),
      usuario: usuarioId,
    };
    if (input.montoUSD !== undefined) accion.montoUSD = input.montoUSD;
    if (input.referencia) accion.referencia = input.referencia;
    if (usuarioNombre) accion.usuarioNombre = usuarioNombre;

    await updateDoc(doc(db, COL, id), {
      acciones: arrayUnion(accion),
      fechaActualizacion: serverTimestamp(),
      // Si la incidencia estaba 'abierta', mover automáticamente a 'en_gestion'.
      // Esto se hace desde el caller (tiene acceso al estado actual).
    });
  },

  /** Resuelve una incidencia marcándola como resuelta con un resumen. */
  async resolver(
    id: string,
    resolucion: string,
    resolvidoPor: string,
    resolvidoPorNombre?: string,
    impactoRealUSD?: number
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      estado: 'resuelta' as EstadoIncidenciaOC,
      resolucion,
      resolvidoPor,
      fechaResolucion: serverTimestamp(),
      fechaActualizacion: serverTimestamp(),
    };
    if (resolvidoPorNombre) payload.resolvidoPorNombre = resolvidoPorNombre;
    if (impactoRealUSD !== undefined) payload.impactoRealUSD = impactoRealUSD;
    await updateDoc(doc(db, COL, id), payload);
  },
};
