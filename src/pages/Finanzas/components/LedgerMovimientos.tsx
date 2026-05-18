/**
 * LedgerMovimientos — chk5.D-S3 · SF2
 *
 * Ledger transaccional canon MOCK 7 (§1) · pixel-perfect contra
 * `docs/mockups/finanzas-vista-movimientos-v5.1.html`.
 *
 * Renderiza una lista de MovimientoTesoreria agrupada por día / semana /
 * mes / categoría con headers de grupo y subtotales (ingresos · egresos · neto).
 *
 * Sub-componentes: `MovimientoRow` (SF3 · row individual) recibe cada mov
 * y dispara onSeleccionarMov al click (abre drawer detalle).
 *
 * Helpers exportados:
 *   - agruparPorDia(movs) → LedgerGrupo[]
 *   - agruparPorSemana(movs) → LedgerGrupo[]
 *   - agruparPorMes(movs) → LedgerGrupo[]
 *   - calcularSubtotales(movs) → SubtotalesGrupo
 *
 * Las claves del header:
 *   - "Hoy · jueves 15 may 2026" si fecha == hoy
 *   - "Ayer · miércoles 14 may"  si fecha == ayer
 *   - "Martes 13 may"            si fecha < ayer
 */

import React, { useMemo } from 'react';
import type { MovimientoTesoreria } from '../../../types/tesoreria.types';
import { TIPOS_INGRESO, TIPOS_EGRESO } from '../../../services/tesoreria.shared';
import { MovimientoRow } from './MovimientoRow';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

export type AgrupacionLedger = 'dia' | 'semana' | 'mes' | 'categoria';

export interface SubtotalesGrupo {
  /** Suma ingresos PEN equivalente */
  ingresosPEN: number;
  /** Suma egresos PEN equivalente */
  egresosPEN: number;
  /** Neto = ingresos - egresos */
  netoPEN: number;
  /** Cantidad de movimientos */
  count: number;
}

export interface LedgerGrupo {
  /** Clave única del grupo (ej. '2026-05-15' · '2026-W20' · '2026-05' · 'ingreso_venta') */
  key: string;
  /** Label visible en el header del grupo */
  label: string;
  /** True si es el día actual · cambia el tinte del header a teal */
  esHoy?: boolean;
  /** Movimientos del grupo · ya filtrados estado != anulado */
  movimientos: MovimientoTesoreria[];
  /** Subtotales calculados del grupo */
  subtotales: SubtotalesGrupo;
}

export interface LedgerMovimientosProps {
  movimientos: MovimientoTesoreria[];
  agrupacion: AgrupacionLedger;
  onSeleccionarMov: (mov: MovimientoTesoreria) => void;
  /** Skeleton shimmer mientras carga */
  loading?: boolean;
  /** Para empty state · texto personalizado opcional */
  emptyHint?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS EXPORTADOS · agrupaciones
// ═════════════════════════════════════════════════════════════════════════

/**
 * Calcula subtotales (ingresos · egresos · neto · count) de un set de movs.
 * Ignora movimientos anulados.
 */
export function calcularSubtotales(movs: MovimientoTesoreria[]): SubtotalesGrupo {
  let ingresos = 0;
  let egresos = 0;
  let count = 0;
  for (const m of movs) {
    if (m.estado === 'anulado') continue;
    count++;
    const equiv = m.montoEquivalentePEN || 0;
    if (TIPOS_INGRESO.includes(m.tipo)) ingresos += equiv;
    else if (TIPOS_EGRESO.includes(m.tipo)) egresos += equiv;
    // Conversiones · transferencias internas · planilla · ajustes
    // NO suman a ingreso/egreso porque no afectan patrimonio neto.
  }
  return {
    ingresosPEN: ingresos,
    egresosPEN: egresos,
    netoPEN: ingresos - egresos,
    count,
  };
}

/**
 * Agrupa movimientos por día calendario · descendente (más reciente primero).
 * Devuelve [] si no hay movimientos.
 */
export function agruparPorDia(movs: MovimientoTesoreria[]): LedgerGrupo[] {
  if (movs.length === 0) return [];

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);

  const mapa = new Map<string, MovimientoTesoreria[]>();
  for (const m of movs) {
    if (!m.fecha) continue;
    const fecha = m.fecha.toDate();
    fecha.setHours(0, 0, 0, 0);
    const key = formatearFechaKey(fecha);
    if (!mapa.has(key)) mapa.set(key, []);
    mapa.get(key)!.push(m);
  }

  const grupos: LedgerGrupo[] = [];
  for (const [key, listaDia] of mapa) {
    // Ordenar movs DENTRO del día · descendente por hora
    listaDia.sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());

    const fecha = parseKeyAFecha(key);
    const esHoy = fecha.getTime() === hoy.getTime();
    const esAyer = fecha.getTime() === ayer.getTime();

    let label: string;
    if (esHoy) {
      label = `Hoy · ${formatearLabelDia(fecha)}`;
    } else if (esAyer) {
      label = `Ayer · ${formatearLabelDia(fecha)}`;
    } else {
      label = formatearLabelDia(fecha);
    }

    grupos.push({
      key,
      label,
      esHoy,
      movimientos: listaDia,
      subtotales: calcularSubtotales(listaDia),
    });
  }

  // Ordenar grupos descendente por fecha
  grupos.sort((a, b) => b.key.localeCompare(a.key));
  return grupos;
}

/**
 * Agrupa por semana ISO · header "Sem 20 · 11-may al 17-may"
 */
export function agruparPorSemana(movs: MovimientoTesoreria[]): LedgerGrupo[] {
  if (movs.length === 0) return [];
  const mapa = new Map<string, MovimientoTesoreria[]>();
  for (const m of movs) {
    if (!m.fecha) continue;
    const fecha = m.fecha.toDate();
    const { semana, anio, inicio, fin } = obtenerSemana(fecha);
    const key = `${anio}-W${String(semana).padStart(2, '0')}`;
    if (!mapa.has(key)) mapa.set(key, []);
    // Guardamos también los rangos para el label · usamos prop adicional
    (mapa.get(key) as any).__inicio = inicio;
    (mapa.get(key) as any).__fin = fin;
    (mapa.get(key) as any).__semana = semana;
    mapa.get(key)!.push(m);
  }

  const grupos: LedgerGrupo[] = [];
  for (const [key, listaSem] of mapa) {
    listaSem.sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
    const inicio: Date = (listaSem as any).__inicio;
    const fin: Date = (listaSem as any).__fin;
    const semana: number = (listaSem as any).__semana;
    const label = `Semana ${semana} · ${formatearFechaCorta(inicio)} al ${formatearFechaCorta(fin)}`;
    grupos.push({
      key,
      label,
      movimientos: listaSem,
      subtotales: calcularSubtotales(listaSem),
    });
  }

  grupos.sort((a, b) => b.key.localeCompare(a.key));
  return grupos;
}

/**
 * Agrupa por mes calendario · header "Mayo 2026"
 */
export function agruparPorMes(movs: MovimientoTesoreria[]): LedgerGrupo[] {
  if (movs.length === 0) return [];
  const mapa = new Map<string, MovimientoTesoreria[]>();
  for (const m of movs) {
    if (!m.fecha) continue;
    const fecha = m.fecha.toDate();
    const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    if (!mapa.has(key)) mapa.set(key, []);
    mapa.get(key)!.push(m);
  }

  const grupos: LedgerGrupo[] = [];
  for (const [key, listaMes] of mapa) {
    listaMes.sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
    const [anioStr, mesStr] = key.split('-');
    const label = formatearMesAnio(parseInt(mesStr, 10) - 1, parseInt(anioStr, 10));
    grupos.push({
      key,
      label,
      movimientos: listaMes,
      subtotales: calcularSubtotales(listaMes),
    });
  }

  grupos.sort((a, b) => b.key.localeCompare(a.key));
  return grupos;
}

/**
 * Agrupa por tipo de movimiento (categoría conceptual).
 * Header = label del tipo (ej. "Cobros · ingreso_venta").
 */
export function agruparPorCategoria(movs: MovimientoTesoreria[]): LedgerGrupo[] {
  if (movs.length === 0) return [];
  const mapa = new Map<string, MovimientoTesoreria[]>();
  for (const m of movs) {
    if (!mapa.has(m.tipo)) mapa.set(m.tipo, []);
    mapa.get(m.tipo)!.push(m);
  }

  const grupos: LedgerGrupo[] = [];
  for (const [tipo, listaCat] of mapa) {
    listaCat.sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
    grupos.push({
      key: tipo,
      label: labelTipoMov(tipo),
      movimientos: listaCat,
      subtotales: calcularSubtotales(listaCat),
    });
  }

  // Orden: ingresos primero · luego egresos · luego conversiones/otros
  const ORDEN: Record<string, number> = {};
  TIPOS_INGRESO.forEach((t, i) => (ORDEN[t] = i));
  TIPOS_EGRESO.forEach((t, i) => (ORDEN[t] = 100 + i));
  grupos.sort((a, b) => (ORDEN[a.key] ?? 999) - (ORDEN[b.key] ?? 999));
  return grupos;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS INTERNOS · formato
// ═════════════════════════════════════════════════════════════════════════

function formatearFechaKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseKeyAFecha(key: string): Date {
  const [a, m, d] = key.split('-').map((x) => parseInt(x, 10));
  return new Date(a, m - 1, d);
}

function formatearLabelDia(d: Date): string {
  // ej. "jueves 15 may 2026"
  return d.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatearFechaCorta(d: Date): string {
  // ej. "11-may"
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }).replace('.', '');
}

function formatearMesAnio(mes: number, anio: number): string {
  const fecha = new Date(anio, mes, 1);
  return fecha
    .toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase());
}

function obtenerSemana(fecha: Date): {
  semana: number;
  anio: number;
  inicio: Date;
  fin: Date;
} {
  // Semana ISO · empieza en lunes
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  // Inicio = lunes · fin = domingo
  const offsetLunes = dayNum - 1;
  const inicio = new Date(fecha);
  inicio.setDate(inicio.getDate() - offsetLunes);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 6);

  return { semana, anio: d.getUTCFullYear(), inicio, fin };
}

const TIPO_LABEL: Record<string, string> = {
  ingreso_venta: 'Cobros · venta',
  ingreso_anticipo: 'Anticipos recibidos',
  ingreso_otro: 'Otros ingresos',
  aporte_capital: 'Aporte de capital',
  pago_orden_compra: 'Pagos · OC',
  pago_viajero: 'Pagos viajero',
  pago_proveedor_local: 'Pagos · proveedor local',
  gasto_operativo: 'Gastos operativos',
  retiro_socio: 'Retiros · socios',
  conversion_pen_usd: 'Conversión PEN → USD',
  conversion_usd_pen: 'Conversión USD → PEN',
  transferencia_interna: 'Transferencia interna',
  pago_nomina: 'Pago de nómina',
  adelanto_empleado: 'Adelantos a empleados',
  ajuste_positivo: 'Ajuste positivo',
  ajuste_negativo: 'Ajuste negativo',
};

function labelTipoMov(tipo: string): string {
  return TIPO_LABEL[tipo] ?? tipo;
}

// Helpers de formato monetario
const fmt0 = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const LedgerMovimientos: React.FC<LedgerMovimientosProps> = ({
  movimientos,
  agrupacion,
  onSeleccionarMov,
  loading = false,
  emptyHint,
}) => {
  const grupos = useMemo<LedgerGrupo[]>(() => {
    switch (agrupacion) {
      case 'dia':
        return agruparPorDia(movimientos);
      case 'semana':
        return agruparPorSemana(movimientos);
      case 'mes':
        return agruparPorMes(movimientos);
      case 'categoria':
        return agruparPorCategoria(movimientos);
      default: {
        const _exhaustive: never = agrupacion;
        void _exhaustive;
        return [];
      }
    }
  }, [movimientos, agrupacion]);

  if (loading) {
    return (
      <div className="p-4 space-y-1.5">
        {/* Shimmer skeleton canon MOCK 7 §4 */}
        <div className="shimmer h-6 rounded" />
        <div className="shimmer h-10 rounded ml-4" />
        <div className="shimmer h-10 rounded ml-4" />
        <div className="shimmer h-10 rounded ml-4" />
        <div className="shimmer h-6 rounded mt-4" />
        <div className="shimmer h-10 rounded ml-4" />
        <div className="shimmer h-10 rounded ml-4" />
      </div>
    );
  }

  if (grupos.length === 0) {
    return (
      <div className="p-8 text-center text-[12px] text-slate-500">
        {emptyHint ?? 'Sin movimientos en el rango seleccionado.'}
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-200">
      {grupos.map((grupo) => (
        <div key={grupo.key}>
          {/* Header del grupo · tinte teal si es hoy · slate resto */}
          <div
            className={`px-6 py-2 flex items-center justify-between ${
              grupo.esHoy ? 'bg-teal-50/50' : 'bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-bold ${
                  grupo.esHoy ? 'text-teal-900' : 'text-slate-900'
                }`}
              >
                {grupo.label}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  grupo.esHoy
                    ? 'bg-teal-100 text-teal-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {grupo.subtotales.count} {grupo.subtotales.count === 1 ? 'mov' : 'movs'}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-[10px] tabular-nums">
              {grupo.subtotales.ingresosPEN > 0 && (
                <span className="text-emerald-700 font-bold">
                  +S/ {fmt0(grupo.subtotales.ingresosPEN)}
                </span>
              )}
              {grupo.subtotales.egresosPEN > 0 && (
                <span className="text-rose-700 font-bold">
                  −S/ {fmt0(grupo.subtotales.egresosPEN)}
                </span>
              )}
              {(grupo.subtotales.ingresosPEN > 0 || grupo.subtotales.egresosPEN > 0) && (
                <span
                  className={`font-bold ${
                    grupo.subtotales.netoPEN >= 0 ? 'text-indigo-700' : 'text-rose-700'
                  }`}
                >
                  neto {grupo.subtotales.netoPEN >= 0 ? '+' : '−'}S/{' '}
                  {fmt0(Math.abs(grupo.subtotales.netoPEN))}
                </span>
              )}
            </div>
          </div>

          {/* Rows individuales · MovimientoRow SF3 */}
          <div className="divide-y divide-slate-100">
            {grupo.movimientos.map((mov) => (
              <MovimientoRow
                key={mov.id}
                movimiento={mov}
                onClick={() => onSeleccionarMov(mov)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
