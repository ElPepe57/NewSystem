/**
 * Paso 3 · Logística (S52 v7 · S53 F3)
 *
 * Transportador + tracking + costos del envío con 4 modalidades:
 *   1. Flete total          — monto global fijo
 *   2. Tarifa por unidad    — $ × uds
 *   3. Por producto         — tabla con un costo por SKU (D-9)
 *   4. Por tramos de peso   — escalonada en lb, auto-carga del viajero (D-11)
 *
 * Features:
 *   - TCChip read-only desde sección TC del sistema (D-10)
 *   - Recordatorio "Cierre operativo ≠ Cierre financiero"
 *   - Auto-carga tramosPeso del colaborador seleccionado
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useColaboradorStore } from '../../../../store/colaboradorStore';
import { TCChip } from '../shared/TCChip';
import { TablaCalculoTramos } from '../shared/TablaCalculoTramos';
import { TramosPesoSection } from '../../../RedLogistica/shared/TramosPesoSection';
import type { UseEnvioWizardStateReturn } from '../useEnvioWizardState';
import type {
  ModalidadCosto,
  TipoTransportador,
  ModoTransporte,
} from '../envioWizardTypes';

interface Props {
  wizard: UseEnvioWizardStateReturn;
}

const MODALIDADES: {
  value: ModalidadCosto;
  label: string;
  descripcion: string;
  nuevo?: boolean;
}[] = [
  {
    value: 'flete_total',
    label: 'Flete total',
    descripcion: '"Pagué $X total"',
  },
  {
    value: 'tarifa_unidad',
    label: 'Tarifa por unidad',
    descripcion: '"$X por cada unidad"',
  },
  {
    value: 'por_producto',
    label: 'Por producto',
    descripcion: 'Costo distinto por SKU',
  },
  {
    value: 'por_tramos',
    label: 'Por tramos de peso',
    descripcion: 'Tarifa escalonada en lb',
    nuevo: true,
  },
];

const MODOS_TRANSPORTE: {
  value: ModoTransporte;
  label: string;
  icon: string;
}[] = [
  { value: 'aereo', label: 'Aéreo', icon: '✈️' },
  { value: 'maritimo', label: 'Marítimo', icon: '🚢' },
  { value: 'terrestre', label: 'Terrestre', icon: '🚚' },
];

export const Paso3Logistica: React.FC<Props> = ({ wizard }) => {
  const { state, dispatch, tipoConfig, totalFleteUSD, totalUnidades } = wizard;
  const { colaboradores, fetchColaboradores } = useColaboradorStore();
  const [busquedaColab, setBusquedaColab] = useState('');

  useEffect(() => {
    if (colaboradores.length === 0) fetchColaboradores();
  }, [colaboradores.length, fetchColaboradores]);

  // Colaboradores permitidos según el tipo inferido
  const tiposPermitidos = tipoConfig?.transportadoresPermitidos || [];
  const colaboradoresFiltrados = useMemo(() => {
    // Map de nuestros tipos a los tipos del Colaborador legacy
    const mapTipo = (t: TipoTransportador): 'viajero' | 'courier_externo' | 'transportista_local' =>
      t === 'viajero'
        ? 'viajero'
        : t === 'courier_internacional'
        ? 'courier_externo'
        : 'transportista_local';
    const tiposColab = tiposPermitidos.map(mapTipo);
    let lista = colaboradores.filter(
      c => c.estado === 'activo' && tiposColab.includes(c.tipo as any)
    );
    if (state.tipoTransportador) {
      const tipoColabActual = mapTipo(state.tipoTransportador);
      lista = lista.filter(c => c.tipo === tipoColabActual);
    }
    if (busquedaColab.trim()) {
      const q = busquedaColab.toLowerCase();
      lista = lista.filter(
        c =>
          c.nombre.toLowerCase().includes(q) ||
          c.pais.toLowerCase().includes(q) ||
          c.ciudad?.toLowerCase().includes(q)
      );
    }
    return lista;
  }, [colaboradores, tiposPermitidos, state.tipoTransportador, busquedaColab]);

  const handleSeleccionarColab = (colabId: string) => {
    const colab = colaboradores.find(c => c.id === colabId);
    if (!colab) return;
    dispatch({
      type: 'SET_COLABORADOR_TRANSPORTE',
      id: colab.id,
      nombre: colab.nombre,
      tramosPreset: colab.tarifas?.tarifaPorTramos,
    });
  };

  const showTCChip = tipoConfig?.moneda === 'USD' || tipoConfig?.moneda === 'MIXTA';

  return (
    <div className="space-y-5">
      {/* Banner: costos pueden registrarse antes/durante/después */}
      <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-white border border-sky-200 flex items-center justify-center flex-shrink-0">
          ⏱️
        </div>
        <div className="flex-1 text-xs text-sky-900">
          <div className="font-semibold mb-0.5">
            Los costos pueden registrarse antes, durante o después
          </div>
          <p className="text-sky-800">
            El viajero o courier puede facturar después. Podés avanzar y
            completar al recibir.
          </p>
        </div>
      </div>

      {/* ===== Tipo de transportador ===== */}
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-3">
          Transportador
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          {tiposPermitidos.includes('viajero') && (
            <button
              type="button"
              onClick={() =>
                dispatch({ type: 'SET_TIPO_TRANSPORTADOR', tipo: 'viajero' })
              }
              className={`p-3 border-2 rounded-lg text-left transition ${
                state.tipoTransportador === 'viajero'
                  ? 'border-teal-600 bg-teal-50 ring-[3px] ring-teal-100'
                  : 'border-slate-200 hover:border-teal-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0 text-xl">
                  ✈️
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Viajero personal
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Persona con equipaje
                  </p>
                </div>
              </div>
            </button>
          )}
          {tiposPermitidos.includes('courier_internacional') && (
            <button
              type="button"
              onClick={() =>
                dispatch({
                  type: 'SET_TIPO_TRANSPORTADOR',
                  tipo: 'courier_internacional',
                })
              }
              className={`p-3 border-2 rounded-lg text-left transition ${
                state.tipoTransportador === 'courier_internacional'
                  ? 'border-teal-600 bg-teal-50 ring-[3px] ring-teal-100'
                  : 'border-slate-200 hover:border-teal-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 text-xl">
                  📦
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-700">
                    Courier internacional
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    DHL, FedEx, UPS, etc.
                  </p>
                </div>
              </div>
            </button>
          )}
          {tiposPermitidos.includes('transportista_local') && (
            <button
              type="button"
              onClick={() =>
                dispatch({
                  type: 'SET_TIPO_TRANSPORTADOR',
                  tipo: 'transportista_local',
                })
              }
              className={`p-3 border-2 rounded-lg text-left transition ${
                state.tipoTransportador === 'transportista_local'
                  ? 'border-teal-600 bg-teal-50 ring-[3px] ring-teal-100'
                  : 'border-slate-200 hover:border-teal-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 text-xl">
                  🚚
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-700">
                    Transportista local
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Delivery en Perú
                  </p>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Picker de colaborador específico */}
        {state.tipoTransportador && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
              Colaborador específico
            </label>
            <div className="relative mb-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                value={busquedaColab}
                onChange={e => setBusquedaColab(e.target.value)}
                placeholder="Buscar colaborador por nombre..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none"
              />
            </div>
            {colaboradoresFiltrados.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 text-center">
                <p className="text-xs text-slate-600">
                  Sin colaboradores disponibles para este tipo.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {colaboradoresFiltrados.map(c => {
                  const selected = c.id === state.colaboradorTransporteId;
                  const tieneTramos =
                    (c.tarifas?.tarifaPorTramos?.length ?? 0) > 0;
                  const iniciales = c.nombre
                    .split(' ')
                    .slice(0, 2)
                    .map(w => w[0])
                    .join('')
                    .toUpperCase();
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSeleccionarColab(c.id)}
                      className={`bg-white border-2 rounded-lg p-3 flex items-center justify-between cursor-pointer transition ${
                        selected
                          ? 'border-teal-600 bg-teal-50 ring-[3px] ring-teal-100'
                          : 'border-slate-200 hover:border-teal-500'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          {iniciales || '?'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {c.nombre}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {c.pais}
                            {c.ciudad && ` · ${c.ciudad}`}
                            {c.metricas?.enviosRealizados !== undefined &&
                              ` · ${c.metricas.enviosRealizados} envíos`}
                          </div>
                        </div>
                      </div>
                      {tieneTramos && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded whitespace-nowrap flex-shrink-0"
                          title="Tiene tarifa por tramos preset"
                        >
                          ⚖️ Tramos
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modo de transporte (afecta icono del sidebar) */}
      {state.tipoTransportador && (
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
            Modo de transporte
          </label>
          <div className="grid grid-cols-3 gap-2">
            {MODOS_TRANSPORTE.map(m => {
              const selected = state.modoTransporte === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() =>
                    dispatch({ type: 'SET_MODO_TRANSPORTE', modo: m.value })
                  }
                  className={`p-2 border-2 rounded-lg text-center transition ${
                    selected
                      ? 'border-teal-600 bg-teal-50 ring-[3px] ring-teal-100'
                      : 'border-slate-200 hover:border-teal-500'
                  }`}
                >
                  <div className="text-xl mb-0.5">{m.icon}</div>
                  <div
                    className={`text-xs ${
                      selected ? 'font-semibold text-slate-900' : 'text-slate-700'
                    }`}
                  >
                    {m.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Número de tracking */}
      <div>
        <label className="text-xs font-medium text-slate-700 block mb-1.5">
          Número de tracking (opcional)
        </label>
        <input
          type="text"
          value={state.numeroTracking}
          onChange={e => dispatch({ type: 'SET_TRACKING', tracking: e.target.value })}
          placeholder="DHL1234567 o #vuelo AA2421"
          className="w-full sm:max-w-md px-3 py-2 text-sm border border-slate-300 rounded-lg"
        />
      </div>

      {/* ===== Costos del envío (4 modalidades) ===== */}
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-3">
          Costos del envío ({tipoConfig?.moneda === 'PEN' ? 'PEN' : 'USD'})
        </h3>

        {/* Selector de modalidad */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {MODALIDADES.map(m => {
            const selected = state.modalidadCosto === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() =>
                  dispatch({ type: 'SET_MODALIDAD_COSTO', modalidad: m.value })
                }
                className={`p-3 border-2 rounded-lg text-center transition relative ${
                  selected
                    ? 'border-teal-600 bg-teal-50 ring-[3px] ring-teal-100'
                    : 'border-slate-200 hover:border-teal-500'
                }`}
              >
                {m.nuevo && (
                  <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                    ⭐ D-11
                  </span>
                )}
                <div
                  className={`text-xs ${
                    selected ? 'font-semibold text-slate-900' : 'text-slate-700'
                  } mb-0.5`}
                >
                  {m.label}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {m.descripcion}
                </p>
              </button>
            );
          })}
        </div>

        {/* Contenido de la modalidad activa */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          {/* Modalidad: Flete total */}
          {state.modalidadCosto === 'flete_total' && (
            <div>
              <label className="text-xs text-slate-700 block mb-1">
                Monto total del flete (USD)
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={state.costoFleteTotalUSD || ''}
                  onChange={e =>
                    dispatch({
                      type: 'SET_COSTO_FLETE_TOTAL',
                      monto: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full pl-7 pr-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Se prorratea entre las {totalUnidades} unidades para el CTRU.
              </p>
            </div>
          )}

          {/* Modalidad: Tarifa por unidad */}
          {state.modalidadCosto === 'tarifa_unidad' && (
            <div>
              <label className="text-xs text-slate-700 block mb-1">
                Costo por unidad (USD)
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={state.costoPorUnidadUSD || ''}
                  onChange={e =>
                    dispatch({
                      type: 'SET_COSTO_POR_UNIDAD',
                      monto: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full pl-7 pr-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Total = {totalUnidades} uds × ${state.costoPorUnidadUSD.toFixed(2)} = ${totalFleteUSD.toFixed(2)}
              </p>
            </div>
          )}

          {/* Modalidad: Por producto */}
          {state.modalidadCosto === 'por_producto' && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Costo unitario por producto
              </div>
              {state.unidadesSeleccionadas.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 text-center text-xs text-slate-600">
                  Sin unidades seleccionadas. Volvé al Paso 1.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">
                          Producto
                        </th>
                        <th className="px-3 py-2 text-right font-semibold">
                          Cant.
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Costo unit. USD
                        </th>
                        <th className="px-3 py-2 text-right font-semibold">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {state.unidadesSeleccionadas.map(u => {
                        const costo =
                          state.costosPorProducto.find(
                            c => c.productoId === u.productoId
                          )?.costoUnitario || 0;
                        return (
                          <tr key={u.productoId}>
                            <td className="px-3 py-2">📦 {u.productoNombre}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {u.cantidadSeleccionada}
                            </td>
                            <td className="px-3 py-2">
                              <div className="relative max-w-24">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                                  $
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={costo || ''}
                                  onChange={e =>
                                    dispatch({
                                      type: 'SET_COSTO_POR_PRODUCTO',
                                      productoId: u.productoId,
                                      costoUnitario:
                                        parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full pl-5 pr-2 py-1 text-xs border border-slate-300 rounded tabular-nums"
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                              ${(costo * u.cantidadSeleccionada).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-teal-50 border-t-2 border-teal-200">
                      <tr>
                        <td
                          colSpan={3}
                          className="px-3 py-2 font-semibold text-teal-900 text-right"
                        >
                          TOTAL:
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-teal-900">
                          ${totalFleteUSD.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Modalidad: Por tramos de peso (D-11) */}
          {state.modalidadCosto === 'por_tramos' && (
            <div className="space-y-4">
              {/* Banner: tramos cargados del colaborador */}
              {state.colaboradorTransporteId && state.tramosPeso.length > 0 && (
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">💡</span>
                  <div className="text-xs flex-1">
                    <div className="font-semibold text-sky-900 mb-0.5">
                      Tramos cargados del acuerdo preset de{' '}
                      {state.colaboradorTransporteNombre}
                    </div>
                    <p className="text-sky-800">
                      Podés editarlos para este envío puntual sin alterar su ficha.
                    </p>
                  </div>
                </div>
              )}

              {/* Editor de tramos (reutiliza TramosPesoSection de RedLogistica) */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Tabla de tramos (lb)
                </div>
                <TramosPesoSection
                  value={state.tramosPeso}
                  onChange={tramos =>
                    dispatch({ type: 'SET_TRAMOS_PESO', tramos })
                  }
                />
              </div>

              {/* Tabla de cálculo automático */}
              <TablaCalculoTramos
                unidades={state.unidadesSeleccionadas}
                tramos={state.tramosPeso}
                totalFleteUSD={totalFleteUSD}
              />
            </div>
          )}
        </div>
      </div>

      {/* TC chip (solo si moneda USD/MIXTA) */}
      {showTCChip && (
        <TCChip
          tc={state.tipoCambio}
          overrideActivo={state.tipoCambioOverride}
          onChange={(tc, override) =>
            dispatch({ type: 'SET_TIPO_CAMBIO', tc, override })
          }
        />
      )}

      {/* Total landed */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-teal-800">
            <b className="text-teal-900">Total flete:</b>
          </div>
          <div className="text-sm font-bold tabular-nums text-teal-900">
            ${totalFleteUSD.toFixed(2)} USD
            {state.tipoCambio > 0 && (
              <span className="text-teal-700 font-normal">
                {' · '}
                S/ {(totalFleteUSD * state.tipoCambio).toFixed(2)}
              </span>
            )}
          </div>
        </div>
        <div className="text-[11px] text-teal-700">
          {state.modalidadCosto === 'flete_total' && 'Monto fijo ingresado'}
          {state.modalidadCosto === 'tarifa_unidad' && `${totalUnidades} uds × tarifa unitaria`}
          {state.modalidadCosto === 'por_producto' && 'Sumatoria por producto'}
          {state.modalidadCosto === 'por_tramos' && 'Derivado de los tramos de peso'}
        </div>
      </div>

      {/* Recordatorio cierre operativo ≠ financiero */}
      <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">⏱️</span>
          <div className="flex-1 text-xs">
            <div className="font-bold text-amber-900 mb-1">
              Cierre operativo ≠ Cierre financiero
            </div>
            <p className="text-amber-800 mb-2">
              Podés crear el envío con costos <b>estimados o incompletos</b>{' '}
              ahora y actualizarlos después cuando tengas la factura final del
              viajero. El envío puede <b>transitar operativamente</b>
              (confirmado → en tránsito → recibido) aunque los costos aún no
              estén cerrados financieramente.
            </p>
            <p className="text-amber-800">
              Cuando la parte financiera esté completa, se hace{' '}
              <b>cierre financiero</b> del envío desde el detalle (ver S46 · D-17 ·
              Costos Landed Scope).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
