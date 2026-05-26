/**
 * TabBoletas.tsx
 *
 * chk5.PERSONAS-v5.4 · F10.A · 2026-05-26
 *
 * Refactor canon banking-grade sky · cards apiladas + KPIs mini + filtros + BoletaCard.
 * Reemplaza la versión legacy con DataTable + Badge + Modal base.
 *
 * Mockup ref: planilla-v5.3-canon.html (cards apiladas estilo F4 canon).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText, Check, CreditCard, XCircle, Trash2, ChevronLeft, ChevronRight,
  AlertCircle, Plus, RefreshCw, Filter,
} from 'lucide-react';
import { useConfirmDialog, ConfirmDialog } from '../../../components/common';
import { useToastStore } from '../../../store/toastStore';
import { useAuthStore } from '../../../store/authStore';
import { usePlanillaStore } from '../../../store/planillaStore';
import { formatCurrencyPEN } from '../../../utils/format';
import { ESTADO_BOLETA_LABELS } from '../../../types/planilla.types';
import type { Boleta, EstadoBoleta } from '../../../types/planilla.types';
import { BoletaDetalleModal } from '../../../components/modules/planilla/BoletaDetalleModal';
import { NuevaBoletaModal } from '../../../components/modules/planilla/NuevaBoletaModal';
import { GenerarBoletasModal } from '../../../components/modules/planilla/GenerarBoletasModal';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Chips de estado canon (mismos colores que BoletaDetalleModal) */
const ESTADO_CHIP: Record<EstadoBoleta, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  aprobada: 'bg-amber-100 text-amber-700',
  pagada: 'bg-emerald-100 text-emerald-700',
  anulada: 'bg-rose-100 text-rose-700',
};

const FILTROS_ESTADO: Array<{ id: 'todas' | EstadoBoleta; label: string; tinte: string }> = [
  { id: 'todas', label: 'Todas', tinte: 'bg-sky-100 text-sky-700' },
  { id: 'borrador', label: 'Borrador', tinte: 'bg-slate-100 text-slate-700' },
  { id: 'aprobada', label: 'Aprobada', tinte: 'bg-amber-100 text-amber-700' },
  { id: 'pagada', label: 'Pagada', tinte: 'bg-emerald-100 text-emerald-700' },
];

function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

export const TabBoletas: React.FC = () => {
  const toast = useToastStore();
  const { user } = useAuthStore();
  const {
    boletas, loadingBoletas, fetchBoletas,
    mesActivo, anioActivo, setMesActivo, setAnioActivo,
    aprobarBoleta, anularBoleta, eliminarBoleta,
  } = usePlanillaStore();
  const [boletaDetalle, setBoletaDetalle] = useState<Boleta | null>(null);
  const [nuevaBoletaOpen, setNuevaBoletaOpen] = useState(false);
  const [generarOpen, setGenerarOpen] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<'todas' | EstadoBoleta>('todas');
  const confirm = useConfirmDialog();

  useEffect(() => {
    fetchBoletas();
  }, [fetchBoletas]);

  const filtradas = useMemo(() => {
    if (filtroEstado === 'todas') return boletas;
    return boletas.filter((b) => b.estado === filtroEstado);
  }, [boletas, filtroEstado]);

  const stats = useMemo(() => {
    const total = boletas.length;
    const pagadas = boletas.filter((b) => b.estado === 'pagada').length;
    const pendientes = boletas.filter((b) => b.estado === 'borrador' || b.estado === 'aprobada').length;
    const totalNeto = boletas.reduce((s, b) => s + b.totalNeto, 0);
    return { total, pagadas, pendientes, totalNeto };
  }, [boletas]);

  const handleAprobar = async (boleta: Boleta) => {
    if (!user?.uid) return;
    try {
      await aprobarBoleta(boleta.id, user.uid);
      toast.success(`Boleta ${boleta.id} aprobada`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al aprobar');
    }
  };

  const handleAnular = async (boleta: Boleta) => {
    const ok = await confirm.confirm({
      title: 'Anular boleta',
      message: `¿Anular la boleta ${boleta.id} de ${boleta.empleadoNombre}?`,
      confirmText: 'Anular',
      variant: 'danger',
    });
    if (ok) {
      try {
        await anularBoleta(boleta.id);
        toast.success('Boleta anulada');
      } catch (e: any) {
        toast.error(e?.message ?? 'Error al anular');
      }
    }
  };

  const handleEliminar = async (boleta: Boleta) => {
    const ok = await confirm.confirm({
      title: 'Eliminar boleta',
      message: `¿Eliminar la boleta ${boleta.id}? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'danger',
    });
    if (ok) {
      try {
        await eliminarBoleta(boleta.id);
        toast.success('Boleta eliminada');
      } catch (e: any) {
        toast.error(e?.message ?? 'Error al eliminar');
      }
    }
  };

  const handleMesAnterior = () => {
    if (mesActivo === 1) {
      setAnioActivo(anioActivo - 1);
      setMesActivo(12);
    } else {
      setMesActivo(mesActivo - 1);
    }
  };

  const handleMesSiguiente = () => {
    if (mesActivo === 12) {
      setAnioActivo(anioActivo + 1);
      setMesActivo(1);
    } else {
      setMesActivo(mesActivo + 1);
    }
  };

  // ───── Loading state canon ─────
  if (loadingBoletas && boletas.length === 0) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="w-6 h-6 text-sky-500 animate-spin mx-auto mb-2" />
        <p className="text-[12px] text-slate-500">Cargando boletas...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* §A · KPI mini strip · canon N2 sky */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-sky-50 ring-1 ring-sky-200 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-sky-700">BOLETAS DEL MES</div>
          <div className="text-lg font-bold tabular-nums text-sky-900">{stats.total}</div>
          <div className="text-[10px] text-sky-700">
            {MESES[mesActivo - 1]} {anioActivo}
          </div>
        </div>
        <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-emerald-700">PAGADAS</div>
          <div className="text-lg font-bold tabular-nums text-emerald-900">{stats.pagadas}</div>
          <div className="text-[10px] text-emerald-700">
            {stats.total > 0 ? `${Math.round((stats.pagadas / stats.total) * 100)}% completado` : '—'}
          </div>
        </div>
        <div className="bg-amber-50 ring-1 ring-amber-200 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-amber-700">PENDIENTES</div>
          <div className="text-lg font-bold tabular-nums text-amber-900">{stats.pendientes}</div>
          <div className="text-[10px] text-amber-700">borrador + aprobadas</div>
        </div>
        <div className="bg-slate-50 ring-1 ring-slate-200 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-slate-700">TOTAL NETO</div>
          <div className="text-lg font-bold tabular-nums text-slate-900">
            {formatCurrencyPEN(stats.totalNeto)}
          </div>
          <div className="text-[10px] text-slate-500">acumulado del mes</div>
        </div>
      </div>

      {/* §B · Selector período + acciones */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleMesAnterior}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[13px] font-semibold text-slate-900 min-w-[140px] text-center">
            {MESES[mesActivo - 1]} {anioActivo}
          </span>
          <button
            type="button"
            onClick={handleMesSiguiente}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNuevaBoletaOpen(true)}
            className="bg-white border border-sky-300 text-sky-700 text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-sky-50"
          >
            <Plus className="w-3 h-3" />
            Nueva boleta
          </button>
          {boletas.length === 0 && (
            <button
              type="button"
              onClick={() => setGenerarOpen(true)}
              className="bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            >
              <Plus className="w-3 h-3" />
              Generar del mes
            </button>
          )}
        </div>
      </div>

      {/* §C · Chips filtro estado · canon N6 scroll-x mobile */}
      {boletas.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex-shrink-0 inline-flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Estado:
          </span>
          {FILTROS_ESTADO.map((f) => {
            const count = f.id === 'todas' ? boletas.length : boletas.filter((b) => b.estado === f.id).length;
            const activo = filtroEstado === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltroEstado(f.id)}
                className={`text-[10px] px-2 py-1 rounded font-bold whitespace-nowrap transition-colors inline-flex items-center gap-1 ${
                  activo ? f.tinte : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
                <span className={`text-[9px] ${activo ? 'bg-white/70' : 'bg-slate-100'} px-1 rounded`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* §D · Empty state · canon N9 quick-start */}
      {boletas.length === 0 && !loadingBoletas && (
        <div className="bg-gradient-to-br from-sky-50 to-cyan-50/40 ring-1 ring-sky-200 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-sky-100 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-sky-700" />
          </div>
          <div className="text-[14px] font-bold text-slate-900 mb-1">
            No hay boletas para {MESES[mesActivo - 1]} {anioActivo}
          </div>
          <p className="text-[12px] text-slate-600 mb-4 max-w-md mx-auto">
            Generá las boletas del mes en lote o creá una manual para casos puntuales.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setGenerarOpen(true)}
              className="bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Generar boletas del mes
            </button>
            <button
              type="button"
              onClick={() => setNuevaBoletaOpen(true)}
              className="bg-white border border-sky-300 text-sky-700 text-[12px] font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5 hover:bg-sky-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva manual
            </button>
          </div>
        </div>
      )}

      {/* §E · Listado cards apiladas canon F4 */}
      {filtradas.length === 0 && boletas.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-center text-[12px] text-slate-500">
          Sin boletas que coincidan con el filtro "{FILTROS_ESTADO.find((f) => f.id === filtroEstado)?.label}".
        </div>
      )}

      {filtradas.length > 0 && (
        <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filtradas.map((b) => {
            const init = iniciales(b.empleadoNombre);
            return (
              <div
                key={b.id}
                className="px-4 py-3 hover:bg-slate-50/50 cursor-pointer transition-colors"
                onClick={() => setBoletaDetalle(b)}
              >
                <div className="flex items-start gap-3 flex-wrap">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0">
                    {init}
                  </div>

                  {/* Info principal */}
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[13px] sm:text-[14px] font-bold text-slate-900">
                        {b.empleadoNombre}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${ESTADO_CHIP[b.estado]}`}
                      >
                        {ESTADO_BOLETA_LABELS[b.estado]}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {b.id} · {b.empleadoCargo || 'Sin cargo'}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-600 flex-wrap">
                      <span className="tabular-nums">
                        Sueldo: <strong>{formatCurrencyPEN(b.salarioBase)}</strong>
                      </span>
                      {b.comisionesVentas > 0 && (
                        <span className="tabular-nums text-violet-700">
                          + Com {formatCurrencyPEN(b.comisionesVentas)}
                        </span>
                      )}
                      {(b.bonificaciones + b.otrosIngresos) > 0 && (
                        <span className="tabular-nums text-emerald-700">
                          + Bon {formatCurrencyPEN(b.bonificaciones + b.otrosIngresos)}
                        </span>
                      )}
                      {b.totalDescuentos > 0 && (
                        <span className="tabular-nums text-rose-700">
                          − {formatCurrencyPEN(b.totalDescuentos)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* NETO + acciones */}
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">NETO</div>
                      <div className="text-[14px] sm:text-[15px] font-bold tabular-nums text-sky-900">
                        {formatCurrencyPEN(b.totalNeto)}
                      </div>
                    </div>

                    {/* Acciones contextuales */}
                    {b.estado === 'borrador' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAprobar(b)}
                          className="p-1.5 hover:bg-emerald-50 rounded text-emerald-600"
                          title="Aprobar"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEliminar(b)}
                          className="p-1.5 hover:bg-rose-50 rounded text-rose-600"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {b.estado === 'aprobada' && (
                      <button
                        type="button"
                        onClick={() => setBoletaDetalle(b)}
                        className="p-1.5 hover:bg-sky-50 rounded text-sky-700"
                        title="Marcar pagada"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {(b.estado === 'borrador' || b.estado === 'aprobada') && (
                      <button
                        type="button"
                        onClick={() => handleAnular(b)}
                        className="p-1.5 hover:bg-amber-50 rounded text-amber-600"
                        title="Anular"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal detalle canon */}
      <BoletaDetalleModal
        isOpen={!!boletaDetalle}
        onClose={() => {
          setBoletaDetalle(null);
          fetchBoletas();
        }}
        boleta={boletaDetalle}
        onSuccess={(msg) => toast.success(msg)}
        onError={(msg) => toast.error(msg)}
      />

      {/* Modal nueva boleta manual canon */}
      <NuevaBoletaModal
        isOpen={nuevaBoletaOpen}
        onClose={() => setNuevaBoletaOpen(false)}
        mes={mesActivo}
        anio={anioActivo}
        onSuccess={(msg) => {
          toast.success(msg);
          fetchBoletas();
        }}
        onError={(msg) => toast.error(msg)}
      />

      {/* Modal generar boletas del mes canon */}
      <GenerarBoletasModal
        isOpen={generarOpen}
        onClose={() => setGenerarOpen(false)}
        mes={mesActivo}
        anio={anioActivo}
        onSuccess={(msg) => {
          toast.success(msg);
          fetchBoletas();
        }}
        onError={(msg) => toast.error(msg)}
      />

      <ConfirmDialog {...confirm.dialogProps} />

      {/* Banner cuando hay pendientes · canon contextual */}
      {stats.pendientes > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>{stats.pendientes}</strong> boleta{stats.pendientes === 1 ? '' : 's'}{' '}
            pendiente{stats.pendientes === 1 ? '' : 's'} de aprobación o pago. Andá a cada una y
            usá Aprobar → Pagar para cerrar el ciclo.
          </span>
        </div>
      )}
    </div>
  );
};
