import React, { useState, useMemo } from 'react';
import { Eye, Pencil, Trash2, RefreshCw, Search, CheckCircle, XCircle, Clock, HelpCircle, DollarSign, Tag, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronUp, Columns3 } from 'lucide-react';
import { Badge } from '../../common';
import { ProductoService } from '../../../services/producto.service';
import type { Producto } from '../../../types/producto.types';
import type { CategoriaSnapshot } from '../../../types/categoria.types';
import type { EtiquetaSnapshot } from '../../../types/etiqueta.types';

// Tipo para configuración de ordenamiento múltiple
export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

// Tipo para grupos de columnas
export type ColumnGroup = 'basico' | 'clasificacion' | 'precios' | 'investigacion' | 'metricas';

interface ProductoTableProps {
  productos: Producto[];
  onView: (producto: Producto) => void;
  onEdit: (producto: Producto) => void;
  onDelete: (producto: Producto) => void;
  onReactivar?: (producto: Producto) => void;
  sortConfigs?: SortConfig[];
  onSort?: (key: string) => void;
  visibleColumns?: ColumnGroup[];
  onToggleColumn?: (group: ColumnGroup) => void;
}

// Componente para encabezado ordenable compacto
const SortableHeader: React.FC<{
  label: string;
  sortKey: string;
  sortConfigs: SortConfig[];
  onSort: (key: string) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
}> = ({ label, sortKey, sortConfigs, onSort, align = 'left', className = '' }) => {
  const sortIndex = sortConfigs.findIndex(s => s.key === sortKey);
  const currentSort = sortIndex >= 0 ? sortConfigs[sortIndex] : null;
  const sortOrder = sortIndex >= 0 ? sortIndex + 1 : null;

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  };

  return (
    <th
      className={`px-2 py-2 text-[11px] font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors select-none ${alignClasses[align]} ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : ''}`}>
        <span className="truncate">{label}</span>
        {currentSort ? (
          <span className="flex items-center flex-shrink-0">
            {currentSort.direction === 'asc' ? (
              <ArrowUp className="h-3 w-3 text-primary-600" />
            ) : (
              <ArrowDown className="h-3 w-3 text-primary-600" />
            )}
            {sortConfigs.length > 1 && (
              <span className="ml-0.5 text-[9px] bg-primary-100 text-primary-700 rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                {sortOrder}
              </span>
            )}
          </span>
        ) : (
          <ArrowUpDown className="h-3 w-3 text-gray-300 flex-shrink-0" />
        )}
      </div>
    </th>
  );
};

// Card mejorada para vista móvil/tablet con todas las métricas
const ProductoCardResponsive: React.FC<{
  producto: Producto;
  onView: (producto: Producto) => void;
  onEdit: (producto: Producto) => void;
  onDelete: (producto: Producto) => void;
  onReactivar?: (producto: Producto) => void;
}> = ({ producto, onView, onEdit, onDelete, onReactivar }) => {
  const [expanded, setExpanded] = useState(false);
  const invResumen = ProductoService.getResumenInvestigacion(producto);

  // Calcular métricas
  const inv = producto.investigacion;
  const precioCompra = inv?.ctruEstimado || 0;
  const precioVenta = inv?.precioEntrada || inv?.precioSugeridoCalculado || 0;
  const ganancia = precioVenta > 0 && precioCompra > 0 ? precioVenta - precioCompra : 0;
  const roi = precioCompra > 0 && ganancia > 0 ? (ganancia / precioCompra) * 100 : 0;
  const margen = precioVenta > 0 && precioCompra > 0 ? (ganancia / precioVenta) * 100 : 0;
  const tieneMetricas = invResumen.tieneInvestigacion && precioCompra > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header de la card */}
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-primary-600 font-semibold">{producto.sku}</span>
            {producto.esPadre && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#ecfccb', color: '#4d7c0f' }}>
                Grupo
              </span>
            )}
            <Badge variant={producto.estado === 'activo' ? 'success' : 'default'} size="sm">
              {producto.estado === 'activo' ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <div className="font-medium text-gray-900 text-sm truncate mt-1">{producto.marca}</div>
          <div className="text-xs text-gray-600 truncate">{producto.nombreComercial}</div>
          {/* Ficha descriptiva */}
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[10px] text-gray-500">
            {producto.presentacion && <span>{producto.presentacion}</span>}
            {producto.dosaje && <span>· {producto.dosaje}</span>}
            {producto.contenido && <span>· {producto.contenido}</span>}
            {producto.sabor && <span>· {producto.sabor}</span>}
          </div>
          {/* Conexión de grupo */}
          {producto.esVariante && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                Variante{producto.varianteLabel ? `: ${producto.varianteLabel}` : ''}
              </span>
            </div>
          )}
          {producto.tipoProducto && (
            <div className="flex items-center gap-1 mt-1">
              <Tag className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                {producto.tipoProducto.nombre}
              </span>
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          {invResumen.tieneInvestigacion && (
            <div className={`text-xs flex items-center justify-end gap-1 mt-1 ${invResumen.estaVigente ? 'text-green-600' : 'text-red-600'}`}>
              <Clock className="h-3 w-3" />
              {invResumen.estaVigente ? `${invResumen.diasRestantes}d` : 'Vencida'}
            </div>
          )}
        </div>
      </div>

      {/* Métricas compactas - siempre visibles si existen */}
      {tieneMetricas && (
        <div className="px-3 pb-2 grid grid-cols-4 gap-2 text-center">
          <div className="bg-blue-50 rounded p-1.5">
            <div className="text-[10px] text-gray-500">Compra Sug.</div>
            <div className="text-xs font-bold text-blue-700">S/{precioCompra.toFixed(0)}</div>
          </div>
          <div className="bg-purple-50 rounded p-1.5">
            <div className="text-[10px] text-gray-500">Venta Sug.</div>
            <div className="text-xs font-bold text-purple-700">S/{precioVenta.toFixed(0)}</div>
          </div>
          <div className="bg-gray-50 rounded p-1.5">
            <div className="text-[10px] text-gray-500">ROI</div>
            <div className={`text-xs font-bold ${roi >= 50 ? 'text-green-600' : roi >= 25 ? 'text-yellow-600' : 'text-orange-600'}`}>
              {roi.toFixed(0)}%
            </div>
          </div>
          <div className="bg-gray-50 rounded p-1.5">
            <div className="text-[10px] text-gray-500">Ganancia</div>
            <div className="text-xs font-bold text-green-600">+S/{ganancia.toFixed(0)}</div>
          </div>
        </div>
      )}

      {/* Sección expandible */}
      {expanded && (
        <div className="px-3 pb-2 border-t border-gray-100 pt-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {producto.categorias && producto.categorias.length > 0 && (
              <div>
                <span className="text-gray-500">Categorías:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {producto.categorias.map((cat: CategoriaSnapshot) => (
                    <span key={cat.categoriaId} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">
                      {cat.nombre}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {tieneMetricas && (
              <div>
                <span className="text-gray-500">Margen: </span>
                <span className={`font-medium ${margen >= 30 ? 'text-green-600' : margen >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {margen.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer con acciones */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-100">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-500 flex items-center gap-1 hover:text-gray-700"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Menos' : 'Más'}
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => onView(producto)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded" title="Ver">
            <Eye className="h-4 w-4" />
          </button>
          <button onClick={() => onEdit(producto)} className="p-1.5 text-warning-600 hover:bg-warning-50 rounded" title="Editar">
            <Pencil className="h-4 w-4" />
          </button>
          {producto.estado === 'inactivo' && onReactivar ? (
            <button onClick={() => onReactivar(producto)} className="p-1.5 text-success-600 hover:bg-success-50 rounded" title="Reactivar">
              <RefreshCw className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={() => onDelete(producto)} className="p-1.5 text-danger-600 hover:bg-danger-50 rounded" title="Eliminar">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Toggle de columnas
const ColumnToggle: React.FC<{
  visibleColumns: ColumnGroup[];
  onToggle: (group: ColumnGroup) => void;
}> = ({ visibleColumns, onToggle }) => {
  const [isOpen, setIsOpen] = useState(false);

  const columnGroups: { key: ColumnGroup; label: string; description: string }[] = [
    { key: 'basico', label: 'Básico', description: 'SKU, Producto, Estado' },
    { key: 'clasificacion', label: 'Clasificación', description: 'Tipo, Categorías' },
    { key: 'precios', label: 'Precios', description: 'PVP Sugerido' },
    { key: 'investigacion', label: 'Investigación', description: 'Estado inv.' },
    { key: 'metricas', label: 'Métricas', description: 'Compra Sug., Venta Sug., ROI, Margen, Ganancia' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Columns3 className="h-4 w-4" />
        <span className="hidden sm:inline">Columnas</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-2">
            <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase border-b border-gray-100 mb-1">
              Mostrar columnas
            </div>
            {columnGroups.map(({ key, label, description }) => (
              <label
                key={key}
                className="flex items-start gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(key)}
                  onChange={() => onToggle(key)}
                  disabled={key === 'basico'} // Básico siempre visible
                  className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{label}</div>
                  <div className="text-xs text-gray-500">{description}</div>
                </div>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const ProductoTable: React.FC<ProductoTableProps> = ({
  productos,
  onView,
  onEdit,
  onDelete,
  onReactivar,
  sortConfigs = [],
  onSort,
  visibleColumns = ['basico', 'clasificacion', 'precios', 'investigacion', 'metricas'],
  onToggleColumn
}) => {
  // Conteo de variantes por grupo (para badge "G·Nv")
  const variantCountMap = useMemo(() => {
    const map = new Map<string, number>();
    productos.forEach(p => {
      if (p.parentId) {
        map.set(p.parentId, (map.get(p.parentId) || 0) + 1);
      }
    });
    return map;
  }, [productos]);

  // Estado de grupos expandidos
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Organizar productos en grupos (agrupadores con variantes) e independientes
  const organizedProducts = useMemo(() => {
    type OrgItem = { type: 'independent'; producto: Producto }
      | { type: 'group-header'; producto: Producto; variantes: Producto[] }
      | { type: 'group-variant'; producto: Producto; parentId: string };

    const items: OrgItem[] = [];
    const variantsByParent = new Map<string, Producto[]>();
    const parentIds = new Set<string>();

    // Classify products
    productos.forEach(p => {
      if (p.esPadre) parentIds.add(p.id);
      if (p.parentId) {
        const arr = variantsByParent.get(p.parentId) || [];
        arr.push(p);
        variantsByParent.set(p.parentId, arr);
      }
    });

    // Build organized list
    productos.forEach(p => {
      if (p.esPadre) {
        const childVariantes = variantsByParent.get(p.id) || [];
        // Si el padre tiene varianteLabel, incluirlo como primera variante del grupo
        const variantes = p.varianteLabel ? [p, ...childVariantes] : childVariantes;
        items.push({ type: 'group-header', producto: p, variantes });
      } else if (p.parentId && parentIds.has(p.parentId)) {
        // Skip — rendered under parent
      } else {
        items.push({ type: 'independent', producto: p });
      }
    });

    return items;
  }, [productos]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // Estado interno para columnas si no se proporciona externamente
  const [internalVisibleColumns, setInternalVisibleColumns] = useState<ColumnGroup[]>(visibleColumns);
  const activeColumns = onToggleColumn ? visibleColumns : internalVisibleColumns;

  const handleToggleColumn = (group: ColumnGroup) => {
    if (onToggleColumn) {
      onToggleColumn(group);
    } else {
      setInternalVisibleColumns(prev =>
        prev.includes(group)
          ? prev.filter(c => c !== group)
          : [...prev, group]
      );
    }
  };

  if (productos.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">No hay productos registrados</p>
      </div>
    );
  }

  const handleSort = (key: string) => {
    if (onSort) {
      onSort(key);
    }
  };

  // Verificar visibilidad de grupos
  const showClasificacion = activeColumns.includes('clasificacion');
  const showPrecios = activeColumns.includes('precios');
  const showInvestigacion = activeColumns.includes('investigacion');
  const showMetricas = activeColumns.includes('metricas');

  return (
    <>
      {/* Vista móvil/tablet - Cards */}
      <div className="xl:hidden space-y-3">
        {organizedProducts.map((item) => {
          if (item.type === 'group-header') {
            const isExpanded = expandedGroups.has(item.producto.id);
            const varCount = item.variantes.length;
            return (
              <div key={item.producto.id}>
                {/* Group header — collapsible */}
                <button
                  type="button"
                  onClick={() => toggleGroup(item.producto.id)}
                  className="w-full bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#ecfccb', color: '#4d7c0f' }}>
                          Grupo · {varCount}v
                        </span>
                        <span className="font-medium text-gray-900 text-sm truncate">{item.producto.marca}</span>
                      </div>
                      <p className="text-xs text-gray-600 truncate">{item.producto.nombreComercial}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{isExpanded ? 'Colapsar' : `Ver ${varCount} variantes`}</span>
                </button>
                {/* Expanded variants */}
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-2 border-l-2 border-gray-200 pl-2">
                    {item.variantes.map(v => (
                      <ProductoCardResponsive
                        key={v.id}
                        producto={v}
                        onView={onView}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onReactivar={onReactivar}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          }
          // Independent product
          return (
            <ProductoCardResponsive
              key={item.producto.id}
              producto={item.producto}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onReactivar={onReactivar}
            />
          );
        })}
      </div>

      {/* Vista desktop - Tabla compacta */}
      <div className="hidden xl:block">
        {/* Barra de herramientas */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg">
          <div className="flex items-center gap-2 text-sm">
            {sortConfigs.length > 0 && (
              <>
                <span className="text-gray-500">Ordenado por:</span>
                <div className="flex items-center gap-1">
                  {sortConfigs.map((sort, index) => (
                    <span key={sort.key} className="inline-flex items-center gap-1 bg-primary-100 text-primary-700 px-2 py-0.5 rounded text-xs font-medium">
                      {sortConfigs.length > 1 && (
                        <span className="bg-primary-200 text-primary-800 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[9px] font-bold">
                          {index + 1}
                        </span>
                      )}
                      {sort.key === 'sku' && 'SKU'}
                      {sort.key === 'marca' && 'Producto'}
                      {sort.key === 'ctruPromedio' && 'CTRU'}
                      {sort.key === 'estado' && 'Estado'}
                      {sort.key === 'precioCompra' && 'Compra Sug.'}
                      {sort.key === 'precioVenta' && 'Venta Sug.'}
                      {sort.key === 'roi' && 'ROI'}
                      {sort.key === 'margen' && 'Margen'}
                      {sort.key === 'multiplicador' && 'Mult.'}
                      {sort.key === 'gananciaUnidad' && 'Ganancia'}
                      {sort.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-gray-400">(Ctrl+Click multiorden)</span>
              </>
            )}
          </div>
          <ColumnToggle visibleColumns={activeColumns} onToggle={handleToggleColumn} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {/* Columnas básicas - siempre visibles */}
                {onSort ? (
                  <>
                    <SortableHeader label="SKU" sortKey="sku" sortConfigs={sortConfigs} onSort={handleSort} className="w-24" />
                    <SortableHeader label="Producto" sortKey="marca" sortConfigs={sortConfigs} onSort={handleSort} className="min-w-[180px]" />
                  </>
                ) : (
                  <>
                    <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-500 uppercase w-24">SKU</th>
                    <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-500 uppercase min-w-[180px]">Producto</th>
                  </>
                )}

                {/* Clasificación */}
                {showClasificacion && (
                  <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-500 uppercase min-w-[120px]">Tipo/Cat.</th>
                )}

                {/* Precios */}
                {showPrecios && (
                  onSort ? (
                    <SortableHeader label="CTRU" sortKey="ctruPromedio" sortConfigs={sortConfigs} onSort={handleSort} align="center" className="w-20" />
                  ) : (
                    <th className="px-2 py-2 text-center text-[11px] font-medium text-gray-500 uppercase w-20">PVP</th>
                  )
                )}

                {/* Investigación */}
                {showInvestigacion && (
                  <th className="px-2 py-2 text-center text-[11px] font-medium text-gray-500 uppercase w-20">Inv.</th>
                )}

                {/* Métricas de investigación */}
                {showMetricas && (
                  onSort ? (
                    <>
                      <SortableHeader label="Compra Sug." sortKey="precioCompra" sortConfigs={sortConfigs} onSort={handleSort} align="center" className="w-24 bg-blue-50/50" />
                      <SortableHeader label="Venta Sug." sortKey="precioVenta" sortConfigs={sortConfigs} onSort={handleSort} align="center" className="w-24 bg-purple-50/50" />
                      <SortableHeader label="ROI" sortKey="roi" sortConfigs={sortConfigs} onSort={handleSort} align="center" className="w-16" />
                      <SortableHeader label="Marg." sortKey="margen" sortConfigs={sortConfigs} onSort={handleSort} align="center" className="w-16" />
                      <SortableHeader label="Mult." sortKey="multiplicador" sortConfigs={sortConfigs} onSort={handleSort} align="center" className="w-16" />
                      <SortableHeader label="Gan./u" sortKey="gananciaUnidad" sortConfigs={sortConfigs} onSort={handleSort} align="center" className="w-20" />
                    </>
                  ) : (
                    <>
                      <th className="px-2 py-2 text-center text-[11px] font-medium text-gray-500 uppercase w-24 bg-blue-50/50">Compra Sug.</th>
                      <th className="px-2 py-2 text-center text-[11px] font-medium text-gray-500 uppercase w-24 bg-purple-50/50">Venta Sug.</th>
                      <th className="px-2 py-2 text-center text-[11px] font-medium text-gray-500 uppercase w-16">ROI</th>
                      <th className="px-2 py-2 text-center text-[11px] font-medium text-gray-500 uppercase w-16">Marg.</th>
                      <th className="px-2 py-2 text-center text-[11px] font-medium text-gray-500 uppercase w-16">Mult.</th>
                      <th className="px-2 py-2 text-center text-[11px] font-medium text-gray-500 uppercase w-20">Gan./u</th>
                    </>
                  )
                )}

                {/* Estado y acciones - siempre visibles */}
                {onSort ? (
                  <SortableHeader label="Estado" sortKey="estado" sortConfigs={sortConfigs} onSort={handleSort} className="w-20" />
                ) : (
                  <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-500 uppercase w-20">Estado</th>
                )}
                <th className="px-2 py-2 text-center text-[11px] font-medium text-gray-500 uppercase w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Group headers and variants */}
              {organizedProducts.flatMap((item) => {
                if (item.type === 'group-header') {
                  const isExpanded = expandedGroups.has(item.producto.id);
                  const varCount = item.variantes.length;
                  const rows = [
                    <tr key={`group-${item.producto.id}`} className="bg-gray-50 hover:bg-gray-100 cursor-pointer" onClick={() => toggleGroup(item.producto.id)}>
                      <td colSpan={20} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#ecfccb', color: '#4d7c0f' }}>
                            Grupo · {varCount}v
                          </span>
                          <span className="text-xs font-medium text-gray-700">{item.producto.marca} — {item.producto.nombreComercial}</span>
                          {!isExpanded && <span className="text-[10px] text-gray-400 ml-auto">Click para expandir</span>}
                        </div>
                      </td>
                    </tr>
                  ];
                  if (isExpanded) {
                    item.variantes.forEach(v => rows.push(renderProductRow(v)));
                  }
                  return rows;
                }
                return [renderProductRow(item.producto)];
              })}
            </tbody>
            {/* Desktop product row renderer */}
          </table>
        </div>
      </div>
    </>
  );

  function renderProductRow(producto: Producto) {
                const invResumen = ProductoService.getResumenInvestigacion(producto);
                const inv = producto.investigacion;
                const precioCompra = inv?.ctruEstimado || 0;
                const precioUSAMin = inv?.precioUSAMin || 0;
                const logistica = inv?.logisticaEstimada || 0;
                const precioVenta = inv?.precioEntrada || inv?.precioSugeridoCalculado || 0;
                const ganancia = precioVenta > 0 && precioCompra > 0 ? precioVenta - precioCompra : 0;
                const roi = precioCompra > 0 && ganancia > 0 ? (ganancia / precioCompra) * 100 : 0;
                const margen = precioVenta > 0 && precioCompra > 0 ? (ganancia / precioVenta) * 100 : 0;
                const multiplicador = precioCompra > 0 && precioVenta > 0 ? precioVenta / precioCompra : 0;
                const tieneData = invResumen.tieneInvestigacion && precioCompra > 0;

                return (
                  <tr key={producto.id} className="hover:bg-gray-50">
                    {/* SKU */}
                    <td className="px-2 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono font-semibold text-primary-600">{producto.sku}</span>
                        {producto.esPadre && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#ecfccb', color: '#4d7c0f' }}>
                            G·{(variantCountMap.get(producto.id) || 0) + (producto.varianteLabel ? 1 : 0)}v
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Producto */}
                    <td className="px-2 py-2">
                      <div className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{producto.marca}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[180px]">{producto.nombreComercial}</div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {producto.presentacion && `${producto.presentacion}`}
                        {producto.dosaje && ` · ${producto.dosaje}`}
                        {producto.contenido && ` · ${producto.contenido}`}
                        {producto.sabor && ` · ${producto.sabor}`}
                      </div>
                      {producto.esVariante && (
                        <span className="text-[9px] text-blue-600 bg-blue-50 px-1 py-0.5 rounded border border-blue-200">
                          ↳ Variante{producto.varianteLabel ? `: ${producto.varianteLabel}` : ''}
                        </span>
                      )}
                    </td>

                    {/* Clasificación */}
                    {showClasificacion && (
                      <td className="px-2 py-2">
                        {producto.tipoProducto && (
                          <div className="flex items-center gap-1 mb-0.5">
                            <Tag className="h-3 w-3 text-blue-500 flex-shrink-0" />
                            <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1 py-0.5 rounded truncate max-w-[100px]">
                              {producto.tipoProducto.nombre}
                            </span>
                          </div>
                        )}
                        {producto.categorias && producto.categorias.length > 0 && (
                          <div className="flex flex-wrap gap-0.5">
                            {producto.categorias.slice(0, 2).map((cat: CategoriaSnapshot) => (
                              <span key={cat.categoriaId} className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-600 truncate max-w-[60px]">
                                {cat.nombre}
                              </span>
                            ))}
                            {producto.categorias.length > 2 && (
                              <span className="text-[10px] text-gray-400">+{producto.categorias.length - 2}</span>
                            )}
                          </div>
                        )}
                      </td>
                    )}

                    {/* Precios */}
                    {showPrecios && (
                      <td className="px-2 py-2 text-center">
                        {(producto.ctruPromedio || 0) > 0 ? (
                          <span className="text-sm font-semibold text-gray-900">S/{(producto.ctruPromedio || 0).toFixed(0)}</span>
                        ) : (
                          <span className="text-[10px] text-gray-400">-</span>
                        )}
                      </td>
                    )}

                    {/* Investigación */}
                    {showInvestigacion && (
                      <td className="px-2 py-2 text-center">
                        {invResumen.tieneInvestigacion ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <div className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                              inv?.recomendacion === 'importar' ? 'bg-green-100 text-green-800' :
                              inv?.recomendacion === 'descartar' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {inv?.recomendacion === 'importar' && <CheckCircle className="h-2.5 w-2.5 mr-0.5" />}
                              {inv?.recomendacion === 'descartar' && <XCircle className="h-2.5 w-2.5 mr-0.5" />}
                              {inv?.recomendacion === 'investigar_mas' && <Search className="h-2.5 w-2.5 mr-0.5" />}
                              {inv?.recomendacion === 'importar' ? 'Imp.' : inv?.recomendacion === 'descartar' ? 'Desc.' : 'Rev.'}
                            </div>
                            <div className={`text-[10px] flex items-center ${invResumen.estaVigente ? 'text-green-600' : 'text-red-600'}`}>
                              <Clock className="h-2.5 w-2.5 mr-0.5" />
                              {invResumen.estaVigente ? `${invResumen.diasRestantes}d` : 'Venc.'}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center text-gray-400">
                            <HelpCircle className="h-4 w-4" />
                            <span className="text-[10px]">Sin</span>
                          </div>
                        )}
                      </td>
                    )}

                    {/* Métricas */}
                    {showMetricas && (
                      <>
                        {/* P. Compra */}
                        <td className="px-2 py-2 text-center bg-blue-50/20">
                          {tieneData ? (
                            <div>
                              <div className="text-xs font-bold text-blue-700">S/{precioCompra.toFixed(0)}</div>
                              {precioUSAMin > 0 && (
                                <div className="text-[9px] text-gray-500">${precioUSAMin.toFixed(0)}+${logistica.toFixed(0)}</div>
                              )}
                            </div>
                          ) : <span className="text-[10px] text-gray-400">-</span>}
                        </td>
                        {/* P. Venta */}
                        <td className="px-2 py-2 text-center bg-purple-50/20">
                          {tieneData && precioVenta > 0 ? (
                            <span className="text-xs font-bold text-purple-700">S/{precioVenta.toFixed(0)}</span>
                          ) : <span className="text-[10px] text-gray-400">-</span>}
                        </td>
                        {/* ROI */}
                        <td className="px-2 py-2 text-center">
                          {tieneData && roi > 0 ? (
                            <span className={`text-xs font-bold ${roi >= 50 ? 'text-green-600' : roi >= 25 ? 'text-yellow-600' : 'text-orange-600'}`}>
                              {roi.toFixed(0)}%
                            </span>
                          ) : <span className="text-[10px] text-gray-400">-</span>}
                        </td>
                        {/* Margen */}
                        <td className="px-2 py-2 text-center">
                          {tieneData && margen > 0 ? (
                            <span className={`text-xs font-bold ${margen >= 30 ? 'text-green-600' : margen >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {margen.toFixed(0)}%
                            </span>
                          ) : <span className="text-[10px] text-gray-400">-</span>}
                        </td>
                        {/* Mult. */}
                        <td className="px-2 py-2 text-center">
                          {tieneData && multiplicador > 0 ? (
                            <span className={`text-xs font-bold ${multiplicador >= 1.5 ? 'text-green-600' : multiplicador >= 1.25 ? 'text-yellow-600' : 'text-orange-600'}`}>
                              x{multiplicador.toFixed(1)}
                            </span>
                          ) : <span className="text-[10px] text-gray-400">-</span>}
                        </td>
                        {/* Ganancia/u */}
                        <td className="px-2 py-2 text-center">
                          {tieneData && ganancia !== 0 ? (
                            <span className={`text-xs font-bold ${ganancia > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {ganancia > 0 ? '+' : ''}S/{ganancia.toFixed(0)}
                            </span>
                          ) : <span className="text-[10px] text-gray-400">-</span>}
                        </td>
                      </>
                    )}

                    {/* Estado */}
                    <td className="px-2 py-2">
                      <Badge variant={producto.estado === 'activo' ? 'success' : 'default'} size="sm">
                        {producto.estado === 'activo' ? 'Act.' : 'Inact.'}
                      </Badge>
                    </td>

                    {/* Acciones */}
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => onView(producto)} className="p-1 text-primary-600 hover:bg-primary-50 rounded" title="Ver">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => onEdit(producto)} className="p-1 text-warning-600 hover:bg-warning-50 rounded" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                        {producto.estado === 'inactivo' && onReactivar ? (
                          <button onClick={() => onReactivar(producto)} className="p-1 text-success-600 hover:bg-success-50 rounded" title="Reactivar">
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        ) : (
                          <button onClick={() => onDelete(producto)} className="p-1 text-danger-600 hover:bg-danger-50 rounded" title="Eliminar">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
  }
};
