/**
 * Paso 2 · Unidades (rework 3b · "unidades como paso propio")
 *
 * Antes vivía como 3ª sección dentro del Paso 1. Ahora es su propio paso, con la
 * pantalla completa para elegir la carga (buscador + picker por lote/vencimiento).
 * Se filtra por el origen elegido en el Paso 1 (SeccionUnidades ya lee del state).
 */
import React from 'react';
import type { UseEnvioWizardStateReturn } from '../useEnvioWizardState';
import { SeccionUnidades } from './paso1/SeccionUnidades';

interface Props {
  wizard: UseEnvioWizardStateReturn;
}

export const Paso2Unidades: React.FC<Props> = ({ wizard }) => {
  return (
    <div className="space-y-4">
      <SeccionUnidades wizard={wizard} disabled={false} />
    </div>
  );
};
