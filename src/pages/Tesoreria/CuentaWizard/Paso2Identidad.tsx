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
import { TextField } from '../../../design-system/components/forms/TextField';
import { Combobox } from '../../../design-system/components/forms/Combobox';
import { ToggleGroup } from '../../../design-system/components/forms/ToggleGroup';
import { cuentaCorrienteService } from '../../../services/cuentaCorriente.service';
import { tesoreriaService } from '../../../services/tesoreria.service';
import type { CuentaCorriente } from '../../../types/cuentaCorriente.types';
import type { CuentaCaja } from '../../../types/tesoreria.types';
import { cn } from '../../../design-system/utils';
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
  const [entidadesCC, setEntidadesCC] = useState<CuentaCorriente[]>([]);
  const [loadingEntidades, setLoadingEntidades] = useState(false);
  const [cuentasAhorros, setCuentasAhorros] = useState<CuentaCaja[]>([]);

  // ── Cargar CCs por tipo seleccionado ──
  useEffect(() => {
    if (state.titularidad !== 'personal' || !state.titularEntidadTipo) {
      setEntidadesCC([]);
      return;
    }
    let cancelled = false;
    setLoadingEntidades(true);
    cuentaCorrienteService
      .getAll({ tipo: state.titularEntidadTipo })
      .then((list) => {
        if (!cancelled) setEntidadesCC(list);
      })
      .catch(() => {
        if (!cancelled) setEntidadesCC([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingEntidades(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state.titularidad, state.titularEntidadTipo]);

  // ── Cargar cuentas de ahorros para tarjeta_debito ──
  useEffect(() => {
    if (state.tipo !== 'credito' || state.productoFinanciero !== 'tarjeta_debito') {
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
    if (entidadesCC.length === 0) return [];
    return [
      {
        label: `${entidadesCC.length} ${state.titularEntidadTipo}${entidadesCC.length === 1 ? '' : 's'}`,
        options: entidadesCC.map((cc) => ({
          value: cc.entidadId,
          label: cc.entidadNombre,
          subLabel:
            cc.cantidadMovimientos > 0
              ? `${cc.cantidadMovimientos} movimiento${cc.cantidadMovimientos !== 1 ? 's' : ''}`
              : 'Sin movimientos previos',
        })),
      },
    ];
  }, [entidadesCC, state.titularEntidadTipo]);

  const handleSeleccionarEntidad = (entidadId: string) => {
    const cc = entidadesCC.find((e) => e.entidadId === entidadId);
    if (!cc) return;
    setState((s) => ({
      ...s,
      titularEntidadId: cc.entidadId,
      titularNombre: cc.entidadNombre,
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
      {state.tipo === 'credito' && (
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
                    : entidadesCC.length === 0
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
