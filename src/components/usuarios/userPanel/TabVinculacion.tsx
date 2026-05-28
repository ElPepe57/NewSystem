/**
 * TabVinculacion.tsx · chk5.PERSONAS-v5.8 · E3.4 (2026-05-28)
 *
 * Tab condicional · solo aparece cuando el user tiene al menos 1 relación
 * vigente tipo='externo' con entidadMaestroRef.
 *
 * Muestra el detalle de la vinculación con la entidad de Maestros
 * (proveedor/cliente/marca) · canon v5.8.
 *
 * Contenido por cada relación externa vinculada:
 *   1. Card grande del Maestro (gradient indigo/purple)
 *      - Icon building-2 + nombre + tipo (Proveedor · Cliente · Marca)
 *      - Stats: rol en entidad · desde cuándo · días/meses de relación
 *      - CTA "Abrir en Maestros" (navega a /maestros)
 *   2. Sección "Operaciones recientes" (placeholder · E7 conecta data real)
 *   3. Sección "Otros contactos del Maestro" (placeholder · E7 query real)
 *   4. Si el user tiene N relaciones externas con N Maestros distintos,
 *      se muestran N bloques · cada uno con su propia card + sub-secciones
 *
 * E3.4 entrega: estructura visual completa con placeholders.
 * E7 reemplaza placeholders con queries reales:
 *   - OC recientes desde ordenesCompra/ where(proveedorId == ref.id)
 *   - Otros contactos vía relacionesLaboralesService.getContactosByMaestro()
 */

import React, { useMemo } from 'react';
import {
  Building2,
  ExternalLink,
  Link as LinkIcon,
  ShoppingCart,
  Users,
  Calendar,
  Briefcase as BriefcaseIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { RelacionLaboral, TipoEntidadMaestro } from '../../../types/relacionLaboral.types';
import { getRelacionesActivas } from '../../../types/relacionLaboral.types';

interface TabVinculacionProps {
  relaciones: RelacionLaboral[];
  /** Cierra el panel al navegar */
  onAfterNavigate?: () => void;
}

const TIPO_MAESTRO_LABELS: Record<TipoEntidadMaestro, string> = {
  cliente: 'Cliente',
  proveedor: 'Proveedor',
  marca: 'Marca',
};

const TIPO_MAESTRO_COLORS: Record<
  TipoEntidadMaestro,
  { bgGradient: string; iconBg: string; ring: string; text: string; cta: string }
> = {
  proveedor: {
    bgGradient: 'from-indigo-50 to-purple-50',
    iconBg: 'bg-indigo-600',
    ring: 'ring-indigo-200',
    text: 'text-indigo-900',
    cta: 'border-indigo-200 text-indigo-700 hover:bg-indigo-50',
  },
  cliente: {
    bgGradient: 'from-blue-50 to-sky-50',
    iconBg: 'bg-blue-600',
    ring: 'ring-blue-200',
    text: 'text-blue-900',
    cta: 'border-blue-200 text-blue-700 hover:bg-blue-50',
  },
  marca: {
    bgGradient: 'from-pink-50 to-rose-50',
    iconBg: 'bg-pink-600',
    ring: 'ring-pink-200',
    text: 'text-pink-900',
    cta: 'border-pink-200 text-pink-700 hover:bg-pink-50',
  },
};

function fmtFecha(ts: { toDate?: () => Date } | undefined | null): string {
  if (!ts || !ts.toDate) return '—';
  return ts.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function diasEntre(ts: { toMillis: () => number } | undefined): string {
  if (!ts) return '—';
  const ms = ts.toMillis();
  const dias = Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
  if (dias < 30) return `${dias}d`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `${meses}m`;
  const anios = Math.floor(meses / 12);
  const mesesRestantes = meses % 12;
  return mesesRestantes > 0 ? `${anios}a ${mesesRestantes}m` : `${anios}a`;
}

export const TabVinculacion: React.FC<TabVinculacionProps> = ({ relaciones, onAfterNavigate }) => {
  const navigate = useNavigate();

  // Filtrar solo relaciones VIGENTES con entidadMaestroRef
  const vinculaciones = useMemo(() => {
    return getRelacionesActivas(relaciones).filter((r) => r.entidadMaestroRef);
  }, [relaciones]);

  const handleNavMaestro = (tipo: TipoEntidadMaestro, id: string) => {
    onAfterNavigate?.();
    // /maestros usa tabs · navegamos con query param para pre-seleccionar
    const tabMap: Record<TipoEntidadMaestro, string> = {
      proveedor: 'proveedores',
      cliente: 'clientes',
      marca: 'marcas',
    };
    navigate(`/maestros?tab=${tabMap[tipo]}&id=${id}`);
  };

  if (vinculaciones.length === 0) {
    return (
      <div className="p-5">
        <div className="bg-slate-50 ring-1 ring-dashed ring-slate-300 rounded-xl p-6 text-center">
          <LinkIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <div className="text-sm font-bold text-slate-700">Sin vinculación con Maestros</div>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Este usuario no tiene relaciones externas vinculadas con entidades de Maestros
            (proveedor · cliente · marca).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      {vinculaciones.map((r) => {
        const ref = r.entidadMaestroRef!;
        const colors = TIPO_MAESTRO_COLORS[ref.tipo];

        return (
          <div key={r.id} className="space-y-3">
            {/* ═══ Card grande del Maestro ═══ */}
            <div
              className={`bg-gradient-to-br ${colors.bgGradient} ring-1 ${colors.ring} rounded-2xl p-5`}
            >
              <div className="flex items-start justify-between mb-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-14 h-14 rounded-xl ${colors.iconBg} text-white flex items-center justify-center flex-shrink-0`}
                  >
                    <Building2 className="w-7 h-7" />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-[10px] uppercase tracking-wider font-bold ${colors.text} opacity-80`}>
                      VINCULADO A · {TIPO_MAESTRO_LABELS[ref.tipo].toUpperCase()}
                    </div>
                    <div className={`text-lg font-bold ${colors.text} truncate`}>
                      {ref.nombreCachedSnapshot}
                    </div>
                    <div className={`text-xs ${colors.text} opacity-70 truncate`}>
                      ID: <span className="font-mono">{ref.id.slice(0, 12)}...</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleNavMaestro(ref.tipo, ref.id)}
                  className={`px-2.5 py-1.5 bg-white border ${colors.cta} rounded-lg text-xs font-medium inline-flex items-center gap-1 flex-shrink-0 transition-colors`}
                  title="Abrir el perfil del Maestro"
                >
                  <ExternalLink className="w-3 h-3" />
                  Abrir
                </button>
              </div>

              {/* Stats inline */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {ref.rolEnEntidad && (
                  <div className="bg-white rounded-lg p-2.5">
                    <div className={`text-[9px] uppercase font-bold ${colors.text} opacity-70 mb-0.5`}>
                      ROL EN ENTIDAD
                    </div>
                    <div className="font-semibold text-slate-900">{ref.rolEnEntidad}</div>
                  </div>
                )}
                <div className="bg-white rounded-lg p-2.5">
                  <div className={`text-[9px] uppercase font-bold ${colors.text} opacity-70 mb-0.5`}>
                    VINCULADO DESDE
                  </div>
                  <div className="font-semibold text-slate-900 tabular-nums">
                    {fmtFecha(ref.fechaVinculacion)}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2.5">
                  <div className={`text-[9px] uppercase font-bold ${colors.text} opacity-70 mb-0.5`}>
                    ANTIGÜEDAD
                  </div>
                  <div className="font-semibold text-slate-900 tabular-nums">
                    {diasEntre(ref.fechaVinculacion)}
                  </div>
                </div>
              </div>

              {/* Subtipo de externo si aplica */}
              {r.subTipo && (
                <div className={`mt-3 text-[11px] ${colors.text} opacity-80`}>
                  Subtipo de externo:{' '}
                  <strong className="capitalize">{r.subTipo.replace(/_/g, ' ')}</strong>
                </div>
              )}
            </div>

            {/* ═══ Placeholder · Operaciones recientes (E7) ═══ */}
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <ShoppingCart className="w-3 h-3" />
                Operaciones recientes con {ref.nombreCachedSnapshot}
              </div>
              <div className="bg-slate-50 ring-1 ring-dashed ring-slate-300 rounded-lg p-4 text-center">
                <Calendar className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                <div className="text-xs text-slate-600">
                  {ref.tipo === 'proveedor' && 'OC recientes a este proveedor'}
                  {ref.tipo === 'cliente' && 'Ventas recientes a este cliente'}
                  {ref.tipo === 'marca' && 'Productos asociados a esta marca'}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Listado se conecta en <strong>E8</strong> · cross-link desde módulos operativos.
                </div>
              </div>
            </div>

            {/* ═══ Placeholder · Otros contactos (E7) ═══ */}
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                Otros contactos de {ref.nombreCachedSnapshot}
              </div>
              <div className="bg-slate-50 ring-1 ring-dashed ring-slate-300 rounded-lg p-4 text-center">
                <Users className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                <div className="text-xs text-slate-600">
                  Otras personas vinculadas a esta entidad
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Query <code className="bg-white px-1 rounded">getContactosByMaestro</code> existe en E1 ·
                  se conecta en <strong>E7</strong>.
                </div>
              </div>
            </div>

            {/* Separator entre múltiples vinculaciones */}
            {vinculaciones.length > 1 && r !== vinculaciones[vinculaciones.length - 1] && (
              <div className="border-t-2 border-dashed border-slate-200 my-2" />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TabVinculacion;
