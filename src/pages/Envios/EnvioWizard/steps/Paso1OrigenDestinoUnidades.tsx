/**
 * Paso 1 · Origen + Destino + Unidades (placeholder F1)
 *
 * Implementación completa en F2 (S53).
 */
import React from 'react';
import type { UseEnvioWizardStateReturn } from '../useEnvioWizardState';

interface Props {
  wizard: UseEnvioWizardStateReturn;
}

export const Paso1OrigenDestinoUnidades: React.FC<Props> = ({ wizard }) => {
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

      {/* Placeholder temporal para validar el shell en F1 */}
      <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl p-6 text-center">
        <div className="text-3xl mb-2">🚧</div>
        <div className="text-sm font-semibold text-amber-900 mb-1">
          Paso 1 se implementa en F2
        </div>
        <p className="text-xs text-amber-700">
          Aquí irán las 3 secciones numeradas colapsables estilo OC (Origen /
          Destino / Unidades) con buscador y cards apiladas.
        </p>
      </div>

      {/* Controles temporales de testing para validar inferencia + sidebar en F1 */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Testing F1 · selectores simplificados
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <label className="text-xs text-slate-600 block mb-1">
              Origen categoría
            </label>
            <select
              value={wizard.state.origenCategoria || ''}
              onChange={e =>
                wizard.dispatch({
                  type: 'SET_ORIGEN_CATEGORIA',
                  categoria: (e.target.value || null) as any,
                })
              }
              className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
            >
              <option value="">— Elegir —</option>
              <option value="casilla_intl">Casilla internacional</option>
              <option value="almacen_peru">Almacén Perú</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600 block mb-1">
              Destino categoría
            </label>
            <select
              value={wizard.state.destinoCategoria || ''}
              onChange={e =>
                wizard.dispatch({
                  type: 'SET_DESTINO_CATEGORIA',
                  categoria: (e.target.value || null) as any,
                })
              }
              className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
            >
              <option value="">— Elegir —</option>
              <option value="casilla_intl">Casilla internacional</option>
              <option value="almacen_peru">Almacén Perú</option>
              <option value="almacen_tercero">Almacén tercero</option>
            </select>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-600">
          <span className="font-semibold">Tipo inferido:</span>{' '}
          {wizard.tipoInferido ? (
            <span className="font-mono bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded">
              {wizard.tipoInferido}
            </span>
          ) : (
            <span className="italic text-slate-400">(ninguno)</span>
          )}
        </div>
      </div>
    </div>
  );
};
