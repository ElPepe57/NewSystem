import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';

/**
 * Pool USD View Service
 *
 * REINGENIERIA: Pool USD ya no tiene colecciones propias.
 * El TCPA se calcula desde los movimientos de cuentas USD en Tesoreria.
 *
 * Este servicio reemplaza:
 * - poolUSDMovimientos (coleccion deprecada)
 * - poolUSDSnapshots (coleccion deprecada)
 * - poolUSD.service.ts (servicio deprecado)
 *
 * El TCPA (Tipo de Cambio Promedio Ajustado) se calcula como:
 * TCPA = SUM(montoPEN de compras USD) / SUM(montoUSD de compras USD)
 * Usando movimientos de Tesoreria que son conversiones PEN→USD.
 */
export const poolUSDViewService = {
  /**
   * Calcula el TCPA actual desde los movimientos de Tesoreria.
   * Solo considera cuentas en USD y movimientos de tipo conversion/compra.
   */
  async calcularTCPA(): Promise<{
    tcpa: number;
    totalUSDComprado: number;
    totalPENGastado: number;
    movimientosCount: number;
  }> {
    try {
      // Buscar conversiones cambiarias
      const convSnap = await getDocs(collection(db, COLLECTIONS.CONVERSIONES_CAMBIARIAS));

      let totalUSD = 0;
      let totalPEN = 0;

      for (const d of convSnap.docs) {
        const data = d.data();
        if (data.monedaOrigen === 'PEN' && data.monedaDestino === 'USD') {
          totalUSD += data.montoDestino || 0;
          totalPEN += data.montoOrigen || 0;
        }
      }

      const tcpa = totalUSD > 0 ? totalPEN / totalUSD : 0;

      return {
        tcpa: Math.round(tcpa * 10000) / 10000,
        totalUSDComprado: totalUSD,
        totalPENGastado: totalPEN,
        movimientosCount: convSnap.size,
      };
    } catch (error: any) {
      logger.error('Error al calcular TCPA:', error);
      return { tcpa: 0, totalUSDComprado: 0, totalPENGastado: 0, movimientosCount: 0 };
    }
  },

  /**
   * Obtiene el saldo actual de todas las cuentas USD.
   */
  async getSaldoUSD(): Promise<{ totalUSD: number; cuentas: Array<{ id: string; nombre: string; saldo: number }> }> {
    try {
      const cuentasSnap = await getDocs(
        query(collection(db, COLLECTIONS.CUENTAS_CAJA), where('moneda', '==', 'USD'))
      );

      const cuentas = cuentasSnap.docs.map(d => ({
        id: d.id,
        nombre: d.data().nombre || d.data().banco || 'USD',
        saldo: d.data().saldo || 0,
      }));

      const totalUSD = cuentas.reduce((sum, c) => sum + c.saldo, 0);

      return { totalUSD, cuentas };
    } catch (error: any) {
      logger.error('Error al obtener saldo USD:', error);
      return { totalUSD: 0, cuentas: [] };
    }
  },

  /**
   * Obtiene el resumen del rendimiento cambiario.
   * Reemplaza la pantalla de Pool USD con una vista agregada.
   */
  async getRendimientoCambiario(): Promise<{
    tcpa: number;
    saldoUSD: number;
    valorEnPEN: number;
    gananciaPerdiaPotencialPEN: number;
  }> {
    const [tcpaData, saldoData] = await Promise.all([
      this.calcularTCPA(),
      this.getSaldoUSD(),
    ]);

    // Valor del saldo USD al TCPA
    const valorEnPEN = saldoData.totalUSD * tcpaData.tcpa;

    return {
      tcpa: tcpaData.tcpa,
      saldoUSD: saldoData.totalUSD,
      valorEnPEN,
      gananciaPerdiaPotencialPEN: 0, // Se calculara con TC del dia
    };
  },
};
