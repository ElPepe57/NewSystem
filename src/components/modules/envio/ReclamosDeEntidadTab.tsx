/**
 * ReclamosDeEntidadTab — S54.x · BUG-INC-004 fix
 *
 * Lista los reclamos abiertos/históricos contra una entidad específica
 * (proveedor o colaborador courier). Reutilizable desde:
 *   - ProveedorDetailView (tab "Reclamos")
 *   - Ficha de Colaborador courier en Red Logística (futuro)
 *
 * Filtra `reclamos` por `destinatarioId === entidadId`.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, DollarSign, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { reclamoService } from '../../../services/reclamo.service';
import type { Reclamo, EstadoReclamo } from '../../../types/reclamo.types';
import { Badge } from '../../common';
import { formatFecha as formatDate } from '../../../utils/dateFormatters';

interface ReclamosDeEntidadTabProps {
  entidadId: string;
  /** 'proveedor' | 'courier' — para mostrar copy contextual */
  tipoEntidad: 'proveedor' | 'courier';
  /** Click en un reclamo abre su detalle (caller decide cómo) */
  onAbrirReclamo?: (reclamoId: string) => void;
}

const ESTADO_CONFIG: Record<
  EstadoReclamo,
  { label: string; tone: 'slate' | 'sky' | 'amber' | 'emerald' | 'red'; icon: React.ComponentType<{ className?: string }> }
> = {
  borrador: { label: 'Borrador', tone: 'slate', icon: Clock },
  enviado: { label: 'Enviado', tone: 'sky', icon: AlertTriangle },
  en_disputa: { label: 'En disputa', tone: 'amber', icon: AlertTriangle },
  aceptado: { label: 'Aceptado', tone: 'amber', icon: Clock },
  cobrado: { label: 'Cobrado', tone: 'emerald', icon: CheckCircle2 },
  rechazado: { label: 'Rechazado', tone: 'red', icon: XCircle },
  cerrado_sin_cobrar: { label: 'Cerrado s/cobrar', tone: 'red', icon: XCircle },
};

const TONE_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  slate: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  sky: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

export const ReclamosDeEntidadTab: React.FC<ReclamosDeEntidadTabProps> = ({
  entidadId,
  tipoEntidad,
  onAbrirReclamo,
}) => {
  const [reclamos, setReclamos] = useState<Reclamo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activos' | 'cerrados'>('activos');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    reclamoService
      .getAll({ destinatarioId: entidadId })
      .then((rs) => {
        if (!cancelled) setReclamos(rs);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Error cargando reclamos');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entidadId]);

  const reclamosFiltrados = useMemo(() => {
    if (filtroEstado === 'todos') return reclamos;
    if (filtroEstado === 'activos') {
      return reclamos.filter((r) =>
        ['borrador', 'enviado', 'en_disputa', 'aceptado'].includes(r.estado)
      );
    }
    return reclamos.filter((r) =>
      ['cobrado', 'rechazado', 'cerrado_sin_cobrar'].includes(r.estado)
    );
  }, [reclamos, filtroEstado]);

  // KPIs
  const totalReclamado = useMemo(
    () => reclamos.reduce((s, r) => s + (r.montoReclamadoPEN || 0), 0),
    [reclamos]
  );
  const totalCobrado = useMemo(
    () => reclamos.reduce((s, r) => s + (r.montoCobradoPEN || 0), 0),
    [reclamos]
  );
  const totalActivos = reclamos.filter((r) =>
    ['borrador', 'enviado', 'en_disputa', 'aceptado'].includes(r.estado)
  ).length;

  if (loading) {
    return (
      <div className="text-center py-8 text-sm text-slate-500">
        Cargando reclamos...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-sm text-red-600">
        Error: {error}
      </div>
    );
  }

  if (reclamos.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-slate-500">
        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
        <div className="font-medium text-slate-700">Sin reclamos registrados</div>
        <div className="text-xs mt-1">
          Este {tipoEntidad === 'proveedor' ? 'proveedor' : 'courier'} no tiene reclamos abiertos ni históricos.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs rápidos */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">
            Reclamos activos
          </div>
          <div className="text-xl font-bold text-slate-900 tabular-nums">
            {totalActivos}
            <span className="text-xs text-slate-400 font-normal"> / {reclamos.length}</span>
          </div>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
          <div className="text-[10px] text-amber-700 uppercase tracking-wider mb-0.5">
            Total reclamado
          </div>
          <div className="text-xl font-bold text-amber-900 tabular-nums">
            S/ {totalReclamado.toFixed(0)}
          </div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
          <div className="text-[10px] text-emerald-700 uppercase tracking-wider mb-0.5">
            Total cobrado
          </div>
          <div className="text-xl font-bold text-emerald-900 tabular-nums">
            S/ {totalCobrado.toFixed(0)}
          </div>
        </div>
      </div>

      {/* Filtro estado */}
      <div className="flex gap-1 text-xs">
        {(['activos', 'cerrados', 'todos'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltroEstado(f)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filtroEstado === f
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f === 'activos' ? 'Activos' : f === 'cerrados' ? 'Cerrados' : 'Todos'} (
            {f === 'activos'
              ? totalActivos
              : f === 'cerrados'
                ? reclamos.length - totalActivos
                : reclamos.length}
            )
          </button>
        ))}
      </div>

      {/* Lista */}
      {reclamosFiltrados.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400 italic">
          Sin reclamos en esta categoría.
        </div>
      ) : (
        <div className="space-y-2">
          {reclamosFiltrados.map((r) => {
            const cfg = ESTADO_CONFIG[r.estado];
            const tone = TONE_CLASSES[cfg.tone];
            const Icon = cfg.icon;
            return (
              <button
                key={r.id}
                type="button"
                onClick={onAbrirReclamo ? () => onAbrirReclamo(r.id) : undefined}
                disabled={!onAbrirReclamo}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${tone.bg} ${tone.border} ${onAbrirReclamo ? 'hover:shadow-sm cursor-pointer' : ''}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono font-semibold text-slate-900 text-sm">
                        {r.numeroReclamo}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${tone.text} ${tone.bg} border ${tone.border}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      <Badge variant="info">{r.tipo === 'danada' ? 'Dañada' : r.tipo === 'perdida' ? 'Perdida' : r.tipo === 'aduana_timeout' ? 'Aduana' : 'Otro'}</Badge>
                    </div>
                    <div className="text-xs text-slate-600">
                      Envío:{' '}
                      <span className="font-mono text-teal-700">{r.envioNumero}</span>
                      {r.ordenCompraNumero && (
                        <>
                          {' · '}OC:{' '}
                          <span className="font-mono text-teal-700">{r.ordenCompraNumero}</span>
                        </>
                      )}
                      {' · '}
                      {r.cantidadUnidades} unidad{r.cantidadUnidades !== 1 ? 'es' : ''}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Creado {formatDate(r.fechaCreacion)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[10px] text-slate-500">Reclamado</div>
                    <div className="text-base font-bold text-slate-900 tabular-nums">
                      S/ {r.montoReclamadoPEN.toFixed(2)}
                    </div>
                    {r.estado === 'cobrado' && r.montoCobradoPEN && (
                      <div className="text-[10px] text-emerald-700 font-medium mt-0.5 tabular-nums">
                        Cobrado S/ {r.montoCobradoPEN.toFixed(2)}
                      </div>
                    )}
                    {onAbrirReclamo && (
                      <ExternalLink className="w-3 h-3 text-slate-400 inline-block mt-1" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
