import React, { useEffect, useState, useMemo } from 'react';
import {
  Package,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Download,
  RefreshCw,
  CheckCircle,
  Warehouse,
  Clock,
  Plane,
  ShoppingBag,
  AlertCircle,
  Boxes,
  LayoutGrid,
  List,
  Filter,
  BarChart3,
  Bell
} from 'lucide-react';
import {
  Card,
  Button,
  Modal,
  InventarioSkeleton,
  PipelineHeader,
  KPIGrid,
  KPICard,
  SearchInput,
  Select,
  GradientHeader,
  StatCard,
  StatDistribution,
  Tabs
} from '../../components/common';
import type { Tab } from '../../components/common/Tabs';
import type { PipelineStage } from '../../components/common/PipelineHeader';
import {
  ProductoInventarioTable,
  UnidadDetailsModal,
  AlertasPrioritarias,
  StockProductoCard,
  InventarioAnalytics,
  AlertasInventario,
  PromocionModal
} from '../../components/modules/inventario';
import type { PromocionData } from '../../components/modules/inventario';
import type { ProductoConUnidades, AlertaProducto } from '../../components/modules/inventario';
import { useUnidadStore } from '../../store/unidadStore';
import { useProductoStore } from '../../store/productoStore';
import { useAlmacenStore } from '../../store/almacenStore';
import { useInventarioStore } from '../../store/inventarioStore';
import { exportService } from '../../services/export.service';
import { inventarioService } from '../../services/inventario.service';
import type { Unidad } from '../../types/unidad.types';

type VistaInventario = 'cards' | 'tabla';
type TabInventario = 'lista' | 'analytics' | 'alertas';

export const Inventario: React.FC = () => {
  const { unidades, loading: unidadesLoading, fetchUnidades } = useUnidadStore();
  const { productos, fetchProductos } = useProductoStore();
  const { almacenes, fetchAlmacenes } = useAlmacenStore();
  const { stats, fetchStats } = useInventarioStore();

  const [tabActivo, setTabActivo] = useState<TabInventario>('lista');
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null);
  const [filtroAlmacen, setFiltroAlmacen] = useState<string>('');
  const [filtroPais, setFiltroPais] = useState<'USA' | 'Peru' | ''>('');
  const [busqueda, setBusqueda] = useState('');
  const [vistaActual, setVistaActual] = useState<VistaInventario>('tabla');
  const [unidadSeleccionada, setUnidadSeleccionada] = useState<Unidad | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [resultadoSync, setResultadoSync] = useState<any>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showPromocionModal, setShowPromocionModal] = useState(false);
  const [productoPromocion, setProductoPromocion] = useState<{
    producto: any;
    unidades: any[];
    valorOriginal: number;
    diasParaVencer?: number;
  } | null>(null);

  useEffect(() => {
    fetchUnidades();
    fetchStats();
    fetchProductos();
    fetchAlmacenes();
  }, [fetchUnidades, fetchStats, fetchProductos, fetchAlmacenes]);

  // Calcular días para vencer
  const calcularDiasParaVencer = (fecha: any): number => {
    if (!fecha || !fecha.toDate) return 999;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vencimiento = fecha.toDate();
    vencimiento.setHours(0, 0, 0, 0);
    const diffTime = vencimiento.getTime() - hoy.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Calcular estadísticas del pipeline desde las unidades (fuente única de verdad)
  const inventarioStats = useMemo(() => {
    let recibidaUSA = 0;
    let enTransitoUSA = 0;
    let enTransitoPeru = 0;
    let disponiblePeru = 0;
    let reservada = 0;
    let problemas = 0;
    let valorTotalUSD = 0;
    let proximasAVencer = 0;
    let stockCriticoCount = 0;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Validar que unidades sea un array antes de iterar
    const unidadesArray = Array.isArray(unidades) ? unidades : [];
    unidadesArray.forEach(u => {
      // Excluir vendidas del conteo activo
      if (u.estado === 'vendida') return;

      // Aplicar filtros de almacén y país
      if (filtroAlmacen && u.almacenId !== filtroAlmacen) return;
      if (filtroPais && u.pais !== filtroPais) return;

      valorTotalUSD += u.costoUnitarioUSD;

      switch (u.estado) {
        case 'recibida_usa':
          recibidaUSA++;
          break;
        case 'en_transito_usa':
          enTransitoUSA++;
          break;
        case 'en_transito_peru':
          enTransitoPeru++;
          break;
        case 'disponible_peru':
          disponiblePeru++;
          break;
        case 'reservada':
          reservada++;
          break;
        case 'vencida':
        case 'danada':
          problemas++;
          break;
      }

      // Contar próximas a vencer (30 días)
      if (u.fechaVencimiento?.toDate) {
        const vencimiento = u.fechaVencimiento.toDate();
        vencimiento.setHours(0, 0, 0, 0);
        const diffDias = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDias >= 0 && diffDias <= 30) {
          proximasAVencer++;
        }
      }
    });

    const total = recibidaUSA + enTransitoUSA + enTransitoPeru + disponiblePeru + reservada + problemas;
    const enTransito = enTransitoUSA + enTransitoPeru;

    return {
      recibidaUSA,
      enTransitoUSA,
      enTransitoPeru,
      enTransito,
      disponiblePeru,
      reservada,
      problemas,
      total,
      valorTotalUSD,
      proximasAVencer,
      stockCriticoCount
    };
  }, [unidades, filtroAlmacen, filtroPais]);

  // Pipeline stages para el PipelineHeader existente
  const pipelineStages: PipelineStage[] = useMemo(() => [
    {
      id: 'recibida_usa',
      label: 'USA',
      count: inventarioStats.recibidaUSA,
      color: 'blue',
      icon: <Warehouse className="h-4 w-4" />
    },
    {
      id: 'en_transito',
      label: 'En Tránsito',
      count: inventarioStats.enTransito,
      color: 'yellow',
      icon: <Plane className="h-4 w-4" />
    },
    {
      id: 'disponible_peru',
      label: 'Perú',
      count: inventarioStats.disponiblePeru,
      color: 'green',
      icon: <CheckCircle className="h-4 w-4" />
    },
    {
      id: 'reservada',
      label: 'Reservadas',
      count: inventarioStats.reservada,
      color: 'purple',
      icon: <ShoppingBag className="h-4 w-4" />
    },
    {
      id: 'problemas',
      label: 'Problemas',
      count: inventarioStats.problemas,
      color: 'red',
      icon: <AlertTriangle className="h-4 w-4" />
    }
  ], [inventarioStats]);

  // Agrupar unidades por producto
  const productosConUnidades = useMemo((): ProductoConUnidades[] => {
    const grupos: Record<string, ProductoConUnidades> = {};

    // Validar que unidades sea un array antes de filtrar
    const unidadesArr = Array.isArray(unidades) ? unidades : [];

    // Filtrar unidades vendidas para el inventario activo
    let unidadesActivas = unidadesArr.filter(u => u.estado !== 'vendida');

    // Aplicar filtros de almacén y país
    if (filtroAlmacen) {
      unidadesActivas = unidadesActivas.filter(u => u.almacenId === filtroAlmacen);
    }
    if (filtroPais) {
      unidadesActivas = unidadesActivas.filter(u => u.pais === filtroPais);
    }

    unidadesActivas.forEach(unidad => {
      if (!grupos[unidad.productoId]) {
        grupos[unidad.productoId] = {
          productoId: unidad.productoId,
          sku: unidad.productoSKU,
          nombre: unidad.productoNombre,
          marca: '',
          grupo: '',
          unidades: [],
          recibidaUSA: 0,
          enTransitoUSA: 0,
          enTransitoPeru: 0,
          disponiblePeru: 0,
          reservada: 0,
          vendida: 0,
          problemas: 0,
          totalUnidades: 0,
          totalDisponibles: 0,
          valorTotalUSD: 0,
          costoPromedioUSD: 0,
          proximasAVencer30Dias: 0,
          stockCritico: false
        };
      }

      const grupo = grupos[unidad.productoId];
      grupo.unidades.push(unidad);
      grupo.totalUnidades++;
      grupo.valorTotalUSD += unidad.costoUnitarioUSD;

      // Contar por estado
      switch (unidad.estado) {
        case 'recibida_usa':
          grupo.recibidaUSA++;
          grupo.totalDisponibles++;
          break;
        case 'en_transito_usa':
          grupo.enTransitoUSA++;
          break;
        case 'en_transito_peru':
          grupo.enTransitoPeru++;
          break;
        case 'disponible_peru':
          grupo.disponiblePeru++;
          grupo.totalDisponibles++;
          break;
        case 'reservada':
          grupo.reservada++;
          break;
        case 'vencida':
        case 'danada':
          grupo.problemas++;
          break;
      }

      // Verificar próximas a vencer
      if (unidad.fechaVencimiento && typeof unidad.fechaVencimiento.toDate === 'function') {
        const diffDias = calcularDiasParaVencer(unidad.fechaVencimiento);
        if (diffDias >= 0 && diffDias <= 30) {
          grupo.proximasAVencer30Dias++;
        }
      }
    });

    // Enriquecer con datos del producto (marca, grupo)
    Object.values(grupos).forEach(grupo => {
      const producto = productos.find(p => p.id === grupo.productoId);
      if (producto) {
        grupo.marca = producto.marca;
        grupo.grupo = producto.grupo;
        grupo.stockCritico = producto.stockMinimo !== undefined &&
          grupo.totalDisponibles <= producto.stockMinimo;
      }
      grupo.costoPromedioUSD = grupo.totalUnidades > 0
        ? grupo.valorTotalUSD / grupo.totalUnidades
        : 0;
    });

    // Ordenar por SKU
    return Object.values(grupos).sort((a, b) => a.sku.localeCompare(b.sku));
  }, [unidades, productos, filtroAlmacen, filtroPais]);

  // Filtrar productos según el estado seleccionado en el pipeline y búsqueda
  const productosFiltrados = useMemo(() => {
    let resultado = productosConUnidades;

    // Filtrar por estado del pipeline
    if (filtroEstado) {
      resultado = resultado.filter(p => {
        switch (filtroEstado) {
          case 'recibida_usa':
            return p.recibidaUSA > 0;
          case 'en_transito':
            return p.enTransitoUSA > 0 || p.enTransitoPeru > 0;
          case 'disponible_peru':
            return p.disponiblePeru > 0;
          case 'reservada':
            return p.reservada > 0;
          case 'problemas':
            return p.problemas > 0;
          default:
            return true;
        }
      });
    }

    // Filtrar por búsqueda
    if (busqueda.trim()) {
      const termino = busqueda.toLowerCase();
      resultado = resultado.filter(p => {
        const sku = (p.sku ?? '').toLowerCase();
        const nombre = (p.nombre ?? '').toLowerCase();
        const marca = (p.marca ?? '').toLowerCase();
        return sku.includes(termino) || nombre.includes(termino) || marca.includes(termino);
      });
    }

    return resultado;
  }, [productosConUnidades, filtroEstado, busqueda]);

  // Generar alertas prioritarias
  const alertasPrioritarias = useMemo((): AlertaProducto[] => {
    const alertas: AlertaProducto[] = [];

    productosConUnidades.forEach(producto => {
      // Alertas de vencimiento
      if (producto.proximasAVencer30Dias > 0) {
        // Encontrar la unidad con menor tiempo de vencimiento
        let menorDias = 999;
        producto.unidades.forEach(u => {
          if (u.fechaVencimiento && u.estado !== 'vendida') {
            const dias = calcularDiasParaVencer(u.fechaVencimiento);
            if (dias < menorDias && dias >= 0) menorDias = dias;
          }
        });

        alertas.push({
          producto,
          tipo: 'vencimiento',
          prioridad: menorDias <= 7 ? 'alta' : menorDias <= 15 ? 'media' : 'baja',
          diasRestantes: menorDias,
          unidadesAfectadas: producto.proximasAVencer30Dias,
          mensaje: menorDias <= 7
            ? `¡Vence en ${menorDias} días! Considerar promoción urgente`
            : `Vencimiento próximo en ${menorDias} días`
        });
      }

      // Alertas de stock crítico
      if (producto.stockCritico) {
        alertas.push({
          producto,
          tipo: 'stock_critico',
          prioridad: producto.totalDisponibles === 0 ? 'alta' : 'media',
          unidadesAfectadas: producto.totalDisponibles,
          mensaje: producto.totalDisponibles === 0
            ? 'Sin stock disponible. Reordenar urgente'
            : `Stock bajo: ${producto.totalDisponibles} unidades disponibles`
        });
      }
    });

    // Ordenar por prioridad
    return alertas.sort((a, b) => {
      const prioridadOrder = { alta: 0, media: 1, baja: 2 };
      return prioridadOrder[a.prioridad] - prioridadOrder[b.prioridad];
    });
  }, [productosConUnidades]);

  // Definición de tabs (después de alertasPrioritarias para poder usar el badge)
  const tabs: Tab[] = useMemo(() => [
    {
      id: 'lista',
      label: 'Inventario',
      icon: <Package className="h-4 w-4" />
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <BarChart3 className="h-4 w-4" />
    },
    {
      id: 'alertas',
      label: 'Alertas',
      icon: <Bell className="h-4 w-4" />,
      badge: alertasPrioritarias.length > 0 ? alertasPrioritarias.length : undefined
    }
  ], [alertasPrioritarias.length]);

  const handleSincronizarCompleto = async () => {
    setSincronizando(true);
    try {
      const resultado = await inventarioService.sincronizacionCompleta();
      setResultadoSync(resultado);
      setShowSyncModal(true);

      // Refrescar datos
      fetchUnidades();
      fetchStats();
    } catch (error: any) {
      console.error('Error sincronizando:', error);
      alert('Error al sincronizar: ' + error.message);
    } finally {
      setSincronizando(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltroEstado(null);
    setFiltroAlmacen('');
    setFiltroPais('');
    setBusqueda('');
  };

  const hayFiltrosActivos = filtroEstado || filtroAlmacen || filtroPais || busqueda;

  // Handler para ver producto desde alertas
  const handleVerProducto = (productoId: string) => {
    setVistaActual('tabla');
  };

  // Handler para abrir modal de promoción
  const handlePromocionar = (productoId: string) => {
    const productoConUnidades = productosConUnidades.find(p => p.productoId === productoId);
    if (!productoConUnidades) return;

    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;

    // Encontrar unidades por vencer
    const unidadesPorVencer = productoConUnidades.unidades.filter(u => {
      if (!u.fechaVencimiento?.toDate) return false;
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const vencimiento = u.fechaVencimiento.toDate();
      vencimiento.setHours(0, 0, 0, 0);
      const diffDias = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      return diffDias >= 0 && diffDias <= 60;
    });

    // Calcular días mínimos para vencer
    let diasMinimos: number | undefined;
    if (unidadesPorVencer.length > 0) {
      diasMinimos = Math.min(
        ...unidadesPorVencer.map(u => {
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          const vencimiento = u.fechaVencimiento.toDate();
          vencimiento.setHours(0, 0, 0, 0);
          return Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        })
      );
    }

    const valorOriginal = unidadesPorVencer.length > 0
      ? unidadesPorVencer.reduce((sum, u) => sum + u.costoUnitarioUSD, 0)
      : productoConUnidades.valorTotalUSD;

    setProductoPromocion({
      producto,
      unidades: unidadesPorVencer.length > 0 ? unidadesPorVencer : productoConUnidades.unidades,
      valorOriginal,
      diasParaVencer: diasMinimos
    });
    setShowPromocionModal(true);
  };

  // Handler para crear promoción
  const handleCrearPromocion = (promocion: PromocionData) => {
    // Por ahora solo logueamos, en el futuro se puede guardar en Firestore
    console.log('Promoción creada:', promocion);
    // Aquí se podría:
    // 1. Guardar en colección 'promociones' de Firestore
    // 2. Actualizar precios de venta en productos
    // 3. Crear notificación o recordatorio
    alert(`Promoción creada: ${promocion.porcentajeDescuento}% de descuento para ${productoPromocion?.producto?.sku}`);
    setShowPromocionModal(false);
    setProductoPromocion(null);
  };

  // Mostrar skeleton durante carga inicial
  if (unidadesLoading && unidades.length === 0) {
    return <InventarioSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header Profesional con Gradiente */}
      <GradientHeader
        title="Inventario"
        subtitle="Vista consolidada del stock calculada desde las unidades físicas"
        icon={Boxes}
        variant="dark"
        actions={
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              onClick={handleSincronizarCompleto}
              disabled={sincronizando}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <RefreshCw className={`h-5 w-5 ${sincronizando ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const dataExport = unidades.map(u => ({
                  SKU: u.productoSKU,
                  Producto: u.productoNombre,
                  Lote: u.lote,
                  Estado: u.estado,
                  Almacen: u.almacenNombre,
                  Pais: u.pais,
                  CostoUSD: u.costoUnitarioUSD,
                  FechaVencimiento: u.fechaVencimiento?.toDate?.()?.toLocaleDateString() || '-',
                  OrdenCompra: u.ordenCompraNumero
                }));
                exportService.downloadExcel(dataExport, 'Inventario_Unidades');
              }}
              disabled={unidades.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        }
        stats={[
          { label: 'Unidades', value: inventarioStats.total },
          { label: 'Productos', value: productosConUnidades.length },
          { label: 'USA', value: inventarioStats.recibidaUSA + inventarioStats.enTransitoUSA },
          { label: 'Perú', value: inventarioStats.disponiblePeru }
        ]}
      />

      {/* StatCards interactivos - Solo visible en tab Lista */}
      {tabActivo === 'lista' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard
              label="Total Unidades"
              value={inventarioStats.total}
              icon={Package}
              variant="blue"
            />
            <StatCard
              label="Valor USD"
              value={formatCurrency(inventarioStats.valorTotalUSD)}
              icon={DollarSign}
              variant="green"
            />
            <StatCard
              label="En USA"
              value={inventarioStats.recibidaUSA + inventarioStats.enTransitoUSA}
              icon={Warehouse}
              variant="blue"
              onClick={() => setFiltroPais('USA')}
              active={filtroPais === 'USA'}
            />
            <StatCard
              label="En Tránsito"
              value={inventarioStats.enTransitoPeru}
              icon={Plane}
              variant="amber"
              onClick={() => setFiltroEstado('en_transito_peru')}
              active={filtroEstado === 'en_transito_peru'}
            />
            <StatCard
              label="En Perú"
              value={inventarioStats.disponiblePeru}
              icon={CheckCircle}
              variant="green"
              onClick={() => setFiltroPais('Peru')}
              active={filtroPais === 'Peru'}
            />
            <StatCard
              label="Por Vencer"
              value={inventarioStats.proximasAVencer}
              icon={Clock}
              variant={inventarioStats.proximasAVencer > 0 ? 'red' : 'default'}
            />
          </div>

          {/* Distribución Visual */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <StatDistribution
              title="Distribución por Ubicación"
              data={[
                { label: 'USA', value: inventarioStats.recibidaUSA + inventarioStats.enTransitoUSA, color: 'bg-blue-500' },
                { label: 'En Tránsito → Perú', value: inventarioStats.enTransitoPeru, color: 'bg-amber-500' },
                { label: 'Perú', value: inventarioStats.disponiblePeru, color: 'bg-green-500' },
                { label: 'Reservadas', value: inventarioStats.reservada, color: 'bg-purple-500' }
              ]}
            />
            <StatDistribution
              title="Estado del Stock"
              data={[
                { label: 'Disponible', value: inventarioStats.recibidaUSA + inventarioStats.disponiblePeru, color: 'bg-green-500' },
                { label: 'En Movimiento', value: inventarioStats.enTransitoUSA + inventarioStats.enTransitoPeru, color: 'bg-blue-500' },
                { label: 'Reservado', value: inventarioStats.reservada, color: 'bg-purple-500' },
                { label: 'Problemas', value: inventarioStats.problemas, color: 'bg-red-500' }
              ]}
            />
          </div>
        </>
      )}

      {/* Tabs de navegación */}
      <Tabs
        tabs={tabs}
        activeTab={tabActivo}
        onChange={(tabId) => setTabActivo(tabId as TabInventario)}
        variant="pills"
        size="md"
      />

      {/* ==================== TAB: LISTA (Inventario) ==================== */}
      {tabActivo === 'lista' && (
        <>
          {/* Pipeline de Estados */}
          <PipelineHeader
            title="Estado del Inventario"
            stages={pipelineStages}
            activeStage={filtroEstado}
            onStageClick={setFiltroEstado}
          />

          {/* Alertas Prioritarias (resumen rápido) */}
          {alertasPrioritarias.length > 0 && (
            <AlertasPrioritarias
              alertas={alertasPrioritarias}
              onVerProducto={handleVerProducto}
              maxAlertas={6}
            />
          )}

          {/* Barra de búsqueda y filtros */}
          <Card padding="md">
            <div className="space-y-4">
              {/* Barra de búsqueda */}
              <SearchInput
                value={busqueda}
                onChange={setBusqueda}
                placeholder="Buscar por SKU, nombre o marca..."
              />

              {/* Filtros y toggle de vista */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Filtros:</span>
                  </div>

                  <Select
                    value={filtroPais}
                    onChange={(e) => setFiltroPais(e.target.value as 'USA' | 'Peru' | '')}
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
                      ...almacenes.map(a => ({
                        value: a.id,
                        label: `${a.pais === 'USA' ? '🇺🇸' : '🇵🇪'} ${a.nombre}`
                      }))
                    ]}
                    className="w-52"
                  />

                  {hayFiltrosActivos && (
                    <button
                      onClick={limpiarFiltros}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>

                {/* Toggle de vista */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Vista:</span>
                  <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                    <button
                      onClick={() => setVistaActual('cards')}
                      className={`p-2 ${
                        vistaActual === 'cards'
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                      title="Vista de tarjetas"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setVistaActual('tabla')}
                      className={`p-2 ${
                        vistaActual === 'tabla'
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                      title="Vista de tabla"
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Contador de resultados */}
              <div className="text-sm text-gray-600">
                Mostrando <span className="font-medium">{productosFiltrados.length}</span> productos
                {' · '}
                <span className="font-medium">
                  {productosFiltrados.reduce((sum, p) => sum + p.totalUnidades, 0)}
                </span> unidades
              </div>
            </div>
          </Card>

          {/* Contenido según vista */}
          {vistaActual === 'cards' ? (
            /* Vista de Cards */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {productosFiltrados.length === 0 ? (
                <div className="col-span-full">
                  <Card padding="lg">
                    <div className="text-center py-8">
                      <Package className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">
                        No hay productos en inventario
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Las unidades se crean automáticamente al recibir órdenes de compra
                      </p>
                    </div>
                  </Card>
                </div>
              ) : (
                productosFiltrados.map((producto) => (
                  <StockProductoCard
                    key={producto.productoId}
                    producto={producto}
                    onVerDetalle={() => {
                      setVistaActual('tabla');
                    }}
                  />
                ))
              )}
            </div>
          ) : (
            /* Vista de Tabla */
            <Card padding="md">
              <ProductoInventarioTable
                productos={productosFiltrados}
                loading={unidadesLoading}
                onUnidadClick={setUnidadSeleccionada}
                filtroEstado={filtroEstado}
              />
            </Card>
          )}
        </>
      )}

      {/* ==================== TAB: ANALYTICS ==================== */}
      {tabActivo === 'analytics' && (
        <InventarioAnalytics
          unidades={unidades}
          productos={productos}
          almacenes={almacenes}
        />
      )}

      {/* ==================== TAB: ALERTAS ==================== */}
      {tabActivo === 'alertas' && (
        <AlertasInventario
          unidades={unidades}
          productos={productos}
          onVerProducto={(productoId) => {
            setTabActivo('lista');
            // Opcional: Podría filtrar por ese producto
          }}
          onPromocionar={handlePromocionar}
        />
      )}

      {/* Modal de Detalles de Unidad */}
      {unidadSeleccionada && (
        <UnidadDetailsModal
          unidad={unidadSeleccionada}
          onClose={() => setUnidadSeleccionada(null)}
        />
      )}

      {/* Modal de Resultados de Sincronización */}
      <Modal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        title="Sincronización Completa"
        size="lg"
      >
        <div className="space-y-4">
          {resultadoSync && (
            <>
              {/* Sección: Unidades */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Estados de Unidades</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-gray-900">
                      {resultadoSync.estadosUnidades?.unidadesRevisadas || 0}
                    </div>
                    <div className="text-xs text-gray-500">Revisadas</div>
                  </div>
                  <div className="bg-primary-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-primary-600">
                      {resultadoSync.estadosUnidades?.correccionesRealizadas || 0}
                    </div>
                    <div className="text-xs text-primary-700">Corregidas</div>
                  </div>
                  <div className="bg-success-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-success-600">
                      {resultadoSync.estadosUnidades?.reservasLiberadas || 0}
                    </div>
                    <div className="text-xs text-success-700">Reservas Lib.</div>
                  </div>
                </div>
              </div>

              {/* Sección: Productos */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Stock de Productos</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-gray-900">
                      {resultadoSync.stockProductos?.productosRevisados || 0}
                    </div>
                    <div className="text-xs text-gray-500">Revisados</div>
                  </div>
                  <div className="bg-primary-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-primary-600">
                      {resultadoSync.stockProductos?.productosActualizados || 0}
                    </div>
                    <div className="text-xs text-primary-700">Actualizados</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-blue-600">
                      {resultadoSync.ctruActualizados || 0}
                    </div>
                    <div className="text-xs text-blue-700">CTRU Actualiz.</div>
                  </div>
                  <div className="bg-danger-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-danger-600">
                      {resultadoSync.errores || 0}
                    </div>
                    <div className="text-xs text-danger-700">Errores</div>
                  </div>
                </div>
              </div>

              {/* Mensaje de resultado */}
              {(resultadoSync.estadosUnidades?.correccionesRealizadas === 0 &&
               resultadoSync.stockProductos?.productosActualizados === 0) ? (
                <div className="flex items-center gap-2 text-success-600 bg-success-50 p-3 rounded-lg">
                  <CheckCircle className="h-5 w-5" />
                  <span>Todo sincronizado correctamente. No se encontraron inconsistencias.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-primary-600 bg-primary-50 p-3 rounded-lg">
                  <CheckCircle className="h-5 w-5" />
                  <span>
                    Sincronización completada. Se corrigieron {resultadoSync.estadosUnidades?.correccionesRealizadas || 0} unidades
                    y {resultadoSync.stockProductos?.productosActualizados || 0} productos.
                  </span>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end">
            <Button onClick={() => setShowSyncModal(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Promoción */}
      <PromocionModal
        isOpen={showPromocionModal}
        onClose={() => {
          setShowPromocionModal(false);
          setProductoPromocion(null);
        }}
        producto={productoPromocion?.producto}
        unidadesAfectadas={productoPromocion?.unidades}
        valorOriginal={productoPromocion?.valorOriginal || 0}
        diasParaVencer={productoPromocion?.diasParaVencer}
        onCrearPromocion={handleCrearPromocion}
      />
    </div>
  );
};
