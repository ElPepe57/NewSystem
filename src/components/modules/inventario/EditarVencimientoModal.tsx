import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Check
} from 'lucide-react';
import { Modal, Button, Badge } from '../../common';
import type { Unidad } from '../../../types/unidad.types';
import { unidadService } from '../../../services/unidad.service';
import { useAuthStore } from '../../../store/authStore';
import { useToastStore } from '../../../store/toastStore';

interface EditarVencimientoModalProps {
  isOpen: boolean;
  onClose: () => void;
  unidades: Unidad[];
  productosMap: Map<string, { presentacion?: string; contenido?: string; dosaje?: string; sabor?: string }>;
  onSuccess: () => void;
}

interface UnidadFila {
  unidadId: string;
  fechaActualDate: Date;
  fechaActualStr: string;
  nuevaFecha: string;
  seleccionada: boolean;
}

interface ProductoGrupo {
  productoId: string;
  productoSKU: string;
  productoNombre: string;
  descripcion: string;
  unidades: UnidadFila[];
  expandido: boolean;
  fechaBatch: string;
}

/** Formatea "2027-03-11" → "11 mar. 2027" */
const formatFechaCorta = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const EditarVencimientoModal: React.FC<EditarVencimientoModalProps> = ({
  isOpen,
  onClose,
  unidades,
  productosMap,
  onSuccess
}) => {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [loteSeleccionado, setLoteSeleccionado] = useState('');
  const [busquedaLote, setBusquedaLote] = useState('');
  const [grupos, setGrupos] = useState<ProductoGrupo[]>([]);
  const [guardando, setGuardando] = useState(false);

  // ─── Lotes disponibles ───
  const lotesDisponibles = useMemo(() => {
    const lotesMap = new Map<string, { count: number; productos: Set<string> }>();
    unidades.forEach(u => {
      if (!u.lote || u.estado === 'vendida') return;
      const existing = lotesMap.get(u.lote);
      if (existing) {
        existing.count++;
        existing.productos.add(u.productoNombre);
      } else {
        lotesMap.set(u.lote, { count: 1, productos: new Set([u.productoNombre]) });
      }
    });
    return Array.from(lotesMap.entries())
      .map(([lote, info]) => ({
        lote,
        count: info.count,
        productos: Array.from(info.productos).slice(0, 3).join(', '),
        totalProductos: info.productos.size
      }))
      .sort((a, b) => b.lote.localeCompare(a.lote));
  }, [unidades]);

  const lotesFiltrados = useMemo(() => {
    if (!busquedaLote) return lotesDisponibles;
    const term = busquedaLote.toLowerCase();
    return lotesDisponibles.filter(l =>
      l.lote.toLowerCase().includes(term) ||
      l.productos.toLowerCase().includes(term)
    );
  }, [lotesDisponibles, busquedaLote]);

  // ─── Seleccionar lote ───
  const handleSeleccionarLote = (lote: string) => {
    setLoteSeleccionado(lote);

    const unidadesLote = unidades.filter(u => u.lote === lote && u.estado !== 'vendida');
    const gruposMap = new Map<string, {
      productoId: string;
      productoSKU: string;
      productoNombre: string;
      unidades: UnidadFila[];
    }>();

    unidadesLote.forEach(u => {
      const fechaDate = u.fechaVencimiento?.toDate?.() || new Date();
      const unidadFila: UnidadFila = {
        unidadId: u.id,
        fechaActualDate: fechaDate,
        fechaActualStr: fechaDate.toLocaleDateString('es-PE', {
          year: 'numeric', month: 'short', day: 'numeric'
        }),
        nuevaFecha: '',
        seleccionada: false
      };

      const existing = gruposMap.get(u.productoId);
      if (existing) {
        existing.unidades.push(unidadFila);
      } else {
        gruposMap.set(u.productoId, {
          productoId: u.productoId,
          productoSKU: u.productoSKU,
          productoNombre: u.productoNombre,
          unidades: [unidadFila]
        });
      }
    });

    const nuevosGrupos: ProductoGrupo[] = Array.from(gruposMap.values()).map(g => {
      const pInfo = productosMap.get(g.productoId);
      const desc = pInfo
        ? [pInfo.presentacion, pInfo.contenido, pInfo.dosaje, pInfo.sabor].filter(Boolean).join(' \u00b7 ')
        : '';
      g.unidades.sort((a, b) => a.fechaActualDate.getTime() - b.fechaActualDate.getTime());
      return { ...g, descripcion: desc, expandido: true, fechaBatch: '' };
    });

    nuevosGrupos.sort((a, b) => a.productoNombre.localeCompare(b.productoNombre));
    setGrupos(nuevosGrupos);
  };

  // ─── Toggle selección de una unidad ───
  const toggleSeleccion = (productoId: string, unidadId: string) => {
    setGrupos(prev => prev.map(g => {
      if (g.productoId !== productoId) return g;
      return {
        ...g,
        unidades: g.unidades.map(u =>
          u.unidadId === unidadId ? { ...u, seleccionada: !u.seleccionada } : u
        )
      };
    }));
  };

  // ─── Toggle seleccionar todas de un producto ───
  const toggleSeleccionTodas = (productoId: string) => {
    setGrupos(prev => prev.map(g => {
      if (g.productoId !== productoId) return g;
      const sinFecha = g.unidades.filter(u => !u.nuevaFecha);
      const todasSeleccionadas = sinFecha.length > 0 && sinFecha.every(u => u.seleccionada);
      return {
        ...g,
        unidades: g.unidades.map(u =>
          u.nuevaFecha ? u : { ...u, seleccionada: !todasSeleccionadas }
        )
      };
    }));
  };

  // ─── Cambiar fechaBatch de un producto ───
  const setFechaBatch = (productoId: string, fecha: string) => {
    setGrupos(prev => prev.map(g =>
      g.productoId === productoId ? { ...g, fechaBatch: fecha } : g
    ));
  };

  // ─── Aplicar fecha batch a las seleccionadas de un producto ───
  const aplicarBatch = (productoId: string) => {
    setGrupos(prev => prev.map(g => {
      if (g.productoId !== productoId || !g.fechaBatch) return g;
      return {
        ...g,
        unidades: g.unidades.map(u =>
          u.seleccionada ? { ...u, nuevaFecha: g.fechaBatch, seleccionada: false } : u
        ),
        fechaBatch: ''
      };
    }));
  };

  // ─── Aplicar fecha a TODAS las unidades de todos los productos ───
  const aplicarATodas = (fecha: string) => {
    setGrupos(prev => prev.map(g => ({
      ...g,
      unidades: g.unidades.map(u => ({ ...u, nuevaFecha: fecha, seleccionada: false })),
      fechaBatch: ''
    })));
  };

  // ─── Quitar fecha asignada a una unidad ───
  const quitarFecha = (productoId: string, unidadId: string) => {
    setGrupos(prev => prev.map(g => {
      if (g.productoId !== productoId) return g;
      return {
        ...g,
        unidades: g.unidades.map(u =>
          u.unidadId === unidadId ? { ...u, nuevaFecha: '', seleccionada: false } : u
        )
      };
    }));
  };

  // ─── Toggle expandir ───
  const toggleExpand = (productoId: string) => {
    setGrupos(prev => prev.map(g =>
      g.productoId === productoId ? { ...g, expandido: !g.expandido } : g
    ));
  };

  // ─── Contadores ───
  const unidadesConFecha = useMemo(() =>
    grupos.flatMap(g => g.unidades).filter(u => u.nuevaFecha),
    [grupos]
  );
  const totalUnidades = useMemo(() =>
    grupos.reduce((sum, g) => sum + g.unidades.length, 0),
    [grupos]
  );

  const puedeGuardar = !guardando && unidadesConFecha.length > 0;

  // ─── Guardar ───
  const handleGuardar = async () => {
    if (!user || !puedeGuardar) return;
    setGuardando(true);

    try {
      const porFecha = new Map<string, string[]>();
      for (const g of grupos) {
        for (const u of g.unidades) {
          if (!u.nuevaFecha) continue;
          const existing = porFecha.get(u.nuevaFecha);
          if (existing) {
            existing.push(u.unidadId);
          } else {
            porFecha.set(u.nuevaFecha, [u.unidadId]);
          }
        }
      }

      let totalExitos = 0;
      let totalErrores = 0;

      for (const [fechaStr, ids] of porFecha) {
        const fecha = new Date(fechaStr + 'T12:00:00');
        const result = await unidadService.actualizarFechasVencimiento(
          ids,
          fecha,
          user.uid,
          `Lote ${loteSeleccionado}`
        );
        totalExitos += result.exitos;
        totalErrores += result.errores;
      }

      if (totalExitos > 0) {
        addToast('success', `${totalExitos} unidades actualizadas`, 5000);
        onSuccess();
        handleClose();
      }
      if (totalErrores > 0) {
        addToast('error', `${totalErrores} unidades con error`);
      }
    } catch (error: any) {
      console.error('Error actualizando fechas:', error);
      addToast('error', `Error: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const handleClose = () => {
    setLoteSeleccionado('');
    setBusquedaLote('');
    setGrupos([]);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Editar Vencimientos"
      size="lg"
    >
      <div className="space-y-4">
        {!loteSeleccionado ? (
          /* ─── PASO 1: Seleccionar lote ─── */
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar lote..."
                value={busquedaLote}
                onChange={(e) => setBusquedaLote(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
              {lotesFiltrados.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  No hay lotes disponibles
                </div>
              ) : (
                lotesFiltrados.map(l => (
                  <button
                    key={l.lote}
                    onClick={() => handleSeleccionarLote(l.lote)}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-primary-50 border border-transparent hover:border-primary-200 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {l.lote}
                      </span>
                      <Badge variant="info">{l.count} unid.</Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {l.productos}
                      {l.totalProductos > 3 && ` (+${l.totalProductos - 3} mas)`}
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          /* ─── PASO 2: Editar fechas ─── */
          <>
            {/* Header */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setLoteSeleccionado(''); setGrupos([]); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm font-semibold text-gray-900">{loteSeleccionado}</div>
                <div className="text-xs text-gray-500">
                  {grupos.length} productos &middot; {totalUnidades} unidades
                </div>
              </div>
            </div>

            {/* Instruccion */}
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              Selecciona unidades, pon una fecha y aplica. Repite para cada grupo con fecha distinta.
            </p>

            {/* Lista de productos */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {grupos.map((grupo) => {
                const conFecha = grupo.unidades.filter(u => u.nuevaFecha);
                const sinFecha = grupo.unidades.filter(u => !u.nuevaFecha);
                const seleccionadas = grupo.unidades.filter(u => u.seleccionada);
                const todasSinFechaSeleccionadas = sinFecha.length > 0 && sinFecha.every(u => u.seleccionada);

                return (
                  <div
                    key={grupo.productoId}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Cabecera producto */}
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                      onClick={() => toggleExpand(grupo.productoId)}
                    >
                      {grupo.expandido ? (
                        <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{grupo.productoNombre}</div>
                        <div className="text-[10px] text-gray-500 flex items-center gap-1">
                          <span className="font-mono">{grupo.productoSKU}</span>
                          {grupo.descripcion && (
                            <>
                              <span className="text-gray-300">&middot;</span>
                              <span className="truncate">{grupo.descripcion}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {conFecha.length > 0 && (
                          <Badge variant="success">
                            <Check className="h-3 w-3 inline -mt-0.5 mr-0.5" />
                            {conFecha.length}/{grupo.unidades.length}
                          </Badge>
                        )}
                        {conFecha.length === 0 && (
                          <Badge variant="info">{grupo.unidades.length}u</Badge>
                        )}
                      </div>
                    </button>

                    {/* Expandido */}
                    {grupo.expandido && (
                      <div className="px-3 py-2 space-y-2">
                        {/* Barra de acción: seleccionar + fecha + aplicar */}
                        {sinFecha.length > 0 && (
                          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                            {/* Seleccionar todas sin fecha */}
                            <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                              <input
                                type="checkbox"
                                checked={todasSinFechaSeleccionadas}
                                onChange={() => toggleSeleccionTodas(grupo.productoId)}
                                className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                              <span className="text-[10px] text-gray-500">Todas</span>
                            </label>

                            <input
                              type="date"
                              value={grupo.fechaBatch}
                              onChange={(e) => setFechaBatch(grupo.productoId, e.target.value)}
                              className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                            />

                            <button
                              onClick={() => aplicarBatch(grupo.productoId)}
                              disabled={!grupo.fechaBatch || seleccionadas.length === 0}
                              className={`text-[10px] font-medium whitespace-nowrap px-2 py-1 rounded transition-colors ${
                                grupo.fechaBatch && seleccionadas.length > 0
                                  ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              Aplicar ({seleccionadas.length})
                            </button>

                            {/* Aplicar a todo el lote */}
                            {grupo.fechaBatch && grupos.length > 1 && (
                              <button
                                onClick={() => aplicarATodas(grupo.fechaBatch)}
                                className="text-[10px] text-primary-600 hover:text-primary-800 whitespace-nowrap font-medium"
                                title="Aplicar esta fecha a todas las unidades de todos los productos"
                              >
                                Todo
                              </button>
                            )}
                          </div>
                        )}

                        {/* Unidades individuales */}
                        {grupo.unidades.map((unidad, idx) => (
                          <div
                            key={unidad.unidadId}
                            className={`flex items-center gap-2 py-1 px-1.5 rounded transition-colors ${
                              unidad.nuevaFecha
                                ? 'bg-green-50'
                                : unidad.seleccionada
                                  ? 'bg-primary-50/50'
                                  : ''
                            }`}
                          >
                            {/* Checkbox o check icon */}
                            {unidad.nuevaFecha ? (
                              <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                            ) : (
                              <input
                                type="checkbox"
                                checked={unidad.seleccionada}
                                onChange={() => toggleSeleccion(grupo.productoId, unidad.unidadId)}
                                className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                            )}

                            {/* Número */}
                            <span className="text-[10px] text-gray-400 w-4 text-right shrink-0 font-mono">
                              {idx + 1}
                            </span>

                            {/* Fecha actual */}
                            <span className="text-xs text-gray-500 shrink-0">
                              {unidad.fechaActualStr}
                            </span>

                            {/* Flecha + nueva fecha */}
                            {unidad.nuevaFecha ? (
                              <>
                                <span className="text-green-400 text-xs shrink-0">&rarr;</span>
                                <span className="text-xs font-medium text-green-700">
                                  {formatFechaCorta(unidad.nuevaFecha)}
                                </span>
                                <button
                                  onClick={() => quitarFecha(grupo.productoId, unidad.unidadId)}
                                  className="ml-auto text-[10px] text-gray-400 hover:text-red-500 shrink-0"
                                  title="Quitar fecha"
                                >
                                  &times;
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px] text-gray-300 italic">sin asignar</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                {unidadesConFecha.length > 0
                  ? `${unidadesConFecha.length} de ${totalUnidades} unidades listas`
                  : 'Selecciona, pon fecha y aplica'
                }
              </div>
              <Button
                variant="primary"
                onClick={handleGuardar}
                disabled={!puedeGuardar}
              >
                {guardando ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Guardando...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    Guardar
                  </span>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
