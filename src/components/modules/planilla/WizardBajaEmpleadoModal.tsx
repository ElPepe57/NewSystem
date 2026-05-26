/**
 * WizardBajaEmpleadoModal.tsx
 *
 * chk5.PERSONAS-v5.4 · F5.C · 2026-05-26
 *
 * Wizard 4 pasos canon FormModalV2 red · Da de baja a un empleado.
 *
 * Pasos:
 *  1. Empleado + tipo de baja + fecha efectiva
 *  2. Conceptos (auto-sugeridos + edición manual)
 *  3. Resumen + validaciones (adelantos pendientes · sueldo trunca · etc)
 *  4. Confirmación con typed-confirm (escribir nombre del empleado)
 *
 * Autoguardado: BorradorWizard tipo 'baja_empleado'.
 *
 * Workflow post-confirm:
 *  - Crea LiquidacionEmpleado en estado 'borrador'
 *  - Gerente aprueba después (UI futura del tab Análisis o desde drill)
 *  - Cloud Function ejecutarLiquidacion (F9) hace el pago + desactiva perfil
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  UserX,
  ChevronLeft,
  ChevronRight,
  Save,
  Trash2,
  Plus,
  AlertTriangle,
  Info,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { liquidacionService, calcularTotalesLiquidacion } from '../../../services/liquidacion.service';
import { planillaService } from '../../../services/planilla.service';
import { borradorWizardService } from '../../../services/borradorWizard.service';
import type {
  EmpleadoConPerfil,
  TipoBaja,
  ConceptoLiquidacion,
  AdelantoNomina,
} from '../../../types/planilla.types';
import { TIPO_BAJA_LABELS } from '../../../types/planilla.types';
import { formatCurrencyPEN } from '../../../utils/format';
import { useAuthStore } from '../../../store/authStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

interface WizardState {
  paso: 1 | 2 | 3 | 4;
  userId: string;
  empleadoNombre: string;
  tipoBaja: TipoBaja;
  fechaEfectiva: string;
  razon: string;
  conceptos: ConceptoLiquidacion[];
  confirmacionTexto: string;
}

const INITIAL: WizardState = {
  paso: 1,
  userId: '',
  empleadoNombre: '',
  tipoBaja: 'renuncia',
  fechaEfectiva: new Date().toISOString().slice(0, 10),
  razon: '',
  conceptos: [],
  confirmacionTexto: '',
};

/**
 * Sugiere conceptos típicos de una liquidación Vita Skin.
 * Salario proporcional (positivo · pagar) · adelantos pendientes (negativo · descontar).
 */
function sugerirConceptos(
  empleado: EmpleadoConPerfil | null,
  fechaEfectiva: string,
  adelantosPendientes: AdelantoNomina[],
): ConceptoLiquidacion[] {
  const conceptos: ConceptoLiquidacion[] = [];
  const fecha = new Date(fechaEfectiva);
  const diaDelMes = fecha.getDate();
  const diasTotalMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
  const salario = empleado?.perfilLaboral?.salarioBase ?? 0;

  if (salario > 0) {
    const proporcional = Number(((salario * diaDelMes) / diasTotalMes).toFixed(2));
    conceptos.push({
      concepto: 'Sueldo proporcional del mes',
      descripcion: `${diaDelMes}/${diasTotalMes} días trabajados · S/ ${salario.toLocaleString('es-PE')} mensual`,
      monto: proporcional,
    });
  }

  // Descuento de adelantos pendientes
  const totalAdelantos = adelantosPendientes.reduce((s, a) => s + a.montoPEN, 0);
  if (totalAdelantos > 0) {
    conceptos.push({
      concepto: 'Adelantos pendientes',
      descripcion: `${adelantosPendientes.length} adelanto(s) pendiente(s) de descuento`,
      monto: -totalAdelantos,
    });
  }

  return conceptos;
}

export const WizardBajaEmpleadoModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  onError,
}) => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [state, setState] = useState<WizardState>(INITIAL);
  const [empleados, setEmpleados] = useState<EmpleadoConPerfil[]>([]);
  const [adelantosPendientes, setAdelantosPendientes] = useState<AdelantoNomina[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [autoSave, setAutoSave] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Cargar empleados + borrador al abrir
  useEffect(() => {
    if (!isOpen || !userProfile) return;
    (async () => {
      try {
        const [emps, borrador] = await Promise.all([
          planillaService.getEmpleadosActivos(),
          borradorWizardService.get(userProfile.uid, 'baja_empleado'),
        ]);
        setEmpleados(emps);
        if (borrador?.estado) {
          setState({ ...INITIAL, ...(borrador.estado as Partial<WizardState>) });
        } else {
          setState(INITIAL);
        }
      } catch (err) {
        console.error('[WizardBajaEmpleadoModal] error cargando:', err);
      }
    })();
  }, [isOpen, userProfile]);

  // Cuando el user selecciona empleado · cargar sus adelantos pendientes
  useEffect(() => {
    if (!state.userId || !isOpen) {
      setAdelantosPendientes([]);
      return;
    }
    (async () => {
      try {
        const ads = await planillaService.getAdelantosPendientesDescuento(state.userId);
        setAdelantosPendientes(ads);
      } catch (err) {
        console.error('[WizardBajaEmpleadoModal] error cargando adelantos:', err);
      }
    })();
  }, [state.userId, isOpen]);

  // Sugerir conceptos cuando llega al paso 2 sin conceptos
  useEffect(() => {
    if (state.paso === 2 && state.conceptos.length === 0 && state.userId) {
      const emp = empleados.find((e) => e.uid === state.userId);
      const sugeridos = sugerirConceptos(emp ?? null, state.fechaEfectiva, adelantosPendientes);
      setState((s) => ({ ...s, conceptos: sugeridos }));
    }
  }, [state.paso, state.conceptos.length, state.userId, state.fechaEfectiva, empleados, adelantosPendientes]);

  // Autoguardado a cada cambio
  useEffect(() => {
    if (!isOpen || !userProfile || state === INITIAL) return;
    setAutoSave('saving');
    const t = window.setTimeout(async () => {
      try {
        await borradorWizardService.save({
          tipo: 'baja_empleado',
          userId: userProfile.uid,
          pasoActual: state.paso,
          estado: state as unknown as Record<string, any>,
          resumen: state.empleadoNombre
            ? `Baja · ${state.empleadoNombre} (${TIPO_BAJA_LABELS[state.tipoBaja]})`
            : 'Baja (sin empleado)',
        });
        setAutoSave('saved');
      } catch (err) {
        console.error('[WizardBajaEmpleadoModal] error guardando borrador:', err);
        setAutoSave('idle');
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [state, isOpen, userProfile]);

  // ───── Validaciones ─────
  const validacionPaso = useMemo(() => {
    if (state.paso === 1) return state.userId !== '' && state.fechaEfectiva !== '';
    if (state.paso === 2) return state.conceptos.length > 0;
    if (state.paso === 3) return true;
    if (state.paso === 4)
      return state.confirmacionTexto.trim().toLowerCase() === state.empleadoNombre.trim().toLowerCase();
    return false;
  }, [state]);

  const totales = useMemo(() => calcularTotalesLiquidacion(state.conceptos), [state.conceptos]);

  // ───── Navegación ─────
  const siguiente = () => state.paso < 4 && setState((s) => ({ ...s, paso: (s.paso + 1) as 1 | 2 | 3 | 4 }));
  const anterior = () => state.paso > 1 && setState((s) => ({ ...s, paso: (s.paso - 1) as 1 | 2 | 3 | 4 }));

  // ───── Submit ─────
  const ejecutarBaja = async () => {
    if (!validacionPaso || submitting || !userProfile) return;
    setSubmitting(true);
    try {
      const liquidacion = await liquidacionService.crearBorrador(
        {
          userId: state.userId,
          empleadoNombre: state.empleadoNombre,
          tipoBaja: state.tipoBaja,
          fechaEfectiva: new Date(state.fechaEfectiva),
          razon: state.razon.trim() || undefined,
          conceptos: state.conceptos,
          moneda: 'PEN',
        },
        userProfile.uid,
      );
      await borradorWizardService.delete(userProfile.uid, 'baja_empleado');
      onSuccess?.(
        `Liquidación creada · ${state.empleadoNombre} · neto ${formatCurrencyPEN(liquidacion.netoALiquidar)}. Pendiente de aprobación gerencial antes del pago.`,
      );
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al crear liquidación');
    } finally {
      setSubmitting(false);
    }
  };

  const descartar = async () => {
    if (!userProfile) return;
    if (!window.confirm('¿Descartar este borrador? El progreso se perderá.')) return;
    try {
      await borradorWizardService.delete(userProfile.uid, 'baja_empleado');
      setState(INITIAL);
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al descartar borrador');
    }
  };

  // ───── Stepper ─────
  const stepperUI = (
    <div className="flex items-center gap-2 px-1 py-3">
      {[
        { n: 1, label: 'Empleado' },
        { n: 2, label: 'Conceptos' },
        { n: 3, label: 'Resumen' },
        { n: 4, label: 'Confirmar' },
      ].map((step, idx) => {
        const activo = state.paso === step.n;
        const completo = state.paso > step.n;
        return (
          <React.Fragment key={step.n}>
            <div
              className={`flex items-center gap-2 px-2 py-1 rounded ${
                activo
                  ? 'bg-rose-100 text-rose-900 font-bold'
                  : completo
                    ? 'text-emerald-700 font-semibold'
                    : 'text-slate-400'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center ${
                  activo
                    ? 'bg-rose-600 text-white'
                    : completo
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {completo ? '✓' : step.n}
              </div>
              <span className="text-[11px] hidden sm:inline">{step.label}</span>
            </div>
            {idx < 3 && <div className="flex-1 h-px bg-slate-200" />}
          </React.Fragment>
        );
      })}
    </div>
  );

  // ───── Paso 1 ─────
  const paso1 = (
    <div className="space-y-4">
      <div className="bg-rose-50 border border-rose-200 rounded p-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-rose-900">
          <strong>Acción irreversible.</strong> Al confirmar la baja · el perfil laboral del
          empleado se desactiva · sus adelantos pendientes se descuentan en la liquidación · y
          no podrá generar boletas futuras. Requiere aprobación gerencial antes del pago.
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          Empleado a dar de baja <span className="text-rose-500">*</span>
        </label>
        <select
          value={state.userId}
          onChange={(e) => {
            const emp = empleados.find((x) => x.uid === e.target.value);
            setState((s) => ({
              ...s,
              userId: e.target.value,
              empleadoNombre: emp?.displayName ?? '',
              conceptos: [], // reset conceptos al cambiar empleado
            }));
          }}
          className="w-full text-[13px] border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <option value="">— Seleccionar empleado activo —</option>
          {empleados.map((e) => (
            <option key={e.uid} value={e.uid}>
              {e.displayName} {e.cargo ? `· ${e.cargo}` : ''} {e.perfilLaboral?.salarioBase ? `· S/ ${e.perfilLaboral.salarioBase.toLocaleString('es-PE')}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          Tipo de baja <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {(Object.entries(TIPO_BAJA_LABELS) as [TipoBaja, string][]).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => setState((s) => ({ ...s, tipoBaja: t }))}
              className={`text-[11px] px-2 py-1.5 rounded border transition-colors ${
                state.tipoBaja === t
                  ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold ring-1 ring-rose-200'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          Fecha efectiva <span className="text-rose-500">*</span>
        </label>
        <input
          type="date"
          value={state.fechaEfectiva}
          onChange={(e) => setState((s) => ({ ...s, fechaEfectiva: e.target.value, conceptos: [] }))}
          className="w-full text-[13px] border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
        <p className="text-[10px] text-slate-500 mt-1">
          Último día efectivo de trabajo · usado para calcular sueldo proporcional
        </p>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          Razón <span className="text-slate-400 font-normal">(opcional)</span>
        </label>
        <textarea
          value={state.razon}
          onChange={(e) => setState((s) => ({ ...s, razon: e.target.value }))}
          rows={2}
          placeholder="Contexto de la baja · acuerdos · referencia a decisión gerencial"
          className="w-full text-[12px] border border-slate-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
      </div>
    </div>
  );

  // ───── Paso 2 ─────
  const paso2 = (
    <div className="space-y-3">
      <div className="bg-sky-50 border border-sky-200 rounded p-2 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-sky-700 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-sky-900">
          Conceptos sugeridos automáticamente. Podés editar montos · agregar nuevos · o eliminar.
          Positivos = pagar al empleado · negativos = descontar.
        </div>
      </div>

      {adelantosPendientes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <strong>{adelantosPendientes.length} adelanto(s) pendiente(s)</strong> · total{' '}
            {formatCurrencyPEN(adelantosPendientes.reduce((s, a) => s + a.montoPEN, 0))}. Ya
            están incluidos como descuento en los conceptos sugeridos.
          </div>
        </div>
      )}

      <div className="space-y-2">
        {state.conceptos.map((c, i) => (
          <div
            key={i}
            className={`bg-white border rounded p-2.5 ${
              c.monto >= 0 ? 'border-emerald-200' : 'border-rose-200'
            }`}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0 space-y-1">
                <input
                  type="text"
                  value={c.concepto}
                  onChange={(e) => {
                    const conceptos = [...state.conceptos];
                    conceptos[i] = { ...c, concepto: e.target.value };
                    setState((s) => ({ ...s, conceptos }));
                  }}
                  className="w-full text-[12px] font-semibold text-slate-900 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                <input
                  type="text"
                  value={c.descripcion ?? ''}
                  onChange={(e) => {
                    const conceptos = [...state.conceptos];
                    conceptos[i] = { ...c, descripcion: e.target.value };
                    setState((s) => ({ ...s, conceptos }));
                  }}
                  placeholder="Descripción · detalle del cálculo"
                  className="w-full text-[10px] text-slate-600 border border-slate-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <input
                  type="number"
                  value={c.monto}
                  step={0.01}
                  onChange={(e) => {
                    const conceptos = [...state.conceptos];
                    conceptos[i] = { ...c, monto: Number(e.target.value) };
                    setState((s) => ({ ...s, conceptos }));
                  }}
                  className={`w-28 text-[12px] tabular-nums font-bold text-right border rounded px-2 py-1 ${
                    c.monto >= 0
                      ? 'border-emerald-300 text-emerald-700'
                      : 'border-rose-300 text-rose-700'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setState((s) => ({
                      ...s,
                      conceptos: s.conceptos.filter((_, idx) => idx !== i),
                    }));
                  }}
                  className="text-rose-600 hover:bg-rose-50 p-1 rounded"
                  title="Eliminar concepto"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          setState((s) => ({
            ...s,
            conceptos: [...s.conceptos, { concepto: '', monto: 0 }],
          }))
        }
        className="w-full text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-dashed border-slate-300 rounded py-1.5 inline-flex items-center justify-center gap-1"
      >
        <Plus className="w-3 h-3" />
        Agregar concepto manual
      </button>

      {/* Totales */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <div className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">A pagar</div>
          <div className="text-[14px] tabular-nums font-bold text-emerald-700">
            {formatCurrencyPEN(totales.totalBruto)}
          </div>
        </div>
        <div>
          <div className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">Descuentos</div>
          <div className="text-[14px] tabular-nums font-bold text-rose-700">
            −{formatCurrencyPEN(totales.totalDescuentos)}
          </div>
        </div>
        <div className="border-l border-slate-300 pl-2">
          <div className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">NETO</div>
          <div className="text-[16px] tabular-nums font-bold text-slate-900">
            {formatCurrencyPEN(totales.netoALiquidar)}
          </div>
        </div>
      </div>
    </div>
  );

  // ───── Paso 3 ─────
  const paso3 = (
    <div className="space-y-3">
      <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-rose-700 font-bold">BAJA DE EMPLEADO</div>
        <div className="text-[18px] font-bold text-rose-900">{state.empleadoNombre}</div>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-rose-900">
          <div>
            <span className="text-rose-600">Tipo:</span>{' '}
            <strong>{TIPO_BAJA_LABELS[state.tipoBaja]}</strong>
          </div>
          <div>
            <span className="text-rose-600">Fecha efectiva:</span>{' '}
            <strong>{state.fechaEfectiva}</strong>
          </div>
        </div>
        {state.razon && (
          <div className="text-[11px] text-rose-900">
            <span className="text-rose-600">Razón:</span> {state.razon}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-3">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">
          Conceptos · {state.conceptos.length} líneas
        </div>
        <ul className="space-y-1 text-[11px]">
          {state.conceptos.map((c, i) => (
            <li key={i} className="flex items-center justify-between">
              <span className="text-slate-700 truncate flex-1">{c.concepto}</span>
              <span
                className={`tabular-nums font-bold ml-2 ${
                  c.monto >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {c.monto >= 0 ? '+' : ''}
                {formatCurrencyPEN(c.monto)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-slate-900 text-white rounded-lg p-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">NETO A LIQUIDAR</div>
          <div className="text-[24px] tabular-nums font-bold">
            {formatCurrencyPEN(totales.netoALiquidar)}
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-slate-400" />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-900 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        Al confirmar · se crea la liquidación en estado <strong>borrador</strong>. Necesita
        aprobación gerencial antes de ejecutar el pago. La desactivación del perfil laboral y
        descuento de adelantos ocurre en la ejecución (Cloud Function F9 · futuro).
      </div>
    </div>
  );

  // ───── Paso 4 ─────
  const paso4 = (
    <div className="space-y-4">
      <div className="bg-rose-50 border-2 border-rose-300 rounded-lg p-4 text-center">
        <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-rose-600" />
        <div className="text-[14px] font-bold text-rose-900">Confirmación final</div>
        <p className="text-[11px] text-rose-700 mt-1">
          Para crear la liquidación, escribí el nombre completo del empleado abajo.
        </p>
      </div>

      <div className="bg-slate-100 rounded p-2 text-center">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
          NOMBRE A ESCRIBIR
        </div>
        <div className="text-[14px] font-bold text-slate-900 tabular-nums select-all">
          {state.empleadoNombre}
        </div>
      </div>

      <input
        type="text"
        value={state.confirmacionTexto}
        onChange={(e) => setState((s) => ({ ...s, confirmacionTexto: e.target.value }))}
        placeholder="Escribí el nombre exacto..."
        autoComplete="off"
        autoFocus
        className="w-full text-[13px] border-2 border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200"
      />

      <div className="bg-rose-50 border border-rose-200 rounded p-3 text-[11px] text-rose-900 flex items-start gap-2">
        <Calendar className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Resumen:</strong> {TIPO_BAJA_LABELS[state.tipoBaja]} efectiva el{' '}
          {state.fechaEfectiva} · neto a liquidar{' '}
          <strong>{formatCurrencyPEN(totales.netoALiquidar)}</strong>.
        </div>
      </div>
    </div>
  );

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={state.paso === 4 ? ejecutarBaja : siguiente}
      title="Dar de baja a empleado"
      subtitle={`Paso ${state.paso} de 4 · liquidación con audit trail`}
      icon={UserX}
      iconTone="red"
      size="lg"
      submitLabel={
        state.paso === 4
          ? submitting
            ? 'Creando liquidación...'
            : 'Crear liquidación'
          : 'Siguiente'
      }
      submitVariant={state.paso === 4 ? 'danger-soft' : 'primary-soft'}
      submitIcon={state.paso === 4 ? Save : ChevronRight}
      loading={submitting}
      disabled={!validacionPaso}
      autoSaveStatus={autoSave}
      footerExtras={
        <>
          {state.paso > 1 && (
            <button
              type="button"
              onClick={anterior}
              className="text-[11px] text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-3 h-3" />
              Anterior
            </button>
          )}
          <button
            type="button"
            onClick={descartar}
            className="text-[11px] text-rose-600 hover:text-rose-700 inline-flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Descartar
          </button>
        </>
      }
    >
      {stepperUI}
      {state.paso === 1 && paso1}
      {state.paso === 2 && paso2}
      {state.paso === 3 && paso3}
      {state.paso === 4 && paso4}
    </FormModalV2>
  );
};

export default WizardBajaEmpleadoModal;
