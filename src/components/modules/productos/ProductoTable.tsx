import React, { useState, useMemo } from 'react';
import { Eye, Pencil, Trash2, RefreshCw, Search, CheckCircle, XCircle, Clock, HelpCircle, DollarSign, Tag, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronUp, Columns3 } from 'lucide-react';
import { Badge } from '../../common';
import { DataTable } from '../../../design-system';
import type { DataTableColumn } from '../../../design-system';
import { ProductoService } from '../../../services/producto.service';
import type { Producto, TexturaSKC, TipoProductoSKC } from '../../../types/producto.types';
import { TEXTURA_LABELS, TIPO_PRODUCTO_SKC_LABELS } from '../../../types/producto.types';
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
      className={`px-2 py-2 text-[11px] font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 transition-colors select-none ${alignClasses[align]} ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : ''}`}>
        <span className="truncate">{label}</span>
        {currentSort ? (
          <span className="flex items-center flex-shrink-0">
            {currentSort.direction === 'asc' ? (
              <ArrowUp className="h-3 w-3 text-teal-600" />
            ) : (
              <ArrowDown className="h-3 w-3 text-teal-600" />
            )}
            {sortConfigs.length > 1 && (
              <span className="ml-0.5 text-[9px] bg-teal-100 text-teal-700 rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                {sortOrder}
              </span>
            )}
          </span>
        ) : (
          <ArrowUpDown className="h-3 w-3 text-slate-300 flex-shrink-0" />
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
  const [packExpandido, setPackExpandido] = useState(false);
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
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Header de la card */}
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-teal-600 font-semibold">{producto.sku}</span>
            {producto.esPadre && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#ecfccb', color: '#4d7c0f' }}>
                Grupo
              </span>
            )}
            {producto.esPack && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' }}
                title={`Pack con ${producto.componentesPack?.length ?? 0} componente(s)`}
              >
                Pack
              </span>
            )}
            <Badge variant={producto.estado === 'activo' ? 'success' : 'default'} size="sm">
              {producto.estado === 'activo' ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <div className="font-medium text-slate-900 text-sm truncate mt-1">{producto.marca}</div>
          <div className="text-xs text-slate-600 truncate">{producto.nombreComercial}</div>
          {/* Ficha descriptiva */}
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[10px] text-slate-500">
            {producto.atributosSkincare ? (
              <>
                <span>{producto.atributosSkincare.volumen || producto.contenido}</span>
                {producto.atributosSkincare.ingredienteClave && <span>· {producto.atributosSkincare.ingredienteClave}</span>}
                {producto.atributosSkincare.textura && <span>· {TEXTURA_LABELS[producto.atributosSkincare.textura as TexturaSKC] || producto.atributosSkincare.textura}</span>}
                {producto.atributosSkincare.spf && <span>· SPF{producto.atributosSkincare.spf} {producto.atributosSkincare.pa || ''}</span>}
              </>
            ) : producto.esPack ? (
              /* Pack: no mostrar presentación/dosaje SUP (no aplican). */
              <span className="italic text-slate-400">Cajita armada · no desarmable</span>
            ) : (
              <>
                {producto.presentacion && <span>{producto.presentacion}</span>}
                {producto.dosaje && <span>· {producto.dosaje}</span>}
                {producto.contenido && <span>· {producto.contenido}</span>}
                {producto.sabor && <span>· {producto.sabor}</span>}
              </>
            )}
          </div>
          {/* Preview de componentes del pack — colapsable con avatares apilados (Linear/Stripe style) */}
          {producto.esPack && producto.componentesPack && producto.componentesPack.length > 0 && (() => {
            const comps = producto.componentesPack;
            // Metadata agregada: marca común, volumen común
            const marcas = new Set(comps.map(c => c.marca).filter(Boolean));
            const volumenes = comps.map(c => c.atributosSkincare?.volumen || c.contenido || '').filter(Boolean);
            const volumenesUnicos = new Set(volumenes);
            const marcaComun = marcas.size === 1 ? Array.from(marcas)[0] : null;
            const volumenComun = volumenesUnicos.size === 1 && volumenes.length === comps.length
              ? Array.from(volumenesUnicos)[0]
              : null;
            const resumen = [
              marcaComun,
              volumenComun ? `${volumenComun} c/u` : null,
            ].filter(Boolean).join(' · ');

            // Color por tipo SKC para el mini-avatar
            const colorPorTipo = (tipo?: string): string => {
              const t = (tipo || '').toLowerCase();
              if (t.includes('limpiador')) return 'bg-teal-100 text-teal-700';
              if (t.includes('ampolla')) return 'bg-pink-100 text-pink-700';
              if (t.includes('tonico') || t.includes('tónico')) return 'bg-sky-100 text-sky-700';
              if (t.includes('aceite')) return 'bg-amber-100 text-amber-700';
              if (t.includes('crema')) return 'bg-rose-100 text-rose-700';
              if (t.includes('serum') || t.includes('sérum')) return 'bg-violet-100 text-violet-700';
              if (t.includes('mascarilla')) return 'bg-indigo-100 text-indigo-700';
              if (t.includes('protector')) return 'bg-orange-100 text-orange-700';
              if (t.includes('contorno')) return 'bg-fuchsia-100 text-fuchsia-700';
              return 'bg-slate-100 text-slate-600';
            };
            const inicialTipo = (tipo?: string): string => {
              if (!tipo) return '?';
              const label = (TIPO_PRODUCTO_SKC_LABELS as Record<string, string>)[tipo] || tipo;
              return label.charAt(0).toUpperCase();
            };

            return (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPackExpandido(v => !v); }}
                  className="w-full flex items-center gap-2 text-left text-[11px] hover:bg-slate-50 rounded px-1.5 py-1 -mx-1.5 transition"
                >
                  <span className="text-slate-400 flex-shrink-0 transition-transform" style={{ transform: packExpandido ? 'rotate(90deg)' : 'none' }}>›</span>
                  <span className="font-semibold text-slate-700">
                    {comps.length} componente{comps.length === 1 ? '' : 's'}
                  </span>
                  {resumen && <span className="text-slate-400 truncate">· {resumen}</span>}
                  {/* Stack de mini-avatares */}
                  <div className="ml-auto flex items-center -space-x-1.5 flex-shrink-0">
                    {comps.slice(0, 5).map((c, i) => {
                      const tipoRaw = c.atributosSkincare?.tipoProductoSKC || c.presentacion;
                      return (
                        <span
                          key={i}
                          title={c.nombre}
                          className={`w-5 h-5 rounded-full ${colorPorTipo(tipoRaw)} border border-white text-[9px] font-bold flex items-center justify-center`}
                          style={{ zIndex: 10 - i }}
                        >
                          {inicialTipo(tipoRaw)}
                        </span>
                      );
                    })}
                    {comps.length > 5 && (
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 border border-white text-[9px] font-bold flex items-center justify-center">
                        +{comps.length - 5}
                      </span>
                    )}
                  </div>
                </button>

                {packExpandido && (
                  <ul className="mt-1 text-[11px] leading-tight space-y-1 pl-5 border-l border-slate-200 ml-1.5">
                    {comps.map((c, i) => {
                      const volumen = c.atributosSkincare?.volumen || c.contenido || '';
                      const tipoRaw = c.atributosSkincare?.tipoProductoSKC;
                      const tipoSKC = tipoRaw
                        ? (TIPO_PRODUCTO_SKC_LABELS[tipoRaw as TipoProductoSKC] || tipoRaw)
                        : c.presentacion || '';
                      return (
                        <li key={i} className="flex items-baseline gap-1.5 truncate">
                          <span className={`w-1.5 h-1.5 rounded-full ${colorPorTipo(tipoRaw || '').split(' ')[0]} flex-shrink-0 translate-y-[-1px]`}></span>
                          <span className="font-medium text-slate-700 truncate">{c.nombre}</span>
                          <span className="text-slate-400 truncate">
                            {volumen && volumen !== volumenComun ? volumen : ''}
                            {volumen && volumen !== volumenComun && tipoSKC && ' · '}
                            {tipoSKC && <span className="capitalize">{tipoSKC}</span>}
                          </span>
                          {c.cantidad > 1 && (
                            <span className="text-purple-600 font-semibold flex-shrink-0">×{c.cantidad}</span>
                          )}
                          {!c.productoId && (
                            <span className="text-amber-600 flex-shrink-0 text-[10px]">excl.</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })()}
          {/* Conexión de grupo */}
          {producto.esVariante && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                Variante{producto.varianteLabel ? `: ${producto.varianteLabel}` : ''}
              </span>
            </div>
          )}
          {producto.tipoProducto && (
            <div className="flex items-center gap-1 mt-1">
              <Tag className="h-3 w-3 text-sky-500" />
              <span className="text-xs text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">
                {typeof producto.tipoProducto === 'string' ? producto.tipoProducto : producto.tipoProducto.nombre}
              </span>
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          {invResumen.tieneInvestigacion && (
            <div className={`text-xs flex items-center justify-end gap-1 mt-1 ${invResumen.estaVigente ? 'text-emerald-600' : 'text-red-600'}`}>
              <Clock className="h-3 w-3" />
              {invResumen.estaVigente ? `${invResumen.diasRestantes}d` : 'Vencida'}
            </div>
          )}
        </div>
      </div>

      {/* Métricas compactas - siempre visibles si existen */}
      {tieneMetricas && (
        <div className="px-3 pb-2 grid grid-cols-4 gap-2 text-center">
          <div className="bg-sky-50 rounded p-1.5">
            <div className="text-[10px] text-slate-500">Compra Sug.</div>
            <div className="text-xs font-bold text-sky-700">S/{precioCompra.toFixed(0)}</div>
          </div>
          <div className="bg-purple-50 rounded p-1.5">
            <div className="text-[10px] text-slate-500">Venta Sug.</div>
            <div className="text-xs font-bold text-purple-700">S/{precioVenta.toFixed(0)}</div>
          </div>
          <div className="bg-slate-50 rounded p-1.5">
            <div className="text-[10px] text-slate-500">ROI</div>
            <div className={`text-xs font-bold ${roi >= 50 ? 'text-emerald-600' : roi >= 25 ? 'text-yellow-600' : 'text-orange-600'}`}>
              {roi.toFixed(0)}%
            </div>
          </div>
          <div className="bg-slate-50 rounded p-1.5">
            <div className="text-[10px] text-slate-500">Ganancia</div>
            <div className="text-xs font-bold text-emerald-600">+S/{ganancia.toFixed(0)}</div>
          </div>
        </div>
      )}

      {/* Sección expandible */}
      {expanded && (
        <div className="px-3 pb-2 border-t border-slate-100 pt-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {producto.categorias && producto.categorias.length > 0 && (
              <div>
                <span className="text-slate-500">Categorías:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {producto.categorias.map((cat: CategoriaSnapshot) => (
                    <span key={cat.categoriaId} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                      {cat.nombre}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {tieneMetricas && (
              <div>
                <span className="text-slate-500">Margen: </span>
                <span className={`font-medium ${margen >= 30 ? 'text-emerald-600' : margen >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {margen.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer con acciones */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-100">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-slate-500 flex items-center gap-1 hover:text-slate-700"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Menos' : 'Más'}
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => onView(producto)} className="p-1.5 text-teal-600 hover:bg-teal-50 rounded" title="Ver">
            <Eye className="h-4 w-4" />
          </button>
          <button onClick={() => onEdit(producto)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="Editar">
            <Pencil className="h-4 w-4" />
          </button>
          {producto.estado === 'inactivo' && onReactivar ? (
            <button onClick={() => onReactivar(producto)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Reactivar">
              <RefreshCw className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={() => onDelete(producto)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Eliminar">
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
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Columns3 className="h-4 w-4" />
        <span className="hidden sm:inline">Columnas</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-20 py-2">
            <div className="px-3 py-1.5 text-xs font-medium text-slate-500 uppercase border-b border-slate-100 mb-1">
              Mostrar columnas
            </div>
            {columnGroups.map(({ key, label, description }) => (
              <label
                key={key}
                className="flex items-start gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(key)}
                  onChange={() => onToggle(key)}
                  disabled={key === 'basico'} // Básico siempre visible
                  className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900">{label}</div>
                  <div className="text-xs text-slate-500">{description}</div>
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
      const gid = p.grupoVarianteId;
      if (gid) {
        map.set(gid, (map.get(gid) || 0) + 1);
      }
    });
    return map;
  }, [productos]);

  // Estado de grupos expandidos
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Organizar productos en grupos (agrupadores con variantes) e independientes
  const organizedProducts = useMemo(() => {
    type OrgItem = { type: 'independent'; producto: Producto }
      | { type: 'group-header'; producto: Producto; variantes: Producto[] };

    const items: OrgItem[] = [];

    // Agrupar por grupoVarianteId (modelo de hermanos iguales)
    const grupoMap = new Map<string, Producto[]>();
    const enGrupo = new Set<string>();

    productos.forEach(p => {
      if (p.grupoVarianteId) {
        const arr = grupoMap.get(p.grupoVarianteId) || [];
        arr.push(p);
        grupoMap.set(p.grupoVarianteId, arr);
        enGrupo.add(p.id);
      }
    });

    // Build organized list
    const gruposVistos = new Set<string>();
    productos.forEach(p => {
      if (p.grupoVarianteId && !gruposVistos.has(p.grupoVarianteId)) {
        gruposVistos.add(p.grupoVarianteId);
        const miembros = grupoMap.get(p.grupoVarianteId) || [];
        if (miembros.length > 1) {
          // Grupo con múltiples variantes — el principal va primero
          const sorted = [...miembros].sort((a, b) => {
            if (a.esPrincipalGrupo && !b.esPrincipalGrupo) return -1;
            if (!a.esPrincipalGrupo && b.esPrincipalGrupo) return 1;
            return (a.sku || '').localeCompare(b.sku || '');
          });
          const principal = sorted[0];
          items.push({ type: 'group-header', producto: principal, variantes: sorted });
        } else {
          // Solo 1 miembro — mostrar como independiente
          items.push({ type: 'independent', producto: miembros[0] });
        }
      } else if (!p.grupoVarianteId) {
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
      <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
        <p className="text-slate-500">No hay productos registrados</p>
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
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#ecfccb', color: '#4d7c0f' }}>
                          Grupo · {varCount}v
                        </span>
                        <span className="font-medium text-slate-900 text-sm truncate">{item.producto.marca}</span>
                      </div>
                      <p className="text-xs text-slate-600 truncate">{item.producto.nombreComercial}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{isExpanded ? 'Colapsar' : `Ver ${varCount} variantes`}</span>
                </button>
                {/* Expanded variants */}
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-2 border-l-2 border-slate-200 pl-2">
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
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 rounded-t-lg">
          <div className="flex items-center gap-2 text-sm">
            {sortConfigs.length > 0 && (
              <>
                <span className="text-slate-500">Ordenado por:</span>
                <div className="flex items-center gap-1">
                  {sortConfigs.map((sort, index) => (
                    <span key={sort.key} className="inline-flex items-center gap-1 bg-teal-100 text-teal-700 px-2 py-0.5 rounded text-xs font-medium">
                      {sortConfigs.length > 1 && (
                        <span className="bg-teal-200 text-teal-800 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[9px] font-bold">
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
                <span className="text-xs text-slate-400">(Ctrl+Click multiorden)</span>
              </>
            )}
          </div>
          <ColumnToggle visibleColumns={activeColumns} onToggle={handleToggleColumn} />
        </div>

        {/* Build flat row list: group-header sentinels interleaved with product rows */}
        {(() => {
          // Union type for DataTable rows
          type TableRow =
            | { _kind: 'group-header'; id: string; marca: string; nombreComercial: string; varCount: number; groupId: string }
            | { _kind: 'product'; producto: Producto };

          const tableRows: TableRow[] = [];
          organizedProducts.forEach((item) => {
            if (item.type === 'group-header') {
              tableRows.push({
                _kind: 'group-header',
                id: `group-${item.producto.id}`,
                marca: item.producto.marca,
                nombreComercial: item.producto.nombreComercial,
                varCount: item.variantes.length,
                groupId: item.producto.id,
              });
              if (expandedGroups.has(item.producto.id)) {
                item.variantes.forEach(v => tableRows.push({ _kind: 'product', producto: v }));
              }
            } else {
              tableRows.push({ _kind: 'product', producto: item.producto });
            }
          });

          // Build columns conditionally based on active column groups.
          // sort headers are handled externally via the SortableHeader toolbar above;
          // DataTable columns are non-sortable here to avoid single-sort conflict with
          // the multi-sort sortConfigs system already in place.
          const columns: DataTableColumn<TableRow>[] = [
            // --- SKU (always visible) ---
            {
              key: 'sku',
              header: 'SKU',
              width: 'w-24',
              render: (row) => {
                if (row._kind === 'group-header') {
                  return (
                    <button
                      type="button"
                      onClick={() => toggleGroup(row.groupId)}
                      className="w-full text-left flex items-center gap-2"
                    >
                      {expandedGroups.has(row.groupId)
                        ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                        : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#ecfccb', color: '#4d7c0f' }}>
                        Grupo · {row.varCount}v
                      </span>
                      <span className="text-xs font-medium text-slate-700">{row.marca} — {row.nombreComercial}</span>
                      {!expandedGroups.has(row.groupId) && (
                        <span className="text-[10px] text-slate-400 ml-auto">Click para expandir</span>
                      )}
                    </button>
                  );
                }
                const { producto } = row;
                return (
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <span className="text-xs font-mono font-semibold text-teal-600">{producto.sku}</span>
                    {producto.esPadre && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#ecfccb', color: '#4d7c0f' }}>
                        G·{variantCountMap.get(producto.grupoVarianteId || producto.id) || 0}v
                      </span>
                    )}
                  </div>
                );
              },
            },
            // --- Producto (always visible) ---
            {
              key: 'producto',
              header: 'Producto',
              width: 'min-w-[180px]',
              render: (row) => {
                if (row._kind === 'group-header') return null;
                const { producto } = row;
                return (
                  <>
                    <div className="text-sm font-medium text-slate-900 truncate max-w-[180px]">{producto.marca}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[180px]">{producto.nombreComercial}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {producto.atributosSkincare ? (
                        <>
                          {producto.atributosSkincare.volumen || producto.contenido}
                          {producto.atributosSkincare.ingredienteClave && ` · ${producto.atributosSkincare.ingredienteClave}`}
                          {producto.atributosSkincare.textura && ` · ${TEXTURA_LABELS[producto.atributosSkincare.textura as TexturaSKC] || producto.atributosSkincare.textura}`}
                          {producto.atributosSkincare.spf && ` · SPF${producto.atributosSkincare.spf} ${producto.atributosSkincare.pa || ''}`}
                        </>
                      ) : (
                        <>
                          {producto.presentacion && `${producto.presentacion}`}
                          {producto.dosaje && ` · ${producto.dosaje}`}
                          {producto.contenido && ` · ${producto.contenido}`}
                          {producto.sabor && ` · ${producto.sabor}`}
                        </>
                      )}
                    </div>
                    {producto.esVariante && (
                      <span className="text-[9px] text-sky-600 bg-sky-50 px-1 py-0.5 rounded border border-sky-200">
                        ↳ Variante{producto.varianteLabel ? `: ${producto.varianteLabel}` : ''}
                      </span>
                    )}
                  </>
                );
              },
            },
            // --- Clasificación (optional) ---
            ...(showClasificacion ? [{
              key: 'clasificacion',
              header: 'Tipo/Cat.',
              width: 'min-w-[120px]',
              render: (row: TableRow) => {
                if (row._kind === 'group-header') return null;
                const { producto } = row;
                return (
                  <>
                    {producto.tipoProducto && (
                      <div className="flex items-center gap-1 mb-0.5">
                        <Tag className="h-3 w-3 text-sky-500 flex-shrink-0" />
                        <span className="text-[10px] font-medium text-sky-700 bg-sky-50 px-1 py-0.5 rounded truncate max-w-[100px]">
                          {typeof producto.tipoProducto === 'string' ? producto.tipoProducto : producto.tipoProducto.nombre}
                        </span>
                      </div>
                    )}
                    {producto.categorias && producto.categorias.length > 0 && (
                      <div className="flex flex-wrap gap-0.5">
                        {producto.categorias.slice(0, 2).map((cat: CategoriaSnapshot) => (
                          <span key={cat.categoriaId} className="text-[10px] px-1 py-0.5 rounded bg-slate-100 text-slate-600 truncate max-w-[60px]">
                            {cat.nombre}
                          </span>
                        ))}
                        {producto.categorias.length > 2 && (
                          <span className="text-[10px] text-slate-400">+{producto.categorias.length - 2}</span>
                        )}
                      </div>
                    )}
                  </>
                );
              },
            } as DataTableColumn<TableRow>] : []),
            // --- CTRU/Precios (optional) ---
            ...(showPrecios ? [{
              key: 'ctru',
              header: 'CTRU',
              width: 'w-20',
              align: 'center' as const,
              render: (row: TableRow) => {
                if (row._kind === 'group-header') return null;
                const { producto } = row;
                return (producto.ctruPromedio || 0) > 0
                  ? <span className="text-sm font-semibold text-slate-900">S/{(producto.ctruPromedio || 0).toFixed(0)}</span>
                  : <span className="text-[10px] text-slate-400">-</span>;
              },
            } as DataTableColumn<TableRow>] : []),
            // --- Investigación (optional) ---
            ...(showInvestigacion ? [{
              key: 'investigacion',
              header: 'Inv.',
              width: 'w-20',
              align: 'center' as const,
              render: (row: TableRow) => {
                if (row._kind === 'group-header') return null;
                const { producto } = row;
                const invResumen = ProductoService.getResumenInvestigacion(producto);
                const inv = producto.investigacion;
                return invResumen.tieneInvestigacion ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <div className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                      inv?.recomendacion === 'importar' ? 'bg-emerald-100 text-emerald-800' :
                      inv?.recomendacion === 'descartar' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {inv?.recomendacion === 'importar' && <CheckCircle className="h-2.5 w-2.5 mr-0.5" />}
                      {inv?.recomendacion === 'descartar' && <XCircle className="h-2.5 w-2.5 mr-0.5" />}
                      {inv?.recomendacion === 'investigar_mas' && <Search className="h-2.5 w-2.5 mr-0.5" />}
                      {inv?.recomendacion === 'importar' ? 'Imp.' : inv?.recomendacion === 'descartar' ? 'Desc.' : 'Rev.'}
                    </div>
                    <div className={`text-[10px] flex items-center ${invResumen.estaVigente ? 'text-emerald-600' : 'text-red-600'}`}>
                      <Clock className="h-2.5 w-2.5 mr-0.5" />
                      {invResumen.estaVigente ? `${invResumen.diasRestantes}d` : 'Venc.'}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <HelpCircle className="h-4 w-4" />
                    <span className="text-[10px]">Sin</span>
                  </div>
                );
              },
            } as DataTableColumn<TableRow>] : []),
            // --- Métricas (optional, 6 columns) ---
            ...(showMetricas ? [
              {
                key: 'precioCompra',
                header: 'Compra Sug.',
                width: 'w-24',
                align: 'center' as const,
                render: (row: TableRow) => {
                  if (row._kind === 'group-header') return null;
                  const { producto } = row;
                  const inv = producto.investigacion;
                  const precioCompra = inv?.ctruEstimado || 0;
                  const precioUSAMin = inv?.precioUSAMin || 0;
                  const logistica = inv?.logisticaEstimada || 0;
                  const invResumen = ProductoService.getResumenInvestigacion(producto);
                  const tieneData = invResumen.tieneInvestigacion && precioCompra > 0;
                  return tieneData ? (
                    <div className="bg-sky-50/20">
                      <div className="text-xs font-bold text-sky-700">S/{precioCompra.toFixed(0)}</div>
                      {precioUSAMin > 0 && (
                        <div className="text-[9px] text-slate-500">${precioUSAMin.toFixed(0)}+${logistica.toFixed(0)}</div>
                      )}
                    </div>
                  ) : <span className="text-[10px] text-slate-400">-</span>;
                },
              } as DataTableColumn<TableRow>,
              {
                key: 'precioVenta',
                header: 'Venta Sug.',
                width: 'w-24',
                align: 'center' as const,
                render: (row: TableRow) => {
                  if (row._kind === 'group-header') return null;
                  const { producto } = row;
                  const inv = producto.investigacion;
                  const precioCompra = inv?.ctruEstimado || 0;
                  const precioVenta = inv?.precioEntrada || inv?.precioSugeridoCalculado || 0;
                  const invResumen = ProductoService.getResumenInvestigacion(producto);
                  const tieneData = invResumen.tieneInvestigacion && precioCompra > 0;
                  return tieneData && precioVenta > 0
                    ? <span className="text-xs font-bold text-purple-700 bg-purple-50/20 block">S/{precioVenta.toFixed(0)}</span>
                    : <span className="text-[10px] text-slate-400">-</span>;
                },
              } as DataTableColumn<TableRow>,
              {
                key: 'roi',
                header: 'ROI',
                width: 'w-16',
                align: 'center' as const,
                render: (row: TableRow) => {
                  if (row._kind === 'group-header') return null;
                  const { producto } = row;
                  const inv = producto.investigacion;
                  const precioCompra = inv?.ctruEstimado || 0;
                  const precioVenta = inv?.precioEntrada || inv?.precioSugeridoCalculado || 0;
                  const ganancia = precioVenta > 0 && precioCompra > 0 ? precioVenta - precioCompra : 0;
                  const roi = precioCompra > 0 && ganancia > 0 ? (ganancia / precioCompra) * 100 : 0;
                  const invResumen = ProductoService.getResumenInvestigacion(producto);
                  const tieneData = invResumen.tieneInvestigacion && precioCompra > 0;
                  return tieneData && roi > 0
                    ? <span className={`text-xs font-bold ${roi >= 50 ? 'text-emerald-600' : roi >= 25 ? 'text-yellow-600' : 'text-orange-600'}`}>{roi.toFixed(0)}%</span>
                    : <span className="text-[10px] text-slate-400">-</span>;
                },
              } as DataTableColumn<TableRow>,
              {
                key: 'margen',
                header: 'Marg.',
                width: 'w-16',
                align: 'center' as const,
                render: (row: TableRow) => {
                  if (row._kind === 'group-header') return null;
                  const { producto } = row;
                  const inv = producto.investigacion;
                  const precioCompra = inv?.ctruEstimado || 0;
                  const precioVenta = inv?.precioEntrada || inv?.precioSugeridoCalculado || 0;
                  const ganancia = precioVenta > 0 && precioCompra > 0 ? precioVenta - precioCompra : 0;
                  const margen = precioVenta > 0 && precioCompra > 0 ? (ganancia / precioVenta) * 100 : 0;
                  const invResumen = ProductoService.getResumenInvestigacion(producto);
                  const tieneData = invResumen.tieneInvestigacion && precioCompra > 0;
                  return tieneData && margen > 0
                    ? <span className={`text-xs font-bold ${margen >= 30 ? 'text-emerald-600' : margen >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>{margen.toFixed(0)}%</span>
                    : <span className="text-[10px] text-slate-400">-</span>;
                },
              } as DataTableColumn<TableRow>,
              {
                key: 'multiplicador',
                header: 'Mult.',
                width: 'w-16',
                align: 'center' as const,
                render: (row: TableRow) => {
                  if (row._kind === 'group-header') return null;
                  const { producto } = row;
                  const inv = producto.investigacion;
                  const precioCompra = inv?.ctruEstimado || 0;
                  const precioVenta = inv?.precioEntrada || inv?.precioSugeridoCalculado || 0;
                  const multiplicador = precioCompra > 0 && precioVenta > 0 ? precioVenta / precioCompra : 0;
                  const invResumen = ProductoService.getResumenInvestigacion(producto);
                  const tieneData = invResumen.tieneInvestigacion && precioCompra > 0;
                  return tieneData && multiplicador > 0
                    ? <span className={`text-xs font-bold ${multiplicador >= 1.5 ? 'text-emerald-600' : multiplicador >= 1.25 ? 'text-yellow-600' : 'text-orange-600'}`}>x{multiplicador.toFixed(1)}</span>
                    : <span className="text-[10px] text-slate-400">-</span>;
                },
              } as DataTableColumn<TableRow>,
              {
                key: 'ganancia',
                header: 'Gan./u',
                width: 'w-20',
                align: 'center' as const,
                render: (row: TableRow) => {
                  if (row._kind === 'group-header') return null;
                  const { producto } = row;
                  const inv = producto.investigacion;
                  const precioCompra = inv?.ctruEstimado || 0;
                  const precioVenta = inv?.precioEntrada || inv?.precioSugeridoCalculado || 0;
                  const ganancia = precioVenta > 0 && precioCompra > 0 ? precioVenta - precioCompra : 0;
                  const invResumen = ProductoService.getResumenInvestigacion(producto);
                  const tieneData = invResumen.tieneInvestigacion && precioCompra > 0;
                  return tieneData && ganancia !== 0
                    ? <span className={`text-xs font-bold ${ganancia > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{ganancia > 0 ? '+' : ''}S/{ganancia.toFixed(0)}</span>
                    : <span className="text-[10px] text-slate-400">-</span>;
                },
              } as DataTableColumn<TableRow>,
            ] : []),
            // --- Estado (always visible) ---
            {
              key: 'estado',
              header: 'Estado',
              width: 'w-20',
              render: (row) => {
                if (row._kind === 'group-header') return null;
                const { producto } = row;
                return (
                  <Badge variant={producto.estado === 'activo' ? 'success' : 'default'} size="sm">
                    {producto.estado === 'activo' ? 'Act.' : 'Inact.'}
                  </Badge>
                );
              },
            },
            // --- Acciones (always visible) ---
            {
              key: 'acciones',
              header: 'Acciones',
              width: 'w-24',
              align: 'center' as const,
              render: (row) => {
                if (row._kind === 'group-header') return null;
                const { producto } = row;
                return (
                  <div className="flex items-center justify-center gap-0.5">
                    <button onClick={() => onView(producto)} className="p-1 text-teal-600 hover:bg-teal-50 rounded" title="Ver">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button onClick={() => onEdit(producto)} className="p-1 text-amber-600 hover:bg-amber-50 rounded" title="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                    {producto.estado === 'inactivo' && onReactivar ? (
                      <button onClick={() => onReactivar(producto)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Reactivar">
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    ) : (
                      <button onClick={() => onDelete(producto)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              },
            },
          ];

          return (
            <DataTable<TableRow>
              columns={columns}
              data={tableRows}
              keyExtractor={(row) => row._kind === 'group-header' ? row.id : row.producto.id}
              compact
            />
          );
        })()}
      </div>
    </>
  );
};
