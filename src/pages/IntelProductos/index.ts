/**
 * Cost Intelligence System · Punto de entrada del módulo
 *
 * chk5.B (S3.6 M1.bis) — módulo nuevo que reemplaza progresivamente:
 *   - src/pages/ProductosIntel/ProductosIntel.tsx (legacy)
 *   - src/pages/CTRU/CTRUDashboard.tsx (legacy)
 *
 * Visión canon: docs/mockups/cost-intelligence-vision-s3.6.html
 * 5 workspaces analíticos navegables por URL:
 *   - /intel-productos          → Catálogo (MVP funcional · 212 productos)
 *   - /intel-productos/costos   → Costos (empty state · pendiente data)
 *   - /intel-productos/pipeline → Pipeline (empty state · pendiente data)
 *   - /intel-productos/alertas  → Alertas (empty state · pendiente data)
 *   - /intel-productos/forecast → Forecast (empty state · pendiente data)
 */
export { IntelProductosPage } from './IntelProductosPage';
export type { WorkspaceId } from './components/shell/WorkspaceSwitcher';
