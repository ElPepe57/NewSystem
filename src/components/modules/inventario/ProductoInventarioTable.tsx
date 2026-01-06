import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Package,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingUp,
  Search,
  ArrowUpDown
} from 'lucide-react';
import { Badge } from '../../common';
import { UnidadesDesglose } from './UnidadesDesglose';
import type { Unidad, EstadoUnidad } from '../../../types/unidad.types';

// Interfaz para producto con sus unidades agrupadas
export interface ProductoConUnidades {
  productoId: string;
  sku: string;
  nombre: string;
  marca: string;
  grupo: string;
  unidades: Unidad[];
  // Conteos por estado
  recibidaUSA: number;
  enTransitoUSA: number;
  enTransitoPeru: number;
  disponiblePeru: number;
  reservada: number;
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
}

interface ProductoInventarioTableProps {
  productos: ProductoConUnidades[];
  loading?: boolean;
  onUnidadClick?: (unidad: Unidad) => void;
  filtroEstado?: string | null;
}

// Configuración de ordenamiento
type SortKey = 'sku' | 'nombre' | 'usa' | 'transito' | 'peru' | 'reservadas' | 'total' | 'valor' | 'vencer';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

export const ProductoInventarioTable: React.FC<ProductoInventarioTableProps> = ({
  productos,
  loading = false,
  onUnidadClick,
  filtroEstado
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Función para obtener el valor de ordenamiento
  const getSortValue = (producto: ProductoConUnidades, key: SortKey): number | string => {
    switch (key) {
      case 'sku': return producto.sku.toLowerCase();
      case 'nombre': return producto.nombre.toLowerCase();
      case 'usa': return producto.recibidaUSA;
      case 'transito': return producto.enTransitoUSA + producto.enTransitoPeru;
      case 'peru': return producto.disponiblePeru;
      case 'reservadas': return producto.reservada;
      case 'total': return producto.totalUnidades;
      case 'valor': return producto.valorTotalUSD;
      case 'vencer': return producto.proximasAVencer30Dias;
      default: return 0;
    }
  };

  // Filtrar y ordenar productos
  const productosFiltrados = useMemo(() => {
    let resultado = Array.isArray(productos) ? productos : [];

    // Filtrar por búsqueda (con validación segura)
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

    // Ordenar
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

  // Handler para cambiar ordenamiento
  const handleSort = (key: SortKey) => {
    setSortConfig(current => {
      if (current?.key === key) {
        // Si ya está ordenado por esta columna, cambiar dirección o quitar
        if (current.direction === 'asc') {
          return { key, direction: 'desc' };
        } else {
          return null; // Quitar ordenamiento
        }
      }
      // Nueva columna, ordenar ascendente
      return { key, direction: 'asc' };
    });
  };

  // Componente para header ordenable
  const SortableHeader: React.FC<{
    sortKey: SortKey;
    children: React.ReactNode;
    className?: string;
  }> = ({ sortKey, children, className = '' }) => {
    const isActive = sortConfig?.key === sortKey;
    const direction = isActive ? sortConfig.direction : null;

    return (
      <th
        className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none ${className}`}
        onClick={() => handleSort(sortKey)}
      >
        <div className="flex items-center justify-center gap-1">
          <span>{children}</span>
          <span className="w-4 h-4 flex items-center justify-center">
            {isActive ? (
              direction === 'asc' ? (
                <ChevronUp className="h-3.5 w-3.5 text-primary-600" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-primary-600" />
              )
            ) : (
              <ArrowUpDown className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100" />
            )}
          </span>
        </div>
      </th>
    );
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

  const expandAll = () => {
    setExpandedRows(new Set(productosFiltrados.map(p => p.productoId)));
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Obtener unidades filtradas por estado si hay filtro activo
  const getUnidadesFiltradas = (producto: ProductoConUnidades): Unidad[] => {
    if (!filtroEstado) return producto.unidades;

    return producto.unidades.filter(u => {
      switch (filtroEstado) {
        case 'recibida_usa':
          return u.estado === 'recibida_usa';
        case 'en_transito':
          return u.estado === 'en_transito_usa' || u.estado === 'en_transito_peru';
        case 'disponible_peru':
          return u.estado === 'disponible_peru';
        case 'reservada':
          return u.estado === 'reservada';
        case 'problemas':
          return u.estado === 'vencida' || u.estado === 'danada';
        default:
          return true;
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (productos.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay productos en inventario</h3>
        <p className="mt-1 text-sm text-gray-500">
          Las unidades se crean automáticamente al recibir órdenes de compra
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda y acciones */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por SKU, nombre, marca o grupo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium px-3 py-1.5 rounded hover:bg-primary-50"
          >
            Expandir todos
          </button>
          <button
            onClick={collapseAll}
            className="text-xs text-gray-600 hover:text-gray-700 font-medium px-3 py-1.5 rounded hover:bg-gray-100"
          >
            Colapsar todos
          </button>
        </div>
      </div>

      {/* Contador de resultados */}
      <div className="text-sm text-gray-600">
        Mostrando <span className="font-medium">{productosFiltrados.length}</span> productos
        {busqueda && ` que coinciden con "${busqueda}"`}
      </div>

      {/* Indicador de ordenamiento activo */}
      {sortConfig && (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-primary-50 px-3 py-2 rounded-lg">
          <ArrowUpDown className="h-4 w-4 text-primary-600" />
          <span>
            Ordenado por <strong>{sortConfig.key === 'sku' ? 'SKU' : sortConfig.key === 'nombre' ? 'Nombre' : sortConfig.key === 'usa' ? 'USA' : sortConfig.key === 'transito' ? 'Tránsito' : sortConfig.key === 'peru' ? 'Perú' : sortConfig.key === 'reservadas' ? 'Reservadas' : sortConfig.key === 'total' ? 'Total' : sortConfig.key === 'valor' ? 'Valor' : 'Por Vencer'}</strong>
            {' '}({sortConfig.direction === 'asc' ? 'ascendente' : 'descendente'})
          </span>
          <button
            onClick={() => setSortConfig(null)}
            className="ml-2 text-primary-600 hover:text-primary-700 font-medium"
          >
            Quitar orden
          </button>
        </div>
      )}

      {/* Tabla */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr className="group">
              <th className="w-10 px-4 py-3"></th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('sku')}
              >
                <div className="flex items-center gap-1">
                  <span>Producto</span>
                  {sortConfig?.key === 'sku' ? (
                    sortConfig.direction === 'asc' ? (
                      <ChevronUp className="h-3.5 w-3.5 text-primary-600" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-primary-600" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-gray-400" />
                  )}
                </div>
              </th>
              <SortableHeader sortKey="usa">USA</SortableHeader>
              <SortableHeader sortKey="transito">Tránsito</SortableHeader>
              <SortableHeader sortKey="peru">Perú</SortableHeader>
              <SortableHeader sortKey="reservadas">Reserv.</SortableHeader>
              <SortableHeader sortKey="total">Total</SortableHeader>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('valor')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Valor USD</span>
                  {sortConfig?.key === 'valor' ? (
                    sortConfig.direction === 'asc' ? (
                      <ChevronUp className="h-3.5 w-3.5 text-primary-600" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-primary-600" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-gray-400" />
                  )}
                </div>
              </th>
              <SortableHeader sortKey="vencer">Estado</SortableHeader>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {productosFiltrados.map((producto) => {
              const isExpanded = expandedRows.has(producto.productoId);
              const unidadesFiltradas = getUnidadesFiltradas(producto);

              return (
                <React.Fragment key={producto.productoId}>
                  {/* Fila principal del producto */}
                  <tr
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                      isExpanded ? 'bg-primary-50' : ''
                    }`}
                    onClick={() => toggleRow(producto.productoId)}
                  >
                    {/* Toggle */}
                    <td className="px-4 py-4">
                      <button
                        className="p-1 rounded hover:bg-gray-200 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRow(producto.productoId);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                    </td>

                    {/* Producto Info */}
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Package className="h-5 w-5 text-gray-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {producto.sku}
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            {producto.marca} · {producto.nombre}
                          </div>
                          <div className="text-xs text-gray-400">
                            {producto.grupo}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Stock USA */}
                    <td className="px-4 py-4 text-center">
                      <div className="text-sm font-medium text-blue-600">
                        {producto.recibidaUSA}
                      </div>
                    </td>

                    {/* En Tránsito */}
                    <td className="px-4 py-4 text-center">
                      <div className="text-sm font-medium text-amber-600">
                        {producto.enTransitoUSA + producto.enTransitoPeru}
                      </div>
                    </td>

                    {/* Stock Perú */}
                    <td className="px-4 py-4 text-center">
                      <div className="text-sm font-medium text-green-600">
                        {producto.disponiblePeru}
                      </div>
                    </td>

                    {/* Reservadas */}
                    <td className="px-4 py-4 text-center">
                      <div className="text-sm font-medium text-purple-600">
                        {producto.reservada}
                      </div>
                    </td>

                    {/* Total */}
                    <td className="px-4 py-4 text-center">
                      <div className="text-sm font-bold text-gray-900">
                        {producto.totalUnidades}
                      </div>
                    </td>

                    {/* Valor */}
                    <td className="px-4 py-4 text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(producto.valorTotalUSD)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Prom: {formatCurrency(producto.costoPromedioUSD)}
                      </div>
                    </td>

                    {/* Estado/Alertas */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {producto.stockCritico && (
                          <Badge variant="danger" size="sm">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Crítico
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
                    </td>
                  </tr>

                  {/* Fila expandida con desglose de unidades */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={9} className="px-0 py-0">
                        <div className="bg-gray-50 border-t border-b border-gray-200">
                          <UnidadesDesglose
                            unidades={unidadesFiltradas}
                            productoNombre={producto.nombre}
                            onUnidadClick={onUnidadClick}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
