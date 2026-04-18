import React, { useMemo } from 'react';
import { MapPin, Package, DollarSign, Users } from 'lucide-react';
import { RouteVisual } from '../../../design-system';
import type { EnvioWizardState } from './envioWizardTypes';
import type { Producto } from '../../../types/producto.types';

interface EnvioWizardPreviewProps {
  state: EnvioWizardState;
  productosMap: Map<string, Producto>;
}

/**
 * EnvioWizardPreview — Panel lateral del EnvioWizardV2.
 * Resumen en vivo del estado del envío mientras se completa el wizard.
 */
export const EnvioWizardPreview: React.FC<EnvioWizardPreviewProps> = ({ state }) => {
  const unidadesSelec = state.unidadesIdsSeleccionadas.length;
  const productosUnicos = new Set(
    state.unidadesDisponibles
      .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
      .map((u) => u.productoId)
  ).size;
  const costoTotal = useMemo(
    () =>
      state.unidadesDisponibles
        .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
        .reduce((s, u) => s + (u.costoUnitarioUSD || 0), 0),
    [state.unidadesDisponibles, state.unidadesIdsSeleccionadas]
  );

  const tieneRuta = !!state.tipoRuta && !!state.origenCasillaId && !!state.destinoCasillaId;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Resumen en vivo
        </div>
        <div className="text-xs text-slate-400">Se actualiza mientras completas el wizard</div>
      </div>

      {/* Ruta */}
      <Section icon={<MapPin className="w-4 h-4" />} title="Ruta" isEmpty={!tieneRuta}>
        {tieneRuta ? (
          <div className="space-y-2">
            <RouteVisual
              size="sm"
              nodes={[
                {
                  tipo: 'casilla',
                  codigo: state.origenCasillaId,
                  nombre: state.origenCasillaNombre.split(' ')[0] || 'Origen',
                  state: 'done',
                },
                {
                  tipo: state.tipoRuta === 'casilla_peru' ? 'destino' : 'casilla',
                  flag: state.tipoRuta === 'casilla_peru' ? '🇵🇪' : undefined,
                  codigo:
                    state.tipoRuta === 'casilla_casilla' ? state.destinoCasillaId : undefined,
                  nombre: state.destinoCasillaNombre.split(' ')[0] || 'Destino',
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
            {state.colaboradorNombre && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Users className="w-3 h-3 text-slate-400" />
                <span className="truncate">{state.colaboradorNombre}</span>
              </div>
            )}
          </div>
        ) : (
          <EmptyHint text="Selecciona tipo, origen y destino" />
        )}
      </Section>

      {/* Contenido */}
      <Section
        icon={<Package className="w-4 h-4" />}
        title="Contenido"
        isEmpty={unidadesSelec === 0}
      >
        {unidadesSelec > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Unidades</span>
              <span className="font-medium text-slate-800 tabular-nums">{unidadesSelec}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Productos</span>
              <span className="font-medium text-slate-800 tabular-nums">{productosUnicos}</span>
            </div>
          </div>
        ) : (
          <EmptyHint text="Selecciona unidades del origen" />
        )}
      </Section>

      {/* Costo mercancía */}
      {costoTotal > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-semibold text-teal-900 uppercase tracking-wide">
                Valor mercancía
              </span>
            </div>
            <span className="text-xl font-bold text-teal-900 tabular-nums">
              ${costoTotal.toFixed(2)}
            </span>
          </div>
          <div className="text-[10px] text-teal-700 mt-1">
            Los costos logísticos (flete/aduana) se registran al recibir en Perú
          </div>
        </div>
      )}

      {/* Tracking */}
      {(state.numeroTracking || state.courier) && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs space-y-1">
          {state.courier && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Courier</span>
              <span className="font-medium">{state.courier}</span>
            </div>
          )}
          {state.numeroTracking && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Tracking</span>
              <span className="font-mono text-teal-700 truncate max-w-[10rem]">
                {state.numeroTracking}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Internal
// ════════════════════════════════════════════════════════════════════════════

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  isEmpty?: boolean;
  children: React.ReactNode;
}> = ({ icon, title, isEmpty, children }) => (
  <div
    className={`bg-white rounded-xl border p-3 ${
      isEmpty ? 'border-dashed border-slate-200' : 'border-slate-200'
    }`}
  >
    <div className="flex items-center gap-2 mb-2">
      <div className={`${isEmpty ? 'text-slate-300' : 'text-slate-500'}`}>{icon}</div>
      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{title}</div>
    </div>
    {children}
  </div>
);

const EmptyHint: React.FC<{ text: string }> = ({ text }) => (
  <div className="text-xs text-slate-400 italic">{text}</div>
);
