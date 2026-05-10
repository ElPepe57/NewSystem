/**
 * PipelineWorkspace · workspace 3 · Cost Intelligence
 *
 * Visión canon: 6 etapas valorización (pedido · pago · tránsito · aduana ·
 * almacén · venta) · capital atrapado · drill-down por etapa.
 * Estado actual: placeholder · activará cuando haya OCs/unidades/envíos
 * en distintos estados del pipeline operacional.
 */

import React from 'react';
import { GitBranch } from 'lucide-react';
import { EmptyWorkspace } from './EmptyWorkspace';

export const PipelineWorkspace: React.FC = () => (
  <EmptyWorkspace
    icon={GitBranch}
    iconColor="purple"
    title="Pipeline · capital atrapado"
    description="Mostrará el capital invertido en cada etapa del flujo operacional (pedido · pago · tránsito · aduana · almacén · venta) y permitirá identificar dónde está atrapado el cash."
    prerequisites={[
      'Al menos 1 orden de compra creada (define la etapa "pedido")',
      'Unidades en distintos estados (en tránsito · en aduana · en almacén)',
      'Envíos con costos landed asignados (define el capital atrapado)',
    ]}
    ctas={[
      { label: 'Crear orden de compra', href: '/compras', variant: 'primary' },
      { label: 'Ver inventario', href: '/inventario' },
    ]}
  />
);
