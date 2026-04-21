/**
 * EnvioJStepDestino — Paso 2 del Wizard J (Destino).
 *
 * Permite seleccionar la casilla internacional destino. Auto-detecta la
 * variante J1/J2 (mismo colaborador vs. colaboradores distintos) y muestra
 * warning cuando origen y destino están en países distintos (D-9).
 *
 * El selector excluye la casilla origen y cualquier almacén Perú.
 */
import React, { useEffect } from 'react';
import { useAlmacenStore } from '../../../store/casillaStore';
import type { EnvioWizardJState, EnvioWizardJAction } from './envioWizardJTypes';
import { CasillaDestinoColaboradorPicker } from './CasillaDestinoColaboradorPicker';
import { VarianteJIndicator } from './VarianteJIndicator';
import { WarningCambioPaisBanner } from './WarningCambioPaisBanner';

export interface EnvioJStepDestinoProps {
  state: EnvioWizardJState;
  dispatch: (action: EnvioWizardJAction) => void;
}

export const EnvioJStepDestino: React.FC<EnvioJStepDestinoProps> = ({ state, dispatch }) => {
  const casillas = useAlmacenStore((s) => s.casillas);
  const loading = useAlmacenStore((s) => s.casillasLoading);
  const fetchCasillas = useAlmacenStore((s) => s.fetchCasillas);

  useEffect(() => {
    if (casillas.length === 0 && !loading) fetchCasillas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      {/* Título */}
      <div>
        <h3 className="text-base font-semibold text-slate-900">Casilla destino</h3>
        <p className="text-sm text-slate-600 mt-1">
          Elige la casilla destino del envío. D-9: preferimos destinos en el mismo país
          del origen (<strong>{state.casillaOrigenPais}</strong>) — estas aparecen primero.
        </p>
      </div>

      {/* Picker de casilla destino */}
      <CasillaDestinoColaboradorPicker
        casillas={casillas}
        casillaOrigenId={state.casillaOrigenId}
        origenPais={state.casillaOrigenPais}
        value={state.casillaDestinoId}
        onChange={(c) =>
          dispatch({
            type: 'SET_DESTINO',
            casillaId: c.id,
            casillaNombre: c.nombre,
            pais: c.pais,
            colaboradorId: c.colaboradorId,
            colaboradorNombre: c.colaboradorNombre,
          })
        }
      />

      {/* Indicador de variante J1/J2 y warning cambio país cuando hay destino */}
      {state.casillaDestinoId && (
        <div className="space-y-3">
          <VarianteJIndicator
            variante={state.variante}
            colaboradorOrigenNombre={state.colaboradorOrigenNombre || 'Origen'}
            colaboradorDestinoNombre={state.colaboradorDestinoNombre || 'Destino'}
          />
          {state.advertenciaCambioPais && (
            <WarningCambioPaisBanner
              origenPais={state.casillaOrigenPais}
              destinoPais={state.casillaDestinoPais}
              colaboradorDestinoNombre={state.colaboradorDestinoNombre}
            />
          )}
        </div>
      )}
    </div>
  );
};
