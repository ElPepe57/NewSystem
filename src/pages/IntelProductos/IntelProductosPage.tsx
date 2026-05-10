/**
 * IntelProductosPage · Shell orquestador · Cost Intelligence System
 *
 * chk5.B (S3.6 M1.bis · Cost Intelligence)
 *
 * Página principal del módulo nuevo. Orquesta:
 *   - Header canon (HeaderV2)
 *   - WorkspaceSwitcher (tabs 1-5 con keyboard nav)
 *   - KpiStripExecutive (5 KPIs ejecutivos)
 *   - Workspace activo (1 de 5 · enrutado por URL)
 *   - KeyboardHints (banner de atajos)
 *
 * Ruteo:
 *   - /intel-productos             → Catálogo (default)
 *   - /intel-productos/costos      → Costos (empty state)
 *   - /intel-productos/pipeline    → Pipeline (empty state)
 *   - /intel-productos/alertas     → Alertas (empty state)
 *   - /intel-productos/forecast    → Forecast (empty state)
 *
 * Mockup canónico: docs/mockups/cost-intelligence-vision-s3.6.html
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { useProductoStore } from '../../store/productoStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { calcularInvestigacion } from '../Productos/utils/investigacionCalculos';

import { HeaderV2 } from './components/shell/HeaderV2';
import { WorkspaceSwitcher, type WorkspaceId, WORKSPACES } from './components/shell/WorkspaceSwitcher';
import { KpiStripExecutive, type KpiCatalogo } from './components/shell/KpiStripExecutive';
import { KeyboardHints } from './components/shell/KeyboardHints';

import { CatalogoWorkspace } from './components/workspaces/CatalogoWorkspace';
import { CostosWorkspace } from './components/workspaces/CostosWorkspace';
import { PipelineWorkspace } from './components/workspaces/PipelineWorkspace';
import { AlertasWorkspace } from './components/workspaces/AlertasWorkspace';
import { ForecastWorkspace } from './components/workspaces/ForecastWorkspace';

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

  // Stores · cargamos catálogo + TC
  const { productos, fetchProductos, loading: loadingProductos } = useProductoStore();
  const { getTCDelDia } = useTipoCambioStore();
  const [tc, setTc] = useState<number>(3.7);

  useEffect(() => {
    if (productos.length === 0) fetchProductos(false);
    getTCDelDia().then((tcData) => {
      if (tcData?.venta) setTc(tcData.venta);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // KPIs ejecutivos derivados del catálogo
  const kpis = useMemo<KpiCatalogo>(() => {
    if (productos.length === 0) {
      return {
        totalProductos: 0,
        marcasUnicas: 0,
        lineasUnicas: 0,
        productosInvestigados: 0,
        porcentajeInvestigados: 0,
        margenPromedio: null,
        productosSinPrecioVenta: 0,
        stabilityScore: 0,
      };
    }

    const marcas = new Set<string>();
    const lineas = new Set<string>();
    let investigados = 0;
    let sinPrecio = 0;
    const margenes: number[] = [];

    for (const p of productos) {
      if (p.marca) marcas.add(p.marca);
      if (p.lineaNegocioNombre) lineas.add(p.lineaNegocioNombre);

      const c = calcularInvestigacion(p, tc);
      if (c.tieneInvestigacion) {
        investigados++;
        if (c.tieneInvestigacion && c.margenPct !== undefined) {
          margenes.push(c.margenPct);
        }
      }
      if (c.precioVentaManual <= 0 && c.precioReferencia <= 0) {
        sinPrecio++;
      }
    }

    const margenPromedio = margenes.length > 0
      ? margenes.reduce((s, m) => s + m, 0) / margenes.length
      : null;

    return {
      totalProductos: productos.length,
      marcasUnicas: marcas.size,
      lineasUnicas: lineas.size,
      productosInvestigados: investigados,
      porcentajeInvestigados: (investigados / productos.length) * 100,
      margenPromedio,
      productosSinPrecioVenta: sinPrecio,
      // Stability score: placeholder · cuando haya variance real, se calcula con desviación
      // estándar relativa de costos en los últimos 90 días por producto.
      stabilityScore: 0,
    };
  }, [productos, tc]);

  // Workspace label dinámico
  const activeWorkspace = WORKSPACES.find(w => w.id === activeId)!;
  const workspaceLabel = activeId === 'catalogo'
    ? `Catálogo · ${productos.length.toLocaleString('es-PE')} productos`
    : activeWorkspace.label;

  // Subtítulo por workspace
  const subtitle = activeId === 'catalogo'
    ? 'Vista valorizada del catálogo · score por calidad de datos · drill-down por SKU'
    : activeWorkspace.description;

  // Renderizar workspace activo
  const renderWorkspace = () => {
    switch (activeId) {
      case 'catalogo':
        return <CatalogoWorkspace productos={productos} tc={tc} />;
      case 'costos':
        return <CostosWorkspace />;
      case 'pipeline':
        return <PipelineWorkspace />;
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
        loading={loadingProductos}
        onRecalcular={() => fetchProductos(false)}
        onExport={() => {
          // chk5.B (MVP): export diferido · pendiente integración con export.service
          alert('Reporte ejecutivo · próximamente');
        }}
      />

      <WorkspaceSwitcher activeId={activeId} />

      <KpiStripExecutive kpis={kpis} />

      {renderWorkspace()}

      <KeyboardHints />
    </div>
  );
};
