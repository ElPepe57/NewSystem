/**
 * Paso 2 · Destino detalles (S52 v7 · S53 F3)
 *
 * CONDICIONAL — solo aparece para tipos E (motivo obligatorio) e I (referencia
 * + tipo relación). Para C y J, useEnvioWizardState auto-salta a Paso 3.
 *
 * Tipo E: MotivoEnvioInterno (consolidación/capacidad/viaje_proximo/costo_menor/otro)
 *         + detalle opcional cuando motivo='otro'
 * Tipo I: Referencia del tercero (obligatoria · FBA-SHIPMENT-XYZ, Consig-001)
 *         + tipo relación (fulfillment/consignacion/distribucion/otro)
 *         + banner rojo de bloqueo de stock
 */
import React from 'react';
import type { UseEnvioWizardStateReturn } from '../useEnvioWizardState';
import type { MotivoEnvioInterno } from '../../../../types/envio.types';
import type { TipoRelacionTercero } from '../envioWizardTypes';

interface Props {
  wizard: UseEnvioWizardStateReturn;
}

const MOTIVOS_E: { value: MotivoEnvioInterno; label: string; icon: string }[] = [
  {
    value: 'consolidacion',
    label: 'Consolidación en un solo almacén',
    icon: '📦',
  },
  {
    value: 'capacidad',
    label: 'Capacidad (el otro almacén está lleno)',
    icon: '🏢',
  },
  { value: 'costo_menor', label: 'Costo de mantenimiento menor', icon: '💰' },
  { value: 'viaje_proximo', label: 'Viaje próximo desde ese almacén', icon: '✈️' },
  { value: 'otro', label: 'Otro', icon: '✏️' },
];

const TIPOS_RELACION: {
  value: TipoRelacionTercero;
  label: string;
  icon: string;
}[] = [
  { value: 'fulfillment', label: 'Fulfillment', icon: '📦' },
  { value: 'consignacion', label: 'Consignación', icon: '🤝' },
  { value: 'distribucion', label: 'Distribución', icon: '🚚' },
  { value: 'otro', label: 'Otro', icon: '✏️' },
];

export const Paso2DestinoDetalles: React.FC<Props> = ({ wizard }) => {
  const { state, dispatch, tipoInferido, tipoConfig, totalUnidades } = wizard;

  if (!tipoConfig) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-600">
        Completá el Paso 1 antes de continuar.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">
          Detalles del destino
        </h3>
        <p className="text-sm text-slate-600">
          {tipoInferido === 'E' &&
            'Indicá el motivo del traslado interno entre tus almacenes.'}
          {tipoInferido === 'I' &&
            'Ingresá la referencia del contrato con el tercero y el tipo de relación comercial.'}
        </p>
      </div>

      {/* Banner informativo sobre la condicionalidad */}
      <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-white border border-sky-200 flex items-center justify-center flex-shrink-0">
          💡
        </div>
        <div className="flex-1 text-xs text-sky-900">
          <div className="font-semibold mb-0.5">
            Este paso es condicional · {tipoConfig.nombre}
          </div>
          <p className="text-sky-800">
            Solo aparece porque el tipo detectado requiere información
            adicional. Para otros tipos (C o J), el wizard salta directo a
            Logística.
          </p>
        </div>
      </div>

      {/* ===== TIPO E — Motivo del traslado ===== */}
      {tipoInferido === 'E' && (
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
              Motivo del traslado <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {MOTIVOS_E.map(m => {
                const selected = state.motivo === m.value;
                return (
                  <label
                    key={m.value}
                    className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition ${
                      selected
                        ? 'border-teal-600 bg-teal-50 ring-[3px] ring-teal-100'
                        : 'border-slate-200 hover:border-teal-500 hover:bg-teal-50/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="motivo-e"
                      checked={selected}
                      onChange={() =>
                        dispatch({ type: 'SET_MOTIVO', motivo: m.value })
                      }
                    />
                    <span className="text-xl">{m.icon}</span>
                    <span className="text-sm text-slate-900">{m.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {state.motivo === 'otro' && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                Detalle del motivo
              </label>
              <input
                type="text"
                value={state.motivoDetalle || ''}
                onChange={e =>
                  dispatch({ type: 'SET_MOTIVO_DETALLE', detalle: e.target.value })
                }
                placeholder="Describí brevemente el motivo..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none"
              />
            </div>
          )}
        </div>
      )}

      {/* ===== TIPO I — Referencia + relación + bloqueo stock ===== */}
      {tipoInferido === 'I' && (
        <div className="space-y-4">
          {/* Banner rojo de bloqueo */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
            <span className="text-xl">🔒</span>
            <div className="flex-1 text-xs">
              <div className="font-semibold text-red-900 mb-0.5">
                Bloqueo de stock al confirmar
              </div>
              <p className="text-red-800">
                Las {totalUnidades} unidades dejarán de aparecer como stock
                vendible hasta regreso o liquidación.
              </p>
            </div>
          </div>

          {/* Tipo de relación */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
              Tipo de relación comercial <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {TIPOS_RELACION.map(tr => {
                const selected = state.tipoRelacion === tr.value;
                return (
                  <button
                    key={tr.value}
                    type="button"
                    onClick={() =>
                      dispatch({ type: 'SET_TIPO_RELACION', relacion: tr.value })
                    }
                    className={`p-3 border-2 rounded-lg text-center transition ${
                      selected
                        ? 'border-teal-600 bg-teal-50 ring-[3px] ring-teal-100'
                        : 'border-slate-200 hover:border-teal-500 hover:bg-teal-50/30'
                    }`}
                  >
                    <div className="text-xl mb-1">{tr.icon}</div>
                    <div
                      className={`text-xs ${
                        selected
                          ? 'font-semibold text-slate-900'
                          : 'text-slate-700'
                      }`}
                    >
                      {tr.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Referencia */}
          <div>
            <label className="text-[11px] font-medium text-slate-700 block mb-1.5">
              Referencia con el tercero <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={state.referenciaTercero || ''}
              onChange={e =>
                dispatch({
                  type: 'SET_REFERENCIA_TERCERO',
                  referencia: e.target.value,
                })
              }
              placeholder="Ej. FBA-SHIPMENT-7XYZ123 o Consig-2026-001"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">
              Identificador del contrato, shipment ID o número de consignación.
              Queda para auditoría.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
