# CanalesVentaAnalytics Component

## Overview

`CanalesVentaAnalytics.tsx` is a comprehensive analytics and management component for Sales Channels (Canales de Venta). It enhances the original `CanalesVentaGestor.tsx` by adding full analytics capabilities with three distinct tabs for different views.

## Features

### 1. Three Sub-Tabs
- **Dashboard**: Main analytics view with KPIs and channel metrics
- **Lista**: Traditional list view with search and filters
- **Rendimiento**: Performance analysis with detailed metrics

### 2. Comprehensive Metrics
The component calculates and displays:
- **Volume metrics**: Total sales, quotations, conversion rates
- **Financial metrics**: Total revenue, commissions, average margin, average ticket
- **Trends**: Sales and revenue trends (vs previous period)
- **Performance**: Detailed breakdown by channel

### 3. Key Components

#### Dashboard Tab
- **5 KPI Cards**:
  - Total Canales
  - Canales Activos
  - Ventas Totales (with revenue subtitle)
  - Comisión Promedio
  - Canal Top (by revenue)

- **Distribution Cards** (3 columns):
  - Por Estado (activo/inactivo)
  - Por Comisión (with/without commission)
  - Distribución de Ventas (top 5 channels)

- **Channel Cards Grid**:
  - Each channel displays:
    - Color-coded icon
    - Sales count with trend indicator
    - Total revenue
    - Conversion rate
    - Average ticket
    - Total commissions
    - Average margin

#### Lista Tab
- Simplified KPIs (4 cards)
- Filter tabs: Todos, Activos, Inactivos
- Search functionality
- Channel cards with quick metrics
- Edit and toggle status buttons

#### Rendimiento Tab
- Performance KPIs (4 cards)
- Detailed performance table with:
  - Quotations
  - Sales
  - Conversion rate
  - Revenue
  - Average ticket
  - Total commissions
  - Average margin
- Top 3 rankings:
  - Top 3 by Sales
  - Top 3 by Revenue
  - Top 3 by Margin

## Integration

### Option 1: Replace Current Component
In `src/pages/Maestros/Maestros.tsx`:

```typescript
// Replace this import
import { CanalesVentaGestor } from '../../components/Maestros/CanalesVentaGestor';

// With this
import { CanalesVentaAnalytics } from '../../components/Maestros/CanalesVentaAnalytics';

// Then replace the usage
{tabActiva === 'canales' && (
  <CanalesVentaAnalytics />
)}
```

### Option 2: Add as New Tab
Keep both components and allow users to switch between classic and analytics view.

## Data Model

### CanalMetrics Interface
```typescript
interface CanalMetrics {
  canalId: string;
  nombre: string;
  color: string;
  icono?: string;

  // Volume
  totalVentas: number;
  totalCotizaciones: number;
  tasaConversion: number;

  // Financial
  montoTotal: number;
  comisionTotal: number;
  margenPromedio: number;
  ticketPromedio: number;

  // Trends
  tendenciaVentas: number;
  tendenciaMonto: number;
}
```

## Dependencies

### Required Stores
- `useCanalVentaStore`: Manages sales channels
- `useVentaStore`: Provides sales data for analytics
- `useAuthStore`: User authentication

### Required Types
- `CanalVenta`, `CanalVentaFormData` from `canalVenta.types`
- `Venta` from `venta.types`

### Required Components
From `../common`:
- Button, Card, Badge, Modal
- KPICard, KPIGrid
- SearchInput, TabNavigation, StatDistribution

### Icons
Uses lucide-react icons including:
- Tag, Plus, Edit2, Search, Percent, Truck
- CheckCircle, XCircle, Store, ShoppingBag
- MessageCircle, Globe, MoreHorizontal
- TrendingUp, TrendingDown, DollarSign
- Package, BarChart3, PieChart, Activity
- Target, Zap, Clock, Crown

## Metrics Calculation

### Sales Integration
The component integrates with the `ventaStore` to calculate real metrics:

1. **Volume Metrics**:
   - Counts quotations (estado === 'cotizacion')
   - Counts actual sales (estado !== 'cotizacion' && !== 'cancelada')
   - Calculates conversion rate: (sales / (sales + quotations)) * 100

2. **Financial Metrics**:
   - Sums total revenue per channel
   - Calculates commissions based on channel commission percentage
   - Computes average margin (margenNeto or margenBruto)
   - Computes average ticket (total / sales count)

3. **Trends** (Simplified):
   - Currently uses placeholder logic
   - In production, should compare current month vs previous month
   - Shows percentage change with up/down indicators

## Responsive Design

The component is fully responsive:
- Mobile: Single column layout
- Tablet: 2 columns for cards, stacked KPIs
- Desktop: 3-5 columns for optimal space usage

## Future Enhancements

### Potential Improvements
1. **Time Range Selector**: Allow users to select date ranges for analysis
2. **Charts Integration**: Add recharts for visual trend analysis
3. **Export Functionality**: Export metrics to CSV/PDF
4. **Real-time Updates**: Add real-time data refresh
5. **Comparative Analysis**: Compare multiple channels side-by-side
6. **Forecasting**: Add sales forecasting based on historical data

### Advanced Metrics
Consider adding:
- Customer lifetime value by channel
- Churn rate by channel
- Cost per acquisition
- ROI by channel
- Seasonal patterns
- Hour-of-day performance

## Performance Considerations

### Optimizations
- Uses `useMemo` for expensive calculations
- Filters computed metrics instead of re-querying
- Efficient data aggregation in single pass

### Scalability
- Handles large datasets efficiently
- Can add pagination if needed
- Supports lazy loading for channel cards

## Usage Example

```typescript
import { CanalesVentaAnalytics } from '../../components/Maestros/CanalesVentaAnalytics';

function MaestrosPage() {
  const handleViewCanal = (canal: CanalVenta) => {
    console.log('Viewing canal:', canal);
    // Navigate to detail view or show modal
  };

  return (
    <CanalesVentaAnalytics
      onViewCanal={handleViewCanal}
    />
  );
}
```

## Props

### CanalesVentaAnalyticsProps
```typescript
interface CanalesVentaAnalyticsProps {
  onViewCanal?: (canal: CanalVenta) => void;
}
```

- `onViewCanal` (optional): Callback when a channel card is clicked

## Styling

Uses Tailwind CSS classes for styling:
- Consistent with existing component design
- Follows the design system color palette
- Responsive breakpoints: sm, md, lg

## Testing Recommendations

1. **Unit Tests**:
   - Metric calculation logic
   - Filter functions
   - Data aggregation

2. **Integration Tests**:
   - Store integration
   - Form submission
   - State updates

3. **E2E Tests**:
   - Tab navigation
   - Channel creation/editing
   - Status toggling

## Migration Guide

### From CanalesVentaGestor to CanalesVentaAnalytics

**Step 1**: Import the new component
```typescript
import { CanalesVentaAnalytics } from '../../components/Maestros/CanalesVentaAnalytics';
```

**Step 2**: Replace the component usage
```typescript
// Old
<CanalesVentaGestor />

// New
<CanalesVentaAnalytics />
```

**Step 3**: (Optional) Remove old import if not needed
```typescript
// Remove if no longer used
// import { CanalesVentaGestor } from '../../components/Maestros/CanalesVentaGestor';
```

### Backward Compatibility
- Both components use the same stores
- Both components use the same form component
- No data migration required
- Can run side-by-side if needed

## Support

For questions or issues:
1. Check the component source code documentation
2. Review the type definitions in `canalVenta.types.ts`
3. Consult the store implementation in `canalVentaStore.ts`

---

**File Location**: `src/components/Maestros/CanalesVentaAnalytics.tsx`
**Created**: 2026-01-01
**Last Updated**: 2026-01-01
