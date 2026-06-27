/**
 * AnticipacionQuiebresWidget · C1 · F4 · widget §C (insight) del Resumen.
 *
 * Corre sobre productoIntel (NO el helper de cola): productos donde la cobertura se agota
 * ANTES de poder reponer (`rotacion.diasParaQuiebre < leadTime`) con señal real de venta.
 * "Ya vas tarde aunque compres hoy" — crítico en importación (leadTime largo). Ordena por la
 * ventana que se cierra primero (menor diasParaQuiebre).
 *
 * Spec pixel-perfect: docs/mockups/requerimientos-evolucion-propuesta-v1.html · ACTO 7 §C (C1 · §C).
 */
import React, { useMemo } from 'react';
import { PackageX, AlertTriangle } from 'lucide-react';
import { useProductoIntelStore } from '../../../store/productoIntelStore';
import type { ProductoIntel } from '../../../types/productoIntel.types';

interface FilaQuiebre {
  productoId: string;
  nombre: string;
  diasParaQuiebre: number;
  leadTime: number;
  brecha: number;
}

interface Props {
  /**
   * `embedded` → rinde SIN su card exterior (sin `bg-white border rounded-xl`): solo el
   * panel rose highlight, para insertarse DENTRO del panel "Inteligencia de demanda" (§C)
   * como primera sección. Por defecto (false) rinde como widget autónomo con su card.
   */
  embedded?: boolean;
}

const TOP_N = 6;

/** Color por urgencia de la ventana: ≤7d cerrándose = rose · resto = amber. */
const tono = (dias: number) =>
  dias <= 7
    ? { valor: 'text-rose-700', sub: 'text-rose-500' }
    : { valor: 'text-amber-700', sub: 'text-amber-500' };

export const AnticipacionQuiebresWidget: React.FC<Props> = ({ embedded = false }) => {
  const productosIntel = useProductoIntelStore((s) => s.productosIntel);
  const leadTimeGlobal = useProductoIntelStore((s) => s.leadTimeGlobal);

  const filas = useMemo<FilaQuiebre[]>(() => {
    const ltGlobal = leadTimeGlobal?.tiempoPromedioTotal ?? 0;
    return productosIntel
      .map((p: ProductoIntel): FilaQuiebre | null => {
        const r = p.rotacion;
        // Señal real: hay velocidad/ventas (si no hay demanda, "días para quiebre" no es accionable).
        const tieneSenal = r.promedioVentasDiarias > 0 || r.unidadesVendidas90d > 0;
        if (!tieneSenal) return null;
        const leadTime = p.leadTimePromedioDias && p.leadTimePromedioDias > 0 ? p.leadTimePromedioDias : ltGlobal;
        if (leadTime <= 0) return null; // sin lead time conocido no se puede afirmar "vas tarde"
        // La cobertura se agota ANTES de poder reponer.
        if (!(r.diasParaQuiebre < leadTime)) return null;
        return {
          productoId: p.productoId,
          nombre: p.marca ? `${p.marca} · ${p.nombreComercial}` : p.nombreComercial,
          diasParaQuiebre: Math.max(0, Math.round(r.diasParaQuiebre)),
          leadTime: Math.round(leadTime),
          brecha: Math.round(leadTime - r.diasParaQuiebre),
        };
      })
      .filter((f): f is FilaQuiebre => f !== null)
      .sort((a, b) => a.diasParaQuiebre - b.diasParaQuiebre)
      .slice(0, TOP_N);
  }, [productosIntel, leadTimeGlobal]);

  // Sin productos en riesgo → no renderiza (no ocupa espacio en el Resumen).
  if (filas.length === 0) return null;

  // ── EMBEDDED · panel rose highlight dentro del panel "Inteligencia de demanda" (§C) ──
  if (embedded) {
    return (
      <div className="mx-4 mt-4 mb-3 bg-rose-50 border border-rose-200 rounded-xl overflow-hidden">
        <div className="px-3 py-2.5 border-b border-rose-100 flex items-center gap-2">
          <PackageX className="w-4 h-4 text-rose-600" />
          <span className="text-[12px] font-semibold text-rose-800">Quiebres críticos — se agotan antes de poder reponer</span>
          <span className="ml-auto text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full font-bold tabular-nums">{filas.length}</span>
        </div>
        <div className="px-3 py-2.5 space-y-2">
          <div className="text-[11px] text-rose-700 mb-1">Ya vas tarde aunque compres hoy · leadTime largo = margen de reacción mínimo</div>
          {filas.map((f, i) => {
            const t = tono(f.diasParaQuiebre);
            const ultima = i === filas.length - 1;
            return (
              <div key={f.productoId} className={`flex items-center justify-between py-1 ${ultima ? '' : 'border-b border-rose-100'}`}>
                <div>
                  <div className="text-[12px] font-semibold text-slate-800">{f.nombre}</div>
                  <div className="text-[10px] text-slate-500">leadTime {f.leadTime} días</div>
                </div>
                <div className="text-right">
                  <div className={`text-[11px] font-bold tabular-nums ${t.valor}`}>quiebra en {f.diasParaQuiebre} días</div>
                  <div className={`text-[10px] ${t.sub}`}>{f.brecha} días de brecha</div>
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-rose-600 font-semibold">
            <AlertTriangle className="w-3 h-3" /> Crítico en importación
          </div>
        </div>
      </div>
    );
  }

  // ── AUTÓNOMO · widget con su propia card (uso suelto fuera del panel §C) ──
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <PackageX className="w-4 h-4 text-rose-600" />
        <span className="text-[13px] font-semibold text-slate-800">Anticipación de quiebres — se agotan antes de poder reponer</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="text-[11px] text-slate-500 mb-2">Ya vas tarde aunque compres hoy — el margen de reacción es mínimo en importación</div>
        {filas.map((f, i) => {
          const t = tono(f.diasParaQuiebre);
          const ultima = i === filas.length - 1;
          return (
            <div key={f.productoId} className={`flex items-center justify-between py-1.5 ${ultima ? '' : 'border-b border-slate-100'}`}>
              <div>
                <div className="text-[12px] font-semibold text-slate-800">{f.nombre}</div>
                <div className="text-[10px] text-slate-500">leadTime {f.leadTime} días</div>
              </div>
              <div className="text-right">
                <div className={`text-[11px] font-bold tabular-nums ${t.valor}`}>quiebra en {f.diasParaQuiebre} días</div>
                <div className={`text-[10px] ${t.sub}`}>{f.brecha} días de brecha</div>
              </div>
            </div>
          );
        })}
        <div className="pt-1 text-[11px] text-rose-600 font-semibold flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" /> Crítico en importación: leadTime largo = el margen de reacción es mínimo
        </div>
      </div>
    </div>
  );
};

export default AnticipacionQuiebresWidget;
