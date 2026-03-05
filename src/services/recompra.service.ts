/**
 * Servicio de Alertas de Recompra
 * Analiza el historial de compras de clientes y genera alertas
 * cuando un producto está próximo a necesitar recompra
 */
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Venta, ProductoVenta } from '../types/venta.types';
import type { Cliente } from '../types/entidadesMaestras.types';
import type { Producto } from '../types/producto.types';

/**
 * Alerta de recompra generada
 */
export interface AlertaRecompra {
  id: string;
  clienteId: string;
  clienteNombre: string;
  clienteTelefono?: string;
  productoId: string;
  productoNombre: string;
  productoSKU: string;
  fechaUltimaCompra: Date;
  diasDesdeCompra: number;
  cicloRecompraDias: number;
  diasRestantes: number;           // Puede ser negativo si ya pasó
  porcentajeCiclo: number;         // 0-100, >100 si ya pasó
  prioridad: 'alta' | 'media' | 'baja';
  ventaId: string;
  cantidadComprada: number;
}

/**
 * Resumen de alertas de recompra
 */
export interface ResumenAlertasRecompra {
  alertasUrgentes: AlertaRecompra[];    // Ya pasó el ciclo
  alertasProximas: AlertaRecompra[];    // Próximos 7 días
  alertasFuturas: AlertaRecompra[];     // 8-30 días
  totalAlertas: number;
  clientesAfectados: number;
  productosAfectados: number;
}

/**
 * Servicio de alertas de recompra
 */
export const recompraService = {
  /**
   * Obtiene todas las alertas de recompra activas
   */
  async getAlertasRecompra(): Promise<ResumenAlertasRecompra> {
    try {
      // 1. Obtener productos con ciclo de recompra definido
      const productosSnapshot = await getDocs(collection(db, 'productos'));
      const productosConCiclo = new Map<string, { ciclo: number; nombre: string; sku: string }>();

      productosSnapshot.docs.forEach(doc => {
        const data = doc.data() as Producto;
        if (data.cicloRecompraDias && data.cicloRecompraDias > 0) {
          productosConCiclo.set(doc.id, {
            ciclo: data.cicloRecompraDias,
            nombre: `${data.marca} ${data.nombreComercial}`,
            sku: data.sku
          });
        }
      });

      if (productosConCiclo.size === 0) {
        return {
          alertasUrgentes: [],
          alertasProximas: [],
          alertasFuturas: [],
          totalAlertas: 0,
          clientesAfectados: 0,
          productosAfectados: 0
        };
      }

      // 2. Obtener ventas completadas (entregadas) de los últimos 6 meses
      const hace6Meses = new Date();
      hace6Meses.setMonth(hace6Meses.getMonth() - 6);

      const ventasQuery = query(
        collection(db, 'ventas'),
        where('estado', 'in', ['entregada', 'entrega_parcial'])
      );

      const ventasSnapshot = await getDocs(ventasQuery);

      // 3. Obtener clientes activos
      const clientesSnapshot = await getDocs(collection(db, 'clientes'));
      const clientesMap = new Map<string, { nombre: string; telefono?: string }>();

      clientesSnapshot.docs.forEach(doc => {
        const data = doc.data() as Cliente;
        if (data.estado === 'activo') {
          clientesMap.set(doc.id, {
            nombre: data.nombre,
            telefono: data.telefono
          });
        }
      });

      // 4. Procesar ventas y generar alertas
      const ahora = new Date();
      const alertas: AlertaRecompra[] = [];

      // Mapa para rastrear última compra de cada cliente-producto
      const ultimasCompras = new Map<string, {
        fecha: Date;
        ventaId: string;
        cantidad: number;
      }>();

      ventasSnapshot.docs.forEach(doc => {
        const venta = { id: doc.id, ...doc.data() } as Venta;

        // Verificar que el cliente existe y está activo
        if (!venta.clienteId || !clientesMap.has(venta.clienteId)) {
          return;
        }

        // Obtener fecha de entrega o fecha de la venta
        let fechaCompra: Date;
        if (venta.fechaEntrega) {
          fechaCompra = venta.fechaEntrega.toDate?.() || new Date(venta.fechaEntrega as unknown as string);
        } else if (venta.fechaCreacion) {
          fechaCompra = venta.fechaCreacion.toDate?.() || new Date(venta.fechaCreacion as unknown as string);
        } else {
          return;
        }

        // Solo considerar ventas de los últimos 6 meses
        if (fechaCompra < hace6Meses) {
          return;
        }

        // Procesar cada producto de la venta
        venta.productos?.forEach((producto: ProductoVenta) => {
          if (!productosConCiclo.has(producto.productoId)) {
            return; // Este producto no tiene ciclo de recompra definido
          }

          const key = `${venta.clienteId}-${producto.productoId}`;
          const compraExistente = ultimasCompras.get(key);

          // Guardar solo la compra más reciente
          if (!compraExistente || fechaCompra > compraExistente.fecha) {
            ultimasCompras.set(key, {
              fecha: fechaCompra,
              ventaId: doc.id,
              cantidad: producto.cantidad
            });
          }
        });
      });

      // 5. Generar alertas basadas en las últimas compras
      ultimasCompras.forEach((compra, key) => {
        const [clienteId, productoId] = key.split('-');
        const cliente = clientesMap.get(clienteId);
        const producto = productosConCiclo.get(productoId);

        if (!cliente || !producto) return;

        const diasDesdeCompra = Math.floor(
          (ahora.getTime() - compra.fecha.getTime()) / (1000 * 60 * 60 * 24)
        );
        const diasRestantes = producto.ciclo - diasDesdeCompra;
        const porcentajeCiclo = Math.round((diasDesdeCompra / producto.ciclo) * 100);

        // Solo generar alerta si estamos dentro de 30 días del ciclo o ya pasó
        if (diasRestantes <= 30) {
          let prioridad: 'alta' | 'media' | 'baja';
          if (diasRestantes <= 0) {
            prioridad = 'alta';      // Ya pasó el ciclo
          } else if (diasRestantes <= 7) {
            prioridad = 'media';     // Próximos 7 días
          } else {
            prioridad = 'baja';      // 8-30 días
          }

          alertas.push({
            id: `recompra-${clienteId}-${productoId}`,
            clienteId,
            clienteNombre: cliente.nombre,
            clienteTelefono: cliente.telefono,
            productoId,
            productoNombre: producto.nombre,
            productoSKU: producto.sku,
            fechaUltimaCompra: compra.fecha,
            diasDesdeCompra,
            cicloRecompraDias: producto.ciclo,
            diasRestantes,
            porcentajeCiclo,
            prioridad,
            ventaId: compra.ventaId,
            cantidadComprada: compra.cantidad
          });
        }
      });

      // 6. Ordenar y clasificar alertas
      alertas.sort((a, b) => a.diasRestantes - b.diasRestantes);

      const alertasUrgentes = alertas.filter(a => a.prioridad === 'alta');
      const alertasProximas = alertas.filter(a => a.prioridad === 'media');
      const alertasFuturas = alertas.filter(a => a.prioridad === 'baja');

      // Contar clientes y productos únicos
      const clientesUnicos = new Set(alertas.map(a => a.clienteId));
      const productosUnicos = new Set(alertas.map(a => a.productoId));

      return {
        alertasUrgentes,
        alertasProximas,
        alertasFuturas,
        totalAlertas: alertas.length,
        clientesAfectados: clientesUnicos.size,
        productosAfectados: productosUnicos.size
      };
    } catch (error: any) {
      console.error('Error obteniendo alertas de recompra:', error);
      return {
        alertasUrgentes: [],
        alertasProximas: [],
        alertasFuturas: [],
        totalAlertas: 0,
        clientesAfectados: 0,
        productosAfectados: 0
      };
    }
  },

  /**
   * Obtiene alertas de recompra para un cliente específico
   */
  async getAlertasPorCliente(clienteId: string): Promise<AlertaRecompra[]> {
    const resumen = await this.getAlertasRecompra();
    return [
      ...resumen.alertasUrgentes,
      ...resumen.alertasProximas,
      ...resumen.alertasFuturas
    ].filter(a => a.clienteId === clienteId);
  },

  /**
   * Obtiene alertas de recompra para un producto específico
   */
  async getAlertasPorProducto(productoId: string): Promise<AlertaRecompra[]> {
    const resumen = await this.getAlertasRecompra();
    return [
      ...resumen.alertasUrgentes,
      ...resumen.alertasProximas,
      ...resumen.alertasFuturas
    ].filter(a => a.productoId === productoId);
  },

  /**
   * Genera el mensaje de WhatsApp para una alerta de recompra
   */
  generarMensajeWhatsApp(alerta: AlertaRecompra): string {
    const diasTexto = alerta.diasRestantes <= 0
      ? `hace ${Math.abs(alerta.diasRestantes)} días`
      : `en ${alerta.diasRestantes} días`;

    return encodeURIComponent(
      `¡Hola! 👋\n\n` +
      `Te escribimos de Vita Skin Peru. Notamos que compraste ${alerta.productoNombre} ` +
      `hace ${alerta.diasDesdeCompra} días.\n\n` +
      `Basado en el consumo promedio, estimamos que podrías necesitar reponerlo ${diasTexto}.\n\n` +
      `¿Te gustaría que te preparemos un pedido? 🛒\n\n` +
      `¡Estamos para ayudarte!`
    );
  },

  /**
   * Genera URL de WhatsApp para contactar al cliente
   */
  getWhatsAppUrl(alerta: AlertaRecompra): string | null {
    if (!alerta.clienteTelefono) return null;

    const telefono = alerta.clienteTelefono.replace(/\D/g, '');
    const mensaje = this.generarMensajeWhatsApp(alerta);

    return `https://wa.me/51${telefono}?text=${mensaje}`;
  }
};

export const RecompraService = recompraService;
