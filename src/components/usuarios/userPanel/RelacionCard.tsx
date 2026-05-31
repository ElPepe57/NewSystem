/**
 * RelacionCard.tsx · chk5.PERSONAS-v5.6 · E3.3 (2026-05-28)
 *
 * Card visual para una RelacionLaboral · usado en el tab Relaciones del UserPanel.
 *
 * Estados visuales:
 *   - VIGENTE/PRUEBA: fondo full color (teal/sky/violet/amber) · acciones disponibles
 *   - PAUSADA: fondo con opacity reducida + badge amber · acción "Reanudar"
 *   - FINALIZADA: fondo gris + opacity 60% + badge rose · solo lectura (snapshot)
 *
 * Acciones (callbacks · UI sin lógica · E5 conecta modales reales):
 *   onEditar · cambiar cargo/salario/notas
 *   onPausar · vigente → pausada
 *   onReanudar · pausada → vigente
 *   onReclasificar · transición atómica honorarios → empleado · etc
 *   onFinalizar · vigente/pausada → finalizada (snapshot inmutable)
 *
 * Card NO finalizada · CON entidadMaestroRef (v5.8) → muestra chip "Vinculado a {Maestro}"
 *   con link a tab Vinculación.
 */

import React from 'react';
import {
  Edit2,
  Pause,
  Play,
  RefreshCw,
  Square,
  Link as LinkIcon,
  ChevronRight,
  Building2,
} from 'lucide-react';
import type { RelacionLaboral } from '../../../types/relacionLaboral.types';
import {
  TIPO_RELACION_LABELS,
  TIPO_RELACION_ICONS,
  TIPO_RELACION_COLORS,
  ESTADO_RELACION_LABELS,
  ESTADO_RELACION_COLORS,
  MOTIVO_FIN_LABELS,
} from '../../../types/relacionLaboral.types';

interface RelacionCardProps {
  relacion: RelacionLaboral;
  /** Acciones · si undefined la acción NO aparece (lectura) */
  onEditar?: (r: RelacionLaboral) => void;
  onPausar?: (r: RelacionLaboral) => void;
  onReanudar?: (r: RelacionLaboral) => void;
  onReclasificar?: (r: RelacionLaboral) => void;
  onFinalizar?: (r: RelacionLaboral) => void;
  /** Click en chip de Maestro vinculado · navega a tab Vinculación */
  onVerVinculacion?: (r: RelacionLaboral) => void;
}

function fmtFecha(ts: { toMillis?: () => number; toDate?: () => Date } | undefined | null): string {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts.toMillis?.() ?? 0);
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMoneda(monto: number | undefined, moneda: 'PEN' | 'USD' | undefined): string {
  if (monto === undefined || monto === null) return '—';
  const simbolo = moneda === 'USD' ? '$' : 'S/';
  return `${simbolo}${monto.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
}

/**
 * Chip de línea de negocio · chk5-LINEAS.
 * Muestra el nombre + color de la línea desde el snapshot desnormalizado.
 * Si no hay línea (compartido / empresa global) NO renderiza nada (es el default).
 */
const LineaChip: React.FC<{ relacion: RelacionLaboral }> = ({ relacion: r }) => {
  const snap = r.lineaNegocioSnapshot;
  if (!snap) return null; // compartido · sin chip (default)
  const color = snap.lineaNegocioColor || '#94a3b8';
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ring-1"
      style={{ backgroundColor: `${color}1a`, color, borderColor: `${color}55` }}
      title={`Línea de negocio: ${snap.lineaNegocioNombre}`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {snap.lineaNegocioNombre}
    </span>
  );
};

function diasEntre(inicio: { toMillis: () => number } | undefined, fin?: { toMillis: () => number } | null): string {
  if (!inicio) return '—';
  const inicioMs = inicio.toMillis();
  const finMs = fin?.toMillis?.() ?? Date.now();
  const dias = Math.floor((finMs - inicioMs) / (1000 * 60 * 60 * 24));
  if (dias < 30) return `${dias}d`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `${meses}m`;
  const anios = Math.floor(meses / 12);
  const mesesRestantes = meses % 12;
  return mesesRestantes > 0 ? `${anios}a ${mesesRestantes}m` : `${anios}a`;
}

export const RelacionCard: React.FC<RelacionCardProps> = ({
  relacion: r,
  onEditar,
  onPausar,
  onReanudar,
  onReclasificar,
  onFinalizar,
  onVerVinculacion,
}) => {
  const colors = TIPO_RELACION_COLORS[r.tipo];
  const isFinalizada = r.estado === 'finalizada';
  const isPausada = r.estado === 'pausada';
  const isEditable = r.estado === 'vigente' || r.estado === 'prueba';

  // Card finalizada · render simplificado + solo lectura
  if (isFinalizada) {
    return (
      <div className="bg-slate-50 ring-1 ring-slate-200 rounded-xl p-3 opacity-75">
        <div className="flex items-start gap-3">
          <div className="text-2xl flex-shrink-0 grayscale">{TIPO_RELACION_ICONS[r.tipo]}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-bold text-slate-700">
                {TIPO_RELACION_LABELS[r.tipo]}
                {r.cargoDisplay && <span className="font-normal opacity-80"> · {r.cargoDisplay}</span>}
              </span>
              <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full font-bold">
                FINALIZADA
              </span>
              {r.motivoFin && (
                <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">
                  {MOTIVO_FIN_LABELS[r.motivoFin]}
                </span>
              )}
              <LineaChip relacion={r} />
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {fmtFecha(r.fechaInicio)} → {fmtFecha(r.fechaFin)} · {diasEntre(r.fechaInicio, r.fechaFin)} de duración
            </div>
            {r.notaMotivoFin && (
              <div className="text-[11px] text-slate-600 mt-1 italic">"{r.notaMotivoFin}"</div>
            )}
            {/* Snapshot resumido si existe */}
            {r.datosLaboralesSnapshot && (
              <div className="text-[10px] text-slate-500 mt-1.5 bg-white rounded px-2 py-1">
                Snapshot al cerrar: {r.datosLaboralesSnapshot.cargo} ·{' '}
                {fmtMoneda(r.datosLaboralesSnapshot.salarioBruto, r.datosLaboralesSnapshot.monedaSalario)}
              </div>
            )}
            {r.datosSocioSnapshot && (
              <div className="text-[10px] text-slate-500 mt-1.5 bg-white rounded px-2 py-1">
                Snapshot al cerrar: {r.datosSocioSnapshot.porcentajeParticipacion}% participación ·{' '}
                {fmtMoneda(r.datosSocioSnapshot.aporteCapitalAcumulado, r.datosSocioSnapshot.monedaAporte)} aporte
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Card vigente/pausada/prueba · render completo con acciones
  return (
    <div
      className={`${colors.bg} ring-1 ${colors.ring} rounded-xl p-3 ${isPausada ? 'opacity-80' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">{TIPO_RELACION_ICONS[r.tipo]}</div>
        <div className="flex-1 min-w-0">
          {/* Header · tipo + cargo + estado */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-sm font-bold ${colors.text}`}>
              {TIPO_RELACION_LABELS[r.tipo]}
            </span>
            {r.cargoDisplay && (
              <span className={`text-sm font-normal ${colors.text} opacity-90`}>· {r.cargoDisplay}</span>
            )}
            <LineaChip relacion={r} />
            <span
              className={`text-[9px] ${ESTADO_RELACION_COLORS[r.estado].bg} ${ESTADO_RELACION_COLORS[r.estado].text} px-1.5 py-0.5 rounded-full font-bold ml-auto flex-shrink-0`}
            >
              {ESTADO_RELACION_LABELS[r.estado].toUpperCase()}
            </span>
          </div>

          {/* Datos clave grid */}
          <div className="text-[11px] mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
            {r.montoMensualReferencia !== undefined && r.montoMensualReferencia > 0 && (
              <div className={colors.text}>
                <span className="opacity-70">
                  {r.tipo === 'empleado' ? 'Sueldo:' : r.tipo === 'honorarios' ? 'Tarifa:' : 'Monto:'}
                </span>{' '}
                <strong className="tabular-nums">
                  {fmtMoneda(r.montoMensualReferencia, r.monedaReferencia)}
                </strong>
              </div>
            )}
            <div className={colors.text}>
              <span className="opacity-70">Desde:</span> <strong>{fmtFecha(r.fechaInicio)}</strong>
            </div>
            {r.subTipo && (
              <div className={colors.text}>
                <span className="opacity-70">Subtipo:</span>{' '}
                <strong className="capitalize">{r.subTipo.replace(/_/g, ' ')}</strong>
              </div>
            )}
            <div className={colors.text}>
              <span className="opacity-70">Antigüedad:</span>{' '}
              <strong className="tabular-nums">{diasEntre(r.fechaInicio)}</strong>
            </div>
          </div>

          {/* Chip Maestro vinculado · v5.8 */}
          {r.entidadMaestroRef && (
            <button
              type="button"
              onClick={() => onVerVinculacion?.(r)}
              className="mt-2 inline-flex items-center gap-1.5 text-[10px] bg-white/70 hover:bg-white px-2 py-1 rounded-full font-medium transition-colors group"
              title="Ver detalle de la vinculación"
            >
              <LinkIcon className="w-2.5 h-2.5 opacity-70" />
              <Building2 className="w-2.5 h-2.5" />
              <span className="text-slate-700">
                <strong>{r.entidadMaestroRef.nombreCachedSnapshot}</strong>
                {r.entidadMaestroRef.rolEnEntidad && (
                  <span className="opacity-70"> · {r.entidadMaestroRef.rolEnEntidad}</span>
                )}
              </span>
              <ChevronRight className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />
            </button>
          )}

          {/* Notas (preview · max 2 líneas) */}
          {r.notas && (
            <div className={`text-[11px] mt-1.5 italic line-clamp-2 ${colors.text} opacity-70`}>
              "{r.notas}"
            </div>
          )}

          {/* Acciones · solo si hay callbacks definidos */}
          {(onEditar || onPausar || onReanudar || onReclasificar || onFinalizar) && (
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              {isEditable && onEditar && (
                <button
                  onClick={() => onEditar(r)}
                  className="text-[10px] bg-white hover:bg-slate-50 border border-slate-200 px-2 py-1 rounded-md font-medium text-slate-700 inline-flex items-center gap-1"
                  title="Editar cargo · salario · notas"
                >
                  <Edit2 className="w-2.5 h-2.5" /> Editar
                </button>
              )}
              {isEditable && onPausar && (
                <button
                  onClick={() => onPausar(r)}
                  className="text-[10px] bg-white hover:bg-amber-50 border border-amber-200 px-2 py-1 rounded-md font-medium text-amber-700 inline-flex items-center gap-1"
                  title="Pausar (licencia · sabbatical)"
                >
                  <Pause className="w-2.5 h-2.5" /> Pausar
                </button>
              )}
              {isPausada && onReanudar && (
                <button
                  onClick={() => onReanudar(r)}
                  className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded-md font-semibold inline-flex items-center gap-1"
                  title="Reanudar relación pausada"
                >
                  <Play className="w-2.5 h-2.5" /> Reanudar
                </button>
              )}
              {isEditable && onReclasificar && (
                <button
                  onClick={() => onReclasificar(r)}
                  className="text-[10px] bg-white hover:bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-md font-medium text-indigo-700 inline-flex items-center gap-1"
                  title="Reclasificar a otro tipo (atómico)"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> Reclasificar
                </button>
              )}
              {(isEditable || isPausada) && onFinalizar && (
                <button
                  onClick={() => onFinalizar(r)}
                  className="text-[10px] bg-white hover:bg-rose-50 border border-rose-200 px-2 py-1 rounded-md font-medium text-rose-700 inline-flex items-center gap-1 ml-auto"
                  title="Finalizar relación (snapshot inmutable)"
                >
                  <Square className="w-2.5 h-2.5" /> Finalizar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RelacionCard;
