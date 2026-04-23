/**
 * Paso 1 · Origen + Destino + Unidades (S52 v7 · S53 F2)
 *
 * 3 secciones numeradas colapsables estilo OCWizardV3 (D-8):
 *   [1] ¿De dónde salen las unidades?  — categoría origen + ubicación específica
 *   [2] ¿A dónde llegan las unidades?  — categoría destino + ubicación específica
 *   [3] ¿Qué unidades envías?          — buscador + picker con stepper
 *
 * Comportamiento:
 *   - Al entrar, [1] expandida, [2] y [3] disabled/gated.
 *   - Al seleccionar ubicación en [1], se colapsa automáticamente y [2] se habilita + expande.
 *   - Al seleccionar ubicación en [2], [2] se colapsa y [3] se habilita + expande.
 *   - Click en "Cambiar" de [1] o [2] re-expande esa sección.
 *   - Si se elige una combinación no válida (matriz de inferencia), banner admin.
 */
import React, { useState, useEffect } from 'react';
import type { UseEnvioWizardStateReturn } from '../useEnvioWizardState';
import { COMBINACIONES_VALIDAS } from '../useTipoInferido';
import { SeccionOrigen } from './paso1/SeccionOrigen';
import { SeccionDestino } from './paso1/SeccionDestino';
import { SeccionUnidades } from './paso1/SeccionUnidades';

interface Props {
  wizard: UseEnvioWizardStateReturn;
}

export const Paso1OrigenDestinoUnidades: React.FC<Props> = ({ wizard }) => {
  const { state } = wizard;

  // Estados locales de colapso por sección
  const [origenCollapsed, setOrigenCollapsed] = useState(false);
  const [destinoCollapsed, setDestinoCollapsed] = useState(false);

  // Auto-colapsar al tener ubicación seleccionada (al entrar con selección previa)
  useEffect(() => {
    if (state.ubicacionOrigenId && !origenCollapsed) {
      setOrigenCollapsed(true);
    }
  }, [state.ubicacionOrigenId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.ubicacionDestinoId && !destinoCollapsed) {
      setDestinoCollapsed(true);
    }
  }, [state.ubicacionDestinoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const origenCompleto = !!state.ubicacionOrigenId;
  const destinoCompleto = !!state.ubicacionDestinoId;
  const ambosCompletos = origenCompleto && destinoCompleto;

  // Detectar combinación inválida (ambas categorías elegidas pero no hay tipo inferido)
  const combinacionInvalida =
    !!state.origenCategoria && !!state.destinoCategoria && !wizard.tipoInferido;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">
          ¿Desde dónde y hacia dónde?
        </h3>
        <p className="text-sm text-slate-600">
          Elegí las ubicaciones. La ruta del envío se va armando en el panel
          derecho conforme avanzás.
        </p>
      </div>

      <div className="space-y-5">
        <SeccionOrigen
          wizard={wizard}
          collapsed={origenCollapsed}
          onToggle={() => setOrigenCollapsed(!origenCollapsed)}
        />

        <SeccionDestino
          wizard={wizard}
          collapsed={destinoCollapsed}
          onToggle={() => setDestinoCollapsed(!destinoCollapsed)}
          disabled={!origenCompleto}
        />

        {/* Banner combinación inválida (D-B) */}
        {combinacionInvalida && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-amber-200 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">⚠️</span>
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-0.5">
                  Combinación no estándar
                </div>
                <div className="text-sm font-bold text-amber-900">
                  Este tipo de movimiento requiere coordinación con el
                  administrador
                </div>
                <p className="text-xs text-amber-800 mt-1">
                  Contactá al admin para habilitar este caso específico.
                </p>
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <div className="text-xs text-amber-700 font-semibold mb-1.5">
                    Combinaciones disponibles:
                  </div>
                  <ul className="text-xs text-amber-800 space-y-1">
                    {COMBINACIONES_VALIDAS.map(c => (
                      <li key={c}>• {c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <SeccionUnidades wizard={wizard} disabled={!ambosCompletos} />
      </div>
    </div>
  );
};
