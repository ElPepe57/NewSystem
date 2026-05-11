/**
 * seedMock · MODO DEMO · Cost Intelligence
 *
 * chk5.B-DEMO · genera data sintética determinística realista (Vita Skin Peru)
 * para validación visual de los 5 workspaces. NO persiste a Firestore · cero
 * efectos colaterales · totalmente reversible.
 *
 * Activación: agregar `?demo=true` a la URL del módulo.
 * Desactivación: quitar el parámetro · vuelve al estado real.
 *
 * Cómo eliminar el modo demo definitivamente cuando ya no se necesite:
 *   1. Borrar este archivo
 *   2. Quitar el wire-up en IntelProductosPage.tsx (5 líneas: import +
 *      isDemoMode + mockData useMemo + effectiveX overrides + banner)
 *   3. Cero residuo en BD · cero deuda
 *
 * Filosofía: data realista que activa los 5 workspaces con casos pixel-perfect:
 *   - SUP-0078 (Vitamin D3) con 3 lotes y variance anómala +12%
 *   - SKC-0103 (Niacinamide) con variance volátil +4.8%
 *   - SUP-0078 con 8 uds estancadas en Aduana 21d (ANOMALÍA crítica)
 *   - SUP-0156 (Magnesium) 4 uds estancadas en Aduana 15d (ALTA)
 *   - TCPA 3.65 vs SBS 3.92 (ahorro cambiario · trigger alerta FX)
 *   - 6 meses de gastos clasificados por bloque (producto/venta/periodo)
 */

import { Timestamp } from 'firebase/firestore';
import type { Producto } from '../../../types/producto.types';
import type { OrdenCompra } from '../../../types/ordenCompra.types';
import type { Unidad, EstadoUnidad } from '../../../types/unidad.types';
import type { Gasto } from '../../../types/gasto.types';
import type { CategoriaCosto } from '../../../types/categoriaCosto.types';
import type {
  PoolUSDSnapshot,
  PoolUSDResumen,
} from '../../../types/rendimientoCambiario.types';

export interface DemoMockData {
  productos: Producto[];
  ordenes: OrdenCompra[];
  unidades: Unidad[];
  gastos: Gasto[];
  poolSnapshots: PoolUSDSnapshot[];
  poolResumen: PoolUSDResumen;
  tcSpot: number;
}

// Fecha ancla del demo · viernes 8 mayo 2026 (estable)
const HOY = new Date(2026, 4, 8); // mes 0-indexed

function fechaAtras(diasAtras: number): Date {
  const d = new Date(HOY);
  d.setDate(d.getDate() - diasAtras);
  return d;
}

function ts(d: Date): Timestamp {
  return Timestamp.fromDate(d);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTOS · usamos del catálogo real si hay, sino generamos mock fallback
// ─────────────────────────────────────────────────────────────────────────────

function generarProductosMock(): Producto[] {
  const base = {
    estado: 'activo' as const,
    activo: true,
    fechaCreacion: ts(fechaAtras(180)),
    creadoPor: 'demo',
    paisOrigen: 'USA',
    moneda: 'USD' as const,
    precioCompra: 0,
    precioVenta: 0,
    contenido: '',
    pesoLb: 0,
    paqueteAtributos: [],
    esPack: false,
    categorias: [],
    etiquetas: [],
  };
  return [
    {
      ...base,
      id: 'demo-sup-0078',
      sku: 'SUP-0078',
      nombreComercial: 'Vitamin D3 NOW · 240 caps',
      marca: 'NOW Foods',
      lineaNegocioId: 'sup',
      lineaNegocioNombre: 'Suplemento',
    },
    {
      ...base,
      id: 'demo-sup-0114',
      sku: 'SUP-0114',
      nombreComercial: 'Omega 3 EPA/DHA · 180 caps',
      marca: 'NOW Foods',
      lineaNegocioId: 'sup',
      lineaNegocioNombre: 'Suplemento',
    },
    {
      ...base,
      id: 'demo-sup-0156',
      sku: 'SUP-0156',
      nombreComercial: 'Magnesium Glycinate · 120 caps',
      marca: 'NOW Foods',
      lineaNegocioId: 'sup',
      lineaNegocioNombre: 'Suplemento',
    },
    {
      ...base,
      id: 'demo-skc-0042',
      sku: 'SKC-0042',
      nombreComercial: 'Madecassoside Cream · 50ml',
      marca: 'SkinCeuticals',
      lineaNegocioId: 'skc',
      lineaNegocioNombre: 'Skincare',
    },
    {
      ...base,
      id: 'demo-skc-0103',
      sku: 'SKC-0103',
      nombreComercial: 'Niacinamide 10% Serum · 30ml',
      marca: 'The Ordinary',
      lineaNegocioId: 'skc',
      lineaNegocioNombre: 'Skincare',
    },
    {
      ...base,
      id: 'demo-skc-0089',
      sku: 'SKC-0089',
      nombreComercial: 'Hyaluronic Acid 2% · 30ml',
      marca: 'The Ordinary',
      lineaNegocioId: 'skc',
      lineaNegocioNombre: 'Skincare',
    },
  ] as unknown as Producto[];
}

function pickProductoByCriteria(productos: Producto[], match: (p: Producto) => boolean): Producto | undefined {
  return productos.find(match);
}

function pickProductos(realProductos: Producto[]): Producto[] {
  // Intentamos usar del catálogo real · si no hay match, mock
  if (realProductos.length === 0) return generarProductosMock();

  const mock = generarProductosMock();
  const result: Producto[] = [];

  for (const m of mock) {
    const real = pickProductoByCriteria(realProductos, (p) =>
      (p.sku === m.sku) ||
      (p.nombreComercial && m.nombreComercial && p.nombreComercial.toLowerCase().includes(m.nombreComercial.toLowerCase().split('·')[0].trim()))
    );
    result.push(real ?? m);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// ÓRDENES DE COMPRA · 6 OCs a lo largo de 6 meses
// ─────────────────────────────────────────────────────────────────────────────

function generarOrdenes(productos: Producto[]): OrdenCompra[] {
  const vit = productos[0]; // SUP-0078
  const ome = productos[1]; // SUP-0114
  const mag = productos[2]; // SUP-0156
  const mad = productos[3]; // SKC-0042
  const nia = productos[4]; // SKC-0103
  const hya = productos[5]; // SKC-0089

  const oc = (
    n: number,
    nro: string,
    diasAtras: number,
    estado: OrdenCompra['estado'],
    proveedor: string,
    pais: string,
    items: Array<[Producto, number, number]>, // [producto, cantidad, costoUnitarioUSD]
    tcPago: number,
  ): OrdenCompra => {
    const subtotalUSD = items.reduce((s, [, q, c]) => s + q * c, 0);
    const fecha = fechaAtras(diasAtras);
    return {
      id: `demo-oc-${n}`,
      numeroOrden: nro,
      proveedorId: `demo-prov-${proveedor.toLowerCase().replace(/\s/g, '-')}`,
      nombreProveedor: proveedor,
      paisOrigen: pais,
      productos: items.map(([p, qty, cost]) => ({
        productoId: p.id,
        sku: p.sku ?? '',
        marca: p.marca ?? '',
        nombreComercial: p.nombreComercial ?? '',
        presentacion: '',
        cantidad: qty,
        costoUnitario: cost,
        subtotal: qty * cost,
      })),
      subtotalUSD,
      totalUSD: subtotalUSD,
      totalPEN: subtotalUSD * tcPago,
      tcCompra: tcPago,
      tcPago,
      estado,
      estadoPago: 'pagado',
      fechaCreacion: ts(fecha),
      fechaEnviada: ts(fecha),
      almacenDestino: 'demo-almacen-vsp',
      nombreAlmacenDestino: 'Almacén Lima',
      inventarioGenerado: true,
      creadoPor: 'demo',
    } as unknown as OrdenCompra;
  };

  return [
    // Hace ~5 meses · primera OC del catálogo (baseline)
    oc(1, 'OC-2025-018', 145, 'completada', 'NOW Foods', 'USA', [
      [vit, 50, 12.20],
      [ome, 80, 9.50],
    ], 3.62),
    // Hace ~3.5 meses
    oc(2, 'OC-2026-003', 107, 'completada', 'NOW Foods', 'USA', [
      [vit, 80, 12.20],
      [mag, 40, 7.80],
    ], 3.78),
    // Hace ~2.5 meses · OCs de Skincare
    oc(3, 'OC-2026-008', 78, 'completada', 'The Ordinary', 'USA', [
      [nia, 60, 11.20],
      [hya, 50, 9.80],
      [mad, 30, 22.85],
    ], 3.65),
    // Hace ~6 semanas · OC con costo subido (variance amber)
    oc(4, 'OC-2026-011', 45, 'completada', 'NOW Foods', 'USA', [
      [ome, 80, 10.20], // subió de 9.50 a 10.20 (+7.4%)
    ], 3.65),
    // Hace ~5 semanas · Niacinamide subió (anómalo)
    oc(5, 'OC-2026-013', 38, 'completada', 'The Ordinary', 'USA', [
      [nia, 50, 12.50], // subió de 11.20 a 12.50 (+11.6%)
    ], 3.65),
    // Hace ~30 días · OC retenida en aduana (la del anomalía rose)
    oc(6, 'OC-2026-014', 30, 'en_proceso', 'NOW Foods', 'USA', [
      [vit, 100, 13.40], // subió de 12.20 a 13.40 (+9.8%)
    ], 3.65),
    // Hace ~22 días · OC Magnesium también retenida
    oc(7, 'OC-2026-016', 22, 'en_proceso', 'NOW Foods', 'USA', [
      [mag, 30, 8.10], // pequeña subida desde 7.80
    ], 3.65),
    // Hace ~10 días · OC reciente
    oc(8, 'OC-2026-019', 10, 'completada', 'The Ordinary', 'USA', [
      [mad, 25, 23.50],
    ], 3.65),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIDADES · distribuidas en estados pipeline + lotes para activar variance
// ─────────────────────────────────────────────────────────────────────────────

function generarUnidades(productos: Producto[], ordenes: OrdenCompra[]): Unidad[] {
  const unidades: Unidad[] = [];
  let idCounter = 1;

  const lotePorOC: Record<string, string> = {
    'demo-oc-1': 'L-2025-12-A',
    'demo-oc-2': 'L-2026-01-B',
    'demo-oc-3': 'L-2026-02-A',
    'demo-oc-4': 'L-2026-03-A',
    'demo-oc-5': 'L-2026-03-B',
    'demo-oc-6': 'L-2026-04-C',
    'demo-oc-7': 'L-2026-04-D',
    'demo-oc-8': 'L-2026-04-E',
  };

  // Por cada OC generamos N unidades con su estado
  for (const o of ordenes) {
    const lote = lotePorOC[o.id] ?? 'L-DEMO';
    const fechaRecepcion = (o.fechaCreacion as Timestamp).toDate();
    const fechaActualizacion = new Date(fechaRecepcion);
    fechaActualizacion.setDate(fechaActualizacion.getDate() + 20);

    for (const p of o.productos) {
      const producto = productos.find((pr) => pr.id === p.productoId);
      if (!producto) continue;

      const cantidad = p.cantidad;

      // Determinar estado mayoritario según OC
      let estadoMayoritario: EstadoUnidad = 'disponible';
      let cantidadEnEstadoEspecial = 0;
      let estadoEspecial: EstadoUnidad | null = null;

      if (o.id === 'demo-oc-6') {
        // OC-2026-014 · Vitamin D3 retenida en aduana hace 21 días (anomalía crítica)
        estadoMayoritario = 'disponible'; // mayoría
        cantidadEnEstadoEspecial = 8;
        estadoEspecial = 'retenida_aduana';
      } else if (o.id === 'demo-oc-7') {
        // OC-2026-016 · Magnesium en aduana hace 15 días (alta)
        estadoMayoritario = 'disponible';
        cantidadEnEstadoEspecial = 4;
        estadoEspecial = 'retenida_aduana';
      } else if (o.id === 'demo-oc-8') {
        // OC reciente · algunas en tránsito · algunas pedidas
        estadoMayoritario = 'disponible';
        cantidadEnEstadoEspecial = 5;
        estadoEspecial = 'en_transito';
      }

      const ahora = new Date();
      const estadoPedida = o.estado === 'en_proceso';

      for (let i = 0; i < cantidad; i++) {
        const esEspecial = estadoEspecial && i < cantidadEnEstadoEspecial;
        const estado: EstadoUnidad = esEspecial
          ? estadoEspecial!
          : estadoPedida && i < 3
          ? 'pedida'
          : estadoMayoritario;

        // Para las unidades estancadas, fechaActualizacion debe ser antigua
        const fechaAct = esEspecial && estadoEspecial === 'retenida_aduana'
          ? (o.id === 'demo-oc-6' ? fechaAtras(21) : fechaAtras(15))
          : fechaActualizacion;

        unidades.push({
          id: `demo-u-${idCounter++}`,
          productoId: producto.id,
          productoSKU: producto.sku ?? '',
          productoNombre: producto.nombreComercial ?? '',
          lote,
          fechaVencimiento: ts(new Date(fechaRecepcion.getFullYear() + 2, fechaRecepcion.getMonth(), 1)),
          casillaActualId: 'demo-casilla-lima',
          casillaNombre: 'Almacén Lima',
          pais: 'Peru',
          paisOrigen: 'USA',
          lineaNegocioId: producto.lineaNegocioId,
          lineaNegocioNombre: producto.lineaNegocioNombre,
          estado,
          costoUnitarioUSD: p.costoUnitario,
          costoUnitarioPEN: p.costoUnitario * (o.tcPago ?? 3.65),
          tcCompra: o.tcCompra,
          tcPago: o.tcPago,
          ordenCompraId: o.id,
          ordenCompraNumero: o.numeroOrden,
          fechaRecepcion: ts(fechaRecepcion),
          proveedorId: o.proveedorId,
          proveedorNombre: o.nombreProveedor,
          proveedorPais: o.paisOrigen,
          movimientos: [],
          creadoPor: 'demo',
          fechaCreacion: ts(fechaRecepcion),
          actualizadoPor: 'demo',
          fechaActualizacion: ts(fechaAct),
        } as unknown as Unidad);

        // Suppress unused var warning
        void ahora;
      }
    }
  }

  return unidades;
}

// ─────────────────────────────────────────────────────────────────────────────
// GASTOS · 6 meses de gastos clasificados por bloque
// ─────────────────────────────────────────────────────────────────────────────

function generarGastos(arbolCategorias: CategoriaCosto[]): Gasto[] {
  // Buscar 1 sub-categoría por bloque · usar la primera que encontremos
  const subProducto = arbolCategorias.find((c) => c.bloque === 'producto' && c.nivel === 1);
  const subVenta = arbolCategorias.find((c) => c.bloque === 'venta' && c.nivel === 1);
  const subPeriodo = arbolCategorias.find((c) => c.bloque === 'periodo' && c.nivel === 1);

  // Si el árbol está vacío, generamos mocks con IDs falsos pero el engine usa
  // categoriaCostoId · puede no resolver bloque · entonces forzamos tipo
  // canónico via TIPO_A_CATEGORIA_LEGACY heurística
  const gastos: Gasto[] = [];
  let idCounter = 1;

  // 6 meses de data · valores que muestran tendencia
  const mesesData = [
    { mesesAtras: 5, producto: 50000, venta: 20000, periodo: 18000 },
    { mesesAtras: 4, producto: 55000, venta: 21000, periodo: 19000 },
    { mesesAtras: 3, producto: 60000, venta: 22000, periodo: 19500 },
    { mesesAtras: 2, producto: 65000, venta: 23500, periodo: 20000 },
    { mesesAtras: 1, producto: 75000, venta: 22000, periodo: 17500 },
    { mesesAtras: 0, producto: 80000, venta: 21000, periodo: 18500 },
  ];

  for (const m of mesesData) {
    const fecha = new Date(HOY.getFullYear(), HOY.getMonth() - m.mesesAtras, 15);

    // Gasto bloque producto
    if (m.producto > 0) {
      gastos.push({
        id: `demo-gas-${idCounter++}`,
        numeroGasto: `GAS-DEMO-${idCounter}`,
        tipo: 'flete_internacional',
        descripcion: `Flete internacional · demo ${m.mesesAtras}m`,
        categoriaCostoId: subProducto?.id,
        categoriaCostoNombre: subProducto?.nombre,
        moneda: 'PEN',
        montoOriginal: m.producto,
        montoPEN: m.producto,
        esProrrateable: false,
        mes: fecha.getMonth() + 1,
        anio: fecha.getFullYear(),
        fecha: ts(fecha),
        frecuencia: 'mensual',
        esRecurrente: true,
        estado: 'pagado',
        impactaCTRU: true,
        ctruRecalculado: false,
      } as unknown as Gasto);
    }

    // Gasto bloque venta
    if (m.venta > 0) {
      gastos.push({
        id: `demo-gas-${idCounter++}`,
        numeroGasto: `GAS-DEMO-${idCounter}`,
        tipo: 'marketing',
        descripcion: `Marketing · demo ${m.mesesAtras}m`,
        categoriaCostoId: subVenta?.id,
        categoriaCostoNombre: subVenta?.nombre,
        moneda: 'PEN',
        montoOriginal: m.venta,
        montoPEN: m.venta,
        esProrrateable: false,
        mes: fecha.getMonth() + 1,
        anio: fecha.getFullYear(),
        fecha: ts(fecha),
        frecuencia: 'mensual',
        esRecurrente: true,
        estado: 'pagado',
        impactaCTRU: false,
        ctruRecalculado: false,
      } as unknown as Gasto);
    }

    // Gasto bloque periodo
    if (m.periodo > 0) {
      gastos.push({
        id: `demo-gas-${idCounter++}`,
        numeroGasto: `GAS-DEMO-${idCounter}`,
        tipo: 'administrativo',
        descripcion: `Administrativo · demo ${m.mesesAtras}m`,
        categoriaCostoId: subPeriodo?.id,
        categoriaCostoNombre: subPeriodo?.nombre,
        moneda: 'PEN',
        montoOriginal: m.periodo,
        montoPEN: m.periodo,
        esProrrateable: false,
        mes: fecha.getMonth() + 1,
        anio: fecha.getFullYear(),
        fecha: ts(fecha),
        frecuencia: 'mensual',
        esRecurrente: true,
        estado: 'pagado',
        impactaCTRU: false,
        ctruRecalculado: false,
      } as unknown as Gasto);
    }
  }

  return gastos;
}

// ─────────────────────────────────────────────────────────────────────────────
// POOL USD · 6 snapshots históricos · evolución TCPA vs SBS
// ─────────────────────────────────────────────────────────────────────────────

function generarPoolSnapshots(): PoolUSDSnapshot[] {
  // 6 meses de snapshots · TCPA estable bajo · SBS subiendo (ahorro)
  const data = [
    { mesesAtras: 5, saldoUSD: 8500,  tcpa: 3.62, sbs: 3.78 },
    { mesesAtras: 4, saldoUSD: 9200,  tcpa: 3.63, sbs: 3.80 },
    { mesesAtras: 3, saldoUSD: 8100,  tcpa: 3.64, sbs: 3.85 },
    { mesesAtras: 2, saldoUSD: 7800,  tcpa: 3.64, sbs: 3.90 },
    { mesesAtras: 1, saldoUSD: 9500,  tcpa: 3.65, sbs: 3.92 },
    { mesesAtras: 0, saldoUSD: 10200, tcpa: 3.65, sbs: 3.92 },
  ];

  return data.map((d) => {
    const fecha = new Date(HOY.getFullYear(), HOY.getMonth() - d.mesesAtras, 1);
    const anio = fecha.getFullYear();
    const mes = fecha.getMonth() + 1;
    return {
      id: `${anio}-${String(mes).padStart(2, '0')}`,
      periodo: `${anio}-${String(mes).padStart(2, '0')}`,
      anio,
      mes,
      saldoUSD: d.saldoUSD,
      tcpa: d.tcpa,
      valorPEN_tcpa: d.saldoUSD * d.tcpa,
      tcCierreSunat: d.sbs,
      tcCierreParalelo: d.sbs + 0.02,
      valorPEN_cierre: d.saldoUSD * d.sbs,
      diferenciaRevaluacion: d.saldoUSD * (d.sbs - d.tcpa),
      asientoGenerado: false,
      totalEntradasUSD: d.saldoUSD * 0.3,
      totalSalidasUSD: d.saldoUSD * 0.2,
      cantidadMovimientos: 5,
    } as unknown as PoolUSDSnapshot;
  });
}

function generarPoolResumen(snapshots: PoolUSDSnapshot[]): PoolUSDResumen {
  const ultimo = snapshots[snapshots.length - 1];
  return {
    saldoUSD: ultimo.saldoUSD,
    tcpa: ultimo.tcpa,
    valorPEN_tcpa: ultimo.valorPEN_tcpa,
    valorPEN_mercado: ultimo.saldoUSD * ultimo.tcCierreSunat,
    diferenciaNoRealizada: ultimo.diferenciaRevaluacion,
    entradasUSD: 0,
    salidasUSD: 0,
    gananciaRealizadaPEN: 0,
    gananciaOperativaPEN: 0,
    cantidadMovimientos: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA · genera todo el dataset demo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el set completo de data demo · determinístico · sin escrituras DB.
 *
 * @param realProductos productos del catálogo real (si los hay) · de lo
 *                      contrario usa mocks generados internos
 * @param realCategorias árbol de categorías reales (debe estar seedeado en BD)
 */
export function generateDemoMockData(
  realProductos: Producto[],
  realCategorias: CategoriaCosto[],
): DemoMockData {
  const productos = pickProductos(realProductos);
  const ordenes = generarOrdenes(productos);
  const unidades = generarUnidades(productos, ordenes);
  const gastos = generarGastos(realCategorias);
  const poolSnapshots = generarPoolSnapshots();
  const poolResumen = generarPoolResumen(poolSnapshots);

  return {
    productos,
    ordenes,
    unidades,
    gastos,
    poolSnapshots,
    poolResumen,
    tcSpot: 3.92, // SBS hoy
  };
}
