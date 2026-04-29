/**
 * VistaPorTitular — Imp-L1 · Refactor visual S58e (mockup M1)
 *
 * Lista de cuentas + tarjetas agrupadas por TITULAR y dentro por BANCO.
 * Usa los componentes pixel-perfect: TitularGroupHeader + BankSubheader +
 * ProductCard.
 *
 * Las tarjetas legacy siguen renderizándose con TitularItemRow hasta que
 * DEUDA-PF-001 (cleanup TC) las absorba completamente. Esto se aplicará
 * en sesión dedicada cuando se elimine TabTarjetasCredito + TarjetasCreditoV2.
 */

import React, { useMemo } from 'react';
import { Building } from 'lucide-react';
import { useTarjetaCreditoStore } from '../../../store/tarjetaCreditoStore';
import { useEntidadesPorTipo } from '../../../hooks/useEntidadesPorTipo';
import type { CuentaCaja } from '../../../types/tesoreria.types';
import type { TarjetaCredito } from '../../../types/tarjetaCredito.types';
import { TitularItemRow } from './TitularItemRow';
import {
  agruparPorTitular,
  buildResolverNombre,
  type GrupoTitular,
  type SubGrupoBanco,
} from './helpers';
import {
  TitularGroupHeader,
  BankSubheader,
  ProductCard,
} from '../components';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface VistaPorTitularProps {
  cuentas: CuentaCaja[];
  /** Si no se pasa, el componente las lee del store. */
  tarjetas?: TarjetaCredito[];
  onCuentaClick?: (cuenta: CuentaCaja) => void;
  onTarjetaClick?: (tarjeta: TarjetaCredito) => void;
  /** Editar cuenta (abre wizard). */
  onEditarCuenta?: (cuenta: CuentaCaja) => void;
  /** Eliminar cuenta (con confirm). */
  onEliminarCuenta?: (cuenta: CuentaCaja) => void;
  /** Click en header de titular abre drill-down M4 (futuro). */
  onTitularClick?: (grupo: GrupoTitular) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS DE FORMATO
// ═════════════════════════════════════════════════════════════════════════

function fmtPEN(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
}
function fmtUSD(n: number): string {
  return `US$ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
}

function calcularSaldosGrupo(grupo: GrupoTitular): { totalPEN: number; totalUSD: number } {
  let totalPEN = 0;
  let totalUSD = 0;
  for (const item of grupo.items) {
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
  return { totalPEN, totalUSD };
}

function calcularSaldosBanco(subgrupo: SubGrupoBanco): { totalPEN: number; totalUSD: number } {
  let totalPEN = 0;
  let totalUSD = 0;
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
  return { totalPEN, totalUSD };
}

function fmtSaldoAgregado(totalPEN: number, totalUSD: number): string {
  if (totalPEN !== 0 && totalUSD !== 0) return `${fmtPEN(totalPEN)} + ${fmtUSD(totalUSD)}`;
  if (totalUSD !== 0) return fmtUSD(totalUSD);
  if (totalPEN !== 0) return fmtPEN(totalPEN);
  return '—';
}

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
  onTitularClick,
}) => {
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

  // Agrupar por titular → banco
  const grupos = useMemo(
    () => agruparPorTitular(cuentas, tarjetas, resolverNombre),
    [cuentas, tarjetas, resolverNombre],
  );

  // Empty state
  if (grupos.length === 0) {
    return (
      <div className="text-center py-12 px-4 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
        <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500 font-medium">
          Sin cuentas ni tarjetas
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Agrega productos financieros desde el botón "Nueva cuenta" arriba.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grupos.map((grupo) => {
        const { totalPEN, totalUSD } = calcularSaldosGrupo(grupo);
        const totalProductos = grupo.items.length;
        const subtitulo = `${grupo.subtitulo}${
          grupo.entidadId ? '' : ''
        } · ${totalProductos} producto${totalProductos !== 1 ? 's' : ''}`;

        return (
          <div key={grupo.key}>
            <TitularGroupHeader
              tipo={grupo.tipo}
              nombre={grupo.nombre}
              subtitulo={subtitulo}
              saldoTexto={fmtSaldoAgregado(totalPEN, totalUSD)}
              onClick={onTitularClick ? () => onTitularClick(grupo) : undefined}
            />

            {grupo.subgrupos.map((sg) => {
              const { totalPEN: bancoPEN, totalUSD: bancoUSD } =
                calcularSaldosBanco(sg);
              const cuentasDelBanco = sg.items.filter(
                (i) => i.kind === 'cuenta',
              );
              const tarjetasDelBanco = sg.items.filter(
                (i) => i.kind === 'tarjeta',
              );

              return (
                <div key={`${grupo.key}-${sg.banco}`} className="mb-3">
                  <BankSubheader
                    banco={sg.banco}
                    bancoNombreCompleto={sg.bancoNombreCompleto}
                    productosCount={sg.items.length}
                    saldoTexto={fmtSaldoAgregado(bancoPEN, bancoUSD)}
                  />
                  <div className="ml-3 space-y-2">
                    {/* Cuentas: usan ProductCard nuevo */}
                    {cuentasDelBanco.map((item) =>
                      item.kind === 'cuenta' ? (
                        <ProductCard
                          key={item.cuenta.id}
                          cuenta={item.cuenta}
                          onVerDetalle={onCuentaClick}
                          onEditar={onEditarCuenta}
                          onEliminar={onEliminarCuenta}
                        />
                      ) : null,
                    )}
                    {/* Tarjetas: legacy TitularItemRow hasta cleanup TC (DEUDA-PF-001) */}
                    {tarjetasDelBanco.map((item) =>
                      item.kind === 'tarjeta' ? (
                        <TitularItemRow
                          key={item.tarjeta.id}
                          item={item}
                          onClick={() => onTarjetaClick?.(item.tarjeta)}
                        />
                      ) : null,
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
