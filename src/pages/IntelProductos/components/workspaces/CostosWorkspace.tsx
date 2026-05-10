/**
 * CostosWorkspace · workspace 2 · Cost Intelligence
 *
 * Visión canon: time-series · variance attribution waterfall · TCPA tracking.
 * Estado actual: placeholder · activará cuando haya OCs/envíos/gastos históricos
 * para construir la evolución temporal del costo.
 */

import React from 'react';
import { DollarSign } from 'lucide-react';
import { EmptyWorkspace } from './EmptyWorkspace';

export const CostosWorkspace: React.FC = () => (
  <EmptyWorkspace
    icon={DollarSign}
    iconColor="amber"
    title="Costos · evolución temporal"
    description="Mostrará la serie temporal del costo unitario por producto, variance attribution (precio proveedor · flete · TC · landed) y tracking de TCPA del Pool USD."
    prerequisites={[
      'Al menos 2 órdenes de compra cerradas del mismo producto (para calcular delta)',
      'Envíos recibidos con landed cost completo (flete + aduana asignados)',
      'Histórico mínimo de 30 días para mostrar series',
    ]}
    ctas={[
      { label: 'Crear orden de compra', href: '/compras', variant: 'primary' },
      { label: 'Ver envíos', href: '/envios' },
    ]}
  />
);
