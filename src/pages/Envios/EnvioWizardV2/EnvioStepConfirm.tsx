import React from 'react';
import { MapPin, Package, Info, CheckCircle } from 'lucide-react';
import { RouteVisual } from '../../../design-system';
import type { EnvioWizardState, EnvioWizardAction } from './envioWizardTypes';

interface EnvioStepConfirmProps {
  state: EnvioWizardState;
  dispatch: React.Dispatch<EnvioWizardAction>;
}

/**
 * EnvioStepConfirm — Paso 3 del EnvioWizardV2.
 *
 * Resumen + captura opcional de:
 * - Tracking (opcional para viajeros, recomendado para couriers)
 * - Courier (opcional)
 * - Notas del despacho
 *
 * NO captura fechas de salida/llegada (ESPEC §3.2 — no se piden al crear).
 */
export const EnvioStepConfirm: React.FC<EnvioStepConfirmProps> = ({ state, dispatch }) => {
  const unidadesCount = state.unidadesIdsSeleccionadas.length;
  const costoTotal = state.unidadesDisponibles
    .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
    .reduce((s, u) => s + (u.costoUnitarioUSD || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-slate-900">Revisar y crear envío</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Verifica los datos del envío. Puedes agregar tracking y notas opcionales antes de
          crearlo.
        </p>
      </div>

      {/* Ruta */}
      <Section icon={<MapPin className="w-4 h-4" />} title="Ruta">
        <RouteVisual
          size="md"
          nodes={[
            {
              tipo: 'casilla',
              codigo: state.origenCasillaId,
              nombre: state.origenCasillaNombre.split(' ')[0] || 'Origen',
              subtexto: state.origenCasillaNombre,
              state: 'done',
            },
            {
              tipo: state.tipoRuta === 'casilla_peru' ? 'destino' : 'casilla',
              flag: state.tipoRuta === 'casilla_peru' ? '🇵🇪' : undefined,
              codigo: state.tipoRuta === 'casilla_casilla' ? state.destinoCasillaId : undefined,
              nombre: state.destinoCasillaNombre.split(' ')[0] || 'Destino',
              subtexto: state.destinoCasillaNombre,
              state: 'done',
            },
          ]}
          segments={[
            {
              label: state.colaboradorNombre || 'Sin asignar',
              state: state.colaboradorId ? 'done' : 'pending',
            },
          ]}
        />
      </Section>

      {/* Contenido */}
      <Section icon={<Package className="w-4 h-4" />} title="Contenido del envío">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{unidadesCount}</div>
            <div className="text-xs text-slate-500 mt-0.5">Unidades</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              {
                new Set(
                  state.unidadesDisponibles
                    .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
                    .map((u) => u.productoId)
                ).size
              }
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Productos</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-teal-700 tabular-nums">
              ${costoTotal.toFixed(2)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Costo mercancía</div>
          </div>
        </div>
      </Section>

      {/* Tracking y courier (opcionales) */}
      <Section icon={<Info className="w-4 h-4" />} title="Información de tracking (opcional)">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Número de tracking
            </label>
            <input
              type="text"
              value={state.numeroTracking}
              onChange={(e) =>
                dispatch({ type: 'SET_TRACKING', tracking: e.target.value })
              }
              placeholder="Ej: 1Z999AA10123456784 (si aplica)"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-100"
            />
            <div className="text-[10px] text-slate-400 mt-1">
              Los viajeros no siempre tienen tracking — puedes dejarlo vacío.
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Courier / transportista
            </label>
            <input
              type="text"
              value={state.courier}
              onChange={(e) => dispatch({ type: 'SET_COURIER', courier: e.target.value })}
              placeholder="DHL, FedEx, Serpost, personal, etc."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Notas del envío <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={state.notas}
              onChange={(e) => dispatch({ type: 'SET_NOTAS', notas: e.target.value })}
              rows={2}
              placeholder="Observaciones, instrucciones especiales, etc."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-100"
            />
          </div>
        </div>
      </Section>

      {/* Aviso importante */}
      <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-200">
        <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
        <div>
          Este envío nacerá en estado <strong>Borrador</strong>. No se piden fechas de
          salida/llegada al crear — se registrarán al momento del despacho efectivo desde la
          vista Envíos.
        </div>
      </div>

      {/* Confirmación */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span className="text-sm text-emerald-900">
          Listo para crear. Haz click en <strong>Crear Envío</strong>.
        </span>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Internal
// ════════════════════════════════════════════════════════════════════════════

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4">
    <div className="flex items-center gap-2 mb-3">
      <div className="text-slate-500">{icon}</div>
      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{title}</div>
    </div>
    {children}
  </div>
);
