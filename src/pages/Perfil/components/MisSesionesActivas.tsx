/**
 * MisSesionesActivas · F10.F.1.H · 2026-05-27
 *
 * Card slate con lista de sesiones activas del usuario.
 * Cada sesión = un device/browser donde inició sesión.
 *
 * Acciones:
 *   - "Cerrar esta sesión" · solo en sesiones que NO son la actual
 *   - "Cerrar todas las otras" · bulk · útil al cambiar password o ante sospecha
 *
 * Canon v8.0 N1 · slate (neutral · seguridad operacional)
 * Canon v8.0 N10 · 3-tier · acción primary destructive teal-light
 */
import React, { useEffect, useState } from 'react';
import { Smartphone, Monitor, Globe, MapPin, Clock, LogOut, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { SesionActiva } from '../../../types/sesion.types';
import { sesionService } from '../../../services/sesion.service';

interface Props {
  uid: string;
  /** Callback al cerrar una sesión · útil para refrescar contador externo */
  onSesionCerrada?: () => void;
}

export const MisSesionesActivas: React.FC<Props> = ({ uid, onSesionCerrada }) => {
  const [sesiones, setSesiones] = useState<SesionActiva[]>([]);
  const [loading, setLoading] = useState(true);
  const [cerrandoId, setCerrandoId] = useState<string | null>(null);
  const [cerrandoTodas, setCerrandoTodas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarSesiones = async () => {
    setLoading(true);
    try {
      const lista = await sesionService.listActivasByUid(uid);
      setSesiones(lista);
    } catch (err) {
      console.error('Error cargando sesiones:', err);
      setError('No se pudieron cargar las sesiones activas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (uid) cargarSesiones();
  }, [uid]);

  const handleCerrarSesion = async (sessionId: string) => {
    setCerrandoId(sessionId);
    setError(null);
    try {
      await sesionService.desconectar(sessionId);
      await cargarSesiones();
      onSesionCerrada?.();
    } catch (err: any) {
      setError(err?.message || 'Error al cerrar sesión');
    } finally {
      setCerrandoId(null);
    }
  };

  const handleCerrarTodasLasOtras = async () => {
    const otrasIds = sesiones.filter((s) => !s.esActual).map((s) => s.id);
    if (otrasIds.length === 0) return;
    if (!confirm(`¿Cerrar ${otrasIds.length} sesión${otrasIds.length > 1 ? 'es' : ''} en otros dispositivos? Necesitarás volver a iniciar sesión allí.`)) {
      return;
    }
    setCerrandoTodas(true);
    setError(null);
    try {
      await sesionService.desconectarTodasDeUsuario(uid);
      await cargarSesiones();
      onSesionCerrada?.();
    } catch (err: any) {
      setError(err?.message || 'Error al cerrar sesiones');
    } finally {
      setCerrandoTodas(false);
    }
  };

  const fechaRelativa = (fecha: Date): string => {
    const diffMs = Date.now() - fecha.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Hace un momento';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `Hace ${diffHr}h`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  };

  const getDeviceIcon = (s: SesionActiva) => {
    if (/iPhone|Android|Mobile/i.test(s.userAgent)) return Smartphone;
    return Monitor;
  };

  const otrasSesiones = sesiones.filter((s) => !s.esActual).length;

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
      {/* Header card */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 flex-wrap">
        <ShieldAlert className="w-4 h-4 text-slate-700 flex-shrink-0" />
        <span className="text-[11px] uppercase tracking-wider text-slate-700 font-bold">
          Sesiones activas
        </span>
        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold tabular-nums">
          {loading ? '...' : sesiones.length}
        </span>

        {otrasSesiones > 0 && (
          <button
            type="button"
            onClick={handleCerrarTodasLasOtras}
            disabled={cerrandoTodas}
            className="ml-auto text-[11px] font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 px-2.5 py-1 rounded inline-flex items-center gap-1 disabled:opacity-50"
          >
            <LogOut className="w-3 h-3" />
            {cerrandoTodas ? 'Cerrando...' : `Cerrar las otras (${otrasSesiones})`}
          </button>
        )}
      </div>

      {/* Error inline */}
      {error && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-[11px] text-rose-700">
          {error}
        </div>
      )}

      {/* Body · lista */}
      {loading ? (
        <div className="p-6 text-center text-slate-400 text-[12px]">Cargando sesiones...</div>
      ) : sesiones.length === 0 ? (
        <div className="p-6 text-center">
          <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <div className="text-[13px] font-semibold text-slate-700">Sin sesiones activas</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Esto es inusual · puede que el tracking no esté instalado en tu navegador.
          </div>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {sesiones.map((s) => {
            const DeviceIcon = getDeviceIcon(s);
            const lastActive = s.lastActive?.toDate?.() ?? new Date();
            const esCerrando = cerrandoId === s.id;
            return (
              <div
                key={s.id}
                className={`p-3 sm:p-4 flex items-start gap-3 ${
                  s.esActual ? 'bg-emerald-50/40' : 'hover:bg-slate-50/50'
                } transition-colors min-h-[64px]`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    s.esActual ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <DeviceIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-slate-900 truncate">
                      {s.device}
                    </span>
                    {s.esActual && (
                      <span className="inline-flex items-center text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Esta sesión
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap mt-0.5">
                    {(s.ip || s.ciudad) && (
                      <span className="inline-flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5" />
                        {s.ciudad ? `${s.ciudad}${s.pais ? `, ${s.pais}` : ''}` : s.ip}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {fechaRelativa(lastActive)}
                    </span>
                  </div>
                </div>

                {/* Acción cerrar · solo si NO es la actual */}
                {!s.esActual && (
                  <button
                    type="button"
                    onClick={() => handleCerrarSesion(s.id)}
                    disabled={esCerrando}
                    className="text-[11px] font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 px-2.5 py-1 rounded flex-shrink-0 disabled:opacity-50 min-h-[32px]"
                  >
                    {esCerrando ? '...' : 'Cerrar'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MisSesionesActivas;
