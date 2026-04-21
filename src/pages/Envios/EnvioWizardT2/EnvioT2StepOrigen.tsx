/**
 * EnvioT2StepOrigen — Paso 1 del Wizard T2 (Origen).
 *
 * Permite seleccionar la casilla internacional desde la que saldrá el envío.
 * Muestra un grid de casillas activas + StatCards con el contenido de la casilla
 * seleccionada (unidades disponibles, productos únicos, OCs, pre-vendidas).
 *
 * D-3: el selector de almacén destino vive en Paso 3 (Transporte), NO aquí.
 * Paso 1 se mantiene simple: solo origen.
 */
import React, { useEffect, useMemo } from 'react';
import { useAlmacenStore } from '../../../store/casillaStore';
import { unidadService } from '../../../services/unidad.service';
import type { Unidad } from '../../../types/unidad.types';
import type { Casilla } from '../../../types/casilla.types';
import { cn } from '../../../design-system';
import type { EnvioWizardT2State, EnvioWizardT2Action } from './envioWizardT2Types';

export interface EnvioT2StepOrigenProps {
  state: EnvioWizardT2State;
  dispatch: (action: EnvioWizardT2Action) => void;
}

/** Mapa de país → emoji de bandera (PaisCasilla enum) */
const FLAG_MAP: Record<string, string> = {
  USA: '🇺🇸',
  Peru: '🇵🇪',
  Peru_local: '🇵🇪',
  China: '🇨🇳',
  Corea: '🇰🇷',
};

const flagDePais = (pais: string): string => FLAG_MAP[pais] || '🌎';

export const EnvioT2StepOrigen: React.FC<EnvioT2StepOrigenProps> = ({ state, dispatch }) => {
  const casillas = useAlmacenStore((s) => s.casillas);
  const loading = useAlmacenStore((s) => s.casillasLoading);
  const fetchCasillas = useAlmacenStore((s) => s.fetchCasillas);

  // Cargar casillas al montar si aún no están
  useEffect(() => {
    if (casillas.length === 0 && !loading) {
      fetchCasillas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Solo casillas activas que NO estén en Perú (origen es internacional)
  // PaisCasilla = 'USA' | 'Peru' | 'China' | 'Corea' | 'Peru_local'
  const casillasActivas = useMemo(
    () =>
      casillas.filter(
        (c) => c.estado === 'activa' && c.pais !== 'Peru' && c.pais !== 'Peru_local'
      ),
    [casillas]
  );

  const casillaSeleccionada: Casilla | undefined = useMemo(
    () => casillasActivas.find((c) => c.id === state.casillaOrigenId),
    [casillasActivas, state.casillaOrigenId]
  );

  // Cuando cambia la casilla origen, cargar sus unidades disponibles
  useEffect(() => {
    if (!casillaSeleccionada) return;
    let cancelled = false;
    unidadService
      .getDisponiblesPorAlmacen(casillaSeleccionada.id)
      .then((unidades: Unidad[]) => {
        if (cancelled) return;
        // Sólo las que están FÍSICAMENTE en la casilla origen (excluir reservadas ya en tránsito)
        const disponibles = unidades.filter(
          (u) => u.estado === 'recibida_usa' || u.estado === 'recibida_origen' || u.estado === 'reservada'
        );
        dispatch({ type: 'SET_UNIDADES_DISPONIBLES', unidades: disponibles });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'SET_UNIDADES_DISPONIBLES', unidades: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [casillaSeleccionada, dispatch]);

  // Stats del contenido de la casilla seleccionada
  const stats = useMemo(() => {
    const uds = state.unidadesDisponibles;
    const productos = new Set(uds.map((u) => u.productoId));
    const ocs = new Set(uds.map((u) => u.ordenCompraId).filter(Boolean));
    const prevendidas = uds.filter((u) => !!u.reservadaPara).length;
    const valorBase = uds.reduce(
      (sum, u) => sum + (u.ctruDinamico ?? u.costoUnitarioUSD ?? 0),
      0
    );
    return {
      unidades: uds.length,
      productos: productos.size,
      ocs: ocs.size,
      prevendidas,
      valorBase,
    };
  }, [state.unidadesDisponibles]);

  return (
    <div className="space-y-5">
      {/* Título */}
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Selecciona la casilla de origen
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          El envío saldrá desde esta casilla internacional hacia el almacén destino en Perú.
        </p>
      </div>

      {/* Grid de casillas */}
      <div>
        {loading && casillas.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando casillas…</div>
        ) : casillasActivas.length === 0 ? (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center">
            <div className="text-sm text-amber-900 font-medium">No hay casillas internacionales activas</div>
            <div className="text-xs text-amber-700 mt-1">
              Configura al menos una casilla en Red Logística antes de crear un envío T2.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {casillasActivas.map((c) => {
              const sel = c.id === state.casillaOrigenId;
              const sinStock = (c.unidadesActuales ?? 0) === 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'SET_ORIGEN',
                      id: c.id,
                      nombre: c.nombre,
                      pais: c.pais,
                    })
                  }
                  disabled={sinStock}
                  className={cn(
                    'relative rounded-xl p-4 text-left transition-all',
                    sel
                      ? 'bg-teal-50 border-2 border-teal-500 ring-4 ring-teal-100'
                      : sinStock
                      ? 'bg-slate-50 border border-slate-200 opacity-60 cursor-not-allowed'
                      : 'bg-white border border-slate-200 hover:border-teal-300 cursor-pointer'
                  )}
                >
                  {sel && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <span className="text-3xl" aria-hidden>{flagDePais(c.pais)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{c.nombre}</div>
                      {c.direccion && (
                        <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">{c.direccion}</div>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
                            sinStock ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700'
                          )}
                        >
                          {!sinStock && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                          {sinStock ? 'Sin stock' : 'Activa'}
                        </span>
                        <span className="text-xs text-slate-500">{c.unidadesActuales ?? 0} unidades</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* StatCards del contenido de la casilla seleccionada */}
      {casillaSeleccionada && stats.unidades > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Contenido de {casillaSeleccionada.nombre}
            </span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCardSimple label="Unidades disponibles" value={stats.unidades} subtitle={`de ${stats.ocs} OC${stats.ocs !== 1 ? 's' : ''} distinta${stats.ocs !== 1 ? 's' : ''}`} />
            <StatCardSimple label="Productos únicos" value={stats.productos} subtitle="SKUs distintos" />
            <StatCardSimple
              label="Pre-vendidas"
              value={stats.prevendidas}
              subtitle="con adelanto pagado"
              variant="success"
            />
            <StatCardSimple
              label="Valor base"
              value={`$${stats.valorBase.toFixed(0)}`}
              subtitle="CTRU base USD"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Helper interno: StatCard simplificada ──────────────────────────────────

interface StatCardSimpleProps {
  label: string;
  value: string | number;
  subtitle?: string;
  variant?: 'default' | 'success';
}

const StatCardSimple: React.FC<StatCardSimpleProps> = ({ label, value, subtitle, variant = 'default' }) => (
  <div
    className={cn(
      'border rounded-lg p-4 border-l-4',
      variant === 'success'
        ? 'bg-emerald-50 border-emerald-200 border-l-emerald-500'
        : 'bg-white border-slate-200 border-l-transparent'
    )}
  >
    <p className={cn(
      'text-xs font-medium uppercase tracking-wider',
      variant === 'success' ? 'text-emerald-600' : 'text-slate-500'
    )}>
      {label}
    </p>
    <p className={cn(
      'text-2xl font-bold tabular-nums mt-1',
      variant === 'success' ? 'text-emerald-900' : 'text-slate-900'
    )}>
      {typeof value === 'number' ? value.toLocaleString('es-PE') : value}
    </p>
    {subtitle && (
      <p className={cn(
        'text-xs mt-0.5',
        variant === 'success' ? 'text-emerald-700' : 'text-slate-500'
      )}>
        {subtitle}
      </p>
    )}
  </div>
);
