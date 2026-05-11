/**
 * IntelProductosPage · Shell orquestador · Cost Intelligence System
 *
 * chk5.B8 (S3.6 M1.bis · Cost Intelligence)
 *
 * Página principal del módulo. Orquesta:
 *   - Header canon (HeaderV2)
 *   - WorkspaceSwitcher (tabs 1-5 con keyboard nav)
 *   - KpiStripExecutive (4 KPIs canon CI · derivados de utilidad propia)
 *   - Workspace activo · catálogo con drill-down O empty state global
 *
 * Lógica propia Cost Intelligence (NO investigación):
 *   - Carga OCs (estado=cerrada/recibida) → capital invertido
 *   - Carga unidades → capital atrapado · variance · trend
 *   - Carga Pool USD · TCPA real
 *   - calcularCostIntelligence() produce KPIs + SKUs con costos
 *   - Si hasOperationalData=false → <EmptyStateGlobal /> con prerequisitos
 *   - Si true → workspaces activos
 *
 * Ruteo:
 *   - /intel-productos             → Catálogo (default)
 *   - /intel-productos/costos      → Costos (empty state)
 *   - /intel-productos/pipeline    → Pipeline (empty state)
 *   - /intel-productos/alertas     → Alertas (empty state)
 *   - /intel-productos/forecast    → Forecast (empty state)
 *
 * Mockup canónico: docs/mockups/cost-intelligence-canon-productos.html
 */

import React, { useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { TestTube, X } from 'lucide-react';

import { useProductoStore } from '../../store/productoStore';
import { useOrdenCompraStore } from '../../store/ordenCompraStore';
import { useUnidadStore } from '../../store/unidadStore';
import { usePoolUSDStore } from '../../store/poolUSDStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { useGastoStore } from '../../store/gastoStore';
import { useCategoriaCostoStore } from '../../store/categoriaCostoStore';

import {
  calcularCostIntelligence,
  calcularPipelineValorizado,
  calcularTCPAvsSBS,
  calcularEvolucionPorBloque,
} from './utils/costIntelligence';
// chk5.B-DEMO · modo demo URL-flag · borrar este import + uses para eliminar
import { generateDemoMockData } from './utils/seedMock';

import { HeaderV2 } from './components/shell/HeaderV2';
import { WorkspaceSwitcher, type WorkspaceId, WORKSPACES } from './components/shell/WorkspaceSwitcher';
import { KpiStripExecutive } from './components/shell/KpiStripExecutive';
import { KeyboardHints } from './components/shell/KeyboardHints';

import { CatalogoWorkspace } from './components/workspaces/CatalogoWorkspace';
import { CostosWorkspace } from './components/workspaces/CostosWorkspace';
import { PipelineWorkspace } from './components/workspaces/PipelineWorkspace';
import { AlertasWorkspace } from './components/workspaces/AlertasWorkspace';
import { ForecastWorkspace } from './components/workspaces/ForecastWorkspace';
import { EmptyStateGlobal } from './components/workspaces/EmptyStateGlobal';

/** Mapping URL slug → WorkspaceId */
function slugToWorkspaceId(slug: string | undefined): WorkspaceId {
  switch (slug) {
    case 'costos': return 'costos';
    case 'pipeline': return 'pipeline';
    case 'alertas': return 'alertas';
    case 'forecast': return 'forecast';
    default: return 'catalogo';
  }
}

export const IntelProductosPage: React.FC = () => {
  const { workspace: slug } = useParams<{ workspace?: string }>();
  const activeId = slugToWorkspaceId(slug);
  // chk5.B-DEMO · activación con ?demo=true · 100% reversible (quitar URL param)
  const [searchParams, setSearchParams] = useSearchParams();
  const isDemoMode = searchParams.get('demo') === 'true';

  // Stores · data operacional propia (cero investigación)
  const { productos, fetchProductos, loading: loadingProductos } = useProductoStore();
  const { ordenes, fetchOrdenes, loading: loadingOrdenes } = useOrdenCompraStore();
  const { unidades, fetchUnidades, loading: loadingUnidades } = useUnidadStore();
  const { resumen: poolResumen, snapshots: poolSnapshots, fetchResumen: fetchPoolResumen, fetchSnapshots: fetchPoolSnapshots } = usePoolUSDStore();
  const { getTCDelDia } = useTipoCambioStore();
  // chk5.B9 · Workspace Costos requiere gastos + árbol categorías + snapshots Pool
  const { gastos, fetchGastos, loading: loadingGastos } = useGastoStore();
  const { categorias: arbolCategorias, fetchCategorias: fetchCategoriasCosto } = useCategoriaCostoStore();

  const [tcSpotFallback, setTcSpotFallback] = React.useState<number>(3.75);

  // Cargar data operacional al montar
  useEffect(() => {
    if (productos.length === 0) fetchProductos(false);
    if (ordenes.length === 0) fetchOrdenes();
    if (unidades.length === 0) fetchUnidades();
    if (!poolResumen) fetchPoolResumen();
    if (poolSnapshots.length === 0) fetchPoolSnapshots();
    if (gastos.length === 0) fetchGastos();
    if (arbolCategorias.length === 0) fetchCategoriasCosto();
    getTCDelDia().then((tcData) => {
      if (tcData?.venta) setTcSpotFallback(tcData.venta);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading = loadingProductos || loadingOrdenes || loadingUnidades || loadingGastos;

  // chk5.B-DEMO · cuando isDemoMode=true, generamos data mock y bypasseamos
  // los stores. NO escribe a Firestore. Cero efectos colaterales.
  const demoData = useMemo(
    () => (isDemoMode ? generateDemoMockData(productos, arbolCategorias) : null),
    [isDemoMode, productos, arbolCategorias]
  );

  // Datos efectivos: si demo, mock; si no, stores reales
  const effectiveProductos = demoData?.productos ?? productos;
  const effectiveOrdenes = demoData?.ordenes ?? ordenes;
  const effectiveUnidades = demoData?.unidades ?? unidades;
  const effectiveGastos = demoData?.gastos ?? gastos;
  const effectivePoolSnapshots = demoData?.poolSnapshots ?? poolSnapshots;
  const effectivePoolResumen = demoData?.poolResumen ?? poolResumen;
  const effectiveTcSpot = demoData?.tcSpot ?? tcSpotFallback;

  // ─── Cost Intelligence: data engine propio (NO investigación) ────────────
  const ciResult = useMemo(() => {
    return calcularCostIntelligence({
      productos: effectiveProductos,
      ordenes: effectiveOrdenes,
      unidades: effectiveUnidades,
      tcpa: effectivePoolResumen?.tcpa,
      tcSpotFallback: effectiveTcSpot,
    });
  }, [effectiveProductos, effectiveOrdenes, effectiveUnidades, effectivePoolResumen, effectiveTcSpot]);

  // Pipeline + TCPAvsSBS · consumidos por Alertas para consolidar fuentes
  const pipelineResult = useMemo(
    () => calcularPipelineValorizado(effectiveUnidades, effectivePoolResumen?.tcpa, effectiveTcSpot),
    [effectiveUnidades, effectivePoolResumen, effectiveTcSpot]
  );
  const tcpaVsSBS = useMemo(
    () => calcularTCPAvsSBS(effectivePoolSnapshots, 6),
    [effectivePoolSnapshots]
  );

  // Evolución gastos por bloque · consumido por Costos y Forecast
  const evolucionGastos = useMemo(
    () => calcularEvolucionPorBloque(effectiveGastos, arbolCategorias, 6),
    [effectiveGastos, arbolCategorias]
  );

  // Workspace label dinámico (breadcrumb)
  const activeWorkspace = WORKSPACES.find((w) => w.id === activeId)!;
  const WORKSPACE_LABELS: Record<typeof activeId, string> = {
    catalogo: ciResult.hasOperationalData
      ? `Catálogo · ${ciResult.skus.length.toLocaleString('es-PE')} SKUs con costos`
      : 'Catálogo de costos · sin data aún',
    costos:   'Costos · evolución temporal',
    pipeline: 'Pipeline · capital atrapado',
    alertas:  'Alertas · anomaly detection',
    forecast: 'Forecast · proyecciones futuras',
  };
  const WORKSPACE_SUBTITLES: Record<typeof activeId, string> = {
    catalogo: 'Costos reales de adquisición · variance attribution · TCPA · capital atrapado.',
    costos:   'Time-series · variance attribution · TCPA tracking · sugerencias accionables.',
    pipeline: '6 etapas de valorización · capital atrapado · drill-down por etapa.',
    alertas:  'Anomaly detection · variance > threshold · CTAs accionables.',
    forecast: 'Proyecciones 30/60/90d · weighted moving avg · what-if scenarios.',
  };
  const workspaceLabel = WORKSPACE_LABELS[activeId];
  const subtitle = WORKSPACE_SUBTITLES[activeId];
  void activeWorkspace;

  // Renderizar workspace activo
  // chk5.B10a fix · cada workspace maneja su empty state contextual.
  // EmptyStateGlobal aplica SÓLO en Catálogo (landing del módulo · 4 prerequisitos
  // de activación). Otros workspaces tienen su propio empty state más educativo
  // para lo que ESE workspace hace específicamente.
  const renderWorkspace = () => {
    switch (activeId) {
      case 'catalogo':
        // Catálogo es landing · empty global con 4 prerequisitos de activación
        return ciResult.hasOperationalData
          ? <CatalogoWorkspace skus={ciResult.skus} />
          : <EmptyStateGlobal prerequisitos={ciResult.prerequisitos} />;
      case 'costos':
        // CostosWorkspace tiene 3 empty states internos (uno por panel)
        return (
          <CostosWorkspace
            skus={ciResult.skus}
            gastos={effectiveGastos}
            arbolCategorias={arbolCategorias}
            poolSnapshots={effectivePoolSnapshots}
            saldoUSDPool={effectivePoolResumen?.saldoUSD}
          />
        );
      case 'pipeline':
        // PipelineWorkspace tiene EmptyPipeline interno con 4 stage cards dim
        return (
          <PipelineWorkspace
            unidades={effectiveUnidades}
            productos={effectiveProductos}
            tcpa={effectivePoolResumen?.tcpa}
            tcSpotFallback={effectiveTcSpot}
          />
        );
      case 'alertas':
        // AlertasWorkspace consolida 3 fuentes del engine (variance + pipeline + fx)
        // Maneja 3 empty states internos (sin-data · todo-bajo-control · sin-resultados-filtros)
        return (
          <AlertasWorkspace
            skus={ciResult.skus}
            pipeline={pipelineResult}
            tcpaVsSBS={tcpaVsSBS}
            hasOperationalData={ciResult.hasOperationalData}
          />
        );
      case 'forecast':
        // ForecastWorkspace · proyecciones WMA + what-if · honesto con confidence
        return (
          <ForecastWorkspace
            skus={ciResult.skus}
            evolucionGastos={evolucionGastos}
            poolSnapshotsCount={effectivePoolSnapshots.length}
            capitalInvertidoPEN={ciResult.kpis.capitalInvertidoPEN}
            capitalAtrapadoPEN={ciResult.kpis.capitalAtrapadoPEN}
            hasOperationalData={ciResult.hasOperationalData}
          />
        );
    }
  };

  // chk5.B-DEMO · handler para salir del demo · quita el param de la URL
  const handleSalirDemo = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('demo');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* chk5.B-DEMO · banner rojo de modo demo · sólo visible con ?demo=true */}
      {isDemoMode && (
        <div className="bg-rose-50 border border-rose-300 rounded-lg p-3 flex items-start gap-2">
          <TestTube className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-[11px] text-rose-800">
            <span className="font-bold">MODO DEMO ACTIVO</span> · data simulada
            determinística · <span className="font-mono">NO persiste a Firestore</span>.
            Vita Skin Peru · 6 OCs · 60+ unidades · 6 meses gastos · Pool USD histórico.
            Para volver al estado real, quitar <code className="font-mono bg-rose-100 px-1 rounded">?demo=true</code> de la URL.
          </div>
          <button
            type="button"
            onClick={handleSalirDemo}
            aria-label="Salir del modo demo"
            className="text-rose-700 hover:text-rose-900 flex items-center gap-1 text-[11px] font-medium whitespace-nowrap flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            Salir del demo
          </button>
        </div>
      )}

      <HeaderV2
        workspaceLabel={workspaceLabel}
        subtitle={subtitle}
        loading={loading}
        onRecalcular={() => {
          fetchProductos(false);
          fetchOrdenes();
          fetchUnidades();
          fetchPoolResumen();
          fetchPoolSnapshots();
          fetchGastos();
          fetchCategoriasCosto();
        }}
        // Empty state · ocultamos acciones placeholder porque NO tienen sentido
        // sin data (¿qué exportás de 0 OCs? ¿qué reporte hay sobre BD vacía?).
        // Reaparecen cuando hay data operacional · evita CTAs contradictorias.
        onExport={ciResult.hasOperationalData
          ? () => alert('Exportar Cost Intelligence · próximamente')
          : undefined}
        onReporte={ciResult.hasOperationalData
          ? () => alert('Reporte ejecutivo · próximamente')
          : undefined}
      />

      <WorkspaceSwitcher activeId={activeId} />

      <KpiStripExecutive kpis={ciResult.kpis} hasData={ciResult.hasOperationalData} />

      {renderWorkspace()}

      <KeyboardHints />
    </div>
  );
};
