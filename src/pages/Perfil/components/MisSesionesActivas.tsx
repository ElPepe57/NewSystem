/**
 * MisSesionesActivas · F10.F.1.I-FIX · 2026-05-27
 *
 * PIXEL-PERFECT REWRITE · canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 9 (líneas 1027-1087).
 *
 * Patrón canon mockup:
 *   - bg-white border border-slate-200 rounded-xl p-5
 *   - h3 text-[14px] font-bold con icon monitor text-rose-700
 *   - "· N dispositivos" text-[10px] text-slate-500
 *   - btn "Desconectar todas" text-[11px] text-rose-600 font-bold hover:bg-rose-50
 *   - cada sesión:
 *     actual: bg-emerald-50/40 border border-emerald-200 rounded-lg p-3
 *       icon container w-9 h-9 bg-emerald-100 rounded-lg
 *       chip "ESTE DISPOSITIVO" text-[10px] bg-emerald-200 text-emerald-900 uppercase
 *     otra: bg-white border border-slate-200 rounded-lg p-3
 *       icon container w-9 h-9 bg-slate-100 rounded-lg
 *       btn "Desconectar" text-[11px] text-rose-600 font-bold hover:bg-rose-50
 *   - subtítulo: text-[10px] text-slate-600 "IP X · ciudad · activa ahora|hace Xh"
 */
import React, { useEffect, useState } from 'react';
import { Monitor, Smartphone, LogOut } from 'lucide-react';
import type { SesionActiva } from '../../../types/sesion.types';
import { sesionService } from '../../../services/sesion.service';

interface Props {
  uid: string;
  /** Callback al cerrar una sesión · útil para refrescar contador externo */
  onSesionCerrada?: () => void;
  /** Si se pasa, abre un modal canon en vez de window.confirm para desconectar */
  onSolicitarDesconectar?: (sesion: SesionActiva) => void;
  /** Si se pasa, abre un modal canon para desconectar todas (con typed confirm) */
  onSolicitarDesconectarTodas?: () => void;
}

export const MisSesionesActivas: React.FC<Props> = ({
  uid,
  onSesionCerrada,
  onSolicitarDesconectar,
  onSolicitarDesconectarTodas,
}) => {
  const [sesiones, setSesiones] = useState<SesionActiva[]>([]);
  const [loading, setLoading] = useState(true);
  const [cerrandoId, setCerrandoId] = useState<string | null>(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const handleCerrarSesion = async (sesion: SesionActiva) => {
    // Si hay handler de modal canon · delegar
    if (onSolicitarDesconectar) {
      onSolicitarDesconectar(sesion);
      return;
    }
    setCerrandoId(sesion.id);
    setError(null);
    try {
      await sesionService.desconectar(sesion.id);
      await cargarSesiones();
      onSesionCerrada?.();
    } catch (err: any) {
      setError(err?.message || 'Error al cerrar sesión');
    } finally {
      setCerrandoId(null);
    }
  };

  const handleCerrarTodas = async () => {
    if (onSolicitarDesconectarTodas) {
      onSolicitarDesconectarTodas();
      return;
    }
    const otras = sesiones.filter((s) => !s.esActual);
    if (otras.length === 0) return;
    if (!confirm(`¿Cerrar ${otras.length} sesión${otras.length > 1 ? 'es' : ''}? Necesitarás volver a iniciar sesión en esos dispositivos.`)) {
      return;
    }
    setError(null);
    try {
      await sesionService.desconectarTodasDeUsuario(uid);
      await cargarSesiones();
      onSesionCerrada?.();
    } catch (err: any) {
      setError(err?.message || 'Error al cerrar sesiones');
    }
  };

  const fechaRelativa = (fecha: Date): string => {
    const diffMs = Date.now() - fecha.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 2) return 'activa ahora';
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `hace ${diffHr}h`;
    const diffDays = Math.floor(diffHr / 24);
    return `hace ${diffDays}d`;
  };

  const getDeviceIconCmp = (s: SesionActiva) => {
    if (/iPhone|Android|Mobile/i.test(s.userAgent)) return Smartphone;
    return Monitor;
  };

  const otrasCount = sesiones.filter((s) => !s.esActual).length;

  return (
    // Canon mockup ACTO 9 · líneas 1028-1087 · copy-paste literal
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-bold text-slate-900 inline-flex items-center gap-1.5">
          <Monitor className="w-4 h-4 text-rose-700" />
          Sesiones activas
          <span className="text-[10px] text-slate-500 font-medium">
            · {loading ? '...' : `${sesiones.length} dispositivo${sesiones.length !== 1 ? 's' : ''}`}
          </span>
        </h3>
        {otrasCount > 0 && (
          <button
            type="button"
            onClick={handleCerrarTodas}
            className="text-[11px] text-rose-600 font-bold hover:bg-rose-50 px-2 py-1 rounded"
          >
            Desconectar todas
          </button>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3 text-[11px] text-rose-700">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          <div className="text-center text-slate-400 text-[11px] py-3">Cargando sesiones...</div>
        ) : sesiones.length === 0 ? (
          <div className="text-center py-3">
            <Monitor className="w-7 h-7 mx-auto mb-1.5 text-slate-300" />
            <div className="text-[12px] font-semibold text-slate-700">Sin sesiones activas registradas</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              El tracking puede no estar instalado en tu navegador.
            </div>
          </div>
        ) : (
          sesiones.map((s) => {
            const Icon = getDeviceIconCmp(s);
            const lastActive = s.lastActive?.toDate?.() ?? new Date();
            const isActual = !!s.esActual;
            const isCerrando = cerrandoId === s.id;
            const ipLine = [s.ip, s.ciudad ? `${s.ciudad}${s.pais ? `, ${s.pais}` : ''}` : null]
              .filter(Boolean)
              .join(' · ');
            const subtitulo = `${ipLine ? `IP ${ipLine} · ` : ''}${fechaRelativa(lastActive)}`;

            return (
              <div
                key={s.id}
                className={`${
                  isActual
                    ? 'bg-emerald-50/40 border border-emerald-200'
                    : 'bg-white border border-slate-200'
                } rounded-lg p-3 flex items-start justify-between gap-3`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 ${
                      isActual ? 'bg-emerald-100' : 'bg-slate-100'
                    } rounded-lg flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className={`w-4 h-4 ${isActual ? 'text-emerald-700' : 'text-slate-600'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-bold text-slate-900 truncate">{s.device}</span>
                      {isActual && (
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.5 rounded uppercase">
                          ESTE DISPOSITIVO
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-600 truncate">{subtitulo}</div>
                  </div>
                </div>
                {isActual ? (
                  <span className="text-[10px] text-slate-400 flex-shrink-0">—</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCerrarSesion(s)}
                    disabled={isCerrando}
                    className="text-[11px] text-rose-600 font-bold hover:bg-rose-50 px-2 py-1 rounded inline-flex items-center gap-1 flex-shrink-0 disabled:opacity-50"
                  >
                    <LogOut className="w-3 h-3" />
                    {isCerrando ? '...' : 'Desconectar'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MisSesionesActivas;
