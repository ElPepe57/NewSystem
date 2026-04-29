/**
 * MovimientoTesoreriaDrawer — S57 Fase B · Drawer lateral de detalle
 *
 * Slide-in desde la derecha estilo Stripe/Linear/Notion. Se abre al hacer
 * click en un movimiento CC con `tesoreriaMovimientoId` desde el extracto
 * de una cuenta corriente.
 *
 * No reemplaza la página de Cash flow (vista completa); es solo un peek
 * contextual sin perder el modal CC original.
 *
 * Comportamiento:
 *  - ESC cierra el drawer
 *  - Click fuera (backdrop) cierra el drawer
 *  - Botón "Ver completo" navega a /finanzas/cash-flow con filtro por movId
 */

import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import {
  X,
  ArrowRightLeft,
  ArrowUp,
  ArrowDown,
  RotateCw,
  Receipt,
  ArrowRight,
  Calendar,
  Building2,
  CreditCard,
  Hash,
  StickyNote,
  Link2,
} from 'lucide-react';
import { db } from '../../../lib/firebase';
import { COLLECTIONS } from '../../../config/collections';
import type {
  MovimientoTesoreria,
  TipoMovimientoTesoreria,
} from '../../../types/tesoreria.types';
import { cn } from '../../../design-system';

interface MovimientoTesoreriaDrawerProps {
  movimientoId: string;
  onClose: () => void;
}

// ─── Helpers visuales ──────────────────────────────────────────────────

const TIPO_INGRESOS: TipoMovimientoTesoreria[] = [
  'ingreso_venta',
  'ingreso_anticipo',
  'ingreso_otro',
  'aporte_capital',
  'ajuste_positivo',
];

const TIPO_EGRESOS: TipoMovimientoTesoreria[] = [
  'pago_orden_compra',
  'pago_viajero',
  'pago_proveedor_local',
  'gasto_operativo',
  'retiro_socio',
  'pago_nomina',
  'adelanto_empleado',
  'ajuste_negativo',
];

const TIPO_LABEL: Record<TipoMovimientoTesoreria, string> = {
  ingreso_venta: 'Cobro de venta',
  ingreso_anticipo: 'Adelanto recibido',
  ingreso_otro: 'Otro ingreso',
  aporte_capital: 'Aporte de capital',
  pago_orden_compra: 'Pago a proveedor',
  pago_viajero: 'Pago a viajero',
  pago_proveedor_local: 'Pago a proveedor local',
  gasto_operativo: 'Gasto operativo',
  retiro_socio: 'Retiro de socio',
  conversion_pen_usd: 'Conversión PEN→USD',
  conversion_usd_pen: 'Conversión USD→PEN',
  transferencia_interna: 'Transferencia interna',
  pago_nomina: 'Pago de nómina',
  adelanto_empleado: 'Adelanto a empleado',
  ajuste_positivo: 'Ajuste positivo',
  ajuste_negativo: 'Ajuste negativo',
};

function clasificarTipo(tipo: TipoMovimientoTesoreria): {
  direccion: 'ingreso' | 'egreso' | 'conversion' | 'transferencia';
  iconBg: string;
  textColor: string;
  containerCls: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  if (TIPO_INGRESOS.includes(tipo)) {
    return {
      direccion: 'ingreso',
      iconBg: 'bg-emerald-100 text-emerald-700',
      textColor: 'text-emerald-700',
      containerCls: 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200',
      Icon: ArrowDown,
    };
  }
  if (TIPO_EGRESOS.includes(tipo)) {
    return {
      direccion: 'egreso',
      iconBg: 'bg-red-100 text-red-700',
      textColor: 'text-red-700',
      containerCls: 'bg-gradient-to-br from-red-50 to-white border-red-200',
      Icon: ArrowUp,
    };
  }
  if (tipo === 'conversion_pen_usd' || tipo === 'conversion_usd_pen') {
    return {
      direccion: 'conversion',
      iconBg: 'bg-purple-100 text-purple-700',
      textColor: 'text-purple-700',
      containerCls: 'bg-gradient-to-br from-purple-50 to-white border-purple-200',
      Icon: RotateCw,
    };
  }
  return {
    direccion: 'transferencia',
    iconBg: 'bg-sky-100 text-sky-700',
    textColor: 'text-sky-700',
    containerCls: 'bg-gradient-to-br from-sky-50 to-white border-sky-200',
    Icon: ArrowRightLeft,
  };
}

function fmtMonto(monto: number, moneda: string, signo?: '−' | '+' | '') {
  const simbolo = moneda === 'USD' ? 'US$' : 'S/';
  const abs = Math.abs(monto).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${signo ?? ''}${simbolo} ${abs}`;
}

// ─── Componente ─────────────────────────────────────────────────────────

export const MovimientoTesoreriaDrawer: React.FC<MovimientoTesoreriaDrawerProps> = ({
  movimientoId,
  onClose,
}) => {
  const [mov, setMov] = useState<MovimientoTesoreria | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar movimiento
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDoc(doc(db, COLLECTIONS.MOVIMIENTOS_TESORERIA, movimientoId))
      .then((snap) => {
        if (cancelled) return;
        if (!snap.exists()) {
          setError('Movimiento de tesorería no encontrado');
          return;
        }
        setMov({ id: snap.id, ...snap.data() } as MovimientoTesoreria);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error cargando movimiento');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [movimientoId]);

  // ESC cierra
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Documento vinculado (uno solo, el primero que encuentre)
  const docVinculado = mov
    ? mov.ordenCompraNumero
      ? { tipo: 'OC', numero: mov.ordenCompraNumero, id: mov.ordenCompraId }
      : mov.ventaNumero
        ? { tipo: 'Venta', numero: mov.ventaNumero, id: mov.ventaId }
        : mov.gastoNumero
          ? { tipo: 'Gasto', numero: mov.gastoNumero, id: mov.gastoId }
          : mov.cotizacionNumero
            ? { tipo: 'Cotización', numero: mov.cotizacionNumero, id: mov.cotizacionId }
            : null
    : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

      {/* Drawer */}
      <div
        className="relative w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col h-full"
        style={{
          animation: 'slideInRight 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <ArrowRightLeft className="w-4 h-4 text-purple-600" />
            <span className="font-semibold text-slate-900">Movimiento de tesorería</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 hover:bg-slate-100 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-12 text-sm text-slate-400 italic">
              Cargando movimiento...
            </div>
          ) : error ? (
            <div className="text-center py-12 text-sm text-red-600">
              <X className="w-6 h-6 mx-auto mb-2 text-red-400" />
              {error}
            </div>
          ) : !mov ? null : (
            <>
              {/* Tipo y monto destacado */}
              {(() => {
                const cfg = clasificarTipo(mov.tipo);
                const TipoIcon = cfg.Icon;
                const signo: '−' | '+' | '' =
                  cfg.direccion === 'egreso'
                    ? '−'
                    : cfg.direccion === 'ingreso'
                      ? '+'
                      : '';
                return (
                  <div className={cn('border rounded-xl p-4', cfg.containerCls)}>
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-md flex items-center justify-center',
                          cfg.iconBg,
                        )}
                      >
                        <TipoIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            'text-[10px] uppercase tracking-wider font-semibold',
                            cfg.textColor,
                          )}
                        >
                          {TIPO_LABEL[mov.tipo]}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          Tipo: <code className="text-[10px] bg-white px-1 rounded">{mov.tipo}</code>
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        'text-2xl font-bold tabular-nums',
                        cfg.textColor,
                      )}
                    >
                      {fmtMonto(mov.monto, mov.moneda, signo)}
                    </div>
                    {mov.moneda === 'USD' && mov.montoEquivalentePEN && (
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        ≈ S/ {mov.montoEquivalentePEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })} al TC {mov.tipoCambio.toFixed(3)}
                      </div>
                    )}
                    {mov.moneda === 'PEN' && mov.montoEquivalenteUSD && (
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        ≈ US$ {mov.montoEquivalenteUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} al TC {mov.tipoCambio.toFixed(3)}
                      </div>
                    )}
                    {mov.estado === 'anulado' && (
                      <div className="mt-2 text-[11px] px-2 py-0.5 inline-block rounded-md bg-red-100 text-red-700 font-medium">
                        ⚠ Movimiento anulado
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Detalles */}
              <div className="space-y-2 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Hash className="w-3 h-3" /> Número
                  </span>
                  <span className="text-slate-900 font-mono">
                    {mov.numeroMovimiento}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> Fecha
                  </span>
                  <span className="text-slate-900 font-medium">
                    {mov.fecha.toDate().toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                {mov.cuentaOrigen && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Building2 className="w-3 h-3" /> Cuenta origen
                    </span>
                    <span className="text-slate-900 font-mono text-[11px] truncate max-w-[200px]">
                      {mov.cuentaOrigen.slice(0, 16)}…
                    </span>
                  </div>
                )}
                {mov.cuentaDestino && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Building2 className="w-3 h-3" /> Cuenta destino
                    </span>
                    <span className="text-slate-900 font-mono text-[11px] truncate max-w-[200px]">
                      {mov.cuentaDestino.slice(0, 16)}…
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <CreditCard className="w-3 h-3" /> Método
                  </span>
                  <span className="text-slate-900 font-medium capitalize">
                    {mov.metodo.replace(/_/g, ' ')}
                  </span>
                </div>
                {mov.referencia && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Hash className="w-3 h-3" /> Referencia
                    </span>
                    <span className="text-slate-900 font-mono text-[11px]">
                      {mov.referencia}
                    </span>
                  </div>
                )}
              </div>

              {/* Concepto */}
              {mov.concepto && (
                <div className="border-t border-slate-100 pt-3">
                  <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1.5">
                    Concepto
                  </div>
                  <div className="text-[12px] text-slate-700">{mov.concepto}</div>
                </div>
              )}

              {/* Documento vinculado */}
              {docVinculado && (
                <div className="border-t border-slate-100 pt-3">
                  <div className="text-[10px] uppercase text-slate-500 font-semibold mb-2">
                    Documento vinculado
                  </div>
                  <div className="block border border-slate-200 rounded-md p-3 hover:bg-slate-50 hover:border-teal-300 transition cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Receipt className="text-amber-600 text-xs w-3.5 h-3.5" />
                      <span className="text-[12px] font-mono font-bold text-slate-900">
                        {docVinculado.numero}
                      </span>
                      <span className="text-[10px] text-slate-500">·</span>
                      <span className="text-[11px] text-slate-600">{docVinculado.tipo}</span>
                      <ArrowRight className="text-slate-300 w-3 h-3 ml-auto" />
                    </div>
                  </div>
                </div>
              )}

              {/* Línea de negocio */}
              {mov.lineaNegocioNombre && (
                <div className="border-t border-slate-100 pt-3">
                  <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1">
                    Línea de negocio
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                    {mov.lineaNegocioNombre}
                  </span>
                </div>
              )}

              {/* Notas */}
              {mov.notas && (
                <div className="border-t border-slate-100 pt-3">
                  <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1.5 flex items-center gap-1.5">
                    <StickyNote className="w-3 h-3" /> Notas
                  </div>
                  <div className="text-[11px] text-slate-600 italic whitespace-pre-wrap">
                    {mov.notas}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {mov && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex gap-2 flex-shrink-0">
            <a
              href={`/tesoreria?movId=${mov.id}`}
              className="flex-1 text-[11px] px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 font-medium text-center flex items-center justify-center gap-1.5"
            >
              <Link2 className="w-3 h-3" />
              Ver en Cash flow
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
