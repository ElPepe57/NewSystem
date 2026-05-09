/**
 * AtencionTab · fusión canónica de Alertas + Incidencias
 *
 * Reemplaza los 2 tabs separados (Alertas + Incidencias) por uno solo
 * llamado "Atención" con sub-tabs internos secundarios. Decisión D1
 * S3.6 M1 chk4.2 (carta blanca canon · 2026-05-08).
 *
 * Estructura:
 *   - Header de subtabs (SegmentedControl horizontal)
 *     - "Alertas activas" (vencimiento próximo · stock crítico · sin movimiento)
 *     - "Incidencias" (vencidas · dañadas · pérdidas registradas)
 *   - Render condicional del componente correspondiente
 *
 * Cada sub-vista delega a los componentes existentes (AlertasInventario
 * e IncidenciasTab) que ya están en sections/.
 */

import React, { useState } from 'react';
import { Bell, AlertTriangle } from 'lucide-react';
import { AlertasInventario } from './AlertasInventario';
import { IncidenciasTab } from './IncidenciasTab';
import { SegmentedControl } from '../shell/SegmentedControl';
import type { Unidad } from '../../../../types/unidad.types';
import type { Producto } from '../../../../types/producto.types';

type SubTabAtencion = 'alertas' | 'incidencias';

interface AtencionTabProps {
  unidades: Unidad[];
  productos: Producto[];
  onVerProducto: (productoId: string) => void;
  onPromocionar: (productoId: string) => void;
  onOpenVencidasModal: () => void;
  onRefresh: () => void;
}

export const AtencionTab: React.FC<AtencionTabProps> = ({
  unidades,
  productos,
  onVerProducto,
  onPromocionar,
  onOpenVencidasModal,
  onRefresh,
}) => {
  const [subTab, setSubTab] = useState<SubTabAtencion>('alertas');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SegmentedControl<SubTabAtencion>
          options={[
            { value: 'alertas', label: 'Alertas activas', icon: Bell },
            { value: 'incidencias', label: 'Incidencias', icon: AlertTriangle },
          ]}
          value={subTab}
          onChange={setSubTab}
        />
      </div>

      {subTab === 'alertas' && (
        <AlertasInventario
          unidades={unidades}
          productos={productos}
          onVerProducto={onVerProducto}
          onPromocionar={onPromocionar}
        />
      )}

      {subTab === 'incidencias' && (
        <IncidenciasTab
          onOpenVencidasModal={onOpenVencidasModal}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
};
