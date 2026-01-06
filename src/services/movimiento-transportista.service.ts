import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  MovimientoTransportista,
  TipoMovimientoTransportista,
  ResumenCuentaTransportista
} from '../types/transportista.types';
import type { Entrega } from '../types/entrega.types';

const COLLECTION_NAME = 'movimientos_transportista';

export const movimientoTransportistaService = {
  /**
   * Obtener el saldo actual de un transportista
   * Positivo = le debemos dinero
   * Negativo = nos debe dinero (recaudó más de lo que le pagamos)
   */
  async getSaldoActual(transportistaId: string): Promise<number> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('transportistaId', '==', transportistaId),
      orderBy('fechaCreacion', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return 0;
    }

    const ultimoMovimiento = snapshot.docs[0].data() as MovimientoTransportista;
    return ultimoMovimiento.saldoNuevo;
  },

  /**
   * Registrar entrega exitosa
   * - Genera deuda a favor del transportista (por el costo de entrega)
   * - Si recaudó dinero, genera deuda del transportista hacia nosotros
   */
  async registrarEntregaExitosa(
    entrega: Entrega,
    montoRecaudado: number | undefined,
    gastoId: string | undefined,
    userId: string
  ): Promise<string> {
    const saldoAnterior = await this.getSaldoActual(entrega.transportistaId);

    // Calcular movimiento neto:
    // + costoEntrega (le debemos por el servicio)
    // - montoRecaudado (nos debe lo que cobró)
    const costoEntrega = entrega.costoTransportista;
    const recaudado = montoRecaudado || 0;
    const movimientoNeto = costoEntrega - recaudado;
    const saldoNuevo = saldoAnterior + movimientoNeto;

    const now = Timestamp.now();

    const movimiento: Omit<MovimientoTransportista, 'id'> = {
      transportistaId: entrega.transportistaId,
      transportistaNombre: entrega.nombreTransportista,
      tipo: 'entrega_exitosa',
      entregaId: entrega.id,
      entregaCodigo: entrega.codigo,
      ventaId: entrega.ventaId,
      ventaNumero: entrega.numeroVenta,
      gastoId,
      costoEntrega,
      montoRecaudado: recaudado > 0 ? recaudado : undefined,
      saldoAnterior,
      movimientoNeto,
      saldoNuevo,
      distrito: entrega.distrito,
      fecha: now,
      observaciones: recaudado > 0
        ? `Entrega completada. Costo: S/${costoEntrega.toFixed(2)}, Recaudado: S/${recaudado.toFixed(2)}`
        : `Entrega completada. Costo: S/${costoEntrega.toFixed(2)}`,
      creadoPor: userId,
      fechaCreacion: now
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), movimiento);
    return docRef.id;
  },

  /**
   * Registrar entrega fallida
   * Solo para historial, no afecta saldo (no se cobra si no entregó)
   */
  async registrarEntregaFallida(
    entrega: Entrega,
    motivoFallo: string,
    userId: string
  ): Promise<string> {
    const saldoAnterior = await this.getSaldoActual(entrega.transportistaId);
    const now = Timestamp.now();

    const movimiento: Omit<MovimientoTransportista, 'id'> = {
      transportistaId: entrega.transportistaId,
      transportistaNombre: entrega.nombreTransportista,
      tipo: 'entrega_fallida',
      entregaId: entrega.id,
      entregaCodigo: entrega.codigo,
      ventaId: entrega.ventaId,
      ventaNumero: entrega.numeroVenta,
      costoEntrega: 0, // No se cobra por entrega fallida
      saldoAnterior,
      movimientoNeto: 0,
      saldoNuevo: saldoAnterior,
      distrito: entrega.distrito,
      fecha: now,
      observaciones: `Entrega fallida: ${motivoFallo}`,
      creadoPor: userId,
      fechaCreacion: now
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), movimiento);
    return docRef.id;
  },

  /**
   * Registrar pago al transportista
   */
  async registrarPago(
    transportistaId: string,
    transportistaNombre: string,
    montoPago: number,
    observaciones: string,
    userId: string
  ): Promise<string> {
    const saldoAnterior = await this.getSaldoActual(transportistaId);
    const movimientoNeto = -montoPago; // Reduce lo que le debemos
    const saldoNuevo = saldoAnterior + movimientoNeto;

    const now = Timestamp.now();

    const movimiento: Omit<MovimientoTransportista, 'id'> = {
      transportistaId,
      transportistaNombre,
      tipo: 'pago_transportista',
      costoEntrega: 0,
      montoPago,
      saldoAnterior,
      movimientoNeto,
      saldoNuevo,
      fecha: now,
      observaciones: observaciones || `Pago al transportista: S/${montoPago.toFixed(2)}`,
      creadoPor: userId,
      fechaCreacion: now
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), movimiento);
    return docRef.id;
  },

  /**
   * Obtener movimientos de un transportista
   */
  async getByTransportista(
    transportistaId: string,
    limite: number = 50
  ): Promise<MovimientoTransportista[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('transportistaId', '==', transportistaId),
      orderBy('fechaCreacion', 'desc'),
      limit(limite)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MovimientoTransportista));
  },

  /**
   * Obtener movimientos por entrega
   */
  async getByEntrega(entregaId: string): Promise<MovimientoTransportista[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('entregaId', '==', entregaId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MovimientoTransportista));
  },

  /**
   * Obtener resumen de cuenta de un transportista
   */
  async getResumenCuenta(
    transportistaId: string,
    transportistaNombre: string
  ): Promise<ResumenCuentaTransportista> {
    const movimientos = await this.getByTransportista(transportistaId, 100);
    const saldoActual = movimientos.length > 0 ? movimientos[0].saldoNuevo : 0;

    let totalCostosEntrega = 0;
    let totalRecaudado = 0;
    let totalPagado = 0;
    let totalComisiones = 0;
    let entregasExitosas = 0;
    let entregasFallidas = 0;

    movimientos.forEach(m => {
      if (m.tipo === 'entrega_exitosa') {
        totalCostosEntrega += m.costoEntrega;
        totalRecaudado += m.montoRecaudado || 0;
        totalComisiones += m.comision || 0;
        entregasExitosas++;
      } else if (m.tipo === 'entrega_fallida') {
        entregasFallidas++;
      } else if (m.tipo === 'pago_transportista') {
        totalPagado += m.montoPago || 0;
      }
    });

    return {
      transportistaId,
      transportistaNombre,
      saldoActual,
      totalCostosEntrega,
      totalRecaudado,
      totalPagado,
      totalComisiones,
      entregasExitosas,
      entregasFallidas,
      ultimosMovimientos: movimientos.slice(0, 10)
    };
  },

  /**
   * Obtener transportistas con saldo pendiente
   */
  async getTransportistasConSaldo(): Promise<Array<{
    transportistaId: string;
    transportistaNombre: string;
    saldo: number;
  }>> {
    // Obtener último movimiento de cada transportista
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const movimientos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MovimientoTransportista));

    // Agrupar por transportista y obtener el más reciente
    const porTransportista: Record<string, MovimientoTransportista> = {};

    movimientos.forEach(m => {
      const existente = porTransportista[m.transportistaId];
      if (!existente || m.fechaCreacion.toMillis() > existente.fechaCreacion.toMillis()) {
        porTransportista[m.transportistaId] = m;
      }
    });

    // Convertir a array y filtrar solo los que tienen saldo != 0
    return Object.values(porTransportista)
      .filter(m => m.saldoNuevo !== 0)
      .map(m => ({
        transportistaId: m.transportistaId,
        transportistaNombre: m.transportistaNombre,
        saldo: m.saldoNuevo
      }))
      .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
  }
};
