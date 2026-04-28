/**
 * Paso 1 — Tarjeta + Entidad origen del cargo · S58d F3
 *
 * Si la tarjeta viene preseleccionada (entry desde card), se omite el
 * selector y se enfoca en elegir la entidad. Si no, también permite
 * elegir tarjeta primero.
 *
 * Carga deudas del proveedor/colaborador via obtenerDeudasPorEntidad
 * (mismo helper del PagoAbono wizard) — los gastos requieren proveedorId.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Truck, UserRoundCog, IdCard, User, CreditCard } from 'lucide-react';
import { Combobox } from '../../../../design-system/components/forms/Combobox';
import { ToggleGroup } from '../../../../design-system/components/forms/ToggleGroup';
import { useTarjetaCreditoStore } from '../../../../store/tarjetaCreditoStore';
import { cuentaCorrienteService } from '../../../../services/cuentaCorriente.service';
import { pagoAbonoDistribuidoService } from '../../../../services/pagoAbonoDistribuido.service';
import type { CuentaCorriente, TipoEntidadCC } from '../../../../types/cuentaCorriente.types';
import type { CargarTarjetaState } from './types';
import { cn } from '../../../../design-system/utils';

interface Paso1Props {
  state: CargarTarjetaState;
  setState: React.Dispatch<React.SetStateAction<CargarTarjetaState>>;
}

const TIPO_ENTIDAD_OPTIONS = [
  { value: 'proveedor' as const, label: 'Proveedor', icon: Truck, color: 'amber' as const },
  { value: 'colaborador' as const, label: 'Colaborador', icon: UserRoundCog, color: 'slate' as const },
  { value: 'empleado' as const, label: 'Empleado', icon: IdCard, color: 'sky' as const },
  { value: 'cliente' as const, label: 'Cliente', icon: User, color: 'teal' as const },
];

export const Paso1OrigenCargo: React.FC<Paso1Props> = ({ state, setState }) => {
  const { tarjetas, fetchTarjetas } = useTarjetaCreditoStore();

  const [tipoEntidad, setTipoEntidad] = useState<TipoEntidadCC>(
    state.entidad?.entidadTipo ?? 'proveedor',
  );
  const [entidadesCC, setEntidadesCC] = useState<CuentaCorriente[]>([]);
  const [loadingCCs, setLoadingCCs] = useState(false);
  const [loadingDeudas, setLoadingDeudas] = useState(false);

  // Cargar tarjetas si no están en el store
  useEffect(() => {
    if (tarjetas.length === 0) void fetchTarjetas();
  }, [tarjetas.length, fetchTarjetas]);

  // Cargar entidades del tipo seleccionado (con saldo en contra)
  useEffect(() => {
    let cancelled = false;
    setLoadingCCs(true);
    cuentaCorrienteService
      .getAll({ tipo: tipoEntidad, soloDeudoras: true })
      .then((list) => {
        if (!cancelled) setEntidadesCC(list);
      })
      .catch(() => {
        if (!cancelled) setEntidadesCC([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCCs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tipoEntidad]);

  // Cargar deudas cuando cambia entidad
  useEffect(() => {
    let cancelled = false;
    if (!state.entidad) {
      setState((s) => ({ ...s, deudas: [] }));
      return;
    }
    setLoadingDeudas(true);
    pagoAbonoDistribuidoService
      .obtenerDeudasPorEntidad({
        entidadId: state.entidad.entidadId,
        entidadTipo: state.entidad.entidadTipo,
      })
      .then((deudas) => {
        if (!cancelled) {
          // Filtrar solo deudas en la moneda de la tarjeta (D-S58-9: misma moneda)
          const deudasFiltradas = state.tarjeta
            ? deudas.filter((d) => d.moneda === state.tarjeta!.moneda)
            : deudas;
          setState((s) => ({ ...s, deudas: deudasFiltradas }));
        }
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, deudas: [] }));
      })
      .finally(() => {
        if (!cancelled) setLoadingDeudas(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.entidad?.entidadId, state.tarjeta?.id]);

  // Tarjetas activas como combobox
  const tarjetaGroups = useMemo(() => {
    const activas = tarjetas.filter((t) => t.activa);
    if (activas.length === 0) return [];
    return [
      {
        label: `${activas.length} ${activas.length === 1 ? 'tarjeta' : 'tarjetas'} activas`,
        options: activas.map((t) => ({
          value: t.id,
          label: t.nombre,
          subLabel: `${t.banco} · ····${t.ultimosDigitos} · ${t.moneda}${t.titularidad === 'personal' ? ` · ${t.titularNombre}` : ''}`,
        })),
      },
    ];
  }, [tarjetas]);

  // Entidades como combobox
  const entidadGroups = useMemo(() => {
    if (entidadesCC.length === 0) return [];
    const opts = entidadesCC.map((cc) => {
      const sym = cc.saldoUSD > 0.01 ? 'US$' : 'S/';
      const saldoMostrar =
        Math.abs(cc.saldoUSD) > Math.abs(cc.saldoPEN) ? cc.saldoUSD : cc.saldoPEN;
      return {
        value: cc.entidadId,
        label: cc.entidadNombre,
        subLabel: `Deuda: ${sym} ${Math.abs(saldoMostrar).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      };
    });
    return [{ label: `${opts.length} con saldo`, options: opts }];
  }, [entidadesCC]);

  const handleSeleccionarTarjeta = (tarjetaId: string) => {
    const t = tarjetas.find((x) => x.id === tarjetaId);
    if (!t) return;
    setState((s) => ({
      ...s,
      tarjeta: t,
      monedaCargo: t.moneda,
      // Reset entidad porque cambia la moneda y por lo tanto las deudas
      entidad: null,
      deudas: [],
      distribucion: [],
    }));
  };

  const handleSeleccionarEntidad = (entidadId: string) => {
    const cc = entidadesCC.find((e) => e.entidadId === entidadId);
    if (!cc) return;
    setState((s) => ({
      ...s,
      entidad: {
        entidadId: cc.entidadId,
        entidadTipo: cc.tipo,
        entidadNombre: cc.entidadNombre,
      },
      distribucion: [], // reset distribución
    }));
  };

  const totalDeudas = state.deudas.reduce(
    (s, d) => s + d.montoPendiente,
    0,
  );

  return (
    <div className="space-y-5">
      {/* Tarjeta */}
      <Combobox
        label="Tarjeta de crédito"
        value={state.tarjeta?.id}
        onChange={handleSeleccionarTarjeta}
        groups={tarjetaGroups}
        placeholder={
          tarjetas.length === 0
            ? 'Cargando tarjetas…'
            : tarjetaGroups.length === 0
              ? 'No hay tarjetas activas'
              : 'Seleccionar tarjeta…'
        }
        emptyMessage="Sin tarjetas disponibles"
      />

      {/* Tipo de entidad */}
      <ToggleGroup<TipoEntidadCC>
        label="Tipo de entidad origen"
        value={tipoEntidad}
        onChange={(v) => {
          setTipoEntidad(v);
          setState((s) => ({ ...s, entidad: null, deudas: [], distribucion: [] }));
        }}
        options={TIPO_ENTIDAD_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          icon: o.icon,
          activeColor: o.color,
        }))}
        hint="Entidad cuya deuda vas a cargar a la tarjeta. Solo entidades con saldo en contra."
      />

      {/* Entidad */}
      <Combobox
        label={`Buscar ${tipoEntidad}`}
        value={state.entidad?.entidadId}
        onChange={handleSeleccionarEntidad}
        groups={entidadGroups}
        placeholder={
          loadingCCs
            ? 'Cargando…'
            : entidadesCC.length === 0
              ? `No hay ${tipoEntidad}s con deuda`
              : `Seleccionar ${tipoEntidad}…`
        }
        emptyMessage="Sin resultados"
        disabled={loadingCCs}
      />

      {/* Resumen */}
      {state.tarjeta && state.entidad && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-amber-900">
                Vas a cargar deudas de {state.entidad.entidadNombre}
              </div>
              <div className="text-[11px] text-amber-800 mt-0.5">
                A la tarjeta {state.tarjeta.nombre} (
                {state.tarjeta.banco} ····{state.tarjeta.ultimosDigitos})
              </div>
              {!loadingDeudas && state.deudas.length > 0 && (
                <div className="text-[11px] text-amber-800 mt-1.5">
                  <strong>{state.deudas.length}</strong>{' '}
                  documento{state.deudas.length !== 1 ? 's' : ''} pendiente{state.deudas.length !== 1 ? 's' : ''}
                  {' · '}Total: <strong className="tabular-nums">{state.tarjeta.moneda === 'USD' ? 'US$' : 'S/'} {totalDeudas.toFixed(2)}</strong>
                </div>
              )}
              {!loadingDeudas && state.deudas.length === 0 && (
                <div className="text-[11px] text-amber-700 mt-1.5">
                  Esta entidad no tiene documentos pendientes en{' '}
                  {state.tarjeta.moneda}.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nota informativa */}
      <div className={cn(
        'text-[11px] rounded-md p-3 border',
        'bg-slate-50 border-slate-200 text-slate-700',
      )}>
        <strong>Cargo a tarjeta = pasivo.</strong> El saldo de la tarjeta sube,
        las deudas seleccionadas se cancelan. NO toca tesorería — el dinero
        sale después al pagar el estado de cuenta.
      </div>
    </div>
  );
};
