/**
 * InvestigacionCompletaModal · Modal grande con 3 sub-tabs · F6(A)
 *
 * Mockup canónico: docs/mockups/productos/24-modal-investigacion-completo.html
 *
 * Modal de análisis de mercado para un producto:
 *   - Header con SKU + nombre + acciones (Re-investigar, kebab, X)
 *   - Banner de alertas activas (si hay)
 *   - 3 tabs: Proveedores · Competencia · Decisión
 *   - Footer con última actualización + acción "Marcar como vista"
 *
 * Trigger: desde tab Investigación del modal detalle (#13) "Ver investigación completa"
 *          o desde card row "Investigar"
 */

import React, { useEffect, useState } from 'react';
import {
  X,
  RefreshCw,
  MoreHorizontal,
  Search as SearchIcon,
  AlertTriangle,
  DollarSign,
  Users,
  Target,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { TabProveedores } from './investigacion/TabProveedores';
import { TabCompetencia } from './investigacion/TabCompetencia';
import { TabDecision } from './investigacion/TabDecision';
import type { InvestigacionPayload } from './investigacion/types';

type TabKey = 'proveedores' | 'competencia' | 'decision';

interface InvestigacionCompletaModalProps {
  open: boolean;
  payload: InvestigacionPayload | null;
  tuPrecioPEN?: number;                 // Para TabCompetencia
  onClose: () => void;
  onReinvestigar?: () => void;
  onMarcarVista?: () => void;
  onAgregarProveedor?: () => void;
  onCrearOC?: (proveedorId: string) => void;
  onAgregarCompetidor?: (nombre: string) => void;
  onImportar?: () => void;
  onDescartar?: () => void;
}

export function InvestigacionCompletaModal({
  open,
  payload,
  tuPrecioPEN,
  onClose,
  onReinvestigar,
  onMarcarVista,
  onAgregarProveedor,
  onCrearOC,
  onAgregarCompetidor,
  onImportar,
  onDescartar,
}: InvestigacionCompletaModalProps) {
  const [tab, setTab] = useState<TabKey>('proveedores');

  // ESC para cerrar
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Reset tab al abrir
  useEffect(() => {
    if (open) setTab('proveedores');
  }, [open, payload?.productoId]);

  if (!open || !payload) return null;

  const proveedoresCount = payload.proveedores.length;
  const competidoresCount = payload.competidores.filter((c) => !c.esTu).length;

  const tabs: Array<{
    key: TabKey;
    label: string;
    icon: typeof DollarSign;
    badge?: number;
  }> = [
    { key: 'proveedores', label: 'Proveedores', icon: DollarSign, badge: proveedoresCount },
    { key: 'competencia', label: 'Competencia', icon: Users, badge: competidoresCount },
    { key: 'decision', label: 'Decisión', icon: Target },
  ];

  const precioReferencia =
    tuPrecioPEN ?? payload.competidores.find((c) => c.esTu)?.precioPEN ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 px-4 lg:px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center flex-shrink-0">
                <SearchIcon className="w-6 h-6 text-amber-700" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-slate-500 flex items-center gap-2 mb-0.5 truncate">
                  <span className="font-mono">{payload.productoSku}</span>
                  {payload.productoMarca && (
                    <>
                      <span>·</span>
                      <span className="truncate">{payload.productoMarca}</span>
                    </>
                  )}
                </div>
                <h2 className="text-base lg:text-xl font-bold text-slate-900 truncate">
                  Investigación · {payload.productoNombre}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                  Análisis de mercado · proveedores + competencia + decisión
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={onReinvestigar}
                className="hidden sm:flex px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Re-investigar
              </button>
              <button
                onClick={onReinvestigar}
                className="sm:hidden p-1.5 hover:bg-slate-100 rounded-md text-amber-700"
                title="Re-investigar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500">
                <MoreHorizontal className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* BANNER ALERTAS */}
        {payload.alertas.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 lg:px-6 py-3 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <strong className="text-amber-900">
                {payload.alertas.length} alerta{payload.alertas.length === 1 ? '' : 's'} activa
                {payload.alertas.length === 1 ? '' : 's'}:
              </strong>{' '}
              <span className="text-amber-800">
                {payload.alertas.slice(0, 3).map((a) => a.mensaje).join(' · ')}
              </span>
            </div>
            {payload.alertas.length > 3 && (
              <button className="text-[10px] font-bold text-amber-800 hover:text-amber-900 flex-shrink-0 whitespace-nowrap">
                Ver todas →
              </button>
            )}
          </div>
        )}

        {/* TABS */}
        <div className="border-b border-slate-200 bg-slate-50/30">
          <div className="flex items-center gap-0 px-4 overflow-x-auto scrollbar-hide fade-x-edges">
            {tabs.map((t) => {
              const Icon = t.icon;
              const activo = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                    activo
                      ? 'border-amber-600 text-amber-700 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                  {t.badge !== undefined && t.badge > 0 && (
                    <span
                      className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-full ${
                        activo ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* CONTENIDO */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-5">
          {tab === 'proveedores' && (
            <TabProveedores
              proveedores={payload.proveedores}
              onAgregarProveedor={onAgregarProveedor}
              onCrearOC={onCrearOC}
            />
          )}
          {tab === 'competencia' && (
            <TabCompetencia
              competidores={payload.competidores}
              tuPrecioPEN={precioReferencia}
              onAgregarCompetidor={onAgregarCompetidor}
            />
          )}
          {tab === 'decision' && (
            <TabDecision
              decision={payload.decision}
              onImportar={onImportar}
              onDescartar={onDescartar}
            />
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 lg:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <Clock className="w-3 h-3" />
            <span>
              Última actualización: {payload.ultimaActualizacion ?? '—'}
              {payload.hace && ` · hace ${payload.hace}`}
            </span>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={onMarcarVista}
              className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Marcar como vista
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
