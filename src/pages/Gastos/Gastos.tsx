import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { formatFecha } from '../../utils/dateFormatters';
import { formatCurrencyPEN } from '../../utils/format';
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Plus, Filter, Download, PieChart, CreditCard, Wallet, ChevronLeft, ChevronRight, Calendar, List, Pencil, Trash2, Receipt } from 'lucide-react';
import { Card, Badge, Button, Select, SearchInput, useConfirmDialog, ConfirmDialog, ListSummary, EmptyStateAction, GastosSkeleton, GastoLineaBadge } from '../../components/common';
import { LineaDropdown } from '../../components/common/LineaDropdown';
import { PageShell, PageHeader, Toolbar, FilterDrawer, FilterSection, DataTable } from '../../design-system';
import type { DataTableColumn } from '../../design-system';
import { useToastStore } from '../../store/toastStore';
import { useGastoStore } from '../../store/gastoStore';
import { useAuthStore } from '../../store/authStore';
import { ctruService } from '../../services/ctru.service';
import { GastoForm } from './GastoForm';
import { PagoUnificadoForm } from '../../components/modules/pagos/PagoUnificadoForm';
import type { PagoUnificadoResult } from '../../components/modules/pagos/PagoUnificadoForm';
import { exportService } from '../../services/export.service';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import { CATEGORIAS_GASTO, type Gasto, type TipoGasto, type CategoriaGasto, type EstadoGasto, type ClaseGasto } from '../../types/gasto.types';
import { useCategoriaCostoStore } from '../../store/categoriaCostoStore';
import type { BloqueCosto } from '../../types/categoriaCosto.types';
import { FiltrosGastosBar, type OrdenGasto } from './components/FiltrosGastosBar';
import { GastoCardCanonico } from './components/GastoCardCanonico';
import { DrawerUrgentes } from './components/DrawerUrgentes';
import { ReportesGastosBI } from './components/ReportesGastosBI';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

type ViewMode = 'month' | 'all' | 'pending';

export const Gastos: React.FC = () => {
  const { user } = useAuthStore();
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
    claseGasto: '' as ClaseGasto | '',
    tipo: '' as TipoGasto | '',
    categoria: '' as CategoriaGasto | '',
    estado: '' as EstadoGasto | '',
    esProrrateable: '' as 'true' | 'false' | '',
    bloque: '' as BloqueCosto | '', // F2 · filtro por bloque del modelo de 3 niveles
  });
  const [tabActiva, setTabActiva] = useState<'negocio' | 'importacion' | 'perdidas'>('negocio');

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
  // PROVEEDOR-GASTOS F4 · toggle de vista (listado vs reportes BI)
  const [vistaActiva, setVistaActiva] = useState<'listado' | 'reportes'>('listado');

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

  // Helper · resuelve un categoriaCostoId al breadcrumb (bloque > padre > sub)
  const resolveBreadcrumb = (categoriaCostoId?: string): { bloque: BloqueCosto; padre: string; sub?: string } | null => {
    if (!categoriaCostoId || !arbolCategorias) return null;
    for (const bloque of ['importacion', 'venta', 'periodo'] as BloqueCosto[]) {
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

  // Componente helper · breadcrumb pills si hay categoriaCostoId, fallback al pill legacy
  const renderCategoriaBreadcrumb = (gasto: Gasto, size: 'sm' | 'xs' = 'xs') => {
    const bc = resolveBreadcrumb(gasto.categoriaCostoId);
    const sizeClasses = size === 'sm' ? 'text-xs' : 'text-[10px]';
    if (!bc) {
      // Fallback legacy
      return (
        <span className={`${sizeClasses} px-1.5 py-0.5 rounded font-medium ${getCategoriaColor(gasto.categoria)}`}>
          {gasto.categoria}
        </span>
      );
    }
    const bloqueColors = bc.bloque === 'importacion'
      ? 'bg-blue-100 text-blue-800'
      : bc.bloque === 'venta'
        ? 'bg-purple-100 text-purple-800'
        : 'bg-amber-100 text-amber-800';
    const bloqueLabel = bc.bloque === 'importacion' ? '📦' : bc.bloque === 'venta' ? '🛒' : '📅';
    return (
      <span className={`${sizeClasses} inline-flex items-center gap-1`}>
        <span className={`px-1.5 py-0.5 rounded font-medium ${bloqueColors}`}>{bloqueLabel}</span>
        <span className="text-slate-300">›</span>
        <span className="text-slate-700 font-medium truncate">{bc.padre}</span>
        {bc.sub && (
          <>
            <span className="text-slate-300">›</span>
            <span className="text-slate-500 truncate">{bc.sub}</span>
          </>
        )}
      </span>
    );
  };

  const isCurrentMonth = selectedMonth === new Date().getMonth() + 1 && selectedYear === new Date().getFullYear();

  // ── TAREA-GASTOS-PAGE-V2 F1 · Hero ejecutivo · KPIs derivados ──
  // Calcula mix por bloque · top categoria · proveedores · vencimientos
  // a partir de los gastos cargados en el mes actual.
  const heroKpis = useMemo(() => {
    const gastosDelMes = gastosPorLinea.filter(g => {
      const fecha = g.fecha?.toDate?.() ?? new Date(g.fecha as any);
      return fecha.getMonth() + 1 === selectedMonth && fecha.getFullYear() === selectedYear;
    });

    // Mix por bloque (resolviendo via arbolCategorias)
    const mixPorBloque: Record<BloqueCosto, number> = {
      importacion: 0, venta: 0, periodo: 0,
    };
    const bloqueDeGasto = (g: Gasto): BloqueCosto => {
      // Si tiene categoriaCostoId, resolver desde arbol
      if (g.categoriaCostoId && arbolCategorias) {
        for (const b of ['importacion', 'venta', 'periodo'] as BloqueCosto[]) {
          const datos = arbolCategorias[b];
          if (!datos) continue;
          if (datos.padres.some(p => p.id === g.categoriaCostoId)) return b;
          for (const padreId of Object.keys(datos.hijos)) {
            if (datos.hijos[padreId].some(h => h.id === g.categoriaCostoId)) return b;
          }
        }
      }
      // Fallback legacy
      if (g.categoria === 'GA') return 'importacion';
      if (g.categoria === 'GD' || g.categoria === 'GV') return 'venta';
      return 'periodo';
    };
    for (const g of gastosDelMes) {
      mixPorBloque[bloqueDeGasto(g)] += g.montoPEN || 0;
    }
    const totalMix = mixPorBloque.importacion + mixPorBloque.venta + mixPorBloque.periodo;

    // Top categoria padre (por monto)
    const porCategoria: Record<string, { nombre: string; monto: number; bloque: BloqueCosto }> = {};
    for (const g of gastosDelMes) {
      let nombre = 'Sin categorizar';
      let bloque: BloqueCosto = bloqueDeGasto(g);
      if (g.categoriaCostoId && arbolCategorias) {
        for (const b of ['importacion', 'venta', 'periodo'] as BloqueCosto[]) {
          const datos = arbolCategorias[b];
          if (!datos) continue;
          const padre = datos.padres.find(p => p.id === g.categoriaCostoId);
          if (padre) { nombre = padre.nombre; bloque = b; break; }
          for (const padreId of Object.keys(datos.hijos)) {
            if (datos.hijos[padreId].some(h => h.id === g.categoriaCostoId)) {
              const padreDeHijo = datos.padres.find(p => p.id === padreId);
              nombre = padreDeHijo?.nombre || 'Categoria'; bloque = b; break;
            }
          }
        }
      }
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
        const f = g.fecha?.toDate?.() ?? new Date(g.fecha as any);
        return f >= hoy && f <= en7d;
      })
      .sort((a, b) => {
        const fa = a.fecha?.toDate?.() ?? new Date(a.fecha as any);
        const fb = b.fecha?.toDate?.() ?? new Date(b.fecha as any);
        return fa.getTime() - fb.getTime();
      });
    const vencidos = gastosPorLinea
      .filter(g => g.estado === 'pendiente' || g.estado === 'parcial')
      .filter(g => {
        const f = g.fecha?.toDate?.() ?? new Date(g.fecha as any);
        return f < hoy;
      });

    return {
      mixPorBloque, totalMix,
      topCategoria, segundaCategoria, totalCategorias: topCategorias.length,
      proveedoresUnicos: proveedoresUnicos.size,
      vencenPronto, vencidos,
      gastosDelMes,
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
  useEffect(() => {
    storeSetViewMode(viewMode, selectedMonth, selectedYear);
    if (viewMode === 'all') {
      fetchGastos();
    } else if (viewMode === 'pending') {
      fetchGastosPendientesYParciales();
    } else {
      fetchGastosMes(selectedMonth, selectedYear);
    }
    fetchStats();
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

    if (filtros.claseGasto) {
      resultado = resultado.filter(g => g.claseGasto === filtros.claseGasto);
    }
    if (filtros.tipo) {
      resultado = resultado.filter(g => g.tipo === filtros.tipo);
    }
    if (filtros.categoria) {
      resultado = resultado.filter(g => g.categoria === filtros.categoria);
    }
    if (filtros.estado) {
      resultado = resultado.filter(g => g.estado === filtros.estado);
    }
    if (filtros.esProrrateable) {
      resultado = resultado.filter(g => g.esProrrateable === (filtros.esProrrateable === 'true'));
    }
    // F2 · filtro por bloque (resuelve via arbolCategorias o fallback legacy)
    if (filtros.bloque) {
      resultado = resultado.filter(g => {
        if (g.categoriaCostoId && arbolCategorias) {
          const datos = arbolCategorias[filtros.bloque as BloqueCosto];
          if (!datos) return false;
          if (datos.padres.some(p => p.id === g.categoriaCostoId)) return true;
          for (const padreId of Object.keys(datos.hijos)) {
            if (datos.hijos[padreId].some(h => h.id === g.categoriaCostoId)) return true;
          }
          return false;
        }
        // Fallback legacy
        if (filtros.bloque === 'importacion') return g.categoria === 'GA';
        if (filtros.bloque === 'venta') return g.categoria === 'GD' || g.categoria === 'GV';
        return g.categoria === 'GO';
      });
    }

    return resultado;
  }, [gastosPorLinea, filtros, searchTerm, arbolCategorias]);

  // Aplicar filtro de tab activa sobre los gastos filtrados
  const TIPOS_IMPORTACION = ['flete_internacional', 'flete_usa_peru', 'almacenaje', 'internacion', 'recojo_local'];
  const TIPOS_PERDIDAS = ['merma_transferencia', 'merma_vencimiento', 'desmedro'];

  const gastosVisibles = useMemo(() => {
    let resultado: Gasto[];
    if (tabActiva === 'importacion') {
      resultado = gastosFiltrados.filter(g => TIPOS_IMPORTACION.includes(g.tipo));
    } else if (tabActiva === 'perdidas') {
      resultado = gastosFiltrados.filter(g => TIPOS_PERDIDAS.includes(g.tipo));
    } else {
      // negocio: excluir importación y pérdidas
      resultado = gastosFiltrados.filter(g =>
        !TIPOS_IMPORTACION.includes(g.tipo) && !TIPOS_PERDIDAS.includes(g.tipo)
      );
    }
    // F2 · aplicar orden seleccionado en FiltrosGastosBar
    const ordenado = [...resultado];
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
  }, [gastosFiltrados, tabActiva, ordenLista]);

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


  const getEstadoBadge = (estado: EstadoGasto) => {
    const badges = {
      'pendiente': { variant: 'warning' as const, label: 'Pendiente' },
      'parcial': { variant: 'info' as const, label: 'Parcial' },
      'pagado': { variant: 'success' as const, label: 'Pagado' },
      'cancelado': { variant: 'danger' as const, label: 'Cancelado' }
    };
    return badges[estado] || { variant: 'default' as const, label: 'Desconocido' };
  };

  const getTipoBadge = (tipo: TipoGasto) => {
    return { variant: 'default' as const, label: tipo };
  };

  // Colores para las categorías
  const getCategoriaColor = (cat: CategoriaGasto | undefined): string => {
    if (!cat) return 'bg-slate-100 text-slate-700';
    const colors: Record<CategoriaGasto, string> = {
      GV: 'bg-purple-100 text-purple-700',
      GD: 'bg-sky-100 text-sky-700',
      GA: 'bg-amber-100 text-amber-700',
      GO: 'bg-emerald-100 text-emerald-700'
    };
    return colors[cat] || 'bg-slate-100 text-slate-700';
  };

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
      claseGasto: '',
      tipo: '',
      categoria: '',
      estado: '',
      esProrrateable: '',
      bloque: '',
    });
    setSearchTerm('');
  };

  // Verificar si hay algún filtro activo
  const hayFiltrosActivos = filtros.claseGasto || filtros.tipo || filtros.categoria || filtros.estado || filtros.esProrrateable || filtros.bloque || searchTerm.trim();

  // Obtener badge para clase de gasto
  const getClaseBadge = (clase: ClaseGasto | undefined) => {
    if (!clase) {
      return { label: 'GAO', color: 'bg-slate-100 text-slate-700' };
    }
    if (clase === 'GVD') {
      return { label: 'GVD', color: 'bg-purple-100 text-purple-700' };
    }
    return { label: 'GAO', color: 'bg-sky-100 text-sky-700' };
  };

  // Label dinámico para métricas
  const getViewLabel = () => {
    if (viewMode === 'all') return 'Total General';
    if (viewMode === 'pending') return 'Total Pendiente';
    return `Total ${MONTH_NAMES[selectedMonth - 1]}`;
  };

  // Columnas del DataTable (desktop)
  const gastosColumns: DataTableColumn<Gasto>[] = [
    {
      key: 'numero',
      header: 'Número',
      render: (gasto) => {
        const claseBadge = getClaseBadge(gasto.claseGasto);
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${claseBadge.color}`}>
                {claseBadge.label}
              </span>
              <span className="text-sm font-medium text-slate-900">
                {gasto.numeroGasto}
              </span>
            </div>
            {gasto.ventaId && (
              <div className="text-xs text-purple-600 mt-0.5">
                → Venta vinculada
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      render: (gasto) => (
        <div>
          <div className="text-sm text-slate-900">{gasto.descripcion}</div>
          {gasto.proveedor && (
            <div className="text-xs text-slate-500">{gasto.proveedor}</div>
          )}
        </div>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo / Categoría',
      render: (gasto) => (
        <div className="space-y-1">
          <div className="text-sm font-medium text-slate-900">{gasto.tipo}</div>
          <div className="flex items-center gap-1">
            {renderCategoriaBreadcrumb(gasto, 'sm')}
          </div>
        </div>
      ),
    },
    {
      key: 'monto',
      header: 'Monto',
      align: 'right',
      render: (gasto) => (
        <div>
          <div className="text-sm font-medium text-slate-900">
            {formatCurrency(gasto.montoPEN)}
          </div>
          {gasto.moneda === 'USD' && (
            <div className="text-xs text-slate-500">
              ${gasto.montoOriginal.toFixed(2)} USD
            </div>
          )}
          {gasto.estado === 'parcial' && gasto.montoPagado !== undefined && (
            <div className="mt-1">
              <div className="w-full bg-slate-200 rounded-full h-1.5">
                <div
                  className="bg-teal-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min((gasto.montoPagado / gasto.montoPEN) * 100, 100)}%` }}
                />
              </div>
              <div className="text-xs text-teal-600 mt-0.5">
                {((gasto.montoPagado / gasto.montoPEN) * 100).toFixed(0)}% pagado
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      align: 'center',
      render: (gasto) => (
        <div className="text-sm text-slate-900">
          {formatFecha(gasto.fecha)}
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      align: 'center',
      render: (gasto) => {
        const estadoBadge = getEstadoBadge(gasto.estado);
        return (
          <div className="flex flex-col items-center gap-1">
            <Badge variant={estadoBadge.variant}>{estadoBadge.label}</Badge>
            <GastoLineaBadge lineaNegocioId={gasto.lineaNegocioId} />
          </div>
        );
      },
    },
    {
      key: 'ctru',
      header: 'CTRU',
      align: 'center',
      render: (gasto) =>
        gasto.esProrrateable ? (
          <Badge variant={gasto.ctruRecalculado ? 'success' : 'warning'}>
            {gasto.ctruRecalculado ? 'Aplicado' : 'Pendiente'}
          </Badge>
        ) : (
          <span className="text-xs text-slate-400">N/A</span>
        ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'center',
      render: (gasto) => (
        <div>
          <div className="flex items-center justify-center gap-1">
            {(gasto.estado === 'pendiente' || gasto.estado === 'parcial') && (
              <button
                onClick={() => {
                  setGastoParaPago(gasto);
                  setShowPagoModal(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
                title={gasto.estado === 'pendiente' ? 'Registrar pago' : 'Registrar pago parcial'}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Pagar
              </button>
            )}
            <button
              onClick={() => handleEditarGasto(gasto)}
              className="inline-flex items-center p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
              title="Editar gasto"
            >
              <Pencil className="h-4 w-4" />
            </button>
            {(gasto.estado === 'pendiente' || gasto.estado === 'cancelado') && !gasto.pagos?.length && (
              <button
                onClick={() => handleEliminarGasto(gasto)}
                className="inline-flex items-center p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar gasto"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          {gasto.estado === 'parcial' && gasto.montoPagado !== undefined && (
            <div className="text-xs text-slate-500 mt-1">
              {formatCurrency(gasto.montoPagado)} / {formatCurrency(gasto.montoPEN)}
            </div>
          )}
          {gasto.estado === 'pagado' && (
            <div className="text-xs text-slate-400 mt-1">
              {gasto.pagos && gasto.pagos.length > 1
                ? `${gasto.pagos.length} pagos`
                : gasto.metodoPago || '-'}
            </div>
          )}
        </div>
      ),
    },
  ];

  // Mostrar skeleton durante carga inicial
  if (loading && gastos.length === 0) {
    return <GastosSkeleton />;
  }

  return (
    <PageShell>
      {/* Header */}
      <PageHeader
        title="Gastos Fijos"
        subtitle="Gastos del período: personal, local, servicios, operativos"
        icon={Receipt}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportService.exportGastos(gastosFiltrados)} disabled={gastosVisibles.length === 0}>
              <Download className="h-4 w-4 mr-1.5" /><span className="hidden sm:inline">Exportar</span>
            </Button>
            <Button variant="primary" size="sm" onClick={() => { setGastoParaEditar(null); setShowModal(true); }}>
              <Plus className="h-4 w-4 mr-1.5" />Nuevo
            </Button>
          </div>
        }
      />

      {/* TAREA-PROVEEDOR-GASTOS F4 · Toggle de vista · Listado / Reportes BI */}
      <div className="bg-white rounded-xl border border-slate-200 p-1 inline-flex gap-1 shadow-sm">
        <button
          type="button"
          onClick={() => setVistaActiva('listado')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            vistaActiva === 'listado'
              ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          📋 Listado
        </button>
        <button
          type="button"
          onClick={() => setVistaActiva('reportes')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            vistaActiva === 'reportes'
              ? 'bg-purple-100 text-purple-800 ring-2 ring-purple-300'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          📊 Reportes BI
        </button>
      </div>

      {/* Si vista = reportes · render el componente y oculta TODO el flujo de listado */}
      {vistaActiva === 'reportes' && (
        <ReportesGastosBI
          gastos={gastosPorLinea}
          arbolCategorias={arbolCategorias}
        />
      )}

      {/* TODO el flujo de listado se renderiza solo cuando vistaActiva === 'listado' (cada bloque top-level abajo tiene la condicion) */}

      {/* Navegador de Período · solo listado */}
      {vistaActiva === 'listado' && (
      <Card padding="md">
        <div className="flex flex-col gap-3">
          {/* Row 1: Tabs + month nav / label */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Tabs de vista */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 rounded-lg p-1 w-full sm:w-auto">
              <button
                onClick={() => setViewMode('month')}
                className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-colors flex items-center justify-center gap-1 sm:gap-1.5 ${
                  viewMode === 'month'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Mensual
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-colors flex items-center justify-center gap-1 sm:gap-1.5 ${
                  viewMode === 'all'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Todos
              </button>
              <button
                onClick={() => setViewMode('pending')}
                className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-colors flex items-center justify-center gap-1 sm:gap-1.5 ${
                  viewMode === 'pending'
                    ? 'bg-amber-50 text-amber-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Pendientes
              </button>
            </div>

            {/* Navegación de mes (solo en modo mensual) */}
            {viewMode === 'month' && (
              <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-3">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="text-center min-w-[140px] sm:min-w-[180px]">
                  <span className="text-sm sm:text-lg font-semibold text-slate-900">
                    {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                  </span>
                </div>
                <button
                  onClick={() => navigateMonth('next')}
                  className={`p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors ${
                    isCurrentMonth ? 'opacity-30 cursor-not-allowed' : ''
                  }`}
                  disabled={isCurrentMonth}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                {!isCurrentMonth && (
                  <button
                    onClick={goToCurrentMonth}
                    className="text-xs sm:text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    Hoy
                  </button>
                )}
              </div>
            )}

            {/* Label para modos no-mensuales */}
            {viewMode === 'all' && (
              <span className="text-sm sm:text-lg font-semibold text-slate-900 text-center sm:text-right">
                Todos los gastos ({gastosPorLinea.length})
              </span>
            )}
            {viewMode === 'pending' && (
              <span className="text-sm sm:text-lg font-semibold text-amber-700 text-center sm:text-right">
                Pendientes de pago ({gastosPorLinea.length})
              </span>
            )}
          </div>
        </div>
      </Card>
      )}

      {/* TAREA-GASTOS-PAGE-V2 F1 · Hero ejecutivo · 5 KPI cards anchored + insights */}
      {vistaActiva === 'listado' && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">

          {/* KPI 1 · Total mes con variacion */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl ring-1 ring-amber-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">Total mes</div>
              <span className="text-base">💰</span>
            </div>
            <div className="text-2xl font-bold tabular-nums text-amber-900">
              {formatCurrency(viewMode === 'month' && isCurrentMonth ? stats.totalMesActual : resumenPorTipo.totalGeneral)}
            </div>
            <div className="flex items-center gap-2 mt-2 text-[11px]">
              <span className={`font-bold tabular-nums ${stats.variacionVsMesAnterior >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {stats.variacionVsMesAnterior >= 0 ? '↗ +' : '↘ '}{stats.variacionVsMesAnterior.toFixed(1)}%
              </span>
              <span className="text-slate-500">vs anterior</span>
            </div>
          </div>

          {/* KPI 2 · Pendientes con vencimientos */}
          <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl ring-1 ring-rose-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-wider text-rose-700 font-semibold">Pendientes</div>
              <span className="text-base">⏰</span>
            </div>
            <div className="text-2xl font-bold tabular-nums text-rose-900">{formatCurrency(stats.totalPendientePago)}</div>
            <div className="flex items-center gap-2 mt-2 text-[11px]">
              <span className="text-rose-700 font-bold tabular-nums">{stats.cantidadPendientePago} gastos</span>
              {heroKpis.vencidos.length > 0 && (
                <span className="text-rose-700 font-bold">· {heroKpis.vencidos.length} vencidos ⚠</span>
              )}
            </div>
          </div>

          {/* KPI 3 · Mix por bloque */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl ring-1 ring-blue-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-wider text-blue-700 font-semibold">Mix por bloque</div>
              <span className="text-base">📊</span>
            </div>
            <div className="space-y-1.5 mt-2">
              {(['importacion', 'venta', 'periodo'] as BloqueCosto[]).map(b => {
                const monto = heroKpis.mixPorBloque[b];
                const pct = heroKpis.totalMix > 0 ? (monto / heroKpis.totalMix) * 100 : 0;
                const cfg = b === 'importacion'
                  ? { emoji: '📦', label: 'Imp.', barColor: 'from-blue-500 to-indigo-500', textColor: 'text-blue-700' }
                  : b === 'venta'
                    ? { emoji: '🛒', label: 'Venta', barColor: 'from-purple-500 to-fuchsia-500', textColor: 'text-purple-700' }
                    : { emoji: '📅', label: 'Per.', barColor: 'from-amber-500 to-orange-500', textColor: 'text-amber-700' };
                return (
                  <div key={b}>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className={`${cfg.textColor} font-semibold`}>{cfg.emoji} {cfg.label}</span>
                      <span className="font-bold tabular-nums text-slate-900">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="bg-white/70 rounded h-1.5 overflow-hidden">
                      <div className={`bg-gradient-to-r ${cfg.barColor} h-1.5 rounded`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* KPI 4 · Top categoria */}
          <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-2xl ring-1 ring-purple-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-wider text-purple-700 font-semibold">Top categoría</div>
              <span className="text-base">👑</span>
            </div>
            {heroKpis.topCategoria ? (
              <>
                <div className="text-base font-bold text-purple-900 truncate">{heroKpis.topCategoria.nombre}</div>
                <div className="text-lg font-bold tabular-nums text-purple-700 mt-0.5">{formatCurrency(heroKpis.topCategoria.monto)}</div>
                {heroKpis.totalCategorias > 1 && heroKpis.segundaCategoria && (
                  <div className="text-[10px] text-slate-600 mt-1 truncate">
                    2°: {heroKpis.segundaCategoria.nombre} · {formatCurrency(heroKpis.segundaCategoria.monto)}
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-slate-500 italic mt-2">Sin gastos categorizados</div>
            )}
          </div>

          {/* KPI 5 · Proveedores */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl ring-1 ring-emerald-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">Proveedores</div>
              <span className="text-base">🏭</span>
            </div>
            <div className="text-2xl font-bold tabular-nums text-emerald-900">{heroKpis.proveedoresUnicos}</div>
            <div className="text-[11px] text-emerald-700 mt-1">
              <span className="font-bold">{heroKpis.gastosDelMes.length}</span> gastos · {heroKpis.proveedoresUnicos} proveedores
            </div>
            <div className="mt-2 text-[10px] text-slate-500 italic">
              {stats.gastosProrrateablesMesActual > 0
                ? `${formatCurrency(stats.gastosProrrateablesMesActual)} impactan CTRU`
                : 'Sin gastos prorrateables'}
            </div>
          </div>
        </div>
      )}

      {/* Insights automáticos del sistema · 3 banners contextuales */}
      {vistaActiva === 'listado' && stats && (heroKpis.vencidos.length > 0 || heroKpis.vencenPronto.length > 0 || stats.variacionVsMesAnterior !== 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Insight 1 · Vencidos */}
          {heroKpis.vencidos.length > 0 ? (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">⚠</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-rose-900">{heroKpis.vencidos.length} gastos vencidos</div>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  {formatCurrency(heroKpis.vencidos.reduce((acc, g) => acc + (g.montoPEN - (g.montoPagado || 0)), 0))} pendiente · pagar HOY.
                </p>
              </div>
            </div>
          ) : heroKpis.vencenPronto.length > 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">⏰</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-amber-900">{heroKpis.vencenPronto.length} vencen en 7 días</div>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Próximo: {heroKpis.vencenPronto[0].descripcion?.slice(0, 30) || 'gasto'} ·{' '}
                  {formatCurrency(heroKpis.vencenPronto[0].montoPEN - (heroKpis.vencenPronto[0].montoPagado || 0))}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">✓</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-emerald-900">Sin vencimientos próximos</div>
                <p className="text-[11px] text-emerald-700 mt-0.5">No hay gastos vencidos ni que venzan en 7 días.</p>
              </div>
            </div>
          )}

          {/* Insight 2 · Variacion vs mes anterior */}
          <div className={`${stats.variacionVsMesAnterior >= 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'} border rounded-xl p-3 flex items-start gap-3`}>
            <div className={`w-8 h-8 rounded-full ${stats.variacionVsMesAnterior >= 0 ? 'bg-amber-500' : 'bg-emerald-500'} text-white flex items-center justify-center flex-shrink-0 text-sm font-bold`}>
              {stats.variacionVsMesAnterior >= 0 ? '📈' : '📉'}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-bold ${stats.variacionVsMesAnterior >= 0 ? 'text-amber-900' : 'text-emerald-900'}`}>
                {stats.variacionVsMesAnterior >= 0 ? 'Subida' : 'Bajada'} {Math.abs(stats.variacionVsMesAnterior).toFixed(1)}% vs anterior
              </div>
              <p className={`text-[11px] mt-0.5 ${stats.variacionVsMesAnterior >= 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                Promedio anual: {formatCurrency(stats.promedioMensualAnioActual)}
                {heroKpis.topCategoria && ` · top: ${heroKpis.topCategoria.nombre}`}
              </p>
            </div>
          </div>

          {/* Insight 3 · Top categoria como hint accionable */}
          {heroKpis.topCategoria && heroKpis.totalMix > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">💡</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-purple-900">
                  Concentración en "{heroKpis.topCategoria.nombre}"
                </div>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  {((heroKpis.topCategoria.monto / heroKpis.totalMix) * 100).toFixed(0)}% del mes ·{' '}
                  bloque {heroKpis.topCategoria.bloque}.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Wrap todo el resto del listado · solo cuando vistaActiva === 'listado' */}
      {vistaActiva === 'listado' && (<>

      {/* Tabs de Categoría: Gastos del Negocio / Costos de Importación / Pérdidas */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto scrollbar-hide">
        {[
          { id: 'negocio', label: 'Gastos del Negocio', shortLabel: 'Negocio', color: 'text-slate-900', filter: (g: Gasto) => !['flete_internacional', 'flete_usa_peru', 'almacenaje', 'internacion', 'recojo_local'].includes(g.tipo) && !['merma_transferencia', 'merma_vencimiento', 'desmedro'].includes(g.tipo) },
          { id: 'importacion', label: 'Costos de Importación', shortLabel: 'Importación', color: 'text-sky-700', filter: (g: Gasto) => ['flete_internacional', 'flete_usa_peru', 'almacenaje', 'internacion', 'recojo_local'].includes(g.tipo) },
          { id: 'perdidas', label: 'Pérdidas de Inventario', shortLabel: 'Pérdidas', color: 'text-red-700', filter: (g: Gasto) => ['merma_transferencia', 'merma_vencimiento', 'desmedro'].includes(g.tipo) },
        ].map(tab => {
          const count = gastosFiltrados.filter(tab.filter).length;
          const isActive = tabActiva === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setTabActiva(tab.id as 'negocio' | 'importacion' | 'perdidas');
                // Reset filtros de clase al cambiar tab
                setFiltros(prev => ({ ...prev, claseGasto: '' as ClaseGasto | '', tipo: '' as TipoGasto | '' }));
              }}
              className={`flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm rounded-md font-medium transition-colors flex items-center justify-center gap-1.5 ${
                isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
              {count > 0 && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  tab.id === 'perdidas' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

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

      {/* TAREA-GASTOS-PAGE-V2 F2 · FiltrosGastosBar canonico (patron 6a referencia · S58e) */}
      <FiltrosGastosBar
        estadoActivo={filtros.estado}
        bloqueActivo={filtros.bloque}
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
          const conteos: Partial<Record<BloqueCosto, number>> = { importacion: 0, venta: 0, periodo: 0 };
          for (const g of gastosPorLinea) {
            let bloque: BloqueCosto = 'periodo';
            if (g.categoriaCostoId && arbolCategorias) {
              for (const b of ['importacion', 'venta', 'periodo'] as BloqueCosto[]) {
                const datos = arbolCategorias[b];
                if (!datos) continue;
                if (datos.padres.some(p => p.id === g.categoriaCostoId)) { bloque = b; break; }
                let found = false;
                for (const padreId of Object.keys(datos.hijos)) {
                  if (datos.hijos[padreId].some(h => h.id === g.categoriaCostoId)) { bloque = b; found = true; break; }
                }
                if (found) break;
              }
            } else {
              if (g.categoria === 'GA') bloque = 'importacion';
              else if (g.categoria === 'GD' || g.categoria === 'GV') bloque = 'venta';
            }
            conteos[bloque] = (conteos[bloque] || 0) + 1;
          }
          return conteos;
        })()}
        hayFiltrosActivos={!!hayFiltrosActivos}
        onCambiarEstado={(estado) => setFiltros((f) => ({ ...f, estado }))}
        onCambiarBloque={(bloque) => setFiltros((f) => ({ ...f, bloque }))}
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

      {/* TAREA-GASTOS-PAGE-V2 F4.b · Layout 2 columnas (listado + drawer urgentes) */}
      <div className={heroKpis.vencidos.length + heroKpis.vencenPronto.length > 0 ? 'grid grid-cols-1 lg:grid-cols-4 gap-4' : ''}>
        <div className={heroKpis.vencidos.length + heroKpis.vencenPronto.length > 0 ? 'lg:col-span-3' : ''}>

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
          /* TAREA-GASTOS-PAGE-V2 F4.c · Empty state segun contexto */
          hayFiltrosActivos || viewMode === 'pending' ? (
            <EmptyStateAction
              title={
                viewMode === 'pending'
                  ? 'No hay gastos pendientes'
                  : 'No se encontraron gastos'
              }
              description={
                viewMode === 'pending'
                  ? 'Todos los gastos han sido pagados'
                  : 'Prueba con otros filtros o limpia los filtros actuales'
              }
              variant="no-results"
              icon={hayFiltrosActivos ? 'search' : 'file'}
              actionLabel="Limpiar Filtros"
              onAction={hayFiltrosActivos ? limpiarFiltros : undefined}
            />
          ) : gastos.length === 0 ? (
            /* Onboarding · primera vez en el modulo · sin gastos en TODA la base */
            <div className="text-center py-10 px-4">
              <div className="text-6xl mb-4">💰</div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">No hay gastos registrados aún</h3>
              <p className="text-sm text-slate-600 max-w-xl mx-auto mb-6">
                Empezar a registrar gastos te permite calcular margen real · auditar fiscalmente · y ver el panorama
                de tu negocio. Te sugerimos por dónde empezar.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto mb-6">
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="bg-amber-50 border-2 border-amber-300 hover:border-amber-500 rounded-2xl p-5 text-left transition-all hover:shadow-md"
                >
                  <div className="text-3xl mb-2">📅</div>
                  <div className="font-bold text-amber-900 mb-1">Tu primer gasto recurrente</div>
                  <p className="text-xs text-amber-700">
                    Recibo Movistar · Sedapal · Edelnor. Tarda 1 minuto · queda como recurrente.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="bg-blue-50 border-2 border-blue-300 hover:border-blue-500 rounded-2xl p-5 text-left transition-all hover:shadow-md"
                >
                  <div className="text-3xl mb-2">📦</div>
                  <div className="font-bold text-blue-900 mb-1">Costo de un envío</div>
                  <p className="text-xs text-blue-700">
                    Flete adicional o aranceles · vincula a un envío · impacta CTRU automáticamente.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="bg-purple-50 border-2 border-purple-300 hover:border-purple-500 rounded-2xl p-5 text-left transition-all hover:shadow-md"
                >
                  <div className="text-3xl mb-2">🛒</div>
                  <div className="font-bold text-purple-900 mb-1">Comisión de venta</div>
                  <p className="text-xs text-purple-700">
                    ML · pasarela · si conectas webhook se auto-detecta · sin entrada manual.
                  </p>
                </button>
              </div>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-lg shadow-sm"
                >
                  + Registrar primer gasto
                </button>
              </div>

              {/* Pre-requisitos · checklist */}
              <div className="mt-8 max-w-3xl mx-auto bg-slate-50 rounded-xl border border-slate-200 p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-700 font-bold mb-3">
                  📋 Pre-requisitos para usar el módulo · checklist
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className={`bg-white rounded-lg border p-3 flex items-center gap-2 ${arbolCategorias && Object.keys(arbolCategorias).length > 0 ? 'border-emerald-200' : 'border-amber-200'}`}>
                    <div className="text-xl">{arbolCategorias && Object.keys(arbolCategorias).length > 0 ? '✓' : '📝'}</div>
                    <div className="flex-1 text-left">
                      <div className={`text-xs font-bold ${arbolCategorias && Object.keys(arbolCategorias).length > 0 ? 'text-emerald-900' : 'text-amber-900'}`}>
                        Categorías de costo
                      </div>
                      <div className={`text-[10px] ${arbolCategorias && Object.keys(arbolCategorias).length > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {arbolCategorias && Object.keys(arbolCategorias).length > 0 ? '3 niveles cargados (S40 seed)' : 'Ejecutar seed pre-populado'}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-emerald-200 p-3 flex items-center gap-2">
                    <div className="text-xl">✓</div>
                    <div className="flex-1 text-left">
                      <div className="text-xs font-bold text-emerald-900">Cuentas bancarias</div>
                      <div className="text-[10px] text-emerald-700">Para registrar pagos · ya configuradas</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-amber-200 p-3 flex items-center gap-2">
                    <div className="text-xl">📝</div>
                    <div className="flex-1 text-left">
                      <div className="text-xs font-bold text-amber-900">Top proveedores</div>
                      <div className="text-[10px] text-amber-700">Sugerido cargar · o crear inline al primer gasto</div>
                    </div>
                  </div>
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
        </div>

        {/* F4.b · Drawer lateral con urgentes (sticky en desktop) */}
        {heroKpis.vencidos.length + heroKpis.vencenPronto.length > 0 && (
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-4">
              <DrawerUrgentes
                vencidos={heroKpis.vencidos}
                vencenPronto={heroKpis.vencenPronto}
                onPagar={(g) => setGastoParaPago(g)}
                onVerDetalle={handleEditarGasto}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modal Formulario Nuevo/Editar Gasto */}
      {showModal && (
        <GastoForm
          gastoEditar={gastoParaEditar}
          onClose={() => {
            setShowModal(false);
            setGastoParaEditar(null);
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

      {/* TAREA-GASTOS-PAGE-V2 F5 · Integraciones · atajos a 7 modulos relacionados */}
      <div className="bg-gradient-to-br from-slate-50 to-orange-50/30 rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🔗</span>
          <h3 className="text-sm font-bold text-slate-900">Integraciones · módulos relacionados con Gastos</h3>
          <span className="text-[11px] text-slate-500 italic">Cierre del círculo del sistema</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          <a href="/tesoreria" className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 hover:shadow-md transition-shadow text-center group">
            <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">💸</div>
            <div className="text-xs font-bold text-emerald-900">Tesorería</div>
            <div className="text-[10px] text-emerald-700">Pagar gasto</div>
          </a>
          <a href="/maestros" className="bg-purple-50 border border-purple-200 rounded-xl p-3 hover:shadow-md transition-shadow text-center group">
            <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">📂</div>
            <div className="text-xs font-bold text-purple-900">Maestros</div>
            <div className="text-[10px] text-purple-700">Categorías</div>
          </a>
          <a href="/red-logistica" className="bg-blue-50 border border-blue-200 rounded-xl p-3 hover:shadow-md transition-shadow text-center group">
            <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">🏭</div>
            <div className="text-xs font-bold text-blue-900">Red Log.</div>
            <div className="text-[10px] text-blue-700">Proveedores</div>
          </a>
          <a href="/envios" className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 hover:shadow-md transition-shadow text-center group">
            <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">📦</div>
            <div className="text-xs font-bold text-indigo-900">Envíos</div>
            <div className="text-[10px] text-indigo-700">CTRU</div>
          </a>
          <a href="/ventas" className="bg-pink-50 border border-pink-200 rounded-xl p-3 hover:shadow-md transition-shadow text-center group">
            <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">🛒</div>
            <div className="text-xs font-bold text-pink-900">Ventas</div>
            <div className="text-[10px] text-pink-700">Comisiones</div>
          </a>
          <a href="/planilla" className="bg-rose-50 border border-rose-200 rounded-xl p-3 hover:shadow-md transition-shadow text-center group">
            <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">👥</div>
            <div className="text-xs font-bold text-rose-900">Planilla</div>
            <div className="text-[10px] text-rose-700">Sueldos</div>
          </a>
          <a href="/finanzas" className="bg-teal-50 border border-teal-200 rounded-xl p-3 hover:shadow-md transition-shadow text-center group">
            <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">📊</div>
            <div className="text-xs font-bold text-teal-900">BI</div>
            <div className="text-[10px] text-teal-700">P&L 3 niveles</div>
          </a>
        </div>
      </div>

      </>)}{/* Cierre del wrap vistaActiva === 'listado' */}

      {/* Dialogo de Confirmacion */}
      <ConfirmDialog {...dialogProps} />
    </PageShell>
  );
};
