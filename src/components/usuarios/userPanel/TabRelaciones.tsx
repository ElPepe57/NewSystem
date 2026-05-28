/**
 * TabRelaciones.tsx · chk5.PERSONAS-v5.6 · E3.3 (2026-05-28)
 *
 * Tab PROTAGONISTA del UserPanel (canon v5.6).
 *
 * Contenido:
 *   1. Toggle Vigentes / Históricas (chip pills)
 *   2. Botón "+ Agregar relación" (UI · E5 conecta wizard real)
 *   3. Lista de RelacionCard según toggle
 *   4. Empty state si no hay relaciones del filtro activo
 *   5. Counter contextual (X vigentes · Y históricas)
 *
 * Las acciones por card (Editar/Pausar/Reclasificar/Finalizar) emiten callbacks
 * hacia el padre · en E3.3 todavía son stubs que muestran un toast/alert.
 * E5 reemplaza los stubs con modales reales (AgregarRelacionWizard ·
 * ReclasificarModal · PausarModal · FinalizarModal).
 */

import React, { useState, useMemo } from 'react';
import { Plus, History as HistoryIcon, Briefcase } from 'lucide-react';
import type { RelacionLaboral } from '../../../types/relacionLaboral.types';
import { getRelacionesActivas, getRelacionesHistoricas } from '../../../types/relacionLaboral.types';
import { RelacionCard } from './RelacionCard';

interface TabRelacionesProps {
  userId: string;
  relaciones: RelacionLaboral[];
  /** Callback agregar nueva relación · E5 conecta wizard */
  onAgregarRelacion?: (userId: string) => void;
  /** Callbacks por card · E5 conecta modales */
  onEditarRelacion?: (r: RelacionLaboral) => void;
  onPausarRelacion?: (r: RelacionLaboral) => void;
  onReanudarRelacion?: (r: RelacionLaboral) => void;
  onReclasificarRelacion?: (r: RelacionLaboral) => void;
  onFinalizarRelacion?: (r: RelacionLaboral) => void;
  /** Click en chip Maestro vinculado · padre cambia a tab Vinculación */
  onVerVinculacion?: (r: RelacionLaboral) => void;
}

type FiltroRelaciones = 'vigentes' | 'historicas';

export const TabRelaciones: React.FC<TabRelacionesProps> = ({
  userId,
  relaciones,
  onAgregarRelacion,
  onEditarRelacion,
  onPausarRelacion,
  onReanudarRelacion,
  onReclasificarRelacion,
  onFinalizarRelacion,
  onVerVinculacion,
}) => {
  const [filtro, setFiltro] = useState<FiltroRelaciones>('vigentes');

  const vigentes = useMemo(() => getRelacionesActivas(relaciones), [relaciones]);
  const historicas = useMemo(() => getRelacionesHistoricas(relaciones), [relaciones]);

  // Ordenar vigentes: vigente > prueba > pausada · luego por fechaInicio desc
  const vigentesOrdenadas = useMemo(() => {
    const orden = { vigente: 0, prueba: 1, pausada: 2, finalizada: 3 } as const;
    return [...vigentes].sort((a, b) => {
      const diffEstado = orden[a.estado] - orden[b.estado];
      if (diffEstado !== 0) return diffEstado;
      return b.fechaInicio.toMillis() - a.fechaInicio.toMillis();
    });
  }, [vigentes]);

  // Históricas: ordenar por fechaFin desc (más reciente primero)
  const historicasOrdenadas = useMemo(() => {
    return [...historicas].sort((a, b) => {
      const aFin = a.fechaFin?.toMillis() ?? 0;
      const bFin = b.fechaFin?.toMillis() ?? 0;
      return bFin - aFin;
    });
  }, [historicas]);

  const lista = filtro === 'vigentes' ? vigentesOrdenadas : historicasOrdenadas;

  return (
    <div className="p-5 space-y-3">
      {/* ═══ Toggle + counts + botón agregar ═══ */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setFiltro('vigentes')}
            className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors inline-flex items-center gap-1.5 ${
              filtro === 'vigentes'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Briefcase className="w-3 h-3" />
            Vigentes
            <span className="tabular-nums opacity-70">· {vigentes.length}</span>
          </button>
          <button
            onClick={() => setFiltro('historicas')}
            className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors inline-flex items-center gap-1.5 ${
              filtro === 'historicas'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <HistoryIcon className="w-3 h-3" />
            Históricas
            <span className="tabular-nums opacity-70">· {historicas.length}</span>
          </button>
        </div>

        {onAgregarRelacion && (
          <button
            onClick={() => onAgregarRelacion(userId)}
            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors"
            title="Agregar nueva relación · empleado · honorarios · socio · externo"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar relación
          </button>
        )}
      </div>

      {/* ═══ Lista de cards ═══ */}
      {lista.length > 0 ? (
        <div className="space-y-2">
          {lista.map((r) => (
            <RelacionCard
              key={r.id}
              relacion={r}
              onEditar={filtro === 'vigentes' ? onEditarRelacion : undefined}
              onPausar={filtro === 'vigentes' ? onPausarRelacion : undefined}
              onReanudar={filtro === 'vigentes' ? onReanudarRelacion : undefined}
              onReclasificar={filtro === 'vigentes' ? onReclasificarRelacion : undefined}
              onFinalizar={filtro === 'vigentes' ? onFinalizarRelacion : undefined}
              onVerVinculacion={onVerVinculacion}
            />
          ))}
        </div>
      ) : (
        /* Empty state · canon N9 quick-start */
        <div className="bg-slate-50 ring-1 ring-dashed ring-slate-300 rounded-xl p-6 text-center">
          {filtro === 'vigentes' ? (
            <>
              <Briefcase className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-sm font-bold text-slate-700">Sin relaciones vigentes</div>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Agregá la primera relación para vincular a esta persona con el negocio.
                Puede ser empleado, honorarios, socio o externo.
              </p>
              {onAgregarRelacion && (
                <button
                  onClick={() => onAgregarRelacion(userId)}
                  className="mt-3 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar primera relación
                </button>
              )}
            </>
          ) : (
            <>
              <HistoryIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-sm font-bold text-slate-700">Sin relaciones históricas</div>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Cuando una relación se finalice, reclasifique o termine por otro motivo,
                quedará registrada acá con su snapshot inmutable.
              </p>
            </>
          )}
        </div>
      )}

      {/* Footer info · contextualizado por filtro */}
      {filtro === 'historicas' && historicas.length > 0 && (
        <div className="text-[10px] text-slate-500 text-center pt-2 border-t border-slate-100">
          Las relaciones históricas son <strong>inmutables</strong> · preservan el snapshot de datos al momento del cierre.
        </div>
      )}
    </div>
  );
};

export default TabRelaciones;
