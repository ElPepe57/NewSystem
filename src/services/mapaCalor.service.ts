import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type { VentaGeo, ZonaResumen, FiltrosMapaCalor, MapaCalorKPIData, Coordenadas } from '../types/mapaCalor.types';

/**
 * Servicio de GeoAnalytics — consulta ventas con coordenadas
 * y calcula métricas por zona geográfica.
 */
export const mapaCalorService = {

  /**
   * Obtener ventas con coordenadas para el mapa
   * Solo trae los campos necesarios para minimizar lecturas
   */
  async getVentasGeo(filtros: FiltrosMapaCalor): Promise<VentaGeo[]> {
    const constraints: any[] = [];

    // Filtro por fecha
    constraints.push(where('fechaCreacion', '>=', Timestamp.fromDate(filtros.fechaInicio)));
    constraints.push(where('fechaCreacion', '<=', Timestamp.fromDate(filtros.fechaFin)));

    const q = query(collection(db, COLLECTIONS.VENTAS), ...constraints);
    const snapshot = await getDocs(q);

    const ventas: VentaGeo[] = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data();

      // Solo ventas con coordenadas válidas
      if (!data.coordenadas?.lat || !data.coordenadas?.lng) return;

      // Filtro por línea (client-side porque Firestore no soporta != null + filtro compuesto fácilmente)
      if (filtros.lineaNegocioId && data.lineaNegocioId !== filtros.lineaNegocioId) return;

      // Filtro por distritos
      if (filtros.distritos.length > 0 && data.distrito && !filtros.distritos.includes(data.distrito)) return;

      // Solo ventas no canceladas
      if (data.estado === 'cancelada') return;

      ventas.push({
        id: doc.id,
        codigo: data.codigo || data.sku || doc.id,
        coordenadas: { lat: data.coordenadas.lat, lng: data.coordenadas.lng },
        totalPEN: data.totalPEN || 0,
        lineaNegocioId: data.lineaNegocioId || '',
        distrito: data.distrito,
        provincia: data.provincia,
        clienteId: data.clienteId,
        clienteNombre: data.clienteNombre || data.clienteSnapshot?.nombre,
        productos: (data.productos || []).map((p: any) => ({
          nombre: p.nombreComercial || p.nombre || 'Sin nombre',
          cantidad: p.cantidad || 1
        })),
        fechaCreacion: data.fechaCreacion
      });
    });

    return ventas;
  },

  /**
   * Calcular resumen por zona (distrito + provincia)
   */
  calcularZonas(ventas: VentaGeo[]): ZonaResumen[] {
    const zonaMap = new Map<string, {
      distrito: string;
      provincia: string;
      ventas: VentaGeo[];
      clienteIds: Set<string>;
      productoConteo: Map<string, number>;
      lineaConteo: Map<string, number>;
      coords: Coordenadas[];
    }>();

    for (const venta of ventas) {
      const distrito = venta.distrito || 'Sin distrito';
      const provincia = venta.provincia || 'Sin provincia';
      const key = `${distrito}---${provincia}`;

      if (!zonaMap.has(key)) {
        zonaMap.set(key, {
          distrito, provincia,
          ventas: [],
          clienteIds: new Set(),
          productoConteo: new Map(),
          lineaConteo: new Map(),
          coords: []
        });
      }

      const zona = zonaMap.get(key)!;
      zona.ventas.push(venta);
      zona.coords.push(venta.coordenadas);

      if (venta.clienteId) zona.clienteIds.add(venta.clienteId);

      // Contar productos
      for (const prod of venta.productos) {
        const actual = zona.productoConteo.get(prod.nombre) || 0;
        zona.productoConteo.set(prod.nombre, actual + prod.cantidad);
      }

      // Contar por línea
      const lineaActual = zona.lineaConteo.get(venta.lineaNegocioId) || 0;
      zona.lineaConteo.set(venta.lineaNegocioId, lineaActual + 1);
    }

    const zonas: ZonaResumen[] = [];

    for (const [key, data] of zonaMap) {
      const volumenPEN = data.ventas.reduce((s, v) => s + v.totalPEN, 0);
      const totalVentas = data.ventas.length;

      // Top 5 productos
      const productosTop = [...data.productoConteo.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([nombre, cantidad]) => ({ nombre, cantidad }));

      // Distribución por línea
      const totalLinea = [...data.lineaConteo.values()].reduce((s, v) => s + v, 0);
      const distribucionLinea = [...data.lineaConteo.entries()].map(([lineaNegocioId, count]) => ({
        lineaNegocioId,
        porcentaje: totalLinea > 0 ? Math.round((count / totalLinea) * 100) : 0
      }));

      // Centro geográfico promedio
      const coordenadasCentro: Coordenadas = {
        lat: data.coords.reduce((s, c) => s + c.lat, 0) / data.coords.length,
        lng: data.coords.reduce((s, c) => s + c.lng, 0) / data.coords.length
      };

      zonas.push({
        key,
        distrito: data.distrito,
        provincia: data.provincia,
        totalVentas,
        volumenPEN,
        ticketPromedio: totalVentas > 0 ? volumenPEN / totalVentas : 0,
        clientesUnicos: data.clienteIds.size,
        productosTop,
        distribucionLinea,
        coordenadasCentro
      });
    }

    return zonas.sort((a, b) => b.volumenPEN - a.volumenPEN);
  },

  /**
   * Calcular KPIs del dashboard
   */
  calcularKPIs(ventas: VentaGeo[], totalVentasSistema: number): MapaCalorKPIData {
    const distritos = new Set(ventas.map(v => v.distrito).filter(Boolean));
    const provincias = new Set(ventas.map(v => v.provincia).filter(Boolean));
    const volumenTotal = ventas.reduce((s, v) => s + v.totalPEN, 0);

    // Zona top
    const zonas = this.calcularZonas(ventas);
    const zonaTop = zonas.length > 0 ? zonas[0] : null;

    return {
      zonasActivas: distritos.size,
      provinciasActivas: provincias.size,
      volumenTotalPEN: volumenTotal,
      ticketPromedio: ventas.length > 0 ? volumenTotal / ventas.length : 0,
      zonaTopVolumen: zonaTop ? {
        distrito: zonaTop.distrito,
        provincia: zonaTop.provincia,
        volumen: zonaTop.volumenPEN
      } : null,
      ventasGeolocalizadas: ventas.length,
      ventasTotales: totalVentasSistema,
      porcentajeCobertura: totalVentasSistema > 0
        ? Math.round((ventas.length / totalVentasSistema) * 100)
        : 0
    };
  }
};
