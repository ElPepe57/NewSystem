import React, { useMemo, useState } from 'react';
import { calcularDiasParaVencer } from '../../../utils/dateFormatters';
import { formatCurrency } from '../../../utils/format';
import {
  TrendingUp,
  TrendingDown,
  RotateCw,
  Clock,
  Package,
  DollarSign,
  AlertTriangle,
  BarChart3,
  PieChart,
  Target,
  Layers,
  Calendar,
  Filter,
  Download,
  Lightbulb,
  Search,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Shield,
  Globe,
  Hourglass,
  Star,
  Zap,
  XCircle,
  Percent,
  Activity
} from 'lucide-react';
import { Card, Badge, StatCard, StatDistribution, Select, Button } from '../../common';
import type { Unidad } from '../../../types/unidad.types';
import type { Producto } from '../../../types/producto.types';
import type { Almacen } from '../../../types/almacen.types';
import type { CTRUProductoDetalle } from '../../../store/ctruStore';
import { exportService } from '../../../services/export.service';

interface InventarioAnalyticsProps {
  unidades: Unidad[];
  productos: Producto[];
  almacenes?: Almacen[];
  ctruData?: CTRUProductoDetalle[];
}

interface ProductoAnalyticData {
  productoId: string;
  sku: string;
  nombre: string;
  marca: string;
  presentacion: string;
  contenido: string;
  dosaje: string;
  sabor: string;
  cantidadTotal: number;
  valorTotal: number;
  diasEnInventario: number;
  rotacion: number;
  clasificacionABC: 'A' | 'B' | 'C';
  porcentajeValor: number;
  diasParaVencer: number | null;
  stockCritico: boolean;
  diasHastaAgotar: number | null;
  fechaEstimadaAgotamiento: Date | null;
  ventasDiarias: number;
  requiereReorden: boolean;
}

// Helper: referencia de presentación del producto
const getProductoRef = (p: ProductoAnalyticData): string => {
  return [p.presentacion, p.contenido, p.dosaje, p.sabor].filter(Boolean).join(' · ');
};

// Helper para calcular días desde una fecha
const calcularDiasDesde = (fecha: any): number => {
  if (!fecha || !fecha.toDate) return 0;
  const hoy = new Date();
  const fechaDate = fecha.toDate();
  const diffTime = Math.abs(hoy.getTime() - fechaDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};


// Sort types for tabla completa
type TablaSort = 'sku' | 'nombre' | 'cantidad' | 'valor' | 'clase' | 'rotacion' | 'dias' | 'ctru' | 'margen' | 'precioVenta' | 'roi';

export const InventarioAnalytics: React.FC<InventarioAnalyticsProps> = ({
  unidades,
  productos,
  almacenes = [],
  ctruData = []
}) => {
  const [filtroPais, setFiltroPais] = useState<string>('');
  const [filtroAlmacen, setFiltroAlmacen] = useState<string>('');
  const [filtroClaseABC, setFiltroClaseABC] = useState<'A' | 'B' | 'C' | ''>('');
  const [busquedaTabla, setBusquedaTabla] = useState('');
  const [tablaSort, setTablaSort] = useState<{ key: TablaSort; dir: 'asc' | 'desc' } | null>(null);

  // Filtrar unidades activas
  const unidadesActivas = useMemo(() => {
    let resultado = unidades.filter(u => u.estado !== 'vendida');
    if (filtroPais) resultado = resultado.filter(u => u.pais === filtroPais);
    if (filtroAlmacen) resultado = resultado.filter(u => u.almacenId === filtroAlmacen);
    return resultado;
  }, [unidades, filtroPais, filtroAlmacen]);

  const almacenesFiltrados = useMemo(() => {
    if (!filtroPais) return almacenes;
    return almacenes.filter(a => a.pais === filtroPais);
  }, [almacenes, filtroPais]);

  // Análisis por producto
  const productosAnalytics = useMemo((): ProductoAnalyticData[] => {
    const grupos: Record<string, {
      productoId: string;
      sku: string;
      nombre: string;
      marca: string;
      presentacion: string;
      contenido: string;
      dosaje: string;
      sabor: string;
      unidades: Unidad[];
      cantidadTotal: number;
      valorTotal: number;
      fechasMasAntiguas: Date[];
      fechasVencimiento: number[];
    }> = {};

    unidadesActivas.forEach(u => {
      if (!grupos[u.productoId]) {
        const producto = productos.find(p => p.id === u.productoId);
        grupos[u.productoId] = {
          productoId: u.productoId,
          sku: u.productoSKU,
          nombre: u.productoNombre,
          marca: producto?.marca || '',
          presentacion: producto?.presentacion || '',
          contenido: producto?.contenido || '',
          dosaje: producto?.dosaje || '',
          sabor: producto?.sabor || '',
          unidades: [],
          cantidadTotal: 0,
          valorTotal: 0,
          fechasMasAntiguas: [],
          fechasVencimiento: []
        };
      }

      grupos[u.productoId].unidades.push(u);
      grupos[u.productoId].cantidadTotal++;
      grupos[u.productoId].valorTotal += u.costoUnitarioUSD;

      if (u.fechaCreacion?.toDate) {
        grupos[u.productoId].fechasMasAntiguas.push(u.fechaCreacion.toDate());
      }

      const diasVenc = calcularDiasParaVencer(u.fechaVencimiento);
      if (diasVenc !== null) {
        grupos[u.productoId].fechasVencimiento.push(diasVenc);
      }
    });

    const valorTotalInventario = Object.values(grupos).reduce((sum, g) => sum + g.valorTotal, 0);

    let result: ProductoAnalyticData[] = Object.values(grupos).map(g => {
      const diasPromedio = g.fechasMasAntiguas.length > 0
        ? g.fechasMasAntiguas.reduce((sum, fecha) => {
            const diffTime = Math.abs(new Date().getTime() - fecha.getTime());
            return sum + Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }, 0) / g.fechasMasAntiguas.length
        : 0;

      const diasParaVencerMin = g.fechasVencimiento.length > 0
        ? Math.min(...g.fechasVencimiento)
        : null;

      const producto = productos.find(p => p.id === g.productoId);
      const stockMinimo = producto?.stockMinimo ?? 0;

      return {
        productoId: g.productoId,
        sku: g.sku,
        nombre: g.nombre,
        marca: g.marca,
        presentacion: g.presentacion,
        contenido: g.contenido,
        dosaje: g.dosaje,
        sabor: g.sabor,
        cantidadTotal: g.cantidadTotal,
        valorTotal: g.valorTotal,
        diasEnInventario: Math.round(diasPromedio),
        rotacion: diasPromedio > 0 ? 365 / diasPromedio : 0,
        clasificacionABC: 'C' as 'A' | 'B' | 'C',
        porcentajeValor: valorTotalInventario > 0 ? (g.valorTotal / valorTotalInventario) * 100 : 0,
        diasParaVencer: diasParaVencerMin,
        stockCritico: g.cantidadTotal <= stockMinimo,
        diasHastaAgotar: null,
        fechaEstimadaAgotamiento: null,
        ventasDiarias: 0,
        requiereReorden: false
      };
    });

    result.sort((a, b) => b.valorTotal - a.valorTotal);

    let acumulado = 0;
    const LEAD_TIME_DIAS = 30;

    result = result.map(p => {
      acumulado += p.porcentajeValor;
      const ventasDiarias = p.rotacion > 0 ? (p.cantidadTotal * p.rotacion) / 365 : 0;
      const diasHastaAgotar = ventasDiarias > 0 ? Math.round(p.cantidadTotal / ventasDiarias) : null;

      let fechaEstimadaAgotamiento: Date | null = null;
      if (diasHastaAgotar !== null) {
        fechaEstimadaAgotamiento = new Date();
        fechaEstimadaAgotamiento.setDate(fechaEstimadaAgotamiento.getDate() + diasHastaAgotar);
      }

      const requiereReorden = diasHastaAgotar !== null && diasHastaAgotar <= LEAD_TIME_DIAS;

      return {
        ...p,
        clasificacionABC: acumulado <= 80 ? 'A' : acumulado <= 95 ? 'B' : 'C',
        diasHastaAgotar,
        fechaEstimadaAgotamiento,
        ventasDiarias,
        requiereReorden
      };
    });

    return result;
  }, [unidadesActivas, productos]);

  // KPIs
  const kpis = useMemo(() => {
    const valorTotalUSD = unidadesActivas.reduce((sum, u) => sum + u.costoUnitarioUSD, 0);
    const totalUnidades = unidadesActivas.length;
    const totalProductos = productosAnalytics.length;

    const diasPromedioInventario = productosAnalytics.length > 0
      ? productosAnalytics.reduce((sum, p) => sum + p.diasEnInventario, 0) / productosAnalytics.length
      : 0;

    const rotacionPromedio = productosAnalytics.length > 0
      ? productosAnalytics.reduce((sum, p) => sum + p.rotacion, 0) / productosAnalytics.length
      : 0;

    const porVencer30 = unidadesActivas.filter(u => {
      const dias = calcularDiasParaVencer(u.fechaVencimiento);
      return dias !== null && dias >= 0 && dias <= 30;
    }).length;

    const productosStockCritico = productosAnalytics.filter(p => p.stockCritico).length;

    const countA = productosAnalytics.filter(p => p.clasificacionABC === 'A').length;
    const countB = productosAnalytics.filter(p => p.clasificacionABC === 'B').length;
    const countC = productosAnalytics.filter(p => p.clasificacionABC === 'C').length;

    const valorA = productosAnalytics.filter(p => p.clasificacionABC === 'A').reduce((s, p) => s + p.valorTotal, 0);
    const valorB = productosAnalytics.filter(p => p.clasificacionABC === 'B').reduce((s, p) => s + p.valorTotal, 0);
    const valorC = productosAnalytics.filter(p => p.clasificacionABC === 'C').reduce((s, p) => s + p.valorTotal, 0);

    const sinMovimiento = productosAnalytics.filter(p => p.diasEnInventario > 90).length;
    const valorPromedioUnidad = totalUnidades > 0 ? valorTotalUSD / totalUnidades : 0;

    // Métricas avanzadas
    const capitalOcioso = productosAnalytics.filter(p => p.rotacion < 1).reduce((s, p) => s + p.valorTotal, 0);
    const indiceServicio = totalProductos > 0
      ? ((totalProductos - productosStockCritico) / totalProductos * 100)
      : 100;
    const coberturaStock = rotacionPromedio > 0 ? Math.round(365 / rotacionPromedio) : 0;

    return {
      valorTotalUSD, totalUnidades, totalProductos, diasPromedioInventario: Math.round(diasPromedioInventario),
      rotacionPromedio: rotacionPromedio.toFixed(1), porVencer30, productosStockCritico,
      countA, countB, countC, valorA, valorB, valorC, sinMovimiento, valorPromedioUnidad,
      capitalOcioso, indiceServicio, coberturaStock
    };
  }, [unidadesActivas, productosAnalytics]);

  // ==================== RENTABILIDAD (CTRU DATA) ====================
  const rentabilidadData = useMemo(() => {
    if (!ctruData?.length) return null;
    const ctruMap = new Map(ctruData.map(c => [c.productoId, c]));

    // Cruzar productos del inventario con CTRU data
    const productosConFinanzas = productosAnalytics.map(p => {
      const ctru = ctruMap.get(p.productoId);
      return { ...p, ctru: ctru || null };
    });

    // Aggregados globales (ponderados por unidades vendidas)
    let totalRevenue = 0, totalCostoInversion = 0, totalCostoReal = 0;
    let totalUdsVendidas = 0;

    for (const c of ctruData) {
      if (c.ventasCount > 0 && c.precioVentaProm > 0) {
        totalRevenue += c.precioVentaProm * c.unidadesVendidas;
        totalCostoInversion += c.costoInventarioProm * c.unidadesVendidas;
        totalCostoReal += c.costoTotalRealProm * c.unidadesVendidas;
        totalUdsVendidas += c.unidadesVendidas;
      }
    }

    const utilidadBrutaTotal = totalRevenue - totalCostoInversion;
    const utilidadNetaTotal = totalRevenue - totalCostoReal;
    const roiGlobal = totalCostoInversion > 0 ? (utilidadNetaTotal / totalCostoInversion) * 100 : 0;
    const margenBrutoGlobal = totalRevenue > 0 ? (utilidadBrutaTotal / totalRevenue) * 100 : 0;
    const margenNetoGlobal = totalRevenue > 0 ? (utilidadNetaTotal / totalRevenue) * 100 : 0;

    // Valor de mercado del inventario activo
    let valorMercadoPotencial = 0;
    let costoInversionPotencial = 0;
    for (const p of productosConFinanzas) {
      if (p.ctru && p.ctru.precioVentaProm > 0) {
        valorMercadoPotencial += p.ctru.precioVentaProm * p.cantidadTotal;
        costoInversionPotencial += p.ctru.costoInventarioProm * p.cantidadTotal;
      }
    }
    const utilidadPotencial = valorMercadoPotencial - costoInversionPotencial;

    // Composición de costos promedio (ponderado)
    const ctruConVentas = ctruData.filter(c => c.costoTotalRealProm > 0);
    const totalCtruCount = ctruConVentas.length || 1;
    const pctCompra = ctruConVentas.reduce((s, c) => s + c.pctCompra, 0) / totalCtruCount;
    const pctImpuesto = ctruConVentas.reduce((s, c) => s + c.pctImpuesto, 0) / totalCtruCount;
    const pctEnvio = ctruConVentas.reduce((s, c) => s + c.pctEnvio, 0) / totalCtruCount;
    const pctOtros = ctruConVentas.reduce((s, c) => s + c.pctOtros, 0) / totalCtruCount;
    const pctFleteIntl = ctruConVentas.reduce((s, c) => s + c.pctFleteIntl, 0) / totalCtruCount;
    const pctGAGO = ctruConVentas.reduce((s, c) => s + c.pctGAGO, 0) / totalCtruCount;
    const pctGVGD = ctruConVentas.reduce((s, c) => s + c.pctGVGD, 0) / totalCtruCount;

    // Ranking de ROI por producto (solo con ventas)
    const productosConROI = productosConFinanzas
      .filter(p => p.ctru && p.ctru.ventasCount > 0 && p.ctru.costoInventarioProm > 0)
      .map(p => ({
        ...p,
        roi: ((p.ctru!.precioVentaProm - p.ctru!.costoTotalRealProm) / p.ctru!.costoInventarioProm) * 100,
        utilidadUnitaria: p.ctru!.precioVentaProm - p.ctru!.costoTotalRealProm
      }))
      .sort((a, b) => b.roi - a.roi);

    // Matriz Estratégica (margen × rotación)
    const productosConMargenYRotacion = productosConFinanzas.filter(p => p.ctru && p.ctru.ventasCount > 0);
    const medianMargen = (() => {
      const m = productosConMargenYRotacion.map(p => p.ctru!.margenBrutoProm).sort((a, b) => a - b);
      return m.length > 0 ? m[Math.floor(m.length / 2)] : 15;
    })();
    const medianRotacion = (() => {
      const r = productosConMargenYRotacion.map(p => p.rotacion).sort((a, b) => a - b);
      return r.length > 0 ? r[Math.floor(r.length / 2)] : 10;
    })();

    const matrizEstrategica = {
      estrellas: productosConMargenYRotacion.filter(p => p.ctru!.margenBrutoProm >= medianMargen && p.rotacion >= medianRotacion),
      vacasLecheras: productosConMargenYRotacion.filter(p => p.ctru!.margenBrutoProm >= medianMargen && p.rotacion < medianRotacion),
      volumen: productosConMargenYRotacion.filter(p => p.ctru!.margenBrutoProm < medianMargen && p.rotacion >= medianRotacion),
      revisar: productosConMargenYRotacion.filter(p => p.ctru!.margenBrutoProm < medianMargen && p.rotacion < medianRotacion),
      medianMargen,
      medianRotacion
    };

    return {
      productosConFinanzas, productosConROI, ctruMap,
      utilidadBrutaTotal, utilidadNetaTotal,
      roiGlobal, margenBrutoGlobal, margenNetoGlobal, totalRevenue, totalUdsVendidas,
      valorMercadoPotencial, utilidadPotencial, costoInversionPotencial,
      pctCompra, pctImpuesto, pctEnvio, pctOtros, pctFleteIntl, pctGAGO, pctGVGD,
      matrizEstrategica
    };
  }, [productosAnalytics, ctruData]);

  // formatCurrency importado de utils/format (USD por defecto)

  const formatPEN = (amount: number): string => `S/ ${amount.toFixed(2)}`;

  // Listas derivadas
  const topProductosValor = useMemo(() =>
    [...productosAnalytics].sort((a, b) => b.valorTotal - a.valorTotal).slice(0, 5),
    [productosAnalytics]
  );

  const productosSinMovimiento = useMemo(() =>
    productosAnalytics.filter(p => p.diasEnInventario > 90).sort((a, b) => b.diasEnInventario - a.diasEnInventario).slice(0, 5),
    [productosAnalytics]
  );

  const productosProximosVencer = useMemo(() =>
    productosAnalytics
      .filter(p => p.diasParaVencer !== null && p.diasParaVencer <= 60 && p.diasParaVencer >= 0)
      .sort((a, b) => (a.diasParaVencer || 0) - (b.diasParaVencer || 0))
      .slice(0, 5),
    [productosAnalytics]
  );

  const productosReorden = useMemo(() =>
    productosAnalytics
      .filter(p => p.requiereReorden && p.diasHastaAgotar !== null)
      .sort((a, b) => (a.diasHastaAgotar || 0) - (b.diasHastaAgotar || 0))
      .slice(0, 8),
    [productosAnalytics]
  );

  // Concentración por marca
  const concentracionMarca = useMemo(() => {
    const marcas: Record<string, { marca: string; productos: number; unidades: number; valor: number }> = {};
    const valorTotal = productosAnalytics.reduce((s, p) => s + p.valorTotal, 0);

    productosAnalytics.forEach(p => {
      const m = p.marca || 'Sin Marca';
      if (!marcas[m]) marcas[m] = { marca: m, productos: 0, unidades: 0, valor: 0 };
      marcas[m].productos++;
      marcas[m].unidades += p.cantidadTotal;
      marcas[m].valor += p.valorTotal;
    });

    return Object.values(marcas)
      .map(m => ({ ...m, porcentaje: valorTotal > 0 ? (m.valor / valorTotal) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);
  }, [productosAnalytics]);

  // Distribución de antigüedad
  const distribucionAntiguedad = useMemo(() => {
    const buckets = [
      { label: '0-15 días', min: 0, max: 15, count: 0, valor: 0, color: 'bg-green-500', textColor: 'text-green-700', tag: 'Fresco' },
      { label: '16-30 días', min: 16, max: 30, count: 0, valor: 0, color: 'bg-emerald-400', textColor: 'text-emerald-700', tag: 'Normal' },
      { label: '31-60 días', min: 31, max: 60, count: 0, valor: 0, color: 'bg-amber-400', textColor: 'text-amber-700', tag: 'Atención' },
      { label: '61-90 días', min: 61, max: 90, count: 0, valor: 0, color: 'bg-orange-500', textColor: 'text-orange-700', tag: 'Estancado' },
      { label: '>90 días', min: 91, max: 99999, count: 0, valor: 0, color: 'bg-red-500', textColor: 'text-red-700', tag: 'Problema' }
    ];

    unidadesActivas.forEach(u => {
      const dias = calcularDiasDesde(u.fechaCreacion);
      const bucket = buckets.find(b => dias >= b.min && dias <= b.max);
      if (bucket) {
        bucket.count++;
        bucket.valor += u.costoUnitarioUSD;
      }
    });

    const maxCount = Math.max(...buckets.map(b => b.count), 1);
    return buckets.map(b => ({ ...b, widthPercent: (b.count / maxCount) * 100 }));
  }, [unidadesActivas]);

  // Eficiencia por país
  const eficienciaPais = useMemo(() => {
    const paisData: Record<string, { valor: number; unidades: number; productos: Set<string>; diasTotal: number }> = {
      USA: { valor: 0, unidades: 0, productos: new Set(), diasTotal: 0 },
      Peru: { valor: 0, unidades: 0, productos: new Set(), diasTotal: 0 }
    };

    unidadesActivas.forEach(u => {
      const pais = u.pais === 'USA' ? 'USA' : 'Peru';
      paisData[pais].valor += u.costoUnitarioUSD;
      paisData[pais].unidades++;
      paisData[pais].productos.add(u.productoId);
      paisData[pais].diasTotal += calcularDiasDesde(u.fechaCreacion);
    });

    return Object.entries(paisData).map(([pais, d]) => ({
      pais,
      valor: d.valor,
      unidades: d.unidades,
      productos: d.productos.size,
      diasPromedio: d.unidades > 0 ? Math.round(d.diasTotal / d.unidades) : 0,
      rotacion: d.unidades > 0 && d.diasTotal > 0 ? parseFloat((365 / (d.diasTotal / d.unidades)).toFixed(1)) : 0
    }));
  }, [unidadesActivas]);

  // Costo de oportunidad
  const costoOportunidad = useMemo(() => {
    const productosSinMov = productosAnalytics.filter(p => p.diasEnInventario > 90);
    const capitalInmovilizado = productosSinMov.reduce((sum, p) => sum + p.valorTotal, 0);
    const recuperacionCon30Descuento = capitalInmovilizado * 0.70;
    const potencialReinversion = recuperacionCon30Descuento * 1.25;

    return {
      totalProductos: productosSinMov.length,
      capitalInmovilizado,
      recuperacionCon30Descuento,
      potencialReinversion,
      gananciaOportunidad: potencialReinversion - recuperacionCon30Descuento
    };
  }, [productosAnalytics]);

  // Pareto Estratégico: cruza ABC por Capital vs ABC por Utilidad
  const paretoEstrategico = useMemo(() => {
    if (!ctruData?.length) return null;
    const ctruMap = new Map(ctruData.map(c => [c.productoId, c]));

    // Calcular utilidad potencial por producto (activos en inventario)
    const productosConUtilidad = productosAnalytics.map(p => {
      const ctru = ctruMap.get(p.productoId);
      const utilidadUnitaria = ctru && ctru.precioVentaProm > 0
        ? ctru.precioVentaProm - ctru.costoTotalRealProm
        : 0;
      const utilidadTotal = utilidadUnitaria * p.cantidadTotal;
      const roi = ctru && ctru.costoInventarioProm > 0 && ctru.ventasCount > 0
        ? ((ctru.precioVentaProm - ctru.costoTotalRealProm) / ctru.costoInventarioProm) * 100
        : 0;
      return { ...p, ctru, utilidadUnitaria, utilidadTotal, roi, tieneVentas: (ctru?.ventasCount || 0) > 0 };
    });

    // ABC por CAPITAL (actual — ya calculado en clasificacionABC)
    // ABC por UTILIDAD
    const conUtilidad = productosConUtilidad.filter(p => p.tieneVentas);
    const totalUtilidad = conUtilidad.reduce((s, p) => s + Math.max(p.utilidadTotal, 0), 0);

    // Ordenar por utilidad descendente y asignar clase
    const porUtilidad = [...conUtilidad].sort((a, b) => b.utilidadTotal - a.utilidadTotal);
    let acumUtilidad = 0;
    const claseUtilidad = new Map<string, 'A' | 'B' | 'C'>();
    porUtilidad.forEach(p => {
      acumUtilidad += Math.max(p.utilidadTotal, 0);
      const pct = totalUtilidad > 0 ? (acumUtilidad / totalUtilidad) * 100 : 100;
      claseUtilidad.set(p.productoId, pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C');
    });
    // Productos sin ventas = clase C por utilidad
    productosConUtilidad.filter(p => !p.tieneVentas).forEach(p => claseUtilidad.set(p.productoId, 'C'));

    // Detectar desajustes estratégicos
    const trampasCapital: typeof productosConUtilidad = []; // A por capital, C por utilidad
    const joyasOcultas: typeof productosConUtilidad = []; // C por capital, A por utilidad
    const eficientes: typeof productosConUtilidad = []; // A por capital, A por utilidad
    const sobreInvertidos: typeof productosConUtilidad = []; // A/B por capital, pero bajo ROI
    const sinDatos: typeof productosConUtilidad = []; // Sin ventas para evaluar

    productosConUtilidad.forEach(p => {
      const claseCapital = p.clasificacionABC;
      const claseUtil = claseUtilidad.get(p.productoId) || 'C';

      if (!p.tieneVentas) {
        sinDatos.push(p);
      } else if (claseCapital === 'A' && claseUtil === 'A') {
        eficientes.push(p);
      } else if (claseCapital === 'A' && (claseUtil === 'B' || claseUtil === 'C')) {
        trampasCapital.push(p);
      } else if ((claseCapital === 'B' || claseCapital === 'C') && claseUtil === 'A') {
        joyasOcultas.push(p);
      } else if ((claseCapital === 'A' || claseCapital === 'B') && p.roi < 10) {
        sobreInvertidos.push(p);
      }
    });

    // Totales por clase de utilidad
    const utilA = porUtilidad.filter(p => claseUtilidad.get(p.productoId) === 'A');
    const utilB = porUtilidad.filter(p => claseUtilidad.get(p.productoId) === 'B');
    const utilC = porUtilidad.filter(p => claseUtilidad.get(p.productoId) === 'C');
    const valorUtilA = utilA.reduce((s, p) => s + p.utilidadTotal, 0);
    const valorUtilB = utilB.reduce((s, p) => s + p.utilidadTotal, 0);
    const valorUtilC = utilC.reduce((s, p) => s + p.utilidadTotal, 0);

    return {
      productosConUtilidad, claseUtilidad, totalUtilidad,
      utilA: utilA.length, utilB: utilB.length, utilC: utilC.length,
      valorUtilA, valorUtilB, valorUtilC,
      trampasCapital: trampasCapital.sort((a, b) => b.valorTotal - a.valorTotal),
      joyasOcultas: joyasOcultas.sort((a, b) => b.utilidadTotal - a.utilidadTotal),
      eficientes: eficientes.sort((a, b) => b.utilidadTotal - a.utilidadTotal),
      sobreInvertidos: sobreInvertidos.sort((a, b) => a.roi - b.roi),
      sinDatos
    };
  }, [productosAnalytics, ctruData]);

  // Tabla completa filtrada y ordenada
  const tablaProductos = useMemo(() => {
    let resultado = [...productosAnalytics];

    if (filtroClaseABC) resultado = resultado.filter(p => p.clasificacionABC === filtroClaseABC);

    if (busquedaTabla.trim()) {
      const t = busquedaTabla.toLowerCase();
      resultado = resultado.filter(p =>
        p.sku.toLowerCase().includes(t) || p.nombre.toLowerCase().includes(t) ||
        p.marca.toLowerCase().includes(t) || getProductoRef(p).toLowerCase().includes(t)
      );
    }

    if (tablaSort) {
      const ctruMap = rentabilidadData?.ctruMap;
      resultado.sort((a, b) => {
        let av: number | string = 0, bv: number | string = 0;
        switch (tablaSort.key) {
          case 'sku': av = a.sku; bv = b.sku; break;
          case 'nombre': av = a.nombre; bv = b.nombre; break;
          case 'cantidad': av = a.cantidadTotal; bv = b.cantidadTotal; break;
          case 'valor': av = a.valorTotal; bv = b.valorTotal; break;
          case 'clase': av = a.clasificacionABC; bv = b.clasificacionABC; break;
          case 'rotacion': av = a.rotacion; bv = b.rotacion; break;
          case 'dias': av = a.diasEnInventario; bv = b.diasEnInventario; break;
          case 'ctru': av = ctruMap?.get(a.productoId)?.costoInventarioProm || 0; bv = ctruMap?.get(b.productoId)?.costoInventarioProm || 0; break;
          case 'margen': av = ctruMap?.get(a.productoId)?.margenBrutoProm || 0; bv = ctruMap?.get(b.productoId)?.margenBrutoProm || 0; break;
          case 'precioVenta': av = ctruMap?.get(a.productoId)?.precioVentaProm || 0; bv = ctruMap?.get(b.productoId)?.precioVentaProm || 0; break;
          case 'roi': {
            const ac = ctruMap?.get(a.productoId);
            const bc = ctruMap?.get(b.productoId);
            av = ac && ac.costoInventarioProm > 0 ? ((ac.precioVentaProm - ac.costoTotalRealProm) / ac.costoInventarioProm) * 100 : -999;
            bv = bc && bc.costoInventarioProm > 0 ? ((bc.precioVentaProm - bc.costoTotalRealProm) / bc.costoInventarioProm) * 100 : -999;
            break;
          }
        }
        if (av < bv) return tablaSort.dir === 'asc' ? -1 : 1;
        if (av > bv) return tablaSort.dir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return resultado;
  }, [productosAnalytics, filtroClaseABC, busquedaTabla, tablaSort, rentabilidadData]);

  const handleTablaSort = (key: TablaSort) => {
    setTablaSort(current => {
      if (current?.key === key) {
        if (current.dir === 'asc') return { key, dir: 'desc' };
        return null;
      }
      return { key, dir: 'asc' };
    });
  };

  // Exportar analytics
  const handleExportarAnalytics = () => {
    const ctruMap = rentabilidadData?.ctruMap;
    const clasificacionABC = productosAnalytics.map(p => {
      const ctru = ctruMap?.get(p.productoId);
      const roi = ctru && ctru.costoInventarioProm > 0 ? ((ctru.precioVentaProm - ctru.costoTotalRealProm) / ctru.costoInventarioProm) * 100 : null;
      return {
        'SKU': p.sku,
        'Nombre': p.nombre,
        'Marca': p.marca,
        'Presentación': p.presentacion,
        'Contenido': p.contenido,
        'Dosaje': p.dosaje,
        'Clase': p.clasificacionABC,
        'Cantidad': p.cantidadTotal,
        'Valor USD': p.valorTotal,
        '% del Valor': p.porcentajeValor.toFixed(2),
        'Días en Inventario': p.diasEnInventario,
        'Rotación': p.rotacion.toFixed(2),
        'CTRU (PEN)': ctru ? ctru.costoInventarioProm.toFixed(2) : 'N/A',
        'P. Venta Prom (PEN)': ctru ? ctru.precioVentaProm.toFixed(2) : 'N/A',
        'Margen Bruto %': ctru && ctru.ventasCount > 0 ? ctru.margenBrutoProm.toFixed(1) : 'N/A',
        'Margen Neto %': ctru && ctru.ventasCount > 0 ? ctru.margenNetoProm.toFixed(1) : 'N/A',
        'ROI %': roi !== null && ctru && ctru.ventasCount > 0 ? roi.toFixed(1) : 'N/A',
        'Ventas Realizadas': ctru ? ctru.ventasCount : 0,
        'Días para Vencer': p.diasParaVencer || 'N/A',
        'Stock Crítico': p.stockCritico ? 'Sí' : 'No'
      };
    });

    exportService.downloadExcel(clasificacionABC, `Analytics_Inventario_${filtroPais || 'Todos'}`);
  };

  const limpiarFiltros = () => { setFiltroPais(''); setFiltroAlmacen(''); };
  const hayFiltrosActivos = filtroPais !== '' || filtroAlmacen !== '';

  const maxValorTop = topProductosValor.length > 0 ? topProductosValor[0].valorTotal : 1;

  // Obtener el producto más antiguo (para insight de Sin Movimiento vacío)
  const productoMasAntiguo = productosAnalytics.length > 0
    ? productosAnalytics.reduce((max, p) => p.diasEnInventario > max.diasEnInventario ? p : max, productosAnalytics[0])
    : null;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filtros:</span>
            </div>
            <Select
              value={filtroPais}
              onChange={(e) => { setFiltroPais(e.target.value); setFiltroAlmacen(''); }}
              options={[
                { value: '', label: 'Todos los países' },
                { value: 'USA', label: '🇺🇸 USA' },
                { value: 'Peru', label: '🇵🇪 Perú' }
              ]}
              className="w-40"
            />
            <Select
              value={filtroAlmacen}
              onChange={(e) => setFiltroAlmacen(e.target.value)}
              options={[
                { value: '', label: 'Todos los almacenes' },
                ...almacenesFiltrados.map(a => ({ value: a.id, label: `${a.pais === 'USA' ? '🇺🇸' : '🇵🇪'} ${a.nombre}` }))
              ]}
              className="w-52"
              disabled={almacenesFiltrados.length === 0}
            />
            {hayFiltrosActivos && (
              <button onClick={limpiarFiltros} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                Limpiar filtros
              </button>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={handleExportarAnalytics} disabled={productosAnalytics.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Análisis
          </Button>
        </div>
        {hayFiltrosActivos && (
          <div className="mt-3 text-sm text-gray-600">
            Mostrando análisis de <strong>{unidadesActivas.length}</strong> unidades
            {filtroPais && ` en ${filtroPais === 'USA' ? '🇺🇸 USA' : '🇵🇪 Perú'}`}
            {filtroAlmacen && ` (${almacenes.find(a => a.id === filtroAlmacen)?.nombre || ''})`}
          </div>
        )}
      </Card>

      {/* KPIs Operativos */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Valor Total" value={formatCurrency(kpis.valorTotalUSD)} icon={DollarSign} variant="green" />
        <StatCard label="Días Promedio" value={kpis.diasPromedioInventario} subtitle="en inventario" icon={Clock} variant={kpis.diasPromedioInventario > 60 ? 'amber' : 'blue'} />
        <StatCard label="Rotación" value={kpis.rotacionPromedio} subtitle="veces/año" icon={RotateCw} variant={parseFloat(kpis.rotacionPromedio) > 4 ? 'green' : 'amber'} />
        <StatCard label="Sin Movimiento" value={kpis.sinMovimiento} subtitle=">90 días" icon={Package} variant={kpis.sinMovimiento > 0 ? 'red' : 'default'} />
        <StatCard label="Por Vencer" value={kpis.porVencer30} subtitle="30 días" icon={AlertTriangle} variant={kpis.porVencer30 > 0 ? 'amber' : 'default'} />
        <StatCard label="Stock Crítico" value={kpis.productosStockCritico} subtitle="productos" icon={TrendingDown} variant={kpis.productosStockCritico > 0 ? 'red' : 'default'} />
      </div>

      {/* ==================== DASHBOARD DE RENTABILIDAD ==================== */}
      {rentabilidadData ? (
        <Card padding="md" className="border-2 border-green-200 bg-gradient-to-br from-green-50/50 to-emerald-50/30">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Dashboard de Rentabilidad</h3>
            <Badge variant="success" size="sm">{rentabilidadData.totalUdsVendidas} uds vendidas</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className={`rounded-lg p-4 text-center border ${rentabilidadData.margenBrutoGlobal >= 20 ? 'bg-green-50 border-green-200' : rentabilidadData.margenBrutoGlobal >= 10 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
              <div className={`text-2xl font-bold ${rentabilidadData.margenBrutoGlobal >= 20 ? 'text-green-700' : rentabilidadData.margenBrutoGlobal >= 10 ? 'text-amber-700' : 'text-red-700'}`}>
                {rentabilidadData.margenBrutoGlobal.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-600 mt-1">Margen Bruto</div>
              <div className="text-[10px] text-gray-400">Venta - Inversión</div>
            </div>
            <div className={`rounded-lg p-4 text-center border ${rentabilidadData.margenNetoGlobal >= 10 ? 'bg-green-50 border-green-200' : rentabilidadData.margenNetoGlobal >= 5 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
              <div className={`text-2xl font-bold ${rentabilidadData.margenNetoGlobal >= 10 ? 'text-green-700' : rentabilidadData.margenNetoGlobal >= 5 ? 'text-amber-700' : 'text-red-700'}`}>
                {rentabilidadData.margenNetoGlobal.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-600 mt-1">Margen Neto</div>
              <div className="text-[10px] text-gray-400">Venta - Costo Total</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">{rentabilidadData.roiGlobal.toFixed(1)}%</div>
              <div className="text-xs text-gray-600 mt-1">ROI</div>
              <div className="text-[10px] text-gray-400">Retorno / Inversión</div>
            </div>
            <div className={`rounded-lg p-4 text-center border ${rentabilidadData.utilidadNetaTotal >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className={`text-2xl font-bold ${rentabilidadData.utilidadNetaTotal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatPEN(rentabilidadData.utilidadNetaTotal)}
              </div>
              <div className="text-xs text-gray-600 mt-1">Utilidad Neta</div>
              <div className="text-[10px] text-gray-400">Total acumulada</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">{formatPEN(rentabilidadData.totalRevenue)}</div>
              <div className="text-xs text-gray-600 mt-1">Revenue Total</div>
              <div className="text-[10px] text-gray-400">Ventas acumuladas</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4 text-center border border-emerald-200">
              <div className="text-2xl font-bold text-emerald-700">{formatPEN(rentabilidadData.utilidadPotencial)}</div>
              <div className="text-xs text-gray-600 mt-1">Utilidad Potencial</div>
              <div className="text-[10px] text-gray-400">Si vendes todo</div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-white/80 rounded-lg border border-green-100">
            <p className="text-sm text-gray-700">
              <strong className="text-green-700">Resumen:</strong>{' '}
              Tu portafolio genera un ROI del <strong>{rentabilidadData.roiGlobal.toFixed(1)}%</strong> con un margen neto del{' '}
              <strong>{rentabilidadData.margenNetoGlobal.toFixed(1)}%</strong>.
              {rentabilidadData.utilidadPotencial > 0 && (
                <> Tienes <strong>{formatPEN(rentabilidadData.utilidadPotencial)}</strong> de utilidad potencial en tu inventario actual.</>
              )}
              {rentabilidadData.roiGlobal < 15 && ' Considera optimizar precios o reducir costos de envío para mejorar el retorno.'}
            </p>
          </div>
        </Card>
      ) : (
        <Card padding="md" className="border border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 text-gray-500">
            <Activity className="h-5 w-5" />
            <div>
              <div className="font-medium text-gray-700">Datos financieros cargando...</div>
              <div className="text-sm">Los datos de rentabilidad (CTRU) se calculan automáticamente.</div>
            </div>
          </div>
        </Card>
      )}

      {/* ==================== VALOR DE MERCADO VS INVERSIÓN ==================== */}
      {rentabilidadData && rentabilidadData.valorMercadoPotencial > 0 && (
        <Card padding="md">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Valor de Mercado vs Inversión</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">{formatPEN(rentabilidadData.costoInversionPotencial)}</div>
              <div className="text-sm text-blue-600">Inversión en Inventario</div>
              <div className="text-[10px] text-blue-400">Costo + Flete (capas 1-5)</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
              <div className="text-2xl font-bold text-green-700">{formatPEN(rentabilidadData.valorMercadoPotencial)}</div>
              <div className="text-sm text-green-600">Valor de Mercado</div>
              <div className="text-[10px] text-green-400">Si vendes todo al precio promedio</div>
            </div>
            <div className={`rounded-lg p-4 text-center border ${rentabilidadData.utilidadPotencial >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className={`text-2xl font-bold ${rentabilidadData.utilidadPotencial >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {formatPEN(rentabilidadData.utilidadPotencial)}
              </div>
              <div className={`text-sm ${rentabilidadData.utilidadPotencial >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Utilidad Potencial</div>
              <div className="text-[10px] text-gray-400">
                {rentabilidadData.costoInversionPotencial > 0 ? `${((rentabilidadData.utilidadPotencial / rentabilidadData.costoInversionPotencial) * 100).toFixed(1)}% sobre inversión` : ''}
              </div>
            </div>
          </div>
          {/* Barra visual */}
          <div className="relative">
            <div className="h-8 bg-gray-100 rounded-full overflow-hidden flex">
              <div
                className="bg-blue-500 transition-all duration-500 flex items-center justify-center"
                style={{ width: `${Math.min((rentabilidadData.costoInversionPotencial / (rentabilidadData.valorMercadoPotencial || 1)) * 100, 100)}%` }}
              >
                <span className="text-[10px] font-bold text-white">Inversión</span>
              </div>
              {rentabilidadData.utilidadPotencial > 0 && (
                <div
                  className="bg-emerald-500 transition-all duration-500 flex items-center justify-center"
                  style={{ width: `${Math.max(100 - (rentabilidadData.costoInversionPotencial / (rentabilidadData.valorMercadoPotencial || 1)) * 100, 0)}%` }}
                >
                  <span className="text-[10px] font-bold text-white">Utilidad</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ==================== RANKING DE RENTABILIDAD (TOP + BOTTOM) ==================== */}
      {rentabilidadData && rentabilidadData.productosConROI.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 5 Mayor ROI */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">Top 5 — Mayor ROI</h3>
            </div>
            <div className="space-y-3">
              {rentabilidadData.productosConROI.slice(0, 5).map((p, i) => {
                const maxROI = rentabilidadData.productosConROI[0].roi || 1;
                return (
                  <div key={p.productoId} className="p-3 bg-green-50 rounded-lg border border-green-100">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-200 flex items-center justify-center">
                        <span className="text-sm font-bold text-green-800">#{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-gray-900">{p.sku}</span>
                          <Badge variant="success" size="sm">{p.roi.toFixed(0)}% ROI</Badge>
                        </div>
                        <div className="text-sm text-gray-600 truncate">{p.marca} · {p.nombre}</div>
                        {getProductoRef(p) && <div className="text-[10px] text-gray-400 truncate">{getProductoRef(p)}</div>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-green-700">{formatPEN(p.utilidadUnitaria)}</div>
                        <div className="text-[10px] text-gray-500">util/ud · M.Neto {p.ctru!.margenNetoProm.toFixed(0)}%</div>
                        <div className="text-[10px] text-gray-400">{p.ctru!.ventasCount} ventas</div>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 bg-green-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${(p.roi / maxROI) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Bottom 5 Menor ROI */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="h-5 w-5 text-red-600" />
              <h3 className="font-semibold text-gray-900">Menor Rentabilidad</h3>
            </div>
            <div className="space-y-3">
              {rentabilidadData.productosConROI.slice(-5).reverse().map((p, i) => (
                <div key={p.productoId} className={`p-3 rounded-lg border ${p.roi < 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-100'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${p.roi < 0 ? 'bg-red-200' : 'bg-amber-200'}`}>
                      <span className={`text-sm font-bold ${p.roi < 0 ? 'text-red-800' : 'text-amber-800'}`}>#{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-gray-900">{p.sku}</span>
                        <Badge variant={p.roi < 0 ? 'danger' : 'warning'} size="sm">
                          {p.roi < 0 ? 'Pérdida' : `${p.roi.toFixed(0)}% ROI`}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 truncate">{p.marca} · {p.nombre}</div>
                      {getProductoRef(p) && <div className="text-[10px] text-gray-400 truncate">{getProductoRef(p)}</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-sm font-bold ${p.utilidadUnitaria < 0 ? 'text-red-700' : 'text-amber-700'}`}>{formatPEN(p.utilidadUnitaria)}</div>
                      <div className="text-[10px] text-gray-500">util/ud · M.Neto {p.ctru!.margenNetoProm.toFixed(0)}%</div>
                      <div className="text-[10px] text-gray-400">{p.ctru!.ventasCount} ventas</div>
                    </div>
                  </div>
                </div>
              ))}
              {rentabilidadData.productosConROI.filter(p => p.roi < 0).length > 0 && (
                <div className="p-2 bg-red-100 rounded text-xs text-red-700">
                  <strong>Atención:</strong> {rentabilidadData.productosConROI.filter(p => p.roi < 0).length} producto(s) con ROI negativo — están destruyendo valor. Revisa pricing o descontinúa.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ==================== MATRIZ ESTRATÉGICA ==================== */}
      {rentabilidadData && rentabilidadData.matrizEstrategica.estrellas.length + rentabilidadData.matrizEstrategica.vacasLecheras.length + rentabilidadData.matrizEstrategica.volumen.length + rentabilidadData.matrizEstrategica.revisar.length > 0 && (
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-gray-900">Matriz Estratégica</h3>
              <span className="text-xs text-gray-400">(Margen × Rotación)</span>
            </div>
            <div className="text-xs text-gray-500">
              Umbrales: Margen &gt;{rentabilidadData.matrizEstrategica.medianMargen.toFixed(0)}% | Rotación &gt;{rentabilidadData.matrizEstrategica.medianRotacion.toFixed(0)}x
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Estrellas */}
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-green-600" />
                <span className="font-bold text-green-800 text-sm">Estrellas</span>
              </div>
              <div className="text-2xl font-bold text-green-700">{rentabilidadData.matrizEstrategica.estrellas.length}</div>
              <div className="text-[10px] text-green-600 mb-2">Alto margen + Alta rotación</div>
              <div className="space-y-2 mt-1">
                {rentabilidadData.matrizEstrategica.estrellas.slice(0, 3).map(p => (
                  <div key={p.productoId} className="bg-white/60 rounded p-1.5">
                    <div className="text-[11px] font-medium text-gray-800 leading-tight">{p.nombre}</div>
                    {getProductoRef(p) && <div className="text-[10px] text-gray-500 leading-tight">{getProductoRef(p)}</div>}
                    <div className="text-[10px] text-green-700 font-medium mt-0.5">M:{p.ctru!.margenBrutoProm.toFixed(0)}% · R:{p.rotacion.toFixed(0)}x</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Vacas Lecheras */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="font-bold text-blue-800 text-sm">Vacas Lecheras</span>
              </div>
              <div className="text-2xl font-bold text-blue-700">{rentabilidadData.matrizEstrategica.vacasLecheras.length}</div>
              <div className="text-[10px] text-blue-600 mb-2">Alto margen + Baja rotación</div>
              <div className="space-y-2 mt-1">
                {rentabilidadData.matrizEstrategica.vacasLecheras.slice(0, 3).map(p => (
                  <div key={p.productoId} className="bg-white/60 rounded p-1.5">
                    <div className="text-[11px] font-medium text-gray-800 leading-tight">{p.nombre}</div>
                    {getProductoRef(p) && <div className="text-[10px] text-gray-500 leading-tight">{getProductoRef(p)}</div>}
                    <div className="text-[10px] text-blue-700 font-medium mt-0.5">M:{p.ctru!.margenBrutoProm.toFixed(0)}% · R:{p.rotacion.toFixed(0)}x</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Volumen */}
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-amber-600" />
                <span className="font-bold text-amber-800 text-sm">Volumen</span>
              </div>
              <div className="text-2xl font-bold text-amber-700">{rentabilidadData.matrizEstrategica.volumen.length}</div>
              <div className="text-[10px] text-amber-600 mb-2">Bajo margen + Alta rotación</div>
              <div className="space-y-2 mt-1">
                {rentabilidadData.matrizEstrategica.volumen.slice(0, 3).map(p => (
                  <div key={p.productoId} className="bg-white/60 rounded p-1.5">
                    <div className="text-[11px] font-medium text-gray-800 leading-tight">{p.nombre}</div>
                    {getProductoRef(p) && <div className="text-[10px] text-gray-500 leading-tight">{getProductoRef(p)}</div>}
                    <div className="text-[10px] text-amber-700 font-medium mt-0.5">M:{p.ctru!.margenBrutoProm.toFixed(0)}% · R:{p.rotacion.toFixed(0)}x</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Revisar */}
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="font-bold text-red-800 text-sm">Revisar</span>
              </div>
              <div className="text-2xl font-bold text-red-700">{rentabilidadData.matrizEstrategica.revisar.length}</div>
              <div className="text-[10px] text-red-600 mb-2">Bajo margen + Baja rotación</div>
              <div className="space-y-2 mt-1">
                {rentabilidadData.matrizEstrategica.revisar.slice(0, 3).map(p => (
                  <div key={p.productoId} className="bg-white/60 rounded p-1.5">
                    <div className="text-[11px] font-medium text-gray-800 leading-tight">{p.nombre}</div>
                    {getProductoRef(p) && <div className="text-[10px] text-gray-500 leading-tight">{getProductoRef(p)}</div>}
                    <div className="text-[10px] text-red-700 font-medium mt-0.5">M:{p.ctru!.margenBrutoProm.toFixed(0)}% · R:{p.rotacion.toFixed(0)}x</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
            <strong>Insight:</strong>{' '}
            {rentabilidadData.matrizEstrategica.estrellas.length > 0 && (
              <>{rentabilidadData.matrizEstrategica.estrellas.length} producto(s) son estrellas — alto margen y alta rotación. </>
            )}
            {rentabilidadData.matrizEstrategica.revisar.length > 0 && (
              <>{rentabilidadData.matrizEstrategica.revisar.length} producto(s) requieren revisión urgente — ni son rentables ni rotan. </>
            )}
            {rentabilidadData.matrizEstrategica.volumen.length > 0 && (
              <>Los {rentabilidadData.matrizEstrategica.volumen.length} producto(s) de volumen generan flujo — evalúa subir precio gradualmente.</>
            )}
          </div>
        </Card>
      )}

      {/* ==================== COMPOSICIÓN DE COSTOS ==================== */}
      {rentabilidadData && (
        <Card padding="md">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Composición de Costos (7 Capas CTRU)</h3>
          </div>
          {/* Barra apilada */}
          <div className="h-10 rounded-lg overflow-hidden flex mb-4">
            {[
              { label: 'Compra', pct: rentabilidadData.pctCompra, color: 'bg-blue-500' },
              { label: 'Impuesto', pct: rentabilidadData.pctImpuesto, color: 'bg-slate-400' },
              { label: 'Envío OC', pct: rentabilidadData.pctEnvio, color: 'bg-cyan-500' },
              { label: 'Otros', pct: rentabilidadData.pctOtros, color: 'bg-gray-400' },
              { label: 'Flete Intl', pct: rentabilidadData.pctFleteIntl, color: 'bg-amber-500' },
              { label: 'GA/GO', pct: rentabilidadData.pctGAGO, color: 'bg-purple-500' },
              { label: 'GV/GD', pct: rentabilidadData.pctGVGD, color: 'bg-red-400' }
            ].filter(c => c.pct > 0).map(c => (
              <div
                key={c.label}
                className={`${c.color} flex items-center justify-center transition-all duration-500`}
                style={{ width: `${Math.max(c.pct, 2)}%` }}
                title={`${c.label}: ${c.pct.toFixed(1)}%`}
              >
                {c.pct >= 8 && <span className="text-[10px] font-bold text-white">{c.pct.toFixed(0)}%</span>}
              </div>
            ))}
          </div>
          {/* Leyenda */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { label: 'Compra', pct: rentabilidadData.pctCompra, color: 'bg-blue-500', desc: 'Costo producto' },
              { label: 'Impuesto', pct: rentabilidadData.pctImpuesto, color: 'bg-slate-400', desc: 'Sales Tax' },
              { label: 'Envío OC', pct: rentabilidadData.pctEnvio, color: 'bg-cyan-500', desc: 'Prov→USA' },
              { label: 'Otros OC', pct: rentabilidadData.pctOtros, color: 'bg-gray-400', desc: 'Gastos OC' },
              { label: 'Flete Intl', pct: rentabilidadData.pctFleteIntl, color: 'bg-amber-500', desc: 'USA→Perú' },
              { label: 'GA/GO', pct: rentabilidadData.pctGAGO, color: 'bg-purple-500', desc: 'Admin/Op' },
              { label: 'GV/GD', pct: rentabilidadData.pctGVGD, color: 'bg-red-400', desc: 'Venta/Dist' }
            ].map(c => (
              <div key={c.label} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-sm ${c.color} flex-shrink-0`} />
                <div>
                  <div className="text-xs font-medium text-gray-700">{c.label}</div>
                  <div className="text-[10px] text-gray-500">{c.pct.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
            <strong>Análisis:</strong>{' '}
            {(() => {
              const capas = [
                { label: 'compra', pct: rentabilidadData.pctCompra },
                { label: 'flete internacional', pct: rentabilidadData.pctFleteIntl },
                { label: 'GA/GO', pct: rentabilidadData.pctGAGO },
                { label: 'impuestos', pct: rentabilidadData.pctImpuesto },
                { label: 'envío OC', pct: rentabilidadData.pctEnvio },
                { label: 'GV/GD', pct: rentabilidadData.pctGVGD }
              ].sort((a, b) => b.pct - a.pct);
              return `El costo de ${capas[0].label} representa el ${capas[0].pct.toFixed(0)}% del costo total. ` +
                (capas[1].pct > 5 ? `El ${capas[1].label} es tu segundo mayor costo (${capas[1].pct.toFixed(0)}%). ` : '') +
                (rentabilidadData.pctFleteIntl > 15 ? 'El flete internacional es elevado — buscar alternativas de envío podría mejorar márgenes.' : '');
            })()}
          </div>
        </Card>
      )}

      {/* Pareto Estratégico + Vencimientos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pareto Estratégico */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary-600" />
              <h3 className="font-semibold text-gray-900">Pareto Estratégico</h3>
            </div>
            <Badge variant="info" size="sm">Capital vs Utilidad</Badge>
          </div>

          {/* Comparativa visual: Dónde ESTÁ vs Dónde TRABAJA */}
          <div className="space-y-3 mb-4">
            <div>
              <div className="text-[10px] text-gray-500 font-medium uppercase mb-1">Dónde ESTÁ tu capital (costo inventario)</div>
              <div className="h-5 rounded-full overflow-hidden flex bg-gray-100">
                {kpis.valorTotalUSD > 0 && (
                  <>
                    <div className="bg-blue-500 transition-all duration-500 flex items-center justify-center" style={{ width: `${(kpis.valorA / kpis.valorTotalUSD) * 100}%` }}>
                      <span className="text-[9px] font-bold text-white">A {((kpis.valorA / kpis.valorTotalUSD) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="bg-blue-300 transition-all duration-500 flex items-center justify-center" style={{ width: `${(kpis.valorB / kpis.valorTotalUSD) * 100}%` }}>
                      <span className="text-[9px] font-bold text-white">B</span>
                    </div>
                    <div className="bg-blue-200 transition-all duration-500" style={{ width: `${(kpis.valorC / kpis.valorTotalUSD) * 100}%` }} />
                  </>
                )}
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                <span>A: {kpis.countA} prods · {formatCurrency(kpis.valorA)}</span>
                <span>B: {kpis.countB} · {formatCurrency(kpis.valorB)}</span>
                <span>C: {kpis.countC} · {formatCurrency(kpis.valorC)}</span>
              </div>
            </div>
            {paretoEstrategico && (
              <div>
                <div className="text-[10px] text-gray-500 font-medium uppercase mb-1">Dónde TRABAJA tu capital (utilidad generada)</div>
                <div className="h-5 rounded-full overflow-hidden flex bg-gray-100">
                  {paretoEstrategico.totalUtilidad > 0 && (
                    <>
                      <div className="bg-green-500 transition-all duration-500 flex items-center justify-center" style={{ width: `${(paretoEstrategico.valorUtilA / paretoEstrategico.totalUtilidad) * 100}%` }}>
                        <span className="text-[9px] font-bold text-white">A {((paretoEstrategico.valorUtilA / paretoEstrategico.totalUtilidad) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="bg-green-300 transition-all duration-500 flex items-center justify-center" style={{ width: `${Math.max((paretoEstrategico.valorUtilB / paretoEstrategico.totalUtilidad) * 100, 0)}%` }}>
                        <span className="text-[9px] font-bold text-white">B</span>
                      </div>
                      <div className="bg-green-200 transition-all duration-500" style={{ width: `${Math.max((paretoEstrategico.valorUtilC / paretoEstrategico.totalUtilidad) * 100, 0)}%` }} />
                    </>
                  )}
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>A: {paretoEstrategico.utilA} prods · {formatPEN(paretoEstrategico.valorUtilA)}</span>
                  <span>B: {paretoEstrategico.utilB} · {formatPEN(paretoEstrategico.valorUtilB)}</span>
                  <span>C: {paretoEstrategico.utilC} · {formatPEN(paretoEstrategico.valorUtilC)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Hallazgos estratégicos */}
          {paretoEstrategico ? (
            <div className="space-y-2">
              {/* Eficientes */}
              {paretoEstrategico.eficientes.length > 0 && (
                <div className="p-2.5 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-xs font-bold text-green-800">Capital Bien Invertido</span>
                    <Badge variant="success" size="sm">{paretoEstrategico.eficientes.length}</Badge>
                  </div>
                  <div className="text-[10px] text-green-700 mb-1">Clase A en capital Y utilidad — nunca dejes que se agoten</div>
                  <div className="space-y-1">
                    {paretoEstrategico.eficientes.slice(0, 3).map(p => (
                      <div key={p.productoId} className="text-[11px] text-gray-700 flex items-center justify-between">
                        <span className="truncate flex-1">{p.nombre} {getProductoRef(p) ? `· ${getProductoRef(p)}` : ''}</span>
                        <span className="ml-2 text-green-700 font-medium flex-shrink-0">{formatPEN(p.utilidadTotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Trampas de Capital */}
              {paretoEstrategico.trampasCapital.length > 0 && (
                <div className="p-2.5 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                    <span className="text-xs font-bold text-red-800">Trampas de Capital</span>
                    <Badge variant="danger" size="sm">{paretoEstrategico.trampasCapital.length}</Badge>
                  </div>
                  <div className="text-[10px] text-red-700 mb-1">Clase A en capital pero baja utilidad — estás sobre-invirtiendo</div>
                  <div className="space-y-1">
                    {paretoEstrategico.trampasCapital.slice(0, 3).map(p => (
                      <div key={p.productoId} className="text-[11px] text-gray-700 flex items-center justify-between">
                        <span className="truncate flex-1">{p.nombre} {getProductoRef(p) ? `· ${getProductoRef(p)}` : ''}</span>
                        <span className="ml-2 text-red-600 font-medium flex-shrink-0">{formatCurrency(p.valorTotal)} inv → {formatPEN(p.utilidadTotal)} util</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Joyas Ocultas */}
              {paretoEstrategico.joyasOcultas.length > 0 && (
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-xs font-bold text-amber-800">Joyas Ocultas</span>
                    <Badge variant="warning" size="sm">{paretoEstrategico.joyasOcultas.length}</Badge>
                  </div>
                  <div className="text-[10px] text-amber-700 mb-1">Poca inversión pero alta utilidad — invierte MÁS en estos</div>
                  <div className="space-y-1">
                    {paretoEstrategico.joyasOcultas.slice(0, 3).map(p => (
                      <div key={p.productoId} className="text-[11px] text-gray-700 flex items-center justify-between">
                        <span className="truncate flex-1">{p.nombre} {getProductoRef(p) ? `· ${getProductoRef(p)}` : ''}</span>
                        <span className="ml-2 text-amber-700 font-medium flex-shrink-0">ROI {p.roi.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Sin datos de venta */}
              {paretoEstrategico.sinDatos.length > 0 && (
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-gray-500" />
                    <span className="text-xs text-gray-600"><strong>{paretoEstrategico.sinDatos.length}</strong> producto(s) sin ventas — no se puede evaluar utilidad todavía</span>
                  </div>
                </div>
              )}
              {/* Insight final */}
              <div className="p-2 bg-blue-50 rounded text-[11px] text-blue-800">
                <strong>Interpretación:</strong>{' '}
                {paretoEstrategico.trampasCapital.length > 0
                  ? `Tienes ${paretoEstrategico.trampasCapital.length} producto(s) que absorben capital Clase A pero generan utilidad Clase B/C. Reduce stock de estos y reinvierte en las ${paretoEstrategico.joyasOcultas.length > 0 ? `${paretoEstrategico.joyasOcultas.length} joyas ocultas` : 'estrellas'}.`
                  : paretoEstrategico.eficientes.length > 0
                  ? `Tu capital está bien alineado: ${paretoEstrategico.eficientes.length} producto(s) son Clase A tanto en inversión como en utilidad.`
                  : 'Analiza si tu distribución de capital coincide con los productos que más utilidad generan.'}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                <div className="flex items-center justify-center gap-1 mb-1"><Target className="h-4 w-4 text-green-600" /><span className="font-bold text-green-700">Clase A</span></div>
                <div className="text-xl font-bold text-green-800">{kpis.countA}</div>
                <div className="text-xs text-green-600">productos · {formatCurrency(kpis.valorA)}</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-200">
                <div className="flex items-center justify-center gap-1 mb-1"><Layers className="h-4 w-4 text-yellow-600" /><span className="font-bold text-yellow-700">Clase B</span></div>
                <div className="text-xl font-bold text-yellow-800">{kpis.countB}</div>
                <div className="text-xs text-yellow-600">productos · {formatCurrency(kpis.valorB)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
                <div className="flex items-center justify-center gap-1 mb-1"><Package className="h-4 w-4 text-gray-600" /><span className="font-bold text-gray-700">Clase C</span></div>
                <div className="text-xl font-bold text-gray-800">{kpis.countC}</div>
                <div className="text-xs text-gray-600">productos · {formatCurrency(kpis.valorC)}</div>
              </div>
            </div>
          )}
        </Card>

        {/* Vencimientos */}
        <Card padding="md">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-gray-900">Calendario de Vencimientos</h3>
          </div>
          <StatDistribution
            title=""
            data={[
              { label: 'Vencen en 7 días', value: unidadesActivas.filter(u => { const d = calcularDiasParaVencer(u.fechaVencimiento); return d !== null && d >= 0 && d <= 7; }).length, color: 'bg-red-500' },
              { label: 'Vencen en 8-30 días', value: unidadesActivas.filter(u => { const d = calcularDiasParaVencer(u.fechaVencimiento); return d !== null && d > 7 && d <= 30; }).length, color: 'bg-amber-500' },
              { label: 'Vencen en 31-60 días', value: unidadesActivas.filter(u => { const d = calcularDiasParaVencer(u.fechaVencimiento); return d !== null && d > 30 && d <= 60; }).length, color: 'bg-yellow-500' },
              { label: '>60 días o sin fecha', value: unidadesActivas.filter(u => { const d = calcularDiasParaVencer(u.fechaVencimiento); return d === null || d > 60; }).length, color: 'bg-green-500' }
            ]}
          />
          {productosProximosVencer.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Próximos a Vencer</h4>
              <div className="space-y-2">
                {productosProximosVencer.map(p => (
                  <div key={p.productoId} className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-100">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs font-semibold text-gray-900">{p.sku}</div>
                      <div className="text-xs text-gray-600 truncate">{p.marca} · {p.nombre}</div>
                      {getProductoRef(p) && <div className="text-[10px] text-gray-400 truncate">{getProductoRef(p)}</div>}
                    </div>
                    <div className="text-right mr-2">
                      <div className="text-xs font-medium text-gray-700">{p.cantidadTotal} uds</div>
                      <div className="text-[10px] text-gray-500">{formatCurrency(p.valorTotal)}</div>
                    </div>
                    <Badge variant={p.diasParaVencer !== null && p.diasParaVencer <= 7 ? 'danger' : 'warning'} size="sm">
                      {p.diasParaVencer} días
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Top 5 Mayor Capital + Sin Movimiento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Mayor Capital Invertido */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">Top 5 — Mayor Capital Invertido</h3>
            </div>
          </div>
          <div className="space-y-3">
            {topProductosValor.map((p, index) => (
              <div key={p.productoId} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-sm font-bold text-green-700">#{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-gray-900">{p.sku}</span>
                      <span className="text-xs text-gray-500">{p.cantidadTotal} uds</span>
                    </div>
                    <div className="text-sm text-gray-600 truncate">{p.marca} · {p.nombre}</div>
                    {getProductoRef(p) && <div className="text-[10px] text-gray-400 mt-0.5 truncate">{getProductoRef(p)}</div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold text-gray-900">{formatCurrency(p.valorTotal)}</div>
                    <div className="text-xs text-gray-500">{p.porcentajeValor.toFixed(1)}%</div>
                  </div>
                </div>
                {/* Barra proporcional */}
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${(p.valorTotal / maxValorTop) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {topProductosValor.length === 0 && (
              <div className="text-center py-4 text-gray-500">No hay productos con inventario</div>
            )}
          </div>
        </Card>

        {/* Sin Movimiento */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Sin Movimiento</h3>
            </div>
            <Badge variant="default" size="sm">&gt;90 días</Badge>
          </div>
          <div className="space-y-3">
            {productosSinMovimiento.map(p => (
              <div key={p.productoId} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                <div className="flex-shrink-0"><Clock className="h-5 w-5 text-red-500" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-gray-900">{p.sku}</span>
                    <Badge variant="danger" size="sm">{p.diasEnInventario} días</Badge>
                  </div>
                  <div className="text-sm text-gray-600 truncate">{p.marca} · {p.nombre}</div>
                  {getProductoRef(p) && <div className="text-[10px] text-gray-400 truncate">{getProductoRef(p)}</div>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-semibold text-gray-900">{formatCurrency(p.valorTotal)}</div>
                  <div className="text-xs text-gray-500">{p.cantidadTotal} uds</div>
                </div>
              </div>
            ))}
            {productosSinMovimiento.length === 0 && (
              <div className="text-center py-6">
                <Package className="h-8 w-8 mx-auto mb-2 text-green-400" />
                <div className="font-medium text-green-600">Excelente rotación</div>
                <div className="text-sm text-gray-500 mt-1">
                  Todos tus productos rotaron en los últimos 90 días.
                  {productoMasAntiguo && (
                    <> El inventario más antiguo tiene <strong>{productoMasAntiguo.diasEnInventario} días</strong> ({productoMasAntiguo.sku}).</>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Concentración por Marca + Distribución de Antigüedad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Concentración por Marca */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Concentración por Marca</h3>
            </div>
            {concentracionMarca.length > 0 && concentracionMarca[0].porcentaje > 30 && (
              <Badge variant="warning" size="sm">Alta concentración</Badge>
            )}
          </div>
          <div className="space-y-2">
            {concentracionMarca.slice(0, 8).map(m => (
              <div key={m.marca} className="flex items-center gap-3">
                <div className="w-28 text-sm font-medium text-gray-700 truncate" title={m.marca}>{m.marca}</div>
                <div className="flex-1">
                  <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${m.porcentaje > 30 ? 'bg-amber-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.max(m.porcentaje, 2)}%` }}
                    />
                  </div>
                </div>
                <div className="w-20 text-right">
                  <div className="text-sm font-semibold text-gray-900">{formatCurrency(m.valor)}</div>
                </div>
                <div className="w-12 text-right text-xs text-gray-500">{m.porcentaje.toFixed(0)}%</div>
              </div>
            ))}
          </div>
          {concentracionMarca.length > 0 && (
            <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
              <strong>{concentracionMarca.length}</strong> marcas en inventario.
              {concentracionMarca[0].porcentaje > 30 && (
                <> <strong className="text-amber-700">{concentracionMarca[0].marca}</strong> concentra el {concentracionMarca[0].porcentaje.toFixed(0)}% del valor — considera diversificar.</>
              )}
              {concentracionMarca[0].porcentaje <= 30 && (
                <> Diversificación saludable — ninguna marca supera el 30%.</>
              )}
            </div>
          )}
        </Card>

        {/* Distribución de Antigüedad */}
        <Card padding="md">
          <div className="flex items-center gap-2 mb-4">
            <Hourglass className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-gray-900">Antigüedad del Inventario</h3>
          </div>
          <div className="space-y-3">
            {distribucionAntiguedad.map(b => (
              <div key={b.label} className="flex items-center gap-3">
                <div className="w-24 text-sm text-gray-600 font-medium">{b.label}</div>
                <div className="flex-1">
                  <div className="h-6 bg-gray-100 rounded-full overflow-hidden relative">
                    <div className={`h-full ${b.color} rounded-full transition-all duration-500`} style={{ width: `${Math.max(b.widthPercent, 2)}%` }} />
                    {b.count > 0 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white mix-blend-difference">
                        {b.count} uds
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-16 text-right">
                  <div className="text-xs font-medium text-gray-700">{formatCurrency(b.valor)}</div>
                </div>
                <div className={`w-16 text-right text-[10px] font-medium ${b.textColor}`}>{b.tag}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
            {(() => {
              const fresco = distribucionAntiguedad[0].count + distribucionAntiguedad[1].count;
              const total = unidadesActivas.length || 1;
              const pctFresco = ((fresco / total) * 100).toFixed(0);
              return <>El <strong>{pctFresco}%</strong> de tu inventario tiene menos de 30 días — {parseInt(pctFresco) >= 60 ? 'indicador saludable de frescura.' : 'considera acelerar la rotación.'}</>;
            })()}
          </div>
        </Card>
      </div>

      {/* Eficiencia por País */}
      {eficienciaPais.length > 0 && (
        <Card padding="md">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Eficiencia por País</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {eficienciaPais.map(p => (
              <div key={p.pais} className={`rounded-lg p-4 border ${p.pais === 'USA' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{p.pais === 'USA' ? '🇺🇸' : '🇵🇪'}</span>
                  <span className="font-bold text-gray-900">{p.pais === 'USA' ? 'Estados Unidos' : 'Perú'}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">Valor Inventario</div>
                    <div className="text-lg font-bold text-gray-900">{formatCurrency(p.valor)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Unidades</div>
                    <div className="text-lg font-bold text-gray-900">{p.unidades}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Días Promedio</div>
                    <div className="text-lg font-bold text-gray-900">{p.diasPromedio} <span className="text-sm font-normal text-gray-500">días</span></div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Rotación</div>
                    <div className="text-lg font-bold text-gray-900">{p.rotacion}x <span className="text-sm font-normal text-gray-500">/año</span></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {eficienciaPais.length >= 2 && eficienciaPais[0].rotacion > 0 && eficienciaPais[1].rotacion > 0 && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
              <strong>Insight:</strong>{' '}
              {(() => {
                const usa = eficienciaPais.find(p => p.pais === 'USA');
                const peru = eficienciaPais.find(p => p.pais === 'Peru');
                if (!usa || !peru) return 'Sin datos suficientes para comparar.';
                if (peru.rotacion > usa.rotacion) {
                  const factor = (peru.rotacion / (usa.rotacion || 1)).toFixed(1);
                  return `El inventario en Perú rota ${factor}x más rápido que en USA (${peru.rotacion}x vs ${usa.rotacion}x). Considera acelerar transferencias de productos de alta demanda.`;
                }
                return `Ambos países tienen rotación similar. USA: ${usa.rotacion}x, Perú: ${peru.rotacion}x.`;
              })()}
            </div>
          )}
        </Card>
      )}

      {/* Métricas de Eficiencia Avanzadas */}
      <Card padding="md">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900">Métricas de Eficiencia</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
            <div className="text-2xl font-bold text-blue-700">{formatCurrency(kpis.valorTotalUSD)}</div>
            <div className="text-sm text-blue-600">Capital en Inventario</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center border border-green-100">
            <div className="text-2xl font-bold text-green-700">{kpis.coberturaStock} <span className="text-base font-normal">días</span></div>
            <div className="text-sm text-green-600">Cobertura de Stock</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-100">
            <div className="text-2xl font-bold text-purple-700">{kpis.indiceServicio.toFixed(0)}%</div>
            <div className="text-sm text-purple-600">Índice de Servicio</div>
          </div>
          <div className={`rounded-lg p-4 text-center border ${kpis.capitalOcioso > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
            <div className={`text-2xl font-bold ${kpis.capitalOcioso > 0 ? 'text-red-700' : 'text-gray-700'}`}>{formatCurrency(kpis.capitalOcioso)}</div>
            <div className={`text-sm ${kpis.capitalOcioso > 0 ? 'text-red-600' : 'text-gray-600'}`}>Capital Ocioso</div>
            <div className="text-[10px] text-gray-500">rotación &lt;1x/año</div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Interpretación:</strong> Tu inventario cubre <strong>{kpis.coberturaStock} días</strong> de demanda promedio.
            {kpis.indiceServicio >= 90
              ? ` El índice de servicio del ${kpis.indiceServicio.toFixed(0)}% indica buena disponibilidad de stock.`
              : ` El índice de servicio del ${kpis.indiceServicio.toFixed(0)}% sugiere rupturas frecuentes — considera aumentar stock de los ${kpis.productosStockCritico} productos críticos.`}
            {kpis.capitalOcioso > 0 && ` Tienes ${formatCurrency(kpis.capitalOcioso)} en capital ocioso (productos con rotación <1x/año).`}
          </p>
        </div>
      </Card>

      {/* Costo de Oportunidad */}
      {costoOportunidad.totalProductos > 0 && (
        <Card padding="md" className="border-2 border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-gray-900">Costo de Oportunidad</h3>
            <Badge variant="warning" size="sm">{costoOportunidad.totalProductos} productos estancados</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white rounded-lg p-4 text-center border border-amber-200">
              <div className="text-2xl font-bold text-red-600">{formatCurrency(costoOportunidad.capitalInmovilizado)}</div>
              <div className="text-sm text-gray-600">Capital Inmovilizado</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center border border-amber-200">
              <div className="text-2xl font-bold text-amber-600">{formatCurrency(costoOportunidad.recuperacionCon30Descuento)}</div>
              <div className="text-sm text-gray-600">Recuperas con 30% off</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center border border-amber-200">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(costoOportunidad.potencialReinversion)}</div>
              <div className="text-sm text-gray-600">Potencial Reinversión</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center border border-green-200 bg-green-50">
              <div className="text-2xl font-bold text-green-700">{formatCurrency(costoOportunidad.gananciaOportunidad)}</div>
              <div className="text-sm text-green-600">Ganancia Potencial</div>
            </div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-amber-200">
            <p className="text-sm text-gray-700">
              <strong className="text-amber-700">Recomendación:</strong> Tienes <strong>{formatCurrency(costoOportunidad.capitalInmovilizado)}</strong> en
              productos estancados. Si los vendes con <strong>30% de descuento</strong>, recuperas <strong>{formatCurrency(costoOportunidad.recuperacionCon30Descuento)}</strong>.
              Reinvirtiendo con el ROI promedio (25%), generarías <strong className="text-green-600">{formatCurrency(costoOportunidad.gananciaOportunidad)}</strong> adicionales.
            </p>
          </div>
        </Card>
      )}

      {/* Proyección de Agotamiento */}
      {productosReorden.length > 0 && (
        <Card padding="md" className="border-2 border-red-200 bg-red-50/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h3 className="font-semibold text-gray-900">Proyección de Agotamiento</h3>
              <Badge variant="danger" size="sm">{productosReorden.length} requieren reorden</Badge>
            </div>
            <div className="text-sm text-gray-600">Lead time: <strong>30 días</strong></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {productosReorden.map(p => {
              const urgencia = p.diasHastaAgotar !== null && p.diasHastaAgotar <= 15 ? 'urgente' :
                               p.diasHastaAgotar !== null && p.diasHastaAgotar <= 30 ? 'critico' : 'alerta';
              const bgColor = urgencia === 'urgente' ? 'bg-red-100 border-red-300' :
                             urgencia === 'critico' ? 'bg-amber-100 border-amber-300' : 'bg-yellow-100 border-yellow-300';
              const textColor = urgencia === 'urgente' ? 'text-red-700' :
                               urgencia === 'critico' ? 'text-amber-700' : 'text-yellow-700';

              return (
                <div key={p.productoId} className={`p-3 rounded-lg border ${bgColor}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-gray-900">{p.sku}</span>
                        <Badge variant={urgencia === 'urgente' ? 'danger' : urgencia === 'critico' ? 'warning' : 'default'} size="sm">
                          {p.diasHastaAgotar} días
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 truncate">{p.marca} · {p.nombre}</div>
                      {getProductoRef(p) && <div className="text-[10px] text-gray-400 truncate">{getProductoRef(p)}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-900">{p.cantidadTotal} uds</div>
                    </div>
                  </div>
                  <div className={`mt-2 text-xs ${textColor} flex items-center gap-1`}>
                    <Calendar className="h-3 w-3" />
                    {p.fechaEstimadaAgotamiento
                      ? `Se agota: ${p.fechaEstimadaAgotamiento.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}`
                      : 'Sin proyección'}
                    {' · '}{p.ventasDiarias.toFixed(2)} uds/día
                  </div>
                  {urgencia === 'urgente' && (
                    <div className="mt-2 text-xs font-medium text-red-800 bg-red-200 rounded px-2 py-1">
                      REORDENAR AHORA - No llegará a tiempo
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Tabla Completa de Productos */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Detalle Completo de Productos</h3>
            <Badge variant="info" size="sm">{tablaProductos.length} productos</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={filtroClaseABC}
              onChange={(e) => setFiltroClaseABC(e.target.value as 'A' | 'B' | 'C' | '')}
              options={[
                { value: '', label: 'Todas las clases' },
                { value: 'A', label: 'Clase A' },
                { value: 'B', label: 'Clase B' },
                { value: 'C', label: 'Clase C' }
              ]}
              className="w-40"
            />
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por SKU, nombre, marca o presentación..."
            value={busquedaTabla}
            onChange={(e) => setBusquedaTabla(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-8">#</th>
                {[
                  { key: 'sku' as TablaSort, label: 'Producto', align: 'left' },
                  { key: 'cantidad' as TablaSort, label: 'Uds', align: 'center' },
                  { key: 'valor' as TablaSort, label: 'Valor USD', align: 'right' },
                  { key: 'clase' as TablaSort, label: 'Clase', align: 'center' },
                  { key: 'rotacion' as TablaSort, label: 'Rotación', align: 'center' },
                  { key: 'dias' as TablaSort, label: 'Días', align: 'center' },
                  ...(rentabilidadData ? [
                    { key: 'ctru' as TablaSort, label: 'CTRU', align: 'right' },
                    { key: 'precioVenta' as TablaSort, label: 'P. Venta', align: 'right' },
                    { key: 'margen' as TablaSort, label: 'Margen', align: 'center' },
                    { key: 'roi' as TablaSort, label: 'ROI', align: 'center' }
                  ] : [])
                ].map(col => (
                  <th
                    key={col.key}
                    className={`px-3 py-2 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors ${col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center'}`}
                    onClick={() => handleTablaSort(col.key)}
                  >
                    <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                      <span>{col.label}</span>
                      {tablaSort?.key === col.key ? (
                        tablaSort.dir === 'asc' ? <ChevronUp className="h-3 w-3 text-primary-600" /> : <ChevronDown className="h-3 w-3 text-primary-600" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-gray-400" />
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tablaProductos.map((p, i) => {
                const ref = getProductoRef(p);
                const claseColor = p.clasificacionABC === 'A' ? 'bg-green-100 text-green-800' : p.clasificacionABC === 'B' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800';
                const ctru = rentabilidadData?.ctruMap?.get(p.productoId);
                const roi = ctru && ctru.costoInventarioProm > 0 && ctru.ventasCount > 0
                  ? ((ctru.precioVentaProm - ctru.costoTotalRealProm) / ctru.costoInventarioProm) * 100
                  : null;

                return (
                  <tr key={p.productoId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-mono text-sm font-semibold text-gray-900">{p.sku}</div>
                      <div className="text-xs text-gray-600 truncate max-w-[250px]">{p.marca} · {p.nombre}</div>
                      {ref && <div className="text-[10px] text-gray-400 truncate max-w-[250px]">{ref}</div>}
                    </td>
                    <td className="px-3 py-2 text-center text-sm font-medium text-gray-900">{p.cantidadTotal}</td>
                    <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">{formatCurrency(p.valorTotal)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${claseColor}`}>{p.clasificacionABC}</span>
                    </td>
                    <td className="px-3 py-2 text-center text-sm text-gray-700">{p.rotacion.toFixed(1)}x</td>
                    <td className="px-3 py-2 text-center text-sm text-gray-700">{p.diasEnInventario}d</td>
                    {rentabilidadData && (
                      <>
                        <td className="px-3 py-2 text-right text-sm text-gray-700">
                          {ctru ? formatPEN(ctru.costoInventarioProm) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-gray-700">
                          {ctru && ctru.precioVentaProm > 0 ? formatPEN(ctru.precioVentaProm) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {ctru && ctru.ventasCount > 0 ? (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${ctru.margenBrutoProm >= 20 ? 'bg-green-100 text-green-800' : ctru.margenBrutoProm >= 10 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                              {ctru.margenBrutoProm.toFixed(0)}%
                            </span>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {roi !== null ? (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${roi >= 20 ? 'bg-green-100 text-green-800' : roi >= 0 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                              {roi.toFixed(0)}%
                            </span>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2 text-center">
                      {p.stockCritico ? (
                        <Badge variant="danger" size="sm">Crítico</Badge>
                      ) : p.diasEnInventario > 90 ? (
                        <Badge variant="warning" size="sm">Estancado</Badge>
                      ) : p.diasParaVencer !== null && p.diasParaVencer <= 30 ? (
                        <Badge variant="warning" size="sm">Vence</Badge>
                      ) : (
                        <Badge variant="success" size="sm">OK</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tablaProductos.length === 0 && (
          <div className="text-center py-6 text-gray-500">No hay productos que coincidan con los filtros.</div>
        )}
      </Card>
    </div>
  );
};
