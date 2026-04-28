/**
 * Paso 1 — Identificar entidad
 *
 * Selecciona el tipo (proveedor/colaborador/empleado/cliente) y luego la
 * entidad concreta vía Combobox. Muestra solo entidades con saldo en
 * contra (les debemos / nos deben). Al seleccionar, carga sus deudas
 * vía pagoAbonoDistribuidoService.obtenerDeudasPorEntidad.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Truck, UserRoundCog, IdCard, User } from 'lucide-react';
import { Combobox } from '../../../../design-system/components/forms/Combobox';
import { ToggleGroup } from '../../../../design-system/components/forms/ToggleGroup';
import type {
  ToggleOption,
} from '../../../../design-system/components/forms/ToggleGroup';
import { cuentaCorrienteService } from '../../../../services/cuentaCorriente.service';
import { pagoAbonoDistribuidoService } from '../../../../services/pagoAbonoDistribuido.service';
import type { CuentaCorriente, TipoEntidadCC } from '../../../../types/cuentaCorriente.types';
import type { PagoAbonoState } from './types';
import { cn } from '../../../../design-system/utils';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

interface Paso1Props {
  state: PagoAbonoState;
  setState: React.Dispatch<React.SetStateAction<PagoAbonoState>>;
}

const TIPO_OPTIONS: ToggleOption<TipoEntidadCC>[] = [
  { value: 'proveedor', label: 'Proveedor', icon: Truck },
  { value: 'colaborador', label: 'Colaborador', icon: UserRoundCog },
  { value: 'empleado', label: 'Empleado', icon: IdCard },
  { value: 'cliente', label: 'Cliente', icon: User },
];

const TIPO_TONO: Record<TipoEntidadCC, string> = {
  proveedor: 'bg-amber-100 text-amber-700',
  colaborador: 'bg-purple-100 text-purple-700',
  empleado: 'bg-sky-100 text-sky-700',
  cliente: 'bg-teal-100 text-teal-700',
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const Paso1Entidad: React.FC<Paso1Props> = ({ state, setState }) => {
  const [tipo, setTipo] = useState<TipoEntidadCC>(
    state.entidad?.entidadTipo ?? 'proveedor',
  );
  const [ccs, setCcs] = useState<CuentaCorriente[]>([]);
  const [loadingCCs, setLoadingCCs] = useState(false);
  const [loadingDeudas, setLoadingDeudas] = useState(false);

  // ── Cargar CCs por tipo (con saldo en contra) ──
  // Para proveedores/colaboradores/empleados: saldoUSD/PEN < 0 (les debemos)
  // Para clientes: saldoUSD/PEN > 0 (nos deben)
  useEffect(() => {
    let cancelled = false;
    setLoadingCCs(true);
    const filtros = {
      tipo,
      ...(tipo === 'cliente' ? { soloDeudoras: true } : { soloAcreedoras: true }),
    };
    cuentaCorrienteService
      .getAll(filtros)
      .then((res) => {
        if (!cancelled) setCcs(res);
      })
      .catch(() => {
        if (!cancelled) setCcs([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCCs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tipo]);

  // ── Cargar deudas cuando cambia entidad seleccionada ──
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
          setState((s) => ({ ...s, deudas }));
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
  }, [state.entidad?.entidadId]);

  // ── Combobox groups (entidades con saldo) ──
  const groups = useMemo(() => {
    const opts = ccs.map((cc) => {
      // Saldo a mostrar: el negativo más grande en valor absoluto
      const saldoUSD = cc.saldoUSD;
      const saldoPEN = cc.saldoPEN;
      const labelMonto =
        Math.abs(saldoUSD) > Math.abs(saldoPEN)
          ? `${saldoUSD < 0 ? '−' : ''}US$ ${Math.abs(saldoUSD).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : `${saldoPEN < 0 ? '−' : ''}S/ ${Math.abs(saldoPEN).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const tono = saldoUSD < 0 || saldoPEN < 0
        ? 'text-red-700'
        : 'text-emerald-700';

      const initial = cc.entidadNombre
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();

      return {
        value: cc.entidadId,
        label: cc.entidadNombre,
        subLabel: `${cc.cantidadMovimientos} movimiento${cc.cantidadMovimientos !== 1 ? 's' : ''}`,
        icon: (
          <div
            className={cn(
              'w-8 h-8 rounded-md flex items-center justify-center font-bold text-[10px]',
              TIPO_TONO[cc.tipo],
            )}
          >
            {initial}
          </div>
        ),
        badge: (
          <span className={cn('text-[12px] font-bold tabular-nums', tono)}>
            {labelMonto}
          </span>
        ),
      };
    });
    if (opts.length === 0) {
      return [];
    }
    return [
      {
        label: `Con saldo · ${opts.length} resultado${opts.length !== 1 ? 's' : ''}`,
        options: opts,
      },
    ];
  }, [ccs]);

  // ── Resumen de la entidad seleccionada ──
  const entidad = state.entidad;
  const totalAdeudado = useMemo(() => {
    return state.deudas.reduce((s, d) => s + d.montoPendiente, 0);
  }, [state.deudas]);
  const documentosVencidos = useMemo(() => {
    return state.deudas.filter((d) => d.estaVencido).length;
  }, [state.deudas]);
  const masAntiguaDias = useMemo(() => {
    if (state.deudas.length === 0) return 0;
    const min = Math.min(...state.deudas.map((d) => d.diasVencimiento ?? 0));
    return Math.abs(min);
  }, [state.deudas]);

  // ── Handler selección ──
  const handleSeleccionarEntidad = (entidadId: string) => {
    const cc = ccs.find((c) => c.entidadId === entidadId);
    if (!cc) return;
    setState((s) => ({
      ...s,
      entidad: {
        entidadId: cc.entidadId,
        entidadTipo: cc.tipo,
        entidadNombre: cc.entidadNombre,
        saldoUSD: cc.saldoUSD,
        saldoPEN: cc.saldoPEN,
      },
      // Sugerir moneda según saldo dominante
      monedaAbono: Math.abs(cc.saldoUSD) >= Math.abs(cc.saldoPEN) ? 'USD' : 'PEN',
    }));
  };

  return (
    <div className="space-y-5">
      {/* Tipo de entidad */}
      <ToggleGroup<TipoEntidadCC>
        label="Tipo de entidad"
        value={tipo}
        onChange={(v) => {
          setTipo(v);
          setState((s) => ({ ...s, entidad: null, deudas: [] }));
        }}
        options={TIPO_OPTIONS}
        hint={
          tipo === 'cliente'
            ? 'Solo clientes que nos deben aparecerán en la búsqueda.'
            : 'Solo entidades a las que les debemos aparecerán en la búsqueda.'
        }
      />

      {/* Combobox de entidad */}
      <Combobox
        label={`Buscar ${tipo}`}
        value={entidad?.entidadId}
        onChange={handleSeleccionarEntidad}
        groups={groups}
        placeholder={
          loadingCCs
            ? 'Cargando...'
            : ccs.length === 0
              ? `No hay ${tipo}s con saldo`
              : `Seleccionar ${tipo}...`
        }
        emptyMessage={`Sin resultados con ese nombre`}
        disabled={loadingCCs}
      />

      {/* Resumen entidad seleccionada */}
      {entidad && (
        <div className="bg-gradient-to-br from-teal-50 to-white border border-teal-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={cn(
                'w-10 h-10 rounded-md flex items-center justify-center font-bold text-[12px]',
                TIPO_TONO[entidad.entidadTipo],
              )}
            >
              {entidad.entidadNombre
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900 truncate">
                {entidad.entidadNombre}
              </div>
              <div className="text-[11px] text-slate-500 capitalize">
                {entidad.entidadTipo}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-red-700 font-semibold">
                {entidad.entidadTipo === 'cliente' ? 'Total a cobrar' : 'Total adeudado'}
              </div>
              <div className="text-xl font-bold text-red-700 tabular-nums">
                {state.monedaAbono === 'USD' ? 'US$' : 'S/'}{' '}
                {totalAdeudado.toLocaleString('es-PE', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-teal-200/60 text-center">
            <div>
              <div className="text-[10px] uppercase text-slate-500 tracking-wider">
                Documentos
              </div>
              <div className="text-base font-bold text-slate-800">
                {loadingDeudas ? '…' : state.deudas.length}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-amber-700 tracking-wider">
                Vencidas
              </div>
              <div className="text-base font-bold text-amber-700">
                {loadingDeudas ? '…' : documentosVencidos}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-slate-500 tracking-wider">
                Más antigua
              </div>
              <div className="text-base font-bold text-slate-800">
                {loadingDeudas ? '…' : masAntiguaDias > 0 ? `${masAntiguaDias} d` : '—'}
              </div>
            </div>
          </div>

          {!loadingDeudas && state.deudas.length === 0 && (
            <div className="mt-3 pt-3 border-t border-teal-200/60 text-[11px] text-amber-700 bg-amber-50 -mx-4 -mb-4 px-4 py-2.5 rounded-b-lg">
              Esta entidad no tiene documentos pendientes de pago.
              <span className="block text-[10px] text-amber-600 mt-0.5">
                (Soporta órdenes de compra, envíos y gastos vinculados)
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
