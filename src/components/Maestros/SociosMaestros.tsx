/**
 * SociosMaestros · chk5.E-INV-SOC (2026-05-24)
 *
 * Sub-tab de /maestros · gestión del catálogo de socios del negocio.
 *
 * Patrón canon · tabla + modal de crear/editar.
 * Color signature: violet (consistente con módulo Inversionistas).
 *
 * Features:
 *  - Lista paginada con KPIs (total · activos · vinculados a usuario)
 *  - Form de crear/editar con campo email + autocompletado por usuario existente
 *  - Vínculo opcional a UserProfile (selector de usuarios del sistema)
 *  - Validación de % participación (suma ≤ 100)
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Landmark,
  Plus,
  Edit2,
  Trash2,
  Mail,
  User as UserIcon,
  Search,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { FormModalV2 } from '../../design-system/components/FormModalV2';
import { TextField } from '../../design-system/components/forms/TextField';
import { useSocioStore } from '../../store/socioStore';
import { useAuthStore } from '../../store/authStore';
import { socioService } from '../../services/socio.service';
import type { Socio, SocioFormData } from '../../types/inversionista.types';
import type { UserProfile } from '../../types/auth.types';
import { formatPercent } from '../../utils/format';

// ═════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════

export default function SociosMaestros() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const { socios, loading, error, fetchSocios, crearSocio, actualizarSocio, eliminarSocio } =
    useSocioStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [socioEditando, setSocioEditando] = useState<Socio | null>(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (socios.length === 0) {
      void fetchSocios();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // KPIs derivados
  const totalSocios = socios.length;
  const sociosActivos = socios.filter((s) => s.activo).length;
  const sociosConUsuario = socios.filter((s) => s.userId).length;
  const sumaParticipaciones = socios.reduce((acc, s) => acc + (s.activo ? s.porcentajeParticipacion : 0), 0);

  // Lista filtrada
  const sociosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return socios;
    return socios.filter(
      (s) =>
        s.nombre.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.rol?.toLowerCase().includes(q)
    );
  }, [socios, busqueda]);

  const handleNuevo = () => {
    setSocioEditando(null);
    setModalOpen(true);
  };

  const handleEditar = (s: Socio) => {
    setSocioEditando(s);
    setModalOpen(true);
  };

  const handleEliminar = async (s: Socio) => {
    if (!confirm(`¿Eliminar el socio "${s.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await eliminarSocio(s.id);
    } catch (err) {
      alert(`Error al eliminar: ${err instanceof Error ? err.message : 'desconocido'}`);
    }
  };

  const handleSubmit = async (data: SocioFormData) => {
    if (!userProfile?.uid) {
      throw new Error('Sesión inválida · recargá la página.');
    }
    if (socioEditando) {
      await actualizarSocio(socioEditando.id, data, userProfile.uid);
    } else {
      await crearSocio(data, userProfile.uid);
    }
    setModalOpen(false);
    setSocioEditando(null);
  };

  return (
    <div className="space-y-4">
      {/* §A · KPI strip · 4 cards · canon N1+N2 violet */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          tinte="violet"
          icon={<Landmark className="w-3.5 h-3.5" />}
          label="TOTAL SOCIOS"
          valor={String(totalSocios)}
          delta={totalSocios > 0 ? `${sociosActivos} activos` : 'Sin socios'}
        />
        <KpiCard
          tinte="emerald"
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          label="ACTIVOS"
          valor={String(sociosActivos)}
          delta={totalSocios > 0 ? `${formatPercent((sociosActivos / totalSocios) * 100, { decimals: 0 })} del total` : '—'}
        />
        <KpiCard
          tinte="indigo"
          icon={<UserIcon className="w-3.5 h-3.5" />}
          label="VINCULADOS A USUARIO"
          valor={String(sociosConUsuario)}
          delta={totalSocios > 0 ? `${sociosConUsuario}/${totalSocios} con cuenta sistema` : '—'}
        />
        <KpiCard
          tinte={Math.abs(sumaParticipaciones - 100) < 0.01 ? 'emerald' : 'amber'}
          icon={<AlertCircle className="w-3.5 h-3.5" />}
          label="SUMA PARTICIPACIONES"
          valor={`${sumaParticipaciones.toFixed(0)}%`}
          delta={
            sumaParticipaciones === 100
              ? '✓ Cuadra'
              : sumaParticipaciones < 100
              ? `Falta ${(100 - sumaParticipaciones).toFixed(0)}%`
              : `Excede en ${(sumaParticipaciones - 100).toFixed(0)}%`
          }
        />
      </div>

      {/* §B · Header con búsqueda + acción */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar socio · nombre · email · rol"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="flex-1 bg-transparent border-none text-[12px] focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={handleNuevo}
          className="text-[12px] font-bold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuevo socio</span>
        </button>
      </div>

      {/* §C · Tabla · desktop, cards · mobile */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-[12px] text-rose-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {loading && socios.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-12 text-center text-[12px] text-slate-500">
          Cargando socios...
        </div>
      ) : sociosFiltrados.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-12 text-center">
          <Landmark className="w-10 h-10 text-violet-300 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-slate-700 mb-1">
            {busqueda ? 'Sin resultados para tu búsqueda' : 'Sin socios registrados'}
          </p>
          <p className="text-[11px] text-slate-500 mb-4">
            {busqueda
              ? 'Probá con otro término o limpiá el filtro.'
              : 'Empezá agregando los socios del negocio · podés vincularlos a usuarios del sistema.'}
          </p>
          {!busqueda && (
            <button
              type="button"
              onClick={handleNuevo}
              className="text-[12px] font-bold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Crear primer socio
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Tabla desktop */}
          <table className="w-full text-[12px] hidden md:table">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-700">Socio</th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-700">Rol</th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-700">Contacto</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-slate-700">Participación</th>
                <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider font-bold text-slate-700">Estado</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sociosFiltrados.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                        <Landmark className="w-3.5 h-3.5 text-violet-700" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{s.nombre}</div>
                        {s.userId && (
                          <div className="text-[9px] text-indigo-700 flex items-center gap-1">
                            <UserIcon className="w-2.5 h-2.5" /> Usuario del sistema
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{s.rol || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {s.email ? (
                      <span className="inline-flex items-center gap-1 text-[11px]">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {s.email}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-violet-900">
                    {s.porcentajeParticipacion.toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 text-center">
                    {s.activo ? (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold">Activo</span>
                    ) : (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold">Retirado</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditar(s)}
                        className="p-1.5 text-slate-500 hover:text-violet-700 hover:bg-violet-50 rounded"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEliminar(s)}
                        className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Cards mobile */}
          <div className="md:hidden divide-y divide-slate-100">
            {sociosFiltrados.map((s) => (
              <div key={s.id} className="p-3">
                <div className="flex items-start gap-2">
                  <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <Landmark className="w-4 h-4 text-violet-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-slate-900 text-[13px] truncate">{s.nombre}</div>
                      <div className="tabular-nums font-bold text-violet-700 text-[13px]">
                        {s.porcentajeParticipacion.toFixed(0)}%
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{s.rol || 'Socio'}</div>
                    {s.email && (
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Mail className="w-2.5 h-2.5" /> {s.email}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="flex items-center gap-2 text-[9px]">
                        {s.activo ? (
                          <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">Activo</span>
                        ) : (
                          <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">Retirado</span>
                        )}
                        {s.userId && (
                          <span className="text-indigo-700 flex items-center gap-1">
                            <UserIcon className="w-2.5 h-2.5" /> Usuario
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditar(s)}
                          className="p-1.5 text-slate-500 hover:text-violet-700 hover:bg-violet-50 rounded"
                          aria-label="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEliminar(s)}
                          className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* §D · Modal · crear/editar */}
      {modalOpen && (
        <SocioFormModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSocioEditando(null);
          }}
          onSubmit={handleSubmit}
          socio={socioEditando}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// KPI CARD canon N1+N2
// ═════════════════════════════════════════════════════════════════════════

interface KpiCardProps {
  tinte: 'violet' | 'emerald' | 'indigo' | 'amber';
  icon: React.ReactNode;
  label: string;
  valor: string;
  delta?: string;
}

function KpiCard({ tinte, icon, label, valor, delta }: KpiCardProps) {
  const tinteMap = {
    violet: { grad: 'from-violet-50 to-violet-100/40', ring: 'ring-violet-200/50', label: 'text-violet-700', valor: 'text-violet-900' },
    emerald: { grad: 'from-emerald-50 to-emerald-100/40', ring: 'ring-emerald-200/50', label: 'text-emerald-700', valor: 'text-emerald-900' },
    indigo: { grad: 'from-indigo-50 to-indigo-100/40', ring: 'ring-indigo-200/50', label: 'text-indigo-700', valor: 'text-indigo-900' },
    amber: { grad: 'from-amber-50 to-amber-100/40', ring: 'ring-amber-200/50', label: 'text-amber-700', valor: 'text-amber-900' },
  }[tinte];

  return (
    <div className={`bg-gradient-to-br ${tinteMap.grad} ring-1 ${tinteMap.ring} rounded-2xl p-3 sm:p-4`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[9px] sm:text-[10px] uppercase tracking-wider ${tinteMap.label} font-bold`}>
          {label}
        </span>
        <span className={tinteMap.label}>{icon}</span>
      </div>
      <div className={`text-xl sm:text-2xl font-bold tabular-nums ${tinteMap.valor}`}>{valor}</div>
      {delta && <div className={`text-[10px] sm:text-[11px] ${tinteMap.label} mt-0.5 truncate`}>{delta}</div>}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// MODAL FORM
// ═════════════════════════════════════════════════════════════════════════

interface SocioFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SocioFormData) => Promise<void>;
  socio: Socio | null;
}

function SocioFormModal({ isOpen, onClose, onSubmit, socio }: SocioFormModalProps) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState<string>('');
  const [usuarioVinculado, setUsuarioVinculado] = useState<UserProfile | null>(null);
  const [usuariosCandidatos, setUsuariosCandidatos] = useState<UserProfile[]>([]);
  const [buscandoUsuario, setBuscandoUsuario] = useState(false);
  const [rol, setRol] = useState('');
  const [porcentaje, setPorcentaje] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState(() => new Date().toISOString().slice(0, 10));
  const [activo, setActivo] = useState(true);
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-poblar si es edición
  useEffect(() => {
    if (socio) {
      setNombre(socio.nombre);
      setEmail(socio.email || '');
      setUserId(socio.userId || '');
      setRol(socio.rol || '');
      setPorcentaje(socio.porcentajeParticipacion.toString());
      setFechaIngreso(socio.fechaIngreso.toDate().toISOString().slice(0, 10));
      setActivo(socio.activo);
      setNotas(socio.notas || '');
    } else {
      setNombre('');
      setEmail('');
      setUserId('');
      setUsuarioVinculado(null);
      setUsuariosCandidatos([]);
      setRol('');
      setPorcentaje('');
      setFechaIngreso(new Date().toISOString().slice(0, 10));
      setActivo(true);
      setNotas('');
    }
    setError(null);
  }, [socio]);

  // Búsqueda de usuarios por email · debounced 400ms
  useEffect(() => {
    if (!email.trim()) {
      setUsuariosCandidatos([]);
      setUsuarioVinculado(null);
      return;
    }
    const handle = setTimeout(async () => {
      setBuscandoUsuario(true);
      try {
        const matches = await socioService.buscarUsuariosPorEmail(email);
        setUsuariosCandidatos(matches);
        if (matches.length === 1 && !userId) {
          // Match único · sugerencia automática
          setUsuarioVinculado(matches[0]);
        } else if (matches.length === 0) {
          setUsuarioVinculado(null);
        }
      } catch (err) {
        console.warn('Error buscando usuarios:', err);
      } finally {
        setBuscandoUsuario(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [email]);

  // Si userId ya está cargado (edición), buscar el usuario completo para mostrar info
  useEffect(() => {
    if (userId && !usuarioVinculado) {
      void (async () => {
        const usuarios = await socioService.listarUsuariosVinculables();
        const match = usuarios.find((u) => u.uid === userId);
        if (match) setUsuarioVinculado(match);
      })();
    }
  }, [userId, usuarioVinculado]);

  const handleVincular = (u: UserProfile) => {
    setUserId(u.uid);
    setUsuarioVinculado(u);
    if (!email) setEmail(u.email);
  };

  const handleDesvincular = () => {
    setUserId('');
    setUsuarioVinculado(null);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    const pctNum = parseFloat(porcentaje);
    if (isNaN(pctNum) || pctNum < 0 || pctNum > 100) {
      setError('El porcentaje de participación debe estar entre 0 y 100.');
      return;
    }

    setSubmitting(true);
    try {
      const data: SocioFormData = {
        nombre: nombre.trim(),
        porcentajeParticipacion: pctNum,
        fechaIngreso: new Date(fechaIngreso),
        activo,
      };
      if (email.trim()) data.email = email.trim();
      if (userId) data.userId = userId;
      if (rol.trim()) data.rol = rol.trim();
      if (notas.trim()) data.notas = notas.trim();

      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      title={socio ? 'Editar socio' : 'Nuevo socio'}
      icon={Landmark}
      iconTone="purple"
      onSubmit={handleSubmit}
      loading={submitting}
      submitLabel={socio ? 'Guardar cambios' : 'Crear socio'}
      size="md"
    >
      <div className="space-y-3">
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-[12px] text-rose-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
            <div>{error}</div>
          </div>
        )}

        <TextField
          label="Nombre completo"
          value={nombre}
          onChange={setNombre}
          placeholder="ej: José Lopez Paz"
          required
          disabled={!!socio}
          hint={socio ? 'El nombre no se puede modificar (es parte del ID).' : 'Se usa para generar un identificador único.'}
        />

        <div>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="ej: jose.lp@empresa.com"
            hint="Si coincide con un usuario del sistema, podés vincularlo abajo."
          />

          {/* Vinculación a usuario · solo si email + no vinculado */}
          {email && !usuarioVinculado && usuariosCandidatos.length > 0 && (
            <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded-lg p-2.5">
              <div className="text-[11px] font-bold text-indigo-900 mb-1.5 flex items-center gap-1">
                <UserIcon className="w-3 h-3" /> Usuario del sistema encontrado
              </div>
              {usuariosCandidatos.map((u) => (
                <button
                  key={u.uid}
                  type="button"
                  onClick={() => handleVincular(u)}
                  className="w-full text-left bg-white hover:bg-indigo-50/50 border border-indigo-200 rounded p-2 mb-1 last:mb-0"
                >
                  <div className="text-[11px] font-semibold text-slate-900">{u.displayName}</div>
                  <div className="text-[10px] text-slate-500">{u.email} · rol: {u.role}</div>
                  <div className="text-[10px] text-indigo-700 mt-0.5">→ Click para vincular</div>
                </button>
              ))}
            </div>
          )}

          {/* Estado vinculado · chip + opción de desvincular */}
          {usuarioVinculado && (
            <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <UserIcon className="w-4 h-4 text-indigo-700 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-indigo-900 truncate">
                    Vinculado a usuario: {usuarioVinculado.displayName}
                  </div>
                  <div className="text-[10px] text-indigo-700 truncate">
                    rol: {usuarioVinculado.role}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDesvincular}
                className="text-[10px] font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 px-2 py-1 rounded flex-shrink-0"
              >
                Desvincular
              </button>
            </div>
          )}

          {email && buscandoUsuario && (
            <div className="mt-1 text-[10px] text-slate-500">Buscando usuarios...</div>
          )}

          {email && !buscandoUsuario && !usuarioVinculado && usuariosCandidatos.length === 0 && (
            <div className="mt-1 text-[10px] text-slate-500">
              Sin usuarios del sistema con este email · socio queda como "silent partner".
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Rol descriptivo"
            value={rol}
            onChange={setRol}
            placeholder="ej: Co-fundador · CEO"
            hint="Cargo en el negocio, NO el rol del sistema."
          />
          <TextField
            label="% Participación"
            type="number"
            value={porcentaje}
            onChange={setPorcentaje}
            placeholder="ej: 50"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Fecha de ingreso"
            type="date"
            value={fechaIngreso}
            onChange={setFechaIngreso}
            required
          />
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Estado</label>
            <select
              value={activo ? 'true' : 'false'}
              onChange={(e) => setActivo(e.target.value === 'true')}
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-[12px] bg-white focus:outline-none focus:border-violet-500"
            >
              <option value="true">Activo</option>
              <option value="false">Retirado</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Notas internas</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Notas opcionales sobre el socio..."
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-violet-500"
          />
        </div>
      </div>
    </FormModalV2>
  );
}
