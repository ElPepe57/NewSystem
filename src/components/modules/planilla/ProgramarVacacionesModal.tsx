/**
 * ProgramarVacacionesModal.tsx
 *
 * chk5.PERSONAS-v5.4 · F5 · 2026-05-26
 *
 * Modal canon FormModalV2 sky para programar un período de vacaciones de un
 * empleado. Vita Skin gestiona vacaciones INFORMALMENTE (sin acumulación legal
 * ni cálculo de derecho · canon user 2026-05-26).
 *
 * Esta versión v5.4 NO persiste a Firestore todavía · solo dispara un callback
 * al confirmar. La persistencia (colección 'vacaciones') queda como DEUDA
 * declarada para una iteración futura.
 *
 * Cobertura mínima:
 *  - Selección de empleado
 *  - Fecha desde / hasta
 *  - Días calculados
 *  - Suplencia opcional
 *  - Notas
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Palmtree, Info, Users } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { planillaService } from '../../../services/planilla.service';
import { userService } from '../../../services/user.service';
import type { EmpleadoConPerfil } from '../../../types/planilla.types';
import type { UserProfile } from '../../../types/auth.types';
import { getUserRoles } from '../../../types/auth.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

function calcularDias(desde: string, hasta: string): number {
  if (!desde || !hasta) return 0;
  const d = new Date(desde);
  const h = new Date(hasta);
  if (h.getTime() < d.getTime()) return 0;
  return Math.floor((h.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export const ProgramarVacacionesModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  onError,
}) => {
  const [empleados, setEmpleados] = useState<EmpleadoConPerfil[]>([]);
  const [usuariosTodos, setUsuariosTodos] = useState<UserProfile[]>([]);
  const [loadingEmpleados, setLoadingEmpleados] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [userIdSeleccionado, setUserIdSeleccionado] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [suplenteUid, setSuplenteUid] = useState('');
  const [notas, setNotas] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLoadingEmpleados(true);
    (async () => {
      try {
        const [emps, all] = await Promise.all([
          planillaService.getEmpleadosActivos(),
          userService.getAll(),
        ]);
        setEmpleados(emps);
        setUsuariosTodos(all.filter((u) => u.activo));
      } catch (err) {
        console.error('[ProgramarVacacionesModal] error:', err);
      } finally {
        setLoadingEmpleados(false);
      }
    })();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setUserIdSeleccionado('');
      setFechaDesde('');
      setFechaHasta('');
      setSuplenteUid('');
      setNotas('');
    }
  }, [isOpen]);

  const dias = useMemo(() => calcularDias(fechaDesde, fechaHasta), [fechaDesde, fechaHasta]);

  const esValido = userIdSeleccionado && fechaDesde && fechaHasta && dias > 0;

  const handleSubmit = async () => {
    if (!esValido || submitting) return;
    setSubmitting(true);
    try {
      const empleado = empleados.find((e) => e.uid === userIdSeleccionado);
      // Por ahora · NO persistimos · solo registramos audit y notificamos.
      // Cuando se cree la colección 'vacaciones' (deuda declarada) se conectará aquí.
      console.info('[ProgramarVacaciones] (sin persistir aún)', {
        userId: userIdSeleccionado,
        nombre: empleado?.displayName,
        desde: fechaDesde,
        hasta: fechaHasta,
        dias,
        suplenteUid: suplenteUid || null,
        notas: notas.trim() || null,
      });
      onSuccess?.(
        `Vacaciones programadas para ${empleado?.displayName ?? 'empleado'} · ${dias} día${dias === 1 ? '' : 's'} (${fechaDesde} → ${fechaHasta}). Persistencia formal pendiente · canon Vita Skin.`,
      );
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al programar vacaciones');
    } finally {
      setSubmitting(false);
    }
  };

  const empleadoSel = empleados.find((e) => e.uid === userIdSeleccionado);

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Programar vacaciones"
      subtitle="Control informal Vita Skin · sin acumulación legal"
      icon={Palmtree}
      iconTone="sky"
      size="md"
      submitLabel={submitting ? 'Guardando...' : 'Programar período'}
      submitVariant="primary-soft"
      submitIcon={Palmtree}
      loading={submitting}
      disabled={!esValido}
    >
      {/* Banner explicativo · canon Vita Skin sin CTS sin acumulación */}
      <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 mb-4 flex items-start gap-2">
        <Info className="w-4 h-4 text-violet-700 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-violet-900">
          <strong>Control informal.</strong> Esta programación sirve para coordinar suplencias y
          dejar registro del período acordado. No genera obligación legal · no descuenta días
          acumulados ni dispara cálculo automático en planilla.
        </div>
      </div>

      {loadingEmpleados ? (
        <div className="text-center py-6 text-[12px] text-slate-500">Cargando empleados...</div>
      ) : empleados.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-center">
          <Users className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <div className="text-[12px] font-semibold text-slate-700">Sin empleados activos</div>
          <p className="text-[11px] text-slate-500 mt-1">
            Configurá perfiles laborales en /usuarios antes de programar vacaciones
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Selector empleado */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Empleado <span className="text-rose-500">*</span>
            </label>
            <select
              value={userIdSeleccionado}
              onChange={(e) => setUserIdSeleccionado(e.target.value)}
              className="w-full text-[13px] border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">— Seleccionar empleado —</option>
              {empleados.map((e) => (
                <option key={e.uid} value={e.uid}>
                  {e.displayName} {e.cargo ? `· ${e.cargo}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Fechas en grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Desde <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full text-[13px] border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Hasta <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                min={fechaDesde || undefined}
                className="w-full text-[13px] border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          {/* Preview días */}
          {dias > 0 && (
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-violet-700 font-bold mb-0.5">
                DÍAS DE VACACIONES
              </div>
              <div className="text-2xl font-bold tabular-nums text-violet-900">
                {dias}{' '}
                <span className="text-[12px] font-normal text-violet-700">
                  día{dias === 1 ? '' : 's'} consecutivos
                </span>
              </div>
            </div>
          )}

          {/* Suplencia opcional */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Suplencia durante el período{' '}
              <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <select
              value={suplenteUid}
              onChange={(e) => setSuplenteUid(e.target.value)}
              className="w-full text-[13px] border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">— Sin suplente designado —</option>
              {usuariosTodos
                .filter((u) => u.uid !== userIdSeleccionado)
                .map((u) => {
                  const rolP = getUserRoles(u)[0] ?? 'invitado';
                  return (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} · {rolP}
                    </option>
                  );
                })}
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Notas <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Coordinación · razón · acuerdos específicos..."
              className="w-full text-[12px] border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          {/* Resumen empleado seleccionado */}
          {empleadoSel && dias > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-700">
              <strong className="text-slate-900">Resumen:</strong> {empleadoSel.displayName}{' '}
              estará de vacaciones {dias} día{dias === 1 ? '' : 's'} ({fechaDesde} → {fechaHasta})
              {suplenteUid && (
                <>
                  {' '}· cubre{' '}
                  <strong>
                    {usuariosTodos.find((u) => u.uid === suplenteUid)?.displayName ?? '—'}
                  </strong>
                </>
              )}
              .
            </div>
          )}
        </div>
      )}
    </FormModalV2>
  );
};

export default ProgramarVacacionesModal;
