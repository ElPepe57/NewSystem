/**
 * FinanzasSaldos — S57 Fase C · Vista de saldos por entidad (lista CC)
 *
 * Movido desde Finanzas.tsx (que ahora es el Overview ejecutivo).
 * Vista relacional de todas las cuentas corrientes con pipeline filtrable
 * y cards densas estilo CompraCard.
 *
 * Ruta: /finanzas/saldos
 *
 * Decisiones aplicadas:
 *   - D-FIN-1: hub único en /finanzas (overview + sub-rutas)
 *   - D-FIN-2: pipeline clickable como filtro principal
 *   - D-FIN-3: cards estilo CompraCard 12-col
 *   - D-FIN-5: acciones rápidas inline
 *   - D-FIN-7-A: tabs CxC/CxP viejos eliminados de Reportes
 *   - D-FIN-8-A: 1 card por persona (multi-rol con badges futuro)
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { Card } from '../../components/common';
import {
  cuentaCorrienteService,
} from '../../services/cuentaCorriente.service';
import type {
  CuentaCorriente,
  TipoEntidadCC,
  SaldosResumen,
} from '../../types/cuentaCorriente.types';
import { EntidadCCCard } from './components/EntidadCCCard';
import { EntidadCCDetailModal } from './components/EntidadCCDetailModal';
import { PagoAbonoWizard } from './components/PagoAbonoWizard';
import { TarjetaDetailModal } from '../Tesoreria/TarjetasCreditoV2';
import { useTarjetaCreditoStore } from '../../store/tarjetaCreditoStore';
import { useTesoreriaStore } from '../../store/tesoreriaStore';
import { PatrimonioHero } from './components/PatrimonioHero';
import type { TarjetaCredito } from '../../types/tarjetaCredito.types';
import {
  FiltrosFinanzasBar,
  type FiltroEstado,
  type ConteosFiltro,
  type RangoFecha,
  type OrdenLista,
} from './components/FiltrosFinanzasBar';
import { cn } from '../../design-system';

const DIAS_VENCIDO = 30;

function fmtPEN(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtUSD(n: number): string {
  return `US$ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Categoriza una CC en uno de los 5 estados del pipeline.
 */
function clasificarCC(cc: CuentaCorriente): FiltroEstado[] {
  const tienePEN = Math.abs(cc.saldoPEN) > 0.01;
  const tieneUSD = Math.abs(cc.saldoUSD) > 0.01;
  if (!tienePEN && !tieneUSD) return ['saldadas'];

  const estados: FiltroEstado[] = [];
  if (cc.saldoPEN > 0.01 || cc.saldoUSD > 0.01) estados.push('por_cobrar');
  if (cc.saldoPEN < -0.01 || cc.saldoUSD < -0.01) estados.push('por_pagar');

  if (cc.fechaUltimoMovimiento) {
    const dias = Math.floor(
      (Date.now() - cc.fechaUltimoMovimiento.toMillis()) / (1000 * 60 * 60 * 24),
    );
    if (dias > DIAS_VENCIDO) estados.push('vencidas');
  }
  return estados;
}

const FinanzasSaldos: React.FC = () => {
  const [resumen, setResumen] = useState<SaldosResumen | null>(null);
  const [ccs, setCCs] = useState<CuentaCorriente[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Filtros iniciales desde query params (deep-link desde Overview, etc.) ──
  const [searchParams] = useSearchParams();
  const estadoParam = searchParams.get('estado');
  const tipoParam = searchParams.get('tipo');
  const estadosValidos: FiltroEstado[] = ['todas', 'por_cobrar', 'por_pagar', 'vencidas', 'saldadas'];
  const tiposValidos: (TipoEntidadCC | 'todos')[] = ['todos', 'cliente', 'proveedor', 'colaborador', 'empleado'];
  const estadoInicial: FiltroEstado =
    estadoParam && estadosValidos.includes(estadoParam as FiltroEstado)
      ? (estadoParam as FiltroEstado)
      : 'todas';
  const tipoInicial: TipoEntidadCC | 'todos' =
    tipoParam && tiposValidos.includes(tipoParam as TipoEntidadCC | 'todos')
      ? (tipoParam as TipoEntidadCC | 'todos')
      : 'todos';

  const [estadoFiltro, setEstadoFiltro] = useState<FiltroEstado>(estadoInicial);
  const [tipoFiltro, setTipoFiltro] = useState<TipoEntidadCC | 'todos'>(tipoInicial);
  const [rangoFecha, setRangoFecha] = useState<RangoFecha>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<OrdenLista>('mayor_saldo');

  const [ccSeleccionada, setCCSeleccionada] = useState<CuentaCorriente | null>(null);

  // S58d F5 — Modal detalle de tarjeta (cuando el CC seleccionada es de tipo TC)
  const [tarjetaDetalle, setTarjetaDetalle] = useState<TarjetaCredito | null>(null);
  const { tarjetas, fetchTarjetas } = useTarjetaCreditoStore();

  // Imp-L8 · Hero ejecutivo necesita cuentas del store de tesorería
  const cuentasTesoreria = useTesoreriaStore((s) => s.cuentas);
  const fetchCuentas = useTesoreriaStore((s) => s.fetchCuentas);

  useEffect(() => {
    if (cuentasTesoreria.length === 0) void fetchCuentas();
  }, [cuentasTesoreria.length, fetchCuentas]);

  // Asegurar que las tarjetas estén cargadas (para resolver CC tipo='tarjeta_credito')
  useEffect(() => {
    if (tarjetas.length === 0) void fetchTarjetas();
  }, [tarjetas.length, fetchTarjetas]);

  // Handler unificado: abre el modal correcto según el tipo de la CC
  const abrirCCDetalle = (cc: CuentaCorriente) => {
    if (cc.tipo === 'tarjeta_credito') {
      const t = tarjetas.find((x) => x.id === cc.entidadId);
      if (t) {
        setTarjetaDetalle(t);
        return;
      }
      // Si no encontró, fallback al modal genérico
    }
    setCCSeleccionada(cc);
  };

  // ── Wizard de pago/cobro distribuido ──
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardEntidad, setWizardEntidad] = useState<{
    entidadId: string;
    entidadTipo: TipoEntidadCC;
    entidadNombre: string;
    saldoUSD: number;
    saldoPEN: number;
  } | null>(null);

  const abrirWizardConCC = (cc: CuentaCorriente) => {
    setWizardEntidad({
      entidadId: cc.entidadId,
      entidadTipo: cc.tipo,
      entidadNombre: cc.entidadNombre,
      saldoUSD: cc.saldoUSD,
      saldoPEN: cc.saldoPEN,
    });
    setWizardOpen(true);
  };

  const recargarCCs = async () => {
    const [r, list] = await Promise.all([
      cuentaCorrienteService.getResumen(),
      cuentaCorrienteService.getAll(),
    ]);
    setResumen(r);
    setCCs(list);
  };

  // Sincronizar si cambian los params (ej: usuario navega Overview → Saldos otra vez)
  useEffect(() => {
    if (estadoParam && estadosValidos.includes(estadoParam as FiltroEstado)) {
      setEstadoFiltro(estadoParam as FiltroEstado);
    }
    if (tipoParam && tiposValidos.includes(tipoParam as TipoEntidadCC | 'todos')) {
      setTipoFiltro(tipoParam as TipoEntidadCC | 'todos');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoParam, tipoParam]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      cuentaCorrienteService.getResumen(),
      cuentaCorrienteService.getAll(),
    ])
      .then(([r, list]) => {
        if (cancelled) return;
        setResumen(r);
        setCCs(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const conteos: ConteosFiltro = useMemo(() => {
    const c: ConteosFiltro = {
      todas: ccs.length,
      porCobrar: 0,
      porPagar: 0,
      vencidas: 0,
      saldadas: 0,
      porTipo: { cliente: 0, proveedor: 0, colaborador: 0, empleado: 0, tarjeta_credito: 0 },
    };
    for (const cc of ccs) {
      const estados = clasificarCC(cc);
      if (estados.includes('saldadas')) c.saldadas++;
      if (estados.includes('por_cobrar')) c.porCobrar++;
      if (estados.includes('por_pagar')) c.porPagar++;
      if (estados.includes('vencidas')) c.vencidas++;
      c.porTipo[cc.tipo] = (c.porTipo[cc.tipo] || 0) + 1;
    }
    return c;
  }, [ccs]);

  // Imp-L11.c · Calcula timestamp mínimo según el rango seleccionado
  // (filtro por fechaUltimoMovimiento de la CC).
  const minTimestamp = useMemo(() => {
    const ahora = new Date();
    if (rangoFecha === 'todos') return null;
    if (rangoFecha === 'ult_7d') return ahora.getTime() - 7 * 24 * 60 * 60 * 1000;
    if (rangoFecha === 'ult_30d') return ahora.getTime() - 30 * 24 * 60 * 60 * 1000;
    if (rangoFecha === 'ult_90d') return ahora.getTime() - 90 * 24 * 60 * 60 * 1000;
    if (rangoFecha === 'ult_6m') return ahora.getTime() - 180 * 24 * 60 * 60 * 1000;
    if (rangoFecha === 'este_anio') {
      const inicioAnio = new Date(ahora.getFullYear(), 0, 1);
      return inicioAnio.getTime();
    }
    return null;
  }, [rangoFecha]);

  const ccsFiltradas = useMemo(() => {
    let list = ccs;

    if (estadoFiltro !== 'todas') {
      list = list.filter((cc) => clasificarCC(cc).includes(estadoFiltro));
    }
    if (tipoFiltro !== 'todos') {
      list = list.filter((cc) => cc.tipo === tipoFiltro);
    }
    if (minTimestamp !== null) {
      list = list.filter(
        (cc) =>
          cc.fechaUltimoMovimiento &&
          cc.fechaUltimoMovimiento.toMillis() >= minTimestamp,
      );
    }
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      list = list.filter((cc) => cc.entidadNombre.toLowerCase().includes(q));
    }

    const sorted = [...list];
    if (orden === 'mayor_saldo') {
      sorted.sort(
        (a, b) =>
          Math.abs(b.saldoPEN) +
          Math.abs(b.saldoUSD) -
          (Math.abs(a.saldoPEN) + Math.abs(a.saldoUSD)),
      );
    } else if (orden === 'ultima_act') {
      sorted.sort(
        (a, b) =>
          (b.fechaUltimoMovimiento?.toMillis() || 0) -
          (a.fechaUltimoMovimiento?.toMillis() || 0),
      );
    } else {
      sorted.sort((a, b) => a.entidadNombre.localeCompare(b.entidadNombre));
    }

    return sorted;
  }, [ccs, estadoFiltro, tipoFiltro, minTimestamp, busqueda, orden]);

  return (
    <>
      {/* Imp-L8 · Hero ejecutivo Mercury-style con patrimonio total
           + sparkline 90 días + KPI strip + distribución por moneda */}
      <div className="mb-5">
        <PatrimonioHero
          cuentas={cuentasTesoreria}
          ccs={ccs}
          tarjetas={tarjetas}
        />
      </div>

      {/* Imp-L11.c · Barra de filtros UNIFICADA estilo M6 (mockup movimientos).
            Antes: PipelineFinanzas (chips) + toolbar separado (búsqueda+orden) en
            2 cards. Ahora: una sola barra horizontal con date range + estado +
            tipo + búsqueda + orden + limpiar, replicando el patrón Stripe/Mercury. */}
      {resumen && (
        <Card padding="md" className="mb-4">
          <FiltrosFinanzasBar
            estadoActivo={estadoFiltro}
            onCambiarEstado={setEstadoFiltro}
            tipoActivo={tipoFiltro}
            onCambiarTipo={setTipoFiltro}
            rangoFecha={rangoFecha}
            onCambiarRango={setRangoFecha}
            busqueda={busqueda}
            onCambiarBusqueda={setBusqueda}
            orden={orden}
            onCambiarOrden={setOrden}
            conteos={conteos}
          />
        </Card>
      )}

      {/* Lista de cards */}
      {loading ? (
        <Card padding="lg">
          <div className="text-center py-8 text-sm text-slate-400">
            Cargando cuentas corrientes...
          </div>
        </Card>
      ) : ccsFiltradas.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-8">
            <Wallet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="text-sm text-slate-500">
              {ccs.length === 0
                ? 'Aún no hay cuentas corrientes registradas. Cualquier OC, venta o pago generará una automáticamente.'
                : 'No hay entidades que coincidan con los filtros aplicados.'}
            </div>
          </div>
        </Card>
      ) : (
        <div className={cn('space-y-3')}>
          <div className="text-[11px] text-slate-500 px-1">
            Mostrando {ccsFiltradas.length} de {ccs.length} entidades
          </div>
          {ccsFiltradas.map((cc) => (
            <EntidadCCCard
              key={cc.id}
              cc={cc}
              onView={() => abrirCCDetalle(cc)}
              onAccionPrincipal={() => {
                // Para tarjetas, no aplica abono distribuido — abrir detalle
                if (cc.tipo === 'tarjeta_credito') {
                  abrirCCDetalle(cc);
                } else {
                  abrirWizardConCC(cc);
                }
              }}
            />
          ))}
        </div>
      )}

      {ccSeleccionada && (
        <EntidadCCDetailModal
          cc={ccSeleccionada}
          onClose={() => setCCSeleccionada(null)}
          onAccionPrincipal={() => {
            const cc = ccSeleccionada;
            setCCSeleccionada(null);
            abrirWizardConCC(cc);
          }}
        />
      )}

      {/* ─── Wizard pago/cobro distribuido ──────────────────────────── */}
      <PagoAbonoWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        entidadPreseleccionada={wizardEntidad ?? undefined}
        onSuccess={() => {
          void recargarCCs();
        }}
      />

      {/* ─── S58d F5 · Modal detalle TC (cuando cc.tipo='tarjeta_credito') ─── */}
      <TarjetaDetailModal
        isOpen={!!tarjetaDetalle}
        onClose={() => setTarjetaDetalle(null)}
        tarjeta={tarjetaDetalle}
      />
    </>
  );
};

export default FinanzasSaldos;
