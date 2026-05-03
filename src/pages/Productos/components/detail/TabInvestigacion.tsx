/**
 * TabInvestigacion · Tab "Investigación" del modal detalle producto (Fase F)
 *
 * Mockup canónico: docs/mockups/productos/42-form-investigacion-completa.html (Estado A)
 *
 * Estructura nueva (refactor Fase F):
 *   - KPI strip top (4 cards: Precio venta · Margen · Costo · Última actualización)
 *   - Sección 1: Proveedores con CRUD inline (botón "+ Agregar" abre #37)
 *   - Sección 2: Competencia con CRUD inline (botón "+ Agregar" abre #38)
 *   - Sección 3: Cálculos automáticos
 *     · Flete USD editable + auto-save
 *     · TC read-only del sistema
 *     · Costo unitario card · MIN(prov × (1+tax%)) + flete) × TC
 *     · Precio referencia card · MIN(comp) × 0.95
 *     · Análisis comparativo (Tu precio · Utilidad/u · Margen)
 *     · Banner azul informativo si está arriba/abajo del sugerido
 *   - Notas con auto-save (debounced)
 *   - Footer: 2 acciones (Marcar revisada · Ajustar precio venta)
 *
 * Empty state se mantiene del diseño anterior (#13).
 *
 * El TabInvestigacion delega CRUD y guardado al padre (ProductoDetailModal)
 * mediante callbacks · NO escribe directamente a Firestore.
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Search,
  AlertTriangle,
  Plus,
  Edit2,
  DollarSign,
  Users,
  Calculator,
  Package,
  Target,
  Info,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import type { Producto } from '../../../../types/producto.types';
import type { ProveedorInvestigacionFormValue } from '../modals/investigacion/ProveedorFormModal';
import type { CompetidorInvestigacionFormValue } from '../modals/investigacion/CompetidorFormModal';

interface TabInvestigacionProps {
  producto: Producto;

  /** TC del sistema · viene del hook useTipoCambio */
  tcVenta?: number;
  /** Loading del TC */
  tcLoading?: boolean;

  /** CRUD callbacks · padre gestiona los sub-modales */
  onAgregarProveedor?: () => void;
  onEditarProveedor?: (valor: ProveedorInvestigacionFormValue) => void;
  onAgregarCompetidor?: () => void;
  onEditarCompetidor?: (valor: CompetidorInvestigacionFormValue) => void;

  /** Auto-save callbacks · padre persiste a Firestore */
  onActualizarFlete?: (fleteUSD: number) => Promise<void> | void;
  onActualizarNotas?: (notas: string) => Promise<void> | void;

  /** Acciones explícitas del footer */
  onMarcarRevisada?: () => Promise<void> | void;
  onAbrirAjustarPrecio?: (contexto: {
    costoUnitarioPEN: number;
    precioSugeridoPEN: number;
    rangoCompetencia: { min: number; max: number; total: number };
  }) => void;

  /** Empty state callback · cuando no hay investigación */
  onIniciarInvestigacion?: () => void;
}

function diasDesdeInvestigacion(p: Producto): number | null {
  const inv = p.investigacion;
  if (!inv) return null;
  const ts = (inv.fechaInvestigacion as any)?.toDate?.()?.getTime?.() ?? 0;
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

function diasHastaVencimiento(p: Producto): number | null {
  const inv = p.investigacion;
  if (!inv) return null;
  const ts = (inv.vigenciaHasta as any)?.toDate?.()?.getTime?.() ?? 0;
  if (!ts) return null;
  return Math.floor((ts - Date.now()) / (1000 * 60 * 60 * 24));
}

function isInvestigacionVencida(p: Producto): boolean {
  const dias = diasHastaVencimiento(p);
  return dias !== null && dias < 0;
}

function getPrecioVenta(p: Producto): number {
  return (p as any).precioVenta ?? p.investigacion?.precioSugeridoCalculado ?? 0;
}

export const TabInvestigacion: React.FC<TabInvestigacionProps> = ({
  producto,
  tcVenta = 3.7,
  tcLoading = false,
  onAgregarProveedor,
  onEditarProveedor,
  onAgregarCompetidor,
  onEditarCompetidor,
  onActualizarFlete,
  onActualizarNotas,
  onMarcarRevisada,
  onAbrirAjustarPrecio,
  onIniciarInvestigacion,
}) => {
  const inv = producto.investigacion;
  const dias = diasDesdeInvestigacion(producto);
  const vence = diasHastaVencimiento(producto);
  const vencida = isInvestigacionVencida(producto);
  const precioVenta = getPrecioVenta(producto);

  // ─── Auto-save state · flete + notas ──────────────────────────────────────
  const [flete, setFlete] = useState<string>('');
  const [notas, setNotas] = useState<string>('');
  const [fleteSaved, setFleteSaved] = useState(false);
  const [notasSaved, setNotasSaved] = useState(false);
  const fleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notasTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hidrata desde producto al cambiar
  useEffect(() => {
    setFlete(String(producto.costoFleteInternacional ?? ''));
    setNotas(inv?.notas ?? '');
  }, [producto.id, producto.costoFleteInternacional, inv?.notas]);

  // Debounced auto-save flete
  const handleFleteChange = (val: string) => {
    setFlete(val);
    setFleteSaved(false);
    if (fleteTimerRef.current) clearTimeout(fleteTimerRef.current);
    fleteTimerRef.current = setTimeout(async () => {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0 && onActualizarFlete) {
        try {
          await onActualizarFlete(num);
          setFleteSaved(true);
          setTimeout(() => setFleteSaved(false), 2500);
        } catch (err) {
          console.error('[TabInvestigacion] error guardando flete', err);
        }
      }
    }, 800);
  };

  // Debounced auto-save notas
  const handleNotasChange = (val: string) => {
    setNotas(val);
    setNotasSaved(false);
    if (notasTimerRef.current) clearTimeout(notasTimerRef.current);
    notasTimerRef.current = setTimeout(async () => {
      if (onActualizarNotas) {
        try {
          await onActualizarNotas(val);
          setNotasSaved(true);
          setTimeout(() => setNotasSaved(false), 2500);
        } catch (err) {
          console.error('[TabInvestigacion] error guardando notas', err);
        }
      }
    }, 1000);
  };

  // ─── Cálculos derivados ────────────────────────────────────────────────────
  const calculos = useMemo(() => {
    const proveedores = inv?.proveedoresUSA ?? [];
    const competidores = inv?.competidoresPeru ?? [];

    // Mejor proveedor (precio efectivo más bajo · precio × (1+tax/100))
    const proveedoresOrdenados = [...proveedores].sort((a, b) => {
      const efA = (a.precio ?? 0) * (1 + (a.impuesto ?? 0) / 100);
      const efB = (b.precio ?? 0) * (1 + (b.impuesto ?? 0) / 100);
      return efA - efB;
    });
    const mejorProv = proveedoresOrdenados[0];
    const precioMejorProvUSD = mejorProv?.precio ?? 0;
    const taxMejorPct = mejorProv?.impuesto ?? 0;
    const fleteNum = parseFloat(flete) || 0;
    const tc = tcVenta || 3.7;

    // Costo unitario PEN = (precio_prov × (1+tax%) + flete) × TC
    const costoUSD = precioMejorProvUSD * (1 + taxMejorPct / 100) + fleteNum;
    const costoPEN = costoUSD * tc;

    // Competencia
    const competidoresOrdenados = [...competidores].sort((a, b) => (a.precio ?? 0) - (b.precio ?? 0));
    const minComp = competidoresOrdenados[0]?.precio ?? 0;
    const maxComp = competidoresOrdenados[competidoresOrdenados.length - 1]?.precio ?? 0;
    const promComp = competidores.length > 0
      ? competidores.reduce((s, c) => s + (c.precio ?? 0), 0) / competidores.length
      : 0;

    // Precio referencia = MIN(comp) × 0.95
    const precioReferencia = minComp > 0 ? minComp * 0.95 : 0;

    // Análisis precio actual
    const utilidad = precioVenta > 0 ? precioVenta - costoPEN : 0;
    const margenPct = precioVenta > 0 ? (utilidad / precioVenta) * 100 : 0;

    // Posición vs competencia
    const ranking = [...competidores.map(c => c.precio ?? 0), precioVenta]
      .filter(p => p > 0)
      .sort((a, b) => a - b);
    const posicion = precioVenta > 0 ? ranking.indexOf(precioVenta) + 1 : 0;
    const totalRanking = ranking.length;

    // % vs precio sugerido
    const vsSugeridoPct = precioReferencia > 0 && precioVenta > 0
      ? ((precioVenta - precioReferencia) / precioReferencia) * 100
      : 0;

    return {
      proveedoresOrdenados,
      competidoresOrdenados,
      mejorProv,
      precioMejorProvUSD,
      taxMejorPct,
      costoUSD,
      costoPEN,
      minComp,
      maxComp,
      promComp,
      precioReferencia,
      utilidad,
      margenPct,
      posicion,
      totalRanking,
      vsSugeridoPct,
      tc,
      fleteNum,
    };
  }, [inv, flete, tcVenta, precioVenta]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EMPTY STATE · sin investigación
  // ═══════════════════════════════════════════════════════════════════════════
  if (!inv) {
    return (
      <div className="p-3 lg:p-5">
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-8 lg:p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Search className="w-7 h-7 text-amber-700" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Sin investigación de mercado</h3>
          <p className="text-xs lg:text-sm text-slate-500 max-w-md mx-auto mb-5">
            Aún no se ha analizado proveedores ni competencia. La investigación te da datos para
            decidir precios y márgenes.
          </p>
          {onIniciarInvestigacion && (
            <button
              type="button"
              onClick={onIniciarInvestigacion}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
            >
              <Search className="w-3.5 h-3.5" />
              Iniciar investigación
            </button>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA PRINCIPAL · con investigación (mockup #42 v3.2 Estado A)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col">
      {/* ─── Banner alerta · investigación vencida ─────────────────────── */}
      {vencida && dias !== null && (
        <div className="bg-amber-50 border-b border-amber-200 p-3 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div className="flex-1 text-xs text-amber-900">
            <strong>Datos desactualizados.</strong> Última investigación hace {dias} días · marcá como revisada para renovar la vigencia.
          </div>
        </div>
      )}

      {/* ─── KPI STRIP · 4 cards ───────────────────────────────────────── */}
      <div className="bg-slate-50/50 border-b border-slate-200 px-3 lg:px-5 py-3 grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-200">
        <div className="px-3 first:pl-0">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Precio venta actual</div>
          <div className="text-base font-bold text-slate-900 tabular-nums">
            S/ {precioVenta > 0 ? precioVenta.toFixed(2) : '—'}
          </div>
          {onAbrirAjustarPrecio && (
            <button
              type="button"
              onClick={() => onAbrirAjustarPrecio({
                costoUnitarioPEN: calculos.costoPEN,
                precioSugeridoPEN: calculos.precioReferencia,
                rangoCompetencia: { min: calculos.minComp, max: calculos.maxComp, total: calculos.competidoresOrdenados.length },
              })}
              className="text-[10px] text-amber-700 hover:underline font-bold"
            >
              Ajustar precio →
            </button>
          )}
        </div>
        <div className="px-3">
          <div className={`text-[9px] uppercase tracking-wider font-bold ${
            calculos.margenPct >= 40 ? 'text-emerald-700'
            : calculos.margenPct >= 25 ? 'text-amber-700'
            : 'text-rose-700'
          }`}>Margen</div>
          <div className={`text-base font-bold tabular-nums ${
            calculos.margenPct >= 40 ? 'text-emerald-700'
            : calculos.margenPct >= 25 ? 'text-amber-700'
            : 'text-rose-700'
          }`}>
            {calculos.margenPct > 0 ? `${calculos.margenPct.toFixed(1)}%` : '—'}
          </div>
          <div className="text-[9px] text-slate-500">
            {calculos.utilidad > 0 ? `S/ ${calculos.utilidad.toFixed(2)}/u utilidad` : 'sin utilidad'}
          </div>
        </div>
        <div className="px-3">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Costo unitario</div>
          <div className="text-base font-bold text-slate-900 tabular-nums">
            S/ {calculos.costoPEN > 0 ? calculos.costoPEN.toFixed(2) : '—'}
          </div>
          <div className="text-[9px] text-slate-500">incl. tax + flete USD</div>
        </div>
        <div className="px-3">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Última actualización</div>
          <div className="text-base font-bold text-slate-900">
            {dias !== null ? (dias === 0 ? 'Hoy' : `${dias}d`) : '—'}
          </div>
          <div className={`text-[9px] ${vencida ? 'text-rose-700' : 'text-emerald-700'}`}>
            {vence !== null
              ? vence < 0 ? `vencida hace ${Math.abs(vence)}d` : `vence en ${vence} días`
              : '—'}
          </div>
        </div>
      </div>

      {/* ─── Body · 3 secciones ────────────────────────────────────────── */}
      <div className="p-3 lg:p-5 space-y-3 lg:space-y-4">

        {/* ════ Sección 1 · PROVEEDORES con CRUD inline ════ */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5 flex-wrap">
            <DollarSign className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-900">
                Proveedores analizados <span className="text-[10px] font-normal text-slate-500">· {calculos.proveedoresOrdenados.length}</span>
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {calculos.mejorProv
                  ? `Mejor: ${calculos.mejorProv.nombre} $${calculos.mejorProv.precio?.toFixed(2)}/u`
                  : 'Sin proveedores · agregá el primero'}
              </div>
            </div>
            {onAgregarProveedor && (
              <button
                type="button"
                onClick={onAgregarProveedor}
                className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 flex-shrink-0"
              >
                <Plus className="w-3 h-3" />
                Agregar proveedor
              </button>
            )}
          </div>

          {calculos.proveedoresOrdenados.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-500 italic">
              Aún no hay proveedores analizados. Agregá al menos uno para calcular el costo unitario.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {calculos.proveedoresOrdenados.map((p, idx) => {
                const esTop = idx === 0;
                const sinStock = p.disponibilidad === 'sin_stock';
                return (
                  <div
                    key={p.id ?? idx}
                    className={`px-4 py-2.5 flex items-center gap-3 ${esTop ? 'bg-emerald-50/30' : ''} ${sinStock ? 'opacity-60' : ''}`}
                  >
                    {esTop ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold whitespace-nowrap">
                        ⭐ MÁS BARATO
                      </span>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-slate-900 truncate flex items-center gap-1.5">
                        {p.nombre ?? 'Sin nombre'}
                        {sinStock && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-bold">
                            ⚠ sin stock
                          </span>
                        )}
                      </div>
                      {p.notas && <div className="text-[10px] text-slate-500 truncate">{p.notas}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] font-bold text-slate-900 tabular-nums">
                        $ {p.precio?.toFixed(2) ?? '—'}
                      </div>
                      {p.impuesto !== undefined && p.impuesto > 0 && (
                        <div className="text-[9px] text-slate-500">+ tax {p.impuesto}%</div>
                      )}
                    </div>
                    {onEditarProveedor && (
                      <button
                        type="button"
                        onClick={() => onEditarProveedor({
                          id: p.id ?? `prov-${idx}`,
                          proveedorNombre: p.nombre ?? '',
                          costoUnitarioUSD: p.precio ?? 0,
                          taxValor: p.impuesto ?? 0,
                          taxModo: '%',
                          url: p.url,
                          notas: p.notas,
                        })}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400"
                        title="Editar proveedor"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ════ Sección 2 · COMPETENCIA con CRUD inline ════ */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5 flex-wrap">
            <Users className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                Competencia en Perú <span className="text-[10px] font-normal text-slate-500">· {calculos.competidoresOrdenados.length}</span>
                {precioVenta > 0 && calculos.totalRanking > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                    Tu precio S/ {precioVenta.toFixed(0)} · posición {calculos.posicion} de {calculos.totalRanking}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {calculos.minComp > 0
                  ? `Más barato: ${calculos.competidoresOrdenados[0]?.nombre} S/ ${calculos.minComp.toFixed(0)} · Promedio S/ ${Math.round(calculos.promComp)}`
                  : 'Sin competidores · agregá el primero'}
              </div>
            </div>
            {onAgregarCompetidor && (
              <button
                type="button"
                onClick={onAgregarCompetidor}
                className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1 flex-shrink-0"
              >
                <Plus className="w-3 h-3" />
                Agregar competidor
              </button>
            )}
          </div>

          {calculos.competidoresOrdenados.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-500 italic">
              Aún no hay competidores analizados. Agregá al menos uno para calcular el precio referencia.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {calculos.competidoresOrdenados.map((c, idx) => {
                const esTop = idx === 0;
                const variacion = precioVenta > 0 && c.precio
                  ? ((c.precio - precioVenta) / precioVenta) * 100
                  : 0;
                return (
                  <div
                    key={c.id ?? idx}
                    className={`px-4 py-2.5 flex items-center gap-3 ${esTop ? 'bg-emerald-50/30' : ''}`}
                  >
                    {esTop ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold whitespace-nowrap">
                        ⭐ MÁS BARATO
                      </span>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-slate-900 truncate">
                        {c.nombre ?? 'Sin nombre'}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {c.plataforma ?? 'plataforma sin definir'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] font-bold text-slate-900 tabular-nums">
                        S/ {c.precio?.toFixed(0) ?? '—'}
                      </div>
                      {precioVenta > 0 && c.precio !== undefined && (
                        <div className={`text-[9px] ${variacion < 0 ? 'text-emerald-600' : variacion > 0 ? 'text-rose-500' : 'text-slate-500'}`}>
                          {variacion >= 0 ? '+' : ''}{variacion.toFixed(1)}% vs tu precio
                        </div>
                      )}
                    </div>
                    {onEditarCompetidor && (
                      <button
                        type="button"
                        onClick={() => onEditarCompetidor({
                          id: c.id ?? `comp-${idx}`,
                          competidorNombre: c.nombre ?? '',
                          plataformaSeleccionada: c.plataforma,
                          precioPEN: c.precio ?? 0,
                          url: c.url,
                          notas: c.notas,
                        })}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400"
                        title="Editar competidor"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ════ Sección 3 · CÁLCULOS AUTOMÁTICOS ════ */}
        <div className="bg-white rounded-xl border-2 border-blue-300 overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center gap-2.5">
            <Calculator className="w-4 h-4 text-blue-700" />
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-900">Cálculos automáticos</div>
              <div className="text-[10px] text-blue-700">
                Read-only · derivados de proveedores + competencia + flete · sin gastos administrativos
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3 bg-white">
            {/* Inputs · Costo prov / Flete editable / TC */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  Costo proveedor más bajo
                </label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    value={calculos.precioMejorProvUSD.toFixed(2)}
                    disabled
                    className="w-full pl-6 pr-2 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-xs tabular-nums text-slate-700"
                  />
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  {calculos.mejorProv ? `de ${calculos.mejorProv.nombre} · tax ${calculos.taxMejorPct}%` : 'sin proveedor'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1 flex items-center justify-between">
                  <span>Flete unitario · USD <span className="text-rose-500">*</span></span>
                  {fleteSaved && (
                    <span className="text-[9px] text-emerald-600 font-medium normal-case flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      guardado
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    value={flete}
                    onChange={e => handleFleteChange(e.target.value)}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full pl-6 pr-2 py-1.5 border border-amber-300 bg-amber-50 rounded-lg text-xs tabular-nums font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div className="text-[9px] text-amber-700 mt-0.5">flexible · auto-guarda al cambiar</div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1 flex items-center gap-1">
                  Tipo de cambio (TC)
                  <span className="px-1 py-0.5 rounded bg-purple-100 text-purple-700 text-[8px] font-bold">SISTEMA</span>
                </label>
                <div className="flex items-stretch border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                  <span className="px-2 py-1.5 text-[10px] font-mono bg-slate-100 text-slate-500 border-r border-slate-200">USD→PEN</span>
                  <input
                    type="number"
                    value={calculos.tc.toFixed(2)}
                    disabled
                    className="flex-1 px-2 py-1.5 text-xs tabular-nums border-0 min-w-0 bg-slate-50 text-slate-700"
                  />
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  {tcLoading ? 'cargando...' : 'desde sección TC del sistema'}
                </div>
              </div>
            </div>

            {/* Resultado · 2 cards visualizadas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <div className="rounded-lg border-2 border-slate-300 bg-white p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1 flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  Costo unitario estimado
                </div>
                <div className="text-2xl font-bold text-slate-900 tabular-nums">
                  S/ {calculos.costoPEN > 0 ? calculos.costoPEN.toFixed(2) : '—'}
                </div>
                {calculos.costoPEN > 0 && (
                  <>
                    <div className="text-[10px] text-slate-500 mt-1 font-mono">
                      (${calculos.precioMejorProvUSD.toFixed(2)} × (1+{calculos.taxMejorPct}%) + ${calculos.fleteNum.toFixed(2)}) × {calculos.tc.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-500 italic">
                      = ${calculos.costoUSD.toFixed(2)} USD × TC = S/ {calculos.costoPEN.toFixed(2)}
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-amber-700 font-bold mb-1 flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  Precio referencia sugerido
                </div>
                <div className="text-2xl font-bold text-amber-700 tabular-nums">
                  S/ {calculos.precioReferencia > 0 ? calculos.precioReferencia.toFixed(2) : '—'}
                </div>
                {calculos.precioReferencia > 0 && (
                  <>
                    <div className="text-[10px] text-slate-700 mt-1 font-mono">MIN(competidores) × 0.95</div>
                    <div className="text-[10px] text-slate-500 italic">
                      S/ {calculos.minComp.toFixed(2)} × 0.95 (estrategia 5% bajo)
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Análisis comparativo */}
            {precioVenta > 0 && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Tu precio actual</div>
                    <div className="text-base font-bold text-amber-700 tabular-nums">S/ {precioVenta.toFixed(2)}</div>
                    {calculos.totalRanking > 0 && (
                      <div className="text-[9px] text-slate-500">posición {calculos.posicion} de {calculos.totalRanking}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-emerald-700">Utilidad por unidad</div>
                    <div className="text-base font-bold text-emerald-700 tabular-nums">
                      S/ {calculos.utilidad.toFixed(2)}
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono">
                      {precioVenta.toFixed(0)} - {calculos.costoPEN.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-emerald-700">Margen</div>
                    <div className="text-base font-bold text-emerald-700 tabular-nums">
                      {calculos.margenPct.toFixed(1)}%
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono">
                      {calculos.utilidad.toFixed(2)} / {precioVenta.toFixed(0)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Banner azul · sugerencia de ajuste */}
            {precioVenta > 0 && calculos.precioReferencia > 0 && Math.abs(calculos.vsSugeridoPct) > 3 && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                <div className="text-[10px] text-blue-900 flex-1">
                  Tu precio actual <strong>S/ {precioVenta.toFixed(2)}</strong> está{' '}
                  <strong>
                    {calculos.vsSugeridoPct >= 0 ? '+' : ''}{calculos.vsSugeridoPct.toFixed(1)}%{' '}
                    {calculos.vsSugeridoPct >= 0 ? 'arriba' : 'abajo'} del sugerido
                  </strong>{' '}
                  (S/ {calculos.precioReferencia.toFixed(2)}).{' '}
                  {calculos.vsSugeridoPct > 0
                    ? 'Si querés ser 5% bajo el competidor más barato, ajustá precio.'
                    : 'Estás más barato que el competidor más barato — buena posición.'}
                </div>
                {onAbrirAjustarPrecio && calculos.vsSugeridoPct > 0 && (
                  <button
                    type="button"
                    onClick={() => onAbrirAjustarPrecio({
                      costoUnitarioPEN: calculos.costoPEN,
                      precioSugeridoPEN: calculos.precioReferencia,
                      rangoCompetencia: { min: calculos.minComp, max: calculos.maxComp, total: calculos.competidoresOrdenados.length },
                    })}
                    className="px-2.5 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-50 border border-amber-300 rounded whitespace-nowrap"
                  >
                    Aplicar sugerido →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Notas opcionales con auto-save */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 flex items-center justify-between">
            <span>
              Notas de la investigación{' '}
              <span className="text-slate-400 lowercase normal-case">(opcional)</span>
            </span>
            {notasSaved && (
              <span className="text-[9px] text-emerald-600 font-medium normal-case flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                auto-guardado
              </span>
            )}
          </label>
          <textarea
            rows={2}
            value={notas}
            onChange={e => handleNotasChange(e.target.value)}
            placeholder="ej: SkinTech sigue siendo el mejor por margen + lead time · monitorear DermoAvanzada..."
            className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />
          <div className="text-[9px] text-slate-500 mt-0.5 italic">
            se guarda automáticamente al dejar de escribir · no necesitás botón "guardar"
          </div>
        </div>
      </div>

      {/* ─── Footer · 2 acciones explícitas ────────────────────────────── */}
      <div className="border-t border-slate-200 bg-slate-50 px-3 lg:px-5 py-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[10px] text-slate-500 flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {vencida ? 'Vencida' : `Vigente${vence !== null ? ` · revisión en ${vence} días` : ''}`}
          </span>
          <span className="text-slate-300">·</span>
          <span className="flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="w-3 h-3" />
            Cambios menores se auto-guardan
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onMarcarRevisada && (
            <button
              type="button"
              onClick={onMarcarRevisada}
              className="px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5"
              title="Renueva el ciclo de vigencia (90 días)"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Marcar como revisada
            </button>
          )}
          {onAbrirAjustarPrecio && (
            <button
              type="button"
              onClick={() => onAbrirAjustarPrecio({
                costoUnitarioPEN: calculos.costoPEN,
                precioSugeridoPEN: calculos.precioReferencia,
                rangoCompetencia: { min: calculos.minComp, max: calculos.maxComp, total: calculos.competidoresOrdenados.length },
              })}
              className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Ajustar precio venta
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
