/**
 * VistaPorTitular — S58c parte 2 · sección 7 del mockup
 *
 * Lista de cuentas + tarjetas agrupadas por TITULAR (no por tipo de producto).
 * Cada grupo muestra:
 *   - Header: icon de tipo (Empresa/Empleado/Colaborador/Proveedor/Cliente)
 *     + nombre + count + saldo agregado
 *   - Items: cuentas y tarjetas del titular con icon + saldo
 *
 * Click en cuenta/tarjeta dispara callback (puede abrir detalle, edición, etc.)
 */

import React, { useMemo } from 'react';
import {
  Building,
  IdCard,
  Truck,
  User,
  Users as UsersIcon,
} from 'lucide-react';
import { cn } from '../../../design-system/utils';
import { useTarjetaCreditoStore } from '../../../store/tarjetaCreditoStore';
import { useEntidadesPorTipo } from '../../../hooks/useEntidadesPorTipo';
import type { CuentaCaja } from '../../../types/tesoreria.types';
import type { TarjetaCredito } from '../../../types/tarjetaCredito.types';
import { TitularItemRow } from './TitularItemRow';
import {
  agruparPorTitular,
  buildResolverNombre,
  calcularSaldosCuentasGrupo,
  type GrupoTitular,
  type SubGrupoBanco,
  type TipoTitular,
} from './helpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface VistaPorTitularProps {
  cuentas: CuentaCaja[];
  /** Si no se pasa, el componente las lee del store. */
  tarjetas?: TarjetaCredito[];
  onCuentaClick?: (cuenta: CuentaCaja) => void;
  onTarjetaClick?: (tarjeta: TarjetaCredito) => void;
  /** Editar cuenta (abre form modal). */
  onEditarCuenta?: (cuenta: CuentaCaja) => void;
  /** Eliminar cuenta (con confirm). */
  onEliminarCuenta?: (cuenta: CuentaCaja) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS VISUALES
// ═════════════════════════════════════════════════════════════════════════

const TIPO_ICON: Record<
  TipoTitular,
  { icon: React.ComponentType<{ className?: string }>; bg: string; border: string; text: string }
> = {
  empresa: {
    icon: Building,
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-700',
  },
  empleado: {
    icon: IdCard,
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-700',
  },
  colaborador: {
    icon: UsersIcon,
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
  },
  proveedor: {
    icon: Truck,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
  },
  cliente: {
    icon: User,
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
  },
};

function fmtPEN(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtUSD(n: number): string {
  return `US$ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ═════════════════════════════════════════════════════════════════════════
// GRUPO HEADER
// ═════════════════════════════════════════════════════════════════════════

const GrupoHeader: React.FC<{ grupo: GrupoTitular }> = ({ grupo }) => {
  const { icon: Icon, bg, border, text } = TIPO_ICON[grupo.tipo];

  // Saldo agregado de cuentas (las tarjetas no se suman aquí porque viven en CC)
  const { totalPEN, totalUSD } = useMemo(
    () => calcularSaldosCuentasGrupo(grupo),
    [grupo],
  );

  // Cantidad de items
  const cuentasCount = grupo.items.filter((i) => i.kind === 'cuenta').length;
  const tarjetasCount = grupo.items.filter((i) => i.kind === 'tarjeta').length;
  const subtituloItems =
    cuentasCount > 0 && tarjetasCount > 0
      ? `${cuentasCount} cuenta${cuentasCount !== 1 ? 's' : ''} · ${tarjetasCount} tarjeta${tarjetasCount !== 1 ? 's' : ''}`
      : cuentasCount > 0
        ? `${cuentasCount} cuenta${cuentasCount !== 1 ? 's' : ''}`
        : `${tarjetasCount} tarjeta${tarjetasCount !== 1 ? 's' : ''}`;

  // Texto del saldo agregado
  let saldoTexto = '';
  if (totalPEN !== 0 && totalUSD !== 0) {
    saldoTexto = `${fmtPEN(totalPEN)} · ${fmtUSD(totalUSD)}`;
  } else if (totalUSD !== 0) {
    saldoTexto = fmtUSD(totalUSD);
  } else if (totalPEN !== 0) {
    saldoTexto = fmtPEN(totalPEN);
  } else {
    saldoTexto = '—';
  }

  // Etiqueta del lado derecho (depende de tipo)
  const labelDerecho =
    grupo.tipo === 'empresa'
      ? 'Total saldos'
      : grupo.tipo === 'cliente'
        ? 'Saldos en sus cuentas'
        : 'Tiene del negocio';

  return (
    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
      <div
        className={cn(
          'w-8 h-8 rounded-md flex items-center justify-center border flex-shrink-0',
          bg,
          border,
        )}
      >
        <Icon className={cn('w-4 h-4', text)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-slate-900 truncate">
          {grupo.nombre}
        </div>
        <div className="text-[10px] text-slate-500">
          {grupo.subtitulo} · {subtituloItems}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          {labelDerecho}
        </div>
        <div className="text-base font-bold text-slate-900 tabular-nums">
          {saldoTexto}
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-GRUPO POR BANCO (F3 · ADR-PF-001)
// ═════════════════════════════════════════════════════════════════════════

const SubGrupoBancoSection: React.FC<{
  subgrupo: SubGrupoBanco;
  onCuentaClick?: (c: CuentaCaja) => void;
  onTarjetaClick?: (t: TarjetaCredito) => void;
  onEditarCuenta?: (c: CuentaCaja) => void;
  onEliminarCuenta?: (c: CuentaCaja) => void;
}> = ({
  subgrupo,
  onCuentaClick,
  onTarjetaClick,
  onEditarCuenta,
  onEliminarCuenta,
}) => {
  const cuentasCount = subgrupo.items.filter((i) => i.kind === 'cuenta').length;
  const tarjetasCount = subgrupo.items.filter((i) => i.kind === 'tarjeta').length;

  // Calcular saldo del subgrupo
  let totalPEN = 0, totalUSD = 0;
  for (const item of subgrupo.items) {
    if (item.kind !== 'cuenta') continue;
    const c = item.cuenta;
    if (c.esBiMoneda) {
      totalUSD += c.saldoUSD ?? 0;
      totalPEN += c.saldoPEN ?? 0;
    } else if (c.moneda === 'USD') {
      totalUSD += c.saldoActual;
    } else {
      totalPEN += c.saldoActual;
    }
  }
  let saldoTexto = '';
  if (totalPEN !== 0 && totalUSD !== 0) {
    saldoTexto = `${fmtPEN(totalPEN)} · ${fmtUSD(totalUSD)}`;
  } else if (totalUSD !== 0) {
    saldoTexto = fmtUSD(totalUSD);
  } else if (totalPEN !== 0) {
    saldoTexto = fmtPEN(totalPEN);
  }

  const isSinBanco = subgrupo.banco === 'Sin banco';

  return (
    <div className="mb-2">
      {/* Header del banco */}
      <div
        className={cn(
          'flex items-center gap-2 mb-1 pb-1 px-2 py-1 rounded',
          isSinBanco ? 'bg-slate-50' : 'bg-sky-50/60',
        )}
      >
        <div
          className={cn(
            'w-4 h-4 rounded flex items-center justify-center flex-shrink-0',
            isSinBanco
              ? 'bg-slate-200 text-slate-500'
              : 'bg-sky-100 text-sky-700',
          )}
        >
          <Building className="w-2.5 h-2.5" />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span
            className={cn(
              'text-[11px] font-semibold uppercase tracking-wider truncate',
              isSinBanco ? 'text-slate-500' : 'text-sky-800',
            )}
          >
            {subgrupo.banco}
          </span>
          {subgrupo.bancoNombreCompleto &&
            subgrupo.bancoNombreCompleto !== subgrupo.banco && (
              <span className="text-[10px] text-slate-400 truncate hidden sm:inline">
                · {subgrupo.bancoNombreCompleto}
              </span>
            )}
          <span className="text-[10px] text-slate-500 ml-auto flex-shrink-0">
            {cuentasCount > 0 &&
              `${cuentasCount} cuenta${cuentasCount !== 1 ? 's' : ''}`}
            {cuentasCount > 0 && tarjetasCount > 0 && ' · '}
            {tarjetasCount > 0 &&
              `${tarjetasCount} TC${tarjetasCount !== 1 ? 's' : ''}`}
          </span>
        </div>
        {saldoTexto && (
          <span className="text-[11px] tabular-nums font-semibold text-slate-700 flex-shrink-0">
            {saldoTexto}
          </span>
        )}
      </div>

      {/* Items del banco */}
      <div className="space-y-0.5 ml-2">
        {subgrupo.items.map((item) => (
          <TitularItemRow
            key={item.kind === 'cuenta' ? item.cuenta.id : item.tarjeta.id}
            item={item}
            onClick={() => {
              if (item.kind === 'cuenta') onCuentaClick?.(item.cuenta);
              else onTarjetaClick?.(item.tarjeta);
            }}
            onEditarCuenta={onEditarCuenta}
            onEliminarCuenta={onEliminarCuenta}
          />
        ))}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const VistaPorTitular: React.FC<VistaPorTitularProps> = ({
  cuentas,
  tarjetas: tarjetasProp,
  onCuentaClick,
  onTarjetaClick,
  onEditarCuenta,
  onEliminarCuenta,
}) => {
  // Cargar tarjetas del store si no se pasan
  const tarjetasStore = useTarjetaCreditoStore((s) => s.tarjetas);
  const tarjetas = tarjetasProp ?? tarjetasStore;

  // Resolver nombres de titulares (lee de stores reales)
  const empleadosEnt = useEntidadesPorTipo('empleado');
  const colaboradoresEnt = useEntidadesPorTipo('colaborador');
  const proveedoresEnt = useEntidadesPorTipo('proveedor');
  const clientesEnt = useEntidadesPorTipo('cliente');

  const resolverNombre = useMemo(
    () =>
      buildResolverNombre({
        empleados: empleadosEnt.entidades,
        colaboradores: colaboradoresEnt.entidades,
        proveedores: proveedoresEnt.entidades,
        clientes: clientesEnt.entidades,
      }),
    [
      empleadosEnt.entidades,
      colaboradoresEnt.entidades,
      proveedoresEnt.entidades,
      clientesEnt.entidades,
    ],
  );

  // Agrupar por titular
  const grupos = useMemo(
    () => agruparPorTitular(cuentas, tarjetas, resolverNombre),
    [cuentas, tarjetas, resolverNombre],
  );

  if (grupos.length === 0) {
    return (
      <div className="text-center py-12 px-4 bg-slate-50/50 border border-dashed border-slate-200 rounded-lg">
        <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500 font-medium">
          Sin cuentas ni tarjetas
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Agrega cuentas o tarjetas desde el botón "Nueva cuenta" arriba.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
      <div className="space-y-5">
        {grupos.map((grupo, idx) => (
          <div
            key={grupo.key}
            className={cn(idx < grupos.length - 1 && 'mb-5')}
          >
            <GrupoHeader grupo={grupo} />
            {/* F3 · sub-agrupación por banco dentro del titular */}
            <div className="ml-10 space-y-2">
              {grupo.subgrupos.map((sg) => (
                <SubGrupoBancoSection
                  key={sg.banco}
                  subgrupo={sg}
                  onCuentaClick={onCuentaClick}
                  onTarjetaClick={onTarjetaClick}
                  onEditarCuenta={onEditarCuenta}
                  onEliminarCuenta={onEliminarCuenta}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
