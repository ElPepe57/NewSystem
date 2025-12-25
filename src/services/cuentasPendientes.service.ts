/**
 * Servicio de Cuentas Pendientes Consolidadas
 *
 * Consolida todos los pendientes financieros del sistema:
 * - Cuentas por Cobrar: Ventas pendientes de pago
 * - Cuentas por Pagar: OC, Gastos, Pagos a Viajeros
 */

import { Timestamp } from 'firebase/firestore';
import type {
  PendienteFinanciero,
  ResumenCuentasPorCobrar,
  ResumenCuentasPorPagar,
  DashboardCuentasPendientes,
  TipoPendiente,
  MonedaTesoreria
} from '../types/tesoreria.types';
import { VentaService } from './venta.service';
import { OrdenCompraService } from './ordenCompra.service';
import { gastoService } from './gasto.service';
import { transferenciaService } from './transferencia.service';
import { tipoCambioService } from './tipoCambio.service';

/**
 * Calcula días desde una fecha
 */
function calcularDiasPendiente(fecha: Timestamp): number {
  const ahora = new Date();
  const fechaDoc = fecha.toDate();
  const diffTime = ahora.getTime() - fechaDoc.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Clasifica por antigüedad
 */
function clasificarPorAntiguedad(pendientes: PendienteFinanciero[]): {
  pendiente0a7dias: number;
  pendiente8a15dias: number;
  pendiente16a30dias: number;
  pendienteMas30dias: number;
} {
  let pendiente0a7dias = 0;
  let pendiente8a15dias = 0;
  let pendiente16a30dias = 0;
  let pendienteMas30dias = 0;

  for (const p of pendientes) {
    const monto = p.moneda === 'PEN' ? p.montoPendiente : (p.montoEquivalentePEN || p.montoPendiente);

    if (p.diasPendiente <= 7) {
      pendiente0a7dias += monto;
    } else if (p.diasPendiente <= 15) {
      pendiente8a15dias += monto;
    } else if (p.diasPendiente <= 30) {
      pendiente16a30dias += monto;
    } else {
      pendienteMas30dias += monto;
    }
  }

  return { pendiente0a7dias, pendiente8a15dias, pendiente16a30dias, pendienteMas30dias };
}

export const cuentasPendientesService = {
  /**
   * Obtiene todas las ventas pendientes de cobro
   */
  async getVentasPorCobrar(tc: number): Promise<PendienteFinanciero[]> {
    try {
      const ventas = await VentaService.getAll();
      const pendientes: PendienteFinanciero[] = [];

      for (const venta of ventas) {
        // Solo ventas con pago pendiente o parcial
        if (venta.estadoPago === 'pagado' || venta.estado === 'cancelada' || venta.estado === 'cotizacion') {
          continue;
        }

        const montoPendiente = venta.montoPendiente || (venta.totalPEN - (venta.montoPagado || 0));
        if (montoPendiente <= 0) continue;

        const diasPendiente = calcularDiasPendiente(venta.fechaCreacion);

        pendientes.push({
          id: `venta-${venta.id}`,
          tipo: 'venta_por_cobrar',
          documentoId: venta.id,
          numeroDocumento: venta.numeroVenta,
          contraparteNombre: venta.nombreCliente,
          contraparteId: venta.clienteId,
          montoTotal: venta.totalPEN,
          montoPagado: venta.montoPagado || 0,
          montoPendiente,
          moneda: 'PEN',
          montoEquivalentePEN: montoPendiente,
          fechaDocumento: venta.fechaCreacion,
          diasPendiente,
          estadoDocumento: venta.estado,
          esVencido: diasPendiente > 30,
          esParcial: venta.estadoPago === 'parcial',
          canal: venta.canal,
          notas: venta.observaciones
        });
      }

      return pendientes.sort((a, b) => b.diasPendiente - a.diasPendiente);
    } catch (error) {
      console.error('Error obteniendo ventas por cobrar:', error);
      return [];
    }
  },

  /**
   * Obtiene todas las órdenes de compra pendientes de pago
   */
  async getOrdenesCompraPorPagar(tc: number): Promise<PendienteFinanciero[]> {
    try {
      const ordenes = await OrdenCompraService.getAll();
      const pendientes: PendienteFinanciero[] = [];

      for (const oc of ordenes) {
        // Solo OC con pago pendiente o parcial
        if (oc.estadoPago === 'pagada' || oc.estado === 'cancelada') {
          continue;
        }

        const montoPendiente = oc.montoPendiente || oc.totalUSD;
        if (montoPendiente <= 0) continue;

        const diasPendiente = calcularDiasPendiente(oc.fechaCreacion);
        const montoEquivalentePEN = montoPendiente * tc;

        pendientes.push({
          id: `oc-${oc.id}`,
          tipo: 'orden_compra_por_pagar',
          documentoId: oc.id,
          numeroDocumento: oc.numeroOrden,
          contraparteNombre: oc.nombreProveedor,
          contraparteId: oc.proveedorId,
          montoTotal: oc.totalUSD,
          montoPagado: oc.totalUSD - montoPendiente,
          montoPendiente,
          moneda: 'USD',
          tipoCambio: tc,
          montoEquivalentePEN,
          fechaDocumento: oc.fechaCreacion,
          diasPendiente,
          estadoDocumento: oc.estado,
          esVencido: diasPendiente > 30,
          esParcial: oc.estadoPago === 'pago_parcial',
          notas: oc.observaciones
        });
      }

      return pendientes.sort((a, b) => b.diasPendiente - a.diasPendiente);
    } catch (error) {
      console.error('Error obteniendo OC por pagar:', error);
      return [];
    }
  },

  /**
   * Obtiene todos los gastos pendientes de pago
   */
  async getGastosPorPagar(tc: number): Promise<PendienteFinanciero[]> {
    try {
      const gastos = await gastoService.getAll();
      const pendientes: PendienteFinanciero[] = [];

      for (const gasto of gastos) {
        if (gasto.estado !== 'pendiente') continue;

        const moneda: MonedaTesoreria = gasto.moneda;
        const montoPendiente = gasto.montoOriginal;
        const diasPendiente = calcularDiasPendiente(gasto.fechaCreacion);

        let montoEquivalentePEN = montoPendiente;
        if (moneda === 'USD') {
          montoEquivalentePEN = montoPendiente * tc;
        }

        pendientes.push({
          id: `gasto-${gasto.id}`,
          tipo: 'gasto_por_pagar',
          documentoId: gasto.id,
          numeroDocumento: gasto.numeroGasto,
          contraparteNombre: gasto.proveedor || gasto.descripcion,
          montoTotal: gasto.montoOriginal,
          montoPagado: 0,
          montoPendiente,
          moneda,
          tipoCambio: moneda === 'USD' ? tc : undefined,
          montoEquivalentePEN,
          fechaDocumento: gasto.fechaCreacion,
          diasPendiente,
          estadoDocumento: gasto.estado,
          esVencido: diasPendiente > 15,
          esParcial: false,
          notas: gasto.notas
        });
      }

      return pendientes.sort((a, b) => b.diasPendiente - a.diasPendiente);
    } catch (error) {
      console.error('Error obteniendo gastos por pagar:', error);
      return [];
    }
  },

  /**
   * Obtiene pagos pendientes a viajeros
   */
  async getViajerosPorPagar(tc: number): Promise<PendienteFinanciero[]> {
    try {
      const transferencias = await transferenciaService.getPendientesPagoViajero();
      const pendientes: PendienteFinanciero[] = [];

      for (const t of transferencias) {
        if (!t.costoFleteTotal || t.costoFleteTotal <= 0) continue;

        const diasPendiente = t.fechaLlegadaReal
          ? calcularDiasPendiente(t.fechaLlegadaReal)
          : calcularDiasPendiente(t.fechaCreacion);

        const moneda: MonedaTesoreria = t.monedaFlete || 'USD';
        const montoPendiente = t.costoFleteTotal;

        let montoEquivalentePEN = montoPendiente;
        if (moneda === 'USD') {
          montoEquivalentePEN = montoPendiente * tc;
        }

        pendientes.push({
          id: `viajero-${t.id}`,
          tipo: 'viajero_por_pagar',
          documentoId: t.id,
          numeroDocumento: t.numeroTransferencia,
          contraparteNombre: t.viajeroNombre || 'Viajero sin nombre',
          contraparteId: t.viajeroId,
          montoTotal: t.costoFleteTotal,
          montoPagado: 0,
          montoPendiente,
          moneda,
          tipoCambio: moneda === 'USD' ? tc : undefined,
          montoEquivalentePEN,
          fechaDocumento: t.fechaLlegadaReal || t.fechaCreacion,
          diasPendiente,
          estadoDocumento: t.estado,
          esVencido: diasPendiente > 7,
          esParcial: false,
          notas: t.notas
        });
      }

      return pendientes.sort((a, b) => b.diasPendiente - a.diasPendiente);
    } catch (error) {
      console.error('Error obteniendo pagos viajeros pendientes:', error);
      return [];
    }
  },

  /**
   * Genera el resumen de cuentas por cobrar
   */
  async getResumenCuentasPorCobrar(tc: number): Promise<ResumenCuentasPorCobrar> {
    const pendientes = await this.getVentasPorCobrar(tc);

    let totalPendientePEN = 0;
    let totalPendienteUSD = 0;
    let cantidadVencidos = 0;
    let cantidadParciales = 0;

    // Agrupar por canal
    const canalMap = new Map<string, { cantidad: number; montoPEN: number }>();

    for (const p of pendientes) {
      if (p.moneda === 'PEN') {
        totalPendientePEN += p.montoPendiente;
      } else {
        totalPendienteUSD += p.montoPendiente;
      }

      if (p.esVencido) cantidadVencidos++;
      if (p.esParcial) cantidadParciales++;

      // Por canal
      const canal = p.canal || 'otro';
      const canalData = canalMap.get(canal) || { cantidad: 0, montoPEN: 0 };
      canalData.cantidad++;
      canalData.montoPEN += p.montoEquivalentePEN || p.montoPendiente;
      canalMap.set(canal, canalData);
    }

    const totalEquivalentePEN = totalPendientePEN + (totalPendienteUSD * tc);
    const antiguedad = clasificarPorAntiguedad(pendientes);

    const porCanal = Array.from(canalMap.entries()).map(([canal, data]) => ({
      canal,
      cantidad: data.cantidad,
      montoPEN: data.montoPEN
    }));

    return {
      totalPendientePEN,
      totalPendienteUSD,
      totalEquivalentePEN,
      cantidadDocumentos: pendientes.length,
      cantidadVencidos,
      cantidadParciales,
      ...antiguedad,
      porCanal,
      pendientes
    };
  },

  /**
   * Genera el resumen de cuentas por pagar
   */
  async getResumenCuentasPorPagar(tc: number): Promise<ResumenCuentasPorPagar> {
    // Obtener todos los pendientes
    const [ocPendientes, gastosPendientes, viajerosPendientes] = await Promise.all([
      this.getOrdenesCompraPorPagar(tc),
      this.getGastosPorPagar(tc),
      this.getViajerosPorPagar(tc)
    ]);

    const todosPendientes = [...ocPendientes, ...gastosPendientes, ...viajerosPendientes];

    let totalPendientePEN = 0;
    let totalPendienteUSD = 0;
    let cantidadVencidos = 0;
    let cantidadParciales = 0;

    // Por tipo
    const tipoMap = new Map<TipoPendiente, { cantidad: number; montoPEN: number; montoUSD: number }>();

    for (const p of todosPendientes) {
      if (p.moneda === 'PEN') {
        totalPendientePEN += p.montoPendiente;
      } else {
        totalPendienteUSD += p.montoPendiente;
      }

      if (p.esVencido) cantidadVencidos++;
      if (p.esParcial) cantidadParciales++;

      // Por tipo
      const tipoData = tipoMap.get(p.tipo) || { cantidad: 0, montoPEN: 0, montoUSD: 0 };
      tipoData.cantidad++;
      if (p.moneda === 'PEN') {
        tipoData.montoPEN += p.montoPendiente;
      } else {
        tipoData.montoUSD += p.montoPendiente;
      }
      tipoMap.set(p.tipo, tipoData);
    }

    const totalEquivalentePEN = totalPendientePEN + (totalPendienteUSD * tc);
    const antiguedad = clasificarPorAntiguedad(todosPendientes);

    const etiquetasTipo: Record<TipoPendiente, string> = {
      'venta_por_cobrar': 'Ventas',
      'orden_compra_por_pagar': 'Órdenes de Compra',
      'gasto_por_pagar': 'Gastos Operativos',
      'viajero_por_pagar': 'Pagos a Viajeros'
    };

    const porTipo = Array.from(tipoMap.entries()).map(([tipo, data]) => ({
      tipo,
      etiqueta: etiquetasTipo[tipo],
      cantidad: data.cantidad,
      montoPEN: data.montoPEN,
      montoUSD: data.montoUSD
    }));

    // Ordenar por monto equivalente descendente
    todosPendientes.sort((a, b) =>
      (b.montoEquivalentePEN || b.montoPendiente) - (a.montoEquivalentePEN || a.montoPendiente)
    );

    return {
      totalPendientePEN,
      totalPendienteUSD,
      totalEquivalentePEN,
      cantidadDocumentos: todosPendientes.length,
      cantidadVencidos,
      cantidadParciales,
      porTipo,
      ...antiguedad,
      pendientes: todosPendientes
    };
  },

  /**
   * Genera el dashboard consolidado de CxP/CxC
   */
  async getDashboard(): Promise<DashboardCuentasPendientes> {
    // Obtener TC actual
    let tc = 3.70;
    try {
      const tcData = await tipoCambioService.getTCDelDia();
      if (tcData) tc = tcData.venta;
    } catch (e) {
      console.warn('No se pudo obtener TC, usando default:', tc);
    }

    // Obtener resúmenes
    const [cuentasPorCobrar, cuentasPorPagar] = await Promise.all([
      this.getResumenCuentasPorCobrar(tc),
      this.getResumenCuentasPorPagar(tc)
    ]);

    // Calcular balance neto
    const balanceNeto = {
      porCobrarPEN: cuentasPorCobrar.totalPendientePEN,
      porPagarPEN: cuentasPorPagar.totalPendientePEN,
      flujoNetoPEN: cuentasPorCobrar.totalPendientePEN - cuentasPorPagar.totalPendientePEN,
      porCobrarUSD: cuentasPorCobrar.totalPendienteUSD,
      porPagarUSD: cuentasPorPagar.totalPendienteUSD,
      flujoNetoUSD: cuentasPorCobrar.totalPendienteUSD - cuentasPorPagar.totalPendienteUSD
    };

    // Generar alertas
    const alertas: DashboardCuentasPendientes['alertas'] = [];

    // Alertas por vencimiento
    for (const p of [...cuentasPorCobrar.pendientes, ...cuentasPorPagar.pendientes]) {
      if (p.esVencido && p.montoPendiente > 100) {
        alertas.push({
          tipo: 'vencido',
          mensaje: `${p.numeroDocumento} vencido hace ${p.diasPendiente} días - ${p.contraparteNombre}`,
          pendienteId: p.id,
          prioridad: p.diasPendiente > 30 ? 'alta' : 'media'
        });
      }

      // Montos altos
      const montoEquiv = p.montoEquivalentePEN || p.montoPendiente;
      if (montoEquiv > 5000) {
        alertas.push({
          tipo: 'monto_alto',
          mensaje: `${p.numeroDocumento}: S/ ${montoEquiv.toFixed(2)} pendiente`,
          pendienteId: p.id,
          prioridad: montoEquiv > 10000 ? 'alta' : 'media'
        });
      }
    }

    // Ordenar alertas por prioridad
    const prioridadOrden = { alta: 0, media: 1, baja: 2 };
    alertas.sort((a, b) => prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad]);

    return {
      fechaCalculo: new Date(),
      tipoCambioUsado: tc,
      cuentasPorCobrar,
      cuentasPorPagar,
      balanceNeto,
      alertas: alertas.slice(0, 10) // Máximo 10 alertas
    };
  }
};
