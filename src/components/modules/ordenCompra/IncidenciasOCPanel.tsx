import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Check, X, AlertCircle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../common';
import { cn } from '../../../design-system';
import { useHorizontalScrollFade } from '../../../hooks/useHorizontalScrollFade';
import { incidenciaOCService } from '../../../services/incidenciaOC.service';
import {
  TIPO_INCIDENCIA_OC_META,
  ESTADO_INCIDENCIA_OC_META,
  TIPO_ACCION_META,
  type IncidenciaOC,
  type TipoIncidenciaOC,
  type EstadoIncidenciaOC,
  type TipoAccionIncidenciaOC,
  type NuevaIncidenciaOCInput,
} from '../../../types/incidenciaOC.types';
import type { OrdenCompra } from '../../../types/ordenCompra.types';
import { formatFecha } from '../../../utils/dateFormatters';
import { useAuthStore } from '../../../store/authStore';
import { UserName } from '../../../pages/Envios/UserName';

/**
 * S54 · Tanda 2 — Panel de Incidencias dentro del detalle de OC.
 *
 * Funcionalidades:
 * - Sub-filtros por tipo (Todas / Recepción / Facturación / Proveedor / Logística / Impuestos / Compliance)
 * - Filtros por estado (Abiertas / En gestión / Resueltas / Escaladas)
 * - CTA "Nueva incidencia" con modal inline
 * - Cada incidencia: estado, tipo, título, impacto, contexto, acciones tomadas
 * - CTAs por incidencia: agregar acción, cambiar estado, resolver
 */

interface IncidenciasOCPanelProps {
  orden: OrdenCompra;
}

type FiltroTipo = 'todas' | TipoIncidenciaOC;
type FiltroEstado = 'todos' | EstadoIncidenciaOC;

export const IncidenciasOCPanel: React.FC<IncidenciasOCPanelProps> = ({ orden }) => {
  const { user } = useAuthStore();
  const [incidencias, setIncidencias] = useState<IncidenciaOC[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todas');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // S54 — Fade + flechas para scroll horizontal de los sub-tabs por tipo.
  const {
    ref: subtabsRef,
    fadeClass: subtabsFade,
    canScrollLeft: subtabsCanLeft,
    canScrollRight: subtabsCanRight,
    scrollPrev: subtabsScrollPrev,
    scrollNext: subtabsScrollNext,
  } = useHorizontalScrollFade<HTMLDivElement>();

  // ─── Subscribe a Firestore ──────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    const unsub = incidenciaOCService.subscribeByOC(orden.id, (items) => {
      setIncidencias(items);
      setLoading(false);
    });
    return unsub;
  }, [orden.id]);

  // ─── Contadores para los badges ────────────────────────────────────────
  const contadores = useMemo(() => {
    const porTipo: Record<string, number> = { todas: incidencias.length };
    const porEstado: Record<string, number> = { todos: incidencias.length };
    for (const i of incidencias) {
      porTipo[i.tipo] = (porTipo[i.tipo] || 0) + 1;
      porEstado[i.estado] = (porEstado[i.estado] || 0) + 1;
    }
    return { porTipo, porEstado };
  }, [incidencias]);

  // ─── Filtrar ──────────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    return incidencias.filter((i) => {
      if (filtroTipo !== 'todas' && i.tipo !== filtroTipo) return false;
      if (filtroEstado !== 'todos' && i.estado !== filtroEstado) return false;
      return true;
    });
  }, [incidencias, filtroTipo, filtroEstado]);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleCrear = async (input: NuevaIncidenciaOCInput) => {
    if (!user) return;
    await incidenciaOCService.crear(input, user.uid, user.displayName || user.email || undefined);
    setFormOpen(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────
  if (loading) {
    return <div className="p-6 text-center text-xs text-slate-500">Cargando incidencias…</div>;
  }

  return (
    <div className="space-y-3">
      {/* Sub-tabs por tipo — S54: scrollbar oculto + fade + flechas */}
      <div className="relative max-w-full">
        {subtabsCanLeft && (
          <button
            type="button"
            onClick={subtabsScrollPrev}
            aria-label="Desplazar sub-tabs a la izquierda"
            className="absolute -left-1 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 hover:border-slate-300 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        )}
        {subtabsCanRight && (
          <button
            type="button"
            onClick={subtabsScrollNext}
            aria-label="Desplazar sub-tabs a la derecha"
            className="absolute -right-1 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 hover:border-slate-300 text-slate-600 transition-colors"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
        <div
          ref={subtabsRef}
          className={cn(
            'flex gap-1 bg-slate-100 rounded-lg p-1 w-fit max-w-full overflow-x-auto scrollbar-hide',
            subtabsFade
          )}
        >
          <SubTabBtn
            active={filtroTipo === 'todas'}
            onClick={() => setFiltroTipo('todas')}
            label="Todas"
            count={contadores.porTipo.todas}
          />
          {(Object.keys(TIPO_INCIDENCIA_OC_META) as TipoIncidenciaOC[]).map((tipo) => {
            const meta = TIPO_INCIDENCIA_OC_META[tipo];
            return (
              <SubTabBtn
                key={tipo}
                active={filtroTipo === tipo}
                onClick={() => setFiltroTipo(tipo)}
                label={`${meta.emoji} ${meta.label}`}
                count={contadores.porTipo[tipo] || 0}
              />
            );
          })}
        </div>
      </div>

      {/* Filtros por estado + CTA */}
      <div className="flex gap-2 items-center text-xs flex-wrap">
        <span className="text-slate-500">Estado:</span>
        <EstadoPill
          active={filtroEstado === 'todos'}
          onClick={() => setFiltroEstado('todos')}
          label="Todos"
          count={contadores.porEstado.todos}
          variant="slate"
        />
        {(Object.keys(ESTADO_INCIDENCIA_OC_META) as EstadoIncidenciaOC[]).map((est) => {
          const meta = ESTADO_INCIDENCIA_OC_META[est];
          const count = contadores.porEstado[est] || 0;
          if (count === 0 && filtroEstado !== est) return null;
          return (
            <EstadoPill
              key={est}
              active={filtroEstado === est}
              onClick={() => setFiltroEstado(est)}
              label={meta.label}
              count={count}
              variant={est}
            />
          );
        })}
        <button
          onClick={() => setFormOpen(true)}
          className="ml-auto inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva incidencia
        </button>
      </div>

      {/* Formulario inline (modal simple) */}
      {formOpen && (
        <NuevaIncidenciaForm
          orden={orden}
          onCancel={() => setFormOpen(false)}
          onSubmit={handleCrear}
        />
      )}

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Check className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Sin incidencias</h3>
          <p className="text-xs text-slate-500">
            {incidencias.length === 0
              ? 'Esta OC no tiene incidencias registradas.'
              : 'Ninguna incidencia coincide con los filtros aplicados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map((inc) => (
            <IncidenciaRow
              key={inc.id}
              incidencia={inc}
              expanded={expandedId === inc.id}
              onToggle={() => setExpandedId(expandedId === inc.id ? null : inc.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes internos
// ─────────────────────────────────────────────────────────────────────────────

const SubTabBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}> = ({ active, onClick, label, count }) => (
  <button
    onClick={onClick}
    className={cn(
      'text-xs px-3 py-1.5 rounded font-medium whitespace-nowrap transition-colors',
      active
        ? 'bg-white shadow-sm text-slate-900'
        : 'text-slate-600 hover:bg-white/50'
    )}
  >
    {label}
    {count > 0 && (
      <span
        className={cn(
          'ml-1 text-[10px]',
          active ? 'text-slate-500' : 'text-slate-400'
        )}
      >
        ({count})
      </span>
    )}
  </button>
);

const EstadoPill: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  variant: 'slate' | EstadoIncidenciaOC;
}> = ({ active, onClick, label, count, variant }) => {
  const classes =
    variant === 'slate'
      ? active
        ? 'bg-slate-200 text-slate-800'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      : active
        ? ESTADO_INCIDENCIA_OC_META[variant].colorClass.replace('100', '200')
        : ESTADO_INCIDENCIA_OC_META[variant].colorClass;
  return (
    <button onClick={onClick} className={cn('px-2 py-0.5 rounded-full font-medium text-xs', classes)}>
      {label} ({count})
    </button>
  );
};

const IncidenciaRow: React.FC<{
  incidencia: IncidenciaOC;
  expanded: boolean;
  onToggle: () => void;
}> = ({ incidencia, expanded, onToggle }) => {
  const tipoMeta = TIPO_INCIDENCIA_OC_META[incidencia.tipo];
  const estadoMeta = ESTADO_INCIDENCIA_OC_META[incidencia.estado];
  const { user } = useAuthStore();
  const [addingAction, setAddingAction] = useState(false);
  const [resolving, setResolving] = useState(false);

  const borderColor =
    incidencia.estado === 'abierta'
      ? 'border-red-200 bg-red-50/40'
      : incidencia.estado === 'en_gestion'
        ? 'border-amber-200 bg-amber-50/40'
        : incidencia.estado === 'escalada'
          ? 'border-purple-200 bg-purple-50/40'
          : 'border-emerald-200 bg-emerald-50/40';

  return (
    <div className={cn('rounded-lg border', borderColor)}>
      {/* Header de la fila */}
      <div className="p-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-bold uppercase', estadoMeta.colorClass)}>
              {estadoMeta.label}
            </span>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', tipoMeta.colorClass)}>
              {tipoMeta.emoji} {tipoMeta.label}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">{incidencia.numero}</span>
          </div>
          <div className="text-sm font-semibold text-slate-900">{incidencia.titulo}</div>
          {incidencia.descripcion && (
            <div className="text-[11px] text-slate-600 mt-1">{incidencia.descripcion}</div>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500 flex-wrap">
            {incidencia.impactoEstimadoUSD !== undefined && (
              <span>
                Impacto: <b className="text-red-600">${incidencia.impactoEstimadoUSD.toFixed(2)}</b>
              </span>
            )}
            {incidencia.envioNumero && <span>Envío: {incidencia.envioNumero}</span>}
            {incidencia.productoSku && (
              <span>
                SKU: {incidencia.productoSku}
                {incidencia.cantidad !== undefined && ` · ${incidencia.cantidad}u`}
              </span>
            )}
            {incidencia.lote && <span>Lote: {incidencia.lote}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="text-[10px] text-slate-500">
            {incidencia.fechaCreacion ? formatFecha(incidencia.fechaCreacion) : ''}
          </div>
          <button
            onClick={onToggle}
            className="text-slate-500 hover:text-slate-700 p-1 -mr-1"
            aria-label="Expandir"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expandido */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-200/70 pt-3">
          {/* Acciones registradas */}
          {(incidencia.acciones || []).length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase text-slate-500 mb-1">
                Acciones ({incidencia.acciones?.length})
              </div>
              <div className="space-y-1">
                {incidencia.acciones!.map((acc) => {
                  const accMeta = TIPO_ACCION_META[acc.tipo];
                  return (
                    <div
                      key={acc.id}
                      className="flex items-start gap-2 p-2 bg-white/70 rounded border border-slate-100 text-xs"
                    >
                      <span className="text-base">{accMeta.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-semibold">{accMeta.label}</span>
                          {acc.referencia && (
                            <span className="text-[10px] font-mono text-slate-500">· {acc.referencia}</span>
                          )}
                          {acc.montoUSD !== undefined && (
                            <span className="text-[10px] text-teal-700 font-semibold">
                              · ${acc.montoUSD.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600 mt-0.5">{acc.descripcion}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {acc.usuarioNombre ? acc.usuarioNombre : <UserName userId={acc.usuario} />} ·{' '}
                          {acc.fecha ? formatFecha(acc.fecha) : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resolución si está resuelta */}
          {incidencia.estado === 'resuelta' && incidencia.resolucion && (
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-xs">
              <div className="text-[10px] font-semibold uppercase text-emerald-700 mb-0.5">
                Resolución
              </div>
              <div className="text-slate-700">{incidencia.resolucion}</div>
              {incidencia.impactoRealUSD !== undefined && (
                <div className="text-[10px] mt-1">
                  Impacto real: <b>${incidencia.impactoRealUSD.toFixed(2)}</b>
                </div>
              )}
            </div>
          )}

          {/* CTAs */}
          {incidencia.estado !== 'resuelta' && user && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setAddingAction(true)}
                className="text-[11px] px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50"
              >
                + Agregar acción
              </button>
              {incidencia.estado === 'abierta' && (
                <button
                  onClick={() => incidenciaOCService.actualizarEstado(incidencia.id, 'en_gestion')}
                  className="text-[11px] px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700"
                >
                  → Marcar en gestión
                </button>
              )}
              {incidencia.estado === 'en_gestion' && (
                <button
                  onClick={() =>
                    incidenciaOCService.actualizarEstado(incidencia.id, 'escalada')
                  }
                  className="text-[11px] px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  ↑ Escalar
                </button>
              )}
              <button
                onClick={() => setResolving(true)}
                className="text-[11px] px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
              >
                ✓ Resolver
              </button>
            </div>
          )}

          {/* Form agregar acción */}
          {addingAction && user && (
            <AgregarAccionForm
              onCancel={() => setAddingAction(false)}
              onSubmit={async (input) => {
                await incidenciaOCService.agregarAccion(
                  incidencia.id,
                  input,
                  user.uid,
                  user.displayName || user.email || undefined
                );
                if (incidencia.estado === 'abierta') {
                  await incidenciaOCService.actualizarEstado(incidencia.id, 'en_gestion');
                }
                setAddingAction(false);
              }}
            />
          )}

          {/* Form resolver */}
          {resolving && user && (
            <ResolverForm
              onCancel={() => setResolving(false)}
              onSubmit={async (resolucion, impactoReal) => {
                await incidenciaOCService.resolver(
                  incidencia.id,
                  resolucion,
                  user.uid,
                  user.displayName || user.email || undefined,
                  impactoReal
                );
                setResolving(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Forms inline
// ─────────────────────────────────────────────────────────────────────────────

const NuevaIncidenciaForm: React.FC<{
  orden: OrdenCompra;
  onCancel: () => void;
  onSubmit: (input: NuevaIncidenciaOCInput) => void | Promise<void>;
}> = ({ orden, onCancel, onSubmit }) => {
  const [tipo, setTipo] = useState<TipoIncidenciaOC>('recepcion');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [impacto, setImpacto] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const puedeGuardar = titulo.trim().length > 3;

  const handleSubmit = async () => {
    if (!puedeGuardar) return;
    setSaving(true);
    try {
      await onSubmit({
        ocId: orden.id,
        ocNumero: orden.numeroOrden,
        proveedorId: orden.proveedorId,
        proveedorNombre: orden.nombreProveedor,
        tipo,
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        impactoEstimadoUSD: impacto ? Number(impacto) : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 border border-teal-300 bg-teal-50/50 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-teal-900">Nueva incidencia</span>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-700">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase text-slate-500 font-semibold">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoIncidenciaOC)}
            className="w-full text-sm border border-slate-300 rounded px-2 py-1 mt-0.5"
          >
            {(Object.keys(TIPO_INCIDENCIA_OC_META) as TipoIncidenciaOC[]).map((t) => (
              <option key={t} value={t}>
                {TIPO_INCIDENCIA_OC_META[t].emoji} {TIPO_INCIDENCIA_OC_META[t].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase text-slate-500 font-semibold">
            Impacto estimado USD (opcional)
          </label>
          <input
            type="number"
            value={impacto}
            onChange={(e) => setImpacto(e.target.value)}
            placeholder="0.00"
            className="w-full text-sm border border-slate-300 rounded px-2 py-1 mt-0.5"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] uppercase text-slate-500 font-semibold">Título</label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ej: 2 unidades de Ashwagandha dañadas en recepción"
          className="w-full text-sm border border-slate-300 rounded px-2 py-1 mt-0.5"
          maxLength={120}
        />
      </div>
      <div>
        <label className="text-[10px] uppercase text-slate-500 font-semibold">
          Descripción (opcional)
        </label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          className="w-full text-sm border border-slate-300 rounded px-2 py-1 mt-0.5"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!puedeGuardar || saving}>
          {saving ? 'Creando…' : 'Crear incidencia'}
        </Button>
      </div>
    </div>
  );
};

const AgregarAccionForm: React.FC<{
  onCancel: () => void;
  onSubmit: (input: {
    tipo: TipoAccionIncidenciaOC;
    descripcion: string;
    montoUSD?: number;
    referencia?: string;
  }) => void | Promise<void>;
}> = ({ onCancel, onSubmit }) => {
  const [tipo, setTipo] = useState<TipoAccionIncidenciaOC>('nota');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [saving, setSaving] = useState(false);

  const puedeGuardar = descripcion.trim().length > 0;

  const handle = async () => {
    if (!puedeGuardar) return;
    setSaving(true);
    try {
      await onSubmit({
        tipo,
        descripcion: descripcion.trim(),
        montoUSD: monto ? Number(monto) : undefined,
        referencia: referencia.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-2 bg-white border border-slate-300 rounded space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] uppercase text-slate-500 font-semibold">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoAccionIncidenciaOC)}
            className="w-full text-xs border border-slate-300 rounded px-1 py-1 mt-0.5"
          >
            {(Object.keys(TIPO_ACCION_META) as TipoAccionIncidenciaOC[]).map((t) => (
              <option key={t} value={t}>
                {TIPO_ACCION_META[t].emoji} {TIPO_ACCION_META[t].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase text-slate-500 font-semibold">Monto USD</label>
          <input
            type="number"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0.00"
            className="w-full text-xs border border-slate-300 rounded px-1 py-1 mt-0.5"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-slate-500 font-semibold">Referencia</label>
          <input
            type="text"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="NC-001 / email ref"
            className="w-full text-xs border border-slate-300 rounded px-1 py-1 mt-0.5 font-mono"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] uppercase text-slate-500 font-semibold">Descripción</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          className="w-full text-xs border border-slate-300 rounded px-1 py-1 mt-0.5"
          placeholder="Ej: Se envió email al proveedor solicitando NC por $32.76"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs px-2 py-1 text-slate-600 hover:bg-slate-100 rounded">
          Cancelar
        </button>
        <button
          onClick={handle}
          disabled={!puedeGuardar || saving}
          className="text-xs px-2 py-1 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Agregar'}
        </button>
      </div>
    </div>
  );
};

const ResolverForm: React.FC<{
  onCancel: () => void;
  onSubmit: (resolucion: string, impactoReal?: number) => void | Promise<void>;
}> = ({ onCancel, onSubmit }) => {
  const [resolucion, setResolucion] = useState('');
  const [impacto, setImpacto] = useState('');
  const [saving, setSaving] = useState(false);

  const puedeGuardar = resolucion.trim().length > 3;

  const handle = async () => {
    if (!puedeGuardar) return;
    setSaving(true);
    try {
      await onSubmit(resolucion.trim(), impacto ? Number(impacto) : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-2 bg-emerald-50 border border-emerald-300 rounded space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-900">
        <AlertCircle className="w-3 h-3" />
        Resolver incidencia
      </div>
      <div>
        <label className="text-[10px] uppercase text-slate-500 font-semibold">Resumen de resolución</label>
        <textarea
          value={resolucion}
          onChange={(e) => setResolucion(e.target.value)}
          rows={2}
          className="w-full text-xs border border-slate-300 rounded px-1 py-1 mt-0.5"
          placeholder="Ej: Proveedor emitió NC por $30, descuento aplicado en próxima OC"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase text-slate-500 font-semibold">
          Impacto real USD (opcional)
        </label>
        <input
          type="number"
          value={impacto}
          onChange={(e) => setImpacto(e.target.value)}
          placeholder="0.00"
          className="w-full text-xs border border-slate-300 rounded px-1 py-1 mt-0.5"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs px-2 py-1 text-slate-600 hover:bg-slate-100 rounded">
          Cancelar
        </button>
        <button
          onClick={handle}
          disabled={!puedeGuardar || saving}
          className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? 'Resolviendo…' : '✓ Marcar resuelta'}
        </button>
      </div>
    </div>
  );
};
