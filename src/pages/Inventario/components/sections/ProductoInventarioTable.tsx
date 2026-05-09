import React, { useState, useMemo } from 'react';
import { formatCurrency } from '../../../../utils/format';
import { getDescripcionProducto } from '../../../../utils/producto.helpers';
import {
  Package,
  AlertTriangle,
  Clock,
  Search,
  ArrowUpDown,
} from 'lucide-react';
import { Badge, LineaNegocioBadge } from '../../../../components/common';
import { DataTable } from '../../../../design-system';
import type { DataTableColumn } from '../../../../design-system';
import { UnidadesDesglose } from './UnidadesDesglose';
import type { Unidad } from '../../../../types/unidad.types';
import { esEstadoEnOrigen, esEstadoEnTransitoOrigen } from '../../../../utils/multiOrigen.helpers';

// Interfaz para producto con sus unidades agrupadas
export interface ProductoConUnidades {
  productoId: string;
  sku: string;
  nombre: string;
  marca: string;
  grupo: string;
  presentacion?: string;
  contenido?: string;
  dosaje?: string;
  sabor?: string;
  unidades: Unidad[];
  // Conteos por estado
  enOrigen: number;
  enTransitoOrigen: number;
  enTransitoPeru: number;
  disponiblePeru: number;
  reservada: number;
  reservadaOrigen: number;
  reservadaPeru: number;
  vendida: number;
  problemas: number; // vencida + danada
  // Totales
  totalUnidades: number;
  totalDisponibles: number;
  // Valores
  valorTotalUSD: number;
  costoPromedioUSD: number;
  // Alertas
  proximasAVencer30Dias: number;
  stockCritico: boolean;
  lineaNegocioId?: string;
}

interface ProductoInventarioTableProps {
  productos: ProductoConUnidades[];
  loading?: boolean;
  onUnidadClick?: (unidad: Unidad) => void;
  filtroEstado?: string | null;
}

// Configuracion de ordenamiento
type SortKey = 'sku' | 'nombre' | 'origen' | 'transito' | 'peru' | 'resOrigen' | 'resPeru' | 'vendidas' | 'total' | 'valor' | 'vencer';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

const SORT_KEY_LABELS: Record<SortKey, string> = {
  sku: 'SKU',
  nombre: 'Nombre',
  origen: 'Origen',
  transito: 'Transito',
  peru: 'Peru',
  resOrigen: 'Res. Origen',
  resPeru: 'Res. Peru',
  vendidas: 'Vendidas',
  total: 'Total',
  valor: 'Valor',
  vencer: 'Por Vencer',
};

export const ProductoInventarioTable: React.FC<ProductoInventarioTableProps> = ({
  productos,
  loading = false,
  onUnidadClick,
  filtroEstado
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const getSortValue = (producto: ProductoConUnidades, key: SortKey): number | string => {
    switch (key) {
      case 'sku': return producto.sku.toLowerCase();
      case 'nombre': return producto.nombre.toLowerCase();
      case 'origen': return producto.enOrigen;
      case 'transito': return producto.enTransitoOrigen + producto.enTransitoPeru;
      case 'peru': return producto.disponiblePeru;
      case 'resOrigen': return producto.reservadaOrigen;
      case 'resPeru': return producto.reservadaPeru;
      case 'vendidas': return producto.vendida;
      case 'total': return producto.totalUnidades;
      case 'valor': return producto.valorTotalUSD;
      case 'vencer': return producto.proximasAVencer30Dias;
      default: return 0;
    }
  };

  const productosFiltrados = useMemo(() => {
    let resultado = Array.isArray(productos) ? productos : [];

    if (busqueda) {
      const term = busqueda.toLowerCase();
      resultado = resultado.filter(p => {
        const sku = (p.sku ?? '').toLowerCase();
        const nombre = (p.nombre ?? '').toLowerCase();
        const marca = (p.marca ?? '').toLowerCase();
        const grupo = (p.grupo ?? '').toLowerCase();
        return sku.includes(term) || nombre.includes(term) || marca.includes(term) || grupo.includes(term);
      });
    }

    if (sortConfig) {
      resultado = [...resultado].sort((a, b) => {
        const aValue = getSortValue(a, sortConfig.key);
        const bValue = getSortValue(b, sortConfig.key);
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return resultado;
  }, [productos, busqueda, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return current.direction === 'asc' ? { key, direction: 'desc' } : null;
      }
      return { key, direction: 'asc' };
    });
  };

  // Handler de sort del DataTable — recibe key como string
  const handleDataTableSort = (key: string) => {
    handleSort(key as SortKey);
  };

  const toggleRow = (productoId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productoId)) {
        newSet.delete(productoId);
      } else {
        newSet.add(productoId);
      }
      return newSet;
    });
  };

  const expandAll = () => setExpandedRows(new Set(productosFiltrados.map(p => p.productoId)));
  const collapseAll = () => setExpandedRows(new Set());

  const getUnidadesFiltradas = (producto: ProductoConUnidades): Unidad[] => {
    if (!filtroEstado) return producto.unidades;
    return producto.unidades.filter(u => {
      switch (filtroEstado) {
        case 'en_origen': return esEstadoEnOrigen(u.estado);
        case 'en_transito': return esEstadoEnTransitoOrigen(u.estado) || u.estado === 'en_transito_peru';
        case 'disponible_peru': return u.estado === 'disponible_peru';
        case 'reservada': return u.estado === 'reservada';
        case 'vendida': return u.estado === 'vendida';
        case 'problemas': return u.estado === 'vencida' || u.estado === 'danada';
        default: return true;
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (productos.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-slate-400" />
        <h3 className="mt-2 text-sm font-medium text-slate-900">No hay productos en inventario</h3>
        <p className="mt-1 text-sm text-slate-500">
          Las unidades se crean automaticamente al recibir ordenes de compra
        </p>
      </div>
    );
  }

  const columns: DataTableColumn<ProductoConUnidades>[] = [
    {
      key: 'sku',
      header: 'Producto',
      sortable: true,
      render: (producto) => (
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Package className="h-5 w-5 text-slate-400" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-slate-900 truncate">{producto.sku}</div>
            <div className="text-sm text-slate-500 truncate">{producto.marca} · {producto.nombre}</div>
            <div className="text-xs text-slate-400">{getDescripcionProducto(producto) || producto.grupo}</div>
            <LineaNegocioBadge lineaNegocioId={producto.lineaNegocioId} />
          </div>
        </div>
      ),
    },
    {
      key: 'origen',
      header: 'Origen',
      align: 'center',
      sortable: true,
      hideOnMobile: true,
      render: (producto) => (
        <span className="text-sm font-medium text-sky-600">{producto.enOrigen}</span>
      ),
    },
    {
      key: 'transito',
      header: 'Transito',
      align: 'center',
      sortable: true,
      hideOnMobile: true,
      render: (producto) => (
        <span className="text-sm font-medium text-amber-600">
          {producto.enTransitoOrigen + producto.enTransitoPeru}
        </span>
      ),
    },
    {
      key: 'peru',
      header: 'Peru',
      align: 'center',
      sortable: true,
      render: (producto) => (
        <span className="text-sm font-medium text-emerald-600">{producto.disponiblePeru}</span>
      ),
    },
    {
      key: 'resOrigen',
      header: 'Res. Origen',
      align: 'center',
      sortable: true,
      hideOnMobile: true,
      render: (producto) => (
        <span className="text-sm font-medium text-purple-600">{producto.reservadaOrigen}</span>
      ),
    },
    {
      key: 'resPeru',
      header: 'Res. Peru',
      align: 'center',
      sortable: true,
      hideOnMobile: true,
      render: (producto) => (
        <span className="text-sm font-medium text-purple-500">{producto.reservadaPeru}</span>
      ),
    },
    {
      key: 'vendidas',
      header: 'Vendidas',
      align: 'center',
      sortable: true,
      hideOnMobile: true,
      render: (producto) => (
        <span className="text-sm font-medium text-emerald-600">{producto.vendida}</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'center',
      sortable: true,
      render: (producto) => (
        <span className="text-sm font-bold text-slate-900">{producto.totalUnidades}</span>
      ),
    },
    {
      key: 'valor',
      header: 'Valor USD',
      align: 'right',
      sortable: true,
      render: (producto) => (
        <div>
          <div className="text-sm font-medium text-slate-900">{formatCurrency(producto.valorTotalUSD)}</div>
          <div className="text-xs text-slate-500">Prom: {formatCurrency(producto.costoPromedioUSD)}</div>
        </div>
      ),
    },
    {
      key: 'vencer',
      header: 'Estado',
      align: 'center',
      sortable: true,
      render: (producto) => (
        <div className="flex flex-col items-center gap-1">
          {producto.stockCritico && (
            <Badge variant="danger" size="sm">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Critico
            </Badge>
          )}
          {producto.proximasAVencer30Dias > 0 && (
            <Badge variant="warning" size="sm">
              <Clock className="h-3 w-3 mr-1" />
              {producto.proximasAVencer30Dias} por vencer
            </Badge>
          )}
          {producto.problemas > 0 && (
            <Badge variant="danger" size="sm">
              {producto.problemas} problemas
            </Badge>
          )}
          {!producto.stockCritico && producto.proximasAVencer30Dias === 0 && producto.problemas === 0 && (
            <Badge variant="success" size="sm">OK</Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Barra de busqueda y acciones */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por SKU, nombre, marca o grupo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-teal-600 hover:text-teal-700 font-medium px-3 py-1.5 rounded hover:bg-teal-50"
          >
            Expandir todos
          </button>
          <button
            onClick={collapseAll}
            className="text-xs text-slate-600 hover:text-slate-700 font-medium px-3 py-1.5 rounded hover:bg-slate-100"
          >
            Colapsar todos
          </button>
        </div>
      </div>

      {/* Contador de resultados */}
      <div className="text-sm text-slate-600">
        Mostrando <span className="font-medium">{productosFiltrados.length}</span> productos
        {busqueda && ` que coinciden con "${busqueda}"`}
      </div>

      {/* Indicador de ordenamiento activo */}
      {sortConfig && (
        <div className="flex items-center gap-2 text-sm text-slate-600 bg-teal-50 px-3 py-2 rounded-lg">
          <ArrowUpDown className="h-4 w-4 text-teal-600" />
          <span>
            Ordenado por <strong>{SORT_KEY_LABELS[sortConfig.key]}</strong>
            {' '}({sortConfig.direction === 'asc' ? 'ascendente' : 'descendente'})
          </span>
          <button
            onClick={() => setSortConfig(null)}
            className="ml-2 text-teal-600 hover:text-teal-700 font-medium"
          >
            Quitar orden
          </button>
        </div>
      )}

      {/* Tabla */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <DataTable<ProductoConUnidades>
          columns={columns}
          data={productosFiltrados}
          keyExtractor={(item) => item.productoId}
          sortBy={sortConfig?.key}
          sortDirection={sortConfig?.direction}
          onSort={handleDataTableSort}
          expandedRowRender={(producto) => {
            const unidadesFiltradas = getUnidadesFiltradas(producto);
            return (
              <div className="bg-slate-50 border-t border-b border-slate-200">
                <UnidadesDesglose
                  unidades={unidadesFiltradas}
                  productoNombre={producto.nombre}
                  onUnidadClick={onUnidadClick}
                />
              </div>
            );
          }}
          expandedKeys={expandedRows}
          onToggleExpand={toggleRow}
          emptyMessage="No hay productos que coincidan con la busqueda"
        />
      </div>
    </div>
  );
};
