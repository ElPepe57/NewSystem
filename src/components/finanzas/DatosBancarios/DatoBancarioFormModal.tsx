/**
 * DatoBancarioFormModal — F-DatosBanc · S58c
 *
 * Modal para añadir o editar un DatoBancarioPasivo. Usa FormModalV2
 * (banking-grade) y los forms del design system.
 *
 * Comportamiento por tipo:
 *   - 'banco'        → muestra banco, producto, número, CCI
 *   - 'yape' / 'plin'/ 'mercadopago' / 'paypal' / 'zelle' / 'wise'
 *                    → muestra solo identificador (teléfono / email / username)
 *   - 'otro'         → notas libres
 */

import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { TextField } from '../../../design-system/components/forms/TextField';
import { Combobox } from '../../../design-system/components/forms/Combobox';
import { ToggleGroup } from '../../../design-system/components/forms/ToggleGroup';
import type {
  DatoBancarioPasivo,
  DatoBancarioPasivoFormData,
  MonedaTesoreria,
} from '../../../types/tesoreria.types';
import { TIPO_LABEL, type TipoDatoBancario } from './helpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface DatoBancarioFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: DatoBancarioPasivoFormData) => void | Promise<void>;
  /** Si se provee, modo edición. Si no, modo crear. */
  datoEditar?: DatoBancarioPasivo | null;
  /** Tipo de entidad dueña (proveedor/cliente/colaborador/empleado) — solo display. */
  entidadTipo?: 'proveedor' | 'cliente' | 'colaborador' | 'empleado';
  /** Si true, ya hay un dato marcado como principal. Solo display. */
  yaTienePrincipal?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═════════════════════════════════════════════════════════════════════════

const TIPO_OPTIONS: Array<{ value: TipoDatoBancario; label: string }> = [
  { value: 'banco', label: 'Banco' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'wise', label: 'Wise' },
  { value: 'otro', label: 'Otro' },
];

const PRODUCTO_OPTIONS: Array<{
  value: 'cuenta_ahorros' | 'cuenta_corriente';
  label: string;
}> = [
  { value: 'cuenta_ahorros', label: 'Cuenta de ahorros' },
  { value: 'cuenta_corriente', label: 'Cuenta corriente' },
];

const PLACEHOLDER_IDENTIFICADOR: Record<TipoDatoBancario, string> = {
  banco: 'Últimos 4 dígitos · 6411',
  yape: '987 654 321',
  plin: '987 654 321',
  mercadopago: 'usuario o email',
  paypal: 'cuenta@email.com',
  zelle: 'cuenta@email.com',
  wise: 'username o email',
  otro: 'Identificador',
};

// ═════════════════════════════════════════════════════════════════════════
// STATE
// ═════════════════════════════════════════════════════════════════════════

interface FormState {
  tipo: TipoDatoBancario;
  etiqueta: string;
  banco: string;
  bancoNombreCompleto: string;
  moneda: MonedaTesoreria | '';
  productoFinanciero: 'cuenta_ahorros' | 'cuenta_corriente' | '';
  numeroCuenta: string;
  cci: string;
  identificador: string;
  notas: string;
  esPrincipal: boolean;
}

const INITIAL_STATE: FormState = {
  tipo: 'banco',
  etiqueta: '',
  banco: '',
  bancoNombreCompleto: '',
  moneda: 'PEN',
  productoFinanciero: 'cuenta_corriente',
  numeroCuenta: '',
  cci: '',
  identificador: '',
  notas: '',
  esPrincipal: false,
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const DatoBancarioFormModal: React.FC<DatoBancarioFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  datoEditar,
  entidadTipo,
  yaTienePrincipal,
}) => {
  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const [saving, setSaving] = useState(false);

  const isEdit = !!datoEditar;

  // ── Hidratación al abrir ──
  useEffect(() => {
    if (!isOpen) return;
    if (datoEditar) {
      setState({
        tipo: datoEditar.tipo,
        etiqueta: datoEditar.etiqueta,
        banco: datoEditar.banco ?? '',
        bancoNombreCompleto: datoEditar.bancoNombreCompleto ?? '',
        moneda: datoEditar.moneda ?? 'PEN',
        productoFinanciero: datoEditar.productoFinanciero ?? '',
        numeroCuenta: datoEditar.numeroCuenta ?? '',
        cci: datoEditar.cci ?? '',
        identificador: datoEditar.identificador ?? '',
        notas: datoEditar.notas ?? '',
        esPrincipal: datoEditar.esPrincipal ?? false,
      });
    } else {
      setState(INITIAL_STATE);
    }
  }, [isOpen, datoEditar]);

  // ── Etiqueta auto-generada cuando cambia tipo / banco ──
  useEffect(() => {
    if (!isOpen) return;
    // Solo auto-generar en modo crear y si etiqueta está vacía o es la del default previo
    if (isEdit) return;
    let auto = '';
    if (state.tipo === 'banco') {
      const partes: string[] = [];
      if (state.banco) partes.push(state.banco);
      if (state.productoFinanciero === 'cuenta_corriente') partes.push('Cta corriente');
      else if (state.productoFinanciero === 'cuenta_ahorros') partes.push('Cta ahorros');
      if (state.moneda === 'USD') partes.push('USD');
      auto = partes.join(' · ');
    } else {
      auto = TIPO_LABEL[state.tipo];
    }
    if (state.etiqueta === '' || state.etiqueta.startsWith('__auto:')) {
      setState((s) => ({ ...s, etiqueta: auto }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tipo, state.banco, state.productoFinanciero, state.moneda, isOpen]);

  // ── Validación ──
  const valido =
    state.etiqueta.trim().length > 0 &&
    (state.tipo === 'banco'
      ? state.banco.trim().length > 0
      : state.identificador.trim().length > 0 || state.tipo === 'otro');

  // ── Submit ──
  const handleSubmit = async () => {
    if (!valido) return;
    setSaving(true);
    try {
      const data: DatoBancarioPasivoFormData = {
        tipo: state.tipo,
        etiqueta: state.etiqueta.trim(),
      };
      if (state.tipo === 'banco') {
        if (state.banco.trim()) data.banco = state.banco.trim();
        if (state.bancoNombreCompleto.trim())
          data.bancoNombreCompleto = state.bancoNombreCompleto.trim();
        if (state.productoFinanciero)
          data.productoFinanciero = state.productoFinanciero;
        if (state.numeroCuenta.trim())
          data.numeroCuenta = state.numeroCuenta.trim();
        if (state.cci.trim()) data.cci = state.cci.trim();
      }
      if (state.identificador.trim()) {
        data.identificador = state.identificador.trim();
      }
      if (state.moneda) data.moneda = state.moneda;
      if (state.notas.trim()) data.notas = state.notas.trim();
      if (state.esPrincipal) data.esPrincipal = true;

      await onSave(data);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const entidadLabel =
    entidadTipo === 'proveedor'
      ? 'proveedor'
      : entidadTipo === 'cliente'
        ? 'cliente'
        : entidadTipo === 'colaborador'
          ? 'colaborador'
          : entidadTipo === 'empleado'
            ? 'empleado'
            : 'entidad';

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={isEdit ? 'Editar cuenta bancaria' : 'Agregar cuenta bancaria'}
      subtitle={`Datos pasivos del ${entidadLabel} · sin saldo trackeado`}
      icon={Building2}
      iconTone="teal"
      size="md"
      submitLabel={isEdit ? 'Guardar cambios' : 'Agregar cuenta'}
      submitVariant="primary-soft"
      cancelLabel="Cancelar"
      loading={saving}
      disabled={!valido || saving}
    >
      <div className="space-y-4">
        {/* Tipo */}
        <Combobox<TipoDatoBancario>
          label="Tipo"
          value={state.tipo}
          onChange={(v) => setState((s) => ({ ...s, tipo: v }))}
          groups={[{ options: TIPO_OPTIONS }]}
          placeholder="Seleccionar tipo..."
        />

        {/* Etiqueta */}
        <TextField
          label="Etiqueta"
          value={state.etiqueta}
          onChange={(v) => setState((s) => ({ ...s, etiqueta: v }))}
          placeholder="Ej: BCP Cta Corriente · Pago facturas"
          hint="Cómo aparecerá en los listados"
        />

        {/* Campos según tipo */}
        {state.tipo === 'banco' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                label="Banco"
                value={state.banco}
                onChange={(v) => setState((s) => ({ ...s, banco: v }))}
                placeholder="BCP, IBK, BBVA"
              />
              <TextField
                label="Nombre completo"
                value={state.bancoNombreCompleto}
                onChange={(v) =>
                  setState((s) => ({ ...s, bancoNombreCompleto: v }))
                }
                placeholder="Banco de Crédito del Perú"
                optional
              />
            </div>

            <Combobox<'cuenta_ahorros' | 'cuenta_corriente'>
              label="Producto"
              value={state.productoFinanciero || undefined}
              onChange={(v) =>
                setState((s) => ({ ...s, productoFinanciero: v }))
              }
              groups={[{ options: PRODUCTO_OPTIONS }]}
              placeholder="Tipo de cuenta..."
              optional
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                label="Número de cuenta"
                value={state.numeroCuenta}
                onChange={(v) => setState((s) => ({ ...s, numeroCuenta: v }))}
                placeholder="191-1234567-0-12"
                optional
              />
              <TextField
                label="CCI"
                value={state.cci}
                onChange={(v) => setState((s) => ({ ...s, cci: v }))}
                placeholder="002 191 1123456..."
                optional
              />
            </div>
          </>
        ) : (
          <TextField
            label={
              state.tipo === 'yape' || state.tipo === 'plin'
                ? 'Teléfono'
                : state.tipo === 'paypal' || state.tipo === 'zelle'
                  ? 'Email'
                  : state.tipo === 'wise' || state.tipo === 'mercadopago'
                    ? 'Usuario o email'
                    : 'Identificador'
            }
            value={state.identificador}
            onChange={(v) => setState((s) => ({ ...s, identificador: v }))}
            placeholder={PLACEHOLDER_IDENTIFICADOR[state.tipo]}
            optional={state.tipo === 'otro'}
          />
        )}

        {/* Moneda */}
        <ToggleGroup<MonedaTesoreria>
          label="Moneda"
          value={(state.moneda || 'PEN') as MonedaTesoreria}
          onChange={(v) => setState((s) => ({ ...s, moneda: v }))}
          options={[
            { value: 'PEN', label: 'PEN · Soles' },
            { value: 'USD', label: 'USD · Dólares' },
          ]}
          fullWidth={false}
          hint="Solo informativo. No afecta saldo."
        />

        {/* Notas */}
        <TextField
          label="Notas"
          value={state.notas}
          onChange={(v) => setState((s) => ({ ...s, notas: v }))}
          placeholder="Ej: preferida para pagos > S/ 5,000"
          optional
        />

        {/* Principal */}
        <label className="flex items-start gap-2 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={state.esPrincipal}
            onChange={(e) =>
              setState((s) => ({ ...s, esPrincipal: e.target.checked }))
            }
            className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
          />
          <div>
            <div className="text-[12px] font-medium text-slate-900">
              Marcar como principal
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Se sugerirá automáticamente como destino al hacer pagos a este{' '}
              {entidadLabel}.
              {yaTienePrincipal && !state.esPrincipal && !datoEditar?.esPrincipal && (
                <span className="block text-amber-700 mt-0.5">
                  Ya hay otra cuenta marcada como principal. Marcar esta la
                  reemplazará.
                </span>
              )}
            </div>
          </div>
        </label>
      </div>
    </FormModalV2>
  );
};
