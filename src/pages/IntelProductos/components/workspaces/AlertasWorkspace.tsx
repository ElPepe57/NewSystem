/**
 * AlertasWorkspace · workspace 4 · Cost Intelligence
 *
 * Visión canon: anomaly detection · variance > threshold · alertas accionables.
 * Estado actual: placeholder · activará cuando haya histórico suficiente
 * para detectar desviaciones significativas.
 */

import React from 'react';
import { Zap } from 'lucide-react';
import { EmptyWorkspace } from './EmptyWorkspace';

export const AlertasWorkspace: React.FC = () => (
  <EmptyWorkspace
    icon={Zap}
    iconColor="rose"
    title="Alertas · anomaly detection"
    description="Detectará automáticamente cambios bruscos en costo (>5% en 30d), márgenes que se erosionan, stock crítico vs lead-time, productos sin investigación vigente."
    prerequisites={[
      'Histórico de al menos 60 días de costos para establecer baseline',
      'Múltiples órdenes del mismo producto para calcular variance',
      'Unidades vendidas para alertar sobre stock crítico',
    ]}
    ctas={[
      { label: 'Investigar productos', href: '/productos', variant: 'primary' },
      { label: 'Crear orden de compra', href: '/compras' },
    ]}
  />
);
