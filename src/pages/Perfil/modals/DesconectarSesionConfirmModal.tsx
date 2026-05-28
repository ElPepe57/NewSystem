/**
 * DesconectarSesionConfirmModal · F10.F.1.N · 2026-05-27
 *
 * Modal canon FormModalV2 typed-confirm para desconectar sesión(es).
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 13 (líneas 1316-1367).
 *
 * 2 modos según prop:
 *   - mode='individual' · 1 sesión específica · info del device
 *   - mode='all' · todas las otras sesiones · cantidad afectada · typed confirm
 *
 * Estructura:
 *   - Header: iconTone="red" + LogOut icon + título contextual
 *   - Body:
 *     · Info de la sesión (individual) o cantidad (all)
 *     · Banner amber con consecuencias
 *     · Input typed-confirm "DESCONECTAR" (solo en mode='all')
 *   - Footer: Cancelar + Desconectar (variant danger-soft)
 *
 * Connector: sesionService.desconectar(id) o desconectarTodasDeUsuario(uid)
 */
import React, { useState } from 'react';
import { LogOut, AlertTriangle, Monitor, Smartphone, Globe, Clock } from 'lucide-react';
import { FormModalV2 } from '../../../design-system';
import { sesionService } from '../../../services/sesion.service';
import type { SesionActiva } from '../../../types/sesion.types';

interface PropsIndividual {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode: 'individual';
  sesion: SesionActiva;
}

interface PropsAll {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode: 'all';
  uid: string;
  cantidad: number;
}

type Props = PropsIndividual | PropsAll;

const fechaRelativa = (d: Date): string => {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 2) return 'activa ahora';
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr}h`;
  return `hace ${Math.floor(hr / 24)}d`;
};

export const DesconectarSesionConfirmModal: React.FC<Props> = (props) => {
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isAllMode = props.mode === 'all';
  const requiredConfirm = 'DESCONECTAR';
  const canSubmit = isAllMode ? confirmText === requiredConfirm : true;

  const handleClose = () => {
    setConfirmText('');
    setError(null);
    props.onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      if (props.mode === 'individual') {
        await sesionService.desconectar(props.sesion.id);
      } else {
        await sesionService.desconectarTodasDeUsuario(props.uid);
      }
      props.onSuccess?.();
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Error al desconectar');
    } finally {
      setSaving(false);
    }
  };

  // Info contextual del modal
  const titulo = isAllMode
    ? `Desconectar ${props.cantidad} sesion${props.cantidad > 1 ? 'es' : ''}`
    : 'Desconectar este dispositivo';

  const subtitulo = isAllMode
    ? 'Esta acción afecta todas tus otras sesiones · tu sesión actual se mantiene'
    : `Cierre forzado · ${props.sesion.device}`;

  const submitLabel = isAllMode
    ? `Desconectar ${props.cantidad}`
    : 'Desconectar';

  return (
    <FormModalV2
      isOpen={props.isOpen}
      onClose={handleClose}
      onSubmit={handleSubmit}
      title={titulo}
      subtitle={subtitulo}
      icon={LogOut}
      iconTone="red"
      submitLabel={saving ? 'Desconectando...' : submitLabel}
      submitVariant="danger-soft"
      submitIcon={LogOut}
      loading={saving}
      disabled={!canSubmit || saving}
      size="md"
    >
      <div className="space-y-3">
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-[12px] text-rose-800 inline-flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Mode individual · info de la sesión */}
        {props.mode === 'individual' && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                {/iPhone|Android|Mobile/i.test(props.sesion.userAgent) ? (
                  <Smartphone className="w-5 h-5 text-slate-600" />
                ) : (
                  <Monitor className="w-5 h-5 text-slate-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-slate-900">{props.sesion.device}</div>
                <div className="text-[11px] text-slate-600 mt-0.5 space-y-0.5">
                  {props.sesion.ip && (
                    <div className="inline-flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      IP {props.sesion.ip}
                      {props.sesion.ciudad ? ` · ${props.sesion.ciudad}` : ''}
                      {props.sesion.pais ? `, ${props.sesion.pais}` : ''}
                    </div>
                  )}
                  <div className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Última actividad: {fechaRelativa(props.sesion.lastActive?.toDate?.() ?? new Date())}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mode all · cantidad afectada */}
        {props.mode === 'all' && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-center">
            <LogOut className="w-8 h-8 text-rose-600 mx-auto mb-2" />
            <div className="text-[14px] font-bold text-rose-900">
              {props.cantidad} dispositivo{props.cantidad > 1 ? 's' : ''} afectado{props.cantidad > 1 ? 's' : ''}
            </div>
            <div className="text-[11px] text-rose-700 mt-1">
              Tu sesión actual NO se desconecta · solo las otras
            </div>
          </div>
        )}

        {/* Banner consecuencias */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-800 inline-flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            {isAllMode
              ? 'En esos dispositivos se cerrará la sesión inmediatamente · será necesario iniciar sesión de nuevo.'
              : 'Este dispositivo cerrará la sesión inmediatamente · podés volver a iniciar sesión cuando quieras.'}
          </span>
        </div>

        {/* Typed confirm (solo all) */}
        {isAllMode && (
          <div>
            <label className="text-[11px] uppercase tracking-wider font-bold text-slate-700 mb-1.5 block">
              Escribí <strong className="text-rose-700">DESCONECTAR</strong> para confirmar
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-rose-300 rounded-lg text-[13px] uppercase font-mono focus:outline-none focus:ring-2 focus:ring-rose-200"
              placeholder="DESCONECTAR"
              autoFocus
              disabled={saving}
            />
          </div>
        )}
      </div>
    </FormModalV2>
  );
};

export default DesconectarSesionConfirmModal;
