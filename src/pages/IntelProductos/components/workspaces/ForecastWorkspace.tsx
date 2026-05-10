/**
 * ForecastWorkspace · workspace 5 · Cost Intelligence
 *
 * Visión canon: proyecciones 30/60/90d · what-if scenarios · weighted moving avg
 * con bandas de confianza.
 * Estado actual: placeholder · requiere histórico transaccional sustancial.
 */

import React from 'react';
import { TrendingUp } from 'lucide-react';
import { EmptyWorkspace } from './EmptyWorkspace';

export const ForecastWorkspace: React.FC = () => (
  <EmptyWorkspace
    icon={TrendingUp}
    iconColor="sky"
    title="Forecast · proyecciones futuras"
    description="Proyectará costos · márgenes · stock necesario para 30/60/90 días usando promedios móviles ponderados con bandas de confianza. Permitirá escenarios what-if (¿qué pasa si sube TC 5%?)."
    prerequisites={[
      'Mínimo 3 meses de histórico transaccional (compras + ventas)',
      'Variance attribution funcionando (Workspace Costos activo)',
      'Pool USD con TCPA establecido',
    ]}
    ctas={[
      { label: 'Crear orden de compra', href: '/compras', variant: 'primary' },
      { label: 'Ver pool USD', href: '/tesoreria' },
    ]}
  />
);
