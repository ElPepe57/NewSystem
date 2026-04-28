/**
 * TarjetaFormModal — S58d v2
 *
 * Modal flat (no wizard porque son pocos campos) para crear/editar tarjeta
 * de crédito v2. Decisiones aplicadas:
 *   - D-S58-19: SIN saldo inicial (saldo se construye con cargos)
 *   - D-S58-19: SIN límite como tope (solo topeControlUSD opcional)
 *   - Titularidad PRIMERO (ramifica el resto del form)
 *   - TC del día NO se pide (auto en cargos vía tipoCambio.service)
 */

import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Building, IdCard, Truck, User, Users as UsersIcon } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { TextField } from '../../../design-system/components/forms/TextField';
import { MoneyField } from '../../../design-system/components/forms/MoneyField';
import { ToggleGroup } from '../../../design-system/components/forms/ToggleGroup';
import { Combobox } from '../../../design-system/components/forms/Combobox';
import { cuentaCorrienteService } from '../../../services/cuentaCorriente.service';
import type { CuentaCorriente, TipoEntidadCC } from '../../../types/cuentaCorriente.types';
import type {
  TarjetaCredito,
  TarjetaCreditoFormData,
  MarcaTC,
  TitularidadTC,
  TipoEntidadTitularTC,
} from '../../../types/tarjetaCredito.types';
import type { MonedaTesoreria } from '../../../types/tesoreria.types';
import { cn } from '../../../design-system/utils';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface TarjetaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGuardar: (data: TarjetaCreditoFormData, editingId: string | null) => Promise<void>;
  /** Si presente, modo edición. */
  tarjetaEditar?: TarjetaCredito | null;
  isSubmitting?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═════════════════════════════════════════════════════════════════════════

const MARCA_OPTIONS: Array<{ value: MarcaTC; label: string }> = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Master' },
  { value: 'amex', label: 'Amex' },
  { value: 'diners', label: 'Diners' },
  { value: 'otro', label: 'Otro' },
];

const TIPO_ENTIDAD_OPTIONS = [
  { value: 'empleado' as const, label: 'Empleado', icon: IdCard },
  { value: 'colaborador' as const, label: 'Colaborador', icon: UsersIcon },
  { value: 'proveedor' as const, label: 'Proveedor', icon: Truck },
  { value: 'cliente' as const, label: 'Cliente', icon: User },
];

// ═════════════════════════════════════════════════════════════════════════
// STATE
// ═════════════════════════════════════════════════════════════════════════

interface FormState {
  titularidad: TitularidadTC;
  titularEntidadId: string;
  titularEntidadTipo: TipoEntidadTitularTC | undefined;
  titularNombre: string;

  banco: string;
  bancoNombreCompleto: string;
  ultimosDigitos: string;
  nombre: string;
  marca: MarcaTC | undefined;
  moneda: MonedaTesoreria;
  esBiMoneda: boolean;

  topeControlUSD: number;
  topeControlPEN: number;

  diaCorte: number;
  diaPago: number;

  activa: boolean;
}

const INITIAL_STATE: FormState = {
  titularidad: 'empresa',
  titularEntidadId: '',
  titularEntidadTipo: undefined,
  titularNombre: 'Vita Skin Peru SAC',

  banco: '',
  bancoNombreCompleto: '',
  ultimosDigitos: '',
  nombre: '',
  marca: 'visa',
  moneda: 'USD',
  esBiMoneda: false,

  topeControlUSD: 0,
  topeControlPEN: 0,

  diaCorte: 5,
  diaPago: 28,

  activa: true,
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const TarjetaFormModal: React.FC<TarjetaFormModalProps> = ({
  isOpen,
  onClose,
  onGuardar,
  tarjetaEditar,
  isSubmitting,
}) => {
  const isEdit = !!tarjetaEditar;

  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);

  // Cargar entidades CC del tipo seleccionado para el combobox
  const [entidadesCC, setEntidadesCC] = useState<CuentaCorriente[]>([]);
  const [entidadesLoading, setEntidadesLoading] = useState(false);

  // ── Hidratación al abrir ──
  useEffect(() => {
    if (!isOpen) return;
    if (tarjetaEditar) {
      setState({
        titularidad: tarjetaEditar.titularidad ?? 'empresa',
        titularEntidadId: tarjetaEditar.titularEntidadId ?? '',
        titularEntidadTipo: tarjetaEditar.titularEntidadTipo,
        titularNombre: tarjetaEditar.titularNombre ?? 'Vita Skin Peru SAC',
        banco: tarjetaEditar.banco,
        bancoNombreCompleto: tarjetaEditar.bancoNombreCompleto ?? '',
        ultimosDigitos: tarjetaEditar.ultimosDigitos,
        nombre: tarjetaEditar.nombre,
        marca: tarjetaEditar.marca,
        moneda: tarjetaEditar.moneda,
        esBiMoneda: tarjetaEditar.esBiMoneda ?? false,
        topeControlUSD: tarjetaEditar.topeControlUSD ?? 0,
        topeControlPEN: tarjetaEditar.topeControlPEN ?? 0,
        diaCorte: tarjetaEditar.diaCorte,
        diaPago: tarjetaEditar.diaPago,
        activa: tarjetaEditar.activa,
      });
    } else {
      setState(INITIAL_STATE);
    }
  }, [isOpen, tarjetaEditar]);

  // ── Cargar entidades CC cuando cambia tipo titular ──
  useEffect(() => {
    if (state.titularidad !== 'personal' || !state.titularEntidadTipo) {
      setEntidadesCC([]);
      return;
    }
    let cancelled = false;
    setEntidadesLoading(true);
    cuentaCorrienteService
      .getAll({ tipo: state.titularEntidadTipo as TipoEntidadCC })
      .then((list) => {
        if (!cancelled) setEntidadesCC(list);
      })
      .catch(() => {
        if (!cancelled) setEntidadesCC([]);
      })
      .finally(() => {
        if (!cancelled) setEntidadesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state.titularidad, state.titularEntidadTipo]);

  // ── Auto-generar nombre interno cuando cambia banco/marca/últimos4 ──
  useEffect(() => {
    if (isEdit) return; // no sobrescribir al editar
    if (state.nombre.trim() === '' || state.nombre.startsWith('__auto:')) {
      const partes: string[] = [];
      if (state.banco) partes.push(state.banco);
      if (state.marca && state.marca !== 'otro') {
        partes.push(state.marca.charAt(0).toUpperCase() + state.marca.slice(1));
      }
      if (state.titularidad === 'personal' && state.titularNombre) {
        partes.push(state.titularNombre.split(' ')[0]);
      }
      if (state.ultimosDigitos) partes.push(`····${state.ultimosDigitos}`);
      setState((s) => ({ ...s, nombre: partes.join(' ') }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.banco,
    state.marca,
    state.ultimosDigitos,
    state.titularidad,
    state.titularNombre,
  ]);

  // ── Validación ──
  const valido = useMemo(() => {
    if (!state.banco.trim()) return false;
    if (!state.ultimosDigitos.trim() || state.ultimosDigitos.length !== 4)
      return false;
    if (!state.nombre.trim()) return false;
    if (state.titularidad === 'personal' && !state.titularEntidadId) return false;
    if (state.diaCorte < 1 || state.diaCorte > 31) return false;
    if (state.diaPago < 1 || state.diaPago > 31) return false;
    return true;
  }, [state]);

  // ── Handlers ──
  const handleSeleccionarEntidad = (entidadId: string) => {
    const cc = entidadesCC.find((e) => e.entidadId === entidadId);
    if (!cc) return;
    setState((s) => ({
      ...s,
      titularEntidadId: cc.entidadId,
      titularNombre: cc.entidadNombre,
    }));
  };

  const handleTitularidad = (titularidad: TitularidadTC) => {
    setState((s) => ({
      ...s,
      titularidad,
      ...(titularidad === 'empresa'
        ? {
            titularEntidadId: '',
            titularEntidadTipo: undefined,
            titularNombre: 'Vita Skin Peru SAC',
          }
        : { titularNombre: '' }),
    }));
  };

  const handleSubmit = async () => {
    if (!valido) return;
    setLoading(true);
    try {
      const data: TarjetaCreditoFormData = {
        nombre: state.nombre.trim(),
        banco: state.banco.trim(),
        ultimosDigitos: state.ultimosDigitos,
        moneda: state.moneda,
        esBiMoneda: state.esBiMoneda,
        diaCorte: state.diaCorte,
        diaPago: state.diaPago,
        activa: state.activa,
        // Legacy (preservar pero sin uso real)
        limiteUSD: 0,
      };
      if (state.bancoNombreCompleto.trim())
        data.bancoNombreCompleto = state.bancoNombreCompleto.trim();
      if (state.marca) data.marca = state.marca;
      if (state.titularidad) data.titularidad = state.titularidad;
      if (state.titularidad === 'personal') {
        if (state.titularEntidadId) data.titularEntidadId = state.titularEntidadId;
        if (state.titularEntidadTipo)
          data.titularEntidadTipo = state.titularEntidadTipo;
      }
      if (state.titularNombre.trim())
        data.titularNombre = state.titularNombre.trim();
      if (state.topeControlUSD > 0) data.topeControlUSD = state.topeControlUSD;
      if (state.topeControlPEN > 0) data.topeControlPEN = state.topeControlPEN;

      await onGuardar(data, tarjetaEditar?.id ?? null);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const submitting = loading || !!isSubmitting;
  const esPersonal = state.titularidad === 'personal';

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={isEdit ? 'Editar tarjeta de crédito' : 'Nueva tarjeta de crédito'}
      subtitle="Cash flow · Tarjetas"
      icon={CreditCard}
      iconTone="teal"
      size="md"
      submitLabel={isEdit ? 'Guardar cambios' : 'Crear tarjeta'}
      submitVariant="primary-soft"
      cancelLabel="Cancelar"
      loading={submitting}
      disabled={!valido || submitting}
    >
      <div className="space-y-5">
        {/* Titularidad PRIMERO (ramifica el form) */}
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
            Titularidad ⭐
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTitularidad('empresa')}
              className={cn(
                'p-3 border-2 rounded-lg text-left transition-all',
                state.titularidad === 'empresa'
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50',
              )}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <Building
                  className={cn(
                    'w-4 h-4',
                    state.titularidad === 'empresa'
                      ? 'text-teal-700'
                      : 'text-slate-500',
                  )}
                />
                <span
                  className={cn(
                    'text-[12px]',
                    state.titularidad === 'empresa'
                      ? 'font-semibold text-teal-700'
                      : 'font-medium text-slate-700',
                  )}
                >
                  Empresarial
                </span>
              </div>
              <div className="text-[10px] text-slate-500">
                TC del negocio. Pago va al banco emisor.
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleTitularidad('personal')}
              className={cn(
                'p-3 border-2 rounded-lg text-left transition-all',
                state.titularidad === 'personal'
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50',
              )}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <IdCard
                  className={cn(
                    'w-4 h-4',
                    state.titularidad === 'personal'
                      ? 'text-teal-700'
                      : 'text-slate-500',
                  )}
                />
                <span
                  className={cn(
                    'text-[12px]',
                    state.titularidad === 'personal'
                      ? 'font-semibold text-teal-700'
                      : 'font-medium text-slate-700',
                  )}
                >
                  Personal · de empleado/colaborador
                </span>
              </div>
              <div className="text-[10px] text-slate-500">
                TC del titular. Pago = reembolso al titular.
              </div>
            </button>
          </div>
        </div>

        {/* Selector de titular si personal */}
        {esPersonal && (
          <div className="space-y-3 pl-3 border-l-2 border-teal-200">
            <ToggleGroup
              label="Tipo de entidad"
              value={state.titularEntidadTipo ?? 'empleado'}
              onChange={(v) =>
                setState((s) => ({
                  ...s,
                  titularEntidadTipo: v as TipoEntidadTitularTC,
                  titularEntidadId: '',
                  titularNombre: '',
                }))
              }
              options={TIPO_ENTIDAD_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
                icon: o.icon,
              }))}
            />

            {state.titularEntidadTipo && (
              <Combobox
                label={`Buscar ${state.titularEntidadTipo}`}
                value={state.titularEntidadId}
                onChange={handleSeleccionarEntidad}
                groups={[
                  {
                    label: `${entidadesCC.length} ${state.titularEntidadTipo}${entidadesCC.length === 1 ? '' : 's'}`,
                    options: entidadesCC.map((cc) => ({
                      value: cc.entidadId,
                      label: cc.entidadNombre,
                    })),
                  },
                ]}
                placeholder={
                  entidadesLoading
                    ? 'Cargando...'
                    : entidadesCC.length === 0
                      ? `No hay ${state.titularEntidadTipo}s registrados`
                      : `Seleccionar ${state.titularEntidadTipo}...`
                }
                emptyMessage="Sin resultados"
                disabled={entidadesLoading}
                hint={
                  state.titularNombre
                    ? `El saldo de esta tarjeta se interpretará como deuda con ${state.titularNombre}.`
                    : undefined
                }
              />
            )}
          </div>
        )}

        {/* Banco + nombre + últimos 4 */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-4">
            <TextField
              label="Banco emisor"
              value={state.banco}
              onChange={(v) => setState((s) => ({ ...s, banco: v }))}
              placeholder="BBVA"
            />
          </div>
          <div className="col-span-5">
            <TextField
              label="Nombre interno"
              value={state.nombre}
              onChange={(v) => setState((s) => ({ ...s, nombre: v }))}
              placeholder="BBVA Visa Jose"
            />
          </div>
          <div className="col-span-3">
            <TextField
              label="Últimos 4"
              value={state.ultimosDigitos}
              onChange={(v) => {
                const cleaned = v.replace(/\D/g, '').slice(0, 4);
                setState((s) => ({ ...s, ultimosDigitos: cleaned }));
              }}
              placeholder="6411"
              className="text-center font-mono"
            />
          </div>
        </div>

        {/* Marca + moneda */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
              Marca
            </label>
            <ToggleGroup<MarcaTC>
              value={state.marca ?? 'visa'}
              onChange={(v) => setState((s) => ({ ...s, marca: v }))}
              options={MARCA_OPTIONS}
              size="sm"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
              Moneda principal
            </label>
            <ToggleGroup<MonedaTesoreria>
              value={state.moneda}
              onChange={(v) => setState((s) => ({ ...s, moneda: v }))}
              options={[
                { value: 'USD', label: 'USD' },
                { value: 'PEN', label: 'PEN' },
              ]}
              fullWidth
            />
          </div>
        </div>

        {/* Bi-moneda toggle */}
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={state.esBiMoneda}
            onChange={(e) =>
              setState((s) => ({ ...s, esBiMoneda: e.target.checked }))
            }
            className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
          />
          <div>
            <div className="text-[12px] font-medium text-slate-900">
              Tarjeta bi-moneda
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Acumula saldos USD y PEN simultáneos. Típico en cuentas
              corrientes empresariales BCP/IBK/BBVA.
            </div>
          </div>
        </label>

        {/* Tope de control */}
        <div>
          <MoneyField
            label="Tope de control (opcional · NO es el límite del banco)"
            value={state.topeControlUSD || undefined}
            onChange={(v) =>
              setState((s) => ({ ...s, topeControlUSD: v ?? 0 }))
            }
            moneda={state.moneda}
            optional
            hint="Monto MÁXIMO de cargos del negocio acumulados antes de alertar. Si lo dejas vacío, no hay alerta. NO bloquea operaciones."
          />
        </div>

        {/* Ciclo */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
              Día de corte
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={state.diaCorte}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  diaCorte: parseInt(e.target.value) || 5,
                }))
              }
              className="w-full h-10 px-3 text-sm border border-slate-300 rounded-md bg-white tabular-nums text-center focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
            <div className="text-[10px] text-slate-500 mt-1">
              Referencial · estado de cuenta del titular
            </div>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
              Día de pago al banco
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={state.diaPago}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  diaPago: parseInt(e.target.value) || 28,
                }))
              }
              className="w-full h-10 px-3 text-sm border border-slate-300 rounded-md bg-white tabular-nums text-center focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
            <div className="text-[10px] text-slate-500 mt-1">
              Referencial · cuándo se paga al banco
            </div>
          </div>
        </div>

        {/* Nota informativa */}
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-[11px] text-amber-900">
          <strong>Sin saldo inicial.</strong> El saldo de la tarjeta arranca
          en 0 y se construye con los cargos del negocio que registres. La
          deuda real con el banco emisor (mezclada con personal) no es del
          sistema.
        </div>
      </div>
    </FormModalV2>
  );
};
