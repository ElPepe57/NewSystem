/**
 * Finanzas — S57 Fase C · Overview ejecutivo
 *
 * Vista financiera consolidada estilo Mercury/Stripe. Pensada para CFO/dueño:
 *   - Hero con fecha + acciones (Actualizar, Reporte mensual)
 *   - 4 KPIs combinados (saldo en cuentas + por cobrar + por pagar + flujo del mes)
 *   - Quick actions
 *   - Tendencia 6 meses + Top 5 saldos
 *   - Alertas y vencimientos + Acceso rápido sub-módulos
 *
 * Sub-rutas (gestión operativa):
 *   - /finanzas/saldos    → FinanzasSaldos (lista CC con pipeline)
 *   - /finanzas/cash-flow → Tesorería (movimientos por cuenta)
 *
 * Decisiones aplicadas:
 *   D-OV-1..D-OV-7 (S57)
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  RotateCw,
  Download,
  Plus,
  Handshake,
  ArrowRightLeft,
  Building2,
  CircleDollarSign,
  Banknote,
  ArrowRight,
} from 'lucide-react';
import { Card, Button } from '../../components/common';
import { cuentaCorrienteService } from '../../services/cuentaCorriente.service';
import { getCuentas } from '../../services/tesoreria.cuentas.service';
import { getMovimientos } from '../../services/tesoreria.movimientos.service';
import { Timestamp } from 'firebase/firestore';
import type {
  CuentaCorriente,
  SaldosResumen,
} from '../../types/cuentaCorriente.types';
import type {
  CuentaCaja,
  MovimientoTesoreria,
} from '../../types/tesoreria.types';

import { KPIsCombinados } from './Overview/KPIsCombinados';
import { TendenciaChart } from './Overview/TendenciaChart';
import { TopEntidades } from './Overview/TopEntidades';
import { AlertasFinanzas } from './Overview/AlertasFinanzas';
import { EntidadCCDetailModal } from './components/EntidadCCDetailModal';

const Finanzas: React.FC = () => {
  const navigate = useNavigate();

  // ── Datos ──
  const [resumenCC, setResumenCC] = useState<SaldosResumen | null>(null);
  const [ccs, setCCs] = useState<CuentaCorriente[]>([]);
  const [cuentas, setCuentas] = useState<CuentaCaja[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoTesoreria[]>([]);
  const [loading, setLoading] = useState(true);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date>(new Date());

  // ── Modal de detalle ──
  const [ccSeleccionada, setCCSeleccionada] = useState<CuentaCorriente | null>(null);

  // ── Fetch ──
  const cargar = React.useCallback(async () => {
    setLoading(true);
    try {
      // Movimientos: últimos 6 meses (para chart + KPI flujo del mes)
      const fechaDesde = new Date();
      fechaDesde.setMonth(fechaDesde.getMonth() - 6);
      fechaDesde.setDate(1);
      fechaDesde.setHours(0, 0, 0, 0);

      const [resumen, listaCC, listaCuentas, listaMovs] = await Promise.all([
        cuentaCorrienteService.getResumen(),
        cuentaCorrienteService.getAll(),
        getCuentas(),
        getMovimientos({ fechaInicio: fechaDesde }),
      ]);

      setResumenCC(resumen);
      setCCs(listaCC);
      setCuentas(listaCuentas);
      setMovimientos(listaMovs);
      setUltimaActualizacion(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // ── Conteos para KPIs ──
  const conteosCC = useMemo(() => {
    const DIAS_VENCIDO = 30;
    let porCobrar = 0;
    let porPagar = 0;
    let vencidas = 0;
    for (const cc of ccs) {
      const tienePEN = Math.abs(cc.saldoPEN) > 0.01;
      const tieneUSD = Math.abs(cc.saldoUSD) > 0.01;
      if (!tienePEN && !tieneUSD) continue;
      if (cc.saldoPEN > 0.01 || cc.saldoUSD > 0.01) porCobrar++;
      if (cc.saldoPEN < -0.01 || cc.saldoUSD < -0.01) porPagar++;
      if (cc.fechaUltimoMovimiento) {
        const dias = Math.floor(
          (Date.now() - cc.fechaUltimoMovimiento.toMillis()) / (1000 * 60 * 60 * 24),
        );
        if (dias > DIAS_VENCIDO) vencidas++;
      }
    }
    return { porCobrar, porPagar, vencidas };
  }, [ccs]);

  // ── Texto fecha ──
  const fechaTexto = useMemo(() => {
    const f = new Date();
    return f.toLocaleDateString('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  const tiempoUltActStr = useMemo(() => {
    const segundos = Math.floor((Date.now() - ultimaActualizacion.getTime()) / 1000);
    if (segundos < 60) return 'hace unos segundos';
    const minutos = Math.floor(segundos / 60);
    if (minutos < 60) return `hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
    const horas = Math.floor(minutos / 60);
    return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  }, [ultimaActualizacion]);

  return (
    <>
      {/* Mini-info bar + actions inline (estilo Stripe sub-header).
           Acciones utilitarias (refresh, export): ghost / outline en vez
           de secondary oscuro, para que no compitan con el primary teal
           de las Acciones rápidas más abajo. */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="text-[11px] text-slate-500">
          {fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)} · Última actualización {tiempoUltActStr}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={cargar} disabled={loading}>
            <RotateCw className={loading ? 'w-4 h-4 mr-1.5 animate-spin' : 'w-4 h-4 mr-1.5'} />
            Actualizar
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-1.5" />
            Reporte mensual
          </Button>
        </div>
      </div>

      {/* ─── Hero · KPIs + Quick actions ─────────────────────────────── */}
      <Card padding="lg" className="mb-4">
        <KPIsCombinados
          cuentas={cuentas}
          movimientosUltimos90d={movimientos}
          resumenCC={resumenCC}
          conteosCC={conteosCC}
          loading={loading}
        />

        {/* Quick actions — todos usan el componente Button del design system
             para consistencia visual con el sub-header (Actualizar / Reporte). */}
        <div className="flex items-center gap-2 flex-wrap mt-5">
          <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mr-2">
            Acciones rápidas
          </span>
          <Button variant="primary" size="sm" onClick={() => navigate('/finanzas/cash-flow')}>
            <Plus className="w-4 h-4 mr-1.5" />
            Nuevo movimiento
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/finanzas/cash-flow')}>
            <RotateCw className="w-4 h-4 mr-1.5" />
            Conversión USD/PEN
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/finanzas/cash-flow')}>
            <ArrowRightLeft className="w-4 h-4 mr-1.5" />
            Transferencia interna
          </Button>
          <Button variant="success" size="sm" onClick={() => navigate('/finanzas/saldos?estado=por_cobrar')}>
            <CircleDollarSign className="w-4 h-4 mr-1.5" />
            Registrar cobro
          </Button>
          <Button variant="danger" size="sm" onClick={() => navigate('/finanzas/saldos?estado=por_pagar')}>
            <Banknote className="w-4 h-4 mr-1.5" />
            Registrar pago
          </Button>
        </div>
      </Card>

      {/* ─── Tendencia + Top entidades ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <TendenciaChart movimientos={movimientos} loading={loading} />
        </div>
        <div>
          <TopEntidades
            ccs={ccs}
            loading={loading}
            onEntidadClick={(cc) => setCCSeleccionada(cc)}
          />
        </div>
      </div>

      {/* ─── Alertas + Acceso rápido ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <AlertasFinanzas
            ccs={ccs}
            loading={loading}
            onAlertaClick={(cc) => setCCSeleccionada(cc)}
          />
        </div>

        {/* Acceso rápido sub-módulos */}
        <div className="space-y-3">
          <div className="text-[11px] uppercase text-slate-500 font-semibold tracking-wider">
            Acceso rápido
          </div>

          <Link
            to="/finanzas/saldos"
            className="bg-white border border-slate-200 rounded-xl p-4 block hover:border-teal-300 hover:shadow-sm transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                <Handshake className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 text-sm">Saldos por entidad</div>
                <div className="text-[11px] text-slate-500">
                  {ccs.filter((cc) => Math.abs(cc.saldoPEN) > 0.01 || Math.abs(cc.saldoUSD) > 0.01).length}{' '}
                  entidades activas
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300" />
            </div>
          </Link>

          <Link
            to="/finanzas/cash-flow"
            className="bg-white border border-slate-200 rounded-xl p-4 block hover:border-teal-300 hover:shadow-sm transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 text-sm">Cash flow</div>
                <div className="text-[11px] text-slate-500">
                  {movimientos.filter((m) => m.estado !== 'anulado').length} movimientos · 6 meses
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300" />
            </div>
          </Link>

          <Link
            to="/finanzas/cash-flow?tab=cuentas"
            className="bg-white border border-slate-200 rounded-xl p-4 block hover:border-teal-300 hover:shadow-sm transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 text-sm">Cuentas bancarias</div>
                <div className="text-[11px] text-slate-500">
                  {cuentas.filter((c) => c.activa).length} cuentas · 2 monedas
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300" />
            </div>
          </Link>
        </div>
      </div>

      {/* ─── Modal detalle CC ──────────────────────────────────────── */}
      {ccSeleccionada && (
        <EntidadCCDetailModal
          cc={ccSeleccionada}
          onClose={() => setCCSeleccionada(null)}
        />
      )}
    </>
  );
};

export default Finanzas;
