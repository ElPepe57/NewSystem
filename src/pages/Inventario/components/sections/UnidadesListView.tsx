/**
 * UnidadesListView · vista de listado de unidades individuales (FEFO)
 *
 * Extraído de `pages/Unidades/Unidades.tsx` (S3.6 M1 chk4.4 · fusión).
 * Se renderiza dentro del modo "Unidades" del tab Inventario.
 *
 * NO renderiza header ni KPI strip · esos vienen del shell `InventarioPageV2`.
 * SÍ renderiza: filtros + búsqueda + paginación + cards apiladas (canon F4) /
 * tabla densa + modales propios (UnidadDetails · EditarVencimiento).
 *
 * Mantiene la lógica original 1:1: filtros (producto, casilla, estado, país),
 * pipeline tabs (origen/tránsito/Perú/reservada/vendida/problemas), búsqueda
 * por SKU/nombre/lote/almacén, paginación, FEFO sort.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Package, Eye, Calendar, RefreshCw } from 'lucide-react';
import { formatFecha, calcularDiasParaVencer as calcularDiasParaVencerUtil } from '../../../../utils/dateFormatters';
import { getDescripcionProducto } from '../../../../utils/producto.helpers';
import { formatCurrency } from '../../../../utils/format';
import {
  Card,
  Badge,
  Select,
  Button,
  ListSummary,
  Pagination,
  LineaNegocioBadge,
  PaisOrigenBadge,
} from '../../../../components/common';
import { Toolbar, FilterDrawer, FilterSection, DataTable } from '../../../../design-system';
import type { DataTableColumn } from '../../../../design-system';
import { UnidadDetailsModal } from '../detail/UnidadDetailsModal';
import { UnidadCard } from '../cards/UnidadCard';
import { EditarVencimientoModal } from '../modals/EditarVencimientoModal';
import { useUnidadStore } from '../../../../store/unidadStore';
import { useProductoStore } from '../../../../store/productoStore';
import { useAlmacenStore } from '../../../../store/casillaStore';
import { useToastStore } from '../../../../store/toastStore';
import { useAuthStore } from '../../../../store/authStore';
import { unidadService } from '../../../../services/unidad.service';
import type { Unidad, EstadoUnidad } from '../../../../types/unidad.types';
import { useLineaFilter } from '../../../../hooks/useLineaFilter';
import { esEstadoEnOrigen, esEstadoEnTransitoOrigen, getLabelEstadoUnidad, getPaisEmoji } from '../../../../utils/multiOrigen.helpers';

type VistaUnidades = 'cards' | 'tabla';

const getColorVencimiento = (dias: number): string => {
  if (dias < 0) return 'text-rose-700';
  if (dias <= 30) return 'text-amber-700';
  if (dias <= 90) return 'text-yellow-700';
  return 'text-slate-700';
};

const getEstadoBadgeMeta = (estado: EstadoUnidad | string, paisOrigen?: string) => {
  const variantMap: Record<string, 'success' | 'info' | 'warning' | 'default' | 'danger'> = {
    recibida_usa: 'success',
    recibida_origen: 'success',
    en_transito_usa: 'info',
    en_transito_origen: 'info',
    en_transito_peru: 'info',
    disponible_peru: 'success',
    reservada: 'warning',
    vendida: 'default',
    vencida: 'danger',
    danada: 'danger',
    entregada: 'warning',
    asignada_pedido: 'warning',
  };
  const variant = variantMap[estado] || 'default';
  const label = getLabelEstadoUnidad(estado as EstadoUnidad, paisOrigen);
  return { variant, label };
};

export const UnidadesListView: React.FC = () => {
  const { unidades, loading, fetchUnidades, fetchStats } = useUnidadStore();
  const { productos, fetchProductos } = useProductoStore();
  const { almacenes, fetchAlmacenes } = useAlmacenStore();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  const unidadesPorLinea = useLineaFilter(unidades, u => u.lineaNegocioId);

  const [filtros, setFiltros] = useState({
    productoId: '',
    casillaId: '',
    estado: '' as EstadoUnidad | '',
    pais: '' as string,
  });
  const [busqueda, setBusqueda] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [unidadSeleccionada, setUnidadSeleccionada] = useState<Unidad | null>(null);
  const [showEditarVencimiento, setShowEditarVencimiento] = useState(false);
  const [vistaActual, setVistaActual] = useState<VistaUnidades>(
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'tabla'
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);

  useEffect(() => {
    fetchUnidades();
    fetchStats();
    fetchProductos();
    fetchAlmacenes();
  }, [fetchUnidades, fetchStats, fetchProductos, fetchAlmacenes]);

  const unidadesFiltradas = useMemo(() => {
    return unidadesPorLinea.filter(unidad => {
      if (busqueda) {
        const term = busqueda.toLowerCase();
        const matchSearch =
          unidad.productoSKU?.toLowerCase().includes(term) ||
          unidad.productoNombre?.toLowerCase().includes(term) ||
          unidad.lote?.toLowerCase().includes(term) ||
          (unidad.casillaNombre || unidad.almacenNombre)?.toLowerCase().includes(term);
        if (!matchSearch) return false;
      }

      if (filtros.productoId && unidad.productoId !== filtros.productoId) return false;
      if (filtros.casillaId && (unidad.casillaActualId || unidad.almacenId) !== filtros.casillaId) return false;
      if (filtros.estado) {
        if (filtros.estado === 'recibida_origen') {
          if (!esEstadoEnOrigen(unidad.estado)) return false;
        } else if (filtros.estado === 'en_transito_origen') {
          if (!esEstadoEnTransitoOrigen(unidad.estado)) return false;
        } else if (unidad.estado !== filtros.estado) {
          return false;
        }
      }
      if (filtros.pais && unidad.pais !== filtros.pais) return false;
      return true;
    });
  }, [unidadesPorLinea, filtros, busqueda]);

  const unidadesPaginadas = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return unidadesFiltradas.slice(startIndex, startIndex + pageSize);
  }, [unidadesFiltradas, currentPage, pageSize]);

  const productosMap = useMemo(() => {
    const map = new Map<string, { presentacion?: string; contenido?: string; dosaje?: string; sabor?: string; atributosSkincare?: any }>();
    productos.forEach(p => {
      if (p.presentacion || p.contenido || p.dosaje || p.sabor || p.atributosSkincare) {
        map.set(p.id, { presentacion: p.presentacion, contenido: p.contenido, dosaje: p.dosaje, sabor: p.sabor, atributosSkincare: p.atributosSkincare });
      }
    });
    return map;
  }, [productos]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtros, busqueda]);

  const limpiarFiltros = () => {
    setFiltros({ productoId: '', casillaId: '', estado: '', pais: '' });
    setBusqueda('');
    setCurrentPage(1);
  };

  const handleSincronizar = async () => {
    setSincronizando(true);
    try {
      const resultado = await unidadService.sincronizarUnidadesHuerfanas();
      if (resultado.unidadesSincronizadas > 0) {
        addToast('success', `Se sincronizaron ${resultado.unidadesSincronizadas} unidades huérfanas`, 5000);
        fetchUnidades();
        fetchStats();
      } else {
        addToast('success', 'No hay unidades huérfanas para sincronizar');
      }
    } catch (error: any) {
      console.error('Error sincronizando:', error);
      addToast('error', `Error al sincronizar: ${error.message}`);
    } finally {
      setSincronizando(false);
    }
  };

  const hayFiltrosActivos = busqueda || filtros.productoId || filtros.casillaId || filtros.estado || filtros.pais;

  const tablaColumns: DataTableColumn<Unidad>[] = [
    {
      key: 'producto',
      header: 'Producto',
      render: unidad => (
        <div>
          <div className="text-sm font-medium text-slate-900 tabular-nums">{unidad.productoSKU || '-'}</div>
          <div className="text-sm text-slate-500">{unidad.productoNombre || '-'}</div>
          {(() => {
            const pInfo = productosMap.get(unidad.productoId);
            const desc = pInfo ? getDescripcionProducto(pInfo) : '';
            return desc ? <div className="text-[10px] text-slate-400">{desc}</div> : null;
          })()}
          <div className="flex items-center gap-1 mt-0.5">
            <LineaNegocioBadge lineaNegocioId={unidad.lineaNegocioId} />
            <PaisOrigenBadge paisOrigen={unidad.paisOrigen} />
          </div>
        </div>
      ),
    },
    {
      key: 'lote',
      header: 'Lote',
      hideOnMobile: true,
      render: unidad => <div className="text-sm text-slate-900 tabular-nums">{unidad.lote || '-'}</div>,
    },
    {
      key: 'vencimiento',
      header: 'Vencimiento',
      hideOnMobile: true,
      render: unidad => {
        const diasVencer = calcularDiasParaVencerUtil(unidad.fechaVencimiento) ?? 0;
        return (
          <div>
            <div className="text-sm text-slate-900 tabular-nums">{formatFecha(unidad.fechaVencimiento)}</div>
            <div className={`text-xs font-medium tabular-nums ${getColorVencimiento(diasVencer)}`}>
              {diasVencer < 0 ? `Vencido hace ${Math.abs(diasVencer)} días` : `${diasVencer} días`}
            </div>
          </div>
        );
      },
    },
    {
      key: 'almacen',
      header: 'Casilla',
      render: unidad => (
        <div className="text-sm text-slate-900">
          {getPaisEmoji(unidad.pais)} {unidad.casillaNombre || unidad.almacenNombre || '-'}
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: unidad => {
        const meta = getEstadoBadgeMeta(unidad.estado, unidad.paisOrigen || unidad.pais);
        return <Badge variant={meta.variant}>{meta.label}</Badge>;
      },
    },
    {
      key: 'envio',
      header: 'Envío',
      hideOnMobile: true,
      render: unidad => unidad.envioNumero
        ? <span className="text-xs font-medium text-sky-600 tabular-nums">{unidad.envioNumero}</span>
        : <span className="text-xs text-slate-300">—</span>,
    },
    {
      key: 'costoUSD',
      header: 'Costo USD',
      align: 'right',
      render: unidad => (
        <span className="text-sm text-slate-900 tabular-nums">
          {formatCurrency(unidad.costoUnitarioUSD || 0)}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'center',
      render: unidad => (
        <button
          onClick={() => setUnidadSeleccionada(unidad)}
          className="p-1.5 text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded-lg transition-colors"
          title="Ver detalles"
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {/* Acciones secundarias específicas del modo Unidades */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => setShowEditarVencimiento(true)}
          className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5"
        >
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">Vencimientos</span>
        </Button>
        <Button
          variant="ghost"
          onClick={handleSincronizar}
          disabled={sincronizando}
          className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          title="Sincronizar unidades huérfanas"
        >
          <RefreshCw className={`h-5 w-5 ${sincronizando ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Toolbar (búsqueda + view mode + filtros) */}
      <Toolbar
        search={{ value: busqueda, onChange: setBusqueda, placeholder: 'Buscar por SKU, nombre, lote o almacén...' }}
        viewMode={vistaActual === 'tabla' ? 'table' : 'card'}
        onViewModeChange={(mode) => setVistaActual(mode === 'table' ? 'tabla' : 'cards')}
        filterCount={[filtros.productoId, filtros.casillaId, filtros.estado, filtros.pais].filter(Boolean).length}
        onFilterToggle={() => setShowFilters(true)}
        resultCount={unidadesFiltradas.length}
      />

      <FilterDrawer
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        onClearAll={() => setFiltros({ productoId: '', casillaId: '', estado: '' as any, pais: '' })}
        activeFilterCount={[filtros.productoId, filtros.casillaId, filtros.estado, filtros.pais].filter(Boolean).length}
      >
        <FilterSection title="Producto">
          <Select
            label="Producto"
            value={filtros.productoId}
            onChange={(e) => setFiltros({ ...filtros, productoId: e.target.value })}
            options={[{ value: '', label: 'Todos' }, ...productos.map(p => ({ value: p.id, label: `${p.sku} - ${p.nombreComercial}` }))]}
          />
        </FilterSection>
        <FilterSection title="Ubicación">
          <Select
            label="Casilla"
            value={filtros.casillaId}
            onChange={(e) => setFiltros({ ...filtros, casillaId: e.target.value })}
            options={[{ value: '', label: 'Todas' }, ...almacenes.map(a => ({ value: a.id, label: a.nombre }))]}
          />
          <Select
            label="País"
            value={filtros.pais}
            onChange={(e) => setFiltros({ ...filtros, pais: e.target.value })}
            options={[{ value: '', label: 'Todos' }, { value: 'USA', label: 'USA' }, { value: 'Peru', label: 'Perú' }]}
          />
        </FilterSection>
        <FilterSection title="Estado">
          <Select
            label="Estado"
            value={filtros.estado}
            onChange={(e) => setFiltros({ ...filtros, estado: e.target.value as EstadoUnidad | '' })}
            options={[
              { value: '', label: 'Todos' },
              { value: 'pedida', label: 'Pedida' },
              { value: 'en_transito', label: 'En Tránsito' },
              { value: 'disponible', label: 'Disponible' },
              { value: 'reservada', label: 'Reservada' },
              { value: 'vendida', label: 'Vendida' },
              { value: 'danada', label: 'Dañada' },
            ]}
          />
        </FilterSection>
      </FilterDrawer>

      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">
          Mostrando <span className="font-medium tabular-nums">{unidadesPaginadas.length}</span> de{' '}
          <span className="font-medium tabular-nums">{unidadesFiltradas.length}</span> unidades
          {unidadesFiltradas.length !== unidadesPorLinea.length && ` (${unidadesPorLinea.length} total)`}
        </span>
        {hayFiltrosActivos && (
          <button
            onClick={limpiarFiltros}
            className="text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Vista cards apiladas o tabla */}
      {vistaActual === 'cards' ? (
        <>
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
              </div>
            ) : unidadesPaginadas.length === 0 ? (
              <Card padding="lg">
                <div className="text-center py-8">
                  <Package className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="mt-2 text-sm font-medium text-slate-900">No hay unidades</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Las unidades se crean automáticamente al recibir órdenes de compra
                  </p>
                </div>
              </Card>
            ) : (
              unidadesPaginadas.map((unidad) => (
                <UnidadCard
                  key={unidad.id}
                  unidad={unidad}
                  productoInfo={productosMap.get(unidad.productoId)}
                  onVerDetalle={() => setUnidadSeleccionada(unidad)}
                />
              ))
            )}
          </div>

          {!loading && unidadesFiltradas.length > 0 && (
            <Card padding="sm">
              <Pagination
                currentPage={currentPage}
                totalItems={unidadesFiltradas.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[12, 24, 48, 96]}
                showPageSizeSelector
                showItemsInfo
              />
            </Card>
          )}
        </>
      ) : (
        <Card padding="md">
          {unidadesFiltradas.length === 0 && !loading ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-2 text-sm font-medium text-slate-900">No hay unidades</h3>
              <p className="mt-1 text-sm text-slate-500">
                Las unidades se crean automáticamente al recibir órdenes de compra
              </p>
            </div>
          ) : (
            <DataTable
              columns={tablaColumns}
              data={unidadesPaginadas.filter(u => u && u.estado)}
              keyExtractor={u => u.id}
              loading={loading}
            />
          )}
          {!loading && unidadesFiltradas.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 space-y-4">
              <ListSummary
                filteredCount={unidadesFiltradas.length}
                totalCount={unidadesPorLinea.length}
                itemLabel="unidades"
                summaryItems={[
                  {
                    label: 'Valor Total',
                    value: `$${unidadesFiltradas.reduce((sum, u) => sum + (u.costoUnitarioUSD || 0), 0).toFixed(2)}`,
                    icon: 'money',
                    variant: 'info',
                  },
                  {
                    label: 'Disponibles',
                    value: unidadesFiltradas.filter(u => u.estado === 'disponible_peru' || esEstadoEnOrigen(u.estado)).length,
                    icon: 'package',
                    variant: 'success',
                  },
                  {
                    label: 'Reservadas',
                    value: unidadesFiltradas.filter(u => u.estado === 'reservada').length,
                    icon: 'package',
                    variant: 'warning',
                  },
                ]}
              />
              <Pagination
                currentPage={currentPage}
                totalItems={unidadesFiltradas.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[25, 50, 100, 200]}
                showPageSizeSelector
                showItemsInfo
              />
            </div>
          )}
        </Card>
      )}

      {/* Modales internos */}
      <EditarVencimientoModal
        isOpen={showEditarVencimiento}
        onClose={() => setShowEditarVencimiento(false)}
        unidades={unidades}
        productosMap={productosMap}
        onSuccess={() => {
          fetchUnidades();
          fetchStats();
        }}
      />

      {unidadSeleccionada && (
        <UnidadDetailsModal
          unidad={unidadSeleccionada}
          productoInfo={productosMap.get(unidadSeleccionada.productoId)}
          onClose={() => setUnidadSeleccionada(null)}
          onLiberarReserva={async (unidad) => {
            if (!user) return;
            const confirmar = window.confirm(
              `¿Liberar la reserva de la unidad ${unidad.lote}?\n\nLa unidad volverá al estado "Disponible Perú" y podrá ser asignada a otra cotización.`
            );
            if (!confirmar) return;
            try {
              const resultado = await unidadService.liberarUnidades(
                [unidad.id],
                'Liberación manual desde detalle de unidad',
                user.uid
              );
              if (resultado.exitos > 0) {
                addToast('success', 'Reserva liberada exitosamente');
                setUnidadSeleccionada(null);
                await fetchUnidades();
                await fetchStats();
              } else {
                addToast('error', 'No se pudo liberar la reserva');
              }
            } catch (error: any) {
              addToast('error', error.message || 'Error al liberar reserva');
            }
          }}
        />
      )}
    </div>
  );
};
