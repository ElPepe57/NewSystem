/**
 * FinanzasMovimientos — chk5.D-S3 · SF5
 *
 * Sub-vista canon /finanzas/movimientos · pixel-perfect MOCK 7.
 * Renderiza el ledger transaccional completo con filtros + agrupación.
 *
 * Override del shell adaptativo (SF1):
 *   - breadcrumb leaf: "Movimientos"
 *   - header: icon ArrowLeftRight slate + "Movimientos" + subtitle ledger
 *   - actions: [Exportar · Importar extracto] + dropdown nuevo movimiento (preservado)
 *   - kpiSlot: KPI strip propio (Movs del mes · Ingresos · Egresos · Flujo neto · Pendientes)
 *
 * Conecta:
 *   - useFinanzasShellContext() → cuentas + movimientosMes (sin refetch)
 *   - fetch local de movimientos por rango fechas seleccionado
 *   - filtros derivados (busqueda · cuenta · tipo) aplicados client-side
 *   - LedgerMovimientos para renderizar agrupado
 *   - drawer detalle stub (delegado a MOCK 5 · SF6 cierra wiring)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Download,
  Upload,
  Layers,
  ArrowDownCircle,
  ArrowUpCircle,
  Activity,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { useFinanzasShellContext } from './FinanzasLayout';
import { getMovimientos } from '../../services/tesoreria.movimientos.service';
import {
  TIPOS_INGRESO,
  TIPOS_EGRESO,
  TIPOS_CONVERSION,
} from '../../services/tesoreria.shared';
import type { MovimientoTesoreria } from '../../types/tesoreria.types';
import { LedgerMovimientos } from './components/LedgerMovimientos';
import type { AgrupacionLedger } from './components/LedgerMovimientos';
import {
  FiltrosLedgerBar,
  ToolbarAgrupacion,
  type FiltrosLedgerState,
  type VistaLedger,
} from './components/FiltrosLedgerBar';

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

const fmt0 = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function defaultFiltros(): FiltrosLedgerState {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return {
    busqueda: '',
    fechaInicio: inicio,
    fechaFin: hoy,
    cuentaId: null,
    tipo: 'todos',
  };
}

function contarFiltrosActivos(f: FiltrosLedgerState): number {
  let count = 0;
  if (f.busqueda.trim()) count++;
  count++; // rango fechas siempre activo (default = mes actual)
  if (f.cuentaId) count++;
  if (f.tipo !== 'todos') count++;
  return count;
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

const FinanzasMovimientos: React.FC = () => {
  const { cuentas, setSubVistaConfig, onSeleccionarAccion } = useFinanzasShellContext();

  // Estado local · filtros + fetch
  const [filtros, setFiltros] = useState<FiltrosLedgerState>(defaultFiltros);
  const [movimientos, setMovimientos] = useState<MovimientoTesoreria[]>([]);
  const [movsMesAnterior, setMovsMesAnterior] = useState<MovimientoTesoreria[]>([]);
  const [loading, setLoading] = useState(true);
  const [agrupacion, setAgrupacion] = useState<AgrupacionLedger>('dia');
  const [vista, setVista] = useState<VistaLedger>('lista');
  const [pageSize, setPageSize] = useState(30); // paginación incremental
  const [movSeleccionado, setMovSeleccionado] = useState<MovimientoTesoreria | null>(null);

  // Fetch movimientos por rango + mes anterior para delta KPI flujo
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const fechaInicio = new Date(filtros.fechaInicio);
    fechaInicio.setHours(0, 0, 0, 0);
    const fechaFin = new Date(filtros.fechaFin);
    fechaFin.setHours(23, 59, 59, 999);

    // Mes anterior para comparativa
    const inicioMesActual = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), 1);
    const inicioMesAnterior = new Date(
      inicioMesActual.getFullYear(),
      inicioMesActual.getMonth() - 1,
      1,
    );
    const finMesAnterior = new Date(
      inicioMesActual.getFullYear(),
      inicioMesActual.getMonth(),
      0,
      23,
      59,
      59,
      999,
    );

    Promise.all([
      getMovimientos({ fechaInicio, fechaFin }),
      getMovimientos({ fechaInicio: inicioMesAnterior, fechaFin: finMesAnterior }),
    ])
      .then(([listaActual, listaAnterior]) => {
        if (cancelled) return;
        setMovimientos(listaActual);
        setMovsMesAnterior(listaAnterior);
        // Reset paginación cuando cambia rango
        setPageSize(30);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('FinanzasMovimientos · error cargando movs', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filtros.fechaInicio, filtros.fechaFin]);

  // ─── Filtrar client-side: búsqueda · cuenta · tipo ────────────────────
  const movimientosFiltrados = useMemo(() => {
    const q = filtros.busqueda.trim().toLowerCase();
    return movimientos.filter((m) => {
      if (m.estado === 'anulado') return false; // ocultar anulados por default

      // Filtro cuenta
      if (filtros.cuentaId) {
        if (m.cuentaOrigen !== filtros.cuentaId && m.cuentaDestino !== filtros.cuentaId) {
          return false;
        }
      }

      // Filtro tipo
      if (filtros.tipo === 'ingresos' && !TIPOS_INGRESO.includes(m.tipo)) return false;
      if (filtros.tipo === 'egresos' && !TIPOS_EGRESO.includes(m.tipo)) return false;
      if (filtros.tipo === 'conversiones' && !TIPOS_CONVERSION.includes(m.tipo)) return false;
      if (filtros.tipo === 'transferencias' && m.tipo !== 'transferencia_interna') return false;

      // Búsqueda textual
      if (q) {
        const haystack = [
          m.concepto,
          m.referencia,
          m.numeroMovimiento,
          m.notas,
          m.ventaNumero,
          m.ordenCompraNumero,
          m.gastoNumero,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [movimientos, filtros]);

  // ─── Paginación incremental ───────────────────────────────────────────
  const movimientosVisibles = useMemo(
    () => movimientosFiltrados.slice(0, pageSize),
    [movimientosFiltrados, pageSize],
  );
  const hayMas = movimientosVisibles.length < movimientosFiltrados.length;

  // ─── KPIs del ledger (5 propios MOCK 7) ───────────────────────────────
  const kpisLedger = useMemo(() => {
    let ingresos = 0;
    let egresos = 0;
    let pendientes = 0;
    for (const m of movimientos) {
      if (m.estado === 'anulado') continue;
      if (m.estado === 'pendiente') pendientes++;
      const equiv = m.montoEquivalentePEN || 0;
      if (TIPOS_INGRESO.includes(m.tipo)) ingresos += equiv;
      else if (TIPOS_EGRESO.includes(m.tipo)) egresos += equiv;
    }
    const flujoNeto = ingresos - egresos;

    // Comparativa mes anterior
    let ingresosPrev = 0;
    let egresosPrev = 0;
    let countPrev = 0;
    for (const m of movsMesAnterior) {
      if (m.estado === 'anulado') continue;
      countPrev++;
      const equiv = m.montoEquivalentePEN || 0;
      if (TIPOS_INGRESO.includes(m.tipo)) ingresosPrev += equiv;
      else if (TIPOS_EGRESO.includes(m.tipo)) egresosPrev += equiv;
    }
    const flujoPrev = ingresosPrev - egresosPrev;
    const countMes = movimientos.filter((m) => m.estado !== 'anulado').length;
    const deltaPctMovs = countPrev > 0 ? Math.round(((countMes - countPrev) / countPrev) * 100) : 0;

    // Conteo ingresos / egresos individuales
    const countIngresos = movimientos.filter(
      (m) => m.estado !== 'anulado' && TIPOS_INGRESO.includes(m.tipo),
    ).length;
    const countEgresos = movimientos.filter(
      (m) => m.estado !== 'anulado' && TIPOS_EGRESO.includes(m.tipo),
    ).length;

    return {
      countMes,
      countPrev,
      deltaPctMovs,
      ingresos,
      countIngresos,
      egresos,
      countEgresos,
      flujoNeto,
      flujoPrev,
      pendientes,
    };
  }, [movimientos, movsMesAnterior]);

  // ─── Limpiar filtros · reset al default ───────────────────────────────
  const handleLimpiarTodo = useCallback(() => {
    setFiltros(defaultFiltros());
  }, []);

  // ─── Handlers wireup ─────────────────────────────────────────────────
  const handleExportar = useCallback(() => {
    // TODO chk5.D-S4 · export real CSV/XLSX. Por ahora cross-link a /reportes.
    console.info('FinanzasMovimientos · exportar', movimientosFiltrados.length, 'movs');
  }, [movimientosFiltrados.length]);

  const handleImportarExtracto = useCallback(() => {
    // TODO chk5.D-S4 · modal import bancario. Por ahora placeholder.
    console.info('FinanzasMovimientos · importar extracto');
  }, []);

  // ─── Resumen toolbar ─────────────────────────────────────────────────
  const resumenToolbar = useMemo(() => {
    return `${movimientosFiltrados.length} movs · S/ ${fmt0(
      kpisLedger.ingresos,
    )} ingresos · S/ ${fmt0(kpisLedger.egresos)} egresos`;
  }, [movimientosFiltrados.length, kpisLedger]);

  // ─── KPI Slot canon MOCK 7 §1 · 5 KPIs específicos ledger ─────────────
  const kpiSlot = useMemo(() => {
    const flujoSigno = kpisLedger.flujoNeto >= 0 ? '+' : '−';
    const flujoColor = kpisLedger.flujoNeto >= 0 ? 'text-indigo-900' : 'text-rose-900';
    const deltaSigno = kpisLedger.deltaPctMovs >= 0 ? '+' : '';

    return (
      <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* KPI 1 · Movs del mes · slate */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/40 ring-1 ring-slate-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-700 font-bold">
              Movs del mes
            </span>
            <Layers className="w-3.5 h-3.5 text-slate-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900">
            {kpisLedger.countMes}
          </div>
          <div className="text-[11px] text-slate-700 mt-1">
            vs {kpisLedger.countPrev} prev · {deltaSigno}
            {kpisLedger.deltaPctMovs}%
          </div>
        </div>

        {/* KPI 2 · Ingresos · emerald */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">
              Ingresos
            </span>
            <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">
            +S/ {fmt0(kpisLedger.ingresos)}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">
            {kpisLedger.countIngresos} movs · cobros + ventas
          </div>
        </div>

        {/* KPI 3 · Egresos · rose */}
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">
              Egresos
            </span>
            <ArrowUpCircle className="w-3.5 h-3.5 text-rose-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-rose-900">
            −S/ {fmt0(kpisLedger.egresos)}
          </div>
          <div className="text-[11px] text-rose-700 mt-1">
            {kpisLedger.countEgresos} movs · pagos + gastos
          </div>
        </div>

        {/* KPI 4 · Flujo neto · indigo */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 ring-1 ring-indigo-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-indigo-700 font-bold">
              Flujo neto
            </span>
            <Activity className="w-3.5 h-3.5 text-indigo-700" />
          </div>
          <div className={`text-2xl font-bold tabular-nums ${flujoColor}`}>
            {flujoSigno}S/ {fmt0(Math.abs(kpisLedger.flujoNeto))}
          </div>
          <div className="text-[11px] text-indigo-700 mt-1">
            vs {kpisLedger.flujoPrev >= 0 ? '+' : '−'}S/ {fmt0(Math.abs(kpisLedger.flujoPrev))} prev
          </div>
        </div>

        {/* KPI 5 · Pendientes · amber */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">
              Pendientes
            </span>
            <Clock className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-900">
            {kpisLedger.pendientes}
          </div>
          <div className="text-[11px] text-amber-700 mt-1">Conciliación bancaria</div>
        </div>
      </div>
    );
  }, [kpisLedger]);

  // ─── Actions custom · Exportar + Importar extracto ───────────────────
  const actionsCustom = useMemo(
    () => (
      <>
        <button
          type="button"
          onClick={handleExportar}
          aria-label="Exportar"
          title="Exportar"
          className="text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Download className="w-3 h-3" />
          <span className="hidden sm:inline">Exportar</span>
        </button>
        <button
          type="button"
          onClick={handleImportarExtracto}
          aria-label="Importar extracto"
          title="Importar extracto bancario"
          className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Upload className="w-3 h-3" />
          <span className="hidden sm:inline">Importar extracto</span>
        </button>
      </>
    ),
    [handleExportar, handleImportarExtracto],
  );

  // ─── Setear sub-vista config en el shell ─────────────────────────────
  useEffect(() => {
    setSubVistaConfig({
      breadcrumbLeaf: 'Movimientos',
      header: {
        title: 'Movimientos',
        subtitle:
          'Ledger transaccional · ingresos · egresos · conversiones · transferencias · todos los flujos de caja',
        icon: ArrowLeftRight,
        iconColor: 'slate',
      },
      kpiSlot,
      actions: actionsCustom,
      actionsReplaceAll: false, // preserva el dropdown "+ Nuevo movimiento"
    });
    // Cleanup no necesario · shell auto-resetea al cambiar pathname
  }, [setSubVistaConfig, kpiSlot, actionsCustom]);

  // ─── Cuentas para selector ────────────────────────────────────────────
  const cuentasParaSelector = useMemo(
    () =>
      cuentas
        .filter((c) => c.activa)
        .map((c) => ({ id: c.id, nombre: c.nombre, moneda: c.moneda })),
    [cuentas],
  );

  const activeCount = contarFiltrosActivos(filtros);

  // ─── Vista alternativa timeline/calendario · placeholder SF6+ ─────────
  if (vista === 'timeline' || vista === 'calendario') {
    return (
      <>
        <FiltrosLedgerBar
          state={filtros}
          onChange={setFiltros}
          cuentas={cuentasParaSelector}
          activeCount={activeCount}
          onLimpiarTodo={handleLimpiarTodo}
        />
        <ToolbarAgrupacion
          resumen={resumenToolbar}
          agrupacion={agrupacion}
          onAgrupacionChange={setAgrupacion}
          vista={vista}
          onVistaChange={setVista}
        />
        <div className="p-8 text-center text-[12px] text-slate-500">
          Vista <strong className="text-slate-700">{vista}</strong> próximamente · chk5.D-S4.
          <br />
          Por ahora cambiá a vista <strong>Lista</strong> para ver el ledger completo.
        </div>
      </>
    );
  }

  return (
    <>
      <FiltrosLedgerBar
        state={filtros}
        onChange={setFiltros}
        cuentas={cuentasParaSelector}
        activeCount={activeCount}
        onLimpiarTodo={handleLimpiarTodo}
      />
      <ToolbarAgrupacion
        resumen={resumenToolbar}
        agrupacion={agrupacion}
        onAgrupacionChange={setAgrupacion}
        vista={vista}
        onVistaChange={setVista}
      />

      {/* Ledger */}
      <LedgerMovimientos
        movimientos={movimientosVisibles}
        agrupacion={agrupacion}
        onSeleccionarMov={setMovSeleccionado}
        loading={loading}
        emptyHint={
          activeCount > 1
            ? 'Sin movimientos para los filtros seleccionados · ajustá el rango o limpiá los filtros.'
            : 'Aún no hay movimientos en este rango.'
        }
      />

      {/* Paginación */}
      {hayMas && (
        <div className="border-t border-slate-200 px-6 py-3 flex items-center justify-between bg-slate-50">
          <div className="text-[11px] text-slate-500">
            Mostrando {movimientosVisibles.length} de {movimientosFiltrados.length} ·{' '}
            cargado {Math.round((movimientosVisibles.length / movimientosFiltrados.length) * 100)}%
          </div>
          <button
            type="button"
            onClick={() => setPageSize((s) => s + 30)}
            className="text-[11px] font-semibold text-teal-700 hover:bg-teal-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            <ChevronDown className="w-3 h-3" /> Cargar 30 más
          </button>
        </div>
      )}

      {/* Drawer detalle · stub SF5 · wiring real SF6 (delega a MOCK 5) */}
      {movSeleccionado && (
        <DrawerDetalleStub
          mov={movSeleccionado}
          onClose={() => setMovSeleccionado(null)}
          onNuevoMovimiento={() => {
            setMovSeleccionado(null);
            onSeleccionarAccion('ingreso_simple');
          }}
        />
      )}
    </>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// DRAWER DETALLE · stub mínimo · canon completo en chk5.D-S4 (MOCK 5 §6)
// ═════════════════════════════════════════════════════════════════════════

interface DrawerDetalleStubProps {
  mov: MovimientoTesoreria;
  onClose: () => void;
  onNuevoMovimiento: () => void;
}

const DrawerDetalleStub: React.FC<DrawerDetalleStubProps> = ({ mov, onClose }) => {
  // Detalle mínimo · MOCK 5 §6 incluye doc origen prominente + datos técnicos
  // + timeline audit trail + acciones (anular · historial). Se difiere a SF6/S4.
  return (
    <div
      className="fixed inset-0 bg-slate-900/50 z-50 flex items-end sm:items-center sm:justify-end"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl sm:rounded-r-none sm:h-full sm:max-w-md w-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-slate-900">Detalle movimiento</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-4 space-y-3 text-[12px]">
          <div>
            <div className="text-[10px] uppercase text-slate-500 font-bold">Concepto</div>
            <div className="text-slate-900 font-medium">{mov.concepto}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase text-slate-500 font-bold">Monto</div>
              <div className="text-slate-900 font-bold tabular-nums">
                {mov.moneda === 'USD' ? '$' : 'S/'} {mov.monto.toLocaleString('es-PE')}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-slate-500 font-bold">Estado</div>
              <div className="text-slate-900 font-medium capitalize">{mov.estado}</div>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-500 font-bold">Tipo</div>
            <div className="text-slate-900 font-medium">{mov.tipo}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-500 font-bold">Nº Movimiento</div>
            <div className="text-slate-900 font-mono text-[11px]">{mov.numeroMovimiento}</div>
          </div>
          {mov.referencia && (
            <div>
              <div className="text-[10px] uppercase text-slate-500 font-bold">Referencia</div>
              <div className="text-slate-900 font-mono text-[11px]">{mov.referencia}</div>
            </div>
          )}
          {mov.notas && (
            <div>
              <div className="text-[10px] uppercase text-slate-500 font-bold">Notas</div>
              <div className="text-slate-700 text-[11px]">{mov.notas}</div>
            </div>
          )}
        </div>
        <div className="px-6 py-3 bg-amber-50 border-t border-amber-200 text-[10px] text-amber-900">
          <strong>Drawer detalle completo</strong> · canon MOCK 5 §6 · pendiente chk5.D-S4 (incluye
          doc origen prominente · timeline audit trail · acciones anular/historial).
        </div>
      </div>
    </div>
  );
};

export default FinanzasMovimientos;
