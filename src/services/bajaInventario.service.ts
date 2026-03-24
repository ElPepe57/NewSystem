import { doc, updateDoc, collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type { DisposicionDanada, ResponsableDano, IncidenciaTransferencia } from '../types/transferencia.types';
import type { EstadoUnidad } from '../types/unidad.types';
import type { TipoGasto } from '../types/gasto.types';

/**
 * Datos para registrar una baja de inventario por daño
 */
export interface BajaDanoData {
  unidadId: string;
  transferenciaId: string;
  incidenciaId: string;
  productoId: string;
  productoNombre: string;
  sku: string;
  disposicion: DisposicionDanada;
  motivo: string;
  responsable: ResponsableDano;
  costoUnidadPEN: number;  // ctruInicial o costoBase de la unidad
  costoUnidadUSD?: number;
  evidenciaURL?: string;
}

/**
 * Resultado de una baja procesada
 */
export interface BajaResultado {
  unidadId: string;
  nuevoEstado: EstadoUnidad;
  gastoGenerado?: string; // ID del gasto si se generó
  reclamoGenerado?: boolean;
}

/**
 * Servicio de baja de inventario por daño en transferencia
 * Cuenta contable: 6952 - Desmedros (PCGE Perú / NIC 2)
 */
export const bajaInventarioService = {

  /**
   * Registra la baja de una unidad dañada
   * - Actualiza estado de la unidad
   * - Genera gasto contable si es baja definitiva
   * - Registra reclamo si hay responsable
   * - Marca la incidencia como resuelta
   */
  async registrarBajaPorDano(
    data: BajaDanoData,
    userId: string
  ): Promise<BajaResultado> {
    const now = Timestamp.now();
    let nuevoEstado: EstadoUnidad;
    let gastoId: string | undefined;

    // 1. Determinar nuevo estado según disposición
    switch (data.disposicion) {
      case 'baja_definitiva':
        nuevoEstado = 'baja';
        break;
      case 'devolucion_proveedor':
        nuevoEstado = 'en_reclamo';
        break;
      case 'reparacion_reingreso':
        nuevoEstado = 'disponible_peru';
        break;
    }

    // 2. Actualizar estado de la unidad
    const unidadRef = doc(db, COLLECTIONS.UNIDADES, data.unidadId);
    await updateDoc(unidadRef, {
      estado: nuevoEstado,
      disposicionDano: data.disposicion,
      disposicionMotivo: data.motivo,
      disposicionPor: userId,
      disposicionFecha: now,
      ultimaEdicion: now,
    });

    // 3. Generar gasto contable si es baja definitiva o sin responsable
    if (data.disposicion === 'baja_definitiva' ||
        (data.disposicion === 'devolucion_proveedor' && data.responsable === 'sin_responsable')) {
      const tipoGasto: TipoGasto = 'merma_transferencia';
      const gastoRef = await addDoc(collection(db, COLLECTIONS.GASTOS), {
        tipo: tipoGasto,
        categoria: 'operativo',
        concepto: `Baja por daño: ${data.sku} - ${data.productoNombre}`,
        descripcion: `Disposición: ${data.disposicion}. Motivo: ${data.motivo}`,
        montoOriginal: data.costoUnidadPEN,
        moneda: 'PEN',
        montoPEN: data.costoUnidadPEN,
        montoUSD: data.costoUnidadUSD || 0,
        fecha: now,
        estado: 'pagado',
        // Referencias
        transferenciaId: data.transferenciaId,
        unidadId: data.unidadId,
        productoId: data.productoId,
        // Cuenta contable
        cuentaContable: '6952', // Desmedros
        cuentaContrapartida: '2011', // Mercaderías importadas
        // Metadata
        creadoPor: userId,
        fechaCreacion: now,
        esAutomatico: true,
        origenGasto: 'baja_inventario',
      });
      gastoId = gastoRef.id;
    }

    // 4. Actualizar la incidencia en la transferencia como resuelta
    const transferRef = doc(db, COLLECTIONS.TRANSFERENCIAS, data.transferenciaId);
    // Leemos la transferencia para actualizar la incidencia específica
    const { getDoc: getDocFn } = await import('firebase/firestore');
    const transferSnap = await getDocFn(transferRef);
    if (transferSnap.exists()) {
      const transferData = transferSnap.data();
      const incidencias: IncidenciaTransferencia[] = transferData.incidencias || [];
      const updatedIncidencias = incidencias.map(inc => {
        if (inc.id === data.incidenciaId) {
          return {
            ...inc,
            resuelta: true,
            resolucion: `${data.disposicion}: ${data.motivo}`,
            fechaResolucion: now,
            disposicion: data.disposicion,
            disposicionMotivo: data.motivo,
            disposicionPor: userId,
            disposicionFecha: now,
            responsable: data.responsable,
            montoReclamoPEN: data.disposicion === 'devolucion_proveedor' ? data.costoUnidadPEN : undefined,
            estadoReclamo: data.disposicion === 'devolucion_proveedor' ? 'pendiente' as const : undefined,
          };
        }
        return inc;
      });

      await updateDoc(transferRef, {
        incidencias: updatedIncidencias,
        ultimaEdicion: now,
      });
    }

    return {
      unidadId: data.unidadId,
      nuevoEstado,
      gastoGenerado: gastoId,
      reclamoGenerado: data.disposicion === 'devolucion_proveedor',
    };
  },

  /**
   * Procesa múltiples bajas en lote (para el modal de gestión)
   */
  async procesarBajasLote(
    bajas: BajaDanoData[],
    userId: string
  ): Promise<BajaResultado[]> {
    const resultados: BajaResultado[] = [];
    for (const baja of bajas) {
      const resultado = await this.registrarBajaPorDano(baja, userId);
      resultados.push(resultado);
    }
    return resultados;
  },

  /**
   * Obtiene todas las unidades dañadas sin resolver (para tab en Inventario)
   */
  async getUnidadesDanadasPendientes(): Promise<any[]> {
    const q = query(
      collection(db, COLLECTIONS.UNIDADES),
      where('estado', '==', 'danada')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /**
   * Obtiene resumen de bajas por período (para cierre contable)
   */
  async getBajasPeriodo(mes: number, anio: number): Promise<{
    totalBajas: number;
    montoPEN: number;
    montoUSD: number;
    porDisposicion: Record<string, number>;
  }> {
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 0, 23, 59, 59);

    const q = query(
      collection(db, COLLECTIONS.GASTOS),
      where('origenGasto', '==', 'baja_inventario'),
      where('fecha', '>=', Timestamp.fromDate(inicio)),
      where('fecha', '<=', Timestamp.fromDate(fin))
    );

    const snap = await getDocs(q);
    let montoPEN = 0;
    let montoUSD = 0;
    const porDisposicion: Record<string, number> = {};

    snap.docs.forEach(d => {
      const data = d.data();
      montoPEN += data.montoPEN || 0;
      montoUSD += data.montoUSD || 0;
      // Count by tipo
      const tipo = data.tipo || 'merma_transferencia';
      porDisposicion[tipo] = (porDisposicion[tipo] || 0) + 1;
    });

    return {
      totalBajas: snap.size,
      montoPEN,
      montoUSD,
      porDisposicion,
    };
  },
};
