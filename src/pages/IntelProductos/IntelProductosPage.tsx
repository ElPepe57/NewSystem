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
import { useParams } from 'react-router-dom';

import { useProductoStore } from '../../store/productoStore';
import { useOrdenCompraStore } from '../../store/ordenCompraStore';
import { useUnidadStore } from '../../store/unidadStore';
import { usePoolUSDStore } from '../../store/poolUSDStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { useGastoStore } from '../../store/gastoStore';
import { useCategoriaCostoStore } from '../../store/categoriaCostoStore';

import { calcularCostIntelligence } from './utils/costIntelligence';

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

  // ─── Cost Intelligence: data engine propio (NO investigación) ────────────
  const ciResult = useMemo(() => {
    return calcularCostIntelligence({
      productos,
      ordenes,
      unidades,
      tcpa: poolResumen?.tcpa,
      tcSpotFallback,
    });
  }, [productos, ordenes, unidades, poolResumen, tcSpotFallback]);

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
  const renderWorkspace = () => {
    // Si NO hay data operacional → empty state global en TODOS los workspaces
    if (!ciResult.hasOperationalData) {
      return <EmptyStateGlobal prerequisitos={ciResult.prerequisitos} />;
    }

    switch (activeId) {
      case 'catalogo':
        return <CatalogoWorkspace skus={ciResult.skus} />;
      case 'costos':
        return (
          <CostosWorkspace
            skus={ciResult.skus}
            gastos={gastos}
            arbolCategorias={arbolCategorias}
            poolSnapshots={poolSnapshots}
            saldoUSDPool={poolResumen?.saldoUSD}
          />
        );
      case 'pipeline':
        return (
          <PipelineWorkspace
            unidades={unidades}
            productos={productos}
            tcpa={poolResumen?.tcpa}
            tcSpotFallback={tcSpotFallback}
          />
        );
      case 'alertas':
        return <AlertasWorkspace />;
      case 'forecast':
        return <ForecastWorkspace />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
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
