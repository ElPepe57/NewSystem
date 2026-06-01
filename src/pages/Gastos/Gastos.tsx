import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatFecha, toDateOrNow } from '../../utils/dateFormatters';
import { formatCurrencyPEN } from '../../utils/format';
import {
  AlertCircle, PieChart, Calendar, Trash2, CheckSquare, Square,
  X as XIcon, Download as DownloadIcon, Trash as TrashIcon,
  // chk5.C8 · canon F8 · iconos para tabs de vistas alternativas (sin emojis)
  List, Package, Factory,
  // chk5.E-GASTOS · F1.b · iconos tabs hub + dashboard resumen
  LayoutDashboard, BarChart3, ShoppingBag,
  // chk5.C10 · F10 · empty state canon · iconos lucide
  Receipt, Building, User as UserIcon, Cloud, ArrowRight, CheckCircle2, Plus,
  // DS Fase 4 · Hub Kit · KPIs (deltas semánticos) + acciones header
  TrendingUp, TrendingDown, Minus, Flame, Repeat, Clock, CalendarCheck, Briefcase, Settings, FileBarChart,
} from 'lucide-react';
// chk5.C-FIX · cleanup · Pencil/CreditCard/Badge/GastoLineaBadge removidos (eran del DataTable legacy eliminado)
import { Card, useConfirmDialog, ConfirmDialog, ListSummary, EmptyStateAction, GastosSkeleton } from '../../components/common';
import { LineaDropdown } from '../../components/common/LineaDropdown';
import { useToastStore } from '../../store/toastStore';
import { useGastoStore } from '../../store/gastoStore';
import { useAuthStore } from '../../store/authStore';
import { hasRole } from '../../types/auth.types';
import { ctruService } from '../../services/ctru.service';
import { GastoForm } from './GastoForm';
import { PagoUnificadoForm } from '../../components/modules/pagos/PagoUnificadoForm';
import type { PagoUnificadoResult } from '../../components/modules/pagos/PagoUnificadoForm';
import { exportService } from '../../services/export.service';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import type { Gasto, TipoGasto, EstadoGasto } from '../../types/gasto.types';
import { useCategoriaCostoStore } from '../../store/categoriaCostoStore';
import type { BloqueCosto } from '../../types/categoriaCosto.types';
import { getBloqueDelGasto, resolverGastoCanonico, esGastoDelBloque } from '../../utils/gasto.bloque';
import { FiltrosGastosBar, type OrdenGasto } from './components/FiltrosGastosBar';
import { getOrigenGasto, type OrigenGasto } from './utils/origenGasto';
import { GastoCardCanonico } from './components/GastoCardCanonico';
import { DrawerUrgentes } from './components/DrawerUrgentes';
import { TopProveedoresLightWidget } from './components/TopProveedoresLightWidget';
import { AllocationEngineSettings } from './components/AllocationEngineSettings';
// chk5.C8 · D-GR-8 · ReportesGastosBI eliminado del módulo · análisis profundo
// vive en Cost Intelligence / BI (módulos especializados). Gastos NO duplica.
import { VistaPorBloque } from './components/VistaPorBloque';
import { VistaCalendario } from './components/VistaCalendario';
import { VistaPorProveedor } from './components/VistaPorProveedor';
// chk5.C1 · shell canon banking-grade
// chk5.C-FIX · canon F-Borradores extendido a Gastos
import { BorradorBanner } from '../../design-system/components/BorradorBanner';
// DS Fase 4 · Hub Kit (L5) · shell ensamblado desde el kit aprobado (hub-kit-implementacion-v1)
import { HubShell, HubTopBar, HubHeader, HubKpiStrip, HubTabs, HubBody } from '../../design-system';
import type { HubTab, HubKpi, HubMiniStat } from '../../design-system';
import { NavegacionTemporal } from './components/NavegacionTemporal';
// chk5.C2 · link-card cross-módulo
import { LinkCardEficiencia } from './components/LinkCardEficiencia';
import { useUnidadStore } from '../../store/unidadStore';
import { useVentaStore } from '../../store/ventaStore';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// chk5.C-UX-PASS · U5 · ViewMode 'pending' ELIMINADO (era duplicado con
// chip Estado=Pendiente del FiltrosBar). Solo quedan 'month' y 'all'.
type ViewMode = 'month' | 'all';

export const Gastos: React.FC = () => {
  const { user } = useAuthStore();
  // DS Fase 4 · Hub Kit · chip de rol en el top-bar (canon "admin ve todo")
  const userProfile = useAuthStore((s) => s.userProfile);
  const esAdmin = hasRole(userProfile, 'admin');
  const navigate = useNavigate();
  const {
    gastos, stats, loading,
    fetchGastos, fetchGastosMes, buscarGastos,
    fetchStats, setViewMode: storeSetViewMode, reloadCurrentView,
    fetchGastosPendientesYParciales, eliminarGasto,
    registrarPagoGasto
  } = useGastoStore();

  const [showModal, setShowModal] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [gastoParaPago, setGastoParaPago] = useState<Gasto | null>(null);
  const [gastoParaEditar, setGastoParaEditar] = useState<Gasto | null>(null);
  const [filtros, setFiltros] = useState({
    // chk5.A15 · filtros canónicos (sin ClaseGasto/CategoriaGasto legacy).
    // El filtro principal es `bloque` del modelo 3 niveles; `tipo` discrimina
    // sub-tipos canónicos (delivery, comision_ml, etc).
    // chk5.C3 · `origen` (manual/oc/envio/venta) según D-GR-8 (módulo consolidador).
    tipo: '' as TipoGasto | '',
    estado: '' as EstadoGasto | '',
    esProrrateable: '' as 'true' | 'false' | '',
    bloque: '' as BloqueCosto | '',
    origen: '' as OrigenGasto | '',
  });
  // chk5.A3 · ELIMINADO tabActiva legacy (negocio/importacion/perdidas)
  // El filtrado ahora vive en FiltrosGastosBar via filtros.bloque (canon 3 niveles)

  // Vista y navegación temporal
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [ordenLista, setOrdenLista] = useState<OrdenGasto>('fecha_desc'); // F2 · orden de la lista
  // F4.a · Bulk actions
  const [bulkMode, setBulkMode] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  // chk5.C8 · D-GR-8 · toggle de 4 vistas (Reportes BI eliminado · vive en CI/BI)
  // chk5.E-GASTOS · F1.b · hub con tabs · vistaActiva motoriza tab+sub-vista:
  //   resumen → Tab Resumen · listado/calendario → Tab Movimientos · bloque/proveedor → Tab Análisis
  const [vistaActiva, setVistaActiva] = useState<'resumen' | 'listado' | 'bloque' | 'calendario' | 'proveedor'>('resumen');
  // chk5.C9 · F9 · settings panel del Allocation Engine
  const [showAllocationSettings, setShowAllocationSettings] = useState(false);
  // chk5.C-FIX · canon F-Borradores · refresh del banner al cerrar el modal
  const [borradorRefreshKey, setBorradorRefreshKey] = useState(0);

  // Filtrar gastos por línea de negocio (sin lineaNegocioId = compartidos, siempre visibles)
  const gastosPorLinea = useLineaFilter(gastos, g => g.lineaNegocioId, { allowUndefined: true });

  // Hook para dialogo de confirmacion
  const { dialogProps, confirm } = useConfirmDialog();
  const toast = useToastStore();

  // ── TAREA-GASTOFORM-V2 F4 · Breadcrumb 3 niveles en cards ──
  const arbolCategorias = useCategoriaCostoStore((s) => s.arbol);
  const fetchArbolCategorias = useCategoriaCostoStore((s) => s.fetchArbol);
  useEffect(() => {
    if (!arbolCategorias) {
      fetchArbolCategorias();
    }
  }, [arbolCategorias, fetchArbolCategorias]);

  // chk5.C2 · Unidades + Ventas para calcular ratios eficiencia (cross-link CI)
  const { unidades, fetchUnidades } = useUnidadStore();
  const { ventas, fetchVentas } = useVentaStore();
  useEffect(() => {
    if (unidades.length === 0) fetchUnidades();
    if (ventas.length === 0) fetchVentas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper · resuelve un categoriaCostoId al breadcrumb (bloque > padre > sub)
  const resolveBreadcrumb = (categoriaCostoId?: string): { bloque: BloqueCosto; padre: string; sub?: string } | null => {
    if (!categoriaCostoId || !arbolCategorias) return null;
    for (const bloque of ['producto', 'venta', 'periodo'] as BloqueCosto[]) {
      const datos = arbolCategorias[bloque];
      if (!datos) continue;
      // ¿es padre directo?
      const padreMatch = datos.padres.find((p) => p.id === categoriaCostoId);
      if (padreMatch) return { bloque, padre: padreMatch.nombre };
      // ¿es subcategoria?
      for (const padreId of Object.keys(datos.hijos)) {
        const sub = datos.hijos[padreId].find((h) => h.id === categoriaCostoId);
        if (sub) {
          const padre = datos.padres.find((p) => p.id === padreId);
          return { bloque, padre: padre?.nombre || '?', sub: sub.nombre };
        }
      }
    }
    return null;
  };

  // chk5.C-FIX · DEUDA-GASTOS-DEAD-CODE CERRADA · helper `renderCategoriaBreadcrumb`
  // ELIMINADO · era dead code (solo lo usaba `gastosColumns` también eliminado).
  // El breadcrumb canon se renderiza directamente dentro de `GastoCardCanonico` (F4).

  const isCurrentMonth = selectedMonth === new Date().getMonth() + 1 && selectedYear === new Date().getFullYear();

  // ── TAREA-GASTOS-PAGE-V2 F1 · Hero ejecutivo · KPIs derivados ──
  // Calcula mix por bloque · top categoria · proveedores · vencimientos
  // a partir de los gastos cargados en el mes actual.
  const heroKpis = useMemo(() => {
    const gastosDelMes = gastosPorLinea.filter(g => {
      const fecha = toDateOrNow(g.fecha);
      return fecha.getMonth() + 1 === selectedMonth && fecha.getFullYear() === selectedYear;
    });

    // Mix por bloque (canon · getBloqueDelGasto resuelve via arbol o fallback legacy)
    const mixPorBloque: Record<BloqueCosto, number> = {
      producto: 0, venta: 0, periodo: 0,
    };
    for (const g of gastosDelMes) {
      const bloque = getBloqueDelGasto(g, arbolCategorias) ?? 'periodo';
      mixPorBloque[bloque] += g.montoPEN || 0;
    }
    const totalMix = mixPorBloque.producto + mixPorBloque.venta + mixPorBloque.periodo;

    // Top categoria padre (por monto) · chk5.A12 · canon vía resolverGastoCanonico
    const porCategoria: Record<string, { nombre: string; monto: number; bloque: BloqueCosto }> = {};
    for (const g of gastosDelMes) {
      const r = resolverGastoCanonico(g, arbolCategorias);
      const bloque: BloqueCosto = r.bloque ?? 'periodo';
      const nombre = r.categoriaPadre ?? 'Sin categorizar';
      const key = `${bloque}::${nombre}`;
      if (!porCategoria[key]) porCategoria[key] = { nombre, monto: 0, bloque };
      porCategoria[key].monto += g.montoPEN || 0;
    }
    const topCategorias = Object.values(porCategoria).sort((a, b) => b.monto - a.monto);
    const topCategoria = topCategorias[0];
    const segundaCategoria = topCategorias[1];

    // Proveedores únicos del mes
    const proveedoresUnicos = new Set<string>();
    for (const g of gastosDelMes) {
      if (g.proveedorId) proveedoresUnicos.add(g.proveedorId);
      else if (g.proveedor) proveedoresUnicos.add(g.proveedor);
    }

    // Vencimientos próximos (pendientes ordenados por fecha)
    const hoy = new Date();
    const en7d = new Date(); en7d.setDate(hoy.getDate() + 7);
    const vencenPronto = gastosPorLinea
      .filter(g => g.estado === 'pendiente' || g.estado === 'parcial')
      .filter(g => {
        const f = toDateOrNow(g.fecha);
        return f >= hoy && f <= en7d;
      })
      .sort((a, b) => toDateOrNow(a.fecha).getTime() - toDateOrNow(b.fecha).getTime());
    const vencidos = gastosPorLinea
      .filter(g => g.estado === 'pendiente' || g.estado === 'parcial')
      .filter(g => {
        const f = toDateOrNow(g.fecha);
        return f < hoy;
      });

    // chk5.C1 · cálculos extendidos para KpiStripGastos canon
    // Burn Rate 3m: promedio de los últimos 3 meses (incluyendo mes actual)
    const inicioBurnRate = new Date(selectedYear, selectedMonth - 1 - 2, 1);
    const finBurnRate = new Date(selectedYear, selectedMonth, 1);
    const gastosUlt3m = gastosPorLinea.filter(g => {
      const f = toDateOrNow(g.fecha);
      return f >= inicioBurnRate && f < finBurnRate;
    });
    const burnRate3m = gastosUlt3m.length > 0
      ? gastosUlt3m.reduce((s, g) => s + (g.montoPEN || 0), 0) / 3
      : 0;

    // % Recurrentes del mes (esRecurrente flag)
    const recurrentesMes = gastosDelMes.filter(g => g.esRecurrente === true);
    const recurrentesPEN = recurrentesMes.reduce((s, g) => s + (g.montoPEN || 0), 0);
    const totalMesPEN = gastosDelMes.reduce((s, g) => s + (g.montoPEN || 0), 0);
    const porcentajeRecurrentes = totalMesPEN > 0 ? (recurrentesPEN / totalMesPEN) * 100 : 0;

    // Vencimientos 30d · monto + count + críticos (vencen <3d o ya vencidos)
    const hoyRef = new Date();
    const en30dRef = new Date(); en30dRef.setDate(hoyRef.getDate() + 30);
    const en3dRef = new Date(); en3dRef.setDate(hoyRef.getDate() + 3);
    const vencimientos30d = gastosPorLinea
      .filter(g => g.estado === 'pendiente' || g.estado === 'parcial')
      .filter(g => {
        const f = toDateOrNow(g.fecha);
        return f <= en30dRef;
      });
    const vencimientos30dPEN = vencimientos30d.reduce(
      (s, g) => s + ((g.montoPEN || 0) - (g.montoPagado || 0)),
      0,
    );
    const vencimientosCriticos = vencimientos30d.filter(g => {
      const f = toDateOrNow(g.fecha);
      return f <= en3dRef;
    }).length;

    // DPO · días promedio de pago (últimos 90d con pagos)
    const inicioDPO = new Date(); inicioDPO.setDate(inicioDPO.getDate() - 90);
    const gastosConPago90d = gastosPorLinea.filter(g => {
      if (!g.pagos || g.pagos.length === 0) return false;
      const fechaPrimerPago = g.pagos[0].fecha?.toDate?.();
      return fechaPrimerPago && fechaPrimerPago >= inicioDPO;
    });
    const dpoDias = gastosConPago90d.length > 0
      ? Math.round(
          gastosConPago90d.reduce((acc, g) => {
            const fCreacion = toDateOrNow(g.fecha);
            const fPago = g.pagos![0].fecha?.toDate?.() ?? new Date();
            const dias = Math.max(0, Math.floor((fPago.getTime() - fCreacion.getTime()) / (1000 * 60 * 60 * 24)));
            return acc + dias;
          }, 0) / gastosConPago90d.length,
        )
      : 0;
    // DPO trimestre anterior (rough · usamos 90-180d) para comparación
    const inicioDPOPrev = new Date(); inicioDPOPrev.setDate(inicioDPOPrev.getDate() - 180);
    const finDPOPrev = new Date(); finDPOPrev.setDate(finDPOPrev.getDate() - 90);
    const gastosConPagoPrev = gastosPorLinea.filter(g => {
      if (!g.pagos || g.pagos.length === 0) return false;
      const fechaPrimerPago = g.pagos[0].fecha?.toDate?.();
      return fechaPrimerPago && fechaPrimerPago >= inicioDPOPrev && fechaPrimerPago < finDPOPrev;
    });
    const dpoDiasPrev = gastosConPagoPrev.length > 0
      ? Math.round(
          gastosConPagoPrev.reduce((acc, g) => {
            const fCreacion = toDateOrNow(g.fecha);
            const fPago = g.pagos![0].fecha?.toDate?.() ?? new Date();
            const dias = Math.max(0, Math.floor((fPago.getTime() - fCreacion.getTime()) / (1000 * 60 * 60 * 24)));
            return acc + dias;
          }, 0) / gastosConPagoPrev.length,
        )
      : 0;
    const dpoDeltaTrimestre = dpoDias - dpoDiasPrev;

    // Top proveedor del mes
    const porProveedor: Record<string, { nombre: string; monto: number }> = {};
    for (const g of gastosDelMes) {
      const key = g.proveedorId || g.proveedor || 'sin-prov';
      const nombre = g.proveedorNombre || g.proveedor || 'Sin proveedor';
      if (!porProveedor[key]) porProveedor[key] = { nombre, monto: 0 };
      porProveedor[key].monto += g.montoPEN || 0;
    }
    const topProveedorArr = Object.values(porProveedor).sort((a, b) => b.monto - a.monto);
    const topProveedor = topProveedorArr[0] && totalMesPEN > 0
      ? { nombre: topProveedorArr[0].nombre, pctDelMes: (topProveedorArr[0].monto / totalMesPEN) * 100 }
      : null;

    // Sin clasificar · gastos sin categoriaCostoId
    const sinClasificarCount = gastosPorLinea.filter(g => !g.categoriaCostoId).length;

    // Próximo vencimiento · primero de vencenPronto
    const proximoVencimiento = vencenPronto[0]
      ? {
          descripcion: vencenPronto[0].descripcion?.slice(0, 30) || 'Gasto',
          diasParaVencer: Math.max(
            0,
            Math.floor(
              (toDateOrNow(vencenPronto[0].fecha).getTime() - hoyRef.getTime()) / (1000 * 60 * 60 * 24),
            ),
          ),
        }
      : null;

    return {
      mixPorBloque, totalMix,
      topCategoria, segundaCategoria, totalCategorias: topCategorias.length,
      proveedoresUnicos: proveedoresUnicos.size,
      vencenPronto, vencidos,
      gastosDelMes,
      // chk5.C1 · campos nuevos
      burnRate3m,
      porcentajeRecurrentes,
      vencimientos30dPEN,
      vencimientos30dCount: vencimientos30d.length,
      vencimientosCriticos,
      dpoDias,
      dpoDeltaTrimestre,
      topProveedor,
      sinClasificarCount,
      proximoVencimiento,
    };
  }, [gastosPorLinea, arbolCategorias, selectedMonth, selectedYear]);

  // ── F4.a · Bulk actions handlers ──
  const handleToggleSeleccion = useCallback((g: Gasto) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(g.id)) next.delete(g.id);
      else next.add(g.id);
      return next;
    });
  }, []);

  const handleSelectAllVisibles = useCallback(() => {
    setSeleccionados(new Set(gastosVisibles.map((g) => g.id)));
  }, []); // gastosVisibles se accede via el render · prevent infinito

  const handleClearSeleccion = useCallback(() => {
    setSeleccionados(new Set());
  }, []);

  const handleSalirBulkMode = useCallback(() => {
    setBulkMode(false);
    setSeleccionados(new Set());
  }, []);

  // KPIs de la seleccion bulk (computado desde seleccionados + gastos)
  const seleccionStats = useMemo(() => {
    const items = gastosPorLinea.filter((g) => seleccionados.has(g.id));
    const total = items.reduce((acc, g) => acc + (g.montoPEN || 0), 0);
    const pendientes = items.filter((g) => g.estado === 'pendiente' || g.estado === 'parcial');
    const totalPendiente = pendientes.reduce(
      (acc, g) => acc + ((g.montoPEN || 0) - (g.montoPagado || 0)),
      0,
    );
    return { count: items.length, total, pendientes: pendientes.length, totalPendiente, items };
  }, [seleccionados, gastosPorLinea]);

  // Bulk export · usa exportService existente con los seleccionados
  const handleBulkExport = useCallback(() => {
    if (seleccionStats.items.length === 0) return;
    exportService.exportGastos(seleccionStats.items);
    toast.success(`${seleccionStats.items.length} gastos exportados`);
  }, [seleccionStats.items, toast]);

  // Bulk eliminar · solo permite si todos los seleccionados son pendientes/cancelados sin pagos
  const handleBulkEliminar = useCallback(async () => {
    if (seleccionStats.items.length === 0) return;
    const eliminables = seleccionStats.items.filter(
      (g) =>
        (g.estado === 'pendiente' || g.estado === 'cancelado') &&
        (!g.pagos || g.pagos.length === 0),
    );
    const noEliminables = seleccionStats.items.length - eliminables.length;
    if (eliminables.length === 0) {
      toast.warning('Ninguno de los seleccionados puede eliminarse · tienen pagos o estan pagados');
      return;
    }
    const ok = await confirm({
      title: `Eliminar ${eliminables.length} gastos`,
      message:
        noEliminables > 0
          ? `Se eliminaran ${eliminables.length} de ${seleccionStats.items.length} (${noEliminables} omitidos por tener pagos o estar pagados).`
          : `Se eliminaran ${eliminables.length} gastos seleccionados.`,
      confirmText: `Eliminar ${eliminables.length}`,
      variant: 'danger',
    });
    if (!ok) return;
    let exitos = 0;
    for (const g of eliminables) {
      try {
        await eliminarGasto(g.id);
        exitos++;
      } catch (e) {
        console.error('Error eliminando bulk', g.id, e);
      }
    }
    toast.success(`${exitos} gastos eliminados`);
    handleSalirBulkMode();
  }, [seleccionStats.items, eliminarGasto, confirm, toast, handleSalirBulkMode]);

  // Cargar datos según el modo de vista
  // chk5.C-UX-PASS · U5 · rama 'pending' eliminada · pendientes se filtran
  // client-side via chip Estado=Pendiente del FiltrosBar
  useEffect(() => {
    storeSetViewMode(viewMode, selectedMonth, selectedYear);
    if (viewMode === 'all') {
      fetchGastos();
    } else {
      fetchGastosMes(selectedMonth, selectedYear);
    }
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, selectedMonth, selectedYear]);

  // Navegación de mes
  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (selectedMonth === 1) {
        setSelectedMonth(12);
        setSelectedYear(prev => prev - 1);
      } else {
        setSelectedMonth(prev => prev - 1);
      }
    } else {
      if (selectedMonth === 12) {
        setSelectedMonth(1);
        setSelectedYear(prev => prev + 1);
      } else {
        setSelectedMonth(prev => prev + 1);
      }
    }
  }, [selectedMonth]);

  const goToCurrentMonth = useCallback(() => {
    setSelectedMonth(new Date().getMonth() + 1);
    setSelectedYear(new Date().getFullYear());
    setViewMode('month');
  }, []);

  // Filtrar gastos (incluye búsqueda por texto)
  const gastosFiltrados = useMemo(() => {
    let resultado = gastosPorLinea;

    // Búsqueda por texto
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      resultado = resultado.filter(g =>
        g.descripcion?.toLowerCase().includes(term) ||
        g.numeroGasto?.toLowerCase().includes(term) ||
        g.proveedor?.toLowerCase().includes(term) ||
        g.tipo?.toLowerCase().includes(term) ||
        g.notas?.toLowerCase().includes(term)
      );
    }

    // chk5.A15 · filtros legacy claseGasto/categoria eliminados · usar bloque + tipo
    if (filtros.tipo) {
      resultado = resultado.filter(g => g.tipo === filtros.tipo);
    }
    if (filtros.estado) {
      resultado = resultado.filter(g => g.estado === filtros.estado);
    }
    if (filtros.esProrrateable) {
      resultado = resultado.filter(g => g.esProrrateable === (filtros.esProrrateable === 'true'));
    }
    // F2 · filtro por bloque · chk5.A12 · canon · esGastoDelBloque resuelve
    // via árbol cuando hay categoriaCostoId, fallback legacy si solo categoria.
    if (filtros.bloque) {
      const bloqueObjetivo = filtros.bloque as BloqueCosto;
      resultado = resultado.filter(g => esGastoDelBloque(g, bloqueObjetivo, arbolCategorias));
    }
    // chk5.C3 · filtro por origen (manual/oc/envio/venta · D-GR-8 consolidador)
    if (filtros.origen) {
      const origenObjetivo = filtros.origen as OrigenGasto;
      resultado = resultado.filter(g => getOrigenGasto(g) === origenObjetivo);
    }

    return resultado;
  }, [gastosPorLinea, filtros, searchTerm, arbolCategorias]);

  // chk5.A3 · gastosVisibles solo aplica orden ahora · filtrado completo lo hace FiltrosGastosBar
  // (Filtro por bloque canónico vive en filtros.bloque · tabs legacy eliminados)
  const gastosVisibles = useMemo(() => {
    const ordenado = [...gastosFiltrados];
    switch (ordenLista) {
      case 'monto_desc':
        ordenado.sort((a, b) => (b.montoPEN || 0) - (a.montoPEN || 0));
        break;
      case 'monto_asc':
        ordenado.sort((a, b) => (a.montoPEN || 0) - (b.montoPEN || 0));
        break;
      case 'proveedor':
        ordenado.sort((a, b) => (a.proveedor || '').localeCompare(b.proveedor || ''));
        break;
      case 'fecha_desc':
      default: {
        ordenado.sort((a, b) => {
          const fa = a.fecha?.toDate?.()?.getTime() ?? 0;
          const fb = b.fecha?.toDate?.()?.getTime() ?? 0;
          return fb - fa;
        });
        break;
      }
    }
    return ordenado;
  }, [gastosFiltrados, ordenLista]);

  // Calcular resumen por tipo de gasto
  const resumenPorTipo = useMemo(() => {
    const resumen: Record<string, { tipo: string; cantidad: number; total: number; porcentaje: number }> = {};
    const totalGeneral = gastosVisibles.reduce((sum, g) => sum + g.montoPEN, 0);

    gastosVisibles.forEach(gasto => {
      const tipo = gasto.tipo;
      if (!resumen[tipo]) {
        resumen[tipo] = { tipo, cantidad: 0, total: 0, porcentaje: 0 };
      }
      resumen[tipo].cantidad += 1;
      resumen[tipo].total += gasto.montoPEN;
    });

    // Calcular porcentajes y ordenar por total descendente
    const resultado = Object.values(resumen)
      .map(item => ({
        ...item,
        porcentaje: totalGeneral > 0 ? (item.total / totalGeneral) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);

    return { items: resultado, totalGeneral };
  }, [gastosVisibles]);

  // Obtener lista única de tipos para el filtro dinámico
  const tiposUnicos = useMemo(() => {
    const tipos = new Set(gastos.map(g => g.tipo));
    return Array.from(tipos).sort();
  }, [gastos]);

  const formatCurrency = (amount: number): string => formatCurrencyPEN(amount);

  // chk5.C-FIX · `getEstadoBadge` y `getTipoBadge` ELIMINADOS · eran dead code
  // (solo los usaba el `gastosColumns` legacy también eliminado).


  const handleRecalcularCTRU = async () => {
    const confirmed = await confirm({
      title: 'Recalcular CTRU Dinamico',
      message: '¿Desea recalcular el CTRU dinamico con los gastos pendientes? Esto actualizara el costo de todas las unidades disponibles.',
      confirmText: 'Recalcular',
      variant: 'warning'
    });
    if (!confirmed) return;

    try {
      const resultado = await ctruService.recalcularCTRUDinamicoSafe();
      if (resultado) {
        toast.success(
          `${resultado.unidadesActualizadas} unidades actualizadas, ${resultado.gastosAplicados} gastos aplicados. Impacto: ${formatCurrency(resultado.impactoPorUnidad)}/unidad`,
          'CTRU Recalculado'
        );
      } else {
        toast.info('Recálculo CTRU encolado (otro en ejecución)', 'CTRU');
      }

      await reloadCurrentView();
      await fetchStats();
    } catch (error: any) {
      toast.error(error.message, 'Error al recalcular CTRU');
    }
  };

  const handleEliminarGasto = async (gasto: Gasto) => {
    const confirmed = await confirm({
      title: 'Eliminar Gasto',
      message: `¿Está seguro de eliminar el gasto ${gasto.numeroGasto}? "${gasto.descripcion}"\n\nEsta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      await eliminarGasto(gasto.id);
      toast.success(`Gasto ${gasto.numeroGasto} eliminado`, 'Gasto eliminado');
    } catch (error: any) {
      toast.error(error.message, 'Error al eliminar');
    }
  };

  const handleEditarGasto = (gasto: Gasto) => {
    setGastoParaEditar(gasto);
    setShowModal(true);
  };

  const limpiarFiltros = () => {
    setFiltros({
      tipo: '',
      estado: '',
      esProrrateable: '',
      bloque: '',
      origen: '',
    });
    setSearchTerm('');
  };

  // Verificar si hay algún filtro activo
  const hayFiltrosActivos = filtros.tipo || filtros.estado || filtros.esProrrateable || filtros.bloque || filtros.origen || searchTerm.trim();

  // chk5.A15 · `getClaseBadge` eliminado · era dead post limpieza (no se renderiza
  // claseGasto en la UI canon · sustituido por el badge de bloque vía renderCategoriaBreadcrumb).

  // Label dinámico para métricas
  // chk5.C-UX-PASS · U5 · rama 'pending' eliminada del viewMode
  const getViewLabel = () => {
    if (viewMode === 'all') return 'Total General';
    return `Total ${MONTH_NAMES[selectedMonth - 1]}`;
  };

  // chk5.C-FIX · DEUDA-GASTOS-DEAD-CODE CERRADA · `gastosColumns: DataTableColumn<Gasto>[]`
  // ELIMINADO · era dead code (165 líneas) · pertenecía al DataTable legacy ya
  // reemplazado por <GastoCardCanonico> (F4 · cards apiladas canon).

  // chk5.C1 · KPI data canon para KpiStripGastos
  // CRÍTICO: estos useMemo DEBEN declararse ANTES del early return de skeleton
  // para respetar Rules of Hooks (mismo número de hooks en cada render).
  const kpiData = useMemo(() => ({
    gastoMesPEN: stats?.totalMesActual ?? 0,
    variacionPct: stats?.variacionVsMesAnterior ?? 0,
    burnRate3m: heroKpis.burnRate3m,
    porcentajeRecurrentes: heroKpis.porcentajeRecurrentes,
    vencimientos30dPEN: heroKpis.vencimientos30dPEN,
    vencimientos30dCount: heroKpis.vencimientos30dCount,
    vencimientosCriticos: heroKpis.vencimientosCriticos,
    dpoDias: heroKpis.dpoDias,
    dpoDeltaTrimestre: heroKpis.dpoDeltaTrimestre,
  }), [stats, heroKpis]);

  const miniStatsData = useMemo(() => ({
    topProveedor: heroKpis.topProveedor,
    sinClasificarCount: heroKpis.sinClasificarCount,
    proximoVencimiento: heroKpis.proximoVencimiento,
  }), [heroKpis]);

  // chk5.C2 · Ratios eficiencia cross-link a Cost Intelligence
  // Cálculos derivados de unidades (capital invertido) + ventas (ingresos)
  const ratiosEficiencia = useMemo(() => {
    // Capital invertido = costos unitarios PEN de unidades activas (no vendidas)
    const capitalInvertidoPEN = unidades
      .filter(u => u.estado !== 'vendida' && u.estado !== 'danada' && u.estado !== 'perdida')
      .reduce((s, u) => s + (u.costoUnitarioPEN || 0), 0);

    // Ingreso mes seleccionado
    const ingresoMesPEN = ventas
      .filter(v => {
        const f = (v.fechaConfirmacion ?? v.fechaCreacion)?.toDate?.();
        return f && f.getMonth() + 1 === selectedMonth && f.getFullYear() === selectedYear;
      })
      .reduce((s, v) => s + (v.totalPEN || 0), 0);

    // Ingreso mes anterior (para delta)
    const mesAnt = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const anioAnt = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    const ingresoMesAntPEN = ventas
      .filter(v => {
        const f = (v.fechaConfirmacion ?? v.fechaCreacion)?.toDate?.();
        return f && f.getMonth() + 1 === mesAnt && f.getFullYear() === anioAnt;
      })
      .reduce((s, v) => s + (v.totalPEN || 0), 0);

    // Gasto mes anterior · de stats no tenemos · usar heroKpis del mes anterior aproximado
    // (más preciso requiere fetchear · MVP usa stats.variacionVsMesAnterior para inferir)
    const gastoMesActual = stats?.totalMesActual ?? 0;
    const gastoMesAnt = stats?.variacionVsMesAnterior !== undefined && stats.variacionVsMesAnterior !== -100
      ? gastoMesActual / (1 + (stats.variacionVsMesAnterior / 100))
      : 0;

    const ratioGastoInversion = capitalInvertidoPEN > 0
      ? (gastoMesActual / capitalInvertidoPEN) * 100
      : 0;
    const ratioGastoInversionAnt = capitalInvertidoPEN > 0
      ? (gastoMesAnt / capitalInvertidoPEN) * 100
      : 0;
    const deltaGastoInversionPp = ratioGastoInversion - ratioGastoInversionAnt;

    const ratioGastoIngreso = ingresoMesPEN > 0
      ? (gastoMesActual / ingresoMesPEN) * 100
      : 0;
    const ratioGastoIngresoAnt = ingresoMesAntPEN > 0
      ? (gastoMesAnt / ingresoMesAntPEN) * 100
      : 0;
    const deltaGastoIngresoPp = ratioGastoIngreso - ratioGastoIngresoAnt;

    return {
      ratioGastoInversion,
      deltaGastoInversionPp,
      ratioGastoIngreso,
      deltaGastoIngresoPp,
      hasData: capitalInvertidoPEN > 0 || ingresoMesPEN > 0,
      // chk5.C9 · F9 · expone bases para el Allocation Engine settings panel
      ingresoMesPEN,
      capitalInvertidoPEN,
    };
  }, [unidades, ventas, stats, selectedMonth, selectedYear]);

  // chk5.C9 · F9 · overhead del mes = total gastos bloque Período (numerador)
  const overheadMesPEN = useMemo(() => {
    return heroKpis.gastosDelMes
      .filter(g => (getBloqueDelGasto(g, arbolCategorias) ?? 'periodo') === 'periodo')
      .reduce((s, g) => s + (g.montoPEN || 0), 0);
  }, [heroKpis.gastosDelMes, arbolCategorias]);

  // Mostrar skeleton durante carga inicial
  // chk5.C-FIX · este early return va DESPUÉS de TODOS los useMemo/hooks
  // para no romper Rules of Hooks (count constante de hooks por render).
  if (loading && gastos.length === 0) {
    return <GastosSkeleton />;
  }

  // ===== Hub Kit · breadcrumb leaf + adapter vistaActiva ↔ tabId (3 tabs ↔ 5 vistas) =====
  const breadcrumbLeaf =
    (vistaActiva === 'listado' || vistaActiva === 'calendario') ? 'Movimientos'
    : (vistaActiva === 'bloque' || vistaActiva === 'proveedor') ? 'Análisis'
    : null;
  const tabActiva =
    vistaActiva === 'resumen' ? 'resumen'
    : (vistaActiva === 'listado' || vistaActiva === 'calendario') ? 'movimientos'
    : 'analisis';
  const handleTabChange = (id: string) => {
    setVistaActiva(id === 'resumen' ? 'resumen' : id === 'movimientos' ? 'listado' : 'bloque');
  };
  const gastosTabs: HubTab[] = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { id: 'movimientos', label: 'Movimientos', icon: List, badge: heroKpis.gastosDelMes.length || undefined, badgeTono: 'slate' },
    { id: 'analisis', label: 'Análisis', icon: BarChart3 },
  ];

  // ===== Hub Kit · KPIs (canon mockup) · deltas semánticos preservados (color+ícono por dirección) =====
  const fmtMiles = (n: number): string => Math.round(n).toLocaleString('es-PE');
  const fmtPct = (n: number, d = 1): string => `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`;
  const variacionUp = kpiData.variacionPct > 0;
  const variacionDown = kpiData.variacionPct < 0;
  const VariacionIcon = variacionUp ? TrendingUp : variacionDown ? TrendingDown : Minus;
  const dpoMejora = kpiData.dpoDeltaTrimestre < 0;
  const DpoIcon = dpoMejora ? TrendingDown : TrendingUp;
  const gastoFixed = kpiData.gastoMesPEN.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [gastoEntero, gastoDecimales = '00'] = gastoFixed.split('.');
  const gastosKpis: HubKpi[] = [
    {
      label: 'Gasto del mes', tono: 'amber', icon: Receipt,
      valor: gastoEntero, sufijo: `.${gastoDecimales}`,
      delta: (
        <span className={`flex items-center gap-1 tabular-nums ${variacionUp ? 'text-rose-600' : variacionDown ? 'text-emerald-600' : 'text-amber-700'}`}>
          <VariacionIcon className="w-3 h-3 flex-shrink-0" />
          {variacionUp ? '+' : ''}{kpiData.variacionPct.toFixed(1)}% vs mes ant.
        </span>
      ),
    },
    { label: 'Burn rate · 3M', tono: 'rose', icon: Flame, valor: fmtMiles(kpiData.burnRate3m), delta: 'promedio móvil' },
    { label: 'Recurrentes', tono: 'indigo', icon: Repeat, valor: kpiData.porcentajeRecurrentes.toFixed(0), sufijo: '%', delta: 'fijos comprometidos' },
    {
      label: 'Vencen 30d', tono: 'rose', icon: Clock, valor: fmtMiles(kpiData.vencimientos30dPEN),
      delta: (
        <span className="tabular-nums">
          {kpiData.vencimientos30dCount} gastos
          {kpiData.vencimientosCriticos > 0 && (<> · <span className="font-bold">{kpiData.vencimientosCriticos} críticos</span></>)}
        </span>
      ),
    },
    {
      label: 'DPO · días pago', tono: 'emerald', icon: CalendarCheck,
      valor: String(kpiData.dpoDias), sufijo: 'd',
      delta: (
        <span className={`flex items-center gap-1 tabular-nums ${dpoMejora ? 'text-emerald-700' : 'text-amber-700'}`}>
          <DpoIcon className="w-3 h-3 flex-shrink-0" />
          {fmtPct(kpiData.dpoDeltaTrimestre, 0)}d vs trim.
        </span>
      ),
    },
  ];
  const gastosMiniStats: HubMiniStat[] = [
    {
      label: miniStatsData.topProveedor ? (
        <><Briefcase className="w-3 h-3 text-slate-400 flex-shrink-0" /> Top proveedor: <strong className="text-slate-900 tabular-nums">{miniStatsData.topProveedor.nombre} · {miniStatsData.topProveedor.pctDelMes.toFixed(0)}%</strong></>
      ) : (
        <span className="flex items-center gap-1 text-slate-400"><Briefcase className="w-3 h-3 flex-shrink-0" /> Top proveedor: <span className="italic">sin data</span></span>
      ),
    },
    {
      label: (
        <><AlertCircle className={`w-3 h-3 flex-shrink-0 ${miniStatsData.sinClasificarCount > 0 ? 'text-amber-500' : 'text-slate-400'}`} /> Sin clasificar: <strong className={`tabular-nums ${miniStatsData.sinClasificarCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{miniStatsData.sinClasificarCount}</strong></>
      ),
    },
    {
      label: miniStatsData.proximoVencimiento ? (
        <><Clock className="w-3 h-3 text-rose-500 flex-shrink-0" /> Próximo vto: <strong className="text-slate-900 tabular-nums">{miniStatsData.proximoVencimiento.descripcion} · en {miniStatsData.proximoVencimiento.diasParaVencer}d</strong></>
      ) : (
        <span className="flex items-center gap-1 text-slate-400"><Clock className="w-3 h-3 flex-shrink-0" /> Próximo vto: <span className="italic">sin data</span></span>
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* DS Fase 4 · shell ensamblado desde el Hub Kit (L5) · grupo Finanzas y Contabilidad = teal */}
      <HubShell>
        <HubTopBar
          grupo="finanzas-contabilidad"
          modulo="Gastos"
          leaf={breadcrumbLeaf}
          esAdmin={esAdmin}
          onModulo={() => setVistaActiva('resumen')}
        />
        <HubHeader
          grupo="finanzas-contabilidad"
          icon={Receipt}
          titulo="Gastos"
          subtitulo="Consolidador de gastos · manuales + auto-generados por OC/Envío/Venta · separación gasto/pago canon."
          acciones={[
            { label: 'Política asignación', icon: Settings, onClick: () => setShowAllocationSettings(true), tier: 'config' },
            { label: 'Ver P&L', icon: FileBarChart, onClick: () => navigate('/contabilidad'), tier: 'neutral' },
            { label: 'Exportar', icon: DownloadIcon, onClick: () => exportService.exportGastos(gastosFiltrados), tier: 'neutral', disabled: gastosVisibles.length === 0 },
            { label: 'Nuevo gasto manual', icon: Plus, onClick: () => { setGastoParaEditar(null); setShowModal(true); }, tier: 'primary' },
          ]}
        />
        {stats && (
          <HubKpiStrip cols={5} kpis={gastosKpis} miniStats={gastosMiniStats} />
        )}

      {/* chk5.E-GASTOS · F1.b · TABS de sub-sección canon HUB (Resumen · Movimientos · Análisis) */}
      <div>
        {/* HubTabs · Resumen · Movimientos · Análisis (color del grupo = teal · badge slate) */}
        <HubTabs
          grupo="finanzas-contabilidad"
          tabs={gastosTabs}
          activa={tabActiva}
          onChange={handleTabChange}
        />
        {/* sub-toolbar contextual · SOLO Movimientos/Análisis (toggles de vista) ·
            en Resumen NO se renderiza → el body arranca directo tras las tabs (consistente con hermanos) */}
        {vistaActiva !== 'resumen' && (
        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          {/* Movimientos · sub-toggle Lista / Calendario */}
          {(vistaActiva === 'listado' || vistaActiva === 'calendario') && (
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setVistaActiva('listado')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${vistaActiva === 'listado' ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300' : 'text-slate-600 hover:bg-slate-50 border border-slate-200'}`}>
                <List className="w-3.5 h-3.5" /> Lista
              </button>
              <button type="button" onClick={() => setVistaActiva('calendario')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${vistaActiva === 'calendario' ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-300' : 'text-slate-600 hover:bg-slate-50 border border-slate-200'}`}>
                <Calendar className="w-3.5 h-3.5" /> Calendario
              </button>
            </div>
          )}
          {/* Análisis · sub-toggle Por Bloque / Por Proveedor */}
          {(vistaActiva === 'bloque' || vistaActiva === 'proveedor') && (
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setVistaActiva('bloque')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${vistaActiva === 'bloque' ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-300' : 'text-slate-600 hover:bg-slate-50 border border-slate-200'}`}>
                <Package className="w-3.5 h-3.5" /> Por Bloque
              </button>
              <button type="button" onClick={() => setVistaActiva('proveedor')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${vistaActiva === 'proveedor' ? 'bg-sky-100 text-sky-800 ring-2 ring-sky-300' : 'text-slate-600 hover:bg-slate-50 border border-slate-200'}`}>
                <Factory className="w-3.5 h-3.5" /> Por Proveedor
              </button>
            </div>
          )}
          {/* Nav temporal + LineaDropdown · en Movimientos */}
          {(vistaActiva === 'listado' || vistaActiva === 'calendario') && (
            <div className="ml-auto">
              <NavegacionTemporal
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onPrevMonth={() => navigateMonth('prev')}
                onNextMonth={() => navigateMonth('next')}
                onGoToCurrentMonth={goToCurrentMonth}
                isCurrentMonth={isCurrentMonth}
                trailingSlot={<LineaDropdown />}
              />
            </div>
          )}
        </div>
        )}
      </div>

      {/* §F · BODY · Hub Kit · Layout A (main + aside) · aboveGrid = banner borrador full-width */}
      <HubBody
        aboveGrid={
          <BorradorBanner
            tipo="gasto"
            refreshKey={borradorRefreshKey}
            onContinuar={() => {
              setGastoParaEditar(null);
              setShowModal(true);
            }}
          />
        }
        aside={
          <div className="md:sticky md:top-4 space-y-3">
            {heroKpis.vencidos.length + heroKpis.vencenPronto.length > 0 && (
              <DrawerUrgentes
                vencidos={heroKpis.vencidos}
                vencenPronto={heroKpis.vencenPronto}
                onPagar={(g) => setGastoParaPago(g)}
                onVerDetalle={handleEditarGasto}
              />
            )}
            <TopProveedoresLightWidget
              gastosDelMes={heroKpis.gastosDelMes}
              onVerAnalisisCompleto={() => navigate('/maestros?tab=proveedores')}
              onClickProveedor={(nombreProveedor) => {
                setSearchTerm(nombreProveedor);
              }}
            />
          </div>
        }
      >

      {/* chk5.E-GASTOS · F1.b · Tab RESUMEN · dashboard ejecutivo del gasto del mes */}
      {vistaActiva === 'resumen' && (
        <div className="space-y-4">
          {/* estado del gasto del mes */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
              <Receipt className="w-5 h-5 text-teal-700" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-slate-900">
                Gasto de {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </div>
              <div className="text-xs text-slate-600">
                {heroKpis.gastosDelMes.length.toLocaleString('es-PE')} movimientos registrados este mes · distribución y eficiencia abajo · vencimientos y proveedores en el panel lateral.
              </div>
            </div>
          </div>

          {/* distribución por bloque (canon N1+N2) */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Distribución por bloque</div>
            {(() => {
              const montos: Record<BloqueCosto, number> = { producto: 0, venta: 0, periodo: 0 };
              for (const g of gastosPorLinea) {
                const b: BloqueCosto = getBloqueDelGasto(g, arbolCategorias) ?? 'periodo';
                montos[b] += g.montoPEN || 0;
              }
              const total = (montos.producto + montos.venta + montos.periodo) || 1;
              const cfg = [
                { b: 'producto' as BloqueCosto, label: 'Producto', Icon: Package,      wrap: 'from-blue-50 to-blue-100/40 ring-blue-200/50',     txt: 'text-blue-900',   bar: 'bg-blue-500',   barbg: 'bg-blue-100' },
                { b: 'venta' as BloqueCosto,    label: 'Venta',    Icon: ShoppingBag,   wrap: 'from-purple-50 to-purple-100/40 ring-purple-200/50', txt: 'text-purple-900', bar: 'bg-purple-500', barbg: 'bg-purple-100' },
                { b: 'periodo' as BloqueCosto,  label: 'Período',  Icon: Calendar,      wrap: 'from-amber-50 to-amber-100/40 ring-amber-200/50',   txt: 'text-amber-900',  bar: 'bg-amber-500',  barbg: 'bg-amber-100' },
              ];
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {cfg.map((c) => {
                    const CIcon = c.Icon;
                    const pct = Math.round((montos[c.b] / total) * 100);
                    return (
                      <div key={c.b} className={`bg-gradient-to-br ${c.wrap} ring-1 rounded-xl p-3.5`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <CIcon className={`w-4 h-4 ${c.txt}`} />
                          <span className={`text-[12px] font-bold ${c.txt}`}>{c.label}</span>
                        </div>
                        <div className={`text-xl font-bold tabular-nums ${c.txt}`}>{formatCurrency(montos[c.b])}</div>
                        <div className={`h-1.5 ${c.barbg} rounded-full mt-2 overflow-hidden`}>
                          <div className={`h-full ${c.bar}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">{pct}% del mes</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* eficiencia cross-link (canon N8 · siempre visible) */}
          <LinkCardEficiencia
            ratioGastoInversion={ratiosEficiencia.ratioGastoInversion}
            deltaGastoInversionPp={ratiosEficiencia.deltaGastoInversionPp}
            ratioGastoIngreso={ratiosEficiencia.ratioGastoIngreso}
            deltaGastoIngresoPp={ratiosEficiencia.deltaGastoIngresoPp}
            onVerEvolucion={() => navigate('/intel-productos/costos')}
            hasData={ratiosEficiencia.hasData}
          />
        </div>
      )}

      {/* Vistas alternativas · canon v8.0 · cada una dentro del main del grid */}
      {vistaActiva === 'bloque' && (
        <VistaPorBloque
          gastos={gastosPorLinea}
          arbolCategorias={arbolCategorias}
          onEditar={handleEditarGasto}
          onPagar={(g) => setGastoParaPago(g)}
        />
      )}

      {vistaActiva === 'calendario' && (
        <VistaCalendario
          gastos={gastosPorLinea}
          arbolCategorias={arbolCategorias}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onChangeMes={(year, month) => {
            setSelectedYear(year);
            setSelectedMonth(month);
          }}
          onEditar={handleEditarGasto}
          onPagar={(g) => setGastoParaPago(g)}
        />
      )}

      {vistaActiva === 'proveedor' && (
        <VistaPorProveedor
          gastos={gastosPorLinea}
          arbolCategorias={arbolCategorias}
          onEditar={handleEditarGasto}
          onPagar={(g) => setGastoParaPago(g)}
        />
      )}

      {/* Vista Listado · contenido completo (KPIs + LinkCard + Filtros + Lista) */}
      {vistaActiva === 'listado' && (<>

      {/* chk5.E-GASTOS · ELIMINADOS de la tab Movimientos (2026-05-30 · solución integral 360):
          - BannerImpactoPlanilla · REDUNDANTE: planilla.service.pagarBoleta ya crea gastos
            'nomina'/'comision_vendedor' vía gastoService.create → el costo laboral YA figura
            en esta lista de movimientos + en distribución por bloque (Resumen/Análisis) + P&L.
            El banner sólo duplicaba el agregado de algo ya desglosado abajo.
          - LinkCardEficiencia · DUPLICADO: ya vive en la tab Resumen (canon hub · los cross-links
            contextuales van en Resumen, no en la lista operativa de Movimientos).
          Resultado: Movimientos = filtros + lista, enfocado en operar registros individuales. */}

      {/* chk5.C-FIX · DEUDA-GASTOS-DEAD-CODE CERRADA · ELIMINADOS 2 bloques legacy:
          - 5 KPI cards con gradientes pesados + emojis 💰⏰📊👑🏭 (~110 líneas)
            → reemplazados por <KpiStripGastos> canon (chk5.C1 · F1)
          - 3 insights banners ⚠⏰✓📈📉💡 (~70 líneas)
            → info absorbida en KpiStripGastos (deltas TrendingUp/Down) + DrawerUrgentes + mini-stats */}


      {/* chk5.A3 · ELIMINADO bloque "Tabs de Categoría" legacy
          (Gastos del Negocio / Costos de Importación / Pérdidas)
          Razón: filtraban por g.tipo legacy (flete_internacional · merma_*) que viene
          de la deprecated CategoriaGasto = 'GV/GD/GA/GO'. El filtrado canónico ahora
          se hace via FiltrosGastosBar.bloque (modelo 3 niveles producto/venta/periodo).
          Si se necesita filtrar específicamente por "Pérdidas de Inventario" eso ya
          existe en filtros.tipo (subcategoría) o se puede buscar por categoriaCostoId */}

      {/* Resumen por Tipo de Gasto */}
      {resumenPorTipo.items.length > 0 && (
        <Card padding="md">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4 sm:h-5 sm:w-5 text-teal-500" />
                <span className="text-sm sm:text-base font-medium text-slate-900">Distribución por Tipo</span>
              </div>
              <span className="text-xs sm:text-sm text-slate-500">
                Total: {formatCurrency(resumenPorTipo.totalGeneral)}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
              {resumenPorTipo.items.map((item, index) => {
                // Colores para las barras de progreso
                const colores = [
                  'bg-teal-500',
                  'bg-emerald-500',
                  'bg-amber-500',
                  'bg-info-500',
                  'bg-purple-500',
                  'bg-pink-500',
                  'bg-orange-500',
                  'bg-teal-500'
                ];
                const colorBarra = colores[index % colores.length];

                return (
                  <div
                    key={item.tipo}
                    className="bg-slate-50 rounded-lg p-2 sm:p-3 border border-slate-100 hover:border-teal-200 transition-colors cursor-pointer"
                    onClick={() => setFiltros({ ...filtros, tipo: item.tipo as TipoGasto })}
                  >
                    <div className="flex items-center justify-between mb-1 sm:mb-2">
                      <span className="text-xs sm:text-sm font-medium text-slate-900 truncate" title={item.tipo}>
                        {item.tipo}
                      </span>
                      <span className="text-[10px] sm:text-xs text-slate-500 ml-1 flex-shrink-0">
                        {item.cantidad}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm sm:text-lg font-semibold text-slate-900 truncate">
                        {formatCurrency(item.total)}
                      </span>
                      <span className="text-[10px] sm:text-sm font-medium text-slate-600 ml-1 flex-shrink-0">
                        {item.porcentaje.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 sm:h-2">
                      <div
                        className={`${colorBarra} h-1.5 sm:h-2 rounded-full transition-all`}
                        style={{ width: `${Math.min(item.porcentaje, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Filtro de línea de negocio */}

      {/* TAREA-GASTOS-PAGE-V2 F2 · FiltrosGastosBar canonico (patron 6a referencia · S58e)
          chk5.C3 · agregado filtro Origen (manual/oc/envio/venta · D-GR-8) */}
      <FiltrosGastosBar
        estadoActivo={filtros.estado}
        bloqueActivo={filtros.bloque}
        origenActivo={filtros.origen}
        searchTerm={searchTerm}
        orden={ordenLista}
        totalResultados={gastosVisibles.length}
        totalMontoPEN={gastosVisibles.reduce((acc, g) => acc + (g.montoPEN || 0), 0)}
        conteosEstado={gastosPorLinea.reduce<Partial<Record<EstadoGasto, number>>>((acc, g) => {
          const e = g.estado as EstadoGasto;
          acc[e] = (acc[e] || 0) + 1;
          return acc;
        }, {})}
        conteosBloque={(() => {
          const conteos: Partial<Record<BloqueCosto, number>> = { producto: 0, venta: 0, periodo: 0 };
          for (const g of gastosPorLinea) {
            // chk5.A12 · canon · resolución unificada vía utility
            const bloque: BloqueCosto = getBloqueDelGasto(g, arbolCategorias) ?? 'periodo';
            conteos[bloque] = (conteos[bloque] || 0) + 1;
          }
          return conteos;
        })()}
        conteosOrigen={(() => {
          // chk5.C3 · conteo por origen para chips del FiltrosBar
          const conteos: Partial<Record<OrigenGasto, number>> = { manual: 0, oc: 0, envio: 0, venta: 0 };
          for (const g of gastosPorLinea) {
            const o = getOrigenGasto(g);
            conteos[o] = (conteos[o] || 0) + 1;
          }
          return conteos;
        })()}
        hayFiltrosActivos={!!hayFiltrosActivos}
        onCambiarEstado={(estado) => setFiltros((f) => ({ ...f, estado }))}
        onCambiarBloque={(bloque) => setFiltros((f) => ({ ...f, bloque }))}
        onCambiarOrigen={(origen) => setFiltros((f) => ({ ...f, origen }))}
        onCambiarSearchTerm={setSearchTerm}
        onCambiarOrden={setOrdenLista}
        onLimpiarTodo={limpiarFiltros}
      />

      {/* TAREA-GASTOS-PAGE-V2 F4.a · Toolbar de acciones masivas (multi-select) */}
      {!loading && gastosVisibles.length > 0 && (
        <div className={`rounded-xl border-2 transition-all ${
          bulkMode
            ? seleccionStats.count > 0
              ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-200'
              : 'bg-amber-50 border-amber-200'
            : 'bg-white border-slate-200'
        }`}>
          <div className="px-4 py-2.5 flex flex-wrap items-center gap-3 text-sm">
            {!bulkMode ? (
              <button
                type="button"
                onClick={() => setBulkMode(true)}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1.5"
              >
                ☑ Activar selección múltiple
              </button>
            ) : (
              <>
                <span className="text-xs uppercase tracking-wider text-amber-900 font-bold">Selección:</span>
                {seleccionStats.count > 0 ? (
                  <>
                    <span className="text-sm font-bold text-amber-900 tabular-nums">
                      {seleccionStats.count} gasto{seleccionStats.count > 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-amber-700 tabular-nums">
                      · {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(seleccionStats.total)} total
                      {seleccionStats.pendientes > 0 && (
                        <> · {seleccionStats.pendientes} pendientes</>
                      )}
                    </span>
                    <div className="ml-auto flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectAllVisibles}
                        className="text-[11px] text-amber-700 hover:text-amber-900 font-medium px-2 py-1 hover:bg-white/60 rounded"
                      >
                        Todos visibles ({gastosVisibles.length})
                      </button>
                      <button
                        type="button"
                        onClick={handleClearSeleccion}
                        className="text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-1 hover:bg-white/60 rounded"
                      >
                        Limpiar
                      </button>
                      <div className="w-px h-5 bg-amber-300 mx-1"></div>
                      <button
                        type="button"
                        onClick={handleBulkExport}
                        className="text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg shadow-sm"
                      >
                        📥 Exportar
                      </button>
                      <button
                        type="button"
                        onClick={handleBulkEliminar}
                        className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg shadow-sm"
                      >
                        🗑 Eliminar
                      </button>
                      <button
                        type="button"
                        onClick={handleSalirBulkMode}
                        className="text-xs font-medium text-amber-700 hover:text-amber-900 px-2 py-1 hover:bg-white/60 rounded"
                      >
                        ✕ Salir
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-amber-700 italic">Marca los gastos que quieres procesar en masa</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectAllVisibles}
                        className="text-[11px] text-amber-700 hover:text-amber-900 font-medium px-2 py-1 hover:bg-white/60 rounded"
                      >
                        Todos visibles ({gastosVisibles.length})
                      </button>
                      <button
                        type="button"
                        onClick={handleSalirBulkMode}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 hover:bg-white/60 rounded"
                      >
                        ✕ Salir del modo selección
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* chk5.C-UX-PASS · grid main+sidebar ya abierto arriba (línea 843)
          aquí solo continúa con FiltrosBar + listado dentro del mismo main */}

      {/* Tabla de Gastos */}
      <Card padding="md">
        {loading ? (
          /* F3.a · Skeleton unificado para card canonico */
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="border border-slate-200 rounded-lg px-4 py-3 flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 bg-slate-200 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/5 bg-slate-200 rounded" />
                  <div className="h-2.5 w-2/5 bg-slate-100 rounded" />
                </div>
                <div className="h-4 w-20 bg-slate-200 rounded flex-shrink-0" />
                <div className="h-5 w-24 bg-slate-200 rounded flex-shrink-0 hidden sm:block" />
              </div>
            ))}
          </div>
        ) : gastosVisibles.length === 0 ? (
          /* TAREA-GASTOS-PAGE-V2 F4.c · Empty state segun contexto
             chk5.C-UX-PASS · U5 · rama 'pending' eliminada · usa chip Estado del FiltrosBar */
          hayFiltrosActivos ? (
            <EmptyStateAction
              title="No se encontraron gastos"
              description="Prueba con otros filtros o limpia los filtros actuales"
              variant="no-results"
              icon="search"
              actionLabel="Limpiar Filtros"
              onAction={limpiarFiltros}
            />
          ) : gastos.length === 0 ? (
            /* chk5.C10 · F10 · Onboarding canon · pixel-perfect mockup
               `gastos-rework-v3-final.html · Sección 7 · empty state honesto`.
               Cero emojis · 3 quick-starts canon (Alquiler/Sueldo/SaaS) ·
               checklist activación + CTA "Ver módulo Compras" cross-link. */
            /* chk5.E-GASTOS · empty state SIN borde/fondo propio · ya vive dentro del Card
               contenedor (evita recuadro-dentro-de-recuadro · solución integral 360) */
            <div className="py-8">
              <div className="max-w-lg mx-auto text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 ring-1 ring-teal-200/50 flex items-center justify-center mx-auto mb-4">
                  <Receipt className="w-10 h-10 text-teal-700" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">Sin gastos registrados</h2>
                <p className="text-sm text-slate-600 mb-6 leading-relaxed max-w-md mx-auto">
                  Gastos consolida los movimientos manuales que registrés acá +
                  los gastos auto-generados por OCs, Envíos y Ventas. Empezá por registrar
                  tus primeros gastos fijos para activar el módulo.
                </p>

                {/* 3 quick-starts canon */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="bg-white border border-slate-200 rounded-lg p-3 hover:border-teal-300 hover:bg-teal-50/30 text-left transition-colors"
                  >
                    <Building className="w-4 h-4 text-amber-600 mb-1.5" />
                    <div className="text-[11px] font-bold text-slate-900">Alquiler mensual</div>
                    <div className="text-[10px] text-slate-500">Período · recurrente</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="bg-white border border-slate-200 rounded-lg p-3 hover:border-teal-300 hover:bg-teal-50/30 text-left transition-colors"
                  >
                    <UserIcon className="w-4 h-4 text-teal-600 mb-1.5" />
                    <div className="text-[11px] font-bold text-slate-900">Sueldo empleado</div>
                    <div className="text-[10px] text-slate-500">Período · recurrente</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="bg-white border border-slate-200 rounded-lg p-3 hover:border-teal-300 hover:bg-teal-50/30 text-left transition-colors"
                  >
                    <Cloud className="w-4 h-4 text-sky-600 mb-1.5" />
                    <div className="text-[11px] font-bold text-slate-900">Suscripción SaaS</div>
                    <div className="text-[10px] text-slate-500">Período · USD</div>
                  </button>
                </div>

                {/* Checklist activación · canon F8 lucide */}
                <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3 mb-6 text-left">
                  <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2">
                    Para activar el módulo completo:
                  </div>
                  <ul className="space-y-1 text-[11px] text-slate-700">
                    <li className="flex items-start gap-1.5">
                      {arbolCategorias && Object.keys(arbolCategorias).length > 0 ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <span className="font-bold text-amber-700 tabular-nums w-3.5 text-center">0.</span>
                      )}
                      <span>Categorías canon seeded (64 disponibles)</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold text-amber-700 tabular-nums w-3.5 text-center mt-0.5">1.</span>
                      <span>≥3 gastos manuales (baseline operativo)</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold text-amber-700 tabular-nums w-3.5 text-center mt-0.5">2.</span>
                      <span>≥1 OC cerrada que genere gastos auto</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold text-amber-700 tabular-nums w-3.5 text-center mt-0.5">3.</span>
                      <span>≥1 venta cerrada que genere gastos auto</span>
                    </li>
                  </ul>
                </div>

                {/* CTAs: primary + cross-link a Compras */}
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Registrar primer gasto
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/compras')}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    Ver módulo Compras
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <EmptyStateAction
              title="No hay gastos registrados"
              description={
                viewMode === 'month'
                  ? `No hay gastos en ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
                  : 'Comienza registrando un nuevo gasto operativo'
              }
              variant="no-data"
              icon="file"
              actionLabel="Nuevo Gasto"
              onAction={() => setShowModal(true)}
            />
          )
        ) : (
          <>
            {/* TAREA-GASTOS-PAGE-V2 F3.a · Lista unificada de GastoCardCanonico (responsive) */}
            <div className="space-y-1.5 divide-y divide-slate-100">
              {gastosVisibles.map((gasto) => (
                <GastoCardCanonico
                  key={gasto.id}
                  gasto={gasto}
                  breadcrumb={resolveBreadcrumb(gasto.categoriaCostoId)}
                  onEditar={handleEditarGasto}
                  onPagar={(g) => setGastoParaPago(g)}
                  /* chk5.C4 · D-GR-8 · CTA al doc origen (OC/Envío/Venta).
                     Las listas son modal-based · pasamos query ?highlight=ID
                     para que el módulo destino pueda abrir el detalle. */
                  onVerDocOrigen={(g, origen) => {
                    if (origen === 'oc' && g.ordenCompraId) {
                      navigate(`/compras?highlight=${g.ordenCompraId}`);
                    } else if (origen === 'envio' && (g as any).envioId) {
                      navigate(`/envios?highlight=${(g as any).envioId}`);
                    } else if (origen === 'venta' && g.ventaId) {
                      navigate(`/ventas?highlight=${g.ventaId}`);
                    }
                  }}
                  mostrarCheckbox={bulkMode}
                  seleccionado={seleccionados.has(gasto.id)}
                  onToggleSeleccion={handleToggleSeleccion}
                />
              ))}
            </div>
          </>
        )}
        {/* /F3.a · cierra la sección de listado */}

        {!loading && gastosVisibles.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200">
            <ListSummary
              filteredCount={gastosVisibles.length}
              totalCount={gastosPorLinea.length}
              itemLabel="gastos"
              summaryItems={[
                {
                  label: 'Total',
                  value: formatCurrency(resumenPorTipo.totalGeneral),
                  icon: 'money',
                  variant: 'default'
                },
                {
                  label: 'Pendientes',
                  value: gastosFiltrados.filter(g => g.estado === 'pendiente' || g.estado === 'parcial').length,
                  icon: 'file',
                  variant: 'warning'
                }
              ]}
            />
          </div>
        )}
      </Card>

      {/* chk5.C-UX-PASS-ALT · cierre del wrap vistaActiva === 'listado'
          el sidebar SIGUE abajo · persiste en las 4 vistas */}
      </>)}

      </HubBody>
    </HubShell>

      {/* chk5.C9 · F9 · Allocation Engine settings panel · D-GR-7 */}
      {showAllocationSettings && (
        <AllocationEngineSettings
          onClose={() => setShowAllocationSettings(false)}
          onVerImpactoEnProductos={() => {
            setShowAllocationSettings(false);
            navigate('/intel-productos/costos');
          }}
          overheadMesPEN={overheadMesPEN}
          ingresoBasePEN={ratiosEficiencia.ingresoMesPEN}
        />
      )}

      {/* Modal Formulario Nuevo/Editar Gasto */}
      {showModal && (
        <GastoForm
          gastoEditar={gastoParaEditar}
          onClose={() => {
            setShowModal(false);
            setGastoParaEditar(null);
            // chk5.C-FIX · canon F-Borradores · refresca el banner page-level
            // (puede haberse guardado un borrador nuevo o eliminado uno existente)
            setBorradorRefreshKey((k) => k + 1);
          }}
        />
      )}

      {/* Modal Formulario Pago de Gasto (Unificado) */}
      {showPagoModal && gastoParaPago && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <PagoUnificadoForm
              origen="gasto"
              titulo={`Pago ${gastoParaPago.numeroGasto}: ${gastoParaPago.descripcion}`}
              montoTotal={gastoParaPago.montoPEN}
              montoPendiente={gastoParaPago.montoPendiente ?? gastoParaPago.montoPEN}
              monedaOriginal={gastoParaPago.moneda as 'PEN' | 'USD'}
              tcDocumento={gastoParaPago.tipoCambio}
              pagosAnteriores={(gastoParaPago.pagos || []).map(p => ({
                id: p.id,
                fecha: p.fecha?.toDate?.() || new Date(),
                monto: p.montoPEN,
                moneda: 'PEN',
                metodo: p.metodoPago,
                referencia: p.referencia,
              }))}
              onSubmit={async (datos: PagoUnificadoResult) => {
                if (!user) return;
                await registrarPagoGasto(gastoParaPago.id, {
                  fechaPago: datos.fechaPago,
                  monedaPago: datos.monedaPago,
                  montoPago: datos.montoOriginal,
                  tipoCambio: datos.tipoCambio,
                  metodoPago: datos.metodoPago,
                  cuentaOrigenId: datos.cuentaOrigenId,
                  referenciaPago: datos.referencia,
                  notas: datos.notas,
                }, user.uid);
                toast.success('Pago registrado exitosamente');
                setShowPagoModal(false);
                setGastoParaPago(null);
                reloadCurrentView();
                fetchStats();
              }}
              onCancel={() => {
                setShowPagoModal(false);
                setGastoParaPago(null);
              }}
            />
          </div>
        </div>
      )}

      {/* chk5.C11 · F11 · Panel "Integraciones · 7 atajos" ELIMINADO.
          Motivación: D-GR-8 (no overlap entre módulos) + canon F8 (cero
          emojis) + el panel era 100% redundante con la navegación cross-módulo
          que ahora vive integrada en componentes canon:
            - Tesorería:    se navega vía PagoUnificadoForm (separación gasto/pago F7)
            - Maestros:     TopProveedoresLightWidget · CTA "Ver análisis completo →" (F5)
            - Red Log:      mismo Maestros tab=proveedores
            - Envíos:       chip origen "Envío" en GastoCardCanonico (F4)
            - Ventas:       chip origen "Venta" en GastoCardCanonico (F4)
            - Planilla:     fuera de canon Gastos · pertenece a su propio módulo
            - BI / P&L:     HeaderGastos · botón "Ver P&L" → /contabilidad (F1) */}

      {/* chk5.C-UX-PASS-ALT · wrap vistaActiva === 'listado' YA CERRADO arriba
          (junto al cierre del Card de lista de gastos) · sidebar persiste en las 4 vistas */}

      {/* Dialogo de Confirmacion */}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};
