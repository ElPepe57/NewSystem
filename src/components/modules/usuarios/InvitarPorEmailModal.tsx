/**
 * src/components/modules/usuarios/InvitarPorEmailModal.tsx
 * chk5.F4-USERS (2026-05-25) · Modal "Invitar por email" NUEVO (canon ACTO 2.2).
 *
 * Admin invita por email · sin captcha (admin authenticated) · genera token JWT
 * server-side · envía vía Resend · admin recibe confirmación con link.
 */
import { useState } from 'react';
import { Mail, Send, AlertCircle, CheckCircle, Copy, X } from 'lucide-react';
import { invitacionService } from '../../../services/invitacion.service';
import { ROLES_PERMITIDOS_INVITACION } from '../../../types/invitacion.types';
import { ROLE_LABELS } from '../../../types/auth.types';
import type { UserRole } from '../../../types/auth.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function InvitarPorEmailModal({ isOpen, onClose, onSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [nombreSugerido, setNombreSugerido] = useState('');
  const [rolesPreAsignados, setRolesPreAsignados] = useState<UserRole[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; emailEnviado: boolean } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Ingresá un email válido');
      return;
    }

    setLoading(true);
    try {
      const result = await invitacionService.crear({
        email: email.trim().toLowerCase(),
        nombreSugerido: nombreSugerido.trim() || undefined,
        rolesPreAsignados,
        mensajePersonalizado: mensaje.trim() || undefined,
      });
      setSuccess(result);
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al enviar invitación';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setEmail('');
    setNombreSugerido('');
    setRolesPreAsignados([]);
    setMensaje('');
    setError(null);
    setSuccess(null);
    onClose();
  };

  const toggleRol = (rol: UserRole) => {
    setRolesPreAsignados((prev) =>
      prev.includes(rol) ? prev.filter((r) => r !== rol) : [...prev, rol],
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/30">
      <div className="absolute inset-0" onClick={handleClose} />

      <div className="relative bg-white rounded-2xl ring-1 ring-slate-200 w-full max-w-xl flex flex-col overflow-hidden shadow-2xl" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Mail className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">Invitar por email</h3>
              <p className="text-[11px] text-slate-500">Link único · 7 días de caducidad</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          // ─── Estado: invitación enviada ─────────────────────────────────
          <div className="px-5 py-6 space-y-4 overflow-y-auto">
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-7 h-7 text-emerald-600" />
              </div>
              <h4 className="text-[15px] font-bold text-slate-900 mb-1">Invitación enviada</h4>
              <p className="text-[12px] text-slate-600">
                Email enviado a <strong>{email}</strong>
              </p>
              {!success.emailEnviado && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-3">
                  ⚠ El email no se pudo enviar (revisá configuración Resend), pero la invitación
                  quedó creada. Podés re-enviarla desde Configuración → Invitaciones.
                </p>
              )}
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-600">Estado</span>
                <span className="font-bold text-amber-700">esperando registro</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Tracking</span>
                <span className="font-bold text-indigo-700">tab Configuración → Invitaciones</span>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white text-[12px] font-bold py-2.5 rounded-lg"
            >
              Listo
            </button>
          </div>
        ) : (
          // ─── Estado: form ───────────────────────────────────────────────
          <form onSubmit={handleSubmit} className="overflow-y-auto">
            <div className="px-5 py-4 space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Email * <span className="text-slate-400 font-normal">(destino de la invitación)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nuevo@empresa.com"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-[13px] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Nombre <span className="text-slate-400 font-normal">(opcional · sino pide al user)</span>
                </label>
                <input
                  type="text"
                  value={nombreSugerido}
                  onChange={(e) => setNombreSugerido(e.target.value)}
                  placeholder="Nombre Apellido"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-[13px]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2 block">
                  Rol pre-asignado <span className="text-slate-400 font-normal">(opcional · admin aprueba después)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {ROLES_PERMITIDOS_INVITACION.filter((r) => r !== 'invitado').map((r) => {
                    const isActive = rolesPreAsignados.includes(r);
                    return (
                      <label
                        key={r}
                        className={`p-2 border-2 rounded-lg cursor-pointer text-[11px] flex items-center gap-1.5 ${
                          isActive
                            ? 'border-indigo-400 bg-indigo-50/40 text-indigo-700 font-bold'
                            : 'border-slate-200 text-slate-600 hover:border-indigo-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => toggleRol(r)}
                          className="rounded"
                        />
                        {ROLE_LABELS[r]}
                      </label>
                    );
                  })}
                </div>
                <div className="mt-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-1.5">
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>
                    Roles sensibles (admin · gerente · socio) <strong>NO</strong> se pre-asignan por
                    invitación · admin debe asignarlos manualmente después.
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Mensaje personalizado <span className="text-slate-400 font-normal">(opcional · va en el email)</span>
                </label>
                <textarea
                  rows={2}
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder="Hola, te invito a unirte al sistema..."
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-[12px] resize-none"
                />
              </div>

              <div className="bg-indigo-50/50 border border-indigo-200 rounded-lg p-3 text-[11px] text-indigo-900">
                <div className="font-bold mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Preview del email
                </div>
                <div className="text-[10px] text-indigo-800">
                  "Te invitamos a unirte a BusinessMN. Hacé click para definir tu contraseña..."
                  <br />
                  <span className="text-indigo-600 underline">[Activar mi cuenta]</span>
                  {' · '}link válido 7 días.
                </div>
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 rounded-lg text-[12px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
              <div className="text-[11px] text-slate-600">
                Link válido 7 días · se puede re-enviar después
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Enviar invitación
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
