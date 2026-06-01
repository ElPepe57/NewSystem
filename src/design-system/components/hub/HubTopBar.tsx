/**
 * HubTopBar · Hub Kit L5 · top-bar del shell hub.
 *
 * Breadcrumb canónico S9.D1 dinámico (Inicio › Módulo › [leaf]) + chip de rol
 * contextual a la derecha. El COLOR del chip se HEREDA del grupo del sidebar
 * vía grupoColor.ts (Modelo A) — nunca se elige ni se inventa.
 *
 * Canon "admin ve todo": el chip es contextual al rol del usuario activo ·
 * admin ve "Vista ejecutiva · admin" · otros roles ven "Vista ejecutiva".
 *
 * Spec: docs/mockups/hub-kit-implementacion-v1.html (ACTO 1/2/4).
 */
import React from 'react';
import { ChevronRight, Shield } from 'lucide-react';
import { chromeDe, type GrupoSidebar } from '../../grupoColor';

interface HubTopBarProps {
  /** Grupo del sidebar → de aquí sale el color del chip (heredado · no se elige). */
  grupo: GrupoSidebar;
  /** Nombre del módulo · 2º nivel del breadcrumb (ej. "Stock"). */
  modulo: string;
  /** Hoja actual · 3er nivel (tab activa). null/undefined = solo 2 niveles. */
  leaf?: string | null;
  /** Click en "Inicio" (navega al home). */
  onInicio?: () => void;
  /** Click en el módulo · vuelve a su vista default. Solo activo cuando hay leaf. */
  onModulo?: () => void;
  /** Si el usuario activo es admin → el chip dice "Vista ejecutiva · admin". */
  esAdmin?: boolean;
  className?: string;
}

export const HubTopBar: React.FC<HubTopBarProps> = ({
  grupo,
  modulo,
  leaf,
  onInicio,
  onModulo,
  esAdmin = false,
  className = '',
}) => {
  const C = chromeDe(grupo);
  const hayLeaf = leaf != null && leaf !== '';

  return (
    <div className={`border-b border-slate-200 px-4 sm:px-6 py-2.5 bg-slate-50 flex items-center justify-between gap-3 ${className}`}>
      {/* Breadcrumb S9.D1 · Inicio › Módulo › [leaf] */}
      <nav className="flex items-center gap-1 text-[12px] text-slate-500 min-w-0" aria-label="Breadcrumb">
        <button type="button" onClick={onInicio} className="hover:text-slate-700 transition-colors flex-shrink-0">
          Inicio
        </button>
        <ChevronRight className="w-3 h-3 text-slate-300 mx-0.5 flex-shrink-0" />
        {hayLeaf ? (
          <button type="button" onClick={onModulo} className="hover:text-slate-700 transition-colors flex-shrink-0">
            {modulo}
          </button>
        ) : (
          <span className="text-slate-900 font-semibold truncate">{modulo}</span>
        )}
        {hayLeaf && (
          <>
            <ChevronRight className="w-3 h-3 text-slate-300 mx-0.5 flex-shrink-0" />
            <span className="text-slate-900 font-semibold truncate">{leaf}</span>
          </>
        )}
      </nav>

      {/* Chip de rol contextual · color heredado del grupo (chromeDe(grupo).chip) */}
      <span className={`text-[10px] ${C.chip} px-2 py-0.5 rounded font-bold hidden sm:inline-flex items-center gap-1 flex-shrink-0`}>
        <Shield className="w-3 h-3" />
        {esAdmin ? 'Vista ejecutiva · admin' : 'Vista ejecutiva'}
      </span>
    </div>
  );
};
