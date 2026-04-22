/**
 * TAREA-105 — Sección "Componentes del Pack" para el ProductoForm en modo Pack/Kit.
 *
 * Muestra la lista de componentes y permite agregar/editar:
 *   - Vinculado: producto del catálogo filtrado por línea (reporting cruzado).
 *   - Exclusivo: texto libre (solo existe dentro del pack).
 *
 * Implementación con VISTAS INLINE dentro del mismo tab (no modales anidados)
 * para evitar la sensación de "modal encima de modal".
 *
 * Reglas de validación (D-PACK-01, D-PACK-05):
 *   - Un pack no puede contener otro pack (sin anidamiento).
 *   - Componentes vinculados deben compartir línea con el pack.
 *
 * El guardado final y revalidación ocurre en ProductoService.create/update
 * (ver validateComponentesPack en producto.service.ts).
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  Gift, Link2, FileText, Plus, Pencil, Trash2, Search,
  ChevronLeft, Info, AlertCircle, Check
} from 'lucide-react';
import { Button, Input } from '../../common';
import { useProductoStore } from '../../../store/productoStore';
import type { ComponentePack, Producto, TipoProductoSKC, TexturaSKC } from '../../../types/producto.types';
import { TIPO_PRODUCTO_SKC_LABELS, TEXTURA_LABELS } from '../../../types/producto.types';

interface ComponentesPackSectionProps {
  /** Línea de negocio del pack. Requerida para filtrar componentes vinculados. */
  lineaNegocioId?: string;
  /** Nombre de la línea (display). */
  lineaNegocioNombre?: string;
  /** Componentes actuales (estado controlado). */
  componentes: ComponentePack[];
  /** Callback cuando la lista cambia. */
  onChange: (componentes: ComponentePack[]) => void;
  /** Hint visual: true si el pack es de línea Skincare (ajusta labels). */
  esSkincare?: boolean;
}

type Vista =
  | { kind: 'lista' }
  | { kind: 'agregar-vinculado'; editIndex?: number }
  | { kind: 'agregar-exclusivo'; editIndex?: number };

export const ComponentesPackSection: React.FC<ComponentesPackSectionProps> = ({
  lineaNegocioId,
  lineaNegocioNombre,
  componentes,
  onChange,
  esSkincare = false,
}) => {
  const [vista, setVista] = useState<Vista>({ kind: 'lista' });
  const sinLinea = !lineaNegocioId;

  const handleGuardar = (nuevo: ComponentePack, editIndex?: number) => {
    if (typeof editIndex === 'number') {
      const next = [...componentes];
      next[editIndex] = nuevo;
      onChange(next);
    } else {
      onChange([...componentes, nuevo]);
    }
    setVista({ kind: 'lista' });
  };

  const handleEliminar = (index: number) => {
    onChange(componentes.filter((_, i) => i !== index));
  };

  const handleEditar = (index: number) => {
    const c = componentes[index];
    if (c.productoId) {
      setVista({ kind: 'agregar-vinculado', editIndex: index });
    } else {
      setVista({ kind: 'agregar-exclusivo', editIndex: index });
    }
  };

  // Vista panel inline: agregar / editar vinculado
  if (vista.kind === 'agregar-vinculado') {
    return (
      <VinculadoPanel
        initial={typeof vista.editIndex === 'number' ? componentes[vista.editIndex] : null}
        lineaNegocioId={lineaNegocioId}
        onCancel={() => setVista({ kind: 'lista' })}
        onSave={(c) => handleGuardar(c, vista.editIndex)}
      />
    );
  }

  // Vista panel inline: agregar / editar exclusivo
  if (vista.kind === 'agregar-exclusivo') {
    return (
      <ExclusivoPanel
        initial={typeof vista.editIndex === 'number' ? componentes[vista.editIndex] : null}
        esSkincare={esSkincare}
        onCancel={() => setVista({ kind: 'lista' })}
        onSave={(c) => handleGuardar(c, vista.editIndex)}
      />
    );
  }

  // Vista por defecto: lista
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-purple-600" />
            <div>
              <p className="font-semibold text-slate-800 text-sm">Componentes del Pack / Kit</p>
              <p className="text-xs text-slate-600">
                Agrega todos los productos que vienen dentro de la cajita.
                {lineaNegocioNombre && (
                  <span className="ml-1">Línea: <b>{lineaNegocioNombre}</b>.</span>
                )}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Agregados</div>
            <div className="text-2xl font-semibold text-purple-600">{componentes.length}</div>
          </div>
        </div>
      </div>

      {sinLinea && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-900">
            Selecciona primero la <b>línea de negocio</b> en la pestaña Origen.
            Los componentes vinculados se filtran por línea.
          </p>
        </div>
      )}

      {/* Lista */}
      {componentes.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
          <Gift className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm">Aún no agregaste componentes.</p>
          <p className="text-xs mt-1">Usa los botones de abajo para empezar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {componentes.map((c, i) => (
            <ComponentePackRow
              key={i}
              componente={c}
              onEdit={() => handleEditar(i)}
              onRemove={() => handleEliminar(i)}
            />
          ))}
        </div>
      )}

      {/* Botones agregar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={sinLinea}
          onClick={() => setVista({ kind: 'agregar-vinculado' })}
          className="border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl p-4 text-left transition"
        >
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-blue-700 text-sm">+ Agregar componente vinculado</span>
          </div>
          <p className="text-xs text-slate-600">
            Busca un producto de tu catálogo. Permite reporting cruzado.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setVista({ kind: 'agregar-exclusivo' })}
          className="border-2 border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-50 rounded-xl p-4 text-left transition"
        >
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-amber-600" />
            <span className="font-semibold text-amber-700 text-sm">+ Agregar componente exclusivo</span>
          </div>
          <p className="text-xs text-slate-600">
            Solo existe dentro del pack. Escribe nombre y presentación libremente.
          </p>
        </button>
      </div>

      {/* Hint */}
      <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 flex items-start gap-2">
        <Info className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
        <div>
          El pack debe tener <b>al menos 1 componente</b>.
          Vender el pack <b>no descuenta</b> stock de los componentes vinculados
          (son unidades físicas distintas). El reporting cruzado se calcula aparte.
        </div>
      </div>
    </div>
  );
};

// ============================================
// FILA DE COMPONENTE
// ============================================

interface ComponentePackRowProps {
  componente: ComponentePack;
  onEdit: () => void;
  onRemove: () => void;
}

const ComponentePackRow: React.FC<ComponentePackRowProps> = ({ componente, onEdit, onRemove }) => {
  const esVinculado = !!componente.productoId;
  const borderClass = esVinculado ? 'border-l-[3px] border-l-blue-400' : 'border-l-[3px] border-l-amber-400';
  const iconBg = esVinculado ? 'bg-blue-100' : 'bg-amber-100';
  const iconColor = esVinculado ? 'text-blue-600' : 'text-amber-600';
  const Icon = esVinculado ? Link2 : FileText;

  return (
    <div className={`bg-white rounded-lg border border-slate-200 ${borderClass} px-3 py-2.5 flex items-center gap-3 hover:shadow-sm transition-shadow`}>
      <div className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
        <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-slate-800 text-sm truncate max-w-[240px]">{componente.nombre}</span>
          {esVinculado ? (
            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200 flex-shrink-0">
              Vinculado
            </span>
          ) : (
            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">
              Exclusivo
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 mt-0.5 truncate">
          {componente.marca && <span className="font-medium text-slate-600">{componente.marca}</span>}
          {componente.marca && componente.presentacion && <span> · </span>}
          {componente.presentacion && <span>{componente.presentacion}</span>}
          {componente.sku && (
            <span className="text-slate-400"> · <span className="font-mono">{componente.sku}</span></span>
          )}
          {componente.notas && <span className="text-slate-400"> · {componente.notas}</span>}
        </div>
      </div>

      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 flex-shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">×</span>
        <span className="text-base font-bold text-slate-700 leading-none">{componente.cantidad}</span>
      </div>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button type="button" onClick={onEdit} className="text-slate-400 hover:text-slate-700 p-1.5 rounded hover:bg-slate-100 transition" title="Editar componente">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onRemove} className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition" title="Eliminar componente">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

// ============================================
// PANEL INLINE: AGREGAR VINCULADO
// ============================================

interface VinculadoPanelProps {
  initial: ComponentePack | null;
  lineaNegocioId?: string;
  onSave: (c: ComponentePack) => void;
  onCancel: () => void;
}

const VinculadoPanel: React.FC<VinculadoPanelProps> = ({ initial, lineaNegocioId, onSave, onCancel }) => {
  const { productos } = useProductoStore();
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState<number>(initial?.cantidad ?? 1);
  const [notas, setNotas] = useState(initial?.notas ?? '');

  // Hidratar si es edición
  useEffect(() => {
    if (initial?.productoId) {
      const prod = productos.find(p => p.id === initial.productoId);
      if (prod) {
        setSeleccionado(prod);
        setBusqueda(prod.nombreComercial);
      }
    }
  }, [initial, productos]);

  // Filtro: misma línea, no pack, estado activo, coincidencia texto
  const resultados = useMemo(() => {
    if (!lineaNegocioId) return [];
    const term = busqueda.trim().toLowerCase();
    return productos
      .filter(p => p.lineaNegocioId === lineaNegocioId)
      .filter(p => !p.esPack)
      .filter(p => p.estado !== 'eliminado' && p.estado !== 'inactivo')
      .filter(p => {
        if (!term) return true;
        return (
          p.sku?.toLowerCase().includes(term) ||
          p.marca?.toLowerCase().includes(term) ||
          p.nombreComercial?.toLowerCase().includes(term)
        );
      })
      .slice(0, 30);
  }, [productos, lineaNegocioId, busqueda]);

  const canSave = !!seleccionado && cantidad > 0;

  const handleGuardar = () => {
    if (!seleccionado || cantidad <= 0) return;
    const comp: ComponentePack = {
      nombre: seleccionado.nombreComercial,
      cantidad,
      presentacion: seleccionado.contenido || seleccionado.presentacion,
      productoId: seleccionado.id,
      sku: seleccionado.sku,
      marca: seleccionado.marca,
    };
    if (seleccionado.dosaje) comp.dosaje = seleccionado.dosaje;
    if (seleccionado.contenido) comp.contenido = seleccionado.contenido;
    if (seleccionado.sabor) comp.sabor = seleccionado.sabor;
    if (seleccionado.atributosSkincare) {
      const s = seleccionado.atributosSkincare;
      comp.atributosSkincare = {
        ...(s.tipoProductoSKC && { tipoProductoSKC: s.tipoProductoSKC }),
        ...(s.volumen && { volumen: s.volumen }),
        ...(s.ingredienteClave && { ingredienteClave: s.ingredienteClave }),
        ...(s.textura && { textura: s.textura }),
        ...(s.spf && { spf: s.spf }),
        ...(s.pa && { pa: s.pa }),
        ...(s.lineaProducto && { lineaProducto: s.lineaProducto }),
      };
    }
    if (notas.trim()) comp.notas = notas.trim();
    onSave(comp);
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb / header del panel */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition"
        >
          <ChevronLeft className="h-4 w-4" />
          Componentes
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <Link2 className="h-4 w-4 text-blue-600" />
          {initial ? 'Editar componente vinculado' : 'Agregar componente vinculado'}
        </span>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex items-start gap-2">
        <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>
          Solo se muestran productos de la misma línea que el pack y que <b>no sean packs</b> a su vez (sin anidamiento).
        </span>
      </div>

      {/* Paso 1: buscar, o Paso 2: seleccionado */}
      {!seleccionado ? (
        <>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              1. Elige el producto del catálogo
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por SKU, marca, nombre..."
                className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg bg-white">
            {resultados.length === 0 ? (
              <div className="text-center py-10 text-sm text-slate-400 px-4">
                {!lineaNegocioId ? (
                  'Selecciona una línea de negocio primero.'
                ) : busqueda.trim() ? (
                  <>Sin resultados para <b className="text-slate-600">"{busqueda}"</b>.</>
                ) : (
                  'Empieza a escribir para buscar productos del catálogo.'
                )}
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {resultados.map(p => {
                  const skc = p.atributosSkincare;
                  const tipoSKCLabel = skc?.tipoProductoSKC
                    ? TIPO_PRODUCTO_SKC_LABELS[skc.tipoProductoSKC as TipoProductoSKC]
                    : null;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSeleccionado(p)}
                      className="w-full flex items-start gap-3 p-3 text-left transition hover:bg-blue-50/60"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-slate-800 truncate">{p.nombreComercial}</span>
                          <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{p.sku}</span>
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          <span className="font-medium text-slate-600">{p.marca}</span>
                          {skc?.volumen && <span> · {skc.volumen}</span>}
                          {!skc && (p.contenido || p.presentacion) && <span> · {p.contenido || p.presentacion}</span>}
                          {!skc && p.dosaje && <span> · {p.dosaje}</span>}
                          {typeof p.stockDisponible === 'number' && (
                            <span className={p.stockDisponible > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                              {' '}· Stock: {p.stockDisponible}
                            </span>
                          )}
                        </div>
                        {/* Chips con atributos específicos */}
                        {skc ? (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {tipoSKCLabel && (
                              <span className="inline-flex px-1.5 py-0.5 text-[10px] rounded bg-pink-50 text-pink-700 border border-pink-200">
                                {tipoSKCLabel}
                              </span>
                            )}
                            {skc.ingredienteClave && (
                              <span className="inline-flex px-1.5 py-0.5 text-[10px] rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {skc.ingredienteClave}
                              </span>
                            )}
                            {skc.textura && (
                              <span className="inline-flex px-1.5 py-0.5 text-[10px] rounded bg-slate-50 text-slate-600 border border-slate-200">
                                {TEXTURA_LABELS[skc.textura as TexturaSKC] || skc.textura}
                              </span>
                            )}
                            {skc.spf && (
                              <span className="inline-flex px-1.5 py-0.5 text-[10px] rounded bg-amber-50 text-amber-700 border border-amber-200">
                                SPF{skc.spf}{skc.pa ? ` ${skc.pa}` : ''}
                              </span>
                            )}
                          </div>
                        ) : (p.sabor || p.dosaje) ? (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {p.sabor && (
                              <span className="inline-flex px-1.5 py-0.5 text-[10px] rounded bg-slate-50 text-slate-600 border border-slate-200">
                                {p.sabor}
                              </span>
                            )}
                          </div>
                        ) : null}
                      </div>
                      <span className="text-blue-500 flex-shrink-0 mt-0.5"><Plus className="h-4 w-4" /></span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              1. Producto seleccionado
            </label>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Check className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{seleccionado.nombreComercial}</div>
                  <div className="text-xs text-slate-600 mt-0.5 truncate">
                    <span className="font-medium">{seleccionado.marca}</span>
                    <span className="text-slate-400"> · SKU </span>
                    <span className="font-mono">{seleccionado.sku}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSeleccionado(null); setBusqueda(''); }}
                  className="text-xs text-blue-700 hover:text-blue-900 font-medium flex-shrink-0 px-2 py-1 rounded hover:bg-blue-100 transition"
                >
                  Cambiar
                </button>
              </div>

              {/* Atributos del producto */}
              {(() => {
                const skc = seleccionado.atributosSkincare;
                if (skc) {
                  const tipoLabel = skc.tipoProductoSKC
                    ? TIPO_PRODUCTO_SKC_LABELS[skc.tipoProductoSKC as TipoProductoSKC]
                    : null;
                  return (
                    <div className="mt-3 pt-3 border-t border-blue-200 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      {tipoLabel && (
                        <div><span className="text-slate-400">Tipo:</span> <span className="text-slate-700 font-medium">{tipoLabel}</span></div>
                      )}
                      {skc.volumen && (
                        <div><span className="text-slate-400">Volumen:</span> <span className="text-slate-700 font-medium">{skc.volumen}</span></div>
                      )}
                      {skc.ingredienteClave && (
                        <div className="col-span-2"><span className="text-slate-400">Ingrediente:</span> <span className="text-slate-700 font-medium">{skc.ingredienteClave}</span></div>
                      )}
                      {skc.textura && (
                        <div><span className="text-slate-400">Textura:</span> <span className="text-slate-700 font-medium">{TEXTURA_LABELS[skc.textura as TexturaSKC] || skc.textura}</span></div>
                      )}
                      {skc.spf && (
                        <div><span className="text-slate-400">SPF:</span> <span className="text-slate-700 font-medium">{skc.spf}{skc.pa ? ` ${skc.pa}` : ''}</span></div>
                      )}
                      {skc.lineaProducto && (
                        <div className="col-span-2"><span className="text-slate-400">Línea:</span> <span className="text-slate-700 font-medium">{skc.lineaProducto}</span></div>
                      )}
                    </div>
                  );
                }
                // SUP
                const tieneSup = seleccionado.presentacion || seleccionado.dosaje || seleccionado.contenido || seleccionado.sabor;
                if (!tieneSup) return null;
                return (
                  <div className="mt-3 pt-3 border-t border-blue-200 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    {seleccionado.presentacion && (
                      <div><span className="text-slate-400">Presentación:</span> <span className="text-slate-700 font-medium capitalize">{seleccionado.presentacion}</span></div>
                    )}
                    {seleccionado.dosaje && (
                      <div><span className="text-slate-400">Dosaje:</span> <span className="text-slate-700 font-medium">{seleccionado.dosaje}</span></div>
                    )}
                    {seleccionado.contenido && (
                      <div><span className="text-slate-400">Contenido:</span> <span className="text-slate-700 font-medium">{seleccionado.contenido}</span></div>
                    )}
                    {seleccionado.sabor && (
                      <div><span className="text-slate-400">Sabor:</span> <span className="text-slate-700 font-medium">{seleccionado.sabor}</span></div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              2. ¿Cuántos vienen dentro del pack?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad *</label>
                <Input
                  type="number"
                  min={1}
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notas (opcional)</label>
                <Input
                  type="text"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Ej: versión mini, tamaño viaje"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Footer del panel */}
      <div className="flex items-center justify-between gap-2 pt-4 border-t border-slate-200">
        <Button variant="ghost" onClick={onCancel} type="button">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Volver a componentes
        </Button>
        <Button variant="primary" onClick={handleGuardar} disabled={!canSave} type="button">
          <Plus className="h-4 w-4 mr-1" />
          {initial ? 'Guardar cambios' : 'Agregar al pack'}
        </Button>
      </div>
    </div>
  );
};

// ============================================
// PANEL INLINE: AGREGAR EXCLUSIVO
// ============================================

interface ExclusivoPanelProps {
  initial: ComponentePack | null;
  esSkincare?: boolean;
  onSave: (c: ComponentePack) => void;
  onCancel: () => void;
}

const ExclusivoPanel: React.FC<ExclusivoPanelProps> = ({ initial, esSkincare = false, onSave, onCancel }) => {
  // Campos base
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [cantidad, setCantidad] = useState<number>(initial?.cantidad ?? 1);
  const [presentacion, setPresentacion] = useState(initial?.presentacion ?? '');
  const [notas, setNotas] = useState(initial?.notas ?? '');

  // SUP
  const [dosaje, setDosaje] = useState(initial?.dosaje ?? '');
  const [contenido, setContenido] = useState(initial?.contenido ?? '');
  const [sabor, setSabor] = useState(initial?.sabor ?? '');

  // SKC
  const initialSKC = initial?.atributosSkincare;
  const [tipoSKC, setTipoSKC] = useState<TipoProductoSKC | ''>(initialSKC?.tipoProductoSKC ?? '');
  const [volumen, setVolumen] = useState(initialSKC?.volumen ?? '');
  const [ingrediente, setIngrediente] = useState(initialSKC?.ingredienteClave ?? '');
  const [textura, setTextura] = useState<TexturaSKC | ''>(initialSKC?.textura ?? '');
  const [spf, setSpf] = useState<string>(initialSKC?.spf ? String(initialSKC.spf) : '');
  const [pa, setPa] = useState(initialSKC?.pa ?? '');
  const [lineaProducto, setLineaProducto] = useState(initialSKC?.lineaProducto ?? '');

  const canSave = nombre.trim().length > 0 && cantidad > 0;

  const handleGuardar = () => {
    if (!canSave) return;
    const comp: ComponentePack = {
      nombre: nombre.trim(),
      cantidad,
    };
    if (presentacion.trim()) comp.presentacion = presentacion.trim();
    if (notas.trim()) comp.notas = notas.trim();

    if (esSkincare) {
      const skc: NonNullable<ComponentePack['atributosSkincare']> = {};
      if (tipoSKC) skc.tipoProductoSKC = tipoSKC;
      if (volumen.trim()) skc.volumen = volumen.trim();
      if (ingrediente.trim()) skc.ingredienteClave = ingrediente.trim();
      if (textura) skc.textura = textura;
      const spfNum = spf ? parseInt(spf, 10) : undefined;
      if (spfNum && !isNaN(spfNum)) skc.spf = spfNum;
      if (pa.trim()) skc.pa = pa.trim();
      if (lineaProducto.trim()) skc.lineaProducto = lineaProducto.trim();
      if (Object.keys(skc).length > 0) comp.atributosSkincare = skc;
    } else {
      if (dosaje.trim()) comp.dosaje = dosaje.trim();
      if (contenido.trim()) comp.contenido = contenido.trim();
      if (sabor.trim()) comp.sabor = sabor.trim();
    }

    onSave(comp);
  };

  const placeholderPresentacion = esSkincare ? 'Ej: 30ml, 50g, 15ml mini' : 'Ej: Cápsulas, Gomitas, Polvo';
  const placeholderNombre = esSkincare ? 'Ej: Retinol 0.2% en Squalane' : 'Ej: Gomita vitamina C edición especial';

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition"
        >
          <ChevronLeft className="h-4 w-4" />
          Componentes
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-amber-600" />
          {initial ? 'Editar componente exclusivo' : 'Agregar componente exclusivo'}
        </span>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
        <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>
          Componente que solo existe dentro del pack (ej: edición limitada, mini no vendida suelta).
          Describe libremente; no entra en reporting cruzado.
        </span>
      </div>

      {/* === SECCIÓN 1: Identificación básica === */}
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Identificación
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
            <Input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={placeholderNombre}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad en el pack *</label>
              <Input
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Presentación</label>
              <Input
                type="text"
                value={presentacion}
                onChange={(e) => setPresentacion(e.target.value)}
                placeholder={placeholderPresentacion}
              />
            </div>
          </div>
        </div>
      </div>

      {/* === SECCIÓN 2: Atributos específicos por línea === */}
      {esSkincare ? (
        <div>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Atributos Skincare (opcional)
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de producto</label>
                <select
                  value={tipoSKC}
                  onChange={(e) => setTipoSKC(e.target.value as TipoProductoSKC | '')}
                  className="w-full h-9 text-sm px-2.5 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Selecciona —</option>
                  {(Object.entries(TIPO_PRODUCTO_SKC_LABELS) as [TipoProductoSKC, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Volumen</label>
                <Input
                  type="text"
                  value={volumen}
                  onChange={(e) => setVolumen(e.target.value)}
                  placeholder="Ej: 30ml, 50g"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ingrediente clave</label>
              <Input
                type="text"
                value={ingrediente}
                onChange={(e) => setIngrediente(e.target.value)}
                placeholder="Ej: Centella, Niacinamida, Retinol"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Textura</label>
                <select
                  value={textura}
                  onChange={(e) => setTextura(e.target.value as TexturaSKC | '')}
                  className="w-full h-9 text-sm px-2.5 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Selecciona —</option>
                  {(Object.entries(TEXTURA_LABELS) as [TexturaSKC, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">SPF</label>
                <Input
                  type="number"
                  value={spf}
                  onChange={(e) => setSpf(e.target.value)}
                  placeholder="Ej: 50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">PA</label>
                <Input
                  type="text"
                  value={pa}
                  onChange={(e) => setPa(e.target.value)}
                  placeholder="Ej: ++++"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Línea del producto</label>
              <Input
                type="text"
                value={lineaProducto}
                onChange={(e) => setLineaProducto(e.target.value)}
                placeholder="Ej: Madagascar Centella"
              />
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Atributos del suplemento (opcional)
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dosaje</label>
                <Input
                  type="text"
                  value={dosaje}
                  onChange={(e) => setDosaje(e.target.value)}
                  placeholder="Ej: 1000mg, 500UI"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Contenido</label>
                <Input
                  type="text"
                  value={contenido}
                  onChange={(e) => setContenido(e.target.value)}
                  placeholder="Ej: 60 cápsulas, 200g"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sabor</label>
              <Input
                type="text"
                value={sabor}
                onChange={(e) => setSabor(e.target.value)}
                placeholder="Ej: Limón, Fresa, Natural, Sin sabor"
              />
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notas (opcional)</label>
        <Input
          type="text"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ej: edición especial, no se vende suelto"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-4 border-t border-slate-200">
        <Button variant="ghost" onClick={onCancel} type="button">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Volver a componentes
        </Button>
        <Button variant="primary" onClick={handleGuardar} disabled={!canSave} type="button">
          <Plus className="h-4 w-4 mr-1" />
          {initial ? 'Guardar cambios' : 'Agregar al pack'}
        </Button>
      </div>
    </div>
  );
};
