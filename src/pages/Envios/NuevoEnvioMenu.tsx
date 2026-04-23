/**
 * NuevoEnvioMenu — Botón "Nuevo envío" que navega al wizard unificado (S53 F5).
 *
 * Antes (S47-S52): dropdown con 6 opciones (T2/J/E/F/I/G) filtradas por
 * feature flags. Cada una iba a una ruta distinta.
 *
 * Ahora (S53 F5 · D-4 reemplazo directo): un solo botón que va a
 * `/envios/nuevo` (EnvioWizardPage). El tipo se INFIERE del Paso 1 (origen +
 * destino). El usuario nunca ve siglas técnicas (T2, C, J, etc.).
 *
 * F y G (despacho venta / retorno devolución) salen del wizard unificado
 * y se migran a sus módulos naturales en sesiones futuras (T-F, T-G). Hasta
 * ese momento, sus rutas legacy siguen disponibles pero NO aparecen en este
 * menú (se invocan desde el detalle de la Venta/Devolución correspondiente).
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '../../components/common';

export interface NuevoEnvioMenuProps {
  /** @deprecated S53 F5 — ya no se usa. El botón navega directo a /envios/nuevo. */
  onNuevoGenerico?: () => void;
}

export const NuevoEnvioMenu: React.FC<NuevoEnvioMenuProps> = () => {
  const navigate = useNavigate();

  return (
    <Button variant="primary" onClick={() => navigate('/envios/nuevo')}>
      <Plus className="h-4 w-4 mr-1.5" />
      Nuevo envío
    </Button>
  );
};
