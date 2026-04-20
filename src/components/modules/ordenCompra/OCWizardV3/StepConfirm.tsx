import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, MapPin, Package, DollarSign, FileText, RefreshCw, Sparkles } from 'lucide-react';
import { ProductoDisplay, RouteVisual } from '../../../../design-system';
import { tipoCambioService } from '../../../../services/tipoCambio.service';
import type { TCResuelto } from '../../../../types/tipoCambio.types';
import type { OCWizardState } from './ocWizardTypes';
import type { OCWizardAction } from './ocWizardReducer';

interface StepConfirmProps {
  state: OCWizardState;
  dispatch: React.Dispatch<OCWizardAction>;
  subtotal: number;
  totalCargos: number;
  totalDescuentos: number;
  totalImpuestos: number;
  grandTotal: number;
}

/**
 * StepConfirm — Paso 5 del OCWizardV3.
 *
 * Preview consolidado de la OC antes de confirmar. Secciones:
 * - Resumen de ruta (con RouteVisual)
 * - Resumen de productos (con ProductoDisplay)
 * - Resumen financiero (cargos, descuentos, impuestos, total en USD y PEN)
 * - TC de compra (editable)
 * - Observaciones (editable)
 * - Alerta si TC faltante
 */
export const StepConfirm: React.FC<StepConfirmProps> = ({
  state,
  dispatch,
  subtotal,
  totalCargos,
  totalDescuentos,
  totalImpuestos,
  grandTotal,
}) => {
  const cfg = state.configLogistica;
  const tcFaltante = !state.tcCompra || state.tcCompra <= 0;

  // S42ah — Auto-carga del TC del día desde tipoCambioService.
  // Se ejecuta una sola vez al montar el paso Confirmar. Si el usuario
  // todavía no tocó el TC (tcCompra === 0), se autopobla con TC venta del
  // día; si ya editó manualmente, se respeta su valor.
  const [tcInfo, setTcInfo] = useState<TCResuelto | null>(null);
  const [tcLoading, setTcLoading] = useState(false);
  const [tcSource, setTcSource] = useState<'auto' | 'manual' | null>(null);

  const cargarTCDelDia = React.useCallback(
    async (force = false) => {
      setTcLoading(true);
      try {
        const tc = await tipoCambioService.resolverTC();
        setTcInfo(tc);
        const tcActual = state.tcCompra || 0;
        if (force || tcActual === 0) {
          dispatch({ type: 'SET_TC', tc: tc.venta } as OCWizardAction);
          setTcSource('auto');
        } else if (Math.abs(tcActual - tc.venta) < 0.0001) {
          setTcSource('auto');
        } else {
          setTcSource('manual');
        }
      } catch (err) {
        // Silencioso: si falla, el usuario lo teclea como antes
        // eslint-disable-next-line no-console
        console.warn('[StepConfirm] No se pudo resolver TC del día:', err);
      } finally {
        setTcLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch]
  );

  useEffect(() => {
    cargarTCDelDia(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // S42ah — Nodos de la ruta en el resumen: construirlos según el escenario
  // logístico real de la OC. Reglas:
  //   - ddp_directo               → Proveedor → Perú (2 nodos, sin casilla intermedia)
  //   - viajero / courier_internacional → Proveedor → Casilla → Perú (3 nodos)
  //   - null / ya_en_peru / default → Proveedor → Casilla (2 nodos, ruta termina en casilla)
  // Razón: una OC solo describe el tramo proveedor→casilla salvo que se
  // declare explícitamente que hay un tramo final a Perú. El envío casilla→Perú
  // se crea después desde /envios.
  const rutaNodes: React.ComponentProps<typeof RouteVisual>['nodes'] = (() => {
    const nodoProveedor = {
      flag: getFlag(cfg.paisOrigen),
      nombre: cfg.proveedorNombre.split(' ')[0] || 'Proveedor',
      tipo: 'proveedor' as const,
      state: 'done' as const,
    };
    const nodoCasilla = {
      tipo: 'casilla' as const,
      codigo: cfg.casillaDestinoCodigo || undefined,
      nombre: cfg.casillaDestinoNombre?.split(' ')[0] || 'Casilla',
      subtexto: cfg.casillaDestinoNombre,
      state: 'done' as const,
    };
    const nodoPeru = {
      flag: '🇵🇪',
      nombre: 'Perú',
      tipo: 'destino' as const,
      subtexto: cfg.llegadaPeru === 'ddp_directo' ? cfg.casillaDestinoNombre || 'Almacén' : 'Almacén',
      state: 'done' as const,
    };

    if (cfg.llegadaPeru === 'ddp_directo') {
      // DDP: el proveedor entrega directo en Perú, no hay casilla intermedia.
      return [nodoProveedor, nodoPeru];
    }
    if (cfg.llegadaPeru === 'viajero' || cfg.llegadaPeru === 'courier_internacional') {
      // Vía colaborador: hay casilla de tránsito + llegada a Perú.
      return [nodoProveedor, nodoCasilla, nodoPeru];
    }
    // Default (S42 simplificado): la OC solo cubre proveedor→casilla.
    // El tramo casilla→Perú, si aplica, se gestiona luego en /envios.
    return [nodoProveedor, nodoCasilla];
  })();

  const rutaSegments: React.ComponentProps<typeof RouteVisual>['segments'] = (() => {
    const segSalida = {
      label: cfg.salidaProveedor === 'recojo_en_origen' ? 'Recojo en origen' : 'Proveedor envía',
      state: 'done' as const,
    };
    if (cfg.llegadaPeru === 'ddp_directo') {
      return [segSalida]; // 1 segmento entre 2 nodos
    }
    if (cfg.llegadaPeru === 'viajero' || cfg.llegadaPeru === 'courier_internacional') {
      return [
        segSalida,
        {
          label: cfg.colaboradorNombre || cfg.llegadaPeru || 'Pendiente',
          state: (cfg.colaboradorId ? 'done' : 'pending') as 'done' | 'pending',
        },
      ];
    }
    // Default: 1 segmento (proveedor → casilla)
    return [segSalida];
  })();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-slate-900">Revisa y confirma</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Valida los datos de la orden antes de crearla. Puedes regresar a pasos anteriores si
          necesitas corregir algo.
        </p>
      </div>

      {/* Ruta */}
      <Section icon={<MapPin className="w-4 h-4" />} title="Ruta logística">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-slate-800">{cfg.proveedorNombre}</div>
            <span className="text-xs text-slate-400">{cfg.paisOrigen}</span>
          </div>

          <RouteVisual size="md" nodes={rutaNodes} segments={rutaSegments} />

          <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100">
            <Field
              label="Colaborador"
              value={cfg.colaboradorNombre || '— Sin asignar —'}
            />
            <Field
              label="Deudor del pago"
              value={
                cfg.deudorTipo === 'colaborador' && cfg.deudorNombre
                  ? `${cfg.deudorNombre} (colaborador)`
                  : cfg.proveedorNombre
              }
            />
          </div>

          {cfg.deudorTipo === 'colaborador' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900">
              <strong>⚠ Deudor alternativo:</strong> {cfg.deudorNombre} adelantó el pago al
              proveedor. La CxP se crea con este colaborador.
            </div>
          )}
        </div>
      </Section>

      {/* Productos */}
      <Section
        icon={<Package className="w-4 h-4" />}
        title={`Productos (${state.productos.length})`}
      >
        <div className="divide-y divide-slate-100 -mx-2">
          {state.productos.map((p, idx) => (
            <div key={idx} className="px-2 py-2 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <ProductoDisplay producto={p} variant="row" hideMarca showMetadata={false} />
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-600 flex-shrink-0">
                <span>× {p.cantidad}</span>
                <span className="tabular-nums">${(p.costoUnitario || 0).toFixed(2)}</span>
                <span className="font-semibold text-slate-900 tabular-nums w-20 text-right">
                  ${((p.cantidad || 0) * (p.costoUnitario || 0)).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Financiero */}
      <Section icon={<DollarSign className="w-4 h-4" />} title="Resumen financiero">
        <div className="space-y-1.5 text-sm">
          <Row label="Subtotal productos" value={subtotal} />
          {totalCargos > 0 && <Row label="+ Cargos" value={totalCargos} />}
          {totalDescuentos > 0 && <Row label="− Descuentos" value={-totalDescuentos} accent="success" />}
          {totalImpuestos > 0 && <Row label="+ Impuestos" value={totalImpuestos} />}
          <div className="flex items-center justify-between pt-2 border-t-2 border-slate-200 mt-2">
            <span className="text-base font-bold text-slate-900">Total USD</span>
            <span className="text-xl font-bold text-teal-700 tabular-nums">
              ${grandTotal.toFixed(2)}
            </span>
          </div>
          {state.tcCompra > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Equivalente PEN</span>
              <span className="tabular-nums">
                S/ {(grandTotal * state.tcCompra).toFixed(2)} · TC {state.tcCompra}
              </span>
            </div>
          )}
        </div>
      </Section>

      {/* TC + Observaciones */}
      <Section icon={<FileText className="w-4 h-4" />} title="Datos finales">
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-700">
                Tipo de cambio del día (USD → PEN) <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => cargarTCDelDia(true)}
                disabled={tcLoading}
                className="text-[11px] font-medium text-teal-600 hover:text-teal-800 hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${tcLoading ? 'animate-spin' : ''}`} />
                Actualizar del sistema
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="number"
                value={state.tcCompra || ''}
                onChange={(e) => {
                  dispatch({ type: 'SET_TC', tc: Number(e.target.value) || 0 } as OCWizardAction);
                  setTcSource('manual');
                }}
                step="0.0001"
                min={0}
                placeholder="Ej: 3.7500"
                className="w-40 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-100 tabular-nums"
              />
              <span className="text-xs text-slate-500">PEN por USD</span>
              {tcSource === 'auto' && tcInfo && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-semibold border border-teal-200">
                  <Sparkles className="w-3 h-3" />
                  TC del día · {tcInfo.fuente}
                </span>
              )}
              {tcSource === 'manual' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200">
                  Manual
                </span>
              )}
            </div>
            {tcInfo && tcSource === 'auto' && (
              <div className="text-[11px] text-slate-500 mt-1">
                Compra S/ {tcInfo.compra.toFixed(4)} · Venta S/ {tcInfo.venta.toFixed(4)}
                {tcInfo.freshness === 'stale' && (
                  <span className="ml-2 text-amber-600 font-medium">⚠ TC de hace &gt;24h</span>
                )}
                {tcInfo.freshness === 'expired' && (
                  <span className="ml-2 text-red-600 font-medium">⚠ TC expirado (&gt;72h)</span>
                )}
                {tcInfo.esFallback && (
                  <span className="ml-2 text-red-600 font-medium">⚠ Usando valor de emergencia</span>
                )}
              </div>
            )}
            {tcFaltante && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                TC obligatorio para confirmar la orden
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Observaciones <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={state.observaciones || ''}
              onChange={(e) =>
                dispatch({ type: 'SET_OBSERVACIONES', text: e.target.value } as OCWizardAction)
              }
              rows={2}
              placeholder="Notas sobre la compra, términos especiales del proveedor, etc."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-100"
            />
          </div>
        </div>
      </Section>

      {/* Confirmación final */}
      {!tcFaltante && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="text-sm text-emerald-900">
            Todos los datos están listos. Haz click en <strong>Crear Orden</strong> para
            confirmar.
          </span>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Internal helpers
// ════════════════════════════════════════════════════════════════════════════

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4">
    <div className="flex items-center gap-2 mb-3">
      <div className="text-slate-500">{icon}</div>
      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{title}</div>
    </div>
    {children}
  </div>
);

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-slate-500">{label}</div>
    <div className="text-slate-800 font-medium truncate">{value}</div>
  </div>
);

const Row: React.FC<{ label: string; value: number; accent?: 'success' }> = ({
  label,
  value,
  accent,
}) => (
  <div className="flex items-center justify-between">
    <span className="text-slate-600">{label}</span>
    <span
      className={`tabular-nums font-medium ${accent === 'success' ? 'text-emerald-700' : 'text-slate-900'
        }`}
    >
      {value < 0 ? '-' : ''}${Math.abs(value).toFixed(2)}
    </span>
  </div>
);

function getFlag(pais?: string): string {
  if (!pais) return '🌐';
  const flags: Record<string, string> = {
    USA: '🇺🇸',
    'Estados Unidos': '🇺🇸',
    CHINA: '🇨🇳',
    China: '🇨🇳',
    COREA: '🇰🇷',
    Corea: '🇰🇷',
    'Corea del Sur': '🇰🇷',
    JAPÓN: '🇯🇵',
    Japón: '🇯🇵',
    MÉXICO: '🇲🇽',
    México: '🇲🇽',
    PERÚ: '🇵🇪',
    Perú: '🇵🇪',
  };
  return flags[pais] ?? '🌐';
}
