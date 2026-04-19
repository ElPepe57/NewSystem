/**
 * CasillaExpandible — fila de casilla con colaboradores asociados dentro.
 *
 * S42h: invierte la jerarquía visual. La CASILLA es la fila principal
 * (lugar físico objetivo), los colaboradores son items expandibles
 * asociados (principal + secundarios).
 *
 * Aplica a secciones "Mis Almacenes" y "Viajeros" donde el valor está
 * en el lugar físico (dirección, unidades, valor inventario).
 */
import React from 'react';
import {
  ChevronDown, ChevronRight, MapPin, Package, DollarSign,
  Star, Edit2, Plus, Users, Phone,
} from 'lucide-react';
import { StatusBadge } from '../../../design-system';
import type { Casilla } from '../../../types/casilla.types';
import type { Colaborador } from '../../../types/colaborador.types';
import { formatCurrency } from '../../../utils/format';

const PAIS_EMOJI: Record<string, string> = {
  USA: '\u{1F1FA}\u{1F1F8}',
  Peru: '\u{1F1F5}\u{1F1EA}',
  China: '\u{1F1E8}\u{1F1F3}',
  Corea: '\u{1F1F0}\u{1F1F7}',
  Peru_local: '\u{1F1F5}\u{1F1EA}',
};

const TIPO_COLAB_LABEL: Record<string, string> = {
  empresa: 'Empresa',
  viajero: 'Viajero',
  courier_externo: 'Courier internacional',
  transportista_local: 'Transportista local',
};

export interface CasillaExpandibleProps {
  casilla: Casilla;
  colaboradorPrincipal?: Colaborador;
  colaboradoresSecundarios: Colaborador[];
  expanded: boolean;
  onToggleExpand: () => void;
  onEditarCasilla: (casilla: Casilla) => void;
  onEditarColaborador: (c: Colaborador) => void;
  onAsociarColaborador: (casilla: Casilla) => void;
  onVerEnMapa?: (casilla: Casilla) => void;
}

export const CasillaExpandible: React.FC<CasillaExpandibleProps> = ({
  casilla,
  colaboradorPrincipal,
  colaboradoresSecundarios,
  expanded,
  onToggleExpand,
  onEditarCasilla,
  onEditarColaborador,
  onAsociarColaborador,
}) => {
  const totalColaboradores = 1 + colaboradoresSecundarios.length;
  const esCompartida = colaboradoresSecundarios.length > 0;

  return (
    <div>
      {/* Header casilla */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={onToggleExpand}
      >
        <button className="flex-shrink-0 text-slate-400" onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Icono casilla con bandera */}
        <div className="flex-shrink-0 relative">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-teal-50 text-teal-600 border border-teal-200">
            <MapPin className="w-5 h-5" />
          </div>
          <span className="absolute -top-1 -right-1 text-xs">{PAIS_EMOJI[casilla.pais] || ''}</span>
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-900 truncate">{casilla.nombre}</span>
            <span className="text-[10px] font-mono text-slate-400">{casilla.codigo}</span>
            {casilla.esPrincipal && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-50 text-amber-700 border border-amber-200">
                <Star className="w-3 h-3 fill-amber-500" /> Principal
              </span>
            )}
            {esCompartida && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-50 text-purple-700 border border-purple-200"
                title={`${totalColaboradores} colaboradores comparten esta casilla`}
              >
                <Users className="w-3 h-3" /> Compartida · {totalColaboradores}
              </span>
            )}
            <StatusBadge variant={casilla.estado === 'activa' ? 'success' : 'neutral'} size="sm">
              {casilla.estado}
            </StatusBadge>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
            {casilla.direccion && <span className="truncate">{casilla.direccion}</span>}
            {casilla.ciudad && <span>· {casilla.ciudad}</span>}
            <span>· {TIPO_COLAB_LABEL[colaboradorPrincipal?.tipo ?? ''] ?? ''}</span>
          </div>
        </div>

        {/* Métricas */}
        <div className="hidden sm:flex items-center gap-4 text-xs text-slate-600 flex-shrink-0">
          <span className="flex items-center gap-1" title="Unidades actuales">
            <Package className="w-3.5 h-3.5 text-slate-400" />
            {casilla.unidadesActuales ?? 0}
            {casilla.capacidadUnidades ? `/${casilla.capacidadUnidades}` : ''}
          </span>
          <span className="flex items-center gap-1" title="Valor inventario USD">
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            {formatCurrency(casilla.valorInventarioUSD ?? 0, 'USD')}
          </span>
        </div>

        {/* Acciones casilla */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onEditarCasilla(casilla)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            title="Editar casilla"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Contenido expandido: colaboradores + asociar */}
      {expanded && (
        <div className="bg-slate-50/50 border-t border-slate-100">
          {/* Colaborador principal */}
          {colaboradorPrincipal && (
            <ColabRowInCasilla
              colaborador={colaboradorPrincipal}
              esPrincipal
              onEditar={onEditarColaborador}
            />
          )}

          {/* Secundarios */}
          {colaboradoresSecundarios.map((c) => (
            <ColabRowInCasilla
              key={c.id}
              colaborador={c}
              esPrincipal={false}
              onEditar={onEditarColaborador}
            />
          ))}

          {/* Acción: asociar colaborador */}
          <div className="px-4 pl-12 py-2 border-t border-slate-100">
            <button
              onClick={() => onAsociarColaborador(casilla)}
              className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Asociar otro colaborador
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-componente: colaborador dentro de la casilla ──

interface ColabRowInCasillaProps {
  colaborador: Colaborador;
  esPrincipal: boolean;
  onEditar: (c: Colaborador) => void;
}

const ColabRowInCasilla: React.FC<ColabRowInCasillaProps> = ({ colaborador, esPrincipal, onEditar }) => (
  <div className="flex items-center gap-3 px-4 pl-12 py-2 hover:bg-white/60 transition-colors">
    <div className="flex-shrink-0 w-5">
      {esPrincipal ? (
        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
      ) : (
        <Users className="w-3.5 h-3.5 text-purple-500" />
      )}
    </div>

    {/* Avatar inicial */}
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 text-teal-800 flex items-center justify-center text-[11px] font-semibold">
      {colaborador.nombre.charAt(0).toUpperCase()}
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-slate-800 truncate">{colaborador.nombre}</span>
        <span className="text-[10px] font-mono text-slate-400">{colaborador.codigo}</span>
        <span className="text-[10px] text-slate-500">{TIPO_COLAB_LABEL[colaborador.tipo] ?? colaborador.tipo}</span>
        <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded ${
          esPrincipal ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
        }`}>
          {esPrincipal ? 'Principal' : 'Comparte'}
        </span>
      </div>
      {(colaborador.telefono || colaborador.email) && (
        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
          {colaborador.telefono && (
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" /> {colaborador.telefono}
            </span>
          )}
          {colaborador.email && <span className="truncate max-w-[180px]">{colaborador.email}</span>}
        </div>
      )}
    </div>

    <button
      onClick={() => onEditar(colaborador)}
      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex-shrink-0"
      title="Editar colaborador"
    >
      <Edit2 className="w-3 h-3" />
    </button>
  </div>
);
