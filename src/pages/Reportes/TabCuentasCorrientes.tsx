/**
 * TabCuentasCorrientes — S55 Fase 8 · Dashboard global de saldos
 *
 * Visión ejecutiva del módulo Cuenta Corriente:
 *   1. KPIs por tipo de entidad (cliente / proveedor / colaborador / empleado)
 *      con totales de "nos deben" y "les debemos" en PEN y USD
 *   2. Tabla de TOP entidades con saldo (filtrable por tipo y por dirección)
 *
 * Datos vienen de:
 *   - `cuentaCorrienteService.getResumen()` para KPIs agregados
 *   - `cuentaCorrienteService.getAll({ conSaldo: true })` para listado
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Truck,
  UserCheck,
  Building,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, Badge } from '../../components/common';
import { cuentaCorrienteService } from '../../services/cuentaCorriente.service';
import type {
  CuentaCorriente,
  SaldosResumen,
  TipoEntidadCC,
} from '../../types/cuentaCorriente.types';
import { TIPO_ENTIDAD_CC_LABELS } from '../../types/cuentaCorriente.types';
import { cn } from '../../design-system';

type FiltroDireccion = 'todas' | 'a_favor' | 'en_contra';

const ICONOS_TIPO: Record<TipoEntidadCC, React.ComponentType<{ className?: string }>> = {
  cliente: Users,
  proveedor: Building,
  colaborador: Truck,
  empleado: UserCheck,
};

const COLOR_TIPO: Record<TipoEntidadCC, string> = {
  cliente: 'sky',
  proveedor: 'amber',
  colaborador: 'purple',
  empleado: 'emerald',
};

function fmtPEN(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtUSD(n: number): string {
  return `US$ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const TabCuentasCorrientes: React.FC = () => {
  const [resumen, setResumen] = useState<SaldosResumen | null>(null);
  const [ccs, setCCs] = useState<CuentaCorriente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<TipoEntidadCC | 'todos'>('todos');
  const [filtroDir, setFiltroDir] = useState<FiltroDireccion>('todas');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      cuentaCorrienteService.getResumen(),
      cuentaCorrienteService.getAll({ conSaldo: true }),
    ])
      .then(([res, list]) => {
        if (cancelled) return;
        setResumen(res);
        setCCs(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtrado y orden de la lista
  const ccsFiltradas = useMemo(() => {
    let list = ccs;
    if (filtroTipo !== 'todos') list = list.filter((c) => c.tipo === filtroTipo);
    if (filtroDir === 'a_favor') {
      list = list.filter((c) => c.saldoPEN > 0 || c.saldoUSD > 0);
    } else if (filtroDir === 'en_contra') {
      list = list.filter((c) => c.saldoPEN < 0 || c.saldoUSD < 0);
    }
    // Ordenar por monto absoluto del saldo (mayor primero)
    return [...list].sort((a, b) => {
      const absA = Math.abs(a.saldoPEN) + Math.abs(a.saldoUSD);
      const absB = Math.abs(b.saldoPEN) + Math.abs(b.saldoUSD);
      return absB - absA;
    });
  }, [ccs, filtroTipo, filtroDir]);

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-slate-400">
        Cargando saldos de cuentas corrientes...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── KPIs por tipo ──────────────────────────────────────────────── */}
      {resumen && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Saldos por tipo de entidad
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {(Object.keys(resumen.porTipo) as TipoEntidadCC[]).map((tipo) => {
              const data = resumen.porTipo[tipo];
              const IconoTipo = ICONOS_TIPO[tipo];
              const color = COLOR_TIPO[tipo];
              return (
                <Card key={tipo} padding="md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-lg bg-${color}-100 text-${color}-700 flex items-center justify-center`}
                      >
                        <IconoTipo className="w-4 h-4" />
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        {TIPO_ENTIDAD_CC_LABELS[tipo]}
                      </div>
                    </div>
                    <Badge variant="default" size="sm">
                      {data.cantidadEntidades}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    {/* A favor */}
                    {(data.debenAEmpresa.PEN > 0 || data.debenAEmpresa.USD > 0) && (
                      <div className="flex items-center gap-1 text-[11px]">
                        <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700 font-medium">A favor:</span>
                        <span className="tabular-nums text-emerald-700">
                          {data.debenAEmpresa.PEN > 0 && fmtPEN(data.debenAEmpresa.PEN)}
                          {data.debenAEmpresa.PEN > 0 && data.debenAEmpresa.USD > 0 && ' · '}
                          {data.debenAEmpresa.USD > 0 && fmtUSD(data.debenAEmpresa.USD)}
                        </span>
                      </div>
                    )}
                    {/* En contra */}
                    {(data.empresaDebe.PEN > 0 || data.empresaDebe.USD > 0) && (
                      <div className="flex items-center gap-1 text-[11px]">
                        <ArrowDownRight className="w-3 h-3 text-red-600" />
                        <span className="text-red-700 font-medium">Por pagar:</span>
                        <span className="tabular-nums text-red-700">
                          {data.empresaDebe.PEN > 0 && fmtPEN(data.empresaDebe.PEN)}
                          {data.empresaDebe.PEN > 0 && data.empresaDebe.USD > 0 && ' · '}
                          {data.empresaDebe.USD > 0 && fmtUSD(data.empresaDebe.USD)}
                        </span>
                      </div>
                    )}
                    {data.debenAEmpresa.PEN === 0 &&
                      data.debenAEmpresa.USD === 0 &&
                      data.empresaDebe.PEN === 0 &&
                      data.empresaDebe.USD === 0 && (
                        <div className="text-[11px] text-slate-400 italic">
                          Todas las cuentas saldadas
                        </div>
                      )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Totales globales ──────────────────────────────────────────── */}
      {resumen && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card padding="md" className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold mb-1">
                  Total a favor (nos deben)
                </div>
                <div className="text-xl font-bold text-emerald-700 tabular-nums">
                  {fmtPEN(resumen.totalDebenAEmpresa.PEN)}
                </div>
                {resumen.totalDebenAEmpresa.USD > 0 && (
                  <div className="text-sm text-emerald-600 tabular-nums">
                    + {fmtUSD(resumen.totalDebenAEmpresa.USD)}
                  </div>
                )}
              </div>
              <TrendingUp className="w-8 h-8 text-emerald-500" />
            </div>
          </Card>

          <Card padding="md" className="bg-gradient-to-br from-red-50 to-white border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-red-700 font-semibold mb-1">
                  Total por pagar (les debemos)
                </div>
                <div className="text-xl font-bold text-red-700 tabular-nums">
                  {fmtPEN(resumen.totalEmpresaDebe.PEN)}
                </div>
                {resumen.totalEmpresaDebe.USD > 0 && (
                  <div className="text-sm text-red-600 tabular-nums">
                    + {fmtUSD(resumen.totalEmpresaDebe.USD)}
                  </div>
                )}
              </div>
              <TrendingDown className="w-8 h-8 text-red-500" />
            </div>
          </Card>
        </div>
      )}

      {/* ─── TOP entidades con saldo ────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-slate-700">
            TOP entidades con saldo · {ccsFiltradas.length}
          </h3>
          <div className="flex items-center gap-2">
            {/* Filtro por tipo */}
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as TipoEntidadCC | 'todos')}
              className="px-2 py-1 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="todos">Todos los tipos</option>
              <option value="cliente">Clientes</option>
              <option value="proveedor">Proveedores</option>
              <option value="colaborador">Colaboradores</option>
              <option value="empleado">Empleados</option>
            </select>
            {/* Filtro por dirección */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setFiltroDir('todas')}
                className={cn(
                  'px-2 py-0.5 text-[11px] rounded transition-colors',
                  filtroDir === 'todas'
                    ? 'bg-white text-slate-900 shadow-sm font-medium'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setFiltroDir('a_favor')}
                className={cn(
                  'px-2 py-0.5 text-[11px] rounded transition-colors',
                  filtroDir === 'a_favor'
                    ? 'bg-white text-emerald-700 shadow-sm font-medium'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                A favor
              </button>
              <button
                type="button"
                onClick={() => setFiltroDir('en_contra')}
                className={cn(
                  'px-2 py-0.5 text-[11px] rounded transition-colors',
                  filtroDir === 'en_contra'
                    ? 'bg-white text-red-700 shadow-sm font-medium'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                Por pagar
              </button>
            </div>
          </div>
        </div>

        <Card padding="none" className="overflow-hidden">
          {ccsFiltradas.length === 0 ? (
            <div className="p-8 text-center">
              <Wallet className="w-6 h-6 text-slate-300 mx-auto mb-2" />
              <div className="text-sm text-slate-500">
                No hay entidades que coincidan con los filtros.
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Entidad</th>
                  <th className="text-left px-3 py-2 font-semibold">Tipo</th>
                  <th className="text-right px-3 py-2 font-semibold">Saldo PEN</th>
                  <th className="text-right px-3 py-2 font-semibold">Saldo USD</th>
                  <th className="text-right px-3 py-2 font-semibold">Movs</th>
                  <th className="text-right px-3 py-2 font-semibold">Última act.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ccsFiltradas.map((cc) => {
                  const totalDeudaAFavor = Math.max(0, cc.saldoPEN) + Math.max(0, cc.saldoUSD);
                  const totalDeudaContra = Math.max(0, -cc.saldoPEN) + Math.max(0, -cc.saldoUSD);

                  return (
                    <tr key={cc.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900 truncate max-w-[280px]">
                          {cc.entidadNombre}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="default" size="sm">
                          {TIPO_ENTIDAD_CC_LABELS[cc.tipo]}
                        </Badge>
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right tabular-nums whitespace-nowrap',
                          Math.abs(cc.saldoPEN) < 0.01
                            ? 'text-slate-400'
                            : cc.saldoPEN > 0
                              ? 'text-emerald-700 font-medium'
                              : 'text-red-700 font-medium',
                        )}
                      >
                        {Math.abs(cc.saldoPEN) < 0.01
                          ? '—'
                          : cc.saldoPEN > 0
                            ? `+${fmtPEN(cc.saldoPEN)}`
                            : `−${fmtPEN(Math.abs(cc.saldoPEN))}`}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right tabular-nums whitespace-nowrap',
                          Math.abs(cc.saldoUSD) < 0.01
                            ? 'text-slate-400'
                            : cc.saldoUSD > 0
                              ? 'text-emerald-700 font-medium'
                              : 'text-red-700 font-medium',
                        )}
                      >
                        {Math.abs(cc.saldoUSD) < 0.01
                          ? '—'
                          : cc.saldoUSD > 0
                            ? `+${fmtUSD(cc.saldoUSD)}`
                            : `−${fmtUSD(Math.abs(cc.saldoUSD))}`}
                      </td>
                      <td className="px-3 py-2 text-right text-[12px] text-slate-500 tabular-nums">
                        {cc.cantidadMovimientos}
                      </td>
                      <td className="px-3 py-2 text-right text-[11px] text-slate-500 whitespace-nowrap">
                        {cc.fechaUltimoMovimiento
                          ? cc.fechaUltimoMovimiento.toDate().toLocaleDateString('es-PE', {
                              day: '2-digit',
                              month: 'short',
                              year: '2-digit',
                            })
                          : '—'}
                      </td>
                      {/* invisible accumulators (referenced for reader) */}
                      <td className="hidden">{totalDeudaAFavor.toFixed(2)} {totalDeudaContra.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <div className="text-[10px] text-slate-400 italic mt-2 px-2">
          <span className="text-emerald-700 font-medium">+ Saldo a favor</span>: la entidad
          nos debe (CxC){' '}
          <span className="text-red-700 font-medium">· − Saldo en contra</span>: nosotros
          le debemos (CxP)
        </div>
      </div>
    </div>
  );
};
