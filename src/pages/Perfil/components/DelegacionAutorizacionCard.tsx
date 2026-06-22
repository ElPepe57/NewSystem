/**
 * DelegacionAutorizacionCard · F4 · gestión de delegaciones de autoridad de egresos.
 *
 * Solo para socios. Permite delegar la facultad de autorizar egresos a una PERSONA o a un ROL
 * (con motivo + vigencia opcional · revocable). El delegado entra al pool de firmantes · la regla
 * de doble firma (>$1k = 2 firmas distintas) se mantiene. Vive en la tab "Mi información" de Mi perfil.
 */

import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, UserPlus, Trash2, Clock, Users, User as UserIcon, X } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useToastStore } from '../../../store/toastStore';
import { useConfirmDialog, ConfirmDialog } from '../../../components/common';
import { userService } from '../../../services/user.service';
import type { UserProfile } from '../../../types/auth.types';
import { delegacionAutorizacionService } from '../../../services/delegacionAutorizacion.service';
import {
  type DelegacionAutorizacion,
  delegacionVigente,
  etiquetaDelegado,
} from '../../../services/delegacionAutorizacion.helper';

/** Roles a los que tiene sentido delegar la autoridad de egresos (cargos de gestión). */
const ROLES_DELEGABLES: { rol: string; label: string }[] = [
  { rol: 'gerente', label: 'Gerente General' },
  { rol: 'finanzas', label: 'Finanzas' },
  { rol: 'supervisor', label: 'Supervisor' },
  { rol: 'comprador', label: 'Comprador' },
];

function estadoDelegacion(d: DelegacionAutorizacion): { label: string; cls: string } {
  if (!d.activa) return { label: 'Revocada', cls: 'bg-slate-100 text-slate-500' };
  if (!delegacionVigente(d, Date.now())) return { label: 'Expirada', cls: 'bg-amber-100 text-amber-700' };
  return { label: 'Vigente', cls: 'bg-emerald-100 text-emerald-700' };
}

export function DelegacionAutorizacionCard() {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const toast = useToastStore();
  const { dialogProps, confirm } = useConfirmDialog();

  const [delegaciones, setDelegaciones] = useState<DelegacionAutorizacion[]>([]);
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creando, setCreando] = useState(false);

  // form
  const [tipo, setTipo] = useState<'usuario' | 'rol'>('usuario');
  const [delegadoAUsuario, setDelegadoAUsuario] = useState('');
  const [delegadoARol, setDelegadoARol] = useState('gerente');
  const [motivo, setMotivo] = useState('');
  const [hasta, setHasta] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const [mias, todos] = await Promise.all([
        // .catch → degrada con gracia si la regla de firestore aún no está deployada.
        delegacionAutorizacionService.listarMias(user.uid).catch(() => [] as DelegacionAutorizacion[]),
        userService.getAll().catch(() => [] as UserProfile[]),
      ]);
      setDelegaciones(mias);
      setUsuarios(todos.filter((u) => u.uid !== user.uid && u.estado === 'activo'));
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const resetForm = () => {
    setTipo('usuario');
    setDelegadoAUsuario('');
    setDelegadoARol('gerente');
    setMotivo('');
    setHasta('');
    setCreando(false);
  };

  const handleCrear = async () => {
    if (!user?.uid) return;
    if (tipo === 'usuario' && !delegadoAUsuario) {
      toast.error('Elegí a quién delegar.', 'Falta el delegado');
      return;
    }
    setGuardando(true);
    try {
      const delegadoNombre = usuarios.find((u) => u.uid === delegadoAUsuario)?.displayName;
      await delegacionAutorizacionService.crear(
        {
          delegadoPorNombre: userProfile?.displayName,
          tipo,
          delegadoAUsuario: tipo === 'usuario' ? delegadoAUsuario : undefined,
          delegadoANombre: tipo === 'usuario' ? delegadoNombre : undefined,
          delegadoARol: tipo === 'rol' ? delegadoARol : undefined,
          motivo: motivo.trim() || undefined,
          hasta: hasta ? new Date(hasta + 'T23:59:59') : undefined,
        },
        user.uid,
      );
      toast.success('Delegación creada.', 'Autoridad delegada');
      resetForm();
      cargar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error', 'No se pudo delegar');
    } finally {
      setGuardando(false);
    }
  };

  const handleRevocar = async (d: DelegacionAutorizacion) => {
    if (!user?.uid) return;
    const ok = await confirm({
      title: 'Revocar delegación',
      message: `¿Revocar la autoridad delegada a ${etiquetaDelegado(d)}? Dejará de poder autorizar egresos.`,
      confirmText: 'Revocar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await delegacionAutorizacionService.revocar(d.id, user.uid);
      toast.success('Delegación revocada.');
      cargar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error', 'No se pudo revocar');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-slate-900 inline-flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-violet-600" />
          Delegación de autorización
        </h3>
        {!creando && (
          <button
            onClick={() => setCreando(true)}
            className="text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 px-2.5 py-1 rounded inline-flex items-center gap-1"
          >
            <UserPlus className="w-3 h-3" /> Delegar
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-500 leading-snug">
        Si te ausentás, podés delegar tu facultad de autorizar egresos a una persona o a un cargo.
        El delegado entra al pool de firmantes · los egresos &gt; $1.000 siguen requiriendo 2 firmas
        distintas (delegá en 2 para cubrirlos estando ausente).
      </p>

      {/* Form de creación */}
      {creando && (
        <div className="border border-violet-200 bg-violet-50/40 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-violet-900 uppercase tracking-wider">Nueva delegación</span>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* tipo */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTipo('usuario')}
              className={`text-[12px] font-medium px-3 py-2 rounded-lg border inline-flex items-center justify-center gap-1.5 ${
                tipo === 'usuario' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" /> A una persona
            </button>
            <button
              onClick={() => setTipo('rol')}
              className={`text-[12px] font-medium px-3 py-2 rounded-lg border inline-flex items-center justify-center gap-1.5 ${
                tipo === 'rol' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> A un cargo
            </button>
          </div>

          {/* delegado */}
          {tipo === 'usuario' ? (
            <select
              value={delegadoAUsuario}
              onChange={(e) => setDelegadoAUsuario(e.target.value)}
              className="w-full text-[12px] border border-slate-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="">— Elegí a quién delegar —</option>
              {usuarios.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.displayName || u.email}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={delegadoARol}
              onChange={(e) => setDelegadoARol(e.target.value)}
              className="w-full text-[12px] border border-slate-200 rounded-lg px-3 py-2 bg-white"
            >
              {ROLES_DELEGABLES.map((r) => (
                <option key={r.rol} value={r.rol}>
                  {r.label}
                </option>
              ))}
            </select>
          )}

          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (opcional · ej. vacaciones)"
            className="w-full text-[12px] border border-slate-200 rounded-lg px-3 py-2"
          />

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Vigente hasta (opcional)</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full text-[12px] border border-slate-200 rounded-lg px-3 py-2 mt-1"
            />
          </label>

          <div className="flex items-center justify-end gap-2">
            <button onClick={resetForm} className="text-[12px] text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg">
              Cancelar
            </button>
            <button
              onClick={handleCrear}
              disabled={guardando}
              className="text-[12px] font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-3 py-1.5 rounded-lg"
            >
              {guardando ? 'Delegando…' : 'Delegar autoridad'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-[12px] text-slate-400 py-2">Cargando…</div>
      ) : delegaciones.length === 0 ? (
        <div className="text-[12px] text-slate-400 italic py-2">No tenés delegaciones. Tu autoridad la ejercés solo vos.</div>
      ) : (
        <div className="space-y-1.5">
          {delegaciones.map((d) => {
            const est = estadoDelegacion(d);
            return (
              <div key={d.id} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-slate-800 flex items-center gap-1.5">
                    {d.tipo === 'rol' ? <Users className="w-3 h-3 text-slate-400" /> : <UserIcon className="w-3 h-3 text-slate-400" />}
                    {etiquetaDelegado(d)}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${est.cls}`}>{est.label}</span>
                  </div>
                  {(!!d.motivo || d.hasta != null) && (
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                      {d.motivo && <span className="truncate">{d.motivo}</span>}
                      {d.hasta != null && (
                        <span className="inline-flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" /> con vigencia
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {d.activa && (
                  <button
                    onClick={() => handleRevocar(d)}
                    className="text-rose-500 hover:bg-rose-50 p-1.5 rounded flex-shrink-0"
                    title="Revocar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
