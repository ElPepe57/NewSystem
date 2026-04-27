/**
 * AlertasFinanzas — S57 Fase C · Alertas y vencimientos del Overview
 *
 * Genera alertas derivadas del estado actual de las CCs:
 *   - CC vencida grave (>30d sin movimiento + saldo)
 *   - CC vencida moderada (>14d sin movimiento + saldo)
 *   - Saldo a favor de cliente (aplicable a próxima venta)
 *
 * Severidad visual:
 *   - red:    vencida grave (CTA "Ver" con color rojo)
 *   - amber:  vencida moderada (CTA "Pagar/Cobrar")
 *   - sky:    info / saldo a favor (CTA "Aplicar")
 */

import React from 'react';
import {
  TriangleAlert,
  Clock,
  Info,
  Coins,
} from 'lucide-react';
import { cn } from '../../../design-system';
import type { CuentaCorriente } from '../../../types/cuentaCorriente.types';

interface Alerta {
  id: string;
  severidad: 'critica' | 'aviso' | 'info';
  titulo: string;
  descripcion: string;
  cc: CuentaCorriente;
  ctaLabel: string;
}

interface AlertasFinanzasProps {
  ccs: CuentaCorriente[];
  loading?: boolean;
  onAlertaClick?: (cc: CuentaCorriente) => void;
  maxAlertas?: number;
}

const DIAS_GRAVE = 30;
const DIAS_AVISO = 14;

function diasDesde(ts?: { toMillis: () => number }): number | null {
  if (!ts) return null;
  return Math.floor((Date.now() - ts.toMillis()) / (1000 * 60 * 60 * 24));
}

function fmtSaldoMix(cc: CuentaCorriente): string {
  const partes: string[] = [];
  if (Math.abs(cc.saldoPEN) > 0.01) {
    partes.push(
      `S/ ${Math.abs(cc.saldoPEN).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    );
  }
  if (Math.abs(cc.saldoUSD) > 0.01) {
    partes.push(
      `US$ ${Math.abs(cc.saldoUSD).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    );
  }
  return partes.join(' + ') || '—';
}

export const AlertasFinanzas: React.FC<AlertasFinanzasProps> = ({
  ccs,
  loading,
  onAlertaClick,
  maxAlertas = 5,
}) => {
  // ── Generar alertas a partir de las CCs ──
  const alertas = React.useMemo<Alerta[]>(() => {
    const lista: Alerta[] = [];

    for (const cc of ccs) {
      const tieneSaldoAFavorEmpresa = cc.saldoPEN > 0.01 || cc.saldoUSD > 0.01; // por cobrar
      const tieneDeuda = cc.saldoPEN < -0.01 || cc.saldoUSD < -0.01; // por pagar
      const tieneSaldoAFavorCliente =
        cc.tipo === 'cliente' && (cc.saldoPEN < -0.01 || cc.saldoUSD < -0.01);
      const dias = diasDesde(cc.fechaUltimoMovimiento);
      const tieneSaldo = tieneSaldoAFavorEmpresa || tieneDeuda;

      if (tieneSaldo && dias !== null && dias > DIAS_GRAVE) {
        // Vencida grave
        lista.push({
          id: `${cc.id}_grave`,
          severidad: 'critica',
          titulo: `${cc.entidadNombre} sin actividad hace ${dias} días`,
          descripcion: `${tieneSaldoAFavorEmpresa ? 'Por cobrar' : 'Por pagar'} ${fmtSaldoMix(cc)}`,
          cc,
          ctaLabel: 'Revisar',
        });
      } else if (tieneSaldo && dias !== null && dias > DIAS_AVISO) {
        // Vencida moderada
        lista.push({
          id: `${cc.id}_aviso`,
          severidad: 'aviso',
          titulo: `${cc.entidadNombre} · ${dias}d sin movimientos`,
          descripcion: `${tieneSaldoAFavorEmpresa ? 'Por cobrar' : 'Por pagar'} ${fmtSaldoMix(cc)}`,
          cc,
          ctaLabel: tieneSaldoAFavorEmpresa ? 'Cobrar' : 'Pagar',
        });
      } else if (tieneSaldoAFavorCliente) {
        // Saldo a favor del cliente (info)
        lista.push({
          id: `${cc.id}_info`,
          severidad: 'info',
          titulo: `Saldo a favor con ${cc.entidadNombre}`,
          descripcion: `${fmtSaldoMix(cc)} aplicable a su próxima venta`,
          cc,
          ctaLabel: 'Aplicar',
        });
      }
    }

    // Ordenar: críticas primero, después por magnitud descendente
    const ordenSev: Record<Alerta['severidad'], number> = {
      critica: 0,
      aviso: 1,
      info: 2,
    };
    lista.sort((a, b) => {
      const sevDiff = ordenSev[a.severidad] - ordenSev[b.severidad];
      if (sevDiff !== 0) return sevDiff;
      const magA = Math.abs(a.cc.saldoPEN) + Math.abs(a.cc.saldoUSD);
      const magB = Math.abs(b.cc.saldoPEN) + Math.abs(b.cc.saldoUSD);
      return magB - magA;
    });

    return lista.slice(0, maxAlertas);
  }, [ccs, maxAlertas]);

  const conteoActivas = alertas.length;
  const hayCriticas = alertas.some((a) => a.severidad === 'critica');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Alertas y vencimientos</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Acciones que requieren tu atención
          </p>
        </div>
        {conteoActivas > 0 && (
          <span
            className={cn(
              'text-[11px] px-2 py-0.5 rounded-md font-semibold',
              hayCriticas ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
            )}
          >
            {conteoActivas} activa{conteoActivas !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2 mt-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-50 rounded-md animate-pulse" />
          ))}
        </div>
      ) : alertas.length === 0 ? (
        <div className="text-center py-8">
          <Coins className="w-7 h-7 text-emerald-300 mx-auto mb-2" />
          <div className="text-sm text-slate-500">
            Todo en orden. No hay vencimientos activos ni saldos críticos.
          </div>
        </div>
      ) : (
        <div className="space-y-2 mt-3">
          {alertas.map((a) => {
            const cfg = configSeveridad[a.severidad];
            const Icon = cfg.Icon;
            return (
              <div
                key={a.id}
                className={cn(
                  'border-l-4 rounded-r-md p-3 flex items-start gap-3',
                  cfg.borderColor,
                  cfg.bgColor,
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0',
                    cfg.iconBg,
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-[13px] font-semibold truncate', cfg.titleColor)}>
                    {a.titulo}
                  </div>
                  <div className={cn('text-[11px] truncate', cfg.descColor)}>
                    {a.descripcion}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onAlertaClick?.(a.cc)}
                  className={cn(
                    'text-[11px] px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap transition',
                    cfg.btnClass,
                  )}
                >
                  {a.ctaLabel}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Configuración por severidad ──────────────────────────────────────────

const configSeveridad: Record<
  Alerta['severidad'],
  {
    borderColor: string;
    bgColor: string;
    iconBg: string;
    titleColor: string;
    descColor: string;
    btnClass: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  critica: {
    borderColor: 'border-red-500',
    bgColor: 'bg-red-50/40',
    iconBg: 'bg-red-100 text-red-700',
    titleColor: 'text-red-900',
    descColor: 'text-red-700',
    btnClass: 'bg-red-600 text-white hover:bg-red-700',
    Icon: TriangleAlert,
  },
  aviso: {
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-50/40',
    iconBg: 'bg-amber-100 text-amber-700',
    titleColor: 'text-amber-900',
    descColor: 'text-amber-700',
    btnClass: 'bg-amber-600 text-white hover:bg-amber-700',
    Icon: Clock,
  },
  info: {
    borderColor: 'border-sky-400',
    bgColor: 'bg-sky-50/40',
    iconBg: 'bg-sky-100 text-sky-700',
    titleColor: 'text-sky-900',
    descColor: 'text-sky-700',
    btnClass: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50',
    Icon: Info,
  },
};
