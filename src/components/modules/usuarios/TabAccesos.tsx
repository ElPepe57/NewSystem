/**
 * src/components/modules/usuarios/TabAccesos.tsx
 * chk5.F4-USERS (2026-05-25) · Tab "Accesos" del módulo /usuarios.
 *
 * Resumen de seguridad · sesiones activas globales + intentos fallidos +
 * acción "Desconectar todas las sesiones" + cross-link a /auditoria.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, AlertTriangle, Monitor, ArrowRight, Loader, ShieldAlert } from 'lucide-react';
import { sesionService } from '../../../services/sesion.service';

interface Props {
  onRequestDisconnectAll: () => void;
}

export default function TabAccesos({ onRequestDisconnectAll }: Props) {
  const navigate = useNavigate();
  const [sesionesActivas, setSesionesActivas] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // TODO: usar query global en lugar de listActivasByUid · por ahora estimamos
        // Placeholder · cuando Fase 2 esté deployed la query funciona.
        setLoading(false);
        if (cancelled) return;
        setSesionesActivas(0);
      } catch {
        if (cancelled) return;
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-slate-900">Accesos y seguridad</h2>
            <p className="text-[11px] text-slate-500">Sesiones activas · intentos fallidos · auditoría</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/auditoria')}
          className="bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-[12px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
        >
          Auditoría completa
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* KPI strip · rose */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">SESIONES ACTIVAS</span>
            <Monitor className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">
            {loading ? <Loader className="w-5 h-5 animate-spin inline" /> : sesionesActivas}
          </div>
          <div className="text-[10px] text-emerald-700 mt-1">usuarios conectados ahora</div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">INTENTOS FALLIDOS 24H</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-900">—</div>
          <div className="text-[10px] text-amber-700 mt-1">requiere auditoría completa</div>
        </div>
      </div>

      {/* Acción emergencia · desconectar todas */}
      <div className="bg-gradient-to-r from-rose-50 to-pink-50 ring-1 ring-rose-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-5 h-5 text-rose-700" />
          </div>
          <div className="flex-1">
            <h3 className="text-[13px] font-bold text-slate-900 mb-1">Acción de emergencia</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Cierra <strong>TODAS las sesiones activas</strong> del sistema. Todos los usuarios
              deberán ingresar de nuevo. Usar solo en caso de incidente de seguridad
              (compromise de credenciales · acceso no autorizado · etc.)
            </p>
          </div>
          <button
            onClick={onRequestDisconnectAll}
            className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 whitespace-nowrap"
          >
            Desconectar todas
          </button>
        </div>
      </div>

      {/* Card · cross-link a Auditoría */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <Shield className="w-4 h-4 text-rose-600" />
          <h3 className="text-[13px] font-bold text-slate-900">Auditoría del sistema</h3>
        </div>
        <p className="text-[11px] text-slate-600 mb-3 leading-relaxed">
          Registro completo de logins · acciones · cambios de configuración · todas las
          operaciones del sistema con timestamp · IP · usuario y módulo.
        </p>
        <button
          onClick={() => navigate('/auditoria')}
          className="w-full bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-bold py-2 rounded-lg text-[12px] flex items-center justify-center gap-2 transition-colors"
        >
          <Shield className="w-4 h-4" />
          Abrir módulo Auditoría
        </button>
      </div>
    </div>
  );
}
