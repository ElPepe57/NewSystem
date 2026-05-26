/**
 * src/components/modules/usuarios/TabAccesos.tsx
 *
 * chk5.F4-USERS · chk5.PERSONAS-v5.4 · F10.B · 2026-05-26 (refactor canon)
 *
 * Tab "Accesos y Seguridad" del módulo /usuarios.
 * Pixel-perfect mockup usuarios-v5.3-tabs-completas.html · sección "Accesos".
 *
 * Estructura canon:
 *  - KPI strip rose · 4 cards (Sesiones · Intentos · IPs sospechosas · Eventos 7d)
 *  - Card acción emergencia rose · "Desconectar todas"
 *  - Grid 2 cols · Sesiones activas globales + Auditoría reciente
 *  - Card warning IPs sospechosas (condicional · si hay)
 *  - Cross-link Auditoría rose enriquecido
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  AlertTriangle,
  Monitor,
  Smartphone,
  ArrowRight,
  Loader,
  ShieldAlert,
  Activity,
  History,
  ShieldCheck,
} from 'lucide-react';
import { sesionService } from '../../../services/sesion.service';
import type { SesionActiva } from '../../../types/sesion.types';

interface Props {
  onRequestDisconnectAll: () => void;
}

/** Tiempo relativo simple */
function tiempoRel(fecha?: Date | { toDate: () => Date }): string {
  if (!fecha) return '—';
  const d = fecha instanceof Date ? fecha : fecha.toDate();
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'hace segundos';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD}d`;
}

export default function TabAccesos({ onRequestDisconnectAll }: Props) {
  const navigate = useNavigate();
  const [sesiones, setSesiones] = useState<SesionActiva[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Intenta cargar sesiones activas globales · si el service no tiene el método
        // (deuda menor del sistema de sesiones) · fallback a array vacío.
        const fn = (sesionService as { listActivasGlobal?: () => Promise<SesionActiva[]> }).listActivasGlobal;
        const data = fn ? await fn.call(sesionService) : [];
        if (cancelled) return;
        setSesiones(data);
      } catch (err) {
        console.error('[TabAccesos] error:', err);
        if (!cancelled) setSesiones([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Stats derivadas
  const sesionesActivas = sesiones.length;
  // TODO: integrar con auditService cuando esté disponible · por ahora null = placeholder
  const intentosFallidos: number | null = null;
  const ipsSospechosas: number | null = null;
  const eventos7d: number | null = null;

  // Slice de top sesiones para preview
  const sesionesPreview = sesiones.slice(0, 4);
  const sesionesExtras = Math.max(0, sesiones.length - 4);

  return (
    <div className="space-y-4">
      {/* §A · Header · canon rose */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-slate-900">Accesos y seguridad</h2>
            <p className="text-[11px] text-slate-500">
              Vista en vivo · sesiones · intentos · auditoría
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/auditoria')}
          className="bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-[12px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
        >
          Auditoría completa
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* §B · KPI strip · 4 cards canon mockup */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Sesiones activas · emerald */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">
              SESIONES ACTIVAS
            </span>
            <Monitor className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">
            {loading ? <Loader className="w-5 h-5 animate-spin inline" /> : sesionesActivas}
          </div>
          <div className="text-[10px] text-emerald-700 mt-1">conectados ahora</div>
        </div>

        {/* Intentos fallidos · amber */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">
              INTENTOS FALLIDOS 24H
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-900">
            {intentosFallidos !== null && intentosFallidos > 0 ? intentosFallidos : '—'}
          </div>
          <div className="text-[10px] text-amber-700 mt-1">
            {intentosFallidos !== null && intentosFallidos > 0 ? 'validar IPs' : 'sin data aún'}
          </div>
        </div>

        {/* IPs sospechosas · rose */}
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">
              IPS SOSPECHOSAS
            </span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-rose-900">
            {ipsSospechosas !== null && ipsSospechosas > 0 ? ipsSospechosas : '—'}
          </div>
          <div className="text-[10px] text-rose-700 mt-1">
            {ipsSospechosas !== null && ipsSospechosas > 0 ? 'geo-anómalas' : 'sin detecciones'}
          </div>
        </div>

        {/* Eventos 7d · sky */}
        <div className="bg-gradient-to-br from-sky-50 to-sky-100/40 ring-1 ring-sky-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-sky-700 font-bold">EVENTOS 7D</span>
            <Activity className="w-3.5 h-3.5 text-sky-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-sky-900">
            {eventos7d !== null && eventos7d > 0 ? eventos7d : '—'}
          </div>
          <div className="text-[10px] text-sky-700 mt-1">acciones registradas</div>
        </div>
      </div>

      {/* §C · Acción emergencia · canon rose card */}
      <div className="bg-gradient-to-r from-rose-50 to-pink-50 ring-1 ring-rose-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-5 h-5 text-rose-700" />
          </div>
          <div className="flex-1">
            <h3 className="text-[13px] font-bold text-slate-900 mb-1">
              Acción de emergencia · "Desconectar TODAS"
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Cierra todas las sesiones activas del sistema ({sesionesActivas} usuario
              {sesionesActivas === 1 ? '' : 's'}) · todos deben re-loguearse. Usar solo en caso
              de incidente de seguridad (compromise de credenciales · acceso no autorizado).
            </p>
          </div>
          <button
            type="button"
            onClick={onRequestDisconnectAll}
            className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0"
          >
            Desconectar todas
          </button>
        </div>
      </div>

      {/* §D · Grid 2 cols · Sesiones activas + Auditoría reciente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sesiones activas globales */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-emerald-600" />
              Sesiones activas globales
            </h3>
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">
              {sesionesActivas} activa{sesionesActivas === 1 ? '' : 's'}
            </span>
          </div>
          {loading ? (
            <div className="text-center py-4 text-[11px] text-slate-500">
              <Loader className="w-4 h-4 animate-spin mx-auto mb-1" />
              Cargando sesiones...
            </div>
          ) : sesionesPreview.length === 0 ? (
            <div className="text-center py-4 text-[11px] text-slate-500">
              <Monitor className="w-6 h-6 mx-auto mb-1 text-slate-300" />
              Sin sesiones activas detectadas
            </div>
          ) : (
            <div className="space-y-2 text-[11px]">
              {sesionesPreview.map((s, i) => {
                const ua = s.userAgent?.toLowerCase?.() ?? '';
                const esMobile = ua.includes('mobile') || ua.includes('iphone') || ua.includes('android');
                const DeviceIcon = esMobile ? Smartphone : Monitor;
                const lugar = [s.ciudad, s.pais].filter(Boolean).join(', ');
                return (
                  <div
                    key={s.id ?? i}
                    className={`border rounded-lg p-2.5 ${
                      s.esActual ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <DeviceIcon className={`w-3 h-3 ${s.esActual ? 'text-emerald-600' : 'text-slate-500'}`} />
                      <span className="font-bold text-slate-900">{s.uid}</span>
                      {s.esActual && (
                        <span className="text-[9px] bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.5 rounded">
                          ACTUAL
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-600">
                      {s.device || 'Sin info'}
                      {lugar ? ` · ${lugar}` : ''}
                      {s.lastActive ? ` · ${tiempoRel(s.lastActive)}` : ''}
                    </div>
                  </div>
                );
              })}
              {sesionesExtras > 0 && (
                <div className="text-center text-[10px] text-slate-500 pt-1">
                  + {sesionesExtras} sesión{sesionesExtras === 1 ? '' : 'es'} más
                </div>
              )}
            </div>
          )}
        </div>

        {/* Auditoría reciente · placeholder pedagógico */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-sky-600" />
              Eventos recientes
            </h3>
            <button
              type="button"
              onClick={() => navigate('/auditoria')}
              className="text-[10px] text-sky-600 font-bold hover:text-sky-800"
            >
              Ver auditoría completa →
            </button>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center text-[11px] text-slate-500">
              <Activity className="w-5 h-5 mx-auto mb-1 text-slate-300" />
              <div className="font-semibold text-slate-700 text-[12px]">Audit trail en vivo</div>
              <p className="text-[10px] mt-0.5">
                Los eventos del sistema (logins · cambios de rol · aprobaciones) aparecen acá
                cuando el servicio de auditoría esté integrado.
              </p>
              <button
                type="button"
                onClick={() => navigate('/auditoria')}
                className="mt-2 text-[10px] font-bold text-sky-600 hover:text-sky-800 inline-flex items-center gap-1"
              >
                Ver módulo completo
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* §E · Card warning IPs sospechosas (condicional · solo si hay) */}
      {ipsSospechosas !== null && ipsSospechosas > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-[13px] font-bold text-amber-900 mb-1">
                {ipsSospechosas} IP{ipsSospechosas === 1 ? '' : 's'} sospechosa{ipsSospechosas === 1 ? '' : 's'} detectada{ipsSospechosas === 1 ? '' : 's'}
              </h3>
              <p className="text-[11px] text-amber-800 mb-2">
                Revisar logins geo-anómalos en el módulo de Auditoría · marcar como sospechoso o
                ignorar según corresponda.
              </p>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => navigate('/auditoria')}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg"
                >
                  Revisar IPs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* §F · Cross-link Auditoría enriquecido (canon mockup) */}
      <div className="bg-gradient-to-r from-rose-50 to-pink-50 ring-1 ring-rose-200 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-rose-700" />
        </div>
        <div className="flex-1">
          <div className="text-[12px] font-bold text-slate-900 mb-0.5">
            Auditoría completa del sistema
          </div>
          <div className="text-[11px] text-slate-600">
            Timeline detallada de TODOS los eventos · filtros por módulo · exports CSV · análisis
            histórico
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/auditoria')}
          className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1 flex-shrink-0"
        >
          Abrir Auditoría
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
