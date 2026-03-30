import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ClipboardCheck, Download, Save, Warehouse, RotateCcw, CheckCircle2, AlertTriangle, XCircle, History, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { ScanAccumulatorList } from '../ScanAccumulatorList';
import { useScanAccumulator } from '../../../../hooks/useScanAccumulator';
import { inventarioService } from '../../../../services/inventario.service';
import { almacenService } from '../../../../services/almacen.service';
import { conteoInventarioService } from '../../../../services/conteoInventario.service';
import { useToastStore } from '../../../../store/toastStore';
import { useAuthStore } from '../../../../store/authStore';
import type { Almacen } from '../../../../types/almacen.types';
import type { AuditoriaItem, AuditoriaSession, AuditoriaSessionItem, AuditoriaResumen } from '../../../../types/escanerModos.types';

export interface ModoAuditoriaHandle {
  handleScan: (barcode: string, format?: string) => void;
}

export const ModoAuditoria = forwardRef<ModoAuditoriaHandle>((_props, ref) => {
  const toast = useToastStore();
  const { user } = useAuthStore();

  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [selectedAlmacenId, setSelectedAlmacenId] = useState('');
  const [selectedAlmacenNombre, setSelectedAlmacenNombre] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showResumen, setShowResumen] = useState(false);

  // Historial
  const [historial, setHistorial] = useState<AuditoriaSession[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [filtroAlmacenHistorial, setFiltroAlmacenHistorial] = useState('');
  const historialFiltrado = filtroAlmacenHistorial
    ? historial.filter(h => h.almacenNombre === filtroAlmacenHistorial)
    : historial;

  // Stock cache per almacén per producto
  const [stockCache, setStockCache] = useState<Map<string, number>>(new Map());

  const accumulator = useScanAccumulator<AuditoriaItem>({
    buildModeData: async (producto) => {
      // Look up stock for this product in selected almacén
      let stockSistema = 0;

      // Check cache first
      const cacheKey = `${producto.id}-${selectedAlmacenId}`;
      if (stockCache.has(cacheKey)) {
        stockSistema = stockCache.get(cacheKey)!;
      } else {
        try {
          const inventario = await inventarioService.getInventarioAgregado({
            productoId: producto.id,
            ...(selectedAlmacenId ? { almacenId: selectedAlmacenId } : {}),
          });
          // For physical audit: count all units physically present in the almacen
          // (disponibles + reservadas — both are physically there)
          stockSistema = inventario.reduce((sum, inv) => sum + inv.disponibles + (inv.reservadas || 0), 0);
          setStockCache(prev => new Map(prev).set(cacheKey, stockSistema));
        } catch {
          // Fallback to 0
        }
      }

      return {
        stockSistema,
        almacenId: selectedAlmacenId,
        discrepancia: 1 - stockSistema, // Will be recalculated on quantity change
      };
    },
    onIncrement: (productoId, newCantidad) => {
      // Recalculate discrepancia
      accumulator.updateModeData(productoId, {
        discrepancia: newCantidad - (accumulator.items.get(productoId)?.modeData.stockSistema || 0),
      });
    },
  });

  const loadHistorial = useCallback(async () => {
    setLoadingHistorial(true);
    try {
      const sessions = await conteoInventarioService.getRecent(20);
      setHistorial(sessions);
    } catch { /* silent */ }
    finally { setLoadingHistorial(false); }
  }, []);

  // Load almacenes + historial on mount
  useEffect(() => {
    const load = async () => {
      try {
        const all = await almacenService.getAll();
        const activos = all.filter((a: Almacen) => a.estadoAlmacen === 'activo');
        setAlmacenes(activos);
      } catch {
        toast.error('Error al cargar almacenes');
      }
    };
    load();
    loadHistorial();
  }, [toast, loadHistorial]);

  // Expose handleScan to parent — block if no almacén selected
  useImperativeHandle(ref, () => ({
    handleScan: (barcode: string) => {
      if (!selectedAlmacenId) {
        toast.warning('Selecciona un almacen antes de escanear');
        return;
      }
      accumulator.handleScan(barcode);
    },
  }), [accumulator, selectedAlmacenId, toast]);

  const handleAlmacenChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedAlmacenId(id);
    const alm = almacenes.find(a => a.id === id);
    setSelectedAlmacenNombre(alm?.nombre || 'Todos');
    // Clear cache and items when changing almacén
    setStockCache(new Map());
    accumulator.clear();
    setShowResumen(false);
  }, [almacenes, accumulator]);

  // Build resumen
  const buildResumen = useCallback((): AuditoriaResumen => {
    let coincidencias = 0;
    let sobrantes = 0;
    let faltantes = 0;

    accumulator.itemsArray.forEach(item => {
      const disc = item.cantidad - item.modeData.stockSistema;
      if (disc === 0) coincidencias++;
      else if (disc > 0) sobrantes++;
      else faltantes++;
    });

    return {
      totalProductos: accumulator.totalItems,
      coincidencias,
      sobrantes,
      faltantes,
    };
  }, [accumulator.itemsArray, accumulator.totalItems]);

  const handleGuardar = useCallback(async () => {
    if (accumulator.totalItems === 0) {
      toast.warning('No hay productos escaneados');
      return;
    }
    setIsSaving(true);
    try {
      const items: AuditoriaSessionItem[] = accumulator.itemsArray.map(item => ({
        productoId: item.productoId,
        sku: item.producto.sku,
        nombre: `${item.producto.marca} ${item.producto.nombreComercial}`,
        cantidadFisica: item.cantidad,
        stockSistema: item.modeData.stockSistema,
        discrepancia: item.cantidad - item.modeData.stockSistema,
      }));

      const resumen = buildResumen();

      await conteoInventarioService.guardar({
        fecha: new Date(),
        almacenId: selectedAlmacenId || 'todos',
        almacenNombre: selectedAlmacenNombre || 'Todos los almacenes',
        items,
        estado: 'finalizado',
        creadoPor: user?.uid || '',
        resumen,
      });

      toast.success('Auditoria guardada correctamente');
      setShowResumen(true);
      loadHistorial();
    } catch {
      toast.error('Error al guardar auditoria');
    } finally {
      setIsSaving(false);
    }
  }, [accumulator, selectedAlmacenId, selectedAlmacenNombre, user, toast, buildResumen]);

  const handleExportCSV = useCallback(() => {
    if (accumulator.totalItems === 0) return;

    const items: AuditoriaSessionItem[] = accumulator.itemsArray.map(item => ({
      productoId: item.productoId,
      sku: item.producto.sku,
      nombre: `${item.producto.marca} ${item.producto.nombreComercial}`,
      cantidadFisica: item.cantidad,
      stockSistema: item.modeData.stockSistema,
      discrepancia: item.cantidad - item.modeData.stockSistema,
    }));

    const csv = conteoInventarioService.exportarCSV(items, selectedAlmacenNombre || 'Todos');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [accumulator, selectedAlmacenNombre]);

  const handleExportHistorialCSV = useCallback((session: AuditoriaSession) => {
    const csv = conteoInventarioService.exportarCSV(session.items, session.almacenNombre);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fecha = session.fecha && 'toDate' in session.fecha
      ? (session.fecha as any).toDate().toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    link.download = `auditoria-${fecha}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleNuevaAuditoria = useCallback(() => {
    accumulator.clear();
    setShowResumen(false);
    setStockCache(new Map());
  }, [accumulator]);

  const resumen = buildResumen();

  return (
    <div className="space-y-4">
      {/* Almacen selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Warehouse className="h-4 w-4 text-gray-500" />
          Almacen a auditar
        </label>
        <select
          value={selectedAlmacenId}
          onChange={handleAlmacenChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">Selecciona un almacen</option>
          {almacenes.map(a => (
            <option key={a.id} value={a.id}>{a.nombre} ({a.pais})</option>
          ))}
        </select>
        {!selectedAlmacenId && (
          <p className="text-xs text-amber-600 mt-1.5">Debes seleccionar un almacen para iniciar la auditoria</p>
        )}
      </div>

      {/* Resumen KPIs */}
      {accumulator.totalItems > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white border border-gray-200 rounded-lg p-2.5 text-center">
            <p className="text-lg font-bold text-gray-900 tabular-nums">{resumen.totalProductos}</p>
            <p className="text-[10px] sm:text-xs text-gray-500">Productos</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 text-center">
            <p className="text-lg font-bold text-green-700 tabular-nums">{resumen.coincidencias}</p>
            <p className="text-[10px] sm:text-xs text-green-600">Coinciden</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center">
            <p className="text-lg font-bold text-amber-700 tabular-nums">{resumen.sobrantes}</p>
            <p className="text-[10px] sm:text-xs text-amber-600">Sobrantes</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-center">
            <p className="text-lg font-bold text-red-700 tabular-nums">{resumen.faltantes}</p>
            <p className="text-[10px] sm:text-xs text-red-600">Faltantes</p>
          </div>
        </div>
      )}

      {/* Accumulated items list */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary-600" />
            Conteo ({accumulator.totalItems} productos, {accumulator.totalQuantity} unidades)
          </h3>
          {accumulator.totalItems > 0 && (
            <button
              type="button"
              onClick={handleNuevaAuditoria}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reiniciar
            </button>
          )}
        </div>

        <ScanAccumulatorList
          items={accumulator.itemsArray}
          onUpdateQuantity={(id, qty) => {
            accumulator.updateQuantity(id, qty);
            // Recalculate discrepancia
            const item = accumulator.items.get(id);
            if (item) {
              accumulator.updateModeData(id, {
                discrepancia: qty - item.modeData.stockSistema,
              });
            }
          }}
          onRemove={accumulator.removeItem}
          lastScannedId={accumulator.lastScannedId}
          emptyMessage="Escanea productos para iniciar el conteo fisico"
          renderExtra={(item) => {
            const disc = item.cantidad - item.modeData.stockSistema;
            return (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-500">
                  Sistema: <span className="font-medium text-gray-700">{item.modeData.stockSistema}</span>
                </span>
                {disc === 0 ? (
                  <span className="inline-flex items-center gap-0.5 text-green-600">
                    <CheckCircle2 className="h-3 w-3" /> Coincide
                  </span>
                ) : disc > 0 ? (
                  <span className="inline-flex items-center gap-0.5 text-amber-600">
                    <AlertTriangle className="h-3 w-3" /> +{disc} sobrante
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-red-600">
                    <XCircle className="h-3 w-3" /> {disc} faltante
                  </span>
                )}
              </div>
            );
          }}
        />
      </div>

      {/* Action buttons - sticky bottom */}
      {accumulator.totalItems > 0 && (
        <div className="sticky bottom-0 bg-gray-50/95 backdrop-blur-sm border-t border-gray-200 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 py-3 flex gap-2">
          <button
            type="button"
            onClick={handleGuardar}
            disabled={isSaving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Guardando...' : 'Guardar Auditoria'}
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      )}

      {/* Historial de auditorias */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-gray-500" />
          Auditorias Anteriores
          {historial.length > 0 && (
            <span className="text-xs font-normal text-gray-400">({historial.length})</span>
          )}
        </h3>

        {/* Filtro por almacén */}
        {historial.length > 0 && (
          <div className="mb-3">
            <select
              value={filtroAlmacenHistorial}
              onChange={(e) => setFiltroAlmacenHistorial(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Todos los almacenes</option>
              {[...new Set(historial.map(h => h.almacenNombre))].map(nombre => (
                <option key={nombre} value={nombre}>{nombre}</option>
              ))}
            </select>
          </div>
        )}

        {loadingHistorial ? (
          <div className="flex items-center gap-2 py-4 justify-center text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando historial...
          </div>
        ) : historial.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No hay auditorias guardadas</p>
        ) : (
          <div className="space-y-2">
            {historialFiltrado.map(session => {
              const isExpanded = expandedSessionId === session.id;
              const fecha = session.fecha && 'toDate' in session.fecha
                ? (session.fecha as any).toDate()
                : new Date(session.fecha as any);
              const fechaStr = fecha.toLocaleDateString('es-PE', {
                day: '2-digit', month: 'short', year: 'numeric',
              });
              const horaStr = fecha.toLocaleTimeString('es-PE', {
                hour: '2-digit', minute: '2-digit',
              });
              const r = session.resumen;

              return (
                <div key={session.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Session header — clickable */}
                  <button
                    type="button"
                    onClick={() => setExpandedSessionId(isExpanded ? null : session.id!)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    {/* Indicador de estado */}
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      r.faltantes === 0 && r.sobrantes === 0
                        ? 'bg-green-100'
                        : r.faltantes > 0
                          ? 'bg-red-100'
                          : 'bg-amber-100'
                    }`}>
                      {r.faltantes === 0 && r.sobrantes === 0
                        ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                        : r.faltantes > 0
                          ? <XCircle className="h-4 w-4 text-red-600" />
                          : <AlertTriangle className="h-4 w-4 text-amber-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{session.almacenNombre}</span>
                        <span className="text-xs text-gray-400">{fechaStr} {horaStr}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        <span className="text-gray-500">{r.totalProductos} prod.</span>
                        {r.coincidencias > 0 && (
                          <span className="text-green-600">{r.coincidencias} OK</span>
                        )}
                        {r.sobrantes > 0 && (
                          <span className="text-amber-600">+{r.sobrantes} sobr.</span>
                        )}
                        {r.faltantes > 0 && (
                          <span className="text-red-600">{r.faltantes} falt.</span>
                        )}
                      </div>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                      : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                    }
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50">
                      {/* Resumen KPIs */}
                      <div className="grid grid-cols-4 gap-1.5 p-3 pb-2">
                        <div className="bg-white rounded p-1.5 text-center border border-gray-100">
                          <p className="text-sm font-bold text-gray-900 tabular-nums">{r.totalProductos}</p>
                          <p className="text-[9px] text-gray-500">Total</p>
                        </div>
                        <div className="bg-green-50 rounded p-1.5 text-center border border-green-100">
                          <p className="text-sm font-bold text-green-700 tabular-nums">{r.coincidencias}</p>
                          <p className="text-[9px] text-green-600">Coinciden</p>
                        </div>
                        <div className="bg-amber-50 rounded p-1.5 text-center border border-amber-100">
                          <p className="text-sm font-bold text-amber-700 tabular-nums">{r.sobrantes}</p>
                          <p className="text-[9px] text-amber-600">Sobrantes</p>
                        </div>
                        <div className="bg-red-50 rounded p-1.5 text-center border border-red-100">
                          <p className="text-sm font-bold text-red-700 tabular-nums">{r.faltantes}</p>
                          <p className="text-[9px] text-red-600">Faltantes</p>
                        </div>
                      </div>

                      {/* Items table */}
                      <div className="px-3 pb-3 space-y-1">
                        {session.items.map((item, idx) => {
                          const disc = item.discrepancia;
                          return (
                            <div
                              key={`${item.productoId}-${idx}`}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs ${
                                disc === 0
                                  ? 'bg-white border border-gray-100'
                                  : disc > 0
                                    ? 'bg-amber-50 border border-amber-100'
                                    : 'bg-red-50 border border-red-100'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-800 truncate">{item.nombre}</p>
                                <p className="text-gray-400">{item.sku}</p>
                              </div>
                              <div className="text-right shrink-0 space-y-0.5">
                                <p className="text-gray-600">
                                  <span className="font-medium">{item.cantidadFisica}</span>
                                  <span className="text-gray-400"> / {item.stockSistema}</span>
                                </p>
                                {disc === 0 ? (
                                  <span className="text-green-600 flex items-center gap-0.5 justify-end">
                                    <CheckCircle2 className="h-3 w-3" /> OK
                                  </span>
                                ) : disc > 0 ? (
                                  <span className="text-amber-600 font-medium">+{disc}</span>
                                ) : (
                                  <span className="text-red-600 font-medium">{disc}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Export button */}
                      <div className="px-3 pb-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleExportHistorialCSV(session); }}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Exportar CSV
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

ModoAuditoria.displayName = 'ModoAuditoria';
