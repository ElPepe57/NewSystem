/**
 * Paso 2 — Identidad bancaria + Titularidad · S58c v2
 *
 * Sección A · Identidad: banco, nombre interno, número, CCI (según tipo)
 * Sección B · Titularidad: empresa o personal (con vinculación a entidad CC)
 *
 * El paso de "titularidad personal" del mockup está integrado aquí porque
 * está conceptualmente cerca de la identidad de la cuenta. Si el usuario
 * elige 'empresa', la sección B colapsa y solo se muestra la confirmación.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Building, User, Truck, IdCard, Users as UsersIcon } from 'lucide-react';
import { TextField } from '../../../../../design-system/components/forms/TextField';
import { Combobox } from '../../../../../design-system/components/forms/Combobox';
import { ToggleGroup } from '../../../../../design-system/components/forms/ToggleGroup';
import { tesoreriaService } from '../../../../../services/tesoreria.service';
import { useEntidadesPorTipo } from '../../../../../hooks/useEntidadesPorTipo';
import type { CuentaCaja } from '../../../../../types/tesoreria.types';
import { cn } from '../../../../../design-system/utils';
import type { CuentaWizardState } from './types';

interface Paso2Props {
  state: CuentaWizardState;
  setState: React.Dispatch<React.SetStateAction<CuentaWizardState>>;
}

const TIPO_ENTIDAD_OPTIONS = [
  {
    value: 'empleado',
    label: 'Empleado',
    icon: IdCard,
    color: 'sky',
  },
  {
    value: 'colaborador',
    label: 'Colaborador',
    icon: UsersIcon,
    color: 'purple',
  },
  {
    value: 'proveedor',
    label: 'Proveedor',
    icon: Truck,
    color: 'amber',
  },
  {
    value: 'cliente',
    label: 'Cliente',
    icon: User,
    color: 'teal',
  },
] as const;

export const Paso2Identidad: React.FC<Paso2Props> = ({ state, setState }) => {
  // S58c v2.1 fix — usar stores reales de cada entidad (no CC) para que
  // clientes/empleados/etc. nuevos sin movimientos previos también aparezcan.
  const tipoActivo =
    state.titularidad === 'personal' ? state.titularEntidadTipo : undefined;
  const { activas: entidadesActivas, loading: loadingEntidades } =
    useEntidadesPorTipo(tipoActivo);

  const [cuentasAhorros, setCuentasAhorros] = useState<CuentaCaja[]>([]);

  // ── Cargar cuentas de ahorros para tarjeta_debito (vinculación) y
  //    tarjeta_credito (cuenta default de pago de estado de cuenta) ──
  useEffect(() => {
    if (
      state.tipo !== 'credito' ||
      (state.productoFinanciero !== 'tarjeta_debito' &&
        state.productoFinanciero !== 'tarjeta_credito')
    ) {
      return;
    }
    tesoreriaService
      .getCuentas()
      .then((list) => {
        const ahorros = list.filter(
          (c) =>
            c.tipo === 'banco' &&
            (c.productoFinanciero === 'cuenta_ahorros' ||
              c.productoFinanciero === 'cuenta_corriente'),
        );
        setCuentasAhorros(ahorros);
      })
      .catch(() => setCuentasAhorros([]));
  }, [state.tipo, state.productoFinanciero]);

  const entidadGroups = useMemo(() => {
    if (entidadesActivas.length === 0) return [];
    return [
      {
        label: `${entidadesActivas.length} ${state.titularEntidadTipo}${entidadesActivas.length === 1 ? '' : 's'} activos`,
        options: entidadesActivas.map((e) => ({
          value: e.id,
          label: e.nombre,
          subLabel: e.subLabel,
        })),
      },
    ];
  }, [entidadesActivas, state.titularEntidadTipo]);

  const handleSeleccionarEntidad = (entidadId: string) => {
    const e = entidadesActivas.find((x) => x.id === entidadId);
    if (!e) return;
    setState((s) => ({
      ...s,
      titularEntidadId: e.id,
      titularNombre: e.nombre,
    }));
  };

  const handleTitularidadChange = (titularidad: 'empresa' | 'personal') => {
    setState((s) => ({
      ...s,
      titularidad,
      // Reset campos personales si vuelve a empresa
      ...(titularidad === 'empresa'
        ? {
            titularEntidadId: '',
            titularEntidadTipo: undefined,
            titularNombre: 'Vita Skin Peru SAC',
          }
        : { titularNombre: '' }),
    }));
  };

  // Auto-generar nombre interno sugerido
  useEffect(() => {
    if (!state.nombre && state.banco && state.moneda) {
      const monedaSym = state.moneda === 'USD' ? 'Dólares' : 'Soles';
      setState((s) => ({
        ...s,
        nombre: `${state.banco} ${monedaSym}`,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.banco, state.moneda]);

  return (
    <div className="space-y-5">
      {/* ── SECCIÓN A · Identidad bancaria ── */}
      {(state.tipo === 'banco' || state.tipo === 'digital') && (
        <div className="space-y-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 pb-2">
            Identidad bancaria
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField
              label={state.tipo === 'banco' ? 'Banco' : 'Servicio'}
              value={state.banco}
              onChange={(v) => setState((s) => ({ ...s, banco: v }))}
              placeholder={state.tipo === 'banco' ? 'BCP, IBK, BBVA' : 'Mercado Pago, PayPal'}
            />
            <TextField
              label="Nombre completo"
              value={state.bancoNombreCompleto}
              onChange={(v) => setState((s) => ({ ...s, bancoNombreCompleto: v }))}
              placeholder="Banco de Crédito del Perú"
              optional
            />
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-9">
              <TextField
                label="Nombre interno"
                value={state.nombre}
                onChange={(v) => setState((s) => ({ ...s, nombre: v }))}
                placeholder="BCP Soles · Operaciones"
                hint="Como aparecerá en los listados internos"
              />
            </div>
            <div className="col-span-3">
              <TextField
                label="Últimos 4"
                value={state.ultimosCuatro}
                onChange={(v) => {
                  // Solo dígitos, max 4
                  const cleaned = v.replace(/\D/g, '').slice(0, 4);
                  setState((s) => ({ ...s, ultimosCuatro: cleaned }));
                }}
                placeholder="6411"
                optional
                className="text-center"
              />
            </div>
          </div>

          {state.tipo === 'banco' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                label="Número de cuenta"
                value={state.numeroCuenta}
                onChange={(v) => setState((s) => ({ ...s, numeroCuenta: v }))}
                placeholder="123-1234567-0-12"
                optional
              />
              <TextField
                label="CCI"
                value={state.cci}
                onChange={(v) => setState((s) => ({ ...s, cci: v }))}
                placeholder="002 123 1234567..."
                optional
              />
            </div>
          )}
        </div>
      )}

      {/* ── Caja: solo nombre interno ── */}
      {state.tipo === 'efectivo' && (
        <div className="space-y-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 pb-2">
            Identidad
          </div>
          <TextField
            label="Nombre interno"
            value={state.nombre}
            onChange={(v) => setState((s) => ({ ...s, nombre: v }))}
            placeholder="Caja chica oficina"
            hint="Como aparecerá en los listados internos"
          />
        </div>
      )}

      {/* ── Crédito (tarjeta débito) ── */}
      {state.tipo === 'credito' && state.productoFinanciero === 'tarjeta_debito' && (
        <div className="space-y-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 pb-2">
            Tarjeta débito
          </div>
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-9">
              <TextField
                label="Nombre interno"
                value={state.nombre}
                onChange={(v) => setState((s) => ({ ...s, nombre: v }))}
                placeholder="BCP Visa Débito"
              />
            </div>
            <div className="col-span-3">
              <TextField
                label="Últimos 4"
                value={state.ultimosCuatro}
                onChange={(v) => {
                  const cleaned = v.replace(/\D/g, '').slice(0, 4);
                  setState((s) => ({ ...s, ultimosCuatro: cleaned }));
                }}
                placeholder="6411"
                optional
              />
            </div>
          </div>

          <Combobox
            label="Vincular a cuenta de ahorros"
            value={state.cuentaVinculadaId}
            onChange={(v) =>
              setState((s) => ({ ...s, cuentaVinculadaId: v }))
            }
            groups={[
              {
                options: cuentasAhorros.map((c) => ({
                  value: c.id,
                  label: c.nombre,
                  subLabel: c.banco
                    ? `${c.banco} · ${c.moneda}`
                    : c.moneda,
                })),
              },
            ]}
            placeholder={
              cuentasAhorros.length === 0
                ? 'No hay cuentas ahorros · crea una primero'
                : 'Seleccionar cuenta...'
            }
            hint="El dinero de la tarjeta sale/entra de esta cuenta"
            emptyMessage="Sin cuentas de ahorros disponibles"
          />
        </div>
      )}

      {/* ── Crédito (tarjeta crédito · F3c.5 ADR-PF-001) ── */}
      {state.tipo === 'credito' && state.productoFinanciero === 'tarjeta_credito' && (
        <div className="space-y-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 pb-2">
            Tarjeta de crédito
          </div>

          {/* Banco emisor + nombre completo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField
              label="Banco emisor"
              value={state.banco}
              onChange={(v) => setState((s) => ({ ...s, banco: v }))}
              placeholder="BCP, BBVA, Interbank"
            />
            <TextField
              label="Banco · nombre completo"
              value={state.bancoNombreCompleto}
              onChange={(v) => setState((s) => ({ ...s, bancoNombreCompleto: v }))}
              placeholder="Banco de Crédito del Perú"
              optional
            />
          </div>

          {/* Nombre interno + ultimos 4 */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-9">
              <TextField
                label="Nombre interno"
                value={state.nombre}
                onChange={(v) => setState((s) => ({ ...s, nombre: v }))}
                placeholder="BCP Visa Crédito · ····6411"
              />
            </div>
            <div className="col-span-3">
              <TextField
                label="Últimos 4"
                value={state.ultimosCuatro}
                onChange={(v) => {
                  const cleaned = v.replace(/\D/g, '').slice(0, 4);
                  setState((s) => ({ ...s, ultimosCuatro: cleaned }));
                }}
                placeholder="6411"
                className="text-center"
              />
            </div>
          </div>

          {/* Marca + Día corte + Día pago */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Marca
              </label>
              <select
                value={state.marcaTC ?? ''}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    marcaTC: (e.target.value || undefined) as
                      | 'visa'
                      | 'mastercard'
                      | 'amex'
                      | 'diners'
                      | 'otro'
                      | undefined,
                  }))
                }
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              >
                <option value="">— Selecciona —</option>
                <option value="visa">Visa</option>
                <option value="mastercard">Mastercard</option>
                <option value="amex">American Express</option>
                <option value="diners">Diners Club</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <TextField
              label="Día de corte"
              value={state.diaCorte?.toString() ?? ''}
              onChange={(v) => {
                const n = parseInt(v.replace(/\D/g, ''), 10);
                setState((s) => ({
                  ...s,
                  diaCorte: isNaN(n) ? undefined : Math.max(1, Math.min(31, n)),
                }));
              }}
              placeholder="1-31"
              hint="Día del mes"
            />
            <TextField
              label="Día de pago"
              value={state.diaPago?.toString() ?? ''}
              onChange={(v) => {
                const n = parseInt(v.replace(/\D/g, ''), 10);
                setState((s) => ({
                  ...s,
                  diaPago: isNaN(n) ? undefined : Math.max(1, Math.min(31, n)),
                }));
              }}
              placeholder="1-31"
              hint="Día del mes"
            />
          </div>

          {/* Topes de control opcionales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField
              label="Tope control USD"
              value={state.topeControlUSD?.toString() ?? ''}
              onChange={(v) => {
                const n = parseFloat(v);
                setState((s) => ({
                  ...s,
                  topeControlUSD: isNaN(n) ? undefined : n,
                }));
              }}
              placeholder="ej: 5000"
              hint="Alerta cuando el saldo de cargos supere"
              optional
            />
            <TextField
              label="Tope control PEN"
              value={state.topeControlPEN?.toString() ?? ''}
              onChange={(v) => {
                const n = parseFloat(v);
                setState((s) => ({
                  ...s,
                  topeControlPEN: isNaN(n) ? undefined : n,
                }));
              }}
              placeholder="ej: 18000"
              optional
            />
          </div>

          {/* Cuenta default desde donde se paga */}
          {cuentasAhorros.length > 0 && (
            <Combobox
              label="Cuenta default para pagar estado de cuenta"
              value={state.cuentaPagoDefaultId}
              onChange={(v) =>
                setState((s) => ({ ...s, cuentaPagoDefaultId: v }))
              }
              groups={[
                {
                  options: cuentasAhorros.map((c) => ({
                    value: c.id,
                    label: c.nombre,
                    subLabel: c.banco
                      ? `${c.banco} · ${c.moneda}`
                      : c.moneda,
                  })),
                },
              ]}
              placeholder="Sin cuenta default"
              hint="Opcional · sugerencia al pagar el estado de cuenta"
              emptyMessage="Sin cuentas disponibles"
            />
          )}
        </div>
      )}

      {/* ── SECCIÓN B · Titularidad ── */}
      <div className="space-y-4 pt-2">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 pb-2">
          Titularidad
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleTitularidadChange('empresa')}
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
                Empresa
              </span>
            </div>
            <div className="text-[10px] text-slate-500">
              Cuenta del negocio mismo (Vita Skin Peru SAC)
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleTitularidadChange('personal')}
            className={cn(
              'p-3 border-2 rounded-lg text-left transition-all',
              state.titularidad === 'personal'
                ? 'border-teal-500 bg-teal-50'
                : 'border-slate-200 bg-white hover:bg-slate-50',
            )}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <User
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
                Personal · de un tercero
              </span>
            </div>
            <div className="text-[10px] text-slate-500">
              Empleado, colaborador, proveedor, cliente
            </div>
          </button>
        </div>

        {state.titularidad === 'personal' && (
          <div className="space-y-3 pl-3 border-l-2 border-teal-200">
            <ToggleGroup
              label="Tipo de entidad"
              value={state.titularEntidadTipo ?? 'empleado'}
              onChange={(v) =>
                setState((s) => ({
                  ...s,
                  titularEntidadTipo: v as
                    | 'empleado'
                    | 'colaborador'
                    | 'proveedor'
                    | 'cliente',
                  titularEntidadId: '',
                  titularNombre: '',
                }))
              }
              options={TIPO_ENTIDAD_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
                icon: o.icon,
                activeColor: o.color as 'sky' | 'amber' | 'teal',
              }))}
            />

            {state.titularEntidadTipo && (
              <Combobox
                label={`Buscar ${state.titularEntidadTipo}`}
                value={state.titularEntidadId}
                onChange={handleSeleccionarEntidad}
                groups={entidadGroups}
                placeholder={
                  loadingEntidades
                    ? 'Cargando...'
                    : entidadesActivas.length === 0
                      ? `No hay ${state.titularEntidadTipo}s registrados`
                      : `Seleccionar ${state.titularEntidadTipo}...`
                }
                emptyMessage="Sin resultados"
                disabled={loadingEntidades}
                hint={
                  state.titularNombre
                    ? `Esta cuenta quedará agrupada bajo ${state.titularNombre} en la vista por titular`
                    : undefined
                }
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
