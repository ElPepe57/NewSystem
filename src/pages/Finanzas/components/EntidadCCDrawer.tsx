/**
 * EntidadCCDrawer — S57 Fase B · Drawer lateral de cuenta corriente
 *
 * Slide-in compacto desde la derecha. Se abre al hacer click en una columna
 * "Vínculo CC" desde TabMovimientos (Cash flow), cuando un movimiento de
 * tesorería tiene contraparte en una cuenta corriente.
 *
 * Versión reducida del EntidadCCDetailModal:
 *  - Header con tipo + nombre de la entidad
 *  - Saldos PEN y USD destacados
 *  - Últimos 5 movimientos (extracto compacto)
 *  - Footer: "Ver detalle completo" → abre EntidadCCDetailModal
 *
 * Comportamiento:
 *  - ESC cierra el drawer
 *  - Click fuera (backdrop) cierra el drawer
 *  - El consumidor decide qué hacer cuando se pide "ver completo"
 *    (típicamente: cerrar drawer + abrir EntidadCCDetailModal)
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  Coins,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Building,
  Users as UsersIcon,
  Truck,
  IdCard,
  Calendar,
  Receipt,
  ExternalLink,
  ArrowRightLeft,
  Wallet,
} from 'lucide-react';
import { cn } from '../../../design-system';
import { cuentaCorrienteService } from '../../../services/cuentaCorriente.service';
import {
  buildCuentaCorrienteId,
  esDebito,
  esCredito,
  TIPO_ENTIDAD_CC_LABELS,
  TIPO_MOVIMIENTO_CC_LABELS,
  type CuentaCorriente,
  type MovimientoCC,
  type TipoEntidadCC,
  type MonedaCC,
} from '../../../types/cuentaCorriente.types';

// ─── Props ──────────────────────────────────────────────────────────────

/**
 * Identifica la CC a abrir. Soporta dos formas:
 *  - `cc`: pasar la CC ya cargada (cuando el padre la tiene en memoria)
 *  - `entidadId + tipo`: el drawer la carga internamente
 */
type EntidadCCDrawerProps = {
  onClose: () => void;
  /** Click en "Ver detalle completo" — el padre abre el modal grande. */
  onVerCompleto?: (cc: CuentaCorriente) => void;
  /** Click en "Pagar al proveedor" / "Cobrar a cliente" — abre el wizard. */
  onAccionPrincipal?: (cc: CuentaCorriente) => void;
} & (
  | { cc: CuentaCorriente; entidadId?: never; tipo?: never }
  | { cc?: never; entidadId: string; tipo: TipoEntidadCC }
);

// ─── Helpers visuales ──────────────────────────────────────────────────

const ICONO_TIPO: Record<TipoEntidadCC, React.ComponentType<{ className?: string }>> = {
  cliente: UsersIcon,
  proveedor: Building,
  colaborador: Truck,
  empleado: IdCard,
};

const COLOR_TIPO: Record<TipoEntidadCC, { badge: string; ring: string }> = {
  cliente: { badge: 'bg-sky-100 text-sky-700 border-sky-200', ring: 'ring-sky-200' },
  proveedor: { badge: 'bg-amber-100 text-amber-700 border-amber-200', ring: 'ring-amber-200' },
  colaborador: { badge: 'bg-purple-100 text-purple-700 border-purple-200', ring: 'ring-purple-200' },
  empleado: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', ring: 'ring-emerald-200' },
};

function fmt(monto: number, moneda: MonedaCC): string {
  const simbolo = moneda === 'USD' ? 'US$' : 'S/';
  const abs = Math.abs(monto).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (monto > 0.01) return `+${simbolo} ${abs}`;
  if (monto < -0.01) return `−${simbolo} ${abs}`;
  return `${simbolo} 0.00`;
}

function clasificarSaldoMoneda(saldo: number): {
  classes: { container: string; text: string; subtitulo: string };
  label: string;
} {
  if (Math.abs(saldo) < 0.01) {
    return {
      classes: {
        container: 'border border-slate-200 bg-white',
        text: 'text-slate-400',
        subtitulo: 'text-slate-400',
      },
      label: 'Sin saldo',
    };
  }
  if (saldo > 0) {
    return {
      classes: {
        container: 'border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white',
        text: 'text-emerald-700',
        subtitulo: 'text-emerald-600',
      },
      label: 'Por cobrar',
    };
  }
  return {
    classes: {
      container: 'border-2 border-red-200 bg-gradient-to-br from-red-50 to-white',
      text: 'text-red-700',
      subtitulo: 'text-red-600',
    },
    label: 'Por pagar',
  };
}

function fmtMontoMov(m: MovimientoCC): { texto: string; clase: string; signo: string } {
  const simbolo = m.moneda === 'USD' ? 'US$' : 'S/';
  const abs = m.monto.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (esDebito(m.tipo)) {
    return { texto: `${simbolo} ${abs}`, clase: 'text-emerald-700', signo: '+' };
  }
  if (esCredito(m.tipo)) {
    return { texto: `${simbolo} ${abs}`, clase: 'text-red-700', signo: '−' };
  }
  return { texto: `${simbolo} ${abs}`, clase: 'text-slate-700', signo: '' };
}

// ─── Componente ─────────────────────────────────────────────────────────

export const EntidadCCDrawer: React.FC<EntidadCCDrawerProps> = (props) => {
  const { onClose, onVerCompleto, onAccionPrincipal } = props;
  const [cc, setCC] = useState<CuentaCorriente | null>(props.cc ?? null);
  const [movs, setMovs] = useState<MovimientoCC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar CC si vino solo entidadId+tipo
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const loadCC = async (): Promise<CuentaCorriente | null> => {
      if (props.cc) return props.cc;
      if (props.entidadId && props.tipo) {
        return await cuentaCorrienteService.getByEntidad(
          props.entidadId,
          props.tipo,
        );
      }
      return null;
    };

    loadCC()
      .then(async (fetched) => {
        if (cancelled) return;
        if (!fetched) {
          setError('Cuenta corriente no encontrada');
          setCC(null);
          return;
        }
        setCC(fetched);
        const ccId = buildCuentaCorrienteId(fetched.entidadId, fetched.tipo);
        const lista = await cuentaCorrienteService.getMovimientos(ccId, { limit: 5 });
        if (cancelled) return;
        setMovs(lista);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Error cargando cuenta corriente',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.cc, props.entidadId, props.tipo]);

  // ESC cierra
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
        style={{ animation: 'slideInRight 0.25s ease-out' }}
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
            <Coins className="w-4 h-4 text-teal-600" />
            <span className="font-semibold text-slate-900">Cuenta corriente</span>
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
              Cargando cuenta corriente...
            </div>
          ) : error ? (
            <div className="text-center py-12 text-sm text-red-600">
              <X className="w-6 h-6 mx-auto mb-2 text-red-400" />
              {error}
            </div>
          ) : !cc ? null : (
            <>
              {/* Identidad de la entidad */}
              {(() => {
                const TipoIcon = ICONO_TIPO[cc.tipo];
                const tipoColor = COLOR_TIPO[cc.tipo];
                return (
                  <div
                    className={cn(
                      'border rounded-xl p-4 flex items-center gap-3',
                      'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                    )}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-md flex items-center justify-center ring-2',
                        tipoColor.badge,
                        tipoColor.ring,
                      )}
                    >
                      <TipoIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                        {TIPO_ENTIDAD_CC_LABELS[cc.tipo]}
                      </div>
                      <div className="text-sm font-bold text-slate-900 truncate">
                        {cc.entidadNombre}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {cc.entidadId.slice(0, 18)}
                        {cc.entidadId.length > 18 ? '…' : ''}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Saldos PEN y USD */}
              <div className="grid grid-cols-2 gap-2">
                {(() => {
                  const cls = clasificarSaldoMoneda(cc.saldoPEN);
                  return (
                    <div className={cn('rounded-lg p-3', cls.classes.container)}>
                      <div
                        className={cn(
                          'text-[10px] uppercase tracking-wider font-semibold mb-1',
                          cls.classes.subtitulo,
                        )}
                      >
                        {cls.label}
                      </div>
                      <div
                        className={cn(
                          'text-base font-bold tabular-nums',
                          cls.classes.text,
                        )}
                      >
                        {fmt(cc.saldoPEN, 'PEN')}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">PEN</div>
                    </div>
                  );
                })()}
                {(() => {
                  const cls = clasificarSaldoMoneda(cc.saldoUSD);
                  return (
                    <div className={cn('rounded-lg p-3', cls.classes.container)}>
                      <div
                        className={cn(
                          'text-[10px] uppercase tracking-wider font-semibold mb-1',
                          cls.classes.subtitulo,
                        )}
                      >
                        {cls.label}
                      </div>
                      <div
                        className={cn(
                          'text-base font-bold tabular-nums',
                          cls.classes.text,
                        )}
                      >
                        {fmt(cc.saldoUSD, 'USD')}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">USD</div>
                    </div>
                  );
                })()}
              </div>

              {/* Últimos movimientos */}
              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] uppercase text-slate-500 font-semibold flex items-center gap-1.5">
                    <Receipt className="w-3 h-3" /> Últimos movimientos
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {cc.cantidadMovimientos} en total
                  </span>
                </div>
                {movs.length === 0 ? (
                  <div className="text-center py-6 text-[11px] text-slate-400 italic border border-dashed border-slate-200 rounded-md">
                    Sin movimientos aún
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {movs.map((m) => {
                      const monto = fmtMontoMov(m);
                      const Icon = esDebito(m.tipo) ? ArrowUp : ArrowDown;
                      return (
                        <div
                          key={m.id}
                          className="flex items-center gap-2 px-2 py-1.5 border border-slate-100 rounded-md hover:bg-slate-50 transition"
                        >
                          <Icon
                            className={cn(
                              'w-3 h-3 flex-shrink-0',
                              esDebito(m.tipo) ? 'text-emerald-600' : 'text-red-600',
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-medium text-slate-800 truncate">
                              {TIPO_MOVIMIENTO_CC_LABELS[m.tipo]}
                            </div>
                            <div className="text-[9px] text-slate-500 flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5" />
                              {m.fecha.toDate().toLocaleDateString('es-PE', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                              {m.refDocumentoNumero && (
                                <>
                                  <span>·</span>
                                  <span className="font-mono truncate">
                                    {m.refDocumentoNumero}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div
                            className={cn(
                              'text-[11px] font-mono font-bold tabular-nums flex-shrink-0',
                              monto.clase,
                            )}
                          >
                            {monto.signo}
                            {monto.texto}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notas (si existen) */}
              {cc.notas && (
                <div className="border-t border-slate-100 pt-3">
                  <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1">
                    Notas
                  </div>
                  <div className="text-[11px] text-slate-600 italic whitespace-pre-wrap">
                    {cc.notas}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {cc && !loading && !error && (() => {
          const tieneSaldoEnContra =
            cc.saldoPEN < -0.01 || cc.saldoUSD < -0.01;
          const tieneSaldoAFavor =
            cc.saldoPEN > 0.01 || cc.saldoUSD > 0.01;
          const accionLabel = tieneSaldoEnContra
            ? `Pagar a ${cc.tipo === 'cliente' ? 'cliente' : cc.tipo}`
            : tieneSaldoAFavor && cc.tipo === 'cliente'
              ? 'Cobrar a cliente'
              : null;
          return (
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col gap-2 flex-shrink-0">
              {accionLabel && onAccionPrincipal && (
                <button
                  type="button"
                  onClick={() => onAccionPrincipal(cc)}
                  className="text-[11px] px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <Wallet className="w-3 h-3" />
                  {accionLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => onVerCompleto?.(cc)}
                className={cn(
                  'text-[11px] px-3 py-2 rounded-md font-medium flex items-center justify-center gap-1.5 transition',
                  accionLabel && onAccionPrincipal
                    ? 'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700'
                    : 'bg-teal-600 hover:bg-teal-700 text-white',
                )}
              >
                <ExternalLink className="w-3 h-3" />
                Ver detalle completo
                <ArrowRight className="w-3 h-3" />
              </button>
              <Link
                to={`/finanzas/cash-flow?entidadId=${encodeURIComponent(cc.entidadId)}&entidadTipo=${cc.tipo}&entidadNombre=${encodeURIComponent(cc.entidadNombre)}`}
                onClick={onClose}
                className="text-[11px] px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-medium flex items-center justify-center gap-1.5 transition"
              >
                <ArrowRightLeft className="w-3 h-3" />
                Ver movimientos en Cash flow
              </Link>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
