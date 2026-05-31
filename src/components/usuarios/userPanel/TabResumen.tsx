/**
 * TabResumen.tsx · chk5.PERSONAS-v5.7 · E3.2 (2026-05-28)
 *
 * Tab Resumen del UserPanel · vista 360 de una persona.
 * Contiene:
 *   1. KPIs rápidos por tipo de relación vigente
 *   2. Banner contextual de próximos pasos (si aplica)
 *   3. Cross-links a módulos operativos (Planilla · Inversionistas)
 *   4. Estado de cuenta del sistema (acceso · sesiones · estado)
 *
 * Aplicación de canons:
 *   - N1 · color semántico por KPI
 *   - N2 · cards KPI con gradient sutil + ring
 *   - N4 · color cross-módulo consistente
 *   - N8 · cross-link card siempre visible (con empty state si no aplica)
 */

import React from 'react';
import {
  Briefcase,
  FileText,
  Handshake,
  User,
  ExternalLink,
  Mail,
  Phone,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '../../../types/auth.types';
import { getUserEstado, ESTADO_LABELS, ESTADO_COLORS } from '../../../types/auth.types';
import type { RelacionLaboral } from '../../../types/relacionLaboral.types';
import {
  getRelacionesActivas,
  TIPO_RELACION_LABELS,
  TIPO_RELACION_ICONS,
  TIPO_RELACION_COLORS,
  tieneRelacionVigente,
} from '../../../types/relacionLaboral.types';

interface TabResumenProps {
  user: UserProfile;
  relaciones: RelacionLaboral[];
  /** Callback opcional · módulo padre cierra el panel después de navegar */
  onAfterNavigate?: () => void;
}

/**
 * Helper · formatea timestamp a "hace X días" relativo simple.
 */
function fechaRelativa(timestamp: { toMillis?: () => number } | undefined | null): string {
  if (!timestamp || !timestamp.toMillis) return '—';
  const ms = timestamp.toMillis();
  const diff = Date.now() - ms;
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 30) return `Hace ${dias}d`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `Hace ${meses}m`;
  const anios = Math.floor(meses / 12);
  return `Hace ${anios}a${anios > 1 ? '' : ''}`;
}

function fmtMoneda(monto: number | undefined, moneda: 'PEN' | 'USD' | undefined): string {
  if (monto === undefined || monto === null) return '—';
  const simbolo = moneda === 'USD' ? '$' : 'S/';
  return `${simbolo}${monto.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
}

export const TabResumen: React.FC<TabResumenProps> = ({ user, relaciones, onAfterNavigate }) => {
  const navigate = useNavigate();
  const activas = getRelacionesActivas(relaciones);
  const estado = getUserEstado(user);
  const colorsEstado = ESTADO_COLORS[estado];

  // Detección de relaciones por tipo para cross-links
  const tieneEmpleado = tieneRelacionVigente(activas, 'empleado');
  const tieneSocio = tieneRelacionVigente(activas, 'socio');
  const tieneHonorarios = tieneRelacionVigente(activas, 'honorarios');
  const tieneExterno = tieneRelacionVigente(activas, 'externo');

  // Banner próximos pasos · sugerencias contextuales
  const sugerencias: string[] = [];
  if (activas.length === 0) {
    sugerencias.push('Este usuario aún no tiene relaciones vigentes · agregá la primera desde el tab Relaciones.');
  }
  if (tieneEmpleado && !tieneSocio && activas.length === 1) {
    // Sugerencia common · empleado puede ser también socio
    sugerencias.push('¿Es también socio del negocio? Podés agregar una 2ª relación tipo socio.');
  }
  if (estado === 'invitado_no_registrado') {
    sugerencias.push('La invitación está enviada · el usuario debe completar el registro desde el email.');
  }
  if (estado === 'pendiente_aprobacion') {
    sugerencias.push('Hay una cuenta pendiente de aprobación · revisá el tab Permisos para aprobarla.');
  }

  const handleNav = (path: string) => {
    onAfterNavigate?.();
    navigate(path);
  };

  return (
    <div className="p-5 space-y-4">
      {/* ═══ Stats rápidos ═══ */}
      <div className="grid grid-cols-2 gap-2">
        {/* Estado del usuario */}
        <div className={`${colorsEstado.bg} ${colorsEstado.text} ring-1 ${colorsEstado.border} rounded-2xl p-3`}>
          <div className="flex items-center gap-1.5 mb-1">
            {estado === 'activo' ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : estado === 'pendiente_aprobacion' || estado === 'invitado_no_registrado' ? (
              <Clock className="w-3.5 h-3.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" />
            )}
            <span className="text-[10px] uppercase tracking-wider font-bold">ESTADO</span>
          </div>
          <div className="text-sm font-bold">{ESTADO_LABELS[estado]}</div>
          <div className="text-[10px] opacity-80 mt-0.5">
            {user.ultimaConexion ? `Últ. conexión ${fechaRelativa(user.ultimaConexion)}` : 'Sin conexiones aún'}
          </div>
        </div>

        {/* # relaciones */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/40 ring-1 ring-slate-200/50 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Briefcase className="w-3.5 h-3.5 text-slate-700" />
            <span className="text-[10px] uppercase tracking-wider text-slate-700 font-bold">RELACIONES</span>
          </div>
          <div className="text-sm font-bold text-slate-900">
            <span className="tabular-nums">{activas.length}</span> vigente{activas.length !== 1 ? 's' : ''}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {activas.length > 1
              ? `${activas.length} tipos simultáneos`
              : activas.length === 1
                ? TIPO_RELACION_LABELS[activas[0].tipo]
                : 'Sin relaciones vigentes'}
          </div>
        </div>
      </div>

      {/* ═══ Detalle por relación vigente · 1 card por relación ═══ */}
      {activas.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700">Relaciones vigentes</div>
          {activas.map((r) => {
            const colors = TIPO_RELACION_COLORS[r.tipo];
            return (
              <div
                key={r.id}
                className={`${colors.bg} ring-1 ${colors.ring} rounded-xl p-3 flex items-start gap-3`}
              >
                <div className="text-2xl flex-shrink-0">{TIPO_RELACION_ICONS[r.tipo]}</div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-bold ${colors.text}`}>
                    {TIPO_RELACION_LABELS[r.tipo]}
                    {r.cargoDisplay && <span className="font-normal opacity-80"> · {r.cargoDisplay}</span>}
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5 grid grid-cols-2 gap-x-3">
                    {r.montoMensualReferencia !== undefined && r.montoMensualReferencia > 0 && (
                      <div>
                        <span className="opacity-70">
                          {r.tipo === 'empleado' ? 'Sueldo:' : r.tipo === 'honorarios' ? 'Tarifa:' : 'Monto:'}
                        </span>{' '}
                        <strong className="tabular-nums">{fmtMoneda(r.montoMensualReferencia, r.monedaReferencia)}</strong>
                      </div>
                    )}
                    <div>
                      <span className="opacity-70">Desde:</span>{' '}
                      <strong>{fechaRelativa(r.fechaInicio)}</strong>
                    </div>
                  </div>
                  {r.estado === 'pausada' && (
                    <div className="text-[10px] mt-1 inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                      ⏸ Pausada
                    </div>
                  )}
                  {r.estado === 'prueba' && (
                    <div className="text-[10px] mt-1 inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full font-bold">
                      🧪 En prueba
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Banner próximos pasos · solo si hay sugerencias ═══ */}
      {sugerencias.length > 0 && (
        <div className="bg-amber-50 ring-1 ring-amber-200 rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-wider font-bold text-amber-700 mb-2">
            Próximos pasos sugeridos
          </div>
          <ul className="space-y-1 text-xs text-amber-900">
            {sugerencias.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-amber-600 flex-shrink-0">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ═══ Cross-links a módulos operativos ═══ */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700">
          Ver en módulos operativos
        </div>

        {tieneEmpleado && (
          <button
            onClick={() => handleNav(`/planilla?empleado=${user.uid}`)}
            className="w-full text-left bg-white ring-1 ring-teal-200 hover:bg-teal-50/50 rounded-xl p-3 flex items-center gap-3 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-4 h-4 text-teal-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900">Ver en Planilla</div>
              <div className="text-[11px] text-slate-500">Boletas · pagos · incentivos · vacaciones</div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-teal-700 flex-shrink-0" />
          </button>
        )}

        {tieneSocio && (
          <button
            onClick={() => handleNav(`/inversionistas?socio=${user.uid}`)}
            className="w-full text-left bg-white ring-1 ring-violet-200 hover:bg-violet-50/50 rounded-xl p-3 flex items-center gap-3 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
              <Handshake className="w-4 h-4 text-violet-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900">Ver en Inversionistas</div>
              <div className="text-[11px] text-slate-500">Cap table · distribuciones · aportes</div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-violet-700 flex-shrink-0" />
          </button>
        )}

        {tieneHonorarios && (
          <div className="w-full bg-slate-50 ring-1 ring-dashed ring-slate-300 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-sky-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-700">Honorarios · próximamente</div>
              <div className="text-[11px] text-slate-500">Recibos · retenciones 4ta · pagos pendientes</div>
            </div>
          </div>
        )}

        {tieneExterno && (
          <div className="w-full bg-amber-50/50 ring-1 ring-amber-200 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900">Es externo</div>
              <div className="text-[11px] text-slate-600">Ver tab Vinculación para detalles del Maestro vinculado.</div>
            </div>
          </div>
        )}

        {/* Empty state si no tiene ninguna relación · canon N8 cross-link siempre visible */}
        {activas.length === 0 && (
          <div className="bg-slate-50 ring-1 ring-dashed ring-slate-300 rounded-xl p-4 text-center text-xs text-slate-600">
            Cuando agregues una relación a este usuario, acá verás los cross-links a Planilla,
            Inversionistas u Honorarios según corresponda.
          </div>
        )}
      </div>

      {/* ═══ Contacto rápido ═══ */}
      {(user.email || user.telefono) && (
        <div className="bg-slate-50 ring-1 ring-slate-200 rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2">Contacto</div>
          <div className="space-y-1 text-xs">
            {user.email && (
              <a
                href={`mailto:${user.email}`}
                className="flex items-center gap-2 text-slate-700 hover:text-teal-700 transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{user.email}</span>
              </a>
            )}
            {user.telefono && (
              <a
                href={`tel:${user.telefono}`}
                className="flex items-center gap-2 text-slate-700 hover:text-teal-700 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span className="tabular-nums">{user.telefono}</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TabResumen;
