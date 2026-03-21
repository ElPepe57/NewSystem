import React, { useState } from 'react';
import {
  Settings,
  RefreshCw,
  Download,
  Truck,
  AlertTriangle,
  Type,
  Package,
  Search,
  Link2,
  RotateCw,
  Loader2,
  Play,
  CheckCircle2,
  ShoppingCart,
  ChevronDown,
  X,
  Check,
} from 'lucide-react';
import { useMercadoLibreStore } from '../../store/mercadoLibreStore';
import { OrderRow } from './OrderRow';
import type { MLOrderSync } from '../../types/mercadoLibre.types';

export interface TabOrdenesProps {
  orderSyncs: MLOrderSync[];
}

export const TabOrdenes: React.FC<TabOrdenesProps> = ({ orderSyncs }) => {
  const [filter, setFilter] = useState<string>('todos');
  const {
    procesarPendientes,
    importHistoricalOrders,
    procesando,
    importingOrders,
    reenrichBuyers,
    reenrichingBuyers,
    patchEnvio,
    repararVentasUrbano,
    repararNombresDni,
    consolidatePackOrders,
    consolidatingPacks,
    diagnosticoSistema,
    runningDiagnostic,
  } = useMercadoLibreStore();

  const [batchResult, setBatchResult] = useState<{ procesadas: number; errores: number } | null>(null);
  const [importResult, setImportResult] = useState<{
    importadas: number;
    omitidas: number;
    errores: number;
    totalEnML: number;
  } | null>(null);
  const [reenrichResult, setReenrichResult] = useState<{
    actualizadas: number;
    clientesActualizados: number;
    errores: number;
    total: number;
  } | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);

  const filtered = filter === 'todos'
    ? orderSyncs
    : orderSyncs.filter((o) => o.estado === filter);

  const pendientesProcesables = orderSyncs.filter(
    (o) => (o.estado === 'pendiente' || o.estado === 'error') && o.todosVinculados
  );

  const countHistorico = orderSyncs.filter((o) => o.origen === 'importacion_historica').length;
  const countWebhook = orderSyncs.filter((o) => o.origen === 'webhook' || !o.origen).length;

  const handleProcesarTodos = async () => {
    setBatchResult(null);
    try {
      const result = await procesarPendientes();
      setBatchResult(result);
    } catch {
      // Error manejado en el store
    }
  };

  const handleImportarHistorial = async () => {
    setImportResult(null);
    try {
      const result = await importHistoricalOrders(100);
      setImportResult(result);
    } catch {
      // Error manejado en el store
    }
  };

  const handleReenrichBuyers = async () => {
    setReenrichResult(null);
    try {
      const result = await reenrichBuyers();
      setReenrichResult(result);
    } catch {
      // Error manejado en el store
    }
  };

  const [patchingEnvio, setPatchingEnvio] = useState(false);
  const handlePatchEnvio = async () => {
    setPatchingEnvio(true);
    try {
      const result = await patchEnvio();
      alert(`Migración completada: ${result.parchadas} parchadas, ${result.sinCambio} ya tenían método, ${result.sinMetodo} sin método`);
    } catch {
      // Error manejado en el store
    } finally {
      setPatchingEnvio(false);
    }
  };

  const [reparandoUrbano, setReparandoUrbano] = useState(false);
  const [repairResult, setRepairResult] = useState<{
    reparadas: number;
    omitidas: number;
    errores: number;
    total: number;
    detalles: string[];
  } | null>(null);

  const handleRepararUrbano = async () => {
    setReparandoUrbano(true);
    setRepairResult(null);
    try {
      const result = await repararVentasUrbano();
      setRepairResult(result);
    } catch {
      // Error manejado en el store
    } finally {
      setReparandoUrbano(false);
    }
  };

  const [reparandoNombres, setReparandoNombres] = useState(false);
  const [nombresResult, setNombresResult] = useState<{
    reparadas: number;
    omitidas: number;
    errores: number;
    total: number;
    detalles: string[];
  } | null>(null);

  const handleRepararNombres = async () => {
    setReparandoNombres(true);
    setNombresResult(null);
    try {
      const result = await repararNombresDni();
      setNombresResult(result);
    } catch {
      // Error manejado en el store
    } finally {
      setReparandoNombres(false);
    }
  };

  const [packResult, setPackResult] = useState<{ duplicatesFound: number; fixed: number; log: string[] } | null>(null);
  const [packMode, setPackMode] = useState<'dry' | 'fix'>('dry');

  const handleConsolidarPacks = async (dryRun: boolean) => {
    setPackResult(null);
    setPackMode(dryRun ? 'dry' : 'fix');
    try {
      const result = await consolidatePackOrders(dryRun);
      setPackResult(result);
    } catch {
      // Error manejado en el store
    }
  };

  const [diagResult, setDiagResult] = useState<{
    totalIssues: number;
    criticas: number;
    altas: number;
    medias: number;
    issues: any[];
    log: string[];
  } | null>(null);
  const [analizandoBalance, setAnalizandoBalance] = useState(false);
  const [reingenieriaResult, setReingenieriaResult] = useState<{
    dryRun: boolean;
    log: string[];
    ordenesAnalizadas: number;
    ventasActualizadas: number;
    movimientosAnulados: number;
    movimientosCreados: number;
    gastosEliminados: number;
    gastosCreados: number;
    balanceMP: { anterior: number; calculado: number; ajusteReconciliacion: number; final: number; saldoRealMP: number | null };
  } | null>(null);
  const [reingenieriando, setReingenieriando] = useState(false);
  const [saldoRealMP, setSaldoRealMP] = useState<string>('2677.51');

  const [showInconsistencias, setShowInconsistencias] = useState(false);
  const [inconsistenciasLoading, setInconsistenciasLoading] = useState(false);
  const [inconsistenciasData, setInconsistenciasData] = useState<{
    totalInconsistencias: number;
    totalHuerfanos: number;
    inconsistencias: Array<any>;
    huerfanos: Array<any>;
  } | null>(null);
  const [resoluciones, setResoluciones] = useState<Map<string, { movId: string; accion: 'vincular' | 'anular' | 'skip' }>>(new Map());
  const [resolviendoInconsistencias, setResolviendoInconsistencias] = useState(false);

  const handleLoadInconsistencias = async () => {
    setInconsistenciasLoading(true);
    setInconsistenciasData(null);
    setResoluciones(new Map());
    try {
      const { mercadoLibreService } = await import('../../services/mercadoLibre.service');
      const res = await mercadoLibreService.diagInconsistencias();
      setInconsistenciasData(res);
      setShowInconsistencias(true);
      const autoMap = new Map<string, { movId: string; accion: 'vincular' | 'anular' | 'skip' }>();
      for (const inc of res.inconsistencias) {
        if (inc.tipo === 'sin_movimientos' && inc.candidatos.length > 0 && inc.candidatos[0].score >= 70) {
          autoMap.set(inc.ventaId, { movId: inc.candidatos[0].movId, accion: 'vincular' });
        }
      }
      setResoluciones(autoMap);
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Error desconocido'}`);
    } finally {
      setInconsistenciasLoading(false);
    }
  };

  const handleAplicarResoluciones = async () => {
    const acciones: Array<{ movimientoId: string; ventaId?: string; ventaNumero?: string; accion: 'vincular' | 'anular' }> = [];
    for (const [ventaId, res] of resoluciones) {
      if (res.accion === 'skip') continue;
      const inc = inconsistenciasData?.inconsistencias.find((i: any) => i.ventaId === ventaId);
      acciones.push({
        movimientoId: res.movId,
        ventaId: res.accion === 'vincular' ? ventaId : undefined,
        ventaNumero: res.accion === 'vincular' ? inc?.ventaNumero : undefined,
        accion: res.accion,
      });
    }
    if (acciones.length === 0) { alert('No hay resoluciones seleccionadas'); return; }
    setResolviendoInconsistencias(true);
    try {
      const { mercadoLibreService } = await import('../../services/mercadoLibre.service');
      const res = await mercadoLibreService.resolverInconsistencias(acciones);
      alert(`${res.exitosos}/${res.total} resueltas correctamente. Ahora corra Reingeniería Preview para verificar.`);
      setShowInconsistencias(false);
      setInconsistenciasData(null);
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Error desconocido'}`);
    } finally {
      setResolviendoInconsistencias(false);
    }
  };

  const handleDiagnostico = async () => {
    setDiagResult(null);
    try {
      const result = await diagnosticoSistema();
      setDiagResult(result);
    } catch {
      // Error manejado en el store
    }
  };

  const handleReingenieria = async (dryRun: boolean) => {
    setReingenieriaResult(null);
    setReingenieriando(true);
    try {
      const { mercadoLibreService } = await import('../../services/mercadoLibre.service');
      const saldoReal = saldoRealMP ? parseFloat(saldoRealMP) : undefined;
      const res = await mercadoLibreService.reingenieria(dryRun, saldoReal && !isNaN(saldoReal) ? saldoReal : undefined);
      setReingenieriaResult({ ...res, dryRun });
    } catch (err: any) {
      setReingenieriaResult({
        dryRun,
        log: [`Error: ${err?.message || 'Error desconocido'}`],
        ordenesAnalizadas: 0,
        ventasActualizadas: 0,
        movimientosAnulados: 0,
        movimientosCreados: 0,
        gastosEliminados: 0,
        gastosCreados: 0,
        balanceMP: { anterior: 0, calculado: 0, ajusteReconciliacion: 0, final: 0, saldoRealMP: null },
      });
    } finally {
      setReingenieriando(false);
    }
  };

  const handleAnalizarBalance = async (dryRun: boolean) => {
    setAnalizandoBalance(true);
    try {
      const { mercadoLibreService } = await import('../../services/mercadoLibre.service');
      const res = await mercadoLibreService.recalcularBalanceMP(dryRun);
      setDiagResult((prev) => prev ? {
        ...prev,
        log: (res as any).log || [...prev.log, '', res.message],
        ...(dryRun ? {} : { totalIssues: 0, altas: 0 }),
      } : prev);
    } catch (err: any) {
      setDiagResult((prev) => prev ? {
        ...prev,
        log: [...prev.log, '', `Error: ${err?.message || 'Error desconocido'}`],
      } : prev);
    } finally {
      setAnalizandoBalance(false);
    }
  };

  // ---- Vinculación ML ↔ Ventas ----
  const [showVinculacion, setShowVinculacion] = useState(false);
  const [vinculacionLoading, setVinculacionLoading] = useState(false);
  const [vinculacionData, setVinculacionData] = useState<{
    totalSyncPendientes: number;
    totalVentasSinVincular: number;
    suggestions: Array<{
      syncId: string;
      mlOrderId: number;
      syncBuyerName: string;
      syncBuyerDni: string;
      syncTotal: number;
      syncFecha: string;
      syncProductos: string;
      syncMetodoEnvio: string;
      matches: Array<{
        ventaId: string;
        numeroVenta: string;
        nombreCliente: string;
        dniRuc: string;
        totalPEN: number;
        fechaCreacion: string;
        productos: string;
        score: number;
        matchDetails: string[];
      }>;
    }>;
  } | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Record<string, string>>({});
  const [vinculando, setVinculando] = useState(false);
  const [vinculacionResult, setVinculacionResult] = useState<{ vinculados: number; errores: number } | null>(null);

  const handleLoadSuggestions = async () => {
    setVinculacionLoading(true);
    setVinculacionData(null);
    setSelectedMatches({});
    setVinculacionResult(null);
    try {
      const { mercadoLibreService } = await import('../../services/mercadoLibre.service');
      const res = await mercadoLibreService.matchSuggestions();
      setVinculacionData(res);
      const autoSelect: Record<string, string> = {};
      for (const s of res.suggestions) {
        if (s.matches.length > 0 && s.matches[0].score >= 60) {
          autoSelect[s.syncId] = s.matches[0].ventaId;
        }
      }
      setSelectedMatches(autoSelect);
      setShowVinculacion(true);
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Error desconocido'}`);
    } finally {
      setVinculacionLoading(false);
    }
  };

  const handleConfirmMatches = async () => {
    const pairs = Object.entries(selectedMatches).map(([syncId, ventaId]) => ({ syncId, ventaId }));
    if (pairs.length === 0) {
      alert('Selecciona al menos un par para vincular');
      return;
    }
    setVinculando(true);
    try {
      const { mercadoLibreService } = await import('../../services/mercadoLibre.service');
      const res = await mercadoLibreService.confirmMatch(pairs);
      setVinculacionResult({ vinculados: res.vinculados, errores: res.errores });
      const updated = await mercadoLibreService.matchSuggestions();
      setVinculacionData(updated);
      setSelectedMatches({});
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Error desconocido'}`);
    } finally {
      setVinculando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex bg-gray-100 rounded-lg p-0.5 overflow-x-auto scrollbar-hide">
          {[
            { id: 'todos', label: 'Todas' },
            { id: 'pendiente', label: 'Pendientes' },
            { id: 'procesada', label: 'Procesadas' },
            { id: 'error', label: 'Con error' },
            { id: 'ignorada', label: 'Ignoradas' },
          ].map((f) => {
            const count = f.id === 'todos' ? orderSyncs.length : orderSyncs.filter((o) => o.estado === f.id).length;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex-shrink-0 ${
                  filter === f.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f.label}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setToolsOpen(!toolsOpen)}
              disabled={reenrichingBuyers || importingOrders || patchingEnvio || reparandoUrbano || reparandoNombres || consolidatingPacks || runningDiagnostic || reingenieriando || procesando}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              {(reenrichingBuyers || importingOrders || patchingEnvio || reparandoUrbano || consolidatingPacks || runningDiagnostic || reingenieriando) ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Settings className="w-3.5 h-3.5" />
              )}
              {reenrichingBuyers ? 'Actualizando Buyers...' :
               reparandoUrbano ? 'Reparando Urbano...' :
               reparandoNombres ? 'Reparando Nombres...' :
               patchingEnvio ? 'Parcheando Envíos...' :
               consolidatingPacks ? 'Consolidando Packs...' :
               runningDiagnostic ? 'Diagnosticando...' :
               reingenieriando ? 'Reingeniería ML...' :
               importingOrders ? 'Importando...' : 'Herramientas'}
              <ChevronDown className="w-3 h-3" />
            </button>
            {toolsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setToolsOpen(false)} />
                <div className="absolute left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <button
                    onClick={() => { setToolsOpen(false); handleReenrichBuyers(); }}
                    disabled={reenrichingBuyers || importingOrders || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-purple-500" />
                    Actualizar Buyers
                  </button>
                  <button
                    onClick={() => { setToolsOpen(false); handlePatchEnvio(); }}
                    disabled={patchingEnvio || importingOrders || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Truck className="w-3.5 h-3.5 text-teal-500" />
                    Patch Envíos
                  </button>
                  <button
                    onClick={() => { setToolsOpen(false); handleRepararUrbano(); }}
                    disabled={reparandoUrbano || procesando || reenrichingBuyers}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                    Reparar Ventas Urbano
                  </button>
                  <button
                    onClick={() => { setToolsOpen(false); handleRepararNombres(); }}
                    disabled={reparandoNombres || procesando || reenrichingBuyers}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Type className="w-3.5 h-3.5 text-purple-500" />
                    Reparar Nombres y DNI
                  </button>
                  <button
                    onClick={() => { setToolsOpen(false); handleImportarHistorial(); }}
                    disabled={importingOrders || procesando || reenrichingBuyers}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-500" />
                    Importar Historial ML
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => { setToolsOpen(false); handleConsolidarPacks(true); }}
                    disabled={consolidatingPacks || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Package className="w-3.5 h-3.5 text-indigo-500" />
                    Diagnosticar Packs Duplicados
                  </button>
                  <button
                    onClick={() => { setToolsOpen(false); handleConsolidarPacks(false); }}
                    disabled={consolidatingPacks || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Package className="w-3.5 h-3.5 text-red-500" />
                    Corregir Packs Duplicados
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => { setToolsOpen(false); handleDiagnostico(); }}
                    disabled={runningDiagnostic || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Search className="w-3.5 h-3.5 text-emerald-500" />
                    Diagnóstico Integral Sistema
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => { setToolsOpen(false); handleLoadSuggestions(); }}
                    disabled={vinculacionLoading || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                  >
                    <Link2 className="w-3.5 h-3.5 text-blue-500" />
                    {vinculacionLoading ? 'Cargando...' : 'Vincular Órdenes ML ↔ Ventas'}
                  </button>
                  <button
                    onClick={() => { setToolsOpen(false); handleLoadInconsistencias(); }}
                    disabled={inconsistenciasLoading || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    {inconsistenciasLoading ? 'Analizando...' : 'Resolver Inconsistencias Financieras'}
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <div className="px-3 py-1.5">
                    <label className="text-[10px] text-gray-500 block mb-1">Saldo real MP (S/):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={saldoRealMP}
                      onChange={(e) => setSaldoRealMP(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-orange-300"
                      placeholder="ej: 2677.51"
                    />
                  </div>
                  <button
                    onClick={() => { setToolsOpen(false); handleReingenieria(true); }}
                    disabled={reingenieriando || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-orange-500" />
                    Reingeniería ML (Preview)
                  </button>
                  <button
                    onClick={() => { setToolsOpen(false); handleReingenieria(false); }}
                    disabled={reingenieriando || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-red-500" />
                    Ejecutar Reingeniería ML
                  </button>
                </div>
              </>
            )}
          </div>

          {pendientesProcesables.length > 0 && (
            <button
              onClick={handleProcesarTodos}
              disabled={procesando || importingOrders}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {procesando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              Procesar Todos ({pendientesProcesables.length})
            </button>
          )}
        </div>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
          <Download className="w-4 h-4 flex-shrink-0" />
          <span>
            {importResult.importadas} orden{importResult.importadas !== 1 ? 'es' : ''} importada{importResult.importadas !== 1 ? 's' : ''}
            {importResult.omitidas > 0 && `, ${importResult.omitidas} ya existía${importResult.omitidas !== 1 ? 'n' : ''}`}
            {importResult.errores > 0 && `, ${importResult.errores} error${importResult.errores !== 1 ? 'es' : ''}`}
            {' '}(total en ML: {importResult.totalEnML})
          </span>
          <button onClick={() => setImportResult(null)} className="ml-auto text-blue-400 hover:text-blue-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Re-enrich result banner */}
      {reenrichResult && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg bg-purple-50 border border-purple-200 text-purple-700">
          <RefreshCw className="w-4 h-4 flex-shrink-0" />
          <span>
            {reenrichResult.actualizadas}/{reenrichResult.total} órdenes actualizadas
            {reenrichResult.clientesActualizados > 0 && `, ${reenrichResult.clientesActualizados} cliente${reenrichResult.clientesActualizados !== 1 ? 's' : ''} actualizados`}
            {reenrichResult.errores > 0 && `, ${reenrichResult.errores} error${reenrichResult.errores !== 1 ? 'es' : ''}`}
          </span>
          <button onClick={() => setReenrichResult(null)} className="ml-auto text-purple-400 hover:text-purple-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Repair Urbano result banner */}
      {repairResult && (
        <div className="px-3 py-2 text-xs rounded-lg bg-orange-50 border border-orange-200 text-orange-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">
              {repairResult.reparadas} venta{repairResult.reparadas !== 1 ? 's' : ''} reparada{repairResult.reparadas !== 1 ? 's' : ''}
              {repairResult.errores > 0 && `, ${repairResult.errores} error${repairResult.errores !== 1 ? 'es' : ''}`}
            </span>
            <button onClick={() => setRepairResult(null)} className="ml-auto text-orange-400 hover:text-orange-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {repairResult.detalles.length > 0 && (
            <ul className="mt-1 ml-6 space-y-0.5 text-[11px] text-orange-600">
              {repairResult.detalles.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Repair Nombres/DNI result banner */}
      {nombresResult && (
        <div className="px-3 py-2 text-xs rounded-lg bg-purple-50 border border-purple-200 text-purple-700">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">
              {nombresResult.reparadas} venta{nombresResult.reparadas !== 1 ? 's' : ''} corregida{nombresResult.reparadas !== 1 ? 's' : ''}
              {nombresResult.errores > 0 && `, ${nombresResult.errores} error${nombresResult.errores !== 1 ? 'es' : ''}`}
            </span>
            <button onClick={() => setNombresResult(null)} className="ml-auto text-purple-400 hover:text-purple-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {nombresResult.detalles.length > 0 && (
            <ul className="mt-1 ml-6 space-y-0.5 text-[11px] text-purple-600">
              {nombresResult.detalles.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Pack consolidation result banner */}
      {packResult && (
        <div className="px-3 py-2 text-xs rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">
              {packMode === 'dry' ? 'Diagnóstico' : 'Corrección'}: {packResult.duplicatesFound} pack{packResult.duplicatesFound !== 1 ? 's' : ''} duplicado{packResult.duplicatesFound !== 1 ? 's' : ''} encontrado{packResult.duplicatesFound !== 1 ? 's' : ''}
              {packMode === 'fix' && `, ${packResult.fixed} corregido${packResult.fixed !== 1 ? 's' : ''}`}
            </span>
            <button onClick={() => setPackResult(null)} className="ml-auto text-indigo-400 hover:text-indigo-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {packResult.log.length > 0 && (
            <ul className="mt-1 ml-6 space-y-0.5 text-[11px] text-indigo-600 max-h-40 overflow-y-auto">
              {packResult.log.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Diagnostic result banner */}
      {diagResult && (
        <div className={`px-3 py-2 text-xs rounded-lg border ${
          diagResult.totalIssues === 0
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : diagResult.criticas > 0
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">
              {diagResult.totalIssues === 0
                ? 'Sistema limpio — sin registros fantasma ni inconsistencias'
                : `${diagResult.totalIssues} problema${diagResult.totalIssues !== 1 ? 's' : ''}: ${diagResult.criticas} crítico${diagResult.criticas !== 1 ? 's' : ''}, ${diagResult.altas} alto${diagResult.altas !== 1 ? 's' : ''}, ${diagResult.medias} medio${diagResult.medias !== 1 ? 's' : ''}`
              }
            </span>
            <button onClick={() => setDiagResult(null)} className="ml-auto opacity-50 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {diagResult.log.length > 0 && (
            <ul className="mt-1 ml-6 space-y-0.5 text-[11px] opacity-80 max-h-60 overflow-y-auto font-mono">
              {diagResult.log.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          {diagResult.issues?.some((i: any) => i.tipo === 'balance_mp_descuadrado') && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => handleAnalizarBalance(true)}
                disabled={analizandoBalance}
                className="px-2.5 py-1 text-[11px] font-medium rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                {analizandoBalance && <Loader2 className="w-3 h-3 animate-spin" />}
                {analizandoBalance ? 'Analizando...' : 'Analizar Descuadre MP'}
              </button>
              <button
                onClick={() => handleAnalizarBalance(false)}
                disabled={analizandoBalance}
                className="px-2.5 py-1 text-[11px] font-medium rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                Corregir Balance MP
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reingeniería ML result banner */}
      {reingenieriaResult && (
        <div className={`px-3 py-2 text-xs rounded-lg border ${
          reingenieriaResult.dryRun
            ? 'bg-orange-50 border-orange-200 text-orange-700'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          <div className="flex items-center gap-2">
            <RotateCw className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">
              {reingenieriaResult.dryRun ? 'Preview Reingeniería' : 'Reingeniería Ejecutada'}: {reingenieriaResult.ordenesAnalizadas} órdenes, {reingenieriaResult.ventasActualizadas} ventas actualizadas
            </span>
            <button onClick={() => setReingenieriaResult(null)} className="ml-auto opacity-50 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-1.5 ml-6 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 text-[11px] opacity-80">
            <span>Mov. anulados: {reingenieriaResult.movimientosAnulados}</span>
            <span>Mov. creados: {reingenieriaResult.movimientosCreados}</span>
            <span>Gastos elim: {reingenieriaResult.gastosEliminados}</span>
            <span>Gastos creados: {reingenieriaResult.gastosCreados}</span>
          </div>
          <div className="mt-1 ml-6 text-[11px] opacity-80">
            Balance MP: S/ {reingenieriaResult.balanceMP?.anterior?.toFixed(2) ?? '—'} → calculado: S/ {reingenieriaResult.balanceMP?.calculado?.toFixed(2) ?? '—'}
            {reingenieriaResult.balanceMP?.saldoRealMP != null && (
              <> | Real: S/ {reingenieriaResult.balanceMP.saldoRealMP.toFixed(2)} | Ajuste: S/ {reingenieriaResult.balanceMP.ajusteReconciliacion > 0 ? '+' : ''}{reingenieriaResult.balanceMP.ajusteReconciliacion.toFixed(2)} | Final: S/ {reingenieriaResult.balanceMP.final.toFixed(2)}</>
            )}
          </div>
          {reingenieriaResult.log.length > 0 && (
            <ul className="mt-1 ml-6 space-y-0.5 text-[11px] opacity-80 max-h-60 overflow-y-auto font-mono">
              {reingenieriaResult.log.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Panel de Inconsistencias Financieras */}
      {showInconsistencias && inconsistenciasData && (
        <div className="bg-white border border-amber-200 rounded-lg shadow-sm">
          <div className="p-4 border-b border-amber-100 bg-amber-50 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-amber-900">
                Inconsistencias Financieras ({inconsistenciasData.totalInconsistencias})
              </h3>
              <span className="text-xs text-amber-600 ml-2">
                {inconsistenciasData.totalHuerfanos} movimientos huérfanos en MP
              </span>
            </div>
            <button onClick={() => setShowInconsistencias(false)} className="text-amber-400 hover:text-amber-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {inconsistenciasData.inconsistencias.map((inc: any) => {
              const resolucion = resoluciones.get(inc.ventaId);
              const fecha = inc.fechaVenta ? new Date(inc.fechaVenta).toLocaleDateString('es-PE') : '?';

              return (
                <div key={inc.ventaId} className={`border rounded-lg p-3 ${inc.tipo === 'sin_movimientos' ? 'border-amber-200 bg-amber-50/30' : 'border-red-200 bg-red-50/30'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${inc.tipo === 'sin_movimientos' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {inc.tipo === 'sin_movimientos' ? 'SIN MOVIMIENTO' : 'MONTO INCORRECTO'}
                    </span>
                    <span className="font-mono font-semibold text-sm">{inc.ventaNumero}</span>
                    <span className="text-xs text-gray-500">{inc.clienteNombre}</span>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-xs text-gray-500">{fecha}</span>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-xs font-medium">{inc.metodoEnvio}</span>
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    Total correcto: <strong className="text-green-700">S/ {inc.totalPENCorrecto.toFixed(2)}</strong>
                    {' | '}Subtotal: S/ {inc.subtotalPEN.toFixed(2)}
                    {' | '}Comisión: S/ {inc.comisionML.toFixed(2)}
                    {inc.cargoEnvioML > 0 && <> | Cargo envío: S/ {inc.cargoEnvioML.toFixed(2)}</>}
                  </div>

                  {inc.tipo === 'monto_incorrecto' && inc.movimientoActual && (
                    <div className="text-xs bg-red-50 p-2 rounded border border-red-100 mb-2">
                      Movimiento actual: <strong>S/ {inc.movimientoActual.monto.toFixed(2)}</strong> ({inc.movimientoActual.concepto})
                      <br />Diferencia: <strong className="text-red-600">S/ {inc.diferencia?.toFixed(2)}</strong>
                      <br /><span className="text-gray-500 italic">La reingeniería anulará este movimiento y creará uno nuevo con el monto correcto.</span>
                    </div>
                  )}

                  {inc.tipo === 'sin_movimientos' && (
                    <div className="space-y-1">
                      <div className="text-[11px] text-gray-500 font-medium mb-1">Candidatos (movimientos huérfanos que podrían corresponder):</div>
                      {inc.candidatos.length === 0 ? (
                        <div className="text-xs text-gray-400 italic pl-2">Ningún candidato encontrado. Se creará movimiento nuevo en la reingeniería.</div>
                      ) : (
                        inc.candidatos.map((cand: any) => (
                          <label key={cand.movId} className={`flex items-start gap-2 p-1.5 rounded cursor-pointer hover:bg-amber-50 ${resolucion?.movId === cand.movId && resolucion?.accion === 'vincular' ? 'bg-green-50 ring-1 ring-green-300' : ''}`}>
                            <input
                              type="radio"
                              name={`inc-${inc.ventaId}`}
                              checked={resolucion?.movId === cand.movId && resolucion?.accion === 'vincular'}
                              onChange={() => {
                                const m = new Map(resoluciones);
                                m.set(inc.ventaId, { movId: cand.movId, accion: 'vincular' });
                                setResoluciones(m);
                              }}
                              className="mt-0.5"
                            />
                            <div className="text-xs flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-semibold">S/ {cand.monto.toFixed(2)}</span>
                                <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${cand.score >= 70 ? 'bg-green-100 text-green-700' : cand.score >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                  {cand.score} pts
                                </span>
                                <span className="text-gray-400 text-[10px]">{cand.matchDetail}</span>
                              </div>
                              <div className="text-gray-500 text-[10px] mt-0.5 truncate max-w-lg">
                                {cand.tipo} | {cand.concepto} | {cand.fecha ? new Date(cand.fecha).toLocaleDateString('es-PE') : '?'}
                              </div>
                              <div className="text-gray-400 text-[9px] font-mono">{cand.movId}</div>
                            </div>
                          </label>
                        ))
                      )}
                      <label className={`flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-gray-50 ${resolucion?.accion === 'skip' || !resolucion ? 'bg-gray-50 ring-1 ring-gray-200' : ''}`}>
                        <input
                          type="radio"
                          name={`inc-${inc.ventaId}`}
                          checked={!resolucion || resolucion.accion === 'skip'}
                          onChange={() => {
                            const m = new Map(resoluciones);
                            m.set(inc.ventaId, { movId: '', accion: 'skip' });
                            setResoluciones(m);
                          }}
                          className="mt-0.5"
                        />
                        <span className="text-xs text-gray-500">No vincular (se creará movimiento nuevo en reingeniería)</span>
                      </label>
                    </div>
                  )}
                </div>
              );
            })}

            {inconsistenciasData.inconsistencias.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                No se encontraron inconsistencias. El balance debería cuadrar correctamente.
              </div>
            )}
          </div>

          {/* Barra de acciones */}
          {inconsistenciasData.inconsistencias.filter((i: any) => i.tipo === 'sin_movimientos').length > 0 && (
            <div className="p-3 border-t border-amber-100 bg-amber-50/50 rounded-b-lg flex items-center justify-between">
              <div className="text-xs text-amber-700">
                {Array.from(resoluciones.values()).filter((r) => r.accion === 'vincular').length} vinculaciones seleccionadas
                {' de '}
                {inconsistenciasData.inconsistencias.filter((i: any) => i.tipo === 'sin_movimientos').length} inconsistencias
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowInconsistencias(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAplicarResoluciones}
                  disabled={resolviendoInconsistencias || Array.from(resoluciones.values()).filter((r) => r.accion === 'vincular').length === 0}
                  className="px-3 py-1.5 text-xs text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {resolviendoInconsistencias ? 'Aplicando...' : 'Aplicar Vinculaciones'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vinculación ML ↔ Ventas panel */}
      {showVinculacion && vinculacionData && (
        <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-800">Vincular Órdenes ML ↔ Ventas</h3>
              <span className="text-[11px] text-gray-400">
                {vinculacionData.totalSyncPendientes} pendientes · {vinculacionData.totalVentasSinVincular} ventas sin vincular
              </span>
            </div>
            <button onClick={() => setShowVinculacion(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {vinculacionResult && (
            <div className="text-xs px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg">
              {vinculacionResult.vinculados} vinculados{vinculacionResult.errores > 0 ? `, ${vinculacionResult.errores} errores` : ''}
            </div>
          )}

          {vinculacionData.suggestions.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No hay órdenes pendientes por vincular.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {vinculacionData.suggestions.map((s) => (
                <div key={s.syncId} className="border border-gray-200 rounded-lg p-3 text-xs">
                  {/* ML Order info */}
                  <div className="flex items-start gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800">ML #{s.mlOrderId}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          s.syncMetodoEnvio === 'flex' ? 'bg-green-100 text-green-700' :
                          s.syncMetodoEnvio === 'urbano' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {s.syncMetodoEnvio}
                        </span>
                        <span className="text-gray-500">{s.syncFecha}</span>
                      </div>
                      <div className="text-gray-600 mt-0.5">
                        {s.syncBuyerName} {s.syncBuyerDni ? `· DNI: ${s.syncBuyerDni}` : ''}
                        {' · '}S/ {s.syncTotal.toFixed(2)}
                      </div>
                      <div className="text-gray-400 truncate">{s.syncProductos}</div>
                    </div>
                  </div>

                  {/* Match candidates */}
                  {s.matches.length === 0 ? (
                    <div className="text-gray-400 italic ml-4">Sin coincidencias encontradas</div>
                  ) : (
                    <div className="ml-4 space-y-1">
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide">Coincidencias sugeridas:</div>
                      {s.matches.map((m) => (
                        <label
                          key={m.ventaId}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                            selectedMatches[s.syncId] === m.ventaId
                              ? 'bg-blue-50 border border-blue-300'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`match-${s.syncId}`}
                            checked={selectedMatches[s.syncId] === m.ventaId}
                            onChange={() => setSelectedMatches((prev) => ({ ...prev, [s.syncId]: m.ventaId }))}
                            className="text-blue-600"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-700">{m.numeroVenta}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                m.score >= 60 ? 'bg-emerald-100 text-emerald-700' :
                                m.score >= 30 ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {m.score}pts
                              </span>
                              <span className="text-gray-400">{m.matchDetails.join(' · ')}</span>
                            </div>
                            <div className="text-gray-500">
                              {m.nombreCliente} {m.dniRuc ? `· ${m.dniRuc}` : ''} · S/ {m.totalPEN.toFixed(2)} · {m.fechaCreacion}
                            </div>
                            <div className="text-gray-400 truncate">{m.productos}</div>
                          </div>
                        </label>
                      ))}
                      {/* Option to skip */}
                      <label className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-gray-400 hover:bg-gray-50 ${
                        !selectedMatches[s.syncId] ? 'bg-gray-50' : ''
                      }`}>
                        <input
                          type="radio"
                          name={`match-${s.syncId}`}
                          checked={!selectedMatches[s.syncId]}
                          onChange={() => setSelectedMatches((prev) => {
                            const next = { ...prev };
                            delete next[s.syncId];
                            return next;
                          })}
                          className="text-gray-400"
                        />
                        <span>No vincular (omitir)</span>
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Action bar */}
          {vinculacionData.suggestions.some((s) => s.matches.length > 0) && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                {Object.keys(selectedMatches).length} de {vinculacionData.suggestions.length} seleccionados
              </span>
              <button
                onClick={handleConfirmMatches}
                disabled={vinculando || Object.keys(selectedMatches).length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {vinculando ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Vincular Seleccionados
              </button>
            </div>
          )}
        </div>
      )}

      {/* Batch process result */}
      {batchResult && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg bg-green-50 border border-green-200 text-green-700">
          <CheckCircle2 className="w-4 h-4" />
          {batchResult.procesadas} procesada{batchResult.procesadas !== 1 ? 's' : ''}
          {batchResult.errores > 0 && `, ${batchResult.errores} error${batchResult.errores !== 1 ? 'es' : ''}`}
        </div>
      )}

      {/* Origin summary when there are historical orders */}
      {countHistorico > 0 && orderSyncs.length > 0 && (
        <div className="flex items-center gap-3 text-[11px] text-gray-400 px-1">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-300" /> {countHistorico} importado{countHistorico !== 1 ? 's' : ''}
          </span>
          {countWebhook > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-300" /> {countWebhook} tiempo real
            </span>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1">
            No hay órdenes {filter !== 'todos' ? `con estado "${filter}"` : 'sincronizadas'}
          </p>
          {orderSyncs.length === 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-400">
                Las órdenes llegan automáticamente por webhook, o puedes importar el historial desde ML.
              </p>
              <button
                onClick={handleImportarHistorial}
                disabled={importingOrders}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {importingOrders ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {importingOrders ? 'Importando historial...' : 'Importar Historial de ML'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y">
          {filtered.map((order) => (
            <OrderRow key={order.id} order={order} expanded />
          ))}
        </div>
      )}
    </div>
  );
};
