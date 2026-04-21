/**
 * EnvioIStepTercero — Paso 2 del Wizard I (Almacén tercero + referencia).
 *
 * Selecciona la casilla destino tipo='almacen_tercero' (debe existir
 * previamente en Red Logística), captura la referencia con el tercero
 * (FBA-XYZ, Consig-001, etc.) y el tipo de relación comercial.
 */
import React, { useEffect, useMemo } from 'react';
import { Building2, Package } from 'lucide-react';
import { useAlmacenStore } from '../../../store/casillaStore';
import { PAISES_CONFIG } from '../../../types/casilla.types';
import { cn } from '../../../design-system';
import type { EnvioWizardIState, EnvioWizardIAction, TipoRelacionTercero } from './envioWizardITypes';

export interface EnvioIStepTerceroProps {
  state: EnvioWizardIState;
  dispatch: (action: EnvioWizardIAction) => void;
}

const TIPOS_RELACION: Array<{
  id: TipoRelacionTercero;
  emoji: string;
  titulo: string;
  descripcion: string;
}> = [
  {
    id: 'fulfillment',
    emoji: '📦',
    titulo: 'Fulfillment',
    descripcion: 'FBA Amazon, Shopify Fulfillment, 3PL con picking y envío',
  },
  {
    id: 'consignacion',
    emoji: '🤝',
    titulo: 'Consignación',
    descripcion: 'El tercero vende y nos paga tras la venta (no transfiere propiedad)',
  },
  {
    id: 'distribucion',
    emoji: '🚚',
    titulo: 'Distribución',
    descripcion: 'Distribuidor mayorista que revende a retail / detal',
  },
  {
    id: 'otro',
    emoji: '✏️',
    titulo: 'Otro',
    descripcion: 'Relación comercial que no encaja en las anteriores',
  },
];

export const EnvioIStepTercero: React.FC<EnvioIStepTerceroProps> = ({ state, dispatch }) => {
  const casillas = useAlmacenStore((s) => s.casillas);
  const loading = useAlmacenStore((s) => s.casillasLoading);
  const fetchCasillas = useAlmacenStore((s) => s.fetchCasillas);

  useEffect(() => {
    if (casillas.length === 0 && !loading) fetchCasillas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const almacenesTerceros = useMemo(
    () =>
      casillas.filter(
        (c) => c.estado === 'activa' && c.tipo === 'almacen_tercero'
      ),
    [casillas]
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Almacén tercero + referencia comercial
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Elige el tercero destinatario (debe existir como casilla{' '}
          <code className="bg-slate-100 px-1 rounded text-[11px]">almacen_tercero</code> en
          Red Logística) y captura la referencia del contrato o consignación.
        </p>
      </div>

      {/* Selector almacén tercero */}
      {almacenesTerceros.length === 0 ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
          <div className="font-semibold">No hay almacenes tercero configurados</div>
          <div className="mt-1 opacity-90">
            Crea al menos uno en Red Logística como nueva casilla con tipo{' '}
            <strong>almacen_tercero</strong> (ej. "FBA Amazon USA", "Consignatario Lima
            Norte"). Asocia un colaborador de tipo empresa que represente al tercero.
          </div>
        </div>
      ) : (
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
            Almacén tercero destino
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {almacenesTerceros.map((c) => {
              const sel = c.id === state.almacenTerceroDestinoId;
              const cfg = PAISES_CONFIG[c.pais];
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'SET_TERCERO_DESTINO',
                      almacenId: c.id,
                      almacenNombre: c.nombre,
                      pais: c.pais,
                    })
                  }
                  className={cn(
                    'relative rounded-xl p-3 text-left transition-all border',
                    sel
                      ? 'bg-violet-50 border-violet-500 ring-2 ring-violet-100'
                      : 'bg-white border-slate-200 hover:border-violet-300 cursor-pointer'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                        sel ? 'bg-violet-100' : 'bg-slate-100'
                      )}
                    >
                      <Building2 className={cn('w-5 h-5', sel ? 'text-violet-700' : 'text-slate-500')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {c.nombre}
                        </span>
                        <span className="text-[10px]">{cfg?.emoji ?? '🌐'}</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {c.colaboradorNombre}
                      </div>
                      {c.direccion && (
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {c.direccion}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                        <Package className="w-3 h-3" />
                        <span>{c.unidadesActuales ?? 0} unidades allá ahora</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tipo de relación */}
      {state.almacenTerceroDestinoId && (
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
            Tipo de relación comercial
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {TIPOS_RELACION.map((tipo) => {
              const sel = state.tipoRelacion === tipo.id;
              return (
                <button
                  key={tipo.id}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_TIPO_RELACION', tipo: tipo.id })}
                  className={cn(
                    'relative rounded-lg p-2.5 text-left transition-all border',
                    sel
                      ? 'bg-violet-50 border-violet-500 ring-1 ring-violet-100'
                      : 'bg-white border-slate-200 hover:border-violet-300'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xl">{tipo.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className={cn('text-sm font-semibold', sel ? 'text-slate-900' : 'text-slate-700')}>
                        {tipo.titulo}
                      </div>
                      <div className={cn('text-[11px] mt-0.5', sel ? 'text-slate-600' : 'text-slate-500')}>
                        {tipo.descripcion}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Referencia tercero (obligatoria) */}
      {state.almacenTerceroDestinoId && (
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1.5">
            Referencia con el tercero <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={state.referenciaTercero}
            onChange={(e) =>
              dispatch({ type: 'SET_REFERENCIA_TERCERO', referencia: e.target.value })
            }
            placeholder="Ej. FBA-SHIPMENT-XYZ, Consig-2026-001, SHIP-ID-12345"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Identificador del contrato, shipment ID del fulfillment o número de
            consignación. Queda guardado para auditoría y seguimiento.
          </p>
        </div>
      )}
    </div>
  );
};
