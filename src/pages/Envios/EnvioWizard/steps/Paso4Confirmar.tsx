/**
 * Paso 4 · Confirmar (S52 v7 · S53 F4)
 *
 * Resumen final del envío antes de crear:
 *   - Header con tipo detectado (chip teal/sky/amber/violet según tipo)
 *   - Ruta visual origen → tránsito → destino
 *   - KPIs consolidados
 *   - Bloque "Al confirmar se creará" con efectos esperados
 *   - Campo notas
 *   - Gran total con USD y PEN
 *
 * El botón "Crear envío" del shell dispara handleConfirm() que invoca
 * envioUnificadoService.crear() → método legacy correspondiente.
 */
import React from 'react';
import type { UseEnvioWizardStateReturn } from '../useEnvioWizardState';

interface Props {
  wizard: UseEnvioWizardStateReturn;
}

function paisEmoji(pais: string): string {
  const MAP: Record<string, string> = {
    USA: '🇺🇸',
    China: '🇨🇳',
    Corea: '🇰🇷',
    Peru: '🇵🇪',
    Peru_local: '🇵🇪',
  };
  return MAP[pais] || '🌎';
}

export const Paso4Confirmar: React.FC<Props> = ({ wizard }) => {
  const {
    state,
    dispatch,
    tipoInferido,
    tipoConfig,
    totalUnidades,
    totalSKUs,
    totalPrevendidas,
    totalFleteUSD,
  } = wizard;

  if (!tipoConfig || !tipoInferido) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-600">
        Completá los pasos anteriores para ver el resumen.
      </div>
    );
  }

  const modoLabel =
    state.modoTransporte === 'aereo'
      ? 'Aéreo'
      : state.modoTransporte === 'maritimo'
      ? 'Marítimo'
      : 'Terrestre';
  const modoIcon =
    state.modoTransporte === 'aereo'
      ? '✈️'
      : state.modoTransporte === 'maritimo'
      ? '🚢'
      : '🚚';

  const transportadorLabel =
    state.tipoTransportador === 'viajero'
      ? 'viajero'
      : state.tipoTransportador === 'courier_internacional'
      ? 'courier'
      : 'transportista';

  return (
    <div className="space-y-5">
      {/* Header con tipo detectado */}
      <div
        className={`border-2 rounded-xl p-4 ${tipoConfig.chipColor.bg} ${tipoConfig.chipColor.border}`}
      >
        <div
          className={`text-xs font-semibold uppercase tracking-wider mb-0.5 ${tipoConfig.chipColor.textUpper}`}
        >
          Tipo de envío
        </div>
        <h3 className={`text-lg font-bold ${tipoConfig.chipColor.textMain}`}>
          {tipoConfig.nombre} · {tipoConfig.subtitulo}
        </h3>
        <p className={`text-xs mt-1 ${tipoConfig.chipColor.textSub}`}>
          {state.ubicacionOrigenNombre}
          {' → '}
          {state.ubicacionDestinoNombre}
        </p>
      </div>

      {/* Ruta visual origen → tránsito → destino */}
      <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-4 justify-between">
          <div className="text-center">
            <div className="w-14 h-14 bg-sky-100 rounded-xl flex items-center justify-center text-3xl mb-2">
              {paisEmoji(state.ubicacionOrigenPais)}
            </div>
            <div className="text-sm font-semibold text-slate-900">
              {state.ubicacionOrigenNombre}
            </div>
            <div className="text-[11px] text-slate-500">
              {state.ubicacionOrigenPais}
            </div>
          </div>
          <div className="flex-1 text-center min-w-0">
            <div className="flex-1 h-px bg-slate-300 mb-1" />
            {state.colaboradorTransporteId ? (
              <div className="text-xs text-slate-600 font-medium flex items-center justify-center gap-1 truncate">
                <span>{modoIcon}</span>
                <span className="truncate">
                  {state.colaboradorTransporteNombre} ({transportadorLabel})
                </span>
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">
                Sin transportador asignado
              </div>
            )}
            <div className="flex-1 h-px bg-slate-300 mt-1" />
          </div>
          <div className="text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center text-3xl mb-2">
              {state.destinoCategoria === 'almacen_tercero'
                ? '🏭'
                : paisEmoji(state.ubicacionDestinoPais)}
            </div>
            <div className="text-sm font-semibold text-slate-900">
              {state.ubicacionDestinoNombre}
            </div>
            <div className="text-[11px] text-slate-500">
              {state.ubicacionDestinoPais}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs consolidados */}
      <div className="grid grid-cols-2 md:grid-cols-4 bg-slate-50 rounded-xl py-4 px-2">
        <div className="px-2 py-1 text-center">
          <div className="text-xs text-slate-500 mb-1">Contenido</div>
          <div className="text-xl font-bold text-slate-900 tabular-nums">
            {totalUnidades}
          </div>
          <div className="text-[11px] text-slate-400">
            uds · {totalSKUs} productos
          </div>
        </div>
        <div className="px-2 py-1 text-center">
          <div className="text-xs text-slate-500 mb-1">Pre-vendidas</div>
          <div className="text-xl font-bold text-emerald-700 tabular-nums">
            {totalPrevendidas}
          </div>
          <div className="text-[11px] text-slate-400">
            {totalPrevendidas === 0 ? 'ninguna' : 'con adelanto'}
          </div>
        </div>
        <div className="px-2 py-1 text-center">
          <div className="text-xs text-slate-500 mb-1">Modo transporte</div>
          <div className="text-xl font-bold text-slate-900 tabular-nums">
            {modoIcon}
          </div>
          <div className="text-[11px] text-slate-400">{modoLabel}</div>
        </div>
        <div className="px-2 py-1 text-center">
          <div className="text-xs text-slate-500 mb-1">Flete</div>
          <div className="text-xl font-bold text-teal-700 tabular-nums">
            ${totalFleteUSD.toFixed(0)}
          </div>
          <div className="text-[11px] text-slate-400">
            {tipoConfig.moneda === 'PEN'
              ? 'PEN'
              : state.tipoCambio > 0
              ? `S/ ${(totalFleteUSD * state.tipoCambio).toFixed(0)}`
              : 'USD'}
          </div>
        </div>
      </div>

      {/* Bloque "Al confirmar se creará" */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span>✨</span>
          <div className="text-sm font-semibold text-sky-900">
            Al confirmar se creará:
          </div>
        </div>
        <ul className="text-xs text-sky-800 space-y-1.5 pl-6 list-disc">
          <li>
            Envío en estado <code className="bg-white px-1 rounded">borrador</code>
            {' · editable hasta despachar'}
          </li>
          <li>
            {totalUnidades} unidades pasarán de{' '}
            <code className="bg-white px-1 rounded">disponible</code> a{' '}
            <code className="bg-white px-1 rounded">asignada_envio</code>
          </li>
          {state.colaboradorTransporteId && totalFleteUSD > 0 && (
            <li>
              CxP al {transportadorLabel} {state.colaboradorTransporteNombre} por{' '}
              <b>
                ${totalFleteUSD.toFixed(2)}{' '}
                {tipoConfig.moneda === 'PEN' ? 'PEN' : 'USD'}
              </b>
              {tipoConfig.moneda !== 'PEN' && state.tipoCambio > 0 && (
                <span>
                  {' '}
                  (S/ {(totalFleteUSD * state.tipoCambio).toFixed(2)} al TC{' '}
                  {state.tipoCambio.toFixed(3)})
                </span>
              )}
            </li>
          )}
          <li>
            Al despachar: unidades pasan a{' '}
            <code className="bg-white px-1 rounded">en_transito</code>
          </li>
          <li>
            Al recibir: CTRU landed se aplica prorrateado por unidad
          </li>
          {tipoConfig.bloqueaStock && (
            <li className="text-red-700 font-semibold">
              🔒 Stock bloqueado hasta retorno o liquidación (tipo I)
            </li>
          )}
          {state.advertenciaCambioPais && (
            <li className="text-amber-700">
              ⚠️ Cambio de país auditado (origen: {state.ubicacionOrigenPais} →
              destino: {state.ubicacionDestinoPais})
            </li>
          )}
          {tipoInferido === 'E' && state.motivo && (
            <li>
              Motivo del traslado: <b>{state.motivo}</b>
              {state.motivo === 'otro' && state.motivoDetalle && (
                <span> — {state.motivoDetalle}</span>
              )}
            </li>
          )}
          {tipoInferido === 'I' && state.referenciaTercero && (
            <li>
              Referencia:{' '}
              <code className="bg-white px-1 rounded font-mono">
                {state.referenciaTercero}
              </code>
              {state.tipoRelacion && (
                <span>
                  {' '}· Relación: <b>{state.tipoRelacion}</b>
                </span>
              )}
            </li>
          )}
        </ul>
      </div>

      {/* Notas */}
      <div>
        <label className="text-xs font-medium text-slate-700 block mb-1.5">
          Notas internas (opcional)
        </label>
        <textarea
          rows={2}
          value={state.notas}
          onChange={e => dispatch({ type: 'SET_NOTAS', notas: e.target.value })}
          placeholder="Ej. Prioridad alta, empacar con cuidado..."
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none"
        />
      </div>

      {/* Gran total */}
      <div
        className={`border-2 rounded-xl p-4 ${tipoConfig.chipColor.bg} ${tipoConfig.chipColor.border}`}
      >
        <div
          className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${tipoConfig.chipColor.textUpper}`}
        >
          Gran total del envío
        </div>
        <div className={`text-3xl font-bold tabular-nums ${tipoConfig.chipColor.textMain}`}>
          ${totalFleteUSD.toFixed(2)}
        </div>
        <div className={`text-sm mt-1 ${tipoConfig.chipColor.textSub}`}>
          {tipoConfig.moneda === 'PEN' ? 'PEN' : 'USD'}
          {tipoConfig.moneda !== 'PEN' && state.tipoCambio > 0 && (
            <span className="tabular-nums">
              {' · '}S/ {(totalFleteUSD * state.tipoCambio).toFixed(2)} PEN
            </span>
          )}
        </div>
      </div>

      {/* Error del submit si aplica */}
      {state.estadoSubmit === 'error' && state.errorSubmit && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
          <span className="text-xl">❌</span>
          <div className="text-xs">
            <div className="font-semibold text-red-900">
              Error al crear el envío
            </div>
            <p className="text-red-800 mt-0.5">{state.errorSubmit}</p>
          </div>
        </div>
      )}
    </div>
  );
};
