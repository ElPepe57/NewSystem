/**
 * src/components/modules/usuarios/TabConfiguracion.tsx
 * chk5.F4-USERS (2026-05-25) · Tab "Configuración" del módulo /usuarios.
 *
 * 5 secciones (canon ACTO 7 del mockup):
 *   7.1 Política de registro (tri-state · whitelist · rate-limit · captcha · auto-rechazo)
 *   7.2 Invitaciones activas (tracking)
 *   7.3 Política de password
 *   7.4 Plantillas de roles
 *   7.5 Plantilla de email de invitación
 *   7.6 Permisos custom (overrides)
 */
import { useEffect, useState } from 'react';
import {
  UserCheck, Mail, Key, Layers, Sliders, Plus, RefreshCw, X,
  Trash2, Lock, Globe, Repeat, Shield, AlertTriangle, Loader,
  Send, Copy, Settings,
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { configUsuariosService } from '../../../services/configUsuarios.service';
import { invitacionService } from '../../../services/invitacion.service';
import type { ConfigUsuarios, ModoRegistro } from '../../../types/configUsuarios.types';
import { MODO_REGISTRO_LABELS, MODO_REGISTRO_DESCRIPCIONES } from '../../../types/configUsuarios.types';
import type { Invitacion } from '../../../types/invitacion.types';
import { INVITACION_ESTADO_LABELS, INVITACION_ESTADO_COLORS } from '../../../types/invitacion.types';
import { ROLE_LABELS } from '../../../types/auth.types';

export default function TabConfiguracion() {
  const currentUser = useAuthStore((s) => s.userProfile);
  const [config, setConfig] = useState<ConfigUsuarios | null>(null);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Estado local para edición de policy
  const [modoRegistro, setModoRegistro] = useState<ModoRegistro>('dual');
  const [whitelistInput, setWhitelistInput] = useState('');
  const [rateLimitMax, setRateLimitMax] = useState(3);
  const [rateLimitVentana, setRateLimitVentana] = useState(24);
  const [captchaActivo, setCaptchaActivo] = useState(true);
  const [autoRechazoDias, setAutoRechazoDias] = useState(7);
  const [autoRechazoActivo, setAutoRechazoActivo] = useState(true);

  // Cargar config + invitaciones
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [cfg, invs] = await Promise.all([
          configUsuariosService.get(),
          invitacionService.listPendientes().catch(() => [] as Invitacion[]),
        ]);
        if (cancelled) return;
        setConfig(cfg);
        setInvitaciones(invs);
        setModoRegistro(cfg.policyRegistro.modo);
        setRateLimitMax(cfg.policyRegistro.rateLimitPorIP.maxRegistros);
        setRateLimitVentana(cfg.policyRegistro.rateLimitPorIP.ventanaHoras);
        setCaptchaActivo(cfg.policyRegistro.captchaActivo);
        setAutoRechazoActivo(cfg.policyRegistro.autoRechazoSinAprobar.activo);
        setAutoRechazoDias(cfg.policyRegistro.autoRechazoSinAprobar.diasInactividad);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Error al cargar configuración';
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-hide success
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const handleSavePolicyRegistro = async () => {
    if (!config || !currentUser) return;
    setSaving(true);
    setError(null);
    try {
      const dominios = whitelistInput
        ? whitelistInput.split(',').map((d) => d.trim()).filter(Boolean)
        : config.policyRegistro.whitelistDominios;
      await configUsuariosService.updatePolicyRegistro(
        {
          ...config.policyRegistro,
          modo: modoRegistro,
          whitelistDominios: dominios,
          rateLimitPorIP: { maxRegistros: rateLimitMax, ventanaHoras: rateLimitVentana },
          captchaActivo,
          autoRechazoSinAprobar: { activo: autoRechazoActivo, diasInactividad: autoRechazoDias },
        },
        currentUser.uid,
      );
      const cfg = await configUsuariosService.get();
      setConfig(cfg);
      setWhitelistInput('');
      setSuccess('Política de registro actualizada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDominio = (dom: string) => {
    if (!dom.trim()) return;
    setWhitelistInput((prev) => (prev ? `${prev}, ${dom.trim()}` : dom.trim()));
  };

  const handleRemoveDominio = async (dom: string) => {
    if (!config || !currentUser) return;
    const dominios = config.policyRegistro.whitelistDominios.filter((d) => d !== dom);
    setSaving(true);
    try {
      await configUsuariosService.updatePolicyRegistro(
        { ...config.policyRegistro, whitelistDominios: dominios },
        currentUser.uid,
      );
      const cfg = await configUsuariosService.get();
      setConfig(cfg);
      setSuccess(`Dominio ${dom} removido`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelInvitacion = async (id: string) => {
    setSaving(true);
    try {
      await invitacionService.cancelar(id);
      const list = await invitacionService.listPendientes();
      setInvitaciones(list);
      setSuccess('Invitación cancelada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleReenviarInvitacion = async (id: string) => {
    setSaving(true);
    try {
      await invitacionService.reEnviar(id);
      const list = await invitacionService.listPendientes();
      setInvitaciones(list);
      setSuccess('Email re-enviado');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
        <p className="text-[13px] text-rose-900">No se pudo cargar la configuración</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
          <Settings className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-[16px] font-bold text-slate-900">Configuración del módulo</h2>
          <p className="text-[11px] text-slate-500">Gobierno · política · plantillas · permisos</p>
        </div>
      </div>

      {/* Mensajes de feedback */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-[12px] px-3 py-2 rounded-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 text-[12px] px-3 py-2 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-rose-700"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 7.1 POLÍTICA DE REGISTRO                                          */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl ring-1 ring-indigo-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserCheck className="w-5 h-5 text-indigo-600" />
          <h3 className="text-[14px] font-bold text-slate-900">7.1 · Política de registro</h3>
        </div>

        {/* Tri-state modo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {(['solo_invitacion', 'solo_self_signup', 'dual'] as ModoRegistro[]).map((modo) => {
            const isActive = modoRegistro === modo;
            const Icon = modo === 'solo_invitacion' ? Lock : modo === 'solo_self_signup' ? Globe : Repeat;
            return (
              <label
                key={modo}
                className={`p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                  isActive
                    ? 'border-emerald-400 bg-emerald-50/40'
                    : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="radio"
                    name="modo"
                    checked={isActive}
                    onChange={() => setModoRegistro(modo)}
                  />
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-600'}`} />
                  <span className={`text-[12px] font-bold ${isActive ? 'text-emerald-900' : 'text-slate-900'}`}>
                    {MODO_REGISTRO_LABELS[modo]}
                  </span>
                  {isActive && (
                    <span className="ml-auto bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                      ACTIVO
                    </span>
                  )}
                </div>
                <p className={`text-[10px] ${isActive ? 'text-emerald-800' : 'text-slate-600'}`}>
                  {MODO_REGISTRO_DESCRIPCIONES[modo]}
                </p>
              </label>
            );
          })}
        </div>

        {/* Whitelist + Rate-limit + Captcha + Auto-rechazo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
          {/* Whitelist */}
          <div>
            <div className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" />
              Whitelist de dominios
            </div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={whitelistInput}
                onChange={(e) => setWhitelistInput(e.target.value)}
                placeholder="@vitaskin.pe, @gmail.com"
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-[11px]"
              />
              <button
                onClick={() => handleAddDominio(whitelistInput.split(',').pop() || '')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            {/* Dominios actuales como chips */}
            {config.policyRegistro.whitelistDominios.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {config.policyRegistro.whitelistDominios.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] px-2 py-0.5 rounded"
                  >
                    {d}
                    <button onClick={() => handleRemoveDominio(d)} className="hover:text-indigo-900">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Lista vacía · cualquier dominio puede registrarse
              </div>
            )}
          </div>

          {/* Rate-limit */}
          <div>
            <div className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" />
              Rate-limit por IP
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={rateLimitMax}
                onChange={(e) => setRateLimitMax(Number(e.target.value))}
                className="w-16 px-2 py-1.5 border border-slate-300 rounded text-[11px]"
              />
              <span className="text-[11px] text-slate-600">registros cada</span>
              <input
                type="number"
                value={rateLimitVentana}
                onChange={(e) => setRateLimitVentana(Number(e.target.value))}
                className="w-16 px-2 py-1.5 border border-slate-300 rounded text-[11px]"
              />
              <span className="text-[11px] text-slate-600">horas</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Evita spam de bots</p>
          </div>

          {/* Captcha */}
          <div>
            <div className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              Captcha en /signup
            </div>
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              <span className="text-[11px]">Cloudflare Turnstile</span>
              <button
                onClick={() => setCaptchaActivo(!captchaActivo)}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${captchaActivo ? 'bg-emerald-500' : 'bg-slate-300'}`}
                aria-label="toggle captcha"
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${captchaActivo ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          </div>

          {/* Auto-rechazo */}
          <div>
            <div className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Auto-rechazo de pendientes
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRechazoActivo(!autoRechazoActivo)}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors flex-shrink-0 ${autoRechazoActivo ? 'bg-emerald-500' : 'bg-slate-300'}`}
                aria-label="toggle auto-rechazo"
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${autoRechazoActivo ? 'translate-x-4' : ''}`} />
              </button>
              <span className="text-[11px] text-slate-600">después de</span>
              <input
                type="number"
                value={autoRechazoDias}
                onChange={(e) => setAutoRechazoDias(Number(e.target.value))}
                disabled={!autoRechazoActivo}
                className="w-14 px-2 py-1.5 border border-slate-300 rounded text-[11px] disabled:bg-slate-100"
              />
              <span className="text-[11px] text-slate-600">días</span>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end mt-4 pt-4 border-t border-slate-200">
          <button
            onClick={handleSavePolicyRegistro}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold px-4 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : null}
            Guardar política
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 7.2 INVITACIONES ACTIVAS                                          */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl ring-1 ring-indigo-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-600" />
            <h3 className="text-[14px] font-bold text-slate-900">
              7.2 · Invitaciones activas
              <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold">
                {invitaciones.length}
              </span>
            </h3>
          </div>
        </div>
        {invitaciones.length === 0 ? (
          <div className="text-center py-6">
            <Mail className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-[12px] text-slate-600">No hay invitaciones activas en este momento</p>
          </div>
        ) : (
          <div className="space-y-2">
            {invitaciones.map((inv) => {
              const expiraEn = inv.fechaCaducidad?.toDate?.() || new Date();
              const dias = invitacionService.diasHastaExpiracion(inv);
              const colors = INVITACION_ESTADO_COLORS[inv.estado];
              return (
                <div
                  key={inv.id}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-3 text-[11px]"
                >
                  <Mail className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 truncate">{inv.email}</div>
                    <div className="text-slate-600">
                      Rol: {inv.rolesPreAsignados.length > 0 ? inv.rolesPreAsignados.join(', ') : 'sin pre-asignar'}
                      {' · '}expira en {dias}d ({expiraEn.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })})
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                    {INVITACION_ESTADO_LABELS[inv.estado]}
                  </span>
                  <button
                    onClick={() => handleReenviarInvitacion(inv.id)}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5"
                    title="Re-enviar email"
                  >
                    <Send className="w-3 h-3" />
                    Re-enviar
                  </button>
                  <button
                    onClick={() => handleCancelInvitacion(inv.id)}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-medium flex items-center gap-0.5"
                    title="Cancelar invitación"
                  >
                    <X className="w-3 h-3" />
                    Cancelar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 7.3 PASSWORD + 7.4 ROLES (grid)                                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl ring-1 ring-indigo-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-indigo-600" />
            <h3 className="text-[14px] font-bold text-slate-900">7.3 · Política de password</h3>
          </div>
          <div className="space-y-3 text-[11px]">
            <div className="flex items-center justify-between">
              <span>Longitud mínima</span>
              <span className="font-bold tabular-nums">{config.policyPassword.longitudMinima} caracteres</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Requiere mayúsculas</span>
              <span className={config.policyPassword.requiereMayusculas ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                {config.policyPassword.requiereMayusculas ? 'Sí' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Requiere números</span>
              <span className={config.policyPassword.requiereNumeros ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                {config.policyPassword.requiereNumeros ? 'Sí' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Caracteres especiales</span>
              <span className={config.policyPassword.requiereEspeciales ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                {config.policyPassword.requiereEspeciales ? 'Sí' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Bloquear comunes</span>
              <span className={config.policyPassword.bloquearComunes ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                {config.policyPassword.bloquearComunes ? 'Sí' : 'No'}
              </span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-4 pt-3 border-t border-slate-100">
            Edición avanzada · próxima versión
          </p>
        </div>

        <div className="bg-white rounded-2xl ring-1 ring-indigo-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="text-[14px] font-bold text-slate-900">7.4 · Plantillas de roles</h3>
          </div>
          <div className="space-y-1.5 text-[11px]">
            {(['admin', 'gerente', 'socio', 'finanzas', 'vendedor'] as const).map((r) => (
              <div key={r} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                <span className="font-bold text-slate-900">{ROLE_LABELS[r]}</span>
                <span className="text-[10px] text-slate-500">permisos por rol</span>
              </div>
            ))}
            <div className="text-center text-[10px] text-slate-500 pt-2">
              + 4 roles más · 9 totales
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 7.5 EMAIL TEMPLATE + 7.6 OVERRIDES                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl ring-1 ring-indigo-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-indigo-600" />
            <h3 className="text-[14px] font-bold text-slate-900">7.5 · Email de invitación</h3>
          </div>
          <div className="space-y-2 text-[11px]">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Asunto</div>
              <div className="bg-slate-50 rounded p-2 font-mono text-[10px]">
                {config.plantillaInvitacion.asunto}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Cuerpo (markdown)</div>
              <div className="bg-slate-50 rounded p-2 font-mono text-[10px] whitespace-pre-wrap max-h-32 overflow-y-auto">
                {config.plantillaInvitacion.cuerpoMarkdown}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-3 pt-3 border-t border-slate-100">
            Variables: <code>{'{nombre}'}</code> <code>{'{invitedBy}'}</code> <code>{'{link}'}</code> <code>{'{expiraEn}'}</code>
          </p>
        </div>

        <div className="bg-white rounded-2xl ring-1 ring-indigo-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sliders className="w-5 h-5 text-indigo-600" />
            <h3 className="text-[14px] font-bold text-slate-900">7.6 · Permisos custom (overrides)</h3>
          </div>
          <p className="text-[11px] text-slate-600 mb-4 leading-relaxed">
            Permisos específicos otorgados o revocados a usuarios individuales · fuera de su rol base.
            Editable desde la Ficha 360 del usuario · tab "Accesos".
          </p>
          <div className="bg-slate-50 rounded-lg p-3 text-center text-[11px] text-slate-500">
            Sin overrides activos en este momento
          </div>
        </div>
      </div>
    </div>
  );
}
