import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Truck, DollarSign, Award, Brain } from 'lucide-react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { cn } from '../../../design-system';
import type { OrdenCompra } from '../../../types/ordenCompra.types';
import { useTipoCambio } from '../../../hooks/useTipoCambio';

/**
 * S54 · Tanda 3 — Panel de Inteligencia del detalle de OC.
 *
 * 4 widgets que convierten el histórico del ERP en decisiones accionables:
 *   1. SLA del proveedor   (lead time promedio + ratio de incidencias)
 *   2. Precio vs. histórico (comparativo de cada SKU vs. avg del mismo proveedor)
 *   3. Impacto FX          (TC hoy vs. TC creación + proyección)
 *   4. Ranking rentabilidad (SKUs ordenados por margen proyectado)
 *
 * Datos de origen:
 *   - collection `ordenesCompra` → para histórico del proveedor
 *   - collection `incidenciasOC` → para ratio de incidencias
 *   - hook `useTipoCambio` → para TC actual
 */

interface InteligenciaOCPanelProps {
  orden: OrdenCompra;
}

// ─────────────────────────────────────────────────────────────────────────────

interface SLAProveedor {
  leadTimeDias: number | null;
  ratioIncidencias: number | null;
  ocsAnalizadas: number;
}

interface PrecioVsHistorico {
  productoId: string;
  sku: string;
  nombre: string;
  precioActual: number;
  precioPromedio: number | null;
  ocsReferencia: number;
  variacionPct: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────

export const InteligenciaOCPanel: React.FC<InteligenciaOCPanelProps> = ({ orden }) => {
  const [sla, setSla] = useState<SLAProveedor | null>(null);
  const [precios, setPrecios] = useState<PrecioVsHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const { tc: tcActual } = useTipoCambio();

  // ─── Cálculos de SLA + precio vs histórico ─────────────────────────────
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setLoading(true);
      try {
        // OCs históricas del mismo proveedor (máx 50 más recientes)
        const ocsQuery = query(
          collection(db, 'ordenesCompra'),
          where('proveedorId', '==', orden.proveedorId),
          limit(50)
        );
        const ocsSnap = await getDocs(ocsQuery);
        const ocs = ocsSnap.docs
          .map((d) => ({ ...(d.data() as OrdenCompra), id: d.id }))
          .filter((o) => o.id !== orden.id);

        // Incidencias del proveedor (ratio)
        let totalIncidencias = 0;
        try {
          const incQuery = query(
            collection(db, 'incidenciasOC'),
            where('proveedorId', '==', orden.proveedorId)
          );
          const incSnap = await getDocs(incQuery);
          totalIncidencias = incSnap.size;
        } catch {
          // ignore
        }

        // Lead time: promedio de (fechaRecibida - fechaEnviada) para OCs completadas
        const leadTimes: number[] = [];
        for (const o of ocs) {
          if (o.fechaRecibida && o.fechaEnviada) {
            const rec = (o.fechaRecibida as { toDate?: () => Date }).toDate?.();
            const env = (o.fechaEnviada as { toDate?: () => Date }).toDate?.();
            if (rec && env) {
              const dias = (rec.getTime() - env.getTime()) / (1000 * 60 * 60 * 24);
              if (dias > 0 && dias < 180) leadTimes.push(dias);
            }
          }
        }
        const leadTimePromedio =
          leadTimes.length > 0
            ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length)
            : null;

        const ratio = ocs.length > 0 ? (totalIncidencias / ocs.length) * 100 : null;

        // Precio vs histórico: por cada producto de la OC actual, calcular avg histórico
        const preciosCalc: PrecioVsHistorico[] = orden.productos.map((p) => {
          const entradas: number[] = [];
          for (const o of ocs) {
            for (const op of o.productos) {
              if (op.productoId === p.productoId && typeof op.costoUnitario === 'number') {
                entradas.push(op.costoUnitario);
              }
            }
          }
          const promedio =
            entradas.length > 0
              ? entradas.reduce((a, b) => a + b, 0) / entradas.length
              : null;
          const variacionPct =
            promedio !== null && promedio > 0
              ? ((p.costoUnitario - promedio) / promedio) * 100
              : null;
          return {
            productoId: p.productoId,
            sku: p.sku || '—',
            nombre: p.nombreComercial || 'Producto',
            precioActual: p.costoUnitario,
            precioPromedio: promedio,
            ocsReferencia: entradas.length,
            variacionPct,
          };
        });

        if (!cancelado) {
          setSla({
            leadTimeDias: leadTimePromedio,
            ratioIncidencias: ratio,
            ocsAnalizadas: ocs.length,
          });
          setPrecios(preciosCalc);
        }
      } catch (err) {
        console.warn('[InteligenciaOC] Error cargando histórico:', err);
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    cargar();
    return () => {
      cancelado = true;
    };
  }, [orden.id, orden.proveedorId, orden.productos]);

  // ─── Impacto FX ────────────────────────────────────────────────────────
  const fxData = useMemo(() => {
    const tcCreacion = orden.tcReferencial || orden.tcCompra || 0;
    const tcHoy = tcActual?.promedio || tcCreacion;
    const delta = tcHoy - tcCreacion;
    const impactoPEN = delta * orden.totalUSD;
    const variacionPct = tcCreacion > 0 ? (delta / tcCreacion) * 100 : 0;
    return { tcCreacion, tcHoy, delta, impactoPEN, variacionPct };
  }, [orden.tcReferencial, orden.tcCompra, orden.totalUSD, tcActual]);

  // ─── Ranking rentabilidad proyectada ────────────────────────────────────
  // Heurística simple: SKUs con precio más bajo que el avg histórico → mejor margen esperado.
  const ranking = useMemo(() => {
    return [...precios]
      .filter((p) => p.variacionPct !== null)
      .sort((a, b) => (a.variacionPct ?? 0) - (b.variacionPct ?? 0));
  }, [precios]);

  if (loading) {
    return (
      <div className="p-6 text-center text-xs text-slate-500">
        <Brain className="w-5 h-5 mx-auto mb-2 animate-pulse text-slate-400" />
        Analizando histórico del proveedor…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Context banner */}
      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 flex items-start gap-2">
        <Brain className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          Análisis cruzado con <b>{sla?.ocsAnalizadas || 0} OCs históricas</b> de{' '}
          <b>{orden.nombreProveedor}</b>. Los widgets se recalculan cuando cambian los datos del ERP.
        </div>
      </div>

      {/* Grid 2 columnas de widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Widget 1: SLA proveedor */}
        <WidgetSLA sla={sla} />

        {/* Widget 2: Precio vs histórico */}
        <WidgetPrecios precios={precios} />

        {/* Widget 3: Impacto FX */}
        <WidgetFX fx={fxData} />

        {/* Widget 4: Ranking rentabilidad */}
        <WidgetRanking ranking={ranking} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Widgets
// ─────────────────────────────────────────────────────────────────────────────

const WidgetSLA: React.FC<{ sla: SLAProveedor | null }> = ({ sla }) => {
  const leadOK = sla?.leadTimeDias !== null && sla!.leadTimeDias! <= 15;
  const ratioOK = sla?.ratioIncidencias === null || (sla?.ratioIncidencias ?? 0) < 5;
  const healthyBadge =
    leadOK && ratioOK
      ? { label: '🟢 Al día', color: 'bg-emerald-100 text-emerald-700' }
      : { label: '🟡 Monitorear', color: 'bg-amber-100 text-amber-700' };

  return (
    <Widget
      icon={<Truck className="w-4 h-4 text-slate-500" />}
      titulo="SLA del proveedor"
      badge={healthyBadge}
    >
      {sla === null || sla.ocsAnalizadas === 0 ? (
        <EmptyWidget msg="Sin histórico suficiente para este proveedor." />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Metric
            big={sla.leadTimeDias !== null ? `${sla.leadTimeDias} días` : '—'}
            label="Lead time promedio"
            caption={`confirmación → recepción (${sla.ocsAnalizadas} OCs)`}
          />
          <Metric
            big={sla.ratioIncidencias !== null ? `${sla.ratioIncidencias.toFixed(1)}%` : '—'}
            label="Ratio de incidencias"
            caption="por OC histórica"
          />
        </div>
      )}
    </Widget>
  );
};

const WidgetPrecios: React.FC<{ precios: PrecioVsHistorico[] }> = ({ precios }) => {
  const conHistorico = precios.filter((p) => p.variacionPct !== null);
  const subio = conHistorico.filter((p) => (p.variacionPct ?? 0) > 2);
  const bajo = conHistorico.filter((p) => (p.variacionPct ?? 0) < -2);

  const badge =
    subio.length > bajo.length
      ? { label: '🔴 Subió en promedio', color: 'bg-red-100 text-red-700' }
      : bajo.length > subio.length
        ? { label: '🟢 Bajó en promedio', color: 'bg-emerald-100 text-emerald-700' }
        : { label: '🟡 Estable', color: 'bg-slate-100 text-slate-700' };

  return (
    <Widget
      icon={<DollarSign className="w-4 h-4 text-slate-500" />}
      titulo="Precio vs. histórico"
      badge={conHistorico.length > 0 ? badge : undefined}
    >
      {conHistorico.length === 0 ? (
        <EmptyWidget msg="Es la primera compra de estos SKUs con este proveedor." />
      ) : (
        <div className="space-y-1 text-xs">
          {precios.slice(0, 5).map((p) => (
            <div key={p.productoId} className="flex items-center justify-between gap-2">
              <span className="truncate text-slate-700 flex-1">
                <span className="font-mono text-[10px] text-slate-500">{p.sku}</span>{' '}
                {p.nombre}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0 text-right">
                <span className="tabular-nums font-semibold">${p.precioActual.toFixed(2)}</span>
                {p.variacionPct !== null ? (
                  <span
                    className={cn(
                      'text-[10px] font-semibold inline-flex items-center gap-0.5',
                      p.variacionPct > 2
                        ? 'text-red-600'
                        : p.variacionPct < -2
                          ? 'text-emerald-600'
                          : 'text-slate-500'
                    )}
                  >
                    {p.variacionPct > 2 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : p.variacionPct < -2 ? (
                      <TrendingDown className="w-3 h-3" />
                    ) : (
                      <Minus className="w-3 h-3" />
                    )}
                    {p.variacionPct > 0 ? '+' : ''}
                    {p.variacionPct.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">nuevo</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
};

const WidgetFX: React.FC<{
  fx: { tcCreacion: number; tcHoy: number; delta: number; impactoPEN: number; variacionPct: number };
}> = ({ fx }) => {
  const sinFX = fx.tcCreacion === 0;
  const pctAbs = Math.abs(fx.variacionPct);
  const badge = sinFX
    ? undefined
    : pctAbs < 1
      ? { label: '🟢 Estable', color: 'bg-emerald-100 text-emerald-700' }
      : pctAbs < 3
        ? { label: '🟡 Leve variación', color: 'bg-amber-100 text-amber-700' }
        : { label: '🔴 Volátil', color: 'bg-red-100 text-red-700' };

  return (
    <Widget
      icon={<DollarSign className="w-4 h-4 text-slate-500" />}
      titulo="Impacto FX proyectado"
      badge={badge}
    >
      {sinFX ? (
        <EmptyWidget msg="OC sin TC registrado." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1 text-center text-xs">
            <div>
              <div className="text-[10px] text-slate-500">TC creación</div>
              <div className="font-bold tabular-nums">{fx.tcCreacion.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">TC hoy</div>
              <div className="font-bold tabular-nums">{fx.tcHoy.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Impacto</div>
              <div
                className={cn(
                  'font-bold tabular-nums',
                  fx.impactoPEN > 0 ? 'text-red-600' : fx.impactoPEN < 0 ? 'text-emerald-600' : 'text-slate-500'
                )}
              >
                {fx.impactoPEN > 0 ? '+' : ''}S/ {fx.impactoPEN.toFixed(2)}
              </div>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-2">
            Variación TC: {fx.variacionPct > 0 ? '+' : ''}
            {fx.variacionPct.toFixed(2)}%
          </div>
        </>
      )}
    </Widget>
  );
};

const WidgetRanking: React.FC<{ ranking: PrecioVsHistorico[] }> = ({ ranking }) => {
  return (
    <Widget
      icon={<Award className="w-4 h-4 text-slate-500" />}
      titulo="Ranking rentabilidad proyectada"
    >
      {ranking.length === 0 ? (
        <EmptyWidget msg="Sin histórico para proyectar margen." />
      ) : (
        <div className="space-y-1 text-xs">
          {ranking.slice(0, 3).map((p, i) => {
            const medalla = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
            const esGanador = (p.variacionPct ?? 0) < -1;
            return (
              <div key={p.productoId} className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'truncate flex-1',
                    esGanador ? 'text-emerald-700 font-semibold' : 'text-slate-700'
                  )}
                >
                  {medalla} {p.nombre}
                </span>
                <span
                  className={cn(
                    'text-[11px] tabular-nums flex-shrink-0',
                    (p.variacionPct ?? 0) < -1
                      ? 'text-emerald-700 font-semibold'
                      : (p.variacionPct ?? 0) > 1
                        ? 'text-amber-700'
                        : 'text-slate-500'
                  )}
                >
                  {p.variacionPct !== null
                    ? `${p.variacionPct > 0 ? '+' : ''}${p.variacionPct.toFixed(1)}% vs avg`
                    : '—'}
                </span>
              </div>
            );
          })}
          <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-100 mt-2">
            Heurística: precio más bajo que el promedio histórico → mayor margen proyectado.
          </div>
        </div>
      )}
    </Widget>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Primitivos compartidos
// ─────────────────────────────────────────────────────────────────────────────

const Widget: React.FC<{
  icon: React.ReactNode;
  titulo: string;
  badge?: { label: string; color: string };
  children: React.ReactNode;
}> = ({ icon, titulo, badge, children }) => (
  <div className="p-3 border border-slate-200 rounded-lg bg-gradient-to-br from-white to-slate-50">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] uppercase font-semibold text-slate-500">{titulo}</span>
      </div>
      {badge && (
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', badge.color)}>
          {badge.label}
        </span>
      )}
    </div>
    {children}
  </div>
);

const Metric: React.FC<{ big: string; label: string; caption?: string }> = ({
  big,
  label,
  caption,
}) => (
  <div>
    <div className="text-lg font-bold text-slate-900 tabular-nums">{big}</div>
    <div className="text-[10px] font-semibold text-slate-600">{label}</div>
    {caption && <div className="text-[10px] text-slate-500">{caption}</div>}
  </div>
);

const EmptyWidget: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="text-xs text-slate-500 italic py-2">{msg}</div>
);
