/**
 * CasillaDestinoColaboradorPicker — Selector de casilla destino para el
 * Wizard J con indicador de país + colaborador responsable.
 *
 * Diferencias vs. otros pickers de casilla en el sistema:
 *   - NO permite seleccionar la casilla origen (exclusión explícita)
 *   - NO permite almacenes Perú (sólo casillas internacionales — Caso J)
 *   - Agrupa visualmente por país para facilitar D-9 (intra-país preferente)
 *   - Muestra el colaborador dueño de cada casilla con badge
 *   - Destaca con chevron verde las casillas del mismo país que el origen
 *
 * Ubicación típica: Paso 2 del Wizard J (StepDestino).
 */
import React, { useMemo, useState } from 'react';
import { MapPin, Check, Star, User } from 'lucide-react';
import type { Casilla } from '../../../types/casilla.types';
import { PAISES_CONFIG } from '../../../types/casilla.types';
import { cn } from '../../../design-system';

export interface CasillaDestinoColaboradorPickerProps {
  /** Todas las casillas del sistema (el componente filtra internamente) */
  casillas: Casilla[];
  /** ID de la casilla origen — se excluye de las opciones */
  casillaOrigenId: string;
  /** País del origen — para resaltar candidatas intra-país (D-9) */
  origenPais: string;
  /** ID de la casilla destino seleccionada */
  value: string;
  /** Callback al seleccionar una casilla */
  onChange: (casilla: Casilla) => void;
  /** Opcional: placeholder del input de búsqueda */
  placeholder?: string;
  className?: string;
}

export const CasillaDestinoColaboradorPicker: React.FC<CasillaDestinoColaboradorPickerProps> = ({
  casillas,
  casillaOrigenId,
  origenPais,
  value,
  onChange,
  placeholder = 'Buscar casilla destino...',
  className,
}) => {
  const [busqueda, setBusqueda] = useState('');

  // Filtrar: sólo casillas internacionales activas, excluyendo el origen
  const opciones = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return casillas
      .filter((c) => c.id !== casillaOrigenId)
      .filter((c) => c.estado === 'activa')
      // Excluir almacenes Perú — Caso J es casilla↔casilla internacional
      .filter((c) => c.pais !== 'Peru' && c.pais !== 'Peru_local')
      .filter((c) => {
        if (!q) return true;
        return (
          c.nombre.toLowerCase().includes(q) ||
          c.codigo.toLowerCase().includes(q) ||
          c.colaboradorNombre.toLowerCase().includes(q) ||
          c.ciudad?.toLowerCase().includes(q)
        );
      });
  }, [casillas, casillaOrigenId, busqueda]);

  // Agrupar por país, con el país del origen primero (D-9 intra-país preferente)
  const gruposPorPais = useMemo(() => {
    const map = new Map<string, Casilla[]>();
    for (const c of opciones) {
      const arr = map.get(c.pais) ?? [];
      arr.push(c);
      map.set(c.pais, arr);
    }
    // Ordenar: primero el país del origen, luego alfabético
    const paises = Array.from(map.keys()).sort((a, b) => {
      if (a === origenPais) return -1;
      if (b === origenPais) return 1;
      return a.localeCompare(b);
    });
    return paises.map((pais) => ({
      pais,
      casillas: map.get(pais) ?? [],
    }));
  }, [opciones, origenPais]);

  const seleccionada = useMemo(
    () => casillas.find((c) => c.id === value) ?? null,
    [casillas, value]
  );

  return (
    <div className={cn('space-y-3', className)}>
      {/* Chip de seleccion actual */}
      {seleccionada ? (
        <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4 text-teal-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-slate-900 truncate">
                {PAISES_CONFIG[seleccionada.pais]?.emoji ?? '🌐'} {seleccionada.nombre}
              </span>
              {seleccionada.esPrincipal && (
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" aria-label="Casilla principal" />
              )}
              <span className="text-[10px] font-mono text-slate-500">{seleccionada.codigo}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-600 mt-0.5">
              <User className="w-3 h-3" />
              <span>{seleccionada.colaboradorNombre}</span>
              {seleccionada.ciudad && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{seleccionada.ciudad}</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBusqueda('')}
            className="text-[11px] text-teal-700 hover:text-teal-800 font-medium"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={placeholder}
          className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
      )}

      {/* Lista agrupada por país (visible cuando no hay selección o al "Cambiar") */}
      {!seleccionada && (
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-72 overflow-y-auto bg-white">
          {gruposPorPais.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-500 italic">
              No se encontraron casillas destino disponibles.
            </div>
          )}
          {gruposPorPais.map(({ pais, casillas: casillasPais }) => {
            const esIntraPais = pais === origenPais;
            const cfg = PAISES_CONFIG[pais];
            return (
              <div key={pais}>
                <div
                  className={cn(
                    'px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-2',
                    esIntraPais
                      ? 'bg-emerald-50 text-emerald-800 border-l-2 border-emerald-500'
                      : 'bg-slate-50 text-slate-600'
                  )}
                >
                  <span>{cfg?.emoji ?? '🌐'}</span>
                  <span>{cfg?.nombre ?? pais}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-[10px] font-normal normal-case">
                    {casillasPais.length} casilla{casillasPais.length !== 1 ? 's' : ''}
                  </span>
                  {esIntraPais && (
                    <span className="ml-auto text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                      INTRA-PAÍS ★
                    </span>
                  )}
                </div>
                {casillasPais.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onChange(c);
                      setBusqueda('');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 group"
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        esIntraPais ? 'bg-emerald-100' : 'bg-slate-100'
                      )}
                    >
                      <MapPin
                        className={cn(
                          'w-3.5 h-3.5',
                          esIntraPais ? 'text-emerald-700' : 'text-slate-500'
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {c.nombre}
                        </span>
                        {c.esPrincipal && (
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        )}
                        <span className="text-[10px] font-mono text-slate-400">{c.codigo}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                        <User className="w-2.5 h-2.5" />
                        <span>{c.colaboradorNombre}</span>
                        {c.ciudad && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span>{c.ciudad}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Check className="w-4 h-4 text-slate-300 group-hover:text-teal-500 transition-colors" />
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
