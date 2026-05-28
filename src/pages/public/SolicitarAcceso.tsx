/**
 * SolicitarAcceso.tsx · chk5.PERSONAS-v5.9 · E9.1 (2026-05-28)
 *
 * Página pública (sin autenticación) para que externos soliciten acceso al
 * sistema. Submit crea SolicitudAccesoExterno en estado='pendiente' que el
 * admin procesa desde su bandeja en /usuarios.
 *
 * Ruta: /solicitar-acceso (sin layout · sin sidebar · sin auth guard)
 *
 * Flujo canon v5.9:
 *   1. Externo llena el form: nombre · email · teléfono · tipoRelacion · motivo
 *   2. Submit → solicitudesAccesoExternoService.crearSolicitud (E1)
 *   3. Vista de confirmación · "tu solicitud fue recibida · te contactaremos"
 *   4. (E9 futuro) Cloud Function envía email de "recibida" via Resend
 *   5. Admin abre /usuarios · ve banner "N solicitudes pendientes"
 *
 * LIMITACIONES ACEPTADAS en E9.1:
 *   ⚠️ reCAPTCHA v3 NO está integrado · usamos token placeholder
 *      (Cloud Function futuro re-validará y rechazará si score bajo)
 *   ⚠️ IP/UA tracking NO captura ip real (el server CF lo capturará)
 *      Acá pasamos UA pero ip="client-side-unknown" placeholder
 *   ⚠️ Anti-abuso rate-limit por IP queda en Firestore rules + CF futuro
 *
 * Patrón visual: similar a /register · centrado · max-w-md · sin chrome de app.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Mail,
  Phone,
  User as UserIcon,
  Briefcase,
  ShoppingCart,
  Truck,
  Handshake,
  Send,
  ArrowLeft,
  Building2,
} from 'lucide-react';
import { solicitudesAccesoExternoService } from '../../services/solicitudesAccesoExterno.service';
import type {
  TipoRelacionSolicitada,
  CrearSolicitudAccesoInput,
} from '../../types/solicitudAccesoExterno.types';
import {
  TIPO_RELACION_SOLICITADA_LABELS,
  TIPO_RELACION_SOLICITADA_ICONS,
  MOTIVO_MIN_CHARS,
} from '../../types/solicitudAccesoExterno.types';

// ═════════════════════════════════════════════════════════════════════════
// STATE
// ═════════════════════════════════════════════════════════════════════════

interface FormState {
  nombreCompleto: string;
  email: string;
  telefono: string;
  tipoRelacion: TipoRelacionSolicitada | '';
  cargoEnEntidad: string;
  motivo: string;
  recomendadoPor: string;
}

const INITIAL: FormState = {
  nombreCompleto: '',
  email: '',
  telefono: '',
  tipoRelacion: '',
  cargoEnEntidad: '',
  motivo: '',
  recomendadoPor: '',
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const SolicitarAcceso: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setState((prev) => ({ ...prev, [k]: v }));
    setError(null);
  };

  // ─── Validación ───────────────────────────────────────────────────────
  const validar = (): string | null => {
    if (!state.nombreCompleto.trim() || state.nombreCompleto.trim().length < 3) {
      return 'Nombre completo requerido (mín 3 caracteres)';
    }
    if (!state.email.includes('@') || !state.email.includes('.')) {
      return 'Email inválido';
    }
    if (!state.tipoRelacion) {
      return 'Elegí el tipo de relación que tenés con el negocio';
    }
    if (state.motivo.trim().length < MOTIVO_MIN_CHARS) {
      return `Contanos más sobre el motivo (mínimo ${MOTIVO_MIN_CHARS} caracteres · tenés ${state.motivo.trim().length})`;
    }
    return null;
  };

  // ─── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validar();
    if (err) {
      setError(err);
      return;
    }
    if (!state.tipoRelacion) return;

    setSubmitting(true);
    setError(null);

    try {
      const input: CrearSolicitudAccesoInput = {
        nombreCompleto: state.nombreCompleto.trim(),
        email: state.email.trim().toLowerCase(),
        telefono: state.telefono.trim() || undefined,
        tipoRelacion: state.tipoRelacion,
        cargoEnEntidad: state.cargoEnEntidad.trim() || undefined,
        motivo: state.motivo.trim(),
        recomendadoPor: state.recomendadoPor.trim() || undefined,
        // ⚠️ Placeholder · CF futuro re-valida con reCAPTCHA v3 real
        recaptchaToken: 'CLIENT_SIDE_PLACEHOLDER',
      };

      // Meta tracking · IP queda en client-side · server CF lo reemplaza con IP real
      const meta = {
        ipAddress: 'client-side-unknown',
        userAgent: navigator.userAgent,
        reCaptchaScore: 0.5, // CF futuro evalúa el token real
      };

      await solicitudesAccesoExternoService.crearSolicitud(input, meta);
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al enviar la solicitud';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ═══ Vista de éxito ═══
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Solicitud recibida</h1>
          <p className="text-sm text-slate-600 mb-6">
            Gracias <strong>{state.nombreCompleto.split(' ')[0]}</strong>. Tu solicitud fue recibida correctamente.
            El equipo de Vita Skin la revisará y te contactaremos a{' '}
            <strong className="text-slate-900">{state.email}</strong> en las próximas 48 horas.
          </p>
          <div className="bg-amber-50 ring-1 ring-amber-200 rounded-lg p-3 text-xs text-amber-900 text-left mb-4">
            <strong>Próximos pasos:</strong>
            <ul className="mt-1 space-y-0.5 list-disc list-inside">
              <li>Revisamos tu solicitud · 1-2 días hábiles</li>
              <li>Te enviamos email confirmando o pidiendo más info</li>
              <li>Si aprobamos · recibís invitación con link para crear tu cuenta</li>
            </ul>
          </div>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-sm text-teal-700 hover:underline font-semibold inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al login
          </button>
        </div>
      </div>
    );
  }

  // ═══ Vista del form ═══
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header con logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <div className="text-lg font-bold text-slate-900">Vita Skin</div>
              <div className="text-[10px] text-teal-600 font-semibold tracking-wider uppercase">Perú</div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-3">Solicitar acceso al sistema</h1>
          <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
            Si trabajás con Vita Skin como proveedor · cliente · transportista o colaborador,
            podés solicitar acceso a tu portal de operaciones.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 flex items-start gap-2 text-sm text-rose-900">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* §1 · Datos personales */}
          <div>
            <h2 className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2">Datos personales</h2>
            <div className="space-y-3">
              <Field label="Nombre completo *" icon={UserIcon}>
                <input
                  type="text"
                  required
                  value={state.nombreCompleto}
                  onChange={(e) => set('nombreCompleto', e.target.value)}
                  placeholder="Ej. Ricardo Castro Pérez"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Email *" icon={Mail}>
                  <input
                    type="email"
                    required
                    value={state.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                  />
                </Field>
                <Field label="Teléfono / WhatsApp" icon={Phone}>
                  <input
                    type="tel"
                    value={state.telefono}
                    onChange={(e) => set('telefono', e.target.value)}
                    placeholder="+51 987 654 321"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* §2 · Tipo de relación */}
          <div>
            <h2 className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2">
              Tipo de relación con Vita Skin *
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {(['proveedor', 'cliente', 'transportista', 'colaborador', 'otro'] as TipoRelacionSolicitada[]).map((t) => {
                const Icon =
                  t === 'proveedor'
                    ? ShoppingCart
                    : t === 'cliente'
                      ? Briefcase
                      : t === 'transportista'
                        ? Truck
                        : t === 'colaborador'
                          ? Handshake
                          : UserIcon;
                const active = state.tipoRelacion === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('tipoRelacion', t)}
                    className={`text-left p-3 rounded-xl transition-all ${
                      active
                        ? 'bg-teal-50 ring-2 ring-teal-500 text-teal-900'
                        : 'bg-white ring-1 ring-slate-200 hover:ring-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{TIPO_RELACION_SOLICITADA_ICONS[t]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{TIPO_RELACION_SOLICITADA_LABELS[t]}</div>
                      </div>
                      {active && <CheckCircle className="w-4 h-4 text-teal-600 flex-shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* §3 · Cargo en entidad (opcional) */}
          <Field label="Cargo / rol (opcional)" hint="Ej. Sales Representative · Brand Manager · Motorizado freelance">
            <input
              type="text"
              value={state.cargoEnEntidad}
              onChange={(e) => set('cargoEnEntidad', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </Field>

          {/* §4 · Motivo */}
          <Field
            label="¿Por qué necesitás acceso? *"
            hint={`Contanos brevemente · mínimo ${MOTIVO_MIN_CHARS} caracteres · ${state.motivo.trim().length}/${MOTIVO_MIN_CHARS}`}
          >
            <textarea
              required
              rows={4}
              value={state.motivo}
              onChange={(e) => set('motivo', e.target.value)}
              placeholder="Ej. Soy el sales rep de Skin Labs SAC · trabajamos con Vita Skin desde 2023 y quiero acceder al portal para gestionar mis OC y consultar pagos pendientes..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
            />
          </Field>

          {/* §5 · Referido (opcional) */}
          <Field label="¿Te recomendó alguien del equipo? (opcional)" hint="Nombre de la persona que te sugirió contactarnos">
            <input
              type="text"
              value={state.recomendadoPor}
              onChange={(e) => set('recomendadoPor', e.target.value)}
              placeholder="Ej. José Lozada · María Rodríguez..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </Field>

          {/* Acciones */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver al login
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold inline-flex items-center gap-2 disabled:opacity-60 shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar solicitud
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer info */}
        <div className="text-center mt-4 text-xs text-slate-500">
          <p>
            Al enviar aceptás que Vita Skin trate tus datos para procesar la solicitud · cumplimiento LFPDPPP.
          </p>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// HELPER · Field wrapper
// ═════════════════════════════════════════════════════════════════════════

const Field: React.FC<{
  label: string;
  icon?: React.FC<{ className?: string }>;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, icon: Icon, hint, children }) => (
  <div>
    <label className="text-[11px] uppercase tracking-wider font-bold text-slate-700 mb-1 flex items-center gap-1.5">
      {Icon && <Icon className="w-3 h-3 text-slate-400" />}
      {label}
    </label>
    {children}
    {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
  </div>
);

export default SolicitarAcceso;
